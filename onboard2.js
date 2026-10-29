// onboard2.js — 🧭 onboard2 („Първите 10 минути“): постепенно отключване на бутоните и табовете, един урок по истинските действия
// (с подсветка на нужния бутон и „Пропусни“) и „❓“ помощ в главните прозорци. Само за нова игра: стар запис (не е от днес/вече има
// обекти или ниво) се маркира legacy — нищо не се крие и урокът не тръгва. Записът: S.ob2 = { fresh, legacy, u: {отключени}, step, off }.
// deps: { S(), lv(), projects(), units(), onMap(), toast(msg, kind), save(), openTab(t), autotest } — в тестовете (autotest) записът е legacy, освен след reset()
import { EN } from './i18n.js';

const T = (bg, en) => EN ? en : bg;
// какво се показва и кога (c — условие върху състоянието; n — името в „🆕 Отключи се: …“)
const RULES = [
  { k: 'fleet', sel: '#tabs [data-t="fleet"]', n: ['Техника', 'Fleet'], c: s => s.proj > 0 || s.done > 0 },
  { k: 'store', sel: '#tabs [data-t="store"]', n: ['Склад', 'Stock'], c: s => s.stage1 || s.done > 0 },
  { k: 'hq', sel: '#tabs [data-t="hq"]', n: ['Офис', 'Office'], c: s => s.done > 0 || s.lv >= 2 },
  { k: 'estate', sel: '#tabs [data-t="estate"]', n: ['Имоти', 'Property'], c: s => s.done >= 2 || s.lv >= 2 },
  { k: 'tasks', sel: '#btnTasks', n: ['Задачи', 'Tasks'], c: s => s.done > 0 || s.lv >= 2 },
  { k: 'map', sel: '#btnMapToggle', n: ['Карта', 'Map'], c: s => s.done > 0 || s.lv >= 2 },
  { k: 'hub', sel: '#btnHub', n: ['Империя', 'Empire'], c: s => s.lv >= 2 || s.done >= 3 },
  { k: 'built', sel: '#btnBuilt', n: ['Завърши града', 'Complete the city'], c: s => s.lv >= 2 },
  { k: 'ad', sel: '#adReward', n: ['Реклама за бонус', 'Ad for a bonus'], c: s => s.lv >= 2 },
  { k: 'globe', sel: '#btnGlobe', n: ['Глобус', 'Globe'], c: s => s.lv >= 5 },
  { k: 'quests', sel: '#qBtn', n: ['Куести', 'Quests'], c: s => s.lv >= 2 },
  { k: 'bank', sel: '#bankBtn', n: ['Банка', 'Bank'], c: s => s.lv >= 2 || s.money < 0 },
  { k: 'album', sel: '#btnCine', n: ['Албум', 'Album'], c: s => s.lv >= 3 },
  { k: 'coop', sel: '#coopBtn', n: ['Партньор', 'Partner'], c: s => s.lv >= 3 },
  { k: 'online', sel: '#onlineBtn', n: ['Онлайн', 'Online'], c: s => s.lv >= 3 },
  // не са бутони: блоковете в таб „Офис“ (game.js пита ok('links') / ok('station')) и предложението за транспортни връзки при влизане
  { k: 'links', n: ['Транспортни връзки', 'Transport links'], c: s => s.lv >= 3 },
  { k: 'station', n: ['Гара', 'Station'], c: s => s.lv >= 2 },
];
// урокът: стъпка → таб/бутон за подсветка, условие за отметка
const STEPS = [
  { ico: '📋', t: ['Първата поръчка', 'Your first order'], d: ['Отвори <b>„Поръчки“</b> вдясно и натисни <b>„Предложи“</b> на една къща. Клиентът приема или отказва — опитай пак, ако откаже.', 'Open <b>“Orders”</b> on the right and press <b>“Propose”</b> on a house. The client accepts or declines — try again if they decline.'], el: '#tabs [data-t="offers"]', done: s => s.proj > 0 || s.done > 0 },
  { ico: '🚜', t: ['Обектът тръгва', 'The site starts'], d: ['Бригадата, багерът и самосвалът отиват сами. Следи етапите в <b>„Обекти“</b>; с <b>▶▶</b> горе времето върви по-бързо.', 'Your crew, excavator and dump truck drive there by themselves. Follow the stages in <b>“Sites”</b>; <b>▶▶</b> at the top speeds time up.'], el: '#tabs [data-t="projects"]', done: s => s.stage1 || s.done > 0 },
  { ico: '💶', t: ['Прибери парите', 'Collect the money'], d: ['Когато къщата е готова, на покрива ѝ се появяват <b>пачки пари</b> — натисни ги.', 'When the house is finished, <b>stacks of cash</b> appear on its roof — tap them.'], el: '#tabs [data-t="projects"]', done: s => s.done > 0 && !s.cash },
  { ico: '🛒', t: ['Още техника', 'More equipment'], d: ['В <b>„Техника“</b> купи още един багер или бус — така поемаш по два обекта наведнъж.', 'In <b>“Fleet”</b> buy another excavator or van — then you can run two sites at once.'], el: '#tabs [data-t="fleet"]', done: s => s.units > 3 },
  { ico: '🏢', t: ['Расти', 'Grow'], d: ['Довърши <b>3 къщи</b> или вдигни офиса в <b>„Офис“</b> — повече бригади и по-големи поръчки.', 'Finish <b>3 houses</b> or upgrade your office in <b>“Office”</b> — more crews and bigger orders.'], el: '#tabs [data-t="hq"]', done: s => s.done >= 3 || s.office > 1 },
  { ico: '🗺️', t: ['Картата', 'The map'], d: ['Натисни <b>🗺️ Карта</b> горе: там са магистралите, жп линиите и другите градове. Първата магистрала е голяма стъпка!', 'Press <b>🗺️ Map</b> at the top: motorways, railways and other cities live there. Your first motorway is a big step!'], el: '#btnMapToggle', done: s => s.onMap || s.hw > 0 },
];
// „❓“ — по таб / прозорец
const HELP = {
  offers: ['Поръчките идват всеки ден. „Предложи“ — изпращаш оферта; с бутоните −15%…+20% сваляш или вдигаш цената (по-евтино — по-голям шанс). Аванс 30% при приемане, останалото — при предаване.', 'New orders arrive every day. “Propose” sends your bid; the −15%…+20% buttons lower or raise the price (cheaper — better chance). 30% advance on acceptance, the rest on completion.'],
  projects: ['Тук са обектите ти: етап, прогрес и срок. Техниката отива сама; ако нещо липсва (материали, машина), ще го видиш тук.', 'Your sites: stage, progress and deadline. Equipment drives there by itself; if something is missing (materials, a machine), it shows up here.'],
  fleet: ['Машините и бусовете на фирмата. Повече техника — повече обекти наведнъж. Гаражът (в „Империя“) определя колко се побират.', 'Your company’s machines and vans. More equipment — more sites at once. The garage (in “Empire”) sets how many fit.'],
  store: ['Материалите за обектите. Купуват се сами, когато има пари; можеш да купиш и предварително, по-евтино на едро.', 'Materials for your sites. They are bought automatically when you have money; you can also stock up in advance, cheaper in bulk.'],
  estate: ['Имоти: купуваш къщи и празни парцели, строиш и продаваш или даваш под наем.', 'Property: buy houses and vacant plots, build, then sell or rent out.'],
  hq: ['Офисът определя колко бригади и обекти наведнъж имаш. Надграждай го с нивото на фирмата; от ниво 7 избираш облика на кулата.', 'The office sets how many crews and sites you can run at once. Upgrade it as your company grows; from level 7 you choose your tower’s look.'],
  map: ['Картата: градовете, магистралите, жп линиите и морските пътища. Тук отваряш филиали и строиш връзките между градовете.', 'The map: cities, motorways, railways and sea routes. Open branches and build links between cities here.'],
  hub: ['„Империя“ събира всичко отвъд първия град: гараж, транспорт, курорти, банка, куести… Новите неща се появяват тук с нивото.', '“Empire” gathers everything beyond your first city: garage, transport, resorts, bank, quests… New things appear here as you level up.'],
};
const css = `
body.ob2 .ob2-hide { display:none !important; }
body.ob2 #hub .grid > .lockT { display:none !important; }
@keyframes ob2Pulse { 0%, 100% { box-shadow:0 0 0 0 rgba(255,213,74,0); } 50% { box-shadow:0 0 0 3px #ffd54a, 0 0 18px rgba(255,213,74,.8); } }
.ob2-new { animation:ob2Pulse 1.1s ease-in-out 4; }
#ob2Box { position:fixed; left:14px; bottom:16px; z-index:30; width:min(360px,calc(100vw - 28px)); background:linear-gradient(180deg,#1f2a3c,#141b27); border:2px solid var(--acc,#ffb300); border-radius:14px; padding:12px 14px; box-shadow:0 10px 30px rgba(0,0,0,.5); font:14px/1.5 system-ui,sans-serif; color:var(--txt,#e8eef6); }
#ob2Box .th { display:flex; gap:10px; align-items:center; font-weight:900; font-size:16px; color:var(--acc,#ffb300); } #ob2Box .th span { font-size:24px; }
#ob2Box .tr { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--mut,#94a3b8); margin-top:8px; }
#ob2Ring { position:fixed; z-index:29; pointer-events:none; border:3px solid #ffd54a; border-radius:12px; box-shadow:0 0 0 4px rgba(255,213,74,.25), 0 0 22px rgba(255,213,74,.7); animation:ob2Pulse 1.3s ease-in-out infinite; }
#ob2Ring::after { content:'⬇'; position:absolute; left:50%; top:-34px; transform:translateX(-50%); font-size:26px; color:#ffd54a; text-shadow:0 2px 6px #000; }
.ob2Help { float:right; margin:0 0 6px 8px; width:28px; height:28px; border-radius:50%; border:1px solid var(--line,#334); background:#1b2433; color:#ffd54a; font-weight:900; cursor:pointer; }
.ob2HelpTx { clear:both; margin:0 0 10px; padding:9px 11px; border-radius:10px; background:#152033; border:1px solid #2c3e5c; font-size:13px; line-height:1.45; color:#cfe0f5; }
`;

