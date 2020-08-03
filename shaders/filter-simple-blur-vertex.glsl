precision mediump float;

attribute vec2 position;

void main() {
  //gl_Position = vec4(position, 1, 1);
  //gl_Position = vec4(position, 0.0, 1.0);
  gl_Position = vec4(position.x, position.y, 0.0, 1.0);
}
