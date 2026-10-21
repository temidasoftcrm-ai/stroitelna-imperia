// coopcenter.js — 🤝 „Център на партньорството“ (feature 'coop-center'): новият прозорец на партньорството.
// Само подреждането на съществуващите функции от coop.js (без промени в икономиката): широк прозорец с меню отляво
// (на телефон — лента с раздели на един ред), горна лента с партньора, отделно превъртано съдържание.
// Раздели: Обзор · Общи проекти · Техника и доставки · Финанси · Общи цели · Чат · Активност; ⚙️ — настройките на партньорството.
// Действията към сървъра остават в coop.js (act/bind): тук са същите data-c и същите полета (#cpAmt, #cpSeg, #cpRT…).
// Локалната навигация е с data-cc (без сървър). C — контекстът от coop.js (centerCtx): { st, st2, st3, d, E, f, esc, ago, left, PCOL, JCOL,
//   partnerName, myName, unread, markRead, UNIT_TYPES, MATERIALS, logTxt, QUICK, fetchedAt, act(c, a, x, el), render() }.

const V = { sec: 'hold', proj: 'prop', fin: 'tr', hist: false, cities: false, gear: false, wiz: null, inflight: new Set() };
const SECS = [['hold', '🏦', 'Общ холдинг'], ['home', '🏠', 'Обзор'], ['proj', '🛣️', 'Общи проекти'], ['eq', '🚜', 'Техника и доставки'], ['fin', '💶', 'Финанси'], ['goals', '🏆', 'Общи цели'], ['chat', '💬', 'Чат'], ['feed', '📜', 'Активност']];
const STATUS = { wait: ['⏳ чака отговор', '#ffb347'], ok: ['✅ прието', '#5fd38a'], no: ['✖ отказано', '#ff6b6b'], exp: ['⌛ изтекло', '#9aa0aa'], done: ['🏁 изпълнено', '#4fc3f7'], cancel: ['↩️ оттеглено', '#9aa0aa'], mine: ['📨 за твое решение', '#ffd54a'] };
const chip = k => { const [t, c] = STATUS[k] || STATUS.wait; return `<span class="chip" style="color:${c};border-color:${c}55">${t}</span>`; };
// статусите от сървъра → едно от горните
const loanSt = l => l.status === 'offered' ? (l.out ? 'wait' : 'mine') : l.status === 'open' ? 'ok' : l.status === 'repaid' || l.status === 'forgiven' ? 'done' : l.status === 'declined' ? 'no' : l.status === 'cancelled' ? 'cancel' : l.status === 'expired' ? 'exp' : 'wait';
const rentSt = r => r.status === 'offered' ? (r.out ? 'wait' : 'mine') : r.status === 'active' ? 'ok' : r.status === 'declined' ? 'no' : r.status === 'cancelled' ? 'cancel' : 'done';
const jointSt = j => j.status === 'proposed' ? (j.mine ? 'wait' : 'mine') : j.status === 'active' ? (j.done ? 'done' : 'ok') : j.status === 'declined' ? 'no' : 'cancel';
const STAT_OF = { builds: 'done', hw: 'hw', money: 'earned', cities: 'cities' };

const CSS = `
#coopBox .in.cc { width:min(1120px,100%); height:calc(100vh - 80px); max-height:none; padding:0; overflow:hidden; display:grid; grid-template-columns:200px 1fr; grid-template-rows:auto 1fr; }
#coopBox .cc .top { grid-column:1/3; display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid var(--line); flex-wrap:nowrap; min-width:0; }
#coopBox .cc .top .who { min-width:0; flex:1; } #coopBox .cc .top .who b { font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
#coopBox .cc .top .who small { color:var(--mut); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block; }
#coopBox .cc .top .tb { background:#ffffff0d; border:1px solid var(--line); color:var(--txt); border-radius:9px; padding:6px 10px; cursor:pointer; font:inherit; font-size:13px; white-space:nowrap; }
#coopBox .cc nav { border-right:1px solid var(--line); padding:8px; overflow:auto; }
#coopBox .cc nav button { display:flex; width:100%; align-items:center; gap:8px; background:none; border:0; color:var(--txt); text-align:left; padding:9px 10px; border-radius:9px; cursor:pointer; font:inherit; font-size:14px; }
#coopBox .cc nav button.on { background:#ffffff14; font-weight:800; } #coopBox .cc nav button .n { margin-left:auto; background:var(--acc); color:#1a1200; border-radius:9px; padding:0 6px; font-size:12px; font-weight:800; }
#coopBox .cc main { overflow:auto; padding:12px 16px 18px; min-width:0; }
#coopBox .cc h3 { margin:14px 0 6px; } #coopBox .cc h3:first-child { margin-top:2px; }
#coopBox .cc .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin:4px 0 10px; }
#coopBox .cc .stat { border:1px solid var(--line); border-radius:11px; padding:9px 11px; background:#ffffff08; } #coopBox .cc .stat b { display:block; font-size:19px; } #coopBox .cc .stat span { color:var(--mut); font-size:12px; }
#coopBox .cc .ac { display:flex; align-items:center; gap:10px; border:1px solid var(--line); border-left:4px solid var(--acc); border-radius:10px; padding:9px 11px; margin:6px 0; background:#ffffff08; }
#coopBox .cc .ac { flex-wrap:wrap; } #coopBox .cc .ac > div { flex:1 1 200px; min-width:0; } #coopBox .cc .sub { display:flex; gap:4px; border-bottom:1px solid var(--line); margin:0 0 8px; overflow-x:auto; }
#coopBox .cc .sub button { background:none; border:0; border-bottom:2px solid transparent; color:var(--mut); padding:7px 10px; cursor:pointer; font:inherit; font-size:14px; white-space:nowrap; } #coopBox .cc .sub button.on { color:var(--txt); border-color:var(--acc); font-weight:800; }
#coopBox .cc .chip { display:inline-block; border:1px solid; border-radius:9px; padding:0 7px; font-size:12px; font-weight:700; white-space:nowrap; }
#coopBox .cc .three { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; } #coopBox .cc .three .stat b { font-size:17px; }
#coopBox .cc .pop { position:absolute; right:14px; top:58px; z-index:3; background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:10px 12px; width:min(340px,calc(100% - 28px)); box-shadow:0 12px 40px #000a; max-height:60vh; overflow:auto; }
#coopBox .cc .steps { display:flex; gap:6px; margin:4px 0 10px; } #coopBox .cc .steps i { flex:1; height:4px; border-radius:3px; background:#ffffff1a; } #coopBox .cc .steps i.on { background:var(--acc); }
#coopBox .cc .opt { display:block; width:100%; text-align:left; border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin:6px 0; background:#ffffff08; color:var(--txt); cursor:pointer; font:inherit; } #coopBox .cc .opt.on { border-color:var(--acc); background:#ffb30014; }
#coopBox .cc button:disabled { opacity:.5; cursor:default; }
@media (max-width:720px) {
  #coopBox:has(.in.cc) { padding:0 !important; } #coopBox .in.cc { height:100vh; border-radius:0; grid-template-columns:1fr; grid-template-rows:auto auto 1fr; }
  #coopBox .cc .top { grid-column:1; } #coopBox .cc nav { display:flex; border-right:0; border-bottom:1px solid var(--line); padding:4px 6px; overflow-x:auto; overflow-y:hidden; }
  #coopBox .cc nav { scrollbar-width:none; } #coopBox .cc nav::-webkit-scrollbar { display:none; } #coopBox .cc nav button { width:auto; flex:0 0 auto; padding:7px 10px; white-space:nowrap; } #coopBox .cc nav button .t { display:inline; }
  #coopBox .cc .stats { grid-template-columns:repeat(2,minmax(0,1fr)); } #coopBox .cc .three { gap:5px; } #coopBox .cc .three .stat { padding:7px 8px; } #coopBox .cc .three .stat b { font-size:13px; } #coopBox .cc .three .stat span { font-size:11px; } #coopBox .cc .top .tb.lbl { display:none; }
  #coopBox .cc main { padding:10px 12px 16px; }
}`;

