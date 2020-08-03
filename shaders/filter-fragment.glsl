precision mediump float;

uniform sampler2D texture;
uniform vec2 uViewportSize;

vec4 blackAndWhite(vec4 color) {
  return vec4(vec3(1.0, 1.0, 1.0) * (color.r + color.g + color.b) / 3.0,
              color.a);
}

void main() {
  gl_FragColor = texture2D(texture, gl_FragCoord.xy / uViewportSize);
  //gl_FragColor =
  //    blackAndWhite(texture2D(texture, gl_FragCoord.xy / uViewportSize));
}
