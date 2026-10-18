// president.js — 🏛️ президентският етап (нива 27–35): как да помогнеш на света, без да разориш собствената си държава и да загубиш доверието на гражданите.
// Държавата има отделен бюджет (не е касата на холдинга — фирмата я водят заместници). Директорите стават министри (directors3d.js MINISTERS):
// fin Борис · reg Георги · def Ивайло · roads Надя · rail Мария · sea Стефан · air Елена · energy Вера · pm Десислава.
// Всеки месец министрите внасят национални програми, помощ за други държави и стъпки към мира; решенията са в Министерския съвет (openCabinet).
// Помощта е проект: финансиране → доставка → строеж → местен персонал и издръжка. Мирът е поредица стъпки, които другите могат да откажат, и после трябва да се поддържа.
// Записът: S.pres = { cc, start, res, ind, prom, progs, rel, stab, deals, coal, aid, conf, met, streak, held, crisis, crisisDone, world, lv, cab, skip, seq, log }.
import { POL, NEED, AID, AID_STAGES, CONFLICTS, PEACE, baseRel, mapSvg } from './worldpol.js';

const IND = { econ: ['📈', 'Икономика'], services: ['🏥', 'Обществени услуги'], energy: ['⚡', 'Енергия'], security: ['🛡️', 'Сигурност'], trust: ['🤝', 'Доверие на гражданите'] };
const REV = { US: 4e11, RU: 1e11 };   // приход на държавата на месец
const FREE_K = 0.1;                   // свободни за нови програми (останалото — задължителни разходи)
// националните програми: c — цена в месечни „свободни“; eff — какво носят; rev — промяна на прихода (дял)
const DOM = [
  { k: 'hosp', dir: 'reg', ico: '🏥', nm: 'Национална програма за болници', c: 1.2, days: 180, eff: { services: 9, trust: 3 } },
  { k: 'housing', dir: 'reg', ico: '🏘️', nm: 'Достъпни жилища в регионите', c: 1.0, days: 240, eff: { services: 6, econ: 2, trust: 3 } },
  { k: 'roads', dir: 'roads', ico: '🛣️', nm: 'Ремонт на националните пътища и мостове', c: 0.9, days: 200, eff: { econ: 6, services: 2 } },
  { k: 'rail', dir: 'rail', ico: '🚆', nm: 'Скоростни влакове и градски транспорт', c: 1.4, days: 300, eff: { econ: 5, services: 4 } },
  { k: 'ports', dir: 'sea', ico: '⚓', nm: 'Модернизация на пристанищата и износа', c: 0.8, days: 180, eff: { econ: 6 } },
  { k: 'air', dir: 'air', ico: '✈️', nm: 'Летища и споразумения „Открито небе“', c: 0.6, days: 150, eff: { econ: 4, rel: 2 } },
  { k: 'grid', dir: 'energy', ico: '⚡', nm: 'Нови централи и енергийна мрежа', c: 1.5, days: 360, eff: { energy: 13, econ: 2 } },
  { k: 'def', dir: 'def', ico: '🛡️', nm: 'Готовност, гранична охрана и киберзащита', c: 1.0, days: 200, eff: { security: 11 } },
  { k: 'tax', dir: 'fin', ico: '💰', nm: 'По-ниски данъци за средната класа', c: 0, days: 30, eff: { trust: 7, econ: 2 }, rev: -0.04 },
  { k: 'audit', dir: 'fin', ico: '🧾', nm: 'Одит и борба с разхищенията', c: 0.2, days: 90, eff: { trust: 3 }, rev: 0.03 },
];
const PROMISES = { US: ['hosp', 'tax', 'roads'], RU: ['housing', 'grid', 'def'] };
const CRISES = [
  { k: 'energy', ico: '⚡', nm: 'Световна енергийна криза', txt: 'цените на горивата скачат, а примирията се клатят' },
  { k: 'breach', ico: '💥', nm: 'Масово нарушение на примирията', txt: 'въоръжени групи не признават договореностите' },
  { k: 'flood', ico: '🌊', nm: 'Опустошителни наводнения в засегнатите региони', txt: 'възстановеното е под вода, помощта не стига' },
];
const NAMES = { fin: 'Борис', reg: 'Георги', def: 'Ивайло', roads: 'Надя', rail: 'Мария', sea: 'Стефан', air: 'Елена', energy: 'Вера', pm: 'Десислава' };

