// cloud.js — вход с имейл (код) и записи в облака (Supabase). Играта си записва в localStorage както досега;
// този модул качва трите слота в облака на всеки 20 с (и когато приложението отиде във фон), а при старт
// сравнява с облака: ако на друго устройство има по-нов запис — сваля го и презарежда.
// Таблица public.saves (user_id, slot 's1'…'s3', data jsonb, meta jsonb, updated_at); RLS: всеки вижда само своите.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { backupRaw, dropBackups, tooNew } from './saves.js';
import { feature, IN_LAB } from './lab/feature.js';
import { TURNSTILE_SITEKEY } from './config.js';   // 🔑 pw-login: Cloudflare Turnstile (празен = без проверка)
import { langOn, langButton, setLang, LANG } from './i18n.js';   // 🌐 lang-en: превключвателят в ⚙️ и на входа
const EMAIL_PH = LANG === 'en' ? 'name@example.com' : 'ime@primer.com';   // примерният имейл в полетата за вход
import './consent.js';   // 🍪 GDPR съгласие (feature 'consent') — window.consent

const URL_ = 'https://lpzjscttqieqnqozscpk.supabase.co';
const KEY = 'sb_publishable_3Gats6iSx7BoyFUh63N1vQ__pHCBrul';   // публичен ключ — достъпът се пази от RLS
const SLOTS = 3;
const keyOf = n => n === 1 ? 'stroi-save-v1' : `stroi-save-v1-s${n}`;
const syncKey = n => `stroi-cloud-s${n}`;   // { ts: updated_at в облака, sig: отпечатък на качения запис }
const emptyKey = n => `stroi-cloud-empty-s${n}`;   // fix-saves: слотът е нарочно празен („Нова игра“, game.js wipeSlot) — облачният запис не се сваля, а се заменя с новата игра
const curSlot = () => { try { return Math.min(SLOTS, Math.max(1, +localStorage.getItem('stroi-slot') || 1)); } catch { return 1; } };
const AUTOTEST = /[?&]autotest/.test(location.search);

const sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stroi-auth' } });
let user = null, busy = false, lastErr = '';

// отпечатък на текст (за „промени ли се записът“): fix-saves — целият низ (преди — всеки 7-и знак: промяна между тях оставаше незабелязана), два 32-битови хеша
const FIX = feature('fix-saves');
function sig(s) { if (!s) return ''; if (!FIX) { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
  let h = 2166136261, g = 5381; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = Math.imul(h ^ c, 16777619); g = (Math.imul(g, 33) + c) | 0; } return (h >>> 0).toString(36) + (g >>> 0).toString(36) + ':' + s.length; }
// един и същ запис като текст независимо от реда на ключовете (jsonb в облака ги пренарежда — JSON.stringify(c.data) !== raw дори без промяна)
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v) ?? 'null';
const sameSave = (data, raw) => { try { return canon(data) === canon(JSON.parse(raw)); } catch { return false; } };
// ☁️ cloud-lite: записът (до ~2.5 MB JSON) се качва компресиран (gzip → base64, ~5× по-малко) в същата колона data jsonb — { $z: 'gzip64', d, n };
// четенето разпознава и двата вида винаги (и без флага), за да не се счупи устройство, на което флагът още е изключен
const LITE = feature('cloud-lite');
const b64 = buf => { const u = new Uint8Array(buf); let t = ''; for (let i = 0; i < u.length; i += 32768) t += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(t); };
async function pack(raw) {
  if (!LITE || typeof CompressionStream === 'undefined') return JSON.parse(raw);
  const b = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { $z: 'gzip64', d: b64(b), n: raw.length };
}
const packed = d => !!d && typeof d === 'object' && d.$z === 'gzip64' && typeof d.d === 'string';
async function unpack(d) {
  if (!packed(d)) return d;
  if (typeof DecompressionStream === 'undefined') throw new Error('браузърът не може да разархивира записа');
  const u = Uint8Array.from(atob(d.d), c => c.charCodeAt(0));
  return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}
const getSync = n => { try { return JSON.parse(localStorage.getItem(syncKey(n))) || null; } catch { return null; } };
const setSync = (n, v) => { try { localStorage.setItem(syncKey(n), JSON.stringify(v)); } catch {} };
function metaOf(raw) { try { const s = JSON.parse(raw); return { city: s.hqCity || s.cityId, day: s.day | 0, money: Math.round(s.econ?.money ?? 0), done: s.done | 0, rep: s.rep ?? 0 }; } catch { return {}; } }
const fmt = n => Math.round(n || 0).toLocaleString('bg-BG');

// ── малък диалог (собствен, за да не зависи от game.js) ──
function dlg(html, buttons = []) {
  document.getElementById('cloudDlg')?.remove();
  const el = document.createElement('div'); el.id = 'cloudDlg';
  el.style.cssText = 'position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
  el.innerHTML = `<div style="background:#18202c;border:1px solid var(--line);border-radius:16px;padding:20px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:12px;color:var(--txt)">${html}
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${buttons.map((b, i) => `<button class="${b[2] ? 'btn' : 'btn2'}" data-i="${i}" style="flex:1 1 auto">${b[0]}</button>`).join('')}</div></div>`;
  document.body.appendChild(el);
  el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const f = buttons[+b.dataset.i][1]; if (!f || f() !== false) el.remove(); });
  return el;
}
function toast(msg, bad) {
  const t = document.createElement('div'); t.className = 'toast ' + (bad ? 'bad' : 'good'); t.textContent = msg;
  const box = document.getElementById('toasts'); if (box) { box.prepend(t); setTimeout(() => t.remove(), 6000); }
}

// ── бутон в горната лента ──
let btn = null;
function mountBtn() {
  const top = document.getElementById('top'); if (!top || btn) return;
  btn = document.createElement('button'); btn.id = 'cloudBtn'; btn.className = 'btn2'; btn.onclick = openPanel;
  top.insertBefore(btn, top.querySelector('.sp'));
  paint();
}
function paint() {
  if (!btn) return;
  btn.textContent = user ? (lastErr ? '☁️⚠️' : busy ? '☁️…' : '☁️✓') : '☁️ Вход';
  btn.title = user ? `Облак: ${who()}${lastErr ? ' — ' + lastErr : ''}` : 'Влез, за да пазиш играта в облака и да играеш от няколко устройства';
}

function openPanel() {
  if (!user) return loginEmail();
  return openSettings();
}
function openCloud() {
  const rows = [];
  for (let n = 1; n <= SLOTS; n++) { const raw = localStorage.getItem(keyOf(n)); if (raw) { const m = metaOf(raw), s = getSync(n); rows.push(`💾 Слот ${n}: ден ${m.day} · ${fmt(m.money)} € ${s && s.sig === sig(raw) ? '· ☁️ в облака' : '· ⏳ чака качване'}`); } }
  dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Облак</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">${anonU(user) ? '<b style="color:var(--txt)">👤 Гост</b> — записът е в облака на това устройство. За да продължиш от друго устройство, създай акаунт (⚙️ → 🆕 Създай акаунт).' : `Влязъл си като <b style="color:var(--txt)">${esc(user.email)}</b>.`}<br>Играта се пази в облака автоматично — влез със същия имейл на друго устройство и продължаваш оттам.${lastErr ? `<br><span style="color:var(--bad)">Последна грешка: ${lastErr}</span>` : ''}</p>
    <div style="font-size:13px;line-height:1.7">${rows.join('<br>') || 'Още няма записи.'}</div>`,
    [...(anonU(user) ? [] : [['Изход', () => { sb.auth.signOut(); }]]), ['☁️ Синхронизирай сега', () => { syncAll(true); }], ['Затвори', null, 1]]);
}

function loginEmail(pre = '') {
  if (PW) { const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Вход</h2><div id="pwBox"></div>`, [['Затвори', null]]);   // 🔑 pw-login
    pwForm(el.querySelector('#pwBox'), { inp: DLG_INP, go: DLG_GO, link: 'var(--acc)', mut: 'var(--mut)', onIn: (email, isNew) => { el.remove(); toast(`☁️ ${isNew ? 'Акаунтът е създаден' : 'Влезе'} — ${email}. Играта вече се пази в облака.`); } }, pre ? 'login' : undefined, pre || undefined); return; }
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Вход</h2>
    <p style="color:var(--mut);font-size:14px;line-height:1.5">Въведи имейла си — ще ти пратим код за вход. Без парола. След това играта ти се пази в облака и можеш да продължиш от телефона, таблета или друг компютър.</p>
    <input id="cloudEmail" type="email" autocomplete="email" inputmode="email" placeholder="${EMAIL_PH}" value="${pre}" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:16px">
    <div id="cloudMsg" style="font-size:13px;color:var(--bad)"></div>`,
    [['Отказ', null], ['📧 Прати код', () => {
      const email = el.querySelector('#cloudEmail').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { el.querySelector('#cloudMsg').textContent = 'Невалиден имейл.'; return false; }
      el.querySelector('#cloudMsg').style.color = 'var(--mut)'; el.querySelector('#cloudMsg').textContent = 'Изпращам…';
      sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).then(({ error }) => {
        if (error) { el.querySelector('#cloudMsg').style.color = 'var(--bad)'; el.querySelector('#cloudMsg').textContent = /rate|seconds/i.test(error.message) ? 'Твърде много опити — изчакай малко и пробвай пак.' : error.message; return; }
        el.remove(); loginCode(email);
      });
      return false;
    }, 1]]);
  setTimeout(() => el.querySelector('#cloudEmail')?.focus(), 50);
}
function loginCode(email) {
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">📧 Провери пощата</h2>
    <p style="color:var(--mut);font-size:14px;line-height:1.5">Пратихме код на <b style="color:var(--txt)">${email}</b>. Въведи го тук (ако го няма — виж и папка „Спам“).</p>
    <input id="cloudCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:24px;letter-spacing:6px;text-align:center">
    <div id="cloudMsg" style="font-size:13px;color:var(--bad)"></div>`,
    [['← Друг имейл', () => { loginEmail(email); }], ['✅ Влез', () => {
      const token = el.querySelector('#cloudCode').value.replace(/\D/g, '');
      if (token.length < 6) { el.querySelector('#cloudMsg').textContent = 'Кодът е от 6 цифри.'; return false; }
      sb.auth.verifyOtp({ email, token, type: 'email' }).then(({ error }) => {
        if (error) { el.querySelector('#cloudMsg').textContent = /expired|invalid/i.test(error.message) ? 'Грешен или изтекъл код.' : error.message; return; }
        el.remove(); toast(`☁️ Влезе като ${email}. Играта вече се пази в облака.`);
      });
      return false;
    }, 1]]);
  setTimeout(() => el.querySelector('#cloudCode')?.focus(), 50);
}

// ── 🔑 флаг pw-login: вход и регистрация само с имейл + парола — без писма (няма услуга за имейли). Кодът по имейл не се показва.
// „Забравена парола“ — пиши ни, сменяме я ръчно. Cloudflare Turnstile (config.js TURNSTILE_SITEKEY; празен = без проверка):
// скриптът се зарежда чак при показване на формата, токенът отива в options.captchaToken на signUp / signInWithPassword.
const PW = feature('pw-login');
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const mailGet = () => { try { return localStorage.getItem('stroi-email') || ''; } catch { return ''; } }, mailKeep = m => { try { localStorage.setItem('stroi-email', m); } catch { } };
const tsKey = () => IN_LAB && window.__tsTest ? '1x00000000000000000000AA' : TURNSTILE_SITEKEY;   // демото в Лабораторията: тестовият ключ на Cloudflare (винаги минава)
let tsP = null;
const tsLoad = () => tsP = tsP || new Promise((res, rej) => {
  if (window.turnstile) return res(window.turnstile);
  const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
  s.onload = () => res(window.turnstile); s.onerror = () => { tsP = null; rej(new Error('captcha')); }; document.head.appendChild(s);
});
// джаджите на Turnstile, чиято форма вече я няма (превключване вход ↔ нов акаунт, затворен прозорец) — махат се с turnstile.remove,
// иначе Cloudflare пише „Cannot find Widget … consider using turnstile.remove()“ в конзолата
const tsLive = []; let tsSweepT = 0;
const tsSweep = () => { for (let i = tsLive.length - 1; i >= 0; i--) if (!tsLive[i].el.isConnected) { try { window.turnstile.remove(tsLive[i].id); } catch { } tsLive.splice(i, 1); }
  if (!tsLive.length && tsSweepT) { clearInterval(tsSweepT); tsSweepT = 0; } };
