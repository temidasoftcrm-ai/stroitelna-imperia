// portreal.js — истинските модели на пристанището (seaside.js, флаг port-real в Лабораторията) вместо кутиите:
// портални кранове STS на кея, фар, тухлен склад, зърнен терминал, козлови кранове над контейнерите, страдъл карите,
// които разнасят контейнери, и от време на време яхта, която минава през залива.
// Моделите — Sketchfab (CC-BY, авторите в CREDITS.txt), assets/heavy/port; яхтите — assets/heavy/marina.
// Процедурните остават, докато моделите се заредят (и ако не се заредят) — тук само се скриват кутиите им.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = 'assets/heavy/port/';
const cache = {};
const load = f => cache[f] || (cache[f] = new Promise(res => new GLTFLoader().load(f, gl => { gl.scene.updateMatrixWorld(true); res(gl.scene); }, undefined, e => { console.warn('portreal', f, e); res(null); })));
const box = o => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };
const isBox = m => m.isMesh && m.geometry?.type === 'BoxGeometry';
const isCyl = m => m.isMesh && m.geometry?.type === 'CylinderGeometry';

// копие на модела: сенки; металът — по-матов (без огледална среда излиза черен)
function prep(src) {
  const o = src.clone(true);
  o.traverse(m => {
    if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const mt = m.material;
    if (mt && mt.metalness > 0.5) { m.material = mt.clone(); m.material.metalness = 0.3; m.material.roughness = Math.max(mt.roughness ?? 0.5, 0.55); }
  });
  return o;
}
// в група с основата на y = 0, центъра в (0, 0); дългата ос — по x (alongX) или по z; мащаб — по дължина (len) или височина (h)
function fit(src, { len, h, alongX = true }) {
  const w = new THREE.Group(), inner = new THREE.Group(); inner.add(prep(src)); w.add(inner);
  let s = box(inner).getSize(new THREE.Vector3());
  if ((s.x >= s.z) !== alongX) { inner.rotation.y = Math.PI / 2; s = box(inner).getSize(new THREE.Vector3()); }
  inner.scale.setScalar(h ? h / s.y : len / Math.max(s.x, s.z));
  const b = box(inner), c = b.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -b.min.y, -c.z);
  return w;
}
// кранът STS: краката му (долните 15% от височината) — в (0, 0), стрелата — към морето (−z), дълга до tip
function fitSTS(src, tip) {
  const w = new THREE.Group(), inner = new THREE.Group(); inner.add(prep(src)); w.add(inner);
  let s = box(inner).getSize(new THREE.Vector3());
  if (s.x > s.z) { inner.rotation.y = Math.PI / 2; s = box(inner).getSize(new THREE.Vector3()); }
  const lo = (b => { const v = new THREE.Vector3(), L = []; inner.updateMatrixWorld(true); inner.traverse(m => { if (!m.isMesh) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i += 5) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); if (v.y < b.min.y + s.y * 0.15) L.push(v.clone()); } }); return new THREE.Box3().setFromPoints(L).getCenter(new THREE.Vector3()); })(box(inner));
  let b = box(inner);
  if (b.max.z - lo.z > lo.z - b.min.z) { inner.rotation.y += Math.PI; lo.x = -lo.x; lo.z = -lo.z; b = box(inner); }   // стрелата — към −z
  const k = tip / (lo.z - b.min.z); inner.scale.multiplyScalar(k); b = box(inner);
  inner.position.set(-lo.x * k, -b.min.y, -lo.z * k);
  return w;
}

// дължина на яхтите (по x) и колко газят (част от височината на корпуса); платноходката — мачтата не се брои
const YACHTS = [['superyacht', 46, 0.1], ['sportyacht', 18, 0.2], ['motoryacht', 24, 0.2, /^water/], ['sailboat', 14, 0.06]];