export function centerRender(el, C) {
  if (!document.getElementById('ccCss')) { const s = document.createElement('style'); s.id = 'ccCss'; s.textContent = CSS; document.head.appendChild(s); }
  el.classList.add('cc'); el.style.position = 'relative';
  const { st, st2, d, f, esc, PCOL } = C, P = st.partner || {}, s = P.snap || {}, pn = esc(C.partnerName());
  // за твое решение / готови награди — броим веднъж, ползват се в менюто и в обзора
  const todo = decisions(C), ready = rewards(C), nU = C.unread(), nTodo = todo.filter(t => !t.soft).length;   // напомнянията (изтичащ наем/заем) не са решения
  if (V.sec === 'chat') C.markRead();
  // горната лента
  const seen = P.online ? '<span style="color:var(--ok)">🟢 онлайн сега</span>' : P.at ? `Последно активен ${C.ago(P.at)}` : 'още не е влизал';
  let h = `<div class="top"><div style="font-size:26px">${esc(s.ico || '🤝')}</div><div class="who"><b style="color:${PCOL}">${esc(s.name || 'Партньор')}${C.partnerLv != null ? ` <span class="mut" style="font-size:13px">· ниво ${C.partnerLv}</span>` : ''}</b>
      <small>${seen} · данни ${C.fetchedAt ? C.ago(new Date(C.fetchedAt).toISOString()) : '—'}</small></div>
    <button class="tb" data-cc="cities">🏙️ <span class="lbl">Градове · </span>${(s.cities || []).length}</button><button class="tb" data-cc="gear" title="Настройки на партньорството">⚙️</button><button class="tb" data-c="close" title="Затвори">✕</button></div>`;
  if (V.cities) h += `<div class="pop"><b>🏙️ Градовете на ${pn} (${(s.cities || []).length})</b><div class="mut" style="margin:4px 0">На картата ти — в <span style="color:${PCOL}">този цвят</span>; ★ — централата.</div>${(s.cities || []).map(id => `<div class="led"><span>${esc(d.cityName(id))}${id === s.hq ? ' ★' : ''}</span>${d.ownedCities().includes(id) ? '<span class="mut">строите заедно</span>' : ''}</div>`).join('') || '<div class="mut">Още няма.</div>'}</div>`;
  if (V.gear) h += `<div class="pop"><b>⚙️ Партньорството</b>
      <div class="mut" style="margin:8px 0 2px">Името ти за партньора</div><div class="row"><input id="cpName" value="${esc(C.myName())}" maxlength="24" style="flex:1"><button class="btn2" data-c="name">Запази</button></div>
      <div class="mut" style="margin:8px 0 2px">Името на общия холдинг</div><div class="row"><input id="cpVN" maxlength="40" value="${esc(st2?.vault?.name || '')}" placeholder="Име на холдинга" style="flex:1"><button class="btn2" data-c="vname">Запази</button></div>
      <div class="row" style="margin-top:14px;border-top:1px solid var(--line);padding-top:10px"><button class="btn2" data-c="leave" style="border-color:var(--bad);color:#ffb3b3">Прекрати партньорството</button></div></div>`;
  // менюто
  const badge = k => k === 'home' && nTodo ? nTodo : k === 'chat' && nU ? nU : k === 'goals' && ready.goals ? ready.goals : 0;
  h += `<nav>${SECS.map(([k, ico, nm]) => `<button class="${V.sec === k ? 'on' : ''}" data-cc="sec:${k}">${ico} <span class="t">${nm}</span>${badge(k) ? `<span class="n">${badge(k)}</span>` : ''}</button>`).join('')}</nav><main>`;
  h += ({ hold: holdSec, home, proj, eq, fin, goals, chat, feed }[V.sec] || holdSec)(C, todo, ready);
  el.innerHTML = h + '</main>';
  for (const k of V.inflight) { const b = el.querySelector(`[data-c="${k}"]`); if (b) { b.disabled = true; b.textContent = '⏳ ' + b.textContent; } else V.inflight.delete(k); }
  el.querySelectorAll('[data-cc]').forEach(b => b.onclick = () => local(b.dataset.cc, C, el));
  // наградите и „Вземи всички“ — веднъж (бутонът остава изключен, докато сървърът не потвърди)
  el.querySelectorAll('[data-c^="qclaim:"],[data-c^="claim:"]').forEach(b => b.addEventListener('click', () => V.inflight.add(b.dataset.c), true));
  // съветникът: след „Изпрати“ се затваря и показва предложението (полетата се четат преди прерисуването)
  el.querySelectorAll('.wizgo').forEach(b => b.addEventListener('click', () => { V.proj = V.wiz?.type === 'mega' ? 'act' : 'prop'; V.wiz = null; }, true));
  const ch = el.querySelector('#cpChat'); if (ch) ch.scrollTop = 1e6;
}

// ── локалните действия (навигация, съветник) ──
async function local(cc, C, el) {
  const [c, a, x] = cc.split(':');
  grab(el);
  if (c === 'sec') { V.sec = a; V.cities = V.gear = false; }
  else if (c === 'eqT') { V.eqT = a; V.eqQ = 1; }
  else if (c === 'eqQ') V.eqQ = +a;
  else if (c === 'eqM') V.eqM = a;
  else if (c === 'sosK') V.sosK = a;
  else if (c === 'sosPrev') { }
  else if (c === 'helpMoney') { V.sec = 'fin'; V.fin = 'tr'; V.giftA = +a; V.helpMsg = +x; }
  else if (c === 'helpUnit') { const [t, n, city] = a.split('|'); V.sec = 'eq'; V.eqT = t; V.eqQ = +n || 1; V.eqM = 'gift'; if (city) V.eqC = city; V.helpMsg = +x; }
  else if (c === 'cities') { V.cities = !V.cities; V.gear = false; }
  else if (c === 'gear') { V.gear = !V.gear; V.cities = false; }
  else if (c === 'proj') V.proj = a;
  else if (c === 'fin') { if (a === 'hold') V.sec = 'hold'; else V.fin = a; }   // старите връзки към „Финанси → Общ холдинг“
  else if (c === 'hist') V.hist = !V.hist;
  else if (c === 'go') { V.sec = a; if (x) { if (a === 'proj') V.proj = x; if (a === 'fin') { if (x === 'hold') V.sec = 'hold'; else V.fin = x; } } }
  else if (c === 'wiz') {
    if (a === 'new') V.wiz = { step: 0, type: null, ref: null };
    else if (a === 'close') V.wiz = null;
    else if (a === 'type') { V.wiz.type = x; V.wiz.ref = null; }
    else if (a === 'next') { const r = el.querySelector('#ccRef'); if (r) V.wiz.ref = r.value; if (V.wiz.step === 0 && !V.wiz.type) return; if (V.wiz.step === 1 && !V.wiz.ref) return; V.wiz.step = Math.min(3, V.wiz.step + 1); }
    else if (a === 'back') V.wiz.step = Math.max(0, V.wiz.step - 1);
  }
  else if (c === 'claimall') {   // всички готови награди една след друга (всеки взема само своя дял — сървърът го пази)
    const R = rewards(C).list; if (!R.length) return;
    for (const r of R) { if (V.inflight.has(r.c)) continue; V.inflight.add(r.c); const [k, id] = r.c.split(':'); try { await C.act(k, id, '', el); } catch (e) { C.d.toast('📶 ' + (e?.message || 'Грешка при връзката.'), 'bad'); } }
    await C.tick(); return;
  }
  C.render();
}

