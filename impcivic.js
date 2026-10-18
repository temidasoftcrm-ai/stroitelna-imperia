// impcivic.js — обществените сгради на Империал Сити в 3D (imperial.js: S.imp.b = { [key]: [{ lv, run, prog }] }).
// Всяка сграда стои на свой парцел във външния пояс (S.imp.bl = { 'key:i': lotId } — едни и същи парцели след презареждане);
// докато се строи — ограда, кран и скеле (prog), после сградата. Готовите модели идват от civic3d.js / tender3d.js (builders),
// а автобусното и трамвайното депо, заводът за отпадъци, паркът и знаковият проект (Кулата „Свобода“ / Дворецът „Империал“) — процедурни тук.
import * as THREE from 'three';

const mat = (c, r = 0.8, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e ? { emissive: e, emissiveIntensity: 0 } : {}) });
const box = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
const cyl = (g, r1, r2, h, m, x, y, z, seg = 16) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };

// ---- процедурните (в метри, парцел ~14×14): { body (расте по prog), glass (светят нощем) }
const PROC = {
  bus(b, cc) {   // хале с назъбен покрив и автобуси в двора
    const wall = mat(0xc9c4b8), roof = mat(0x5d6670, 0.6, 0.3), bus = mat(cc === 'RU' ? 0xf0c419 : 0x2f6fd0, 0.5), win = mat(0x1d2a38, 0.3);
    box(b, 12, 4, 6, wall, 0, 0, -3.5); for (let i = 0; i < 4; i++) { const r = box(b, 3, 1.2, 6.2, roof, -4.5 + i * 3, 4, -3.5); r.rotation.z = 0.35; }
    for (let i = 0; i < 4; i++) { box(b, 2.2, 2.4, 6.4, bus, -4.5 + i * 3, 0, 3.2); box(b, 2.25, 0.9, 6, win, -4.5 + i * 3, 1.3, 3.2); }
    return [];
  },
  tram(b, cc) {   // депо, релси и два трамвая на спирка
    const wall = mat(0xd8d2c4), steel = mat(0x8a9099, 0.4, 0.8), tram = mat(cc === 'RU' ? 0xc8322d : 0x2c8f6a, 0.5), win = mat(0x1d2a38, 0.3), glass = mat(0x9fc6dc, 0.2, 0.2, 0xffe2a8);
    box(b, 13, 5, 5, wall, 0, 0, -4); box(b, 13, 0.4, 5.4, mat(0x6b5d4f), 0, 5, -4);
    for (const x of [-2, 2]) { box(b, 0.3, 0.15, 14, steel, x - 0.7, 0, 0); box(b, 0.3, 0.15, 14, steel, x + 0.7, 0, 0); }
    for (const [x, z] of [[-2, 2.5], [2, -0.5]]) { box(b, 2.2, 2.8, 9, tram, x, 0.3, z); box(b, 2.25, 1, 8.6, win, x, 1.6, z); }
    const stop = box(b, 4, 0.2, 1.6, glass, 5.4, 2.6, 4); box(b, 0.2, 2.6, 0.2, steel, 4, 0, 4); box(b, 0.2, 2.6, 0.2, steel, 6.8, 0, 4);
    return [glass];
  },
  waste(b) {   // завод: корпус, комин, контейнери за разделно събиране
    const wall = mat(0xbfc6c9), stripe = mat(0x3f9a54), chim = mat(0x9a9a9a), glass = mat(0x9fc6dc, 0.2, 0.2, 0xffe2a8);
    box(b, 10, 6, 7, wall, -1.5, 0, -2); box(b, 10.1, 0.8, 7.1, stripe, -1.5, 4.6, -2); box(b, 6, 1.2, 0.1, glass, -1.5, 2.5, 1.56);
    cyl(b, 0.9, 1.2, 16, chim, 4.5, 0, -4); cyl(b, 0.95, 0.95, 1, mat(0xd04030), 4.5, 14, -4);
    [0x2f7d32, 0x2f5fb0, 0xe0b020, 0x8a8a8a].forEach((c, i) => box(b, 1.8, 1.4, 1.4, mat(c, 0.6), -4.5 + i * 2.2, 0, 4.5));
    return [glass];
  },
  park(b, cc) {   // морава, алеи, фонтан и дървета (в Русия — брези)
    const lawn = mat(0x6fae4f, 1), path = mat(0xd6cdb6, 1), water = mat(0x3fb0d8, 0.1, 0.2), stone = mat(0xbdb6a6), trunk = mat(cc === 'RU' ? 0xe9e6dc : 0x5b4330), leaf = mat(0x3f8f3a);
    box(b, 14, 0.15, 14, lawn, 0, 0, 0); box(b, 14, 0.18, 1.6, path, 0, 0, 0); box(b, 1.6, 0.18, 14, path, 0, 0, 0);
    cyl(b, 2.2, 2.4, 0.6, stone, 0, 0.1, 0, 24); cyl(b, 1.9, 1.9, 0.62, water, 0, 0.12, 0, 24); cyl(b, 0.25, 0.3, 2.4, stone, 0, 0.1, 0, 10);
    for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5], [-5.5, 0.1], [5.5, -1.5], [-1.8, 5.2], [2, -5.6]]) {
      cyl(b, 0.18, 0.25, 2.6, trunk, x, 0, z, 6); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), leaf); c.position.set(x, 3.6, z); c.castShadow = true; b.add(c);
    }
    return [];
  },
  // ⭐ знаковият проект: 🇺🇸 Кулата „Свобода“ (стъклена, скосена към върха, със шпил) / 🇷🇺 Дворецът „Империал“ (стъпаловидни барабани с колонади, шпил и звезда)
  landmark(b, cc) {
    if (cc === 'RU') {
      const stone = mat(0xd8c9a8, 0.7), col = mat(0xeee6d4, 0.6), gold = mat(0xd9a53a, 0.3, 1), glass = mat(0xffe2a8, 0.4, 0, 0xffd27a), star = mat(0xd02020, 0.4, 0, 0xff2020);
      let y = 0, r = 6.8;
      for (const [h, k] of [[22, 1], [26, 0.82], [30, 0.66], [32, 0.5], [26, 0.36]]) {
        cyl(b, r * k, r * k * 1.04, h, stone, 0, y, 0, 24); cyl(b, r * k + 0.25, r * k + 0.25, 0.8, col, 0, y + h, 0, 24);
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; cyl(b, 0.18, 0.18, h * 0.8, col, Math.cos(a) * (r * k + 0.15), y + h * 0.1, Math.sin(a) * (r * k + 0.15), 6); }
        cyl(b, r * k - 0.2, r * k - 0.2, h * 0.5, glass, 0, y + h * 0.25, 0, 24).scale.set(1.01, 1, 1.01);
        y += h + 0.8;
      }
      cyl(b, 0.3, 1.4, 40, gold, 0, y, 0, 10); const s = new THREE.Mesh(new THREE.OctahedronGeometry(1.4), star); s.position.set(0, y + 41.5, 0); b.add(s);
      return [glass];
    }
    const glassM = mat(0x8fb7d4, 0.12, 0.6, 0x9fd0ff), base = mat(0xd9dde2, 0.5), spire = mat(0xe8eef4, 0.3, 0.8);
    box(b, 13, 18, 13, base, 0, 0, 0);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 9, 240, 4, 1), glassM); t.rotation.y = Math.PI / 4; t.position.y = 18 + 120; t.castShadow = true; b.add(t);   // скосените ръбове на 1 WTC
    box(b, 7, 3, 7, base, 0, 258, 0); cyl(b, 0.25, 0.6, 70, spire, 0, 261, 0, 8);
    return [glassM];
  },
};

