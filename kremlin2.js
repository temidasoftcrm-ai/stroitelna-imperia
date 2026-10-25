// kremlin2.js — Московският Кремъл от моделите на потребителя (Meshy), feature 'lm-kremlin2' (cityplan2-3d.js: kremlinView).
// Едно цяло по истинския триъгълник на стената (~2,2 км): Спаската (71 м) към Червения площад, Водовзводната (61 м) — югозападният ъгъл
// при реката, кулите по ъглите и между тях, стената (сегментът от Meshy, инстанции по периметъра; при Червения площад — с елите),
// Големият кремълски дворец (бял камък, зелен покрив) с фасадата към реката, вътре — катедралите, „Иван Велики“ и Сенатът.
// Всичко е в истински метри × K (мащабът на картата, като другите забележителности). Стената се отдръпва навътре от улиците (без застъпване).
// Моделите (assets/heavy/lm): kremlin-parts.glb (kr_vodo, kr_palace, kr_tower, kr_church, kr_house), kremlin-spasskaya.glb (kr_spass),
// kremlin-wall.glb (kr_wall, kr_firs); lm-kremlin3 — kremlin-inner.glb (kr_senate, kr_ivan, kr_uspensky, kr_archangel, kr_annunc — от Blender). Смяна на стената: KR_WALL (името на възела) и KR_SEG (дължината на сегмента, м).
import * as THREE from 'three';

export const KR_WALL = 'kr_wall', KR_FIRS = 'kr_firs', KR_SEG = 46.44;   // сегментът от Meshy: 46,4 × 4,7 × 16 м (лицето навън = +z)
// върховете на стената (истински lat/lon; същите като процедурния Кремъл) и кулите по тях: [модел, височина м, звезда]
export const KREML = [[55.74885, 37.61265], [55.74975, 37.62135], [55.75055, 37.62355], [55.75255, 37.62155], [55.75455, 37.61905], [55.75565, 37.61745], [55.75315, 37.61575], [55.75165, 37.61425], [55.75005, 37.61305]];
const KR_TOW = [['kr_vodo', 61, 1], ['kr_tower', 38], ['kr_vodo', 46], ['kr_spass', 71, 1], ['kr_tower', 60, 1], ['kr_vodo', 60], ['kr_tower', 38], ['kr_tower', 60, 1], ['kr_tower', 54, 1]];   // Водовзводна, Тайницка, Беклемишевска, Спаска, Николска, Ъглова Арсенална, Средна Арсенална, Троицка, Боровицка
const KR_MID = 30, KR_GAP = { kr_vodo: 0.42, kr_tower: 0.45, kr_spass: 0.47 };   // междинните кули (м); докъде стената влиза в кулата (× ширината)
const HW_CLS = { blvd: 11.1, ring: 9.6, quay: 7.3, street: 5.6 };   // половин ширина на улицата с тротоара (cityplan2.js: CLS)
const FIRS_EDGE = 3;   // Спаската → Николската: стената към Червения площад, с елите пред нея