// deps: { S, fmt, toast, save, sound, pop(key, title, text), brand() → име, brandCol }
export function createPresidency(deps) {
  const st = () => deps.S().pres || null;
  const day = () => deps.S().day || 0;
  const B = n => { const a = Math.abs(n); return a >= 1e12 ? `${(n / 1e12).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} трлн. €` : a >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 0 })} млн. €`; };
  const cl = v => Math.max(0, Math.min(100, v));
  const free = () => REV[st()?.cc || 'US'] * FREE_K;
  const K = () => st()?.cc === 'RU' ? 0.5 : 1;   // помощта и мащабът — по-малки при руския бюджет
  const rel = iso => st()?.rel?.[iso] ?? baseRel(st()?.cc || 'US', iso);
  const stab = iso => st()?.stab?.[iso] ?? POL[iso]?.stab ?? 50;
  const conf = k => { const s = st(); const c = CONFLICTS.find(x => x.k === k); return (s && s.conf[k]) || { step: 0, stab: 0, int: c ? c.int : 50, wait: 0, held: 0 }; };
  const me = () => st()?.cc === 'RU' ? 'RUS' : 'USA';
  const nm = iso => POL[iso]?.nm || iso;
  const log = t => { const s = st(); s.log = [{ d: day(), t }, ...(s.log || [])].slice(0, 40); };

  function start(cc) {
    const S = deps.S(); if (S.pres) return;
    S.pres = { cc, start: day(), res: REV[cc] * FREE_K * 3, ind: { econ: 55, services: 50, energy: cc === 'RU' ? 60 : 52, security: 56, trust: 64 },
      prom: PROMISES[cc].map(k => ({ k, done: false })), progs: [], rel: {}, stab: {}, deals: {}, coal: {}, aid: [], conf: {}, met: {}, streak: 0, world: 0, lv: 26, cab: 0, skip: {}, seq: 0, log: [] };
    for (const c of CONFLICTS) S.pres.conf[c.k] = { step: 0, stab: 0, int: c.int, wait: 0, held: 0 };
    log('Встъпване в длъжност. Кабинетът е съставен.'); deps.save();
  }

  // ---- 📋 предложенията на министрите (форматът на залата: id, dir, ico, text, why, cost, days, gainTxt, small, geo)
  function proposals() {
    const s = st(); if (!s) return []; const out = [], F = free(), d = day(), skip = id => (s.skip[id] || 0) > d;
    const P = p => { if (!skip(p.id.split(':').slice(0, 2).join(':'))) out.push(p); };
    // вътрешни програми: първо обещанията и най-слабите показатели
    const low = Object.entries(s.ind).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const dom = DOM.filter(p => !s.progs.some(x => x.k === p.k) && !((s.doneAt || {})[p.k] > d - 240)).map(p => ({ p, prom: s.prom.some(x => x.k === p.k && !x.done), w: Math.min(...Object.keys(p.eff).map(e => low.indexOf(e) < 0 ? 9 : low.indexOf(e))) }))
      .sort((a, b) => b.prom - a.prom || a.w - b.w).slice(0, 4);
    for (const { p, prom } of dom) { const cost = Math.round(F * p.c / 1e8) * 1e8;
      P({ id: `${p.dir}:${p.k}:1`, dir: p.dir, ico: p.ico, text: `${NAMES[p.dir]}: предлагам „${p.nm}“.${prom ? ' Това е предизборно обещание.' : ''}`, why: Object.entries(p.eff).map(([e, v]) => e === 'rel' ? `+${v} отношения със света` : `${IND[e][1]} +${v}`).join(', ') + (p.rev ? ` · приходите ${p.rev > 0 ? '+' : ''}${Math.round(p.rev * 100)}%` : ''),
        cost, days: p.days, gainTxt: prom ? '✔ изпълнява обещание' : '', small: cost ? { cost: Math.round(cost / 2 / 1e8) * 1e8, days: Math.round(p.days * 0.7), text: `½ Първи етап: ${p.nm.toLowerCase()}` } : null, kind: 'dom', k: p.k }); }
    // 🤝 споразумения — с най-близките държави без споразумение
    for (const iso of Object.keys(POL).filter(i => i !== me() && !s.deals[i] && rel(i) >= 45).sort((a, b) => rel(b) - rel(a)).slice(0, 2))
      P({ id: `air:deal-${iso}:1`, dir: 'air', ico: '🤝', text: `Елена: ${nm(iso)} е готова за споразумение за сътрудничество (търговия, полети, обмен).`, why: `отношенията са ${Math.round(rel(iso))}/100 — колкото по-високи, толкова по-сигурно приемат`, cost: 0, days: 30, gainTxt: '+10 отношения, достъп за помощ', kind: 'deal', iso, geo: geoOf(iso) });
    // 📦 помощ — за най-нестабилните с нужди (в зона на конфликт — след хуманитарен достъп)
    const needs = [];
    for (const [iso, c] of Object.entries(POL)) for (const n of c.need || []) {
      if ((s.met[iso] || {})[n] || s.aid.some(a => a.iso === iso && a.need === n && !a.done) || rel(iso) < 30) continue;
      const war = CONFLICTS.find(x => x.region === iso && x.k && conf(x.k).step < 2 && conf(x.k).step < 6); if (war) continue;
      if (n === 'rebuild' && !CONFLICTS.some(x => x.region === iso && conf(x.k).step >= 3)) continue;
      needs.push({ iso, n, w: stab(iso) });
    }
    for (const o of needs.sort((a, b) => a.w - b.w).slice(0, 2)) { const A = AID[o.n], cost = Math.round(A.cost * K() / 1e8) * 1e8;
      P({ id: `${A.dir}:aid-${o.iso}-${o.n}:1`, dir: A.dir, ico: NEED[o.n][0], text: `${NAMES[A.dir]}: ${nm(o.iso)} има нужда от ${NEED[o.n][1]}. Предлагам проект „${A.nm}“ — финансиране, доставка, строеж и местен персонал.`, why: `стабилността там е ${Math.round(stab(o.iso))}/100; без издръжка след това проектът угасва (${B(A.up * K())}/месец)`,
        cost, days: A.days, gainTxt: `+стабилност и отношения с ${nm(o.iso)}`, small: { cost: Math.round(cost * 0.5 / 1e8) * 1e8, days: Math.round(A.days * 0.6), text: `½ Споделено финансиране с партньори: ${A.nm.toLowerCase()}` }, kind: 'aid', iso: o.iso, need: o.n, geo: geoOf(o.iso) }); }
    // 🕊️ мирът: следващата стъпка за всеки конфликт
    for (const c of CONFLICTS) { const k = conf(c.k); if (k.step >= 6 || k.wait > d) continue; const st6 = PEACE[k.step], party = c.parties.includes(me());
      const dir = party ? 'def' : k.step >= 3 ? 'pm' : 'air', p = Math.round(chance(c) * 100);
      P({ id: `${dir}:peace-${c.k}-${k.step}:1`, dir, ico: st6.ico, text: party ? `${NAMES[dir]}: ${c.nm} — ние сме страна. Предлагам „${st6.nm}“: решението е наше, но струва доверие у дома.` : `${NAMES[dir]}: ${c.nm} — предлагам следващата стъпка: „${st6.nm}“.`,
        why: `шанс другите да приемат ~${p}%${c.note ? ` · ${c.note}` : ''}${k.step === 2 ? ' · след примирието то трябва да се поддържа' : ''}`, cost: Math.round((k.step >= 3 ? 2e9 : 5e8) * K()), days: 30, gainTxt: k.step === 2 ? '🕊️ прекратяване на огъня' : `стъпка ${k.step + 1} от 6`, kind: 'peace', ck: c.k, geo: geoOf(c.region) }); }
    // 🔧 примирие в опасност — ранно предупреждение
    for (const c of CONFLICTS) { const k = conf(c.k); if (k.step >= 3 && k.step < 6 && k.stab < 45)
      P({ id: `def:hold-${c.k}:1`, dir: 'def', ico: '🔍', text: `Ивайло: примирието в „${c.nm}“ се клати (${Math.round(k.stab)}/100). Предлагам наблюдатели и доставки, за да не рухне.`, why: 'без доставки, възстановяване и доверие договореността става нестабилна', cost: Math.round(3e9 * K()), days: 20, gainTxt: '+30 стабилност на примирието', kind: 'hold', ck: c.k, geo: geoOf(c.region) }); }
    // 🌐 коалиция (от ниво 31)
    if (s.lv >= 31) for (const iso of Object.keys(POL).filter(i => i !== me() && s.deals[i] && !s.coal[i] && rel(i) >= 65).slice(0, 2))
      P({ id: `pm:coal-${iso}:1`, dir: 'pm', ico: '🌐', text: `Десислава: да поканим ${nm(iso)} в коалицията за сигурност и развитие?`, why: 'общата програма разпределя цената на помощта и пази мира', cost: 0, days: 30, gainTxt: 'член на коалицията', kind: 'coal', iso, geo: geoOf(iso) });
    // ⚡ голямото изпитание
    if (s.crisis && !s.crisis.done) for (const [dir, t] of [['fin', 'извънреден фонд'], ['def', 'мисия за стабилизиране'], ['pm', 'среща на върха на коалицията']])
      P({ id: `${dir}:crisis-${s.crisis.k}-${dir}:1`, dir, ico: s.crisis.ico, text: `${NAMES[dir]}: „${s.crisis.nm}“ — предлагам ${t}.`, why: `${s.crisis.txt}; остават ${s.crisis.until - d} дни`, cost: Math.round((dir === 'fin' ? 2e10 : 6e9) * K()), days: 15, gainTxt: 'една стъпка към преодоляването', kind: 'crisis', act: dir });
    return out;
  }
  const geoOf = iso => POL[iso] ? { country: iso, kind: 'district', cities: [{ nm: POL[iso].cap, lat: POL[iso].lat, lon: POL[iso].lon }] } : null;
  function chance(c) {
    const s = st(), k = conf(c.k), parties = c.parties.filter(i => i !== me()), r = parties.length ? parties.reduce((a, i) => a + rel(i), 0) / parties.length : 60;
    const aidIn = s.aid.filter(a => a.done && c.parties.concat(c.region).includes(a.iso)).length, coal = Object.keys(s.coal).length;
    const party = c.parties.includes(me());
    return Math.max(0.08, Math.min(0.92, (party ? 0.55 : 0.3) + r / 250 + aidIn * 0.08 + coal * 0.03 + s.ind.trust / 500 - k.int / 350 - k.step * 0.03));
  }

  // ---- ✅ решение по предложение: 'yes' | 'small' | 'no' | 'later'
  function decide(id, a) {
    const s = st(); if (!s) return null; const p = proposals().find(q => q.id === id); if (!p) return null; const key = id.split(':').slice(0, 2).join(':'), d = day();
    if (a === 'no' || a === 'later') { s.skip[key] = d + (a === 'no' ? 90 : 30); if (a === 'no' && p.kind === 'aid') { s.stab[p.iso] = cl(stab(p.iso) - 3); log(`Отказана помощ за ${nm(p.iso)} — изпусната възможност.`); } deps.save(); return null; }
    const small = a === 'small' && p.small, cost = small ? p.small.cost : p.cost || 0;
    if (cost > s.res) { deps.toast(`💰 Борис: в резерва има ${B(s.res)} — програмата струва ${B(cost)}. Да започнем по-малък етап или да изчакаме.`, 'bad'); return null; }
    s.res -= cost; s.skip[key] = d + 30; if (!s.cab) s.cab = d;
    if (p.kind === 'dom') { const D = DOM.find(x => x.k === p.k); s.progs.push({ id: ++s.seq, k: p.k, dir: p.dir, nm: D.nm, days: small ? p.small.days : D.days, prog: 0, half: !!small }); log(`Започна „${D.nm}“${small ? ' (първи етап)' : ''}.`); }
    else if (p.kind === 'deal') { if (Math.random() < 0.35 + rel(p.iso) / 120 + s.ind.trust / 600) { s.deals[p.iso] = d; s.rel[p.iso] = cl(rel(p.iso) + 10); deps.toast(`🤝 ${nm(p.iso)} подписа споразумението.`, 'good'); log(`Споразумение с ${nm(p.iso)}.`); } else { s.rel[p.iso] = cl(rel(p.iso) - 2); deps.toast(`✖ ${nm(p.iso)} отказа засега — опитай по-късно.`, 'bad'); } }
    else if (p.kind === 'aid') { s.aid.push({ id: ++s.seq, iso: p.iso, need: p.need, stage: 0, prog: 0, days: Math.round((small ? p.small.days : AID[p.need].days) / AID_STAGES.length), up: AID[p.need].up * K() * (small ? 0.5 : 1), shared: !!small, post: CONFLICTS.some(c => c.region === p.iso && conf(c.k).step >= 3) }); log(`Помощ за ${nm(p.iso)}: ${AID[p.need].nm}.`); }
    else if (p.kind === 'peace') { const c = CONFLICTS.find(x => x.k === p.ck), k = s.conf[c.k];
      if (Math.random() < chance(c)) { k.step++; if (k.step === 3) { k.stab = 65; k.held = 0; } if (k.step >= 4) k.stab = Math.min(100, k.stab + 15); k.int = Math.max(0, k.int - 20); for (const i of c.parties) s.rel[i] = cl(rel(i) + 4);
        if (c.parties.includes(me())) s.ind.trust = cl(s.ind.trust - 4);
        deps.toast(`${PEACE[k.step - 1].ico} ${c.nm}: „${PEACE[k.step - 1].nm}“ — приеха!`, 'good'); if (k.step === 3) deps.pop && deps.pop('empire', '🕊️ Прекратяване на огъня', `${c.nm}: оръжията замлъкват. Сега мирът трябва да се поддържа — доставки, възстановяване и наблюдение.`); log(`${c.nm}: ${PEACE[k.step - 1].nm}.`); }
      else { k.wait = d + 30; for (const i of c.parties) if (i !== me()) s.rel[i] = cl(rel(i) - 2); deps.toast(`✖ ${c.nm}: другите страни отказаха „${PEACE[k.step].nm}“ — нов опит след месец.`, 'bad'); log(`${c.nm}: отказ.`); } }
    else if (p.kind === 'hold') { const k = s.conf[p.ck]; k.stab = Math.min(100, k.stab + 30); k.warned = false; }
    else if (p.kind === 'coal') { if (Math.random() < 0.5 + rel(p.iso) / 200) { s.coal[p.iso] = d; deps.toast(`🌐 ${nm(p.iso)} се присъедини към коалицията.`, 'good'); log(`${nm(p.iso)} — в коалицията.`); } else deps.toast(`✖ ${nm(p.iso)} още не е готова за коалицията.`, 'bad'); }
    else if (p.kind === 'crisis') { s.crisis.acts = { ...(s.crisis.acts || {}), [p.act]: d }; if (Object.keys(s.crisis.acts).length >= 3) { s.crisis.done = d; s.crisisDone = d; deps.pop && deps.pop('empire', '⚡ Изпитанието е преодоляно', 'Договореностите оцеляха. Коалицията стои зад теб.'); log('Голямото изпитание е преодоляно.'); } }
    deps.sound && deps.sound('buy'); levels(); deps.save(); return null;
  }

  // ---- 🗓️ ден
  function dailyTick() {
    const s = st(); if (!s) return; const d = day();
    for (const p of [...s.progs]) { p.prog += 1 / p.days; if (p.prog >= 1) { const D = DOM.find(x => x.k === p.k), k = p.half ? 0.5 : 1;
      for (const [e, v] of Object.entries(D.eff)) if (e === 'rel') for (const i of Object.keys(POL)) s.rel[i] = cl(rel(i) + v * k); else s.ind[e] = cl(s.ind[e] + v * k);
      if (D.rev) s.revK = (s.revK || 0) + D.rev; if (!p.half) { const pr = s.prom.find(x => x.k === p.k); if (pr && !pr.done) { pr.done = d; s.ind.trust = cl(s.ind.trust + 4); deps.toast(`✔ Обещанието „${D.nm}“ е изпълнено.`, 'good'); } }
      (s.doneAt = s.doneAt || {})[p.k] = d; s.progs.splice(s.progs.indexOf(p), 1); deps.toast(`${D.ico} ${NAMES[D.dir]}: „${D.nm}“ е готова.`, 'good'); log(`Готова: ${D.nm}.`); } }
    // помощта — по етапи; в несигурен регион може да спре (министърът казва защо)
    for (const a of s.aid) { if (a.done) continue;
      if (!a.stuck && a.stage === 1 && (stab(a.iso) < 30 || rel(a.iso) < 35) && Math.random() < 0.01) { a.stuck = stab(a.iso) < 30 ? 'конвоят е спрян — няма сигурност по пътя' : 'митниците бавят доставката'; deps.toast(`📦 ${nm(a.iso)}: ${a.stuck}.`, 'bad'); }
      if (a.stuck) continue; a.prog += 1 / a.days;
      if (a.prog >= 1) { a.prog = 0; a.stage++; if (a.stage >= AID_STAGES.length) { a.done = d; (s.met[a.iso] = s.met[a.iso] || {})[a.need] = true; s.stab[a.iso] = cl(stab(a.iso) + 15); s.rel[a.iso] = cl(rel(a.iso) + 8);
        deps.toast(`✅ ${nm(a.iso)}: „${AID[a.need].nm}“ работи. Сега трябва издръжка.`, 'good'); log(`Помощта за ${nm(a.iso)} работи.`); } } }
    // мирът — примирията отслабват без поддръжка
    for (const c of CONFLICTS) { const k = s.conf[c.k]; if (k.step < 3 || k.step >= 6) continue; k.held++;
      const aidIn = s.aid.some(a => a.done && c.parties.concat(c.region).includes(a.iso));
      k.stab -= (k.step >= 4 ? 0.06 : 0.16) * (aidIn ? 0.5 : 1) * (s.crisis && !s.crisis.done ? 2 : 1);
      if (k.stab < 40 && !k.warned) { k.warned = true; deps.toast(`⚠️ Примирието в „${c.nm}“ се клати — Ивайло предлага наблюдатели.`, 'bad'); }
      if (k.stab <= 0) { k.step = 1; k.stab = 0; k.int = 70; k.held = 0; k.warned = false; s.ind.trust = cl(s.ind.trust - 6); deps.pop && deps.pop('ship-cargo', '💥 Примирието рухна', `${c.nm}: боевете се подновиха. Нужни са нов контакт и доверие.`); log(`${c.nm}: примирието рухна.`); } }
    // голямото изпитание (след коалицията)
    if (s.lv >= 32 && !s.crisis && !s.crisisDone) { const C = CRISES[Math.floor(Math.random() * CRISES.length)]; s.crisis = { ...C, until: d + 90 }; deps.pop && deps.pop('ship-cargo', `${C.ico} Голямото изпитание`, `${C.nm}: ${C.txt}. Имаш 90 дни: извънреден фонд, мисия и среща на върха.`); }
    if (s.crisis && !s.crisis.done && d > s.crisis.until) { for (const c of CONFLICTS) if (s.conf[c.k].step >= 3) s.conf[c.k].stab = Math.max(0, s.conf[c.k].stab - 30); s.ind.trust = cl(s.ind.trust - 10); s.crisis = null; deps.toast('💥 Кризата не беше овладяна навреме — договореностите пострадаха. Следва ново изпитание.', 'bad'); }
    // месец: бюджет и показатели
    if ((d - s.start) % 30 === 0 && d > s.start) {
      const up = s.aid.filter(a => a.done).reduce((x, a) => x + a.up, 0), inc = free() * (1 + (s.ind.econ - 50) / 150 + (s.revK || 0) * 5);
      s.res += inc - up; if (s.res < 0) { s.ind.trust = cl(s.ind.trust - 3); s.ind.econ = cl(s.ind.econ - 1); }
      for (const e of ['services', 'energy', 'security']) s.ind[e] = cl(s.ind[e] - 0.8);
      if (s.ind.energy < 40) s.ind.econ = cl(s.ind.econ - 1.5);
      const avg = (s.ind.econ + s.ind.services + s.ind.energy + s.ind.security) / 4; s.ind.trust = cl(s.ind.trust + (avg - 58) / 8);
      for (const iso of Object.keys(s.stab)) if (!s.aid.some(a => a.iso === iso && a.done)) s.stab[iso] = cl(s.stab[iso] - 0.5);
    }
    s.streak = Object.values(s.ind).every(v => v >= 60) && s.res >= 0 ? (s.streak || 0) + 1 : 0;
    const allPeace = CONFLICTS.every(c => s.conf[c.k].step >= 5), coal = Object.keys(s.coal).length >= 5;
    s.world = allPeace && coal && s.streak > 0 && s.crisisDone ? (s.world || 0) + 1 : 0;
    levels();
  }
  // ---- 🏅 нивата 27–35 (по постижения)
  const MEETS = {
    27: s => !!s.cab && s.prom.filter(p => p.done).length >= 2,
    28: s => s.streak >= 90,
    29: s => Object.keys(s.deals).length >= 1 && s.aid.some(a => a.done),
    30: s => CONFLICTS.some(c => s.conf[c.k].step >= 3 && s.conf[c.k].held >= 60),
    31: s => s.aid.some(a => a.done && (a.post || a.need === 'rebuild')),
    32: s => Object.keys(s.coal).length >= 5,
    33: s => !!s.crisisDone,
    34: s => CONFLICTS.every(c => s.conf[c.k].step >= 5),
    35: s => s.world >= 360,
  };
  function levels() { const s = st(); if (!s) return; for (let l = (s.lv || 26) + 1; l <= 35; l++) { if (!MEETS[l](s)) break; s.lv = l; log(`Ниво ${l}.`); } }
  const level = () => st()?.lv || 0;

  // ---- 🪟 екранът на президента: Държава · Свят · Министерски съвет
  let el = null, tab = 'state', sel = null;
  const css = `#pres { position:fixed; inset:0; z-index:9780; background:#0b1220; color:#e6edf6; font:500 14px/1.45 system-ui, sans-serif; display:flex; flex-direction:column; }
