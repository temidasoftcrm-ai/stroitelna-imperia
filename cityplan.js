// cityplan.js — постоянни планове на градовете: неправилна граница, извити улици, площад и парцели покрай улиците.
// Само данни и геометрия (без THREE): един и същ град дава един и същ план при всяко зареждане (seed от името + PLAN_V).
// Записът пази само { v } за града — самият план се изчислява наново. 3D изгледът е в cityplan3d.js.
// Шаблони: plain (равнина, радиални булеварди и околовръстен) · mountain (същото + планина от едната страна)
//          coastal (издължен по брега) · river (река със завои и мостове) · island (издължен остров, правоъгълни квартали)
//          grid · lenfant · star · canal · eixample · walled — за големите градове (виж CITY_TPL).
// Твоят град от нулата (NEOM, ниво 19) нарочно няма готов план — там играчът сам чертае улиците.
import { OSM_CITIES } from './cityplan-osm.js';   // истински улици и паркове (OpenStreetMap) — шаблон „osm“
export const PLAN_V = 1;
const TAU = Math.PI * 2;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// градовете с характерна форма; останалите — по хеш (крайбрежните — coastal)
export const CITY_TPL = {
  sofia: { tpl: 'mountain' }, varna: { tpl: 'coastal' }, burgas: { tpl: 'coastal' }, paris: { tpl: 'river' }, plovdiv: { tpl: 'river' },
  london: { tpl: 'river' }, budapest: { tpl: 'river' }, newyork: { tpl: 'island' }, rio: { tpl: 'coastal', hills: 4 },
  // големите градове с характерен план: мрежа (САЩ), мрежа с диагонали (Вашингтон), звезда с пръстени (Москва),
  // полукръгли канали (Амстердам), блокове с диагонал до морето (Барселона), стар град в крепостен пръстен (Виена)
  chicago: { tpl: 'grid' }, toronto: { tpl: 'grid' }, philadelphia: { tpl: 'grid' }, losangeles: { tpl: 'grid' }, buenosaires: { tpl: 'grid' },
  washington: { tpl: 'lenfant' }, moscow: { tpl: 'star' }, beijing: { tpl: 'star' }, kyiv: { tpl: 'star' },
  amsterdam: { tpl: 'canal' }, stpetersburg: { tpl: 'canal' }, barcelona: { tpl: 'eixample' },
  vienna: { tpl: 'walled' }, prague: { tpl: 'walled' }, krakow: { tpl: 'walled' },
};
export const TEMPLATES = ['plain', 'mountain', 'coastal', 'river', 'island', 'grid', 'lenfant', 'star', 'canal', 'eixample', 'walled'];
export function templateOf(cityId, coastal = false) {
  if (CITY_TPL[cityId]) return CITY_TPL[cityId];
  if (coastal) return { tpl: 'coastal' };
  return { tpl: ['plain', 'mountain', 'river', 'plain'][hashStr('tpl:' + cityId) % 4] };
}

// ---- геометрия
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function cr(p0, p1, p2, p3, t) {   // Catmull-Rom
  const t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}
export function sampleCurve(ctrl, step = 2, closed = false) {
  const P = closed ? [ctrl[ctrl.length - 1], ...ctrl, ctrl[0], ctrl[1]] : [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const n = Math.max(1, Math.ceil(Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) / step));
    for (let k = 0; k < n; k++) out.push(cr(P[i - 1], P[i], P[i + 1], P[i + 2], k / n));
  }
  out.push(closed ? out[0].slice() : ctrl[ctrl.length - 1].slice());
  return out;
}
export function inPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0;
  return [Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz), t];
}
export function polyDist(p, pts) { let d = 1e9; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i])[0]); return d; }
function segX(a, b, c, d) {   // пресичане на отсечки ab и cd → [t, u] или null
  const r0 = b[0] - a[0], r1 = b[1] - a[1], s0 = d[0] - c[0], s1 = d[1] - c[1], den = r0 * s1 - r1 * s0;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s1 - (c[1] - a[1]) * s0) / den, u = ((c[0] - a[0]) * r1 - (c[1] - a[1]) * r0) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; };
