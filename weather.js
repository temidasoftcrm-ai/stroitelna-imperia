// weather.js — времето в града: ясно, облачно, дъжд, буря (с мълнии), сняг, мъгла. Всеки ден се избира според сезона.
// Частиците (дъжд/сняг) следват камерата; светлината и мъглата се приглушават върху стойностите на денонощието.
// При снеговалеж земята постепенно побелява, а напролет снегът се стопява.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { feature } from './lab/feature.js';
const W2 = feature('weather2');   // 🌦️ weather2 (f9): снежинки вместо квадрати; времето по календара (епизоди дъжд/сняг), детерминистично по град и ден

export const WEATHER = {
  clear:  { ico: '☀️', nm: 'Ясно',      sun: 1,    hemi: 1,    fog: 1 },
  cloudy: { ico: '☁️', nm: 'Облачно',   sun: 0.55, hemi: 0.85, fog: 0.85 },
  rain:   { ico: '🌧️', nm: 'Дъжд',      sun: 0.35, hemi: 0.7,  fog: 0.6 },
  storm:  { ico: '⛈️', nm: 'Буря',      sun: 0.2,  hemi: 0.55, fog: feature('storm-bolts') ? 0.36 : 0.45 },   // storm-bolts — по-гъста мъгла под тежкия таван
  snow:   { ico: '🌨️', nm: 'Сняг',      sun: 0.45, hemi: 0.85, fog: 0.55 },
  fog:    { ico: '🌫️', nm: 'Мъгла',     sun: 0.5,  hemi: 0.8,  fog: 0.55 },
};
// вероятности по сезон (месецът от resorts.js: 0 = януари)
export function rollWeather(month) {
  const winter = [11, 0, 1, 2].includes(month), summer = [5, 6, 7, 8].includes(month);
  const t = winter ? [['clear', 30], ['cloudy', 20], ['snow', 35], ['fog', 5]]
    : summer ? [['clear', 68], ['cloudy', 20], ['storm', 8], ['rain', 4]]
    : [['clear', 32], ['cloudy', 25], ['rain', 28], ['fog', 4], ['storm', 3]];
  let r = Math.random() * t.reduce((a, x) => a + x[1], 0);
  for (const [k, w] of t) if ((r -= w) <= 0) return k;
  return 'clear';
}

