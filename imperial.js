// imperial.js — 🏙️ Империал Сити като жив град (етап 2): държавата на града (🇺🇸 САЩ или 🇷🇺 Русия, избира се веднъж при основаването),
// шест показателя (население и свободни жилища, заетост, покритие на услугите, транспорт, оперативен баланс, удовлетвореност),
// обществени сгради с месечна издръжка, предложенията на кмета Десислава Илиева (до 3 приоритетни) и нивата на фирмата 21–25.
// Кварталите идват от neom.js (жилищни/делови) плюс повторяемите зони тук (жилищни блокове, делови и промишлени паркове).
// Записът: S.imp = { cc, lv, b: { [key]: [{ lv, run, prog }] }, z: { [zone]: n }, zr: [{ k, prog }], pop, sat, hist: [{ m, bal, sat }], streak, holdRes, asked }.

export const IMP_CC = {
  US: { cc: '🇺🇸', iso: 'USA', nm: 'САЩ', lat: 28.8, lon: -96.9, title: 'кмет',
    vision: 'Делови център с небостъргачи, предградия и широки булеварди', hard: 'Скъпа земя, автомобилен трафик, растящи нужди от услуги',
    econ: 'Технологии, финанси, туризъм и логистика', next: 'Президентска кампания в САЩ', landK: 1.25, trafficK: 1.3, heatK: 1, winterK: 1,
    landmark: { nm: 'Кулата „Свобода“ — 541 м', ico: '🗼' } },
  RU: { cc: '🇷🇺', iso: 'RUS', nm: 'Русия', lat: 56.9, lon: 41.6, title: 'кмет',
    vision: 'Монументален център, жилищни квартали и модерни бизнес кули', hard: 'Отопление, зимна поддръжка, големи разстояния',
    econ: 'Промишленост, енергетика, железници и логистика', next: 'Президентска кампания в Русия', landK: 0.9, trafficK: 1, heatK: 1.35, winterK: 1.25,
    landmark: { nm: 'Дворецът „Империал“ — 415 м', ico: '🏛️' } },
};
// жилища и работни места на кварталите от neom.js
const DIST_HJ = { res: [60000, 2000], res2: [60000, 2000], mall: [0, 25000], biz: [5000, 60000], marina: [15000, 12000], uni: [5000, 10000], line: [200000, 120000] };
// повторяеми зони: жилища / работа / замърсяване (промишлеността), приход на ден при пълно заемане
export const ZONES = {
  blocks: { ico: '🏢', nm: 'Жилищни блокове', house: 40000, jobs: 1000, cost: 1.1e9, days: 50, inc: 0.6e6 },
  office: { ico: '💼', nm: 'Делови парк', house: 0, jobs: 35000, cost: 1.4e9, days: 60, inc: 1.1e6 },
  ind: { ico: '🏭', nm: 'Промишлена зона', house: 0, jobs: 30000, cost: 0.9e9, days: 45, inc: 0.9e6, poll: 12 },
};
// обществени сгради: cap — колко души обслужва (транспорт: пътувания/ден), up — издръжка €/ден (персонал, ремонти), lv — от кое ниво на фирмата
export const BUILD = {
  hospital: { ico: '🏥', nm: 'Болница', cat: 'health', cap: 60000, cost: 400e6, up: 420e3, days: 60 },
  medcx: { ico: '🏨', nm: 'Медицински комплекс', cat: 'health', cap: 160000, cost: 1.1e9, up: 900e3, days: 120, lv: 22 },
  school: { ico: '🏫', nm: 'Училище', cat: 'school', cap: 50000, cost: 150e6, up: 160e3, days: 40 },
  fire: { ico: '🚒', nm: 'Пожарна', cat: 'fire', cap: 80000, cost: 100e6, up: 110e3, days: 30 },
  bus: { ico: '🚌', nm: 'Автобусно депо', cat: 'transport', cap: 60000, cost: 80e6, up: 90e3, days: 15 },
  tram: { ico: '🚋', nm: 'Трамвайна линия', cat: 'transport', cap: 200000, cost: 600e6, up: 340e3, days: 90, lv: 22 },
  metro: { ico: '🚇', nm: 'Метро', cat: 'transport', cap: 700000, cost: 3e9, up: 1.1e6, days: 240, lv: 23 },
  power: { ico: '⚡', nm: 'Електроцентрала', cat: 'power', cap: 150000, cost: 500e6, up: 260e3, days: 60, winter: true },
  water: { ico: '💧', nm: 'Водна станция', cat: 'water', cap: 150000, cost: 300e6, up: 170e3, days: 45 },
  waste: { ico: '♻️', nm: 'Завод за отпадъци', cat: 'waste', cap: 150000, cost: 200e6, up: 140e3, days: 30 },
  park: { ico: '🌳', nm: 'Парк', cat: 'env', cap: 0, cost: 120e6, up: 50e3, days: 20, green: 10 },
  landmark: { ico: '⭐', nm: 'Знаков проект', cat: 'landmark', cap: 0, cost: 8e9, up: 800e3, days: 300, lv: 24, one: true },
};
// 🌪️ кризи в града (по държавата): cat — коя услуга удрят; cap — капацитетът ѝ пада; need — нуждата расте; cost — ремонт (дял от цената на сградите от тази категория)
const EVENTS = {
  US: [{ k: 'hurricane', ico: '🌀', nm: 'Ураган от Мексиканския залив', cat: 'power', cap: 0.55, days: 18, cost: 0.15 }, { k: 'jam', ico: '🚗', nm: 'Задръстванията стават хронични', cat: 'transport', cap: 0.7, days: 30 },
    { k: 'heat', ico: '🌡️', nm: 'Гореща вълна — климатиците товарят мрежата', cat: 'power', need: 1.35, days: 20 }],
  RU: [{ k: 'frost', ico: '🥶', nm: 'Студена вълна — −35°', cat: 'power', need: 1.45, days: 20, winter: true }, { k: 'pipes', ico: '💧', nm: 'Спукани водопроводи от студа', cat: 'water', cap: 0.6, days: 15, cost: 0.12, winter: true },
    { k: 'snow', ico: '❄️', nm: 'Снежна буря — улиците са блокирани', cat: 'transport', cap: 0.6, days: 10, winter: true }],
  ALL: [{ k: 'flu', ico: '🦠', nm: 'Грипна епидемия', cat: 'health', need: 1.5, days: 25 }, { k: 'fire', ico: '🔥', nm: 'Голям пожар в промишлената зона', cat: 'fire', need: 1.6, days: 12, cost: 0.05 },
    { k: 'strike', ico: '✊', nm: 'Стачка на градския транспорт', cat: 'transport', cap: 0.5, days: 8 }],
};
const EV_GAP = [90, 160];   // дни между кризите
const UP_K = 0.5, UP_COST = 0.4, UP_DAYS = 0.35, LV_MAX = 3;   // разширение: +50% капацитет на ниво, 40% от цената, ~1/3 от времето
const FREE_TRIPS = 30000;   // улиците сами поемат толкова пътувания
const TARGET_POP = 400000;  // „Град за пример“
const NEED = { 22: 'Население 100 000+, свободни жилища поне 2%, безработица до 8%', 23: 'Население 150 000+, услуги и транспорт ≥ 90%, ток, вода и отпадъци ≥ 100%',
  24: '6 поредни месеца: положителен баланс, удовлетвореност средно ≥ 80% и нито ден под 65%', 25: `„Град за пример“: ${(TARGET_POP / 1000).toFixed(0)} 000 души, всичко от 23 и 24, без недостиг, завършен знаков проект`,
  26: 'Спечели президентските избори (270+ електорални гласа)', 27: 'Приеми държавния бюджет и изпълни първите обещания', 28: 'Икономика, услуги, енергия и сигурност в баланс', 29: 'Сключи споразумение и изпълни първата международна помощ', 30: 'Посредничи за първо устойчиво прекратяване на огъня', 31: 'Възстанови основните услуги в засегнат регион', 32: 'Обедини държави в обща коалиция', 33: 'Преодолей кризата, без договореностите да рухнат', 34: 'Договори се по оставащите конфликти', 35: 'Задръж мира и възстановяването 12 месеца' };
