// perfpanel.js — ⏱️ панел за производителност (флаг perf-panel, F8): FPS и време на кадъра (ср./p95/макс. за 5 s),
// къде отива времето (симулация / край на деня / подготовка / рисуване), draw calls и триъгълници, заредени модели,
// геометрии и текстури, JS памет, оценка на паметта за текстури и геометрия, файлове и свалени MB, активни заявки.
// Отметките в game.js frame(): perf.frame() в началото, perf.lap('sim') след симулацията, perf.lap('prep') преди
// renderer.render, perf.lap('render') след него; endOfDay — perf.add('day', t0). Без панела струват ~нищо.
// За сравнение преди/след (2a, 55): window.__perf.snap() → { readyS, lastFileS, files, dlMB, models, texMB, geoMB, calls, tris, heapMB, fps, p95 }
const now = () => performance.now();
try { performance.setResourceTimingBufferSize(20000); } catch { }   // иначе браузърът пази само 250 файла

// заявките в момента (fetch — GLTFLoader/FileLoader минават оттам)
let active = 0, fetched = 0;
if (typeof window !== 'undefined' && window.fetch && !window.fetch.__perf) {
  const f0 = window.fetch.bind(window);
  const f = (...a) => { active++; fetched++; return f0(...a).finally(() => { active--; }); };
  f.__perf = true; window.fetch = f;
}

const WIN = 5000, LABELS = { sim: 'симулация', day: 'край на деня', prep: 'подготовка', render: 'рисуване' };
const frames = [];   // { t, dt, sim, day, prep, render }
let cur = null, lapT = 0, readyAt = 0;
export const perf = {
  frame() { const t = now(); if (cur) { cur.dt = t - cur.t; frames.push(cur); } while (frames.length && t - frames[0].t > WIN) frames.shift(); cur = { t, dt: 0, sim: 0, day: 0, prep: 0, render: 0 }; lapT = t; },
  lap(k) { if (!cur) return; const t = now(); cur[k] = (cur[k] || 0) + t - lapT; lapT = t; },
  add(k, t0) { if (cur) cur[k] = (cur[k] || 0) + now() - t0; },
  now,
  ready() { if (!readyAt) readyAt = now(); },   // „Готово!“ — началният екран изчезва
  stats() {
    const L = frames.filter(f => f.dt > 0), n = L.length; if (!n) return null;
    const ds = L.map(f => f.dt).sort((a, b) => a - b), sum = ds.reduce((a, b) => a + b, 0), avg = k => L.reduce((a, f) => a + (f[k] || 0), 0) / n;
    return { fps: n / (sum / 1000), avg: sum / n, p95: ds[Math.min(n - 1, Math.floor(n * 0.95))], max: ds[n - 1], sim: Math.max(0, avg('sim') - avg('day')), day: avg('day'), prep: avg('prep'), render: avg('render'), dayMax: Math.max(...L.map(f => f.day || 0)) };
  },
  files() {
    const R = performance.getEntriesByType('resource');
    let b = 0, last = 0; for (const e of R) { b += e.transferSize || e.encodedBodySize || 0; if (e.responseEnd > last) last = e.responseEnd; }
    return { files: R.length, dlMB: b / 2 ** 20, lastFileS: last / 1000, active, fetched };
  },
};
if (typeof window !== 'undefined') window.__perf = perf;

// оценка на паметта на заредените модели (A): текстури декодирани (ш × в × 4 × 1,33 с мипмапи) и геометрия (буферите)
function assetMem(A) {
  const seenT = new Set(), seenG = new Set(); let t = 0, g = 0, models = 0;
  for (const v of Object.values(A || {})) { const sc = v && (v.scene || v); if (!sc || !sc.traverse) continue; models++;
    sc.traverse(o => {
      if (o.geometry && !seenG.has(o.geometry)) { seenG.add(o.geometry); for (const at of Object.values(o.geometry.attributes || {})) g += at.array?.byteLength || 0; if (o.geometry.index) g += o.geometry.index.array.byteLength; }
      for (const m of [].concat(o.material || [])) for (const q in m) { const x = m[q]; if (x && x.isTexture && x.image && x.image.width && !seenT.has(x.source || x)) { seenT.add(x.source || x); t += x.image.width * x.image.height * 4 * (x.generateMipmaps !== false ? 1.33 : 1); } }
    }); }
  return { models, texMB: t / 2 ** 20, geoMB: g / 2 ** 20 };
}