export function pointAt(st, s) {   // позиция и посока на разстояние s по улицата
  const { pts, L } = st; s = Math.max(0, Math.min(L[L.length - 1], s));
  let i = 1; while (i < L.length - 1 && L[i] < s) i++;
  const a = pts[i - 1], b = pts[i], seg = L[i] - L[i - 1] || 1, t = (s - L[i - 1]) / seg, dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
  return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), tx: dx, tz: dz };
}
// правоъгълник (парцел/сграда): център, половин размери, ъгъл → 4 ъгъла
export function rectCorners(x, z, hw, hd, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), o = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) o.push([x + u * c + v * s, z - u * s + v * c]);
  return o;
}
function rectHas(r, p, pad = 0) {   // точка в правоъгълника r = {x,z,w,d,rot}
  const c = Math.cos(r.rot), s = Math.sin(r.rot), dx = p[0] - r.x, dz = p[1] - r.z;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  return Math.abs(u) <= r.w / 2 + pad && Math.abs(v) <= r.d / 2 + pad;
}
function rectsOverlap(a, b, pad = 0) {   // SAT за два завъртени правоъгълника
  const ca = rectCorners(a.x, a.z, a.w / 2 + pad, a.d / 2 + pad, a.rot), cb = rectCorners(b.x, b.z, b.w / 2 + pad, b.d / 2 + pad, b.rot);
  for (const P of [ca, cb]) for (let i = 0; i < 4; i++) {
    const p = P[i], q = P[(i + 1) % 4], nx = q[1] - p[1], nz = p[0] - q[0];
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const v of ca) { const d = v[0] * nx + v[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of cb) { const d = v[0] * nx + v[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
export { rectsOverlap, rectHas };

// ---- видове улици: ширина на платното (м)
const W = { blvd: 12, ring: 10, street: 7, quay: 8, road: 8 };
// парцели: [по улицата, в дълбочина] според зоната
const LOT_SIZE = { center: [20, 18], mid: [17, 16], outer: [14, 14] };
// допустими видове сгради по зона (поръчките избират само от тях)
export const LOT_KINDS = {
  center: ['tower', 'office', 'shop', 'civic'],
  mid: ['shop', 'block', 'office', 'house'],
  outer: ['house', 'block', 'shop', 'factory', 'park'],
};

// ---- план
const cache = new Map();
export function makePlan(cityId, opts = {}) {
  if (cityId === 'neom') return null;   // „Твоят град“ (ниво 19) — улиците ги чертае играчът
  const key = cityId + ':' + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  let T = opts.tpl ? { tpl: opts.tpl, hills: opts.hills } : templateOf(cityId, opts.coastal);
  if (opts.noCoast && (T.tpl === 'coastal' || T.tpl === 'island')) T = { tpl: 'plain' };   // в играта морето и пристанището са от seaside.js
  const OSM = T.tpl === 'osm' ? OSM_CITIES[cityId] : null;   // „osm“: улиците и парковете са от истинската карта (cityplan-osm.js)
  if (T.tpl === 'osm' && !OSM) T = { tpl: 'mountain' };
  const r = rng(hashStr(`plan:${cityId}:${T.tpl}:v${PLAN_V}`)), rr = (a, b) => lerp(a, b, r());
  const R = OSM ? Math.max(opts.R || 0, OSM.r) : opts.R || 165, SQ = opts.squareR || 17;   // радиус на града, на площада (по-голям — за главната забележителност)
  const P = { v: PLAN_V, cityId, tpl: T.tpl, R, square: { x: 0, z: 0, r: SQ }, hills: [], streets: [], lots: [] };

  // --- вода и релеф (функции; не се записват)
  const ph = [rr(0, TAU), rr(0, TAU), rr(0, TAU)];
  let waterAt = () => false, landPad = () => true;
  if (T.tpl === 'coastal') {
    const cz = x => -0.62 * R + 16 * Math.sin(x / 95 + ph[0]) + 7 * Math.sin(x / 38 + ph[1]);
    P.coastZ = cz; waterAt = (x, z) => z < cz(x); landPad = (x, z) => z > cz(x) + 12;   // плажна ивица
  } else if (T.tpl === 'river') {
    const rz = x => 0.3 * R * Math.sin(x / 105 + ph[0]) + 9 * Math.sin(x / 41 + ph[1]) + rr(-1, 1) * 0;
    P.riverZ = rz; P.riverW = 20; waterAt = (x, z) => Math.abs(z - rz(x)) < 10; landPad = (x, z) => Math.abs(z - rz(x)) > 14;
    P.square = { x: 0, z: rz(0) + (rz(0) > 0 ? -46 : 46), r: SQ };   // площадът — на единия бряг
  } else if (T.tpl === 'island') {
    const rot = rr(0.35, 0.6), Lh = 1.9 * R, Wh = 0.5 * R, c = Math.cos(rot), s = Math.sin(rot);
    const toUV = (x, z) => [x * c + z * s, -x * s + z * c], fromUV = (u, v) => [u * c - v * s, u * s + v * c];
    const half = u => Wh * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u) / Lh, 3))) * (1 + 0.07 * Math.sin(u / 33 + ph[0]));
    const bend = u => 12 * Math.sin(u / 140 + ph[1]);
    P.island = { rot, Lh, Wh, toUV, fromUV, half, bend };
    waterAt = (x, z) => { const [u, v] = toUV(x, z); return Math.abs(v - bend(u)) > half(u) + 9; };
    landPad = (x, z) => { const [u, v] = toUV(x, z); return Math.abs(v - bend(u)) < half(u) - 3; };
  }
  let bridgeOk = () => T.tpl === 'river';   // кои точки във водата са мост (само булевардите над реката)
  if (T.tpl === 'canal') {   // Амстердам: залив на север, полукръгли канали около стария център
    const bz = x => -0.42 * R + 6 * Math.sin(x / 70 + ph[0]), C = [0, -0.42 * R], rings = [0.3, 0.45, 0.6].map(f => f * R);
    const bay = !opts.noCoast;   // в играта морето на север е от seaside.js — тук остават само каналите
    const canalAt = (x, z) => z > bz(x) + 6 && rings.some(rc => Math.abs(Math.hypot(x - C[0], z - C[1]) - rc) < 4);
    if (bay) P.coastZ = bz; P.canals = { c: C, rings };
    waterAt = (x, z) => bay && z < bz(x) || canalAt(x, z);
    landPad = (x, z) => z > bz(x) + 12 && !rings.some(rc => Math.abs(Math.hypot(x - C[0], z - C[1]) - rc) < 8);
    bridgeOk = (x, z) => z > bz(x) + 3;   // над каналите — мостове, над залива — не
    P.square = { x: 0, z: bz(0) + 30, r: SQ };   // Дам — до залива
  } else if (T.tpl === 'eixample' && !opts.noCoast) {   // Барселона: морето на югоизток (бряг под ъгъл)
    const cz = x => -0.55 * R + 0.35 * x + 6 * Math.sin(x / 60 + ph[1]);
    P.coastZ = cz; waterAt = (x, z) => z < cz(x); landPad = (x, z) => z > cz(x) + 12;
  }
  if (T.tpl === 'mountain') {   // планина от едната страна (извън града)
    const a0 = opts.game ? -Math.PI / 2 + rr(-0.2, 0.2) : rr(0, TAU), spread = opts.game ? 0.35 : 0.8;   // в играта — на север (на запад е гарата, на юг магистралата, на изток летището)
    for (let k = 0; k < 7; k++) { const a = a0 + rr(-spread, spread), d = rr(1.55, 1.95) * R; P.hills.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: rr(40, 60), h: rr(35, 75) }); }
    P.mountainDir = a0;
  }
  if (T.hills) for (let k = 0; k < T.hills; k++) {   // хълмове между кварталите (Рио)
    const a = rr(0, TAU), d = rr(0.45, 0.95) * R; P.hills.push({ x: Math.cos(a) * d * 1.3, z: Math.abs(Math.sin(a)) * d * 0.7 + 10, s: rr(16, 26), h: rr(18, 32) });
  }
  if (OSM && cityId === 'sofia') {   // Витоша — на юг, зад магистралата (истинската посока)
    for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + rr(-0.45, 0.45), d = rr(1.85, 2.1) * R; P.hills.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: rr(90, 130), h: rr(90, 170) }); }
    P.mountainDir = Math.PI / 2;
  }
  // парковете от картата (Южен парк, Докторска градина…): без парцели, зелени, с дървета
  P.parks = OSM ? OSM.parks.map(q => ({ nm: q.nm, pts: q.pts })) : [];
  const parkAt = (x, z) => P.parks.some(q => inPoly([x, z], q.pts));
  P.parkAt = parkAt;
  const hillH = (x, z) => { let h = 0; for (const q of P.hills) h += q.h * Math.exp(-((x - q.x) ** 2 + (z - q.z) ** 2) / (2 * q.s * q.s)); return h; };

  // --- граница: неправилен контур (издължен при брега), прибран там, където почва планина/вода
  const sx = T.tpl === 'coastal' ? 1.55 : T.tpl === 'river' ? 1.2 : T.tpl === 'canal' || T.tpl === 'eixample' ? 1.25 : 1, sz = T.tpl === 'coastal' ? 0.85 : 1;
  const squarish = T.tpl === 'grid' || T.tpl === 'lenfant' || T.tpl === 'eixample';   // градовете-мрежи са по-ъгловати
  const bph = [rr(0, TAU), rr(0, TAU), rr(0, TAU)], NBd = 72, bnd = [];
  for (let k = 0; k < NBd; k++) {
    const a = k / NBd * TAU;
    let rad = R * (1 + 0.13 * Math.sin(3 * a + bph[0]) + 0.08 * Math.sin(5 * a + bph[1]) + 0.04 * Math.sin(9 * a + bph[2]));
    if (squarish) rad *= Math.pow(Math.pow(Math.abs(Math.cos(a)), 6) + Math.pow(Math.abs(Math.sin(a)), 6), -1 / 6) * 0.9;   // супер-елипса
    const cx = P.square.x * 0, cz0 = T.tpl === 'coastal' ? -0.05 * R : T.tpl === 'canal' ? 0.15 * R : 0;
    let px, pz;
    for (;;) { px = cx + Math.cos(a) * rad * sx; pz = cz0 + Math.sin(a) * rad * sz; if (rad < 30 || hillH(px, pz) < 1.2) break; rad -= 4; }
    if (T.tpl === 'island') { const I = P.island, [u] = I.toUV(Math.cos(a), Math.sin(a)); }
    bnd.push([px, pz]);
  }
  if (T.tpl === 'island') {   // при острова границата е самият бряг
    const I = P.island; bnd.length = 0;
    for (let k = 0; k <= 40; k++) { const u = -I.Lh + 2 * I.Lh * k / 40; bnd.push(I.fromUV(u, I.bend(u) - I.half(u))); }
    for (let k = 40; k >= 0; k--) { const u = -I.Lh + 2 * I.Lh * k / 40; bnd.push(I.fromUV(u, I.bend(u) + I.half(u))); }
  }
  P.boundary = bnd;
  const inCity = (x, z) => inPoly([x, z], bnd);
  const buildable = (x, z) => inCity(x, z) && !waterAt(x, z) && landPad(x, z) && hillH(x, z) < 0.8 && !(P.parks.length && parkAt(x, z));
  P.waterAt = waterAt; P.buildable = buildable;
  P.heightAt = (x, z) => {   // релеф: равно в града, хълмове и леки вълни отвън, дъно под водата
    if (waterAt(x, z)) return -3;
    let h = hillH(x, z);
    if (!inCity(x, z) && !opts.game) { const d = polyDist([x, z], bnd); h += smooth(10, 90, d) * (2.2 + 1.8 * Math.sin(x / 47 + ph[2]) * Math.cos(z / 53 + ph[0])); }
    if (T.tpl === 'coastal' && !waterAt(x, z)) h *= smooth(0, 20, z - P.coastZ(x));
    if (T.tpl === 'river') h *= smooth(10, 26, Math.abs(z - P.riverZ(x)));
    return h;
  };

  // --- улиците (контролни точки → извадка през 2 м)
  const raw = [];
  const add = (cls, ctrl, closed = false, o = {}) => raw.push({ cls, w: W[cls], pts: sampleCurve(ctrl, 2, closed), closed, ...o });
  const sq = P.square;
  if (OSM) { for (const st of OSM.streets) add(st.cls, st.pts, false, { nm: st.nm }); }   // истинските улици: Витоша, Цар Освободител, Дондуков…
  else if (T.tpl === 'plain' || T.tpl === 'mountain' || T.tpl === 'river') {
    const nR = T.tpl === 'river' ? 6 : 5 + (r() < 0.5 ? 1 : 0), a0 = rr(0, TAU), ang = [];
    for (let k = 0; k < nR; k++) ang.push(a0 + k * TAU / nR + rr(-0.18, 0.18));
    for (const a of ang) {   // радиални булеварди — от площада навън, с плавни завои; извън града продължават като шосе
      const ctrl = [[sq.x, sq.z]];
      for (const [f, b] of [[0.42, rr(-0.14, 0.14)], [0.85, rr(-0.12, 0.12)], [1.35, rr(-0.1, 0.1)], [opts.game ? 1.5 : 2.6, 0]]) ctrl.push([sq.x + Math.cos(a + b) * f * R * sx, sq.z + Math.sin(a + b) * f * R]);
      add('blvd', ctrl, false, { radial: true });
    }
    const ring = (f, cls, wob) => {   // пръстен с вълни
      const ctrl = [], n = 14, wp = rr(0, TAU);
      for (let k = 0; k < n; k++) { const a = k / n * TAU, rad = f * R * (1 + wob * Math.sin(3 * a + wp)); ctrl.push([sq.x + Math.cos(a) * rad * sx, sq.z + Math.sin(a) * rad * sz]); }
      add(cls, ctrl, true);
    };
    ring(0.55, 'ring', 0.07);
    // околовръстен — по самата граница на града
    { const ctrl = []; for (let k = 0; k < NBd; k += 4) { const [x, z] = bnd[k]; ctrl.push([x * 0.95, z * 0.95]); } add('ring', ctrl, true, { outer: true }); }
    // второстепенни: дъги между съседните булеварди и къси улици навън от пръстена
    const As = [...ang].sort((p, q) => ((p % TAU) + TAU) % TAU - ((q % TAU) + TAU) % TAU);
    for (let k = 0; k < As.length; k++) {
      const a1 = As[k], a2 = As[(k + 1) % As.length] + (k === As.length - 1 ? TAU : 0), da = a2 - a1;
      for (const f of [0.3, 0.8]) {
        const ctrl = []; for (const t of [-0.08, 0.3, 0.7, 1.08]) { const a = a1 + da * t, rad = f * R * (1 + rr(-0.07, 0.07)); ctrl.push([sq.x + Math.cos(a) * rad * sx, sq.z + Math.sin(a) * rad * sz]); }
        add('street', ctrl);
      }
      const am = a1 + da * rr(0.4, 0.6), ctrl = [];
      for (const [f, b] of [[0.45, 0], [0.75, rr(-0.1, 0.1)], [1.05, rr(-0.12, 0.12)]]) ctrl.push([sq.x + Math.cos(am + b) * f * R * sx, sq.z + Math.sin(am + b) * f * R * sz]);
      add('street', ctrl);
    }
    if (T.tpl === 'river') for (const sgn of [-1, 1]) {   // кейовете от двете страни на реката
      const ctrl = []; for (let x = -2.2 * R; x <= 2.2 * R; x += 30) ctrl.push([x, P.riverZ(x) + sgn * 17]);
      add('quay', ctrl);
    }
  } else if (T.tpl === 'coastal') {
    const cz = P.coastZ, xs = []; for (let x = -2.6 * R; x <= 2.6 * R; x += 30) xs.push(x);
    add('quay', xs.map(x => [x, cz(x) + 17]), false, { promenade: true });   // крайбрежният булевард
    const off1 = rr(58, 70), off2 = off1 + rr(52, 62);
    add('blvd', xs.map(x => [x, cz(x) * 0.55 + 0.45 * (-0.62 * R) + 17 + off1 + 8 * Math.sin(x / 70 + ph[2])]));
    add('street', xs.filter(x => Math.abs(x) < 1.9 * R).map(x => [x, cz(x) * 0.3 + 0.7 * (-0.62 * R) + 17 + off2 + 10 * Math.sin(x / 60 + ph[0])]));
    // пресечки от брега навътре — леко извити; средната е булевард към площада
    const midZ = -0.62 * R + 17 + off1;
    sq.x = 0; sq.z = midZ + 10 * Math.sin(ph[2]) + 0 ; sq.z = cz(0) * 0.55 + 0.45 * (-0.62 * R) + 17 + off1 + 8 * Math.sin(ph[2]);
    for (let x = -1.7 * R, k = 0; x <= 1.7 * R; x += rr(48, 60), k++) {
      const mid = Math.abs(x) < 26, X = mid ? 0 : x, ctrl = [];
      for (const dz of [0, 50, 110, 170, 240]) ctrl.push([X + (mid ? 0 : 9 * Math.sin(dz / 45 + k)), cz(X) + 17 + dz]);
      add(mid ? 'blvd' : 'street', ctrl);
    }
    if (!raw.some(s => s.cls === 'blvd' && Math.abs(s.pts[0][0]) < 1)) add('blvd', [[0, cz(0) + 17], [0, sq.z], [0, sq.z + 120], [0, sq.z + 240]]);
  } else if (T.tpl === 'island') {
    const I = P.island;
    for (const v of [-0.62, 0, 0.62]) {   // авенюта по дължината
      const ctrl = []; for (let u = -I.Lh; u <= I.Lh; u += 40) ctrl.push(I.fromUV(u, I.bend(u) + v * I.half(u)));
      add(v === 0 ? 'blvd' : 'street', ctrl);
    }
    for (let u = -I.Lh + 30; u < I.Lh - 20; u += rr(40, 46)) {   // напречни улици — правоъгълни квартали
      const ctrl = []; for (const v of [-1.2, -0.4, 0.4, 1.2]) ctrl.push(I.fromUV(u, I.bend(u) + v * I.half(u)));
      add(Math.abs(u) < 20 ? 'blvd' : 'street', ctrl);
    }
    { const ctrl = []; for (let k = 0; k < bnd.length; k += 2) { const [x, z] = bnd[k], [u, v] = I.toUV(x, z), b = I.bend(u); ctrl.push(I.fromUV(u * 0.985, b + (v - b) * 0.9)); } add('road', ctrl, true, { shore: true }); }
    const c0 = I.fromUV(0, I.bend(0)); sq.x = c0[0]; sq.z = c0[1];
  }

  // ---- шаблоните за големите градове (CITY_TPL)
  const far = (opts.game ? 1.5 : 2.6) * R;   // докъде излизат главните булеварди (шосетата навън)
  if (T.tpl === 'grid' || T.tpl === 'lenfant' || T.tpl === 'eixample') {
    // правоъгълна мрежа (леко завъртяна): къси квартали по едната ос, дълги по другата; всяка 3-та линия — булевард
    const th = T.tpl === 'eixample' ? Math.PI / 4 + rr(-0.05, 0.05) : rr(-0.22, 0.22), c = Math.cos(th), s = Math.sin(th), M = 1.3 * R;
    const at = (u, v) => [sq.x + u * c - v * s, sq.z + u * s + v * c];
    const bu = T.tpl === 'eixample' ? 46 : rr(40, 44), bv = T.tpl === 'eixample' ? 46 : rr(60, 66);
    for (let k = -Math.ceil(M / bu); k <= Math.ceil(M / bu); k++) { const u = k * bu, main = k === 0; add(main || k % 3 === 0 ? 'blvd' : 'street', [at(u, -(main ? far : M)), at(u, main ? far : M)], false, { radial: main, inner: !main }); }
    for (let k = -Math.ceil(M / bv); k <= Math.ceil(M / bv); k++) { const v = k * bv, main = k === 0; add(main || k % 3 === 0 ? 'blvd' : 'street', [at(-(main ? far : M), v), at(main ? far : M, v)], false, { radial: main, inner: !main }); }
    if (T.tpl === 'lenfant') {   // Вашингтон: диагонални авенюта от площада и успоредни на тях по-навън
      for (const [a, off] of [[Math.PI / 4, 0], [-Math.PI / 4, 0], [Math.PI / 4, 0.55 * R], [Math.PI / 4, -0.55 * R], [-Math.PI / 4, 0.55 * R], [-Math.PI / 4, -0.55 * R]]) {
        const dx = Math.cos(th + a), dz = Math.sin(th + a), nx = -dz * off, nz = dx * off;
        add(off ? 'street' : 'blvd', [[sq.x + nx - dx * M, sq.z + nz - dz * M], [sq.x + nx + dx * M, sq.z + nz + dz * M]], false, { diag: true, inner: true });
      }
    }
    if (T.tpl === 'eixample') {   // Барселона: „Диагонал“ и „Меридиана“ през мрежата
      for (const a of [rr(0.45, 0.6), -rr(0.9, 1.1)]) { const dx = Math.cos(th + a), dz = Math.sin(th + a); add('blvd', [[sq.x - dx * M, sq.z - dz * M], [sq.x + dx * M, sq.z + dz * M]], false, { diag: true, inner: true }); }
      if (P.coastZ) { const cz = P.coastZ, xs = []; for (let x = -2.6 * R; x <= 2.6 * R; x += 30) xs.push(x); add('quay', xs.map(x => [x, cz(x) + 17]), false, { promenade: true }); }
    }
    { const ctrl = []; for (let k = 0; k < NBd; k += 4) { const [x, z] = bnd[k]; ctrl.push([x * 0.95, z * 0.95]); } add('ring', ctrl, true, { outer: true }); }
  } else if (T.tpl === 'star') {
    // Москва/Пекин: много прави радиални булеварди и три концентрични пръстена (Булевардният, Садовото, МКАД)
    const nR = 10, a0 = rr(0, TAU);
    for (let k = 0; k < nR; k++) { const a = a0 + k * TAU / nR + rr(-0.05, 0.05); add('blvd', [[sq.x, sq.z], [sq.x + Math.cos(a) * 0.6 * R, sq.z + Math.sin(a) * 0.6 * R], [sq.x + Math.cos(a) * far, sq.z + Math.sin(a) * far]], false, { radial: true }); }
    for (const [f, cls] of [[0.27, 'street'], [0.52, 'ring'], [0.78, 'street']]) { const ctrl = []; for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; ctrl.push([sq.x + Math.cos(a) * f * R, sq.z + Math.sin(a) * f * R]); } add(cls, ctrl, true); }
    { const ctrl = []; for (let k = 0; k < NBd; k += 4) { const [x, z] = bnd[k]; ctrl.push([x * 0.95, z * 0.95]); } add('ring', ctrl, true, { outer: true }); }
    for (let k = 0; k < nR; k++) { const a = a0 + (k + 0.5) * TAU / nR; add('street', [[sq.x + Math.cos(a) * 0.27 * R, sq.z + Math.sin(a) * 0.27 * R], [sq.x + Math.cos(a) * 0.95 * R, sq.z + Math.sin(a) * 0.95 * R]]); }   // по-малки радиални между булевардите
  } else if (T.tpl === 'canal') {
    // Амстердам: пристанищна улица по залива, кейове от двете страни на всеки канал, радиални улици с мостове
    const { c: C, rings } = P.canals, bz = x => -0.42 * R + 6 * Math.sin(x / 70 + ph[0]), xs = []; for (let x = -2.6 * R; x <= 2.6 * R; x += 30) xs.push(x);
    if (P.coastZ) add('quay', xs.map(x => [x, bz(x) + 17]), false, { promenade: true });
    else add('street', xs.filter(x => Math.abs(x) < 1.6 * R).map(x => [x, bz(x) + 17]));   // без залив — улица по северния край
    for (const rc of rings) for (const d of [-9, 9]) { const ctrl = []; for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16; ctrl.push([C[0] + Math.cos(a) * (rc + d), C[1] + Math.sin(a) * (rc + d)]); } add('quay', ctrl); }
    for (const a of [0.2, 0.55, 0.95, 1.35, 1.57, 1.8, 2.2, 2.6, 2.95]) {   // радиални — от залива навън, през каналите
      const main = Math.abs(a - 1.57) < 0.01 || Math.abs(a - 0.55) < 0.01 || Math.abs(a - 2.6) < 0.01;
      add(main ? 'blvd' : 'street', [[C[0] + Math.cos(a) * 0.12 * R, C[1] + Math.sin(a) * 0.12 * R], [C[0] + Math.cos(a) * 0.75 * R, C[1] + Math.sin(a) * 0.75 * R], [C[0] + Math.cos(a) * (main ? far : 1.1 * R), C[1] + Math.sin(a) * (main ? far : 1.1 * R)]], false, { bridge: true, radial: main });
    }
    for (const [f, cls] of [[0.82, 'ring'], [1.02, 'street'], [1.22, 'street']]) { const ctrl = []; for (let k = 0; k < 14; k++) { const a = Math.PI * (0.03 + 0.94 * k / 13); ctrl.push([C[0] + Math.cos(a) * f * R * 1.25, C[1] + Math.sin(a) * f * R]); } add(cls, ctrl); }
    for (let k = 0; k < 8; k++) { const a = Math.PI * (k + 0.5) / 8; add('street', [[C[0] + Math.cos(a) * 0.82 * R * 1.25, C[1] + Math.sin(a) * 0.82 * R], [C[0] + Math.cos(a) * 1.4 * R * 1.25, C[1] + Math.sin(a) * 1.4 * R]]); }   // пресечки в новите квартали
    { const ctrl = []; for (let k = 0; k < NBd; k += 4) { const [x, z] = bnd[k]; ctrl.push([x * 0.95, z * 0.95]); } add('ring', ctrl, true, { outer: true }); }
  } else if (T.tpl === 'walled') {
    // стар град (Виена, Прага): гъсти криви улички в бившите крепостни стени, пръстен-булевард на мястото на стените, радиални навън
    const wallR = 0.36 * R, nR = 7, a0 = rr(0, TAU);
    { const ctrl = []; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctrl.push([sq.x + Math.cos(a) * wallR * (1 + rr(-0.06, 0.06)), sq.z + Math.sin(a) * wallR * (1 + rr(-0.06, 0.06))]); } add('ring', ctrl, true, { wall: true }); }
    for (let k = 0; k < nR; k++) { const a = a0 + k * TAU / nR + rr(-0.12, 0.12); add('blvd', [[sq.x + Math.cos(a) * wallR, sq.z + Math.sin(a) * wallR], [sq.x + Math.cos(a + rr(-0.1, 0.1)) * 0.75 * R, sq.z + Math.sin(a) * 0.75 * R], [sq.x + Math.cos(a) * far, sq.z + Math.sin(a) * far]], false, { radial: true }); }
    for (let k = 0; k < 9; k++) {   // криви улички в стария град: от площада до стената
      const a = a0 + k * TAU / 9 + rr(-0.2, 0.2), ctrl = [[sq.x, sq.z]];
      for (const f of [0.35, 0.7, 1.05]) { const b = a + rr(-0.35, 0.35); ctrl.push([sq.x + Math.cos(b) * f * wallR, sq.z + Math.sin(b) * f * wallR]); }
      add('street', ctrl);
    }
    { const ctrl = []; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctrl.push([sq.x + Math.cos(a) * 0.62 * wallR * (1 + rr(-0.1, 0.1)), sq.z + Math.sin(a) * 0.62 * wallR * (1 + rr(-0.1, 0.1))]); } add('street', ctrl, true); }
    // извън стените: втори пръстен и „гюрлен“ пояс от къси пресечки
    { const ctrl = []; for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; ctrl.push([sq.x + Math.cos(a) * 0.7 * R, sq.z + Math.sin(a) * 0.7 * R]); } add('street', ctrl, true); }
    for (let k = 0; k < nR * 2; k++) { const a = a0 + (k + 0.5) * TAU / (nR * 2); add('street', [[sq.x + Math.cos(a) * wallR, sq.z + Math.sin(a) * wallR], [sq.x + Math.cos(a) * 1.0 * R, sq.z + Math.sin(a) * 1.0 * R]]); }
    { const ctrl = []; for (let k = 0; k < NBd; k += 4) { const [x, z] = bnd[k]; ctrl.push([x * 0.95, z * 0.95]); } add('ring', ctrl, true, { outer: true }); }
  }

  // ---- мегаполис (opts.mega): по-голям град — при радиалните шаблони още пръстени и радиални улици, за да няма празни карета.
  // Собствен rng: обикновените планове не се променят.
  if (opts.mega && !['grid', 'lenfant', 'eixample', 'island', 'coastal'].includes(T.tpl)) {
    const r2 = rng(hashStr(`mega:${cityId}:v${PLAN_V}`)), m = (a, b) => lerp(a, b, r2());
    for (const f of [0.2, 0.42, 0.67, 0.9]) { const ctrl = [], wp = m(0, TAU); for (let k = 0; k < 18; k++) { const a = k / 18 * TAU, rad = f * R * (1 + 0.05 * Math.sin(3 * a + wp)); ctrl.push([sq.x + Math.cos(a) * rad * sx, sq.z + Math.sin(a) * rad * sz]); } add('street', ctrl, true); }
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU + m(-0.05, 0.05), f0 = k % 2 ? 0.45 : 0.22; add('street', [[sq.x + Math.cos(a) * f0 * R * sx, sq.z + Math.sin(a) * f0 * R * sz], [sq.x + Math.cos(a) * 0.98 * R * sx, sq.z + Math.sin(a) * 0.98 * R * sz]]); }
  }

  // --- изрязване: улиците спират във водата (булевардите я пресичат с мост), в планината и под площада
  // запазена зона за голямата забележителност (opts.bigZone = [w, d] в метри): на север от площада, без улици и парцели
  const BZ = opts.bigZone ? (P.bigZone = { x: sq.x, z: sq.z - sq.r - 6 - opts.bigZone[1] / 2, w: opts.bigZone[0], d: opts.bigZone[1], rot: 0 }) : null;
  const keep = (p, st) => {
    if (Math.hypot(p[0] - sq.x, p[1] - sq.z) < sq.r - 1) return false;
    if (BZ && rectHas(BZ, p, st.w / 2 + 2)) return false;
    if (hillH(p[0], p[1]) > (st.cls === 'blvd' ? 3 : 1)) return false;
    if (waterAt(p[0], p[1])) return st.cls === 'blvd' && T.tpl === 'river' || T.tpl === 'canal' && st.bridge && bridgeOk(p[0], p[1]);
    if (st.cls !== 'blvd' && st.cls !== 'road' && st.cls !== 'quay' && !inCity(p[0], p[1]) && !(st.outer)) return false;
    if (st.inner && !inCity(p[0], p[1])) return false;   // булевард само в града (мрежите)
    if (T.tpl === 'island' && !inCity(p[0], p[1]) && st.cls !== 'road') return false;
    if (T.tpl === 'river' && st.cls !== 'blvd' && st.cls !== 'quay' && !landPad(p[0], p[1])) return false;
    return true;
  };
  const LIM = 3.4 * R;
  let parts = [];
  for (const st of raw) {
    let run = [];
    const flush = () => { if (run.length > 1 && cumLen(run).at(-1) > 16) parts.push({ ...st, pts: run, closed: st.closed && run.length === st.pts.length }); run = []; };
    for (const p of st.pts) { if (keep(p, st) && Math.abs(p[0]) < LIM && Math.abs(p[1]) < LIM) run.push(p); else flush(); }
    flush();
  }
  // --- кръстовища и свързаност: възли там, където улиците се пресичат или краят опира в друга улица/площада
  const nodes = [{ x: sq.x, z: sq.z, square: true, deg: 0 }], nodeAt = (x, z) => {
    for (let i = 1; i < nodes.length; i++) if (Math.hypot(nodes[i].x - x, nodes[i].z - z) < 4) return i;
    nodes.push({ x, z, deg: 0 }); return nodes.length - 1;
  };
  const stops = parts.map(() => []);   // [s, възел] по всяка улица
  parts.forEach(st => { st.L = cumLen(st.pts); });
  const bb = parts.map(st => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of st.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, z0, x1, z1]; });
  const chunks = parts.map(st => { const o = []; for (let j0 = 1; j0 < st.pts.length; j0 += 8) { const j1 = Math.min(st.pts.length, j0 + 8); let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let j = j0 - 1; j < j1; j++) { const [x, z] = st.pts[j]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } o.push([x0, z0, x1, z1, j0, j1]); } return o; });
  for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
    const A = parts[a], B = parts[b], ba = bb[a], bq = bb[b];
    if (ba[2] < bq[0] || bq[2] < ba[0] || ba[3] < bq[1] || bq[3] < ba[1]) continue;
    const CB = chunks[b];
    for (let i = 1; i < A.pts.length; i++) {
      const p0 = A.pts[i - 1], p1 = A.pts[i], sx0 = Math.min(p0[0], p1[0]), sx1 = Math.max(p0[0], p1[0]), sz0 = Math.min(p0[1], p1[1]), sz1 = Math.max(p0[1], p1[1]);
      for (const c of CB) { if (c[2] < sx0 || sx1 < c[0] || c[3] < sz0 || sz1 < c[1]) continue;   // участъци по 8 отсечки: същият ред на j, без изпитване на далечните
      for (let j = c[4]; j < c[5]; j++) {
      const x = segX(p0, p1, B.pts[j - 1], B.pts[j]); if (!x) continue;
      const px = lerp(A.pts[i - 1][0], A.pts[i][0], x[0]), pz = lerp(A.pts[i - 1][1], A.pts[i][1], x[0]), n = nodeAt(px, pz);
      stops[a].push([lerp(A.L[i - 1], A.L[i], x[0]), n]); stops[b].push([lerp(B.L[j - 1], B.L[j], x[1]), n]);
    } } }
  }
  parts.forEach((st, a) => {   // краищата: до площада, до друга улица (Т-кръстовище) или задънени
    for (const end of [0, st.pts.length - 1]) {
      if (st.closed) continue;
      const p = st.pts[end], s = st.L[end];
      if (Math.hypot(p[0] - sq.x, p[1] - sq.z) < sq.r + 3) { stops[a].push([s, 0]); continue; }
      if (stops[a].some(([q]) => Math.abs(q - s) < 6)) continue;
      let best = null;
      parts.forEach((o, b) => { if (b === a) return; const d = polyDist(p, o.pts); if (d < (o.w + st.w) / 2 + 6 && (!best || d < best.d)) best = { b, d }; });
      if (best) {   // доведи края до оста на другата улица
        const o = parts[best.b]; let bi = 1, bd = 1e9, bt = 0;
        for (let i = 1; i < o.pts.length; i++) { const [d, t] = segDist(p, o.pts[i - 1], o.pts[i]); if (d < bd) { bd = d; bi = i; bt = t; } }
        const q = [lerp(o.pts[bi - 1][0], o.pts[bi][0], bt), lerp(o.pts[bi - 1][1], o.pts[bi][1], bt)], n = nodeAt(q[0], q[1]);
        if (end === 0) st.pts.unshift(q); else st.pts.push(q);
        st.L = cumLen(st.pts); if (end === 0) for (const t of stops[a]) t[0] += st.L[1];
        stops[a].push([end === 0 ? 0 : st.L.at(-1), n]); stops[best.b].push([lerp(o.L[bi - 1], o.L[bi], bt), n]);
      } else stops[a].push([s, nodeAt(p[0], p[1])]);   // задънена (или шосе извън града)
    }
  });
  // граф: ребра между съседните възли по всяка улица; остават само улиците, свързани с площада
  let edges = [];
  parts.forEach((st, a) => {
    const S = stops[a].sort((p, q) => p[0] - q[0]);
    if (st.closed && S.length) S.push([st.L.at(-1) + S[0][0], S[0][1]]);
    for (let k = 1; k < S.length; k++) if (S[k][1] !== S[k - 1][1]) edges.push({ a: S[k - 1][1], b: S[k][1], st: a, s0: S[k - 1][0], s1: S[k][0], len: S[k][0] - S[k - 1][0] });
  });
  const adj = nodes.map(() => []); for (const e of edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
  const seen = new Set([0]), q = [0]; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (!seen.has(n)) { seen.add(n); q.push(n); }
  const okSt = new Set(edges.filter(e => seen.has(e.a)).map(e => e.st));
  const remap = new Map(); parts.forEach((st, a) => { if (okSt.has(a)) { remap.set(a, P.streets.length); P.streets.push(st); } });
  edges = edges.filter(e => seen.has(e.a)).map(e => ({ ...e, st: remap.get(e.st) }));
  P.streets.forEach((st, i) => { st.id = i; st.name = st.cls + i; });
  for (const e of edges) { nodes[e.a].deg++; nodes[e.b].deg++; }
  P.nodes = nodes; P.edges = edges; P.connected = seen.size;

  // --- парцели покрай улиците: първо булевардите, после улиците; не върху улица, вода, хълм, площад или друг парцел
  const grid = new Map(), cell = 24, gk = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  const near = (x, z) => { const o = []; const i = Math.floor(x / cell), j = Math.floor(z / cell); for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) for (const L of grid.get(a + ',' + b) || []) o.push(L); return o; };
  const sgrid = new Map(); P.streets.forEach((st, si) => st.pts.forEach(p => { const k = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell); (sgrid.get(k) || sgrid.set(k, []).get(k)).push([p, st.w / 2, si]); }));
  const roadIn = L => {   // улица в парцела (с банкет 1 м)?
    const i = Math.floor(L.x / cell), j = Math.floor(L.z / cell);
    for (let a = i - 2; a <= i + 2; a++) for (let b = j - 2; b <= j + 2; b++) for (const [p, hw] of sgrid.get(a + ',' + b) || []) if (rectHas(L, p, hw + 1)) return true;
    return false;
  };
  const cand = [];
  const order = [...P.streets].sort((a, b) => (b.w - a.w) || a.id - b.id);
  for (const st of order) {
    if (st.cls === 'road' && T.tpl !== 'island') continue;
    const len = st.L.at(-1);
    for (const side of [1, -1]) {
      if (st.promenade && side < 0) continue;   // от морската страна — плаж
      for (let s = 10; s < len - 6;) {
        const pa = pointAt(st, s), dc = Math.hypot(pa.x - sq.x, pa.z - sq.z);
        const zone = dc < 0.34 * R ? 'center' : dc < 0.66 * R ? 'mid' : 'outer';
        let placed = false;
        for (const f of [1, 0.82]) {
          const [w, d] = LOT_SIZE[zone].map(v => v * f), m = pointAt(st, s + w / 2);
          const nx = -m.tz * side, nz = m.tx * side, off = st.w / 2 + 2 + d / 2;
          const L = { x: m.x + nx * off, z: m.z + nz * off, w, d, rot: Math.atan2(-nx, -nz), street: st.id, s: s + w / 2, side, zone };
          const cs = rectCorners(L.x, L.z, w / 2, d / 2, L.rot);
          if (![...cs, [L.x, L.z]].every(p => buildable(p[0], p[1]))) continue;
          if (Math.hypot(L.x - sq.x, L.z - sq.z) < sq.r + Math.hypot(w, d) / 2 + 2) continue;
          if (roadIn(L) || near(L.x, L.z).some(o => rectsOverlap(o, L, 0.8))) continue;
          if (BZ && rectsOverlap(BZ, L, 2)) continue;
          (grid.get(gk(L.x, L.z)) || grid.set(gk(L.x, L.z), []).get(gk(L.x, L.z))).push(L);
          // съседните клетки също трябва да го виждат при проверката
          for (const c2 of cs) { const k2 = gk(c2[0], c2[1]); if (k2 !== gk(L.x, L.z)) { const arr = grid.get(k2) || grid.set(k2, []).get(k2); if (!arr.includes(L)) arr.push(L); } }
          cand.push(L); s += w + 1.2; placed = true; break;
        }
        if (!placed) s += 3;
      }
    }
  }
  // постоянни id: по разстояние от площада (после по ъгъл) — първите 9 са центърът, следващите 16 средният пояс, както в мрежата 9×9
  cand.sort((a, b) => Math.round(Math.hypot(a.x - sq.x, a.z - sq.z)) - Math.round(Math.hypot(b.x - sq.x, b.z - sq.z)) || Math.atan2(a.z - sq.z, a.x - sq.x) - Math.atan2(b.z - sq.z, b.x - sq.x));
  cand.forEach((L, i) => {
    L.id = i; L.zone = i < 9 ? 'center' : i < 25 ? 'mid' : 'outer';
    const onBlvd = P.streets[L.street].w >= 10;
    L.kinds = LOT_KINDS[L.zone].filter(k => k !== 'factory' || !onBlvd).filter(k => k !== 'tower' || onBlvd || L.zone === 'center');
    for (const k of ['x', 'z', 'w', 'd', 'rot', 's']) L[k] = Math.round(L[k] * 100) / 100;
  });
  P.lots = cand;
  // градът трябва да побере поне колкото парцела има мрежата 9×9 (+ купените квартали) — иначе по-голям радиус
  const need = opts.minLots ?? 81;
  if (cand.length < need && R < (opts.mega ? 520 : 300)) { const Q = makePlan(cityId, { ...opts, R: Math.round(R * 1.08) }); cache.set(key, Q); return Q; }
  cache.set(key, P);
  while (cache.size > 12) cache.delete(cache.keys().next().value);   // паметта: само последните планове
  return P;
}

