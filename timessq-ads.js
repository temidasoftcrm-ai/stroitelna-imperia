// timessq-ads.js — Таймс Скуеър нощем: светещи екрани по двете страни на площада (както на истинския — целият в реклами).
// Рекламите са измислени (без истински марки): ярки фонове, големи надписи, сменят се на няколко секунди; бягаща лента с новини.
// Денем екраните светят по-слабо, нощем — силно (setNight). Ползва го cityplan2-3d.js (55) за парцела L на площада:
//   const ads = timesSquareAds(L, { side }); G.add(ads.group); … ads.update(t); ads.setNight(n)
// L: { x, z, w, d, rot } — площадът; side — на колко метра от оста на площада са фасадите (по подразбиране половината ширина + 4 м)
import * as THREE from 'three';

const WORDS = ['BROADWAY', 'LIVE!', 'NEW YORK', 'SHOW', 'MUSIC', 'NEWS 24', 'SALE', 'CINEMA', 'TONIGHT', 'SODA', 'PHONE X', 'JEANS', 'DANCE', 'COMEDY', 'HOTEL', 'TAXI'];
const COLS = [['#ff2d55', '#ffd60a'], ['#0a84ff', '#64d2ff'], ['#30d158', '#ffffff'], ['#bf5af2', '#ff9f0a'], ['#ff9f0a', '#1c1c1e'], ['#ffffff', '#ff375f'], ['#5e5ce6', '#ffd60a'], ['#ff453a', '#ffffff']];

let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// всички реклами в едно платно (атлас 4×3 по 256×192) — една текстура за всички екрани; i-тата реклама е в клетка (i % 4, i / 4)
const AC = 4, AR = 3;
function adAtlas() {
  const c = document.createElement('canvas'); c.width = 256 * AC; c.height = 192 * AR; const g = c.getContext('2d');
  for (let i = 0; i < AC * AR; i++) { const ox = (i % AC) * 256, oy = Math.floor(i / AC) * 192; g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, 256, 192); g.clip();
    const [a, b] = COLS[i % COLS.length], gr = g.createLinearGradient(0, 0, 256, 192); gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 5; k++) g.fillRect(rnd() * 256, rnd() * 192, 20 + rnd() * 80, 6 + rnd() * 20);   // форми
    g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 6; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = WORDS[i % WORDS.length]; g.font = `900 ${w.length > 7 ? 40 : 56}px system-ui, sans-serif`; g.strokeText(w, 128, 88); g.fillText(w, 128, 88);
    g.font = '700 20px system-ui, sans-serif'; g.fillText(['★ NOW ★', 'TIMES SQ', 'ONLY TODAY', 'NEW!'][i % 4], 128, 150); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// бягащата лента: дълъг ред с новини, повтаря се (offset се мести)
function tickerCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#ffd60a'; g.font = '800 40px system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText('  ★ BREAKING: NEW YORK NEVER SLEEPS ★ SHOWS TONIGHT ★ WEATHER 18°C ★ STOCKS ↑ ★ ', 0, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

