import { wonCountries } from './countries.js';
// questsx.js — още глави куести за късната игра: Европа, аутобани, море и курорти, финанси, световна империя.
// quests.js ги добавя след своите глави. Освен стандартните помощници (c.owns, c.rail, c.branches…)
// целите ползват c.S() (състоянието) и c.econ() (икономиката).
const M = n => n;
const EU_CAPS = ['paris', 'london', 'berlin', 'madrid', 'rome', 'vienna', 'amsterdam', 'prague', 'budapest', 'warsaw', 'brussels'];
const WORLD = ['newyork', 'losangeles', 'chicago', 'toronto', 'mexicocity', 'rio', 'saopaulo', 'buenosaires', 'cairo', 'capetown', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'tokyo', 'seoul', 'beijing', 'sydney'];
const SEA = ['varna', 'burgas', 'constanta', 'istanbul', 'thessaloniki', 'athens', 'barcelona', 'amsterdam', 'rotterdam', 'newyork', 'losangeles', 'rio', 'buenosaires', 'capetown', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'tokyo', 'sydney'];
const owned = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const finished = c => Object.keys((c.econ().s.finished) || {});
// 🤝 coop-countries: при общо завладяна държава наградата е само за единия партньор (game.js moneyDone); без флага — моите завършени
const wonDone = c => (c.wonDone && c.wonDone()) || (id => finished(c).includes(id));
const abDone = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:')).length;
const ab = (c, a, b) => c.hwHas ? c.hwHas(`ab:${[a, b].sort().join('-')}`) : (c.S().hwDone || []).includes(`ab:${[a, b].sort().join('-')}`);
const resortsAt = (c, stage) => Object.values(c.S().resorts || {}).filter(r => r && (Array.isArray(stage) ? stage.includes(r.stage) : r.stage === stage)).length;
const resortExt = c => Object.values(c.S().resorts || {}).reduce((a, r) => a + Object.keys((r && r.ext) || {}).length, 0);

