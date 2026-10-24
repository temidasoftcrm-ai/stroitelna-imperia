// lab.js — Лабораторията (labserver.mjs → http://localhost:3610): „Ново“ (чака ✓ OK), „Сцени“ (градовете в рамка),
// „3D модели“ (всички GLB с размер, триъгълници и анимации), „Звуци“ и „Мисии/демо“ (дебъг входове с __dbg).
// Изборът се пази в адреса (#tab=…&item=…) — след промяна в кода страницата се връща там, където беше.
import { FEATURES } from './features.js';
import { openModel, closeModel } from './viewer.js';

const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';
const GAME = 'index.html?autotest=100000&nocollect';   // градът наготово (без начален екран); autotest=100000 — ботът не играе сам

// градовете: с план (нова игра), мегаполисите, големите забележителности и един град на старата мрежа
const SCENES = [
  ['sofia', 'София', 'план „планина“ · централата'], ['plovdiv', 'Пловдив', 'план „река“'], ['varna', 'Варна', 'море, пристанище, плаж'],
  ['vienna', 'Виена', 'стар град в пръстен'], ['amsterdam', 'Амстердам', 'полукръгли канали'], ['barcelona', 'Барселона', 'блокове и „Диагонал“'],
  ['chicago', 'Чикаго', 'правоъгълна мрежа'], ['washington', 'Вашингтон', 'Капитолият + Белият дом'], ['moscow', 'Москва', 'мегаполис · МГУ'],
  ['paris', 'Париж', 'мегаполис · Айфеловата кула'], ['newyork', 'Ню Йорк', 'мегаполис · Манхатън'], ['istanbul', 'Истанбул', 'мегаполис · джамията'],
  ['rome', 'Рим', 'мегаполис · Колизеума'], ['london', 'Лондон', 'мегаполис · Биг Бен, река'], ['berlin', 'Берлин', 'мегаполис · Бранденбургската врата'],
  ['madrid', 'Мадрид', 'мегаполис'], ['milan', 'Милано', 'мегаполис'], ['tokyo', 'Токио', 'мегаполис · море'], ['beijing', 'Пекин', 'мегаполис · звезда с пръстени'],
  ['losangeles', 'Лос Анджелис', 'мегаполис · мрежа'], ['buenosaires', 'Буенос Айрес', 'мегаполис · мрежа'], ['rio', 'Рио де Жанейро', 'мегаполис · Христос Спасителя'],
  ['cairo', 'Кайро', 'мегаполис · пирамидите'], ['sydney', 'Сидни', 'Операта'], ['toronto', 'Торонто', 'мрежа · Си Ен Тауър'], ['prague', 'Прага', 'стар град в пръстен'],
  ['budapest', 'Будапеща', 'река'], ['athens', 'Атина', 'море'], ['bucharest', 'Букурещ', ''], ['stpetersburg', 'Санкт Петербург', 'канали'],
  ['lasvegas', 'Лас Вегас', 'Луксор + Беладжо'], ['dubai', 'Дубай', 'Бурж Халифа'], ['pernik', 'Перник', 'малък град — старата мрежа 9×9'],
];
// дебъг входове: адрес + действие след зареждане (__dbg в рамката — същият origin)
const DEMOS = [
  ['Летище (ниво 4)', 'sofia', d => d.airLook(4, 200)],
  ['Летище — кулата нощем', 'sofia', d => { d.airTowerLook(7); d.time(23); }],
  ['Гарата (ниво 5)', 'sofia', d => d.lookSt(5)],
  ['Държавна поръчка: университет', 'sofia', d => d.tenderGo('su-sofia')],
  ['Държавна поръчка: Камп Ноу', 'barcelona', d => d.tenderGo('campnou-barcelona')],
  ['Кариера (добив)', 'plovdiv', d => d.mineLook('quarry', 2, 80)],
  ['Нефтен кладенец', 'plovdiv', d => d.mineLook('oilwell', 2, 70)],
  ['Магистрала (строеж)', 'sofia', d => d.hwView()],
  ['Аутобан до града', 'sofia', d => d.abCityTest()],
  ['Влаковете (всички модели)', 'sofia', d => d.trainLook()],
  ['Градът нощем', 'sofia', d => d.time(23)],
  ['Капитолият отблизо', 'washington', d => { const b = d.bigInfo().lm.find(o => o[0] === 'big'); if (b) d.camAt(b[1] + 60, 55, b[2] + 90, b[1], 5, b[2]); }],
  ['Пътищата до гарата, летището и магистралата', 'vienna', d => d.lookTop(700)],
  ['Картата на Европа', 'sofia', d => d.contMap('eu', 12)],
  ['Глобусът', 'sofia', d => d.globeTest && d.globeTest()],
  ['Саграда Фамилия нощем', 'barcelona', d => { d.time(22.5); const l = d.bigInfo().lm[0]; if (l) d.camAt(l[1] - 20, 75, l[2] + 115, l[1], 18, l[2]); }],
  // забележителностите нощем (по реда в city.landmarks: големите и морските — първи)
  ['🌙 Бурж Халифа', 'dubai', d => { d.time(22.5); d.lookLm(0, 230); }],
  ['🌙 Капитолият', 'washington', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Белият дом', 'washington', d => { d.time(22.5); d.lookLm(1, 120); }],
  ['🌙 Кметството на Филаделфия', 'philadelphia', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Си Ен Тауър', 'toronto', d => { d.time(22.5); d.lookLm(0, 200); }],
  ['🌙 Колизеума', 'rome', d => { d.time(22.5); d.lookLm(0, 120); }],
  ['🌙 Айфеловата кула', 'paris', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Света София', 'istanbul', d => { d.time(22.5); d.lookLm(1, 130); }],
  ['🌙 Синята джамия', 'istanbul', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Статуята на свободата', 'newyork', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Манхатън', 'newyork', d => { d.time(22.5); d.lookLm(1, 180); }],
  ['🌙 Луксор', 'lasvegas', d => { d.time(22.5); d.lookLm(0, 130); }],
  ['🌙 Беладжо', 'lasvegas', d => { d.time(22.5); d.lookLm(1, 130); }],
  ['🌙 Welcome to Las Vegas', 'lasvegas', d => { d.time(22.5); d.lookLm(2, 80); }],
  ['🌙 МГУ', 'moscow', d => { d.time(22.5); d.lookLm(0, 160); }],
  ['🌙 Св. Василий Блажени', 'moscow', d => { d.time(22.5); d.lookLm(1, 120); }],
  ['🌙 Нотр Дам', 'paris', d => { d.time(22.5); d.lookLm(2, 120); }],
  ['🌙 Операта в Сидни', 'sydney', d => { d.time(22.5); d.lookLm(0, 130); }],
  ['🌙 Христос Спасителя', 'rio', d => { d.time(22.5); d.lookLm(0, 120); }],
  ['🌙 Саграда Фамилия', 'barcelona', d => { d.time(22.5); d.lookLm(0, 140); }],
  ['🌙 Шанхайската кула', 'shanghai', d => { d.time(22.5); d.lookLm(0, 200); }],
  ['🌙 Св. Стефан', 'budapest', d => { d.time(22.5); d.lookLm(0, 120); }],
  ['🌙 Уилис Тауър', 'chicago', d => { d.time(22.5); d.lookLm(0, 180); }],
  ['🌙 Модерните небостъргачи (D, E)', 'tokyo', d => { d.time(22.5); d.look(0, 230); }],
  ['🚶 Хората по улиците', 'sofia', d => { d.time(13); d.look(0, 26); }],
  ['🌳 Зелените площи и центърът', 'plovdiv', d => { d.time(13); d.look(0, 160); }],
  ['🌿 Истинските храсти и фонтанът', 'plovdiv', d => { d.time(13); d.look(0, 45); }],
  ['🌙 Истинските къщи и блоковете нощем', 'sofia', d => { d.nightRow(); d.time(22.5); }],
  ['🌙 Новите цветни къщи нощем', 'sofia', d => { d.nightRow('h2'); d.time(22.5); }],
  ['🚨 Спешните коли и сирените (вечер)', 'sofia', d => d.emergLook()],
  ['🌴 Лос Анджелис по картата', 'losangeles', d => { d.signLook(true); }],
  ['🎬 HOLLYWOOD отблизо', 'losangeles', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.signLook(), ms); }],   // повторно — камерата отлита към първата поръчка
  ['🌙 HOLLYWOOD нощем', 'losangeles', d => { d.time(22); for (const ms of [0, 3500, 8000]) setTimeout(() => d.signLook(), ms); }],
  ['🏢 Панелните блокове в истински ръст', 'sofia', d => { d.nightRow(); }],
  ['🗽 Ню Йорк: небостъргачите по квадратите', 'newyork', d => { for (const ms of [0, 3000, 7000]) setTimeout(() => d.sqLook(220), ms); }],
  ['📏 Истинските височини: къща, блок, небостъргач', 'sofia', d => { d.heightRow(); }],
  ['🚓 Инцидент: полиция, пожарна и линейка идват по улиците', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0), ms); }],   // повторно — само камерата
  ['📊 Горната лента: „Империя ▾“', 'sofia', d => { d.hubOpen(); }],
  ['🎲 Имоти: строй изненада', 'sofia', d => { d.rollDemo(); }],
  ['🏅 Ново ниво: картинка', 'sofia', d => { for (let n = 1; n <= 20; n++) d.lvShow(n); }],   // всичките 20 една след друга (клик — следващата)
  ['⛽ Бензиностанции — 4 кандидата', 'sofia', d => d.gasLook()],
  ['🏛️ Дъщерна фирма: екран с логото', 'sofia', d => { d.subShowTest('rail', 'ask'); }],
  ['🏨 5★ хотели — 5 кандидата', 'sofia', d => d.hotel5Look()],
  ['🏛️ Директорската зала', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🪑 Директорската зала — сравнение на столовете', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoBoardroom({ chairChoices: true }))")],
  ['🇺🇸 Кабинет на САЩ — Белият дом', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoCabinet('US'))")],
  ['🇷🇺 Министерски съвет — Кремъл', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoCabinet('RU'))")],
  ['🇺🇸 Президентска кампания — 51 щата', 'sofia', () => $('fr').contentWindow.eval("import('/campaign.js').then(m => m.demoCampaign())")],
  ['🇷🇺 Президентски избори — 83 региона', 'sofia', () => $('fr').contentWindow.eval("import('/campaign.js').then(m => m.demoCampaign('RU'))")],   // directors3d.js — без game.js
  ['🚨 Оперативна карта: Градски площад (протест)', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps())")],   // ops.js + ops3d.js — без game.js
  ['🔥 Оперативна карта: симулация на безредици', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', true))")],
  ['🌊 Оперативна карта: наводнение', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', false, 'flood'))")],
  ['🔥 Оперативна карта: пожар в жилищен блок', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', false, 'fire'))")],
  ['🤝 Оперативна карта: хуманитарен достъп', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', false, 'aid'))")],
  ['🌊 Оперативна карта: Ормузкият проток', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', false, 'strait'))")],
  ['🏗️ Оперативна карта: възстановяване на район (Украйна)', 'sofia', () => $('fr').contentWindow.eval("import('/ops.js').then(m => m.demoOps('US', false, 'rebuild'))")],
  ['🌍 Геополитическата карта (САЩ)', 'sofia', d => d.geoDemo('US')],
  ['🌍 Геополитическата карта (Русия)', 'sofia', d => d.geoDemo('RU')],
  ['⛔ Извънредно заседание (супер поръчка)', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoEmergency())")],   // group.js emergency()
  ['🆘 Извънредно заседание: касата на минус', 'sofia', () => $('fr').contentWindow.eval("import('/directors3d.js').then(m => m.demoEmergency('rescue'))")],   // boardrescue.js
  ['🏦 Трезорът зад борда (476 млрд. €)', 'sofia', () => $('fr').contentWindow.eval("window.__vaultMoney = 476.6e9; import('/directors3d.js').then(m => m.demoBoardroom())")],   // vault3d.js — вратата вляво зад масата
  ['🏦 Трезорът: малко пари (40 млн. €)', 'sofia', () => $('fr').contentWindow.eval("window.__vaultMoney = 4e7; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏦 Трезорът: пълен (620 млрд. €), нощ', 'sofia', () => $('fr').contentWindow.eval("window.__vaultMoney = 6.2e11; window.__vaultNight = 1; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏆 Отличия: връчване на Ивайло (злато) в края на заседанието', 'sofia', () => $('fr').contentWindow.eval("window.__awTier = null; window.__awCeremony = 'gold'; import('/directors3d.js').then(m => m.demoBoardroom())")],   // awards3d.js
  ['🏆 Отличия: всичките 10 на витрината', 'sofia', () => $('fr').contentWindow.eval("window.__awCeremony = null; window.__awTier = null; window.__awAll = 1; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏆 Отличия: Ивайло — бронз', 'sofia', () => $('fr').contentWindow.eval("window.__awCeremony = null; window.__awTier = 'bronze'; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏆 Отличия: Ивайло — сребро', 'sofia', () => $('fr').contentWindow.eval("window.__awCeremony = null; window.__awTier = 'silver'; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏆 Отличия: Ивайло — злато', 'sofia', () => $('fr').contentWindow.eval("window.__awCeremony = null; window.__awTier = 'gold'; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🏆 Отличия: Ивайло — платина', 'sofia', () => $('fr').contentWindow.eval("window.__awCeremony = null; window.__awTier = 'platinum'; import('/directors3d.js').then(m => m.demoBoardroom())")],
  ['🔥 Пожар: спасена (над 30%)', 'sofia', () => $('fr').contentWindow.__dbg.fireTest(0.4)],   // firesim.js (fire-seq)
  ['🔥 Пожар: критични щети (под 30%) → спешен ремонт', 'sofia', () => $('fr').contentWindow.__dbg.fireTest(1.4)],
  ['🔥 Пожар: изгоряла (0%) → разчистване и нов строеж', 'sofia', () => $('fr').contentWindow.__dbg.fireTest(2.2)],
  ['🪧 Билбордове с фирмата по булевардите', 'sofia', d => d.billboardLook()],   // billboards3d.js
  ['🪧 Билбордове: петте размера (Империал, ден)', 'sofia', d => d.bbRow('imperial', false)],
  ['🪧 Билбордове: петте размера (Империал, нощ)', 'sofia', d => d.bbRow('imperial', true)],
  ['🪧 Билбордове: петте размера (друга марка — Титан)', 'sofia', d => d.bbRow('titan', false)],
  ['🪧 Билбордове по булеварда (Империал, нощ)', 'sofia', d => { d.bbRebuild('imperial'); d.time && d.time(22); setTimeout(() => d.billboardLook(), 1500); }],
  ['🏢 Кампус: офис отпред, гараж и склад отзад, общ двор', 'sofia', d => d.campusLook()],   // hq-campus (game.js __dbg.campusLook)
  ['🚶 Пътеки и алеи от сградите до тротоара', 'sofia', d => d.pathsLook()],   // lot-paths (game.js __dbg.pathsLook)
  ['🏢 Офис, гараж и склад — всички нива (1–10) в редица', 'sofia', d => { for (const ms of [0, 4000]) setTimeout(() => d.hqLevelsRow(), ms); }],
  ['🆕 Офисът — новите нива 1–10 (една линия, Sketchfab)', 'sofia', d => { for (const ms of [0, 4000]) setTimeout(() => d.hqLevelsRow('new'), ms); }],   // office-levels2 (game.js OFFICE2)
  ['🏡 Кварталите: дворове, паркове, площадки (Пловдив, ден)', 'plovdiv', d => { setTimeout(() => { d.lotFill(); d.tod && d.tod(0.5); d.districts('on'); d.districts('focus'); }, 2500); }],
  ['🏡 Кварталите: диагностика на земята (парцели, сгради, свободно)', 'plovdiv', d => { setTimeout(() => { d.lotFill(); d.districts('on'); d.districts('diag'); d.districts('focus', 2.2); }, 2500); }],
  ['🚨 Градска сцена: 🚶 Блъснат пешеходец', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'ped'), ms); }],
  ['🚨 Градска сцена: 💥 Челна катастрофа', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'headon'), ms); }],
  ['🚨 Градска сцена: 🌳 Кола в дърво', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'pole'), ms); }],
  ['🚨 Градска сцена: 🙃 Кола по таван', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'roll'), ms); }],
  ['🚨 Градска сцена: 🚗🚗🚗 Верижна катастрофа', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'pile'), ms); }],
  ['🚨 Градска сцена: 🔥 Горяща кола', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'carfire'), ms); }],
  ['🚨 Градска сцена: 🏍️ Паднал моторист', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'moto'), ms); }],
  ['🚨 Градска сцена: 📦 Камион изсипа товара', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'spill'), ms); }],
  ['🚨 Градска сцена: 🔥🏢 Пожар в сграда', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'bfire'), ms); }],
  ['🚨 Градска сцена: ❤️ Инфаркт на тротоара', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'heart'), ms); }],
  ['🚨 Градска сцена: 🐈 Котка на дърво', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'cat'), ms); }],
  ['🚨 Градска сцена: ⚠️ Изтичане на газ', 'sofia', d => { for (const ms of [0, 3500, 8000]) setTimeout(() => d.incidentLook(ms > 0, 'gas'), ms); }],
  ['🚦 Прелез: светлини, звънец и бариери (влакове минават)', 'plovdiv', d => d.railLook()],   // rail-crossings (railx.js)
  ['🚇 Тунел в края на линията (без отрязани релси)', 'plovdiv', d => d.tunnelLook(1)],   // rail-crossings
  ['🛣️ Магистралата: изходи към града, бензиностанцията, изпреварване (hw-ramps)', 'plovdiv', () => $('fr').contentWindow.eval("__dbg.hwOpen(); setTimeout(() => __dbg.hwLookRamps(), 600)")],
  ['🏷️ 3D емблемите на марките — всички в редица', 'sofia', d => { for (const ms of [0, 4000]) setTimeout(() => d.logoRow(1, 'titan', true), ms); }],   // brand-logo3d (game.js logo3d)
  ['🏷️ Емблемата над офиса — Империал (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('imperial'), 4000)],   // brand-logo3d
  ['🏷️ Емблемата над офиса — Индустриал (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('industrial'), 4000)],   // brand-logo3d
  ['🏷️ Емблемата над офиса — Титан (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('titan'), 4000)],   // brand-logo3d
  ['🏷️ Емблемата над офиса — Атлас (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('atlas'), 4000)],   // brand-logo3d
  ['🏷️ Емблемата над офиса — Хоризон (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('horizon'), 4000)],   // brand-logo3d
  ['🏷️ Емблемата над офиса — своя фирма (нива 1 → 3 → 5 → 10)', 'sofia', d => setTimeout(() => d.logoTour('custom'), 4000)],   // brand-logo3d
  ['🏢 Общ парцел на фирмата — ниво 1', 'plovdiv', d => d.campus2Look(1)],   // campus2
  ['🏢 Общ парцел на фирмата — ниво 5', 'plovdiv', d => d.campus2Look(5)],   // campus2
  ['🏢 Общ парцел на фирмата — ниво 10', 'plovdiv', d => d.campus2Look(10)],   // campus2
  ['📦 Складовете 1–10: стари (горе) и нови (долу)', 'plovdiv', d => d.whRow()],   // wh-levels2
  ['📦 Нов склад в общия парцел (ниво 6)', 'plovdiv', d => d.campus2Look(6)],   // wh-levels2 + campus2
  ['✨ Надписите на забележителностите — само златни букви', 'paris', d => { d.lookLm(1, 160); setTimeout(() => { d.lookLm(1, 160); d.lmLabels(); }, 4000); }],   // lm-label-text
  ['🌸 Сезонът до часовника (горе)', 'sofia', d => { d.skipDays(75); }],   // season-bar
  ['⛽ Бензиностанцията: без лого → с логото (след 5 s — петролното дружество)', 'plovdiv', d => { d.gasLogoLook(false); setTimeout(() => d.gasLogoLook(false), 3000); setTimeout(() => d.gasLogoLook(true), 8000); }],   // gas-logo-own
  ['📏 Панелните блокове и секциите им в истински размер (червеното — човек 1,8 м)', 'plovdiv', d => { d.sectRow(); setTimeout(() => d.sectRow(), 3000); }],   // real-sizes (d129)
  ['🌃 Нощните прозорци — по-приглушени (Чикаго, 22:00)', 'chicago', d => { d.time(22); d.lookLm(0, 260); setTimeout(() => { d.time(22); d.lookLm(0, 260); }, 4000); }],   // night-dim
  ['🏷️ Емблемите на марките нощем — светещите акценти', 'sofia', d => { for (const ms of [0, 4000]) setTimeout(() => { d.logoRow(1, 'titan', true); setTimeout(() => d.time(22), 300); }, ms); }],   // logo-glow
  ['🪧 Билбордовете по местата: големите в покрайнините, без кръгови/кръстовища (Хасково, през 5 s следващият)', 'haskovo', d => { let i = 0; const go = () => { const r = d.bbLook(i, 60); if (r) { i = (i + 1) % r[1]; setTimeout(go, 5000); } }; setTimeout(go, 3000); }],   // bb-place
  ['🕌 Сюлеймание (модел от Meshy) — ден, после нощ (Истанбул)', 'istanbul', d => { const go = () => { const L = d.city().landmarks, i = L.findIndex(o => o.kind === 'suleymaniye2'); if (i >= 0) d.lookLm(i, 110); }; setTimeout(go, 3000); setTimeout(() => { d.time(22); go(); }, 10000); }],   // lm-suleymaniye2
  ['🌃 Уилис тауър нощем — прозорците и червените светлини по антените (Чикаго)', 'chicago', d => { const go = () => { d.time(22); const o = d.city().landmarks.find(x => x.kind === 'willis'); if (!o) return; let top = 0; o.group.traverse(m => { if (m.isMesh) { m.geometry.computeBoundingBox(); top = Math.max(top, m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld).max.y); } }); const p = o.group.position; d.camAt(p.x + 110, top * 0.7, p.z + 150, p.x, top * 0.6, p.z); }; setTimeout(go, 3000); }],   // night-willis
  ['🏛️ Котелническа висотка — без плочата с парка, 176 м (Москва)', 'moscow', d => { const go = () => { const L = d.city().landmarks, i = L.findIndex(o => o.kind === 'kotel'); if (i >= 0) d.lookLm(i, 160); }; setTimeout(go, 3000); }],   // lm-kotel
  ['🚗 Фаровете нощем — лещите на модела (2 s след зареждането)', 'plovdiv', d => { setTimeout(() => d.carLensLook(), 2000); }],   // car-lens
  ['🇺🇸 Вашингтон по картата: прелитане по Нешънъл Мол — Капитолий → Монумент → Линкълн', 'washington', d => { setTimeout(() => d.mallLook('top'), 2500); setTimeout(() => d.mallLook('fly'), 6000); }],   // washington-osm + washington-game
  ['📦 Складът (а): иконки с количество/процент над купчините — ден, после нощ', 'plovdiv', d => { setTimeout(() => d.whMatsLook('icons', 11, 40, 4, -0.3), 2500); setTimeout(() => d.whMatsLook('icons', 22, 40, 4, -0.3), 9000); }],   // wh-mats
  ['📦 Складът (б): истински модели — палети тухли, цимент, дъски, греди, пясък, стъкла, кашони, мрамор — ден, после нощ', 'plovdiv', d => { setTimeout(() => d.whMatsLook('models', 11, 14, 4, -0.3), 2500); setTimeout(() => d.whMatsLook('models', 22, 14, 4, -0.3), 9000); }],   // wh-mats
  ['📦 Складът (в): модели + иконки само отблизо (отдалечава се, после нощ)', 'plovdiv', d => { setTimeout(() => d.whMatsLook('both', 11, 24, 4, -0.3), 2500); setTimeout(() => d.whMatsLook('both', 11, 75, 4, -0.3), 8000); setTimeout(() => d.whMatsLook('both', 22, 24, 4, -0.3), 13000); }],   // wh-mats
  ['🌊 Морето — една водна повърхност, вълни, отражение на небето, следи на лодките (Варна)', 'varna', d => setTimeout(() => { let root = d.city().group; while (root.parent) root = root.parent; let best = null; root.traverse(o => { if (o.isMesh && o.material && o.material.type === 'MeshPhysicalMaterial' && o.visible) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld), a = (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z); if (!best || a > best.a) best = { a, bb }; } }); if (best) { const b = best.bb, cx = (b.min.x + b.max.x) / 2; d.camAt(cx, 28, b.max.z + 10, cx + 40, 0, b.max.z - 160); } }, 3000)],   // sea2
  ['💡 Истински улични лампи и светофари: LED 9 м по улиците, класически ~5 м в стария център; светофар на конзола на тротоара до стоп линията (ден, после нощ)', 'plovdiv', d => { setTimeout(() => d.streetLook(0, false), 3000); setTimeout(() => d.streetLook(3, false, 45), 9000); setTimeout(() => d.streetLook(0, true), 15000); }],   // street-real
  ['⚓ Варна: пристанището и брегът по истинската брегова линия', 'varna', d => setTimeout(() => { const p = d.city().sea && d.city().sea.port; if (p) d.camAt(p.x + 60, 260, p.z + 260, p.x, 0, p.z - 20); }, 3000)],   // sea-coast
  ['🛝 Дворовете с истински модели: огради, пейки, площадки, паркинги (Пловдив; през 7 s следващият изглед, накрая нощ)', 'plovdiv', d => { const V = [['houses', 11, 0], ['houses', 11, 4], ['blocks', 11, 0], ['blocks', 11, 2], ['decor3', 11, 0], ['decor4', 11, 0], ['park', 11, 0], ['blocks', 22, 1], ['houses', 22, 2]]; let i = 0; const go = () => { const [m, h, k] = V[i]; d.yardsLook(m, h, false, k); if (++i < V.length) setTimeout(go, 7000); }; setTimeout(go, 3000); }],   // yards-real (game.js __dbg.yardsLook)
  ['🅿️ Паркираните коли нощем — без фарове (Пловдив, 02:20)', 'plovdiv', d => setTimeout(() => { d.time(2.33); const cars = []; d.city().group.traverse(o => { if (/^sf-car-/.test(o.userData.src || '')) cars.push(o); }); const o = cars[Math.min(3, cars.length - 1)]; if (o) { const p = o.getWorldPosition(o.position.clone()); d.camAt(p.x + 22, 16, p.z + 26, p.x, 0, p.z); } }, 3000)],   // park-dark
  ['🌳 Истинските дървета и при обществените сгради и забележителностите (Рим: училището)', 'rome', d => setTimeout(() => { let root = d.city().group; while (root.parent) root = root.parent; let g = null; root.traverse(o => { if (!g && o.name === 'svc-school') g = o; }); if (g) { const p = g.getWorldPosition(g.position.clone()); d.camAt(p.x + 45, 40, p.z + 55, p.x, 0, p.z); } }, 4000)],   // trees-more
  ['🪧 Билбордовете — никога в сграда или строеж (Пловдив, през 5 s следващият)', 'plovdiv', d => { let i = 0; const go = () => { const r = d.bbLook(i, 60); if (r) { i = (i + 1) % r[1]; setTimeout(go, 5000); } }; setTimeout(go, 3000); }],   // bb-clear
  ['🛤️ Истинските релси на гарата (Пловдив)', 'plovdiv', d => setTimeout(() => d.lookSt(3, 30), 3000)],   // rail-real
  ['⚡ Контактната мрежа над коловозите (Пловдив: гарата, после прелеза)', 'plovdiv', d => { setTimeout(() => d.lookSt(3, 40), 3000); setTimeout(() => { const c = (d.city().railCross || [])[0]; if (c) d.camAt(c.x + 40, 22, c.z + 35, c.x, 3, c.z); }, 9000); }],   // catenary
  ['📦 Складовете 1–10 на свой парцел — в истински размер, в парцела (през 3 s следващото ниво)', 'plovdiv', d => { let lv = 1; const t = () => { d.whFitLook(lv); if (++lv <= 10) setTimeout(t, 3000); }; t(); }],   // real-sizes (№18)
  ['🏛️ Котелническа висотка — на брега, не в реката (Москва)', 'moscow', d => { const go = () => { const L = d.city().landmarks, i = L.findIndex(o => o.kind === 'kotel'); if (i >= 0) d.lookLm(i, 220); }; setTimeout(go, 3000); }],   // kotel-shore
  ['🎬 Филиал в Ню Йорк → влизаш в града и тръгва клипът (веднъж)', 'plovdiv', d => { setTimeout(() => d.branchClipTest('newyork'), 1500); }],   // branch-clip
  ['🚌 Градски автобус със спирки: линия по булевардите, навес и табела на тротоара, автобусът спира ~12 s (София; камерата на спирката)', 'sofia', d => setTimeout(() => d.busLook(), 6000)],   // city-bus (#15)
  ['⭐ Зала на славата — Ивайло (злато), после Мария (платина)', 'sofia', d => { setTimeout(() => d.fame('con', 'gold'), 3000); setTimeout(() => { window.__fame && window.__fame.close(); setTimeout(() => d.fame('rail', 'platinum'), 600); }, 16000); }],   // hall-fame
  ['🎬 Клипът на Истанбул (и след филиал там — същото като Ню Йорк)', 'istanbul', d => { setTimeout(() => d.cine('istanbul'), 2500); }],   // branch-clip (Истанбул)
  ['🪑 Столовете в залата — избор на играча (бутон 🪑 до 🏆)', 'sofia', d => setTimeout(() => { d.boardDemo(); setTimeout(() => { const w = document.querySelector('#fr')?.contentWindow || window; }, 100); }, 3000)],   // hall-chairs
  ['🛤️ Жп депото до гарата — стари вагони и парен локомотив (Пловдив)', 'plovdiv', d => setTimeout(() => { const g = d.city().depot; if (!g) return; let n = 0, cx = 0, cz = 0; g.traverse(o => { if (o.isMesh) { const p = o.getWorldPosition(o.position.clone()); cx += p.x; cz += p.z; n++; } }); if (n) d.camAt(cx / n + 60, 40, cz / n + 60, cx / n, 0, cz / n); }, 8000)],   // rail-depot
  ['🏙️ Фоновите сгради в Париж — разнообразни фасади, етажи и мансарди (ден, после нощ)', 'paris', d => { setTimeout(() => d.bgLook(false), 3000); setTimeout(() => d.bgLook(true), 16000); }],   // bg-variety
  ['🕌 Фоновите сгради в Истанбул — османски къщи и блокове с балкони, плоски покриви с бойлери (ден, после нощ)', 'istanbul', d => { setTimeout(() => d.bgLook(false), 3000); setTimeout(() => d.bgLook(true), 16000); }],   // bg-variety
  ['🏘️ Празните квартали: чужди сгради по парцелите и вътре в кварталите (Пловдив — отгоре, отблизо, нощ)', 'plovdiv', d => { setTimeout(() => d.bgLook(false, true), 3000); setTimeout(() => d.bgLook(false), 10000); setTimeout(() => d.bgLook(true), 17000); }],   // bg-fill
  ['🏨 5★ хотел в града — офисът става истинският модел (Пловдив → Острив)', 'plovdiv', d => { setTimeout(() => d.hotel5City(2), 1500); }],   // hotel5-*
  ['🏨 Гранд хотел в Ню Йорк — Мариот', 'newyork', d => { setTimeout(() => d.hotel5City(3), 1500); }],   // hotel5-*
  ['📦 Складът в общия парцел (campus2, ниво 6): купчините на ивицата пред склада, плацът с техниката отпред — отблизо, отдалеч, нощ', 'plovdiv', d => { setTimeout(() => d.whMatsCampus(6, 'both', 11, 26), 2500); setTimeout(() => d.whMatsCampus(6, 'both', 11, 70), 8000); setTimeout(() => d.whMatsCampus(6, 'both', 22, 26), 13000); }],   // wh-mats
  ['💡 Мигачите: преди завоя и при смяна на лента (автобусът към спирката; камерата следи кола пред завой)', 'sofia', d => { for (let k = 0; k < 8; k++) setTimeout(() => d.blinkLook(), 5000 + k * 7000); }],   // blink-lane (#42.2)
  ['🌃 Складовете нощем — вече не са черни кубове (редицата 1–10, 22:00)', 'plovdiv', d => setTimeout(() => { d.whRow(); setTimeout(() => d.time(22), 1500); }, 3000)],   // wh-night
  ['🚗 Движението расте с квартала: над застроеното — много коли и хора, над празното — малко (Пловдив: центърът, после най-празният край)', 'plovdiv', d => { setTimeout(() => d.growLook(false), 8000); setTimeout(() => d.growLook(true), 22000); setTimeout(() => d.growLook(false), 36000); }],   // traffic-grow (#42.8)
  ['⛽ Бензиностанциите — колонките към улицата (първата, после втората след 5 s)', 'sofia', d => { setTimeout(() => d.gasFaceLook(0), 1500); setTimeout(() => d.gasFaceLook(1), 6500); }],   // gas-face
  ['⚙️ Звук, известия, помощ, задачи, куести и съвети — в Настройки (⚙️ с брояч, когато чакат задачи/награди)', 'sofia', d => { setTimeout(() => d.settingsOpen(), 2500); }],   // top-set
  ['🏢 Блоковете нощем — цели прозорци, топли/хладни/телевизор (София: ден → 22:00 → 02:00)', 'sofia', d => { const go = hr => { d.time(hr); let t = null; d.city().group.traverse(o => { if (!t && o.userData && o.userData.src === 'sf-blk-soviet') t = o; }); if (t) { const p = t.getWorldPosition(t.position.clone()); d.camAt(p.x + 34, 22, p.z + 44, p.x, 9, p.z); } }; setTimeout(() => go(13), 3000); setTimeout(() => go(22), 9000); setTimeout(() => go(2), 16000); }],   // blk-night
  ['🏛️ Триумфалната арка (модел от Meshy) — ден, после нощ (Париж)', 'paris', d => { const go = () => { const L = d.city().landmarks, i = L.findIndex(o => o.kind === 'arc2'); if (i >= 0) d.lookLm(i, 90); }; setTimeout(go, 3000); setTimeout(() => { d.time(22); go(); }, 10000); }],   // lm-arc2
  ['🏨 5★ хотел в Париж — „Парижка елегантност“ (модел от Meshy)', 'paris', d => { setTimeout(() => d.hotel5City(2), 2500); }],   // hotel5-paris
  ['🏰 Кремъл от моделите от Meshy — облитане денем, после нощем (Москва)', 'moscow', d => { let a = 2.3, n = 0; const tick = () => { if (!d.kremlin(a, 300, 110)) { setTimeout(tick, 1500); return; } a += 0.4; n++; if (n === 16) d.time(22); if (n < 32) setTimeout(tick, 1700); }; setTimeout(tick, 3000); }],   // lm-kremlin2
  ['🏙️ „77% застроен“ в горната лента до „Империя“ — натисни го за „Завърши града“ (Пловдив)', 'plovdiv', d => { setTimeout(() => document.getElementById('btnBuilt')?.click(), 4000); }],   // top-built
  ['🚓 Задръстване/заклещени коли → известие „🚓 Извикай полиция“ + „🎥 гледай“ (натисни бутона — идва полицаят и разплита колите)', 'plovdiv', d => { setTimeout(() => d.jamCallTest(true), 7000); }],   // jam-call (#6)
  ['🧱 Тухлената двуетажна (building-a) — в истинска височина 9,5 м, в парцела (червеният куб — човек 1,8 м; Пловдив)', 'plovdiv', d => { setTimeout(() => d.bldALook(1), 3000); }],   // bld-a-real
  ['🅿️ Паркингът за колите на трафика: пътищата навън (жълто) и навътре (синьо), вратите на шофьорите (червено — заето, зелено — свободно; Пловдив)', 'plovdiv', d => { let k = 0; const go = () => { d.parkLook(k++ % Math.max(1, d.parks().list.length)); }; setTimeout(go, 3000); setInterval(go, 8000); }],   // park-api
  ['🚨 „Тръгвайте спешно“ — бутонът до „Откажи поръчката“: техниката за етапа веднага на обекта (Пловдив, таб „Обекти“)', 'plovdiv', d => { setTimeout(() => { document.querySelector('#tabs button[data-t=projects]')?.click(); document.querySelector('[data-urgent]')?.scrollIntoView({ block: 'center' }); }, 4000); }],   // urgent-btn
  ['🏢 Офисите building-e и building-f — в истинска височина 22 м (6–7 етажа), секция в парцела; на всеки 8 s — другата (Пловдив)', 'plovdiv', d => { let k = 0; const go = () => d.bldALook(1, k++ % 2 ? 'building-f' : 'building-e'); setTimeout(go, 3000); setInterval(go, 8000); }],   // bld-ef-real
  ['🚨 Полицейско преследване: беглецът кара бързо (изпреварва в насрещното), 1–3 полицейски коли със сирените го гонят, заклещват го — арест (камерата следва беглеца; Пловдив)', 'plovdiv', d => { setTimeout(() => d.chaseLook(), 6000); }],   // police-chase (#3)
  ['🚌 Съчлененият автобус на 2 секции — пречупва се в хармониката на завоите и кръговото (камерата го следва; Пловдив)', 'plovdiv', d => { setTimeout(() => d.articLook(4), 5000); let n = 0; const t = setInterval(() => { if (++n > 160) return clearInterval(t); d.articLook(4); }, 500); }],   // artic-bend (#4)
];
const PAGES = [['index.html', 'Играта от началото (отделен запис на :3610)'], ['online.html', 'Онлайн империя']];

const rejected = new Set((() => { try { return JSON.parse(localStorage.getItem('lab.rejected') || '[]'); } catch { return []; } })());   // „✖ Не е ОК“ — скрити, докато Claude не направи друго
let state = readHash(), approved = [], showDone = false, frameKey = 0;
function readHash() { const h = new URLSearchParams(location.hash.slice(1)); return { tab: h.get('tab') || 'review', item: h.get('item') || '' }; }
function pick(tab, item = '') { state = { tab, item }; const h = new URLSearchParams(state).toString(); if (location.hash.slice(1) !== h) location.hash = h; render(); }
addEventListener('hashchange', () => { const n = readHash(); if (n.tab !== state.tab || n.item !== state.item) { state = n; render(); } });

const post = (u, o) => fetch(u, { method: 'POST', body: JSON.stringify(o) }).then(r => r.json());
async function loadApproved() { try { approved = (await (await fetch('/__lab/approved')).json()).approved; } catch { approved = []; } }

function render() {
  const pending = FEATURES.filter(f => !approved.includes(f.id) && !rejected.has(f.id)).length;
  $('tabs').innerHTML = [['review', `Ново${pending ? ` (${pending})` : ''}`], ['scenes', 'Сцени'], ['models', '3D модели'], ['sounds', 'Звуци'], ['demos', 'Мисии/демо'], ['done', 'Проверени']]
    .map(([t, l]) => `<button data-tab="${t}" class="${state.tab === t ? 'on' : ''}">${l}</button>`).join('');
  $('tabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => pick(b.dataset.tab));
  if (state.tab !== 'models' && state.tab !== 'review' && state.tab !== 'done') closeModel();
  ({ review: () => renderReview('review'), done: () => renderReview('done'), scenes: renderScenes, models: renderModels, sounds: renderSounds, demos: renderDemos })[state.tab]?.();
}
const row = (on, title, sub, attr) => `<button class="row ${on ? 'on' : ''}" ${attr}>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
// списъкът вляво пази докъде е превъртян (иначе след клик на 20-ия ред скача пак на 1-ви)
const navScroll = {};
function sideNav(html) {
  const old = $('side').querySelector('nav'); if (old) navScroll[old.dataset.tab] = old.scrollTop;
  $('side').innerHTML = `<nav data-tab="${state.tab}">${html}</nav>`;
  const nv = $('side').querySelector('nav'); nv.scrollTop = navScroll[state.tab] || 0; nv.onscroll = () => { navScroll[state.tab] = nv.scrollTop; };
}

// ---- рамка с играта (+ лентата горе вдясно)
function frame(src, target, after) {
  $('main').innerHTML = `<iframe id="fr" src="${esc(src)}"></iframe><div class="bar low" id="bar"></div>`;   // долу вдясно — горе са бутоните на играта
  bar(target, [`<button class="btn" id="bRe">↻ Отначало</button>`, `<a class="btn" href="${esc(src)}" target="_blank">↗ Нов таб</a>`]);
  $('bRe').onclick = () => { frameKey++; frame(src, target, after); };
  if (after) $('fr').onload = () => {   // изчаква играта и пуска действието (__dbg)
    const w = $('fr').contentWindow, t0 = Date.now();
    const tick = () => { if (w.__dbg && w.__dbg.state && w.__dbg.state()?.cityId) setTimeout(() => { try { w.__dbg.time?.(13); after(w.__dbg); } catch (e) { console.warn(e); } }, 2500); else if (Date.now() - t0 < 60000) setTimeout(tick, 400); };
    tick();
  };
}
function bar(target, extra = []) { $('bar').innerHTML = `<span style="position:relative" id="fbWrap"><button class="btn sky" id="fbBtn">💬 Обратна връзка</button></span>${extra.join('')}`; feedback($('fbWrap'), target); }

// ---- „💬 Обратна връзка“ → lab-feedback.jsonl (Claude го чете от терминала)
const QUICK = [['🗑 Изтрий и замени с подобен', 'replace'], ['✨ По-хубав модел', 'better'], ['📏 Размер / позиция', 'size'], ['🎞 Анимация', 'anim'], ['👍 Добре е', 'ok']];
export function feedback(wrap, target) {
  let kind = '';
  wrap.querySelector('button').onclick = () => {
    const old = wrap.querySelector('.pop, .note'); if (old) { old.remove(); if (old.classList.contains('pop')) return; }
    const p = document.createElement('div'); p.className = 'pop';
    p.innerHTML = `<div class="for" title="${esc(target)}">За: ${esc(target)}</div><div class="chips">${QUICK.map(([l, k]) => `<button data-k="${k}">${l}</button>`).join('')}</div>
      <textarea placeholder="Какво да се промени? (по желание) — Ctrl+Enter изпраща"></textarea><div class="act"><button class="btn">Отказ</button><button class="btn ok" disabled>Изпрати на Claude</button></div>`;
    wrap.appendChild(p);
    const ta = p.querySelector('textarea'), [cancel, send] = p.querySelectorAll('.act button'), upd = () => send.disabled = !kind && !ta.value.trim();
    p.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kind = kind === b.dataset.k ? '' : b.dataset.k; p.querySelectorAll('[data-k]').forEach(x => x.classList.toggle('on', x.dataset.k === kind)); upd(); });
    ta.oninput = upd; ta.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !send.disabled) send.click(); };
    cancel.onclick = () => p.remove();
    send.onclick = () => post('/__lab/feedback', { target, kind, text: ta.value }).then(() => note('✓ Изпратено на Claude'), () => note('⚠ Не стигна — пиши в терминала'));
    const note = t => { p.remove(); const n = document.createElement('div'); n.className = 'note'; n.textContent = t; wrap.appendChild(n); setTimeout(() => n.remove(), 4000); kind = ''; };
    ta.focus();
  };
}

// ---- Ново
// „Ново“ — само чакащите одобрение; „Проверени“ (след „Мисии/демо“) — одобрените (✅) и отхвърлените (✖), по искане на играча
function renderReview(tab = 'review') {
  const wait = FEATURES.filter(f => !approved.includes(f.id) && !rejected.has(f.id)), ok = FEATURES.filter(f => approved.includes(f.id)), no = FEATURES.filter(f => rejected.has(f.id) && !approved.includes(f.id)), pending = wait.length;
  const head = (t, n, col) => `<div style="margin:12px 6px 4px;font-size:12px;font-weight:800;color:${col};text-transform:uppercase;letter-spacing:.04em">${t} (${n})</div>`;
  const mini = (f, ico, sub) => `<button class="row ${state.item === f.id ? 'on' : ''}" data-f="${f.id}" style="padding:5px 10px;min-height:0">${ico} ${esc(f.title)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  if (tab === 'review') sideNav(wait.map(f => row(state.item === f.id, `🧪 ${f.title}`, 'Чака OK', `data-f="${f.id}"`)).join('')
    + (!pending ? `<div class="empty" style="height:auto;padding:16px 8px">${FEATURES.length ? 'Всичко ново е проверено ✓ (одобрените и отхвърлените са в „Проверени“)' : 'Още няма нищо ново за проверка.'}</div>` : ''));
  else sideNav((ok.length ? head('✅ Одобрени', ok.length, 'var(--ok, #4caf50)') + `<div id="labOk" style="${showDone ? '' : 'max-height:260px;overflow:auto'}">${ok.slice().reverse().map(f => mini(f, '✅', '')).join('')}</div>` + (ok.length > 8 ? `<button class="row" id="bDone"><small>${showDone ? '▴ По-кратко' : '▾ Целия списък'}</small></button>` : '') : '')
    + (no.length ? head('✖ Не са ОК', no.length, 'var(--bad, #e57373)') + no.map(f => mini(f, '✖', 'отхвърлено — чака друго')).join('') : '') + (!ok.length && !no.length ? '<div class="empty" style="height:auto;padding:16px 8px">Още няма проверени.</div>' : ''));
  $('side').querySelectorAll('[data-f]').forEach(b => b.onclick = () => pick(tab, b.dataset.f));
  if ($('bDone')) $('bDone').onclick = () => { showDone = !showDone; render(); };
  const f = FEATURES.find(x => x.id === state.item);
  if (!f) { $('main').innerHTML = tab === 'done' ? `<div class="empty">Тук са проверените: избери отляво, за да го видиш пак или да го махнеш от играта.</div>` : `<div class="empty">Новото чака проверка: избери отляво, пробвай и натисни „✓ OK“ — тогава влиза в играта.</div>`; return; }
  const fh = (f.url || '').startsWith('#') ? new URLSearchParams(f.url.slice(1)) : null, mUrl = fh && fh.get('tab') === 'models' ? fh.get('item') : null, sUrl = fh && fh.get('tab') === 'sounds' ? fh.get('item') : null;
  if (sUrl) {   // нов звук: пуска се тук, с „✓ OK“ отдолу
    closeModel();
    $('main').innerHTML = `<div class="snd"><h2>${esc(sUrl.replace(/^s:/, ''))}</h2><small style="color:var(--mut)">${sUrl.startsWith('s:') ? 'синтезиран в sound.js — новата версия' : esc(sUrl)}</small><button class="btn ok" id="bPlay">▶ Пусни</button></div><div class="bar" id="bar"></div>`;
    bar(`Ново: ${f.title} (${f.id})`);
    $('bPlay').onclick = () => play(sUrl);
  } else if (mUrl) {   // нов модел: показва се тук, в „Ново“ (с „✓ OK“) — не в „3D модели“, където „Одобри“ е само „прегледан“
    $('main').innerHTML = `<div id="view" style="position:absolute;inset:0"></div><div class="bar" id="bar"></div>`;
    bar(`Ново: ${f.title} (${f.id})`, [`<button class="btn" id="bWire">Мрежа</button>`, `<button class="btn" id="bBg">Светъл фон</button>`]);
    openModel($('view'), mUrl);
  } else if (!fh) { closeModel(); frame(f.url || 'index.html', `Ново: ${f.title} (${f.id})`); }
  else {   // демо или сцена от другите раздели — също тук, за да е до „✓ OK“
    closeModel();
    const it = fh.get('item') || '', tb = fh.get('tab');
    if (tb === 'demos' && /^d\d+$/.test(it) && DEMOS[+it.slice(1)]) { const [, c, fn] = DEMOS[+it.slice(1)]; frame(`${GAME}&plan=1&city=${c}`, `Ново: ${f.title} (${f.id})`, fn); }
    else if (tb === 'demos' && it) frame(it, `Ново: ${f.title} (${f.id})`);
    else if (tb === 'scenes' && it) frame(`${GAME}&plan=1&city=${it}`, `Ново: ${f.title} (${f.id})`);
    else { location.hash = f.url.slice(1); return; }
  }
  const box = document.createElement('div'); box.className = 'feat';
  const on = approved.includes(f.id);
  box.innerHTML = `<div><b>${esc(f.title)}</b><div>${esc(f.how)}</div></div><div style="display:flex;flex-direction:column;gap:6px">${on ? `<button class="btn" id="bApp">↩ Махни от играта</button>` : `<button class="btn ok" id="bApp">✓ OK — в играта</button><button class="btn red" id="bRej">✖ Не е ОК — намери друго</button>`}<button class="btn sky" id="bChg">✏️ Промени / добави</button></div>`;
  $('main').appendChild(box);
  if (f.views && f.views.length > 1) {   // няколко неща за гледане (напр. 3 кули) — бутони в кутията
    const vb = document.createElement('div'); vb.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
    vb.innerHTML = f.views.map(([nm, d], i) => `<button class="btn${i === 0 ? ' ok' : ''}" data-view="${d}">${esc(nm)}</button>`).join('');
    box.querySelector('div').appendChild(vb);
    vb.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
      vb.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('ok', x === b));
      const [, c, fn] = DEMOS[+b.dataset.view.slice(1)]; const keep = $('main').querySelector('.feat'); frame(`${GAME}&plan=1&city=${c}`, `Ново: ${f.title} (${f.id})`, fn); $('main').appendChild(keep);
    });
  }
  // „✏️ Промени / добави“: какво да се промени или добави към това — задача за Claude (lab-feedback.jsonl); нещото остава в „Ново“
  $('bChg').onclick = () => {
    if (box.querySelector('.chg')) return;
    const w = document.createElement('div'); w.className = 'chg'; w.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px;width:100%';
    w.innerHTML = `<textarea rows="3" placeholder="Какво да се промени или добави? Напр. „по-малко коли“, „и автобуси“, „мигачите по-ярки“…" style="width:100%;box-sizing:border-box;background:#11151b;color:#e8e8ea;border:1px solid #39404b;border-radius:6px;padding:6px;font:inherit"></textarea><div style="display:flex;gap:6px;align-items:center"><button class="btn sky">📨 Изпрати на Claude</button><button class="btn dim">Отказ</button><span class="meta"></span></div>`;
    box.querySelector('div').appendChild(w);
    const ta = w.querySelector('textarea'), [send, cancel] = w.querySelectorAll('button'), note = w.querySelector('.meta'); ta.focus();
    cancel.onclick = () => w.remove();
    send.onclick = () => { if (!ta.value.trim()) { ta.focus(); return; } send.disabled = true;
      post('/__lab/feedback', { target: `Ново: ${f.title} (${f.id})`, kind: 'change', text: ta.value.trim() }).then(() => { note.textContent = '✓ Изпратено на Claude'; ta.disabled = true; setTimeout(() => w.remove(), 1600); }, () => { note.textContent = '⚠ Не стигна — пиши в терминала'; send.disabled = false; }); };
  };
  if ($('bRej')) $('bRej').onclick = () => {   // отхвърлено: задача за Claude (lab-feedback.jsonl) и изчезва от „Ново“
    const why = prompt('Какво не е наред? (по желание)') || '';
    post('/__lab/feedback', { target: `Ново: ${f.title} (${f.id})`, kind: 'reject', text: 'Не е ОК — намери друго' + (why ? ': ' + why : '') }).catch(() => { });
    rejected.add(f.id); try { localStorage.setItem('lab.rejected', JSON.stringify([...rejected])); } catch { }
    const nx = tab === 'review' ? FEATURES.find(x => !approved.includes(x.id) && !rejected.has(x.id)) : f; pick(tab, nx ? nx.id : '');
  };
  $('bApp').onclick = () => post('/__lab/approved', { id: f.id, ok: !on }).then(j => {
    approved = j.approved;
    if (!on && mUrl) post('/__lab/feedback', { target: `Модел: ${mUrl}`, kind: 'reviewed', text: '' }).catch(() => { });   // и в „3D модели“ — като одобрен
    if (!on && tab === 'review') { const nx = FEATURES.find(x => !approved.includes(x.id) && !rejected.has(x.id)); pick('review', nx ? nx.id : ''); } else render();
  });
}

