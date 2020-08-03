precision highp float;

varying vec2 texCoord;
uniform sampler2D srcData;
uniform sampler2D blurData;

void main() {
  vec4 srcColour = texture2D(srcData, texCoord);
  vec4 blurColour = texture2D(blurData, texCoord);
  gl_FragColor = srcColour + blurColour * 1.5;
  //gl_FragColor = blurColour * 2.0;
}
