// coop.js — 🤝 ПАРТНЬОРСТВО в самостоятелната игра. Всеки играе своята игра (своята карта, време и скорост),
// а двамата партньори си помагат през облака (Supabase, public.coop_* функции — миграция 20261014070000_coop.sql):
//   • пари — подарък или заем (заемът се предлага, партньорът приема; връща се до срока, иначе играта сама го връща);
//   • техника и материали — от твоя град/склад в неговия;
//   • общи големи поръчки — и двамата влагат, след срока всеки получава вложеното + половината от печалбата (ако и двамата са вложили ≥ 20%);
//   • партньорът на картата — градовете му са със син пръстен (оранжев, ако твоята марка е синя) и името му; вижда се дали е онлайн;
//   • холдинг (част 3, миграция 20261014100000_coop3.sql): 40% от печалбата на поръчките, спасяване от фалит на 10-ия ден на минус,
//     дивидент 30% в края на всеки игрален месец, акции на борсата (след одобрение и от двамата). Общите строежи са лилави.
// Сървърът е „пощата“: всяка пратка се записва веднъж (req_id) и се получава веднъж (claim). Изпращачът първо вади
// парите/техниката от своята игра и пази заявката в localStorage, докато сървърът я потвърди — при срив се праща пак
// със същия req_id (без двойно изпращане); при отказ от сървъра се връща обратно.
import { UNIT_TYPES, MATERIALS } from './economy.js';