// ---- Сцени
function renderScenes() {
  sideNav(`<div class="grp">Инструменти</div>` + row(state.item === 'editor', '🛠️ Редактор на градове', '3D модели от assets · подреждане по парцели', 'data-editor')
    + `<div class="grp">Градове <i>(нова игра с план)</i></div>` + SCENES.map(([id, nm, sub]) => row(state.item === id, nm, sub, `data-c="${id}"`)).join(''));
  $('side').querySelector('[data-editor]').onclick = () => pick('scenes', 'editor');
  $('side').querySelectorAll('[data-c]').forEach(b => b.onclick = () => pick('scenes', b.dataset.c));
  if (state.item === 'editor') { frame('plan.html', 'Lab: редактор на градове'); return; }
  if (!state.item) { $('main').innerHTML = `<div class="empty">Избери редактора или град отляво — редакторът отваря 3D плановете, а градовете зареждат нова игра с план.</div>`; return; }
  frame(`${GAME}&plan=1&city=${state.item}`, `Сцена: ${state.item}`);
}

// ---- Мисии/демо
const demoOk = nm => ['reviewed', 'done'].includes(mstatus.status['demo:' + nm]?.state);   // ✓ одобрено в „Мисии/демо“
function renderDemos() {
  if (!renderDemos.loaded) { renderDemos.loaded = 1; fetch('/__lab/status').then(r => r.json()).then(s => { mstatus = s; if (state.tab === 'demos') renderDemos(); }).catch(() => { }); }
  sideNav(`<label class="chk" style="display:block;margin:6px 10px"><input type="checkbox" id="hideOkD" ${hideOk ? 'checked' : ''}> Скрий одобрените</label><div class="grp">В града <i>(действие след зареждане)</i></div>` + DEMOS.map(([nm, c], i) => hideOk && demoOk(nm) && state.item !== 'd' + i ? '' : row(state.item === 'd' + i, (demoOk(nm) ? '✓ ' : '') + nm, c, `data-d="d${i}"`)).join('')
    + `<div class="grp">Страници</div>` + PAGES.map(([u, nm]) => row(state.item === u, nm, u, `data-d="${u}"`)).join(''));
  $('side').querySelectorAll('[data-d]').forEach(b => b.onclick = () => pick('demos', b.dataset.d));
  if (!state.item) { $('main').innerHTML = `<div class="empty">Избери отляво — градът се зарежда и Лабораторията сама отива до мястото (__dbg).</div>`; return; }
  $('hideOkD').onchange = e => { hideOk = e.target.checked; try { localStorage.setItem('lab.hideReviewed', hideOk ? '1' : '0'); } catch { } renderDemos(); };
  if (state.item.startsWith('d')) { const [nm, c, fn] = DEMOS[+state.item.slice(1)] || []; if (fn) { frame(`${GAME}&plan=1&city=${c}`, `Демо: ${nm}`, fn); demoOkBtn(nm); } }
  else frame(state.item, `Страница: ${state.item}`);
}
// бутонът „✓ Одобри“ в лентата на демото: записва се (/__lab/feedback → status 'demo:…') и демото изчезва от списъка, ако „Скрий одобрените“ е включено
function demoOkBtn(nm) {
  const ok = demoOk(nm), b = document.createElement('button'); b.className = 'btn ' + (ok ? 'dim' : 'ok'); b.textContent = ok ? '✓ Одобрено' : '✓ Одобри'; b.disabled = ok;
  b.onclick = () => post('/__lab/feedback', { target: `Демо: ${nm}`, kind: 'reviewed', text: '' }).then(() => { mstatus.status['demo:' + nm] = { state: 'reviewed', at: new Date().toISOString() }; b.textContent = '✓ Одобрено'; b.className = 'btn dim'; b.disabled = true; const r = $('side').querySelector(`[data-d="${state.item}"]`); if (r && hideOk) r.remove(); }).catch(() => { b.textContent = '⚠ не стигна'; });
  $('bar').prepend(b);
}