let PMAT = null;
const segD = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
// разположението (без three — проверимо в node): многоъгълникът (отдръпнат от улиците), кулите, сегментите на стената, сградите вътре
export function kremlinLayout(D, sizes = {}) {
  const K = D.k, at = (la, lo) => [(lo - D.center[1]) * Math.cos(D.center[0] * Math.PI / 180) * 111320 * K, -(la - D.center[0]) * 110540 * K];
  const p0 = KREML.map(([la, lo]) => at(la, lo)), n = p0.length, cx = p0.reduce((s, p) => s + p[0], 0) / n, cz = p0.reduce((s, p) => s + p[1], 0) / n;
  const T = 4.65 * K;   // дебелината на стената
  // всяка страна: нормалата навътре; колко да се отдръпне, за да не стъпва на улица (оста ± половин ширина + 1 м)
  const E = p0.map((a, i) => { const b = p0[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; let nin = [-u[1], u[0]]; if ((cx - (a[0] + b[0]) / 2) * nin[0] + (cz - (a[1] + b[1]) / 2) * nin[1] < 0) nin = [u[1], -u[0]];
    let off = 0; for (let t = 0; t <= 1.0001; t += 0.025) { const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; for (const r of D.roads) { const hw = (HW_CLS[r.cls] || 5.6) + T / 2 + 1; for (let j = 1; j < r.pts.length; j++) { const d = segD(p, r.pts[j - 1], r.pts[j]); if (d < hw) off = Math.max(off, hw - d); } } }
    return { a, b, u, nin, off: Math.min(off, 14) }; });
  // новите върхове — пресечните точки на отдръпнатите страни (почти успоредни → средата)
  const poly = E.map((e, i) => { const f = E[(i + n - 1) % n], pa = [e.a[0] + e.nin[0] * e.off, e.a[1] + e.nin[1] * e.off], pf = [f.b[0] + f.nin[0] * f.off, f.b[1] + f.nin[1] * f.off], cr = f.u[0] * e.u[1] - f.u[1] * e.u[0];
    if (Math.abs(cr) < 0.08) return [(pa[0] + pf[0]) / 2, (pa[1] + pf[1]) / 2];
    const qa = [f.a[0] + f.nin[0] * f.off, f.a[1] + f.nin[1] * f.off], t = ((pa[0] - qa[0]) * e.u[1] - (pa[1] - qa[1]) * e.u[0]) / cr; return [qa[0] + f.u[0] * t, qa[1] + f.u[1] * t]; });
  const W = k => (sizes[k] || { w: 10, h: 30 }).w, H = k => (sizes[k] || { w: 10, h: 30 }).h;
  const towers = [], walls = [];
  poly.forEach((a, i) => { const b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nin = E[i].nin;
    // ъгъл: +z на модела — навън; посоката на кулата във върха — средната на двете страни
    const ang = (ux, uz, out) => { let r = Math.atan2(-uz, ux); if (Math.sin(r) * out[0] + Math.cos(r) * out[1] < 0) r += Math.PI; return r; };
    const [mk, mh, star] = KR_TOW[i], pv = poly[(i + n - 1) % n], ui = [a[0] - pv[0], a[1] - pv[1]], ul = Math.hypot(...ui), ua = [ui[0] / ul + u[0], ui[1] / ul + u[1]], ual = Math.hypot(...ua) || 1, ninP = E[(i + n - 1) % n].nin, out = [-(nin[0] + ninP[0]), -(nin[1] + ninP[1])];
    const s0 = mh * K / H(mk); towers.push({ k: mk, x: a[0], z: a[1], rot: ang(ua[0] / ual, ua[1] / ual, out), s: s0, h: mh * K, star: !!star, r: W(mk) * s0 / 2 });
    // междинните кули: през ~170 м истински
    const nm = Math.floor(L / K / 170), pts = [{ t: 0, r: W(mk) * s0 * KR_GAP[mk] }];
    for (let k = 1; k <= nm; k++) { const t = k / (nm + 1), s1 = KR_MID * K / H('kr_tower'); towers.push({ k: 'kr_tower', x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, rot: ang(u[0], u[1], [-nin[0], -nin[1]]), s: s1, h: KR_MID * K, r: W('kr_tower') * s1 / 2 }); pts.push({ t: t * L, r: W('kr_tower') * s1 * KR_GAP.kr_tower }); }
    const [nk, nh] = KR_TOW[(i + 1) % n]; pts.push({ t: L, r: W(nk) * (nh * K / H(nk)) * KR_GAP[nk] });
    const wr = ang(u[0], u[1], [-nin[0], -nin[1]]);
    for (let k = 1; k < pts.length; k++) { const t0 = pts[k - 1].t + pts[k - 1].r, t1 = pts[k].t - pts[k].r, Ls = t1 - t0; if (Ls < 1) continue;
      const m = Math.max(1, Math.round(Ls / (KR_SEG * K))), sx = Ls / (m * KR_SEG);   // по цели сегменти; височината е една и съща (16 м × K), сегментът се разтяга само по дължината (±25 % — разстоянието между зъбците)
      for (let j = 0; j < m; j++) { const t = t0 + (j + 0.5) * Ls / m; walls.push({ x: a[0] + u[0] * t, z: a[1] + u[1] * t, rot: wr, s: K, sx, firs: i === FIRS_EDGE }); } } });
  // вътре: дворецът с фасадата към реката (успоредно на южната стена), Оръжейната палата — сградата от Meshy, църквата, катедралите
  const e0 = E[0], r0 = Math.atan2(-e0.u[1], e0.u[0]), south = (p, d) => [p[0] - e0.nin[0] * d, p[1] - e0.nin[1] * d];
  const inner = [{ k: 'kr_palace', p: south(at(55.75015, 37.61575), 21), rot: r0, s: K }, { k: 'kr_house', p: at(55.7494, 37.6137), rot: r0, s: K }, { k: 'kr_church', p: at(55.75125, 37.6164), rot: r0, s: K }];
  // кула/сграда до улица (Беклемишевската при Василевския спуск): към средата, докато се освободи (до 8 м)
  const clear = (x, z, r) => { let c = 1e9; for (const rd of D.roads) { const hw = HW_CLS[rd.cls] || 5.6; for (let j = 1; j < rd.pts.length; j++) c = Math.min(c, segD([x, z], rd.pts[j - 1], rd.pts[j]) - hw - r); } return c; };
  for (const t of [...towers, ...inner.map(o => ({ get x() { return o.p[0]; }, set x(v) { o.p[0] = v; }, get z() { return o.p[1]; }, set z(v) { o.p[1] = v; }, r: (sizes[o.k] || { w: 10 }).w * o.s / 2 }))]) {
    for (let it = 0; it < 16 && clear(t.x, t.z, t.r) < 0.6; it++) { const dx = cx - t.x, dz = cz - t.z, l = Math.hypot(dx, dz) || 1; t.x += dx / l * 0.5; t.z += dz / l * 0.5; } }
  return { K, at, poly, towers, walls, inner, south, edges: E };
}

// сглобяването: G — групата на изгледа; KM = { parts, spass, wall } (сцените от GLTFLoader); flood(obj, col, k) — floodMats от cityplan2-3d.js
export function kremlinEnsemble(G, D, KM, flood) {
  const nodes = {}; for (const sc of [KM.parts, KM.spass, KM.wall, KM.inner]) if (sc) { sc.updateMatrixWorld(true); sc.traverse(o => { if (/^kr_/.test(o.name || '') && !nodes[o.name]) nodes[o.name] = o; }); }
  const part = nm => { const o = nodes[nm]; if (!o) return null; const L = []; o.traverse(m => { if (m.isMesh) L.push({ geo: m.geometry, mat: m.material, mw: m.matrixWorld.clone() }); }); return L; };
  const sizes = {}, bb = new THREE.Box3(), v = new THREE.Vector3(); for (const nm in nodes) { bb.setFromObject(nodes[nm]).getSize(v); sizes[nm] = { w: Math.max(v.x, v.z), h: v.y }; }
  const LY = kremlinLayout(D, sizes), K = LY.K, grp = new THREE.Group(); grp.name = 'kremlin2';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }), { white, green, yellow, gold, star } = PMAT || (PMAT = { white: M(0xf1ece0), green: M(0x3f6b4c), yellow: M(0xe8cf8a), gold: new THREE.MeshStandardMaterial({ color: 0xe6b84a, roughness: 0.3, metalness: 0.8 }), star: new THREE.MeshStandardMaterial({ color: 0x8a1a1a, roughness: 0.35, metalness: 0.3, emissive: 0xff1a1a, emissiveIntensity: 0 }) });   // веднъж (нощните материали на изгледа са общ списък)
  // инстанции: за всяка част на модела — един InstancedMesh (матрица = място × матрицата на възела в сцената)
  const inst = (nm, list) => { const P = part(nm); if (!P || !list.length) return; for (const p of P) { const im = new THREE.InstancedMesh(p.geo, p.mat, list.length); list.forEach((t, i) => im.setMatrixAt(i, m4.compose(new THREE.Vector3(t.x, 0.05, t.z), q.setFromAxisAngle(up, t.rot), new THREE.Vector3(t.sx || t.s, t.s, t.s)).multiply(p.mw)));
    im.name = nm; im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im); } };   // името — за Лабораторията (lm-kremlin3: камерата към сградата)
  inst(KR_WALL, LY.walls); inst(KR_FIRS, LY.walls.filter(w => w.firs));
  for (const k of ['kr_vodo', 'kr_tower', 'kr_spass']) inst(k, LY.towers.filter(t => t.k === k));
  for (const t of LY.inner) inst(t.k, [{ x: t.p[0], z: t.p[1], rot: t.rot, s: t.s }]);
  // lm-kremlin3 (55): Сенатът, „Иван Велики“ и трите катедрали — моделите от Blender (kremlin-inner.glb, в метри: +x — изток, основата в 0) на истинските места × K
  const IN = KM.inner && nodes.kr_senate ? [['kr_uspensky', 55.7508, 37.6167, 0], ['kr_archangel', 55.7500, 37.6175, 0], ['kr_annunc', 55.7503, 37.6161, 0], ['kr_ivan', 55.7506, 37.6175, 0], ['kr_senate', 55.7521, 37.6193, null]] : [];
  const out3 = LY.edges[FIRS_EDGE].nin, sRot = Math.atan2(out3[1], -out3[0]);   // Сенатът: върхът с ротондата (+x на модела) — към Червения площад (навън през стената при него)
  for (const [k, la, lo, r] of IN) { const [x, z] = LY.at(la, lo); inst(k, [{ x, z, rot: r ?? sRot, s: K }]); }
  if (flood) flood(grp, 0xffd8a0, 0.5);
  if (IN.length) grp.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { const n = (m && m.name) || ''; if (!/^kr3_/.test(n) || m.userData.kr3) continue; m.userData.kr3 = 1;   /* нощем: топли прозорци, куполите хващат прожекторите, фасадите — осветени */
    const [c, k] = /_win$/.test(n) ? [0xffc070, 1.1] : /_gold$/.test(n) ? [0xffb030, 0.45] : /_silver$/.test(n) ? [0xdfe6ff, 0.32] : /_green$|_roof$/.test(n) ? [0x9fd8b8, 0.18] : /_flag_/.test(n) ? [0xffffff, 0.3] : [0xffd2a0, 0.3]; if (m.emissive) m.emissive.setHex(c); m.userData.winK = k; } });   // нощем — прожекторите по стените, кулите и двореца
  // върхът на кулата (най-високият връх на модела — шпилът не е в средата на основата: Спаската е с предна част)
  const tops = {}, tv = new THREE.Vector3(); for (const k of ['kr_vodo', 'kr_tower', 'kr_spass']) { const P = part(k); if (!P) continue; let best = null; for (const p of P) { const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) { tv.fromBufferAttribute(a, i).applyMatrix4(p.mw); if (!best || tv.y > best.y) best = tv.clone(); } } tops[k] = best; }
  // рубинените звезди: нощем светят червено (адитивно ядро + ореол), денем — тъмночервени
  const stars = LY.towers.filter(t => t.star); if (stars.length) {
    const sm = star, sg = new THREE.OctahedronGeometry(1, 0), im = new THREE.InstancedMesh(sg, sm, stars.length);
    stars.forEach((t, i) => { const r = 2.4 * K * (t.k === 'kr_spass' ? 1.3 : 1), tp = tops[t.k], ss = t.s, c = Math.cos(t.rot), sn = Math.sin(t.rot), lx = tp ? tp.x * ss : 0, lz = tp ? tp.z * ss : 0, y = tp ? tp.y * ss : t.h;   /* върхът на модела → в света (завъртане около y) */
      im.setMatrixAt(i, m4.compose(new THREE.Vector3(t.x + lx * c + lz * sn, y - r * 0.9, t.z - lx * sn + lz * c), q.setFromAxisAngle(up, t.rot), new THREE.Vector3(r, r * 1.15, r * 0.4))); });
    im.computeBoundingSphere(); grp.add(im); if (flood) flood(im, 0xff2a1a, 2.4); }
  // вътре (процедурно, × K): катедралите (бели, златни куполи), „Иван Велики“ (81 м), Сенатът
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), dome = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.6, 1), BX = { white: [], green: [], yellow: [] }, DM = { gold: [], green: [] };
  const put = (L, x, z, w, h, d, y = 0, a = 0) => L.push(m4.compose(new THREE.Vector3(x, y * K, z), q.setFromAxisAngle(up, a), new THREE.Vector3(w * K, h * K, d * K)).clone());
  const [sx, sz] = LY.at(55.7520, 37.6198), [ix, iz] = LY.at(55.7508, 37.6176);
  if (!IN.length) {   // без моделите (lm-kremlin3) — процедурните кутии
  put(BX.yellow, sx, sz, 95, 22, 70, 0, 0.75); put(BX.green, sx, sz, 95, 3, 70, 22, 0.75); put(DM.green, sx, sz, 24, 14, 24, 25);   // Сенатът с купола
  put(BX.white, ix, iz, 13, 60, 13); put(BX.white, ix, iz, 10, 16, 10, 60); put(DM.gold, ix, iz, 10, 12, 10, 76);   // „Иван Велики“ (81 м)
  for (const [la, lo, s4] of [[55.7507, 37.6168, 1], [55.7502, 37.6180, 0.8], [55.7510, 37.6186, 0.75]]) { const [x, z] = LY.at(la, lo);   // Успенска, Архангелска, Благовещенска
    put(BX.white, x, z, 30 * s4, 22 * s4, 38 * s4); for (const [dx, dz, k2] of [[0, 0, 1.3], [-8, -9, 1], [8, -9, 1], [-8, 9, 1], [8, 9, 1]]) { put(BX.white, x + dx * s4 * K, z + dz * s4 * K, 4 * k2 * s4, 6 * s4, 4 * k2 * s4, 22 * s4); put(DM.gold, x + dx * s4 * K, z + dz * s4 * K, 6 * k2 * s4, 6 * k2 * s4, 6 * k2 * s4, 28 * s4); } } }
  const MT = { white, green, yellow, gold }, pg = new THREE.Group(); for (const [geo, S] of [[box, BX], [dome, DM]]) for (const c in S) if (S[c].length) { const im = new THREE.InstancedMesh(geo, MT[c], S[c].length); S[c].forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); pg.add(im); }
  grp.add(pg); if (flood) { flood(pg, 0xffc890, 0.16); MT.gold.emissive.setHex(0xffb030); MT.gold.userData.winK = 0.35; }   // процедурните (без текстура) — по-слабо, иначе стават плоски бели петна
  G.add(grp); G.userData.kremlin2 = LY; return LY;
}
