// gfxlite.js — 🟠 флаг gfx-lite: графиката за слаби компютри. Прозорецът „🎨 Графика“: бутони за всички нива (🟠 Много ниско / 🔴 Ниско / 🟡 Средно / 🟢 Високо)
// и „⚙️ Подробно“ — свои стойности върху нивото: сенки, далечина, трафик и хора, резолюция, нощни светлини, детайли наоколо (дървета, лампи, табели).
// Всичко се прилага веднага (gfxpresets.js → setGfx) и се пази в localStorage 'stroi-gfx'. Долу — кадри/с и рисувания (draw calls) „преди → сега“:
// „преди“ се мери 2 s след отварянето, „сега“ — всяка секунда. По-малките текстури и изглаждането (Много ниско) — след презареждане (memfix.js, game.js).
import { GFX, GFX_ORDER, gfx, gfxLevel, gfxOwn } from './gfxpresets.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `.gfxBox{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.72);font:15px/1.5 system-ui,sans-serif;color:#e8e8ea;padding:16px;box-sizing:border-box}
.gfxBox .in{background:#161a22;border:1px solid #2c3442;border-radius:14px;max-width:500px;width:100%;max-height:92vh;overflow:auto;padding:20px 20px 16px;box-shadow:0 10px 40px rgba(0,0,0,.5);box-sizing:border-box}
.gfxBox h2{margin:0 0 8px;font-size:20px}.gfxBox p{margin:0 0 8px;color:#b8c0cc}.gfxBox small{color:#7d8796}
.gfxBox .lv{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:6px;margin:8px 0}
.gfxBox button{padding:9px 10px;border-radius:10px;border:1px solid #39465a;background:#232a36;color:#e8e8ea;font:inherit;font-weight:600;cursor:pointer}
.gfxBox button.on{background:#2f6fe0;border-color:#2f6fe0}.gfxBox button.sug{outline:2px solid #f5b942;outline-offset:1px}
.gfxBox .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.gfxBox .row button{flex:1;min-width:110px}
.gfxBox .det{border:1px solid #2c3442;border-radius:10px;padding:8px 10px;margin-top:8px;display:grid;gap:7px}
.gfxBox label{display:flex;align-items:center;gap:10px;cursor:pointer}.gfxBox label span{flex:1}.gfxBox label b{min-width:44px;text-align:right;color:#ffd54a;font-weight:700}
.gfxBox input[type=range]{width:42%;accent-color:#f5b942}.gfxBox input[type=checkbox]{width:18px;height:18px;accent-color:#f5b942}
.gfxBox .st{margin-top:10px;padding:7px 10px;border-radius:9px;background:#0f1218;font-size:13px;color:#c9d0da}.gfxBox .rl{color:#ffb35c;font-size:13px;margin-top:6px}`;
const css = () => { if (!document.getElementById('gfxCss')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'gfxCss', textContent: CSS })); };
const SL = [   // плъзгачите: ключ, надпис, мин/макс (%), подсказка
  ['res', '🖼️ Резолюция', 50, 100, 'по-ниска — по-бързо, но по-размазано'],
  ['far', '🔭 Далечина', 40, 120, 'докъде се вижда градът'],
  ['traffic', '🚗 Трафик и хора', 10, 100, 'колко коли и минувачи'],
  ['detail', '🌳 Детайли наоколо', 0, 100, 'дървета, лампи, светофари, табели — докъде около камерата (0 — без тях)'],
];
const CB = [['shadows', '🌑 Сенки', 'най-скъпото за видеокартата'], ['night', '🌃 Нощни светлини', 'ореоли на лампите, прожектори, светещи етажи']];
const fmtN = n => Math.round(n).toLocaleString('bg-BG');

// deps: apply(lv, own|null|undefined) — прилага и пази; stats() → { calls, tris, pr }; loaded — { tex, aa } при зареждането; suggest — ниво (проверката на компютъра)
export function openGfx(deps, { detail = false, suggest = null } = {}) {
  css(); document.querySelector('.gfxBox')?.remove();
  const d = document.createElement('div'); d.className = 'gfxBox'; document.body.appendChild(d);
  let open = detail, before = null, fr = 0, tFr = performance.now(), fps = 0, alive = true, drawn = '';
  const sig = () => gfxLevel() + JSON.stringify(gfxOwn());   // нивото е сменено отвън (проверката, демото) — прозорецът се рисува наново
  const loop = () => { if (!alive) return; fr++; const t = performance.now(); if (t - tFr >= 1000) { fps = fr * 1000 / (t - tFr); fr = 0; tFr = t; stat(); } requestAnimationFrame(loop); };
  const snap = () => { const s = deps.stats(); return { fps, calls: s.calls, tris: s.tris, pr: s.pr }; };
  const line = s => `${s.fps ? fmtN(s.fps) + ' кадъра/с · ' : ''}${fmtN(s.calls)} рисувания · ${(s.tris / 1e6).toFixed(1).replace('.', ',')} M △ · рязкост ${s.pr.toFixed(2).replace('.', ',')}×`;
  function stat() { if (sig() !== drawn && document.activeElement?.type !== 'range') return draw(); const el = d.querySelector('#gfxSt'); if (!el) return; const s = snap(); if (!before && performance.now() - t0 > 2000) before = s;
    el.innerHTML = before ? `📊 Преди: ${line(before)}<br>📊 Сега: <b>${line(s)}</b>` : `📊 Сега: ${line(s)}`; }
  const t0 = performance.now();
  function draw() {
    const lv = gfxLevel(), g = gfx(), own = gfxOwn(), L = deps.loaded || {}; drawn = sig();
    const val = k => k === 'res' ? g.res : k === 'traffic' ? g.traffic : g[k];
    const reload = (GFX[lv].tex !== L.tex || GFX[lv].aa !== L.aa) && L.tex;
    d.innerHTML = `<div class="in"><h2>🎨 Графика</h2><p>Сега: <b>${g.ico} ${esc(g.nm)}</b>${own ? ' <small>(с твои настройки)</small>' : ''}<br><small>${esc(GFX[lv].desc[0].toUpperCase() + GFX[lv].desc.slice(1))}.</small></p>
      <div class="lv">${GFX_ORDER.map(k => `<button data-lv="${k}" class="${k === lv && !own ? 'on' : ''} ${k === suggest ? 'sug' : ''}" title="${esc(GFX[k].desc)}">${GFX[k].ico} ${esc(GFX[k].nm)}</button>`).join('')}</div>
      ${suggest ? `<small>Жълтата рамка — предложението от проверката на компютъра.</small>` : ''}
      <div class="row" style="margin-top:6px"><button id="gfxDet">${open ? '▾' : '▸'} ⚙️ Подробно</button></div>
      ${open ? `<div class="det">${CB.map(([k, t, h]) => `<label title="${esc(h)}"><span>${t}<br><small>${esc(h)}</small></span><input type="checkbox" data-k="${k}" ${val(k) ? 'checked' : ''}></label>`).join('')}
        ${SL.map(([k, t, a, b, h]) => `<label title="${esc(h)}"><span>${t}<br><small>${esc(h)}</small></span><input type="range" data-k="${k}" min="${a}" max="${b}" step="5" value="${Math.round(val(k) * 100)}"><b>${Math.round(val(k) * 100)}%</b></label>`).join('')}
        ${own ? `<button id="gfxReset">↺ Точно „${esc(GFX[lv].nm)}“ (без моите)</button>` : ''}</div>` : ''}
      ${reload ? `<div class="rl">↻ По-малките текстури и изглаждането на ръбовете се сменят след презареждане. <button id="gfxReload" style="padding:4px 10px">Презареди</button></div>` : ''}
      <div class="st" id="gfxSt">📊 …</div>
      <div class="row"><button class="on" id="gfxOk">Готово</button></div></div>`;
    d.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { deps.apply(b.dataset.lv, null); draw(); });
    d.querySelector('#gfxDet').onclick = () => { open = !open; draw(); };
    d.querySelector('#gfxReset')?.addEventListener('click', () => { deps.apply(lv, null); draw(); });
    d.querySelector('#gfxReload')?.addEventListener('click', () => { deps.save?.(); location.reload(); });
    d.querySelectorAll('[data-k]').forEach(inp => {
      const set = () => { const k = inp.dataset.k, v = inp.type === 'checkbox' ? inp.checked : +inp.value / 100; if (inp.nextElementSibling) inp.nextElementSibling.textContent = inp.value + '%';
        deps.apply(gfxLevel(), { ...(gfxOwn() || {}), [k]: v }); };
      if (inp.type === 'range') { inp.oninput = set; inp.onchange = draw; } else inp.onchange = () => { set(); draw(); };
    });
    d.querySelector('#gfxOk').onclick = close;
    stat();
  }
  function close() { alive = false; d.remove(); deps.onClose?.(); }
  d.onclick = e => { if (e.target === d) close(); };
  draw(); requestAnimationFrame(loop);
  window.__gfxLite = { snap, before: () => before, close, el: d };   // за Лабораторията/тестовете
  return d;
}
