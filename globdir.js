// globdir.js — 🌍 директорът на „Глобъл Ризортс & Констръкшън“ (ниво 20): предложенията му към борда.
// Мегапроекти (следващият етап за финансиране), концесии (оферта в отворения търг), придобивания (10% от конкурентен холдинг,
// изкупуване на местни конкуренти). Форматът е като boardProposals() в game.js: [{ id, dir: 'glob', ico, text, cost, count, apply() }].
// ctx: { S(), econ(), fmt, mw (megaworld.js), corp (corp.js), GLOBAL (corp.js), localFirms(), empire() }
export function globProposals(ctx) {
  const S = ctx.S(); if (!S || !S.holding) return [];
  const out = [], f = n => ctx.fmt(Math.round(n)), B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${f(n / 1e6)} млн. €`;
  const add = (key, ico, text, cost, count, apply, x = {}) => { if (count > 0) out.push({ id: `glob:${key}:${count}`, dir: 'glob', ico, text, cost: Math.round(cost), count, apply, ...x }); };
  // — мегапроекти: най-евтиният следващ етап (не започнат или чакащ финансиране), без петролопровода преди договорите
  const mw = ctx.mw, st = mw.state();
  const next = mw.MW.filter(m => { const r = st[m.key]; return r && !r.done && !r.run && !(mw.hasDeals ? mw.hasDeals(m.key) && !r.ph && !mw.signed(m.key) : m.key === 'pipeline' && !r.ph && !mw.pipeSigned()); })
    .map(m => ({ m, r: st[m.key], c: mw.phaseCost(m.key) })).sort((a, b) => a.c - b.c);
  // — държавните договори: най-евтиният проект, който чака подписи; по едно предложение на държава (плащанията и кредитът от нашата банка — наведнъж, после подпис)
  const wait = mw.MW.filter(m => { const r = st[m.key]; return r && !r.done && !r.ph && mw.hasDeals && mw.hasDeals(m.key) && !mw.signed(m.key); }).sort((a, b) => mw.phaseCost(a.key) - mw.phaseCost(b.key))[0];
  if (wait) for (const d of mw.deals(wait.key).filter(x => !x.signed)) {
    const left = d.cond.map((c, i) => ({ c, i })).filter(o => !d.ok[o.i]), pay = left.filter(o => o.c.t === 'pay').reduce((a, o) => a + o.c.amt, 0), bank = left.filter(o => o.c.t === 'bank'), block = left.filter(o => !['pay', 'bank', 'transit'].includes(o.c.t));
    add(`deal-${wait.key}-${d.k}`, d.flag, `${wait.nm}: ${d.flag} ${d.nm} подписва, ако ${left.length ? left.map(o => ctx.strip(mw.condTxt(wait.key, o.c))).join('; ') : 'просто подпишем'}. ${block.length ? 'Първо трябва да изпълним условието.' : 'Да изпълним условията и да подпишем?'}`, pay, 1,
      () => { for (const o of left) if (o.c.t === 'pay' || o.c.t === 'bank') mw.fulfil(wait.key, d.k, o.i); mw.sign(wait.key, d.k); }, { noAuto: true });
    const p = out[out.length - 1]; if (p && p.id.startsWith(`glob:deal-${wait.key}-${d.k}`)) { p.why = `без договорите ${wait.nm} не може да тръгне`; if (block.length) p.needsGear = ctx.strip(mw.condTxt(wait.key, block[0].c)); if (bank.length) p.gainTxt = `кредитът (${bank.map(o => B(o.c.amt)).join(' + ')}) е от нашата банка при 2%`; }
  }
  for (const o of next.slice(0, 2)) add('mw-' + o.m.key + '-' + o.r.ph, o.m.ico, `${o.m.nm}: ${o.r.ph ? `етап ${o.r.ph} е готов — да финансираме етап ${o.r.ph + 1}?` : 'да направим първа копка?'} Готовият проект носи ~${f(o.m.inc)} €/ден.`, o.c, 1, () => mw.fund(o.m.key), { why: o.m.effect ? `огромен приход всеки ден, а и ${o.m.effect}` : 'огромен приход всеки ден', days: Math.round(o.m.days / ((mw.MW.find(x => x.key === o.m.key)?.phases) || 3)) || o.m.days, gainTxt: `~${f(o.m.inc)} €/ден, когато проектът е готов`, track: null });
  if (!ctx.empire()) return out;   // концесиите и придобиванията — от ниво 20
  // — концесия: оферта с 15% над началната цена в отворения търг (печели често, без да надплаща много)
  const t = ctx.corp.tender && ctx.corp.tender();
  if (t && !t.my) add('conc-' + t.nm, t.ico || '🌐', `Отворен търг за концесия „${t.nm}“ (начална цена ${B(t.price)}, носи ~${f(t.inc)} €/ден). Да дадем оферта +15% — ${B(t.price * 1.15)}?`, t.price * 1.15, 1, () => ctx.corp.concBid(1.15), { noAuto: true, why: '15% над началната цена — печели често, без да надплаща', gainTxt: `~${f(t.inc)} €/ден за десетилетия` });
  // — придобивания: 10% от най-евтиния конкурентен холдинг, който още не е погълнат; местните конкуренти в твоите държави
  const c = ctx.corp.state(), gl = ctx.GLOBAL.filter(g => c.gl[g.id] && !c.gl[g.id].merged).map(g => ({ g, cost: ctx.corp.trancheCost(g.id), stake: c.gl[g.id].stake })).sort((a, b) => b.stake - a.stake || a.cost - b.cost)[0];
  if (gl) add('acq-' + gl.g.id + '-' + Math.round(gl.stake * 100), gl.g.ico, `${gl.g.flag} ${gl.g.nm} (${gl.g.sec}): имаме ${Math.round(gl.stake * 100)}%. Да купим още 10%?${gl.stake >= 0.4 ? ' Така минаваме 50% и я поглъщаме!' : ' Носи дивидент всеки ден.'}`, gl.cost, 1, () => ctx.corp.buyStake(gl.g.id), { noAuto: true, why: gl.stake >= 0.4 ? 'с над 50% конгломератът става наш' : 'дяловете носят дивидент всеки ден', gainTxt: gl.stake >= 0.4 ? 'поглъщане' : 'дивидент от дела' });
  const loc = ctx.localFirms().filter(x => !c.loc[x.f.id]).map(x => ({ x, cost: ctx.corp.locValue(x) })).sort((a, b) => a.cost - b.cost).slice(0, 5);
  add('loc', '🏢', `${loc.length} местни конкуренти ни вземат поръчки (${loc.slice(0, 3).map(o => `${o.x.f.nm} — ${o.x.cnm}`).join(', ')}${loc.length > 3 ? '…' : ''}). Да ги изкупим?`, loc.reduce((a, o) => a + o.cost, 0), loc.length, () => { for (const o of loc) ctx.corp.buyLocal(o.x.f.id); }, { noAuto: true, why: 'изкупената фирма спира да ни взема поръчки', gainTxt: 'пазарът им става наш' });
  return out;
}
