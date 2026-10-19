// roomsound.js — звукът на залите (directors3d.js): тих шум на залата, шумолене на хартия, удар с чукче при одобрение, аплодисменти,
// и 🗣️ говор на глас (speechSynthesis, само ако браузърът има български глас). Всичко е синтезирано (Web Audio), освен ръкоплясканията (applause.mp3) — без файлове.
let ac = null;
const ctx = () => ac || (ac = new (window.AudioContext || window.webkitAudioContext)());
function noise(sec) { const a = ctx(), b = a.createBuffer(1, Math.ceil(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }

export function createRoomSound() {
  let on = true, amb = null, voice = null;
  const out = () => { const a = ctx(), g = a.createGain(); g.connect(a.destination); return g; };
  function ambience(start) {   // тихият шум на залата: нискочестотен шум + далечна вентилация
    if (!start) { if (amb) { try { amb.src.stop(); } catch { } amb = null; } return; }
    if (amb || !on) return;
    const a = ctx(), src = a.createBufferSource(); src.buffer = noise(4); src.loop = true;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; const g = out(); g.gain.value = 0.018;
    src.connect(lp).connect(g); src.start(); amb = { src };
  }
  function burst(sec, f0, f1, q, vol, type = 'bandpass', at = 0) {   // кратък филтриран шум (хартия, пляскане)
    const a = ctx(), src = a.createBufferSource(); src.buffer = noise(sec);
    const bp = a.createBiquadFilter(); bp.type = type; bp.frequency.setValueAtTime(f0, a.currentTime + at); bp.frequency.linearRampToValueAtTime(f1, a.currentTime + at + sec); bp.Q.value = q;
    const g = out(); g.gain.setValueAtTime(0, a.currentTime + at); g.gain.linearRampToValueAtTime(vol, a.currentTime + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, a.currentTime + at + sec);
    src.connect(bp).connect(g); src.start(a.currentTime + at); src.stop(a.currentTime + at + sec + 0.05);
  }
  const paper = () => { if (!on) return; burst(0.18, 2500, 5200, 0.8, 0.09); burst(0.14, 3200, 6000, 0.9, 0.06, 'bandpass', 0.16); };
  function gavel() {   // два удара с чукче: тъп удар + дървено щракване
    if (!on) return; const a = ctx();
    for (const at of [0, 0.22]) {
      const o = a.createOscillator(), g = out(); o.type = 'sine'; o.frequency.setValueAtTime(180, a.currentTime + at); o.frequency.exponentialRampToValueAtTime(60, a.currentTime + at + 0.15);
      g.gain.setValueAtTime(0.5, a.currentTime + at); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + at + 0.2); o.connect(g); o.start(a.currentTime + at); o.stop(a.currentTime + at + 0.25);
      burst(0.05, 1800, 1400, 1.5, 0.25, 'bandpass', at);
    }
  }
  // 👏 ръкопляскането: записът (assets/sfx/applause.mp3, Pixabay) — затихва за sec; ако файлът не тръгне — синтезираното
  let clapA = null;
  function applause(sec = 2.6) {
    if (!on) return;
    try { if (!clapA) clapA = new Audio('assets/sfx/applause.mp3'); clapA.pause(); clapA.currentTime = 0; clapA.volume = 0.55; clapA.play().then(() => {
      const t0 = performance.now(), L = Math.max(1.5, sec + 1.2) * 1000, f = () => { const u = (performance.now() - t0) / L; if (u >= 1) { clapA.pause(); return; } if (u > 0.6) clapA.volume = 0.55 * (1 - (u - 0.6) / 0.4); requestAnimationFrame(f); }; f(); }).catch(() => synthClap(sec)); return; } catch { }
    synthClap(sec);
  }
  function synthClap(sec) {   // много кратки пляскания, които се сгъстяват и затихват
    for (let i = 0; i < 70; i++) { const at = Math.random() * sec * (0.4 + 0.6 * Math.random()); burst(0.04, 1200 + Math.random() * 1500, 900, 1.2, 0.05 * (1 - at / sec * 0.7), 'bandpass', at); }
  }
  // 🗣️ говор: само с български глас (иначе мълчи — не чете кирилица с чужд акцент)
  const bgVoice = () => voice || (voice = (window.speechSynthesis?.getVoices() || []).find(v => /^bg/i.test(v.lang)) || null);
  if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { voice = null; bgVoice(); };
  const canSpeak = () => !!bgVoice();
  function speak(text, opt = {}) {
    if (!on || !opt.voiceOn || !window.speechSynthesis) return; const v = bgVoice(); if (!v) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/„|“/g, '')); u.voice = v; u.lang = v.lang; u.rate = 1.02; u.pitch = opt.female ? 1.15 : 0.9;
    window.speechSynthesis.speak(u);
  }
  const hush = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); clapA && clapA.pause(); } catch { } };
  return { ambience, paper, gavel, applause, speak, hush, canSpeak, setOn: v => { on = v; if (!v) { ambience(false); hush(); } }, isOn: () => on };
}
