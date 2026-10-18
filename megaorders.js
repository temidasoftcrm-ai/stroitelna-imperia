// megaorders.js — супер поръчки по континентите (като „Ориент Експрес“ и „Route 66“): по една на континент.
// Видове: 'rail' — жп участъци по маршрута; 'ab' — участъци аутобан; 'works' — един голям строеж (Панамският канал).
// Записът е в S.mega[key] = { st: 'none'|'offer'|'active'|'done'|'failed'|'declined', at, due, adv, retry, earned, doneAt, build: { prog } }.
export const MEGA = [
  { key: 'chunnel', cont: 'eu', ico: '🚄', flag: '🇬🇧🇫🇷', nm: 'Тунелът под Ламанша', kind: 'rail', route: ['london', 'paris'], mul: 60, fee: 90000000, days: 300, daily: 150000,
    who: 'Британското и френското правителство', what: 'подводен жп тунел под Ламанша — Лондон и Париж за 2 часа с влак', after: 'влаковете „Евростар“ носят пари от билетите', pic: 'chunnel-done' },
  { key: 'capecairo', cont: 'af', ico: '🚂', flag: '🌍', nm: 'Железницата Кейп — Кайро', kind: 'rail', route: ['capetown', 'johannesburg', 'harare', 'lusaka', 'dodoma', 'nairobi', 'addisababa', 'khartoum', 'aswan', 'cairo'], mul: 8,
    fee: 420000000, days: 600, daily: 450000, who: 'Африканският съюз', what: 'старата мечта — жп линия през целия континент, от нос Добра надежда до Нил', after: 'товарите и пътниците по цялата линия носят приход', pic: 'capecairo-done' },
  { key: 'panama', cont: 'na', ico: '⚓', flag: '🇵🇦', nm: 'Разширение на Панамския канал', kind: 'works', city: 'panama', cost: 60000000, buildDays: 160, fee: 160000000, days: 320, daily: 320000,
    who: 'Управлението на Панамския канал', what: 'нови гигантски шлюзове, през които минават най-големите кораби в света', after: 'таксите на корабите през канала', pic: 'panama-done' },
  { key: 'darien', cont: 'sa', ico: '🛣️', flag: '🇵🇦🇨🇴', nm: 'Дариенският пролом', kind: 'ab', route: ['panama', 'medellin'], fee: 130000000, days: 360, daily: 220000,
    who: 'Панама и Колумбия', what: 'липсващото парче от Панамериканската магистрала — 100 км през джунглата, които разделят двете Америки', after: 'тол таксите на камионите от Аляска до Огнена земя', pic: 'darien-done' },
  { key: 'transsib', cont: 'as', ico: '🚂', flag: '🇷🇺', nm: 'Транссибирската железница', kind: 'rail', route: ['moscow', 'kazan', 'yekaterinburg', 'novosibirsk', 'irkutsk', 'khabarovsk', 'vladivostok'], mul: 8,
    fee: 520000000, days: 660, daily: 520000, who: 'Руските железници', what: 'най-дългата жп линия на света — 9000 км от Москва до Тихия океан', after: 'контейнерите от Азия към Европа носят приход', pic: 'transsib-done' },
  { key: 'ghan', cont: 'oc', ico: '🚂', flag: '🇦🇺', nm: 'Влакът „Гън“', kind: 'rail', route: ['adelaide', 'alicesprings', 'darwin'], mul: 10, fee: 150000000, days: 360, daily: 190000,
    who: 'Австралийското правителство', what: 'жп линия през пустинята — от Аделаида през Алис Спрингс до Дарвин', after: 'туристическият влак „Гън“ носи билети', pic: 'ghan-done' },
];
const P = { chance: 1 / 260, offerDays: 15, adv: 0.15, retry: 720 };

