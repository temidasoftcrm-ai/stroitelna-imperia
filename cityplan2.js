// cityplan2.js — план на града v2 (формат: _source/tasks/plan-v2-format.md). Един общ генератор с настройки:
// 4 семейства (eu — европейска, us — американска, coast — крайбрежна, radial — радиална) × 4 размера (s, m, l, xl).
// Ред: граница и вход към града → главни булеварди (скелет) → квартали между тях → второстепенни улици → граф с
// правила (Т и 4-клонни, без 5+, без остри ъгли, без къси връзки и дубли) → кръгови → парцели с лице към улицата.
// Само данни и геометрия (без THREE); един и същ cityId + fam + size + seed + ext → същият план и същите id на парцелите.
// Записът пази само { v: 2, fam, size, seed, ext } — старите градове (план v1, cityplan.js) не се прегенерират.

export const PLAN2_V = 2;
const TAU = Math.PI * 2;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---- класове пътища: ленти [напред, назад], ширина на лента, разделителна ивица, тротоар
const CLS = {
  blvd: { lanes: [2, 2], laneW: 3.3, median: 3, walk: 3, rank: 4 },
  ring: { lanes: [2, 2], laneW: 3.3, median: 2, walk: 2.5, rank: 3 },
  quay: { lanes: [1, 1], laneW: 3.3, median: 0, walk: 4, rank: 3 },
  street: { lanes: [1, 1], laneW: 3.1, median: 0, walk: 2.5, rank: 1 },
};
const widthOf = c => { const k = CLS[c]; return (k.lanes[0] + k.lanes[1]) * k.laneW + k.median; };
const isMain = c => c === 'blvd' || c === 'ring' || c === 'quay';

// ---- размери: радиус на града, разстояние между улиците в кварталите [успоредни, напречни], брой кръгови
const SIZE = {
  s: { R: 170, a: 64, b: 96, rounds: 0 },
  m: { R: 270, a: 66, b: 104, rounds: 1 },
  l: { R: 390, a: 70, b: 112, rounds: 3 },
  xl: { R: 540, a: 72, b: 118, rounds: 5 },
};
// парцели по зона: [ширина по улицата, дълбочина]
const LOT = { center: [20, 24], business: [26, 28], residential: [16, 20], periphery: [26, 30] };

// ---- геометрия
function catmull(ctrl, step = 4) {   // плавна крива през контролните точки, точки през ~step м
  const P = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]], out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const n = Math.max(1, Math.ceil(dist(P[i], P[i + 1]) / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]); }
  }
  out.push(ctrl[ctrl.length - 1].slice()); return out;
}
function closedCurve(ctrl, step = 4) {   // затворена крива; последната точка = първата
  const n = ctrl.length, P = [ctrl[n - 1], ...ctrl, ctrl[0], ctrl[1]], out = [];
  for (let i = 1; i <= n; i++) {
    const m = Math.max(1, Math.ceil(dist(P[i], P[i + 1]) / step));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0]), f(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1])]); }
  }
  out.push(out[0].slice()); return out;
}
const cumLen = pts => { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1])); return L; };
function resample(pts, step) {
  const L = cumLen(pts), T = L[L.length - 1], n = Math.max(1, Math.round(T / step)), out = [];
  let j = 1;
  for (let k = 0; k <= n; k++) { const s = T * k / n; while (j < L.length - 1 && L[j] < s) j++; const t = (s - L[j - 1]) / ((L[j] - L[j - 1]) || 1); out.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]); }
  return out;
}
function segX(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}
function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
export function inPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c; }
  return c;
}
export function rectCorners(x, z, hw, hd, rot) {
  const c = Math.cos(rot), s = Math.sin(rot), o = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) o.push([x + u * c + v * s, z - u * s + v * c]);
  return o;
}
function rectsOverlap(a, b, pad = 0) {   // SAT
  const A = rectCorners(a.x, a.z, a.w / 2 + pad, a.d / 2 + pad, a.rot), B = rectCorners(b.x, b.z, b.w / 2, b.d / 2, b.rot);
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const p = P[i], q = P[(i + 1) % 4], nx = q[1] - p[1], nz = p[0] - q[0];
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const v of A) { const d = v[0] * nx + v[1] * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const v of B) { const d = v[0] * nx + v[1] * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}
// мрежа от точки за бързо „най-близко“
function pointGrid(cell) {
  const m = new Map(), k = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  return {
    add(p, v) { const kk = k(p[0], p[1]); (m.get(kk) || m.set(kk, []).get(kk)).push([p, v]); },
    near(p, r, f) { const n = Math.ceil(r / cell), i0 = Math.floor(p[0] / cell), j0 = Math.floor(p[1] / cell); for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const e of m.get((i0 + i) + ',' + (j0 + j)) || []) if (dist(e[0], p) <= r) f(e[0], e[1]); },
  };
}

