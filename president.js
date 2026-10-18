// president.js — 🏛️ президентският етап (нива 27–35): как да помогнеш на света, без да разориш собствената си държава и да загубиш доверието на гражданите.
// Държавата има отделен бюджет (не е касата на холдинга — фирмата я водят заместници). Директорите стават министри (directors3d.js MINISTERS):
// fin Борис · reg Георги · def Ивайло · roads Надя · rail Мария · sea Стефан · air Елена · energy Вера · pm Десислава.
// Всеки месец министрите внасят национални програми, помощ за други държави и стъпки към мира; решенията са в Министерския съвет (openCabinet).
// Помощта е проект: финансиране → доставка → строеж → местен персонал и издръжка. Мирът е поредица стъпки, които другите могат да откажат, и после трябва да се поддържа.
// Записът: S.pres = { cc, start, res, ind, prom, progs, rel, stab, deals, coal, aid, conf, met, streak, held, crisis, crisisDone, world, lv, cab, skip, seq, log }.
import { POL, NEED, AID, AID_STAGES, CONFLICTS, PEACE, baseRel, mapSvg } from './worldpol.js';

const IND = { econ: ['📈', 'Икономика'], services: ['🏥', 'Обществени услуги'], energy: ['⚡', 'Енергия'], security: ['🛡️', 'Сигурност'], trust: ['🤝', 'Доверие на гражданите'] };
const REV = { US: 4e11, RU: 1e11 };   // приход на държавата на месец
const FREE_K = 0.1;                   // свободни за нови програми (останалото — задължителни разходи)
// националните програми: c — цена в месечни „свободни“; eff — какво носят; rev — промяна на прихода (дял)
const DOM = [
  { k: 'hosp', dir: 'reg', ico: '🏥', nm: 'Национална програма за болници', c: 1.2, days: 180, eff: { services: 9, trust: 3 } },
  { k: 'housing', dir: 'reg', ico: '🏘️', nm: 'Достъпни жилища в регионите', c: 1.0, days: 240, eff: { services: 6, econ: 2, trust: 3 } },
  { k: 'roads', dir: 'roads', ico: '🛣️', nm: 'Ремонт на националните пътища и мостове', c: 0.9, days: 200, eff: { econ: 6, services: 2 } },
  { k: 'rail', dir: 'rail', ico: '🚆', nm: 'Скоростни влакове и градски транспорт', c: 1.4, days: 300, eff: { econ: 5, services: 4 } },
  { k: 'ports', dir: 'sea', ico: '⚓', nm: 'Модернизация на пристанищата и износа', c: 0.8, days: 180, eff: { econ: 6 } },
  { k: 'air', dir: 'air', ico: '✈️', nm: 'Летища и споразумения „Открито небе“', c: 0.6, days: 150, eff: { econ: 4, rel: 2 } },
  { k: 'grid', dir: 'energy', ico: '⚡', nm: 'Нови централи и енергийна мрежа', c: 1.5, days: 360, eff: { energy: 13, econ: 2 } },
  { k: 'def', dir: 'def', ico: '🛡️', nm: 'Готовност, гранична охрана и киберзащита', c: 1.0, days: 200, eff: { security: 11 } },
  { k: 'tax', dir: 'fin', ico: '💰', nm: 'По-ниски данъци за средната класа', c: 0, days: 30, eff: { trust: 7, econ: 2 }, rev: -0.04 },
  { k: 'audit', dir: 'fin', ico: '🧾', nm: 'Одит и борба с разхищенията', c: 0.2, days: 90, eff: { trust: 3 }, rev: 0.03 },
];
const PROMISES = { US: ['hosp', 'tax', 'roads'], RU: ['housing', 'grid', 'def'] };
const CRISES = [
  { k: 'energy', ico: '⚡', nm: 'Световна енергийна криза', txt: 'цените на горивата скачат, а примирията се клатят' },
  { k: 'breach', ico: '💥', nm: 'Масово нарушение на примирията', txt: 'въоръжени групи не признават договореностите' },
  { k: 'flood', ico: '🌊', nm: 'Опустошителни наводнения в засегнатите региони', txt: 'възстановеното е под вода, помощта не стига' },
];
// 🌊 Ормузкият проток (алтернативна игрова хронология): корабоплаването спира → енергия и икономика падат, петролът поскъпва;
// действията се комбинират — резерви, алтернативни доставки, придружаване и механизъм срещу инциденти, дипломатическа инициатива,
// споразумение за безопасно преминаване (с проверка), дългосрочна диверсификация. Отказите казват защо.
const HZ_PARTNERS = ['SAU', 'IND', 'CHN', 'TUR', 'GBR', 'FRA', 'JPN', 'KOR'];
const HZ_START = 40;   // дни след встъпването
// 📝 мирният пакет: вместо „Предложи мир“ — шест части; всяка страна ги претегля по своите интереси и казва защо приема, отказва или връща
export const PKG = [
  { k: 'now', nm: 'Незабавни действия', opt: ['Хуманитарни паузи', 'Прекратяване на огъня по линията', 'Прекратяване на огъня и обмен на пленници'] },
  { k: 'obl', nm: 'Взаимни задължения', opt: ['Без срокове', 'Отвеждане на тежкото въоръжение (30 дни)', 'Поетапно изтегляне с месечен график'] },
  { k: 'ver', nm: 'Проверка', opt: ['Без наблюдатели', 'Международни наблюдатели', 'Наблюдатели, сателитен мониторинг и доклади'], cost: [0, 0.4, 0.8] },
  { k: 'gua', nm: 'Гаранции', opt: ['Политически декларации', 'Механизъм при нарушения (съвместна комисия)', 'Гаранции от коалицията'] },
  { k: 'rec', nm: 'Възстановяване', opt: ['Без', 'Фонд на етапи срещу проверими резултати', 'Голям фонд с партньорите'], cost: [0, 0.25, 0.5] },   // месечна вноска за 12 месеца
  { k: 'next', nm: 'Следващи преговори', opt: ['Без график', 'Кръгла маса до 90 дни', 'Пътна карта за спорните въпроси'] },
];
// интересите на страните: тежест на всяка част, червени линии и колко им трябва (алтернативна игрова хронология — не реални позиции)
const PREF = {
  east: { UKR: { w: { now: 2, obl: 2, ver: 3, gua: 3, rec: 2, next: 1 }, need: 30, red: [['gua', 0, 'Недостатъчни гаранции'], ['ver', 0, 'Липсва проверка']] },
          RUS: { w: { now: 2, obl: 1, ver: 1, gua: 1, rec: 1, next: 3 }, need: 22, red: [['obl', 2, 'Неприемливи срокове'], ['next', 0, 'Няма график за спорните въпроси']] } },
  mideast: { ISR: { w: { now: 2, obl: 2, ver: 3, gua: 3, rec: 1, next: 1 }, need: 28, red: [['ver', 0, 'Липсва проверка'], ['gua', 0, 'Недостатъчни гаранции за сигурност']] },
             PSX: { w: { now: 3, obl: 2, ver: 2, gua: 2, rec: 3, next: 2 }, need: 28, red: [['now', 0, 'Няма истинско прекратяване на огъня и хуманитарен достъп'], ['rec', 0, 'Няма възстановяване']] } },
};
const PREF_DEF = { w: { now: 3, obl: 1, ver: 2, gua: 2, rec: 2, next: 1 }, need: 20, red: [['now', 0, 'Няма истинско прекратяване на огъня']] };
// 🏗️ помощта се отчита само когато работи: доставката минава по безопасен маршрут, сградата има ток, местен персонал и платена издръжка
const NEEDS_POWER = ['health', 'water', 'housing', 'rebuild'];
const EFFECT = { energy: '≈ 2 млн. души с ток', water: '≈ 400 000 души с чиста вода', health: '≈ 300 000 души с болница и лекарства', food: '≈ 1 млн. души с храна', transport: 'пътищата и жп свързват регионите', housing: '≈ 50 000 семейства с дом', rebuild: 'основните услуги работят отново' };
const WAIT = { route: ['sea', '🚢', 'Стефан: маршрутът за доставката не е безопасен. Предлагам сухопътен коридор с придружаване.', 'без доставка строежът не може да започне', 0.15],
  power: ['energy', '⚡', 'Вера: сградата е готова, но няма ток. Предлагам генератори и свързване към мрежата.', 'болница без ток не е болница', 0.1],
  staff: ['reg', '👥', 'Георги: нужен е местен персонал. Предлагам обучение и заплати за първата година — и местни работни места.', 'построено без хора не се отчита като помощ', 0.12],
  upkeep: ['fin', '💶', 'Борис: издръжката на проекта не е платена два месеца и той угасва. Предлагам да възстановим финансирането.', 'иначе построеното спира да работи', 0] };
const NAMES = { fin: 'Борис', reg: 'Георги', def: 'Ивайло', roads: 'Надя', rail: 'Мария', sea: 'Стефан', air: 'Елена', energy: 'Вера', pm: 'Десислава' };

