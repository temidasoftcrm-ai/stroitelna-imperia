// notif.js — бутон 🔔 в горната лента до звука: кои известия (toast) да се показват.
// 🔔 всички · ⚠️ само важните (червените — провали, срокове, фалит) · 🔕 никакви. Изборът се помни в браузъра.
// Само CSS клас на <body> — game.js си вика toast() както досега, скритите просто не се виждат.
const LS = 'stroiNotif';
const MODES = [
  { k: 'all', ico: '🔔', nm: 'Известия: всички' },
  { k: 'bad', ico: '⚠️', nm: 'Известия: само важните (червените)' },
  { k: 'off', ico: '🔕', nm: 'Известия: изключени' },
];
const CSS = `
  body.ntf-bad #toasts .toast:not(.bad) { display:none; }
  body.ntf-off #toasts { display:none; }
  #top > #btnNotif { order:0; }
`;
let mode = 'all';
try { const v = localStorage.getItem(LS); if (MODES.some(m => m.k === v)) mode = v; } catch (e) {}

function apply(b) {
  for (const m of MODES) document.body.classList.toggle('ntf-' + m.k, m.k === mode && m.k !== 'all');
  const m = MODES.find(x => x.k === mode);
  if (b) { b.textContent = m.ico; b.title = m.nm + ' — натисни за смяна'; }
}
// 🔕 toast-calm: смяна на режима отвън (бутонът над известията) — същото като натискане на 🔔
export function setNotifMode(k) {
  if (!MODES.some(m => m.k === k)) return; mode = k;
  try { localStorage.setItem(LS, mode); } catch (e) {}
  apply(document.getElementById('btnNotif')); hint(MODES.find(m => m.k === mode).nm);
}
function hint(text) {   // кратко съобщение под бутона — извън #toasts, за да се вижда и при 🔕
  const b = document.getElementById('btnNotif'); if (!b) return;
  const r = b.getBoundingClientRect(), d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = `position:fixed;left:${Math.max(8, Math.min(r.left, innerWidth - 260))}px;top:${r.bottom + 6}px;z-index:60;background:var(--panel);color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:13px;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.4)`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
}
function mount() {
  const top = document.getElementById('top'); if (!top || document.getElementById('btnNotif')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'btnNotif'; b.className = 'btn2'; b.style.touchAction = 'manipulation';
  b.onclick = () => {
    mode = MODES[(MODES.findIndex(m => m.k === mode) + 1) % MODES.length].k;
    try { localStorage.setItem(LS, mode); } catch (e) {}
    apply(b); hint(MODES.find(m => m.k === mode).nm);
  };
  const snd = document.getElementById('btnSound');
  if (snd && snd.parentNode === top) top.insertBefore(b, snd.nextSibling); else top.appendChild(b);
  apply(b);
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
