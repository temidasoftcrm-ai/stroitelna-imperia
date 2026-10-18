// megaworld.js — 🌍 световните мегапроекти на холдинга (етап 2): ти ги финансираш и строиш на етапи, после носят огромен приход всеки ден.
// Не са държавни поръчки (megaorders.js) — тук ти си инвеститорът. Всеки етап се плаща предварително и се строи сам.
// Записът: S.mw = { [key]: { ph: завършени етапи, prog: 0..1 на текущия, run: true докато се строи, done: ден } }.
export const MW = [
  { key: 'pipeline', ico: '🛢️', nm: 'Петролопровод „Залив — Европа“', route: ['riyadh', 'ankara', 'istanbul', 'burgas'], cost: 40e9, days: 360, inc: 45e6, col: '#ff9a2e',
    what: 'тръба от Саудитска Арабия през Турция до Бургас', effect: 'петролът и горивото на империята се продават с +10%' },
  { key: 'suez', ico: '🚢', nm: 'Разширение на Суецкия канал', point: [32.35, 30.6], city: 'cairo', cost: 25e9, days: 300, inc: 30e6, col: '#4fc3f7',
    what: 'втори канал за най-големите кораби в света', effect: '+10% от прихода на корабите ти' },
  { key: 'gibraltar', ico: '🌉', nm: 'Мост „Гибралтар“', route: ['seville', 'tangier'], cost: 30e9, days: 330, inc: 25e6, col: '#7dffa8',
    what: 'мост между Европа и Африка над протока', effect: 'жп линии между Испания и Мароко' },
  { key: 'hyperloop', ico: '🚄', nm: 'Хиперлуп „Европа“', route: ['paris', 'frankfurt', 'munich', 'vienna', 'budapest'], cost: 60e9, days: 420, inc: 70e6, col: '#e57cff',
    what: 'вакуумна капсула с 1000 км/ч — Париж до Будапеща за 2 часа', effect: 'най-големият приход от билети в света' },
];
const PHASES = 4;
// 🛢️ петролопроводът минава през 4 държави — първо държавни договори; всяка подписва, щом изпълниш условията ѝ.
// Условия: bank — твоята банка да ѝ отпусне кредит (2%, 5 г.); pay — плащане (бонус при подписване, дарение); branch — филиал в град;
// rep — репутация; transit — дял от прихода на тръбата за държавата (приемаш го с подписа). Записът: S.mw.pipeline.tr = { [k]: { ok: {i: ден}, signed: ден } }.
export const PIPE_DEALS = [
  { k: 'sa', flag: '🇸🇦', nm: 'Саудитска Арабия', who: 'Министерството на енергетиката', cond: [{ t: 'bank', amt: 1.5e9 }, { t: 'transit', p: 0.05 }] },
  { k: 'iq', flag: '🇮🇶', nm: 'Ирак', who: 'Правителството в Багдад', cond: [{ t: 'pay', amt: 800e6, txt: 'бонус при подписване за държавния фонд' }, { t: 'pay', amt: 400e6, txt: 'да построите нова болница в Багдад' }] },
  { k: 'tr', flag: '🇹🇷', nm: 'Турция', who: 'Министерството на енергетиката в Анкара', cond: [{ t: 'branch', city: ['istanbul', 'ankara'] }, { t: 'bank', amt: 1e9 }, { t: 'transit', p: 0.04 }] },
  { k: 'bg', flag: '🇧🇬', nm: 'България', who: 'Министерският съвет', cond: [{ t: 'rep', min: 4 }, { t: 'pay', amt: 300e6, txt: 'да обновите пристанище Бургас за танкерите' }] },
];

