// roadlook.js — по-реалистични улици без да се сменят плочките на Kenney:
//   • шейдър върху материала на пътните плочки: асфалтът (тъмните пиксели) получава зърно и по-тъмни/светли петна,
//     тротоарите (светлосивите) — фуги на плочки с леко различни нюанси; маркировката (бялото) не се пипа;
//   • пешеходни пътеки („зебра“) на изходите на кръстовищата — един InstancedMesh за целия град.
// Шарките са в световни координати, затова не се повтарят плочка по плочка.
import * as THREE from 'three';

const cache = new Map();
export function roadMaterial(src) {
  if (cache.has(src.uuid)) return cache.get(src.uuid);
  const m = src.clone();
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadW;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  { vec4 rw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    rw = instanceMatrix * rw;
  #endif
    vRoadW = (modelMatrix * rw).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRoadW;
float rh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(rh(i), rh(i + vec2(1, 0)), f.x), mix(rh(i + vec2(0, 1)), rh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec3 c = diffuseColor.rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)), sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    vec2 w = vRoadW.xz;
    if (sat < 0.08 && l < 0.3) {
      float grain = rh(floor(w * 9.0)) * 0.5 + rn(w * 3.0) * 0.5;
      float pch = smoothstep(0.55, 0.75, rn(w * 0.09 + 7.0));
      diffuseColor.rgb = c * (0.82 + 0.32 * grain) * (1.0 - 0.18 * pch) + vec3(0.0, 0.004, 0.012);
    } else if (sat < 0.08 && l > 0.35 && l < 0.85) {
      vec2 q = w / 0.9, f = fract(q);
      float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float shade = 0.92 + 0.12 * rh(floor(q));
      diffuseColor.rgb = c * shade * mix(0.78, 1.0, smoothstep(0.02, 0.06, edge));
    }
  }`);
  };
  m.customProgramCacheKey = () => 'roadlook1';
  cache.set(src.uuid, m);
  return m;
}
// подменя материалите на пътна група (от instanced()) с подобрените
export function applyRoadLook(group) {
  group.traverse(o => { if (o.isMesh && o.material) o.material = Array.isArray(o.material) ? o.material.map(roadMaterial) : roadMaterial(o.material); });
  return group;
}
// зебри: arms — [x, z, посока ('x' или 'z')] — центърът на пресичането (на ръба на кръстовището) и посоката на улицата
export function makeCrosswalks(arms, roadW = 5.2) {
  const n = 8, bar = roadW / (n * 2 - 1);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, arms.length * n));
  const M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let k = 0;
  for (const [x, z, dir] of arms) for (let i = 0; i < n; i++) {
    const off = -roadW / 2 + bar / 2 + i * bar * 2;
    if (dir === 'x') { p.set(x, 0.035, z + off); s.set(1.7, 1, bar); } else { p.set(x + off, 0.035, z); s.set(bar, 1, 1.7); }
    im.setMatrixAt(k++, M.compose(p, q, s));
  }
  im.count = k; im.receiveShadow = true;
  return im;
}
