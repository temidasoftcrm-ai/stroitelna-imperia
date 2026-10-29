// orient.js — „Ориент Експрес“: специална международна поръчка, която идва рядко („едно на милион“).
// Консорциум от железниците на седем държави възлага възстановяването на легендарната линия Париж — Истанбул.
// Условие: всички участъци по маршрута да са построени и ⚡ модернизирани (скоростни) до срока.
// Плащане: аванс при подписването, остатъкът при предаването + луксозният влак носи приход всеки ден.
// Записът е в S.orient = { st: 'none'|'offer'|'active'|'done'|'failed'|'declined', at, due, adv, retry, earned }.
import { jshare, jset, jointHtml, jfee, jointToast } from './coopmega.js';   // 🤝 coop-mega: общата поръчка с партньора — по 50%
export const OE_ROUTE = ['paris', 'munich', 'vienna', 'budapest', 'belgrade', 'sofia', 'istanbul'];
export const OE = {
  dev: 8,            // международна поръчка — идва, когато Европа е отключена
  rep: 3.5,          // и фирмата има име
  chance: 1 / 450,   // шанс на ден — средно веднъж на ~година и три месеца игра
  offerDays: 15,     // колко дни офертата чака отговор
  days: 300,         // срок за изпълнение
  fee: 90000000,     // възнаграждение
  adv: 0.15,         // аванс
  daily: 160000,     // приход от луксозния влак на ден след предаването
  retry: 720,        // при отказ/провал — може да се появи пак след толкова дни
};

