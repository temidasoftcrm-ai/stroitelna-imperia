// citypanel.js — „🏙️ Градове“: всички твои градове на едно място, без да влизаш във всеки.
//   • за всеки град: ниво на развитие (и какво отключва следващото — напр. летищата на ниво 9), обектите в строеж,
//     чакащите оферти, техниката, парите по покривите и колко е запълнен градът;
//   • 🤖 Автопилот: докато не си там, градът сам приема поръчки и ги строи със своята техника и материали
//     (същите правила като в града: етапи, RATE, нужна техника). Парите отиват направо в банката, опитът — в нивото на града;
//   • бутони „Влез“ и „🏁 Завърши града“ (влиза в града и отваря картата за завършване).
// Градът, в който си, се показва със същите данни, но автопилотът му не работи (там играеш ти).
// Записът: S.autoCity = { [id]: true }; в града: c.freeLots = [[lotId, zone], …] (пази се при напускане, за новите поръчки).
const ZONE_PREF = { house: ['outer', 'mid'], shop: ['mid', 'outer', 'center'], office: ['center', 'mid'], tower: ['center', 'mid'] };

export function createCityPanel(deps) {
  const S = () => deps.S(), f = n => deps.fmt(n);
  const rec = id => id === S().cityId ? S() : (S().cities || {})[id] || null;
  const auto = id => !!(S().autoCity || {})[id];
  const lvOf = xp => { let l = 1; deps.THRESH.forEach((t, i) => { if (xp >= t) l = i + 1; }); return l; };
  const devOf = c => c.dev || { xp: 0, lv: 1 };
  const projsOf = (id, c) => [...(id === S().cityId ? deps.projects() : c.projects || []), ...(c.autoJobs || [])].filter(p => !p.own && !p.maint && !p.park && !p.reno && !p.invest && !p.remodel);
  const unitsOf = (id, c) => id === S().cityId ? deps.unitTypes() : c.units || [];
  const cap = c => deps.officeLv(c.officeLevel || 1);

  // ---- XP и ниво на града (като devlevel.add, но за запис, в който не си)
  function addXp(id, c, n) {
    const d = c.dev = c.dev || { xp: 0, lv: 1, v: 3 };
    d.xp += n;
    const nl = lvOf(d.xp);
    while (d.lv < nl) {
      d.lv++;
      deps.toast(`🏅 ${deps.cityName(id)} стана ниво ${d.lv}! ${deps.unlockText(d.lv)}`, 'good', () => deps.openWin());
      deps.sound && deps.sound('levelup');
    }
  }
  // ---- нова поръчка за град, в който не си: свободен парцел от запомнения списък
  function newOrder(id, c) {
    const rep = S().rep || 0, tier = deps.cityTier(id);
    const avail = deps.offerTypes().filter(([k, t]) => rep >= t.rep && !(tier === 's' && (k === 'tower' || (k === 'office' && rep < 4))) && !(k === 'tower' && deps.noTower && deps.noTower(id)));
    if (!avail.length) return null;
    const w = avail.map((_, i) => avail.length - i * 0.6);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), type = avail[0][0];
    for (let i = 0; i < avail.length; i++) if ((r -= w[i]) <= 0) { type = avail[i][0]; break; }
    // парцел: от запомнените свободни (ако си бил в града); иначе обектът е „на хартия“ (c.autoJobs) — плаща и дава опит,
    // но сградата не се появява на картата на града
    const pref = ZONE_PREF[type] || ['mid'], fl = c.freeLots;
    let lot = null;
    if (fl) {
      const k = fl.map((x, i) => [i, pref.indexOf(x[1])]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1] + (Math.random() - 0.5) * 1.5)[0];
      if (!k) return null;
      lot = fl.splice(k[0], 1)[0][0];
    }
    const bt = deps.BTYPES[type], lv = devOf(c).lv;
    let reward = deps.ECON.quoteReward(type, rep) * ((c.staff || {}).architect ? 1.1 : 1) * (1 + 0.02 * (lv - 1)), days = bt.days, floors;
    if (type === 'tower') { const fs = deps.towerFloors(id); floors = fs[Math.floor(Math.random() * fs.length)] || 10; const m = deps.towerMul(floors); reward *= m; days = Math.round(days * (0.6 + 0.4 * m)); }
    reward = Math.round(reward / 500) * 500;
    const cl = deps.clients(type, id), day = S().day;
    return { id: S().seq++, type, lot, client: cl, title: `${bt.nm}${floors ? ` (${floors} ет.)` : ''} — ${cl}`, reward, repGain: bt.repGain, startDay: day, deadlineDay: day + days, stage: 0, prog: 0, floors, model: deps.buildingFor(type, floors), auto: true };
  }
  // ---- един ден работа в град, в който не си (само при включен автопилот)
  function workDay(id, c) {
    const s = S(), econ = deps.econ(), day = s.day;
    c.projects = c.projects || []; c.offers = c.offers || [];
    // 1) чакащите оферти: приема ги, докато офисът има място (без наддаване — на цената от офертата)
    const busy = () => projsOf(id, c).length;
    c.offers = c.offers.filter(o => o.expires >= day);
    while (c.offers.length && busy() < cap(c).proj) {
      const o = c.offers.shift(), bt = deps.BTYPES[o.type];
      c.projects.push({ id: o.id, type: o.type, lot: o.lot, client: o.client, title: `${bt.nm}${o.floors ? ` (${o.floors} ет.)` : ''} — ${o.client}`, reward: o.reward, repGain: bt.repGain,
        startDay: day, deadlineDay: day + o.days, stage: 0, prog: 0, floors: o.floors, model: deps.buildingFor(o.type, o.floors), auto: true });
    }
    // 2) нови поръчки до капацитета на офиса
    let guard = 4;
    while (busy() < cap(c).proj && guard-- > 0) { const p = newOrder(id, c); if (!p) break; if (p.lot == null) (c.autoJobs = c.autoJobs || []).push(p); else c.projects.push(p); }
    // 3) строеж: техниката на града се дели между обектите по реда на приемане
    const have = {}; for (const t of c.units || []) have[t] = (have[t] || 0) + 1;
    c.gearAdded = {};
    const eng = (c.staff || {}).engineer ? 1.15 : 1;
    for (const p of [...c.projects, ...(c.autoJobs || [])]) {
      if (p.own || p.maint || p.park || p.reno || p.invest || p.remodel) continue;
      if (p.demo) { p.demo.prog = Math.min(1, p.demo.prog + 1 / p.demo.days); if (p.demo.prog >= 1) delete p.demo; continue; }
      let left = 1;
      while (left > 0) {
        const st = deps.BTYPES[p.type].stages[p.stage]; if (!st) break;
        { const miss = Object.keys(st.need).filter(r => (have[r] || 0) < 1); if (miss.length) { p.waitGear = true; p.waitNeed = miss; break; } }
        p.waitGear = false;
        p.mat = p.mat || {};
        if (!p.mat[p.stage]) {
          const cost = econ.materialCost(p.type, p.stage, [], {});
          if (cost && !econ.canAfford(cost)) { p.waitMoney = true; break; }
          if (cost) econ.spend(cost, 'материали', `${deps.cityName(id)}: материали за „${p.title}“`);
          p.mat[p.stage] = true; p.waitMoney = false;
        }
        const n = Object.entries(st.need).reduce((a, [r, k]) => a + Math.min(k, have[r] || 0), 0);
        const rate = deps.RATE * n * eng / (st.work * deps.workMul(p)), need = (1 - p.prog) / rate;
        if (need <= left) { left -= need; p.prog = 0; p.stage++; }
        else { p.prog += rate * left; left = 0; }
        if (!deps.BTYPES[p.type].stages[p.stage]) { finish(id, c, p); break; }
      }
      for (const [r, k] of Object.entries((deps.BTYPES[p.type].stages[p.stage] || { need: {} }).need)) have[r] = Math.max(0, (have[r] || 0) - k);   // заетата техника
    }
    // 4) пачките по покривите (от времето, когато беше там) — направо в банката
    if ((c.cash || []).length) { const sum = c.cash.reduce((a, x) => a + (x.amount || 0), 0); if (sum) econ.earn(sum, 'обект', `${deps.cityName(id)}: пари от покривите`); c.cash = []; }
    c.left = deps.nowDays();   // fastForward при влизане не брои тези дни втори път
  }
  function finish(id, c, p) {
    const econ = deps.econ(), s = S();
    const res = econ.completionPayout(p, s.day);   // плаща направо (без пачки по покривите)
    s.rep = Math.max(0, Math.min(5, (s.rep || 0) + res.repDelta * (res.repDelta > 0 && (c.staff || {}).architect ? 1.25 : 1)));
    if (p.lot == null) c.autoJobs.splice(c.autoJobs.indexOf(p), 1);
    else { c.projects.splice(c.projects.indexOf(p), 1); c.built = c.built || []; c.built.push({ lot: p.lot, model: p.model }); }
    s.done = (s.done || 0) + 1;
    addXp(id, c, deps.XP[p.type] || 0);
    c.autoLog = [{ d: s.day, t: p.title, a: res.amount }, ...(c.autoLog || [])].slice(0, 5);
    deps.onComplete && deps.onComplete(p);
  }
  function dailyTick() {
    const s = S(); if (!s) return;
    let n = 0, money = 0;
    for (const id of deps.ownedCities()) {
      if (id === s.cityId || !auto(id) || deps.isFinished(id)) continue;
      const c = rec(id); if (!c) continue;
      const m0 = deps.econ().s.money; workDay(id, c); money += deps.econ().s.money - m0; n++;
    }
    if (!n) return;
    s.autoWeek = (s.autoWeek || 0) + money;
    if (s.day % 7 === 0) { deps.toast(`🤖 Автопилот (${n} град${n > 1 ? 'а' : ''}): тази седмица ${s.autoWeek >= 0 ? '+' : ''}${f(Math.round(s.autoWeek))} €. Подробности в „🏙️ Градове“.`, 'good', () => deps.openWin()); s.autoWeek = 0; }
  }
  // при напускане на град: свободните парцели за автопилота
  function stash(c, lots) { c.freeLots = lots.filter(l => !l.built && !l.busy && !l.fresh).map(l => [l.id, l.zone]); }

  // ---- прозорецът
  function cityCard(id) {
    const s = S(), c = rec(id); if (!c) return '';
    const here = id === s.cityId, fin = deps.isFinished(id), d = devOf(c), lv = d.lv;
    const a = deps.THRESH[lv - 1], b = deps.THRESH[lv], k = b == null ? 1 : Math.max(0, Math.min(1, (d.xp - a) / (b - a)));
    const ps = projsOf(id, c), offers = (here ? s.offers : c.offers || []).length, units = unitsOf(id, c).length, C = cap(c);
    const roof = (c.cash || []).reduce((x, y) => x + (y.amount || 0), 0);
    const next = b == null ? '<span style="color:var(--ok)">максимално ниво</span>' : `до ниво ${lv + 1}: ${f(Math.round(b - d.xp))} XP · ${deps.devBest && deps.devBest() >= lv + 1 ? `<span style="color:var(--ok)">💶 +2% към наградите в ${deps.cityName(id)}</span>` : `<span style="color:#ffd54a">🔓 ${deps.unlockText(lv + 1)}</span>`}`;
    let h = `<div class="card" style="${here ? 'border:1px solid var(--acc)' : ''}"><h3 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${deps.cityFlag(id)} ${deps.cityName(id)}${here ? ' <span class="meta" style="margin:0">📍 тук си</span>' : ''}
      <span style="margin-left:auto;display:flex;gap:6px;align-items:center">${fin ? '<span class="meta" style="margin:0;color:var(--ok)">🏁 завършен</span>' : ''}<b>🏅 Ниво ${lv}</b></span></h3>
      <div class="bar" style="margin:4px 0"><i style="width:${(k * 100).toFixed(0)}%;background:linear-gradient(90deg,#c9a14a,#ffd54a)"></i></div>
      <div class="meta" style="margin:0 0 6px">${next}</div>`;
    if (fin) return h + `<div class="meta">Градът е завършен и носи приход всеки ден.</div></div>`;
    h += `<div class="meta" style="margin:0">🏗️ Строят се <b style="color:var(--txt)">${ps.length}/${C.proj}</b> · 📨 оферти ${offers} · 🚜 техника ${units}${roof ? ` · 💶 по покривите ${f(roof)} €` : ''}${!here && c.freeLots ? ` · 🟩 свободни парцели ${c.freeLots.length}` : ''}</div>${!here && !c.freeLots && auto(id) ? '<div class="meta" style="margin:2px 0 0">ℹ️ Още не си влизал тук — новите обекти се строят „на хартия“ (плащат и дават опит). Влез веднъж, за да се появяват и в града.</div>' : ''}`;
    for (const p of ps.slice(0, 6)) {
      const st = deps.BTYPES[p.type].stages[p.stage], pct = Math.round(((p.stage + Math.min(1, p.prog || 0)) / deps.BTYPES[p.type].stages.length) * 100);
      const why = p.demo ? ' · 🧱 събаряне' : p.waitGear ? ' · <span class="late">⏸ липсва техника</span>' : p.waitMoney ? ' · <span class="late">⏸ няма пари за материали</span>' : '';
      h += `<div class="row" style="margin:3px 0;gap:8px"><span class="meta" style="margin:0;flex:1">${deps.BTYPES[p.type].ico} ${p.title} · ${st ? st.nm : 'готово'}${why}</span><span class="meta" style="margin:0;min-width:40px;text-align:right">${pct}%</span></div>
        <div class="bar" style="height:4px;margin:0 0 2px"><i style="width:${pct}%"></i></div>`;
    }
    if (ps.length > 6) h += `<div class="meta">… и още ${ps.length - 6}</div>`;
    // липсващата техника: изпрати от най-близкия град със свободна или купи направо за града
    if (!here) {
      const miss = {}; for (const p of ps) if (p.waitGear) for (const t of p.waitNeed || []) miss[t] = (miss[t] || 0) + 1;
      for (const [t, n] of Object.entries(c.gearAdded || {})) if (miss[t]) miss[t] -= n;   // току-що купени или пратени
      const ts = Object.keys(miss).filter(t => miss[t] > 0 && deps.ECON.UNIT_TYPES[t]);
      if (ts.length) h += `<div class="row" style="margin:6px 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0"><span class="late">🚜 Липсва техника:</span></span>${ts.map(t => {
        const T = deps.ECON.UNIT_TYPES[t], src = deps.gearSrc(t, id), on = deps.gearComing(t, id);
        if (on) return `<span class="meta" style="margin:0;color:#7dd3ff">🚚 ${T.ico} ${T.nm} на път (ден ${on})</span>`;
        return `${src ? `<button class="btn2" data-cpsend="${t}|${id}|${src}" title="Транспорт 10% от цената">🚚 ${T.ico} ${T.nm} от ${deps.cityName(src)}</button>` : ''}<button class="btn" data-cpbuy="${t}|${id}" ${deps.econ().canAfford(T.cost) ? '' : 'disabled'}>🛒 ${T.ico} ${T.nm} · ${f(T.cost)} €</button>`;
      }).join('')}</div>`;
    }
    if (!here && (c.autoLog || []).length) h += `<div class="meta" style="margin-top:4px">✅ Последно: ${c.autoLog.slice(0, 3).map(x => `${x.t} (+${f(x.a)} €)`).join(' · ')}</div>`;
    // „🏁 Завърши града“ — само когато градът е готов (квартали, свободни парцели ≤ 1, при важните градове 0, пазарен дял ≥ 60%)
    const fs = deps.finishState(id), okExt = fs.ext >= fs.need, okFree = fs.free != null && fs.free <= (fs.freeMax ?? 1), okSh = fs.share >= 0.6;
    const canFin = here ? deps.canFinishHere() : okExt && okFree && okSh && fs.air !== false;
    const ck = ok => ok ? '✅' : '⬜';
    if (!canFin) h += `<div class="meta" style="margin:6px 0 0">🏁 За завършване: ${ck(okExt)} квартали ${fs.ext}/${fs.need} · ${ck(okFree)} свободни парцели ${fs.free == null ? '? (влез веднъж в града)' : `${fs.free} (най-много ${fs.freeMax ?? 1})`} · ${ck(okSh)} пазарен дял ${Math.round(fs.share * 100)}% (поне 60%)${fs.airNeed ? ` · ${ck(fs.air)} ✈️ летище` : ''}</div>`;
    // 📦 складът: автоматичното пълнене се включва и оттук (всеки град има свое — c.autoFill)
    if (!(c.autoFill && c.autoFill.on)) h += `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">📦 Склад: <span class="late">автоматичното пълнене е изключено</span></span><button class="btn2" data-cpaf="${id}" title="Складът сам поръчва ТИР-ове с материали (до 50 000 € на ден)">🔄 Включи</button></div>`;
    // 🏘️ нови квартали — купуват се и оттук, без да влизаш в града
    const dq = deps.district && !deps.isFinished(id) ? deps.district(id) : null;
    if (dq && dq.ext < dq.max) h += `<div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0 auto 0 0">🏘️ Квартали <b style="color:var(--txt)">${dq.ext}/${dq.max}</b>${dq.ext < fs.need ? ` · за завършване ${fs.need}` : ''}</span>
      <button class="btn" data-cpdist="${id}|0" ${deps.econ().canAfford(dq.cost) ? '' : 'disabled'}>🏘️ Купи квартал · ${f(dq.cost)} €</button>
      ${dq.max - dq.ext > 1 ? `<button class="btn2" data-cpdist="${id}|1" ${deps.econ().canAfford(dq.all) ? '' : 'disabled'}>Всички ${dq.max - dq.ext} · ${f(dq.all)} €</button>` : ''}</div>`;
    h += `<div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px;flex-wrap:wrap">
      ${here ? '' : `<button class="btn2" data-cpgo="${id}">➡️ Влез</button>`}
      ${canFin ? `<button class="btn" data-cpfin="${id}" title="Завършва града направо оттук">🏁 Завърши града</button>` : ''}</div></div>`;
    return h;
  }
  function winHtml() {
    const s = S(), own = deps.ownedCities();
    const order = [...own].sort((a, b) => (b === s.cityId) - (a === s.cityId) || deps.isFinished(a) - deps.isFinished(b) || devOf(rec(b) || {}).lv - devOf(rec(a) || {}).lv);
    const on = own.filter(id => id !== s.cityId && auto(id) && !deps.isFinished(id)).length, open = own.filter(id => !deps.isFinished(id) && id !== s.cityId);
    let h = `<div class="card"><div class="meta" style="margin:0">Тук управляваш всички градове, без да влизаш във всеки. С <b>🤖 Автопилот</b> градът сам приема поръчки и ги строи със своята техника, а парите и опитът идват всеки ден.
      Нивото на всеки град расте от обектите в него; летищата се отключват, щом <b>един</b> град стигне ниво 9.</div>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px"><span class="meta" style="margin:0 auto 0 0">🤖 включен в ${on} от ${open.length} града</span>
      <button class="btn2" data-cpall="1">🤖 Включи всички</button><button class="btn2" data-cpall="0">Изключи всички</button></div></div>`;
    const shown = order.filter(id => !deps.inScope || deps.inScope(id));   // обхватът горе: България · Балкани · Европа · …
    for (const id of shown) h += cityCard(id);
    if (!shown.length) h += '<div class="card"><div class="meta" style="margin:0">Нямаш градове в този обхват.</div></div>';
    return h;
  }
  function bind(body, redraw) {
    const mark = (id, t) => { const c = S().cities[id]; if (c) { c.gearAdded = c.gearAdded || {}; c.gearAdded[t] = (c.gearAdded[t] || 0) + 1; } };
    body.querySelectorAll('[data-cpauto]').forEach(b => b.onchange = () => { const s = S(); s.autoCity = { ...(s.autoCity || {}), [b.dataset.cpauto]: b.checked }; deps.save(); redraw(); });
    body.querySelectorAll('[data-cpall]').forEach(b => b.onclick = () => { const s = S(), v = b.dataset.cpall === '1'; s.autoCity = Object.fromEntries(deps.ownedCities().filter(id => id !== s.cityId).map(id => [id, v])); deps.save(); redraw(); });
    body.querySelectorAll('[data-cpsend]').forEach(b => b.onclick = () => { const [t, id, from] = b.dataset.cpsend.split('|'); if (deps.gearSend(t, from, id)) mark(id, t); redraw(); });
    body.querySelectorAll('[data-cpbuy]').forEach(b => b.onclick = () => { const [t, id] = b.dataset.cpbuy.split('|'); const n0 = deps.unitCount(id); deps.gearBuy(t, id); if (deps.unitCount(id) > n0) mark(id, t); redraw(); });
    body.querySelectorAll('[data-cpdist]').forEach(b => b.onclick = () => { const [id, all] = b.dataset.cpdist.split('|'); deps.buyDistrict(id, all === '1'); redraw(); });
    body.querySelectorAll('[data-cpaf]').forEach(b => b.onclick = () => { const c = rec(b.dataset.cpaf); if (c) { c.autoFill = { budget: 50000, spent: 0, day: S().day, ...(c.autoFill || {}), on: true }; deps.save(); } redraw(); });
    body.querySelectorAll('[data-cpgo]').forEach(b => b.onclick = () => deps.goCity(b.dataset.cpgo, null));
    body.querySelectorAll('[data-cpfin]').forEach(b => b.onclick = () => { if (b.dataset.cpfin === S().cityId || !deps.finishRemote) deps.goCity(b.dataset.cpfin, 'hq'); else { deps.finishRemote(b.dataset.cpfin); redraw(); } });
  }
  return { winHtml, bind, dailyTick, stash, workDay, addXp };
}