// ---- weather2: времето по календара. Детерминистично: един и същ град и игрален момент → едно и също време (и след презареждане).
// c = { id, lat, desert }; t = игрални дни (day + dayT/DAY_SEC); cycleDays = игрални дни в едно денонощие (часовникът);
// month(t) = месецът (0 = януари) за игралния ден. Дъжд: 2–3 епизода на игрален месец (30 дни) × 4–9 часа на часовника;
// лятото — понякога буря. Сняг: само декември–март (в южното полукълбо — юни–септември), никога в тропиците и пустините;
// колко често — според ширината (Атина ~0, София ~½, Москва — почти всички епизоди). Иначе — ясно/облачно по ден.
const hh = (...a) => { let h = 2166136261; for (const c of a.join('|')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
export function wx2Kind(c, t, cycleDays, month) {
  const MD = 30, mi = Math.floor((t - 1) / MD), m0 = 1 + mi * MD, south = (c.lat || 0) < 0, al = Math.abs(c.lat || 45);
  const mon = (month(Math.floor(t)) + (south ? 6 : 0)) % 12, winter = [11, 0, 1, 2].includes(mon), summer = [5, 6, 7, 8].includes(mon);
  const snowy = !c.desert && al >= 23.5 && winter ? Math.max(0, Math.min(1, (al - 38) / 12)) : 0;
  const n = c.desert ? (hh(c.id, mi, 'n') < 0.35 ? 1 : 0) : 2 + (hh(c.id, mi, 'n') < 0.5 ? 1 : 0) + (snowy > 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const st = m0 + (k + hh(c.id, mi, k, 's')) * MD / n, len = (4 + 5 * hh(c.id, mi, k, 'l')) / 24 * cycleDays;   // по един епизод в своята част от месеца
    if (t >= st && t < st + len) return hh(c.id, mi, k, 'k') < snowy ? 'snow' : summer && hh(c.id, mi, k, 'b') < 0.4 ? 'storm' : 'rain';
  }
  const d = Math.floor(t);
  return hh(c.id, d, 'c') < (winter ? 0.45 : summer ? 0.18 : 0.32) ? 'cloudy' : 'clear';
}
// каква част от игралния ден d е валяло сняг (за снежната покривка)
export function wx2SnowFrac(c, d, cycleDays, month) { let n = 0; for (let i = 0; i < 12; i++) if (wx2Kind(c, d + i / 12, cycleDays, month) === 'snow') n++; return n / 12; }
// мека кръгла точка или снежинка (шест лъча) — текстура за частиците
function flakeTex(star) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  if (!star) { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  else { g.translate(32, 32); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineCap = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 4;
    for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.lineWidth = 3.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -26); g.stroke(); g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -15); g.lineTo(-7, -21); g.moveTo(0, -15); g.lineTo(7, -21); g.stroke(); }
    const r = g.createRadialGradient(0, 0, 0, 0, 0, 7); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(-8, -8, 16, 16); }
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// deps: { scene, hemi, sun, ground?: Material (земята на града) }
export function createWeather(deps) {
  const AREA = 260, H = 90;
  const g = new THREE.Group(); deps.scene.add(g);
  // дъжд: къси вертикални чертички
  const RN = 2200, rpos = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * AREA, y = Math.random() * H, z = (Math.random() - 0.5) * AREA; rpos.set([x, y, z, x + 0.15, y - 1.6, z], i * 6); }
  const rgeo = new THREE.BufferGeometry(); rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.LineSegments(rgeo, new THREE.LineBasicMaterial({ color: 0xaecbe6, transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false; rain.visible = false; g.add(rain);
  // сняг: точки
  const SN = 3000, spos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) spos.set([(Math.random() - 0.5) * AREA, Math.random() * H, (Math.random() - 0.5) * AREA], i * 3);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const snow = new THREE.Points(sgeo, W2 ? new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, map: flakeTex(false), transparent: true, opacity: 0.95, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true })   /* weather2: меки кръгли точки (отдалеч — малки) */
    : new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.9 }));
  snow.frustumCulled = false; snow.visible = false; g.add(snow);
  // weather2: най-близките — снежинки (шест лъча) около камерата, по-едри
  const FN = W2 ? 500 : 0, fpos = new Float32Array(FN * 3), FR = 45;
  for (let i = 0; i < FN; i++) fpos.set([(Math.random() - 0.5) * FR, Math.random() * 40, (Math.random() - 0.5) * FR], i * 3);
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakes = W2 ? new THREE.Points(fgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.75, map: flakeTex(true), transparent: true, opacity: 0.95, depthWrite: false, alphaTest: 0.02, sizeAttenuation: true })) : null;
  if (flakes) { flakes.frustumCulled = false; flakes.visible = false; deps.scene.add(flakes); }

  const baseFog = deps.scene.fog ? { near: deps.scene.fog.near, far: deps.scene.fog.far } : null;
  let ground = deps.ground || null, groundBase = ground ? ground.color.clone() : null;
  const white = new THREE.Color(0xf2f5f8);
  // земята на града се създава по-късно (buildCity) — подава се тук
  function setGround(m) { ground = m; groundBase = m ? m.color.clone() : null; }
  let kind = 'clear', flash = 0, nextFlash = 3, t = 0;
  const cur = { sun: 1, hemi: 1, fog: 1 };
  let cover = 0;   // снежна покривка 0…1

  function set(k) { kind = WEATHER[k] ? k : 'clear'; rain.visible = kind === 'rain' || kind === 'storm'; snow.visible = kind === 'snow'; if (flakes) flakes.visible = snow.visible; }
  // веднъж на ден: снегът натрупва или се топи; monthWinter = зимен месец ли е
  function dailyTick(monthWinter, snowFrac) {
    if (snowFrac != null) { cover = snowFrac > 0 ? Math.min(1, cover + 0.08 + 0.5 * snowFrac) : Math.max(0, cover - (monthWinter ? 0.08 : 0.4)); return; }   // weather2: по това колко е валяло през деня
    if (kind === 'snow') cover = Math.min(1, cover + 0.35);
    else cover = Math.max(0, cover - (monthWinter ? 0.08 : 0.4));
  }
  // всеки кадър СЛЕД dayNight.update: dt в секунди, target = точката, която камерата гледа
  function update(dt, target) {
    t += dt;
    const w = WEATHER[kind], k = Math.min(1, dt * 0.8);
    cur.sun += (w.sun - cur.sun) * k; cur.hemi += (w.hemi - cur.hemi) * k; cur.fog += (w.fog - cur.fog) * k;
    deps.sun.intensity *= cur.sun;
    deps.hemi.intensity *= cur.hemi;
    const bf = (deps.fogBase && deps.fogBase()) || baseFog;   // градовете по истинската карта — мъглата по разстоянието на камерата (game.js)
    if (bf) { deps.scene.fog.near = bf.near * cur.fog; deps.scene.fog.far = bf.far * (0.35 + 0.65 * cur.fog); }
    // мълнии при буря
    if (kind === 'storm' && !feature('storm-bolts')) {   // storm-bolts: мълниите — storm.js
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 0.25; nextFlash = 3 + Math.random() * 7; }
      if (flash > 0) { flash -= dt; deps.hemi.intensity += 3 * Math.max(0, flash) / 0.25; }
    }
    g.position.set(target.x, 0, target.z);
    if (rain.visible) {
      const p = rgeo.attributes.position.array, sp = (kind === 'storm' ? 70 : 50) * dt;
      for (let i = 0; i < RN; i++) { const o = i * 6; p[o + 1] -= sp; p[o + 4] -= sp; if (p[o + 4] < 0) { p[o + 1] += H; p[o + 4] += H; } }
      rgeo.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      const p = sgeo.attributes.position.array;
      for (let i = 0; i < SN; i++) { const o = i * 3; p[o + 1] -= (W2 ? 2.6 + (i % 7) * 0.25 : 4) * dt; p[o] += Math.sin(t * (W2 ? 0.9 : 1) + i) * 0.6 * dt; if (W2) p[o + 2] += Math.cos(t * 0.7 + i * 1.3) * 0.4 * dt; if (p[o + 1] < 0) p[o + 1] += H; }   /* weather2: по-бавно, различно, люлеене и по z */
      sgeo.attributes.position.needsUpdate = true;
    }
    if (flakes && flakes.visible && deps.camera) {   // снежинките — около камерата (близо до нея), бавно се люлеят
      const c = deps.camera.position, p = fgeo.attributes.position.array; flakes.position.set(c.x, Math.max(0, c.y - 25), c.z);
      for (let i = 0; i < FN; i++) { const o = i * 3; p[o + 1] -= (1.6 + (i % 5) * 0.2) * dt; p[o] += Math.sin(t * 0.8 + i * 0.7) * 0.5 * dt; p[o + 2] += Math.cos(t * 0.6 + i) * 0.4 * dt; if (p[o + 1] < 0) p[o + 1] += 40; }
      fgeo.attributes.position.needsUpdate = true;
    }
    if (groundBase) ground.color.copy(groundBase).lerp(white, cover * 0.85);
  }
  return { rainMat: rain.material, set, update, dailyTick, setGround, setCover(c) { cover = c || 0; }, get kind() { return kind; }, get cover() { return cover; }, info: () => WEATHER[kind] };
}