// парцелът под точка (за клик)
export function lotAt(P, x, z) { return P.lots.find(L => rectHas(L, [x, z])) || null; }
// стар град (мрежа 9×9 + купени квартали) → парцели от плана: същият брой, по същия ред на зоните (център, среден пояс, покрайнини)
// Сградите в старите записи НЕ се местят автоматично — това е картата, която би се ползвала при „Обнови плана“.
export function gridToPlan(P, gridLots) {
  const rank = l => ({ center: 0, mid: 1, outer: 2 })[l.zone] ?? 3, by = [...gridLots].sort((a, b) => rank(a) - rank(b) || a.id - b.id), m = new Map();
  by.forEach((g, i) => { if (P.lots[i]) m.set(g.id, P.lots[i].id); });
  return m;
}
// проверка (тестове): парцелите не са върху улица, вода, хълм или един върху друг; улиците са свързани
export function validatePlan(P) {
  const bad = [];
  for (const L of P.lots) {
    const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot);
    if (!cs.every(p => P.buildable(p[0], p[1]))) bad.push(['notBuildable', L.id]);
    for (const st of P.streets) if (st.pts.some(p => rectHas(L, p, st.w / 2 - 0.01))) { bad.push(['onStreet', L.id, st.id]); break; }
  }
  for (let i = 0; i < P.lots.length; i++) for (let j = i + 1; j < P.lots.length; j++) {
    const a = P.lots[i], b = P.lots[j];
    if (Math.hypot(a.x - b.x, a.z - b.z) < 30 && rectsOverlap(a, b)) bad.push(['overlap', a.id, b.id]);
  }
  const used = new Set(P.edges.flatMap(e => [e.a, e.b]));
  if ([...used].some(n => n >= P.nodes.length)) bad.push(['badNode']);
  return bad;
}

