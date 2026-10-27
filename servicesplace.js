// servicesplace.js — 🏛️ разполагане на обществените услуги (services.js) по парцелите на плана v2 в играта (cityplan2game.js gamePlan2).
// Парцелите на истинските градове са малки (Рим: най-често 10×13 м), затова сградата заема поредица от съседни свободни парцели
// по една и съща страна на улицата (общ фронт) — колкото е нужна истинската ѝ ширина (realSize); дълбочината е най-малката от поредицата.
// Пропуска: реставрация (reno), заети (built / busy / mega) и вече взетите от услуги. Болницата, пожарната и кметството
// предпочитат булевард/кей (директен излаз към основна улица). Кметството — до площада; останалите — в квартала с най-малко
// такива услуги спрямо дела му в града (районните услуги се разпределят сами). Записът е в rec (S.svc[cityId]) — lots: [id…].
//
// const sp = servicePlacer(gp)                       — gp: gamePlan2(…) (лотове в рамката на играта)
// sp.place(k, lvl, rec) → { lots, x, z, rot, w, d, district, main } | null   — една сграда (за поръчка от D2 — не записва)
// sp.assign(rec, t) → [{ k, i, ...place }]          — дава парцели на всички сгради в rec без lots (при първо отваряне / след builds())
// sp.byDistrict(rec) → { [квартал]: { lots, share, [k]: брой } }      — за нуждите по квартали
// sp.release(rec, k, i)                              — освобождава парцелите на сграда (разрушаване)
// sp.spot(k, lvl, ids) → { x, z, rot, w, d, … }     — мястото върху вече избрани парцели (строеж в ход → serviceSite)
import { feature } from './lab/feature.js';
import { SERVICES } from './services.js';

