// silkroad.js — „🐫 Пътят на коприната“: специална поръчка в Азия на три етапа (отделно от Транссибирската в megaorders.js).
//   1. Логистични центрове в Ташкент и Алмати — плащаш и се строят сами hubDays дни.
//   2. Жп линия Истанбул — Анкара — Техеран — Ташкент — Алмати — Сиан (готовите участъци се броят; като megaorders: railLeg/railBuild).
//   3. Първите контейнерни влакове Китай → Европа: runDays дни по линията (всеки ден приход, линията трябва да е цяла).
// Всеки етап дава своя награда; след третия — приход всеки ден завинаги. На картата (светът/Азия) — златна линия.
// Записът е в S.silk = { st: 'none'|'offer'|'active'|'done'|'failed'|'declined', at, due, adv, paid: [1, 2], hubs: { [id]: { prog } }, run, earned, doneAt, retry }.
// deps: { S(), econ(), toast, modal, fmt, save, sound, open() — ниво 16 и Азия отворена, rep(), addRep(d), addXp(n), cityName(id),
//   railLeg(a, b) → null | { built, prog }, railQuote(a, b, mul) → { km, cost, days }, railBuild(a, b, mul), pop(key, cap, sub), openWin() }
export const SILK = {
  key: 'silk', ico: '🐫', flag: '🇨🇳🇺🇿🇹🇷', nm: 'Пътят на коприната',
  route: ['istanbul', 'ankara', 'tehran', 'tashkent', 'almaty', 'xian'], hubs: ['tashkent', 'almaty'],
  hubCost: 40000000, hubDays: 90, mul: 6, runDays: 60, runPay: 250000,
  fee: 650000000, days: 900, daily: 650000, share: [0.15, 0.3, 0.4],   // аванс 15%, после 15% / 30% / 40% за етапите
  who: 'Китай и страните по пътя', what: 'нов „Път на коприната“ — контейнерни влакове от Китай до Европа през Средна Азия',
};
const P = { chance: 1 / 260, offerDays: 15, adv: 0.15, retry: 720 };
const STAGES = ['🏭 Логистични центрове', '🛤️ Жп линията', '📦 Първите контейнерни влакове'];

