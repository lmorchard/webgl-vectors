export async function createGLProgram(options, extra = {}) {
  const program = new GLProgram(options);
  Object.assign(program, extra);
  return program.initialize();
}

export default class GLProgram {
  TYPE_SIZES = {
    0x1406: 1, // FLOAT
    0x8b50: 2, // FLOAT_VEC2
    0x8b51: 3, // FLOAT_VEC3
    0x8b52: 4, // FLOAT_VEC4
  };

  defaultOptions() {
    return {
      initialBufferSize: 200000,
    };
  }

  constructor(optionsIn = {}) {
    this.options = { ...this.defaultOptions(), ...optionsIn };
    this.gl = this.options.gl;
    this.debug = this.options.debug || false;
    this.buffer = this.options.buffer || new Float32Array(this.options.initialBufferSize);
    this.bufferPos = 0;
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
        location: gl.getUniformLocation(program, info.name),
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
        index: i,
      };
    }

    Object.assign(this, { program, uniforms, attribs, vertexSize });
    return this;
  }

  resetBuffer() {
    this.bufferPos = 0;
  }

  pushBuffer(...items) {
    for (const item of items) {
      this.buffer[this.bufferPos++] = item;
    }
  }

  useProgram() {
    const gl = this.gl;

    gl.useProgram(this.program);

    // Set up attribute pointers into the buffer
    const numAttribs = gl.getProgramParameter(
      this.program,
      gl.ACTIVE_ATTRIBUTES
    );
    let pos = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(this.program, i);
      const size = this.TYPE_SIZES[info.type];
      gl.vertexAttribPointer(
        i,
        size,
        gl.FLOAT,
        false,
        this.vertexSize * 4,
        pos * 4
      );
      gl.enableVertexAttribArray(i);
      pos += size;
    }
  }

  setUniforms(data) {
    Object.keys(data).forEach((key) => {
      //console.log("FOFOFOF", key);
      this.gl[`uniform${data[key].length}f`].call(
        this.gl,
        this.uniforms[key].location,
        ...data[key]
      )
    });
  }

  async fetchShader(name) {
    const resp = await fetch(`shaders/${name}.glsl`);
    return resp.text();
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n\n" + info;
    }
    return shader;
  }

  createProgram(vertexShader, fragmentShader) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var info = gl.getProgramInfoLog(program);
      throw "Could not compile WebGL program. \n\n" + info;
    }
    return program;
  }
}
