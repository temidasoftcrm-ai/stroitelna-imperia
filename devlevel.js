// devlevel.js — Фаза 7: ниво на развитие на фирмата (1–10).
// Опит (XP) от обекти, жп линии, магистрали, филиали и куести. Всяко ниво: +2% към цената на поръчките.
// Отключвания: ниво 5 (+ Балканите) — оферти от доставчици; ниво 8 — стокова борса.
// Записът е в S.dev = { xp, lv }. deps: S(), toast, sound, save, pop(key, cap, sub), balkansOpen()
import { feature } from './lab/feature.js';
import { showLevel, LV_PICS } from './lvshow.js';
import { IMP_UNLOCKS } from './imperial.js';   // нивата 21–25 идват от Империал Сити (не от опит)   // ново ниво — картинка на черен екран (feature 'lv-pics')
// xp-thresh2 (f6, одит 25.10): нивата 9–15 — ~60–120 реални минути на ниво при 1× (с xp-taper); праговете само се вдигат, нивата в записите не падат
export const THRESH = feature('xp-thresh2') ? [0, 1000, 4000, 10000, 20000, 40000, 70000, 150000, 320000, 630000, 910000, 1170000, 1400000, 1630000, 1840000, 2250000, 2850000, 3600000, 4500000, 5600000]
  : [0, 1000, 4000, 10000, 20000, 40000, 70000, 150000, 250000, 380000, 550000, 760000, 1020000, 1350000, 1750000, 2250000, 2850000, 3600000, 4500000, 5600000];   // 24.10: нива 8–17 ~×1,4–1,6 по-бавно (потребителят: „много бързо вдига от 8 до 17“); 18–20 — със същата стъпка. Вече достигнатите нива не падат (lv само расте)