// полетата на формите се помнят между прерисуванията (количество, срок, цена, молбата)
function grab(el) {
  const v = id => el.querySelector('#' + id)?.value, n = id => +String(v(id) || '').replace(/[^\d]/g, '');
  if (v('ccQty') != null) V.eqQ = n('ccQty') || 1; if (v('cpRH') != null) V.eqH = +v('cpRH'); if (v('cpRP') != null && el.querySelector('#cpRP').type !== 'hidden') V.eqP = n('cpRP'); if (v('ccDest') != null) V.eqC = v('ccDest');
  if (v('ccSosAmt') != null) V.sosA = n('ccSosAmt'); if (v('ccSosWhy') != null) V.sosW = v('ccSosWhy'); if (v('ccSosN') != null) V.sosN = n('ccSosN') || 1; if (v('ccSosT') != null) V.sosT = v('ccSosT'); if (v('ccSosC') != null) V.sosC = v('ccSosC');
  if (v('cpAmt') != null && V.sec === 'fin') V.giftA = n('cpAmt') || V.giftA;
}
// ── какво чака моето решение (картите в обзора) ──
function decisions(C) {
  const { st, st2, st3, f, esc } = C, pn = esc(C.partnerName()), out = [];
  for (const j of st2?.joints || []) if (j.status === 'proposed' && !j.mine) out.push({ ico: j.kind === 'hw' ? '🛣️' : '🚆', t: `${pn} предлага ${j.kind === 'hw' ? 'обща магистрала' : 'общ влак'}: <b>${esc(j.title)}</b>`, go: 'proj:prop', btn: 'Разгледай' });
  for (const l of st.loans || []) if (l.status === 'offered' && !l.out) out.push({ ico: '💸', t: `${pn} ти предлага заем <b>${f(l.amount)} €</b> · ${l.rate_pct}%`, go: 'fin:loan', btn: 'Виж заема' });
  for (const r of st2?.rentals || []) if (r.status === 'offered' && !r.out) out.push({ ico: C.UNIT_TYPES[r.type]?.ico || '🚜', t: `${pn} предлага ${C.UNIT_TYPES[r.type]?.nm.toLowerCase() || 'техника'} ${r.price ? `под наем за ${f(r.price)} €` : 'като помощ'} · ${r.hours} ч`, go: 'eq', btn: 'Виж договора' });
  for (const r of st2?.rentals || []) if (r.status === 'active' && r.until && Date.parse(r.until) - Date.now() < 3600e3) out.push({ ico: '⏰', t: `Изтича наемът на ${C.UNIT_TYPES[r.type]?.nm.toLowerCase() || 'техника'} — след ${C.left(r.until)}`, go: 'eq', btn: 'Виж договора', soft: true });
  for (const l of st.loans || []) if (l.status === 'open' && !l.out && l.due_at && Date.parse(l.due_at) - Date.now() < 6 * 3600e3) out.push({ ico: '⏰', t: `Заемът към ${pn} е до ${C.left(l.due_at)} — остават ${f(l.owed - l.repaid)} €`, go: 'fin:loan', btn: 'Върни', soft: true });
  const I = st3?.ipo; if (I && I.status === 'proposed' && !I.mine) out.push({ ico: '📈', t: `${pn} предлага холдингът да пусне ${I.pct}% акции`, go: 'fin:hold', btn: 'Разгледай' });
  for (const m of (st2?.messages || []).slice(-5)) if (m.sos && !m.me && Date.now() - Date.parse(m.at) < 86400e3 && !(C.v2 && helped(C, m))) { const q = C.v2 && sosParse(C, m.text);
    out.push({ ico: '🆘', t: `${pn}: „${esc(m.text)}“`, go: q && q.type ? `eq` : 'fin:tr', btn: 'Помогни', sos: true, cc: q ? (q.money ? `helpMoney:${q.money}:${m.id}` : `helpUnit:${q.type}|${q.n}|${q.city || ''}:${m.id}`) : null }); }
  const R4 = C.st4; if (R4?.rules?.pending && !R4.rules.pending.mine) out.push({ ico: '📜', t: `${pn} предлага правила за общата каса`, go: 'fin:hold', btn: 'Разгледай' });
  for (const r of R4?.requests || []) if (r.status === 'requested' && !r.mine) out.push({ ico: '🏦', t: `${pn} моли за теглене <b>${f(r.amount)} €</b> от общата каса${r.reason ? ` — ${esc(r.reason)}` : ''}`, go: 'fin:hold', btn: 'Реши' });
  return out;
}
// ── готовите награди: общи задачи + изпълнени общи поръчки ──
function rewards(C) {
  const list = [];
  for (const q of C.st2?.quests || []) if (q.status === 'done' && !q.claimed) list.push({ c: `qclaim:${q.id}`, amt: q.reward, nm: q.nm });
  for (const m of C.st.megas || []) if (m.status === 'done') list.push({ c: `claim:${m.id}`, amt: 0, nm: 'Обща поръчка' });
  return { list, goals: list.filter(r => r.c.startsWith('qclaim')).length, n: list.length };
}

// ── 🏠 Обзор ──
function home(C, todo, ready) {
  const { st, st2, f, esc, PCOL, d } = C, s = st.partner?.snap || {}, V0 = st2?.vault || { balance: 0 };
  const act = (st2?.joints || []).filter(j => j.status === 'active' && !j.done).length + (st.megas || []).filter(m => m.status === 'forming' || m.status === 'building').length + (st2?.rentals || []).filter(r => r.status === 'active').length;
  let h = `<div class="stats"><div class="stat"><b>${f(V0.balance)} €</b><span>🏦 Общи средства</span></div><div class="stat"><b>${act}</b><span>🛣️ Активни проекти</span></div>
    <div class="stat"><b style="color:${todo.some(t => !t.soft) ? 'var(--acc)' : ''}">${todo.filter(t => !t.soft).length}</b><span>📨 За твое решение</span></div><div class="stat"><b style="color:${ready.n ? 'var(--ok)' : ''}">${ready.n}</b><span>🏆 Готови награди</span></div></div>`;
  h += todo.map(t => `<div class="ac" style="${t.sos ? 'border-left-color:var(--bad)' : t.soft ? 'border-left-color:#ffb347' : ''}"><span style="font-size:20px">${t.ico}</span><div>${t.t}</div><button class="${t.soft ? 'btn2' : 'btn'}" data-cc="${t.cc || 'go:' + t.go}">${t.btn} →</button></div>`).join('');
  if (ready.n) h += `<div class="ac" style="border-left-color:var(--ok)"><span style="font-size:20px">🏆</span><div>${ready.n} ${ready.n === 1 ? 'готова награда' : 'готови награди'}${ready.list.some(r => r.amt) ? ` · ${f(ready.list.reduce((a, r) => a + r.amt, 0))} € от задачите` : ''}</div><button class="btn" data-cc="claimall">Вземи всички</button></div>`;
  if (!todo.length && !ready.n) h += '<div class="mut" style="margin:10px 0">✅ Всичко е наред — няма чакащи решения.</div>';
  const both = (s.cities || []).filter(id => d.ownedCities().includes(id));
  h += `<h3>👤 ${esc(s.name || 'Партньорът')}</h3><div class="card"><div class="mut">Ден ${s.day ?? '—'} · ${'★'.repeat(Math.round(s.rep || 0))}${'☆'.repeat(5 - Math.round(s.rep || 0))} · офис ниво ${s.office ?? '—'} · стойност ${f(s.worth || 0)} €${s.loan ? ` · кредит ${f(s.loan)} €` : ''}</div>
    ${both.length ? `<div class="mut" style="margin-top:4px">🏙️ Строите заедно в: <b>${both.map(id => esc(d.cityName(id))).join(', ')}</b> — в 3D града неговите обекти са с пръстен в <span style="color:${PCOL}">неговия цвят</span>.</div>` : ''}</div>`;
  return h;
}

// ── 🛣️ Общи проекти: Предложения → Активни → Завършени; „Нов общ проект“ — съветник ──
function proj(C) {
  if (V.wiz) return wizard(C);
  const { st, st2, st3 } = C, J = st2?.joints || [], M = st.megas || [];
  const prop = J.filter(j => j.status === 'proposed'), act = [...J.filter(j => j.status === 'active' && !j.done), ...M.filter(m => m.status === 'forming' || m.status === 'building')];
  const done = [...J.filter(j => j.status === 'active' && j.done), ...M.filter(m => m.status === 'done'), ...(st3?.megas_done || []).filter(m => m.claimed)];
  let h = `<div class="row" style="justify-content:space-between;margin:0 0 4px"><h3 style="margin:0">Общи проекти</h3><button class="btn" data-cc="wiz:new">＋ Нов общ проект</button></div>
    <div class="sub">${[['prop', `Предложения${prop.length ? ` (${prop.length})` : ''}`], ['act', `Активни${act.length ? ` (${act.length})` : ''}`], ['done', `Завършени${done.length ? ` (${done.length})` : ''}`]].map(([k, t]) => `<button class="${V.proj === k ? 'on' : ''}" data-cc="proj:${k}">${t}</button>`).join('')}</div>`;
  const L = V.proj === 'prop' ? prop : V.proj === 'act' ? act : done;
  h += L.map(x => x.kind ? jointCard(C, x) : x.claimed !== undefined && x.nm ? doneMegaCard(C, x) : megaCard(C, x)).join('') || `<div class="mut" style="margin:10px 0">${V.proj === 'prop' ? 'Няма чакащи предложения. Започни с „＋ Нов общ проект“.' : V.proj === 'act' ? 'Няма активни проекти.' : 'Още няма завършени.'}</div>`;
  return h;
}
function jointCard(C, j) {
  const { esc } = C, pn = esc(C.partnerName()), ico = j.kind === 'hw' ? '🛣️' : '🚆';
  let b = '';
  if (j.status === 'proposed') b = j.mine ? `<button class="btn2" data-c="jact:${j.id}:end">Оттегли</button>` : `<button class="btn" data-c="jact:${j.id}:accept">✅ Приеми</button><button class="btn2" data-c="jact:${j.id}:decline">Откажи</button>`;
  else if (!j.done) b = `<button class="btn2" data-c="jact:${j.id}:end">Прекрати</button>`;
  const next = j.status === 'proposed' ? (j.mine ? `Чакаме ${pn} да приеме.` : 'Приеми или откажи.') : j.done ? 'Готово при двамата — бонусът е изплатен, доходът идва всеки ден.' : `Започни го от „${j.kind === 'hw' ? '🛣️ Магистрали' : '🚆 ЖП'}“ — докато и двамата строите, всеки върви 30% по-бързо.`;
  return `<div class="card"><div class="row" style="margin:0;justify-content:space-between"><b>${ico} ${esc(j.title)}</b>${chip(jointSt(j))}</div>
    <div class="mut">Маршрут · ${j.km} км · ${j.kind === 'hw' ? 'магистрала' : 'жп линия'}</div>
    <div class="led"><span>Ти: ${j.me_done ? '✅ построено' : '🏗️ строиш'}</span><span>${pn}: ${j.they_done ? '✅ построено' : '🏗️ строи'}</span></div>
    <div class="mut">Награда: еднократно ${j.kind === 'hw' ? '1 500' : '800'} €/км за всеки и ${j.kind === 'hw' ? '3' : '8'} €/км всеки ден, щом единият завърши.</div>
    <div class="mut" style="margin-top:4px">➡️ ${next}</div><div class="row">${b}</div></div>`;
}
function megaCard(C, m) {
  const { st, f, esc, PCOL } = C, t = (st.mega_types || []).find(x => x.key === m.key); if (!t) return '';
  const pm = Math.round(m.mine / t.cost * 100), pt = Math.round(m.theirs / t.cost * 100), fair = m.mine >= t.cost * 0.2 && m.theirs >= t.cost * 0.2;
  const k = m.status === 'forming' ? 'ok' : m.status === 'building' ? 'ok' : 'done';
  const act = m.status === 'forming' ? `<div class="row"><input data-mp="${m.id}" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="put:${m.id}">Вложи</button></div>`
    : m.status === 'building' ? `<div class="mut">🏗️ Строи се — готово след <b>${C.left(m.ends_at)}</b>. Награда за теб: ~${f(fair ? m.mine + Math.floor(m.total * (t.mult - 1) / 2) : m.mine)} €</div>`
    : `<div class="row"><button class="btn" data-c="claim:${m.id}">🏆 Вземи наградата</button></div>`;
  return `<div class="card"><div class="row" style="margin:0;justify-content:space-between"><b>${t.ico} ${esc(t.nm)} <span class="mut">· ×${t.mult}</span></b>${chip(k)}</div>
    <div class="bar" style="margin:6px 0"><i style="width:${pm}%;background:var(--acc)"></i><i style="width:${pt}%;background:${PCOL}"></i></div>
    <div class="led"><span>Ти: <b>${f(m.mine)} €</b> (${pm}%)</span><span>${esc(C.partnerName())}: <b>${f(m.theirs)} €</b> (${pt}%)</span><span class="mut">остават ${f(Math.max(0, t.cost - m.total))} от ${f(t.cost)} €</span></div>
    <div class="mut">Условие за печалбата: всеки да е вложил поне 20% (${fair ? '<span class="ok">изпълнено</span>' : 'още не'}); после всеки взема вложеното + половината от печалбата.</div>${act}</div>`;
}
const doneMegaCard = (C, m) => `<div class="card" style="border-color:var(--ok)"><div class="row" style="margin:0;justify-content:space-between"><b>${m.ico} ${C.esc(m.nm)}</b>${chip('done')}</div>
  <div class="mut">Обща сума ${C.f(m.total)} € · ти получи <b class="ok">${C.f(m.mine)} €</b> · ${C.esc(C.partnerName())} — <b>${C.f(m.theirs)} €</b></div></div>`;
