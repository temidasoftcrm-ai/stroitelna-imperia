// cloud.js — вход с имейл (код) и записи в облака (Supabase). Играта си записва в localStorage както досега;
// този модул качва трите слота в облака на всеки 20 с (и когато приложението отиде във фон), а при старт
// сравнява с облака: ако на друго устройство има по-нов запис — сваля го и презарежда.
// Таблица public.saves (user_id, slot 's1'…'s3', data jsonb, meta jsonb, updated_at); RLS: всеки вижда само своите.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const URL_ = 'https://lpzjscttqieqnqozscpk.supabase.co';
const KEY = 'sb_publishable_3Gats6iSx7BoyFUh63N1vQ__pHCBrul';   // публичен ключ — достъпът се пази от RLS
const SLOTS = 3;
const keyOf = n => n === 1 ? 'stroi-save-v1' : `stroi-save-v1-s${n}`;
const syncKey = n => `stroi-cloud-s${n}`;   // { ts: updated_at в облака, sig: отпечатък на качения запис }
const curSlot = () => { try { return Math.min(SLOTS, Math.max(1, +localStorage.getItem('stroi-slot') || 1)); } catch { return 1; } };
const AUTOTEST = /[?&]autotest/.test(location.search);

const sb = createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'stroi-auth' } });
let user = null, busy = false, lastErr = '';

// бърз отпечатък на текст (за „промени ли се записът“)
function sig(s) { if (!s) return ''; let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
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
  btn.title = user ? `Облак: ${user.email}${lastErr ? ' — ' + lastErr : ''}` : 'Влез, за да пазиш играта в облака и да играеш от няколко устройства';
}

function openPanel() {
  if (!user) return loginEmail();
  const rows = [];
  for (let n = 1; n <= SLOTS; n++) { const raw = localStorage.getItem(keyOf(n)); if (raw) { const m = metaOf(raw), s = getSync(n); rows.push(`💾 Слот ${n}: ден ${m.day} · ${fmt(m.money)} € ${s && s.sig === sig(raw) ? '· ☁️ в облака' : '· ⏳ чака качване'}`); } }
  dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Облак</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Влязъл си като <b style="color:var(--txt)">${user.email}</b>.<br>Играта се пази в облака автоматично — влез със същия имейл на друго устройство и продължаваш оттам.${lastErr ? `<br><span style="color:var(--bad)">Последна грешка: ${lastErr}</span>` : ''}</p>
    <div style="font-size:13px;line-height:1.7">${rows.join('<br>') || 'Още няма записи.'}</div>`,
    [['Изход', () => { sb.auth.signOut(); }], ['☁️ Синхронизирай сега', () => { syncAll(true); }], ['Затвори', null, 1]]);
}

function loginEmail(pre = '') {
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Вход</h2>
    <p style="color:var(--mut);font-size:14px;line-height:1.5">Въведи имейла си — ще ти пратим код за вход. Без парола. След това играта ти се пази в облака и можеш да продължиш от телефона, таблета или друг компютър.</p>
    <input id="cloudEmail" type="email" autocomplete="email" inputmode="email" placeholder="ime@primer.com" value="${pre}" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:16px">
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

// ── синхронизация ──
async function upload(n, raw) {
  const { data, error } = await sb.from('saves').upsert({ user_id: user.id, slot: 's' + n, data: JSON.parse(raw), meta: metaOf(raw), updated_at: new Date().toISOString() }).select('updated_at').single();
  if (error) throw error;
  setSync(n, { ts: data.updated_at, sig: sig(raw) });
}
// записът на текущия слот, свален от облака, не бива да се презапише от играта (тя още държи стария в паметта) преди презареждането
const setItem0 = Storage.prototype.setItem; let locked = null;
Storage.prototype.setItem = function (k, v) { if (k === locked) return; return setItem0.call(this, k, v); };
function take(n, row) {
  const raw = JSON.stringify(row.data);
  setItem0.call(localStorage, keyOf(n), raw);
  if (n === curSlot()) locked = keyOf(n);
  setSync(n, { ts: row.updated_at, sig: sig(raw) });
}
// при старт / вход: сравнява всеки слот с облака
async function pullAll() {
  const { data: rows, error } = await sb.from('saves').select('slot,data,meta,updated_at');
  if (error) throw error;
  const cloud = Object.fromEntries((rows || []).map(r => [r.slot, r]));
  let reload = false;
  for (let n = 1; n <= SLOTS; n++) {
    const raw = localStorage.getItem(keyOf(n)), c = cloud['s' + n], s = getSync(n);
    if (!c) { if (raw) await upload(n, raw); continue; }
    const localChanged = raw && (!s || s.sig !== sig(raw));
    const cloudNewer = !s || c.updated_at !== s.ts;
    if (!raw || (cloudNewer && !localChanged)) { if (cloudNewer || !raw) { take(n, c); if (n === curSlot()) reload = true; } }
    else if (cloudNewer && localChanged) {
      if (sig(JSON.stringify(c.data)) === sig(raw)) { setSync(n, { ts: c.updated_at, sig: sig(raw) }); continue; }
      const choice = await new Promise(res => {
        const lm = metaOf(raw), cm = c.meta || metaOf(JSON.stringify(c.data));
        dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Два различни записа (слот ${n})</h2>
          <p style="color:var(--mut);font-size:14px;line-height:1.6">На това устройство: <b style="color:var(--txt)">ден ${lm.day} · ${fmt(lm.money)} € · ${lm.done} обекта</b><br>
          В облака (от друго устройство): <b style="color:var(--txt)">ден ${cm.day} · ${fmt(cm.money)} € · ${cm.done} обекта</b><br><br>Кой да остане? Другият ще бъде заменен.</p>`,
          [['📱 Този тук', () => res('local')], ['☁️ От облака', () => res('cloud'), 1]]);
      });
      if (choice === 'cloud') { take(n, c); if (n === curSlot()) reload = true; } else await upload(n, raw);
    } else if (localChanged) await upload(n, raw);
  }
  if (reload) { toast('☁️ Зареждам по-новия запис от облака…'); setTimeout(() => location.reload(), 900); }
}
// периодично: качва слотовете, които са се променили
async function pushChanged() {
  for (let n = 1; n <= SLOTS; n++) {
    const raw = localStorage.getItem(keyOf(n)), s = getSync(n);
    if (raw && (!s || s.sig !== sig(raw))) await upload(n, raw);
  }
}
async function syncAll(full) {
  if (!user || busy || AUTOTEST) return;
  busy = true; paint();
  try { await (full ? pullAll() : pushChanged()); lastErr = ''; }
  catch (e) { lastErr = (e && e.message) || 'няма връзка'; }
  busy = false; paint();
}

sb.auth.onAuthStateChange((ev, session) => {
  const was = user; user = session?.user || null; paint();
  if (user && (!was || was.id !== user.id)) syncAll(true);
});
if (!AUTOTEST) {
  setInterval(() => syncAll(false), 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncAll(false); else syncAll(true); });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mountBtn); else mountBtn();
}
export const cloud = { sb, syncAll, user: () => user };
