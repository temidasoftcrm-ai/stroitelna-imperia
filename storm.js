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
import { feature } from './lab/feature.js';
// 🌦️ weather3: мълниите се виждат — удрят далеч на фона (през горната част на екрана, 500–3000 м; зад далечната равнина — смалени към камерата),
// по-високи (от ~1,1–1,6 км), по-дебели и по-ярки, облачната основа светва; ~1 от 6 удря връх на небостъргач ≥ 60 м в кадъра (искра на върха).
// update(dt, 2) — буря: на 3–8 s; update(dt, 1) — силен дъжд с далечни гръмотевични клетки: на 15–40 s; камерата съвсем ниско — по-рядко.
const W3 = feature('weather3');

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
  // Без PointLight: проблясъкът е през hemi + слънцето + светещия облак (по-евтино; точкова светлина прекомпилира всички шейдъри).
  // (Черните фасади денем, които първо приписахме на лампата, бяха застинала карта на сенките отвисоко — game.js perfTune, shadow-fix.)
  const light = { intensity: 0, position: new THREE.Vector3() };
  // weather3: искрата при удар в небостъргач (една, заделена веднъж) и помощните вектори за избора на мястото
  const spark = W3 ? new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud.material.map, color: 0xfff4e0, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false })) : null;
  if (spark) { spark.visible = false; spark.renderOrder = 6; d.scene.add(spark); } let sparkT = 0, sparkS = 1;
  const RAY = new THREE.Vector3(), NDC = new THREE.Vector3();
  // канал: средни точки с отместване (в равнина + извън нея), после разклоненията
  const P = new Float32Array(MAXP * 3), seg = []; let np = 0, mainSeg = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3(), CAM = new THREE.Vector3();
  function path(ax, ay, az, bx, by, bz, iters, rough, out, dec = 0.92, vy = 0.35) {   // out: масив от точки [x,y,z,…] (временен, само при удар)
    let pts = [[ax, ay, az], [bx, by, bz]];
    for (let it = 0; it < iters; it++) { const nx = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * rough;
        nx.push([(a[0] + b[0]) / 2 + (Math.random() - 0.5) * L, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * L * vy, (a[2] + b[2]) / 2 + (Math.random() - 0.5) * L], b); } pts = nx; rough *= dec; }
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
      const o = q * 12; pos[o] = A.x - N.x; pos[o + 1] = A.y - N.y; pos[o + 2] = A.z - N.z; pos[o + 3] = A.x + N.x; pos[o + 4] = A.y + N.y; pos[o + 5] = A.z + N.z; pos[o + 6] = B.x - N.x; pos[o + 7] = B.y - N.y; pos[o + 8] = B.z - N.z; pos[o + 9] = B.x + N.x; pos[o + 10] = B.y + N.y; pos[o + 11] = B.z + N.z; q++; }   /* без нов масив на кадър */
    me.geometry.attributes.position.needsUpdate = true; me.geometry.setDrawRange(0, q * 6); }
  // гръмотевица
  function thunder(dist) {
    if (feature('city-snd3') && d.Sound && d.Sound.thunder3 && d.Sound.thunder3(dist)) return;   // 🔊 city-snd3: записаните гръмотевици; докато не са заредени — процедурните
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
  // weather3: къде — ~1 от 6 (o.hit — винаги) в небостъргач ≥ 60 м, който е в кадъра на 150–3000 м; иначе на фона: лъч през случайна точка
  // от горната половина на екрана (без дясната колона) до земята (350–3000 м; гледаш над хоризонта — 800–3000 м)
  function pick3(o) {
    d.camera.getWorldPosition(CAM);
    const pn = typeof document !== 'undefined' && document.getElementById('panel'), pr = pn && !pn.classList.contains('hidden') && pn.offsetWidth ? pn.getBoundingClientRect().left / innerWidth * 2 - 1.12 : 0.8;   // дясната колона закрива края на екрана
    const x1 = Math.max(-0.4, Math.min(0.8, pr));
    if (o.hit !== false && (o.hit || (o.dist == null && Math.random() < 1 / 6))) { let best = null, bw = 0;
      for (const p of (d.targets && d.targets()) || []) { if (p[1] < (o.hit === true ? 35 : 60)) continue;   /* o.hit — Лабораторията: и по-ниска кула (≥ 35 м) */ const r = Math.hypot(p[0] - CAM.x, p[2] - CAM.z); if (r < 150 || r > 3000) continue;
        NDC.set(p[0], p[1], p[2]).project(d.camera); if (NDC.z > 1 || NDC.x < -0.85 || NDC.x > x1 + 0.05 || NDC.y < -0.6 || NDC.y > 0.85) continue; const w = p[1] * p[1] * (0.3 + Math.random()); if (w > bw) { bw = w; best = p; } }
      if (best) return { g: [best[0], best[1], best[2]], hit: true }; }
    RAY.set(-0.8 + Math.random() * (x1 + 0.8), o.dist != null ? 0.3 : 0.1 + Math.random() * 0.45, 0.5).unproject(d.camera).sub(CAM).normalize(); const hd = Math.hypot(RAY.x, RAY.z) || 1;
    let r = o.dist; if (r == null) r = RAY.y < -0.02 ? CAM.y / -RAY.y * hd : 800 + Math.random() * 2200; const fg = d.scene.fog, fv = fg && fg.far ? fg.far * 0.85 : 3000; r = Math.max(o.dist != null ? 50 : 300, Math.min(3000, (d.camera.far || 900) * 0.95, Math.max(450, fv), r));   /* дъното — в мараня на хоризонта, не по-далеч от нарисуваната земя */   /* до нарисуваната земя — иначе низът „виси“ над празната ивица до хоризонта */
    return { g: [CAM.x + RAY.x / hd * r, 0, CAM.z + RAY.z / hd * r], hit: false }; }
  // ---- 🌦️ weather3: много канали в един буфер — серия до 5 мълнии + „паяк“ по облачната основа; разклонения до 3 нива (стволът — дебел и ярък,
  // връхчетата — като косъм и бледи). Ширината е ъглова (еднаква на екрана отблизо и отдалеч), яркостта — по върхове (цвят с алфа), лидерът слиза по височината.
  // Силна буря (update(dt, 3)): 2–5 мълнии за ~1 s по хоризонта, по 15–30 разклонения с подразклонения, понякога два успоредни канала, паяци; слаба буря/дъжд — 2–4 прости разклонения.
  const MP3 = 6144, MQ3 = 6144, NCH = 8;
  const P3 = W3 ? new Float32Array(MP3 * 3) : null, SI = W3 ? new Uint16Array(MQ3) : null, SJ = W3 ? new Uint16Array(MQ3) : null, SW = W3 ? new Float32Array(MQ3) : null, SA = W3 ? new Float32Array(MQ3) : null, SU = W3 ? new Float32Array(MQ3) : null, SC = W3 ? new Uint8Array(MQ3) : null;
  const CH = W3 ? Array.from({ length: NCH }, () => ({ t0: 0, at: [0, 0, 0], nat: 0, kind: 0, dist: 0 })) : [];   // kind: 0 — мълния, 1 — само в облака, 2 — паяк
  const CB = new Float32Array(NCH), CL = new Float32Array(NCH); let np3 = 0, ns3 = 0, nch = 0, nStr = 0;   // nStr — колко удара досега (Лабораторията)
  const ftex = W3 ? (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 16; const x = c.getContext('2d'), q = x.createLinearGradient(0, 0, 0, 16); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.3, 'rgba(255,255,255,1)'); q.addColorStop(0.7, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = q; x.fillRect(0, 0, 4, 16); return canvasTex(c); })() : null;   // ядрото — плоско бяло (не „тръба“)
  const mk3 = (col, add, tex = wtex) => { const pos = new Float32Array(MQ3 * 12), cl = new Float32Array(MQ3 * 16), uv = new Float32Array(MQ3 * 8), idx = new Uint16Array(MQ3 * 6);
    for (let q = 0; q < MQ3; q++) { uv.set([0, 0, 0, 1, 1, 0, 1, 1], q * 8); idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2], q * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(cl, 4).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshBasicMaterial({ color: col, map: tex, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.renderOrder = 5; me.visible = false; d.scene.add(me); return me; };
  const core3 = W3 ? mk3(0xfdfbff, false, ftex) : null, glow3 = W3 ? mk3(0xa48eff, true) : null;
  function put3(pts, w0, w1, a0, a1, ch, gy, ty, uFix) {   // един клон → в буфера
    if (np3 + pts.length > MP3 || ns3 + pts.length - 1 > MQ3) return false;
    const b = np3; for (const p of pts) { P3[np3 * 3] = p[0]; P3[np3 * 3 + 1] = p[1]; P3[np3 * 3 + 2] = p[2]; np3++; }
    for (let i = 1; i < pts.length; i++) { const s = ns3++, k = (i - 0.5) / (pts.length - 1); SI[s] = b + i - 1; SJ[s] = b + i; SW[s] = w0 + (w1 - w0) * k; SA[s] = a0 + (a1 - a0) * k; SU[s] = uFix != null ? uFix : Math.max(0, Math.min(1, (ty - pts[i][1]) / Math.max(1, ty - gy))); SC[s] = ch; }
    return true; }
  const LW = [1, 0.45, 0.3, 0.22], LA = [1, 0.62, 0.42, 0.3];   // ширина и яркост по нивото: стволът → косъмчетата
  function kids(pts, lvl, n, ch, gy, ty, L0, crawl, maxL) {   // n разклонения от горната част на pts; всяко — със свои до ниво maxL
    for (let b = 0; b < n; b++) {
      const i0 = 1 + Math.floor(Math.random() * Math.max(1, (pts.length - 2) * (crawl ? 0.95 : 0.75))), s = pts[i0], L = L0 * (0.16 + Math.random() * (lvl === 0 ? 0.4 : 0.55)), a = Math.random() * Math.PI * 2;
      const down = crawl ? 0.1 + Math.random() * 0.35 : lvl === 0 && Math.random() < 0.2 ? 1.3 + Math.random() * 0.9 : 0.35 + Math.random() * 0.6;   // някои от първото ниво слизат почти до земята
      const hz = crawl ? 0.95 : down > 1 ? 0.25 : 0.55, e = [s[0] + Math.cos(a) * L * hz, Math.max(gy + 3, s[1] - L * down), s[2] + Math.sin(a) * L * hz];
      const bp = []; path(s[0], s[1], s[2], e[0], e[1], e[2], lvl === 0 ? 4 : lvl === 1 ? 2 : 1, 0.65, bp, 0.95, 0.5);
      const l1 = lvl + 1, w = LW[l1], al = LA[l1];
      if (!put3(bp, w, w * 0.35, al, al * 0.3, ch, gy, ty, crawl ? 0 : null)) return;
      if (l1 < maxL) kids(bp, l1, Math.floor(Math.random() * (l1 === 1 ? 4 : 3)), ch, gy, ty, L, crawl, maxL);
    } }
  function scale3(b0, sk) { if (sk < 1) for (let i = b0; i < np3; i++) { const o3 = i * 3; P3[o3] = CAM.x + (P3[o3] - CAM.x) * sk; P3[o3 + 1] = CAM.y + (P3[o3 + 1] - CAM.y) * sk; P3[o3 + 2] = CAM.z + (P3[o3 + 2] - CAM.z) * sk; } }
  function bolt3(ch, top, g, strong, sk) {
    const b0 = np3, gy = g[1], ty = top[1], L0 = ty - gy, tr = []; path(top[0], top[1], top[2], g[0], g[1], g[2], 7, 0.62, tr, 0.95, 0.5); put3(tr, 1, 0.75, 1, 0.9, ch, gy, ty);
    if (strong) { kids(tr, 0, 15 + Math.floor(Math.random() * 16), ch, gy, ty, L0, false, 3);
      if (Math.random() < 0.3) { const o = 15 + Math.random() * 35, a = Math.random() * Math.PI * 2, i0 = 2 + Math.floor(Math.random() * 6), t2 = []; path(tr[i0][0], tr[i0][1], tr[i0][2], g[0] + Math.cos(a) * o, gy, g[2] + Math.sin(a) * o, 6, 0.6, t2, 0.95, 0.5); put3(t2, 0.7, 0.55, 0.75, 0.65, ch, gy, ty); } }   // втори успореден канал
    else kids(tr, 0, 2 + Math.floor(Math.random() * 3), ch, gy, ty, L0, false, 1);
    scale3(b0, sk); }
  function crawl3(ch, a, b, sk) {   // паякът: хоризонтален назъбен канал по облачната основа с разклонения встрани
    const b0 = np3, tr = []; path(a[0], a[1], a[2], b[0], b[1], b[2], 5, 0.32, tr); put3(tr, 0.6, 0.45, 0.85, 0.6, ch, 0, 1, 0);
    kids(tr, 0, 6 + Math.floor(Math.random() * 8), ch, a[1] - 500, a[1], Math.hypot(b[0] - a[0], b[2] - a[2]), true, 2); scale3(b0, sk); }
  function strike3(o) {
    const low = d.low && d.low(), md = o.mode || (o.strong ? 3 : 2), strong = o.strong ?? md >= 3, held = o.hold != null;
    d.camera.getWorldPosition(CAM); np3 = ns3 = nch = 0; nStr++;
    const far = (d.camera.far || 900) * 0.85, H = 700 + Math.random() * 350, nb = Math.min(5, o.n ?? (strong ? 2 + Math.floor(Math.random() * 4) : 1)), tops = [];   // H — облачната основа
    let first = null, end = 0.45;
    for (let k = 0; k < nb; k++) {
      const cloudOnly = k === 0 ? (o.cloud ?? (low || Math.random() < (md === 1 ? 0.3 : 0.2))) : !!low, pk = pick3(k === 0 ? o : { dist: o.dist, hit: false }), g = pk.g;
      const top = [g[0] + (Math.random() - 0.5) * 300, g[1] + H, g[2] + (Math.random() - 0.5) * 300], dist = Math.hypot(g[0] - CAM.x, g[2] - CAM.z);
      const far3 = Math.max(Math.hypot(top[0] - CAM.x, top[1] - CAM.y, top[2] - CAM.z), Math.hypot(g[0] - CAM.x, g[1] - CAM.y, g[2] - CAM.z)), sk = Math.min(1, far / Math.max(1, far3));
      const c = CH[nch], ch = nch++; c.t0 = k === 0 || held ? 0 : 0.12 + Math.random() * 0.85; c.kind = cloudOnly ? 1 : 0; c.dist = dist; c.nat = RM ? 0 : 1 + Math.floor(Math.random() * 3); for (let j = 0; j < 3; j++) c.at[j] = 0.13 + j * (0.06 + Math.random() * 0.05);
      end = Math.max(end, c.t0 + 0.45); tops.push(top);
      if (!cloudOnly) bolt3(ch, top, g, strong, sk);
      if (k === 0) first = { g, top, sk, far3, dist, hit: pk.hit && !cloudOnly };
      if (k < 3) thunder(dist);
    }
    if (strong && !low && (o.crawl ?? Math.random() < 0.55)) {   // паяк — между две мълнии от серията или над първата
      const a = [tops[0][0], tops[0][1] - 40, tops[0][2]], t1 = tops[1], b = t1 ? [t1[0], a[1], t1[2]] : [a[0] + (Math.random() - 0.5) * 1400, a[1], a[2] + (Math.random() - 0.5) * 1400];
      const sk = Math.min(1, far / Math.max(1, Math.hypot(a[0] - CAM.x, a[1] - CAM.y, a[2] - CAM.z), Math.hypot(b[0] - CAM.x, b[1] - CAM.y, b[2] - CAM.z)));
      if (Math.min(Math.hypot(a[0] - CAM.x, a[2] - CAM.z), Math.hypot(b[0] - CAM.x, b[2] - CAM.z)) > 900) { const c = CH[nch], ch = nch++; c.t0 = held ? 0 : Math.random() * 0.6; c.kind = 2; c.nat = 0; c.dist = Math.hypot(a[0] - CAM.x, a[2] - CAM.z); end = Math.max(end, c.t0 + 0.7); crawl3(ch, a, b, sk); }   // отблизо паякът минава над главата — само далеч
    }
    const { g, top, sk, far3, dist } = first, sc = (v, k) => CAM.getComponent(k) + (v - CAM.getComponent(k)) * sk;
    st = { t: o.hold ?? 0, hold: o.hold ?? null, end, hit: first.hit, dist, f: 0, strong, cloudOnly: CH[0].kind === 1, dk: 0.55 + 0.45 * Math.min(1, 1200 / Math.max(1, dist)) };
    cloud.position.set(sc(g[0] + (top[0] - g[0]) * 0.85, 0), sc(g[1] + (top[1] - g[1]) * 0.85, 1), sc(g[2] + (top[2] - g[2]) * 0.85, 2)); cloud.scale.setScalar(1400 * sk * Math.max(1, far3 / 1800)); cloud.visible = true;
    if (st.hit) { spark.position.set(sc(g[0], 0), sc(g[1], 1), sc(g[2], 2)); sparkS = 26 * sk * Math.max(1, dist / 600); sparkT = 0.9; }
    light.position.set(g[0], Math.max(40, (g[1] + top[1]) / 2), g[2]); return { dist: Math.round(dist), n: nch, bolt: CH[0].kind === 0, hit: st.hit, strong, segs: ns3, pts: np3 }; }
  const chB = c => { const t = st.t - c.t0; if (t < 0) return 0; if (c.kind === 2) return t < 0.7 ? (0.55 + 0.45 * Math.sin(t * 47)) * (1 - t / 0.7) : 0;
    if (t >= 0.45) return 0; if (t < 0.065) return 0.3; let f = Math.max(0, 1 - (t - 0.065) / 0.09); for (let j = 0; j < c.nat; j++) if (t >= c.at[j] && t < c.at[j] + 0.035) f = Math.max(f, 0.75); if (f < 0.12) f = 0.12 * (1 - (t - 0.065) / 0.385); return f; };
  function ribbon3(me, wA, wM, aM) {   // wA — ъглова ширина (рад), wM — към нея метри; нищо ново на кадър
    const pos = me.geometry.attributes.position.array, col = me.geometry.attributes.color.array; let q = 0;
    for (let s = 0; s < ns3; s++) { const ch = SC[s], b = CB[ch]; if (b <= 0 || SU[s] > CL[ch]) continue; const al = Math.min(1, SA[s] * b * aM); if (al < 0.012) continue;
      A.fromArray(P3, SI[s] * 3); B.fromArray(P3, SJ[s] * 3); V.subVectors(B, A); C.addVectors(A, B).multiplyScalar(0.5).sub(CAM); N.crossVectors(V, C).normalize().multiplyScalar(Math.max(SW[s] * wA, wM) * C.length());
      const o = q * 12; pos[o] = A.x - N.x; pos[o + 1] = A.y - N.y; pos[o + 2] = A.z - N.z; pos[o + 3] = A.x + N.x; pos[o + 4] = A.y + N.y; pos[o + 5] = A.z + N.z; pos[o + 6] = B.x - N.x; pos[o + 7] = B.y - N.y; pos[o + 8] = B.z - N.z; pos[o + 9] = B.x + N.x; pos[o + 10] = B.y + N.y; pos[o + 11] = B.z + N.z;
      const o4 = q * 16; for (let v = 0; v < 16; v += 4) { col[o4 + v] = 1; col[o4 + v + 1] = 1; col[o4 + v + 2] = 1; col[o4 + v + 3] = al; } q++; }
    me.geometry.attributes.position.needsUpdate = true; me.geometry.attributes.color.needsUpdate = true; me.geometry.setDrawRange(0, q * 6); me.visible = q > 0; }
  function render3(dt) {
    if (st.hold == null) st.t += dt;
    if (st.t > st.end) { core3.visible = glow3.visible = false; cloud.visible = false; light.intensity = 0; if (d.rainMat) d.rainMat.opacity = 0.55; st = null; return; }
    let f = 0; for (let c = 0; c < nch; c++) { const h = CH[c], b = chB(h) * (RM ? 0.5 : 1), tc = st.t - h.t0; CB[c] = h.kind === 1 ? 0 : b; CL[c] = h.kind === 0 && tc < 0.065 ? tc / 0.065 : 1; f = Math.max(f, b * (h.kind === 2 ? 0.6 : h.kind === 1 ? 0.7 : 1)); }
    d.camera.getWorldPosition(CAM); const n = d.night ? d.night() : 0, k = 0.45 + 0.55 * n;
    ribbon3(core3, 0.0014, 0.0006, 1); ribbon3(glow3, 0.0062, 0.0022, 0.4 + 0.35 * n); st.f = f;   /* рад на половин ширина: 1 px ≈ 0,0011 рад при 720 px; денем ореолът — по-слаб */
    cloud.material.opacity = Math.min(1, f * k * (st.strong ? 1.3 : 1.05)); light.intensity = 4.5 * f * (0.6 + 1.6 * n); if (d.sun) d.sun.intensity += 1.2 * f * (0.4 + 1.2 * n);
    d.hemi.intensity += 1.8 * f * (0.5 + 1.5 * n) * st.dk * (st.strong ? 1.15 : 1); if (d.rainMat) d.rainMat.opacity = 0.55 + 0.4 * f; }
  // ход на един удар
  let st = null, next = 3 + Math.random() * 6;
  function strike(o = {}) {
    if (W3) return strike3(o);
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
    if (W3) { const md = active === true ? 2 : +active || 0; d.camera.getWorldPosition(CAM);   // 3 — силна буря (серии, много разклонения), 2 — буря, 1 — дъжд с далечни клетки
      if (md && !paused && !st) { next -= dt; if (next <= 0) { strike({ mode: md }); next = (md >= 2 ? (md >= 3 ? 3.5 : 3) + 5 * Math.random() : 15 + 25 * Math.random()) * (CAM.y < 25 ? 1.8 : 1); } }
      else if (!md && next < 2) next = 2 + Math.random() * 3;   // първата — не веднага щом започне
      if (spark && sparkT > 0) { sparkT -= paused || (st && st.hold != null) ? 0 : dt; const a = Math.max(0, sparkT / 0.9); spark.visible = sparkT > 0; spark.material.opacity = a * (0.75 + 0.25 * Math.sin(sparkT * 90)); spark.scale.setScalar(sparkS * (0.6 + 0.6 * a)); }
      if (st) render3(dt); return; }
    else if (active && !paused && !st) { next -= dt; if (next <= 0) { strike(); next = 4 + Math.random() * 11; } }
    if (!st) return;
    if (st.hold == null) st.t += dt; const f = curve(st) * (RM ? 0.5 : 1), n = d.night ? d.night() : 0, k = (0.45 + 0.55 * n);
    if (st.t > 0.45) { core.visible = glow.visible = false; cloud.visible = false; light.intensity = 0; if (d.rainMat) d.rainMat.opacity = 0.55; st = null; return; }
    if (!st.cloudOnly) { const upto = st.t < 0.065 ? Math.max(1, Math.round(mainSeg * st.t / 0.065)) : seg.length;
      core.visible = glow.visible = true; ribbon(core, 1.6 * st.wk, upto); ribbon(glow, 9 * st.wk, upto); core.material.opacity = Math.min(1, 0.25 + f); glow.material.opacity = 0.55 * f; }
    cloud.material.opacity = (st.cloudOnly ? 0.9 : 0.6) * f * k; light.intensity = (st.cloudOnly ? 1.2 : 4.5) * f * (0.6 + 1.6 * n); if (d.sun) d.sun.intensity += (st.cloudOnly ? 0.4 : 1.2) * f * (0.4 + 1.2 * n);
    d.hemi.intensity += (st.cloudOnly ? 0.9 : 1.8) * f * (0.5 + 1.5 * n); if (d.rainMat) d.rainMat.opacity = 0.55 + 0.4 * f;   // мокрите струи проблясват
  }
  const dbg = () => { const o = [], Q = W3 ? P3 : P, n3 = W3 ? np3 : np; for (let i = 0; i < n3; i++) { NDC.fromArray(Q, i * 3).project(d.camera); o.push([+NDC.x.toFixed(2), +NDC.y.toFixed(2), +NDC.z.toFixed(4)]); } return { np: n3, seg: W3 ? ns3 : seg.length, main: W3 ? 64 : mainSeg, nch, strikes: nStr, next: +next.toFixed(2), o, st: st && { dist: Math.round(st.dist), hit: st.hit } }; };   // Лабораторията: къде е мълнията на екрана
  return { update, strike, dbg, light, get flash() { return !st ? 0 : W3 ? st.f * Math.min(1, 1.25 * st.dk) : curve(st) * (RM ? 0.5 : 1) * (st.cloudOnly ? 0.7 : 1); }, get busy() { return !!st; } };
}
