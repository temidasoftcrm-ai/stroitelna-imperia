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
  ['🏅 Ново ниво: картинка', 'sofia', d => { d.lvShow(2); setTimeout(() => d.lvShow(3), 6000); }],
];
const PAGES = [['plan.html', 'Градските планове (всички шаблони)'], ['index.html', 'Играта от началото (отделен запис на :3610)'], ['online.html', 'Онлайн империя']];

const rejected = new Set((() => { try { return JSON.parse(localStorage.getItem('lab.rejected') || '[]'); } catch { return []; } })());   // „✖ Не е ОК“ — скрити, докато Claude не направи друго
let state = readHash(), approved = [], showDone = false, frameKey = 0;
function readHash() { const h = new URLSearchParams(location.hash.slice(1)); return { tab: h.get('tab') || 'review', item: h.get('item') || '' }; }
function pick(tab, item = '') { state = { tab, item }; const h = new URLSearchParams(state).toString(); if (location.hash.slice(1) !== h) location.hash = h; render(); }
addEventListener('hashchange', () => { const n = readHash(); if (n.tab !== state.tab || n.item !== state.item) { state = n; render(); } });

const post = (u, o) => fetch(u, { method: 'POST', body: JSON.stringify(o) }).then(r => r.json());
async function loadApproved() { try { approved = (await (await fetch('/__lab/approved')).json()).approved; } catch { approved = []; } }

