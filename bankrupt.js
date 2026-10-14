// bankrupt.js — 💥 фалит на фирмата, ако играчът я докара до дълъг минус.
// 1) Сметката е на минус → 1% лихва на ден (economy.js) и предупреждение.
// 2) Несъстоятелност: RED_DAYS поредни дни на минус или минус под лимита (10% от активите, поне 50 000 €)
//    → червена лента горе с обратно броене GRACE дни: вземи кредит, продай техника, акции, имоти…
// 3) Срокът изтече и пак си на минус → ФАЛИТ: синдикът продава депозита, акциите и техниката (първо в другите градове,
//    първо най-скъпата), докато дългът се покрие; −1.5 ★. Ако и това не стига — фирмата фалира окончателно (край на играта).
// Записът: S.bust = { red, stage: 'ins' | null, until, n (колко фалита) }
// deps: { S(), econ(), toast, modal(title, html, buttons), fmt, save, sound?(n), pop?(key, cap, sub),
//         sellHere(type) → продава единица от града, в който си (без съобщение), unitsHere() → [type],
//         cityName(id), newGame(), openSaves(), playDays?() }
export const RED_DAYS = 14, GRACE = 15, LIMIT_MIN = 50000, LIMIT_SHARE = 0.1, REP_LOSS = 1.5;