// deps: { renderer, A() → речникът с моделите, THREE? (за THREE.Cache), loads?() → { active, queued, cacheMB } (lazy-assets, ако има) }
export function createPerfPanel(deps) {
  let el = null, timer = 0, memT = 0, mem = { models: 0, texMB: 0, geoMB: 0 };
  const heap = () => performance.memory ? performance.memory.usedJSHeapSize / 2 ** 20 : null;
  const f1 = x => x == null ? 'недостъпно' : x.toFixed(1), f0 = x => Math.round(x).toLocaleString('bg-BG');
  function snap() {
    if (now() - memT > 5000 || !memT) { memT = now(); try { mem = assetMem(deps.A()); } catch { } }
    const r = deps.renderer, i = r && r.info, s = perf.stats() || {}, fl = perf.files(), h = heap();
    return { readyS: readyAt ? +(readyAt / 1000).toFixed(1) : null, lastFileS: +fl.lastFileS.toFixed(1), files: fl.files, dlMB: Math.round(fl.dlMB), active: fl.active,
      models: mem.models, texMB: Math.round(mem.texMB), geoMB: Math.round(mem.geoMB), gpuGeo: i?.memory.geometries, gpuTex: i?.memory.textures, progs: i?.programs?.length,
      calls: i?.render.calls, tris: i?.render.triangles, heapMB: h == null ? null : Math.round(h), fps: s.fps ? +s.fps.toFixed(1) : null, p95: s.p95 ? +s.p95.toFixed(1) : null };
  }
  perf.snap = snap; perf.renderer = deps.renderer;   // за опити от конзолата (сенки, pixel ratio)
  function paint() {
    if (!el) return;
    const s = perf.stats(), x = snap(), ld = deps.loads ? (() => { try { return deps.loads(); } catch { return null; } })() : null;
    const cache = deps.THREE?.Cache?.enabled ? Object.keys(deps.THREE.Cache.files || {}).length : null;
    const row = (a, b, c = '') => `<div><span>${a}</span><b>${b}</b>${c ? `<i>${c}</i>` : ''}</div>`;
    const bar = s ? (() => { const tot = Math.max(1e-6, s.sim + s.day + s.prep + s.render); return `<div class="pp-bar">${['sim', 'day', 'prep', 'render'].map((k, j) => `<u style="width:${(s[k] / tot * 100).toFixed(1)}%;background:${['#4aa3ff', '#ffb84a', '#a07dff', '#43d17a'][j]}" title="${LABELS[k]}"></u>`).join('')}</div>`; })() : '';
    el.innerHTML = `<h4>⏱️ Производителност <small>F8</small></h4>`
      + (s ? row('FPS', s.fps.toFixed(0), `кадър ${s.avg.toFixed(1)} · p95 ${s.p95.toFixed(1)} · макс ${s.max.toFixed(0)} ms`)
        + bar + row('🔵 симулация', s.sim.toFixed(2) + ' ms') + row('🟠 край на деня', s.day.toFixed(2) + ' ms', `най-много ${s.dayMax.toFixed(0)} ms`) + row('🟣 подготовка', s.prep.toFixed(2) + ' ms') + row('🟢 рисуване', s.render.toFixed(2) + ' ms')
        : '<div>няма кадри (картата или 3D зала)</div>')
      + row('draw calls', x.calls != null ? f0(x.calls) : '—') + row('триъгълници', x.tris != null ? (x.tris / 1e6).toFixed(2) + ' млн.' : '—')
      + row('модели (A)', x.models) + row('GPU геометрии / текстури', `${x.gpuGeo ?? '—'} / ${x.gpuTex ?? '—'}`, `шейдъри ${x.progs ?? '—'}`)
      + row('JS памет', x.heapMB == null ? 'недостъпно' : f0(x.heapMB) + ' MB') + row('текстури + геометрия', `${f0(x.texMB)} + ${f0(x.geoMB)} MB`, 'оценка')
      + row('файлове / свалени', `${x.files} / ${f0(x.dlMB)} MB`, `последен на ${f1(x.lastFileS)} s${x.readyS != null ? ` · готово на ${x.readyS} s` : ''}`)
      + row('заявки сега', x.active, ld ? `опашка ${ld.queued ?? '—'} · кеш ${ld.cacheMB != null ? f0(ld.cacheMB) + ' MB' : '—'}` : cache != null ? `THREE.Cache ${cache}` : '');
  }
  function show(on) {
    if (on && !el) {
      if (!document.getElementById('ppCss')) { const c = document.createElement('style'); c.id = 'ppCss'; c.textContent = `#perfPanel { position:fixed; left:8px; top:56px; z-index:9000; width:290px; padding:8px 10px; border-radius:10px; background:#0b0f16e8; color:#dfe6ee; font:11px/1.45 ui-monospace,monospace; pointer-events:none; box-shadow:0 4px 18px #0008 }
#perfPanel h4 { margin:0 0 4px; font:700 12px system-ui; color:#ffd54a } #perfPanel h4 small { color:#8893a0; font-weight:400 } #perfPanel div { display:flex; flex-wrap:wrap; gap:0 6px; align-items:baseline } #perfPanel span { flex:1; color:#9aa4b0 } #perfPanel i { flex-basis:100%; font-style:normal; color:#8893a0; font-size:10px; padding-left:10px; margin-top:-2px }
#perfPanel .pp-bar { height:6px; border-radius:3px; overflow:hidden; margin:3px 0 } #perfPanel .pp-bar u { display:block; height:100% }`; document.head.appendChild(c); }
      el = document.createElement('div'); el.id = 'perfPanel'; document.body.appendChild(el); paint(); timer = setInterval(paint, 500);
    } else if (!on && el) { clearInterval(timer); el.remove(); el = null; }
  }
  const toggle = () => show(!el);
  addEventListener('keydown', e => { if (e.key === 'F8' && (!deps.enabled || deps.enabled())) { e.preventDefault(); toggle(); } });
  return { show, toggle, snap, paint };
}
