// ghosthunt.js — 👻 скрита изненада в Ню Йорк (feature 'ghost-hunt'): НАША пародия, без чуждите марки (без името, логото и колата от филма).
// Старата червена пожарна (Meshy AI, Темидасофт) стои на мястото на нисък блок до центъра. Отключва се в полунощ в Ню Йорк — в петък 13-и
// или след 13 завършени обекта в града: над пожарната светва зелено сияние, от покрива — зелен лъч към небето; бялата кола със зелените перки
// и нашия знак (дух в зелен кръг, „ТЕМИДАСОФТ“) обикаля нощем по улиците с бурканите (ритъмът на спешните коли: ляво–ляво, дясно–дясно, ляво, дясно).
// Постижение „👻 Кого ще повикаш?“ (S.ghost). Денем колата стои пред пожарната.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/heavy/gh/';
const L_ON = new Set([0, 1, 3, 4, 12, 13, 14]), R_ON = new Set([6, 7, 9, 10, 17, 18, 19]);   // от 24 кадъра в секунда — общият ритъм на спешните коли
const CAR_LEN = 6.2, SPEED = 11;   // м, м/с

// deps: { scene, S(), pv() — изгледът на плана (blocks, hideBlocks), hour() 0..24, night() 0..1, roadRoute(x0, z0, x1, z1), roadPoint(), toast(msg, kind), pop(key, cap, sub), save() }
export function createGhostHunt(deps) {
  let upd = 0, M = null, loading = null, lot = null, baseG = null, car = null, glow = null, beam = null, route = [], ri = 0, cityId = null, force = false;
  const load = () => loading || (loading = Promise.all(['gh-base', 'gh-car'].map(f => new GLTFLoader().loadAsync(BASE + f + '.glb').then(g => g.scene))).then(([b, c]) => { M = { b, c }; }).catch(e => { console.warn('ghost-hunt', e); }));

  // нисък блок (15–45 м; основа ≥ 12 × 22 м — моделът е 2:1, фасадите в Ню Йорк са по 13 м) на 120–600 м от центъра — най-близкият; детерминистично
  function pickLot(pv) {
    const L = (pv.userData.blocks || []).filter(b => b.h >= 15 && b.h <= 45 && Math.min(b.w, b.d) >= 12 && Math.max(b.w, b.d) >= 22 && Math.max(b.w, b.d) <= 60 && Math.hypot(b.x, b.z) >= 120 && Math.hypot(b.x, b.z) <= 600);
    L.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)); return L[0] || null;
  }
  function placeBase(pv) {
    lot = pickLot(pv); if (!lot) return;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); lot.M.decompose(p, q, s);
    const o = M.b.clone(true), bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3());
    const turn = (s.x > s.z) !== (sz.x > sz.z), mx = turn ? sz.z : sz.x, mz = turn ? sz.x : sz.z, k = Math.min(s.x / mx, s.z / mz) * 0.98;   // по дългата ос на парцела (моделът е 2:1, тясната страна с пожарната — към улицата); вписан
    o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; if (m.material && m.material.emissiveMap) { m.material = m.material.clone(); m.material.emissiveIntensity = 0; } } });
    baseG = new THREE.Group(); baseG.name = 'ghost-base'; const inner = new THREE.Group(); inner.add(o); if (turn) inner.rotation.y = Math.PI / 2; o.scale.setScalar(k); o.position.set(-(bb.min.x + bb.max.x) / 2 * k, -bb.min.y * k, -(bb.min.z + bb.max.z) / 2 * k);
    baseG.add(inner); baseG.position.set(p.x, 0, p.z); baseG.quaternion.copy(q); baseG.userData.h = sz.y * k; baseG.userData.front = mz * k / 2; baseG.userData.turn = turn;
    pv.add(baseG); pv.userData.hideBlocks(new Set([lot]), 'ghost');
    // сиянието и лъчът (адитивни, зелени; нощем)
    const gm = new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    glow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), gm); glow.scale.set(Math.max(s.x, s.z) * 0.6, baseG.userData.h * 0.55, Math.max(s.x, s.z) * 0.6); glow.position.set(p.x, baseG.userData.h * 0.85, p.z); glow.renderOrder = 3; pv.add(glow);
    const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
    const bm = new THREE.MeshBasicMaterial({ color: 0x5dff86, map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.2, 600, 16, 1, true).translate(0, 300, 0), bm); beam.position.set(p.x, baseG.userData.h, p.z); beam.renderOrder = 3; pv.add(beam);
  }
  function makeCar(pv) {
    const o = M.c.clone(true), bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), k = CAR_LEN / sz.z;
    o.scale.setScalar(k); o.position.set(-(bb.min.x + bb.max.x) / 2 * k, -bb.min.y * k, -(bb.min.z + bb.max.z) / 2 * k);
    o.traverse(m => { if (m.isMesh) m.castShadow = true; });
    const g = new THREE.Group(); g.name = 'ghost-car'; g.add(o);
    // бурканите (по модела: предна и задна синя лайсна — лява/дясна половина, сини лампи отпред, червено-бял буркан на покрива); м, предницата към +z
    const mk = (col, w, h, d, x, y, z, side) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, y, z); m.userData.side = side; g.add(m); return m; };
    g.userData.lamps = [];
    for (const z of [0.62, -1.92]) { g.userData.lamps.push(mk(0x2a6bff, 0.8, 0.12, 0.28, 0.44, 1.84, z, 'L'), mk(0x2a6bff, 0.8, 0.12, 0.28, -0.44, 1.84, z, 'R')); }
    const ball = (col, r, x, y, z, side) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, y, z); m.userData.side = side; g.add(m); return m; };
    // собственикът (Blender, 01.11): „да ги сложим на топките като топки“ — сините лампи върху двете сфери отпред на покрива; „да смъкнем фаровете“ — на кръглите фарове (0,72 м); „стоповете да светят“ — върховете на перките
    g.userData.lamps.push(ball(0x2a6bff, 0.12, 0.56, 1.69, 0.86, 'R'), ball(0x2a6bff, 0.12, -0.56, 1.69, 0.86, 'L'), mk(0xff2010, 0.28, 0.22, 0.28, 0, 2.48, -0.8, 'B'));
    for (const x of [-0.92, -0.72, 0.72, 0.92]) g.userData.lamps.push(ball(0xfff1d8, 0.075, x, 0.72, 3.06, 'H'));   // фаровете — нощем постоянно
    for (const x of [-0.84, 0.84]) g.userData.lamps.push(ball(0xff1a0a, 0.05, x, 0.97, -2.93, 'T'));   // стоповете — нощем постоянно
    deps.scene.add(g); return g;
  }
  const unlocked = () => !!(deps.S() && deps.S().ghost) || force;
  const fri13 = day => (day - 1) % 30 + 1 === 13 && (day - 1) % 7 === 4;   // календарът на играта: месецът — по 30 дни; 1-ви ден — понеделник
  function tryUnlock() {
    const S = deps.S(); if (!S || S.ghost || S.cityId !== 'newyork') return;
    const h = deps.hour(); if (h >= 1) return;   // само в полунощ (00:00–01:00)
    if (!fri13(S.day) && (S.done || 0) < 13) return;
    S.ghost = { day: S.day }; deps.save && deps.save();
    deps.toast('👻 В полунощ над старата пожарна светна зелено… Нощем колата на ловците обикаля Ню Йорк.', 'good');
    deps.pop && deps.pop('ghost-hunt', '🏆 Кого ще повикаш?', 'Скрито постижение: полунощ в Ню Йорк — зеленото сияние над старата пожарна');
  }
  function nextRoute() {
    if (!car) return; const t = deps.roadPoint && deps.roadPoint(); if (!t) return;
    const r = deps.roadRoute(car.position.x, car.position.z, t.x, t.z) || []; route = r.length > 1 ? r : []; ri = 0;
  }
  function park() {
    if (!car || !baseG) return; baseG.updateMatrixWorld(true); const W = baseG.matrixWorld, sc = new THREE.Vector3().setFromMatrixScale(W).x || 1;
    const dir = new THREE.Vector3(baseG.userData.turn ? 1 : 0, 0, baseG.userData.turn ? 0 : 1).transformDirection(W), p = new THREE.Vector3().setFromMatrixPosition(W);
    car.position.set(p.x + dir.x * (baseG.userData.front * sc + 4), 0, p.z + dir.z * (baseG.userData.front * sc + 4)); car.rotation.set(0, Math.atan2(dir.x, dir.z) + Math.PI / 2, 0); route = []; }

  return {
    // dt — секунди (реално време), playing — играта не е на пауза
    update(dt, playing = true) {
      const S = deps.S(), pv = deps.pv && deps.pv(); upd++;
      if (!S || S.cityId !== 'newyork' || !pv || !pv.userData.blocks) { if (cityId && S && S.cityId !== cityId) { if (car && car.parent) car.parent.remove(car); baseG = car = glow = beam = null; lot = null; cityId = null; } return; }
      if (!M) { load(); return; }
      if (cityId !== S.cityId || !baseG || !baseG.parent) { cityId = S.cityId; if (car && car.parent) car.parent.remove(car); baseG = car = glow = beam = null; placeBase(pv); if (!baseG) return; car = makeCar(pv); park(); }
      if (playing) tryUnlock();
      const n = deps.night(), on = unlocked() && n > 0.4, t = performance.now() / 1000, f = Math.floor(t * 24) % 24;
      if (glow) { glow.material.opacity = on ? (0.07 + 0.035 * Math.sin(t * 2.1)) * n : 0; glow.visible = glow.material.opacity > 0.001; }
      if (beam) { beam.material.opacity = on ? (0.35 + 0.1 * Math.sin(t * 3.3)) * n : 0; beam.visible = beam.material.opacity > 0.001; }
      if (baseG) baseG.traverse(m => { if (m.isMesh && m.material && m.material.emissiveMap) m.material.emissiveIntensity = n; });
      if (!car) return;
      for (const l of car.userData.lamps) { const sd = l.userData.side; if (sd === 'H' || sd === 'T') { l.material.opacity = n > 0.3 ? 1 : 0; continue; } const lit = on && (sd === 'L' ? L_ON.has(f) : sd === 'R' ? R_ON.has(f) : f % 6 < 3); l.material.opacity = lit ? 1 : 0.15; }
      if (!on) { if (route.length) park(); return; }
      if (!playing) return;
      if (!route.length || ri >= route.length - 1) { nextRoute(); return; }
      let step = SPEED * dt;
      while (step > 0 && ri < route.length - 1) {
        const a = car.position, b = route[ri + 1], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d <= step) { a.x = b.x; a.z = b.z; ri++; step -= d; continue; }
        a.x += dx / d * step; a.z += dz / d * step; car.rotation.set(0, Math.atan2(dx, dz), 0); step = 0;
      }
    },
    // Лабораторията: отключено (без запис), камерата към пожарната; night — 0:30
    look(night = true) { force = true; if (!lot || !baseG) return null; baseG.updateMatrixWorld(true); const p = new THREE.Vector3().setFromMatrixPosition(baseG.matrixWorld), sc = new THREE.Vector3().setFromMatrixScale(baseG.matrixWorld).x || 1; return { x: p.x, z: p.z, h: baseG.userData.h * sc, w: Math.max(lot.w, lot.d) * sc }; },
    state: () => { const S = deps.S(), pv = deps.pv && deps.pv(), B = (pv && pv.userData.blocks) || []; return { lot: !!lot, base: !!baseG, car: !!car, unlocked: unlocked(), route: route.length, upd, M: !!M, city: S && S.cityId, pv: !!pv, blocks: B.length, cand: B.filter(b => b.h >= 15 && b.h <= 45 && Math.min(b.w, b.d) >= 12 && Math.max(b.w, b.d) >= 22).length, hs: B.slice(0, 5).map(b => [Math.round(b.x), Math.round(b.z), Math.round(b.w), Math.round(b.d), Math.round(b.h)]) }; },
  };
}
