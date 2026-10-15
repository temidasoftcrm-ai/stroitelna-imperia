// cityplangame.js — планът на града (cityplan.js) в играта: парцели с постоянни id, централа, размери за гарата/магистралата/летището.
// Град с план: S.plans[id] (нова игра в София; ?plan=1 — нова игра във всеки град; ?plan=0 — без план).
// Старите записи нямат S.plans и остават на мрежата 9×9 — нищо не се мести.
import { makePlan, shiftPlan } from './cityplan.js';

export const PLAN_CORE = 81, PLAN_EXT = 9, PLAN_LOTS = 81 + 4 * 9;   // ядро 9×9, всеки купен квартал +9, до 4 квартала (MAX_EXT)
const EDGE = -108;   // западният и северният край на старата мрежа (tx(0)) — там започва градът
const cache = new Map();
export function gamePlan(cityId) {
  if (cache.has(cityId)) return cache.get(cityId);
  const P0 = makePlan(cityId, { game: true, minLots: PLAN_LOTS });
  if (!P0) return null;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  for (const [x, z] of P0.boundary) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  for (const st of P0.streets) for (const [x, z] of st.pts) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  const P = shiftPlan(P0, EDGE - x0, EDGE - z0);
  P.ext = { x1: x1 + EDGE - x0, z1: z1 + EDGE - z0 };   // източният и южният край (за летището и магистралата)
  // централата: парцел от центъра до булевард, най-близо до площада
  const c = P.lots.slice(0, 9).filter(L => P.streets[L.street].w >= 10);
  P.hqLot = (c[0] || P.lots[0]).id;
  cache.set(cityId, P);
  return P;
}
// парцелите на града: ядрото + купените квартали (id ≥ 81 — „нови“, празни като купените квартали в мрежата)
export function planLots(P, ext = 0) {
  return P.lots.slice(0, Math.min(P.lots.length, PLAN_CORE + PLAN_EXT * ext)).map(L => ({ id: L.id, x: L.x, z: L.z, rot: L.rot, w: L.w, d: L.d, zone: L.zone, kinds: L.kinds, street: L.street,
    fresh: L.id >= PLAN_CORE, built: null, obj: null, busy: null, mega: false, plan: true }));
}
// колко плочки (TILE = 8) трябват на мрежата, за да стигне до източния/южния край на плана (NI, NJ)
export function planTiles(P, TILE = 8) { return [Math.ceil((P.ext.x1 - EDGE) / TILE) + 2, Math.ceil((P.ext.z1 - EDGE) / TILE) + 2]; }