const MAIN = new Set(['blvd', 'quay', 'ring', 'main']);
// истински размери в метри (сградите и колите са 1:1, картата е ×0,45): [фронт, дълбочина] за ниво l; s ×0,75, m ×0,88
const REAL = { hall: [50, 40], hosp: [60, 40], fire: [32, 26], police: [45, 34], school: [45, 30], kinder: [25, 20], voc: [45, 30], uni: [70, 45], park: [40, 34], sport: [60, 45], bus: [45, 30], util: [36, 28], recycle: [40, 30] };
const LK = { s: 0.75, m: 0.88, l: 1, x: 1 };
export const realSize = (k, lvl) => { const S0 = SERVICES[k], a = (S0 && (S0.lot[lvl] || Object.values(S0.lot).pop())) || [20, 18], r = REAL[k] ? REAL[k].map(v => v * (LK[lvl] || 1)) : a; return [Math.max(a[0], r[0]), Math.max(a[1], r[1])]; };
export function servicePlacer(gp) {
  const P2 = gp.p2, lots = gp.lots, info = lots.map(L => { const f = P2 && P2.lots[L.p2] ? P2.lots[L.p2].front || {} : {}; return { road: f.road ?? L.street, side: f.side ?? 1, s: f.s ?? 0, cls: f.cls || 'street' }; });
  // поредиците по улица и страна (подредени по разстоянието s)
  const runs = new Map(); lots.forEach((L, i) => { const f = info[i], key = f.road + ':' + f.side; if (!runs.has(key)) runs.set(key, []); runs.get(key).push(i); });
  for (const r of runs.values()) r.sort((a, b) => info[a].s - info[b].s);
  const dist = {}; lots.forEach(L => { dist[L.district] = (dist[L.district] || 0) + 1; }); const total = lots.length || 1;
  const sq = gp.square || { x: 0, z: 0 };
  const taken = rec => { const T = new Set(); for (const list of Object.values(rec || {})) for (const b of list || []) for (const id of b.lots || []) T.add(id); return T; };
  const free = (i, T) => { const L = lots[i]; return !L.reno && !L.built && !L.busy && !L.mega && !T.has(i); };
  const countIn = (rec, k) => { const c = {}; for (const b of (rec && rec[k]) || []) if (b.lots && b.lots.length) { const d = lots[b.lots[0]].district; c[d] = (c[d] || 0) + 1; } return c; };

  function place(k, lvl, rec, extraTaken) {
    const S0 = SERVICES[k]; if (!S0) return null; const sz = realSize(k, lvl), T = taken(rec); if (extraTaken) for (const i of extraTaken) T.add(i);
    // пълен размер; ако никъде няма място — по-тясна (0,75) версия
    return find(k, sz[0], sz[1], T, rec) || find(k, sz[0] * 0.75, sz[1] * 0.75, T, rec);
  }
  function find(k, needW, needD, T, rec) {
    const S0 = SERVICES[k], wantMain = S0.road === 'main', inD = countIn(rec, k);
    let best = null, bs = Infinity;
    for (const run of runs.values()) for (let a = 0; a < run.length; a++) {
      if (!free(run[a], T)) continue; let w = 0, d = 1e9; const ids = [];
      for (let b = a; b < run.length && w < needW; b++) { const i = run[b]; if (!free(i, T)) break; if (ids.length && info[i].s - info[run[b - 1]].s > lots[run[b - 1]].w * 0.5 + lots[i].w * 0.5 + 4) break; ids.push(i); w += lots[i].w; d = Math.min(d, lots[i].d); }
      if (w < needW * 0.9 || d < Math.min(needD * 0.6, 14)) continue;
      const L0 = lots[ids[0]], x = ids.reduce((s, i) => s + lots[i].x, 0) / ids.length, z = ids.reduce((s, i) => s + lots[i].z, 0) / ids.length, dist2 = Math.hypot(x - sq.x, z - sq.z);
      let sc = (MAIN.has(info[ids[0]].cls) ? 0 : wantMain ? 400 : 0) + (w - needW) * 2 + Math.max(0, needD - d) * 4;
      if (k === 'hall') sc += dist2; else { const share = (dist[L0.district] || 0) / total; sc += ((inD[L0.district] || 0) / Math.max(0.02, share)) * 60 + dist2 * 0.05; }
      if (sc < bs) { const dd = Math.min(d, needD * 1.15), sh = (d - dd) / 2; bs = sc; best = { lots: ids, x: x + Math.sin(L0.rot) * sh, z: z + Math.cos(L0.rot) * sh, rot: L0.rot, w: Math.min(w, needW * 1.1), d: dd, district: L0.district, main: MAIN.has(info[ids[0]].cls) }; }
    }
    return best;
  }
  function assign(rec) {
    const out = [];
    for (const [k, list] of Object.entries(rec || {})) (list || []).forEach((b, i) => { if (b.lots && b.lots.length) return; const p = place(k, b.lvl, rec); if (!p) return; b.lots = p.lots; out.push({ k, i, ...p }); });
    return out;
  }
  // готовите сгради с парцели → място за 3D (комбинираният парцел)
  // мястото на сграда върху парцелите ids (комбинираният парцел; по-плитка от него → към улицата, локално +z)
  function spot(k, lvl, ids) {
    const L0 = lots[ids[0]], R = realSize(k, lvl), full = Math.min(...ids.map(j => lots[j].d)), w = Math.min(ids.reduce((s, j) => s + lots[j].w, 0), R[0] * 1.1), d = Math.min(full, R[1] * 1.15), sh = (full - d) / 2;
    return { x: ids.reduce((s, j) => s + lots[j].x, 0) / ids.length + Math.sin(L0.rot) * sh, z: ids.reduce((s, j) => s + lots[j].z, 0) / ids.length + Math.cos(L0.rot) * sh, rot: L0.rot, w, d, district: L0.district, main: MAIN.has(info[ids[0]].cls) };
  }
  function spots(rec) {
    const out = [];
    for (const [k, list] of Object.entries(rec || {})) (list || []).forEach((b, i) => { if (b.lots && b.lots.length) out.push({ k, i, lvl: b.lvl, prog: b.prog, ...spot(k, b.lvl, b.lots) }); });
    return out;
  }
  function byDistrict(rec) {
    const out = {}; for (const [d, n] of Object.entries(dist)) out[d] = { lots: n, share: n / total };
    for (const [k, list] of Object.entries(rec || {})) for (const b of list || []) if (b.lots && b.lots.length) { const d = lots[b.lots[0]].district; out[d][k] = (out[d][k] || 0) + 1; }
    return out;
  }
  const release = (rec, k, i) => { const b = rec && rec[k] && rec[k][i]; if (b) b.lots = []; };
  return { place, assign, spot, spots, byDistrict, release };
}

