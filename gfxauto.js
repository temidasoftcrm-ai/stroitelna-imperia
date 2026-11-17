// gfxauto.js — 🤖 флаг gfx-auto: „автоматична графика“ (бета тестерите: „зарежда бавно и насича“; MacBook M5 — 4 GB, прегря и спря).
// Без запазен избор играта започва на „Ниско“ без следобработката (gfxpresets.js) и оттук сама сменя нивото по кадрите в секунда:
//   ↓ средно < 25 кадъра/s за 5 s — едно ниво надолу (до най-ниското в GFX_ORDER);
//   ↑ стабилно > 55 кадъра/s за 20 s (и никоя секунда < 45) — едно ниво нагоре, но автоматично не над „Средно“.
// Хистерезис (без трептене): след всяка смяна — 6 s без мерене (шейдъри, сенки); секундите със засичане > 1 s (зареждане на модел,
// нов квартал) не се броят; ниво, от което е свалила, се пробва пак чак след 2 мин, после 4, 8… (след 3 неуспеха — не в тази сесия).
// Ако играчът сам избере ниво (⚙️ Настройки → Графика, „Проверка на компютъра“, предложението при засичане) — автоматиката спира (gfxAutoOn()).
// game.js: const ga = createGfxAuto({ apply, active, say }); ga.tick(rdt) — всеки кадър. За Лабораторията/тестовете: window.__gfxAuto.state().
import { GFX, GFX_ORDER, gfxLevel, gfxAutoOn, gfxAutoMax } from './gfxpresets.js';

const DOWN = 25, DOWN_S = 5, UP = 55, UP_MIN = 45, UP_S = 20, HOLD = 6000, WARM = 15000, BLOCK = 120000, MAX_FAILS = 3;

// apply(lv) — сменя нивото без да го пази като избор на играча; active() — градът се рисува (не картата, не зареждане); say(текст) — кратко съобщение
export function createGfxAuto({ apply, active, say }) {
  let fr = 0, t0 = 0, hitch = false, holdUntil = 0, wasActive = false, last = null, prevT = 0;
  const samples = [], blockUntil = {}, fails = {}, log = [];
  const avg = n => { const L = samples.slice(-n); return L.reduce((a, b) => a + b, 0) / L.length; };
  function change(to, dir, fps, now) {
    const from = gfxLevel();
    if (dir === 'down') {   // нивото, от което слизаме, не върви — пак чак след малко (и все по-късно, ако се повтаря)
      const quick = last && last.dir === 'up' && last.to === from && now - last.at < 90000;
      if (quick) fails[from] = (fails[from] || 0) + 1;
      const n = fails[from] || 0;
      blockUntil[from] = n >= MAX_FAILS ? Infinity : now + BLOCK * 2 ** Math.max(0, n - 1);
    }
    apply(to); samples.length = 0; fr = 0; t0 = 0; holdUntil = now + HOLD;
    last = { dir, from, to, at: now, fps: Math.round(fps) }; log.push(last); if (log.length > 30) log.shift();
    say?.(`🤖 Графика: ${GFX[from].ico} ${GFX[from].nm} → ${GFX[to].ico} ${GFX[to].nm} (≈${Math.round(fps)} кадъра/s). Избери сам от ⚙️ Настройки → Графика.`, dir);
  }
  function tick(rdt) {
    if (!gfxAutoOn()) return;
    const now = performance.now(), on = active() && !document.hidden, gap = prevT && now - prevT > 1000; prevT = now;   // gap — tick не е викан (зала, пауза) — не е бавност
    if (gap) { samples.length = 0; t0 = 0; }
    if (!on) { wasActive = false; samples.length = 0; t0 = 0; return; }
    if (!wasActive) { wasActive = true; holdUntil = Math.max(holdUntil, now + WARM); }   // след зареждане/картата/скрит раздел — първо да се успокои
    if (now < holdUntil) { t0 = 0; return; }
    if (!t0) { t0 = now; fr = 0; hitch = false; return; }
    fr++; if (rdt > 1) hitch = true;
    if (now - t0 < 1000) return;
    const fps = fr * 1000 / (now - t0); t0 = now; fr = 0;
    if (hitch) { hitch = false; return; }   // секунда със засичане (зареждане, край на деня) — не се брои; останалите остават
    samples.push(fps); if (samples.length > UP_S) samples.shift();
    const lv = gfxLevel(), i = GFX_ORDER.indexOf(lv), top = GFX_ORDER.indexOf(gfxAutoMax());
    if (i < 0) return;
    if (i > 0 && samples.length >= DOWN_S && avg(DOWN_S) < DOWN) return change(GFX_ORDER[i - 1], 'down', avg(DOWN_S), now);
    if (i > top) return change(GFX_ORDER[top], 'down', avg(samples.length), now);   // над „Средно“ (не би трябвало) — към тавана
    const nx = GFX_ORDER[i + 1];
    if (i < top && samples.length >= UP_S && avg(UP_S) > UP && Math.min(...samples) > UP_MIN && now >= (blockUntil[nx] || 0)) return change(nx, 'up', avg(UP_S), now);
  }
  const state = () => ({ on: gfxAutoOn(), lv: gfxLevel(), fps: samples.map(Math.round), hold: Math.max(0, Math.round(holdUntil - performance.now())),
    block: Object.fromEntries(Object.entries(blockUntil).map(([k, v]) => [k, v === Infinity ? 'сесията' : Math.max(0, Math.round((v - performance.now()) / 1000)) + ' s'])), log: log.slice() });
  if (typeof window !== 'undefined') window.__gfxAuto = { state };
  return { tick, state };
}
