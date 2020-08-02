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

  viewport.scene.play = {
    position: [0.0, 0.0],
    shapes: heroShapes,
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

    viewport.scene.play.rotation += 0.04;
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
      lineWidth: 4.0,
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

  update(timeDelta) {
    this.updateMetrics();
    this.setCursor(this.cursorRawX, this.cursorRawY);
    this.updateBackdrop(timeDelta);
  }

  draw() {
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.container.offsetHeight;

    // draw the lines
    {
      this.gl.useProgram(this.lineDrawProgram);
      this.setUniforms({
        uLineWidth: [0.001 * this.lineWidth],
        uCameraZoom: [this.zoom],
        uCameraOrigin: [this.cameraX, this.cameraY],
        uCameraRotation: [this.cameraRotation],
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
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.filterFramebuffer);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        this.buffer,
        this.gl.STATIC_DRAW
      );
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, vertexCount);
    }

    // --- filtering below ---
    {
      this.gl.useProgram(this.filterProgram);
      this.gl.uniform;
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.filterTexture);
      this.resetBuffer();
      this.pushBuffer(...this.createRect(-1, -1, 2, 2));
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        this.buffer,
        this.gl.STATIC_DRAW
      );
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
      /*
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      */
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  // https://github.com/lesnitsky/webgl-month/blob/dev/src/shape-helpers.js#L3
  createRect(top, left, width, height, angle = 0) {
    const centerX = width / 2;
    const centerY = height / 2;

    const diagonalLength = Math.sqrt(centerX ** 2 + centerY ** 2);

    const x1 = centerX + diagonalLength * Math.cos(angle + Pi_4);
    const y1 = centerY + diagonalLength * Math.sin(angle + Pi_4);

    const x2 = centerX + diagonalLength * Math.cos(angle + Pi_4 * 3);
    const y2 = centerY + diagonalLength * Math.sin(angle + Pi_4 * 3);

    const x3 = centerX + diagonalLength * Math.cos(angle - Pi_4);
    const y3 = centerY + diagonalLength * Math.sin(angle - Pi_4);

    const x4 = centerX + diagonalLength * Math.cos(angle - Pi_4 * 3);
    const y4 = centerY + diagonalLength * Math.sin(angle - Pi_4 * 3);

    return [
      x1 + left,
      y1 + top,
      x2 + left,
      y2 + top,
      x3 + left,
      y3 + top,
      x4 + left,
      y4 + top,
    ];
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

  async initWebGL(canvas) {
    const [
      lineDrawVertexShaderSrc,
      lineDrawFragmentShaderSrc,
      filterVertexShaderSrc,
      filterFragmentShaderSrc,
    ] = await Promise.all(
      [
        "line-draw-vertex",
        "line-draw-fragment",
        "filter-vertex",
        "filter-fragment",
      ].map((name) => this.fetchShader(name))
    );

    const gl = (this.gl = canvas.getContext("webgl", {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    }));

    gl.disable(gl.DEPTH_TEST);

    // Set up for data buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    const buffer = new Float32Array(200000);

    const programLineDraw = new GLProgram({
      gl,
      vertexShaderName: 'line-draw-vertex',
      fragmentShaderName: 'line-draw-fragment',
    });

    const programFilter = new GLProgram({
      gl,
      vertexShaderName: 'filter-vertex',
      fragmentShaderName: 'filter-fragment',
    });

    await programLineDraw.initialize();
    await programFilter.initialize();

    console.log("PROGRAM LINE DRAW", programLineDraw);
    console.log("PROGRAM FILTER", programFilter);

    const lineDrawProgram = (this.lineDrawProgram = this.createProgram(
      this.createShader(gl.VERTEX_SHADER, lineDrawVertexShaderSrc),
      this.createShader(gl.FRAGMENT_SHADER, lineDrawFragmentShaderSrc)
    ));

    // First pass through attributes to count total vertex size and index by name
    const numAttribs = gl.getProgramParameter(
      lineDrawProgram,
      gl.ACTIVE_ATTRIBUTES
    );
    const attribs = {};
    let vertexSize = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(lineDrawProgram, i);
      const size = TYPE_SIZES[info.type];
      vertexSize += size;
      attribs[info.name] = i;
    }

    // Second pass through attributes to set up attribute pointers into the buffer
    let pos = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(lineDrawProgram, i);
      const size = TYPE_SIZES[info.type];
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, vertexSize * 4, pos * 4);
      gl.enableVertexAttribArray(i);
      pos += size;
    }

    // Index uniform locations by name
    const uniforms = {};
    const numUniforms = gl.getProgramParameter(
      lineDrawProgram,
      gl.ACTIVE_UNIFORMS
    );
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(lineDrawProgram, i);
      uniforms[info.name] = gl.getUniformLocation(lineDrawProgram, info.name);
    }

    const filterProgram = (this.filterProgram = this.createProgram(
      this.createShader(gl.VERTEX_SHADER, filterVertexShaderSrc),
      this.createShader(gl.FRAGMENT_SHADER, filterFragmentShaderSrc)
    ));

    ({
      texture: this.filterTexture,
      framebuffer: this.filterFramebuffer,
    } = this.createCanvasTexture());

    Object.assign(this, { gl, uniforms, attribs, vertexSize, buffer });
  }

  async fetchShader(name) {
    const resp = await fetch(`shaders/${name}.glsl`);
    return resp.text();
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

  createCanvasTexture() {
    const gl = this.gl;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // define size and format of level 0
    const level = 0;
    const internalFormat = gl.RGBA;
    const border = 0;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      this.width,
      this.height,
      border,
      format,
      type,
      data
    );

    // set the filtering so we don't need mips
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create and bind the framebuffer
    const framebuffer = gl.createFramebuffer();

    // attach the texture as the first color attachment
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      attachmentPoint,
      gl.TEXTURE_2D,
      texture,
      level
    );

    return { framebuffer, texture };
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

  resetBuffer() {
    this.bufferPos = 0;
  }

  pushBuffer(...items) {
    for (const item of items) {
      this.buffer[this.bufferPos++] = item;
    }
  }

  fillBufferFromScene() {
    let vertexCount = 0;
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

    this.resetBuffer();

    const bufferVertex = (shapeIdx, lineIdx) => {
      vertexCount++;
      this.pushBuffer(
        lineIdx,
        shape[shapeIdx - 1][0],
        shape[shapeIdx - 1][1],
        shape[shapeIdx][0],
        shape[shapeIdx][1],
        position[0],
        position[1],
        scale,
        rotation,
        deltaPosition[0],
        deltaPosition[1],
        deltaScale,
        deltaRotation,
        color[0],
        color[1],
        color[2],
        color[3]
      );
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

class GLProgram {
  TYPE_SIZES = {
    0x1406: 1, // FLOAT
    0x8b50: 2, // FLOAT_VEC2
    0x8b51: 3, // FLOAT_VEC3
    0x8b52: 4, // FLOAT_VEC4
  }

  constructor(optionsIn = {}) {
    this.options = { ...this.defaultOptions(), ...optionsIn };
    this.gl = this.options.gl;
    this.debug = this.options.debug || false;
  }

  defaultOptions() {
    return {};
  }

  async initialize() {
    const gl = this.gl;

    const [vertexShaderSrc, fragmentShaderSrc] = await Promise.all(
      [
        this.options.vertexShaderName,
        this.options.fragmentShaderName,
      ].map((name) => this.fetchShader(name))
    );

    const program = this.createProgram(
      this.createShader(gl.VERTEX_SHADER, vertexShaderSrc),
      this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSrc)
    );

    // Index uniform locations by name
    const uniforms = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = {
        info,
        location: gl.getUniformLocation(program, info.name)
      };
    }

    // Count total vertex size and index by name
    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const attribs = {};
    let vertexSize = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(program, i);
      const size = this.TYPE_SIZES[info.type];
      vertexSize += size;
      attribs[info.name] = {
        info,
        size,
        index: i
      };
    }

    Object.assign(this, { program, uniforms, attribs, vertexSize });
  }

  useProgram() {
    this.gl.useProgram(this.program);

    // Set up attribute pointers into the buffer
    const numAttribs = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    let pos = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(program, i);
      const size = this.TYPE_SIZES[info.type];
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, this.vertexSize * 4, pos * 4);
      gl.enableVertexAttribArray(i);
      pos += size;
    }
  }

  async fetchShader(name) {
    const resp = await fetch(`shaders/${name}.glsl`);
    return resp.text();
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (!success) {
      throw new Error(`Failed to create shader ${success}`);
    }
    return shader;
  }

  createProgram(vertexShader, fragmentShader) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (!success) {
      throw new Error(`Failed to create program ${success}`);
    }
    return program;
  }
}

init()
  .then()
  .catch((err) => console.error(err));
