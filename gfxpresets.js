// gfxpresets.js — 🎨 gfx-presets (f9): графиката Ниско / Средно / Високо (⚙️ Настройки; „Проверка на компютъра“ предлага ниво — perfmeter.js).
// Пази се в localStorage (зависи от компютъра, не от записа); прилага се веднага — без презареждане.
// Средно = досегашното поведение на играта; Ниско — без сенки и нощни етажи, по-малко коли и хора, по-близо видимост, pixel ratio 1;
// Високо — pixel ratio до 2 (остри ръбове на големи/HiDPI екрани) и по-далечна видимост.
export const GFX = {
  low: { nm: 'Ниско', ico: '🔴', shadows: false, shadowSize: 1024, nf: false, traffic: 0.5, peds: 0.5, far: 0.7, pr: () => 1, desc: 'без сенки и светещи етажи нощем, половината коли и хора, по-близка видимост, рязкост 1×' },
  mid: { nm: 'Средно', ico: '🟡', shadows: true, shadowSize: 2048, nf: true, traffic: 1, peds: 1, far: 1, pr: () => Math.min(devicePixelRatio || 1, 1.5), desc: 'сенки, светещи етажи, целият трафик, рязкост до 1,5×' },
  high: { nm: 'Високо', ico: '🟢', shadows: true, shadowSize: 2048, nf: true, traffic: 1, peds: 1, far: 1.2, pr: () => Math.min(devicePixelRatio || 1, 2), desc: 'всичко, по-далечна видимост, пълна рязкост на екрана (до 2×)' },
};
export const GFX_ORDER = ['low', 'mid', 'high'];
let cur = null;
export const gfxLevel = () => cur || (cur = (() => { const q = (location.search.match(/[?&]gfx=(low|mid|high)\b/) || [])[1]; if (q) return q;   /* ?gfx= — за тестовете (не се записва) */ try { const v = localStorage.getItem('stroi-gfx'); return GFX[v] ? v : 'mid'; } catch { return 'mid'; } })());
export const gfx = () => GFX[gfxLevel()];
// ctx: { renderer, sun, camera, farBase() — далечината на камерата без нивото }
export function setGfx(lv, ctx, keep = true) {   // keep — да се запомни (при старта — не)
  if (!GFX[lv]) return; cur = lv; if (keep) try { localStorage.setItem('stroi-gfx', lv); } catch { }
  const g = GFX[lv], { renderer, sun, camera } = ctx || {};
  if (renderer) { renderer.setPixelRatio(g.pr()); renderer.shadowMap.needsUpdate = true; }
  if (sun) { sun.castShadow = g.shadows; if (sun.shadow.mapSize.x !== g.shadowSize) { sun.shadow.mapSize.set(g.shadowSize, g.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } }   // без сенки — шейдърите се превключват сами
  if (camera && ctx.farBase) { camera.far = ctx.farBase() * g.far; camera.updateProjectionMatrix(); }
  window.__gfxNF = g.nf;   // daynight.js: нощните етажи (nightfloors) — само ако са включени
}