export const XP = { house: 50, shop: 200, office: 600, tower: 2000, rail: 1000, highway: 1500, branch: 3000, quest: 100 };
// флаг xp-km (потребителят: „да дава ХП на построена магистрала според км… и на жп линия… и на закупуване на влак, тир, кораб, самолет“):
// магистрала ~4,6 XP/км (325 км ≈ 1500 — средно както досега), аутобан ×2, жп ~3 XP/км; покупки — ТИР 10, влак 20, кораб 30 (големите 50), самолет 100
export const XP_KM = { highway: 4.6, rail: 3 }, XP_BUY = { truck: 10, train: 20, ship: 30, shipBig: 50, plane: 100 };
export const kmXp = (kind, km) => Math.max(100, Math.round((km || 0) * XP_KM[kind] / 10) * 10);
// стари скали (по версия на записа) — за преизчисляване на опита
const SCALES = { 1: [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7500], 2: [0, 500, 1500, 3500, 7000, 12000, 20000, 35000, 60000, 100000] }, VER = 3;
// записи със старата скала: същото ниво и същата част от пътя до следващото
function migrate(d) {
  if (!d || d.v === VER) return d;
  const OLD = SCALES[d.v || 1], L = d.lv || 1, a = OLD[L - 1], b = OLD[L] ?? a, f = b > a ? Math.min(1, Math.max(0, (d.xp - a) / (b - a))) : 0;
  const A = THRESH[L - 1], B = THRESH[L] ?? A;
  d.xp = Math.round(A + f * (B - A)); d.v = VER;
  return d;
}
const UNLOCKS = {
  1: '🏁 Начало — София, Пловдив, Стара Загора и Варна',
  2: '🇧🇬 Всички български градове · 🛤️ жп линии и 🛣️ магистрали',
  3: '📈 +4% към цената на поръчките · 🏛️ държавни поръчки',
  4: '👷‍♂️ Специалисти: архитект и инженер · 🏔️ курорти в България',
  5: '🌍 Балканите — жп линии и магистрали до съседите',
  6: '🛂 Филиали на Балканите · 📜 оферти от доставчици · ⚓ пристанища и кораби',
  7: '📈 Стокова борса · 🌴 курорти в чужбина',
  8: '🇪🇺 Европа — Париж, Лондон, Амстердам, Прага, Виена… · 🔴 аутобани · ⚡ преки жп връзки и 🔀 отклонения',
  9: '✈️ Летища, самолети и авиолинии · 🌐 световна карта · 🚄 Експрес „Стрела“',
  10: '🌍 Африка и целият свят · 📈 прогрес на мрежите',
  11: '🛫 Мега хъбове (летища ниво 6–7) · 🛳️ круизни кораби',
  12: '🗽 Северна Америка',
  13: '🏗️ Специални поръчки в Европа и Африка (Ламанша, Кейп — Кайро)',
  14: '🌎 Южна Америка',
  15: '🏛️ Холдинг: автопилот, дружества и директори · 🏨 офисите стават хотели · 🏆 световната класация · 🏙️ кули с 40 етажа',
  16: '🌏 Азия · 🛢️ петролна империя (кладенец → рафинерия → доставка) · 🤝 изкупуване на конкурентни фирми',
  17: '🏦 Своя банка · 📈 фондова борса (IPO, транши, дивиденти) · 🚄 „Стрела“ +30%',
  18: '🦘 Австралия · ⚡ енергийна мрежа · 🌍 световни мегапроекти (хиперлуп, Суец, Гибралтар, петролопровод)',
  19: '🏙️ Твоят град от нулата · 🛰️ мегапоръчки (Панама, Дариен, Транссибирска, „Гън“)',
  20: '👑 Световна империя: поглъщане на конгломерати · 🌐 световни концесии · надпревара за №1',
};
if (feature('bank-simple')) {   // bank-simple (f9): изкупуването на фалирали фирми — от 10, IPO (емисии и транши) — от 15, ниво 17 — само своята банка
  UNLOCKS[10] += ' · 🏢 изкупуване на фалирали фирми (дъщерни)';
  UNLOCKS[15] += ' · 📈 твоята фирма на борсата (IPO, транши, дивиденти)';
  UNLOCKS[17] = UNLOCKS[17].replace(' · 📈 фондова борса (IPO, транши, дивиденти)', '');
}
Object.assign(UNLOCKS, IMP_UNLOCKS);
export const unlockText = lv => UNLOCKS[lv] || '';
export const LV = { BG_ALL: 2, LINKS: 2, STAFF: 4, BALKANS: 5, FOREIGN: 6, OFFERS: 6, STOCKS: 7, EUROPE: 8, AIR: 9, WORLD: 10, MEGAHUB: 11, NA: 12, MEGA_EU: 13, SA: 14, SKY40: 15, AS: 16, FAST: 17, OC: 18, MEGA_WORLD: 19, EMPIRE: 20 };
export const OFFERS_LV = LV.OFFERS, STOCKS_LV = LV.STOCKS;
// xp-city-bar (f6, 25.10 — „XP пак не се качва“): опитът е на града, в който си (S.dev — CITY_KEYS в game.js), а лентата на фирмата — на най-развития град
// (firmXP = max). В по-изостанал град фирмената лента стои, докато той не задмине — затова се показва и напредъкът на самия град.
const CITY_BAR = feature('xp-city-bar');
const cityK = d => { const a = THRESH[d.lv - 1] ?? 0, b = THRESH[d.lv]; return b > a ? Math.max(0, Math.min(1, (d.xp - a) / (b - a))) : 1; };
const lvOf = xp => { let l = 1; for (let i = 0; i < THRESH.length; i++) if (xp >= THRESH[i]) l = i + 1; return l; };
// 🏢 firm-xp-sum (f6, 25.10 — потребителят избра „сборът“): опитът на ФИРМАТА = сборът от опита на всички градове (+ холдинга, както досега);
// нивата на градовете остават (специалистите, офертите на града). Прагове на фирмата — старите × K: от ниво 5 нататък играеш в няколко града,
// затова праговете са по-високи (иначе сборът би прескачал нива); темпото — приблизително като в един град + бонус от останалите.
// При първото пускане (S.firm липсва): отместване off, така че сборът − off е точно на същото място в новата скала, на което беше старият напредък
// (същото ниво, същата част от пътя) — нивото на фирмата не пада и не скача; оттук нататък всеки XP от всеки град движи фирмата.
const FSUM = feature('firm-xp-sum');
const FIRM_K = L => L <= 4 ? 1 : L === 5 ? 1.15 : L === 6 ? 1.3 : L === 7 ? 1.4 : L === 8 ? 1.5 : L === 9 ? 1.6 : 1.7;
export const FIRM_THRESH = THRESH.map((t, i) => Math.round(t * FIRM_K(i + 1) / 500) * 500);   // FIRM_THRESH[L − 1] — началото на ниво L
const lvOfFirm = xp => { let l = 1; for (let i = 0; i < FIRM_THRESH.length; i++) if (xp >= FIRM_THRESH[i]) l = i + 1; return l; };