export const IMP_UNLOCKS = {
  21: '🏙️ Империал Сити е основан · 👩‍💼 Десислава Илиева в борда · 🏥 болници, училища, пожарни · 🚌 автобуси · ⚡ ток, вода, отпадъци · 🌳 паркове',
  22: '⚖️ Градът е в баланс · 🏨 медицински комплекси · 🚋 трамвай',
  23: '🚇 Метро · градът има услуги и транспорт за всички',
  24: '📈 Устойчив град · ⭐ знаков градски проект',
  25: '🗳️ Президентска кампания · 🏅 „Град за пример“ · 📨 покана за кандидатура',
  // 🏛️ президентският етап (по постижения, не по опит): как да помогнеш на света, без да разориш държавата и да загубиш доверието на гражданите
  26: '🏛️ Президент — печелиш изборите и съставяш кабинет',
  27: '📜 Първите 100 дни — приемаш бюджет и изпълняваш първите обещания',
  28: '⚖️ Стабилна държава — икономика, обществени услуги, енергия и сигурност в баланс',
  29: '🤝 Международен партньор — споразумения и първата международна помощ',
  30: '🕊️ Миротворец — първото устойчиво прекратяване на огъня',
  31: '🏗️ Възстановяване — засегнатите региони получават основни услуги',
  32: '🌐 Световна коалиция — държави около обща програма за сигурност и развитие',
  33: '⚡ Голямото изпитание — криза, която застрашава договореностите',
  34: '📃 Световно споразумение — договорености по оставащите конфликти',
  35: '🌍 Световен мир — мирът и възстановяването се задържат 12 месеца · 🏁 финалът на играта',
};
// оплакванията — видимата причина за недоволството
const WHY = { health: 'Болниците са препълнени', school: 'Недостиг на места в училищата', fire: 'Пожарната не стига до всички квартали', transport: 'Дълго пътуване до работа',
  power: 'Спира токът', water: 'Недостиг на вода', waste: 'Боклукът не се извозва', jobs: 'Безработица', housing: 'Няма свободни жилища', env: 'Замърсяване' };
