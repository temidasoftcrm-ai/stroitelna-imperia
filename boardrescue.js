// boardrescue.js — 🆘 Борис (банката) пази холдинга от липса на пари:
//   • предложение към борда: касата е под месечния резерв или банката е под капиталовия минимум (кредитите > капитала × лоста)
//     → да пуснем още 10% от холдинга на борсата (при банката — парите отиват в капитала ѝ);
//   • ⛔ извънредно заседание (group.js emergency), ако касата падне на минус или банката остане без капитал под кредитите си:
//     „Одобри“ — продажба на 10% акции (ако може), „🏦 С кредит“ — стабилизационен кредит; по принцип не става, но за всеки случай.
// deps: { S(), econ(), corp (corp.js), bank (bank.js), frame() (boardlogic.js), lv() (нивото), ipoLv (17), fmt, toast, emergency(item) (group.js) }
const RESCUE_GAP = 20;   // дни между две извънредни заседания за едно и също

export function createRescue(deps) {
  const f = n => deps.fmt(Math.round(n)), M = n => Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} млрд. €` : `${f(n / 1e6)} млн. €`;
  const corp = () => deps.corp, bank = () => deps.bank;
  // колко ще донесат следващите 10% (както corp.sellTranche) и може ли изобщо (до 49% навън, от нивото на борсата)
  const tranche = () => { const c = corp(); if (!c || deps.lv() < (deps.ipoLv || 17)) return 0; const ipo = c.state().ipo; if (ipo && ipo.out + c.TRANCHE > c.IPO_MAX + 1e-9) return 0; return Math.round(c.myValue() * (ipo ? ipo.mood : 1) * c.TRANCHE * 0.95 / 1e6) * 1e6; };
  const outPct = () => { const c = corp(), ipo = c && c.state().ipo; return Math.round(((ipo ? ipo.out : 0) + (c ? c.TRANCHE : 0.1)) * 100); };
  // капиталовият недостиг на банката: кредитите не могат да са повече от капитала × лоста (bank.capNeed)
  const capGap = () => { const b = bank(); return b && b.state() && b.capNeed ? b.capNeed() : 0; };
  // при банката — продаваме и вливаме в капитала ѝ
  function sellFor(toBank) {
    const e = deps.econ(), m0 = e.money; corp().sellTranche(); const got = Math.max(0, e.money - m0);
    if (toBank && got > 0) bank().addCap(Math.min(got, Math.max(toBank, 0)));
    return got;
  }

  // 📈 предложенията на Борис (в boardProposals на game.js): касата под резерва / банката под минимума
  function proposals() {
    const out = [], S = deps.S(); if (!S || !S.holding) return out;
    const tr = tranche(); if (!tr) return out;
    const F = deps.frame ? deps.frame() : null, gap = capGap(), ipo = corp().state().ipo, key = Math.round((ipo ? ipo.out : 0) * 100);
    if (gap > 0) out.push({ id: `bank:ipocap${key}:1`, dir: 'bank', ico: '📈', noAuto: true, cost: 0, count: 1, days: 0,
      text: `Банката е под капиталовия минимум: кредитите ѝ искат още ${M(gap)} капитал. Предлагам да пуснем още 10% от холдинга на борсата (~${M(tr)}) и парите да влязат в капитала на банката (външните ще имат ${outPct()}%).`,
      why: 'иначе банката не може да отпуска нови кредити и рискува при неплащания', gainTxt: `~${M(tr)} — ${M(Math.min(gap, tr))} в капитала на банката`, apply: () => sellFor(gap) });
    else if (F && F.cash < F.op) out.push({ id: `bank:ipolow${key}:1`, dir: 'bank', ico: '📈', noAuto: true, cost: 0, count: 1, days: 0,
      text: `Касата (${M(F.cash)}) е под месечния резерв (${M(F.op)}). Предлагам да пуснем още 10% от холдинга на борсата — ~${M(tr)} веднага (външните ще имат ${outPct()}%).`,
      why: 'капитал без лихва; контролът остава наш до 49%', gainTxt: `~${M(tr)} веднага`, apply: () => sellFor(0) });
    return out;
  }

  // ⛔ всеки ден: касата на минус или банката без капитал под кредитите → извънредно заседание (веднъж на RESCUE_GAP дни)
  function dailyCheck() {
    const S = deps.S(); if (!S || !S.holding || !deps.emergency) return;
    const e = deps.econ(), day = S.day || 0, h = S.hold = S.hold || {}, gap = capGap(), b = bank() && bank().state(), bankNeg = !!(b && gap > 0 && b.cap <= 0);
    const cashNeg = e.money < 0; if (!cashNeg && !bankNeg) return;
    const kind = cashNeg ? 'cash' : 'bank'; if ((h.rescueAt || {})[kind] > day) return;
    const need = cashNeg ? -e.money + Math.max(0, deps.frame ? deps.frame().op : 0) : gap, tr = tranche(), rep = S.rep || 0;
    const step = e.loanStep(rep), room = e.loanRoom(rep), loanAmt = Math.min(room, Math.max(1, Math.ceil(need / step)) * step);
    if (!tr && !loanAmt) return;
    const ok = deps.emergency({ id: `rescue:${kind}:${day}`, ico: '🆘', dir: 'bank', alarm: true, alarmTxt: cashNeg ? `⚠ Касата: ${M(e.money)}` : `⚠ Банката: липсват ${M(gap)} капитал`, short: cashNeg ? `касата е на минус (${M(e.money)})` : 'банката остана без капитал',
      text: cashNeg ? `Касата е на минус: ${M(e.money)}. Трябват ни ~${M(need)}, за да се върнем над резерва. ${tr ? `Предлагам да продадем 10% от холдинга на борсата (~${M(tr)})` : 'Акции вече не можем да продаваме'}${loanAmt ? `${tr ? ' или ' : '. Остава '}стабилизационен кредит ${M(loanAmt)}` : ''}.`
        : `Неплащанията изядоха капитала на банката — кредитите ѝ искат още ${M(gap)}. ${tr ? `Предлагам да продадем 10% от холдинга (~${M(tr)}) и да ги влеем в банката` : 'Акции вече не можем да продаваме'}${loanAmt ? `${tr ? ' или ' : '. Остава '}кредит ${M(loanAmt)} за капитала ѝ` : ''}.`,
      why: cashNeg ? 'на минус фирмата фалира след 15 дни — продават ни техниката и акциите на половин цена' : 'без капитал банката не може да покрие загубите си',
      value: need, cost: 0, gainTxt: tr ? `~${M(tr)} от борсата, без лихва` : `${M(loanAmt)} кредит`, until: day + RESCUE_GAP,
      live: () => cashNeg ? deps.econ().money < 0 : capGap() > 0,
      accept: () => { if (tr) sellFor(cashNeg ? 0 : gap); else if (e.takeLoan(rep, loanAmt) && !cashNeg) bank().addCap(loanAmt); },
      loan: loanAmt ? () => { if (e.takeLoan(rep, loanAmt)) { deps.toast(`🏦 Стабилизационен кредит: +${M(loanAmt)}.`, 'good'); if (!cashNeg) bank().addCap(loanAmt); } } : null,
      loanWhy: loanAmt ? `кредит ${M(loanAmt)} — с лихва, но без да продаваме дялове` : '',
      decline: () => {} });
    if (ok) { (h.rescueAt = h.rescueAt || {})[kind] = day + RESCUE_GAP; }
  }
  return { proposals, dailyCheck, tranche, capGap };
}
