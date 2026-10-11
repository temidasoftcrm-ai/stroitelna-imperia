// route66.js — „Route 66“: специална поръчка в Америка (като „Ориент Експрес“, но за път).
// Федералната пътна агенция на САЩ възлага възстановяването на легендарния „Майчин път“ Чикаго — Лос Анджелис
// като модерен аутобан. Условие: всички участъци по маршрута да са построени до срока.
// След предаването: награда + туристи по пътя (мотели, бензиностанции, ресторанти) носят приход всеки ден.
// Записът е в S.r66 = { st: 'none'|'offer'|'active'|'done'|'failed'|'declined', at, due, adv, retry, earned, doneAt }.
export const R66_ROUTE = ['chicago', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'];
export const R66 = { chance: 1 / 400, offerDays: 15, days: 360, fee: 120000000, adv: 0.15, daily: 210000, retry: 720 };

// deps: { S(), econ(), toast, modal, fmt, save, sound, open() (дали Америка е отключена), rep(), addRep(d), addXp(n), cityName(id),
//         segId(a, b), segDone(id), segJob(id) → { pct } | null, segInfo(a, b) → { km, cost, days }, canTake(id) → '' | причина, pop(cap, sub), openWin() }
export function createRoute66(deps) {
  const st = () => { const S = deps.S(); S.r66 = S.r66 || { st: 'none' }; return S.r66; };
  const day = () => deps.S().day, f = n => deps.fmt(n);
  const legs = () => R66_ROUTE.slice(1).map((b, k) => { const a = R66_ROUTE[k], id = deps.segId(a, b); return { a, b, id, done: deps.segDone(id), job: deps.segJob(id) }; });
  const progress = () => { const L = legs(); return { done: L.filter(l => l.done).length, all: L.length }; };
  const routeTxt = () => R66_ROUTE.map(deps.cityName).join(' — ');

  function offer() {
    const s = st(); s.st = 'offer'; s.at = day();
    deps.sound && deps.sound('offer');
    deps.pop && deps.pop('🛣️🇺🇸 Route 66 — специална поръчка!', `Федералната пътна агенция търси фирма за легендарния път ${routeTxt()}.`);
    deps.toast(`🛣️🇺🇸 Специална поръчка: „Route 66“ ${routeTxt()}! Награда ${f(R66.fee)} €. Отговори до ден ${s.at + R66.offerDays}.`, 'good', () => deps.openWin());
    ask();
  }
  function ask() {
    const p = progress();
    deps.modal('🛣️🇺🇸 Route 66', `<b>Специална поръчка в Америка</b> — идва веднъж на милион.<br><br>Федералната пътна агенция на САЩ възлага на твоята фирма възстановяването на „Майчиния път“ като модерен аутобан:<br><b>${routeTxt()}</b><br><br>
      Условие: всичките ${p.all} участъка да са построени до <b>${R66.days} дни</b> (вече имаш ${p.done}/${p.all}).<br>
      💰 Награда: <b style="color:var(--ok)">${f(R66.fee)} €</b> · аванс ${Math.round(R66.adv * 100)}% (${f(R66.fee * R66.adv)} €) веднага.<br>
      🏍️ След предаването мотелите, бензиностанциите и ресторантите по пътя носят <b style="color:var(--ok)">+${f(R66.daily)} €/ден</b> завинаги и +0.5 ★.<br>
      ⚠️ Ако не успееш в срока — връщаш аванса и губиш 0.3 ★.<br><br>Участъците се строят от прозореца „🛣️ Магистрали“ (там е и списъкът) с пътна техника.`,
      [['Откажи', () => decline()], ['По-късно', null], ['✍️ Подпиши договора', () => accept()]]);
  }
  function accept() {
    const s = st(); if (s.st !== 'offer') return;
    s.st = 'active'; s.due = day() + R66.days; s.adv = Math.round(R66.fee * R66.adv);
    deps.econ().earn(s.adv, 'обект', 'Аванс: Route 66');
    deps.toast(`✍️ Подписа договора за „Route 66“! Аванс +${f(s.adv)} €. Срок до ден ${s.due}.`, 'good', () => deps.openWin());
    deps.sound && deps.sound('cash'); deps.save(); deps.openWin();
  }
  function decline() { const s = st(); s.st = 'declined'; s.retry = day() + R66.retry; deps.toast('Отказа „Route 66“. Кой знае дали ще дойде пак…', ''); deps.save(); }
  function complete() {
    const s = st(); s.st = 'done'; s.doneAt = day(); s.earned = 0;
    const rest = R66.fee - (s.adv || 0);
    deps.econ().earn(rest, 'обект', 'Route 66 — предаване');
    deps.addRep && deps.addRep(0.5); deps.addXp && deps.addXp(5000);
    deps.pop && deps.pop('🛣️🏍️ Route 66 е открит!', `${routeTxt()} · +${f(rest)} € · туристите по пътя носят +${f(R66.daily)} €/ден.`);
    deps.toast(`🛣️🏍️ „Route 66“ е предаден! +${f(rest)} € и +0.5 ★. Мотоциклетисти от цял свят вече карат по него.`, 'good');
    deps.sound && deps.sound('cash'); deps.save();
  }
  function fail() {
    const s = st(); s.st = 'failed'; s.retry = day() + R66.retry;
    if (s.adv) deps.econ().spend(s.adv, 'глоба', 'Route 66: върнат аванс');
    deps.addRep && deps.addRep(-0.3);
    deps.toast(`❌ Срокът за „Route 66“ изтече. Върна аванса ${f(s.adv || 0)} € и загуби 0.3 ★.`, 'bad'); deps.save();
  }
  function dailyTick() {
    const s = st(), d = day();
    if (s.st === 'none' || ((s.st === 'declined' || s.st === 'failed') && d >= (s.retry || 0))) {
      if (deps.open() && deps.rep() >= 3.5 && Math.random() < R66.chance) offer();
    } else if (s.st === 'offer') {
      if (d > s.at + R66.offerDays) { s.st = 'declined'; s.retry = d + R66.retry; deps.toast('⌛ Офертата за „Route 66“ изтече — агенцията избра друга фирма.', 'bad'); }
    } else if (s.st === 'active') {
      const p = progress();
      if (p.done === p.all) complete();
      else if (d > s.due) fail();
      else if (s.due - d === 30) deps.toast(`⏳ „Route 66“: остават 30 дни, готови ${p.done}/${p.all} участъка.`, 'bad', () => deps.openWin());
    } else if (s.st === 'done') {
      deps.econ().earn(R66.daily, 'обект', 'Route 66: туристи');
      s.earned = (s.earned || 0) + R66.daily;
      if ((d - s.doneAt) % 7 === 0) deps.toast(`🛣️🏍️ Route 66 тази седмица: +${f(R66.daily * 7)} € (общо ${f(s.earned)} €)`, 'good');
    }
  }
  // карта в прозореца „Магистрали“
  function cardHtml() {
    const s = st(); if (!['offer', 'active', 'done'].includes(s.st)) return '';
    const d = day(), p = progress();
    const head = s.st === 'offer' ? `<span class="meta" style="margin:0 0 0 auto;color:#ffd54a">чака отговор до ден ${s.at + R66.offerDays}</span>`
      : s.st === 'active' ? `<span class="meta" style="margin:0 0 0 auto">${p.done}/${p.all} · остават <b style="color:${s.due - d < 30 ? 'var(--bad)' : 'var(--txt)'}">${s.due - d} дни</b></span>`
      : `<span class="meta" style="margin:0 0 0 auto;color:var(--ok)">открит · +${f(R66.daily)} €/ден</span>`;
    let h = `<div class="card" style="border:1px solid #c0392b;box-shadow:0 0 18px rgba(192,57,43,.25)"><h3>🛣️🇺🇸 Route 66 ${head}</h3>
      <div class="meta">${routeTxt()} · награда <b style="color:var(--ok)">${f(R66.fee)} €</b>${s.adv ? ` (аванс ${f(s.adv)} € получен)` : ''}</div>`;
    if (s.st === 'done') return h + `<img src="assets/ui/r66-done.webp" alt="" style="width:100%;max-height:260px;object-fit:contain;border-radius:10px;margin:6px 0"><div class="meta">Предаден на ден ${s.doneAt}. Спечелено от туристи: <b style="color:var(--ok)">${f(s.earned || 0)} €</b>.</div></div>`;
    h += `<div class="bar" style="margin:6px 0"><i style="width:${(p.done / p.all * 100).toFixed(0)}%;background:#c0392b"></i></div>`;
    for (const l of legs()) {
      const nm = `${deps.cityName(l.a)} — ${deps.cityName(l.b)}`, q = deps.segInfo(l.a, l.b);
      let txt, btn = '';
      if (l.done) txt = '✅ готов';
      else if (l.job) txt = `🚧 строи се ${l.job.pct}%`;
      else { const why = s.st === 'active' ? deps.canTake(l.id) : 'x'; txt = `⬜ ${f(q.km)} км · ${q.days} дни${why && why !== 'x' ? ` · <span class="late">${why}</span>` : ''}`; if (s.st === 'active') btn = `<button class="btn" data-r66="${l.id}" ${why ? 'disabled' : ''}>Строй +${f(q.reward)} €</button>`; }
      h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${nm}</b> · ${txt}</span>${btn}</div>`;
    }
    if (s.st === 'offer') h += `<div class="row" style="justify-content:flex-end"><button class="btn" data-r66-ask="1">📜 Виж договора</button></div>`;
    return h + '</div>';
  }
  return { dailyTick, cardHtml, ask, accept, offer, state: st, progress };
}
