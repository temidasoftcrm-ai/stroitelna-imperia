// timessq-ads.js — Таймс Скуеър нощем: светещи екрани по двете страни на площада (както на истинския — целият в реклами).
// Рекламите са измислени (без истински марки): ярки фонове, големи надписи, сменят се на няколко секунди; бягаща лента с новини.
// Денем екраните светят по-слабо, нощем — силно (setNight). Ползва го cityplan2-3d.js (55) за парцела L на площада:
//   const ads = timesSquareAds(L, { side }); G.add(ads.group); … ads.update(t); ads.setNight(n)
// L: { x, z, w, d, rot } — площадът; side — на колко метра от оста на площада са фасадите (по подразбиране половината ширина + 4 м)
import * as THREE from 'three';

const WORDS = ['BROADWAY', 'LIVE!', 'NEW YORK', 'SHOW', 'MUSIC', 'NEWS 24', 'SALE', 'CINEMA', 'TONIGHT', 'SODA', 'PHONE X', 'JEANS', 'DANCE', 'COMEDY', 'HOTEL', 'TAXI'];
const COLS = [['#ff2d55', '#ffd60a'], ['#0a84ff', '#64d2ff'], ['#30d158', '#ffffff'], ['#bf5af2', '#ff9f0a'], ['#ff9f0a', '#1c1c1e'], ['#ffffff', '#ff375f'], ['#5e5ce6', '#ffd60a'], ['#ff453a', '#ffffff']];

let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// една реклама — платно 256×192: фон с преливане, голям надпис, малък подзаглавен ред
function adCanvas(i) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  const [a, b] = COLS[i % COLS.length], gr = g.createLinearGradient(0, 0, 256, 192); gr.addColorStop(0, a); gr.addColorStop(1, b);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 5; k++) g.fillRect(rnd() * 256, rnd() * 192, 20 + rnd() * 80, 6 + rnd() * 20);   // форми
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 6; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = WORDS[i % WORDS.length]; g.font = `900 ${w.length > 7 ? 40 : 56}px system-ui, sans-serif`; g.strokeText(w, 128, 88); g.fillText(w, 128, 88);
  g.font = '700 20px system-ui, sans-serif'; g.fillText(['★ NOW ★', 'TIMES SQ', 'ONLY TODAY', 'NEW!'][i % 4], 128, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// бягащата лента: дълъг ред с новини, повтаря се (offset се мести)
function tickerCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 1024, 64); g.fillStyle = '#ffd60a'; g.font = '800 40px system-ui, sans-serif'; g.textBaseline = 'middle';
  g.fillText('  ★ BREAKING: NEW YORK NEVER SLEEPS ★ SHOWS TONIGHT ★ WEATHER 18°C ★ STOCKS ↑ ★ ', 0, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function timesSquareAds(L, o = {}) {
  seed = 7; const g = new THREE.Group(), screens = [], tickers = [], mats = [];
  const ads = Array.from({ length: 12 }, (_, i) => adCanvas(i)), tk = tickerCanvas();
  const long = L.d >= L.w, half = (long ? L.d : L.w) / 2, side = o.side ?? ((long ? L.w : L.d) / 2 + 4), c = Math.cos(L.rot), sn = Math.sin(L.rot);
  const at = (lx, lz) => [L.x + lx * c + lz * sn, L.z - lx * sn + lz * c];   // от координатите на площада (lx напреки, lz по дължината) към света
  for (const u of [-1, 1]) for (let k = 0; k < 9; k++) {   // по 9 екрана от всяка страна, на 3 етажа височина
    const v = (-0.85 + k % 3 * 0.85) * half * 0.9, row = Math.floor(k / 3), w = 9 + rnd() * 6, h = w * 0.72, y = 7 + row * 12 + rnd() * 3;
    const mt = new THREE.MeshBasicMaterial({ map: ads[(k + (u > 0 ? 5 : 0)) % ads.length], toneMapped: false }); mats.push(mt);
    const sd = side - 0.4, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mt), [x, z] = at(long ? u * sd : v, long ? v : u * sd), [tx, tz] = at(long ? 0 : v, long ? v : 0);
    m.position.set(x, y, z); m.lookAt(tx, y, tz); g.add(m);   // лицето — право напреки към оста на площада screens.push({ mt, i: k * 3 + (u > 0 ? 1 : 0), ph: rnd() * 6 });
  }
  for (const u of [-1, 1]) {   // бягащата лента — по цялата дължина, ниско над входовете
    const mt = new THREE.MeshBasicMaterial({ map: tk.clone(), toneMapped: false }); mt.map.repeat.set(2, 1); mats.push(mt);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(half * 1.8, 2.2), mt), [x, z] = at(long ? u * (side - 0.5) : 0, long ? 0 : u * (side - 0.5));
    m.position.set(x, 4.5, z); m.lookAt(L.x, 4.5, L.z); g.add(m); tickers.push(mt);   // лентата е в средата на страната — центърът е право напреки
  }
  return {
    group: g,
    update(t) {   // смяна на рекламите (всяка в свой момент) и бягащата лента
      for (const s of screens) { const n = Math.floor(t / 4 + s.ph) + s.i; s.mt.map = ads[n % ads.length]; }
      for (const mt of tickers) mt.map.offset.x = (t * 0.08) % 1;
    },
    setNight(n) { const k = 0.45 + 0.75 * Math.max(0, Math.min(1, n)); for (const mt of mats) mt.color.setScalar(k); },   // денем — по-бледо, нощем — ярко
    dispose() { for (const mt of mats) mt.dispose(); for (const a of ads) a.dispose(); tk.dispose(); g.traverse(m => m.geometry && m.geometry.dispose()); },
  };
}
