// errtelem.js — 🐞 err-telemetry (f9): грешките в играта (window.onerror / unhandledrejection) в буфер за изпращане.
// Без лични данни: само версия, град, ниво на графиката, съобщение и стек (до 1 KB) — адресите без сайта и параметрите, имейлите и дългите числа/ключове се махат.
// Еднаквите се броят (n), до 20 различни на сесия. sendErrors() засега само логва в конзолата и пази в localStorage 'stroi-errtel-sent' —
// endpoint ще има по-късно; праща само със съгласие window.consent?.has('analytics').
// deps: ctx() → { city, gfx, day }
const MAX = 20, STACK = 1024, MSG = 300, BUF = 'stroi-errtel', SENT = 'stroi-errtel-sent';
let buf = [], lost = 0, ver = '?', deps = null, on = false;
export const clean = s => String(s ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>').replace(/\b(https?|blob|file):\/\/[^\s/)]*/g, '').replace(/\?[^\s:)]*/g, '').replace(/\b(eyJ[\w-]{10,}|[A-Za-z0-9_-]{32,}|\d{9,})\b/g, '<id>');   // токени, ключове, дълги номера
const store = () => { try { localStorage.setItem(BUF, JSON.stringify(buf)); } catch { } };
export function recordError(msg, stack, at) {
  if (!on) return null;
  msg = clean(msg).slice(0, MSG); stack = clean(stack).slice(0, STACK); at = clean(at).slice(0, 120);
  const key = msg + '|' + at, old = buf.find(e => e.key === key);
  if (old) { old.n++; old.last = Date.now(); store(); return old; }
  if (buf.length >= MAX) { lost++; return null; }
  let c = {}; try { c = deps?.ctx?.() || {}; } catch { }
  const e = { key, msg, stack, at, n: 1, t: Date.now(), last: Date.now(), city: /^[\w:-]{1,40}$/.test(c.city || '') ? c.city : '?', gfx: c.gfx || '?', day: +c.day | 0 };
  buf.push(e); store(); return e;
}
export function initErrTelemetry(d) {
  if (on) return; on = true; deps = d;
  addEventListener('error', e => { if (!e.message && e.target && e.target !== window) return;   /* липсваща картинка/скрипт — не е грешка в кода */ recordError(e.message, e.error?.stack, `${(e.filename || '').split('/').pop()}:${e.lineno}:${e.colno}`); });
  addEventListener('unhandledrejection', e => { const r = e.reason; recordError('promise: ' + (r?.message || r), r?.stack, ''); });
  import('./cloud.js').then(m => { ver = m.VERSION || '?'; }).catch(() => { });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendErrors(); });   // при затваряне/скриване на таба
}
export const errBuffer = () => buf.map(({ key, ...e }) => ({ ...e }));
const UA = () => { const u = navigator.userAgent; return /Firefox/.test(u) ? 'firefox' : /Edg\//.test(u) ? 'edge' : /Chrome/.test(u) ? 'chrome' : /Safari/.test(u) ? 'safari' : 'other'; };   // само семейството на браузъра
export const errPayload = (list = buf.filter(e => !e.sent || e.n > e.sent)) => ({ v: ver, ua: UA(), lost, errors: list.map(({ key, sent, ...e }) => ({ ...e, n: e.n - (sent || 0) })) });   // какво би тръгнало
// засега: само конзола + localStorage (последните 50 изпратени); после — POST към endpoint-а
export function sendErrors() {
  const fresh = buf.filter(e => !e.sent || e.n > e.sent);
  if (!fresh.length) return { sent: 0 };
  if (!window.consent?.has?.('analytics')) return { sent: 0, reason: 'no-consent' };
  const payload = errPayload(fresh);
  console.info('[err-telemetry]', payload);
  try { const L = JSON.parse(localStorage.getItem(SENT) || '[]'); L.unshift({ t: Date.now(), ...payload }); localStorage.setItem(SENT, JSON.stringify(L.slice(0, 50))); } catch { }
  for (const e of fresh) e.sent = e.n;
  store(); return { sent: fresh.length };
}
