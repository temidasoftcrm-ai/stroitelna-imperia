// postfx.js — 🎨 post-fx (собственикът, 09.11: „заради по-добрата визия“ → „да направи пробата в Пловдив“): следобработка на картината.
// Сцената се рисува точно както на екрана (тон и sRGB — isXRRenderTarget), значи без ефектите картината е същата. Върху нея:
// контактни сенки (AO само от дълбочината — без второ рисуване на сцената), сияние на светлините (нощем) и цветова обработка.
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const ZF = `uniform sampler2D tD; uniform float uN, uF; float vz(vec2 u) { float d = texture2D(tD, u).x; return uN * uF / ((uF - uN) * d - uF); }`;   // view z (< 0)
const AO_FS = `varying vec2 vUv; ${ZF} uniform vec2 uP, uTx; uniform float uI;
vec3 vp(vec2 u) { float z = vz(u); return vec3((u * 2.0 - 1.0) * -z / uP, z); }
void main() {
  float d = texture2D(tD, vUv).x; if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  vec3 p = vp(vUv); vec3 l = vp(vUv - vec2(uTx.x, 0.0)) - p, r = vp(vUv + vec2(uTx.x, 0.0)) - p, b = vp(vUv - vec2(0.0, uTx.y)) - p, t = vp(vUv + vec2(0.0, uTx.y)) - p;
  vec3 dx = abs(l.z) < abs(r.z) ? -l : r, dy = abs(b.z) < abs(t.z) ? -b : t, n = normalize(cross(dx, dy));
  float R = clamp(-p.z * 0.035, 2.5, 16.0), R2 = R * R, sr = min(R * uP.y * 0.5 / -p.z, 0.11);
  float a0 = 6.2832 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))), s = 0.0;
  for (int i = 0; i < 12; i++) { float f = (float(i) + 0.5) / 12.0, a = a0 + f * 37.7; vec2 q = vUv + vec2(cos(a) * uP.x / uP.y, sin(a)) * sr * f;
    vec3 v = vp(q) - p; float vv = dot(v, v), k = max(R2 - vv, 0.0); s += k * k * k * max((dot(v, n) + p.z * 0.002) / (vv + 0.02 * R2), 0.0); }
  float ao = 1.0 - uI * s * 2.2 * R / (R2 * R2 * R2 * 12.0);
  float fade = 1.0 - smoothstep(0.55 * uF, 0.92 * uF, -p.z);
  gl_FragColor = vec4(vec3(mix(1.0, clamp(ao, 0.0, 1.0), fade)), 1.0);
}`;
const BRIGHT_FS = `varying vec2 vUv; uniform sampler2D tC; uniform float uTh; void main() { vec3 c = texture2D(tC, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uTh, uTh + 0.22, l), 1.0); }`;
const DOWN_FS = `varying vec2 vUv; uniform sampler2D tC; uniform vec2 uTx; void main() { vec3 s = texture2D(tC, vUv).rgb * 4.0; s += texture2D(tC, vUv - uTx).rgb; s += texture2D(tC, vUv + uTx).rgb; s += texture2D(tC, vUv + vec2(uTx.x, -uTx.y)).rgb; s += texture2D(tC, vUv - vec2(uTx.x, -uTx.y)).rgb; gl_FragColor = vec4(s / 8.0, 1.0); }`;
const UP_FS = `varying vec2 vUv; uniform sampler2D tC; uniform vec2 uTx; void main() { vec2 h = uTx; vec3 s = texture2D(tC, vUv + vec2(-h.x * 2.0, 0.0)).rgb; s += texture2D(tC, vUv + vec2(-h.x, h.y)).rgb * 2.0; s += texture2D(tC, vUv + vec2(0.0, h.y * 2.0)).rgb; s += texture2D(tC, vUv + vec2(h.x, h.y)).rgb * 2.0; s += texture2D(tC, vUv + vec2(h.x * 2.0, 0.0)).rgb; s += texture2D(tC, vUv + vec2(h.x, -h.y)).rgb * 2.0; s += texture2D(tC, vUv + vec2(0.0, -h.y * 2.0)).rgb; s += texture2D(tC, vUv + vec2(-h.x, -h.y)).rgb * 2.0; gl_FragColor = vec4(s / 12.0, 1.0); }`;
const COMP_FS = `varying vec2 vUv; ${ZF} uniform sampler2D tC, tA, tB; uniform vec2 uTx; uniform float uAo, uBl, uSat, uCon, uLift; uniform vec3 uTint;
void main() {
  vec3 c = texture2D(tC, vUv).rgb; float z = vz(vUv), s = 0.0, w = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 u = vUv + vec2(float(x), float(y)) * uTx * 2.0; float k = exp(-abs(vz(u) - z) * 6.0 / max(-z * 0.04, 0.2)) + 0.001; s += texture2D(tA, u).r * k; w += k; }
  float ao = s / w, l0 = max(c.r, max(c.g, c.b));
  c *= mix(mix(1.0, ao, uAo), 1.0, smoothstep(0.72, 0.98, l0));   // светлините не се затъмняват
  vec3 b = texture2D(tB, vUv).rgb * uBl; c = 1.0 - (1.0 - c) * (1.0 - min(b, vec3(0.98)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uSat); c = (c - 0.32) * uCon + 0.32 + uLift * (1.0 - c); c *= uTint;
  vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 0.22;
  c += (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPostFx({ renderer, scene, camera, night }) {
  const fsS = new THREE.Scene(), fsC = new THREE.Camera(), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geo); quad.frustumCulled = false; fsS.add(quad);
  const mk = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
  const rtOpt = { depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const dt = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType); dt.format = THREE.DepthFormat; dt.minFilter = dt.magFilter = THREE.NearestFilter;
  const main = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthBuffer: true, stencilBuffer: false, depthTexture: dt, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  main.texture.colorSpace = THREE.SRGBColorSpace; main.texture.internalFormat = 'RGBA8'; main.isXRRenderTarget = true;   // материалите — с тона и sRGB, точно като на екрана
  const aoRT = new THREE.WebGLRenderTarget(4, 4, rtOpt), BL = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(4, 4, rtOpt));
  const dep = () => ({ tD: { value: dt }, uN: { value: 1 }, uF: { value: 900 } });
  const aoM = mk(AO_FS, { ...dep(), uP: { value: new THREE.Vector2() }, uTx: { value: new THREE.Vector2() }, uI: { value: 1.0 } });
  const brM = mk(BRIGHT_FS, { tC: { value: main.texture }, uTh: { value: 0.6 } });
  const dnM = mk(DOWN_FS, { tC: { value: null }, uTx: { value: new THREE.Vector2() } }), upM = mk(UP_FS, { tC: { value: null }, uTx: { value: new THREE.Vector2() } }); upM.transparent = true; upM.blending = THREE.CustomBlending; upM.blendSrc = THREE.OneFactor; upM.blendDst = THREE.OneFactor;
  const coM = mk(COMP_FS, { ...dep(), tC: { value: main.texture }, tA: { value: aoRT.texture }, tB: { value: BL[0].texture }, uTx: { value: new THREE.Vector2() }, uAo: { value: 0.85 }, uBl: { value: 0 }, uSat: { value: 1.1 }, uCon: { value: 1.06 }, uLift: { value: 0 }, uTint: { value: new THREE.Color() } });
  const size = new THREE.Vector2(), fogC = new THREE.Color(), bgC = new THREE.Color(); let w = 0, h = 0;
  function fit() { renderer.getDrawingBufferSize(size); if (size.x === w && size.y === h) return; w = size.x; h = size.y; main.setSize(w, h); aoRT.setSize(w >> 1, h >> 1); BL.forEach((r, i) => r.setSize(Math.max(2, w >> (i + 1)), Math.max(2, h >> (i + 1)))); }
  const pass = (m, rt) => { quad.material = m; renderer.setRenderTarget(rt); renderer.render(fsS, fsC); };
  const mix = (a, b, k) => a + (b - a) * k;
  function render() {
    fit(); const fog = scene.fog, bg = scene.background && scene.background.isColor ? scene.background : null;   // мъглата и фонът: three.js ги дава линейни извън екрана — тук трябват като на екрана
    if (fog) { fogC.copy(fog.color); fog.color.convertLinearToSRGB(); } if (bg) { bgC.copy(bg); bg.convertLinearToSRGB(); }
    renderer.setRenderTarget(main); renderer.render(scene, camera);
    if (fog) fog.color.copy(fogC); if (bg) bg.copy(bgC);
    const info = renderer.info, ar = info.autoReset; info.autoReset = false;   // броячите на кадъра (perf) — само сцената
    const n = Math.max(0, Math.min(1, night()));
    for (const m of [aoM, coM]) { m.uniforms.uN.value = camera.near; m.uniforms.uF.value = camera.far; }
    aoM.uniforms.uP.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]); aoM.uniforms.uTx.value.set(2 / w, 2 / h); pass(aoM, aoRT);
    brM.uniforms.uTh.value = mix(0.93, 0.55, n); pass(brM, BL[0]);
    for (let i = 1; i < BL.length; i++) { dnM.uniforms.tC.value = BL[i - 1].texture; dnM.uniforms.uTx.value.set(1 / BL[i - 1].width, 1 / BL[i - 1].height); pass(dnM, BL[i]); }
    const ac = renderer.autoClear; renderer.autoClear = false; for (let i = BL.length - 1; i > 0; i--) { upM.uniforms.tC.value = BL[i].texture; upM.uniforms.uTx.value.set(0.5 / BL[i].width, 0.5 / BL[i].height); pass(upM, BL[i - 1]); } renderer.autoClear = ac;
    const u = coM.uniforms; u.uTx.value.set(1 / w, 1 / h); u.uAo.value = mix(0.9, 0.5, n); u.uBl.value = mix(0.08, 0.55, n); u.uSat.value = mix(1.1, 1.12, n); u.uCon.value = mix(1.06, 1.08, n); u.uLift.value = mix(0, 0.035, n); u.uTint.value.setRGB(mix(1.015, 1.0, n), 1, mix(0.98, 1.05, n));
    pass(coM, null); info.autoReset = ar;
  }
  return { render };
}
