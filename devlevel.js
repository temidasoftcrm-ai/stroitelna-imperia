// devlevel.js — Фаза 7: ниво на развитие на фирмата (1–10).
// Опит (XP) от обекти, жп линии, магистрали, филиали и куести. Всяко ниво: +2% към цената на поръчките.
// Отключвания: ниво 5 (+ Балканите) — оферти от доставчици; ниво 8 — стокова борса.
// Записът е в S.dev = { xp, lv }. deps: S(), toast, sound, save, pop(key, cap, sub), balkansOpen()
import { feature } from './lab/feature.js';
import { showLevel, LV_PICS } from './lvshow.js';   // ново ниво — картинка на черен екран (feature 'lv-pics')
export const THRESH = [0, 1000, 4000, 10000, 20000, 40000, 70000, 110000, 170000, 250000, 350000, 480000, 640000, 840000, 1100000, 1400000, 1800000, 2300000, 2900000, 3600000];
export const XP = { house: 50, shop: 200, office: 600, tower: 2000, rail: 1000, highway: 1500, branch: 3000, quest: 100 };
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
export const unlockText = lv => UNLOCKS[lv] || '';
export const LV = { BG_ALL: 2, LINKS: 2, STAFF: 4, BALKANS: 5, FOREIGN: 6, OFFERS: 6, STOCKS: 7, EUROPE: 8, AIR: 9, WORLD: 10, MEGAHUB: 11, NA: 12, MEGA_EU: 13, SA: 14, SKY40: 15, AS: 16, FAST: 17, OC: 18, MEGA_WORLD: 19, EMPIRE: 20 };
export const OFFERS_LV = LV.OFFERS, STOCKS_LV = LV.STOCKS;
const lvOf = xp => { let l = 1; for (let i = 0; i < THRESH.length; i++) if (xp >= THRESH[i]) l = i + 1; return l; };

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
  const best = () => Math.max(level(), deps.maxLevel ? deps.maxLevel() : 1);
  const offersOpen = () => best() >= OFFERS_LV;
  const has = k => best() >= LV[k];
  const stocksOpen = () => best() >= STOCKS_LV;

  function add(n, why) {
    const d = st(); if (!d || !n) return;
    d.xp += n;
    const nl = lvOf(d.xp);
    while (d.lv < nl) {
      d.lv++;
      deps.toast(`🏅 Фирмата е ниво ${d.lv}! ${UNLOCKS[d.lv] || ''}`, 'good', open);
      if (feature('lv-pics') && LV_PICS.has(d.lv)) { showLevel(d.lv, UNLOCKS[d.lv] || ''); continue; }   // картинката на нивото (звукът е в lvshow.js)
      deps.sound('levelup');
      if (deps.pop && !deps.pop(`lv-${d.lv}`, `🏅 Ниво на развитие ${d.lv}`, UNLOCKS[d.lv] || '')) deps.pop('office-up', `🏅 Ниво на развитие ${d.lv}`, UNLOCKS[d.lv] || '');
    }
    render();
    deps.save();
  }

  // значка в горната лента
  const css = document.createElement('style');
  css.textContent = `#devBtn { display:flex; align-items:center; gap:6px; } #devBtn .dbar { width:46px; height:6px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; } #devBtn .dbar i { display:block; height:100%; background:linear-gradient(90deg,#c9a14a,#ffd54a); }
  .dvrow { display:flex; gap:10px; align-items:center; padding:6px 8px; border-radius:9px; } .dvrow.on { background:rgba(255,213,74,.12); } .dvrow.cur { box-shadow:0 0 0 1px var(--acc) inset; } .dvrow b { min-width:64px; }`;
  document.head.appendChild(css);
  const btn = document.createElement('button');
  btn.id = 'devBtn'; btn.className = 'btn2'; btn.title = 'Ниво на развитие';
  const top = document.getElementById('top'), q = document.getElementById('qBtn');
  top.insertBefore(btn, q || top.querySelector('.sp'));
  btn.onclick = open;
  function render() {
    const d = st(); if (!d) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const bst = best();   // в лентата — само нивото на фирмата (= най-развитият град, от него идват отключванията); лентата — неговият напредък
    const bd = bst > d.lv ? (Object.values(deps.S().cities || {}).map(c => c.dev).find(x => x && x.lv === bst) || { lv: bst, xp: THRESH[bst - 1] }) : d;
    const a = THRESH[bd.lv - 1], b = THRESH[bd.lv] ?? a, k = bd.lv >= THRESH.length ? 1 : Math.max(0, Math.min(1, (bd.xp - a) / (b - a)));
    btn.innerHTML = `🏢 Фирма ${bst}<span class="dbar"><i style="width:${(k * 100).toFixed(0)}%"></i></span>`;
    btn.title = `Ниво на развитие на фирмата: ${bst} (по най-развития град — оттам идват отключванията)${bst > d.lv ? ` · ${deps.cityName ? deps.cityName() : 'този град'}: ниво ${d.lv}` : ''}`;
  }
  function open() {
    const d = st(); if (!d) return;
    const rows = THRESH.map((t, i) => `<div class="dvrow ${i + 1 <= d.lv ? 'on' : ''} ${i + 1 === d.lv ? 'cur' : ''}"><b>${i + 1 <= d.lv ? '✅' : '🔒'} Ниво ${i + 1}</b><span class="meta" style="margin:0;flex:1">${UNLOCKS[i + 1] || 'Начало'}</span><span class="meta" style="margin:0">${t} XP${deps.lvTime && deps.lvTime(i + 1) ? `<br><span style="color:#7dd3ff">⏱️ ${deps.lvTime(i + 1)}</span>` : ''}</span></div>`).join('');
    const nxt = THRESH[d.lv];
    deps.modal(`🏅 Ниво на развитие · ${deps.cityName ? deps.cityName() : ''}`, `Всеки твой град се развива отделно. Отключванията (градове, линии, Балканите, Европа, борса) идват от най-развития ти град; специалистите — от нивото на текущия град.<br>Опит: <b>${Math.round(d.xp)} XP</b>${nxt != null ? ` · до ниво ${d.lv + 1}: ${Math.round(nxt - d.xp)} XP` : ' · максимално ниво'}<br>
      <span style="color:var(--mut)">XP: къща ${XP.house}, магазин ${XP.shop}, офис ${XP.office}, небостъргач ${XP.tower}, жп линия ${XP.rail}, участък магистрала ${XP.highway}, филиал ${XP.branch}, куест ${XP.quest}.</span><br><br>${deps.playSummary ? deps.playSummary() + '<br>' : ''}${rows}`, [['Затвори', null]]);
  }
  return { add, level, best, has, offerMul, offersOpen, stocksOpen, render, open, XP };
}
