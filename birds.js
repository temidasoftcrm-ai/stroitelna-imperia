// birds.js — 🐦 birds (f9): ята птици — гълъби по площадите, чайки над морето в крайморските градове. Евтино: една InstancedMesh
// на вид (тяло + криле във формата на V; махането — скалата по y на инстанцията обръща върховете на крилете нагоре/надолу).
// Гълъбите стоят на земята и кълват; щом камерата се приближи (или от време на време) — излитат, кръжат и пак кацат.
// Чайките кръжат над водата. Само близо до камерата (R м); нощем гълъбите спят (скрити), чайките — също.
// const b = createBirds({ parent, sites() → [{ x, z, kind: 'pigeon'|'gull' }], hour(), on() });  b.update(dt, camera);  b.clear()
import * as THREE from 'three';

const R = 260, N = { pigeon: 22, gull: 12 };
function birdGeo(span) {   // V: тялото в центъра, върховете на крилете — с y = 1 (скалата по y ги вдига/сваля)
  const s = span / 2, g = new THREE.BufferGeometry();
  const v = [ /* ляво крило */ 0, 0, 0.12, -s, 1, -0.05, 0, 0, -0.12, /* дясно */ 0, 0, -0.12, s, 1, -0.05, 0, 0, 0.12, /* тяло */ 0, -0.04, 0.22, 0.05, 0, -0.18, -0.05, 0, -0.18];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g;
}
export function createBirds(deps) {
  const flocks = new Map(), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(), E = new THREE.Euler();
  const key = s => s.kind + ':' + Math.round(s.x) + ':' + Math.round(s.z);
  function make(s) {
    const gull = s.kind === 'gull', n = N[s.kind], mat = new THREE.MeshStandardMaterial({ color: gull ? 0xf4f5f6 : 0x7f8590, roughness: 0.9, side: THREE.DoubleSide });
    const im = new THREE.InstancedMesh(birdGeo(gull ? 1.5 : 0.8), mat, n); im.frustumCulled = false; im.castShadow = false; deps.parent().add(im);
    const b = []; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 2 + Math.random() * 7;
      b.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, y: gull ? 14 + Math.random() * 10 : 0.12, yaw: Math.random() * 6.28, ph: Math.random() * 6.28, ang: Math.random() * 6.28, rad: 14 + Math.random() * 12, h: 10 + Math.random() * 12, sp: 0.35 + Math.random() * 0.2, peck: Math.random() * 3 }); }
    return { s, im, b, gull, state: gull ? 'fly' : 'ground', t: 0, next: 25 + Math.random() * 40 };
  }
  function drop(F) { F.im.parent && F.im.parent.remove(F.im); F.im.geometry.dispose(); F.im.material.dispose(); }
  function step(F, dt, cam) {
    const { s, b } = F; F.t += dt;
    const near = Math.hypot(cam.position.x - s.x, cam.position.z - s.z) < 32 && cam.position.y < 40;
    if (!F.gull) {   // гълъбите: земя ↔ полет
      if (F.state === 'ground' && (near || F.t > F.next)) { F.state = 'fly'; F.t = 0; F.next = 14 + Math.random() * 12; for (const q of b) { q.ang = Math.atan2(q.z - s.z, q.x - s.x); q.lift = 0; } }
      else if (F.state === 'fly' && F.t > F.next && !near) { F.state = 'land'; F.t = 0; }
      else if (F.state === 'land' && F.t > 6) { F.state = 'ground'; F.t = 0; F.next = 30 + Math.random() * 60; }
    }
    b.forEach((q, i) => {
      let flap = 0.05, x = q.x, y = q.y, z = q.z, yaw = q.yaw;
      if (F.state === 'ground') { q.peck -= dt; if (q.peck < 0) { q.peck = 1 + Math.random() * 3; q.yaw += (Math.random() - 0.5) * 1.5; } const hop = q.peck > 0.9 ? 0 : 0; y = 0.12 + hop; }
      else {   // кръжене около мястото; излитане — нагоре; кацане — към стария си пункт
        q.ang += q.sp * dt * (F.gull ? 0.6 : 1); const tx = s.x + Math.cos(q.ang) * q.rad, tz = s.z + Math.sin(q.ang) * q.rad;
        if (F.state === 'land') { const k = Math.min(1, F.t / 6); x = tx + (q.x - tx) * k; z = tz + (q.z - tz) * k; y = q.h * (1 - k) + 0.12 * k; }
        else { q.lift = Math.min(1, (q.lift ?? 1) + dt * 0.5); x = tx; z = tz; y = 0.12 + q.h * q.lift; }
        yaw = Math.atan2(-Math.sin(q.ang), Math.cos(q.ang)) + Math.PI / 2;
        flap = F.gull ? 0.25 + 0.2 * Math.sin(F.t * 3 + q.ph) : Math.sin(F.t * 14 + q.ph) * 0.45;   // чайките — плавно, гълъбите — бързо
      }
      if (F.state === 'ground') { x = q.x; z = q.z; }
      Q.setFromEuler(E.set(0, yaw, 0)); M4.compose(V.set(x, y, z), Q, Sc.set(1, flap || 0.05, 1)); F.im.setMatrixAt(i, M4);
    });
    F.im.instanceMatrix.needsUpdate = true;
  }
  function update(dt, cam) {
    if (!deps.on() || !cam) { clear(); return; }
    const h = deps.hour(), day = h >= 6.5 && h <= 20.5, want = new Map();
    if (day) for (const s of deps.sites()) if (Math.hypot(s.x - cam.position.x, s.z - cam.position.z) < R) want.set(key(s), s);
    for (const [k, F] of flocks) if (!want.has(k)) { drop(F); flocks.delete(k); }
    for (const [k, s] of want) if (!flocks.has(k)) flocks.set(k, make(s));
    const d = Math.min(0.1, dt); for (const F of flocks.values()) step(F, d, cam);
  }
  function clear() { for (const F of flocks.values()) drop(F); flocks.clear(); }
  return { update, clear, info: () => [...flocks.values()].map(F => ({ kind: F.s.kind, x: Math.round(F.s.x), z: Math.round(F.s.z), state: F.state })) };
}
