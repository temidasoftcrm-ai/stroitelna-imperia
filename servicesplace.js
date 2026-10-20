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
import { SERVICES } from './services.js';

const MAIN = new Set(['blvd', 'quay', 'ring', 'main']);
// истински размери в метри (сградите и колите са 1:1, картата е ×0,45): [фронт, дълбочина] за ниво l; s ×0,75, m ×0,88
const REAL = { hall: [50, 40], hosp: [60, 40], fire: [32, 26], police: [30, 24], school: [45, 30], kinder: [25, 20], voc: [45, 30], uni: [70, 45], park: [40, 34], sport: [60, 45], bus: [45, 30], util: [36, 28], recycle: [40, 30] };
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
      if (sc < bs) { bs = sc; best = { lots: ids, x, z, rot: L0.rot, w: Math.min(w, needW * 1.1), d: Math.min(d, needD * 1.15), district: L0.district, main: MAIN.has(info[ids[0]].cls) }; }
    }
    return best;
  }
  function assign(rec) {
    const out = [];
    for (const [k, list] of Object.entries(rec || {})) (list || []).forEach((b, i) => { if (b.lots && b.lots.length) return; const p = place(k, b.lvl, rec); if (!p) return; b.lots = p.lots; out.push({ k, i, ...p }); });
    return out;
  }
  // готовите сгради с парцели → място за 3D (комбинираният парцел)
  function spots(rec) {
    const out = [];
    for (const [k, list] of Object.entries(rec || {})) (list || []).forEach((b, i) => { if (!b.lots || !b.lots.length) return; const ids = b.lots, L0 = lots[ids[0]], R = realSize(k, b.lvl), full = Math.min(...ids.map(j => lots[j].d));
      const w = Math.min(ids.reduce((s, j) => s + lots[j].w, 0), R[0] * 1.1), d = Math.min(full, R[1] * 1.15), sh = (full - d) / 2;   // по-плитка от парцела → към улицата (локално +z)
      out.push({ k, i, lvl: b.lvl, prog: b.prog, x: ids.reduce((s, j) => s + lots[j].x, 0) / ids.length + Math.sin(L0.rot) * sh, z: ids.reduce((s, j) => s + lots[j].z, 0) / ids.length + Math.cos(L0.rot) * sh, rot: L0.rot, w, d, district: L0.district, main: MAIN.has(info[ids[0]].cls) }); });
    return out;
  }
  function byDistrict(rec) {
    const out = {}; for (const [d, n] of Object.entries(dist)) out[d] = { lots: n, share: n / total };
    for (const [k, list] of Object.entries(rec || {})) for (const b of list || []) if (b.lots && b.lots.length) { const d = lots[b.lots[0]].district; out[d][k] = (out[d][k] || 0) + 1; }
    return out;
  }
  const release = (rec, k, i) => { const b = rec && rec[k] && rec[k][i]; if (b) b.lots = []; };
  return { place, assign, spots, byDistrict, release };
}

// 3D слой: всички сгради с парцели (services3d.js buildService) — в групата; update(night) — светлините; dispose()
export async function servicesLayer(gp, rec, o = {}) {
  const { buildService } = await import('./services3d.js'), THREE = await import('three');
  const sp = servicePlacer(gp), group = new THREE.Group(), items = [];
  for (const s of sp.spots(rec)) { const b = buildService(s.k, s.lvl, { w: s.w, d: s.d }, { seed: s.i + s.k.length, region: o.region || 'eu', outline: !!o.outline }); b.group.position.set(s.x, 0, s.z); b.group.rotation.y = s.rot; group.add(b.group); items.push({ ...s, b }); }
  return { group, items, setNight: on => items.forEach(it => it.b.setNight(on)), dispose: () => items.forEach(it => it.b.dispose()) };
}
