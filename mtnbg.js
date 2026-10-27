// ⛰️ mtnbg.js — mtn-backdrop (T2; потребителят: „от магистралата към Пловдив хоризонтът е равен“): силуетите на истинските планини на хоризонта.
// Един пръстен около камерата (следва я, на ~0,9 от camera.far): височината на всяка посока = истинският ъгъл, под който се вижда планината
// от града — atan((връх − надм. височина на града) / разстояние), — така Витоша (2290 м, 12 км) е висока, а Стара планина (30 км) — ниска и синкава.
// Без мъгла на сцената: цветът се смята от цвета на мъглата (въздушна перспектива — далечното е по-бледо); снегът — над снежната линия по сезона;
// нощем — тъмен силует и няколко светлини по склоновете (+ червената на кулата на Копитото). Без сенки, 2 мрежи + 1 точки.
//   createMtnBg(parent) → { build(cityId, { month }), update(camera, fogColor), setMonth(m), clear() }
import * as THREE from 'three';

// град → [надм. височина на града, [посока ° (0 = север, 90 = изток), ширина °, връх м, било м, разстояние км, име, { peakAt, lights, tower }]…]
export const MTN_BG = {
  sofia: [550, [[205, 46, 2290, 1750, 13, 'Витоша', { peakAt: -0.15, lights: 7, tower: [0.25, 1345] }], [262, 22, 1256, 1000, 11, 'Люлин'], [0, 110, 2050, 1600, 32, 'Стара планина'], [140, 40, 1530, 1150, 25, 'Плана']]],
  pernik: [700, [[115, 50, 2290, 1750, 15, 'Витоша', { peakAt: 0.2, lights: 5 }], [300, 70, 1500, 1100, 15, 'Голо бърдо']]],
  plovdiv: [160, [[185, 110, 1900, 1450, 25, 'Родопите', { lights: 8 }], [355, 80, 2376, 1900, 55, 'Стара планина'], [260, 40, 1650, 1300, 45, 'Сърнена гора / Родопите']]],
  pazardzhik: [210, [[200, 100, 1900, 1450, 15, 'Родопите', { lights: 6 }], [280, 40, 2925, 2300, 45, 'Рила'], [10, 60, 1600, 1250, 30, 'Средна гора']]],
  blg: [360, [[80, 70, 2925, 2400, 22, 'Рила', { lights: 5 }], [155, 50, 2914, 2400, 40, 'Пирин'], [265, 50, 1800, 1400, 20, 'Влахина']]],
  gabrovo: [390, [[180, 140, 1600, 1350, 10, 'Стара планина', { lights: 7 }]]],
  vt: [210, [[185, 130, 2100, 1600, 38, 'Стара планина', { lights: 6 }]]],
  sliven: [250, [[355, 110, 1180, 950, 6, 'Сините камъни', { lights: 6 }]]],
  vratsa: [380, [[220, 90, 1480, 1200, 6, 'Врачанска планина', { lights: 5 }]]],
  montana: [140, [[190, 90, 2168, 1700, 40, 'Стара планина']]],
  kardzhali: [240, [[210, 140, 1450, 1050, 20, 'Родопите', { lights: 6 }]]],
  haskovo: [220, [[205, 90, 1300, 950, 30, 'Родопите']]],
  stz: [200, [[350, 100, 1500, 1150, 18, 'Средна гора / Стара планина', { lights: 5 }]]],
  skopje: [240, [[185, 70, 1066, 850, 5, 'Водно', { lights: 6, tower: [0.1, 1066] }], [260, 50, 2747, 2200, 45, 'Шар планина'], [20, 60, 1300, 1000, 15, 'Скопска Църна гора']]],
  nis: [200, [[125, 60, 1810, 1400, 22, 'Сува планина', { lights: 4 }], [40, 60, 1000, 800, 15, 'Сврлишки планини']]],
  thessaloniki: [20, [[100, 40, 1201, 900, 12, 'Хортиатис', { lights: 5 }], [235, 14, 2918, 2400, 80, 'Олимп']]],
  athens: [70, [[350, 40, 1413, 1100, 20, 'Парнита', { lights: 5 }], [95, 40, 1026, 850, 9, 'Химет', { lights: 6 }], [30, 25, 1109, 900, 16, 'Пендели']]],
  munich: [520, [[180, 120, 2962, 2300, 75, 'Алпите']]],
  zurich: [410, [[150, 120, 3238, 2500, 65, 'Алпите'], [260, 30, 871, 800, 6, 'Ютлиберг', { lights: 4 }]]],
  milan: [120, [[350, 150, 4000, 2800, 85, 'Алпите'], [285, 25, 4634, 3800, 90, 'Монте Роза']]],
  vienna: [190, [[285, 70, 890, 650, 15, 'Виенската гора', { lights: 6 }]]],
  barcelona: [10, [[300, 80, 512, 420, 6, 'Тибидабо', { lights: 6, tower: [0.1, 512] }], [330, 30, 1236, 1000, 50, 'Монсени']]],
  madrid: [650, [[330, 90, 2428, 1900, 50, 'Гуадарама']]],
  rome: [20, [[80, 60, 1271, 1000, 30, 'Тибуртинските планини'], [130, 40, 949, 800, 22, 'Албанските хълмове', { lights: 5 }]]],
  istanbul: [40, []],
  losangeles: [90, [[10, 120, 3068, 1800, 35, 'Сан Габриел', { lights: 5 }], [330, 50, 1000, 700, 15, 'Санта Моника']]],
  rio: [10, [[260, 70, 1021, 700, 8, 'Тижука', { lights: 8 }]]],
  capetown: [20, [[190, 50, 1085, 1000, 4, 'Тейбъл Маунтин', { lights: 3 }]]],
  tokyo: [40, [[250, 10, 3776, 2800, 100, 'Фуджи'], [285, 60, 2000, 1500, 70, 'Окутама']]],
};