function captcha(el) {   // { token(): Promise<string|undefined>, reset() }
  const key = tsKey(); if (!key) return { token: async () => undefined, reset() { } };
  let id = null, tok = ''; const wait = [];
  tsLoad().then(ts => { tsSweep(); id = ts.render(el, { sitekey: key, appearance: 'interaction-only', theme: 'dark', language: LANG === 'en' ? 'en' : 'bg',
    callback: t => { tok = t; wait.splice(0).forEach(f => f(t)); }, 'expired-callback': () => { tok = ''; }, 'error-callback': () => { tok = ''; } }); tsLive.push({ id, el }); if (!tsSweepT) tsSweepT = setInterval(tsSweep, 2000); }).catch(() => { });
  return { token: () => tok ? Promise.resolve(tok) : new Promise((res, rej) => { wait.push(res); setTimeout(() => rej(new Error('captcha')), 30000); }),
    reset() { tok = ''; try { if (id != null) window.turnstile.reset(id); } catch { } } };
}
const pwErr = m => /invalid login/i.test(m) ? 'Грешен имейл или парола.' : /already|registered|exists/i.test(m) ? 'Този имейл вече има акаунт — влез с паролата.' : /captcha/i.test(m) ? 'Проверката срещу ботове не мина — опитай пак.'
  : /not confirmed/i.test(m) ? 'Акаунтът още не е потвърден — пиши ни на temidasoftcrm@gmail.com.' : /rate|seconds|too many/i.test(m) ? 'Твърде много опити — изчакай малко.' : /weak|short|least|characters/i.test(m) ? 'Паролата е твърде слаба — поне 8 знака.' : /same|different/i.test(m) ? 'Това е старата парола — избери друга.' : m;
// формата (в екрана за вход regGate и в диалога ☁️ Вход): o = { inp, go, link, mut — стилове/цветове; onIn(email, isNew) }
function pwForm(box, o, mode = mailGet() ? 'login' : 'new', pre = mailGet()) {
  const P = t => `<p style="color:${o.mut};font-size:14px;line-height:1.5;margin:10px 0 4px">${t}</p>`;
  const I = (id, type, ac, ph) => `<input id="${id}" type="${type}" autocomplete="${ac}"${type === 'email' ? ' inputmode="email"' : ''} placeholder="${ph}" style="${o.inp}">`;
  const A = (id, t, c) => `<a href="#" id="${id}" style="color:${c}">${t}</a>`;
  if (mode === 'forgot') {
    box.innerHTML = P('🔁 <b>Забравена парола</b><br>Пиши ни на <b>temidasoftcrm@gmail.com</b> от имейла на акаунта — ще я сменим ръчно и ще ти отговорим.') + `<button id="pwBack" style="${o.go}">← Към входа</button>`;
    box.querySelector('#pwBack').onclick = () => pwForm(box, o, 'login', pre); return;
  }
  const isNew = mode === 'new';
  box.innerHTML = P(isNew ? '🆕 <b>Нов акаунт</b> — имейл и парола. Играта ти се пази в облака и играеш от всяко устройство.' : '🔑 <b>Влез</b> с имейла и паролата си — играта ти чака в облака.')
    + I('pwEmail', 'email', isNew ? 'email' : 'username', EMAIL_PH) + I('pwP1', 'password', isNew ? 'new-password' : 'current-password', isNew ? 'парола (поне 8 знака)' : 'парола')
    + (isNew ? I('pwP2', 'password', 'new-password', 'паролата още веднъж') : '')
    + '<div id="pwTs" style="display:flex;justify-content:center"></div><div class="pwMsg" style="font-size:13px;min-height:18px"></div>'
    + `<button id="pwGo" style="${o.go}">${isNew ? '🆕 Създай акаунт' : '▶ Влез'}</button>`
    + `<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13px">${A('pwSw', isNew ? '← Имам акаунт' : '🆕 Нов акаунт', o.link)}${isNew ? '' : A('pwForgot', 'Забравена парола?', o.mut)}</div>`;
  const q = s => box.querySelector(s), e = q('#pwEmail'), p1 = q('#pwP1'), p2 = q('#pwP2'), btn = q('#pwGo');
  e.value = pre || ''; setTimeout(() => (pre && !isNew ? p1 : e).focus(), 50);
  const msg = (t, bad) => { const m = q('.pwMsg'); m.style.color = bad ? '#ff6b6b' : o.mut; m.textContent = t; };
  const cap = captcha(q('#pwTs'));
  q('#pwSw').onclick = ev => { ev.preventDefault(); pwForm(box, o, isNew ? 'login' : 'new', e.value.trim()); };
  const fg = q('#pwForgot'); if (fg) fg.onclick = ev => { ev.preventDefault(); pwForm(box, o, 'forgot', e.value.trim()); };
  const submit = async () => {
    const email = e.value.trim(), password = p1.value;
    if (!EMAIL_RE.test(email)) return msg('Невалиден имейл.', true);
    if (isNew ? password.length < 8 : !password) return msg(isNew ? 'Паролата е поне 8 знака.' : 'Въведи паролата.', true);
    if (isNew && password !== p2.value) return msg('Двете пароли се различават.', true);
    btn.disabled = true; msg(tsKey() ? 'Проверка срещу ботове…' : isNew ? 'Създавам акаунта…' : 'Влизам…');
    try {
      const captchaToken = await cap.token(), options = captchaToken ? { captchaToken } : undefined;
      msg(isNew ? 'Създавам акаунта…' : 'Влизам…');
      const { data, error } = isNew ? await sb.auth.signUp({ email, password, options }) : await sb.auth.signInWithPassword({ email, password, options });
      if (error) throw error;
      if (isNew && !data?.session) { msg('Акаунтът е създаден, но чака потвърждение — пиши ни на temidasoftcrm@gmail.com.', true); return; }
      mailKeep(email); o.onIn(email, isNew);
    } catch (x) { msg(x?.message === 'captcha' ? 'Проверката срещу ботове не се зареди — опитай пак (или спри блокера за сайта).' : pwErr(x?.message || 'няма връзка'), true); cap.reset(); }
    finally { btn.disabled = false; }
  };
  btn.onclick = submit; for (const x of [e, p1, p2]) if (x) x.onkeydown = ev => { if (ev.key === 'Enter') submit(); };
}
const DLG_INP = 'width:100%;box-sizing:border-box;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:16px;margin:5px 0';
const DLG_GO = 'width:100%;padding:12px;border:0;border-radius:11px;background:#f5b942;color:#111;font:800 16px system-ui,sans-serif;cursor:pointer;margin-top:6px';
// ── 👤 guest-cloud (T2, потребителят: „като си натиснал да играеш без акаунт да не ти го дава на всяко зареждане, а да прави запис на облака директно“):
// „Играй без регистрация“ се помни (localStorage 'stroi-guest'), а играта се пази в облака като анонимен потребител (Supabase signInAnonymously, с Turnstile токен);
// „🆕 Създай акаунт“ после — updateUser (същият user id, записите остават); без анонимен вход в проекта — тихо само на устройството (console.warn веднъж)
const GC = feature('guest-cloud');
const GUEST_K = 'stroi-guest', isGuest = () => { try { return localStorage.getItem(GUEST_K) === '1'; } catch { return false; } };
const setGuest = on => { try { if (on) localStorage.setItem(GUEST_K, '1'); else localStorage.removeItem(GUEST_K); } catch { } };
const anonU = u => !!(u && u.is_anonymous);
const who = () => anonU(user) ? '👤 Гост (записът е в облака)' : user?.email || '';
let anonWarned = false, anonBusy = null;
// Turnstile за анонимния вход: невидим; само ако Cloudflare поиска отметка — малко каре долу вдясно с надпис; след токена — махнат
async function anonToken() {
  const key = tsKey(); if (!key) return undefined;
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:10001;display:flex;flex-direction:column;align-items:flex-end;gap:4px';
  const lab = document.createElement('div'); lab.textContent = '☁️ Играта като гост се пази в облака — след проверката'; lab.style.cssText = 'display:none;font:600 12px system-ui,sans-serif;color:#e6edf6;background:#0c1018;border:1px solid #3a4560;padding:4px 8px;border-radius:8px';
  const w = document.createElement('div'); box.append(lab, w); document.body.appendChild(box);
  let id = null;
  try {
    const ts = await tsLoad();
    return await new Promise((res, rej) => { const tm = setTimeout(() => rej(new Error('captcha')), 60000);
      id = ts.render(w, { sitekey: key, appearance: 'interaction-only', theme: 'dark', language: LANG === 'en' ? 'en' : 'bg', callback: t => { clearTimeout(tm); res(t); },
        'before-interactive-callback': () => { lab.style.display = 'block'; }, 'error-callback': () => { clearTimeout(tm); rej(new Error('captcha')); } }); });
  } finally { try { if (id != null) window.turnstile.remove(id); } catch { } box.remove(); }
}
function guestSignIn() {
  if (!GC || AUTOTEST) return Promise.resolve(false);
  return anonBusy = anonBusy || (async () => {
    try {
      const { data } = await sb.auth.getSession(); if (data?.session) return true;
      const captchaToken = await anonToken();
      const { error } = await sb.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
      if (error) throw error;
      return true;
    } catch (e) {
      if (!anonWarned) { anonWarned = true; console.warn('guest-cloud: anonymous sign-in failed, saves stay on this device only (Supabase: Authentication, Allow anonymous sign-ins)', e?.message || e); }
      return false;
    } finally { anonBusy = null; }
  })();
}
// ⚙️ → 🆕 Създай акаунт (гост): имейл и парола на същия потребител — updateUser, не signUp
function guestUpgrade() {
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">🆕 Създай акаунт</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Записите ти в облака остават същите — само им слагаш имейл и парола, за да играеш и от друго устройство.</p>
    <input id="guE" type="email" autocomplete="email" inputmode="email" placeholder="${EMAIL_PH}" style="${DLG_INP}"><input id="guP1" type="password" autocomplete="new-password" placeholder="парола (поне 8 знака)" style="${DLG_INP}">
    <input id="guP2" type="password" autocomplete="new-password" placeholder="паролата още веднъж" style="${DLG_INP}"><div id="guMsg" style="font-size:13px;min-height:18px"></div>`,
    [['Отказ', null], ['🆕 Създай акаунт', () => { go(); return false; }, 1]]);
  const q = x => el.querySelector(x), msg = (t, bad) => { const m = q('#guMsg'); if (!m) return; m.style.color = bad ? 'var(--bad)' : 'var(--mut)'; m.textContent = t; };
  const done = email => { setGuest(false); mailKeep(email); el.remove(); toast(`☁️ Акаунтът е създаден — ${email}. Записите в облака остават същите.`); paint(); };
  const setPw = async (email, password) => { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; done(email); };
  const go = async () => {
    const email = q('#guE').value.trim(), password = q('#guP1').value;
    if (!EMAIL_RE.test(email)) return msg('Невалиден имейл.', true);
    if (password.length < 8) return msg('Паролата е поне 8 знака.', true);
    if (password !== q('#guP2').value) return msg('Двете пароли се различават.', true);
    msg('Създавам акаунта…');
    try {
      const { data, error } = await sb.auth.updateUser({ email }); if (error) throw error;
      if ((data?.user?.email || '').toLowerCase() === email.toLowerCase()) return await setPw(email, password);
      if (PW) return msg('Акаунтът чака потвърждение на имейла — пиши ни на temidasoftcrm@gmail.com.', true);
      el.querySelector('div').innerHTML = `<h2 style="font-size:19px;color:var(--acc)">📧 Провери пощата</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Пратихме код на <b style="color:var(--txt)">${esc(email)}</b>. Въведи го тук (ако го няма — виж и папка „Спам“).</p>
        <input id="guC" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="${DLG_INP};letter-spacing:6px;text-align:center"><div id="guMsg" style="font-size:13px;min-height:18px"></div><button class="btn" id="guOk">✅ Потвърди</button>`;
      q('#guOk').onclick = async () => { const token = q('#guC').value.replace(/\D/g, ''); if (token.length < 6) return msg('Кодът е от 6 цифри.', true);
        try { const r = await sb.auth.verifyOtp({ email, token, type: 'email_change' }); if (r.error) throw r.error; await setPw(email, password); } catch (x) { msg(/expired|invalid/i.test(x?.message || '') ? 'Грешен или изтекъл код.' : pwErr(x?.message || 'няма връзка'), true); } };
    } catch (x) { msg(pwErr(x?.message || 'няма връзка'), true); }
  };
  setTimeout(() => q('#guE')?.focus(), 50);
}
// ⚙️ → 🔑 Имам акаунт (гост): вход в друг, съществуващ акаунт — първо предупреждение; после конфликтът се решава както винаги (pullAll пита)
function guestLogin() {
  dlg(`<h2 style="font-size:19px;color:var(--acc)">🔑 Вход в акаунт</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Влизаш в акаунт с имейл. Играта като гост на това устройство не се губи без питане: ако в акаунта има записи, ще избереш кой да остане (другият отива в „💾 Записи“ → „🕒 Автозаписи“). Облачните записи на госта остават без акаунт.</p>`,
    [['Отказ', null], ['🔑 Към входа', () => { setTimeout(() => loginEmail(), 0); }, 1]]);
}
// ⚙️ → 🔑 Смени паролата (влезли): updateUser — без писмо
function changePw() {
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">🔑 Смени паролата</h2>
    <input id="cpP1" type="password" autocomplete="new-password" placeholder="нова парола (поне 8 знака)" style="${DLG_INP}">
    <input id="cpP2" type="password" autocomplete="new-password" placeholder="още веднъж" style="${DLG_INP}"><div id="cpMsg" style="font-size:13px;color:var(--bad);min-height:18px"></div>`,
    [['Отказ', null], ['💾 Запази', () => {
      const p1 = el.querySelector('#cpP1').value, p2 = el.querySelector('#cpP2').value, m = el.querySelector('#cpMsg');
      if (p1.length < 8) { m.textContent = 'Паролата е поне 8 знака.'; return false; }
      if (p1 !== p2) { m.textContent = 'Двете пароли се различават.'; return false; }
      m.style.color = 'var(--mut)'; m.textContent = 'Запазвам…';
      sb.auth.updateUser({ password: p1 }).then(({ error }) => { if (error) { m.style.color = 'var(--bad)'; m.textContent = pwErr(error.message); return; } el.remove(); toast('🔑 Паролата е сменена.'); });
      return false;
    }, 1]]);
  setTimeout(() => el.querySelector('#cpP1')?.focus(), 50);
}

