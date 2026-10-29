// sfx2.js — 🔊 sfx-batch2 (T1): тихите звуци на новите неща — само процедурни (Web Audio, без файлове), по разстоянието от камерата.
// Всичко минава през „Град“ (Sound.cityBus) и спира при 🔇. Точката на слушане е целта на камерата (controls.target), а силата пада
// с разстоянието (falloff) и с отдалечаването на камерата (zoomK). Не надвиква градския фон: най-силното тук е ~0,05.
//   трамвай — „дзън-дзън“ при тръгване от спирка и когато кола му препречи пътя; тихо тракане по релсите, докато се движи
//   депо — скърцане на спирачките, тракане на съединителите при смяна на посоката, пращене при искрите
//   магистрала — постоянно бучене отблизо; понякога мотор на ТИР или въздушни спирачки
//   боклукчийски камион — бипкане и хидравликата на повдигача на спирката; пътна помощ — лебедката; бензиностанция — „дин“ на колонката
//   мотори — бръмчене на скутер, когато минава близо
//   курорти — вълни (летни), вятър и бръмчене на въжената линия (зимни); време — дъжд по повърхностите, вятър при буря/сняг
// const F = createSfx2(Sound);  F.update(dt, src);  F.resort(kind | null);  F.stop()
const rand = (a, b) => a + Math.random() * (b - a);
const fall = (d, R) => d >= R ? 0 : (1 - d / R) ** 2;