// същият план, преместен с (ox, oz) — за играта (градът започва там, където беше мрежата 9×9)
export function shiftPlan(P, ox, oz) {
  const mv = ([x, z]) => [x + ox, z + oz];
  const Q = { ...P, ox, oz, boundary: P.boundary.map(mv), square: { ...P.square, x: P.square.x + ox, z: P.square.z + oz },
    hills: P.hills.map(h => ({ ...h, x: h.x + ox, z: h.z + oz })),
    streets: P.streets.map(st => ({ ...st, pts: st.pts.map(mv) })), nodes: P.nodes.map(n => ({ ...n, x: n.x + ox, z: n.z + oz })),
    lots: P.lots.map(L => ({ ...L, x: Math.round((L.x + ox) * 100) / 100, z: Math.round((L.z + oz) * 100) / 100 })),
    parks: (P.parks || []).map(q => ({ ...q, pts: q.pts.map(mv) })), parkAt: (x, z) => P.parkAt ? P.parkAt(x - ox, z - oz) : false,
    heightAt: (x, z) => P.heightAt(x - ox, z - oz), waterAt: (x, z) => P.waterAt(x - ox, z - oz), buildable: (x, z) => P.buildable(x - ox, z - oz) };
  if (P.canals) Q.canals = { ...P.canals, c: mv(P.canals.c) };
  if (P.bigZone) Q.bigZone = { ...P.bigZone, x: P.bigZone.x + ox, z: P.bigZone.z + oz };
  if (P.coastZ) Q.coastZ = x => P.coastZ(x - ox) + oz;
  if (P.riverZ) Q.riverZ = x => P.riverZ(x - ox) + oz;
  return Q;
}
