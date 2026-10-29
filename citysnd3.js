// citysnd3.js — 🔊 city-snd3: записаните звуци на града (собственикът, 29.10 — Pixabay, assets/sfx/CREDITS-pixabay.txt).
// Всичко минава през „Град“ (Sound.cityBus; гръмотевиците — през „Ефекти“, Sound.master), спира при 🔇 и е тихо: градският фон е ~0,3–0,5.
// Точката на слушане е целта на камерата; отвисоко близките звуци заглъхват. Буферите се зареждат при първа нужда; циклите — безшевни.
//   предградие (amb-suburb) — фонът на малките градове (нямат town.mp3); в средните — съвсем тихо под него
//   залез (amb-sunset) — вечер (night 0,3–0,8, след обяд) в средните и големите; предградието се отдръпва
//   центърът (amb-downtown) — денем, отблизо, около площада на големите градове и мегаполисите
//   тълпа (amb-crowd) — отблизо до спирките с чакащи хора (city-life3) и до площада/пазара денем
//   стадион (amb-stadium + stadium-cheer) — до готов стадион в часовете на мача (~60% от вечерите); от време на време — възглас
//   колела (bike-bell-1/2) — „дзън“ от колоездач наблизо (bikes.js), рядко
//   дъжд (amb-rain-light/heavy) — навсякъде, по силата на дъжда (weather.heavy); преливане слаб ↔ силен; отвисоко — малко по-тихо
//   море (amb-gulls + gull-1/2) — в крайморските градове, когато целта е над/до водата и камерата е ниско: тих цикъл и от време на време крясък
//   пристанище (port-crane-1…3, port-container-1…3) — до кея с крановете (city.sea.port): мотор на крана на 10–25 s, тракане на контейнер на 8–20 s
//   гръмотевици (thunder-near/far) — thunder(dist) от storm.js: близка/далечна, закъснение dist/343 s, сила и „тъмнина“ по разстоянието
// Градовете със свой запис (Ню Йорк, Чикаго, Истанбул, Лас Вегас) — без предградие/залез/център (имат си фон); тълпата, стадионът, колелата и дъждът — навсякъде.
// const C3 = createCitySnd3(Sound);  C3.tick(dt, ctx);  C3.thunder(dist) → true, ако е изсвирена;  C3.stop()
//   ctx: { onMap, camera, target, night, hour, cityId, tier, own, mega, speed, bikes, life, square, market, stadiums() → [Object3D], weather, seaside, waterAt(x, z), sea }
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const DIR = 'assets/sfx/';
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
const fall = (d, r) => d >= r ? 0 : (1 - d / r) ** 2;
const near = (camD, a, b) => clamp(1 - (camD - a) / b);   // 1 отблизо (до a м), 0 от a + b м нагоре
const rand = (a, b) => a + Math.random() * (b - a);
// най-силно (gain) — градският фон е 0,32 в силата си
const V = { suburbS: 0.16, suburbM: 0.06, sunset: 0.13, downtown: 0.15, crowd: 0.12, stadium: 0.2, cheer: 0.24, bell: 0.13, rainL: 0.17, rainH: 0.21, gulls: 0.09, gull: 0.1, crane: 0.12, box: 0.11 };
const LOOPS = ['amb-suburb', 'amb-sunset', 'amb-downtown', 'amb-crowd', 'amb-stadium', 'amb-rain-light', 'amb-rain-heavy', 'amb-gulls'];
const W3 = feature('weather3');

