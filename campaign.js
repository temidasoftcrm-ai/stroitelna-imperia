// campaign.js — 🇺🇸 президентската кампания (политиката, етап 3): 51 щата (50 + окръг Колумбия), 538 електорални гласа, нужни 270.
// Седмица по седмица (16 седмици): всяка седмица имаш 3 хода — митинг, щаб, подкрепа (+ реклама за пари без ход); противникът
// (измисленият сенатор Ричард Колинс) отговаря в люлеещите се щати; дебати на 6-а, 10-а и 14-а седмица; случайни събития.
// Изборната нощ: щатите се обявяват по часовите зони — от изток на запад; при победа — клипът (assets/video/victory-us.mp4) и deps.onWin().
// Картата: assets/data/us-states.json (Natural Earth 1:50m, обществено достояние — SVG очертания, Аляска и Хаваи долу вляво).
// Записът: S.camp = { cc: 'US', week, ap, sup: { ST: % за теб }, hq: { ST: 1 }, ads: { ST: n }, log: [], done, won, ev }.
// deps: { S, econ, fmt, toast, save, sound, name() — името ти/марката, cities() — [{ st, nm }] твоите градове в САЩ (носят подкрепа), onWin(), onLose() }

// [електори, наклон към теб (+) / към противника (−), население (млн.), часова зона: 0 — изток … 4 — Аляска/Хаваи]
export const STATES = {
  AL: [9, -9, 5.1, 1], AK: [3, -6, 0.7, 4], AZ: [11, 0, 7.4, 2], AR: [6, -10, 3.1, 1], CA: [54, 9, 39, 3], CO: [10, 3, 5.9, 2], CT: [7, 6, 3.6, 0],
  DE: [3, 6, 1, 0], DC: [3, 14, 0.7, 0], FL: [30, -3, 22.6, 0], GA: [16, 0, 11, 0], HI: [4, 8, 1.4, 4], ID: [4, -12, 2, 2], IL: [19, 5, 12.5, 1],
  IN: [11, -6, 6.8, 0], IA: [6, -4, 3.2, 1], KS: [6, -7, 2.9, 1], KY: [8, -9, 4.5, 0], LA: [8, -7, 4.6, 1], ME: [4, 3, 1.4, 0], MD: [10, 9, 6.2, 0],
  MA: [11, 10, 7, 0], MI: [15, 1, 10, 0], MN: [10, 2, 5.7, 1], MS: [6, -8, 2.9, 1], MO: [10, -6, 6.2, 1], MT: [4, -8, 1.1, 2], NE: [5, -8, 2, 1],
  NV: [6, 0, 3.2, 3], NH: [4, 2, 1.4, 0], NJ: [14, 5, 9.3, 0], NM: [5, 3, 2.1, 2], NY: [28, 7, 19.6, 0], NC: [16, -1, 10.8, 0], ND: [3, -12, 0.8, 1],
  OH: [17, -3, 11.8, 0], OK: [7, -12, 4, 1], OR: [8, 5, 4.2, 3], PA: [19, 0, 13, 0], RI: [4, 7, 1.1, 0], SC: [9, -6, 5.3, 0], SD: [3, -10, 0.9, 1],
  TN: [11, -9, 7.1, 1], TX: [40, -2, 30.5, 1], UT: [6, -9, 3.4, 2], VT: [3, 9, 0.6, 0], VA: [13, 2, 8.7, 0], WA: [12, 6, 7.8, 3], WV: [4, -13, 1.8, 0],
  WI: [10, 0, 5.9, 1], WY: [3, -14, 0.6, 2],
};
export const NAMES_BG = { AL: 'Алабама', AK: 'Аляска', AZ: 'Аризона', AR: 'Арканзас', CA: 'Калифорния', CO: 'Колорадо', CT: 'Кънектикът', DE: 'Делауеър', DC: 'Окръг Колумбия', FL: 'Флорида', GA: 'Джорджия', HI: 'Хаваи', ID: 'Айдахо', IL: 'Илинойс', IN: 'Индиана', IA: 'Айова', KS: 'Канзас', KY: 'Кентъки', LA: 'Луизиана', ME: 'Мейн', MD: 'Мериленд', MA: 'Масачузетс', MI: 'Мичиган', MN: 'Минесота', MS: 'Мисисипи', MO: 'Мисури', MT: 'Монтана', NE: 'Небраска', NV: 'Невада', NH: 'Ню Хемпшър', NJ: 'Ню Джърси', NM: 'Ню Мексико', NY: 'Ню Йорк', NC: 'Северна Каролина', ND: 'Северна Дакота', OH: 'Охайо', OK: 'Оклахома', OR: 'Орегон', PA: 'Пенсилвания', RI: 'Род Айлънд', SC: 'Южна Каролина', SD: 'Южна Дакота', TN: 'Тенеси', TX: 'Тексас', UT: 'Юта', VT: 'Върмонт', VA: 'Вирджиния', WA: 'Вашингтон', WV: 'Западна Вирджиния', WI: 'Уисконсин', WY: 'Уайоминг' };
const RIVAL = 'сенатор Ричард Колинс', WEEKS = 16, AP = 3, WIN = 270, DEBATES = [6, 10, 14];
const COST = { rally: 4e6, hq: 12e6, endorse: 0, adPerM: 1.5e6 };   // рекламата: на милион жители

