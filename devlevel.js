// devlevel.js — Фаза 7: ниво на развитие на фирмата (1–10).
// Опит (XP) от обекти, жп линии, магистрали, филиали и куести. Всяко ниво: +2% към цената на поръчките.
// Отключвания: ниво 5 (+ Балканите) — оферти от доставчици; ниво 8 — стокова борса.
// Записът е в S.dev = { xp, lv }. deps: S(), toast, sound, save, pop(key, cap, sub), balkansOpen()
import { feature } from './lab/feature.js';
import { showLevel, LV_PICS } from './lvshow.js';
import { IMP_UNLOCKS } from './imperial.js';   // нивата 21–25 идват от Империал Сити (не от опит)   // ново ниво — картинка на черен екран (feature 'lv-pics')
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
Object.assign(UNLOCKS, IMP_UNLOCKS);
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
  const best = () => Math.max(level(), deps.maxLevel ? deps.maxLevel() : 1, deps.impLv ? deps.impLv() : 0);
  const offersOpen = () => best() >= OFFERS_LV;
  const has = k => best() >= LV[k];
  const stocksOpen = () => best() >= STOCKS_LV;

  // 🏙️ нивата 21–25: градът изпълни условията (imperial.js) — картинка или известие, както при 1–20
  function cityUp(lv, text) {
    deps.toast(`🏅 Фирмата е ниво ${lv}! ${text || UNLOCKS[lv] || ''}`, 'good', open);
    if (feature('lv-pics') && LV_PICS.has(lv)) showLevel(lv, text || UNLOCKS[lv] || '');
    else { deps.sound('levelup'); if (deps.pop && !deps.pop(`lv-${lv}`, `🏅 Ниво на развитие ${lv}`, text || UNLOCKS[lv] || '')) deps.pop('empire', `🏅 Ниво на развитие ${lv}`, text || UNLOCKS[lv] || ''); }
    render(); deps.save();
  }
  // докато е отворена 3D зала (window.__overlay3d — Директорската зала, кабинетът): опитът се трупа тихо — без „+XP“, без преначертаване и
  // без запис на всеки квартал/филиал (одобрение на 248 квартала = 248 записа на цялата игра → забиване); всичко се показва веднъж, щом излезеш
  let held = 0, heldT = 0;
  const inRoom = () => typeof window !== 'undefined' && (window.__overlay3d || 0) > 0;
  function flushHeld() {
    if (inRoom()) { heldT = setTimeout(flushHeld, 700); return; }
    heldT = 0; const n = held; held = 0; if (!n) return;
    const d = st(), lv0 = d.lv; d.xp -= n; add(n);   // сега — с надписа, нивата и записа
    if (d.lv === lv0) deps.toast && deps.toast(`⭐ +${Math.round(n).toLocaleString('bg-BG')} XP от решенията на борда`, 'good');
  }
  function add(n, why) {
    const d = st(); if (!d || !n) return;
    if (n > 0 && inRoom()) { d.xp += n; held += n; if (!heldT) heldT = setTimeout(flushHeld, 700); return; }
    const firm0 = best();   // нивото на фирмата (най-развитият град) преди опита — картинката е само когато то се вдигне, не при всеки град
    d.xp += n;
    if (n > 0) xpFloat(n);
    const nl = lvOf(d.xp);
    while (d.lv < nl) {
      d.lv++;
      if (d.lv <= firm0) { deps.toast(`🏙️ ${deps.cityName ? deps.cityName() : 'Градът'} стигна ниво ${d.lv}`, 'good'); continue; }   // градът догонва фирмата (друг град вече е бил на това ниво) — само съобщение, без картинка
      deps.toast(`🏅 Фирмата е ниво ${d.lv}! ${UNLOCKS[d.lv] || ''}`, 'good', open);
      if (feature('lv-pics') && LV_PICS.has(d.lv)) { showLevel(d.lv, UNLOCKS[d.lv] || ''); continue; }   // градът е задминал фирмата → нова фирмена степен
      deps.sound('levelup');
      if (deps.pop && !deps.pop(`lv-${d.lv}`, `🏅 Ниво на развитие ${d.lv}`, UNLOCKS[d.lv] || '')) deps.pop('office-up', `🏅 Ниво на развитие ${d.lv}`, UNLOCKS[d.lv] || '');
    }
    render();
    deps.save();
  }

  // „+120 XP“ — жълт надпис на случайно място по екрана, който се издига и изчезва (при 🔕 известия — не излиза)
  function xpFloat(n) {
    if (typeof document === 'undefined' || document.body.classList.contains('ntf-off')) return;
    const el = document.createElement('div');
    el.className = 'xpfloat';
    el.textContent = `+${Math.round(n).toLocaleString('bg-BG')} XP`;
    el.style.left = `${15 + Math.random() * 70}vw`; el.style.top = `${25 + Math.random() * 45}vh`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
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
  function render() {
    const d = st(); if (!d) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const bst = best();   // в лентата — само нивото на фирмата (= най-развитият град, от него идват отключванията); лентата — неговият напредък
    const bd = bst > d.lv ? (Object.values(deps.S().cities || {}).map(c => c.dev).find(x => x && x.lv === bst) || { lv: bst, xp: THRESH[bst - 1] }) : d;
    const top = bst >= THRESH.length, nx = top && bst < 35 && deps.impRatio ? deps.impRatio(bst + 1) : null;   // над 20 — напредъкът към следващото ниво по условията на града (imperial.js)
    const a = THRESH[bd.lv - 1], b = THRESH[bd.lv] ?? a, k = top ? (nx ?? 1) : Math.max(0, Math.min(1, (bd.xp - a) / (b - a)));
    btn.innerHTML = `🏢 Фирма ${bst}<span class="dbar"><i style="width:${(k * 100).toFixed(0)}%"></i></span>`;
    btn.title = `Ниво на развитие на фирмата: ${bst} (по най-развития град — оттам идват отключванията)${bst > d.lv ? ` · ${deps.cityName ? deps.cityName() : 'този град'}: ниво ${d.lv}` : ''}${nx != null ? ` · към ниво ${bst + 1}: ${Math.round(nx * 100)}%${deps.impNeed ? ` — ${deps.impNeed(bst + 1)}` : ''}` : ''}`;
  }
  const firmXP = () => { const S = deps.S(), d = st(); return Math.max(d ? d.xp : 0, ...Object.values(S?.cities || {}).map(c => c.dev?.xp || 0)) + (S?.holding ? S.hxp || 0 : 0); };
  function prog(n) {
    const L = best(); if (n <= L) return { k: 1, t: '✅ изпълнено' };
    if (n > 20) { const k = deps.impRatio ? Math.max(0, Math.min(1, deps.impRatio(n) || 0)) : 0; return { k, t: `${Math.round(k * 100)}% от условията` }; }
    const xp = firmXP(), a = THRESH[n - 2] ?? 0, b = THRESH[n - 1], k = Math.max(0, Math.min(1, (xp - a) / Math.max(1, b - a)));
    return { k, t: `${Math.round(k * 100)}% · остават ${Math.max(0, Math.round(b - xp)).toLocaleString('bg-BG')} XP` };
  }
  const barHtml = n => { const p = prog(n); return `<div style="display:flex;align-items:center;gap:8px;margin:-2px 8px 6px 8px"><div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden"><i data-dvn="${n}" style="display:block;height:100%;width:${(p.k * 100).toFixed(1)}%;background:${p.k >= 1 ? '#43d17a' : 'linear-gradient(90deg,#c9a14a,#ffd54a)'}"></i></div><span class="meta" data-dvt="${n}" style="margin:0;font-size:11px;min-width:150px;text-align:right">${p.t}</span></div>`; };
  let dvTimer = null;
  function open() {
    const d = st(); if (!d) return;
    const L = best();   // по нивото на фирмата (както в лентата горе); заключените — замъглени, за да е изненада
    const rows = THRESH.map((t, i) => `<div class="dvrow ${i + 1 <= L ? 'on' : ''} ${i + 1 === L ? 'cur' : ''}"><b>${i + 1 <= L ? '✅' : '🔒'} Ниво ${i + 1}</b><span class="meta" style="margin:0;flex:1;${i + 1 > L ? 'filter:blur(6px);user-select:none;pointer-events:none' : ''}" ${i + 1 > L ? 'aria-hidden="true"' : ''}>${UNLOCKS[i + 1] || 'Начало'}</span><span class="meta" style="margin:0">${i + 1 <= L ? '' : `${t} XP`}${deps.lvTime && deps.lvTime(i + 1) ? `${i + 1 <= L ? '' : '<br>'}<span style="color:#7dd3ff">⏱️ ${deps.lvTime(i + 1)}</span>` : ''}</span></div>${barHtml(i + 1)}`).join('')
      + `<div class="meta" style="margin:10px 0 4px;color:#ffd54a">🏙️ Нива 21–25 — Империал Сити, 26–35 — президентът (по постижения, не по опит)</div>` + [21, 22, 23, 24, 25, ...(L >= 25 ? [26, 27, 28, 29, 30, 31, 32, 33, 34, 35] : [])].map(n => `<div class="dvrow ${n <= L ? 'on' : ''} ${n === L ? 'cur' : ''}"><b>${n <= L ? '✅' : '🔒'} Ниво ${n}</b><span class="meta" style="margin:0;flex:1;${n > L ? 'filter:blur(6px);user-select:none;pointer-events:none' : ''}" ${n > L ? 'aria-hidden="true"' : ''}>${UNLOCKS[n]}</span></div>${barHtml(n)}`).join('')
      + (L >= 19 && L < 35 && deps.impNeed ? `<div class="meta" style="margin:6px 0 0;color:#7dd3ff">🎯 Към ниво ${Math.max(21, L + 1)}: ${deps.impNeed(Math.max(21, L + 1))}</div>` : '');
    const nxt = THRESH[d.lv];
    deps.modal(`🏢 Ниво на развитие на фирмата · ${L}`, `Всеки твой град се развива отделно. Отключванията (градове, линии, Балканите, Европа, борса) идват от най-развития ти град; специалистите — от нивото на текущия град.<br>Опит: <b>${Math.round(d.xp)} XP</b>${nxt != null ? ` · до ниво ${d.lv + 1}: ${Math.round(nxt - d.xp)} XP` : ' · максимално ниво'}<br>
      <span style="color:var(--mut)">XP: къща ${XP.house}, магазин ${XP.shop}, офис ${XP.office}, небостъргач ${XP.tower}, жп линия ${XP.rail}, участък магистрала ${XP.highway}, филиал ${XP.branch}, куест ${XP.quest}.</span><br><br>${deps.playSummary ? deps.playSummary() + '<br>' : ''}${rows}`, [['Затвори', null]]);
    // на живо: лентите се обновяват всяка секунда, докато прозорецът е отворен
    clearInterval(dvTimer); dvTimer = setInterval(() => { const els = document.querySelectorAll('[data-dvn]'); if (!els.length) { clearInterval(dvTimer); return; }
      for (const e of els) { const n = +e.dataset.dvn, p = prog(n); e.style.width = (p.k * 100).toFixed(1) + '%'; e.style.background = p.k >= 1 ? '#43d17a' : 'linear-gradient(90deg,#c9a14a,#ffd54a)'; const t = document.querySelector(`[data-dvt="${n}"]`); if (t && t.textContent !== p.t) t.textContent = p.t; } }, 1000);
  }
  return { cityUp, add, level, best, has, offerMul, offersOpen, stocksOpen, render, open, XP };
}