export function createCitySnd3(Sound) {
  const bufs = {}, loading = {}, L = {}, P = new THREE.Vector3();
  let stopT = 0, stops = [], stadT = 0, stads = [], bikeT = 0, bellAt = 0, cheerAt = 0, evening = -1, match = false, cityKey = null, thunderAt = 0, curDt = 1 / 60, seaT = 0, waterK = 0, portXZ = null, gullAt = 0, craneAt = 0, boxAt = 0;
  const get = n => { if (bufs[n]) return bufs[n]; if (!loading[n] && Sound.ctx) { loading[n] = true; fetch(DIR + n + '.mp3').then(r => r.arrayBuffer()).then(a => Sound.ctx.decodeAudioData(a)).then(b => { bufs[n] = b; }).catch(() => { loading[n] = false; }); } return null; };
  // цикъл: създава се, щом трябва (буферът е готов); след ~20 s тишина спира (без празно декодиране)
  function level(n, v, tc = 0.8) {
    const ctx = Sound.ctx; let o = L[n];
    if (!o) { if (v < 0.002) return; const b = get(n); if (!b) return; const g = ctx.createGain(); g.gain.value = 0; g.connect(Sound.cityBus || Sound.master); const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start(0, Math.random() * b.duration); o = L[n] = { s, g, v: 0, quiet: 0 }; }
    if (Math.abs(v - o.v) > 0.002) { o.v = v; o.g.gain.setTargetAtTime(v, ctx.currentTime, tc); }
    if (v < 0.002) { if ((o.quiet += curDt) > 20) drop(n); } else o.quiet = 0;
  }
  function drop(n) { const o = L[n]; if (!o) return; try { o.s.stop(); } catch { } o.s.disconnect(); o.g.disconnect(); delete L[n]; }
  // еднократен звук: сила, стерео (−1…1), височина, закъснение, нискочестотен филтър (Hz) и шина
  function shot(n, v, pan = 0, rate = 1, delay = 0, lp = 0, bus = null) {
    const b = get(n), ctx = Sound.ctx; if (!b || v < 0.003) return !!b;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate; const g = ctx.createGain(); g.gain.value = v; let x = s;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; x.connect(f); x = f; }
    x.connect(g); let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
    out.connect(bus || Sound.cityBus || Sound.master); s.start(ctx.currentTime + delay); s.onended = () => { s.disconnect(); g.disconnect(); out.disconnect(); }; return true;
  }
  const panOf = (camera, tg, x, z) => { const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); return ((x - tg.x) * r.x + (z - tg.z) * r.z) / 25; };   // по дясната ос на камерата
  // ⚡ гръмотевица (storm.js → thunder(dist)): до 900 м — близка (пукот), по-нататък — далечна (боботене); false — още няма буфер (тогава storm.js свири своята)
  function thunder(dist) {
    if (!Sound.ctx) return false; const nr = dist < 900, n = (nr ? 'thunder-near-' : 'thunder-far-') + (Math.random() < 0.5 ? 1 : 2), b = get(n); if (!b) { get(n === 'thunder-near-1' ? 'thunder-near-2' : 'thunder-near-1'); return false; }
    if (Sound.muted) return true; const now = Sound.ctx.currentTime; if (now < thunderAt) return true; thunderAt = now + 0.6;   // не две наведнъж
    return shot(n, Math.min(0.8, 0.85 / (1 + dist / 700)), rand(-0.4, 0.4), rand(0.9, 1.1), Math.min(9, dist / 343), Math.max(500, 14000 / (1 + dist / 500)), Sound.master);
  }
  Sound.thunder3 = thunder;   // storm.js вика Sound.thunder3(dist) при city-snd3 (без да внася този модул)
  function silence() { for (const n of LOOPS) level(n, 0, 0.5); }
  return {
    thunder,
    tick(dt, c) {
      if (!Sound.ctx || !c) return;
      Sound.cs3Rain = true; curDt = dt || 1 / 60;   // sfx2.js: процедурният дъжд мълчи, щом тук има записан
      if (Sound.muted || c.onMap || !c.target || !c.camera) { silence(); return; }
      const tg = c.target, camD = c.camera.position.distanceTo(tg), night = c.night || 0, hour = c.hour ?? 12, tier = c.tier || 's', own = !!c.own, megaK = c.mega && feature('mega-sound') ? 0.7 : 1, now = Sound.ctx.currentTime;
      if (cityKey !== c.cityId) { cityKey = c.cityId; stopT = 0; stadT = 0; seaT = 0; stops = []; stads = []; waterK = 0; portXZ = null; }
      const far = 0.4 + 0.6 * clamp(1 - camD / 500);   // като градския фон: отвисоко — ~40%
      // 🌆 залез: само вечер (след обяд), когато night е 0,3–0,8; връх при 0,55
      const sunK = tier !== 's' && !own && hour >= 14 && night > 0.3 && night < 0.8 ? Math.sin(Math.PI * (night - 0.3) / 0.5) : 0;
      level('amb-sunset', V.sunset * (tier === 'm' ? 0.85 : 1) * megaK * sunK * far, 1.5);
      // 🏡 предградие: малките градове (без друг фон) и съвсем тихо — средните
      const subV = own ? 0 : tier === 's' ? V.suburbS : tier === 'm' ? V.suburbM : 0;
      level('amb-suburb', subV * (1 - 0.5 * night) * (1 - 0.6 * sunK) * far, 1.5);
      // 🎷 центърът на големия град: денем, отблизо, до ~260 м от площада
      const sq = c.square || { x: 0, z: 0 }, dSq = Math.hypot(sq.x - tg.x, sq.z - tg.z);
      const downK = (tier === 'l' || tier === 'xl') && !own ? fall(dSq, 260) * near(camD, 40, 220) * clamp(1 - night * 1.7) : 0;
      level('amb-downtown', V.downtown * megaK * downK);
      // 🚏 тълпата: спирките с чакащи (city-life3 — на 1,5 s) и площадът/пазарът денем
      if ((stopT -= dt) <= 0) { stopT = 1.5; stops = []; if (c.life && c.life.stops) for (const s of c.life.stops()) if (s.wait && s.wait.length && Math.hypot(s.x - tg.x, s.z - tg.z) < 120) stops.push(s.x, s.z, Math.min(1, 0.4 + s.wait.length / 5)); }
      let crowd = 0; for (let i = 0; i < stops.length; i += 3) crowd = Math.max(crowd, stops[i + 2] * fall(Math.hypot(stops[i] - tg.x, stops[i + 1] - tg.z), 40));
      if (c.square) crowd = Math.max(crowd, (c.market ? 1 : 0.6) * fall(dSq, 60) * clamp(1 - night * 1.5));
      level('amb-crowd', V.crowd * crowd * near(camD, 20, 160) * (1 - 0.7 * night) * (1 - 0.5 * downK));
      // 🏟️ стадионът: готовите стадиони (на 3 s); мач — в ~60% от вечерите, 15–22 ч; от време на време — възглас (гол)
      if ((stadT -= dt) <= 0) { stadT = 3; stads = []; if (c.stadiums) for (const o of c.stadiums() || []) if (o && o.visible !== false) { o.getWorldPosition(P); stads.push(P.x, P.z); } }
      const ev = hour >= 14 ? Math.floor(hour) : -1; if (ev >= 14 && evening < 14) match = Math.random() < 0.6; evening = ev;
      let st = 0; for (let i = 0; i < stads.length; i += 2) st = Math.max(st, fall(Math.hypot(stads[i] - tg.x, stads[i + 1] - tg.z), 320));
      const onK = match ? clamp((hour - 15) * 2) * clamp((22 - hour) * 2) : 0, stK = st * onK * (0.3 + 0.7 * near(camD, 60, 500));
      level('amb-stadium', V.stadium * stK, 1.2);
      if (stK > 0.05 && c.speed) { if (!cheerAt) cheerAt = now + rand(20, 50); else if (now > cheerAt) { cheerAt = now + rand(35, 100); shot('stadium-cheer', V.cheer * stK, 0, rand(0.95, 1.05)); } } else cheerAt = 0;
      // 🚲 колелата: на 0,4 s — най-близкият движещ се колоездач (не тротинетка) до 30 м; „дзън“ на 7–18 s и не всеки път
      if (c.bikes && c.speed && (bikeT -= dt) <= 0) { bikeT = 0.4;
        if (now > bellAt && camD < 140) { let best = null, bd = 30; for (const r of c.bikes.riders()) { if (r.scoot || r.v < 1) continue; const d = Math.hypot(r.x - tg.x, r.z - tg.z); if (d < bd) { bd = d; best = r; } }
          if (best && Math.random() < 0.25) { bellAt = now + rand(7, 18); shot(Math.random() < 0.5 ? 'bike-bell-1' : 'bike-bell-2', V.bell * (1 - bd / 30) * near(camD, 15, 125) * (1 - 0.4 * night), panOf(c.camera, tg, best.x, best.z), rand(0.94, 1.08)); } } }
      // 🌧️ дъждът: weather3 — heavy 0 → 0,5 (дъжд) → 1 (буря); без weather3 — по вида на времето. Навсякъде; отвисоко — до 40% по-тихо
      const w = c.weather; let amt = 0, hv = 0;
      if (w) { if (W3) { amt = clamp(2 * (w.heavy || 0)); hv = clamp(2 * (w.heavy || 0) - 1); } else { const k = w.kind; amt = k === 'storm' ? 1 : k === 'rain' ? 0.8 : 0; hv = k === 'storm' ? 1 : 0; } }
      const rk = amt * (0.6 + 0.4 * clamp(1 - (camD - 60) / 900));
      level('amb-rain-light', V.rainL * rk * Math.cos(hv * Math.PI / 2), 1.5); level('amb-rain-heavy', V.rainH * rk * Math.sin(hv * Math.PI / 2), 1.5);
      // 🌊 морето (на 2 s): колко вода има около целта (9 точки до 120 м) и къде е кеят с крановете (city.sea.port е в координатите на city.sea.group)
      if ((seaT -= dt) <= 0) { seaT = 2; waterK = 0; portXZ = null;
        if (c.seaside && c.waterAt) { let n = 0; for (const [dx, dz] of [[0, 0], [60, 0], [-60, 0], [0, 60], [0, -60], [120, 0], [-120, 0], [0, 120], [0, -120]]) if (c.waterAt(tg.x + dx, tg.z + dz)) n++; waterK = Math.min(1, n / 3); }
        const sp = c.sea && c.sea.port; if (sp) { P.set(sp.x, 0, sp.z - 30); if (c.sea.group) c.sea.group.localToWorld(P); portXZ = [P.x, P.z]; } }
      const low = near(camD, 30, 250), dayK = clamp(1.2 - night * 1.3);
      const portK = portXZ ? fall(Math.hypot(portXZ[0] - tg.x, portXZ[1] - tg.z), 220) * near(camD, 40, 400) : 0, gullK = Math.max(waterK, portK) * low * dayK;
      level('amb-gulls', V.gulls * gullK, 1.5);
      if (gullK > 0.2 && c.speed && now > gullAt) { gullAt = now + rand(6, 20); shot(Math.random() < 0.5 ? 'gull-1' : 'gull-2', V.gull * gullK, rand(-0.7, 0.7), rand(0.92, 1.1)); }
      if (portK > 0.05 && c.speed) { const pk = portK * (1 - 0.4 * night), pan = panOf(c.camera, tg, portXZ[0], portXZ[1]);
        if (!craneAt) craneAt = now + rand(3, 10); else if (now > craneAt) { craneAt = now + rand(10, 25); shot('port-crane-' + (1 + Math.floor(Math.random() * 3)), V.crane * pk, pan, rand(0.95, 1.05)); }
        if (!boxAt) boxAt = now + rand(2, 8); else if (now > boxAt) { boxAt = now + rand(8, 20); shot('port-container-' + (1 + Math.floor(Math.random() * 3)), V.box * pk, pan + rand(-0.2, 0.2), rand(0.9, 1.1)); } } else { craneAt = 0; boxAt = 0; }
      if (hv > 0.3 || (w && w.thunder)) { get('thunder-near-1'); get('thunder-near-2'); get('thunder-far-1'); get('thunder-far-2'); }   // заредени преди първата мълния
    },
    stop() { for (const n of Object.keys(L)) drop(n); Sound.cs3Rain = false; stops = []; stads = []; cityKey = null; },
  };
}