// един процедурен обект с площадка (ограда), кран и растеж по prog; интерфейс като civic3d: { group, setProg, update, dispose }
function buildProc(group, kind, cc, opts) {
  const g = new THREE.Group(); g.position.set(opts.x, 0.06, opts.z); g.scale.setScalar(opts.scale || 1); group.add(g);
  const body = new THREE.Group(); g.add(body); const glass = PROC[kind](body, cc) || [];
  const dirt = box(g, 14, 0.1, 14, mat(0x7a5c3e, 1), 0, 0, 0);
  const yel = mat(0xffc400, 0.6, 0, 0xffb000), fence = new THREE.Group(); g.add(fence);
  for (const [w, d, x, z] of [[14, 0.2, 0, -7], [14, 0.2, 0, 7], [0.2, 14, -7, 0], [0.2, 14, 7, 0]]) box(fence, w, 1.2, d, yel, x, 0, z);
  const tall = kind === 'landmark', kit = new THREE.Group(); g.add(kit);
  box(kit, 0.9, tall ? 60 : 16, 0.9, mat(0xf2b705, 0.6, 0.3), 6, 0, -6); const jib = box(kit, 16, 0.6, 0.6, mat(0xf2b705, 0.6, 0.3), 1, tall ? 60 : 16, -6);
  let prog = -1;
  const setProg = p => { p = Math.max(0, Math.min(1, p)); if (p === prog) return; prog = p; const k = Math.max(0, (p - 0.1) / 0.9); body.visible = k > 0; body.scale.y = Math.max(0.001, k); kit.visible = fence.visible = dirt.visible = p < 1; };
  setProg(opts.prog ?? 1);
  return { group: g, setProg, update: (t, night = 0) => { for (const m of glass) m.emissiveIntensity = prog >= 1 ? 0.05 + 0.7 * night : 0; if (prog < 1) jib.rotation.y = Math.sin(t * 0.25) * 0.8; },
    dispose: () => { group.remove(g); g.traverse(o => { o.geometry && o.geometry.dispose(); }); } };
}