// ---- скелет по семейство: граница, вода, главни пътища (линии с клас), центрове на квартали
function skeleton(fam, size, r) {
  const Z = SIZE[size], R = Z.R * (fam === 'coast' ? 1.3 : 1) /* крайбрежният — по-голям радиус: половината кръг е вода */, rr = (a, b) => lerp(a, b, r()), lines = [], hubs = [{ x: 0, z: 0, main: true }];
  const big = size === 'l' || size === 'xl';
  let bnd = [], waterAt = () => false, coastZ = null;
  const ring = (rad, cls, n = 18, wob = 0.05) => { const ph = rr(0, TAU), c = []; for (let k = 0; k < n; k++) { const a = k / n * TAU; c.push([Math.cos(a) * rad * (1 + wob * Math.sin(3 * a + ph)), Math.sin(a) * rad * (1 + wob * Math.sin(3 * a + ph))]); } lines.push({ cls, pts: closedCurve(c), closed: true }); };
  const radial = (a, r0, r1, cls, bend = 0.06) => { const n = 4, c = []; for (let k = 0; k <= n; k++) { const f = lerp(r0, r1, k / n), b = a + (k && k < n ? rr(-bend, bend) : 0); c.push([Math.cos(b) * f, Math.sin(b) * f]); } lines.push({ cls, pts: catmull(c) }); };
  // граница: леко неправилен кръг (крайбрежният — до брега)
  for (let k = 0; k < 48; k++) { const a = k / 48 * TAU, f = 1 + 0.07 * Math.sin(2 * a + rr(0, 0.3)) + 0.04 * Math.sin(5 * a); bnd.push([Math.cos(a) * R * f, Math.sin(a) * R * f]); }
  const ang0 = rr(0, TAU);
  if (fam === 'eu') {
    const nE = { s: 2, m: 3, l: 4, xl: 5 }[size];
    const angs = Array.from({ length: nE }, (_, i) => ang0 + i * TAU / nE + rr(-0.25, 0.25));
    if (size === 's') { const a = angs[0]; lines.push({ cls: 'blvd', pts: catmull([[Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1], [Math.cos(a) * R * 0.4 + rr(-15, 15), Math.sin(a) * R * 0.4 + rr(-15, 15)], [rr(-8, 8), rr(-8, 8)], [-Math.cos(a) * R * 0.45, -Math.sin(a) * R * 0.45], [-Math.cos(a) * R * 1.1, -Math.sin(a) * R * 1.1]]) }); }
    else angs.forEach((a, i) => radial(a, i >= 4 ? R * 0.3 : 0, R * 1.1, 'blvd', 0.09));   // до центъра — най-много 4 направления; останалите тръгват от вътрешния пръстен
    if (size === 'm') ring(R * 0.55, 'ring', 16, 0.08);
    // големите европейски — не пълни кръгове (иначе приличат на радиалните): непълни дъги между булевардите и отделни квартали
    const arc = (rad, a0, a1, cls, wob = 0.05) => { const n = Math.max(3, Math.ceil((a1 - a0) / 0.3)), ph = rr(0, TAU), c = []; for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); c.push([Math.cos(a) * rad * (1 + wob * Math.sin(2 * a + ph)), Math.sin(a) * rad * (1 + wob * Math.sin(2 * a + ph))]); } lines.push({ cls, pts: catmull(c) }); };
    if (size === 'l') { arc(R * 0.3, angs[0] - 0.08, angs[3] + 0.08, 'street'); arc(R * 0.86, angs[1] - 0.1, angs[3] + 0.1, 'ring'); }   // стар център (¾ дъга) и обход от едната страна
    if (size === 'xl') { arc(R * 0.3, angs[1] - 0.08, angs[4] + 0.08, 'street'); arc(R * 0.9, angs[2] - 0.1, angs[4] + 0.1, 'ring'); arc(R * 0.62, angs[0] - 0.08, angs[1] + 0.08, 'ring', 0.08); }
    if (size === 'xl') for (let i = 0; i < 3; i++) { const a = ang0 + (i + 0.5) * TAU / 3, h = { x: Math.cos(a) * R * 0.6, z: Math.sin(a) * R * 0.6 }; hubs.push(h); radial(a + 0.6, R * 0.62, R * 0.6, 'blvd'); }
  } else if (fam === 'radial') {
    const nR = { s: 3, m: 4, l: 6, xl: 8 }[size];
    const rIn = size === 'xl' ? R * 0.28 : R * 0.33;
    for (let i = 0; i < nR; i++) radial(ang0 + i * TAU / nR + rr(-0.12, 0.12), nR > 4 && i % 2 ? rIn : 0, R * 1.1, 'blvd', 0.04);   // до центъра — само основните (≤ 4), другите — от вътрешния пръстен
    if (size === 's') ring(R * 0.5, 'street', 12, 0.04);
    if (size === 'm') ring(R * 0.5, 'ring', 16, 0.04);
    if (size === 'l') { ring(R * 0.33, 'ring', 14, 0.03); ring(R * 0.7, 'street', 20, 0.04); ring(R * 0.93, 'ring', 24, 0.03); }
    if (size === 'xl') { ring(R * 0.28, 'ring', 14, 0.03); ring(R * 0.55, 'ring', 20, 0.03); ring(R * 0.8, 'street', 24, 0.04); ring(R * 0.95, 'ring', 28, 0.03); }
  } else if (fam === 'us') {
    const nB = { s: 0, m: 1, l: 2, xl: 3 }[size], sp = { m: 0, l: 3, xl: 3 }[size] || 0, a = Z.a, b = Z.b;
    lines.push({ cls: 'blvd', pts: resample([[-R * 1.1, 0], [R * 1.1, 0]], 4) });   // главната улица / първият булевард по x
    if (nB >= 1) lines.push({ cls: 'blvd', pts: resample([[0, -R * 1.1], [0, R * 1.1]], 4) });
    if (size === 'l' || size === 'xl') for (const k of [-1, 1]) { lines.push({ cls: 'blvd', pts: resample([[-R * 1.1, k * a * sp], [R * 1.1, k * a * sp]], 4) }); lines.push({ cls: 'blvd', pts: resample([[k * b * sp, -R * 1.1], [k * b * sp, R * 1.1]], 4) }); }
    if (size === 'l' || size === 'xl') { const q = R * 0.93, c = []; for (let k = 0; k < 24; k++) { const t = k / 24 * TAU, s = Math.sign; const x = Math.cos(t), z = Math.sin(t); c.push([s(x) * Math.pow(Math.abs(x), 0.4) * q, s(z) * Math.pow(Math.abs(z), 0.4) * q]); } lines.push({ cls: 'ring', pts: closedCurve(c), closed: true }); }   // периферен скоростен път (заоблен правоъгълник)
    if (size === 'xl') { hubs.push({ x: b * 3, z: a * 3 }, { x: -b * 3, z: -a * 3 }); }
    bnd = []; for (let k = 0; k < 48; k++) { const t = k / 48 * TAU, x = Math.cos(t), z = Math.sin(t), s = Math.sign; bnd.push([s(x) * Math.pow(Math.abs(x), 0.55) * R, s(z) * Math.pow(Math.abs(z), 0.55) * R]); }
  } else if (fam === 'coast') {
    const amp = size === 'xl' ? 0.22 : 0.08, ph = rr(0, TAU), z0 = -R * 0.45;
    coastZ = x => z0 + R * amp * Math.cos(x / R * Math.PI * (size === 'xl' ? 1 : 1.6) + ph) + (size === 'xl' ? R * 0.18 * (1 - Math.cos(x / R * Math.PI)) * 0 : 0);
    if (size === 'xl') coastZ = x => z0 - R * 0.25 + R * 0.35 * Math.cos(x / R * 1.6);   // залив: средата е навътре
    waterAt = (x, z) => z < coastZ(x);
    const off = (d, cls) => { const p = []; for (let x = -R * 1.1; x <= R * 1.1; x += 4) p.push([x, coastZ(x) + d]); lines.push({ cls, pts: p }); };
    off(14, 'quay');
    if (size !== 's') off(R * 0.42, 'blvd');
    if (big) off(R * 0.82, 'ring');
    const nE = { s: 1, m: 2, l: 3, xl: 4 }[size];
    const entX = [];
    for (let i = 0; i < nE; i++) { const x = lerp(-R * 0.6, R * 0.6, nE === 1 ? 0.5 : i / (nE - 1)) + rr(-20, 20); entX.push(x); lines.push({ cls: size === 's' ? 'street' : 'blvd', pts: catmull([[x, coastZ(x) + 14], [x + rr(-25, 25), coastZ(x) + R * 0.5], [x + rr(-30, 30), R * 1.1]]) }); }
    // напречни улици по границите на кварталните ивици (localStreets) — там ивиците се срещат; без тях улиците им свършваха една срещу друга
    const nS = { s: 2, m: 3, l: 4, xl: 6 }[size];
    for (let i = 1; i < nS; i++) { const x = lerp(-R * 1.1, R * 1.1, i / nS); if (entX.some(e => Math.abs(e - x) < 45)) continue; lines.push({ cls: 'street', pts: catmull([[x, coastZ(x) + 14], [x + rr(-8, 8), coastZ(x) + R * 0.6], [x + rr(-10, 10), R * 1.1]]) }); }
    bnd = bnd.map(([x, z]) => [x, Math.max(z, coastZ(x) - 2)]);
    hubs[0] = { x: 0, z: coastZ(0) + R * 0.22, main: true };
    if (size === 'xl') hubs.push({ x: -R * 0.55, z: coastZ(-R * 0.55) + R * 0.2 }, { x: R * 0.55, z: coastZ(R * 0.55) + R * 0.2 });
  }
  return { R, bnd, lines, hubs, waterAt, coastZ };
}

// ---- истинска карта (OpenStreetMap, cityplan2-osm.js — подава се от извикващия: plan2('rome', { osm: OSM2.rome })):
// без измислен скелет — улиците са от картата (тесните улички вече са опростени при генерирането на данните), а графът,
// правилата за възлите и парцелите — същите. Двойните еднопосочни платна на булевардите стават един път с ленти в двете посоки.
function osmSkeleton(D) {
  const lines = [], g = pointGrid(10), mains = D.roads.filter(r => r.cls !== 'street').concat(D.roads.filter(r => r.cls === 'street'));
  for (const r of mains) {
    const pts = resample(r.pts, 4);
    if (r.oneway && r.cls !== 'street') { let near = 0; for (const p of pts) { let hit = false; g.near(p, 9, () => { hit = true; }); if (hit) near++; } if (near > pts.length * 0.6) continue; }   // второто платно на двойния булевард
    if (r.cls !== 'street') pts.forEach(p => g.add(p, 1));
    lines.push({ cls: r.cls, pts, noCars: !!r.noCars, bridge: !!r.bridge, nm: r.nm || '' });
  }
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const L of lines) for (const [x, z] of L.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const bnd = [[x0 - 4, z0 - 4], [x1 + 4, z0 - 4], [x1 + 4, z1 + 4], [x0 - 4, z1 + 4]];
  const riv = D.river || [], hw = D.riverHW || 12, isl = D.island;
  const inIsl = (x, z) => { if (!isl) return false; const c = Math.cos(isl.rot), s2 = Math.sin(isl.rot), dx = x - isl.x, dz = z - isl.z, u = dx * c - dz * s2, v = dx * s2 + dz * c; return (u / (isl.w / 2)) ** 2 + (v / (isl.d / 2)) ** 2 < 1; };
  const rg = pointGrid(16); riv.forEach(R2 => resample(R2, 3).forEach(p => rg.add(p, 1)));
  const waterAt = (x, z) => { let w = false; rg.near([x, z], hw, () => { w = true; }); return w && !inIsl(x, z); };
  return { R: Math.max(x1 - x0, z1 - z0) / 2, bnd, lines, hubs: [{ x: 0, z: 0, main: true }], waterAt, coastZ: null, greens: D.greens || [], osm: D };
}