export function createSilkRoad(deps) {
  const m = SILK, f = n => deps.fmt(n), day = () => deps.S().day;
  const st = () => { const S = deps.S(); return S.silk = S.silk || { st: 'none' }; };
  const legs = () => m.route.slice(1).map((b, i) => { const a = m.route[i], r = deps.railLeg(a, b); return { a, b, done: !!(r && r.built), pct: r && !r.built ? Math.floor(r.prog * 100) : null, started: !!r }; });
  const hubDone = id => { const h = (st().hubs || {})[id]; return !!(h && h.prog >= 1); };
  const stage1 = () => m.hubs.every(hubDone), stage2 = () => legs().every(l => l.done);
  const stageNow = () => !stage1() ? 1 : !stage2() ? 2 : 3;
  // напредък: 2 центъра + 5 участъка + влаковете (като една стъпка)
  const progress = () => { const s = st(), L = legs(); return { done: m.hubs.filter(hubDone).length + L.filter(l => l.done).length + (s.st === 'done' ? 1 : 0), all: m.hubs.length + L.length + 1 }; };
  const routeTxt = () => m.route.map(deps.cityName).join(' — ');

  function offer() {
    const s = st(); s.st = 'offer'; s.at = day();
    deps.sound && deps.sound('offer');
    deps.pop && deps.pop('silk-offer', `${m.ico} ${m.nm} — специална поръчка!`, `${m.who} търсят фирма: ${routeTxt()}.`);
    deps.toast(`${m.ico}${m.flag} Специална поръчка: „${m.nm}“! Награда ${f(m.fee)} €. Отговори до ден ${s.at + P.offerDays}.`, 'good', () => deps.openWin());
    ask();
  }
  function ask() {
    const sh = m.share.map(x => f(m.fee * x));
    deps.modal(`${m.ico}${m.flag} ${m.nm}`, `<b>Специална поръчка</b> — идва веднъж на милион.<br><br>${m.who} възлагат на твоята фирма ${m.what}:<br><b>${routeTxt()}</b><br><br>
      <b>Три етапа</b> за <b>${m.days} дни</b>:<br>
      1. ${STAGES[0]} в ${m.hubs.map(deps.cityName).join(' и ')} — по ${f(m.hubCost)} €, ${m.hubDays} дни строеж → <b style="color:var(--ok)">+${sh[0]} €</b><br>
      2. ${STAGES[1]} (${m.route.length - 1} участъка, готовите се броят) → <b style="color:var(--ok)">+${sh[1]} €</b><br>
      3. ${STAGES[2]} — ${m.runDays} дни по линията (+${f(m.runPay)} €/ден) → <b style="color:var(--ok)">+${sh[2]} €</b><br><br>
      💰 Общо <b style="color:var(--ok)">${f(m.fee)} €</b> · аванс ${Math.round(P.adv * 100)}% (${f(m.fee * P.adv)} €) веднага.<br>
      ⭐ След това контейнерите от Китай минават по твоята линия: <b style="color:var(--ok)">+${f(m.daily)} €/ден</b> завинаги и +0.5 ★.<br>⚠️ Ако не успееш в срока — връщаш аванса и губиш 0.3 ★.`,
      [['Откажи', () => decline()], ['По-късно', null], ['✍️ Подпиши договора', () => accept()]]);
  }
  function accept() {
    const s = st(); if (s.st !== 'offer') return;
    Object.assign(s, { st: 'active', due: day() + m.days, adv: Math.round(m.fee * P.adv), paid: [], hubs: s.hubs || {}, run: 0 });
    deps.econ().earn(s.adv, 'обект', `Аванс: ${m.nm}`);
    deps.toast(`✍️ Подписа договора за „${m.nm}“! Аванс +${f(s.adv)} €. Срок до ден ${s.due}.`, 'good', () => deps.openWin());
    deps.sound && deps.sound('cash'); deps.save(); deps.openWin();
  }
  function decline() { const s = st(); s.st = 'declined'; s.retry = day() + P.retry; deps.toast(`Отказа „${m.nm}“. Кой знае дали ще дойде пак…`, ''); deps.save(); }
  function payStage(n) {
    const s = st(); s.paid = s.paid || []; if (s.paid.includes(n)) return;
    s.paid.push(n); const amt = Math.round(m.fee * m.share[n - 1]);
    deps.econ().earn(amt, 'обект', `${m.nm}: етап ${n}`);
    deps.addXp && deps.addXp(2000);
    if (n < 3) { deps.pop && deps.pop('silk-stage', `${m.ico} ${m.nm}: етап ${n} е готов!`, `${STAGES[n - 1]} · +${f(amt)} €. Следва: ${STAGES[n]}.`);
      deps.toast(`${m.ico} „${m.nm}“: ${STAGES[n - 1]} — готово! +${f(amt)} €. Следва: ${STAGES[n]}.`, 'good', () => deps.openWin()); deps.sound && deps.sound('cash'); }
    return amt;
  }
  function complete() {
    const s = st(), amt = payStage(3) || 0; s.st = 'done'; s.doneAt = day(); s.earned = 0;
    deps.addRep && deps.addRep(0.5); deps.addXp && deps.addXp(6000);
    deps.pop && deps.pop('silk-done', `${m.ico} ${m.nm} е открит!`, `Контейнерите от Китай пътуват до Европа по твоята линия · +${f(amt)} € и +${f(m.daily)} €/ден.`);
    deps.toast(`${m.ico}${m.flag} „${m.nm}“ е предаден! +${f(amt)} € и +0.5 ★.`, 'good');
    deps.sound && deps.sound('cash'); deps.save();
  }
  function fail() {
    const s = st(); s.st = 'failed'; s.retry = day() + P.retry;
    if (s.adv) deps.econ().spend(s.adv, 'глоба', `${m.nm}: върнат аванс`);
    deps.addRep && deps.addRep(-0.3);
    deps.toast(`❌ Срокът за „${m.nm}“ изтече. Върна аванса ${f(s.adv || 0)} € и загуби 0.3 ★.`, 'bad'); deps.save();
  }
  // етап 1: логистичен център — плащаш и се строи сам
  function startHub(id) {
    const s = st(); if (s.st !== 'active' || !m.hubs.includes(id) || (s.hubs || {})[id]) return;
    if (!deps.econ().canAfford(m.hubCost)) { deps.toast(`Нямаш достатъчно пари за центъра (${f(m.hubCost)} €).`, 'bad'); return; }
    deps.econ().spend(m.hubCost, 'покупка', `${m.nm}: логистичен център ${deps.cityName(id)}`);
    s.hubs = { ...(s.hubs || {}), [id]: { prog: 0 } };
    deps.toast(`🏗️ Започна логистичният център в ${deps.cityName(id)} (${m.hubDays} дни).`, 'good'); deps.sound && deps.sound('buy'); deps.save(); deps.openWin();
  }
  // етап 2: жп участък (може и преди центровете — броят се, но наградата за етапа идва по ред)
  function build(i) {
    const s = st(), l = legs()[i]; if (s.st !== 'active' || !l || l.done || l.started) return;
    deps.railBuild(l.a, l.b, m.mul); deps.openWin();
  }
  function dailyTick() {
    const s = st(), d = day();
    if (s.st === 'none' || ((s.st === 'declined' || s.st === 'failed') && d >= (s.retry || 0))) {
      if (deps.open() && deps.rep() >= 3.5 && Math.random() < P.chance) offer();
    } else if (s.st === 'offer') {
      if (d > s.at + P.offerDays) { s.st = 'declined'; s.retry = d + P.retry; deps.toast(`⌛ Офертата за „${m.nm}“ изтече — избраха друга фирма.`, 'bad'); }
    } else if (s.st === 'active') {
      for (const id of m.hubs) { const h = (s.hubs || {})[id]; if (h && h.prog < 1) { h.prog = Math.min(1, h.prog + 1 / m.hubDays); if (h.prog >= 1) deps.toast(`🏭 Логистичният център в ${deps.cityName(id)} е готов!`, 'good'); } }
      if (stage1()) payStage(1);
      if (stage1() && stage2()) {
        payStage(2);
        s.run = (s.run || 0) + 1;   // етап 3: влаковете тръгват веднага щом линията е цяла
        deps.econ().earn(m.runPay, 'обект', `${m.nm}: контейнерни влакове`);
        if (s.run === 1) deps.toast(`📦 Първият контейнерен влак от Сиан тръгна за Истанбул! ${m.runDays} дни до предаването.`, 'good', () => deps.openWin());
        if (s.run >= m.runDays) { complete(); return; }
      }
      if (d > s.due) fail();
      else if (s.due - d === 30) { const p = progress(); deps.toast(`⏳ „${m.nm}“: остават 30 дни, готови ${p.done}/${p.all}.`, 'bad', () => deps.openWin()); }
    } else if (s.st === 'done') {
      deps.econ().earn(m.daily, 'обект', `${m.nm}: приход`);
      s.earned = (s.earned || 0) + m.daily;
      if ((d - s.doneAt) % 7 === 0) deps.toast(`${m.ico} ${m.nm} тази седмица: +${f(m.daily * 7)} € (общо ${f(s.earned)} €)`, 'good');
    }
  }
  function cardHtml() {
    const s = st(); if (!['offer', 'active', 'done'].includes(s.st)) return '';
    const d = day(), p = progress(), sn = stageNow();
    const head = s.st === 'offer' ? `<span class="meta" style="margin:0 0 0 auto;color:#ffd54a">чака отговор до ден ${s.at + P.offerDays}</span>`
      : s.st === 'active' ? `<span class="meta" style="margin:0 0 0 auto">етап ${sn}/3 · ${p.done}/${p.all} · остават <b style="color:${s.due - d < 30 ? 'var(--bad)' : 'var(--txt)'}">${s.due - d} дни</b></span>`
      : `<span class="meta" style="margin:0 0 0 auto;color:var(--ok)">открит · +${f(m.daily)} €/ден</span>`;
    let h = `<div class="card" style="border:1px solid #ffb300;box-shadow:0 0 18px rgba(255,179,0,.2)"><h3>${m.ico}${m.flag} ${m.nm} ${head}</h3>
      <div class="meta">${routeTxt()} · награда <b style="color:var(--ok)">${f(m.fee)} €</b>${s.adv ? ` (аванс ${f(s.adv)} € получен)` : ''}</div>`;
    if (s.st === 'done') return h + `<div style="display:flex;gap:12px;align-items:center;margin:6px 0"><img src="assets/ui/silk-done.webp" alt="" onerror="this.remove()" style="width:120px;height:90px;object-fit:cover;border-radius:10px;flex:none"><div class="meta" style="margin:0">Предаден на ден ${s.doneAt}. Спечелено: <b style="color:var(--ok)">${f(s.earned || 0)} €</b>.</div></div></div>`;   // снимката — малка, текстът до нея
    h += `<div class="bar" style="margin:6px 0"><i style="width:${(p.done / p.all * 100).toFixed(0)}%;background:#ffb300"></i></div>`;
    const act = s.st === 'active', paid = s.paid || [], tick = n => paid.includes(n) ? ' ✅' : '';
    h += `<div class="meta" style="margin:8px 0 2px"><b style="color:var(--txt)">1. ${STAGES[0]}${tick(1)}</b> · +${f(m.fee * m.share[0])} €</div>`;
    for (const id of m.hubs) {
      const hb = (s.hubs || {})[id], txt = hubDone(id) ? '✅ готов' : hb ? `🏗️ строи се ${Math.floor(hb.prog * 100)}%` : `⬜ ${f(m.hubCost)} € · ${m.hubDays} дни`;
      h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${deps.cityName(id)}</b> · ${txt}</span>${act && !hb ? `<button class="btn" data-silk-hub="${id}" ${deps.econ().canAfford(m.hubCost) ? '' : 'disabled'}>🏭 Строй · ${f(m.hubCost)} €</button>` : ''}</div>`;
    }
    h += `<div class="meta" style="margin:8px 0 2px"><b style="color:var(--txt)">2. ${STAGES[1]}${tick(2)}</b> · +${f(m.fee * m.share[1])} €</div>`;
    legs().forEach((l, i) => {
      let txt, btn = '';
      if (l.done) txt = '✅ готов';
      else if (l.pct != null) txt = `🚧 строи се ${l.pct}%`;
      else { const q = deps.railQuote(l.a, l.b, m.mul); txt = `⬜ ${f(q.km)} км · ${q.days} дни`; if (act) btn = `<button class="btn" data-silk="${i}" ${deps.econ().canAfford(q.cost) ? '' : 'disabled'}>🛤️ Строй · ${f(q.cost)} €</button>`; }
      h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${deps.cityName(l.a)} — ${deps.cityName(l.b)}</b> · ${txt}</span>${btn}</div>`;
    });
    h += `<div class="meta" style="margin:8px 0 2px"><b style="color:var(--txt)">3. ${STAGES[2]}</b> · +${f(m.fee * m.share[2])} €</div>
      <div class="meta" style="margin:4px 0">${sn < 3 ? `⬜ тръгват, щом центровете и линията са готови · ${m.runDays} дни · +${f(m.runPay)} €/ден` : `📦 на път: <b style="color:var(--txt)">${s.run || 0}/${m.runDays}</b> дни`}</div>`;
    if (s.st === 'active' && sn === 3) h += `<div class="bar" style="margin:4px 0"><i style="width:${((s.run || 0) / m.runDays * 100).toFixed(0)}%;background:#ffb300"></i></div>`;
    if (s.st === 'offer') h += `<div class="row" style="justify-content:flex-end"><button class="btn" data-silk-ask="1">📜 Виж договора</button></div>`;
    return h + '</div>';
  }
  // „какво да направиш сега“ (прозорецът ⭐ Супер поръчки)
  function hint() {
    const s = st(), out = [];
    for (const id of m.hubs) { const hb = (s.hubs || {})[id]; if (!hb) out.push(`🏭 <b>${deps.cityName(id)}</b>: натисни „Строй“ за логистичния център (${f(m.hubCost)} €)`); else if (hb.prog < 1) out.push(`🏗️ <b>${deps.cityName(id)}</b>: центърът се строи ${Math.floor(hb.prog * 100)}% — сам върви`); }
    for (const l of legs()) if (!l.done) out.push(l.pct != null ? `🚧 <b>${deps.cityName(l.a)} — ${deps.cityName(l.b)}</b>: строи се ${l.pct}%` : `🛤️ <b>${deps.cityName(l.a)} — ${deps.cityName(l.b)}</b>: свободен — натисни „Строй“`);
    if (stage1() && stage2() && s.st === 'active') out.push(`📦 Контейнерните влакове пътуват: ${s.run || 0}/${m.runDays} дни — само чакай`);
    return out;
  }
  // златната линия на картата: xy(id) → [x, y], w — дебелина; t — секунди (за влака по линията)
  function svg(xy, w = 1, t = 0) {
    const s = st(); if (!['active', 'done'].includes(s.st)) return '';
    const L = legs(), P = m.route.map(xy), pt = p => p.map(v => v.toFixed(1)).join(',');
    let h = '';
    L.forEach((l, i) => {
      const a = pt(P[i]), b = pt(P[i + 1]);
      if (l.done || s.st === 'done') h += `<polyline points="${a} ${b}" fill="none" stroke="#7a5200" stroke-width="${7 * w}" stroke-linecap="round" opacity=".9"/><polyline points="${a} ${b}" fill="none" stroke="#ffcc33" stroke-width="${4 * w}" stroke-linecap="round"/>`;
      else h += `<polyline points="${a} ${b}" fill="none" stroke="#ffcc33" stroke-width="${3 * w}" stroke-dasharray="${6 * w} ${5 * w}" opacity=".7"/>`;
    });
    for (const id of m.hubs) if ((s.hubs || {})[id]) { const [x, y] = xy(id); h += `<text x="${x - 10 * w}" y="${y + 22 * w}" font-size="${14 * w}" style="pointer-events:none">${hubDone(id) ? '🏭' : '🚧'}</text>`; }
    const [lx, ly] = P[Math.floor(P.length / 2)];
    h += `<text x="${lx}" y="${ly - 14 * w}" font-size="${13 * w}" font-weight="800" fill="#7a5200" text-anchor="middle" paint-order="stroke" stroke="#fff6d6" stroke-width="${3 * w}" style="pointer-events:none">🐫 ${s.st === 'done' ? 'ПЪТЯТ НА КОПРИНАТА' : 'Пътят на коприната'}</text>`;
    // контейнерният влак, щом линията е цяла: отива и се връща по маршрута
    if (s.st === 'done' || (stage1() && stage2())) {
      const u = (t / 40) % 2, k = u < 1 ? u : 2 - u, seg = Math.min(P.length - 2, Math.floor(k * (P.length - 1))), r = k * (P.length - 1) - seg, A = P[seg], B = P[seg + 1];
      h += `<text x="${A[0] + (B[0] - A[0]) * r}" y="${A[1] + (B[1] - A[1]) * r + 5 * w}" font-size="${16 * w}" text-anchor="middle" style="pointer-events:none">🚆</text>`;
    }
    return h;
  }
  return { dailyTick, cardHtml, hint, ask, accept, offer, build, startHub, state: st, progress, svg, list: [m] };
}
