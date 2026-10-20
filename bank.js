// bank.js — 🏦 своята банка на холдинга („Титан Банк“): основаваш я с капитал, а тя дава кредити на общини, фирми и държави.
// Всеки кредит носи лихва всеки ден; в края на срока главницата се връща. Но някои не връщат — колкото по-нисък рейтингът,
// толкова по-висока лихва и по-голям риск. При банкова криза неплащанията скачат. Бонус: твоите кредити в чуждите банки
// ти излизат наполовина по-евтино (банката ти връща половината лихва).
// Дивиденти: лихвите остават в банката (неразпределена печалба); веднъж месечно ти изплаща дивидент — избран % от капитала годишно
// (10/20/30%), колкото позволява печалбата, а остатъкът се влива в капитала. Със своя банка депозитът вече не ти трябва —
// парите от него се изтеглят при основаването (econ.s.ownBank скрива картата на депозита във финансите).
// Фалит на длъжника: от залога се събира различно според рейтинга — при CCC често нищо (пълна загуба).
// Държавни кризи (преврат, война, хиперинфлация, държавен фалит, бедствие, санкции) удрят кредитите на правителството на
// тази държава: отписване, загуба на част от главницата, замразени лихви, отложен срок; новите ѝ искания идват като CCC.
// Записът: S.bank = { day, lv, cap, loans: [], offers: [], seq, earned, lost, crisis, ret, div, divLast, cc: [{ k, cty, until }] }.
const FOUND = 10e9, LV_MAX = 5, UP_BASE = 500e6;   // основаване — 10 млрд. € (по желание на потребителя); надграждането — по старата скала
const LEV = lv => 1.5 + lv * 0.5;   // колко пъти капитала може да е в кредити (депозитите на клиентите): 2× … 4×
const RATINGS = [
  { r: 'AAA', rate: [0.03, 0.05], pd: 0.002, col: '#7dffa8' },
  { r: 'A', rate: [0.05, 0.08], pd: 0.008, col: '#b7f27d' },
  { r: 'BBB', rate: [0.08, 0.12], pd: 0.02, col: '#ffd54a' },
  { r: 'BB', rate: [0.12, 0.17], pd: 0.05, col: '#ffb300' },
  { r: 'CCC', rate: [0.18, 0.28], pd: 0.13, col: '#ff8a8a' },
];
const KIND = [
  { k: 'muni', ico: '🏛️', nm: c => `Община ${c}`, amt: [20e6, 200e6], rt: [0, 1, 2] },
  { k: 'firm', ico: '🏗️', nm: c => c, amt: [10e6, 120e6], rt: [1, 2, 3, 4] },
  { k: 'gov', ico: '🏳️', nm: c => `Правителството на ${c}`, amt: [200e6, 2e9], rt: [0, 1, 2, 3] },
];
const R = (a, b) => a + Math.random() * (b - a);
const vav = c => (/^[вфВФ]/.test(c) ? 'във ' : 'в ') + c;   // „във Венецуела“, „в Монголия“
// държавните кризи: hit(l) → { loss: дял от остатъка, който се губи; frz: дни без лихва; ext: дни към срока; pd: множител на риска }
const CRISES = [
  { k: 'coup', ico: '🪖', nm: c => `Военен преврат ${vav(c)}`, days: 180, txt: 'Новата власт отказва да признае дълговете на старото правителство.', hit: () => Math.random() < 0.5 ? { loss: 1 } : { frz: 180, pd: 4 } },
  { k: 'war', ico: '⚔️', nm: c => `Война ${vav(c)}`, days: 365, txt: 'Държавата спира плащанията по външния дълг до края на войната; ако фалира — нищо не се връща.', hit: () => ({ frz: 365, ext: 365, pd: 8, rec0: true }) },
  { k: 'hyper', ico: '💸', nm: c => `Хиперинфлация ${vav(c)}`, days: 120, txt: 'Валутата се срива — държавата връща само част от дълга.', hit: () => ({ loss: 0.3 }) },
  { k: 'default', ico: '🏛️', nm: c => `Държавен фалит ${vav(c)}`, days: 240, txt: 'Преструктуриране на дълга: кредиторите отписват 40%, а срокът се удължава с година.', hit: () => ({ loss: 0.4, ext: 365 }) },
  { k: 'quake', ico: '🌋', nm: c => `Земетресение ${vav(c)}`, days: 90, txt: 'Мораториум върху плащанията за 90 дни, докато страната се възстановява.', hit: () => ({ frz: 90, ext: 90 }) },
  { k: 'sanctions', ico: '🚫', nm: c => `Международни санкции срещу ${c}`, days: 200, txt: 'Плащанията са блокирани от санкциите — лихви не идват, срокът се отлага.', hit: () => ({ frz: 200, ext: 200, pd: 2 }) },
];
// правителства извън Европа, които също искат кредити (рискови пазари — там кризите са по-чести)
export const WORLD_ISO = { 'Монголия': 'MNG', 'Украйна': 'UKR', 'Аржентина': 'ARG', 'Венецуела': 'VEN', 'Пакистан': 'PAK', 'Египет': 'EGY', 'Нигерия': 'NGA', 'Шри Ланка': 'LKA', 'Ливан': 'LBN', 'Казахстан': 'KAZ', 'Бразилия': 'BRA', 'Мексико': 'MEX', 'Индонезия': 'IDN', 'Кения': 'KEN', 'Етиопия': 'ETH', 'Гана': 'GHA', 'Еквадор': 'ECU', 'Боливия': 'BOL', 'Тайланд': 'THA', 'Виетнам': 'VNM' };   // за холограмата в залата
const WORLD_GOV = ['Монголия', 'Украйна', 'Аржентина', 'Венецуела', 'Пакистан', 'Египет', 'Нигерия', 'Шри Ланка', 'Ливан', 'Казахстан', 'Бразилия', 'Мексико', 'Индонезия', 'Кения', 'Етиопия', 'Гана', 'Еквадор', 'Боливия', 'Тайланд', 'Виетнам'];
// колко се събира от залога при фалит на длъжника (по рейтинга); CCC — често нищо
const recOf = ri => ri <= 1 ? R(0.4, 0.7) : ri <= 3 ? R(0.1, 0.5) : Math.random() < 0.35 ? 0 : R(0, 0.3);
const DIV_OPTS = [0.1, 0.2, 0.3], DIV_DEF = 0.2, DIV_DAYS = 30;   // дивидентът — % от капитала годишно, изплаща се на 30 дни

