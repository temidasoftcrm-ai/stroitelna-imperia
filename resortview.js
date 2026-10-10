// resortview.js — 3D изглед на курорт (Фаза 5): летен — море, пясък, чадъри, палми; зимен — сняг, борове, ски писта
// с лифт. Вилното селище се вижда според етапа: празен парцел → строеж (вилите растат) → готово (басейн, алеи).
// Извън сезона: плажът е празен (затворени чадъри), а зимният курорт е зелен, без сняг.
import * as THREE from 'three';
import { EXTRAS } from './resorts.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647);

// дървена хижа от модулите на Kenney Holiday Kit: W×D клетки, стени с прозорци и врата, двускатен заснежен покрив.
// Клетката е 1×1 (стената е на ръба +z на клетката); s = метри на клетка.
export const CHALET_PIECES = ['cabin-wall', 'cabin-corner-logs', 'cabin-window-a', 'cabin-window-large', 'cabin-doorway', 'cabin-door-rotate',
  'cabin-roof-snow', 'cabin-roof-snow-chimney', 'cabin-wall-roof', 'cabin-roof-top', 'floor-wood-snow'];
export function buildChalet(A, model, s = 3.2, seed = 1) {
  const g = new THREE.Group(), W = 2, D = 3;
  const put = (n, x, z, ry, y = 0) => { if (!A[n]) return; const o = model(n, 1); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); };
  const cx = i => i - W / 2 + 0.5, cz = j => j - D / 2 + 0.5;   // център на клетка
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) put('floor-wood-snow', cx(i), cz(j), 0);
  // стени: отпред (z+) врата и прозорец, отстрани прозорци, отзад плътно
  for (let i = 0; i < W; i++) {
    put(i === 0 ? 'cabin-doorway' : 'cabin-window-large', cx(i), cz(D - 1), 0);
    if (i === 0) put('cabin-door-rotate', cx(i), cz(D - 1), 0);
    put('cabin-wall', cx(i), cz(0), Math.PI);
  }
  for (let j = 0; j < D; j++) {
    const n = j === 1 ? 'cabin-window-a' : 'cabin-wall';
    put(n, cx(0), cz(j), -Math.PI / 2);
    put(n, cx(W - 1), cz(j), Math.PI / 2);
  }
  // ъгли
  put('cabin-corner-logs', cx(0), cz(D - 1), 0);
  put('cabin-corner-logs', cx(W - 1), cz(D - 1), Math.PI / 2);
  put('cabin-corner-logs', cx(W - 1), cz(0), Math.PI);
  put('cabin-corner-logs', cx(0), cz(0), -Math.PI / 2);
  // фронтони над стените (отпред и отзад)
  for (let i = 0; i < W; i++) {
    put('cabin-wall-roof', cx(i), cz(D - 1), 0, 1);
    put('cabin-wall-roof', cx(i), cz(0), Math.PI, 1);
  }
  // двускатен покрив: билото е по оста x = 0, всяка половина пада навън
  for (let j = 0; j < D; j++) {
    put(j === 1 && seed % 2 ? 'cabin-roof-snow-chimney' : 'cabin-roof-snow', cx(W - 1), cz(j), 0, 1);
    put('cabin-roof-snow', cx(0), cz(j), Math.PI, 1);
    put('cabin-roof-top', 0, cz(j), 0, 2.3);
  }
  g.scale.setScalar(s);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// шумна текстура (трева/пясък/сняг): различни петна, за да не е земята еднаква
function noiseTex(base, spread, n = 2600, rep = 60) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), col = new THREE.Color(base);
  g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, 256, 256);
  const t = new THREE.Color();
  for (let k = 0; k < n; k++) {
    t.copy(col).offsetHSL((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * spread);
    g.fillStyle = '#' + t.getHexString(); const s = 1 + Math.random() * 4; g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep, rep); tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
// небе: голяма полусфера с преливане от хоризонта (horizon) към зенита (zenith); не се влияе от мъглата
function skyDome(zenith, horizon) {
  const geo = new THREE.SphereGeometry(1900, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15);
  const cz = new THREE.Color(zenith), ch = new THREE.Color(horizon), cols = [], p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, Math.min(1, p.getY(i) / 700)); const c = ch.clone().lerp(cz, Math.pow(k, 0.6)); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}
const bush = (c, s) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })); m.scale.y = 0.7; m.castShadow = true; return m; };
// лодка: корпус, кабина и мачта (за летните курорти, докато няма модели)
function boatMesh(col, sail) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.9, 7, 8, 1).rotateX(Math.PI / 2).scale(1, 0.45, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  hull.position.y = 0.4; g.add(hull);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 0.92, 7.02, 8, 1).rotateX(Math.PI / 2).scale(1, 0.12, 1), new THREE.MeshStandardMaterial({ color: col })); stripe.position.y = 0.55; g.add(stripe);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.4), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })); cab.position.set(0, 1.1, 0.6); g.add(cab);
  if (sail) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); mast.position.set(0, 4.6, -0.4); g.add(mast);
    const sl = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.2, -0.4), new THREE.Vector3(0, 8.4, -0.4), new THREE.Vector3(0, 1.2, -3.2)]), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    sl.geometry.computeVertexNormals(); g.add(sl);
  }
  return g;
}

