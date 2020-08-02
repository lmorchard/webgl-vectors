async function init() {
  console.log("READY.");

  const viewport = (window.viewport = new ViewportWebGL());
  viewport.initialize();

  viewport.scene.play = {
    position: [0.0, 0.0],
    shapes: heroShapes,
    visible: true,
    rotation: 0.0,
    scale: 100.0,
    color: [1.0, 1.0, 1.0, 1.0],
  };

  const draw = () => {
    viewport.draw();
    window.requestAnimationFrame(draw);
  };

  const tickDuration = TARGET_DURATION;
  const maxTickDelta = TARGET_DURATION * 5;

  let lastTickTime;
  const update = () => {
    const timeNow = Date.now();
    const timeDelta = Math.min(timeNow - lastTickTime, maxTickDelta);
    lastTickTime = timeNow;

    viewport.scene.play.rotation += 0.04;

    viewport.update(timeDelta);

    setTimeout(update, tickDuration);
  };

  update();
  draw();
}

const TARGET_FPS = 60;
const TARGET_DURATION = 1000 / TARGET_FPS;

const PI2 = Math.PI * 2;

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
const TYPE_SIZES = {
  0x1406: 1, // FLOAT
  0x8b50: 2, // FLOAT_VEC2
  0x8b51: 3, // FLOAT_VEC3
  0x8b52: 4, // FLOAT_VEC4
};

let entityId, position, sprites, sprite, sceneSprite;

// See also: http://phrogz.net/JS/wheeldelta.html
const wheelDistance = function (evt) {
  if (!evt) evt = event;
  const w = evt.wheelDelta,
    d = evt.detail;
  if (d) {
    if (w) return (w / d / 40) * d > 0 ? 1 : -1;
    // Opera
    else return -d / 3; // Firefox;         TODO: do not /3 for OS X
  } else return w / 120; // IE/Safari/Chrome TODO: /3 for Chrome OS X
};

class ViewportWebGL {
  constructor(options) {
    this.options = { ...this.defaultOptions(), ...(options || {}) };
    this.debug = this.options.debug || false;
  }

  defaultOptions() {
    return {
      containerId: "main",
      canvasId: "mainCanvas",
      removeCanvas: false,
      lineWidth: 4.0,
      zoom: 1.0,
      zoomMin: 0.1,
      zoomMax: 10.0,
      zoomWheelFactor: 0.05,
      visibleMargin: 250,
      gridEnabled: true,
      gridSize: 250,
      gridColor: 0x111111,
      followEnabled: true,
      followName: null,
      followEntityId: null,
    };
  }

  initialize() {
    this.spriteCount = 0;
    this.lastVertexCount = 0;
    this.actualBufferSize = 0;
    this.calculatedBufferSize = 0;

    this.container = document.querySelector(`#${this.options.containerId}`);
    this.canvas = document.querySelector(`#${this.options.canvasId}`);
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.setAttribute("id", this.options.canvasId);
      this.container.appendChild(this.canvas);
    }

    this.initWebGL(this.canvas);

    this.scene = {};

    this.events = {
      resize: (ev) => {
        this.updateMetrics(ev);
      },
      orientationchange: (ev) => {
        this.updateMetrics(ev);
      },
      mousedown: (ev) => {
        this.onMouseDown(ev);
      },
      mousemove: (ev) => {
        this.onMouseMove(ev);
      },
      mouseup: (ev) => {
        this.onMouseUp(ev);
      },
    };

    for (const name in this.events) {
      this.canvas.addEventListener(name, this.events[name], false);
    }

    // See also: http://phrogz.net/JS/wheeldelta.html
    this.boundOnMouseWheel = (ev) => this.onMouseWheel(ev);
    window.addEventListener("mousewheel", this.boundOnMouseWheel, false); // Chrome/Safari/Opera
    window.addEventListener("DOMMouseScroll", this.boundOnMouseWheel, false); // Firefox

    this.followEnabled = this.options.followEnabled;
    this.zoom = this.options.zoom;
    this.followEntityId = this.options.followEntityId;
    this.gridEnabled = this.options.gridEnabled;
    this.lineWidth = this.options.lineWidth;