// deps: { S, econ, fmt, toast, save, sound, pop, brand(), cities() → имена на твоите градове, firms() → имена на конкуренти, countries() → имена на държави, interestPaid() → вчерашните лихви (положително) }
export function createBank(deps) {
  const st = () => deps.S().bank || null;
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} млрд. €` : `${deps.fmt(Math.round(n / 1e5) / 10)} млн. €`;
  const govs = () => [...new Set([...deps.countries(), ...WORLD_GOV])];
  const lent = () => (st()?.loans || []).reduce((a, l) => a + l.left, 0);
  const room = () => { const b = st(); return b ? Math.max(0, b.cap * LEV(b.lv) - lent()) : 0; };
  const upCost = () => Math.round(UP_BASE * (st().lv + 1) / 1e6) * 1e6;
  function found() {
    const S = deps.S(); if (!S.holding || st()) return; const e = deps.econ(); if (!e.canAfford(FOUND)) { deps.toast(`Нямаш ${B(FOUND)} за основаването на банката.`, 'bad'); return; }
    e.spend(FOUND, 'банка', 'Основаване на банката (начален капитал)');
    S.bank = { day: S.day, lv: 1, cap: FOUND, loans: [], offers: [], seq: 0, earned: 0, lost: 0, crisis: null };
    deps.pop && deps.pop('empire', `🏦 ${deps.brand()} Банк е основана!`, `Капитал ${B(FOUND)} — можеш да даваш кредити до ${B(FOUND * LEV(1))}. Лихвите се трупат в банката и всеки месец ти изплаща дивидент (по подразбиране 20% от капитала годишно), а твоите кредити в чуждите банки ти излизат наполовина по-евтино.`);
    for (let i = 0; i < 3; i++) offer(); dropDeposit(); deps.sound && deps.sound('levelup'); deps.save();
  }
  // своя банка → депозитът (и натрупаната лихва) се връщат в касата
  function dropDeposit() {
    const e = deps.econ(); e.s.ownBank = true;
    const got = e.collectInterest() + e.depositOut();
    if (got > 0) deps.toast(`🏦 Вече имаш своя банка — депозитът и лихвата му (+${deps.fmt(got)} €) се върнаха в касата. Оттук нататък печелиш от дивидентите на банката.`, 'good');
  }
  const divRate = () => st()?.div ?? DIV_DEF;
  function setDiv(r) { const b = st(); if (!b || !DIV_OPTS.includes(r)) return; b.div = r; deps.toast(`🏦 Дивидентът е ${Math.round(r * 100)}% от капитала годишно — изплаща се всеки месец.`, 'good'); deps.save(); }
  function addCap(n) { const b = st(); if (!b) return; const e = deps.econ(); if (!e.canAfford(n)) { deps.toast(`Нямаш ${B(n)}.`, 'bad'); return; } e.spend(n, 'банка', 'Увеличение на капитала на банката'); b.cap += n; deps.toast(`🏦 Капиталът е ${B(b.cap)} — може да кредитира до ${B(b.cap * LEV(b.lv))}.`, 'good'); deps.save(); }
  function upgrade() { const b = st(); if (!b || b.lv >= LV_MAX) return; const c = upCost(), e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)}.`, 'bad'); return; }
    e.spend(c, 'банка', `Банката: нови клонове (ниво ${b.lv + 1})`); b.lv++; deps.toast(`🏦 Ниво ${b.lv}: повече клонове и депозити — кредитира до ${LEV(b.lv)}× капитала.`, 'good'); deps.sound && deps.sound('upgrade'); deps.save(); }
  function offer() {
    const b = st(); if (!b || b.offers.length >= 5) return;
    const K = KIND[Math.floor(Math.random() * KIND.length)], src = K.k === 'muni' ? deps.cities() : K.k === 'firm' ? deps.firms() : govs(); if (!src.length) return;
    const who = src[Math.floor(Math.random() * src.length)], hot = K.k === 'gov' && (b.cc || []).some(c => c.cty === who), ri = hot ? 4 : K.rt[Math.floor(Math.random() * K.rt.length)], RT = RATINGS[ri];   // държава в криза → CCC
    const amt = Math.round(R(K.amt[0], K.amt[1]) * (0.6 + b.lv * 0.25) / 1e6) * 1e6, rate = Math.round(R(RT.rate[0], RT.rate[1]) * 1000) / 1000, days = [180, 365, 540, 720][Math.floor(Math.random() * 4)];
    b.offers.push({ id: ++b.seq, ico: K.ico, nm: K.nm(who), ri, amt, rate, days, exp: deps.S().day + 12, ...(K.k === 'gov' ? { cty: who } : {}) });
  }
  function accept(id) {
    const b = st(), o = b?.offers.find(x => x.id === id); if (!o) return;
    if (o.amt > room()) { deps.toast(`🏦 Банката няма свободни ${B(o.amt)} — увеличи капитала или вдигни нивото.`, 'bad'); return; }
    b.offers = b.offers.filter(x => x !== o); b.loans.push({ ...o, left: o.amt, end: deps.S().day + o.days, since: deps.S().day });
    deps.toast(`🏦 ${o.ico} ${o.nm} взе ${B(o.amt)} при ${(o.rate * 100).toFixed(1)}% за ${o.days} дни.`, 'good'); deps.sound && deps.sound('buy'); deps.save();
  }
  const decline = id => { const b = st(); if (b) { b.offers = b.offers.filter(x => x.id !== id); deps.save(); } };
  function dailyTick() {
    const S = deps.S(), b = st(); if (!S || !b) return; const e = deps.econ(), day = S.day;
    if (b.crisis && day >= b.crisis.until) { b.crisis = null; deps.toast('🏦 Банковата криза отмина.', ''); }
    if (!b.crisis && Math.random() < 1 / 400) { b.crisis = { until: day + 60 }; deps.pop && deps.pop('ship-cargo', '📉 Банкова криза!', 'За около 60 дни неплащанията по кредитите скачат 3 пъти. По-рисковите длъжници са най-опасни.'); }
    countryTick(b, day);
    let inc = 0, back = 0;
    for (const l of [...b.loans]) {
      if (!(l.frz > day)) inc += l.left * l.rate / 365;   // замразен от държавна криза — без лихва
      const pdDay = RATINGS[l.ri].pd / 365 * (b.crisis ? 3 : 1) * (l.pdK && l.pdUntil > day ? l.pdK : 1);
      if (Math.random() < pdDay) { const rc = l.rec0 && l.pdUntil > day ? 0 : recOf(l.ri), loss = Math.round(l.left * (1 - rc)); writeOff(b, l, loss);
        deps.toast(rc > 0 ? `❌ ${l.ico} ${l.nm} фалира — банката губи ${B(loss)} (${Math.round(rc * 100)}% се събират от залога).` : `❌ ${l.ico} ${l.nm} фалира без нищо за връщане — банката губи целите ${B(loss)}!`, 'bad'); continue; }
      if (day >= l.end) { back += l.left; b.loans = b.loans.filter(x => x !== l); deps.toast(`✅ ${l.ico} ${l.nm} върна ${B(l.left)} — кредитът е изплатен.`, 'good'); }
    }
    inc = Math.round(inc);
    const refund = Math.round(Math.max(0, deps.interestPaid()) * 0.5);
    if (!e.s.ownBank || e.s.deposit > 0 || e.s.depReady > 0) dropDeposit();   // стар запис с депозит
    b.ret = (b.ret || 0) + inc;   // лихвите остават в банката до дивидента
    if (refund) e.earn(refund, 'банка', '🏦 Своята банка: половината от лихвите по твоите кредити');
    b.earned += inc; b.incDay = inc; b.refund = refund;
    if (day % DIV_DAYS === 0 && b.ret > 0) {   // месечен дивидент: до избрания % от капитала, остатъкът — в капитала
      const div = Math.round(Math.min(b.ret, b.cap * divRate() / 12)), rest = Math.round(b.ret - div);
      if (div > 0) e.earn(div, 'дивиденти', `🏦 ${deps.brand()} Банк: месечен дивидент`);
      b.cap += rest; b.ret = 0; b.divLast = div;
      deps.toast(`🏦 ${deps.brand()} Банк разпредели дивидент +${B(div)}${rest > 0 ? ` · ${B(rest)} остават в капитала` : ''}.`, 'good'); deps.sound && deps.sound('cash');
    }
    if (day % 5 === 0) offer();
    b.offers = b.offers.filter(o => o.exp >= day);
  }
  function writeOff(b, l, loss) { b.cap = Math.max(0, b.cap - loss); b.lost += loss; l.left -= loss; if (l.left <= 0.5) b.loans = b.loans.filter(x => x !== l); }
  // държавните кризи: нова — около 1.5 пъти годишно (по-често в държави, на които си дал кредит); ударът е веднага
  function countryTick(b, day) {
    for (const l of [...b.loans, ...b.offers]) if (!l.cty && l.nm.startsWith('Правителството на ')) l.cty = l.nm.slice(18);   // стари записи
    b.cc = (b.cc || []).filter(c => { if (day < c.until) return true; deps.toast(`🕊️ Кризата ${vav(c.cty)} отмина.`, ''); return false; });
    if (Math.random() >= 1 / 240) return;
    const mine = [...new Set(b.loans.filter(l => l.cty).map(l => l.cty))].filter(c => !b.cc.some(x => x.cty === c)), all = govs().filter(c => !b.cc.some(x => x.cty === c));
    const cty = mine.length && Math.random() < 0.7 ? mine[Math.floor(Math.random() * mine.length)] : all[Math.floor(Math.random() * all.length)]; if (!cty) return;
    const C = CRISES[Math.floor(Math.random() * CRISES.length)]; b.cc.push({ k: C.k, cty, until: day + C.days });
    let lost = 0, hitN = 0;
    for (const l of b.loans.filter(x => x.cty === cty)) {
      const h = C.hit(); hitN++;
      if (h.loss) { const n = Math.round(l.left * h.loss); lost += n; writeOff(b, l, n); }
      if (h.frz) l.frz = Math.max(l.frz || 0, day + h.frz);
      if (h.ext) l.end += h.ext;
      if (h.pd) { l.pdK = h.pd; l.pdUntil = day + C.days; l.rec0 = !!h.rec0; }
    }
    b.offers = b.offers.filter(o => o.cty !== cty);   // исканията на тази държава се оттеглят
    const sub = `${C.txt}${hitN ? ` Засегнати кредити на банката: ${hitN}${lost ? ` · загуба ${B(lost)}` : ''}.` : ' Банката ти няма кредити там — този път се размина.'}`;
    if (hitN && deps.pop) deps.pop('ship-cargo', `${C.ico} ${C.nm(cty)}!`, sub); else deps.toast(`${C.ico} ${C.nm(cty)}: ${sub}`, hitN ? 'bad' : '');
  }
  // колко ще се върне, ако всичко е наред, и рискът длъжникът да фалира до края на срока
  const backOf = o => Math.round(o.amt * (1 + o.rate * o.days / 365));
  const riskOf = o => 1 - Math.pow(1 - RATINGS[o.ri].pd, o.days / 365);
  const value = () => { const b = st(); return b ? b.cap + lent() * 0.1 : 0; };
  function winHtml() {
    const S = deps.S(), b = st(), e = deps.econ();
    if (!S.holding) return `<div class="card"><div class="meta" style="margin:0">🔒 Банката идва с <b>🏛️ Ерата на холдинга</b> (ниво 15).</div></div>`;
    if (!b) return `<div class="card"><h3 style="margin:0 0 6px">🏦 ${deps.brand()} Банк</h3><div class="meta">Основаваш своя банка с капитал <b>${B(FOUND)}</b>. Тя дава кредити на общини, фирми и държави: лихвите се трупат в банката и всеки месец ти изплаща дивидент (депозит вече не ти трябва), главницата се връща в края на срока — но някои не връщат. Колкото по-нисък рейтингът (AAA → CCC), толкова по-висока лихва и риск. <b>Бонус:</b> твоите кредити в чуждите банки ти излизат наполовина по-евтино.</div><div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn" data-bkfound="1" ${e.canAfford(FOUND) ? '' : 'disabled'}>🏦 Основи банката · ${B(FOUND)}</button></div></div>`;
    let h = `<div class="bw-stats"><div><b>${B(b.cap)}</b><span>капитал</span></div><div><b>${B(lent())} / ${B(b.cap * LEV(b.lv))}</b><span>в кредити</span></div><div><b style="color:var(--ok)">+${deps.fmt(b.incDay || 0)} €</b><span>лихви на ден</span></div><div><b style="color:#ffd54a">${B(b.ret || 0)}</b><span>печалба до дивидента (${DIV_DAYS - (S.day % DIV_DAYS)} дни)</span></div><div><b style="color:#7dd3ff">+${deps.fmt(b.refund || 0)} €</b><span>спестени лихви на ден</span></div><div><b style="color:${b.lost ? 'var(--bad)' : 'var(--ok)'}">${b.lost ? '−' + B(b.lost) : '0 €'}</b><span>загуби от фалити</span></div></div>`;
    h += `<div class="card"><div class="row" style="margin:0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1">💵 <b>Дивидент</b> — колко от печалбата взимаш всеки месец (% от капитала годишно, ~${B(b.cap * divRate() / 12)}/мес.). Каквото остане, влиза в капитала и банката може да дава повече кредити.${b.divLast ? ` Последният: <b style="color:var(--ok)">+${B(b.divLast)}</b>.` : ''}</span>${DIV_OPTS.map(r => `<button class="${r === divRate() ? 'btn' : 'btn2'}" data-bkdiv="${r}">${Math.round(r * 100)}%</button>`).join('')}</div></div>`;
    if (b.crisis) h += `<div class="card" style="border:1px solid var(--bad)"><div class="meta" style="margin:0">📉 <b>Банкова криза</b> — още ${b.crisis.until - S.day} дни неплащанията са 3× по-чести.</div></div>`;
    if ((b.cc || []).length) h += `<div class="card" style="border:1px solid var(--bad)"><h3 style="margin:0 0 6px">🌍 Държави в криза</h3>${b.cc.map(c => { const C = CRISES.find(x => x.k === c.k); return `<div class="meta" style="margin:3px 0">${C.ico} <b style="color:var(--txt)">${C.nm(c.cty)}</b> · още ${c.until - S.day} дни · ${C.txt}</div>`; }).join('')}<div class="meta" style="margin:4px 0 0">Новите искания за кредит от тези държави идват с рейтинг CCC.</div></div>`;
    h += `<div class="card"><div class="row" style="margin:0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1">🏦 Ниво ${b.lv}/${LV_MAX} · кредитира до ${LEV(b.lv)}× капитала (депозитите на клиентите)</span>${b.lv < LV_MAX ? `<button class="btn2" data-bkup="1" ${e.canAfford(upCost()) ? '' : 'disabled'}>⬆️ Клонове · ${B(upCost())}</button>` : ''}${[1e9, 5e9].map(n => `<button class="btn2" data-bkcap="${n}" ${e.canAfford(n) ? '' : 'disabled'}>➕ Капитал ${B(n)}</button>`).join('')}</div></div>`;
    const row = (o, act) => { const RT = RATINGS[o.ri]; return `<div class="row" style="margin:5px 0;align-items:center;gap:6px;flex-wrap:wrap"><span class="meta" style="margin:0;flex:1">${o.ico} <b style="color:var(--txt)">${o.nm}</b> · <b style="color:${RT.col}">${RT.r}</b> · ${B(o.amt)} · <b>${(o.rate * 100).toFixed(1)}%</b> годишно · ${o.days} дни${act ? ` · ~${deps.fmt(Math.round(o.amt * o.rate / 365))} €/ден<br>💶 При връщане: <b style="color:var(--ok)">${B(backOf(o))}</b> (печалба +${B(backOf(o) - o.amt)}) · риск от фалит ~<b style="color:${RT.col}">${(riskOf(o) * 100).toFixed(1)}%</b>${o.ri === 4 ? ' · при фалит често не се връща нищо' : ''}` : ` · остават ${B(o.left)} · до ден ${o.end}${o.frz > deps.S().day ? ` · <span style="color:var(--bad)">❄️ замразен до ден ${o.frz}</span>` : ''}`}</span>${act || ''}</div>`; };
    h += `<div class="card"><h3 style="margin:0 0 6px">📨 Искат кредит</h3>${b.offers.length ? b.offers.map(o => row(o, `<button class="btn2" data-bkdec="${o.id}">Откажи</button><button class="btn" data-bkacc="${o.id}" ${o.amt <= room() ? '' : 'disabled'}>🤝 Дай</button>`)).join('') : '<div class="meta" style="margin:0">Нови искания идват на всеки няколко дни.</div>'}</div>`;
    if (b.loans.length) h += `<div class="card"><h3 style="margin:0 0 6px">📄 Отпуснати кредити (${b.loans.length})</h3>${b.loans.map(o => row(o)).join('')}</div>`;
    return h;
  }
  function bind(box, rerender) {
    const on = (sel, fn) => box.querySelectorAll(sel).forEach(x => x.onclick = () => { fn(x); rerender(); });
    on('[data-bkfound]', () => found()); on('[data-bkup]', () => upgrade()); on('[data-bkcap]', x => addCap(+x.dataset.bkcap));
    on('[data-bkdiv]', x => setDiv(+x.dataset.bkdiv)); on('[data-bkacc]', x => accept(+x.dataset.bkacc)); on('[data-bkdec]', x => decline(+x.dataset.bkdec));
  }
  // капиталовият недостиг: кредитите не могат да са повече от капитала × лоста (boardrescue.js — предложение/извънредно заседание)
  const capNeed = () => { const b = st(); return b ? Math.max(0, lent() / LEV(b.lv) - b.cap) : 0; };
  return { room, lent, capNeed, upCost, addCap, upgrade, setDiv, divRate, DIV_OPTS, LV_MAX, RATINGS, decline, state: st, found, accept, dailyTick, value, winHtml, bind, daily: () => (st()?.incDay || 0) + (st()?.refund || 0) };
}
