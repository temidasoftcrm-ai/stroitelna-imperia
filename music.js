// music.js — 🎵 фонова музика (флаг music): 18 песни от Pixabay (assets/music, CREDITS-pixabay.txt) + плъзгачите Музика / Ефекти / Град.
// Подредба: менюто/картата/глобусът → menu-1/2 на смени; в града спокойно → city-1…7 разбъркано (+ sunny-1/2 денем в слънчевите градове);
// активна игра (скорост ×2/×3 или 3+ строежа) → work-1…5 — с хистерезис (20 с вътре, 45 с навън), не на всеки тик; нощ → city + night-1 (пиано), по-тихо.
// Преливане 3 s, кратка пауза между песните. Заглъхва при кино/видео, песента на града (CITY_STING) и рекламата (ads.js спира всички <audio>).
// Тръгва след първия клик (autoplay). Само текущата песен се тегли (preload — при пускане). Скрит таб → пауза.
import { feature, IN_LAB } from './lab/feature.js';

const KEY = 'stroi-mix', DEF = { music: 0.5, fx: 1, city: 1 };
const POOLS = { menu: ['menu-1', 'menu-2', 'menu-3'], city: ['city-1', 'city-2', 'city-3', 'city-4', 'city-5', 'city-6', 'city-7'], work: ['work-1', 'work-2', 'work-3', 'work-4', 'work-5'], sunny: ['sunny-1', 'sunny-2'], night: ['night-1'] };
export const SUNNY = new Set(['rio', 'barcelona', 'naples', 'lasvegas', 'losangeles', 'miami', 'honolulu', 'primorsko', 'sunnybeach', 'antalya', 'bodrum', 'marmaris']);
const FADE = 3, GAP = [2, 5], TICK = 250;
const url = n => `assets/music/${n}.mp3`;

export function loadMix() { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEF }; } }

// deps: mode() 'menu'|'city', active() — скорост ×2/×3 или 3+ строежа, night() 0…1, sunny() bool, duck() bool, muted() bool, sound — Sound (sound.js)
export function createMusic(deps) {
  const off = { state: () => ({ on: false }), set() { }, levels: loadMix, mood() { } };
  if (!feature('music')) return off;
  let mix = loadMix(), started = false, cur = null, mood = null, want = null, wantAt = 0, gapUntil = 0, last = {}, menuI = 0, force = null;
  const applyLevels = () => { try { deps.sound?.setLevels?.(mix.fx, mix.city); } catch { } };
  applyLevels();

  // ── песен: един <audio>, сила = плъзгач × нощ × заглъхване × преливане ──
  function track(name) {
    const a = new Audio(); a.preload = 'auto'; a.src = url(name); a.volume = 0;
    const t = { name, a, fade: 0, dir: 1, ended: false };
    a.onended = () => { t.ended = true; };
    a.onerror = () => { t.ended = true; };
    a.play().catch(() => { });
    return t;
  }
  const kill = t => { if (!t) return; try { t.a.pause(); t.a.removeAttribute('src'); t.a.load(); } catch { } };
  function pick(m) {
    if (m === 'menu') return POOLS.menu[menuI++ % POOLS.menu.length];
    const pool = m === 'work' ? POOLS.work : m === 'sunny' ? [...POOLS.city, ...POOLS.sunny] : m === 'night' ? [...POOLS.night, ...POOLS.city] : POOLS.city;
    const c = pool.filter(n => n !== last[m] && n !== cur?.name);
    const n = (c.length ? c : pool)[(Math.random() * (c.length || pool.length)) | 0]; last[m] = n; return n;
  }
  // настроението сега: menu / work / city / sunny / night (нощ — city + night)
  function moodNow() {
    if (force) return force;
    if (deps.mode() === 'menu') return 'menu';
    const n = deps.night() > 0.6, act = !n && deps.active();
    const now = performance.now();
    if (n) { want = null; return 'night'; }   // нощ — lofi + пиано, веднага
    const base = deps.sunny() ? 'sunny' : 'city';
    const target = act ? 'work' : base;
    // хистерезис: към work — след 20 s активна игра; обратно — след 45 s спокойствие; city ↔ sunny ↔ menu — веднага
    if (target === mood) { want = null; return mood; }   // нищо не чака
    if (mood === 'work' || target === 'work') {
      if (target !== want) { want = target; wantAt = now; }
      const need = target === 'work' ? 20e3 : 45e3;
      return mood && mood !== 'menu' && now - wantAt < need ? mood : target;   // от менюто — веднага
    }
    return target;
  }
  const fits = (n, m) => m === 'sunny' ? POOLS.city.includes(n) || POOLS.sunny.includes(n) : m === 'night' ? POOLS.city.includes(n) || POOLS.night.includes(n) : POOLS[m].includes(n);
  const fading = [];
  const fadeOut = t => { t.dir = -1; fading.push(t); };
  function tick() {
    if (!started) return;
    const now = performance.now(), hidden = document.hidden, duck = deps.duck(), muted = deps.muted() || mix.music <= 0;
    const m = moodNow();
    if (m !== mood) { mood = m; if (cur && !fits(cur.name, m)) { fadeOut(cur); cur = null; gapUntil = 0; } }   // ново настроение → преливане към песен от новия набор
    if (cur && (cur.ended || (cur.a.duration && cur.a.duration - cur.a.currentTime < FADE))) { fadeOut(cur); cur = null; gapUntil = now + (FADE + GAP[0] + Math.random() * (GAP[1] - GAP[0])) * 1000; }   // краят → заглъхва, пауза, следващата
    if (!cur && !hidden && !muted && now >= gapUntil) cur = track(pick(mood));
    const step = TICK / 1000 / FADE, nightK = mood !== 'menu' && deps.night() > 0.6 ? 0.65 : 1;
    for (const t of cur ? [cur, ...fading] : fading) {
      t.fade = Math.max(0, Math.min(1, t.fade + t.dir * step));
      t.a.volume = Math.max(0, Math.min(1, mix.music * nightK * (duck ? 0.08 : 1) * t.fade * 0.6));   // 0.6 — музиката е фон, под ефектите
      if (hidden || muted) { if (!t.a.paused) t.a.pause(); }
      else if (t.a.paused && !t.ended) t.a.play().catch(() => { });   // по време на реклама ads.js задържа play()
    }
    for (let i = fading.length - 1; i >= 0; i--) if (fading[i].fade <= 0 || fading[i].ended) { kill(fading[i]); fading.splice(i, 1); }
  }
  setInterval(tick, TICK);
  const go = () => { if (started) return; started = true; removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); tick(); };
  addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);

  return {
    levels: () => ({ ...mix }),
    set(k, v) { if (!(k in DEF)) return; mix[k] = Math.max(0, Math.min(1, +v || 0)); try { localStorage.setItem(KEY, JSON.stringify(mix)); } catch { } if (k !== 'music') applyLevels(); },
    mood(m) { force = m || null; },
    start: IN_LAB ? () => go() : undefined,   // Лабораторията: без чакане на клик в играта   // Лабораторията: принудително настроение (menu/city/work/sunny), null — нормално
    state: () => ({ on: true, started, mood, track: cur?.name || null, vol: cur ? +cur.a.volume.toFixed(3) : 0, playing: !!cur && !cur.a.paused, src: cur?.a.currentSrc || '', mix: { ...mix } }),
  };
}