// съветникът: вид → маршрут → условия → обобщение преди изпращане
function wizard(C) {
  const { st, st2, d, f, esc } = C, W = V.wiz, P = st.partner?.snap || {}, J = st2?.joints || [];
  const TYPES = [['hw', '🛣️ Обща магистрала', 'Строите един участък заедно — 30% по-бързо, бонус 1 500 €/км и доход 3 €/км на ден.'], ['rail', '🚆 Общ влак', 'Обща жп линия — бонус 800 €/км и доход 8 €/км на ден.'], ['mega', '🏗️ Обща голяма поръчка', 'Влагате и двамата; щом се събере сумата, строежът тече и всеки взема вложеното + половината от печалбата.']];
  let h = `<div class="row" style="justify-content:space-between;margin:0"><h3 style="margin:0">＋ Нов общ проект</h3><button class="btn2" data-cc="wiz:close">✕ Откажи</button></div>
    <div class="steps">${[0, 1, 2, 3].map(i => `<i class="${i <= W.step ? 'on' : ''}"></i>`).join('')}</div><div class="mut" style="margin-bottom:6px">${['1. Вид', '2. Маршрут', '3. Условия', '4. Обобщение'][W.step]}</div>`;
  const segs = d.segs().filter(s => !J.some(j => j.kind === 'hw' && j.ref === s.id)), done = d.hwInfo().done;
  const rail = new Map(d.rails().map(r => [r.ref, r.km])); for (const [ref, km] of Object.entries(P.railKm || {})) if (!rail.has(ref)) rail.set(ref, km);
  const rOpts = [...rail].filter(([ref]) => !J.some(j => j.kind === 'rail' && j.ref === ref));
  const busy = new Set((st.megas || []).filter(m => m.status !== 'done').map(m => m.key)), mt = (st.mega_types || []).filter(t => !busy.has(t.key));
  const refName = () => W.type === 'hw' ? (s => s ? `${s.nm}: ${d.cityName(s.a)} — ${d.cityName(s.b)} · ${s.km} км` : '')(segs.find(s => s.id === W.ref)) : W.type === 'rail' ? (v => `${d.cityName(v[0])} — ${d.cityName(v[1])} · ${v[2]} км`)(String(W.ref).split('|')) : (t => t ? `${t.ico} ${t.nm}` : '')(mt.find(t => t.key === W.ref));
  if (W.step === 0) h += TYPES.map(([k, t, ds]) => `<button class="opt ${W.type === k ? 'on' : ''}" data-cc="wiz:type:${k}"><b>${t}</b><div class="mut">${ds}</div></button>`).join('');
  if (W.step === 1) h += W.type === 'hw' ? (segs.length ? `<select id="ccRef" style="width:100%">${segs.map(s => `<option value="${s.id}"${W.ref === s.id ? ' selected' : ''}>${esc(s.nm)}: ${esc(d.cityName(s.a))} — ${esc(d.cityName(s.b))} · ${s.km} км${done.includes(s.id) ? ' ✅' : ''}${(P.hwDone || []).includes(s.id) ? ' (той ✅)' : ''}</option>`).join('')}</select>` : '<div class="mut">Няма свободни участъци.</div>')
    : W.type === 'rail' ? (rOpts.length ? `<select id="ccRef" style="width:100%">${rOpts.map(([ref, km]) => { const [a, b] = ref.split('|'); return `<option value="${ref}|${km}"${W.ref === `${ref}|${km}` ? ' selected' : ''}>${esc(d.cityName(a))} — ${esc(d.cityName(b))} · ${km} км</option>`; }).join('')}</select>` : '<div class="mut">🚆 Когато някой от вас построи жп линия, тя ще се появи тук.</div>')
    : (mt.length ? `<select id="ccRef" style="width:100%">${mt.map(t => `<option value="${t.key}"${W.ref === t.key ? ' selected' : ''}>${t.ico} ${esc(t.nm)} · ${f(t.cost)} € · ×${t.mult}</option>`).join('')}</select>` : '<div class="mut">Всички поръчки са в ход.</div>');
  if (W.step === 2) { const t = W.type === 'mega' ? mt.find(x => x.key === W.ref) : null;
    h += `<div class="card"><b>${esc(refName())}</b><div class="mut" style="margin-top:6px">${W.type === 'hw' ? 'Всеки строи участъка в своята игра. Докато и двамата работите по него — 30% по-бързо. Щом единият го завърши, готов е и при другия. Награда: 1 500 €/км еднократно за всеки + 3 €/км всеки ден.'
      : W.type === 'rail' ? 'Обща жп линия: щом е готова при единия, е обща. Награда: 800 €/км еднократно за всеки + 8 €/км всеки ден.'
      : t ? `${esc(t.descr)}<br>Цена ${f(t.cost)} € · строеж ${t.minutes < 60 ? t.minutes + ' мин' : t.minutes / 60 + ' ч'} · множител ×${t.mult}. Печалбата се дели по равно, ако всеки е вложил поне 20%.` : ''}</div></div>`; }
  if (W.step === 3) {
    h += `<div class="card"><div class="mut">Изпращаш на ${esc(C.partnerName())}:</div><div style="font-size:16px;font-weight:800;margin:4px 0">${TYPES.find(x => x[0] === W.type)[1]}</div><div>${esc(refName())}</div>
      <div class="mut" style="margin-top:6px">${W.type === 'mega' ? 'Поръчката започва веднага — после влагате сумите от „Активни“.' : 'Партньорът трябва да приеме — статусът се вижда в „Предложения“.'}</div></div>`;
    // скритите полета, които coop.js act() чете
    h += W.type === 'hw' ? `<select id="cpSeg" hidden><option value="${esc(W.ref)}" selected></option></select><div class="row"><button class="btn wizgo" data-c="jhw">📨 Изпрати предложението</button></div>`
      : W.type === 'rail' ? `<select id="cpRail" hidden><option value="${esc(W.ref)}" selected></option></select><div class="row"><button class="btn wizgo" data-c="jrail">📨 Изпрати предложението</button></div>`
      : `<div class="row"><button class="btn wizgo" data-c="mega:${esc(W.ref)}">🏗️ Започни поръчката</button></div>`;
  }
  h += `<div class="row" style="margin-top:10px">${W.step > 0 ? '<button class="btn2" data-cc="wiz:back">← Назад</button>' : ''}${W.step < 3 ? `<button class="btn" data-cc="wiz:next"${(W.step === 0 && !W.type) ? ' disabled' : ''}>Напред →</button>` : ''}</div>`;
  return h;
}