// кой строител за коя сграда; civic3d PROC: 'solar' / 'wind'
const VIA = { hospital: 'hospital', medcx: 'hospital', school: 'school', fire: 'fire', water: 'water', metro: 'metro', power: 'power', bus: 'bus', tram: 'tram', waste: 'waste', park: 'park', landmark: 'landmark' };
const SIGN = { hospital: '🏥', medcx: '🏨', school: '🏫', fire: '🚒', water: '💧', metro: '🚇', power: '⚡', bus: '🚌', tram: '🚋', waste: '♻️', park: '🌳', landmark: '⭐' };

// city: { lots, group }; ctx: { imp, cc, side (страната на парцела, m), builders: { civic, hospital, metro }, deps: { label, model }, reserve(lot) }
// Пази city.impCiv = { 'key:i': { o, lot } }; вика се при влизане в града и всеки ден (prog). Връща колко сгради има.
export function syncImpCivic(city, ctx) {
  const imp = ctx.imp; if (!city?.group || !city.lots || !imp?.b) return 0;
  const items = city.impCiv = city.impCiv || {}, bl = imp.bl = imp.bl || {};
  const taken = new Set(Object.values(bl));
  // свободни парцели: външният пояс, без застроените/заетите; подредени по ъгъл около центъра — сградите се пръскат равномерно
  let cx = 0, cz = 0; for (const l of city.lots) { cx += l.x; cz += l.z; } cx /= city.lots.length; cz /= city.lots.length;
  const free = () => city.lots.filter(l => l.zone === 'outer' && !l.built && !l.busy && !taken.has(l.id)).sort((a, b) => Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx));
  let n = 0, turn = 0;
  for (const [key, arr] of Object.entries(imp.b)) {
    if (!Array.isArray(arr) || !VIA[key]) continue;
    arr.forEach((it, i) => {
      if (!it) return;
      const id = `${key}:${i}`, prog = it.run ? (it.prog || 0) : 1;
      let lot = bl[id] != null ? city.lots.find(l => l.id === bl[id]) : null;
      if (!lot) { const F = free(); if (!F.length) return; lot = F[(turn++ * 7) % F.length]; bl[id] = lot.id; taken.add(lot.id); }
      if (!items[id]) {
        for (const tr of lot.trees || []) city.group.remove(tr); lot.trees = []; lot.busy = 'imp'; ctx.reserve && ctx.reserve(lot);
        const k = ctx.side / 26, o = { x: lot.x, z: lot.z, scale: k, prog, sign: SIGN[key], ext: [26, 26] }, B = ctx.builders || {}, via = VIA[key];
        let obj = null;
        if (via === 'hospital' && B.hospital) obj = B.hospital(city.group, ctx.deps, { ...o, kind: 'hospital' });
        else if (via === 'metro' && B.metro) obj = B.metro(city.group, ctx.deps, { ...o, kind: 'metro' });
        else if (['school', 'fire', 'water', 'power'].includes(via) && B.civic) obj = B.civic(city.group, ctx.deps, { ...o, kind: via === 'power' ? (ctx.cc === 'RU' ? 'wind' : 'solar') : via });
        if (!obj) obj = buildProc(city.group, PROC[via] ? via : 'park', ctx.cc, { x: lot.x, z: lot.z, scale: ctx.side / 14, prog });
        obj.group.position.y = 0.06; obj.group.userData.imp = id;
        items[id] = { o: obj, lot };
      }
      items[id].o.setProg(prog); n++;
    });
  }
  return n;
}
export function updateImpCivic(city, t, night) { for (const v of Object.values(city?.impCiv || {})) v.o.update(t, night); }
export function disposeImpCivic(city) { for (const v of Object.values(city?.impCiv || {})) v.o.dispose(); if (city) city.impCiv = null; }
