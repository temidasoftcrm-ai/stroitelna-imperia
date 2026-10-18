// boardlogic.js — логиката на борда на директорите: 🗳️ гласуване при отказ на банката, 💼 месечни бюджети и 🤖 автопилот по директор.
// Предложенията идват от game.js boardProposals() (през group.js proposals()); решенията минават през group.js decide().
// Записът: S.hold.budget = { [dir]: €/месец }, S.hold.spent = { [dir]: € този месец, m: номер на месеца }, S.hold.auto = { [dir]: таван € (0 = изкл.) },
//          S.hold.mood = 0…1 (настроение на борда: пада при вето срещу мнозинството), S.hold.votes = [последните гласувания].
// deps: { S(), econ(), fmt, toast, save, sound?, proposals() → [{ id, dir, cost, text, ico, can }], decide(id, 'yes'|'no'|'later'),
//         dirName(dir) → име на назначения директор или '', subName(dir), dailyCost?() → разходите на ден (за резерва), loan?(amt) → кредит от своята банка }
export const DIRS = ['con', 'rail', 'hw', 'air', 'sea', 'oil', 'bank', 'hotel'];
export const DIR_ICO = { con: '🏗️', rail: '🚆', hw: '🛣️', air: '✈️', sea: '⚓', oil: '🛢️', bank: '🏦', hotel: '🏨' };
const CASH_SHARE = 0.3;    // банката възразява, ако едно решение струва над 30% от касата…
const RESERVE_DAYS = 30;   // …или оставя по-малко от месец разходи
const VETO_MOOD = 0.15, VETO_REP = 0.1;

