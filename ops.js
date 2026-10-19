// ops.js — 🚨 оперативните кризи (етап 3, президентът): малки 3D карти, които се отварят от събитие на геополитическата карта.
// Първата — „Градски площад“: мирен протест пред общината в столицата. Изпращаш преговарящи, медицински екип и полиция
// (задача: безопасност — периметър, трафик, коридор за линейката). Протестът е мирен, докато напрежението е под 70: без преговори
// то расте, хората стават повече и доверието пада. Над 70 — 🔥 безредици (група провокатори: подпалени кофи, щети всеки ден);
// тогава може да се изпратят 🛡️ сили на реда — отделят провокаторите от мирните хора и ги задържат (сигурност +, доверие −).
// Мирните протестиращи остават и разговорът продължава; без отговор след срока протестът се разотива недоволен.
// Изходът зависи от решенията (кой е на място, какво предлагаш на масата); 3D сцената (ops3d.js) само го показва.
// Времето на мисията тече в игрови дни: от играта (tick(dt) в кадъра) или от сцената, докато е отворена (никога и двете).
// Записът: S.ops = { act: мисия | null, done: [{ k, city, out, d }], next: денят на следващата възможна криза, seq }.
//   мисия: { id, k, iso, city, lon, lat, t (дни от началото), phase 'calm'|'active'|'resolved', tension 0–100, crowd, budget, spent,
//            demand, teams: { neg|med|pol: { st 'ready'|'enroute'|'onsite'|'back', t0, eta } }, talks 0–1, out, outT, faint, log: [{ t, txt }] }
// deps: { S, toast, save, sound, effect({ trust, security, services }), canStart() → bool, cc() → 'US'|'RU', onClose? }
import { POL } from './worldpol.js';

export const OPS_TEAMS = {
  neg: { ico: '🤝', nm: 'Преговарящи', job: 'изслушват организаторите и водят разговора на масата', cost: 2e5, eta: 0.32 },
  med: { ico: '🚑', nm: 'Медицински екип', job: 'пункт за първа помощ: вода, сенки, прегледи', cost: 1.5e5, eta: 0.28 },
  pol: { ico: '🚓', nm: 'Полиция — безопасност', job: 'периметър, отклоняване на трафика и коридор за линейката', cost: 2.5e5, eta: 0.22 },
  riot: { ico: '🛡️', nm: 'Сили на реда', job: 'отделят провокаторите от мирните протестиращи и ги задържат', cost: 6e5, eta: 0.2, riot: true },   // само при безредици
};
export const RIOT_AT = 70, RIOT_END = 50;
export const OPS_CHOICES = {
  accept: { ico: '✅', nm: 'Приеми основните искания', k: 0.4, trust: 6, sec: 2, out: 'deal' },
  comp: { ico: '🤝', nm: 'Компромис: работна група и график', k: 0.15, trust: 4, sec: 2, out: 'deal' },
  review: { ico: '📋', nm: 'Обещай преглед след 30 дни', k: 0, trust: 1, sec: 1, out: 'partial' },
};
const DEMANDS = ['По-високи заплати за лекарите и сестрите', 'Достъпни жилища за младите семейства', 'Чист въздух и по-добър градски транспорт', 'Спасете парка — без строеж в зелената зона', 'По-ниски сметки за ток и парно'];
const FADE_DAYS = 8, KEEP_DAYS = 4, EVERY = 75;
const PHASE_NM = { calm: '📢 Мирен протест', active: '🚨 Екипите действат', resolved: '✅ Ситуацията е разрешена', riot: '🔥 Безредици' };
export const opsPhaseName = (p, m) => m && m.riot && !m.out ? PHASE_NM.riot : PHASE_NM[p] || p;