const RES = 720, U0 = { uFog: { value: new THREE.Color() }, uRock: { value: new THREE.Color() }, uSnowLine: { value: 2400 }, uDay: { value: 1 }, uElev: { value: 0 } };
const VERT = `attribute float aT; attribute float aAlt; attribute float aHaze; uniform float uElev; varying float vT; varying float vAlt; varying float vHaze; varying float vX;
void main() { vT = position.y; vAlt = aAlt; vHaze = aHaze; vX = position.x * 37.0 + position.z * 23.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `uniform vec3 uFog; uniform vec3 uRock; uniform float uSnowLine; uniform float uDay; varying float vT; varying float vAlt; varying float vHaze; varying float vX;
uniform float uElev;
void main() {
  float y = vT, t = clamp(y / 0.06, 0.0, 1.0), alt = uElev + max(y, 0.0) * vAlt;
  float k = vHaze * smoothstep(0.0, 0.85, t);
  vec3 c = mix(uFog, uRock, k);
  float n = sin(vX * 3.1) * 45.0 + sin(vX * 7.7) * 25.0;
  float s = smoothstep(uSnowLine - 120.0, uSnowLine + 220.0, alt + n) * (0.55 + 0.45 * smoothstep(0.4, 1.0, t));
  vec3 snow = mix(mix(uFog, vec3(0.93, 0.95, 0.98), 0.35 + 0.4 * vHaze), uRock * 1.35, 1.0 - uDay);
  c = mix(c, snow, s * 0.85 * smoothstep(0.02, 0.2, t));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
// детерминиран шум за билото
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
function ridgeNoise(seed) { const ph = Array.from({ length: 6 }, (_, i) => ((seed >>> (i * 4)) & 255) / 255 * 6.283); return u => 0.5 + 0.22 * Math.sin(u * 9 + ph[0]) + 0.14 * Math.sin(u * 23 + ph[1]) + 0.08 * Math.sin(u * 51 + ph[2]) + 0.05 * Math.sin(u * 97 + ph[3]); }

const SNOW_M = [1100, 1200, 1400, 1800, 2200, 2600, 2900, 3000, 2700, 2200, 1700, 1300];
const setMonth = m => { U0.uSnowLine.value = SNOW_M[((m % 12) + 12) % 12]; };
export function createMtnBg(parent) {
  let G = null, lights = null, tower = null, R0 = 1;
  function clear() { if (!G) return; G.parent && G.parent.remove(G); G.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); G = null; lights = null; tower = null; }
  function build(cityId, { month = 6 } = {}) {
    clear(); const T = MTN_BG[cityId]; if (!T || !T[1].length) return false;
    const [elev, ranges] = T; U0.uElev.value = elev; G = new THREE.Group(); G.name = 'mtn-backdrop';   /* без G.renderOrder: при групата той става groupOrder и пръстенът се рисуваше ПРЕДИ купола на небето (sky-sun) — небето го покриваше */
    // снежната линия по сезона (м): зимата — ниско, лятото — само по най-високите
    setMonth(month);
    const layers = [{ near: true, r: 0.94, haze: 0.62 }, { near: false, r: 1, haze: 0.4 }], pts = [], tw = [];
    for (const L of layers) {
      const rs = ranges.filter(r => (r[4] <= 25) === L.near); if (!rs.length) continue;
      const pos = [], aT = [], aAlt = [], aH = [], idx = [];
      for (let i = 0; i <= RES; i++) {
        const az = i / RES * 360; let ang = 0, alt = elev, dk = rs[0][4];
        for (const [c, w, peak, ridge, d, nm, o = {}] of rs) {
          let du = ((az - c + 540) % 360) - 180; const u = du / (w / 2); if (Math.abs(u) > 1.25) continue;
          const nz = ridgeNoise(hash(cityId + nm)), env = Math.pow(Math.max(0, Math.cos(Math.min(1.25, Math.abs(u)) / 1.25 * Math.PI / 2)), 0.7);
          const pk = Math.exp(-Math.pow((u - (o.peakAt || 0)) / 0.22, 2)), hM = (ridge - elev) * env * (0.7 + 0.6 * (nz(u) - 0.5)) + (peak - ridge) * pk * env;
          const a = Math.atan(Math.max(0, hM) / (d * 1000)); if (a > ang) { ang = a; alt = elev + Math.max(0, hM); dk = d; }
        }
        const th = az * Math.PI / 180, x = Math.sin(th) * L.r, z = -Math.cos(th) * L.r, y = Math.tan(ang) * L.r;   // север = −z
        const mpu = dk * 1000 / L.r; pos.push(x, -0.03 * L.r, z, x, y, z); aT.push(0, 1); aAlt.push(mpu, mpu); aH.push(L.haze, L.haze);
        if (i < RES) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
      g.setAttribute('aAlt', new THREE.Float32BufferAttribute(aAlt, 1)); g.setAttribute('aHaze', new THREE.Float32BufferAttribute(aH, 1)); g.setIndex(idx);
      const m = new THREE.ShaderMaterial({ uniforms: U0, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: false, depthWrite: true });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = -5; G.add(mesh);
      // нощем: светлините на селата по склоновете (до 1/3 от височината) и кулата
      for (const [c, w, peak, ridge, d, nm, o = {}] of rs) {
        const rnd = (n => () => (n = Math.imul(n ^ (n >>> 15), 2246822507) >>> 0, n / 4294967296))(hash(nm + cityId));
        for (let k = 0; k < (o.lights || 0); k++) { const az = (c + (rnd() - 0.5) * w * 0.8) * Math.PI / 180, hh = Math.atan((ridge - elev) * (0.08 + 0.25 * rnd()) / (d * 1000)), r = L.r * 0.995;
          pts.push(Math.sin(az) * r, Math.tan(hh) * r, -Math.cos(az) * r); }
        if (o.tower) { const az = (c + o.tower[0] * w / 2) * Math.PI / 180, r = L.r * 0.995, hh = Math.atan((o.tower[1] - elev) / (d * 1000)); tw.push(Math.sin(az) * r, Math.tan(hh) * r + 0.004, -Math.cos(az) * r); }
      }
    }
    if (pts.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      lights = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffd9a0, size: 2.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); lights.frustumCulled = false; lights.renderOrder = -4; G.add(lights); }
    if (tw.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tw, 3));
      tower = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff2a1a, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); tower.frustumCulled = false; tower.renderOrder = -4; G.add(tower); }
    parent.add(G); return true;
  }
  const ROCK = new THREE.Color(0x56657a), tmp = new THREE.Color();
  // всеки кадър: пръстенът — около камерата, на 0,9 от далечината; цветовете — от мъглата (денем синкаво-сиво, нощем — малко по-тъмно от небето)
  function update(camera, fogColor) {
    if (!G) return; const R = camera.far * 0.9; G.position.set(camera.position.x, 0, camera.position.z); G.scale.setScalar(R / R0);
    const f = fogColor || tmp.set(0xbcd9ee), lum = 0.3 * f.r + 0.59 * f.g + 0.11 * f.b, day = Math.min(1, Math.max(0, (lum - 0.12) / 0.5));
    U0.uFog.value.copy(f); U0.uRock.value.copy(f).multiplyScalar(0.55).lerp(ROCK, day * day * 0.9); U0.uDay.value = day;
    const night = 1 - Math.min(1, Math.max(0, (lum - 0.08) / 0.25));
    if (lights) lights.material.opacity = night * 0.95;
    if (tower) tower.material.opacity = night * (Math.sin(performance.now() / 380) > 0 ? 1 : 0.15);
  }
  return { build, update, clear, setMonth, info: () => ({ on: !!G, lights: lights ? lights.geometry.attributes.position.count : 0 }) };
}
