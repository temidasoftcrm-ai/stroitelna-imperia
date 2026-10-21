// railx.js — 🚦 прелези и тунели на жп линията през града (Лабораторията → rail-crossings).
//  • прелез — където улица пресича коловозите: от двете страни стълб с две червени лампи (мигат на смени) и бариера;
//    ~8 s преди влака бариерите се спускат и лампите мигат, след като влакът мине — вдигат се; колите спират пред тях (traffic.js → blockers);
//  • тунел — в двата края на коловозите (до ръба на земята): бетонен портал и насип, влаковете се появяват и изчезват в него, не на рязко прекъснати релси.
// deps: { group, crossings: [{ x, z, ang (посоката на улицата), w (ширина) , x0, x1 (коловозите) }], portals: [{ z, x0, x1, dir }],
//         trains() → [{ z, len, v }] (по оста z на линията), bell(on) (звук, по желание) }
import * as THREE from 'three';

const WARN = 7, CLEAR = 2, ARM_SPEED = 1.2;   // s преди влака; s след него; rad/s
const M = {
  post: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 }),
  armW: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
  armR: new THREE.MeshStandardMaterial({ color: 0xd22a2a, roughness: 0.5 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x9b978e, roughness: 0.95 }),
  earth: new THREE.MeshStandardMaterial({ color: 0x6f8a4f, roughness: 1 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x050505 }),
};
const lamp = () => new THREE.MeshStandardMaterial({ color: 0x400808, emissive: 0xff2010, emissiveIntensity: 0.05, roughness: 0.4 });

// стълб с кръст „St. Andrew“, две лампи и бариера (рамото е в отделна група — върти се около оста)
function crossingPost(w) {
  const g = new THREE.Group(), add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 10), M.post, 0, 1.7, 0);
  for (const s of [1, -1]) { const x = add(new THREE.BoxGeometry(1.25, 0.16, 0.04), M.armW, 0, 3.15, 0.08); x.rotation.z = s * Math.PI / 4; }   // кръстът
  add(new THREE.BoxGeometry(0.95, 0.42, 0.12), M.dark, 0, 2.45, 0.08);
  const L = [-0.27, 0.27].map(x => { const m = add(new THREE.CircleGeometry(0.15, 16), lamp(), x, 2.45, 0.15); return m; });
  // бариерата: кутия с противотежест и рамо над пътя (по −x на групата), бели/червени ивици
  add(new THREE.BoxGeometry(0.5, 0.9, 0.5), M.post, 0.45, 0.45, -0.5);
  const arm = new THREE.Group(); arm.position.set(0.45, 1.0, -0.5); g.add(arm);
  const len = Math.max(3, w), n = Math.max(3, Math.round(len / 0.9));
  for (let k = 0; k < n; k++) { const o = new THREE.Mesh(new THREE.BoxGeometry(len / n, 0.1, 0.08), k % 2 ? M.armW : M.armR); o.position.set(-(k + 0.5) * len / n, 0, 0); o.castShadow = true; arm.add(o); }
  arm.rotation.z = -Math.PI / 2 + 0.05;   // вдигната
  g.userData = { L, arm, down: 0 };
  return g;
}

// бетонен портал с отвор над коловозите + насип (тревист клин), който закрива линията след него
function portal(x0, x1, dir) {
  const g = new THREE.Group(), W = x1 - x0 + 6, H = 8, cx = (x0 + x1) / 2;
  const face = new THREE.Mesh(new THREE.BoxGeometry(W + 4, H + 2, 1.6), M.concrete); face.position.set(cx, (H + 2) / 2, 0); face.castShadow = true; g.add(face);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.5, H - 2.5), M.hole); hole.position.set(cx, (H - 2.5) / 2, -dir * 0.82); hole.rotation.y = dir > 0 ? Math.PI : 0; g.add(hole);   // към града
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 1.5, H - 2.5, 14), M.hole); inner.position.set(cx, (H - 2.5) / 2, dir * 7.5); g.add(inner);   // тъмният тунел — влаковете изчезват в него
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.9, W * 1.6, H + 4, 6, 1, false), M.earth); mound.scale.set(1, 1, 1.3); mound.position.set(cx, (H + 4) / 2 - 0.5, dir * (W * 1.6 * 1.3 + 0.5)); mound.castShadow = mound.receiveShadow = true; g.add(mound);   // насипът започва точно зад портала
  return g;
}

export function createRailX(deps) {
  const root = new THREE.Group(); root.name = 'railx'; deps.group.add(root);
  const xs = (deps.crossings || []).map(c => {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.ang; root.add(g);
    // по оста на улицата (+x на групата) линията е по средата; стълбовете — от дясната страна на всеки подход, бариерата затваря неговата лента
    const half = (c.x1 - c.x0) / 2 + 4, w = c.w || 7, posts = [];
    for (const s of [1, -1]) { const p = crossingPost(w / 2 + 0.3); p.position.set(s * half, 0, s * (w / 2 + 0.9)); p.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(p); posts.push(p); }
    return { c, g, posts, on: false, t: 0, block: [-1, 1].map(s => { const v = new THREE.Vector3(s * (half + 1.5), 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.ang); return { x: c.x + v.x, z: c.z + v.z }; }) };
  });
  for (const p of deps.portals || []) { const g = portal(p.x0, p.x1, p.dir); g.position.z = p.z; root.add(g); }
  let bellOn = false;
  function update(dt) {
    const T = deps.trains ? deps.trains() : [], now = performance.now() / 1000;
    let anyOn = false;
    for (const X of xs) {
      // влак в зоната: главата ще стигне прелеза до WARN s, или опашката още не го е подминала (+CLEAR s)
      const near = T.some(t => { const v = Math.max(4, Math.abs(t.v || 12)), d = (X.c.z - t.z) * Math.sign(t.v || 1); return d > -t.len - v * CLEAR && d < v * WARN + t.len * 0.5; });
      if (near) X.t = 2; else X.t = Math.max(0, X.t - dt);   // кратко задържане, без трепкане
      X.on = X.t > 0; anyOn = anyOn || X.on;
      const blink = Math.floor(now * 2.2) % 2;
      for (const p of X.posts) {
        const u = p.userData, tgt = X.on ? 1 : 0; u.down += Math.sign(tgt - u.down) * Math.min(Math.abs(tgt - u.down), dt * ARM_SPEED);
        u.arm.rotation.z = -Math.PI / 2 + 0.05 + u.down * (Math.PI / 2 - 0.05);
        u.L.forEach((m, i) => { m.material.emissiveIntensity = X.on && (i === blink) ? 3.2 : 0.05; });
      }
    }
    if (anyOn !== bellOn) { bellOn = anyOn; deps.bell && deps.bell(anyOn); }
  }
  // точките, пред които колите спират (traffic.js): прелезите с включени светлини
  const blockers = () => xs.filter(X => X.on).flatMap(X => X.block);
  const dispose = () => { deps.group.remove(root); };
  return { update, blockers, dispose, list: () => xs.map(X => ({ x: X.c.x, z: X.c.z, ang: X.c.ang, on: X.on })), count: () => ({ crossings: xs.length, portals: (deps.portals || []).length, on: xs.filter(X => X.on).length }) };
}