// ---- квартални улици: решетка в рамка (ъгъл), изрязана до района, далеч от главните пътища; краищата — до главния път (Т)
function localStreets(sk, fam, size, r, majorNear) {
  const Z = SIZE[size], R = sk.R, out = [], rr = (a, b) => lerp(a, b, r());
  const C = sk.hubs[0];
  // райони: за радиалния и европейския — клинове по ъгъл между булевардите; за американския — едно; за крайбрежния — ивици по брега
  const regions = [];
  if (fam === 'us') regions.push({ ang: 0, a: Z.a, b: Z.b, ok: () => true, ox: 0, oz: 0 });
  else if (fam === 'coast') { const n = { s: 2, m: 3, l: 4, xl: 6 }[size]; for (let i = 0; i < n; i++) { const x0 = lerp(-R * 1.1, R * 1.1, i / n), x1 = lerp(-R * 1.1, R * 1.1, (i + 1) / n), xm = (x0 + x1) / 2, tz = (sk.coastZ(xm + 5) - sk.coastZ(xm - 5)) / 10; regions.push({ ang: Math.atan(tz), a: Z.a * rr(0.9, 1.1), b: Z.b * rr(0.9, 1.15), ok: p => p[0] >= x0 && p[0] < x1, ox: xm, oz: sk.coastZ(xm) + 14 }); } }
  else {
    const n = { s: 4, m: 6, l: 8, xl: 10 }[size], a0 = r() * TAU;
    for (let i = 0; i < n; i++) { const A0 = a0 + i * TAU / n, A1 = A0 + TAU / n, am = (A0 + A1) / 2;
      const rIn = fam === 'radial' ? R * 0.2 : R * 0.12;
      regions.push({ ang: am + rr(-0.2, 0.2), a: Z.a * rr(0.88, 1.12), b: Z.b * rr(0.9, 1.15), ok: p => { let t = Math.atan2(p[1] - C.z, p[0] - C.x) - A0; t = ((t % TAU) + TAU) % TAU; return t < TAU / n && Math.hypot(p[0] - C.x, p[1] - C.z) > rIn; }, ox: C.x + Math.cos(am) * R * 0.5, oz: C.z + Math.sin(am) * R * 0.5 }); }
  }
  const inside = p => inPoly(p, sk.bnd) && !sk.waterAt(p[0], p[1] - 6);
  const CLEAR = 20;   // до главния път не се стига: краят после се доизтегля до него (Т)
  for (const g of regions) {
    const u = [Math.cos(g.ang), Math.sin(g.ang)], v = [-u[1], u[0]], span = R * 2.4;
    for (const [dir, nrm, sp] of [[u, v, g.a], [v, u, g.b]]) {
      const off0 = rr(0, sp);
      for (let k = -Math.ceil(span / sp); k <= Math.ceil(span / sp); k++) {
        const o = off0 + k * sp, run = [], flush = () => { if (run.length > 1 && dist(run[0], run[run.length - 1]) >= 36) out.push({ cls: 'street', pts: run.slice() }); run.length = 0; };
        for (let s = -span; s <= span; s += 4) {
          const p = [g.ox + nrm[0] * o + dir[0] * s, g.oz + nrm[1] * o + dir[1] * s];
          if (g.ok(p) && inside(p) && majorNear(p, CLEAR) === null) run.push(p); else flush();
        }
        flush();
      }
    }
  }
  return out;
}

// ---- граф: пресичания → възли, ребра между възлите; правила
function buildGraph(lines, opts) {
  const nodes = [], ng = pointGrid(16);
  const nodeAt = (p, rank) => { let best = -1, bd = opts.merge; ng.near(p, opts.merge, (q, i) => { const d = dist(q, p); if (d < bd) { bd = d; best = i; } }); if (best >= 0) { if (rank > nodes[best].rank) { nodes[best].rank = rank; } return best; } nodes.push({ x: p[0], z: p[1], rank }); ng.add(p, nodes.length - 1); return nodes.length - 1; };
  // мрежа от отсечки
  const sg = new Map(), cell = 24, key = (i, j) => i + ',' + j;
  lines.forEach((L, li) => { for (let s = 1; s < L.pts.length; s++) { const a = L.pts[s - 1], b = L.pts[s]; const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell), j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); (sg.get(k) || sg.set(k, []).get(k)).push([li, s]); } } });
  const cuts = lines.map(() => []);
  const seen = new Set();
  for (const arr of sg.values()) for (let x = 0; x < arr.length; x++) for (let y = x + 1; y < arr.length; y++) {
    const [la, sa] = arr[x], [lb, sb] = arr[y]; if (la === lb && Math.abs(sa - sb) < 3) continue;
    const id = la < lb || (la === lb && sa < sb) ? la + ':' + sa + ':' + lb + ':' + sb : lb + ':' + sb + ':' + la + ':' + sa; if (seen.has(id)) continue; seen.add(id);
    const A = lines[la].pts, B = lines[lb].pts, t = segX(A[sa - 1], A[sa], B[sb - 1], B[sb]); if (!t) continue;
    const p = [lerp(A[sa - 1][0], A[sa][0], t[0]), lerp(A[sa - 1][1], A[sa][1], t[0])], rank = Math.max(CLS[lines[la].cls].rank, CLS[lines[lb].cls].rank);
    const n = nodeAt(p, rank); cuts[la].push([sa - 1 + t[0], n]); cuts[lb].push([sb - 1 + t[1], n]);
  }
  const edges = [];
  lines.forEach((L, li) => {
    const c = cuts[li].sort((p, q) => p[0] - q[0]);
    if (!L.closed) { c.unshift([0, nodeAt(L.pts[0], 0)]); c.push([L.pts.length - 1, nodeAt(L.pts[L.pts.length - 1], 0)]); }
    else if (c.length) c.push([c[0][0] + L.pts.length - 1, c[0][1]]);
    const at = f => { const n = L.pts.length - 1, ff = ((f % n) + n) % n, i = Math.min(n - 1, Math.floor(ff)), t = ff - i; return [lerp(L.pts[i][0], L.pts[i + 1][0], t), lerp(L.pts[i][1], L.pts[i + 1][1], t)]; };
    for (let k = 1; k < c.length; k++) {
      const [f0, a] = c[k - 1], [f1, b] = c[k]; if (a === b) continue;
      const pts = [[nodes[a].x, nodes[a].z]]; for (let f = Math.floor(f0) + 1; f < f1; f++) pts.push(at(f)); pts.push([nodes[b].x, nodes[b].z]);
      edges.push({ a, b, cls: L.cls, pts, src: li, noCars: !!L.noCars, bridge: !!L.bridge, nm: L.nm || '' });
    }
  });
  return { nodes, edges };
}
function edgeLen(e) { let s = 0; for (let i = 1; i < e.pts.length; i++) s += dist(e.pts[i], e.pts[i - 1]); return s; }
function armDir(e, n) {   // посоката на ребро навън от възел n (по първите ~10 м)
  const P = e.a === n ? e.pts : e.pts.slice().reverse(), p0 = P[0]; let q = P[P.length - 1];
  for (const p of P) if (dist(p, p0) >= 10) { q = p; break; }
  return Math.atan2(q[1] - p0[1], q[0] - p0[0]);
}
function applyRules(G, opts) {
  let E = G.edges.filter(e => e.a !== e.b && edgeLen(e) > 0.5);
  const rank = e => CLS[e.cls].rank;
  for (let it = 0; it < 12; it++) {
    let changed = false;
    // дубли (същите два възела) — остава по-важният
    const pair = new Map(); E = E.filter(e => { const k = Math.min(e.a, e.b) + ':' + Math.max(e.a, e.b), o = pair.get(k); if (!o) { pair.set(k, e); return true; } if (rank(e) > rank(o) || (rank(e) === rank(o) && edgeLen(e) < edgeLen(o))) { o.dead = 1; pair.set(k, e); return true; } changed = true; return false; }).filter(e => !e.dead);
    const inc = G.nodes.map(() => []); E.forEach(e => { inc[e.a].push(e); inc[e.b].push(e); });
    const kill = new Set();
    G.nodes.forEach((n, ni) => {
      const arms = inc[ni].filter(e => !kill.has(e)).map(e => ({ e, a: armDir(e, ni) })).sort((p, q) => p.a - q.a);
      if (arms.length < 2) return;
      // остри ъгли: махни по-маловажния/по-късия (само квартални)
      for (let k = 0; k < arms.length; k++) {
        const A = arms[k], B = arms[(k + 1) % arms.length]; let d = B.a - A.a; if (k === arms.length - 1) d += TAU;
        if (arms.length > 1 && d < opts.minAngle) { const w = rank(A.e) < rank(B.e) || (rank(A.e) === rank(B.e) && edgeLen(A.e) < edgeLen(B.e)) ? A.e : B.e; if (rank(w) <= 1 || (rank(A.e) === rank(B.e) && rank(w) <= 3 && w.cls !== 'blvd')) { if (rank(w) <= 1) { kill.add(w); changed = true; return; } } }
      }
      // 5+ клона
      const live = arms.filter(x => !kill.has(x.e));
      if (live.length >= 5) { const loc = live.filter(x => rank(x.e) <= 1).sort((p, q) => edgeLen(p.e) - edgeLen(q.e)); for (let k = 0; k < live.length - 4 && k < loc.length; k++) kill.add(loc[k].e); changed = true; }
    });
    // къси връзки между кръстовища; къси задънени
    const deg = G.nodes.map(() => 0); E.forEach(e => { if (!kill.has(e)) { deg[e.a]++; deg[e.b]++; } });
    for (const e of E) { if (kill.has(e) || rank(e) > 1) continue; const L = edgeLen(e);
      if (L < opts.minLen && deg[e.a] >= 3 && deg[e.b] >= 3) { kill.add(e); changed = true; }
      else if ((deg[e.a] === 1 || deg[e.b] === 1) && L < opts.minStub) { kill.add(e); changed = true; } }
    E = E.filter(e => !kill.has(e));
    if (!changed) break;
  }
  return E;
}

