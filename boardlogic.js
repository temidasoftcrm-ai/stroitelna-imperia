// boardlogic.js — логиката на борда на директорите (етап 1 по плана на играча):
//   🏦 финансова рамка (налични · резервирани за одобрени проекти · оперативен резерв · достъпни за нови решения),
//   📋 одобрението създава ангажимент (резервиран бюджет, отговорен директор, срок, измерима цел),
//   📊 отчет за предишните решения (изпълнено · в процес · забавено · блокирано — с причината от играта) и действия по него,
//   🗳️ съвещателен вот с обяснения (последната дума е твоя), 💼 месечни бюджети × доверие, 🤖 автопилот, 🤝 доверие към директора.
// Предложенията идват от game.js boardProposals() (през group.js proposals()); изпълнението — през group.js decide().
// Записът (S.hold): budget { dir: €/месец }, spent { dir: €, m }, auto { dir: таван € }, mood 0…1, trust { dir: 0.5…1.3 },
//   commits [{ cid, dir, text, cost, spent0, reserved, start, due, days, gain, track, st: 'active'|'done'|'stop', end, late }], votes [...]
// deps: { S(), econ(), fmt, toast, save, sound?, proposals(), decide(id, a), dirName(dir), subName(dir), dailyCost?() → разходи/ден,
//         loan?(amt), trackStatus?(track) → { done, total, reason, blocked }, fixTrack?(track) → bool (пренасочва/купува липсващото) }
export const DIRS = ['con', 'rail', 'hw', 'air', 'sea', 'oil', 'bank', 'hotel', 'glob', 'mayor'];
export const DIR_ICO = { con: '🏗️', rail: '🚆', hw: '🛣️', air: '✈️', sea: '⚓', oil: '🛢️', bank: '🏦', hotel: '🏨', glob: '🌍', mayor: '🏙️' };
const CASH_SHARE = 0.3;    // банката възразява, ако едно решение изяжда над 30% от свободните пари…
const RESERVE_DAYS = 30;   // …или оставя оперативен резерв под месец разходи
const MAX_COMMITS = 60;