// модел от заредените (A), ако го има; Nature Kit е „unlit“ — сменяме с осветени материали
function useModel(A, model, n, s) {
  if (!A[n]) return null;
  const o = model(n, s);
  o.traverse(m => { if (m.isMesh && m.material && m.material.isMeshBasicMaterial) { m.material = new THREE.MeshStandardMaterial({ color: m.material.color, map: m.material.map, roughness: 0.9 }); m.castShadow = true; } });
  return o;
}
// модели за курортите (зарежда ги game.js); всички са CC0 от Kenney
export const RESORT_MODELS = {
  watercraft: ['boat-sail-a', 'boat-sail-b', 'boat-speed-a', 'boat-speed-c', 'boat-fishing-small', 'buoy', 'boat-row-small'],
  commercial2: ['detail-parasol-a', 'detail-parasol-b'],
  nature: ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedTall', 'plant_bushLarge', 'rock_largeA', 'tree_pineTallA', 'tree_default_fall'],
  modular: ['building-sample-tower-a', 'building-sample-tower-c', 'building-sample-tower-d', 'building-sample-house-c'],
  suburban: ['building-type-k', 'building-type-n', 'building-type-o', 'building-type-s', 'building-type-t', 'building-type-u'],
};

// deps: { model(name, scale), houses: [имена], tintRoof(obj, seed), fitScale(name, size), label(text, color, w) }
// r: курортът от RESORTS; st: състоянието му ({ stage, prog } или undefined); season: 'summer' | 'winter' | 'off'
export function buildResortView(A, r, st, season, deps) {
  const g = new THREE.Group(), rand = rnd(7 + r.id.length * 131);
  const summer = r.kind === 'summer', spa = r.kind === 'spa', inSeason = spa || season === r.kind, snowy = r.kind === 'winter' && inSeason;
  const stage = st ? st.stage : null;
  const anim = { waves: null, foam: null, chairs: [], flakes: null, clip: null, crane: null, cranes: [] };

  // ---------- терен
  // небе и земя докъдето стига погледът (краищата изчезват в мъглата)
  const autumn = season === 'off', HOR = summer ? 0xcfe6f2 : snowy ? 0xdfe6ee : autumn ? 0xd8dccf : 0xcfe0e8;
  g.add(skyDome(summer ? 0x5fa8e8 : snowy ? 0x8fb2d8 : 0x7fb0e0, HOR));
  const grassC = snowy ? 0xf2f5f9 : autumn ? 0x9aa65a : 0x86ad5e;
  // земята: при морските курорти само откъм сушата (за да не закрива морето), иначе диск навсякъде
  const world = new THREE.Mesh(summer ? new THREE.PlaneGeometry(3400, 1700).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(1700, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: noiseTex(grassC, snowy ? 0.04 : 0.09, 2600, 160), roughness: 1 }));
  world.position.set(0, -0.06, summer ? 88 + 850 : 0); world.receiveShadow = true; g.add(world);
  if (summer) {
    // пясъкът: широка ивица по цялата брегова линия, с дюни и храсти към тревата
    // пясъкът: от водата (z −48) до тревата (z 90)
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(3400, 138), new THREE.MeshStandardMaterial({ map: noiseTex(0xe8d39a, 0.07, 2600, 120), roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 21); sand.receiveShadow = true; g.add(sand);
    // ниски дюни с храсти по границата с тревата
    for (let k = 0; k < 60; k++) {
      const x = -300 + k * 10 + rand() * 6, z = 88 + rand() * 4;
      const d = new THREE.Mesh(new THREE.SphereGeometry(2 + rand() * 2.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdcc68c)); d.scale.y = 0.3; d.position.set(x, -0.1, z); g.add(d);
      if (k % 2) { const b = bush(autumn ? 0x8d9446 : 0x5f8f3e, 1 + rand() * 0.8); b.position.set(x + rand() * 3, 0.5, z + 2 + rand() * 4); g.add(b); }
    }
    // Странджа: зелени хълмове зад курорта
    for (let k = 0; k < 14; k++) {
      const x = -700 + k * 105 + rand() * 40, z = 380 + rand() * 160, s = 70 + rand() * 80;
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: autumn ? 0x7f8a4a : k % 2 ? 0x5f8a44 : 0x6f9a4e, roughness: 1, flatShading: true }));
      h.scale.set(s, s * (0.3 + rand() * 0.25), s * 0.8); h.position.set(x, 0, z); g.add(h);
    }
    // гори и храсти по тревата
    for (let k = 0; k < 160; k++) {
      const x = (rand() - 0.5) * 900, z = 95 + rand() * 300;
      if (Math.abs(x) < 50 && z < 110) continue;
      const b = bush(k % 3 ? (autumn ? 0x9a8a3a : 0x4f7f34) : (autumn ? 0xb0763a : 0x6a9a44), 2 + rand() * 3); b.scale.y = 1.2; b.position.set(x, 1.5, z); g.add(b);
    }
    // море: голяма плоскост с вълни (върховете се движат в update), изчезва в мъглата
    // море: синьо, с по-светла плитка ивица до брега (цвят по върховете), без нищо под него
    const seaGeo = new THREE.PlaneGeometry(3400, 1500, 90, 60); seaGeo.rotateX(-Math.PI / 2);
    const deep = new THREE.Color(autumn ? 0x2a74ad : 0x2f86c8), shal = new THREE.Color(0x5fb6e0), sc = [], sp = seaGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) { const k = Math.max(0, Math.min(1, (sp.getZ(i) - 650) / 100)); const c = deep.clone().lerp(shal, k); sc.push(c.r, c.g, c.b); }
    seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0 }));
    sea.position.set(0, -0.05, -798); g.add(sea);
    anim.waves = { geo: seaGeo, base: Float32Array.from(seaGeo.attributes.position.array) };
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(3400, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.02, -49); g.add(foam); anim.foam = foam;
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(3400, 8), mat(0xc9b27a));
    wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.01, -46); g.add(wet);
    // дървена пътека през плажа и плажен бар
    const walk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 60), mat(0xa77b4f)); walk.position.set(30, 0.1, 15); g.add(walk);
    const bar = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(9, 1.3, 4), mat(0x9a6a3a)); counter.position.y = 0.65; bar.add(counter);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 2.5, 6), mat(0xd9b25a)); roof.position.y = 4.4; bar.add(roof);
    for (const [x, z] of [[-3.5, -1.5], [3.5, -1.5], [-3.5, 1.5], [3.5, 1.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4), mat(0x7a5530)); p.position.set(x, 1.7, z); bar.add(p); }
    const bsign = deps.label('🍹 БАР', '#ffffff', 5); bsign.position.y = 7; bar.add(bsign);
    bar.position.set(30, 0, -12); g.add(bar);
    // лодки и яхти в морето (люлеят се на вълните)
    anim.boats = [];
    const BM = ['boat-sail-a', 'boat-speed-a', 'boat-sail-b', 'boat-fishing-small', 'boat-speed-c', 'boat-row-small', 'boat-sail-a'];
    for (let k = 0; k < 7; k++) { const b = useModel(A, deps.model, BM[k], BM[k].includes('row') ? 1.4 : 2.2) || boatMesh([0x2b6fff, 0xd62828, 0x1f9a6a, 0xffb300][k % 4], k % 2 === 0); b.position.set(-200 + k * 60 + rand() * 20, 0, -100 - rand() * 160); b.rotation.y = rand() * 6; g.add(b); anim.boats.push({ b, ph: rand() * 6, x0: b.position.x, sp: 0.5 + rand() }); }
    // плаж: чадъри и шезлонги (в сезона отворени, иначе прибрани)
    const cols = [0xff5a5a, 0xffd23f, 0x3fa7ff, 0x50d18b, 0xff8ad8];
    for (let k = 0; k < 34; k++) {
      const x = -130 + (k % 17) * 16 + rand() * 4, z = -38 + Math.floor(k / 17) * 14 + rand() * 4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), mat(0xeeeeee)); pole.position.set(x, 1.5, z); g.add(pole);
      const pm = inSeason && useModel(A, deps.model, k % 2 ? 'detail-parasol-a' : 'detail-parasol-b', 9);
      if (pm) { pole.visible = false; pm.position.set(x, 0, z); pm.rotation.y = rand() * 6; g.add(pm); }
      else {
        const top = new THREE.Mesh(inSeason ? new THREE.ConeGeometry(2.2, 0.9, 10) : new THREE.CylinderGeometry(0.25, 0.35, 2.2, 8), mat(cols[k % cols.length]));
        top.position.set(x, inSeason ? 3.1 : 2.3, z); top.castShadow = true; g.add(top);
      }
      if (inSeason) for (const dx of [-1.3, 1.3]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 2), mat(0xffffff)); l.position.set(x + dx, 0.3, z + 1.6); l.castShadow = true; g.add(l);
      }
    }
    // палми по края на плажа
    for (let k = 0; k < 14; k++) {
      const x = -140 + k * 21 + rand() * 6, z = 2 + rand() * 6, h = 7 + rand() * 3;
      const pmod = useModel(A, deps.model, ['tree_palm', 'tree_palmBend', 'tree_palmTall', 'tree_palmDetailedTall'][k % 4], 7 + rand() * 2);
      if (pmod) { pmod.position.set(x, 0, z); pmod.rotation.y = rand() * 6; g.add(pmod); continue; }
      const palm = new THREE.Group();
      for (let s = 0; s < 6; s++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, h / 6, 7), mat(0x8a6a44)); seg.position.set(s * 0.12, h / 12 + s * h / 6, 0); palm.add(seg); }
      for (let f = 0; f < 7; f++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 4.5, 4).rotateX(Math.PI / 2).translate(0, 0, 2.2), mat(0x3f9a3a));
        leaf.position.set(0.7, h, 0); leaf.rotation.set(-0.5, f / 7 * Math.PI * 2, 0); palm.add(leaf);
      }
      palm.position.set(x, 0, z); palm.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(palm);
    }
    // спасителна кула и кей с лодка
    const tower = new THREE.Group();
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4), mat(0xffffff)); p.position.set(x, 2, z); tower.add(p); }
    const hut = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), mat(0xff3b3b)); hut.position.y = 4.8; tower.add(hut);
    tower.position.set(20, 0, -30); g.add(tower);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 40), mat(0x9a7448)); pier.position.set(-70, 0.4, -65); g.add(pier);
    const boat = boatMesh(0x2b6fff, false); boat.position.set(-64, 0, -78); g.add(boat); anim.boat = boat;
  } else {
    // далечни планини навсякъде около долината (за да няма празен хоризонт)
    for (let k = 0; k < 22; k++) {
      const a = k / 22 * Math.PI * 2, d = 520 + rand() * 260, s = 120 + rand() * 140;
      const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * (0.8 + rand() * 0.5), 7), new THREE.MeshStandardMaterial({ color: k % 2 ? 0x7d8a76 : 0x6b7a66, roughness: 1, flatShading: true }));
      m.position.set(Math.cos(a) * d, s * 0.35, Math.sin(a) * d - 120); g.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35, s * 0.35, 7), mat(0xf4f6f8)); cap.position.set(m.position.x, s * 0.35 + s * 0.3, m.position.z); g.add(cap);
    }
    // планини отзад, със ски писта и лифт на средната
    const mtns = [[-120, -170, 70, 95], [0, -190, 90, 130], [130, -165, 75, 100], [-210, -140, 55, 70], [220, -150, 60, 80]];
    for (const [x, z, rad, h] of mtns) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 9), mat(0x8c939c)); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m);
      if (snowy || h > 90) { const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.45, h * 0.45, 9), mat(0xffffff)); cap.position.set(x, h - h * 0.225 + 0.2, z); g.add(cap); }
    }
    if (!spa) {
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(26, 210), mat(snowy ? 0xffffff : 0x9fbf7e));
    slope.rotation.x = -Math.PI / 2 + 0.55; slope.position.set(0, 55, -128); g.add(slope);
    // лифт: стълбове, въже и седалки, които се движат
    const lift = new THREE.Vector3(18, 0, -40), top = new THREE.Vector3(18, 112, -190);
    for (let k = 0; k <= 6; k++) {
      const p = lift.clone().lerp(top, k / 6), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 10), mat(0x555a60));
      pole.position.set(p.x, p.y + 5, p.z); g.add(pole);
    }
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, lift.distanceTo(top)), mat(0x222222));
    cable.position.copy(lift.clone().lerp(top, 0.5)).add(new THREE.Vector3(0, 10, 0));
    cable.lookAt(top.clone().add(new THREE.Vector3(0, 10, 0))); cable.rotateX(Math.PI / 2); g.add(cable);
    for (let k = 0; k < 14; k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1), mat(0xff4a3a)); g.add(c);
      anim.chairs.push({ c, u: k / 14, a: lift.clone().add(new THREE.Vector3(0, 9, 0)), b: top.clone().add(new THREE.Vector3(0, 9, 0)) });
    }
    } else {   // балнео: горещи минерални басейни с пара
      for (const [x, z, rr] of [[-60, -10, 6], [-45, 4, 4], [55, -6, 5]]) {
        const pool = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.4, 24), new THREE.MeshStandardMaterial({ color: 0x5fd0c8, roughness: 0.15 }));
        pool.position.set(x, 0.15, z); g.add(pool);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.35, 8, 28).rotateX(Math.PI / 2), mat(0xcfc6b4)); rim.position.set(x, 0.35, z); g.add(rim);
        anim.steam = anim.steam || [];
        for (let k = 0; k < 6; k++) { const pf = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false })); g.add(pf); anim.steam.push({ m: pf, x, z, rr, ph: k / 6 }); }
      }
    }
    // борове (заснежени в сезона)
    const pine = snowy ? ['tree-snow-a', 'tree-snow-b', 'tree-snow-c'] : ['tree'];
    for (let k = 0; k < 90; k++) {
      const x = (rand() - 0.5) * 380, z = -120 + rand() * 230;
      if (Math.abs(x) < 70 && z > -10) continue;   // мястото на селището и пистата остават свободни
      if (Math.abs(x) < 25 && z < -30) continue;
      const n = pine[k % pine.length];
      if (!A[n]) continue;
      const t = deps.model(n, 6 + rand() * 4); t.position.set(x, 0, z); t.rotation.y = rand() * 6; g.add(t);
    }
    if (snowy) {   // падащ сняг
      const N = 1500, pos = new Float32Array(N * 3);
      for (let k = 0; k < N; k++) { pos[k * 3] = (rand() - 0.5) * 300; pos[k * 3 + 1] = rand() * 90; pos[k * 3 + 2] = (rand() - 0.5) * 300; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      anim.flakes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.85 }));
      g.add(anim.flakes);
    }
  }

  // ---------- вилното селище (около басейн)
  const plot = { x: 0, z: summer ? 45 : 35 };
  const villas = [];
  if (stage === 'building' || stage === 'built' || stage === 'sold') {
    anim.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), stage === 'building' ? 0.5 : 1e4);
    let k = 0;
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      if (!ix && !iz) continue;
      let o;
      if (!summer && A['cabin-wall']) o = buildChalet(A, deps.model, 3.4, k);   // зимните курорти: дървени хижи
      else {
        const sub = RESORT_MODELS.suburban.filter(n => A[n]), pool = sub.length ? sub : deps.houses, n = pool[(k * 3 + r.id.length) % pool.length];
        o = deps.model(n, deps.fitScale(n, 11)); deps.tintRoof(o, k * 7 + r.id.length);
      }
      const bb = new THREE.Box3().setFromObject(o);
      o.position.set(plot.x + ix * 20 - (bb.min.x + bb.max.x) / 2, 0, plot.z + iz * 18 - (bb.min.z + bb.max.z) / 2);
      o.rotation.y = iz < 0 ? 0 : Math.PI;
      // всяка вила се строи по ред: основа → стени, които растат (със скеле) → покрив
      const vclip = new THREE.Plane(new THREE.Vector3(0, -1, 0), stage === 'building' ? 0 : 1e4), vb = new THREE.Box3().setFromObject(o);
      o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.clippingPlanes = [vclip]; m.castShadow = true; } });
      const vc = new THREE.Vector3(), vs = new THREE.Vector3(); vb.getCenter(vc); vb.getSize(vs);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(vs.x + 1.2, 0.5, vs.z + 1.2), mat(0xb0b0aa)); slab.position.set(vc.x, 0.25, vc.z); slab.receiveShadow = true; g.add(slab);
      const sp = [], W2 = vs.x / 2 + 0.8, D2 = vs.z / 2 + 0.8, H2 = vs.y + 1;
      for (const [x1, z1, x2, z2] of [[-W2, -D2, W2, -D2], [W2, -D2, W2, D2], [W2, D2, -W2, D2], [-W2, D2, -W2, -D2]]) { for (let y = 2; y < H2; y += 2.5) sp.push(vc.x + x1, y, vc.z + z1, vc.x + x2, y, vc.z + z2); sp.push(vc.x + x1, 0, vc.z + z1, vc.x + x1, H2, vc.z + z1); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      const scaf = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9a53a })); scaf.visible = false; g.add(scaf);
      const pal = new THREE.Group();
      for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), mat([0xb5523b, 0xa8743f, 0xb8b8b0][j])); b.position.set(vc.x + W2 + 1.2, 0.45, vc.z - 1.6 + j * 1.6); pal.add(b); }
      pal.visible = false; g.add(pal);
      anim.villas = anim.villas || []; anim.villas.push({ o, vclip, slab, scaf, pal, base: vb.min.y, h: vs.y, i: k });
      g.add(o); villas.push(o); k++;
    }
    const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x3fc3ff, roughness: 0.1, metalness: 0.2 }));
    pool.position.set(plot.x, 0.1, plot.z); pool.visible = stage !== 'building'; g.add(pool);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.15, 12), mat(0xd9cbb0)); deck.position.set(plot.x, 0.05, plot.z); g.add(deck);
    if (stage === 'building') {   // кран и ограда
      const yel = mat(0xffc400), cr = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 22, 1.2), yel); mast.position.y = 11; cr.add(mast);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 30), yel); jib.position.set(0, 22, 10); cr.add(jib);
      cr.position.set(plot.x - 36, 0, plot.z - 24); g.add(cr); anim.crane = cr;
      const fence = mat(0xff7a00);
      for (const [x, z, w, d] of [[0, -32, 80, 0.2], [0, 32, 80, 0.2], [-40, 0, 0.2, 64], [40, 0, 0.2, 64]]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), fence); f.position.set(plot.x + x, 0.55, plot.z + z); g.add(f);
      }
    }
  } else {
    // празен парцел с колчета и табела
    const peg = mat(stage === 'land' ? 0x4cd07d : 0xff9a3c);
    for (const [x, z] of [[-40, -32], [40, -32], [-40, 32], [40, 32]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.5), peg); p.position.set(plot.x + x, 1.25, plot.z + z); g.add(p); }
    const tape = new THREE.Mesh(new THREE.BoxGeometry(80, 0.08, 64), new THREE.MeshBasicMaterial({ color: stage === 'land' ? 0x4cd07d : 0xff9a3c, transparent: true, opacity: 0.18 }));
    tape.position.set(plot.x, 0.06, plot.z); g.add(tape);
  }
  // ---------- разширения (хотел, лифт, аквапарк, СПА)
  const ext = (st && st.ext) || {}, eb = st && st.extBuild ? st.extBuild.key : null;
  const extra = (key, fn) => { if (ext[key] || eb === key) { const o = fn(); if (eb === key) o.scale.y = Math.max(0.05, st.extBuild.prog); g.add(o); } };
  extra('hotel', () => {
    // истинска 3D сграда от Kenney Modular Buildings: три кули в редица + табела; иначе простата кутия
    if (A['building-sample-tower-c'] && A['building-sample-tower-d']) {
      const h = new THREE.Group(), parts = ['building-sample-tower-d', 'building-sample-tower-c', 'building-sample-tower-a', 'building-sample-tower-c', 'building-sample-tower-d'];
      parts.forEach((n, i) => { const o = deps.model(A[n] ? n : 'building-sample-tower-c', 7.2); o.position.set((i - 2) * 7.9, 0, 0); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); h.add(o); });
      const lobby = new THREE.Mesh(new THREE.BoxGeometry(40, 0.4, 8), mat(0xe9e2d4)); lobby.position.set(0, 0.2, 8); h.add(lobby);   // тераса пред входа
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 6), mat(summer ? 0x2b6fff : 0x7a3b2a)); canopy.position.set(0, 4.2, 7.5); h.add(canopy);
      const bb = new THREE.Box3().setFromObject(h);
      const sg = deps.label(`🏨 ХОТЕЛ „${r.nm.toUpperCase()}“ ★★★★`, '#ffd54a', 18); sg.position.y = bb.max.y + 4; h.add(sg);
      h.position.set(plot.x + 58, 0, plot.z - 4);   // фасадите (прозорци, тенти) гледат към +z — към камерата
      return h;
    }
    const h = new THREE.Group(), floors = 9;
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, floors * 3.2, 11), mat(summer ? 0xf4efe6 : 0xd8cbb8)); body.position.y = floors * 1.6; h.add(body);
    for (let f = 1; f < floors; f++) { const bal = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.25, 12), mat(0x9fd3ff, { emissive: 0x22384a })); bal.position.y = f * 3.2; h.add(bal); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.8, 12), mat(0x3a5a7a)); roof.position.y = floors * 3.2 + 0.4; h.add(roof);
    const sg = deps.label('🏨 ХОТЕЛ', '#ffffff', 10); sg.position.y = floors * 3.2 + 4; h.add(sg);
    h.position.set(plot.x + 62, 0, plot.z - 6); h.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return h;
  });
  extra('aquapark', () => {
    // аквапарк: голям басейн и детски басейн, кула със стълби и три спирални пързалки (тръби по крива), шезлонги
    const a = new THREE.Group(), cols = [0xff4a6a, 0xffd23f, 0x3fa7ff], water = new THREE.MeshStandardMaterial({ color: 0x3fc3ff, roughness: 0.08 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 36), mat(0xe6dccb)); deck.position.y = 0.15; a.add(deck);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(24, 0.35, 14), water); pool.position.set(4, 0.3, 4); a.add(pool);
    const kids = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.35, 24), water); kids.position.set(-14, 0.3, 8); a.add(kids);
    const tower = new THREE.Group();
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 15), mat(0xeeeeee)); p.position.set(x, 7.5, z); tower.add(p); }
    for (let y = 3; y <= 15; y += 4) { const f = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 5), mat(0x2b6fff)); f.position.y = y; tower.add(f); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 2.5, 4), mat(0xff4a6a)); roof.position.y = 16.5; roof.rotation.y = Math.PI / 4; tower.add(roof);
    tower.position.set(-8, 0, -10); a.add(tower);
    cols.forEach((c, i) => {
      const pts = [];
      for (let k = 0; k <= 40; k++) { const u = k / 40, ang = u * Math.PI * (2.2 + i * 0.6) + i * 2; pts.push(new THREE.Vector3(-8 + Math.cos(ang) * (4 + u * (6 + i * 2)), 15 - i * 3 - u * (14.5 - i * 3), -10 + Math.sin(ang) * (4 + u * (6 + i * 2)) + u * 14)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.7, 10, false), mat(c)); tube.castShadow = true; a.add(tube);
    });
    for (let k = 0; k < 10; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 2.1), mat(0xffffff)); l.position.set(-18 + k * 3.8, 0.45, 15); a.add(l); }
    const sg = deps.label('🛝 АКВАПАРК', '#ffffff', 10); sg.position.set(-8, 21, -10); a.add(sg);
    a.position.set(plot.x - 58, 0, plot.z - 4); return a;
  });
  extra('lift', () => {
    const l = new THREE.Group(), a = new THREE.Vector3(0, 0, 0), b = new THREE.Vector3(0, 70, -140);
    for (let k = 0; k <= 4; k++) { const p = a.clone().lerp(b, k / 4), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 11), mat(0xffc400)); pole.position.set(p.x, p.y + 5.5, p.z); l.add(pole); }
    for (let k = 0; k < 10; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.1), mat(0x2b6fff)); l.add(c); anim.chairs.push({ c, u: k / 10, a: a.clone().add(new THREE.Vector3(0, 10, 0)), b: b.clone().add(new THREE.Vector3(0, 10, 0)) }); }
    l.position.set(plot.x - 45, 0, plot.z - 50); return l;
  });
  extra('spa', () => {
    const sp = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 6, 24), mat(0xe9e2d4)); hall.position.y = 3; sp.add(hall);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9fd3ff, { transparent: true, opacity: 0.75, metalness: 0.3 })); dome.position.y = 6; sp.add(dome);
    const sg = deps.label('🧖 СПА', '#ffffff', 8); sg.position.y = 20; sp.add(sg);
    sp.position.set(plot.x + 58, 0, plot.z); return sp;
  });

  // ---------- туристи (в сезона, когато селището работи)
  if ((stage === 'built' || stage === 'sold') && inSeason) {
    const shirt = [0xff5a5a, 0x3fa7ff, 0xffd23f, 0x50d18b, 0xffffff, 0xff8ad8, 0x8a5cff];
    const n = summer ? 70 : spa ? 30 : 45;
    for (let k = 0; k < n; k++) {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 1.1, 8), mat(shirt[k % shirt.length])); body.position.y = 0.9; p.add(body);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.7, 8), mat(summer ? 0xf0c8a0 : 0x2a3140)); legs.position.y = 0.35; p.add(legs);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0xf0c8a0)); head.position.y = 1.7; p.add(head);
      if (!summer && !spa) { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 8), mat(shirt[(k + 3) % shirt.length])); hat.position.y = 2; p.add(hat); }
      p.scale.setScalar(1.3);
      g.add(p);
      // летен: разхождат се по плажа или плуват; зимен: спускат се по пистата; балнео: около басейните
      const t = { p, k, kind: summer ? (k % 4 === 0 ? 'swim' : 'walk') : spa ? 'walk' : (k % 3 ? 'ski' : 'walk'), x: (rand() - 0.5) * 240, z: summer ? -40 + rand() * 30 : -20 + rand() * 50, sp: 0.4 + rand() * 0.8, ph: rand() * 6.28 };
      if (t.kind === 'ski') { t.u = rand(); t.lane = (rand() - 0.5) * 18; }
      if (spa) { t.x = -60 + rand() * 120; t.z = -15 + rand() * 30; }
      anim.tourists = anim.tourists || []; anim.tourists.push(t);
    }
  }

  const perYear = Math.round(r.month * (1 + Object.keys((st && st.ext) || {}).reduce((q, k) => q + (EXTRAS[k] ? EXTRAS[k].mul : 0), 0)) * (spa ? 12 : 4));
  const sign = deps.label(stage === 'built' ? `🏡 ${r.nm} · ~${perYear.toLocaleString('bg-BG')} €/год.` : stage === 'sold' ? `✅ ${r.nm} · продадено` : stage === 'building' ? `🔨 ${r.nm} · строи се` : stage === 'land' ? `🟩 ${r.nm} · твоя земя` : `🏷️ ${r.nm} · свободен парцел`, '#ffd54a', 26);
  sign.position.set(plot.x, 22, plot.z); g.add(sign);
  g.traverse(o => { if (o.isMesh && !o.material.transparent) o.receiveShadow = true; });

  // t: секунди; prog: прогрес на строежа (0…1)
  function update(t, prog = 1) {
    if (anim.waves) {
      const a = anim.waves.geo.attributes.position, b = anim.waves.base;
      for (let i = 0; i < a.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; const amp = Math.max(0.15, Math.min(1, (750 - z) / 80)); a.array[i * 3 + 1] = (Math.sin(x * 0.05 + t * 1.3) * 0.35 + Math.cos(z * 0.07 + t * 0.9) * 0.3) * amp; }   // до брега вълните са по-ниски
      a.needsUpdate = true; anim.waves.geo.computeVertexNormals();
      anim.foam.material.opacity = 0.35 + Math.sin(t * 1.6) * 0.25; anim.foam.position.z = -49 + Math.sin(t * 1.6) * 1.2;
      if (anim.boat) { anim.boat.position.y = 0.3 + Math.sin(t * 1.4) * 0.25; anim.boat.rotation.z = Math.sin(t * 1.1) * 0.06; }
      for (const q of anim.boats || []) { q.b.position.y = 0.1 + Math.sin(t * 1.2 + q.ph) * 0.3; q.b.rotation.z = Math.sin(t * 0.9 + q.ph) * 0.07; q.b.position.x = q.x0 + Math.sin(t * 0.05 * q.sp + q.ph) * 30; }
    }
    for (const ch of anim.chairs) { ch.u = (ch.u + 0.0009) % 1; ch.c.position.copy(ch.a).lerp(ch.b, ch.u); }
    if (anim.flakes) {
      const p = anim.flakes.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { p.array[i * 3 + 1] -= 0.12; p.array[i * 3] += Math.sin(t + i) * 0.02; if (p.array[i * 3 + 1] < 0) p.array[i * 3 + 1] = 90; }
      p.needsUpdate = true;
    }
    if (anim.villas) {
      const nV = anim.villas.length;
      for (const v of anim.villas) {
        const u = stage === 'building' ? Math.max(0, Math.min(1, prog * nV - v.i)) : 1;   // прогрес на тази вила
        v.slab.visible = u > 0 && u < 1; v.slab.scale.y = Math.min(1, u / 0.15 + 0.01);
        const w = u < 0.15 ? 0 : (u - 0.15) / 0.85;
        v.vclip.constant = u >= 1 ? 1e4 : v.base + v.h * w;
        v.o.visible = w > 0 || u >= 1;
        v.scaf.visible = stage === 'building' && u > 0.1 && u < 1;
        v.pal.visible = stage === 'building' && u > 0 && u < 0.9;
      }
      if (anim.crane && anim.villas.length && stage === 'building') {   // кранът е при вилата, която се строи
        const cur = anim.villas[Math.min(nV - 1, Math.floor(prog * nV))], b = new THREE.Box3().setFromObject(cur.o.visible ? cur.o : cur.slab), c = new THREE.Vector3(); b.getCenter(c);
        anim.crane.position.x += (c.x - 10 - anim.crane.position.x) * 0.05; anim.crane.position.z += (c.z - 10 - anim.crane.position.z) * 0.05;
      }
    }
    for (const s of anim.steam || []) { const u = (t * 0.25 + s.ph) % 1; s.m.position.set(s.x + Math.sin(u * 6 + s.ph) * s.rr * 0.4, 0.5 + u * 8, s.z); s.m.scale.setScalar(0.6 + u * 1.6); s.m.material.opacity = 0.3 * (1 - u); }
    for (const q of anim.tourists || []) {
      if (q.kind === 'ski') {   // спуск по пистата (пистата е наклонена равнина от (0,110,-225) до (0,0,-30))
        q.u = (q.u + 0.0025 * q.sp) % 1;
        const zz = -225 + q.u * 195, yy = 110 * (1 - q.u) * 0.97;
        q.p.position.set(q.lane + Math.sin(q.u * 30 + q.ph) * 6, Math.max(0, yy), zz); q.p.rotation.y = Math.cos(q.u * 30 + q.ph) * 0.8;
      } else if (q.kind === 'swim') {
        q.p.position.set(q.x + Math.sin(t * 0.3 * q.sp + q.ph) * 6, -0.9 + Math.sin(t * 2 + q.ph) * 0.1, -60 - (q.k % 7) * 4);
      } else {
        const dx = Math.sin(t * 0.15 * q.sp + q.ph) * 20;
        q.p.position.set(q.x + dx, 0, q.z); q.p.rotation.y = Math.cos(t * 0.15 * q.sp + q.ph) > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    if (anim.crane) anim.crane.rotation.y = Math.sin(t * 0.3) * 0.8;
  }
  // подсказки за game.js: камера (кадрира плажа/селището), граници за местене, мъгла и цвят на хоризонта
  const view = {
    cam: summer ? { pos: [55, 34, 120], target: [0, 0, 15] } : { pos: [60, 42, 125], target: [0, 4, 10] },
    minDist: 35, maxDist: 260, maxPolar: 1.32, bounds: 220,
    fog: [180, 900], horizon: HOR,
  };
  return { group: g, update, view };
}