// ── 🚜 Техника и доставки: изпращане, наем/помощ, поискана помощ, връщания ──
function eq(C) {
  const { st, st2, d, f, esc, E } = C, S = d.S(), pn = esc(C.partnerName()), U = C.UNIT_TYPES, MT = C.MATERIALS;
  const cnt = {}; d.unitsHere().forEach(t => cnt[t] = (cnt[t] || 0) + 1);
  let h = C.v2 ? sendForm(C, cnt) + sosForm(C) : '';
  if (!C.v2) h += `<h3>🚚 Изпрати техника <span class="mut">(свободна в ${esc(d.cityName(S.cityId))})</span></h3>` + (Object.keys(cnt).length ? `<div class="card">${Object.entries(cnt).map(([t, n]) => `<div class="led"><span>${U[t]?.ico} ${U[t]?.nm} · свободни ${n}</span><button class="btn2" data-c="unit:${t}">Изпрати 1</button></div>`).join('')}</div>` : '<div class="mut">Няма свободна техника в този град (заетата на обект не може да се праща).</div>');
  if (!C.v2) h += `<h3>🏢 Под наем или като помощ</h3><div class="mut">Даваш машина за определено време (реално); партньорът плаща наема наведнъж и тя се връща сама. Цена 0 = помощ.</div>`;
  if (!C.v2) h += Object.keys(cnt).length ? `<div class="row"><select id="cpRT">${Object.entries(cnt).map(([x, n]) => `<option value="${x}">${U[x]?.ico} ${U[x]?.nm} (свободни ${n})</option>`).join('')}</select>
    <select id="cpRH">${[2, 6, 12, 24, 48, 72].map(x => `<option value="${x}"${x === 12 ? ' selected' : ''}>за ${x} ч</option>`).join('')}</select><input id="cpRP" inputmode="numeric" placeholder="наем € (0 = помощ)" style="width:150px"><button class="btn2" data-c="rent">📤 Предложи</button></div>` : '';
  const R = st2?.rentals || [];
  const rCard = r => { const u = U[r.type] || {}; let b = '';
    if (r.status === 'offered') b = r.out ? `<button class="btn2" data-c="ract:${r.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="rpay:${r.id}:${r.price}">✅ Наеми${r.price ? ` за ${f(r.price)} €` : ' (безплатно)'}</button><button class="btn2" data-c="ract:${r.id}:decline">Откажи</button>`;
    if (r.status === 'active' && !r.out) b = `<button class="btn2" data-c="rback:${r.id}:${r.type}">Върни сега</button>`;
    const back = r.status === 'active' && r.until ? `връща се ${new Date(r.until).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (след ${C.left(r.until)})` : '';
    return `<div class="led"><span>${u.ico || ''} <b>${u.nm || r.type}</b> ${r.out ? `→ ${pn}` : `← от ${pn}`} · ${r.hours} ч · ${r.price ? f(r.price) + ' €' : 'помощ'}${back ? `<br><span class="mut">${back}</span>` : ''}</span><span class="row" style="margin:0">${chip(rentSt(r))}${b}</span></div>`; };
  const grp = [['📨 Предложени', R.filter(r => r.status === 'offered')], ['🚜 Активни', R.filter(r => r.status === 'active')], ['↩️ Върнати', R.filter(r => !['offered', 'active'].includes(r.status))]];
  for (const [t, L] of grp) if (L.length) h += `<h3>${t}</h3><div class="card">${L.map(rCard).join('')}</div>`;
  // поискана помощ: 🆘 съобщенията на партньора (последното денонощие)
  const sos = (st2?.messages || []).filter(m => m.sos && !m.me && Date.now() - Date.parse(m.at) < 86400e3);
  if (sos.length) h += `<h3>🆘 Поискана помощ</h3>${sos.map(m => { const q = C.v2 && sosParse(C, m.text), done = C.v2 && helped(C, m);
    const go = !q ? '<button class="btn" data-cc="go:fin:tr">Помогни →</button>' : q.money ? `<button class="btn" data-cc="helpMoney:${q.money}:${m.id}">🎁 Помогни с ${f(q.money)} €</button>` : `<button class="btn" data-cc="helpUnit:${q.type}|${q.n}|${q.city || ''}:${m.id}">🚚 Прати ${q.n} × ${U[q.type]?.nm}</button>`;
    return `<div class="ac" style="border-left-color:${done ? 'var(--ok)' : 'var(--bad)'}"><div>${esc(m.text)}<div class="mut">${C.ago(m.at)}</div></div>${C.v2 ? chip(done ? 'done' : 'wait') : ''}${done ? '' : go}${C.v2 && !done ? `<button class="btn2" data-c="helped:${m.id}">✅ Помогнах</button>` : ''}</div>`; }).join('')}`;
  // 🚢 общият флот (coop.js fleetDay, флаг coop-fleet): купеното от единия като партньори е наполовина на другия
  if (C.fleet) { const F = C.fleet.F || {}, all = [...C.fleet.mine.map(v => ({ ...v, me: true })), ...C.fleet.partner.map(v => ({ ...v, me: false }))];
    const sh = all.filter(v => v.me ? (F.mine || {})[v.ref] : (F.paid || {})[v.ref]), ico = r => /^t/.test(r) ? '🚆' : /^s/.test(r) ? '🚢' : '✈️';
    h += `<h3>🚢 Общ флот <span class="mut">(${sh.length})</span></h3>` + (sh.length ? `<div class="card">${sh.slice(0, 40).map(v => `<div class="led"><span>${ico(v.ref)} ${esc(v.nm || v.ref)}</span><span class="mut">${v.me ? 'твой' : `на ${pn}`} · по 50% · ${f(v.cost)} €</span></div>`).join('')}${sh.length > 40 ? `<div class="mut">…и още ${sh.length - 40}</div>` : ''}</div>`
      : `<div class="mut">Влаковете, корабите и самолетите, които някой от вас купи като партньори, стават общи — всеки плаща половината и взема половината от печалбата им (веднъж на игрален ден, автоматично).</div>`); }
  // пратки с техника, които чакат в друг твой град (C.v2: получаваш ги, щом влезеш там)
  const wait = (st.inbox || []).filter(x => x.kind === 'unit' && x.data?.city && x.data.city !== S.cityId);
  if (wait.length) h += `<h3>📦 Чакат те в друг град</h3><div class="card">${wait.map(x => `<div class="led"><span>${U[x.data.type]?.ico || ''} ${x.data.n || 1} × ${U[x.data.type]?.nm || x.data.type} от ${pn}</span><span class="mut">в ${esc(d.cityName(x.data.city))} — влез там</span></div>`).join('')}</div>`;
  const stock = Object.entries(E().s.stock || {}).filter(([k, q]) => q > 0 && MT[k]);
  h += `<h3>📦 Материали</h3>` + (stock.length ? `<div class="card">${stock.map(([k, q]) => `<div class="led"><span>${MT[k].ico} ${MT[k].nm} · ${Math.round(q * 100) / 100} ${MT[k].unit}</span><span class="row" style="margin:0"><input data-mq="${k}" inputmode="decimal" value="${Math.round(q * 100) / 100}" style="width:80px"><button class="btn2" data-c="mat:${k}">Изпрати</button></span></div>`).join('')}</div>` : '<div class="mut">Складът е празен.</div>');
  const H = (st.history || []).filter(x => x.kind === 'unit' || x.kind === 'mat');
  if (H.length) h += `<h3>📜 Изпратени и получени</h3><div class="card">${H.slice(0, 20).map(x => { const D = x.data || {}; const w = x.kind === 'unit' ? `${U[D.type]?.ico || ''} ${(D.n || 1) > 1 ? D.n + ' × ' : ''}${U[D.type]?.nm || D.type}${D.city ? ' → ' + esc(d.cityName(D.city)) : ''}` : `${MT[D.mat]?.ico || ''} ${D.qty} ${MT[D.mat]?.unit || ''} ${MT[D.mat]?.nm || D.mat}`;
    return `<div class="led"><span>${x.out ? `→ към ${pn}` : `← от ${pn}`} · ${w}</span><span class="mut">${C.ago(x.at)}${x.status === 'sent' ? ' · ⏳ на път' : ''}</span></div>`; }).join('')}</div>`;
  return h;
}