// deps: { S(), econ(), toast(msg, kind, onClick?), modal(title, html, buttons), fmt, save, sound(n), devBest(), rep(), addRep(d), addXp(n),
//         cityName(id), leg(a, b) → { i, built, prog, hs, hsBuild } | null, legQuote(a, b) → { km, cost, days }, hsCost(a, b) → { cost, days },
//         buildLeg(a, b), upLeg(i), pop(cap, sub), openWin() }
export function createOrient(deps) {
  const st = () => { const S = deps.S(); S.orient = S.orient || { st: 'none' }; return S.orient; };
  const day = () => deps.S().day;
  const f = n => deps.fmt(n);
  const legs = () => OE_ROUTE.slice(1).map((b, k) => { const a = OE_ROUTE[k]; return { a, b, r: deps.leg(a, b) }; });
  const legDone = l => l.r && l.r.built && l.r.hs;
  const progress = () => { const L = legs(); return { done: L.filter(legDone).length, all: L.length }; };
  const routeTxt = () => OE_ROUTE.map(deps.cityName).join(' — ');

  function offer() {
    const s = st(); s.st = 'offer'; s.at = day(); jset(s, deps.joint && deps.joint('oe'));
    deps.sound && deps.sound('offer');
    if (deps.pop) deps.pop('✨ Ориент Експрес — специална поръчка!', `Международен консорциум търси фирма за линията ${routeTxt()}. Такава поръчка идва веднъж на милион!`);
    deps.toast(`✨🚂 Специална международна поръчка: „Ориент Експрес“ ${routeTxt()}! Награда ${f(OE.fee)} €. Отговори до ден ${s.at + OE.offerDays}.`, 'good', () => deps.openWin());
    ask();
  }
  // 🤝 coop-mega: офертата на партньора идва и при мен (j — общият договор)
  function offerJoint(j) {
    const s = st(); s.st = 'offer'; s.at = day(); s.joint = j;
    deps.sound && deps.sound('offer');
    deps.toast(jointToast(j, 'Ориент Експрес'), 'good', () => deps.openWin());
    ask();
  }
  function ask() {
    const p = progress(), s = st();
    deps.modal('✨🚂 Ориент Експрес', `${jointHtml(s, f, OE.fee, OE.adv)}<b>Специална международна поръчка</b> — идва веднъж на милион.<br><br>Консорциум от железниците на седем държави възлага на твоята фирма възстановяването на легендарната линия:<br><b>${routeTxt()}</b><br><br>
      Условие: всичките ${p.all} участъка да са построени и <b>⚡ модернизирани</b> за скоростни влакове до <b>${OE.days} дни</b> (вече имаш ${p.done}/${p.all}).<br>
      💰 Награда: <b style="color:var(--ok)">${jfee(s, f, OE.fee)}</b> · аванс ${Math.round(OE.adv * 100)}% (${f(OE.fee * OE.adv * jshare(s))} €) веднага при подписването.<br>
      🚂 След предаването луксозният влак носи <b style="color:var(--ok)">+${f(OE.daily * jshare(s))} €/ден</b> завинаги и +0.5 ★ репутация.<br>
      ⚠️ Ако не успееш в срока — връщаш аванса и губиш 0.3 ★.<br><br>
      Строежът и модернизацията се плащат от теб (виж прозореца „ЖП“ — там е списъкът на участъците).`,
      [['Откажи', () => decline()], ['По-късно', null], ['✍️ Подпиши договора', () => accept()]]);
  }
  function accept() {
    const s = st(); if (s.st !== 'offer') return;
    s.st = 'active'; s.due = day() + OE.days; s.adv = Math.round(OE.fee * OE.adv * jshare(s));
    deps.econ().earn(s.adv, 'обект', 'Аванс: Ориент Експрес');
    deps.toast(`✍️ Подписа договора за „Ориент Експрес“! Аванс +${f(s.adv)} €. Срок до ден ${s.due}.`, 'good', () => deps.openWin());
    deps.sound && deps.sound('cash'); deps.save(); deps.openWin();
  }
  function decline() {
    const s = st(); s.st = 'declined'; s.retry = day() + OE.retry;
    deps.toast('Отказа „Ориент Експрес“. Кой знае дали такава поръчка ще дойде пак…', ''); deps.save();
  }
  function complete() {
    const s = st(); s.st = 'done'; s.doneAt = day(); s.earned = 0;
    const rest = Math.max(0, Math.round(OE.fee * jshare(s)) - (s.adv || 0)), dl = Math.round(OE.daily * jshare(s));
    deps.econ().earn(rest, 'обект', 'Ориент Експрес — предаване');
    deps.addRep && deps.addRep(0.5); deps.addXp && deps.addXp(5000);
    if (deps.pop) deps.pop('🚂✨ Ориент Експрес потегли!', `${routeTxt()} · +${f(rest)} € · луксозният влак носи +${f(dl)} €/ден.`);
    deps.toast(`🚂✨ „Ориент Експрес“ е предаден! +${f(rest)} € и +0.5 ★. Луксозният влак вече пътува Париж — Истанбул.`, 'good');
    deps.sound && deps.sound('cash'); deps.save();
  }
  function fail() {
    const s = st(); s.st = 'failed'; s.retry = day() + OE.retry;
    if (s.adv) deps.econ().spend(s.adv, 'глоба', 'Ориент Експрес: върнат аванс');
    deps.addRep && deps.addRep(-0.3);
    deps.toast(`❌ Срокът за „Ориент Експрес“ изтече. Върна аванса ${f(s.adv || 0)} € и загуби 0.3 ★.`, 'bad'); deps.save();
  }
  function dailyTick() {
    const s = st(), d = day();
    if (s.st === 'none' || ((s.st === 'declined' || s.st === 'failed') && d >= (s.retry || 0))) {
      if (deps.devBest() >= OE.dev && deps.rep() >= OE.rep && Math.random() < OE.chance) offer();
    } else if (s.st === 'offer') {
      if (d > s.at + OE.offerDays) { s.st = 'declined'; s.retry = d + OE.retry; deps.toast('⌛ Офертата за „Ориент Експрес“ изтече — консорциумът избра друга фирма.', 'bad'); }
    } else if (s.st === 'active') {
      const p = progress();
      if (p.done === p.all) complete();
      else if (d > s.due) fail();
      else if (s.due - d === 30) deps.toast(`⏳ „Ориент Експрес“: остават 30 дни, готови ${p.done}/${p.all} участъка.`, 'bad', () => deps.openWin());
    } else if (s.st === 'done') {
      const dl = Math.round(OE.daily * jshare(s));
      deps.econ().earn(dl, 'обект', 'Ориент Експрес: билети');
      s.earned = (s.earned || 0) + dl;
      if ((d - s.doneAt) % 7 === 0) deps.toast(`🚂✨ Ориент Експрес тази седмица: +${f(dl * 7)} € (общо ${f(s.earned)} €)`, 'good');
    }
  }
  // карта в прозореца „ЖП“ (само когато поръчката е налице)
  function cardHtml() {
    const s = st(); if (!['offer', 'active', 'done'].includes(s.st)) return '';
    const d = day(), p = progress();
    const head = s.st === 'offer' ? `<span class="meta" style="margin:0 0 0 auto;color:#ffd54a">чака отговор до ден ${s.at + OE.offerDays}</span>`
      : s.st === 'active' ? `<span class="meta" style="margin:0 0 0 auto">${p.done}/${p.all} · остават <b style="color:${s.due - d < 30 ? 'var(--bad)' : 'var(--txt)'}">${s.due - d} дни</b></span>`
      : `<span class="meta" style="margin:0 0 0 auto;color:var(--ok)">пътува · +${f(OE.daily * jshare(s))} €/ден</span>`;
    let h = `<div class="card" style="border:1px solid #d4af37;box-shadow:0 0 18px rgba(212,175,55,.25)"><h3>✨🚂 Ориент Експрес ${head}</h3>
      <div class="meta">${routeTxt()} · награда <b style="color:var(--ok)">${jfee(s, f, OE.fee)}</b>${s.adv ? ` (аванс ${f(s.adv)} € получен)` : ''}</div>${jointHtml(s, f, OE.fee, OE.adv)}`;
    if (s.st === 'done') return h + `<div style="display:flex;gap:12px;align-items:center;margin:6px 0"><img src="assets/ui/oe-done.webp" alt="" style="width:120px;height:90px;object-fit:cover;border-radius:10px;flex:none"><div class="meta" style="margin:0">Предаден на ден ${s.doneAt}. Спечелено от билети: <b style="color:var(--ok)">${f(s.earned || 0)} €</b>.</div></div></div>`;   // снимката — малка, текстът до нея
    h += `<div class="bar" style="margin:6px 0"><i style="width:${(p.done / p.all * 100).toFixed(0)}%;background:#d4af37"></i></div>`;
    for (const l of legs()) {
      const r = l.r, nm = `${deps.cityName(l.a)} — ${deps.cityName(l.b)}`;
      let txt, btn = '';
      if (legDone(l)) txt = r.coop ? '✅ ⚡ готов · 🤝 построен от партньора' : '✅ ⚡ готов';
      else if (!r) { const q = deps.legQuote(l.a, l.b); txt = `⬜ няма линия · ${q.km} км · ${q.days} дни`; if (s.st === 'active') btn = `<button class="btn" data-oe-build="${l.a}:${l.b}" ${deps.econ().canAfford(q.cost) ? '' : 'disabled'}>Строй ${f(q.cost)} €</button>`; }
      else if (!r.built) txt = `🚧 строи се ${Math.floor((r.prog || 0) * 100)}% · после ⚡ модернизация`;
      else if (r.hsBuild) txt = `⚡ модернизира се ${Math.floor(r.hsBuild.prog * 100)}%`;
      else if (r.coop) txt = '🤝 построена от партньора · ⚡ модернизацията е при него';
      else { const q = deps.hsCost(l.a, l.b); txt = `🛤️ линията е готова · нужна ⚡ модернизация (${q.days} дни)`; if (s.st === 'active') btn = `<button class="btn" data-oe-up="${r.i}" ${deps.econ().canAfford(q.cost) ? '' : 'disabled'}>⚡ ${f(q.cost)} €</button>`; }
      h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${nm}</b> · ${txt}</span>${btn}</div>`;
    }
    if (s.st === 'offer') h += `<div class="row" style="justify-content:flex-end"><button class="btn" data-oe-ask="1">📜 Виж договора</button></div>`;
    return h + '</div>';
  }
  return { dailyTick, cardHtml, ask, accept, offer, offerJoint, state: st, progress };
}
