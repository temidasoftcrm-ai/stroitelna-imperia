// storm.js — ⚡ storm-bolts (f6): истински мълнии при буря. Процедурна назъбена мълния (средни точки с отместване + 2–4 тънки разклонения)
// от основата на облаците (300–600 м) до земята или до висока сграда наблизо; ход като истинската: стъпков лидер надолу (~60 ms, блед),
// ярък обратен удар, 1–3 повторни проблясъка до ~0,3 s, угасване до ~0,45 s; ~30 % — само в облака (проблясък без канал).
// Светлина: точкова при мълнията + проблясък на небето (hemi) + светещ облак отгоре; нощем — много по-силно. Гръмотевица — WebAudio (филтриран шум):
// пукот отблизо, дълго боботене отдалеч; закъснение = разстояние / 343 м/с, сила по разстоянието, през шината на звуците (Sound.master).
// Най-много 1 мълния наведнъж, буферите — заделени веднъж. „Много ниско“ — само проблясъкът; prefers-reduced-motion — по-меко, без повторните.
//   const st = createStorm({ scene, camera, target: () => Vector3, hemi, sun, Sound, night: () => 0..1, paused: () => bool, low: () => bool, targets: () => [[x, y, z], …], rainMat })
//   st.update(dt, active)  — всеки кадър след weather.update;  st.strike({ dist, cloud })  — веднага (Лабораторията)
import * as THREE from 'three';
import { canvasTex } from './texdata.js';