// ---- събитията: текст и два избора → { nat: национално, st: { ST: ± } , cost }
const EVENTS = [
  { t: '🌀 Ураган удря Флорида. Пращаш ли строителните екипи на холдинга да помагат?', a: ['🏗️ Пращаме екипите (25 млн. €)', { cost: 25e6, st: { FL: 4, GA: 1, SC: 1 }, nat: 0.5 }], b: ['Остави го на властите', { st: { FL: -2 } }] },
  { t: '📰 Вестник пише, че фирмите ти плащат малко данъци. Как отговаряш?', a: ['📊 Публикуваме всичко', { nat: 1 }], b: ['Мълчим', { nat: -1.5 }] },
  { t: '🏭 Завод в Охайо затваря. Обещаваш ли инвестиция?', a: ['🤝 Да — 80 млн. € в нов завод', { cost: 80e6, st: { OH: 4, MI: 1.5, PA: 1.5 } }], b: ['Не обещаваме', { st: { OH: -1.5 } }] },
  { t: '🎤 Синдикатите на строителите искат среща.', a: ['Срещаме се (Ивайло води)', { st: { PA: 2, MI: 2, WI: 2, OH: 1 } }], b: ['Нямаме време', {}] },
  { t: '💻 Технологичните компании в Калифорния предлагат подкрепа срещу обещание за данъчни облекчения.', a: ['Приемаме', { st: { CA: 3, WA: 2, OR: 1 }, nat: -0.5 }], b: ['Отказваме', { nat: 0.5 }] },
  { t: '🛢️ Цената на горивата скача. Вера предлага временно намаление в бензиностанциите на холдинга.', a: ['Намаляваме (40 млн. €)', { cost: 40e6, nat: 1.5 }], b: ['Пазарът решава', { nat: -0.5 }] },
  { t: '🌾 Фермерите в Айова искат по-добри пътища до силозите.', a: ['Надя обещава 300 км пътища', { st: { IA: 3, NE: 1, KS: 1 } }], b: ['По-късно', {}] },
  { t: '📺 Противникът пуска остра реклама срещу теб.', a: ['Отговаряме с факти (20 млн. €)', { cost: 20e6, nat: 0.5 }], b: ['Пренебрегваме я', { nat: -1 }] },
  { t: '🚄 Предлагаш ли високоскоростна железница Тексас — Калифорния?', a: ['Мария представя плана', { st: { TX: 2, CA: 1.5, AZ: 2, NM: 1, NV: 1 } }], b: ['Твърде скъпо', {}] },
  { t: '🏥 Болница в Джорджия ще затвори. Георги предлага холдингът да я поеме.', a: ['Поемаме (60 млн. €)', { cost: 60e6, st: { GA: 3, NC: 1, SC: 1 } }], b: ['Не', { st: { GA: -1 } }] },
];
const DEBATE_Q = [
  { q: 'Икономиката: как ще създадеш работни места?', o: [['🏗️ Инфраструктура в цялата страна', 2.2], ['💼 Ниски данъци за бизнеса', 1.2], ['🤷 Общи приказки', -1.5]] },
  { q: 'Енергията: какво ще правиш с цените?', o: [['⚡ Ядрена + вятър + собствен добив', 2], ['🛢️ Повече петрол', 1], ['🌱 Само зелена енергия веднага', 0.3]] },
  { q: 'Защо избирателите да ти вярват?', o: [['🏙️ Построих Империал Сити от нулата', 2.4], ['📈 Холдингът печели милиарди', 1], ['😤 Нападаш противника', -0.8]] },
];