const W = { health: 0.14, school: 0.11, fire: 0.07, transport: 0.14, power: 0.07, water: 0.06, waste: 0.05, jobs: 0.15, housing: 0.11, env: 0.1 };

// deps: { S, econ, fmt, toast, save, sound, pop, modal(title, html, buttons), neom (neom.js), lvUp(lv, text), winter(day), relocate(cc), brand() }
export function createImperial(deps) {
  const st = () => { const S = deps.S(); if (!S || !S.neom) return null; S.imp = S.imp || { b: {}, z: {}, zr: [], pop: 0, sat: 70, hist: [], streak: 0 }; const m = S.imp; m.b = m.b || {}; m.z = m.z || {}; m.zr = m.zr || []; m.hist = m.hist || []; return m; };
  const C = () => IMP_CC[st()?.cc] || null;
  const f = n => deps.fmt(Math.round(n));
  const B = n => Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 0 })} млн. €`;
  const day = () => deps.S().day || 0;
  const costOf = k => Math.round(BUILD[k].cost * (C()?.landK || 1) / 1e6) * 1e6;
  const zoneCost = k => Math.round(ZONES[k].cost * (C()?.landK || 1) / 1e6) * 1e6;
  const units = k => (st()?.b[k] || []);
  const capOf = (k, u) => BUILD[k].cap * (1 + UP_K * ((u.lv || 1) - 1));
  const lvOk = k => !BUILD[k].lv || (st()?.lv || 0) >= BUILD[k].lv;

  // ---- 📊 показателите (смятат се всеки път от текущото състояние)
  function stats() {
    const m = st(); if (!m) return null; const N = deps.neom.state(), c = C() || IMP_CC.US, win = deps.winter ? deps.winter(day()) : false;
    let house = 0, jobs = 0, indJobs = 0;
    for (const [k, [h, j]] of Object.entries(DIST_HJ)) if (N?.d?.[k]?.done) { house += h; jobs += j; }
    for (const [k, z] of Object.entries(ZONES)) { const n = m.z[k] || 0; house += z.house * n; jobs += z.jobs * n; if (z.poll) indJobs += z.jobs * n; }
    const pop = Math.min(m.pop || 0, house), workers = pop * 0.5, unemp = workers > 0 ? Math.max(0, (workers - jobs) / workers) : 0, vac = house > 0 ? (house - pop) / house : 0;
    const ev = m.ev && m.ev.until > day() ? evOf(m.ev.k) : null, evCap = c => ev && ev.cat === c && ev.cap ? ev.cap : 1, evNeed = c => ev && ev.cat === c && ev.need ? ev.need : 1;
    const cap = cat => evCap(cat) * Object.keys(BUILD).filter(k => BUILD[k].cat === cat).reduce((a, k) => a + units(k).filter(u => !u.run).reduce((s, u) => s + capOf(k, u), 0), 0);
    const cov = (have, need) => need <= 0 ? 1 : Math.min(1, have / need);
    const trips = (pop * 0.6 + jobs * 0.4) * c.trafficK, heat = c.heatK * (win ? 1.15 : 1);
    const green = units('park').filter(u => !u.run).reduce((a, u) => a + BUILD.park.green * (u.lv || 1), 0);
    const pollution = Math.max(0, Math.min(100, indJobs / 2500 + Math.max(0, trips - cap('transport') - FREE_TRIPS) / 12000 + pop / 40000 - green));
    const k = {
      health: cov(cap('health'), pop * evNeed('health')), school: cov(cap('school'), pop * 0.95), fire: cov(cap('fire'), (pop + jobs * 0.3) * evNeed('fire')), transport: cov(cap('transport') + FREE_TRIPS, trips * evNeed('transport')),
      power: cov(cap('power'), (pop + jobs * 0.4) * heat * evNeed('power')), water: cov(cap('water'), pop * evNeed('water')), waste: cov(cap('waste'), pop + indJobs * 0.5),
      jobs: Math.max(0, 1 - unemp * 4), housing: house <= 0 ? 0 : Math.min(1, 0.4 + vac * 30), env: 1 - pollution / 100,
    };
    if (pop < 1000) for (const x of ['health', 'school', 'fire', 'transport', 'power', 'water', 'waste']) k[x] = 1;   // празен град — няма от какво да се оплаква
    const expect = Math.min(12, pop / 50000 * 1.5), satT = Math.max(0, Math.round(Object.entries(W).reduce((a, [x, w]) => a + w * Math.pow(k[x], 1.6), 0) * 100 - expect));   // голям град — по-високи очаквания
    // оперативният баланс на града: приход от кварталите и зоните минус издръжката на сградите
    const zinc = Object.entries(ZONES).reduce((a, [kk, z]) => a + z.inc * (m.z[kk] || 0), 0) * (house > 0 ? Math.min(1, pop / house + 0.2) : 0);
    const up = Object.keys(BUILD).reduce((a, kk) => a + units(kk).reduce((s, u) => s + BUILD[kk].up * (1 + 0.4 * ((u.lv || 1) - 1)) * (BUILD[kk].winter && win ? c.winterK : 1), 0), 0);
    const inc = (N?._inc || 0) + zinc, svc = (k.health + k.school + k.fire) / 3, infra = Math.min(k.power, k.water, k.waste);
    const why = Object.entries(k).filter(([x, v]) => v < 0.85).sort((a, b) => (1 - b[1]) * W[b[0]] - (1 - a[1]) * W[a[0]]).map(([x, v]) => ({ k: x, v, txt: WHY[x] }));
    return { ev: ev ? { ...ev, left: m.ev.until - day() } : null, pop, house, jobs, workers, unemp, vac, k, svc, infra, satT, sat: m.sat ?? 70, inc, zinc, up, bal: inc - up, pollution, why, indJobs };
  }

  // колко от прихода на кварталите реално идва: заетите жилища и доволните хора плащат наеми и данъци
  const occ = () => { const m = st(); if (!m || !m.cc) return 1; const s = stats(); if (!s || !s.house) return 0.3; return Math.min(1.05, (0.25 + 0.75 * Math.min(1, s.pop / s.house)) * (0.55 + 0.5 * s.sat / 100)); };
  const evOf = k => [...(EVENTS[st()?.cc] || []), ...EVENTS.ALL].find(e => e.k === k);
  function evTick(d) {
    const m = st(); if (m.ev && m.ev.until <= d) { deps.toast(`✅ ${evOf(m.ev.k)?.ico || ''} ${evOf(m.ev.k)?.nm || 'Кризата'} отмина.`, 'good'); m.ev = null; }
    if (m.ev || (m.pop || 0) < 20000) return; if (m.evNext == null) m.evNext = d + EV_GAP[0]; if (d < m.evNext) return;
    const win = deps.winter ? deps.winter(d) : false, L = [...(EVENTS[m.cc] || []), ...EVENTS.ALL].filter(e => !e.winter || win), e = L[Math.floor(Math.random() * L.length)]; if (!e) return;
    m.ev = { k: e.k, until: d + e.days }; m.evNext = d + e.days + EV_GAP[0] + Math.floor(Math.random() * (EV_GAP[1] - EV_GAP[0]));
    const bill = e.cost ? Math.round(Object.keys(BUILD).filter(k => BUILD[k].cat === e.cat).reduce((a, k) => a + units(k).length * costOf(k), 0) * e.cost / 1e6) * 1e6 : 0;
    if (bill > 0) deps.econ().spend(bill, 'град', `${cityNm()}: ${e.nm} — ремонти`);
    deps.pop && deps.pop('ship-cargo', `${e.ico} ${e.nm}`, `${cityNm()}: ${e.cap ? `${WHY[e.cat] || e.cat} — капацитетът пада с ${Math.round((1 - e.cap) * 100)}%` : `нуждата расте с ${Math.round((e.need - 1) * 100)}% (${WHY[e.cat] || e.cat})`} за ${e.days} дни.${bill ? ` Ремонти: ${B(bill)}.` : ''} Резервът в капацитета помага.`);
  }
  // ---- 🏗️ строеж и разширение
  function build(k) {
    const m = st(), b = BUILD[k]; if (!m || !b || !lvOk(k) || (b.one && units(k).length)) return false;
    const c = costOf(k), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)}.`, 'bad'); return false; }
    e.spend(c, 'град', `${cityNm()}: ${b.nm}`); (m.b[k] = m.b[k] || []).push({ lv: 1, run: true, prog: 0, days: b.days });
    deps.toast(`🏗️ ${b.ico} ${landNm(k)} — строи се ${b.days} дни.`, 'good'); deps.sound && deps.sound('buy'); deps.save(); return true;
  }
  const upCost = (k, u) => Math.round(costOf(k) * UP_COST * (u.lv || 1) / 1e6) * 1e6;
  function expand(k) {   // разширява най-евтиното готово
    const m = st(); if (!m) return false; const u = units(k).filter(x => !x.run && (x.lv || 1) < LV_MAX).sort((a, b) => (a.lv || 1) - (b.lv || 1))[0]; if (!u) return false;
    const c = upCost(k, u), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)}.`, 'bad'); return false; }
    e.spend(c, 'град', `${cityNm()}: разширение — ${BUILD[k].nm}`); u.run = true; u.prog = 0; u.days = Math.max(5, Math.round(BUILD[k].days * UP_DAYS)); u.up = true;
    deps.toast(`⬆️ ${BUILD[k].ico} ${BUILD[k].nm} се разширява (${u.days} дни).`, 'good'); deps.sound && deps.sound('upgrade'); deps.save(); return true;
  }
  function zone(k) {
    const m = st(), z = ZONES[k]; if (!m || !z) return false; const c = zoneCost(k), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)}.`, 'bad'); return false; }
    e.spend(c, 'град', `${cityNm()}: ${z.nm}`); m.zr.push({ k, prog: 0 }); deps.toast(`🏗️ ${z.ico} ${z.nm} — строи се ${z.days} дни.`, 'good'); deps.sound && deps.sound('buy'); deps.save(); return true;
  }
  const cityNm = () => `${deps.brand()} Сити`;
  const landNm = k => k === 'landmark' && C() ? C().landmark.nm : BUILD[k].nm;
  const canExpand = k => units(k).some(x => !x.run && (x.lv || 1) < LV_MAX);

  // ---- 🗓️ ден: строежи, население, удовлетвореност, издръжка, месечен отчет, нивата
  function dailyTick() {
    const m = st(); if (!m || !m.cc) return; const d = day();
    for (const k of Object.keys(m.b)) for (const u of m.b[k]) if (u.run) { u.prog += 1 / (u.days || BUILD[k].days); if (u.prog >= 1) { u.run = false; if (u.up) { u.lv = (u.lv || 1) + 1; u.up = false; } deps.toast(`${BUILD[k].ico} ${landNm(k)}${u.lv > 1 ? ` — ниво ${u.lv}` : ''} е готов${k === 'landmark' ? ' — градът има своя символ!' : ''}.`, 'good'); } }
    for (const r of [...m.zr]) { r.prog += 1 / ZONES[r.k].days; if (r.prog >= 1) { m.zr.splice(m.zr.indexOf(r), 1); m.z[r.k] = (m.z[r.k] || 0) + 1; deps.toast(`${ZONES[r.k].ico} ${ZONES[r.k].nm} в ${cityNm()} е готова.`, 'good'); } }
    const s = stats();
    // хората идват, когато има жилища, работа и добър живот; при лош живот си тръгват
    const attract = (s.sat - 40) / 60 * (s.unemp > 0.15 ? 0.5 : 1);
    m.pop = Math.max(0, Math.min(s.house, (m.pop || 0) + (attract > 0 ? (s.house - (m.pop || 0)) * 0.007 * attract + 30 : (m.pop || 0) * 0.004 * attract)));
    m.sat = Math.round(((m.sat ?? 70) + (s.satT - (m.sat ?? 70)) * 0.08) * 10) / 10;
    if (s.up > 0) deps.econ().spend(Math.round(s.up), 'град', `${cityNm()}: издръжка на обществените сгради`);
    if (s.zinc > 0) deps.econ().earn(Math.round(s.zinc), 'град', `${cityNm()}: данъци и наеми от зоните`);
    m._bal = (m._bal || 0) + s.bal; m._sat = (m._sat || 0) + m.sat; m._n = (m._n || 0) + 1; m._min = Math.min(m._min ?? 100, m.sat); evTick(d);
    if (d % 30 === 0 && m._n) { const bal = m._bal, sat = m._sat / m._n; m.hist.push({ m: Math.floor(d / 30), bal: Math.round(bal), sat: Math.round(sat) }); m.hist = m.hist.slice(-24);
      m.streak = bal > 0 && sat >= 80 && (m._min ?? 0) >= 65 && (m.pop || 0) >= 10000 ? (m.streak || 0) + 1 : 0; m._bal = 0; m._sat = 0; m._n = 0; m._min = 100; }
    levels();
  }
  // ---- 🏅 нивата на фирмата 21–25 (по състоянието на града, не по опит)
  const meets = {
    21: () => !!st()?.cc,
    22: s => s.pop >= 100000 && s.vac >= 0.02 && s.unemp <= 0.08,
    23: s => s.pop >= 150000 && s.svc >= 0.9 && s.k.transport >= 0.9 && s.infra >= 1,
    24: () => (st()?.streak || 0) >= 6,
    25: s => s.pop >= TARGET_POP && meets[23](s) && s.vac >= 0.02 && s.unemp <= 0.08 && (st()?.streak || 0) >= 6 && units('landmark').some(u => !u.run),
    26: () => !!deps.S().president,   // спечелени избори (campaign.js → S.president)
    // 27–35 — кабинетът, държавният бюджет и дипломацията (следващата глава): deps.presLv() ги дава, щом ги има
    ...Object.fromEntries([27, 28, 29, 30, 31, 32, 33, 34, 35].map(l => [l, () => !!(deps.presLv && deps.presLv() >= l)])),
  };
  function levels() {
    const m = st(); if (!m) return; const s = stats();
    for (let lv = Math.max(21, (m.lv || 20) + 1); lv <= 35; lv++) { if (!meets[lv](s)) break; m.lv = lv; deps.lvUp && deps.lvUp(lv, IMP_UNLOCKS[lv]); if (lv === 25) invite(); }
  }
  function invite() {
    deps.pop && deps.pop('empire', '🏅 „Град за пример“', `${cityNm()} е завършен и устойчив. Десислава Илиева: „Господин председател, доказахте, че можете да управлявате град. Готов ли сте да управлявате държава?“ Президентската кампания в ${C()?.nm} се отключва — ти избираш кога.`);
  }
  // напредъкът към ниво lv (0…1) — за лентата на „Фирма“ над 20 (devlevel.js): средното от условията, всяко до 1
  const ratio = lv => {
    const m = st(); if (!m) return 0; if ((m.lv || 0) >= lv) return 1; if (lv === 21) return m.cc ? 1 : 0;
    const s = stats(); if (!s) return 0;
    const avg = a => a.reduce((x, y) => x + Math.max(0, Math.min(1, y)), 0) / a.length, vacR = s.vac / 0.02, unR = s.unemp <= 0.08 ? 1 : 0.08 / s.unemp, str = (m.streak || 0) / 6;
    const r23 = [s.pop / 150000, s.svc / 0.9, s.k.transport / 0.9, s.infra];
    return lv === 22 ? avg([s.pop / 100000, vacR, unR]) : lv === 23 ? avg(r23) : lv === 24 ? avg([str]) : lv === 25 ? avg([s.pop / TARGET_POP, ...r23, vacR, unR, str, units('landmark').some(u => !u.run) ? 1 : 0])
      : meets[lv] && meets[lv](s) ? 1 : 0;   // 26–35 — президентът (president.js): засега готово/не
  };
  const progress = lv => { const m = st(); if (!m) return ''; const s = stats(); if ((m.lv || 0) >= lv) return '✅'; return NEED[lv] ? `${NEED[lv]}${s ? ` · сега: ${f(s.pop)} души, жилища ${(s.vac * 100).toFixed(0)}%, безработица ${(s.unemp * 100).toFixed(0)}%, услуги ${Math.round(s.svc * 100)}%, транспорт ${Math.round(s.k.transport * 100)}%, ${m.streak || 0}/6 месеца` : ''}` : ''; };

  // ---- 🗳️ изборът на държава (веднъж, при основаването; старите записи — веднъж след зареждане)
  function choose(then) {
    const card = k => { const c = IMP_CC[k]; return `<div style="flex:1 1 240px;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px;background:rgba(255,255,255,.04)"><img src="assets/ui/imp-${k.toLowerCase()}.webp" alt="" onerror="this.remove()" style="width:100%;border-radius:8px;margin:0 0 6px"><h3 style="margin:0 0 6px">${c.cc} ${c.nm}</h3>
      <div class="meta" style="margin:3px 0"><b style="color:var(--txt)">Визия:</b> ${c.vision}</div><div class="meta" style="margin:3px 0"><b style="color:var(--txt)">Предизвикателства:</b> ${c.hard}</div><div class="meta" style="margin:3px 0"><b style="color:var(--txt)">Икономика:</b> ${c.econ}</div><div class="meta" style="margin:3px 0"><b style="color:var(--txt)">Следваща глава:</b> ${c.next}</div></div>`; };
    deps.modal('🏙️ Къде ще бъде твоят град?', `<div style="display:flex;gap:10px;flex-wrap:wrap">${card('US')}${card('RU')}</div><div class="meta" style="margin:10px 0 0;color:#ffd54a">⚠️ Този избор определя държавата за бъдещата ти президентска кампания. После не може да се смени. И в двете държави развиваш всички основни отрасли.</div>`,
      [['По-късно', null], ['🇷🇺 Русия', () => pick('RU', then)], ['🇺🇸 САЩ', () => pick('US', then)]]);
  }
  function pick(cc, then) {
    const S = deps.S(); S.imp = S.imp || { b: {}, z: {}, zr: [], pop: 0, sat: 70, hist: [], streak: 0 }; if (S.imp.cc) return; S.imp.cc = cc;
    deps.relocate && deps.relocate(cc); deps.save(); then && then(); levels();
  }
  const needChoice = () => !!deps.S()?.neom && !deps.S()?.imp?.cc;

  // ---- 👩‍💼 предложенията на Десислава: до 3 приоритетни, по тежестта на проблема (форматът е като boardProposals: id, dir, ico, text, why, cost, days, small, apply)
  function proposals() {
    const m = st(); if (!m || !m.cc) return []; const s = stats(), out = [], d = day();
    const prop = (key, ico, text, why, full, small) => out.push({ id: `mayor:${key}:${Math.floor(d / 30)}`, dir: 'mayor', ico, text, why, cost: full.cost, count: 1, days: full.days, gainTxt: full.gain || '', apply: full.run,
      small: small ? { cost: small.cost, count: 1, days: small.days, text: `½ ${small.text}`, gainTxt: small.gain || '', apply: small.run } : null, prio: 0 });
    const opt = k => ({ cost: costOf(k), days: BUILD[k].days, run: () => build(k), gain: BUILD[k].cap ? `+${f(BUILD[k].cap)} ${BUILD[k].cat === 'transport' ? 'пътувания/ден' : 'души'}` : '' });
    const ex = k => { const u = units(k).filter(x => !x.run && (x.lv || 1) < LV_MAX)[0]; return u ? { cost: upCost(k, u), days: Math.max(5, Math.round(BUILD[k].days * UP_DAYS)), run: () => expand(k), text: `Разшири: ${BUILD[k].nm.toLowerCase()} (по-бързо, +50% капацитет)`, gain: `+${f(BUILD[k].cap * UP_K)} души` } : null; };
    const pct = v => `${Math.round(v * 100)}%`;
    for (const w of s.why) {
      const sev = (1 - w.v) * W[w.k];
      if (w.k === 'health') { const big = lvOk('medcx') ? 'medcx' : 'hospital', e = ex('hospital') || ex('medcx');
        prop('health', '🏥', `Болниците покриват ${pct(w.v)} от хората. ${s.vac < 0.05 ? 'Жилищата растат по-бързо от услугите. ' : ''}Предлагам ${BUILD[big].nm.toLowerCase()}${e ? ' или по-бързо разширение на съществуващата' : ''}.`, `${w.txt}; комплексът е по-скъп и бавен, но обслужва и бъдещите квартали`, opt(big), e); }
      else if (['school', 'fire', 'power', 'water', 'waste'].includes(w.k)) { const k = { school: 'school', fire: 'fire', power: 'power', water: 'water', waste: 'waste' }[w.k], e = ex(k);
        prop(w.k, BUILD[k].ico, `${w.txt} — покритие ${pct(w.v)}. Предлагам нов обект: ${BUILD[k].nm.toLowerCase()}${e ? ' (или разширение)' : ''}.`, w.k === 'power' && C()?.heatK > 1 ? 'зимата тук иска много отопление' : 'преди следващото разширение на града', opt(k), e); }
      else if (w.k === 'transport') { const big = lvOk('metro') && s.pop > 250000 ? 'metro' : lvOk('tram') && s.pop > 80000 ? 'tram' : 'bus';
        prop('transport', BUILD[big].ico, `${w.txt}: транспортът покрива ${pct(w.v)}${C()?.trafficK > 1 ? ' — колите задръстват булевардите' : ''}. Предлагам ${BUILD[big].nm.toLowerCase()}.`, 'Мария (Рейл) осигурява връзките, Ивайло строи', opt(big), big !== 'bus' ? { ...opt('bus'), text: 'Автобусно депо (по-евтино, по-малък капацитет)' } : null); }
      else if (w.k === 'jobs') prop('jobs', '💼', `Безработицата е ${pct(s.unemp)}. Да привлечем бизнес: делови парк или по-евтина промишлена зона?`, 'хората без работа си тръгват', { cost: zoneCost('office'), days: ZONES.office.days, run: () => zone('office'), gain: `+${f(ZONES.office.jobs)} работни места` }, { cost: zoneCost('ind'), days: ZONES.ind.days, run: () => zone('ind'), text: 'Промишлена зона (по-евтино, но замърсява)', gain: `+${f(ZONES.ind.jobs)} работни места` });
      else if (w.k === 'housing' && !(m.holdRes > d)) prop('housing', '🏢', `Свободните жилища са ${pct(s.vac)} — хората нямат къде да се нанесат. Предлагам жилищни блокове.`, 'без жилища градът не расте', { cost: zoneCost('blocks'), days: ZONES.blocks.days, run: () => zone('blocks'), gain: `+${f(ZONES.blocks.house)} жилища` });
      else if (w.k === 'env') prop('env', '🌳', `Замърсяването е ${Math.round(s.pollution)}/100. Предлагам нов парк — по-високо качество на живот срещу разход.`, 'чистият въздух вдига удовлетвореността', opt('park'), ex('park'));
      if (out.length) out[out.length - 1].prio = sev;
    }
    if (lvOk('landmark') && !units('landmark').length) out.push({ id: `mayor:landmark:1`, dir: 'mayor', ico: C().landmark.ico, text: `Градът е устойчив. Време е за знаковия проект — ${C().landmark.nm}.`, why: 'последното условие за „Град за пример“', cost: costOf('landmark'), count: 1, days: BUILD.landmark.days, gainTxt: 'символ на града', apply: () => build('landmark'), prio: 1 });
    return out.sort((a, b) => b.prio - a.prio).slice(0, 3);
  }
  const holdHousing = () => { const m = st(); if (m) { m.holdRes = day() + 60; deps.save(); } };

  // ---- 🪟 прозорецът: шестте показателя, оплакванията, сградите
  function winHtml() {
    const m = st(); if (!m) return ''; if (!m.cc) return `<div class="card" style="border:1px solid #ffd54a"><div class="row" style="margin:0;align-items:center;gap:10px"><span class="meta" style="margin:0;flex:1">🗳️ Избери държавата на града — тя определя и бъдещата ти президентска кампания.</span><button class="btn" data-impchoose="1">Избери държава</button></div></div>`;
    const s = stats(), c = C(), bar = (v, col) => `<div class="bar" style="margin:3px 0 0"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${col || (v >= 0.9 ? 'var(--ok)' : v >= 0.7 ? '#ffd54a' : 'var(--bad)')}"></i></div>`;
    const ind = (ico, nm, val, v, sub) => `<div style="flex:1 1 150px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04)"><div class="meta" style="margin:0">${ico} ${nm}</div><b style="font-size:17px">${val}</b>${bar(v)}<div class="meta" style="margin:3px 0 0;font-size:11px">${sub}</div></div>`;
    let h = `<div class="card"><h3 style="margin:0 0 6px;display:flex;align-items:center;gap:8px"><img src="assets/ui/seal-imperial.webp" alt="" onerror="this.remove()" style="width:44px;height:44px">${c.cc} ${cityNm()} · ${c.nm} <span class="meta" style="margin:0 0 0 auto">👩‍💼 Десислава Илиева, ${c.title}</span></h3><div style="display:flex;flex-wrap:wrap;gap:8px">`;
    h += ind('👥', 'Население', f(s.pop), s.house ? s.pop / s.house : 0, `жилища ${f(s.house)} · свободни ${(s.vac * 100).toFixed(1)}%`);
    h += ind('💼', 'Заетост', `${(100 - s.unemp * 100).toFixed(1)}%`, s.k.jobs, `работни места ${f(s.jobs)} · търсят ${f(s.workers)}`);
    h += ind('🏥', 'Услуги', `${Math.round(s.svc * 100)}%`, s.svc, `болници ${Math.round(s.k.health * 100)}% · училища ${Math.round(s.k.school * 100)}% · пожарни ${Math.round(s.k.fire * 100)}%`);
    h += ind('🚇', 'Транспорт', `${Math.round(s.k.transport * 100)}%`, s.k.transport, `ток ${Math.round(s.k.power * 100)}% · вода ${Math.round(s.k.water * 100)}% · отпадъци ${Math.round(s.k.waste * 100)}%`);
    h += ind('💶', 'Оперативен баланс', `${s.bal >= 0 ? '+' : ''}${f(s.bal)} €/ден`, s.bal >= 0 ? 1 : 0.3, `приход ${f(s.inc)} · издръжка ${f(s.up)}`);
    h += ind('😊', 'Удовлетвореност', `${Math.round(s.sat)}%`, s.sat / 100, `${m.streak || 0}/6 добри месеца подред`);
    if (s.ev) h += `<div class='meta' style='margin:8px 0 0;color:#ffb300'>${s.ev.ico} <b>${s.ev.nm}</b> — още ${s.ev.left} дни.</div>`;
    h += `</div>${s.why.length ? `<div class="meta" style="margin:8px 0 0">😟 Оплаквания: ${s.why.slice(0, 4).map(w => `<b style="color:#ff8a8a">${w.txt}</b>`).join(' · ')}</div>` : `<div class="meta" style="margin:8px 0 0;color:var(--ok)">😊 Няма сериозни оплаквания.</div>`}</div>`;
    const next = [22, 23, 24, 25].find(l => (m.lv || 20) < l);
    if (next) h += `<div class="card"><div class="meta" style="margin:0">🏅 Към ниво ${next}: ${NEED[next]}</div></div>`; else h += `<div class="card" style="border:1px solid #ffd54a"><div class="meta" style="margin:0;color:#ffd54a">🏅 „Град за пример“ — президентската кампания в ${c.nm} те чака.</div></div>`;
    const row = k => { const b = BUILD[k], us = units(k), ok = lvOk(k), e = canExpand(k), c0 = costOf(k), run = us.filter(u => u.run);
      return `<div class="row" style="margin:4px 0;align-items:center;gap:6px;${ok ? '' : 'opacity:.5'}"><span class="meta" style="margin:0;flex:1">${b.ico} <b style="color:var(--txt)">${landNm(k)}</b> ×${us.filter(u => !u.run).length}${run.length ? ` · строят се ${run.map(u => Math.round(u.prog * 100) + '%').join(', ')}` : ''} · издръжка ${f(b.up)} €/ден${b.lv && !ok ? ` · 🔒 ниво ${b.lv}` : ''}</span>${e ? `<button class="btn2" data-impup="${k}">⬆️ ${B(upCost(k, us.find(u => !u.run && (u.lv || 1) < LV_MAX)))}</button>` : ''}${ok && !(b.one && us.length) ? `<button class="btn2" data-impb="${k}" ${deps.econ().canAfford(c0) ? '' : 'disabled'}>＋ ${B(c0)}</button>` : ''}</div>`; };
    h += `<div class="card"><h3 style="margin:0 0 6px">🏛️ Обществени сгради</h3>${Object.keys(BUILD).map(row).join('')}</div>`;
    h += `<div class="card"><h3 style="margin:0 0 6px">🗺️ Зони</h3>${Object.entries(ZONES).map(([k, z]) => `<div class="row" style="margin:4px 0;align-items:center;gap:6px"><span class="meta" style="margin:0;flex:1">${z.ico} <b style="color:var(--txt)">${z.nm}</b> ×${m.z[k] || 0}${m.zr.filter(r => r.k === k).length ? ` · строят се ${m.zr.filter(r => r.k === k).map(r => Math.round(r.prog * 100) + '%').join(', ')}` : ''} · ${z.house ? `+${f(z.house)} жилища` : `+${f(z.jobs)} работни места`}${z.poll ? ' · замърсява' : ''}</span><button class="btn2" data-impz="${k}" ${deps.econ().canAfford(zoneCost(k)) ? '' : 'disabled'}>＋ ${B(zoneCost(k))}</button></div>`).join('')}</div>`;
    return h;
  }
  function bind(box, rerender) {
    const on = (sel, fn) => box.querySelectorAll(sel).forEach(b => b.onclick = () => { fn(b); rerender(); });
    on('[data-impb]', b => build(b.dataset.impb)); on('[data-impup]', b => expand(b.dataset.impup)); on('[data-impz]', b => zone(b.dataset.impz));
    box.querySelectorAll('[data-impchoose]').forEach(b => b.onclick = () => choose(rerender));
  }
  const geo = () => { const c = C(); return c ? { country: c.iso, kind: 'district', cities: [{ nm: cityNm(), lat: c.lat, lon: c.lon }] } : null; };
  return { occ, state: st, stats, build, expand, zone, dailyTick, proposals, choose, pick, needChoice, winHtml, bind, geo, holdHousing, progress, ratio, level: () => st()?.lv || 0, country: () => C(), NEED, IMP_UNLOCKS };
}
