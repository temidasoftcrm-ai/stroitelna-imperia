// minimap.js — минипът на града (2D, в ъгъла на екрана) за градовете с плана v2 (истинската карта и шаблоните):
// вода, паркове, улици, кварталите по нива (заключените — притъмнени), забележителностите; отгоре — твоите обекти
// (златни; строежите мигат) и рамка на изгледа на камерата. Цъкване/влачене → onJump(x, z) — камерата отива там.
// Основата се рисува веднъж (offscreen canvas); всеки кадър — само точките и рамката (евтино).
//
//   import { createMinimap } from './minimap.js';
//   const mm = createMinimap(gp, { parent: document.body, size: 220, onJump: (x, z) => moveCameraTo(x, z) });
//   // всеки кадър (или 4–5 пъти в секунда): mm.update({ camera, target, marks: [{ x, z, kind: 'own' | 'site' | 'hq' | 'lm' }] })
//   // при отключен квартал (ново ниво): mm.setTier(t); при смяна на града: mm.dispose()
// gp — от gamePlan2 / gamePlan2Gen (рамката на играта: streets, waterAt, landmarks, anchors, offset, p2).

const TIER_C = ['#e6c35a', '#7fb2e5', '#9ad08a', '#d79ad6', '#e59a6a'];   // нива 1…5 — оцветяване на кварталите
const LM_NM = { colosseo: 'Колизеума', stpeter: 'Св. Петър', vittoriano: 'Витториано', pantheon: 'Пантеона', termini: 'Термини', hagia: 'Света София', bluemosque: 'Синята джамия',
  topkapi: 'Топкапъ', galata: 'Галата', maiden: 'Момината кула', eiffel: 'Айфеловата кула', notredame: 'Нотр Дам', arc: 'Триумфалната арка', louvre: 'Лувъра', bigben: 'Биг Бен',
  londoneye: 'Лондонското око', towerbridge: 'Тауър Бридж', shard: 'Шарда', empire: 'Емпайър Стейт', chrysler: 'Крайслер', liberty: 'Статуята на свободата', timessquare: 'Таймс Скуеър' };

