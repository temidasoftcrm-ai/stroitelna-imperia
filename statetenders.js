// statetenders.js — още държавни поръчки (търгове): поне по 2 на държава, по всички континенти.
// Генерират се от списъка с държави (countries.js + africa/namerica/samerica/asia/oceania) и се добавят към TENDERS (tenders.js).
// Видове: hospital (болница), stadium (стадион), metro (метро в мегаполисите), port (контейнерен терминал в крайморските градове).
// 3D: болница/стадион/метро — tender3d.js; обществените сгради (училище … язовир) — civic3d.js.
const KINDS = {
  hospital: { ico: '🏥', nm: c => `Национална болница — ${c}`, sign: '🏥 БОЛНИЦА', ds: 'Модерна болница с хеликоптерна площадка — държавата плаща добре, но сроковете са строги.', need: { crew: 4, crane: 1, loader: 2, truck: 3 } },
  stadium: { ico: '🏟️', nm: c => `Национален стадион — ${c}`, sign: '🏟️ НАЦИОНАЛЕН СТАДИОН', ds: 'Стадион за 50 000 зрители с покрив над трибуните.', need: { crew: 5, crane: 2, loader: 2, truck: 4 } },
  metro: { ico: '🚇', nm: c => `Нова линия на метрото — ${c}`, sign: '🚇 МЕТРО', ds: 'Подземна линия с нови станции под центъра на града.', need: { crew: 6, crane: 2, loader: 3, truck: 5 } },
  port: { ico: '⚓', nm: c => `Нов контейнерен терминал — ${c}`, sign: '⚓ НОВ ТЕРМИНАЛ', ds: 'Нов кей, портални кранове и контейнерна площадка.', need: { crew: 4, crane: 2, loader: 2, truck: 4 } },
  // обществени сгради (civic3d.js) — само в Европа и на Балканите
  school: { ico: '🏫', nm: c => `Ново училище — ${c}`, sign: '🏫 УЧИЛИЩЕ', ds: 'Модерно училище с физкултурен салон и двор — бърза и сигурна поръчка.', need: { crew: 2, loader: 1, truck: 1 }, tier: 0 },
  fire: { ico: '🚒', nm: c => `Пожарна служба — ${c}`, sign: '🚒 ПОЖАРНА', ds: 'Пожарна с гаражи за автостълбите и кула за сушене на маркучите.', need: { crew: 2, loader: 1, truck: 1 }, tier: 0 },
  police: { ico: '🚓', nm: c => `Полицейско управление — ${c}`, sign: '🚓 ПОЛИЦИЯ', ds: 'Ново районно управление в стар стил с модерни помещения.', need: { crew: 2, crane: 1, truck: 1 }, tier: 0 },
  cityhall: { ico: '🏛️', nm: c => `Ново кметство — ${c}`, sign: '🏛️ КМЕТСТВО', ds: 'Кметство с часовникова кула — гордостта на града.', need: { crew: 3, crane: 1, truck: 2 }, tier: 1 },
  court: { ico: '⚖️', nm: c => `Съдебна палата — ${c}`, sign: '⚖️ СЪДЕБНА ПАЛАТА', ds: 'Голяма съдебна палата с колонада и зали за процеси.', need: { crew: 3, crane: 1, loader: 1, truck: 2 }, tier: 1 },
  museum: { ico: '🖼️', nm: c => `Национален музей — ${c}`, sign: '🖼️ МУЗЕЙ', ds: 'Музей и библиотека в реставриран готически дворец.', need: { crew: 3, crane: 1, truck: 2 }, tier: 1 },
  water: { ico: '💧', nm: c => `Пречиствателна станция — ${c}`, sign: '💧 ПРЕЧИСТВАТЕЛНА', ds: 'Станция за питейна вода с утаители и резервоари.', need: { crew: 3, loader: 2, truck: 2 }, tier: 1 , outer: true },
  pool: { ico: '🏊', nm: c => `Плувен комплекс — ${c}`, sign: '🏊 ПЛУВЕН КОМПЛЕКС', ds: 'Олимпийски басейн под стъклен покрив и открит басейн отпред.', need: { crew: 3, crane: 1, loader: 1, truck: 2 }, tier: 1 },
  opera: { ico: '🎭', nm: c => `Опера и концертна зала — ${c}`, sign: '🎭 ОПЕРА', ds: 'Нова опера с концертна зала — модерна архитектура над реката.', need: { crew: 4, crane: 2, loader: 1, truck: 3 }, tier: 2 },
  congress: { ico: '🏢', nm: c => `Конгресен център — ${c}`, sign: '🏢 КОНГРЕСЕН ЦЕНТЪР', ds: 'Стъклен конгресен център за изложения и срещи на върха.', need: { crew: 4, crane: 2, loader: 1, truck: 3 }, tier: 2 },
  station: { ico: '🚉', nm: c => `Нова централна гара — ${c}`, sign: '🚉 ЦЕНТРАЛНА ГАРА', ds: 'Държавната железница строи нова централна гара с часовникова кула.', need: { crew: 4, crane: 2, loader: 2, truck: 3 }, tier: 2 },
  bridge: { ico: '🌉', nm: c => `Висящ мост — ${c}`, sign: '🌉 НОВИЯТ МОСТ', ds: 'Висящ мост над реката с две кули и стоманени въжета.', need: { crew: 4, crane: 2, loader: 2, truck: 3 }, tier: 2, size: [3, 2] , outer: true },
  wind: { ico: '🌬️', nm: c => `Вятърен парк — ${c}`, sign: '🌬️ ВЯТЪРЕН ПАРК', ds: 'Шест вятърни турбини край града — зелена енергия за цялата област.', need: { crew: 3, crane: 2, truck: 2 }, tier: 2, size: [3, 2] , outer: true },
  solar: { ico: '☀️', nm: c => `Соларен парк — ${c}`, sign: '☀️ СОЛАРЕН ПАРК', ds: 'Фотоволтаичен парк с подстанция.', need: { crew: 3, loader: 1, truck: 2 }, tier: 1, size: [3, 2] , outer: true },
  dam: { ico: '🏞️', nm: c => `Язовирна стена — ${c}`, sign: '🏞️ ЯЗОВИР', ds: 'Бетонна язовирна стена с ВЕЦ и преливник — най-трудната инфраструктура.', need: { crew: 5, crane: 2, loader: 3, truck: 4 }, tier: 2, size: [3, 2] , outer: true },
};
const CIVIC = [['school', 'fire', 'police'], ['cityhall', 'court', 'museum', 'water', 'pool', 'solar'], ['opera', 'congress', 'station', 'bridge', 'wind', 'dam']];
const TIER_MUL = [0.3, 0.55, 1.05];
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
  // обществените сгради: по 3 на европейска държава (малка, средна, голяма), разхвърлени по градовете ѝ
  let h = 0;
  for (const k of countries) {
    const cs = k.cities.filter(Boolean); if (!cs.length) continue;
    const reg = region(cs[0]); if (reg === 'world') continue;
    const R0 = reg === 'europe' ? { b: 32e6, dev: 7, rep: 3.5, days: 50 } : { b: 16e6, dev: 4, rep: 3, days: 40 };
    [cs[cs.length - 1] || cs[0], cs[2] || cs[1] || cs[0], cs[0]].forEach((city, tier) => {
      const kind = CIVIC[tier][(h + tier * 2) % CIVIC[tier].length], K = KINDS[kind];
      if (out.some(t => t.id === `st-${kind}-${city}`)) return;
      out.push({ id: `st-${kind}-${city}`, city, kind, ico: K.ico, nm: K.nm(name(city)), budget: Math.max(2, Math.round(R0.b * TIER_MUL[tier] * (0.85 + (city.length % 5) * 0.08) / 1e6)) * 1e6,
        days: Math.round(R0.days * [0.6, 0.85, 1.2][tier]), rep: Math.max(1, R0.rep - (2 - tier) * 0.75), dev: Math.max(3, R0.dev - (2 - tier)), need: K.need, matShare: 0.5, ds: K.ds, sign: K.sign, ...(K.size ? { size: K.size } : {}), ...(K.outer ? { outer: true } : {}) });
    });
    h++;
  }
  return out;
}