export function createBoardLogic(deps) {
  const hold = () => { const S = deps.S(); S.hold = S.hold || {}; const h = S.hold; h.budget = h.budget || {}; h.spent = h.spent || {}; h.auto = h.auto || {}; if (h.mood == null) h.mood = 0.8; return h; };
  const month = () => Math.floor((deps.S().day || 0) / 30);
  const spentOf = dir => { const h = hold(); if (h.spent.m !== month()) { h.spent = { m: month() }; } return h.spent[dir] || 0; };
  const budgetOf = dir => hold().budget[dir] || 0;   // 0 = без бюджет (всяко решение минава през борда)
  const budgetLeft = dir => Math.max(0, budgetOf(dir) - spentOf(dir));
  const f = n => deps.fmt(Math.round(n));
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${f(n)} €`;
  const hired = () => DIRS.filter(d => deps.dirName(d));
  // детерминиран „случаен“ избор по предложение и ден — гласът не се сменя при всяко пречертаване
  const rnd = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

  // 🏦 проверка на банката: { ok, why }
  function bankCheck(p) {
    const e = deps.econ(), cost = p.cost || 0; if (!cost) return { ok: true };
    const reserve = (deps.dailyCost ? deps.dailyCost() : 0) * RESERVE_DAYS;
    if (cost > e.money) return { ok: false, why: `струва ${B(cost)}, а в касата има ${B(Math.max(0, e.money))}` };
    if (cost > e.money * CASH_SHARE) return { ok: false, why: `изяжда ${Math.round(cost / e.money * 100)}% от касата (над ${CASH_SHARE * 100}%)` };
    if (e.money - cost < reserve) return { ok: false, why: `остават под месец разходи (${B(reserve)})` };
    return { ok: true };
  }
  // 🗳️ гласуване: всеки назначен директор гласува според интереса си; връща { votes: [{ dir, name, yes, why }], yes, no, tie, passed }
  function vote(p) {
    const all = deps.proposals(), bc = bankCheck(p), votes = [];
    for (const d of hired()) {
      const name = deps.dirName(d), key = `${p.id}|${d}|${deps.S().day}`;
      let yes, why;
      if (d === p.dir) { yes = true; why = 'моето предложение'; }
      else if (d === 'bank') { yes = bc.ok; why = bc.ok ? 'финансирането е наред' : `рисково: ${bc.why}`; }
      else {
        const mine = all.filter(q => q.dir === d && q.cost).reduce((a, q) => a + q.cost, 0);   // колко чака неговото дружество
        if (mine > 0 && rnd(key) < 0.35 + Math.min(0.4, mine / Math.max(1, (p.cost || 1) * 4))) { yes = false; why = `чакат ${B(mine)} за ${deps.subName(d) || d}`; }
        else { yes = rnd(key + 'y') < 0.75 + (hold().mood - 0.5) * 0.4; why = yes ? 'полезно за холдинга' : 'не сега'; }
      }
      votes.push({ dir: d, name, yes, why });
    }
    const yes = votes.filter(v => v.yes).length, no = votes.length - yes;
    return { votes, yes, no, tie: yes === no, passed: yes > no, bank: bc };
  }
  // решение с проверките: бюджет → (банка → гласуване) → решение. Връща { done, need: 'vote', v } — group.js показва гласуването и вика resolve()
  function request(id) {
    const p = deps.proposals().find(q => q.id === id); if (!p) return { done: false };
    if (p.cost && p.cost <= budgetLeft(p.dir)) return commit(p, 'бюджет');   // в рамките на месечния бюджет — директорът действа сам
    const bc = bankCheck(p); if (bc.ok) return commit(p, 'борд');
    const v = vote(p); hold().votes = [{ id, day: deps.S().day, yes: v.yes, no: v.no, dir: p.dir }, ...(hold().votes || [])].slice(0, 20); deps.save();
    return { done: false, need: 'vote', v, p };
  }
  // след гласуването: how = 'pass' (мнозинство „за“ или ти при равенство), 'veto' (налагаш срещу мнозинството), 'loan' (кредит от своята банка), 'drop'
  function resolve(id, how) {
    const p = deps.proposals().find(q => q.id === id); if (!p) return { done: false };
    if (how === 'drop') { deps.decide(id, 'later'); return { done: false }; }
    if (how === 'veto') { const h = hold(); h.mood = Math.max(0, h.mood - VETO_MOOD); const S = deps.S(); S.rep = Math.max(0, (S.rep || 0) - VETO_REP); deps.toast(`⚖️ Наложи решението срещу борда — настроението на директорите пада (${Math.round(h.mood * 100)}%), −${VETO_REP} ★.`, 'bad'); }
    if (how === 'loan' && deps.loan) { const need = Math.max(0, (p.cost || 0) - deps.econ().money * CASH_SHARE); if (need > 0 && !deps.loan(need)) return { done: false }; }
    return commit(p, how === 'pass' ? 'гласуване' : how === 'veto' ? 'вето' : 'кредит');
  }
  function commit(p, via) {
    if (p.cost && !deps.econ().canAfford(p.cost)) { deps.toast(`Нямаш ${B(p.cost)}.`, 'bad'); return { done: false }; }
    const h = hold(); spentOf(p.dir); h.spent[p.dir] = (h.spent[p.dir] || 0) + (p.cost || 0);
    if (via !== 'вето') h.mood = Math.min(1, h.mood + 0.02);
    deps.decide(p.id, 'yes'); deps.save();
    return { done: true, via };
  }
  // 🤖 автопилот (веднъж на ден): одобрява сам предложенията на директора до тавана му — само в рамките на бюджета и ако банката е спокойна
  function autoTick() {
    const h = hold(), done = [];
    for (const p of deps.proposals()) {
      const cap = h.auto[p.dir] || 0; if (!cap || (p.cost || 0) > cap) continue;
      if (budgetOf(p.dir) && (p.cost || 0) > budgetLeft(p.dir)) continue;
      if (!bankCheck(p).ok) continue;
      const r = commit(p, 'автопилот'); if (r.done) done.push(p);
      if (done.length >= 6) break;   // не повече от 6 на ден — да не изпразни касата наведнъж
    }
    if (done.length) deps.toast(`🤖 Автопилот: ${done.map(p => `${DIR_ICO[p.dir] || ''} ${p.text.split('.')[0].slice(0, 60)}`).join(' · ')}`, 'good');
    return done.length;
  }
  const setBudget = (dir, v) => { hold().budget[dir] = Math.max(0, v); deps.save(); };
  const setAuto = (dir, v) => { hold().auto[dir] = Math.max(0, v); deps.save(); };
  // ⚙️ настройките на директорите: бюджет на месец и таван на автопилота (за всеки назначен) — group.js го вгражда в „Дружества“ или в залата
  const STEPS = [0, 1e6, 1e7, 1e8, 5e8, 1e9, 5e9, 2e10];
  function settingsHtml() {
    const ds = hired(); if (!ds.length) return '';
    const sel = (kind, d, cur) => `<select data-bl="${kind}|${d}" style="min-width:120px">${STEPS.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v ? B(v) : kind === 'auto' ? 'изключен' : 'без бюджет'}</option>`).join('')}</select>`;
    return `<div class="card"><h3 style="margin:0 0 6px">💼 Бюджети и 🤖 автопилот</h3><div class="meta" style="margin:0 0 8px">До месечния бюджет директорът действа сам. Над него решава бордът, а ако банката възрази (над ${CASH_SHARE * 100}% от касата или под месец резерв), се гласува. Автопилотът одобрява сам предложенията до тавана си, всеки ден. Настроение на борда: <b style="color:${hold().mood >= 0.6 ? 'var(--ok)' : 'var(--bad)'}">${Math.round(hold().mood * 100)}%</b></div>
      ${ds.map(d => `<div class="row" style="margin:4px 0;gap:8px;align-items:center;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1 1 180px">${DIR_ICO[d] || ''} <b style="color:var(--txt)">${deps.dirName(d)}</b> · ${deps.subName(d) || d}${budgetOf(d) ? ` · похарчени ${B(spentOf(d))} от ${B(budgetOf(d))}` : ''}</span><span class="meta" style="margin:0">💼 ${sel('budget', d, budgetOf(d))}</span><span class="meta" style="margin:0">🤖 ${sel('auto', d, hold().auto[d] || 0)}</span></div>`).join('')}</div>`;
  }
  function bindSettings(box, rerender) {
    box.querySelectorAll('[data-bl]').forEach(s => s.onchange = () => { const [k, d] = s.dataset.bl.split('|'); (k === 'budget' ? setBudget : setAuto)(d, +s.value); rerender && rerender(); });
  }
  // HTML на резултата от гласуването (за прозорец/залата): гласовете и бутоните за решение
  function voteHtml(r) {
    const { v, p } = r;
    return `<div class="meta" style="margin:0 0 6px">🏦 Банката възрази: ${v.bank.why}. Бордът гласува за „${p.text.slice(0, 90)}${p.text.length > 90 ? '…' : ''}“ (${B(p.cost)}):</div>
      ${v.votes.map(x => `<div class="meta" style="margin:2px 0">${x.yes ? '✋✅' : '✋❌'} <b style="color:var(--txt)">${x.name}</b> · ${DIR_ICO[x.dir] || ''} — ${x.why}</div>`).join('')}
      <div style="margin:8px 0 4px;font-weight:800;font-size:16px;color:${v.passed ? 'var(--ok)' : v.tie ? 'var(--acc)' : 'var(--bad)'}">${v.yes} : ${v.no} — ${v.passed ? 'приема се' : v.tie ? 'равен глас — решаваш ти' : 'отхвърля се'}</div>
      <div class="row" style="margin:6px 0 0;gap:6px;flex-wrap:wrap">${v.passed || v.tie ? `<button class="btn" data-bv="${p.id}|pass">✓ ${v.tie ? 'Решавам „за“' : 'Изпълни'}</button>` : `<button class="btn2" data-bv="${p.id}|veto" title="−${VETO_REP} ★, по-лошо настроение на борда">⚖️ Наложи (вето)</button>`}${deps.loan ? `<button class="btn2" data-bv="${p.id}|loan">🏦 С кредит от банката</button>` : ''}<button class="btn2" data-bv="${p.id}|drop">⏳ Отложи</button></div>`;
  }
  return { bankCheck, vote, request, resolve, autoTick, setBudget, setAuto, budgetLeft, budgetOf, spentOf, settingsHtml, bindSettings, voteHtml, mood: () => hold().mood };
}