    this.cursorRawX = 0;
    this.cursorRawY = 0;

    this.cursorChanged = false;
    this.cursorPosition = { x: 0, y: 0 };

    this.cameraX = 0;
    this.cameraY = 0;

    this.updateMetrics();
  }

  stop() {
    for (const name in this.events) {
      this.canvas.removeEventListener(name, this.events[name], false);
    }
    if (this.options.removeCanvas) {
      this.container.removeChild(this.canvas);
    }
    window.removeEventListener("mousewheel", this.boundOnMouseWheel, false); // Chrome/Safari/Opera
    window.removeEventListener("DOMMouseScroll", this.boundOnMouseWheel, false); // Firefox
  }

  onMouseWheel(ev) {
    this.zoom += wheelDistance(ev) * this.options.zoomWheelFactor;
    if (this.zoom < this.options.zoomMin) {
      this.zoom = this.options.zoomMin;
    }
    if (this.zoom > this.options.zoomMax) {
      this.zoom = this.options.zoomMax;
    }
  }

  // TODO: Use a symbol for 'mouse{Down,Move,Up}' message?

  onMouseDown(ev) {
    this.setCursor(ev.clientX, ev.clientY);
  }

  onMouseMove(ev) {
    this.setCursor(ev.clientX, ev.clientY);
  }

  onMouseUp(ev) {
    this.setCursor(ev.clientX, ev.clientY, true);
  }

  setCursor(x, y) {
    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;

    this.cursorRawX = x;
    this.cursorRawY = y;

    const newX = (x - width / 2) / this.zoom + this.cameraX;
    const newY = (y - height / 2) / this.zoom + this.cameraY;

    this.cursorChanged = false;
    if (newX !== this.cursorPosition.x || newY !== this.cursorPosition.y) {
      this.cursorChanged = true;
      this.cursorPosition.x = newX;
      this.cursorPosition.y = newY;
    }

    return this.cursorPosition;
  }

  updateMetrics() {
    const width = this.container.offsetWidth;
    const height = this.container.offsetHeight;

    this.visibleWidth = width / this.zoom;
    this.visibleHeight = height / this.zoom;

    this.visibleLeft = 0 - this.visibleWidth / 2 + this.cameraX;
    this.visibleTop = 0 - this.visibleHeight / 2 + this.cameraY;
    this.visibleRight = this.visibleLeft + this.visibleWidth;
    this.visibleBottom = this.visibleTop + this.visibleHeight;
  }

  update(timeDelta) {
    this.updateMetrics();
    this.setCursor(this.cursorRawX, this.cursorRawY);
    this.updateBackdrop(timeDelta);
  }

  draw() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;

    // gl.uniform1f(uniforms.uTime, currDrawTime);
    this.setUniforms({
      uLineWidth: [0.001 * this.lineWidth],
      uCameraZoom: [this.zoom],
      uCameraOrigin: [this.cameraX, this.cameraY],
      uViewportSize: [this.canvas.clientWidth, this.canvas.clientHeight],
    });

    // Re-allocate larger buffer if current is too small for the scene.
    const bufferSize = this.calculateBufferSizeForScene();
    this.actualBufferSize = this.buffer.length;
    this.calculatedBufferSize = bufferSize;
    if (bufferSize > this.buffer.length) {
      this.buffer = new Float32Array(
        Math.max(bufferSize * 1.5, this.buffer.length * 2)
      );
    }

    const vertexCount = this.fillBufferFromScene();
    this.lastVertexCount = vertexCount;
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.buffer, this.gl.STATIC_DRAW);
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, vertexCount);
  }

  updateBackdrop() {
    if (!this.gridEnabled) {
      delete this.scene._backdrop;
      return;
    }

    if (!this.scene._backdrop) {
      this.scene._backdrop = {
        visible: true,
        position: [0.0, 0.0],
        color: [1.0, 1.0, 1.0, 0.25],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }

    const sceneSprite = this.scene._backdrop;

    const gridSize = this.options.gridSize;
    const gridOffsetX = this.visibleLeft % gridSize;
    const gridOffsetY = this.visibleTop % gridSize;

    sceneSprite.position[0] = this.visibleLeft;
    sceneSprite.position[1] = this.visibleTop;
    sceneSprite.shapes.length = 0;

    for (let x = -gridOffsetX; x < this.visibleWidth; x += gridSize) {
      sceneSprite.shapes.push([
        [x, 0],
        [x, this.visibleHeight + gridSize],
      ]);
    }
    for (let y = -gridOffsetY; y < this.visibleHeight; y += gridSize) {
      sceneSprite.shapes.push([
        [0, y],
        [this.visibleWidth + gridSize, y],
      ]);
    }
  }

  initWebGL(canvas) {
    const gl = (this.gl = canvas.getContext("webgl", {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    }));

    //gl.blendFunc(gl.SRC_COLOR, gl.ONE);
    //gl.enable(gl.BLEND);

    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.disable(gl.DEPTH_TEST);

    const program = this.createProgram(
      this.createShader(gl.VERTEX_SHADER, SHADER_VERTEX),
      this.createShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT)
    );
    gl.useProgram(program);

    // Set up for data buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());

    // First pass through attributes to count total vertex size and index by name
    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const attribs = {};
    let vertexSize = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(program, i);
      const size = TYPE_SIZES[info.type];
      vertexSize += size;
      attribs[info.name] = i;
    }

    // Second pass through attributes to set up attribute pointers into the buffer
    let pos = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(program, i);
      const size = TYPE_SIZES[info.type];
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, vertexSize * 4, pos * 4);
      gl.enableVertexAttribArray(i);
      pos += size;
    }

    // Index uniform locations by name
    const uniforms = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const buffer = new Float32Array(200000);

    Object.assign(this, { gl, uniforms, attribs, vertexSize, buffer });
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (success) {
      return shader;
    }

    // console.log('shader', type, 'failed to compile', this.gl.getShaderInfoLog(shader));
    this.gl.deleteShader(shader);
  }

  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (success) {
      return program;
    }

    // console.log(this.gl.getProgramInfoLog(program));
    this.gl.deleteProgram(program);
  }

  calculateBufferSizeForScene() {
    const objects = Object.values(this.scene);
    this.spriteCount = objects.length;
    return objects.reduce(
      (acc, item) =>
        acc +
        item.shapes.reduce(
          (acc, shape) => acc + (shape.length - 0.5) * this.vertexSize * 4,
          0
        ),
      0
    );
  }

  fillBufferFromScene() {
    let vertexCount = 0;
    let bufferPos = 0;
    let visible,
      shape,
      position,
      scale,
      rotation,
      deltaPosition,
      deltaScale,
      deltaRotation,
      color,
      lineIdx,
      shapesIdx,
      shapes;

    const bufferVertex = (shapeIdx, lineIdx) => {
      vertexCount++;
      this.buffer[bufferPos++] = lineIdx;
      this.buffer[bufferPos++] = shape[shapeIdx - 1][0];
      this.buffer[bufferPos++] = shape[shapeIdx - 1][1];
      this.buffer[bufferPos++] = shape[shapeIdx][0];
      this.buffer[bufferPos++] = shape[shapeIdx][1];
      this.buffer[bufferPos++] = position[0];
      this.buffer[bufferPos++] = position[1];
      this.buffer[bufferPos++] = scale;
      this.buffer[bufferPos++] = rotation;
      this.buffer[bufferPos++] = deltaPosition[0];
      this.buffer[bufferPos++] = deltaPosition[1];
      this.buffer[bufferPos++] = deltaScale;
      this.buffer[bufferPos++] = deltaRotation;
      this.buffer[bufferPos++] = color[0];
      this.buffer[bufferPos++] = color[1];
      this.buffer[bufferPos++] = color[2];
      this.buffer[bufferPos++] = color[3];
    };

    const sceneKeys = Object.keys(this.scene).sort();
    for (
      let sceneKeysIdx = 0;
      sceneKeysIdx < sceneKeys.length;
      sceneKeysIdx++
    ) {
      ({
        visible,
        shapes,
        position = [0.0, 0.0],
        scale = 0,
        rotation = 0,
        deltaPosition = [0.0, 0.0],
        deltaScale = 0.0,
        deltaRotation = 0.0,
        color = [1, 1, 1, 1],
      } = this.scene[sceneKeys[sceneKeysIdx]]);
      if (!visible) {
        continue;
      }
      for (shapesIdx = 0; shapesIdx < shapes.length; shapesIdx++) {
        shape = shapes[shapesIdx];
        bufferVertex(1, 0);
        for (lineIdx = 1; lineIdx < shape.length; lineIdx += 1) {
          bufferVertex(lineIdx, 0);
          bufferVertex(lineIdx, 1);
          bufferVertex(lineIdx, 2);
          bufferVertex(lineIdx, 3);
        }
        bufferVertex(shape.length - 1, 3);
      }
    }

    return vertexCount;
  }

  setUniforms(data) {
    Object.keys(data).forEach((key) =>
      this.gl[`uniform${data[key].length}f`].call(
        this.gl,
        this.uniforms[key],
        ...data[key]
      )
    );
  }
}