function render() {
  const pending = FEATURES.filter(f => !approved.includes(f.id) && !rejected.has(f.id)).length;
  $('tabs').innerHTML = [['review', `Ново${pending ? ` (${pending})` : ''}`], ['scenes', 'Сцени'], ['models', '3D модели'], ['sounds', 'Звуци'], ['demos', 'Мисии/демо']]
    .map(([t, l]) => `<button data-tab="${t}" class="${state.tab === t ? 'on' : ''}">${l}</button>`).join('');
  $('tabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => pick(b.dataset.tab));
  if (state.tab !== 'models' && state.tab !== 'review') closeModel();
  ({ review: renderReview, scenes: renderScenes, models: renderModels, sounds: renderSounds, demos: renderDemos })[state.tab]?.();
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
function renderReview() {
  const list = FEATURES.filter(f => (showDone || !approved.includes(f.id)) && !rejected.has(f.id)), pending = FEATURES.filter(f => !approved.includes(f.id)).length;
  sideNav(list.map(f => row(state.item === f.id, `${approved.includes(f.id) ? '✅' : '🧪'} ${f.title}`, approved.includes(f.id) ? 'В играта' : 'Чака OK', `data-f="${f.id}"`)).join('')
    + (!pending && !showDone ? `<div class="empty" style="height:auto;padding:24px 8px">${FEATURES.length ? 'Всичко ново е одобрено ✓' : 'Още няма нищо ново за проверка.<br><br>Новото от Claude се появява тук и влиза в играта само след „✓ OK“.'}</div>` : '')
    + (FEATURES.length > pending ? `<button class="row" id="bDone"><small>${showDone ? '▴ Скрий одобрените' : `▾ Одобрени (${FEATURES.length - pending}) — покажи`}</small></button>` : ''));
  $('side').querySelectorAll('[data-f]').forEach(b => b.onclick = () => pick('review', b.dataset.f));
  if ($('bDone')) $('bDone').onclick = () => { showDone = !showDone; render(); };
  const f = FEATURES.find(x => x.id === state.item);
  if (!f) { $('main').innerHTML = `<div class="empty">Новото чака проверка: избери отляво, пробвай и натисни „✓ OK“ — тогава влиза в играта.</div>`; return; }
  const fh = f.url.startsWith('#') ? new URLSearchParams(f.url.slice(1)) : null, mUrl = fh && fh.get('tab') === 'models' ? fh.get('item') : null, sUrl = fh && fh.get('tab') === 'sounds' ? fh.get('item') : null;
  if (sUrl) {   // нов звук: пуска се тук, с „✓ OK“ отдолу
    closeModel();
    $('main').innerHTML = `<div class="snd"><h2>${esc(sUrl.replace(/^s:/, ''))}</h2><small style="color:var(--mut)">${sUrl.startsWith('s:') ? 'синтезиран в sound.js — новата версия' : esc(sUrl)}</small><button class="btn ok" id="bPlay">▶ Пусни</button></div><div class="bar" id="bar"></div>`;
    bar(`Ново: ${f.title} (${f.id})`);
    $('bPlay').onclick = () => play(sUrl);
  } else if (mUrl) {   // нов модел: показва се тук, в „Ново“ (с „✓ OK“) — не в „3D модели“, където „Одобри“ е само „прегледан“
    $('main').innerHTML = `<div id="view" style="position:absolute;inset:0"></div><div class="bar" id="bar"></div>`;
    bar(`Ново: ${f.title} (${f.id})`, [`<button class="btn" id="bWire">Мрежа</button>`, `<button class="btn" id="bBg">Светъл фон</button>`]);
    openModel($('view'), mUrl);
  } else if (!fh) { closeModel(); frame(f.url, `Ново: ${f.title} (${f.id})`); }
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
  box.innerHTML = `<div><b>${esc(f.title)}</b><div>${esc(f.how)}</div></div><div style="display:flex;flex-direction:column;gap:6px">${on ? `<button class="btn" id="bApp">↩ Махни от играта</button>` : `<button class="btn ok" id="bApp">✓ OK — в играта</button><button class="btn red" id="bRej">✖ Не е ОК — намери друго</button>`}</div>`;
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
  if ($('bRej')) $('bRej').onclick = () => {   // отхвърлено: задача за Claude (lab-feedback.jsonl) и изчезва от „Ново“
    const why = prompt('Какво не е наред? (по желание)') || '';
    post('/__lab/feedback', { target: `Ново: ${f.title} (${f.id})`, kind: 'reject', text: 'Не е ОК — намери друго' + (why ? ': ' + why : '') }).catch(() => { });
    rejected.add(f.id); try { localStorage.setItem('lab.rejected', JSON.stringify([...rejected])); } catch { }
    const nx = FEATURES.find(x => !approved.includes(x.id) && !rejected.has(x.id)); pick('review', nx ? nx.id : '');
  };
  $('bApp').onclick = () => post('/__lab/approved', { id: f.id, ok: !on }).then(j => {
    approved = j.approved;
    if (!on && mUrl) post('/__lab/feedback', { target: `Модел: ${mUrl}`, kind: 'reviewed', text: '' }).catch(() => { });   // и в „3D модели“ — като одобрен
    if (!on && !showDone) { const nx = FEATURES.find(x => !approved.includes(x.id)); pick('review', nx ? nx.id : ''); } else render();
  });
}

// ---- Сцени
function renderScenes() {
  sideNav(`<div class="grp">Градове <i>(нова игра с план)</i></div>` + SCENES.map(([id, nm, sub]) => row(state.item === id, nm, sub, `data-c="${id}"`)).join(''));
  $('side').querySelectorAll('[data-c]').forEach(b => b.onclick = () => pick('scenes', b.dataset.c));
  if (!state.item) { $('main').innerHTML = `<div class="empty">Избери град отляво — зарежда се направо в града (нова игра с градски план, ботът не играе сам).</div>`; return; }
  frame(`${GAME}&plan=1&city=${state.item}`, `Сцена: ${state.item}`);
}

// ---- Мисии/демо
function renderDemos() {
  sideNav(`<div class="grp">В града <i>(действие след зареждане)</i></div>` + DEMOS.map(([nm, c], i) => row(state.item === 'd' + i, nm, c, `data-d="d${i}"`)).join('')
    + `<div class="grp">Страници</div>` + PAGES.map(([u, nm]) => row(state.item === u, nm, u, `data-d="${u}"`)).join(''));
  $('side').querySelectorAll('[data-d]').forEach(b => b.onclick = () => pick('demos', b.dataset.d));
  if (!state.item) { $('main').innerHTML = `<div class="empty">Избери отляво — градът се зарежда и Лабораторията сама отива до мястото (__dbg).</div>`; return; }
  if (state.item.startsWith('d')) { const [nm, c, fn] = DEMOS[+state.item.slice(1)] || []; if (fn) frame(`${GAME}&plan=1&city=${c}`, `Демо: ${nm}`, fn); }
  else frame(state.item, `Страница: ${state.item}`);
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