// deps: { S, fmt, toast, save, sound, pop(key, title, text), brand() → име, brandCol }
export function createPresidency(deps) {
  const st = () => deps.S().pres || null;
  const day = () => deps.S().day || 0;
  const B = n => { const a = Math.abs(n); return a >= 1e12 ? `${(n / 1e12).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} трлн. €` : a >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 0 })} млн. €`; };
  const cl = v => Math.max(0, Math.min(100, v));
  const free = () => REV[st()?.cc || 'US'] * FREE_K;
  const K = () => st()?.cc === 'RU' ? 0.5 : 1;   // помощта и мащабът — по-малки при руския бюджет
  const rel = iso => st()?.rel?.[iso] ?? baseRel(st()?.cc || 'US', iso);
  const trust = iso => st()?.tr?.[iso] ?? Math.round(50 + (rel(iso) - 50) * 0.35);   // доверие към теб като посредник ≠ отношения
  const stab = iso => st()?.stab?.[iso] ?? POL[iso]?.stab ?? 50;
  const conf = k => { const s = st(); const c = CONFLICTS.find(x => x.k === k); return (s && s.conf[k]) || { step: 0, stab: 0, int: c ? c.int : 50, wait: 0, held: 0 }; };
  const me = () => st()?.cc === 'RU' ? 'RUS' : 'USA';
  const nm = iso => POL[iso]?.nm || iso;
  const log = t => { const s = st(); s.log = [{ d: day(), t }, ...(s.log || [])].slice(0, 40); };

  function start(cc) {
    const S = deps.S(); if (S.pres) return;
    S.pres = { cc, start: day(), res: REV[cc] * FREE_K * 3, ind: { econ: 55, services: 50, energy: cc === 'RU' ? 60 : 52, security: 56, trust: 64 },
      prom: PROMISES[cc].map(k => ({ k, done: false })), progs: [], rel: {}, stab: {}, deals: {}, coal: {}, aid: [], conf: {}, met: {}, streak: 0, world: 0, lv: 26, cab: 0, skip: {}, seq: 0, log: [] };
    for (const c of CONFLICTS) S.pres.conf[c.k] = { step: 0, stab: 0, int: c.int, wait: 0, held: 0 };
    S.pres.hz = { st: 'calm', ship: 100, res: 100, talk: 0 }; S.pres.tr = {};
    log('Встъпване в длъжност. Кабинетът е съставен.'); deps.save();
  }

  // ---- 📋 предложенията на министрите (форматът на залата: id, dir, ico, text, why, cost, days, gainTxt, small, geo)
  function proposals() {
    const s = st(); if (!s) return []; const out = [], F = free(), d = day(), skip = id => (s.skip[id] || 0) > d;
    const P = p => { if (!skip(p.id.split(':').slice(0, 2).join(':'))) out.push(p); };
    // 🌊 Ормузкият проток — извънредните решения са първи
    const hz = s.hz || {}; if (hz.st && hz.st !== 'calm' && hz.st !== 'safe' || hz.inc) {
      const HZ = (k, dir, ico, text, why, cost, days, gain, x = {}) => P({ id: `${dir}:hz-${k}:1`, dir, ico, text, why, cost: Math.round(cost), days, gainTxt: gain, kind: 'hz', act: k, emergency: true, geo: { country: 'IRN', kind: 'route', cities: [{ nm: 'Ормузкият проток', lat: 26.6, lon: 56.3 }, { nm: 'Рияд', lat: 24.71, lon: 46.68 }] }, ...x });
      if (hz.res >= 30) HZ('res', 'energy', '🛢️', 'Вера: да освободим временно част от стратегическите резерви.', `облекчава недостига сега, но резервът пада от ${Math.round(hz.res)}% на ${Math.round(hz.res - 35)}% — по-малка защита при следващ проблем`, 0, 1, '+10 енергия веднага', { noAuto: true });
      if (!(hz.alt > d)) HZ('alt', 'sea', '🚢', 'Стефан: алтернативни доставки по други маршрути.', 'струват повече и искат време и свободен транспорт; за 60 дни недостигът е наполовина', F * 0.6, 20, 'недостигът ×0,5 за 60 дни');
      if (!(hz.esc > d)) HZ('esc', 'def', '🛡️', 'Ивайло: мисия за придружаване и механизъм срещу инциденти.', 'проверката и гаранциите — без тях споразумение не издържа', F * 1.0, 15, 'гаранции за 180 дни');
      if (hz.st === 'closed' || hz.st === 'talks') { if ((hz.talk || 0) < 2) HZ('dip', 'pm', '📞', 'Десислава: дипломатическа инициатива — канал към страните и партньорите.', 'отваря преговори, без гарантиран незабавен резултат', F * 0.1, 30, `стъпка ${(hz.talk || 0) + 1} от 2 към споразумение`, { noAuto: true });
        else HZ('deal', 'pm', '📃', 'Десислава: споразумение за безопасно корабоплаване — проверка, гаранции, механизъм срещу инциденти.', 'изисква приемане от участниците и проверка на изпълнението', F * 0.3, 30, '🌊 протокът се отваря', { noAuto: true }); }
      if (!hz.div) HZ('div', 'energy', '⚡', 'Вера: ускорена енергийна диверсификация — нови доставчици, складове и възобновяеми източници.', 'помага дългосрочно, но не решава днешния недостиг', F * 1.5, 240, 'следващото спиране удря наполовина');
    }
    if (hz.inc) P({ id: `def:hz-inc:1`, dir: 'def', ico: '⚠️', text: 'Ивайло: инцидент в протока — предлагам съвместно разследване и наблюдатели.', why: 'дребен инцидент не трябва да заличи постигнатото, ако реагираме навреме', cost: Math.round(F * 0.3), days: 10, gainTxt: 'протокът остава отворен', kind: 'hz', act: 'inc', emergency: true });
    // вътрешни програми: първо обещанията и най-слабите показатели
    const low = Object.entries(s.ind).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const dom = DOM.filter(p => !s.progs.some(x => x.k === p.k) && !((s.doneAt || {})[p.k] > d - 240)).map(p => ({ p, prom: s.prom.some(x => x.k === p.k && !x.done), w: Math.min(...Object.keys(p.eff).map(e => low.indexOf(e) < 0 ? 9 : low.indexOf(e))) }))
      .sort((a, b) => b.prom - a.prom || a.w - b.w).slice(0, 4);
    for (const { p, prom } of dom) { const cost = Math.round(F * p.c / 1e8) * 1e8;
      P({ id: `${p.dir}:${p.k}:1`, dir: p.dir, ico: p.ico, text: `${NAMES[p.dir]}: предлагам „${p.nm}“.${prom ? ' Това е предизборно обещание.' : ''}`, why: Object.entries(p.eff).map(([e, v]) => e === 'rel' ? `+${v} отношения със света` : `${IND[e][1]} +${v}`).join(', ') + (p.rev ? ` · приходите ${p.rev > 0 ? '+' : ''}${Math.round(p.rev * 100)}%` : ''),
        cost, days: p.days, gainTxt: prom ? '✔ изпълнява обещание' : '', small: cost ? { cost: Math.round(cost / 2 / 1e8) * 1e8, days: Math.round(p.days * 0.7), text: `½ Първи етап: ${p.nm.toLowerCase()}` } : null, kind: 'dom', k: p.k }); }
    // 🤝 споразумения — с най-близките държави без споразумение
    for (const iso of Object.keys(POL).filter(i => i !== me() && !s.deals[i] && rel(i) >= 45).sort((a, b) => rel(b) - rel(a)).slice(0, 2))
      P({ id: `pm:deal-${iso}:1`, dir: 'pm', ico: '🤝', text: `Десислава (дипломатическият екип): ${nm(iso)} е готова за споразумение за сътрудничество (търговия, полети, обмен).`, why: `отношенията са ${Math.round(rel(iso))}/100 — колкото по-високи, толкова по-сигурно приемат`, cost: 0, days: 30, gainTxt: '+10 отношения, достъп за помощ', kind: 'deal', iso, geo: geoOf(iso) });
    // 📦 помощ — за най-нестабилните с нужди (в зона на конфликт — след хуманитарен достъп)
    const needs = [];
    for (const [iso, c] of Object.entries(POL)) for (const n of c.need || []) {
      if ((s.met[iso] || {})[n] || s.aid.some(a => a.iso === iso && a.need === n && !a.done) || rel(iso) < 30) continue;
      const war = CONFLICTS.find(x => x.region === iso && x.k && conf(x.k).step < 2 && conf(x.k).step < 6); if (war) continue;
      if (n === 'rebuild' && !CONFLICTS.some(x => x.region === iso && conf(x.k).step >= 3)) continue;
      needs.push({ iso, n, w: stab(iso) });
    }
    for (const o of needs.sort((a, b) => a.w - b.w).slice(0, 2)) { const A = AID[o.n], cost = Math.round(A.cost * K() / 1e8) * 1e8;
      P({ id: `${A.dir}:aid-${o.iso}-${o.n}:1`, dir: A.dir, ico: NEED[o.n][0], text: `${NAMES[A.dir]}: ${nm(o.iso)} има нужда от ${NEED[o.n][1]}. Предлагам проект „${A.nm}“ — финансиране, доставка, строеж и местен персонал.`, why: `стабилността там е ${Math.round(stab(o.iso))}/100; без издръжка след това проектът угасва (${B(A.up * K())}/месец)`,
        cost, days: A.days, gainTxt: `+стабилност и отношения с ${nm(o.iso)}`, small: { cost: Math.round(cost * 0.5 / 1e8) * 1e8, days: Math.round(A.days * 0.6), text: `½ Споделено финансиране с партньори: ${A.nm.toLowerCase()}` }, kind: 'aid', iso: o.iso, need: o.n, geo: geoOf(o.iso) }); }
    // 🏗️ чакащите проекти за помощ: министърът казва какво липсва, за да заработи
    for (const a of s.aid.filter(x => x.wait)) { const [dir, ico, text, why, c] = WAIT[a.wait];
      P({ id: `${dir}:aidfix-${a.id}-${a.wait}:1`, dir, ico, text: `${text} (${nm(a.iso)} · ${AID[a.need].nm})`, why, cost: Math.round(a.wait === 'upkeep' ? a.up * 2 : AID[a.need].cost * K() * c), days: a.wait === 'staff' ? 45 : 20, gainTxt: a.wait === 'upkeep' ? 'проектът работи отново' : 'проектът продължава', kind: 'aidfix', aid: a.id, emergency: a.wait === 'upkeep', iso: a.iso, geo: geoOf(a.iso) }); }
    // 🕊️ мирът: следващата стъпка за всеки конфликт
    for (const c of CONFLICTS) { const k = conf(c.k); if (k.step >= 2 && k.step !== 3 && k.step < 5 && !(k.wait > d)) { const party = c.parties.includes(me());
        P({ id: `pm:pkg-${c.k}-${k.step}:1`, dir: party ? 'def' : 'pm', ico: '📝', text: `${NAMES[party ? 'def' : 'pm']}: ${c.nm} — страните са готови да чуят ${k.step >= 4 ? 'пакет за широко споразумение' : 'мирен пакет'}. Да го съставим заедно?`, why: 'незабавни действия, задължения, проверка, гаранции, възстановяване и следващи преговори — всяка страна претегля различно', cost: 0, days: 30, gainTxt: k.step >= 4 ? '📃 широко споразумение' : '🕊️ прекратяване на огъня', kind: 'pkgHint', ck: c.k, geo: geoOf(c.region) }); continue; }
      if (k.step >= 2) continue; }
    for (const c of CONFLICTS) { const k = conf(c.k); if (k.step >= 2 || k.wait > d) continue; const st6 = PEACE[k.step], party = c.parties.includes(me());
      const dir = party ? 'def' : 'pm', p = Math.round(chance(c) * 100);   // преговорите — дипломатическият екип на Десислава
      P({ id: `${dir}:peace-${c.k}-${k.step}:1`, dir, ico: st6.ico, text: party ? `${NAMES[dir]}: ${c.nm} — ние сме страна. Предлагам „${st6.nm}“: решението е наше, но струва доверие у дома.` : `${NAMES[dir]}: ${c.nm} — предлагам следващата стъпка: „${st6.nm}“.`,
        why: `шанс другите да приемат ~${p}%${k.step === 2 ? ' · след примирието то трябва да се поддържа' : ''}`, cost: Math.round((k.step >= 3 ? 2e9 : 5e8) * K()), days: 30, gainTxt: k.step === 2 ? '🕊️ прекратяване на огъня' : `стъпка ${k.step + 1} от 6`, kind: 'peace', ck: c.k, geo: geoOf(c.region) }); }
    // 🔧 примирие в опасност — ранно предупреждение
    for (const c of CONFLICTS) { const k = conf(c.k); if (k.step >= 3 && k.step < 6 && k.stab < 45)
      P({ id: `def:hold-${c.k}:1`, dir: 'def', ico: '🔍', text: `Ивайло: примирието в „${c.nm}“ се клати (${Math.round(k.stab)}/100). Предлагам наблюдатели и доставки, за да не рухне.`, why: 'без доставки, възстановяване и доверие договореността става нестабилна', cost: Math.round(3e9 * K()), days: 20, gainTxt: '+30 стабилност на примирието', kind: 'hold', ck: c.k, geo: geoOf(c.region) }); }
    // 🌐 коалиция (от ниво 31)
    if (s.lv >= 31) for (const iso of Object.keys(POL).filter(i => i !== me() && s.deals[i] && !s.coal[i] && rel(i) >= 65).slice(0, 2))
      P({ id: `pm:coal-${iso}:1`, dir: 'pm', ico: '🌐', text: `Десислава: да поканим ${nm(iso)} в коалицията за сигурност и развитие?`, why: 'общата програма разпределя цената на помощта и пази мира', cost: 0, days: 30, gainTxt: 'член на коалицията', kind: 'coal', iso, geo: geoOf(iso) });
    // ⚡ голямото изпитание
    if (s.crisis && !s.crisis.done) for (const [dir, t] of [['fin', 'извънреден фонд'], ['def', 'мисия за стабилизиране'], ['pm', 'среща на върха на коалицията']])
      P({ id: `${dir}:crisis-${s.crisis.k}-${dir}:1`, dir, ico: s.crisis.ico, text: `${NAMES[dir]}: „${s.crisis.nm}“ — предлагам ${t}.`, why: `${s.crisis.txt}; остават ${s.crisis.until - d} дни`, cost: Math.round((dir === 'fin' ? 2e10 : 6e9) * K()), days: 15, gainTxt: 'една стъпка към преодоляването', kind: 'crisis', act: dir });
    return out;
  }
  const geoOf = iso => POL[iso] ? { country: iso, kind: 'district', cities: [{ nm: POL[iso].cap, lat: POL[iso].lat, lon: POL[iso].lon }] } : null;
  function chance(c) {
    const s = st(), k = conf(c.k), parties = c.parties.filter(i => i !== me()), r = parties.length ? parties.reduce((a, i) => a + rel(i), 0) / parties.length : 60;
    const aidIn = s.aid.filter(a => a.done && a.works !== false && c.parties.concat(c.region).includes(a.iso)).length, coal = Object.keys(s.coal).length;
    const party = c.parties.includes(me());
    return Math.max(0.08, Math.min(0.92, (party ? 0.55 : 0.3) + r / 250 + aidIn * 0.08 + coal * 0.03 + s.ind.trust / 500 - k.int / 350 - k.step * 0.03));
  }

  // ---- 📝 оценка на пакета: за всяка страна — приема / насрещно предложение / отказва, с причината (без произволни откази)
  const pkgCost = pkg => Math.round(free() * PKG.reduce((a, P0) => a + (P0.cost ? P0.cost[pkg[P0.k] || 0] : 0), 0) * (st()?.cc === 'RU' ? 1 : 1));
  function evalPkg(ck, pkg) {
    const s = st(), c = CONFLICTS.find(x => x.k === ck), parties = c.parties.filter(i => i !== me()), coal = Object.keys(s.coal).length, k = conf(ck), resp = [];
    for (const iso of parties) { const pr = (PREF[ck] || {})[iso] || PREF_DEF;
      let score = PKG.reduce((a, P0) => a + (pr.w[P0.k] || 1) * (pkg[P0.k] || 0) * 2, 0) + (trust(iso) - 50) / 3 + (rel(iso) - 50) / 6 + coal * 1.5 - k.int / 10;
      const why = []; for (const [part, bad, txt] of pr.red) if ((pkg[part] || 0) === bad) why.push(txt);
      if ((pkg.gua || 0) === 2 && coal < 3) why.push('Липсва подкрепа от партньор — коалицията е твърде малка за такива гаранции');
      if (k.broken) { score -= 8; why.push('Нарушено предишно обещание'); }
      if (k.step >= 4 && ((pkg.gua || 0) < 1 || (pkg.next || 0) < 1)) why.push('Широкото споразумение иска механизъм при нарушения и график за преговорите');
      const ok = !why.length && score >= pr.need ? 'yes' : score >= pr.need - 10 && why.length <= 1 ? 'counter' : 'no';
      const weakest = PKG.filter(P0 => (pkg[P0.k] || 0) < 2).sort((a, b) => (pr.w[b.k] || 1) - (pr.w[a.k] || 1))[0];
      resp.push({ iso, ok, score: Math.round(score), need: pr.need, why: why.length ? why : ok === 'yes' ? ['пакетът отговаря на интересите им'] : [`искат повече в „${weakest ? weakest.nm : 'гаранциите'}“`] });
    }
    return { cost: pkgCost(pkg), resp, party: c.parties.includes(me()) };
  }
  function proposePkg(ck, pkg) {
    const s = st(), k = s.conf[ck], c = CONFLICTS.find(x => x.k === ck), d = day(), E = evalPkg(ck, pkg);
    if (E.cost > s.res) { deps.toast(`💰 Борис: проверката и фондът струват ${B(E.cost)}, а в резерва има ${B(s.res)}.`, 'bad'); return E; }
    if (E.resp.every(r => r.ok === 'yes')) { s.res -= E.cost; const was = k.step;
      if (k.step < 3 && (pkg.now || 0) >= 1) { k.step = 3; k.stab = 55; k.held = 0; } if (k.step >= 3 && (pkg.ver || 0) >= 1) k.step = Math.max(k.step, 4);
      if (was >= 4 && (pkg.gua || 0) >= 1 && (pkg.next || 0) >= 1) k.step = Math.max(k.step, 5);
      k.ver = Math.max(k.ver || 0, pkg.ver || 0); k.gua = Math.max(k.gua || 0, pkg.gua || 0); k.stab = Math.min(100, k.stab + 10 * (pkg.ver || 0) + 8 * (pkg.gua || 0)); k.int = 0; k.broken = false;
      if (pkg.rec) k.fund = { m: 12, amt: Math.round(free() * PKG[4].cost[pkg.rec]), next: d + 30 };
      for (const i of c.parties) { s.rel[i] = cl(rel(i) + 6); s.tr[i] = cl(trust(i) + 8); }
      if (E.party) s.ind.trust = cl(s.ind.trust - 3 - 3 * (pkg.obl || 0));   // отстъпките струват доверие у дома
      deps.pop && deps.pop('empire', k.step >= 5 ? '📃 Широко споразумение' : '🕊️ Мирният пакет е приет', `${c.nm}: ${PEACE[k.step - 1].nm}. ${k.fund ? `Фондът за възстановяване — по ${B(k.fund.amt)} на месец за 12 месеца; пропусната вноска е нарушено обещание.` : ''}`); log(`${c.nm}: пакетът е приет (${PEACE[k.step - 1].nm}).`);
    } else { k.wait = d + 20; for (const r of E.resp) if (r.ok === 'no') s.tr[r.iso] = cl(trust(r.iso) - 2); log(`${c.nm}: ${E.resp.some(r => r.ok === 'counter') ? 'насрещно предложение' : 'отказ'}.`); }
    levels(); deps.save(); return E;
  }
  // ---- ✅ решение по предложение: 'yes' | 'small' | 'no' | 'later'
  function decide(id, a) {
    const s = st(); if (!s) return null; id = String(id).replace(/\|small$/, ''); const p = proposals().find(q => q.id === id); if (!p) return null; const key = id.split(':').slice(0, 2).join(':'), d = day();
    if (a === 'no' || a === 'later') { s.skip[key] = d + (a === 'no' ? 90 : 30); if (a === 'no' && p.kind === 'aid') { s.stab[p.iso] = cl(stab(p.iso) - 3); log(`Отказана помощ за ${nm(p.iso)} — изпусната възможност.`); } deps.save(); return null; }
    const small = a === 'small' && p.small, cost = small ? p.small.cost : p.cost || 0;
    if (cost > s.res) { deps.toast(`💰 Борис: в резерва има ${B(s.res)} — програмата струва ${B(cost)}. Да започнем по-малък етап или да изчакаме.`, 'bad'); return null; }
    s.res -= cost; s.skip[key] = d + 30; if (!s.cab) s.cab = d;
    if (p.kind === 'dom') { const D = DOM.find(x => x.k === p.k); s.progs.push({ id: ++s.seq, k: p.k, dir: p.dir, nm: D.nm, days: small ? p.small.days : D.days, prog: 0, half: !!small }); log(`Започна „${D.nm}“${small ? ' (първи етап)' : ''}.`); }
    else if (p.kind === 'deal') { if (Math.random() < 0.35 + rel(p.iso) / 120 + s.ind.trust / 600) { s.deals[p.iso] = d; s.rel[p.iso] = cl(rel(p.iso) + 10); deps.toast(`🤝 ${nm(p.iso)} подписа споразумението.`, 'good'); log(`Споразумение с ${nm(p.iso)}.`); } else { s.rel[p.iso] = cl(rel(p.iso) - 2); deps.toast(`✖ ${nm(p.iso)} отказа засега — опитай по-късно.`, 'bad'); } }
    else if (p.kind === 'aid') { s.aid.push({ id: ++s.seq, iso: p.iso, need: p.need, stage: 0, prog: 0, days: Math.round((small ? p.small.days : AID[p.need].days) / AID_STAGES.length), up: AID[p.need].up * K() * (small ? 0.5 : 1), shared: !!small, post: CONFLICTS.some(c => c.region === p.iso && conf(c.k).step >= 3) }); log(`Помощ за ${nm(p.iso)}: ${AID[p.need].nm}.`); }
    else if (p.kind === 'peace') { const c = CONFLICTS.find(x => x.k === p.ck), k = s.conf[c.k];
      if (Math.random() < chance(c)) { k.step++; if (k.step === 3) { k.stab = 65; k.held = 0; } if (k.step >= 4) k.stab = Math.min(100, k.stab + 15); k.int = Math.max(0, k.int - 20); for (const i of c.parties) s.rel[i] = cl(rel(i) + 4);
        if (c.parties.includes(me())) s.ind.trust = cl(s.ind.trust - 4);
        deps.toast(`${PEACE[k.step - 1].ico} ${c.nm}: „${PEACE[k.step - 1].nm}“ — приеха!`, 'good'); if (k.step === 3) deps.pop && deps.pop('empire', '🕊️ Прекратяване на огъня', `${c.nm}: оръжията замлъкват. Сега мирът трябва да се поддържа — доставки, възстановяване и наблюдение.`); log(`${c.nm}: ${PEACE[k.step - 1].nm}.`); }
      else { k.wait = d + 30; for (const i of c.parties) if (i !== me()) s.rel[i] = cl(rel(i) - 2); deps.toast(`✖ ${c.nm}: другите страни отказаха „${PEACE[k.step].nm}“ — нов опит след месец.`, 'bad'); log(`${c.nm}: отказ.`); } }
    else if (p.kind === 'pkgHint') { s.skip[key] = d + 1; deps.save(); tab = 'world'; sel = 'c:' + p.ck; pkgOpen = p.ck; setTimeout(() => { if (!el) open(); else render(); }, 300); return null; }
    else if (p.kind === 'aidfix') { const a = s.aid.find(x => x.id === p.aid); if (a) { const w = a.wait; if (w === 'route') a.route = true; else if (w === 'power') a.power = true; else if (w === 'staff') { a.staff = true; s.stab[a.iso] = cl(stab(a.iso) + 3); } else if (w === 'upkeep') { a.works = true; a.unpaid = 0; (s.met[a.iso] = s.met[a.iso] || {})[a.need] = true; }
      a.wait = null; a.stuck = null; log(`${nm(a.iso)}: ${{ route: 'коридорът за доставката е отворен', power: 'проектът има ток', staff: 'местният персонал е обучен', upkeep: 'издръжката е възстановена' }[w]}.`); } }
    else if (p.kind === 'hold') { const k = s.conf[p.ck]; k.stab = Math.min(100, k.stab + 30); k.warned = false; }
    else if (p.kind === 'coal') { if (Math.random() < 0.5 + rel(p.iso) / 200) { s.coal[p.iso] = d; deps.toast(`🌐 ${nm(p.iso)} се присъедини към коалицията.`, 'good'); log(`${nm(p.iso)} — в коалицията.`); } else deps.toast(`✖ ${nm(p.iso)} още не е готова за коалицията.`, 'bad'); }
    else if (p.kind === 'hz') { const hz = s.hz;
      if (p.act === 'res') { hz.res = Math.max(0, hz.res - 35); s.ind.energy = cl(s.ind.energy + 10); log('Освободени стратегически резерви.'); }
      else if (p.act === 'alt') { hz.alt = d + 60; log('Алтернативни доставки за 60 дни.'); }
      else if (p.act === 'esc') { hz.esc = d + 180; s.tr.IRN = cl(trust('IRN') - 3); log('Мисия за придружаване.'); }
      else if (p.act === 'dip') { const ok = trust('IRN') + Object.keys(s.deals).filter(i => HZ_PARTNERS.includes(i)).length * 6 >= 38 || Math.random() < 0.35;
        if (ok) { hz.talk = (hz.talk || 0) + 1; hz.st = 'talks'; s.tr.IRN = cl(trust('IRN') + 6); deps.toast(`📞 Каналът е отворен (${hz.talk}/2).`, 'good'); log(`Ормуз: дипломатическа стъпка ${hz.talk}.`); }
        else { s.skip[key] = d + 20; deps.toast('✖ Страните още не отговарят — липсва доверие. Споразумения с партньорите в региона помагат.', 'bad'); } }
      else if (p.act === 'deal') { const why = [];   // без произволни откази — само ясни причини
        if (!(hz.esc > d)) why.push('Недостатъчни гаранции — няма мисия за проверка и механизъм срещу инциденти');
        if (Object.keys(s.deals).filter(i => HZ_PARTNERS.includes(i)).length < 2) why.push('Липсва подкрепа от партньор — нужни са споразумения поне с 2 държави от региона и големите вносители');
        if (trust('IRN') < 35) why.push(hz.broken ? 'Нарушено предишно обещание' : 'Недостатъчно доверие към посредника');
        if (why.length) { s.skip[key] = d + 15; deps.pop && deps.pop('ship-cargo', '📃 Насрещно предложение', `Участниците не приемат още: ${why.join('; ')}.`); log('Ормуз: насрещно предложение.'); }
        else { hz.st = 'safe'; hz.agree = d; hz.inc = 0; s.tr.IRN = cl(trust('IRN') + 8); for (const i of HZ_PARTNERS) s.rel[i] = cl(rel(i) + 3); deps.pop && deps.pop('empire', '🌊 Ормузкият проток е отворен', 'Споразумението за безопасно корабоплаване е прието. Наблюдението и механизмът срещу инциденти пазят преминаването.'); log('Ормуз: споразумение — протокът е отворен.'); oilShock(false); } }
      else if (p.act === 'div') { hz.div = { prog: 0, days: small ? 360 : 240 }; log('Енергийна диверсификация.'); }
      else if (p.act === 'inc') { hz.inc = 0; hz.esc = Math.max(hz.esc || 0, d + 90); log('Инцидентът в протока е овладян.'); } }
    else if (p.kind === 'crisis') { s.crisis.acts = { ...(s.crisis.acts || {}), [p.act]: d }; if (Object.keys(s.crisis.acts).length >= 3) { s.crisis.done = d; s.crisisDone = d; deps.pop && deps.pop('empire', '⚡ Изпитанието е преодоляно', 'Договореностите оцеляха. Коалицията стои зад теб.'); log('Голямото изпитание е преодоляно.'); } }
    deps.sound && deps.sound('buy'); levels(); deps.save(); return null;
  }

  // ---- 🗓️ ден
  function dailyTick() {
    const s = st(); if (!s) return; const d = day();
    for (const p of [...s.progs]) { p.prog += 1 / p.days; if (p.prog >= 1) { const D = DOM.find(x => x.k === p.k), k = p.half ? 0.5 : 1;
      for (const [e, v] of Object.entries(D.eff)) if (e === 'rel') for (const i of Object.keys(POL)) s.rel[i] = cl(rel(i) + v * k); else s.ind[e] = cl(s.ind[e] + v * k);
      if (D.rev) s.revK = (s.revK || 0) + D.rev; if (!p.half) { const pr = s.prom.find(x => x.k === p.k); if (pr && !pr.done) { pr.done = d; s.ind.trust = cl(s.ind.trust + 4); deps.toast(`✔ Обещанието „${D.nm}“ е изпълнено.`, 'good'); } }
      (s.doneAt = s.doneAt || {})[p.k] = d; s.progs.splice(s.progs.indexOf(p), 1); deps.toast(`${D.ico} ${NAMES[D.dir]}: „${D.nm}“ е готова.`, 'good'); log(`Готова: ${D.nm}.`); } }
    // помощта — по етапи; в несигурен регион може да спре (министърът казва защо)
    for (const a of s.aid) { if (a.done) continue;
      const war = CONFLICTS.some(c => (c.region === a.iso || c.parties.includes(a.iso)) && s.conf[c.k].step < 3), gulf = ['SAU', 'YEM', 'IRN'].includes(a.iso) && s.hz && (s.hz.st === 'closed' || s.hz.st === 'talks');
      if (!a.wait && a.stage === 1 && !a.route && (war || gulf || stab(a.iso) < 25)) { a.wait = 'route'; a.stuck = gulf ? 'Ормузкият проток е затворен' : 'маршрутът не е безопасен'; deps.toast(`📦 ${nm(a.iso)}: ${a.stuck} — Стефан предлага коридор.`, 'bad'); }
      if (!a.wait && a.stage === 3 && NEEDS_POWER.includes(a.need) && !a.power && !(s.met[a.iso] || {}).energy && stab(a.iso) < 60) { a.wait = 'power'; a.stuck = 'няма ток'; deps.toast(`🏗️ ${nm(a.iso)}: сградата е готова, но няма ток.`, 'bad'); }
      if (!a.wait && a.stage === 3 && !a.staff && a.prog >= 0.5) { a.wait = 'staff'; a.stuck = 'няма местен персонал'; }
      if (a.wait) continue; a.prog += 1 / a.days;
      if (a.prog >= 1) { a.prog = 0; a.stage++; if (a.stage >= AID_STAGES.length) { a.done = d; a.works = true; (s.met[a.iso] = s.met[a.iso] || {})[a.need] = true; s.stab[a.iso] = cl(stab(a.iso) + 15); s.rel[a.iso] = cl(rel(a.iso) + 8);
        deps.toast(`✅ ${nm(a.iso)}: „${AID[a.need].nm}“ работи — ${EFFECT[a.need]}. Сега трябва издръжка.`, 'good'); log(`Помощта за ${nm(a.iso)} работи: ${EFFECT[a.need]}.`); } } }
    // фондовете за възстановяване: месечни вноски; пропусната вноска — нарушено обещание
    for (const c of CONFLICTS) { const k = s.conf[c.k]; if (!k.fund || k.fund.m <= 0 || d < k.fund.next) continue; k.fund.next = d + 30;
      if (s.res >= k.fund.amt) { s.res -= k.fund.amt; k.fund.m--; k.stab = Math.min(100, k.stab + 3); if (!k.fund.m && k.step === 5) { k.step = 6; deps.pop && deps.pop('empire', '🤝 Гаранции и възстановяване', `${c.nm}: фондът е изплатен докрай — мирът има основа.`); log(`${c.nm}: мирният процес е завършен.`); } }
      else { k.broken = true; k.stab = Math.max(0, k.stab - 15); for (const i of c.parties) s.tr[i] = cl(trust(i) - 10); deps.toast(`💔 ${c.nm}: пропусната вноска за възстановяването — нарушено обещание.`, 'bad'); log(`${c.nm}: нарушено обещание.`); } }
    // мирът — примирията отслабват без поддръжка
    for (const c of CONFLICTS) { const k = s.conf[c.k]; if (k.step < 3 || k.step >= 6) continue; k.held++;
      const aidIn = s.aid.some(a => a.done && a.works !== false && c.parties.concat(c.region).includes(a.iso));
      k.stab -= (k.step >= 4 ? 0.06 : 0.16) * (aidIn ? 0.5 : 1) * (1 - 0.2 * (k.ver || 0)) * (1 - 0.15 * (k.gua || 0)) * (s.crisis && !s.crisis.done ? 2 : 1);
      if (k.stab < 40 && !k.warned) { k.warned = true; deps.toast(`⚠️ Примирието в „${c.nm}“ се клати — Ивайло предлага наблюдатели.`, 'bad'); }
      if (k.stab <= 0) { k.step = 1; k.stab = 0; k.int = 70; k.held = 0; k.warned = false; s.ind.trust = cl(s.ind.trust - 6); deps.pop && deps.pop('ship-cargo', '💥 Примирието рухна', `${c.nm}: боевете се подновиха. Нужни са нов контакт и доверие.`); log(`${c.nm}: примирието рухна.`); } }
    // 🌊 Ормузкият проток
    hzTick(s, d);
    // голямото изпитание (след коалицията)
    if (s.lv >= 32 && !s.crisis && !s.crisisDone) { const C = CRISES[Math.floor(Math.random() * CRISES.length)]; s.crisis = { ...C, until: d + 90 }; deps.pop && deps.pop('ship-cargo', `${C.ico} Голямото изпитание`, `${C.nm}: ${C.txt}. Имаш 90 дни: извънреден фонд, мисия и среща на върха.`); }
    if (s.crisis && !s.crisis.done && d > s.crisis.until) { for (const c of CONFLICTS) if (s.conf[c.k].step >= 3) s.conf[c.k].stab = Math.max(0, s.conf[c.k].stab - 30); s.ind.trust = cl(s.ind.trust - 10); s.crisis = null; deps.toast('💥 Кризата не беше овладяна навреме — договореностите пострадаха. Следва ново изпитание.', 'bad'); }
    // месец: бюджет и показатели
    if ((d - s.start) % 30 === 0 && d > s.start) {
      const inc = free() * (1 + (s.ind.econ - 50) / 150 + (s.revK || 0) * 5); let up = 0;
      for (const a of s.aid.filter(x => x.done && x.works !== false)) { if (s.res + inc - up >= a.up) { up += a.up; a.unpaid = 0; } else if ((a.unpaid = (a.unpaid || 0) + 1) >= 2) { a.works = false; a.wait = 'upkeep'; a.stuck = 'издръжката не е платена'; s.stab[a.iso] = cl(stab(a.iso) - 10); if (s.met[a.iso]) delete s.met[a.iso][a.need]; s.tr[a.iso] = cl(trust(a.iso) - 6); deps.toast(`💔 ${nm(a.iso)}: „${AID[a.need].nm}“ спря — неплатена издръжка.`, 'bad'); log(`Помощта за ${nm(a.iso)} угасна.`); } }
      s.res += inc - up; if (s.res < 0) { s.ind.trust = cl(s.ind.trust - 3); s.ind.econ = cl(s.ind.econ - 1); }
      for (const e of ['services', 'energy', 'security']) s.ind[e] = cl(s.ind[e] - 0.8);
      if (s.ind.energy < 40) s.ind.econ = cl(s.ind.econ - 1.5);
      const avg = (s.ind.econ + s.ind.services + s.ind.energy + s.ind.security) / 4; s.ind.trust = cl(s.ind.trust + (avg - 58) / 8);
      for (const iso of Object.keys(s.stab)) if (!s.aid.some(a => a.iso === iso && a.done)) s.stab[iso] = cl(s.stab[iso] - 0.5);
    }
    s.streak = Object.values(s.ind).every(v => v >= 60) && s.res >= 0 ? (s.streak || 0) + 1 : 0;
    const allPeace = CONFLICTS.every(c => s.conf[c.k].step >= 5), coal = Object.keys(s.coal).length >= 5;
    s.world = allPeace && coal && s.streak > 0 && s.crisisDone && s.hz?.st === 'safe' ? (s.world || 0) + 1 : 0;
    levels();
  }
  // 🛢️ петролът в играта (oil.js) реагира на протока — и фирмата го усеща
  function oilShock(on) { const o = deps.S().oil; if (!o) return; if (on) o.ev = { k: 'hormuz', nm: 'Ормузкият проток е затворен', ico: '⛔', mul: 1.6, fuel: 1.3, until: day() + 9999 }; else if (o.ev && o.ev.k === 'hormuz') o.ev.until = day(); }
  function hzTick(s, d) {
    const hz = s.hz = s.hz || { st: 'calm', ship: 100, res: 100, talk: 0 };
    if (hz.div && !hz.div.done) { hz.div.prog += 1 / hz.div.days; if (hz.div.prog >= 1) { hz.div.done = d; s.ind.energy = cl(s.ind.energy + 8); deps.toast('⚡ Вера: диверсификацията е готова — следващо спиране ще удари наполовина.', 'good'); } }
    if (hz.st === 'calm' && d >= s.start + HZ_START) {   // кризата идва — извънредно заседание
      hz.st = 'closed'; hz.since = d; hz.ship = 20; oilShock(true); log('Ормузкият проток е затворен.');
      deps.pop && deps.pop('ship-cargo', '⛔ Извънредно заседание', '„Корабоплаването в Ормузкия проток е прекъснато. Част от енергийните доставки са забавени. Транспортните разходи растат, а партньорите искат общ отговор.“');
      deps.pause && deps.pause(); setTimeout(() => cabinet(true), 1200); return;
    }
    if (hz.st === 'closed' || hz.st === 'talks') { const k = (hz.alt > d ? 0.5 : 1) * (hz.div?.done ? 0.5 : 1);
      s.ind.energy = cl(s.ind.energy - 0.22 * k); s.ind.econ = cl(s.ind.econ - 0.08 * k); if ((d - hz.since) % 30 === 0) { s.res -= free() * 0.15 * k; log('Ормуз: по-скъп транспорт и гориво.'); } }
    if (hz.st === 'safe') { hz.ship = Math.min(100, hz.ship + 2.5);
      if (!(hz.esc > d) && !hz.inc && Math.random() < 1 / 240) { hz.inc = d; hz.ship = 60; deps.toast('⚠️ Инцидент в протока — без механизъм за проверка напрежението расте.', 'bad'); }
      if (hz.inc && d - hz.inc > 45) { hz.st = 'closed'; hz.since = d; hz.ship = 20; hz.talk = 1; hz.broken = true; hz.inc = 0; oilShock(true); deps.pop && deps.pop('ship-cargo', '⛔ Протокът отново е затворен', 'Инцидентът остана без отговор. Нужни са гаранции и нов кръг преговори.'); log('Ормуз: протокът е затворен отново.'); } }
  }
  // ---- 🏅 нивата 27–35 (по постижения)
  const MEETS = {
    27: s => !!s.cab && s.prom.filter(p => p.done).length >= 2,
    28: s => s.streak >= 90,
    29: s => Object.keys(s.deals).length >= 1 && s.aid.some(a => a.done && a.works !== false),
    30: s => CONFLICTS.some(c => s.conf[c.k].step >= 3 && s.conf[c.k].held >= 60),
    31: s => s.aid.some(a => a.done && a.works !== false && (a.post || a.need === 'rebuild')),   // работеща програма за възстановяване
    32: s => Object.keys(s.coal).length >= 5,
    33: s => !!s.crisisDone,
    34: s => CONFLICTS.every(c => s.conf[c.k].step >= 5),
    35: s => s.world >= 360,
  };
  function levels() { const s = st(); if (!s) return; for (let l = (s.lv || 26) + 1; l <= 35; l++) { if (!MEETS[l](s)) break; s.lv = l; log(`Ниво ${l}.`); } if (s.lv >= 35 && !s.finale) { s.finale = day(); deps.save(); setTimeout(finale, 6500); } }   // 🏁 ниво 35 — краят на играта (след картинката на нивото)
  const level = () => st()?.lv || 0;

  // ---- 🏁 финалът: ниво 35 „Световен мир“ — играта е завършена (може да продължиш да играеш)
  function finale() {
    const s = st(); if (!s) return; const S = deps.S(), ended = CONFLICTS.filter(c => s.conf[c.k].step >= 5).length, aid = s.aid.filter(a => a.done).length;
    const who = [['🏛️', 'Десислава Илиева', 'министър-председател'], ['💰', 'Борис Тодоров', 'финанси'], ['🏘️', 'Георги Николов', 'регионално развитие'], ['🛡️', 'Ивайло Петров', 'отбрана'], ['🛣️', 'Надя Иванова', 'пътища'], ['🚆', 'Мария Стоянова', 'железници'], ['⚓', 'Стефан Колев', 'морско дело'], ['✈️', 'Елена Димитрова', 'международни връзки'], ['⚡', 'Вера Ангелова', 'енергетика']];
    const el2 = document.createElement('div'); el2.id = 'presEnd';
    el2.style.cssText = 'position:fixed;inset:0;z-index:9800;background:radial-gradient(circle at 50% 30%,#1b2b4a,#05080f);color:#f3e7c4;font:500 15px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow:auto;padding:24px 16px;text-align:center';
    el2.innerHTML = `<img src="assets/ui/levels/lv35.webp" alt="" onerror="this.remove()" style="width:min(340px,70vw);margin:0 0 8px"><div style="font-size:15px;letter-spacing:.3em;color:#ffd54a">🏁 КРАЙ НА ИГРАТА</div><h1 style="margin:6px 0 4px;font-size:34px;color:#ffd54a">🌍 Световен мир</h1>
      <div style="max-width:620px;margin:0 0 14px">От малка строителна фирма в ${S.cityId ? 'България' : 'града си'} до световна империя, твой град от нулата и президентството на ${s.cc === 'RU' ? 'Русия' : 'САЩ'}. Конфликтите са прекратени, засегнатите региони имат основни услуги, а коалицията пази мира. <b>${deps.brand()}</b> влиза в историята.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:0 0 16px">${[[`${S.day}`, 'игрови дни'], [`${S.day - s.start}`, 'дни като президент'], [`${ended}/${CONFLICTS.length}`, 'прекратени конфликта'], [`${aid}`, 'проекта за помощ'], [`${Object.keys(s.coal).length}`, 'държави в коалицията'], [`${Object.keys(s.deals).length}`, 'споразумения']].map(([v, l]) => `<div style="background:rgba(255,213,74,.08);border:1px solid rgba(255,213,74,.35);border-radius:12px;padding:8px 14px"><b style="font-size:22px;color:#fff">${v}</b><div style="font-size:12px;opacity:.8">${l}</div></div>`).join('')}</div>
      <div style="opacity:.85;margin:0 0 6px">Кабинетът, който го постигна:</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 16px;max-width:680px;width:100%;margin:0 0 18px">${who.map(([i, n, r]) => `<div>${i} <b>${n}</b> · <span style="opacity:.75">${r}</span></div>`).join('')}</div>
      <div style="opacity:.7;font-size:13px;margin:0 0 16px">Благодарим, че игра „Строителна империя“!</div>
      <button data-endok="1" style="background:#ffd54a;color:#111;border:0;border-radius:10px;padding:10px 20px;font:700 15px system-ui;cursor:pointer">▶ Продължи да играеш</button>`;
    document.body.appendChild(el2); window.__overlay3d = (window.__overlay3d || 0) + 1; deps.sound && deps.sound('levelup');
    el2.querySelector('[data-endok]').onclick = () => { el2.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); };
  }
  // ---- 🪟 екранът на президента: Държава · Свят · Министерски съвет
  let el = null, tab = 'state', sel = null, pkgOpen = null, pkgSel = {};
  const css = `#pres { position:fixed; inset:0; z-index:9780; background:#0b1220; color:#e6edf6; font:500 14px/1.45 system-ui, sans-serif; display:flex; flex-direction:column; }