const defaultShape = [
  [-0.5, 0],
  [0.5, 0],
  [0, 0],
  [0, -0.5],
  [0, 0.5],
  [0, 0],
];
for (let idx = 0; idx < 8; idx++) {
  const rot = idx * (PI2 / 8);
  defaultShape.push([0.5 * Math.cos(rot), 0.5 * Math.sin(rot)]);
}
defaultShape.push([0.5, 0]);

const heroShapes = [
  [
    [0.0, 0.5],
    [0.125, 0.4167],
    [0.25, 0.0],
    [0.375, -0.1667],
    [0.25, -0.5],
    [0.125, -0.5],
    [0.0625, -0.25],
    [-0.0625, -0.25],
    [-0.125, -0.5],
    [-0.25, -0.5],
    [-0.375, -0.1667],
    [-0.25, 0.0],
    [-0.125, 0.4167],
    [0.0, 0.5],
  ],
];

const busShapes = [
  [
    [0.125, 0.5],
    [-0.125, 0.5],
    [-0.25, 0.375],
    [-0.25, 0.125],
    [-0.3125, 0.25],
    [-0.4375, 0.25],
    [-0.5, 0.125],
    [-0.5, -0.4375],
    [-0.4375, -0.5],
    [-0.375, -0.5],
    [-0.25, -0.4375],
    [-0.25, -0.125],
    [-0.125, -0.5],
    [0.125, -0.5],
    [0.25, -0.125],
    [0.25, -0.4375],
    [0.375, -0.5],
    [0.4375, -0.5],
    [0.5, -0.4375],
    [0.5, 0.125],
    [0.4375, 0.25],
    [0.3125, 0.25],
    [0.25, 0.125],
    [0.25, 0.375],
    [0.125, 0.5],
  ],
];

