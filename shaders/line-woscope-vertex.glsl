// see also: http://m1el.github.io/woscope-how/
precision highp float;
#define EPS 1E-6
#define PI 3.141592653589793
#define PI_2 6.283185307179586
#define PI_H 1.5707963267948966
#define PI_Q 0.7853981633974483

uniform float uSize;
uniform float uCameraZoom;
uniform float uCameraRotation;
uniform vec2 uCameraOrigin;
uniform vec2 uViewportSize;

attribute float aIdx;
attribute vec4 aLine;
attribute vec4 aTransform;
attribute vec4 aColor;

varying vec4 uvl;
varying vec4 vColor;
varying float vLen;

void main() {
  vec2 viewportRatio;
  if (uViewportSize.x > uViewportSize.y) {
    viewportRatio.x = uViewportSize.y / uViewportSize.x;
    viewportRatio.y = 1.0;
  } else {
    viewportRatio.x = 1.0;
    viewportRatio.y = uViewportSize.x / uViewportSize.y;
  }

  //vec2 viewportLineWidth = uLineWidth * viewportRatio;

  mat3 mViewportToClipSpace =
      mat3(2.0 / uViewportSize.x, 0, 0, 0, -2.0 / uViewportSize.y, 0, 0, 0, 0);

  float cameraCos = cos(uCameraRotation);
  float cameraSin = sin(uCameraRotation);

  mat3 mCameraRotation = mat3(cameraCos, -cameraSin, 0.0, cameraSin, cameraCos,
                              0.0, 0.0, 0.0, 1.0);

  mat3 mCameraOrigin = mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, -uCameraOrigin.x,
                            -uCameraOrigin.y, 1.0);

  mat3 mCameraZoom =
      mat3(uCameraZoom, 0.0, 0.0, 0.0, uCameraZoom, 0.0, 0.0, 0.0, 1.0);

  float rotationCos = cos(-aTransform.w + PI_H);
  float rotationSin = sin(-aTransform.w + PI_H);

  mat3 mRotation = mat3(rotationCos, -rotationSin, 0.0, rotationSin,
                        rotationCos, 0.0, 0.0, 0.0, 1.0);

  mat3 mPosition =
      mat3(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, aTransform.x, aTransform.y, 1.0);

  mat3 mScale =
      mat3(aTransform.z, 0.0, 0.0, 0.0, aTransform.z, 0.0, 0.0, 0.0, 1.0);

  // TODO: Move some of these matrices into JS?
  mat3 mAll = mViewportToClipSpace * mCameraRotation * mCameraZoom *
              mCameraOrigin * mPosition * mScale * mRotation;

  vec2 tStart = (mAll * vec3(aLine.xy, 1)).xy;
  vec2 tEnd = (mAll * vec3(aLine.zw, 1)).xy;

  float tang;
  vec2 current;

  float idx = mod(aIdx, 4.0);

  vec2 dir = tEnd - tStart;
  uvl.z = length(dir);

  if (uvl.z > EPS) {
    dir = dir / uvl.z;
  } else {
    // If the segment is too short, just draw a square
    dir = vec2(1.0, 0.0);
  }

  // norm stores direction normal to the segment difference
  vec2 norm = vec2(-dir.y, dir.x);

  // `tang` corresponds to shift "forward" or "backward"
  if (idx >= 2.0) {
    current = tEnd;
    tang = 1.0;
    uvl.x = -uSize;
  } else {
    current = tStart;
    tang = -1.0;
    uvl.x = uvl.z + uSize;
  }

  // `side` corresponds to shift to the "right" or "left"
  float side = (mod(idx, 2.0) - 0.5) * 2.0;
  uvl.y = side * uSize;
  uvl.w = floor(aIdx / 4.0 + 0.5);

  vColor = aColor;

  gl_Position =
      vec4((current + (tang * dir + norm * side) * uSize), 0.0, 1.0);
}