#pres .tb { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #22304a; flex-wrap:wrap; } #pres h2 { margin:0 auto 0 0; font-size:18px; }
#pres .bd { flex:1; overflow:auto; padding:12px 14px; display:flex; gap:12px; flex-wrap:wrap; align-content:flex-start; } #pres .cd { background:#131d30; border:1px solid #22304a; border-radius:12px; padding:10px 12px; flex:1 1 320px; }
#pres .bar { height:7px; background:#22304a; border-radius:4px; overflow:hidden; margin:3px 0 6px; } #pres .bar i { display:block; height:100%; }
#pres button { background:#1d2a42; color:#e6edf6; border:1px solid #2d3f60; border-radius:9px; padding:6px 10px; cursor:pointer; font:inherit; } #pres button.on, #pres button.y { background:#ffd54a; color:#111; border-color:#ffd54a; }
#pres .m { color:#9fb0c8; font-size:13px; } #pres .map { flex:2 1 560px; }`;
  function open() {
    if (!st()) return; if (!document.getElementById('presCss')) { const c = document.createElement('style'); c.id = 'presCss'; c.textContent = css; document.head.appendChild(c); }
    if (el) el.remove(); el = document.createElement('div'); el.id = 'pres'; document.body.appendChild(el); window.__overlay3d = (window.__overlay3d || 0) + 1; render();
  }
  function close() { if (!el) return; el.remove(); el = null; window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); }
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(v)}%;background:${col || (v >= 60 ? '#3fae6b' : v >= 40 ? '#ffd54a' : '#ff6b6b')}"></i></div>`;
  async function render() {
    if (!el) return; const s = st(), flag = s.cc === 'RU' ? '🇷🇺' : '🇺🇸', ps = proposals();
    let h = `<div class="tb"><h2>${flag} Президентът · ${s.cc === 'RU' ? 'Кремъл' : 'Белият дом'} <span class="m">ниво ${s.lv}</span></h2>${[['state', '🏛️ Държава'], ['world', '🌍 Свят']].map(([k, t]) => `<button data-pt="${k}" class="${tab === k ? 'on' : ''}">${t}</button>`).join('')}<button data-pcab="1" class="y">📋 Министерски съвет (${ps.length})</button><button data-px="1">✕</button></div><div class="bd">`;
    if (tab === 'state') {
      h += `<div class="cd"><b>📊 Държавата</b>${Object.entries(IND).map(([k, [i, n]]) => `<div class="m">${i} ${n}: <b style="color:#e6edf6">${Math.round(s.ind[k])}</b></div>${bar(s.ind[k])}`).join('')}<div class="m">⚖️ Стабилна държава: всичко ≥ 60 и резерв ≥ 0 — ${s.streak}/90 дни</div></div>`;
      h += `<div class="cd"><b>💰 Държавният бюджет</b> <span class="m">(отделен от холдинга)</span><div class="m" style="margin-top:6px">Резерв: <b style="color:${s.res >= 0 ? '#7dffa8' : '#ff8a8a'}">${B(s.res)}</b></div><div class="m">Свободни за нови програми на месец: <b style="color:#e6edf6">${B(free())}</b></div><div class="m">Издръжка на помощта: ${B(s.aid.filter(a => a.done).reduce((x, a) => x + a.up, 0))}/месец</div></div>`;
      h += `<div class="cd"><b>📜 Предизборните обещания</b>${s.prom.map(p => { const D = DOM.find(x => x.k === p.k), run = s.progs.find(x => x.k === p.k); return `<div class="m">${p.done ? '✅' : run ? `⏳ ${Math.round(run.prog * 100)}%` : '⬜'} ${D.ico} ${D.nm}</div>`; }).join('')}</div>`;
      h += `<div class="cd"><b>🏗️ Програми в ход</b>${s.progs.length ? s.progs.map(p => `<div class="m">${DOM.find(x => x.k === p.k).ico} ${p.nm}${p.half ? ' (първи етап)' : ''} — ${NAMES[p.dir]}</div>${bar(p.prog * 100, '#4fc3f7')}`).join('') : '<div class="m">Няма — министрите чакат решенията ти в Министерския съвет.</div>'}</div>`;
      h += `<div class="cd"><b>📰 Хроника</b>${(s.log || []).slice(0, 8).map(x => `<div class="m">ден ${x.d}: ${x.t}</div>`).join('')}</div>`;
    } else {
      const svg = await mapSvg({ cc: s.cc, rel, conf, sel, deal: i => !!s.deals[i], aid: i => s.aid.filter(a => a.iso === i) });
      h += `<div class="cd map">${svg}<div class="m" style="margin-top:6px">🟩 приятелски · ⬜ неутрални · 🟥 враждебни · ⚔️ конфликт · 🕊️ примирие · 🤝 споразумение · 📦 помощ</div></div><div class="cd">${sideHtml()}</div>`;
    }
    el.innerHTML = h + '</div>';
    el.querySelector('[data-px]').onclick = close;
    el.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { tab = b.dataset.pt; render(); });
    el.querySelector('[data-pcab]').onclick = cabinet;
    el.querySelectorAll('[data-pol]').forEach(g => g.onclick = () => { sel = g.dataset.pol; render(); });
    el.querySelectorAll('[data-conf]').forEach(g => g.onclick = () => { sel = 'c:' + g.dataset.conf; render(); });
    el.querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { const [id, a] = b.dataset.pd.split('|'); decide(id, a); render(); });
  }
  function sideHtml() {
    const s = st(), ps = proposals();
    const btns = p => `<div class="m" style="margin:6px 0 2px;color:#e6edf6">${p.ico} ${p.text}</div><div class="m">${p.why}${p.cost ? ` · ${B(p.cost)}` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px"><button class="y" data-pd="${p.id}|yes">✓ Да</button>${p.small ? `<button data-pd="${p.id}|small">½ ${B(p.small.cost)}</button>` : ''}<button data-pd="${p.id}|later">⏳</button><button data-pd="${p.id}|no">✖</button></div>`;
    if (sel && sel.startsWith('c:')) { const c = CONFLICTS.find(x => x.k === sel.slice(2)), k = conf(c.k);
      return `<b>${c.ico} ${c.nm}</b>${c.note ? `<div class="m">ℹ️ ${c.note}</div>` : ''}<div class="m">Страни: ${c.parties.map(nm).join(', ')}</div><div class="m">Интензитет: ${Math.round(k.int)}</div>${PEACE.map((p, i) => `<div class="m">${i < k.step ? '✅' : i === k.step ? '➡️' : '⬜'} ${p.ico} ${p.nm}</div>`).join('')}${k.step >= 3 ? `<div class="m" style="margin-top:4px">Стабилност на примирието: ${Math.round(k.stab)}</div>${bar(k.stab)}` : ''}${ps.filter(p => p.ck === c.k).map(btns).join('')}`; }
    if (sel && POL[sel]) { const c = POL[sel], cf = CONFLICTS.filter(x => x.parties.includes(sel) || x.region === sel);
      return `<b>${c.nm}</b> <span class="m">· столица ${c.cap}</span><div class="m" style="margin-top:6px">🤝 Отношения с теб: ${Math.round(rel(sel))}</div>${bar(rel(sel))}<div class="m">🏛️ Стабилност: ${Math.round(stab(sel))}</div>${bar(stab(sel))}
        <div class="m">Нужди: ${(c.need || []).map(n => `${NEED[n][0]} ${NEED[n][1]}${(s.met[sel] || {})[n] ? ' ✅' : ''}`).join(', ') || 'няма спешни'}</div><div class="m">Конфликти: ${cf.map(x => x.nm).join(', ') || 'няма'}</div><div class="m">Споразумение: ${s.deals[sel] ? `✅ от ден ${s.deals[sel]}` : 'няма'}${s.coal[sel] ? ' · 🌐 в коалицията' : ''}</div>
        ${s.aid.filter(a => a.iso === sel).map(a => `<div class="m">📦 ${AID[a.need].nm}: ${a.done ? '✅ работи' : a.stuck ? `⛔ ${a.stuck}` : `${AID_STAGES[a.stage][1]} ${Math.round(a.prog * 100)}%`}</div>`).join('')}${ps.filter(p => p.iso === sel).map(btns).join('')}`; }
    return `<b>🌍 Светът</b><div class="m">Избери държава или конфликт на картата.</div>${CONFLICTS.map(c => { const k = conf(c.k); return `<div class="m">${k.step >= 3 ? '🕊️' : c.ico} ${c.nm}: ${k.step ? PEACE[k.step - 1].nm : 'боеве'}</div>`; }).join('')}<div class="m" style="margin-top:6px">🌐 Коалиция: ${Object.keys(s.coal).length} държави · 🤝 споразумения: ${Object.keys(s.deals).length}</div>`;
  }
  // 🗳️ съвещателният вот на министрите: всеки гласува по своя ресор и казва защо (последната дума е на президента)
  const WHY = { fin: 'финансирането е в рамката', reg: 'регионите ще усетят разликата', def: 'сигурността не страда', roads: 'пътищата ще го обслужат', rail: 'жп мрежата ще помогне', sea: 'доставките са осигурени', air: 'партньорите ще го оценят', energy: 'енергията стига', pm: 'вписва се в програмата на кабинета' };
  function vote(id) {
    const s = st(), p = proposals().find(q => q.id === id); if (!p) return null; const votes = [];
    for (const d of Object.keys(NAMES)) { let yes = true, cond = false, why = d === p.dir ? (p.why || 'моето предложение') : WHY[d];
      if (d === 'fin' && (p.cost || 0) > s.res * 0.5) { yes = false; why = `изяжда ${Math.round((p.cost || 0) / Math.max(1, s.res) * 100)}% от резерва — предлагам по-малък етап`; }
      else if (d === 'reg' && p.kind === 'aid' && s.ind.services < 50) { yes = false; why = 'нашите болници и жилища още изостават'; }
      else if (d === 'def' && p.kind === 'peace' && s.ind.security < 45) { cond = true; why = 'за, ако първо укрепим собствената си сигурност'; }
      else if (d === 'pm' && p.kind === 'peace') why = 'мирът е целта на кабинета';
      else if (d === 'air' && p.kind === 'aid') why = 'партньорите са готови да поемат част от помощта';
      votes.push({ dir: d, name: NAMES[d], yes, cond, why }); }
    const yes = votes.filter(v => v.yes).length, no = votes.length - yes;
    return { p, v: { votes, yes, no, passed: yes >= no, bank: { ok: (p.cost || 0) <= s.res * 0.5, why: 'резервът ще падне под половината' } } };
  }
  // 📋 Министерският съвет в 3D (directors3d.js openCabinet) — бюджетът от Борис, после министрите
  function cabinet() {
    const s = st(); import('./directors3d.js').then(m => { if (!m.openCabinet) return;
      const brief = { id: `fin:brief:${day()}`, dir: 'fin', ico: '💰', info: true, text: '' };
      m.openCabinet({ cc: s.cc, title: s.cc === 'RU' ? 'Правителството' : 'The Cabinet', brand: { nm: s.cc === 'RU' ? 'Россия' : 'USA', col: s.cc === 'RU' ? '#d52b1e' : '#3c3b6e', ico: '🦅', group: s.cc === 'RU' ? 'Правителство' : 'Белият дом', sub: '· МИНИСТЕРСКИ СЪВЕТ ·' },
        proposals: () => [brief, ...proposals().map(p => ({ ...p, inBudget: (p.cost || 0) <= s.res }))], onDecide: (id, a) => { decide(id, a); render(); return null; },
        voteOn: id => vote(id), onResolve: (id, how) => { decide(id.replace(/\|small$/, ''), how === 'drop' ? 'later' : how === 'small' ? 'small' : 'yes'); render(); return null; },
        speech: () => `Резервът е ${B(s.res)}. За нови програми имаме по ${B(free())} на месец. ${s.res < free() ? 'Предлагам по-малки първи етапи.' : 'Можем да започнем една голяма и няколко малки програми.'}`,
        frame: () => ({ cash: Math.max(0, s.res), reserved: 0, op: REV[s.cc] * (1 - FREE_K), free: Math.max(0, s.res), loan: 0 }),
        summary: () => `Кабинетът продължава. Стабилност ${Math.round(Object.values(s.ind).reduce((a, v) => a + v, 0) / 5)}/100, резерв ${B(s.res)}.`,
        brief: k => ({ fin: `Резервът е ${B(s.res)}.`, pm: `Обещания: ${s.prom.filter(p => p.done).length}/${s.prom.length}. Ниво ${s.lv}.`, def: `Сигурност ${Math.round(s.ind.security)}/100.`, energy: `Енергия ${Math.round(s.ind.energy)}/100.`, reg: `Услуги ${Math.round(s.ind.services)}/100.` })[k] || '' });
    }); }
  return { vote, start, state: st, proposals, decide, dailyTick, level, open, close, cabinet, active: () => !!st() };
}