export function createDevLevel(deps) {
  const st = () => {
    const S = deps.S(); if (!S) return null;
    if (S.dev) migrate(S.dev);
    if (!S.dev) {   // стар запис: опитът се изчислява от досегашните постижения
      const xp = (S.done || 0) * 100 + (S.rails || []).filter(r => r.built).length * XP.rail + (S.hwDone || []).length * XP.highway
        + (S.branches || []).length * XP.branch + Object.keys((S.quests || {}).claimed || {}).length * XP.quest;
      S.dev = { xp, lv: lvOf(xp), v: VER };
    }
    return S.dev;
  };
  const level = () => (st() || { lv: 1 }).lv;
  const offerMul = () => 1 + 0.02 * (level() - 1);
  // общите за фирмата неща (оферти, борса) се отключват от най-развития ти град
  // firm-xp-sum: сборът и нивото на фирмата (S.firm = { off, lv — най-високото показано, v })
  const sumXP = () => { const S = deps.S(), d = st(); let x = d ? d.xp : 0; for (const c of Object.values(S?.cities || {})) x += c.dev?.xp || 0; return x + (S?.holding ? S.hxp || 0 : 0); };
  const oldBestXP = () => { const S = deps.S(), d = st(); return Math.max(d ? d.xp : 0, ...Object.values(S?.cities || {}).map(c => c.dev?.xp || 0)) + (S?.holding ? S.hxp || 0 : 0); };
  const firmRec = () => { const S = deps.S(); if (!S) return null; if (S.firm && S.firm.v === 1) return S.firm;
    const L0 = Math.min(THRESH.length, Math.max(level(), deps.maxLevel ? deps.maxLevel() : 1)), x0 = oldBestXP(), a = THRESH[L0 - 1], b = THRESH[L0] ?? a, f = b > a ? Math.max(0, Math.min(1, (x0 - a) / (b - a))) : 0;
    const A = FIRM_THRESH[L0 - 1], B = FIRM_THRESH[L0] ?? A, pos = A + f * (B - A);
    return (S.firm = { off: Math.round(sumXP() - pos), lv: L0, v: 1 }); };   // миграция: същото ниво и същата част от пътя
  const firmXp = () => { const r = firmRec(); return r ? sumXP() - r.off : 0; };
  const firmLv = () => { const r = firmRec(); return r ? Math.max(r.lv, lvOfFirm(firmXp())) : 1; };   // не пада
  const rawBest = () => FSUM ? Math.max(firmLv(), deps.impLv ? deps.impLv() : 0) : Math.max(level(), deps.maxLevel ? deps.maxLevel() : 1, deps.impLv ? deps.impLv() : 0);
  // 🤝 общото ниво с партньора (флаг coop-lv, game.js → deps.coopCap): който е напред, чака — опитът се трупа, отключванията — щом и партньорът стигне
  const capLv = () => { const c = deps.coopCap ? deps.coopCap() : null; return c == null ? Infinity : c; };
  const best = () => Math.min(rawBest(), capLv());
  const waiting = () => rawBest() > best();
  // #4: партньорът е по-напред — чака теб, щом е повече от 2 нива пред теб (неговият таван е твоето ниво + 2, game.js → coopCap)
  const partnerAhead = () => { const p = deps.partnerLv ? deps.partnerLv() : null; return p != null && p > rawBest() ? p : 0; };
  const offersOpen = () => best() >= OFFERS_LV;
  const has = k => best() >= LV[k];
  const stocksOpen = () => best() >= STOCKS_LV;

  // 🏙️ нивата 21–25: градът изпълни условията (imperial.js) — картинка или известие, както при 1–20
  function cityUp(lv, text) {
    if (lv > capLv()) { const S = deps.S(); if (S.coopWait == null) S.coopWait = Math.min(lv - 1, best()); deps.toast(`⏳ Ниво ${lv} е готово, но чака партньора (ниво ${capLv()}) — отключванията идват, щом и той стигне`, 'good'); render(); deps.save(); return; }   // coop-lv: и нивата 21+ (imperial.js) чакат партньора
    deps.toast(`🏅 Фирмата е ниво ${lv}! ${text || UNLOCKS[lv] || ''}`, 'good', open);
    if (feature('lv-pics') && LV_PICS.has(lv)) showLevel(lv, text || UNLOCKS[lv] || '');
    else { deps.sound('lvup'); if (deps.pop && !deps.pop(`lv-${lv}`, `🏅 Ниво на развитие ${lv}`, text || UNLOCKS[lv] || '')) deps.pop('empire', `🏅 Ниво на развитие ${lv}`, text || UNLOCKS[lv] || ''); }
    render(); deps.save();
  }
  // докато е отворена 3D зала (window.__overlay3d — Директорската зала, кабинетът): опитът се трупа тихо — без „+XP“, без преначертаване и
  // без запис на всеки квартал/филиал (одобрение на 248 квартала = 248 записа на цялата игра → забиване); всичко се показва веднъж, щом излезеш
  let held = 0, heldT = 0;
  const inRoom = () => typeof window !== 'undefined' && (window.__overlay3d || 0) > 0 && (!feature('xp-km') || roomShown());
  // залата наистина ли е отворена: по средата на екрана не е градът/картата (#app, #mapScreen) — ако брояч е останал > 0 след затваряне, опитът не се задържа завинаги
  const roomShown = () => { if (!['boardRoom', 'hallFame', 'pres', 'presEnd', 'ops3d', 'svcDemo3d'].some(id => document.getElementById(id))) return false;   /* #1: брояч без отворена 3D сцена — опитът не се задържа */ const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2), app = document.getElementById('app'), map = document.getElementById('mapScreen');
    return !!e && !(app && app.contains(e)) && !(map && !map.classList.contains('hidden') && map.contains(e)); };
  function flushHeld() {
    if (inRoom()) { heldT = setTimeout(flushHeld, 700); return; }
    heldT = 0; const n = held; held = 0; if (!n) return;
    const d = st(), lv0 = d.lv; d.xp -= n; add(n);   // сега — с надписа, нивата и записа
    if (d.lv === lv0) deps.toast && deps.toast(`⭐ +${Math.round(n).toLocaleString('bg-BG')} XP от решенията на борда`, 'good');
  }
  // #1: при скриване/затваряне на страницата — задържаният опит (и нивата му) се прилага веднага, не чака залата да се затвори
  let forceAdd = false;
  const flushNow = () => { if (!held) return; clearTimeout(heldT); heldT = 0; const n = held; held = 0; const d = st(); if (!d) return; d.xp -= n; forceAdd = true; try { add(n); } finally { forceAdd = false; } };
  if (typeof window !== 'undefined') { addEventListener('pagehide', flushNow); document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); }); }
  // firm-xp-sum: новите нива на фирмата (и от опит, дошъл направо в другите градове — търговете) — картинка/известие за всяко, веднъж
  function firmCheck() {
    if (!FSUM) return; const r = firmRec(); if (!r) return; const L = Math.min(FIRM_THRESH.length, lvOfFirm(firmXp()));
    while (r.lv < L) { r.lv++; const lv = r.lv;
      if (lv > capLv()) { const S = deps.S(); if (S.coopWait == null) S.coopWait = lv - 1; deps.toast(`⏳ Ниво ${lv} е готово, но чака партньора (ниво ${capLv()}) — отключванията идват, щом и той стигне`, 'good'); continue; }
      const ut = (UNLOCKS[lv] || '') + (deps.levelBonus ? deps.levelBonus(lv) : '');
      deps.toast(`🏅 Фирмата е ниво ${lv}! ${ut}`, 'good', open);
      if (feature('lv-pics') && LV_PICS.has(lv)) { showLevel(lv, ut); continue; }
      deps.sound('lvup'); if (deps.pop && !deps.pop(`lv-${lv}`, `🏅 Ниво на развитие ${lv}`, ut)) deps.pop('office-up', `🏅 Ниво на развитие ${lv}`, ut); }
  }
  function add(n, why) {
    const d = st(); if (!d || !n) return;
    if (n > 0 && inRoom() && !forceAdd) { d.xp += n; held += n; if (!heldT) heldT = setTimeout(flushHeld, 700); return; }
    const firm0 = best();   // нивото на фирмата (най-развитият град) преди опита — картинката е само когато то се вдигне, не при всеки град
    d.xp += n;
    if (n > 0) xpFloat(n);
    const nl = lvOf(d.xp);
    if (FSUM) { while (d.lv < nl) { d.lv++; deps.toast(`🏙️ ${deps.cityName ? deps.cityName() : 'Градът'} стигна ниво ${d.lv}`, 'good'); } firmCheck(); render(); deps.save(); return; }   // firm-xp-sum
    while (d.lv < nl) {
      d.lv++;
      if (d.lv <= firm0) { deps.toast(`🏙️ ${deps.cityName ? deps.cityName() : 'Градът'} стигна ниво ${d.lv}`, 'good'); continue; }
      if (d.lv > capLv()) { const S = deps.S(); if (S.coopWait == null) S.coopWait = firm0; deps.toast(`⏳ Ниво ${d.lv} е готово, но чака партньора (ниво ${capLv()}) — отключванията идват, щом и той стигне`, 'good'); continue; }   // градът догонва фирмата (друг град вече е бил на това ниво) — само съобщение, без картинка
      const ut = (UNLOCKS[d.lv] || '') + (deps.levelBonus ? deps.levelBonus(d.lv) : '');   // 🎁 бонусът за нивото (game.js, start-easy) — веднъж, в същото съобщение
      deps.toast(`🏅 Фирмата е ниво ${d.lv}! ${ut}`, 'good', open);
      if (feature('lv-pics') && LV_PICS.has(d.lv)) { showLevel(d.lv, ut); continue; }   // градът е задминал фирмата → нова фирмена степен
      deps.sound('lvup');
      if (deps.pop && !deps.pop(`lv-${d.lv}`, `🏅 Ниво на развитие ${d.lv}`, ut)) deps.pop('office-up', `🏅 Ниво на развитие ${d.lv}`, ut);
    }
    render();
    deps.save();
  }

  // „+120 XP“ — жълт надпис на случайно място по екрана, който се издига и изчезва (при 🔕 известия — не излиза)
  let xpSndAt = -1e9;
  function xpFloat(n) {
    if (typeof document === 'undefined' || document.body.classList.contains('ntf-off')) return;
    const el = document.createElement('div');
    el.className = 'xpfloat';
    const d = st(); el.textContent = `+${Math.round(n).toLocaleString('bg-BG')} XP` + (CITY_BAR && d && best() > d.lv && deps.cityName ? ` · ${deps.cityName()}` : '');   // xp-city-bar: в кой град отива
    el.style.left = `${15 + Math.random() * 70}vw`; el.style.top = `${25 + Math.random() * 45}vh`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
    const t = performance.now(); if (t - xpSndAt > 1500) { xpSndAt = t; deps.sound && deps.sound('xp'); }   // звукът — не по-често от 1,5 s
  }

  // значка в горната лента
  const css = document.createElement('style');
  css.textContent = `#devBtn { display:flex; align-items:center; gap:6px; } #devBtn .dbar { width:46px; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; } #devBtn .dbar i { display:block; height:100%; background:linear-gradient(90deg,#c9a14a,#ffd54a); }
  .dvrow { display:flex; gap:10px; align-items:center; padding:6px 8px; border-radius:9px; } .dvrow.on { background:rgba(255,213,74,.12); } .dvrow.cur { box-shadow:0 0 0 1px var(--acc) inset; } .dvrow b { min-width:64px; }
  .xpfloat { position:fixed; z-index:70; pointer-events:none; color:#ffd54a; font:800 22px/1 system-ui,sans-serif; text-shadow:0 2px 6px rgba(0,0,0,.75), 0 0 2px #000; transform:translate(-50%,0); animation:xpUp 1.7s ease-out forwards; }
  @keyframes xpUp { 0% { opacity:0; transform:translate(-50%,10px) scale(.8); } 15% { opacity:1; transform:translate(-50%,0) scale(1.08); } 100% { opacity:0; transform:translate(-50%,-60px) scale(1); } }`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.id = 'devBtn'; btn.className = 'btn2'; btn.title = 'Ниво на развитие';
  const top = document.getElementById('top'), q = document.getElementById('qBtn');
  top.insertBefore(btn, q || top.querySelector('.sp'));
  btn.onclick = open;
  // партньорът стигна — отложените нива се показват сега (картинка/известие за всяко)
  function catchUp() {
    const S = deps.S(); if (!S || S.coopWait == null) return; const b = best();
    for (let l = S.coopWait + 1; l <= b; l++) { S.coopWait = l; cityUp(l); }
    if (!waiting()) S.coopWait = null;
  }
  function render() {
    const d = st(); if (!d) { btn.style.display = 'none'; return; }
    btn.style.display = ''; catchUp();
    const bst = best();   // в лентата — само нивото на фирмата (= най-развитият град, от него идват отключванията); лентата — неговият напредък
    const bd = bst > d.lv ? (Object.values(deps.S().cities || {}).map(c => c.dev).find(x => x && x.lv === bst) || { lv: bst, xp: THRESH[bst - 1] }) : d;
    const top = bst >= THRESH.length, nx = top && bst < 35 && deps.impRatio ? deps.impRatio(bst + 1) : null;   // над 20 — напредъкът към следващото ниво по условията на града (imperial.js)
    const a = THRESH[bd.lv - 1], b = THRESH[bd.lv] ?? a, k = top ? (nx ?? 1) : FSUM ? (() => { const fa = FIRM_THRESH[bst - 1], fb = FIRM_THRESH[bst] ?? fa; return fb > fa ? Math.max(0, Math.min(1, (firmXp() - fa) / (fb - fa))) : 1; })() : Math.max(0, Math.min(1, (bd.xp - a) / (b - a)));   // firm-xp-sum: сборът
    const cityTag = CITY_BAR && (FSUM || bst > d.lv) ? `<span style="font-size:11px;opacity:.9" title="Опитът от строежите отива в града, в който си">🏙️ ${deps.cityName ? deps.cityName() : 'градът'} ${d.lv} · ${Math.round(cityK(d) * 100)}%</span>` : '';   // xp-city-bar
    if (FSUM) firmCheck();   // и опитът, дошъл направо в други градове
    btn.innerHTML = `🏢 Фирма ${bst}<span class="dbar"><i style="width:${(k * 100).toFixed(0)}%"></i></span>${cityTag}${waiting() ? `<span style="font-size:11px;opacity:.85">⏳ чакаш партньора (ниво ${bst})</span>` : partnerAhead() ? `<span style="font-size:11px;opacity:.85">${partnerAhead() > rawBest() + 2 ? '⏳ партньорът те чака' : '🤝 партньорът е напред'} (ниво ${partnerAhead()})</span>` : ''}`;
    btn.title = `Ниво на развитие на фирмата: ${bst} (по най-развития град — оттам идват отключванията)${bst > d.lv ? ` · ${deps.cityName ? deps.cityName() : 'този град'}: ниво ${d.lv}` : ''}${nx != null ? ` · към ниво ${bst + 1}: ${Math.round(nx * 100)}%${deps.impNeed ? ` — ${deps.impNeed(bst + 1)}` : ''}` : ''}`;
  }
  const firmXP = () => { const S = deps.S(), d = st(); return Math.max(d ? d.xp : 0, ...Object.values(S?.cities || {}).map(c => c.dev?.xp || 0)) + (S?.holding ? S.hxp || 0 : 0); };
  function prog(n) {
    const L = best(); if (n <= L) return { k: 1, t: '✅ изпълнено' };
    if (n > 20) { const k = deps.impRatio ? Math.max(0, Math.min(1, deps.impRatio(n) || 0)) : 0; return { k, t: `${Math.round(k * 100)}% от условията` }; }
    const T = FSUM ? FIRM_THRESH : THRESH, xp = FSUM ? firmXp() : firmXP(), a = T[n - 2] ?? 0, b = T[n - 1], k = Math.max(0, Math.min(1, (xp - a) / Math.max(1, b - a)));
    return { k, t: `${Math.round(k * 100)}% · остават ${Math.max(0, Math.round(b - xp)).toLocaleString('bg-BG')} XP` };
  }
  const barHtml = n => { if (n !== best() + 1) return '';   // само следващото ниво — жълтата лента, която расте (изпълнените — без лента)
    const p = prog(n); return `<div style="display:flex;align-items:center;gap:8px;margin:-2px 8px 6px 8px"><div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden"><i data-dvn="${n}" style="display:block;height:100%;width:${(p.k * 100).toFixed(1)}%;background:${p.k >= 1 ? '#43d17a' : 'linear-gradient(90deg,#c9a14a,#ffd54a)'}"></i></div><span class="meta" data-dvt="${n}" style="margin:0;font-size:11px;min-width:150px;text-align:right">${p.t}</span></div>`; };
  let dvTimer = null;
  function open() {
    const d = st(); if (!d) return;
    const L = best();   // по нивото на фирмата (както в лентата горе); заключените — замъглени, за да е изненада
    const rows = (FSUM ? FIRM_THRESH : THRESH).map((t, i) => `<div class="dvrow ${i + 1 <= L ? 'on' : ''} ${i + 1 === L ? 'cur' : ''}"><b>${i + 1 <= L ? '✅' : '🔒'} Ниво ${i + 1}</b><span class="meta" style="margin:0;flex:1;${i + 1 > L ? 'filter:blur(6px);user-select:none;pointer-events:none' : ''}" ${i + 1 > L ? 'aria-hidden="true"' : ''}>${UNLOCKS[i + 1] || 'Начало'}</span><span class="meta" style="margin:0">${i + 1 <= L ? '' : `${t} XP`}${deps.lvTime && deps.lvTime(i + 1) ? `${i + 1 <= L ? '' : '<br>'}<span style="color:#7dd3ff">⏱️ ${deps.lvTime(i + 1)}</span>` : ''}</span></div>${barHtml(i + 1)}`).join('')
      + `<div class="meta" style="margin:10px 0 4px;color:#ffd54a">🏙️ Нива 21–25 — Империал Сити, 26–35 — президентът (по постижения, не по опит)</div>` + [21, 22, 23, 24, 25, ...(L >= 25 ? [26, 27, 28, 29, 30, 31, 32, 33, 34, 35] : [])].map(n => `<div class="dvrow ${n <= L ? 'on' : ''} ${n === L ? 'cur' : ''}"><b>${n <= L ? '✅' : '🔒'} Ниво ${n}</b><span class="meta" style="margin:0;flex:1;${n > L ? 'filter:blur(6px);user-select:none;pointer-events:none' : ''}" ${n > L ? 'aria-hidden="true"' : ''}>${UNLOCKS[n]}</span></div>${barHtml(n)}`).join('')
      + (L >= 19 && L < 35 && deps.impNeed ? `<div class="meta" style="margin:6px 0 0;color:#7dd3ff">🎯 Към ниво ${Math.max(21, L + 1)}: ${deps.impNeed(Math.max(21, L + 1))}</div>` : '');
    const nxt = THRESH[d.lv];
    deps.modal(`🏢 Ниво на развитие на фирмата · ${L}`, `Всеки твой град се развива отделно. Отключванията (градове, линии, Балканите, Европа, борса) идват от най-развития ти град; специалистите — от нивото на текущия град.<br>${FSUM ? `<div style="margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(125,211,255,.1);color:#bfe6ff">🏢 Всеки XP от всеки твой град се добавя към фирмата (сега фирмата има ${Math.round(firmXp()).toLocaleString('bg-BG')} XP). 🏙️ ${deps.cityName ? deps.cityName() : 'Този град'} — ниво ${d.lv} (${Math.round(cityK(d) * 100)}% до ниво ${d.lv + 1}).</div>` : CITY_BAR && L > d.lv ? `<div style="margin:6px 0;padding:6px 8px;border-radius:8px;background:rgba(125,211,255,.1);color:#bfe6ff">🏙️ Опитът от строежите отива в <b>${deps.cityName ? deps.cityName() : 'този град'}</b> — той е на ниво ${d.lv} (${Math.round(cityK(d) * 100)}% до ниво ${d.lv + 1}). Лентата на фирмата (ниво ${L}) е на най-развития ти град и тръгва, щом някой град го задмине.</div>` : ''}Опит${CITY_BAR ? ' в този град' : ''}: <b>${Math.round(d.xp)} XP</b>${nxt != null ? ` · до ниво ${d.lv + 1}: ${Math.round(nxt - d.xp)} XP` : ' · максимално ниво'}<br>
      <span style="color:var(--mut)">XP: къща ${XP.house}, магазин ${XP.shop}, офис ${XP.office}, небостъргач ${XP.tower}, ${feature('xp-km') ? `магистрала ~${XP_KM.highway} на км (аутобан ×2), жп линия ~${XP_KM.rail} на км, филиал ${XP.branch}, куест ${XP.quest} · покупки: ТИР ${XP_BUY.truck}, влак ${XP_BUY.train}, кораб ${XP_BUY.ship}–${XP_BUY.shipBig}, самолет ${XP_BUY.plane} · общо имаш ${Math.round(firmXP()).toLocaleString('bg-BG')} XP` : `жп линия ${XP.rail}, участък магистрала ${XP.highway}, филиал ${XP.branch}, куест ${XP.quest}`}.</span><br><br>${deps.playSummary ? deps.playSummary() + '<br>' : ''}${rows}`, [['Затвори', null]]);
    // на живо: лентите се обновяват всяка секунда, докато прозорецът е отворен
    clearInterval(dvTimer); dvTimer = setInterval(() => { const els = document.querySelectorAll('[data-dvn]'); if (!els.length) { clearInterval(dvTimer); return; }
      for (const e of els) { const n = +e.dataset.dvn, p = prog(n); e.style.width = (p.k * 100).toFixed(1) + '%'; e.style.background = p.k >= 1 ? '#43d17a' : 'linear-gradient(90deg,#c9a14a,#ffd54a)'; const t = document.querySelector(`[data-dvt="${n}"]`); if (t && t.textContent !== p.t) t.textContent = p.t; } }, 1000);
  }
  return { firmXp, firmLv, cityUp, add, level, best, rawBest, waiting, has, offerMul, offersOpen, stocksOpen, render, open, XP };
}
