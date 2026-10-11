// oceania.js — Фаза АВСТРАЛИЯ И ОКЕАНИЯ (последният континент, след Азия): отделна карта „🦘 Австралия“, Нова Зеландия за завладяване,
// още австралийски градове, транзит в Тихия океан и магистрали (corridors.js, cont: 'oc').
// Отключва се, когато имаш 3 филиала в Азия или една завладяна азиатска държава (ocOpen).
import { isAsia, AS_COUNTRIES } from './asia.js';
import { isSA } from './samerica.js';
import { isNA } from './namerica.js';
import { isAfrica } from './africa.js';
const c = (id, nm, lat, lon, sz, cc, extra = {}) => ({ id, nm, lat, lon, sz, cc, oc: true, ...extra });
export const OCEANIA = [
  // 🇦🇺 още градове в Австралия (ключовите 5 за завладяване си остават)
  c('canberra', 'Канбера', -35.281, 149.130, 2, '🇦🇺', { left: true }), c('goldcoast', 'Голд Коуст', -28.017, 153.400, 2, '🇦🇺'), c('darwin', 'Дарвин', -12.463, 130.845, 2, '🇦🇺'),
  c('hobart', 'Хобарт', -42.882, 147.327, 2, '🇦🇺'), c('cairns', 'Кернс', -16.920, 145.771, 2, '🇦🇺'), c('townsville', 'Таунсвил', -19.259, 146.817, 1, '🇦🇺'), c('alicesprings', 'Алис Спрингс', -23.698, 133.880, 1, '🇦🇺'),
  // 🇳🇿 Нова Зеландия
  c('auckland', 'Окланд', -36.848, 174.763, 3, '🇳🇿', { left: true }), c('wellington', 'Уелингтън', -41.286, 174.776, 2, '🇳🇿'), c('christchurch', 'Крайстчърч', -43.532, 172.637, 2, '🇳🇿'),
  c('queenstown', 'Куинстаун', -45.031, 168.663, 1, '🇳🇿', { left: true }), c('hamilton', 'Хамилтън', -37.787, 175.279, 1, '🇳🇿'),
  // транзит в Тихия океан
  c('suva', 'Сува', -18.124, 178.450, 2, '🇫🇯'), c('portmoresby', 'Порт Морсби', -9.443, 147.180, 2, '🇵🇬'),
];
// австралийските градове, които вече ги има в WORLD
export const OC_OLD = ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'];
export const OC_NEW = new Set(OCEANIA.map(x => x.id));
export const OC_IDS = new Set([...OC_NEW, ...OC_OLD]);
export const isOceania = id => OC_IDS.has(id);
export const OC_COASTAL = ['goldcoast', 'darwin', 'hobart', 'cairns', 'townsville', 'auckland', 'wellington', 'christchurch', 'suva', 'portmoresby'];
export const OC_COUNTRIES = [
  { cc: '🇳🇿', nm: 'Нова Зеландия', iso: 'NZL', cities: ['auckland', 'wellington', 'christchurch', 'queenstown', 'hamilton'] },
];
// отключване: 3 филиала в Азия или една завладяна азиатска държава (и старите — Китай, Япония, Корея, Индия, ОАЕ)
const AS_KEYS = [...AS_COUNTRIES.map(k => k.cities), ['beijing', 'shanghai', 'hongkong', 'guangzhou', 'shenzhen'], ['tokyo', 'osaka', 'kyoto', 'yokohama', 'sapporo'], ['seoul', 'busan', 'incheon', 'daegu', 'daejeon'],
  ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata'], ['dubai', 'abudhabi', 'sharjah', 'ajman', 'alain'], ['singapore']];
export const OC_NEED = 3;
export const ocOpen = (owned, isDone) => owned.filter(isAsia).length >= OC_NEED || AS_KEYS.some(cs => cs.every(isDone));
export const ocLockTxt = owned => `🔒 Австралия и Океания се отключват с <b>${OC_NEED} филиала в Азия</b> (сега ${owned.filter(isAsia).length}) или с една завладяна азиатска държава.`;

const own = c => [c.S().hqCity || c.S().cityId, ...(c.S().branches || [])];
const fin = c => Object.keys((c.econ().s.finished) || {});
const ocHw = c => (c.S().hwDone || []).filter(id => String(id).startsWith('ab:') && String(id).slice(3).split('-').some(isOceania)).length;
const AUS = ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'];
export const OC_CHAPTER = { id: 'c17', nm: 'Австралия и Океания', ico: '🦘', pic: 'unlock-oceania', picTxt: 'Последният континент: Магистрала 1 около Австралия, пустинята до Дарвин и Нова Зеландия. Отвори „🦘 Австралия“ на картата.',
  openIf: c => c.devBest() >= 10 && ocOpen(own(c), id => fin(c).includes(id)), lockTxt: `Отключва се с ${OC_NEED} филиала в Азия или една завладяна азиатска държава.`, quests: [
    { id: 'oc_br1', ico: '🦘', nm: 'Долу под нас', ds: 'Отвори филиал в Австралия или Океания.', goal: c => [own(c).filter(isOceania).length, 1], money: 50000000 },
    { id: 'oc_syd', ico: '🎭', nm: 'Сидни', ds: 'Отвори филиал в Сидни.', goal: c => [own(c).includes('sydney') ? 1 : 0, 1], money: 50000000 },
    { id: 'oc_nz', ico: '🥝', nm: 'Нова Зеландия', ds: 'Отвори филиал в Окланд.', goal: c => [own(c).includes('auckland') ? 1 : 0, 1], money: 60000000 },
    { id: 'oc_hw1', ico: '🛣️', nm: 'Магистрала 1', ds: 'Завърши участък от австралийска магистрала.', goal: c => [ocHw(c), 1], money: 60000000 },
    { id: 'oc_outback', ico: '🏜️', nm: 'Пустинята', ds: 'Завърши аутобана Аделаида — Алис Спрингс — Дарвин.', goal: c => [['ab:adelaide-alicesprings', 'ab:alicesprings-darwin'].filter(id => (c.S().hwDone || []).includes(id)).length, 2], money: 150000000 },
    { id: 'oc_aus', ico: '🟩', nm: 'Цяла Австралия', ds: 'Завладей Австралия: завърши Сидни, Мелбърн, Бризбейн, Пърт и Аделаида.', goal: c => [AUS.filter(id => fin(c).includes(id)).length, 5], money: 300000000 },
    { id: 'oc_world', ico: '🌐', nm: 'Строителна империя на света', ds: 'Имай филиал на всеки континент извън Европа: Африка, Северна и Южна Америка, Азия и Австралия.', goal: c => [[isAfrica, isNA, isSA, isAsia, isOceania].filter(f => own(c).some(f)).length, 5], money: 500000000 },
  ] };
