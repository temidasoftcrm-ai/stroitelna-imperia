// statues.js — ⛲ statues (f9): фонтани и статуи в градовете по плана v2 — 8 модела от Sketchfab, избрани от потребителя (CC-BY 4.0, assets/heavy/CREDITS.txt),
// олекотени (Blender decimate, webp 1024) в assets/heavy/statues. В истински ръст; само на свободни места — без парцели, улици, вода и сгради:
// фонтан в центъра на парковете (вместо процедурния), фонтани и статуи в по-големите зелени площи, малките (бюст, фонтан Уолъс) — по разделителната ивица на булевардите.
// Франция — Уолъс, Обсерваторията и Наполеон; Австрия — Щраус; другаде в Европа — разнообразно; извън Европа — само фонтаните. Нощем — леко осветени.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { fwFx, fwWaterMat } from './fountainwater.js';   // ⛲ fountain-water: басейнът на Артемида — вълнички, пръски, нощем сияние

export const STATUE_FILES = Object.fromEntries(['fn-brno', 'fn-wallace', 'fn-artemis', 'fn-observatoire', 'st-napoleon', 'st-ernst', 'st-masaryk', 'st-strauss'].map(k => [k, `statues/${k}.glb`]));
// h — височината в света (м, с пиедестала); ped — свой пиедестал [ш, д, в]; basin — басейн с вода (радиус)
const SPEC = { 'fn-brno': { h: 3.6 }, 'fn-wallace': { h: 2.7 }, 'fn-artemis': { h: 3.4, ped: [1.6, 1.6, 1.4], basin: 4.2 }, 'fn-observatoire': { h: 8.5 },
  'st-napoleon': { h: 4.4, ped: [2.8, 4.6, 3.0] }, 'st-ernst': { h: 8.5 }, 'st-masaryk': { h: 2.9 }, 'st-strauss': { h: 6.5 } };
const STONE = 0xcfc8ba;

// подготовка (веднъж): всеки модел — на земята, центриран, в истински ръст, с пиедестала/басейна; нощем — меко осветен (win(материал) → dayNight)
export function statuePrep(M, win) {
  const V = {}, stone = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.85 }), water = new THREE.MeshStandardMaterial({ color: 0x4f7f9c, roughness: 0.08, metalness: 0.3 });
  for (const k in SPEC) { const src = M[k]; if (!src) continue; const sp = SPEC[k], g = new THREE.Group(), o = src.clone(true);
    o.traverse(m => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = true; for (const mt of [].concat(m.material)) if (mt.emissive && !mt.userData.stNight) { mt.userData.stNight = 1; mt.emissive.setRGB(1, 0.84, 0.62); mt.emissiveMap = mt.map || null; mt.emissiveIntensity = 0; mt.userData.winK = 0.38; mt.needsUpdate = true; win(mt); } });   // нощем — топло, отдолу нагоре (картата на модела)
    const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), py = sp.ped ? sp.ped[2] : 0, k2 = sp.h / s.y;
    o.position.set(-c.x * k2, py - b.min.y * k2, -c.z * k2); o.scale.setScalar(k2); g.add(o);
    if (sp.ped) { const p = new THREE.Mesh(new THREE.BoxGeometry(sp.ped[0], sp.ped[2], sp.ped[1]), stone); p.position.y = sp.ped[2] / 2; p.castShadow = p.receiveShadow = true; g.add(p);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(sp.ped[0] + 0.6, 0.4, sp.ped[1] + 0.6), stone); p2.position.y = 0.2; g.add(p2); }
    if (sp.basin) { const r = sp.basin, rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.3, 0.7, 32, 1, true), stone), top = new THREE.Mesh(new THREE.RingGeometry(r - 0.35, r, 32).rotateX(-Math.PI / 2), stone), w = new THREE.Mesh(new THREE.CircleGeometry(r - 0.3, 32).rotateX(-Math.PI / 2), water);
      rim.position.y = 0.35; top.position.y = 0.7; w.position.y = 0.55; rim.receiveShadow = true; g.add(rim, top, w); if (feature('fountain-water')) { w.material = fwWaterMat(); g.add(fwFx({ splash: [[0.56, (sp.ped ? sp.ped[0] * 0.75 : 1) + 0.2, 20], [0.56, r * 0.62, 18]], u: 8 })); } }
    const bb = new THREE.Box3().setFromObject(g); g.userData.rad = Math.max(bb.max.x, -bb.min.x, bb.max.z, -bb.min.z); g.userData.h = sp.h + (sp.ped ? sp.ped[2] : 0); V[k] = g; }
  return V;
}