export function createMinimap(gp, o = {}) {
  const S = o.size || 220, DPR = Math.min(2, window.devicePixelRatio || 1), W = Math.round(S * DPR);
  // граници: рамката на картата (истинската) или улиците + забележителностите (шаблоните), с малко поле
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  const grow = (x, z) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; };
  const SEA = gp.p2 && gp.p2.osmData && gp.p2.osmData.sea, [sox, soz] = gp.offset || [0, 0];
  if (SEA) { grow(SEA.x0 + sox, SEA.z0 + soz); grow(SEA.x0 + SEA.nx * SEA.cell + sox, SEA.z0 + SEA.nz * SEA.cell + soz); }   // истинската карта: рамката на картата (OSM улиците стърчат извън нея)
  else { for (const st of gp.streets) for (const [x, z] of st.pts) grow(x, z); for (const L of gp.landmarks || []) grow(L.x, L.z); }
  const pad = Math.max(x1 - x0, z1 - z0) * 0.04; x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
  const span = Math.max(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; x0 = cx - span / 2; z0 = cz - span / 2;
  const k = W / span, px = x => (x - x0) * k, pz = z => (z - z0) * k, wx = u => x0 + u / k, wz = v => z0 + v / k;
  const [ox, oz] = gp.offset || [0, 0], P2 = gp.p2 || {}, [cdx, cdz] = o.camOffset || [0, 0];   // camOffset — ако камерата е в рамката на плана (демото), а не на играта

  // ---- основата (веднъж)
  const base = document.createElement('canvas'); base.width = base.height = W; const b = base.getContext('2d');
  b.fillStyle = '#d9d2c3'; b.fillRect(0, 0, W, W);
  // вода: по пиксели (waterAt) — до 256×256 проби
  const N = Math.min(256, W), img = b.getImageData(0, 0, W, W), cell = W / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (gp.waterAt(wx((i + 0.5) * cell), wz((j + 0.5) * cell)))
    for (let v = Math.floor(j * cell); v < Math.floor((j + 1) * cell); v++) for (let u = Math.floor(i * cell); u < Math.floor((i + 1) * cell); u++) { const q = (v * W + u) * 4; img.data[q] = 86; img.data[q + 1] = 142; img.data[q + 2] = 196; }
  b.putImageData(img, 0, 0);
  const poly = (pts, sh) => { b.beginPath(); pts.forEach(([x, z], i) => b[i ? 'lineTo' : 'moveTo'](px(x + sh[0]), pz(z + sh[1]))); b.closePath(); };
  // паркове
  b.fillStyle = '#9cc28a'; for (const g of P2.greensSrc || P2.greens || []) if (g.poly && g.poly.length > 2) { poly(g.poly, [ox, oz]); b.fill(); }
  // улици: булевардите — по-дебели
  b.lineCap = b.lineJoin = 'round';
  for (const pass of [0, 1]) for (const st of gp.streets) { const bl = st.cls !== 'street'; if (pass !== (bl ? 1 : 0)) continue;
    b.strokeStyle = bl ? '#fffaf0' : '#f2ede4'; b.lineWidth = Math.max(bl ? 1.6 : 0.8, (st.w || 6) * k * (bl ? 1 : 0.8)); b.beginPath(); st.pts.forEach(([x, z], i) => b[i ? 'lineTo' : 'moveTo'](px(x), pz(z))); b.stroke(); }
  // кварталите (по нива) — слой отделно, за да се прерисува при ново ниво
  const dist = (P2.osmData && P2.osmData.districts) || [];
  const distLayer = document.createElement('canvas'); distLayer.width = distLayer.height = W; const dl = distLayer.getContext('2d');
  let tier = o.tier ?? 1;
  const drawDist = () => { dl.clearRect(0, 0, W, W); dl.lineWidth = Math.max(1, DPR);
    for (const d of dist) { if (!d.poly || d.poly.length < 3) continue; dl.beginPath(); d.poly.forEach(([x, z], i) => dl[i ? 'lineTo' : 'moveTo'](px(x + ox), pz(z + oz))); dl.closePath();
      const t = d.tier || 5; if (t > tier) { dl.fillStyle = 'rgba(25,28,36,0.42)'; dl.fill(); }   // заключен квартал
      dl.strokeStyle = TIER_C[Math.min(4, t - 1)] + 'aa'; dl.stroke(); } };
  drawDist();
  // забележителностите: точка + първа буква (името — в title при посочване)
  const lms = (gp.landmarks || []).map(L => ({ ...L, nm: LM_NM[L.k] || L.k }));

  // ---- елементът
  const el = document.createElement('div'); el.className = 'minimap';
  Object.assign(el.style, { position: 'absolute', right: (o.right ?? 12) + 'px', bottom: (o.bottom ?? 12) + 'px', width: S + 'px', height: S + 'px', borderRadius: '10px', overflow: 'hidden',
    boxShadow: '0 4px 18px rgba(0,0,0,0.45)', border: '2px solid rgba(255,255,255,0.75)', cursor: 'crosshair', zIndex: o.zIndex ?? 20, background: '#d9d2c3', userSelect: 'none', touchAction: 'none' });
  const cv = document.createElement('canvas'); cv.width = cv.height = W; Object.assign(cv.style, { width: S + 'px', height: S + 'px', display: 'block' }); el.appendChild(cv);
  const g = cv.getContext('2d');
  const btn = document.createElement('div'); btn.textContent = '−'; btn.title = 'Скрий/покажи минипъта';
  Object.assign(btn.style, { position: 'absolute', top: '3px', right: '5px', width: '20px', height: '20px', lineHeight: '18px', textAlign: 'center', borderRadius: '6px', background: 'rgba(20,22,27,0.7)', color: '#fff', font: 'bold 14px system-ui', cursor: 'pointer' });
  el.appendChild(btn);
  let small = false; btn.onclick = e => { e.stopPropagation(); small = !small; el.style.width = el.style.height = small ? '28px' : S + 'px'; cv.style.visibility = small ? 'hidden' : 'visible'; btn.textContent = small ? '+' : '−'; };
  (o.parent || document.body).appendChild(el);

  // цъкване/влачене → камерата там
  const at = e => { const r = cv.getBoundingClientRect(); return [wx((e.clientX - r.left) / r.width * W), wz((e.clientY - r.top) / r.height * W)]; };
  let drag = false;
  cv.addEventListener('pointerdown', e => { drag = true; cv.setPointerCapture(e.pointerId); o.onJump && o.onJump(...at(e)); });
  cv.addEventListener('pointermove', e => { if (drag && o.onJump) o.onJump(...at(e)); const [x, z] = at(e); const h = lms.find(L => Math.hypot(L.x - x, L.z - z) < 10 / k * DPR + Math.max(L.w || 0, L.d || 0) / 2); cv.title = h ? h.nm : ''; });
  cv.addEventListener('pointerup', () => { drag = false; });

  let last = null;
  function update(s = {}) {
    if (small) return; last = s;
    g.drawImage(base, 0, 0); g.drawImage(distLayer, 0, 0);
    // забележителности
    for (const L of lms) { g.fillStyle = '#7a4fb0'; g.strokeStyle = '#fff'; g.lineWidth = DPR; g.beginPath(); g.arc(px(L.x), pz(L.z), 3.2 * DPR, 0, 7); g.fill(); g.stroke(); }
    // гара / летище / магистрала (котвите)
    const A = gp.anchors || {}; g.font = `${10 * DPR}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [key, ico] of [['station', '🚉'], ['airport', '✈️'], ['highway', '🛣️']]) { const a = A[key]; if (!a) continue; const u = Math.min(W - 8 * DPR, Math.max(8 * DPR, px(a.x))), v = Math.min(W - 8 * DPR, Math.max(8 * DPR, pz(a.z))); g.fillText(ico, u, v); }
    // твоите обекти: златни; строежите — мигат (оранжеви); централата — по-голяма
    const t = performance.now() / 1000, blink = 0.55 + 0.45 * Math.sin(t * 5);
    for (const m of s.marks || []) { const u = px(m.x), v = pz(m.z), r = (m.kind === 'hq' ? 4.5 : 3) * DPR;
      g.fillStyle = m.kind === 'site' ? `rgba(255,140,40,${blink})` : m.kind === 'hq' ? '#ffd23a' : '#f4c430';
      g.shadowColor = '#ffd76a'; g.shadowBlur = 6 * DPR; g.beginPath(); g.arc(u, v, r, 0, 7); g.fill(); g.shadowBlur = 0;
      if (m.kind === 'hq') { g.strokeStyle = '#3a2a00'; g.lineWidth = DPR; g.stroke(); } }
    // изгледът на камерата: четириъгълникът, в който попадат ъглите на екрана върху земята (y = 0); иначе — кръг около target
    const cam = s.camera; let quad = null;
    if (cam && cam.isCamera && s.raycast !== false) quad = groundQuad(cam);
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.6 * DPR; g.setLineDash([]);
    if (quad) { g.beginPath(); quad.forEach(([x, z], i) => g[i ? 'lineTo' : 'moveTo'](px(x), pz(z))); g.closePath(); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill(); g.stroke(); }
    else if (s.target) { g.beginPath(); g.arc(px(s.target.x + cdx), pz(s.target.z + cdz), 6 * DPR, 0, 7); g.stroke(); }
  }
  // ъглите на екрана → земята (без three.js — чрез матриците на камерата); лъч над хоризонта — отрязан на 2 × span от камерата
  function groundQuad(cam) {
    const inv = cam.projectionMatrixInverse.elements, mw = cam.matrixWorld.elements, out = [];
    const tr = (x, y, z) => { const e = inv; let X = e[0] * x + e[4] * y + e[8] * z + e[12], Y = e[1] * x + e[5] * y + e[9] * z + e[13], Z = e[2] * x + e[6] * y + e[10] * z + e[14], Wd = e[3] * x + e[7] * y + e[11] * z + e[15]; X /= Wd; Y /= Wd; Z /= Wd;
      return [mw[0] * X + mw[4] * Y + mw[8] * Z + mw[12], mw[1] * X + mw[5] * Y + mw[9] * Z + mw[13], mw[2] * X + mw[6] * Y + mw[10] * Z + mw[14]]; };
    const c = [mw[12], mw[13], mw[14]];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = tr(sx, sy, 0.5), d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      let tt = d[1] < -1e-6 ? -c[1] / d[1] : Infinity; const L = Math.hypot(...d), maxT = span * 2 / (L || 1); if (tt > maxT) tt = maxT;
      out.push([c[0] + d[0] * tt + cdx, c[2] + d[2] * tt + cdz]); }
    return out;
  }
  return {
    el, update, bounds: { x0, z0, x1: x0 + span, z1: z0 + span },
    setTier(t) { tier = t; drawDist(); if (last) update(last); },
    dispose() { el.remove(); },
  };
}
