// cloud.js — вход с имейл (код) и записи в облака (Supabase). Играта си записва в localStorage както досега;
// този модул качва трите слота в облака на всеки 20 с (и когато приложението отиде във фон), а при старт
// сравнява с облака: ако на друго устройство има по-нов запис — сваля го и презарежда.
// Таблица public.saves (user_id, slot 's1'…'s3', data jsonb, meta jsonb, updated_at); RLS: всеки вижда само своите.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { backupRaw, dropBackups } from './saves.js';
import { feature } from './lab/feature.js';

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
  return openSettings();
}
function openCloud() {
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

// ── ⚙️ Настройки: вход/изход, хора онлайн, изтриване на данните и на акаунта ──
// 🆕 версия и какво е новото — при нова версия: вдигни VERSION и добави най-отгоре в CHANGES
export const VERSION = '1.2.2';
const CHANGES = [
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
  return CHANGES.map(([v, d, L], i) => `<div style="margin-top:${i ? 10 : 0}px"><b style="color:var(--txt)">v${v}</b> <span style="color:var(--mut)">· ${d}</span>
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
  const el = dlg(`<h2 style="font-size:19px;color:var(--acc)">⚙️ Настройки</h2>
    ${sec('☁️ Акаунт', user ? `<div style="font-size:14px;color:var(--mut);line-height:1.5">Влязъл си като <b style="color:var(--txt)">${esc(user.email)}</b> — играта се пази в облака.${lastErr ? `<br><span style="color:var(--bad)">Последна грешка: ${esc(lastErr)}</span>` : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${sbtn('stCloud', '☁️ Записи в облака')}${sbtn('stOut', '🚪 Изход')}</div>`
      : `<div style="font-size:14px;color:var(--mut);line-height:1.5">Не си влязъл. С вход (имейл + код, без парола) играта се пази в облака и можеш да играеш от няколко устройства.</div><div style="margin-top:8px">${sbtn('stIn', '☁️ Вход', 'btn')}</div>`)}
    ${sec(`👥 Онлайн сега: <span id="stN">${ppl.length}</span>`, `<div id="stPpl" style="font-size:13px;line-height:1.7;max-height:150px;overflow:auto">${pplHtml(ppl)}</div>`)}
    ${sec(`🆕 Ъпдейти <span style="font-weight:400;color:var(--mut);font-size:13px">· версия ${VERSION}</span>`, `<div style="max-height:170px;overflow:auto">${changesHtml()}</div>`)}
    ${sec('🎮 Игра', `<div style="display:flex;gap:6px;flex-wrap:wrap">${hooks.saves ? sbtn('stSaves', '💾 Записи') : ''}${hooks.rename ? sbtn('stRen', '✏️ Име на фирмата') : ''}${hooks.credits ? sbtn('stCred', '📜 Автори') : ''}${hooks.newGame ? sbtn('stNew', '🔄 Нова игра') : ''}</div>`)}
    ${sec('⚠️ Опасна зона', `<div style="font-size:13px;color:var(--mut);line-height:1.5">„Изтрий данните“ маха всички записи на това устройство${user ? ' и в облака. „Изтрий акаунта“ маха и самия акаунт (имейла) завинаги' : ''}.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${sbtn('stWipe', '🗑️ Изтрий данните', 'btn2', 'color:var(--bad)')}${user ? sbtn('stDel', '❌ Изтрий акаунта', 'btn2', 'color:var(--bad)') : ''}</div>`)}`,
    [['Затвори', null, 1]]);
  el.firstElementChild.style.maxHeight = '92vh'; el.firstElementChild.style.overflow = 'auto';
  const on = (id, f) => { const b = el.querySelector('#' + id); if (b) b.onclick = () => { el.remove(); f(); }; };
  on('stIn', () => loginEmail()); on('stCloud', openCloud); on('stCred', () => hooks.credits()); on('stRen', () => hooks.rename()); on('stSaves', () => hooks.saves()); on('stNew', () => hooks.newGame());
  on('stOut', () => dlg(`<h2 style="font-size:19px;color:var(--acc)">🚪 Изход?</h2><p style="color:var(--mut);font-size:14px;line-height:1.5">Играта на това устройство остава. Влез пак със същия имейл, за да продължи да се пази в облака.</p>`,
    [['Отказ', null], ['🚪 Изход', () => { syncAll(false).finally(() => sb.auth.signOut().then(() => toast('🚪 Излезе от акаунта.'))); }, 1]]));
  on('stWipe', () => confirmWipe(false)); on('stDel', () => confirmWipe(true));
  pplEl = el;
}
const pplHtml = L => L.length ? L.map(p => `<div>${p.me ? '🟢' : '🟡'} <b>${esc(p.name || 'Играч')}</b>${p.me ? ' (ти)' : ''} <span style="color:var(--mut)">· ${esc(p.city || '')}${p.day ? ` · ден ${p.day}` : ''}</span></div>`).join('') : '<span style="color:var(--mut)">Свързвам се…</span>';
// изтриване: пишеш ИЗТРИЙ, за да няма случайно натискане
function confirmWipe(account, fresh = false) {   // fresh — „🆕 Нова игра“ от картата: същото изтриване, друго заглавие
  const el = dlg(`<h2 style="font-size:19px;color:var(--bad)">${account ? '❌ Изтрий акаунта' : fresh ? '🆕 Нова игра — изтрива всичко' : '🗑️ Изтрий данните'}</h2>
    <p style="color:var(--mut);font-size:14px;line-height:1.5">${account ? `Акаунтът <b style="color:var(--txt)">${esc(user?.email)}</b>, записите в облака и партньорството се изтриват <b>завинаги</b>. Играта на това устройство също се изтрива.`
      : `Всички записи (3-те слота), автозаписите и настройките на това устройство${user ? ' — и <b style="color:var(--txt)">всичко твое в облака</b>: записите и онлайн империята; от партньорството излизаш (то остава за партньора ти)' : ''} се изтриват <b>завинаги</b>. Играта започва отначало.${user ? ' Акаунтът остава.' : ' (Ако имаш записи в облака, влез в акаунта, за да се изтрият и те.)'}`}<br><br>Напиши <b style="color:var(--txt)">ИЗТРИЙ</b>, за да потвърдиш:</p>
    <input id="stConf" autocomplete="off" style="width:100%;padding:11px;border-radius:9px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font-size:16px;text-transform:uppercase">
    <div id="stMsg" style="font-size:13px;color:var(--bad)"></div>`,
    [['Отказ', null], [account ? '❌ Изтрий акаунта' : '🗑️ Изтрий', () => {
      const m = el.querySelector('#stMsg');
      if (el.querySelector('#stConf').value.trim().toUpperCase() !== 'ИЗТРИЙ') { m.textContent = 'Напиши ИЗТРИЙ.'; return false; }
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
  for (const k of Object.keys(localStorage)) if (/^stroi|^sb-/.test(k)) localStorage.removeItem(k);
  if (account || user) await sb.auth.signOut({ scope: 'local' }).catch(() => { });
  toast(account ? '❌ Акаунтът е изтрит.' : '🗑️ Данните са изтрити.');
  setTimeout(() => location.reload(), 700);
}

// 👥 кой играе сега (Supabase Realtime presence — без база; виждат се само име на фирмата, град и ден)
let pres = null, pplEl = null, presState = {};
const myKey = (() => { let k = ''; try { k = sessionStorage.getItem('stroi-pres') || ''; if (!k) { k = crypto.randomUUID(); sessionStorage.setItem('stroi-pres', k); } } catch { k = String(Math.random()); } return k; })();
function online() {
  const L = [];
  for (const [k, arr] of Object.entries(presState)) { const p = arr[arr.length - 1]; if (p) L.push({ ...p, me: k === myKey }); }
  return L.sort((a, b) => (b.me - a.me) || (b.day | 0) - (a.day | 0)).slice(0, 50);
}
function presRender() {
  if (!pplEl || !document.body.contains(pplEl)) return;
  const L = online(), n = pplEl.querySelector('#stN'), box = pplEl.querySelector('#stPpl');
  if (n) n.textContent = L.length; if (box) box.innerHTML = pplHtml(L);
}
const meInfo = () => { try { return window.__stroiMe?.() || null; } catch { return null; } };
let lastMe = '';
function presTrack() {
  if (!pres) return;
  const me = meInfo() || { name: 'Нов играч', city: '', day: 0 }, k = JSON.stringify(me);
  if (k !== lastMe) { lastMe = k; pres.track(me).catch(() => { }); }
}
function presStart() {
  if (pres || AUTOTEST) return;
  try {
    pres = sb.channel('stroi-online', { config: { presence: { key: myKey } } });
    pres.on('presence', { event: 'sync' }, () => { presState = pres.presenceState(); presRender(); })
      .subscribe(st => { if (st === 'SUBSCRIBED') { lastMe = ''; presTrack(); } });
    setInterval(presTrack, 30000);
  } catch { pres = null; }
}

// ── синхронизация ──
async function upload(n, raw) {
  const { data, error } = await sb.from('saves').upsert({ user_id: user.id, slot: 's' + n, data: JSON.parse(raw), meta: metaOf(raw), updated_at: new Date().toISOString() }).select('updated_at').single();
  if (error) throw error;
  setSync(n, { ts: data.updated_at, sig: sig(raw) });
}
// записът на текущия слот, свален от облака, не бива да се презапише от играта (тя още държи стария в паметта) преди презареждането
const setItem0 = Storage.prototype.setItem; let locked = null;
let wiping = false;
Storage.prototype.setItem = function (k, v) { if (k === locked || (wiping && /^stroi/.test(k))) return; return setItem0.call(this, k, v); };
async function take(n, row) {
  await backupRaw(n, localStorage.getItem(keyOf(n)), 'преди облака');   // сегашният запис остава в „🕒 Автозаписи“
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
    // облакът е по-нов, но играта в него е по-назад (по-малко дни или друга фирма) → никога без питане
    const lm0 = raw ? metaOf(raw) : null, cm0 = c.meta || metaOf(JSON.stringify(c.data)), behind = lm0 && cm0 && ((cm0.day | 0) < (lm0.day | 0) || (cm0.city && lm0.city && cm0.city !== lm0.city));
    if (!raw || (cloudNewer && !localChanged && !behind)) { if (cloudNewer || !raw) { await take(n, c); if (n === curSlot()) reload = true; } }
    else if (cloudNewer && (localChanged || behind)) {
      if (sig(JSON.stringify(c.data)) === sig(raw)) { setSync(n, { ts: c.updated_at, sig: sig(raw) }); continue; }
      const choice = await new Promise(res => {
        const lm = metaOf(raw), cm = c.meta || metaOf(JSON.stringify(c.data));
        dlg(`<h2 style="font-size:19px;color:var(--acc)">☁️ Два различни записа (слот ${n})</h2>
          <p style="color:var(--mut);font-size:14px;line-height:1.6">На това устройство: <b style="color:var(--txt)">ден ${lm.day} · ${fmt(lm.money)} € · ${lm.done} обекта</b><br>
          В облака (от друго устройство): <b style="color:var(--txt)">ден ${cm.day} · ${fmt(cm.money)} € · ${cm.done} обекта</b><br><br>${behind ? '<b style="color:var(--bad)">⚠️ В облака играта е по-назад — може би е започната отначало на друго устройство.</b><br>' : ''}Кой да остане? Другият ще бъде заменен (но остава в „💾 Записи“ → „🕒 Автозаписи“).</p>`,
          [['📱 Този тук', () => res('local'), behind ? 1 : 0], ['☁️ От облака', () => res('cloud'), behind ? 0 : 1]]);
      });
      if (choice === 'cloud') { await take(n, c); if (n === curSlot()) reload = true; } else await upload(n, raw);
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
    <div style="text-align:center;margin-top:12px"><a href="#" id="rgSkip" style="color:#8b96a8;font-size:13px">Играй без регистрация</a></div></div>`;
  document.body.appendChild(el);
  const body = el.querySelector('#rgBody'), close = () => { el.remove(); };
  el.querySelector('#rgSkip').onclick = e => { e.preventDefault(); close(); };
  const msg = (t, bad) => { const m = body.querySelector('.rgMsg'); m.style.color = bad ? '#ff6b6b' : '#8b96a8'; m.textContent = t; };
  const stepEmail = (pre = '') => {
    body.innerHTML = `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">1️⃣ <b style="color:#fff">Регистрирай имейл</b> — ще ти пратим код. Без парола. Играта ти се пази в облака и можеш да играеш от всяко устройство.</p>
      <input id="rgEmail" type="email" autocomplete="email" inputmode="email" placeholder="ime@primer.com" style="${inp}"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgSend" style="${go}">📧 Регистрирай</button>`;
    const e = body.querySelector('#rgEmail'); e.value = pre; setTimeout(() => e.focus(), 50);
    const send = () => {
      const email = e.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg('Невалиден имейл.', true);
      msg('Изпращам…'); body.querySelector('#rgSend').disabled = true;
      sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }).then(({ error }) => {
        body.querySelector('#rgSend').disabled = false;
        if (error) return msg(/rate|seconds/i.test(error.message) ? 'Твърде много опити — изчакай малко.' : error.message, true);
        stepCode(email);
      });
    };
    body.querySelector('#rgSend').onclick = send; e.onkeydown = ev => { if (ev.key === 'Enter') send(); };
  };
  const stepCode = email => {
    body.innerHTML = `<p style="color:#a9b6c8;font-size:14px;line-height:1.5;margin:10px 0 4px">2️⃣ Пратихме код на <b style="color:#fff"></b>. Въведи го тук (ако го няма — виж „Спам“).</p>
      <input id="rgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="${inp};letter-spacing:4px;text-align:center"><div class="rgMsg" style="font-size:13px;min-height:18px"></div>
      <button id="rgOk" style="${go}">✅ Потвърди</button><div style="text-align:center;margin-top:8px"><a href="#" id="rgBack" style="color:#8b96a8;font-size:13px">← друг имейл</a></div>`;
    body.querySelector('b').textContent = email;
    const c = body.querySelector('#rgCode'); setTimeout(() => c.focus(), 50);
    body.querySelector('#rgBack').onclick = ev => { ev.preventDefault(); stepEmail(email); };
    const ok = () => {
      const token = c.value.replace(/\D/g, ''); if (token.length < 6) return msg('Кодът е от 6 цифри.', true);
      msg('Проверявам…');
      sb.auth.verifyOtp({ email, token, type: 'email' }).then(({ error }) => {
        if (error) return msg(/expired|invalid/i.test(error.message) ? 'Грешен или изтекъл код.' : error.message, true);
        stepEnter(email);
      });
    };
    body.querySelector('#rgOk').onclick = ok; c.onkeydown = ev => { if (ev.key === 'Enter') ok(); };
  };
  const stepEnter = email => {
    el.querySelector('#rgSkip').parentElement.remove();
    body.innerHTML = `<p style="color:#5fe39a;font-size:15px;text-align:center;margin:14px 0 6px">✅ Регистриран си като <b style="color:#fff"></b></p>
      <button id="rgIn" style="${go};font-size:20px;padding:15px">▶ Влез в играта</button>`;
    body.querySelector('b').textContent = email;
    body.querySelector('#rgIn').onclick = close;
  };
  stepEmail();
}
if (!AUTOTEST && feature('reg-gate') && (window.top === window || /[?&]gate/.test(location.search)))
  sb.auth.getSession().then(({ data }) => { if (!data?.session) { if (document.body) regGate(); else addEventListener('DOMContentLoaded', regGate); } });
window.__regGate = regGate;
window.__settings = openSettings;
window.__wipeAll = () => confirmWipe(false, true);   // „🆕 Нова игра“ на картата (game.js)
if (!AUTOTEST) {
  presStart();
  setInterval(() => syncAll(false), 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncAll(false); else syncAll(true); });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mountBtn); else mountBtn();
}
export const cloud = { sb, syncAll, user: () => user, openSettings };
