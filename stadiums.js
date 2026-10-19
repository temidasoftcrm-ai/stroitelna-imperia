// stadiums.js — известните стадиони за световното по футбол (worldevents.js): домакинът получава своя стадион, ако е одобрен в
// Лабораторията (st-<име>); иначе — общият стадион на световното (Ал Уакра, st-alwakrah), иначе — обикновеният национален (tender3d.js).
// Моделите — Sketchfab (CC-BY, авторите в CREDITS.txt), assets/heavy/stadium2, олекотени.
import { feature } from './lab/feature.js';

export const STADIUMS = {
  bernabeu: { city: 'madrid', url: 'assets/heavy/stadium2/sf-bernabeu.glb', side: 25 },
  stadefrance: { city: 'paris', url: 'assets/heavy/stadium2/sf-stadefrance.glb', side: 25 },
  maracana: { city: 'rio', url: 'assets/heavy/stadium2/sf-maracana.glb', side: 25 },
  bombonera: { city: 'buenosaires', url: 'assets/heavy/stadium2/sf-bombonera.glb', side: 25 },
  azteca: { city: 'mexicocity', url: 'assets/heavy/stadium2/sf-azteca.glb', side: 25 },
  alwakrah: { city: null, url: 'assets/heavy/stadium2/sf-alwakrah.glb', side: 25 },   // общият за световното
};
// стадионът на световното в града city (ключ за tender3d opts.variant) или undefined — обикновеният
export function wcStadium(city) {
  for (const [k, s] of Object.entries(STADIUMS)) if (s.city === city && feature('st-' + k)) return k;
  return feature('st-alwakrah') ? 'alwakrah' : undefined;
}
