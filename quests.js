// quests.js — Фаза 6: куести (задачи с награди), подредени в глави.
// game.js подава deps (достъп до състоянието) и вика: quests.emit(събитие, данни) при действия, quests.tick() ~веднъж в секунда.
// Записът е в S.quests = { claimed: { id: ден } } и S.qstats = { брояч: число }.
import { HIGHWAYS } from './highways.js';

const M = n => n;   // за четимост на наградите
// goal: [ключ на брояч, цел] за броени действия или функция (ctx) => [текущо, цел] за състояния
import { EXTRA_CHAPTERS } from './questsx.js';
import { AFRICA_CHAPTER } from './africa.js';
import { NA_CHAPTER } from './namerica.js';
import { SA_CHAPTER } from './samerica.js';
import { AS_CHAPTER } from './asia.js';
import { OC_CHAPTER } from './oceania.js';
const CHAPTERS = [
  { id: 'c1', nm: 'Първи стъпки', ico: '🏠', quests: [
    { id: 'h1', ico: '🏠', nm: 'Първата къща', ds: 'Завърши първата си къща.', goal: ['house', 1], money: M(5000) },
    { id: 'h3', ico: '🏘️', nm: 'Три къщи', ds: 'Завърши 3 къщи.', goal: ['house', 3], money: M(10000) },
    { id: 'buy1', ico: '🛒', nm: 'Нова техника', ds: 'Купи каквато и да е техника.', goal: ['buy', 1], money: M(5000) },
    { id: 'crew2', ico: '👷', nm: 'Втора бригада', ds: 'Имай 2 бригади в един град.', goal: c => [c.units('crew'), 2], money: M(8000) },
    { id: 'early1', ico: '⏱️', nm: 'Преди срока', ds: 'Завърши обект поне 2 дни преди срока.', goal: ['early', 1], money: M(10000) },
    { id: 'm50', ico: '💶', nm: 'Първите пари', ds: 'Имай 50 000 € в банката.', goal: c => [c.money(), 50000], money: M(5000) },
    { id: 'rep1', ico: '⭐', nm: 'Добро име', ds: 'Достигни репутация 1 ★.', goal: c => [c.rep(), 1], money: M(10000) },
    { id: 'off2', ico: '🏢', nm: 'Истински офис', ds: 'Надгради офиса до ниво 2.', goal: c => [c.max('officeLevel'), 2], money: M(15000) },
  ] },
  { id: 'c2', nm: 'Растеж', ico: '📈', quests: [
    { id: 's1', ico: '🏪', nm: 'Първият магазин', ds: 'Завърши магазин.', goal: ['shop', 1], money: M(25000) },
    { id: 's3', ico: '🏬', nm: 'Търговска улица', ds: 'Завърши 3 магазина.', goal: ['shop', 3], money: M(60000) },
    { id: 'h10', ico: '🏡', nm: 'Цял квартал', ds: 'Завърши 10 къщи.', goal: ['house', 10], money: M(50000) },
    { id: 'crane', ico: '🏗️', nm: 'Високо горе', ds: 'Купи кран.', goal: ['buy_crane', 1], money: M(20000) },
    { id: 'off3', ico: '🏢', nm: 'Офис ниво 3', ds: 'Надгради офиса до ниво 3.', goal: c => [c.max('officeLevel'), 3], money: M(40000) },
    { id: 'gar3', ico: '🔧', nm: 'Голям гараж', ds: 'Надгради гаража до ниво 3.', goal: c => [c.max('garageLevel'), 3], money: M(30000) },
    { id: 'wh1', ico: '📦', nm: 'Собствен склад', ds: 'Построй склад.', goal: c => [c.max('whLevel'), 1], money: M(20000) },
    { id: 'reno1', ico: '🔨', nm: 'Като нова', ds: 'Купи стара къща и я ремонтирай.', goal: ['reno', 1], money: M(25000) },
    { id: 'inv1', ico: '🔑', nm: 'Първият наемател', ds: 'Построй своя сграда под наем.', goal: ['invest', 1], money: M(30000) },
    { id: 'rep2', ico: '⭐', nm: 'Уважавана фирма', ds: 'Достигни репутация 2 ★.', goal: c => [c.rep(), 2], money: M(50000) },
    { id: 'm250', ico: '💰', nm: 'Четвърт милион', ds: 'Имай 250 000 € в банката.', goal: c => [c.money(), 250000], money: M(30000) },
  ] },
  { id: 'c3', nm: 'Предприемач', ico: '💼', quests: [
    { id: 'o1', ico: '🏢', nm: 'Бизнес сграда', ds: 'Завърши офис сграда.', goal: ['office', 1], money: M(80000) },
    { id: 'o5', ico: '🌇', nm: 'Бизнес квартал', ds: 'Завърши 5 офис сгради.', goal: ['office', 5], money: M(250000) },
    { id: 'sold1', ico: '🤝', nm: 'Сделката е сключена', ds: 'Продай свой имот.', goal: ['sold', 1], money: M(40000) },
    { id: 'rent5', ico: '🔑', nm: 'Рентиер', ds: 'Имай 5 имота под наем.', goal: c => [c.rentals(), 5], money: M(100000) },
    { id: 'rent3k', ico: '💸', nm: 'Пасивен доход', ds: 'Наемите ти да носят 3 000 €/ден.', goal: c => [c.rentPerDay(), 3000], money: M(120000) },
    { id: 'demo1', ico: '🏚️', nm: 'Ново на мястото на старото', ds: 'Изпълни поръчка със събаряне.', goal: ['demolish', 1], money: M(60000) },
    { id: 'br1', ico: '📍', nm: 'Нов град', ds: 'Отвори първия си филиал.', goal: c => [c.branches(), 1], money: M(100000) },
    { id: 'off5', ico: '🏢', nm: 'Бизнес център', ds: 'Надгради офиса до ниво 5.', goal: c => [c.max('officeLevel'), 5], money: M(150000) },
    { id: 'done20', ico: '✅', nm: 'Двадесет обекта', ds: 'Завърши общо 20 обекта.', goal: c => [c.done(), 20], money: M(100000) },
    { id: 'dep100', ico: '🏦', nm: 'Спестител', ds: 'Вложи 100 000 € на депозит в банката.', goal: c => [c.deposit(), 100000], money: M(10000) },
    { id: 'rep3', ico: '⭐', nm: 'Известна марка', ds: 'Достигни репутация 3 ★.', goal: c => [c.rep(), 3], money: M(150000) },
  ] },
  { id: 'c4', nm: 'Жп магнат', ico: '🚆', quests: [
    { id: 'st1', ico: '🚉', nm: 'Собствена гара', ds: 'Построй гара.', goal: c => [c.max('stationLevel'), 1], money: M(50000) },
    { id: 'rail1', ico: '🛤️', nm: 'Първата линия', ds: 'Завърши жп линия.', goal: c => [c.rails(), 1], money: M(80000) },
    { id: 'train1', ico: '🚆', nm: 'Първи влак', ds: 'Купи влак.', goal: c => [c.trains(), 1], money: M(60000) },
    { id: 'del5', ico: '📦', nm: 'Спедитор', ds: 'Изпълни 5 жп превоза.', goal: ['delivery', 5], money: M(120000) },
    { id: 'fact', ico: '🏭', nm: 'Директно от завода', ds: 'Свържи се с жп линия до град със завод.', goal: c => [c.factoryLink() ? 1 : 0, 1], money: M(150000) },
    { id: 'r_ruse', ico: '🌊', nm: 'Дунав — Черно море', ds: 'Варна иска жп връзка с Русе.', goal: c => [c.rail('varna', 'ruse') ? 1 : 0, 1], money: M(500000) },
    { id: 'r_mont', ico: '🛤️', nm: 'Монтана — Стара Загора', ds: 'От Монтана искат жп връзка до Стара Загора.', goal: c => [c.rail('montana', 'stz') ? 1 : 0, 1], money: M(1000000) },
    { id: 'r_vidin', ico: '🏰', nm: 'Видин не е забравен', ds: 'Видин иска жп връзка със София.', goal: c => [c.rail('vidin', 'sofia') ? 1 : 0, 1], money: M(600000) },
    { id: 'net6', ico: '🕸️', nm: 'Жп мрежа', ds: 'Свържи 6 града с жп линии.', goal: c => [c.railCities(), 6], money: M(400000) },
    { id: 'train3', ico: '🚂', nm: 'Влакова композиция', ds: 'Имай 3 влака.', goal: c => [c.trains(), 3], money: M(200000) },
    { id: 'del25', ico: '🚛', nm: 'Логистична империя', ds: 'Изпълни 25 жп превоза.', goal: ['delivery', 25], money: M(500000) },
  ] },
  { id: 'c5', nm: 'Пътен строител', ico: '🛣️', quests: [
    { id: 'hw1', ico: '🛣️', nm: 'Първият участък', ds: 'Завърши участък от магистрала.', goal: c => [c.hwSegs(), 1], money: M(200000) },
    { id: 'hwA3', ico: '⛰️', nm: 'АМ „Струма“', ds: 'Завърши цялата АМ „Струма“ (София — Благоевград).', goal: c => [c.hwFull('A3') ? 1 : 0, 1], money: M(600000) },
    { id: 'hw_pd', ico: '🛣️', nm: 'София — Пловдив', ds: 'Пловдив иска магистрала до София.', goal: c => [c.hw('sofia', 'plovdiv') ? 1 : 0, 1], money: M(1000000) },
    { id: 'hw_bs', ico: '🏖️', nm: 'Тракия до морето', ds: 'Бургас иска АМ „Тракия“ от София чак до морето.', goal: c => [c.hw('sofia', 'burgas') ? 1 : 0, 1], money: M(1500000) },
    { id: 'hw_vn', ico: '⚓', nm: 'Хемус до Варна', ds: 'Варна иска АМ „Хемус“ от София.', goal: c => [c.hw('sofia', 'varna') ? 1 : 0, 1], money: M(2000000) },
    { id: 'hwA5', ico: '🌅', nm: 'АМ „Черно море“', ds: 'Свържи Варна и Бургас с магистрала.', goal: c => [c.hwFull('A5') ? 1 : 0, 1], money: M(800000) },
    { id: 'toll5k', ico: '🎫', nm: 'Тол империя', ds: 'Тол таксите да носят 5 000 €/ден.', goal: c => [c.toll(), 5000], money: M(300000) },
    { id: 'hw10', ico: '🗺️', nm: 'Десет участъка', ds: 'Завърши общо 10 участъка магистрали.', goal: c => [c.hwSegs(), 10], money: M(2000000) },
  ] },
  { id: 'c6', nm: 'Империя', ico: '👑', quests: [
    { id: 't1', ico: '🌆', nm: 'Докосни небето', ds: 'Завърши небостъргач.', goal: ['tower', 1], money: M(300000) },
    { id: 't5', ico: '🏙️', nm: 'Силует на града', ds: 'Завърши 5 небостъргача.', goal: ['tower', 5], money: M(1000000) },
    { id: 'off8', ico: '🏢', nm: 'Корпорация', ds: 'Надгради офиса до ниво 8.', goal: c => [c.max('officeLevel'), 8], money: M(500000) },
    { id: 'cd1', ico: '🏁', nm: 'Завършен град', ds: 'Завърши напълно един град (всички квартали застроени, дял ≥ 60%).', goal: ['cityDone', 1], money: M(1000000) },
    { id: 'cd3', ico: '🏆', nm: 'Три завършени града', ds: 'Завърши три града.', goal: ['cityDone', 3], money: M(5000000) },
    { id: 'br3', ico: '📍', nm: 'Национална фирма', ds: 'Имай 3 филиала.', goal: c => [c.branches(), 3], money: M(500000) },
    { id: 'big3', ico: '🇧🇬', nm: 'Голямата тройка', ds: 'Имай офис в София, Пловдив и Варна.', goal: c => [['sofia', 'plovdiv', 'varna'].filter(c.owns).length, 3], money: M(800000) },
    { id: 'res1', ico: '⛷️', nm: 'Курортист', ds: 'Купи земя в курорт.', goal: c => [c.resorts(), 1], money: M(500000) },
    { id: 'res2', ico: '🏡', nm: 'Вилно селище', ds: 'Построй вилно селище в курорт.', goal: c => [c.resortsBuilt(), 1], money: M(1000000) },
    { id: 'rep5', ico: '🌟', nm: 'Легенда', ds: 'Достигни репутация 5 ★.', goal: c => [c.rep(), 5], money: M(500000) },
    { id: 'dep1m', ico: '🏛️', nm: 'Банкер', ds: 'Имай 1 000 000 € на депозит.', goal: c => [c.deposit(), 1000000], money: M(100000) },
    { id: 'm10m', ico: '💎', nm: 'Мултимилионер', ds: 'Имай 10 000 000 € в банката.', goal: c => [c.money(), 10000000], money: M(1000000) },
    { id: 'done100', ico: '🏆', nm: 'Сто обекта', ds: 'Завърши общо 100 обекта.', goal: c => [c.done(), 100], money: M(2000000) },
    { id: 'off10', ico: '👑', nm: 'Империя', ds: 'Надгради офиса до ниво 10.', goal: c => [c.max('officeLevel'), 10], money: M(3000000) },
    { id: 'hwall', ico: '🗺️', nm: 'Цялата страна', ds: 'Завърши всички магистрали.', goal: c => [c.hwSegs(), HIGHWAYS.reduce((a, h) => a + h.segs.length, 0)], money: M(10000000) },
  ] },
  { id: 'c7', nm: 'Балканите', ico: '🌍', pic: 'unlock-balkans', picTxt: 'Жп линии и магистрали до съседите, а от ниво 6 — филиали в Истанбул, Атина, Букурещ, Белград… Отвори „🌍 Балканите“ на картата.', openIf: c => c.devBest() >= 5, lockTxt: 'Отключва се на ниво 5 на развитие.', quests: [
    { id: 'b_rail_ist', ico: '🕌', nm: 'Ориент експрес', ds: 'Свържи свой град с Истанбул с жп линия.', goal: c => [c.railToOwned('istanbul') ? 1 : 0, 1], money: M(800000) },
    { id: 'b_rail_buc', ico: '🌉', nm: 'През Дунав', ds: 'Свържи свой град с Букурещ с жп линия.', goal: c => [c.railToOwned('bucharest') ? 1 : 0, 1], money: M(600000) },
    { id: 'b_rail_bel', ico: '🏰', nm: 'Белградски коридор', ds: 'Свържи свой град с Белград с жп линия.', goal: c => [c.railToOwned('belgrade') ? 1 : 0, 1], money: M(700000) },
    { id: 'b_rail_ath', ico: '🏛️', nm: 'До Акропола', ds: 'Свържи свой град с Атина с жп линия.', goal: c => [c.railToOwned('athens') ? 1 : 0, 1], money: M(1500000) },
    { id: 'b_br1', ico: '🛂', nm: 'Отвъд границата', ds: 'Отвори първия си филиал в чужбина.', goal: c => [c.foreignBranches(), 1], money: M(500000) },
    { id: 'b_ist', ico: '🇹🇷', nm: 'Фирма в Истанбул', ds: 'Отвори филиал в Истанбул.', goal: c => [c.owns('istanbul') ? 1 : 0, 1], money: M(1000000) },
    { id: 'b_ath', ico: '🇬🇷', nm: 'Фирма в Атина', ds: 'Отвори филиал в Атина.', goal: c => [c.owns('athens') ? 1 : 0, 1], money: M(1000000) },
    { id: 'b_caps', ico: '👑', nm: 'Балканска империя', ds: 'Имай филиали в 3 чужди столици (Букурещ, Белград, Скопие, Атина, Анкара).', goal: c => [['bucharest', 'belgrade', 'skopje', 'athens', 'ankara'].filter(c.owns).length, 3], money: M(5000000) },
  ] },
];
// главите за късната игра (questsx.js); Европа се отваря с ниво 8, без да чака Балканите
CHAPTERS.push(...EXTRA_CHAPTERS, AFRICA_CHAPTER, NA_CHAPTER, SA_CHAPTER, AS_CHAPTER, OC_CHAPTER);
{ const eu = CHAPTERS.find(c => c.id === 'c8'); if (eu && !eu.openIf) { eu.openIf = c => c.devBest() >= 8; eu.lockTxt = eu.lockTxt || 'Отключва се на ниво 8 на развитие.'; } }
export const QUEST_COUNT = CHAPTERS.reduce((a, c) => a + c.quests.length, 0);
const UNLOCK_SHARE = 0.7;   // следващата глава се отваря, когато вземеш наградите за 70% от текущата