export function createOnboard2(deps) {
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  let box = null, ring = null, shownStep = -1;
  const O = () => { const S = deps.S(); if (!S) return null;
    if (!S.ob2) { const fresh = !deps.autotest && (S.day || 1) <= 1 && !(S.done > 0) && !deps.projects().length && (deps.lv() || 1) <= 1; S.ob2 = { fresh, legacy: !fresh, u: {}, step: 0, off: !fresh }; }
    return S.ob2; };
  const snap = () => { const S = deps.S(), P = deps.projects();
    return { lv: deps.lv() || 1, done: S.done || 0, proj: P.length, stage1: P.some(p => (p.stage || 0) >= 1), cash: (S.cash || []).length, units: deps.units().length, office: S.officeLevel || 1, money: S.money ?? 0, onMap: deps.onMap(), hw: (S.hwDone || []).length }; };
  const ok = k => { const o = O(); if (!o || o.legacy) return true; return !!o.u[k]; };
  function applyUnlocks(s) {
    const o = O(); document.body.classList.toggle('ob2', !o.legacy);
    for (const r of RULES) {
      const on = o.legacy || o.u[r.k] || r.c(s);
      if (on && !o.u[r.k]) { o.u[r.k] = 1; if (!o.legacy && o.started) { const el = r.sel && document.querySelector(r.sel); if (el) { el.classList.remove('ob2-hide'); el.classList.add('ob2-new'); setTimeout(() => el.classList.remove('ob2-new'), 5200); } deps.toast(T('🆕 Отключи се: ', '🆕 Unlocked: ') + T(...r.n), 'good'); } deps.save(); }
      if (r.sel) document.querySelectorAll(r.sel).forEach(el => el.classList.toggle('ob2-hide', !on));
    }
    o.started = 1;   // първото преминаване не показва „Отключи се“ за нещата, видими от началото
  }
  function place(el) { if (!ring) { ring = document.createElement('div'); ring.id = 'ob2Ring'; document.body.appendChild(ring); }
    const t = el && document.querySelector(el); const r = t && t.offsetParent !== null ? t.getBoundingClientRect() : null;
    if (!r || !r.width) { ring.style.display = 'none'; return; }
    Object.assign(ring.style, { display: 'block', left: r.left - 5 + 'px', top: r.top - 5 + 'px', width: r.width + 10 + 'px', height: r.height + 10 + 'px' }); }
  function tutorial(s) {
    const o = O(); if (!box) { box = document.createElement('div'); box.id = 'ob2Box'; box.style.display = 'none'; document.body.appendChild(box); }
    if (o.off || o.legacy || o.step >= STEPS.length) { box.style.display = 'none'; if (ring) ring.style.display = 'none'; return; }
    let moved = false; while (o.step < STEPS.length && STEPS[o.step].done(s)) { o.step++; moved = true; } if (moved) deps.save();
    if (o.step >= STEPS.length) { box.style.display = 'none'; if (ring) ring.style.display = 'none'; deps.toast(T('🎓 Готово! Сега си сам — успех!', '🎓 All done! You’re on your own now — good luck!'), 'good'); return; }
    const S = STEPS[o.step], hideOnMap = s.onMap && S.el !== '#btnMapToggle';
    if (shownStep !== o.step) { shownStep = o.step;
      box.innerHTML = `<div class="th"><span>${S.ico}</span>${T(...S.t)}</div><div>${T(...S.d)}</div><div class="tr"><span>${T('Урок', 'Lesson')} ${o.step + 1} / ${STEPS.length}</span><button class="btn2" id="ob2Skip">${T('Пропусни', 'Skip')}</button></div>`;
      box.querySelector('#ob2Skip').onclick = () => { o.off = true; deps.save(); tutorial(s); }; }
    box.style.display = hideOnMap ? 'none' : 'block'; place(hideOnMap ? null : S.el);
  }
  function help() {
    const pb = document.getElementById('panelBody'), tab = document.querySelector('#tabs button.on')?.dataset.t;
    if (pb && tab && HELP[tab] && !pb.querySelector(':scope > .ob2Help')) { const b = document.createElement('button'); b.className = 'ob2Help'; b.textContent = '❓'; b.title = T('Какво е това?', 'What is this?');
      b.onclick = () => { const x = pb.querySelector(':scope > .ob2HelpTx'); if (x) { x.remove(); return; } const d = document.createElement('div'); d.className = 'ob2HelpTx'; d.textContent = T(...HELP[tab]); b.after(d); }; pb.prepend(b); }
    for (const [id, key, anchor] of [['mapHud', 'map', 'h2'], ['hub', 'hub', 'h4']]) { const host = document.getElementById(id), h = host && host.querySelector(anchor);
      if (!h || h.querySelector('.ob2Help')) continue; const b = document.createElement('button'); b.className = 'ob2Help'; b.style.cssText = 'float:none;margin-left:8px;width:24px;height:24px;font-size:12px'; b.textContent = '❓';
      b.onclick = e => { e.stopPropagation(); const x = host.querySelector('.ob2HelpTx'); if (x) { x.remove(); return; } const d = document.createElement('div'); d.className = 'ob2HelpTx'; d.textContent = T(...HELP[key]); h.after(d); }; h.appendChild(b); }
  }
  // вика се ~веднъж в секунда (game.js — вместо tutorial.tick)
  function tick() { const o = O(); if (!o) return; const s = snap(); applyUnlocks(s); tutorial(s); help(); }
  return { tick, ok, fresh: () => { const o = O(); return !!(o && o.fresh && !o.legacy); }, legacy: () => { const o = O(); return !o || o.legacy; },
    reset: () => { const S = deps.S(); if (!S) return; S.ob2 = { fresh: true, legacy: false, u: {}, step: 0, off: false }; shownStep = -1; tick(); },   // Лабораторията: като нова игра
    state: () => O() };
}