let geoP = null;
const loadMap = () => geoP || (geoP = fetch('assets/data/us-states.json').then(r => r.json()));
const css = `
#camp { position:fixed; inset:0; z-index:9785; background:#0b1220; color:#e6edf6; font:500 14px/1.45 system-ui, sans-serif; display:flex; flex-direction:column; }
#camp .tb { display:flex; align-items:center; gap:14px; padding:10px 16px; background:#0f1a2e; border-bottom:1px solid #22324d; flex-wrap:wrap; }
#camp .tb h2 { margin:0; font:800 18px system-ui, sans-serif; flex:1 1 220px; }
#camp .pill { padding:4px 10px; border-radius:999px; background:#17253f; font-weight:700; white-space:nowrap; }
#camp .ev { flex:1 1 100%; height:22px; border-radius:6px; background:#2a3550; position:relative; overflow:hidden; display:flex; }
#camp .ev i { display:block; height:100%; } #camp .ev .mark { position:absolute; left:50.18%; top:-2px; bottom:-2px; width:2px; background:#fff; }
#camp .ev b { position:absolute; top:2px; font:800 12px system-ui, sans-serif; color:#fff; text-shadow:0 1px 2px #000; }
#camp .main { flex:1; display:flex; min-height:0; }
#camp .map { flex:1; display:flex; align-items:center; justify-content:center; padding:10px; min-width:0; }
#camp svg { width:100%; height:100%; max-height:100%; }
#camp svg path { stroke:#0b1220; stroke-width:0.8; cursor:pointer; transition:fill .4s; }
#camp svg path:hover { stroke:#fff; stroke-width:1.6; }
#camp svg path.sel { stroke:#ffd54a; stroke-width:2.2; }
#camp svg text { font:700 9px system-ui, sans-serif; fill:#fff; pointer-events:none; text-anchor:middle; paint-order:stroke; stroke:#0008; stroke-width:2px; }
#camp .side { width:min(360px, 40vw); padding:14px; border-left:1px solid #22324d; overflow:auto; background:#0f1a2e; }
#camp .side h3 { margin:0 0 4px; font:800 17px system-ui, sans-serif; }
#camp .side .m { color:#9fb0c8; font-size:13px; }
#camp button { font:700 14px system-ui, sans-serif; border:0; border-radius:10px; padding:9px 12px; cursor:pointer; background:#1f3050; color:#e6edf6; margin:3px 0; width:100%; text-align:left; }
#camp button.go { background:#f5b942; color:#111; text-align:center; } #camp button:disabled { opacity:.4; cursor:default; }
#camp .bar2 { height:14px; border-radius:7px; overflow:hidden; display:flex; margin:6px 0; } #camp .bar2 i { display:block; }
#camp .log { margin-top:10px; font-size:12.5px; color:#9fb0c8; } #camp .log div { margin:2px 0; }
#camp .modal { position:absolute; inset:0; background:#000a; display:flex; align-items:center; justify-content:center; z-index:2; }
#camp .modal > div { width:min(520px, 92vw); background:#12203a; border:1px solid #2d4470; border-radius:14px; padding:16px 18px; box-shadow:0 10px 40px #000; }
#camp .modal h3 { margin:0 0 8px; font:800 18px system-ui, sans-serif; }
#camp .x { width:auto; background:#24324e; text-align:center; }
#camp video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; z-index:3; }
@media (max-width:760px) { #camp .main { flex-direction:column; } #camp .side { width:auto; border-left:0; border-top:1px solid #22324d; max-height:42vh; } }
`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = s => () => (s = (s * 16807) % 2147483647) / 2147483647;