// ── ⚙️ Настройки: вход/изход, хора онлайн, изтриване на данните и на акаунта ──
// 🆕 версия и какво е новото — при нова версия: вдигни VERSION и добави най-отгоре в CHANGES
export const VERSION = '4.0.2';
const CHANGES = [
  ['4.0.2', '29.10.2026', [
    '✈️ Поправено: летищата в крайморските градове (Варна, Бургас, Истанбул) вече не стоят във водата; по-дългите писти и метрото — към сушата',
  ]],
  ['4.0.1', '29.10.2026', [
    '🕊️ Финалът „Път към световния мир“ — 6 цели, панел с министрите, клип, личен отчет и наградата „Архитект на мира“',
    '🏢 Централата расте по нива — от ниво 8 кампус, на ниво 10 истински небостъргач; складът расте; обликите „Сапфир“, „Туист“, „Близнаци“ — с истински прозорци',
    '🚉 Гарите — свой парцел с площад и паркинги, на едно място за всички нива, централна гара на ниво 5; ✈️ летището от ниво 5 — по-дълги писти, многоетажен паркинг и метро',
    '🚆 Локомотивите светят нощем, влаковете са с еднакви вагони, колите на вагоните — истински модели',
    '⚓ Пристанището — зърнен терминал, контейнерите на отделна платформа и павиран двор; 🏭 работници и мотокар в индустриалната зона',
    '⛲ Вода във фонтаните; 🏙️ панелните блокове светят нощем с истински прозорци; 🎬 жив клип на началния екран',
    '🛠️ Поправено: Истанбул вече не стои във водата, фериботните линии се виждат; бутоните в Министерския съвет; парите светват в зелено, докато се превъртат',
  ]],
  ['4.0.0', '29.10.2026', [
    '🏛️ Президентство с партньор — всеки е президент на различна държава; екран „🌐 Срещата на върха“: показатели, общ мир, договори, чат',
    '🤝 Суперпоръчките с партньор — предлагат се и на двамата, авансът, наградата и доходът се делят 50/50',
    '🚆 Жп трасе с няколко участъка като при магистралите (от ниво 3); ✈️ самолет с един бутон — случаен вид, после надграждаш',
    '🤖 Автопилотът сам купува липсващата техника веднъж и я използва; градовете на автопилот вече се застрояват и завършват',
    '🏜️ Пирамидите в Гиза — извън Кайро, в истински размер, със Сфинкса и шоу „Звук и светлина“ нощем',
    '🏭 Заводи и в градовете по картата; жп отклонение до завода и камиони в индустриалната зона',
    '🚚 ТИР-овете — отделен лимит за всеки континент (Европа 60, Африка 50…)',
    '🔥 Пожарите в града — пламъци и дим по фасадата; 🎵 8 нови песни и нощна музика; 🎬 клип за първата жп линия',
    '🛠️ Поправено: черните фасади денем, релсите до моста, табелите над магистралата, Марина Бей Сендс нощем, цената на летищата и пристанищата',
    '💶 Парите горе светват в зелено при приход; основаването на корабна компания — 25 млн., авиокомпания — 50 млн.',
  ]],
  ['3.5.2', '28.10.2026', [
    '🤝 Партньорство: магистралите и жп линиите на двамата са обща мрежа — куестовете, Ориент Експрес и бордът ги броят; наградата е за този, който е построил повече',
    '✈️ В град на партньора летището и пристанището ги строи той — ползваш неговите',
    '🗺️ Картата: държавите на партньора в неговия цвят, общите — на райета; нов екран „🏆 Завладени държави“ с процентите по континенти',
    '🛠️ Поправено: подобренията на офиса, склада, гаража и гарата в другите градове вече не стоят вечно на „строи се“ — довършват се сами; бутонът „Балкани“ центрира картата',
  ]],
  ['3.5.1', '28.10.2026', [
    '🤝 Партньорство: държава, чиито ключови градове сте завършили двамата, е „Завладяна заедно“ — на картата и в борда; доходът +10% и наградите — за този с повече градове там',
    '🛠️ Поправено: пратките и касата на партньорството не се опитват безкрайно, ако сървърът ги откаже — парите се връщат',
  ]],
  ['3.5.0', '28.10.2026', [
    '⚡ Истински мълнии при буря — разклонени, с гръм според разстоянието; небето притъмнява',
    '🔥 Изгорели сгради — след пожар в града остава руина, после се разчиства',
    '🛬 Летищата с истински писти — двойки като на големите хъбове, светлини нощем',
    '🏛️ Площади пред забележителностите — лампи, пейки, саксии; кафенето не пречи на гледката',
    '🏭 Индустриалната зона с улица, дворове, рампи, паркинги и тръбопровод между заводите',
    '🚆 Влак се купува с един бутон — товарен или пътнически по случаен избор; ясен брояч по региони',
    '👤 Игра като гост — запомня се и пази играта в облака',
    '🎬 Нови клипове — първата магистрала и първият кораб',
    '🛠️ Поправено: техниката вече не „засяда“ по дългите пътища; летището/пристанището тръгва веднага след основаването на дъщерната фирма',
    '🌍 Входовете към континентите (Александрия, Ню Йорк, Рио, Дубай, Сидни) — линия без ограничения',
    '📈 Нивата 12–20 искат повече опит; парите горе се превъртат',
  ]],
  ['3.4.5', '28.10.2026', [
    '🗺️ Поправено: парцелите извън кварталите в градовете по картата са „Покрайнини“ (беше италианското „Fuori“)',
  ]],
  ['3.4.4', '28.10.2026', [
    '🏠 Старите записи: модерната двуетажна къща е заменена с къща от региона (вместо празно място)',
  ]],
  ['3.4.3', '28.10.2026', [
    '🛠️ Поправено: играта спираше при зареждане на запис, ако модел на сграда не се е заредил',
  ]],
  ['3.4.2', '28.10.2026', [
    '🚋 Трамваи по булевардите; градските автобуси карат правилно, междуградски автобуси по магистралата',
    '🗺️ София и Берлин по истинската карта — свързани улици, истински височини, НДК и Бранденбургската врата',
    '🏘️ Кварталите имат имена — Център, Пристанище, Витошка, Сохо…; при избор на парцел виждаш квартала',
    '✈️ Летището: нова кула и хангари, самолетите вече не се застъпват; нефтени помпи и индустриална зона с работници',
    '🌃 Забележителностите светят нощем; Опера в Сидни, Токийската кула, Голдън Гейт; денонощен магазин и супермаркет',
    '🏛️ Политиката: импийчмънт, мандати, по-добър баланс и въведение на ниво 25',
    '⚡ По-леки градове по картата — по-малко дървета и сенки в украсата на кварталите',
  ]],
  ['3.4.1', '28.10.2026', [
    '🚆 Нови влакове и вагони — 4 пътнически и 3 товарни състава, цистерни, платформи, вагони за коли',
    '🛤️ Депо с маневри и искри; гарата в крайбрежните градове е навътре, без релси над морето; площад с фонтан до гарата',
    '✈️ Пътят до летището е истинска улица с кръстовище; изходи от магистралата и в големите градове по картата',
    '🏡 Нови къщи — българска, вила, средиземноморски, възрожденска, селски, редови; аптека и градска бензиностанция; кипариси',
    '🛵 Мотори и скутери в трафика; по-гладки модели на камиони, самолет и дървета',
    '⚓ Поправено: автоматичните кораби и самолети вече спазват бюджета и изключения бутон; ясни числа по региони',
  ]],
  ['3.4.0', '28.10.2026', [
    '🚜 Пътна техника за магистралите се купува и мести сама (от ниво 5); гаражът без фалшиви липси',
    '🛣️ Магистралите се плащат по етапи; виждаш кой номер на опашката е всеки участък',
    '🍂 Дърветата сменят цвета си по сезони; планини на хоризонта — Витоша, Родопите, Алпите',
    '🏙️ Истинска височина: One WTC, Крайслер, Емпайър, Скайтри; Берлин с Бранденбургската врата, Райхстага и телевизионната кула',
    '🏢 Твоите небостъргачи — 10 модела в истинска височина',
    '🛒 Квартални магазини, мол, кафенета, които светят нощем; завод в индустриалната зона',
    '🏖️ Курортите — странично меню и истински кран; пейки, алеи и площадки между блоковете',
    '🚚 Пътна помощ, сметосъбирач, път до летището; фирмата не се натрупва на един парцел',
    '🗺️ По-ясна карта с легенда; пътищата и жп линиите не минават през водата',
    '⚙️ Графиката се помни; „Гледай“ при инцидент; до 5 имота на град (3 в малките)',
  ]],
  ['3.3.0', '27.10.2026', [
    '🗼 Токио, Дубай и Сингапур със свой облик: Скайтри, Бурж ал Араб на остров, Марина Бей Сендс и Супертрийс',
    '🛶 Каналите в Амстердам, Дунав и Баба Вида във Видин, Марица и тепетата в Пловдив (в нови игри)',
    '🏛️ Площади около забележителностите, кафенета, фонтани и паметници на кръговите, позлатеното кметство в Париж',
    '🎰 Неон в Лас Вегас и Сизърс Палас, Белият дом осветен, нови фасади във Вашингтон и Москва',
    '✈️ Wizz Air по летищата, контейнеровоз MSC Irina, нови пожарни, камиони, самосвал и бензиностанция на магистралата',
    '🌳 Нови дървета и палми, европейски и модерни къщи, булевард по края на града с жп прелези (в нови игри)',
    '🛤️ Най-много 5 жп линии от град — първо към столиците, после към големите градове',
    '📦 Складовете пълнят сами навсякъде; бутонът „Карта“ е до „Империя“; по-малко надписи над сградите',
  ]],
  ['3.2.2', '27.10.2026', [
    '🚜 Поправено: прозорецът „Гараж — цялата техника“ отново показва техниката',
    '🌴 Палмите, скалите, самолетите и още модели вече не светят нощем',
    '🏚️ Още една защита срещу черни сгради при натоварен компютър',
  ]],
  ['3.2.1', '27.10.2026', [
    '🏚️ Наистина поправено: сградите, пътищата и надписите вече не стават черни, когато браузърът изгуби картинките си',
    '🚙 Поправено: белият джип и полицейската Лада вече не светят като бели силуети нощем',
  ]],
  ['3.2.0', '27.10.2026', [
    '🚴 Истински колоездачи по велоалеите — въртят педалите, с каски и различни дрехи, много повече в Амстердам и Копенхаген',
    '🚛 ТИР-овете се движат плавно, предницата се вдига по наклоните, а ремаркето следва влекача',
    '🏙️ Крайслер Билдинг в Ню Йорк и кулата Галата в Истанбул — нощем светят',
    '🌳 Истински дървета навсякъде и нюйоркски жилищни блокове с аварийни стълби',
    '🌐 Английската версия вече е без останал български текст',
    '🏚️ Поправено: сградите в Лондон, Париж и Лас Вегас понякога бяха черни денем',
  ]],
  ['3.1.0', '26.10.2026', [
    '🌉 Истински каменни мостове с арки над реките в Париж, Лондон, Москва, Ню Йорк и Вашингтон, плавни брегове с каменни кейове',
    '✈️ Самолети на снижение към летището и полицейски хеликоптер над инцидентите',
    '🏛️ Акрополът с Партенона в Атина, нов Уестминстърски дворец с Биг Бен в Лондон, Айфеловата кула изцяло в парка',
    '🍉 Сергии с плодове и кафенета около площада',
    '🟠 По-леко на слаби компютри: нови настройки „Дворове и паркирани коли“ и „Украса“, изключени на „Много ниско“; избраното ниво се пази',
  ]],
  ['3.0.0', '26.10.2026', [
    '🌐 Играта вече е и на английски — езикът се избира по браузъра или в ⚙️ Настройки',
    '⚽ Футбол на игрищата в кварталите, а вечер хората се прибират пеша и колите паркират пред къщите',
    '🎄 Коледа в града от 1 декември до 6 януари — елха на площада, светлини и празнични прозорци',
    '🛥️ Корабчета и яхти по реките, птици над площадите, знамената на държавата, сняг по покривите',
    '🏛️ Парламентът и базиликата „Св. Стефан“ в Будапеща с площади, нов Колизеум в Рим, Миланската катедрала и Античният стадион в Пловдив',
    '🏢 Високи жилищни кули в балканските и източноевропейските градове',
    '🌃 По-меки нощни пътища и лъчи, без двойни светофари и зебри',
    '⚡ По-бързо зареждане: кодът е сглобен, а моделите се пазят в браузъра — второто влизане почти не тегли нищо',
  ]],
  ['2.10.8', '26.10.2026', [
    '🌅 Залез и изгрев с видимо слънце, облаци, луна и звезди; денонощието е около 3 минути',
    '🌦️ Времето по календара — дъжд няколко пъти в месеца, сняг само през зимата и само където реално вали; снежинки вместо квадрати',
    '⛪ Православни църкви в градовете и храм-паметникът „Св. Александър Невски“ в София',
    '🚉 Път и паркинг до гарата; нови сгради на гарата по нива',
    '🟠 Графика „Много ниско“ и подробни настройки за слаби компютри',
    '🏢 Опитът на фирмата е сборът от всички твои градове — всяко действие навсякъде я качва; сградите на фирмата не се застъпват',
  ]],
  ['2.10.7', '25.10.2026', [
    '🐞 Техническите грешки се изпращат анонимно, за да ги оправяме по-бързо',
    '📊 Анонимна статистика кои части на играта се ползват — само ако си я разрешил в 🔒 Поверителност',
  ]],
  ['2.10.6', '25.10.2026', [
    '🎵 Фонова музика — спокойна в града, динамична при строеж, весела в слънчевите градове; плъзгачи Музика / Ефекти / Град в ⚙️',
    '🔑 Вход и регистрация с имейл и парола — веднага, без код по имейл; смяна на паролата в ⚙️',
    '👋 „Докато те нямаше“ — приходите от отсъствието (до 8 ч)',
    '🗽 Ню Йорк: остров Либърти със статуята, нощем с осветена факла',
    '🏙️ Градовете по картата — без празни парцели около офиса; без мъгла отгоре; старите европейски градове без стъклени кули',
    '🏦 По-проста банка — табове, кредит със срок по избор, IPO от ниво 15',
    '🆕 Известие при нова версия и защита на записите от по-нова версия',
  ]],
  ['2.10.5', '25.10.2026', [
    '🎓 Урок за нов играч — 7 кратки стъпки при първа игра; „Покажи урока пак“ в ⚙️ Настройки',
    '🔒 Поверителност: избор за реклами и статистика, страници „Поверителност“ и „Условия“ (БГ/EN)',
    '🎨 Графика Ниско / Средно / Високо и проверка на компютъра 🟢 🟡 🔴 в ⚙️ Настройки',
    '☁️ По-лек облак: записът се качва компресиран и по-рядко — по-бързо и без загуби',
    '💶 Икономика без вратички: земята не се препродава безкрайно, депозитът е 1%, фалиралите фирми не се изкупуват в цикъл',
    '💾 Записите и облакът — по-сигурни; стабилност и памет при смяна на град; пълен екран „Автори“',
  ]],
  ['2.10.4', '25.10.2026', [
    '🇧🇷 Рио: Христос Спасителя на зелен хълм в залива пред центъра — каменна тераса, серпентина с лампи, нощем осветен',
    '🇷🇺 Москва: ГУМ и сградите в Кремъл (Сенатът, „Иван Велики“, Успенската, Архангелската и Благовещенската катедрала) — моделирани наново, на истинските места, осветени нощем',
    '🇮🇹 Рим и другите италиански градове: истински италиански сгради по улиците, със светещи прозорци нощем',
    '⛲ Фонтани и статуи в градовете — Наполеон във Франция, Щраус във Виена, фонтаните на Уолъс и Обсерваторията в Париж',
    '🏙️ Още 16 истински сгради в града: стари американски, модерен офис, средиземноморска, тухлени, бруклинският ред и Монтгомъри',
    '⛪ Саграда Фамилия в Барселона вече е в истински ръст (~42 м), над квартала',
    '🏢 Парцелът на фирмата: офисът, гаражът и складът са отделни сгради, с плаца и портала',
    '🚌 Нови градски автобуси: ЛиАЗ-5292 и Town Bus',
    '🎰 Лас Вегас: знакът „Welcome to Fabulous Las Vegas“ вече се вижда — без палмите около него',
  ]],
  ['2.10.3', '25.10.2026', [
    '🎰 Лас Вегас: MGM Grand и New York-New York на Стрипа — нощем изумрудената кула на MGM, короната на Емпайър Стейт в сменящи се цветове и Статуята на свободата',
  ]],
  ['2.10.2', '25.10.2026', [
    '🎰 Лас Вегас по истинската карта: Стрипът от знака до Strat, Беладжио и Луксор на местата си, 27 запазени места за казина',
    '🏨 Нови хотели от сканирания Стрип: Paris с Айфеловата кула, Planet Hollywood, Cosmopolitan, Aria и Vdara — нощем светят прозорците, златната кула, LED екраните и неонът',
    '🛣️ Магистралата край града: свързани изходи, плавни ленти за влизане и излизане, бензиностанцията с таблото, магистралата свършва с картата',
  ]],
  ['2.10.1', '25.10.2026', [
    '🇺🇸 Вашингтон: Юниън Стейшън на истинското си място, Капитолият и Белият дом стъпват на земята, без обелиска пред Белия дом; фоновите сгради от федерален камък и без застъпване',
    '🏙️ Бурж Халифа в истински ръст; ⛪ Нотр Дам не слиза в Сена; 🏛️ кметството на Филаделфия се побира на площада; 🏢 истинска кула за централата в Ню Йорк',
    '🎰 Лас Вегас нощем: фонтаните на Беладжио и светещият знак; 🏫 училището в естествени пропорции; по-сигурни фасади (без черни стени)',
  ]],
  ['2.10.0', '24.10.2026', [
    '🚓 Полицейско преследване; „🚓 Извикай полиция“ при задръстване (с обаждане до 911); спешните коли обикалят по кръговото; нови патрулки (Logan „ПОЛИЦИЯ“, Duster „ДПС“)',
    '🚌 Училищни автобуси сутрин и на обяд; съчлененият автобус се пречупва в завоите; 🅿️ колите излизат от паркингите сутрин и се връщат вечер; по-живо движение',
    '🛠️ „🚨 Тръгвайте спешно“ — липсващата техника идва веднага; техниката в офертите — зелено/жълто/червено; 🏙️ % застроен горе; машините не засядат на плаца',
    '🔥 Истински пожари; 🌃 Бурдж Халифа и кметството на Филаделфия нощем; тухлените сгради светят; ⭐ зала на славата с по-широк портрет',
    '📈 Опитът — по-малко от всеки следващ град, държавната поръчка — 30% от нивото (не цяло), ~1,5 ч на ниво; 🏢 сградите в реален ръст; фоновите сгради не влизат в твоите парцели; Вашингтон — Капитолият и гарата оправени',
  ]],
  ['2.9.2', '24.10.2026', [
    '🛠️ Поправено: техника „на път“, която стои с дни, без да тръгне — след 2 дни стига до обекта сама (закъсненията на къщите)',
    '📋 Задачите — пак в горната лента; 🎯 Куестите — в менюто „Империята“',
  ]],
  ['2.9.1', '24.10.2026', [
    '🧠 Много по-малко памет при голяма игра (~600 MB по-малко) — картата на света не трябва да дава „Out of memory“; директорската зала затваря картата, преди да се отвори',
  ]],
  ['2.9.0', '24.10.2026', [
    '🇷🇺 Кремъл в Москва по нови модели: Спаската кула към Червения площад, белият Голям кремълски дворец, ъгловите кули, червената стена с елите, нощно осветление и червени звезди',
    '🇫🇷 Триумфалната арка на площад Етоал (50 м); 🏨 хотел 5★ „Парижка елегантност“ за Франция и Западна Европа',
    '🧠 По-малко памет: 3D сцените (глобус, директорска зала, зала на славата) освобождават видеопаметта веднага',
  ]],
  ['2.8.1', '24.10.2026', [
    '🏢 Блоковете нощем: цели светещи прозорци в топли и хладни тонове, синкави от телевизора, светлините се палят постепенно; фоновите сгради — повече светещи прозорци',
  ]],
  ['2.8.0', '24.10.2026', [
    '⚙️ Звук, известия, помощ, задачи и съвети са в Настройки (⚡ Бързо); жълто число на ⚙️, когато чакат задачи или награди',
    '🚗 Мигачи при завой, смяна на лента и отбиване; 🚌 автобусите стигат до всички спирки; трафикът и пешеходците растат с квартала',
    '🏨 Хотелът 5★ — в пълен ръст в общия парцел; 📦 купчините материали в двора на склада; 🌃 складовете светят нощем',
    '⛽ Бензиностанциите гледат към улицата; 🎯 по-широк панел с куестите — известията не закриват ✕',
  ]],
  ['2.7.3', '24.10.2026', [
    '🏨 Хотелът 5★ / Гранд хотел вече се вижда в града като истинска сграда — Бурдж ал Араб, Марина Бей Сандс, Мариот, Остров или Роза според региона',
  ]],
  ['2.7.2', '24.10.2026', [
    '⭐ Зала на славата: награденият директор говори от трибуна с микрофони, фотографи и портрета му на стената; 🪑 избор на столове в залата',
    '🚌 Градски автобуси по линии със спирки и навеси; 🛤️ жп депо със стари вагони; бариери пред релсите; Истанбул — линията по насип, трамваят не стъпва на релсите',
    '🎬 Филиал в град с клип (Ню Йорк, Истанбул, Париж…) — влизаш в града и гледаш клипа; 🏘️ празните квартали — със сгради; разнообразни сгради в Париж и Истанбул',
    '🛠️ Зареждането не засяда на 99%, ако един модел се забави',
  ]],
  ['2.7.1', '24.10.2026', [
    '🛠️ Поправено: Директорската зала вече не засяда на „Директорите влизат…“ след наемане на директорите; опитът (XP) вече не спира',
    '📈 Нивата 8–20 искат повече опит — играта не прескача толкова бързо',
    '🧹 Махнати 40 неизползвани модела (по-леко зареждане)',
  ]],
  ['2.7.0', '23.10.2026', [
    '🇺🇸 Вашингтон по истинската карта: Нешънъл Мол, Капитолият, Белият дом, Монументът, Линкълн и Отразяващото езеро; 🚆 истински релси, контактна мрежа и прелези с бариери (колите спират преди тях)',
    '🚌 4 истински градски автобуса по региони; без детски коли никъде; пешеходците вървят и стават повече с квартала; паркираните коли — в местата си и без фарове нощем',
    '🚓 Пожарната, полицията и линейките тръгват от участъците си; полиция при задръстване; радио-известие при затворен път',
    '🛠️ Заседналата техника се освобождава сама и обектът пише защо чака; бутоните в „Техника“ разширяват пълния гараж; специалистите се назначават сами, щом има пари',
    '🛟 В началото — повече спешни поръчки и куест „Спасител“ (5 спасени обекта = 400 000 €); 🏦 собствена банка от ниво 17; наградите на директорите идват по-късно',
    '🌳 Истински дървета и при обществените сгради; 🪧 билбордовете не влизат в сгради; 📏 складовете и офисите в реален размер; ⚫ аутобаните на картата — черни',
  ]],
  ['2.6.3', '22.10.2026', [
    '⭐ Под 4 звезди закъсненията не свалят звезди (само по-малко пари) — за да стигнеш до големите поръчки',
  ]],
  ['2.6.2', '22.10.2026', [
    '⭐ Закъсненията вече не свалят звездите толкова: 1 ден закъснение е без наказание за звездите, после малко по малко (най-много −0,15); парите −5% на ден (до −40%)',
    '🏠 Срокът за къща е 11 дни (беше 8)',
    '🏙️ Нов куест „Пълен първи град“: застрой първия град на 100% — награда 500 000 € за втория град',
    '🤝 С партньор можеш да си до 2 нива напред, преди да го чакаш',
    '🚨 Истинските полицейски, пожарни и линейки се зареждат отново',
  ]],
  ['2.6.1', '22.10.2026', [
    '🚨 Бурканите на полицията, линейките и пожарните — двата цвята ясно разделени (червено и синьо), без голямото петно върху цялата лента',
    '🏦 Холдингът: внасяне и теглене с плъзгач като в банката (25/50/75%/Всичко), с лимита за 24 часа',
    '🏛️ Нова картина при зареждане след ниво 20 — „Пътят към политиката“; 🚗 18 нови истински коли по региони',
  ]],
  ['2.6.0', '22.10.2026', [
    '🌊 Морето — една водна повърхност с истински вълни и отражение на небето; лодките се люлеят и оставят следа; брегът и пристанището във Варна по истинската брегова линия',
    '💡 Истински улични лампи (LED 9 м, класически фенери в стария център) и светофари на тротоара с пешеходни светлини',
    '🛝 Дворове с истински огради, пейки и детски площадки; паркинги с места в реален размер; 📦 материалите в склада се различават',
    '🚚 Самосвалът и техниката вече не минават през колите; колите пропускат спешните; светофарите не са разменени; строежите не чакат вечно изгубен ТИР',
    '🏗️ Реални размери: панелни блокове, дървета, офиси; светещи полицейски и пожарни коли и логата на фирмите; без прозрачни модели и отрязани дървета',
    '⚡ По-бързо зареждане без замръзване след „Готово!“; 30% аванс за материалите и заем за материали срещу фалит',
  ]],
  ['2.5.0', '21.10.2026', [
    '🏢 Общ парцел на фирмата: офис, гараж, склад и плац с ограда и 3D логото на марката отгоре; нови офиси и складове от ниво 1 до 10',
    '🚨 Истински инциденти: полицаи, пожарникари, лекари, отцепване и зяпачи; паяк за горящата кола; поправени буркани',
    '🛣️ Магистралата: изпреварване, бензиностанция, изходи към града, табели над пътя и повече коли',
    '🚦 Жп прелези с бариери и звънец, тунели в края на линиите; истински пътни знаци във всички градове',
    '🏡 Кварталите с дворове, паркове и площадки; камбана в града; правилен размер на колите и билбордовете',
    '🛡️ Ясно съобщение, ако браузърът не поддържа 3D (WebGL), вместо да остане на 0%',
  ]],
  ['2.4.0', '21.10.2026', [
    '🏆 Стена на отличията в залата — 10 награди за директорите (бронз → платина) с церемония; трезорът с истински пари и злато',
    '🌍 След ниво 21 директорите предлагат всичко до 100% завладяване; ⚡ по-гладък голям град',
    '🚐 Истински бусове с логото на фирмата; 🏗️ анимирани кранове, багери, самосвали и валяци в реален размер; истинско събаряне',
    '🔥 Пожарите: пожарна, гасене, здравина на сградата, спешен ремонт, изгорели руини; 🚨 сирените точно на колите',
    '🪧 Билбордове с фирмата по булевардите; 🌳 истински дървета навсякъде; 🏢 офис, гараж и склад заедно, алеи до сградите',
    '🛣️ Нови улици, истинско кръгово, колите, ТИР-овете и техниката по лентите; поправени NaN цени и застъпени сгради',
  ]],
  ['2.3.0', '21.10.2026', [
    '🏦 Трезорът зад директорската зала — кръглата стоманена врата, пачките и златото (демо в Лабораторията)',
    '🪑 Директорите вече не потъват в столовете; логото на дъщерната фирма е и на облегалката',
    '🛣️ Аутобаните се строят с истински багери, грейдери и кранове; по тях карат истински коли и полиция',
    '🏔️ Курортите — без детските хижи и снежни борове, само истинските модели',
    '⚡ Подготовка за по-гладък голям град и за предложенията „до 100% завладяване“ (скоро)',
  ]],
  ['2.2.0', '20.10.2026', [
    '🚀 Смяна на град без презареждане — 1–2 секунди вместо половин минута; без течове на памет',
    '🅿️ Плац за техниката до офиса — машините паркират в редици; 🏔️ курортите с истински хижи, пейки и фенери; детските къщи са изтрити',
    '🗽 Таймс Скуеър със светещи екрани; Рокфелер, Радио Сити, новата Емпайър Стейт; нощем светят и обществените сгради',
    '🏛️ Обществените сгради са високи колкото съседите; римските сгради — 4–6 етажа като в истинския център',
    '🔑 До 5 твои имота на град; складът пълни сам от ниво 2; „Какво е това?“ — веднъж и стига; корабите и самолетите без тавана 60',
  ]],
  ['2.1.0', '20.10.2026', [
    '⚡ По-бърза игра: голям град 3 → 6–7 кадъра в секунда, без забиването на всеки 3 секунди, по-кратък край на деня при 4×; градовете по истинската карта се отварят поетапно',
    '🗽 Нови градове по истинската карта: Истанбул, Лондон, Ню Йорк и Москва (с Рим и Париж); Емпайър Стейт, Гранд Сентрал, Рокфелер, Радио Сити, Св. Патрик, Уестминстър, Момината кула, Сен Лазар; нощем светят прозорците, улиците и забележителностите',
    '🏙️ Новите градове от 16-те шаблона, миникарта, светлинни колони над парите отдалеч, празни парцели с табела „Продава се“; Империал Сити — винаги на картата',
    '🚆 Влакове по 2 на линия, кораби колкото кейовете, самолети колкото гейтовете — без тавана 60; 41 нови аутобана в Европа; контур на възможните трасета при строене',
    '🤝 Партньорство: общо ниво, общ флот, линиите в цвета на партньора, Център на партньорството; 🔑 вход с парола; по-малко излишни известия',
  ]],
  ['2.0.1', '20.10.2026', [
    '⛔ Извънредно заседание на борда за супер поръчките и поръчките над 25% от касата; 🆘 Борис пази холдинга: още 10% на борсата при ниска каса или банка под капиталовия минимум, SOS заседание при минус',
    '🗺️ Магистралите светят в синьо, аутобаните — в червено; 🏢 централата с различен облик във всеки град',
    '🔧 Поправки: „Липсват“ без нищо липсващо, придобиванията от ниво 16 през Констръкшън',
  ]],
  ['2.0.0', '20.10.2026', [
    '🇮🇹 Рим по истинската карта: истинските улици, Тибърът в коритото с каменните мостове (ангелите на Сант\'Анджело), рионе с парцели по нива, Термини, летището към Фиумичино, Колизеумът и Витториано на реалните им места; новите игри — направо там, а старите записи без филиал в Рим — също; с филиал — по избор, с изкупуване',
    '🏛️ Поръчки на общината: болници, училища, пожарни… където не стигат, със строеж стъпка по стъпка; 🚦 трафик по ленти и светофари в Рим',
    '👔 Директорите: реалистични събития (заплата, насрещно предложение, синдикат, проверка), поемат и имотите, курортните събития, Ориент Експрес и Пътя на коприната; поправени 3D моделите и позите в залата',
    '🌍 Мисии: Ормузкият проток и възстановяване на район; 🏆 завладяването вече стига до 100% и в Азия; поправки в магазина за влакове и разширяването на гаража',
  ]],
  ['1.2.3', '19.10.2026', [
    '🌍 Геополитика: приближение свят → регион → държава, групирани събития, панели за Украйна и Израел/Палестина, активни мисии; хуманитарен достъп с решения на място',
    '🚦 Трафикът по ленти: колони, предимство, светофари с ляв завой, мигачи, стопове и фарове, кръгови, изходи от града',
    '🚒 Оперативни мисии: наводнение, пожар и хуманитарен достъп',
    '👏 Залата: истински аплодисменти; 🚑 по-големи линейки; истински модели по строежите и заводите',
  ]],
  ['1.2.2', '19.10.2026', [
    '📝 Мирни пакети: страните предлагат конкретни промени, „✍️ Вземи насрещното“, когато така приемат всички',
    '👔 Директорите: настроение, оплаквания, примамване от конкуренти, стачки, скандали, „Директор на годината“; екран със снимката при назначаване',
    '🏢 Нивата: лента за напредъка на всяко ниво — колко процента и колко опит остават, на живо',
    '🇬🇧 Лондон: река Темза с мостове и London Eye; 🌃 фаровете на колите, Рио и централата нощем; нов джет на картата; картинки за избора САЩ/Русия',
  ]],
  ['1.2.1', '18.10.2026', [
    '🗳️ Мегапроектите (петролопровод, Суец, Гибралтар, хиперлуп) се решават задължително с гласуване на борда',
    '👔 Ивайло Петров поема Констръкшън сам в ерата на холдинга; Александър Владимиров (Глобъл) — със свой модел в залата',
    '⚡ Залата не забива при масови решения (стотици квартали наведнъж — един запис и едно известие); опитът се показва след заседанието',
    '🌃 Ню Йорк нощем: Манхатън, Northwestern Mutual и стъклените кули с прозорци',
  ]],
  ['1.2.0', '18.10.2026', [
    '🌍 Президентският етап (нива 25–35): изборите в 🇺🇸 САЩ (51 щата) или 🇷🇺 Русия (83 региона), Министерски съвет в Белия дом или Кремъл, държавен бюджет отделно от фирмата',
    '🗺️ Световна политическа карта: столици, отношения, нужди и конфликти; мирни пакети (проверка, гаранции, възстановяване) — страните приемат, отказват или връщат насрещно с причина',
    '🌊 Кризи: Ормузкият проток, продоволствена криза, природни бедствия; помощта се брои само когато работи (доставка, ток, персонал, издръжка); 🏁 ниво 35 „Световен мир“ — финалът на играта',
    '🏙️ Империал Сити (нива 21–25): твой град в САЩ или Русия, кмет Десислава Илиева, услуги, транспорт, удовлетвореност и кризи — до „Град за пример“',
    '👔 Директорите поемат всичко след ниво 15: Гараж, Оферти, Градове, Добив, Банка и държавните търгове стават техни екрани; гласуване с вдигане на ръка',
    '🖼️ Картинка на цял екран за всичките 35 нива; истински светофари, пътни знаци и къщи (Лаборатория); по-бърза зала и карта без забиване',
    '🏛️ Борд на директорите: всяко дружество има свой директор; веднъж месечно бордът заседава — първо отчет, после банката (налични, резерв, бюджет за инвестиции), после предложенията',
    '👔 Директорите поемат жп, магистралите, пристанищата, летищата, петрола, хотелите и Глобъл: техните прозорци стават отчет с предложения „Да / По-късно / Не“',
    '🗳️ Когато банката възрази — директорите гласуват (съвещателно), решението е твое; месечни бюджети и 🤖 автопилот по директор',
    '🎥 Директорската зала в 3D: 9 анимирани директора около масата, холограма над нея с държавата, градовете и обектите на всяко предложение',
    '🗺️ Картата: степени на детайлност и по-бърза; границите над дивото; жп линиите — по сушата',
    '🏦 Банка: дивиденти, държавни кризи и световни събития; 📈 борса — кой притежава холдинга',
    '🛣️ Магистрали: екип за всеки град, по-бърз строеж с нивото, линейки, полиция и пожарна по трасето',
    '🏖️ Курорти: изплащат се за ~1,25 г., наем извън сезона, разширенията поне +50%',
  ]],
  ['1.1.0', '17.10.2026', [
    '🏢 Нивата на фирмата: картинка на цял екран за всяко от 20-те нива; заключените нива са замъглени',
    '🏛️ Дъщерни фирми с лога и екран при основаване; 🏦 своя банка (10 млрд. €); хотели 5★ и Гранд в мащаба на милиардите',
    '⛽ Бензиностанции в градовете (Петролиум) — одобрените модели от Лабораторията',
    '🚨 12 вида инциденти в града: полиция, пожарна и линейка идват по улиците, със сирени, когато си близо',
    '🚗 Всички коли в истински размер; колите се спират и заобикалят една друга; още сирени',
    '🚚 Лимити: ТИР-ове, влакове, кораби и самолети според магистралите, линиите, пристанищата и летищата',
    '🚜 Гараж: клетките светят и купуваш с едно натискане; продажба на излишната пътна техника; завършените градове — скрити',
    '🛣️ Аутобанът край града — 4+4 ленти, възел и табели; ✈️ летищата — писти според нивото, светеща кула, прозорци на самолетите',
    '🌴 Лос Анджелис по истинската карта с надписа HOLLYWOOD; 🗽 небостъргачите на Ню Йорк по квадратите',
    '🗺️ Картата: пътищата по сушата, пустите държави в зелено, отдалеч — само ключовите градове; „Моите градове“ — само активните',
    '📊 Горната лента на един ред („Империя ▾“); 🏢 горе — само нивото на фирмата',
    '🏗️ Поправено: материалите стигат до обекта за под ден (къщите вече не закъсняват); магистралите не стоят без техника',
  ]],
  ['1.0.0', '14.10.2026', [
    '⚙️ Настройки: вход и изход, хора онлайн, изтриване на данните и на акаунта',
    '🤝 Партньорство: обща карта (магистрали, жп, филиали), обща касичка-холдинг, дивиденти, акции на борсата',
    '🛣️ Магистрали от град до град (като жп) и ⬆️ ъпгрейд на магистрала в аутобан',
    '🚛 ТИР-ове по магистралите — сами избират курсовете',
    '🏖️ Курортите носят повече наем',
    '🗺️ По-чиста карта: по-малко надписи отдалеч, маркиране на избран град',
    '💾 Автозаписи на всеки 5 мин и връщане на стар запис („💾 Записи“ → „🕒 Автозаписи“)',
    '🚆 Поправено: влак без линия вече не спира играта',
  ]],
];
const seenKey = 'stroi-seen-ver';
function changesHtml() {
  return CHANGES.slice(0, 2).map(([v, d, L], i) => `<div style="margin-top:${i ? 10 : 0}px"><b style="color:var(--txt)">v${v}</b> <span style="color:var(--mut)">· ${d}</span>
    <ul style="margin:4px 0 0;padding-left:18px;font-size:13px;line-height:1.6;color:var(--mut)">${L.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('');
}
// hooks от game.js: credits(), newGame(), lock() — записва и спира записите (преди изтриване)
let hooks = {};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sec = (t, body) => `<div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px"><div style="font-weight:700;margin-bottom:6px">${t}</div>${body}</div>`;
const sbtn = (id, t, cls = 'btn2', st = '') => `<button class="${cls}" id="${id}" style="padding:7px 12px;${st}">${t}</button>`;
function openSettings(h) {
  if (h) hooks = h;
  try { localStorage.setItem(seenKey, VERSION); } catch { }
  const ppl = online();
  const el = dlg(`<button id="stX" title="Затвори" aria-label="Затвори" style="position:sticky;top:0;display:block;margin:0 0 -34px auto;z-index:2;width:34px;height:34px;border-radius:9px;border:1px solid var(--line);background:#1b2433;color:var(--txt);font-size:18px;line-height:1;cursor:pointer">✕</button><h2 style="font-size:19px;color:var(--acc)">⚙️ Настройки</h2>
    ${hooks.quick ? sec('⚡ Бързо', `<div style="display:flex;flex-direction:column;gap:6px">${hooks.quick().map((r, i) => `<button class="btn2" id="stQ${i}" style="display:flex;align-items:center;gap:10px;text-align:left;padding:9px 12px"><span style="font-size:20px;width:26px;text-align:center">${r.ico()}</span><span style="flex:1">${r.nm()}</span></button>`).join('')}</div>`) : ''}
    ${hooks.audio ? sec('🔊 Звук', ['music:🎵 Музика', 'fx:🔔 Ефекти', 'city:🏙️ Град'].map(r => { const [k, t] = r.split(':'), v = Math.round((hooks.audio.levels()[k] ?? 1) * 100);
      return `<label style="display:flex;align-items:center;gap:10px;font-size:14px;margin:4px 0"><span style="width:90px">${t}</span><input type="range" min="0" max="100" step="5" value="${v}" data-mix="${k}" style="flex:1"><span style="width:38px;text-align:right;color:var(--mut)">${v}%</span></label>`; }).join('')) : ''}
    ${sec('☁️ Акаунт', anonU(user) ? `<div style="font-size:14px;color:var(--mut);line-height:1.5"><b style="color:var(--txt)">👤 Гост (записът е в облака)</b> — играта се пази в облака на това устройство. Създай акаунт, за да играеш и от друго устройство и за партньорство.${lastErr ? `<br><span style="color:var(--bad)">Последна грешка: ${esc(lastErr)}</span>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${sbtn('stUp', '🆕 Създай акаунт', 'btn')}${sbtn('stHave', '🔑 Имам акаунт')}${sbtn('stCloud', '☁️ Записи в облака')}</div>`
      : user ? `<div style="font-size:14px;color:var(--mut);line-height:1.5">Влязъл си като <b style="color:var(--txt)">${esc(user.email)}</b> — играта се пази в облака.${lastErr ? `<br><span style="color:var(--bad)">Последна грешка: ${esc(lastErr)}</span>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${sbtn('stCloud', '☁️ Записи в облака')}${PW ? sbtn('stPw', '🔑 Смени паролата') : ''}${sbtn('stOut', '🚪 Изход')}</div>`
      : `<div style="font-size:14px;color:var(--mut);line-height:1.5">Не си влязъл. С вход (${PW ? 'имейл и парола' : 'имейл + код, без парола'}) играта се пази в облака и можеш да играеш от няколко устройства.</div><div style="margin-top:8px">${GC ? sbtn('stIn', '🔑 Влез', 'btn') + ' ' + sbtn('stNewAcc', '🆕 Създай акаунт') : sbtn('stIn', '☁️ Вход', 'btn')}</div>`)}
    ${sec(`👥 Онлайн сега: <span id="stN">${ppl.length}</span>`, `<div id="stPpl" style="font-size:13px;line-height:1.7;max-height:150px;overflow:auto">${pplHtml(ppl)}</div>`)}
    ${sec(`🆕 Ъпдейти <span style="font-weight:400;color:var(--mut);font-size:13px">· версия ${VERSION}</span>`, `<div style="max-height:170px;overflow:auto">${changesHtml()}</div>`)}
    ${sec('🎮 Игра', `<div style="display:flex;gap:6px;flex-wrap:wrap">${hooks.saves ? sbtn('stSaves', '💾 Записи') : ''}${hooks.rename ? sbtn('stRen', '✏️ Име на фирмата') : ''}${hooks.credits ? sbtn('stCred', '📜 Автори') : ''}${hooks.newGame ? sbtn('stNew', '🔄 Нова игра') : ''}</div>`)}
    ${langOn() ? sec('🌐 Език · Language', `<div style="display:flex;gap:6px;flex-wrap:wrap" data-noi18n>${sbtn('stLangBg', (LANG === 'bg' ? '✅ ' : '') + '🇧🇬 Български')}${sbtn('stLangEn', (LANG === 'en' ? '✅ ' : '') + '🇬🇧 English')}</div>`) : ''}
    ${feature('consent') ? sec('🔒 Поверителност', `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${window.consent?.adsLive ? sbtn('stCons', '🍪 Съгласие: статистика') + sbtn('stAdsCons', '📺 Реклами — настройки за съгласие') : sbtn('stCons', '🍪 Съгласие: реклами и статистика')}<a href="privacy.html" target="_blank" rel="noopener" style="color:var(--acc);font-size:14px">Поверителност</a><span style="color:var(--mut)">·</span><a href="terms.html" target="_blank" rel="noopener" style="color:var(--acc);font-size:14px">Условия</a></div>`) : ''}
    ${sec('⚠️ Опасна зона', `<div style="font-size:13px;color:var(--mut);line-height:1.5">„Изтрий данните“ маха всички записи на това устройство${user ? ' и в облака. „Изтрий акаунта“ маха и самия акаунт (имейла) завинаги' : ''}.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${sbtn('stWipe', '🗑️ Изтрий данните', 'btn2', 'color:var(--bad)')}${user && !anonU(user) ? sbtn('stDel', '❌ Изтрий акаунта', 'btn2', 'color:var(--bad)') : ''}</div>`)}`,
    [['Затвори', null, 1]]);
  el.firstElementChild.style.maxHeight = '92vh'; el.firstElementChild.style.overflow = 'auto';
  const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = () => { el.remove(); f(); }; };
  { const x = el.querySelector('#stX'); if (x) x.onclick = () => el.remove(); }   // ✕ горе — без да скролваш до „Затвори“
  on('stIn', () => GC ? regGate() : loginEmail()); on('stUp', guestUpgrade); on('stHave', guestLogin); on('stNewAcc', regGate);   // 👤 guest-cloud: „🔑 Влез / 🆕 Създай акаунт“ — същият екран, при поискване on('stPw', changePw); on('stCloud', openCloud); on('stCred', () => hooks.credits()); on('stRen', () => hooks.rename()); on('stSaves', () => hooks.saves()); on('stNew', () => hooks.newGame()); on('stCons', () => window.consent?.open()); on('stAdsCons', () => window.consent?.adsOpen());
  on('stOut', () => dlg(`<h2 style="font-size:19px;color:var(--acc)">🚪 Изход?</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Играта на това устройство остава. Влез пак със същия имейл, за да продължи да се пази в облака.</p>`,
    [['Отказ', null], ['🚪 Изход', () => { syncAll(false).finally(() => sb.auth.signOut().then(() => toast('🚪 Излезе от акаунта.'))); }, 1]]));
  on('stLangBg', () => setLang('bg')); on('stLangEn', () => setLang('en'));   // 🌐 lang-en
  on('stWipe', () => confirmWipe(false)); on('stDel', () => confirmWipe(true));
  if (hooks.quick) hooks.quick().forEach((r, i) => { const b = el.querySelector('#stQ' + i); if (!b) return;   // (top-set) звукът и известията — на място (надписът се сменя), другите затварят настройките
    b.onclick = () => { if (!r.keep) el.remove(); r.fn(); if (r.keep) { const s = b.querySelectorAll('span'); s[0].textContent = r.ico(); s[1].innerHTML = r.nm(); } }; });
  el.querySelectorAll('[data-mix]').forEach(r => r.oninput = () => { hooks.audio?.set(r.dataset.mix, r.value / 100); r.nextElementSibling.textContent = r.value + '%'; });   // 🎵 music: плъзгачите
  pplEl = el;
}
const pplHtml = L => L.length ? L.map(p => `<div>${p.me ? '🟢' : '🟡'} <b>${esc(p.name || 'Играч')}</b>${p.me ? ' (ти)' : ''} <span style="color:var(--mut)">· ${esc(p.city || '')}${p.day ? ` · ден ${p.day | 0}` : ''}</span></div>`).join('') : '<span style="color:var(--mut)">Свързвам се…</span>';
// изтриване: пишеш ИЗТРИЙ, за да няма случайно натискане
function confirmWipe(account, fresh = false) {   // fresh — „🆕 Нова игра“ от картата: същото изтриване, друго заглавие
  const el = dlg(`<h2 style="font-size:19px;color:var(--bad)">${account ? '❌ Изтрий акаунта' : fresh ? '🆕 Нова игра — изтрива всичко' : '🗑️ Изтрий данните'}</h2>
    <p style="color:var(--mut);font-size:14px;line-height:1.5">${account ? `Акаунтът <b style="color:var(--txt)">${esc(user?.email)}</b>, записите в облака и партньорството се изтриват <b>завинаги</b>. Играта на това устройство също се изтрива.`
      : `Всички записи (3-те слота), автозаписите и настройките на това устройство${user ? ' — и <b style="color:var(--txt)">всичко твое в облака</b>: записите и онлайн империята; от партньорството излизаш (то остава за партньора ти)' : ''} се изтриват <b>завинаги</b>. Играта започва отначало.${user ? ' Акаунтът остава.' : ' (Ако имаш записи в облака, влез в акаунта, за да се изтрият и те.)'}`}<br><br>Напиши <b style="color:var(--txt)">ИЗТРИЙ</b>, за да потвърдиш:</p>
    <input id="stConf" autocomplete="off" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:16px;text-transform:uppercase">
    <div id="stMsg" style="font-size:13px;color:var(--bad)"></div>`,
    [['Отказ', null], [account ? '❌ Изтрий акаунта' : '🗑️ Изтрий', () => {
      const m = el.querySelector('#stMsg');
      if (!['ИЗТРИЙ', 'DELETE'].includes(el.querySelector('#stConf').value.trim().toUpperCase())) {   /* 🌐 lang-en: и на английски */ m.textContent = 'Напиши ИЗТРИЙ.'; return false; }
      m.style.color = 'var(--mut)'; m.textContent = 'Изтривам…';
      wipeAll(account).catch(e => { m.style.color = 'var(--bad)'; m.textContent = 'Не стана: ' + ((e && e.message) || 'няма връзка') + '. Нищо не е изтрито.'; });
      return false;
    }]]);
  setTimeout(() => el.querySelector('#stConf')?.focus(), 50);
}
async function wipeAll(account) {
  if (user) {   // първо облакът — ако не стане, на устройството нищо не се пипа (иначе облакът би върнал записа)
    const { data, error } = await sb.rpc('delete_my_data', { p_account: !!account });
    if (error) throw new Error(/PGRST202|Could not find/i.test(error.message + error.code) ? 'сървърът още не поддържа това' : error.message);
    if (data && data.ok === false) throw new Error(data.err || 'грешка');
  }
  hooks.lock?.(); wiping = true;   // играта спира да записва (и при затваряне на страницата)
  await dropBackups();
  // входът ('stroi-auth') остава — „Нова игра“ / „Изтрий данните“ не те изхвърлят от акаунта (иначе при следващото отваряне пак искаше код)
  const DEV_KEEP = feature('ui-batch2') ? ['stroi-gfx', 'stroi-pc-anyway'] : [];   // ui-batch2: графиката е на компютъра, не на играта — остава
  for (const k of Object.keys(localStorage)) if (/^stroi|^sb-/.test(k) && (account || k !== 'stroi-auth') && !DEV_KEEP.includes(k)) localStorage.removeItem(k);
  if (account) await sb.auth.signOut({ scope: 'local' }).catch(() => { });
  toast(account ? '❌ Акаунтът е изтрит.' : '🗑️ Данните са изтрити.');
  setTimeout(() => location.reload(), 700);
}

// 👥 кой играе сега (Supabase Realtime presence — без база; виждат се само име на фирмата, град и ден)
let pres = null, pplEl = null, presState = {};
const myKey = (() => { let k = ''; try { k = sessionStorage.getItem('stroi-pres') || ''; if (!k) { k = crypto.randomUUID(); sessionStorage.setItem('stroi-pres', k); } } catch { k = String(Math.random()); } return k; })();
function online() {
  const L = [];
  for (const [k, arr] of Object.entries(presState)) { const p = Array.isArray(arr) && arr[arr.length - 1]; if (p && typeof p === 'object') L.push({ name: String(p.name ?? '').slice(0, 40), city: String(p.city ?? '').slice(0, 40), day: Math.max(0, +p.day | 0), me: k === myKey }); }   // presence приема всичко от всеки клиент — само тези три полета, низове/число
  return L.sort((a, b) => (b.me - a.me) || (b.day | 0) - (a.day | 0)).slice(0, 50);
}
function presRender() {
  if (!pplEl || !document.body.contains(pplEl)) return;
  const L = online(), n = pplEl.querySelector('#stN'), box = pplEl.querySelector('#stPpl');
  if (n) n.textContent = L.length; if (box) box.innerHTML = pplHtml(L);
}
const meInfo = () => { try { return window.__stroiMe?.() || null; } catch { return null; } };
let lastMe = '', lastAt = 0, presTm = 0, idleTm = 0;
function presTrack() {
  if (!pres) return;
  const me = meInfo() || { name: 'Нов играч', city: '', day: 0 }, k = LITE ? me.name + '|' + me.city : JSON.stringify(me);
  if (LITE && k === lastMe && Date.now() - lastAt < 600000) return;   // cloud-lite: денят — най-много на 10 мин; име/град — веднага
  if (k !== lastMe || LITE) { lastMe = k; lastAt = Date.now(); pres.track(me).catch(() => { }); }
}
function presStart() {
  if (pres || AUTOTEST) return;
  try {
    pres = sb.channel('stroi-online', { config: { presence: { key: myKey } } });
    pres.on('presence', { event: 'sync' }, () => { presState = pres.presenceState(); presRender(); })
      .subscribe(st => { if (st === 'SUBSCRIBED') { lastMe = ''; presTrack(); } });
    if (!presTm) presTm = setInterval(presTrack, LITE ? 60000 : 30000);
  } catch { pres = null; }
}
// cloud-lite: таб, скрит над 3 мин, затваря връзката за „👥 Онлайн“ (по-малко едновременни връзки към сървъра); при връщане — пак
function presIdle(hidden) {
  clearTimeout(idleTm);
  if (!hidden) { presStart(); return; }
  idleTm = setTimeout(() => { if (!pres) return; sb.removeChannel(pres).catch(() => { }); pres = null; presState = {}; }, 180000);
}

// ── синхронизация ──
async function upload(n, raw) {
  const { data, error } = await sb.from('saves').upsert({ user_id: user.id, slot: 's' + n, data: await pack(raw), meta: metaOf(raw), updated_at: new Date().toISOString() }).select('updated_at').single();
  if (error) throw error;
  setSync(n, { ts: data.updated_at, sig: sig(raw) });
  try { localStorage.removeItem(emptyKey(n)); } catch { }
}
// записът на текущия слот, свален от облака, не бива да се презапише от играта (тя още държи стария в паметта) преди презареждането
const setItem0 = Storage.prototype.setItem; let locked = null;
let wiping = false;
Storage.prototype.setItem = function (k, v) { if (k === locked || (wiping && /^stroi/.test(k))) return; return setItem0.call(this, k, v); };
async function take(n, row) {
  if (tooNew(row.data)) return newerIn(n);   // ver-notice: по-нов формат — не се сваля
  await backupRaw(n, localStorage.getItem(keyOf(n)), 'преди облака');   // сегашният запис остава в „🕒 Автозаписи“
  const raw = JSON.stringify(row.data);
  setItem0.call(localStorage, keyOf(n), raw);
  if (n === curSlot()) locked = keyOf(n);
  setSync(n, { ts: row.updated_at, sig: sig(raw) });
}
// при старт / вход: сравнява всеки слот с облака
async function pullAll(rowsIn) {   // rowsIn — само тестът в Лабораторията (__cloudPullTest)
  if (LITE && !rowsIn && await unchanged()) return pushChanged();   // cloud-lite: в облака нищо ново → без да се свалят целите записи
  const { data: rows, error } = rowsIn ? { data: rowsIn } : await sb.from('saves').select('slot,data,meta,updated_at');
  if (error) throw error;
  for (const r of rows || []) r.data = await unpack(r.data);
  const cloud = Object.fromEntries((rows || []).map(r => [r.slot, r]));
  let reload = false;
  for (let n = 1; n <= SLOTS; n++) {
    const raw = localStorage.getItem(keyOf(n)), c = cloud['s' + n], s = getSync(n);
    if (c && tooNew(c.data)) { newerIn(n); continue; }   // ver-notice: записът в облака е от по-нова версия — нито се сваля, нито се презаписва
    newer.delete(n);
    if (!c) { if (raw) await upload(n, raw); continue; }
    if (FIX && localStorage.getItem(emptyKey(n))) { if (raw) await upload(n, raw); continue; }   // нова игра след „Нова игра“: тя е истинската, облачната — старата
    const localChanged = raw && (!s || s.sig !== sig(raw));
    const cloudNewer = !s || c.updated_at !== s.ts;
    // облакът е по-нов, но играта в него е по-назад (по-малко дни или друга фирма) → никога без питане
    const lm0 = raw ? metaOf(raw) : null, cm0 = c.meta || metaOf(JSON.stringify(c.data)), behind = lm0 && cm0 && ((cm0.day | 0) < (lm0.day | 0) || (cm0.city && lm0.city && cm0.city !== lm0.city));
    if (!raw || (cloudNewer && !localChanged && !behind)) { if (cloudNewer || !raw) { await take(n, c); if (n === curSlot()) reload = true; } }
    else if (cloudNewer && (localChanged || behind)) {
      if (FIX ? sameSave(c.data, raw) : sig(JSON.stringify(c.data)) === sig(raw)) { setSync(n, { ts: c.updated_at, sig: sig(raw) }); continue; }   // fix-saves: еднакво съдържание → не е конфликт
      const choice = await new Promise(res => {
        const lm = metaOf(raw), cm = c.meta || metaOf(JSON.stringify(c.data));
        const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Два различни записа (слот ${n})</h2>
          <p style="color:var(--mut);font-size:14px;line-height:1.6">На това устройство: <b style="color:var(--txt)">ден ${lm.day} · ${fmt(lm.money)} € · ${lm.done} обекта</b><br>
          В облака (от друго устройство): <b style="color:var(--txt)">ден ${cm.day} · ${fmt(cm.money)} € · ${cm.done} обекта</b><br><br>${behind ? '<b style="color:var(--bad)">⚠️ В облака играта е по-назад — може би е започната отначало на друго устройство.</b><br>' : ''}Кой да остане? Другият ще бъде заменен (но остава в „💾 Записи“ → „🕒 Автозаписи“).</p>`,
          [['📱 Този тук', () => res('local'), behind ? 1 : 0], ['☁️ От облака', () => res('cloud'), behind ? 0 : 1]]);
        if (FIX) {   // fix-saves: друг dlg() (⚙️ Настройки) маха този без отговор → без избор (иначе busy оставаше true завинаги и облакът спираше); след 10 мин — също
          const done = () => { mo.disconnect(); clearTimeout(tm); res(null); };
          const mo = new MutationObserver(() => { if (!el.isConnected) done(); }); mo.observe(document.body, { childList: true });
          const tm = setTimeout(() => { el.remove(); done(); }, 600000);
        }
      });
      if (!choice) { held.add(n); heldAt = Date.now(); continue; }   // нищо не се качва/сваля — пита се пак (syncTick)
      held.delete(n);
      if (choice === 'cloud') { await take(n, c); if (n === curSlot()) reload = true; } else await upload(n, raw);
    } else if (localChanged) await upload(n, raw);
  }
  if (reload) { toast('☁️ Зареждам по-новия запис от облака…'); setTimeout(() => location.reload(), 900); }
}
// cloud-lite: само слот + час от облака — ако съвпадат с последно качените/свалените и няма висящ конфликт или „нарочно празен“ слот, пълното сравнение не трябва
async function unchanged() {
  if (held.size) return false;
  const { data, error } = await sb.from('saves').select('slot,updated_at');
  if (error) throw error;
  const ts = Object.fromEntries((data || []).map(r => [r.slot, r.updated_at]));
  for (let n = 1; n <= SLOTS; n++) {
    const raw = localStorage.getItem(keyOf(n)), s = getSync(n), t = ts['s' + n];
    if (localStorage.getItem(emptyKey(n)) || (t ? !s || s.ts !== t : !!raw)) return false;
  }
  return true;
}
// периодично: качва слотовете, които са се променили
async function pushChanged() {
  for (let n = 1; n <= SLOTS; n++) {
    const raw = localStorage.getItem(keyOf(n)), s = getSync(n);
    if (raw && (!s || s.sig !== sig(raw)) && !held.has(n) && !newer.has(n)) await upload(n, raw);   // held — неразрешен конфликт: не се презаписва облакът
  }
}
// fix-saves: слотовете с неразрешен конфликт (диалогът е затворен без избор) — периодично се пита пак, но не върху друг диалог
const held = new Set(); let heldAt = 0;
// ver-notice: слотовете, чийто запис в облака е от по-нова версия на играта (cloud ↔ vernotice — през window, без import)
const newer = new Set();
function newerIn(n) { newer.add(n); const f = window.__verNotice?.cloudNewer; if (f) f(n); else (window.__verPend = window.__verPend || []).push(n); }
const syncTick = () => syncAll(held.size > 0 && Date.now() - heldAt > 120000 && !document.getElementById('cloudDlg'));
async function syncAll(full) {
  if (!user || busy || AUTOTEST) return;
  busy = true; paint();
  try { await (full ? pullAll() : pushChanged()); lastErr = ''; }
  catch (e) { lastErr = (e && e.message) || 'няма връзка'; }
  busy = false; paint();
}

sb.auth.onAuthStateChange((ev, session) => {
  const was = user; user = session?.user || null; paint();
  if (GC && user && !anonU(user)) setGuest(false);
  if (GC && anonU(was) && user && was.id !== user.id) for (let n = 1; n <= SLOTS; n++) try { localStorage.removeItem(syncKey(n)); } catch { }   // гост → друг акаунт: отпечатъците са на госта — сравнява се наново (при два записа — пита)
  if (user && (!was || was.id !== user.id)) syncAll(true);
});
// ── 📧 екранът при отваряне (feature 'reg-gate'): първо „Регистрирай имейл“ (код по пощата), после „▶ Влез в играта“.
// Регистрираните не го виждат. „Играй без регистрация“ — само за това отваряне. В Лаб (iframe) — само с ?gate.
function regGate() {
  if (document.getElementById('regGate')) return;
  const el = document.createElement('div'); el.id = 'regGate';
  el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(rgba(5,7,11,.55),rgba(5,7,11,.75)),url(assets/ui/splash.webp) center/cover #05070b;font-family:system-ui,sans-serif';
  const inp = 'width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #3a4560;background:#0f141c;color:#fff;font:600 16px system-ui,sans-serif;margin:6px 0';
  const go = 'width:100%;padding:13px;border:0;border-radius:12px;background:#f5b942;color:#111;font:800 17px system-ui,sans-serif;cursor:pointer;margin-top:8px';
  el.innerHTML = `<div style="width:min(420px,100%);background:#0c1018;border:1px solid #c9a14a;border-radius:16px;padding:20px 20px 14px;color:#e6edf6;box-shadow:0 20px 60px #000">
    <div style="font:900 24px system-ui,sans-serif;color:#ffd54a;text-align:center">🏗️ Строителна империя</div>
    <div id="rgBody"></div>
    <div style="text-align:center;margin-top:12px"><a href="#" id="rgSkip" style="color:#8b96a8;font-size:13px">Играй без регистрация</a></div>${feature('consent') ? '<div style="text-align:center;margin-top:8px;font-size:12px;color:#6b7688">С регистрацията приемаш <a href="terms.html" target="_blank" rel="noopener" style="color:#8b96a8">Условията</a> и <a href="privacy.html" target="_blank" rel="noopener" style="color:#8b96a8">Поверителността</a></div>' : ''}</div>`;
  document.body.appendChild(el);
  if (langOn()) { const lb = langButton(); lb.style.cssText = 'position:absolute;top:12px;right:12px;padding:6px 10px;border-radius:9px;border:1px solid #3a4560;background:#0f141c;color:#e6edf6;font:600 14px system-ui,sans-serif;cursor:pointer'; el.appendChild(lb); }   // 🌐 lang-en
  const body = el.querySelector('#rgBody'), close = () => { el.remove(); };
  el.querySelector('#rgSkip').onclick = e => { e.preventDefault(); if (GC) { setGuest(true); guestSignIn(); } close(); };   // 👤 guest-cloud: изборът се помни, а записът отива в облака като гост
  const msg = (t, bad) => { const m = body.querySelector('.rgMsg'); m.style.color = bad ? '#ff6b6b' : '#8b96a8'; m.textContent = t; };
  const PASS = feature('reg-pass'), lastMail = () => { try { return localStorage.getItem('stroi-email') || ''; } catch { return ''; } }, keepMail = m => { try { localStorage.setItem('stroi-email', m); } catch {} };
  // 🔑 (feature 'reg-pass') вход с имейл и парола — кодът е само за нов акаунт или забравена парола
  const stepLogin = (pre = lastMail()) => {
    body.innerHTML = `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">🔑 <b style="color:#fff">Влез</b> с имейла и паролата си — играта ти чака в облака.</p>
      <input id="rgEmail" type="email" autocomplete="username" inputmode="email" placeholder="${EMAIL_PH}" style="${inp}">
      <input id="rgPass" type="password" autocomplete="current-password" placeholder="парола" style="${inp}"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgLogin" style="${go}">▶ Влез</button>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13px"><a href="#" id="rgNew" style="color:#ffd54a">🆕 Нов акаунт</a><a href="#" id="rgForgot" style="color:#8b96a8">Забравена парола?</a></div>`;
    const e = body.querySelector('#rgEmail'), pw = body.querySelector('#rgPass'); e.value = pre; setTimeout(() => (pre ? pw : e).focus(), 50);
    body.querySelector('#rgNew').onclick = ev => { ev.preventDefault(); stepEmail(e.value.trim(), 'new'); };
    body.querySelector('#rgForgot').onclick = ev => { ev.preventDefault(); stepEmail(e.value.trim(), 'reset'); };
    const login = () => {
      const email = e.value.trim(), password = pw.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Невалиден имейл.', true);
      if (!password) return msg('Въведи паролата.', true);
      msg('Влизам…'); body.querySelector('#rgLogin').disabled = true;
      sb.auth.signInWithPassword({ email, password }).then(({ error }) => {
        body.querySelector('#rgLogin').disabled = false;
        if (error) return msg(/invalid login/i.test(error.message) ? 'Грешен имейл или парола. Ако досега влизаше с код — натисни „Забравена парола?“ и си сложи парола.' : /rate|seconds/i.test(error.message) ? 'Твърде много опити — изчакай малко.' : error.message, true);
        keepMail(email); close();
      });
    };
    body.querySelector('#rgLogin').onclick = login; pw.onkeydown = ev => { if (ev.key === 'Enter') login(); }; e.onkeydown = ev => { if (ev.key === 'Enter') pw.focus(); };
  };
  // след кода: парола за следващите влизания (по желание — „Пропусни“)
  const stepPass = (email, mode) => {
    body.innerHTML = `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">3️⃣ ${mode === 'reset' ? 'Нова парола' : 'Сложи си парола'} — следващия път влизаш с нея, без код.</p>
      <input id="rgP1" type="password" autocomplete="new-password" placeholder="парола (поне 6 знака)" style="${inp}">
      <input id="rgP2" type="password" autocomplete="new-password" placeholder="още веднъж" style="${inp}"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgSet" style="${go}">💾 Запази паролата</button>${mode === 'reset' ? '' : '<div style="text-align:center;margin-top:8px"><a href="#" id="rgNoPass" style="color:#8b96a8;font-size:13px">Пропусни — ще влизам с код</a></div>'}`;
    const p1 = body.querySelector('#rgP1'), p2 = body.querySelector('#rgP2'); setTimeout(() => p1.focus(), 50);
    const skip = body.querySelector('#rgNoPass'); if (skip) skip.onclick = ev => { ev.preventDefault(); stepEnter(email); };
    const set = () => {
      if (p1.value.length < 6) return msg('Паролата е поне 6 знака.', true);
      if (p1.value !== p2.value) return msg('Двете пароли се различават.', true);
      msg('Запазвам…'); body.querySelector('#rgSet').disabled = true;
      sb.auth.updateUser({ password: p1.value }).then(({ error }) => {
        body.querySelector('#rgSet').disabled = false;
        if (error) return msg(/same|different/i.test(error.message) ? 'Това е старата парола — избери друга.' : /weak|short|least/i.test(error.message) ? 'Паролата е твърде слаба.' : error.message, true);
        stepEnter(email, true);
      });
    };
    body.querySelector('#rgSet').onclick = set; p2.onkeydown = ev => { if (ev.key === 'Enter') set(); };
  };
  const stepEmail = (pre = '', mode = 'new') => {
    body.innerHTML = PASS ? `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">${mode === 'reset' ? '🔁 <b style="color:#fff">Забравена парола</b> — пращаме код на имейла ти, после си слагаш нова.' : '1️⃣ <b style="color:#fff">Нов акаунт</b> — пращаме код на имейла ти, после си слагаш парола. Играта ти се пази в облака и можеш да играеш от всяко устройство.'}</p>`
      : `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">1️⃣ <b style="color:#fff">Регистрирай имейл</b> — ще ти пратим код. Без парола. Играта ти се пази в облака и можеш да играеш от всяко устройство.</p>`;
    body.innerHTML += `<input id="rgEmail" type="email" autocomplete="email" inputmode="email" placeholder="${EMAIL_PH}" style="${inp}"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgSend" style="${go}">📧 ${PASS ? 'Прати код' : 'Регистрирай'}</button>${PASS ? '<div style="text-align:center;margin-top:8px"><a href="#" id="rgHave" style="color:#8b96a8;font-size:13px">← Имам акаунт — вход с парола</a></div>' : ''}`;
    const e = body.querySelector('#rgEmail'); e.value = pre; setTimeout(() => e.focus(), 50);
    const have = body.querySelector('#rgHave'); if (have) have.onclick = ev => { ev.preventDefault(); stepLogin(e.value.trim()); };
    const send = () => {
      const email = e.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Невалиден имейл.', true);
      msg('Изпращам…'); body.querySelector('#rgSend').disabled = true;
      sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).then(({ error }) => {
        body.querySelector('#rgSend').disabled = false;
        if (error) return msg(/rate|seconds/i.test(error.message) ? 'Твърде много опити — изчакай малко.' : error.message, true);
        stepCode(email, mode);
      });
    };
    body.querySelector('#rgSend').onclick = send; e.onkeydown = ev => { if (ev.key === 'Enter') send(); };
  };
  const stepCode = (email, mode) => {
    body.innerHTML = `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">2️⃣ Пратихме код на <b style="color:#fff"></b>. Въведи го тук (ако го няма — виж „Спам“).</p>
      <input id="rgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="${inp};letter-spacing:4px;text-align:center"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgOk" style="${go}">✅ Потвърди</button><div style="text-align:center;margin-top:8px"><a href="#" id="rgBack" style="color:#8b96a8;font-size:13px">← друг имейл</a></div>`;
    body.querySelector('b').textContent = email;
    const c = body.querySelector('#rgCode'); setTimeout(() => c.focus(), 50);
    body.querySelector('#rgBack').onclick = ev => { ev.preventDefault(); stepEmail(email, mode); };
    const ok = () => {
      const token = c.value.replace(/\D/g, ''); if (token.length < 6) return msg('Кодът е от 6 цифри.', true);
      msg('Проверявам…');
      sb.auth.verifyOtp({ email, token, type: 'email' }).then(({ error }) => {
        if (error) return msg(/expired|invalid/i.test(error.message) ? 'Грешен или изтекъл код.' : error.message, true);
        keepMail(email); PASS ? stepPass(email, mode) : stepEnter(email);
      });
    };
    body.querySelector('#rgOk').onclick = ok; c.onkeydown = ev => { if (ev.key === 'Enter') ok(); };
  };
  const stepEnter = (email, pass) => {
    el.querySelector('#rgSkip')?.parentElement.remove();
    body.innerHTML = `<p style="color:#5fe39a;font-size:15px;text-align:center;margin:14px 0 6px">✅ ${pass ? 'Паролата е запазена. Влязъл си като' : 'Регистриран си като'} <b style="color:#fff"></b></p>
      <button id="rgIn" style="${go};font-size:20px;padding:15px">▶ Влез в играта</button>`;
    body.querySelector('b').textContent = email;
    body.querySelector('#rgIn').onclick = close;
  };
  if (PW) pwForm(body, { inp, go, link: '#ffd54a', mut: '#8b96a8', onIn: (email, isNew) => { close(); toast(`☁️ ${isNew ? 'Акаунтът е създаден' : 'Влезе'} — ${email}. Играта ти се пази в облака.`); } });   // 🔑 pw-login
  else PASS ? (lastMail() ? stepLogin() : stepEmail('', 'new')) : stepEmail();   // познат имейл на това устройство → вход с парола; иначе — нов акаунт
}
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);   // на localhost (разработка) — без екрана, освен с ?gate
const GATE_ON = !AUTOTEST && feature('reg-gate') && ((window.top === window && !LOCAL) || /[?&]gate/.test(location.search));
if (GATE_ON || (GC && !AUTOTEST && isGuest()))
  sb.auth.getSession().then(({ data }) => { if (data?.session) return; if (GC && isGuest()) { guestSignIn(); return; } if (document.body) regGate(); else addEventListener('DOMContentLoaded', regGate); });   // 👤 guest-cloud: гостът не вижда екрана — влиза пак като гост
window.__regGate = regGate;
if (IN_LAB && GC) window.__guestUi = () => { user = { id: '00000000-0000-0000-0000-000000000000', is_anonymous: true }; busy = true; paint(); openSettings(); return who(); };   // 👤 guest-cloud: изгледът на госта в Лабораторията — без мрежа (busy спира синхронизацията)
window.__settings = openSettings;
if (IN_LAB) window.__cloudPullTest = rows => pullAll(rows).then(() => ({ held: [...held] }));   // fix-saves: конфликт без вход — облачните редове се подават наготово
if (IN_LAB) window.__cloudLiteTest = async () => { const raw = localStorage.getItem(keyOf(curSlot())) || '{}', p = await pack(raw), back = await unpack(p); return { raw: raw.length, sent: JSON.stringify(p).length, same: sameSave(back, raw) }; };   // cloud-lite: колко се качва и връща ли се същото
window.__wipeAll = () => confirmWipe(false, true);   // „🆕 Нова игра“ на картата (game.js)
if (!AUTOTEST) {
  presStart();
  setInterval(syncTick, LITE ? 60000 : 20000);   // cloud-lite: на 60 с (и при скрит таб / изход), само ако записът се е променил
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncAll(false); else syncAll(true); if (LITE) presIdle(document.visibilityState === 'hidden'); });
  if (LITE) addEventListener('pagehide', () => syncAll(false));
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mountBtn); else mountBtn();
}
export const cloud = { sb, syncAll, user: () => user, openSettings };
export const SB_REST = { url: URL_, key: KEY };   // errtelem.js: report_errors с fetch keepalive (тръгва и при затваряне на таба)
