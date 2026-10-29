// events.js — събития и кризи: веднъж на ден има шанс да се случи нещо — поскъпване на материал, буря, стачка,
// инспекция, бум на имотите, субсидия, срив или ръст на борсата… Част от тях траят няколко дни.
// game.js чете ефектите през workMul() (скорост на строежите), offerMul() (награди на новите поръчки) и stormy().

import { t as tr } from './i18n.js';

const pick = a => a[(Math.random() * a.length) | 0];
const MAT_UP = ['steel', 'concrete', 'bricks', 'wood', 'glass'];

// всяко събитие: w = тегло; run(ctx) прилага ефекта и връща { title, text, kind, days?, effect? }
export const EVENTS = [
  { id: 'priceUp', w: 3, run: c => {
    const m = pick(MAT_UP), mat = c.MATERIALS[m], k = 1.25 + Math.random() * 0.25, d = 8 + (Math.random() * 6 | 0);
    c.econ.setPriceMod(m, k, d);
    return { ico: '📈', title: `${mat.nm} поскъпва`, text: `Цената на ${mat.nm.toLowerCase()} се вдига с ${Math.round((k - 1) * 100)}% за ${d} дни. Купи по-късно или ползвай склада.`, kind: 'bad', days: d };
  } },
  { id: 'priceDown', w: 2, run: c => {
    const m = pick(['sand', 'gravel', 'concrete', 'bricks', 'wood']), mat = c.MATERIALS[m], k = 0.65 + Math.random() * 0.15, d = 6 + (Math.random() * 5 | 0);
    c.econ.setPriceMod(m, k, d);
    return { ico: '📉', title: `Разпродажба: ${mat.nm.toLowerCase()}`, text: `${mat.nm} е с ${Math.round((1 - k) * 100)}% по-евтин(а) за ${d} дни — добър момент да напълниш склада.`, kind: 'good', days: d };
  } },
  { id: 'storm', w: 2, run: c => ({ ico: '⛈️', title: 'Буря', text: 'Силна буря спира работата по обектите за 1 ден.', kind: 'bad', days: 1, effect: { work: 0, storm: true } }) },
  { id: 'heat', w: 1, season: 'summer', run: c => ({ ico: '🥵', title: 'Жега', text: 'Горещо е — бригадите работят по-бавно (−30%) 3 дни.', kind: 'bad', days: 3, effect: { work: 0.7 } }) },
  { id: 'strike', w: 1, run: c => ({ ico: '✊', title: 'Стачка', text: 'Строителите стачкуват за по-високи заплати — работата върви наполовина 2 дни.', kind: 'bad', days: 2, effect: { work: 0.5 } }) },
  { id: 'motivated', w: 1, run: c => ({ ico: '💪', title: 'Бригадите са в силна форма', text: 'Работата върви 30% по-бързо 3 дни.', kind: 'good', days: 3, effect: { work: 1.3 } }) },
  { id: 'inspection', w: 2, run: c => {
    const ok = Math.random() < 0.55 + c.S.rep * 0.06;
    if (ok) { c.S.rep = Math.min(5, c.S.rep + 0.15); return { ico: '🧑‍💼', title: 'Инспекцията мина отлично', text: 'Строителната инспекция похвали обектите ти. Репутация +0.15 ★.', kind: 'good' }; }
    const fine = Math.round((5000 + Math.random() * 15000) / 500) * 500;
    c.econ.spend(fine, 'глоба', 'Глоба от строителната инспекция');
    return { ico: '🚨', title: 'Глоба от инспекцията', text: `Инспекторите намериха нарушения на обект. Глоба ${c.fmt(fine)} €.`, kind: 'bad' };
  } },
  { id: 'boom', w: 1, run: c => ({ ico: '🏘️', title: 'Бум на имотите', text: 'Търсенето скача — новите поръчки носят 20% повече 7 дни.', kind: 'good', days: 7, effect: { offers: 1.2 } }) },
  { id: 'slump', w: 1, run: c => ({ ico: '🏚️', title: 'Застой на пазара', text: 'Клиентите пестят — новите поръчки носят 15% по-малко 5 дни.', kind: 'bad', days: 5, effect: { offers: 0.85 } }) },
  { id: 'grant', w: 1, run: c => {
    const n = Math.round((15000 + Math.random() * 35000 + c.S.rep * 8000) / 1000) * 1000;
    c.econ.earn(n, 'друго', 'Държавна субсидия за строителство');
    return { ico: '🏛️', title: 'Държавна субсидия', text: `Общината ти отпусна ${c.fmt(n)} € за обновяване на квартала.`, kind: 'good' };
  } },
  { id: 'rally', w: 1, run: c => { c.econ.marketMood(0.03); return { ico: '🚀', title: 'Ръст на борсата', text: 'Инвеститорите са оптимисти — акциите поскъпват няколко дни.', kind: 'good' }; } },
  { id: 'crash', w: 1, run: c => { c.econ.marketMood(-0.04); c.econ.marketShock('строителство', -0.06); return { ico: '💥', title: 'Срив на борсата', text: 'Паника на пазара — акциите (особено строителните) падат.', kind: 'bad' }; } },
  { id: 'tourism', w: 1, run: c => { c.econ.marketShock('туризъм', 0.08); return { ico: '✈️', title: 'Рекорден туристически сезон', text: 'Акциите на туристическите фирми скачат.', kind: 'good' }; } },
];