let PCOL = '#2f8cff';   // цветът на партньора: син, а ако твоята марка е синя — оранжев (pickCol)
const JCOL = '#b45cff';   // общ строеж — лилав
const ORDER_SHARE = 0.4, PROFIT_OF = 0.67;   // 40% от печалбата на поръчката (≈ сумата без материалите, ~⅓) → холдинга
const hueOf = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (c < 0.15) return null; const h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4; return (h * 60 + 360) % 360; };
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
  let st3 = null, st2 = null, tab = 'help', lastMarks = 0, st = null, open = false, busy = false, lastSnap = 0, user = null, applying = false;
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
      if (i >= tries || /not_authenticated|JWT|permission|PGRST202|Could not find the function/i.test((r.error.message || '') + (r.error.code || ''))) throw r.error;
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
      cities: d.ownedCities().filter(Boolean).slice(0, 80), sites: sites(), stats: d.stats(),
      hwDone: d.hwInfo().done.slice(0, 200), hwJobs: d.hwInfo().jobs.map(j => j.seg), rails: d.rails().map(r => r.ref).slice(0, 200),
      railKm: Object.fromEntries(d.rails().slice(0, 200).map(r => [r.ref, r.km])),
      infra: d.infra ? d.infra() : {},   // { град: [гара, летище, пристанище] } — партньорът ги развива заедно с теб
      lv: d.lv ? d.lv() : null };   // нивото на фирмата (неограничено) — общото ниво (флаг coop-lv, devlevel.js)
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
  function pickCol() { const h = hueOf(d.brand()?.col); PCOL = h != null && h >= 185 && h <= 265 ? '#ff8a1f' : '#2f8cff'; window.__coopCol = PCOL; }
  // партньорът в моя 3D град: ако строи в същия град — пръстени в неговия цвят и табелки на парцелите му
  function markPartner() {
    if (!d.ready()) return;
    const P = st?.partner?.snap, id = d.cityId();
    const gifts = (st2?.surprises_for_me || []).filter(s => s.city === id).map(s => ({ x: +s.x, z: +s.z, k: 'g', text: s.text }));
    lastMarks = d.mark([...(P && P.sites && P.sites[id] || []), ...gifts], P ? P.name : '', PCOL) || 0;
  }

  // ── опашката от неизпратени пратки (оцелява при презареждане) ──
  // op: { fn, args, refund: { money } | { unit } | { mat, qty }, what }
  async function runOp(op) {
    let r;
    try { r = await rpc(op.fn, op.args); } catch (e) {
      if (!/PGRST202|Could not find the function/i.test((e?.message || '') + (e?.code || ''))) return false;   // остава в опашката — ще опита пак
      r = { ok: false, msg: 'Сървърът още не поддържа това — парите се връщат.' };   // старият сървър (без новата функция) → връщане, не вечно чакане
    }
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
            else d.toast(D.rental ? `🏢 ${t.ico} ${t.nm} под наем от ${pn} — връща се сам след срока.` : r.note === 'Върната от наем' || /Върната/.test(r.note || '') ? `🚚 ${t.ico} ${t.nm} се върна при теб.` : `🤝 ${pn} ти прати ${t.ico} ${t.nm.toLowerCase()}!`, 'good');
          }
        } else if (r.kind === 'mat') {
          const m = MATERIALS[D.mat]; if (!m) continue;
          E().s.stock[D.mat] = (E().s.stock[D.mat] || 0) + +D.qty;
          d.toast(`🤝 ${pn} ти прати ${m.ico} ${D.qty} ${m.unit} ${m.nm.toLowerCase()}.`, 'good');
        } else if (+D.amount > 0) {
          const amt = Math.round(+D.amount);
          if (r.kind === 'vault' && /Дивидент/i.test(r.note || '') && +D.amount > 0) d.modal('🏦 Холдингът разпредели печалбата', `Твоят дял от месечния дивидент: <b>+${f(Math.round(+D.amount))} €</b>.<br>${esc(r.note || '')}`, [['Супер! 💰', null]]);
        const why = { gift: `🎁 Подарък от ${pn}`, loan: `💸 Заем от ${pn} — върни ${f(D.owed)} € до ${D.hours} ч`, repay: `💸 ${pn} върна по заема`, refund: r.note || 'Върнати пари', mega: 'Обща поръчка', rent: `🏢 ${pn} плати наем за ${UNIT_TYPES[D.type]?.nm.toLowerCase() || 'техника'}`, vault: r.note || '🏦 От общата касичка' }[r.kind] || 'Партньор';
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

  // 🗺️ обща карта: магистралите, жп линиите и градовете на партньора стават част от твоята карта (game.js: hwAll, railEdges, coopCity)
  let shareSig = '';
  function shareMap() {
    const P = st?.pair?.status === 'active' ? st?.partner?.snap : null;
    if (!P) { if (window.__coopShared) { window.__coopShared = null; shareSig = ''; } return; }
    const hw = (P.hwDone || []).filter(x => typeof x === 'string' || typeof x === 'number'),
      rails = (P.rails || []).map(r => String(r).split('|')).filter(x => x.length === 2 && x[0] && x[1]),
      cities = (P.cities || []).filter(x => typeof x === 'string'), infra = P.infra && typeof P.infra === 'object' ? P.infra : {}, sig = JSON.stringify([P.name, hw, rails, cities, infra]);
    if (sig === shareSig) return;
    shareSig = sig;
    window.__coopShared = { v: (window.__coopShared?.v || 0) + 1, name: P.name || 'партньора', hw, rails, cities, infra };
    try { d.infraSync && d.infraSync(infra, P.name || 'партньора'); } catch (e) { console.warn('coop infra', e); }
  }
  async function tick() {
    if (AUTOTEST) return;
    user = sb && cloud.user && cloud.user();
    if (!user) { st = null; mount(); return; }
    for (const op of pend()) await runOp(op);   // недоизпратените от миналия път
    try {
      if (d.ready() && Date.now() - lastSnap > SNAP_EVERY) { lastSnap = Date.now(); await rpc('coop_snap', { p_data: snapshot() }, 1); }
      const r = await rpc('coop_status', {}, 1);
      pickCol();
      const before = JSON.stringify([st?.partner?.snap?.cities || [], st2?.joints || [], window.__coopShared?.v, PCOL]);
      st = r && r.ok ? r : st;
      const r2 = st?.pair?.status === 'active' ? await rpc('coop_status2', {}, 1) : null;
      st2 = r2 && r2.ok && r2.active ? r2 : null;
      const r3 = st2 ? await rpc('coop_status3', {}, 1).catch(() => null) : null;
      st3 = r3 && r3.ok && r3.active ? r3 : null;
      shareMap();
      const J = (st2?.joints || []).filter(j => j.status === 'active');
      window.__coopJoint = st2 ? { hw: new Set(J.filter(j => j.kind === 'hw').map(j => j.ref)), rail: new Set(J.filter(j => j.kind === 'rail').map(j => j.ref)) } : null;
      if (JSON.stringify([st?.partner?.snap?.cities || [], st2?.joints || [], window.__coopShared?.v, PCOL]) !== before) d.drawMap();
    } catch { }
    await receive();
    await autoRepay();
    await partTwo();
    markPartner();
    mount();
    const f0 = document.activeElement;   // не прерисува, докато пишеш в поле
    if (open && !(f0 && f0.closest && f0.closest('#coopBox') && /INPUT|SELECT|TEXTAREA/.test(f0.tagName))) render();
  }

  // ── част 2: чат, бонуси от общи обекти, връщане на наета техника, изненади ──
  const LS = (k, v) => { try { if (v === undefined) return +localStorage.getItem(k) || 0; localStorage.setItem(k, v); } catch { return 0; } };
  const unread = () => (st2?.messages || []).filter(m => !m.me && m.id > LS('stroi-coop-read')).length;
  const seenGift = {}, warnedRent = {};
  async function partTwo() {
    if (!st2) return;
    // нови съобщения от партньора → известие (🆘 — червено)
    const last = LS('stroi-coop-msg');
    for (const m of st2.messages) if (!m.me && m.id > last) d.toast(`${m.sos ? '🆘' : '💬'} ${partnerName()}: ${m.text}`, m.sos ? 'bad' : 'good', () => { tab = 'chat'; open = true; render(); });
    const mx = Math.max(last, ...st2.messages.map(m => m.id)); if (mx > last) LS('stroi-coop-msg', mx);
    if (!d.ready()) return;
    // общ участък/линия, завършен (от единия — картата е обща) → еднократен бонус за всеки
    for (const j of st2.joints) if (j.status === 'active' && j.done && !j.bonus_claimed) {
      const r = await rpc('coop_joint_bonus', { p_id: j.id }, 1).catch(() => null);
      if (r?.ok) { E().earn(r.amount, 'партньор', `🤝 Общ обект: ${r.title}`); d.save(); d.renderPanel(); d.toast(`🤝 ${r.title} е готов и при двама ви! Бонус +${f(r.amount)} €, а всеки ден — още доход.`, 'good'); }
    }
    // наета техника: срокът изтече → връща се сама (щом е свободна)
    for (const r of st2.rentals) if (!r.out && r.status === 'active' && r.until && Date.parse(r.until) <= Date.now()) {
      if (!d.takeUnit(r.type)) { if (!warnedRent[r.id]) { warnedRent[r.id] = 1; d.toast(`⏰ Наемът на ${UNIT_TYPES[r.type]?.nm.toLowerCase()} изтече — ще се върне при ${partnerName()}, щом се освободи от обекта.`, 'bad'); } continue; }
      await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: r.id, p_action: 'return' }, refund: { unit: r.type } });
      d.toast(`🚚 ${UNIT_TYPES[r.type]?.ico} ${UNIT_TYPES[r.type]?.nm} се върна при ${partnerName()} (наемът изтече).`);
    }
    // изненади в града, в който си: виждаш кутията няколко секунди, после я „отваряш“
    for (const s of st2.surprises_for_me) {
      if (s.city !== d.cityId()) continue;
      seenGift[s.id] = seenGift[s.id] || Date.now();
      if (Date.now() - seenGift[s.id] < 6000) continue;
      const r = await rpc('coop_surprise_find', { p_id: s.id }, 1).catch(() => null);
      if (r?.ok) { if (r.amount > 0) E().earn(r.amount, 'партньор', `🎁 Изненада от ${partnerName()}`); d.save(); d.renderPanel();
        d.modal(`🎁 Изненада от ${esc(partnerName())}!`, `„${esc(r.text)}“${r.amount > 0 ? `<br><br>+${f(r.amount)} €` : ''}`, [['Благодаря! 💖', null]]); }
    }
  }
  const activeJoints = kind => (st2?.joints || []).filter(j => j.status === 'active' && j.kind === kind);
  // общ участък: докато и партньорът го строи (или вече го е построил) — твоят върви 30% по-бързо
  window.__coopHwMul = seg => { const P = st?.partner?.snap; return activeJoints('hw').some(j => j.ref === seg) && P && ((P.hwJobs || []).includes(seg) || (P.hwDone || []).includes(seg)) ? 1.3 : 1; };
  // всеки игрален ден: доход от завършените общи обекти (магистрала 3 €/км, влак 8 €/км)
  window.__coopDay = () => {
    const sum = [...activeJoints('hw'), ...activeJoints('rail')].filter(j => j.done).reduce((a, j) => a + j.km * (j.kind === 'hw' ? 3 : 8), 0);
    if (sum > 0) E().earn(sum, 'партньор', `🤝 Общи магистрали и влакове с ${partnerName()}`);
    holdDay();
  };
  // 🏦 холдингът всеки игрален ден: спасяване от фалит (10-ия ден на минус) и дивидент в края на месеца
  function holdDay() {
    const S = d.S(), b = S?.bust; if (!S || !st2) return;
    if (b && b.red === 0) delete b.coopBail;
    if (b && b.red >= 10 && E().money < 0 && !b.coopBail) {
      b.coopBail = true; const debt = Math.ceil(-E().money);
      rpc('coop_vault2', { p_req: uid(), p_amount: -debt, p_kind: 'bailout' }, 2).then(r => {
        if (r?.ok) d.toast(`🏦 Холдингът покрива дълга ти: ${f(-r.amount)} € — идват след миг. ${partnerName()} е уведомен.`, 'good');
        else { b.coopBail = false; if (r?.err === 'no_money') d.toast('🏦 Холдингът е празен — не може да покрие дълга. Помоли партньора (🆘).', 'bad'); }
      }).catch(() => { b.coopBail = false; });
    }
    if (S.day % 30 === 0) rpc('coop_dividend', {}, 1).then(r => {
      if (r?.ok && r.paid > 0) d.toast(`🏦 Месечен дивидент: холдингът раздаде ${f(r.paid)} € (30% от печалбата) — по ${f(r.each)} € на двамата${r.investors ? `, ${f(r.investors)} € на акционерите` : ''}.`, 'good');
      if (r?.ok && r.paid > 0) d.modal('🏦 Холдингът разпредели печалбата', `Месечен дивидент: <b>${f(r.paid)} €</b> (30% от печалбата) — по <b>${f(r.each)} €</b> за теб и за ${esc(partnerName())}.`, [['Супер! 💰', null]]);
    }).catch(() => {});
  }
  // 🏁 завършените градове (economy.js payFinished): 40% от дневния им приход → общия холдинг
  window.__coopFinished = amount => {
    if (!st2 || !(amount > 0)) return;
    const share = Math.round(amount * ORDER_SHARE);
    if (share <= 0) return;
    E().spend(share, 'партньор', `🏦 40% от завършените градове → холдинга`);
    queue({ fn: 'coop_vault2', args: { p_req: uid(), p_amount: share, p_kind: 'order' }, refund: { money: share } });
  };
  // 💼 поръчка, платена в моята игра → 40% от печалбата отиват в общия холдинг (вика го game.js при прибирането на парите)
  window.__coopOrder = (amount, title) => {
    if (!st2 || !(amount > 0)) return;
    const share = Math.round(amount * PROFIT_OF * ORDER_SHARE);
    if (share <= 0) return;
    E().spend(share, 'партньор', `🏦 40% от печалбата → холдинга: ${title}`);
    queue({ fn: 'coop_vault2', args: { p_req: uid(), p_amount: share, p_kind: 'order' }, refund: { money: share } })
      .then(r => { if (r?.ok) d.toast(`🏦 ${f(share)} € (40% от печалбата) → общия холдинг`, ''); });
  };

  // ── партньорът на картата: пръстен в неговия цвят около градовете му, звезда и име при централата ──
  window.__coopMap = (proj, k, cityById) => {
    const P = st?.partner?.snap; if (!P || !P.cities) return '';
    let h = '<g class="coop-map" style="pointer-events:none">';
    const segs = d.segs();
    for (const j of st2?.joints || []) {   // общите участъци/линии: лилава линия (пунктир, докато не са готови)
      const [ia, ib] = j.kind === 'hw' ? (() => { const s = segs.find(q => q.id === j.ref); return s ? [s.a, s.b] : []; })() : j.ref.split('|');
      const ca = ia && cityById(ia), cb = ib && cityById(ib); if (!ca || !cb) continue;
      const [x1, y1] = proj(ca.lon, ca.lat), [x2, y2] = proj(cb.lon, cb.lat);
      h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${JCOL}" stroke-width="${(j.done ? 3 : 2.2) * k}" stroke-dasharray="${j.done ? '' : `${5 * k} ${4 * k}`}" stroke-linecap="round" opacity="${j.status === 'active' ? 0.9 : 0.5}"/>`;
    }
    for (const id of P.cities) {
      const c = cityById(id); if (!c) continue;
      const [x, y] = proj(c.lon, c.lat), r = 6 * k, hq = id === P.hq;
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
    const P = st?.partner, n = (st?.inbox?.length || 0) + unread();
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
      h += `<p class="mut">Всеки играе своята игра — своята карта и своето темпо. Партньорите си помагат: пари (подарък или заем), техника, материали и общи големи поръчки. Градовете на партньора се виждат на картата ти в <b style="color:${PCOL}">синьо</b>.</p>
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
        Градове (${s.cities.length}): ${s.cities.slice(0, 12).map(id => esc(d.cityName(id)) + (id === s.hq ? ' ★' : '')).join(', ')}${s.cities.length > 12 ? '…' : ''} — <span style="color:${PCOL}">в този цвят на картата ти</span>${(() => { const both = s.cities.filter(id => d.ownedCities().includes(id)); return both.length ? `<br>🏙️ Строите заедно в: <b>${both.map(id => esc(d.cityName(id))).join(', ')}</b> — в 3D града неговите обекти са с пръстен в неговия цвят.` : ''; })()}</div>`
        : '<div class="mut">Партньорът още не е отворил играта след свързването.</div>';
      h += `</div><div class="row"><span class="mut">Името ти за партньора:</span><input id="cpName" value="${esc(myName())}" maxlength="24"><button class="btn2" data-c="name">Запази</button></div>`;
      const nU = unread();
      h += `<div class="row" style="margin:10px 0 4px">${[['help', '💶 Помощ'], ['build', '🛣️ Строим заедно'], ['quest', '🏆 Задачи'], ['hold', '🏦 Холдинг'], ['chat', `💬 Чат${nU ? ` <b style="color:var(--acc)">${nU}</b>` : ''}`]]
        .map(([k, nm]) => `<button class="${tab === k ? 'btn' : 'btn2'}" data-c="tab:${k}">${nm}</button>`).join('')}</div>`;
      if (tab === 'help') {
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
      // история
        const KN = { gift: '🎁 подарък', loan: '💸 заем', repay: '💸 връщане', refund: '↩️ върнато', unit: '🚜 техника', mat: '📦 материали', mega: '🏗️ поръчка' };
        if (st.history.length) h += `<h3>📜 История</h3><div class="card">${st.history.map(x => { const D = x.data || {};
          const what = x.kind === 'unit' ? `${UNIT_TYPES[D.type]?.ico || ''} ${UNIT_TYPES[D.type]?.nm || D.type}` : x.kind === 'mat' ? `${MATERIALS[D.mat]?.ico || ''} ${D.qty} ${MATERIALS[D.mat]?.unit || ''} ${MATERIALS[D.mat]?.nm || D.mat}` : `${f(D.amount || 0)} €`;
          return `<div class="led"><span>${x.out ? '→' : '←'} ${KN[x.kind] || x.kind} · ${what}</span><span class="mut">${ago(x.at)}${x.status === 'sent' ? ' · ⏳' : ''}</span></div>`; }).join('')}</div>`;
      } else if (tab === 'build') h += buildHtml();
      else if (tab === 'quest') h += questHtml();
      else if (tab === 'hold') h += holdHtml();
      else if (tab === 'chat') { h += chatHtml(); const mx = Math.max(0, ...(st2?.messages || []).map(m => m.id)); if (mx) LS('stroi-coop-read', mx); }
      h += `<div class="row" style="margin-top:12px"><button class="btn2" data-c="leave">Прекрати партньорството</button></div>`;
    }
    el.innerHTML = h; bind(el);
  }

  // ── раздел „Строим заедно“: общи участъци/линии, наем, изненада, общи поръчки ──
  function buildHtml() {
    const S = d.S(), P = st.partner?.snap || {}, pn = esc(partnerName());
    let h = `<div class="mut">Изберете участък от магистрала или жп линия и го строите <b>заедно</b> — картата ви е обща. Докато и двамата работите по участъка, всеки строи <b>30% по-бързо</b>; щом единият го завърши, готов е и при другия. Тогава всеки получава еднократен бонус (магистрала 1 500 €/км, влак 800 €/км) и всеки ден допълнителен доход (3 €/км и 8 €/км). На картата е с лилава линия.</div>`;
    const J = st2?.joints || [];
    if (J.length) h += `<div class="card">${J.map(j => { const ico = j.kind === 'hw' ? '🛣️' : '🚆';
      let b = '';
      if (j.status === 'proposed') b = j.mine ? `<button class="btn2" data-c="jact:${j.id}:end">Оттегли</button>` : `<button class="btn" data-c="jact:${j.id}:accept">✅ Приеми</button><button class="btn2" data-c="jact:${j.id}:decline">Откажи</button>`;
      else b = `<button class="btn2" data-c="jact:${j.id}:end">Прекрати</button>`;
      const st_ = j.status === 'proposed' ? (j.mine ? '⏳ чака партньора' : `📨 ${pn} предлага`) : j.done ? '<b class="ok">✅ готово — общо за двамата</b>' : `ти: ${j.me_done ? '✅' : '🏗️'} · ${pn}: ${j.they_done ? '✅' : '🏗️'}`;
      return `<div class="led"><span>${ico} <b>${esc(j.title)}</b> · ${j.km} км<br><span class="mut">${st_}</span></span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
    const done = d.hwInfo().done, segs = d.segs().filter(s => !J.some(j => j.kind === 'hw' && j.ref === s.id));
    h += `<div class="row"><select id="cpSeg" style="max-width:100%">${segs.map(s => `<option value="${s.id}">${esc(s.nm)}: ${esc(d.cityName(s.a))} — ${esc(d.cityName(s.b))} · ${s.km} км${done.includes(s.id) ? ' ✅' : ''}${(P.hwDone || []).includes(s.id) ? ' (той ✅)' : ''}</option>`).join('')}</select><button class="btn2" data-c="jhw">🛣️ Предложи обща магистрала</button></div>`;
    const myR = d.rails(), rail = new Map(myR.map(r => [r.ref, r.km]));
    for (const [ref, km] of Object.entries(P.railKm || {})) if (!rail.has(ref)) rail.set(ref, km);
    const rOpts = [...rail].filter(([ref]) => !J.some(j => j.kind === 'rail' && j.ref === ref));
    h += rOpts.length ? `<div class="row"><select id="cpRail">${rOpts.map(([ref, km]) => { const [a, b] = ref.split('|'); return `<option value="${ref}|${km}">${esc(d.cityName(a))} — ${esc(d.cityName(b))} · ${km} км${myR.some(r => r.ref === ref) ? ' (твоя ✅)' : ''}${(P.rails || []).includes(ref) ? ' (негова ✅)' : ''}</option>`; }).join('')}</select><button class="btn2" data-c="jrail">🚆 Предложи общ влак</button></div>`
      : '<div class="mut">🚆 Общ влак: когато някой от вас построи жп линия, тя ще се появи тук.</div>';
    // наем на техника
    const cnt = {}; d.unitsHere().forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    h += `<h3>🏢 Наем на техника</h3><div class="mut">Даваш машина или бригада под наем за определено време (реално) — партньорът плаща наема наведнъж и после тя се връща сама. Цена 0 = <b>помощна бригада/машина</b>.</div>`;
    h += Object.keys(cnt).length ? `<div class="row"><select id="cpRT">${Object.entries(cnt).map(([x, n]) => `<option value="${x}">${UNIT_TYPES[x]?.ico} ${UNIT_TYPES[x]?.nm} (свободни ${n})</option>`).join('')}</select>
      <select id="cpRH">${[2, 6, 12, 24, 48, 72].map(x => `<option value="${x}"${x === 12 ? ' selected' : ''}>за ${x} ч</option>`).join('')}</select><input id="cpRP" inputmode="numeric" placeholder="наем € (0 = помощ)" style="width:150px"><button class="btn2" data-c="rent">📤 Предложи</button></div>` : '<div class="mut">Няма свободна техника в този град.</div>';
    const R = (st2?.rentals || []).filter(r => r.status !== 'declined');
    if (R.length) h += `<div class="card">${R.map(r => { const u = UNIT_TYPES[r.type] || {}; let b = '';
      if (r.status === 'offered') b = r.out ? `<button class="btn2" data-c="ract:${r.id}:cancel">Оттегли</button>` : `<button class="btn" data-c="rpay:${r.id}:${r.price}">✅ Наеми${r.price ? ` за ${f(r.price)} €` : ' (безплатно)'}</button><button class="btn2" data-c="ract:${r.id}:decline">Откажи</button>`;
      if (r.status === 'active' && !r.out) b = `<button class="btn2" data-c="rback:${r.id}:${r.type}">Върни сега</button>`;
      const s_ = r.status === 'offered' ? (r.out ? '⏳ чака отговор' : `📨 ${pn} предлага`) : r.status === 'active' ? `при ${r.out ? pn : 'теб'} още ${left(r.until)}` : '✅ върната';
      return `<div class="led"><span>${u.ico || ''} ${u.nm || r.type} ${r.out ? '→' : '←'} · ${r.hours} ч · ${r.price ? f(r.price) + ' €' : 'помощ'}<br><span class="mut">${s_}</span></span><span class="row" style="margin:0">${b}</span></div>`; }).join('')}</div>`;
    // изненада в общ град
    const shared = (P.cities || []).includes(S.cityId);
    h += `<h3>🎁 Изненада в общ град</h3>` + (shared ? `<div class="mut">Остави табела (и подарък, ако искаш) на парцел в ${esc(d.cityName(S.cityId))} — ${pn} ще види кутия-подарък, когато влезе в града, и ще я отвори.</div>
      <div class="row"><input id="cpST" maxlength="60" placeholder="Текст на табелата" style="width:200px"><input id="cpSA" inputmode="numeric" placeholder="подарък € (по желание)" style="width:150px"><button class="btn2" data-c="surp">🎁 Остави тук</button></div>`
      : `<div class="mut">Отиди в град, в който и ${pn} има фирма${(P.cities || []).length ? ` (${(P.cities || []).slice(0, 5).map(id => esc(d.cityName(id))).join(', ')})` : ''}, за да оставиш изненада.</div>`);
    const SM = st2?.surprises_mine || [];
    if (SM.length) h += `<div class="card">${SM.map(s => `<div class="led"><span>🎁 ${esc(d.cityName(s.city))} · „${esc(s.text)}“${s.amount ? ` · ${f(s.amount)} €` : ''}</span><span class="mut">${s.status === 'found' ? '✅ намерена' : '⏳ чака'}</span></div>`).join('')}</div>`;
    return h + megaHtml();
  }
  function questHtml() {
    const Q = st2?.quests || [];
    let h = `<div class="mut">Общи задачи — напредъкът е сборът от двете игри. Всеки от вас взема наградата. Изпълните ли една, идва нова (и по-трудна).</div>`;
    h += Q.map(q => { const pc = Math.min(100, Math.round(q.progress / q.target * 100));
      return `<div class="card"><div style="font-weight:800">🏆 ${esc(q.nm)}</div><div class="bar" style="margin:6px 0"><i style="width:${pc}%;background:${q.status === 'done' ? 'var(--ok)' : PCOL}"></i></div>
        <div class="led" style="border:0"><span class="mut">${q.key === 'money' ? f(q.progress) + ' / ' + f(q.target) + ' €' : q.progress + ' / ' + q.target} · награда <b>${f(q.reward)} €</b> за всеки</span>${q.status === 'done' && !q.claimed ? `<button class="btn" data-c="qclaim:${q.id}">🏆 Вземи</button>` : q.claimed ? '<span class="ok">✅ взета</span>' : ''}</div></div>`; }).join('') || '<div class="mut">Зареждам задачите…</div>';
    return h;
  }
  function holdHtml() {
    const V = st2?.vault || { balance: 0, log: [] }, T = st2?.tandems || [];
    let h = `<div class="card" style="border-color:${PCOL}"><div style="font-weight:800;font-size:16px">🏦 ${esc(V.name || 'Вашият холдинг')}</div>
      <div class="mut">Обща касичка — внасяте и двамата, тегли всеки при нужда. Стойността ѝ се брои в класацията на тандемите.</div>
      <div style="font-size:24px;font-weight:900;color:var(--acc);margin:6px 0">${f(V.balance)} €</div>
      <div class="row"><input id="cpV" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="vput">⬆️ Внеси</button><button class="btn2" data-c="vtake">⬇️ Изтегли</button></div>
      <div class="row"><input id="cpVN" maxlength="40" placeholder="Име на холдинга" value="${esc(V.name || '')}" style="width:200px"><button class="btn2" data-c="vname">Запази името</button></div>
      ${holdInfo()}
      ${(st3?.log || V.log || []).map(l => `<div class="led"><span>${logTxt(l)}</span><span class="${l.amount > 0 ? 'ok' : 'bad'}">${l.amount > 0 ? '+' : ''}${f(l.amount)} € · ${ago(l.at)}</span></div>`).join('')}</div>`;
    h += `<h3>🏆 Най-силен тандем</h3><div class="mut">Стойността на двете фирми + касичката.</div><div class="card">${T.map((x, i) => `<div class="led" style="${x.me ? `color:${PCOL};font-weight:800` : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(x.name)}${x.me ? ' (вие)' : ''}</span><b>${f(x.worth)} €</b></div>`).join('') || '<div class="mut">Още няма тандеми.</div>'}</div>`;
    return h;
  }
  const KIND_TXT = { order: '40% от поръчка', ipo: 'от акциите на борсата', dividend: 'дивидент (30%)', bailout: 'покри дълг' };
  const logTxt = l => { const who = l.kind === 'ipo' ? '📈 Инвеститори' : l.me ? 'Ти' : esc(partnerName());
    return l.kind === 'dividend' ? '🏦 Дивидент за двамата' : l.kind === 'bailout' ? `🛟 Холдингът спаси ${l.me ? 'теб' : esc(partnerName())}` : `${who} · ${l.kind && KIND_TXT[l.kind] ? KIND_TXT[l.kind] : l.amount > 0 ? 'внесе' : 'изтегли'}`; };
  function holdInfo() {
    if (!st3) return '';
    const I = st3.ipo, pp = st3.public_pct || 0;
    let h = `<div class="mut" style="margin:4px 0">💼 От всяка поръчка на двама ви 40% от печалбата идват тук · 🛟 на 10-ия ден на минус холдингът покрива дълга · 📅 в края на всеки игрален месец раздава 30% от печалбата (сега за месеца: <b>${f(st3.month_profit)} €</b>)${pp ? ` · 📈 ${pp}% от холдинга е на борсата` : ''}.</div>`;
    if (!d.stocksOpen?.()) return h + '<div class="mut">📈 Акции на борсата — щом отключиш борсата (ниво 7).</div>';
    if (I && I.status === 'proposed') h += `<div class="card">📈 ${I.mine ? 'Предложи' : `${esc(partnerName())} предлага`} холдингът да пусне <b>${I.pct}%</b> акции за <b>${I.hours / 24} д.</b>
      <div class="row">${I.mine ? '<button class="btn2" data-c="ipo:cancel">Оттегли</button>' : '<button class="btn" data-c="ipo:accept">✅ Одобри</button><button class="btn2" data-c="ipo:decline">Откажи</button>'}</div></div>`;
    else if (I && I.status === 'active') h += `<div class="card">📈 Акциите се продават: <b>${I.pct}%</b> · събрани ${f(I.raised)} от ~${f(I.target)} € · остават ${left(I.ends_at)}<div class="bar" style="margin-top:6px"><i style="width:${Math.min(100, I.raised / Math.max(1, I.target) * 100)}%;background:var(--acc)"></i></div></div>`;
    else if (pp < 49) h += `<div class="card">📈 <b>Пусни акции на борсата</b> — инвеститорите плащат постепенно през срока дял × касичката × 1.5. Партньорът трябва да одобри. Акционерите после получават своя дял от дивидента.
      <div class="row"><select id="cpIP">${[5, 10, 20, 30].filter(x => pp + x <= 49).map(x => `<option value="${x}">${x}%</option>`).join('')}</select><select id="cpIH"><option value="24">за 1 ден</option><option value="72">за 3 дни</option><option value="168">за 7 дни</option></select><button class="btn" data-c="ipo:propose">📈 Предложи</button></div></div>`;
    return h;
  }
  const QUICK = ['Трябва ми кран! 🏗️', 'Може ли малко пари? 💶', 'Да строим заедно? 🛣️', 'Благодаря! 💖'];
  function chatHtml() {
    const M = st2?.messages || [];
    let h = `<div class="card" id="cpChat" style="max-height:300px;overflow:auto">${M.map(m => `<div style="display:flex;justify-content:${m.me ? 'flex-end' : 'flex-start'};margin:4px 0"><div style="max-width:80%;padding:7px 11px;border-radius:12px;background:${m.sos ? '#ff6b6b33' : m.me ? '#ffb30022' : PCOL + '22'};border:1px solid ${m.sos ? 'var(--bad)' : 'var(--line)'}">${m.sos ? '🆘 ' : ''}${esc(m.text)}<div class="mut" style="font-size:11px">${m.me ? 'ти' : esc(partnerName())} · ${ago(m.at)}</div></div></div>`).join('') || '<div class="mut">Още няма съобщения. Кажи здрасти! 👋</div>'}</div>`;
    h += `<div class="row"><input id="cpMsg" maxlength="300" placeholder="Съобщение…" style="flex:1;min-width:160px"><button class="btn" data-c="say">Изпрати</button></div>
      <div class="row">${QUICK.map((q, i) => `<button class="btn2" data-c="quick:${i}" style="font-size:12px">${q}</button>`).join('')}</div>
      <div class="row"><button class="btn2" data-c="sos" style="border-color:var(--bad);color:#ffb3b3">🆘 Трябва ми помощ</button><span class="mut">— праща сигнал с парите ти (${f(E().money)} €)</span></div>`;
    return h;
  }
  function megaHtml() {
    let h = '';
      h += `<h3>🏗️ Общи големи поръчки</h3><div class="mut">Започва единият, влагат и двамата. Щом се събере сумата, строежът трае определено време (реално), после всеки получава вложеното + половината от печалбата (сумата × множителя − сумата). Бонусът важи, ако и двамата са вложили поне 20%.</div>`;
      const busyKeys = new Set(st.megas.filter(m => m.status !== 'done').map(m => m.key));
      for (const m of st.megas) {
        const t = st.mega_types.find(x => x.key === m.key); if (!t) continue;
        const pm = Math.round(m.mine / t.cost * 100), pt = Math.round(m.theirs / t.cost * 100);
        h += `<div class="card"><div style="font-weight:800">${t.ico} ${esc(t.nm)} <span class="mut">· ×${t.mult}</span></div>
          <div class="bar" style="margin:6px 0"><i style="width:${pm}%;background:var(--acc)"></i><i style="width:${pt}%;background:${PCOL}"></i></div>
          <div class="mut">Ти: ${f(m.mine)} € (${pm}%) · ${esc(partnerName())}: ${f(m.theirs)} € (${pt}%) · събрани ${f(m.total)} от ${f(t.cost)} €</div>
          ${m.status === 'forming' ? `<div class="row"><input data-mp="${m.id}" inputmode="numeric" placeholder="сума в €"><button class="btn" data-c="put:${m.id}">Вложи</button></div>`
            : m.status === 'building' ? `<div class="mut" style="margin-top:4px">🏗️ Строи се — готово след <b>${left(m.ends_at)}</b>. Награда за теб: ~${f(m.mine >= t.cost * 0.2 && m.theirs >= t.cost * 0.2 ? m.mine + Math.floor(m.total * (t.mult - 1) / 2) : m.mine)} €</div>`
            : `<div class="row"><button class="btn" data-c="claim:${m.id}">🏆 Вземи наградата</button></div>`}</div>`;
      }
      for (const m of (st3?.megas_done || []).filter(m => m.claimed)) h += `<div class="card" style="border-color:var(--ok)"><div style="font-weight:800">✅ Изпълнена поръчка: ${m.ico} ${esc(m.nm)}</div>
        <div class="mut">Обща сума ${f(m.total)} € · ти получи <b class="ok">${f(m.mine)} €</b> · ${esc(partnerName())} — <b>${f(m.theirs)} €</b> (вложеното + по равно от печалбата)</div></div>`;
      h += `<div class="card">${st.mega_types.map(t => `<div class="led"><span>${t.ico} <b>${esc(t.nm)}</b> · ${f(t.cost)} € · ${t.minutes < 60 ? t.minutes + ' мин' : t.minutes / 60 + ' ч'} · ×${t.mult}<br><span class="mut">${esc(t.descr)}</span></span>${busyKeys.has(t.key) ? '<span class="mut">в ход</span>' : `<button class="btn2" data-c="mega:${t.key}">Започни</button>`}</div>`).join('')}</div>`;
    return h;
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
    if (c === 'tab') { tab = a; render(); setTimeout(() => { const ch = document.getElementById('cpChat'); if (ch) ch.scrollTop = 1e6; }, 0); return; }
    if (c === 'jhw') { const id = el.querySelector('#cpSeg').value, s = d.segs().find(q => q.id === id); if (!s) return;
      if (say(await rpc('coop_joint', { p_kind: 'hw', p_ref: id, p_title: `АМ „${s.nm}“: ${d.cityName(s.a)} — ${d.cityName(s.b)}`, p_km: s.km }))) d.toast('🛣️ Предложението е изпратено — партньорът трябва да го приеме.', 'good'); return; }
    if (c === 'jrail') { const v = el.querySelector('#cpRail').value.split('|'), ref = v[0] + '|' + v[1];
      if (say(await rpc('coop_joint', { p_kind: 'rail', p_ref: ref, p_title: `Влак ${d.cityName(v[0])} — ${d.cityName(v[1])}`, p_km: +v[2] || 100 }))) d.toast('🚆 Предложението е изпратено.', 'good'); return; }
    if (c === 'jact') { if (say(await rpc('coop_joint_act', { p_id: +a, p_action: x }))) d.toast({ accept: '🤝 Строите заедно! Започни участъка от „🛣️ Магистрали“ (или линията от „ЖП“).', decline: 'Отказано.', end: 'Общият обект е прекратен.' }[x], 'good'); return; }
    if (c === 'rent') { const ty = el.querySelector('#cpRT').value, hrs = +el.querySelector('#cpRH').value, pr = Math.round(num(el.querySelector('#cpRP').value) || 0);
      if (!d.takeUnit(ty)) return d.toast('Няма свободна такава техника тук.', 'bad');
      const r = await queue({ fn: 'coop_rent_offer', args: { p_req: uid(), p_type: ty, p_hours: hrs, p_price: pr }, refund: { unit: ty } });
      if (r?.ok) d.toast(`📤 ${UNIT_TYPES[ty]?.nm} е предложен${pr ? ` под наем за ${f(pr)} €` : ' като помощ'} — чака ${partnerName()}.`, 'good'); return; }
    if (c === 'rpay') { const pr = +x; if (pr > 0 && !money(pr)) return; if (pr > 0) E().spend(pr, 'партньор', `Наем на техника от ${partnerName()}`);
      const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: 'accept' }, refund: pr > 0 ? { money: pr } : null });
      if (r?.ok) d.toast('🚚 Машината идва при теб.', 'good'); d.renderPanel(); return; }
    if (c === 'ract') { const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: x }, refund: null }); if (r?.ok) d.toast(x === 'cancel' ? 'Оттеглено — машината се връща при теб.' : 'Отказано.', 'good'); return; }
    if (c === 'rback') { if (!d.takeUnit(x)) return d.toast('Машината е заета на обект — освободи я първо.', 'bad');
      const r = await queue({ fn: 'coop_rent_act', args: { p_req: uid(), p_id: +a, p_action: 'return' }, refund: { unit: x } }); if (r?.ok) d.toast('🚚 Върна машината.', 'good'); return; }
    if (c === 'surp') { const txt = el.querySelector('#cpST').value.trim() || '🎁', amt = Math.round(num(el.querySelector('#cpSA').value) || 0);
      if (amt > 0 && !money(amt)) return; const spots = d.sitesHere(), sp = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: 0, z: 0 };
      if (amt > 0) E().spend(amt, 'партньор', `🎁 Изненада за ${partnerName()}`);
      const r = await queue({ fn: 'coop_surprise', args: { p_req: uid(), p_city: d.cityId(), p_x: sp.x, p_z: sp.z, p_text: txt, p_amount: amt }, refund: amt > 0 ? { money: amt } : null });
      if (r?.ok) d.toast(`🎁 Изненадата е оставена в ${d.cityName(d.cityId())}.`, 'good'); d.renderPanel(); return; }
    if (c === 'qclaim') { const r = await rpc('coop_quest_claim', { p_id: +a }); if (!say(r)) return; E().earn(r.reward, 'партньор', '🏆 Обща задача'); d.save(); d.renderPanel(); d.toast(`🏆 Обща задача: +${f(r.reward)} €`, 'good'); return; }
    if (c === 'vput') { const n = Math.round(num(el.querySelector('#cpV').value)); if (!money(n)) return; E().spend(n, 'партньор', '🏦 Вноска в общата касичка');
      const r = await queue({ fn: 'coop_vault', args: { p_req: uid(), p_amount: n }, refund: { money: n } }); if (r?.ok) d.toast(`🏦 Внесе ${f(n)} €.`, 'good'); d.renderPanel(); return; }
    if (c === 'vtake') { const n = Math.round(num(el.querySelector('#cpV').value)); if (!(n > 0)) return d.toast('Въведи сума.', 'bad');
      if (say(await rpc('coop_vault', { p_req: uid(), p_amount: -n }))) d.toast(`🏦 Изтегли ${f(n)} € — идват след миг.`, 'good'); return; }
    if (c === 'ipo') { const r = await rpc('coop_ipo', a === 'propose' ? { p_action: 'propose', p_pct: +el.querySelector('#cpIP').value, p_hours: +el.querySelector('#cpIH').value } : { p_action: a });
      if (say(r)) d.toast({ propose: '📈 Предложението е пратено — партньорът трябва да го одобри.', accept: '📈 Акциите на холдинга тръгнаха на борсата!', decline: 'Отказано.', cancel: 'Оттеглено.' }[a] || 'Готово.', 'good'); return; }
    if (c === 'vname') { if (say(await rpc('coop_vault_name', { p_name: el.querySelector('#cpVN').value }))) d.toast('Името е запазено.'); return; }
    if (c === 'say' || c === 'quick') { const txt = c === 'quick' ? QUICK[+a] : el.querySelector('#cpMsg').value; if (!txt) return; if (say(await rpc('coop_say', { p_text: txt }))) tab = 'chat'; return; }
    if (c === 'sos') { say(await rpc('coop_say', { p_text: `Трябва ми помощ! Имам ${f(E().money)} €${E().money < 0 ? ' (на минус!)' : ''}.`, p_sos: true })); d.toast('🆘 Сигналът е изпратен.', 'good'); return; }
    if (c === 'join') { const r = await rpc('coop_join', { p_code: el.querySelector('#cpCode').value }); if (say(r)) d.toast('🤝 Свързани сте! Градовете на партньора ще се появят на картата ти в синьо.', 'good'); return; }
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
      d.toast(`✅ Изпълнена поръчка: ${r.ico} ${r.nm}! +${f(r.reward)} €${r.fair ? ' (вложеното + половината от печалбата)' : ' (без печалба — единият е вложил под 20%)'}`, 'good'); return; }
  }

  if (!AUTOTEST) {
    setTimeout(() => { mount(); tick(); }, 1500);
    setInterval(() => { if (document.visibilityState === 'visible') tick(); }, POLL);
  }
  window.__coopDbg = () => ({ partner: st?.partner?.snap?.name, sites: st?.partner?.snap?.sites, marks: lastMarks, here: d.ready() && d.cityId() });
  // нивото на партньора (активно партньорство) — devlevel.js чака него (coop-lv)
  const partnerLv = () => { const P = st?.pair?.status === 'active' ? st?.partner?.snap : null; return P && Number.isFinite(P.lv) ? P.lv : null; };
  return { tick, state: () => st, partnerLv };
}
