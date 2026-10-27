// firesim.js — 🔥 пожарите като последователност (флаг fire-seq; потребителят: „начало → изпращане → пристигане → гасене →
// оценка на щетите → ремонт или разчистване“). Всичко върви по игровото време (пауза — спира).
// Здравина (hp, 100 → 0) и сила на огъня (inten, 0…1) са отделни: огънят сваля здравината, пожарникарите — силата; угасне ли — щетите спират,
// а здравината остава (гасенето не я връща). 100–70% — местен пожар; 69–30% — повече прозорци, опушена фасада;
// под 30% — критична: спешна поръчка за възстановяване; 0% — изгоряла: разчистване и нов строеж.
// Записът: S.fires = [{ id, city, lot, hp, inten, sev, st, t0, arrive, out, order: { kind, st, cost, reward, deadline, prog, stage } }]
//   st: 'travel' (пожарната пътува) → 'fight' (гасене) → 'saved' (спасена) | 'burned' (изгоряла); 'repair' / 'secured' / 'done'
// deps: { S(), group(), scene, lots(), model(n, s), has(n), skinned(n) → { scene, animations } | null, route(x0,z0,x1,z1) → [{x,z}], startPoint(),
//         day() → игрови дни (с дробната част), cam() → Vector3, econ(), hasStaff(k), crewFree() → bool, modal(t, html, buttons), toast(t, kind),
//         fly(lot), save(), rebuild(lot) (нова сграда на парцела), cityId(), early?() → по-чести пожари (под 3 града) }
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { flameSprite } from './fireflip.js';
import { feature } from './lab/feature.js';
import { spinWheels } from './wheelspin.js';   // 🚒 fire-titan / fire-cyber: колелата на пожарните от Blender (wheel_*)
import { t as tr } from './i18n.js';   // 🌐 lang-en: надписите на платното (f9, част C)

export const FIRE_ST = { travel: '🚒 Пожарната пътува', fight: '🚒 Гасене', saved: '✅ Спасена', burned: '⬛ Изгоряла', repair: '🏗️ Ремонт', secured: '🚧 Обезопасена', done: '✅ Възстановена' };
const TRAVEL = 0.45, KNOCK = 0.9, BURN = 60;   // дни път; колко сила на огъня свалят пожарникарите за ден; колко % здравина на ден при пълна сила × sev
const STAGES = [['🦺 Обезопасяване', 1], ['🏗️ Конструкция', 3], ['🎨 Фасада', 2]], CLEAR = [['🚜 Разчистване', 2], ['🏗️ Нов строеж', 5]];
const fmt = n => Math.round(n).toLocaleString('bg-BG');
const BIG = feature('fire-big'), FIRE_LIT = new THREE.Color(0x8a4a1c);   // задача #11 — по-големи пожари (по-долу: buildBig / updBig); цветът на дима, осветен отдолу
// 0% — изгорялата сграда се сменя с руина (Sketchfab, CC BY — assets/heavy/burned/CREDITS.txt): висока → тухлената, ниска → дървената, малка къща → скелетът;
// при разчистването руината става скелет и се снишава, после новата сграда расте под скелето
const RUIN = { tower: 'assets/heavy/burned/burned-tower.glb', wood: 'assets/heavy/burned/burned-wood.glb', frame: 'assets/heavy/burned/burned-frame.glb' }, ruinCache = {};
const loadRuin = k => ruinCache[k] = ruinCache[k] || new GLTFLoader().loadAsync(RUIN[k]).then(g => { g.scene.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); return g.scene; }).catch(() => null);
const ruinKind = W => W.h >= 12 ? 'tower' : W.wid < 9 && W.half < 9 ? 'frame' : 'wood';