// ── 🚚 (v2) техника с количество: вид → количество → град → помощ / подарък / наем → предложение ──
function sendForm(C, cnt) {
  const { st, d, f, esc } = C, S = d.S(), U = C.UNIT_TYPES, pn = esc(C.partnerName()), P = st.partner?.snap || {};
  const types = Object.keys(cnt); if (!types.length) return `<h3>🚚 Изпрати техника</h3><div class="mut">Няма свободна техника в ${esc(d.cityName(S.cityId))} (заетата на обект не може да се праща). Смени града, за да пратиш от друг.</div>`;
  if (!V.eqT || !cnt[V.eqT]) V.eqT = types[0];
  const free = cnt[V.eqT], q = Math.max(1, Math.min(free, V.eqQ || 1)), mode = V.eqM || 'gift', cities = P.cities || [], dest = cities.includes(V.eqC) ? V.eqC : (cities.includes(S.cityId) ? S.cityId : P.hq || cities[0] || '');
  let h = `<h3>🚚 Изпрати техника <span class="mut">от ${esc(d.cityName(S.cityId))}</span></h3><div class="card">
    <div class="row" style="margin:0 0 6px">${types.map(t => `<button class="${t === V.eqT ? 'btn' : 'btn2'}" data-cc="eqT:${t}">${U[t]?.ico} ${U[t]?.nm} · свободни ${cnt[t]}</button>`).join('')}</div>
    <div class="row"><span class="mut" style="width:90px">Количество</span><button class="btn2" data-cc="eqQ:${q - 1}"${q <= 1 ? ' disabled' : ''}>−</button><input id="ccQty" inputmode="numeric" value="${q}" style="width:60px;text-align:center"><button class="btn2" data-cc="eqQ:${q + 1}"${q >= free ? ' disabled' : ''}>+</button><span class="mut">от ${free}</span></div>
    <div class="row"><span class="mut" style="width:90px">Как</span>${[['gift', '🎁 Подарък'], ['help', '🤝 Помощ за срок'], ['rent', '🏢 Под наем']].map(([k, t]) => `<button class="${mode === k ? 'btn' : 'btn2'}" data-cc="eqM:${k}">${t}</button>`).join('')}</div>`;
  if (mode === 'gift') h += `<div class="row"><span class="mut" style="width:90px">За град</span><select id="ccDest">${cities.map(id => `<option value="${id}"${id === dest ? ' selected' : ''}>${esc(d.cityName(id))}${id === P.hq ? ' ★' : ''}</option>`).join('')}</select><span class="mut">— ${pn} я получава, щом влезе там</span></div>`;
  else h += `<div class="row"><span class="mut" style="width:90px">Срок</span><select id="cpRH">${[2, 6, 12, 24, 48, 72].map(x => `<option value="${x}"${x === (V.eqH || 12) ? ' selected' : ''}>${x} ч</option>`).join('')}</select>${mode === 'rent' ? `<input id="cpRP" inputmode="numeric" placeholder="наем € за всяка" value="${V.eqP || ''}" style="width:150px">` : '<input id="cpRP" type="hidden" value="0">'}<span class="mut">— връща се сама след срока (реално време)</span></div>`;
  const what = `${q} × ${U[V.eqT]?.ico} ${U[V.eqT]?.nm}`;
  h += `<div class="ac" style="margin-top:8px"><div><b>Предложение:</b> ${what} → ${pn}${mode === 'gift' ? ` · за ${esc(d.cityName(dest))} · подарък` : mode === 'help' ? ` · помощ за ${V.eqH || 12} ч (безплатно)` : ` · под наем за ${V.eqH || 12} ч${V.eqP ? ` · ${f(V.eqP)} € за всяка` : ''}`}</div>
    <button class="btn" data-c="${mode === 'gift' ? 'unitn' : 'rentn'}:${V.eqT}">📤 Изпрати</button></div></div>`;
  return h;
}
// ── 🆘 (v2) структурирана молба за помощ: пари за нещо / машина в град ──
const SOS_WHY = ['заплати', 'материали', 'кредита', 'нов строеж', 'техника'];
function sosForm(C) {
  const { d, esc, f } = C, U = C.UNIT_TYPES, k = V.sosK || 'money', mine = d.ownedCities();
  const txt = sosText(C);
  return `<h3>🆘 Поискай помощ</h3><div class="card"><div class="row" style="margin:0 0 6px">${[['money', '💶 Пари'], ['unit', '🚜 Машина']].map(([x, t]) => `<button class="${k === x ? 'btn' : 'btn2'}" data-cc="sosK:${x}">${t}</button>`).join('')}</div>
    ${k === 'money' ? `<div class="row"><input id="ccSosAmt" inputmode="numeric" placeholder="сума в €" value="${V.sosA || ''}" style="width:140px"><span class="mut">за</span><select id="ccSosWhy">${SOS_WHY.map(w => `<option${w === V.sosW ? ' selected' : ''}>${w}</option>`).join('')}</select></div>`
      : `<div class="row"><input id="ccSosN" inputmode="numeric" value="${V.sosN || 1}" style="width:50px;text-align:center"><span class="mut">×</span><select id="ccSosT">${Object.entries(U).map(([t, u]) => `<option value="${t}"${t === V.sosT ? ' selected' : ''}>${u.ico} ${u.nm}</option>`).join('')}</select><span class="mut">в</span><select id="ccSosC">${mine.map(id => `<option value="${id}"${id === (V.sosC || d.S().cityId) ? ' selected' : ''}>${esc(d.cityName(id))}</option>`).join('')}</select></div>`}
    <div class="row"><button class="btn2" data-cc="sosPrev">👁️ Виж текста</button>${txt ? `<span class="mut">„${esc(txt)}“</span><input id="ccSosTxt" type="hidden" value="${esc(txt)}"><button class="btn" data-c="sosx" style="background:var(--bad);color:#fff">🆘 Изпрати</button>` : ''}</div></div>`;
}
function sosText(C) {
  const U = C.UNIT_TYPES, f = C.f;
  if ((V.sosK || 'money') === 'money') return V.sosA > 0 ? `Трябват ми ${f(V.sosA)} € за ${V.sosW || SOS_WHY[0]}` : '';
  const u = U[V.sosT]; return u && V.sosC ? `Нужни ми са ${V.sosN || 1} × ${u.nm} в ${C.d.cityName(V.sosC)}` : '';
}
// разчитане на 🆘 съобщение на партньора → { money } или { type, n, city }
function sosParse(C, text) {
  const m = /Трябват ми ([\d\s\u00a0\u202f.,]+) €(?: за (.+))?/.exec(text || ''); if (m) return { money: +m[1].replace(/[^\d]/g, ''), why: m[2] || '' };
  const u = /Нужни ми са (\d+) × (.+?) в (.+)$/.exec(text || ''); if (!u) return null;
  const type = Object.keys(C.UNIT_TYPES).find(t => C.UNIT_TYPES[t].nm === u[2]); const city = (C.st.partner?.snap?.cities || []).find(id => C.d.cityName(id) === u[3]) || null;
  return type ? { type, n: +u[1], city } : null;
}
// помогнато ли е: по-късно съобщение „✅ Помогнах: …“ от другия
const helped = (C, m) => (C.st2?.messages || []).some(x => x.id > m.id && x.me !== m.me && /^✅ Помогнах/.test(x.text));

