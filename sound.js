// sound.js — звук с WebAudio, без звукови файлове: фон на града (птици/щурци/трафик),
// строителни шумове около камерата и кратки ефекти за събития.
// Употреба: Sound.init() при първия клик; Sound.update({ night, activity, speed }) всеки кадър; Sound.play('cash').
const rand = (a, b) => a + Math.random() * (b - a);

export const Sound = {
  ctx: null, master: null, muted: false, vol: 0.5, t: 0, nextBird: 0, nextHammer: 0, nextCricket: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(ctx.destination);
    // бял шум за вятър, трафик и удари
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }   // „кафяв“ шум — мек
    // фон: далечен трафик (нискочестотен шум) — винаги тече, силата се управлява
    this.hum = this.loopNoise(220, 0.7, 'lowpass');
    this.engine = this.loopNoise(140, 1.2, 'bandpass');   // моторите на техниката наблизо
  },
  loopNoise(freq, q, type) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    return { g, f };
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.ctx.currentTime, 0.1); },
  toggle() { this.setMuted(!this.muted); return this.muted; },

  tone(freq, dur, vol, type = 'sine', to, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  hit(freq, dur, vol, q = 4, delay = 0) {   // кратък удар от филтриран шум (чук, стъпка, тракане)
    const ctx = this.ctx, t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random(), dur + 0.05);
  },
  // птица: бърза поредица от плъзгащи се тонове
  bird() { const b = rand(2200, 3800), n = 2 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) this.tone(b * rand(0.9, 1.1), 0.09, 0.05, 'sine', b * rand(1.2, 1.5), i * 0.11); },
  cricket() { const f = rand(4200, 4800); for (let i = 0; i < 3; i++) this.tone(f, 0.04, 0.025, 'square', null, i * 0.07); },
  hammer() { this.hit(rand(1800, 2600), 0.08, 0.22, 6); if (Math.random() < 0.5) this.hit(rand(1800, 2600), 0.08, 0.18, 6, 0.32); },

  // ефекти за събития
  // класическо „та-даа“: кратък акорд и по-дълъг, по-висок акорд (месингов тембър)
  tada() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
    const chord = (notes, at, dur, vol) => notes.forEach(f => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f * 1.003;
      flt.type = 'lowpass'; flt.frequency.setValueAtTime(900, at); flt.frequency.linearRampToValueAtTime(3200, at + 0.08); flt.Q.value = 2;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.setValueAtTime(vol, at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(at); o2.start(at); o.stop(at + dur + 0.05); o2.stop(at + dur + 0.05);
    });
    chord([392, 494, 587], t0, 0.18, 0.05);                 // „та“
    chord([523, 659, 784, 1047], t0 + 0.2, 0.9, 0.055);     // „-даа“
  },
  // записани звуци (CC0, assets/sfx): кешира се по един Audio елемент
  file(src, vol = 0.8) {
    if (this.muted) return;
    this.files = this.files || {};
    const a = this.files[src] = this.files[src] || new Audio(src);
    a.volume = vol; a.currentTime = 0; a.play().catch(() => {});
  },
  // мелодии за големите моменти (синтез, без файлове): ns — [честота, начало, продължителност], tp — тембър
  brass(fs, at, dur, vol = 0.05) { const ctx = this.ctx; for (const f of fs) { const t = ctx.currentTime + at, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(2400, t + 0.15); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(lp); lp.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); } },
  bell(f, at, vol = 0.12) { for (const [m, v] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) this.tone(f * m, 1.4 / m + 0.2, vol * v, 'sine', null, at); },
  drum(at, vol = 0.4) { this.tone(140, 0.25, vol, 'sine', 55, at); this.hit(900, 0.06, vol * 0.4, 1.5, at); },
  jingle(name) {
    const B = (fs, at, d, v) => this.brass(fs, at, d, v), T = (f, at, d = 0.18, v = 0.12, tp = 'triangle') => this.tone(f, d, v, tp, null, at);
    switch (name) {
      case 'offer': this.bell(1047, 0); this.bell(1319, 0.14, 0.09); break;                                  // нова оферта/търг — звънче
      case 'branch': [0, 0.16, 0.32].forEach(t => this.drum(t, 0.3)); [392, 523, 659].forEach((f, i) => T(f, 0.48 + i * 0.12, 0.22)); B([523, 659, 784], 0.84, 0.7); break;   // нов филиал — кратък марш
      case 'cityDone': this.drum(0, 0.45); B([392, 494, 587], 0, 0.35); B([440, 554, 659], 0.38, 0.35); B([523, 659, 784, 1047], 0.76, 1.6, 0.06); [1568, 2093, 2637].forEach((f, i) => this.bell(f, 0.8 + i * 0.12, 0.05)); this.drum(0.76, 0.5); break;   // завършен град — голяма фанфара
      case 'tenderDone': this.bell(784, 0); this.bell(1047, 0.18); this.bell(1319, 0.36); B([523, 659, 784], 0.6, 1.2, 0.05); this.drum(0.6, 0.4); break;   // предадена държавна поръчка — камбани + акорд
      case 'country': [0, 0.3, 0.6, 0.75, 0.9].forEach(t => this.drum(t, 0.35)); B([392, 494, 587], 0, 0.55); B([523, 659, 784], 0.6, 0.55); B([587, 740, 880], 1.2, 0.55); B([784, 988, 1175, 1568], 1.8, 2, 0.06); this.drum(1.8, 0.6); [2093, 2637, 3136].forEach((f, i) => this.bell(f, 1.85 + i * 0.1, 0.05)); break;   // завладяна държава — химн
      case 'airport': this.tone(220, 1.6, 0.06, 'sawtooth', 880); this.hit(3000, 1.2, 0.05, 0.6, 0.1); this.bell(1319, 1.1, 0.08); this.bell(1760, 1.3, 0.06); break;   // летище — излитане и сигнал
      case 'plane': this.tone(180, 1.4, 0.05, 'sawtooth', 620); this.hit(2500, 1.1, 0.05, 0.5); break;
      case 'ship': [131, 165].forEach(f => this.tone(f, 1.6, 0.08, 'sawtooth')); break;   // корабна сирена
      case 'quest': [1047, 1319, 1568, 2093].forEach((f, i) => T(f, i * 0.06, 0.25, 0.08)); break;
      default: return false;
    }
    return true;
  },
  play(name) {
    if (this.ctx && !this.muted && this.jingle(name)) return;
    if (name === 'levelup') {   // „та-даа“ + мелодия (Kenney Music Jingles, CC0)
      this.tada();
      setTimeout(() => this.file('assets/sfx/levelup.ogg', 0.8), 650);
      return;
    }
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'cash': [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 0.15, 'triangle', null, i * 0.07)); this.hit(5000, 0.15, 0.12, 1, 0.05); break;
      case 'done': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 0.14, 'triangle', null, i * 0.12)); break;
      case 'truck': this.tone(98, 0.6, 0.12, 'sawtooth', 70); this.tone(147, 0.4, 0.06, 'square', 110, 0.05); break;   // ТИР: ниско бучене при разтоварване
      case 'buy': this.tone(660, 0.08, 0.12, 'square'); this.tone(990, 0.12, 0.1, 'square', null, 0.08); break;
      case 'click': this.tone(1200, 0.04, 0.06, 'square'); break;
      case 'error': this.tone(220, 0.18, 0.12, 'sawtooth', 160); break;
      case 'horn': [370, 466].forEach(f => this.tone(f, 1.1, 0.07, 'sawtooth')); break;   // влакова свирка (акорд)
      case 'upgrade': [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 0.13, 'triangle', null, i * 0.09)); break;
    }
  },

  // всеки кадър: night 0..1, activity 0..1 (колко строеж/техника има около камерата), speed (0 = пауза)
  update(dt, { night = 0, activity = 0, speed = 1, traffic = 0.5 } = {}) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const paused = speed === 0;
    this.hum.g.gain.setTargetAtTime(paused ? 0.02 : 0.05 + traffic * 0.06 * (1 - night * 0.6), now, 0.5);
    this.engine.g.gain.setTargetAtTime(paused ? 0 : activity * 0.12, now, 0.3);
    this.engine.f.frequency.setTargetAtTime(110 + activity * 60 + Math.sin(now * 2) * 10, now, 0.3);
    if (paused) return;
    this.t += dt;
    if (this.t > this.nextBird && night < 0.3) { this.bird(); this.nextBird = this.t + rand(2.5, 7); }
    if (this.t > this.nextCricket && night > 0.6) { this.cricket(); this.nextCricket = this.t + rand(0.6, 2); }
    if (this.t > this.nextHammer && activity > 0.15) { this.hammer(); this.nextHammer = this.t + rand(0.5, 1.6) / Math.max(0.3, activity); }
  },
};
