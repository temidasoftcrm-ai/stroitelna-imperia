// cityplangame.js — планът на града (cityplan.js) в играта: парцели с постоянни id, централа, размери за гарата/магистралата/летището.
// Град с план: нова игра (S.planAll) — всички средни и големи градове; малките остават на мрежата. ?plan=1/0 — в тестовете.
// Старите записи нямат S.plans и остават на мрежата 9×9 — нищо не се мести.
import { makePlan, shiftPlan, LOT_KINDS } from './cityplan.js';

export const PLAN_CORE = 81, PLAN_EXT = 9, PLAN_LOTS = 81 + 4 * 9;   // ядро 9×9, всеки купен квартал +9, до 4 квартала (MAX_EXT); o.exts — повече (световните центрове: 6, feature 'city-size')
// мегаполис: ядро 81 + 162 застроени (както MEGA_BASE колони в мрежата) + всеки купен квартал 81 (MEGA_EXT_COLS × 9)
export const MEGA_CORE = 81 + 162, MEGA_EXT = 81, MEGA_LOTS = MEGA_CORE + 4 * MEGA_EXT;
export const planCount = (mega, ext = 0) => mega ? MEGA_CORE + MEGA_EXT * ext : PLAN_CORE + PLAN_EXT * ext;
const EDGE = -108;   // западният и северният край на старата мрежа (tx(0)) — там започва градът
const cache = new Map();
// o.landmark — по-голям площад за главната забележителност; o.seaside — без морски шаблон (морето е от seaside.js);
// o.bigZone — { kind, W, D, asp, turn, size: [w, d] }: запазено място на север от площада за голямата забележителност (Капитолият…)
export function gamePlan(cityId, o = {}) {
  if (cache.has(cityId)) return cache.get(cityId);
  const P0 = makePlan(cityId, { game: true, minLots: o.mega ? MEGA_LOTS : PLAN_CORE + PLAN_EXT * (o.exts || 4), ...(o.mega ? { mega: true, R: 400 } : {}), ...(o.landmark ? { squareR: 30 } : {}), ...(o.bigZone ? { bigZone: o.bigZone.size } : {}), ...(o.tpl ? { tpl: o.tpl } : {}), ...(o.clean ? { clean: true } : {}), ...(o.clean2 ? { clean2: true } : {}), ...(o.seaside ? { noCoast: true } : {}) });
  if (!P0) return null;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of P0.boundary) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  for (const st of P0.streets) for (const [x, z] of st.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const P = shiftPlan(P0, EDGE - x0, EDGE - z0);
  P.ext = { x1: x1 + EDGE - x0, z1: z1 + EDGE - z0 };   // източният и южният край (за летището и магистралата)
  P.mega = !!o.mega;
  if (P.bigZone && o.bigZone) P.bigZone = { ...P.bigZone, ...o.bigZone };   // { kind, W, D, asp, turn } — refreshMines3D слага голямата забележителност тук
  P.hqLot = 0;   // централата — най-близкият парцел до площада (без геометрия: и градовете, в които още не си влизал, го знаят)
  cache.set(cityId, P);
  while (cache.size > 6) cache.delete(cache.keys().next().value);
  return P;
}
// парцелите на града: ядрото + купените квартали (id ≥ 81 — „нови“, празни като купените квартали в мрежата)
// мегаполис: 81..242 — застроените квартали около ядрото (mega), от 243 — купените (fresh)
export function planLots(P, ext = 0) {
  const core = P.mega ? MEGA_CORE : PLAN_CORE;
  return P.lots.slice(0, Math.min(P.lots.length, planCount(P.mega, ext))).map(L => {
    const mega = !!P.mega && L.id >= PLAN_CORE && L.id < core;
    // застроените квартали на мегаполиса са гъсти: по булевардите — небостъргачи (център), иначе — блокове и магазини (среден пояс)
    const zone = mega ? (P.streets[L.street].w >= 10 ? 'center' : 'mid') : L.zone;
    return { id: L.id, x: L.x, z: L.z, rot: L.rot, w: L.w, d: L.d, zone, kinds: mega ? LOT_KINDS[zone] : L.kinds, street: L.street,
      fresh: L.id >= core, built: null, obj: null, busy: null, mega, plan: true };
  });
}
// колко плочки (TILE = 8) трябват на мрежата, за да стигне до източния/южния край на плана (NI, NJ)
export function planTiles(P, TILE = 8) { return [Math.ceil((P.ext.x1 - EDGE) / TILE) + 2, Math.ceil((P.ext.z1 - EDGE) / TILE) + 2]; }