// трите вида пари — винаги ясно разделени (във „Финанси“ и в „Общ холдинг“)
const THREE_HTML = (C, s, pn) => `<div class="three"><div class="stat"><b>${C.f(C.E().money)} €</b><span>👤 Твои средства</span></div><div class="stat"><b style="color:${C.PCOL}">${C.f(s.money || 0)} €</b><span>🤝 Средства на ${pn}</span></div><div class="stat"><b style="color:var(--acc)">${C.f(C.st2?.vault?.balance || 0)} €</b><span>🏦 Общи средства (холдинг)</span></div></div>`;
// ── 💶 Финанси: Преводи · Заеми (общият холдинг е отделен раздел — най-отгоре) ──
function fin(C) {
  if (V.fin === 'hold') V.fin = 'tr';
  let h = `<div class="sub">${[['tr', '🎁 Преводи'], ['loan', '💸 Заеми']].map(([k, t]) => `<button class="${V.fin === k ? 'on' : ''}" data-cc="fin:${k}">${t}</button>`).join('')}</div>`;
  const { st, st2, f, esc, E } = C, pn = esc(C.partnerName()), s = st.partner?.snap || {};
  // трите вида пари — винаги ясно разделени
  h += THREE_HTML(C, s, pn);
  if (V.fin === 'tr') {
    if (V.helpMsg) { const m = (st2?.messages || []).find(x => x.id === V.helpMsg); if (m) h += `<div class="ac" style="border-left-color:var(--bad)"><div>🆘 Помагаш на ${pn}: „${esc(m.text)}“<div class="mut">Подари сумата, после натисни „✅ Помогнах“ — партньорът вижда, че е изпълнено.</div></div><button class="btn2" data-c="helped:${m.id}">✅ Помогнах</button></div>`; }
    h += `<h3>🎁 Подари пари</h3><div class="row"><input id="cpAmt" inputmode="numeric" placeholder="сума в €" value="${V.giftA || ''}"><button class="btn" data-c="gift">🎁 Подари на ${pn}</button></div><div class="mut">Парите тръгват от твоите средства веднага.</div>`;
    const sh = (C.st.partner?.snap?.cities || []).includes(C.d.S().cityId);
    h += `<h3>🎁 Изненада в общ град</h3>` + (sh ? `<div class="row"><input id="cpST" maxlength="60" placeholder="Текст на табелата" style="width:200px"><input id="cpSA" inputmode="numeric" placeholder="подарък € (по желание)" style="width:150px"><button class="btn2" data-c="surp">🎁 Остави тук</button></div>` : `<div class="mut">Отиди в град, в който и ${pn} има фирма, за да оставиш изненада.</div>`);
    const SM = st2?.surprises_mine || []; if (SM.length) h += `<div class="card">${SM.map(x => `<div class="led"><span>🎁 ${esc(C.d.cityName(x.city))} · „${esc(x.text)}“${x.amount ? ` · ${f(x.amount)} €` : ''}</span>${chip(x.status === 'found' ? 'done' : 'wait')}</div>`).join('')}</div>`;
    const K = { gift: '🎁 подарък', loan: '💸 заем', repay: '💸 връщане', refund: '↩️ върнато', mega: '🏗️ поръчка', rent: '🏢 наем', vault: '🏦 холдинг' };
    const H = (st.history || []).filter(x => x.kind !== 'unit' && x.kind !== 'mat');
    if (H.length) h += `<h3>📜 История на преводите</h3><div class="card">${H.slice(0, 25).map(x => `<div class="led"><span>${x.out ? `→ към ${pn}` : `← от ${pn}`} · ${K[x.kind] || x.kind}</span><span><b class="${x.out ? 'bad' : 'ok'}">${x.out ? '−' : '+'}${f(x.data?.amount || 0)} €</b> <span class="mut">${C.ago(x.at)}${x.status === 'sent' ? ' · ⏳' : ''}</span></span></div>`).join('')}</div>`;
  }
  if (V.fin === 'loan') {
    h += `<h3>💸 Предложи заем</h3><div class="row"><input id="cpAmt" inputmode="numeric" placeholder="сума в €"><select id="cpH">${[6, 12, 24, 48, 72, 168].map(x => `<option value="${x}"${x === 24 ? ' selected' : ''}>връщане до ${x < 48 ? x + ' ч' : x / 24 + ' дни'}</option>`).join('')}</select>
      <select id="cpR">${[0, 2, 5, 10].map(x => `<option value="${x}">лихва ${x}%</option>`).join('')}</select><button class="btn" data-c="loan">💸 Предложи</button></div>
      <div class="mut">Парите тръгват, когато ${pn} приеме (дотогава се пазят — при отказ се връщат). Срокът е в реално време; ако не се върне навреме, играта на длъжника сама връща, колкото има.</div>`;
    const L = st.loans || [];
    const lc = l => { const rest = l.owed - l.repaid; let b = '';
      if (l.status === 'offered') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="lact:${l.id}:accept">✅ Приеми</button><button class="btn2" data-c="lact:${l.id}:decline">Откажи</button>`;
      if (l.status === 'open') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:forgive">Опрости</button>` : `<button class="btn" data-c="repay:${l.id}:${rest}">Върни ${f(rest)} €</button>`;
      return `<div class="led"><span>💸 ${l.out ? `Ти → ${pn}` : `${pn} → теб`} · <b>${f(l.amount)} €</b> · ${l.rate_pct}%${l.status === 'open' ? `<br><span class="mut">остават <b>${f(rest)} €</b> · падеж ${new Date(l.due_at).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (след ${C.left(l.due_at)})</span>` : ''}</span><span class="row" style="margin:0">${chip(loanSt(l))}${b}</span></div>`; };
    const grp = [['📨 Предложения', L.filter(l => l.status === 'offered')], ['📄 Приети (текущи)', L.filter(l => l.status === 'open')], ['🏁 Приключени', L.filter(l => !['offered', 'open'].includes(l.status))]];
    for (const [t, G] of grp) if (G.length) h += `<h3>${t}</h3><div class="card">${G.map(lc).join('')}</div>`;
    if (!L.length) h += '<div class="mut" style="margin-top:10px">Още няма заеми.</div>';
  }
  return h;
}

// ── 🏦 Общ холдинг — първият раздел на центъра (касата, правилата, тандемите; нивата на холдинга — feature 'coop-levels', coopholding.js) ──
function holdSec(C) {
  const { st, st2, f, esc, E } = C, pn = esc(C.partnerName()), s = st.partner?.snap || {};
  let h = C.holdTop ? C.holdTop() : '';   // 🏛️ ниво на холдинга, следващо, опит, свободни/резервирани, следваща обща цел (coop-levels)
  h += THREE_HTML(C, s, pn);
  const V0 = st2?.vault || { balance: 0, log: [] }, log = C.st3?.log || V0.log || [], T = st2?.tandems || [];
  const inn = log.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0), out = log.filter(l => l.amount < 0).reduce((a, l) => a - l.amount, 0);
  const days = log.length ? Math.max(1, Math.round((Date.now() - Math.min(...log.map(l => Date.parse(l.at)))) / 86400e3)) : 0;
  h += `<h3>🏦 ${esc(V0.name || 'Вашият холдинг')}</h3><div class="card"><div class="mut">Обща касичка — внасяте и двамата, тегли всеки при нужда.</div>
    <div class="row"><input id="cpV" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="vput">⬆️ Внеси от твоите</button><button class="btn2" data-c="vtake">⬇️ Изтегли при теб</button></div>
    <div class="led"><span>За периода${days ? ` (последните ${days} дни)` : ''}: внесени</span><b class="ok">+${f(inn)} €</b></div><div class="led"><span>изтеглени / покрити</span><b class="bad">−${f(out)} €</b></div>
    ${C.holdInfo()}
    <div class="row"><button class="btn2" data-cc="hist">${V.hist ? '▲ Скрий историята' : `📜 История (${log.length})`}</button></div>
    ${V.hist ? log.map(l => `<div class="led"><span>${C.logTxt(l)}</span><span class="${l.amount > 0 ? 'ok' : 'bad'}">${l.amount > 0 ? '+' : ''}${f(l.amount)} € · ${C.ago(l.at)}</span></div>`).join('') : ''}</div>`;
  if (C.st4) h += rulesHtml(C);
  h += `<h3>🏆 Най-силен тандем</h3><div class="card">${T.map((x, i) => `<div class="led" style="${x.me ? `color:${C.PCOL};font-weight:800` : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(x.name)}${x.me ? ' (вие)' : ''}</span><b>${f(x.worth)} €</b></div>`).join('') || '<div class="mut">Още няма тандеми.</div>'}</div>`;
    return h;
}

