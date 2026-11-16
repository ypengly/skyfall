import * as THREE from 'three';

/** Uniform objects shared by every custom shader (water, waterfalls, birds, sky). */
export const shared = {
  uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(0.6, 0.78, 0.96) },
  uFogDensity: { value: 0.0002 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uTop: { value: new THREE.Color(0.1, 0.36, 0.86) },
  uHorizon: { value: new THREE.Color(0.6, 0.78, 0.96) },
  uLight: { value: 1 },
};

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogDensity;
vec3 applyFog(vec3 c, float dist){ float f = 1.0 - exp(-pow(uFogDensity * dist, 2.0)); return mix(c, uFogColor, clamp(f, 0.0, 1.0)); }
`;

export const NOISE_GLSL = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
`;
