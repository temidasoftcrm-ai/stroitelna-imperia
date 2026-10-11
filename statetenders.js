// statetenders.js — още държавни поръчки (търгове): поне по 2 на държава, по всички континенти.
// Генерират се от списъка с държави (countries.js + africa/namerica/samerica/asia/oceania) и се добавят към TENDERS (tenders.js).
// Видове: hospital (болница), stadium (стадион), metro (метро в мегаполисите), port (контейнерен терминал в крайморските градове).
// 3D: всичко освен port е голяма обществена сграда в града (tender3d.js buildUniversity с табела по вида).
const KINDS = {
  hospital: { ico: '🏥', nm: c => `Национална болница — ${c}`, sign: '🏥 БОЛНИЦА', ds: 'Модерна болница с хеликоптерна площадка — държавата плаща добре, но сроковете са строги.', need: { crew: 4, crane: 1, loader: 2, truck: 3 } },
  stadium: { ico: '🏟️', nm: c => `Национален стадион — ${c}`, sign: '🏟️ НАЦИОНАЛЕН СТАДИОН', ds: 'Стадион за 50 000 зрители с покрив над трибуните.', need: { crew: 5, crane: 2, loader: 2, truck: 4 } },
  metro: { ico: '🚇', nm: c => `Нова линия на метрото — ${c}`, sign: '🚇 МЕТРО', ds: 'Подземна линия с нови станции под центъра на града.', need: { crew: 6, crane: 2, loader: 3, truck: 5 } },
  port: { ico: '⚓', nm: c => `Нов контейнерен терминал — ${c}`, sign: '⚓ НОВ ТЕРМИНАЛ', ds: 'Нов кей, портални кранове и контейнерна площадка.', need: { crew: 4, crane: 2, loader: 2, truck: 4 } },
};
export const TENDER_SIGN = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.sign]));
// region(cityId) → 'balkan' | 'europe' | 'world'; coastal(cityId); mega(cityId); name(cityId)
export function makeStateTenders(countries, existing, { region, coastal, mega, name }) {
  const out = [], have = new Map();
  for (const t of existing) { const k = countries.find(c => c.cities.includes(t.city)); if (k) have.set(k.iso, (have.get(k.iso) || 0) + 1); }
  const R = { balkan: { b: 16e6, dev: 5, rep: 3.5, days: 55 }, europe: { b: 32e6, dev: 8, rep: 4, days: 65 }, world: { b: 55e6, dev: 10, rep: 4.5, days: 75 } };
  for (const k of countries) {
    const caps = k.cities.filter(Boolean); if (!caps.length) continue;
    const reg = R[region(caps[0])] || R.world, plan = [];
    plan.push(['hospital', caps[0]]);
    const port = caps.find(id => coastal(id) && !existing.some(t => t.kind === 'port' && t.city === id));
    plan.push(port ? ['port', port] : ['stadium', caps[1] || caps[0]]);
    if (mega(caps[0])) plan.push(['metro', caps[0]]);   // мегаполисите — и метро
    let n = have.get(k.iso) || 0;
    for (const [kind, city] of plan) {
      if (n >= 2 && kind !== 'metro') continue;   // държавата вече има достатъчно поръчки
      const K = KINDS[kind], mul = (kind === 'metro' ? 1.6 : kind === 'port' ? 1.2 : 1) * (0.85 + (city.length % 5) * 0.08);
      out.push({ id: `st-${kind}-${city}`, city, kind, ico: K.ico, nm: K.nm(name(city)), budget: Math.round(reg.b * mul / 1e6) * 1e6, days: reg.days + (kind === 'metro' ? 15 : 0),
        rep: reg.rep, dev: reg.dev, need: K.need, matShare: 0.52, ds: K.ds, sign: K.sign });
      n++;
    }
  }
  return out;
}