// 🏛️ бордът на директорите (ерата на холдинга, ниво 15): дружествата (S.group), нивата им и директорите (S.hold.lv / dir),
// решенията на борда (S.hold.commits — изпълнени, навреме), гласуванията, автопилотът и доверието (boardlogic.js)
const BOARD_SUBS = ['con', 'hw', 'rail', 'sea', 'air', 'hotel', 'oil', 'bank'];
const hold = c => c.S().hold || {};
const subsN = c => BOARD_SUBS.filter(k => (c.S().group || {})[k]).length;
const dirN = c => BOARD_SUBS.filter(k => (hold(c).dir || {})[k]).length;
const lvN = (c, lv) => Object.values(hold(c).lv || {}).filter(n => n >= lv).length;
const doneN = (c, onTime = false) => (hold(c).commits || []).filter(x => x.st === 'done' && (!onTime || !x.late)).length;
export const BOARD_CHAPTER = { id: 'c13', nm: 'Бордът на директорите', ico: '🏛️', openIf: c => c.devBest() >= 15, lockTxt: 'Отключва се на ниво 15 — ерата на холдинга.', quests: [
  { id: 'b_board', ico: '🏛️', nm: 'Бордът на директорите', ds: 'Основи всички 8 дъщерни дружества: Констръкшън, Толроуд, Рейл, Оушън Експрес, Флайеър, Хотелс, Петролиум и Банк.', goal: c => [subsN(c), 8], money: M(50000000) },
  { id: 'b_dir1', ico: '👔', nm: 'Първият директор', ds: 'Назначи директор на дъщерно дружество.', goal: c => [dirN(c), 1], money: M(20000000) },
  { id: 'b_vote', ico: '🗳️', nm: 'Бордът гласува', ds: 'Проведи гласуване на борда за предложение, срещу което банката възразява.', goal: c => [(hold(c).votes || []).length, 1], money: M(20000000) },
  { id: 'b_dec1', ico: '✅', nm: 'Първото решение', ds: 'Одобри предложение на директор и го доведи до изпълнение.', goal: c => [doneN(c), 1], money: M(25000000) },
  { id: 'b_dir4', ico: '🤝', nm: 'Управителен съвет', ds: 'Имай 4 назначени директори.', goal: c => [dirN(c), 4], money: M(60000000) },
  { id: 'b_lv3', ico: '⬆️', nm: 'Развито дружество', ds: 'Развий дъщерно дружество до ниво 3.', goal: c => [lvN(c, 3), 1], money: M(30000000) },
  { id: 'b_auto', ico: '🤖', nm: 'Автопилот', ds: 'Включи автопилот за поне един директор (таван за решения без теб).', goal: c => [Object.values(hold(c).auto || {}).filter(v => v > 0).length, 1], money: M(30000000) },
  { id: 'b_ontime5', ico: '📈', nm: 'Навреме', ds: 'Изпълни 5 решения на борда без закъснение.', goal: c => [doneN(c, true), 5], money: M(80000000) },
  { id: 'b_lv5', ico: '🏅', nm: 'Водещо дружество', ds: 'Развий дъщерно дружество до ниво 5 (най-високото).', goal: c => [lvN(c, 5), 1], money: M(80000000) },
  { id: 'b_trust', ico: '💼', nm: 'Доверен директор', ds: 'Доверието към някой директор да стигне 120% (решения, изпълнени навреме).', goal: c => [Math.round(100 * Math.max(1, ...Object.values(hold(c).trust || {}))), 120], money: M(60000000) },
  { id: 'b_dec10', ico: '📋', nm: 'Десет изпълнени решения', ds: 'Доведи до изпълнение 10 решения на борда.', goal: c => [doneN(c), 10], money: M(100000000) },
  { id: 'b_dirall', ico: '👥', nm: 'Пълен борд', ds: 'Назначи директор на всички 8 дъщерни дружества.', goal: c => [dirN(c), 8], money: M(150000000) },
  { id: 'b_lv5x4', ico: '🏆', nm: 'Холдинг от първа класа', ds: 'Развий 4 дъщерни дружества до ниво 5.', goal: c => [lvN(c, 5), 4], money: M(200000000) },
  { id: 'b_glob', ico: '🌍', nm: 'Глобъл', ds: 'Основи Глобъл Ризортс & Констръкшън (ниво 20 — Световна империя).', goal: c => [(c.S().group || {}).glob ? 1 : 0, 1], money: M(200000000) },
  { id: 'b_globdir', ico: '🌐', nm: 'Директор на Глобъл', ds: 'Назначи директор на Глобъл — мегапроекти, концесии и придобивания.', goal: c => [(hold(c).dir || {}).glob ? 1 : 0, 1], money: M(250000000) },
] };
export const EXTRA_CHAPTERS = [
  { id: 'c8', nm: 'Европа', ico: '🇪🇺', pic: 'unlock-europe', picTxt: 'Европейските столици чакат „Строителна империя“.', quests: [
    { id: 'e_br1', ico: '✈️', nm: 'Към Европа', ds: 'Отвори филиал в европейски град.', goal: c => [owned(c).filter(id => EU_CAPS.includes(id) || ['hague', 'rotterdam', 'luxembourg', 'milan', 'barcelona', 'zurich', 'munich'].includes(id)).length, 1], money: M(2000000) },
    { id: 'e_paris', ico: '🗼', nm: 'Париж', ds: 'Отвори филиал в Париж.', goal: c => [c.owns('paris') ? 1 : 0, 1], money: M(3000000) },
    { id: 'e_london', ico: '🎡', nm: 'Лондон', ds: 'Отвори филиал в Лондон.', goal: c => [c.owns('london') ? 1 : 0, 1], money: M(3000000) },
    { id: 'e_berlin', ico: '🐻', nm: 'Берлин', ds: 'Отвори филиал в Берлин.', goal: c => [c.owns('berlin') ? 1 : 0, 1], money: M(3000000) },
    { id: 'e_caps3', ico: '🏛️', nm: 'Три столици', ds: 'Имай филиали в 3 европейски столици.', goal: c => [owned(c).filter(id => EU_CAPS.includes(id)).length, 3], money: M(6000000) },
    { id: 'e_t25', ico: '🏙️', nm: 'Стъклен гигант', ds: 'Завърши небостъргач на 25 етажа или повече.', goal: ['tower25', 1], money: M(2500000) },
    { id: 'e_t30', ico: '🌃', nm: 'Тридесет етажа', ds: 'Завърши небостъргач на 30 етажа.', goal: ['tower30', 1], money: M(4000000) },
    { id: 'e_rail', ico: '🚄', nm: 'Трансевропейски експрес', ds: 'Свържи София с Виена с жп линия.', goal: c => [c.rail('sofia', 'vienna') ? 1 : 0, 1], money: M(5000000) },
    { id: 'e_br8', ico: '🌍', nm: 'Паневропейска фирма', ds: 'Имай общо 8 филиала.', goal: c => [c.branches(), 8], money: M(8000000) },
  ] },
  { id: 'c9', nm: 'Аутобани', ico: '🔴', quests: [
    { id: 'a_1', ico: '🛣️', nm: 'Първият аутобан', ds: 'Завърши участък от аутобан.', goal: c => [abDone(c), 1], money: M(1500000) },
    { id: 'a_5', ico: '🚛', nm: 'Пет участъка', ds: 'Завърши 5 участъка аутобан.', goal: c => [abDone(c), 5], money: M(4000000) },
    { id: 'a_sp', ico: '🇧🇬', nm: 'София — Пловдив по аутобан', ds: 'Завърши аутобан София — Пловдив.', goal: c => [ab(c, 'sofia', 'plovdiv') ? 1 : 0, 1], money: M(2000000) },
    { id: 'a_ist', ico: '🕌', nm: 'Порта към Азия', ds: 'Завърши аутобан Одрин — Истанбул.', goal: c => [ab(c, 'edirne', 'istanbul') ? 1 : 0, 1], money: M(3000000) },
    { id: 'a_vie', ico: '🎻', nm: 'Дунавски коридор', ds: 'Завърши аутобан Будапеща — Виена.', goal: c => [ab(c, 'budapest', 'vienna') ? 1 : 0, 1], money: M(3000000) },
    { id: 'a_toll', ico: '🎫', nm: 'Тол магнат', ds: 'Тол таксите да носят 30 000 €/ден.', goal: c => [c.toll(), 30000], money: M(5000000) },
    { id: 'a_12', ico: '🗺️', nm: 'Половин Европа', ds: 'Завърши 12 участъка аутобан.', goal: c => [abDone(c), 12], money: M(10000000) },
    { id: 'a_all', ico: '🏆', nm: 'Магистралите на континента', ds: 'Завърши всички 21 участъка аутобан.', goal: c => [abDone(c), 21], money: M(25000000) },
  ] },
  { id: 'c10', nm: 'Море и курорти', ico: '🏖️', quests: [
    { id: 'm_sea', ico: '⚓', nm: 'Морски град', ds: 'Отвори филиал в крайбрежен град.', goal: c => [owned(c).filter(id => SEA.includes(id)).length, 1], money: M(300000) },
    { id: 'm_sea3', ico: '🌊', nm: 'Три пристанища', ds: 'Имай филиали в 3 крайбрежни града.', goal: c => [owned(c).filter(id => SEA.includes(id)).length, 3], money: M(1500000) },
    { id: 's_port', ico: '⚓', nm: 'Собствено пристанище', ds: 'Надгради пристанище.', goal: ['port', 1], money: M(1000000) },
    { id: 's_voy20', ico: '🚢', nm: 'Морски превозвач', ds: 'Изпълни 20 морски рейса.', goal: ['voyage', 20], money: M(3000000) },
    { id: 's_port5', ico: '🏗️', nm: 'Пристанищен магнат', ds: 'Изгради 5 нива пристанища.', goal: ['port', 5], money: M(10000000) },
    { id: 's_voy200', ico: '🌊', nm: 'Владетел на моретата', ds: 'Изпълни 200 морски рейса.', goal: ['voyage', 200], money: M(30000000) },
    { id: 'r_3', ico: '🏡', nm: 'Три курорта', ds: 'Построй вилни селища в 3 курорта.', goal: c => [resortsAt(c, ['built', 'sold']), 3], money: M(2000000) },
    { id: 'r_hotel', ico: '🏨', nm: 'Хотелиер', ds: 'Построй хотел в курорт.', goal: ['resortHotel', 1], money: M(800000) },
    { id: 'r_ext4', ico: '🛝', nm: 'Ваканционен рай', ds: 'Построй 4 разширения в курортите (хотел, лифт, аквапарк, СПА).', goal: c => [resortExt(c), 4], money: M(2500000) },
    { id: 'r_all', ico: '🌴', nm: 'Ваканционна империя', ds: 'Притежавай вилни селища в 6 курорта.', goal: c => [resortsAt(c, 'built'), 6], money: M(8000000) },
    { id: 't_win', ico: '🏛️', nm: 'Държавна поръчка', ds: 'Спечели държавен търг.', goal: ['tenderWon', 1], money: M(1000000) },
    { id: 't_done', ico: '⚓', nm: 'Голям обект за държавата', ds: 'Предай завършена държавна поръчка.', goal: ['tenderDone', 1], money: M(3000000) },
    { id: 'r_tr', ico: '🇹🇷', nm: 'Турска ривиера', ds: 'Построй вилно селище в турски курорт.', goal: c => [['antalya', 'bodrum', 'marmaris', 'uludag'].filter(id => ['built', 'sold'].includes((c.S().resorts || {})[id]?.stage)).length, 1], money: M(5000000) },
    { id: 'r_alps', ico: '🏔️', nm: 'Алпийски шик', ds: 'Построй вилно селище в Алпите.', goal: c => [['chamonix', 'zermatt', 'stanton', 'cortina'].filter(id => ['built', 'sold'].includes((c.S().resorts || {})[id]?.stage)).length, 1], money: M(8000000) },
    { id: 'r_sell', ico: '💰', nm: 'Голямата продажба', ds: 'Продай вилно селище.', goal: c => [resortsAt(c, 'sold'), 1], money: M(1000000) },
  ] },
  { id: 'c11', nm: 'Финансов магнат', ico: '📈', quests: [
    { id: 'f_sh', ico: '📈', nm: 'Първите акции', ds: 'Купи акции на борсата.', goal: c => [Object.keys(c.econ().s.shares || {}).length, 1], money: M(100000) },
    { id: 'f_port', ico: '💼', nm: 'Портфейл за милион', ds: 'Акциите ти да струват 1 000 000 €.', goal: c => [c.econ().portfolioValue ? c.econ().portfolioValue() : 0, 1000000], money: M(500000) },
    { id: 'f_ipo', ico: '🔔', nm: 'На борсата', ds: 'Пусни фирмата на борсата (IPO).', goal: c => [c.econ().s.ipo ? 1 : 0, 1], money: M(1000000) },
    { id: 'f_buy', ico: '🏗️', nm: 'Отново изцяло моя', ds: 'Изкупи обратно акциите на фирмата.', goal: c => [c.econ().s.ipo && !c.econ().s.ipo.outside ? 1 : 0, 1], money: M(2000000) },
    { id: 'f_take', ico: '🏢', nm: 'Лешояд', ds: 'Изкупи цяла фалирала фирма от борсата.', goal: c => [Object.keys(c.econ().s.subs || {}).length, 1], money: M(1500000) },
    { id: 'f_take3', ico: '🏦', nm: 'Холдинг', ds: 'Имай 3 дъщерни фирми.', goal: c => [Object.keys(c.econ().s.subs || {}).length, 3], money: M(6000000) },
    { id: 'f_dep5', ico: '🏦', nm: 'Голям вложител', ds: 'Имай 5 000 000 € на депозит.', goal: c => [c.deposit(), 5000000], money: M(500000) },
    { id: 'f_net50', ico: '💎', nm: 'Петдесет милиона', ds: 'Нетната стойност на фирмата да надмине 50 000 000 €.', goal: c => [c.econ().netWorth ? c.econ().netWorth([]) : 0, 50000000], money: M(5000000) },
    { id: 'f_m100', ico: '👑', nm: 'Сто милиона в банката', ds: 'Имай 100 000 000 € в сметката.', goal: c => [c.money(), 100000000], money: M(10000000) },
  ] },
  { id: 'c12', nm: 'Световна империя', ico: '🌐', quests: [
    { id: 'w_fin5', ico: '🏁', nm: 'Пет завършени града', ds: 'Завърши 5 града.', goal: c => [finished(c).length, 5], money: M(10000000) },
    { id: 'w_fin_bg', ico: '🇧🇬', nm: 'Цяла България', ds: 'Завладей България: завърши София, Пловдив, Варна, Бургас, Велико Търново и Благоевград.', goal: c => [['sofia', 'plovdiv', 'varna', 'burgas', 'vt', 'blg'].filter(id => finished(c).includes(id)).length, 6], money: M(15000000) },
    { id: 'w_won1', ico: '🟩', nm: 'Първа чужда държава', ds: 'Завладей държава извън България (завърши ключовите ѝ градове).', goal: c => [wonCountries(wonDone(c)).filter(k => k.iso !== 'BGR').length, 1], money: M(25000000) },
    { id: 'w_won3', ico: '🗺️', nm: 'Три държави', ds: 'Завладей 3 държави.', goal: c => [wonCountries(wonDone(c)).length, 3], money: M(40000000) },
    { id: 'w_won10', ico: '🌍', nm: 'Десет държави', ds: 'Завладей 10 държави.', goal: c => [wonCountries(wonDone(c)).length, 10], money: M(150000000) },
    { id: 'w_fin_eu', ico: '🇪🇺', nm: 'Завършена европейска столица', ds: 'Завърши град в Европа.', goal: c => [finished(c).filter(id => EU_CAPS.includes(id)).length, 1], money: M(15000000) },
    { id: 'w_auto', ico: '💶', nm: 'Пари, докато спиш', ds: 'Завършените градове да носят 500 000 €/ден.', goal: c => [Object.entries(c.econ().s.finished || {}).reduce((a, [, f]) => a + Math.round(f.daily * (c.econ().maintOf ? c.econ().maintOf(f) : 1)), 0), 500000], money: M(20000000) },
    { id: 'w_fin10', ico: '🌍', nm: 'Десет завършени града', ds: 'Завърши 10 града.', goal: c => [finished(c).length, 10], money: M(30000000) },
    { id: 'w_br20', ico: '🗺️', nm: 'Навсякъде', ds: 'Имай общо 20 филиала.', goal: c => [c.branches(), 20], money: M(40000000) },
    { id: 'w_done1k', ico: '🏆', nm: 'Хиляда обекта', ds: 'Завърши общо 1000 обекта.', goal: c => [c.done(), 1000], money: M(50000000) },
    { id: 'w_air1', ico: '🛫', nm: 'Първото летище', ds: 'Построй летище в свой град.', goal: ['airport', 1], money: M(3000000) },
    { id: 'w_fly50', ico: '✈️', nm: 'Петдесет полета', ds: 'Изпълни 50 полета.', goal: ['flight', 50], money: M(5000000) },
    { id: 'w_world1', ico: '🗽', nm: 'Отвъд океана', ds: 'Отвори филиал в град извън Европа.', goal: c => [owned(c).filter(id => WORLD.includes(id)).length, 1], money: M(20000000) },
    { id: 'w_cont', ico: '🌏', nm: 'Пет континента', ds: 'Имай филиали в Европа, Северна Америка, Южна Америка, Азия и Африка или Австралия.', goal: c => { const o = owned(c); return [1 + [['newyork', 'losangeles', 'chicago', 'toronto', 'mexicocity'], ['rio', 'saopaulo', 'buenosaires'], ['dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'tokyo', 'seoul', 'beijing'], ['cairo', 'capetown', 'sydney']].filter(g => g.some(id => o.includes(id))).length, 5]; }, money: M(50000000) },
    { id: 'w_air5', ico: '🛬', nm: 'Авиокомпания', ds: 'Построй 5 летища.', goal: ['airport', 5], money: M(20000000) },
    { id: 'w_fly500', ico: '🌐', nm: 'Петстотин полета', ds: 'Изпълни 500 полета.', goal: ['flight', 500], money: M(40000000) },
    { id: 't_done4', ico: '🏛️', nm: 'Държавен партньор', ds: 'Предай 4 държавни поръчки.', goal: ['tenderDone', 4], money: M(25000000) },
    { id: 'w_legend', ico: '👑', nm: 'Световна строителна империя', ds: 'Завърши 20 града.', goal: c => [finished(c).length, 20], money: M(100000000) },
  ] },
  BOARD_CHAPTER,
];