// помощните функции на плана (ленти, завои, кръгови, мостове, избор и резервации) — и при готов (записан) план
function attachPlan2(P) {
  const armOf = (n, roadId, end) => n.arms.find(a => a.road === roadId && a.end === end);
  const nodeR = (n, roadId, end, inbound) => { if (n.kind === 'round') return P.rounds.find(r2 => r2.node === n.id).outer + 1; const a = n.arms.length >= 3 && armOf(n, roadId, end); return a && a.t != null ? a.t + (inbound ? P.STOP : 1) : n.r || 0; };
  const trim = (pts, s0, s1) => { const L = cumLen(pts), T = L[L.length - 1], out = []; if (T - s0 - s1 < 1) { const m = Math.max(0.5, Math.min(T - 0.5, T * s0 / ((s0 + s1) || 1))); s0 = m - 0.5; s1 = T - m - 0.5; }   /* срезовете се застъпват (къс път между две кръстовища) — къса отсечка между тях, не целият път */ let j = 1; const at = s => { while (j < L.length - 1 && L[j] < s) j++; const t = (s - L[j - 1]) / ((L[j] - L[j - 1]) || 1); return [lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]; };
    out.push(at(s0)); for (let k = 0; k < L.length; k++) if (L[k] > s0 + 0.3 && L[k] < T - s1 - 0.3) out.push(pts[k]); j = 1; out.push(at(T - s1)); return out; };   // без отсечки под 0,3 м на краищата
  // мостовете: платното над водата е на DECK_Y м; рампите — линейно до DECK_R м от двата бряга (по-къси, ако пътят свършва преди това)
  const DECK_Y = 0, DECK_R = 16;   // Рим: улиците (и кейовете Лунготевере) са високо над реката — мостовете са на нивото на улицата, водата е долу между стените
  for (const rd of P.roads) { const T = rd.L[rd.L.length - 1]; rd.deck = rd.bridge.map(([b0, b1]) => [Math.max(0, b0 + 4), Math.min(T, b1 - 4), DECK_Y]).filter(([a, b]) => b - a > 2); }
  P.roadY = (roadId, s) => { const rd = P.roads[roadId]; if (!rd || !rd.deck.length) return 0; const T = rd.L[rd.L.length - 1]; let y = 0;
    for (const [a, b, h] of rd.deck) { const ri = Math.min(DECK_R, a), ro = Math.min(DECK_R, T - b); const f = s >= a && s <= b ? 1 : s < a ? (ri > 0.5 ? (s - (a - ri)) / ri : 0) : (ro > 0.5 ? ((b + ro) - s) / ro : 0); y = Math.max(y, h * Math.max(0, Math.min(1, f))); }
    return y; };
  P.lanePath = (roadId, dir, i) => { const rd = P.roads[roadId], pts = dir > 0 ? rd.pts : rd.pts.slice().reverse(), off = rd.oneway ? (i + 0.5) * rd.laneW - rd.w / 2 : (rd.median / 2 + (i + 0.5) * rd.laneW) * (P.drive === 'R' ? 1 : -1);   // еднопосочен: ленти от левия ръб надясно
    const o = pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], l = dist(a, b) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l; return [p[0] - tz * off, p[1] + tx * off]; });
    const nA = P.nodes[dir > 0 ? rd.from : rd.to], nB = P.nodes[dir > 0 ? rd.to : rd.from];
    return trim(o, nodeR(nA, roadId, dir > 0 ? 0 : 1, false), nodeR(nB, roadId, dir > 0 ? 1 : 0, true)); };
  const bez = (a, c, b, n = 12) => Array.from({ length: n + 1 }, (_, k) => { const t = k / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
  const xLines = (p, d, q, e) => { const den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-3) return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den; return [p[0] + d[0] * t, p[1] + d[1] * t]; };
  // кубична крива по посоките на лентите (без пресечна точка, която при остър ъгъл пада зад стоп линията и чупи завоя):
  // ръчките са по допирателните, с дължина като при дъга от окръжност за този завой — k = 2/3·tg(θ/4)/sin(θ/2) от хордата
  const nrm = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const cubic = (a, da, b, db, n = 16) => { da = nrm(da); db = nrm(db); const ch = Math.hypot(b[0] - a[0], b[1] - a[1]), th = Math.max(0.17, Math.acos(Math.max(-1, Math.min(1, da[0] * db[0] + da[1] * db[1])))), h = ch * (2 / 3) * Math.tan(th / 4) / Math.sin(th / 2);
    const c1 = [a[0] + da[0] * h, a[1] + da[1] * h], c2 = [b[0] - db[0] * h, b[1] - db[1] * h];
    return Array.from({ length: n + 1 }, (_, k) => { const t = k / n, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, D = t * t * t; return [A * a[0] + B * c1[0] + C * c2[0] + D * b[0], A * a[1] + B * c1[1] + C * c2[1] + D * b[1]]; }); };
  const armLane = (nodeId, armI, laneI, inbound) => { const n = P.nodes[nodeId], a = n.arms[armI], rd = P.roads[a.road], dirIn = a.end === 1 ? 1 : -1, dir = inbound ? dirIn : -dirIn, L = P.lanePath(a.road, dir, laneI); const far = (e, step) => { const q = L[e]; for (let k = e + step; k >= 0 && k < L.length; k += step) if (Math.hypot(L[k][0] - q[0], L[k][1] - q[1]) >= 2) return L[k]; return L[e + step] || L[e - step] || q; };   // посоката — от точка ≥ 2 м назад (при срез до точка последната отсечка е почти нулева)
    return inbound ? [L[L.length - 1], far(L.length - 1, -1)] : [L[0], far(0, 1)]; };
  // завой през кръстовище: от края на влизащата лента (стоп линията) до началото на излизащата; плавна крива (Безие)
  P.turnPath = (nodeId, fromArm, laneI, toArm, laneJ) => { const [a, a0] = armLane(nodeId, fromArm, laneI, true), [b, b1] = armLane(nodeId, toArm, laneJ, false), da = [a[0] - a0[0], a[1] - a0[1]], db = [b1[0] - b[0], b1[1] - b[1]];
    return cubic(a, da, b, db); };
  // кръгово: ring — s расте по посоката на движение; вход/изход — криви от лентата до пръстена (и обратно)
  P.roundPath = (ri, armI, kind) => { const R0 = P.rounds[ri], n = P.nodes[R0.node], e = R0.entries[armI], ring = R0.ring, Lr = cumLen(ring), S = kind === 'in' ? e.inS : e.outS;
    let j = 1; while (j < Lr.length - 1 && Lr[j] < S) j++; const q = ring[j], q2 = ring[Math.min(ring.length - 1, j + 1)], tq = [q2[0] - q[0], q2[1] - q[1]];
    if (kind === 'in') { const [a, a0] = armLane(n.id, armI, 0, true); return cubic(a, [a[0] - a0[0], a[1] - a0[1]], q, tq); }
    const [b, b1] = armLane(n.id, armI, 0, false); return cubic(q, tq, b, [b1[0] - b[0], b1[1] - b[1]]); };
  P.pick = (q2 = {}) => { let best = null, bd = 1e18; for (const L of P.lots) { if (L.reserved || (q2.zone && L.zone !== q2.zone) || (q2.minW && L.w < q2.minW) || (q2.minD && L.d < q2.minD)) continue; if (q2.road === 'main' && !isMain(L.front.cls)) continue; if (q2.road === 'street' && isMain(L.front.cls)) continue; if (q2.free && !q2.free(L)) continue; const d = q2.near ? Math.hypot(L.x - q2.near[0], L.z - q2.near[1]) : L.id; if (d < bd) { bd = d; best = L; } } return best; };
  P.reserve = (id, tag) => { if (P.lots[id]) P.lots[id].reserved = tag; };
  P.unreserve = id => { if (P.lots[id]) P.lots[id].reserved = null; };
  return P;
}
// записан план (готов, без генериране): plan2Save(P) → обикновен JSON; plan2Load(data, osm) → същият план с помощните функции
export function plan2Save(P) {
  const { waterAt, coastZ, lanePath, turnPath, roundPath, pick, reserve, unreserve, roadY, ...rest } = P;
  const r1 = (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10) / 10 : v;   // 0,1 м стига
  return JSON.parse(JSON.stringify({ ...rest, roads: rest.roads.map(({ L, ...r }) => r), lots: rest.lots.map(({ poly, ...l }) => l), nodes: rest.nodes.map(({ conflict, ...n }) => n) }, r1));   // L, poly, conflict — изчисляват се наново
}
export function plan2Load(data, osm) {
  const P = { ...data };
  for (const r of P.roads) r.L = cumLen(r.pts);
  for (const L of P.lots) L.poly = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot);
  for (const n of P.nodes) if (n.outline) n.conflict = n.outline;
  if (osm) { const hw = osm.riverHW || 12, rg = pointGrid(16); (osm.river || []).forEach(R2 => resample(R2, 3).forEach(p => rg.add(p, 1)));
    const isl = osm.island, inIsl = (x, z) => { if (!isl) return false; const c = Math.cos(isl.rot), s2 = Math.sin(isl.rot), dx = x - isl.x, dz = z - isl.z, u = dx * c - dz * s2, v = dx * s2 + dz * c; return (u / (isl.w / 2)) ** 2 + (v / (isl.d / 2)) ** 2 < 1; };
    P.waterAt = (x, z) => { let w = false; rg.near([x, z], hw, () => { w = true; }); return w && !inIsl(x, z); }; }
  else P.waterAt = () => false;
  return attachPlan2(P);
}
// ---- основното: plan2(cityId, { fam, size, seed, ext })
const cache = new Map();
export function plan2(cityId, o = {}) {
  const fam = o.fam || 'eu', size = o.size || 'm', seed = o.seed ?? hashStr(cityId), ext = o.ext || 0, key = [cityId, fam, size, seed, ext].join(':');
  if (cache.has(key)) return cache.get(key);
  const t0 = Date.now(), r = rng(hashStr(`plan2:${cityId}:${fam}:${size}:${seed}`));
  const sk = o.osm ? osmSkeleton(o.osm) : skeleton(fam, size, r);
  // главните пътища: мрежа от точки (за отстоянието на кварталните)
  const mg = pointGrid(24); sk.lines.forEach((L, li) => L.pts.forEach(p => mg.add(p, li)));
  const majorNear = (p, rad) => { let hit = null; mg.near(p, rad + widthOf('blvd') / 2, (q, li) => { if (hit === null && dist(p, q) < rad + widthOf(sk.lines[li].cls) / 2) hit = li; }); return hit; };
  const locals = o.osm ? [] : localStreets(sk, fam, size, r, majorNear);
  // краищата на кварталните — доизтеглени напред до главен път (най-много 40 м); там, където вече има кръстовище на ≤ 26 м — към него
  const junc = pointGrid(16), majors = sk.lines;
  const snapEnd = (run, end) => {
    const P = run.pts, p = end ? P[P.length - 1] : P[0], q = end ? P[P.length - 2] : P[1], l = dist(p, q) || 1, d = [(p[0] - q[0]) / l, (p[1] - q[1]) / l];
    for (let s = 2; s <= 44; s += 2) {
      const x = [p[0] + d[0] * s, p[1] + d[1] * s], li = majorNear(x, 0);
      if (li === null) { if (sk.waterAt(x[0], x[1]) || !inPoly(x, sk.bnd)) return; continue; }
      // точката на оста на главния път
      let best = null, bd = 1e9; for (const m of majors[li].pts) { const dd = dist(m, x); if (dd < bd) { bd = dd; best = m; } }
      let snap = null; junc.near(best, 26, q2 => { if (!snap || dist(q2, best) < dist(snap, best)) snap = q2; });
      const tgt = snap || best; if (!snap) junc.add(best, 1);
      const ext2 = []; const n = Math.max(1, Math.ceil(dist(p, tgt) / 4)); for (let k = 1; k <= n; k++) ext2.push([lerp(p[0], tgt[0], k / n), lerp(p[1], tgt[1], k / n)]);
      if (end) P.push(...ext2); else P.unshift(...ext2.reverse());
      return;
    }
  };
  for (const L of locals) { snapEnd(L, 0); snapEnd(L, 1); }
  // втори опит: краят, който не стигна до главен път — до друга квартална улица напред (≤ 34 м), напр. на границата на два квартала
  const lgr = pointGrid(16); locals.forEach((L, li) => L.pts.forEach(p => lgr.add(p, li)));
  const snapLocal = (L, li, end) => {
    const P = L.pts, p = end ? P[P.length - 1] : P[0], q = end ? P[P.length - 2] : P[1], l = dist(p, q) || 1, d = [(p[0] - q[0]) / l, (p[1] - q[1]) / l];
    if (majorNear(p, 3) !== null) return;   // вече е на главен път
    for (let s = 2; s <= 34; s += 2) {
      const x = [p[0] + d[0] * s, p[1] + d[1] * s]; if (sk.waterAt(x[0], x[1]) || !inPoly(x, sk.bnd)) return;
      let hit = null; lgr.near(x, 2.5, (q2, lj) => { if (!hit && lj !== li) hit = q2; }); if (!hit) continue;
      const n = Math.max(1, Math.ceil(dist(p, hit) / 4)), ext2 = []; for (let k = 1; k <= n; k++) ext2.push([lerp(p[0], hit[0], k / n), lerp(p[1], hit[1], k / n)]);
      if (end) P.push(...ext2); else P.unshift(...ext2.reverse()); return;
    }
  };
  locals.forEach((L, li) => { snapLocal(L, li, 0); snapLocal(L, li, 1); });
  const lines = [...sk.lines, ...locals].map(L => ({ ...L, pts: L.pts }));
  // граф и правила
  const G = o.osm && o.osm.nodes ? { nodes: o.osm.nodes.map(([x, z]) => ({ x, z, rank: 0 })), edges: o.osm.roads.map((r, i) => { const pts = resample(r.pts, 4); pts[0] = o.osm.nodes[r.a].slice(); pts[pts.length - 1] = o.osm.nodes[r.b].slice();
      return { a: r.a, b: r.b, cls: r.cls, pts, src: i, noCars: !!r.noCars, bridge: !!r.bridge, nm: r.nm || '', oneway: !!r.oneway }; }) }   // истинската карта: възлите са общите точки на улиците в OSM
    : buildGraph(lines, { merge: 7 });
  let E = applyRules(G, o.osm ? { minAngle: 20 * Math.PI / 180, minLen: 4, minStub: 10 } : { minAngle: 55 * Math.PI / 180, minLen: 30, minStub: 46 });   // истинската карта — по-меки правила (Рим има остри ъгли и къси пресечки)
  // свързаност: само компонентът на центъра
  const adj = G.nodes.map(() => []); E.forEach(e => { adj[e.a].push(e.b); adj[e.b].push(e.a); });
  let c0 = 0, cd = 1e9; G.nodes.forEach((n, i) => { const d = Math.hypot(n.x - sk.hubs[0].x, n.z - sk.hubs[0].z); if (adj[i].length && d < cd) { cd = d; c0 = i; } });
  let seen = new Set([c0]); { const q = [c0]; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  if (o.osm) { const done = new Set(); G.nodes.forEach((_, i) => { if (done.has(i) || !adj[i].length) return; const c = new Set([i]), q = [i]; for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (!c.has(n)) { c.add(n); q.push(n); } c.forEach(n => done.add(n)); if (c.size > seen.size) seen = c; }); }   // истинската карта — най-големият свързан компонент
  E = E.filter(e => seen.has(e.a));
  // възли с 2 клона от един и същи път → чупка: пътищата се сливат в едно ребро между кръстовищата
  const inc = G.nodes.map(() => []); E.forEach(e => { inc[e.a].push(e); inc[e.b].push(e); });
  const used = new Set(), roads = [];
  const isJ = n => inc[n].length !== 2 || inc[n][0].cls !== inc[n][1].cls || inc[n][0].noCars !== inc[n][1].noCars || !!inc[n][0].oneway !== !!inc[n][1].oneway || !!inc[n][0].bridge !== !!inc[n][1].bridge;
  for (const e0 of E) {
    if (used.has(e0)) continue;
    // тръгни от края, който е кръстовище
    let e = e0, a = e.a; let guard = 0;
    while (!isJ(a) && guard++ < 500) { const o = inc[a].find(x => x !== e); if (!o || o === e0 && guard > 1) break; a = o.a === a ? o.b : o.a; e = o; }
    // e е ребро, a — кръстовище в единия му край; върви натам
    const pts = []; let cur = a, ce = e, first = true; guard = 0; const fwd = e.a === a;   // еднопосочен: върви ли pts по посоката на движение
    while (ce && !used.has(ce) && guard++ < 500) {
      used.add(ce); const P = ce.a === cur ? ce.pts : ce.pts.slice().reverse(); pts.push(...(first ? P : P.slice(1))); first = false;
      cur = ce.a === cur ? ce.b : ce.a; if (isJ(cur)) break; ce = inc[cur].find(x => x !== ce && !used.has(x));
    }
    roads.push({ cls: e.cls, from: a, to: cur, pts, noCars: e.noCars, bridge: e.bridge, nm: e.nm, oneway: e.oneway ? (fwd ? 1 : -1) : 0 });
  }
  // изход: възли (само използваните), пътища с параметри
  const live = new Map(); const nodeOut = [];
  const nid = i => { if (!live.has(i)) { live.set(i, nodeOut.length); nodeOut.push({ id: nodeOut.length, x: G.nodes[i].x, z: G.nodes[i].z, arms: [] }); } return live.get(i); };
  const P = { osm: !!o.osm, greensSrc: sk.greens || [], v: PLAN2_V, cityId, fam, size, seed, ext, drive: o.drive || 'R', center: { x: sk.hubs[0].x, z: sk.hubs[0].z }, R: sk.R, boundary: sk.bnd, waterAt: sk.waterAt, coastZ: sk.coastZ, hubs: sk.hubs,
    roads: [], nodes: nodeOut, rounds: [], lots: [], blocks: [], greens: [], landmarks: [] };
  roads.forEach(rd => {
    const k = CLS[rd.cls], pts = resample(rd.pts, P.osm ? 5 : 2), id = P.roads.length, a = nid(rd.from), b = nid(rd.to);
    const n1 = rd.oneway ? Math.min(2, k.lanes[0]) || 1 : 0, lanes = rd.oneway ? (rd.oneway > 0 ? [n1, 0] : [0, n1]) : k.lanes.slice();   // еднопосочен — всички ленти в една посока, без разделителна ивица
    P.roads.push({ id, cls: rd.cls, osmBridge: !!rd.bridge, noCars: !!rd.noCars, nm: rd.nm || '', oneway: !!rd.oneway, pts, L: cumLen(pts), lanes, laneW: k.laneW, median: rd.oneway ? 0 : k.median, walk: k.walk, w: rd.oneway ? n1 * k.laneW : widthOf(rd.cls), from: a, to: b, bridge: [] });
  });
  for (const rd of P.roads) { if (P.osm && !rd.osmBridge) continue; let on = -1; rd.pts.forEach((p, i) => { const w = sk.waterAt(p[0], p[1]); if (w && on < 0) on = rd.L[i]; if ((!w || i === rd.pts.length - 1) && on >= 0) { rd.bridge.push([Math.max(0, on - 4), Math.min(rd.L[rd.L.length - 1], rd.L[i] + 4)]); on = -1; } }); }   // мостовете — участъците над вода (+ рампа)
  for (const rd of P.roads) for (const [n, end] of [[rd.from, 0], [rd.to, 1]]) {
    const pts = end ? rd.pts.slice().reverse() : rd.pts, p0 = pts[0]; let qq = pts[pts.length - 1]; for (const p of pts) if (dist(p, p0) >= 10) { qq = p; break; }
    P.nodes[n].arms.push({ road: rd.id, end, angle: Math.atan2(qq[1] - p0[1], qq[0] - p0[0]) });
  }
  // вид и управление на възлите
  for (const n of P.nodes) {
    const ws = n.arms.map(a => P.roads[a.road]), main = ws.filter(r2 => isMain(r2.cls)).length, deg = n.arms.length;
    n.kind = deg === 1 ? 'end' : deg === 2 ? 'bend' : deg === 3 ? 'T' : 'X';
    n.r = deg >= 3 ? Math.max(...ws.map(r2 => r2.w)) / 2 + 3 : 0;
    n.ctrl = deg < 3 ? 'none' : main >= 2 && deg === 4 ? 'signal' : main ? 'yield' : 'none';
    for (const a of n.arms) { a.cls = P.roads[a.road].cls; a.rank = CLS[a.cls].rank; a.prio = isMain(a.cls) ? 1 : 0; }   // главният поток при Т без светофар — по-високият rank
  }
  // краищата: изход към други градове (главен път до границата), връзка за бъдещо разширение (квартална до границата),
  // истински задънен край навътре — с кръг за обръщане (парцелите го заобикалят)
  const bDist = (x, z) => { let d = 1e9; for (let i = 0; i < sk.bnd.length; i++) d = Math.min(d, segDist([x, z], sk.bnd[i], sk.bnd[(i + 1) % sk.bnd.length])); return inPoly([x, z], sk.bnd) ? d : -d; };
  P.turns = [];
  for (const n of P.nodes) {
    if (n.arms.length !== 1) continue;
    const rd = P.roads[n.arms[0].road], bd = bDist(n.x, n.z);
    n.endKind = isMain(rd.cls) && bd < 30 ? 'exit' : bd < 40 ? 'grow' : 'dead';
    if (n.endKind === 'dead' && !P.osm) { n.r = rd.w / 2 + 5; P.turns.push({ node: n.id, x: n.x, z: n.z, r: n.r }); }
  }
  // кръгови: центърът (ако е кръстовище на главни) + важни 4-клонни на булевардите, раздалечени ≥ 0,45R
  const want = o.osm ? 0 : SIZE[size].rounds + (fam === 'eu' || fam === 'radial' ? 1 : 0);   // истинската карта — без измислени кръгови
  const cand = P.nodes.filter(n => n.arms.length >= 3 && n.arms.length <= 4 && n.arms.filter(a => isMain(P.roads[a.road].cls)).length >= 2)
    .sort((p, q2) => Math.hypot(p.x - P.center.x, p.z - P.center.z) - Math.hypot(q2.x - P.center.x, q2.z - P.center.z));
  if (fam === 'us') cand.length = Math.min(cand.length, 0);   // американската мрежа — светофари
  for (const n of cand) {
    if (P.rounds.length >= want) break;
    if (P.rounds.some(rd => Math.hypot(rd.x - n.x, rd.z - n.z) < sk.R * 0.45)) continue;
    // ъглите между входовете — поне 60°
    const as = n.arms.map(a => a.angle).sort((p, q2) => p - q2); if (as.some((a, i) => (i ? a - as[i - 1] : a + TAU - as[as.length - 1]) < 1.0)) continue;
    const island = n === cand[0] && (fam === 'eu' || fam === 'radial') ? 14 : 9, outer = island + 7;
    if (P.nodes.some(m => m !== n && m.arms.length && Math.hypot(m.x - n.x, m.z - n.z) < outer + 14)) continue;   // друг възел в кръговото → не става (улица през острова)
    n.kind = 'round'; n.ctrl = 'round'; n.r = outer + 2;
    const ring = []; for (let k = 0; k <= 48; k++) { const a = -k / 48 * TAU; ring.push([n.x + Math.cos(a) * (island + 3.5), n.z + Math.sin(a) * (island + 3.5)]); }   // обратно на часовника отгоре (дясно движение)
    const rr0 = island + 3.5, circ = TAU * rr0, sOf = ang => { const t = P.drive === 'R' ? -ang : ang; return ((t % TAU) + TAU) % TAU / TAU * circ; }, dl = Math.asin(Math.min(0.9, 3.3 / rr0));
    if (P.drive !== 'R') ring.reverse();
    P.rounds.push({ node: n.id, x: n.x, z: n.z, island, outer, lanes: 1, ring, entries: n.arms.map((a, i) => ({ arm: i, road: a.road, angle: a.angle, inS: sOf(a.angle + (P.drive === 'R' ? -dl : dl)), outS: sOf(a.angle + (P.drive === 'R' ? dl : -dl)) })) });
    P.greens.push({ kind: 'island', poly: ring.map(([x, z]) => [n.x + (x - n.x) * island / (island + 3.5), n.z + (z - n.z) * island / (island + 3.5)]) });
  }
  // обикновените кръстовища: очертанието е от истинските ръбове на платната (не кръг около възела). За всеки два съседни клона
  // ръбовете им се пресичат в ъгъла; клонът се реже там, където започва заобленият бордюр (радиус rc — за завиващи коли).
  // Почти прав път през възела (Т: главният път) — ръбът продължава прав, без издутина. arm.t — откъде започва кръстовището по клона.
  // Стоп линията е на t + STOP (зад зебрата); лентите (lanePath) свършват там, а излизащите започват от t + 1.
  P.STOP = 4.6;
  for (const n of P.nodes) {
    if (n.arms.length < 3 || n.kind === 'round') continue;
    const ord = n.arms.map((a, i) => ({ a, i, ang: a.angle, hw: P.roads[a.road].w / 2, main: isMain(P.roads[a.road].cls), tL: 1, tR: 1 })).sort((p, q) => p.ang - q.ang);   // tL/tR — срезът на левия/десния ръб (всеки ръб — свой: при кос ъгъл острият ъгъл не раздува целия клон)
    const corners = [];
    for (let k = 0; k < ord.length; k++) {
      const A = ord[k], B = ord[(k + 1) % ord.length]; let gap = B.ang - A.ang; if (k === ord.length - 1) gap += TAU;
      const uA = [Math.cos(A.ang), Math.sin(A.ang)], uB = [Math.cos(B.ang), Math.sin(B.ang)], nA = [-uA[1], uA[0]], mB = [uB[1], -uB[0]];
      if (gap < 0.05) { corners.push({ A, B, c: null }); continue; }   // два клона в една посока (истинска карта) — без ъгъл
      if (gap < Math.PI - 0.1) {
        const d = [mB[0] * B.hw - nA[0] * A.hw, mB[1] * B.hw - nA[1] * A.hw], det = -uA[0] * uB[1] + uB[0] * uA[1];
        const sA = (d[0] * -uB[1] + uB[0] * d[1]) / det, sB = (uA[0] * d[1] - uA[1] * d[0]) / det, rc = A.main || B.main ? 7 : 5, L = rc / Math.tan(gap / 2);
        A.tL = Math.max(A.tL, sA + L); B.tR = Math.max(B.tR, sB + L);
        corners.push({ A, B, c: [n.x + nA[0] * A.hw + uA[0] * sA, n.z + nA[1] * A.hw + uA[1] * sA] });
      } else corners.push({ A, B, c: null });
    }
    for (const x of ord) { const rd = P.roads[x.a.road], cap = Math.max(1, rd.L[rd.L.length - 1] / 2 - P.STOP - 1); x.tL = Math.min(x.tL, cap); x.tR = Math.min(x.tR, cap); x.a.t = Math.round(Math.max(x.tL, x.tR) * 100) / 100; x.a.t0 = Math.round(Math.min(x.tL, x.tR) * 100) / 100; x.a.tL = x.tL; x.a.tR = x.tR; }   // t — стоп линия/ленти; t0 — докъде е пътят
    // очертанието (обратно на часовника): за всеки клон — десният и левият ъгъл на среза, после бордюрът до следващия клон
    const edge = (x, side, tt) => { const u = [Math.cos(x.ang), Math.sin(x.ang)], v = side > 0 ? [-u[1], u[0]] : [u[1], -u[0]], t = tt ?? (side > 0 ? x.tL : x.tR); return [n.x + v[0] * x.hw + u[0] * t, n.z + v[1] * x.hw + u[1] * t]; };
    n.corners = corners.map(c => ({ a: c.A.i, b: c.B.i, p0: edge(c.A, 1), p1: edge(c.B, -1), c: c.c }));
    const bez = (p0, c, p1, m = 8) => Array.from({ length: m + 1 }, (_, k) => { const t = k / m, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
    n.outline = []; for (const c of n.corners) { const x = ord.find(q => q.i === c.a); n.outline.push(edge(x, -1)); n.outline.push(...(c.c ? bez(c.p0, c.c, c.p1) : [c.p0, c.p1])); }   // устието: косата линия от десния до левия срез
    n.conflict = n.outline; n.r = Math.max(...ord.map(x => Math.max(x.tL, x.tR) + x.hw * 0.3)) + 2;
    for (const a of n.arms) { const rd = P.roads[a.road], ux = Math.cos(a.angle), uz = Math.sin(a.angle), d0 = a.t + P.STOP, sx = n.x + ux * d0, sz = n.z + uz * d0, rx = uz, rz = -ux;   // влизащите ленти: вдясно спрямо посоката към възела
      const nIn = rd.lanes[a.end ? 0 : 1], w0 = rd.oneway ? -rd.w / 2 : rd.median / 2, w1 = rd.oneway ? rd.w / 2 : rd.median / 2 + nIn * rd.laneW, sgn = P.drive === 'R' || rd.oneway ? 1 : -1;
      a.stop = nIn ? [[sx + rx * w0 * sgn, sz + rz * w0 * sgn], [sx + rx * w1 * sgn, sz + rz * w1 * sgn]] : null; }   // еднопосочен, който излиза оттук — без стоп линия
  }
  placeLots(P, sk, r);
  // помощни
  // лента: от изхода на началния възел до стоп линията на крайния (dir 1 — по pts, −1 — обратно; i — от средата навън)
  attachPlan2(P);
  const small = P.lots.filter(L => !L.big);
  P.stats = { ms: Date.now() - t0, roads: P.roads.length, nodes: P.nodes.length, lots: P.lots.length, rounds: P.rounds.length, bad5: P.nodes.filter(n => n.arms.length >= 5).length,
    exits: P.nodes.filter(n => n.endKind === 'exit').length, grow: P.nodes.filter(n => n.endKind === 'grow').length, dead: P.turns.length,
    build: small.length, big: P.lots.length - small.length, area: Math.round(small.reduce((a, L) => a + L.area, 0) / 100) / 100 };   // area — хектари за застрояване (без големите места)
  // целите на града — в дял от застроимото (парцели и площ), не в брой: семействата имат различен брой парцели
  P.goal = { lots: small.length, area: P.stats.area };
  cache.set(key, P); while (cache.size > 24) cache.delete(cache.keys().next().value);
  return P;
}

// ---- парцели: по двете страни на всеки път, с лице към улицата; без застъпване на пътища, тротоари, вода и други парцели
function placeLots(P, sk, r) {
  const B0 = P.boundary, isRect = B0.length === 4, bx0 = Math.min(...B0.map(p => p[0])), bx1 = Math.max(...B0.map(p => p[0])), bz0 = Math.min(...B0.map(p => p[1])), bz1 = Math.max(...B0.map(p => p[1]));
  const inB = p => isRect ? p[0] >= bx0 && p[0] <= bx1 && p[1] >= bz0 && p[1] <= bz1 : inPoly(p, B0);
  const rg = pointGrid(20); P.roads.forEach(rd => rd.pts.forEach(p => rg.add(p, rd.id)));
  const roadIn = (L, pad) => { const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot), probe = [...cs, [L.x, L.z], ...cs.map((c, i) => [(c[0] + cs[(i + 1) % 4][0]) / 2, (c[1] + cs[(i + 1) % 4][1]) / 2])];
    let hit = false; for (const p of probe) rg.near(p, 16, (q, id) => { const rd = P.roads[id]; if (!hit && dist(p, q) < rd.w / 2 + rd.walk + pad) hit = true; });
    if (hit) return true;
    // и точки от пътя в правоъгълника
    rg.near([L.x, L.z], Math.hypot(L.w, L.d) / 2 + 2, (q, id) => { if (hit) return; const rd = P.roads[id], c = Math.cos(L.rot), s = Math.sin(L.rot), dx = q[0] - L.x, dz = q[1] - L.z; if (Math.abs(dx * c - dz * s) < L.w / 2 + rd.w / 2 && Math.abs(dx * s + dz * c) < L.d / 2 + rd.w / 2) hit = true; });
    return hit; };
  const lg = pointGrid(32), lots = [];
  const zoneOf = (x, z, main) => { const d = Math.hypot(x - P.center.x, z - P.center.z) / P.R; const hub = P.hubs.some((h, i) => i && Math.hypot(x - h.x, z - h.z) < P.R * 0.12);
    return d < 0.22 || hub ? 'center' : main && d < 0.6 ? 'business' : d > 0.82 ? 'periphery' : 'residential'; };
  // 1) големите места първи (болница, гара, парк, стадион, забележителност) — по главните пътища, всяко в своя пояс
  // [вид, ширина по улицата, дълбочина, желано разстояние от центъра / R]
  const BM = [['special', 56, 46, 0.12], ['park', 64, 44, 0.3], ['hospital', 52, 38, 0.45], ['station', 72, 32, 0.72]];
  const GB = P.greensSrc.map(g => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of g.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, z0, x1, z1, g.poly]; });
  // растер 8 м: „в зелена площ ли е“ — веднъж за плана (иначе хиляди проверки на многоъгълници)
  const GR = new Map(), gc = 8; for (const [x0, z0, x1, z1, poly] of GB) for (let i = Math.floor(x0 / gc); i <= Math.floor(x1 / gc); i++) for (let j = Math.floor(z0 / gc); j <= Math.floor(z1 / gc); j++) { const k2 = i + ',' + j; if (!GR.has(k2) && inPoly([(i + 0.5) * gc, (j + 0.5) * gc], poly)) GR.set(k2, 1); }
  const greenIn = (x, z) => GR.has(Math.floor(x / gc) + ',' + Math.floor(z / gc));
  const BIG = P.osm ? [] : { s: [['park', 44, 36, 0.25], ['hospital', 40, 32, 0.5]], m: BM, l: [...BM, ['stadium', 96, 64, 0.78], ['special', 56, 46, 0.3], ['park', 72, 46, 0.6]],
    xl: [...BM, ['stadium', 96, 64, 0.78], ['special', 56, 46, 0.3], ['park', 72, 46, 0.6], ['hospital', 52, 38, 0.7], ['station', 72, 32, 0.85], ['special', 56, 46, 0.5], ['park', 72, 46, 0.8]] }[P.size];
  if (P.fam === 'coast') BIG.unshift(['port', 80, 40, 0.55]);   // пристанище: място на сушата до кея (кейът навътре във водата — в 3D)
  const ANY = { park: 1, special: 1 }, ONLY = { port: 'quay' };   // паркът и забележителността могат и към квартална улица; болницата, гарата и стадионът — само към главна
  const atOn = (rd, ss) => { let i = 1; while (i < rd.L.length - 1 && rd.L[i] < ss) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (ss - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), l = dist(a, b) || 1; return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; };
  const lotAt = (rd, s, side, w, d) => { const m = atOn(rd, s + w / 2), nx = -m.tz * side, nz = m.tx * side, off = rd.w / 2 + rd.walk + 1.5 + d / 2; return { x: m.x + nx * off, z: m.z + nz * off, w, d, rot: Math.atan2(-nx, -nz), front: { road: rd.id, s: s + w / 2, side, cls: rd.cls } }; };
  const okLot = (L, pad) => { const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot);
    if (!cs.every(p => inB(p) && !P.waterAt(p[0], p[1]))) return false;
    if (P.rounds.some(rr2 => Math.hypot(L.x - rr2.x, L.z - rr2.z) < rr2.outer + Math.hypot(L.w, L.d) / 2 + 3)) return false;
    if (P.turns.some(t => Math.hypot(L.x - t.x, L.z - t.z) < t.r + 3 + Math.hypot(L.w, L.d) / 2 * 0.8)) return false;
    if (roadIn(L, 0.5)) return false;
    let clash = false; lg.near([L.x, L.z], 80, (q, o) => { if (!clash && rectsOverlap(o, L, o.guard ?? pad)) clash = true; }); return !clash; };
  const bigs = [];
  // истинската карта: забележителностите на реалните си места (основа fp, защитен периметър guard) — парцел със запазено място
  if (P.osm) for (const lm of sk.osm.landmarks || []) {
    let best = null, bd = 1e9; for (const rd of P.roads) for (const q of rd.pts) { const d = dist(q, [lm.x, lm.z]); if (d < bd) { bd = d; best = rd; } }
    const L = { x: lm.x, z: lm.z, w: lm.fp[0], d: lm.fp[1], rot: 0, zone: 'center', big: 'lm', lm: lm.k, reserved: 'lm:' + lm.k, guard: lm.guard, front: { road: best ? best.id : 0, s: 0, side: 1, cls: best ? best.cls : 'street' } };
    lg.add([L.x, L.z], L); lots.push(L); bigs.push(L);
  }
  for (const [kind, w0, d0, want] of BIG || []) for (const f of [1, 0.85, 0.7]) {   // ако не се събере — по-малко
    if (bigs.some(b => b._k === kind + w0 + want)) break;
    const w = w0 * f, d = d0 * f;
    let best = null, bs = 1e9;
    for (const rd of P.roads) { if (!isMain(rd.cls) && P.size !== 's' && !ANY[kind]) continue; if (ONLY[kind] && rd.cls !== ONLY[kind]) continue; const len = rd.L[rd.L.length - 1], s0 = (P.nodes[rd.from].r || 0) + 6, s1 = len - (P.nodes[rd.to].r || 0) - 6;
      for (let s = s0; s + w < s1; s += 8) for (const side of [1, -1]) {
        const L = lotAt(rd, s, side, w, d), dc = Math.hypot(L.x - P.center.x, L.z - P.center.z) / P.R;
        let sc = Math.abs(dc - want); for (const b of bigs) sc += Math.max(0, 0.35 - Math.hypot(L.x - b.x, L.z - b.z) / P.R) * 2;   // раздалечени
        if (sc >= bs || !okLot(L, 4)) continue; bs = sc; best = L; } }
    if (best) { best.zone = zoneOf(best.x, best.z, true); best.big = kind; best.reserved = 'big:' + kind; best._k = kind + w0 + want; lg.add([best.x, best.z], best); lots.push(best); bigs.push(best); }
  }
  const order = [...P.roads].sort((a, b) => b.w - a.w || a.id - b.id);
  for (const rd of order) {
    const len = rd.L[rd.L.length - 1], nA = P.nodes[rd.from], nB = P.nodes[rd.to];
    const s0 = (nA.r || 0) + 6, s1 = len - (nB.r || 0) - 6;
    for (const side of [1, -1]) {
      for (let s = s0; s < s1;) {
        const at = ss => { let i = 1; while (i < rd.L.length - 1 && rd.L[i] < ss) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (ss - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), l = dist(a, b) || 1; return { x: lerp(a[0], b[0], t), z: lerp(a[1], b[1], t), tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; };
        const m0 = at(s), zone = zoneOf(m0.x, m0.z, isMain(rd.cls));
        let placed = false;
        for (const f of [1, 0.8]) {
          const [w, d] = LOT[zone].map(v => v * f * (P.osm ? 0.65 : 1)); if (s + w > s1) break;   // истинската карта — по-малки (кратки квартали)
          const m = at(s + w / 2), nx = -m.tz * side, nz = m.tx * side, off = rd.w / 2 + rd.walk + 1.5 + d / 2;
          const L = { x: m.x + nx * off, z: m.z + nz * off, w, d, rot: Math.atan2(-nx, -nz), zone, front: { road: rd.id, s: s + w / 2, side, cls: rd.cls } };
          const cs = rectCorners(L.x, L.z, w / 2, d / 2, L.rot);
          if (!cs.every(p => inB(p) && !P.waterAt(p[0], p[1]))) continue;
          if (P.osm && [...cs, [L.x, L.z]].some(p => greenIn(p[0], p[1]))) continue;   // паркове и археологически зони — без сгради
          if (P.rounds.some(rr2 => Math.hypot(L.x - rr2.x, L.z - rr2.z) < rr2.outer + Math.hypot(w, d) / 2 + 3)) continue;
          if (P.turns.some(t => Math.hypot(L.x - t.x, L.z - t.z) < t.r + 3 + Math.hypot(w, d) / 2 * 0.8)) continue;
          if (roadIn(L, 0.5)) continue;
          let clash = false; lg.near([L.x, L.z], 80, (q, o) => { if (!clash && rectsOverlap(o, L, o.guard ?? (o.big ? 3 : 0.6))) clash = true; }); if (clash) continue;
          lg.add([L.x, L.z], L); lots.push(L); s += w + 1; placed = true; break;
        }
        if (!placed) s += 4;
      }
    }
  }
  const C = P.center;
  lots.sort((a, b) => Math.round(Math.hypot(a.x - C.x, a.z - C.z)) - Math.round(Math.hypot(b.x - C.x, b.z - C.z)) || Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x));
  lots.forEach((L, i) => { L.id = i; L.poly = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot); L.area = Math.round(L.w * L.d); L.block = null; L.reserved = L.reserved || null; L.big = L.big || null; delete L._k; for (const k of ['x', 'z', 'w', 'd', 'rot']) L[k] = Math.round(L[k] * 100) / 100; });
  // застрояване по размер на града и зона (какви модели стават за парцела — не прескача прогреса на играча):
  // малък — къщи и ниски; среден — къщи, блокове и компактен офисен център; голям — плътни квартали и група високи в центъра;
  // мегаполис — няколко плътни центъра (около всеки — високи), жилищни райони със средна височина, ниска периферия
  const hubs = P.hubs, R0 = P.R, h = id => ((id * 2654435761) >>> 0) / 4294967296;
  const nearHub = L => Math.min(...hubs.map(q => Math.hypot(L.x - q.x, L.z - q.z))) / R0;
  for (const L of lots) {
    if (L.big) { L.build = L.big; continue; }
    if (P.osm) { const r2 = h(L.id); L.build = L.zone === 'periphery' ? (r2 < 0.5 ? 'low' : 'mid') : (r2 < 0.75 ? 'mid' : 'low'); continue; }
    const r = h(L.id), hb = nearHub(L), z = L.zone;
    L.build = P.size === 's' ? (z === 'center' || z === 'business' ? 'low' : 'house')
      : P.size === 'm' ? (z === 'center' ? 'mid' : z === 'business' ? (r < 0.6 ? 'mid' : 'low') : z === 'residential' ? (hb < 0.45 && r < 0.35 ? 'mid' : 'house') : 'house')
      : P.size === 'l' ? (z === 'center' ? (hb < 0.13 ? 'tower' : 'mid') : z === 'business' ? 'mid' : z === 'residential' ? (r < 0.7 ? 'mid' : 'low') : 'house')
      : (z === 'center' ? (hb < (hubs.length > 1 ? 0.1 : 0.16) ? 'tower' : 'mid') : z === 'business' ? (hb < 0.16 && r < 0.4 ? 'tower' : 'mid') : z === 'residential' ? (r < 0.75 ? 'mid' : 'low') : (r < 0.7 ? 'house' : 'low'));
  }
  // истинската карта: кварталът на всеки парцел (рионе/квартал от OSM), ниво за отключване (tier) и защита на историческия център —
  // там само част от парцелите са за строеж (keep), останалите — „реставрация“ (reserved: 'reno'); зоната — от вида на квартала
  if (P.osm && sk.osm.districts) {
    const DS = sk.osm.districts.map(d => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of d.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return { ...d, bb: [x0, z0, x1, z1] }; });
    for (const L of lots) {
      const d = DS.find(q => L.x >= q.bb[0] && L.x <= q.bb[2] && L.z >= q.bb[1] && L.z <= q.bb[3] && inPoly([L.x, L.z], q.poly));
      L.district = d ? d.nm : 'Fuori'; L.tier = d ? d.tier : 5;
      if (L.big) continue;
      L.zone = !d ? 'outer' : d.kind === 'quarter' ? (d.keep < 0.4 ? 'center' : 'mid') : 'outer';
      if (d && h(L.id * 7 + 3) > d.keep) L.reserved = 'reno';
    }
    const by = {}; for (const L of lots) { const b = by[L.district] ||= { tier: L.tier, lots: 0, build: 0, reno: 0 }; b.lots++; if (L.reserved === 'reno') b.reno++; else if (!L.big) b.build++; }
    P.districts = by;
  }
  // котви за играта (истинска карта): гарата (Термини — запазеното място), летището и магистралата — в истинската посока до ръба на картата
  if (P.osm) {
    const D = sk.osm, K = D.k, toXZ = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K];
    const B = P.boundary, x0 = Math.min(...B.map(p => p[0])), x1 = Math.max(...B.map(p => p[0])), z0 = Math.min(...B.map(p => p[1])), z1 = Math.max(...B.map(p => p[1]));
    const edgeToward = (la, lo) => { const [tx, tz] = toXZ(la, lo), l = Math.hypot(tx, tz), ux = tx / l, uz = tz / l; let t = 1e9; for (const [c, u] of [[x0, ux], [x1, ux], [z0, uz], [z1, uz]]) { const tt = c / u; if (u && tt > 0) t = Math.min(t, tt); } const e = [ux * t, uz * t];
      let best = null, bd = 1e9; for (const r of P.roads) { if (r.noCars || r.cls === 'street') continue; for (const end of [0, 1]) { const q = r.pts[end ? r.pts.length - 1 : 0], d = Math.hypot(q[0] - e[0], q[1] - e[1]); if (d < bd) { bd = d; best = { road: r.id, end, x: q[0], z: q[1] }; } } }
      return { x: e[0], z: e[1], dir: Math.atan2(ux, uz), road: best }; };
    const ter = lots.find(L => L.lm === 'termini');
    P.anchors = { station: ter ? { x: ter.x, z: ter.z, w: ter.w, d: ter.d, lot: ter.id, name: 'Roma Termini' } : null,
      airport: { ...edgeToward(41.7999, 12.2462), name: 'Fiumicino (FCO)', km: 26 },   // летището е извън картата — връзката е на ръба, в посоката му
      highway: { ...edgeToward(41.835, 12.42), name: 'A91 Roma–Fiumicino / GRA' } };
  }
  P.lots = lots;
}

export const FAMILIES = ['eu', 'us', 'coast', 'radial'], SIZES = ['s', 'm', 'l', 'xl'];