const repulsorSides = 8;
const repulsorPoints = [];
for (let idx = 0; idx < repulsorSides; idx++) {
  const rot = idx * (PI2 / repulsorSides);
  repulsorPoints.push([Math.cos(rot), Math.sin(rot)]);
}
repulsorPoints.push(repulsorPoints[0]);

const repulsorShapes = [
  repulsorPoints.map((p) => [p[0] * 1, p[1] * 1]),
  repulsorPoints.map((p) => [p[0] * 2, p[1] * 2]),
  repulsorPoints.map((p) => [p[0] * 3, p[1] * 3]),
  [
    [-0.5, 0.0],
    [-0.375, -0.5],
    [-0.25, -0.5],
    [-0.0625, 0.25],
    [0.0625, 0.25],
    [0.25, -0.5],
    [0.375, -0.5],
    [0.5, 0.0],
    [0.375, 0.5],
    [0.25, 0.5],
    [0.0625, -0.25],
    [-0.0625, -0.25],
    [-0.25, 0.5],
    [-0.375, 0.5],
    [-0.5, 0.0],
  ],
];

const passthrough = (strings, ...values) =>
  strings.reduce(
    (result, string, idx) => result + string + (values[idx] ? values[idx] : ""),
    ""
  );

const glsl = passthrough;
const frag = passthrough;
const vert = passthrough;