// ---- 3D модели
let models = null, mstatus = { status: {}, hidden: [] }, q = '', hideOk = (() => { try { return localStorage.getItem('lab.hideReviewed') !== '0'; } catch { return true; } })(), stTimer = 0;
async function renderModels() {
  $('side').innerHTML = `<input class="q" id="q" placeholder="Търси…" value="${esc(q)}"><label class="chk"><input type="checkbox" id="hideOk" ${hideOk ? 'checked' : ''}> Скрий одобрените</label><nav id="mlist"></nav>`;
  $('q').oninput = e => { q = e.target.value; listModels(); };
  $('hideOk').onchange = e => { hideOk = e.target.checked; try { localStorage.setItem('lab.hideReviewed', hideOk ? '1' : '0'); } catch { } listModels(); };
  if (!models) { try { models = await (await fetch('/__lab/models')).json(); } catch { models = []; } }
  const tick = () => fetch('/__lab/status').then(r => r.json()).then(s => { mstatus = s; if (state.tab === 'models') listModels(); }).catch(() => { });
  clearInterval(stTimer); stTimer = setInterval(() => state.tab === 'models' ? tick() : clearInterval(stTimer), 4000); tick();
  listModels();
  if (!state.item) { $('main').innerHTML = `<div class="empty">Избери модел отляво — върти се с мишката, долу са анимациите му.</div>`; return; }
  $('main').innerHTML = `<div id="view" style="position:absolute;inset:0"></div><div class="bar" id="bar"></div>`;
  modelBar(state.item);
  openModel($('view'), state.item);
}
function listModels() {
  const el = $('mlist'); if (!el || !models) return;
  const st = el.scrollTop || navScroll.models || 0; el.onscroll = () => { navScroll.models = el.scrollTop; };
  $('q').placeholder = `Търси (${models.length} модела)…`;
  const groups = new Map();
  for (const e of models) {
    if (mstatus.hidden.includes(e.path)) continue;
    if (hideOk && ['reviewed', 'done'].includes(mstatus.status[e.path]?.state)) continue;
    if (q && !e.path.toLowerCase().includes(q.toLowerCase())) continue;
    const dir = e.path.split('/').slice(2, -1).join('/') || '·'; if (!groups.has(dir)) groups.set(dir, []); groups.get(dir).push(e);
  }
  const ico = { working: '⏳ ', ready: '🆕 ', reviewed: '✓ ' };
  el.innerHTML = [...groups].map(([dir, list]) => `<div class="grp">${esc(dir)} <i>(${list.length})</i></div>` + list.map(e => {
    const st = mstatus.status[e.path]?.state || '';
    return `<button class="mrow ${state.item === e.path ? 'on' : st}" data-m="${esc(e.path)}"><span>${ico[st] || ''}${esc(e.path.split('/').pop().replace(/\.glb$/, ''))}</span><span>${kb(e.size)}</span></button>`;
  }).join('')).join('');
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => pick('models', b.dataset.m));
  el.scrollTop = st;
}
function modelBar(url) {
  const reviewed = mstatus.status[url]?.state === 'reviewed';
  bar(`Модел: ${url}`, [
    `<button class="btn ${reviewed ? 'dim' : 'ok'}" id="bRev" ${reviewed ? 'disabled' : ''}>${reviewed ? '✓ Одобрен' : '✓ Одобри'}</button>`,
    `<button class="btn red" id="bRep" title="Claude ще намери по-хубав подобен модел (CC0/CC BY), ще го сложи в Лабораторията и ще махне този">🗑 Изтрий и намери нов</button>`,
    `<span style="position:relative" id="delWrap"><button class="btn" id="bDel" style="color:#fca5a5">🗑 Изтрий</button></span>`,
    `<button class="btn" id="bWire">Мрежа</button>`, `<button class="btn" id="bBg">Светъл фон</button>`]);
  $('bRev').onclick = () => post('/__lab/feedback', { target: `Модел: ${url}`, kind: 'reviewed', text: '' }).then(async () => {
    // моделът чака подмяна (replacements.json) — „Одобри“ тук = „✓ OK“ в „Ново“: новият файл влиза в играта
    try { const reps = await (await fetch('/lab/replacements.json?x=' + Date.now())).json(); const id = Object.keys(reps).find(k => reps[k].from === url); if (id) await post('/__lab/approved', { id, ok: true }); } catch (e) {} $('bRev').textContent = '✓ Одобрен'; $('bRev').className = 'btn dim'; $('bRev').disabled = true; });
  $('bRep').onclick = () => post('/__lab/feedback', { target: `Модел: ${url}`, kind: 'replace', text: 'Изтрий и намери нов подобен модел' }).then(() => { $('bRep').textContent = '✓ Claude търси нов'; $('bRep').disabled = true; });
  $('bDel').onclick = () => {
    $('delWrap').innerHTML = `<button class="btn red" id="bYes">Да, изтрий окончателно</button> <button class="btn" id="bNo">Не</button>`;
    $('bNo').onclick = () => modelBar(url);
    $('bYes').onclick = () => post('/__lab/delete', { url }).then(j => {
      if (j.ok) { models = models.filter(m => m.path !== url); pick('models', ''); }
      else $('delWrap').innerHTML = `<span class="btn dim">${j.used ? `⏳ Играта го ползва (${esc(j.used.join(', '))}) — Claude ще го махне от кода` : '⚠ ' + esc(j.error || 'грешка')}</span>`;
    });
  };
}