// 2 draw calls: всички екрани — една слята геометрия с атласа (смяната на реклама = нови uv на 4-те върха, най-много 2 пъти в секунда);
// двете бягащи ленти — една геометрия с обща текстура (мести се offset)
export function timesSquareAds(L, o = {}) {
  seed = 7; const g = new THREE.Group(), screens = [];
  const atlas = adAtlas(), tk = tickerCanvas();
  const long = L.d >= L.w, half = (long ? L.d : L.w) / 2, side = o.side ?? ((long ? L.w : L.d) / 2 + 4), c = Math.cos(L.rot), sn = Math.sin(L.rot);
  const at = (lx, lz) => [L.x + lx * c + lz * sn, L.z - lx * sn + lz * c];   // от координатите на площада (lx напреки, lz по дължината) към света
  // четириъгълник с лице към оста на площада: център (x, y, z), посока към оста (nx, nz), ширина w, височина h
  const quad = (pos, x, y, z, nx, nz, w, h) => { const tx = -nz, tz = nx; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pos.push(x + tx * a * w / 2, y + b * h / 2, z + tz * a * w / 2); };
  const P1 = [], P2 = [], U2 = [];
  // екраните — по фасадите на 4-те сгради с билбордове (timesSquareView: по ±0,55 от дължината, ~30 м широки): 3 колони × 3 етажа на сграда
  for (const u of [-1, 1]) for (const vb of [-0.55, 0.55]) for (let k = 0; k < 9; k++) {
    const v = vb * half + (k % 3 - 1) * 9.5, row = Math.floor(k / 3), w = 7.5 + rnd() * 1.5, h = w * 0.72, y = 9 + row * 8 + rnd() * 1.5, sd = side - 0.4;
    const [x, z] = at(long ? u * sd : v, long ? v : u * sd), [tx, tz] = at(long ? 0 : v, long ? v : 0), l = Math.hypot(tx - x, tz - z) || 1;
    quad(P1, x, y, z, (tx - x) / l, (tz - z) / l, w, h); screens.push({ i: k * 3 + (u > 0 ? 1 : 0) + (vb > 0 ? 5 : 0), ph: rnd() * 6, cur: -1 });
  }
  for (const u of [-1, 1]) for (const vb of [-0.55, 0.55]) {   // бягащата лента — по фасадата на всяка сграда, ниско над входовете (не над улиците)
    const v = vb * half, [x, z] = at(long ? u * (side - 0.5) : v, long ? v : u * (side - 0.5)), [tx, tz] = at(long ? 0 : v, long ? v : 0), l = Math.hypot(tx - x, tz - z) || 1;
    quad(P2, x, 5, z, (tx - x) / l, (tz - z) / l, 28, 2.2); U2.push(0, 0, 1, 0, 1, 1, 0, 1);
  }
  const idx = n => { const a = []; for (let q = 0; q < n; q++) a.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3); return a; };
  const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(P1, 3)); g1.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(P1.length / 3 * 2), 2)); g1.setIndex(idx(screens.length));
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); g2.setIndex(idx(4));
  const m1 = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false, side: THREE.FrontSide }), m2 = new THREE.MeshBasicMaterial({ map: tk, toneMapped: false, side: THREE.FrontSide }), mats = [m1, m2];
  const S1 = new THREE.Mesh(g1, m1), S2 = new THREE.Mesh(g2, m2); for (const m of [S1, S2]) { m.frustumCulled = false; m.matrixAutoUpdate = false; m.updateMatrix(); g.add(m); }
  const uv = g1.attributes.uv, setAd = (q, n) => { const i = n % (AC * AR), u0 = (i % AC) / AC, u1 = u0 + 1 / AC, v1 = 1 - Math.floor(i / AC) / AR, v0 = v1 - 1 / AR; uv.setXY(q * 4, u0, v0); uv.setXY(q * 4 + 1, u1, v0); uv.setXY(q * 4 + 2, u1, v1); uv.setXY(q * 4 + 3, u0, v1); };
  let lastT = -1;
  const api = {
    group: g,
    update(t) {   // смяна на рекламите (всяка в свой момент) — най-много 2 пъти в секунда; лентата тече всеки кадър (само offset)
      tk.offset.x = (t * 0.08) % 1;
      if (t - lastT < 0.5 && lastT >= 0) return; lastT = t; let ch = false;
      screens.forEach((s, q) => { const n = Math.floor(t / 4 + s.ph) + s.i; if (n !== s.cur) { s.cur = n; setAd(q, n); ch = true; } });
      if (ch) uv.needsUpdate = true;
    },
    setNight(n) { const k = 0.45 + 0.75 * Math.max(0, Math.min(1, n)); for (const mt of mats) mt.color.setScalar(k); },   // денем — по-бледо, нощем — ярко
    dispose() { for (const mt of mats) mt.dispose(); atlas.dispose(); tk.dispose(); g1.dispose(); g2.dispose(); },
  };
  api.update(0); return api;
}