// ── 📜 (v2, coop_status4) правилата на общата каса: лимит за самостоятелно теглене, лимит за автоматичното спасяване, заявки ──
function rulesHtml(C) {
  const { f, esc } = C, R = C.st4.rules || {}, P = R.pending, pn = esc(C.partnerName()), lim = n => n == null ? 'без лимит' : n === 0 ? 'изключено' : f(n) + ' €';
  let h = `<h3>📜 Правила на общата каса</h3><div class="card">`;
  h += R.at ? `<div class="led"><span>💳 Сам теглиш до</span><b>${lim(R.self_limit)}${R.self_limit != null ? ' за 24 ч' : ''}</b></div><div class="led"><span>🛟 Автоматично спасяване от фалит до</span><b>${lim(R.rescue_limit)}</b></div>
      <div class="mut">Приети от двамата ${C.ago(R.at)}.${R.self_limit != null ? ` Изтеглил си ${f(C.st4.used24 || 0)} € за последните 24 ч — над лимита тегленето става заявка, която ${pn} одобрява.` : ''}</div>`
    : `<div class="mut">Още няма приети правила: всеки тегли колкото иска, а холдингът покрива дълга до цялата каса. Предложи правила — важат, щом ${pn} ги приеме.</div>`;
  if (P) h += `<div class="ac" style="margin-top:8px"><div><b>${P.mine ? 'Предложи' : `${pn} предлага`}:</b> сам до ${lim(P.self_limit)}${P.self_limit != null ? ' за 24 ч' : ''} · спасяване до ${lim(P.rescue_limit)}</div>${chip(P.mine ? 'wait' : 'mine')}${P.mine ? '<button class="btn2" data-c="rulesact:cancel">Оттегли</button>' : '<button class="btn" data-c="rulesact:accept">✅ Приеми</button><button class="btn2" data-c="rulesact:decline">Откажи</button>'}</div>`;
  else h += `<div class="row" style="margin-top:8px"><span class="mut">Сам до</span><input id="ccSelf" inputmode="numeric" placeholder="€ за 24 ч (празно = без)" style="width:170px"><span class="mut">спасяване до</span><input id="ccRescue" inputmode="numeric" placeholder="€ (празно = цялата каса)" style="width:170px"><button class="btn2" data-c="rulesp">📜 Предложи</button></div>`;
  if (R.self_limit != null) h += `<div class="row"><span class="mut">Над лимита:</span><input id="ccReason" maxlength="120" placeholder="за какво (по желание)" style="flex:1;min-width:140px"><button class="btn2" data-c="wreq">🙋 Поискай одобрение за сумата горе</button></div>`;
  const Q = C.st4.requests || [];
  if (Q.length) h += `<div style="margin-top:8px">${Q.map(r => { const k = r.status === 'requested' ? (r.mine ? 'wait' : 'mine') : r.status === 'approved' ? 'done' : r.status === 'declined' ? 'no' : r.status === 'expired' ? 'exp' : 'cancel';
    const b = r.status !== 'requested' ? '' : r.mine ? `<button class="btn2" data-c="wact:${r.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="wact:${r.id}:approve">✅ Одобри</button><button class="btn2" data-c="wact:${r.id}:decline">Откажи</button>`;
    return `<div class="led"><span>🏦 ${r.mine ? 'Ти' : pn} · теглене <b>${f(r.amount)} €</b>${r.reason ? ` — ${esc(r.reason)}` : ''}<br><span class="mut">${C.ago(r.at)}</span></span><span class="row" style="margin:0">${chip(k)}${b}</span></div>`; }).join('')}</div>`;
  return h + '</div>';
}

// ── 🏆 Общи цели: приносът на всеки (моят — от снимката ми при първото виждане на задачата; на партньора — остатъкът) ──
function goals(C) {
  const { st2, f, esc, PCOL, d } = C, Q = st2?.quests || [], my = d.stats(), pn = esc(C.partnerName());
  let base = {}; try { base = JSON.parse(localStorage.getItem('stroi-coop-qbase')) || {}; } catch {}
  let h = `<div class="row" style="justify-content:space-between;margin:0"><h3 style="margin:0">🏆 Общи цели</h3>${rewards(C).goals ? `<button class="btn" data-cc="claimall">🏆 Вземи всички налични награди</button>` : ''}</div>
    <div class="mut" style="margin:4px 0 8px">Напредъкът е сборът от двете игри. Всеки взема своята награда (само своя дял). Изпълните ли една, идва нова, по-трудна.</div>`;
  // приносът се брои от момента, в който задачата се видя за пръв път на това устройство (сървърът пази само сбора):
  // base = { me: моята статистика тогава, prog: общият напредък тогава, t } → „отпреди“ е частта, която не можем да разделим
  const H = C.st.history || [], parcels = (out, t) => H.filter(x => !!x.out === out && Date.parse(x.at) > t && ['gift', 'unit', 'mat', 'loan', 'rent'].includes(x.kind)).length;
  h += Q.map(q => { const pc = Math.min(100, Math.round(q.progress / q.target * 100)), k = STAT_OF[q.key];
    if (!base[q.id] || typeof base[q.id] !== 'object') base[q.id] = { me: k ? (my[k] || 0) : 0, prog: q.progress, t: Date.now() };
    const B = base[q.id], fm = n => q.key === 'money' ? f(n) + ' €' : n;
    let mine = k ? Math.max(0, (my[k] || 0) - B.me) : q.key === 'parcels' ? parcels(true, B.t) : null;
    const before = Math.min(q.progress, B.prog); if (mine != null) mine = Math.min(mine, q.progress - before);
    const theirs = mine != null ? Math.max(0, q.progress - before - mine) : null;
    return `<div class="card"><div class="row" style="margin:0;justify-content:space-between"><b>🏆 ${esc(q.nm)}</b>${q.claimed ? chip('done') : q.status === 'done' ? '<span class="chip" style="color:var(--ok);border-color:#5fd38a55">🏆 готова</span>' : ''}</div>
      <div class="bar" style="margin:6px 0">${mine != null ? `<i style="width:${Math.min(100, before / q.target * 100)}%;background:#ffffff40"></i><i style="width:${Math.min(100, mine / q.target * 100)}%;background:var(--acc)"></i><i style="width:${Math.min(100, theirs / q.target * 100)}%;background:${PCOL}"></i>` : `<i style="width:${pc}%;background:${PCOL}"></i>`}</div>
      <div class="led" style="border:0"><span>${mine != null ? `<b style="color:var(--acc)">Ти: ${fm(mine)}</b> · <b style="color:${PCOL}">${pn}: ${fm(theirs)}</b>${before ? ` · <span class="mut">отпреди: ${fm(before)}</span>` : ''} · ` : ''}общо ${fm(q.progress)} / ${fm(q.target)}</span><span>награда <b>${f(q.reward)} €</b> за всеки ${q.status === 'done' && !q.claimed ? `<button class="btn" data-c="qclaim:${q.id}">Вземи</button>` : ''}</span></div></div>`; }).join('') || '<div class="mut">Зареждам задачите…</div>';
  try { localStorage.setItem('stroi-coop-qbase', JSON.stringify(base)); } catch {}
  return h;
}

// ── 💬 Чат: само написаното от играчите + бързи отговори ──
function chat(C) {
  const { st2, esc, PCOL } = C, M = st2?.messages || [], pn = esc(C.partnerName());
  let h = `<div class="card" id="cpChat" style="height:min(52vh,460px);overflow:auto">${M.map(m => `<div style="display:flex;justify-content:${m.me ? 'flex-end' : 'flex-start'};margin:4px 0"><div style="max-width:80%;padding:7px 11px;border-radius:12px;background:${m.sos ? '#ff6b6b33' : m.me ? '#ffb30022' : PCOL + '22'};border:1px solid ${m.sos ? 'var(--bad)' : 'var(--line)'}">${m.sos ? '🆘 ' : ''}${esc(m.text)}<div class="mut" style="font-size:11px">${m.me ? 'ти' : pn} · ${C.ago(m.at)}</div></div></div>`).join('') || '<div class="mut">Още няма съобщения. Кажи здрасти! 👋</div>'}</div>
    <div class="row"><input id="cpMsg" maxlength="300" placeholder="Съобщение…" style="flex:1;min-width:160px"><button class="btn" data-c="say">Изпрати</button></div>
    <div class="row qk" style="flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none">${C.QUICK.map((q, i) => `<button class="btn2" data-c="quick:${i}" style="font-size:12px;white-space:nowrap">${q}</button>`).join('')}</div>
    <div class="row"><button class="btn2" data-c="sos" style="border-color:var(--bad);color:#ffb3b3">🆘 Трябва ми помощ</button><span class="mut">Преводите, заемите и завършените проекти са в „📜 Активност“.</span></div>`;
  return h;
}

// ── 📜 Активност: системните събития (пратки, заеми, холдинг, проекти) — отделно от чата ──
function feed(C) {
  const { st, st2, st3, f, esc } = C, pn = esc(C.partnerName()), U = C.UNIT_TYPES, MT = C.MATERIALS, ev = [];
  const K = { gift: '🎁 Подарък', loan: '💸 Заем', repay: '💸 Връщане по заем', refund: '↩️ Върнато', mega: '🏗️ Обща поръчка', rent: '🏢 Наем', vault: '🏦 От холдинга' };
  for (const x of st.history || []) { const D = x.data || {}, w = x.kind === 'unit' ? `${U[D.type]?.ico || ''} ${U[D.type]?.nm || D.type}` : x.kind === 'mat' ? `${MT[D.mat]?.ico || ''} ${D.qty} ${MT[D.mat]?.unit || ''} ${MT[D.mat]?.nm || ''}` : `${f(D.amount || 0)} €`;
    ev.push({ at: x.at, t: `${x.kind === 'unit' ? '🚜 Техника' : x.kind === 'mat' ? '📦 Материали' : K[x.kind] || x.kind} ${x.out ? `→ ${pn}` : `← ${pn}`}: ${w}${x.status === 'sent' ? ' · ⏳ на път' : ''}` }); }
  for (const l of st3?.log || st2?.vault?.log || []) ev.push({ at: l.at, t: `${C.logTxt(l)}: <b class="${l.amount > 0 ? 'ok' : 'bad'}">${l.amount > 0 ? '+' : ''}${f(l.amount)} €</b>` });
  for (const m of st3?.megas_done || []) if (m.at) ev.push({ at: m.at, t: `🏁 Изпълнена обща поръчка: ${m.ico} ${esc(m.nm)}` });
  for (const s of st2?.surprises_mine || []) if (s.at) ev.push({ at: s.at, t: `🎁 Остави изненада в ${esc(C.d.cityName(s.city))}${s.status === 'found' ? ' — намерена ✅' : ''}` });
  ev.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return `<h3>📜 Активност</h3><div class="card">${ev.slice(0, 80).map(e => `<div class="led"><span>${e.t}</span><span class="mut">${C.ago(e.at)}</span></div>`).join('') || '<div class="mut">Още няма събития.</div>'}</div>`;
}