export function createOps(deps) {
  let viewing = false;   // сцената е отворена — тя движи времето на мисията
  const S = () => deps.S();
  const st = () => { const s = S(); if (!s) return null; s.ops = s.ops || { act: null, done: [], next: 0, seq: 0 }; return s.ops; };
  const act = () => st()?.act || null;
  const log = (m, txt) => { m.log.unshift({ t: m.t, txt }); m.log.length = Math.min(m.log.length, 12); };

  function start(o = {}) {
    const O = st(); if (!O || O.act) return O?.act || null;
    const iso = deps.cc() === 'RU' ? 'RUS' : 'USA', C = POL[iso], cap = o.capital || { iso, city: C.cap, lon: C.lon, lat: C.lat };
    const m = O.act = { id: ++O.seq, k: 'square', iso: cap.iso, city: cap.city, lon: cap.lon, lat: cap.lat, t: 0, phase: 'calm', tension: 46, crowd: 90,
      budget: o.budget ?? 2e9, spent: 0, demand: o.demand || DEMANDS[(Math.random() * DEMANDS.length) | 0], talks: 0, out: null, outT: 0, faint: 0, log: [],
      riot: false, damage: 0, arrests: 0, riotT: 0, teams: { neg: { st: 'ready' }, med: { st: 'ready' }, pol: { st: 'ready' }, riot: { st: 'ready' } } };
    log(m, `📢 Хората се събират пред общината: „${m.demand}“. Протестът е мирен.`);
    deps.toast && deps.toast(`📢 Протест на площада в ${m.city} — отвори го от геополитическата карта (⚠️ Кризи).`, '');
    deps.save && deps.save(); return m;
  }
  // 🚗 изпращане: екипът тръгва веднага, пристига след eta дни (на картата — колата идва по улицата)
  function dispatch(k) {
    const m = act(), T = OPS_TEAMS[k]; if (!m || !T || m.out) return false; let tm = m.teams[k];
    if (!tm) m.teams[k] = { st: 'ready' };   // стари записи — без „Сили на реда“
    if (m.teams[k].st !== 'ready') return false; if (T.riot && !m.riot) return false;
    if (m.budget - m.spent < T.cost) { deps.toast && deps.toast('Бюджетът на мисията не стига.', 'bad'); return false; }
    m.spent += T.cost; Object.assign(m.teams[k], { st: 'enroute', t0: m.t, eta: T.eta });
    log(m, `${T.ico} ${T.nm} — на път (~${Math.round(T.eta * 24)} ч).`); deps.save && deps.save(); return true;
  }
  const ready = () => { const m = act(); return !!m && !m.out && m.teams.neg.st === 'onsite' && m.talks >= 1; };
  function choose(c) {
    const m = act(), C = OPS_CHOICES[c]; if (!m || !C || !ready()) return false;
    const cost = Math.round(m.budget * C.k); if (m.budget - m.spent < cost) { deps.toast && deps.toast('Бюджетът на мисията не стига за това.', 'bad'); return false; }
    m.spent += cost; m.choice = c;
    const calm = c !== 'review' || m.tension < 55;   // само обещание при високо напрежение — част от хората остават
    resolve(m, calm ? C.out : 'partial', { trust: C.trust - Math.round(m.damage / 4e7), security: C.sec + (m.teams.pol.st === 'onsite' ? 1 : 0) - m.faint, services: c === 'accept' ? 2 : 0 },
      c === 'accept' ? '✅ Исканията са приети. Хората се разотиват с аплодисменти.' : c === 'comp' ? '🤝 Компромис: работна група и график. Площадът се освобождава.' : calm ? '📋 Обещан е преглед. Протестът приключва.' : '📋 Обещан е преглед — но част от хората остават на площада.');
    return true;
  }
  function resolve(m, out, eff, txt) {
    m.out = out; m.outT = m.t; m.phase = 'resolved'; log(m, txt);
    for (const tm of Object.values(m.teams)) if (tm.st === 'onsite' || tm.st === 'enroute') { tm.st = 'back'; tm.t0 = m.t; }
    deps.effect && deps.effect(eff); deps.toast && deps.toast(`🚨 ${m.city}: ${txt}`, out === 'deal' ? 'good' : ''); deps.sound && deps.sound(out === 'deal' ? 'levelup' : 'coin'); deps.save && deps.save();
  }
  // ⏱️ dt в игрови дни
  function step(dt) {
    const m = act(); if (!m || dt <= 0) return; dt = Math.min(dt, 1);
    m.t += dt;
    for (const [k, tm] of Object.entries(m.teams)) if (tm.st === 'enroute' && m.t >= tm.t0 + tm.eta) { tm.st = 'onsite'; log(m, `${OPS_TEAMS[k].ico} ${OPS_TEAMS[k].nm} — на място.`); }
    if (m.out) { m.crowd = Math.max(m.out === 'partial' ? 35 : 0, m.crowd - 160 * dt); if (m.t - m.outT > KEEP_DAYS && !viewing) archive(); return; }   // архивира се само при затворена карта
    m.teams.riot = m.teams.riot || { st: 'ready' };
    const on = k => m.teams[k].st === 'onsite', neg = on('neg'), pol = on('pol'), med = on('med'), force = on('riot');
    if (m.phase === 'calm' && (neg || pol || med || force)) m.phase = 'active';
    // 🔥 безредиците: над 70 избухват; щети всеки ден (по-малко с полиция); силите на реда ги прекратяват за ~0,6 дни
    if (!m.riot && m.tension >= RIOT_AT) { m.riot = true; m.riotT = 0; log(m, '🔥 Безредици: група провокатори пали кофи за боклук и чупи витрини. Мирните протестиращи се отдръпват.'); deps.toast && deps.toast(`🔥 Безредици на площада в ${m.city} — можеш да изпратиш силите на реда.`, 'bad'); }
    if (m.riot) { m.riotT += dt; m.damage += (pol ? 1.5e7 : 4e7) * dt;
      if (force && m.t - m.teams.riot.t0 - m.teams.riot.eta > 0.6) { m.riot = false; const n = 8 + ((m.crowd / 20) | 0); m.arrests += n; m.tension = Math.max(20, m.tension - 22); log(m, `🛡️ Силите на реда отделиха провокаторите: ${n} задържани. Огньовете са угасени.`); deps.effect && deps.effect({ security: 2, trust: -1 }); }
      else if (m.tension < RIOT_END) { m.riot = false; log(m, '🕊️ Провокаторите се разпръснаха сами — разговорът свали напрежението.'); } }
    let dT = neg ? -11 : 3; if (m.riot) dT += force ? -10 : 2;   // без разговор напрежението расте, но протестът остава мирен
    if (pol) dT += neg ? -2 : 3;   // полицията пази, но без преговорите хората се чувстват притиснати
    if (med) dT -= 1;
    m.tension = Math.max(5, Math.min(95, m.tension + dT * dt));
    m.crowd = Math.max(20, Math.min(260, m.crowd + (m.tension > 50 ? 22 : m.tension < 30 ? -25 : 4) * dt));
    if (neg && m.talks < 1) { m.talks = Math.min(1, m.talks + dt / 0.7); if (m.talks >= 1) log(m, '🤝 Организаторите са на масата — твоят ход.'); }
    if (!med && Math.random() < 0.5 * dt * (m.crowd / 120)) { m.faint++; log(m, '🥵 Човек припадна в тълпата — няма медицински пункт.'); }
    if (m.t >= FADE_DAYS) resolve(m, 'faded', { trust: -4 - m.faint - Math.round(m.damage / 4e7), security: (pol ? 0 : -1) - (m.riot ? 3 : 0) }, '🌧️ Без отговор протестът се разотива — недоволен. Доверието пада.');
  }
  function archive() { const O = st(), m = O.act; if (!m) return; O.done.unshift({ k: m.k, city: m.city, out: m.out, d: S().day || 0 }); O.done.length = Math.min(O.done.length, 20); O.act = null; O.next = (S().day || 0) + EVERY; deps.save && deps.save(); }
  // от играта — всеки кадър (dt в дни); стартира кризата от време на време
  function tick(dt) {
    const O = st(); if (!O) return;
    if (!viewing) step(dt);
    if (!O.act && deps.canStart && deps.canStart() && (S().day || 0) >= O.next && Math.random() < dt / 20) start();
  }
  const markers = () => { const m = act(); return m ? [{ id: m.id, ico: m.out ? '✅' : '📢', nm: `Протест на площада — ${m.city}`, lon: m.lon, lat: m.lat, m }] : []; };
  const open = () => import('./ops3d.js').then(M => M.openOpsSquare(api, { onClose: deps.onClose, muted: deps.muted }));
  const api = { open, start, dispatch, choose, ready, step, tick, markers, archive, state: st, active: act, setViewing: v => { viewing = !!v; }, viewing: () => viewing };
  return api;
}

// демо за Лабораторията: отделен запис в паметта (без game.js) — протест в столицата, веднага на 3D картата
let demo = null;
export function demoOps(cc = 'US', riot = false) {
  const D = { day: 1 }; demo = demo || createOps({ S: () => D, cc: () => cc, toast: t => console.log('[ops]', t), effect: e => console.log('[ops] ефект', e) });
  if (!demo.active()) demo.start(); if (riot) { const m = demo.active(); m.tension = Math.max(m.tension, 76); } window.__ops = demo; return demo.open();
}
