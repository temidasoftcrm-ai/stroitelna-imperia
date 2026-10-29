// fountainwater.js — ⛲ fountain-water: вода във фонтаните (потребителят: каменният фонтан на 3 нива пред гарата е „съвсем сух“).
// Водни повърхности в басейна и в чашите (полупрозрачно синьо-зелено, вълничките — нормалите на морето waternormals.jpg, които се въртят и плъзгат),
// струя отгоре, тънки „завеси“ от ръба на всяка чаша към долната, пръски в басейна и „корона“ от капки около струята.
// Нощем — меко сияние отдолу (само emissive, БЕЗ PointLight — светлините прекомпилират шейдърите). Над ~250 м струите и пръските изчезват (във вертекс шейдъра).
// Евтино: геометриите и материалите са общи за всички фонтани (2 draw call-а на фонтан), едно време (uT) за всички — fwTick() веднъж на кадър;
// при пауза или скрит раздел — стои.
//   fwPrepGLB(scene, key)  — водата се закача към прототипа на модела (A['pl-fountain'].scene) → всяко clone() я носи
//   fwFx(spec)             — водата за процедурните фонтани: { water: [[y, r]], jet: [y, h, rb, rt], curtains: [[r0, y0, r1, y1]], splash: [[y, r, n]], crown: [yT, yL, rL, n], u: мащаб на пръските (≈ ширината на басейна в единиците на спецификацията; 1 — нормализиран модел) }
//   fwWaterMat()           — общият материал на водната повърхност (за процедурните басейни)
//   fwTick(dt, night)      — веднъж на кадър (game.js)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// известните модели: профилът е измерен по върховете на GLB (в единиците на нормализирания модел — най-широката страна 1, основа 0)
// pl-fountain („Simple Fountain“, Seth7Santos): басейн с вътрешна стена r 0,36 (дъно 0,13 / ръб 0,255), чаши с ръб на 0,496 / 0,732 / 0,953, връхче 1,02
const KNOWN = {
  'pl-fountain': { water: [[0.233, 0.358], [0.486, 0.197], [0.724, 0.171], [0.947, 0.099]], jet: [1.0, 0.2, 0.011, 0.004],
    curtains: [[0.118, 0.953, 0.142, 0.726], [0.196, 0.732, 0.198, 0.488], [0.224, 0.496, 0.262, 0.235]],
    splash: [[0.235, 0.262, 26], [0.488, 0.19, 8], [0.726, 0.142, 6]], crown: [1.2, 0.949, 0.075, 12] },
};

// ---- общите материали (веднъж)
const U = { uT: { value: 0 }, uNight: { value: 0 }, uLod: { value: 250 } };
let WMAT = null, FXMAT = null, NTEX = null;
function glowTex() {   // сиянието отдолу: лампа в средата (под струята) и венец лампи по ръба
  const n = 64, d = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = (i + 0.5) / n * 2 - 1, y = (j + 0.5) / n * 2 - 1, r = Math.hypot(x, y), v = Math.min(1, 0.25 + 0.75 * Math.exp(-r * r * 5) + 0.55 * Math.exp(-(((r - 0.82) / 0.1) ** 2))), k = (j * n + i) * 4;
    d[k] = d[k + 1] = d[k + 2] = Math.round(v * 255); d[k + 3] = 255; }
  const t = new THREE.DataTexture(d, n, n); t.magFilter = t.minFilter = THREE.LinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
export function fwWaterMat() {
  if (WMAT) return WMAT;
  NTEX = new THREE.TextureLoader().load('assets/heavy/water/waternormals.jpg'); NTEX.wrapS = NTEX.wrapT = THREE.RepeatWrapping; NTEX.repeat.set(1.6, 1.6); NTEX.center.set(0.5, 0.5);   // същите нормали като морето (water.js)
  WMAT = new THREE.MeshStandardMaterial({ color: 0x3e9a9c, roughness: 0.07, metalness: 0.12, transparent: true, opacity: 0.82, depthWrite: false, normalMap: NTEX, normalScale: new THREE.Vector2(0.55, 0.55),
    emissive: 0x2cc6dc, emissiveMap: glowTex(), emissiveIntensity: 0.03 });
  WMAT.name = 'fw-water'; return WMAT;
}
function fxMat() {
  if (FXMAT) return FXMAT;
  FXMAT = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]), fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