// deps: { S: () => S, econ: () => econ, MATERIALS, fmt, toast(text, kind, onClick?), season: () => 'summer'|'winter'|'off', show?(ev) }
export function createEvents(deps) {
  const st = () => { const S = deps.S(); S.events = S.events || { active: [], log: [], last: 0 }; return S.events; };
  const active = () => st().active.filter(e => e.until > deps.S().day);
  // множители, които game.js прилага
  const workMul = () => active().reduce((a, e) => a * (e.effect && e.effect.work != null ? e.effect.work : 1), 1);
  const offerMul = () => active().reduce((a, e) => a * (e.effect && e.effect.offers ? e.effect.offers : 1), 1);
  const stormy = () => active().some(e => e.effect && e.effect.storm);
  // веднъж на ден: около 1 събитие на 5 дни (не по-често от през 2 дни)
  function dailyTick(day) {
    const E = st();
    E.active = E.active.filter(e => e.until > day);
    if (day - E.last < 2 || Math.random() > 0.2) return null;
    const S = deps.S(), season = deps.season();
    const pool = EVENTS.filter(e => (!e.season || e.season === season) && !E.active.some(a => a.id === e.id));
    let r = Math.random() * pool.reduce((a, e) => a + e.w, 0), ev = pool[0];
    for (const e of pool) if ((r -= e.w) <= 0) { ev = e; break; }
    const res = ev.run({ S, econ: deps.econ(), MATERIALS: deps.MATERIALS, fmt: deps.fmt });
    const rec = { id: ev.id, ...res, day, until: day + (res.days || 0) };
    if (res.days) E.active.push(rec);
    E.log.unshift(rec); if (E.log.length > 30) E.log.length = 30;
    E.last = day;
    deps.toast(`${res.ico} ${tr(res.title)}: ${tr(res.text)}`, res.kind);   // lang-en: заглавието и текстът — поотделно (сглобени не се намират в речника)
    if (deps.show) deps.show(rec);
    return rec;
  }
  // малък панел с активните събития (за горната лента / офертите)
  function hudHtml() {
    const S = deps.S(); if (!S) return '';
    const a = active();
    if (!a.length) return '';
    return a.map(e => `<span class="evchip ${e.kind}" title="${e.text.replace(/"/g, '&quot;')}">${e.ico} ${e.title} · ${e.until - S.day} д.</span>`).join('');
  }
  return { dailyTick, workMul, offerMul, stormy, hudHtml, active, log: () => st().log };
}
