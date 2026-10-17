// tour.js — „❓ Какво е това?“: обиколка на екрана за новия играч. Подсветява бутоните един по един и казва за какво са.
// Тръгва сама веднъж — в началото на нова игра (ден ≤ 3), когато няма видео и прозорец. Бутонът ❓ горе я пуска отново.
// Бутоните, които още не са отключени (не се виждат), се прескачат. Играта е на пауза, докато трае обиколката.
// Само DOM — game.js не знае за нея. Помни се в браузъра (localStorage 'stroiTour').
const LS = 'stroiTour';
const tabBtn = re => () => [...document.querySelectorAll('#tabs button')].find(b => re.test(b.innerText));
const STEPS = [
  { t: '👋 Добре дошъл!', d: 'Бърза обиколка — около минута. Ще ти покажа <b>кое за какво е</b>. Можеш да я спреш по всяко време и да я пуснеш пак от бутона <b>❓</b> горе.' },
  { el: '#money', t: '💶 Парите на фирмата', d: 'Оттук плащаш техника, материали и заплати. Ако останеш на минус дълго — <b>фалит</b>, така че следи сметката.' },
  { el: '#day', t: '📅 Ден и час', d: 'Играта върви в дни. В края на всеки ден се плащат заплатите и поддръжката, а обектите имат срок в дни.' },
  { el: '#speed', t: '⏩ Скорост', d: '<b>⏸</b> пауза · <b>▶</b> нормално · <b>▶▶ ▶▶▶</b> по-бързо. Сега играта е на пауза, докато трае обиколката.' },
  { el: '#rep', t: '⭐ Репутация', d: 'Звездите растат, когато предаваш обектите навреме. Повече звезди — <b>по-големи поръчки</b> и по-голям кредит в банката.' },
  { el: '#devBtn', t: '🏅 Ниво на развитие', d: 'С всеки обект трупаш опит. Новите нива <b>отключват</b> филиали в други градове, жп линии, магистрали, летища и още.' },
  { el: '#qBtn', t: '🎯 Куести', d: 'Задачи с награди — добър ориентир какво да направиш след това.' },
  { el: '#bankBtn', t: '🏦 Банка', d: 'Кредит, когато ти трябват пари; депозит с лихва, когато имаш излишни; акции на борсата.' },
  { el: tabBtn(/^Поръчки/), t: '📋 Поръчки', d: 'Тук <b>започва всичко</b>: клиентите предлагат обекти с цена и срок. Приеми поръчка и техниката тръгва сама.' },
  { el: tabBtn(/^Обекти/), t: '🏗️ Обекти', d: 'Обектите, които строиш в момента: етапи, срок и какво им липсва.' },
  { el: tabBtn(/^Техника/), t: '🚜 Техника', d: 'Купуваш бригади, багери, самосвали, кранове — и ТИР-ове за магистралите. Повече техника = повече обекти наведнъж.' },
  { el: tabBtn(/^Склад/), t: '📦 Склад', d: 'Материалите за строежа (тухли, бетон, арматура…). Купуват се сами, но тук можеш да зареждаш склада по-евтино.' },
  { el: tabBtn(/^Имоти/), t: '🔑 Имоти', d: 'Купуваш парцели, строиш за себе си и <b>даваш под наем</b> — пари всеки ден, без поръчки.' },
  { el: tabBtn(/^Офис/), t: '🏢 Офис', d: 'Надграждаш офиса, гаража и склада. По-голям офис = повече обекти наведнъж и повече бригади.' },
  { el: '#btnMapToggle', t: '🗺️ Карта', d: 'Картата на България и света: <b>филиали</b> в нови градове, <b>жп линии</b>, <b>магистрали</b>, летища и пристанища.' },
  { el: '#trBtn', t: '🚦 Транспорт', d: 'Всичките ти жп линии, магистрали, пристанища и летища на едно място.' },
  { el: '#btnCities', t: '🏙️ Градове', d: 'Всички твои градове: нива, поръчки, автопилот и имоти — без да влизаш във всеки.' },
  { el: '#btnOffers', t: '📜 Оферти', d: 'Оферти от доставчици и държавни търгове.' },
  { el: '#resBtn', t: '🏔️ Курорти', d: 'Инвестираш в ски, морски и балнео курорти — носят наем всеки сезон.' },
  { el: '#coopBtn', t: '🤝 Партньор', d: 'Свързваш се с приятел: пращате си пари и техника, строите заедно и имате общ холдинг.' },
  { el: '#onlineBtn', t: '🌐 Онлайн', d: 'Онлайн режимът — играеш в общ свят с други играчи.' },
  { el: '#btnCine', t: '🎬 Албум', d: 'Видеата, които си отключил — нов град, изпълнена суперпоръчка, първи самолет… Тук ги гледаш пак.' },
  { el: '#btnSound', t: '🔊 Звук', d: 'Пуска и спира звука.' },
  { el: '#btnNotif', t: '🔔 Известия', d: 'Кои съобщения да излизат: всички · само важните (червените) · никакви.' },
  { t: '🏁 Готово!', d: 'Започни от таб <b>„Поръчки“</b> — приеми първия обект. Когато е готов, на покрива се появяват <b>пачки пари</b> — натисни ги, за да ги прибереш.<br><br>Обиколката е винаги в бутона <b>❓</b> горе.' },
];
const CSS = `
  #tourBlock { position:fixed; inset:0; z-index:80; background:transparent; }
  #tourHole { position:fixed; z-index:81; border-radius:10px; box-shadow:0 0 0 9999px rgba(5,10,20,.66); border:2px solid var(--acc); pointer-events:none;
    animation:tourPulse 1.6s infinite; }
  #tourHole.none { left:50% !important; top:40% !important; width:0 !important; height:0 !important; border:0; animation:none; }
  @keyframes tourPulse { 50% { border-color:#fff; } }
  #tourCard { position:fixed; z-index:82; width:min(340px, calc(100vw - 32px)); background:linear-gradient(180deg,#1f2a3c,#141b27); color:var(--txt);
    border:2px solid var(--acc); border-radius:14px; padding:12px 14px; box-shadow:0 12px 34px rgba(0,0,0,.55); font-size:14px; line-height:1.5; }
  #tourCard .tt { font-weight:900; font-size:16px; color:var(--acc); margin-bottom:4px; }
  #tourCard .tf { display:flex; align-items:center; gap:6px; margin-top:10px; }
  #tourCard .tf .n { flex:1; font-size:12px; color:var(--mut); }
  body.touring #tutBox { display:none !important; }
  #top > #btnTour { order:0; }
`;
let i = 0, list = [], wasSpeed = null, onKey = null;
const vis = e => e && e.offsetParent !== null && e.getClientRects().length;
const elOf0 = s => !s.el ? null : typeof s.el === 'function' ? s.el() : document.querySelector(s.el);
// бутоните в затворения панел „📊 Империя ▾“ (hub.js) — стъпката сочи самия бутон „Империя“
const elOf = s => { const e = elOf0(s), hub = document.getElementById('hub'); return e && hub && hub.contains(e) && !hub.classList.contains('on') ? document.getElementById('btnHub') : e; };

