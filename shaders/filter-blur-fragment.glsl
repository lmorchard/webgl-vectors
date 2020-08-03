precision highp float;
uniform sampler2D texture;
uniform vec2 uViewportSize;
varying vec2 blurTextureCoords[11];

void main() {
  vec2 uv = vec2(gl_FragCoord.xy / uViewportSize.xy);

  vec4 colour = vec4(0.0);
  colour += texture2D(texture, blurTextureCoords[0]) * 0.0093;
  colour += texture2D(texture, blurTextureCoords[1]) * 0.028002;
  colour += texture2D(texture, blurTextureCoords[2]) * 0.065984;
  colour += texture2D(texture, blurTextureCoords[3]) * 0.121703;
  colour += texture2D(texture, blurTextureCoords[4]) * 0.175713;
  colour += texture2D(texture, blurTextureCoords[5]) * 0.198596;
  colour += texture2D(texture, blurTextureCoords[6]) * 0.175713;
  colour += texture2D(texture, blurTextureCoords[7]) * 0.121703;
  colour += texture2D(texture, blurTextureCoords[8]) * 0.065984;
  colour += texture2D(texture, blurTextureCoords[9]) * 0.028002;
  colour += texture2D(texture, blurTextureCoords[10]) * 0.0093;
  gl_FragColor = colour;
}