#pres .tb { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #22304a; flex-wrap:wrap; } #pres h2 { margin:0 auto 0 0; font-size:18px; }
#pres .bd { flex:1; overflow:auto; padding:12px 14px; display:flex; gap:12px; flex-wrap:wrap; align-content:flex-start; } #pres .cd { background:#131d30; border:1px solid #22304a; border-radius:12px; padding:10px 12px; flex:1 1 320px; }
#pres .bar { height:7px; background:#22304a; border-radius:4px; overflow:hidden; margin:3px 0 6px; } #pres .bar i { display:block; height:100%; }
#pres button { background:#1d2a42; color:#e6edf6; border:1px solid #2d3f60; border-radius:9px; padding:6px 10px; cursor:pointer; font:inherit; } #pres button.on, #pres button.y { background:#ffd54a; color:#111; border-color:#ffd54a; }
#pres .m { color:#9fb0c8; font-size:13px; } #pres .map { flex:2 1 560px; }`;
  function open() {
    if (!st()) return; if (!document.getElementById('presCss')) { const c = document.createElement('style'); c.id = 'presCss'; c.textContent = css; document.head.appendChild(c); }
    if (el) el.remove(); el = document.createElement('div'); el.id = 'pres'; document.body.appendChild(el); window.__overlay3d = (window.__overlay3d || 0) + 1; render();
  }
  function close() { if (!el) return; el.remove(); el = null; window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); }
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(v)}%;background:${col || (v >= 60 ? '#3fae6b' : v >= 40 ? '#ffd54a' : '#ff6b6b')}"></i></div>`;
  async function render() {
    if (!el) return; const s = st(), flag = s.cc === 'RU' ? '🇷🇺' : '🇺🇸', ps = proposals();
    let h = `<div class="tb"><h2>${flag} Президентът · ${s.cc === 'RU' ? 'Кремъл' : 'Белият дом'} <span class="m">ниво ${s.lv}</span></h2>${[['state', '🏛️ Държава'], ['world', '🌍 Свят']].map(([k, t]) => `<button data-pt="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}<button data-pcab="1" class="y">📋 Министерски съвет (${ps.length})</button>${s.finale ? '<button data-pend="1">🏁 Финалът</button>' : ''}<button data-px="1">✕</button></div><div class="bd">`;
    if (tab === 'state') {
      h += `<div class="cd"><b>📊 Държавата</b>${Object.entries(IND).map(([k, [i, n]]) => `<div class="m">${i} ${n}: <b style="color:#e6edf6">${Math.round(s.ind[k])}</b></div>${bar(s.ind[k])}`).join('')}<div class="m">⚖️ Стабилна държава: всичко ≥ 60 и резерв ≥ 0 — ${s.streak}/90 дни</div></div>`;
      h += `<div class="cd"><b>💰 Държавният бюджет</b> <span class="m">(отделен от холдинга)</span><div class="m" style="margin-top:6px">Резерв: <b style="color:${s.res >= 0 ? '#7dffa8' : '#ff8a8a'}">${B(s.res)}</b></div><div class="m">Свободни за нови програми на месец: <b style="color:#e6edf6">${B(free())}</b></div><div class="m">Издръжка на помощта: ${B(s.aid.filter(a => a.done).reduce((x, a) => x + a.up, 0))}/месец</div></div>`;
      h += `<div class="cd"><b>📜 Предизборните обещания</b>${s.prom.map(p => { const D = DOM.find(x => x.k === p.k), run = s.progs.find(x => x.k === p.k); return `<div class="m">${p.done ? '✅' : run ? `⏳ ${Math.round(run.prog * 100)}%` : '⬜'} ${D.ico} ${D.nm}</div>`; }).join('')}</div>`;
      h += `<div class="cd"><b>🏗️ Програми в ход</b>${s.progs.length ? s.progs.map(p => `<div class="m">${DOM.find(x => x.k === p.k).ico} ${p.nm}${p.half ? ' (първи етап)' : ''} — ${NAMES[p.dir]}</div>${bar(p.prog * 100, '#4fc3f7')}`).join('') : '<div class="m">Няма — министрите чакат решенията ти в Министерския съвет.</div>'}</div>`;
      { const hz = s.hz || {}, lbl = { calm: '🟢 спокойно', closed: '⛔ затворен', talks: '📞 преговори', safe: '🌊 отворен' }[hz.st] || '';
        h += `<div class="cd"><b>🌊 Ормузкият проток</b> <span class="m">· алтернативна игрова хронология</span><div class="m" style="margin-top:6px">Статус: <b style="color:#e6edf6">${lbl}</b>${hz.inc ? ' · ⚠️ инцидент' : ''}</div><div class="m">Корабоплаване: ${Math.round(hz.ship ?? 100)}%</div>${bar(hz.ship ?? 100, '#4fc3f7')}<div class="m">Стратегически резерв: ${Math.round(hz.res ?? 100)}%</div>${bar(hz.res ?? 100, '#ffd54a')}<div class="m">${hz.alt > day() ? '🚢 алтернативни доставки · ' : ''}${hz.esc > day() ? '🛡️ придружаване и проверка · ' : ''}${hz.div ? (hz.div.done ? '⚡ диверсификация ✅' : `⚡ диверсификация ${Math.round(hz.div.prog * 100)}%`) : ''}</div>${hz.st === 'talks' || hz.st === 'closed' ? `<div class="m">Преговори: ${hz.talk || 0}/2 · доверие на страните към теб: ${Math.round(trust('IRN'))}</div>` : ''}</div>`; }
      { const C = [['Няма активни големи въоръжени конфликти', CONFLICTS.every(c => s.conf[c.k].step >= 3)], ['Мирните договорености се изпълняват и наблюдават', CONFLICTS.every(c => s.conf[c.k].step >= 5)], ['Критичните търговски маршрути функционират', s.hz?.st === 'safe'], ['Коалицията изпълнява задълженията си (5+ държави)', Object.keys(s.coal).length >= 5], ['Голямото изпитание е преодоляно', !!s.crisisDone], ['Собствената държава е стабилна', s.streak > 0]];
        h += `<div class="cd"><b>🌍 Световен мир — условията</b>${C.map(([t, ok]) => `<div class="m">${ok ? '✅' : '⬜'} ${t}</div>`).join('')}<div class="m" style="margin-top:4px">Задържани ${s.world || 0}/360 дни</div></div>`; }
      h += `<div class="cd"><b>📰 Хроника</b>${(s.log || []).slice(0, 8).map(x => `<div class="m">ден ${x.d}: ${x.t}</div>`).join('')}</div>`;
    } else {
      const svg = await mapSvg({ cc: s.cc, rel, conf, sel, deal: i => !!s.deals[i], aid: i => s.aid.filter(a => a.iso === i) });
      h += `<div class="cd map">${svg}<div class="m" style="margin-top:6px">🟩 приятелски · ⬜ неутрални · 🟥 враждебни · ⚔️ конфликт · 🕊️ примирие · 🤝 споразумение · 📦 помощ</div></div><div class="cd">${sideHtml()}</div>`;
    }
    el.innerHTML = h + '</div>';
    el.querySelector('[data-px]').onclick = close;
    el.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { tab = b.dataset.pt; render(); });
    el.querySelector('[data-pcab]').onclick = cabinet; el.querySelectorAll('[data-pend]').forEach(b => b.onclick = finale);
    el.querySelectorAll('[data-pol]').forEach(g => g.onclick = () => { sel = g.dataset.pol; render(); });
    el.querySelectorAll('[data-conf]').forEach(g => g.onclick = () => { sel = 'c:' + g.dataset.conf; render(); });
    el.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { const [id, a] = b.dataset.pd.split('|'); decide(id, a); render(); });
    el.querySelectorAll('[data-pkgo]').forEach(b => b.onclick = () => { pkgOpen = b.dataset.pkgo; pkgSel = {}; render(); });
    el.querySelectorAll('[data-pk]').forEach(x => x.onchange = () => { pkgSel[x.dataset.pk] = +x.value; render(); });
    el.querySelectorAll('[data-pkx]').forEach(b => b.onclick = () => { pkgOpen = null; render(); });
    el.querySelectorAll('[data-pksend]').forEach(b => b.onclick = () => { const E = proposePkg(b.dataset.pksend, pkgSel); if (E.resp.every(r => r.ok === 'yes')) pkgOpen = null; else deps.toast(E.resp.map(r => `${nm(r.iso)}: ${r.ok === 'counter' ? 'насрещно предложение' : 'отказ'} — ${r.why[0]}`).join(' · '), 'bad'); render(); });
  }
  function pkgHtml(ck) {
    const E = evalPkg(ck, pkgSel), col = { yes: '#7dffa8', counter: '#ffd54a', no: '#ff8a8a' }, lbl = { yes: '✔ приема', counter: '↩ насрещно предложение', no: '✖ отказва' };
    return `<div style="margin-top:8px;border-top:1px solid #22304a;padding-top:8px"><b>📝 Мирен пакет</b>${PKG.map(P0 => `<div class="m" style="margin:6px 0 2px">${P0.nm}</div><select data-pk="${P0.k}" style="width:100%;background:#1d2a42;color:#e6edf6;border:1px solid #2d3f60;border-radius:8px;padding:4px">${P0.opt.map((o, i) => `<option value="${i}" ${(pkgSel[P0.k] || 0) === i ? 'selected' : ''}>${o}${P0.cost && P0.cost[i] ? ` · ${B(free() * P0.cost[i])}${P0.k === 'rec' ? '/месец' : ''}` : ''}</option>`).join('')}</select>`).join('')}
      <div class="m" style="margin-top:8px">Цена сега: <b style="color:#e6edf6">${B(E.cost)}</b>${E.party ? ' · отстъпките струват доверие у дома' : ''}</div>${E.resp.map(r => `<div class="m" style="margin:3px 0"><b style="color:${col[r.ok]}">${nm(r.iso)}: ${lbl[r.ok]}</b> — ${r.why.join('; ')}</div>`).join('')}
      <div style="display:flex;gap:6px;margin-top:8px"><button class="y" data-pksend="${ck}">📨 Предложи пакета</button><button data-pkx="1">Затвори</button></div></div>`;
  }
  function sideHtml() {
    const s = st(), ps = proposals();
    const btns = p => `<div class="m" style="margin:6px 0 2px;color:#e6edf6">${p.ico} ${p.text}</div><div class="m">${p.why}${p.cost ? ` · ${B(p.cost)}` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px"><button class="y" data-pd="${p.id}|yes">✓ Да</button>${p.small ? `<button data-pd="${p.id}|small">½ ${B(p.small.cost)}</button>` : ''}<button data-pd="${p.id}|later">⏳</button><button data-pd="${p.id}|no">✖</button></div>`;
    if (sel && sel.startsWith('c:')) { const c = CONFLICTS.find(x => x.k === sel.slice(2)), k = conf(c.k);
      return `<b>${c.ico} ${c.nm}</b>${c.note ? `<div class="m">ℹ️ ${c.note}</div>` : ''}<div class="m">Страни: ${c.parties.map(nm).join(', ')}</div><div class="m">Интензитет: ${Math.round(k.int)}</div>${PEACE.map((p, i) => `<div class="m">${i < k.step ? '✅' : i === k.step ? '➡️' : '⬜'} ${p.ico} ${p.nm}</div>`).join('')}${k.step >= 3 ? `<div class="m" style="margin-top:4px">Стабилност на примирието: ${Math.round(k.stab)}${k.ver ? ' · 🔍 наблюдение' : ''}${k.gua ? ' · 🛡️ гаранции' : ''}${k.fund ? ` · 💶 фонд ${12 - k.fund.m}/12` : ''}${k.broken ? ' · 💔 нарушено обещание' : ''}</div>${bar(k.stab)}` : ''}${pkgOpen === c.k ? pkgHtml(c.k) : ps.filter(p => p.ck === c.k).map(btns).join('') + (k.step >= 2 && k.step < 5 && k.step !== 3 && !(k.wait > day()) ? `<button class="y" data-pkgo="${c.k}" style="margin-top:6px">📝 Състави мирен пакет</button>` : k.wait > day() ? `<div class="m">Следващ опит след ден ${k.wait}.</div>` : '')}`; }
    if (sel && POL[sel]) { const c = POL[sel], cf = CONFLICTS.filter(x => x.parties.includes(sel) || x.region === sel);
      return `<b>${c.nm}</b> <span class="m">· столица ${c.cap}</span><div class="m" style="margin-top:6px">🤝 Отношения с теб: ${Math.round(rel(sel))}</div>${bar(rel(sel))}<div class="m">🏛️ Стабилност: ${Math.round(stab(sel))}</div>${bar(stab(sel))}
        <div class="m">Нужди: ${(c.need || []).map(n => `${NEED[n][0]} ${NEED[n][1]}${(s.met[sel] || {})[n] ? ' ✅' : ''}`).join(', ') || 'няма спешни'}</div><div class="m">Конфликти: ${cf.map(x => x.nm).join(', ') || 'няма'}</div><div class="m">Споразумение: ${s.deals[sel] ? `✅ от ден ${s.deals[sel]}` : 'няма'}${s.coal[sel] ? ' · 🌐 в коалицията' : ''}</div>
        ${s.aid.filter(a => a.iso === sel).map(a => `<div class="m" style="margin-top:4px">📦 <b style="color:#e6edf6">${AID[a.need].nm}</b>: ${a.done && a.works !== false ? `✅ работи — ${EFFECT[a.need]}` : a.stuck ? `⛔ ${a.stuck}` : `${AID_STAGES[a.stage][1]} ${Math.round(a.prog * 100)}%`}</div><div class="m" style="font-size:12px">${a.route || a.stage > 1 ? '✅' : '⬜'} доставка · ${a.stage > 2 ? '✅' : '⬜'} строеж · ${!NEEDS_POWER.includes(a.need) || a.power || (s.met[a.iso] || {}).energy || a.done ? '✅' : '⬜'} ток · ${a.staff || a.done ? '✅' : '⬜'} персонал · ${a.done ? (a.works !== false ? '✅' : '💔') : '⬜'} издръжка ${B(a.up)}/мес.</div>`).join('')}${ps.filter(p => p.iso === sel).map(btns).join('')}`; }
    return `<b>🌍 Светът</b><div class="m">Избери държава или конфликт на картата.</div>${CONFLICTS.map(c => { const k = conf(c.k); return `<div class="m">${k.step >= 3 ? '🕊️' : c.ico} ${c.nm}: ${k.step ? PEACE[k.step - 1].nm : 'боеве'}</div>`; }).join('')}<div class="m" style="margin-top:6px">🌐 Коалиция: ${Object.keys(s.coal).length} държави · 🤝 споразумения: ${Object.keys(s.deals).length}</div>`;
  }
  // 📰 Десислава представя най-важните събития (отчетът в началото на заседанието)
  function briefing() {
    const s = st(); if (!s) return ''; const hz = s.hz || {}, ev = [];
    if (hz.st === 'closed' || hz.st === 'talks') ev.push(`⛔ Ормузкият проток е ${hz.st === 'talks' ? 'в преговори' : 'затворен'} — корабоплаване ${Math.round(hz.ship)}%, резерв ${Math.round(hz.res)}%.`);
    if (hz.inc) ev.push('⚠️ Инцидент в протока — нужен е отговор.');
    for (const c of CONFLICTS) { const k = s.conf[c.k]; if (k.step >= 3 && k.stab < 45) ev.push(`🕊️ Примирието в „${c.nm}“ се клати (${Math.round(k.stab)}).`); }
    if (s.crisis && !s.crisis.done) ev.push(`${s.crisis.ico} ${s.crisis.nm} — остават ${s.crisis.until - day()} дни.`);
    const lowI = Object.entries(s.ind).filter(([, v]) => v < 45).map(([k]) => IND[k][1]); if (lowI.length) ev.push(`📉 Слаби показатели: ${lowI.join(', ')}.`);
    const stuck = s.aid.filter(a => a.wait); if (stuck.length) ev.push(`📦 Помощ, която чака: ${stuck.map(a => `${nm(a.iso)} (${a.stuck})`).join(', ')}.`);
    return `<div class="card"><h3 style="margin:0 0 6px">🏛️ Десислава: най-важното този месец</h3>${ev.length ? ev.map(t => `<div class="meta" style="margin:2px 0">${t}</div>`).join('') : '<div class="meta" style="margin:0">Спокоен месец — можем да мислим за дългосрочните програми.</div>'}</div>`;
  }
  // 🗳️ съвещателният вот на министрите: всеки гласува по своя ресор и казва защо (последната дума е на президента)
  const WHY = { fin: 'финансирането е в рамката', reg: 'регионите ще усетят разликата', def: 'сигурността не страда', roads: 'пътищата ще го обслужат', rail: 'жп мрежата ще помогне', sea: 'доставките са осигурени', air: 'партньорите ще го оценят', energy: 'енергията стига', pm: 'вписва се в програмата на кабинета' };
  function vote(id) {
    const s = st(), p = proposals().find(q => q.id === id); if (!p) return null; const votes = [];
    for (const d of Object.keys(NAMES)) { let yes = true, cond = false, why = d === p.dir ? (p.why || 'моето предложение') : WHY[d];
      if (d === 'fin' && (p.cost || 0) > s.res * 0.5) { yes = false; why = `изяжда ${Math.round((p.cost || 0) / Math.max(1, s.res) * 100)}% от резерва — предлагам по-малък етап`; }
      else if (d === 'reg' && p.kind === 'aid' && s.ind.services < 50) { yes = false; why = 'нашите болници и жилища още изостават'; }
      else if (d === 'def' && p.kind === 'peace' && s.ind.security < 45) { cond = true; why = 'за, ако първо укрепим собствената си сигурност'; }
      else if (d === 'pm' && p.kind === 'peace') why = 'мирът е целта на кабинета';
      else if (d === 'air' && p.kind === 'aid') why = 'партньорите са готови да поемат част от помощта';
      votes.push({ dir: d, name: NAMES[d], yes, cond, why }); }
    const yes = votes.filter(v => v.yes).length, no = votes.length - yes;
    return { p, v: { votes, yes, no, passed: yes >= no, bank: { ok: (p.cost || 0) <= s.res * 0.5, why: 'резервът ще падне под половината' } } };
  }
  // 📋 Министерският съвет в 3D (directors3d.js openCabinet) — бюджетът от Борис, после министрите
  function cabinet(emergency) {
    const s = st(); import('./directors3d.js').then(m => { if (!m.openCabinet) return;
      const pick = () => { const all = proposals(), em = all.filter(p => p.emergency || p.kind === 'crisis' || p.kind === 'hold'); return emergency ? em : [...em, ...all.filter(p => !em.includes(p)).slice(0, 3)]; };   // министрите — до 3 основни решения
      const brief = { id: `fin:brief:${day()}`, dir: 'fin', ico: '💰', info: true, text: '' };
      m.openCabinet({ cc: s.cc, title: s.cc === 'RU' ? 'Правителството' : 'The Cabinet', brand: { nm: s.cc === 'RU' ? 'Россия' : 'USA', col: s.cc === 'RU' ? '#d52b1e' : '#3c3b6e', ico: '🦅', group: s.cc === 'RU' ? 'Правителство' : 'Белият дом', sub: '· МИНИСТЕРСКИ СЪВЕТ ·' },
        title: emergency ? '⛔ Извънредно заседание' : undefined, report: () => briefing(), proposals: () => [brief, ...pick().map(p => ({ ...p, text: p.text.replace(/^[А-ЯЁ][а-яё]+: /, ''), inBudget: (p.cost || 0) <= s.res }))],   // името на министъра вече е горе на екрана onDecide: (id, a) => { decide(id, a); render(); return null; },
        voteOn: id => vote(id), onResolve: (id, how) => { decide(id.replace(/\|small$/, ''), how === 'drop' ? 'later' : how === 'small' ? 'small' : 'yes'); render(); return null; },
        speech: () => `Резервът е ${B(s.res)}. За нови програми имаме по ${B(free())} на месец. ${s.res < free() ? 'Предлагам по-малки първи етапи.' : 'Можем да започнем една голяма и няколко малки програми.'}`,
        frame: () => ({ cash: Math.max(0, s.res), reserved: 0, op: 0, free: Math.max(0, s.res), loan: 0 }),
        summary: () => `Кабинетът продължава. Стабилност ${Math.round(Object.values(s.ind).reduce((a, v) => a + v, 0) / 5)}/100, резерв ${B(s.res)}.`,
        brief: k => ({ fin: `Резервът е ${B(s.res)}.`, pm: `Обещания: ${s.prom.filter(p => p.done).length}/${s.prom.length}. Ниво ${s.lv}.`, def: `Сигурност ${Math.round(s.ind.security)}/100.`, energy: `Енергия ${Math.round(s.ind.energy)}/100.`, reg: `Услуги ${Math.round(s.ind.services)}/100.` })[k] || '' });
    }); }
  return { evalPkg, proposePkg, briefing, trust, finale, vote, start, state: st, proposals, decide, dailyTick, level, open, close, cabinet, active: () => !!st() };
}