attribute vec4 aFx; attribute vec4 aDir;
uniform float uT, uLod;
varying vec2 vUv; varying float vKind, vA, vSeed;
void main() {
  vKind = aFx.x; vSeed = aFx.y; vUv = uv; vA = 1.0;
  vec3 wo = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  if (distance(wo, cameraPosition) > uLod) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
  vec3 p = position; vec4 mvPosition;
  if (aFx.x < 0.5) mvPosition = modelViewMatrix * vec4(p, 1.0);
  else {
    float ph = fract(uT * (0.7 + 0.6 * aFx.y) + aFx.y * 7.31), sz;
    if (aFx.x < 1.5) { p.xz += aDir.xy * ph * aDir.z; p.y += 4.0 * ph * (1.0 - ph) * aDir.w; vA = 1.0 - ph * ph; sz = 1.0 - 0.4 * ph; }
    else { p.xz += aDir.xy * ph * aDir.z; p.y += 0.3 * aDir.w * ph - 1.3 * aDir.w * ph * ph; vA = 1.0 - 0.6 * ph; sz = 1.0; }
    mvPosition = modelViewMatrix * vec4(p, 1.0); mvPosition.xy += aFx.zw * sz * length(modelMatrix[0].xyz); vUv = sign(aFx.zw) * 0.5 + 0.5;
  }
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <fog_vertex>
}`,
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform float uT, uNight;
varying vec2 vUv; varying float vKind, vA, vSeed;
float hh(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  float a;
  if (vKind < 0.5) {
    float n = vUv.x * 56.0, ci = floor(n), fx = fract(n), sp = 0.7 + 0.8 * hh(ci + vSeed * 13.0);
    float ph = fract(vUv.y * (1.4 + hh(ci + 3.0)) - uT * sp * 1.5 + hh(ci + 7.0));
    float st = smoothstep(0.0, 0.4, fx) * smoothstep(1.0, 0.6, fx), dr = smoothstep(0.0, 0.3, ph) * smoothstep(0.85, 0.45, ph);
    a = (0.13 + 0.5 * st * (0.3 + 0.7 * dr)) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
  } else { vec2 c = vUv * 2.0 - 1.0; float r = dot(c, c); if (r > 1.0) discard; a = (1.0 - r) * vA * 0.8; }
  vec3 col = mix(vec3(0.9, 0.97, 1.0), vec3(0.42, 0.86, 1.0), uNight) * mix(1.0, 0.8, uNight);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}` });
  Object.assign(FXMAT.uniforms, U); FXMAT.name = 'fw-fx'; return FXMAT;
}

// мешовете на водата не хвърлят сянка (model() им вдига castShadow) — свойството е заковано на false в класа, clone() го пази
class FwMesh extends THREE.Mesh { get castShadow() { return false; } set castShadow(v) { } }

