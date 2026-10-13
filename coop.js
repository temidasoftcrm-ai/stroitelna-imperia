// coop.js — 🤝 ПАРТНЬОРСТВО в самостоятелната игра. Всеки играе своята игра (своята карта, време и скорост),
// а двамата партньори си помагат през облака (Supabase, public.coop_* функции — миграция 20261014070000_coop.sql):
//   • пари — подарък или заем (заемът се предлага, партньорът приема; връща се до срока, иначе играта сама го връща);
//   • техника и материали — от твоя град/склад в неговия;
//   • общи големи поръчки — и двамата влагат, след срока всеки получава вложеното × множител (ако и двамата са вложили ≥ 20%);
//   • партньорът на картата — градовете му са с розов пръстен и името му; вижда се дали е онлайн.
// Сървърът е „пощата“: всяка пратка се записва веднъж (req_id) и се получава веднъж (claim). Изпращачът първо вади
// парите/техниката от своята игра и пази заявката в localStorage, докато сървърът я потвърди — при срив се праща пак
// със същия req_id (без двойно изпращане); при отказ от сървъра се връща обратно.
import { UNIT_TYPES, MATERIALS } from './economy.js';

const PCOL = '#ff4fa3';   // цветът на партньора на картата (различен от марките на фирмите)
const PEND = 'stroi-coop-pending', NAME = 'stroi-coop-name', POLL = 10000, SNAP_EVERY = 20000;
const AUTOTEST = /[?&]autotest/.test(location.search);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => crypto.randomUUID();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ago = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 90 ? 'току-що' : s < 3600 ? `преди ${Math.round(s / 60)} мин` : s < 86400 ? `преди ${Math.round(s / 3600)} ч` : `преди ${Math.round(s / 86400)} дни`; };
const left = iso => { const s = (Date.parse(iso) - Date.now()) / 1000; return s <= 0 ? 'сега' : s < 3600 ? `${Math.ceil(s / 60)} мин` : `${Math.floor(s / 3600)} ч ${Math.round((s % 3600) / 60)} мин`; };