function speedBtns() { return [...document.querySelectorAll('#speed button')]; }
function pause() { const b = speedBtns(); wasSpeed = b.findIndex(x => x.classList.contains('on')); if (b[0] && wasSpeed > 0) b[0].click(); }
function resume() { const b = speedBtns(); if (wasSpeed > 0 && b[wasSpeed]) b[wasSpeed].click(); wasSpeed = null; }

function close() {
  for (const id of ['tourBlock', 'tourHole', 'tourCard']) document.getElementById(id)?.remove();
  document.body.classList.remove('touring');
  if (onKey) removeEventListener('keydown', onKey, true); onKey = null;
  try { localStorage.setItem(LS, 'done'); } catch (e) {}
  resume();
}
function show() {
  const s = list[i], hole = document.getElementById('tourHole'), card = document.getElementById('tourCard'); if (!s || !hole) return;
  const e = elOf(s);
  card.innerHTML = `<div class="tt">${s.t}</div><div>${s.d}</div><div class="tf"><span class="n">${i + 1} / ${list.length}</span>
    ${i ? '<button class="btn2" data-t="back">← Назад</button>' : '<button class="btn2" data-t="close">Не сега</button>'}
    <button class="btn" data-t="next">${i === list.length - 1 ? 'Готово ✓' : 'Напред →'}</button></div>`;
  const place = () => {
    const W = innerWidth, H = innerHeight, cw = card.offsetWidth, ch = card.offsetHeight;
    if (!e || !vis(e)) { hole.classList.add('none'); card.style.left = (W - cw) / 2 + 'px'; card.style.top = Math.max(16, (H - ch) / 2) + 'px'; return; }
    const r = e.getBoundingClientRect(), p = 5;
    hole.classList.remove('none');
    Object.assign(hole.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
    let top = r.bottom + 14; if (top + ch > H - 8) top = r.top - ch - 14; if (top < 8) top = Math.min(H - ch - 8, r.bottom + 14);
    card.style.top = Math.max(8, top) + 'px';
    card.style.left = Math.max(16, Math.min(W - cw - 16, r.left + r.width / 2 - cw / 2)) + 'px';
  };
  if (e && vis(e)) { try { e.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (x) {} }
  place(); setTimeout(place, 260);
}
function go(d) { i += d; if (i >= list.length) return close(); if (i < 0) i = 0; show(); }

export function startTour() {
  if (document.getElementById('tourCard')) return;
  list = STEPS.filter(s => !s.el || vis(elOf(s))); i = 0;
  if (!list.length) return;
  const st = document.getElementById('tourCss') || Object.assign(document.createElement('style'), { id: 'tourCss', textContent: CSS });
  document.head.appendChild(st);
  document.body.classList.add('touring');
  const block = document.createElement('div'); block.id = 'tourBlock';
  const hole = document.createElement('div'); hole.id = 'tourHole';
  const card = document.createElement('div'); card.id = 'tourCard';
  card.addEventListener('click', ev => { const t = ev.target.closest('[data-t]')?.dataset.t; if (t === 'next') go(1); else if (t === 'back') go(-1); else if (t === 'close') close(); });
  block.addEventListener('click', () => go(1));
  document.body.append(block, hole, card);
  onKey = ev => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); go(1); } else if (ev.key === 'ArrowLeft') go(-1); };
  addEventListener('keydown', onKey, true);
  addEventListener('resize', () => { if (document.getElementById('tourCard')) show(); });
  pause(); show();
}

