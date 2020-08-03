attribute vec2 position;
varying vec2 texCoord;

void main() {
  texCoord = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
