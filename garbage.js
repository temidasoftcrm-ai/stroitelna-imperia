// garbage.js — 🚛 garbage-truck (f6, модел на потребителя — Meshy, Темидасофт): сметосъбирачът в града.
// Сутрин (5–10 ч.) бавно обикаля жилищните улици (класа „street“ от плана) и през ~60 м спира за ~5 s: до бордюра стои кофа, задният капак
// (възел Lift, клип „lift“ в GLB-то) се вдига и спуска, кофата изчезва. През деня — понякога (половината дни); нощем — с мигащия оранжев буркан.
// Колелата — wheelspin.js (wheel_*); бурканите — възлите beacon_* (оранжево, мигат тук).
//   game.js: createGarbage({ group, model, streets, hour, night, day }) → { update(dt), clear() }
import * as THREE from 'three';
import { spinWheels, hubWheels } from './wheelspin.js';

const V = 3.5, STOP = 5, EVERY = 60;   // м/s, s, м

// веднъж, на заредения модел (одитът №10–11): колелата — в главината; огледалата (стърчат до ±1,9 м) — прибрани до каросерията; ширината — 2,55 м (беше 2,96 / 3,7 с огледалата)
export function garbageNarrow(root) {
  hubWheels(root); const body = root.getObjectByName('Body');
  if (body && body.isMesh) { const g = body.geometry; g.computeBoundingBox(); const bb = g.boundingBox, half = Math.max(-bb.min.x, bb.max.x), lim = half * (1.48 / 1.88), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (Math.abs(x) > lim) p.setX(i, Math.sign(x) * lim); } p.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); }
  const w = new THREE.Group(); w.name = 'narrow'; for (const c of root.children.slice()) w.add(c); w.scale.x = 2.55 / 2.96; root.add(w);
}

export function createGarbage(deps) {
  let truck = null, route = null, seg = 0, along = 0, run = 0, stopT = 0, bin = null, lift = null, beacons = [];
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.7 }), binGeo = new THREE.BoxGeometry(0.9, 1.2, 0.9).translate(0, 0.6, 0);
  // маршрут: верига от улици, свързани в краищата (≤ 3 м); по дясната лента
  function buildRoute() {
    const S = (deps.streets() || []).filter(s => s.cls === 'street' && s.pts && s.pts.length > 1 && !s.noCars); if (!S.length) return null;
    let s = S[Math.floor(Math.random() * S.length)], pts = s.pts.map(p => [p[0] ?? p.x, p[1] ?? p.z]); const used = new Set([s]);
    for (let k = 0; k < 12; k++) { const e = pts[pts.length - 1], nx = S.find(q => !used.has(q) && Math.hypot((q.pts[0][0] ?? q.pts[0].x) - e[0], (q.pts[0][1] ?? q.pts[0].z) - e[1]) < 3);
      if (!nx) break; used.add(nx); pts = pts.concat(nx.pts.slice(1).map(p => [p[0] ?? p.x, p[1] ?? p.z])); }
    const off = Math.max(1.6, (s.w || 6) / 4), out = [];   // дясна лента (вървим по посоката на точките)
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; out.push([pts[i][0] - dz / l * off, pts[i][1] + dx / l * off]); }
    return out.length > 1 ? out : null;
  }
  function spawn() {
    const src = deps.model(); if (!src) return false; truck = src; deps.group().add(truck);
    lift = truck.getObjectByName('Lift'); beacons = []; truck.traverse(o => { if (o.isMesh && /^beacon_/.test(o.name)) { o.material = o.material.clone(); beacons.push(o); } });
    route = buildRoute(); seg = 0; along = 0; run = 0; stopT = 0; return !!route;
  }
  const active = () => { const h = deps.hour(); return (h >= 5 && h < 10) || (h >= 10 && h < 17 && (deps.day() % 2 === 0)) || h >= 20 || h < 5; };   // сутрин; през деня — през ден; нощна смяна
  function update(dt) {
    if (!active()) { if (truck) truck.visible = false; return; }
    if (!truck && !spawn()) return; if (!route && !(route = buildRoute())) return; truck.visible = true;
    const n = deps.night(), t = performance.now() / 1000;
    for (const b of beacons) { const on = (stopT > 0 || n > 0.2) && (t * 2.2 + (/_R/.test(b.name) ? 0.5 : 0)) % 1 < 0.5; b.material.emissiveIntensity = on ? 6 : 0.2; }
    if (stopT > 0) {   // събиране: капакът нагоре (0–2 s), задържа, надолу (3–5 s); кофата изчезва в средата
      stopT -= dt; const k = STOP - stopT, a = k < 2 ? k / 2 : k < 3 ? 1 : Math.max(0, (STOP - k) / 2); if (lift) lift.rotation.x = 0.7 * a;
      if (bin && k > 2.5) { bin.parent && bin.parent.remove(bin); bin = null; }
      if (stopT <= 0 && lift) lift.rotation.x = 0; return; }
    let step = V * dt; while (step > 0 && seg < route.length - 1) { const a = route[seg], b = route[seg + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (along + step < L) { along += step; run += step; step = 0; } else { step -= L - along; run += L - along; seg++; along = 0; } }
    if (seg >= route.length - 1) { route = buildRoute(); seg = 0; along = 0; return; }   // краят на маршрута — нов
    const a = route[seg], b = route[seg + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, x = a[0] + (b[0] - a[0]) * along / L, z = a[1] + (b[1] - a[1]) * along / L;
    truck.position.set(x, 0, z); truck.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); spinWheels(truck);
    if (run >= EVERY) {   // спирка: кофата — до бордюра вдясно, зад кабината
      run = 0; stopT = STOP; const rx = Math.cos(truck.rotation.y), rz = -Math.sin(truck.rotation.y), bx = Math.sin(truck.rotation.y), bz = Math.cos(truck.rotation.y);
      bin = new THREE.Mesh(binGeo, binMat); bin.position.set(x + rx * -2.2 - bx * 4, 0, z + rz * -2.2 - bz * 4); bin.castShadow = true; deps.group().add(bin); }
  }
  function clear() { if (truck && truck.parent) truck.parent.remove(truck); if (bin && bin.parent) bin.parent.remove(bin); truck = null; bin = null; route = null; }
  return { update, clear, stopNow: () => { run = EVERY; }, info: () => ({ on: !!truck && truck.visible, seg, n: route ? route.length : 0, stop: +stopT.toFixed(1), pos: truck ? [Math.round(truck.position.x), Math.round(truck.position.z)] : null }) };
}