export function createBankrupt(deps) {
  const st = () => { const S = deps.S(); return S.bust = S.bust || { red: 0, stage: null, until: 0, n: 0 }; };
  const E = () => deps.econ(), f = n => deps.fmt(Math.round(n));
  // активите, които синдикът може да продаде (техниката — на половин цена)
  function assets() {
    const e = E(), S = deps.S();
    const fleet = [...deps.unitsHere(), ...Object.values(S.cities || {}).flatMap(c => (c && c.units) || [])].reduce((a, t) => a + e.sellPrice(t), 0);
    return Math.max(0, (e.s.deposit || 0) + (e.s.depReady || 0) + e.portfolioValue() + fleet);
  }
  const limit = () => Math.max(LIMIT_MIN, assets() * LIMIT_SHARE);

  // ---- червената лента горе
  let bar = null;
  function banner() {
    const b = st(), S = deps.S(), money = E().s.money;
    const show = S && (b.stage === 'ins' || (b.over && money < 0));
    if (!show) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'bustBar';
      bar.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 96px);transform:translateX(-50%);z-index:9;background:linear-gradient(90deg,#7a1010,#b3261e);color:#fff;border:1px solid #ff8a80;border-radius:10px;padding:7px 14px;font-weight:700;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.45);cursor:pointer;max-width:calc(100vw - 32px);text-align:center';
      bar.onclick = () => st().over ? gameOver(-E().s.money, []) : explain();
      document.body.appendChild(bar);
    }
    const left = Math.max(0, b.until - S.day);
    if (b.over) { bar.innerHTML = `💀 Фирмата фалира · дълг ${f(-money)} € <span style="font-weight:400;opacity:.85">— нова игра или зареди запис</span>`; return; }
    bar.innerHTML = `⚠️ Несъстоятелност · ${f(money)} € · ${left ? `фалит след ${left} д.` : 'фалит днес'} <span style="font-weight:400;opacity:.85">— какво да направя?</span>`;
  }
  function explain() {
    const b = st(), S = deps.S(), left = Math.max(0, b.until - S.day);
    deps.modal('⚠️ Фирмата е в несъстоятелност', `Сметката е на <b style="color:var(--bad)">${f(E().s.money)} €</b>. Ако след <b>${left} дни</b> все още си на минус, фирмата фалира:
      синдикът продава депозита, акциите и техниката ти (на половин цена), докато покрие дълга, и губиш ${REP_LOSS} ★. Ако и това не стига — играта свършва.<br><br>
      <b>Как да се спасиш:</b><br>🏦 вземи кредит от банката · 📈 продай акции · 🚜 продай излишна техника · 🏠 продай имоти · 🏝️ продай курорт ·
      ⏸ спри скъпите строежи и надграждания · 📦 изключи автоматичното пълнене на складовете.`, [['Разбрах', null]]);
  }

  // ---- синдикът: продава, докато сметката излезе на нула
  function liquidate() {
    const e = E(), S = deps.S(), sold = [];
    const need = () => -e.s.money;
    if (need() > 0 && e.s.depReady > 0) sold.push(`💰 лихва по депозита ${f(e.collectInterest())} €`);
    if (need() > 0 && e.s.deposit > 0) sold.push(`🏦 депозит ${f(e.depositOut(e.s.deposit))} €`);
    if (need() > 0) { let got = 0; for (const id of Object.keys(e.s.shares || {})) { if (need() <= 0) break; got += e.sellShares(id); } if (got) sold.push(`📈 акции ${f(got)} €`); }
    // техниката: първо в другите градове, първо най-скъпата (по-малко бройки за същия дълг)
    const pool = [];
    for (const [id, c] of Object.entries(S.cities || {})) for (const t of (c && c.units) || []) pool.push({ id, t, p: e.sellPrice(t) });
    pool.sort((a, b) => b.p - a.p);
    const here = deps.unitsHere().map(t => ({ id: null, t, p: e.sellPrice(t) })).sort((a, b) => b.p - a.p);
    const byCity = {};
    for (const u of [...pool, ...here]) {
      if (need() <= 0) break;
      if (u.id) { const c = S.cities[u.id], i = c.units.indexOf(u.t); if (i < 0) continue; c.units.splice(i, 1); if (c.unitXp) c.unitXp.splice(i, 1); e.sellUnit(u.t); }
      else if (!deps.sellHere(u.t)) continue;
      const k = u.id ? deps.cityName(u.id) : 'тук'; byCity[k] = (byCity[k] || 0) + 1;
    }
    const nU = Object.values(byCity).reduce((a, b) => a + b, 0);
    if (nU) sold.push(`🚜 ${nU} машини и бригади (${Object.entries(byCity).slice(0, 6).map(([k, n]) => `${k} ×${n}`).join(', ')}${Object.keys(byCity).length > 6 ? '…' : ''})`);
    return sold;
  }
  function bankrupt() {
    const b = st(), S = deps.S(), debt = -E().s.money;
    const sold = liquidate();
    b.n = (b.n || 0) + 1; b.stage = null; b.red = 0; banner();
    S.rep = Math.max(0, (S.rep || 0) - REP_LOSS);
    if (deps.sound) deps.sound('error');
    if (E().s.money >= 0) {
      deps.modal('💥 ФАЛИТ', `<img src="assets/ui/bankrupt.webp" alt="" onerror="this.remove()" style="display:block;width:100%;max-width:300px;max-height:300px;object-fit:contain;margin:0 auto 8px">Фирмата не излезе от минуса навреме (${f(debt)} € дълг). Синдикът продаде:<br>${sold.map(x => '• ' + x).join('<br>') || '• нищо'}<br><br>
        Дългът е покрит — сега имаш ${f(E().s.money)} €. Репутацията падна с ${REP_LOSS} ★ (сега ${S.rep.toFixed(1)} ★).<br>Фирмата оцеля — започни отново, по-внимателно 🙂`, [['Продължи', null]]);
      if (deps.pop) deps.pop('bankrupt', '💥 Фалит', `Синдикът продаде активи за ${f(debt)} € · −${REP_LOSS} ★`);
      deps.save();
      return;
    }
    gameOver(debt, sold);
  }
  function gameOver(debt, sold) {
    const S = deps.S(), b = st(); b.over = true; deps.save(); banner();
    deps.modal('💀 Фирмата фалира окончателно', `<img src="assets/ui/bankrupt.webp" alt="" onerror="this.remove()" style="display:block;width:100%;max-width:300px;max-height:300px;object-fit:contain;margin:0 auto 8px">${sold.length ? `Синдикът продаде всичко, което можа:<br>${sold.map(x => '• ' + x).join('<br>')}<br><br>` : ''}
      Пак остават <b style="color:var(--bad)">${f(-E().s.money)} €</b> дълг. Империята приключи на ден ${S.day}${deps.playDays ? ` (${deps.playDays()})` : ''}.<br><br>
      Можеш да започнеш отначало или да заредиш по-стар запис от „💾 Записи“.`, [['💾 Записи', () => deps.openSaves()], ['🔄 Нова игра', () => deps.newGame()]], { noClose: true });
  }

  // ---- всеки ден (след сметките на деня)
  function dailyTick() {
    const S = deps.S(); if (!S) return;
    const b = st(), money = E().s.money;
    if (b.over && money < 0) { banner(); return; }   // окончателният фалит — чака нова игра или зареждане
    if (b.over) b.over = false;
    if (money >= 0) {
      if (b.stage === 'ins') { deps.toast('✅ Фирмата излезе от несъстоятелността! Сметката е на плюс.', 'good'); if (deps.sound) deps.sound('done'); }
      b.red = 0; b.stage = null; banner(); return;
    }
    b.red++;
    if (b.stage !== 'ins' && (b.red >= RED_DAYS || -money > limit())) {
      b.stage = 'ins'; b.until = S.day + GRACE;
      if (deps.sound) deps.sound('error');
      explain(); deps.save();
    } else if (b.stage === 'ins' && S.day >= b.until) { bankrupt(); return; }
    else if (b.stage === 'ins') { const left = b.until - S.day; if (left <= 5 || left % 5 === 0) deps.toast(`⚠️ Несъстоятелност: ${left} дни до фалита — сметката е ${f(money)} €.`, 'bad'); }
    else if (b.red === 1 || b.red % 4 === 0) deps.toast(`💸 Сметката е на минус (${f(money)} €) от ${b.red} д. След ${RED_DAYS} дни на минус или под −${f(limit())} € започва несъстоятелност.`, 'bad');
    banner();
  }
  // за финансите: кратко състояние
  function statusHtml() {
    const b = st(), S = deps.S(), money = E().s.money;
    if (b.stage === 'ins') return `<div class="meta late">⚠️ Несъстоятелност — фалит след ${Math.max(0, b.until - S.day)} д., ако не излезеш на плюс.</div>`;
    if (money < 0) return `<div class="meta late">На минус ${b.red} д. (1% лихва на ден). Несъстоятелност след ${Math.max(0, RED_DAYS - b.red)} д. или под −${f(limit())} €.</div>`;
    return '';
  }
  return { dailyTick, banner, statusHtml, explain, limit, state: st, bankrupt };
}