// местата в парка (парцел „park“): фонтанът — в центъра; в по-големите (≥ 40 м) — и статуя на четвърт от ширината встрани; r — поляната без дървета
export const parkSpots = L => { const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), out = [[L.x, L.z, 7]]; if (Math.min(L.w, L.d) >= 40) out.push([L.x + c * L.w / 4, L.z - s * L.w / 4, 6]); return out; };
// G — групата на изгледа; P — планът (координатите на изгледа); o: { cc — флагът на държавата, eu — в Европа ли е, seed }
export function placeStatues(G, P, V, o = {}) {
  const root = new THREE.Group(); root.name = 'statues'; root.userData.extShared = true; G.add(root);   // моделите са общи — dispose() на изгледа не ги пипа
  let sd = (o.seed || 1) >>> 0; const rnd = () => { sd = (Math.imul(sd ^ (sd >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return sd / 4294967296; };
  const FR = o.cc === '🇫🇷', AT = o.cc === '🇦🇹', has = k => !!V[k], CNT = {}, pickOf = L => { let l = L.filter(k => has(k) && (CNT[k] || 0) < 2); if (!l.length) l = L.filter(has); if (!l.length) return null; const k = l[Math.floor(rnd() * l.length)]; CNT[k] = (CNT[k] || 0) + 1; return k; };   // всеки модел — до 2 пъти в града (иначе — пак)
  const FOUNT = FR ? ['fn-observatoire', 'fn-wallace', 'fn-observatoire', 'fn-brno', 'fn-artemis'] : ['fn-brno', 'fn-artemis', 'fn-brno', 'fn-artemis', 'fn-brno', 'fn-artemis', 'fn-brno', 'fn-observatoire'];
  const STAT = !o.eu ? [] : FR ? ['st-napoleon', 'st-napoleon', 'st-ernst', 'st-masaryk'] : AT ? ['st-strauss', 'st-ernst', 'st-masaryk', 'st-napoleon'] : ['st-ernst', 'st-masaryk', 'st-ernst', 'st-masaryk', 'st-napoleon', 'st-strauss'];
  let first = FR ? 'st-napoleon' : AT ? 'st-strauss' : null; const stat = () => { const k = first && has(first) ? first : pickOf(STAT); if (k === first) CNT[k] = (CNT[k] || 0) + 1; first = null; return k; };   // първата статуя: Франция — Наполеон, Австрия — Щраус
  const SMALL = FR ? ['fn-wallace'] : o.eu ? ['st-masaryk'] : [];
  // улиците: точки през ~4 м с полуширината (с тротоара), в мрежа 20 м; парцелите — правоъгълници; вода
  const RG = new Map(), rk = (i, j) => i * 100003 + j;
  for (const rd of P.roads) { const hw = rd.w / 2 + (rd.walk || 0); for (let i = 1; i < rd.pts.length; i++) { const a = rd.pts[i - 1], b = rd.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0; s <= l; s += 4) { const x = a[0] + (b[0] - a[0]) * s / (l || 1), z = a[1] + (b[1] - a[1]) * s / (l || 1), k = rk(Math.floor(x / 20), Math.floor(z / 20)); (RG.get(k) || RG.set(k, []).get(k)).push(x, z, hw); } } }
  const roadGap = (x, z) => { let m = 1e9, ang = 0; const i0 = Math.floor(x / 20), j0 = Math.floor(z / 20); for (let a = i0 - 3; a <= i0 + 3; a++) for (let b = j0 - 3; b <= j0 + 3; b++) { const c = RG.get(rk(a, b)); if (c) for (let q = 0; q < c.length; q += 3) { const d = Math.hypot(c[q] - x, c[q + 1] - z) - c[q + 2]; if (d < m) { m = d; ang = Math.atan2(c[q] - x, c[q + 1] - z); } } } return [m, ang]; };
  const inLot = (x, z, r, skip) => P.lots.some(L => { if (L === skip) return false; const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), dx = x - L.x, dz = z - L.z; return Math.abs(dx * c - dz * s) < L.w / 2 + r && Math.abs(dx * s + dz * c) < L.d / 2 + r; });
  const placed = [], far = (x, z) => placed.every(([px, pz]) => Math.hypot(px - x, pz - z) > 45);   // в парка двете места са по-близо — put не проверява
  const put = (k, x, z, ry) => { const m = V[k].clone(true); m.userData.key = k; m.position.set(x, 0, z); m.rotation.y = ry; root.add(m); placed.push([x, z, k]); };
  const free = (k, x, z, skip, pad = 1.5) => { const r = V[k].userData.rad; if (P.waterAt && P.waterAt(x, z)) return null; const [g, ang] = roadGap(x, z); if (g < r + pad || inLot(x, z, r + pad, skip) || !far(x, z)) return null; return ang; };
  const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  // 1) парковете (парцелите „park“): фонтанът — в центъра (там беше процедурният)
  for (const L of P.lots) { if (L.big !== 'park') continue; const [c0, c1] = parkSpots(L), k = pickOf(FOUNT); if (k && V[k].userData.rad <= Math.min(L.w, L.d) * 0.3) put(k, c0[0], c0[1], rnd() * Math.PI * 2);
    const k2 = c1 && STAT.length && stat(); if (k2 && V[k2].userData.rad <= c1[2] + 1) put(k2, c1[0], c1[1], (L.rot || 0) - Math.PI / 2); }   // статуята — с лице към центъра (фонтана)
  // 2) зелените площи (истинската карта): по-големите първо; в центъра (или по-навътре към върховете), ако е свободно — редуват се статуя и фонтан
  const GS = (P.greensSrc || []).map(g => { const p = g.poly; let A = 0, cx = 0, cz = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const f = p[j][0] * p[i][1] - p[i][0] * p[j][1]; A += f; cx += (p[j][0] + p[i][0]) * f; cz += (p[j][1] + p[i][1]) * f; } A /= 2; return { p, A: Math.abs(A), cx: A ? cx / (6 * A) : p[0][0], cz: A ? cz / (6 * A) : p[0][1] }; }).filter(g => g.A > 2500).sort((a, b) => b.A - a.A);
  let n2 = 0;
  for (const g of GS) { if (n2 >= 14) break; const k = n2 % 2 === 0 && STAT.length ? stat() : pickOf(FOUNT); if (!k) continue;
    for (const t of [0, 0.3, 0.5]) { let ok = false; for (let v = 0; v < (t ? g.p.length : 1); v += Math.max(1, Math.floor(g.p.length / 6))) { const x = t ? g.cx + (g.p[v][0] - g.cx) * t : g.cx, z = t ? g.cz + (g.p[v][1] - g.cz) * t : g.cz;
      if (!inPoly(x, z, g.p)) continue; const ang = free(k, x, z, null, 3); if (ang === null) continue; put(k, x, z, ang); n2++; ok = true; break; } if (ok) break; } }
  // 3) булевардите: по един малък (бюст / фонтан Уолъс) по разделителната ивица — между дърветата, далеч от кръстовищата
  let n3 = 0;
  for (const rd of P.roads) { if (n3 >= 8 || rd.cls !== 'blvd' || !SMALL.length) continue; const T = rd.L[rd.L.length - 1]; if (T < 220) continue; const k = pickOf(SMALL); if (!k || V[k].userData.rad > 1.4) continue;   /* ивицата е ~3 м */
    const s = 14 + 30 * Math.round((T / 2 - 29) / 30) + 15; let i = 1; while (i < rd.L.length - 1 && rd.L[i] < s) i++; const a = rd.pts[i - 1], b = rd.pts[i], t = (s - rd.L[i - 1]) / ((rd.L[i] - rd.L[i - 1]) || 1), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (P.nodes.some(n => Math.hypot(n.x - x, n.z - z) < 30) || !far(x, z)) continue; put(k, x, z, Math.atan2(b[0] - a[0], b[1] - a[1]) + Math.PI / 2); n3++; }
  return { list: placed, dispose() { G.remove(root); } };
}