// ---- геометриите (по профил, общи)
const GEO = new Map();
function fxGeo(s) {
  const P = [], UV = [], FX = [], DR = [], I = [], u = s.u || 1; let seed = 0.13;
  const rnd = () => (seed = (seed * 9301 + 0.4927) % 1);
  const sheet = (r0, y0, r1, y1, curve, seg = 28, rows = 6) => { const b = P.length / 3, sd = rnd();
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) { const t = j / rows, a = i / seg * Math.PI * 2, r = r0 + (r1 - r0) * (curve ? Math.sqrt(t) : t);
      P.push(Math.cos(a) * r, y0 + (y1 - y0) * t, Math.sin(a) * r); UV.push(i / seg, t); FX.push(0, sd, 0, 0); DR.push(0, 0, 0, 0); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) { const q = b + j * (seg + 1) + i; I.push(q, q + seg + 1, q + 1, q + 1, q + seg + 1, q + seg + 2); } };
  const quad = (kind, x, y, z, dx, dz, dist, h, sz) => { const b = P.length / 3, sd = rnd();
    for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { P.push(x, y, z); UV.push(0, 0); FX.push(kind, sd, cx * sz, cy * sz); DR.push(dx, dz, dist, h); }
    I.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  if (s.jet) { const [y, h, rb, rt] = s.jet; sheet(rb, y, rt, y + h, false, 10, 4); }   // струята — нагоре (v расте нагоре → ивиците текат нагоре)
  for (const [r0, y0, r1, y1] of s.curtains || []) sheet(r0, y0, r1, y1, true);   // завесите — надолу, леко навън (парабола)
  for (const [y, r, n] of s.splash || []) for (let k = 0; k < n; k++) { const a = (k + rnd() * 0.6) / n * Math.PI * 2; quad(1, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), Math.sin(a), (0.03 + 0.03 * rnd()) * u, (0.025 + 0.035 * rnd()) * u, 0.009 * u); }
  if (s.crown) { const [yT, yL, rL, n] = s.crown; for (let k = 0; k < n; k++) { const a = (k + rnd() * 0.5) / n * Math.PI * 2; quad(2, 0, yT, 0, Math.cos(a), Math.sin(a), rL * (0.8 + 0.3 * rnd()), yT - yL, 0.006 * u); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('aFx', new THREE.Float32BufferAttribute(FX, 4)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(DR, 4)); g.setIndex(I);
  g.computeBoundingBox(); g.computeBoundingSphere(); g.boundingSphere.radius += 0.1 * u; g.boundingBox.expandByScalar(0.02 * u);   // пръските и капките се движат в шейдъра
  return g;
}
function geos(s) {
  const k = JSON.stringify(s); let v = GEO.get(k); if (v) return v;
  const w = (s.water || []).map(([y, r]) => new THREE.CircleGeometry(r, Math.max(20, Math.round(r * 120))).rotateX(-Math.PI / 2).translate(0, y, 0));
  v = { water: w.length ? (w.length > 1 ? mergeGeometries(w, false) : w[0]) : null, fx: s.jet || s.curtains || s.splash || s.crown ? fxGeo(s) : null }; GEO.set(k, v); return v;
}

export function fwFx(s) {
  const g = new THREE.Group(), G = geos(s); g.name = 'fw'; g.userData.keep = true; g.userData.fw = 1;   // keep — citycull не го слива
  if (G.water) { const m = new FwMesh(G.water, fwWaterMat()); m.receiveShadow = false; m.renderOrder = 1; g.add(m); }
  if (G.fx) { const m = new FwMesh(G.fx, fxMat()); m.receiveShadow = false; m.renderOrder = 2; g.add(m); }
  return g;
}

// непознат GLB: басейнът — по върховете (най-широката част в долните 45% от височината), водата малко под ръба; кратка струя от върха
function autoSpec(o) {
  o.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(o.matrixWorld).invert(), v = new THREE.Vector3(), V = [];
  o.traverse(m => { if (!m.isMesh || m.userData.fw) return; const p = m.geometry.attributes.position, M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), st = Math.max(1, Math.floor(p.count / 6000));
    for (let i = 0; i < p.count; i += st) { v.fromBufferAttribute(p, i).applyMatrix4(M); V.push(v.x, v.y, v.z); } });
  let y0 = Infinity, y1 = -Infinity, cx = 0, cz = 0; for (let i = 0; i < V.length; i += 3) { y0 = Math.min(y0, V[i + 1]); y1 = Math.max(y1, V[i + 1]); cx += V[i]; cz += V[i + 2]; }
  const n = V.length / 3, h = y1 - y0; if (!n || !(h > 0)) return null; cx /= n; cz /= n;
  let R = 0; for (let i = 0; i < V.length; i += 3) if (V[i + 1] < y0 + h * 0.45) R = Math.max(R, Math.hypot(V[i] - cx, V[i + 2] - cz));
  let yb = y0; for (let i = 0; i < V.length; i += 3) if (V[i + 1] < y0 + h * 0.45 && Math.hypot(V[i] - cx, V[i + 2] - cz) > R * 0.8) yb = Math.max(yb, V[i + 1]);
  const yw = yb - (yb - y0) * 0.08, rw = R * 0.85;
  return { water: [[yw, rw]], jet: [y1, h * 0.15, R * 0.012, R * 0.004], splash: [[yw, rw * 0.35, 18]], crown: [y1 + h * 0.15, yw, rw * 0.3, 10], u: R * 2, cx, cz };
}

// закача водата към прототипа на модела (веднъж); clone(true) я копира с общите геометрии и материали
export function fwPrepGLB(scene, key) {
  if (!scene || scene.userData.fwDone) return scene; scene.userData.fwDone = 1;
  const s = KNOWN[key] || autoSpec(scene); if (!s) return scene;
  const g = fwFx(s); if (s.cx != null) g.position.set(s.cx, 0, s.cz); scene.add(g); return scene;
}

// веднъж на кадър: времето (вълничките, струите, пръските) и нощта (сиянието)
export function fwTick(dt, night = 0) {
  if (!dt || (typeof document !== 'undefined' && document.hidden)) return;
  const t = (U.uT.value = (U.uT.value + dt) % 3600); U.uNight.value = night;
  if (WMAT) { NTEX.offset.set(t * 0.035, t * 0.022); NTEX.rotation = t * 0.06; WMAT.emissiveIntensity = 0.03 + 1.7 * night + 0.1 * night * Math.sin(t * 2.3); }
}
