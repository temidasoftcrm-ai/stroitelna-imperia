// markets.js — 🍉 markets (f9): сергии и кафенета с чадъри около площада. Евтино — инстанции (по една InstancedMesh на част).
// Сергия: плот, четири стълбчета, раиран навес (цветът — по сергията), щайги с плодове/зеленчуци. Кафене: кръгла масичка, 4 стола, голям чадър.
// build(spots) — spots: [{ x, z, rot, kind: 'stall' | 'cafe' }]; dispose()
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// сергиите от Sketchfab (kiselevmiki, CC-BY): „market stall“ (stall-a — раиран навес, плодове, бъчва, табелка) и „stand“ (stall-b — зелен навес, щайги,
// висящи банани, дини на бъчва, черна дъска) — през една; веднъж за всички, по инстанция на част; дотогава — от кутийки
const stallP = {};
const stallModel = f => stallP[f] || (stallP[f] = new GLTFLoader().loadAsync('assets/heavy/markets/' + f).then(gl => { const parts = []; gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if (o.isMesh) parts.push([o.geometry.clone().applyMatrix4(o.matrixWorld), o.material]); }); return parts; }).catch(() => null));

const AWN = [[0xd23b3b, 0xf4efe6], [0x2f7d4f, 0xf4efe6], [0x2b5fa8, 0xf4efe6], [0xe39b2b, 0xf4efe6]];
const UMB = [0xb8342f, 0xf0e6d2, 0x2c6e8f, 0x6a8f3a, 0xd9a441];
const FRUIT = [0xd9342b, 0xf2b630, 0x6aa84f, 0xe56b1f, 0x8e44ad, 0xf4d03f];
let stripeTex = null;
function stripes() {
  if (stripeTex) return stripeTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#9a9a9a'; g.fillRect(i * 8, 0, 8, 8); }
  stripeTex = canvasTex(c); stripeTex.colorSpace = THREE.SRGBColorSpace; return stripeTex;
}
export function buildMarket(spots) {
  const g = new THREE.Group(); g.name = 'markets';
  const st = spots.filter(s => s.kind === 'stall'), cf = spots.filter(s => s.kind === 'cafe');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const im = (geo, mat, n, cast = true) => { const o = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); o.count = 0; o.castShadow = cast; o.receiveShadow = true; g.add(o); return o; };
  const put = (o, x, y, z, rot, sx = 1, sy = 1, sz = 1, c) => { q.setFromAxisAngle(up, rot); m4.compose(v.set(x, y, z), q, sc.set(sx, sy, sz)); o.setMatrixAt(o.count, m4); if (c != null) o.setColorAt(o.count, col.setHex(c)); o.count++; };
  const W = (s, a, b) => [s.x + Math.cos(s.rot) * a + Math.sin(s.rot) * b, s.z - Math.sin(s.rot) * a + Math.cos(s.rot) * b];   // местни a (по фронта), b (навътре)
  // ---- сергиите
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
  const counter = im(box, wood, st.length), posts = im(box, wood, st.length * 4), awn = im(new THREE.BoxGeometry(1, 0.06, 1), new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.8 }), st.length);
  const crate = im(box, new THREE.MeshStandardMaterial({ color: 0xb0875a, roughness: 0.9 }), st.length * 6), fruit = im(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.7 }), st.length * 6, false);
  const boxStall = [counter, posts, awn, crate, fruit];
  if (st.length) Promise.all([stallModel('stall-a.glb'), stallModel('stall-b.glb')]).then(([pa, pb]) => { if (!(pa || pb) || !g.parent) return;   // истинските сергии — вместо кутийките
    for (const [i, parts] of [[0, pa || pb], [1, pb || pa]]) { const L = st.filter((s, k) => k % 2 === i); if (!L.length) continue;
      for (const [geo, mat] of parts) { const o = im(geo.clone(), mat, L.length);   /* clone — dispose() не трябва да чисти общия модел */ L.forEach(s => put(o, s.x, 0, s.z, s.rot)); o.instanceMatrix.needsUpdate = true; } }
    for (const o of boxStall) o.visible = false; });
  st.forEach((s, k) => {
    put(counter, s.x, 0, s.z, s.rot, 2.8, 0.9, 1.1);
    for (const [a, b] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.7], [1.4, 0.7]]) { const [x, z] = W(s, a, b); put(posts, x, 0, z, s.rot, 0.07, 2.4, 0.07); }
    const [ax, az] = W(s, 0, 0.05); put(awn, ax, 2.4, az, s.rot, 3.2, 1, 1.7, AWN[k % AWN.length][0]);
    for (let i = 0; i < 6; i++) { const a = -1.1 + (i % 3) * 1.1, b = i < 3 ? 0.25 : -0.2, [x, z] = W(s, a, b); put(crate, x, 0.9, z, s.rot, 0.8, 0.22, 0.42); put(fruit, x, 1.12, z, 0, 0.62, 0.2, 0.34, FRUIT[(k * 3 + i) % FRUIT.length]); }
  });
  // ---- кафенетата
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.5, roughness: 0.5 });
  const top = im(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 14), new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.6 }), cf.length * 2), leg = im(new THREE.CylinderGeometry(0.04, 0.05, 1, 6).translate(0, 0.5, 0), metal, cf.length * 3);
  const seat = im(new THREE.BoxGeometry(0.42, 0.05, 0.42), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8 }), cf.length * 8), back = im(new THREE.BoxGeometry(0.42, 0.42, 0.04).translate(0, 0.21, 0), new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8 }), cf.length * 8);
  const umb = im(new THREE.ConeGeometry(1.7, 0.6, 8, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), cf.length);
  cf.forEach((s, k) => {
    for (const [a, b] of [[-0.7, 0], [0.7, 0]]) { const [x, z] = W(s, a, b); put(top, x, 0.74, z, 0); put(leg, x, 0, z, 0, 1, 0.74, 1);
      for (const [da, db, r] of [[0, -0.6, 0], [0, 0.6, Math.PI], [-0.6, 0, Math.PI / 2], [0.6, 0, -Math.PI / 2]]) { const [cx, cz] = W(s, a + da, b + db); put(seat, cx, 0.45, cz, s.rot + r); const [bx, bz] = W(s, a + da * 1.35, b + db * 1.35); put(back, bx, 0.47, bz, s.rot + r); } }
    put(leg, s.x, 0, s.z, 0, 1.2, 2.5, 1.2); put(umb, s.x, 2.55, s.z, s.rot, 1, 1, 1, UMB[k % UMB.length]);
  });
  for (const o of g.children) { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; }
  return { group: g, dispose() { g.parent && g.parent.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } };
}
