// vernotice.js — 🆕 флаг ver-notice: „Излезе нова версия“ и записи от по-нова версия.
// На 10 мин (и при връщане в таба, най-много веднъж в минута) чете version.json ({ v, at } — прави го deploy.mjs) без кеш;
// по-нова от VERSION (cloud.js) → ненатрапчива лента „🆕 Излезе v… — Презареди“ (записва и презарежда; ✕ — скрива я до следващата версия).
// Запис с по-нов формат (SAVE_FORMAT, saves.js): на това устройство — екран „Записът е от по-нова версия — презареди“ (играта не тръгва и не записва);
// в облака (cloud.js) — лента: слотът не се сваля и не се презаписва, докато не презаредиш.
import { feature, IN_LAB } from './lab/feature.js';
import { VERSION } from './cloud.js';

const ON = feature('ver-notice'), GAP = 10 * 60e3;
const cmp = (a, b) => { const x = String(a).split('.').map(n => +n || 0), y = String(b).split('.').map(n => +n || 0); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BTN = 'padding:5px 12px;border-radius:8px;border:0;background:#f5b942;color:#111;font:800 13px system-ui,sans-serif;cursor:pointer';
const X = 'padding:4px 8px;border-radius:8px;border:1px solid #3a4560;background:transparent;color:#a9b6c8;font:700 13px system-ui,sans-serif;cursor:pointer';

export function createVerNotice({ save } = {}) {
  if (!ON) return { check() { }, show() { }, blockNewer() { }, cloudNewer() { } };
  let shown = null, dismissed = null, lastChk = 0;
  const reload = () => { try { save?.(); } catch { } location.reload(); };
  function bar(id, html) {
    document.getElementById(id)?.remove();
    const el = document.createElement('div'); el.id = id;
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--topH, 56px) + 8px);z-index:70;display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);box-sizing:border-box;padding:8px 10px 8px 14px;border-radius:12px;background:#0c1018ee;border:1px solid #c9a14a;color:#e6edf6;font:600 14px system-ui,sans-serif;box-shadow:0 8px 24px #0008';
    el.innerHTML = html; document.body.appendChild(el);
    el.querySelector('[data-r]').onclick = reload;
    const x = el.querySelector('[data-x]'); if (x) x.onclick = () => { el.remove(); if (id === 'verBar') dismissed = shown; };
    return el;
  }
  function show(v) {
    if (!v || v === shown || v === dismissed) return;
    shown = v;
    bar('verBar', `<span>🆕 Излезе <b>v${esc(v)}</b></span><button data-r style="${BTN}">🔄 Презареди</button><button data-x title="По-късно" style="${X}">✕</button>`);
  }
  async function check() {
    if (Date.now() - lastChk < 60e3) return; lastChk = Date.now();
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !IN_LAB) return;   // разработката/тестовете без version.json — без 404 в конзолата (Лабораторията — да, за демото)
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;   // локално файлът го няма — тихо
      const j = await r.json(); if (j && typeof j.v === 'string' && /^\d+(\.\d+){0,3}$/.test(j.v) && cmp(j.v, VERSION) > 0) show(j.v);
    } catch { }
  }
  // записът на текущия слот е от по-нова версия: играта не тръгва (game.js не го зарежда и не записва), само „Презареди“
  function blockNewer() {
    if (document.getElementById('verBlock')) return;
    const el = document.createElement('div'); el.id = 'verBlock';
    el.style.cssText = 'position:fixed;inset:0;z-index:10003;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,7,11,.92);font:15px/1.6 system-ui,sans-serif;color:#e6edf6';
    el.innerHTML = `<div style="width:min(440px,100%);background:#0c1018;border:1px solid #c9a14a;border-radius:16px;padding:20px;text-align:center">
      <div style="font:900 20px system-ui,sans-serif;color:#ffd54a;margin-bottom:8px">🆕 Записът е от по-нова версия</div>
      <p style="color:#a9b6c8;margin:0 0 12px">Тази игра е записана с по-нова версия, отколкото е заредена сега. За да не се развали, тук не се отваря и не се презаписва. Презареди страницата — ще се зареди новата версия.</p>
      <button data-r style="${BTN};font-size:16px;padding:11px 18px">🔄 Презареди страницата</button></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-r]').onclick = () => location.reload();
  }
  // в облака има запис от по-нова версия — cloud.js не го сваля и не го презаписва
  const cloudSlots = new Set();
  function cloudNewer(n) {
    cloudSlots.add(n);
    bar('verCloud', `<span>☁️ В облака има запис от по-нова версия (слот ${[...cloudSlots].sort().join(', ')}) — тук не се сваля, докато не презаредиш</span><button data-r style="${BTN}">🔄 Презареди</button><button data-x style="${X}">✕</button>`);
  }
  setTimeout(check, 30e3); setInterval(check, GAP);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.__verNotice = { cloudNewer };   // cloud.js — без import (иначе кръг cloud ↔ vernotice)
  for (const n of window.__verPend || []) cloudNewer(n);   // облакът може да е проверил преди играта да създаде това
  return { check, show, blockNewer, cloudNewer };
}