export function createBoardLogic(deps) {
  const hold = () => { const S = deps.S(); S.hold = S.hold || {}; const h = S.hold; h.budget = h.budget || {}; h.spent = h.spent || {}; h.auto = h.auto || {}; h.trust = h.trust || {}; h.commits = h.commits || []; if (h.mood == null) h.mood = 0.8; return h; };
  const day = () => deps.S().day || 0, month = () => Math.floor(day() / 30);
  const spentOf = dir => { const h = hold(); if (h.spent.m !== month()) h.spent = { m: month() }; return h.spent[dir] || 0; };
  const trustOf = dir => hold().trust[dir] ?? 1;
  const budgetOf = dir => Math.round((hold().budget[dir] || 0) * Math.min(1.2, trustOf(dir)));   // доверието мести самостоятелния бюджет
  const budgetLeft = dir => Math.max(0, budgetOf(dir) - spentOf(dir));
  const f = n => deps.fmt(Math.round(n));
  const B = n => Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${f(n)} €`;
  const hired = () => DIRS.filter(d => deps.dirName(d));
  const nm = d => deps.dirName(d) || deps.subName(d) || d;

  // ---- 🏦 финансовата рамка: всичко е вече в касата, затова не приспадаме два пъти — резервираното е само неизхарченото от одобреното
  function frame() {
    const e = deps.econ(), cash = Math.max(0, Math.round(e.money)), reserved = active().reduce((a, c) => a + (c.reserved || 0), 0);
    const op = Math.round((deps.dailyCost ? deps.dailyCost() : 0) * RESERVE_DAYS), free = Math.max(0, cash - reserved - op);
    return { cash, reserved, op, free, loan: e.loanRoom ? e.loanRoom(deps.S().rep) : 0 };
  }
  const active = () => hold().commits.filter(c => c.st === 'active');
  function frameHtml() {
    const F = frame(), row = (k, v, col) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)"><span class="meta" style="margin:0">${k}</span><b style="color:${col || 'var(--txt)'}">${B(v)}</b></div>`;
    return `<div class="card"><h3 style="margin:0 0 6px">🏦 Финансова рамка</h3>${row('Налични пари', F.cash)}${row('Резервирани за одобрени проекти', -F.reserved, F.reserved ? 'var(--acc)' : '')}${row(`Оперативен резерв (${RESERVE_DAYS} дни разходи)`, -F.op)}${row('Достъпни за нови решения', F.free, 'var(--ok)')}${F.loan ? `<div class="meta" style="margin:4px 0 0">+ свободен кредит до ${B(F.loan)}</div>` : ''}</div>`;
  }
  // реч на Борис (банката) — първата реплика на заседанието
  function bankSpeech() {
    const F = frame();
    return `Разполагаме с ${B(F.cash)}. ${F.reserved ? `От тях ${B(F.reserved)} са поети ангажименти по одобрени проекти, а ` : ''}${B(F.op)} предлагам да останат като оперативен резерв. За нови инвестиции имаме ${B(F.free)}${F.loan ? ` (и кредит до ${B(F.loan)}, ако се наложи)` : ''}.`;
  }

  // ---- 🏦 проверка на банката срещу свободните пари
  function bankCheck(p) {
    const cost = p.cost || 0; if (!cost) return { ok: true };
    const F = frame();
    if (cost > F.cash) return { ok: false, why: `струва ${B(cost)}, а в касата има ${B(F.cash)}` };
    if (cost > F.free) return { ok: false, why: `след нея резервът пада под препоръчителното (свободни са ${B(F.free)})` };
    if (cost > F.free * CASH_SHARE * 2 && cost > F.cash * CASH_SHARE) return { ok: false, why: `изяжда ${Math.round(cost / Math.max(1, F.free) * 100)}% от свободните пари` };
    return { ok: true };
  }
  // ---- 🗳️ съвещателен вот: всеки директор гласува по правило и с обяснение; последната дума е на собственика
  function vote(p) {
    const all = deps.proposals().filter(q => !q.info && q.id !== p.id), bc = bankCheck(p), F = frame(), votes = [];
    for (const d of hired()) {
      let v = 'yes', why;
      if (d === p.dir) why = p.why || 'моето предложение';
      else if (d === 'bank') { v = bc.ok ? 'yes' : 'no'; why = bc.ok ? 'финансирането е в рамката' : bc.why; }
      else {
        const mine = all.filter(q => q.dir === d && q.inBudget).reduce((a, q) => a + (q.cost || 0), 0);   // колко от неговите вместени предложения ще изпаднат
        if (mine && (p.cost || 0) + mine > F.free) { v = 'no'; why = `ще остане без пари за ${deps.subName(d) || d} (${B(mine)})`; }
        else if (d === 'con' && p.needsGear) { v = 'cond'; why = `за, с условие: ${p.needsGear}`; }
        else if (p.synergy && p.synergy[d]) { why = p.synergy[d]; }
        else why = 'полезно за холдинга';
      }
      votes.push({ dir: d, name: nm(d), yes: v !== 'no', cond: v === 'cond', why });
    }
    const yes = votes.filter(v => v.yes).length, no = votes.length - yes;
    return { votes, yes, no, tie: yes === no, passed: yes >= no, bank: bc };
  }
  // ---- решение: до самостоятелния бюджет директорът действа сам; иначе — вот (показва се, щом някой е против или банката възразява)
  function request(id, opt = {}) {
    const p = find(id, opt.small); if (!p) return { done: false };
    if (p.info) return { done: true };
    if (p.cost && p.cost <= budgetLeft(p.dir)) return commit(p, 'бюджет');
    const v = vote(p);
    if (v.no === 0 && v.bank.ok) return commit(p, 'борд');
    hold().votes = [{ id: p.id, day: day(), yes: v.yes, no: v.no, dir: p.dir }, ...(hold().votes || [])].slice(0, 20); deps.save();
    return { done: false, need: 'vote', v, p };
  }
  // how: 'pass' (одобряваш — съвещателният вот не те задължава), 'small' (по-малкият вариант), 'loan', 'drop'
  function resolve(id, how) {
    if (how === 'drop') { deps.decide(id.replace(/\|small$/, ''), 'later'); return { done: false }; }
    const small = how === 'small' || /\|small$/.test(id), p = find(id.replace(/\|small$/, ''), small); if (!p) return { done: false };
    const v = vote(p);
    if (how === 'loan' && deps.loan) { const need = Math.max(0, (p.cost || 0) - frame().free); if (need > 0 && !deps.loan(need)) return { done: false }; }
    if (v.no > v.yes) { const h = hold(); h.mood = Math.max(0, h.mood - 0.05); }   // одобрено въпреки мнозинството — малко недоволство
    return commit(p, how === 'loan' ? 'кредит' : small ? 'по-малък вариант' : 'собственик');
  }
  // по-малкият вариант: предложението дава p.small → { ...по-малко обекти, cost, apply }
  const find = (id, small) => { const p = deps.proposals().find(q => q.id === id); return p && small && p.small ? { ...p, ...p.small, id: p.id, small: null, isSmall: true } : p; };

  // ---- 📋 одобрението създава ангажимент
  function commit(p, via) {
    if (p.cost && !deps.econ().canAfford(p.cost)) { deps.toast(`Нямаш ${B(p.cost)}.`, 'bad'); return { done: false }; }
    const h = hold(), before = deps.econ().money;
    spentOf(p.dir); h.spent[p.dir] = (h.spent[p.dir] || 0) + (p.cost || 0);
    if (p.isSmall) p.apply(); else deps.decide(p.id, 'yes');   // пълното — през group.js decide (пази историята); по-малкият вариант — направо тук
    const spent0 = Math.max(0, Math.round(before - deps.econ().money));
    if (p.track) {
      const c = { cid: (h.cseq = (h.cseq || 0) + 1), dir: p.dir, text: p.goal || p.text, cost: p.cost || 0, spent0, reserved: Math.max(0, (p.cost || 0) - spent0), start: day(), days: p.days || 30, due: day() + (p.days || 30), gain: p.gain || 0, track: p.track, st: 'active', via };
      h.commits = [c, ...h.commits].slice(0, MAX_COMMITS);
    }
    h.month = h.month || { m: month(), n: 0, sum: 0 }; if (h.month.m !== month()) h.month = { m: month(), n: 0, sum: 0 };
    h.month.n++; h.month.sum += p.cost || 0;
    if (via !== 'собственик') h.mood = Math.min(1, h.mood + 0.02);
    deps.save();
    return { done: true, via };
  }

  // ---- 📊 месечен контрол: статусите на ангажиментите от игровите данни
  function review() {
    const h = hold(), out = [];
    for (const c of h.commits) {
      if (c.st !== 'active') continue;
      const s = deps.trackStatus ? deps.trackStatus(c.track) : { done: 1, total: 1 };
      c.prog = s.total ? s.done / s.total : 1; c.reason = s.reason || '';
      if (s.total && s.done >= s.total) {   // изпълнено: резервът се освобождава, доверието расте (или пада, ако е много късно)
        c.st = 'done'; c.end = day(); c.reserved = 0; c.late = day() > c.due;
        h.trust[c.dir] = Math.max(0.5, Math.min(1.3, trustOf(c.dir) + (c.late ? (day() > c.due + c.days ? -0.05 : 0) : 0.04)));
        out.push({ c, status: 'изпълнено' });
      } else {
        const status = s.blocked ? 'блокирано' : day() > c.due ? 'забавено' : 'в процес';
        if (status !== 'в процес' && !c.flag) { c.flag = status; if (status === 'забавено') h.trust[c.dir] = Math.max(0.5, trustOf(c.dir) - 0.03); }   // наказание само веднъж и не за твое решение (бюджетът)
        out.push({ c, status });
      }
    }
    deps.save(); return out;
  }
  // действия по забавен/блокиран проект
  function act(cid, how) {
    const h = hold(), c = h.commits.find(x => x.cid === +cid); if (!c || c.st !== 'active') return;
    if (how === 'extend') { c.due = Math.max(c.due, day()) + Math.ceil(c.days * 0.5); c.flag = null; deps.toast(`📅 Срокът е удължен до ден ${c.due}.`, ''); }
    else if (how === 'fix') { const ok = deps.fixTrack && deps.fixTrack(c.track); deps.toast(ok ? '🔧 Ресурсите са пренасочени — проектът продължава.' : 'Няма какво да се пренасочи — купи липсващото или удължи срока.', ok ? 'good' : 'bad'); }
    else if (how === 'stop') { c.st = 'stop'; c.end = day(); c.reserved = 0; deps.toast(`✖ Проектът е прекратен, резервираните ${B(0)} са освободени.`, ''); }
    deps.save();
  }
  const STAT = { 'изпълнено': ['✅', 'var(--ok)'], 'в процес': ['⏳', 'var(--txt)'], 'забавено': ['⚠️', 'var(--acc)'], 'блокирано': ['⛔', 'var(--bad)'] };
  // отчетът на директорите в началото на заседанието (HTML; group.js/залата го показват) — бутони [data-bc="cid|extend|fix|stop"]
  function reportHtml() {
    const R = review(), h = hold(), recent = h.commits.filter(c => c.st === 'done' && c.end >= day() - 30);
    if (!R.length && !recent.length) return '';
    const by = {}; for (const r of R) (by[r.c.dir] = by[r.c.dir] || []).push(r);
    const lines = Object.entries(by).map(([d, rs]) => { const ok = rs.filter(r => r.status === 'изпълнено').length, bad = rs.filter(r => r.status === 'забавено' || r.status === 'блокирано');
      const sum = `${nm(d)}: „${ok ? `${ok} от ${rs.length} одобрени проекта са изпълнени.` : `${rs.length} проекта в работа.`}${bad.length ? ` ${bad[0].c.reason || 'Има забавяне'}.` : ''}“`;
      return `<div style="margin:6px 0"><div class="meta" style="margin:0 0 3px">${DIR_ICO[d] || ''} <b style="color:var(--txt)">${sum}</b></div>${rs.map(({ c, status }) => `<div class="row" style="margin:2px 0 2px 18px;gap:6px;align-items:center;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1 1 260px">${STAT[status][0]} <b style="color:${STAT[status][1]}">${status}</b> · ${c.text.slice(0, 90)}${c.text.length > 90 ? '…' : ''} · ${Math.round((c.prog || 0) * 100)}% · срок ден ${c.due}${c.reason && status !== 'изпълнено' ? ` · <i>${c.reason}</i>` : ''}</span>${status === 'забавено' || status === 'блокирано' ? `<button class="btn2" data-bc="${c.cid}|extend">📅 Удължи</button><button class="btn2" data-bc="${c.cid}|fix">🔧 Пренасочи ресурси</button><button class="btn2" data-bc="${c.cid}|stop">✖ Прекрати</button>` : ''}</div>`).join('')}</div>`; }).join('');
    return `<div class="card"><h3 style="margin:0 0 6px">📊 Отчет за предишните решения</h3>${lines || '<div class="meta" style="margin:0">Всички предишни решения са изпълнени.</div>'}</div>`;
  }
  // обобщението на Борис в края на заседанието
  function summary() {
    const h = hold(), m = h.month && h.month.m === month() ? h.month : { n: 0, sum: 0 }, F = frame(), soon = active().filter(c => c.due <= day() + 30);
    return `Одобрихме ${m.n} ${m.n === 1 ? 'инвестиция' : 'инвестиции'} за ${B(m.sum)}. Остават ${B(F.free)} за нови решения.${soon.length ? ` Следващия месец очакваме: ${soon.slice(0, 3).map(c => c.text.split(/[.?—]/)[0].slice(0, 50)).join('; ')}.` : ''}`;
  }

  // ---- 🤖 автопилот (веднъж на ден): одобрява сам предложенията до тавана — в бюджета и ако банката е спокойна
  function autoTick() {
    const h = hold(), done = [];
    for (const p of deps.proposals()) {
      if (p.info) continue;
      const cap = h.auto[p.dir] || 0; if (!cap || (p.cost || 0) > cap) continue;
      if (budgetOf(p.dir) && (p.cost || 0) > budgetLeft(p.dir)) continue;
      if (!bankCheck(p).ok) continue;
      const r = commit(p, 'автопилот'); if (r.done) done.push(p);
      if (done.length >= 6) break;
    }
    if (done.length) deps.toast(`🤖 Автопилот: ${done.map(p => `${DIR_ICO[p.dir] || ''} ${p.text.split('.')[0].slice(0, 60)}`).join(' · ')}`, 'good');
    if (day() % 7 === 0) review();
    return done.length;
  }
  const setBudget = (dir, v) => { hold().budget[dir] = Math.max(0, v); deps.save(); };
  const setAuto = (dir, v) => { hold().auto[dir] = Math.max(0, v); deps.save(); };
  const STEPS = [0, 1e6, 1e7, 1e8, 5e8, 1e9, 5e9, 2e10];
  function settingsHtml() {
    const ds = hired(); if (!ds.length) return '';
    const sel = (kind, d, cur) => `<select data-bl="${kind}|${d}" style="min-width:120px">${STEPS.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v ? B(v) : kind === 'auto' ? 'изключен' : 'без бюджет'}</option>`).join('')}</select>`;
    return `<div class="card"><h3 style="margin:0 0 6px">💼 Бюджети, 🤖 автопилот и 🤝 доверие</h3><div class="meta" style="margin:0 0 8px">До месечния бюджет (× доверието) директорът действа сам; над него решава бордът със съвещателен вот — последната дума е твоя. Доверието расте с изпълнени навреме проекти и пада при забавяния (не и заради твои бюджетни решения). Настроение на борда: <b style="color:${hold().mood >= 0.6 ? 'var(--ok)' : 'var(--bad)'}">${Math.round(hold().mood * 100)}%</b></div>
      ${ds.map(d => `<div class="row" style="margin:4px 0;gap:8px;align-items:center;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1 1 180px">${DIR_ICO[d] || ''} <b style="color:var(--txt)">${nm(d)}</b> · ${deps.subName(d) || d} · 🤝 ${Math.round(trustOf(d) * 100)}%${budgetOf(d) ? ` · похарчени ${B(spentOf(d))} от ${B(budgetOf(d))}` : ''}</span><span class="meta" style="margin:0">💼 ${sel('budget', d, hold().budget[d] || 0)}</span><span class="meta" style="margin:0">🤖 ${sel('auto', d, hold().auto[d] || 0)}</span></div>`).join('')}</div>`;
  }
  function bindSettings(box, rerender) {
    box.querySelectorAll('[data-bl]').forEach(s => s.onchange = () => { const [k, d] = s.dataset.bl.split('|'); (k === 'budget' ? setBudget : setAuto)(d, +s.value); rerender && rerender(); });
    box.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => { const [cid, how] = b.dataset.bc.split('|'); act(cid, how); rerender && rerender(); });
  }
  // карта на предложението: петте въпроса (какво · защо · колко · кога · какво ще донесе)
  function propHtml(p) {
    if (p.info) return `<div class="meta" style="margin:0">🏦 ${bankSpeech()}</div>`;
    const q = (k, v) => v ? `<div class="meta" style="margin:1px 0"><b style="color:var(--mut)">${k}:</b> ${v}</div>` : '';
    return `<div class="meta" style="margin:0 0 4px;color:var(--txt)">${p.ico || ''} ${p.text}</div>${q('Защо', p.why)}${q('Колко', p.cost ? B(p.cost) : 'без разход')}${q('Кога', p.days ? `~${p.days} дни` : 'веднага')}${q('Очакваме', p.gainTxt || (p.gain ? `+${B(p.gain)}/месец` : ''))}${p.inBudget === false ? '<div class="meta" style="margin:2px 0;color:var(--bad)">⚠️ над бюджета за инвестиции</div>' : p.inBudget ? '<div class="meta" style="margin:2px 0;color:var(--ok)">✅ в рамките на бюджета за инвестиции</div>' : ''}`;
  }
  // HTML на вота: обясненията и решенията (собственикът решава винаги)
  function voteHtml(r) {
    const { v, p } = r;
    return `${!v.bank.ok ? `<div class="meta" style="margin:0 0 6px">🏦 Банката възразява: ${v.bank.why}.</div>` : ''}<div class="meta" style="margin:0 0 6px">Съвещателен вот за „${p.text.slice(0, 90)}${p.text.length > 90 ? '…' : ''}“ (${B(p.cost)}):</div>
      ${v.votes.map(x => `<div class="meta" style="margin:2px 0"><b style="color:${x.cond ? 'var(--acc)' : x.yes ? '#43d17a' : '#ff4d4d'};font-weight:900">${x.cond ? '◐ за, с условие' : x.yes ? '✔ за' : '✖ против'}</b> · <b style="color:var(--txt)">${x.name}</b> ${DIR_ICO[x.dir] || ''} — ${x.why}</div>`).join('')}
      <div style="margin:8px 0 4px;font-weight:800;font-size:15px;color:${v.passed ? 'var(--ok)' : 'var(--bad)'}">${v.yes} за : ${v.no} против — решението е твое</div>
      <div class="row" style="margin:6px 0 0;gap:6px;flex-wrap:wrap"><button class="btn" data-bv="${p.id}|pass">✓ Одобри</button>${p.small ? `<button class="btn2" data-bv="${p.id}|small">½ По-малък вариант · ${B(p.small.cost)}</button>` : ''}${deps.loan && !v.bank.ok ? `<button class="btn2" data-bv="${p.id}|loan">🏦 С кредит</button>` : ''}<button class="btn2" data-bv="${p.id}|drop">⏳ Отложи</button></div>`;
  }
  return { frame, frameHtml, bankSpeech, bankCheck, vote, request, resolve, review, act, reportHtml, summary, propHtml, autoTick, setBudget, setAuto, budgetLeft, budgetOf, spentOf, trustOf, settingsHtml, bindSettings, voteHtml, mood: () => hold().mood, commits: () => hold().commits };
}
