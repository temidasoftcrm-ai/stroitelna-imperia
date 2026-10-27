// gfxpresets.js — 🎨 gfx-presets (f9): графиката Ниско / Средно / Високо (⚙️ Настройки; „Проверка на компютъра“ предлага ниво — perfmeter.js).
// Пази се в localStorage (зависи от компютъра, не от записа); прилага се веднага — без презареждане.
// Средно = досегашното поведение на играта; Ниско — без сенки и нощни етажи, по-малко коли и хора, по-близо видимост, pixel ratio 1;
// Високо — pixel ratio до 2 (остри ръбове на големи/HiDPI екрани) и по-далечна видимост.
// 🟠 gfx-lite (55): „Много ниско“ под Ниско (по-ниска резолюция, без сенки, детайлите само наблизо, без нощни ореоли, по-малки текстури, без изглаждане)
// и „⚙️ Подробно“ — свои стойности върху избраното ниво: 'stroi-gfx' = 'low' или {"lv":"low","o":{shadows,far,traffic,res,night,detail}}.
// res — част от рязкостта на нивото (0,5…1); detail — радиусът на дребните детайли (0 — без тях); tex/aa — при зареждането (memfix.js, game.js).
import { feature } from './lab/feature.js';

const LITE = feature('gfx-lite');
export const GFX = {
  vlow: { nm: 'Много ниско', ico: '🟠', shadows: false, shadowSize: 1024, nf: false, traffic: 0.3, peds: 0.3, far: 0.6, pr: () => 1, res: 0.7, detail: 0.5, yard: 0, deco: false, night: false, tex: 256, aa: false, desc: 'за слаб компютър: резолюция 70 %, без сенки и нощни светлини, без украса, дворове и паркирани коли, детайлите само наблизо, по-малко коли и хора, по-малки текстури, без изглаждане' },
  low: { nm: 'Ниско', ico: '🔴', shadows: false, shadowSize: 1024, nf: false, traffic: 0.5, peds: 0.5, far: 0.7, yard: 0.5, pr: () => 1, desc: 'без сенки и светещи етажи нощем, половината коли и хора, дворовете само наблизо, по-близка видимост, рязкост 1×' },
  mid: { nm: 'Средно', ico: '🟡', shadows: true, shadowSize: 2048, nf: true, traffic: 1, peds: 1, far: 1, pr: () => Math.min(devicePixelRatio || 1, 1.5), desc: 'сенки, светещи етажи, целият трафик, рязкост до 1,5×' },
  high: { nm: 'Високо', ico: '🟢', shadows: true, shadowSize: 2048, nf: true, traffic: 1, peds: 1, far: 1.2, pr: () => Math.min(devicePixelRatio || 1, 2), desc: 'всичко, по-далечна видимост, пълна рязкост на екрана (до 2×)' },
};
export const GFX_ORDER = LITE ? ['vlow', 'low', 'mid', 'high'] : ['low', 'mid', 'high'];
if (!LITE) delete GFX.vlow;
for (const k in GFX) { const g = GFX[k] = { res: 1, detail: 1, yard: 1, deco: true, night: true, tex: 512, aa: true, ...GFX[k] }; g.pr0 = g.pr; g.pr = () => g.pr0() * g.res; }   // gfx-lite: стойностите по подразбиране; pr — с резолюцията на нивото
let cur = null, own = null, merged = null;   // own — „⚙️ Подробно“ (gfx-lite)
const RANGE = { far: [0.4, 1.2], traffic: [0.1, 1], res: [0.5, 1], detail: [0, 1], yard: [0, 1] }, BOOL = ['shadows', 'night', 'deco'];   // yard — дворовете и паркираните коли (докъде; 0 — без тях), deco — украсата (сергии, билбордове, знамена, статуи)
function readOwn(v) { if (!LITE || !v || v[0] !== '{') return null; try { const j = JSON.parse(v), o = {}; for (const k in RANGE) if (typeof j.o?.[k] === 'number') o[k] = Math.max(RANGE[k][0], Math.min(RANGE[k][1], j.o[k])); for (const k of BOOL) if (typeof j.o?.[k] === 'boolean') o[k] = j.o[k]; return GFX[j.lv] ? { lv: j.lv, o } : null; } catch { return null; } }
// ui-batch2: запазеният избор не се губи, ако записът е от другия вид (с „⚙️ Подробно“ — без gfx-lite, или „Много ниско“ — без него → Ниско)
const lvOf = v => { if (!feature('ui-batch2') || !v) return null; if (v[0] === '{') { try { v = JSON.parse(v).lv; } catch { return null; } } return GFX[v] ? v : v === 'vlow' && GFX.low ? 'low' : null; };
export const gfxSaved = () => { try { return !!localStorage.getItem('stroi-gfx'); } catch { return false; } };   // ui-batch2: има ли запазен избор на този компютър
export const gfxLevel = () => cur || (cur = (() => { const q = (location.search.match(/[?&]gfx=(vlow|low|mid|high)\b/) || [])[1]; if (q) return q;   /* ?gfx= — за тестовете (не се записва) */ try { const v = localStorage.getItem('stroi-gfx'), j = readOwn(v); if (j) { own = j.o; return j.lv; } return GFX[v] ? v : lvOf(v) || 'mid'; } catch { return 'mid'; } })());
// нивото + своите стойности (gfx-lite: трафикът важи и за хората; рязкостта — част от тази на нивото)
export const gfx = () => { const lv = gfxLevel(); if (!own) return GFX[lv]; if (merged?.lv === lv) return merged; const g = GFX[lv], o = own;
  return merged = { ...g, ...o, lv, peds: o.traffic ?? g.peds, pr: () => g.pr0() * (o.res ?? g.res) }; };
export const gfxOwn = () => own;   // gfx-lite: „⚙️ Подробно“ (null — точно нивото)

// ctx: { renderer, sun, camera, farBase() — далечината на камерата без нивото }
export function setGfx(lv, ctx, keep = true, o) {   // keep — да се запомни (при старта — не); o — gfx-lite „⚙️ Подробно“ (null — точно нивото, undefined — без промяна)
  if (!GFX[lv]) return; cur = lv; if (o !== undefined) { own = LITE && o && Object.keys(o).length ? readOwn(JSON.stringify({ lv, o })).o : null; merged = null; }
  if (keep) try { localStorage.setItem('stroi-gfx', own ? JSON.stringify({ lv, o: own }) : lv); } catch { }
  const g = gfx(), { renderer, sun, camera } = ctx || {};
  if (renderer) { renderer.setPixelRatio(g.pr()); renderer.shadowMap.needsUpdate = true; }
  if (sun) { sun.castShadow = g.shadows; if (sun.shadow.mapSize.x !== g.shadowSize) { sun.shadow.mapSize.set(g.shadowSize, g.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }   // без сенки — шейдърите се превключват сами
  if (camera && ctx.farBase) { camera.far = ctx.farBase() * g.far; camera.updateProjectionMatrix(); }
  window.__gfxNF = g.nf && g.night;   // daynight.js: нощните етажи (nightfloors) — само ако са включени
}