// ---- Звуци (sound.js синтезира ефектите с WebAudio; файловете са в assets/)
let sounds = null, Snd = null;
async function renderSounds() {
  if (!sounds) { try { sounds = await (await fetch('/__lab/sounds')).json(); } catch { sounds = { synth: [], files: [] }; } }
  sideNav(`<div class="grp">Ефекти <i>(sound.js, ${sounds.synth.length})</i></div>` + sounds.synth.map(n => `<button class="mrow ${state.item === 's:' + n ? 'on' : ''}" data-s="s:${n}"><span>▶ ${esc(n)}</span><span>синтез</span></button>`).join('')
    + `<div class="grp">Файлове <i>(${sounds.files.length})</i></div>` + sounds.files.map(f => `<button class="mrow ${state.item === f.path ? 'on' : ''}" data-s="${esc(f.path)}"><span>▶ ${esc(f.path.split('/').pop())}</span><span>${kb(f.size)}</span></button>`).join(''));
  $('side').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { pick('sounds', b.dataset.s); play(b.dataset.s); });
  if (!state.item) { $('main').innerHTML = `<div class="empty">Клик в списъка вляво пуска звука веднага.</div>`; return; }
  const s = state.item, synth = s.startsWith('s:');
  $('main').innerHTML = `<div class="snd"><h2>${esc(synth ? s.slice(2) : s.split('/').pop())}</h2><small style="color:var(--mut)">${synth ? 'синтезиран в sound.js — Sound.play(\'' + esc(s.slice(2)) + '\')' : esc(s)}</small>
    ${synth ? `<button class="btn ok" id="bPlay">▶ Пусни пак</button>` : `<audio src="${esc(s)}" controls></audio>`}<div style="position:relative" id="sfb"><button class="btn sky">💬 Обратна връзка</button></div></div>`;
  if (synth) $('bPlay').onclick = () => play(s);
  feedback($('sfb'), `Звук: ${synth ? s.slice(2) + ' (sound.js)' : s}`);
}
async function play(s) {
  if (s.startsWith('s:')) { if (!Snd) Snd = (await import('../sound.js')).Sound; Snd.init(); Snd.muted = false; Snd.play(s.slice(2)); }
  else { const a = new Audio(s); a.play().catch(() => { }); }
}

await loadApproved();
render();
