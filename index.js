import GLProgram, { createGLProgram } from "./lib/GLProgram.js";
import GLBuffer from "./lib/GLBuffer.js";

const PI2 = Math.PI * 2;
const Pi_4 = Math.PI / 4;
const TARGET_FPS = 60;
const TARGET_DURATION = 1000 / TARGET_FPS;
const tickDuration = TARGET_DURATION;
const maxTickDelta = TARGET_DURATION * 5;

async function init() {
  console.log("READY.");

  const viewport = new ViewportWebGL();
  window.viewport = viewport;
  await viewport.initialize();

  viewport.scene.play1 = {
    position: [0.0, 0.0],
    shapes: heroShapes,
    visible: true,
    rotation: 0.0,
    scale: 100.0,
    color: [1.0, 0.0, 1.0, 1.0],
  };

  viewport.scene.play2 = {
    position: [-150.0, -150.0],
    shapes: repulsorShapes,
    visible: true,
    rotation: 0.0,
    scale: 25.0,
    color: [0.0, 1.0, 1.0, 1.0],
  };

  viewport.scene.play3 = {
    position: [150.0, 150.0],
    shapes: busShapes,
    visible: true,
    rotation: 0.0,
    scale: 100.0,
    color: [1.0, 1.0, 0.0, 1.0],
  };

  viewport.scene.play4 = {
    position: [-150.0, 150.0],
    shapes: heroShapes,
    visible: true,
    rotation: 0.0,
    scale: 100.0,
    color: [0.0, 0.0, 1.0, 1.0],
  };

  viewport.scene.play5 = {
    position: [150.0, -150.0],
    shapes: busShapes,
    visible: true,
    rotation: 0.0,
    scale: 100.0,
    color: [1.0, 1.0, 1.0, 1.0],
  };

  let lastTickTime;
  const update = () => {
    const timeNow = Date.now();
    const timeDelta = Math.min(timeNow - lastTickTime, maxTickDelta);
    lastTickTime = timeNow;

    viewport.scene.play1.rotation += 0.04;
    viewport.scene.play2.rotation -= 0.04;
    viewport.scene.play3.rotation -= 0.04;
    viewport.scene.play4.rotation -= 0.04;
    viewport.scene.play5.rotation += 0.04;
    //viewport.cameraRotation -= 0.01;
    //viewport.cameraX += 1.5;

    viewport.update(timeDelta);

    setTimeout(update, tickDuration);
  };

  const draw = () => {
    viewport.draw();
    window.requestAnimationFrame(draw);
  };

  update();
  draw();
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

// TODO: separate out mouse handling from GL rendering

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
      lineWidth: 1.25,
      zoom: 1.0,
      zoomMin: 0.1,
      zoomMax: 10.0,
      zoomWheelFactor: 0.05,
      visibleMargin: 250,
      gridEnabled: true,
      gridSize: 250,
      gridColor: 0x111111,
    };
  }

  async initialize() {
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

    await this.initWebGL(this.canvas);

    this.scene = {};

    this.events = {
      resize: (ev) => this.updateMetrics(ev),
      orientationchange: (ev) => this.updateMetrics(ev),
      mousedown: (ev) => this.onMouseDown(ev),
      mousemove: (ev) => this.onMouseMove(ev),
      mouseup: (ev) => this.onMouseUp(ev),
    };

    for (const name in this.events) {
      this.canvas.addEventListener(name, this.events[name], false);
    }

    // See also: http://phrogz.net/JS/wheeldelta.html
    this.boundOnMouseWheel = (ev) => this.onMouseWheel(ev);
    window.addEventListener("mousewheel", this.boundOnMouseWheel, false); // Chrome/Safari/Opera
    window.addEventListener("DOMMouseScroll", this.boundOnMouseWheel, false); // Firefox

    this.zoom = this.options.zoom;
    this.gridEnabled = this.options.gridEnabled;
    this.lineWidth = this.options.lineWidth;

    this.cursorRawX = 0;
    this.cursorRawY = 0;

    this.cursorChanged = false;
    this.cursorPosition = { x: 0, y: 0 };

    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraRotation = 0;

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

  updateBackdrop() {
    if (!this.gridEnabled) {
      delete this.scene._backdrop;
      return;
    }

    if (!this.scene._backdrop) {
      this.scene._backdrop = {
        visible: false, //true,
        position: [0.0, 0.0],
        color: [1.0, 1.0, 1.0, 0.2],
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

  update(timeDelta) {
    this.updateMetrics();
    this.setCursor(this.cursorRawX, this.cursorRawY);
    this.updateBackdrop(timeDelta);
  }

  async initWebGL(canvas) {
    const gl = (this.gl = canvas.getContext("webgl", {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    }));

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    this.textures = [];
    this.framebuffers = [];
    for (let idx = 0; idx < 10; idx++) {
      const { texture, framebuffer } = this.createTextureAndFramebuffer();
      this.textures.push(texture);
      this.framebuffers.push(framebuffer);
    }

    this.filterVertexBuffer = new GLBuffer(
      gl,
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]),
      gl.STATIC_DRAW
    );

    const programLineDraw = (this.programLineDraw = new GLProgram({
      gl,
      vertexShaderName: "line-draw-vertex",
      fragmentShaderName: "line-draw-fragment",
    }));
    await programLineDraw.initialize();
    

    const programLineWoscope = (this.programLineWoscope = new GLProgram({
      gl,
      vertexShaderName: "line-woscope-vertex",
      fragmentShaderName: "line-woscope-fragment",
    }));
    await programLineWoscope.initialize();
    this.lineProgramGLBuffer = gl.createBuffer();

    this.programBlurFilter = await createGLProgram({
      gl,
      vertexShaderName: "filter-blur-vertex",
      fragmentShaderName: "filter-blur-fragment",
    });

    this.programColorFilter = await createGLProgram({
      gl,
      vertexShaderName: "filter-vertex",
      fragmentShaderName: "filter-fragment",
    });

    this.programSimpleBlur = await createGLProgram({
      gl,
      vertexShaderName: "filter-simple-blur-vertex",
      fragmentShaderName: "filter-simple-blur-fragment",
    });

    this.programCopy = await createGLProgram({
      gl,
      vertexShaderName: "copy-vertex",
      fragmentShaderName: "copy-fragment",
    });

    this.programCombine = await createGLProgram({
      gl,
      vertexShaderName: "combine-vertex",
      fragmentShaderName: "combine-fragment",
    });

    this.programSeparableBlur = await createGLProgram({
      gl,
      vertexShaderName: "separable-blur-vertex",
      fragmentShaderName: "separable-blur-fragment",
    });

    this.programComposite = await createGLProgram({
      gl,
      vertexShaderName: "composite-vertex",
      fragmentShaderName: "composite-fragment",
    });
  }

  createFullCanvasBuffer() {
    const gl = this.gl;
    return new GLBuffer(
      gl,
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]),
      gl.STATIC_DRAW
    );
  }

  draw() {
    const gl = this.gl;

    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;

    const uTime = Date.now() / 1000.0;
    const uViewportSize = [this.canvas.clientWidth, this.canvas.clientHeight];

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineProgramGLBuffer);

    /*
    this.programLineWoscope.useProgram({
      uCameraZoom: this.zoom,
      uCameraOrigin: [this.cameraX, this.cameraY],
      uCameraRotation: this.cameraRotation,
      uViewportSize,
      uIntensity: 1.0,
      uSize: 0.001,
    });
    //gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.renderTo(this.framebuffers[0], this.textures[0]);
    const vertexCount = this.fillLineDrawBufferFromScene(
      this.programLineWoscope.buffer
    );
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.programLineWoscope.buffer,
      this.gl.STATIC_DRAW
    );
    this.clearCanvas();
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, vertexCount);
  */

    this.programLineDraw.useProgram({
      uLineWidth: 0.001 * this.lineWidth,
      uCameraZoom: this.zoom,
      uCameraOrigin: [this.cameraX, this.cameraY],
      uCameraRotation: this.cameraRotation,
      uViewportSize,
    });
    //gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.renderTo(this.framebuffers[0], this.textures[0]);
    const vertexCount = this.fillLineDrawBufferFromScene(
      this.programLineDraw.buffer
    );
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.programLineDraw.buffer,
      this.gl.STATIC_DRAW
    );
    this.clearCanvas();
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, vertexCount);

   this.filterTextureWithProgram({
    program: this.programCopy,
    uniforms: {
      uViewportSize,
      opacity: 1.0,
      texture: this.textures[0],
    },
    outputTexture: this.textures[1],
  });

    const kernelSizeArray = [3, 5, 7, 9, 11];
    //const kernelSizeArray = [3, 5, 9, 13, 19];
    const blurTextureBase = 3;

    for (let idx = 0; idx < 5; idx++) {
      const commonUniforms = {
        uViewportSize,
        kernelRadius: kernelSizeArray[idx],
        sigma: kernelSizeArray[idx],
      };
      this.filterTextureWithProgram({
        program: this.programSeparableBlur,
        uniforms: {
          ...commonUniforms,
          texture: this.textures[1],
          direction: [1.0, 0.0],
        },
        outputTexture: this.textures[2],
      });
      this.filterTextureWithProgram({
        program: this.programSeparableBlur,
        uniforms: {
          ...commonUniforms,
          texture: this.textures[2],
          direction: [0.0, 1.0],
        },
        outputTexture: this.textures[1],
      });
      this.filterTextureWithProgram({
        program: this.programCopy,
        uniforms: {
          uViewportSize,
          opacity: 1.0,
          texture: this.textures[1],
        },
        outputTexture: this.textures[blurTextureBase + idx],
      });
    }

    this.filterVertexBuffer.bind(gl);
    this.programComposite.useProgram({
      uViewportSize,
      blurTexture1: this.textures[blurTextureBase],
      blurTexture2: this.textures[blurTextureBase + 1],
      blurTexture3: this.textures[blurTextureBase + 2],
      blurTexture4: this.textures[blurTextureBase + 3],
      blurTexture5: this.textures[blurTextureBase + 4],
      bloomStrength: 1.0,
      bloomRadius: 0,
    });
    gl.uniform1fv(this.programComposite.uniforms["bloomFactors[0]"].location, [
      1.0,
      0.8,
      0.6,
      0.4,
      0.2,
    ]);
    gl.uniform3fv(
      this.programComposite.uniforms["bloomTintColors[0]"].location,
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    );
    this.renderTo(this.framebuffers[0], this.textures[1]);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

   this.filterVertexBuffer.bind(gl);
    this.programCombine.useProgram({
      uViewportSize,
      srcData: this.textures[0],
      blurData: this.textures[1],
    });
    gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  filterTextureWithProgram({ program, uniforms = {}, outputTexture }) {
    const gl = this.gl;
    this.filterVertexBuffer.bind(gl);
    program.useProgram(uniforms);
    this.renderTo(this.framebuffers[0], outputTexture);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  renderTo(framebuffer, texture) {
    const gl = this.gl;

    gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    framebuffer.width = this.canvas.width;
    framebuffer.height = this.canvas.height;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      framebuffer.width,
      framebuffer.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
  }

  clearCanvas() {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  createTextureAndFramebuffer() {
    const gl = this.gl;

    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();

    return { framebuffer, texture };
  }

  fillLineDrawBufferFromScene(buffer) {
    let bufferPos = 0;
    let vertexCount = 0;
    let visible,
      shape,
      position,
      scale,
      rotation,
      color,
      lineIdx,
      shapesIdx,
      shapes;

    const objects = Object.values(this.scene);

    this.spriteCount = objects.length;
    const bufferSize = objects.reduce(
      (acc, item) =>
        acc +
        item.shapes.reduce(
          (acc, shape) => acc + (shape.length - 0.5) * this.vertexSize * 4,
          0
        ),
      0
    );

    // Re-allocate larger buffer if current is too small for the scene.
    /*
    this.actualBufferSize = buffer.length;
    this.calculatedBufferSize = bufferSize;
    if (bufferSize > buffer.length) {
      buffer = new Float32Array(Math.max(bufferSize * 1.5, buffer.length * 2));
    }
    */

    const bufferVertex = (shapeIdx, lineIdx) => {
      vertexCount++;
      buffer[bufferPos++] = lineIdx;
      buffer[bufferPos++] = shape[shapeIdx - 1][0];
      buffer[bufferPos++] = shape[shapeIdx - 1][1];
      buffer[bufferPos++] = shape[shapeIdx][0];
      buffer[bufferPos++] = shape[shapeIdx][1];
      buffer[bufferPos++] = position[0];
      buffer[bufferPos++] = position[1];
      buffer[bufferPos++] = scale;
      buffer[bufferPos++] = rotation;
      buffer[bufferPos++] = color[0];
      buffer[bufferPos++] = color[1];
      buffer[bufferPos++] = color[2];
      buffer[bufferPos++] = color[3];
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
}

init()
  .then()
  .catch((err) => console.error(err));
