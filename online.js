// online.js — „Онлайн империя“: вход → избор на свят → фирма → играта. Всичко, което се вижда, идва от сървъра (ol_state);
// бутоните само изпращат намерения (online-api.js). Самостоятелната игра и нейните записи не се пипат.
import { sb, api, read, onConn, OnlineError } from './online-api.js';
import { t as tr } from './i18n.js';   // 🌐 lang-en: числото + „оферта/оферти“

const BRANDS = [
  { k: 'industrial', nm: 'Индустриал', col: '#ff9a2e', ico: '⚙️' },
  { k: 'titan', nm: 'Титан', col: '#4fc3f7', ico: '🗿' },
  { k: 'atlas', nm: 'Атлас', col: '#7dffa8', ico: '🌐' },
  { k: 'horizon', nm: 'Хоризон', col: '#ffd54a', ico: '🌅' },
  { k: 'imperial', nm: 'Империал', col: '#e57cff', ico: '👑' },
];
const CITIES = { sofia: 'София', plovdiv: 'Пловдив', varna: 'Варна', burgas: 'Бургас', ruse: 'Русе', stz: 'Стара Загора', pleven: 'Плевен', vt: 'Велико Търново', blg: 'Благоевград', shumen: 'Шумен', dobrich: 'Добрич', sliven: 'Сливен', haskovo: 'Хасково' };
const POLL_MS = 5000;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = cents => (Math.round(Number(cents) / 100)).toLocaleString('bg-BG') + ' €';
const brandOf = k => BRANDS.find(b => b.k === k) || BRANDS[0];
function toast(msg, kind = 'good') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  $('toasts').prepend(t); setTimeout(() => t.remove(), 6000);
}
const errMsg = e => e instanceof OnlineError ? e.message : (e?.message || 'Нещо се обърка.');
const sheet = html => { $('game').classList.add('hidden'); $('bg').classList.remove('hidden'); $('screen').classList.remove('hidden'); $('screen').innerHTML = `<div class="sheet">${html}</div>`; };

let user = null, worldId = +(new URLSearchParams(location.search).get('w') || localStorage.getItem('stroi-online-w') || 0), state = null, tab = 'build', pollT = 0, lastNote = 0;

// ═══ вход (същият като облачните записи: имейл + код) ═══
function loginScreen(pre = '') {
  sheet(`<h1>🌐 Онлайн империя</h1>
    <div class="meta">Общ свят с други играчи: всички фирми работят по едно и също сървърно време, а търговете, парите и резултатите се изчисляват на сървъра. <b style="color:var(--txt)">Отделно е от самостоятелната игра</b> — тук започваш на чисто.</div>
    <input id="em" type="email" autocomplete="email" inputmode="email" placeholder="ime@primer.com" value="${esc(pre)}">
    <div class="err" id="er"></div>
    <div class="row"><a href="./" class="btn2" style="text-decoration:none;color:var(--txt)">← Самостоятелна игра</a><button class="btn" id="go">📧 Прати код</button></div>`);
  $('go').onclick = async () => {
    const email = $('em').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('er').textContent = 'Невалиден имейл.'; return; }
    $('go').disabled = true; $('er').textContent = '';
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    $('go').disabled = false;
    if (error) { $('er').textContent = /rate|seconds/i.test(error.message) ? 'Твърде много опити — изчакай малко.' : error.message; return; }
    codeScreen(email);
  };
}
function codeScreen(email) {
  sheet(`<h2>📧 Провери пощата</h2><div class="meta">Пратихме код на <b style="color:var(--txt)">${esc(email)}</b>.</div>
    <input id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="font-size:24px;letter-spacing:6px;text-align:center">
    <div class="err" id="er"></div>
    <div class="row"><button class="btn2" id="bk">← Друг имейл</button><button class="btn" id="go">✅ Влез</button></div>`);
  $('bk').onclick = () => loginScreen(email);
  $('go').onclick = async () => {
    const token = $('cd').value.replace(/\D/g, '');
    if (token.length < 6) { $('er').textContent = 'Кодът е от 6 цифри.'; return; }
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) $('er').textContent = /expired|invalid/i.test(error.message) ? 'Грешен или изтекъл код.' : error.message;
  };
}

// ═══ избор на свят ═══
// покана от линк: online.html?inv=КОД — пази се, докато влезеш, и се приема автоматично
{ const inv = new URLSearchParams(location.search).get('inv'); if (inv) { localStorage.setItem('stroi-online-inv', inv.toUpperCase()); history.replaceState(null, '', location.pathname); worldId = 0; } }
const ST = { open: '', paused: ' · ⏸ на пауза', closed: ' · затворен' };
async function worldsScreen() {
  sheet(`<h1>🌐 Светове</h1><div class="meta">Зареждам…</div>`);
  const inv = localStorage.getItem('stroi-online-inv');
  if (inv) { localStorage.removeItem('stroi-online-inv'); try { const r = await api.join(inv); toast(r.already ? 'Вече си член на този свят.' : '🎟️ Поканата е приета!'); } catch (e) { toast(errMsg(e), 'bad'); } }
  let res;
  try { res = await api.worlds(); } catch (e) { sheet(`<h2>Няма връзка със сървъра</h2><div class="meta">${esc(errMsg(e))}</div><button class="btn" id="re">🔄 Опитай пак</button>`); $('re').onclick = worldsScreen; return; }
  const ws = res.worlds;
  sheet(`<h1>🌐 Светове</h1>
    <div class="meta">Влязъл си като <b style="color:var(--txt)">${esc(user.email)}</b> · <a href="#" id="out" style="color:var(--mut)">изход</a></div>
    ${ws.length ? ws.map(w => `<div class="card"><div class="row"><div><h3>${w.private ? '🔒' : '🌍'} ${esc(w.name)}${w.test ? ' <span class="meta">(тестов)</span>' : ''}</h3>
      <div class="meta">ден ${w.day} · ${w.players} фирми · 1 ден = ${Math.round(w.day_seconds / 60)} мин${ST[w.status] || ''}${w.company ? ` · твоята фирма: <b style="color:var(--txt)">${esc(w.company.name)}</b>` : ''}</div></div>
      <div style="display:flex;gap:6px">${res.admin ? `<button class="btn2" data-adm="${w.id}" title="Администрация">🛠️</button>` : ''}${w.banned ? '<span class="bad">изгонен</span>' : w.status !== 'open' ? '' : `<button class="btn" data-w="${w.id}">${w.company ? '▶️ Влез' : '🏗️ Основи фирма'}</button>`}</div></div></div>`).join('')
      : `<div class="card meta">Още нямаш достъп до свят. Пилотът е частен — въведи кода от поканата (8 букви и цифри, напр. AB12CD34).<br>Цифровият код от имейла служи само за вход — той не е покана. Поканата се получава от администратора.</div>`}
    <div class="card"><h3>🎟️ Покана</h3><div class="row" style="margin-top:8px"><input id="inv" placeholder="КОД" style="text-transform:uppercase;letter-spacing:3px"><button class="btn2" id="join">Влез</button></div><div class="err" id="er"></div></div>
    ${res.admin ? `<button class="btn2" id="newW">🛠️ Нов свят</button>` : ''}`);
  $('out').onclick = e => { e.preventDefault(); sb.auth.signOut(); };
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const w = ws.find(x => x.id === +b.dataset.w); w.company ? enterWorld(w.id) : companyScreen(w); });
  document.querySelectorAll('[data-adm]').forEach(b => b.onclick = () => adminScreen(+b.dataset.adm));
  $('newW')?.addEventListener('click', newWorldScreen);
  $('join').onclick = async () => {
    if (/^\s*\d{6,10}\s*$/.test($('inv').value)) { $('er').textContent = 'Това прилича на кода за вход от имейла — той не е покана. Поиска код за покана от администратора (8 букви и цифри).'; return; }
    $('join').disabled = true;
    try { const r = await api.join($('inv').value); toast(r.already ? 'Вече си член на този свят.' : '🎟️ Поканата е приета!'); worldsScreen(); }
    catch (e) { $('er').textContent = errMsg(e); $('join').disabled = false; }
  };
}

// ═══ администрация (само за администраторите — сървърът проверява) ═══
function newWorldScreen() {
  sheet(`<h1>🛠️ Нов свят</h1>
    <input id="nm" placeholder="Име (напр. Пилот 1)" maxlength="40"><input id="sl" placeholder="кратко име за адреса (напр. pilot-1)" maxlength="32">
    <div class="row"><span class="meta">1 игрален ден =</span><select id="ds" style="width:auto"><option value="60">1 мин</option><option value="300">5 мин</option><option value="600" selected>10 мин</option><option value="1800">30 мин</option><option value="3600">1 час</option></select></div>
    <label class="meta"><input type="checkbox" id="pv" checked style="width:auto"> частен (само с покана)</label>
    <label class="meta"><input type="checkbox" id="ts" style="width:auto"> тестов (часовникът може да се мести)</label>
    <div class="err" id="er"></div><div class="row"><button class="btn2" id="bk">← Светове</button><button class="btn" id="go">Създай</button></div>`);
  $('bk').onclick = worldsScreen;
  $('go').onclick = async () => {
    const r = await read('ol_admin_world', { p_slug: $('sl').value.trim().toLowerCase(), p_name: $('nm').value.trim(), p_private: $('pv').checked, p_day_seconds: +$('ds').value, p_cfg: {}, p_test: $('ts').checked }).catch(e => ({ ok: false, msg: errMsg(e) }));
    if (!r.ok) { $('er').textContent = r.msg || 'Грешка (провери краткото име: малки латински букви, цифри и тире).'; return; }
    toast('Светът е създаден.'); adminScreen(r.world);
  };
}
const EV = { ally_gift: '🎁 подарък за съюзник', ally_loan: '💸 заем между съюзници', ally_forgive: '🎁 опростен заем', company_created: '🏗️ нова фирма', join: '🎟️ влезе с покана', bid: '📨 оферта', tender_awarded: '🏆 спечелен търг', tender_no_bids: '— търг без оферти', contract_failed: '❌ провален договор',
  build_start: '🏗️ строеж', contract_start: '📑 старт на договор', build_done: '✅ предаден строеж', units: '🚜 техника', status: '⏸ статус', ban: '🚫 изгонен', unban: '↩️ върнат', cfg: '⚙️ настройки', invite: '🎟️ покана', world_created: '🌐 нов свят', clock_shift: '⏩ часовник', season_start: '🏁 нов сезон', season_end: '🏆 край на сезон', season_end_admin: '🏁 сезонът е приключен от админ', facility: '🏭 производство', ask: '📤 оферта на пазара', cons_found: '🤝 нов консорциум', cons_invite: '📨 покана за консорциум', cons_join: '🤝 влезе в консорциум', cons_building: '🏗️ консорциум строи', cons_operating: '✅ мегапроект работи', cons_dissolved: '✖ консорциум разпаднат', conc_bid: '⚓ оферта за концесия', conc_awarded: '⚓ концесия възложена' };