const SHADER_VERTEX = glsl`
// see also: http://m1el.github.io/woscope-how/
precision mediump float;
#define EPS 1E-6
#define PI 3.141592653589793
#define PI_2 6.283185307179586
#define PI_H 1.5707963267948966
#define PI_Q 0.7853981633974483

uniform float uTime;
uniform float uLineWidth;
uniform float uCameraZoom;
uniform float uCameraRotation;
uniform vec2 uCameraOrigin;
uniform vec2 uViewportSize;

attribute float aIdx;
attribute vec4 aLine;
attribute vec4 aTransform;
attribute vec4 aDeltaTransform;
attribute vec4 aColor;

varying vec4 uvl;
varying vec4 vColor;
varying float vLen;

void main () {

  vec2 viewportRatio;
  if (uViewportSize.x > uViewportSize.y) {
    viewportRatio.x = uViewportSize.y / uViewportSize.x;
    viewportRatio.y = 1.0;
  } else {
    viewportRatio.x = 1.0;
    viewportRatio.y = uViewportSize.x / uViewportSize.y;
  }

  vec2 viewportLineWidth = uLineWidth * viewportRatio;

  float cameraCos = cos(uCameraRotation);
  float cameraSin = sin(uCameraRotation);

  mat3 mViewportToClipSpace = mat3(
    2.0 / uViewportSize.x, 0, 0,
    0, -2.0 / uViewportSize.y, 0,
    0, 0, 0
  );
  
  mat3 mCameraRotation = mat3(
    cameraCos, -cameraSin, 0.0,
    cameraSin, cameraCos, 0.0,
    0.0, 0.0, 1.0
  );

  mat3 mCameraOrigin = mat3(
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    -uCameraOrigin.x, -uCameraOrigin.y, 1.0
  );

  mat3 mCameraZoom = mat3(
    uCameraZoom, 0.0, 0.0,
    0.0, uCameraZoom, 0.0,
    0.0, 0.0, 1.0
  );

  float rotationCos = cos(-aTransform.w + PI_H + (aDeltaTransform.w * uTime));
  float rotationSin = sin(-aTransform.w + PI_H + (aDeltaTransform.w * uTime));

  mat3 mRotation = mat3(
    rotationCos, -rotationSin, 0.0,
    rotationSin, rotationCos, 0.0,
    0.0, 0.0, 1.0
  );

  mat3 mPosition = mat3(
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    aTransform.x + (aDeltaTransform.x * uTime), aTransform.y + (aDeltaTransform.y * uTime), 1.0
  );

  mat3 mScale = mat3(
    aTransform.z + (aDeltaTransform.z * uTime), 0.0, 0.0,
    0.0, aTransform.z + (aDeltaTransform.z * uTime), 0.0,
    0.0, 0.0, 1.0
  );

  // TODO: Move some of these matrices into JS?
  mat3 mAll = mViewportToClipSpace
    * mCameraZoom * mCameraRotation * mCameraOrigin
    * mPosition * mScale * mRotation;

  vec2 tStart = (mAll * vec3(aLine.xy, 1)).xy;
  vec2 tEnd = (mAll * vec3(aLine.zw, 1)).xy;

  float tang;
  vec2 current;
  float idx = aIdx;
  if (idx >= 2.0) {
    current = tEnd;
    tang = 1.0;
  } else {
    current = tStart;
    tang = -1.0;
  }

  float side = (mod(idx, 2.0)-0.5)*2.0;
  vec2 dir = tEnd-tStart;

  vColor = aColor;

  uvl.xy = vec2(tang, side);
  uvl.w = floor(aIdx / 4.0 + 0.5);
  uvl.z = length(dir);

  if (uvl.z > EPS) {
    dir = dir / uvl.z;
  } else {
    // If the segment is too short draw a square;
    dir = vec2(1.0, 0.0);
  }

  vec2 norm = vec2(-dir.y, dir.x);

  gl_Position = vec4(
    (current + (tang * dir + norm * side) * viewportLineWidth),
    0.0,
    1.0
  );
}
`;

const SHADER_FRAGMENT = glsl`
precision mediump float;
varying vec4 vColor;

void main (void)
{
    gl_FragColor = vColor;
}
`;

init()
  .then()
  .catch((err) => console.error(err));