export function createSfx2(Sound) {
  let L = null;   // постоянните цикли — създават се веднъж, щом има AudioContext
  const last = new WeakMap();   // предишното състояние на трамвай/композиция (за събитията)
  const nextAt = {}, gate = (k, t) => { const n = Sound.ctx.currentTime; if ((nextAt[k] || 0) > n) return false; nextAt[k] = n + t; return true; };
  let resortKind = null;
  function loops() {
    if (L || !Sound.ctx) return L;
    const ctx = Sound.ctx, out = Sound.cityBus || Sound.master;
    const loop = (freq, q, type, lfo = 0, lfoDepth = 0) => { const s = ctx.createBufferSource(); s.buffer = Sound.noise; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(out); s.start(0, Math.random() * 1.5);
      if (lfo) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = lfo; og.gain.value = lfoDepth; o.connect(og); og.connect(f.frequency); o.start(); }
      return { g, f }; };
    L = {
      tram: loop(380, 0.9, 'bandpass'),            // търкаляне по релсите
      hw: loop(150, 0.8, 'lowpass'),               // бученето на магистралата
      rain: loop(3200, 0.4, 'bandpass'),           // дъжд — светъл шум
      wind: loop(420, 0.5, 'bandpass', 0.08, 180), // вятър — бавно люлеещ се филтър
      waves: loop(520, 0.6, 'lowpass', 0.13, 260), // вълни — „дишащ“ нискочестотен шум
    };
    { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 96; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0; o.connect(f); f.connect(g); g.connect(out); o.start(); L.cable = { g, f }; }   // въжената линия
    return L;
  }
  const set = (n, v, tc = 0.6) => { lv[n] = +v.toFixed(4); if (L && L[n]) L[n].g.gain.setTargetAtTime(v, Sound.ctx.currentTime, tc); };
  // еднократните — през „Град“, със стерео по посоката на източника спрямо камерата
  const withDest = (pan, fn) => { const prev = Sound.dest; Sound.dest = Sound.pan ? Sound.pan(Math.max(-0.9, Math.min(0.9, pan))) : (Sound.cityBus || Sound.master); try { fn(); } finally { Sound.dest = prev; } };
  const bell0 = (v, pan) => withDest(pan, () => { for (const [d, f] of [[0, 1480], [0.28, 1480]]) for (const [m, k] of [[1, 1], [2.4, 0.35], [4.1, 0.12]]) Sound.tone(f * m, 0.7 / m + 0.15, v * k, 'sine', null, d); });
  const clack0 = (v, pan) => withDest(pan, () => { Sound.hit(260, 0.09, v, 3); Sound.hit(900, 0.05, v * 0.5, 4, 0.11); });
  const squeal0 = (v, pan) => withDest(pan, () => { const f = rand(2600, 3400); Sound.tone(f, 1.1, v, 'sine', f * 1.04); Sound.tone(f * 1.5, 0.9, v * 0.3, 'sine', f * 1.52, 0.05); });
  const coupler0 = (v, pan) => withDest(pan, () => { Sound.hit(180, 0.3, v, 2); Sound.hit(700, 0.12, v * 0.7, 5, 0.02); Sound.hit(500, 0.15, v * 0.5, 4, 0.35); });
  const crackle0 = (v, pan) => withDest(pan, () => { for (let i = 0; i < 6; i++) Sound.hit(rand(4000, 7000), 0.04, v * rand(0.4, 1), 2, i * rand(0.02, 0.06)); });
  const lorry0 = (v, pan) => withDest(pan, () => { if (Math.random() < 0.5) Sound.tone(rand(62, 78), 2.4, v, 'sawtooth', rand(48, 56)); else { Sound.hit(3200, 0.9, v * 0.8, 0.5); } });
  const beeps0 = (v, pan, n = 3) => withDest(pan, () => { for (let i = 0; i < n; i++) Sound.tone(1050, 0.16, v, 'square', null, i * 0.42); });
  const hydraulic0 = (v, pan) => withDest(pan, () => { Sound.tone(150, 2.2, v, 'sawtooth', 240); Sound.hit(1800, 1.8, v * 0.3, 0.8, 0.1); });
  const winch0 = (v, pan) => withDest(pan, () => { Sound.tone(210, 1.6, v, 'square', 320); });
  const ding0 = (v, pan) => withDest(pan, () => { Sound.tone(1320, 0.5, v, 'sine'); Sound.tone(990, 0.6, v * 0.8, 'sine', null, 0.22); });
  const scooter0 = (v, pan) => withDest(pan, () => { const ctx = Sound.ctx, t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = rand(1.4, 2);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rand(190, 230), t); o.frequency.exponentialRampToValueAtTime(rand(140, 160), t + d); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(f); f.connect(g); g.connect(Sound.dest || Sound.cityBus || Sound.master); o.start(t); o.stop(t + d + 0.05); });

  const why = {}, stats = {}, lv = {}, cnt = (nm, f) => (...a) => { stats[nm] = (stats[nm] || 0) + 1; return f(...a); };   // за проверка (__dbg.sfx2): колко пъти е звучало всяко събитие; lv — силата на циклите
  const bell = cnt('bell', bell0), clack = cnt('clack', clack0), squeal = cnt('squeal', squeal0), coupler = cnt('coupler', coupler0), crackle = cnt('crackle', crackle0), lorry = cnt('lorry', lorry0), beeps = cnt('beeps', beeps0), hydraulic = cnt('hydraulic', hydraulic0), winch = cnt('winch', winch0), ding = cnt('ding', ding0), scooter = cnt('scooter', scooter0);

  // 🚆 спирането на влак на гарата (записан звук: assets/sfx/train-stop.mp3, spinopel — Pixabay): по разстоянието, без застъпване
  let stopBuf = null, stopLoading = false, stopUntil = 0, here = null;
  function trainStop(x, z, vol = 0.32) {
    if (!Sound.ctx || Sound.muted) return false; const ctx = Sound.ctx;
    if (!stopBuf) { if (!stopLoading) { stopLoading = true; fetch('assets/sfx/train-stop.mp3').then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => { stopBuf = b; if (here && here.pending) { const p = here.pending; here.pending = null; trainStop(...p); } }).catch(() => { stopLoading = false; }); } if (here) here.pending = [x, z, vol]; return false; }
    if (ctx.currentTime < stopUntil) return false;   // вече звучи — не се застъпва
    const k = here && x != null ? fall(Math.hypot(x - here.x, z - here.z), 380) * here.Z : 1; if (k < 0.03) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = stopBuf; g.gain.value = Math.min(0.35, vol * k);
    src.connect(g); g.connect(Sound.pan && here && x != null ? Sound.pan(Math.max(-0.8, Math.min(0.8, (x - here.x) / 80))) : (Sound.cityBus || Sound.master)); src.start();
    stopUntil = ctx.currentTime + stopBuf.duration - 1.5; stats.trainStop = (stats.trainStop || 0) + 1; return true;
  }
  function update(dt, s) {
    why.v = !Sound.ctx ? 'ctx' : Sound.muted ? 'muted' : !s ? 'src' : !s.speed ? 'speed0' : 'ok'; why.n = (why.n || 0) + 1;
    if (!Sound.ctx || Sound.muted || !loops()) return;
    if (!s || !s.on || !s.speed) { for (const n of ['tram', 'hw', 'rain', 'wind', 'waves', 'cable']) set(n, 0, 0.4); return; }
    const [lx, lz] = s.at, Z = s.zoomK, pan = x => (x - lx) / 60;
    here = { x: lx, z: lz, Z, pending: here && here.pending };   // стерео: по x спрямо целта на камерата
    const near = (x, z, R) => fall(Math.hypot(x - lx, z - lz), R) * Z;
    // 🚋 трамваите
    let roll = 0;
    for (const t of s.trams || []) { const p = t.A.s.position, k = near(p.x, p.z, 220); const pr = last.get(t) || { wait: t.wait, car: 0 };
      if (k > 0.02) {
        if (pr.wait > 0 && t.wait <= 0 && !t.endT) bell(0.05 * k, pan(p.x));   // тръгва от спирката
        if (pr.car === 0 && t.carT > 0 && gate('tb' + t.li + t.k, 4)) bell(0.06 * k, pan(p.x));   // кола на пътя му
        roll = Math.max(roll, k * Math.min(1, t.v / 8));
        if (t.v > 2 && Math.random() < dt * t.v / 6) clack(0.035 * k, pan(p.x)); }
      last.set(t, { wait: t.wait, car: t.carT > 0 ? 1 : 0 }); }
    set('tram', 0.05 * roll, 0.3);
    // 🛤️ депото
    if (s.depot) { for (const u of s.depot.units) { const c = u.cars[0]; if (!c) continue; const k = near(c.position.x, c.position.z, 180); const pr = last.get(u) || { st: u.st };
        if (k > 0.02) { if (u.pass && u.v > 1 && gate('sq' + u.id, 3)) squeal(0.025 * k, pan(c.position.x));
          if (pr.st !== u.st && (u.st === 'rev' || u.st === 'park')) coupler(0.06 * k, pan(c.position.x)); }
        last.set(u, { st: u.st }); }
      const sp = s.depot.info().sparks, pr = last.get(s.depot) || 0; if (sp > pr + 3) { const u = s.depot.units.find(x => x.v > 0.5) || s.depot.units[0], c = u && u.cars[0]; if (c) { const k = near(c.position.x, c.position.z, 180); if (k > 0.02) crackle(0.04 * k, pan(c.position.x)); } } last.set(s.depot, sp); }
    // 🛣️ магистралата
    let hw = 0; if (s.hw) { const b = s.hw.box, dx = Math.max(b[0] - lx, 0, lx - b[2]), dz = Math.max(b[1] - lz, 0, lz - b[3]); hw = fall(Math.hypot(dx, dz), 260) * Z;
      if (hw > 0.05 && s.hw.lorries > 0 && gate('lorry', rand(9, 22) / Math.min(3, s.hw.lorries))) lorry(0.035 * hw, pan((b[0] + b[2]) / 2)); }
    set('hw', 0.045 * hw, 0.8);
    // 🚛 боклукчийският камион, пътната помощ, бензиностанциите
    if (s.garbage && s.garbage.on && s.garbage.pos) { const [x, z] = s.garbage.pos, k = near(x, z, 160), pr = last.get(s.garbage.ref) || 0;
      if (k > 0.03 && s.garbage.stop > 0 && pr <= 0) { beeps(0.025 * k, pan(x)); setTimeout(() => hydraulic(0.03 * k, pan(x)), 900); }
      last.set(s.garbage.ref, s.garbage.stop); }
    for (const w of s.tows || []) { const p = w.getWorldPosition ? w.getWorldPosition(w.userData.__v || (w.userData.__v = new (w.position.constructor)())) : w.position, k = near(p.x, p.z, 160);
      if (k > 0.03 && w.userData.winch && gate('winch', 3)) { winch(0.03 * k, pan(p.x)); beeps(0.02 * k, pan(p.x), 2); } }
    if (!s.night) for (const p of s.petrol || []) { const k = near(p[0], p[1], 120); if (k > 0.05 && gate('pump' + Math.round(p[0]), rand(12, 30))) ding(0.025 * k, pan(p[0])); }
    // 🛵 моторите
    for (const m of s.motos || []) { const k = near(m.x, m.z, 70); if (k > 0.15 && gate('moto', 2.5) && Math.random() < 0.35) scooter(0.04 * k, pan(m.x)); }
    // 🌦️ времето: дъжд по повърхностите, вятър при буря/сняг; 🌊 вълни край брега
    const wk = s.weather || 'clear', rainK = wk === 'storm' ? 1 : wk === 'rain' ? 0.65 : 0, windK = wk === 'storm' ? 1 : wk === 'snow' ? 0.6 : 0;
    set('rain', Sound.cs3Rain ? 0 : 0.035 * rainK * (0.5 + 0.5 * Z), 1.5); set('wind', 0.03 * windK, 2); set('waves', 0.04 * (s.sea || 0) * (0.4 + 0.6 * Z), 1.5); set('cable', 0, 1);
  }
  // курортите (отделният изглед): летен — вълни; зимен — вятър и въжената линия; спа — тихо
  function resort(kind) {
    if (!Sound.ctx || !loops()) return; resortKind = kind;
    for (const n of ['tram', 'hw', 'rain']) set(n, 0, 0.4);
    if (Sound.muted || !kind) { for (const n of ['wind', 'waves', 'cable']) set(n, 0, 0.6); return; }
    set('waves', kind === 'summer' ? 0.045 : 0, 1.5); set('wind', kind === 'winter' ? 0.03 : 0, 2); set('cable', kind === 'winter' ? 0.012 : 0, 1.5);
  }
  // Лабораторията (раздел „Звуци“): всеки звук самостоятелно, на пълна сила; циклите — 4 с, после заглъхват
  const DEMO = { 'tram-bell': () => bell(0.06, 0), 'tram-clack': () => { for (let i = 0; i < 6; i++) setTimeout(() => clack(0.05, 0), i * 380); }, 'tram-roll': 'tram', 'depot-squeal': () => squeal(0.04, 0), 'depot-coupler': () => coupler(0.07, 0),
    'depot-crackle': () => crackle(0.05, 0), 'hw-hum': 'hw', 'hw-lorry': () => lorry(0.05, 0), 'garbage-beeps': () => beeps(0.035, 0), 'garbage-hydraulic': () => hydraulic(0.04, 0), 'tow-winch': () => winch(0.04, 0),
    'petrol-ding': () => ding(0.04, 0), 'moto-scooter': () => scooter(0.05, 0), 'train-stop': () => trainStop(null, null, 0.35), 'rain': 'rain', 'wind': 'wind', 'waves': 'waves', 'cable-car': 'cable' };
  const LOOPV = { tram: 0.05, hw: 0.045, rain: 0.035, wind: 0.03, waves: 0.045, cable: 0.012 };
  function demo(name) { if (!Sound.ctx || !loops()) return false; const d = DEMO[name]; if (!d) return false;
    if (typeof d === 'function') d(); else { set(d, LOOPV[d] * 1.4, 0.3); setTimeout(() => set(d, 0, 0.6), 4000); } return true; }
  return { update, resort, demo, trainStop, names: Object.keys(DEMO), stop() { if (L) for (const n of ['tram', 'hw', 'rain', 'wind', 'waves', 'cable']) set(n, 0, 0.2); }, get resortKind() { return resortKind; }, stats, lv, why };
}