async function adminScreen(id) {
  let o;
  try { o = await read('ol_admin_overview', { p_world: id }); } catch (e) { toast(errMsg(e), 'bad'); return worldsScreen(); }
  if (!o.ok) { toast(o.msg, 'bad'); return worldsScreen(); }
  const w = o.world, link = i => `${location.origin}${location.pathname}?inv=${i.code}`;
  sheet(`<h1>🛠️ ${esc(w.name)}</h1>
    <div class="meta">ден ${w.day} · 1 ден = ${Math.round(w.day_seconds / 60)} мин · ${w.status === 'open' ? '▶️ върви' : w.status === 'paused' ? '⏸ на пауза (часовникът е спрян)' : 'затворен'} · ${o.members} членове · търгове: ${o.tenders.open} отворени, ${o.tenders.awarded} възложени, ${o.tenders.no_bids} без оферти</div>
    <div class="row" style="justify-content:flex-start;flex-wrap:wrap;gap:6px">
      <button class="btn2" id="bk">← Светове</button>
      ${w.status === 'open' ? '<button class="btn2" data-st="paused">⏸ Пауза</button>' : w.status === 'paused' ? '<button class="btn" data-st="open">▶️ Продължи</button>' : ''}
      <button class="btn2" id="inv">🎟️ Нова покана</button><button class="btn2" id="sEnd">🏁 Приключи сезона</button><button class="btn2" id="rf">🔄</button></div>
    ${o.invites.length ? `<div class="card"><h3>🎟️ Покани</h3>${o.invites.map(i => `<div class="led"><span><b style="letter-spacing:2px">${i.code}</b> · ${i.uses}/${i.max_uses} · до ${i.expires_at ? new Date(i.expires_at).toLocaleDateString('bg-BG') : '—'}</span><button class="btn2" style="padding:2px 8px;font-size:12px" data-cp="${esc(link(i))}">📋 линк</button></div>`).join('')}</div>` : ''}
    <div class="card"><h3>🏢 Фирми (${o.companies.length})</h3>${o.companies.map(c => `<div class="led"><span><b style="color:${brandOf(c.brand).col}">${esc(c.name)}</b> · ${esc(c.email || '')} · ниво ${c.level} · ${eur(c.value)} · последно ден ${c.last_seen_day}${c.banned ? ' · <span class="bad">изгонен</span>' : ''}</span>
      <button class="btn2" style="padding:2px 8px;font-size:12px" data-ban="${c.id}:${c.banned ? 0 : 1}">${c.banned ? '↩️ върни' : '🚫 изгони'}</button></div>`).join('') || '<div class="meta">Още няма фирми.</div>'}</div>
    <div class="card"><h3>📜 Журнал</h3><div style="max-height:300px;overflow:auto">${o.events.map(e => `<div class="led"><span>${new Date(e.at).toLocaleString('bg-BG')} · ${EV[e.kind] || e.kind}${e.company ? ` · <b>${esc(e.company)}</b>` : ''}</span><span class="meta" style="text-align:right">${esc(e.data?.title || (e.data?.price ? eur(e.data.price) : e.data?.type ? `${e.data.type} ${e.data.from}→${e.data.to}` : e.data?.to || ''))}</span></div>`).join('')}</div></div>`);
  document.querySelector('.sheet').style.maxWidth = '900px';
  $('bk').onclick = worldsScreen; $('rf').onclick = () => adminScreen(id);
  $('sEnd').onclick = async () => { const r = await read('ol_admin_season_end', { p_world: id }); r.ok ? toast('Сезонът приключи — класирането е в архива; новият започва до минута.') : toast(r.msg, 'bad'); adminScreen(id); };
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => { const r = await read('ol_admin_status', { p_world: id, p_status: b.dataset.st }); r.ok ? toast(b.dataset.st === 'paused' ? 'Светът е на пауза.' : 'Светът продължава.') : toast(r.msg, 'bad'); adminScreen(id); });
  $('inv').onclick = async () => { const r = await read('ol_admin_invite', { p_world: id, p_max_uses: 20, p_days: 30 }); if (r.ok) { navigator.clipboard?.writeText(link(r)).catch(() => {}); toast(`Покана ${r.code} — линкът е копиран.`); } adminScreen(id); };
  document.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.cp).then(() => toast('Линкът е копиран.'), () => prompt('Линк за поканата:', b.dataset.cp)); });
  document.querySelectorAll('[data-ban]').forEach(b => b.onclick = async () => { const [c, v] = b.dataset.ban.split(':'); const r = await read('ol_admin_ban', { p_world: id, p_company: +c, p_ban: v === '1' }); r.ok ? toast(v === '1' ? 'Играчът е изгонен — офертите му са оттеглени.' : 'Играчът е върнат.') : toast(r.msg, 'bad'); adminScreen(id); });
}

// ═══ създаване на фирма ═══
function companyScreen(w) {
  let brand = 'titan';
  sheet(`<h1>🏗️ Нова фирма</h1><div class="meta">Свят „${esc(w.name)}“. Започваш с 20 000 € от сървъра — нищо не се пренася от самостоятелната игра.</div>
    <div class="brands">${BRANDS.map(b => `<button class="brand${b.k === brand ? ' on' : ''}" data-b="${b.k}" style="--bc:${b.col}"><span>${b.ico}</span><b style="color:${b.col}">${b.nm}</b></button>`).join('')}</div>
    <input id="nm" maxlength="32" placeholder="Име на фирмата" value="Титан Констръкшън">
    <select id="ct">${Object.entries(CITIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <div class="err" id="er"></div>
    <div class="row"><button class="btn2" id="bk">← Светове</button><button class="btn" id="go">🏗️ Основи фирмата</button></div>`);
  document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    const old = brandOf(brand); brand = b.dataset.b;
    document.querySelectorAll('[data-b]').forEach(x => x.classList.toggle('on', x === b));
    const nm = $('nm'); if (!nm.value.trim() || nm.value === `${old.nm} Констръкшън`) nm.value = `${brandOf(brand).nm} Констръкшън`;
  });
  $('bk').onclick = worldsScreen;
  $('go').onclick = async () => {
    $('go').disabled = true; $('er').textContent = '';
    try { await api.createCompany(w.id, $('nm').value, brand, $('ct').value); enterWorld(w.id); }
    catch (e) { $('er').textContent = errMsg(e); $('go').disabled = false; }
  };
}