// 3D слой: всички сгради с парцели (services3d.js buildService) — в групата; update(night) — светлините; dispose()
// 🏛️ височината по съседите (потребителят: „обществените сгради са твърде ниски до фоновите блокове — трябва да им оправим размерите“):
// o.blocks = { list: view.userData.blocks ([{ x, z, h }] в координатите на изгледа), off: [ox, oz] } → медианата на блоковете в радиус 70 м;
// кметство/болница ×1,0, училище/полиция/пожарна ×0,85, другите ×0,9 (services3d: разтягане до ×3,5, отпечатъкът остава)
const H_NEAR = { hall: 1, hosp: 1, school: 0.85, police: 0.85, fire: 0.85 };
export function heightNear(blocks, R = 70) {
  if (!blocks || !blocks.list || !blocks.list.length) return null;
  const C = 50, grid = new Map(), [ox, oz] = blocks.off || [0, 0];
  for (const b of blocks.list) { if (!(b.h > 0)) continue; const k = Math.floor((b.x + ox) / C) * 100003 + Math.floor((b.z + oz) / C); (grid.get(k) || grid.set(k, []).get(k)).push(b.x + ox, b.z + oz, b.h); }
  return (x, z, k) => {
    const hs = [], i0 = Math.floor((x - R) / C), i1 = Math.floor((x + R) / C), j0 = Math.floor((z - R) / C), j1 = Math.floor((z + R) / C);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = grid.get(i * 100003 + j); if (c) for (let q = 0; q < c.length; q += 3) if (Math.hypot(c[q] - x, c[q + 1] - z) <= R) hs.push(c[q + 2]); }
    if (hs.length < 4) return null; hs.sort((a, b) => a - b);
    return hs[hs.length >> 1] * (H_NEAR[k] ?? 0.9);
  };
}
export async function servicesLayer(gp, rec, o = {}) {
  const { buildService } = await import('./services3d.js'), THREE = await import('three');
  const sp = servicePlacer(gp), group = new THREE.Group(), items = [], hNear = feature('svc-height') ? heightNear(o.blocks) : null;
  for (const s of sp.spots(rec)) { const b = buildService(s.k, s.lvl, { w: s.w, d: s.d }, { seed: s.i + s.k.length, hallTop: o.hallTop || null, trees: o.trees || null, region: o.region || 'eu', outline: !!o.outline, fill: o.fill ?? !!gp.osm, minH: o.minH ?? (gp.osm ? 24 : 0), hAbs: hNear ? hNear(s.x, s.z, s.k) : null }); /* истинската карта: обществените сгради — едри, колкото блоковете наоколо (20–40 м) */ b.group.position.set(s.x, 0, s.z); b.group.name = 'svc-' + s.k; b.group.rotation.y = s.rot; group.add(b.group); items.push({ ...s, b }); }
  return { group, items, setNight: on => items.forEach(it => it.b.setNight(on)), dispose: () => items.forEach(it => it.b.dispose()) };
}