export function createFires(deps) {
  const st = () => { const S = deps.S(); return S ? (S.fires = S.fires || []) : []; };
  const vis = new Map();   // id → визуалното (само за пожарите в текущия град)
  let seq = 0;
  const lotOf = f => (deps.lots() || [])[f.lot];

  // ---------- общи текстури ----------
  const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = canvasTex(c); return t; })();
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(1, 'rgba(255,90,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return canvasTex(c); })();

  // табелата над сградата: „🔥 Здравина: 24% · 🚒 Гасене“ + лента
  function makeLabel() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 12; s.scale.set(16, 4, 1);
    let last = '';
    s.userData.set = (hp, text) => {
      const key = Math.round(hp) + '|' + text; if (key === last) return; last = key;
      const g = c.getContext('2d'); g.clearRect(0, 0, 512, 128);
      g.fillStyle = 'rgba(12,16,24,.86)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 22); g.fill();
      g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(tr('🔥 Здравина: {0}% · {1}', [Math.round(hp), tr(text)]), 22, 46, 470);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(22, 86, 468, 18);
      g.fillStyle = hp < 30 ? '#ff4040' : hp < 70 ? '#ffb020' : '#43d17a'; g.fillRect(22, 86, 468 * Math.max(0, hp) / 100, 18);
      t.needsUpdate = true;
    };
    return s;
  }

  // точките на прозорците: фасадата откъм улицата (lot.rot), на 3 височини × 4 по ширина — пламъците и димът излизат оттам
  function windowsOf(lot) {
    const o = lot.obj; if (!o) return { pts: [], h: 8, top: 8, ctr: new THREE.Vector3(lot.x, 4, lot.z), n: new THREE.Vector3(0, 0, 1) };
    o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), h = b.max.y - b.min.y, ctr = b.getCenter(new THREE.Vector3());
    const r = (lot.rot || 0), n = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), side = new THREE.Vector3(n.z, 0, -n.x);
    const half = Math.abs((b.max.x - b.min.x) * n.x) + Math.abs((b.max.z - b.min.z) * n.z), wid = Math.abs((b.max.x - b.min.x) * side.x) + Math.abs((b.max.z - b.min.z) * side.z);
    if (BIG && Math.abs(Math.sin(o.rotation.y * 2)) > 0.05) {   // fire-big: завъртяната сграда — рамката по нейните оси (световната е по-голяма и пламъците излизаха над улицата)
      const ry = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true); const b0 = new THREE.Box3().setFromObject(o), c0 = b0.getCenter(new THREE.Vector3()).sub(o.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(o.position); o.rotation.y = ry; o.updateMatrixWorld(true);
      const n2 = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), s2 = new THREE.Vector3(n2.z, 0, -n2.x), W2 = b0.max.x - b0.min.x, D2 = b0.max.z - b0.min.z, pts = [], rows = h > 14 ? [0.25, 0.5, 0.75] : [0.35, 0.7];
      for (const fy of rows) for (const fx of [-0.33, -0.11, 0.11, 0.33]) pts.push(c0.clone().addScaledVector(n2, D2 / 2 + 0.25).addScaledVector(s2, fx * W2).setY(b.min.y + fy * h));
      pts.sort((p, q) => p.y - q.y || p.x - q.x); return { pts, h, top: b.max.y, ctr: c0.setY(ctr.y), n: n2, side: s2, half: D2, wid: W2 }; }
    const pts = []; const rows = h > 14 ? [0.25, 0.5, 0.75] : [0.35, 0.7];
    for (const fy of rows) for (const fx of [-0.33, -0.11, 0.11, 0.33]) pts.push(ctr.clone().addScaledVector(n, half / 2 + 0.25).addScaledVector(side, fx * wid).setY(b.min.y + fy * h));
    pts.sort((a, c) => a.y - c.y || a.x - c.x);   // огънят тръгва отдолу
    return { pts, h, top: b.max.y, ctr, n, side, half, wid };
  }
  // опушването: материалите на тази сграда — собствени копия, тъмнеят с щетите
  function scorch(lot, k) {
    const o = lot.obj; if (!o) return;
    if (!o.userData.scorchMats) { const L = []; o.traverse(m => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.color) { m.material = m.material.clone(); L.push([m.material, m.material.color.clone()]); } }); o.userData.scorchMats = L; }
    const dark = new THREE.Color(0x1a1512);
    for (const [m, c0] of o.userData.scorchMats) m.color.copy(c0).lerp(dark, Math.min(0.85, k));
  }

  const W0 = v => v.W.top - v.W.h;   // земята под сградата
  // руината — вписана в петното на сградата (ширина по улицата, дълбочина навътре), обърната към улицата, не по-висока от сградата
  function fitRuin(src, W, rot) {
    const b = new THREE.Box3().setFromObject(src), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const s = Math.min(W.wid * 0.95 / sz.x, W.half * 0.95 / sz.z, W.h * 1.05 / sz.y), inner = src.clone(), r = new THREE.Group();
    inner.position.set(-c.x, -b.min.y, -c.z); r.add(inner); r.scale.setScalar(s); r.userData.s = s; r.userData.h = sz.y * s; r.rotation.y = rot; r.position.set(W.ctr.x, W.top - W.h, W.ctr.z);
    return r;
  }
  // 🔥 fire-big (задача #11): големи пламъци по покрива, тъмен стълб дим, искри, трептящ отблясък по стената и земята — по силата на огъня и големината на сградата
  function buildBig(v) {
    const W = v.W, g = v.g, B = { roof: [], col: [], fx: [] }, n = Math.max(3, Math.min(7, Math.round(W.wid / 3.5)));
    for (let i = 0; i < n; i++) { const fl = flameSprite(1); fl.userData.u = n > 1 ? i / (n - 1) - 0.5 : 0; fl.userData.d = (i % 2 ? 0.15 : -0.15); fl.userData.ph = i * 2.3 + 0.7; fl.visible = false; g.add(fl); B.roof.push(fl); }   // по билото, на зиг-заг
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0x1d1b19, transparent: true, opacity: 0, depthWrite: false })); s.userData.ph = i / 10; s.visible = false; g.add(s); B.col.push(s); }   // стълбът дим
    const N = 48, pos = new Float32Array(N * 3), sp = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: 0xffb347, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.userData.r = Array.from({ length: N }, () => [Math.random(), Math.random() * 6.28, 0.3 + Math.random() * 0.7, Math.random() - 0.5]); sp.frustumCulled = false; sp.visible = false; g.add(sp); B.sparks = sp;   // [фаза, ъгъл, скорост, място по билото]
    B.wall = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); B.wall.visible = false; g.add(B.wall);   // отблясъкът по фасадата
    B.ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); B.ground.rotation.x = -Math.PI / 2; B.ground.visible = false; g.add(B.ground);   // по земята пред сградата (без истинска светлина — нова светлина прекомпилира всички шейдъри)
    return B;
  }
  function updBig(v, f, burning, now) {
    const hr = (6 + (now % 1) * 24) % 24, nk = hr >= 21 || hr < 5 ? 1 : hr >= 19 ? (hr - 19) / 2 : hr < 7 ? (7 - hr) / 2 : 0;   // нощта 0…1 (както часовника: 0 = 06:00)
    const B = v.big, W = v.W, t = v.t, I = f.inten, dmg = (100 - f.hp) / 100, size = Math.max(W.wid, W.half), H = W.h;
    const fk = 0.75 + 0.25 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3) + 0.08 * Math.sin(t * 23.7);   // трептенето — общо за светлините
    const on = burning && I > 0.03, nR = Math.ceil(B.roof.length * Math.min(1, 0.25 + I * 0.6 + dmg * 0.5));
    B.roof.forEach((s, i) => { const vis = on && i < nR; s.visible = vis; if (!vis) return; const k = 0.8 + 0.3 * Math.sin(t * 8 + s.userData.ph) * Math.sin(t * 5.1 + s.userData.ph * 1.7), h = (4 + 0.6 * H + 0.3 * size) * (0.55 + 0.7 * I) * (0.7 + 0.5 * f.sev / 2) * k;
      s.scale.set(h * 0.85, h, 1); s.position.copy(W.ctr).addScaledVector(W.side, s.userData.u * W.wid * 0.8).addScaledVector(W.n, s.userData.d * W.half); s.position.y = W.top - 0.15 * h; });
    // дим: при горене — гъст и тъмен, нагоре и по вятъра; спасена — изтънява за ~1 ден
    const sv = f.st === 'saved' && f.out != null ? Math.max(0, 1 - (now - f.out) / 1.0) : 0, sOn = on || sv > 0, top = W.top + (on ? 1.5 : 0);
    B.col.forEach(s => { s.visible = sOn; if (!sOn) return; const ph = (t * (on ? 0.09 : 0.05) + s.userData.ph) % 1, rise = ph * (H * 1.2 + 14 + 10 * I);
      s.position.copy(W.ctr).addScaledVector(W.side, Math.sin(ph * 5 + s.userData.ph * 9) * 1.2); s.position.x += ph * ph * 7; s.position.z += ph * ph * 3; s.position.y = top + rise;   // вятърът
      s.scale.setScalar((on ? 3 + size * 0.25 : 2.5) + ph * (on ? 6 + size * 0.5 : 6)); if (on) s.material.color.setHex(0x1d1b19).lerp(FIRE_LIT, nk * Math.max(0, 1 - ph * 2.2) * 0.8); else s.material.color.setHex(0x4a4744);   /* нощем — отдолу осветен от огъня */
      s.material.opacity = (on ? 0.9 * Math.min(1, 0.45 + I) : 0.6 * sv) * Math.min(1, ph * 6) * Math.pow(1 - ph, 0.7); });
    // искри — само отблизо
    const near = deps.cam().distanceTo(W.ctr) < 140; B.sparks.visible = on && near;
    if (B.sparks.visible) { const a = B.sparks.geometry.attributes.position, r = B.sparks.userData.r;
      for (let i = 0; i < r.length; i++) { const [p0, ang, sp, u] = r[i], ph = (t * 0.35 * sp + p0) % 1, rad = 0.6 + ph * 2.5;
        a.setXYZ(i, W.ctr.x + W.side.x * u * W.wid * 0.7 + Math.cos(ang + t * 2 * sp) * rad + ph * 4, W.top + ph * (8 + 6 * I), W.ctr.z + W.side.z * u * W.wid * 0.7 + Math.sin(ang + t * 2 * sp) * rad); }
      a.needsUpdate = true; B.sparks.material.opacity = 0.9 * I; B.sparks.material.size = 0.25 + 0.2 * Math.abs(Math.sin(t * 13)); }
    // светлината от огъня — сияние по фасадата и петно по земята, трептят
    B.wall.visible = B.ground.visible = on; if (on) {
      const fc = W.ctr.clone().addScaledVector(W.n, W.half / 2 + 0.6); B.wall.position.set(fc.x, W.top - H * 0.45, fc.z); B.wall.scale.setScalar((H * 1.5 + size) * (0.6 + 0.4 * I)); B.wall.material.opacity = (0.3 + 0.5 * I) * fk * (0.2 + 0.8 * nk);   /* денем — едва (иначе избелва фасадата) */
      const gc = W.ctr.clone().addScaledVector(W.n, W.half / 2 + 3); B.ground.position.set(gc.x, W0(v) + 0.06, gc.z); B.ground.scale.set(size * 2.2 + 8, size * 1.6 + 8, 1); B.ground.material.opacity = (0.35 + 0.5 * I) * fk * (0.15 + 0.85 * nk); }
  }
  function build(f) {
    const lot = lotOf(f), grp = deps.group(); if (!lot || !grp) return null;
    const g = new THREE.Group(); grp.add(g);
    const o = lot.obj, sy = o && o.userData.sy0 != null ? o.scale.y : null; if (sy != null) o.scale.y = o.userData.sy0;   // мерките — на цялата сграда
    const W = windowsOf(lot), v = { g, W, flames: [], smoke: [], glows: [], steam: [], label: makeLabel(), crew: [], water: null, truck: null, path: null, scaf: null, ruins: {}, ruinK: null };
    if (sy != null) o.scale.y = sy; v.ruinK = ruinKind(W);
    v.label.position.set(W.ctr.x, W.top + 5, W.ctr.z); g.add(v.label);
    for (let i = 0; i < W.pts.length; i++) {   // по една точка на прозорец: пламък + сияние + 2 кълбета дим
      const p = W.pts[i], fl = flameSprite(1); fl.position.copy(p); fl.userData.ph = i * 1.7; fl.visible = false; g.add(fl); v.flames.push(fl);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.copy(p); gl.scale.setScalar(4); gl.visible = false; g.add(gl); v.glows.push(gl);
      for (let k = 0; k < 2; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0x2a2a2a, transparent: true, opacity: 0.5, depthWrite: false })); s.userData = { o: p.clone(), ph: Math.random(), i }; s.visible = false; g.add(s); v.smoke.push(s); }
    }
    for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); s.userData = { ph: k / 6 }; g.add(s); v.steam.push(s); }
    // пожарната: път от края на града до улицата пред сградата
    const park = W.ctr.clone().addScaledVector(W.n, W.half / 2 + 7); park.y = 0;
    const s0 = deps.startPoint(park) || { x: park.x + 120, z: park.z };
    const path = (deps.route(s0.x, s0.z, park.x, park.z) || []).map(p => new THREE.Vector3(p.x, 0, p.z)); if (!path.length || path[path.length - 1].distanceTo(park) > 3) path.push(park);
    if (path.length < 2) path.unshift(new THREE.Vector3(s0.x, 0, s0.z));
    v.path = path; v.len = path.reduce((a, p, i) => i ? a + p.distanceTo(path[i - 1]) : 0, 0);
    const tk = deps.has('sf-car-Firetruck') ? deps.model('sf-car-Firetruck', 1) : null;   // детската пожарна е изтрита
    if (tk) { g.add(tk); v.truck = tk; const red = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff2020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), blue = red.clone(); blue.material = red.material.clone(); blue.material.color.set(0x2a6bff);
      red.position.set(-0.6, 3.1, 1.6); blue.position.set(0.6, 3.1, 1.6); red.scale.setScalar(1.6); blue.scale.setScalar(1.6); tk.add(red, blue); v.beacons = [red, blue]; }
    // двамата пожарникари + маркуч + водна струя (само отблизо)
    const P = deps.skinned && deps.skinned('worker_male');
    for (let k = 0; k < 2; k++) {
      let m;
      if (P) { m = P.scene; m.scale.setScalar(1.15); m.traverse(q => { if (q.isMesh) { q.material = q.material.clone(); if (q.material.color) q.material.color.lerp(new THREE.Color(0xd8a020), 0.6); q.frustumCulled = false; } }); const mx = new THREE.AnimationMixer(m), clip = P.animations.find(c => /Interact|Idle/.test(c.name)) || P.animations[0]; if (clip) mx.clipAction(clip).play(); m.userData.mx = mx; }
      else { m = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd8a020 })); m.position.y = 0.95; }
      m.visible = false; g.add(m); v.crew.push(m);
    }
    const wmat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, depthWrite: false });
    v.water = [0, 1].map(() => { const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), 12, 0.12, 6), wmat); tube.visible = false; g.add(tube); return tube; });
    v.hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 1)), 2, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x8a1c1c })); v.hose.visible = false; g.add(v.hose);
    if (BIG) v.big = buildBig(v);
    vis.set(f.id, v); return v;
  }
  function drop(id) { const v = vis.get(id); if (!v) return; { const f = st().find(q => q.id === id), lot = f && lotOf(f); if (lot && lot.obj) { lot.obj.visible = true; if (lot.obj.userData.sy0 != null) lot.obj.scale.y = lot.obj.userData.sy0; } } for (const k in v.ruins) { const r = v.ruins[k]; if (r.isObject3D && r.parent) r.parent.remove(r); }   /* руините делят геометрията с кеша — не се освобождават */ v.g.parent && v.g.parent.remove(v.g); v.g.traverse(o => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); if (o.material && o.material.map && o.material.map !== puff && o.material.map !== glowT && o.material.map.isCanvasTexture) o.material.map.dispose(); }); vis.delete(id); }

  // 🚒 fire-cyber: стълбата (възел Ladder, шарнирът на въртящата се основа отзад) — при гасене се завърта към сградата и се вдига ~50°; иначе — легнала
  const _lq = new THREE.Vector3();
  function fireLadder(tk, up, ctr) {
    const L = tk.userData.ladder === undefined ? (tk.userData.ladder = tk.getObjectByName('Ladder') || null) : tk.userData.ladder; if (!L) return;
    L.rotation.order = 'YXZ'; let yaw = 0;
    if (up) { tk.updateMatrixWorld(true); _lq.copy(ctr).setY(L.getWorldPosition(new THREE.Vector3()).y); L.parent.worldToLocal(_lq).sub(L.position); yaw = Math.atan2(_lq.x, _lq.z); }
    const dy = Math.atan2(Math.sin(yaw - L.rotation.y), Math.cos(yaw - L.rotation.y));
    L.rotation.y += dy * 0.04; L.rotation.x += ((up ? -0.9 : 0) - L.rotation.x) * 0.03;
  }

  // ---------- последователността ----------
  function start(lotId, o = {}) {
    const lot = (deps.lots() || [])[lotId]; if (!lot || !lot.obj || st().some(f => f.lot === lotId && f.city === deps.cityId() && !['done'].includes(f.st))) return null;
    const f = { id: `f${Date.now().toString(36)}${seq++}`, city: deps.cityId(), lot: lotId, hp: 100, inten: 0.35, sev: o.sev ?? (0.5 + Math.random() * 1.2), st: 'travel', t0: deps.day(), arrive: deps.day() + (o.travel ?? TRAVEL), out: null, order: null };
    st().push(f); deps.toast(`🔥 Пожар в сграда (${lot.zone === 'center' ? 'център' : 'квартал'})! Пожарната тръгна.`, 'bad', () => deps.fly(lot)); deps.save(); return f;
  }
  // гасенето приключи: оценка на щетите → поръчка
  function assess(f) {
    const lot = lotOf(f);
    if (f.hp <= 0) { f.hp = 0; f.st = 'burned'; offer(f, 'clear'); }
    else if (f.hp < 30) { f.st = 'saved'; offer(f, 'repair'); }
    else { f.st = 'saved'; deps.toast(`✅ Сградата е спасена — остатъчна здравина ${Math.round(f.hp)}%. Фасадата е опушена.`, 'good', () => lot && deps.fly(lot)); }
    deps.save();
  }
  function orderText(f) {
    const o = f.order, stg = o.kind === 'clear' ? CLEAR : STAGES, days = stg.reduce((a, s) => a + s[1], 0);
    return `<b>${o.kind === 'clear' ? '🏗️ Разчистване и нов строеж' : '🏗️ Спешно възстановяване'}</b> · остатъчна здравина <b style="color:${f.hp < 30 ? '#ff6b6b' : '#ffd54a'}">${Math.round(f.hp)}%</b><br>
      Етапи: ${stg.map(s => `${s[0]} (${s[1]} ${s[1] === 1 ? 'ден' : 'дни'})`).join(' → ')}<br>
      Нужни: 👷 бригада и техника (щом се освободят) · 📦 материали ~<b>${fmt(o.cost)} €</b> (от склада, по етапи)<br>
      Възнаграждение: <b style="color:#43d17a">${fmt(o.reward)} €</b> · срок: ${days + 6} дни (до ден ${Math.ceil(o.deadline)})`;
  }
  function offer(f, kind) {
    if (f.order) return;   // по една поръчка на инцидент
    const lot = lotOf(f), base = 120000 * (lot && lot.zone === 'center' ? 2 : 1) * (lot && lot.plan ? 1.5 : 1), dmg = kind === 'clear' ? 1.6 : (100 - f.hp) / 100;
    const days = (kind === 'clear' ? CLEAR : STAGES).reduce((a, s) => a + s[1], 0);
    f.order = { kind, st: 'offer', cost: Math.round(base * dmg / 1000) * 1000, reward: Math.round(base * dmg * 1.4 / 1000) * 1000, deadline: deps.day() + days + 6, prog: 0, stage: 0 };
    ask(f);
  }
  function ask(f) {
    const lot = lotOf(f);
    deps.modal(f.order.kind === 'clear' ? '⬛ Сградата изгоря' : '🔥 Критични щети', orderText(f), [
      ['Откажи', () => decline(f.id)], ['Покажи сградата', () => { lot && deps.fly(lot); setTimeout(() => f.order && f.order.st === 'offer' && ask(f), 2500); }], ['Приеми', () => accept(f.id)]]);
  }
  function accept(id) {
    const f = st().find(q => q.id === id); if (!f || !f.order || f.order.st !== 'offer') return false;
    if (deps.startJob) {   // истински обект в „Обекти“: етапите, бригадата (щом се освободи), техниката и материалите — като всеки строеж; плаща се при завършване
      const lot = lotOf(f), pid = lot && deps.startJob(f, lot); if (!pid) return false;
      f.order.st = 'work'; f.order.pid = pid; f.order.t0 = deps.day(); f.st = 'repair'; drop(f.id);
      deps.toast('🏗️ Приета — обектът е в „Обекти“. Бригадата тръгва, щом се освободи.', 'good'); deps.save(); return true;
    }
    const why = !deps.crewFree() ? 'Няма свободна бригада.' : !deps.hasStaff('engineer') ? 'Трябва инженер (таб „Офис“ → Специалисти).' : !deps.econ().canAfford(f.order.cost) ? `Нямаш ${fmt(f.order.cost)} € за материали.` : null;
    if (why) { deps.toast(`🏗️ ${why}`, 'bad'); return false; }
    deps.econ().spend(f.order.cost, 'обект', f.order.kind === 'clear' ? 'Разчистване след пожар' : 'Спешно възстановяване след пожар');
    f.order.st = 'work'; f.order.t0 = deps.day(); f.st = 'repair'; deps.toast('🏗️ Приета. Бригадата тръгна към сградата.', 'good'); deps.save(); return true;
  }
  function decline(id) {
    const f = st().find(q => q.id === id); if (!f || !f.order) return;
    f.order.st = 'declined'; f.st = 'secured'; const lot = lotOf(f); if (lot) lot.busy = 'secured'; deps.toast('🚧 Сградата остава обезопасена и неизползваема.', ''); deps.save();
  }

  // всеки кадър: dd — игрови дни (0 на пауза)
  function update(dd) {
    const S = deps.S(); if (!S) return;
    const now = deps.day(), here = deps.cityId(), cam = deps.cam();
    for (const f of st()) {
      if (f.city !== here) continue;
      // механиката (игрово време)
      if (dd > 0) {
        if (f.st === 'travel' || f.st === 'fight') {
          // на малки стъпки (≤ 0,02 дни) — при 4× и в тестовете кадърът е голямо парче от деня
          for (let left = dd, tt = now - dd; left > 1e-9 && (f.st === 'travel' || f.st === 'fight'); ) {
            const h = Math.min(0.02, left); left -= h; tt += h;
            if (f.st === 'travel' && tt >= f.arrive) f.st = 'fight';
            if (f.st === 'travel') f.inten = Math.min(1, f.inten + h * 1.4);   // докато пътуват — огънят расте
            else f.inten = Math.max(0, f.inten - h * KNOCK / Math.max(0.4, f.sev * 0.8));
            f.hp = Math.max(0, f.hp - h * BURN * f.sev * f.inten);
            if (f.hp <= 0 || f.inten <= 0) { f.out = tt; f.inten = 0; assess(f); }
          }
        } else if (f.st === 'repair' && f.order && f.order.pid != null) {   // обектът в „Обекти“ води напредъка; изчезне ли — завършен (платен от играта)
          const p = deps.project && deps.project(f.order.pid), n = p ? ((p.type === 'fireClear' ? 4 : 3)) : 1;
          if (p) { f.order.prog = Math.min(1, ((p.stage || 0) + (p.prog || 0)) / n); f.hp = Math.max(f.hp, f.order.kind === 'clear' ? 0 : 100 * f.order.prog); }
          else { f.order.st = 'done'; f.order.prog = 1; f.st = 'done'; f.hp = 100; f.out = f.out ?? now; const lot = lotOf(f); if (lot && lot.busy === 'secured') lot.busy = null; deps.save(); }
        } else if (f.st === 'repair' && f.order) {
          const stg = f.order.kind === 'clear' ? CLEAR : STAGES, days = stg.reduce((a, s) => a + s[1], 0);
          f.order.prog = Math.min(1, (now - f.order.t0) / days);
          let acc = 0; f.order.stage = stg.findIndex(s => (acc += s[1]) / days >= f.order.prog - 1e-9);
          if (f.order.kind !== 'clear') f.hp = Math.max(f.hp, f.hp0 = f.hp0 ?? f.hp, (f.hp0 ?? f.hp) + (100 - (f.hp0 ?? f.hp)) * f.order.prog);
          if (f.order.prog >= 1) finish(f);
        }
      }
      // визуалното
      const lot = lotOf(f); if (!lot) continue;
      if (f.order && f.order.pid != null) { if (vis.has(f.id)) drop(f.id); continue; }   // обект — визуалното е на строежа (скеле, събаряне)
      let v = vis.get(f.id); if (!v && f.st !== 'done') v = build(f); if (!v) continue;
      const near = cam.distanceTo(v.W.ctr) < 160;
      const burning = f.st === 'travel' || f.st === 'fight';
      const lit = Math.ceil(v.flames.length * Math.min(1, 0.15 + f.inten * (0.35 + (100 - f.hp) / 140)));   // колкото по-силно и по-разрушено — толкова повече прозорци
      v.t = (v.t || 0) + dd * 24;   // „секунди“ по игровото време (24 s за ден на 1×)
      v.flames.forEach((s, i) => { const on = burning && i < lit; s.visible = on; v.glows[i].visible = on; if (on) { const k = 0.8 + 0.25 * Math.sin(v.t * 9 + s.userData.ph) * Math.sin(v.t * 6.3 + s.userData.ph * 2), h = (1.6 + 2.6 * f.inten) * k * (BIG ? 1.5 + Math.min(1, v.W.h / 20) : 1);   /* fire-big: по-високи езици от прозорците */ s.scale.set(h * 0.8, h, 1); s.position.y = v.W.pts[i].y + h * 0.35; v.glows[i].material.opacity = 0.5 * f.inten; } });
      if (v.big) updBig(v, f, burning, now);
      const clr = f.st === 'repair' && f.order && f.order.kind === 'clear', d0 = CLEAR[0][1] / (CLEAR[0][1] + CLEAR[1][1]), k0 = clr ? f.order.prog / d0 : 0;
      const ruinOn = f.hp <= 0 && (f.st === 'burned' || f.st === 'secured' || (clr && f.order.stage === 0)), gy = W0(v);
      v.smoke.forEach(s => { const i = s.userData.i, on = (burning && i < lit) || (f.st === 'saved' && f.out != null && now - f.out < 0.4 && i < 3) || (ruinOn && !clr && i < 2); s.visible = on; if (!on) return; const ph = (v.t * (burning ? 0.12 : 0.06) + s.userData.ph) % 1, o = burning ? s.userData.o : (s.userData.ro || (s.userData.ro = v.W.ctr.clone().addScaledVector(v.W.side, (s.userData.ph - 0.5) * v.W.wid * 0.5))).setY(gy + 0.8 * ((v.ruins[v.ruinK] || {}).userData?.h || 3));   /* тлее — от върха на руината */ s.position.set(o.x + v.W.n.x * ph * 2, o.y + ph * 9, o.z + v.W.n.z * ph * 2); const sm = !burning && ruinOn; s.scale.setScalar(sm ? 5 + ph * 10 : 2 + ph * 6); s.material.color.setHex(sm ? 0x4a4744 : 0x2a2a2a); s.material.opacity = (burning ? 0.55 : sm ? 0.85 : 0.3) * (1 - ph * ph); });
      // пара след успешно гасене (~0,4 дни)
      const steamOn = f.out != null && f.hp > 0 && now - f.out < 0.4; v.steam.forEach(s => { s.visible = steamOn; if (!steamOn) return; const ph = (v.t * 0.1 + s.userData.ph) % 1, p = v.W.pts[(s.userData.ph * 6 | 0) % Math.max(1, v.W.pts.length)] || v.W.ctr; s.position.set(p.x, p.y + ph * 6, p.z); s.scale.setScalar(1.5 + ph * 4); s.material.opacity = 0.4 * (1 - ph) * (1 - (now - f.out) / 0.4); });
      if (!(clr && f.order.stage >= 1)) scorch(lot, (100 - f.hp) / 100 * 1.1);
      // руината: вместо изгорялата сграда; при разчистването — скелетът, който се снишава; после новата сграда расте
      const want = ruinOn ? (clr && k0 > 0.5 ? 'frame' : v.ruinK) : null;
      if (want && !v.ruins[want]) { v.ruins[want] = 'loading'; loadRuin(want).then(src => { if (!src || vis.get(f.id) !== v) return; v.ruins[want] = fitRuin(src, v.W, lot.rot || 0); v.g.add(v.ruins[want]); }); }
      for (const k in v.ruins) { const r = v.ruins[k]; if (!r.isObject3D) continue; r.visible = k === want; if (k === want) r.scale.y = r.userData.s * (clr ? Math.max(0.15, k0 > 0.5 ? 2 - 2 * k0 + 0.15 : 1 - k0 * 0.6) : 1); }
      const ready = want && v.ruins[want] && v.ruins[want].isObject3D;
      if (lot.obj) { const sy0 = lot.obj.userData.sy0 ?? (lot.obj.userData.sy0 = lot.obj.scale.y);
        if (clr && f.order.stage >= 1) { lot.obj.visible = true; lot.obj.scale.y = sy0 * Math.max(0.05, (f.order.prog - d0) / (1 - d0)); scorch(lot, 0); }
        else { lot.obj.visible = !ready; lot.obj.scale.y = sy0; } }
      // пожарната: по пътя (игрово време) → паркира с бурканите
      if (v.truck) {
        const k = f.st === 'travel' ? Math.min(1, 1 - (f.arrive - now) / (f.arrive - f.t0)) : 1, d = k * v.len;
        let acc = 0, p = v.path[v.path.length - 1], dir = new THREE.Vector3(0, 0, 1);
        for (let i = 1; i < v.path.length; i++) { const L = v.path[i].distanceTo(v.path[i - 1]); if (acc + L >= d) { p = v.path[i - 1].clone().lerp(v.path[i], (d - acc) / Math.max(1e-6, L)); dir = v.path[i].clone().sub(v.path[i - 1]).normalize(); break; } acc += L; }
        v.truck.position.copy(p); if (f.st === 'travel') v.truck.rotation.y = Math.atan2(dir.x, dir.z);
        const showT = burning || (f.out != null && now - f.out < 0.5); v.truck.visible = showT;
        if (showT) { spinWheels(v.truck); fireLadder(v.truck, f.st === 'fight', v.W.ctr); }   // fire-titan / fire-cyber: колелата; стълбата се вдига към сградата при гасене
        if (v.beacons) { const b = Math.sin(v.t * 14) > 0; v.beacons[0].visible = showT && b; v.beacons[1].visible = showT && !b; }
      }
      // пожарникарите и водата — само при гасене и отблизо
      const crewOn = f.st === 'fight' && near && !!v.truck;
      v.crew.forEach((m, k) => { m.visible = crewOn; if (!crewOn) return; const base = v.truck.position.clone().lerp(v.W.ctr.clone().setY(0).addScaledVector(v.W.n, v.W.half / 2), 0.55).addScaledVector(v.W.side, (k ? 1 : -1) * 2.2); m.position.set(base.x, m.isSkinnedMesh || m.userData.mx ? 0.05 : 0.95, base.z); m.lookAt(v.W.ctr.x, m.position.y, v.W.ctr.z); if (m.userData.mx) m.userData.mx.update(dd * 24); });
      v.hose.visible = crewOn; v.water.forEach((w, k) => {
        const tgt = v.W.pts[Math.max(0, Math.min(lit - 1, k))]; w.visible = crewOn && !!tgt && f.inten > 0.02; if (!w.visible) return;
        const a = v.crew[k].position.clone().setY(1.4), c = tgt.clone(), mid = a.clone().lerp(c, 0.5); mid.y = Math.max(a.y, c.y) + 3 + 0.3 * Math.sin(v.t * 3 + k);
        w.geometry.dispose(); w.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, c), 14, 0.1 + 0.05 * f.inten, 6);
      });
      if (crewOn && v.frameHose !== true) { v.frameHose = true; v.hose.geometry.dispose(); v.hose.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v.truck.position.clone().setY(0.4), v.crew[0].position.clone().setY(0.2), v.crew[1].position.clone().setY(0.2)]), 20, 0.08, 6); }
      // скеле при ремонта
      if (f.st === 'repair' && !v.scaf && lot.obj) { const b = new THREE.Box3().setFromObject(lot.obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); v.scaf = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 1.2, Math.max(4, sz.y + 1), sz.z + 1.2, 6, 6, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, wireframe: true })); v.scaf.position.set(c.x, b.min.y + Math.max(4, sz.y + 1) / 2, c.z); v.g.add(v.scaf); }
      if (v.scaf) v.scaf.visible = f.st === 'repair';
      // табелата
      const txt = f.st === 'repair' && f.order ? `🏗️ ${(f.order.kind === 'clear' ? CLEAR : STAGES)[Math.max(0, f.order.stage)][0].replace(/^\S+ /, '')} ${Math.round(f.order.prog * 100)}%` : FIRE_ST[f.st] || '';
      v.label.userData.set(f.hp, txt); v.label.visible = f.st !== 'done' && !(f.st === 'saved' && f.out != null && now - f.out > 3 && !f.order);
    }
    // махнатите (готови) и от други градове — без визуалното
    for (const id of [...vis.keys()]) { const f = st().find(q => q.id === id); if (!f || f.city !== here || f.st === 'done' || (f.st === 'saved' && !f.order && f.out != null && now - f.out > 3)) drop(id); }
  }
  function finish(f) {
    const lot = lotOf(f); f.order.st = 'done'; f.st = 'done';
    if (f.order.kind === 'clear') { if (lot && lot.obj) { lot.obj.scale.y = lot.obj.userData.sy0 ?? lot.obj.scale.y; lot.obj.visible = true; } deps.rebuild && lot && deps.rebuild(lot); }
    f.hp = 100; if (lot && lot.obj) scorch(lot, 0);
    if (lot && lot.busy === 'secured') lot.busy = null;
    deps.econ().earn(f.order.reward, 'обект', f.order.kind === 'clear' ? 'Нов строеж след пожар' : 'Възстановяване след пожар');
    deps.toast(`✅ ${f.order.kind === 'clear' ? 'Новата сграда е готова' : 'Сградата е възстановена'}: +${fmt(f.order.reward)} €`, 'good', () => lot && deps.fly(lot)); deps.save();
  }
  // всеки игрален ден: рядко — нов пожар в текущия град (само в застроен парцел); поръчките с изтекъл срок — отказани
  function dailyTick() {
    const now = deps.day(); for (const f of st()) if (f.order && f.order.st === 'offer' && now > f.order.deadline) decline(f.id);
    const S = deps.S(); S.fires = st().filter(f => f.st !== 'done' || now - (f.out ?? now) < 30);   // старите — от записа
    const early = deps.early ? deps.early() : false;   // #13 (rescue-early): в първите 2 града — ×2,5 по-често и от 12 построени сгради (пари в началото)
    const built = (deps.lots() || []).filter(l => l.obj && l.built && !l.busy); if (built.length < (early ? 12 : 20) || Math.random() > (early ? 0.1 : 0.04) || st().some(f => f.city === deps.cityId() && (f.st === 'travel' || f.st === 'fight'))) return;
    start(built[(Math.random() * built.length) | 0].id);
  }
  // при влизане в града: отказаните/обезопасените пазят парцела; поръчката в изчакване — пак се показва
  function sync() { for (const id of [...vis.keys()]) drop(id); for (const f of st()) { if (f.city !== deps.cityId()) continue; const lot = lotOf(f); if (lot && f.st === 'secured') lot.busy = 'secured'; } const p = st().find(f => f.city === deps.cityId() && f.order && f.order.st === 'offer'); if (p) setTimeout(() => ask(p), 1500); }
  // #14: пожарната на път (с бурканите) — за трафика: колите пред нея отбиват и спират (тя се движи по разписание и не чака)
  const _mw = new THREE.Vector3();
  const movers = () => { const out = []; for (const f of st()) { if (f.st !== 'travel') continue; const v = vis.get(f.id); if (!v || !v.truck || !v.truck.visible) continue; v.truck.getWorldPosition(_mw); out.push({ x: _mw.x, z: _mw.z, yaw: v.truck.rotation.y, l: 9, w: 2.6, em: true }); } return out; };
  return { start, update, dailyTick, sync, accept, decline, state: st, drop, movers };
}