// ═══ играта ═══
async function enterWorld(id) {
  worldId = id; localStorage.setItem('stroi-online-w', id);
  $('screen').classList.add('hidden'); $('bg').classList.add('hidden'); $('game').classList.remove('hidden');
  lastNote = 0; state = null; await refresh(true);
  clearInterval(pollT); pollT = setInterval(() => document.visibilityState === 'visible' && refresh(), POLL_MS);
}
async function refresh(first) {
  let s;
  try { s = await api.state(worldId); } catch (e) { if (first) { toast(errMsg(e), 'bad'); worldsScreen(); } return; }
  if (!s.ok) { toast(s.msg || 'Нямаш достъп до този свят.', 'bad'); clearInterval(pollT); worldsScreen(); return; }
  if (!s.company) { clearInterval(pollT); return worldsScreen(); }
  // известията, които още не са показани като изскачащи
  const fresh = s.notes.filter(n => !n.seen && n.id > lastNote);
  if (!first) fresh.slice().reverse().forEach(n => toast(`${n.title}${n.body ? ' — ' + n.body : ''}`, n.kind === 'bad' ? 'bad' : 'good'));
  if (s.notes.length) lastNote = Math.max(lastNote, ...s.notes.map(n => n.id));
  state = s; srvOff = Date.parse(s.world.server_now) - Date.now();
  if (tab === 'tend') { try { const t = await api.tenders(worldId); if (t.ok) tenders = t; } catch {} }
  if (tab === 'co') { try { const k = await api.finance(worldId); if (k.ok) fin = k; } catch {} }
  if (tab === 'co') { try { const k = await api.allyMoney(worldId); if (k.ok) amoney = k; } catch {} }
  if (tab === 'conc') { try { const k = await api.concessions(worldId); if (k.ok) conc = k; } catch {} }
  if (tab === 'cons') { try { const k = await api.consortia(worldId); if (k.ok) cons = k; } catch {} }
  if (tab === 'mkt') { try { const m = await api.market(worldId); if (m.ok) market = m; } catch {} }
  if (tab === 'rank') { try { const k = await api.relations(worldId); if (k.ok) rels = k; } catch {} }
  if (tab === 'rank' && rankView === 'season') { try { const k = await api.season(worldId); if (k.ok) season = k; } catch {} }
  if (tab === 'rank') { try { const r = await api.ranking(worldId, rankSort); if (r.ok) ranking = r; if (profile) { const p = await api.company(worldId, profile.company.id); if (p.ok) { p.trophies = profile.trophies; profile = p; } } } catch {} }
  if (!busy && !document.activeElement?.dataset?.bidin && !['byQ', 'byP', 'slQ', 'slP', 'lnA', 'soP', 'soC'].includes(document.activeElement?.id) && !document.activeElement?.dataset?.shp && document.activeElement?.tagName !== 'SELECT' && !document.activeElement?.dataset?.cbin) render(); syncView();
}
const TABS = [['build', '🏗️ Строежи'], ['tend', '🏛️ Търгове'], ['mkt', '📦 Пазар'], ['cons', '🤝'], ['conc', '⚓'], ['units', '🚜 Техника'], ['rank', '🏆'], ['co', '🏦'], ['notes', '🔔']];
let market = null, mktGood = 'concrete', cons = null, conc = null, concDraft = {}, fin = null, amoney = null;
let ranking = null, rankSort = 'value', profile = null, season = null, rankView = 'season', rels = null;
const TIER = { local: '🏘️ Местни', national: '🇧🇬 Национални', global: '🌍 Световни' };
let tenders = null, bidDraft = {};
const dayLen = () => state.world.day_seconds * 1000;
const left = iso => { const ms = Date.parse(iso) - (Date.now() + srvOff); if (ms <= 0) return 'предава се…'; const d = ms / dayLen(); return d >= 1 ? `още ${d.toFixed(1).replace('.', ',')} дни` : `още ${Math.ceil(ms / 60000)} мин`; };
let srvOff = 0, busy = false, view = null;
function finHtml() {
  if (!fin) return '<div class="meta">Зареждам финансите…</div>';
  const F = fin;
  let h = `<div class="card"><h3>🏦 Банка</h3><div class="meta">Дълг <b style="color:${F.debt ? 'var(--bad)' : 'var(--txt)'}">${eur(F.debt)}</b> · лихва ${(F.rate * 100).toLocaleString('bg-BG')}% на ден (${eur(Math.ceil(F.debt * F.rate))}/ден) · можеш да изтеглиш още <b style="color:var(--txt)">${eur(F.loan_limit)}</b> (до ${Math.round(F.ltv * 100)}% от нетната стойност). Заемът не вдига стойността в класацията — дългът се приспада.</div>
    <div class="row" style="margin-top:8px"><input id="lnA" inputmode="numeric" placeholder="сума в €" style="padding:7px"><button class="btn" id="lnGo" ${F.loan_limit > 0 ? '' : 'disabled'}>Изтегли</button><button class="btn2" id="rpGo" ${F.debt > 0 ? '' : 'disabled'}>Погаси</button></div></div>`;
  h += `<div class="card"><h3>📈 Дялове във фирмата ти</h3><div class="meta">Можеш да продадеш до ${F.max_float}% (продадени: ${F.sold_pct}%) — контролът остава твой. Парите отиват във фирмата. Акционерите получават ${Math.round(F.payout * 100)}% от дневната печалба по дела си. Справедлива цена за 1%: <b style="color:var(--txt)">${eur(F.fair_pct)}</b>.</div>
    ${F.my_offer ? `<div class="led"><span>📤 Предлагаш ${F.my_offer.pct_left}% по ${eur(F.my_offer.price_pct)} за 1%</span><button class="btn2" style="padding:2px 8px;font-size:12px" id="soClose">Спри</button></div>` : `<div class="row" style="margin-top:8px"><input id="soP" inputmode="numeric" placeholder="%" style="padding:7px;max-width:70px"><input id="soC" inputmode="numeric" placeholder="€ за 1%" value="${Math.round(F.fair_pct / 100)}" style="padding:7px"><button class="btn2" id="soGo" ${F.sold_pct < F.max_float ? '' : 'disabled'}>Пусни</button></div>`}
    ${F.shareholders.map(x => `<div class="led"><span>👤 ${esc(x.name)} · ${x.pct}%</span><button class="btn2" style="padding:2px 8px;font-size:12px" data-bb="${x.company}">Изкупи (${eur(x.buyback)})</button></div>`).join('')}</div>`;
  if (F.my_stakes.length) h += `<div class="card"><h3>💼 Твоите дялове</h3>${F.my_stakes.map(x => `<div class="led"><span>${esc(x.name)} · ${x.pct}% · платено ${eur(x.paid)} · дивиденти ${eur(x.dividends)}</span><b>${eur(x.worth)}</b></div>`).join('')}</div>`;
  if (F.market.length) h += `<div class="card"><h3>🏛️ Дялове за продан</h3>${F.market.map(x => `<div class="led" style="flex-wrap:wrap"><span><b style="color:${brandOf(x.brand).col}">${esc(x.name)}</b> · ниво ${x.level} · печалба 7 дни ${short(x.profit7)}<br><span class="meta">${x.pct_left}% по ${eur(x.price_pct)} за 1% (справедлива ${eur(x.fair_pct)})</span></span><span style="display:flex;gap:4px"><input data-shp="${x.id}" inputmode="numeric" value="1" style="width:56px;padding:4px"><button class="btn" style="padding:4px 10px" data-shb="${x.id}">Купи</button></span></div>`).join('')}</div>`;
  return h;
}
function allyHtml() {
  const A = amoney; if (!A) return '';
  if (!A.allies.length && !A.items.length) return `<div class="card"><h3>🤝 Пари между съюзници</h3><div class="meta">Нямаш съюзници. Предложи съюз от профила на фирма (🏆 → фирмата) — после ще можете да си подарявате пари и да си давате заеми.</div></div>`;
  const ST = { done: '', offered: '⏳ чака отговор', open: 'активен', overdue: '<b class="bad">просрочен</b>', repaid: '✅ изплатен', forgiven: '🎁 опростен' };
  let h = `<div class="card"><h3>🤝 Пари между съюзници</h3><div class="meta">Тази седмица можеш да изпратиш още <b style="color:var(--txt)">${eur(A.cap_left)}</b> (до ${Math.round(A.cap_pct * 100)}% от стойността на фирмата за 7 игрални дни; минимум ${eur(A.min_amount)}). Съюзът трябва да е поне на ${A.min_days} игрални дни. 🎁 Подаръците не се броят за ръст в сезона. 💸 Заемът се връща до срока — на падежа сървърът сам взима от наличността на длъжника.${A.overdue ? '<br><b class="bad">Имаш просрочен заем — докато не го върнеш, не можеш да изпращаш пари.</b>' : ''}</div>`;
  for (const x of A.allies) h += `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line)"><b>${esc(x.name)}</b>${x.ready ? '' : ` <span class="meta">— ще може след ~${x.ready_in_min} мин</span>`}
    <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><input data-amA="${x.id}" inputmode="numeric" placeholder="сума в €" style="padding:7px;max-width:130px">
      <button class="btn" data-agift="${x.id}" ${x.ready && !A.overdue ? '' : 'disabled'}>🎁 Подари</button></div>
    <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><select data-amD="${x.id}" style="padding:6px;flex:1;min-width:0;width:auto">${[3, 5, 7, 10, 15, 20, 30].map(d => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d} дни</option>`).join('')}</select>
      <select data-amR="${x.id}" style="padding:6px;flex:1;min-width:0;width:auto">${[0, 1, 2, 3, 5, 7, 10].map(r => `<option value="${r}"${r === 2 ? ' selected' : ''}>лихва ${r}%</option>`).join('')}</select>
      <button class="btn2" data-aloan="${x.id}" ${x.ready && !A.overdue ? '' : 'disabled'}>💸 Предложи заем</button></div></div>`;
  h += '</div>';
  if (A.items.length) h += `<div class="card"><h3>📑 Подаръци и заеми</h3>${A.items.map(x => {
    const who = x.out ? `→ ${esc(x.other_name)}` : `← ${esc(x.other_name)}`, left = x.owed - x.paid;
    const txt = x.kind === 'gift' ? `🎁 Подарък ${who} · ден ${x.day}` : `💸 Заем ${who} · ${eur(x.amount)}, ${x.days} дни, ${x.rate_pct}% · ${x.status === 'open' || x.status === 'overdue' ? `остават <b>${eur(left)}</b> до ден ${x.due_day} · ` : ''}${ST[x.status] || x.status}`;
    let b = '';
    if (x.kind === 'loan' && x.status === 'offered') b = x.out ? `<button class="btn2" data-lact="${x.id}:cancel">Оттегли</button>` : `<button class="btn" data-lact="${x.id}:accept">✅ Приеми</button><button class="btn2" data-lact="${x.id}:decline">Откажи</button>`;
    if (x.kind === 'loan' && (x.status === 'open' || x.status === 'overdue')) b = x.out ? `<button class="btn2" data-lact="${x.id}:forgive">Опрости</button>` : `<button class="btn" data-lrepay="${x.id}:${left}">Върни ${eur(left)}</button>`;
    return `<div class="led" style="flex-wrap:wrap;gap:6px"><span>${txt}</span>${x.kind === 'gift' ? `<b class="${x.out ? 'bad' : 'ok'}">${x.out ? '−' : '+'}${eur(x.amount)}</b>` : `<span class="row" style="gap:4px">${b}</span>`}</div>`; }).join('')}</div>`;
  return h;
}
function concHtml(U) {
  if (!conc) return '<div class="meta">Зареждам концесиите…</div>';
  const C = conc, needH = need => Object.entries(need).map(([k, n]) => `<span class="${(C.free[k] || 0) < n ? 'miss' : ''}">${U[k].ico} ${U[k].nm} ×${n}</span>`).join('');
  let h = `<div class="card"><div class="meta">⚓ <b style="color:var(--txt)">Временни концесии</b>: право да управляваш обект за определен срок. Офертите са скрити; цялата сума се блокира и може само да се вдига. Печели най-високата <b style="color:var(--txt)">валидна</b> оферта (при равни — по-ранната): фирмата трябва да има свободна техника за обекта и да е под лимита от ${C.rules.max} концесии (ти държиш ${C.rules.mine}). Победителят плаща офертата си като такса, техниката му е заета за срока, а обектът носи приход всеки ден. После — нов търг.</div></div>`;
  for (const a of C.active) h += `<div class="card offer" style="${a.mine ? 'border-color:var(--ok)' : ''}"><h3>${a.ico} ${esc(a.nm)}</h3><div class="meta">${a.mine ? '<b class="ok">Твоя концесия</b>' : `Концесионер: <b style="color:var(--txt)">${esc(a.holder)}</b>`} · такса ${short(a.fee)} · ${a.mine ? `+${eur(a.revenue)}/ден · ` : ''}изтича след ${until(a.end_at)}</div></div>`;
  h += `<h3 style="margin:4px 0 0;font-size:14px">🔨 Търгове</h3>`;
  h += C.auctions.map(a => { const lock = C.level < a.min_level, draft = concDraft[a.round] ?? (a.my ? a.my / 100 : a.min_bid / 100), full = a.revenue * a.term_days;
    return `<div class="card offer" style="${lock ? 'opacity:.6' : ''}"><h3>${a.ico} ${esc(a.nm)}</h3>
      <div class="meta">${esc(a.what)} · <b class="ok">${eur(a.revenue)}/ден</b> × ${a.term_days} дни = ${short(full)} · минимум ${short(a.min_bid)} · от ниво ${a.min_level}<br>⏱️ оферти до <b style="color:var(--txt)">${until(a.closes_at)}</b> · ${tr(a.bids === 1 ? '{0} оферта' : '{0} оферти', [a.bids])}${a.my ? ` · твоята: <b style="color:var(--acc)">${eur(a.my)}</b> (блокирана)` : ''}</div>
      ${(a.ally_bids || []).length ? `<div class="meta" style="margin-top:4px;color:#9ff0bd">🤝 Съюзници: ${a.ally_bids.map(x => `${esc(x.name)} — ${eur(x.amount)}`).join(' · ')}</div>` : ''}
      <div class="need">${needH(a.need)}</div>
      ${lock ? `<div class="meta" style="margin-top:6px">🔒 нужно ниво ${a.min_level}</div>` : `<div class="row" style="margin-top:8px"><input data-cbin="${a.round}" inputmode="numeric" value="${draft}" style="padding:7px;font-size:15px"><button class="btn" data-cbid="${a.round}">${a.my ? '⬆️ Вдигни' : '📨 Подай'}</button></div>
      <div class="meta" data-cprof="${a.round}" style="margin-top:4px">Печалба при тази такса ~<b class="${full - draft * 100 >= 0 ? 'ok' : 'bad'}">${eur(full - draft * 100)}</b> (без горивото на техниката)</div>`}</div>`; }).join('') || '<div class="meta">Няма отворени търгове.</div>';
  if (C.history.length) h += `<div class="card"><h3>📰 Предишни</h3>${C.history.map(x => `<div class="led"><span>${x.ico} ${esc(x.nm)}</span><b>${x.holder ? `${esc(x.holder)} · ${eur(x.fee)}` : 'без валидна оферта'}</b></div>`).join('')}</div>`;
  return h;
}
const PCTS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
function consHtml() {
  if (!cons) return '<div class="meta">Зареждам консорциумите…</div>';
  let h = `<div class="card"><div class="meta">🤝 <b style="color:var(--txt)">Консорциум</b>: фирмите финансират заедно мегапроект. Основателят заявява дял (10–60%) и кани партньори; вноската е делът × цената и се плаща веднага. При 100% строежът тръгва сам; ако дяловете не се съберат до срока — всички вноски се връщат. Готовият проект носи дивиденти всеки ден по дяловете за срока на концесията, после се освобождава за нов кръг.</div></div>`;
  for (const m of cons.projects) {
    const k = m.cons, lock = cons.level < m.min_level, mine = k && k.members.find(x => x.me);
    h += `<div class="card" style="${lock && !mine ? 'opacity:.6' : ''}${k?.my_invite ? ';border-color:var(--acc)' : ''}"><h3>${m.ico} ${esc(m.nm)}</h3>
      <div class="meta">${esc(m.what)} · ${short(m.cost)} · ${m.days} дни строеж · 🎁 ${short(m.revenue)}/ден за ${m.op_days} дни · от ниво ${m.min_level}${m.past ? ` · завършени кръгове: ${m.past}` : ''}</div>`;
    if (!k) {
      h += lock ? `<div class="meta" style="margin-top:6px">🔒 нужно ниво ${m.min_level}</div>` : `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap;justify-content:flex-start"><select data-fpct="${m.key}" style="width:auto;padding:6px">${PCTS.map(p => `<option value="${p}" ${p === 40 ? 'selected' : ''}>${p}% · ${short(m.cost * p / 100)}</option>`).join('')}</select>
        <label class="meta"><input type="checkbox" data-fopen="${m.key}" style="width:auto"> отворен за всички</label><button class="btn" data-found="${m.key}">🤝 Основи консорциум</button></div>`;
    } else {
      const st = k.status === 'forming' ? `събират се дялове: <b style="color:var(--acc)">${k.taken}%</b> · остават ${until(k.forming_until)}${k.open ? ' · отворен' : ' · с покани'}` : k.status === 'building' ? `🏗️ строи се · готов след ${until(k.end_at)}` : `✅ работи · концесията изтича след ${until(k.op_until)}`;
      h += `<div class="meta" style="margin-top:6px">Основател: <b style="color:var(--txt)">${esc(k.founder)}</b> · ${st}</div>
        <div class="bar" style="margin-top:6px"><i style="width:${k.taken}%"></i></div>
        <div style="margin-top:6px">${k.members.map(x => `<div class="led"><span style="color:${brandOf(x.brand).col}">${brandOf(x.brand).ico} ${esc(x.name)}${x.me ? ' (ти)' : ''}</span><b>${x.pct}%${k.status === 'operating' ? ` · ${eur(m.revenue * x.pct / 100)}/ден` : ''}</b></div>`).join('')}</div>`;
      if (k.status === 'forming') {
        if (k.my_invite) h += `<div class="row" style="margin-top:8px"><span class="meta">Покана: <b style="color:var(--acc)">${k.my_invite.pct}%</b> · вноска ${eur(m.cost * k.my_invite.pct / 100)}</span><span style="display:flex;gap:6px"><button class="btn2" data-cdecl="${k.id}">Откажи</button><button class="btn" data-cjoin="${k.id}:${k.my_invite.pct}" ${lock ? 'disabled' : ''}>✅ Приеми</button></span></div>${lock ? `<div class="meta bad">Нужно е ниво ${m.min_level}.</div>` : ''}`;
        else if (!mine && k.open && !lock) h += `<div class="row" style="margin-top:8px;justify-content:flex-start;gap:6px"><select data-jpct="${k.id}" style="width:auto;padding:6px">${PCTS.filter(p => p <= 100 - k.taken).map(p => `<option value="${p}">${p}% · ${short(m.cost * p / 100)}</option>`).join('')}</select><button class="btn" data-cjoinsel="${k.id}" ${100 - k.taken >= 10 ? '' : 'disabled'}>Влез</button></div>`;
        if (mine) h += `<div class="row" style="margin-top:8px;justify-content:flex-end;gap:6px">${k.founder_me ? `<select data-ipartner="${k.id}" style="width:auto;padding:6px">${cons.partners.map(p => `<option value="${p.id}">${esc(p.name)} · ниво ${p.level}</option>`).join('')}</select><select data-ipct="${k.id}" style="width:auto;padding:6px">${PCTS.filter(p => p <= 100 - k.taken).map(p => `<option value="${p}">${p}%</option>`).join('')}</select><button class="btn" data-cinv="${k.id}" ${cons.partners.length && 100 - k.taken >= 10 ? '' : 'disabled'}>📨 Покани</button>` : ''}<button class="btn2" data-cleave="${k.id}">${k.founder_me ? 'Разпусни' : 'Излез'}</button></div>`;
        if (k.invites && k.invites.length) h += `<div class="meta" style="margin-top:4px">Покани: ${k.invites.map(i => `${esc(i.name)} ${i.pct}% ${i.status === 'pending' ? '⏳' : i.status === 'accepted' ? '✅' : '✖'}`).join(' · ')}</div>`;
      }
    }
    h += '</div>';
  }
  return h;
}
const qf = n => Number(n).toLocaleString('bg-BG', { maximumFractionDigits: 2 });
function mktHtml() {
  if (!market) return '<div class="meta">Зареждам пазара…</div>';
  const M = market, R = M.rules, g = M.goods.find(x => x.good === mktGood) || M.goods[0], best = g.book[0];
  let h = `<div class="card"><div class="meta">📦 Строежите ползват стоки от <b style="color:var(--txt)">склада</b>; липсващото се купува от държавата на пълна цена. На пазара продаваш на цена до държавната (стоката се блокира, докато се продаде или отмениш) — продавачът плаща ${Math.round(R.fee_pct * 100)}% такса. Държавата изкупува на ${Math.round(R.buyback_pct * 100)}%. Заета машина харчи ${qf(R.fuel_per_machine)} т гориво на ден.</div></div>`;
  h += `<div class="row" style="justify-content:flex-start;gap:4px;flex-wrap:wrap">${M.goods.map(x => `<button class="${x.good === g.good ? 'btn' : 'btn2'}" style="padding:5px 9px;font-size:13px" data-good="${x.good}">${x.ico} ${x.nm} <span style="opacity:.75">${qf(x.mine)}</span></button>`).join('')}</div>`;
  h += `<div class="card"><h3>${g.ico} ${g.nm}</h3><div class="meta">Държавна цена ${eur(g.price)}/${g.unit} · изкупува ${eur(g.price * R.buyback_pct)} · в склада <b style="color:var(--txt)">${qf(g.mine)} ${g.unit}</b>${g.last ? ` · последна сделка ${eur(g.last)}` : ''}</div>
    <div style="margin-top:6px">${g.book.map(b => `<div class="led"><span>${qf(b.qty)} ${g.unit} (${tr(b.n === 1 ? '{0} оферта' : '{0} оферти', [b.n])})</span><b class="ok">${eur(b.price)}</b></div>`).join('') || '<div class="meta">Няма оферти от други фирми.</div>'}</div>
    <div class="row" style="margin-top:8px"><input id="byQ" inputmode="decimal" placeholder="колко ${g.unit}" style="padding:7px"><input id="byP" inputmode="numeric" placeholder="до € / ${g.unit}" value="${best ? best.price / 100 : ''}" style="padding:7px"><button class="btn" id="byGo" ${best ? '' : 'disabled'}>Купи</button></div>
    <div class="row" style="margin-top:6px"><input id="slQ" inputmode="decimal" placeholder="колко ${g.unit}" style="padding:7px"><input id="slP" inputmode="numeric" placeholder="€ / ${g.unit}" value="${Math.round(g.price * 0.85 / 100)}" style="padding:7px"><button class="btn2" id="slGo" ${g.mine > 0 ? '' : 'disabled'}>Продай</button></div>
    <div class="row" style="margin-top:6px;justify-content:flex-end"><button class="btn2" id="stGo" ${g.mine > 0 ? '' : 'disabled'} title="продава въведеното количество от реда „Продай“">🏛️ На държавата (${Math.round(R.buyback_pct * 100)}%)</button></div></div>`;
  if (M.my_asks.length) h += `<div class="card"><h3>📤 Моите оферти</h3>${M.my_asks.map(a => { const x = M.goods.find(q => q.good === a.good); return `<div class="led"><span>${x.ico} ${qf(a.qty)} ${x.unit} по ${eur(a.price)}</span><button class="btn2" style="padding:2px 8px;font-size:12px" data-cancel="${a.id}">Отмени</button></div>`; }).join('')}</div>`;
  h += `<h3 style="margin:4px 0 0;font-size:14px">🏭 Производства</h3>`;
  h += M.facility_types.map(f => { const n = M.facilities[f.type] || 0, x = M.goods.find(q => q.good === f.good), locked = M.level < f.min_level;
    return `<div class="card" style="${locked ? 'opacity:.55' : ''}"><div class="row"><span><b>${f.ico} ${f.nm}</b>${n ? ` <span class="meta">× ${n}</span>` : ''}<br><span class="meta">${qf(f.out_qty)} ${x.unit} ${x.nm.toLowerCase()} на ден${+f.energy ? ` · ползва ${qf(f.energy)} MWh` : ''} · поддръжка ${eur(f.upkeep)}/ден</span></span>
      ${locked ? `<span class="meta">🔒 ниво ${f.min_level}</span>` : `<button class="btn" data-fac="${f.type}" ${M.cash >= f.cost ? '' : 'disabled'}>${eur(f.cost)}</button>`}</div></div>`; }).join('');
  if (M.trades.length) h += `<div class="card"><h3>📰 Последни сделки</h3>${M.trades.map(t => { const x = M.goods.find(q => q.good === t.good); return `<div class="led"><span>${x.ico} ${qf(t.qty)} ${x.unit} · ${esc(t.seller)} → ${esc(t.buyer)}</span><b${t.mine ? ' style="color:var(--acc)"' : ''}>${eur(t.price)}</b></div>`; }).join('')}</div>`;
  return h;
}
const short = c => Math.abs(c) >= 1e11 ? (c / 1e11).toLocaleString('bg-BG', { maximumFractionDigits: 1 }) + ' млрд. €' : Math.abs(c) >= 1e8 ? (c / 1e8).toLocaleString('bg-BG', { maximumFractionDigits: 1 }) + ' млн. €' : eur(c);
function relHtml(p) {
  if (p.me || !rels) return '';
  const r = rels.companies.find(x => x.id === p.id); if (!r) return '';
  const st = r.ally ? '<b class="ok">🤝 Съюзници</b> — търгувате без такса, виждате офертите си в търговете и концесиите и можете да си подарявате пари и да си давате заеми (таб 🏦).' : r.ally_pending_in ? `<b style="color:var(--acc)">🤝 ${esc(p.name)} ти предлага съюз</b>` : r.ally_pending_out ? '⏳ Предложи съюз — чакаш отговор.' : r.rival_out || r.rival_in ? `<b class="bad">⚔️ Съперници</b>${r.rival_in && !r.rival_out ? ' (той те обяви)' : r.rival_out && !r.rival_in ? ' (ти го обяви)' : ''} — всяка победа в търг или концесия носи бонус XP.` : 'Неутрални.';
  const btn = (act, txt, cls = 'btn2') => `<button class="${cls}" data-rel="${p.id}:${act}">${txt}</button>`;
  let b = '';
  if (r.ally) b = btn('unally', 'Прекрати съюза');
  else if (r.ally_pending_in) b = btn('ally', '✅ Приеми съюза', 'btn') + btn('unally', 'Откажи');
  else if (r.ally_pending_out) b = btn('unally', 'Оттегли поканата');
  else if (!r.rival_out && !r.rival_in) b = btn('ally', `🤝 Предложи съюз${rels.allies_n >= rels.max_allies ? ' (лимит)' : ''}`, 'btn') + btn('rival', '⚔️ Обяви за съперник');
  if (r.rival_out) b += btn('unrival', 'Прекрати съперничеството');
  return `<div class="card" style="border-color:${r.ally ? 'var(--ok)' : r.rival_out || r.rival_in ? 'var(--bad)' : 'var(--line)'}"><div class="meta">${st}${r.wins || r.losses ? `<br>⚔️ Двубои: <b style="color:var(--txt)">${r.wins} : ${r.losses}</b>` : ''}</div><div class="row" style="margin-top:8px;justify-content:flex-start;gap:6px;flex-wrap:wrap">${b}</div></div>`;
}
const relIco = id => { const r = rels && rels.companies.find(x => x.id === id); return !r ? '' : r.ally ? ' 🤝' : r.rival_out || r.rival_in ? ' ⚔️' : r.ally_pending_in ? ' 📨' : ''; };
const DIV = { novice: '🌱 Новаци', pro: '⚙️ Професионалисти', tycoon: '👑 Магнати' };
function seasonHtml() {
  if (!season) return '<div class="meta">Зареждам сезона…</div>';
  const S2 = season.season;
  let h = '';
  if (S2) {
    const mine = S2.my_division, order = [mine, ...Object.keys(DIV).filter(d => d !== mine)].filter(d => S2.divisions && S2.divisions[d]);
    h += `<div class="card" style="border-color:var(--acc)"><h3>🏁 Сезон ${S2.n}</h3><div class="meta">Край след <b style="color:var(--acc)">${until(S2.ends_at)}</b> · твоята дивизия: <b style="color:var(--txt)">${DIV[mine] || '—'}</b></div></div>`;
    for (const d of order) h += `<div class="card"><h3>${DIV[d]}</h3>${S2.divisions[d].map((r, i) => { const b = brandOf(r.brand);
      return `<div class="led" style="${r.me ? 'color:var(--acc)' : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} <b style="color:${b.col}">${b.ico} ${esc(r.name)}</b>${r.me ? ' (ти)' : ''}</span><b class="${r.score < 0 ? 'bad' : 'ok'}">${r.score >= 0 ? '+' : ''}${short(r.score)}</b></div>`; }).join('')}</div>`;
  } else h += '<div class="meta">Сезонът започва до минута.</div>';
  h += `<div class="meta">📜 ${esc(season.rules)}</div>`;
  if (season.archive.length) h += `<h3 style="margin:4px 0 0;font-size:14px">🏛️ Архив на шампионите</h3>` + season.archive.map(a => `<div class="card"><h3>Сезон ${a.n}</h3>${(a.top || []).map(t => `<div class="led"><span>${['🥇', '🥈', '🥉'][t.rank - 1]} ${esc(t.name)} <span class="meta">${DIV[t.division]}</span></span><b>${short(t.score)}</b></div>`).join('')}</div>`).join('');
  return h;
}
function rankHtml() {
  if (profile) {
    const p = profile.company, b = brandOf(p.brand);
    return `<button class="btn2" data-back="1">← Класация</button>
      <div class="card" style="border-color:${b.col}"><h3 style="font-size:18px;color:${b.col}">${b.ico} ${esc(p.name)}${p.me ? ' <span class="meta">(ти)</span>' : ''}${isOn(p.id) ? ' <span class="meta" style="color:#9ff0bd">🟢 онлайн сега</span>' : ''}</h3>
      <div class="meta">${esc(CITIES[p.city] || p.city)} · ниво ${p.level} · от ${new Date(p.since).toLocaleDateString('bg-BG')}</div>${(profile.trophies || []).length ? `<div style="margin-top:6px">${profile.trophies.map(t => `<span title="Сезон ${t.n}, ${DIV[t.division]}" style="font-size:13px;margin-right:8px">${['🥇', '🥈', '🥉'][t.rank - 1]} Сезон ${t.n}</span>`).join('')}</div>` : ''}</div>
      ${relHtml(p)}
      <div class="stats"><div><b>${short(p.value)}</b><span>стойност</span></div><div><b class="${p.profit7 < 0 ? 'bad' : ''}">${short(p.profit7)}</b><span>печалба за 7 дни</span></div>
        <div><b>${p.contracts_done}</b><span>изпълнени договора</span></div><div><b>${p.builds_done}</b><span>предадени строежа</span></div></div>
      <div class="card"><h3>🧮 Стойността по части</h3>
        <div class="led"><span>Наличност</span><b class="${p.cash < 0 ? 'bad' : ''}">${eur(p.cash)}</b></div><div class="led"><span>Блокирани депозити</span><b>${eur(p.held)}</b></div>
        <div class="led"><span>Техника (50% от цената)</span><b>${eur(p.units)}</b></div><div class="led"><span>Строежи в ход (материали)</span><b>${eur(p.wip)}</b></div>${p.facilities ? `<div class="led"><span>Производства (50%)</span><b>${eur(p.facilities)}</b></div>` : ''}${p.goods ? `<div class="led"><span>Стоки (60%)</span><b>${eur(p.goods)}</b></div>` : ''}${p.stakes ? `<div class="led"><span>Консорциуми</span><b>${eur(p.stakes)}</b></div>` : ''}${p.concessions ? `<div class="led"><span>Концесии</span><b>${eur(p.concessions)}</b></div>` : ''}${p.debt ? `<div class="led"><span>Дълг</span><b class="bad">−${eur(p.debt)}</b></div>` : ''}${p.ally ? `<div class="led"><span>Съюзни заеми (вземания − задължения)</span><b class="${p.ally < 0 ? 'bad' : ''}">${eur(p.ally)}</b></div>` : ''}${p.sold_pct ? `<div class="led"><span>Продадени дялове</span><b class="bad">−${p.sold_pct}%</b></div>` : ''}${p.shares ? `<div class="led"><span>Дялове в други фирми</span><b>${eur(p.shares)}</b></div>` : ''}
        <div class="led"><span><b>Общо</b></span><b style="color:var(--acc)">${eur(p.value)}</b></div></div>
      ${profile.won.length ? `<div class="card"><h3>🏛️ Търгове</h3>${profile.won.map(k => `<div class="led"><span>${esc(k.title)}</span><b>${k.status === 'done' ? '✅' : k.status === 'failed' ? '❌' : '⏳'} ${eur(k.price)}</b></div>`).join('')}<div class="meta" style="margin-top:4px">Провалени: ${p.contracts_failed}</div></div>` : ''}
      ${profile.recent.length ? `<div class="card"><h3>🏗️ Последни строежи</h3>${profile.recent.map(r => `<div class="led"><span>${esc(r.title)}</span><span class="meta">ден ${r.day}</span></div>`).join('')}</div>` : ''}`;
  }
  const sw = `<div class="row" style="justify-content:flex-start;gap:4px"><button class="${rankView === 'season' ? 'btn' : 'btn2'}" style="padding:5px 10px;font-size:13px" data-rv="season">🏁 Сезон</button><button class="${rankView === 'all' ? 'btn' : 'btn2'}" style="padding:5px 10px;font-size:13px" data-rv="all">🏆 Обща класация</button></div>`;
  if (rankView === 'season') return sw + seasonHtml();
  if (!ranking) return sw + '<div class="meta">Зареждам класацията…</div>';
  const col = { value: ['стойност', 'value'], profit: ['печалба 7 дни', 'profit7'], contracts: ['договори', 'contracts_done'] };
  return sw + `<div class="row" style="justify-content:flex-start;gap:4px">${Object.entries(col).map(([k, [nm]]) => `<button class="${k === rankSort ? 'btn' : 'btn2'}" style="padding:5px 10px;font-size:13px" data-sort="${k}">${nm}</button>`).join('')}</div>
    ${ranking.rows.map(r => { const b = brandOf(r.brand), v = r[col[rankSort][1]];
      return `<div class="card" data-prof="${r.id}" style="cursor:pointer;padding:9px 12px;${r.me ? 'border-color:var(--acc)' : ''}"><div class="row"><span style="font-size:${r.rank <= 3 ? 22 : 15}px;width:34px;text-align:center">${['🥇', '🥈', '🥉'][r.rank - 1] || r.rank}</span>
        <span style="flex:1;min-width:0"><b style="color:${b.col}">${b.ico} ${esc(r.name)}</b>${onDot(r.id)}${r.me ? ' <span class="meta">(ти)</span>' : relIco(r.id)}<br><span class="meta">${esc(CITIES[r.city] || r.city)} · ниво ${r.level} · ${r.contracts_done} договора</span></span>
        <b class="${rankSort === 'profit' && v < 0 ? 'bad' : ''}" style="white-space:nowrap">${rankSort === 'contracts' ? v : short(v)}</b></div></div>`; }).join('')}
    <div class="meta">🧮 ${esc(ranking.formula)}</div>`;
}
const until = iso => { const ms = Date.parse(iso) - (Date.now() + srvOff); if (ms <= 0) return 'изтече'; const d = ms / dayLen(); return d >= 1 ? `${d.toFixed(1).replace('.', ',')} дни` : `${Math.ceil(ms / 60000)} мин`; };
const profitHtml = (t, cents) => { if (!cents) return ''; const adv = cents * tenders.rules.advance_pct, pr = cents - t.mat; const gap = t.mat - adv, have = state.company.cash; return `Печалба ~<b class="${pr >= 0 ? 'ok' : 'bad'}">${eur(pr)}</b> · при старта: аванс ${eur(adv)}, материали ${eur(t.mat)}${gap > 0 ? ` — ще ти трябват <b class="${have >= gap ? 'ok' : 'bad'}">${eur(gap)}</b> налични${have < gap ? ' (сега нямаш толкова!)' : ''}` : ''}`; };
function tendHtml(s, U, needHtml) {
  if (!tenders) return '<div class="meta">Зареждам търговете…</div>';
  const R = tenders.rules, c = s.company;
  let h = `<div class="card"><div class="meta">📜 <b style="color:var(--txt)">Правила:</b> офертите са скрити. Печели най-ниската валидна цена; при равни цени — по-рано подадената (промяната на офертата мести времето ѝ). Цената е между ${Math.round(R.min_price_pct * 100)}% и 100% от бюджета. При подаване се блокира депозит; до срока офертата може да се промени или оттегли (оттеглена не се подава пак). Загубилите си получават депозита веднага. Техниката за спечелен договор се запазва веднага, а изпълнението тръгва само, щом тя се освободи (или го пуснеш ръчно); ако не тръгне в срок — губиш депозита. Може да имаш най-много толкова договори <i>и</i> оферти, колкото позволява лимитът, и само ако техниката ти стига за всички. При старта получава аванс ${Math.round(R.advance_pct * 100)}% и плаща материалите; при предаване — остатъка, XP и депозита. Най-много ${R.max_contracts} активни договора.<br>Нива: местни ${R.tiers.local[0]}–${R.tiers.local[1]} · национални ${R.tiers.national[0]}–${R.tiers.national[1]} · световни от ${R.tiers.global[0]}. Блокирани сега: <b style="color:var(--txt)">${eur(c.held || 0)}</b></div></div>`;
  for (const k of tenders.contracts) {
    const st = k.status === 'awaiting' ? `⏳ започни до <b style="color:var(--acc)">${until(k.start_by)}</b> — иначе губиш депозита ${eur(k.deposit)}` : k.status === 'running' ? `🏗️ в изпълнение · ${left(k.end_at)}` : k.status === 'done' ? '✅ изпълнен' : '❌ провален — депозитът е задържан';
    const needCash = k.mat - k.advance, canPay = c.cash >= needCash;
    h += `<div class="card offer" style="border-color:${k.status === 'awaiting' ? 'var(--acc)' : 'var(--line)'}"><h3>📑 ${esc(k.title)}</h3><div class="meta">Договор ${eur(k.price)} · ${k.days} дни · ${st}</div>
      ${k.status === 'awaiting' ? `<div class="need">${needHtml(k.need)}</div><div class="row" style="margin-top:8px"><span class="meta">Аванс ${eur(k.advance)} · материали ${eur(k.mat)}${needCash > 0 ? ` · нужни налични <b class="${canPay ? 'ok' : 'bad'}">${eur(needCash)}</b>` : ''}</span><button class="btn" data-kstart="${k.id}" ${canPay ? '' : 'disabled'}>▶️ Започни</button></div>` : ''}</div>`;
  }
  for (const tier of ['local', 'national', 'global']) {
    const list = tenders.open.filter(t => t.tier === tier); if (!list.length) continue;
    h += `<h3 style="margin:4px 0 0;font-size:14px">${TIER[tier]}</h3>`;
    h += list.map(t => { const my = t.my && t.my.status === 'active' ? t.my : null, draft = bidDraft[t.id] ?? (my ? my.price / 100 : '');
      return `<div class="card offer"><h3>${esc(t.title)}</h3>
        <div class="meta">Бюджет <b class="ok">${eur(t.budget)}</b> · депозит ${eur(t.deposit)} · материали ${eur(t.mat)} · ${t.days} дни изпълнение · старт до ${t.start_days} дни след победата<br>⏱️ оферти до: <b style="color:var(--txt)">${until(t.closes_at)}</b> · ${tr(t.bids === 1 ? '{0} оферта' : '{0} оферти', [t.bids])}${my ? ` · твоята: <b style="color:var(--acc)">${eur(my.price)}</b>` : t.my && t.my.status === 'withdrawn' ? ' · оттеглена' : ''}</div>
        ${(t.ally_bids || []).length ? `<div class="meta" style="margin-top:4px;color:#9ff0bd">🤝 Съюзници: ${t.ally_bids.map(x => `${esc(x.name)} — ${eur(x.price)}`).join(' · ')}</div>` : ''}${t.rival_bids ? `<div class="meta" style="margin-top:4px;color:#ffb3b3">⚔️ Наддава и съперник (${t.rival_bids})</div>` : ''}
        <div class="need">${needHtml(t.need)}</div>
        ${t.why_not ? `<div class="meta" style="margin-top:6px;color:#ffb3b3">🚫 ${esc(t.why_not)}</div>` : `
        <div class="row" style="margin-top:8px;gap:4px;justify-content:flex-start;flex-wrap:wrap">${[1, 0.95, 0.9, 0.85, 0.8, 0.7].map(k => `<button class="btn2" style="padding:3px 7px;font-size:12px" data-pct="${t.id}:${k}">${k === 1 ? '100%' : '−' + Math.round((1 - k) * 100) + '%'}</button>`).join('')}</div>
        <div class="row" style="margin-top:6px"><input data-bidin="${t.id}" inputmode="numeric" placeholder="цена в €" value="${draft}" style="padding:7px;font-size:15px"><button class="btn" data-bid="${t.id}">${my ? '✏️ Промени' : '📨 Подай'}</button>${my ? `<button class="btn2" data-wd="${t.id}">Оттегли</button>` : ''}</div>
        <div class="meta" data-profit="${t.id}" style="margin-top:4px">${profitHtml(t, (bidDraft[t.id] ?? (my ? my.price / 100 : 0)) * 100)}</div>`}</div>`; }).join('');
  }
  if (tenders.closed.length) h += `<h3 style="margin:4px 0 0;font-size:14px">📰 Резултати</h3><div class="card">${tenders.closed.map(t => `<div class="led"><span>${esc(t.title)}${t.mine ? ` · ${t.mine === 'won' ? '🏆 ти' : t.mine === 'lost' ? 'загубен' : 'оттеглен'}` : ''}</span><b style="white-space:nowrap">${t.winner ? `${esc(t.winner)} · ${eur(t.price)}` : 'без оферти'}</b></div>`).join('')}</div>`;
  return h;
}
// кой е онлайн сега: сървърът връща фирмите, активни през последните 40 s (заедно с ol_state на всеки 5 s)
const isOn = id => !!(state && (state.online || []).some(o => o.id === id));
const onDot = id => isOn(id) ? ' <span title="Онлайн сега" style="font-size:.8em">🟢</span>' : '';
let whoOpen = false;
function whoRender() {
  const L = (state && state.online) || [];
  $('whoN').textContent = L.length;
  $('who').title = L.length === 1 ? 'Само ти си онлайн сега' : `${L.length} фирми са онлайн сега`;
  const box = $('whoBox'); box.classList.toggle('hidden', !whoOpen);
  if (!whoOpen) return;
  box.innerHTML = `<div class="meta" style="margin:0 6px 6px">🟢 Онлайн сега · ${L.length}</div>` + L.map(o => { const b = brandOf(o.brand);
    return `<div class="wrow" data-who="${o.id}">🟢 <b style="color:${b.col}">${b.ico} ${esc(o.name)}</b><span class="meta" style="margin-left:auto">ниво ${o.level}${o.me ? ' · ти' : relIco(o.id)}</span></div>`; }).join('')
    + (L.length === 1 ? '<div class="meta" style="margin:6px">Засега си само ти. Покани приятели — администраторът има код за покана.</div>' : '');
  box.querySelectorAll('[data-who]').forEach(x => x.onclick = async () => {
    whoOpen = false; whoRender();
    const id = +x.dataset.who, p = await api.company(worldId, id); if (!p.ok) return;
    const tr = await api.trophies(worldId, id).catch(() => null); p.trophies = tr?.trophies || [];
    tab = 'rank'; profile = p; render(); refresh();
  });
}
$('who').onclick = e => { e.stopPropagation(); whoOpen = !whoOpen; whoRender(); };
document.addEventListener('click', e => { if (whoOpen && !$('whoBox').contains(e.target)) { whoOpen = false; whoRender(); } });
function render() {
  const s = state, c = s.company, b = brandOf(c.brand), U = Object.fromEntries(s.catalog.units.map(u => [u.type, u]));
  $('coName').innerHTML = `<span style="color:${b.col}">${b.ico} ${esc(c.name)}</span>`;
  $('cash').textContent = eur(c.cash); $('cash').className = c.cash < 0 ? 'bad' : '';
  whoRender();
  $('day').innerHTML = `ден ${s.world.day}<span class="lvm"> · ниво ${c.level}</span>`;
  const unseen = s.notes.filter(n => !n.seen).length, run = s.builds.filter(x => x.status === 'running');
  $('tabs').innerHTML = TABS.map(([k, nm]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${nm}${k === 'notes' && unseen ? `<span class="badge">${unseen}</span>` : ''}${k === 'build' && run.length ? `<span class="badge">${run.length}</span>` : ''}</button>`).join('');
  $('tabs').querySelectorAll('[data-t]').forEach(x => x.onclick = () => { tab = x.dataset.t; render(); if (['tend', 'rank', 'mkt', 'cons', 'conc', 'co'].includes(tab)) { profile = null; refresh(); } if (tab === 'notes' && unseen) api.notesSeen(worldId, lastNote).then(() => refresh()); });
  const needHtml = need => Object.entries(need).map(([k, n]) => `<span class="${(s.free[k] || 0) < n ? 'miss' : ''}">${U[k].ico} ${U[k].nm} ×${n}</span>`).join('');
  let h = '';
  if (tab === 'build') {
    h = `<div class="meta">Поръчките идват от сървъра и важат ${s.world.cfg.offer_days} дни. Материалите се плащат при старта; парите и XP идват, щом строежът завърши — дори играта да е затворена.</div>`;
    h += run.map(x => { const p = Math.max(0, Math.min(1, (Date.now() + srvOff - Date.parse(x.start_at)) / (Date.parse(x.end_at) - Date.parse(x.start_at))));
      return `<div class="card" data-focus="${x.lot}" style="cursor:pointer"><h3>${esc(x.title)}</h3><div class="meta">🎁 ${eur(x.reward)} · +${x.xp} XP · ${left(x.end_at)}</div><div class="bar" style="margin-top:6px"><i data-prog="${x.id}" style="width:${Math.round(p * 100)}%"></i></div></div>`; }).join('');
    h += `<h3 style="margin:4px 0 0;font-size:14px">📋 Нови поръчки</h3>`;
    h += s.offers.map(o => { const k = s.catalog.kinds.find(q => q.kind === o.kind), ok = Object.entries(k.need).every(([t, n]) => (s.free[t] || 0) >= n), money = c.cash >= o.mat;
      return `<div class="card offer"><h3>${k.ico} ${k.nm} — ${esc(o.client)}</h3>
        <div class="meta">Бюджет <b class="ok">${eur(o.reward)}</b> · материали ${eur(o.mat)} (${Object.entries(k.goods || {}).map(([g, q]) => `${q} ${g === 'concrete' ? 'м³ бетон' : 'т стомана'}`).join(', ')} — първо от склада) · ${o.days} дни · +${Math.floor(o.reward / 10000)} XP · важи до ден ${o.expires_day}</div>
        <div class="need">${needHtml(k.need)}</div>
        <div class="row" style="margin-top:8px"><span class="meta">${!ok ? 'Няма свободна техника.' : !money ? 'Нямаш пари за материалите.' : ''}</span><button class="btn" data-start="${o.id}" ${ok && money ? '' : 'disabled'}>🏗️ Започни</button></div></div>`; }).join('') || '<div class="meta">Няма поръчки — нови идват всеки ден.</div>';
  } else if (tab === 'tend') {
    h = tendHtml(s, U, needHtml);
  } else if (tab === 'mkt') {
    h = mktHtml();
  } else if (tab === 'cons') {
    h = consHtml();
  } else if (tab === 'conc') {
    h = concHtml(U);
  } else if (tab === 'rank') {
    h = rankHtml();
  } else if (tab === 'units') {
    h = `<div class="meta">Поддръжка и заплати: <b style="color:var(--txt)">${eur(c.upkeep)}</b> на ден. Ако не влизаш повече от ${s.world.cfg.idle_days} дни, фирмата минава „в покой“ — без поддръжка, докато се върнеш.</div>`;
    h += s.catalog.units.map(u => `<div class="card unit"><img src="assets/ui/buy-${u.type}.webp" alt=""><div style="flex:1"><h3>${u.ico} ${u.nm} <span class="meta" style="margin-left:auto">${s.units[u.type] || 0} бр. · свободни ${s.free[u.type] ?? 0}</span></h3>
      <div class="meta">${eur(u.cost)} · ${eur(u.upkeep)}/ден</div>
      <div class="row" style="margin-top:6px;justify-content:flex-end"><button class="btn2" data-sell="${u.type}" ${(s.free[u.type] || 0) > 0 ? '' : 'disabled'}>Продай (${eur(u.cost / 2)})</button><button class="btn" data-buy="${u.type}" ${c.cash >= u.cost ? '' : 'disabled'}>Купи</button></div></div></div>`).join('');
  } else if (tab === 'co') {
    const pct = Math.round((c.xp - c.lv_from) / Math.max(1, c.lv_to - c.lv_from) * 100);
    h = `<div class="stats"><div><b>${eur(c.cash)}</b><span>налични</span></div><div><b>${c.level}</b><span>ниво · ${Number(c.xp).toLocaleString('bg-BG')} XP</span></div></div>
      ${c.level < 20 ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="meta">до ниво ${c.level + 1}: ${(c.lv_to - c.xp).toLocaleString('bg-BG')} XP</div>` : ''}
      <div class="card"><h3>🌐 ${esc(s.world.name)}</h3><div class="meta">Ден ${s.world.day} · 1 игрален ден = ${Math.round(s.world.day_seconds / 60)} мин реално време — еднакво за всички фирми.<br>Централа: ${esc(CITIES[c.city] || c.city)}</div>
      <div class="bar" style="margin-top:8px"><i id="dayBar" style="width:${Math.round(s.world.frac * 100)}%"></i></div></div>
      ${finHtml()}
      ${allyHtml()}
      <div class="card"><h3>📒 Финансов журнал</h3>${s.ledger.map(l => `<div class="led"><span>ден ${l.day} · ${esc(l.note || l.reason)}</span><b class="${l.amount < 0 ? 'bad' : 'ok'}">${l.amount < 0 ? '' : '+'}${eur(l.amount)}</b></div>`).join('') || '<div class="meta">Няма движения.</div>'}</div>
      <button class="btn2" id="toWorlds">🌐 Светове</button>`;
  } else if (tab === 'notes') {
    h = s.notes.map(n => `<div class="card"><h3>${n.seen ? '' : '🆕 '}${esc(n.title)}</h3><div class="meta">${esc(n.body || '')}<br>${new Date(n.at).toLocaleString('bg-BG')}</div></div>`).join('') || '<div class="meta">Няма известия.</div>';
  }
  const sc = $('body').scrollTop; $('body').innerHTML = h; $('body').scrollTop = sc;
  $('toWorlds')?.addEventListener('click', () => { clearInterval(pollT); worldsScreen(); });
  const doAct = async (btn, f, okMsg) => { if (busy) return; busy = true; btn.disabled = true; try { await f(); if (okMsg) toast(okMsg); } catch (e) { toast(errMsg(e), 'bad'); } busy = false; await refresh(); };
  document.querySelectorAll('[data-start]').forEach(x => x.onclick = () => doAct(x, async () => { const r = await api.startBuild(worldId, +x.dataset.start); pendingFocus = r.build; }, '🏗️ Строежът започна!'));
  document.querySelectorAll('[data-buy]').forEach(x => x.onclick = () => doAct(x, () => api.buyUnit(worldId, x.dataset.buy), `${U[x.dataset.buy].ico} ${U[x.dataset.buy].nm} е купен(а).`));
  document.querySelectorAll('[data-sell]').forEach(x => x.onclick = () => doAct(x, () => api.sellUnit(worldId, x.dataset.sell), 'Продадено.'));
  document.querySelectorAll('[data-focus]').forEach(x => x.onclick = () => view && view.focusLot(+x.dataset.focus));
  const eurIn = id => Math.round(+String($(id)?.value || '').replace(/[^\d]/g, '') * 100);
  const amIn = id => Math.round(+String(document.querySelector(`[data-amA="${id}"]`)?.value || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '') * 100);
  document.querySelectorAll('[data-agift]').forEach(x => x.onclick = () => { const id = +x.dataset.agift; doAct(x, () => api.allyGift(worldId, id, amIn(id)), '🎁 Подаръкът е изпратен.'); });
  document.querySelectorAll('[data-aloan]').forEach(x => x.onclick = () => { const id = +x.dataset.aloan; doAct(x, () => api.allyLoan(worldId, id, amIn(id), +document.querySelector(`[data-amD="${id}"]`).value, +document.querySelector(`[data-amR="${id}"]`).value), '💸 Предложението е изпратено — съюзникът трябва да го приеме.'); });
  document.querySelectorAll('[data-lact]').forEach(x => x.onclick = () => { const [id, a] = x.dataset.lact.split(':'); doAct(x, () => api.allyLoanAct(worldId, +id, a), { accept: '💸 Заемът е приет — парите са при теб.', decline: 'Заемът е отказан.', cancel: 'Предложението е оттеглено.', forgive: '🎁 Заемът е опростен.' }[a]); });
  document.querySelectorAll('[data-lrepay]').forEach(x => x.onclick = () => { const [id, v] = x.dataset.lrepay.split(':'); doAct(x, () => api.allyRepay(worldId, +id, +v), '💸 Върна заема.'); });
  $('lnGo')?.addEventListener('click', () => doAct($('lnGo'), () => api.loan(worldId, eurIn('lnA')), '🏦 Заемът е изтеглен.'));
  $('rpGo')?.addEventListener('click', () => doAct($('rpGo'), () => api.repay(worldId, eurIn('lnA') || fin.debt), 'Заемът е погасен.'));
  $('soGo')?.addEventListener('click', () => doAct($('soGo'), () => api.shareOffer(worldId, +$('soP').value, eurIn('soC')), '📤 Дялът е пуснат за продан.'));
  $('soClose')?.addEventListener('click', () => doAct($('soClose'), () => api.shareOffer(worldId, 0, 0), 'Предложението е спряно.'));
  document.querySelectorAll('[data-bb]').forEach(x => x.onclick = () => doAct(x, () => api.buyback(worldId, +x.dataset.bb), 'Делът е изкупен обратно.'));
  document.querySelectorAll('[data-shb]').forEach(x => x.onclick = () => doAct(x, () => api.buyShares(worldId, +x.dataset.shb, +document.querySelector(`[data-shp="${x.dataset.shb}"]`).value), '📈 Купи дял — ще получаваш дивиденти.'));
  document.querySelectorAll('[data-cbin]').forEach(x => x.oninput = () => { concDraft[x.dataset.cbin] = +x.value.replace(/\D/g, ''); });
  document.querySelectorAll('[data-cbid]').forEach(x => x.onclick = () => { const r = x.dataset.cbid, v = concDraft[r] ?? +document.querySelector(`[data-cbin="${r}"]`).value.replace(/\D/g, ''); doAct(x, async () => { await api.concBid(worldId, +r, v * 100); delete concDraft[r]; }, '📨 Офертата е подадена — сумата е блокирана.'); });
  const sel = q => document.querySelector(q)?.value;
  document.querySelectorAll('[data-found]').forEach(x => x.onclick = () => { const k = x.dataset.found; doAct(x, () => api.consFound(worldId, k, +sel(`[data-fpct="${k}"]`), !!document.querySelector(`[data-fopen="${k}"]`)?.checked), '🤝 Консорциумът е основан — покани партньори.'); });
  document.querySelectorAll('[data-cjoin]').forEach(x => x.onclick = () => { const [k, p] = x.dataset.cjoin.split(':'); doAct(x, () => api.consJoin(worldId, +k, +p), '🤝 Влезе в консорциума.'); });
  document.querySelectorAll('[data-cjoinsel]').forEach(x => x.onclick = () => { const k = x.dataset.cjoinsel; doAct(x, () => api.consJoin(worldId, +k, +sel(`[data-jpct="${k}"]`)), '🤝 Влезе в консорциума.'); });
  document.querySelectorAll('[data-cdecl]').forEach(x => x.onclick = () => doAct(x, () => api.consDecline(worldId, +x.dataset.cdecl), 'Поканата е отказана.'));
  document.querySelectorAll('[data-cleave]').forEach(x => x.onclick = () => doAct(x, () => api.consLeave(worldId, +x.dataset.cleave), 'Вноската е върната.'));
  document.querySelectorAll('[data-cinv]').forEach(x => x.onclick = () => { const k = x.dataset.cinv; doAct(x, () => api.consInvite(worldId, +k, +sel(`[data-ipartner="${k}"]`), +sel(`[data-ipct="${k}"]`)), '📨 Поканата е изпратена.'); });
  document.querySelectorAll('[data-good]').forEach(x => x.onclick = () => { mktGood = x.dataset.good; render(); });
  const num = id => +String($(id)?.value || '').replace(',', '.').replace(/[^\d.]/g, '');
  $('byGo')?.addEventListener('click', () => doAct($('byGo'), async () => { const r = await api.buy(worldId, mktGood, num('byQ'), Math.round(num('byP') * 100)); toast(r.msg || `Купени ${qf(r.qty)} за ${eur(r.paid)}.`, r.qty ? 'good' : 'bad'); }));
  $('slGo')?.addEventListener('click', () => doAct($('slGo'), () => api.sellOrder(worldId, mktGood, num('slQ'), Math.round(num('slP') * 100)), '📤 Офертата е на пазара.'));
  $('stGo')?.addEventListener('click', () => doAct($('stGo'), async () => { const r = await api.sellState(worldId, mktGood, num('slQ')); toast(`Държавата плати ${eur(r.paid)}.`); }));
  document.querySelectorAll('[data-cancel]').forEach(x => x.onclick = () => doAct(x, () => api.cancelOrder(worldId, +x.dataset.cancel), 'Офертата е отменена — стоката е обратно в склада.'));
  document.querySelectorAll('[data-fac]').forEach(x => x.onclick = () => doAct(x, () => api.buildFacility(worldId, x.dataset.fac), '🏭 Производството работи — произвежда всеки ден.'));
  document.querySelectorAll('[data-sort]').forEach(x => x.onclick = async () => { rankSort = x.dataset.sort; ranking = await api.ranking(worldId, rankSort); render(); });
  document.querySelectorAll('[data-prof]').forEach(x => x.onclick = async () => { const p = await api.company(worldId, +x.dataset.prof); if (p.ok) { const t = await api.trophies(worldId, +x.dataset.prof).catch(() => null); p.trophies = t?.trophies || []; profile = p; render(); } });
  document.querySelectorAll('[data-rv]').forEach(x => x.onclick = () => { rankView = x.dataset.rv; render(); refresh(); });
  document.querySelectorAll('[data-back]').forEach(x => x.onclick = () => { profile = null; render(); });
  document.querySelectorAll('[data-rel]').forEach(x => x.onclick = () => { const [id, act] = x.dataset.rel.split(':'); doAct(x, () => api.relation(worldId, +id, act), act === 'ally' ? '🤝 Готово.' : act === 'rival' ? '⚔️ Обявен за съперник.' : 'Готово.'); });
  document.querySelectorAll('[data-pct]').forEach(x => x.onclick = () => { const [id, k] = x.dataset.pct.split(':'), t = tenders.open.find(q => q.id === +id); bidDraft[id] = Math.round(t.budget * +k / 10000) * 100; render(); });
  document.querySelectorAll('[data-bidin]').forEach(x => x.oninput = () => { bidDraft[x.dataset.bidin] = Math.round(+x.value.replace(/\D/g, '')); const t = tenders.open.find(q => q.id === +x.dataset.bidin), el = document.querySelector(`[data-profit="${t.id}"]`); if (el) el.innerHTML = profitHtml(t, bidDraft[t.id] * 100); });
  document.querySelectorAll('[data-bid]').forEach(x => x.onclick = () => { const id = +x.dataset.bid, eurV = bidDraft[id]; if (!eurV) return toast('Въведи цена.', 'bad'); doAct(x, async () => { await api.bid(worldId, id, eurV * 100); delete bidDraft[id]; }, '📨 Офертата е подадена — скрита е от другите фирми.'); });
  document.querySelectorAll('[data-wd]').forEach(x => x.onclick = () => doAct(x, () => api.withdraw(worldId, +x.dataset.wd), 'Офертата е оттеглена, депозитът е върнат.'));
  document.querySelectorAll('[data-kstart]').forEach(x => x.onclick = () => doAct(x, async () => { const r = await api.startContract(worldId, +x.dataset.kstart); pendingFocus = r.build; }, '🏗️ Изпълнението започна — авансът е получен.'));
}
let pendingFocus = 0;
async function syncView() {
  const s = state; if (!s) return;
  if (!view && !syncView.loading) {
    syncView.loading = true;
    try {
      const { createCity3D } = await import('./online3d.js');
      view = await createCity3D($('view'), { onProgress: k => { $('ldBar').style.width = Math.round(k * 100) + '%'; } });
      $('ld').remove(); $('ph').remove();
      view.setCity(state.company.city, brandOf(state.company.brand));
    } catch (e) { console.error(e); $('ld').textContent = '3D градът не можа да се зареди.'; return; }
  }
  if (!view) return;
  view.setServerTime(s.world.server_now); view.syncBuilds(s.builds);
  if (pendingFocus) { const b = s.builds.find(x => x.id === pendingFocus); if (b) view.focusLot(b.lot); pendingFocus = 0; }
}
// лентите на напредъка между две четения от сървъра (само показване)
setInterval(() => { if (!state) return; for (const el of document.querySelectorAll('[data-prog]')) { const b = state.builds.find(x => x.id === +el.dataset.prog); if (b) el.style.width = Math.round(Math.max(0, Math.min(1, (Date.now() + srvOff - Date.parse(b.start_at)) / (Date.parse(b.end_at) - Date.parse(b.start_at)))) * 100) + '%'; } }, 1000);

// ═══ връзката ═══
onConn(c => {
  const el = $('conn'); el.className = c === 'ok' ? '' : c;
  el.textContent = c === 'ok' ? '● Online' : c === 'retry' ? '◌ Online…' : '✕ Offline';
  el.title = c === 'ok' ? 'Онлайн режим: времето е общо за всички и не се ускорява' : c === 'retry' ? 'Връзката прекъсна — свързвам се отново (нищо не се губи)' : 'Няма връзка със сървъра — действията ще минат, щом се върне';
  if (c === 'ok' && state) refresh();   // връзката се върна — взимаме състоянието наново от сървъра
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state) refresh(); });

sb.auth.onAuthStateChange((ev, session) => {
  const was = user; user = session?.user || null;
  if (!user) { clearInterval(pollT); state = null; loginScreen(); return; }
  if (!was || was.id !== user.id) worldId ? enterWorld(worldId) : worldsScreen();
});
