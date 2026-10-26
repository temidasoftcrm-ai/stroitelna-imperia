// towers.js — 🏢 meshy-tower (f6): високите жилищни блокове в централните квартали на балканските и източноевропейските градове.
// Модели (Meshy AI, собствени на ТЕМИДАСОФТ — assets/heavy/CREDITS.txt): „Urban Tower“ — 15 етажа, кремава фасада с тъмни ъгли, мансарда, магазини
// на партера (3 оттенъка на фасадата); „Tower Residence“ — руски панелен блок (Русия, Украйна, Беларус). Олекотени в Blender (улицата под тях — изрязана),
// нощната карта (прозорците, ~45 % светнали) — изпечена от основната текстура.
// В истински размер (не се вписват в малките фасади на фоновите квартали): на място по улицата, където кулата не стъпва на улица, парк, забележителност
// или парцел на играча; фасадите на фоновите сгради под нея се скриват (като rome-bld). По хеш на града — едни и същи места при всяко влизане.
//   cityplan2-3d.js: opts.romeNear = { V, fn: towerNear, o } (куката на rome-bld: update(camera) / dirty() / dispose())
import * as THREE from 'three';

export const TOWER_FILES = { 'tw-urban': 'towers/urban-tower.glb', 'tw-ru': 'towers/ru-blocks.glb' };
const EAST = new Set(['🇧🇬', '🇷🇸', '🇷🇴', '🇲🇰', '🇬🇷', '🇲🇪', '🇧🇦', '🇦🇱', '🇽🇰', '🇭🇷', '🇲🇩', '🇵🇱', '🇭🇺', '🇸🇰', '🇨🇿', '🇱🇹', '🇱🇻', '🇪🇪', '🇬🇪', '🇦🇲']), RU = new Set(['🇷🇺', '🇺🇦', '🇧🇾']);
export const towerKinds = cc => RU.has(cc) ? ['tw-ru', 'tw-ru', 'tw-urban#0', 'tw-urban#2'] : EAST.has(cc) ? ['tw-urban#0', 'tw-urban#1', 'tw-urban#2'] : null;
// истинската височина (м): Urban Tower — 15 етажа + мансарда; руският — 16 етажа
const HM = { 'tw-urban': 46, 'tw-ru': 48 };
const TINT = [null, 0xf3d9b8, 0xd5dde6];   // кремаво (както е), по-топло, по-студено сиво
// нощните прозорци — правоъгълници в шейдъра (решетка по етажите и колоните по стените на модела; изпечената от текстурата маска даваше петна):
// етажите между a и b (дял от височината), fl етажа, колоните през cw м; ~40 % светят в 3 топли нюанса; партерът (под a) — витрините
const WIN = { 'tw-urban': { fl: 15, a: 0.075, b: 0.86, cw: 3.4 }, 'tw-ru': { fl: 16, a: 0.045, b: 0.93, cw: 3.0 } };
function winShader(mt, geo, k, seed) {
  geo.computeBoundingBox(); const gb = geo.boundingBox, H = gb.max.y - gb.min.y, W = WIN[k], mpu = HM[k] / H;
  mt.emissiveMap = null; mt.emissive.setRGB(1, 1, 1);
  mt.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uTwY0: { value: gb.min.y }, uTwH: { value: H }, uTwA: { value: W.a }, uTwB: { value: W.b }, uTwFl: { value: W.fl }, uTwCw: { value: W.cw / mpu }, uTwSeed: { value: seed } });
    sh.vertexShader = 'varying vec3 vTwP; varying vec3 vTwN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTwP = position; vTwN = normal;');
    sh.fragmentShader = 'varying vec3 vTwP; varying vec3 vTwN; uniform float uTwY0, uTwH, uTwA, uTwB, uTwFl, uTwCw, uTwSeed;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `{
      vec3 n = normalize(vTwN); float m = 0.0; vec3 tc = vec3(1.0);
      if (abs(n.y) < 0.4) {
        bool sx = abs(n.x) > abs(n.z); float u = sx ? vTwP.z : vTwP.x, side = sx ? sign(n.x) : 2.0 + sign(n.z), hy = (vTwP.y - uTwY0) / uTwH;
        if (hy > uTwA && hy < uTwB) {
          float fy = (hy - uTwA) / (uTwB - uTwA) * uTwFl, fi = floor(fy), ffy = fract(fy), cx = u / uTwCw, ci = floor(cx), ffx = fract(cx);
          float r = fract(sin(dot(vec3(fi, ci, side), vec3(12.9898, 78.233, 37.719)) + uTwSeed) * 43758.5453), r2 = fract(r * 7.13);
          m = step(0.22, ffx) * step(ffx, 0.78) * step(0.3, ffy) * step(ffy, 0.82) * step(r, 0.4) * (0.75 + 0.25 * r2);
          tc = (r2 < 0.45 ? vec3(1.0, 0.62, 0.27) : r2 < 0.8 ? vec3(1.0, 0.72, 0.4) : vec3(0.92, 0.52, 0.22)) * 0.85;
        } else if (hy > 0.004 && hy < uTwA) { float ffx = fract(u / (uTwCw * 1.7)), ffy = hy / uTwA; m = step(0.12, ffx) * step(ffx, 0.88) * step(0.12, ffy) * step(ffy, 0.78) * 0.85; tc = vec3(1.0, 0.75, 0.45); }
      }
      totalEmissiveRadiance *= tc * m; }`);
  };
  mt.customProgramCacheKey = () => 'tw-win-' + k;
}

// веднъж: дългата страна — по x (лицето +z — към улицата), основата — на земята; нощем прозорците светят (win — dayNight.winMats)
export function towerPrep(M, win) {
  const V = {};
  const prep = (src, k, tint) => {
    const o = src.clone(true); o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; m.material = m.material.clone(); const mt = m.material;
      mt.metalness = 0; mt.metalnessMap = null; mt.roughnessMap = null; mt.normalMap = null; mt.roughness = 0.85;   // Meshy: металността без env map — почти черна фасада денем
      if (tint) mt.color.multiply(new THREE.Color(tint));
      winShader(mt, m.geometry, k, (tint || 7) % 97); mt.emissiveIntensity = 0; mt.userData.winK = 0.6; win(mt); });
    const g = new THREE.Group(); g.add(o); let b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
    if (s.z > s.x) { o.rotation.y = Math.PI / 2; o.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(o); s = b.getSize(new THREE.Vector3()); }
    const c = b.getCenter(new THREE.Vector3()); o.position.set(-c.x, -b.min.y, -c.z);
    const w = new THREE.Group(); w.add(g); w.scale.setScalar(HM[k] / s.y); w.userData.L = s.x * HM[k] / s.y; w.userData.D = s.z * HM[k] / s.y; return w; };
  if (M['tw-urban']) TINT.forEach((t, i) => { V['tw-urban#' + i] = prep(M['tw-urban'], 'tw-urban', t); });
  if (M['tw-ru']) V['tw-ru'] = prep(M['tw-ru'], 'tw-ru', null);
  return V;
}

// G — групата на изгледа; BL — фоновите сгради (romeBlocks: list, shown(b), hide(set)); o: { keys, seed, n, roads, lots, center }
export function towerNear(G, BL, V, o = {}) {
  const keys = (o.keys || []).filter(k => V[k]); if (!keys.length || !BL || !BL.list.length) return null;
  const root = new THREE.Group(); root.name = 'towers'; root.userData.extShared = true; G.add(root);
  const hash = i => { let h = (Math.imul(i + 1, 2654435761) ^ (o.seed | 0)) >>> 0; h ^= h >>> 15; return Math.imul(h, 2246822507) >>> 0; };
  // улиците: точки през 3 м с половината ширина (мрежа 20 м)
  const RG = new Map();
  for (const rd of o.roads || []) { const hw = (rd.w || 10) / 2; for (let i = 1; i < rd.pts.length; i++) { const [ax, az] = rd.pts[i - 1], [bx, bz] = rd.pts[i], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 3));
    for (let j = 0; j <= n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n, k = Math.floor(x / 20) * 100003 + Math.floor(z / 20); (RG.get(k) || RG.set(k, []).get(k)).push(x, z, hw); } } }
  const clear = (x, z) => { let m = 1e9; const i = Math.floor(x / 20), j = Math.floor(z / 20);   // колко е от ръба на най-близката улица
    for (let a = i - 2; a <= i + 2; a++) for (let c = j - 2; c <= j + 2; c++) { const q = RG.get(a * 100003 + c); if (q) for (let n = 0; n < q.length; n += 3) m = Math.min(m, Math.hypot(q[n] - x, q[n + 1] - z) - q[n + 2]); } return m; };
  const bigs = (o.lots || []).filter(L => L.big || L.lm);   // паркове, забележителности, площади
  let dirty = true;
  function place() {
    root.clear(); const ctr = o.center || { x: 0, z: 0 }, N = o.n || 6, out = [], hide = new Set();
    const cand = BL.list.map((b, i) => [b, i]).filter(([b]) => b.h >= 9 && BL.shown(b) && Math.hypot(b.x - ctr.x, b.z - ctr.z) < (o.R || 900)).sort((a, b) => hash(a[1]) - hash(b[1]));
    const why = { bl: BL.list.length, cand: cand.length, road: 0, big: 0, near: 0, own: 0 }; root.userData.why = why;
    for (const [b, i] of cand) { if (out.length >= N) break;
      const k = keys[hash(i + 31) % keys.length], m = V[k], L = m.userData.L, D = m.userData.D;
      // лицето — към по-близката улица (±90° от b.rot — по улицата; иначе и другите две посоки); кулата — с лицето на линията на фасадата
      // (или в средата на сградата — гъстите квартали от картата), навътре в квартала; не стъпва на улица (точки през ~6 м)
      const Y = [Math.PI / 2, -Math.PI / 2, 0, Math.PI].map(y => { const r = b.rot + y, nx = Math.sin(r), nz = Math.cos(r); return { r, nx, nz, d: clear(b.x + nx * (b.d / 2 + 3), b.z + nz * (b.d / 2 + 3)) + (y === 0 || y === Math.PI ? 50 : 0) }; }).sort((p, q) => p.d - q.d);
      let ok = false, r, nx, nz, ux, uz, cx, cz;
      for (const yy of Y) { for (const sh of [b.d / 2 - D / 2, 0]) { ({ r, nx, nz } = yy); ux = nz; uz = -nx; cx = b.x + nx * sh; cz = b.z + nz * sh; ok = true;
        for (let a = -0.5; a <= 0.5 && ok; a += Math.min(0.5, 6 / L)) for (let c = -0.5; c <= 0.5; c += Math.min(0.5, 6 / D)) { if (clear(cx + ux * a * L + nx * c * D, cz + uz * a * L + nz * c * D) < 1.5) { ok = false; break; } }
        if (ok) break; } if (ok) break; }
      if (!ok) { why.road++; continue; }
      const inR = (x, z, pad) => { const dx = x - cx, dz = z - cz, a = dx * ux + dz * uz, c = dx * nx + dz * nz; return Math.abs(a) < L / 2 + pad && Math.abs(c) < D / 2 + pad; };
      if (bigs.some(l => inR(l.x, l.z, Math.max(l.w || 0, l.d || 0) / 2))) { why.big++; continue; }
      if (out.some(t => Math.hypot(t.x - cx, t.z - cz) < (t.R + Math.hypot(L, D) / 2) + 10)) continue;
      const under = BL.list.filter(q => inR(q.x, q.z, 2));
      if (under.some(q => !BL.shown(q))) { why.own++; continue; }   // парцел на играча / зает — не
      under.forEach(q => hide.add(q));
      const t = m.clone(true); t.position.set(cx, 0, cz); t.rotation.y = r; t.userData.src = 'tower-' + k; root.add(t);
      out.push({ x: cx, z: cz, R: Math.hypot(L, D) / 2, k });
    }
    BL.hide(hide); root.userData.placed = out;
  }
  return { update() { if (dirty) { dirty = false; place(); } }, dirty() { dirty = true; }, dispose() { G.remove(root); }, placed: () => root.userData.placed || [] };
}