// P: { g, lvG, cranes, tower, lamp, px, seaZ, pierZ, x0, x1, seed, yard } — от addSeaside; връща update(t, night)
export function portReal(P) {
  const { g, lvG, px, seaZ } = P, st = { straddles: [], yachts: [], night: [] };
  const F = ['sf-stscrane', 'sf-lighthouse', 'sf-warehouse', 'sf-grain', 'sf-gantry', 'sf-straddle'];
  Promise.all(F.map(f => load(BASE + f + '.glb'))).then(([sts, lh, wh, grain, gantry, straddle]) => {
    // кранове STS: кутиите се скриват, моделът — в групата на крана; светлините (сферите) — на върха и на края на стрелата
    if (sts) for (const c of P.cranes) {
      const kids = [...c.children]; let tip = 0;
      for (const m of kids) if (isBox(m)) { m.visible = false; tip = Math.max(tip, -(m.position.z - m.geometry.parameters.depth / 2)); }
      const o = fitSTS(sts, tip || 37), top = box(o).max.y; c.add(o);
      const bc = kids.filter(m => m.isMesh && m.geometry?.type === 'SphereGeometry');
      if (bc[0]) bc[0].position.set(0, top + 0.6, 0);
      if (bc[1]) bc[1].position.set(0, top - 1, -(tip || 37) + 1);
    }
    // фарът: сегментите се скриват; лампата и лъчът — в стъклената кула на модела (~ 80% от височината)
    if (lh && P.tower) {
      for (const m of P.tower.children) if (isCyl(m) && m !== P.lamp) m.visible = false;
      const H = 26, o = fit(lh, { h: H }); P.tower.add(o);
      const y = H * 0.8; if (P.lamp) { P.lamp.position.y = y; P.lamp.scale.setScalar(0.8); } if (P.beam) P.beam.position.y = y;
    }
    // складовете (ниво 2): тухлената сграда вместо двете кутии
    if (wh) for (const m of [...lvG[2].children]) if (isBox(m) && m.geometry.parameters.width === 26) {
      m.visible = false; const o = fit(wh, { len: 28 }); o.position.set(m.position.x, 1.2, m.position.z); lvG[2].add(o);
    } else if (isBox(m) && m.geometry.parameters.height === 0.8) m.visible = false;   // покривите на кутиите
    // зърненият терминал (ниво 5) вместо трите силоза — на брега, по дължина на кея
    if (grain) {
      const sil = lvG[4].children.filter(isCyl); sil.forEach(m => { m.visible = false; });
      if (sil.length && P.yard) {   // port-real: на разширението (ниво 4+), към сушата от червените кранове — не на пътя и кръговото (беше на seaZ + 8)
        const o = fit(grain, { len: 42 }); o.position.set(px - 90, 1.2, seaZ - 15); lvG[4].add(o);
        o.traverse(m => { if (m.isMesh && m.material && m.material.name === 'NightLight') { m.material = m.material.clone(); st.night.push(m.material); } });   // прожекторите по кулата — нощем
      } else if (sil.length) { const o = fit(grain, { len: 40 }), x = sil.reduce((a, m) => a + m.position.x, 0) / sil.length; o.position.set(x - 6, 1.2, seaZ + 8); lvG[4].add(o); }
    }
    // козлов кран над двата реда контейнери на разширението (ниво 5): релсите — по x, отворът — над редовете
    if (gantry) { const o = fit(gantry, { len: 40 }); if (P.yard) o.position.set(P.yard.gx, 1.2, P.yard.gz); else o.position.set(px - 90, 1.2, seaZ - 19.5); lvG[4].add(o); }   // port-real: над блока на платформата
    // страдъл карите: обикалят по кея (от ниво 1) — бавно напред-назад между крановете и складовете
    if (straddle) for (let k = 0; k < 2; k++) {
      const o = fit(straddle, { h: 10 }); (P.yard ? lvG[1] : lvG[0]).add(o);   // port-real: по платната на контейнерната платформа (ниво 2+), не между складовете
      st.straddles.push(P.yard ? { o, x0: P.yard.sx, z: P.yard.sz[k], ph: k * 2.1 } : { o, x0: px - 40 + k * 30, z: seaZ - 22 - k * 12, ph: k * 2.1 });
    }
  });
  // яхтите: една по една, през залива (от запад на изток или обратно), с пауза между тях
  Promise.all(YACHTS.map(([k]) => load('assets/heavy/marina/' + k + '.glb'))).then(S => {
    S.forEach((src, i) => {
      if (!src) return; const [k, len, sink, skip] = YACHTS[i], o = src.clone(true), drop = [];
      o.traverse(m => { if (!m.isMesh) return; if (skip && skip.test(m.material?.name || '')) drop.push(m); else m.castShadow = true; });
      drop.forEach(m => m.parent.remove(m));
      const w = fit(o, { len, alongX: true }), b = box(w), hull = (b.max.y - b.min.y) * (k === 'sailboat' ? 0.12 : 1);
      w.children[0].position.y -= hull * sink;
      const y = new THREE.Group(); y.add(w); y.visible = false; (P.yg || g).add(y);   /* yg — sea-coast: яхтите в морето, не в завъртяната група на пристанището */
      st.yachts.push({ o: y, i });
    });
  });
  const span = P.x1 - P.x0, PER = 150;   // всяка яхта — веднъж на PER·броя секунди; пресичането — ~100 с
  return function update(t, night = 0) {
    for (const m of st.night) m.emissiveIntensity = 0.2 + night * 6;
    for (const s of st.straddles) {
      const u = Math.sin(t * 0.08 + s.ph); s.o.position.set(s.x0 + u * 26, 1.2, s.z); s.o.rotation.y = Math.cos(t * 0.08 + s.ph) > 0 ? 0 : Math.PI;
    }
    const n = st.yachts.length; if (!n) return;
    const cyc = Math.floor(t / PER), k = (t % PER) / PER, cur = st.yachts[cyc % n];
    for (const y of st.yachts) y.o.visible = false;
    if (k < 0.7) {   // 70% от цикъла — минава, после празен залив
      const dir = cyc % 2 ? -1 : 1, u = k / 0.7, x = P.x0 + span * (dir > 0 ? u : 1 - u);
      cur.o.visible = true; cur.o.position.set(x, Math.sin(t * 0.9) * 0.15, (P.ySeaZ ?? seaZ) - 150 - (cyc % 3) * 40); cur.o.rotation.y = dir > 0 ? 0 : Math.PI;
    }
  };
}
