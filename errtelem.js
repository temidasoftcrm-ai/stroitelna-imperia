// errtelem.js — 🐞 err-telemetry (f9): грешките в играта (window.onerror / unhandledrejection) в буфер за изпращане.
// Без лични данни: само версия, град, ниво на графиката, съобщение и стек (до 1 KB) — адресите без сайта и параметрите, имейлите и дългите числа/ключове се махат.
// Еднаквите се броят (n), до 20 различни на сесия. sendErrors() праща към Supabase public.report_errors (миграция error_reports; f6) със случаен
// id и пази копие в localStorage 'stroi-errtel-sent'; не от localhost (Лабораторията/разработката — само конзолата).
// Праща се ВИНАГИ (законен интерес — чл. 6(1)(е) GDPR: техническите грешки, без лични данни; privacy.html, 30 дни). id-то:
//   • със съгласие 'analytics' — постоянният анонимен (localStorage 'stroi-errtel-id', общ с usage.js; не е акаунтът);
//   • без съгласие — случаен за сесията, само в паметта (нищо не се пише на устройството за проследяване — ePrivacy чл. 5(3)).
// deps: ctx() → { city, gfx, day }
const MAX = 20, STACK = 1024, MSG = 300, BUF = 'stroi-errtel', SENT = 'stroi-errtel-sent';
let buf = [], lost = 0, ver = '?', deps = null, on = false, rest = null;
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
  import('./cloud.js').then(m => { ver = m.VERSION || '?'; rest = m.SB_REST || null; }).catch(() => { });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendErrors(); });   // при затваряне/скриване на таба
}
export const errBuffer = () => buf.map(({ key, ...e }) => ({ ...e }));
const UA = () => { const u = navigator.userAgent; return /Firefox/.test(u) ? 'firefox' : /Edg\//.test(u) ? 'edge' : /Chrome/.test(u) ? 'chrome' : /Safari/.test(u) ? 'safari' : 'other'; };   // само семейството на браузъра
export const errPayload = (list = buf.filter(e => !e.sent || e.n > e.sent)) => ({ v: ver, ua: UA(), lost, errors: list.map(({ key, sent, ...e }) => ({ ...e, n: e.n - (sent || 0) })) });   // какво би тръгнало
// POST към report_errors (keepalive — тръгва и при затваряне) + конзола + localStorage (последните 50 изпратени)
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const SESSION_ID = crypto.randomUUID();
export const anonId = () => { try { let id = localStorage.getItem('stroi-errtel-id'); if (!id) localStorage.setItem('stroi-errtel-id', id = crypto.randomUUID()); return id; } catch { return crypto.randomUUID(); } };
export function sendErrors() {
  const fresh = buf.filter(e => !e.sent || e.n > e.sent);
  if (!fresh.length) return { sent: 0 };
  const payload = errPayload(fresh);
  console.info('[err-telemetry]', payload);
  if (rest && !LOCAL) try { fetch(rest.url + '/rest/v1/rpc/report_errors', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: rest.key, Authorization: 'Bearer ' + rest.key }, body: JSON.stringify({ p_anon: window.consent?.has?.('analytics') ? anonId() : SESSION_ID, p: payload }) }).catch(() => { }); } catch { }
  try { const L = JSON.parse(localStorage.getItem(SENT) || '[]'); L.unshift({ t: Date.now(), ...payload }); localStorage.setItem(SENT, JSON.stringify(L.slice(0, 50))); } catch { }
  for (const e of fresh) e.sent = e.n;
  store(); return { sent: fresh.length };
}