export function createCampaign(deps) {
  const S = () => deps.S();
  const st = () => S().camp;
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${Math.round(n / 1e6).toLocaleString('bg-BG')} млн. €`;
  // начало: подкрепата ти по щати = 50 + наклон×0.6 + шум; щатите с твои градове/бизнес — по-силно за теб
  function start() {
    const r = rnd(Math.round((S().day || 1) * 7919)), sup = {}, mine = new Set((deps.cities ? deps.cities() : []).map(c => c.st));
    for (const [k, [, lean]] of Object.entries(STATES)) sup[k] = clamp(50 + lean * 0.6 + (r() - 0.5) * 4 + (mine.has(k) ? 4 : 0) - 2, 20, 80);
    S().camp = { cc: 'US', week: 1, ap: AP, sup, hq: {}, ads: {}, log: [`🗳️ Кампанията започва. Противник: ${RIVAL}.`], done: false, won: null, ev: null, seed: Math.round(r() * 1e6) };
    deps.save && deps.save();
  }
  const evOf = (who) => Object.entries(STATES).reduce((a, [k, [ev]]) => a + ((who === 'me' ? st().sup[k] > 50 : st().sup[k] < 50) ? ev : 0), 0);
  // проекцията: сигурни (>+5), склонни (+2…+5), неясни (±2)
  function proj() {
    const o = { me: 0, meLean: 0, toss: 0, riv: 0, rivLean: 0 };
    for (const [k, [ev]] of Object.entries(STATES)) { const m = st().sup[k] - 50; if (m > 5) o.me += ev; else if (m > 2) o.meLean += ev; else if (m >= -2) o.toss += ev; else if (m >= -5) o.rivLean += ev; else o.riv += ev; }
    return o;
  }
  const natPoll = () => { let a = 0, p = 0; for (const [k, [, , pop]] of Object.entries(STATES)) { a += st().sup[k] * pop; p += pop; } return a / p; };
  const color = (m, me) => { const c = me || '#4fc3f7', R = '#e05a4f'; if (Math.abs(m) <= 2) return '#8a93a6'; const k = clamp(Math.abs(m) / 10, 0.45, 1); return mix('#9aa3b5', m > 0 ? c : R, k); };   // склонните — по-светли, сигурните — плътни
  function mix(a, b, k) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), C = p(b); return '#' + A.map((v, i) => Math.round(v + (C[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
  // съседите — по региона (часовата зона) и близостта на центровете (картата)
  let geo = null;
  const near = (k, n = 4) => geo ? Object.keys(geo.s).filter(x => x !== k).sort((a, b) => dist(k, a) - dist(k, b)).slice(0, n) : [];
  const dist = (a, b) => Math.hypot(geo.s[a].c[0] - geo.s[b].c[0], geo.s[a].c[1] - geo.s[b].c[1]);
  // насищане: колкото по-далеч е щатът от 50/50 в посоката на хода, толкова по-малко дава (реалистично: 60–65% е много)
  const add = (k, v) => { const m = st().sup[k] - 50; if (v * m > 0) v *= clamp(1 - Math.abs(m) / 18, 0.08, 1); st().sup[k] = clamp(st().sup[k] + v, 5, 95); };
  const nat = v => { for (const k in st().sup) add(k, v); };
  const pay = c => { if (!c) return true; const e = deps.econ(); if (!e.canAfford(c)) { deps.toast && deps.toast(`Нямаш ${B(c)}.`, 'bad'); return false; } e.spend(c, 'кампания', 'Президентска кампания'); return true; };
  const log = t => { st().log.unshift(t); st().log = st().log.slice(0, 40); };

  // ---- ходовете
  // митинг: всеки следващ в същия щат събира по-малко нови хора
  function rally(k) { if (st().ap < 1 || !pay(COST.rally)) return; st().ap--; const R = st().rallies = st().rallies || {}, n = R[k] || 0; R[k] = n + 1; const g = (2.5 + Math.random() * 1.5) / (1 + n * 0.35); add(k, g); for (const n of near(k)) add(n, 0.6); log(`🎤 Митинг в ${NAMES_BG[k]}: +${g.toFixed(1).replace('.', ',')}%`); deps.sound && deps.sound('click'); }
  function hq(k) { if (st().ap < 1 || st().hq[k] || !pay(COST.hq)) return; st().ap--; st().hq[k] = 1; add(k, 1); log(`🏢 Изборен щаб в ${NAMES_BG[k]} (+0,4% всяка седмица, по-висока активност в изборния ден)`); }
  function ad(k) { const c = Math.round(COST.adPerM * STATES[k][2] / 1e6) * 1e6, n = st().ads[k] || 0; if (!pay(c)) return; st().ads[k] = n + 1; const g = 2 / (1 + n * 0.6); add(k, g); log(`📺 Реклама в ${NAMES_BG[k]} (${B(c)}): +${g.toFixed(1).replace('.', ',')}%`); }
  function endorse(k) { if (st().ap < 1) return; st().ap--; const mine = (deps.cities ? deps.cities() : []).filter(c => c.st === k); const g = 1.2 + mine.length * 1.5; add(k, g); log(`🤝 ${mine.length ? `Твоят бизнес в ${mine.map(c => c.nm).join(', ')}` : 'Местни лидери'} подкрепят кампанията в ${NAMES_BG[k]}: +${g.toFixed(1).replace('.', ',')}%`); }

  // ---- край на седмицата: щабовете, противникът (в люлеещите се щати), събитие, дебат
  function endWeek() {
    const s = st(); if (s.done) return;
    for (const k in s.hq) add(k, 0.4);
    const swing = Object.keys(s.sup).filter(k => Math.abs(s.sup[k] - 50) < 6).sort((a, b) => STATES[b][0] - STATES[a][0]).slice(0, 4);
    for (const k of swing) add(k, -(1.2 + Math.random() * 1.6));
    if (swing.length) log(`🔴 ${RIVAL[0].toUpperCase() + RIVAL.slice(1)} води кампания в ${swing.map(k => NAMES_BG[k]).join(', ')}.`);
    nat((Math.random() - 0.5) * 0.6);   // шумът на новините
    s.week++; s.ap = AP;
    if (s.week > WEEKS) { election(); return; }
    if (DEBATES.includes(s.week)) s.ev = { debate: DEBATES.indexOf(s.week) };
    else if (Math.random() < 0.55) s.ev = { e: Math.floor(Math.random() * EVENTS.length) };
    deps.save && deps.save();
  }
  function resolveEvent(choice) {
    const s = st(), E = s.ev; if (!E) return; s.ev = null;
    if (E.debate != null) {
      const Q = DEBATE_Q[E.debate], o = Q.o[choice], g = o[1] + (Math.random() - 0.5);
      nat(g / 2); log(`🎙️ Дебат ${E.debate + 1}: „${o[0]}“ — ${g > 0.5 ? 'спечели дебата' : g < -0.3 ? 'загуби дебата' : 'равен дебат'} (${g >= 0 ? '+' : ''}${(g / 2).toFixed(1).replace('.', ',')}% навсякъде)`);
    } else {
      const ev = EVENTS[E.e], [lab, fx] = choice ? ev.b : ev.a;
      if (fx.cost && !pay(fx.cost)) { s.ev = E; return; }
      if (fx.nat) nat(fx.nat); for (const [k, v] of Object.entries(fx.st || {})) add(k, v);
      log(`${ev.t.split(' ')[0]} ${lab}`);
    }
    deps.save && deps.save();
  }
  // ---- изборната нощ: резултатът = подкрепата + шум + активност (щабовете); обявяване по часовите зони
  function election() {
    const s = st(), r = rnd(s.seed || 1), res = {};
    for (const k in s.sup) res[k] = clamp(s.sup[k] + (r() - 0.5) * 5 + (s.hq[k] ? 1.2 : 0), 1, 99);
    s.res = res; s.done = true; s.order = Object.keys(res).sort((a, b) => STATES[a][3] - STATES[b][3] || (r() - 0.5));
    s.won = Object.entries(res).reduce((a, [k, v]) => a + (v > 50 ? STATES[k][0] : 0), 0) >= WIN;
    deps.save && deps.save();
  }

  // ---- екранът
  let el = null, selK = null, night = null;
  function open() {
    if (!S().camp) start();
    document.getElementById('camp')?.remove();
    if (!document.getElementById('campCss')) { const c = document.createElement('style'); c.id = 'campCss'; c.textContent = css; document.head.appendChild(c); }
    el = document.createElement('div'); el.id = 'camp'; document.body.appendChild(el);
    loadMap().then(g => { geo = g; render(); if (st().done && st().res && night == null) electionNight(); }).catch(() => { el.innerHTML = '<div style="padding:20px">Картата не се зареди.</div>'; });
    addEventListener('keydown', key);
  }
  const key = e => { if (e.key === 'Escape' && !night) close(); };
  function close() { removeEventListener('keydown', key); el && el.remove(); el = null; night && clearInterval(night); night = null; }
  const me = () => deps.brandCol || '#4fc3f7';
  function render() {
    if (!el || !geo) return;
    const s = st(), P = proj(), np = natPoll(), M = me(), you = deps.name ? deps.name() : 'Ти';
    const shown = s.done && s.shownRes ? s.shownRes : null;
    const sup = k => shown ? (k in shown ? shown[k] : null) : s.sup[k];
    const evMe = shown ? Object.entries(shown).reduce((a, [k, v]) => a + (v > 50 ? STATES[k][0] : 0), 0) : P.me + P.meLean;
    const evRiv = shown ? Object.entries(shown).reduce((a, [k, v]) => a + (v < 50 ? STATES[k][0] : 0), 0) : P.riv + P.rivLean;
    el.innerHTML = `<div class="tb"><h2>🇺🇸 Президентска кампания${s.done ? ' — изборната нощ' : ''}</h2>
      ${s.done ? '' : `<span class="pill">📅 Седмица ${s.week} / ${WEEKS}</span><span class="pill">⚡ Ходове: ${s.ap}</span><span class="pill">📊 Национално: ${np.toFixed(1).replace('.', ',')}%</span>`}
      <button class="x" style="width:auto">✕</button>
      <div class="ev"><i style="width:${evMe / 538 * 100}%;background:${M}"></i>${shown ? '' : `<i style="width:${P.toss / 538 * 100}%;background:#8a93a6"></i>`}<i style="margin-left:auto;width:${evRiv / 538 * 100}%;background:#e05a4f"></i><span class="mark"></span>
      <b style="left:8px">${you}: ${evMe}${shown ? '' : ' (+' + P.toss + ' неясни)'}</b><b style="right:8px">${RIVAL.split(' ').slice(1).join(' ')}: ${evRiv}</b><b style="left:50%;transform:translateX(8px)">270</b></div></div>
      <div class="main"><div class="map"><svg viewBox="0 0 ${geo.w} ${geo.h}">${Object.entries(geo.s).map(([k, v]) => `<path data-st="${k}" d="${v.d}" fill="${sup(k) == null ? '#1b2740' : color(sup(k) - 50, M)}" class="${k === selK ? 'sel' : ''}"><title>${NAMES_BG[k]} · ${STATES[k][0]} ел. гласа${sup(k) != null ? ` · ${sup(k).toFixed(1).replace('.', ',')}% за теб` : ''}</title></path>`).join('')}${Object.entries(geo.s).filter(([k]) => STATES[k][0] >= 6 || k === 'AK' || k === 'HI').map(([k, v]) => `<text x="${v.c[0]}" y="${v.c[1] + 3}">${k}</text>`).join('')}</svg></div>
      <div class="side">${side()}</div></div>`;
    el.querySelector('.x').onclick = () => close();
    el.querySelectorAll('[data-st]').forEach(p => p.onclick = () => { selK = p.dataset.st; render(); });
    const b = (sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = () => { fn(); render(); }; };
    if (selK) { b('[data-a="rally"]', () => rally(selK)); b('[data-a="hq"]', () => hq(selK)); b('[data-a="ad"]', () => ad(selK)); b('[data-a="end"]', () => endorse(selK)); }
    b('[data-a="week"]', () => { endWeek(); if (st().done) electionNight(); });
    if (s.ev && !s.done) modal();
  }
  function side() {
    const s = st(), M = me();
    if (s.done) return `<h3>🗳️ Изборната нощ</h3><div class="m">Щатите се обявяват от изток на запад, щом затворят урните.</div><div class="log">${s.log.slice(0, 14).map(t => `<div>${t}</div>`).join('')}</div>`;
    let h = '';
    if (selK) {
      const v = s.sup[selK], [ev, , pop] = STATES[selK], adc = Math.round(COST.adPerM * pop / 1e6) * 1e6, m = v - 50;
      h += `<h3>${NAMES_BG[selK]}</h3><div class="m">${ev} електорални гласа · ${pop.toLocaleString('bg-BG')} млн. жители${s.hq[selK] ? ' · 🏢 щаб' : ''}</div>
        <div class="bar2"><i style="width:${v}%;background:${M}"></i><i style="width:${100 - v}%;background:#e05a4f"></i></div>
        <div class="m">${v.toFixed(1).replace('.', ',')}% за теб · ${Math.abs(m) <= 2 ? '⚖️ неясно' : m > 0 ? (m > 5 ? '✅ сигурен' : '🟢 склонен към теб') : (m < -5 ? '🔴 при противника' : '🟠 склонен към противника')}</div>
        <button data-a="rally" ${s.ap < 1 ? 'disabled' : ''}>🎤 Митинг · 1 ход · ${B(COST.rally)}</button>
        <button data-a="ad">📺 Реклама · ${B(adc)}${s.ads[selK] ? ` (×${s.ads[selK]}, отслабва)` : ''}</button>
        <button data-a="hq" ${s.ap < 1 || s.hq[selK] ? 'disabled' : ''}>🏢 Изборен щаб · 1 ход · ${B(COST.hq)}</button>
        <button data-a="end" ${s.ap < 1 ? 'disabled' : ''}>🤝 Подкрепа от местни лидери и бизнеса ти · 1 ход</button>`;
    } else h += `<h3>Избери щат на картата</h3><div class="m">Сивите са неясни — там се решават изборите. Нужни са <b>270</b> от 538 електорални гласа.</div>`;
    h += `<button class="go" data-a="week" style="margin-top:12px">${s.week >= WEEKS ? '🗳️ Към изборите →' : `Край на седмица ${s.week} →`}</button>`;
    h += `<div class="log">${s.log.slice(0, 10).map(t => `<div>${t}</div>`).join('')}</div>`;
    return h;
  }
  function modal() {
    const s = st(), E = s.ev, w = document.createElement('div'); w.className = 'modal';
    if (E.debate != null) { const Q = DEBATE_Q[E.debate]; w.innerHTML = `<div><h3>🎙️ Дебат ${E.debate + 1} от 3</h3><div class="m" style="margin-bottom:8px">Водещият пита: „${Q.q}“</div>${Q.o.map((o, i) => `<button data-c="${i}">${o[0]}</button>`).join('')}</div>`; }
    else { const ev = EVENTS[E.e]; w.innerHTML = `<div><h3>📰 Седмица ${s.week}</h3><div style="margin-bottom:10px">${ev.t}</div><button data-c="0">${ev.a[0]}</button><button data-c="1">${ev.b[0]}</button></div>`; }
    el.appendChild(w);
    w.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { resolveEvent(+b.dataset.c); render(); });
  }
  // изборната нощ: по един щат на ~0,45 s; после победата (клипът) или загубата
  function electionNight() {
    const s = st(); if (!s.res) return; s.shownRes = s.shownRes || {}; let i = Object.keys(s.shownRes).length;
    render(); night && clearInterval(night);
    night = setInterval(() => {
      if (!el) { clearInterval(night); night = null; return; }
      const k = s.order[i++];
      if (!k) { clearInterval(night); night = null; finish(); return; }
      s.shownRes[k] = s.res[k]; log(`${s.res[k] > 50 ? '🔵' : '🔴'} ${NAMES_BG[k]} (${STATES[k][0]}) — ${s.res[k] > 50 ? 'за теб' : 'за противника'} · ${s.res[k].toFixed(1).replace('.', ',')}%`);
      deps.sound && deps.sound(s.res[k] > 50 ? 'cash' : 'click'); render();
    }, 450);
  }
  function finish() {
    const s = st(), ev = Object.entries(s.res).reduce((a, [k, v]) => a + (v > 50 ? STATES[k][0] : 0), 0);
    deps.save && deps.save();
    if (s.won) {
      log(`🏆 ПОБЕДА: ${ev} електорални гласа!`); render();
      const v = document.createElement('video'); v.src = 'assets/video/victory-us.mp4'; v.autoplay = true; v.controls = false; v.playsInline = true;
      const skip = document.createElement('button'); skip.textContent = 'Продължи →'; skip.className = 'go'; Object.assign(skip.style, { position: 'absolute', right: '20px', bottom: '20px', width: 'auto', zIndex: 4 });
      const end = () => { v.remove(); skip.remove(); victoryCard(ev); };
      v.onended = end; v.onerror = end; skip.onclick = end; el.appendChild(v); el.appendChild(skip);
      deps.sound && deps.sound('levelup');
    } else { log(`Загуба: ${ev} от 270 нужни.`); render(); const w = document.createElement('div'); w.className = 'modal'; w.innerHTML = `<div><h3>😞 Изборите са загубени</h3><div class="m" style="margin-bottom:10px">${ev} електорални гласа — нужни са 270. ${RIVAL[0].toUpperCase() + RIVAL.slice(1)} печели. Можеш да опиташ пак след 4 години.</div><button class="go" data-ok>Затвори</button></div>`; el.appendChild(w); w.querySelector('[data-ok]').onclick = () => { close(); deps.onLose && deps.onLose(ev); }; }
  }
  function victoryCard(ev) {
    const w = document.createElement('div'); w.className = 'modal';
    w.innerHTML = `<div style="text-align:center"><div style="font-size:54px">🏆🇺🇸</div><h3 style="font-size:24px">Президент на Съединените щати!</h3><div class="m" style="margin-bottom:12px">${ev} електорални гласа. Министерският съвет те очаква в Белия дом.</div><button class="go" data-ok>🏛️ Към Белия дом →</button></div>`;
    el.appendChild(w); w.querySelector('[data-ok]').onclick = () => { close(); deps.onWin && deps.onWin(ev); };
  }
  return { open, close, start, state: st, proj, natPoll, active: () => !!S()?.camp && !S().camp.done, won: () => !!S()?.camp?.won };
}

// демо за Лабораторията: собствен запис в паметта (не пипа играта)
export function demoCampaign() {
  const mem = { day: 1 }; let money = 5e9;
  const c = createCampaign({ S: () => mem, econ: () => ({ canAfford: n => money >= n, spend: n => { money -= n; } }), save: () => {}, toast: t => console.log(t), name: () => 'Титан', cities: () => [{ st: 'TX', nm: 'Хюстън' }, { st: 'TX', nm: 'Империал Сити' }],
    onWin: () => console.log('WIN'), onLose: () => console.log('LOSE') });
  c.open(); return c;
}
