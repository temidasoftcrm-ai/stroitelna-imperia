// globdir.js — 🌍 директорът на „Глобъл Ризортс & Констръкшън“ (ниво 20): предложенията му към борда.
// Мегапроекти (следващият етап за финансиране), концесии (оферта в отворения търг), придобивания (10% от конкурентен холдинг,
// изкупуване на местни конкуренти). Форматът е като boardProposals() в game.js: [{ id, dir: 'glob', ico, text, cost, count, apply() }].
// ctx: { S(), econ(), fmt, mw (megaworld.js), corp (corp.js), GLOBAL (corp.js), localFirms(), empire() }
export function globProposals(ctx) {
  const S = ctx.S(); if (!S || !S.holding) return [];
  const out = [], f = n => ctx.fmt(Math.round(n)), B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${f(n / 1e6)} млн. €`;
  const add = (key, ico, text, cost, count, apply) => { if (count > 0) out.push({ id: `glob:${key}:${count}`, dir: 'glob', ico, text, cost: Math.round(cost), count, apply }); };
  // — мегапроекти: най-евтиният следващ етап (не започнат или чакащ финансиране), без петролопровода преди договорите
  const mw = ctx.mw, st = mw.state();
  const next = mw.MW.filter(m => { const r = st[m.key]; return r && !r.done && !r.run && !(m.key === 'pipeline' && !r.ph && !mw.pipeSigned()); })
    .map(m => ({ m, r: st[m.key], c: mw.phaseCost(m.key) })).sort((a, b) => a.c - b.c);
  for (const o of next.slice(0, 2)) add('mw-' + o.m.key + '-' + o.r.ph, o.m.ico, `${o.m.nm}: ${o.r.ph ? `етап ${o.r.ph} е готов — да финансираме етап ${o.r.ph + 1}?` : 'да направим първа копка?'} Готовият проект носи ~${f(o.m.inc)} €/ден.`, o.c, 1, () => mw.fund(o.m.key));
  if (!ctx.empire()) return out;   // концесиите и придобиванията — от ниво 20
  // — концесия: оферта с 15% над началната цена в отворения търг (печели често, без да надплаща много)
  const t = ctx.corp.tender && ctx.corp.tender();
  if (t && !t.my) add('conc-' + t.nm, t.ico || '🌐', `Отворен търг за концесия „${t.nm}“ (начална цена ${B(t.price)}, носи ~${f(t.inc)} €/ден). Да дадем оферта +15% — ${B(t.price * 1.15)}?`, t.price * 1.15, 1, () => ctx.corp.concBid(1.15));
  // — придобивания: 10% от най-евтиния конкурентен холдинг, който още не е погълнат; местните конкуренти в твоите държави
  const c = ctx.corp.state(), gl = ctx.GLOBAL.filter(g => c.gl[g.id] && !c.gl[g.id].merged).map(g => ({ g, cost: ctx.corp.trancheCost(g.id), stake: c.gl[g.id].stake })).sort((a, b) => b.stake - a.stake || a.cost - b.cost)[0];
  if (gl) add('acq-' + gl.g.id + '-' + Math.round(gl.stake * 100), gl.g.ico, `${gl.g.flag} ${gl.g.nm} (${gl.g.sec}): имаме ${Math.round(gl.stake * 100)}%. Да купим още 10%?${gl.stake >= 0.4 ? ' Така минаваме 50% и я поглъщаме!' : ' Носи дивидент всеки ден.'}`, gl.cost, 1, () => ctx.corp.buyStake(gl.g.id));
  const loc = ctx.localFirms().filter(x => !c.loc[x.f.id]).map(x => ({ x, cost: ctx.corp.locValue(x) })).sort((a, b) => a.cost - b.cost).slice(0, 5);
  add('loc', '🏢', `${loc.length} местни конкуренти ни вземат поръчки (${loc.slice(0, 3).map(o => `${o.x.f.nm} — ${o.x.cnm}`).join(', ')}${loc.length > 3 ? '…' : ''}). Да ги изкупим?`, loc.reduce((a, o) => a + o.cost, 0), loc.length, () => { for (const o of loc) ctx.corp.buyLocal(o.x.f.id); });
  return out;
}