// deps: { S(), econ(), toast, modal, fmt, save, sound, contOpen(key), rep(), addRep(d), addXp(n), cityName(id),
//   railLeg(a, b) → null | { built, prog }, railQuote(a, b) → { km, cost, days }, railBuild(a, b),
//   abId(a, b), abDone(id), abJob(id) → { pct } | null, abQuote(a, b) → { km, reward, days }, abWhy(id) → '' | причина, abTake(id), pop(key, cap, sub), openWin() }
export function createMega(deps) {
  const st = k => { const S = deps.S(); S.mega = S.mega || {}; return S.mega[k] = S.mega[k] || { st: 'none' }; };
  const day = () => deps.S().day, f = n => deps.fmt(n), byKey = k => MEGA.find(m => m.key === k);
  const routeTxt = m => m.kind === 'works' ? deps.cityName(m.city) : m.route.map(deps.cityName).join(' — ');
  function legs(m) {
    if (m.kind === 'works') { const s = st(m.key); return [{ works: true, done: s.build && s.build.prog >= 1, prog: s.build ? s.build.prog : null }]; }
    return m.route.slice(1).map((b, i) => {
      const a = m.route[i];
      if (m.kind === 'rail') { const r = deps.railLeg(a, b); return { a, b, done: !!(r && r.built), pct: r && !r.built ? Math.floor(r.prog * 100) : null, started: !!r }; }
      const id = deps.abId(a, b), j = deps.abJob(id); return { a, b, id, done: deps.abDone(id), pct: j ? j.pct : null, started: !!j };
    });
  }
  const progress = k => { const L = legs(byKey(k)); return { done: L.filter(l => l.done).length, all: L.length }; };

  function offer(m) {
    const s = st(m.key); s.st = 'offer'; s.at = day();
    deps.sound && deps.sound('offer');
    deps.pop && deps.pop(m.pic, `${m.ico}${m.flag} ${m.nm} — специална поръчка!`, `${m.who} търси фирма: ${routeTxt(m)}.`);
    deps.toast(`${m.ico}${m.flag} Специална поръчка: „${m.nm}“! Награда ${f(m.fee)} €. Отговори до ден ${s.at + P.offerDays}.`, 'good', () => deps.openWin());
    ask(m.key);
  }
  function ask(k) {
    const m = byKey(k), p = progress(k);
    const cond = m.kind === 'works' ? `Условие: да построиш новите шлюзове (${f(m.cost)} €, ${m.buildDays} дни строеж) до <b>${m.days} дни</b>.`
      : `Условие: всичките ${p.all} ${m.kind === 'rail' ? 'жп участъка' : 'участъка аутобан'} да са построени до <b>${m.days} дни</b> (вече имаш ${p.done}/${p.all}).`;
    deps.modal(`${m.ico}${m.flag} ${m.nm}`, `<b>Специална поръчка</b> — идва веднъж на милион.<br><br>${m.who} възлага на твоята фирма ${m.what}:<br><b>${routeTxt(m)}</b><br><br>
      ${cond}<br>💰 Награда: <b style="color:var(--ok)">${f(m.fee)} €</b> · аванс ${Math.round(P.adv * 100)}% (${f(m.fee * P.adv)} €) веднага.<br>
      ⭐ След предаването ${m.after}: <b style="color:var(--ok)">+${f(m.daily)} €/ден</b> завинаги и +0.5 ★.<br>⚠️ Ако не успееш в срока — връщаш аванса и губиш 0.3 ★.<br><br>Всичко се строи от прозореца „⭐ Супер поръчки“.`,
      [['Откажи', () => decline(k)], ['По-късно', null], ['✍️ Подпиши договора', () => accept(k)]]);
  }
  function accept(k, quiet) {
    const m = byKey(k), s = st(k); if (s.st !== 'offer') return;
    s.st = 'active'; s.due = day() + m.days; s.adv = Math.round(m.fee * P.adv);
    deps.econ().earn(s.adv, 'обект', `Аванс: ${m.nm}`);
    deps.toast(`✍️ Подписа договора за „${m.nm}“! Аванс +${f(s.adv)} €. Срок до ден ${s.due}.`, 'good', () => deps.openWin());
    deps.sound && deps.sound('cash'); deps.save(); if (!quiet) deps.openWin();
  }
  function decline(k) { const m = byKey(k), s = st(k); s.st = 'declined'; s.retry = day() + P.retry; deps.toast(`Отказа „${m.nm}“. Кой знае дали ще дойде пак…`, ''); deps.save(); }
  function complete(m) {
    const s = st(m.key); s.st = 'done'; s.doneAt = day(); s.earned = 0;
    const rest = m.fee - (s.adv || 0);
    deps.econ().earn(rest, 'обект', `${m.nm} — предаване`);
    deps.addRep && deps.addRep(0.5); deps.addXp && deps.addXp(6000);
    deps.pop && deps.pop(m.pic, `${m.ico}${m.flag} ${m.nm} е открит!`, `+${f(rest)} € · ${m.after}: +${f(m.daily)} €/ден.`);
    deps.toast(`${m.ico}${m.flag} „${m.nm}“ е предаден! +${f(rest)} € и +0.5 ★.`, 'good');
    deps.sound && deps.sound('cash'); deps.save();
  }
  function fail(m) {
    const s = st(m.key); s.st = 'failed'; s.retry = day() + P.retry;
    if (s.adv) deps.econ().spend(s.adv, 'глоба', `${m.nm}: върнат аванс`);
    deps.addRep && deps.addRep(-0.3);
    deps.toast(`❌ Срокът за „${m.nm}“ изтече. Върна аванса ${f(s.adv || 0)} € и загуби 0.3 ★.`, 'bad'); deps.save();
  }
  // голям строеж (Панамският канал): плащаш и тече сам buildDays дни
  function startWorks(k) {
    const m = byKey(k), s = st(k); if (s.st !== 'active' || s.build) return;
    if (!deps.econ().canAfford(m.cost)) { deps.toast(`Нямаш достатъчно пари за строежа (${f(m.cost)} €).`, 'bad'); return; }
    deps.econ().spend(m.cost, 'покупка', `${m.nm}: строеж`);
    s.build = { prog: 0 }; deps.toast(`🏗️ Започна строежът: ${m.nm} (${m.buildDays} дни).`, 'good'); deps.sound && deps.sound('buy'); deps.save(); deps.openWin();
  }
  function build(k, i, quiet) {
    const m = byKey(k), s = st(k), l = legs(m)[i]; if (s.st !== 'active' || !l || l.done || l.started) return;
    if (m.kind === 'rail') deps.railBuild(l.a, l.b, m.mul); else deps.abTake(l.id);
    if (!quiet) deps.openWin();
  }
  function dailyTick() {
    const d = day(), offering = MEGA.some(m => st(m.key).st === 'offer');
    for (const m of MEGA) {
      const s = st(m.key);
      if (s.st === 'none' || ((s.st === 'declined' || s.st === 'failed') && d >= (s.retry || 0))) {
        if (!offering && deps.contOpen(m.cont) && deps.rep() >= 3.5 && Math.random() < P.chance) { offer(m); return; }
      } else if (s.st === 'offer') {
        if (d > s.at + P.offerDays) { s.st = 'declined'; s.retry = d + P.retry; deps.toast(`⌛ Офертата за „${m.nm}“ изтече — избраха друга фирма.`, 'bad'); }
      } else if (s.st === 'active') {
        if (s.build && s.build.prog < 1) s.build.prog = Math.min(1, s.build.prog + 1 / m.buildDays);
        const p = progress(m.key);
        if (p.done === p.all) complete(m);
        else if (d > s.due) fail(m);
        else if (s.due - d === 30) deps.toast(`⏳ „${m.nm}“: остават 30 дни, готови ${p.done}/${p.all}.`, 'bad', () => deps.openWin());
      } else if (s.st === 'done') {
        deps.econ().earn(m.daily, 'обект', `${m.nm}: приход`);
        s.earned = (s.earned || 0) + m.daily;
        if ((d - s.doneAt) % 7 === 0) deps.toast(`${m.ico} ${m.nm} тази седмица: +${f(m.daily * 7)} € (общо ${f(s.earned)} €)`, 'good');
      }
    }
  }
  function cardHtml(k) {
    const m = byKey(k), s = st(k); if (!['offer', 'active', 'done'].includes(s.st)) return '';
    const d = day(), p = progress(k);
    const head = s.st === 'offer' ? `<span class="meta" style="margin:0 0 0 auto;color:#ffd54a">чака отговор до ден ${s.at + P.offerDays}</span>`
      : s.st === 'active' ? `<span class="meta" style="margin:0 0 0 auto">${p.done}/${p.all} · остават <b style="color:${s.due - d < 30 ? 'var(--bad)' : 'var(--txt)'}">${s.due - d} дни</b></span>`
      : `<span class="meta" style="margin:0 0 0 auto;color:var(--ok)">открит · +${f(m.daily)} €/ден</span>`;
    let h = `<div class="card" style="border:1px solid #ffb300;box-shadow:0 0 18px rgba(255,179,0,.2)"><h3>${m.ico}${m.flag} ${m.nm} ${head}</h3>
      <div class="meta">${routeTxt(m)} · награда <b style="color:var(--ok)">${f(m.fee)} €</b>${s.adv ? ` (аванс ${f(s.adv)} € получен)` : ''}</div>`;
    if (s.st === 'done') return h + `<div style="display:flex;gap:12px;align-items:center;margin:6px 0"><img src="assets/ui/${k}-done.webp" alt="" onerror="this.remove()" style="width:120px;height:90px;object-fit:cover;border-radius:10px;flex:none"><div class="meta" style="margin:0">Предаден на ден ${s.doneAt}. Спечелено: <b style="color:var(--ok)">${f(s.earned || 0)} €</b>.</div></div></div>`;   // снимката — малка, текстът до нея
    h += `<div class="bar" style="margin:6px 0"><i style="width:${(p.done / p.all * 100).toFixed(0)}%;background:#ffb300"></i></div>`;
    legs(m).forEach((l, i) => {
      if (l.works) {
        const txt = l.done ? '✅ готово' : l.prog != null ? `🏗️ строи се ${Math.floor(l.prog * 100)}%` : `⬜ нови шлюзове · ${f(m.cost)} € · ${m.buildDays} дни`;
        h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">Шлюзовете</b> · ${txt}</span>${s.st === 'active' && l.prog == null ? `<button class="btn" data-mega-works="${k}">🏗️ Започни · ${f(m.cost)} €</button>` : ''}</div>`;
        return;
      }
      const nm = `${deps.cityName(l.a)} — ${deps.cityName(l.b)}`;
      let txt, btn = '';
      if (l.done) txt = '✅ готов';
      else if (l.pct != null) txt = `🚧 строи се ${l.pct}%`;
      else if (m.kind === 'rail') { const q = deps.railQuote(l.a, l.b, m.mul); txt = `⬜ ${f(q.km)} км · ${q.days} дни`; if (s.st === 'active') btn = `<button class="btn" data-mega="${k}|${i}">🛤️ Строй · ${f(q.cost)} €</button>`; }
      else { const q = deps.abQuote(l.a, l.b), why = s.st === 'active' ? deps.abWhy(l.id) : ''; txt = `⬜ ${f(q.km)} км · ${q.days} дни${why ? ` · <span class="late">${why}</span>` : ''}`; if (s.st === 'active') btn = `<button class="btn" data-mega="${k}|${i}" ${why ? 'disabled' : ''}>Строй +${f(q.reward)} €</button>`; }
      h += `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${nm}</b> · ${txt}</span>${btn}</div>`;
    });
    if (s.st === 'offer') h += `<div class="row" style="justify-content:flex-end"><button class="btn" data-mega-ask="${k}">📜 Виж договора</button></div>`;
    return h + '</div>';
  }
  // „какво да направиш сега“ за прозореца
  function hint(k) {
    const m = byKey(k);
    return legs(m).filter(l => !l.done).map(l => l.works ? (l.prog == null ? `🏗️ <b>Шлюзовете</b>: натисни „Започни“ (${f(m.cost)} €)` : `🏗️ <b>Шлюзовете</b>: строят се ${Math.floor(l.prog * 100)}% — сами вървят`)
      : l.pct != null ? `🚧 <b>${deps.cityName(l.a)} — ${deps.cityName(l.b)}</b>: строи се ${l.pct}%` : `${m.kind === 'rail' ? '🛤️' : '🛣️'} <b>${deps.cityName(l.a)} — ${deps.cityName(l.b)}</b>: свободен — натисни „Строй“`);
  }
  return { legs: k => legs(byKey(k)), dailyTick, cardHtml, hint, ask, accept, offer: k => offer(byKey(k)), build, startWorks, state: st, progress, list: MEGA };
}
