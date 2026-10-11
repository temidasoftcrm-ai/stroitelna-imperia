import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import * as ECON from './economy.js';
import { tintRoof } from './roofs.js';
import { DayNight, clockText } from './daynight.js';
import { Sound } from './sound.js';
import { createPassingTrains } from './passtrains.js';
import { createQuests } from './quests.js';
import { createSupply } from './supply.js';
import { saveKey, openSaves, currentSlot } from './saves.js';
import { createTutorial } from './tutorial.js';
import { createMega } from './megaorders.js';
import { createRivals, LOCAL_FIRMS, FIRMS } from './rivals.js';
import { createDevLevel } from './devlevel.js';
import { RAIL_STAGES, railStageOf, buildRailView } from './railbuild.js';
import { createStation, STATION_LEVELS } from './station.js';
import { createResorts, RESORTS, seasonOf, monthName } from './resorts.js';
import { buildResortView, CHALET_PIECES, RESORT_MODELS } from './resortview.js';
import { createDemolition } from './demolish.js';
import { createEvents } from './events.js';
import { createWeather, rollWeather } from './weather.js';
import { bidHtml, resolveBid } from './bidding.js';
import { addSiteLights, setSiteLightsNight } from './sitelights.js';
import { createHwTraffic } from './hwtraffic.js';
import { addRouteScenery } from './scenery.js';
import { addSeaside, SEASIDE, SEA_MODELS } from './seaside.js';
import { monthOf } from './resorts.js';
import { SKY_BANDS, SKY_BANDS_MODERN, makeTall, makeTallCopy } from './tall.js';
import { buildAirport as makeAirport3D, loadAirModels } from './airport.js';
import { createTenders, TENDERS } from './tenders.js';
import { buildUniversity, buildPortTerminal } from './tender3d.js';
import { CITY_LANDMARKS, LANDMARK_CENTER, buildLandmark } from './landmarks.js';
import { OFFICE_STYLES, STYLE_LV, STYLE_COST, buildOfficeTower } from './officestyle.js';
import { shipRange, PORT_LEVELS, portMax, SHIPS, seaKm, seaPath, SEA_ROUTE_COST, voyagePay, shipDaily, SEA_LV } from './seaways.js';
import { makeTrackMap, placeCars } from './trackpath.js';
import { airportMax, AIRPORT_LEVELS, PLANES, ROUTE_COST, airKm, flightPay, planeDaily, WORLD, WORLD_IDS } from './airways.js';
import { MUNI_SHARE, linkPrices, buyoutPrice } from './linkoffers.js';
import { EXTRA_BALKAN, EXTRA_EUROPE, EXTRA_WORLD, COUNTRIES, countryProgress, wonCountries, wonIncomeMul, countryLabelLL } from './countries.js';
import { AFRICA, AFRICA_COUNTRIES, AFRICA_COASTAL, AFRICA_IDS, isAfrica } from './africa.js';
import { RUSSIA, RUSSIA_COUNTRY, RUSSIA_COASTAL } from './russia.js';
import { UKRAINE, UKRAINE_COUNTRY, UKRAINE_COASTAL } from './ukraine.js';
import { OCEANIA, OC_COUNTRIES, OC_COASTAL, OC_IDS, ocOpen, ocLockTxt } from './oceania.js';
import { ASIA, AS_COUNTRIES, AS_COASTAL, AS_IDS, AS_NEW, asOpen, asLockTxt } from './asia.js';
import { SAMERICA, SA_COUNTRIES, SA_COASTAL, SA_IDS, SA_NEW, saOpen, saLockTxt } from './samerica.js';
import { NAMERICA, NA_COUNTRIES, NA_COASTAL, NA_IDS, NA_NEW, naOpen, naLockTxt } from './namerica.js';
import { AUTOBAHNS, AB_UNLOCK, AB_STAGES_DEF, abSegs, corridorSegIds, viaOf, abSegId } from './corridors.js';
// autobahn.js (3D изглед и константи на аутобаните) — по избор: докато го няма, се ползват резервните стойности
let AB = null;
import('./autobahn.js').then(m => { AB = m; }).catch(() => {});
import { HIGHWAYS, HW_STAGES, HW_NEED_OLD, HW_FLEET, HW_REP, HW_MODELS, TOLL_PER_KM_DAY, segId, segmentQuote, buildHighwayView } from './highways.js';
import { createTirs } from './trucks.js';
import { createOrient } from './orient.js';
import { createRoute66 } from './route66.js';
import { loadTrainModels, hasTrainModel, trainCar } from './trainmodels.js';
import { loadVehModels } from './vehmodels.js';
import { openGlobe } from './globe.js';
import { applyRoadLook, makeCrosswalks } from './roadlook.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const AUTOTEST = params.has('autotest');
const SAVE_KEY = saveKey();   // зависи от текущия слот (saves.js)
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const fmt = n => Math.round(n).toLocaleString('bg-BG').replace(/ /g, ' ');
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// ============================================================ градове на картата
const CITIES = [
  { id: 'sofia', nm: 'София', lat: 42.698, lon: 23.322, sz: 3 },
  { id: 'plovdiv', nm: 'Пловдив', lat: 42.135, lon: 24.745, sz: 3 },
  { id: 'varna', nm: 'Варна', lat: 43.214, lon: 27.915, sz: 3 },
  { id: 'burgas', nm: 'Бургас', lat: 42.505, lon: 27.463, sz: 2 },
  { id: 'ruse', nm: 'Русе', lat: 43.836, lon: 25.966, sz: 2 },
  { id: 'stz', nm: 'Стара Загора', lat: 42.426, lon: 25.635, sz: 2 },
  { id: 'pleven', nm: 'Плевен', lat: 43.417, lon: 24.607, sz: 2 },
  { id: 'vt', nm: 'Велико Търново', lat: 43.076, lon: 25.617, sz: 1 },
  { id: 'blg', nm: 'Благоевград', lat: 42.021, lon: 23.094, sz: 1 },
  { id: 'shumen', nm: 'Шумен', lat: 43.271, lon: 26.923, sz: 1 },
  { id: 'dobrich', nm: 'Добрич', lat: 43.573, lon: 27.827, sz: 1 },
  { id: 'sliven', nm: 'Сливен', lat: 42.682, lon: 26.323, sz: 1 },
  { id: 'haskovo', nm: 'Хасково', lat: 41.934, lon: 25.555, sz: 1 },
  { id: 'vidin', nm: 'Видин', lat: 43.996, lon: 22.868, sz: 1 },
  { id: 'vratsa', nm: 'Враца', lat: 43.210, lon: 23.553, sz: 1 },
  { id: 'kardzhali', nm: 'Кърджали', lat: 41.650, lon: 25.367, sz: 1 },
  { id: 'pernik', nm: 'Перник', lat: 42.605, lon: 23.038, sz: 1, left: true },
  { id: 'gabrovo', nm: 'Габрово', lat: 42.874, lon: 25.319, sz: 1 },
  { id: 'pazardzhik', nm: 'Пазарджик', lat: 42.193, lon: 24.334, sz: 1, left: true },
  { id: 'montana', nm: 'Монтана', lat: 43.409, lon: 23.226, sz: 1 },
];
// съседни държави: столици и големи градове (филиали изискват 3 ★ и са по-скъпи)
const FOREIGN = [
  { id: 'istanbul', nm: 'Истанбул', lat: 41.008, lon: 28.978, sz: 3, cc: '🇹🇷' },
  { id: 'edirne', nm: 'Одрин', lat: 41.677, lon: 26.556, sz: 1, cc: '🇹🇷' },
  { id: 'ankara', nm: 'Анкара', lat: 39.933, lon: 32.860, sz: 3, cc: '🇹🇷', left: true },
  { id: 'bucharest', nm: 'Букурещ', lat: 44.427, lon: 26.103, sz: 3, cc: '🇷🇴' },
  { id: 'constanta', nm: 'Констанца', lat: 44.173, lon: 28.638, sz: 2, cc: '🇷🇴' },
  { id: 'belgrade', nm: 'Белград', lat: 44.787, lon: 20.457, sz: 3, cc: '🇷🇸' },
  { id: 'nis', nm: 'Ниш', lat: 43.320, lon: 21.896, sz: 2, cc: '🇷🇸' },
  { id: 'skopje', nm: 'Скопие', lat: 41.998, lon: 21.425, sz: 3, cc: '🇲🇰' },
  { id: 'thessaloniki', nm: 'Солун', lat: 40.640, lon: 22.944, sz: 2, cc: '🇬🇷' },
  { id: 'athens', nm: 'Атина', lat: 37.984, lon: 23.728, sz: 3, cc: '🇬🇷' },
];
// Европа: отключва се на ниво 8 на развитие
const EUROPE = [
  { id: 'paris', nm: 'Париж', lat: 48.857, lon: 2.352, sz: 3, cc: '🇫🇷' },
  { id: 'london', nm: 'Лондон', lat: 51.507, lon: -0.128, sz: 3, cc: '🇬🇧', left: true },
  { id: 'amsterdam', nm: 'Амстердам', lat: 52.370, lon: 4.895, sz: 3, cc: '🇳🇱' },
  { id: 'hague', nm: 'Хага', lat: 52.070, lon: 4.300, sz: 2, cc: '🇳🇱', left: true },
  { id: 'rotterdam', nm: 'Ротердам', lat: 51.924, lon: 4.478, sz: 2, cc: '🇳🇱' },
  { id: 'luxembourg', nm: 'Люксембург', lat: 49.611, lon: 6.130, sz: 2, cc: '🇱🇺', left: true },
  { id: 'brussels', nm: 'Брюксел', lat: 50.850, lon: 4.352, sz: 3, cc: '🇧🇪' },
  { id: 'berlin', nm: 'Берлин', lat: 52.520, lon: 13.405, sz: 3, cc: '🇩🇪' },
  { id: 'prague', nm: 'Прага', lat: 50.075, lon: 14.438, sz: 3, cc: '🇨🇿' },
  { id: 'vienna', nm: 'Виена', lat: 48.208, lon: 16.373, sz: 3, cc: '🇦🇹' },
  { id: 'budapest', nm: 'Будапеща', lat: 47.498, lon: 19.040, sz: 3, cc: '🇭🇺' },
  { id: 'warsaw', nm: 'Варшава', lat: 52.230, lon: 21.012, sz: 3, cc: '🇵🇱' },
  { id: 'rome', nm: 'Рим', lat: 41.903, lon: 12.496, sz: 3, cc: '🇮🇹' },
  { id: 'milan', nm: 'Милано', lat: 45.464, lon: 9.190, sz: 3, cc: '🇮🇹' },
  { id: 'madrid', nm: 'Мадрид', lat: 40.417, lon: -3.704, sz: 3, cc: '🇪🇸' },
  { id: 'barcelona', nm: 'Барселона', lat: 41.385, lon: 2.173, sz: 3, cc: '🇪🇸' },
  { id: 'zurich', nm: 'Цюрих', lat: 47.377, lon: 8.541, sz: 2, cc: '🇨🇭' },
  { id: 'munich', nm: 'Мюнхен', lat: 48.135, lon: 11.582, sz: 3, cc: '🇩🇪' },
];
// по 5 града на държава (countries.js) — за завладяването на държави
FOREIGN.push(...EXTRA_BALKAN); EUROPE.push(...EXTRA_EUROPE);
// 🇷🇺 Русия (russia.js) — част от Европа
for (const c of RUSSIA) if (!EUROPE.some(x => x.id === c.id)) EUROPE.push(c);
if (!COUNTRIES.some(x => x.iso === 'RUS')) COUNTRIES.push(RUSSIA_COUNTRY);
for (const id of RUSSIA_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
// 🇺🇦 Украйна (ukraine.js) — част от Европа
for (const c of UKRAINE) if (!EUROPE.some(x => x.id === c.id)) EUROPE.push(c);
if (!COUNTRIES.some(x => x.iso === 'UKR')) COUNTRIES.push(UKRAINE_COUNTRY);
for (const id of UKRAINE_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
for (const c of EXTRA_WORLD) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
// 🌍 Фаза Африка (africa.js): градовете са част от света (ниво 10), държавите се завладяват, крайморските имат бряг
for (const c of AFRICA) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
for (const k of AFRICA_COUNTRIES) if (!COUNTRIES.some(x => x.iso === k.iso)) COUNTRIES.push(k);
for (const id of AFRICA_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
// 🗽 Фаза Северна Америка (namerica.js)
for (const c of NAMERICA) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
for (const k of NA_COUNTRIES) if (!COUNTRIES.some(x => x.iso === k.iso)) COUNTRIES.push(k);
for (const id of NA_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
// 🌎 Фаза Южна Америка (samerica.js)
for (const c of SAMERICA) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
for (const k of SA_COUNTRIES) if (!COUNTRIES.some(x => x.iso === k.iso)) COUNTRIES.push(k);
for (const id of SA_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
// 🌏 Фаза Азия (asia.js)
for (const c of ASIA) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
for (const k of AS_COUNTRIES) if (!COUNTRIES.some(x => x.iso === k.iso)) COUNTRIES.push(k);
for (const id of AS_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
// 🦘 Фаза Австралия и Океания (oceania.js)
for (const c of OCEANIA) if (!WORLD.some(w => w.id === c.id)) { WORLD.push(c); WORLD_IDS.add(c.id); }
for (const k of OC_COUNTRIES) if (!COUNTRIES.some(x => x.iso === k.iso)) COUNTRIES.push(k);
for (const id of OC_COASTAL) if (!SEASIDE.includes(id)) SEASIDE.push(id);
CITIES.push(...FOREIGN, ...EUROPE, ...WORLD);
// чуждите фирми конкуренти (rivals.js) са и на борсата: виждаш тези от държавите, където имаш филиал (economy.js hooks.stockVisible)
const LEGAL = { '🇩🇪': 'AG', '🇦🇹': 'AG', '🇨🇭': 'AG', '🇫🇷': 'SA', '🇧🇪': 'SA', '🇱🇺': 'SA', '🇬🇧': 'plc', '🇮🇹': 'S.p.A.', '🇪🇸': 'S.A.', '🇺🇸': 'Inc.', '🇨🇦': 'Inc.', '🇯🇵': 'K.K.', '🇳🇱': 'N.V.', '🇵🇱': 'S.A.', '🇨🇿': 'a.s.', '🇹🇷': 'A.Ş.' };
for (const [cc, list] of [['🇧🇬', FIRMS], ...Object.entries(LOCAL_FIRMS)]) for (const f of list) if (!ECON.COMPANIES.some(c => c.id === 'f-' + f.id))
  ECON.COMPANIES.push({ id: 'f-' + f.id, nm: `${f.nm} ${LEGAL[cc] || 'АД'}`, ico: cc, cc, sector: 'строителство', price: Math.round(15 + f.power * 70), vol: +(0.016 + (1 - f.power) * 0.02).toFixed(3), drift: +(0.0003 + f.power * 0.0005).toFixed(4), div: 0.003,
    shares: 150000, subDaily: Math.round(f.power * 14000 / 500) * 500, gets: '2 бригади, багер, самосвал, 2 къщи и офис сграда под наем' });
const isWorld = id => WORLD_IDS.has(id);
const isEurope = id => EUROPE.some(c => c.id === id);
// начални градове (ниво 1); останалите български — от ниво 2
const START_CITIES = ['sofia', 'plovdiv', 'stz', 'varna'];
// какво ниво на развитие изисква градът (за филиал и жп линия)
const cityLv = id => isWorld(id) ? 10 : isEurope(id) ? 8 : isForeign(id) ? 5 : START_CITIES.includes(id) ? 1 : 2;
const lockTxt = n => `🔒 Нужно е <b>ниво ${n} на развитие</b> (най-развитият ти град е ниво ${dev.best()}).`;
const isForeign = id => FOREIGN.some(c => c.id === id) || EUROPE.some(c => c.id === id) || WORLD_IDS.has(id);
const FOREIGN_REP = 3;
let mapWide = false;   // 🌍 изглед с Балканите
let mapEU = false;     // 🇪🇺 изглед с Европа
let mapWorld = false;  // 🌐 изглед със света (включва mapEU)
let mapPicked = false;   // изгледът е избран с бутоните — не го сменяме автоматично
let mapCont = null;    // 🌍/🗽 изглед с континент (включва mapWorld): ключ от CONTS — 'af', 'na'
// при приближаване знаците и надписите на картата не растат заедно с нея (иначе картата се задръства)
const mapZoom = () => mapView ? mapView.base[2] / mapView.vb[2] : 1;
const zShrink = () => Math.pow(Math.max(1, mapZoom()), -0.8);
const mapLS = () => zShrink() * 0.85;   // мащаб на надписите (и малко по-малки по принцип)
const mapK = () => (mapCont ? (viewOf(mapCont).k || 2.4) : mapWorld ? 6 : 1) * zShrink();   // допълнителен мащаб на знаците (световният изглед и приближаването)
let worldGeo = null;   // assets/data/world.json — зарежда се при първия световен изглед
// подвижна карта: viewBox се мести (влачене) и мащабира (колелце / щипване / бутони)
let mapView = null;
// точка на екрана → координати в картата
function svgPt(cx, cy) { const svg = $('mapSvg'), pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function zoomAt(cx, cy, f) {
  if (!mapView) return;
  const p = svgPt(cx, cy), [x, y, w, h] = mapView.vb, bw = mapView.base[2];
  const nw = Math.min(bw * 1.6, Math.max(bw / 6, w * f)), k = nw / w;
  mapView.vb = [p.x - (p.x - x) * k, p.y - (p.y - y) * k, nw, h * k];
  $('mapSvg').setAttribute('viewBox', mapView.vb.join(' '));
  clearTimeout(zoomAt.t); zoomAt.t = setTimeout(() => { if (!$('mapScreen').classList.contains('hidden')) drawMap(); }, 120);   // знаците се преоразмеряват
}
{
  const svg = document.getElementById('mapSvg'), ptrs = new Map();
  let drag = null, pinch = 0, moved = false;
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vb: [...mapView.vb], m: svg.getScreenCTM() };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; }
  });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(d - pinch) > 4) { zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch / d); pinch = d; moved = true; }
    } else if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      if (!moved) svg.setPointerCapture(e.pointerId);
      moved = true;
      mapView.vb = [drag.vb[0] - dx / drag.m.a, drag.vb[1] - dy / drag.m.d, drag.vb[2], drag.vb[3]];
      svg.setAttribute('viewBox', mapView.vb.join(' '));
      svg.style.cursor = 'grabbing';
    }
  });
  const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) { drag = null; svg.style.cursor = ''; } };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  // след влачене кликът не отваря град
  svg.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
}   // 🌍 изглед с Балканите
const COUNTRY_BG = { ROU: 'РУМЪНИЯ', SRB: 'СЪРБИЯ', MKD: 'С. МАКЕДОНИЯ', GRC: 'ГЪРЦИЯ', TUR: 'ТУРЦИЯ' };
const COUNTRY_LABEL_AT = { ROU: [25.6, 44.35], SRB: [21.95, 43.75], MKD: [21.75, 41.65], GRC: [23.6, 41.05], TUR: [27.6, 41.45] };
const COUNTRY_LABEL_WIDE = { ROU: [24.8, 45.6], SRB: [20.9, 44.2], MKD: [21.7, 41.45], GRC: [22.3, 39.4], TUR: [31.5, 40.4] };

// ============================================================ поръчки и етапи на строежа
// need: колко единици от всеки тип трябва на обекта през етапа; work: обем (единица-дни × RATE)
const RATE = 20;
const BTYPES = {
  house: { nm: 'Къща', ico: '🏠', reward: 28000, days: 8, rep: 0, repGain: 0.25,
    stages: [{ nm: 'Изкоп', need: { loader: 1, crew: 1 }, work: 30 }, { nm: 'Основи', need: { truck: 1, crew: 1 }, work: 30 },
      { nm: 'Конструкция', need: { crew: 1 }, work: 50 }, { nm: 'Довършване', need: { crew: 1 }, work: 20 }] },
  shop: { nm: 'Магазин', ico: '🏪', reward: 75000, days: 12, rep: 1, repGain: 0.4,
    stages: [{ nm: 'Изкоп', need: { loader: 1, crew: 1 }, work: 50 }, { nm: 'Основи', need: { truck: 1, crew: 1 }, work: 60 },
      { nm: 'Конструкция', need: { crane: 1, crew: 1 }, work: 120 }, { nm: 'Довършване', need: { crew: 1, tractor: 1 }, work: 40 }] },
  office: { nm: 'Офис сграда', ico: '🏢', reward: 150000, days: 18, rep: 2.5, repGain: 0.6,
    stages: [{ nm: 'Изкоп', need: { loader: 1, truck: 1, crew: 1 }, work: 110 }, { nm: 'Основи', need: { truck: 1, crew: 2 }, work: 120 },
      { nm: 'Конструкция', need: { crane: 1, crew: 2 }, work: 260 }, { nm: 'Довършване', need: { crew: 2, tractor: 1 }, work: 90 }] },
  tower: { nm: 'Небостъргач', ico: '🌆', reward: 320000, days: 30, rep: 4, repGain: 1,
    stages: [{ nm: 'Изкоп', need: { loader: 2, truck: 2, crew: 1 }, work: 220 }, { nm: 'Основи', need: { truck: 2, crew: 2 }, work: 250 },
      { nm: 'Конструкция', need: { crane: 2, crew: 3 }, work: 600 }, { nm: 'Довършване', need: { crew: 3, tractor: 1 }, work: 200 }] },
};
// собствени строежи (надграждане на офиса/гаража) — не идват като поръчки
const OWN_TYPES = {
  own_office: { nm: 'Надграждане на офиса', ico: '🏢', own: true, rep: Infinity, repGain: 0,
    stages: [{ nm: 'Строеж', need: { crew: 1 }, work: 40 }, { nm: 'Обзавеждане', need: { crew: 1 }, work: 20 }] },
  own_garage: { nm: 'Разширяване на гаража', ico: '🔧', own: true, rep: Infinity, repGain: 0,
    stages: [{ nm: 'Строеж', need: { crew: 1 }, work: 40 }] },
  own_garage_new: { nm: 'Нов гараж', ico: '🔧', own: true, rep: Infinity, repGain: 0,
    stages: [{ nm: 'Изкоп', need: { loader: 1, crew: 1 }, work: 25 }, { nm: 'Основи', need: { truck: 1, crew: 1 }, work: 25 }, { nm: 'Строеж', need: { crew: 1 }, work: 40 }] },
  own_wh: { nm: 'Разширяване на склада', ico: '📦', own: true, rep: Infinity, repGain: 0,
    stages: [{ nm: 'Строеж', need: { crew: 1 }, work: 35 }] },
  own_wh_new: { nm: 'Нов склад', ico: '📦', own: true, rep: Infinity, repGain: 0,
    stages: [{ nm: 'Изкоп', need: { loader: 1, crew: 1 }, work: 20 }, { nm: 'Основи', need: { truck: 1, crew: 1 }, work: 20 }, { nm: 'Строеж', need: { crew: 1 }, work: 30 }] },
};
Object.assign(BTYPES, OWN_TYPES);
const offerTypes = () => Object.entries(BTYPES).filter(([, t]) => !t.own && !t.est);
const CLIENTS = ['сем. Петрови', 'сем. Георгиеви', 'Иван Димитров', 'Мария Иванова', 'сем. Николови', 'Стоян Тодоров', 'сем. Стоянови',
  '„Булмаркет“ ЕООД', '„Тракия Трейд“', '„Витоша Офис Парк“', '„Дунав Инвест“', '„Черноморие Холдинг“', '„Родопа Билд“', '„Балкан Партнърс“'];

// ============================================================ renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.localClippingEnabled = true;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd9ee);
scene.fog = new THREE.Fog(0xbcd9ee, 180, 420);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 900);
camera.position.set(60, 95, 110);
const controls = new MapControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = 1.25;
controls.minDistance = 25;
controls.maxDistance = 320;
const hemi = new THREE.HemisphereLight(0xdfefff, 0x6b7b55, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 1, far: 400 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ============================================================ assets
const loader = new GLTFLoader();
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const MODELS = {
  roads: ['traffic-light', 'road-straight', 'road-crossroad', 'road-intersection', 'road-bend', 'construction-cone', 'construction-barrier', 'light-square'],
  houses: ['building-type-a', 'building-type-b', 'building-type-c', 'building-type-d', 'building-type-e', 'building-type-f', 'building-type-g', 'building-type-h', 'building-type-i', 'building-type-j', 'tree-large', 'tree-small'],
  commercial: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'],
  // Commercial 2.1: модерни сгради и стъклени небостъргачи — за центъра на мегаполисите
  commercial2: ['building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n', 'building-skyscraper-d', 'building-skyscraper-e'],
  trains: ['track', 'train-locomotive-a', 'train-carriage-box', 'train-carriage-flatbed-wood', 'train-carriage-coal', 'train-carriage-container-red', 'train-carriage-container-blue', 'train-carriage-tank', 'train-carriage-lumber', 'train-electric-city-a', 'train-electric-city-b'],
  highway: HW_MODELS.highway,
  vehicles: ['tractor', 'tractor-shovel', 'truck', 'truck-flat', 'delivery', 'sedan', 'taxi', 'suv', 'van', 'ambulance', 'police', 'firetruck', 'sedan-sports', 'suv-luxury', 'hatchback-sports'],
  // Kenney City Kit Industrial (CC0): заводи в градовете с доставчици
  industrial: ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h', 'building-i', 'building-j', 'building-k', 'building-l', 'water-tower', 'windmill', 'solar-panel-landscape-group', 'solar-panel-portrait-group'],
  // Majadroid House Construction Site (CC0): кула-кран и реквизит за строежите
  // Kenney Holiday Kit (CC0): борове за зимните курорти
  holiday: ['tree', 'tree-snow-a', 'tree-snow-b', 'tree-snow-c', 'bench', 'lantern', ...CHALET_PIECES],
  construction: ['crane-tower', 'container-office-green', 'container-office-red', 'toilet-portable', 'planks-wood-a', 'box-stack-brown', 'container-rubble-red', 'barrel', 'truck-dump-red', 'truck-dump-green', 'truck-concrete-red'],
  // poly.pizza (CC-BY 3.0 / CC0, виж assets/heavy/CREDITS.txt): булдозери, минен самосвал, кулокран — за аутобаните
  heavy: ['bulldozer-a', 'bulldozer-b', 'bulldozer-c', 'dump-truck', 'crane-c', 'crane-a'],
  city: ['Building_Small_1', 'Building_Medium_2_001', 'Building_Large_2'],
  people: ['worker_male', 'worker_male_alt', 'farmer'],
};
const A = {};
let europe = null;
{
  const jobs = [];
  // заводските модели се казват като търговските (building-a…) — пазим ги под 'ind-…'
  for (const [dir, list] of Object.entries(MODELS)) for (const n of list) jobs.push(load(`assets/${dir}/${n}.glb`).then(g => { A[dir === 'industrial' ? 'ind-' + n : n] = g; }));
  // истинска строителна техника и коли за трафика (vehmodels.js, Sketchfab)
  jobs.push(loadVehModels(load, A));
  jobs.push(loadAirModels(load));   // самолети и контролна кула (airport.js)
  // модели за курортите (resortview.js); липсващ файл не спира играта
  for (const [dir, list] of Object.entries(RESORT_MODELS)) for (const n of list) jobs.push(load(`assets/${dir}/${n}.glb`).then(g => { A[n] = g; }).catch(() => {}));
  // по-хубави дървета за курортите (Sketchfab, CC-BY): пакетите се разделят на отделни дървета A['sf-…-N'] с височина 1
  for (const [file, key, opt] of [['trees/palms', 'palm', {}], ['trees/snowpines', 'pinesnow', { glow: 0x5a6068 }], ['trees/pine', 'pine', {}], ['trees/forest', 'tree', { trunksOnly: true }], ['people/people', 'person', { plain: true }]]) jobs.push(load(`assets/heavy/${file}.glb`).then(g => splitTrees(g.scene, opt).forEach((t, i) => { A[`sf-${key}-${i}`] = { scene: t }; })).catch(() => {}));
  // хотел за ски курортите (resortview.js го ползва вместо кулите на Kenney)
  for (const k of ['sing', 'rand', 'usb', 'blue', 'night']) jobs.push(load(`assets/heavy/sky/${k}.glb`).then(g => { g.scene.traverse(m => { if (m.isMesh && m.material && m.material.metalness > 0.5) m.material.metalness = 0.35; }); A['sf-sky-' + k] = g; }).catch(() => {}));   // истински небостъргачи (Sketchfab) — за разнообразие в града
  jobs.push(load('assets/heavy/resort/aframe.glb').then(g => { A['sf-aframe'] = g; }).catch(() => {}));   // A-frame хижа за зимните вилни селища (resortview.js)
  for (const k of ['skihotel', 'villa', 'marina', 'miami', 'hirise']) jobs.push(load(`assets/heavy/people/hotel-${k}.glb`).then(g => { g.scene.traverse(m => { if (m.isMesh && m.material) { m.material.metalness = Math.min(m.material.metalness ?? 0, 0.15); m.material.roughness = Math.max(0.55, m.material.roughness ?? 1); } }); A['sf-hotel-' + k] = g; }).catch(() => {}));
  // кораби и контейнери за крайбрежните градове (seaside.js)
  for (const n of SEA_MODELS) if (!A[n]) jobs.push(load(`assets/watercraft/${n}.glb`).then(g => { A[n] = g; }).catch(() => {}));
  jobs.push(fetch('assets/data/europe.json').then(r => r.json()).then(j => { europe = j; }));
  let done = 0;
  const ldT0 = performance.now();
  jobs.forEach(j => j.then(() => { const k = Math.round(++done / jobs.length * 100); $('ldBar').style.width = Math.max(3, k) + '%'; $('ldTxt').textContent = `Зареждане… ${k}%`; }));
  await Promise.all(jobs);
}
// небостъргачи: варианти на 10 и 15 етажа (за поръчките, ключ 'име@етажи'), а самите модели стават 20 етажа
for (const [n, band] of Object.entries(SKY_BANDS)) {
  for (const f of [10, 15]) A[`${n}@${f}`] = { scene: makeTallCopy(A[n].scene, band, f) };
  makeTall(A[n].scene, band, 20);
  A[`${n}@20`] = A[n];
}
// модерните небостъргачи в мегаполисите: 20, 25 и 30 етажа
for (const [n, band] of Object.entries(SKY_BANDS_MODERN)) if (A[n]) for (const f of [20, 25, 30]) A[`${n}@${f}`] = { scene: makeTallCopy(A[n].scene, band, f) };
const sizeCache = {};
const sizeOf = n => sizeCache[n] || (sizeCache[n] = new THREE.Box3().setFromObject(A[n].scene));
// пакет с дървета → отделни дървета: всяко листо/клон отива при най-близкия ствол; без ствол — само (храст, малко дърво).
// Всяко дърво е с основа в (0,0,0) и височина 1, затова model('sf-palm-0', 8) е палма от 8 м
function splitTrees(scene, { trunksOnly = false, glow = 0x2c3a24, plain = false } = {}) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse(o => { if (o.isMesh && !/plane|rock/i.test(o.name)) parts.push({ o, b: new THREE.Box3().setFromObject(o), trunk: /bark|trunk|trank/i.test(o.name + ' ' + (o.material?.name || '')) }); });
  const trunks = parts.filter(p => p.trunk), groups = trunks.map(t => [t]), solo = [];
  for (const p of parts) {
    if (p.trunk) continue;
    const c = p.b.getCenter(new THREE.Vector3());
    let best = -1, bd = Infinity;
    trunks.forEach((t, i) => { const tc = t.b.getCenter(new THREE.Vector3()), d = Math.hypot(c.x - tc.x, c.z - tc.z); if (d < bd) { bd = d; best = i; } });
    const t = trunks[best];
    if (t && bd < Math.max(3, (t.b.max.y - t.b.min.y) * 0.6)) groups[best].push(p); else if (!trunksOnly) solo.push([p]);
  }
  return [...groups, ...solo].map(list => {
    const b = new THREE.Box3(); for (const p of list) b.union(p.b);
    const base = (list.find(p => p.trunk) || list[0]).b.getCenter(new THREE.Vector3()), h = b.max.y - b.min.y, g = new THREE.Group();
    for (const p of list) {
      const m = p.o.clone(); m.matrixAutoUpdate = false;
      m.matrix.copy(p.o.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-base.x, -b.min.y, -base.z)).premultiply(new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h));
      const mt = m.material; if (mt && mt.transparent && mt.map) { mt.transparent = false; mt.alphaTest = 0.5; mt.depthWrite = true; mt.side = THREE.DoubleSide; }
      if (mt && mt.isMeshStandardMaterial) { mt.metalness = 0; mt.roughness = 0.9; }   // glTF по подразбиране е метален — без огледална среда излиза черно
      if (!plain && !p.trunk && mt && mt.map) {   // листата: нормали навън като от кълбо + малко собствена светлина — иначе плоските карти са черни отдолу
        const geo = m.geometry = m.geometry.clone(), pos = geo.attributes.position, c = p.lb || (p.lb = new THREE.Box3().setFromBufferAttribute(pos).getCenter(new THREE.Vector3())), nrm = new Float32Array(pos.count * 3), v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).sub(c).normalize(); v.y += 0.6; v.normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        if (mt.emissive) { mt.emissive.set(glow); mt.emissiveIntensity = 1; }
      }
      g.add(m);
    }
    return g;
  });
}
function model(n, scale = 1, shadow = true) {
  const o = A[n].scene.clone(true);
  o.scale.setScalar(scale);
  o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; } });
  return o;
}

// ============================================================ градът (процедурен по името на града)
// Мрежа от плочки TILE×TILE; улица на всеки 3 плочки; между улиците има парцели 2×2 плочки.
const TILE = 8, NB = 9, N = NB * 3 + 1;
// градът може да расте на изток с нови квартали (по една колона от NB парцела); началото на координатите не се мести
let NBI = NB, NI = N;   // колони от квартали / плочки по x (по z остават NB / N)
const MAX_EXT = 4;
// мегаполисите са 3× по-големи: още MEGA_BASE колони застроени квартали на изток (всеки 9 колони — свой център);
// купените квартали идват след тях. Ред на парцелите (id): старите, после мегаполисните, после купените.
const MEGAPOLIS = new Set(['moscow', 'istanbul', 'london', 'paris', 'rome', 'berlin', 'madrid', 'milan', 'newyork', 'losangeles', 'mexicocity', 'saopaulo', 'rio', 'buenosaires', 'cairo', 'mumbai', 'shanghai', 'beijing', 'tokyo', 'seoul']);
const MEGA_BASE = 18;
let megaBase = 0;
// в мегаполиса един купен квартал е MEGA_EXT_COLS колони (≈200 парцела), иначе — една колона (9 парцела)
const MEGA_EXT_COLS = 22;
const extCols = () => megaBase ? MEGA_EXT_COLS : 1;
const extNeed = () => megaBase ? 1 : 4;   // за завършване на мегаполис стига 1 голям квартал
function setCityExt(ext, base = megaBase) { megaBase = base; NBI = NB + base + ext * (base ? MEGA_EXT_COLS : 1); NI = 3 * NBI + 1; }
// стари записи на мегаполис с купени квартали: id-тата на купените парцели се изместват след мегаполисните
function migrateMegaLots(cityId) {
  if (!MEGAPOLIS.has(cityId) || S.megaV) return;
  S.megaV = 1;
  const from = NB * NB, d = MEGA_BASE * NB, m = id => id != null && id >= from ? id + d : id;
  if (!(S.cityExt > 0)) return;
  for (const k of ['offers', 'projects', 'built', 'cash']) for (const o of S[k] || []) if (o && o.lot != null) o.lot = m(o.lot);
  for (const k of ['cleared', 'parks']) if (S[k]) S[k] = S[k].map(m);
  if (S.estate) { S.estate.land = (S.estate.land || []).map(m); for (const o of [...(S.estate.owned || []), ...(S.estate.listings || [])]) o.lot = m(o.lot); }
  S.garageLot = m(S.garageLot); S.whLot = m(S.whLot);
  if (S.landPrice) S.landPrice = Object.fromEntries(Object.entries(S.landPrice).map(([k, v]) => [m(+k), v]));
  if (S.tenderLots) for (const k of Object.keys(S.tenderLots)) S.tenderLots[k] = m(S.tenderLots[k]);
  if (S.landmarks && S.landmarks[cityId]) for (const k of Object.keys(S.landmarks[cityId])) S.landmarks[cityId][k] = m(S.landmarks[cityId][k]);
  for (const o of (econ && econ.s.transit) || []) if (o.city === cityId && o.lot != null) o.lot = m(o.lot);
  for (const o of (S.rivals && S.rivals.sites) || []) if (o.city === cityId) o.lot = m(o.lot);
}
const isRoad = (i, j) => (i % 3 === 0 || j % 3 === 0) && !(city.noRoad && city.noRoad.has(i + ',' + j));   // noRoad — плочките под площада на главната забележителност
const tx = i => (i - (N - 1) / 2) * TILE;
const city = { group: null, lots: [], hq: null };

function tileOfPos(x, z) { return [Math.round(x / TILE + (N - 1) / 2), Math.round(z / TILE + (N - 1) / 2)]; }
function nearestRoad(x, z) {
  let [i, j] = tileOfPos(x, z);
  i = Math.max(0, Math.min(NI - 1, i)); j = Math.max(0, Math.min(N - 1, j));
  if (isRoad(i, j)) return [i, j];
  const a = [3 * Math.round(i / 3), j], b = [i, 3 * Math.round(j / 3)];
  const da = Math.abs(tx(a[0]) - x), db = Math.abs(tx(b[1]) - z);
  return da < db ? a : b;
}
function bfs(a, b) {
  const key = (i, j) => i * N + j, prev = new Int32Array(NI * N).fill(-1), q = [key(...a)];
  prev[q[0]] = q[0];
  for (let h = 0; h < q.length; h++) {
    const k = q[h], i = (k / N) | 0, j = k % N;
    if (i === b[0] && j === b[1]) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NI || nj >= N || !isRoad(ni, nj)) continue;
      const nk = key(ni, nj);
      if (prev[nk] !== -1) continue;
      prev[nk] = k; q.push(nk);
    }
  }
  const out = [];
  let k = key(...b);
  if (prev[k] === -1) return [a];
  while (k !== key(...a)) { out.push([(k / N) | 0, k % N]); k = prev[k]; }
  out.push(a);
  return out.reverse();
}

const tmpM = new THREE.Matrix4();
function instanced(name, mats) {
  const g = new THREE.Group(), src = A[name].scene;
  src.updateMatrixWorld(true);
  src.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    mats.forEach((m, i) => { tmpM.multiplyMatrices(m, o.matrixWorld); im.setMatrixAt(i, tmpM); });
    im.receiveShadow = true;
    g.add(im);
  });
  return g;
}
const HOUSES = MODELS.houses.filter(n => n.startsWith('building'));
const SHOPS = ['building-a', 'building-b', 'building-c', 'building-d', 'building-e', 'building-f', 'building-g', 'building-h'];
const SKY = ['building-skyscraper-a', 'building-skyscraper-b', 'building-skyscraper-c'];
// ---- градовете по големина: малките без небостъргачи, средните до 10 етажа, мегаполисите с модерен център
const MEGA = ['moscow', 'stpetersburg', 'kyiv', 'london', 'paris', 'berlin', 'madrid', 'rome', 'milan', 'amsterdam', 'vienna', 'barcelona', 'munich', ...WORLD.map(c => c.id)];
const cityTier = id => MEGA.includes(id) || MEGAPOLIS.has(id) ? 'xl' : (CITIES.find(c => c.id === id)?.sz || 1) >= 3 ? 'l' : (CITIES.find(c => c.id === id)?.sz || 1) === 2 ? 'm' : 's';
const SF_SKY = () => ['sing', 'rand', 'usb', 'blue', 'night'].map(k => 'sf-sky-' + k).filter(n => A[n]);   // истинските небостъргачи (ако са заредени)
const MODERN_SKY = ['building-skyscraper-d', 'building-skyscraper-e'], MODERN = ['building-i', 'building-j', 'building-k', 'building-l', 'building-m', 'building-n'];
// етажи на небостъргачите в поръчките според големината на града
const TOWER_FLOORS = { s: [], m: [10], l: [10, 15, 20], xl: [20, 25, 30] };
// замяна на модела според големината (решава се по хеш на града и парцела, без нови r() — градовете не се разместват)
function tierModel(cityId, lot, n) {
  const t = cityTier(cityId), h = hashStr('tier:' + cityId + ':' + lot.id);
  if (t === 's') {
    if (SKY.includes(n)) return h % 3 === 0 ? HOUSES[h % HOUSES.length] : ['building-a', 'building-b', 'building-c', 'building-d'][h % 4];   // блок до 3 етажа или къща
    if (lot.zone === 'center' && SHOPS.includes(n) && h % 4 === 0) return HOUSES[(h >>> 3) % HOUSES.length];
    return n;
  }
  if (t === 'm') return SKY.includes(n) ? (h % 2 ? `${n}@10` : SHOPS[h % SHOPS.length]) : n;
  if (SKY.includes(n) && (t === 'l' || t === 'xl') && SF_SKY().length && h % 3 === 0) return SF_SKY()[(h >>> 4) % SF_SKY().length];   // всеки трети — истински модел
  if (t === 'l') return SKY.includes(n) ? `${n}@${h % 3 ? 20 : 15}` : n;
  // мегаполис: стъклени небостъргачи в центъра, модерни сгради в средния пояс
  if (SKY.includes(n) && A['building-skyscraper-d@20']) return `${MODERN_SKY[h % 2]}@${[20, 25, 30][(h >>> 2) % 3]}`;
  if (SHOPS.includes(n) && A['building-i'] && (lot.zone === 'center' || h % 2)) return MODERN[h % MODERN.length];
  return n;
}
const INDUSTRIAL = MODELS.industrial.filter(n => n.startsWith('building')).map(n => 'ind-' + n);
const FACTORY_CITIES = new Set(ECON.FACTORIES.map(f => f.cityId));
// мащаб, с който сградата се вписва в парцела 16×16 м
function fitScale(n, target = 12.5) { const s = sizeOf(n).getSize(new THREE.Vector3()); return target / Math.max(s.x, s.z); }

const dayNight = new DayNight(scene, hemi, sun);
// времето (weather.js): дъжд, сняг, мъгла, буря — върху светлината на денонощието
const weather = createWeather({ scene, hemi, sun });
function buildCity(cityId) {
  if (city.group) scene.remove(city.group);
  const g = city.group = new THREE.Group();
  scene.add(g);
  const r = rng(hashStr(cityId));
  migrateMegaLots(cityId);
  setCityExt(S.cityExt || 0, MEGAPOLIS.has(cityId) ? MEGA_BASE : 0);
  // земя (при мегаполисите — по-широка на изток)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1200, 2 * (tx(NI - 1) + 380)), 1200), new THREE.MeshStandardMaterial({ color: 0x8fb36a, roughness: 1 }));
  weather.setGround(ground.material);   // снежната покривка оцветява земята
  // крайбрежните градове: море на север с плаж, пристанище, фар и кораби (seaside.js)
  city.airport = null; city.airportNI = 0; refreshAirport3D(cityId);
  // крайморски град: жп линията свива на запад преди брега (концентрични дъги; най-западният коловоз е с радиус 12)
  { const westmost = tx(0) - 16 - 6 * 6.5, cx = westmost - 12, seaZ = tx(0) - TILE / 2 - 2 - 22; trackMap = SEASIDE.includes(cityId) ? makeTrackMap({ cx, zC: seaZ + 6 + (tx(0) - 16 - cx) }) : makeTrackMap(null); }
  city.sea = SEASIDE.includes(cityId) ? addSeaside(g, { A, model, label }, { zEdge: tx(0) - TILE / 2 - 2, xMin: tx(0), xMax: tx(NI - 1), railX: [-1e9, -1e9], seed: hashStr(cityId) }) : null;
  seaFleetSig = ''; if (city.sea) city.sea.setPortLevel?.(portLv(cityId));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  g.add(ground);
  // улици: инстанцирани по вид плочка
  const kinds = { 'road-straight': [], 'road-crossroad': [], 'road-intersection': [], 'road-bend': [] };
  const e = new THREE.Euler(), s3 = new THREE.Vector3(TILE, TILE, TILE), q = new THREE.Quaternion(), p = new THREE.Vector3();
  const lights = [];
  for (let i = 0; i < NI; i++) for (let j = 0; j < N; j++) {
    if (!isRoad(i, j)) continue;
    const n = j > 0 && isRoad(i, j - 1), s = j < N - 1 && isRoad(i, j + 1), w = i > 0 && isRoad(i - 1, j), ea = i < NI - 1 && isRoad(i + 1, j);
    const cnt = n + s + w + ea;
    let kind = 'road-straight', rot = 0;
    if (cnt === 4) kind = 'road-crossroad';
    else if (cnt === 3) { kind = 'road-intersection'; rot = !n ? Math.PI : !s ? 0 : !w ? -Math.PI / 2 : Math.PI / 2; }
    else if (cnt === 2 && (n && s)) { rot = Math.PI / 2; }
    else if (cnt === 2 && (w && ea)) { rot = 0; }
    else { kind = 'road-bend'; rot = s && ea ? 0 : s && w ? -Math.PI / 2 : n && w ? Math.PI : Math.PI / 2; }
    kinds[kind].push(new THREE.Matrix4().compose(p.set(tx(i), 0, tx(j)), q.setFromEuler(e.set(0, rot, 0)), s3));
    if (kind === 'road-straight' && (i + j) % 6 === 1) lights.push([i, j, n && s]);
  }
  for (const [k, mats] of Object.entries(kinds)) if (mats.length) g.add(applyRoadLook(instanced(k, mats)));   // асфалт и плочки (roadlook.js)
  // зебри на всеки изход от кръстовище (Т или +)
  { const arms = [];
    for (let i = 0; i < NI; i++) for (let j = 0; j < N; j++) {
      if (!isRoad(i, j)) continue;
      const nb = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([di, dj]) => { const a = i + di, b = j + dj; return a >= 0 && b >= 0 && a < NI && b < N && isRoad(a, b); });
      if (nb.length < 3) continue;
      for (const [di, dj] of nb) arms.push(di ? [tx(i) + di * (TILE / 2 + 1.1), tx(j), 'x'] : [tx(i), tx(j) + dj * (TILE / 2 + 1.1), 'z']);
    }
    if (arms.length) g.add(makeCrosswalks(arms, TILE * 0.62)); }
  const lampPos = [];
  for (const [i, j, vertical] of lights) {
    const l = model('light-square', 7, false);
    l.position.set(tx(i) + (vertical ? TILE * 0.42 : 0), 0, tx(j) + (vertical ? 0 : TILE * 0.42));
    l.rotation.y = vertical ? -Math.PI / 2 : 0;
    g.add(l);
    lampPos.push({ x: tx(i) + (vertical ? TILE * 0.42 - 1.6 : 0), y: 6.2, z: tx(j) + (vertical ? 0 : TILE * 0.42 - 1.6) });
  }
  dayNight.setLamps(lampPos);
  buildSignals(g);
  // парцели
  city.lots = [];
  const c = (NB - 1) / 2;
  // първо старите парцели (id-тата им не се менят), после новите квартали на изток — празна земя
  // ред на парцелите: старите, мегаполисните (NB…NB+megaBase−1), после купените квартали (физически най-на изток)
  const ext = NBI - NB - megaBase, ord = [...Array(NB).keys(), ...Array.from({ length: megaBase }, (_, k) => NB + k), ...Array.from({ length: ext }, (_, k) => NB + megaBase + k)];
  for (const bi of ord) for (let bj = 0; bj < NB; bj++) {
    const mega = bi >= NB && bi < NB + megaBase, cc = mega ? NB + Math.floor((bi - NB) / 9) * 9 + 4 : c;   // всяка 9-колонна част на мегаполиса има свой център
    const x = tx(3 * bi + 1.5), z = tx(3 * bj + 1.5), d = Math.max(Math.abs(bi - cc), Math.abs(bj - c));
    const zone = d <= 1 ? 'center' : d <= (mega ? 3 : 2) ? 'mid' : 'outer';   // мегаполисът е по-гъст: широк среден пояс
    city.lots.push({ id: city.lots.length, bi, bj, x, z, zone, built: null, obj: null, busy: null, fresh: bi >= NB + megaBase, mega });
  }
  // централата на фирмата — парцел до центъра
  city.hq = city.lots.find(l => l.bi === Math.floor(c) && l.bj === Math.floor(c) + 1);
  city.hq.busy = 'hq';
  // готов град: ~60% от парцелите са застроени (според зоната)
  for (const lot of city.lots) {
    if (lot.busy || lot.fresh) continue;
    const chance = lot.mega ? (lot.zone === 'center' ? 0.92 : lot.zone === 'mid' ? 0.82 : 0.7) : lot.zone === 'center' ? 0.75 : lot.zone === 'mid' ? 0.6 : 0.5;
    if (r() > chance) continue;
    let n;
    if (lot.zone === 'center') n = r() < 0.6 ? SKY[(r() * SKY.length) | 0] : SHOPS[(r() * SHOPS.length) | 0];
    else if (lot.zone === 'mid') n = r() < 0.7 ? SHOPS[(r() * SHOPS.length) | 0] : HOUSES[(r() * HOUSES.length) | 0];
    else n = lot.mega && r() < 0.5 ? SHOPS[(r() * SHOPS.length) | 0] : HOUSES[(r() * HOUSES.length) | 0];   // и в покрайнините на мегаполиса има блокове
    const rot = Math.floor(r() * 4) * Math.PI / 2;
    // в градовете с доставчици ~1/4 от къщите в покрайнините са заводи (решава се по хеш, без нови r() — градовете не се разместват)
    n = tierModel(cityId, lot, n);
    if (lot.zone === 'outer' && FACTORY_CITIES.has(cityId)) { const hh = hashStr(cityId + ':' + lot.id); if (hh % 4 === 0) n = INDUSTRIAL[(hh >>> 3) % INDUSTRIAL.length]; }
    placeBuilding(lot, n, rot, r);
  }
  // зелени парцели — по малко дървета
  for (const lot of city.lots) {
    if (lot.built || lot.busy) continue;
    if (lot.fresh && megaBase && hashStr('t' + lot.id) % 3) continue;   // големите празни квартали — по-рядко дървета
    for (let k = 0; k < 2; k++) {
      const t = model(r() < 0.5 ? 'tree-large' : 'tree-small', rand(6, 9));
      t.position.set(lot.x + rand(-6, 6), 0, lot.z + rand(-6, 6));
      g.add(t);
      lot.trees = lot.trees || []; lot.trees.push(t);
    }
  }
  // вятърни мелници и водни кули на някои празни парцели в индустриалните градове
  if (FACTORY_CITIES.has(cityId)) for (const lot of city.lots) {
    if (lot.built || lot.busy || lot.zone !== 'outer' || lot.fresh) continue;
    const hh = hashStr('wm:' + cityId + ':' + lot.id);
    if (hh % 5) continue;
    const n = hh % 2 ? 'ind-windmill' : 'ind-water-tower', o = model(n, n === 'ind-windmill' ? 9 : 7);
    o.position.set(lot.x + 3, 0, lot.z - 3);
    g.add(o);
    lot.trees = lot.trees || []; lot.trees.push(o);
  }
}
function placeBuilding(lot, n, rot = 0) {
  const isQ = n.startsWith('Building_');
  const s = isQ ? fitScale(n, 14) : HOUSES.includes(n) ? fitScale(n, 11) : fitScale(n, 12.5);
  const o = model(n, s);
  if (HOUSES.includes(n)) tintRoof(o, lot.id);
  dayNight.registerWindows(o);
  o.rotation.y = rot;
  o.position.set(lot.x, 0, lot.z);
  // Quaternius моделите не са центрирани — центрираме по рамката
  const bb = new THREE.Box3().setFromObject(o);
  o.position.x += lot.x - (bb.min.x + bb.max.x) / 2;
  o.position.z += lot.z - (bb.min.z + bb.max.z) / 2;
  city.group.add(o);
  // соларни панели на плоските покриви на част от търговските сгради (решава се само по хеш на града и парцела)
  if (SHOPS.includes(n) && A['ind-solar-panel-landscape-group'] && S && hashStr(`sol:${S.cityId}:${lot.id}`) % 3 === 0) {
    o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o), w = Math.min(b2.max.x - b2.min.x, b2.max.z - b2.min.z), k = w * 0.32 / 0.9;
    for (const dx of [-0.22, 0.22]) {
      const pn = model('ind-solar-panel-landscape-group', k / o.scale.x);
      pn.position.copy(o.worldToLocal(new THREE.Vector3((b2.min.x + b2.max.x) / 2 + dx * w, b2.max.y + 0.05, (b2.min.z + b2.max.z) / 2)));
      pn.rotation.y = -o.rotation.y;
      o.add(pn);
    }
  }
  lot.built = n; lot.obj = o;
  return o;
}

// надпис-табела (sprite с canvas текст)
function label(text, color = '#fff', w = 10, bg = 'rgba(15,20,28,.85)') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 88, 20); g.fill();
  g.font = 'bold 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 256, 50, 480);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(w, w * 96 / 512, 1);
  s.renderOrder = 10;
  return s;
}

// ============================================================ централата: офис и гараж (отделни нива 1–10)
// Офисът държи хората: бригади, едновременни обекти, поръчки на таблото. Гаражът държи техниката (всичко без бригадите).
// Надграждането се плаща веднага, но го строи самата фирма (свой обект със своя бригада) — новото ниво важи, щом е готово.
const OFFICE_LEVELS = [
  { nm: 'Фургон', model: null, crews: 2, proj: 2, offers: 3 },
  { nm: 'Малък офис', model: 'building-type-c', crews: 3, proj: 2, offers: 4 },
  { nm: 'Офис', model: 'building-a', crews: 4, proj: 3, offers: 4 },
  { nm: 'Голям офис', model: 'building-c', crews: 5, proj: 3, offers: 5 },
  { nm: 'Бизнес център', model: 'building-e', crews: 6, proj: 4, offers: 5 },
  { nm: 'Корпоративна сграда', model: 'building-g', crews: 8, proj: 4, offers: 6 },
  { nm: 'Кула', model: 'building-skyscraper-a', crews: 10, proj: 5, offers: 6 },
  { nm: 'Голяма кула', model: 'building-skyscraper-b', crews: 12, proj: 6, offers: 7 },
  { nm: 'Небостъргач', model: 'building-skyscraper-c', crews: 14, proj: 7, offers: 7 },
  { nm: 'Империя', model: 'building-skyscraper-c@10', crews: 16, proj: 8, offers: 8 },   // небостъргач на 10 етажа с табела на покрива
];
OFFICE_LEVELS.forEach((l, i) => { l.upkeep = 70 * (i + 1); l.cost = Math.round(20000 * Math.pow(1.6, i) / 1000) * 1000; });   // cost = цена за следващото ниво
const GARAGE_LEVELS = [
  { nm: 'Навес', cap: 3 }, { nm: 'Барака', cap: 4 }, { nm: 'Гараж', cap: 6 }, { nm: 'Голям гараж', cap: 8 }, { nm: 'Автобаза', cap: 10 },
  { nm: 'Голяма автобаза', cap: 13 }, { nm: 'Хангар', cap: 16 }, { nm: 'Сервизен център', cap: 20 }, { nm: 'Техническа база', cap: 24 }, { nm: 'Логистичен център', cap: 28 },
];
GARAGE_LEVELS.forEach((l, i) => { l.upkeep = 50 * (i + 1); l.cost = Math.round(15000 * Math.pow(1.55, i) / 1000) * 1000; });
const GARAGE_LOT_FROM = 4;     // от това ниво гаражът не се побира в централата и иска свой парцел
// склад: събира материали предварително (купуваш, докато имаш пари). Ниво 0 = купчина в двора на централата.
// mul умножава мястото за всеки материал (WH_BASE); първият склад иска свой парцел.
const WH_LEVELS = [
  { nm: 'Малък склад', mul: 2 }, { nm: 'Склад', mul: 3 }, { nm: 'Голям склад', mul: 4 }, { nm: 'Складова база', mul: 6 }, { nm: 'Логистичен склад', mul: 8 },
  { nm: 'Голяма база', mul: 11 }, { nm: 'Терминал', mul: 14 }, { nm: 'Разпределителен център', mul: 18 }, { nm: 'Мегасклад', mul: 23 }, { nm: 'Логистичен парк', mul: 30 },
];
WH_LEVELS.forEach((l, i) => { l.upkeep = 40 * (i + 1); l.cost = Math.round(10000 * Math.pow(1.5, i) / 1000) * 1000; });   // cost = цена за строеж на това ниво
const WH_NONE = { nm: 'Купчина в двора', mul: 0.5, upkeep: 0 };
const WH_BASE = { sand: 40, gravel: 40, concrete: 40, bricks: 8, steel: 3, wood: 6, glass: 40, furniture: 6, marble: 30 };   // място при mul = 1
const whLv = () => S?.whLevel ? WH_LEVELS[S.whLevel - 1] : WH_NONE;
const matCap = m => Math.round((WH_BASE[m] || 10) * whLv().mul);
const LAND = 12000;   // цена на нов парцел (гараж или склад)
const officeLv = () => OFFICE_LEVELS[(S?.officeLevel || 1) - 1];
const garageLv = () => GARAGE_LEVELS[(S?.garageLevel || 1) - 1];
const isMachine = t => t !== 'crew';
const crewCount = () => units.filter(u => !isMachine(u.type)).length;
// пътната техника (валяци, асфалтополагачи, грейдери…) стои в пътна база при трасето — не заема места в гаража
const isRoadGear = t => !!(ECON.UNIT_TYPES[t] && ECON.UNIT_TYPES[t].road);
const machineCount = () => units.filter(u => isMachine(u.type) && !isRoadGear(u.type)).length;
const garageLotObj = () => S.garageLot == null ? null : city.lots[S.garageLot];
const lotKey = { garage: 'garageLot', warehouse: 'whLot' }, levelKey = { office: 'officeLevel', garage: 'garageLevel', warehouse: 'whLevel' };
const levelOf = kind => S[levelKey[kind]] || (kind === 'warehouse' ? 0 : 1);
// трябва ли нов парцел за следващото ниво
const needsLot = kind => kind === 'warehouse' ? S.whLot == null : kind === 'garage' && levelOf('garage') + 1 >= GARAGE_LOT_FROM && S.garageLot == null;
const KIND_NM = { office: '🏢 Офис', garage: '🔧 Гараж', warehouse: '📦 Склад' };
const upgradeOf = kind => projects.find(p => p.own === kind);

const doorTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = '#cfd4da'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 6) { g.fillStyle = '#9aa1a9'; g.fillRect(0, y, 64, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
function parkingLines(g, n, x0, z0) {
  for (let k = 0; k < n; k++) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ln.rotation.x = -Math.PI / 2; ln.position.set(x0 + (k % 4) * 4 - 2, 0.05, z0 + Math.floor(k / 4) * 4); g.add(ln);
  }
}
// сградата на гаража: от дървена барака до модерен хангар; w = ширина
function garageMesh(level, w, d) {
  const tier = level < 4 ? 0 : level < 7 ? 1 : 2;
  const wallC = [0x8b5a2b, 0xa0522d, 0x5d7290][tier], roofC = [0x5a3a1a, 0x6b6b6b, 0x2c3440][tier];
  const GH = 3 + level * 0.3;
  const gar = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, GH, d), new THREE.MeshStandardMaterial({ color: wallC, roughness: 0.85 }));
  walls.position.y = GH / 2; walls.castShadow = walls.receiveShadow = true; gar.add(walls);
  const roof = new THREE.Mesh(tier === 0 ? new THREE.CylinderGeometry(d * 0.62, d * 0.62, w + 0.4, 3, 1) : new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5),
    new THREE.MeshStandardMaterial({ color: roofC, roughness: 0.8 }));
  if (tier === 0) { roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2; roof.position.y = GH + 0.25; roof.scale.set(1, 1, 0.45); }
  else roof.position.y = GH + 0.2;
  roof.castShadow = true; gar.add(roof);
  const doors = Math.min(6, 1 + Math.floor(level / 2)), dw = w / doors - 0.5;
  for (let k = 0; k < doors; k++) {
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(dw, GH * 0.75), new THREE.MeshStandardMaterial({ map: doorTex }));
    dr.position.set(-w / 2 + (k + 0.5) * (w / doors), GH * 0.375 + 0.05, d / 2 + 0.02); gar.add(dr);
  }
  if (tier === 2) {   // стъклена ивица отгоре
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0x3a6c99 }));
    strip.position.set(0, GH - 0.4, d / 2 + 0.03); gar.add(strip);
  }
  if (level >= 5) {   // бензиноколонка
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), new THREE.MeshStandardMaterial({ color: 0xd62828 }));
    pump.position.set(w / 2 + 0.8, 0.8, d / 2 - 0.4); pump.castShadow = true; gar.add(pump);
  }
  gar.userData.h = GH;
  return gar;
}
// сградата на склада: дълго хале с ролетни врати и рампа
function warehouseMesh(level) {
  const W = Math.min(15, 9 + level * 0.6), D = 6.5, H = 3.6 + level * 0.3, g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: level < 5 ? 0xc9cdd2 : 0x8fa3b5, roughness: 0.7, metalness: 0.2 }));
  walls.position.y = H / 2; walls.castShadow = walls.receiveShadow = true; g.add(walls);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(D * 0.6, D * 0.6, W + 0.3, 3, 1), new THREE.MeshStandardMaterial({ color: 0x3f6f8f, roughness: 0.6 }));
  roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 2; roof.position.y = H + 0.2; roof.scale.set(1, 1, 0.35); roof.castShadow = true; g.add(roof);
  const doors = Math.min(4, 1 + Math.floor(level / 3)), dw = 2.6;
  for (let k = 0; k < doors; k++) {
    const dr = new THREE.Mesh(new THREE.PlaneGeometry(dw, H * 0.7), new THREE.MeshStandardMaterial({ map: doorTex }));
    dr.position.set(-W / 2 + (k + 0.5) * (W / doors), H * 0.35 + 0.05, D / 2 + 0.02); g.add(dr);
  }
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(W - 1, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: 0x9a9a95 }));
  ramp.position.set(0, 0.3, D / 2 + 0.7); ramp.receiveShadow = true; g.add(ramp);
  g.userData.h = H;
  return g;
}
// палети в двора на склада: по една купчина за всеки материал, височината следи наличността
function refreshWarehouse() {
  if (!city.whYard) return;
  const y = city.whYard;
  while (y.children.length) y.remove(y.children[0]);
  let k = 0;
  for (const m of Object.keys(ECON.MATERIALS)) {
    const fill = Math.min(1, econ.stock(m) / matCap(m)), n = Math.ceil(fill * 4);
    for (let j = 0; j < n; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 1.3), new THREE.MeshStandardMaterial({ color: PALLET_COL[m] ?? 0xcccccc, roughness: 0.9 }));
      b.position.set(-6 + (k % 7) * 2, 0.4 + j * 0.82, 0);
      b.castShadow = true; y.add(b);
    }
    k++;
  }
  const lb = city.whGroup?.userData.label;
  if (lb) {
    const total = Object.keys(ECON.MATERIALS).reduce((a, m) => a + Math.min(1, econ.stock(m) / matCap(m)), 0) / Object.keys(ECON.MATERIALS).length;
    const nl = label(`📦 СКЛАД ${S.whLevel} · пълен ${Math.round(total * 100)}%`, '#ffffff', 6.5);
    nl.position.copy(lb.position); lb.parent.add(nl); lb.parent.remove(lb); city.whGroup.userData.label = nl;
  }
}
function buildWarehouse() {
  if (city.whGroup) { city.group.remove(city.whGroup); city.whGroup = city.whYard = null; }
  if (S.whLot == null) return;
  const lot = city.lots[S.whLot], g = city.whGroup = new THREE.Group();
  g.position.set(lot.x, 0, lot.z);
  city.group.add(g);
  for (const t of lot.trees || []) city.group.remove(t);
  lot.trees = [];
  const pav = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 1 }));
  pav.rotation.x = -Math.PI / 2; pav.position.y = 0.03; pav.receiveShadow = true; g.add(pav);
  const wh = warehouseMesh(S.whLevel);
  wh.position.set(0, 0, -4); g.add(wh);
  const lb = label(`📦 СКЛАД ${S.whLevel}`, '#ffffff', 6.5);
  lb.position.set(0, wh.userData.h + 2, -4); g.add(lb); g.userData.label = lb;
  city.whYard = new THREE.Group(); city.whYard.position.set(0, 0, 4); g.add(city.whYard);
  refreshWarehouse();
}
// офисът и (докато е малък) гаражът стоят на парцела на централата; голямият гараж и складът — на свои парцели
function buildHQ() {
  if (city.hqGroup) city.group.remove(city.hqGroup);
  if (city.garGroup) { city.group.remove(city.garGroup); city.garGroup = null; }
  const g = city.hqGroup = new THREE.Group();
  g.position.set(city.hq.x, 0, city.hq.z);
  city.group.add(g);
  const level = S.officeLevel || 1, gLevel = S.garageLevel || 1, L = OFFICE_LEVELS[level - 1], away = garageLotObj();
  // двор (паважът става по-хубав с нивото)
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshStandardMaterial({ color: level < 4 ? 0x9b8f7a : level < 7 ? 0x9a9a95 : 0x6f7680, roughness: 1 }));
  yard.rotation.x = -Math.PI / 2; yard.position.y = 0.03; yard.receiveShadow = true; g.add(yard);
  parkingLines(g, 8, -6, 3);
  if (away) parkingLines(g, 4, 2, -5.5);   // гаражът се изнесе: още места за бусовете на бригадите
  // офис (задният ляв ъгъл)
  let office;
  const style = level >= STYLE_LV && S.officeStyle ? OFFICE_STYLES.find(x => x.id === S.officeStyle && (x.lm || x.sf || A[x.model])) : null;
  city.hqLm = null;
  if (style) {   // избран облик на кулата (officestyle.js): модел от пакета или процедурна кула
    const o = buildOfficeTower(style, { model, fitScale, A }, 6.5 + level * 0.25);
    office = o.group; city.hqLm = o.update;
    dayNight.registerWindows(office);
    const bb = new THREE.Box3().setFromObject(office);
    office.position.set(-3.6 - (bb.min.x + bb.max.x) / 2, 0, -3.6 - (bb.min.z + bb.max.z) / 2);
  } else if (!L.model) {
    // ниво 1: строителен фургон-контейнер
    office = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.6), new THREE.MeshStandardMaterial({ color: 0xf2f2ee }));
    box.position.y = 1.5; box.castShadow = true; office.add(box);
    for (const x of [-1.6, 1.6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ color: 0x7fb3d5, emissive: 0x223344 })); w.position.set(x, 1.7, 1.31); office.add(w); }
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x555555 })); d.position.set(0, 1.1, 1.31); office.add(d);
    office.position.set(-3.8, 0, -4.2);
  } else {
    const isQ = L.model.startsWith('Building_'), w = 6.5 + level * 0.25;
    office = model(L.model, fitScale(L.model, isQ ? w + 1.5 : w));
    dayNight.registerWindows(office);
    const bb = new THREE.Box3().setFromObject(office);
    office.position.set(-3.6 - (bb.min.x + bb.max.x) / 2, 0, -3.6 - (bb.min.z + bb.max.z) / 2);
  }
  office.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  g.add(office);
  const ob = new THREE.Box3().setFromObject(office);
  g.userData.officeTop = ob.max.y - g.position.y;
  // табела на фирмата с нивото на офиса и бригадите
  const sign = label(officeSignText(), '#ffb300', 14);
  sign.position.set(0, ob.max.y + 4.2 + (level === 10 ? 7 : 0), 0);   // на ниво 10 над табелата на покрива
  g.add(sign);
  g.userData.officeLabel = sign;
  if (level === 10) {
    // светеща табела „СТРОИТЕЛНА ИМПЕРИЯ“ на покрива (от двете страни) и златна звезда над нея
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const cg = c.getContext('2d'), grd = cg.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#1b2433'); grd.addColorStop(1, '#0d1420');
    cg.fillStyle = grd; cg.fillRect(0, 0, 1024, 256);
    cg.strokeStyle = '#ffb300'; cg.lineWidth = 14; cg.strokeRect(10, 10, 1004, 236);
    cg.font = '900 112px system-ui, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
    cg.shadowColor = '#ffb300'; cg.shadowBlur = 24; cg.fillStyle = '#ffd54a'; cg.fillText('СТРОИТЕЛНА', 512, 82);
    cg.font = '900 96px system-ui, sans-serif'; cg.fillStyle = '#ffffff'; cg.fillText('ИМПЕРИЯ', 512, 190);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 11, bh = bw / 4, top = ob.max.y - g.position.y, bmat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const board = new THREE.Group();
    for (const ry of [0, Math.PI]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bmat); f.rotation.y = ry; f.position.z = ry ? -0.06 : 0.06; board.add(f); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, bh + 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0x222831 })); board.add(back);
    for (const x of [-bw / 3, bw / 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), new THREE.MeshStandardMaterial({ color: 0x3a3f46 })); leg.position.set(x, -bh / 2 - 0.8, 0); board.add(leg); }
    board.position.set(-3.6, top + bh / 2 + 1.6, -3.6); board.rotation.y = Math.PI / 8;
    g.add(board);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xaa7a00, metalness: 0.6, roughness: 0.3 }));
    star.position.set(-3.6, top + bh + 3.6, -3.6); g.add(star); g.userData.star = star;
  }
  // гараж
  let gar, gl;
  if (!away) {   // в задния десен ъгъл на централата
    gar = garageMesh(Math.min(gLevel, 3), 6 + Math.min(gLevel, 5) * 0.22, 5.6);
    gar.position.set(3.8, 0, -4.3);
    g.add(gar);
  } else {       // свой парцел: хангар отзад, паркинг отпред
    const gg = city.garGroup = new THREE.Group();
    gg.position.set(away.x, 0, away.z);
    city.group.add(gg);
    for (const t of away.trees || []) city.group.remove(t);
    away.trees = [];
    const pav = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 15.5), new THREE.MeshStandardMaterial({ color: gLevel < 7 ? 0x8f8f8a : 0x5f6670, roughness: 1 }));
    pav.rotation.x = -Math.PI / 2; pav.position.y = 0.03; pav.receiveShadow = true; gg.add(pav);
    parkingLines(gg, 8, -6, 1.5);
    gar = garageMesh(gLevel, Math.min(15, 8 + gLevel * 0.7), 6 + Math.min(gLevel, 8) * 0.15);
    gar.position.set(0, 0, -4.2);
    gg.add(gar);
  }
  gl = label(`🔧 ГАРАЖ ${gLevel} · техника ${machineCount()}/${garageLv().cap}`, '#ffffff', 6.5);
  gl.position.y = gar.userData.h + 1.8; gar.add(gl);
  g.userData.garageLabel = gl;
  buildWarehouse();
}
const officeSignText = () => `🏗️ СТРОИТЕЛНА ИМПЕРИЯ · 🏢 офис ${S.officeLevel || 1} · 👷 ${crewCount()}/${officeLv().crews}`;
function refreshGarageLabel() {
  const g = city.hqGroup; if (!g) return;
  for (const [key, text, col, w] of [['garageLabel', `🔧 ГАРАЖ ${S.garageLevel || 1} · техника ${machineCount()}/${garageLv().cap}`, '#ffffff', 6.5], ['officeLabel', officeSignText(), '#ffb300', 14]]) {
    const old = g.userData[key]; if (!old) continue;
    const par = old.parent, nl = label(text, col, w);
    nl.position.copy(old.position); par.remove(old); par.add(nl); g.userData[key] = nl;
  }
}

// ---------- надграждане: свой строителен обект (офис, гараж, склад)
let pickKind = null, pickRings = [];
function showPickRings(on) {
  for (const r of pickRings) scene.remove(r);
  pickRings = [];
  if (!on) return;
  for (const l of city.lots) if (!l.built && !l.busy) {
    const r = new THREE.Mesh(new THREE.RingGeometry(7, 7.8, 4, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0x4cd07d, transparent: true, opacity: 0.85 }));
    r.position.set(l.x, 0.2, l.z); r.userData.lot = l.id;
    scene.add(r); pickRings.push(r);
  }
}
function upgradeCost(kind) {
  const lv = levelOf(kind), land = needsLot(kind) ? LAND : 0;
  if (kind === 'office') return OFFICE_LEVELS[lv - 1].cost;
  if (kind === 'garage') return GARAGE_LEVELS[lv - 1].cost + land;
  return WH_LEVELS[lv].cost + land;
}
function startUpgrade(kind) {
  if (levelOf(kind) >= 10 || upgradeOf(kind)) return;
  const cost = upgradeCost(kind);
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за този строеж.', 'bad'); return; }
  if (needsLot(kind)) {
    // нужен е свой парцел: играчът го посочва с мишката
    pickKind = kind; showPickRings(true);
    toast(`${KIND_NM[kind]}: посочи с мишката свободен парцел (зелените рамки). Esc — отказ.`);
    renderPanel();
    return;
  }
  const key = lotKey[kind];
  beginOwnProject(kind, key && S[key] != null ? city.lots[S[key]] : city.hq, cost);
}
function pickLot(lot) {
  const kind = pickKind;
  if (!kind) return;
  if (!lot || lot.built || lot.busy) { toast('Този парцел е зает. Избери някоя от зелените рамки.', 'bad'); return; }
  pickKind = null; showPickRings(false);
  const cost = upgradeCost(kind);
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за този строеж.', 'bad'); renderPanel(); return; }
  for (const t of lot.trees || []) city.group.remove(t);
  lot.trees = [];
  beginOwnProject(kind, lot, cost);
}
function cancelPick() { if (!pickKind) return; pickKind = null; showPickRings(false); renderPanel(); }
addEventListener('keydown', e => { if (e.code === 'Escape') cancelPick(); });
function beginOwnProject(kind, lot, cost) {
  const target = levelOf(kind) + 1, key = lotKey[kind];
  const newLot = !!key && lot !== city.hq && S[key] == null;
  econ.spend(cost, 'покупка', `${KIND_NM[kind].slice(3)}: строеж на ниво ${target}${newLot ? ' (нов парцел)' : ''}`);
  const type = kind === 'office' ? 'own_office' : kind === 'garage' ? (newLot ? 'own_garage_new' : 'own_garage') : (newLot ? 'own_wh_new' : 'own_wh');
  const p = { id: S.seq++, own: kind, target, type, lot: lot.id, client: 'собствен строеж', title: `${KIND_NM[kind]}: ниво ${target}`,
    reward: 0, repGain: 0, startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0 };
  if (lot !== city.hq) lot.busy = 'project';
  projects.push(p);
  makeSite(p);
  toast(`🔨 Фирмата започна строежа: ${p.title}. Нужна е свободна бригада${newLot ? ', багер и самосвал' : ''}.`, 'good');
  flyTo(lot);
  dispatch();
  save();
  renderPanel();
}
function finishOwnProject(p) {
  const lot = city.lots[p.lot], key = lotKey[p.own];
  S[levelKey[p.own]] = p.target;
  if (p.type === 'own_garage_new' || p.type === 'own_wh_new') { S[key] = lot.id; lot.busy = p.own; }
  buildHQ();
  // паркираната техника отива на новите си места
  for (const u of units) if (u.state === 'idle' && !u.proj) releaseUnit(u);
  for (let k = 0; k < 3; k++) setTimeout(() => poofAt(lot.x + rand(-5, 5), lot.z + rand(-5, 5)), k * 150);
  SFXcash();
  if (p.own === 'office') showEventPop('office-up', `⬆️ Офис ниво ${S.officeLevel}: ${officeLv().nm}`, `Бригади: ${officeLv().crews} · обекти наведнъж: ${officeLv().proj}`);
  if (p.own === 'office') toast(`🏢 Офисът е ниво ${S.officeLevel}: ${officeLv().nm}! Бригади: ${officeLv().crews}, обекти наведнъж: ${officeLv().proj}.`, 'good');
  else if (p.own === 'garage') toast(`🔧 Гаражът е ниво ${S.garageLevel}: ${garageLv().nm}! Места за техника: ${garageLv().cap}.`, 'good');
  else toast(`📦 Складът е ниво ${S.whLevel}: ${whLv().nm}! Побира ${whLv().mul}× повече материали.`, 'good');
}

// ============================================================ техника (единици)
const VEH_MODEL = { crew: 'delivery', loader: 'tractor-shovel', truck: 'truck-dump-red', tractor: 'tractor', crane: 'truck-flat', bulldozer: 'bulldozer-b', grader: 'tractor', paver: 'truck-flat', roller: 'tractor', marker: 'van' };
const VEH_SCALE = { truck: 0.62, bulldozer: 0.6 };   // моделите от строителния пакет са в метри
const VSCALE = 1.25, SPEED = 14;
const units = [];
let unitSeq = 1;
// място за паркиране: бусовете на бригадите са в двора на централата, техниката — в гаража
// (докато гаражът е в централата, всички са в нейния двор); които не се побират, стоят вътре (невидими)
function homeSlot(u) {
  const away = garageLotObj();
  const idx = list => { const k = list.indexOf(u); return k < 0 ? list.length : k; };
  if (away && isMachine(u.type)) {
    const k = idx(units.filter(q => isMachine(q.type)));
    if (k < 8) return { x: away.x - 6 + (k % 4) * 4, z: away.z + 1.5 + Math.floor(k / 4) * 4, inGarage: false };
    return { x: away.x, z: away.z - 4.2, inGarage: true };
  }
  const k = idx(away ? units.filter(q => !isMachine(q.type)) : units);
  if (k < 8) return { x: city.hq.x - 6 + (k % 4) * 4, z: city.hq.z + 3 + Math.floor(k / 4) * 4, inGarage: false };
  if (away && k < 10) return { x: city.hq.x + 2 + (k - 8) * 4, z: city.hq.z - 4.5, inGarage: false };
  return away ? { x: city.hq.x - 3.6, z: city.hq.z - 3.6, inGarage: true } : { x: city.hq.x + 3.8, z: city.hq.z - 4.3, inGarage: true };
}
// истинските модели (vehmodels.js) — дължина в света на играта
const SF_VEH = { loader: 'sf-excavator', truck: 'sf-dump', crane: 'sf-mcrane', tractor: 'sf-backhoe', roller: 'sf-roller', grader: 'sf-grader' };
const SF_LEN = { loader: 5.6, truck: 5.0, crane: 6.6, tractor: 4.6, roller: 3.4, grader: 6.2 };
function spawnUnit(type, at) {
  const sf = A[SF_VEH[type]] ? SF_VEH[type] : null;
  const obj = sf ? model(sf, SF_LEN[type]) : model(A[VEH_MODEL[type]] ? VEH_MODEL[type] : 'truck', A[VEH_MODEL[type]] ? VEH_SCALE[type] || VSCALE : VSCALE);
  if (type === 'crane' && !sf) {
    // жълта стрела отзад на платформата, за да личи, че е кран
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 3.2), new THREE.MeshStandardMaterial({ color: 0xffc400 }));
    arm.position.set(0, 1.6, -0.4); arm.rotation.x = -0.25; obj.add(arm);
  }
  // пътната техника: процедурни добавки върху базовите модели, за да се различават
  const addBox = (w, h, d, c, x, y, z, rx = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = true; obj.add(m); return m; };
  if (type === 'bulldozer' && !A['bulldozer-b']) addBox(2.6, 0.9, 0.25, 0xffb300, 0, 0.5, 1.9);   // без модела — процедурно гребло                          // гребло отпред
  if (type === 'grader' && !sf) { addBox(0.5, 0.35, 3.4, 0xffb300, 0, 0.8, 1.2); addBox(2.4, 0.5, 0.15, 0x555555, 0, 0.3, 0.9, 0.3); }   // дълга рама + нож
  if (type === 'paver') { addBox(2.2, 0.9, 1.5, 0xffb300, 0, 1.2, -0.6); addBox(2.6, 0.3, 0.5, 0x2a2a2a, 0, 0.3, -1.7); }       // бункер + плоча
  if (type === 'roller' && !sf) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.5, roughness: 0.4 })); d.rotation.z = Math.PI / 2; d.position.set(0, 0.7, 1.7); d.castShadow = true; obj.add(d); }
  if (type === 'marker') { addBox(1.4, 0.8, 0.12, 0xff7a00, 0, 2.1, -1.2); addBox(0.3, 0.12, 0.6, 0xffffff, 0.8, 0.2, -1.4); }  // стрелка + пръскачка
  scene.add(obj);
  const u = { id: unitSeq++, type, obj, yaw: 0, state: 'idle', path: null, pi: 0, proj: null, onArrive: null };
  const slot = u.home = at || homeSlot(u);
  u.x = slot.x; u.z = slot.z;
  obj.position.set(u.x, 0, u.z);
  units.push(u);
  return u;
}
function sendTo(u, x, z, onArrive) {
  const a = nearestRoad(u.x, u.z), b = nearestRoad(x, z);
  const tiles = bfs(a, b);
  u.path = tiles.map(([i, j]) => ({ x: tx(i), z: tx(j), road: true }));
  u.path.push({ x, z, road: false });
  u.pi = 0; u.state = u.state === 'working' || u.state === 'idle' ? 'driving' : u.state; u.onArrive = onArrive;
  if (u.state !== 'returning') u.state = 'driving';
}
function updateUnits(dt) {
  for (const u of units) {
    if (!u.path) {
      if (u.state === 'working') u.obj.position.y = Math.abs(Math.sin(performance.now() / 180 + u.id)) * 0.06;
      continue;
    }
    const wp = u.path[u.pi];
    let tx2 = wp.x, tz2 = wp.z;
    if (wp.road && u.pi > 0) {
      // дясно движение: изместване вдясно от посоката
      const pv = u.path[u.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1;
      tx2 += -dz / l * 1.9; tz2 += dx / l * 1.9;
    }
    const dx = tx2 - u.x, dz = tz2 - u.z, d = Math.hypot(dx, dz);
    const step = SPEED * dt;
    if (d <= step) {
      u.x = tx2; u.z = tz2; u.pi++;
      if (u.pi >= u.path.length) { u.path = null; const cb = u.onArrive; u.onArrive = null; if (cb) cb(); }
    } else {
      u.x += dx / d * step; u.z += dz / d * step;
      econ.addFuel(step);
      const want = Math.atan2(dx, dz);
      let dy = want - u.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      u.yaw += dy * Math.min(1, dt * 8);
    }
    u.obj.position.set(u.x, 0, u.z);
    u.obj.rotation.y = u.yaw;
  }
  // които не се побират на паркинга, стоят вътре
  for (const u of units) u.obj.visible = u.state !== 'away' && !(u.state === 'idle' && u.home && u.home.inGarage);
}
function releaseUnit(u) {
  u.proj = null;
  u.state = 'returning';
  const slot = u.home = homeSlot(u);
  sendTo(u, slot.x, slot.z, () => { u.state = 'idle'; u.yaw = Math.PI; u.obj.rotation.y = u.yaw; });
  u.state = 'returning';
}

// ============================================================ градски трафик (декорация)
const traffic = [];
function addCar() {
  const i = 3 * ((Math.random() * NBI) | 0), j = (Math.random() * N) | 0;
  const r = Math.random(), sf = A['sf-car-Sedan'];
  const o = sf ? model('sf-car-' + (r < 0.04 ? pick(['Ambulance', 'Police_Sedan', 'Police_SUV', 'Firetruck']) : r < 0.1 ? pick(['Bus', 'Truck', 'Van']) : pick(['Sedan', 'Hatchback', 'SUV', 'Pickup', 'Taxi', 'Sedan', 'Hatchback', 'SUV', 'Muscle', 'Muscle_2', 'Sports', 'Roadster', 'Taxi', 'Limousine'])), 1)
    : model(r < 0.04 ? pick(['ambulance', 'police', 'firetruck']) : pick(['sedan', 'taxi', 'suv', 'van', 'sedan', 'suv', 'sedan-sports', 'suv-luxury', 'hatchback-sports']), 1.15);
  scene.add(o);
  traffic.push({ obj: o, x: tx(i), z: tx(j), yaw: 0, path: null, pi: 0, wait: 0 });
}
function spawnTraffic(n) {
  for (const t of traffic) scene.remove(t.obj);
  traffic.length = 0;
  for (let k = 0; k < n; k++) addCar();
}
// колкото по-застроен е градът и по-голяма фирмата, толкова повече коли
function wantedTraffic() {
  const built = city.lots.filter(l => l.built).length;
  return Math.min(70, Math.round(8 + built * 0.45 + (S?.done || 0) * 0.5 + (S?.officeLevel || 1) * 2));
}

// ---- светофари на централните кръстовища: зелено по оста ns или ew, с жълто между тях
const signals = [];
const SIG_GREEN = 7, SIG_YELLOW = 1.6;
function buildSignals(g) {
  signals.length = 0;
  const lampGeo = new THREE.SphereGeometry(0.28, 10, 8);
  const mk = c => new THREE.MeshBasicMaterial({ color: c });
  const c = (NB - 1) / 2;
  for (let bi = 1; bi < NB; bi++) for (let bj = 1; bj < NB; bj++) {
    if (Math.max(Math.abs(bi - 0.5 - c), Math.abs(bj - 0.5 - c)) > 2.6) continue;   // само в центъра и средната зона
    const i = 3 * bi, j = 3 * bj, x = tx(i), z = tx(j);
    const sig = { i, j, x, z, t: Math.random() * (SIG_GREEN + SIG_YELLOW) * 2, heads: [] };
    // два стълба по диагонал; всеки има светлини за двете посоки
    for (const [sx, sz, ry] of [[1, 1, 0], [-1, -1, Math.PI]]) {
      const pole = model('traffic-light', 9, false);
      pole.position.set(x + sx * TILE * 0.55, 0, z + sz * TILE * 0.55); pole.rotation.y = ry;
      g.add(pole);
      for (const axis of ['ns', 'ew']) {
        const head = { axis, r: new THREE.Mesh(lampGeo, mk(0xff3030)), y: new THREE.Mesh(lampGeo, mk(0xffc400)), gr: new THREE.Mesh(lampGeo, mk(0x30ff60)) };
        const off = axis === 'ns' ? [0, 0.5] : [0.5, 0];
        [head.r, head.y, head.gr].forEach((m, k) => { m.position.set(pole.position.x + off[0] * sx, 4.1 - k * 0.6, pole.position.z + off[1] * sz); g.add(m); });
        sig.heads.push(head);
      }
    }
    signals.push(sig);
  }
}
const sigKey = (i, j) => i * 1000 + j;
let sigMap = new Map();
// фаза: 0 = зелено ns, 1 = жълто ns, 2 = зелено ew, 3 = жълто ew
const sigPhase = s => { const T = (SIG_GREEN + SIG_YELLOW) * 2, t = s.t % T; return t < SIG_GREEN ? 0 : t < SIG_GREEN + SIG_YELLOW ? 1 : t < 2 * SIG_GREEN + SIG_YELLOW ? 2 : 3; };
function updateSignals(dt) {
  if (sigMap.size !== signals.length) sigMap = new Map(signals.map(s => [sigKey(s.i, s.j), s]));
  for (const s of signals) {
    s.t += dt;
    const ph = sigPhase(s);
    for (const h of s.heads) {
      const mine = h.axis === 'ns' ? ph < 2 : ph >= 2, yellow = ph === 1 || ph === 3;
      h.gr.visible = mine && !yellow; h.y.visible = mine && yellow; h.r.visible = !mine;
    }
  }
}
// може ли кола, идваща по оста axis, да влезе в кръстовището?
function canEnter(i, j, axis) {
  const s = sigMap.get(sigKey(i, j)); if (!s) return true;
  const ph = sigPhase(s);
  return axis === 'ns' ? ph === 0 : ph === 2;
}
// ---- пешеходци: разхождат се по тротоарите (и през парковете); броят расте с града
const peds = [];
const PED_SIDE = 3.3;   // разстояние от оста на улицата до тротоара
function makePed() {
  const src = A.farmer || A.worker_male_alt;
  const m = cloneSkinned(src.scene);
  m.scale.setScalar(rand(1.05, 1.2));
  // различни дрехи: оцветяваме наситените (нетелесни) материали
  const hsl = { h: 0, s: 0, l: 0 }, hue = Math.random();
  m.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    o.material = o.material.clone();
    o.material.color.getHSL(hsl);
    const skin = hsl.h > 0.02 && hsl.h < 0.12 && hsl.l > 0.45;
    if (hsl.s > 0.25 && !skin) o.material.color.setHSL((hue + hsl.h * 0.3) % 1, Math.min(0.8, hsl.s + 0.1), hsl.l);
  });
  scene.add(m);
  const mixer = new THREE.AnimationMixer(m);
  const walk = src.animations.find(c => c.name === 'Walk');
  if (walk) mixer.clipAction(walk).play();
  mixer.update(Math.random() * 2);
  const i = 3 * ((Math.random() * NB) | 0), j = (Math.random() * N) | 0;
  const pd = { m, mixer, x: tx(i), z: tx(j), path: null, pi: 0, side: Math.random() < 0.5 ? 1 : -1, sp: rand(1.2, 1.8), yaw: 0 };
  peds.push(pd);
}
const wantedPeds = () => Math.min(26, 6 + Math.round(city.lots.filter(l => l.built).length * 0.18) + (S?.parks || []).length * 3);
// хора, които стоят по тротоарите на групички (истинските модели от Sketchfab — A['sf-person-N']); пешеходците, които вървят, си остават
const standers = [];
const wantedStanders = () => Math.min(30, 4 + Math.round(wantedPeds() * 0.9));
function addStanders() {
  const kinds = [0, 1, 2, 3, 4, 5].map(i => `sf-person-${i}`).filter(n => A[n]); if (!kinds.length) return;
  const vert = Math.random() < 0.5, i = 3 * ((Math.random() * (NB + 1)) | 0), j = Math.random() * (N - 1), side = Math.random() < 0.5 ? 1 : -1;
  const cx = vert ? tx(i) + side * PED_SIDE : tx(j), cz = vert ? tx(j) : tx(i) + side * PED_SIDE, n = 1 + ((Math.random() * 3) | 0);
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + Math.random(), r = n > 1 ? 0.7 : 0, m = model(pick(kinds), rand(1.85, 2.1));
    m.position.set(cx + Math.cos(a) * r, 0.05, cz + Math.sin(a) * r);
    m.rotation.y = n > 1 ? Math.atan2(cx - m.position.x, cz - m.position.z) : Math.random() * 6;   // в групичка се гледат един друг
    scene.add(m); standers.push(m);
  }
}
function updatePeds(dt) {
  if (!S || !city.ready) return;
  if (standers.length < wantedStanders() && Math.random() < dt * 2) addStanders();
  if (peds.length < wantedPeds() && Math.random() < dt * 0.6) makePed();
  for (const p of peds) {
    if (!p.path) {
      // до случаен ъгъл; понякога до парк
      const pk = (S.parks || []).length && Math.random() < 0.35 ? city.lots[pick(S.parks)] : null;
      const b = pk ? nearestRoad(pk.x, pk.z) : [3 * ((Math.random() * (NB + 1)) | 0), 3 * ((Math.random() * (NB + 1)) | 0)];
      p.path = bfs(nearestRoad(p.x, p.z), b).map(([i, j]) => ({ x: tx(i), z: tx(j) }));
      if (pk) p.path.push({ x: pk.x + rand(-4, 4), z: pk.z + rand(-4, 4), park: true });
      p.pi = 0;
    }
    const wp = p.path[p.pi];
    let x2 = wp.x, z2 = wp.z;
    if (p.pi > 0 && !wp.park) { const pv = p.path[p.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1; x2 += -dz / l * PED_SIDE * p.side; z2 += dx / l * PED_SIDE * p.side; }
    const dx = x2 - p.x, dz = z2 - p.z, d = Math.hypot(dx, dz), st = p.sp * dt;
    if (d <= st) { p.x = x2; p.z = z2; if (++p.pi >= p.path.length) p.path = null; }
    else { p.x += dx / d * st; p.z += dz / d * st; const w = Math.atan2(dx, dz); let dy = w - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 6); }
    p.m.position.set(p.x, 0.05, p.z); p.m.rotation.y = p.yaw;
    p.mixer.update(dt * p.sp / 1.5);
  }
}
function updateTraffic(dt) {
  if (S && traffic.length < wantedTraffic() && Math.random() < dt * 0.5) addCar();   // градът расте → идват още коли
  for (const t of traffic) {
    if (!t.path) {
      const b = [3 * ((Math.random() * (NBI + 1)) | 0), 3 * ((Math.random() * (NB + 1)) | 0)];
      t.path = bfs(nearestRoad(t.x, t.z), b).map(([i, j]) => ({ x: tx(i), z: tx(j), i, j }));
      t.pi = 0;
    }
    const wp = t.path[t.pi];
    let x2 = wp.x, z2 = wp.z, axis = null;
    if (t.pi > 0) { const pv = t.path[t.pi - 1], dx = wp.x - pv.x, dz = wp.z - pv.z, l = Math.hypot(dx, dz) || 1; x2 += -dz / l * 1.9; z2 += dx / l * 1.9; axis = Math.abs(dz) > Math.abs(dx) ? 'ns' : 'ew'; }
    const dx = x2 - t.x, dz = z2 - t.z, d = Math.hypot(dx, dz), st = 11 * dt;
    // спира пред стоп-линията на червено (ако още не е влязла в кръстовището)
    if (axis && d < TILE * 0.95 && d > TILE * 0.55 && !canEnter(wp.i, wp.j, axis)) { t.obj.position.set(t.x, 0, t.z); continue; }
    if (d <= st) { t.x = x2; t.z = z2; if (++t.pi >= t.path.length) t.path = null; }
    else { t.x += dx / d * st; t.z += dz / d * st; const w = Math.atan2(dx, dz); let dy = w - t.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); t.yaw += dy * Math.min(1, dt * 8); }
    t.obj.position.set(t.x, 0, t.z); t.obj.rotation.y = t.yaw;
  }
}

// ============================================================ строителни обекти (визуализация)
const fenceTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#ff7a00'; g.fillRect(k * 8, 0, 8, 16); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const dirtMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xb0b0aa, roughness: 0.9 });
const scaffoldMat = new THREE.LineBasicMaterial({ color: 0xd9a53a });

function buildingFor(type, floors = 20) {
  if (type === 'house') return pick(HOUSES);
  if (type === 'shop') return 'Building_Small_1';
  if (type === 'office') return 'Building_Medium_2_001';
  if (floors >= 15 && SF_SKY().length && Math.random() < 0.4) return pick(SF_SKY());   // разнообразие: истински небостъргачи
  if (floors > 20 || (cityTier(S.cityId) === 'xl' && A['building-skyscraper-d@20'])) return `${pick(MODERN_SKY)}@${Math.max(20, floors)}`;
  return `${pick(SKY)}@${Math.min(20, floors)}`;
}
// небостъргачите в поръчките са на 10, 15 или 20 етажа: наградата, срокът и работата растат с височината
const TOWER_MUL = { 10: 0.6, 15: 0.8, 20: 1, 25: 1.25, 30: 1.5 };
const workMul = p => (p.floors && TOWER_MUL[p.floors]) || 1;
function sizeTower(o) {
  if (o.type !== 'tower') return o;
  o.floors = pick(TOWER_FLOORS[cityTier(S.cityId)].length ? TOWER_FLOORS[cityTier(S.cityId)] : [10]);
  const k = TOWER_MUL[o.floors];
  o.reward = Math.round(o.reward * k / 500) * 500;
  o.days = Math.round(o.days * (0.6 + 0.4 * k));
  return o;
}
// собствен строеж: ограда и скеле около офиса/гаража; новият гараж минава през изкоп и основи
function makeOwnSite(p) {
  const lot = city.lots[p.lot], g = new THREE.Group();
  g.position.set(lot.x, 0, lot.z);
  scene.add(g);
  const v = p.vis = { g, own: true };
  const inHQ = lot === city.hq, fresh = p.type === 'own_garage_new' || p.type === 'own_wh_new';
  // зоната на строежа в координатите на парцела: [x, z, ширина, дълбочина, височина]
  const area = p.own === 'office' ? [-3.6, -3.6, 9, 9, (city.hqGroup?.userData.officeTop || 4) + 1.5]
    : inHQ ? [3.8, -4.3, 8, 7, 5.5] : fresh ? [0, 0, 15.5, 15.5, 6] : [0, -4.2, 16, 8, 7];
  const [ax, az, aw, ad, ah] = area;
  const fm = new THREE.MeshStandardMaterial({ map: fenceTex });
  const side = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.15), fm); m.position.set(ax + x, 0.55, az + z); m.rotation.y = ry; m.castShadow = true; g.add(m); };
  side(aw, 0, -ad / 2, 0); side(ad, -aw / 2, 0, Math.PI / 2); side(ad, aw / 2, 0, Math.PI / 2); side(aw * 0.35, -aw * 0.325, ad / 2, 0); side(aw * 0.35, aw * 0.325, ad / 2, 0);
  v.sign = label(`🔨 ${p.title}`, '#ffd54a', 10);
  v.sign.position.set(ax, ah + 3, az);
  g.add(v.sign);
  // скеле
  const pts = [], W = aw / 2 - 0.3, D = ad / 2 - 0.3;
  for (let a = -W; a <= W + 0.01; a += 2.5) for (const z of [-D, D]) pts.push(ax + a, 0, az + z, ax + a, ah, az + z);
  for (let a = -D; a <= D + 0.01; a += 2.5) for (const x of [-W, W]) pts.push(ax + x, 0, az + a, ax + x, ah, az + a);
  for (let y = 2.5; y <= ah; y += 2.5) for (const [x1, z1, x2, z2] of [[-W, -D, W, -D], [W, -D, W, D], [W, D, -W, D], [-W, D, -W, -D]]) pts.push(ax + x1, y, az + z1, ax + x2, y, az + z2);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  v.scaffold = new THREE.LineSegments(sg, scaffoldMat);
  v.scaffold.visible = !fresh;
  g.add(v.scaffold);
  if (fresh) {
    v.dirt = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), dirtMat); v.dirt.rotation.x = -Math.PI / 2; v.dirt.position.y = 0.04; v.dirt.receiveShadow = true; g.add(v.dirt);
    v.mound = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1, 10), dirtMat); v.mound.position.set(5, 0, 5); v.mound.castShadow = true; g.add(v.mound);
    v.slab = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 14), concreteMat); v.slab.visible = false; v.slab.receiveShadow = true; g.add(v.slab);
    v.preview = p.own === 'warehouse' ? warehouseMesh(p.target) : garageMesh(p.target, Math.min(15, 8 + p.target * 0.7), 6 + Math.min(p.target, 8) * 0.15);
    v.preview.position.set(0, 0, p.own === 'warehouse' ? -4 : -4.2); v.preview.visible = false;
    g.add(v.preview);
  }
}
function updateOwnSite(p) {
  const v = p.vis, k = p.prog;
  if (!v.dirt) return;
  v.mound.visible = p.stage <= 1;
  if (p.stage === 0) { v.mound.scale.set(1, 0.2 + k * 3, 1); v.mound.position.y = (0.2 + k * 3) / 2; }
  if (p.stage === 1) { const s = 1 - k * 0.8; v.mound.scale.set(s, 3.2 * s, s); v.mound.position.y = 1.6 * s; }
  v.slab.visible = p.stage >= 1;
  if (p.stage >= 1) { const h = p.stage === 1 ? 0.05 + k * 0.25 : 0.3; v.slab.scale.y = h; v.slab.position.y = h / 2; }
  v.preview.visible = v.scaffold.visible = p.stage >= 2;
  if (p.stage >= 2) { v.preview.scale.y = Math.max(0.02, k); v.preview.position.y = 0.3; }
}
// събаряне: скеле, кран с топка, сградата пада на части; техниката чака, докато свърши
function makeDemoSite(p) {
  const lot = city.lots[p.lot], g = new THREE.Group();
  g.position.set(lot.x, 0, lot.z);
  scene.add(g);
  const sign = label(`🔨 Събаряне · ${p.client}`, '#ffb46b', 11); sign.position.set(0, 14, 0); g.add(sign);
  if (A['container-rubble-red']) { const rc = model('container-rubble-red', 0.8); rc.position.set(-6.2, 0.05, 6.4); rc.rotation.y = Math.PI / 2; g.add(rc); }
  p.vis = { g, demoOnly: true, demo: createDemolition(lot.obj, city.group), t: null };
}
function finishDemo(p) {
  const lot = city.lots[p.lot];
  if (p.vis && p.vis.demoOnly) { p.vis.demo.dispose(); scene.remove(p.vis.g); p.vis = null; }
  clearLot(lot);
  delete p.demo;
  makeSite(p);
  refreshEstateSigns();
  toast(`🧱 Старата сграда е съборена. Започва строежът на „${p.title}“.`, 'good');
  dispatch();
  save();
}
function makeSite(p) {
  if (p.demo && city.lots[p.lot].obj) return makeDemoSite(p);
  if (p.maint || p.remodel || p.park) return makeRenoSite(p);
  if (p.own) return makeOwnSite(p);
  if (p.reno) return makeRenoSite(p);
  const lot = city.lots[p.lot];
  for (const t of lot.trees || []) city.group.remove(t);
  lot.trees = [];
  const g = new THREE.Group();
  g.position.set(lot.x, 0, lot.z);
  scene.add(g);
  const v = p.vis = { g };
  // ограда (отпред има вход)
  const fm = new THREE.MeshStandardMaterial({ map: fenceTex });
  const side = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, 0.15), fm); m.position.set(x, 0.55, z); m.rotation.y = ry; m.castShadow = true; g.add(m); };
  side(15.5, 0, -7.75, 0); side(15.5, -7.75, 0, Math.PI / 2); side(15.5, 7.75, 0, Math.PI / 2); side(5.5, -5, 7.75, 0); side(5.5, 5, 7.75, 0);
  for (const [x, z] of [[-2.2, 8.4], [2.2, 8.4]]) { const c = model('construction-cone', 6); c.position.set(x, 0, z); g.add(c); }
  // табела
  v.sign = label(`${BTYPES[p.type].ico} ${p.client}`, '#ffd54a', 11);
  v.sign.position.set(0, 12, 0);
  g.add(v.sign);
  // пръст, купчина, основа
  v.dirt = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), dirtMat); v.dirt.rotation.x = -Math.PI / 2; v.dirt.position.y = 0.04; v.dirt.visible = false; v.dirt.receiveShadow = true; g.add(v.dirt);
  v.mound = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1, 10), dirtMat); v.mound.position.set(4.5, 0, -4.5); v.mound.visible = false; v.mound.castShadow = true; g.add(v.mound);
  v.slab = new THREE.Mesh(new THREE.BoxGeometry(12.6, 1, 12.6), concreteMat); v.slab.visible = false; v.slab.castShadow = v.slab.receiveShadow = true; g.add(v.slab);
  // бетоновоз до основите (вижда се по време на етап „Основи“)
  if (A['truck-concrete-red']) { v.mixer = model('truck-concrete-red', 0.62); v.mixer.position.set(4.2, 0.05, 3.2); v.mixer.rotation.y = -Math.PI / 2; v.mixer.visible = false; g.add(v.mixer); }
  // сградата се „издига“ чрез клипинг равнина
  v.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const tmpLot = { x: 0, z: 0 };
  const isQ = p.model.startsWith('Building_');
  const s = isQ ? fitScale(p.model, 14) : HOUSES.includes(p.model) ? fitScale(p.model, 11) : fitScale(p.model, 12.5);
  const b = model(p.model, s);
  if (HOUSES.includes(p.model)) tintRoof(b, p.lot);
  const bb = new THREE.Box3().setFromObject(b);
  b.position.set(tmpLot.x - (bb.min.x + bb.max.x) / 2, 0.6, tmpLot.z - (bb.min.z + bb.max.z) / 2);
  b.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [v.clip]; o.material.clipShadows = true; } });
  dayNight.registerWindows(b);
  b.visible = false;
  g.add(b);
  v.building = b; v.H = bb.max.y - bb.min.y;
  // скеле: вертикални тръби и хоризонтали през 3 м
  const pts = [], W = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 0.8, H = v.H + 1.5;
  for (let a = -W; a <= W + 0.01; a += 2.5) for (const [x, z] of [[a, -W], [a, W], [-W, a], [W, a]]) pts.push(x, 0.6, z, x, H, z);
  for (let y = 3; y <= H; y += 3) for (const [x1, z1, x2, z2] of [[-W, -W, W, -W], [W, -W, W, W], [W, W, -W, W], [-W, W, -W, -W]]) pts.push(x1, y, z1, x2, y, z2);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  v.scaffClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  v.scaffold = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9a53a, clippingPlanes: [v.scaffClip] }));
  v.scaffold.visible = false;
  g.add(v.scaffold);
  // кран-кула (вижда се, докато кран работи на обекта): за по-големите сгради истински модел, за къщите — простият
  if (p.type !== 'house' && A['crane-tower']) {
    const k = (v.H + 12) / 56, pivot = new THREE.Group(), m = model('crane-tower', k);
    m.position.set(-6 * k, 0, 10.75 * k);   // мачтата на модела е в (6, −10.75): слагаме я в оста на завъртане
    pivot.add(m);
    pivot.userData = { real: true, base: Math.PI / 4 };
    v.crane = pivot;
  } else v.crane = makeTowerCrane(v.H + 9);
  v.crane.position.set(-W - 1.5, 0, -W - 1.5);
  v.crane.visible = false;
  g.add(v.crane);
  addSiteLights(g, 7.6, 9);   // прожектори нощем (sitelights.js)
  // фургон, тоалетна, дъски и кашони в ъглите на обекта
  const prop = (n, s, x, z, ry) => { if (!A[n]) return; const o = model(n, s); o.position.set(x, 0.05, z); o.rotation.y = ry; g.add(o); };
  prop(p.id % 2 ? 'container-office-green' : 'container-office-red', 0.45, -6.5, -4.6, 0);
  prop('toilet-portable', 0.75, 6.7, 6.7, Math.PI);
  prop('planks-wood-a', 0.45, -6.8, 4.5, 0);
  prop('box-stack-brown', 0.6, 6.6, -6.4, Math.PI / 2);
  prop('barrel', 0.6, 6.9, 4.9, 0);
}
function makeTowerCrane(h) {
  const g = new THREE.Group(), y = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.6 });
  const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), y); mast.position.y = h / 2; mast.castShadow = true; g.add(mast);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, h, 1.25, 1, Math.round(h / 1.5), 1)), new THREE.LineBasicMaterial({ color: 0x7a5a00 }));
  edges.position.y = h / 2; g.add(edges);
  const top = new THREE.Group(); top.position.y = h; g.add(top);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 22), y); jib.position.z = 7; jib.castShadow = true; top.add(jib);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x555555 })); cw.position.set(0, -0.2, -4.5); top.add(cw);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); cab.position.set(0, -1, 0.9); top.add(cab);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), new THREE.MeshBasicMaterial({ color: 0x222222 })); top.add(cable);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: 0x333333 })); top.add(hook);
  g.userData = { top, cable, hook, h };
  return g;
}
function updateSite(p, t) {
  if (p.vis && p.vis.demoOnly) { const v = p.vis, dt = v.t == null ? 0 : Math.min(0.2, Math.max(0, t - v.t)); v.t = t; v.demo.update(p.demo.prog, dt); return; }
  const v = p.vis; if (!v) return;
  if (v.own) return updateOwnSite(p);
  if (v.reno) return;
  const st = p.stage, k = p.prog;
  v.dirt.visible = st >= 0;
  v.mound.visible = st === 0 || st === 1;
  if (st === 0) { v.mound.scale.set(1, 0.2 + k * 3, 1); v.mound.position.y = (0.2 + k * 3) / 2; }
  if (st === 1) { const s = 1 - k * 0.8; v.mound.scale.set(s, 3.2 * s, s); v.mound.position.y = 1.6 * s; }
  v.slab.visible = st >= 1;
  if (v.mixer) v.mixer.visible = st === 1;
  if (st >= 1) { const h = st === 1 ? 0.05 + k * 0.6 : 0.65; v.slab.scale.y = h; v.slab.position.y = h / 2; }
  v.building.visible = st >= 2;
  if (st === 2) v.clip.constant = 0.6 + v.H * k;
  if (st >= 3) v.clip.constant = 1e4;
  v.scaffold.visible = st >= 2;
  if (st === 2) v.scaffClip.constant = 0.6 + (v.H + 1.5) * Math.min(1, k + 0.08);
  if (st === 3) v.scaffClip.constant = 0.6 + (v.H + 1.5) * (1 - k);
  const craneHere = units.some(u => u.proj === p && u.type === 'crane' && u.state === 'working');
  v.crane.visible = craneHere;
  if (craneHere && v.crane.userData.real) v.crane.rotation.y = v.crane.userData.base + Math.sin(t * 0.25 + p.id) * 0.7;   // стрелата бавно се върти над обекта
  else if (craneHere) {
    const d = v.crane.userData, a = t * 0.35 + p.id;
    d.top.rotation.y = Math.sin(a) * 1.4;
    const reach = 8 + Math.sin(a * 1.7) * 4, drop = 4 + (Math.sin(a * 2.3) * 0.5 + 0.5) * (d.h - 8);
    d.cable.position.set(0, -drop / 2, reach); d.cable.scale.y = drop;
    d.hook.position.set(0, -drop, reach);
  }
}
const WORK_CLIPS = ['Interact', 'Punch_Right', 'Sword_Slash', 'Interact'];
function makeWorker(g) {
  const src = A[Math.random() < 0.6 ? 'worker_male' : 'worker_male_alt'];
  const m = cloneSkinned(src.scene);
  m.scale.setScalar(1.15);
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  g.add(m);
  const mixer = new THREE.AnimationMixer(m), acts = {};
  for (const c of src.animations) acts[c.name] = mixer.clipAction(c);
  const w = { m, mixer, acts, cur: null, x: rand(-5, 5), z: rand(-5, 5), tx: 0, tz: 0, t: 0 };
  w.play = n => { const a = acts[n]; if (!a || a === w.cur) return; a.reset().fadeIn(0.2).play(); if (w.cur) w.cur.fadeOut(0.2); w.cur = a; };
  m.position.set(w.x, 0.05, w.z);
  return w;
}
function updateWorkers(p, dt) {
  const v = p.vis;
  if (!v || v.demoOnly) return;
  v.workers = v.workers || [];
  const crews = units.filter(u => u.proj === p && u.type === 'crew' && u.state === 'working').length;
  const want = Math.min(9, crews * 3);
  while (v.workers.length < want) v.workers.push(makeWorker(v.g));
  while (v.workers.length > want) { const w = v.workers.pop(); v.g.remove(w.m); }
  const top = p.stage === 1 ? 0.05 + p.prog * 0.6 : p.stage >= 2 ? 0.65 : 0.05;
  for (const w of v.workers) {
    w.t -= dt;
    if (w.t <= 0) {   // ново място за работа на обекта
      w.tx = rand(-5.5, 5.5); w.tz = rand(-5.5, 5.5); w.t = rand(4, 9); w.work = WORK_CLIPS[(Math.random() * WORK_CLIPS.length) | 0];
    }
    const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
    if (d > 0.2) { const st = Math.min(d, 1.6 * dt); w.x += dx / d * st; w.z += dz / d * st; w.m.rotation.y = Math.atan2(dx, dz); w.play('Walk'); }
    else w.play(w.work);
    w.m.position.set(w.x, top, w.z);
    w.mixer.update(dt);
  }
}
function finishSite(p) {
  const v = p.vis, lot = city.lots[p.lot];
  scene.remove(v.g);
  if (p.own) { p.vis = null; return; }
  // сградата остава като част от града
  placeBuilding(lot, p.model, 0);
  if (p.type === 'house') for (const [x, z] of [[-6, 6], [6, 6]]) { const tr = model('tree-large', 8); tr.position.set(lot.x + x, 0, lot.z + z); city.group.add(tr); }
  p.vis = null;
}

// ============================================================ пачки пари на покрива
const noteTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 256, 128); grd.addColorStop(0, '#9dff9a'); grd.addColorStop(1, '#3fd46a');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#e8f5e9'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 112);
  g.fillStyle = '#ffffff'; g.font = 'bold 54px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('100 €', 128, 66);
  g.fillStyle = '#ffd54a'; g.fillRect(112, 0, 32, 128);   // банд
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const edgeTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 64; y += 3) { g.fillStyle = y % 6 ? '#f2fff2' : '#7dff9a'; g.fillRect(0, y, 64, 3); }
  g.fillStyle = '#ffd54a'; g.fillRect(26, 0, 12, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
// пачките светят със собствената си текстура (emissiveMap), за да се виждат ясно и нощем
const stackGeo = new THREE.BoxGeometry(2.6, 1.0, 1.3);
const stackMats = [edgeTex, edgeTex, noteTex, noteTex, edgeTex, edgeTex].map(m => new THREE.MeshStandardMaterial({ map: m, roughness: 0.6, emissive: 0xffffff, emissiveMap: m, emissiveIntensity: 0.75 }));
// светлинен лъч над покрива и ореол — видими отдалеч
const beamTex = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(125,255,168,0)'); grd.addColorStop(1, 'rgba(125,255,168,1)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();
const beamGeo = new THREE.CylinderGeometry(1.6, 2.4, 40, 20, 1, true).translate(0, 20, 0);
const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const haloTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,240,150,0.9)'); grd.addColorStop(0.4, 'rgba(125,255,168,0.45)'); grd.addColorStop(1, 'rgba(125,255,168,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const cashObjs = [];
function spawnCash(cash) {
  const lot = city.lots[cash.lot];
  const g = new THREE.Group(); g.userData.born = performance.now();
  const bb = lot.obj ? new THREE.Box3().setFromObject(lot.obj) : null;
  const top = bb ? bb.max.y : 8;
  g.position.set(lot.x, top + 2.2, lot.z);
  // една пачка на всеки 10 000 € (най-много 10)
  const n = Math.max(1, Math.min(10, Math.round(cash.amount / 10000)));
  for (let k = 0; k < n; k++) {
    const m = new THREE.Mesh(stackGeo, stackMats);
    const a = k / n * Math.PI * 2, r = n === 1 ? 0 : 1.7 + n * 0.17;
    m.position.set(Math.cos(a) * r, (k % 3) * 1.05, Math.sin(a) * r);
    m.rotation.y = a;
    m.castShadow = true;
    m.userData.cash = cash;
    g.add(m);
  }
  const lab = label(`💶 +${fmt(cash.amount)} € · натисни`, '#7dffa8', 15, 'rgba(10,40,20,.92)');
  lab.position.y = 5;
  g.add(lab);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.y = -0.4; g.add(ring);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = -0.4; g.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(9, 9, 1); halo.position.y = -0.2; halo.renderOrder = -1; g.add(halo);
  g.userData = { cash, ring, halo, t: Math.random() * 6 };
  scene.add(g);
  cashObjs.push(g);
}
function updateCash(dt) {
  for (const g of cashObjs) {
    const u = g.userData;
    u.t += dt;
    if (u.fly != null) {   // излита нагоре след клик
      u.fly += dt;
      g.position.y += dt * (8 + u.fly * 30);
      g.scale.setScalar(Math.max(0.01, 1 - u.fly * 1.2));
      continue;
    }
    g.children.forEach((m, k) => { if (m.userData.cash) m.position.y = (k % 3) * 1.05 + Math.sin(u.t * 2.5 + k) * 0.2; });
    g.rotation.y += dt * 0.6;
    u.ring.scale.setScalar(1 + Math.sin(u.t * 4) * 0.15);
    u.halo.material.opacity = 0.4 + Math.sin(u.t * 3) * 0.15;
  }
  for (let k = cashObjs.length - 1; k >= 0; k--) if (cashObjs[k].userData.fly > 0.9) { scene.remove(cashObjs[k]); cashObjs.splice(k, 1); }
}
function collectCash(g) {
  const cash = g.userData.cash;
  if (g.userData.fly != null) return;
  g.userData.fly = 0;
  econ.earn(cash.amount, 'обект', `${cash.title} — ${cash.note}`);
  S.cash.splice(S.cash.indexOf(cash), 1);
  SFXcash();
  toast(`💶 +${fmt(cash.amount)} € от „${cash.title}“`, 'good');
  // броячът горе подскача
  const m = $('money'); m.style.transition = 'none'; m.style.transform = 'scale(1.35)'; m.style.color = '#7dffa8';
  requestAnimationFrame(() => { m.style.transition = 'transform .5s, color .8s'; m.style.transform = ''; m.style.color = ''; });
  save();
  renderPanel();
}
function SFXcash() { Sound.play('cash'); }
// прибира наведнъж всички пари от покривите (при влизане в града) — едно общо съобщение
function collectAllCash(why = '') {
  if (!S || !S.cash || !S.cash.length) return 0;
  let tot = 0, n = 0;
  for (const g of cashObjs) { const c = g.userData.cash; if (!c || g.userData.fly != null) continue; g.userData.fly = 0; tot += c.amount; n++; S.cash.splice(S.cash.indexOf(c), 1); }
  if (!n) return 0;
  econ.earn(tot, 'обект', `Прибрани пари от ${n} обекта`);
  SFXcash(); toast(`💶 +${fmt(tot)} € — прибрани автоматично от ${n} ${n === 1 ? 'обект' : 'обекта'}${why}`, 'good');
  save(); renderPanel();
  return tot;
}
// в завършен град парите се прибират веднага; в останалите — ако стоят на покрива над 20 секунди
function autoCollectFinished() {
  if (!S || !econ) return;
  const fin = econ.isFinished && econ.isFinished(S.cityId), now = performance.now();
  const g = cashObjs.find(o => o.userData.cash && o.userData.fly == null && (fin || now - (o.userData.born || now) > 20000));
  if (g) collectCash(g);
}

// ТИР-ове с материали: идват от източния край на града по улиците до склада (или двора на централата)
const tirs = createTirs({
  scene, model, label,
  roadPath: (x0, z0, x1, z1) => bfs(nearestRoad(x0, z0), nearestRoad(x1, z1)).map(([i, j]) => ({ x: tx(i), z: tx(j) })),
  entry: () => ({ x: tx(NI - 1), z: tx(3 * Math.round((N - 1) / 6)) }),
  matInfo: id => ECON.MATERIALS[id],
});
const whTarget = () => S.whLot != null ? { x: city.lots[S.whLot].x, z: city.lots[S.whLot].z + 3.5 } : { x: city.hq.x, z: city.hq.z + 5 };
function sendTir(order, delay = 0) {
  tirs.send(order, whTarget(), o => {
    if (!econ.receive(o.id)) return;
    refreshWarehouse();
    for (const p of projects) p.matWarned = false;
    Sound.play('truck');
    const m = ECON.MATERIALS[o.matId];
    toast(`🚚 ТИР разтовари ${m.ico} ${m.nm}: ${o.qty} ${m.unit} в склада.`, 'good');
    save();
    if (tab === 'store') renderPanel();
  }, delay);
}
// ТИР до строеж: спира на улицата пред оградата; стоката влиза в наличността и етапът продължава
function sendSiteTir(order, delay = 0) {
  const lot = city.lots[order.lot];
  tirs.send(order, { x: lot.x, z: lot.z }, o => {
    if (!econ.receive(o.id)) return;
    for (const p of projects) p.matWarned = false;
    Sound.play('truck');
    const m = ECON.MATERIALS[o.matId], p = projects.find(q => q.lot === o.lot);
    toast(`🚚 ТИР разтовари ${m.ico} ${m.nm}: ${o.qty} ${m.unit}${p ? ` на „${p.title}“` : ''}.`, 'good');
    save();
  }, delay);
}
// звукът тръгва след първото действие на играча (изискване на браузъра)
addEventListener('pointerdown', () => Sound.init(), { once: false });
addEventListener('keydown', () => Sound.init());

// ============================================================ състояние на играта
let S = null;          // записваемото състояние
let econ = null;
const projects = [];   // активните обекти (огледало на S.projects с визуализация)

function newGame(cityId) {
  S = { v: 1, cityId, hqCity: cityId, cities: {}, day: 1, dayT: 0, rep: 0, cash: [], officeLevel: 1, garageLevel: 1, garageLot: null, whLevel: 0, whLot: null, cityExt: AUTOTEST ? +params.get('ext') || 0 : 0, rails: [], trains: [], jobs: [], econ: ECON.newEconState(), units: [...ECON.START.units], projects: [], offers: [], built: [], done: 0, seq: 1 };
  enterCity();
  S.projects = projects;
  for (let k = 0; k < 3; k++) makeOffer();
  renderPanel();   // първите поръчки се появяват след първото рисуване на панела
  setTimeout(() => { showEventPop('lv-1', '🏅 Ниво 1 — началото!', 'Завършвай обекти, строй линии и магистрали, за да расте фирмата до ниво 10.'); Sound.play('levelup'); }, 900);
  toast(`Фирмата е основана в град ${cityName()}! Приеми първата поръчка от таблото.`, 'good');
  save();
}
const cityName = () => CITIES.find(c => c.id === S.cityId).nm;

function enterCity() {
  if (!city.ready) { setupWorld(); fastForward(); }
  showMap(false);
  $('panel').classList.remove('hidden');
  renderPanel();
}
function setupWorld() {
  city.ready = true;
  S.hqCity = S.hqCity || S.cityId; S.cities = S.cities || {};
  if (!S.tut && (S.done || 0) > 3) S.tut = { step: 99, off: true };   // опитен играч — без урок
  econ = new ECON.Economy(S.econ, { toast, cityName: id => cityById(id)?.nm, changed: () => { save(); renderPanel(); }, takeover: id => takeoverChoice(id), stockVisible: c => !c.cc || ownedCities().some(id => cityById(id)?.cc === c.cc), liquidated: (c, total, pr) => { showEventPop('sold', `💰 Разпродажба: ${c.nm}`, `+${fmt(total)} € · ${pr >= 0 ? 'печалба' : 'загуба'} ${fmt(Math.abs(pr))} € спрямо цената`); quests.emit('liquidate'); }, incomeMul: id => wonIncomeMul(id, x => econ.isFinished(x)), stocksOpen: () => dev.stocksOpen() });
  if (econ.setCity) econ.setCity(S.cityId);   // оборотът от обекти се води по градове
  buildCity(S.cityId);
  for (const u of units) scene.remove(u.obj);
  units.length = 0;
  // стари записи: общото ниво на централата става ниво и на офиса, и на гаража (гаражът остава в централата)
  if (S.officeLevel == null) { S.officeLevel = S.hqLevel || 1; S.garageLevel = S.hqLevel || 1; S.garageLot = null; }
  delete S.hqLevel;
  if (S.whLevel == null) { S.whLevel = 0; S.whLot = null; }
  if (S.garageLot != null) city.lots[S.garageLot].busy = 'garage';
  if (S.whLot != null) city.lots[S.whLot].busy = 'warehouse';
  for (const k of Object.keys(S.lotAuto || {})) if (S[lotKey[k]] == null) autoLot(k);   // строено от картата, докато не беше тук
  delete S.lotAuto;
  S.units.forEach((t, i) => { const u = spawnUnit(t); u.xp = (S.unitXp || [])[i] || 0; });
  buildHQ();
  for (const id of S.cleared || []) { const l = city.lots[id]; if (l.obj) city.group.remove(l.obj); l.obj = null; l.built = null; for (const t of l.trees || []) city.group.remove(t); l.trees = []; }
  for (const b of S.built) placeBuilding(city.lots[b.lot], b.model, 0);
  for (const g of cashObjs) scene.remove(g);
  cashObjs.length = 0;
  for (const c of S.cash || []) spawnCash(c);
  if (!AUTOTEST || !params.has('nocollect')) setTimeout(() => collectAllCash(' при влизането в града'), 1200);
  setTimeout(fleetBrief, 3400);
  setTimeout(maybeLinkOffer, 2600);
  // S.projects и projects трябва да са един масив (иначе всеки нов обект се записва два пъти); стари записи — без дубликати
  const elsewhere = new Set(Object.values(S.cities || {}).flatMap(c => (c.projects || []).map(p => p.id)));
  const seen = new Set(), list = S.projects.filter(p => city.lots[p.lot] && !elsewhere.has(p.id) && !seen.has(p.id) && seen.add(p.id));
  S.offers = (S.offers || []).filter(o => city.lots[o.lot]);
  for (const p of projects) if (p.vis) scene.remove(p.vis.g);
  projects.length = 0;
  for (const p of list) { projects.push(p); makeSite(p); }
  S.projects = projects;
  for (const o of S.offers) city.lots[o.lot].busy = 'offer';
  for (const p of S.projects) if (city.lots[p.lot] !== city.hq) city.lots[p.lot].busy = 'project';
  spawnTraffic(wantedTraffic());
  buildStation();
  weather.set(S.weather || 'clear'); weather.setCover(S.snowCover || 0);
  S.hwJobs = S.hwJobs || []; S.hwDone = S.hwDone || [];
  for (const j of S.hwJobs) for (const u of units) if (u.proj && u.proj.seg === j.seg) u.proj = j;
  buildCityHighway();
  { const E = est(); for (const id of E.land) city.lots[id].busy = 'land'; for (const o of E.owned) if (city.lots[o.lot].busy !== 'project') city.lots[o.lot].busy = 'owned'; for (const l of E.listings) city.lots[l.lot].busy = 'listing'; }
  for (const id of rivals.busyLots()) if (city.lots[id] && !city.lots[id].built) city.lots[id].busy = 'rival';
  restoreSpurs();
  refreshTender3D();
  refreshLandmarks();
  parkGroups.length = 0;
  for (const id of S.parks || []) { const l = city.lots[id]; if (!l) continue; for (const t of l.trees || []) city.group.remove(t); l.trees = []; if (l.obj) city.group.remove(l.obj); placePark(l); l.busy = 'park'; }
  refreshEstateSigns();
  tirs.clear();
  // стоката, която беше на път при записа, пак тръгва: към строежа, ако той още е тук, иначе към склада
  econ.s.transit.forEach((o, k) => (o.lot != null && o.city === S.cityId && projects.some(p => p.lot === o.lot) ? sendSiteTir : sendTir)(o, k * 1.5));
  S.rails = S.rails || []; S.trains = S.trains || []; S.jobs = S.jobs || [];
  controls.target.set(city.hq.x, 0, city.hq.z);
  camera.position.set(city.hq.x + 55, 85, city.hq.z + 90);
}

function freeLots(type) {
  const pref = type === 'house' ? ['outer', 'mid'] : type === 'shop' ? ['mid', 'outer', 'center'] : ['center', 'mid'];
  return city.lots.filter(l => !l.built && !l.busy).sort((a, b) => pref.indexOf(a.zone) - pref.indexOf(b.zone) + (Math.random() - 0.5) * 1.5);
}
function makeOffer() {
  const tier = cityTier(S.cityId);
  const avail = offerTypes().filter(([k, t]) => S.rep >= t.rep && !(tier === 's' && (k === 'tower' || (k === 'office' && S.rep < 4))) && !(tier === 'm' && k === 'tower' && Math.random() < 0.5));
  // по-малките поръчки са по-чести
  const w = avail.map(([k], i) => avail.length - i * 0.6);
  let r = Math.random() * w.reduce((a, b) => a + b, 0), type = avail[0][0];
  for (let i = 0; i < avail.length; i++) if ((r -= w[i]) <= 0) { type = avail[i][0]; break; }
  const lot = freeLots(type)[0];
  if (!lot) return;
  const bt = BTYPES[type];
  const client = type === 'house' ? pick(CLIENTS.slice(0, 7)) : pick(CLIENTS.slice(7));
  const o = sizeTower({ id: S.seq++, type, lot: lot.id, client, reward: Math.round(ECON.quoteReward(type, S.rep) * (hasStaff('architect') ? 1.1 : 1) * dev.offerMul() * events.offerMul() / 500) * 500, days: bt.days, expires: S.day + 4 });
  lot.busy = 'offer';
  S.offers.push(rivals.attach(o));
}
// наддаване (bidding.js): избраният множител на цената за всяка оферта
const bidSel = {};
// „Предложи всички“ (от 3 ★): праща офертите една след друга, докато офисът има място; накрая едно обобщение
function offerAll() {
  if (S.rep < 3) return;
  let won = 0, lost = 0, money = 0;
  const ids = [...S.offers].sort((a, b) => (b.demolish ? 1 : 0) - (a.demolish ? 1 : 0)).map(o => o.id), quiet = toast;
  for (const id of ids) {
    if (busyCount() >= officeLv().proj) break;
    const o = S.offers.find(x => x.id === id); if (!o) continue;
    acceptOffer(id);
    const p = projects.find(q => q.id === id);
    if (p) { won++; money += p.reward; } else if (!S.offers.some(x => x.id === id)) lost++;
  }
  tab = 'offers';
  const left = S.offers.length;
  toast(`📨 Предложи ${won + lost} оферти: спечели ${won} (+${fmt(money)} €)${lost ? `, загуби ${lost}` : ''}${left ? ` · ${left} чакат — офисът е пълен` : ''}.`, won ? 'good' : 'bad');
  save(); renderPanel();
}
function acceptOffer(id) {
  const i = S.offers.findIndex(o => o.id === id);
  if (i < 0) return;
  const active = busyCount();
  if (active >= officeLv().proj) { toast(`Имаш ${active} активни обекта — максимумът за ${officeLv().nm.toLowerCase()}. Надгради офиса.`, 'bad'); tab = 'hq'; renderPanel(); return; }
  // предлагаш цена: по-ниската печели по-често; губиш ли — поръчката отива при конкурента
  if (!AUTOTEST || params.has('bids')) {
    const ofr = S.offers[i], bid = resolveBid(ofr, bidSel[id] || 1, S.rep);
    delete bidSel[id];
    if (!bid.win) {
      S.offers.splice(i, 1); city.lots[ofr.lot].busy = null;
      toast(`❌ ${bid.rivalNm} предложи по-изгодна цена и взе поръчката „${BTYPES[ofr.type].nm} — ${ofr.client}“.`, 'bad');
      Sound.play('error'); save(); renderPanel(); return;
    }
    if (bid.price !== ofr.reward) toast(`🤝 Клиентът прие офертата ти: ${fmt(bid.price)} €.`, 'good');
    ofr.reward = bid.price;
  }
  const o = S.offers.splice(i, 1)[0], bt = BTYPES[o.type];
  const p = { id: o.id, type: o.type, lot: o.lot, client: o.client, title: `${bt.nm}${o.floors ? ` (${o.floors} ет.)` : ''} — ${o.client}`, reward: o.reward, repGain: bt.repGain,
    startDay: S.day, deadlineDay: S.day + o.days, stage: 0, prog: 0, floors: o.floors, model: buildingFor(o.type, o.floors) };
  if (o.demolish) {
    // старата сграда се събаря на части за ~2–3 дни (demolish.js); новият строеж започва след това
    if (city.lots[o.lot].obj) p.demo = { prog: 0, days: 2.5 }; else clearLot(city.lots[o.lot]);
    p.title += ' (събаряне)'; Sound.play('error'); setTimeout(refreshEstateSigns, 0);
  }
  city.lots[o.lot].busy = 'project';
  projects.push(p);
  makeSite(p);
  toast(`Поръчката „${p.title}“ е приета. Техниката тръгва към обекта.`, 'good');
  flyTo(city.lots[p.lot]);
  dispatch();
  save();
  renderPanel();
}
function declineOffer(id) {
  const i = S.offers.findIndex(o => o.id === id);
  if (i < 0) return;
  city.lots[S.offers[i].lot].busy = null;
  S.offers.splice(i, 1);
  renderPanel();
}

// разпределя свободната техника към обектите (по реда на приемане)
function dispatch() {
  for (const p of projects) {
    const st = BTYPES[p.type].stages[p.stage];
    if (!st) continue;
    for (const [role, cnt] of Object.entries(st.need)) {
      let have = units.filter(u => u.proj === p && u.type === role).length;
      while (have < cnt) {
        const lot = city.lots[p.lot];
        const free = units.filter(u => u.type === role && !u.proj && (u.state === 'idle' || u.state === 'returning'))
          .sort((a, b) => Math.hypot(a.x - lot.x, a.z - lot.z) - Math.hypot(b.x - lot.x, b.z - lot.z))[0];
        if (!free) break;
        assignUnit(free, p);
        have++;
      }
    }
  }
}
function assignUnit(u, p) {
  const lot = city.lots[p.lot];
  u.proj = p;
  const k = units.filter(q => q.proj === p).length - 1;
  const spot = [[-4.5, 5.5], [0, 4.5], [4.5, 5.5], [-4.5, 1], [4.5, 1], [0, 0]][k % 6];
  sendTo(u, lot.x + spot[0], lot.z + spot[1], () => { if (u.proj === p) { u.state = 'working'; u.yaw = Math.PI; u.obj.rotation.y = u.yaw; } });
  u.state = 'driving';
}
function missingRoles(p) {
  const st = BTYPES[p.type].stages[p.stage];
  const out = [];
  for (const [role, cnt] of Object.entries(st.need)) {
    const working = units.filter(u => u.proj === p && u.type === role && u.state === 'working').length;
    const coming = units.filter(u => u.proj === p && u.type === role && u.state !== 'working').length;
    out.push({ role, cnt, working, coming });
  }
  return out;
}
// градовете, с които имаш жп връзка (Фаза 3); засега няма
const connected = () => connectedCities();
// материалите за етапа се осигуряват веднъж: от склада, а липсващите се купуват (ако е включено)
// opts.instant: купува и влага веднага (за fastForward); иначе липсващото идва с ТИР до строежа
function ensureMaterials(p, opts = {}) {
  p.mat = p.mat || {};
  if (p.mat[p.stage]) return true;
  if (!econ.consumeStage) { p.mat[p.stage] = true; return true; }
  if (econ.consumeStage(p.type, p.stage)) { p.mat[p.stage] = true; addPallets(p); refreshWarehouse(); return true; }
  if (S.autoBuy !== false && !opts.instant) {
    // поръчва само каквото не е вече на път към този обект
    let cost = 0, n = 0, rail = false, broke = false;
    for (const [m, q] of Object.entries(econ.missing(p.type, p.stage))) {
      const coming = econ.s.transit.reduce((a, o) => a + (o.lot === p.lot && o.city === S.cityId && o.matId === m ? o.qty : 0), 0);
      if (q - coming <= 0) continue;
      const r = econ.orderMaterial(m, q - coming, connected(), supplyOpts());
      if (!r.ok) { broke = true; continue; }
      cost += r.cost;
      if (r.rail) { econ.receive(r.order.id); rail = true; }
      else { Object.assign(r.order, { lot: p.lot, city: S.cityId }); sendSiteTir(r.order, n++ * 1.5); }
    }
    if (rail) sendCityTrain(`🚆 Материалите за „${p.title}“ пристигнаха с влак.`);
    if (cost) toast(`🚚 Материали за „${p.title}“ (${fmt(cost)} €) пътуват към строежа.`);
    if (econ.consumeStage(p.type, p.stage)) { p.mat[p.stage] = true; addPallets(p); return true; }
    if (!broke) return false;   // чака ТИР-а
  } else if (S.autoBuy !== false) {
    const r = econ.buyMissing(p.type, p.stage, connected(), supplyOpts());
    if (r.ok && r.rail && r.cost) sendCityTrain(`🚆 Материалите за „${p.title}“ пристигнаха с влак.`);
    if (r.ok && econ.consumeStage(p.type, p.stage)) {
      p.mat[p.stage] = true; addPallets(p);
      if (r.cost) toast(`📦 Материали за „${p.title}“: ${fmt(r.cost)} €`);
      return true;
    }
  }
  if (!p.matWarned) { p.matWarned = true; toast(`⚠️ „${p.title}“ чака материали. Купи ги от таб „Склад“ (или вземи кредит, ако нямаш пари).`, 'bad'); }
  return false;
}
const PALLET_COL = { sand: 0xd9c08a, gravel: 0x9a9a9a, concrete: 0xb8b8b0, bricks: 0xb5523b, steel: 0x6d7a88, wood: 0xa8743f, glass: 0x9fd8ff, furniture: 0x8b5a3c, marble: 0xf2f0ea };
// палети с материали в ъгъла на обекта
function addPallets(p) {
  const v = p.vis; if (!v) return;
  const need = econ.stageNeeds ? econ.stageNeeds(p.type, p.stage) : {};
  if (v.pallets) v.g.remove(v.pallets);
  const g = v.pallets = new THREE.Group();
  let k = 0;
  for (const m of Object.keys(need)) {
    const col = PALLET_COL[m] ?? 0xcccccc;
    const geo = m === 'steel' ? new THREE.BoxGeometry(2.6, 0.5, 0.6) : m === 'wood' ? new THREE.BoxGeometry(2.4, 0.7, 0.9) : new THREE.BoxGeometry(1.2, 0.9, 1.2);
    for (let j = 0; j < 2; j++) {
      const b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }));
      b.position.set(-6 + (k % 3) * 1.6, 0.45 + j * (m === 'steel' ? 0.5 : 0.9), 3.5 + Math.floor(k / 3) * 1.5);
      b.castShadow = true; g.add(b);
    }
    k++;
  }
  v.g.add(g);
}
function updateProjects(dtDays) {
  for (const p of [...projects]) {
    if (p.demo) { p.demo.prog = Math.min(1, p.demo.prog + dtDays / p.demo.days); if (p.demo.prog >= 1) finishDemo(p); continue; }
    const st = BTYPES[p.type].stages[p.stage];
    const roles = missingRoles(p);
    if (roles.every(r => r.working >= 1) && ensureMaterials(p)) {
      const ws = units.filter(u => u.proj === p && u.state === 'working' && st.need[u.type]);
      for (const u of ws) { const lv = unitLv(u); u.xp = (u.xp || 0) + dtDays; if (unitLv(u) > lv) toast(`⭐ ${ECON.UNIT_TYPES[u.type].ico} ${ECON.UNIT_TYPES[u.type].nm} стана ниво ${unitLv(u)} — работи с ${(unitLv(u) - 1) * 10}% по-бързо.`, 'good'); }
      const n = ws.reduce((a, u) => a + 1 + 0.1 * (unitLv(u) - 1), 0) * (hasStaff('engineer') ? 1.15 : 1);
      p.prog += dtDays * RATE * n * events.workMul() / (st.work * workMul(p));   // събития: буря (0), стачка, жега…
      if (p.prog >= 1) nextStage(p);
    }
  }
}
function nextStage(p) {
  p.stage++; p.prog = 0;
  const st = BTYPES[p.type].stages[p.stage];
  if (!st) return completeProject(p);
  // техниката, която не трябва в новия етап, се прибира
  for (const u of units) if (u.proj === p && !st.need[u.type]) releaseUnit(u);
  dispatch();
  renderPanel();
}
function completeProject(p) {
  for (const u of units) if (u.proj === p) releaseUnit(u);
  if (p.reno || p.invest || p.maint || p.remodel || p.park) {   // собствени имоти: без плащане от клиент
    projects.splice(projects.indexOf(p), 1);
    if (p.reno) finishReno(p); else if (p.park) finishPark(p); else if (p.maint || p.remodel) finishOwnedWork(p); else finishInvestment(p);
    refreshEstateSigns(); dispatch(); save(); renderPanel();
    return;
  }
  if (p.own) {   // собствен строеж: без плащане и репутация — новото ниво влиза в сила
    finishSite(p);
    projects.splice(projects.indexOf(p), 1);
    if (city.lots[p.lot] !== city.hq && city.lots[p.lot].busy === 'project') city.lots[p.lot].busy = null;
    finishOwnProject(p);
    dispatch(); save(); renderPanel();
    return;
  }
  // сумата се изчислява по правилата на economy.js, но се плаща едва при клик върху пачките на покрива
  const res = new ECON.Economy(ECON.newEconState()).completionPayout(p, S.day);
  S.rep = Math.max(0, Math.min(5, S.rep + res.repDelta * (res.repDelta > 0 && hasStaff('architect') ? 1.25 : 1)));
  finishSite(p);
  const cash = { lot: p.lot, amount: res.amount, note: res.note, title: p.title };
  S.cash = S.cash || []; S.cash.push(cash);
  spawnCash(cash);
  const lot = city.lots[p.lot];
  lot.busy = null;
  S.built.push({ lot: p.lot, model: p.model });
  projects.splice(projects.indexOf(p), 1);
  S.done++;
  dev.add(dev.XP[p.type] || 0);
  quests.emit('complete', { type: p.type, early: S.day <= p.deadlineDay - 2, demolish: /\(събаряне\)/.test(p.title) });
  if (p.type === 'tower' && p.floors >= 25) quests.emit('tower25');
  if (p.type === 'tower' && p.floors >= 30) quests.emit('tower30');
  Sound.play('done');
  showEventPop(`done-${p.type}`, `✅ ${p.title}`, `Плащане ${fmt(res.amount)} € (${res.note}) — вземи пачките от покрива!`);
  toast(`✅ ${p.title} е завършен${p.type === 'house' ? 'а' : ''} (${res.note}). Вземи парите от покрива! 💶`, res.repDelta >= 0 ? 'good' : 'bad');
  for (const [, t] of offerTypes()) if (S.rep >= t.rep && S.rep - res.repDelta < t.rep) toast(`⭐ Репутацията ти отключи поръчки за ${t.nm.toLowerCase()}!`, 'good');
  dispatch();
  save();
  renderPanel();
}
const XP_PER_LV = 15;   // работни дни за следващо ниво
const unitLv = u => Math.min(5, 1 + Math.floor((u.xp || 0) / XP_PER_LV));
// специалисти (за цялата фирма): инженер ускорява обектите, архитект вдига цените на поръчките
const STAFF = {
  engineer: { nm: 'Инженер', ico: '👷‍♂️', cost: 60000, upkeep: 400, ds: 'Всички обекти напредват с 15% по-бързо.' },
  architect: { nm: 'Архитект', ico: '📐', cost: 80000, upkeep: 500, ds: 'Новите поръчки плащат с 10% повече, а репутацията расте по-бързо.' },
};
const hasStaff = k => !!(S.staff || {})[k];
function hireStaff(k) {
  const t = STAFF[k];
  if (dev.level() < 4) { toast(`🔒 Специалистите се отключват на ниво 4 на развитие на ${cityName()} (сега ${dev.level()}).`, 'bad'); return; }
  if (hasStaff(k) || !econ.canAfford(t.cost)) { if (!hasStaff(k)) toast('Нямаш достатъчно пари.', 'bad'); return; }
  econ.spend(t.cost, 'покупка', `Назначи ${t.nm.toLowerCase()}`);
  S.staff = { ...(S.staff || {}), [k]: S.day };
  Sound.play('upgrade'); toast(`${t.ico} Назначи ${t.nm.toLowerCase()}: ${t.ds}`, 'good');
  showEventPop(`hire-${k}`, `${t.ico} Назначихме ${t.nm.toLowerCase()}!`, t.ds);
  save(); renderPanel();
}
function syncUnits() { S.units = units.map(u => u.type); S.unitXp = units.map(u => Math.round((u.xp || 0) * 100) / 100); }
// норма техника според големината на града: малък 1, среден 3, голям 5 (багери); останалото — пропорционално
function fleetNorm() {
  const sz = Math.min(3, cityById(S.cityId)?.sz || 1), k = [0, 1, 3, 5][sz];
  return { crew: k + 1, loader: k, truck: k, tractor: Math.ceil(k / 2), crane: Math.max(1, k - 2) };
}
function fleetMissing() {
  const norm = fleetNorm(), need = garNeed(S.cityId), have = {};
  for (const u of units) have[u.type] = (have[u.type] || 0) + 1;
  for (const m of garTransit(S.cityId)) have[m.t] = (have[m.t] || 0) + 1;   // на път към града — броят се
  const out = [];
  for (const t of new Set([...Object.keys(norm), ...Object.keys(need)])) {
    const want = Math.max(norm[t] || 0, need[t] || 0), h = have[t] || 0;
    if (want > h && ECON.UNIT_TYPES[t]) out.push({ t, have: h, want, n: want - h });
  }
  // мястото в офиса (бригади) и в гаража (машини) — не предлага повече, отколкото може да се купи
  let crewLeft = Math.max(0, officeLv().crews - crewCount()), machLeft = Math.max(0, garageLv().cap - machineCount());
  const order = ['crew', 'loader', 'truck', 'crane', 'tractor'];
  out.sort((a, b) => (order.indexOf(a.t) + 99) % 99 - (order.indexOf(b.t) + 99) % 99);
  fleetMissing.capped = false;
  for (const m of out) {
    if (isRoadGear(m.t)) continue;
    const left = m.t === 'crew' ? crewLeft : machLeft, k = Math.min(m.n, left);
    if (k < m.n) { fleetMissing.capped = true; m.n = k; }
    if (m.t === 'crew') crewLeft -= k; else machLeft -= k;
  }
  return out.filter(m => m.n > 0);
}
function fillUnits(t, n) { let k = 0; for (; k < n; k++) { const before = units.length; buyUnit(t, true); if (units.length === before) break; } return k; }
function buyUnit(type, quiet = false) {
  if (!isMachine(type) && crewCount() >= officeLv().crews) { toast(`👷 Офисът поема до ${officeLv().crews} бригади. Надгради офиса от таб „Офис“.`, 'bad'); tab = 'hq'; renderPanel(); return; }
  if (isMachine(type) && !isRoadGear(type) && machineCount() >= garageLv().cap) { toast(`🔧 Гаражът е пълен (${garageLv().cap} места). Надгради гаража от таб „Офис“.`, 'bad'); tab = 'hq'; renderPanel(); return; }
  if (!econ.buyUnit(type)) { toast('Нямаш достатъчно пари. Вземи кредит от банката.', 'bad'); return; }
  S.units.push(type);
  const u = spawnUnit(type);
  refreshGarageLabel();
  poofAt(u.x, u.z);
  if (!quiet) { toast(`${ECON.UNIT_TYPES[type].ico} Купи ${ECON.UNIT_TYPES[type].nm.toLowerCase()}.`, 'good'); showBuyPop(type); }
  quests.emit('buy', { type });
  dispatch();
  save();
  renderPanel();
}
// снимка при покупка (засега за багер и бригада; още снимки — в BUY_PICS)
const BUY_PICS = { loader: 'assets/ui/buy-loader.webp', crew: 'assets/ui/buy-crew.webp', crane: 'assets/ui/buy-crane.webp', truck: 'assets/ui/buy-truck.webp', tractor: 'assets/ui/buy-tractor.webp' };
let buyPopT = null;
// снимки за събития: ключ → файл (нови снимки се добавят тук)
const EVENT_PICS = { 'city-done': 'assets/ui/city-done.webp', 'sea-week': 'assets/ui/sea-week.webp', 'rail-week': 'assets/ui/rail-week.webp', 'oe-done': 'assets/ui/oe-done.webp', 'r66-done': 'assets/ui/r66-done.webp', 'ab-done': 'assets/ui/ab-done.webp', 'airport-done': 'assets/ui/airport-done.webp', 'port-done': 'assets/ui/port-done.webp', 'ship-cargo': 'assets/ui/ship-cargo-pop.webp', 'ship-cruise': 'assets/ui/ship-cruise-pop.webp', 'lv-1': 'assets/ui/lv-1.webp', 'lv-2': 'assets/ui/lv-2.webp', 'lv-3': 'assets/ui/lv-3.webp', 'lv-4': 'assets/ui/lv-4.webp', 'lv-5': 'assets/ui/lv-5.webp', 'lv-6': 'assets/ui/lv-6.webp', 'lv-7': 'assets/ui/lv-7.webp', 'lv-8': 'assets/ui/lv-8.webp', 'hire-engineer': 'assets/ui/hire-engineer.webp', 'hire-architect': 'assets/ui/hire-architect.webp', 'unlock-balkans': 'assets/ui/unlock-balkans.webp', 'unlock-europe': 'assets/ui/unlock-europe.webp', 'done-tower': 'assets/ui/done-tower.webp', 'done-reno': 'assets/ui/done-reno.webp', 'done-rent': 'assets/ui/done-rent.webp', 'hw-open': 'assets/ui/hw-open.webp', 'rail-done': 'assets/ui/rail-done.webp', 'first-train': 'assets/ui/first-train.webp', 'office-up': 'assets/ui/office-up.webp', 'new-branch': 'assets/ui/new-branch.webp', 'sold': 'assets/ui/sold.webp', 'resort-unlock': 'assets/ui/resort-unlock.webp', 'done-house': 'assets/ui/done-house.webp', 'done-shop': 'assets/ui/done-shop.webp', 'done-office': 'assets/ui/done-office.webp', 'new-train': 'assets/ui/new-train.webp' };
function showEventPop(key, cap, sub) {
  const pic = EVENT_PICS[key]; if (!pic || AUTOTEST) return false;
  const el = $('buyPop');
  el.innerHTML = `<div class="bp-card"><img src="${pic}" alt=""><div class="bp-cap">${cap}</div><div class="bp-sub">${sub}</div></div>`;
  el.classList.remove('hidden', 'out');
  clearTimeout(buyPopT);
  buyPopT = setTimeout(() => el.classList.add('out'), 4200);
  setTimeout(() => { if (el.classList.contains('out')) el.classList.add('hidden'); }, 4800);
  return true;
}
function showBuyPop(type) {
  const pic = BUY_PICS[type]; if (!pic || AUTOTEST) return;
  const t = ECON.UNIT_TYPES[type], el = $('buyPop');
  el.innerHTML = `<div class="bp-card"><img src="${pic}" alt=""><div class="bp-cap">${t.ico} Нов${type === 'crew' ? 'а' : ''} ${t.nm.toLowerCase()} във фирмата!</div><div class="bp-sub">${t.desc}</div></div>`;
  el.classList.remove('hidden', 'out');
  clearTimeout(buyPopT);
  buyPopT = setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => { if (el.classList.contains('out')) el.classList.add('hidden'); }, 3800);
}
function sellUnit(type) {
  const u = units.find(q => q.type === type && !q.proj);
  if (!u) return;
  const got = econ.sellUnit(type);
  scene.remove(u.obj);
  units.splice(units.indexOf(u), 1);
  refreshGarageLabel();
  S.units.splice(S.units.indexOf(type), 1);
  toast(`Продаде ${ECON.UNIT_TYPES[type].nm.toLowerCase()} за ${fmt(got)} €.`);
  save();
  renderPanel();
}
function poofAt(x, z) {
  const r = new THREE.Mesh(new THREE.RingGeometry(1.5, 2, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true }));
  r.position.set(x, 0.1, z); scene.add(r);
  const t0 = performance.now();
  const f = () => { const k = (performance.now() - t0) / 600; r.scale.setScalar(1 + k * 2); r.material.opacity = 1 - k; if (k < 1) requestAnimationFrame(f); else scene.remove(r); };
  f();
}

// ---- събития (events.js)
const events = createEvents({
  S: () => S, econ: () => econ, MATERIALS: ECON.MATERIALS, fmt, toast,
  season: () => { const m = monthOf(S.day); return [11, 0, 1, 2].includes(m) ? 'winter' : [5, 6, 7, 8].includes(m) ? 'summer' : 'off'; },
});
// веднъж на ден: ново време (според месеца) и шанс за събитие; бурята от събитието е и в небето
function dayWeatherAndEvents() {
  const m = monthOf(S.day + 1);
  weather.dailyTick([11, 0, 1, 2].includes(m));
  const ev = events.dailyTick(S.day + 1);
  weather.set(events.stormy() ? 'storm' : rollWeather(m));
  S.weather = weather.kind; S.snowCover = weather.cover;
  if (ev) renderPanel();
}
function endOfDay() {
  rbuildTick();
  hwQueueTick();
  contTick();
  garArrive();
  dayWeatherAndEvents();
  econ.spend(officeLv().upkeep + garageLv().upkeep + whLv().upkeep + [S.staff, ...Object.values(S.cities || {}).map(c => c.staff)].reduce((a, st) => a + Object.keys(st || {}).reduce((b, k) => b + STAFF[k].upkeep, 0), 0), 'заплати', `Ден ${S.day}: офис, гараж и склад`);
  const nb = (S.branches || []).length, away = ownedCities().filter(c => c !== S.cityId).length;
  if (away) {   // градовете, в които не си в момента, работят сами и носят печалба според репутацията
    const awayF = ownedCities().filter(c => c !== S.cityId && isForeign(c)).length;
    const inc = Math.round((away + awayF * 0.8) * (1400 + 350 * S.rep + 120 * (S.officeLevel || 1)) * rand(0.8, 1.2));
    econ.earn(inc, 'филиали', `Ден ${S.day}: печалба от ${away} град${away > 1 ? 'а' : ''} без теб`);
  }
  { const tu = (S.trains || []).reduce((a, t) => a + trainType(t).upkeep, 0); if (tu) econ.spend(tu, 'заплати', `Ден ${S.day}: влакове`); flowDay('rail', tu); }
  if (hwDone().length) econ.earn(hwToll(), 'обект', `Ден ${S.day}: тол такси`);
  if (S.day % 10 === 0 && (S.trains || []).length && (S.trains || []).length >= totalTracks()) {
    const weak = ownedCities().filter(id => (id === S.cityId ? (S.stationLevel || 0) : ((S.cities || {})[id]?.stationLevel || 0)) < 5);
    if (weak.length) toast(`🚉 Влаковете са на лимита. Развий гарата в ${weak.map(id => cityById(id).nm).join(', ')} до ниво 5 за още влакове.`, '', () => { tab = 'hq'; renderPanel(); });
  }
  estateDay();
  supply.dailyTick();
  resorts.dailyTick(S.day);
  S.jobs = (S.jobs || []).filter(j => j.expires >= S.day + 1);
  while (S.jobs.length < 3 && network().length > 1) { const n = S.jobs.length; makeJob(); if (S.jobs.length === n) break; }
  const sum = econ.dailyTick(S.day, units.map(u => u.type), { branches: nb });
  { const au = airUpkeep(); if (au) econ.spend(au, 'заплати', 'Летища и самолети'); flowDay('air', au); }
  { const su = seaUpkeep(); if (su) econ.spend(su, 'заплати', 'Пристанища и кораби'); flowDay('sea', su); }
  autoLines();
  tenders.dailyTick();
  orient.dailyTick();
  route66.dailyTick();
  mega.dailyTick();
  for (const j of S.hwJobs || []) { const lk = hwLackOf(j), sg = segById(j.seg); if (lk.length && sg) toast(`⏸ ${j.ab ? 'Аутобанът' : 'Магистралата'} ${cityById(sg.a).nm} — ${cityById(sg.b).nm} стои: в ${cityById(hwCityOf(j)).nm} липсва ${lackTxt(lk)}. Купи от таб „Техника“.`, 'bad', () => openBig('hw')); }
  if (econ.isFinished && econ.isFinished(S.cityId)) {   // завършеният град носи приход и докато си в него (издръжката на техниката тук е в dailyTick)
    const fi = finInfo(S.cityId); fi.f.earned = (fi.f.earned || 0) + fi.daily;
    econ.earn(fi.daily, 'градове', `${cityName()}: автоматичен приход (завършен град)`);
  }
  S.day++;
  // офертите изтичат, идват нови
  for (const o of rivals.dailyTick(S.offers)) { S.offers.splice(S.offers.indexOf(o), 1); city.lots[o.lot].busy = 'rival'; }
  for (const o of [...S.offers]) if (o.expires < S.day) { city.lots[o.lot].busy = null; S.offers.splice(S.offers.indexOf(o), 1); }
  while (S.offers.length < officeLv().offers) { const n = S.offers.length; makeOffer(); if (S.offers.length === n) break; }
  for (const p of projects) if (S.day === p.deadlineDay) toast(`⏰ Днес е крайният срок за „${p.title}“!`, 'bad');
  if (econ.isBankrupt()) toast('⚠️ Фирмата е на ръба на фалита! Вземи кредит или продай техника.', 'bad');
  save();
  renderPanel();
  return sum;
}

// ============================================================ UI
let tab = 'offers', selProject = null;
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; renderPanel(); });
function stars(r) { let s = ''; for (let k = 1; k <= 5; k++) s += r >= k ? '★' : r >= k - 0.5 ? '⯪' : '☆'; return s; }
function renderTop() {
  try { updSuperBtn(); } catch {}
  if (!S) return;
  dev.render();
  document.querySelector('#top .logo').textContent = `🏗️ ${cityName().toUpperCase()} · ${S.cityId === (S.hqCity || S.cityId) ? 'ЦЕНТРАЛА' : 'ФИЛИАЛ'}`;
  updateQuickBuy();
  $('money').textContent = fmt(econ.money) + ' €';
  $('money').classList.toggle('neg', econ.money < 0);
  $('day').textContent = S.day;
  $('clock').textContent = clockText(todF());
  $('rep').textContent = stars(S.rep);
  const wi = weather.info(); if ($('wx')) { $('wx').textContent = wi.ico; $('wx').title = `Времето: ${wi.nm}`; }
  if ($('evchips')) { const h = events.hudHtml(); if ($('evchips').dataset.h !== h) { $('evchips').dataset.h = h; $('evchips').innerHTML = h; } }
  $('rep').title = `Репутация ${S.rep.toFixed(2)} / 5`;
}
function matHtml(p) {
  if (!econ.stageNeeds) return '';
  const need = econ.stageNeeds(p.type, p.stage);
  if (!Object.keys(need).length) return '';
  if (p.mat && p.mat[p.stage]) return `<span class="ok">📦 Материали ✓</span>`;
  const miss = econ.missing(p.type, p.stage);
  const txt = Object.entries(miss).map(([m, q]) => `${ECON.MATERIALS[m].ico} ${q} ${ECON.MATERIALS[m].unit}`).join(', ');
  return `<span class="miss" title="${txt}">📦 Липсват: ${txt} → „Склад“</span>`;
}
function needHtml(p) {
  return missingRoles(p).map(r => {
    const t = ECON.UNIT_TYPES[r.role];
    const cls = r.working >= r.cnt ? 'ok' : r.working + r.coming >= r.cnt ? 'go' : r.working >= 1 ? 'go' : 'miss';
    const txt = r.working >= r.cnt ? '✓' : r.coming ? 'на път' : r.working ? `${r.working}/${r.cnt}` : 'липсва';
    return `<span class="${cls}">${t.ico} ${t.nm} ${r.cnt > 1 ? '×' + r.cnt : ''} · ${txt}</span>`;
  }).join('');
}
function renderPanel() {
  updFinBtn();
  if (!S) return;
  renderTop();
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.t === tab);
    const n = b.dataset.t === 'offers' ? S.offers.length : b.dataset.t === 'projects' ? projects.length : 0;
    b.innerHTML = b.textContent.replace(/\d+$/, '').trim() + (n ? ` <span class="badge">${n}</span>` : '');
  });
  const el = $('panelBody');
  let h = '';
  if (tab === 'offers') {
    if (!S.offers.length) h = `<div class="empty">Няма нови поръчки. Утре ще дойдат още.</div>`;
    if (S.offers.length > 1) h += S.rep >= 3
      ? `<div class="row" style="margin:0 0 8px"><span class="meta" style="margin:0">📨 Всички ${S.offers.length} оферти наведнъж — с избраните цени</span><button class="btn" id="bOfferAll">📨 Предложи всички</button></div>`
      : `<div class="meta" style="margin:0 0 8px;opacity:.7">🔒 „📨 Предложи всички“ се отключва при репутация 3 ★ (сега ${S.rep.toFixed(1)} ★).</div>`;
    h += rivals.marketHtml();
    h += tenders.cardsHtml();
    if (freeLotCount() < 3) h += `<div class="meta" style="text-align:center;color:var(--acc)">🏙️ Градът е почти застроен — купи нов квартал от таб „Офис“.</div>`;
    for (const o of [...S.offers].sort((a, b) => (b.demolish ? 1 : 0) - (a.demolish ? 1 : 0))) {
      const bt = BTYPES[o.type];
      const roles = [...new Set(bt.stages.flatMap(s => Object.keys(s.need)))];
      const lacking = roles.filter(r => !units.some(u => u.type === r));
      h += `<div class="card" data-lot="${o.lot}" ${o.demolish ? 'style="border-color:#ff9e5e;box-shadow:0 0 0 1px #ff9e5e inset"' : ''}><h3><span class="ico">${o.demolish ? '🏚️→' : ''}${bt.ico}</span>${bt.nm}${o.floors ? ` · ${o.floors} етажа` : ''}${o.demolish ? ' · <span style="color:#ff9e5e">със събаряне</span>' : ''}</h3>
        ${o.demolish ? `<div class="meta" style="color:#ffcfae">🏗️ Инвеститорът купи къща. Първо я събаряш, после строиш на мястото ѝ.</div>` : ''}
        <div class="meta">Клиент: ${o.client}<br>Срок: ${o.days} дни · Офертата важи до ден ${o.expires}</div>${rivals.offerLine(o)}
        <div class="need">${roles.map(r => `<span class="${units.some(u => u.type === r) ? 'ok' : 'miss'}">${ECON.UNIT_TYPES[r].ico} ${ECON.UNIT_TYPES[r].nm}</span>`).join('')}</div>
        ${lacking.length ? `<div class="meta late">Нямаш: ${lacking.map(r => ECON.UNIT_TYPES[r].nm).join(', ')}. Купи от „Техника“.</div>` : ''}
        ${econ.materialCost ? `<div class="meta">📦 Материали ~${fmt([0, 1, 2, 3].reduce((a, k) => a + econ.materialCost(o.type, k, connected(), supplyOpts()), 0))} € · печалба ~<b style="color:var(--ok)">${fmt(o.reward - [0, 1, 2, 3].reduce((a, k) => a + econ.materialCost(o.type, k, connected(), supplyOpts()), 0))} €</b></div>` : ''}
        ${bidHtml(o, bidSel[o.id], S.rep, fmt)}
        <div class="row"><span class="money">+${fmt(Math.round(o.reward * (bidSel[o.id] || 1) / 500) * 500)} €</span><span><button class="btn2" data-dec="${o.id}">Откажи</button> <button class="btn" data-acc="${o.id}">Предложи</button></span></div></div>`;
    }
    const lockedNext = offerTypes().map(e => e[1]).find(t => S.rep < t.rep);
    if (lockedNext) h += `<div class="meta" style="text-align:center">🔒 ${lockedNext.ico} ${lockedNext.nm} — нужна репутация ${lockedNext.rep} ★</div>`;
  } else if (tab === 'projects') {
    h += `<label class="meta" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="autoBuy" ${S.autoBuy !== false ? 'checked' : ''}> Автоматично купувай материали за обектите</label>`;
    if (!projects.length) h += `<div class="empty">Нямаш активни обекти.<br>Приеми поръчка от „Поръчки“.</div>`;
    for (const p of projects) {
      const bt = BTYPES[p.type], st = bt.stages[p.stage], mine = p.own || p.invest || p.reno, left = mine ? 0 : p.deadlineDay - S.day;
      h += `<div class="card ${selProject === p.id ? 'sel' : ''}" data-lot="${p.lot}" data-proj="${p.id}"><h3><span class="ico">${bt.ico}</span>${p.title}</h3>
        <div class="stages">${bt.stages.map((s, i) => `<span class="${i < p.stage ? 'done' : i === p.stage ? 'cur' : ''}" title="${s.nm}"></span>`).join('')}</div>
        ${p.demo ? `<div class="row"><b>🔨 Събаряне на старата сграда</b><span>${Math.round(p.demo.prog * 100)}%</span></div><div class="bar"><i style="width:${(p.demo.prog * 100).toFixed(1)}%;background:linear-gradient(90deg,#c0603a,#ff9a5e)"></i></div>` : ''}
        <div class="row"><b>${p.stage + 1}. ${st.nm}</b><span class="${left < 0 ? 'late' : ''}">${mine ? `${Math.round(p.prog * 100)}%` : left >= 0 ? `остават ${left} дни` : `закъснение ${-left} дни`}</span></div>
        <div class="bar"><i style="width:${(p.prog * 100).toFixed(1)}%"></i></div>
        <div class="need">${needHtml(p)}${matHtml(p)}</div>
        <div class="row">${p.own ? `<span class="meta">Собствен строеж — новото ниво влиза в сила, когато е готов</span>` : p.invest ? `<span class="meta">🔑 Твоя инвестиция — ще носи наем</span><span class="money">~${fmt(RENT[p.type])} €/ден</span>` : p.reno ? `<span class="meta">🔨 Ремонт на твоя къща — след него наемът става</span><span class="money">~550 €/ден</span>` : `<span class="meta">Плащане при завършване</span><span class="money">${fmt(p.reward)} €</span>`}</div></div>`;
    }
  } else if (tab === 'fleet') {
    // само каквото липсва в този град: норма по големината на града (малък / среден / голям) или нуждата на обектите, ако е повече
    const miss = fleetMissing();
    h += `<button class="btn" id="bGarWin" style="width:100%;margin-bottom:8px">🚜 Гараж — техниката във всички градове</button>`;
    const sz = cityById(S.cityId)?.sz || 1;
    h += `<div class="sect">Нужна техника · ${['', 'малък', 'среден', 'голям'][Math.min(3, sz)] || 'голям'} град</div>`;
    if (!miss.length) h += `<div class="card"><div class="meta" style="color:var(--ok);margin:0">✅ Имаш всичко нужно за ${cityName()}. Подробностите са в „🚜 Гараж“.</div></div>`;
    if (fleetMissing.capped) h += `<div class="meta late" style="margin:0 0 6px">🔒 Няма място за всичко — надгради офиса (бригади: ${crewCount()}/${officeLv().crews}) или гаража (машини: ${machineCount()}/${garageLv().cap}) от таб „Офис“.</div>`;
    else {
      const total = miss.reduce((a, m) => a + m.n * ECON.UNIT_TYPES[m.t].cost, 0);
      h += miss.map(m => { const T = ECON.UNIT_TYPES[m.t];
        return `<div class="card" style="padding:9px 11px"><div class="row" style="margin:0;align-items:center"><span><b>${T.ico} ${T.nm}</b><br><span class="meta" style="margin:0">имаш ${m.have} · трябват ${m.want}</span></span>
          <button class="btn" data-fill="${m.t}" ${econ.canAfford(T.cost) ? '' : 'disabled'}>Купи ${m.n} · ${fmt(m.n * T.cost)} €</button></div></div>`; }).join('');
      h += `<button class="btn" id="bFillAll" style="width:100%;margin-top:4px" ${econ.canAfford(total) ? '' : 'disabled'}>🛒 Купи всичко липсващо · ${fmt(total)} €</button>`;
    }
    h += `<details style="margin-top:10px"><summary class="meta" style="cursor:pointer">👷 Специалисти (инженер, архитект)</summary>` + Object.entries(STAFF).map(([k, t]) => `<div class="card" style="padding:9px 11px"><div class="row" style="margin:0"><b>${t.ico} ${t.nm}</b>${hasStaff(k) ? '<b style="color:var(--ok)">✓ в екипа</b>' : `<b>${fmt(t.cost)} €</b>`}</div>
      <div class="meta">${t.ds} Заплата ${fmt(t.upkeep)} €/ден.</div>${dev.level() < 4 && !hasStaff(k) ? `<div class="meta late">🔒 Ниво 4 на развитие на града (сега ${dev.level()})</div>` : ''}${hasStaff(k) ? '' : `<div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn" data-staff="${k}" ${econ.canAfford(t.cost) ? '' : 'disabled'}>Назначи</button></div>`}</div>`).join('') + `</details>`;
  } else if (tab === 'estate') {
    h += estateHtml();
  } else if (tab === 'bank') {
    h += `<div id="financeBox"></div>`;
  } else if (tab === 'hq') {
    h += hqCard('office') + hqCard('garage') + linksCard() + stationCard() + stationCardShop() + districtCard() + finishCityCard() + sellBranchCard();
  } else if (tab === 'store') {
    h += storeHtml();
  }
  el.innerHTML = h;
  if (tab === 'offers') tenders.bind(el);
  if ($('bOfferAll')) $('bOfferAll').onclick = offerAll;
  el.querySelectorAll('[data-acc]').forEach(b => b.onclick = e => { e.stopPropagation(); acceptOffer(+b.dataset.acc); });
  el.querySelectorAll('[data-dec]').forEach(b => b.onclick = e => { e.stopPropagation(); declineOffer(+b.dataset.dec); });
  el.querySelectorAll('[data-bid]').forEach(b => b.onclick = e => { e.stopPropagation(); const [id, m] = b.dataset.bid.split(':'); bidSel[+id] = +m; renderPanel(); });
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyUnit(b.dataset.buy));
  el.querySelectorAll('[data-fill]').forEach(b => b.onclick = () => { const m = fleetMissing().find(x => x.t === b.dataset.fill); if (!m) return; const k = fillUnits(m.t, m.n); toast(k ? `${ECON.UNIT_TYPES[m.t].ico} Купи ${k} × ${ECON.UNIT_TYPES[m.t].nm.toLowerCase()}.` : 'Няма място или пари.', k ? 'good' : 'bad'); renderPanel(); });
  if (el.querySelector('#bFillAll')) el.querySelector('#bFillAll').onclick = () => { let k = 0; for (const m of fleetMissing()) k += fillUnits(m.t, m.n); toast(k ? `🛒 Купи ${k} машини и бригади.` : 'Няма място или пари.', k ? 'good' : 'bad'); renderPanel(); };
  el.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => sellUnit(b.dataset.sell));
  el.querySelectorAll('[data-lot]').forEach(c => c.onclick = () => { selProject = c.dataset.proj ? +c.dataset.proj : null; flyTo(city.lots[+c.dataset.lot]); highlightLot(+c.dataset.lot); renderPanel(); });
  if (tab === 'bank') renderBank($('financeBox'));
  if (tab === 'estate') bindEstate(el);
  if ($('bFinishCity')) $('bFinishCity').onclick = finishCity;
  if ($('bMoveFleet')) $('bMoveFleet').onclick = offerFleetMove;
  if ($('bSellBranch')) $('bSellBranch').onclick = sellBranch;
  el.querySelectorAll('[data-staff]').forEach(b => b.onclick = () => hireStaff(b.dataset.staff));
  if (el.querySelector('#bGarWin')) el.querySelector('#bGarWin').onclick = () => openBig('garage');
  el.querySelectorAll('[data-buytrain]').forEach(b => b.onclick = () => { buyTrain(b.dataset.buytrain); renderPanel(); });
  el.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => startUpgrade(b.dataset.upg));
  el.querySelectorAll('[data-ostyle]').forEach(b => b.onclick = () => setOfficeStyle(b.dataset.ostyle));
  el.querySelectorAll('[data-link]').forEach(b => b.onclick = () => linkAct(b.dataset.link));
  el.querySelectorAll('[data-openrail]').forEach(b => b.onclick = () => openBig('rail'));
  if ($('bCancelPick')) $('bCancelPick').onclick = cancelPick;
  if ($('bStation')) $('bStation').onclick = startStationUpgrade;
  if ($('bDistrict')) $('bDistrict').onclick = buyDistrict;
  el.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { if (buyForStock(b.dataset.mat, +b.dataset.q)) { refreshWarehouse(); SFXcash(); save(); } renderPanel(); });
  if ($('bBuyNeed')) $('bBuyNeed').onclick = () => { buyForProjects(); refreshWarehouse(); save(); renderPanel(); };
  if ($('bAutoFill')) $('bAutoFill').onclick = () => { const af = autoFill(); af.on = !af.on; toast(af.on ? `🔄 Автоматичното пълнене е включено (до ${fmt(af.budget)} € на ден).` : '🔄 Автоматичното пълнене е изключено.'); if (af.on) autoFillTick(true); save(); renderPanel(); };
  if ($('afBudget')) $('afBudget').onchange = e => { autoFill().budget = Math.max(0, Math.round(+e.target.value || 0)); save(); renderPanel(); };
  el.querySelectorAll('[data-afb]').forEach(b => b.onclick = () => { autoFill().budget = +b.dataset.afb; save(); renderPanel(); });
  if ($('autoBuy')) $('autoBuy').onchange = e => { S.autoBuy = e.target.checked; for (const p of projects) p.matWarned = false; save(); };
}
// карта „Офис“ / „Гараж“ / „Склад“: сегашното ниво, следващото и строежът му
function hqCard(kind) {
  const LV = kind === 'office' ? OFFICE_LEVELS : kind === 'garage' ? GARAGE_LEVELS : WH_LEVELS;
  const lv = levelOf(kind), L = kind === 'warehouse' ? whLv() : LV[lv - 1], nx = LV[lv];
  const up = c => `<b style="color:var(--ok)">${c}</b>`;
  const where = kind === 'garage' ? ` · ${S.garageLot == null ? 'в двора на централата' : 'на свой парцел'}` : kind === 'warehouse' && !lv ? ' · още нямаш склад' : '';
  const stats = (X, Y) => kind === 'office'
    ? `👷 Бригади: ${Y ? `${X.crews} → ${up(Y.crews)}` : `${crewCount()}/${X.crews}`}<br>🏗️ Обекти наведнъж: ${Y ? `${X.proj} → ${up(Y.proj)}` : `${projects.filter(p => !p.own).length}/${X.proj}`}<br>📋 Поръчки на таблото: ${Y ? `${X.offers} → ${up(Y.offers)}` : `до ${X.offers}`}`
    : kind === 'garage' ? `🚜 Места за техника: ${Y ? `${X.cap} → ${up(Y.cap)}` : `${machineCount()}/${X.cap}${units.some(u => isRoadGear(u.type)) ? ` (+${units.filter(u => isRoadGear(u.type)).length} пътни в пътната база)` : ''}`}`
    : `📦 Място: ${Y ? `×${X.mul} → ${up('×' + Y.mul)}` : `×${X.mul}`} (напр. бетон ${Y ? `${Math.round(WH_BASE.concrete * X.mul)} → ${up(Math.round(WH_BASE.concrete * Y.mul))}` : Math.round(WH_BASE.concrete * X.mul)} м³)`;
  let h = `<div class="card"><h3><span class="ico">${KIND_NM[kind].slice(0, 2)}</span>${KIND_NM[kind].slice(3)} · ниво ${lv}/10</h3>
    <div class="meta"><b style="color:var(--txt)">${L.nm}</b>${where}</div>
    <div class="stages">${LV.map((_, i) => `<span class="${i < lv ? 'done' : ''}"></span>`).join('')}</div>
    <div class="meta">${stats(L)}<br>💸 Поддръжка: ${fmt(L.upkeep)} €/ден</div>`;
  const job = upgradeOf(kind);
  if (job) {
    const st = BTYPES[job.type].stages[job.stage];
    h += `<div class="sect" style="margin-top:10px">🔨 Строи се ниво ${job.target}: ${LV[job.target - 1].nm}</div>
      <div class="stages">${BTYPES[job.type].stages.map((q, i) => `<span class="${i < job.stage ? 'done' : i === job.stage ? 'cur' : ''}" title="${q.nm}"></span>`).join('')}</div>
      <div class="row" style="margin-top:4px"><b>${job.stage + 1}. ${st.nm}</b><span>${Math.round(job.prog * 100)}%</span></div>
      <div class="bar"><i style="width:${(job.prog * 100).toFixed(1)}%"></i></div>
      <div class="need">${needHtml(job)}</div>`;
  } else if (pickKind === kind) {
    h += `<div class="meta" style="color:var(--acc)">🖱️ Посочи свободен парцел на картата (зелените рамки) — там фирмата ще строи.</div>
      <div class="row"><span></span><button class="btn2" id="bCancelPick">Отказ</button></div>`;
  } else if (nx) {
    const cost = upgradeCost(kind), move = needsLot(kind);
    h += `<div class="sect" style="margin-top:10px">⬆️ Ниво ${lv + 1}: ${nx.nm}</div>
      <div class="meta">${stats(L, nx)}<br>💸 Поддръжка: ${fmt(nx.upkeep)} €/ден
        ${move ? `<br><span style="color:var(--acc)">📍 Иска свой парцел — ще го посочиш на картата (+${fmt(LAND)} € за земята).</span>` : ''}
        <br>🔨 Строи го твоята бригада${move ? ' с багер и самосвал' : ''}.</div>
      <div class="row"><span class="money" style="color:var(--txt)">${fmt(cost)} €</span><button class="btn" data-upg="${kind}" ${econ.canAfford(cost) && !pickKind ? '' : 'disabled'}>${move ? '📍 Избери място' : 'Строй'}</button></div>`;
  } else h += `<div class="meta" style="color:var(--acc)">👑 Максимално ниво!</div>`;
  if (kind === 'office') h += officeStyleHtml();
  return h + `</div>`;
}
// облик на офиса-кула: от ниво STYLE_LV избираш небостъргача (за всеки град поотделно)
function officeStyleHtml() {
  const lv = S.officeLevel || 1, cur = S.officeStyle || 'std';
  if (lv < STYLE_LV) return `<div class="meta" style="margin-top:8px">🏙️ От ниво ${STYLE_LV} („${OFFICE_LEVELS[STYLE_LV - 1].nm}“) можеш да си избереш облика на кулата.</div>`;
  const list = OFFICE_STYLES.filter(x => x.id === 'std' || x.lm || x.sf || A[x.model]);
  return `<div class="sect" style="margin-top:10px">🏙️ Облик на кулата · смяна ${fmt(STYLE_COST)} €</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">${list.map(x => `<button class="btn2" data-ostyle="${x.id}" title="${x.ds || ''}" style="padding:5px 8px;font-size:12px;${x.id === cur ? 'background:var(--acc);color:#1a1200;border-color:var(--acc)' : ''}" ${x.id !== cur && !econ.canAfford(STYLE_COST) ? 'disabled' : ''}>${x.ico} ${x.nm}</button>`).join('')}</div>`;
}
function setOfficeStyle(id) {
  if ((S.officeStyle || 'std') === id) return;
  if (!econ.canAfford(STYLE_COST)) { toast('Нямаш пари за преустройството.', 'bad'); return; }
  econ.spend(STYLE_COST, 'покупка', 'Нов облик на офиса');
  S.officeStyle = id; buildHQ(); poofAt(city.hq.x, city.hq.z); Sound.play('buy');
  toast(`🏙️ Офисът вече е „${OFFICE_STYLES.find(x => x.id === id).nm}“.`, 'good'); save(); renderPanel();
}
// таб „Склад“: сградата, наличностите и покупка на материали предварително
const BUY_STEP = { sand: 10, gravel: 10, concrete: 10, bricks: 1, steel: 1, wood: 1, glass: 10, furniture: 1, marble: 10 };
function storeHtml() {
  let h = hqCard('warehouse');
  // автоматично пълнене: бутон и дневен бюджет
  const af = autoFill();
  h += `<div class="card" style="${af.on ? 'border-color:var(--ok)' : ''}"><h3><span class="ico">🔄</span>Автоматично пълнене
      <button class="${af.on ? 'btn' : 'btn2'}" id="bAutoFill" style="margin-left:auto">${af.on ? 'ВКЛ.' : 'ИЗКЛ.'}</button></h3>
    <div class="meta">Поръчва ТИР-ове сам: първо каквото трябва на обектите, после допълва всеки материал, паднал под половината. Не харчи над бюджета и не влиза на минус.</div>
    <div class="row"><span class="meta" style="margin:0">Бюджет на ден</span>
      <span style="display:flex;gap:6px;align-items:center"><input id="afBudget" type="number" min="0" step="1000" value="${af.budget}" style="width:96px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:#0f141c;color:var(--txt);font:inherit"> €</span></div>
    <div class="row" style="justify-content:flex-end;gap:6px">${[5000, 20000, 50000].map(v => `<button class="btn2" data-afb="${v}">${fmt(v)}</button>`).join('')}</div>
    <div class="meta">Днес: <b style="color:var(--txt)">${fmt(af.day === S.day ? af.spent : 0)} / ${fmt(af.budget)} €</b></div>
    <div class="bar"><i style="width:${Math.min(100, (af.day === S.day ? af.spent : 0) / Math.max(1, af.budget) * 100)}%"></i></div></div>`;
  h += `<label class="meta" style="display:flex;gap:8px;align-items:center;cursor:pointer"><input type="checkbox" id="autoBuy" ${S.autoBuy !== false ? 'checked' : ''}> Ако нещо липсва в склада, купувай го направо за обекта</label>`;
  const { short, cost, need } = projShortage();
  if (short.length) {
    h += `<div class="card" style="border-color:var(--acc)"><h3><span class="ico">⚠️</span>Обектите чакат материали</h3>
      <div class="need">${short.map(([m, q]) => `<span class="miss">${ECON.MATERIALS[m].ico} ${q - econ.stock(m) - econ.inTransit(m)} ${ECON.MATERIALS[m].unit}</span>`).join('')}</div>
      <div class="row"><span class="money" style="color:var(--txt)">~${fmt(cost)} €</span><button class="btn" id="bBuyNeed" ${econ.canAfford(cost) ? '' : 'disabled'}>Купи за обектите</button></div>
      ${econ.canAfford(cost) ? '' : `<div class="meta late">Нямаш пари. Вземи кредит от „Банка“ или продай техника.</div>`}</div>`;
  }
  h += `<div class="sect">Материали · място ×${whLv().mul}</div>`;
  for (const [id, m] of Object.entries(ECON.MATERIALS)) {
    const st = econ.stock(id), cap = matCap(id), way = econ.inTransit(id), room = Math.max(0, cap - st - way), step = BUY_STEP[id] || 1;
    const unit = ECON.materialPrice ? ECON.materialPrice(id, connected()) : m.buyPrice;
    const q1 = Math.min(step, room), q5 = Math.min(step * 5, room);
    const btn = (q, txt) => q > 0 ? `<button class="btn2" data-mat="${id}" data-q="${q}" ${econ.canAfford(econ.quoteMaterial(id, q, connected()).total) ? '' : 'disabled'} title="${fmt(econ.quoteMaterial(id, q, connected()).total)} € с доставката">${txt}</button>` : '';
    h += `<div class="card" style="padding:10px 12px"><h3><span class="ico">${m.ico}</span>${m.nm}<span class="meta" style="margin:0 0 0 auto">${st} / ${cap} ${m.unit}</span></h3>
      <div class="bar"><i style="width:${Math.min(100, st / cap * 100)}%"></i></div>
      ${way ? `<div class="meta" style="color:var(--acc)">🚚 На път: ${way} ${m.unit}</div>` : ''}
      ${(() => { const d = curDisc(id), sup = d.cityId ? cityById(d.cityId).nm : '—';
        return `<div class="meta" style="margin:2px 0 0">Доставчик: ${sup} · ${d.pct ? `<s>${fmt(m.buyPrice)} €</s> <b style="color:var(--ok)">${fmt(Math.round(m.buyPrice * (1 - d.pct) * 100) / 100)} €</b>/${m.unit} · ${d.via === 'rail' ? '🚆 Жп връзка' : '🛣️ Магистрала'} · спестявате ${Math.round(d.pct * 100)}%` : `${fmt(m.buyPrice)} €/${m.unit} · без връзка (жп −${Math.round(RAIL_DISC * 100)}%, магистрала −${Math.round(ROAD_DISC * 100)}%)`}</div>`; })()}
      <div class="row"><span class="meta" style="margin:0">${fmt(unit)} €/${m.unit} днес${need[id] ? ` · трябват ${need[id]}` : ''}</span>
      <span>${btn(q1, '+' + q1)} ${q5 > q1 ? btn(q5, '+' + q5) : ''} ${room > q5 ? btn(room, 'Напълни') : ''}${room ? '' : `<span class="meta">${way ? 'идва' : 'пълно'}</span>`}</span></div></div>`;
  }
  return h;
}
// поръчка за склада: плаща се веднага, стоката влиза при разтоварването (влак — веднага, иначе ТИР)
// quiet: без съобщения (за автоматичното пълнене); връща платената сума или 0
let tirStagger = 0;
function buyForStock(m, q, quiet = false) {
  q = Math.min(q, Math.max(0, matCap(m) - econ.stock(m) - econ.inTransit(m)));
  if (q <= 0) { if (!quiet) toast('Складът е пълен за този материал (или вече идва). Надгради склада.', 'bad'); return 0; }
  const r = econ.orderMaterial(m, q, connected(), supplyOpts());
  if (!r.ok) { if (!quiet) toast('Нямаш достатъчно пари.', 'bad'); return 0; }
  if (r.rail) { econ.receive(r.order.id); sendCityTrain(`🚆 ${ECON.MATERIALS[m].nm} пристигна с влак.`); for (const p of projects) p.matWarned = false; }
  else { sendTir(r.order, tirStagger); tirStagger += 1.5; setTimeout(() => { tirStagger = 0; }, 50); if (!quiet) toast(`🚚 ТИР с ${ECON.MATERIALS[m].ico} ${ECON.MATERIALS[m].nm} тръгна към склада.`); }
  return r.cost || 1;
}
// ---------- автоматично пълнене на склада
const autoFill = () => (S.autoFill = S.autoFill || { on: false, budget: 20000, spent: 0, day: S.day });
// full: в началото на деня допълва всичко под 80%; иначе само под 50% и каквото трябва на обектите
function autoFillTick(full = false) {
  const af = autoFill();
  if (!af.on) return;
  if (af.day !== S.day) { af.day = S.day; af.spent = 0; }
  const need = {};
  for (const p of projects) if (!p.own && !(p.mat && p.mat[p.stage])) for (const [m, q] of Object.entries(econ.stageNeeds(p.type, p.stage))) need[m] = (need[m] || 0) + q;
  const list = Object.keys(ECON.MATERIALS).map(m => {
    const have = econ.stock(m) + econ.inTransit(m), cap = matCap(m);
    const urgent = (need[m] || 0) > have, low = have < cap * (full ? 0.8 : 0.5);
    return { m, urgent, want: urgent || low ? cap - have : 0 };
  }).filter(x => x.want > 0).sort((a, b) => b.urgent - a.urgent);
  let n = 0, cost = 0;
  for (const x of list) {
    const left = af.budget - af.spent;
    if (left <= 0) break;
    let q = x.want;
    const qt = econ.quoteMaterial(x.m, q, connected(), supplyOpts());
    if (qt.total > left) q = Math.floor(q * left / qt.total);
    while (q > 0 && econ.quoteMaterial(x.m, q, connected(), supplyOpts()).total > Math.min(left, econ.money)) q--;
    if (q <= 0) continue;
    const c = buyForStock(x.m, q, true);
    if (c) { af.spent += c; cost += c; n++; }
  }
  if (n) {
    toast(`🔄 Автоматично пълнене: ${n} ${n === 1 ? 'ТИР' : 'ТИР-а'} към склада, ${fmt(cost)} €.`, 'good');
    save();
    if (tab === 'store') renderPanel();
  }
}
// какво трябва на обектите сега (текущите етапи), което го няма в склада и не е на път
function projShortage() {
  const need = {};
  for (const p of projects) if (!p.own && !(p.mat && p.mat[p.stage])) for (const [m, q] of Object.entries(econ.stageNeeds(p.type, p.stage))) need[m] = (need[m] || 0) + q;
  const short = Object.entries(need).filter(([m, q]) => econ.stock(m) + econ.inTransit(m) < q && Math.max(0, matCap(m) - econ.stock(m) - econ.inTransit(m)) > 0);
  let cost = 0;
  for (const [m, q] of short) cost += econ.quoteMaterial(m, Math.min(q - econ.stock(m) - econ.inTransit(m), Math.max(0, matCap(m) - econ.stock(m) - econ.inTransit(m))) || 0, connected(), supplyOpts()).total;
  return { short, cost, need };
}
// бутонът горе вляво — вижда се само когато обекти чакат материали
function updateQuickBuy() {
  const b = $('quickBuy'); if (!b) return;
  const onMap = !$('mapScreen').classList.contains('hidden');
  const { short, cost } = S && econ && !onMap ? projShortage() : { short: [] };
  const show = short.length > 0 && cost > 0;
  b.classList.toggle('hidden', !show);
  document.body.classList.toggle('qb', show);
  if (show) {
    b.innerHTML = `📦 Купи за обектите <b>~${fmt(cost)} €</b><span>${short.map(([m]) => ECON.MATERIALS[m].ico).join('')}</span>`;
    b.disabled = !econ.canAfford(cost);
  }
}
function buyForProjects() {
  const need = {};
  for (const p of projects) if (!p.own && !(p.mat && p.mat[p.stage])) for (const [m, q] of Object.entries(econ.stageNeeds(p.type, p.stage))) need[m] = (need[m] || 0) + q;
  let n = 0;
  for (const [m, q] of Object.entries(need)) if (econ.stock(m) + econ.inTransit(m) < q && buyForStock(m, q - econ.stock(m) - econ.inTransit(m)) > 0) n++;
  if (n) toast('🚚 Материалите пътуват към склада. Обектите продължават, щом ТИР-овете разтоварят.', 'good');
}
function renderBank(el) {
  // ако economy.js даде собствен изглед на финансите — ползваме него
  if (ECON.renderFinance) return ECON.renderFinance(el, econ, S.rep, () => { save(); renderPanel(); }, units.map(u => u.type), { connectedCityIds: connected(), roadCityIds: supplyOpts().roadCityIds, stocksOpen: dev.stocksOpen(), devLevel: dev.best() });
  const s = econ.s;
  el.innerHTML = `<div class="card"><h3><span class="ico">🏦</span>Кредит</h3>
    <div class="meta">Дълг: <b>${fmt(s.loan)} €</b> · лихва ${(ECON.LOAN_DAILY_RATE * 100).toFixed(1)}% на ден<br>Лимит според репутацията: ${fmt(econ.maxLoan(S.rep))} €</div>
    <div class="row"><button class="btn" id="bLoan">+ ${fmt(ECON.LOAN_STEP)} €</button><button class="btn2" id="bRepay" ${s.loan > 0 ? '' : 'disabled'}>Погаси ${fmt(ECON.LOAN_STEP)} €</button></div></div>
    <div class="sect">Последни движения</div>
    ${s.ledger.slice(-12).reverse().map(l => `<div class="card" style="padding:8px 12px"><div class="row" style="margin:0"><span class="meta" style="margin:0">${l.note}</span><b style="color:${l.amount >= 0 ? 'var(--ok)' : 'var(--bad)'}">${l.amount >= 0 ? '+' : ''}${fmt(l.amount)} €</b></div></div>`).join('') || '<div class="empty">Още няма движения.</div>'}`;
  $('bLoan').onclick = () => { if (econ.takeLoan(S.rep)) { toast('🏦 Взе кредит.', 'good'); save(); } else toast('Достигнат е лимитът за кредит.', 'bad'); renderPanel(); };
  $('bRepay').onclick = () => { if (econ.repayLoan()) { toast('Погаси част от кредита.', 'good'); save(); } else toast('Нямаш достатъчно пари.', 'bad'); renderPanel(); };
}
function toast(text, kind = '', onClick = null) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = text;
  if (onClick) { t.style.pointerEvents = 'auto'; t.style.cursor = 'pointer'; t.onclick = () => { onClick(); t.remove(); }; }
  $('toasts').prepend(t);
  setTimeout(() => t.remove(), 5000);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}
// плавно отиване на камерата до парцел
let fly = null;
function flyTo(lot) { fly = { from: controls.target.clone(), to: new THREE.Vector3(lot.x, 0, lot.z), t: 0, off: camera.position.clone().sub(controls.target) }; }
const hl = new THREE.Mesh(new THREE.RingGeometry(10.5, 11.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.9 }));
hl.visible = false; scene.add(hl);
let hlT = 0;
function highlightLot(id) { const l = city.lots[id]; hl.position.set(l.x, 0.15, l.z); hl.visible = true; hlT = 3; }

// скорост
let speed = 1;
document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.s));
function setSpeed(s) { speed = s; document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === s)); }
addEventListener('keydown', e => { if (e.code === 'Space' && S && !$('mapScreen').offsetParent === false) { e.preventDefault(); setSpeed(speed ? 0 : 1); } });

// „Покажи на картата“: правилният изглед (България/Балкани/Европа/свят), приближаване към града и пулсиращ кръг
// покупка с инвестиционен кредит: ако парите не стигат — предложи кредит за разликата (+10% резерв)
function withLoan(cost, note, doBuy) {
  if (econ.canAfford(cost)) { doBuy(); return; }
  // имаш пари в банката (депозит + готова лихва) — първо от тях, кредит само ако и те не стигат
  const dep = Math.floor(econ.s.deposit || 0), ready = Math.round(econ.s.depReady || 0), short = cost - econ.s.money;
  if (dep + ready >= short) {
    modal('🏦 Пари от депозита', `За „${note}“ в сметката ти липсват <b>${fmt(Math.ceil(short))} €</b>, но в банката имаш <b>${fmt(dep + ready)} €</b>${ready ? ` (депозит ${fmt(dep)} € + готова лихва ${fmt(ready)} €)` : ' на депозит'}.<br>Ще изтеглим нужното от там — без кредит и без лихва.`,
      [['Отказ', null], [`Изтегли ${fmt(Math.ceil(Math.max(0, short - ready)))} € и купи`, () => { if (ready) econ.collectInterest(); const rest = cost - econ.s.money; if (rest > 0) econ.depositOut(Math.ceil(rest)); doBuy(); renderPanel(); }]]);
    return;
  }
  const ut = units.map(u => u.type), need = Math.ceil((cost - econ.s.money + cost * 0.1) / 10000) * 10000, max = econ.invMax(ut), T = econ.invTerms(need, ut);
  if (!T || need > max) { toast(`🏦 Банката дава общо до ${fmt(max)} € инвестиционни кредити (250% от нетната стойност) — нужни са ${fmt(need)} €.`, 'bad'); return; }
  const daily = Math.ceil(need / T.days) + Math.ceil(need * T.rate / T.days), risky = T.rate > ECON.INV_RATE;
  modal(`🏦 Инвестиционен кредит`, `За „${note}“ ти трябват още <b>${fmt(cost - econ.s.money)} €</b>.<br>Банката предлага <b>${fmt(need)} €</b> (с 10% резерв): <b style="color:${risky ? 'var(--bad)' : 'var(--ok)'}">${Math.round(T.rate * 100)}% лихва</b> за целия срок, изплаща се сама за ${T.days} дни — вноска ~<b>${fmt(daily)} €/ден</b>.${risky ? `<br>⚠️ Дългът ще е ${Math.round(T.ratio * 100)}% от нетната стойност на фирмата — затова лихвата е по-висока.` : ''} Можеш да го погасиш предсрочно от „Банка“ (без лихвата за остатъка).`,
    [['Отказ', null], [`Вземи ${fmt(need)} € и купи`, () => { econ.invTake(need, note, T.rate, T.days); doBuy(); renderPanel(); }]]);
}
function showCityOnMap(id) {
  const c = cityById(id); if (!c || !S) return;
  mapCont = viewOf(contOf(id)?.key)?.key || null; mapWorld = isWorld(id); mapEU = mapWorld || isEurope(id); mapWide = mapEU || isForeign(id);
  mapView = null; showMap(true);
  const [x, y] = proj(c.lon, c.lat), [, , bw, bh] = mapView.base, k = mapCont ? 0.45 : mapWorld ? 0.25 : mapEU ? 0.35 : 0.5, w = bw * k, h = bh * k;
  mapView.vb = [x - w / 2, y - h / 2, w, h]; $('mapSvg').setAttribute('viewBox', mapView.vb.join(' ')); drawMap();
  const r = (mapCont ? 40 : mapWorld ? 140 : mapEU ? 40 : mapWide ? 14 : 8) * 1.4, ns = 'http://www.w3.org/2000/svg', ring = document.createElementNS(ns, 'circle');
  ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', r); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ffb300'); ring.setAttribute('stroke-width', r / 5);
  ring.innerHTML = `<animate attributeName="r" values="${r * 0.6};${r * 1.6};${r * 0.6}" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>`;
  $('mapSvg').appendChild(ring); setTimeout(() => ring.remove(), 6000);
  toast(`📍 ${c.cc ? c.cc + ' ' : ''}${c.nm}`, 'good');
}
// ============================================================ карта на България
function proj(lon, lat) { return [(lon - 25.4) * Math.cos(42.7 * Math.PI / 180) * 100, -(lat - 42.75) * 100]; }
function drawMap() {
  const svg = $('mapSvg');
  const wide = mapWide || (S && !mapPicked && ownedCities().some(isForeign));
  if (wide && !mapWide) mapWide = true;
  if (S && !mapPicked && ownedCities().some(isEurope) && mapView == null) mapEU = true;   // сам избран изглед (mapPicked) не се сменя
  if (S && !mapPicked && ownedCities().some(isWorld) && mapView == null) mapWorld = true;
  if (!mapWorld) mapCont = null;
  if (mapWorld) { mapEU = true; if (!worldGeo) { worldGeo = []; fetch('assets/data/world.json').then(r => r.json()).then(j => { worldGeo = j; drawMap(); }).catch(() => {}); } }
  if (mapEU) mapWide = true;
  const base = mapCont ? viewOf(mapCont).base : mapWorld ? [-11800, -3600, 22400, 13000] : mapEU ? [-2900, -1800, 5600, 2700] : mapWide ? [-450, -300, 1090, 860] : [-300, -200, 600, 400];
  if (!mapView || mapView.wide !== mapWide || mapView.eu !== mapEU || mapView.world !== mapWorld || (mapView.cont || null) !== mapCont) mapView = { wide: mapWide, eu: mapEU, world: mapWorld, cont: mapCont, base, vb: [...base] };
  svg.setAttribute('viewBox', mapView.vb.join(' '));
  svg.classList.toggle('wide', mapWide && !mapEU);
  svg.classList.toggle('eu', mapEU && !mapWorld);
  svg.classList.toggle('world', mapWorld);
  svg.style.setProperty('--ls', (mapLS() * (mapCont ? (viewOf(mapCont).ls || 0.42) : 1)).toFixed(3));
  svg.setAttribute('preserveAspectRatio', mapWide && !mapCont ? 'xMinYMid meet' : 'xMidYMid meet');   // при Балканите картата е вляво, далеч от панела
  let h = mapWorld ? '<rect x="-20000" y="-10000" width="40000" height="25000" fill="#5f9fd6"/>' : '<rect x="-6000" y="-4000" width="12000" height="8000" fill="#5f9fd6"/>';
  const wonIso = new Set(S && econ ? wonCountries(x => econ.isFinished(x)).map(k => k.iso) : []);
  for (const c of mapWorld ? (worldGeo || []) : europe) {
    const d = c.poly.map(poly => poly.map(ring => 'M' + ring.map(([lo, la]) => proj(lo, la).map(v => v.toFixed(1)).join(',')).join('L') + 'Z').join('')).join('');
    h += `<path class="country ${c.iso === 'BGR' ? 'bg' : ''} ${wonIso.has(c.iso) ? 'won' : ''}" d="${d}" fill-rule="evenodd"/>`;
  }
  // завладени държави и напредъкът (🇧🇬 4/6) — при държавите, където имаш поне един завършен град или филиал
  if (S && econ) for (const k of COUNTRIES) {
    const pr = countryProgress(k, x => econ.isFinished(x)); if (!pr.done && !k.cities.some(id => ownedCities().includes(id))) continue;
    if (!mapEU && !mapWorld && !mapWide && k.iso !== 'BGR') continue;
    const [lo, la] = countryLabelLL(k, cityById), [x, y] = proj(lo, la), fs = 11 * (mapEU ? 3.2 : mapWide ? 1.4 : 1) * mapK();
    h += `<text class="cwon ${pr.won ? 'ok' : ''}" x="${x}" y="${y + fs * 2.2}" font-size="${fs}" text-anchor="middle">${k.cc} ${pr.won ? '✅ Завладяна' : `${pr.done}/${pr.total}`}</text>`;
  }
  for (const [iso, [lo, la]] of Object.entries(mapEU ? {} : mapWide ? COUNTRY_LABEL_WIDE : COUNTRY_LABEL_AT)) { const [x, y] = proj(lo, la); h += `<text class="clabel" x="${x}" y="${y}">${COUNTRY_BG[iso]}</text>`; }
  if (!mapWorld) { const [x, y] = proj(28.9, 42.9); h += `<text class="sea" x="${x}" y="${y}">ЧЕРНО МОРЕ</text>`; }
  if (mapCont) h += contLabels(mapCont);
  // първо надписите, после точките отгоре — съседни градове (Пловдив/Пазарджик) не се закриват
  const pts = CITIES.map(c => { const [x, y] = proj(c.lon, c.lat), hq = S && (S.hqCity || S.cityId) === c.id, here = S && S.cityId === c.id; return { c, x, y, hq, here, r: (hq || here ? 6 : 2 + c.sz) * (mapEU ? 4.5 : mapWide ? 1.6 : 1) * mapK() }; }).filter(o => mapCont ? (viewOf(mapCont).ids.has(o.c.id) || o.hq || o.here || ownedCities().includes(o.c.id)) : mapWorld ? ((isWorld(o.c.id) && (!contOf(o.c.id) || o.c.sz >= 3)) || WORLD_ANCHORS.includes(o.c.id) || o.hq || o.here || ownedCities().includes(o.c.id) || airportOf(o.c.id)) : (!mapEU || (o.c.sz >= 2 && !isWorld(o.c.id)) || o.hq || o.here || ownedCities().includes(o.c.id)));
  for (const { c, x, y, hq, here, r } of pts) h += `${here && !hq ? `<text class="hqico" x="${x - 7}" y="${y - 9}">📍</text>` : ''}<g class="city lbl ${hq || here ? 'hq' : ''} ${S && dev.best() < cityLv(c.id) ? 'locked' : ''}" data-city="${c.id}"><text x="${c.left ? x - r - 2 : x + r + 2}" y="${y + 3.5}" text-anchor="${c.left ? 'end' : 'start'}">${c.cc ? c.cc + ' ' : ''}${c.nm}${econ && econ.isFinished && econ.isFinished(c.id) ? ' 🏁' : ''}</text>${hq ? `<text class="hqico" x="${x - 9}" y="${y - 9}">🏗️</text>` : (S?.branches || []).includes(c.id) ? `<text class="hqico" x="${x - 8}" y="${y - 7}" style="font-size:${(13 * mapLS()).toFixed(1)}px">🏢</text>` : ''}${(ECON.FACTORIES || []).filter(f => f.cityId === c.id).map((f, i) => `<text class="hqico" x="${x - 4 + i * 11}" y="${y + 16}" style="font-size:${(11 * mapLS()).toFixed(1)}px">${ECON.MATERIALS[f.materialId].ico}</text>`).join('')}</g>`;
  for (const { c, x, y, hq, r } of pts) h += `<g class="city ${hq ? 'hq' : ''} ${S && econ?.isFinished?.(c.id) ? 'done' : ''} ${S && dev.best() < cityLv(c.id) ? 'locked' : ''}" data-city="${c.id}"><circle class="hit" cx="${x}" cy="${y}" r="${(mapEU ? 34 : mapWide ? 11 : 7) * mapK()}"/><circle cx="${x}" cy="${y}" r="${r}"/></g>`;
  h = h.replace('<g class="city lbl', railSvg() + '<g class="city lbl');
  h = h.replace('<g class="city lbl', hwSvg() + abSvg() + airSvg() + seaSvg() + '<g class="city lbl');
  h += resorts.svg();   // Фаза 5: курортите
  h += '<g id="trainLayer"></g><g id="planeLayer"></g><g id="shipLayer"></g>';
  svg.innerHTML = h;
  updateMapTrains(); updateMapPlanes(); updateMapShips();
  svg.querySelectorAll('.city').forEach(g => g.onclick = () => clickCity(g.dataset.city));
  svg.querySelectorAll('[data-resort]').forEach(g => g.onclick = () => resorts.open(g.dataset.resort));
}
// ---- Фаза 5: курорти (resorts.js)
const quests = createQuests({ S: () => S, econ: () => econ, toast, fmt, save, sound: n => Sound.play(n),
  railPath: (a, b) => railPath(a, b), connectedCities: () => connectedCities(), factories: ECON.FACTORIES, toll: () => hwToll(), isForeign: id => isForeign(id), pop: (k, a, b) => showEventPop(k, a, b), onClaim: () => dev.add(dev.XP.quest), devBest: () => dev.best() });
// оферти от доставчици (supply.js): стоката идва, щом има жп линия или магистрала до доставчика
const supply = createSupply({ S: () => S, econ: () => econ, MATERIALS: ECON.MATERIALS, FACTORIES: ECON.FACTORIES || [],
  cityName: id => cityById(id).nm, ownedCities: () => ownedCities(), isForeign: id => isForeign(id),
  rail: (a, b) => { const p = railPath(a, b); return !!p && p.length > 1; },
  road: (a, b) => { const done = allSegs().filter(x => hwDone().includes(x.id)), seen = new Set([a]), q = [a]; while (q.length) { const c = q.shift(); if (c === b) return true; for (const x of done) { const n = x.a === c ? x.b : x.b === c ? x.a : null; if (n && !seen.has(n)) { seen.add(n); q.push(n); } } } return false; },
  toast, fmt, save, sound: n => Sound.play(n), canOffer: () => dev.offersOpen(), devLevel: () => dev.best(), balkans: () => true,
  onRailDelivery: txt => { if (!$('mapScreen').classList.contains('hidden')) toast(txt, 'good'); else sendCityTrain(txt); refreshWarehouse(); } });
// конкурентни фирми (rivals.js): вземат поръчки, които не приемеш навреме, и строят на парцела
const rivals = createRivals({ S: () => S, toast, fmt, cc: () => S && cityById(S.cityId)?.cc,
  onBuilt: (lotId, type, firm) => {
    const lot = city.lots[lotId]; if (!lot || lot.built) return;
    if (lot.busy === 'rival') lot.busy = null;
    const n = buildingFor(type, type === 'tower' ? 15 : undefined);
    placeBuilding(lot, n, 0); S.built.push({ lot: lotId, model: n });
    if (firm) toast(`${firm.ico} ${firm.nm} завърши сграда в града.`);
  } });
// Фаза 7: ниво на развитие (devlevel.js)
const dev = createDevLevel({ S: () => S, cityName: () => S ? cityName() : '', maxLevel: () => Math.max(S?.dev?.lv || 1, ...Object.values(S?.cities || {}).map(c => c.dev?.lv || 1)), toast, sound: n => Sound.play(n), save, modal, pop: (k, a, b) => showEventPop(k, a, b), balkansOpen: () => true });
const tutorial = createTutorial({ S: () => S, projects: () => projects, units: () => units, save,
  onMap: () => !$('mapScreen').classList.contains('hidden'), openTab: t => { tab = t; renderPanel(); } });
const resorts = createResorts({
  S: () => S, econ: () => econ, toast, modal, proj, fmt, save, devBest: () => dev.best(), symK: () => (mapEU ? 2.6 : mapWide ? 1.6 : 1) * mapK(),
  onExtDone: key => { if (key === 'hotel') quests.emit('resortHotel'); },
  onSeasonEnd: (r, got, total) => { showEventPop('resort-unlock', `🏁 Край на сезона в ${r.nm}`, `Спечели ${fmt(got)} € този сезон · общо ${fmt(total)} €`); SFXcash(); },
  onUnlock: () => showEventPop('resort-unlock', '🔓 Отключи курортите!', 'Боровец, Пампорово и Приморско — виж ги на картата.'),
  redraw: () => { if (!$('mapScreen').classList.contains('hidden')) { drawMap(); renderMapHud(); } refreshResortView(); },
  enter: id => openHwView('resort:' + id),
  sound: n => Sound.play(n),
});
function clickCity(id) {
  const c = CITIES.find(q => q.id === id);
  if (!S && !START_CITIES.includes(id)) { toast('Започваш в София, Пловдив, Стара Загора или Варна — другите градове се отключват с развитието.', 'bad'); return; }
  if (!S) {
    modal(`🏗️ Основи фирмата в ${c.nm}?`, `Започваш с ${fmt(ECON.START.money)} €, бригада работници, багер и самосвал. Градът е измислен, но се намира в ${c.nm}.`,
      [['Отказ', null], ['Основи фирмата', () => newGame(id)]]);
  } else if (railPick) railClick(id);
  else if (S.cityId === id) enterCity();
  else if (ownedCities().includes(id)) modal(`${id === S.hqCity ? '🏗️ Централа' : '🏢 Филиал'} в ${c.nm}`, `Влез и играй в ${c.nm}: свои поръчки, обекти, имоти и техника. Парите и репутацията са общи.<br>Докато не си там, градът носи около ${fmt(1400 + 350 * S.rep + 120 * (S.officeLevel || 1))} € на ден, а обектите му продължават.${factoryInfo(id)}`, [['Отказ', null], [`Влез в ${c.nm}`, () => switchCity(id)]]);
  else if (dev.best() < (isWorld(id) ? 10 : isForeign(id) && !isEurope(id) ? 6 : cityLv(id))) modal(`${c.cc ? c.cc + ' ' : ''}${c.nm}`, `${lockTxt(isForeign(id) && !isEurope(id) ? 6 : cityLv(id))}<br>${isForeign(id) && !isEurope(id) && dev.best() >= 5 ? `Междувременно можеш да построиш жп линия до ${c.nm}.` : ''}${factoryInfo(id)}`, [['Добре', null]]);
  else if (contOf(id) && !contOf(id).open() && contOf(id).locked(id)) modal(`${c.cc} ${c.nm}`, `${contOf(id).lockTxt()}`, [['Добре', null]]);
  else if (isWorld(id) && !airLinked(id) && !contLandLinked(id)) modal(`${c.cc} ${c.nm}`, contOf(id) ? `${contOf(id).ico} До ${c.nm} още нямаш връзка. Отвори авиолиния от твое летище до ${c.nm} (бутон „✈️ Летища“ горе) или стигни дотук по суша — с жп линия или магистрала от твой град на континента. После ще можеш да отвориш филиал тук.` : `✈️ До ${c.nm} се стига само по въздуха. Отвори авиолиния от твое летище до ${c.nm} (бутон „✈️ Летища“ горе), после ще можеш да отвориш филиал тук.`, [['Затвори', null], ['✈️ Летища', () => openBig('air')]]);
  else {
    const cost = ECON.BRANCH_COST(id, (S.branches || []).length), disc = (S.branchDiscounts || 0) > 0 ? Math.round(cost * 0.3 / 1000) * 1000 : 0;
    modal(`🏙️ Филиал в ${c.nm}?`, `Цена: <b>${fmt(cost + branchExtra(id, cost) - disc)} €</b>${disc ? ` (−${fmt(disc)} € за завършен град)` : ''}, поддръжка ${fmt(ECON.BRANCH_UPKEEP)} €/ден. Филиалът носи печалба всеки ден (расте с репутацията и нивото на централата).${factoryInfo(id)}`,
      [['Отказ', null], ['Отвори филиал', () => withLoan(cost + branchExtra(id, cost) - disc, `Филиал в ${c.nm}`, () => {
        const extra = branchExtra(id, cost);   // Европа и светът са по-скъпи
        if (!econ.canAfford(cost + extra) || !econ.openBranch(id, (S.branches || []).length, c.nm)) { toast('Нямаш достатъчно пари за филиал.', 'bad'); return; }
        if (extra > 0) econ.spend(extra, 'филиали', `Разрешителни в ${c.nm}`); else if (extra < 0) econ.earn(-extra, 'филиали', `${c.nm}: фиксирана цена за столица`);
        if (disc) { econ.earn(disc, 'филиали', 'Отстъпка за завършен град (−30%)'); S.branchDiscounts--; }
        S.branches = [...(S.branches || []), id];
        S.branchPaid = { ...(S.branchPaid || {}), [id]: cost + extra - disc };   // за оценката при продажба
        dev.add(dev.XP.branch);
        S.cities[id] = { ...newCityState(), left: nowDays() };   // начален екип: бригада, багер, самосвал
        toast(`🏢 Отвори филиал в ${c.nm}!`, 'good'); showEventPop('new-branch', `📍 Нов филиал: ${c.nm}`, 'Влез в града от картата и строй и там.'); SFXcash(); save(); showMap(true);
      })]]);
  }
}
// столиците и големите градове (Рим, Лондон, Барселона…): филиалът е с фиксирана цена CAPITAL_BRANCH, колкото и филиали да имаш
const CAPITAL_BRANCH = 25000000;
const CAPITALS = new Set(['istanbul', 'ankara', 'athens', 'bucharest', 'belgrade', 'skopje', 'london', 'paris', 'berlin', 'rome', 'madrid', 'barcelona', 'milan', 'munich', 'amsterdam', 'brussels', 'vienna', 'prague',
  'budapest', 'warsaw', 'zurich', 'bern', 'luxembourg', 'hague', 'moscow', 'stpetersburg', 'kyiv', 'cairo', 'newyork', 'washington', 'losangeles', 'mexicocity', 'ottawa', 'toronto', 'rio', 'saopaulo', 'brasilia',
  'buenosaires', 'bogota', 'lima', 'santiagocl', 'caracas', 'tokyo', 'beijing', 'shanghai', 'seoul', 'delhi', 'mumbai', 'dubai', 'abudhabi', 'singapore', 'bangkok', 'kualalumpur', 'jakarta', 'manila', 'hanoi',
  'riyadh', 'sydney', 'canberra', 'auckland', 'wellington', 'lagos', 'abuja', 'nairobi', 'addisababa', 'casablanca', 'rabat', 'algiers', 'tunis', 'dakar', 'accra', 'capetown', 'pretoria', 'johannesburg', 'kinshasa', 'luanda']);
// надценката над BRANCH_COST: за столица — колкото да стане точно CAPITAL_BRANCH; иначе разрешителните за Европа (×1.5) и света (×3)
const branchExtra = (id, cost) => CAPITALS.has(id) ? CAPITAL_BRANCH - cost : isWorld(id) ? Math.round(cost * 3 / 5000) * 5000 : isEurope(id) ? Math.round(cost * 1.5 / 5000) * 5000 : 0;
function factoryInfo(id) {
  const f = (ECON.FACTORIES || []).filter(q => q.cityId === id);
  if (!f.length) return '';
  return `<br><br>🏭 ${f.map(q => `${q.nm}: ${ECON.MATERIALS[q.materialId].ico} ${ECON.MATERIALS[q.materialId].nm.toLowerCase()}`).join('<br>🏭 ')}<br><i>С жп връзка до ${cityById(id).nm} материалът ти излиза −${Math.round(RAIL_DISC * 100)}% по-евтино, с магистрала −${Math.round(ROAD_DISC * 100)}%.</i>`;
}
// екран „Автори“: моделите и звуците в играта (CC-BY изисква посочване на автора)
function showCredits() {
  modal('📜 Автори', `<div style="line-height:1.6;font-size:13px">
    <b>3D модели (CC0):</b> Kenney — City Kit (Commercial, Suburban, Industrial, Roads), Car Kit, Train Kit, Watercraft Kit, Nature Kit, Modular Buildings, Holiday Kit · <a href="https://kenney.nl" target="_blank">kenney.nl</a><br>
    Majadroid (Maik Hoffmann) — House Construction Site (CC0)<br>
    <b>3D модели (CC-BY 3.0, <a href="https://poly.pizza" target="_blank">poly.pizza</a>):</b><br>
    „Bulldozer“ — Poly by Google · „Dump truck“ — jeremy · „Crane“ — Max Hancock · „Crane“ — J-Toastie<br>
    <b>Sketchfab (CC-BY 4.0):</b> „( FREE ) La tour Eiffel“ — SDC PERFORMANCE™ · „Burj Khalifa“ — ManySince910 · „New York Buildings“ — sumitmangela · „Statue of liberty“ — 3Dystopia · „Sydney Opera House“ — Nick Reinhardt · „Saint Basil's Cathedral“ — Polskaball · „Gula's CN Tower“ — gula · „Willis Tower - Sears Tower“ — BoldlyBuilding · „Shanghai Tower“ — NanoRay · „Christ the Redeemer“ — JuanG3D · дървета в курортите: „Palm Trees“ — YadroGames · „Snow Pine Tree and Bush Pack“ — EFX · „Pine tree“ — Andriy Shekh · „Low Poly Forest Tree Pack“ — 99.Miles · хора: „Lowpoly People - 2“ — Loïc Norgeot · хотели: „Rosa Khutor Golden Tulip“ — Aleksandr Shevchenko · „Skyscraper Hotel Apartments Marina“ — asleshka · „Miami style condominium“ и „Hi rise apartment building“ — aitortilla01 · „mountain rock villa hotel“ — zigurat architecture studio · „Low Poly EMD GP38“ — TheOminousDuck · „BR 01 german steam locomotive“ — Tom Zimmermann · „Train Car (WIP)“ — evildavo · „AVEENG“ и „High Speed_ Wagon“ — dannzjs · „Small Cargo Ship“ — Styx · „Tanker“ — 3DDomino · „Viking Cruise Ship“ — jfactory · „Road roller truck“ — Sidra · „Japanese Dump Truck“ — Pavel Gorbachev · „low pôly excavator“ — KI NG · „Crane Vehicle [Low-Poly]“ — HanSoloSnipe · „Free Low Poly Vehicles Pack“ — RgsDev · „Backhoe Loader“ и „Motor Grader“ — doty_aecom · „Snow Mountain“ — hkp941111 · „Mountain low poly“ — Mehdi Shahsavan · „Chair Lift“ — Kagelok · „A-Frame Cabin (NEW VERSION)“ — Jen S Abbott · „Colosseum“ — Carlos.Maciel · „Singapore Office Skyscraper“ — 99.Miles · „Rand Tower“ — hamma085 · „US Bank Tower“ — Mitya Petrov · „Free Building“ — 3DHorse · „city building“ — Griffin M · „Stone Bridge_3arch“ и „Railway Stone Bridge“ — xplanepilot · „Milwaukee Road Depot“ — hamma085 · „Train Station - Nieborowice, Poland“ — Balaclava3DStudio · „Low Poly Airliner“ и „Low Poly Boeing 787 Dreamliner“ — Mauro3D · „Airbus A320 Airliner“ — Yes · „Boeing 767-200ER“ — beanz_ncheese · „Air Traffic Control Tower“ — abass20<br>
    <b>Звуци (CC0):</b> Kenney — Music Jingles и UI Audio<br>
    <b>Карта:</b> Natural Earth (public domain)<br>
    <span style="color:var(--mut)">Лицензът CC-BY 3.0: creativecommons.org/licenses/by/3.0 — подробности в assets/heavy/CREDITS.txt.</span></div>`, [['Затвори', null]]);
}
function showMap(on) {
  $('mapScreen').classList.toggle('hidden', !on);
  if (on) {
    drawMap();
    $('panel').classList.toggle('hidden', true);
    if (S) {
      $('mapTitle').textContent = `${S.cityId === S.hqCity ? 'Централа' : 'Филиал'}: ${cityName()}`;
      $('mapText').innerHTML = `Ден ${S.day} · ${fmt(econ.money)} € · завършени обекти: ${S.done}<br>Натисни града с 🏗️, за да влезеш.`;
      $('mapBtns').innerHTML = `<button class="btn" id="mbEnter">Към ${cityName()}</button><button class="btn2" id="mbSaves">💾 Записи</button><button class="btn2" id="mbCredits">📜 Автори</button><button class="btn2" id="mbNew">Нова игра</button>`;
      $('mapBtns').insertAdjacentHTML('beforeend', viewBarHtml());
      $('mapBtns').querySelectorAll('[data-mview]').forEach(b => b.onclick = () => setMapView(b.dataset.mview));
      $('mbEnter').onclick = enterCity;
      if ($('mbCredits')) $('mbCredits').onclick = showCredits; $('mbSaves').onclick = () => openSaves({ modal, toast, fmt, save, cityName: id => cityById(id).nm });
      $('mapBtns').insertAdjacentHTML('afterend', '');
      if (!$('mapRail')) $('mapHud').insertAdjacentHTML('beforeend', '<div id="mapRail" style="display:flex;flex-direction:column;gap:8px"></div>');
      renderMapHud();
      $('mbNew').onclick = () => modal('Нова игра?', 'Сегашната фирма ще бъде изтрита.', [['Отказ', null], ['Изтрий и започни', () => { localStorage.removeItem(SAVE_KEY); location.reload(); }]]);
    } else {
      $('mapTitle').textContent = 'Избери град';
      $('mapText').textContent = `Къде ще основеш строителната си фирма? Натисни град на картата. (слот ${currentSlot()})`;
      $('mapBtns').innerHTML = '<button class="btn2" id="mbSaves">💾 Записи</button><button class="btn2" id="mbCredits">📜 Автори</button>';
      if ($('mbCredits')) $('mbCredits').onclick = showCredits; $('mbSaves').onclick = () => openSaves({ modal, toast, fmt, save, cityName: id => cityById(id).nm });
    }
  } else if (S) $('panel').classList.remove('hidden');
}
$('btnSound').onclick = () => { Sound.init(); $('btnSound').textContent = Sound.toggle() ? '🔇' : '🔊'; };
$('quickBuy').onclick = () => { buyForProjects(); refreshWarehouse(); save(); renderPanel(); Sound.play('buy'); };
$('buyPop').onclick = () => { $('buyPop').classList.add('out'); setTimeout(() => $('buyPop').classList.add('hidden'), 500); };
{ const c = () => { const r = $('mapSvg').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  $('mzIn').onclick = () => zoomAt(...c(), 1 / 1.4); $('mzOut').onclick = () => zoomAt(...c(), 1.4);
  $('mzReset').onclick = () => { if (mapView) { mapView.vb = [...mapView.base]; $('mapSvg').setAttribute('viewBox', mapView.vb.join(' ')); } }; }
{ const top = document.getElementById('top'), after = document.getElementById('bankBtn');
  for (const [id, html, k] of [['finBtn', '🏁', 'fin'], ['airBtn', '✈️ Летища', 'air'], ['seaBtn', '⚓ Пристанища', 'sea'], ['hwBtn', '🛣️ Магистрали', 'hw'], ['railBtn', '🚆 ЖП', 'rail'], ['garBtn', '🚜 Гараж', 'garage']]) {
    const b = document.createElement('button'); b.id = id; b.className = 'btn2'; b.innerHTML = html; b.onclick = () => openBig(k);
    top.insertBefore(b, after ? after.nextSibling : top.querySelector('.sp'));
  } }
// бутон горе: колко носят курортите днес (вижда се само в сезона); клик → картата с курортите
{ const top = document.getElementById('top'), b = document.createElement('button'); b.id = 'resBtn'; b.className = 'btn2'; b.style.display = 'none'; b.style.color = '#7dd3ff'; b.style.fontWeight = '800';
  b.title = 'Курортите — приход на ден в сезона'; b.onclick = () => openBig('resort'); top.insertBefore(b, $('finBtn') || top.querySelector('.sp')); }
function updFlowBtns() {
  for (const [k, id] of [['air', 'airBtn'], ['sea', 'seaBtn'], ['rail', 'railBtn']]) { const b = $(id); if (!b || !S) continue; const a = flowAvg(k); b.innerHTML = `${k === 'air' ? '✈️ Летища' : k === 'rail' ? '🚆 ЖП' : '⚓ Пристанища'}${a ? ` <b style="color:${a >= 0 ? '#7dffa8' : '#ff8a8a'}">${a >= 0 ? '+' : '−'}${fmt(Math.abs(a))}/ден</b>` : ''}`; }
}
function updResBtn() { updFlowBtns(); updSuperBtn(); const b = $('resBtn'); if (!b || !S) return; const n = resorts.dailyNow(S.day); b.style.display = ''; b.innerHTML = n ? `🏔️ +${fmt(n)} €/ден` : `${resorts.unlocked() ? '🏔️' : '🔒'} Курорти`; }
if ($('bankBtn')) $('bankBtn').onclick = () => { if (!S) return; $('qPanel')?.classList.add('hidden'); openBig('bank'); };   // банката — в прозорец, без прехвърляне в града
$('btnMapToggle').onclick = () => { if (!S) return; showMap($('mapScreen').classList.contains('hidden')); };
// 🌍 глобус на империята (globe.js): превзетите държави в зелено, започнатите в жълто, твоите градове като точки
function globeData() {
  const done = x => econ.isFinished(x), own = new Set(ownedCities()), partial = new Map();
  for (const k of COUNTRIES) { const pr = countryProgress(k, done); const mine = k.cities.some(id => own.has(id)); if (!pr.won && (pr.done || mine)) partial.set(k.iso, Math.max(0.15, pr.done / pr.total)); }
  const ids = [...new Set([...own, ...Object.keys(econ.s.finished || {})])];
  // надписи само на столиците на държавите, в които имаш присъствие (+ централата)
  const CAP = { TUR: 'ankara', CHE: 'bern', USA: 'washington', CAN: 'ottawa', BRA: 'brasilia', ZAF: 'pretoria', ARE: 'abudhabi', IND: 'delhi', AUS: 'canberra', NZL: 'wellington', MAR: 'rabat', NGA: 'abuja', TZA: 'dodoma', VNM: 'hanoi', CHN: 'beijing' };
  const caps = new Set(), capPts = [];
  for (const k of COUNTRIES) {
    const pr = countryProgress(k, done); if (!pr.done && !k.cities.some(id => own.has(id))) continue;
    const cap = CAP[k.iso] && cityById(CAP[k.iso]) ? CAP[k.iso] : k.cities[0]; caps.add(cap);
  }
  for (const id of caps) if (!ids.includes(id)) ids.push(id);
  const cities = ids.map(id => { const c = cityById(id); return c && { lat: c.lat, lon: c.lon, nm: c.nm, hq: id === S.hqCity, done: done(id), label: caps.has(id) || id === S.hqCity, cap: caps.has(id), mine: own.has(id) || done(id) }; }).filter(Boolean);
  const hq = cityById(S.hqCity || S.cityId), won = wonCountries(done);
  return { won: new Set(won.map(k => k.iso)), partial, cities, stats: { won: won.length, total: COUNTRIES.length }, focus: [hq.lat, hq.lon] };
}
{ const b = document.createElement('button'); b.id = 'btnGlobe'; b.className = 'btn2'; b.innerHTML = '🌍 Глобус'; b.title = 'Твоята империя върху глобуса';
  b.onclick = () => { if (!S) return; const ex = document.getElementById('globeView'); if (ex) { ex.querySelector('#globeClose').click(); return; } openGlobe(globeData()); };
  $('btnMapToggle').parentNode.insertBefore(b, $('btnMapToggle')); }
function modal(title, text, buttons) {
  const box = $('modalBox');
  box.innerHTML = `<h2>${title}</h2><p>${text}</p><div class="actions">${buttons.map((b, i) => `<button class="${i === buttons.length - 1 ? 'btn' : 'btn2'}" data-i="${i}">${b[0]}</button>`).join('')}</div>`;
  $('modal').classList.remove('hidden');
  box.querySelectorAll('button').forEach(b => b.onclick = () => { $('modal').classList.add('hidden'); const f = buttons[+b.dataset.i][1]; if (f) f(); });
}

// ============================================================ Фаза 3: жп мрежа, влакове, превози
const RAIL_EUR_KM = 900, RAIL_BASE = 15000, RAIL_KM_DAY = 30;   // цена и бързина на строежа
const TRAIN_COST = 60000, TRAIN_UPKEEP = 250, TRAIN_KM_DAY = 160, TRAIN_EUR_KM = 2;
const CARGO = [['въглища', '🪨'], ['зърно', '🌾'], ['контейнери', '📦'], ['дървесина', '🪵'], ['автомобили', '🚗'], ['цимент', '⚪'], ['торове', '🧪']];
const cityById = id => CITIES.find(c => c.id === id);
function kmBetween(a, b) {
  const A = cityById(a), B = cityById(b), r = Math.PI / 180;
  const h = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lon - A.lon) * r / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 1.2);   // ×1.2 — релсите не са по права линия
}
const railQuote = (a, b) => { const km = kmBetween(a, b); return { km, cost: Math.round((RAIL_BASE + km * RAIL_EUR_KM) / 1000) * 1000, days: Math.max(2, Math.ceil(km / RAIL_KM_DAY)) }; };
// граф от готовите линии
// ребра на мрежата; отклонението (r.c, r.br) свързва града r.a с двата края на основната линия r.b–r.c
function railEdges(all) { const e = []; for (const r of S.rails || []) if (all || r.built) { e.push([r.a, r.b]); if (r.c) e.push([r.a, r.c]); } return e; }
// „Стрела“ кара само по модернизирани (скоростни) линии: r.hs = true; r.hsBuild = { prog } докато се обновява
const HS_EUR_KM = 2500, HS_KM_DAY = 40;
const hsQuote = r => ({ cost: Math.round((300000 + r.km * HS_EUR_KM) / 10000) * 10000, days: Math.max(5, Math.ceil(r.km / HS_KM_DAY)) });
function hsNeighbors(id) { const out = []; for (const r of S.rails || []) if (r.built && r.hs && !r.c) { if (r.a === id) out.push(r.b); else if (r.b === id) out.push(r.a); } return out; }
function hsPath(from, to) {
  if (from === to) return [from];
  const prev = { [from]: null }, q = [from];
  while (q.length) { const c = q.shift(); for (const n of hsNeighbors(c)) if (!(n in prev)) { prev[n] = c; if (n === to) { const p = [to]; let k = to; while (prev[k]) { k = prev[k]; p.unshift(k); } return p; } q.push(n); } }
  return null;
}
function startHsUpgrade(i) {
  const r = (S.rails || [])[i]; if (!r || !r.built || r.hs || r.hsBuild || r.c) return;
  const q = hsQuote(r); if (!econ.canAfford(q.cost)) { toast('Нямаш пари за модернизацията.', 'bad'); return; }
  econ.spend(q.cost, 'покупка', `Модернизация ${cityById(r.a).nm} — ${cityById(r.b).nm}`);
  r.hsBuild = { prog: 0, days: q.days };
  toast(`⚡ Започна модернизацията ${cityById(r.a).nm} — ${cityById(r.b).nm} за скоростни влакове (${q.days} дни). Обикновените влакове продължават да минават.`, 'good'); Sound.play('buy'); save();
}
function railNeighbors(id) { const out = []; for (const [x, y] of railEdges()) { if (x === id) out.push(y); else if (y === id) out.push(x); } return out; }
// точката на разклона върху основната линия (в координатите на картата)
// разклонът е най-близката до града точка върху истинската (може и начупена) основна линия b→c
function junOn(r) {
  const A = cityById(r.a), [px, py] = proj(A.lon, A.lat), pts = railPts(r.b, r.c);
  let best = { d: Infinity, i: 0, x: pts[0][0], y: pts[0][1] };
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / ((dx * dx + dy * dy) || 1)));
    const x = x1 + dx * t, y = y1 + dy * t, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { d, i, x, y };
  }
  return { pts, i: best.i, J: [best.x, best.y] };
}
function junXY(r) { return junOn(r).J; }
// точките на отклонението от града r.a до края `to` на основната линия (по линията след разклона)
function branchPts(r, to) {
  const A = cityById(r.a), { pts, i, J } = junOn(r), start = [proj(A.lon, A.lat), J];
  return to === r.b ? [...start, ...pts.slice(0, i).reverse()] : [...start, ...pts.slice(i)];
}
// позиция по ребро p→q (k = 0..1); по отклонение минава през разклона
// ---- жп линии през сушата: ако правата между два града минава над море, линията чупи в точка навътре в сушата
function inRing(ring, x, y) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
const landAt = (lo, la) => (europe || []).some(c => c.poly.some(poly => inRing(poly[0], lo, la)));
const segLand = (a, b, n = 16) => { for (let k = 1; k < n; k++) { const t = k / n; if (!landAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
const bendCache = {};
// точка на чупката (lon, lat) или null, ако правата е по суша
function railBend(a, b) {
  const key = [a, b].sort().join('|'); if (key in bendCache) return bendCache[key];
  const A = cityById(a), B = cityById(b), pa = [A.lon, A.lat], pb = [B.lon, B.lat];
  if (!europe || !europe.length) return null;   // картата още не е заредена — без кеш
  let res = null;
  if (!segLand(pa, pb)) {
    const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (const off of [0.15, -0.15, 0.25, -0.25, 0.35, -0.35, 0.5, -0.5, 0.7, -0.7]) for (const along of [0, -0.2, 0.2]) {
      const P = [mx + nx * off * len + dx * along, my + ny * off * len + dy * along];
      if (landAt(P[0], P[1]) && segLand(pa, P) && segLand(P, pb)) { res = P; break; }
      if (res) break;
    }
    if (!res) for (const off of [0.15, -0.15, 0.25, -0.25, 0.35, -0.35, 0.5, -0.5, 0.7, -0.7]) { const P = [mx + nx * off * len, my + ny * off * len]; if (landAt(P[0], P[1])) { res = P; break; } }
  }
  return (bendCache[key] = res);
}
// точките на линията p→q в координатите на картата (с чупката, ако има)
function railPts(p, q) { const P = proj(cityById(p).lon, cityById(p).lat), Q = proj(cityById(q).lon, cityById(q).lat), v = viaOf(p, q); if (v) return [P, ...v.map(([lo, la]) => proj(lo, la)), Q]; const m = railBend(p, q); return m ? [P, proj(m[0], m[1]), Q] : [P, Q]; }
// изминатата част от начупена линия до дял k (за лентата на строежа)
function donePts(pts, k) { const out = [pts[0]], tot = pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0); let L = k * tot; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (L >= d) { out.push(pts[i]); L -= d; } else { const f = d ? L / d : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); break; } } return out; }
function ptAlong(pts, k) {
  const seg = []; let tot = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  let L = k * tot, i = 0; while (i < seg.length - 1 && L > seg[i]) { L -= seg[i]; i++; }
  const f = seg[i] ? Math.min(1, L / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
}
function edgeXY(p, q, k) {
  const P = proj(cityById(p).lon, cityById(p).lat), Q = proj(cityById(q).lon, cityById(q).lat);
  const br = (S.rails || []).find(r => r.c && ((r.a === p && (r.b === q || r.c === q)) || (r.a === q && (r.b === p || r.c === p))));
  if (!br) return ptAlong(railPts(p, q), k);
  // по отклонението и после по основната линия; в обратна посока — същите точки отзад напред
  const fromBranch = br.a === p, pts = branchPts(br, fromBranch ? q : p);
  return ptAlong(fromBranch ? pts : [...pts].reverse(), k);
}
// отклонения: градове извън мрежата, които са близо до готова линия (разклонът е между 8% и 92% от линията)
const KM_PER_UNIT = 1.11 * 1.2;   // 100 единици на картата ≈ 1° ширина ≈ 111 км; ×1.2 както kmBetween
function branchFor(id) {
  if (railEdges(true).some(([x, y]) => x === id || y === id)) return null;
  const C = cityById(id), [px, py] = proj(C.lon, C.lat);
  let best = null;
  for (const r of S.rails || []) {
    if (!r.built || r.c) continue;
    const A = cityById(r.a), B = cityById(r.b), [x1, y1] = proj(A.lon, A.lat), [x2, y2] = proj(B.lon, B.lat), dx = x2 - x1, dy = y2 - y1;
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    if (t < 0.08 || t > 0.92) continue;
    const km = Math.max(5, Math.round(Math.hypot(x1 + dx * t - px, y1 + dy * t - py) * KM_PER_UNIT));
    if (km > 120 || km > 0.6 * Math.min(kmBetween(id, r.a), kmBetween(id, r.b))) continue;
    if (!best || km < best.km) best = { id, host: r, t, km, cost: Math.round((RAIL_BASE * 2 + km * RAIL_EUR_KM) / 1000) * 1000, days: Math.max(2, Math.ceil(km / RAIL_KM_DAY)) };
  }
  return best;
}
const branchCands = () => CITIES.filter(c => dev.best() >= cityLv(c.id)).map(c => branchFor(c.id)).filter(Boolean).sort((a, b) => a.km - b.km);
function offerBranch(o, after) {
  const A = cityById(o.host.a), B = cityById(o.host.b), c = cityById(o.id);
  modal(`🔀 Отклонение до ${c.nm}`, `Разклон от линията <b>${A.nm} — ${B.nm}</b> до ${c.nm}.<br>Дължина: <b>${o.km} км</b> · цена <b>${fmt(o.cost)} €</b> (с разклонителна стрелка) · строеж ${o.days} дни.<br>Влаковете от ${c.nm} ще стигат и до ${A.nm}, и до ${B.nm}.${discPreviewHtml('rail', o.host.a, o.id)}`,
    [['Отказ', () => { railPick = null; drawMap(); }], ['Строй отклонението', () => {
      if (!econ.canAfford(o.cost)) { toast('Нямаш достатъчно пари за отклонението.', 'bad'); return; }
      if (!dev.has('LINKS')) return;
      econ.spend(o.cost, 'покупка', `Жп отклонение до ${c.nm}`);
      S.rails = [...(S.rails || []), { a: o.id, b: o.host.a, c: o.host.b, br: +o.t.toFixed(3), km: o.km, days: o.days, prog: 0, built: false }];
      railPick = null; toast(`🚧 Започна отклонението към ${c.nm} (${o.days} дни).`, 'good'); save();
      if (after) after(); else showMap(true);
    }]]);
}
function railPath(from, to) {
  if (from === to) return [from];
  const prev = { [from]: null }, q = [from];
  while (q.length) { const c = q.shift(); for (const n of railNeighbors(c)) if (!(n in prev)) { prev[n] = c; if (n === to) { const p = [to]; let k = to; while (prev[k]) { k = prev[k]; p.unshift(k); } return p; } q.push(n); } }
  return null;
}
function network() { const out = new Set([S.cityId]), q = [S.cityId]; while (q.length) for (const n of railNeighbors(q.shift())) if (!out.has(n)) { out.add(n); q.push(n); } return [...out]; }
// градове със заводска цена: нужни са поне един влак и готова линия
const RAIL_DISC = ECON.RAIL_DISCOUNT ?? 0.10, ROAD_DISC = ECON.ROAD_DISCOUNT ?? 0.05, AB_DISC = ECON.AB_DISCOUNT ?? 0.30;
// отстъпка за материал при дадени жп/магистрални мрежи (масиви от градове, свързани с текущия)
function transportDisc(m, railIds, roadIds, abIds = []) {
  let best = { pct: 0, via: null, cityId: (ECON.FACTORIES || []).find(f => f.materialId === m)?.cityId };
  for (const f of ECON.FACTORIES || []) {
    if (f.materialId !== m) continue;
    if (railIds.includes(f.cityId) && best.pct < RAIL_DISC) best = { pct: RAIL_DISC, via: 'rail', cityId: f.cityId };
    else if (abIds.includes(f.cityId) && best.pct < AB_DISC) best = { pct: AB_DISC, via: 'road', cityId: f.cityId, ab: true };
    else if (roadIds.includes(f.cityId) && best.pct < ROAD_DISC) best = { pct: ROAD_DISC, via: 'road', cityId: f.cityId };
  }
  return best;
}
const curDisc = m => transportDisc(m, connectedCities(), [...hwNetwork().filter(id => id !== S.cityId), ...accessIds('road')], [...abNetwork(), ...seaNetwork(), ...accessIds('ab')]);
// какво ще поевтинее, ако се добави нова жп линия (a–b) или магистрален участък (a–b)
function discPreview(kind, a, b) {
  const bfs = (start, edges) => { const out = new Set([start]), q = [start]; while (q.length) { const c = q.shift(); for (const [x, y] of edges) { const n = x === c ? y : y === c ? x : null; if (n && !out.has(n)) { out.add(n); q.push(n); } } } return [...out].filter(id => id !== start); };
  const railE = railEdges(), roadE = allSegs().filter(s => hwDone().includes(s.id)).map(s => [s.a, s.b]);
  if (kind === 'rail') railE.push([a, b]); else roadE.push([a, b]);
  const railN = bfs(S.cityId, railE), roadN = bfs(S.cityId, roadE);
  return Object.keys(ECON.MATERIALS).map(m => ({ m, now: curDisc(m), next: transportDisc(m, railN, roadN, [...abNetwork(), ...seaNetwork()]) })).filter(o => o.next.pct > o.now.pct);
}
function discPreviewHtml(kind, a, b) {
  const list = discPreview(kind, a, b);
  if (!list.length) return `<br><br><span style="color:var(--mut)">📦 Тази връзка не намалява цената на материали за ${cityName()}.</span>`;
  return `<br><br><b>📦 Ще поевтинеят за ${cityName()}:</b><br>` + list.map(({ m, next }) => {
    const M = ECON.MATERIALS[m], base = M.buyPrice;
    return `${M.ico} ${M.nm} от ${cityById(next.cityId).nm}: <s>${fmt(base)} €</s> → <b style="color:var(--ok)">${fmt(Math.round(base * (1 - next.pct) * 100) / 100)} €</b>/${M.unit} (−${Math.round(next.pct * 100)}%)`;
  }).join('<br>');
}
function connectedCities() { return network().filter(id => id !== S.cityId); }   // завършена жп връзка е достатъчна
const pathKm = p => p.slice(1).reduce((a, c, i) => a + kmBetween(p[i], c), 0);
// преки връзки: два близки града в мрежата без директна линия, а влакът минава по дълга заобиколка (Ротердам — Амстердам)
const SHORT_KM = 160, SHORT_RATIO = 1.6;
let shortCache = { sig: '', list: [] };
function shortcutCands() {
  const sig = (S.rails || []).map(r => r.a + r.b + (r.c || '') + (r.built ? 1 : 0)).join(',') + '|' + S.cityId + '|' + dev.best();
  if (shortCache.sig === sig) return shortCache.list;
  const net = network(), has = (a, b) => (S.rails || []).some(r => (r.a === a && (r.b === b || r.c === b)) || (r.a === b && (r.b === a || r.c === a)) || (r.b === a && r.c === b) || (r.b === b && r.c === a));
  const out = [];
  for (let i = 0; i < net.length; i++) for (let k = i + 1; k < net.length; k++) {
    const a = net[i], b = net[k], km = kmBetween(a, b);
    if (km > SHORT_KM || has(a, b) || dev.best() < cityLv(a) || dev.best() < cityLv(b) || contOf(a) !== contOf(b)) continue;
    const p = railPath(a, b); if (!p) continue;
    const now = Math.round(pathKm(p)); if (now < km * SHORT_RATIO) continue;
    out.push({ a, b, km, now, save: now - km, ...railQuote(a, b) });
  }
  out.sort((x, y) => y.save - x.save);
  shortCache = { sig, list: out };
  return out;
}
function offerShortcut(a, b, after) {
  const o = shortcutCands().find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); if (!o) return;
  modal(`⚡ Пряка линия ${cityById(a).nm} — ${cityById(b).nm}`, `Сега влаковете минават <b>${fmt(o.now)} км</b> по мрежата. Пряката линия е само <b>${o.km} км</b> — спестява ${fmt(o.save)} км на всеки курс (по-бързи курсове и по-малко гориво).<br>Цена: <b>${fmt(o.cost)} €</b> · строеж ${o.days} дни.`,
    [['Отказ', null], [`Строй · ${fmt(o.cost)} €`, () => {
      if (!econ.canAfford(o.cost)) { toast('Нямаш достатъчно пари за линията.', 'bad'); return; }
      econ.spend(o.cost, 'покупка', `Жп линия ${cityById(a).nm} — ${cityById(b).nm}`);
      S.rails = [...(S.rails || []), { a, b, km: o.km, days: o.days, prog: 0, built: false }];
      toast(`🚧 Започна пряката линия ${cityById(a).nm} — ${cityById(b).nm} (${o.days} дни).`, 'good'); save(); if (after) after();
    }]]);
}

let railPick = null;   // избран начален град при строене
function startRailMode() { if (!dev.has('LINKS')) { modal('🛤️ Жп линии', lockTxt(2), [['Добре', null]]); return; } railPick = 'pickA'; showMap(true); toast('🚆 Избери начален град — централата или град от твоята жп мрежа.'); }
function railClick(id) {
  const c = cityById(id), inNet = id === S.cityId || railEdges(true).some(([x, y]) => x === id || y === id);
  if (railPick === 'pickA') {
    if (!inNet) { const o = dev.best() >= cityLv(id) && branchFor(id); if (o) { offerBranch(o); return; } toast('Линията трябва да тръгва от централата или от град, който вече е в мрежата ти.', 'bad'); return; }
    railPick = id; toast(`Начало: ${c.nm}. Сега избери крайния град.`); drawMap(); return;
  }
  const a = railPick;
  if (id === a) { railPick = 'pickA'; drawMap(); return; }
  if (dev.best() < cityLv(id)) { toast(`🔒 ${c.nm} се отключва на ниво ${cityLv(id)} на развитие.`, 'bad'); return; }
  // между континентите няма жп, освен Азия (land) — тя се свързва с Европа по суша
  if ((contOf(a) || contOf(id)) && contOf(a) !== contOf(id) && !((contOf(a) || contOf(id)).land && !(contOf(a) && contOf(id)))) { toast(`🌊 Между ${cityById(a).nm} и ${c.nm} няма сухопътна жп връзка — ${(contOf(a) || contOf(id)).nm} се свързва с другите континенти по въздуха и по море.`, 'bad'); return; }
  if ((S.rails || []).some(r => (r.a === a && r.b === id) || (r.a === id && r.b === a))) { toast('Тази линия вече съществува.', 'bad'); return; }
  const q = railQuote(a, id);
  modal(`🚆 Жп линия ${cityById(a).nm} — ${c.nm}`, `Дължина: <b>${q.km} км</b><br>Цена: <b>${fmt(q.cost)} €</b><br>Строеж: ${q.days} дни${discPreviewHtml('rail', a, id)}`,
    [['Отказ', () => { railPick = null; drawMap(); }], ['Строй линията', () => {
      if (!econ.canAfford(q.cost)) { toast('Нямаш достатъчно пари за линията.', 'bad'); railPick = null; drawMap(); return; }
      econ.spend(q.cost, 'покупка', `Жп линия ${cityById(a).nm} — ${c.nm}`);
      S.rails = [...(S.rails || []), { a, b: id, km: q.km, days: q.days, prog: 0, built: false }];
      railPick = null; toast(`🚧 Започна строежът на линията ${cityById(a).nm} — ${c.nm} (${q.days} дни).`, 'good'); save(); showMap(true);
    }]]);
}
function updateRails(dtDays) {
  for (const r of S.rails || []) {
    if (r.built && r.hsBuild) {
      r.hsBuild.prog += dtDays / r.hsBuild.days;
      if (r.hsBuild.prog >= 1) { delete r.hsBuild; r.hs = true; toast(`⚡ Линията ${cityById(r.a).nm} — ${cityById(r.b).nm} е модернизирана — „Стрела“ вече може да минава по нея!`, 'good'); SFXcash(); save(); }
    }
    if (r.built) continue;
    r.prog += dtDays / r.days;
    if (r.prog >= 1) {
      r.built = true; r.prog = 1;
      dev.add(dev.XP.rail);
      setTimeout(() => supply.tryDeliver(), 0);
      showEventPop('rail-done', `🛤️ ${cityById(r.a).nm} — ${cityById(r.b).nm}`, `${r.km} км жп линия е готова.`);
      toast(`🚆 Линията ${cityById(r.a).nm} — ${cityById(r.b).nm} е готова!${(S.trains || []).length ? '' : ' Купи влак, за да я използваш.'}`, 'good');
      SFXcash(); save();
    }
  }
}
// влаковете са общи за фирмата: лимитът е сборът от коловозите на гарите във всички твои градове
function totalTracks() {
  return ownedCities().reduce((a, id) => a + (id === S.cityId ? (S.stationLevel || 0) : ((S.cities || {})[id]?.stationLevel || 0)), 0);
}
// видове влакове: товарните поемат превози до своя брой вагони; пътническият кара редовна линия и носи билети
const TRAIN_TYPES = {
  small: { nm: 'Малък товарен', ico: '🚂', wagons: 4, cost: 60000, upkeep: 250, speed: 160 },
  mid: { nm: 'Среден товарен', ico: '🚆', wagons: 8, cost: 110000, upkeep: 350, speed: 150 },
  heavy: { nm: 'Тежък товарен', ico: '🚄', wagons: 12, cost: 170000, upkeep: 480, speed: 135 },
  // товарен гигант: 50 вагона, кара сам дълги товарни курсове между далечни градове (не взема малките превози)
  giant: { nm: 'Товарен гигант', ico: '🚛', wagons: 50, cost: 8000000, upkeep: 4000, speed: 115, long: true, minKm: 500 },
  pax: { nm: 'Пътнически', ico: '🚃', wagons: 6, cost: 90000, upkeep: 300, speed: 185, pax: true },
  // бърз пътнически влак за директни линии през континента (Истанбул — Мадрид, Истанбул — Париж): само дълги курсове, скъпи билети
  express: { nm: 'Експрес „Стрела“', ico: '🚄', wagons: 20, cost: 12000000, upkeep: 8000, speed: 520, pax: true, express: true, minKm: 1000 },
};
const trainType = t => TRAIN_TYPES[t.kind || 'small'];
const trainImg = (k, h = 46) => `<img src="assets/ui/train-${TRAIN_TYPES[k]?.pax ? 'pax' : 'freight'}.webp" alt="" style="height:${h}px;object-fit:contain;vertical-align:middle">`;
const trainWagons = t => t.wagons || trainType(t).wagons;
function trainShopHtml() {
  const can = totalTracks() > (S.trains || []).length;
  // всички коловози са заети — магазинът не се показва, само как да се вземат още
  if (!can) return `<div class="meta late">🚆 Влакове ${(S.trains || []).length}/${totalTracks()} — всички коловози са заети. Надгради гарите (таб „Офис“), за да купиш още.</div>`;
  return Object.entries(TRAIN_TYPES).map(([k, T]) => `<div class="card" style="padding:9px 11px"><div style="text-align:center">${trainImg(k, 52)}</div><div class="row" style="margin:0"><span><b>${trainImg(k, 20)} ${T.nm}</b> · ${T.wagons} ${T.pax ? 'пътнически вагона' : 'вагона'}</span><b>${fmt(T.cost)} €</b></div>
    <div class="meta">${T.express ? `Директни линии над ${fmt(T.minKm)} км през континента (Истанбул — Мадрид, Истанбул — Париж…) със скъпи билети. ⚡ Кара <b>само по модернизирани линии</b> — модернизирай ги от прозореца „ЖП“. Много бърз — ${T.speed} км на ден.` : T.pax ? 'Кара сам до случайни свързани градове и носи пари от билети при всяко пристигане.' : (T.long ? `Само за големи разстояния: кара сам дълги товарни курсове над ${fmt(T.minKm)} км между далечни градове (Истанбул — Мадрид, Варна — Париж…), с ${T.wagons} вагона наведнъж.` : `Поема превози до ${T.wagons} вагона — по-големите превози плащат повече.`)} Поддръжка ${fmt(T.upkeep)} €/ден.</div>
    <div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn" data-buytrain="${k}" ${can && (econ.canAfford(T.cost) || T.cost >= 1000000) ? '' : 'disabled'}>Купи</button></div></div>`).join('')
    + (can ? '' : `<div class="meta late">Нямаш свободен коловоз — надгради гара (влакове ${(S.trains || []).length}/${totalTracks()}).</div>`);
}
function openTrainShop() {
  modal(`${trainImg('mid', 22)} Купи влак`, `Влакове на фирмата: ${(S.trains || []).length}/${totalTracks()} коловоза.<br><br>${trainShopHtml()}`, [['Затвори', null]]);
  document.querySelectorAll('#modalBox [data-buytrain]').forEach(b => b.onclick = () => { $('modal').classList.add('hidden'); buyTrain(b.dataset.buytrain); });
}
function buyTrain(kind = 'small') {
  const T = TRAIN_TYPES[kind] || TRAIN_TYPES.small;
  if (!totalTracks()) { toast('🚉 Първо построй гара в града — таб „Офис“ → Гара.', 'bad'); return; }
  if ((S.trains || []).length >= totalTracks()) { toast(`🚉 Гарите ти имат общо ${totalTracks()} ${totalTracks() === 1 ? 'коловоз' : 'коловоза'} — надгради гара (таб „Офис“), за да купиш още влак.`, 'bad'); return; }
  if (!econ.canAfford(T.cost)) { if (T.cost >= 1000000) withLoan(T.cost, `Влак: ${T.nm}`, () => buyTrain(kind)); else toast('Нямаш достатъчно пари за влак.', 'bad'); return; }   // скъпите (Стрела, гигант) — и на кредит
  econ.spend(T.cost, 'покупка', `Влак: ${T.nm}`);
  S.trains = S.trains || [];
  const n = S.trains.length + 1;
  S.trains.push({ id: S.seq++, nm: `${T.ico} №${n} ${T.nm.toLowerCase()}`, kind, wagons: T.wagons, at: S.cityId, job: null, path: null, km: 0, total: 0, leg: 'idle' });
  toast(`${T.ico} Купи ${T.nm.toLowerCase()} влак с ${T.wagons} вагона!`, 'good');
  Sound.play('horn');
  parkedSig = ''; updateParked();
  if (n === 1) showEventPop('first-train', '🚆 Първият влак на фирмата!', 'Превозвай товари и купувай материали на заводска цена.');
  else showEventPop('new-train', '🚆 Имате нов влак!', `Влаковете на фирмата вече са ${n}.`);
  save(); showMap(!$('mapScreen').classList.contains('hidden'));
}
function makeJob() {
  const net = network();
  if (net.length < 2) return;
  const a = pick(net); let b = pick(net.filter(x => x !== a));
  const p = railPath(a, b); if (!p) return;
  const km = pathKm(p), [cg, ico] = pick(CARGO);
  const wg = 4 + ((Math.random() * 9) | 0);
  S.jobs.push({ id: S.seq++, from: a, to: b, cargo: cg, ico, wagons: wg, km, reward: Math.round((km * wg * rand(15, 21) + 4000) / 100) * 100, expires: S.day + 3 });
}
function takeJob(jid) {
  const j = S.jobs.find(q => q.id === jid); if (!j) return;
  const t = (S.trains || []).filter(q => !q.job && !q.route && !trainType(q).pax && trainWagons(q) >= (j.wagons || 0)).map(q => ({ q, p: railPath(q.at, j.from) })).filter(o => o.p).sort((x, y) => pathKm(x.p) - pathKm(y.p))[0];
  if (!t) { toast(`Няма свободен товарен влак с поне ${j.wagons} вагона, който да стигне до началната гара.`, 'bad'); return; }
  S.jobs.splice(S.jobs.indexOf(j), 1);
  t.q.job = j;
  startLeg(t.q, t.p, 'empty');
  toast(`🚆 ${t.q.nm} тръгва: ${j.ico} ${j.cargo} ${cityById(j.from).nm} → ${cityById(j.to).nm}.`, 'good');
  save(); drawMap(); renderMapHud();
}
// избор на маршрут за влак: два града от жп мрежата му и вид (пътнически/товарен)
function openRoute(id) {
  const t = S.trains.find(q => q.id === id); if (!t) return;
  const net = (() => { const out = new Set([t.at]), q = [t.at]; while (q.length) for (const n of railNeighbors(q.shift())) if (!out.has(n)) { out.add(n); q.push(n); } return [...out]; })();
  if (net.length < 2) { toast('Този влак няма свързани градове — построй жп линия.', 'bad'); return; }
  const opts = sel => net.map(c => `<option value="${c}" ${c === sel ? 'selected' : ''}>${cityById(c).nm}</option>`).join('');
  const r = t.route || { a: t.at, b: net.find(c => c !== t.at), kind: trainType(t).pax ? 'pax' : 'freight' };
  modal(`🧭 Маршрут · ${t.nm}`, `Влакът ще кара сам напред-назад между двата града.<br>🎫 <b>Пътническа линия</b> — билети при всяко пристигане (повече при повече вагони и по-дълъг път).<br>📦 <b>Товарна совалка</b> — сигурен доход без чакане на поръчки (по-малко от поръчката, но постоянно).<br><br>
    <label>От: <select id="rtA">${opts(r.a)}</select></label> &nbsp; <label>До: <select id="rtB">${opts(r.b)}</select></label><br><br>
    <label><input type="radio" name="rtK" value="pax" ${r.kind === 'pax' ? 'checked' : ''}> 🎫 Пътническа</label> &nbsp; <label><input type="radio" name="rtK" value="freight" ${r.kind !== 'pax' ? 'checked' : ''}> 📦 Товарна</label>`,
    [['Махни маршрута', () => { delete t.route; save(); renderMapHud(); }], ['Отказ', null], ['Запази', () => {
      const a = document.getElementById('rtA').value, b = document.getElementById('rtB').value, kind = document.querySelector('input[name="rtK"]:checked').value;
      if (a === b) { toast('Избери два различни града.', 'bad'); return; }
      t.route = { a, b, kind };
      toast(`🧭 ${t.nm}: ${kind === 'pax' ? 'пътническа линия' : 'товарна совалка'} ${cityById(a).nm} ⇄ ${cityById(b).nm}`, 'good');
      save(); renderMapHud();
    }]]);
}
// случаен курс за свободен влак: товарният първо гледа чакащите превози, иначе кара товари/пътници до случаен свързан град
function autoTrip(t) {
  const net = (() => { const out = new Set([t.at]), q = [t.at]; while (q.length) for (const n of railNeighbors(q.shift())) if (!out.has(n)) { out.add(n); q.push(n); } return [...out]; })();
  if (net.length < 2) return;
  const pax = !!trainType(t).pax;
  if (!pax && !trainType(t).long) {
    const fit = (S.jobs || []).filter(j => trainWagons(t) >= j.wagons && net.includes(j.from) && net.includes(j.to));
    if (fit.length) { const j = pick(fit); S.jobs.splice(S.jobs.indexOf(j), 1); t.job = j; startLeg(t, railPath(t.at, j.from), 'empty'); return; }
  }
  const T = trainType(t);
  let cand = net.filter(c => c !== t.at);
  if (T.express && !hsNeighbors(t.at).length) return;   // „Стрела“ чака модернизирана линия
  if (T.express) cand = cand.filter(c => hsPath(t.at, c));
  if (T.express || T.long) {   // експресът и товарният гигант карат само директни дълги линии; ако няма такава — до най-далечния град
    const far = cand.map(c => ({ c, p: T.express ? hsPath(t.at, c) : railPath(t.at, c) })).filter(o => o.p).map(o => ({ ...o, km: pathKm(o.p) }));
    const longOnes = far.filter(o => o.km >= T.minKm);
    cand = longOnes.length ? longOnes.map(o => o.c) : far.sort((x, y) => y.km - x.km).slice(0, 1).map(o => o.c);
    if (!cand.length) return;
  }
  const dest = pick(cand), path = T.express ? hsPath(t.at, dest) : railPath(t.at, dest); if (!path) return;
  const pay = Math.round(pathKm(path) * trainWagons(t) * (T.express ? rand(8, 10) : pax ? rand(5, 7) : rand(8, 11)) / 10) * 10;
  t.job = { pax, shuttle: !pax, from: t.at, to: dest, ico: T.express ? '🚄' : T.long ? '🚛' : pax ? '🎫' : '📦', cargo: T.express ? 'експрес' : T.long ? '50 вагона товари' : pax ? 'пътници' : 'товари', pay };
  startLeg(t, path, 'loaded');
}
function startLeg(t, path, leg) { t.path = path; t.km = 0; t.total = pathKm(path); t.leg = leg; }
function updateTrains(dtDays) {
  for (const t of S.trains || []) {
    if (t.route) delete t.route;   // ръчните маршрути отпаднаха — всички курсове са случайни
    if (!t.job) autoTrip(t);
    if (!t.job) continue;
    t.km += trainType(t).speed * dtDays;
    if (t.km < t.total) continue;
    const fuel = Math.round(t.total * TRAIN_EUR_KM); econ.spend(fuel, 'гориво', `${t.nm}: ${Math.round(t.total)} км`);
    t.at = t.path[t.path.length - 1];
    if (t.leg === 'empty') { startLeg(t, railPath(t.at, t.job.to), 'loaded'); continue; }
    const j = t.job;
    if (j.empty) { t.job = null; t.path = null; t.leg = 'idle'; continue; }   // пристигна в началото на маршрута
    if (j.shuttle) {   // товарна совалка по маршрут: по-малко от поръчка, но без чакане
      const pay = j.pay ?? Math.round(t.total * trainWagons(t) * rand(8, 11) / 10) * 10;
      econ.earn(pay, 'обект', `Совалка: ${cityById(j.from).nm} → ${cityById(j.to).nm}`); flowAdd('rail', pay - fuel, `${cityById(j.from).nm} → ${cityById(j.to).nm}`);
      t.job = null; t.path = null; t.leg = 'idle'; save();
      continue;
    }
    if (j.pax) {   // билетите зависят от разстоянието и вагоните
      const pay = j.pay ?? Math.round(t.total * trainWagons(t) * rand(5, 7) / 10) * 10;
      econ.earn(pay, 'обект', `Билети: ${cityById(j.from).nm} → ${cityById(j.to).nm}`); flowAdd('rail', pay - fuel, `${cityById(j.from).nm} → ${cityById(j.to).nm}`);
      if (!$('mapScreen').classList.contains('hidden')) toast(`🎫 ${t.nm} пристигна в ${cityById(j.to).nm}: +${fmt(pay)} € от билети`, 'good');
      t.job = null; t.path = null; t.leg = 'idle'; save();
      continue;
    }
    econ.earn(j.reward, 'обект', `Превоз: ${j.cargo} ${cityById(j.from).nm} → ${cityById(j.to).nm}`); flowAdd('rail', j.reward - fuel, `${cityById(j.from).nm} → ${cityById(j.to).nm}`);
    toast(`🚆 ${t.nm} достави ${j.cargo} в ${cityById(j.to).nm}: +${fmt(j.reward)} €`, 'good');
    quests.emit('delivery');
    SFXcash();
    t.job = null; t.path = null; t.leg = 'idle';
    save();
  }
}
// ============================================================ Фаза WORLD: летища (ниво 9) и авиолинии до света (ниво 10) — airways.js
// ---- континентите (africa.js, namerica.js): отделна карта, филиали по суша, свои магистрали
const CONTS = [
  { key: 'af', nm: 'Африка', ico: '🌍', ids: AFRICA_IDS, countries: AFRICA_COUNTRIES, base: [-3700, -150, 6300, 8400], pic: 'unlock-africa',
    txt: 'Нов континент: 11 държави, трансафрикански магистрали и жп линии. Филиал отваряш с авиолиния или по суша от твой африкански град.',
    open: () => dev.has('WORLD'), locked: () => false, lockTxt: () => lockTxt(10) },
  { key: 'na', nm: 'Северна Америка', ico: '🗽', ids: NA_IDS, countries: NA_COUNTRIES, base: [-11500, -2400, 6000, 6600], pic: 'unlock-namerica',
    txt: 'Нов континент: Interstate магистрали, Трансканадската, Панамериканската до Панама и Карибите. Филиал отваряш с авиолиния или по суша от твой американски град.',
    open: () => !!S && dev.has('WORLD') && naOpen(ownedCities(), x => econ.isFinished(x)), locked: () => true, lockTxt: () => naLockTxt(ownedCities()) },
  { key: 'sa', nm: 'Южна Америка', ico: '🌎', ids: SA_IDS, countries: SA_COUNTRIES, base: [-8700, 2200, 4700, 8000], pic: 'unlock-samerica',
    txt: 'Нов континент: Андите, Амазония и Огнена земя — Панамериканската до Сантяго, Трансандийската до Буенос Айрес. Филиал отваряш с авиолиния или по суша от твой южноамерикански град.',
    open: () => !!S && dev.has('WORLD') && saOpen(ownedCities(), x => econ.isFinished(x)), locked: () => true, lockTxt: () => saLockTxt(ownedCities()) },
  { key: 'as', nm: 'Азия', ico: '🌏', ids: AS_IDS, countries: AS_COUNTRIES, base: [300, -1600, 8800, 7100], pic: 'unlock-asia', land: true,
    txt: 'Нов континент: Пътят на коприната от Истанбул до Пекин, плажовете на Тайланд, мегаполисите на Китай и островите на Индонезия. Азия е свързана с Европа по суша.',
    open: () => !!S && dev.has('WORLD') && asOpen(ownedCities(), x => econ.isFinished(x)), locked: () => true, lockTxt: () => asLockTxt(ownedCities()) },
  { key: 'oc', nm: 'Австралия', ico: '🦘', ids: OC_IDS, countries: [{ cc: '🇦🇺', nm: 'Австралия', cities: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'] }, ...OC_COUNTRIES], base: [5700, 4500, 6300, 4900], pic: 'unlock-oceania',
    txt: 'Последният континент: Магистрала 1 около Австралия, пустинята до Дарвин, Нова Зеландия и островите в Тихия океан.',
    open: () => !!S && dev.has('WORLD') && ocOpen(ownedCities(), x => econ.isFinished(x)), locked: () => true, lockTxt: () => ocLockTxt(ownedCities()) },
];
const contOf = id => CONTS.find(k => k.ids.has(id)) || null;
// напредък към следващия континент (един по един): 3 филиала в предишния или завладяна държава там
const CONT_NEED = 3;
function contProgress(i) {
  const k = CONTS[i];
  if (k.open()) return { open: true };
  if (i === 0) return { open: false, txt: `ниво ${dev.best()} / 10 на развитие` };
  const prev = CONTS[i - 1];
  if (!prev.open()) return { open: false, txt: `след ${prev.ico} ${prev.nm}`, later: true };
  const n = ownedCities().filter(id => prev.ids.has(id)).length;
  return { open: false, txt: `${Math.min(n, CONT_NEED)} / ${CONT_NEED} филиала в ${prev.nm} или 1 завладяна държава там`, n };
}
function contHudHtml() {
  if (!S || dev.best() < 8) return '';
  const rows = CONTS.map((k, i) => {
    const p = contProgress(i);
    if (p.open) return `<div class="row" style="margin:2px 0"><span class="meta" style="margin:0">✅ ${k.ico} <b style="color:var(--txt)">${k.nm}</b></span><button class="btn2" style="padding:3px 8px;font-size:12px" data-contshow="${k.key}">🗺️ Карта</button></div>`;
    return `<div class="meta" style="margin:3px 0;${p.later ? 'opacity:.55' : ''}">🔒 ${k.ico} <b style="color:var(--txt)">${k.nm}</b> — ${p.txt}</div>${p.n != null ? `<div class="bar" style="margin:2px 0 4px"><i style="width:${Math.min(100, p.n / CONT_NEED * 100).toFixed(0)}%"></i></div>` : ''}`;
  }).join('');
  return `<div class="sect">🌐 Континенти — отключват се един по един</div><div class="card" style="padding:7px 10px">${rows}</div>`;
}
// всеки ден: новоотключен континент → съобщение и картинка
function contTick() {
  if (!S) return;
  S.contOpen = S.contOpen || {};
  for (const k of CONTS) if (k.open() && !S.contOpen[k.key]) {
    S.contOpen[k.key] = true;
    if (S.day > 1) { toast(`🔓 Отключи нов континент: ${k.ico} ${k.nm}! Виж го на картата.`, 'good'); Sound.play('levelup'); contFirstLook(k); }
  }
}
const contByKey = key => CONTS.find(k => k.key === key);
// изгледи на картата: всеки континент отделно; Северна и Южна Америка — заедно в „Америка“
const AM_VIEW = { key: 'am', nm: 'Америка', ico: '🌎', base: [-11300, -2200, 7500, 12100], k: 3.4, ls: 0.6,
  get ids() { return new Set([...contByKey('na').ids, ...contByKey('sa').ids]); }, get countries() { return [...contByKey('na').countries, ...contByKey('sa').countries]; } };
const viewOf = key => key === 'na' || key === 'sa' || key === 'am' ? AM_VIEW : contByKey(key) || null;
const MAP_VIEWS = [
  { key: 'bg', ico: '🇧🇬', nm: 'България', open: () => true },
  { key: 'balkans', ico: '🌍', nm: 'Балкани', open: () => dev.has('BALKANS'), lock: 'ниво 5' },
  { key: 'eu', ico: '🇪🇺', nm: 'Европа', open: () => dev.has('EUROPE'), lock: 'ниво 8' },
  { key: 'af', ico: '🌍', nm: 'Африка', open: () => contByKey('af').open(), lock: 'ниво 10' },
  { key: 'am', ico: '🌎', nm: 'Америка', open: () => contByKey('na').open() || contByKey('sa').open(), lock: 'след Африка' },
  { key: 'as', ico: '🌏', nm: 'Азия', open: () => contByKey('as').open(), lock: 'след Америка' },
  { key: 'oc', ico: '🦘', nm: 'Австралия', open: () => contByKey('oc').open(), lock: 'след Азия' },
  { key: 'world', ico: '🌐', nm: 'Светът', open: () => dev.has('AIR'), lock: 'ниво 9' },
];
const curView = () => mapCont ? viewOf(mapCont).key : mapWorld ? 'world' : mapEU ? 'eu' : mapWide ? 'balkans' : 'bg';
function setMapView(key) {
  const v = MAP_VIEWS.find(x => x.key === key); if (!v) return;
  if (!v.open()) { toast(`🔒 ${v.ico} ${v.nm} — ${v.lock}.`, 'bad'); return; }
  mapWide = key !== 'bg'; mapEU = !['bg', 'balkans'].includes(key); mapWorld = !['bg', 'balkans', 'eu'].includes(key);
  mapCont = ['af', 'am', 'as', 'oc'].includes(key) ? key : null; mapPicked = true;
  if (key === 'am') { for (const k of ['na', 'sa']) if (contByKey(k).open()) contFirstLook(contByKey(k)); } else if (mapCont) contFirstLook(contByKey(mapCont));
  mapView = null; showMap(true);
}
const viewBarHtml = () => `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${MAP_VIEWS.map(v => { const on = v.open(), cur = curView() === v.key; return `<button class="${cur ? 'btn' : 'btn2'}" style="padding:4px 8px;font-size:12px;${on ? '' : 'opacity:.45'}" data-mview="${v.key}" title="${on ? v.nm : '🔒 ' + v.lock}">${on ? v.ico : '🔒'} ${v.nm}</button>`; }).join('')}</div>`;
const CONT_HW_NM = { oc: 'Магистрали в Австралия и Нова Зеландия', af: 'Трансафрикански магистрали', sa: 'Магистрали в Южна Америка', as: 'Магистрали в Азия', na: 'Магистрали в Северна Америка' };
const nextCont = () => { const open = CONTS.filter(k => k.open()), i = open.findIndex(k => k.key === mapCont); return open[i + 1] || null; };
// суша: жп път или готов аутобан до град на същия континент, който е твой
function contLandLinked(id) {
  const k = contOf(id); if (!k || !k.open()) return false;
  const mine = ownedCities().filter(x => k.ids.has(x)); if (!mine.length) return false;
  if (mine.some(o => { const p = railPath(o, id); return p && p.length > 1; })) return true;
  const done = ALL_AB.filter(x => hwDone().includes(x.id)), seen = new Set(mine), q = [...mine];
  while (q.length) { const c = q.shift(); if (c === id) return true; for (const x of done) { const n = x.a === c ? x.b : x.b === c ? x.a : null; if (n && !seen.has(n)) { seen.add(n); q.push(n); } } }
  return false;
}
const afLandLinked = contLandLinked;
function contLabels(key) {
  return viewOf(key).countries.map(k => { const [lo, la] = countryLabelLL(k, cityById), [x, y] = proj(lo, la); return `<text x="${x}" y="${y - 90}" font-size="${(120 * mapLS()).toFixed(0)}" text-anchor="middle" fill="#5d4a2a" opacity=".55" font-weight="800" style="pointer-events:none;letter-spacing:4px">${k.nm.toUpperCase()}</text>`; }).join('');
}
function contFirstLook(k) {
  if (!S || (S.contSeen || {})[k.key] || (k.key === 'af' && S.afSeen)) return; S.contSeen = { ...(S.contSeen || {}), [k.key]: true }; save();
  if (!showEventPop(k.pic, `${k.ico} ${k.nm}!`, k.txt)) showEventPop('unlock-europe', `${k.ico} ${k.nm}!`, k.txt);
}
const WORLD_ANCHORS = ['sofia', 'london', 'paris', 'berlin', 'rome', 'madrid', 'istanbul', 'athens'];
const mapNextLbl = () => mapWorld ? (nextCont() ? `${nextCont().ico} ${nextCont().nm}` : '🇧🇬 България') : mapEU ? (dev.has('AIR') ? '🌐 Светът' : '🇧🇬 България') : mapWide ? (dev.has('EUROPE') ? '🇪🇺 Европа' : '🇧🇬 България') : dev.has('BALKANS') ? '🌍 Балканите' : '🔒 Балканите (ниво 5)';
const AIR_CAT = ECON.CATS && ECON.CATS['полети'] ? 'полети' : 'обект';
const airportOf = id => (S && S.airports || {})[id] || null;
const airLv = id => airportOf(id)?.lv || 0;
const airGates = () => Object.values(S.airports || {}).reduce((a, p) => a + (p.lv ? AIRPORT_LEVELS[p.lv - 1].gates : 0), 0);
const routeKm = (a, b) => airKm(cityById(a), cityById(b));
const hasRoute = (a, b) => (S.airRoutes || []).some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const airLinked = id => (S.airRoutes || []).some(r => r.a === id || r.b === id);
const maxRoutes = () => airGates() * 2;
const airLockTxt = () => `🔒 Летищата се отключват на <b>ниво 9 на развитие</b> (сега ${dev.best()}), а градовете по света — на ниво 10.`;
function buildAirport(id) {
  if (!dev.has('AIR')) { toast('🔒 Летищата се отключват на ниво 9 на развитие.', 'bad'); return; }
  const ap = airportOf(id), lv = ap?.lv || 0, mx = airportMax(id);
  if (!mx) { toast(`✈️ ${cityById(id).nm} няма пътническо летище — ползвай жп и магистрали.`, 'bad'); return; }
  if (ap?.muni) { toast(`🏛️ Летището в ${cityById(id).nm} е общинско — първо изкупи общинския дял (таб „Офис“ → Транспортни връзки).`, 'bad'); return; }
  if (lv >= mx) { toast(`Максимумът за ${cityById(id).nm} е ниво ${mx}.`, 'bad'); return; }
  if (ap?.build || lv >= AIRPORT_LEVELS.length) return;
  const L = AIRPORT_LEVELS[lv];
  if (!econ.canAfford(L.cost)) { withLoan(L.cost, `${L.nm} в ${cityById(id).nm}`, () => buildAirport(id)); return; }
  econ.spend(L.cost, 'покупка', `${L.nm} в ${cityById(id).nm}`);
  S.airports = { ...(S.airports || {}), [id]: { lv, build: { target: lv + 1, prog: 0 } } };
  toast(`🛫 Започна строежът: ${L.nm} в ${cityById(id).nm} (${L.days} дни).`, 'good'); Sound.play('buy'); save();
}
function openAirRoute(a, b) {
  if (!airLv(a)) { toast('Линията тръгва от твое готово летище.', 'bad'); return; }
  if (!b || a === b || hasRoute(a, b)) { toast('Тази авиолиния вече съществува.', 'bad'); return; }
  if (dev.best() < cityLv(b)) { toast(`🔒 ${cityById(b).nm} се отключва на ниво ${cityLv(b)} на развитие.`, 'bad'); return; }
  if (!airportMax(b)) { toast(`✈️ ${cityById(b).nm} няма пътническо летище — ползвай жп и магистрали.`, 'bad'); return; }
  if ((S.airRoutes || []).length >= maxRoutes()) { toast(`Летищата ти поемат до ${maxRoutes()} авиолинии — надгради ги за още гейтове.`, 'bad'); return; }
  const km = routeKm(a, b), cost = ROUTE_COST(km);
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за правата на линията.', 'bad'); return; }
  econ.spend(cost, 'покупка', `Авиолиния ${cityById(a).nm} — ${cityById(b).nm}`);
  S.airRoutes = [...(S.airRoutes || []), { a, b, km }];
  toast(`✈️ Нова авиолиния ${cityById(a).nm} — ${cityById(b).nm} (${fmt(km)} км).${isWorld(b) ? ` Вече можеш да отвориш филиал в ${cityById(b).nm}.` : ''}`, 'good');
  Sound.play('buy'); save(); if (!$('mapScreen').classList.contains('hidden')) drawMap();
}
function buyPlane(kind) {
  if (!dev.has('AIR')) { toast('🔒 Самолетите идват с летищата (ниво 9).', 'bad'); return; }
  const home = Object.keys(S.airports || {}).find(id => airLv(id) > 0);
  if (!home) { toast('Първо построй летище.', 'bad'); return; }
  if ((S.planes || []).length >= airGates()) { toast('Няма свободен гейт — надгради летището.', 'bad'); return; }
  const P = PLANES[kind];
  if (!econ.canAfford(P.cost)) { withLoan(P.cost, `Самолет: ${P.nm}`, () => buyPlane(kind)); return; }
  econ.spend(P.cost, 'покупка', `Самолет: ${P.nm}`);
  S.planeSeq = (S.planeSeq || 0) + 1;
  S.planes = [...(S.planes || []), { id: S.planeSeq, kind, nm: `${P.ico} №${S.planeSeq}`, at: home, path: null, km: 0, total: 0 }];
  toast(`${P.ico} Купи ${P.nm}. Лети сам по авиолиниите ти.`, 'good'); Sound.play('buy'); save();
}
// случаен полет по линия от летището, където е самолетът (в обсега му); иначе прелита празен до свое летище с линии
function planeTrip(p) {
  const P = PLANES[p.kind];
  const opts = (S.airRoutes || []).filter(r => (r.a === p.at || r.b === p.at) && r.km <= P.range);
  if (opts.length) { const r = pick(opts), to = r.a === p.at ? r.b : r.a; p.path = [p.at, to]; p.km = 0; p.total = r.km; p.ferry = false; p.pay = flightPay(p.kind, r.km); return; }
  const home = Object.keys(S.airports || {}).filter(id => airLv(id) && id !== p.at && (S.airRoutes || []).some(r => (r.a === id || r.b === id) && r.km <= P.range))
    .sort((x, y) => routeKm(p.at, x) - routeKm(p.at, y))[0];
  if (home && routeKm(p.at, home) <= P.range) { const km = routeKm(p.at, home); p.path = [p.at, home]; p.km = 0; p.total = km; p.ferry = true; p.pay = flightPay(p.kind, km); }
}
function updateAir(dtDays) {
  if (!S) return;
  for (const [id, ap] of Object.entries(S.airports || {})) if (ap.build) {
    const L = AIRPORT_LEVELS[ap.build.target - 1];
    ap.build.prog += dtDays / L.days;
    if (ap.build.prog >= 1) {
      ap.lv = ap.build.target; ap.build = null;
      quests.emit('airport'); dev.add(dev.XP.branch);
      if (id === S.cityId) refreshAirport3D(id);
      showEventPop('airport-done', `🛫 ${L.nm} в ${cityById(id).nm}`, `${L.gates} гейта · отвори авиолинии и купи самолети от „✈️ Летища“.`);
      toast(`🛫 ${L.nm} в ${cityById(id).nm} е готово!`, 'good'); save();
    }
  }
  for (const p of S.planes || []) {
    if (!p.path) { planeTrip(p); if (!p.path) continue; }
    p.km += PLANES[p.kind].speed * dtDays;
    if (p.km < p.total) continue;
    const [from, to] = p.path, f = p.pay || flightPay(p.kind, p.total);
    p.at = to; p.path = null;
    if (p.ferry) econ.spend(f.fuel, 'гориво', `${p.nm}: прелитане ${cityById(from).nm} → ${cityById(to).nm}`);
    else {
      const net = Math.round((f.gross - f.fuel) * (isMuni('air', from) || isMuni('air', to) ? 1 - MUNI_SHARE : 1));
      econ.earn(net, AIR_CAT, `${p.nm}: полет ${cityById(from).nm} → ${cityById(to).nm}`);
      S.airEarned = (S.airEarned || 0) + net; quests.emit('flight'); flowAdd('air', net, `${cityById(from).nm} → ${cityById(to).nm}`);
      if (net >= 250000) toast(`✈️ ${p.nm} кацна в ${cityById(to).nm}: +${fmt(net)} €`, 'good');
    }
  }
}
// автоматични линии (морски и авиолинии): всеки ден, ако има свободно място и пари, отваря най-полезната линия.
// Приоритет: твои градове (отстъпки за материали) → градове със заводи → нови световни градове (за филиали) → най-евтината.
// Ограничения: в обсега на най-далекобойния ти кораб/самолет; правата струват най-много 15% от парите в сметката.
const autoOn = k => !S || !S.autoLines || S.autoLines[k] !== false;   // по подразбиране включено
function autoLines() {
  if (!S || !econ) return;
  const own = new Set(ownedCities()), fac = new Set((ECON.FACTORIES || []).map(f => f.cityId)), budget = Math.max(0, econ.s.money) * 0.15;
  const pickBest = (froms, dests, km, cost, range, has, extra = () => 0) => {
    let best = null;
    for (const a of froms) for (const b of dests) {
      if (a === b || has(a, b)) continue;
      const d = km(a, b); if (d > range) continue;
      const c = cost(d); if (c > budget) continue;
      const sc = (own.has(b) ? 300 : 0) + (fac.has(b) ? 120 : 0) + extra(b) - c / 100000;
      if (!best || sc > best.sc) best = { a, b, sc };
    }
    return best;
  };
  if (autoOn('sea') && seaOn() && (S.seaRoutes || []).length < maxSeaRoutes()) {
    const froms = Object.keys(S.ports || {}).filter(id => portLv(id)), dests = CITIES.filter(c => portMax(c.id) && dev.best() >= cityLv(c.id)).map(c => c.id);
    const range = Math.max(5000, ...(S.ships || []).map(p => shipRange(p.kind) === Infinity ? 30000 : shipRange(p.kind)));
    const b = pickBest(froms, dests, seaRouteKm, SEA_ROUTE_COST, range, hasSeaRoute);
    if (b) { openSeaRoute(b.a, b.b); toast(`🔄 Автоматично: нова морска линия ${cityById(b.a).nm} — ${cityById(b.b).nm}.`, 'good', () => openBig('sea')); }
  }
  if (autoOn('air') && dev.has('AIR') && (S.airRoutes || []).length < maxRoutes()) {
    const froms = Object.keys(S.airports || {}).filter(id => airLv(id)), dests = CITIES.filter(c => airportMax(c.id) && dev.best() >= cityLv(c.id)).map(c => c.id);
    const range = Math.max(1500, ...(S.planes || []).map(p => PLANES[p.kind].range));
    const b = pickBest(froms, dests, routeKm, ROUTE_COST, range, hasRoute, id => isWorld(id) && !airLinked(id) ? 200 : 0);
    if (b) { openAirRoute(b.a, b.b); toast(`🔄 Автоматично: нова авиолиния ${cityById(b.a).nm} — ${cityById(b.b).nm}.`, 'good', () => openBig('air')); }
  }
}
const autoToggle = k => `<label class="meta" style="display:flex;gap:8px;align-items:center;cursor:pointer;margin:4px 0"><input type="checkbox" data-autoline="${k}" ${autoOn(k) ? 'checked' : ''}> 🔄 Автоматични линии — отваря сама най-полезната линия, щом има свободно място (до 15% от парите в сметката)</label>`;
// отчети за полетите и корабите: днешен приход (S.flow[k].d), история по дни (h, последните 7), седмичен отчет
const FLOW = { air: { ico: '✈️', nm: 'Полети', unit: ['полет', 'полета'], pic: 'airport-done' }, sea: { ico: '🚢', nm: 'Морски рейсове', unit: ['рейс', 'рейса'], pic: 'sea-week' }, rail: { ico: '🚆', nm: 'Влакове', unit: ['курс', 'курса'], pic: 'rail-week' } };
function flowAdd(k, net, route) { S.flow = S.flow || {}; const f = S.flow[k] = S.flow[k] || { d: 0, n: 0, h: [], w: 0, wn: 0, best: null }; f.d += net; f.n++; if (!f.best || net > f.best.net) f.best = { net, route }; }
function flowDay(k, upkeep) {
  const f = S.flow && S.flow[k]; if (!f || (!f.n && !upkeep)) return;
  const F = FLOW[k], netDay = f.d - upkeep;
  if (f.n) toast(`${F.ico} ${F.nm} днес: ${f.n} ${f.n === 1 ? F.unit[0] : F.unit[1]} · +${fmt(f.d)} €${upkeep ? ` · поддръжка −${fmt(upkeep)} € → ${netDay >= 0 ? '+' : '−'}${fmt(Math.abs(netDay))} €` : ''}`, netDay >= 0 ? 'good' : 'bad', () => openBig(k));
  f.h.push(netDay); if (f.h.length > 7) f.h.shift(); f.w += netDay; f.wn += f.n;
  if (S.day % 7 === 0 && f.wn) {
    showEventPop(F.pic, `${F.ico} ${F.nm} — седмицата`, `${f.wn} ${F.unit[1]} · печалба ${f.w >= 0 ? '+' : '−'}${fmt(Math.abs(f.w))} €${f.best ? ` · най-добър: ${f.best.route} +${fmt(f.best.net)} €` : ''}`);
    SFXcash(); f.w = 0; f.wn = 0; f.best = null;
  }
  f.d = 0; f.n = 0;
}
const flowAvg = k => { const h = S && S.flow && S.flow[k] && S.flow[k].h; return h && h.length ? Math.round(h.reduce((a, v) => a + v, 0) / h.length) : 0; };
// 3D летището в града (airport.js): източно от решетката; строи се/надгражда се, когато летището е готово
function refreshAirport3D(id = S?.cityId) {
  if (!city.group || !id) return;
  const lv = airLv(id);
  if (!lv) { if (city.airport) { city.airport.dispose(); city.airport = null; } return; }
  if (city.airport) { if (city.airport.level !== lv) city.airport.setLevel(lv); return; }
  try { city.airport = makeAirport3D(city.group, { A, model, label }, { lv, x: tx(NI - 1) + 70, z: 0, seed: hashStr('air:' + id) }); city.airportNI = NI; } catch (e) { console.warn('airport', e); city.airport = null; }
}
// ---- транспортни връзки на града (linkoffers.js): твое (земя + строеж) или общинско (такса, само ползване)
const isMuni = (k, id) => !!((k === 'air' ? S.airports : S.ports) || {})[id]?.muni;
const regionOf = id => isWorld(id) ? 'world' : isEurope(id) ? 'europe' : isForeign(id) ? 'balkan' : 'bg';
const linkP = id => linkPrices(cityById(id), regionOf(id), PORT_LEVELS[0].cost, AIRPORT_LEVELS[0].cost);
const onAbCorridor = id => AUTOBAHNS.some(c => c.cities.includes(id));
function linkNeeds(id) {
  const road = !(roadHubs().has(id) || (S.roadAccess || {})[id]);
  const port = portMax(id) > 0 && !portLv(id) && !portOf(id)?.build, air = airportMax(id) > 0 && !airLv(id) && !airportOf(id)?.build;
  return { road, port, air, any: road || port || air };
}
function linkAct(act, id = S.cityId) {
  const P = linkP(id), nm = cityById(id).nm, pay = (n, note) => { if (!econ.canAfford(n)) { toast('Нямаш достатъчно пари.', 'bad'); Sound.play('error'); return false; } econ.spend(n, 'покупка', note); return true; };
  if (act === 'road-own') { if (onAnySeg(id)) roadOwn(id); else offerSpur(id); return; }
  if (act === 'road-muni') { const ab = onAbCorridor(id), c = ab ? P.abMuni : P.roadMuni; if (!pay(c, `Включване в ${ab ? 'аутобан' : 'магистрала'}: ${nm}`)) return; S.roadAccess = { ...(S.roadAccess || {}), [id]: ab ? 'ab' : 'road' }; toast(`🛣️ ${nm} е включен в ${ab ? 'аутобана' : 'пътната мрежа'} — материалите идват с −${ab ? 30 : 25}%.`, 'good'); }
  if (act === 'port-own') { if (!seaOn()) { toast(seaLockTxt().replace(/<[^>]+>/g, ''), 'bad'); return; } if (!econ.canAfford(P.portOwn)) { withLoan(P.portOwn, `Пристанище в ${nm}`, () => linkAct('port-own', id)); return; } econ.spend(P.portLand, 'покупка', `Терен за пристанище: ${nm}`); buildPort(id); }
  if (act === 'port-muni') { if (!seaOn()) { toast(seaLockTxt().replace(/<[^>]+>/g, ''), 'bad'); return; } if (!pay(P.portMuni, `Участие в общинско пристанище: ${nm}`)) return; S.ports = { ...(S.ports || {}), [id]: { lv: 1, build: null, muni: true } }; if (id === S.cityId) city.sea?.setPortLevel?.(1); toast(`🏛️⚓ Включи се в общинското пристанище на ${nm}: можеш да отваряш морски линии оттук (общината взима ${MUNI_SHARE * 100}% от рейсовете).`, 'good'); }
  if (act === 'port-buy') { const c = buyoutPrice(P.portLand, PORT_LEVELS[0].cost); if (!pay(c, `Изкупуване на пристанището: ${nm}`)) return; delete S.ports[id].muni; toast(`⚓ Пристанището в ${nm} вече е изцяло твое — можеш да го надграждаш.`, 'good'); }
  if (act === 'air-own') { if (!dev.has('AIR')) { toast('🔒 Летищата се отключват на ниво 9 на развитие.', 'bad'); return; } if (!econ.canAfford(P.airOwn)) { withLoan(P.airOwn, `Летище в ${nm}`, () => linkAct('air-own', id)); return; } econ.spend(P.airLand, 'покупка', `Терен за летище: ${nm}`); buildAirport(id); }
  if (act === 'air-muni') { if (!dev.has('AIR')) { toast('🔒 Летищата се отключват на ниво 9 на развитие.', 'bad'); return; } if (!pay(P.airMuni, `Участие в общинско летище: ${nm}`)) return; S.airports = { ...(S.airports || {}), [id]: { lv: 1, build: null, muni: true } }; if (id === S.cityId) refreshAirport3D(id); toast(`🏛️✈️ Включи се в общинското летище на ${nm}: можеш да отваряш авиолинии оттук (общината взима ${MUNI_SHARE * 100}% от полетите).`, 'good'); }
  if (act === 'air-buy') { const c = buyoutPrice(P.airLand, AIRPORT_LEVELS[0].cost); if (!pay(c, `Изкупуване на летището: ${nm}`)) return; delete S.airports[id].muni; toast(`✈️ Летището в ${nm} вече е изцяло твое — можеш да го надграждаш.`, 'good'); }
  Sound.play('buy'); save(); renderPanel();
}
function linksHtml(id = S.cityId) {
  const n = linkNeeds(id), P = linkP(id), row = (ico, title, desc, btns) => `<div style="margin:6px 0 10px"><div class="meta" style="margin:0"><b style="color:var(--txt)">${ico} ${title}</b> · ${desc}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${btns}</div></div>`;
  const b = (act, txt, cost, cls = 'btn2', lock = false) => `<button class="${cls}" data-link="${act}" ${!lock && (cost == null || econ.canAfford(cost)) ? '' : 'disabled'}>${txt}${cost != null ? ` · ${fmt(cost)} €` : ''}</button>`;
  let h = '';
  if (n.road) { const ab = onAbCorridor(id); h += row('🛣️', ab ? 'Аутобан' : 'Магистрала', `${cityById(id).nm} още не е свързан с пътната мрежа`, b('road-own', '🏗️ Строй участък (твой, тол)', null, 'btn') + b('road-muni', `🏛️ Включи се (${ab ? '−30%' : '−25%'} за материали)`, ab ? P.abMuni : P.roadMuni)); }
  if (n.port) h += row('⚓', 'Пристанище', `${seaOn() ? '' : '🔒 ниво ' + SEA_LV + ' · '}твое: терен ${fmt(P.portLand)} € + строеж; общинско: само ползване, ${MUNI_SHARE * 100}% от рейсовете за общината`, b('port-own', '🏗️ Купи терен и строй', P.portOwn, 'btn', !seaOn()) + b('port-muni', '🏛️ Общинско участие', P.portMuni, 'btn2', !seaOn()));
  else if (isMuni('sea', id)) h += row('⚓', 'Общинско пристанище', `ползваш го с дял ${MUNI_SHARE * 100}% за общината`, b('port-buy', '💰 Изкупи общинския дял', buyoutPrice(P.portLand, PORT_LEVELS[0].cost)));
  if (n.air) h += row('✈️', 'Летище', `${dev.has('AIR') ? '' : '🔒 ниво 9 · '}твое: терен ${fmt(P.airLand)} € + строеж; общинско: само ползване, ${MUNI_SHARE * 100}% от полетите за общината`, b('air-own', '🏗️ Купи терен и строй', P.airOwn, 'btn', !dev.has('AIR')) + b('air-muni', '🏛️ Общинско участие', P.airMuni, 'btn2', !dev.has('AIR')));
  else if (isMuni('air', id)) h += row('✈️', 'Общинско летище', `ползваш го с дял ${MUNI_SHARE * 100}% за общината`, b('air-buy', '💰 Изкупи общинския дял', buyoutPrice(P.airLand, AIRPORT_LEVELS[0].cost)));
  return h;
}
function linksCard() { const h = S ? linksHtml() : ''; return h ? `<div class="card"><h3><span class="ico">🔗</span>Транспортни връзки на ${cityName()}</h3>${h}</div>` : ''; }
// предложение при влизане в град без връзки (най-много веднъж на 60 дни за град)
function maybeLinkOffer() {
  if (!S || AUTOTEST) return;
  const id = S.cityId, n = linkNeeds(id); S.linkAsk = S.linkAsk || {};
  if (!n.any || (S.linkAsk[id] && S.day - S.linkAsk[id] < 60)) return;
  if (n.road && !n.port && !n.air && !dev.has('LINKS')) return;
  S.linkAsk[id] = S.day;
  modal(`🔗 Транспортни връзки — ${cityName()}`, `Общината предлага да включиш фирмата в транспорта на града. Строиш ли сам — плащаш терена и строежа, после печелиш изцяло. Общинското участие е по-евтино, но само за ползване.<div id="linkBox" style="margin-top:8px">${linksHtml(id)}</div>`, [['По-късно (таб „Офис“)', null]]);
  document.querySelectorAll('#linkBox [data-link]').forEach(x => x.onclick = () => { $('modal').classList.add('hidden'); linkAct(x.dataset.link); });
}
// ---- държавни поръчки (tenders.js) и техните уникални 3D сгради (tender3d.js)
// ⭐ Супер поръчки: един прозорец за Ориент Експрес, Route 66 (и следващите) — напредък, срок и какво да направиш сега
const SUPERS = () => [
  { key: 'oe', ico: '🚂', nm: 'Ориент Експрес', st: () => orient.state(), pr: () => orient.progress(), card: () => orient.cardHtml(), hint: oeHint },
  { key: 'r66', ico: '🛣️', nm: 'Route 66', st: () => route66.state(), pr: () => route66.progress(), card: () => route66.cardHtml(), hint: r66Hint },
  ...mega.list.map(m => ({ key: m.key, ico: m.ico, nm: m.nm, st: () => mega.state(m.key), pr: () => mega.progress(m.key), card: () => mega.cardHtml(m.key), hint: () => mega.hint(m.key) })),
];
const liveSupers = () => SUPERS().filter(o => ['offer', 'active', 'done'].includes(o.st().st));
// Ориент Експрес: какво следва по жп участъците
function oeHint() {
  const R = ['paris', 'munich', 'vienna', 'budapest', 'belgrade', 'sofia', 'istanbul'], out = [];
  for (let k = 1; k < R.length; k++) {
    const a = R[k - 1], b = R[k], nm = `${cityById(a).nm} — ${cityById(b).nm}`, i = (S.rails || []).findIndex(r => !r.c && ((r.a === a && r.b === b) || (r.a === b && r.b === a))), r = S.rails?.[i];
    if (!r) out.push(`🛤️ <b>${nm}</b>: няма линия — натисни „Строй“ (${fmt(railQuote(a, b).cost)} €)`);
    else if (!r.built) out.push(`🚧 <b>${nm}</b>: строи се ${Math.floor(r.prog * 100)}% — чака се, сама върви`);
    else if (r.hsBuild) out.push(`⚡ <b>${nm}</b>: модернизира се ${Math.floor(r.hsBuild.prog * 100)}%`);
    else if (!r.hs) out.push(`⚡ <b>${nm}</b>: готова, но трябва модернизация — натисни „⚡“ (${fmt(hsQuote(r).cost)} €)`);
  }
  return out;
}
// Route 66: какво следва по аутобана — и коя техника липсва къде
function r66Hint() {
  const R = ['chicago', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'], out = [];
  for (let k = 1; k < R.length; k++) {
    const a = R[k - 1], b = R[k], id = abSegId(a, b), nm = `${cityById(a).nm} — ${cityById(b).nm}`;
    if (hwDone().includes(id)) continue;
    const j = (S.hwJobs || []).find(q => q.seg === id);
    if (j) { const lk = hwLackOf(j); out.push(lk.length ? `⏸ <b>${nm}</b>: стои — в <b>${cityById(hwCityOf(j)).nm}</b> липсва ${lackTxt(lk)} → премести от „🚜 Гараж“ или купи` : `🚧 <b>${nm}</b>: строи се, техниката работи`); }
    else { const why = r66Why(id); out.push(why ? `🔒 <b>${nm}</b>: ${why}` : `🛣️ <b>${nm}</b>: свободен — натисни „Строй“`); }
  }
  return out;
}
function superWinHtml() {
  const L = liveSupers();
  if (!L.length) return '<div class="card"><div class="meta">Няма активни супер поръчки. Те идват рядко — „едно на милион“: Ориент Експрес и Тунелът под Ламанша (Европа), Кейп — Кайро (Африка), Route 66 и Панамският канал (Северна Америка), Дариенският пролом (Южна Америка), Транссибирската (Азия) и „Гън“ (Австралия).</div></div>';
  let h = `<div class="bw-stats">${L.map(o => { const s = o.st(), p = o.pr(), d = S.day;
    return `<div><b>${o.ico} ${p.done}/${p.all}</b><span>${o.nm} · ${s.st === 'active' ? `остават ${s.due - d} дни` : s.st === 'offer' ? 'чака отговор' : 'предаден ✅'}</span></div>`; }).join('')}</div>`;
  for (const o of L) {
    const s = o.st();
    if (s.st === 'active') { const hs = o.hint(); h += bwCard(`👉 ${o.ico} ${o.nm} — какво да направиш сега`, hs.length ? hs.map(t => `<div class="meta" style="margin:3px 0">${t}</div>`).join('') : '<div class="meta" style="color:var(--ok)">Всичко върви — само чакай.</div>'); }
    h += o.card();
  }
  return h;
}
function updSuperBtn() {
  let b = $('superBtn');
  if (!b) { const top = document.getElementById('top'); if (!top) return; b = document.createElement('button'); b.id = 'superBtn'; b.className = 'btn2'; b.style.cssText = 'color:#ffd54a;font-weight:800'; b.onclick = () => openBig('super'); top.insertBefore(b, $('garBtn') || top.querySelector('.sp')); }
  const L = S ? liveSupers() : []; b.style.display = L.length ? '' : 'none';
  if (L.length) { const act = L.filter(o => o.st().st === 'active'); b.innerHTML = `⭐ ${act.length ? act.map(o => { const p = o.pr(); return `${o.ico} ${p.done}/${p.all}`; }).join(' ') : 'Супер поръчки'}`; }
}
// 🛣️ Route 66 — рядка специална поръчка в Америка (route66.js): участъците са аутобан „US-66“ от corridors.js
const r66Why = id => { const sg = segById(id); if (!sg) return 'няма участък'; if (!abUnlocked()) return '🔒 аутобани'; if ((S.hwJobs || []).length >= HW_MAX_JOBS()) return 'няма свободен екип'; if (!abReach(sg) && !sg.spur) return 'първо стигни с магистрала'; return ''; };
const route66 = createRoute66({ S: () => S, econ: () => econ, toast, modal, fmt, save, sound: n => Sound.play(n), rep: () => S.rep || 0,
  open: () => !!S && !!contByKey('na')?.open?.(), addRep: d => { S.rep = Math.max(0, Math.min(5, S.rep + d)); }, addXp: n => dev.add(n), cityName: id => cityById(id)?.nm || id,
  segId: (a, b) => abSegId(a, b), segDone: id => hwDone().includes(id),
  segJob: id => { const j = (S.hwJobs || []).find(j => j.seg === id); return j ? { pct: Math.floor((j.stage + j.prog) / stagesOf(j).length * 100) } : null; },
  segInfo: (a, b) => { const km = kmBetween(a, b); return { km, ...abQuote(km) }; }, canTake: r66Why,
  pop: (cap, sub) => showEventPop(/открит/.test(cap) ? 'r66-done' : 'ab-done', cap, sub), openWin: () => openBig('super') });
// ⭐ супер поръчки по континентите (megaorders.js): Ламанша, Кейп — Кайро, Панамският канал, Дариен, Транссибирската, „Гън“
const megaAbWhy = id => { const sg = segById(id); if (!sg) return 'няма участък'; if (!abUnlocked()) return '🔒 аутобани'; if ((S.hwJobs || []).length >= HW_MAX_JOBS()) return 'няма свободен екип'; return ''; };
const mega = createMega({ S: () => S, econ: () => econ, toast, modal, fmt, save, sound: n => Sound.play(n), rep: () => S.rep || 0,
  contOpen: k => !!S && (k === 'eu' ? dev.has('EUROPE') : !!contByKey(k)?.open?.()), addRep: d => { S.rep = Math.max(0, Math.min(5, S.rep + d)); }, addXp: n => dev.add(n), cityName: id => cityById(id)?.nm || id,
  railLeg: (a, b) => (S.rails || []).find(r => !r.c && ((r.a === a && r.b === b) || (r.a === b && r.b === a))) || null, railQuote: (a, b, mul = 1) => { const q = railQuote(a, b); return { ...q, cost: Math.round(q.cost * mul / 1000) * 1000 }; }, railBuild: (a, b, mul = 1) => orientBuild(a, b, mul),
  abId: (a, b) => abSegId(a, b), abDone: id => hwDone().includes(id), abWhy: megaAbWhy,
  abJob: id => { const j = (S.hwJobs || []).find(j => j.seg === id); return j ? { pct: Math.floor((j.stage + j.prog) / stagesOf(j).length * 100) } : null; },
  abQuote: (a, b) => { const km = kmBetween(a, b); return { km, ...abQuote(km) }; },
  abTake: id => { const sg = segById(id); if (!sg) return; const was = sg.spur; sg.spur = true; try { takeAutobahn(id); } finally { sg.spur = was; } },   // по договор — и без готова магистрала до там
  pop: (key, cap, sub) => showEventPop(key, cap, sub), openWin: () => openBig('super') });
// ✨ Ориент Експрес — рядка международна поръчка (orient.js)
const orient = createOrient({ S: () => S, econ: () => econ, toast, modal, fmt, save, sound: n => Sound.play(n), devBest: () => dev.best(), rep: () => S.rep || 0,
  addRep: d => { S.rep = Math.max(0, Math.min(5, S.rep + d)); }, addXp: n => dev.add(n), cityName: id => cityById(id).nm,
  leg: (a, b) => { const i = (S.rails || []).findIndex(r => !r.c && ((r.a === a && r.b === b) || (r.a === b && r.b === a))); return i < 0 ? null : { i, ...S.rails[i] }; },
  legQuote: (a, b) => railQuote(a, b), hsCost: (a, b) => hsQuote({ km: kmBetween(a, b) }),
  pop: (cap, sub) => showEventPop(/потегли/.test(cap) ? 'oe-done' : 'rail-week', cap, sub), openWin: () => openBig('super') });
function orientBuild(a, b, mul = 1) {   // държавната поръчка позволява участък и извън мрежата ти (mul — по-скъп терен: тунел, пустиня)
  if ((S.rails || []).some(r => !r.c && ((r.a === a && r.b === b) || (r.a === b && r.b === a)))) return;
  const q = railQuote(a, b); q.cost = Math.round(q.cost * mul / 1000) * 1000; if (!econ.canAfford(q.cost)) { toast(`Нямаш достатъчно пари за участъка (${fmt(q.cost)} €).`, 'bad'); return; }
  econ.spend(q.cost, 'покупка', `Държавна поръчка: ${cityById(a).nm} — ${cityById(b).nm}`);
  S.rails = [...(S.rails || []), { a, b, km: q.km, days: q.days, prog: 0, built: false }];
  toast(`🚧 Започна участъкът ${cityById(a).nm} — ${cityById(b).nm} (${q.days} дни).`, 'good'); Sound.play('buy'); save();
}
const tenders = createTenders({ onComplete: (id, t) => { if (t && t.kind === 'port') portBonus(t.city); }, S: () => S, econ: () => econ, toast, modal, fmt, save, sound: n => Sound.play(n), rep: () => S.rep || 0, devBest: () => dev.best(),
  owns: id => ownedCities().includes(id), cityName: id => cityById(id)?.nm || id, ccOf: id => cityById(id)?.cc, showCity: id => showCityOnMap(id),
  unitLabel: k => ECON.UNIT_TYPES[k] ? ECON.UNIT_TYPES[k].ico + ' ' + ECON.UNIT_TYPES[k].nm : k,
  fleetIn: id => cityUnitTypes(id).reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {}),
  emit: e => quests.emit(e), onProgress: (id, p) => { if (city.tender3D && city.tender3D[id]) city.tender3D[id].setProg(p); else refreshTender3D(); },
  redraw: () => renderPanel() });
// ---- забележителности (landmarks.js): кули, джамии и др. в центъра на някои градове; парцелите се помнят в S.landmarks[град]
function refreshLandmarks() {
  for (const o of city.landmarks || []) city.group.remove(o.group);
  city.landmarks = [];
  const kinds = CITY_LANDMARKS[S.cityId]; if (!kinds || !city.lots) return;
  S.landmarks = S.landmarks || {}; const mem = S.landmarks[S.cityId] = S.landmarks[S.cityId] || {};
  const used = [];
  // площадът на главната забележителност: 2×2 парцела в центъра, улиците между тях стават площад
  for (const o of city.plazaObjs || []) city.group.remove(o);
  city.plazaObjs = []; city.noRoad = null;
  { const k = kinds[0], key = k + '@plaza', at = (bi, bj) => city.lots.find(l => l.bi === bi && l.bj === bj);
    const free = l => l && l !== city.hq && !l.fresh && (!l.busy || l.busy === 'landmark') && !(est().owned || []).some(o => o.lot === l.id) && !(est().land || []).includes(l.id);
    let g4 = (mem[key] || []).map(id => city.lots[id]);
    if (g4.length !== 4 || !g4.every(free)) {
      const c = city.lots.filter(l => l.zone === 'center').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
      g4 = null;
      for (const l of c) { const q = [l, at(l.bi + 1, l.bj), at(l.bi, l.bj + 1), at(l.bi + 1, l.bj + 1)]; if (q.every(free)) { g4 = q; break; } }
      if (g4) mem[key] = g4.map(l => l.id);
    }
    if (g4) {
      const [l0] = g4, ci = 3 * l0.bi + 3, cj = 3 * l0.bj + 3;
      city.noRoad = new Set(); for (let d = -1; d <= 1; d++) { city.noRoad.add(ci + ',' + (cj + d)); city.noRoad.add((ci + d) + ',' + cj); }
      for (const l of g4) { if (l.obj) city.group.remove(l.obj); for (const t of l.trees || []) city.group.remove(t); l.obj = null; l.built = null; l.trees = []; l.busy = 'landmark'; }
      const px = tx(ci), pz = tx(cj), W = 3 * TILE + 15;
      const plaza = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, W), new THREE.MeshStandardMaterial({ color: 0xd9cfbd, roughness: 0.95 }));
      plaza.position.set(px, 0.06, pz); plaza.receiveShadow = true; city.group.add(plaza); city.plazaObjs.push(plaza);
      const tm = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 1 });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let t = 0; t < 3; t++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.6, 8), tm); tr.position.set(px + sx * (W / 2 - 2), 2, pz + sz * (W / 2 - 2 - t * 4)); tr.castShadow = true; city.group.add(tr); city.plazaObjs.push(tr); }
      const o = buildLandmark(k, { label }); o.group.position.set(px, 0.12, pz); o.group.scale.setScalar(2.2); o.group.rotation.y = (hashStr(k) % 4) * Math.PI / 2;
      o.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      city.group.add(o.group); city.landmarks.push(o); used.push(...g4);
    }
  }
  for (const k of city.noRoad ? kinds.slice(1) : kinds) {
    let lot = city.lots[mem[k]];
    if (!lot || (lot.busy && lot.busy !== 'landmark')) {
      const modern = LANDMARK_CENTER.has(k);
      const cand = city.lots.filter(l => !l.busy && !l.fresh && l !== city.hq && (modern ? l.zone === 'center' : l.zone !== 'center') && used.every(u => Math.hypot(u.x - l.x, u.z - l.z) > 30))
        .sort((a, b) => hashStr(k + a.id) - hashStr(k + b.id));
      lot = cand[0]; if (!lot) continue; mem[k] = lot.id;
    }
    used.push(lot);
    if (lot.obj) city.group.remove(lot.obj);
    for (const t of lot.trees || []) city.group.remove(t);
    lot.obj = null; lot.built = null; lot.trees = []; lot.busy = 'landmark';
    const o = buildLandmark(k, { label }); o.group.position.set(lot.x, 0, lot.z); o.group.rotation.y = (hashStr(k) % 4) * Math.PI / 2;
    o.group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    city.group.add(o.group); city.landmarks.push(o);
  }
}
function refreshTender3D() {
  if (!S || !city.lots) return;
  for (const o of Object.values(city.tender3D || {})) o.dispose();
  city.tender3D = {};
  for (const t of TENDERS) {
    if (t.city !== S.cityId) continue;
    const p = tenders.progOf(t.id); if (p == null) continue;
    if (t.kind === 'university') {
      S.tenderLots = S.tenderLots || {};
      let lot = city.lots[S.tenderLots[t.id]];
      if (!lot) { lot = city.lots.filter(l => l.zone === 'center' && l !== city.hq && !['project', 'offer', 'garage', 'warehouse', 'owned', 'land'].includes(l.busy)).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]; if (!lot) continue; S.tenderLots[t.id] = lot.id; }
      if (lot.obj || lot.built) clearLot(lot);
      for (const tr of lot.trees || []) city.group.remove(tr); lot.trees = [];
      lot.busy = 'tender';
      city.tender3D[t.id] = buildUniversity(city.group, { label }, { x: lot.x, z: lot.z, scale: 0.62, prog: p });
    } else if (t.kind === 'port' && city.sea && city.sea.port) {
      city.tender3D[t.id] = buildPortTerminal(city.group, { A, model, label }, { x: city.sea.port.xMax + 70, z: city.sea.port.z, prog: p });
    }
  }
}
const airUpkeep = () => (S.planes || []).reduce((a, p) => a + PLANES[p.kind].upkeep, 0) + Object.values(S.airports || {}).reduce((a, p) => a + (p.muni ? 0 : (p.lv || 0) * 2500), 0);
// ---- на картата: летищата, линиите (дъги) и самолетите
function arcOf(a, b) {
  const A = cityById(a), B = cityById(b), [x1, y1] = proj(A.lon, A.lat), [x2, y2] = proj(B.lon, B.lat);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1, s = x2 >= x1 ? -1 : 1;
  return { x1, y1, x2, y2, cx: mx + (y2 - y1) / len * len * 0.18 * s, cy: my - (x2 - x1) / len * len * 0.18 * s };
}
const bez = (q, t) => [(1 - t) ** 2 * q.x1 + 2 * (1 - t) * t * q.cx + t * t * q.x2, (1 - t) ** 2 * q.y1 + 2 * (1 - t) * t * q.cy + t * t * q.y2];
function airSvg() {
  if (!S || (!Object.keys(S.airports || {}).length && !(S.airRoutes || []).length)) return '';
  const k = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK();
  let h = '';
  for (const r of S.airRoutes || []) { const q = arcOf(r.a, r.b); h += `<path d="M${q.x1},${q.y1} Q${q.cx},${q.cy} ${q.x2},${q.y2}" fill="none" stroke="#1565c0" stroke-width="${1.6 * k}" stroke-dasharray="${4 * k} ${3 * k}" opacity=".75"/>`; }
  for (const [id, ap] of Object.entries(S.airports || {})) { const c = cityById(id), [x, y] = proj(c.lon, c.lat); h += `<text x="${x + 6 * k}" y="${y - 6 * k}" font-size="${12 * k}" style="pointer-events:none">${ap.lv ? '🛫' : '🚧'}</text>`; }
  return h;
}
function updateMapPlanes() {
  const g = document.getElementById('planeLayer'); if (!g || !S) return;
  const k = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK();
  g.innerHTML = (S.planes || []).filter(p => p.path).map(p => {
    const q = arcOf(p.path[0], p.path[1]), t = Math.min(1, p.km / Math.max(1, p.total)), [x, y] = bez(q, t), [x2, y2] = bez(q, Math.min(1, t + 0.01));
    const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    return `<g transform="translate(${x},${y}) rotate(${ang}) scale(${k * 0.9})" style="pointer-events:none"><path d="M9,0 L-7,-2 L-3,-9 L-6,-9 L-11,-2 L-14,-2 L-12,0 L-14,2 L-11,2 L-6,9 L-3,9 L-7,2 Z" fill="${PLANES[p.kind].cargo ? '#ff9800' : '#fff'}" stroke="#123" stroke-width="1"/></g>`;
  }).join('');
}
// ---- прозорец „✈️ Летища“
let airSelA = null, airSelB = null;
function airWinHtml() {
  if (!dev.has('AIR')) return `<div class="meta late">${airLockTxt()}</div><div class="meta">На ниво 9 строиш летища в твоите градове, купуваш самолети и отваряш авиолинии. На ниво 10 линиите стигат до Ню Йорк, Токио, Сингапур, Рио и още 15 града по света — там можеш да отвориш филиал, щом имаш линия дотам.</div>`;
  const aps = Object.keys(S.airports || {}).filter(id => airLv(id)), planes = (S.planes || []).filter(p => inScope(...(p.path || [p.at]))), routes = (S.airRoutes || []).filter(r => inScope(r.a, r.b));
  let h = `<div class="bw-stats"><div><b>${aps.length}</b><span>летища</span></div><div><b>${airGates()}</b><span>гейта</span></div><div><b>${planes.length} / ${airGates()}</b><span>самолети / гейтове</span></div><div><b>${routes.length} / ${maxRoutes()}</b><span>авиолинии</span></div><div><b>${fmt(S.airEarned || 0)} €</b><span>спечелено от полети</span></div></div>
    <div class="meta">Поддръжка на летищата и самолетите: <span class="late">−${fmt(airUpkeep())} €/ден</span>. Самолетите летят сами по случайни линии в обсега си.${dev.has('WORLD') ? '' : ' 🔒 Градовете по света идват на ниво 10.'}</div>`;
  // летищата в твоите градове
  h += bwCard('🛫 Летища', ownedCities().filter(id => scopeNow() === 'intl' || inScope(id)).map(id => {
    const ap = airportOf(id), lv = ap?.lv || 0, mx = airportMax(id), nx = lv < mx ? AIRPORT_LEVELS[lv] : null;
    if (!mx && !lv) return `<div class="meta" style="margin:4px 0"><b style="color:var(--txt)">${cityById(id).cc || '🇧🇬'} ${cityById(id).nm}</b> · няма летище — ползвай жп и магистрали</div>`;
    const st = ap?.build ? `🚧 строи се ${AIRPORT_LEVELS[ap.build.target - 1].nm} · ${Math.floor(ap.build.prog * 100)}%` : (lv ? `${AIRPORT_LEVELS[lv - 1].nm} · ${AIRPORT_LEVELS[lv - 1].gates} гейта` : 'още няма летище') + ` · макс. ниво ${Math.max(mx, lv)}`;
    return `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${cityById(id).cc || '🇧🇬'} ${cityById(id).nm}</b> · ${st}</span>${!ap?.build && nx ? `${isMuni('air', id) ? `<button class="btn2" data-linkc="air-buy:${id}">🏛️ общинско (${MUNI_SHARE * 100}%) · изкупи ${fmt(buyoutPrice(linkP(id).airLand, AIRPORT_LEVELS[0].cost))} €</button>` : `<button class="btn" data-airport="${id}" ${econ.canAfford(nx.cost) ? '' : 'disabled'}>${lv ? `Надгради → ${nx.gates} гейта` : 'Построй летище'} ${fmt(nx.cost)} €</button>`}` : ''}</div>${ap?.build ? `<div class="bar"><i style="width:${(ap.build.prog * 100).toFixed(1)}%"></i></div>` : ''}`;
  }).join(''));
  // авиолинии
  const dests = CITIES.filter(c => dev.best() >= cityLv(c.id) && (!airSelA || inScope(airSelA, c.id))).sort((x, y) => (isWorld(y.id) - isWorld(x.id)) || x.nm.localeCompare(y.nm, 'bg'));
  if (!aps.includes(airSelA)) airSelA = aps[0] || null;
  const sel = airSelA && airSelB && airSelA !== airSelB ? { km: routeKm(airSelA, airSelB), cost: ROUTE_COST(routeKm(airSelA, airSelB)) } : null;
  h += bwCard(`🗺️ Авиолинии · ${routes.length}/${maxRoutes()}`, autoToggle('air') + (routes.length ? routes.map(r => `<div class="meta" style="margin:2px 0">✈️ <b style="color:var(--txt)">${cityById(r.a).nm} — ${cityById(r.b).cc ? cityById(r.b).cc + ' ' : ''}${cityById(r.b).nm}</b> · ${fmt(r.km)} км · ${Object.entries(PLANES).filter(([, P]) => r.km <= P.range).map(([, P]) => P.ico).join('')}</div>`).join('') : '<div class="meta">Още нямаш авиолинии.</div>')
    + (aps.length ? `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><select id="arA">${aps.map(id => `<option value="${id}" ${id === airSelA ? 'selected' : ''}>🛫 ${cityById(id).nm}</option>`).join('')}</select> →
      <select id="arB"><option value="">— избери град —</option>${dests.filter(c => c.id !== airSelA && airportMax(c.id) && !hasRoute(airSelA, c.id)).map(c => `<option value="${c.id}" ${c.id === airSelB ? 'selected' : ''}>${isWorld(c.id) ? '🌐 ' : ''}${c.cc ? c.cc + ' ' : ''}${c.nm}</option>`).join('')}</select>
      <span class="meta" style="margin:0">${sel ? `${fmt(sel.km)} км · права ${fmt(sel.cost)} €` : ''}</span><button class="btn" id="arOpen" ${sel && routes.length < maxRoutes() ? '' : 'disabled'}>Отвори линия</button></div>` : '<div class="meta late">Първо построй летище.</div>'));
  // самолети
  h += bwCard(`✈️ Самолети · ${planes.length}/${airGates()}`, planes.length ? planes.map(p => { const P = PLANES[p.kind]; return `<div class="row" style="margin:5px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${p.nm}</b> ${P.nm}<br>${p.path ? `${p.ferry ? '↩️ прелита празен' : P.cargo ? '📦 товари' : '🎫 пътници'} ${cityById(p.path[0]).nm} → ${cityById(p.path[1]).nm} · ${Math.floor(p.km / Math.max(1, p.total) * 100)}%` : `на земята в ${cityById(p.at).nm} — няма линия в обсега му (${fmt(P.range)} км)`}</span>${p.path && !p.ferry ? `<b style="color:var(--ok)">+${fmt(p.pay.gross - p.pay.fuel)} €</b>` : ''}</div>`; }).join('') : '<div class="meta">Нямаш самолети.</div>');
  h += bwCard('🛒 Купи самолет', Object.entries(PLANES).map(([k, P]) => `<div class="row" style="margin:5px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${P.ico} ${P.nm}</b><br>${P.cargo ? `${P.tons} т товар` : `${P.seats} места`} · обсег ${fmt(P.range)} км · ~${fmt(planeDaily(k))} €/ден чисто · поддръжка ${fmt(P.upkeep)} €/ден</span><button class="btn" data-plane="${k}" ${econ.canAfford(P.cost) && planes.length < airGates() ? '' : 'disabled'}>${fmt(P.cost)} €</button></div>`).join(''));
  return h;
}
// ============================================================ фаза „Пристанища“: морски линии и кораби (seaways.js)
const seaOn = () => !!S && dev.best() >= SEA_LV;
const portOf = id => (S && S.ports || {})[id] || null;
const portLv = id => portOf(id)?.lv || 0;
const portBerths = () => Object.values(S.ports || {}).reduce((a, p) => a + (p.lv ? PORT_LEVELS[p.lv - 1].berths : 0), 0);
const seaRouteKm = (a, b) => seaKm(cityById(a), cityById(b));
const hasSeaRoute = (a, b) => (S.seaRoutes || []).some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
const maxSeaRoutes = () => portBerths() * 2;
const seaLockTxt = () => `🔒 Пристанищата се отключват на <b>ниво ${SEA_LV} на развитие</b> (сега ${dev.best()}).`;
function buildPort(id, free = 0) {
  if (!seaOn()) { toast(`🔒 Пристанищата се отключват на ниво ${SEA_LV} на развитие.`, 'bad'); return; }
  const p = portOf(id), lv = p?.lv || 0, mx = portMax(id);
  if (!mx) { toast(`⚓ ${cityById(id).nm} няма море.`, 'bad'); return; }
  if (p?.muni) { toast(`🏛️ Пристанището в ${cityById(id).nm} е общинско — първо изкупи общинския дял (таб „Офис“ → Транспортни връзки).`, 'bad'); return; }
  if (lv >= mx) { toast(`Максимумът за ${cityById(id).nm} е ниво ${mx}.`, 'bad'); return; }
  if (p?.build) return;
  const L = PORT_LEVELS[lv];
  if (!econ.canAfford(L.cost)) { withLoan(L.cost, `${L.nm} в ${cityById(id).nm}`, () => buildPort(id, free)); return; }
  econ.spend(L.cost, 'покупка', `${L.nm} в ${cityById(id).nm}`);
  S.ports = { ...(S.ports || {}), [id]: { lv, build: { target: lv + 1, prog: 0 } } };
  toast(`⚓ Започна строежът: ${L.nm} в ${cityById(id).nm} (${L.days} дни).`, 'good'); Sound.play('buy'); save();
}
// награда от държавната поръчка „Контейнерен терминал“: +2 нива на пристанището без пари
function portBonus(id) {
  const p = portOf(id), mx = portMax(id); if (!mx) return;
  const lv = Math.min(mx, (p?.lv || 0) + 2);
  S.ports = { ...(S.ports || {}), [id]: { lv, build: null } };
  toast(`⚓ Контейнерният терминал вдигна пристанището в ${cityById(id).nm} до ниво ${lv} (${PORT_LEVELS[lv - 1].nm})!`, 'good');
  if (id === S.cityId) city.sea?.setPortLevel?.(lv);
  save();
}
function openSeaRoute(a, b) {
  if (!portLv(a)) { toast('Линията тръгва от твое готово пристанище.', 'bad'); return; }
  if (!b || a === b || hasSeaRoute(a, b)) { toast('Тази морска линия вече съществува.', 'bad'); return; }
  if (!portMax(b)) { toast(`⚓ ${cityById(b).nm} няма пристанище.`, 'bad'); return; }
  if (dev.best() < cityLv(b)) { toast(`🔒 ${cityById(b).nm} се отключва на ниво ${cityLv(b)} на развитие.`, 'bad'); return; }
  if ((S.seaRoutes || []).length >= maxSeaRoutes()) { toast(`Пристанищата ти поемат до ${maxSeaRoutes()} морски линии — надгради ги за още кейове.`, 'bad'); return; }
  const km = seaRouteKm(a, b), cost = SEA_ROUTE_COST(km);
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за линията.', 'bad'); return; }
  econ.spend(cost, 'покупка', `Морска линия ${cityById(a).nm} — ${cityById(b).nm}`);
  S.seaRoutes = [...(S.seaRoutes || []), { a, b, km }];
  toast(`🚢 Нова морска линия ${cityById(a).nm} — ${cityById(b).nm} (${fmt(km)} км).`, 'good');
  Sound.play('buy'); save(); if (!$('mapScreen').classList.contains('hidden')) drawMap();
}
function buyShip(kind) {
  if (!seaOn()) { toast(`🔒 Корабите идват с пристанищата (ниво ${SEA_LV}).`, 'bad'); return; }
  const home = Object.keys(S.ports || {}).find(id => portLv(id) > 0);
  if (!home) { toast('Първо построй пристанище.', 'bad'); return; }
  if ((S.ships || []).length >= portBerths()) { toast('Няма свободен кей — надгради пристанището.', 'bad'); return; }
  const P = SHIPS[kind];
  if (!econ.canAfford(P.cost)) { withLoan(P.cost, `Кораб: ${P.nm}`, () => buyShip(kind)); return; }
  econ.spend(P.cost, 'покупка', `Кораб: ${P.nm}`);
  S.shipSeq = (S.shipSeq || 0) + 1;
  S.ships = [...(S.ships || []), { id: S.shipSeq, kind, nm: `${P.ico} №${S.shipSeq}`, at: home, path: null, km: 0, total: 0 }];
  toast(`${P.ico} Купи ${P.nm}. Плава сам по морските ти линии.`, 'good'); Sound.play('buy'); save();
  showEventPop('ship-' + shipPic(kind), `${P.ico} Нов ${P.nm.toLowerCase()}!`, `${P.cargo} · ~${fmt(shipDaily(kind))} €/ден чисто${P.range ? ` · обсег ${fmt(P.range)} км` : ''}. Плава сам по морските ти линии.`);
}
// флот: продажба (60% от цената) и надграждане до следващия клас (новата цена минус 60% от старата)
const TRADE_IN = 0.6;
const SHIP_NEXT = { boat: 'coaster', coaster: 'bulk', bulk: 'container', container: 'tanker', tanker: 'cruise' };
const TRAIN_NEXT = { small: 'mid', mid: 'heavy', heavy: 'giant', pax: 'express' };
const upCost = (from, to) => Math.max(0, Math.round((to.cost - from.cost * TRADE_IN) / 1000) * 1000);
function sellShip(id) {
  const p = (S.ships || []).find(x => x.id === id); if (!p) return;
  const got = Math.round(SHIPS[p.kind].cost * TRADE_IN / 1000) * 1000;
  S.ships = S.ships.filter(x => x !== p); econ.earn(got, 'покупка', `Продаден кораб: ${SHIPS[p.kind].nm}`);
  toast(`💰 Продаде ${SHIPS[p.kind].ico} ${SHIPS[p.kind].nm} за ${fmt(got)} €.`, 'good'); SFXcash(); save();
}
function upgradeShip(id) {
  const p = (S.ships || []).find(x => x.id === id), to = p && SHIP_NEXT[p.kind]; if (!to) return;
  const c = upCost(SHIPS[p.kind], SHIPS[to]); if (!econ.canAfford(c)) { toast('Нямаш достатъчно пари за надграждането.', 'bad'); return; }
  econ.spend(c, 'покупка', `Надграждане на кораб: ${SHIPS[p.kind].nm} → ${SHIPS[to].nm}`);
  p.kind = to; p.nm = `${SHIPS[to].ico} №${p.id}`; p.path = null; p.km = 0; p.total = 0;
  toast(`⬆️ Корабът стана ${SHIPS[to].ico} ${SHIPS[to].nm}!`, 'good'); Sound.play('buy'); save();
}
function sellTrain(id) {
  const t = (S.trains || []).find(x => x.id === id); if (!t) return;
  const T = trainType(t), got = Math.round(T.cost * TRADE_IN / 1000) * 1000;
  if (t.job && t.job.wagons && !t.job.pax && !t.job.shuttle) S.jobs = [...(S.jobs || []), t.job];   // поетият превоз се връща на таблото
  S.trains = S.trains.filter(x => x !== t); econ.earn(got, 'покупка', `Продаден влак: ${T.nm}`);
  toast(`💰 Продаде ${T.ico} ${T.nm.toLowerCase()} за ${fmt(got)} €.`, 'good'); SFXcash(); parkedSig = ''; updateParked(); save();
}
function upgradeTrain(id) {
  const t = (S.trains || []).find(x => x.id === id), to = t && TRAIN_NEXT[t.kind || 'small']; if (!to) return;
  const T = trainType(t), N = TRAIN_TYPES[to], c = upCost(T, N);
  if (!econ.canAfford(c)) { toast('Нямаш достатъчно пари за надграждането.', 'bad'); return; }
  econ.spend(c, 'покупка', `Надграждане на влак: ${T.nm} → ${N.nm}`);
  t.kind = to; t.wagons = N.wagons; t.nm = `${N.ico} №${S.trains.indexOf(t) + 1} ${N.nm.toLowerCase()}`;
  toast(`⬆️ Влакът стана ${N.ico} ${N.nm.toLowerCase()} с ${N.wagons} вагона!${N.express ? ' Кара по модернизирани линии.' : ''}`, 'good'); Sound.play('horn'); parkedSig = ''; updateParked(); save();
}
const fleetBtns = (kind, id, next, NX, cost, sell) => `<span style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${next ? `<button class="btn2" data-up${kind}="${id}" ${econ.canAfford(cost) ? '' : 'disabled'} title="Става ${NX.nm}">⬆️ ${NX.ico} ${fmt(cost)} €</button>` : ''}<button class="btn2" data-sell${kind}="${id}" title="Продай за ${fmt(sell)} €">💰 Продай</button></span>`;
function shipTrip(p) {
  const opts = (S.seaRoutes || []).filter(r => (r.a === p.at || r.b === p.at) && r.km <= shipRange(p.kind));
  if (opts.length) { const r = pick(opts), to = r.a === p.at ? r.b : r.a; p.path = [p.at, to]; p.km = 0; p.total = r.km; p.ferry = false; p.pay = voyagePay(p.kind, r.km); return; }
  const home = Object.keys(S.ports || {}).filter(id => portLv(id) && id !== p.at && (S.seaRoutes || []).some(r => (r.a === id || r.b === id) && r.km <= shipRange(p.kind))).sort((x, y) => seaRouteKm(p.at, x) - seaRouteKm(p.at, y))[0];
  if (home) { const km = seaRouteKm(p.at, home); p.path = [p.at, home]; p.km = 0; p.total = km; p.ferry = true; p.pay = voyagePay(p.kind, km); }
}
function updateSea(dtDays) {
  if (!S) return;
  for (const [id, pt] of Object.entries(S.ports || {})) if (pt.build) {
    const L = PORT_LEVELS[pt.build.target - 1];
    pt.build.prog += dtDays / L.days;
    if (pt.build.prog >= 1) {
      pt.lv = pt.build.target; pt.build = null;
      quests.emit('port'); dev.add(dev.XP.branch);
      if (id === S.cityId) city.sea?.setPortLevel?.(pt.lv);
      showEventPop('port-done', `⚓ ${L.nm} в ${cityById(id).nm}`, `Пристанището е готово · ${L.berths} ${L.berths === 1 ? 'кей' : 'кея'}`);
      toast(`⚓ ${L.nm} в ${cityById(id).nm} е готово! ${L.berths} кея — купи кораби и отвори морски линии от „⚓ Пристанища“.`, 'good', () => openBig('sea')); save();
    }
  }
  for (const p of S.ships || []) {
    if (!p.path) { shipTrip(p); if (!p.path) continue; }
    p.km += SHIPS[p.kind].speed * dtDays;
    if (p.km < p.total) continue;
    const [from, to] = p.path, f = p.pay || voyagePay(p.kind, p.total);
    p.at = to; p.path = null;
    if (p.ferry) econ.spend(f.fuel, 'гориво', `${p.nm}: празен курс ${cityById(from).nm} → ${cityById(to).nm}`);
    else { const net = Math.round((f.gross - f.fuel) * (isMuni('sea', from) || isMuni('sea', to) ? 1 - MUNI_SHARE : 1)); econ.earn(net, SEA_CAT, `${p.nm}: ${cityById(from).nm} → ${cityById(to).nm}`); S.seaEarned = (S.seaEarned || 0) + net; quests.emit('voyage'); flowAdd('sea', net, `${cityById(from).nm} → ${cityById(to).nm}`); }
  }
}
// икони на корабите: пътническите (круизен, малък, лодка) — ферибот, товарните — контейнеровоз
const shipPic = k => (k === 'cruise' || k === 'coaster' || k === 'boat') ? 'cruise' : 'cargo';
const shipImg = (k, h = 46) => `<img src="assets/ui/ship-${shipPic(k)}.webp" alt="" style="height:${h}px;object-fit:contain;vertical-align:middle">`;
const SEA_CAT = ECON.CATS && ECON.CATS['кораби'] ? 'кораби' : AIR_CAT;
const seaUpkeep = () => (S.ships || []).reduce((a, p) => a + SHIPS[p.kind].upkeep, 0) + Object.values(S.ports || {}).reduce((a, p) => a + (p.muni ? 0 : (p.lv || 0) * 2000), 0);
// градове с морска линия до текущия (материалите оттам са по-евтини — нивото на аутобаните)
const seaNetwork = () => !S ? [] : (S.seaRoutes || []).filter(r => r.a === S.cityId || r.b === S.cityId).map(r => r.a === S.cityId ? r.b : r.a);
// корабите в 3D пристанището на текущия град
let seaFleetSig = '';
function syncSeaFleet() {
  if (!S || !city.sea?.setFleet) return;
  const here = S.cityId, list = [];
  for (const p of S.ships || []) {
    const t = p.path ? p.km / Math.max(1, p.total) : 0;
    if (!p.path && p.at === here) list.push({ kind: p.kind, state: 'docked' });
    else if (p.path && p.path[1] === here && t > 0.85) list.push({ kind: p.kind, state: 'arriving' });
    else if (p.path && p.path[0] === here && t < 0.15) list.push({ kind: p.kind, state: 'leaving' });
  }
  const sig = list.map(o => o.kind + o.state).join(',');
  if (sig !== seaFleetSig) { seaFleetSig = sig; city.sea.setFleet(list); }
}
// ---- на картата: морските линии (вълнообразни, от другата страна на дъгата) и корабите
// морският път в координатите на картата; отсечка, която пресича 180-ия меридиан (Тихия океан), се прекъсва
function seaPolys(a, b) {
  const polys = [[]], { pts } = seaPath(cityById(a), cityById(b));
  pts.forEach((p, i) => { if (i && Math.abs(p[0] - pts[i - 1][0]) > 180) polys.push([]); polys[polys.length - 1].push(proj(p[0], p[1])); });
  return polys;
}
// точка и посока на кораба на дял t от пътя (по реалните км на отсечките)
function seaPos(a, b, t) {
  const { pts } = seaPath(cityById(a), cityById(b)), seg = [];
  let tot = 0; for (let i = 1; i < pts.length; i++) { const d = airKm({ lon: pts[i - 1][0], lat: pts[i - 1][1] }, { lon: pts[i][0], lat: pts[i][1] }) || 1; seg.push(d); tot += d; }
  let left = t * tot, i = 0; while (i < seg.length - 1 && left > seg[i]) { left -= seg[i]; i++; }
  const f = Math.min(1, left / seg[i]), p0 = pts[i], p1 = pts[i + 1];
  if (Math.abs(p1[0] - p0[0]) > 180) return null;   // над Тихия океан извън картата
  const [x0, y0] = proj(p0[0], p0[1]), [x1, y1] = proj(p1[0], p1[1]);
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, ang: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI };
}
function seaSvg() {
  if (!S || (!Object.keys(S.ports || {}).length && !(S.seaRoutes || []).length)) return '';
  const k = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK();
  let h = '';
  for (const r of S.seaRoutes || []) for (const pl of seaPolys(r.a, r.b)) if (pl.length > 1) h += `<polyline points="${pl.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#00897b" stroke-width="${2 * k}" stroke-dasharray="${1 * k} ${2.5 * k}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
  for (const [id, pt] of Object.entries(S.ports || {})) { const c = cityById(id), [x, y] = proj(c.lon, c.lat); h += `<text x="${x - 16 * k}" y="${y + 14 * k}" font-size="${11 * k}" style="pointer-events:none">${pt.lv ? '⚓' : '🚧'}</text>`; }
  return h;
}
function updateMapShips() {
  const g = document.getElementById('shipLayer'); if (!g || !S) return;
  const k = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK(), col = { boat: '#ffb300', coaster: '#43a047', container: '#e53935', bulk: '#8d6e63', tanker: '#37474f', cruise: '#fafafa' };
  g.innerHTML = (S.ships || []).filter(p => p.path).map(p => {
    const pos = seaPos(p.path[0], p.path[1], Math.min(1, p.km / Math.max(1, p.total))); if (!pos) return '';
    const { x, y, ang } = pos;
    const w = (p.kind === 'boat' ? 14 : p.kind === 'coaster' ? 18 : 24) * k, west = Math.abs(ang) > 90;
    return `<image href="assets/ui/ship-${shipPic(p.kind)}.webp" x="${-w / 2}" y="${-w / 2}" width="${w}" height="${w}" transform="translate(${x},${y})${west ? '' : ' scale(-1,1)'}" style="pointer-events:none"/>`;
  }).join('');
}
// ---- прозорец „⚓ Пристанища“
let seaSelA = null, seaSelB = null;
function seaWinHtml() {
  if (!seaOn()) return `<div class="meta late">${seaLockTxt()}</div><div class="meta">Строиш пристанища в крайморските си градове, купуваш кораби (насипни, танкери, контейнеровози, круизни) и отваряш морски линии до пристанищата по света. Корабите плават сами и носят много, а материалите от заводите в свързаните по море градове ти излизат по-евтино.</div>`;
  const pts = Object.keys(S.ports || {}).filter(id => portLv(id)), ships = (S.ships || []).filter(p => inScope(...(p.path || [p.at]))), routes = (S.seaRoutes || []).filter(r => inScope(r.a, r.b));
  let h = `<div class="bw-stats"><div><b>${pts.length}</b><span>пристанища</span></div><div><b>${ships.length} / ${portBerths()}</b><span>кораби / кейове</span></div><div><b>${routes.length} / ${maxSeaRoutes()}</b><span>морски линии</span></div><div><b>${fmt(S.seaEarned || 0)} €</b><span>спечелено от курсове</span></div></div>
    <div class="meta">Поддръжка на пристанищата и корабите: <span class="late">−${fmt(seaUpkeep())} €/ден</span>. Корабите плават сами по случайни линии. Материалите от заводи в градове с морска линия до ${cityName()} са −${Math.round((ECON.AB_DISCOUNT ?? 0.3) * 100)}%.</div>`;
  const coast = ownedCities().filter(id => (portMax(id) || portLv(id)) && (scopeNow() === 'intl' || inScope(id)));
  h += bwCard('⚓ Пристанища', coast.length ? coast.map(id => {
    const pt = portOf(id), lv = pt?.lv || 0, mx = portMax(id), nx = lv < mx ? PORT_LEVELS[lv] : null;
    const st = pt?.build ? `🚧 строи се ${PORT_LEVELS[pt.build.target - 1].nm} · ${Math.floor(pt.build.prog * 100)}%` : (lv ? `${PORT_LEVELS[lv - 1].nm} · ${PORT_LEVELS[lv - 1].berths} кея` : 'още няма пристанище') + ` · макс. ниво ${Math.max(mx, lv)}`;
    return `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0"><b style="color:var(--txt)">${cityById(id).cc || '🇧🇬'} ${cityById(id).nm}</b> · ${st}</span>${!pt?.build && nx ? `${isMuni('sea', id) ? `<button class="btn2" data-linkc="port-buy:${id}">🏛️ общинско (${MUNI_SHARE * 100}%) · изкупи ${fmt(buyoutPrice(linkP(id).portLand, PORT_LEVELS[0].cost))} €</button>` : `<button class="btn" data-port="${id}" ${econ.canAfford(nx.cost) ? '' : 'disabled'}>${lv ? `Надгради → ${nx.berths} кея` : 'Построй пристанище'} ${fmt(nx.cost)} €</button>`}` : ''}</div>${pt?.build ? `<div class="bar"><i style="width:${(pt.build.prog * 100).toFixed(1)}%"></i></div>` : ''}`;
  }).join('') : '<div class="meta late">Нямаш крайморски град. Отвори филиал във Варна, Бургас, Констанца, Истанбул, Солун, Атина…</div>');
  const dests = CITIES.filter(c => portMax(c.id) && dev.best() >= cityLv(c.id) && (!seaSelA || inScope(seaSelA, c.id))).sort((x, y) => x.nm.localeCompare(y.nm, 'bg'));
  if (!pts.includes(seaSelA)) seaSelA = pts[0] || null;
  const sel = seaSelA && seaSelB && seaSelA !== seaSelB ? { km: seaRouteKm(seaSelA, seaSelB), cost: SEA_ROUTE_COST(seaRouteKm(seaSelA, seaSelB)) } : null;
  h += bwCard(`🗺️ Морски линии · ${routes.length}/${maxSeaRoutes()}`, autoToggle('sea') + (routes.length ? routes.map(r => `<div class="meta" style="margin:2px 0">🚢 <b style="color:var(--txt)">${cityById(r.a).nm} — ${cityById(r.b).cc ? cityById(r.b).cc + ' ' : ''}${cityById(r.b).nm}</b> · ${fmt(r.km)} км · ${Object.entries(SHIPS).filter(([q]) => r.km <= shipRange(q)).map(([, P]) => P.ico).join('')}</div>`).join('') : '<div class="meta">Още нямаш морски линии.</div>')
    + (pts.length ? `<div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><select id="srA">${pts.map(id => `<option value="${id}" ${id === seaSelA ? 'selected' : ''}>⚓ ${cityById(id).nm}</option>`).join('')}</select> →
      <select id="srB"><option value="">— избери пристанище —</option>${dests.filter(c => c.id !== seaSelA && !hasSeaRoute(seaSelA, c.id)).map(c => `<option value="${c.id}" ${c.id === seaSelB ? 'selected' : ''}>${c.cc ? c.cc + ' ' : '🇧🇬 '}${c.nm}</option>`).join('')}</select>
      <span class="meta" style="margin:0">${sel ? `${fmt(sel.km)} км · ${fmt(sel.cost)} €` : ''}</span><button class="btn" id="srOpen" ${sel && routes.length < maxSeaRoutes() ? '' : 'disabled'}>Отвори линия</button></div>` : '<div class="meta late">Първо построй пристанище.</div>'));
  h += bwCard(`🚢 Кораби · ${ships.length}/${portBerths()}`, ships.length ? ships.map(p => { const P = SHIPS[p.kind]; return `<div class="row" style="margin:5px 0;align-items:center"><span class="meta" style="margin:0">${shipImg(p.kind, 30)} <b style="color:var(--txt)">${p.nm}</b> ${P.nm}<br>${p.path ? `${p.ferry ? '↩️ празен курс' : `${P.ico} ${P.cargo}`} ${cityById(p.path[0]).nm} → ${cityById(p.path[1]).nm} · ${Math.floor(p.km / Math.max(1, p.total) * 100)}%` : `в пристанище ${cityById(p.at).nm} — няма линия оттук${P.range ? ` до ${fmt(P.range)} км` : ''}`}</span>${p.path && !p.ferry ? `<b style="color:var(--ok)">+${fmt(p.pay.gross - p.pay.fuel)} €</b>` : ''}</div>${(() => { const nx = SHIP_NEXT[p.kind]; return `<div class="row" style="margin:0 0 6px;justify-content:flex-end">${fleetBtns('ship', p.id, nx, nx && SHIPS[nx], nx ? upCost(P, SHIPS[nx]) : 0, Math.round(P.cost * TRADE_IN / 1000) * 1000)}</div>`; })()}`; }).join('') : '<div class="meta">Нямаш кораби.</div>');
  h += bwCard('🛒 Купи кораб', Object.entries(SHIPS).map(([k, P]) => `<div class="row" style="margin:5px 0;align-items:center"><span class="meta" style="margin:0">${shipImg(k, 44)} <b style="color:var(--txt)">${P.ico} ${P.nm}</b><br>${P.cargo}${P.range ? ` · обсег ${fmt(P.range)} км` : ' · без ограничение'} · ~${fmt(shipDaily(k))} €/ден чисто · поддръжка ${fmt(P.upkeep)} €/ден</span><button class="btn" data-ship="${k}" ${econ.canAfford(P.cost) && ships.length < portBerths() ? '' : 'disabled'}>${fmt(P.cost)} €</button></div>`).join(''));
  return h;
}
// позиция на влак по маршрута (за картата)
function trainXY(t) {
  if (!t.path || t.path.length < 2) { const c = cityById(t.at); return proj(c.lon, c.lat); }
  let left = Math.min(t.km, t.total);
  for (let i = 1; i < t.path.length; i++) {
    const seg = kmBetween(t.path[i - 1], t.path[i]);
    if (left <= seg || i === t.path.length - 1) {
      return edgeXY(t.path[i - 1], t.path[i], Math.min(1, left / seg));
    }
    left -= seg;
  }
}
function railSvg() {
  const zs = zShrink();   // при приближаване линиите не дебелеят
  let h = '';
  for (const r of S?.rails || []) {
    const A = cityById(r.a), B = cityById(r.b), [x1, y1] = proj(A.lon, A.lat), [x2, y2] = r.c ? junXY(r) : proj(B.lon, B.lat);
    if (r.c && r.built) h += `<circle cx="${x2}" cy="${y2}" r="2.6" fill="#d8cbb0" stroke="#3b2f25" stroke-width="${(1.2 * zs).toFixed(2)}"/>`;
    const pts = r.c ? [[x1, y1], [x2, y2]] : railPts(r.a, r.b), ps = pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
    if (r.built && pts.length > 2) { h += `<polyline points="${ps}" fill="none" stroke="#3b2f25" stroke-width="${(3.2 * zs).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${ps}" fill="none" stroke="#d8cbb0" stroke-width="${(1.6 * zs).toFixed(2)}" stroke-dasharray="1.2 2"/>`; continue; }
    if (r.built) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3b2f25" stroke-width="${(3.2 * zs).toFixed(2)}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d8cbb0" stroke-width="${(1.6 * zs).toFixed(2)}" stroke-dasharray="${(1.2 * zs).toFixed(2)} ${(2 * zs).toFixed(2)}"/>`;
    else {
      const [mx, my] = ptAlong(pts, r.prog);
      if (pts.length > 2) { const done = donePts(pts, r.prog).map(p => p.map(v => v.toFixed(1)).join(',')).join(' '), [lx, ly] = ptAlong(pts, 0.5); h += `<polyline points="${ps}" fill="none" stroke="#ff9800" stroke-width="${(2 * zs).toFixed(2)}" stroke-dasharray="${(4 * zs).toFixed(2)} ${(3 * zs).toFixed(2)}" opacity=".8"/><polyline points="${done}" fill="none" stroke="#3b2f25" stroke-width="${(3 * zs).toFixed(2)}"/><text x="${lx}" y="${ly - 4}" font-size="${9 * zs}" font-weight="800" fill="#7a4b00" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${(2.5 * zs).toFixed(2)}">${RAIL_STAGES[railStageOf(r.prog).stage].ico} ${Math.floor(r.prog * 100)}%</text>`; continue; }
      h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ff9800" stroke-width="${(2 * zs).toFixed(2)}" stroke-dasharray="${(4 * zs).toFixed(2)} ${(3 * zs).toFixed(2)}" opacity=".8"/><line x1="${x1}" y1="${y1}" x2="${mx}" y2="${my}" stroke="#3b2f25" stroke-width="${(3 * zs).toFixed(2)}"/>`;
      h += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" font-size="9" font-weight="800" fill="#7a4b00" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${(2.5 * zs).toFixed(2)}">${RAIL_STAGES[railStageOf(r.prog).stage].ico} ${Math.floor(r.prog * 100)}%</text>`;
    }
  }
  return h;
}
function updateMapTrains() {
  const g = document.getElementById('trainLayer'); if (!g || !S) return;
  const k = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK();
  g.innerHTML = (S.trains || []).map(t => {
    const [x, y] = trainXY(t), w = 20 * k, h = 15 * k;
    // обърнат хоризонтално, ако се движи на запад
    let west = false;
    if (t.path && t.path.length > 1) { const p0 = proj(cityById(t.path[0]).lon, cityById(t.path[0]).lat), p1 = proj(cityById(t.path[t.path.length - 1]).lon, cityById(t.path[t.path.length - 1]).lat); west = p1[0] < p0[0]; }
    return `<image href="assets/ui/train-${trainType(t).pax ? 'pax' : 'freight'}.webp" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" transform="translate(${x},${y})${west ? ' scale(-1,1)' : ''}" style="pointer-events:none"/>`;
  }).join('');
}
function renderMapHud() {
  if (!S || $('mapScreen').classList.contains('hidden')) return;
  const box = $('mapRail'); if (!box) return;
  // десният панел е само с най-важното: бутоните за строене, държавните поръчки, офертите от доставчици и курортите.
  // подробностите (линии, влакове, магистрали, летища, пристанища) са в прозорците горе
  const jobs = (S.hwJobs || []).length, stuck = (S.hwJobs || []).filter(j => hwLackOf(j).length).length;
  let h = `<div class="sect">🏗️ Строй</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn2" id="mbRail">${railPick ? '✖ Откажи строежа' : '🛤️ Жп линия'}</button>${railPick ? '' : `<button class="btn2" id="mbHw">🛣️ Магистрала</button>${dev.has('AIR') ? '<button class="btn2" id="mbAir">✈️ Летище</button>' : ''}${seaOn() ? '<button class="btn2" id="mbSea">⚓ Пристанище</button>' : ''}`}</div>
    <div class="meta" style="margin-top:4px">🎫 Тол ${fmt(hwToll())} €/ден${jobs ? ` · 🚧 строят се ${jobs} участъка${stuck ? ` · <span class="late">⏸ ${stuck} чакат техника</span>` : ''}` : ''}</div>`;
  { const tc = tenders.cardsHtml(); if (tc) h += `<div class="sect">🏛️ Държавни поръчки</div>${tc}`; }
  h += estateHudHtml();
  h += supply.hudHtml();
  h += contHudHtml();
  h += upgHudHtml();   // вместо курортите (те са в прозореца „🏔️ Курорти“ горе)
  // пречертава се всяка секунда: само ако нещо се е променило и не докато бутон е натиснат (иначе кликът се губи)
  if (!box.dataset.pw) { box.dataset.pw = '1'; box.addEventListener('pointerdown', () => { box._press = true; }); window.addEventListener('pointerup', () => setTimeout(() => { box._press = false; }, 0)); }
  if (box._press || box._h === h) return;
  box._h = h;
  box.innerHTML = h;
  box.querySelectorAll('[data-resort-open]').forEach(b => b.onclick = () => resorts.open(b.dataset.resortOpen));
  tenders.bind(box);
  box.querySelectorAll('[data-contshow]').forEach(b => b.onclick = () => setMapView(viewOf(b.dataset.contshow).key));
  box.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => { const [id, kind] = b.dataset.upg.split('|'); upgGo(id, kind); });
  box.querySelectorAll('[data-erep]').forEach(b => b.onclick = () => { repairAllIn(b.dataset.erep); renderMapHud(); });
  box.querySelectorAll('[data-erem]').forEach(b => b.onclick = () => { remodelAllIn(b.dataset.erem); renderMapHud(); });
  box.querySelectorAll('[data-edem]').forEach(b => b.onclick = () => { const id = b.dataset.edem; try { sessionStorage.setItem('stroiTab', 'estate'); } catch {} if (id === S.cityId) { showMap(false); tab = 'estate'; renderPanel(); } else switchCity(id); });
  supply.bind(box, () => { renderMapHud(); refreshWarehouse(); renderPanel(); });
  $('mbRail').onclick = () => { if (railPick) { railPick = null; drawMap(); renderMapHud(); } else startRailMode(); };
  if ($('mbHw')) $('mbHw').onclick = () => openBig('hw');
  if ($('mbAir')) $('mbAir').onclick = () => openBig('air');
  if ($('mbSea')) $('mbSea').onclick = () => openBig('sea');
}

// ---- гара в града: влак пристига, когато материалите идват по жп
const STATION_X = tx(0) - 16;
let cityTrain = null;
let trackMap = makeTrackMap(null);   // пътят на жп линията в текущия град (trackpath.js)
let passing = null;
// гарата на фирмата: нива 1–5 = брой коловози; ниво 0 — само главната линия през града
let station = null, parkedSig = '';
loadTrainModels().then(() => { parkedSig = ''; try { updateParked(); } catch {} });   // истинските влакове (Sketchfab) — щом се заредят, гарата се пречертава
const stationLv = () => S.stationLevel || 0;
const homeTrains = () => (S.trains || []).filter(t => !t.job && t.at === S.cityId);
function buildStation() {
  if (S.stationLevel == null) S.stationLevel = (S.trains || []).length ? Math.min(5, Math.max(1, S.trains.length)) : 0;   // стари записи
  station = createStation({ group: city.group, model, instanced, label, x: STATION_X, path: trackMap });
  station.build(stationLv(), S.stationBuild ? S.stationBuild.target : null);
  parkedSig = '';
  refreshPassing();
}
function refreshPassing() {
  if (passing) passing.clear();
  passing = createPassingTrains({ scene, group: city.group, model, instanced, x: STATION_X, trackX: station.outerX(), path: trackMap, horn: () => Sound.play('horn'), orient: () => S?.orient?.st === 'done' });
}
// влаковете у дома стоят на коловозите; обновява се само при промяна
function updateParked() {
  if (!station) return;
  const ht = homeTrains(), sig = ht.map(t => t.id + ':' + trainWagons(t) + (t.kind || '')).join(',') + '|' + stationLv();
  if (sig === parkedSig) return;
  parkedSig = sig;
  station.setParked(ht.map(t => ({ id: t.id, nm: t.nm, wagons: trainWagons(t), pax: !!trainType(t).pax, express: !!trainType(t).express })));
}
function startStationUpgrade() {
  const lv = stationLv();
  if (lv >= 5 || S.stationBuild) return;
  const L = STATION_LEVELS[lv];
  if (!econ.canAfford(L.cost)) { toast('Нямаш достатъчно пари за гарата.', 'bad'); return; }
  econ.spend(L.cost, 'покупка', `Гара: строеж на ниво ${lv + 1}`);
  S.stationBuild = { target: lv + 1, prog: 0 };
  station.build(lv, lv + 1);
  parkedSig = '';
  toast(`🚉 Започна строежът: ${L.nm} (${L.days} дни).`, 'good');
  save(); renderPanel();
}
function updateStationBuild(dtDays) {
  const b = S.stationBuild;
  if (!b) return;
  b.prog += dtDays / STATION_LEVELS[b.target - 1].days;
  if (b.prog < 1) return;
  S.stationLevel = b.target; S.stationBuild = null;
  station.build(S.stationLevel);
  parkedSig = '';
  refreshPassing();
  SFXcash();
  toast(`🚉 Гарата е готова: ${STATION_LEVELS[S.stationLevel - 1].nm} с ${S.stationLevel} ${S.stationLevel === 1 ? 'коловоз' : 'коловоза'}. Побира ${S.stationLevel} ${S.stationLevel === 1 ? 'влак' : 'влака'}.`, 'good');
  save(); renderPanel();
}
// ---------- нов квартал: градът расте на изток с колона от 9 празни парцела
const districtCost = () => Math.round(80000 * Math.pow(1.6, S.cityExt || 0) * (megaBase ? 18 : 1) / 1000) * 1000;
const freeLotCount = () => city.lots.filter(l => !l.built && !l.busy).length;

// ============================================================ завършен град и продажба на филиал
const sumCost = (arr, lv) => arr.slice(0, Math.max(0, lv - 1)).reduce((a, l) => a + (l.cost || 0), 0);
// вложеното в града (офис, гараж, склад, гара) + техника + имоти — за оценка при продажба
function cityAssets() {
  const st = sumCost(OFFICE_LEVELS, S.officeLevel || 1) + sumCost(GARAGE_LEVELS, S.garageLevel || 1) + sumCost(WH_LEVELS, (S.whLevel || 0) + 1)
    + STATION_LEVELS.slice(0, S.stationLevel || 0).reduce((a, l) => a + (l.cost || 0), 0);
  const fleet = units.reduce((a, u) => a + (econ.sellPrice ? econ.sellPrice(u.type) : 0), 0);
  const estate = (est().owned || []).reduce((a, o) => a + (o.value || 0), 0);
  const paid = ((S.branchPaid || {})[S.cityId]) ?? (S.cityId !== S.hqCity ? ECON.BRANCH_COST(S.cityId, 0) : 0);   // старите филиали — по днешна цена
  return Math.round(st * 0.5 + fleet + estate + paid * 0.5);
}
const canFinishCity = () => econ.finishCity && !econ.isFinished(S.cityId) && (S.cityExt || 0) >= extNeed() && freeLotCount() <= 1 && rivals.share() >= 0.6;
function finishCityCard() {
  if (!econ.finishCity) return '';
  if (econ.isFinished(S.cityId)) {
    const f = econ.s.finished[S.cityId], mul = econ.maintOf ? econ.maintOf({ fleet: units.map(u => u.type) }) : 1, upk = units.reduce((a, u) => a + (ECON.UNIT_TYPES[u.type]?.upkeep || 0), 0);
    return `<div class="card"><h3><span class="ico">🏁</span>Градът е завършен</h3><div class="meta">Носи автоматично ~${fmt(Math.round(f.daily * mul))} €/ден, и докато си тук (спечелено ${fmt(f.earned || 0)} €).</div>
      <div class="meta">🔧 Поддръжка: ${units.length ? `<b style="color:var(--txt)">${units.length} единици</b> · приход ×${mul.toFixed(2)} · <span class="late">−${fmt(upk)} €/ден</span>` : '<span class="late">няма техника — приход ×0.7 и конкурентите бавно взимат дял</span>'}</div>
      ${units.length && ownedCities().length > 1 ? '<div class="row" style="justify-content:flex-end"><button class="btn2" id="bMoveFleet">🚚 Премести техниката</button></div>' : ''}</div>`;
  }
  const ok = canFinishCity(), sh = Math.round(rivals.share() * 100);
  return `<div class="card"><h3><span class="ico">🏁</span>Завърши града</h3>
    <div class="meta">Когато градът е напълно застроен, обявяваш го за завършен: той работи сам и ти носи пари всеки ден, а ти продължаваш в друг град.</div>
    <div class="meta">${(S.cityExt || 0) >= extNeed() ? '✅' : '⬜'} Нови квартали: ${Math.min(S.cityExt || 0, extNeed())}/${extNeed()}<br>${freeLotCount() <= 1 ? '✅' : '⬜'} Свободни парцели ≤ 1 (сега ${freeLotCount()})<br>${sh >= 60 ? '✅' : '⬜'} Твой дял от пазара ≥ 60% (сега ${sh}%)</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="bFinishCity" ${ok ? '' : 'disabled'}>🏁 Завърши града</button></div></div>`;
}
function finishCity() {
  if (!canFinishCity()) return;
  const share = rivals.share(), stats = { built: S.built.length, owned: est().owned.length, day: S.day };
  const r = econ.finishCity(S.cityId, share, stats);
  S.finishedCount = (S.finishedCount || 0) + 1; S.branchDiscounts = (S.branchDiscounts || 0) + 1;
  showEventPop('city-done', `🏁 ${cityName()} е завършен!`, `${stats.built} сгради · дял ${Math.round(share * 100)}% · носи ~${fmt(r.daily)} €/ден, докато си другаде. Следващият филиал е −30%.`);
  Sound.play('levelup');
  quests.emit('cityDone');
  syncFinishedFleet();   // техниката остава в града за поддръжка; преместването е по избор от картата „Градът е завършен“
  save(); renderPanel();
}
// техниката от завършения град може да се премести в друг твой град (транспорт ~10% от цената)
// ============================================================ 🚜 Глобален гараж: цялата техника по градове на едно място
// Техниката си остава в своя град (обектите там я ползват), но се вижда, купува и мести от един прозорец.
// Преместването отнема дни по пътя (S.fleetTransit) и струва 10% от цената на машината за транспорт.
const GAR_TYPES = () => Object.keys(ECON.UNIT_TYPES);
const garCity = id => id === S.cityId ? S : (S.cities || {})[id] || {};
const garHave = id => { const o = {}; for (const t of cityUnitTypes(id)) o[t] = (o[t] || 0) + 1; return o; };
const garIdle = id => { if (id !== S.cityId) return garHave(id); const o = {}; for (const u of units) if (!u.proj) o[u.type] = (o[u.type] || 0) + 1; return o; };
// нужна техника: текущите етапи на обектите в града + участъците от магистрали/аутобани, които се строят оттам
function garNeed(id) {
  const o = {}, add = (k, n) => { o[k] = (o[k] || 0) + n; };
  const ps = id === S.cityId ? projects : (garCity(id).projects || []);
  for (const p of ps) { const st = BTYPES[p.type]?.stages[p.stage]; if (st) for (const [k, n] of Object.entries(st.need)) add(k, n); }
  for (const j of S.hwJobs || []) if (hwCityOf(j) === id) for (const [k, n] of Object.entries(hwNeed(j))) o[k] = Math.max(o[k] || 0, n);
  return o;
}
const garCaps = id => { const c = garCity(id); return { crews: OFFICE_LEVELS[(c.officeLevel || 1) - 1].crews, mach: GARAGE_LEVELS[(c.garageLevel || 1) - 1].cap }; };
const garTransit = to => (S.fleetTransit || []).filter(m => !to || m.to === to);
const garDays = (a, b) => Math.max(1, Math.ceil(kmBetween(a, b) / 450));
// мести n машини от тип t: from → to (от текущия град — само свободните, с опита им)
function garMove(t, from, to, n = 1, silent = false) {
  if (from === to) return 0;
  const T = ECON.UNIT_TYPES[t]; let moved = 0;
  for (let i = 0; i < n; i++) {
    const fee = Math.round(T.cost * 0.1 / 100) * 100;
    if (!econ.canAfford(fee)) { if (!silent) toast('Нямаш пари за транспорта.', 'bad'); break; }
    let xp = 0;
    if (from === S.cityId) {
      const u = units.find(q => q.type === t && !q.proj); if (!u) break;
      xp = u.xp || 0; scene.remove(u.obj); units.splice(units.indexOf(u), 1); syncUnits(); refreshGarageLabel();
    } else {
      const c = garCity(from), k = (c.units || []).indexOf(t); if (k < 0) break;
      c.units.splice(k, 1); xp = (c.unitXp || []).splice(k, 1)[0] || 0;
    }
    econ.spend(fee, 'покупка', `Транспорт: ${T.nm} ${cityById(from).nm} → ${cityById(to).nm}`);
    (S.fleetTransit = S.fleetTransit || []).push({ t, xp, from, to, arrive: S.day + garDays(from, to) });
    moved++;
  }
  if (moved && !silent) { toast(`🚚 ${T.ico} ${T.nm}${moved > 1 ? ' ×' + moved : ''}: ${cityById(from).nm} → ${cityById(to).nm} · пристига след ${garDays(from, to)} дни.`, 'good'); save(); }
  return moved;
}
// пристигане (веднъж на ден): в текущия град — нова машина на терена, в друг — в записа му
function garArrive() {
  const now = garTransit().filter(m => m.arrive <= S.day); if (!now.length) return;
  S.fleetTransit = garTransit().filter(m => m.arrive > S.day);
  for (const m of now) {
    if (m.to === S.cityId) { S.units.push(m.t); const u = spawnUnit(m.t); u.xp = m.xp; syncUnits(); }
    else { const c = S.cities[m.to]; if (!c) continue; c.units = [...(c.units || []), m.t]; c.unitXp = [...(c.unitXp || []), m.xp]; }
  }
  refreshGarageLabel(); dispatch();
  const by = {}; for (const m of now) by[m.to] = (by[m.to] || 0) + 1;
  toast(`🚚 Пристигна техника: ${Object.entries(by).map(([id, n]) => `${cityById(id).nm} +${n}`).join(', ')}`, 'good', () => openBig('garage'));
}
// купува направо за друг град (без да влизаш в него)
function garBuy(t, id) {
  if (id === S.cityId) return buyUnit(t);
  const T = ECON.UNIT_TYPES[t], cap = garCaps(id), have = cityUnitTypes(id);
  if (!isMachine(t) && have.filter(x => !isMachine(x)).length >= cap.crews) { toast(`👷 Офисът в ${cityById(id).nm} поема до ${cap.crews} бригади.`, 'bad'); return; }
  if (isMachine(t) && !isRoadGear(t) && have.filter(x => isMachine(x) && !isRoadGear(x)).length >= cap.mach) { toast(`🔧 Гаражът в ${cityById(id).nm} е пълен (${cap.mach}).`, 'bad'); return; }
  if (!econ.buyUnit(t)) { toast('Нямаш достатъчно пари.', 'bad'); return; }
  const c = S.cities[id]; c.units = [...(c.units || []), t]; c.unitXp = [...(c.unitXp || []), 0];
  toast(`${T.ico} Купи ${T.nm.toLowerCase()} за ${cityById(id).nm}.`, 'good'); quests.emit('buy', { type: t }); save();
}
// автоматично разпределение: излишното (свободно и ненужно) отива там, където липсва
function garPlan() {
  const ids = ownedCities(), plan = [];
  const need = Object.fromEntries(ids.map(id => [id, garNeed(id)])), have = Object.fromEntries(ids.map(id => [id, garHave(id)])), idle = Object.fromEntries(ids.map(id => [id, garIdle(id)]));
  for (const m of garTransit()) have[m.to] && (have[m.to][m.t] = (have[m.to][m.t] || 0) + 1);
  for (const t of GAR_TYPES()) {
    const def = ids.map(id => [id, (need[id][t] || 0) - (have[id][t] || 0)]).filter(([, d]) => d > 0);
    const sur = ids.map(id => [id, Math.min(idle[id][t] || 0, (have[id][t] || 0) - (need[id][t] || 0))]).filter(([, d]) => d > 0);
    for (const dd of def) for (const ss of sur) { if (dd[1] <= 0) break; const n = Math.min(dd[1], ss[1]); if (n > 0) { plan.push({ t, from: ss[0], to: dd[0], n }); dd[1] -= n; ss[1] -= n; } }
  }
  return plan;
}
function garAuto() {
  const plan = garPlan(); if (!plan.length) { toast('⚖️ Няма какво да се разпредели — няма излишна техника там, където другаде липсва.', ''); return; }
  let n = 0; for (const m of plan) n += garMove(m.t, m.from, m.to, m.n, true);
  toast(`⚖️ Тръгнаха ${n} машини към градовете, където липсват.`, 'good'); save();
}
const garIco = t => ECON.UNIT_TYPES[t].ico;
function garageWinHtml() {
  const ids = ownedCities(), types = GAR_TYPES().filter(t => ids.some(id => (garHave(id)[t] || garNeed(id)[t])) || !ECON.UNIT_TYPES[t].road);
  const all = ids.reduce((a, id) => a + cityUnitTypes(id).length, 0), tr = garTransit(), plan = garPlan();
  const lackCities = ids.filter(id => Object.entries(garNeed(id)).some(([t, n]) => (garHave(id)[t] || 0) < n)).length;
  let h = `<div class="bw-stats"><div><b>${all}</b><span>машини и бригади</span></div><div><b>${ids.length}</b><span>града</span></div><div><b style="color:${lackCities ? 'var(--bad)' : 'var(--ok)'}">${lackCities}</b><span>града с липси</span></div><div><b>${tr.length}</b><span>на път</span></div></div>`;
  h += `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0;flex-shrink:0"><span class="meta" style="margin:0;flex:1 1 300px">🔴 липсва за обектите · 🟡 свободна и ненужна · транспорт 10% от цената, ~1 ден на 450 км</span><button class="btn" id="garAuto" style="flex:0 0 auto" ${plan.length ? '' : 'disabled'}>⚖️ Разпредели автоматично${plan.length ? ` (${plan.reduce((a, m) => a + m.n, 0)})` : ''}</button></div>`;
  // таблица: градове × видове техника
  const th = types.map(t => `<th title="${ECON.UNIT_TYPES[t].nm}" style="padding:4px 6px">${garIco(t)}<div style="font-size:10px;color:var(--mut);font-weight:400">${ECON.UNIT_TYPES[t].nm.slice(0, 7)}</div></th>`).join('');
  const rows = ids.map(id => {
    const hv = garHave(id), nd = garNeed(id), idl = garIdle(id), cap = garCaps(id), inc = garTransit(id);
    const crews = hv.crew || 0, mach = cityUnitTypes(id).filter(x => isMachine(x) && !isRoadGear(x)).length;
    const cells = types.map(t => {
      const n = hv[t] || 0, need = nd[t] || 0, free = Math.min(idl[t] || 0, n - need), coming = inc.filter(m => m.t === t).length;
      const bg = n < need ? 'rgba(255,90,90,.22)' : free > 0 ? 'rgba(255,213,74,.16)' : '';
      return `<td style="text-align:center;padding:4px;background:${bg};border-radius:6px"><b>${n}</b>${need ? `<span style="color:var(--mut)">/${need}</span>` : ''}${coming ? `<div style="font-size:10px;color:#7dd3ff">+${coming} на път</div>` : ''}</td>`;
    }).join('');
    return `<tr style="border-top:1px solid var(--line)"><td style="padding:6px 4px;white-space:nowrap"><b>${cityById(id).nm}</b>${id === S.cityId ? ' 📍' : ''}<div style="font-size:11px;color:var(--mut)">👷 ${crews}/${cap.crews} · 🔧 ${mach}/${cap.mach}</div></td>${cells}<td><button class="btn2" data-garcity="${id}" style="padding:4px 8px">⋯</button></td></tr>`;
  }).join('');
  h += `<div class="card" style="overflow-x:auto;overflow-y:visible;flex-shrink:0;min-height:auto"><table style="width:100%;border-collapse:separate;border-spacing:2px;font-size:13px"><tr><th style="text-align:left">Град</th>${th}<th></th></tr>${rows}</table>
    <div class="meta" style="margin-top:6px">Във всяка клетка: колко имаш / колко трябват за обектите сега. „⋯“ — премести или купи за този град.</div></div>`;
  // избран град: местене и покупка
  if (garSel === undefined) garSel = S.cityId;
  if (garSel && ids.includes(garSel)) {
    const id = garSel, hv = garHave(id), idl = garIdle(id), nd = garNeed(id), others = ids.filter(x => x !== id);
    h += bwCard(`🏙️ ${cityById(id).nm} <span class="meta" style="margin:0 0 0 auto">${id === S.cityId ? 'тук си' : ''}</span>`,
      GAR_TYPES().filter(t => hv[t] || nd[t] || !ECON.UNIT_TYPES[t].road).map(t => {
        const T = ECON.UNIT_TYPES[t], can = idl[t] || 0;
        return `<div class="row" style="margin:4px 0;align-items:center;gap:6px"><span class="meta" style="margin:0;flex:1">${T.ico} <b style="color:var(--txt)">${T.nm}</b> · ${hv[t] || 0} бр.${nd[t] ? ` · нужни ${nd[t]}` : ''}${id === S.cityId && (hv[t] || 0) > can ? ` · ${(hv[t] || 0) - can} работят` : ''}</span>
          ${can && others.length ? `<select data-garto="${t}" style="max-width:130px">${others.map(o => `<option value="${o}">→ ${cityById(o).nm}${(garNeed(o)[t] || 0) > (garHave(o)[t] || 0) ? ' 🔴' : ''}</option>`).join('')}</select><button class="btn2" data-garmv="${t}">🚚 Премести</button>` : ''}
          <button class="btn" data-garbuy="${t}" ${econ.canAfford(T.cost) ? '' : 'disabled'}>+ ${fmt(T.cost)} €</button></div>`;
      }).join(''));
  }
  if (tr.length) h += bwCard('🚚 На път', tr.map(m => `<div class="meta" style="margin:2px 0">${garIco(m.t)} ${ECON.UNIT_TYPES[m.t].nm} · ${cityById(m.from).nm} → <b style="color:var(--txt)">${cityById(m.to).nm}</b> · пристига на ден ${m.arrive}</div>`).join(''));
  return h;
}
let garSel;   // undefined → текущият град; null → нищо не е избрано
// при влизане в град: кратко обобщение какво има, какво липсва и какво е излишно
function fleetBrief() {
  if (!S || ownedCities().length < 2) return;
  const id = S.cityId, hv = garHave(id), nd = garNeed(id), idl = garIdle(id);
  const lack = Object.entries(nd).filter(([t, n]) => (hv[t] || 0) < n).map(([t, n]) => `${garIco(t)}${n - (hv[t] || 0)}`);
  const extra = Object.entries(idl).map(([t, n]) => [t, Math.min(n, (hv[t] || 0) - (nd[t] || 0))]).filter(([, n]) => n > 0).map(([t, n]) => `${garIco(t)}${n}`);
  const all = Object.entries(hv).map(([t, n]) => `${garIco(t)}${n}`).join(' ');
  toast(`🚜 Техника в ${cityName()}: ${all || 'няма'}${lack.length ? ` · липсва: ${lack.join(' ')}` : ''}${extra.length ? ` · излишни: ${extra.join(' ')}` : ''} — отвори „Гараж“`, lack.length ? 'bad' : '', () => openBig('garage'));
}
function offerFleetMove() {
  const targets = ownedCities().filter(id => id !== S.cityId);
  if (!targets.length || !units.length) return;
  const fee = Math.round(units.reduce((a, u) => a + ECON.UNIT_TYPES[u.type].cost * 0.1, 0) / 100) * 100;
  modal('🚚 Премести техниката?', `${cityName()} вече работи сам. Можеш да преместиш цялата техника (${units.length} бр., с опита ѝ) в друг твой град за <b>${fmt(fee)} €</b> транспорт, вместо да я продаваш.<br><br><select id="mvTo">${targets.map(id => `<option value="${id}">${cityById(id).nm}</option>`).join('')}</select>`,
    [['Не', null], ['Премести', () => {
      const to = document.getElementById('mvTo').value;
      if (!econ.canAfford(fee)) { toast('Нямаш пари за транспорта.', 'bad'); return; }
      econ.spend(fee, 'покупка', `Транспорт на техника до ${cityById(to).nm}`);
      syncUnits();
      const c = S.cities[to]; c.units = [...(c.units || []), ...S.units]; c.unitXp = [...(c.unitXp || []), ...S.unitXp];
      for (const u of units) scene.remove(u.obj);
      units.length = 0; S.units = []; S.unitXp = [];
      toast(`🚚 Техниката пътува за ${cityById(to).nm}.`, 'good'); save(); renderPanel();
    }]]);
}
function sellBranchCard() {
  if (!econ.branchSalePrice || S.cityId === S.hqCity) return '';
  const f = econ.isFinished && econ.isFinished(S.cityId) ? econ.s.finished[S.cityId] : null;
  const price = econ.branchSalePrice({ assets: cityAssets(), dailyProfit: f ? f.daily : econ.cityAvgDaily(S.cityId) });
  return `<div class="card"><h3><span class="ico">💼</span>Продай филиала</h3><div class="meta">Купувач предлага <b style="color:var(--ok)">${fmt(price)} €</b> за целия филиал (сгради, техника, имоти и бизнеса му). След продажбата се връщаш в централата.</div>
    <div class="row" style="justify-content:flex-end"><button class="btn2" id="bSellBranch">Продай филиала</button></div></div>`;
}
function sellBranch() {
  const id = S.cityId, nm = cityName(), f = econ.isFinished && econ.isFinished(id) ? econ.s.finished[id] : null;
  const price = econ.branchSalePrice({ assets: cityAssets(), dailyProfit: f ? f.daily : econ.cityAvgDaily(id) });
  modal(`💼 Продай филиала в ${nm}?`, `Получаваш <b>${fmt(price)} €</b>. Сградите, техниката, имотите и складът остават на купувача. Влаковете ти, които са тук, се връщат в централата. <b>Не може да се върне.</b>`,
    [['Отказ', null], ['Продай', () => {
      econ.sellBranch(id, price, nm);
      for (const t of S.trains || []) { if (t.at === id) { t.at = S.hqCity; t.job = null; t.path = null; t.leg = 'idle'; } if (t.route && (t.route.a === id || t.route.b === id)) delete t.route; }
      S.branches = (S.branches || []).filter(x => x !== id);
      // връщане в централата, без да се пази продаденият град
      const c = S.cities[S.hqCity]; delete S.cities[S.hqCity];
      if (econ.loadStock) econ.loadStock(c.mat || { stock: {}, transit: [] }); delete c.mat;
      for (const k of CITY_KEYS) S[k] = c[k];
      S.cityId = S.hqCity; S.ffFrom = c.left ?? null;
      projects.length = 0; projects.push(...(S.projects || [])); S.projects = projects;
      Sound.play('cash'); save(); sessionStorage.setItem('stroiEnter', '1'); location.reload();
    }]]);
}
function buyDistrict() {
  if ((S.cityExt || 0) >= MAX_EXT) return;
  const cost = districtCost();
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за новия квартал.', 'bad'); return; }
  econ.spend(cost, 'покупка', `Нов квартал №${(S.cityExt || 0) + 1}`);
  S.cityExt = (S.cityExt || 0) + 1;
  save();
  // градът се построява наново от записа (парцелите и пътищата се смятат при зареждане)
  toast('🏙️ Купи земя за нов квартал! Градът се разширява…', 'good');
  // след презареждането — пак в града, на таб „Офис“ (не на картата)
  try { sessionStorage.setItem('stroiEnter', '1'); sessionStorage.setItem('stroiTab', tab || 'hq'); } catch {}
  if (!AUTOTEST) setTimeout(() => location.reload(), 600);
}
function districtCard() {
  const ext = S.cityExt || 0, cost = districtCost(), free = freeLotCount();
  let h = `<div class="card"><h3><span class="ico">🏙️</span>Нов квартал · ${ext}/${MAX_EXT}</h3>
    <div class="meta">Свободни парцели в града: <b style="color:${free < 4 ? 'var(--bad)' : 'var(--txt)'}">${free}</b>. Нов квартал на изток дава ${NB * extCols()} празни парцела за поръчки, склад и гараж${megaBase ? ' — мегаполис: голям квартал' : ''}.</div>`;
  if (ext < MAX_EXT) h += `<div class="row"><span class="money" style="color:var(--txt)">${fmt(cost)} €</span><button class="btn" id="bDistrict" ${econ.canAfford(cost) ? '' : 'disabled'}>Купи земята</button></div>`;
  else h += `<div class="meta" style="color:var(--acc)">👑 Градът е разширен докрай.</div>`;
  return h + `</div>`;
}
// карта „Гара“ в таб „Офис“
// влаковете се купуват само от прозореца „🚆 ЖП“; тук — само бутон към него
function stationCardShop() { return stationLv() ? `<div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn2" data-openrail="1">${trainImg('mid', 18)} Влакове — в прозореца ЖП</button></div>` : ''; }
// гарите във всички твои градове (за напомняне да се развият до 5)
function stationsOverview() {
  const rows = ownedCities().map(id => ({ id, lv: id === S.cityId ? (S.stationLevel || 0) : ((S.cities || {})[id]?.stationLevel || 0) }));
  const weak = rows.filter(r => r.lv < 5);
  if (!weak.length) return '';
  return `<div class="meta" style="margin-top:6px">🚉 Гари: ${rows.map(r => `${cityById(r.id).nm} ${r.lv}/5`).join(' · ')}<br>${(S.trains || []).length >= totalTracks() ? '<b style="color:var(--acc)">Влаковете са на лимита</b> — ' : ''}развий ${weak.map(r => cityById(r.id).nm).join(', ')} до гара ниво 5 за още влакове.</div>`;
}
function stationCard() {
  const lv = stationLv(), L = lv ? STATION_LEVELS[lv - 1] : { nm: 'Няма гара' }, nx = STATION_LEVELS[lv], b = S.stationBuild;
  let h = `<div class="card"><h3><span class="ico">🚉</span>Гара · ниво ${lv}/5</h3>
    <div class="meta"><b style="color:var(--txt)">${L.nm}</b>${lv ? ` · ${lv} ${lv === 1 ? 'коловоз' : 'коловоза'}` : ' · влаковете нямат къде да стоят'}</div>
    <div class="stages">${STATION_LEVELS.map((_, i) => `<span class="${i < lv ? 'done' : ''}"></span>`).join('')}</div>
    <div class="meta">🚆 Влакове на фирмата: ${(S.trains || []).length}/${totalTracks()} (общо коловози във всичките ти гари) · тук: ${homeTrains().length}</div>`;
  if (b) h += `<div class="sect" style="margin-top:10px">🔨 Строи се ниво ${b.target}: ${STATION_LEVELS[b.target - 1].nm}</div>
      <div class="row" style="margin-top:4px"><span class="meta" style="margin:0">${STATION_LEVELS[b.target - 1].days} дни</span><span>${Math.round(b.prog * 100)}%</span></div>
      <div class="bar"><i style="width:${(b.prog * 100).toFixed(1)}%"></i></div>`;
  else if (nx) h += `<div class="sect" style="margin-top:10px">⬆️ Ниво ${lv + 1}: ${nx.nm}</div>
      <div class="meta">🛤️ Коловози: ${lv} → <b style="color:var(--ok)">${lv + 1}</b> · 🚆 +1 влак за фирмата<br>⏱️ Строеж: ${nx.days} дни</div>
      <div class="row"><span class="money" style="color:var(--txt)">${fmt(nx.cost)} €</span><button class="btn" id="bStation" ${econ.canAfford(nx.cost) ? '' : 'disabled'}>${lv ? 'Надгради' : 'Строй гара'}</button></div>`;
  else h += `<div class="meta" style="color:var(--acc)">👑 Максимално ниво!</div>`;
  return h + stationsOverview() + `</div>`;
}
function sendCityTrain(text) {
  if (cityTrain) return;
  const g = new THREE.Group();
  if (hasTrainModel('loco')) ['loco', 'hopper', 'flat', 'hopper', 'flat'].forEach((k, i) => g.add(trainCar(k, i * 3)));
  else ['train-locomotive-a', 'train-carriage-box', 'train-carriage-flatbed-wood', 'train-carriage-coal', 'train-carriage-container-red'].forEach((n, i) => { const m = model(n, 2.2); m.position.z = -i * 6.2; g.add(m); });
  placeCars(g, trackMap, STATION_X, -600, 1, 6.2, 0.3);
  scene.add(g);
  cityTrain = { g, z: -600, stop: 3, text };
  Sound.play('horn');
}
function updateCityTrain(dt) {
  if (!cityTrain) return;
  const t = cityTrain;
  if (t.z < 12 || t.stop <= 0) t.z += dt * (t.z < 12 ? Math.max(6, (12 - t.z) * 0.6) : 14 + Math.max(0, t.z - 12) * 0.25);
  else { t.stop -= dt; if (t.stop <= 2.9 && t.text) { toast(t.text, 'good'); t.text = null; } }
  placeCars(t.g, trackMap, STATION_X, t.z, 1, 6.2, 0.3);
  if (t.z > 640) { scene.remove(t.g); cityTrain = null; }
}

// ============================================================ Фаза 4: магистрали (държавни поръчки)
const HW_MAX_JOBS = () => 1 + Math.floor((S.officeLevel || 1) / 5);   // едновременни участъци
const allSegs = () => HIGHWAYS.flatMap(hw => hw.segs.map((s, i) => ({ id: segId(hw, i), hw, a: s[0], b: s[1] })));
const segOpen = sg => !sg.hw.intl || (S && dev.has('BALKANS'));
const ALL_AB = abSegs();
// пътни връзки (отклонения) за градове извън коридорите — напр. Рим: участък аутобан до най-близкия град от мрежата
const SPUR_HW = { id: '🔗', nm: 'Връзка към мрежата' };
function addSpurSeg(a, b) { const id = abSegId(a, b); if (!ALL_AB.some(x => x.id === id)) ALL_AB.push({ id, hw: SPUR_HW, a, b, ab: true, spur: true }); return id; }
function restoreSpurs() { for (const sp of (S && S.spurs) || []) addSpurSeg(sp.a, sp.b); }
const onAnySeg = id => [...allSegs(), ...ALL_AB].some(x => x.a === id || x.b === id);
// най-близкият град, към който има смисъл да се свърже: първо готов възел на мрежата, иначе град от коридор
function spurTarget(id) {
  const hubs = [...roadHubs()].filter(x => x !== id), core = [...new Set([...allSegs(), ...ALL_AB.filter(x => !x.spur)].flatMap(x => [x.a, x.b]))].filter(x => x !== id);
  const near = list => list.map(x => ({ x, km: kmBetween(id, x) })).sort((p, q) => p.km - q.km)[0];
  const h = near(hubs), c = near(core);
  return h && (!c || h.km <= c.km * 1.5) ? h : c;
}
function offerSpur(id) {
  if (!abUnlocked()) { toast(abLockTxt(), 'bad'); return; }
  // избор: най-близките градове (по-къс и по-евтин участък) + възелът на мрежата (свързва веднага с магистралите)
  const hub = spurTarget(id), unlocked = c => dev.best() >= cityLv(c.id) && c.id !== id && !hasAbSeg(id, c.id);
  const near = CITIES.filter(unlocked).map(c => ({ x: c.id, km: kmBetween(id, c.id) })).sort((p, q) => p.km - q.km).slice(0, 3);
  if (hub && !near.some(n => n.x === hub.x)) near.push(hub);
  if (!near.length) { toast('Няма към какво да се свърже.', 'bad'); return; }
  const hubs = roadHubs(), lbl = n => `${cityById(n.x).nm} · ${n.km} км · ${abQuote(n.km).days} д.${hubs.has(n.x) ? ' 🔗 в мрежата' : ''}`;
  modal(`🔗 Пътна връзка за ${cityById(id).nm}`, `${cityById(id).nm} не е на коридор — строиш собствен участък (аутобан) до избран град. Най-близкият е най-бърз и евтин; ако е <b>🔗 в мрежата</b>, градът веднага се включва в магистралите. Държавата плаща при предаването, а после можеш да продължиш с още участъци.`,
    [['Отказ', null], ...near.map(n => [`🏗️ ${lbl(n)}`, () => { S.spurs = [...(S.spurs || []).filter(x => abSegId(x.a, x.b) !== abSegId(id, n.x)), { a: id, b: n.x }]; const sid = addSpurSeg(id, n.x); takeAutobahn(sid); openBig('hw'); }])]);
}
const hasAbSeg = (a, b) => ALL_AB.some(x => x.id === abSegId(a, b)) && hwDone().includes(abSegId(a, b));
const segById = id => allSegs().find(s => s.id === id) || (String(id).startsWith('ab:') ? ALL_AB.find(s => s.id === id) : null);
// ---- Фаза 9: аутобани (международни коридори) — работят през същите държавни поръчки (S.hwJobs с j.ab)
const abStages = () => AB?.AB_STAGES || AB_STAGES_DEF;
const stagesOf = j => j.ab ? abStages() : HW_STAGES;
const AB_K = () => ({ cost: AB?.AB_COST_MUL ?? 2.5, toll: AB?.AB_TOLL_MUL ?? 3, full: AB?.AB_FULL_BONUS ?? 0.5 });
const bgFullHighways = () => HIGHWAYS.filter(hw => !hw.intl && hw.segs.every((_, i) => hwDone().includes(segId(hw, i)))).length;
const abUnlocked = () => !!S && dev.best() >= AB_UNLOCK.lv && bgFullHighways() >= AB_UNLOCK.bgFull;
const abLockTxt = () => `🔒 Аутобаните се отключват на ниво ${AB_UNLOCK.lv} на развитие (сега ${dev.best()}) и с ${AB_UNLOCK.bgFull} изцяло завършени български магистрали (сега ${bgFullHighways()}).`;
function abQuote(km) {
  const q = segmentQuote(km), k = AB_K();
  return { ...q, reward: Math.round(q.reward * k.cost / 5000) * 5000, days: Math.min(90, Math.max(10, Math.round(q.days * 1.4))),
    mats: [q.mats[0], { steel: Math.round(km * 2), concrete: Math.round(km * 12) }, q.mats[1], q.mats[2], q.mats[3]] };
}
function abTollOf(c, extra = null) {
  const ids = corridorSegIds(c), done = ids.filter(id => hwDone().includes(id) || id === extra);
  if (!done.length) return 0;
  const km = done.reduce((a, id) => { const sg = segById(id); return a + kmBetween(sg.a, sg.b); }, 0);
  return Math.round(km * TOLL_PER_KM_DAY * AB_K().toll * (done.length === ids.length ? 1 + AB_K().full : 1));
}
const abToll = () => AUTOBAHNS.reduce((a, c) => a + abTollOf(c), 0);
const abTollGain = sg => AUTOBAHNS.reduce((a, c) => a + abTollOf(c, sg.id) - abTollOf(c), 0);
const abFleet = () => abStages().reduce((o, st) => { for (const [k, n] of Object.entries(st.need)) o[k] = Math.max(o[k] || 0, n); return o; }, {});
const abMissingTxt = () => { const m = Object.entries(abFleet()).map(([k, n]) => [k, n - units.filter(u => u.type === k).length]).filter(([, d]) => d > 0); return m.length ? `Нямаш: ${m.map(([k, d]) => `${ECON.UNIT_TYPES[k]?.ico || ''} ${ECON.UNIT_TYPES[k]?.nm || k}${d > 1 ? ' ×' + d : ''}`).join(', ')}` : ''; };
// аутобанът се строи само като продължение на съществуваща пътна мрежа: единият край трябва да е
// град с готов участък от магистрала или аутобан (не може участък „в нищото“)
const roadHubs = () => new Set([...allSegs(), ...ALL_AB].filter(s => hwDone().includes(s.id)).flatMap(s => [s.a, s.b]));
const abReach = sg => { const h = roadHubs(); return h.has(sg.a) || h.has(sg.b) || (sg.cont && (ownedCities().includes(sg.a) || ownedCities().includes(sg.b))); };
const abShown = c => !c.cont || contByKey(c.cont).open();
function takeAutobahn(id) {
  if (!abUnlocked()) { toast(abLockTxt(), 'bad'); return; }
  if (!hwRepOk()) { toast(`Държавните поръчки изискват репутация ${HW_REP} ★ или ниво 5 на развитие (голяма фирма).`, 'bad'); return; }
  if ((S.hwJobs || []).length >= HW_MAX_JOBS()) { toast('Вече строиш максимума участъци. Надгради офиса за повече.', 'bad'); return; }
  const sg = segById(id); if (!sg || hwDone().includes(id) || (S.hwJobs || []).some(j => j.seg === id)) return;
  if (!abReach(sg) && !sg.spur) { toast(`🛣️ ${cityById(sg.a).nm} — ${cityById(sg.b).nm}: аутобанът продължава съществуваща магистрала — първо стигни с готов участък до ${cityById(sg.a).nm} или ${cityById(sg.b).nm}.`, 'bad'); return; }
  const km = kmBetween(sg.a, sg.b);
  S.hwJobs = [...(S.hwJobs || []), { seg: id, ab: true, km, ...abQuote(km), stage: 0, prog: 0, mat: {}, start: S.day, v2: true, city: S.cityId }];
  toast(`🔴 Взе участък от аутобан „${sg.hw.nm}“: ${cityById(sg.a).nm} — ${cityById(sg.b).nm} (${km} км).`, 'good');
  const miss = abMissingTxt(); if (miss) toast(`🚜 ${miss} — участъкът ще чака пътната техника (таб „Техника“).`, 'bad');
  Sound.play('buy');
  hwDispatch(); save(); renderMapHud(); drawMap();
}
function finishAutobahn(j) {
  for (const u of units) if (u.proj === j) { u.obj.visible = true; releaseUnit(u); }
  S.hwJobs.splice(S.hwJobs.indexOf(j), 1);
  const gain = abTollGain(segById(j.seg));
  S.hwDone = [...hwDone(), j.seg]; setTimeout(hwQueueTick, 0);   // свободен екип → следващият от опашката
  dev.add(dev.XP.highway * 2);
  setTimeout(() => supply.tryDeliver(), 0);
  const sg = segById(j.seg), names = AUTOBAHNS.filter(c => corridorSegIds(c).includes(j.seg)).map(c => `„${c.nm}“`).join(', ');
  econ.earn(j.reward, 'обект', `Аутобан ${cityById(sg.a).nm} — ${cityById(sg.b).nm}`);
  S.rep = Math.min(5, S.rep + 0.5);
  Sound.play('done');
  showEventPop('ab-done', `🔴 Аутобан ${names}: ${cityById(sg.a).nm} — ${cityById(sg.b).nm}`, `+${fmt(j.reward)} € · тол +${fmt(gain)} €/ден.`);
  toast(`🔴 Участъкът ${cityById(sg.a).nm} — ${cityById(sg.b).nm} от аутобан ${names} е открит! +${fmt(j.reward)} € · тол +${fmt(gain)} €/ден.`, 'good');
  save(); drawMap();
}
// аутобаните на картата: червени и по-дебели от магистралите
function abSvg() {
  if (!S) return '';
  const on = abUnlocked(), jobs = Object.fromEntries((S.hwJobs || []).filter(j => j.ab).map(j => [j.seg, j])), w = (mapEU ? 4 : mapWide ? 1.6 : 1) * mapK();
  let h = '';
  for (const sg of ALL_AB) {
    if (sg.cont && !contByKey(sg.cont).open()) continue;
    const A1 = cityById(sg.a), B1 = cityById(sg.b); if (!A1 || !B1) continue;
    const [x1, y1] = proj(A1.lon, A1.lat), [x2, y2] = proj(B1.lon, B1.lat), done = hwDone().includes(sg.id), j = jobs[sg.id], via = viaOf(sg.a, sg.b);
    if (via) {   // начупено трасе (по брега и т.н.)
      const pts = [[x1, y1], ...via.map(([lo, la]) => proj(lo, la)), [x2, y2]], P = a => a.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ');
      const k = j ? (j.stage + j.prog) / abStages().length : 0, [lx, ly] = ptAlong(pts, 0.5);
      if (done) h += `<polyline points="${P(pts)}" fill="none" stroke="#c62828" stroke-width="${5.5 * w}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(pts)}" fill="none" stroke="#fff" stroke-width="${1 * w}" stroke-dasharray="${3 * w} ${3 * w}"/>`;
      else if (j) h += `<polyline points="${P(pts)}" fill="none" stroke="#ef9a9a" stroke-width="${4 * w}" stroke-dasharray="${4 * w} ${3 * w}"/><polyline points="${P(donePts(pts, k))}" fill="none" stroke="#c62828" stroke-width="${5.5 * w}" stroke-linecap="round" stroke-linejoin="round"/><text x="${lx}" y="${ly - 6 * w}" font-size="${9 * w}" font-weight="800" fill="#8e0000" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${2.5 * w}">🔴 ${Math.floor(k * 100)}%</text>`;
      else if (on) h += `<polyline points="${P(pts)}" fill="none" stroke="#e53935" stroke-width="${2.2 * w}" stroke-dasharray="${2 * w} ${3 * w}" opacity=".7"/>`;
      continue;
    }
    if (done) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#c62828" stroke-width="${5.5 * w}" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="${1 * w}" stroke-dasharray="${3 * w} ${3 * w}"/>`;
    else if (j) {
      const k = (j.stage + j.prog) / abStages().length;
      h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ef9a9a" stroke-width="${4 * w}" stroke-dasharray="${4 * w} ${3 * w}"/><line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" stroke="#c62828" stroke-width="${5.5 * w}"/>`;
      h += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6 * w}" font-size="${9 * w}" font-weight="800" fill="#8e0000" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${2.5 * w}">🔴 ${Math.floor(k * 100)}%</text>`;
    } else if (on) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e53935" stroke-width="${2.2 * w}" stroke-dasharray="${2 * w} ${3 * w}" opacity=".7"/>`;
  }
  return h;
}
const hwDone = () => (S && S.hwDone) || [];
// градове, свързани с централата по готови магистрали (за по-евтин превоз с камиони)
function hwNetwork() {
  const done = [...allSegs(), ...ALL_AB].filter(s => hwDone().includes(s.id));
  const out = new Set([S.cityId]), q = [S.cityId];
  while (q.length) { const c = q.shift(); for (const s of done) { const n = s.a === c ? s.b : s.b === c ? s.a : null; if (n && !out.has(n)) { out.add(n); q.push(n); } } }
  return [...out];
}
// градове, до които пътят минава поне по един готов участък от аутобан (отстъпка ECON.AB_DISCOUNT)
function abNetwork() {
  const edges = [...allSegs(), ...ALL_AB].filter(s => hwDone().includes(s.id));
  const seen = new Set([S.cityId + '|0']), q = [[S.cityId, 0]], out = new Set();
  while (q.length) {
    const [c, f] = q.shift();
    for (const s of edges) {
      const n = s.a === c ? s.b : s.b === c ? s.a : null; if (!n) continue;
      const nf = f || (s.ab ? 1 : 0), k = n + '|' + nf;
      if (seen.has(k)) continue; seen.add(k); q.push([n, nf]);
      if (nf && n !== S.cityId) out.add(n);
    }
  }
  return [...out];
}
const wonCityIds = () => econ ? wonCountries(x => econ.isFinished(x)).flatMap(k => k.cities) : [];
const accessIds = kind => S && S.roadAccess && S.roadAccess[S.cityId] === kind ? (ECON.FACTORIES || []).map(f => f.cityId) : [];   // общинско включване в пътната мрежа
const supplyOpts = () => ({ roadCityIds: [...hwNetwork().filter(id => id !== S.cityId), ...accessIds('road')], abCityIds: [...new Set([...abNetwork(), ...seaNetwork(), ...accessIds('ab')])], wonCityIds: wonCityIds() });
// налични участъци: незапочнати, по-близките до мрежата ти първи
function hwAvailable() {
  const busy = new Set([...hwDone(), ...(S.hwJobs || []).map(j => j.seg)]);
  const net = new Set([...network(), ...hwNetwork()]);
  return allSegs().filter(s => !busy.has(s.id) && segOpen(s))
    .map(s => ({ s, d: (net.has(s.a) || net.has(s.b)) ? 0 : Math.min(...[...net].map(c => Math.min(kmBetween(c, s.a), kmBetween(c, s.b)))) }))
    .sort((x, y) => x.d - y.d).slice(0, 6).map(o => o.s);
}
// ---- опашка от участъци: ако всички екипи са заети, участъкът чака и започва сам при първия свободен
const hwQueue = () => (S.hwQueue = S.hwQueue || []);
const hwFull = () => (S.hwJobs || []).length >= HW_MAX_JOBS();
function takeSeg(id) {   // магистрала или аутобан — с опашка
  const sg = segById(id); if (!sg || hwDone().includes(id) || (S.hwJobs || []).some(j => j.seg === id)) return;
  if (hwFull()) {
    if (hwQueue().includes(id)) { toast('Участъкът вече чака на опашката.', ''); return; }
    hwQueue().push(id);
    toast(`📋 ${cityById(sg.a).nm} — ${cityById(sg.b).nm} е на опашката (№ ${hwQueue().length}) — започва сам, щом се освободи екип.`, 'good');
    save(); return;
  }
  if (String(id).startsWith('ab:')) takeAutobahn(id); else takeHighway(id);
}
function hwQueueTick() {
  if (!S || !S.hwQueue || !S.hwQueue.length) return;
  while (S.hwQueue.length && !hwFull()) {
    const id = S.hwQueue.shift(), sg = segById(id);
    if (!sg || hwDone().includes(id) || (S.hwJobs || []).some(j => j.seg === id)) continue;
    toast(`📋➡️ Освободи се екип — започва ${cityById(sg.a).nm} — ${cityById(sg.b).nm} от опашката.`, 'good');
    if (id.startsWith('ab:')) takeAutobahn(id); else takeHighway(id);
  }
}
// бутонът „Строй участък“ в картата на града: взима най-подходящия участък до града (или го слага на опашка)
function roadOwn(id) {
  const busy = new Set([...(S.hwJobs || []).map(j => j.seg), ...hwQueue()]);
  const cands = [...allSegs(), ...ALL_AB].filter(x => (x.a === id || x.b === id) && !hwDone().includes(x.id) && (!x.cont || contByKey(x.cont)?.open()));
  if (cands.some(x => busy.has(x.id))) { openBig('hw'); return; }
  const hubs = roadHubs(), other = x => x.a === id ? x.b : x.a;
  const ok = cands.filter(x => !x.ab || abReach(x) || x.spur).sort((p, q) => (hubs.has(other(q)) - hubs.has(other(p))) || kmBetween(p.a, p.b) - kmBetween(q.a, q.b));
  if (!ok.length) { offerSpur(id); return; }
  takeSeg(ok[0].id); openBig('hw');
}
function takeHighway(id) {
  if (!dev.has('LINKS')) { toast('🔒 Магистралите се отключват на ниво 2 на развитие.', 'bad'); return; }
  if (!hwRepOk()) { toast(`Държавните поръчки изискват репутация ${HW_REP} ★ или ниво 5 на развитие (голяма фирма).`, 'bad'); return; }
  if ((S.hwJobs || []).length >= HW_MAX_JOBS()) { toast('Вече строиш максимума участъци. Надгради офиса за повече.', 'bad'); return; }
  const s = segById(id), km = kmBetween(s.a, s.b), q = segmentQuote(km);
  S.hwJobs = [...(S.hwJobs || []), { seg: id, km, ...q, stage: 0, prog: 0, mat: {}, start: S.day, v2: true, city: S.cityId }];
  toast(`🛣️ Взе държавна поръчка: АМ „${s.hw.nm}“, ${cityById(s.a).nm} — ${cityById(s.b).nm} (${km} км). Техниката тръгва към трасето.`, 'good');
  if (hwMissing().length) toast(`🚜 ${hwMissingTxt()} — участъкът ще чака пътната техника (таб „Техника“).`, 'bad');
  Sound.play('buy');
  hwDispatch(); buildCityHighway(); save(); renderMapHud(); drawMap();
}
// изход от града към трасето (южната пътна връзка)
// нуждите на етапа: участъци без j.v2 са започнати преди пътната техника
// държавни поръчки за магистрали: репутация 2★ — или голяма фирма (ниво 5+), която държавата познава и при спаднала репутация
const hwRepOk = () => !!S && (S.rep >= HW_REP || dev.best() >= 5);
const hwNeed = j => (j.ab ? abStages()[j.stage]?.need : j.v2 ? HW_STAGES[j.stage]?.need : HW_NEED_OLD[j.stage]) || {};
// каква пътна техника липсва в текущия град за цял участък
const hwMissing = () => Object.entries(HW_FLEET).map(([k, n]) => [k, n - units.filter(u => u.type === k).length]).filter(([, d]) => d > 0);
const hwMissingTxt = () => { const m = hwMissing(); return m.length ? `Нямаш: ${m.map(([k, d]) => `${ECON.UNIT_TYPES[k]?.ico || ''} ${ECON.UNIT_TYPES[k]?.nm || k}${d > 1 ? ' ×' + d : ''}`).join(', ')}` : ''; };
// градът, чиято техника строи участъка (старите поръчки — градът, в който си сега)
const hwCityOf = j => j.city || (j.city = S.cityId);
// техниката на друг (неактивен) град: типовете от записа му
const cityUnitTypes = id => id === S.cityId ? units.map(u => u.type) : ((S.cities || {})[id]?.units || []);
// какво липсва на участъка за текущия етап (празно = може да работи)
function hwLackOf(j) {
  const have = cityUnitTypes(hwCityOf(j));
  return Object.entries(hwNeed(j)).map(([k, n]) => [k, n - have.filter(t => t === k).length]).filter(([, d]) => d > 0);
}
// най-близкият твой град, чиято свободна техника (без заетата от другите участъци там) стига за текущия етап
function hwFreeLack(j, id) {
  const have = cityUnitTypes(id).slice();
  for (const o of S.hwJobs || []) if (o !== j && hwCityOf(o) === id) for (const [k, n] of Object.entries(hwNeed(o))) for (let i = 0; i < n; i++) { const p = have.indexOf(k); if (p >= 0) have.splice(p, 1); }
  return Object.entries(hwNeed(j)).map(([k, n]) => [k, n - have.filter(t => t === k).length]).filter(([, d]) => d > 0);
}
function hwNearestGear(j) {
  const sg = segById(j.seg); if (!sg) return null;
  const dist = id => Math.min(kmBetween(id, sg.a), kmBetween(id, sg.b)), cur = hwCityOf(j);
  const best = ownedCities().filter(id => id !== cur && !hwFreeLack(j, id).length).map(id => ({ id, km: dist(id) })).sort((a, b) => a.km - b.km)[0];
  // предлага се, ако сегашният град няма техниката или новият е по-близо до трасето
  return best && (hwLackOf(j).length || best.km < dist(cur)) ? best : null;
}
function hwMoveGear(seg, id) {
  const j = (S.hwJobs || []).find(x => x.seg === seg); if (!j) return;
  if (hwCityOf(j) === S.cityId) for (const u of units) if (u.proj === j) { u.obj.visible = true; releaseUnit(u); }   // техниката от този град се прибира
  j.city = id;
  const sg = segById(seg);
  toast(`🚜 Участъкът ${cityById(sg.a).nm} — ${cityById(sg.b).nm} вече се строи с техниката от ${cityById(id).nm}.`, 'good');
  hwDispatch(); save(); renderBig(); renderMapHud();
}
const lackTxt = l => l.map(([k, d]) => `${ECON.UNIT_TYPES[k]?.ico || ''} ${ECON.UNIT_TYPES[k]?.nm || k}${d > 1 ? ' ×' + d : ''}`).join(', ');
const hwExit = () => ({ x: tx(3 * Math.floor(NB / 2)), z: tx(N - 1) + 16 });
function hwDispatch() {
  for (const j of S.hwJobs || []) {
    const st = stagesOf(j)[j.stage]; if (!st) continue;
    if (hwCityOf(j) !== S.cityId) continue;   // строи го техниката на друг град
    const need = hwNeed(j);
    // екипът тръгва само наведнъж: ако не стига дори една роля, нищо не се изпраща (иначе блокира обектите в града)
    const freeOf = role => units.filter(u => u.type === role && !u.proj && (u.state === 'idle' || u.state === 'returning')).length;
    const lack = Object.entries(need).some(([role, cnt]) => units.filter(u => u.proj === j && u.type === role).length + freeOf(role) < cnt);
    if (lack) { j.lack = true; continue; }
    j.lack = false;
    for (const [role, cnt] of Object.entries(need)) {
      let have = units.filter(u => u.proj === j && u.type === role).length;
      while (have < cnt) {
        const free = units.find(u => u.type === role && !u.proj && (u.state === 'idle' || u.state === 'returning'));
        if (!free) break;
        free.proj = j; free.state = 'driving';
        const e = hwExit();
        sendTo(free, e.x + rand(-2, 2), e.z, () => { if (free.proj === j) { free.state = 'away'; free.obj.visible = false; } });
        free.state = 'driving';
        have++;
      }
    }
  }
}
function hwRoles(j) {
  if (hwCityOf(j) !== S.cityId) { const have = cityUnitTypes(j.city); return Object.entries(hwNeed(j)).map(([role, cnt]) => ({ role, cnt, away: Math.min(cnt, have.filter(t => t === role).length), coming: 0 })); }
  return Object.entries(hwNeed(j)).map(([role, cnt]) => ({ role, cnt, away: units.filter(u => u.proj === j && u.type === role && u.state === 'away').length, coming: units.filter(u => u.proj === j && u.type === role && u.state !== 'away').length }));
}
// материалите за етапа: купуват се наведнъж, когато цялата техника е на трасето
function hwMaterials(j) {
  if (j.mat[j.stage]) return true;
  const need = Object.entries(j.mats[j.stage] || {});
  const total = need.reduce((a, [m, q]) => a + econ.quoteMaterial(m, q, connected(), supplyOpts()).total, 0);
  if (!econ.canAfford(total)) { if (!j.warned) { j.warned = true; toast(`⚠️ Участъкът на АМ чака материали за ${fmt(total)} €.`, 'bad'); } return false; }
  for (const [m, q] of need) { econ.buyMaterial(m, q, connected(), supplyOpts()); econ.consume(m, q); }
  j.mat[j.stage] = true; j.warned = false;
  if (total) toast(`📦 Материали за магистралата: ${fmt(total)} €`);
  return true;
}
function updateHighways(dtDays) {
  for (const j of [...(S.hwJobs || [])]) {
    if (!hwRoles(j).every(r => r.away >= r.cnt) || !hwMaterials(j)) continue;
    j.prog += dtDays * stagesOf(j).length / j.days;
    if (j.prog < 1) continue;
    j.stage++; j.prog = 0;
    if (j.stage >= stagesOf(j).length) { j.ab ? finishAutobahn(j) : finishHighway(j); continue; }
    for (const u of units) if (u.proj === j && !hwNeed(j)[u.type]) { u.obj.visible = true; releaseUnit(u); }
    hwDispatch();
  }
}
function finishHighway(j) {
  for (const u of units) if (u.proj === j) { u.obj.visible = true; releaseUnit(u); }
  S.hwJobs.splice(S.hwJobs.indexOf(j), 1);
  S.hwDone = [...hwDone(), j.seg]; setTimeout(hwQueueTick, 0);   // свободен екип → следващият от опашката
  dev.add(dev.XP.highway);
  setTimeout(() => supply.tryDeliver(), 0);
  const s = segById(j.seg);
  econ.earn(j.reward, 'обект', `АМ „${s.hw.nm}“ ${cityById(s.a).nm} — ${cityById(s.b).nm}`);
  S.rep = Math.min(5, S.rep + 0.5);
  Sound.play('done');
  showEventPop('hw-open', `🛣️ АМ „${s.hw.nm}“: ${cityById(s.a).nm} — ${cityById(s.b).nm}`, `+${fmt(j.reward)} € · тол на АМ „${s.hw.nm}“ вече ${fmt(hwTollOf(s.hw))} €/ден.`);
  toast(`🛣️ Участъкът ${cityById(s.a).nm} — ${cityById(s.b).nm} на АМ „${s.hw.nm}“ е открит! +${fmt(j.reward)} € · тол на цялата магистрала: ${fmt(hwTollOf(s.hw))} €/ден.`, 'good');
  buildCityHighway(); save(); drawMap();
}
// ---- карта
function hwSvg() {
  const zs = zShrink();   // при приближаване линиите не дебелеят
  if (!S) return '';   // още няма фирма (избор на град)
  let h = '';
  const jobs = Object.fromEntries((S?.hwJobs || []).map(j => [j.seg, j]));
  const avail = new Set(S && hwRepOk() ? hwAvailable().map(s => s.id) : []);
  for (const s of allSegs()) {
    const A1 = cityById(s.a), B1 = cityById(s.b), [x1, y1] = proj(A1.lon, A1.lat), [x2, y2] = proj(B1.lon, B1.lat);
    const off = 3;   // магистралата е леко изместена от жп линията
    const nx = -(y2 - y1), ny = x2 - x1, l = Math.hypot(nx, ny) || 1, ox = nx / l * off, oy = ny / l * off;
    const X1 = x1 + ox, Y1 = y1 + oy, X2 = x2 + ox, Y2 = y2 + oy;
    if (hwDone().includes(s.id)) h += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#1e5fbf" stroke-width="${(4.2 * zs).toFixed(2)}" stroke-linecap="round"/><line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#ffffff" stroke-width="${(0.8 * zs).toFixed(2)}"/>`;
    else if (jobs[s.id]) {
      const j = jobs[s.id], k = (j.stage + j.prog) / HW_STAGES.length;
      h += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#8aa6cf" stroke-width="${(3 * zs).toFixed(2)}" stroke-dasharray="${(3 * zs).toFixed(2)} ${(2 * zs).toFixed(2)}"/><line x1="${X1}" y1="${Y1}" x2="${X1 + (X2 - X1) * k}" y2="${Y1 + (Y2 - Y1) * k}" stroke="#1e5fbf" stroke-width="${(4 * zs).toFixed(2)}"/>`;
      h += `<text x="${(X1 + X2) / 2}" y="${(Y1 + Y2) / 2 + 12}" font-size="9" font-weight="800" fill="#123f80" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${(2.5 * zs).toFixed(2)}">🛣️ ${Math.floor(k * 100)}%</text>`;
    } else if (avail.has(s.id)) h += `<line x1="${X1}" y1="${Y1}" x2="${X2}" y2="${Y2}" stroke="#4f86d6" stroke-width="${(2 * zs).toFixed(2)}" stroke-dasharray="${(1.5 * zs).toFixed(2)} ${(3 * zs).toFixed(2)}" opacity=".75"/>`;
  }
  // табелки с името на магистралата върху построените участъци
  for (const hw of HIGHWAYS) {
    const k = hw.segs.findIndex((_, i) => hwDone().includes(segId(hw, i)));
    if (k < 0) continue;
    const A1 = cityById(hw.segs[k][0]), B1 = cityById(hw.segs[k][1]), [x1, y1] = proj(A1.lon, A1.lat), [x2, y2] = proj(B1.lon, B1.lat);
    { const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 - 10 * zs; h += `<g><rect x="${cx - 9 * zs}" y="${cy - 5 * zs}" width="${18 * zs}" height="${10 * zs}" rx="${2 * zs}" fill="#1e5fbf" stroke="#fff" stroke-width="${(.8 * zs).toFixed(2)}"/><text x="${cx}" y="${cy + 2.4 * zs}" font-size="${7.5 * zs}" font-weight="900" fill="#fff" text-anchor="middle">${hw.id}</text></g>`; }
  }
  return h;
}
function hwHudHtml() {
  let h = `<div class="sect">🛣️ Магистрали · тол ${fmt(hwToll())} €/ден</div>`;
  for (const hw of HIGHWAYS) {
    const n = hw.segs.filter((_, i) => hwDone().includes(segId(hw, i))).length;
    if (!n) continue;
    const full = n === hw.segs.length;
    h += `<div class="meta" style="margin:0">🎫 АМ „${hw.nm}“: ${n}/${hw.segs.length} участъка${full ? ' · <b style="color:var(--ok)">цяла ×1.5</b>' : ` · следващият участък вдига тола с +25%`} → <b style="color:var(--ok)">${fmt(hwTollOf(hw))} €/ден</b></div>`;
  }
  if (!hwRepOk()) return h + `<div class="meta">Държавните поръчки за магистрали изискват репутация ${HW_REP} ★ (сега ${S.rep.toFixed(1)} ★) или ниво 5 на развитие.</div>`;
  for (const j of S.hwJobs || []) {
    const s = segById(j.seg), st = stagesOf(j)[j.stage], roles = hwRoles(j);
    const miss = roles.filter(r => r.away < r.cnt).map(r => `${ECON.UNIT_TYPES[r.role].ico}${r.coming ? ' на път' : ` нужни ${r.cnt}`}`).join(' ') + (j.lack ? ' — чака свободна техника' : '');
    const lk = hwLackOf(j), why = lk.length ? ` <span class="late">⏸ чака в ${cityById(hwCityOf(j)).nm}: ${lackTxt(lk)}</span>` : hwCityOf(j) !== S.cityId ? ` · 🚜 строи техниката от ${cityById(j.city).nm}` : '';
    h += `<div class="meta"><b style="color:var(--txt)">${j.ab ? '🔴 Аутобан' : 'АМ'} „${s.hw.nm}“ ${cityById(s.a).nm} — ${cityById(s.b).nm}</b><br>${st.ico} ${j.stage + 1}. ${st.nm} · ${Math.floor(j.prog * 100)}% ${why || (miss ? `· <span class="late">${miss}</span>` : '')}</div>
      <div class="bar"><i style="width:${((j.stage + j.prog) / stagesOf(j).length * 100).toFixed(1)}%"></i></div>
      <button class="btn2" data-hwview="${j.seg}">👁 Виж строежа</button>`;
  }
  const can = (S.hwJobs || []).length < HW_MAX_JOBS();
  for (const s of hwAvailable()) {
    const km = kmBetween(s.a, s.b), q = segmentQuote(km);
    h += `<div class="row" style="margin:0"><span class="meta" style="margin:0">АМ „${s.hw.nm}“: ${cityById(s.a).nm} — ${cityById(s.b).nm}<br>${km} км · ${q.days} дни · тол +${fmt(tollGain(s))} €/ден${(() => { const l = discPreview('road', s.a, s.b); return l.length ? `<br><span style="color:var(--ok)">📦 −${Math.round(ROAD_DISC * 100)}%: ${l.map(o => ECON.MATERIALS[o.m].ico + ' ' + ECON.MATERIALS[o.m].nm.toLowerCase()).join(', ')}</span>` : ''; })()}</span><button class="btn" data-hw="${s.id}" ${can ? '' : 'disabled'}>+${fmt(q.reward)} €</button></div>`;
  }
  return h;
}
// тол: малка основа на км, но всяка магистрала носи повече, колкото повече от нея е готова:
// +25% за всеки следващ участък и още +50%, когато цялата магистрала е завършена
function hwTollOf(hw, extra = null) {
  const done = hw.segs.map((_, i) => segId(hw, i)).filter(id => hwDone().includes(id) || id === extra);
  if (!done.length) return 0;
  const km = done.reduce((a, id) => { const s = segById(id); return a + kmBetween(s.a, s.b); }, 0);
  const mul = (1 + 0.25 * (done.length - 1)) * (done.length === hw.segs.length ? 1.5 : 1);
  return Math.round(km * TOLL_PER_KM_DAY * mul);
}
const hwToll = () => HIGHWAYS.reduce((a, hw) => a + hwTollOf(hw), 0) + abToll();
// с колко ще се вдигне тол таксата, ако се завърши този участък
const tollGain = sg => hwTollOf(sg.hw, sg.id) - hwTollOf(sg.hw);

// ---- 3D изглед на строежа на участък
let hwv = null;
function openHwView(segIdStr) {
  const s = segIdStr.startsWith('rail:') ? null : segById(segIdStr);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0xbcd9ee); sc.fog = new THREE.Fog(0xbcd9ee, 160, 400);
  sc.add(new THREE.HemisphereLight(0xdfefff, 0x6b7b55, 1.3));
  const sn = new THREE.DirectionalLight(0xfff2dc, 2.3); sn.position.set(-60, 120, 40); sn.castShadow = true; sn.shadow.mapSize.set(2048, 2048);
  Object.assign(sn.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, far: 400 }); sc.add(sn);
  const rail = segIdStr.startsWith('rail:') ? (S.rails || []).find(r => `rail:${r.a}-${r.b}` === segIdStr) : null;
  const resort = segIdStr.startsWith('resort:') ? RESORTS.find(r => 'resort:' + r.id === segIdStr) : null;
  const v = resort ? resortScene(resort) : rail ? buildRailView(A) : (s.ab && AB?.buildAutobahnView ? AB.buildAutobahnView(A, { title: `${s.hw.id} ${s.hw.nm.toUpperCase()}` }) : buildHighwayView(A, { title: `${s.hw.id} ${s.hw.nm.toUpperCase()}` })); sc.add(v.group);
  // околност и строителни табели (scenery.js) за жп линиите и магистралите
  const scn = resort ? null : addRouteScenery(v.group, { model, A, houses: HOUSES }, rail
    ? { half: 10, kind: 'rail', title: `Жп линия ${cityById(rail.a).nm} — ${cityById(rail.b).nm}`, seed: hashStr(segIdStr) % 100000 + 7 }
    : { half: 22, kind: 'road', title: `АМ „${s.hw.nm}“: ${cityById(s.a).nm} — ${cityById(s.b).nm}`, seed: hashStr(segIdStr) % 100000 + 7 });
  if (resort) { const vw = v.view || {}, c = vw.horizon ?? 0xcfe0e8; sc.background.setHex(c); sc.fog.color.setHex(c); [sc.fog.near, sc.fog.far] = vw.fog || [220, 620]; }
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 900); cam.position.set(70, 60, 140);
  const ctl = new MapControls(cam, renderer.domElement); ctl.target.set(0, 0, 10); ctl.enableDamping = true;
  controls.enabled = false;
  hwv = { sc, cam, ctl, v, seg: segIdStr, t: 0, scn };
  if (resort) {
    const vw = v.view || {}, cm = vw.cam || { pos: [70, 55, 150], target: [0, 0, 15] };
    cam.far = 2500; cam.updateProjectionMatrix(); cam.position.set(...cm.pos); ctl.target.set(...cm.target);
    ctl.minDistance = vw.minDist || 30; ctl.maxDistance = vw.maxDist || 300; ctl.maxPolarAngle = vw.maxPolar || 1.3;
    hwv.bounds = vw.bounds || 220;
  }
  showMap(false); $('panel').classList.add('hidden');
  const bar = document.createElement('div'); bar.id = 'hwBar';
  bar.style.cssText = 'position:fixed;top:calc(var(--topH, 52px) + 12px);left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 16px;z-index:6;display:flex;gap:14px;align-items:center';
  document.body.appendChild(bar);
}
function closeHwView() {
  if (!hwv) return;
  hwv.ctl.dispose(); controls.enabled = true; hwv = null;
  $('hwBar')?.remove();
  showMap(true);
}
// ---- курорт отвътре (Фаза 5): същият изглед като магистралите, но със сцена от resortview.js
function resortScene(r) {
  return buildResortView(A, r, (S.resorts || {})[r.id], seasonOf(S.day), { model, houses: HOUSES, tintRoof, fitScale, label });
}
function refreshResortView() {
  if (!hwv || !hwv.seg.startsWith('resort:')) return;
  const r = RESORTS.find(q => 'resort:' + q.id === hwv.seg);
  hwv.sc.remove(hwv.v.group); hwv.v = resortScene(r); hwv.sc.add(hwv.v.group);
  $('hwBar') && ($('hwBar').dataset.txt = '');
}
function renderResortView(rdt) {
  const r = RESORTS.find(q => 'resort:' + q.id === hwv.seg), st = (S.resorts || {})[r.id];
  hwv.t += rdt;
  // сезонът се смени или строежът свърши → сцената се построява наново
  const key = `${seasonOf(S.day)}|${st ? st.stage : ''}`;
  if (hwv.key && hwv.key !== key) refreshResortView();
  hwv.key = key;
  hwv.v.update(hwv.t, st && st.stage === 'building' ? st.prog : 1);
  const bar = $('hwBar');
  if (bar) {
    const sz = seasonOf(S.day), txt = `${monthName(S.day)} · ${sz === 'summer' ? '☀️ лято' : sz === 'winter' ? '❄️ зима' : '🍂 извън сезона'} · ${!st ? 'свободен парцел' : st.stage === 'building' ? `строи се ${Math.round(st.prog * 100)}%` : st.stage === 'built' ? `💶 ~${fmt(resorts.yearOf(r.id))} €/год. · спечелено ${fmt(st.earned || 0)} €` : st.stage === 'land' ? 'твоя земя' : 'продадено'}`;
    if (bar.dataset.txt !== txt) {
      bar.dataset.txt = txt;
      bar.innerHTML = `<b>${r.ico} ${r.nm}</b><span>${txt}</span><button class="btn" id="rsAct">⚙️ Действия</button><button class="btn2" id="hwClose">✕ Към картата</button>`;
      $('hwClose').onclick = closeHwView; $('rsAct').onclick = () => resorts.open(r.id);
    }
  }
  // камерата не излиза извън сцената
  const B = hwv.bounds || 220, tg = hwv.ctl.target, cx = Math.max(-B, Math.min(B, tg.x)) - tg.x, cz = Math.max(-B, Math.min(B, tg.z)) - tg.z;
  if (cx || cz) { tg.x += cx; tg.z += cz; hwv.cam.position.x += cx; hwv.cam.position.z += cz; }
  hwv.ctl.update();
  renderer.render(hwv.sc, hwv.cam);
}
function renderHwView(rdt) {
  if (hwv.seg.startsWith('resort:')) return renderResortView(rdt);
  if (hwv.seg.startsWith('rail:')) return renderRailView(rdt);
  const j = (S.hwJobs || []).find(q => q.seg === hwv.seg), done = hwDone().includes(hwv.seg), s = segById(hwv.seg);
  hwv.t += rdt;
  const STG = s.ab ? abStages() : HW_STAGES, real = s.ab && AB?.buildAutobahnView;
  const stage = done ? STG.length : j ? j.stage : 0, prog = j ? j.prog : 1;
  // без autobahn.js аутобанът се показва с изгледа на магистрала (4 етапа): мостовете се показват като земни работи
  hwv.v.update(s.ab && !real ? (done ? 4 : Math.max(0, stage - 1)) : stage, prog, hwv.t);
  if (hwv.scn) hwv.scn.update(hwv.t);
  const bar = $('hwBar');
  if (bar) {
    const txt = done ? '✅ Участъкът е открит' : `${STG[stage].ico} ${stage + 1}. ${STG[stage].nm} — ${Math.floor(prog * 100)}%`;
    if (bar.dataset.txt !== txt) { bar.dataset.txt = txt; bar.innerHTML = `<b>${s.ab ? '🔴 Аутобан' : 'АМ'} „${s.hw.nm}“ · ${cityById(s.a).nm} — ${cityById(s.b).nm}</b><span>${txt}</span><button class="btn2" id="hwClose">✕ Към картата</button>`; $('hwClose').onclick = closeHwView; }
  }
  hwv.ctl.update();
  renderer.render(hwv.sc, hwv.cam);
}

function renderRailView(rdt) {
  const r = (S.rails || []).find(q => `rail:${q.a}-${q.b}` === hwv.seg);
  hwv.t += rdt;
  const { stage, prog } = !r || r.built ? { stage: 4, prog: 1 } : railStageOf(r.prog);
  hwv.v.update(stage, prog, hwv.t);
  if (hwv.scn) hwv.scn.update(hwv.t);
  const bar = $('hwBar');
  if (bar && r) {
    const txt = r.built ? '✅ Линията е готова' : `${RAIL_STAGES[stage].ico} ${stage + 1}. ${RAIL_STAGES[stage].nm} — ${Math.floor(prog * 100)}%`;
    if (bar.dataset.txt !== txt) { bar.dataset.txt = txt; bar.innerHTML = `<b>🛤️ ${cityById(r.a).nm} — ${cityById(r.b).nm} · ${r.km} км</b><span>${txt}</span><button class="btn2" id="hwClose">✕ Към картата</button>`; $('hwClose').onclick = closeHwView; }
  }
  hwv.ctl.update();
  renderer.render(hwv.sc, hwv.cam);
}

// ---- магистралата в града: ако участък започва/свършва в града на централата
let cityHw = null;
function buildCityHighway() {
  if (cityHw) { city.group.remove(cityHw.g); cityHw = null; }
  const mine = [...allSegs(), ...ALL_AB].filter(s => s.a === S.cityId || s.b === S.cityId);   // и аутобаните (напр. Прага)
  const done = mine.find(s => hwDone().includes(s.id)), job = (S.hwJobs || []).find(j => mine.some(s => s.id === j.seg));
  if (!done && !job) return;
  const g = new THREE.Group();
  const hx0 = Math.min(tx(0), -(N * TILE) / 2), hx1 = Math.max(tx(NI - 1), (N * TILE) / 2), hLen = hx1 - hx0 + 200, hcx = (hx0 + hx1) / 2;   // по цялата ширина на града
  const v = buildHighwayView(A, { len: hLen, river: false, ground: false });
  v.group.rotation.y = Math.PI / 2;
  v.group.position.set(hcx, 0, tx(N - 1) + 34);
  g.add(v.group);
  // пътна връзка от южната улица към магистралата
  const conn = [];
  for (let z = tx(N - 1) + TILE; z < tx(N - 1) + 22; z += TILE) {
    const t = model('road-straight', TILE); t.rotation.y = Math.PI / 2; t.position.set(tx(3 * Math.floor(NB / 2)), 0.01, z); g.add(t); conn.push(t);
  }
  city.group.add(g);
  cityHw = { g, v, conn, seg: (done || mine.find(s => s.id === job.seg)).id };
  // коли и камиони по готовата магистрала (hwtraffic.js); платната са по x, около z = tx(N−1)+34
  const tg = new THREE.Group(); tg.position.x = hcx; g.add(tg);
  cityHw.traffic = createHwTraffic(tg, model, A, tx(N - 1) + 34, hLen);
}
function updateCityHighway(t) {
  if (!cityHw) return;
  const done = hwDone().includes(cityHw.seg), j = (S.hwJobs || []).find(q => q.seg === cityHw.seg);
  const stage = done ? 4 : j ? j.stage : 4, prog = j ? j.prog : 1;
  cityHw.v.update(stage, prog, t);
  for (const c of cityHw.conn) c.visible = stage >= 2;
  if (cityHw.traffic) {
    const dt = cityHw.lastT == null ? 0 : Math.min(0.2, Math.max(0, t - cityHw.lastT)); cityHw.lastT = t;
    cityHw.traffic.visible = stage >= 4;
    if (stage >= 4) cityHw.traffic.update(dt);
  }
}

// ============================================================ имоти: земя, наеми, флипване, инвеститори
const LAND_PRICE = { outer: 12000, mid: 25000, center: 50000 };
const HOUSE_PRICE = { outer: 30000, mid: 45000, center: 70000 };
const RENT = { house: 400, shop: 1200, office: 2800, tower: 10000 };
const RENO_COST = 7000;   // материали за ремонт (плащат се при старта)
const est = () => (S.estate = S.estate || { land: [], owned: [], listings: [] });
const ownedAt = id => est().owned.find(o => o.lot === id);
const lotPrice = lot => Math.round(LAND_PRICE[lot.zone] * (1 + 0.04 * S.day / 10) * (1 + 0.2 * Math.min(2, (S.parks || []).filter(id => Math.hypot(city.lots[id].x - lot.x, city.lots[id].z - lot.z) <= PARK_R).length)) / 500) * 500;   // земята поскъпва с времето
// махане на сграда от парцел (събаряне); помни се в записа, защото градът се генерира от seed
function clearLot(lot) {
  if (lot.obj) { city.group.remove(lot.obj); poofAt(lot.x, lot.z); }
  lot.obj = null; lot.built = null;
  for (const t of lot.trees || []) city.group.remove(t);
  lot.trees = [];
  S.built = (S.built || []).filter(b => b.lot !== lot.id);
  S.cleared = [...new Set([...(S.cleared || []), lot.id])];
}
// ---- табели над имотите
const estSigns = new Map();
function refreshEstateSigns() {
  for (const s of estSigns.values()) city.group.remove(s);
  estSigns.clear();
  const put = (id, text, color) => {
    const lot = city.lots[id], bb = lot.obj ? new THREE.Box3().setFromObject(lot.obj) : null;
    const s = label(text, color, 9); s.position.set(lot.x, (bb ? bb.max.y : 0) + 3.5, lot.z); city.group.add(s); estSigns.set(id, s);
  };
  for (const l of est().listings) put(l.lot, `🏷️ ПРОДАВА СЕ · ${fmt(l.price)} €`, '#ff9e5e');
  for (const o of S.offers || []) if (o.demolish && city.lots[o.lot]?.obj) put(o.lot, `🏗️ За събаряне · ${o.client}`, '#ff9e5e');
  for (const id of est().land) put(id, '🟩 Твой парцел', '#7dffa8');
  for (const o of est().owned) if (!projects.some(p => p.lot === o.lot)) put(o.lot, o.sale?.price ? `💰 Купувач: ${fmt(o.sale.price)} €` : o.sale ? '🏷️ Обявен за продан' : ageOf(o) >= LIFE ? '🏚️ Над 5 г. — преустрой/събори' : condOf(o) < 60 ? `🔧 Нужен ремонт · ${Math.round(condOf(o))}%` : `🔑 Наем ${fmt(rentNow(o))} €/ден`, o.sale ? '#ffd54a' : ageOf(o) >= LIFE || condOf(o) < 60 ? '#ffb46b' : '#7dd3ff');
}
// ---- земя
const MAX_LAND = 5;   // до 5 празни парцела наведнъж в град — иначе не им се вижда краят
function buyLand(id) {
  const lot = city.lots[id], price = lotPrice(lot);
  if (lot.built || lot.busy) return;
  if (est().land.length >= MAX_LAND) { toast(`Имаш ${MAX_LAND} празни парцела в ${cityName()} — застрой или продай някой, преди да купиш нов.`, 'bad'); Sound.play('error'); return; }
  if (!econ.canAfford(price)) { toast('Нямаш достатъчно пари за парцела.', 'bad'); Sound.play('error'); return; }
  econ.spend(price, 'покупка', `Парцел (${lot.zone === 'center' ? 'център' : lot.zone === 'mid' ? 'среден пояс' : 'покрайнини'})`);
  lot.busy = 'land'; est().land.push(id); lot.landPrice = price; S.landPrice = { ...(S.landPrice || {}), [id]: price };
  for (const t of lot.trees || []) city.group.remove(t);
  lot.trees = [];
  Sound.play('buy'); toast('🟩 Купи парцел. Избери какво да построиш на него в „Имоти“.', 'good');
  refreshEstateSigns(); flyTo(lot); highlightLot(id); save(); renderPanel();
}
// опашка за строеж на твоите парцели: ако няма свободно място за обект, строежът тръгва сам, щом се освободи
function processBuildQ() {
  if (!S || !S.buildQ || !S.buildQ.length || !city.lots) return;
  // по ред; ако първият още чака репутация, следващите могат да минат преди него
  for (const q of [...S.buildQ]) {
    if (busyCount() >= officeLv().proj) break;
    if (!est().land.includes(q.lot)) { S.buildQ.splice(S.buildQ.indexOf(q), 1); continue; }
    if (S.rep < BTYPES[q.type].rep) continue;
    S.buildQ.splice(S.buildQ.indexOf(q), 1); buildOnLand(q.lot, q.type, true);
  }
}
function buildOnLand(id, type, fromQ = false) {
  const bt = BTYPES[type], lot = city.lots[id];
  const active = busyCount(), noRep = S.rep < bt.rep;
  if (active >= officeLv().proj || noRep) {   // маркирано на заден план — тръгва само, когато има място и репутация
    S.buildQ = (S.buildQ || []).filter(q => q.lot !== id); S.buildQ.push({ lot: id, type });
    toast(`⏳ ${bt.nm} е маркиран (опашка №${S.buildQ.length}) — ще започне сам, когато ${noRep ? `стигнеш ${bt.rep} ★${active >= officeLv().proj ? ' и ' : ''}` : ''}${active >= officeLv().proj ? 'се освободи място за обект' : ''}.`, 'good'); save(); renderPanel(); return;
  }
  if (!fromQ) S.buildQ = (S.buildQ || []).filter(q => q.lot !== id);
  est().land = est().land.filter(x => x !== id);
  const p = { id: S.seq++, type, lot: id, client: 'твоя инвестиция', title: `${bt.nm} — твоя инвестиция`, reward: 0, repGain: 0, invest: true,
    startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0, model: buildingFor(type) };
  lot.busy = 'project';
  projects.push(p); makeSite(p);
  toast(`🏗️ Започна строежът на ${bt.nm.toLowerCase()} за наем.`, 'good');
  dispatch(); refreshEstateSigns(); save(); renderPanel();
}
// завършена инвестиция → имот под наем
function finishInvestment(p) {
  finishSite(p);
  const lot = city.lots[p.lot];
  S.built.push({ lot: p.lot, model: p.model });
  const land = (S.landPrice || {})[p.lot] || LAND_PRICE[lot.zone];
  est().owned.push({ cond: 100, lot: p.lot, kind: p.type, rent: Math.round(RENT[p.type] * rand(0.9, 1.1) / 10) * 10, value: land + BTYPES[p.type].reward, since: S.day });
  lot.busy = 'owned';
  Sound.play('done');
  toast(`🔑 ${BTYPES[p.type].nm} е готов${p.type === 'house' ? 'а' : ''} и вече носи наем!`, 'good');
  showEventPop('done-rent', `🔑 ${BTYPES[p.type].nm} под наем`, `Носи ~${fmt(RENT[p.type])} € на ден.`);
  quests.emit('invest');
}
// ---- обяви: къщи за продан
function makeListing() {
  const cand = city.lots.filter(l => l.built && HOUSES.includes(l.built) && !l.busy && l !== city.hq);
  if (!cand.length) return;
  const lot = pick(cand);
  est().listings.push({ id: S.seq++, lot: lot.id, price: Math.round(HOUSE_PRICE[lot.zone] * rand(0.85, 1.15) / 500) * 500, expires: S.day + 4 });
  lot.busy = 'listing';
}
function buyListing(id) {
  const l = est().listings.find(q => q.id === id); if (!l) return;
  if (!econ.canAfford(l.price)) { toast('Нямаш достатъчно пари за къщата.', 'bad'); Sound.play('error'); return; }
  econ.spend(l.price, 'покупка', 'Къща (имот)');
  est().listings.splice(est().listings.indexOf(l), 1);
  est().owned.push({ lot: l.lot, kind: 'house', rent: 300, value: l.price, since: S.day, old: true });
  city.lots[l.lot].busy = 'owned';
  Sound.play('buy'); toast('🏠 Купи къщата. Ремонтирай я, за да вдигнеш цената и наема.', 'good');
  refreshEstateSigns(); save(); renderPanel();
}
// изкупена фалирала фирма (борсата): сградите ѝ в текущия град стават твои имоти под наем + имущество според фирмата
const TAKEOVER = {
  bulstroy: { b: [['office', 2]], units: ['crew', 'crew', 'crew', 'crane', 'truck', 'truck'] },
  dunav:    { b: [['shop', 2]], units: ['truck', 'truck', 'truck'], stock: 120 },
  energy:   { b: [['office', 1]] },
  agro:     { b: [['house', 6]], land: 4, units: ['tractor'] },
  tech:     { b: [['tower', 1], ['office', 2]] },
  rhodope:  { b: [['shop', 2]], resort: ['pamporovo', 'velingrad', 'borovets', 'bansko', 'primorsko', 'sunnybeach'] },
};
for (const c of ECON.COMPANIES) if (c.cc && !TAKEOVER[c.id]) TAKEOVER[c.id] = { b: [['house', 2], ['office', 1]], units: ['crew', 'crew', 'loader', 'truck'] };   // чуждите строителни фирми
// пазарна стойност на имуществото на фирмата (за разпродажба)
function takeoverValue(id) {
  const T = TAKEOVER[id]; if (!T) return 0;
  let v = 0;
  for (const [k, n] of T.b || []) v += n * (LAND_PRICE.mid + RENT[k] * 250);   // сграда под наем ≈ 250 дни наем + терена
  v += ECON.COMPANIES.find(x => x.id === id).subDaily * 60;   // марка, клиенти, договори
  for (const t of T.units || []) v += econ.sellPrice(t);
  if (T.stock) v += T.stock * ['sand', 'gravel', 'concrete', 'bricks', 'steel', 'wood', 'glass'].reduce((a, m) => a + (ECON.MATERIALS[m]?.buyPrice || 0), 0) * 0.9;
  if (T.land) v += T.land * LAND_PRICE.outer;
  if (T.resort) { const r = RESORTS.find(x => x.id === T.resort[0]); v += r ? r.sell + 2500000 : 0; }
  return Math.round(v / 1000) * 1000;
}
// след изкупуването: задръж като дъщерна или разпродай (бързо ×0.85 / за 10 дни ×0.95)
function takeoverChoice(id) {
  const c = ECON.COMPANIES.find(x => x.id === id), paid = (econ.s.subs || {})[id]?.paid || 0, v = takeoverValue(id), fast = Math.round(v * 0.85), slow = Math.round(v * 0.95);
  const pr = n => `<b style="color:${n - paid >= 0 ? 'var(--ok)' : 'var(--bad)'}">${n - paid >= 0 ? '+' : '−'}${fmt(Math.abs(n - paid))} €</b>`;
  modal(`🏢 ${c.nm} е твоя!`, `Плати ${fmt(paid)} €. Какво да правиш с нея?<br><br>
    🏢 <b>Задръж като дъщерна</b>: взимаш ${c.gets} · носи <b style="color:var(--ok)">+${fmt(c.subDaily)} €/ден</b> (~${fmt(c.subDaily * 360)} €/год.)<br>
    💰 <b>Разпродай веднага</b>: +${fmt(fast)} € (печалба ${pr(fast)})<br>
    ⏳ <b>Разпродай за 10 дни</b>: +${fmt(slow)} € на части (печалба ${pr(slow)})`,
    [['⏳ За 10 дни', () => { econ.liquidate(id, slow, 10); renderPanel(); }], ['💰 Веднага', () => { econ.liquidate(id, fast); renderPanel(); }], ['🏢 Задръж', () => takeoverAssets(id)]]);
}
function takeoverAssets(id) {
  const T = TAKEOVER[id]; if (!T) return;
  const got = [], kindOf = n => HOUSES.includes(n) ? 'house' : SHOPS.includes(n) ? 'shop' : 'office';
  const free = () => city.lots.filter(l => l.built && !l.busy && l !== city.hq);
  for (const [kind, n] of T.b || []) {
    let c = free().filter(l => kind === 'tower' ? kindOf(l.built) === 'office' && l.zone === 'center' : kindOf(l.built) === kind);
    if (c.length < n) c = c.concat(free().filter(l => !c.includes(l)));   // ако няма от този вид — каквото има
    c.sort((a, b) => (a.zone === 'center' ? 0 : a.zone === 'mid' ? 1 : 2) - (b.zone === 'center' ? 0 : b.zone === 'mid' ? 1 : 2));
    for (const lot of c.slice(0, n)) {
      const k = kind === 'tower' ? 'tower' : kindOf(lot.built);
      est().owned.push({ cond: 85, lot: lot.id, kind: k, rent: Math.round(RENT[k] * rand(0.9, 1.1) / 10) * 10, value: LAND_PRICE[lot.zone] + BTYPES[k].reward, since: S.day });
      lot.busy = 'owned'; poofAt(lot.x, lot.z); got.push(BTYPES[k].nm.toLowerCase());
    }
  }
  if (T.land) { const c = city.lots.filter(l => !l.built && !l.busy && l !== city.hq).slice(0, T.land); for (const l of c) est().land.push(l.id); if (c.length) got.push(`${c.length} парцела`); }
  for (const type of T.units || []) { S.units.push(type); const u = spawnUnit(type); poofAt(u.x, u.z); }
  if (T.units) { syncUnits(); refreshGarageLabel(); got.push(`${T.units.length} техника/бригади`); }
  if (T.stock) { for (const m of ['sand', 'gravel', 'concrete', 'bricks', 'steel', 'wood', 'glass']) econ.s.stock[m] = (econ.s.stock[m] || 0) + T.stock; got.push('пълен склад'); }
  if (T.resort) { const nm = resorts.grant(T.resort, 'hotel'); if (nm) got.push(`курорт ${nm} с хотел`); }
  const c = ECON.COMPANIES.find(x => x.id === id);
  showEventPop('new-branch', `🏢 ${c.nm} е твоя!`, `Взе: ${got.join(', ')}. Дъщерната фирма носи +${fmt(c.subDaily)} € на ден.`);
  refreshEstateSigns(); dispatch(); save();
}
// ремонт: обект без изкоп; накрая къщата става по-хубав модел
BTYPES.reno = { nm: 'Ремонт', ico: '🔨', est: true, rep: Infinity, repGain: 0,
  stages: [{ nm: 'Покрив и фасада', need: { crew: 1 }, work: 35 }, { nm: 'Градина', need: { crew: 1, tractor: 1 }, work: 15 }] };
function startReno(lotId) {
  const o = ownedAt(lotId); if (!o || !o.old) return;
  if (!econ.canAfford(RENO_COST)) { toast('Нямаш пари за материалите за ремонта.', 'bad'); return; }
  const active = busyCount();
  if (active >= officeLv().proj) { toast('Нямаш свободен капацитет за още обект. Надгради офиса.', 'bad'); return; }
  econ.spend(RENO_COST, 'материали', 'Материали за ремонт');
  const lot = city.lots[lotId];
  const better = HOUSES[(HOUSES.indexOf(lot.built) + 3 + (Math.random() * 4 | 0)) % HOUSES.length];
  const p = { id: S.seq++, type: 'reno', reno: true, lot: lotId, client: 'твой имот', title: 'Ремонт — твоя къща', reward: 0, repGain: 0,
    startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0, model: better };
  lot.busy = 'project';
  projects.push(p); makeSite(p);
  toast('🔨 Ремонтът започна — бригадата тръгва.', 'good');
  dispatch(); refreshEstateSigns(); save(); renderPanel();
}
function makeRenoSite(p) {
  const lot = city.lots[p.lot];
  const g = new THREE.Group(); g.position.set(lot.x, 0, lot.z); scene.add(g);
  const bb = lot.obj ? new THREE.Box3().setFromObject(lot.obj) : new THREE.Box3(new THREE.Vector3(lot.x - 5, 0, lot.z - 5), new THREE.Vector3(lot.x + 5, 7, lot.z + 5));
  const W = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + 0.8, H = bb.max.y + 1;
  const pts = [];
  for (let a = -W; a <= W + 0.01; a += 2.5) for (const [x, z] of [[a, -W], [a, W], [-W, a], [W, a]]) pts.push(x, 0, z, x, H, z);
  for (let y = 2.5; y <= H; y += 2.5) for (const [x1, z1, x2, z2] of [[-W, -W, W, -W], [W, -W, W, W], [W, W, -W, W], [-W, W, -W, -W]]) pts.push(x1, y, z1, x2, y, z2);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9a53a })));
  const sign = label('🔨 Ремонт', '#ffd54a', 8); sign.position.y = H + 3; g.add(sign);
  p.vis = { g, reno: true };
}
function finishReno(p) {
  scene.remove(p.vis.g); p.vis = null;
  const lot = city.lots[p.lot], o = ownedAt(p.lot);
  clearLot(lot);
  placeBuilding(lot, p.model, 0);
  for (const [x, z] of [[-6, 6], [6, 6], [-6, -6]]) { const tr = model('tree-large', 8); tr.position.set(lot.x + x, 0, lot.z + z); city.group.add(tr); }
  S.built.push({ lot: p.lot, model: p.model });
  if (o) { o.old = false; o.value = Math.round(o.value * 1.45 / 500) * 500; o.rent = 550; }
  lot.busy = 'owned';
  Sound.play('done');
  toast(`✨ Ремонтът е готов! Къщата вече струва ~${fmt(o ? o.value : 0)} € и носи по-висок наем.`, 'good');
  showEventPop('done-reno', '🔨 Ремонтът е готов!', `Къщата вече струва ~${fmt(o ? o.value : 0)} € и носи 550 €/ден наем.`);
  quests.emit('reno');
}
// ---- износване на твоите имоти: състоянието пада с времето, наемът спада под 60%,
// ремонтът го връща на 100%; след 5 години сградата подлежи на преустройство или събаряне
const YEAR = 360, LIFE = 5 * YEAR, WEAR = 40 / 180;      // 100% → 60% за ~половин година
const NEXT_KIND = { house: 'shop', shop: 'office', office: 'tower', tower: 'tower' };
const condOf = o => o.cond ?? 100;
const ageOf = o => Math.max(0, S.day - (o.since ?? S.day));
const ageTxt = d => { const y = Math.floor(d / YEAR), m = Math.floor((d % YEAR) / 30); return y ? `${y} г.${m ? ` ${m} мес.` : ''}` : `${m} мес.`; };
const rentNow = o => Math.round(o.rent * (condOf(o) >= 60 ? 1 : 0.4 + condOf(o) / 100) * parkMul(city.lots[o.lot]));
const maintCost = o => Math.max(2000, Math.round(o.value * 0.08 * (1 - condOf(o) / 100) * 2 / 500) * 500);
const remodelCost = o => Math.round(o.value * 0.35 / 1000) * 1000;
function wearOwned(days) {
  for (const o of est().owned) {
    if (projects.some(p => p.lot === o.lot)) continue;
    const before = condOf(o), rate = ageOf(o) >= LIFE ? 2 : 1;
    o.cond = Math.max(0, before - WEAR * rate * days);
    const nm = BTYPES[o.kind].nm;
    if (before >= 60 && o.cond < 60) toast(`🔧 Твой имот (${nm.toLowerCase()}) има нужда от ремонт — наемът започва да пада. Виж „Имоти“.`, 'bad', () => { tab = 'estate'; renderPanel(); });
    if (before >= 30 && o.cond < 30) toast(`⚠️ ${nm} е в лошо състояние (${Math.round(o.cond)}%) — наемателите се оплакват!`, 'bad');
    if (ageOf(o) >= LIFE && !o.lifeWarned) { o.lifeWarned = true; toast(`🏚️ Твой имот (${nm.toLowerCase()}) е на 5 години — преустрой го или го събори и построй по-голяма сграда.`, 'bad', () => { tab = 'estate'; renderPanel(); }); }
  }
}
BTYPES.maint = { nm: 'Поддръжка', ico: '🔧', est: true, rep: Infinity, repGain: 0, stages: [{ nm: 'Ремонт и поддръжка', need: { crew: 1 }, work: 22 }] };
BTYPES.remodel = { nm: 'Преустройство', ico: '🏗️', est: true, rep: Infinity, repGain: 0,
  stages: [{ nm: 'Демонтаж', need: { crew: 1, truck: 1 }, work: 30 }, { nm: 'Обновяване', need: { crew: 2, crane: 1 }, work: 60 }] };
// ремонтът (поддръжка) на твои имоти се прави от поддръжката на филиала — не заема място от „обекти наведнъж“
function busyCount() { return projects.filter(q => !q.own && !q.maint && !q.park).length; }   // ремонтите и парковете не заемат капацитета на офиса
// бутонът „Ремонтирай всички“ в „Имоти“: всички имоти под 80% (докато стигат парите)
// ---- имотите по градове (за десния панел на картата): ремонт, преустройство, събаряне
function cityEstate(id) { return id === S.cityId ? est() : (S.cities?.[id]?.estate || { owned: [] }); }
// ---- десният панел на картата: подобрения на сградите на фирмата във всеки твой град (офис, склад, гараж, гара)
const UPG_KIND = { office: { nm: 'Офисът', ico: '🏢', max: OFFICE_LEVELS.length }, warehouse: { nm: 'Складът', ico: '📦', max: WH_LEVELS.length }, garage: { nm: 'Гаражът', ico: '🔧', max: GARAGE_LEVELS.length }, station: { nm: 'Гарата', ico: '🚉', max: 5 } };
function upgInfo(id) {
  const here = id === S.cityId, c = here ? S : (S.cities || {})[id] || {}, pr = here ? projects : c.projects || [];
  const lv = { office: c.officeLevel || 1, warehouse: c.whLevel || 0, garage: c.garageLevel || 1, station: c.stationLevel || 0 };
  return Object.keys(UPG_KIND).map(kind => {
    const L = lv[kind], rb = (c.rbuild || {})[kind], busy = rb ? `🔨 още ${Math.max(1, rb.done - S.day)} д.` : kind === 'station' ? !!c.stationBuild : pr.some(p => p.own === kind);
    const cost = L >= UPG_KIND[kind].max ? 0 : kind === 'office' ? OFFICE_LEVELS[L - 1].cost : kind === 'garage' ? GARAGE_LEVELS[L - 1].cost : kind === 'warehouse' ? WH_LEVELS[L].cost : STATION_LEVELS[L].cost;
    return { kind, lv: L, busy, cost, max: L >= UPG_KIND[kind].max };
  });
}
function upgHudHtml() {
  const cities = ownedCities().filter(id => !(econ.isFinished && econ.isFinished(id))).sort((a, b) => (b === S.cityId) - (a === S.cityId));
  if (!cities.length) return '';
  let h = '<div class="sect">⬆️ Подобрения на фирмата</div>';
  for (const id of cities) {
    const nm = cityById(id).nm, rows = upgInfo(id).filter(u => !u.max).map(u => {   // готовите на максимум не се показват
      const K = UPG_KIND[u.kind], txt = `${K.ico} ${K.nm.replace(/ът$|та$/, '')} <b style="color:var(--txt)">${u.lv ? `ниво ${u.lv}` : 'няма'}</b>`;
      const right = u.max ? '<span class="meta" style="margin:0;color:var(--ok)">✅ макс.</span>' : u.busy ? `<span class="meta" style="margin:0">${u.busy === true ? '🔨 строи се' : u.busy}</span>`
        : `<button class="btn2" style="padding:3px 8px;font-size:12px;white-space:nowrap" data-upg="${id}|${u.kind}" ${econ.canAfford(u.cost) ? '' : 'title="Нямаш достатъчно пари"'}>⬆️ ${u.lv ? `ниво ${u.lv + 1}` : 'строй'} · ${fmt(u.cost)} €</button>`;
      return `<div class="row" style="margin:2px 0;gap:6px"><span class="meta" style="margin:0;white-space:nowrap">${txt}</span>${right}</div>`;
    }).join('');
    if (rows) h += `<div class="card" style="padding:7px 10px">${id === S.cityId ? '📍 ' : ''}<b>${nm}</b>${rows}</div>`;   // град с всичко на максимум изчезва
  }
  return h.includes('class="card"') ? h : '';
}
// ъпгрейд направо от картата. В текущия град — обикновен строеж с бригада (парцелът се избира сам, най-близо до офиса);
// в друг град — строи се сам за няколко дни (S.cities[id].rbuild), без да влизаш там
const RB_DAYS = (kind, target) => kind === 'station' ? STATION_LEVELS[target - 1].days : kind === 'office' ? 2 + target : 2 + Math.ceil(target / 2);
function freeLotNearHq() {
  // при влизане в града сградите още не са поставени — затова се гледа и записът
  const used = new Set([...(S.built || []).map(b => b.lot), ...projects.map(p => p.lot), ...(S.offers || []).map(o => o.lot), ...((S.estate || {}).land || []), ...((S.estate || {}).owned || []).map(o => o.lot), ...((S.rivals || {}).sites || []).map(x => x.lot)]);
  return city.lots.filter(l => !l.built && !l.busy && !used.has(l.id)).sort((a, b) => Math.hypot(a.x - city.hq.x, a.z - city.hq.z) - Math.hypot(b.x - city.hq.x, b.z - city.hq.z))[0] || null;
}
function autoLot(kind) {
  const l = freeLotNearHq(); if (!l) return null;
  for (const t of l.trees || []) city.group.remove(t);
  l.trees = []; S[lotKey[kind]] = l.id; l.busy = kind; return l;
}
const remoteNeedsLot = (c, kind) => kind === 'warehouse' ? c.whLot == null : kind === 'garage' && (c.garageLevel || 1) + 1 >= GARAGE_LOT_FROM && c.garageLot == null;
function upgGo(id, kind) {
  const nm = cityById(id).nm, K = UPG_KIND[kind];
  if (id === S.cityId) {
    if (kind === 'station') startStationUpgrade();
    else if (needsLot(kind)) {
      const cost = upgradeCost(kind), l = freeLotNearHq();
      if (!l) { toast(`Няма свободен парцел в ${nm} за ${K.nm.toLowerCase()}.`, 'bad'); return; }
      if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за този строеж.', 'bad'); return; }
      for (const t of l.trees || []) city.group.remove(t);
      l.trees = []; beginOwnProject(kind, l, cost);
    } else startUpgrade(kind);
    renderMapHud(); return;
  }
  const c = (S.cities || {})[id]; if (!c) return;
  const u = upgInfo(id).find(x => x.kind === kind); if (!u || u.max || u.busy) return;
  const land = kind !== 'station' && remoteNeedsLot(c, kind) ? LAND : 0, cost = u.cost + land;
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари за този строеж.', 'bad'); return; }
  const target = u.lv + 1, days = RB_DAYS(kind, target);
  econ.spend(cost, 'покупка', `${K.nm.replace(/ът$|та$/, '')} в ${nm}: строеж на ниво ${target}${land ? ' (нов парцел)' : ''}`);
  c.rbuild = { ...(c.rbuild || {}), [kind]: { target, done: S.day + days } };
  Sound.play('buy');
  toast(`🔨 ${K.ico} ${K.nm} в ${nm} се строи до ниво ${target} — готово след ${days} дни.`, 'good');
  save(); renderMapHud();
}
// всеки ден: готовите строежи от картата (в другите градове, и в текущия, ако си влязъл там междувременно)
function rbuildTick() {
  const done = (c, id) => {
    for (const [kind, b] of Object.entries(c.rbuild || {})) {
      if (S.day < b.done) continue;
      delete c.rbuild[kind];
      const K = UPG_KIND[kind], here = c === S;
      if (kind === 'station') { c.stationLevel = b.target; if (here) { buildStation(); parkedSig = ''; } }
      else {
        if (remoteNeedsLot(c, kind)) { if (here) autoLot(kind); else c.lotAuto = { ...(c.lotAuto || {}), [kind]: 1 }; }
        c[levelKey[kind]] = b.target;
        if (here) { buildHQ(); refreshWarehouse && refreshWarehouse(); }
      }
      toast(`⬆️ ${K.ico} ${K.nm} в ${cityById(id).nm} вече е ниво ${b.target}!`, 'good');
    }
    if (c.rbuild && !Object.keys(c.rbuild).length) delete c.rbuild;
  };
  if (S.rbuild) done(S, S.cityId);
  for (const [id, c] of Object.entries(S.cities || {})) if (c && c.rbuild) done(c, id);
  if (!$('mapScreen').classList.contains('hidden')) renderMapHud();
}
function estateHudHtml() {
  const rows = ownedCities().map(id => {
    const o = cityEstate(id).owned || [], busy = x => id === S.cityId && projects.some(p => p.lot === x.lot), fixing = o.filter(x => condOf(x) < 80 && busy(x)).length;
    const rep = o.filter(x => condOf(x) < 80 && !busy(x)), old = o.filter(x => ageOf(x) >= LIFE && !busy(x));
    return { id, n: o.length, rep, old, fixing, repCost: rep.reduce((a, x) => a + maintCost(x), 0), remCost: old.reduce((a, x) => a + remodelCost(x), 0) };
  }).filter(r => r.rep.length || r.old.length || r.fixing);
  if (!rows.length) return '';
  return `<div class="sect">🏘️ Имоти</div>` + rows.map(r => `<div class="card" style="padding:8px 10px"><div class="meta" style="margin:0"><b style="color:var(--txt)">${cityById(r.id).cc || '🇧🇬'} ${cityById(r.id).nm}</b> · ${r.n} имота${r.rep.length ? ` · <span class="late">🔧 ${r.rep.length} за ремонт</span>` : ''}${r.fixing ? ` · <span style="color:var(--ok)">🔨 ${r.fixing} в ремонт</span>` : ''}${r.old.length ? ` · <span class="late">🏚️ ${r.old.length} над 5 г.</span>` : ''}</div>
    <div class="row" style="justify-content:flex-start;gap:6px;margin-top:5px;flex-wrap:wrap">${r.rep.length ? `<button class="btn" data-erep="${r.id}" ${econ.canAfford(r.repCost) ? '' : 'disabled'}>🔧 Ремонтирай всички · ${fmt(r.repCost)} €</button>` : ''}${r.old.length ? `<button class="btn2" data-erem="${r.id}" ${econ.canAfford(r.remCost) ? '' : 'disabled'}>🏗️ Преустрой (${r.old.length}) · ${fmt(r.remCost)} €</button><button class="btn2" data-edem="${r.id}">💥 Събаряне → в града</button>` : ''}</div></div>`).join('');
}
// ремонт на всички имоти в град: в текущия — с бригадите (repairAll), в друг — от местния екип веднага
function repairAllIn(id) {
  if (id === S.cityId) return repairAll();
  const list = (cityEstate(id).owned || []).filter(o => condOf(o) < 80); let n = 0, cost = 0;
  for (const o of list) { const c = maintCost(o); if (!econ.canAfford(c)) break; econ.spend(c, 'материали', `Ремонт: имот в ${cityById(id).nm}`); o.cond = 100; n++; cost += c; }
  toast(n ? `🔧 ${cityById(id).nm}: ремонтирани ${n} имота (${fmt(cost)} €) — от местния екип.` : 'Нямаш пари за ремонта.', n ? 'good' : 'bad'); save();
}
// преустройство на старите сгради: в текущия град — като обекти; в друг — веднага от местния екип
function remodelAllIn(id) {
  const old = (cityEstate(id).owned || []).filter(o => ageOf(o) >= LIFE); let n = 0;
  if (id === S.cityId) { for (const o of old) { if (projects.some(p => p.lot === o.lot) || busyCount() >= officeLv().proj || !econ.canAfford(remodelCost(o))) continue; startOwnedWork(o.lot, 'remodel', true); n++; }
    toast(n ? `🏗️ Пуснати ${n} преустройства${n < old.length ? ` (за останалите няма място в офиса)` : ''}.` : 'Няма свободен капацитет или пари за преустройство.', n ? 'good' : 'bad'); renderPanel(); return; }
  for (const o of old) { const c = remodelCost(o); if (!econ.canAfford(c)) break; econ.spend(c, 'материали', `Преустройство: имот в ${cityById(id).nm}`);
    o.since = S.day; o.lifeWarned = false; o.cond = 100; o.value = Math.round(o.value * 1.3 / 500) * 500; o.rent = Math.round(o.rent * 1.2 / 10) * 10; n++; }
  toast(n ? `🏗️ ${cityById(id).nm}: преустроени ${n} сгради — като нови, с по-висок наем.` : 'Нямаш пари за преустройство.', n ? 'good' : 'bad'); save();
}
function repairAll() {
  const list = est().owned.filter(o => condOf(o) < 80 && !projects.some(p => p.lot === o.lot)).sort((a, b) => condOf(a) - condOf(b));
  let n = 0; for (const o of list) { if (!econ.canAfford(maintCost(o))) break; startOwnedWork(o.lot, 'maint', true); n++; }
  toast(n ? `🔧 Пуснати ${n} ремонта — бригадите тръгват.` : 'Няма имоти за ремонт (или пари).', n ? 'good' : 'bad'); renderPanel();
}
function startOwnedWork(lotId, kind, quiet = false) {
  const o = ownedAt(lotId); if (!o || projects.some(p => p.lot === lotId)) return;
  const cost = kind === 'maint' ? maintCost(o) : remodelCost(o);
  if (!econ.canAfford(cost)) { toast('Нямаш достатъчно пари.', 'bad'); Sound.play('error'); return; }
  if (kind !== 'maint' && busyCount() >= officeLv().proj) { toast('Нямаш свободен капацитет за още обект. Надгради офиса.', 'bad'); return; }
  econ.spend(cost, 'материали', `${BTYPES[kind].nm}: твой имот (${BTYPES[o.kind].nm.toLowerCase()})`);
  delete o.sale;
  const p = { id: S.seq++, type: kind, [kind]: true, lot: lotId, client: 'твой имот', title: `${BTYPES[kind].nm} — твой имот (${BTYPES[o.kind].nm.toLowerCase()})`,
    reward: 0, repGain: 0, startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0, model: city.lots[lotId].built };
  city.lots[lotId].busy = 'project';
  projects.push(p); makeSite(p);
  if (!quiet) toast(kind === 'maint' ? '🔧 Бригадата тръгва за ремонта.' : '🏗️ Преустройството започна.', 'good');
  dispatch(); refreshEstateSigns(); save(); renderPanel();
}
function finishOwnedWork(p) {
  scene.remove(p.vis.g); p.vis = null;
  const o = ownedAt(p.lot), lot = city.lots[p.lot];
  lot.busy = 'owned';
  if (!o) return;
  o.cond = 100;
  if (p.remodel) {
    o.since = S.day; o.lifeWarned = false;
    o.value = Math.round(o.value * 1.3 / 500) * 500; o.rent = Math.round(o.rent * 1.2 / 10) * 10;
    Sound.play('done');
    toast(`✨ Преустройството е готово — сградата е като нова! Наем ${fmt(o.rent)} €/ден, стойност ~${fmt(o.value)} €.`, 'good');
    showEventPop('done-reno', '🏗️ Преустройството е готово!', `Като нова: наем ${fmt(o.rent)} €/ден · стойност ~${fmt(o.value)} €.`);
  } else { Sound.play('done'); toast(`🔧 Ремонтът е готов — ${BTYPES[o.kind].nm.toLowerCase()} е в отлично състояние.`, 'good'); }
}
// събаряне на стара собствена сграда и строеж на по-голяма (с анимацията на събарянето)
function rebuildBigger(lotId) {
  const o = ownedAt(lotId); if (!o || projects.some(p => p.lot === lotId)) return;
  let kind = NEXT_KIND[o.kind]; if (S.rep < BTYPES[kind].rep) kind = o.kind;
  if (busyCount() >= officeLv().proj) { toast('Нямаш свободен капацитет за още обект. Надгради офиса.', 'bad'); return; }
  const bt = BTYPES[kind], lot = city.lots[lotId];
  est().owned.splice(est().owned.indexOf(o), 1);
  const p = { id: S.seq++, type: kind, lot: lotId, client: 'твоя инвестиция', title: `${bt.nm} — твоя инвестиция (събаряне)`, reward: 0, repGain: 0, invest: true,
    startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0, model: buildingFor(kind, kind === 'tower' ? 20 : undefined), demo: lot.obj ? { prog: 0, days: 2.5 } : undefined };
  if (!lot.obj) clearLot(lot);
  lot.busy = 'project';
  projects.push(p); makeSite(p);
  Sound.play('error');
  toast(`🏚️ Старата сграда ще бъде съборена — на мястото ѝ строиш ${bt.nm.toLowerCase()} за наем.`, 'good');
  dispatch(); refreshEstateSigns(); save(); renderPanel();
}
// ---- паркове: строят се на твой парцел; вдигат наемите (+15%) и цените в радиус ~2 карета
const PARK_COST = 25000, PARK_R = 34;
BTYPES.park = { nm: 'Парк', ico: '🌳', est: true, rep: Infinity, repGain: 0, stages: [{ nm: 'Озеленяване', need: { crew: 1, tractor: 1 }, work: 25 }] };
const parksNear = lot => (S.parks || []).filter(id => id !== lot.id && Math.hypot(city.lots[id].x - lot.x, city.lots[id].z - lot.z) <= PARK_R).length;
const parkMul = lot => 1 + Math.min(2, parksNear(lot)) * 0.15;
function buildPark(id) {
  const lot = city.lots[id];
  if (!econ.canAfford(PARK_COST)) { toast('Нямаш достатъчно пари за парка.', 'bad'); return; }
  econ.spend(PARK_COST, 'материали', 'Парк: дървета, алеи, фонтан');
  est().land = est().land.filter(x => x !== id);
  const p = { id: S.seq++, type: 'park', park: true, lot: id, client: 'града', title: 'Парк — твоя инвестиция', reward: 0, repGain: 0, startDay: S.day, deadlineDay: S.day + 999, stage: 0, prog: 0, model: null };
  lot.busy = 'project'; projects.push(p); makeSite(p);
  toast('🌳 Започна строежът на парк.', 'good');
  dispatch(); refreshEstateSigns(); save(); renderPanel();
}
const parkGroups = [];
function placePark(lot) {
  const g = new THREE.Group(); g.position.set(lot.x, 0, lot.z);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshStandardMaterial({ color: 0x6fae4f, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = 0.04; grass.receiveShadow = true; g.add(grass);
  const pathM = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 1 });
  for (const r of [0, Math.PI / 2]) { const pth = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.6), pathM); pth.rotation.x = -Math.PI / 2; pth.rotation.z = r; pth.position.y = 0.06; g.add(pth); }
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.8 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 28), stone); basin.position.y = 0.3; basin.castShadow = true; g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 28), new THREE.MeshStandardMaterial({ color: 0x4aa8e0, roughness: 0.2, metalness: 0.2, emissive: 0x0a3050 }));
  water.position.y = 0.55; g.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 12), stone); col.position.y = 1.1; g.add(col);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, depthWrite: false }));
  jet.position.y = 2.4; jet.rotation.x = Math.PI; g.add(jet); g.userData.jet = jet;
  for (const [x, z] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2], [-5.5, 0.2], [5.5, -0.2]]) { const t = model(Math.random() < 0.5 ? 'tree-large' : 'tree-small', rand(7, 9.5)); t.position.set(x, 0, z); g.add(t); }
  if (A.bench) for (const [x, z, r] of [[-2.6, 3.6, 0], [2.6, -3.6, Math.PI], [3.6, 2.6, -Math.PI / 2], [-3.6, -2.6, Math.PI / 2]]) { const b = model('bench', 1.6); b.position.set(x, 0.05, z); b.rotation.y = r; g.add(b); }
  if (A.lantern) for (const [x, z] of [[-1.4, 6], [1.4, -6]]) { const l = model('lantern', 2.2); l.position.set(x, 0, z); g.add(l); }
  city.group.add(g);
  lot.obj = g; lot.built = 'park';
  parkGroups.push(g);
}
function finishPark(p) {
  scene.remove(p.vis.g); p.vis = null;
  const lot = city.lots[p.lot];
  for (const t of lot.trees || []) city.group.remove(t); lot.trees = [];
  placePark(lot);
  S.parks = [...(S.parks || []), p.lot];
  lot.busy = 'park';
  Sound.play('done');
  const n = est().owned.filter(o => Math.hypot(city.lots[o.lot].x - lot.x, city.lots[o.lot].z - lot.z) <= PARK_R).length;
  toast(`🌳 Паркът е готов! ${n ? `${n} от твоите имоти наоколо носят +15% наем.` : 'Имотите наоколо поскъпват.'}`, 'good');
}
// ---- продажба на твой имот: купувач се появява след 1–3 дни
function listForSale(lotId) { const o = ownedAt(lotId); if (!o || o.sale) return; o.sale = { day: S.day + 1 + (Math.random() * 3 | 0), price: null }; toast('🏷️ Имотът е обявен за продан. Купувач ще се появи до няколко дни.'); refreshEstateSigns(); save(); renderPanel(); }
function sellLand(id) { const price = Math.round(((S.landPrice || {})[id] || lotPrice(city.lots[id])) * rand(1.0, 1.2) / 500) * 500; econ.earn(price, 'обект', 'Продаден парцел'); est().land = est().land.filter(x => x !== id); city.lots[id].busy = null; Sound.play('cash'); toast(`Продаде парцела за ${fmt(price)} €.`, 'good'); refreshEstateSigns(); save(); renderPanel(); }
function acceptSale(lotId) {
  const o = ownedAt(lotId); if (!o?.sale?.price) return;
  econ.earn(o.sale.price, 'обект', `Продаден имот: ${BTYPES[o.kind].nm}`);
  est().owned.splice(est().owned.indexOf(o), 1);
  city.lots[lotId].busy = null;
  Sound.play('cash'); toast(`💰 Продаде имота за ${fmt(o.sale.price)} €!`, 'good');
  showEventPop('sold', '🤝 Сделката е сключена!', `Продаде ${BTYPES[o.kind].nm.toLowerCase()} за ${fmt(o.sale.price)} €.`);
  quests.emit('sold');
  refreshEstateSigns(); save(); renderPanel();
}
function declineSale(lotId) { const o = ownedAt(lotId); if (!o) return; o.sale = { day: S.day + 1 + (Math.random() * 3 | 0), price: null }; refreshEstateSigns(); renderPanel(); }
function cancelSale(lotId) { const o = ownedAt(lotId); if (!o) return; delete o.sale; refreshEstateSigns(); save(); renderPanel(); }
// ---- всеки ден: наеми, купувачи, обяви, инвеститори
function estateDay() {
  const E = est();
  wearOwned(1);
  const rent = E.owned.filter(o => !projects.some(p => p.lot === o.lot)).reduce((a, o) => a + rentNow(o), 0);
  if (rent) econ.earn(rent, 'обект', `Ден ${S.day}: наеми (${E.owned.length} имота)`);
  for (const o of E.owned) if (o.sale && !o.sale.price && S.day >= o.sale.day) {
    o.sale.price = Math.round(o.value * rand(1.0, 1.25) * (1 + 0.04 * S.rep) * (0.6 + 0.4 * condOf(o) / 100) * (ageOf(o) >= LIFE ? 0.8 : 1) / 500) * 500;
    toast(`💰 Купувач предлага ${fmt(o.sale.price)} € за твоя ${BTYPES[o.kind].nm.toLowerCase()}. Виж „Имоти“.`, 'good');
  }
  for (const l of [...E.listings]) if (l.expires < S.day) {
    E.listings.splice(E.listings.indexOf(l), 1);
    const lot = city.lots[l.lot]; lot.busy = null;
    // инвеститор купува къщата: поръчка за събаряне и по-голяма сграда
    const type = S.rep >= 2.5 && Math.random() < 0.5 ? 'office' : S.rep >= 1 ? 'shop' : null;
    if (type) {
      const bt = BTYPES[type], inv = pick(CLIENTS.slice(7));
      S.offers.push(sizeTower({ id: S.seq++, type, lot: lot.id, client: inv, reward: ECON.quoteReward(type, S.rep) + 15000, days: bt.days + 2, expires: S.day + 4, demolish: true }));
      lot.busy = 'offer';
      toast(`🏗️ ${inv} купи къща и иска на мястото ${bt.nm.toLowerCase()} — нова поръчка със събаряне. (натисни)`, '', () => { tab = 'offers'; flyTo(lot); highlightLot(lot.id); renderPanel(); });
    }
  }
  if (E.listings.length < 2 && Math.random() < 0.6) makeListing();
  refreshEstateSigns();
}
// ---- таб „Имоти“
function estateHtml() {
  const E = est();
  const rent = E.owned.reduce((a, o) => a + o.rent, 0), worth = E.owned.reduce((a, o) => a + o.value, 0);
  const needFix = E.owned.filter(o => condOf(o) < 80 && !projects.some(p => p.lot === o.lot)), fixCost = needFix.reduce((a, o) => a + maintCost(o), 0);
  let h = needFix.length ? `<div class="card" style="border-color:var(--acc)"><div class="row" style="margin:0"><span class="meta" style="margin:0">🔧 <b style="color:var(--txt)">${needFix.length}</b> имота имат нужда от ремонт (под 80%)</span><button class="btn" id="bRepairAll" ${econ.canAfford(Math.min(...needFix.map(maintCost))) ? '' : 'disabled'}>Ремонтирай всички · ${fmt(fixCost)} €</button></div><div class="meta" style="margin:4px 0 0">Ремонтите се правят от поддръжката на филиала — не заемат място от „обекти наведнъж“.</div></div>` : '';
  h += `<div class="card"><h3><span class="ico">🔑</span>Твоите имоти</h3><div class="meta">${E.owned.length} имота · наеми <b style="color:var(--ok)">${fmt(rent)} €/ден</b> · стойност ~${fmt(worth)} €</div></div>`;
  for (const o of E.owned) {
    const bt = BTYPES[o.kind], busy = projects.some(p => p.lot === o.lot);
    h += `<div class="card" data-lot="${o.lot}"><h3><span class="ico">${bt.ico}</span>${bt.nm}${o.old ? ' (стара)' : ''}</h3>
      <div class="meta">Наем: <b style="color:var(--ok)">${fmt(rentNow(o))} €/ден</b>${rentNow(o) < o.rent ? ` <s>${fmt(o.rent)}</s>` : ''} · стойност ~${fmt(o.value)} €${busy ? '<br>🔨 Работи се по сградата — не носи наем' : ''}</div>
      ${o.old ? '' : (() => { const c = Math.round(condOf(o)), old5 = ageOf(o) >= LIFE;
        return `<div class="meta">Състояние: <b style="color:${c >= 60 ? 'var(--ok)' : c >= 30 ? 'var(--acc)' : 'var(--bad)'}">${c}%</b> · възраст ${ageTxt(ageOf(o))}${old5 ? ' · <b class="late">над 5 години</b>' : ` · до преустройство ${ageTxt(LIFE - ageOf(o))}`}</div>
        <div class="bar"><i style="width:${c}%;background:${c >= 60 ? 'linear-gradient(90deg,#3fa96a,#4cd07d)' : c >= 30 ? '' : 'linear-gradient(90deg,#c0392b,#ff6b6b)'}"></i></div>
        ${busy ? '' : `<div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap">
          ${c < 95 ? `<button class="btn${c < 60 ? '' : '2'}" data-maint="${o.lot}">🔧 Ремонт (${fmt(maintCost(o))} €)</button>` : ''}
          ${old5 ? `<button class="btn" data-remodel="${o.lot}">🏗️ Преустрой (${fmt(remodelCost(o))} €)</button><button class="btn2" data-rebuild="${o.lot}" title="Събаряне и строеж на ${BTYPES[S.rep >= BTYPES[NEXT_KIND[o.kind]].rep ? NEXT_KIND[o.kind] : o.kind].nm.toLowerCase()} (плащаш материалите)">🏚️ Събори → ${BTYPES[S.rep >= BTYPES[NEXT_KIND[o.kind]].rep ? NEXT_KIND[o.kind] : o.kind].ico}</button>` : ''}</div>`}`; })()}
      <div class="row" style="justify-content:flex-end;gap:6px">
        ${o.old && !busy ? `<button class="btn" data-reno="${o.lot}">🔨 Ремонт (${fmt(RENO_COST)} €)</button>` : ''}
        ${o.sale?.price ? `<button class="btn2" data-decl="${o.lot}">Откажи</button><button class="btn" data-sale="${o.lot}">Продай за ${fmt(o.sale.price)} €</button>`
          : o.sale ? `<span class="meta">Чака купувач…</span><button class="btn2" data-cancel="${o.lot}">Спри</button>`
          : busy ? '' : `<button class="btn2" data-sell="${o.lot}">🏷️ Продай</button>`}</div></div>`;
  }
  if (E.land.length) h += `<div class="sect">Твоите парцели</div>`;
  for (const id of E.land) {
    const lot = city.lots[id];
    h += `<div class="card" data-lot="${id}"><h3><span class="ico">🟩</span>Парцел · ${lot.zone === 'center' ? 'център' : lot.zone === 'mid' ? 'среден пояс' : 'покрайнини'}</h3><div class="meta">Какво да построиш (за наем):</div>
      <div class="row" style="flex-wrap:wrap;justify-content:flex-start;gap:6px">${Object.entries(RENT).map(([k, r]) => {
        const bt = BTYPES[k], ok = S.rep >= bt.rep, qd = (S.buildQ || []).find(q => q.lot === id && q.type === k);
        return `<button class="btn${qd ? '' : '2'}" data-build="${id}:${k}" title="${ok ? `Наем ~${fmt(r)} €/ден` : `Нужна репутация ${bt.rep} ★ — маркирай го и ще се построи сам, щом я стигнеш`}">${bt.ico} ${bt.nm} · ${fmt(r)}€/ден${ok ? '' : ` · 🔒${bt.rep}★`}</button>`; }).join('')}</div>
      ${(S.buildQ || []).some(q => q.lot === id) ? `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0;color:var(--acc)">⏳ На опашка: ${BTYPES[S.buildQ.find(q => q.lot === id).type].nm} (№${S.buildQ.findIndex(q => q.lot === id) + 1}) — ${S.rep < BTYPES[S.buildQ.find(q => q.lot === id).type].rep ? `чака ${BTYPES[S.buildQ.find(q => q.lot === id).type].rep} ★` : 'започва сам'}</span><button class="btn2" data-unq="${id}">Махни</button></div>` : ''}
      <div class="row" style="justify-content:space-between"><button class="btn2" data-park="${id}" title="+15% наем за твоите имоти наоколо и по-скъпи парцели">🌳 Парк · ${fmt(PARK_COST)} €</button><button class="btn2" data-sellland="${id}">Продай парцела</button></div></div>`;
  }
  h += `<div class="sect">Къщи за продан</div>`;
  if (!E.listings.length) h += `<div class="meta">Няма обяви в момента. Нови идват почти всеки ден.</div>`;
  for (const l of E.listings) h += `<div class="card" data-lot="${l.lot}"><h3><span class="ico">🏷️</span>Къща за продан</h3>
    <div class="meta">Обявата важи до ден ${l.expires}. Ако не я купиш, може да я вземе инвеститор и да я събори за по-голяма сграда.</div>
    <div class="row"><span class="money" style="color:var(--txt)">${fmt(l.price)} €</span><button class="btn" data-buyl="${l.id}" ${econ.canAfford(l.price) ? '' : 'disabled'}>Купи</button></div></div>`;
  const landFull = E.land.length >= MAX_LAND;
  h += `<div class="sect">Свободни парцели · твои ${E.land.length}/${MAX_LAND}</div>`;
  if (landFull) h += `<div class="meta late">Имаш максимума от ${MAX_LAND} празни парцела — застрой или продай някой, за да купиш нов.</div>`;
  const free = city.lots.filter(l => !l.built && !l.busy).sort((a, b) => lotPrice(a) - lotPrice(b));
  for (const lot of [...free.filter(l => l.zone === 'outer').slice(0, 2), ...free.filter(l => l.zone === 'mid').slice(0, 2), ...free.filter(l => l.zone === 'center').slice(0, 1)])
    h += `<div class="row card" style="margin:0" data-lot="${lot.id}"><span class="meta" style="margin:0">🟩 ${lot.zone === 'center' ? 'Център' : lot.zone === 'mid' ? 'Среден пояс' : 'Покрайнини'}</span><button class="btn" data-land="${lot.id}" ${econ.canAfford(lotPrice(lot)) && !landFull ? '' : 'disabled'}>Купи ${fmt(lotPrice(lot))} €</button></div>`;
  return h;
}
function bindEstate(el) {
  const on = (sel, f) => el.querySelectorAll(sel).forEach(b => b.onclick = e => { e.stopPropagation(); f(b); });
  on('[data-land]', b => buyLand(+b.dataset.land));
  on('[data-unq]', b => { S.buildQ = (S.buildQ || []).filter(q => q.lot !== +b.dataset.unq); save(); renderPanel(); });
  if (el.querySelector('#bRepairAll')) el.querySelector('#bRepairAll').onclick = repairAll;
  on('[data-build]', b => { const [id, k] = b.dataset.build.split(':'); buildOnLand(+id, k); });
  on('[data-buyl]', b => buyListing(+b.dataset.buyl));
  on('[data-reno]', b => startReno(+b.dataset.reno));
  on('[data-maint]', b => startOwnedWork(+b.dataset.maint, 'maint'));
  on('[data-remodel]', b => startOwnedWork(+b.dataset.remodel, 'remodel'));
  on('[data-rebuild]', b => rebuildBigger(+b.dataset.rebuild));
  on('[data-sell]', b => listForSale(+b.dataset.sell));
  on('[data-sale]', b => acceptSale(+b.dataset.sale));
  on('[data-decl]', b => declineSale(+b.dataset.decl));
  on('[data-cancel]', b => cancelSale(+b.dataset.cancel));
  on('[data-sellland]', b => sellLand(+b.dataset.sellland));
  on('[data-park]', b => buildPark(+b.dataset.park));
}

// ============================================================ много градове: централа + филиали, всеки е пълен град
// Активният град е в обичайните полета на S (offers, projects, units, …), останалите са „прибрани“ в S.cities[id].
// Общи за фирмата: пари, репутация, жп мрежа, влакове, магистрали, склад (econ).
const CITY_KEYS = ['offers', 'projects', 'built', 'cleared', 'cash', 'estate', 'landPrice', 'units', 'unitXp', 'staff', 'dev', 'autoFill', 'officeLevel', 'officeStyle', 'buildQ', 'garageLevel', 'garageLot', 'parks',
  'whLevel', 'whLot', 'stationLevel', 'stationBuild', 'cityExt', 'megaV', 'rbuild', 'lotAuto'];
function newCityState() {
  return { offers: [], projects: [], built: [], cleared: [], cash: [], estate: { land: [], owned: [], listings: [] }, landPrice: {},
    units: [...ECON.START.units], officeLevel: 1, garageLevel: 1, garageLot: null, whLevel: 0, whLot: null, stationLevel: 0, stationBuild: null, cityExt: 0, staff: {}, dev: { xp: 0, lv: 1, v: 3 }, autoFill: undefined };
}
const ownedCities = () => [S.hqCity, ...(S.branches || [])];
const nowDays = () => S.day + S.dayT / DAY_SEC;
function stashCity() {
  const c = {};
  S.projects = projects;
  syncUnits();
  for (const k of CITY_KEYS) c[k] = S[k];
  c.left = nowDays();
  S.cities[S.cityId] = JSON.parse(JSON.stringify(c, (k, v) => k === 'vis' ? undefined : v));
}
function switchCity(id) {
  if (id === S.cityId) return enterCity();
  syncFinishedFleet();
  stashCity();
  if (econ.stashStock) S.cities[S.cityId].mat = econ.stashStock();   // складът е на града
  const c = S.cities[id] || newCityState();
  if (!c.dev) c.dev = { xp: 0, lv: 1, v: 3 };   // стар запис: новото развитие на града започва от 1
  if (!c.staff) c.staff = {};
  if (econ.loadStock) econ.loadStock(c.mat || { stock: {}, transit: [] });
  delete c.mat;
  delete S.cities[id];
  for (const k of CITY_KEYS) S[k] = c[k];
  S.cityId = id;
  projects.length = 0; projects.push(...(S.projects || [])); S.projects = projects;   // живият масив вече е на новия град
  S.ffFrom = c.left ?? null;
  // градът се изгражда наново от записа (както при новите квартали)
  if (AUTOTEST) sessionStorage.setItem('stroiAT', JSON.stringify(S, (k, v) => k === 'vis' ? undefined : v));
  else save();
  sessionStorage.setItem('stroiEnter', '1');
  location.reload();
}
// обектите продължават, докато те няма: превъртане напред със същите правила (техника от града, материали)
function fastForward() {
  if (S.ffFrom == null) return;
  const days = nowDays() - S.ffFrom;
  if (days > 0) wearOwned(days);
  delete S.ffFrom;
  if (days < 0.05) return;
  let done = 0;
  for (const p of [...projects]) {
    if (p.own) continue;
    if (p.demo) finishDemo(p);   // докато те нямаше, събарянето е приключило
    let left = days;
    while (left > 0 && projects.includes(p)) {
      const st = BTYPES[p.type].stages[p.stage]; if (!st) break;
      const have = r => S.units.filter(t => t === r).length;
      if (Object.keys(st.need).some(r => have(r) < 1) || !ensureMaterials(p, { instant: true })) break;
      const n = Object.entries(st.need).reduce((a, [r, c]) => a + Math.min(c, have(r)), 0);
      const rate = RATE * n / (st.work * workMul(p)), need = (1 - p.prog) / rate;
      if (need <= left) { left -= need; p.prog = 1; const was = projects.length; nextStage(p); if (projects.length < was) done++; }
      else { p.prog += rate * left; left = 0; }
    }
  }
  toast(`⏩ Докато те нямаше ${Math.round(days)} дни: ${done ? `${done} обекта са завършени — вземи парите от покривите!` : 'обектите напреднаха.'}`, 'good');
}

// ============================================================ прозорци „ЖП“ и „Магистрали“ (бутони в горната лента)
let bigWin = null;
// ---- обхват на прозорците (ЖП, Магистрали, Пристанища, Летища): България · Балкани · Континент · Международни · Всички.
// По подразбиране следва изгледа на картата; бутоните горе го сменят.
let bwScope = null;
const SCOPES = [['bg', '🇧🇬', 'България'], ['balkans', '🌍', 'Балкани'], ['cont', '🗺️', 'Континент'], ['intl', '🌐', 'Международни'], ['all', '🌎', 'Всички']];
const isBGc = id => !isForeign(id);
const isBalkc = id => !isForeign(id) || (!isEurope(id) && !isWorld(id));
const contKeyOf = id => { const k = contOf(id)?.key; return k === 'na' || k === 'sa' ? 'am' : k || (isWorld(id) ? 'world' : 'eu'); };
const viewCont = () => { const v = curView(); return ['af', 'am', 'as', 'oc'].includes(v) ? v : 'eu'; };
const CONT_NM = { eu: 'Европа', af: 'Африка', am: 'Америка', as: 'Азия', oc: 'Австралия' };
const scopeNow = () => bwScope || ({ bg: 'bg', balkans: 'balkans', world: 'intl' })[curView()] || 'cont';
function inScope(...ids) {   // всички градове на обекта (линия, участък, пристанище…)
  const sc = scopeNow(); ids = ids.filter(Boolean);
  if (sc === 'all' || !ids.length) return true;
  if (sc === 'bg') return ids.every(isBGc);
  if (sc === 'balkans') return ids.every(isBalkc) && !ids.every(isBGc);
  const ks = ids.map(contKeyOf);
  if (sc === 'intl') return new Set(ks).size > 1;
  return ks.every(k => k === viewCont()) && !(viewCont() === 'eu' && ids.every(isBalkc));   // континентът без чисто балканските
}
const scopeBar = () => `<div class="bw-scope">${SCOPES.map(([k, ico, nm]) => `<button class="${scopeNow() === k ? 'btn' : 'btn2'}" style="padding:4px 9px;font-size:12px" data-scope="${k}">${ico} ${k === 'cont' ? CONT_NM[viewCont()] : nm}</button>`).join('')}</div>`;
function openBig(kind) {
  if (!S) return;
  if (bigWin !== kind) bwScope = null;   // ново отваряне — обхватът пак следва картата
  bigWin = kind;
  let el = $('bigWin');
  if (!el) {
    el = document.createElement('div'); el.id = 'bigWin';
    el.innerHTML = `<div class="bw-box"><div class="bw-head"><b id="bwTitle"></b><button class="btn2" id="bwClose">✕ Затвори</button></div><div id="bwBody"></div></div>`;
    document.body.appendChild(el);
    $('bwClose').onclick = closeBig;
    el.onclick = e => { if (e.target === el) closeBig(); };
  }
  el.classList.remove('hidden');
  renderBig();
}
function closeBig() { bigWin = null; $('bigWin')?.classList.add('hidden'); }
function renderBig() {
  const body = $('bwBody'); if (!body || !bigWin) return;
  if (body.contains(document.activeElement) && (document.activeElement.tagName === 'SELECT' || document.activeElement.type === 'range')) return;   // не пречи на отворен падащ списък
  const sc = body.scrollTop;
  if (bigWin === 'bank') {   // банката в прозорец (без прехвърляне в града); не се пречертава всяка секунда — само при действие
    $('bwTitle').innerHTML = '🏦 Банка и финанси';
    if (!body.dataset.bank || body.dataset.bankT !== String(econ.s.day)) { body.dataset.bank = '1'; body.dataset.bankT = String(econ.s.day); body.innerHTML = '<div id="bwBank" style="display:flex;flex-direction:column;gap:10px"></div>'; ECON.renderFinance ? ECON.renderFinance($('bwBank'), econ, S.rep, () => { save(); body.dataset.bank = ''; renderBig(); renderPanel(); }, units.map(u => u.type), { connectedCityIds: connected(), roadCityIds: supplyOpts().roadCityIds, stocksOpen: dev.stocksOpen(), devLevel: dev.best() }) : renderBank($('bwBank')); body.scrollTop = sc; }
    return;
  }
  body.dataset.bank = '';
  $('bwTitle').innerHTML = bigWin === 'rail' ? `${trainImg('mid', 26)} Железопътна мрежа` : bigWin === 'fin' ? '🏁 Завършени градове' : bigWin === 'resort' ? '🏔️ Курорти' : bigWin === 'garage' ? '🚜 Гараж — цялата техника' : bigWin === 'super' ? '⭐ Супер поръчки' : bigWin === 'air' ? '✈️ Летища и авиолинии' : bigWin === 'sea' ? '⚓ Пристанища и морски линии' : '🛣️ Магистрали и тол системи';
  body.innerHTML = (['rail', 'hw', 'sea', 'air'].includes(bigWin || 'hw') ? scopeBar() : '') + (bigWin === 'rail' ? railWinHtml() : bigWin === 'fin' ? finWinHtml() : bigWin === 'resort' ? resorts.winHtml() : bigWin === 'garage' ? garageWinHtml() : bigWin === 'super' ? superWinHtml() : bigWin === 'air' ? airWinHtml() : bigWin === 'sea' ? seaWinHtml() : hwWinHtml());
  body.scrollTop = sc;
  const on = (sel, f) => body.querySelectorAll(sel).forEach(b => b.onclick = () => f(b));
  on('[data-railview]', b => { closeBig(); openHwView(b.dataset.railview); });
  on('[data-hwview]', b => { closeBig(); openHwView(b.dataset.hwview); });
  on('#garAuto', () => { garAuto(); renderBig(); });
  on('[data-garcity]', b => { garSel = garSel === b.dataset.garcity ? null : b.dataset.garcity; renderBig(); });
  on('[data-garmv]', b => { const t = b.dataset.garmv, to = body.querySelector(`[data-garto="${t}"]`)?.value; if (to) garMove(t, garSel, to, 1); renderBig(); renderPanel(); });
  on('[data-garbuy]', b => { garBuy(b.dataset.garbuy, garSel); renderBig(); renderPanel(); });
  on('[data-resort-open]', b => resorts.open(b.dataset.resortOpen));
  on('[data-buytrain]', b => { buyTrain(b.dataset.buytrain); renderBig(); });
  on('[data-scope]', b => { bwScope = b.dataset.scope; renderBig(); });
  on('[data-hw]', b => { takeSeg(b.dataset.hw); renderBig(); });
  on('[data-ab]', b => { takeSeg(b.dataset.ab); renderBig(); });
  on('[data-hwunq]', b => { S.hwQueue = hwQueue().filter(x => x !== b.dataset.hwunq); save(); renderBig(); });
  on('[data-hsup]', b => { startHsUpgrade(+b.dataset.hsup); renderBig(); });
  on('[data-sellship]', b => { sellShip(+b.dataset.sellship); renderBig(); });
  on('[data-upship]', b => { upgradeShip(+b.dataset.upship); renderBig(); });
  on('[data-selltrain]', b => { sellTrain(+b.dataset.selltrain); renderBig(); });
  on('[data-uptrain]', b => { upgradeTrain(+b.dataset.uptrain); renderBig(); });
  on('#bwNewRail', () => { closeBig(); startRailMode(); });
  on('[data-airport]', b => { buildAirport(b.dataset.airport); renderBig(); });
  on('[data-plane]', b => { buyPlane(b.dataset.plane); renderBig(); });
  on('[data-port]', b => { buildPort(b.dataset.port); renderBig(); });
  body.querySelectorAll('[data-autoline]').forEach(b => b.onchange = () => { S.autoLines = { ...(S.autoLines || {}), [b.dataset.autoline]: b.checked }; if (b.checked) autoLines(); save(); renderBig(); });
  on('[data-linkc]', b => { const [a, id] = b.dataset.linkc.split(':'); linkAct(a, id); renderBig(); });
  on('[data-ship]', b => { buyShip(b.dataset.ship); renderBig(); });
  on('#srOpen', () => { openSeaRoute(seaSelA, seaSelB); seaSelB = null; renderBig(); });
  if ($('srA')) $('srA').onchange = e => { seaSelA = e.target.value; seaSelB = null; renderBig(); };
  if ($('srB')) $('srB').onchange = e => { seaSelB = e.target.value || null; e.target.blur(); renderBig(); };
  on('#arOpen', () => { openAirRoute(airSelA, airSelB); airSelB = null; renderBig(); });
  if ($('arA')) $('arA').onchange = e => { airSelA = e.target.value; airSelB = null; renderBig(); };
  if ($('arB')) $('arB').onchange = e => { airSelB = e.target.value || null; e.target.blur(); renderBig(); };
  on('[data-hwmove]', b => { const [seg, id] = b.dataset.hwmove.split('|'); hwMoveGear(seg, id); });
  on('[data-buyroad]', () => $('bwBuyRoad') ? $('bwBuyRoad').click() : (closeBig(), !$('mapScreen').classList.contains('hidden') && showMap(false), tab = 'fleet', renderPanel(), setTimeout(() => $('roadSect')?.scrollIntoView({ block: 'start' }), 80)));
  on('#bwBuyRoad', () => { closeBig(); if (!$('mapScreen').classList.contains('hidden')) showMap(false); tab = 'fleet'; renderPanel(); setTimeout(() => $('roadSect')?.scrollIntoView({ block: 'start' }), 80); });
  on('[data-fenter]', b => { closeBig(); switchCity(b.dataset.fenter); });
  on('#bwMoveFleet', () => offerFleetMove());
  on('[data-oe-build]', b => { const [x, y] = b.dataset.oeBuild.split(':'); orientBuild(x, y); renderBig(); });
  on('[data-oe-up]', b => { startHsUpgrade(+b.dataset.oeUp); renderBig(); });
  on('[data-oe-ask]', () => orient.ask());
  on('[data-r66]', b => { takeAutobahn(b.dataset.r66); renderBig(); });
  on('[data-mega]', b => { const [k, i] = b.dataset.mega.split('|'); mega.build(k, +i); renderBig(); });
  on('[data-mega-ask]', b => mega.ask(b.dataset.megaAsk));
  on('[data-mega-works]', b => { mega.startWorks(b.dataset.megaWorks); renderBig(); });
  on('[data-r66-ask]', () => route66.ask());
  on('[data-shortcut]', b => { const [x, y] = b.dataset.shortcut.split(':'); offerShortcut(x, y, renderBig); });
  on('[data-branch]', b => { const o = branchFor(b.dataset.branch); if (o) offerBranch(o, renderBig); });
}
// ---- завършените градове: бутон 🏁 в лентата и прозорец
// дневният приход на завършен град (както в economy.payFinished); активният град — с текущата му техника
function finInfo(id) {
  const f = econ.s.finished[id], fleet = id === S.cityId ? units.map(u => u.type) : (f.fleet || []);
  const mul = econ.maintOf ? econ.maintOf({ fleet }) : 1, upkeep = fleet.reduce((a, t) => a + (ECON.UNIT_TYPES[t]?.upkeep || 0), 0);
  return { f, fleet, mul, upkeep, daily: Math.round(f.daily * f.share / (f.share0 || f.share) * mul) };
}
const finIds = () => Object.keys((econ && econ.s.finished) || {});
function updFinBtn() {
  const b = $('finBtn'); if (!b) return;
  const ids = S && econ ? finIds() : [];
  b.style.display = ids.length ? '' : 'none';
  if (ids.length) b.innerHTML = `🏁 +${fmt(ids.reduce((a, id) => { const i = finInfo(id); return a + i.daily - i.upkeep; }, 0))} €/ден`;
}
function finWinHtml() {
  const ids = finIds(), inf = Object.fromEntries(ids.map(id => [id, finInfo(id)])), away = ids.filter(id => id !== S.cityId);
  const tot = ids.reduce((a, id) => a + inf[id].daily, 0), upk = ids.reduce((a, id) => a + inf[id].upkeep, 0);
  let h = `<div class="bw-stats"><div><b>${fmt(tot - upk)} €</b><span>чисто на ден</span></div><div><b>${ids.length}</b><span>завършени града</span></div><div><b>${fmt(ids.reduce((a, id) => a + (inf[id].f.earned || 0), 0))} €</b><span>спечелено общо</span></div><div><b>${ids.reduce((a, id) => a + inf[id].fleet.length, 0)}</b><span>единици за поддръжка</span></div></div>
    <div class="meta">Завършеният град носи пари всеки ден автоматично — и докато си в него; парите от покривите се прибират сами. Всяка единица техника там вдига прихода с 3% (до ×1.30) и пази дела от конкурентите; без техника приходът е ×0.70.</div>`;
  for (const id of ids) {
    const { f, fleet, mul, upkeep, daily } = inf[id], here = id === S.cityId;
    h += bwCard(`🏁 ${cityById(id).nm} <span class="meta" style="margin:0 0 0 auto"><b style="color:var(--ok)">+${fmt(daily - upkeep)} €/ден</b>${here ? ' · тук си' : ''}</span>`,
      `<div class="meta">Приход ~${fmt(daily)} €/ден · дял от пазара ${Math.round(f.share * 100)}% · спечелено ${fmt(f.earned || 0)} €<br>🔧 Поддръжка: ${fleet.length ? `${fleet.length} единици · ×${mul.toFixed(2)} · <span class="late">−${fmt(upkeep)} €/ден</span>` : '<span class="late">няма техника — ×0.70 и делът бавно пада</span>'}</div>
      <div class="row" style="justify-content:flex-end;gap:6px">${here ? (units.length && ownedCities().length > 1 ? '<button class="btn2" id="bwMoveFleet">🚚 Премести техниката</button>' : '') : `<button class="btn" data-fenter="${id}">Влез</button>`}</div>`);
  }
  if (!econ.isFinished(S.cityId)) {
    const sh = Math.round(rivals.share() * 100);
    h += bwCard(`⏳ ${cityName()} — до завършване`, `<div class="meta">${(S.cityExt || 0) >= extNeed() ? '✅' : '⬜'} Нови квартали: ${Math.min(S.cityExt || 0, extNeed())}/${extNeed()}<br>${freeLotCount() <= 1 ? '✅' : '⬜'} Свободни парцели ≤ 1 (сега ${freeLotCount()})<br>${sh >= 60 ? '✅' : '⬜'} Твой дял от пазара ≥ 60% (сега ${sh}%)</div>`);
  }
  return h;
}
const bwCard = (title, inner) => `<div class="card"><h3>${title}</h3>${inner}</div>`;
function railWinHtml() {
  const rails = (S.rails || []).filter(r => inScope(r.a, r.b, r.c)), built = rails.filter(r => r.built), building = rails.filter(r => !r.built), trains = S.trains || [];
  const km = built.reduce((a, r) => a + (r.km || 0), 0);
  let h = `<div class="bw-stats"><div><b>${built.length}</b><span>готови линии</span></div><div><b>${fmt(km)} км</b><span>релси</span></div><div><b>${building.length}</b><span>в строеж</span></div><div><b>${trains.length} / ${totalTracks()}</b><span>влакове / коловози</span></div><div><b>${connectedCities().length}</b><span>свързани града</span></div></div>`;
  h += `<div class="row" style="justify-content:flex-end"><button class="btn" id="bwNewRail">🛤️ Строй нова линия</button></div>`;
  h += orient.cardHtml();
  h += bwCard('🛤️ Линии', (rails.length ? rails.map(r => {
    const st = r.built ? { stage: 4, prog: 1 } : railStageOf(r.prog);
    return `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0">${r.built ? '✅' : RAIL_STAGES[st.stage].ico} <b style="color:var(--txt)">${r.c ? `🔀 ${cityById(r.a).nm} ⤳ линия ${cityById(r.b).nm} — ${cityById(r.c).nm}` : `${cityById(r.a).nm} — ${cityById(r.b).nm}`}</b> · ${r.km} км${r.built ? '' : ` · ${RAIL_STAGES[st.stage].nm} ${Math.floor(r.prog * 100)}%`}</span><button class="btn2" data-railview="rail:${r.a}-${r.b}">👁 Виж</button></div>${r.built ? '' : `<div class="bar"><i style="width:${(r.prog * 100).toFixed(1)}%"></i></div>`}${!r.built || r.c ? '' : r.hs ? '<div class="meta" style="margin:0 0 4px;color:#3fa7ff">⚡ Скоростна линия — за „Стрела“</div>' : r.hsBuild ? `<div class="meta" style="margin:0">⚡ Модернизира се ${Math.floor(r.hsBuild.prog * 100)}%</div><div class="bar"><i style="width:${(r.hsBuild.prog * 100).toFixed(1)}%;background:#3fa7ff"></i></div>` : `<div class="row" style="justify-content:flex-end;margin:0 0 4px"><button class="btn2" data-hsup="${(S.rails || []).indexOf(r)}" ${econ.canAfford(hsQuote(r).cost) ? '' : 'disabled'} title="${hsQuote(r).days} дни">⚡ Модернизирай за „Стрела“ · ${fmt(hsQuote(r).cost)} €</button></div>`}`;
  }).join('') : '<div class="meta">Още нямаш жп линии.</div>'));
  if (dev.has('LINKS')) { const bc = branchCands().filter(o => inScope(o.id, o.host.a, o.host.b)); h += bwCard('🔀 Отклонения от готовите линии', bc.length ? bc.map(o => `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0">🔀 <b style="color:var(--txt)">${cityById(o.id).nm}</b> ⤳ линия ${cityById(o.host.a).nm} — ${cityById(o.host.b).nm} · ${o.km} км · ${o.days} дни</span><button class="btn" data-branch="${o.id}">Строй ${fmt(o.cost)} €</button></div>`).join('') : '<div class="meta">Няма градове близо до готовите ти линии. Построй още линии — после ще можеш да отклониш близките градове към тях.</div>'); }
  if (dev.has('LINKS')) { const sc = shortcutCands().filter(o => inScope(o.a, o.b)).slice(0, 8); if (sc.length) h += bwCard('⚡ Преки връзки <span class="meta" style="margin:0 0 0 auto">близки градове, до които влакът заобикаля</span>', sc.map(o => `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0">⚡ <b style="color:var(--txt)">${cityById(o.a).nm} — ${cityById(o.b).nm}</b> · ${o.km} км вместо ${fmt(o.now)} км по мрежата · <span style="color:var(--ok)">−${fmt(o.save)} км</span> · ${o.days} дни</span><button class="btn" data-shortcut="${o.a}:${o.b}" ${econ.canAfford(o.cost) ? '' : 'disabled'}>Строй ${fmt(o.cost)} €</button></div>`).join('')); }
  const tripTxt = t => { const j = t.job; if (!j) return 'чака курс в ' + cityById(t.at).nm;
    const pct = Math.floor(t.km / Math.max(1, t.total) * 100);
    return `${j.ico} ${j.cargo} ${cityById(j.from).nm} → ${cityById(j.to).nm} · ${t.leg === 'empty' ? `отива за товара (${pct}%)` : `${pct}%`}`; };
  h += bwCard(`${trainImg('mid', 20)} Влакове · ${trains.length}/${totalTracks()} <span class="meta" style="margin:0 0 0 auto">курсовете са случайни</span>`, (trains.length ? trains.map(t => `<div class="row" style="margin:6px 0;align-items:center"><span class="meta" style="margin:0">${trainImg(t.kind || 'small', 26)} <b style="color:var(--txt)">${t.nm}</b> · ${trainWagons(t)} ваг.<br>${tripTxt(t)}</span>${t.job && !t.job.empty ? `<b style="color:var(--ok);font-size:16px">+${fmt(t.job.pay ?? t.job.reward ?? 0)} €</b>` : ''}</div>${(() => { const T = trainType(t), nx = TRAIN_NEXT[t.kind || 'small']; return `<div class="row" style="margin:0 0 6px;justify-content:flex-end">${fleetBtns('train', t.id, nx, nx && TRAIN_TYPES[nx], nx ? upCost(T, TRAIN_TYPES[nx]) : 0, Math.round(T.cost * TRADE_IN / 1000) * 1000)}</div>`; })()}`).join('') : '<div class="meta">Нямаш влакове.</div>') + stationsOverview());
  h += totalTracks() > trains.length ? bwCard(`${trainImg('mid', 20)} Купи влак`, trainShopHtml()) : `<div class="meta">${trainShopHtml()}</div>`;
  if ((S.jobs || []).length) h += bwCard('📦 Чакащи превози <span class="meta" style="margin:0 0 0 auto">товарните влакове ги поемат сами</span>', S.jobs.map(j => `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0">${j.ico} ${j.wagons} вагона ${j.cargo} · ${cityById(j.from).nm} → ${cityById(j.to).nm} · ${j.km} км</span><b style="color:var(--ok)">+${fmt(j.reward)} €</b></div>`).join(''));
  return h;
}
function hwWinHtml() {
  const lockMsg = !dev.has('LINKS') ? `<div class="meta late">🔒 Магистралите се отключват на ниво 2 на развитие.</div>` : !hwRepOk() ? `<div class="meta late">🔒 Държавните поръчки изискват репутация ${HW_REP} ★.</div>` : '';
  const all = HIGHWAYS.filter(hw => (!hw.intl || dev.has('BALKANS')) && inScope(...hw.segs.flat()));
  const doneSegs = hw => hw.segs.filter((_, i) => hwDone().includes(segId(hw, i))).length;
  const jobs = S.hwJobs || [], can = jobs.length < HW_MAX_JOBS();
  const missTxt = hwMissingTxt();
  const scAb = AUTOBAHNS.filter(c => abShown(c) && inScope(...c.cities)), scToll = all.reduce((a, hw) => a + hwTollOf(hw), 0) + scAb.reduce((a, c) => a + abTollOf(c), 0);
  const scDone = new Set([...all.flatMap(hw => hw.segs.map((_, i) => segId(hw, i))), ...scAb.flatMap(corridorSegIds)].filter(id => hwDone().includes(id))).size;
  let h = `<div class="bw-stats"><div><b>${fmt(scToll)} €</b><span>тол на ден</span></div><div><b>${scDone}</b><span>готови участъка</span></div><div><b>${all.filter(hw => doneSegs(hw) === hw.segs.length).length} / ${all.length}</b><span>цели магистрали</span></div><div><b>${jobs.length} / ${HW_MAX_JOBS()}</b><span>строят се</span></div></div>${lockMsg}${missTxt && !lockMsg ? `<div class="row" style="margin:0"><span class="meta late" style="margin:0">🚜 ${missTxt} — без нея участъците чакат.</span><button class="btn" id="bwBuyRoad">🚜 Купи пътна техника</button></div>` : ''}`;
  h += route66.cardHtml();   // 🛣️ Route 66 (специална поръчка)
  if (hwQueue().length) h += bwCard(`📋 На опашка (${hwQueue().length}) — започват сами при свободен екип`, hwQueue().map((id, i) => { const g = segById(id); return g ? `<div class="row" style="margin:3px 0"><span class="meta" style="margin:0">${i + 1}. ${g.ab ? '🔴' : '🛣️'} ${cityById(g.a).nm} — ${cityById(g.b).nm} · ${kmBetween(g.a, g.b)} км</span><button class="btn2" data-hwunq="${id}">✕</button></div>` : ''; }).join(''));
  if (jobs.length) h += bwCard('🚧 В строеж', jobs.map(j => { const s = segById(j.seg), st = stagesOf(j)[j.stage]; return `<div class="row" style="margin:4px 0"><span class="meta" style="margin:0">${st.ico} <b style="color:var(--txt)">${j.ab ? '🔴 Аутобан' : 'АМ'} „${s.hw.nm}“ ${cityById(s.a).nm} — ${cityById(s.b).nm}</b> · ${st.nm} ${Math.floor(j.prog * 100)}%<br>🚜 техника от ${cityById(hwCityOf(j)).nm}${hwLackOf(j).length ? ` · <span class="late">⏸ чака: ${lackTxt(hwLackOf(j))}</span>` : ''}</span><span style="display:flex;gap:6px">${(g => g ? `<button class="btn" data-hwmove="${j.seg}|${g.id}" title="Свободната техника от ${cityById(g.id).nm} поема участъка">🚜 От ${cityById(g.id).nm} · ${g.km ? fmt(g.km) + ' км' : 'на трасето'}</button>` : '')(hwNearestGear(j))}<button class="btn2" data-hwview="${j.seg}">👁 Виж</button></span></div><div class="bar"><i style="width:${((j.stage + j.prog) / stagesOf(j).length * 100).toFixed(1)}%"></i></div>`; }).join(''));
  // първо магистралите без тол система (нито един готов участък), после започнатите
  const order = [...all].sort((a, b) => (doneSegs(a) ? 1 : 0) - (doneSegs(b) ? 1 : 0) || doneSegs(b) / b.segs.length - doneSegs(a) / a.segs.length);
  for (const hw of order) {
    const n = doneSegs(hw);
    const rows = hw.segs.map((sg, i) => {
      const id = segId(hw, i), s = segById(id), km = kmBetween(s.a, s.b), done = hwDone().includes(id), job = jobs.find(j => j.seg === id);
      if (done) return `<div class="meta" style="margin:2px 0">✅ ${cityById(s.a).nm} — ${cityById(s.b).nm} · ${km} км</div>`;
      if (job) return `<div class="meta" style="margin:2px 0">🚧 ${cityById(s.a).nm} — ${cityById(s.b).nm} · ${km} км · строи се</div>`;
      const q = segmentQuote(km);
      return `<div class="row" style="margin:3px 0"><span class="meta" style="margin:0">⬜ ${cityById(s.a).nm} — ${cityById(s.b).nm} · ${km} км · ${q.days} дни · тол <b style="color:var(--ok)">+${fmt(tollGain(s))} €/ден</b></span><button class="btn" data-hw="${id}" ${!lockMsg && !hwQueue().includes(id) ? '' : 'disabled'} title="${missTxt}">${hwQueue().includes(id) ? '📋 на опашка' : can ? `Строй +${fmt(q.reward)} €${missTxt ? ' ⚠️' : ''}` : '📋 На опашка'}</button></div>`;
    }).join('');
    h += bwCard(`${n ? '🎫' : '🚫'} АМ „${hw.nm}“ <span class="meta" style="margin:0 0 0 auto">${n ? `тол ${fmt(hwTollOf(hw))} €/ден · ${n}/${hw.segs.length}` : 'няма тол система'}</span>`, rows);
  }
  // ---- Фаза 9: аутобани
  h += `<div class="sect" style="margin-top:8px">🔴 Аутобани — международни коридори · тол ${fmt(abToll())} €/ден</div>`;
  if (!abUnlocked()) h += `<div class="meta late">${abLockTxt()}</div>`;
  else { const m = abMissingTxt(); if (m) h += `<div class="row" style="margin:0 0 6px"><span class="meta late" style="margin:0">🚜 За аутобан: ${m}</span><button class="btn" data-buyroad="1">🚜 Купи пътна техника</button></div>`; }
  for (const c of AUTOBAHNS.filter(c => abShown(c) && inScope(...c.cities))) {
    if (c.cont && c === AUTOBAHNS.find(x => x.cont === c.cont)) h += `<div class="sect" style="margin-top:8px">${contByKey(c.cont).ico} ${CONT_HW_NM[c.cont] || ''} — започват от твой град на континента</div>`;
    const ids = corridorSegIds(c), n = ids.filter(id => hwDone().includes(id)).length;
    const rows = ids.map(id => {
      const sg = segById(id), km = kmBetween(sg.a, sg.b), job = jobs.find(j => j.seg === id), nm = `${cityById(sg.a).nm} — ${cityById(sg.b).nm}`;
      if (hwDone().includes(id)) return `<div class="meta" style="margin:2px 0">✅ ${nm} · ${km} км</div>`;
      if (job) return `<div class="row" style="margin:2px 0"><span class="meta" style="margin:0">🚧 ${nm} · ${km} км · строи се</span><button class="btn2" data-hwview="${id}">👁 Виж</button></div>`;
      const q = abQuote(km), reach = abReach(sg);
      return `<div class="row" style="margin:3px 0"><span class="meta" style="margin:0">⬜ ${nm} · ${km} км · ${q.days} дни · ${reach ? `тол <b style="color:var(--ok)">+${fmt(abTollGain(sg))} €/ден</b>` : '<span class="late">🔗 няма магистрала до тук</span>'}</span><button class="btn" data-ab="${id}" ${abUnlocked() && hwRepOk() && reach && !hwQueue().includes(id) ? '' : 'disabled'}>${hwQueue().includes(id) ? '📋 на опашка' : can ? `Строй +${fmt(q.reward)} €` : '📋 На опашка'}</button></div>`;
    }).join('');
    h += bwCard(`🔴 ${c.id} „${c.nm}“ <span class="meta" style="margin:0 0 0 auto">${n ? `тол ${fmt(abTollOf(c))} €/ден · ` : ''}${n}/${ids.length}${n === ids.length ? ' · цял +50%' : ''}</span>`, rows);

  }
  return h;
}

// ============================================================ запис
// техниката в завършения град остава за поддръжка — economy.js плаща нейната издръжка и вдига прихода
function syncFinishedFleet() { if (S && city.ready && econ.setFinishedFleet && econ.isFinished(S.cityId)) econ.setFinishedFleet(S.cityId, units.map(u => u.type)); }
function save() { syncFinishedFleet(); if (AUTOTEST || !S) return; try { S.projects = projects; if (city.ready) syncUnits(); localStorage.setItem(SAVE_KEY, JSON.stringify(S, (k, v) => k === 'vis' ? undefined : v)); } catch { /* без запис */ } }
function loadSave() { if (AUTOTEST) return null; try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

// клик върху парцел в 3D → избира обекта или офертата
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5 || !S) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(cashObjs, true).find(h => h.object.userData.cash || h.object.isSprite);
  if (hit) { let g = hit.object; while (g.parent && !cashObjs.includes(g)) g = g.parent; if (cashObjs.includes(g)) return collectCash(g); }
  const pt = new THREE.Vector3();
  if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) return;
  const lot = city.lots.find(l => Math.abs(l.x - pt.x) < 8 && Math.abs(l.z - pt.z) < 8);
  if (pickKind) { if (lot) pickLot(lot); return; }
  if (pt.x < STATION_X + 9 && pt.x > STATION_X - 40 && Math.abs(pt.z) < 120) { tab = 'hq'; renderPanel(); return; }   // гарата
  if (lot && lot.id === S.whLot) { tab = 'store'; highlightLot(lot.id); renderPanel(); return; }
  if (!lot) return;
  if (lot.id === S.garageLot) { tab = 'hq'; highlightLot(lot.id); renderPanel(); return; }
  const p = projects.find(q => q.lot === lot.id), o = S.offers.find(q => q.lot === lot.id);
  if (lot === city.hq) { tab = 'hq'; highlightLot(lot.id); renderPanel(); return; }
  if (['land', 'owned', 'listing'].includes(lot.busy) || (!lot.built && !lot.busy)) { tab = 'estate'; highlightLot(lot.id); renderPanel(); return; }
  if (p) { tab = 'projects'; selProject = p.id; } else if (o) tab = 'offers'; else return;
  highlightLot(lot.id);
  renderPanel();
});

// ============================================================ главен цикъл
const DAY_SEC = 24;
const CYCLE_DAYS = 3;   // едно денонощие трае 3 игрови дни — по-бавни изгреви и залези
const todF = () => (((S.day - 1) + S.dayT / DAY_SEC) / CYCLE_DAYS) % 1;
const clock = new THREE.Clock();
let panelT = 0, simT = 0, mapT = 0, autoT = 3, questT = 0;
// обновява само линиите (прогрес на строежа), без да прерисува цялата карта
function drawMapRailsOnly() { if (S && (S.rails || []).some(r => !r.built)) drawMap(); }
function frame() {
  requestAnimationFrame(frame);
  const rdt = Math.min(clock.getDelta(), 0.1);
  const dt = (AUTOTEST ? 1 / 30 * 8 : rdt) * speed;
  const onMap = !$('mapScreen').classList.contains('hidden');
  if (S && city.ready && onMap) { mapT -= rdt; if (mapT <= 0) { mapT = 1; renderMapHud(); drawMapRailsOnly(); } updateMapTrains(); updateMapPlanes(); updateMapShips(); }
  if (S && city.ready) {
    questT -= rdt; if (questT <= 0) { questT = 1; updFinBtn(); updResBtn(); syncSeaFleet(); autoCollectFinished(); processBuildQ(); if (bigWin) renderBig(); quests.tick(); if (!AUTOTEST) tutorial.tick(); }
    simT += dt;
    // физиката на движението на малки стъпки, за да не „прескачат“ при висока скорост
    let left = dt;
    while (left > 0) { const st = Math.min(left, 0.05); updateUnits(st); left -= st; }
    updateTraffic(rdt * Math.max(1, speed));
    if (!onMap) updatePeds(rdt * Math.min(2, Math.max(1, speed)));
    updateSignals(rdt * Math.max(1, speed));
    updateProjects(dt / DAY_SEC);
    updateRails(dt / DAY_SEC);
    updateAir(dt / DAY_SEC);
    updateSea(dt / DAY_SEC);
    updateStationBuild(dt / DAY_SEC);
    updateParked();
    updateTrains(dt / DAY_SEC);
    updateHighways(dt / DAY_SEC);
    updateCityHighway(simT);
    if (city.sea) city.sea.update(simT, dayNight.night);
    for (const o of Object.values(city.tender3D || {})) o.update(simT, dayNight.night);
    for (const o of city.landmarks || []) o.update(simT, dayNight.night);
    if (station && station.setNight) station.setNight(dayNight.night);
    if (city.hqLm) city.hqLm(simT, dayNight.night);
    if (city.airport) { if (city.airportNI !== NI) { city.airportNI = NI; city.airport.setPos(tx(NI - 1) + 70, 0); } city.airport.update(simT, dayNight.night); }
    updateCityTrain(dt);
    if (passing) passing.update(Math.min(dt, 0.25));
    tirs.update(Math.min(dt, 0.25));
    if (!onMap) {
      const tg = controls.target, near = units.filter(u => u.state === 'working' && Math.hypot(u.x - tg.x, u.z - tg.z) < 60).length;
      const zoom = Math.max(0, 1 - camera.position.distanceTo(tg) / 260);
      Sound.update(rdt, { night: dayNight.night, activity: Math.min(1, near / 4) * zoom, speed, traffic: 0.6 });
    } else Sound.update(rdt, { night: dayNight.night, activity: 0, speed, traffic: 0.2 });
    for (const p of projects) { updateSite(p, simT); updateWorkers(p, Math.min(dt, 0.1)); }
    updateCash(rdt);
    for (const g of parkGroups) { const j = g.userData.jet; j.scale.y = 0.85 + Math.sin(simT * 6 + g.id) * 0.15; j.rotation.y += rdt; }
    if (city.hqGroup?.userData.star) city.hqGroup.userData.star.rotation.y += rdt * 1.5;
    S.dayT += dt;
    if (S.dayT >= DAY_SEC) { S.dayT -= DAY_SEC; endOfDay(); autoFillTick(true); }
    autoT -= dt; if (autoT <= 0) { autoT = 3; autoFillTick(false); }
    if (dt > 0 && Math.random() < dt * 2) { dispatch(); hwDispatch(); }
    panelT -= rdt;
    if (panelT <= 0) { panelT = 0.5; if (!onMap && tab === 'projects') renderPanel(); else renderTop(); }
    if (hlT > 0) { hlT -= rdt; hl.material.opacity = Math.min(1, hlT); if (hlT <= 0) hl.visible = false; }
    if (AUTOTEST) autobot();
  }
  if (fly) {
    fly.t = Math.min(1, fly.t + rdt * 2);
    const k = 1 - Math.pow(1 - fly.t, 3);
    controls.target.lerpVectors(fly.from, fly.to, k);
    camera.position.copy(controls.target).add(fly.off);
    if (fly.t >= 1) fly = null;
  }
  if (hwv) return renderHwView(rdt);
  if (onMap) return;   // картата е SVG — 3D сцената не се рисува отдолу
  controls.update();
  if (S) { dayNight.update(todF(), controls.target); weather.update(rdt, controls.target); setSiteLightsNight(dayNight.night); }
  renderer.render(scene, camera);
}

// ============================================================ autotest (headless)
let atFrames = 0;
function autobot() {
  atFrames++;
  if (S.offers.length && projects.length < 2) acceptOffer(S.offers[0].id);
  if (params.has('multi')) {
    const step = +(sessionStorage.getItem('mstep') || 0);
    if (step === 0 && atFrames === 10) {
      econ.earn(1000000, 'кредит', 'тест'); econ.openBranch('plovdiv', 0, 'Пловдив');
      S.branches = ['plovdiv']; S.cities.plovdiv = { ...newCityState(), left: nowDays() };
      sessionStorage.setItem('mstep', '1'); switchCity('plovdiv');
    }
    if (step === 1 && atFrames === 400) { sessionStorage.setItem('mstep', '2'); switchCity('sofia'); }
  }
  if (params.has('estate')) {
    const E = est();
    if (atFrames === 5) { econ.earn(500000, 'кредит', 'тест'); S.officeLevel = 6; S.garageLevel = 3; for (const t of ['crew', 'crew', 'tractor', 'truck', 'loader']) buyUnit(t); }
    if (atFrames === 8) { const lot = city.lots.find(l => !l.built && !l.busy && l.zone === 'outer'); buyLand(lot.id); buildOnLand(lot.id, 'house'); }
    if (E.listings.length && !E.owned.some(o => o.old)) buyListing(E.listings[0].id);
    const old = E.owned.find(o => o.old && !projects.some(p => p.lot === o.lot)); if (old) startReno(old.lot);
    const ready = E.owned.find(o => !o.old && o.kind === 'house' && !o.sale && !projects.some(p => p.lot === o.lot) && o.value > 40000); if (ready) listForSale(ready.lot);
  }
  if (params.has('hw')) {
    if (atFrames === 5) { econ.earn(2000000, 'кредит', 'тест'); S.rep = 2.5; S.dev.xp = Math.max(S.dev.xp, 1000); S.dev.lv = Math.max(S.dev.lv, 2); S.officeLevel = 6; S.garageLevel = 6; for (const t of ['bulldozer', 'grader', 'roller', 'roller', 'paver', 'marker', 'truck', 'crane', 'crew', 'crew', 'truck']) buyUnit(t); }
    if (atFrames === 8) takeHighway(hwAvailable().find(s => s.a === S.cityId || s.b === S.cityId).id);
  }
  if (params.has('rich')) {
    if (atFrames === 5) { econ.earn(1000000, 'кредит', 'тест'); }
    if (atFrames === 10) { railPick = S.cityId; railClick('pleven'); document.querySelector('#modalBox .btn').click(); }
    if (atFrames === 12) { if (!stationLv()) { S.stationLevel = 1; station.build(1); refreshPassing(); } buyTrain(); }
    if (S.jobs.length && S.trains.some(t => !t.job)) takeJob(S.jobs[0].id);
  }
  if (!params.has('nocollect') && atFrames % 60 === 0 && cashObjs.length) collectCash(cashObjs[0]);
  for (const p of projects) for (const r of missingRoles(p)) if (!units.some(u => u.type === r.role) && econ.canAfford(ECON.UNIT_TYPES[r.role].cost + 5000)) buyUnit(r.role);
  if (atFrames % 300 === 0 || atFrames === +params.get('autotest')) {
    document.title = 'AT ' + JSON.stringify({ frames: atFrames, day: S.day, money: Math.round(econ.money), rep: +S.rep.toFixed(2), done: S.done, cash: cashObjs.length,
      projects: projects.map(p => `${p.type}:${p.stage}:${p.prog.toFixed(2)}`), units: units.map(u => u.type + ':' + u.state).join(','), offers: S.offers.length, city: S.cityId, hq: S.hqCity, cities: Object.keys(S.cities || {}), step: sessionStorage.getItem('mstep'), estate: S.estate ? { owned: S.estate.owned.map(o => `${o.kind}:${o.rent}:${o.value}${o.old ? ':old' : ''}${o.sale ? ':sale' + (o.sale.price || '') : ''}`), land: S.estate.land.length, listings: S.estate.listings.length } : null, hw: (S.hwJobs || []).map(j => `${j.seg}:${j.stage}:${j.prog.toFixed(2)}`), hwDone: S.hwDone, rails: S.rails.map(r => `${r.a}-${r.b}:${r.built ? 'ok' : Math.round(r.prog * 100) + '%'}`), trains: S.trains.map(t => t.job ? t.leg + ':' + Math.round(t.km) : 'idle@' + t.at), jobs: S.jobs.length, conn: connectedCities() });
  }
}
addEventListener('error', e => { document.title = 'ERR ' + e.message; });

// ============================================================ старт
// началният екран стои поне 1.5 s и изчезва плавно
{ const el = $('loading'); $('ldTxt').textContent = 'Готово!'; setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 700); }, AUTOTEST ? 0 : 900); }
const saved = loadSave();
if (AUTOTEST) {
  const at = sessionStorage.getItem('stroiAT');
  if (at) { sessionStorage.removeItem('stroiAT'); sessionStorage.removeItem('stroiEnter'); S = JSON.parse(at); enterCity(); } else newGame(params.get('city') || 'sofia');
  setSpeed(1);
  // достъп за headless тестовете
  window.__dbg = {
    naTest(open) { S.dev.xp = 260000; S.dev.lv = 10; if (open) S.branches = [...(S.branches || []), 'lagos', 'nairobi', 'accra']; mapWorld = true; mapEU = true; mapWide = true; mapCont = 'na'; mapView = null; showMap(true);
      const sp = seaPath(cityById('houston'), cityById('santodomingo')); clickCity('havana');
      return { open: contByKey('na').open(), next: mapNextLbl(), cities: document.querySelectorAll('#mapSvg g.city:not(.lbl)').length, modal: document.getElementById('modalBox')?.innerText.slice(0, 140), sea: sp.km, ab: ALL_AB.filter(x => x.cont === 'na').length, hw: (openBig('hw'), document.getElementById('bigWin')?.innerText.includes('Северна Америка')) }; },
    rbTest() { econ.earn(1e6, 'друго', 'тест'); S.cities.lagos = S.cities.lagos || newCityState(); upgGo('lagos', 'warehouse'); upgGo('lagos', 'station'); upgGo(S.cityId, 'warehouse'); const a = JSON.stringify(S.cities.lagos.rbuild); S.day += 40; rbuildTick(); const c = S.cities.lagos;
      return { a, wh: c.whLevel, st: c.stationLevel, lotAuto: c.lotAuto, rb: c.rbuild, mapOpen: !$('mapScreen').classList.contains('hidden'), own: projects.filter(p => p.own).map(p => p.type + ':' + p.lot) }; },
    saTest(open) { S.dev.xp = 260000; S.dev.lv = 10; if (open) S.branches = [...(S.branches || []), 'newyork', 'boston', 'houston']; mapWorld = true; mapEU = true; mapWide = true; mapCont = 'sa'; mapView = null; showMap(true);
      const sp = seaPath(cityById('lima'), cityById('rio')); clickCity('cusco');
      return { open: contByKey('sa').open(), next: mapNextLbl(), cities: document.querySelectorAll('#mapSvg g.city:not(.lbl)').length, modal: document.getElementById('modalBox')?.innerText.slice(0, 120), sea: sp.km, seaN: sp.pts.length, ab: ALL_AB.filter(x => x.cont === 'sa').length }; },
    contTest(br, cont = 'as', probe = 'newyork') { S.dev.xp = 260000; S.dev.lv = 10; S.branches = [...(S.branches || []), ...(br || [])]; contTick(); mapWorld = true; mapEU = true; mapWide = true; mapCont = cont; mapView = null; showMap(true); clickCity(probe);
      const sp = seaPath(cityById('bangkok'), cityById('jakarta'));
      return { hud: (document.getElementById('mapRail')?.innerText || '').split('🌐')[1]?.split('⬆️')[0], ny: document.getElementById('modalBox')?.innerText.slice(0, 90), sea: sp.km, ab: ALL_AB.filter(x => x.cont === 'as').length, cities: document.querySelectorAll('#mapSvg g.city:not(.lbl)').length }; },
    afTest() { S.dev.xp = 260000; S.dev.lv = 10; mapWorld = true; mapEU = true; mapWide = true; mapCont = 'af'; mapView = null; showMap(true);
      const sp = seaPath(cityById('casablanca'), cityById('mombasa')); clickCity('lagos');
      return { cities: document.querySelectorAll('#mapSvg g.city:not(.lbl)').length, modal: document.getElementById('modalBox')?.innerText.slice(0, 160), sea: sp.km, seaN: sp.pts.length, ab: ALL_AB.filter(x => x.af).length, land: afLandLinked('lagos') }; },
    railTest(prog) { S.rails = [{ a: S.cityId, b: 'pleven', km: 158, days: 6, prog, built: prog >= 1 }]; setSpeed(0); showMap(true); openHwView(`rail:${S.cityId}-pleven`); },
    age(days) { for (const o of est().owned) { o.since = (o.since ?? S.day) - days; } wearOwned(days); refreshEstateSigns(); renderPanel(); return est().owned.map(o => [o.kind, Math.round(condOf(o)), ageOf(o)]); },
    owned: () => est().owned,
    treeRow() { const ks = Object.keys(A).filter(k => k.startsWith('sf-')); ks.forEach((k, i) => { const t = model(k, 10); t.position.set(i * 9, 0, 300); scene.add(t); }); showMap(false); controls.target.set(ks.length * 4.5, 5, 300); camera.position.set(ks.length * 4.5, 22, 345); controls.update(); fly = null; return ks; },
    treeInfo(k = 'sf-palm-0') { const r = []; A[k].scene.traverse(o => { if (o.isMesh) { const n = o.geometry.attributes.normal, p = o.geometry.attributes.position; r.push({ nm: o.name, vis: o.visible, n: n && [n.array.constructor.name, n.getX(0), n.getY(0), n.getZ(0)], p: [p.array.constructor.name, p.normalized, p.getX(0), p.getY(0)], at: o.material.alphaTest, em: o.material.emissiveIntensity, op: o.material.opacity }); } }); return r; },
    setDay(d) { S.day = d; return seasonOf(S.day); },
    portTest(lv = 5) { if (!city.sea) return false; city.sea.setPortLevel(lv); city.sea.setFleet(['container', 'tanker', 'cruise', 'container', 'bulk'].map(kind => ({ kind, state: 'docked' }))); return true; },
    lookStanders(d = 14) { if (!standers.length) return 0; const v = standers[0].position; showMap(false); controls.target.set(v.x, 1, v.z); camera.position.set(v.x + d, d * 0.6, v.z + d); controls.update(); fly = null; return standers.length; },
    spaTest(id = 'velingrad') { __dbg.resortEnter(id); S.resorts[id].ext = { hotel: true, spa: true }; openHwView('resort:' + id); },
    hotelStyle(id, style) { __dbg.resortEnter(id); S.resorts[id].hotelStyle = style; openHwView('resort:' + id); },
    loanTest(dep) { econ.s.money = 1000; econ.s.deposit = dep; withLoan(500000, 'тест', () => { window.__bought = 1; }); const t = document.getElementById('modalBox')?.innerText.slice(0, 120); document.querySelectorAll('#modalBox button')[1]?.click(); return { t, bought: window.__bought, money: Math.round(econ.s.money), dep: Math.round(econ.s.deposit) }; },
    gearMoveTest() { S.branches = [...(S.branches || []), 'munich']; S.cities.munich = { ...newCityState(), units: ['crew', 'crew', 'crew', 'bulldozer', 'bulldozer', 'grader', 'grader', 'truck', 'truck', 'truck', 'crane', 'crane', 'roller', 'roller', 'roller', 'paver', 'paver', 'marker', 'marker'] };
      const sg = ALL_AB.find(x => x.id === 'ab:munich-plzen'), km = kmBetween(sg.a, sg.b); S.hwJobs = [{ seg: sg.id, ab: true, km, ...abQuote(km), stage: 0, prog: 0, mat: {}, start: S.day, v2: true, city: S.cityId }];
      openBig('hw'); const b = document.querySelector('[data-hwmove]'), lbl = b?.innerText; b?.click(); return { lbl, city: S.hwJobs[0].city, lack: hwLackOf(S.hwJobs[0]).length }; },
    stockTest() { S.dev.xp = 260000; S.dev.lv = 10; S.branches = [...(S.branches || []), 'rome', 'paris']; econ.earn(5e7, 'друго', 'тест'); openBig('bank'); const t = document.getElementById('bwBody')?.innerText || ''; const all = ECON.COMPANIES.length; const shown = ECON.COMPANIES.filter(c => t.includes(c.nm)).map(c => c.nm); econ.goBust('f-tevere', S.day); econ.takeover('f-tevere'); return { all, shown, sub: !!(econ.s.subs || {})['f-tevere'] }; },
    megaTest(k) { S.dev.xp = 260000; S.dev.lv = 10; S.rep = 4; econ.earn(9e8, 'друго', 'тест'); S.branches = [...(S.branches || []), 'nairobi', 'accra', 'lagos', 'newyork', 'boston', 'miami', 'rio', 'lima', 'bogota', 'bangkok', 'tokyo', 'delhi'];
      if (k === 'darien') S.hwDone = [...(S.hwDone || []), ...HIGHWAYS.filter(h => !h.intl).slice(0, 3).flatMap(h => h.segs.map((_, i) => segId(h, i)))];
      mega.offer(k); document.querySelector('#modal')?.classList.add('hidden'); mega.accept(k); const b = document.querySelector('[data-mega], [data-mega-works]'); const lbl = b?.innerText; b?.click();
      return { st: mega.state(k).st, lbl, pr: mega.progress(k), rails: (S.rails || []).filter(r => !r.built).length, jobs: (S.hwJobs || []).map(j => j.seg), build: mega.state(k).build, win: (document.getElementById('bwBody')?.innerText || '').slice(0, 160) }; },
    offerAllTest() { S.rep = 4; S.officeLevel = 10; for (let k = 0; k < 4; k++) makeOffer(); tab = 'offers'; renderPanel(); const n = S.offers.length, has = !!document.getElementById('bOfferAll'); document.getElementById('bOfferAll')?.click(); return { n, has, left: S.offers.length, proj: projects.length }; },
    capTest() { S.dev.xp = 260000; S.dev.lv = 10; econ.earn(1e8, 'друго', 'тест'); const m0 = econ.s.money; clickCity('rome'); const t = document.getElementById('modalBox')?.innerText.slice(0, 80); [...document.querySelectorAll('#modalBox button')].find(b => b.textContent.includes('Отвори'))?.click(); return { t, paid: Math.round(m0 - econ.s.money), owned: ownedCities().includes('rome') }; },
    queueTest() { econ.earn(5e7, 'друго', 'тест'); S.dev.lv = 9; S.dev.xp = 200000; S.rep = 4; S.officeLevel = 1; const segs = allSegs().filter(x => !hwDone().includes(x.id)).slice(0, 3).map(x => x.id); S.hwJobs = []; for (const id of segs) takeSeg(id); const q1 = [...hwQueue()], j1 = S.hwJobs.map(j => j.seg); const j = S.hwJobs[0]; S.hwJobs = []; hwQueueTick(); return { segs, q1, j1, after: S.hwJobs.map(j => j.seg), q2: [...hwQueue()] }; },
    scopeTest() { S.dev.xp = 260000; S.dev.lv = 10; S.rep = 4; S.hwDone = []; const out = {}; for (const sc of ['bg', 'balkans', 'cont', 'intl', 'all']) { openBig('hw'); bwScope = sc; renderBig(); const t = document.getElementById('bwBody').innerText; out[sc] = { n: document.querySelectorAll('#bwBody .card').length, tr: t.includes('Тракия'), e80: t.includes('Истанбул'), e1: t.includes('Париж'), tah: t.includes('Кайро'), bar: !!document.querySelector('[data-scope]') }; } closeBig(); setMapView && 0; return out; },
    lmInfo() { return (city.landmarks || []).map(o => { const b = new THREE.Box3().setFromObject(o.group); let n = 0; o.group.traverse(x => { if (x.isMesh) n++; }); return { n, min: b.min.toArray().map(v => +v.toFixed(1)), max: b.max.toArray().map(v => +v.toFixed(1)) }; }); },
    lmSolo(i = 0, d = 70, h = 40) { const o = (city.landmarks || [])[i]; if (!o) return false; for (const c of city.group.children) if (c !== o.group) c.visible = false; const v = o.group.position; showMap(false); controls.target.set(v.x, 18, v.z); camera.position.set(v.x + d, h, v.z + d); controls.update(); fly = null; return o.group.children.length; },
    lookLm(i = 0, d = 120) { const o = (city.landmarks || [])[i]; if (!o) return false; const v = o.group.position; showMap(false); controls.target.set(v.x, 20, v.z); camera.position.set(v.x + d * 0.8, d * 0.6, v.z + d); fly = null; return city.landmarks.length; },
    tclose(id, rivalM) { const s = tenders.state(id); if (rivalM) s.bids.forEach(b => b.m = rivalM); tenders.close(id); renderPanel(); return { st: tenders.state(id), money: Math.round(econ.s.money) }; },
    office(lv, style) { S.officeLevel = lv; if (style) S.officeStyle = style; buildHQ(); tab = 'hq'; renderPanel(); showMap(false); controls.target.set(city.hq.x - 4, 25, city.hq.z - 4); camera.position.set(city.hq.x + 45, 45, city.hq.z + 55); fly = null; return S.officeStyle || 'std'; },
    lookSt(lv = 5, d = 90) { econ.earn(1e6, 'друго', 'тест'); S.stationLevel = lv; buildStation(); showMap(false); controls.target.set(STATION_X - 10, 0, 0); camera.position.set(STATION_X + d, d * 0.9, d * 1.2); controls.update(); fly = null; return [camera.position.x, camera.position.y, camera.position.z].map(Math.round); },
    lots: () => ({ n: city.lots.length, mega: city.lots.filter(l => l.mega).length, built: city.lots.filter(l => l.built).length, fresh: city.lots.filter(l => l.fresh).length, NI, megaBase }),
    lookWide(x = 250, h = 420) { showMap(false); controls.target.set(x, 0, 0); camera.position.set(x - 60, h, h * 0.9); controls.update(); fly = null; },
    lookTender(id, d = 60) { const o = (city.tender3D || {})[id]; if (!o) return false; const v = o.group.position; showMap(false); controls.target.set(v.x, 0, v.z); camera.position.set(v.x + d * 0.8, d * 0.7, v.z + d); fly = null; return true; },
    tender(id, m, prog) { tenders.announce(id); if (m) { const s = tenders.state(id); s.my = m; s.bids.forEach(b => b.m = Math.max(b.m, m + 0.05)); tenders.close(id); if (prog != null) { tenders.state(id).prog = prog; refreshTender3D(); } } renderPanel(); return tenders.state(id); },
    bust(id) { econ.earn(5e6, 'друго', 'тест'); econ.goBust(id); tab = 'bank'; renderPanel(); if (!dev.stocksOpen()) ECON.renderFinance($('financeBox'), econ, S.rep, () => {}, units.map(u => u.type), { stocksOpen: true }); return econ.takeoverPrice(id); },
    take(id) { const c = econ.takeover(id); renderPanel(); return { c, owned: est().owned.map(o => o.kind), land: est().land.length, units: S.units.length, resorts: S.resorts, subs: econ.s.subs, stock: econ.s.stock.sand }; },
    giantTest() { const r = this.expressTest(); buyTrain('giant'); const t = S.trains[S.trains.length - 1]; autoTrip(t); return { kind: t.kind, wagons: trainWagons(t), job: t.job && [t.job.to, t.job.pay, Math.round(t.total)] }; },
    expressTest() { econ.earn(5e7, 'друго', 'тест'); S.stationLevel = 5; buildStation(); const h = S.cityId; S.rails = [{ a: h, b: 'belgrade', km: kmBetween(h, 'belgrade'), days: 5, prog: 1, built: true }, { a: 'belgrade', b: 'vienna', km: kmBetween('belgrade', 'vienna'), days: 5, prog: 1, built: true }, { a: 'vienna', b: 'paris', km: kmBetween('vienna', 'paris'), days: 5, prog: 1, built: true }]; buyTrain('express'); const t = S.trains[S.trains.length - 1]; autoTrip(t); return { kind: t.kind, wagons: trainWagons(t), job: t.job && [t.job.to, t.job.pay, Math.round(t.total)] }; },
    trainTest() { econ.earn(2e6, 'друго', 'тест'); S.stationLevel = 5; buildStation(); S.rails = [{ a: S.cityId, b: 'pleven', km: 158, days: 6, prog: 1, built: true }]; for (const k of ['small', 'mid', 'heavy', 'pax']) buyTrain(k); for (let i = 0; i < 4; i++) makeJob(); return { trains: S.trains.map(t => [t.kind, t.wagons]), jobs: S.jobs.map(j => [j.wagons, j.reward]) }; },
    trains: () => S.trains.map(t => [t.kind, t.at, t.job ? (t.job.pax ? 'pax' : t.job.wagons) : null, Math.round(t.km)]),
    railBendTest(a = 'varna', b = 'istanbul', prog = 0.4) { S.rails = [...(S.rails || []).filter(r => !(r.a === a && r.b === b)), { a, b, km: kmBetween(a, b), days: 9, prog, built: prog >= 1 }]; mapWide = true; mapView = null; showMap(true); return railBend(a, b); },
    linkTest(to) { S.rails = [...(S.rails || []), { a: S.cityId, b: to, km: kmBetween(S.cityId, to), days: 5, prog: 1, built: true }]; supply.tryDeliver(); return { stock: { ...econ.s.stock }, deals: supply.state().deals.length, money: Math.round(econ.money) }; },
    supplyOffer() { supply.makeOffer(); return supply.state(); },
    time(h) { const f = (((h - 6) / 24) % 1 + 1) % 1 * CYCLE_DAYS; S.day = 1 + Math.floor(f); S.dayT = (f % 1) * DAY_SEC; setSpeed(0); },
    level(n, gn = n) { S.officeLevel = n; S.garageLevel = gn; buildHQ(); for (const u of units) if (!u.proj) releaseUnit(u); },
    upgrade: k => startUpgrade(k),
    pick: id => pickLot(city.lots[id == null ? city.lots.find(l => !l.built && !l.busy).id : id]),
    buy: (m, q) => { buyForStock(m, q); refreshWarehouse(); return econ.stock(m); },
    tab(t) { tab = t; renderPanel(); },
    lookSea(d = 160) { controls.target.set(0, 0, tx(0) - 60); camera.position.set(d * 0.4, d * 0.55, tx(0) + d * 0.6); fly = null; },
    tier: () => cityTier(S.cityId),
    // тест: принудително завършване на текущия град / смяна на града / продажба без потвърждение
    finishNow(share = 0.73) { for (let d = 0; d < 30; d++) econ.s.cityEarn[S.cityId] = { ...(econ.s.cityEarn[S.cityId] || {}), [S.day - d]: 50000 }; S.cityExt = 4; const ok = econ.finishCity(S.cityId, share, { built: S.built.length }); return ok; },
    branchTo(id) { if (!(S.branches || []).includes(id)) { econ.openBranch(id, 0, id); S.branches = [...(S.branches || []), id]; S.cities[id] = { ...newCityState(), left: nowDays() }; } switchCity(id); },
    fin: () => ({ city: S.cityId, finished: JSON.parse(JSON.stringify(econ.s.finished)), money: Math.round(econ.money), branches: S.branches }),
    sellPrice: () => econ.branchSalePrice({ assets: cityAssets(), dailyProfit: econ.isFinished(S.cityId) ? econ.s.finished[S.cityId].daily : econ.cityAvgDaily(S.cityId) }),
    branchTest(to = 'ruse') { econ.earn(3e6, 'друго', 'тест'); S.dev.xp = 80000; S.dev.lv = 7; S.stationLevel = 5; const h = S.cityId; S.rails = [{ a: h, b: 'bucharest', km: kmBetween(h, 'bucharest'), days: 9, prog: 1, built: true }]; const o = branchFor(to); if (!o) return { none: branchCands().map(c => c.id) }; S.rails.push({ a: to, b: o.host.a, c: o.host.b, br: o.t, km: o.km, days: o.days, prog: 1, built: true }); return { km: o.km, cost: o.cost, t: o.t, path: railPath(h, to), cands: branchCands().map(c => c.id + ':' + c.km) }; },
    hwState() { return { jobs: (S.hwJobs || []).map(j => ({ seg: j.seg, stage: j.stage, prog: +j.prog.toFixed(2), v2: !!j.v2, roles: hwRoles(j) })), miss: hwMissingTxt(), units: units.map(u => u.type + ':' + u.state) }; },
    abTest() { econ.earn(9e7, 'друго', 'тест'); S.rep = 4; S.dev.xp = 170000; S.dev.lv = 9; S.officeLevel = 10; S.garageLevel = 10;
      S.hwDone = [...new Set([...hwDone(), ...HIGHWAYS.filter(hw => !hw.intl).flatMap(hw => hw.segs.map((_, i) => segId(hw, i)))])];
      for (const [k, n] of Object.entries(abFleet())) for (let i = units.filter(u => u.type === k).length; i < n; i++) buyUnit(k);
      return { unlocked: abUnlocked(), bgFull: bgFullHighways(), toll: abToll(), miss: abMissingTxt(), segs: ALL_AB.length, AB: !!AB }; },
    abView() { const j = (S.hwJobs || []).find(q => q.ab); if (j) { j.stage = 3; j.prog = 0.55; openHwView(j.seg); } },
    mapEU() { mapEU = true; showMap(true); },
    dayEnd() { const m = econ.money; endOfDay(); return { gained: Math.round(econ.money - m), earned: econ.isFinished(S.cityId) ? econ.s.finished[S.cityId].earned : null }; },
    hwOther(full = true) { const j = (S.hwJobs || [])[0]; if (!j) return null; const id = S.cityId === 'plovdiv' ? 'varna' : 'plovdiv'; S.cities[id] = { ...(S.cities[id] || {}), units: full ? Object.entries(hwNeed(j)).flatMap(([k, n]) => Array(n).fill(k)) : ['crew'] }; for (const u of units) if (u.proj === j) { u.obj.visible = true; releaseUnit(u); } j.city = id; return { city: id, lack: hwLackOf(j), roles: hwRoles(j) }; },
    airTest() { econ.earn(3e8, 'друго', 'тест'); S.dev.xp = 260000; S.dev.lv = 10; S.rep = 4.5; S.airports = { [S.cityId]: { lv: 3, build: null } };
      openAirRoute(S.cityId, 'newyork'); openAirRoute(S.cityId, 'dubai'); openAirRoute(S.cityId, 'istanbul'); for (const k of ['regional', 'narrow', 'wide', 'cargo']) buyPlane(k);
      return { gates: airGates(), routes: S.airRoutes.map(r => r.a + '-' + r.b + ':' + r.km), planes: S.planes.map(p => p.kind), daily: Object.keys(PLANES).map(planeDaily) }; },
    mapWorld() { mapWorld = true; mapView = null; showMap(true); },
    air3d() { refreshAirport3D(); showMap(false); const x = tx(NI - 1) + 70; controls.target.set(x, 0, 0); camera.position.set(x - 150, 130, 170); fly = null; return !!city.airport; },
    lookRail(d = 150) { const x = tx(0) - 40, z = tx(0) - 30; controls.target.set(x, 0, z); camera.position.set(x + d * 0.5, d * 0.7, z + d * 0.8); fly = null; },
    lookPort(d = 160) { if (!city.sea) return false; showMap(false); const P = city.sea.port; controls.target.set(P.x, 0, P.z - 70); camera.position.set(P.x + d * 0.7, d * 0.55, P.z - 70 + d * 0.8); fly = null; return true; },
    gearTest() { econ.earn(1e6, 'друго', 'тест'); S.garageLevel = 5; for (const t of ['crane', 'tractor', 'roller', 'loader', 'truck', 'grader']) buyUnit(t); const h = city.hq; controls.target.set(h.x, 2, h.z); camera.position.set(h.x + 18, 16, h.z + 22); fly = null; return units.map(u => u.type); },
    oeTrain(t = 34) { S.orient = { st: 'done', doneAt: S.day, earned: 0 }; if (!passing) return false; const r = Math.random; Math.random = () => 0.1; try { passing.update(20); } finally { Math.random = r; } for (let k = 0; k < t * 2; k++) passing.update(0.5);
      let hit = null; scene.traverse(m => { if (!hit && m.isMesh && m.material?.color?.getHex?.() === 0x27407a) hit = m; });
      if (hit) { const v = hit.getWorldPosition(new THREE.Vector3()); showMap(false); controls.target.copy(v); camera.position.set(v.x + 30, 22, v.z + 30); fly = null; return [Math.round(v.x), Math.round(v.z)]; }
      return 'no-oe'; },
    resortCam(px, py, pz, tx, ty, tz) { if (!hwv || !hwv.cam) return false; hwv.cam.position.set(px, py, pz); hwv.ctl.target.set(tx, ty, tz); hwv.ctl.update(); return true; },
    globeTest() { const d = globeData(); openGlobe(d); return { won: d.stats, partial: d.partial.size, cities: d.cities.length }; },
    camAt(px, py, pz, tx, ty, tz) { controls.target.set(tx, ty, tz); camera.position.set(px, py, pz); fly = null; return STATION_X; },
    abCityTest() { const s = ALL_AB.find(q => q.a === S.cityId || q.b === S.cityId); if (!s) return 'no ab'; S.hwDone = [...new Set([...(S.hwDone || []), s.id])]; buildCityHighway(); showMap(false); const z = tx(N - 1) + 34; controls.target.set(0, 0, z - 20); camera.position.set(60, 90, z + 90); fly = null; return [s.id, !!cityHw]; },
    lookBeach(d = 40) { showMap(false); const z = tx(0) - TILE / 2 - 8, x = tx(0) + 60; controls.target.set(x, 2, z); camera.position.set(x + d * 0.9, d * 0.6, z + d * 0.9); fly = null; return [x, z]; },
    repBtnTest() { econ.earn(1e6, 'друго', 'тест'); const E = est(); E.owned = E.owned || [];
      const lots = city.lots.filter(l => l.built && !l.busy && !E.owned.some(o => o.lot === l.id)).slice(0, 2);
      for (const l of lots) E.owned.push({ lot: l.id, kind: 'house', cond: 40, since: S.day, value: 50000, rent: 300 });
      showMap(true); renderMapHud(); return lots.length; },
    garTest() { econ.earn(5e6, 'друго', 'тест'); S.branches = ['plovdiv', 'varna']; S.cities = S.cities || {}; S.cities.plovdiv = { units: ['crew', 'crane', 'truck', 'truck'], unitXp: [1, 2, 0, 0], officeLevel: 1, garageLevel: 1, projects: [] }; S.cities.varna = { units: ['crew'], unitXp: [0], officeLevel: 1, garageLevel: 1, projects: [{ type: 'office', stage: 1, prog: 0 }] }; const plan = garPlan(); openBig('garage'); return plan; },
    seaTest() { econ.earn(3e8, 'друго', 'тест'); S.dev.xp = Math.max(S.dev.xp, 70000); S.dev.lv = Math.max(S.dev.lv, 7); S.ports = { [S.cityId]: { lv: 3, build: null } };
      for (const b of ['istanbul', 'rotterdam', 'athens']) openSeaRoute(S.cityId, b); for (const k of Object.keys(SHIPS)) buyShip(k);
      return { berths: portBerths(), routes: S.seaRoutes.map(r => r.a + '-' + r.b + ':' + r.km), ships: S.ships.map(p => p.kind), daily: Object.keys(SHIPS).map(shipDaily), net: seaNetwork() }; },
    estHud() { econ.earn(5e6, 'друго', 'тест'); for (let i = 0; i < 4; i++) { const l = city.lots.find(x => !x.built && !x.busy); est().owned.push({ cond: 40, lot: l.id, kind: 'house', rent: 400, value: 50000, since: S.day }); l.busy = 'owned'; } S.cities.plovdiv = { ...(S.cities.plovdiv || {}), estate: { owned: [{ cond: 30, lot: 1, kind: 'shop', rent: 1200, value: 150000, since: S.day - LIFE - 9 }], land: [], listings: [] } }; S.branches = [...new Set([...(S.branches || []), 'plovdiv'])]; const o = est().owned; o.forEach((x, i) => { x.cond = 50; if (i % 2) x.since = S.day - LIFE - 5; }); S.cities = S.cities || {}; const other = ownedCities().find(id => id !== S.cityId); showMap(true); return { owned: o.length, other: other || null, html: $('mapRail').innerText.slice(0, 400) }; },
    branchFix() { S.rails = [{ a: 'barcelona', b: 'milan', km: 900, days: 5, prog: 1, built: true }, { a: 'nice', b: 'barcelona', c: 'milan', br: 0.6, km: 20, days: 2, prog: 1, built: true }];
      const host = railPts('barcelona', 'milan'), dist = ([x, y]) => Math.min(...host.slice(1).map((b, i) => { const a = host[i], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); }));
      return { J: junXY(S.rails[1]).map(v => +v.toFixed(1)), dJ: +dist(junXY(S.rails[1])).toFixed(2), d70: +dist(edgeXY('nice', 'milan', 0.7)).toFixed(2), d90: +dist(edgeXY('nice', 'barcelona', 0.9)).toFixed(2), back: +dist(edgeXY('milan', 'nice', 0.3)).toFixed(2) }; },
    expressPark() { econ.earn(5e7, 'друго', 'тест'); S.stationLevel = 5; buildStation(); S.trains = []; buyTrain('express'); buyTrain('pax'); parkedSig = ''; updateParked(); this.lookStation ? this.lookStation() : null; return S.trains.map(t => t.kind + '@' + t.at); },
    bigOpen(k) { openBig(k); return document.getElementById('bwBody').innerText.slice(0, 3000); },
    railView(prog = 1) { const b = S.cityId === 'pleven' ? 'ruse' : 'pleven'; S.rails = (S.rails || []).filter(r => !(r.a === S.cityId && r.b === b)); S.rails.push({ a: S.cityId, b, km: 100, days: 5, prog, built: prog >= 1 }); openHwView(`rail:${S.cityId}-${b}`); },
    hwView() { const s = allSegs()[0]; openHwView(s.id); return s.id; },
    abSegView(stage = 2, prog = 0.5) { const sg = ALL_AB[0]; S.hwJobs = [{ seg: sg.id, ab: true, km: 100, ...abQuote(100), stage, prog, mat: {}, start: S.day, v2: true, city: S.cityId }]; openHwView(sg.id); return sg.id; },
    wx(k, cover) { weather.set(k); if (cover != null) weather.setCover(cover); return weather.kind; },
    event: () => { for (let k = 0; k < 40; k++) { S.events && (S.events.last = -9); const e = events.dailyTick(S.day + k * 3); if (e) return e.title; } return null; },
    hwOpen() { const s = allSegs().find(q => q.a === S.cityId || q.b === S.cityId); if (!s) return null; S.hwDone = [...new Set([...(S.hwDone || []), s.id])]; buildCityHighway(); return s.id; },
    enterResort: id => openHwView('resort:' + id),
    siteStage(n) { const p = projects.find(q => !q.own && q.type !== 'house'); if (!p) return null; p.stage = n; p.prog = 0.3; p.mat = { 0: true, 1: true, 2: true, 3: true }; for (const u of units) if (u.proj === p) releaseUnit(u); dispatch(); return p.lot; },
    lookCash(dist = 60) { const g = cashObjs[0]; if (!g) return false; controls.target.set(g.position.x, g.position.y - 6, g.position.z); camera.position.set(g.position.x + dist * 0.7, g.position.y + dist * 0.6, g.position.z + dist * 0.8); fly = null; return true; },
    demoOffer() { const lot = city.lots.find(l => l.obj && !l.busy && l !== city.hq && HOUSES.includes(l.built)); if (!lot) return null; lot.busy = 'offer'; const o = { id: S.seq++, type: 'shop', lot: lot.id, client: 'тест', reward: 90000, days: 14, expires: S.day + 4, demolish: true }; S.offers.push(o); acceptOffer(o.id); return lot.id; },
    demo: () => projects.filter(p => p.demo).map(p => `${p.lot}:${p.demo.prog.toFixed(2)}`),
    resorts: (unlock) => { if (unlock) S.resortsOpen = true; return { open: resorts.unlocked(), st: JSON.parse(JSON.stringify(S.resorts || {})), day: S.day }; },
    skipDays(n) { for (let k = 0; k < n; k++) { S.day++; resorts.dailyTick(S.day); } },
    resort: id => resorts.open(id),
    endDay: () => endOfDay(),
    towers() { const out = []; for (const f of [10, 15, 20]) { const lot = freeLots('tower')[0]; if (!lot) break; lot.busy = 'offer'; const o = { id: S.seq++, type: 'tower', lot: lot.id, client: 'тест', reward: 320000, days: 30, expires: S.day + 4 }; sizeTower(o); o.floors = f; S.offers.push(o); out.push(o.id); } return out; },
    accept: id => acceptOffer(id),
    finishAll() { for (const p of [...projects]) if (!p.own) { while (projects.includes(p)) { p.prog = 1; nextStage(p); } } },
    station: () => ({ level: stationLv(), build: S.stationBuild, trains: (S.trains || []).length, home: homeTrains().length }),
    stationUp: () => startStationUpgrade(),
    finishStation() { if (S.stationBuild) { S.stationBuild.prog = 1; updateStationBuild(0); } },
    buyTrain: () => buyTrain(),
    lookStation(d = 70) { controls.target.set(STATION_X - 8, 0, 0); camera.position.set(STATION_X + d * 0.8, d * 0.7, d * 0.9); fly = null; },
    autofill(on = true, budget = 20000) { const af = autoFill(); af.on = on; af.budget = budget; autoFillTick(true); return { ...af }; },
    passing: () => passing && passing.train ? { z: Math.round(passing.train.z), v: +passing.train.v.toFixed(1), stop: +passing.train.stop.toFixed(1) } : null,
    tirs: () => tirs.list.map(t => `${t.order.matId}:${t.state}`),
    lookTir(k = 0, dist = 26) { const t = tirs.list[k]; if (!t) return; controls.target.set(t.x, 2, t.z); camera.position.set(t.x + dist * 0.8, dist * 0.6, t.z + dist * 0.7); fly = null; },
    money(n) { econ.earn(n, 'друго', 'тест'); },
    rep(n) { S.rep = n; },
    winTest(cc = '🇧🇬') { const k = COUNTRIES.find(x => x.cc === cc); for (const id of k.cities.slice(0, cc === '🇧🇬' ? 99 : 3)) econ.finishCity(id, 0.7, {}); S.dev.lv = 10; S.dev.xp = 250000; return { cities: CITIES.length, won: wonCountries(x => econ.isFinished(x)).map(x => x.nm) }; },
    hsTest() { econ.earn(5e7, 'друго', 'тест'); S.dev.lv = 10; S.dev.xp = 250000; S.rails = [{ a: S.cityId, b: 'belgrade', km: 330, days: 5, prog: 1, built: true }, { a: 'belgrade', b: 'budapest', km: 320, days: 5, prog: 1, built: true }]; openBig('rail'); return document.getElementById('bwBody').innerText.match(/Модернизирай[^\n]*/g); },
    repTest() { econ.earn(1e6, 'друго', 'тест'); for (let i = 0; i < 4; i++) { const l = city.lots.find(x => !x.built && !x.busy); est().owned.push({ cond: 40, lot: l.id, kind: 'house', rent: 400, value: 50000, since: S.day }); l.busy = 'owned'; } tab = 'estate'; renderPanel(); document.getElementById('bRepairAll').click(); return { busy: busyCount(), maint: projects.filter(p => p.maint).length, cap: officeLv().proj }; },
    cashTest() { const lots = city.lots.filter(l => l.built).slice(0, 5); for (const l of lots) { const c = { lot: l.id, amount: 10000, title: 'Тест', note: 'тест' }; S.cash.push(c); spawnCash(c); } const m0 = econ.s.money; const got = collectAllCash(' (тест)'); return { got, left: S.cash.length, d: econ.s.money - m0 }; },
    qTest() { econ.earn(1e7, 'друго', 'тест'); S.rep = 5; const free = city.lots.filter(l => !l.built && !l.busy).slice(0, 3); for (const l of free) { est().land.push(l.id); l.busy = 'land'; } while (busyCount() < officeLv().proj) { const l = city.lots.find(x => !x.built && !x.busy); est().land.push(l.id); l.busy = 'land'; buildOnLand(l.id, 'house'); } for (const l of free) buildOnLand(l.id, 'tower'); tab = 'estate'; renderPanel(); return { q: S.buildQ.length, busy: busyCount(), cap: officeLv().proj }; },
    qFree() { const p = projects.find(q => q.invest); projects.splice(projects.indexOf(p), 1); processBuildQ(); return { q: S.buildQ.length, busy: busyCount() }; },
    fleetTest() { this.seaTest(); openBig('sea'); const n0 = S.ships.length, k0 = S.ships[0].kind; document.querySelector('[data-upship]').click(); const k1 = S.ships[0].kind; document.querySelector('[data-sellship]').click(); return { n0, n1: S.ships.length, k0, k1 }; },
    seasonTest() { S.resortsOpen = true; S.resorts = { borovets: { stage: 'built', since: 1, earned: 0, ext: { hotel: true } }, velingrad: { stage: 'built', since: 1, earned: 0 } }; const m0 = econ.s.money, msgs = []; const t0 = window.__toasts = []; for (let d = 236; d <= 362; d++) { S.day = d; resorts.dailyTick(d); } updResBtn(); return { earned: S.resorts.borovets.earned, gain: Math.round(econ.s.money - m0) }; },
    r66Test(full) { S.dev.xp = 260000; S.dev.lv = 10; S.rep = 4; econ.earn(2e8, 'друго', 'тест'); S.r66 = { st: 'none' }; route66.offer(); route66.accept(); if (full) S.hwDone = [...new Set([...(S.hwDone || []), ...['chicago', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'].slice(1).map((b, k, arr) => abSegId(['chicago', 'kansascity', 'dallas', 'elpaso', 'phoenix', 'losangeles'][k], b))])]; route66.dailyTick(); openBig('hw'); return { st: route66.state().st, p: route66.progress() }; },
    oeTest(full) { S.dev.xp = 260000; S.dev.lv = 10; S.rep = 4; econ.earn(2e8, 'друго', 'тест'); S.orient = { st: 'none' }; orient.offer(); orient.accept(); if (full) S.rails = []; if (full) for (let k = 0; k < 6; k++) { const [a, b] = [['paris', 'munich'], ['munich', 'vienna'], ['vienna', 'budapest'], ['budapest', 'belgrade'], ['belgrade', 'sofia'], ['sofia', 'istanbul']][k]; S.rails = [...(S.rails || []), { a, b, km: kmBetween(a, b), days: 5, prog: 1, built: true, hs: true }]; } orient.dailyTick(); return { st: orient.state(), p: orient.progress(), money: econ.s.money }; },
    scTest() { S.dev.xp = 260000; S.dev.lv = 10; const h = S.cityId, R = (a, b) => ({ a, b, km: kmBetween(a, b), days: 5, prog: 1, built: true }); S.rails = [R(h, 'brussels'), R('brussels', 'rotterdam'), R('brussels', 'amsterdam')]; shortCache.sig = ''; const l = shortcutCands(); openBig('rail'); return l.map(o => `${o.a}-${o.b}:${o.km}/${o.now}`); },
    railWeek() { S.day = 7; flowAdd('rail', 52000, 'София → Пловдив'); flowAdd('rail', 18000, 'Пловдив → Варна'); flowDay('rail', 3000); updFlowBtns(); return $('railBtn')?.innerText; },
    flowTest() { S.day = 7; flowAdd('air', 300000, 'София → Париж'); flowAdd('air', 120000, 'София → Рим'); flowDay('air', 50000); flowAdd('sea', 90000, 'Варна → Истанбул'); flowDay('sea', 20000); updFlowBtns(); return [$('airBtn')?.innerText, $('seaBtn')?.innerText, S.flow]; },
    linkTest(act) { econ.earn(5e7, 'друго', 'тест'); S.dev.lv = 10; S.dev.xp = 250000; if (act) linkAct(act); tab = 'hq'; renderPanel(); return { needs: linkNeeds(S.cityId), html: (document.querySelector('[data-link]')?.closest('.card')?.innerText || '').slice(0, 600), ports: S.ports, airports: S.airports, access: S.roadAccess }; },
    qRep() { S.rep = 0; const l = city.lots.find(x => !x.built && !x.busy); est().land.push(l.id); l.busy = 'land'; projects.length = 0; buildOnLand(l.id, 'tower'); const a = S.buildQ.length; S.rep = 5; processBuildQ(); return { queuedWhileLowRep: a, afterRep: S.buildQ.length, started: projects.some(p => p.lot === l.id) }; },
    invTest() { econ.s.money = 1e6; econ.earn(0); const max = econ.invMax([]); econ.s.money = 1e6 + 9e6; const before = econ.s.money; withLoan(before + 2e6, 'Тест', () => {}); document.querySelectorAll('#modalBox button')[1].click(); const d = econ.invDebt(); econ.invTick(); return { max, debt: d, after: econ.invDebt(), inv: econ.s.inv }; },
    autoLineTest() { const r = this.seaTest(); S.seaRoutes = S.seaRoutes.slice(0, 1); econ.earn(1e8, 'друго', 'тест'); const n0 = S.seaRoutes.length; autoLines(); return { n0, n1: S.seaRoutes.length, routes: S.seaRoutes.map(x => x.a + '-' + x.b), max: maxSeaRoutes() }; },
    invRisk() { econ.s.money = 5e6; econ.s.deposit = 10e6; withLoan(32435000, 'Филиал в Солун', () => {}); return document.getElementById('modalBox').innerText; },
    spurTest() { econ.earn(5e7, 'друго', 'тест'); S.dev.lv = 9; S.dev.xp = 200000; S.rep = 3; S.hwDone = [...allSegs().map(x => x.id), 'ab:milan-vienna']; linkAct('road-own'); const box = document.getElementById('modalBox').innerText; document.querySelectorAll('#modalBox button')[1].click(); return { box, jobs: S.hwJobs.map(j => j.seg), spurs: S.spurs }; },
    liqTest() { window.__dbg.bust('tech'); econ.takeover('tech'); return document.getElementById('modalBox').innerText; },
    viaTest() { S.rails = [...(S.rails || []), { a: 'barcelona', b: 'milan', km: 900, days: 30, prog: 0.4, built: false }, { a: 'athens', b: 'thessaloniki', km: 500, days: 20, prog: 1, built: true }]; S.hwJobs = [...(S.hwJobs || []), { seg: 'ab:barcelona-milan', ab: true, stage: 2, prog: 0.5, city: S.cityId }]; S.dev.lv = 9; S.dev.xp = 170000; },
    mapMode(w, e) { mapWide = w; mapEU = e; showMap(true); drawMap(); },
    resortEnter(id) { S.resortsOpen = true; S.resorts = S.resorts || {}; S.resorts[id] = { stage: 'built', since: S.day, earned: 0, ext: { hotel: true } }; openHwView('resort:' + id); },
    devLv(n) { S.dev = { xp: [0, 1000, 4000, 10000, 20000, 40000, 70000, 110000, 170000, 250000][n - 1], lv: n, v: 3 }; },
    xp: () => units.map(u => [u.type, Math.round((u.xp || 0) * 10) / 10, unitLv(u)]),
    parkTest() { econ.earn(1e6, 'друго', 'тест'); S.officeLevel = 6; const lot = city.lots.find(l => !l.built && !l.busy && l.zone === 'mid'); buyLand(lot.id); buildPark(lot.id); const p = projects.find(q => q.park); completeProject(p); return { lot: lot.id, parks: S.parks, built: lot.built }; },
    unit: t => buyUnit(t),
    errs: [],
    finishOwn() { for (const p of [...projects]) if (p.own) completeProject(p); },
    garage: () => ({ office: S.officeLevel, garage: S.garageLevel, lot: S.garageLot, wh: S.whLevel, whLot: S.whLot, stock: { ...econ.s.stock }, crews: crewCount(), machines: machineCount(), own: projects.filter(p => p.own).map(p => `${p.type}:${p.stage}:${p.prog.toFixed(2)}`) }),
    look(lotId, dist = 34) { const l = lotId == null ? city.hq : city.lots[lotId]; controls.target.set(l.x, 3, l.z); camera.position.set(l.x + dist * 0.7, dist * 0.75, l.z + dist); fly = null; },
    cash: () => (S.cash || []).map(c => c.lot),
  };
}
else if (saved) { S = saved; if (sessionStorage.getItem('stroiEnter')) { sessionStorage.removeItem('stroiEnter'); enterCity(); const tb = sessionStorage.getItem('stroiTab'); if (tb) { sessionStorage.removeItem('stroiTab'); setTimeout(() => { tab = tb; renderPanel(); }, 600); }  } else { setupWorld(); fastForward(); showMap(true); } }
else showMap(true);
frame();
