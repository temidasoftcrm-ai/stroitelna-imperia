// tenders.js — държавни поръчки (обществени търгове): големи уникални обекти — контейнерни терминали в морските
// градове, нов корпус на Софийския университет и др. Държавата обявява търг, ти и конкурентите подавате оферти
// (запечатани, като процент от бюджета) и печели най-ниската, като репутацията дава малко предимство.
// Печалбата е голяма, но зависи от офертата: материалите струват matShare от бюджета, независимо колко си поискал.
// Строи се с техника в същия град; плащане: аванс 20% при подписването, останалото при предаване; закъснение — неустойка.
// Записът е в S.tenders = { [id]: { st, closes, my, bids, price, prog, start, due, paidAdv, spent } }.
//   st: 'open' (приема оферти) | 'building' | 'done' | 'lost'
import { FIRMS, firmsFor } from './rivals.js';

export const TENDERS = [
  { id: 'su-sofia', city: 'sofia', kind: 'university', ico: '🎓', nm: 'Нов корпус на Софийския университет', budget: 14000000, days: 45, rep: 3, dev: 3,
    need: { crew: 4, crane: 1, loader: 1, truck: 2 }, matShare: 0.5, ds: 'Неокласическа сграда с колонада и купол в центъра на София.' },
  { id: 'port-varna', city: 'varna', kind: 'port', ico: '⚓', nm: 'Контейнерен терминал — пристанище Варна', budget: 18000000, days: 55, rep: 3, dev: 4,
    need: { crew: 3, crane: 2, loader: 2, truck: 3 }, matShare: 0.55, ds: 'Нов кей, портални кранове и контейнерна площадка.' },
  { id: 'port-burgas', city: 'burgas', kind: 'port', ico: '⚓', nm: 'Контейнерен терминал — пристанище Бургас', budget: 15000000, days: 50, rep: 3, dev: 4,
    need: { crew: 3, crane: 2, loader: 2, truck: 3 }, matShare: 0.55, ds: 'Нов кей, портални кранове и контейнерна площадка.' },
  { id: 'port-constanta', city: 'constanta', kind: 'port', ico: '⚓', nm: 'Терминал „Черно море“ — Констанца', budget: 26000000, days: 60, rep: 3.5, dev: 6,
    need: { crew: 4, crane: 2, loader: 2, truck: 4 }, matShare: 0.55, ds: 'Най-голямото пристанище на Черно море получава нов терминал.' },
  { id: 'port-thessaloniki', city: 'thessaloniki', kind: 'port', ico: '⚓', nm: 'Пристанище Солун — нов кей', budget: 24000000, days: 60, rep: 3.5, dev: 6,
    need: { crew: 4, crane: 2, loader: 2, truck: 4 }, matShare: 0.55, ds: 'Изход на Балканите към Средиземно море.' },
  { id: 'port-istanbul', city: 'istanbul', kind: 'port', ico: '⚓', nm: 'Терминал Босфор — Истанбул', budget: 42000000, days: 70, rep: 4, dev: 7,
    need: { crew: 5, crane: 3, loader: 3, truck: 5 }, matShare: 0.55, ds: 'Огромен терминал между Европа и Азия.' },
  { id: 'port-rotterdam', city: 'rotterdam', kind: 'port', ico: '⚓', nm: 'Maasvlakte 3 — Ротердам', budget: 70000000, days: 80, rep: 4.5, dev: 8,
    need: { crew: 6, crane: 4, loader: 3, truck: 6 }, matShare: 0.55, ds: 'Най-голямото пристанище в Европа се разширява.' },
  // голям обект: size — парцели [по x, по z] (3×4 = 12 парцела); улиците между тях стават част от площадката
  { id: 'luzhniki-moscow', city: 'moscow', kind: 'stadium', size: [3, 4], ico: '🏟️', nm: 'Национален стадион „Лужники“ — Москва', budget: 140000000, days: 120, rep: 4.5, dev: 10,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, matShare: 0.55, sign: '🏟️ ЛУЖНИКИ', ds: 'Стадион за 80 000 зрители с покрив, фен зона и огромни паркинги — заема цели 12 парцела в Москва.' },
  // Африка (st- → видими, щом имаш филиал в държавата): летища, язовир на Нил, стадиони за Купата на Африка, соларен и вятърен парк, мост
  { id: 'st-airterm-cairo', city: 'cairo', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Нов терминал на летище Кайро', budget: 120000000, days: 120, rep: 4.5, dev: 10,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, matShare: 0.55, sign: '✈️ CAIRO · TERMINAL 4', ds: 'Най-натовареното летище в Африка получава нов терминал — пирамидите се виждат от пистата.' },
  { id: 'st-airterm-lagos', city: 'lagos', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Международно летище „Муртала Мохамед“ — Лагос', budget: 105000000, days: 115, rep: 4.5, dev: 10,
    need: { crew: 8, crane: 4, loader: 3, truck: 6 }, matShare: 0.55, sign: '✈️ LAGOS · LOS', ds: 'Новият терминал на най-големия град в Африка.' },
  { id: 'st-airterm-addisababa', city: 'addisababa', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Хъбът на Африка — летище Адис Абеба', budget: 95000000, days: 110, rep: 4.5, dev: 10,
    need: { crew: 7, crane: 4, loader: 3, truck: 5 }, matShare: 0.55, sign: '✈️ ADDIS ABABA · BOLE', ds: 'Етиопските авиолинии свързват цяла Африка оттук — трябва им двоен терминал.' },
  { id: 'st-dam-bahirdar', city: 'bahirdar', kind: 'dam', size: [3, 2], outer: true, ico: '🏞️', nm: 'Голям етиопски язовир „Възраждане“ на Нил', budget: 150000000, days: 140, rep: 4.5, dev: 10,
    need: { crew: 8, crane: 4, loader: 4, truck: 7 }, matShare: 0.55, sign: '🏞️ ЯЗОВИР НА НИЛ', ds: 'Най-голямата ВЕЦ в Африка — бетонна стена на Син Нил, ток за милиони домове.' },
  { id: 'st-stadium-abidjan', city: 'abidjan', kind: 'stadium', size: [3, 3], ico: '🏟️', nm: 'Стадион за Купата на Африка — Абиджан', budget: 70000000, days: 95, rep: 4, dev: 10,
    need: { crew: 6, crane: 3, loader: 3, truck: 5 }, matShare: 0.55, sign: '🏟️ КУПА НА АФРИКА', ds: 'Олимпийски стадион за 60 000 зрители за финала на Купата на африканските нации.' },
  { id: 'st-stadium-casablanca', city: 'casablanca', kind: 'stadium', size: [3, 4], ico: '🏟️', nm: 'Голям стадион „Хасан II“ — Казабланка', budget: 130000000, days: 120, rep: 4.5, dev: 10,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, matShare: 0.55, sign: '🏟️ GRAND STADE HASSAN II', ds: 'Най-големият стадион в света за 115 000 зрители — за Световното първенство 2030.' },
  { id: 'st-solar-marrakesh', city: 'marrakesh', kind: 'solar', size: [3, 2], outer: true, ico: '☀️', nm: 'Соларен парк „Нур“ — Мароко', budget: 60000000, days: 80, rep: 4, dev: 10,
    need: { crew: 5, loader: 2, truck: 4 }, matShare: 0.5, sign: '☀️ NOOR SOLAR', ds: 'Един от най-големите соларни паркове на света, в края на Сахара.' },
  { id: 'st-wind-capetown', city: 'capetown', kind: 'wind', size: [3, 2], outer: true, ico: '🌬️', nm: 'Вятърен парк на Нос Добра надежда', budget: 55000000, days: 75, rep: 4, dev: 10,
    need: { crew: 4, crane: 3, loader: 2, truck: 3 }, matShare: 0.5, sign: '🌬️ ВЯТЪРЕН ПАРК', ds: 'Ветровете на два океана — турбини по брега край Кейптаун.' },
  { id: 'st-bridge-lagos', city: 'lagos', kind: 'bridge', size: [3, 2], outer: true, ico: '🌉', nm: 'Четвъртият мост над лагуната — Лагос', budget: 85000000, days: 100, rep: 4.5, dev: 10,
    need: { crew: 6, crane: 3, loader: 3, truck: 4 }, matShare: 0.55, sign: '🌉 4TH MAINLAND BRIDGE', ds: 'Висящ мост над лагуната — 38 км през най-задръстения град в Африка.' },
  { id: 'st-canal-alexandria', city: 'alexandria', kind: 'canal', size: [3, 5], outer: true, ico: '⚓', nm: 'Новият Суецки канал — паралелен ръкав', budget: 220000000, days: 160, rep: 4.5, dev: 10,
    need: { crew: 9, crane: 4, loader: 6, truck: 8 }, matShare: 0.5, sign: '⚓ НОВИЯТ СУЕЦКИ КАНАЛ', ds: '35 км нов ръкав на Суецкия канал, за да минават кораби в двете посоки едновременно — с вантов мост и фар на входа при Порт Саид.' },
  // нови международни терминали на летища (3×4 парцела)
  { id: 'air-sofia', city: 'sofia', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Терминал 3 на летище София', budget: 90000000, days: 100, rep: 4, dev: 8,
    need: { crew: 7, crane: 3, loader: 3, truck: 5 }, matShare: 0.55, sign: '✈️ ТЕРМИНАЛ 3 · СОФИЯ', ds: 'Нов международен терминал със стъклена фасада, ръкави за самолетите и контролна кула.' },
  { id: 'air-istanbul', city: 'istanbul', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Новото летище на Истанбул', budget: 180000000, days: 130, rep: 4.5, dev: 10,
    need: { crew: 9, crane: 5, loader: 4, truck: 7 }, matShare: 0.55, sign: '✈️ İSTANBUL HAVALİMANI', ds: 'Едно от най-големите летища в света — огромен терминал между Европа и Азия.' },
  { id: 'air-berlin', city: 'berlin', kind: 'airterm', size: [3, 4], ico: '✈️', nm: 'Летище Берлин Бранденбург — Терминал 2', budget: 140000000, days: 120, rep: 4.5, dev: 9,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, matShare: 0.55, sign: '✈️ BER · TERMINAL 2', ds: 'Вторият терминал на новото летище на Берлин — този път навреме!' },
  { id: 'campnou-barcelona', city: 'barcelona', kind: 'stadium', variant: 'campnou', size: [3, 4], ico: '🏟️', nm: 'Стадион „Камп Ноу“ — Барселона', budget: 130000000, days: 115, rep: 4.5, dev: 9,
    need: { crew: 8, crane: 4, loader: 4, truck: 6 }, matShare: 0.55, sign: '🏟️ КАМП НОУ', ds: 'Новият дом на „Барса“ за 105 000 зрители — най-големият стадион в Европа, на 12 парцела в Барселона.' },
  { id: 'olympia-berlin', city: 'berlin', kind: 'stadium', variant: 'olympia', size: [3, 3], ico: '🏟️', nm: 'Олимпийски стадион — Берлин', budget: 110000000, days: 110, rep: 4.5, dev: 9,
    need: { crew: 7, crane: 4, loader: 3, truck: 6 }, matShare: 0.55, sign: '🏟️ ОЛИМПИЙСКИ СТАДИОН', ds: 'Реконструкция на историческия стадион с парка, басейна и площада около него — 9 парцела в Берлин.' },
  // Азия: Великата китайска стена край Пекин — реставрация на участъка Бадалин с кулите по хълмовете, посетителски център и път (3D: greatwall3d.js)
  { id: 'st-greatwall-beijing', city: 'beijing', kind: 'greatwall', size: [3, 3], outer: true, ico: '🏯', nm: 'Реставрация на Великата китайска стена — Бадалин', budget: 160000000, days: 140, rep: 4.5, dev: 16,
    need: { crew: 9, crane: 3, loader: 4, truck: 6 }, matShare: 0.5, sign: '🏯 GREAT WALL · BADALING', ds: 'Каменната стена и сигналните кули по хълмовете над Пекин се реставрират камък по камък; долу — посетителски център, паркинг и нов път за милионите туристи.' },
];
export const BID_MS = [0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05];
export const ADVANCE = 0.2, LATE_PEN = 0.005, OPEN_DAYS = 7;
// гаранция за участие: 20% от бюджета се блокира при подаване на оферта; връща се на загубилите при отварянето
// на офертите, а на спечелилия — при предаването на обекта. Закъснение над BOND_LOST дни — договорът се разваля и гаранцията се губи.
// При закъснение: 🚀 подизпълнител (+10% напредък срещу пари), 📝 анекс (+60 дни срок, до 2 пъти), ✋ доброволен отказ.
export const BOND = 0.2, BOND_LOST = 200, PEN_MAX = 0.3, ANNEX_DAYS = 60, ANNEX_MAX = 2, BOOST = 0.1;
export const bondOf = t => Math.round(t.budget * BOND / 10000) * 10000;
const T = id => TENDERS.find(t => t.id === id);

// deps: { S(), econ(), toast, modal(title, html, buttons), fmt, save, sound(n), rep(), devBest(), owns(cityId), cityName(id),
//         fleetIn(cityId) → { type: count } (техниката в този град), emit?(ev), onProgress?(id, prog) — 3D, onDone?(id), pop?(key, cap, sub) — снимка }
export function createTenders(deps) {
  const st = () => { const S = deps.S(); S.tenders = S.tenders || {}; return S.tenders; };
  const day = () => deps.S().day;
  const ul = k => deps.unitLabel ? deps.unitLabel(k) : k;
  const refund = (t, s, why) => { if (!s.bond) return; deps.econ().earn(s.bond, 'гаранция', `Върната гаранция: ${t.nm}`); if (why) deps.toast(`🔐 ${why}: върнаха ти гаранцията ${deps.fmt(s.bond)} €.`, 'good'); s.bond = 0; };
  // наличност за гаранцията: сметката + депозитът в банката (недостигът се взима от депозита)
  const avail = () => { const e = deps.econ(); return Math.max(0, e.s.money) + (e.s.deposit || 0); };
  const eligible = t => deps.devBest() >= t.dev && deps.rep() >= t.rep - 1 && (!deps.canTender || deps.canTender(t));   // canTender — напр. само в държави, където имаш град
  const profitAt = (t, m) => Math.round(t.budget * (m - t.matShare) - Object.entries(t.need).reduce((a, [, n]) => a + n, 0) * 600 * t.days);   // грубо: минус заплати/гориво
  // ефективна оценка на офертата: по-ниска е по-добра; всяка звезда репутация = 1% по-изгодна за държавата
  const score = (m, rep) => m * (1 - 0.01 * rep);

  function announce(t) {
    const pool = (firmsFor && deps.ccOf ? firmsFor(deps.ccOf(t.city)) : null) || FIRMS;   // местни фирми в чужбина
    const rv = [...(pool.length >= 3 ? pool : [...pool, ...FIRMS])].sort(() => Math.random() - 0.5).slice(0, 3);
    st()[t.id] = { st: 'open', closes: day() + OPEN_DAYS, my: null, bids: rv.map(f => ({ nm: f.nm, ico: f.ico, m: Math.round((0.78 + Math.random() * 0.2 + (1 - f.power) * 0.05) * 100) / 100, rep: 2 + f.power * 2 })) };
    deps.toast(`🏛️ Държавна поръчка: ${t.nm} — бюджет ${deps.fmt(t.budget)} €. Офертите се приемат до ден ${day() + OPEN_DAYS}.`, 'good');
    if (deps.sound) deps.sound('offer');
  }
  function close(t) {
    const s = st()[t.id];
    const all = [...s.bids.map(b => ({ ...b, sc: score(b.m, b.rep) })), ...(s.my ? [{ me: true, nm: 'Твоята фирма', m: s.my, sc: score(s.my, deps.rep()) }] : [])].sort((a, b) => a.sc - b.sc);
    const w = all[0];
    if (w.me) {
      const price = Math.round(t.budget * s.my / 10000) * 10000, adv = Math.round(price * ADVANCE);
      Object.assign(s, { st: 'building', price, prog: 0, start: day(), due: day() + t.days, paidAdv: adv, spent: 0, result: all.map(x => [x.nm, x.m]) });
      deps.econ().earn(adv, 'обект', `Аванс: ${t.nm}`);
      deps.toast(`🏆 Спечели търга „${t.nm}“ за ${deps.fmt(price)} €! Аванс ${deps.fmt(adv)} €. Срок: ${t.days} дни.`, 'good');
      if (deps.sound) deps.sound('done');
      if (deps.pop) deps.pop('tender-won', `🏆 ${t.ico || '🏛️'} ${t.nm}`, `Спечели държавната поръчка за ${deps.fmt(price)} € · аванс ${deps.fmt(adv)} €`);
      if (deps.emit) deps.emit('tenderWon');
    } else {
      Object.assign(s, { st: 'lost', lostDay: day(), winner: w.nm, winM: w.m, result: all.map(x => [x.nm, x.m]) });
      refund(t, s);
      if (s.my && deps.pop) deps.pop('tender-lost', `${t.ico} ${t.nm}`, `Спечели ${w.nm} с ${Math.round(w.m * 100)}% (ти: ${Math.round(s.my * 100)}%) · гаранцията се връща`);
      if (s.my) deps.toast(`🏛️ Търгът „${t.nm}“ го спечели ${w.nm} с ${Math.round(w.m * 100)}% от бюджета (ти: ${Math.round(s.my * 100)}%). Гаранцията ти се връща.`, 'bad');
    }
  }
  // колко от нужната техника има в града: 0…1 (най-слабото звено)
  const fleetRatio = t => { const f = deps.fleetIn(t.city) || {}; return Math.min(1, ...Object.entries(t.need).map(([k, n]) => (f[k] || 0) / n)); };
  const missing = t => { const f = deps.fleetIn(t.city) || {}; return Object.entries(t.need).filter(([k, n]) => (f[k] || 0) < n).map(([k, n]) => [k, n - (f[k] || 0)]); };

  // краен срок преди разваляне (за стари записи, вече над прага — още 30 дни отсрочка)
  const cancelAt = s => s.cancelAt ?? (s.cancelAt = Math.max(s.due + BOND_LOST, day() + 30));
  const penOf = s => Math.min(Math.round(s.price * PEN_MAX), Math.round(s.price * LATE_PEN * Math.max(0, day() - s.due)));
  const boostCost = t => Math.round(t.budget * t.matShare * BOOST * 1.6 / 10000) * 10000;   // материали + надценка на подизпълнителя
  const annexCost = s => Math.round(s.price * 0.03 / 10000) * 10000;
  function cancel(t, voluntary = false) {
    const s = st()[t.id], S = deps.S(); if (!s || s.st !== 'building') return;
    const lost = (s.bond || 0) + (s.bondLost || 0), dr = voluntary ? 0.3 : 0.5;
    if (s.bond) { s.bondLost = s.bond; s.bond = 0; }
    Object.assign(s, { st: 'lost', lostDay: day(), winner: voluntary ? 'ти се отказа от договора' : 'договорът е развален заради закъснението', winM: 0, cancelled: true });
    S.rep = Math.max(0, (S.rep || 0) - dr);
    deps.toast(`❌ ${t.ico} ${t.nm}: ${voluntary ? 'отказа се от договора' : `закъснение над ${BOND_LOST} дни — държавата развали договора`}. Гаранцията ${deps.fmt(lost)} € е загубена · −${dr} ★`, 'bad');
    if (deps.sound) deps.sound('error');
    if (deps.pop) deps.pop('tender-lost', `${t.ico} ${t.nm}`, voluntary ? `Отказа се от договора · гаранцията ${deps.fmt(lost)} € е загубена` : `Договорът е развален · гаранцията ${deps.fmt(lost)} € е загубена`);
    if (deps.onCancel) deps.onCancel(t.id);
    deps.save();
  }
  function boost(id) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'building') return;
    const c = boostCost(t);
    if (!deps.econ().canAfford(c)) { deps.toast('Нямаш достатъчно пари за подизпълнителя.', 'bad'); return; }
    deps.econ().spend(c, 'материали', `Подизпълнител: ${t.nm}`); s.spent += c;
    s.prog = Math.min(0.999, s.prog + BOOST); if (deps.onProgress) deps.onProgress(t.id, s.prog);
    deps.toast(`🚀 Подизпълнител пое част от „${t.nm}“: +${BOOST * 100}% (сега ${Math.round(s.prog * 100)}%).`, 'good'); deps.save();
  }
  function annex(id) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'building' || (s.annex || 0) >= ANNEX_MAX) return;
    const c = annexCost(s);
    if (!deps.econ().canAfford(c)) { deps.toast('Нямаш достатъчно пари за анекса.', 'bad'); return; }
    deps.econ().spend(c, 'глоба', `Анекс за срок: ${t.nm}`);
    cancelAt(s); s.due += ANNEX_DAYS; s.cancelAt += ANNEX_DAYS; s.annex = (s.annex || 0) + 1;
    deps.S().rep = Math.max(0, (deps.S().rep || 0) - 0.1);
    deps.toast(`📝 Анекс за „${t.nm}“: срокът е удължен с ${ANNEX_DAYS} дни (до ден ${s.due}) · −${deps.fmt(c)} € · −0.1 ★`, 'good'); deps.save();
  }

  function dailyTick() {
    const S = deps.S(); if (!S) return;
    const all = st();
    // нов търг: най-много един отворен наведнъж
    if (!Object.values(all).some(s => s.st === 'open') && Math.random() < 0.05) {
      const cand = TENDERS.filter(t => eligible(t) && (!all[t.id] || (all[t.id].st === 'lost' && day() - all[t.id].lostDay > 120)));
      if (cand.length) announce(cand[(Math.random() * cand.length) | 0]);
    }
    for (const t of TENDERS) {
      const s = all[t.id]; if (!s) continue;
      if (s.st === 'open' && day() >= s.closes) close(t);
      else if (s.st === 'building') {
        if (day() > s.due) {
          const left = cancelAt(s) - day();
          if (left <= 0) { cancel(t); continue; }
          if (left === 60 || left === 30 || left === 10) deps.toast(`⚠️ ${t.ico} ${t.nm} закъснява ${day() - s.due} дни — след ${left} дни държавата разваля договора и задържа гаранцията! Ускори с подизпълнител или поискай анекс.`, 'bad', deps.openWin);
        }
        const r = fleetRatio(t); if (r <= 0) continue;
        const dp = Math.min(1 - s.prog, r / t.days);
        s.prog += dp;
        const mat = Math.round(t.budget * t.matShare * dp);   // материалите се плащат според напредъка
        deps.econ().spend(mat, 'материали', `Материали: ${t.nm}`); s.spent += mat;
        if (deps.onProgress) deps.onProgress(t.id, s.prog);
        if (s.prog >= 1 - 1e-6) {
          const late = Math.max(0, day() - s.due), pen = penOf(s), rest = s.price - s.paidAdv - pen;
          deps.econ().earn(rest, 'обект', `Предаден: ${t.nm}${pen ? ` (неустойка −${deps.fmt(pen)})` : ''}`);
          Object.assign(s, { st: 'done', doneDay: day(), profit: s.price - pen - s.spent - (s.bondLost || 0) });
          refund(t, s, `${t.nm} е предаден`);
          S.rep = Math.min(5, (S.rep || 0) + 0.5);
          deps.toast(`🏛️ ${t.ico} ${t.nm} е готов! Получи ${deps.fmt(rest)} €${pen ? ` (неустойка за ${late} дни закъснение: −${deps.fmt(pen)} €)` : ''}. +0.5 ★`, 'good');
          if (deps.sound) deps.sound('done');
          if (deps.emit) deps.emit('tenderDone');
          if (deps.onDone) deps.onDone(t.id);
          if (deps.onComplete) deps.onComplete(t.id, t);
        }
      }
    }
  }

  function bid(id, m) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'open') return;
    if (!deps.owns(t.city)) { deps.toast(`Трябва ти филиал в ${deps.cityName(t.city)}, за да участваш.`, 'bad'); return; }
    if (!s.bond) {
      const b = bondOf(t);
      const e = deps.econ(), fromDep = Math.max(0, b - Math.max(0, e.s.money));
      if (avail() < b) { deps.toast(`🔐 За участие е нужна гаранция ${deps.fmt(b)} € (${BOND * 100}% от бюджета) — нямаш толкова в сметката и депозита.`, 'bad'); return; }
      if (fromDep > 0) { e.depositOut(fromDep); deps.toast(`🏦 ${deps.fmt(fromDep)} € от гаранцията са взети от депозита.`, 'good'); }
      e.spend(b, 'гаранция', `Гаранция за участие: ${t.nm}`); s.bond = b;
    }
    s.my = m; deps.toast(`📨 Подаде оферта за „${t.nm}“: ${deps.fmt(Math.round(t.budget * m / 10000) * 10000)} € (${Math.round(m * 100)}%). Резултатът — на ден ${s.closes}.`, 'good');
    deps.save();
  }

  // ---- UI: карти за таба „Поръчки“ и прозорец за офертата
  function cardsHtml() {
    const out = [];
    for (const t of TENDERS) {
      const s = st()[t.id]; if (!s || s.st === 'lost' && day() - s.lostDay > 3) continue;
      if (s.st === 'done' && day() - s.doneDay > 3) continue;
      const own = deps.owns(t.city);
      let body = '';
      if (s.st === 'open') body = `<div class="meta">Бюджет <b style="color:var(--txt)">${deps.fmt(t.budget)} €</b> · срок ${t.days} дни · оферти до ден ${s.closes} (${s.closes - day()} д.)</div>
        <div class="meta">${s.my ? `📨 Твоята оферта: <b style="color:var(--acc)">${Math.round(s.my * 100)}%</b> = ${deps.fmt(Math.round(t.budget * s.my / 10000) * 10000)} €` : own ? 'Още не си подал оферта.' : `🔒 Трябва ти филиал в ${deps.cityName(t.city)}.`}</div>
        <div class="meta">🔐 Гаранция за участие: <b style="color:var(--txt)">${deps.fmt(bondOf(t))} €</b> (${BOND * 100}% от бюджета)${s.bond ? ' · <span style="color:var(--ok)">внесена</span>' : avail() < bondOf(t) ? ' · <span class="late">нямаш толкова в сметката и депозита</span>' : deps.econ().s.money < bondOf(t) ? ' · <span style="color:var(--acc)">ще се вземе и от депозита</span>' : ' · блокира се до края на търга'}</div>
        <div class="row" style="justify-content:flex-end;gap:6px">${deps.showCity ? `<button class="btn2" data-tshow="${t.city}">📍 Покажи</button>` : ''}<button class="btn" data-tender="${t.id}" ${own && (s.bond || avail() >= bondOf(t)) ? '' : 'disabled'}>${s.my ? 'Смени офертата' : '📨 Участвай'}</button></div>`;
      else if (s.st === 'building') { const miss = missing(t); body = `<div class="meta">Договор: <b style="color:var(--txt)">${deps.fmt(s.price)} €</b> · ${Math.round(s.prog * 100)}% · срок до ден ${s.due}${day() > s.due ? ' <span class="late">— закъснява!</span>' : ''}</div>
        <div class="bar"><i style="width:${(s.prog * 100).toFixed(1)}%"></i></div>
        ${s.bond ? `<div class="meta">🔐 Гаранция ${deps.fmt(s.bond)} € — връща се при предаването</div>` : s.bondLost ? `<div class="meta late">🔐 Гаранцията (${deps.fmt(s.bondLost)} €) е задържана заради закъснението</div>` : ''}
        ${miss.length ? `<div class="meta late">⏸ Трябва техника в ${deps.cityName(t.city)}: ${miss.map(([k, n]) => `${ul(k)} ×${n}`).join(', ')}</div>` : ''}
        ${day() > s.due ? (() => { const left = cancelAt(s) - day(), bc = boostCost(t), ac = annexCost(s), canA = (s.annex || 0) < ANNEX_MAX;
          return `<div class="meta late">⚠️ Закъснява ${day() - s.due} д. · неустойка ${deps.fmt(penOf(s))} € (макс. ${PEN_MAX * 100}%) · <b>${left > 0 ? `договорът се разваля след ${left} д.` : 'договорът се разваля днес'}</b> и гаранцията се губи</div>
          <div class="row" style="justify-content:flex-end;gap:6px;flex-wrap:wrap"><button class="btn" data-tboost="${t.id}" ${deps.econ().canAfford(bc) ? '' : 'disabled'} title="Подизпълнител поема 10% от работата">🚀 Подизпълнител +${BOOST * 100}% · ${deps.fmt(bc)} €</button>
            <button class="btn2" data-tannex="${t.id}" ${canA && deps.econ().canAfford(ac) ? '' : 'disabled'} title="Удължава срока с ${ANNEX_DAYS} дни · −0.1 ★">📝 Анекс +${ANNEX_DAYS} дни · ${deps.fmt(ac)} €${canA ? '' : ' (изчерпан)'}</button>
            <button class="btn2" data-tquit="${t.id}" title="Губиш гаранцията и 0.3 ★">✋ Откажи се</button></div>`; })() : ''}`; }
      else if (s.st === 'done') body = `<div class="meta" style="color:var(--ok)">✅ Предаден · печалба ${deps.fmt(s.profit)} €</div>`;
      else body = `<div class="meta late">Спечели ${s.winner} (${Math.round(s.winM * 100)}%).</div>`;
      out.push(`<div class="card tender-card"><h3><span class="ico">🏛️</span>${t.ico} ${t.nm}</h3><div class="meta">Държавна поръчка · ${deps.cityName(t.city)} · ${t.ds}</div>${body}</div>`);
    }
    return out.join('');
  }
  function bind(el, redraw = deps.redraw) {
    el.querySelectorAll('[data-tender]').forEach(b => b.onclick = () => openBid(b.dataset.tender)); el.querySelectorAll('[data-tshow]').forEach(b => b.onclick = () => deps.showCity(b.dataset.tshow));
    const re = () => redraw && redraw();
    el.querySelectorAll('[data-tboost]').forEach(b => b.onclick = () => { boost(b.dataset.tboost); re(); });
    el.querySelectorAll('[data-tannex]').forEach(b => b.onclick = () => { annex(b.dataset.tannex); re(); });
    el.querySelectorAll('[data-tquit]').forEach(b => b.onclick = () => { const t = T(b.dataset.tquit), s = st()[t.id];
      deps.modal(`✋ Откажи се от „${t.nm}“?`, `Държавата задържа гаранцията ${deps.fmt((s.bond || 0) + (s.bondLost || 0))} € и губиш 0.3 ★ (при развален договор — 0.5 ★). Аванса не го връщаш.`, [['Не', null], ['✋ Откажи се', () => { cancel(t, true); re(); }]]); });
  }
  function openBid(id) {
    const t = T(id), s = st()[id]; if (!s || s.st !== 'open') return;
    const rep = deps.rep(), lo = Math.min(...s.bids.map(b => b.m)), hi = Math.max(...s.bids.map(b => b.m));
    const rows = BID_MS.map(m => { const p = profitAt(t, m); return `<tr><td><b>${Math.round(m * 100)}%</b></td><td>${deps.fmt(Math.round(t.budget * m / 10000) * 10000)} €</td><td style="color:${p >= 0 ? 'var(--ok)' : 'var(--bad)'}">${p >= 0 ? '+' : ''}${deps.fmt(p)} €</td></tr>`; }).join('');
    deps.modal(`🏛️ ${t.nm}`, `${t.ds}<br><br>Бюджет на държавата: <b>${deps.fmt(t.budget)} €</b> · срок ${t.days} дни · аванс ${ADVANCE * 100}%.<br>
      🔐 <b>Гаранция за участие ${deps.fmt(bondOf(t))} €</b> (${BOND * 100}% от бюджета) — ${s.bond ? 'вече е внесена' : 'взима се при подаване на офертата'}. Ако загубиш, се връща веднага; ако спечелиш — при предаването на обекта (при закъснение над ${BOND_LOST} дни договорът се разваля и я губиш).<br>
      Материалите струват ~${Math.round(t.matShare * 100)}% от бюджета, независимо от цената ти. Нужна техника в ${deps.cityName(t.city)}: ${Object.entries(t.need).map(([k, n]) => `${ul(k)} ×${n}`).join(', ')}.<br>
      Участват още ${s.bids.length} фирми (${s.bids.map(b => b.ico + ' ' + b.nm).join(', ')}). По слухове офертите им са между <b>${Math.round((lo - 0.04) * 100)}%</b> и <b>${Math.round((hi + 0.03) * 100)}%</b>. Печели най-ниската; твоите ${rep.toFixed(1)} ★ я правят с ${rep.toFixed(1)}% по-изгодна.
      <table style="width:100%;margin-top:8px;font-size:13px"><tr style="color:var(--mut)"><td>Оферта</td><td>Цена</td><td>Печалба (прибл.)</td></tr>${rows}</table>`,
      [['Отказ', null], ...BID_MS.map(m => [`${Math.round(m * 100)}%`, () => { bid(id, m); if (deps.redraw) deps.redraw(); }])]);
  }
  const state = id => st()[id] || null;
  const progOf = id => { const s = st()[id]; return !s ? null : s.st === 'done' ? 1 : s.st === 'building' ? s.prog : null; };
  return { dailyTick, cardsHtml, bind, openBid, state, progOf, missing: id => missing(T(id)), announce: id => announce(T(id)), close: id => close(T(id)) };
}