// 🏗️ строежът на услуга (поръчка в ход): ограда с вход откъм улицата, бетонен скелет, който расте по етажи с prog (0…1),
// скеле по фасадата на най-горния етаж, кулокран отзад и площадката (контейнери, тоалетна, тухли, дъски, кош) — моделите от construct.js.
// sz = { w, d } (като spots/place), предна страна = +z (към улицата) → { group, dispose }
let CK = null;
export async function serviceSite(k, lvl, sz, prog = 0) {
  const THREE = await import('three');
  if (!CK) CK = (async () => { const [{ GLTFLoader }, { loadConstruct }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('./construct.js')]), L = new GLTFLoader(), A = {}; await loadConstruct(u => L.loadAsync(u), A); return A; })().catch(e => { console.warn('site', e); return {}; });
  const A = await CK, group = new THREE.Group(), own = [], { w, d } = sz, p = Math.max(0, Math.min(1, prog || 0));
  const M = (c, ex = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...ex }); own.push(m); return m; };
  const box = (bw, bh, bd, m, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(bw, bh, bd); own.push(g); const o = new THREE.Mesh(g, m); o.position.set(x, y + bh / 2, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; group.add(o); return o; };
  const put = (n, x, z, ry = 0, s = 1) => { const a = A[n]; if (!a) return; const o = (a.scene || a).clone(true); o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s); group.add(o); };
  group.name = 'svc-site';
  const dirt = M(0x8a7a62), conc = M(0xa9a59c), slab = M(0x8f8b84), fence = M(0x2f6b8a, { roughness: 0.7 }), post = M(0xcfcfcf), scaf = M(0xd9a33a, { roughness: 0.6, metalness: 0.2 }), net = M(0x3f8f4a, { transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  // площадката и оградата (2 м, вход 8 м отпред)
  box(w, 0.06, d, dirt, 0, 0, 0);
  const fh = 2, side = (len, x, z, ry) => { box(len, fh, 0.12, fence, x, 0, z, ry); for (let t = -len / 2; t <= len / 2 + 0.01; t += 3) box(0.14, fh + 0.15, 0.14, post, x + Math.cos(ry) * t, 0, z - Math.sin(ry) * t); };
  side(w, 0, -d / 2, 0); side(d, -w / 2, 0, Math.PI / 2); side(d, w / 2, 0, Math.PI / 2); const gw = Math.min(8, w * 0.3), half = (w - gw) / 2; side(half, -w / 2 + half / 2, d / 2, 0); side(half, w / 2 - half / 2, d / 2, 0);
  // скелетът: сградата е в задните 65% от парцела; етажите — 3,6 м, колкото е стигнал строежът
  // сградата — в средата отзад; лентите отстрани: вляво контейнерите/тоалетната/бетоновозът, вдясно кулокранът; отпред — материалите
  const R = realSize(k, lvl), FL = Math.max(2, Math.min(6, Math.round((R[0] * R[1]) / 450))), sw = Math.max(4, Math.min(8, w * 0.15)), bw = w - 2 * sw, bd = Math.max(8, d * 0.62), bz = -d / 2 + bd / 2 + 1.2, H = 3.6, fy0 = bz + bd / 2, fz = (fy0 + d / 2) / 2;
  const n = p < 0.08 ? 0 : Math.max(1, Math.ceil(p * FL)), cols = Math.max(2, Math.round(bw / 6)), rows = Math.max(2, Math.round(bd / 6));
  box(bw, 0.5, bd, conc, 0, 0, bz);   // основата
  for (let f = 0; f < n; f++) {
    const y = 0.5 + f * H, top = f === n - 1, part = top ? Math.min(1, (p * FL) - f + 0.25) : 1;   // последният етаж — колоните растат
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) if (i === 0 || j === 0 || i === cols || j === rows || (i % 2 === 0 && j % 2 === 0)) box(0.45, H * part, 0.45, conc, -bw / 2 + (bw / cols) * i, y, bz - bd / 2 + (bd / rows) * j);
    if (!top || part >= 1) box(bw + 0.3, 0.3, bd + 0.3, slab, 0, y + H - 0.3, bz);
    if (f >= n - 2) { const fy = y; for (const sgn of [-1, 1]) { box(bw + 2, 0.08, 0.9, scaf, 0, fy + H - 0.4, bz + sgn * (bd / 2 + 0.8)); box(bw + 2, H, 0.02, net, 0, fy, bz + sgn * (bd / 2 + 1.25)); }
      for (let t = -bw / 2 - 1; t <= bw / 2 + 1.01; t += 2.5) for (const sgn of [-1, 1]) box(0.08, H, 0.08, scaf, t, fy, bz + sgn * (bd / 2 + 1.25)); }
  }
  // кулокранът: мачтата му (MAST в construct.js при мащаб 1) — в дясната лента до сградата
  if (p < 0.97 && A['crane-tower']) { const ks = Math.max(0.55, Math.min(1, (FL * H + 14) / 54)), ry = Math.PI * (0.25 + p), mx = 5.91 * ks, mz = -10.85 * ks, o = A['crane-tower'].scene.clone(true);
    o.scale.setScalar(ks); o.rotation.y = ry; o.position.set(w / 2 - sw / 2 - (mx * Math.cos(ry) + mz * Math.sin(ry)), 0, bz - (-mx * Math.sin(ry) + mz * Math.cos(ry))); group.add(o); }
  const lx = -w / 2 + sw / 2;
  put('container-office-green', lx, -d / 2 + 5); if (d > 34) put('container-office-red', lx, -d / 2 + 12.5);
  put('toilet-portable', lx - 1, d / 2 - 2.5); put('barrel', lx + 1.3, d / 2 - 2.5);
  if (d / 2 - fy0 > 3.5) { put('box-stack-brown', bw / 2 - 3, fz); put('box-stack-brown', bw / 2 - 5, fz, 0.4); put('planks-wood-a', -bw / 2 + 4, fz, Math.PI / 2); put('container-rubble-red', 0, fz, Math.PI / 2); }
  else { put('box-stack-brown', w / 2 - sw / 2, d / 2 - 2); put('container-rubble-red', w / 2 - sw / 2, d / 2 - 6); }
  if (p > 0.15 && p < 0.7 && d > 26) put('truck-concrete-red', lx, d / 2 - 8.5, Math.PI);
  return { group, dispose: () => { group.parent?.remove(group); own.forEach(o => o.dispose()); } };
}