function mount() {
  const top = document.getElementById('top'); if (!top || document.getElementById('btnTour')) return !!top;
  const b = document.createElement('button'); b.id = 'btnTour'; b.className = 'btn2'; b.textContent = '❓'; b.title = 'Какво е това? — обиколка на бутоните';
  b.style.touchAction = 'manipulation'; b.onclick = startTour;
  const after = document.getElementById('btnNotif') || document.getElementById('btnSound');
  if (after && after.parentNode) after.parentNode.insertBefore(b, after.nextSibling); else top.appendChild(b);
  return true;
}
// сама веднъж: нова игра (ден ≤ 3), градът е зареден, няма видео/прозорец/начален екран — и така 2 секунди подред
let calm = 0;
const iv = setInterval(() => {
  mount();
  let seen = null; try { seen = localStorage.getItem(LS); } catch (e) {}
  if (seen || new URLSearchParams(location.search).has('autotest') && !new URLSearchParams(location.search).has('tour')) { if (document.getElementById('btnTour')) clearInterval(iv); return; }
  const day = +(document.getElementById('day')?.textContent || 0), modal = document.getElementById('modal');
  const ok = day >= 1 && vis(document.getElementById('tabs')) && !document.getElementById('cine') && !(modal && !modal.classList.contains('hidden'))
    && !vis(document.getElementById('splash')) && !document.getElementById('tourCard') && !vis(document.getElementById('mapScreen'));
  if (day > 3) { clearInterval(iv); return; }   // стара игра — само по бутона ❓
  calm = ok ? calm + 1 : 0;
  if (calm >= 2) { clearInterval(iv); startTour(); }
}, 1000);
