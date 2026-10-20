// weather.js — времето в града: ясно, облачно, дъжд, буря (с мълнии), сняг, мъгла. Всеки ден се избира според сезона.
// Частиците (дъжд/сняг) следват камерата; светлината и мъглата се приглушават върху стойностите на денонощието.
// При снеговалеж земята постепенно побелява, а напролет снегът се стопява.
import * as THREE from 'three';

export const WEATHER = {
  clear:  { ico: '☀️', nm: 'Ясно',      sun: 1,    hemi: 1,    fog: 1 },
  cloudy: { ico: '☁️', nm: 'Облачно',   sun: 0.55, hemi: 0.85, fog: 0.85 },
  rain:   { ico: '🌧️', nm: 'Дъжд',      sun: 0.35, hemi: 0.7,  fog: 0.6 },
  storm:  { ico: '⛈️', nm: 'Буря',      sun: 0.2,  hemi: 0.55, fog: 0.45 },
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
  const snow = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.9 }));
  snow.frustumCulled = false; snow.visible = false; g.add(snow);

  const baseFog = deps.scene.fog ? { near: deps.scene.fog.near, far: deps.scene.fog.far } : null;
  let ground = deps.ground || null, groundBase = ground ? ground.color.clone() : null;
  const white = new THREE.Color(0xf2f5f8);
  // земята на града се създава по-късно (buildCity) — подава се тук
  function setGround(m) { ground = m; groundBase = m ? m.color.clone() : null; }
  let kind = 'clear', flash = 0, nextFlash = 3, t = 0;
  const cur = { sun: 1, hemi: 1, fog: 1 };
  let cover = 0;   // снежна покривка 0…1

  function set(k) { kind = WEATHER[k] ? k : 'clear'; rain.visible = kind === 'rain' || kind === 'storm'; snow.visible = kind === 'snow'; }
  // веднъж на ден: снегът натрупва или се топи; monthWinter = зимен месец ли е
  function dailyTick(monthWinter) {
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
    if (kind === 'storm') {
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
      for (let i = 0; i < SN; i++) { const o = i * 3; p[o + 1] -= 4 * dt; p[o] += Math.sin(t + i) * 0.6 * dt; if (p[o + 1] < 0) p[o + 1] += H; }
      sgeo.attributes.position.needsUpdate = true;
    }
    if (groundBase) ground.color.copy(groundBase).lerp(white, cover * 0.85);
  }
  return { set, update, dailyTick, setGround, setCover(c) { cover = c || 0; }, get kind() { return kind; }, get cover() { return cover; }, info: () => WEATHER[kind] };
}
