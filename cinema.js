// cinema.js — кратки „кинематографични“ интрота (~6 с) при големи моменти: София (начало), Ню Йорк, Дубай,
// първи самолет, първи петрол, ниво 20, Лас Вегас. Рисувано на <canvas> + музика с WebAudio; Ню Йорк и Вегас са истински клипове (assets/cinema/*.mp4,
// генерирани с Kling AI от автора на играта) — ако видеото не тръгне, остава рисуваната сцена / кадърът с бавно приближаване.
// Пуска се само веднъж (S.cine.seen), с бутон „Пропусни“; после се гледа пак от „🎬 Албум на империята“.
// Настройки (в браузъра): музика, ефекти, намалено движение, автоматично пускане.
// deps: { S(), sound() → Sound (ctx, master, noise, muted, init), ready() → градът е зареден, cityById(id) → { lat, lon, nm },
//         speed() → текуща скорост, setSpeed(n), save(), lv20() → ниво 20 (империя), firstPlane(), firstOil(), auto() → false в тестове }
const LS = 'stroiCine';
const DUR = 6.5;
const SCENES = [
  { key: 'sofia', city: 'sofia', ico: '🇧🇬', nm: 'София — начало', cap: 'София', sub: 'Изгрев над Витоша. Тук започва всичко.', lock: 'Започни игра в София' },
  { key: 'newyork', city: 'newyork', ico: '🗽', nm: 'Ню Йорк', cap: 'Ню Йорк', sub: 'Строй високо. Мисли мащабно.', lock: 'Влез в Ню Йорк', video: 'assets/cinema/newyork.mp4', poster: 'assets/cinema/newyork.jpg' },
  { key: 'vegas', resort: 'vegasstrip', ico: '🎰', nm: 'Лас Вегас', cap: '🎰 Лас Вегас', sub: 'Стрипът светна. Залозите започват.', lock: 'Построй курорта „Лас Вегас Стрип“', video: 'assets/cinema/vegas.mp4', poster: 'assets/cinema/vegas.jpg' },
  { key: 'dubai', city: 'dubai', ico: '🌆', nm: 'Дубай', cap: 'Дубай', sub: 'От пясъка — до небето.', lock: 'Влез в Дубай' },
  { key: 'plane', ico: '🛫', nm: 'Първи самолет', cap: '🛫 Първият ти самолет излита', sub: 'Небето вече е част от империята.', lock: 'Построй първото си летище' },
  { key: 'oil', ico: '🛢️', nm: 'Първи петрол', cap: '🛢️ Ерата на черното злато', sub: 'Сондата заработи. Петролът потече.', lock: 'Пусни първия си петролен кладенец' },
  { key: 'lv20', ico: '🌍', nm: 'Ниво 20 — Империя', cap: '🌍 Ниво 20 — Империя', sub: 'Целият свят е твоето строително поле.', lock: 'Стигни ниво 20' },
];
const CSS = `
#cine { position:fixed; inset:0; z-index:300; background:#000; opacity:0; transition:opacity .45s; overflow:hidden; user-select:none; }
#cine.on { opacity:1; }
#cine canvas, #cine video, #cine img.pv { position:absolute; inset:0; width:100%; height:100%; display:block; object-fit:cover; background:#000; }
#cine .unm { position:absolute; left:calc(14px + env(safe-area-inset-left)); top:calc(7vh + 10px); z-index:4; padding:8px 14px; border-radius:10px; border:1px solid rgba(255,255,255,.35); background:rgba(0,0,0,.45); color:#fff; font-size:14px; font-weight:700; cursor:pointer; display:none; }
#cineAlbum .it img { width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; }
#cine .bar { position:absolute; left:0; right:0; height:7vh; background:#000; z-index:2; }
#cine .bar.t { top:0; } #cine .bar.b { bottom:0; }
#cine .cap { position:absolute; left:0; right:0; bottom:13vh; text-align:center; z-index:3; opacity:0; transform:translateY(14px); transition:opacity .8s, transform .8s; padding:0 16px; pointer-events:none; }
#cine .cap.on { opacity:1; transform:none; }
#cine .cap b { display:block; font-size:clamp(26px,5vw,46px); color:#ffd36a; letter-spacing:.5px; text-shadow:0 2px 18px rgba(0,0,0,.85), 0 0 30px rgba(255,190,60,.35); }
#cine .cap span { display:block; margin-top:6px; font-size:clamp(15px,2.4vw,22px); color:#fff; text-shadow:0 2px 10px rgba(0,0,0,.9); }
#cine .skip { position:absolute; right:calc(14px + env(safe-area-inset-right)); top:calc(7vh + 10px); z-index:4; padding:8px 14px; border-radius:10px; border:1px solid rgba(255,255,255,.35);
  background:rgba(0,0,0,.45); color:#fff; font-size:14px; font-weight:700; cursor:pointer; touch-action:manipulation; }
#cine .snd { position:absolute; left:50%; top:calc(7vh + 12px); transform:translateX(-50%); z-index:4; padding:6px 12px; border-radius:10px; background:rgba(0,0,0,.5); color:#fff; font-size:13px; display:none; }
#cineAlbum { position:fixed; inset:0; z-index:290; background:rgba(5,8,16,.78); display:flex; align-items:center; justify-content:center; padding:16px; }
#cineAlbum .box { background:var(--panel,#1b2130); color:var(--txt,#eee); border:1px solid rgba(255,255,255,.12); border-radius:14px; width:min(640px,100%); max-height:90vh; overflow:auto; padding:16px; }
#cineAlbum h3 { margin:0 0 4px; font-size:20px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
#cineAlbum .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; margin:12px 0; }
#cineAlbum .it { border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; background:rgba(255,255,255,.04); display:flex; flex-direction:column; gap:6px; }
#cineAlbum .it .ico { font-size:30px; } #cineAlbum .it.lk { opacity:.55; }
#cineAlbum .it button { margin-top:auto; }
#cineAlbum .sets { display:flex; flex-wrap:wrap; gap:8px 16px; font-size:14px; border-top:1px solid rgba(255,255,255,.1); padding-top:10px; }
#cineAlbum .sets label { display:flex; align-items:center; gap:6px; cursor:pointer; }
`;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(',')})`; };
const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
let geo = null;
const loadGeo = () => geo || (geo = fetch('assets/globe/countries.json').then(r => r.json()).catch(() => ({ features: [] })));

// ---------- звук: малки инструменти върху Sound.ctx ----------
function makeAudio(So, set) {
  const ctx = So.ctx, out = ctx.createGain(); out.gain.value = 1; out.connect(So.master);
  const mus = ctx.createGain(); mus.gain.value = set.music ? 0.9 : 0; mus.connect(out);
  const sfx = ctx.createGain(); sfx.gain.value = set.sfx ? 1 : 0; sfx.connect(out);
  const rev = ctx.createDelay(); rev.delayTime.value = 0.11; const fb = ctx.createGain(); fb.gain.value = 0.25; const rg = ctx.createGain(); rg.gain.value = 0.22;
  mus.connect(rev); rev.connect(fb); fb.connect(rev); rev.connect(rg); rg.connect(out);
  const T0 = ctx.currentTime + 0.06;
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const A = {
    ctx, mus, sfx, T: t => T0 + t,
    note(bus, t, m, dur, vol, o = {}) {   // тон: o = { type, a, lp, q, vib, det:[…] }
      const tt = T0 + t, g = ctx.createGain(); env(g, tt, o.a || 0.01, vol, dur);
      let dst = g;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; f.connect(g); dst = f; }
      for (const det of o.det || [0]) {
        const os = ctx.createOscillator(); os.type = o.type || 'sine'; os.frequency.value = typeof m === 'number' && m < 200 ? midi(m) : m; os.detune.value = det;
        if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2; lg.gain.value = o.vib; l.connect(lg); lg.connect(os.frequency); l.start(tt); l.stop(tt + dur + o.a + 0.1); }
        if (o.slide) os.frequency.exponentialRampToValueAtTime(o.slide, tt + dur);
        os.connect(dst); os.start(tt); os.stop(tt + (o.a || 0.01) + dur + 0.1);
      }
      g.connect(bus);
    },
    noise(bus, t, dur, vol, o = {}) {   // шум: o = { type, f, f2, q, a }
      if (!So.noise) return;
      const tt = T0 + t, s = ctx.createBufferSource(); s.buffer = So.noise; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, tt); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, tt + dur); f.Q.value = o.q || 1;
      const g = ctx.createGain(); env(g, tt, o.a || 0.005, vol, dur);
      s.connect(f); f.connect(g); g.connect(bus); s.start(tt, Math.random()); s.stop(tt + (o.a || 0.005) + dur + 0.1);
    },
    drum(bus, t, f0, vol, dur = 0.4) { const tt = T0 + t, os = ctx.createOscillator(), g = ctx.createGain(); os.frequency.setValueAtTime(f0 * 2.2, tt); os.frequency.exponentialRampToValueAtTime(f0, tt + 0.06); env(g, tt, 0.004, vol, dur); os.connect(g); g.connect(bus); os.start(tt); os.stop(tt + dur + 0.1); },
    stop() { const n = ctx.currentTime; out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n); out.gain.linearRampToValueAtTime(0, n + 0.35); setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 600); },
  };
  return A;
}

// ---------- музика и ефекти за всяка сцена ----------
const MUSIC = {
  sofia(A) {   // мек кавал над бурдон
    A.note(A.mus, 0, 50, 6.4, 0.05, { a: 1.2 }); A.note(A.mus, 0, 57, 6.4, 0.035, { a: 1.5 });
    const mel = [[62, 0.3, 0.6], [64, 0.9, 0.35], [65, 1.25, 0.35], [67, 1.6, 0.8], [69, 2.4, 0.55], [70, 2.95, 0.3], [69, 3.25, 0.3], [67, 3.55, 0.55], [65, 4.1, 0.35], [64, 4.45, 0.35], [62, 4.8, 1.5]];
    for (const [m, t, d] of mel) { A.note(A.mus, t, m + 12, d, 0.075, { a: 0.06, vib: 4, type: 'sine' }); A.noise(A.mus, t, 0.18, 0.02, { f: 2400, q: 2 }); }
    for (const t of [1.1, 1.3, 2.7, 3.9]) A.note(A.sfx, t, 3200 + Math.random() * 1200, 0.09, 0.025, { slide: 4800 });   // птички
  },
  newyork(A) {   // суинг: walking bass, ride, акорди, тромпет накрая; клаксон и град
    const b = 0.4545;
    A.noise(A.sfx, 0, 6.3, 0.05, { type: 'lowpass', f: 420, a: 0.6 });
    const bass = [38, 41, 45, 48, 43, 47, 50, 53, 36, 40, 43, 47];
    bass.forEach((m, i) => A.note(A.mus, i * b, m, b * 0.9, 0.16, { type: 'triangle', lp: 900 }));
    A.note(A.mus, 12 * b, 36, 1.2, 0.16, { type: 'triangle', lp: 900 });
    for (let bar = 0; bar < 4; bar++) for (const x of [0, 1, 1.667, 2, 3, 3.667]) A.noise(A.mus, (bar * 4 + x) * b, 0.12, x % 1 ? 0.025 : 0.04, { type: 'highpass', f: 7000 });
    const ch = [[65, 69, 72, 76], [65, 69, 71, 76], [64, 67, 71, 74]];
    ch.forEach((c, i) => { for (const x of [0, 1.667]) for (const m of c) A.note(A.mus, (i * 4 + x) * b, m, x ? 0.18 : 0.3, 0.035, { type: 'triangle' }); });
    for (const m of [64, 67, 71, 74, 79]) A.note(A.mus, 12 * b, m, 1.4, 0.035, { type: 'triangle' });
    [[76, 0, 0.2], [79, 0.25, 0.2], [81, 0.5, 0.25], [84, 0.8, 1.0]].forEach(([m, t, d]) => A.note(A.mus, 12 * b + t, m, d, 0.055, { type: 'sawtooth', lp: 1700, q: 3, vib: 5, a: 0.03 }));
    for (const t of [2.0, 2.42]) for (const f of [349, 440]) A.note(A.sfx, t, f, 0.3, 0.03, { type: 'square', lp: 1600 });
  },
  dubai(A) {   // дарбука (максум), уд в хиджаз, оркестров акцент
    const st = 0.17;
    for (let bar = 0; bar < 4; bar++) for (const [i, k] of [[0, 'D'], [1, 'T'], [3, 'T'], [4, 'D'], [6, 'T']]) {
      const t = (bar * 8 + i) * st; if (k === 'D') A.drum(A.mus, t, 80, 0.32, 0.4); else A.noise(A.mus, t, 0.07, 0.14, { f: 3200, q: 2 });
    }
    const oud = [62, 63, 66, 67, 69, 67, 66, 63, 62, 63, 66, 69, 70, 69];
    oud.forEach((m, i) => { A.note(A.mus, 0.7 + i * 0.27, m, 0.32, 0.05, { type: 'sawtooth', lp: 2200 }); A.note(A.mus, 0.7 + i * 0.27, m + 12, 0.2, 0.02); });
    for (const m of [50, 57, 62, 65, 69]) A.note(A.mus, 4.6, m, 1.6, 0.045, { type: 'sawtooth', lp: 1400, a: 0.04, det: [-7, 7] });
    A.drum(A.mus, 4.6, 55, 0.5, 0.9);
    A.noise(A.sfx, 0, 3.2, 0.05, { f: 700, f2: 1400, q: 0.8, a: 0.8 });   // вятър с пясък
  },
  plane(A) {   // двигателите се развъртат, рев при излитане, топъл акорд
    const ctx = A.ctx, t0 = A.T(0);
    const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(180, t0); os.frequency.exponentialRampToValueAtTime(1100, t0 + 3.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 1.5); g.gain.setValueAtTime(0.03, t0 + 3.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 6.2);
    os.connect(lp); lp.connect(g); g.connect(A.sfx); os.start(t0); os.stop(t0 + 6.4);
    A.noise(A.sfx, 0.6, 2.8, 0.16, { type: 'lowpass', f: 250, f2: 1600, a: 2.4 });
    A.noise(A.sfx, 3.4, 2.6, 0.12, { type: 'lowpass', f: 1600, f2: 300, a: 0.05 });
    [[48, 55, 64], [53, 60, 65], [55, 62, 67], [60, 64, 67, 72]].forEach((c, i) => { for (const m of c) A.note(A.mus, i * 1.55, m, i === 3 ? 2.2 : 1.5, 0.028, { type: 'sawtooth', lp: 1100, a: 0.4, det: [-6, 6] }); });
  },
  oil(A) {   // помпата чука, тръбите се пълнят, меден акорд
    for (let t = 0.1; t < 4.6; t += 1.1) { A.drum(A.sfx, t, 58, 0.28, 0.35); A.noise(A.sfx, t + 0.55, 0.08, 0.06, { f: 1500, q: 3 }); }
    A.note(A.mus, 0, 36, 4.5, 0.06, { type: 'sawtooth', lp: 380, a: 1.5 });
    for (let i = 0; i < 8; i++) A.drum(A.mus, 3.0 + i * 0.2 * (1 - i * 0.06), 110 + i * 8, 0.12 + i * 0.03, 0.25);
    A.noise(A.sfx, 3.6, 1.2, 0.08, { type: 'lowpass', f: 300, f2: 1200, a: 0.3 });   // пламък
    for (const m of [51, 58, 63, 67, 70]) A.note(A.mus, 4.6, m, 1.7, 0.045, { type: 'sawtooth', lp: 1500, a: 0.03, det: [-6, 6] });
    A.noise(A.mus, 4.6, 1.6, 0.06, { type: 'highpass', f: 5000 });
    A.drum(A.mus, 4.6, 50, 0.5, 1.0);
  },
  lv20(A) {   // оркестров крешендо и фанфара
    for (const m of [36, 43, 48, 52, 55, 62]) A.note(A.mus, 0, m, 4.2, 0.03, { type: 'sawtooth', lp: 900, a: 3.6, det: [-5, 5] });
    for (let i = 0; i < 14; i++) A.drum(A.mus, 3.1 + i * 0.1, 62, 0.08 + i * 0.02, 0.2);
    A.noise(A.mus, 3.4, 1.1, 0.05, { type: 'highpass', f: 4000, a: 1.0 });
    [[67, 0, 0.25], [72, 0.3, 0.25], [76, 0.6, 0.25], [79, 0.9, 1.5]].forEach(([m, t, d]) => A.note(A.mus, 4.5 + t, m, d, 0.06, { type: 'sawtooth', lp: 2200, a: 0.03, vib: 3, det: [-5, 5] }));
    for (const m of [48, 55, 60, 64, 67]) A.note(A.mus, 5.4, m, 1.2, 0.035, { type: 'sawtooth', lp: 1600, a: 0.05 });
    A.drum(A.mus, 4.5, 48, 0.55, 1.1); A.noise(A.mus, 4.5, 1.6, 0.07, { type: 'highpass', f: 5000 });
  },
};

// ---------- картини ----------
function skyGrad(c, H, stops) { const g = c.createLinearGradient(0, 0, 0, H); for (const [k, col] of stops) g.addColorStop(k, col); return g; }
function windows(r, w, h, density = 0.45) { const out = [], cols = Math.max(2, Math.round(w * 90)), rows = Math.max(3, Math.round(h * 60)); for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (r() < density) out.push([(i + 0.3) / cols, (j + 0.3) / rows, 0.4 / cols, 0.4 / rows]); return out; }

const DRAW = {
  sofia: {
    setup(r) {
      const mtn = []; for (let i = 0; i <= 40; i++) { const x = i / 40; mtn.push([x, 0.66 - 0.15 * Math.exp(-Math.pow((x - 0.45) / 0.2, 2)) - 0.04 * Math.exp(-Math.pow((x - 0.8) / 0.15, 2)) + 0.012 * Math.sin(i * 1.7) * r()]); }
      const blds = []; for (let x = 0; x < 1.05;) { const w = 0.015 + r() * 0.03; blds.push({ x, w, h: 0.02 + r() * 0.05, win: windows(r, w, 0.06, 0.3) }); x += w + 0.002; }
      const birds = Array.from({ length: 6 }, () => ({ x: r() * 0.5, y: 0.2 + r() * 0.2, s: 0.6 + r() * 0.6 }));
      return { mtn, blds, birds };
    },
    draw(c, t, W, H, s) {
      const p = t / DUR, base = H * 0.8;
      c.save(); c.translate(W / 2, H * 0.6); c.scale(1 + 0.06 * ease(p), 1 + 0.06 * ease(p)); c.translate(-W / 2, -H * 0.6);
      c.fillStyle = skyGrad(c, H, [[0, mix('#0b1630', '#3b6db0', p)], [0.55, mix('#2e2448', '#f2a066', p)], [0.75, mix('#5a3040', '#ffd8a0', p)]]); c.fillRect(-W, -H, W * 3, H * 3);
      const sx = W * 0.6, sy = lerp(H * 0.82, H * 0.46, ease(p * 1.1));
      const gl = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.45); gl.addColorStop(0, `rgba(255,220,140,${0.65 * p + 0.1})`); gl.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = gl; c.fillRect(-W, -H, W * 3, H * 3);
      c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(sx, sy, H * 0.045, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-W * 0.1, base); for (const [x, y] of s.mtn) c.lineTo(x * W * 1.2 - W * 0.1, y * H); c.lineTo(W * 1.1, base); c.closePath();
      c.fillStyle = mix('#141a33', '#5a4f7a', p); c.fill(); c.strokeStyle = `rgba(255,200,130,${0.5 * p})`; c.lineWidth = 2; c.stroke();
      c.fillStyle = `rgba(255,220,180,${0.12 * p})`; c.fillRect(-W, H * 0.6, W * 3, H * 0.2);   // утринна мараня
      for (const b of s.blds) {
        const x = b.x * W, w = b.w * W, h = b.h * H; c.fillStyle = mix('#0b0e1a', '#3a3848', p); c.fillRect(x, base - h, w, h);
        c.fillStyle = `rgba(255,214,120,${0.85 * (1 - p)})`; for (const [u, v, a, bb] of b.win) c.fillRect(x + u * w, base - h + v * h, a * w + 1, bb * h + 1);
      }
      // „Св. Александър Невски“
      const cx = W * 0.3, cw = W * 0.07, ch = H * 0.05, gold = mix('#3a2a10', '#e8b33a', p);
      c.fillStyle = mix('#0b0e1a', '#4a4656', p); c.fillRect(cx - cw / 2, base - ch, cw, ch);
      c.fillStyle = gold; c.beginPath(); c.arc(cx, base - ch, cw * 0.28, Math.PI, 0); c.fill();
      for (const d of [-0.33, 0.33]) { c.beginPath(); c.arc(cx + d * cw, base - ch, cw * 0.13, Math.PI, 0); c.fill(); }
      c.fillRect(cx - 1, base - ch - cw * 0.28 - H * 0.025, 2, H * 0.025); c.fillRect(cx - 4, base - ch - cw * 0.28 - H * 0.018, 8, 2);
      c.fillStyle = mix('#121410', '#55513a', p); c.fillRect(-W, base, W * 3, H);
      // строителната площадка: оградата, сградата расте, кранът се върти
      const fx = W * 0.66, fw = W * 0.18, floors = Math.floor(clamp((t - 2.3) / 3) * 6);
      c.fillStyle = mix('#2a1c10', '#8a5a30', p); c.fillRect(fx, base, fw, H * 0.02);
      c.strokeStyle = mix('#222', '#9aa0a8', p); c.lineWidth = 3;
      for (let f = 0; f < floors; f++) { const y = base - (f + 1) * H * 0.028; c.beginPath(); c.moveTo(fx + fw * 0.15, y); c.lineTo(fx + fw * 0.85, y); c.stroke(); for (const u of [0.15, 0.5, 0.85]) { c.beginPath(); c.moveTo(fx + fw * u, y); c.lineTo(fx + fw * u, y + H * 0.028); c.stroke(); } }
      const yc = mix('#2b2410', '#f2b51e', p), mx = W * 0.86, top = H * 0.4, sw = Math.cos(0.35 * Math.sin(t * 0.7));
      c.strokeStyle = yc; c.lineWidth = 4; c.beginPath(); c.moveTo(mx, base); c.lineTo(mx, top); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(mx - W * 0.2 * sw, top); c.lineTo(mx + W * 0.06 * sw, top); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.moveTo(mx, top - H * 0.04); c.lineTo(mx - W * 0.2 * sw, top); c.moveTo(mx, top - H * 0.04); c.lineTo(mx + W * 0.06 * sw, top); c.stroke();
      const hx = mx - W * 0.13 * sw, hy = top + H * (0.12 + 0.05 * Math.sin(t)); c.beginPath(); c.moveTo(hx, top); c.lineTo(hx, hy); c.stroke(); c.fillStyle = yc; c.fillRect(hx - 5, hy, 10, 6);
      c.strokeStyle = mix('#05070d', '#2a2430', p); c.lineWidth = 2;
      for (const b of s.birds) { const x = (b.x + t * 0.05 * b.s) * W, y = b.y * H + Math.sin(t * 3 + b.x * 9) * 4, k = 7 * b.s, f = Math.sin(t * 9 + b.x * 20) * 3; c.beginPath(); c.moveTo(x - k, y - f); c.lineTo(x, y); c.lineTo(x + k, y - f); c.stroke(); }
      c.restore();
    },
  },
  newyork: {
    setup(r) {
      const layers = [4.2, 3.2, 2.4, 1.7].map((z, li) => {
        const b = []; for (let x = -1.6; x < 1.6;) { const w = 0.08 + r() * 0.1, h = (0.3 + r() * 0.7) * (li === 3 ? 0.7 : 1); b.push({ x, w, h, win: windows(r, w, h * 0.5, 0.4), tone: r() }); x += w + 0.01 + r() * 0.03; }
        if (li === 1) b.push({ x: 0.02, w: 0.14, h: 1.25, esb: true, win: windows(r, 0.14, 0.6, 0.5), tone: 0.3 });
        return { z, b };
      });
      const stars = Array.from({ length: 70 }, () => [r(), r() * 0.45, r()]);
      const taxis = Array.from({ length: 7 }, (_, i) => ({ x: r() * 1.4, v: 0.12 + r() * 0.1, lane: i % 2 }));
      return { layers, stars, taxis };
    },
    draw(c, t, W, H, s) {
      const p = t / DUR, hy = H * 0.66, cam = ease(p) * 1.3;
      c.fillStyle = skyGrad(c, H, [[0, '#120c2c'], [0.45, '#4a2660'], [0.66, '#e07848']]); c.fillRect(0, 0, W, H);
      for (const [x, y, k] of s.stars) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 2 + k * 9))})`; c.fillRect(x * W, y * H, 1.5, 1.5); }
      for (const L of s.layers) {
        const d = L.z - cam; if (d < 0.35) continue;
        const sc = 1 / d, fog = clamp((d - 1) / 3.5);
        for (const b of L.b) {
          const bw = b.w * W * 0.5 * sc, bx = W / 2 + b.x * W * 0.5 * sc, bh = b.h * H * 0.42 * sc, by = hy + H * 0.06 * sc;
          if (bx > W || bx + bw < 0) continue;
          c.fillStyle = mix(b.tone > 0.5 ? '#1a1830' : '#221a2c', '#6a4a70', fog * 0.8);
          if (b.esb) {   // Емпайър Стейт: стъпала и шпил
            c.fillRect(bx, by - bh * 0.62, bw, bh * 0.62); c.fillRect(bx + bw * 0.15, by - bh * 0.8, bw * 0.7, bh * 0.2); c.fillRect(bx + bw * 0.3, by - bh * 0.92, bw * 0.4, bh * 0.12);
            c.fillRect(bx + bw * 0.44, by - bh, bw * 0.12, bh * 0.08); c.fillRect(bx + bw * 0.48, by - bh * 1.1, bw * 0.04, bh * 0.1);
            c.fillStyle = `rgba(255,120,200,${0.6 + 0.3 * Math.sin(t * 3)})`; c.fillRect(bx + bw * 0.3, by - bh * 0.92, bw * 0.4, bh * 0.03);
          } else c.fillRect(bx, by - bh, bw, bh);
          c.fillStyle = `rgba(255,${200 + Math.round(b.tone * 40)},120,${0.85 * (1 - fog * 0.7)})`;
          const wh = b.esb ? bh * 0.62 : bh;
          for (const [u, v, a, bb] of b.win) c.fillRect(bx + u * bw, by - wh + v * wh, Math.max(1, a * bw), Math.max(1, bb * wh));
        }
      }
      c.fillStyle = '#0d0d14'; c.fillRect(0, H * 0.84, W, H * 0.16);
      c.fillStyle = 'rgba(255,255,255,.35)'; for (let x = -((t * 300) % 80); x < W; x += 80) c.fillRect(x, H * 0.915, 40, 3);
      for (const q of s.taxis) {
        const x = ((q.x + t * q.v * (q.lane ? -1 : 1)) % 1.4 + 1.4) % 1.4 * W - W * 0.2, y = H * (q.lane ? 0.875 : 0.935), w = Math.max(40, W * 0.06), h = w * 0.32;
        c.fillStyle = '#f7c21a'; c.fillRect(x, y - h, w, h * 0.65); c.fillRect(x + w * 0.22, y - h * 1.35, w * 0.52, h * 0.45);
        c.fillStyle = '#29303a'; c.fillRect(x + w * 0.28, y - h * 1.28, w * 0.18, h * 0.32); c.fillRect(x + w * 0.5, y - h * 1.28, w * 0.18, h * 0.32);
        c.fillStyle = '#111'; c.beginPath(); c.arc(x + w * 0.22, y - h * 0.3, h * 0.25, 0, 7); c.arc(x + w * 0.78, y - h * 0.3, h * 0.25, 0, 7); c.fill();
        c.fillStyle = q.lane ? '#ff4a3a' : '#fff6c0'; c.fillRect(q.lane ? x - 2 : x + w - 3, y - h * 0.85, 5, h * 0.22);
      }
    },
  },
  dubai: {
    setup(r) {
      const towers = []; for (let i = 0; i < 16; i++) { const x = 0.06 + i / 16 * 0.9 + (r() - 0.5) * 0.03; towers.push({ x, w: 0.022 + r() * 0.025, h: 0.18 + r() * 0.22, d: r() * 1.2, k: r() < 0.3 ? 'twist' : '' }); }
      towers.push({ x: 0.5, w: 0.05, h: 0.62, d: 1.5, k: 'burj' }, { x: 0.86, w: 0.05, h: 0.3, d: 1.0, k: 'sail' });
      towers.sort((a, b) => a.h - b.h);
      const dust = Array.from({ length: 90 }, () => [r(), 0.55 + r() * 0.4, 0.5 + r()]);
      return { towers, dust };
    },
    draw(c, t, W, H, s) {
      const p = t / DUR, base = H * 0.76;
      c.fillStyle = skyGrad(c, H, [[0, mix('#3d8fd6', '#24346e', p)], [0.7, mix('#f6dca8', '#ff9a58', p)]]); c.fillRect(0, 0, W, H);
      const sx = W * 0.78, sy = lerp(H * 0.25, H * 0.6, p); const gl = c.createRadialGradient(sx, sy, 0, sx, sy, H * 0.3); gl.addColorStop(0, 'rgba(255,240,200,.85)'); gl.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
      const dune = (yb, A1, f, ph, col) => { c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, yb + A1 * Math.sin(x / W * f + ph) + A1 * 0.4 * Math.sin(x / W * f * 2.3 + ph * 1.7)); c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill(); };
      dune(H * 0.74, H * 0.025, 5, t * 0.15, mix('#e2b06a', '#b9774a', p));
      for (const T of s.towers) {
        const g = ease((t - 1.0 - T.d) / 1.8); if (g <= 0) continue;
        const x = T.x * W, w = T.w * W, h = T.h * H * g;
        const gr = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, mix('#7cc4e4', '#4a5a8a', p)); gr.addColorStop(0.5, mix('#1d4f7a', '#1a2448', p)); gr.addColorStop(1, mix('#a8e0f4', '#ffb27a', p)); c.fillStyle = gr;
        if (T.k === 'burj') {
          const seg = [[1, 0.35], [0.75, 0.6], [0.5, 0.8], [0.3, 0.92]];
          let y0 = base; for (const [ww, hh] of seg) { const y1 = base - h * hh; c.fillRect(x - w * ww / 2, y1, w * ww, y0 - y1); y0 = y1; }
          c.fillRect(x - w * 0.06, base - h, w * 0.12, h * 0.08);
          if (g > 0.98) { c.fillStyle = `rgba(255,80,60,${0.5 + 0.5 * Math.sin(t * 6)})`; c.beginPath(); c.arc(x, base - h, 3, 0, 7); c.fill(); }
        } else if (T.k === 'sail') {
          c.beginPath(); c.moveTo(x - w / 2, base); c.lineTo(x - w / 2, base - h); c.quadraticCurveTo(x + w * 0.9, base - h * 0.6, x + w / 2, base); c.closePath(); c.fill();
        } else if (T.k === 'twist') {
          c.beginPath(); c.moveTo(x - w / 2, base); for (let k = 0; k <= 10; k++) c.lineTo(x - w / 2 + Math.sin(k * 0.6) * w * 0.15, base - h * k / 10); for (let k = 10; k >= 0; k--) c.lineTo(x + w / 2 + Math.sin(k * 0.6) * w * 0.15, base - h * k / 10); c.closePath(); c.fill();
        } else c.fillRect(x - w / 2, base - h, w, h);
        c.fillStyle = `rgba(255,255,255,${0.12 + 0.1 * (1 - p)})`; for (let y = base - h; y < base; y += 6) c.fillRect(x - w / 2, y, w, 1);
        if (p > 0.7) { c.fillStyle = `rgba(255,220,140,${(p - 0.7) * 2})`; for (let y = base - h + 4; y < base - 4; y += 9) c.fillRect(x - w * 0.3, y, w * 0.6, 2); }
        if (g < 1) { c.fillStyle = `rgba(226,176,106,${0.7 * (1 - g)})`; c.beginPath(); c.ellipse(x, base, w * 1.2, h * 0.1 + 4, 0, Math.PI, 0); c.fill(); }   // пясъкът се отръсква
      }
      dune(H * 0.8, H * 0.02, 7, 1 + t * 0.1, mix('#d89a50', '#a8653c', p));
      dune(H * 0.88, H * 0.03, 4, 2 + t * 0.2, mix('#c7853c', '#8a4e2e', p));
      for (const [x, y, v] of s.dust) { const xx = ((x + t * 0.08 * v) % 1) * W, yy = y * H + Math.sin(t * 3 + x * 30) * 6; c.fillStyle = `rgba(240,200,140,${0.35 * (1 - p * 0.6)})`; c.fillRect(xx, yy, 2, 1.5); }
    },
  },
  plane: {
    setup(r) { return { clouds: Array.from({ length: 9 }, () => [r() * 1.5, 0.08 + r() * 0.35, 0.08 + r() * 0.12]), lights: Array.from({ length: 30 }, (_, i) => i / 30) }; },
    draw(c, t, W, H, s, D) {
      const p = t / DUR, gy = H * 0.72, lift = 3.3, run = t < 1.3 ? 0 : 0.9 * Math.pow(t - 1.3, 2);
      c.fillStyle = skyGrad(c, H, [[0, '#1e2a5a'], [0.5, '#7a5a8a'], [0.72, '#ffa868']]); c.fillRect(0, 0, W, H);
      for (const [x, y, w] of s.clouds) { const xx = ((x - run * 0.04 - t * 0.01) % 1.5 + 1.5) % 1.5 * W - W * 0.2; c.fillStyle = 'rgba(255,220,210,.35)'; c.beginPath(); c.ellipse(xx, y * H, w * W, w * W * 0.22, 0, 0, 7); c.fill(); }
      c.fillStyle = '#20281e'; c.fillRect(0, gy, W, H - gy);
      c.fillStyle = '#3a3c42'; c.fillRect(0, gy + H * 0.04, W, H * 0.07);
      c.fillStyle = '#e8e8e8'; for (let x = -((run * W * 0.25) % 90); x < W; x += 90) c.fillRect(x, gy + H * 0.073, 45, 3);
      for (const k of s.lights) { const x = ((k * W - run * W * 0.25) % W + W) % W; c.fillStyle = Math.sin(t * 8 + k * 40) > 0 ? '#ffe9a0' : '#ffb84a'; c.fillRect(x, gy + H * 0.035, 3, 3); c.fillStyle = '#5ac8ff'; c.fillRect(x, gy + H * 0.112, 3, 3); }
      // самолетът
      const air = Math.max(0, t - lift), L = Math.min(W * 0.36, 520) * (1 - clamp(air / 3) * 0.55);
      const px = W * 0.36 + air * air * W * 0.06, py = gy + H * 0.04 - air * air * H * 0.07, pitch = -clamp(air * 0.6) * 0.18;
      c.save(); c.translate(px, py); c.rotate(pitch);
      const h = L * 0.11;
      if (t < lift + 0.4) { c.fillStyle = '#111'; for (const u of [0.18, 0.62]) { c.beginPath(); c.arc(-L * 0.5 + L * u, -h * 0.05, h * 0.18, 0, 7); c.fill(); } }
      c.fillStyle = '#e9edf2'; c.beginPath(); c.moveTo(-L * 0.5, -h * 0.6); c.lineTo(L * 0.38, -h * 0.6); c.quadraticCurveTo(L * 0.52, -h * 0.55, L * 0.52, -h * 0.3); c.quadraticCurveTo(L * 0.5, -h * 0.05, L * 0.38, -h * 0.05); c.lineTo(-L * 0.4, -h * 0.05); c.lineTo(-L * 0.5, -h * 0.4); c.closePath(); c.fill();
      c.fillStyle = '#ffb400'; c.fillRect(-L * 0.42, -h * 0.28, L * 0.82, h * 0.06);
      c.fillStyle = '#2a3a55'; for (let k = 0; k < 18; k++) c.fillRect(-L * 0.3 + k * L * 0.035, -h * 0.47, L * 0.012, h * 0.1);
      c.fillStyle = '#1b2a44'; c.beginPath(); c.moveTo(L * 0.42, -h * 0.5); c.lineTo(L * 0.48, -h * 0.5); c.lineTo(L * 0.47, -h * 0.4); c.lineTo(L * 0.42, -h * 0.4); c.fill();
      c.fillStyle = '#d7dce4'; c.beginPath(); c.moveTo(-L * 0.42, -h * 0.6); c.lineTo(-L * 0.5, -h * 1.5); c.lineTo(-L * 0.42, -h * 1.5); c.lineTo(-L * 0.3, -h * 0.6); c.fill();
      c.fillStyle = '#ffb400'; c.beginPath(); c.moveTo(-L * 0.45, -h * 1.0); c.lineTo(-L * 0.49, -h * 1.45); c.lineTo(-L * 0.43, -h * 1.45); c.lineTo(-L * 0.38, -h * 1.0); c.fill();
      c.fillStyle = '#b9c0cc'; c.beginPath(); c.moveTo(-L * 0.05, -h * 0.25); c.lineTo(L * 0.12, -h * 0.25); c.lineTo(-L * 0.12, h * 0.25); c.lineTo(-L * 0.2, h * 0.25); c.fill();
      c.fillStyle = '#8a929e'; c.beginPath(); c.ellipse(L * 0.02, -h * 0.02, L * 0.07, h * 0.16, 0, 0, 7); c.fill();
      if (t > 0.6 && t < lift + 1.5) { c.fillStyle = `rgba(255,170,90,${0.25 * clamp((t - 0.6) / 1.5)})`; c.beginPath(); c.ellipse(-L * 0.08, -h * 0.02, L * 0.06 + Math.sin(t * 40) * 2, h * 0.1, 0, 0, 7); c.fill(); }
      c.fillStyle = Math.sin(t * 10) > 0.6 ? '#fff' : 'rgba(255,255,255,.1)'; c.beginPath(); c.arc(-L * 0.49, -h * 1.48, 3, 0, 7); c.fill();
      c.fillStyle = '#ff3a3a'; c.beginPath(); c.arc(-L * 0.1, h * 0.24, 2.5, 0, 7); c.fill();
      c.restore();
      // преход към картата
      const m = clamp((t - 5.0) / 1.0); if (m > 0) {
        c.fillStyle = `rgba(12,30,54,${m * 0.9})`; c.fillRect(0, 0, W, H);
        c.strokeStyle = `rgba(255,200,80,${m})`; c.setLineDash([8, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.2, H * 0.62); c.quadraticCurveTo(W * 0.5, H * 0.18, W * 0.8, H * 0.5); c.stroke(); c.setLineDash([]);
        for (const [x, y] of [[0.2, 0.62], [0.8, 0.5]]) { c.fillStyle = `rgba(255,210,90,${m})`; c.beginPath(); c.arc(x * W, y * H, 7, 0, 7); c.fill(); }
      }
    },
  },
  oil: {
    setup(r) { return { sparks: Array.from({ length: 60 }, () => [r(), r(), 0.5 + r()]) }; },
    draw(c, t, W, H, s) {
      const p = t / DUR, base = H * 0.74;
      c.fillStyle = skyGrad(c, H, [[0, '#3a1a3a'], [0.45, '#c2453a'], [0.74, '#ffb04a']]); c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,230,160,.9)'; c.beginPath(); c.arc(W * 0.62, base - H * 0.02, H * 0.12, Math.PI, 0); c.fill();
      c.fillStyle = '#2a170e'; c.fillRect(0, base, W, H - base);
      // помпата („магарето“)
      const jx = W * 0.27, ax = jx, ay = base - H * 0.24, a = 0.24 * Math.sin(t * Math.PI * 2 / 1.1), bl = W * 0.13;
      const sil = '#120a07'; c.strokeStyle = sil; c.fillStyle = sil; c.lineWidth = 6;
      c.beginPath(); c.moveTo(ax - W * 0.04, base); c.lineTo(ax, ay); c.lineTo(ax + W * 0.04, base); c.stroke();
      const hx = ax - Math.cos(a) * bl, hy = ay - Math.sin(a) * bl, tx = ax + Math.cos(a) * bl * 0.8, ty = ay + Math.sin(a) * bl * 0.8;
      c.lineWidth = 9; c.beginPath(); c.moveTo(hx, hy); c.lineTo(tx, ty); c.stroke();
      c.beginPath(); c.arc(hx, hy + H * 0.02, H * 0.045, Math.PI * 0.6 + a, Math.PI * 1.5 + a); c.lineWidth = 12; c.stroke();
      c.lineWidth = 3; const rx = hx - H * 0.04; c.beginPath(); c.moveTo(rx, hy + H * 0.03); c.lineTo(rx, base); c.stroke();
      const cx = ax + bl * 0.8, cy = base - H * 0.07, ca = t * Math.PI * 2 / 1.1;
      c.lineWidth = 4; c.beginPath(); c.moveTo(tx, ty); c.lineTo(cx + Math.cos(ca) * H * 0.04, cy + Math.sin(ca) * H * 0.04); c.stroke();
      c.beginPath(); c.arc(cx, cy, H * 0.05, ca, ca + 2.2); c.lineTo(cx, cy); c.fill();
      c.fillRect(ax - W * 0.06, base - 6, W * 0.2, 6);
      // тръбата се пълни
      const py = base - H * 0.07, x0 = rx, x1 = W * 0.78, f = ease((t - 1.0) / 2.8), ph = H * 0.022;
      c.fillStyle = '#5a5e66'; for (let x = x0 + 40; x < x1; x += 70) c.fillRect(x, py + ph, 4, base - py - ph);
      c.fillStyle = '#b8bec8'; c.fillRect(x0 - 5, py, 10, base - py); c.fillRect(x0, py, x1 - x0, ph); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x0, py + 1, x1 - x0, 2);
      c.fillStyle = '#0a0806'; c.fillRect(x0 + 2, py + 3, (x1 - x0 - 4) * f, ph - 6);
      for (let k = 0; k < 6; k++) { const u = ((t * 0.5 + k / 6) % 1) * f; c.fillStyle = 'rgba(255,200,80,.8)'; c.fillRect(x0 + (x1 - x0) * u, py + 4, 12, 2); }
      // резервоарът
      const tw = W * 0.12, th = H * 0.15, tx2 = x1, ty2 = base - th, lv = ease((t - 3.5) / 1.5);
      c.fillStyle = '#c9ccd2'; c.fillRect(tx2, ty2, tw, th); c.beginPath(); c.ellipse(tx2 + tw / 2, ty2, tw / 2, th * 0.12, 0, 0, 7); c.fill();
      c.fillStyle = '#0a0806'; c.fillRect(tx2 + 4, ty2 + th * (1 - lv * 0.9), tw - 8, th * lv * 0.9 - 2);
      c.fillStyle = '#ffb400'; c.font = `bold ${Math.round(th * 0.22)}px sans-serif`; c.textAlign = 'center'; c.fillText('OIL', tx2 + tw / 2, ty2 + th * 0.35);
      // факелът
      const fx = W * 0.94; c.fillStyle = '#3a3a40'; c.fillRect(fx - 3, base - H * 0.3, 6, H * 0.3);
      if (t > 3.5) { const fl = 1 + 0.25 * Math.sin(t * 23) + 0.15 * Math.sin(t * 37); c.fillStyle = 'rgba(255,140,40,.9)'; c.beginPath(); c.ellipse(fx, base - H * 0.33 * 1, 8 * fl, 20 * fl, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,240,150,.9)'; c.beginPath(); c.ellipse(fx, base - H * 0.32, 4, 10 * fl, 0, 0, 7); c.fill(); }
      // златни искри — „черното злато“
      const g = clamp((t - 4.3) / 1.2); if (g > 0) for (const [x, y, v] of s.sparks) { const yy = H * (0.9 - ((y + (t - 4.3) * 0.25 * v) % 1) * 0.8); c.fillStyle = `rgba(255,${190 + Math.round(v * 40)},70,${g * (0.4 + 0.5 * Math.sin(t * 6 + x * 50))})`; c.fillRect(x * W, yy, 3, 3); }
    },
  },
  lv20: {
    setup(r, data) {
      const grid = Array.from({ length: 900 }, () => { const a = r() * 7, d = Math.pow(r(), 0.6); return [Math.cos(a) * d, Math.sin(a) * d * 0.8, r()]; });
      const stars = Array.from({ length: 160 }, () => [r(), r(), r()]);
      return { grid, stars, ...data };
    },
    draw(c, t, W, H, s) {
      c.fillStyle = '#02040b'; c.fillRect(0, 0, W, H);
      for (const [x, y, k] of s.stars) { c.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * k})`; c.fillRect(x * W, y * H, 1.3, 1.3); }
      const cx = W / 2, cy = H * 0.5;
      const zk = clamp(t / 2.4), cityA = 1 - clamp((t - 1.7) / 0.8);
      if (cityA > 0) { const k = Math.exp(lerp(Math.log(3.2), Math.log(0.02), ease(zk))) * H; for (const [x, y, v] of s.grid) { c.fillStyle = `rgba(255,${190 + Math.round(v * 50)},110,${cityA * (0.5 + 0.5 * v)})`; c.fillRect(cx + x * k, cy + y * k, 2, 2); } }
      const ga = clamp((t - 1.5) / 1.0); if (ga <= 0) return;
      const R = H * 0.36 * lerp(0.08, 1, ease((t - 1.5) / 1.7)), lon0 = s.hq[1] - (t - 1.5) * 9, lat0 = clamp(s.hq[0] * 0.6, -25, 35);
      const D = Math.PI / 180, sl0 = Math.sin(lat0 * D), cl0 = Math.cos(lat0 * D);
      const pr = (lat, lon) => { const la = lat * D, dl = (lon - lon0) * D, cl = Math.cos(la); return [cx + R * cl * Math.sin(dl), cy - R * (cl0 * Math.sin(la) - sl0 * cl * Math.cos(dl)), sl0 * Math.sin(la) + cl0 * cl * Math.cos(dl)]; };
      c.globalAlpha = ga;
      const halo = c.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.25); halo.addColorStop(0, 'rgba(90,170,255,.45)'); halo.addColorStop(1, 'rgba(90,170,255,0)'); c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, 7); c.fill();
      const oc = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R); oc.addColorStop(0, '#1d4f8a'); oc.addColorStop(1, '#081a36'); c.fillStyle = oc; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      c.fillStyle = '#2c6a46'; c.strokeStyle = 'rgba(160,220,170,.35)'; c.lineWidth = 0.6;
      for (const ring of s.rings || []) {
        const pts = ring.map(([lo, la]) => pr(la, lo)), vis = pts.filter(q => q[2] > 0).length;
        if (vis < 2) continue;
        c.beginPath(); let on = false; for (const q of pts) { if (q[2] > 0) { on ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); on = true; } else on = false; }
        if (vis === pts.length) { c.closePath(); c.fill(); } c.stroke();
      }
      const n = s.links.length;
      s.links.forEach(([a, b], i) => {
        const st = 2.7 + i * Math.min(0.12, 1.6 / Math.max(1, n)), k = clamp((t - st) / 0.6); if (k <= 0) return;
        const v = (la, lo) => [Math.cos(la * D) * Math.cos(lo * D), Math.cos(la * D) * Math.sin(lo * D), Math.sin(la * D)], A1 = v(...a), B1 = v(...b);
        const om = Math.acos(clamp(A1[0] * B1[0] + A1[1] * B1[1] + A1[2] * B1[2], -1, 1)) || 1e-6;
        c.strokeStyle = 'rgba(255,200,70,.9)'; c.lineWidth = 2; c.shadowColor = '#ffb400'; c.shadowBlur = 8; c.beginPath(); let on = false;
        for (let j = 0; j <= 30 * k; j++) { const u = j / 30, s1 = Math.sin((1 - u) * om) / Math.sin(om), s2 = Math.sin(u * om) / Math.sin(om), x = s1 * A1[0] + s2 * B1[0], y = s1 * A1[1] + s2 * B1[1], z = s1 * A1[2] + s2 * B1[2];
          const la = Math.asin(clamp(z, -1, 1)) / D, lo = Math.atan2(y, x) / D, q = pr(la, lo), lift = 1 + 0.06 * Math.sin(u * Math.PI); const X = cx + (q[0] - cx) * lift, Y = cy + (q[1] - cy) * lift;
          if (q[2] > 0) { on ? c.lineTo(X, Y) : c.moveTo(X, Y); on = true; } else on = false; }
        c.stroke(); c.shadowBlur = 0;
      });
      for (const [la, lo] of s.pts) { const q = pr(la, lo); if (q[2] <= 0) continue; const pu = 3 + 1.5 * Math.sin(t * 4 + la); c.fillStyle = '#ffd76a'; c.beginPath(); c.arc(q[0], q[1], pu, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    },
  },
};

export function createCinema(deps) {
  let set = { music: true, sfx: true, reduce: false, auto: true };
  try { Object.assign(set, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const saveSet = () => { try { localStorage.setItem(LS, JSON.stringify(set)); } catch (e) {} };
  let playing = null, mounted = false, styled = false, poll = null;
  const style = () => { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); };
  const S = () => deps.S();
  const seen = () => { const s = S(); if (!s) return {}; s.cine = s.cine || { seen: {} }; return s.cine.seen; };
  const byKey = k => SCENES.find(x => x.key === k);

  function sceneData(key) {
    if (key !== 'lv20') return {};
    const s = S() || {}, ll = id => { const c = deps.cityById(id); return c && c.lat != null ? [c.lat, c.lon] : null; };
    const owned = [s.hqCity, ...(s.branches || [])].map(ll).filter(Boolean);
    const links = [...(s.rails || []).filter(r => r.built && !r.c), ...(s.airRoutes || []), ...(s.seaRoutes || [])].map(r => [ll(r.a), ll(r.b)]).filter(([a, b]) => a && b).slice(0, 60);
    if (!links.length && owned.length > 1) owned.slice(1).forEach(p => links.push([owned[0], p]));
    return { hq: ll(s.hqCity) || [42.7, 23.3], pts: owned, links };
  }

  // ---------- плейърът ----------
  async function play(key, manual = false) {
    const sc = byKey(key); if (!sc || playing || (!DRAW[key] && !sc.video)) return false;
    style();
    const el = document.createElement('div'); el.id = 'cine';
    el.innerHTML = `<canvas></canvas><div class="bar t"></div><div class="bar b"></div><div class="cap"><b></b><span></span></div><button class="skip">Пропусни ⏭</button><button class="unm">🔊 Звук</button><div class="snd">🔊 Докосни за звук</div>`;
    el.querySelector('.cap b').textContent = sc.cap; el.querySelector('.cap span').textContent = sc.sub;
    document.body.appendChild(el);
    if (!manual || !seen()[key]) { seen()[key] = S()?.day || 1; deps.save && deps.save(); }
    const prevSpeed = deps.speed ? deps.speed() : 1; if (deps.setSpeed) deps.setSpeed(0);
    let done = false, raf = 0, A = null, tm = 0;
    const cap = el.querySelector('.cap'), cleanup = [];
    const close = () => {
      if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(tm); for (const f of cleanup) f(); if (A) A.stop();
      el.classList.remove('on'); setTimeout(() => el.remove(), 480);
      if (deps.setSpeed) deps.setSpeed(prevSpeed);
      playing = null;
    };
    el.querySelector('.skip').onclick = e => { e.stopPropagation(); close(); };
    playing = { key, close };
    requestAnimationFrame(() => el.classList.add('on'));
    const So = deps.sound && deps.sound(), wantSnd = !!So && !So.muted && (set.music || set.sfx);
    if (sc.video && !set.reduce && await playVideo(sc, el, cap, close, wantSnd, cleanup, f => (tm = f))) return true;
    if (done) return true;
    if (sc.video && (set.reduce || !DRAW[key])) {   // намалено движение или без видео: кадърът с бавно приближаване
      const im = document.createElement('img'); im.className = 'pv'; im.src = sc.poster; im.alt = '';
      im.style.transition = set.reduce ? '' : `transform ${DUR}s ease-out`; el.insertBefore(im, el.firstChild); el.querySelector('canvas').remove();
      if (!set.reduce) requestAnimationFrame(() => requestAnimationFrame(() => { im.style.transform = 'scale(1.08)'; }));
      setTimeout(() => cap.classList.add('on'), (DUR - 2.3) * 1000); tm = setTimeout(close, (DUR + 1.4) * 1000);
      return true;
    }
    const dr = DRAW[key], cv = el.querySelector('canvas'), c = cv.getContext('2d');
    const data = sceneData(key);
    if (key === 'lv20') { try { const g = await Promise.race([loadGeo(), new Promise(r => setTimeout(() => r(null), 1500))]); data.rings = g ? ringsOf(g) : []; } catch (e) { data.rings = []; } }
    const st = dr.setup(rng(key.length * 7919 + 13), data);
    let W = 0, H = 0; const t0 = performance.now();
    const fit = () => { const dpr = Math.min(window.devicePixelRatio || 1, innerWidth * innerHeight > 600000 ? 1.5 : 2); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); addEventListener('resize', fit); cleanup.push(() => removeEventListener('resize', fit));
    const startAudio = () => {
      if (A || !So) return;
      try { So.init && So.init(); } catch (e) {}
      if (!So.ctx || !So.master || So.muted || So.ctx.state !== 'running') return;
      if ((performance.now() - t0) / 1000 > 3) return;
      A = makeAudio(So, set); try { MUSIC[key](A); } catch (e) { console.warn('cinema music', e); }
      el.querySelector('.snd').style.display = 'none';
    };
    if (wantSnd) { startAudio(); if (!A) { el.querySelector('.snd').style.display = 'block'; el.addEventListener('pointerdown', startAudio); } }
    const frame = () => {
      if (done) return;
      const t = Math.min(DUR, (performance.now() - t0) / 1000);
      try { dr.draw(c, set.reduce ? DUR * 0.92 : t, W, H, st); } catch (e) { console.warn('cinema draw', e); close(); return; }
      if (t >= DUR - 2.3) cap.classList.add('on');
      if (t >= DUR) { tm = setTimeout(close, 1400); return; }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return true;
  }
  // истинско видео: опитва със звук; ако браузърът не дава (няма докосване) — без звук и бутон „🔊 Звук“. false = да се ползва рисуваната сцена
  function playVideo(sc, el, cap, close, wantSnd, cleanup, setTm) {
    return new Promise(res => {
      const v = document.createElement('video'); v.src = sc.video; v.poster = sc.poster || ''; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      v.muted = !wantSnd;
      const cv = el.querySelector('canvas'); el.insertBefore(v, cv); cv.style.display = 'none';
      let ok = false;
      const fail = () => { if (ok) return; ok = true; v.remove(); cv.style.display = ''; res(false); };
      const unm = el.querySelector('.unm');
      v.addEventListener('error', fail);
      v.addEventListener('timeupdate', () => { if (v.duration && v.currentTime >= v.duration - 2.3) cap.classList.add('on'); });
      v.addEventListener('ended', () => setTm(setTimeout(close, 1400)));
      cleanup.push(() => { try { v.pause(); } catch (e) {} });
      const go = () => v.play().then(() => { if (!ok) { ok = true; res(true); } });
      go().catch(() => {
        if (!v.muted) { v.muted = true; go().then(() => { if (wantSnd) { unm.style.display = 'block'; unm.onclick = e => { e.stopPropagation(); v.muted = false; unm.style.display = 'none'; }; } }).catch(fail); }
        else fail();
      });
      setTimeout(() => { if (!ok && v.readyState < 2) fail(); }, 4000);
    });
  }
  function ringsOf(g) {
    const out = [];
    for (const f of g.features || []) { const gm = f.geometry; if (!gm) continue; const polys = gm.type === 'Polygon' ? [gm.coordinates] : gm.type === 'MultiPolygon' ? gm.coordinates : []; for (const p of polys) if (p[0] && p[0].length > 3) out.push(p[0].filter((_, i) => i % 2 === 0)); }
    return out;
  }

  // ---------- кога се пуска само ----------
  const resortBuilt = id => (S().resorts || {})[id]?.stage === 'built';
  function due() {
    const s = S(), sn = seen();
    const city = SCENES.find(x => x.city && x.city === s.cityId);
    if (city && !sn[city.key]) return city.key;
    if (!sn.plane && deps.firstPlane && deps.firstPlane()) return 'plane';
    if (!sn.oil && deps.firstOil && deps.firstOil()) return 'oil';
    if (!sn.lv20 && deps.lv20 && deps.lv20()) return 'lv20';
    const rs = SCENES.find(x => x.resort && !sn[x.key] && resortBuilt(x.resort)); if (rs) return rs.key;
    return null;
  }
  function firstRun() {   // стари записи: вече постигнатото не се пуска наведнъж при първото зареждане
    const s = S(); if (s.cine) return; s.cine = { seen: {} };
    if ((s.day || 1) <= 2) return;
    const sn = s.cine.seen, own = new Set([s.hqCity, s.cityId, ...(s.branches || [])]);
    for (const x of SCENES) if (x.city && own.has(x.city)) sn[x.key] = s.day;
    if (deps.firstPlane && deps.firstPlane()) sn.plane = s.day;
    if (deps.firstOil && deps.firstOil()) sn.oil = s.day;
    if (deps.lv20 && deps.lv20()) sn.lv20 = s.day;
    for (const x of SCENES) if (x.resort && resortBuilt(x.resort)) sn[x.key] = s.day;
  }
  function tick() {
    if (!S() || !deps.ready || !deps.ready()) return;
    mount(); firstRun();
    if (playing || !set.auto || (deps.auto && !deps.auto())) return;
    const k = due(); if (k) play(k);
  }
  function start() { if (!poll) poll = setInterval(tick, 1000); }

  // ---------- албумът ----------
  function mount() {
    if (mounted) return; const top = document.getElementById('top'); if (!top) return;
    mounted = true; style();
    const b = document.createElement('button'); b.id = 'btnCine'; b.className = 'btn2'; b.innerHTML = '🎬 Албум'; b.title = 'Албум на империята — гледай отново големите моменти';
    b.onclick = album;
    const ref = document.getElementById('btnConquest');
    if (ref && ref.parentNode) ref.parentNode.insertBefore(b, ref.nextSibling); else top.appendChild(b);
  }
  function album() {
    style(); document.getElementById('cineAlbum')?.remove();
    const sn = seen(), el = document.createElement('div'); el.id = 'cineAlbum';
    const items = SCENES.map(x => sn[x.key]
      ? `<div class="it">${x.poster ? `<img src="${x.poster}" alt="">` : `<div class="ico">${x.ico}</div>`}<b>${x.nm}</b><span class="meta" style="margin:0">${x.sub}</span><button class="btn" data-cplay="${x.key}">▶ Гледай</button></div>`
      : `<div class="it lk"><div class="ico">🔒</div><b>${x.nm}</b><span class="meta" style="margin:0">${x.lock}</span></div>`).join('');
    const chk = (k, nm) => `<label><input type="checkbox" data-cset="${k}" ${set[k] ? 'checked' : ''}>${nm}</label>`;
    el.innerHTML = `<div class="box"><h3><span>🎬 Албум на империята</span><button class="btn2" data-cclose>✕</button></h3>
      <div class="meta" style="margin:0">Големите моменти на фирмата. Всеки клип се пуска сам само първия път — тук можеш да го гледаш отново.</div>
      <div class="grid">${items}</div>
      <div class="sets">${chk('auto', '▶ Пускай сами')}${chk('music', '🎵 Музика')}${chk('sfx', '🔔 Ефекти')}${chk('reduce', '🐢 Намалено движение')}</div></div>`;
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-cclose]')) { el.remove(); return; }
      const pb = e.target.closest('[data-cplay]'); if (pb) { play(pb.dataset.cplay, true); }
    });
    el.addEventListener('change', e => { const k = e.target.dataset.cset; if (!k) return; set[k] = e.target.checked; saveSet(); });
    document.body.appendChild(el);
  }

  return { start, play, album, tick, due, scenes: () => SCENES.map(x => ({ key: x.key, nm: x.nm, seen: !!seen()[x.key] })), playing: () => playing && playing.key, close: () => playing && playing.close() };
}