const MAXP = 72 + 4 * 20, MAXQ = MAXP;   // точки по канала (главен + разклонения); по един правоъгълник на отсечка
export function createStorm(d) {
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ширината: прозрачност по v (0 в краищата, 1 в средата) — една текстура за ядрото и ореола
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const c2 = cv.getContext('2d'), gr = c2.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 4, 64);
  const wtex = canvasTex(cv);
  const mk = (col, w, add = true) => { const pos = new Float32Array(MAXQ * 4 * 3), uv = new Float32Array(MAXQ * 4 * 2), idx = new Uint16Array(MAXQ * 6);
    for (let q = 0; q < MAXQ; q++) { uv.set([0, 0, 0, 1, 1, 0, 1, 1], q * 8); idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2], q * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshBasicMaterial({ color: col, map: wtex, transparent: true, opacity: 0, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.renderOrder = 5; me.visible = false; me.userData.w = w; d.scene.add(me); return me; };
  const core = mk(0xfbf8ff, 1, false), glow = mk(0x9a86ff, 1);   /* ядрото — непрозрачно бяло (денем адитивното не се вижда на светлото небе), ореолът — адитивен */
  // светещият облак над мълнията и точковата светлина (в сцената от началото — без нова компилация на шейдърите при първата мълния)
  const cc = document.createElement('canvas'); cc.width = cc.height = 64; const c3 = cc.getContext('2d'), g3 = c3.createRadialGradient(32, 32, 1, 32, 32, 31);
  g3.addColorStop(0, 'rgba(255,255,255,1)'); g3.addColorStop(0.45, 'rgba(200,190,255,.45)'); g3.addColorStop(1, 'rgba(160,150,255,0)'); c3.fillStyle = g3; c3.fillRect(0, 0, 64, 64);
  const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(cc), color: 0xd8d0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); cloud.visible = false; d.scene.add(cloud);
  // ⚠️ НЕ добавяйте PointLight/SpotLight в сцената: с точкова светлина фасадите на сградите по истинската карта (OSM, изгледът на плана v2) денем
  // стават черни (проверено в София, 28.10: с лампата — черни, без нея — наред; вероятно техният шейдър не понася NUM_POINT_LIGHTS > 0).
  // Затова проблясъкът е само през hemi + слънцето + светещия облак; `light` е само обект с данни (за отчета / Лабораторията).
  const light = { intensity: 0, position: new THREE.Vector3() };
  // канал: средни точки с отместване (в равнина + извън нея), после разклоненията
  const P = new Float32Array(MAXP * 3), seg = []; let np = 0, mainSeg = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3(), CAM = new THREE.Vector3();
  function path(ax, ay, az, bx, by, bz, iters, rough, out) {   // out: масив от точки [x,y,z,…] (временен, само при удар)
    let pts = [[ax, ay, az], [bx, by, bz]];
    for (let it = 0; it < iters; it++) { const nx = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * rough;
        nx.push([(a[0] + b[0]) / 2 + (Math.random() - 0.5) * L, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * L * 0.35, (a[2] + b[2]) / 2 + (Math.random() - 0.5) * L], b); } pts = nx; rough *= 0.92; }
    for (const p of pts) out.push(p); return pts.length; }
  function build(top, bot) {
    const tmp = [], segs = []; const n0 = path(top[0], top[1], top[2], bot[0], bot[1], bot[2], 6, 0.5, tmp);
    for (let i = 1; i < n0; i++) segs.push([i - 1, i, 1]);
    const nb = 2 + Math.floor(Math.random() * 3);
    for (let b = 0; b < nb; b++) { const i0 = 3 + Math.floor(Math.random() * (n0 * 0.6)), s = tmp[i0], L = Math.hypot(top[0] - bot[0], top[1] - bot[1], top[2] - bot[2]) * (0.15 + Math.random() * 0.22), a = Math.random() * Math.PI * 2;
      const e = [s[0] + Math.cos(a) * L * 0.6, s[1] - L * (0.5 + Math.random() * 0.4), s[2] + Math.sin(a) * L * 0.6]; if (e[1] < 4) e[1] = 4 + Math.random() * 20;
      const st = tmp.length; tmp.push(s); const bp = []; path(s[0], s[1], s[2], e[0], e[1], e[2], 4, 0.45, bp); for (let i = 1; i < bp.length; i++) tmp.push(bp[i]);
      if (tmp.length > MAXP) { tmp.length = st; break; } for (let i = st + 1; i < tmp.length; i++) segs.push([i - 1, i, 0.35 * (1 - (i - st) / (tmp.length - st)) + 0.12]); }
    np = Math.min(MAXP, tmp.length); for (let i = 0; i < np; i++) P.set(tmp[i], i * 3); seg.length = 0; for (const s of segs) if (s[0] < np && s[1] < np && seg.length < MAXQ) seg.push(s); mainSeg = n0 - 1;
  }
  function ribbon(me, width, upto) {   // правоъгълници към камерата (веднъж на кадър само докато мълнията е видима)
    const pos = me.geometry.attributes.position.array; d.camera.getWorldPosition(CAM); let q = 0;
    for (let s = 0; s < seg.length && s < upto; s++) { const [i, j, w] = seg[s]; A.fromArray(P, i * 3); B.fromArray(P, j * 3); V.subVectors(B, A); C.addVectors(A, B).multiplyScalar(0.5).sub(CAM); N.crossVectors(V, C).normalize().multiplyScalar(width * w);
      pos.set([A.x - N.x, A.y - N.y, A.z - N.z, A.x + N.x, A.y + N.y, A.z + N.z, B.x - N.x, B.y - N.y, B.z - N.z, B.x + N.x, B.y + N.y, B.z + N.z], q * 12); q++; }
    me.geometry.attributes.position.needsUpdate = true; me.geometry.setDrawRange(0, q * 6); }
  // гръмотевица
  function thunder(dist) {
    const S = d.Sound; if (!S || !S.ctx || !S.noise || !S.master) return; const ctx = S.ctx, t0 = ctx.currentTime + Math.min(9, dist / 343), v = 0.9 / (1 + dist / 700);
    const src = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = S.noise; s.loop = true; s.playbackRate.value = 0.6 + Math.random() * 0.5; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(S.master); return { s, g, fl }; };
    if (dist < 900) { const c = src('highpass', 1800, 0.7); c.g.gain.setValueAtTime(0.0001, t0); c.g.gain.exponentialRampToValueAtTime(v * 1.4, t0 + 0.008); c.g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22); c.s.start(t0); c.s.stop(t0 + 0.3); }   // пукотът отблизо
    const r = src('lowpass', dist < 900 ? 320 : 170, 0.9), dur = 2.5 + Math.min(3.5, dist / 900), att = dist < 900 ? 0.03 : 0.35;
    r.g.gain.setValueAtTime(0.0001, t0); r.g.gain.exponentialRampToValueAtTime(v, t0 + att);
    for (let k = 1; k <= 4; k++) { const tk = t0 + att + k * dur / 5; r.g.gain.exponentialRampToValueAtTime(v * (0.35 + Math.random() * 0.5) * (1 - k / 6), tk); }   // боботенето — на талази
    r.g.gain.exponentialRampToValueAtTime(0.0001, t0 + att + dur); r.fl.frequency.setValueAtTime(r.fl.frequency.value, t0); r.fl.frequency.exponentialRampToValueAtTime(90, t0 + att + dur);
    r.s.start(t0); r.s.stop(t0 + att + dur + 0.1); }
  // целта: висока сграда/кула на 150–2500 м от точката, която гледаме (по-високите — по-вероятно), иначе земя пред камерата
  function pick(dist) {
    const tg = d.target(), cand = (d.targets && d.targets()) || []; d.camera.getWorldPosition(CAM);
    if (dist == null) { const L = cand.filter(p => { const r = Math.hypot(p[0] - tg.x, p[2] - tg.z); return r > 150 && r < 2500; }); if (L.length && Math.random() < 0.7) { let tot = 0; for (const p of L) tot += p[1] * p[1]; let r = Math.random() * tot; for (const p of L) if ((r -= p[1] * p[1]) <= 0) return p; return L[0]; } }
    const fw = new THREE.Vector3(); d.camera.getWorldDirection(fw); fw.y = 0; fw.normalize(); const a = (Math.random() - 0.5) * (dist == null ? 1.6 : 0.7), r = dist ?? (500 + Math.random() * 1800), c = Math.cos(a), s = Math.sin(a);
    return [tg.x + (fw.x * c - fw.z * s) * r, 0, tg.z + (fw.x * s + fw.z * c) * r]; }
  // ход на един удар
  let st = null, next = 3 + Math.random() * 6;
  function strike(o = {}) {
    const low = d.low && d.low(), cloudOnly = o.cloud ?? (low || Math.random() < 0.3), g = pick(o.dist).slice();
    // ударът в земята — в рамките на нарисувания терен (зад далечната равнина земята не се вижда и мълнията би „висяла“ във въздуха)
    { d.camera.getWorldPosition(CAM); const gr = (d.camera.far || 900) * 0.8, hx = g[0] - CAM.x, hz = g[2] - CAM.z, hr = Math.hypot(hx, hz); if (hr > gr) { const f = gr / hr; g[0] = CAM.x + hx * f; g[2] = CAM.z + hz * f; if (g[1] > 0) g[1] = 0; } }
    const top = [g[0] + (Math.random() - 0.5) * 260, 300 + Math.random() * 300, g[2] + (Math.random() - 0.5) * 260];
    if (!cloudOnly) build(top, [g[0], g[1], g[2]]); else core.visible = glow.visible = false;
    const re = RM ? 0 : 1 + Math.floor(Math.random() * 3), at = []; for (let k = 0; k < re; k++) at.push(0.13 + k * (0.06 + Math.random() * 0.05));
    d.camera.getWorldPosition(CAM); const dist = Math.hypot(g[0] - CAM.x, g[2] - CAM.z);
    // далечната мълния: зад далечната равнина на камерата (900 м в обикновените градове) не се рисува → цялата се смалява към камерата
    // (на екрана изглежда същата: мащаб около камерата), а лентата се удебелява с разстоянието, за да не изчезне в пиксел
    const far = (d.camera.far || 900) * 0.85, cpos = [top[0], top[1] + 20, top[2]], far3 = Math.max(Math.hypot(top[0] - CAM.x, top[1] - CAM.y, top[2] - CAM.z), Math.hypot(g[0] - CAM.x, g[1] - CAM.y, g[2] - CAM.z)), sk = Math.min(1, far / Math.max(1, far3));
    if (sk < 1) { if (!cloudOnly) for (let i = 0; i < np; i++) { const o3 = i * 3; P[o3] = CAM.x + (P[o3] - CAM.x) * sk; P[o3 + 1] = CAM.y + (P[o3 + 1] - CAM.y) * sk; P[o3 + 2] = CAM.z + (P[o3 + 2] - CAM.z) * sk; }
      for (let k = 0; k < 3; k++) cpos[k] = [CAM.x, CAM.y, CAM.z][k] + (cpos[k] - [CAM.x, CAM.y, CAM.z][k]) * sk; }
    st = { t: o.hold ?? 0, hold: o.hold ?? null, cloudOnly, at, top, g, dist, wk: sk * Math.max(1, far3 / 800) };   /* hold — застинал момент (кадри в Лабораторията) */ cloud.position.set(cpos[0], cpos[1], cpos[2]); cloud.scale.setScalar((cloudOnly ? 700 : 520) * sk); cloud.visible = true;
    light.position.set(g[0], Math.max(40, (g[1] + top[1]) / 2), g[2]); thunder(dist); return { dist: Math.round(dist), cloudOnly, bolt: !cloudOnly }; }
  const curve = s => {   // яркостта 0…1 по времето от началото на удара
    const t = s.t; if (t < 0.065) return s.cloudOnly ? 0.25 : 0.18;   // стъпковият лидер — блед
    let f = Math.max(0, 1 - (t - 0.065) / 0.09); for (const a of s.at) if (t >= a && t < a + 0.035) f = Math.max(f, 0.75); if (t > 0.065 && f < 0.12 && t < 0.45) f = 0.12 * (1 - (t - 0.065) / 0.385);
    return f; };
  function update(dt, active) {
    const paused = (d.paused && d.paused()) || (typeof document !== 'undefined' && document.hidden);
    if (active && !paused && !st) { next -= dt; if (next <= 0) { strike(); next = 4 + Math.random() * 11; } }
    if (!st) return;
    if (st.hold == null) st.t += dt; const f = curve(st) * (RM ? 0.5 : 1), n = d.night ? d.night() : 0, k = (0.45 + 0.55 * n);
    if (st.t > 0.45) { core.visible = glow.visible = false; cloud.visible = false; light.intensity = 0; if (d.rainMat) d.rainMat.opacity = 0.55; st = null; return; }
    if (!st.cloudOnly) { const upto = st.t < 0.065 ? Math.max(1, Math.round(mainSeg * st.t / 0.065)) : seg.length;
      core.visible = glow.visible = true; ribbon(core, 1.6 * st.wk, upto); ribbon(glow, 9 * st.wk, upto); core.material.opacity = Math.min(1, 0.25 + f); glow.material.opacity = 0.55 * f; }
    cloud.material.opacity = (st.cloudOnly ? 0.9 : 0.6) * f * k; light.intensity = (st.cloudOnly ? 1.2 : 4.5) * f * (0.6 + 1.6 * n); if (d.sun) d.sun.intensity += (st.cloudOnly ? 0.4 : 1.2) * f * (0.4 + 1.2 * n);
    d.hemi.intensity += (st.cloudOnly ? 0.9 : 1.8) * f * (0.5 + 1.5 * n); if (d.rainMat) d.rainMat.opacity = 0.55 + 0.4 * f;   // мокрите струи проблясват
  }
  return { update, strike, light, get flash() { return st ? curve(st) * (RM ? 0.5 : 1) * (st.cloudOnly ? 0.7 : 1) : 0; }, get busy() { return !!st; } };
}