export function createCoop(d) {
  // облакът се зарежда отделно: ако няма интернет, самостоятелната игра работи както винаги
  let cloud = { user: () => null, sb: null }, sb = null;
  import('./cloud.js').then(m => { cloud = m.cloud; sb = cloud.sb; sb.auth.onAuthStateChange(() => setTimeout(tick, 300)); tick(); }).catch(() => {});
  let lastMarks = 0, st = null, open = false, busy = false, lastSnap = 0, user = null, applying = false;
  const E = () => d.econ(), f = n => d.fmt(n);
  const pend = () => { try { return JSON.parse(localStorage.getItem(PEND)) || []; } catch { return []; } };
  const setPend = a => { try { localStorage.setItem(PEND, JSON.stringify(a)); } catch {} };

  // извикване на сървъра; мрежовите грешки се повтарят със същите аргументи (и същия req_id)
  async function rpc(fn, args = {}, tries = 6) {
    let wait = 700;
    for (let i = 0; ; i++) {
      if (!sb) throw new Error('Няма връзка с облака.');
      let r; try { r = await sb.rpc(fn, args); } catch (e) { r = { error: e }; }
      if (!r.error) return r.data;
      if (i >= tries || /not_authenticated|JWT|permission/i.test(r.error.message || '')) throw r.error;
      await sleep(wait); wait = Math.min(6000, wait * 1.8);
    }
  }

  // ── моето име за партньора ──
  const myName = () => { try { const n = localStorage.getItem(NAME); if (n) return n; } catch {} const b = d.brand(); return b ? b.nm : 'Партньор'; };

  // ── снимка на моята игра (партньорът я вижда в панела и на картата си) ──
  function snapshot() {
    const S = d.S(), e = E(), b = d.brand();
    return { name: myName(), brand: b?.k || null, ico: b?.ico || '🏗️', col: b?.col || '#ffb300', money: Math.round(e.money), worth: Math.round(d.netWorth()),
      loan: Math.round(e.s.loan || 0), day: S.day, rep: Math.round((S.rep || 0) * 10) / 10, office: S.officeLevel || 1, hq: S.hqCity || S.cityId, here: S.cityId,
      cities: d.ownedCities().filter(Boolean).slice(0, 80), sites: sites() };
  }
  // къде строя по градове: текущият град се чете от играта, другите — от последното посещение (localStorage)
  const SITES = 'stroi-coop-sites';
  function sites() {
    let all = {}; try { all = JSON.parse(localStorage.getItem(SITES)) || {}; } catch {}
    const id = d.cityId(); if (id && d.ready()) all[id] = d.sitesHere().slice(0, 120);
    for (const k of Object.keys(all)) if (!d.ownedCities().includes(k)) delete all[k];
    try { localStorage.setItem(SITES, JSON.stringify(all)); } catch {}
    return all;
  }
  // партньорът в моя 3D град: ако строи в същия град — розови пръстени и табелки на неговите парцели
  function markPartner() {
    if (!d.ready()) return;
    const P = st?.partner?.snap, id = d.cityId();
    lastMarks = d.mark(P && P.sites && P.sites[id] || [], P ? P.name : '', PCOL) || 0;
  }

  // ── опашката от неизпратени пратки (оцелява при презареждане) ──
  // op: { fn, args, refund: { money } | { unit } | { mat, qty }, what }
  async function runOp(op) {
    let r;
    try { r = await rpc(op.fn, op.args); } catch (e) { return false; }   // остава в опашката — ще опита пак
    setPend(pend().filter(x => x.args.p_req !== op.args.p_req));
    if (r && r.ok === false) { refund(op.refund, r.msg); return r; }
    return r;
  }
  function refund(rf, why) {
    if (!rf) return;
    if (rf.money) { E().earn(rf.money, 'партньор', 'Върнато — пратката не мина'); }
    if (rf.unit && d.giveUnit(rf.unit) !== 'ok') E().earn(UNIT_TYPES[rf.unit]?.cost || 0, 'партньор', 'Върната техника (няма място — стойността)');
    if (rf.mat) E().s.stock[rf.mat] = (E().s.stock[rf.mat] || 0) + rf.qty;
    d.save(); d.renderPanel();
    d.toast(`↩️ ${why || 'Пратката не мина'} — върнато обратно.`, 'bad');
  }
  async function queue(op) {
    setPend([...pend(), op]);
    d.save();   // извадените пари/техника са записани заедно с опашката
    const r = await runOp(op);
    if (r === false) d.toast('📶 Няма връзка — пратката ще тръгне сама, щом се появи интернет.', 'bad');
    return r;
  }

  // ── получаване на пратките (всяка точно веднъж) ──
  async function receive() {
    if (!st?.inbox?.length || !d.ready() || applying) return;
    applying = true;
    try {
      for (const x of st.inbox) {
        let r; try { r = await rpc('coop_claim', { p_id: x.id }, 2); } catch { break; }
        if (!r?.ok) continue;
        const D = r.data || {}, pn = partnerName();
        if (r.kind === 'unit') {
          const t = UNIT_TYPES[D.type]; if (!t) continue;
          for (let i = 0; i < (D.n || 1); i++) {
            const g = d.giveUnit(D.type);
            if (g !== 'ok') { E().earn(t.cost, 'партньор', `${t.nm} от ${pn} — ${g === 'office' ? 'офисът' : 'гаражът'} е пълен, получи стойността`); d.toast(`${t.ico} ${pn} ти прати ${t.nm.toLowerCase()}, но ${g === 'office' ? 'офисът' : 'гаражът'} е пълен — получи ${f(t.cost)} €.`, 'good'); }
            else d.toast(`🤝 ${pn} ти прати ${t.ico} ${t.nm.toLowerCase()}!`, 'good');
          }
        } else if (r.kind === 'mat') {
          const m = MATERIALS[D.mat]; if (!m) continue;
          E().s.stock[D.mat] = (E().s.stock[D.mat] || 0) + +D.qty;
          d.toast(`🤝 ${pn} ти прати ${m.ico} ${D.qty} ${m.unit} ${m.nm.toLowerCase()}.`, 'good');
        } else if (+D.amount > 0) {
          const amt = Math.round(+D.amount);
          const why = { gift: `🎁 Подарък от ${pn}`, loan: `💸 Заем от ${pn} — върни ${f(D.owed)} € до ${D.hours} ч`, repay: `💸 ${pn} върна по заема`, refund: r.note || 'Върнати пари', mega: 'Обща поръчка' }[r.kind] || 'Партньор';
          E().earn(amt, 'партньор', why.replace(/^[^\wА-я]+\s*/, ''));
          d.toast(`${why}: +${f(amt)} €`, 'good');
        }
        d.save(); d.renderPanel();
      }
    } finally { applying = false; }
  }

  // ── заем с изтекъл срок: играта сама връща, колкото има ──
  async function autoRepay() {
    if (!st?.loans || !d.ready()) return;
    for (const l of st.loans) {
      if (l.out || l.status !== 'open' || !l.due_at || Date.parse(l.due_at) > Date.now()) continue;
      const need = l.owed - l.repaid, can = Math.min(need, Math.floor(E().money));
      if (can <= 0) continue;
      E().spend(can, 'партньор', `Връщане на заем към ${partnerName()} (срокът изтече)`);
      await queue({ fn: 'coop_repay', args: { p_req: uid(), p_loan: l.id, p_amount: can }, refund: { money: can } });
      d.toast(`⏰ Срокът на заема изтече — върнати ${f(can)} € на ${partnerName()}.`, 'bad');
    }
  }

  const partnerName = () => st?.partner?.snap?.name || 'партньора';

  async function tick() {
    if (AUTOTEST) return;
    user = sb && cloud.user && cloud.user();
    if (!user) { st = null; mount(); return; }
    for (const op of pend()) await runOp(op);   // недоизпратените от миналия път
    try {
      if (d.ready() && Date.now() - lastSnap > SNAP_EVERY) { lastSnap = Date.now(); await rpc('coop_snap', { p_data: snapshot() }, 1); }
      const r = await rpc('coop_status', {}, 1);
      const before = JSON.stringify(st?.partner?.snap?.cities || []);
      st = r && r.ok ? r : st;
      if (JSON.stringify(st?.partner?.snap?.cities || []) !== before) d.drawMap();
    } catch { }
    await receive();
    await autoRepay();
    markPartner();
    mount();
    if (open) render();
  }

  // ── партньорът на картата: розов пръстен около градовете му, звезда и име при централата ──
  window.__coopMap = (proj, k, cityById) => {
    const P = st?.partner?.snap; if (!P || !P.cities) return '';
    let h = '<g class="coop-map" style="pointer-events:none">';
    for (const id of P.cities) {
      const c = cityById(id); if (!c) continue;
      const [x, y] = proj(c.lon, c.lat), r = 9 * k, hq = id === P.hq;
      h += `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${PCOL}" stroke-width="${2.6 * k}" stroke-dasharray="${hq ? '' : `${3 * k} ${2 * k}`}" opacity=".95"/>`;
      if (hq) h += `<text x="${x}" y="${y - r - 4 * k}" text-anchor="middle" font-size="${11 * k}" font-weight="800" fill="${PCOL}" stroke="#0008" stroke-width="${2.4 * k}" paint-order="stroke">🤝 ${esc(P.name)}${st.partner.online ? ' 🟢' : ''}</text>`;
    }
    return h + '</g>';
  };

  // ── бутон в горната лента ──
  function mount() {
    if (AUTOTEST) return;
    const top = document.getElementById('top'); if (!top) return;
    let b = document.getElementById('coopBtn');
    if (!b) {
      b = document.createElement('button'); b.id = 'coopBtn'; b.className = 'btn2'; b.onclick = () => { open = true; render(); tick(); };
      top.insertBefore(b, document.getElementById('onlineBtn') || document.getElementById('cloudBtn') || top.querySelector('.sp'));
    }
    const P = st?.partner, n = st?.inbox?.length || 0;
    b.innerHTML = P ? `🤝 <span style="color:${PCOL}">${esc(P.snap?.name || 'Партньор')}</span>${P.online ? ' 🟢' : ''}${n ? ` <b style="color:var(--acc)">+${n}</b>` : ''}` : '🤝 Партньор';
    b.title = P ? `Партньор: ${P.snap?.name || '—'} (${P.online ? 'онлайн сега' : P.at ? 'последно ' + ago(P.at) : 'още не е влизал'})` : 'Свържи се с приятел и си помагайте';
  }

  // ── панелът ──
  function box() {
    let el = document.getElementById('coopBox');
    if (!el) {
      el = document.createElement('div'); el.id = 'coopBox';
      el.innerHTML = `<style>
        #coopBox { position:fixed; inset:0; z-index:60; background:#0008; display:flex; align-items:flex-start; justify-content:center; padding:62px 12px 12px; }
        #coopBox .in { width:min(560px, 100%); max-height:calc(100vh - 80px); overflow:auto; background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:14px 16px; color:var(--txt); backdrop-filter:blur(6px); }
        #coopBox h2 { font-size:19px; margin:0 0 6px; color:${PCOL}; } #coopBox h3 { font-size:15px; margin:14px 0 6px; }
        #coopBox .mut { color:var(--mut); font-size:13px; line-height:1.5; } #coopBox .row { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:6px 0; }
        #coopBox input, #coopBox select { background:#0006; color:var(--txt); border:1px solid var(--line); border-radius:8px; padding:7px 9px; font:inherit; font-size:14px; }
        #coopBox input { width:130px; } #coopBox .btn { background:var(--acc); color:#1a1200; border:0; border-radius:9px; padding:7px 12px; font-weight:800; cursor:pointer; }
        #coopBox .btn2 { cursor:pointer; color:var(--txt); } #coopBox .card { border:1px solid var(--line); border-radius:11px; padding:10px 12px; margin:8px 0; background:#ffffff08; }
        #coopBox .led { display:flex; justify-content:space-between; gap:8px; font-size:13px; padding:4px 0; border-bottom:1px solid #ffffff0d; align-items:center; flex-wrap:wrap; }
        #coopBox .bar { height:8px; background:#ffffff14; border-radius:5px; overflow:hidden; display:flex; } #coopBox .bar i { display:block; height:100%; }
        #coopBox .x { float:right; background:none; border:0; color:var(--mut); font-size:22px; cursor:pointer; line-height:1; }
        #coopBox .ok { color:var(--ok); } #coopBox .bad { color:var(--bad); }
      </style><div class="in"></div>`;
      el.onclick = e => { if (e.target === el) { open = false; el.remove(); } };
      document.body.appendChild(el);
    }
    return el.querySelector('.in');
  }

  function render() {
    if (!open) return;
    const el = box(), S = d.S();
    let h = `<button class="x" data-c="close">×</button><h2>🤝 Партньор</h2>`;
    if (!cloud.user || !cloud.user()) {
      h += `<p class="mut">Партньорството минава през облака. Влез с имейла си от бутона ☁️ горе (същият вход като за записите в облака), после се върни тук.</p><div class="row"><button class="btn" data-c="login">☁️ Вход</button></div>`;
      el.innerHTML = h; bind(el); return;
    }
    if (!S || !d.ready()) { h += '<p class="mut">Първо основи фирмата си и влез в града.</p>'; el.innerHTML = h; bind(el); return; }
    if (!st) { h += '<p class="mut">Зареждам…</p>'; el.innerHTML = h; bind(el); return; }
    const P = st.partner;
    if (!st.pair) {
      h += `<p class="mut">Всеки играе своята игра — своята карта и своето темпо. Партньорите си помагат: пари (подарък или заем), техника, материали и общи големи поръчки. Градовете на партньора се виждат на картата ти в <b style="color:${PCOL}">розово</b>.</p>
        <div class="card"><b>Имаш код от приятел?</b><div class="row"><input id="cpCode" maxlength="6" placeholder="КОД" style="text-transform:uppercase;width:110px"><button class="btn" data-c="join">Свържи се</button></div></div>
        <div class="card"><b>Или създай код и го дай на приятеля си</b><div class="row"><button class="btn2" data-c="create">🔑 Създай код</button></div></div>`;
    } else if (st.pair.status === 'waiting') {
      h += `<div class="card"><div class="mut">Дай този код на приятеля си. Той натиска „🤝 Партньор“ в своята игра и го въвежда.</div>
        <div style="font-size:34px;font-weight:900;letter-spacing:.2em;color:${PCOL};margin:8px 0">${esc(st.pair.code)}</div><div class="mut">Чакам партньора…</div></div>
        <div class="row"><button class="btn2" data-c="leave">Откажи кода</button></div>`;
    } else {
      const s = P?.snap;
      h += `<div class="card" style="border-color:${PCOL}">`;
      h += s ? `<div style="font-size:16px;font-weight:800"><span style="color:${PCOL}">${esc(s.ico)} ${esc(s.name)}</span> ${P.online ? '<span class="ok" style="font-size:13px">🟢 онлайн</span>' : `<span class="mut">⚪ ${P.at ? ago(P.at) : ''}</span>`}</div>
        <div class="mut">Ден ${s.day} · ${'★'.repeat(Math.round(s.rep))}${'☆'.repeat(5 - Math.round(s.rep))} · офис ниво ${s.office} · пари ${f(s.money)} € · стойност ${f(s.worth)} €${s.loan ? ` · кредит ${f(s.loan)} €` : ''}<br>
        Градове (${s.cities.length}): ${s.cities.slice(0, 12).map(id => esc(d.cityName(id)) + (id === s.hq ? ' ★' : '')).join(', ')}${s.cities.length > 12 ? '…' : ''} — <span style="color:${PCOL}">розови на картата ти</span>${(() => { const both = s.cities.filter(id => d.ownedCities().includes(id)); return both.length ? `<br>🏙️ Строите заедно в: <b>${both.map(id => esc(d.cityName(id))).join(', ')}</b> — в 3D града неговите обекти са с розов пръстен.` : ''; })()}</div>`
        : '<div class="mut">Партньорът още не е отворил играта след свързването.</div>';
      h += `</div><div class="row"><span class="mut">Името ти за партньора:</span><input id="cpName" value="${esc(myName())}" maxlength="24"><button class="btn2" data-c="name">Запази</button></div>`;
      // пари
      h += `<h3>💶 Пари <span class="mut">(имаш ${f(E().money)} €)</span></h3><div class="row"><input id="cpAmt" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="gift">🎁 Подари</button></div>
        <div class="row"><select id="cpH">${[6, 12, 24, 48, 72, 168].map(x => `<option value="${x}"${x === 24 ? ' selected' : ''}>връщане до ${x < 48 ? x + ' ч' : x / 24 + ' дни'}</option>`).join('')}</select>
        <select id="cpR">${[0, 2, 5, 10].map(x => `<option value="${x}"${x === 0 ? ' selected' : ''}>лихва ${x}%</option>`).join('')}</select><button class="btn2" data-c="loan">💸 Предложи заем</button></div>
        <div class="mut">Заемът тръгва, когато партньорът го приеме (дотогава парите се пазят — при отказ се връщат). Срокът е в реално време; ако не го върне навреме, неговата игра сама връща, колкото има.</div>`;
      // заеми
      const L = st.loans.filter(l => ['offered', 'open'].includes(l.status) || l.status === 'repaid');
      if (L.length) h += `<div class="card">${L.map(l => { const who = l.out ? `→ ${esc(partnerName())}` : `← ${esc(partnerName())}`, rest = l.owed - l.repaid;
        let b = '';
        if (l.status === 'offered') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="lact:${l.id}:accept">✅ Приеми</button><button class="btn2" data-c="lact:${l.id}:decline">Откажи</button>`;
        if (l.status === 'open') b = l.out ? `<button class="btn2" data-c="lact:${l.id}:forgive">Опрости</button>` : `<button class="btn" data-c="repay:${l.id}:${rest}">Върни ${f(rest)} €</button>`;
        return `<div class="led"><span>💸 Заем ${who} · ${f(l.amount)} € · ${l.rate_pct}% · ${l.status === 'offered' ? '⏳ чака отговор' : l.status === 'open' ? `остават <b>${f(rest)} €</b> · срок ${left(l.due_at)}` : '✅ изплатен'}</span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
      // техника
      const here = d.unitsHere(), cnt = {}; here.forEach(t => cnt[t] = (cnt[t] || 0) + 1);
      h += `<h3>🚜 Техника <span class="mut">(свободна в ${esc(d.cityName(S.cityId))})</span></h3>` + (Object.keys(cnt).length ? `<div class="card">${Object.entries(cnt).map(([t, n]) => `<div class="led"><span>${UNIT_TYPES[t]?.ico} ${UNIT_TYPES[t]?.nm} ×${n}</span><button class="btn2" data-c="unit:${t}">Изпрати 1</button></div>`).join('')}</div>` : '<div class="mut">Няма свободна техника в този град (заетата на обект не може да се праща).</div>');
      // материали
      const stock = Object.entries(E().s.stock || {}).filter(([k, q]) => q > 0 && MATERIALS[k]);
      h += `<h3>📦 Материали</h3>` + (stock.length ? `<div class="card">${stock.map(([k, q]) => `<div class="led"><span>${MATERIALS[k].ico} ${MATERIALS[k].nm} · ${Math.round(q * 100) / 100} ${MATERIALS[k].unit}</span><span class="row" style="margin:0"><input data-mq="${k}" inputmode="decimal" value="${Math.round(q * 100) / 100}" style="width:80px"><button class="btn2" data-c="mat:${k}">Изпрати</button></span></div>`).join('')}</div>` : '<div class="mut">Складът е празен.</div>');
      // общи поръчки
      h += `<h3>🏗️ Общи големи поръчки</h3><div class="mut">Започва единият, влагат и двамата. Щом се събере сумата, строежът трае определено време (реално), после всеки получава вложеното × множителя. Бонусът важи, ако и двамата са вложили поне 20%.</div>`;
      const busyKeys = new Set(st.megas.filter(m => m.status !== 'done').map(m => m.key));
      for (const m of st.megas) {
        const t = st.mega_types.find(x => x.key === m.key); if (!t) continue;
        const pm = Math.round(m.mine / t.cost * 100), pt = Math.round(m.theirs / t.cost * 100);
        h += `<div class="card"><div style="font-weight:800">${t.ico} ${esc(t.nm)} <span class="mut">· ×${t.mult}</span></div>
          <div class="bar" style="margin:6px 0"><i style="width:${pm}%;background:var(--acc)"></i><i style="width:${pt}%;background:${PCOL}"></i></div>
          <div class="mut">Ти: ${f(m.mine)} € (${pm}%) · ${esc(partnerName())}: ${f(m.theirs)} € (${pt}%) · събрани ${f(m.total)} от ${f(t.cost)} €</div>
          ${m.status === 'forming' ? `<div class="row"><input data-mp="${m.id}" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="put:${m.id}">Вложи</button></div>`
            : m.status === 'building' ? `<div class="mut" style="margin-top:4px">🏗️ Строи се — готово след <b>${left(m.ends_at)}</b>. Награда за теб: ~${f(Math.floor(m.mine * (m.mine >= t.cost * 0.2 && m.theirs >= t.cost * 0.2 ? t.mult : 1)))} €</div>`
            : `<div class="row"><button class="btn" data-c="claim:${m.id}">🏆 Вземи наградата</button></div>`}</div>`;
      }
      h += `<div class="card">${st.mega_types.map(t => `<div class="led"><span>${t.ico} <b>${esc(t.nm)}</b> · ${f(t.cost)} € · ${t.minutes < 60 ? t.minutes + ' мин' : t.minutes / 60 + ' ч'} · ×${t.mult}<br><span class="mut">${esc(t.descr)}</span></span>${busyKeys.has(t.key) ? '<span class="mut">в ход</span>' : `<button class="btn2" data-c="mega:${t.key}">Започни</button>`}</div>`).join('')}</div>`;
      // история
      const KN = { gift: '🎁 подарък', loan: '💸 заем', repay: '💸 връщане', refund: '↩️ върнато', unit: '🚜 техника', mat: '📦 материали', mega: '🏗️ поръчка' };
      if (st.history.length) h += `<h3>📜 История</h3><div class="card">${st.history.map(x => { const D = x.data || {};
        const what = x.kind === 'unit' ? `${UNIT_TYPES[D.type]?.ico || ''} ${UNIT_TYPES[D.type]?.nm || D.type}` : x.kind === 'mat' ? `${MATERIALS[D.mat]?.ico || ''} ${D.qty} ${MATERIALS[D.mat]?.unit || ''} ${MATERIALS[D.mat]?.nm || D.mat}` : `${f(D.amount || 0)} €`;
        return `<div class="led"><span>${x.out ? '→' : '←'} ${KN[x.kind] || x.kind} · ${what}</span><span class="mut">${ago(x.at)}${x.status === 'sent' ? ' · ⏳' : ''}</span></div>`; }).join('')}</div>`;
      h += `<div class="row" style="margin-top:12px"><button class="btn2" data-c="leave">Прекрати партньорството</button></div>`;
    }
    el.innerHTML = h; bind(el);
  }

  const num = v => +String(v || '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, '');
  function bind(el) {
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
      if (busy) return;
      const [c, a, x] = b.dataset.c.split(':');
      if (c === 'close') { open = false; document.getElementById('coopBox')?.remove(); return; }
      if (c === 'login') { open = false; document.getElementById('coopBox')?.remove(); document.getElementById('cloudBtn')?.click(); return; }
      busy = true; b.disabled = true;
      try { await act(c, a, x, el); } catch (e) { d.toast('📶 ' + (e?.message || 'Грешка при връзката.'), 'bad'); }
      busy = false; await tick();
    });
  }

  async function act(c, a, x, el) {
    const amtIn = () => Math.round(num(el.querySelector('#cpAmt')?.value));
    const money = n => { if (!(n > 0)) { d.toast('Въведи сума.', 'bad'); return false; } if (E().money < n) { d.toast(`Нямаш ${f(n)} €.`, 'bad'); return false; } return true; };
    const say = r => { if (r && r.ok === false) d.toast(r.msg, 'bad'); return r && r.ok !== false; };
    if (c === 'create') return say(await rpc('coop_create'));
    if (c === 'join') { const r = await rpc('coop_join', { p_code: el.querySelector('#cpCode').value }); if (say(r)) d.toast('🤝 Свързани сте! Градовете на партньора ще се появят на картата ти в розово.', 'good'); return; }
    if (c === 'leave') { d.modal('Прекрати партньорството?', 'Пратките, които вече са тръгнали, ще пристигнат. После ще можете да се свържете отново с нов код.', [['Не', null], ['Прекрати', async () => { await rpc('coop_leave'); await tick(); }]]); return; }
    if (c === 'name') { try { localStorage.setItem(NAME, el.querySelector('#cpName').value.trim().slice(0, 24)); } catch {} lastSnap = 0; d.toast('Името е запазено.'); return; }
    if (c === 'gift') { const n = amtIn(); if (!money(n)) return; E().spend(n, 'партньор', `🎁 Подарък за ${partnerName()}`);
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'gift', p_data: { amount: n } }, refund: { money: n } }); if (r?.ok) d.toast(`🎁 Изпрати ${f(n)} € на ${partnerName()}.`, 'good'); d.renderPanel(); return; }
    if (c === 'loan') { const n = amtIn(); if (!money(n)) return; E().spend(n, 'партньор', `💸 Заем за ${partnerName()} (чака приемане)`);
      const r = await queue({ fn: 'coop_loan', args: { p_req: uid(), p_amount: n, p_hours: +el.querySelector('#cpH').value, p_rate_pct: +el.querySelector('#cpR').value }, refund: { money: n } });
      if (r?.ok) d.toast(`💸 Предложи заем ${f(n)} € — парите тръгват, когато ${partnerName()} приеме.`, 'good'); d.renderPanel(); return; }
    if (c === 'lact') { const r = await rpc('coop_loan_act', { p_loan: +a, p_action: x }); if (say(r)) d.toast({ accept: '💸 Заемът е приет — парите идват.', decline: 'Заемът е отказан — парите се връщат на партньора.', cancel: 'Заемът е оттеглен — парите се връщат.', forgive: '🎁 Опрости заема.' }[x], 'good'); return; }
    if (c === 'repay') { const n = Math.min(+x, Math.floor(E().money)); if (!money(n)) return; E().spend(n, 'партньор', `Връщане на заем към ${partnerName()}`);
      const r = await queue({ fn: 'coop_repay', args: { p_req: uid(), p_loan: +a, p_amount: n }, refund: { money: n } }); if (r?.ok) d.toast(`💸 Върна ${f(r.paid)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'unit') { if (!d.takeUnit(a)) return d.toast('Няма свободна такава техника тук.', 'bad');
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'unit', p_data: { type: a, n: 1 } }, refund: { unit: a } }); if (r?.ok) d.toast(`🚚 ${UNIT_TYPES[a].ico} ${UNIT_TYPES[a].nm} пътува към ${partnerName()}.`, 'good'); return; }
    if (c === 'mat') { const have = E().s.stock[a] || 0, q = Math.min(have, Math.round(num(el.querySelector(`[data-mq="${a}"]`)?.value) * 100) / 100);
      if (!(q > 0)) return d.toast('Въведи количество.', 'bad');
      E().s.stock[a] = Math.round((have - q) * 100) / 100;
      const r = await queue({ fn: 'coop_send', args: { p_req: uid(), p_kind: 'mat', p_data: { mat: a, qty: q } }, refund: { mat: a, qty: q } }); if (r?.ok) d.toast(`📦 ${MATERIALS[a].nm}: ${q} ${MATERIALS[a].unit} → ${partnerName()}.`, 'good'); d.renderPanel(); return; }
    if (c === 'mega') { const r = await rpc('coop_mega_start', { p_key: a }); if (say(r)) d.toast('🏗️ Поръчката е започната — вложи пари и кажи на партньора.', 'good'); return; }
    if (c === 'put') { const n = Math.round(num(el.querySelector(`[data-mp="${a}"]`)?.value)); if (!money(n)) return; E().spend(n, 'партньор', 'Вноска в обща поръчка');
      const r = await queue({ fn: 'coop_mega_put', args: { p_req: uid(), p_mega: +a, p_amount: n }, refund: { money: n } });
      if (r?.ok) d.toast(r.building ? '🏗️ Сумата е събрана — строежът започна!' : `Вложи ${f(r.put)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'claim') { const r = await rpc('coop_mega_claim', { p_mega: +a }); if (!say(r)) return;
      E().earn(r.reward, 'партньор', `${r.nm} — обща поръчка`); d.save(); d.renderPanel();
      d.toast(`${r.ico} ${r.nm} е готов! +${f(r.reward)} €${r.fair ? '' : ' (без бонус — единият е вложил под 20%)'}`, 'good'); return; }
  }

  if (!AUTOTEST) {
    setTimeout(() => { mount(); tick(); }, 1500);
    setInterval(() => { if (document.visibilityState === 'visible') tick(); }, POLL);
  }
  window.__coopDbg = () => ({ partner: st?.partner?.snap?.name, sites: st?.partner?.snap?.sites, marks: lastMarks, here: d.ready() && d.cityId() });
  return { tick, state: () => st };
}
