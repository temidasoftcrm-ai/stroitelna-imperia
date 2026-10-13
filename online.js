// online.js — „Онлайн империя“: вход → избор на свят → фирма → играта. Всичко, което се вижда, идва от сървъра (ol_state);
// бутоните само изпращат намерения (online-api.js). Самостоятелната игра и нейните записи не се пипат.
import { sb, api, onConn, OnlineError } from './online-api.js';

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
async function worldsScreen() {
  sheet(`<h1>🌐 Светове</h1><div class="meta">Зареждам…</div>`);
  let ws;
  try { ws = await api.worlds(); } catch (e) { sheet(`<h2>Няма връзка със сървъра</h2><div class="meta">${esc(errMsg(e))}</div><button class="btn" id="re">🔄 Опитай пак</button>`); $('re').onclick = worldsScreen; return; }
  sheet(`<h1>🌐 Светове</h1>
    <div class="meta">Влязъл си като <b style="color:var(--txt)">${esc(user.email)}</b> · <a href="#" id="out" style="color:var(--mut)">изход</a></div>
    ${ws.length ? ws.map(w => `<div class="card"><div class="row"><div><h3>${w.private ? '🔒' : '🌍'} ${esc(w.name)}</h3>
      <div class="meta">ден ${w.day} · ${w.players} фирми · 1 ден = ${Math.round(w.day_seconds / 60)} мин${w.company ? ` · твоята фирма: <b style="color:var(--txt)">${esc(w.company.name)}</b>` : ''}</div></div>
      <button class="btn" data-w="${w.id}">${w.company ? '▶️ Влез' : '🏗️ Основи фирма'}</button></div></div>`).join('')
      : `<div class="card meta">Още нямаш достъп до свят. Пилотът е частен — въведи кода от поканата.</div>`}
    <div class="card"><h3>🎟️ Покана</h3><div class="row" style="margin-top:8px"><input id="inv" placeholder="КОД" style="text-transform:uppercase;letter-spacing:3px"><button class="btn2" id="join">Влез</button></div><div class="err" id="er"></div></div>`);
  $('out').onclick = e => { e.preventDefault(); sb.auth.signOut(); };
  document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { const w = ws.find(x => x.id === +b.dataset.w); w.company ? enterWorld(w.id) : companyScreen(w); });
  $('join').onclick = async () => {
    $('join').disabled = true;
    try { const r = await api.join($('inv').value); toast(r.already ? 'Вече си член на този свят.' : '🎟️ Поканата е приета!'); worldsScreen(); }
    catch (e) { $('er').textContent = errMsg(e); $('join').disabled = false; }
  };
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
  if (!busy && !document.activeElement?.dataset?.bidin) render(); syncView();
}
const TABS = [['build', '🏗️ Строежи'], ['tend', '🏛️ Търгове'], ['units', '🚜 Техника'], ['co', '🏢 Фирма'], ['notes', '🔔']];
const TIER = { local: '🏘️ Местни', national: '🇧🇬 Национални', global: '🌍 Световни' };
let tenders = null, bidDraft = {};
const dayLen = () => state.world.day_seconds * 1000;
const left = iso => { const ms = Date.parse(iso) - (Date.now() + srvOff); if (ms <= 0) return 'предава се…'; const d = ms / dayLen(); return d >= 1 ? `още ${d.toFixed(1).replace('.', ',')} дни` : `още ${Math.ceil(ms / 60000)} мин`; };
let srvOff = 0, busy = false, view = null;
const until = iso => { const ms = Date.parse(iso) - (Date.now() + srvOff); if (ms <= 0) return 'изтече'; const d = ms / dayLen(); return d >= 1 ? `${d.toFixed(1).replace('.', ',')} дни` : `${Math.ceil(ms / 60000)} мин`; };
const profitHtml = (t, cents) => { if (!cents) return ''; const adv = cents * tenders.rules.advance_pct, pr = cents - t.mat; const gap = t.mat - adv, have = state.company.cash; return `Печалба ~<b class="${pr >= 0 ? 'ok' : 'bad'}">${eur(pr)}</b> · при старта: аванс ${eur(adv)}, материали ${eur(t.mat)}${gap > 0 ? ` — ще ти трябват <b class="${have >= gap ? 'ok' : 'bad'}">${eur(gap)}</b> налични${have < gap ? ' (сега нямаш толкова!)' : ''}` : ''}`; };
function tendHtml(s, U, needHtml) {
  if (!tenders) return '<div class="meta">Зареждам търговете…</div>';
  const R = tenders.rules, c = s.company;
  let h = `<div class="card"><div class="meta">📜 <b style="color:var(--txt)">Правила:</b> офертите са скрити. Печели най-ниската валидна цена; при равни цени — по-рано подадената (промяната на офертата мести времето ѝ). Цената е между ${Math.round(R.min_price_pct * 100)}% и 100% от бюджета. При подаване се блокира депозит; до срока офертата може да се промени или оттегли (оттеглена не се подава пак). Загубилите си получават депозита веднага. Победителят трябва да започне изпълнението в срок — иначе губи депозита. При старта получава аванс ${Math.round(R.advance_pct * 100)}% и плаща материалите; при предаване — остатъка, XP и депозита. Най-много ${R.max_contracts} активни договора.<br>Нива: местни ${R.tiers.local[0]}–${R.tiers.local[1]} · национални ${R.tiers.national[0]}–${R.tiers.national[1]} · световни от ${R.tiers.global[0]}. Блокирани сега: <b style="color:var(--txt)">${eur(c.held || 0)}</b></div></div>`;
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
        <div class="meta">Бюджет <b class="ok">${eur(t.budget)}</b> · депозит ${eur(t.deposit)} · материали ${eur(t.mat)} · ${t.days} дни изпълнение · старт до ${t.start_days} дни след победата<br>⏱️ оферти до: <b style="color:var(--txt)">${until(t.closes_at)}</b> · ${t.bids} оферт${t.bids === 1 ? 'а' : 'и'}${my ? ` · твоята: <b style="color:var(--acc)">${eur(my.price)}</b>` : t.my && t.my.status === 'withdrawn' ? ' · оттеглена' : ''}</div>
        <div class="need">${needHtml(t.need)}</div>
        ${t.why_not ? `<div class="meta" style="margin-top:6px;color:#ffb3b3">🚫 ${esc(t.why_not)}</div>` : `
        <div class="row" style="margin-top:8px;gap:4px;justify-content:flex-start;flex-wrap:wrap">${[1, 0.95, 0.9, 0.85, 0.8, 0.7].map(k => `<button class="btn2" style="padding:3px 7px;font-size:12px" data-pct="${t.id}:${k}">${k === 1 ? '100%' : '−' + Math.round((1 - k) * 100) + '%'}</button>`).join('')}</div>
        <div class="row" style="margin-top:6px"><input data-bidin="${t.id}" inputmode="numeric" placeholder="цена в €" value="${draft}" style="padding:7px;font-size:15px"><button class="btn" data-bid="${t.id}">${my ? '✏️ Промени' : '📨 Подай'}</button>${my ? `<button class="btn2" data-wd="${t.id}">Оттегли</button>` : ''}</div>
        <div class="meta" data-profit="${t.id}" style="margin-top:4px">${profitHtml(t, (bidDraft[t.id] ?? (my ? my.price / 100 : 0)) * 100)}</div>`}</div>`; }).join('');
  }
  if (tenders.closed.length) h += `<h3 style="margin:4px 0 0;font-size:14px">📰 Резултати</h3><div class="card">${tenders.closed.map(t => `<div class="led"><span>${esc(t.title)}${t.mine ? ` · ${t.mine === 'won' ? '🏆 ти' : t.mine === 'lost' ? 'загубен' : 'оттеглен'}` : ''}</span><b style="white-space:nowrap">${t.winner ? `${esc(t.winner)} · ${eur(t.price)}` : 'без оферти'}</b></div>`).join('')}</div>`;
  return h;
}
function render() {
  const s = state, c = s.company, b = brandOf(c.brand), U = Object.fromEntries(s.catalog.units.map(u => [u.type, u]));
  $('coName').innerHTML = `<span style="color:${b.col}">${b.ico} ${esc(c.name)}</span>`;
  $('cash').textContent = eur(c.cash); $('cash').className = c.cash < 0 ? 'bad' : '';
  $('day').textContent = `ден ${s.world.day} · ниво ${c.level}`;
  const unseen = s.notes.filter(n => !n.seen).length, run = s.builds.filter(x => x.status === 'running');
  $('tabs').innerHTML = TABS.map(([k, nm]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${nm}${k === 'notes' && unseen ? `<span class="badge">${unseen}</span>` : ''}${k === 'build' && run.length ? `<span class="badge">${run.length}</span>` : ''}</button>`).join('');
  $('tabs').querySelectorAll('[data-t]').forEach(x => x.onclick = () => { tab = x.dataset.t; render(); if (tab === 'tend') refresh(); if (tab === 'notes' && unseen) api.notesSeen(worldId, lastNote).then(() => refresh()); });
  const needHtml = need => Object.entries(need).map(([k, n]) => `<span class="${(s.free[k] || 0) < n ? 'miss' : ''}">${U[k].ico} ${U[k].nm} ×${n}</span>`).join('');
  let h = '';
  if (tab === 'build') {
    h = `<div class="meta">Поръчките идват от сървъра и важат ${s.world.cfg.offer_days} дни. Материалите се плащат при старта; парите и XP идват, щом строежът завърши — дори играта да е затворена.</div>`;
    h += run.map(x => { const p = Math.max(0, Math.min(1, (Date.now() + srvOff - Date.parse(x.start_at)) / (Date.parse(x.end_at) - Date.parse(x.start_at))));
      return `<div class="card" data-focus="${x.lot}" style="cursor:pointer"><h3>${esc(x.title)}</h3><div class="meta">🎁 ${eur(x.reward)} · +${x.xp} XP · ${left(x.end_at)}</div><div class="bar" style="margin-top:6px"><i data-prog="${x.id}" style="width:${Math.round(p * 100)}%"></i></div></div>`; }).join('');
    h += `<h3 style="margin:4px 0 0;font-size:14px">📋 Нови поръчки</h3>`;
    h += s.offers.map(o => { const k = s.catalog.kinds.find(q => q.kind === o.kind), ok = Object.entries(k.need).every(([t, n]) => (s.free[t] || 0) >= n), money = c.cash >= o.mat;
      return `<div class="card offer"><h3>${k.ico} ${k.nm} — ${esc(o.client)}</h3>
        <div class="meta">Бюджет <b class="ok">${eur(o.reward)}</b> · материали ${eur(o.mat)} · ${o.days} дни · +${Math.floor(o.reward / 10000)} XP · важи до ден ${o.expires_day}</div>
        <div class="need">${needHtml(k.need)}</div>
        <div class="row" style="margin-top:8px"><span class="meta">${!ok ? 'Няма свободна техника.' : !money ? 'Нямаш пари за материалите.' : ''}</span><button class="btn" data-start="${o.id}" ${ok && money ? '' : 'disabled'}>🏗️ Започни</button></div></div>`; }).join('') || '<div class="meta">Няма поръчки — нови идват всеки ден.</div>';
  } else if (tab === 'tend') {
    h = tendHtml(s, U, needHtml);
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
  el.textContent = c === 'ok' ? '● на линия' : c === 'retry' ? '◌ свързвам се…' : '✕ няма връзка';
  if (c === 'ok' && state) refresh();   // връзката се върна — взимаме състоянието наново от сървъра
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state) refresh(); });

sb.auth.onAuthStateChange((ev, session) => {
  const was = user; user = session?.user || null;
  if (!user) { clearInterval(pollT); state = null; loginScreen(); return; }
  if (!was || was.id !== user.id) worldId ? enterWorld(worldId) : worldsScreen();
});
