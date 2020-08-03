precision highp float;

uniform float uDirection;
uniform vec2 uViewportSize;
attribute vec2 position;
varying vec2 blurTextureCoords[11];

void main() {
  gl_Position = vec4(position.xy, 0, 1.0);
  
  vec2 centreTexCoords = position * 0.5 + 0.5;
  float pixelSize;
  
  if (uDirection > 0.0) {
    pixelSize = 1.0 / uViewportSize.x;
  } else {
    pixelSize = 1.0 / uViewportSize.y;
  }

  for (int i = -5; i <= 5; i++) {
    if (uDirection > 0.0) {
      blurTextureCoords[i + 5] =
          centreTexCoords + vec2(pixelSize * float(i), 0.0);
    } else {
      blurTextureCoords[i + 5] =
          centreTexCoords + vec2(0.0, pixelSize * float(i));
    }
  }
}