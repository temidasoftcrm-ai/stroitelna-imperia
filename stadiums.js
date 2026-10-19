// stadiums.js — известните стадиони за световното по футбол (worldevents.js): домакинът получава своя стадион, ако е одобрен в
// Лабораторията (st-<име>); иначе — общият стадион на световното (Ал Уакра, st-alwakrah), иначе — обикновеният национален (tender3d.js).
// Моделите — Sketchfab (CC-BY, авторите в CREDITS.txt), assets/heavy/stadium2, олекотени.
import { feature } from './lab/feature.js';

export const STADIUMS = {
  // m — истинската дължина (м) и ширина: стадионите са в реалните си пропорции един спрямо друг (tender3d.js — най-големият запълва площадката)
  bernabeu: { city: 'madrid', url: 'assets/heavy/stadium2/sf-bernabeu.glb', m: [250, 210] },
  stadefrance: { city: 'paris', url: 'assets/heavy/stadium2/sf-stadefrance.glb', m: [270, 230] },
  maracana: { city: 'rio', url: 'assets/heavy/stadium2/sf-maracana.glb', m: [317, 279] },
  bombonera: { city: 'buenosaires', url: 'assets/heavy/stadium2/sf-bombonera.glb', m: [200, 160] },
  azteca: { city: 'mexicocity', url: 'assets/heavy/stadium2/sf-azteca.glb', m: [290, 250] },
  alwakrah: { city: null, url: 'assets/heavy/stadium2/sf-alwakrah.glb', m: [270, 240] },   // общият за световното
};
// стадионът на световното в града city (ключ за tender3d opts.variant) или undefined — обикновеният
export function wcStadium(city) {
  for (const [k, s] of Object.entries(STADIUMS)) if (s.city === city && feature('st-' + k)) return k;
  return feature('st-alwakrah') ? 'alwakrah' : undefined;
}
export const STADIUM_MAX_M = 320;   // най-големият (Маракана) — запълва площадката на търга
