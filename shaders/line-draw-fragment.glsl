precision mediump float;
varying vec4 uvl;
varying vec4 vColor;
varying float vLen;

void main(void) {
  gl_FragColor = vColor;
  //gl_FragColor.xyz = vColor.xyz;
  //gl_FragColor.w = 1.0;
}