// deps: { S, econ, fmt, toast, save, sound, pop, seaDaily() }
export function createMegaWorld(deps) {
  const st = () => { const S = deps.S(); S.mw = S.mw || {}; for (const m of MW) S.mw[m.key] = S.mw[m.key] || { ph: 0, prog: 0, run: false }; return S.mw; };
  const byKey = k => MW.find(m => m.key === k);
  const done = k => !!(deps.S()?.mw?.[k]?.done);
  const phaseCost = m => Math.round(m.cost / PHASES / 1e8) * 1e8;
  const B = n => `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €`;
  // ---- договорите за петролопровода
  const tr = () => { const r = st().pipeline; r.tr = r.tr || {}; for (const d of PIPE_DEALS) r.tr[d.k] = r.tr[d.k] || { ok: {} }; return r.tr; };
  const signedAll = () => PIPE_DEALS.every(d => tr()[d.k].signed);
  const transitCut = () => PIPE_DEALS.reduce((a, d) => a + (tr()[d.k].signed ? d.cond.filter(c => c.t === 'transit').reduce((x, c) => x + c.p, 0) : 0), 0);
  const bankRoom = () => { const b = deps.S().bank; if (!b) return -1; return b.cap * (1.5 + b.lv * 0.5) - b.loans.reduce((a, l) => a + l.left, 0); };
  function condOk(d, i) {   // изпълнено ли е условието (платените/отпуснатите се помнят; останалите се проверяват всеки път)
    const c = d.cond[i], S = deps.S(); if (tr()[d.k].ok[i]) return true;
    if (c.t === 'branch') return c.city.some(id => id === S.cityId || (S.branches || []).includes(id));
    if (c.t === 'rep') return (S.rep || 0) >= c.min;
    if (c.t === 'transit') return true;   // приема се с подписа
    return false;
  }
  function condTxt(c) {
    if (c.t === 'bank') return `🏦 Твоята банка да ни отпусне <b>${B(c.amt)}</b> при 2% за 5 години`;
    if (c.t === 'pay') return `💶 ${c.txt[0].toUpperCase() + c.txt.slice(1)} — <b>${B(c.amt)}</b>`;
    if (c.t === 'branch') return `🏢 Да имате филиал в ${c.city.map(id => ({ istanbul: 'Истанбул', ankara: 'Анкара' })[id] || id).join(' или ')}`;
    if (c.t === 'rep') return `⭐ Репутация поне ${c.min} ★`;
    if (c.t === 'transit') return `🛢️ ${Math.round(c.p * 100)}% от прихода на тръбата остават за държавата (транзитна такса)`;
    return '';
  }
  function fulfil(k, i) {
    const d = PIPE_DEALS.find(x => x.k === k), c = d && d.cond[i], S = deps.S(), e = deps.econ(); if (!c || tr()[k].ok[i]) return;
    if (c.t === 'pay') { if (!e.canAfford(c.amt)) { deps.toast(`Нямаш ${B(c.amt)}.`, 'bad'); return; } e.spend(c.amt, 'мегапроекти', `Петролопровод — ${d.nm}: ${c.txt}`); }
    else if (c.t === 'bank') {
      const b = S.bank; if (!b) { deps.toast('🏦 Първо основи своята банка (Холдинг → Банка).', 'bad'); return; }
      if (bankRoom() < c.amt) { deps.toast(`🏦 Банката няма свободни ${B(c.amt)} — увеличи капитала или нивото ѝ.`, 'bad'); return; }
      b.loans.push({ id: ++b.seq, ico: '🏳️', nm: `Правителството на ${d.nm}`, ri: 1, amt: c.amt, rate: 0.02, days: 1825, left: c.amt, end: S.day + 1825, since: S.day, cty: d.nm });
    } else return;
    tr()[k].ok[i] = S.day; deps.toast(`✅ ${d.flag} ${d.nm}: условието е изпълнено.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  function sign(k) {
    const d = PIPE_DEALS.find(x => x.k === k), t = tr()[k]; if (!d || t.signed) return;
    if (!d.cond.every((_, i) => condOk(d, i))) { deps.toast(`${d.flag} ${d.nm} още не подписва — изпълни условията.`, 'bad'); return; }
    t.signed = deps.S().day;
    if (signedAll()) deps.pop && deps.pop('empire', '✍️ Всички държави подписаха!', `Саудитска Арабия, Ирак, Турция и България са съгласни — петролопроводът „Залив — Европа“ може да тръгне. Финансирай първия етап.`);
    else deps.toast(`✍️ ${d.flag} ${d.nm} подписа договора за петролопровода (${PIPE_DEALS.filter(x => tr()[x.k].signed).length}/${PIPE_DEALS.length}).`, 'good');
    deps.sound && deps.sound('upgrade'); deps.save();
  }
  function dealsHtml() {
    const e = deps.econ(), n = PIPE_DEALS.filter(d => tr()[d.k].signed).length;
    let h = `<div class="meta" style="margin:8px 0 4px">✍️ <b style="color:var(--txt)">Държавни договори ${n}/${PIPE_DEALS.length}</b> — тръбата минава през 4 държави. Всяка подписва, щом изпълниш условията ѝ; строежът тръгва, когато подпишат всички.</div>`;
    h += PIPE_DEALS.map(d => { const t = tr()[d.k];
      return `<div style="padding:6px 8px;margin:4px 0;border-radius:8px;background:rgba(255,255,255,.04);${t.signed ? 'border-left:3px solid var(--ok)' : ''}"><div class="row" style="margin:0;align-items:center;gap:6px"><b style="flex:1">${d.flag} ${d.nm} <span class="meta" style="margin:0">· ${d.who}</span></b>${t.signed ? `<span class="meta" style="margin:0;color:var(--ok)">✅ подписан на ден ${t.signed}</span>` : `<button class="btn" data-mwsign="${d.k}" ${d.cond.every((_, i) => condOk(d, i)) ? '' : 'disabled'}>✍️ Подпиши</button>`}</div>
        ${t.signed ? '' : `<div class="meta" style="margin:2px 0 0">„Ще подпишем при условие, че:“</div>` + d.cond.map((c, i) => { const ok = condOk(d, i), act = !ok && (c.t === 'pay' || c.t === 'bank');
          return `<div class="row" style="margin:3px 0 0 10px;gap:6px;align-items:center"><span class="meta" style="margin:0;flex:1">${ok ? '✅' : '⬜'} ${condTxt(c)}</span>${act ? `<button class="btn2" data-mwful="${d.k}|${i}" ${c.t === 'pay' ? (e.canAfford(c.amt) ? '' : 'disabled') : (bankRoom() >= c.amt ? '' : 'disabled')}>${c.t === 'bank' ? '🏦 Отпусни' : '💶 Плати'}</button>` : ''}</div>`; }).join('')}</div>`; }).join('');
    return h;
  }
  const pct = k => { const r = st()[k]; return r.done ? 1 : (r.ph + (r.run ? r.prog : 0)) / PHASES; };
  function fund(k) {
    const m = byKey(k), r = st()[k]; if (!m || r.done || r.run) return;
    if (k === 'pipeline' && !r.ph && !signedAll()) { deps.toast('✍️ Първо всички държави по трасето трябва да подпишат договорите.', 'bad'); return; }
    const c = phaseCost(m), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)} за етап ${r.ph + 1}.`, 'bad'); return; }
    e.spend(c, 'мегапроекти', `${m.nm}: етап ${r.ph + 1}`); r.run = true; r.prog = 0;
    if (!r.ph) deps.pop && deps.pop('hw-open', `${m.ico} ${m.nm} — първа копка!`, `${m.what}. Етап 1 от ${PHASES} тръгна — ${Math.round(m.days / PHASES)} дни.`);
    else deps.toast(`${m.ico} ${m.nm}: етап ${r.ph + 1} от ${PHASES} тръгна.`, 'good');
    deps.sound && deps.sound('buy'); deps.save();
  }
  function dailyTick() {
    const S = deps.S(); if (!S || !S.holding) return; const e = deps.econ(); let inc = 0;
    for (const m of MW) {
      const r = st()[m.key];
      if (r.run) { r.prog += PHASES / m.days;
        if (r.prog >= 1) { r.run = false; r.prog = 0; r.ph++;
          if (r.ph >= PHASES) { r.done = S.day; deps.pop && deps.pop('empire', `${m.ico} ${m.nm} е готов!`, `${m.what}. Носи ~${deps.fmt(m.inc)} €/ден · ${m.effect}.`); deps.sound && deps.sound('levelup'); }
          else deps.toast(`${m.ico} ${m.nm}: етап ${r.ph} от ${PHASES} е готов — финансирай следващия.`, 'good'); } }
      if (r.done) inc += m.key === 'pipeline' ? m.inc * (1 - transitCut()) : m.inc;   // транзитните такси на държавите
    }
    if (done('suez')) inc += Math.round(Math.max(0, deps.seaDaily()) * 0.1);
    if (inc) e.earn(Math.round(inc), 'мегапроекти', 'Световни мегапроекти: такси, билети и транзит');
    st()._inc = Math.round(inc);
  }
  // стойност за класацията: готовите — 1.3× цената; в строеж — платеното
  const value = () => MW.reduce((a, m) => { const r = st()[m.key]; return a + (r.done ? m.cost * 1.3 : phaseCost(m) * (r.ph + (r.run ? 1 : 0))); }, 0);
  function winHtml() {
    const s = st(), e = deps.econ();
    let h = `<div class="bw-stats"><div><b>${MW.filter(m => s[m.key].done).length} / ${MW.length}</b><span>готови мегапроекта</span></div><div><b style="color:var(--ok)">+${deps.fmt(s._inc || 0)} €</b><span>приход на ден</span></div><div><b>${B(value())}</b><span>стойност в класацията</span></div></div>`;
    h += `<div class="meta" style="margin:8px 0">🌍 Ти си инвеститорът: плащаш всеки от ${PHASES}-те етапа предварително, строи се сам, а готовият проект носи приход завинаги и вдига холдинга в класацията. На картата се вижда трасето.</div>`;
    h += MW.map(m => { const r = s[m.key], p = Math.round(pct(m.key) * 100), c = phaseCost(m);
      return `<div class="card" style="border-left:4px solid ${m.col}"><div class="row" style="margin:0;align-items:center;gap:10px"><span style="font-size:26px">${m.ico}</span><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">${m.nm}</b><br>${m.what} · общо ${B(m.cost)} · ${m.days} дни<br>🎁 ~${deps.fmt(m.inc)} €/ден · ${m.effect}</span><b style="color:${r.done ? 'var(--ok)' : m.col}">${r.done ? '✅' : `${p}%`}</b></div>
        <div class="bar" style="height:6px;margin:8px 0 6px"><i style="width:${p}%;background:${m.col}"></i></div>
        ${m.key === 'pipeline' && !r.done && !r.ph && !r.run ? dealsHtml() : ''}
        <div class="row" style="margin:0;justify-content:flex-end;gap:6px;align-items:center"><span class="meta" style="margin:0;flex:1">${r.done ? `готов на ден ${r.done}` : r.run ? `🚧 етап ${r.ph + 1} от ${PHASES} — ${Math.round(r.prog * 100)}%` : r.ph ? `⏸ етап ${r.ph} е готов — чака финансиране` : 'не е започнат'}</span>${!r.done && !r.run ? `<button class="btn" data-mwfund="${m.key}" ${e.canAfford(c) && (m.key !== 'pipeline' || r.ph || signedAll()) ? '' : 'disabled'}>${r.ph ? `▶️ Етап ${r.ph + 1}` : '🏗️ Първа копка'} · ${B(c)}</button>` : ''}</div></div>`; }).join('');
    return h;
  }
  const bind = (box, rerender) => {
    box.querySelectorAll('[data-mwfund]').forEach(b => b.onclick = () => { fund(b.dataset.mwfund); rerender(); });
    box.querySelectorAll('[data-mwsign]').forEach(b => b.onclick = () => { sign(b.dataset.mwsign); rerender(); });
    box.querySelectorAll('[data-mwful]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.mwful.split('|'); fulfil(k, +i); rerender(); });
  };
  return { MW, state: st, done, pct, fund, dailyTick, value, winHtml, bind, pipeSigned: () => signedAll(), pipeDeals: () => PIPE_DEALS.filter(d => tr()[d.k].signed).length };
}