export function createQuests(deps) {
  const S = () => deps.S();
  const qs = () => { const s = S(); s.quests = s.quests || { claimed: {} }; s.qstats = s.qstats || {}; return s.quests; };
  const stat = k => (S().qstats || {})[k] || 0;
  // всички твои градове: текущият + прибраните
  const cityVals = key => { const s = S(); return [s[key], ...Object.values(s.cities || {}).map(c => c[key])].map(v => v ?? 0); };
  const allEstates = () => { const s = S(); return [s.estate, ...Object.values(s.cities || {}).map(c => c.estate)].filter(Boolean); };
  const hwDone = () => S().hwDone || [];
  const hwSegs = () => HIGHWAYS.flatMap(h => h.segs.map((sg, i) => ({ id: `${h.id}-${i}`, a: sg[0], b: sg[1] })));
  function hwConnected(a, b) {
    const done = hwSegs().filter(s => hwDone().includes(s.id)), seen = new Set([a]), q = [a];
    while (q.length) { const c = q.shift(); if (c === b) return true; for (const s of done) { const n = s.a === c ? s.b : s.b === c ? s.a : null; if (n && !seen.has(n)) { seen.add(n); q.push(n); } } }
    return false;
  }
  const ctx = {
    money: () => deps.econ().money,
    deposit: () => deps.econ().s.deposit || 0,
    devBest: () => deps.devBest ? deps.devBest() : 1,
    S: () => S(),
    econ: () => deps.econ(),
    rep: () => S().rep || 0,
    done: () => S().done || 0,
    max: key => Math.max(0, ...cityVals(key)),
    units: type => (S().units || []).filter(t => t === type).length,
    branches: () => (S().branches || []).length,
    owns: id => [S().hqCity || S().cityId, ...(S().branches || [])].includes(id),
    rentals: () => allEstates().reduce((a, e) => a + (e.owned || []).length, 0),
    rentPerDay: () => allEstates().reduce((a, e) => a + (e.owned || []).reduce((b, o) => b + (o.rent || 0), 0), 0),
    rails: () => (S().rails || []).filter(r => r.built).length,
    railCities: () => new Set((S().rails || []).filter(r => r.built).flatMap(r => [r.a, r.b])).size,
    rail: (a, b) => !!deps.railPath(a, b) && deps.railPath(a, b).length > 1,
    railToOwned: id => [S().hqCity || S().cityId, ...(S().branches || [])].some(c => c !== id && !!deps.railPath(c, id) && deps.railPath(c, id).length > 1),
    foreignBranches: () => (S().branches || []).filter(id => deps.isForeign && deps.isForeign(id)).length,
    trains: () => (S().trains || []).length,
    factoryLink: () => deps.connectedCities().some(id => (deps.factories || []).some(f => f.cityId === id)),
    hwSegs: () => hwDone().length,
    hwFull: id => HIGHWAYS.find(h => h.id === id).segs.every((_, i) => hwDone().includes(`${id}-${i}`)),
    hw: hwConnected,
    toll: () => deps.toll ? deps.toll() : 0,
    resorts: () => Object.values(S().resorts || {}).filter(r => r && r.stage).length,
    resortsBuilt: () => Object.values(S().resorts || {}).filter(r => r && (r.stage === 'built' || r.stage === 'sold')).length,
  };
  function progress(q) {
    const [cur, tgt] = Array.isArray(q.goal) ? [stat(q.goal[0]), q.goal[1]] : q.goal(ctx);
    return { cur: Math.min(cur, tgt), tgt, ok: cur >= tgt };
  }
  const claimed = q => !!qs().claimed[q.id];
  function chapterOpen(i) {
    if (i === 0) return true;
    if (CHAPTERS[i].openIf) return CHAPTERS[i].openIf(ctx);
    const prev = CHAPTERS[i - 1].quests;
    return chapterOpen(i - 1) && prev.filter(claimed).length >= Math.ceil(prev.length * UNLOCK_SHARE);
  }
  const ready = () => CHAPTERS.flatMap((c, i) => chapterOpen(i) ? c.quests.filter(q => !claimed(q) && progress(q).ok) : []);

  function claim(id) {
    const q = CHAPTERS.flatMap(c => c.quests).find(x => x.id === id);
    if (!q || claimed(q) || !progress(q).ok) return;
    qs().claimed[q.id] = S().day;
    deps.econ().earn(q.money, 'друго', `Куест: ${q.nm}`);
    if (deps.onClaim) deps.onClaim(q);
    deps.sound('cash');
    deps.toast(`🎯 ${q.nm}: +${deps.fmt(q.money)} €`, 'good');
    const ci = CHAPTERS.findIndex(c => c.quests.includes(q));
    if (CHAPTERS[ci + 1] && chapterOpen(ci + 1) && !qs()['open_' + (ci + 1)]) {
      qs()['open_' + (ci + 1)] = true;
      deps.toast(`📖 Нова глава с куести: ${CHAPTERS[ci + 1].ico} ${CHAPTERS[ci + 1].nm}!`, 'good');
      deps.sound('upgrade');
    }
    deps.save();
    render();
    tick(true);
  }

  // ---- UI: бутон в горната лента + панел
  const css = document.createElement('style');
  css.textContent = `
  #qBtn { position:relative; }
  #qBtn .qb { position:absolute; top:-6px; right:-6px; min-width:18px; height:18px; border-radius:9px; background:#4cd07d; color:#05200f; font-size:11px; font-weight:900; display:flex; align-items:center; justify-content:center; padding:0 4px; animation:qPulse 1.2s ease-in-out infinite; }
  @keyframes qPulse { 50% { transform:scale(1.18); } }
  #qPanel { position:fixed; top:52px; left:0; bottom:0; width:min(420px,100vw); background:var(--panel); border-right:1px solid var(--line); z-index:8; display:flex; flex-direction:column; box-shadow:8px 0 30px rgba(0,0,0,.4); }
  #qPanel .qh { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--line); }
  #qPanel .qh b { font-size:18px; color:var(--acc); flex:1; }
  #qList { overflow-y:auto; padding:10px 12px 20px; display:flex; flex-direction:column; gap:8px; }
  .qch { margin-top:8px; font-size:13px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--mut); display:flex; justify-content:space-between; }
  .qch.lock { opacity:.5; }
  .qc { background:rgba(255,255,255,.05); border:1px solid var(--line); border-radius:12px; padding:10px 12px; display:grid; grid-template-columns:34px 1fr auto; gap:4px 10px; align-items:center; }
  .qc.ok { border-color:#4cd07d; box-shadow:0 0 0 1px #4cd07d inset; }
  .qc.done { opacity:.45; }
  .qc .qi { font-size:24px; grid-row:span 2; text-align:center; }
  .qc .qn { font-weight:800; font-size:14px; }
  .qc .qd { font-size:12.5px; color:var(--mut); grid-column:2; }
  .qc .qr { grid-row:span 2; text-align:right; font-weight:800; color:var(--ok); font-size:13px; white-space:nowrap; }
  .qc .qbar { grid-column:1 / -1; height:6px; border-radius:3px; background:rgba(255,255,255,.1); overflow:hidden; }
  .qc .qbar i { display:block; height:100%; background:linear-gradient(90deg,var(--acc2),var(--acc)); }
  .qc .qp { grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--mut); }
  `;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.id = 'qBtn'; btn.className = 'btn2'; btn.title = 'Куести';
  btn.innerHTML = '🎯 Куести';
  const top = document.getElementById('top'), sp = top.querySelector('.sp');
  top.insertBefore(btn, sp);
  // бърз достъп до таб „Банка“ (до куестите)
  const bank = document.createElement('button');
  bank.id = 'bankBtn'; bank.className = 'btn2'; bank.title = 'Банка'; bank.innerHTML = '🏦 Банка';
  top.insertBefore(bank, sp);
  bank.onclick = () => {
    if (!S()) return;
    if (!document.getElementById('mapScreen').classList.contains('hidden')) document.getElementById('btnMapToggle').click();
    document.getElementById('qPanel')?.classList.add('hidden');
    document.querySelector('#tabs button[data-t="bank"]')?.click();
  };
  const panel = document.createElement('div');
  panel.id = 'qPanel'; panel.className = 'hidden';
  panel.innerHTML = `<div class="qh"><b>🎯 Куести</b><span id="qSum" class="meta"></span><button class="btn2" id="qClose">✕</button></div><div id="qTabs" style="display:flex;gap:6px;padding:8px 14px 0"></div><div id="qList"></div>`;
  let showDone = false;   // „✅ Изпълнени“ — взетите куести не стоят в текущия списък, а тук
  panel.querySelector('#qTabs').onclick = e => { const b = e.target.closest('[data-qtab]'); if (!b) return; showDone = b.dataset.qtab === 'done'; panel.querySelector('#qList').scrollTop = 0; render(); };
  document.body.appendChild(panel);
  btn.onclick = () => { if (!S()) return; panel.classList.toggle('hidden'); render(); };
  panel.querySelector('#qClose').onclick = () => panel.classList.add('hidden');

  const fmtN = (v, tgt) => tgt >= 1000 ? `${deps.fmt(v)} / ${deps.fmt(tgt)}` : `${Math.floor(v * 100) / 100} / ${tgt}`;
  function render() {
    if (panel.classList.contains('hidden') || !S()) return;
    const total = QUEST_COUNT, got = Object.keys(qs().claimed).length;
    panel.querySelector('#qSum').textContent = `${got} / ${total}`;
    const tab = (k, txt) => `<button class="${(k === 'done') === showDone ? 'btn' : 'btn2'}" data-qtab="${k}" style="flex:1;padding:6px 8px">${txt}</button>`;
    panel.querySelector('#qTabs').innerHTML = tab('cur', '🎯 Текущи') + tab('done', `✅ Изпълнени (${got})`);
    let h = '';
    if (showDone) {
      CHAPTERS.forEach(c => {
        const qq = c.quests.filter(claimed); if (!qq.length) return;
        h += `<div class="qch"><span>${c.ico} ${c.nm}</span><span>${qq.length}/${c.quests.length}</span></div>`;
        for (const q of qq) h += `<div class="qc done"><div class="qi">${q.ico}</div><div class="qn">${q.nm}</div><div class="qr">+${deps.fmt(q.money)} €</div><div class="qd">${q.ds}</div><div class="qp"><span>✅ Изпълнен</span></div></div>`;
      });
      if (!h) h = '<div class="meta" style="padding:14px">Още няма изпълнени куести.</div>';
    } else CHAPTERS.forEach((c, i) => {
      const open = chapterOpen(i), n = c.quests.filter(claimed).length;
      h += `<div class="qch ${open ? '' : 'lock'}"><span>${c.ico} ${c.nm}</span><span>${open ? `${n}/${c.quests.length}` : '🔒'}</span></div>`;
      if (!open && c.lockTxt) { h += `<div class="meta">${c.lockTxt}</div>`; return; }
      if (!open) { h += `<div class="meta">Вземи наградите за ${Math.ceil(CHAPTERS[i - 1].quests.length * UNLOCK_SHARE)} куеста от „${CHAPTERS[i - 1].nm}“, за да отключиш тази глава.</div>`; return; }
      // първо готовите, после текущите; взетите са в „✅ Изпълнени“
      const order = q => progress(q).ok ? 0 : 1, left = c.quests.filter(q => !claimed(q));
      if (!left.length) h += `<div class="meta">✅ Всички куести от тази глава са изпълнени.</div>`;
      for (const q of left.sort((a, b) => order(a) - order(b))) {
        const p = progress(q), done = claimed(q);
        h += `<div class="qc ${done ? 'done' : p.ok ? 'ok' : ''}"><div class="qi">${q.ico}</div><div class="qn">${q.nm}</div><div class="qr">+${deps.fmt(q.money)} €</div><div class="qd">${q.ds}</div>
          ${done ? '' : `<div class="qbar"><i style="width:${(p.cur / p.tgt * 100).toFixed(1)}%"></i></div>`}
          <div class="qp"><span>${done ? '✅ Изпълнен' : fmtN(p.cur, p.tgt)}</span>${!done && p.ok ? `<button class="btn" data-claim="${q.id}">Вземи наградата</button>` : ''}</div></div>`;
      }
    });
    const list = panel.querySelector('#qList');
    const scroll = list.scrollTop;
    list.innerHTML = h;
    list.scrollTop = scroll;
    list.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claim(b.dataset.claim));
  }
  // проверка ~веднъж в секунда: значка с броя готови и съобщение за всеки нов изпълнен куест
  let known = null, renderT = 0;
  function tick(force) {
    if (!S()) return;
    const r = ready();
    const b = r.length ? `<span class="qb">${r.length}</span>` : '';
    btn.innerHTML = `🎯 Куести${b}`;
    const ids = new Set(r.map(q => q.id));
    CHAPTERS.forEach((c, i) => { if (c.openIf && chapterOpen(i) && !qs()['open_' + i]) { qs()['open_' + i] = true; deps.toast(`📖 Нова глава с куести: ${c.ico} ${c.nm}!`, 'good'); if (c.pic && deps.pop) deps.pop(c.pic, `${c.ico} ${c.nm} — следващо ниво!`, c.picTxt || ''); } });
    if (known) for (const q of r) if (!known.has(q.id)) { deps.toast(`🎯 Куест изпълнен: ${q.nm} — вземи наградата!`, 'good', () => { panel.classList.remove('hidden'); render(); }); deps.sound('done'); }
    known = ids;
    if (force || ++renderT % 2 === 0) render();
  }
  // броени действия
  function emit(evt, data = {}) {
    if (!S()) return;
    const st = S().qstats = S().qstats || {};
    const inc = k => { st[k] = (st[k] || 0) + 1; };
    if (evt === 'complete') { if (data.type) inc(data.type); if (data.early) inc('early'); if (data.demolish) inc('demolish'); }
    else if (evt === 'buy') { inc('buy'); inc('buy_' + data.type); }
    else inc(evt);   // reno, invest, sold, delivery
  }
  return { emit, tick, render, claim, open: () => { panel.classList.remove('hidden'); render(); }, ready, chapters: CHAPTERS };
}
