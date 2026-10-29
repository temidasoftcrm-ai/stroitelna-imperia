// peacewin.js — 🕊️ флаг 'peace-win': „Наследството на империята“ — краят на играта. Ниво 35 само отключва ПОСЛЕДНОТО ИЗПИТАНИЕ; победата се печели отделно:
// пет измерими цели (мир в конфликтите, Световно споразумение с всички блокове, възстановяване, хуманитарна помощ, устойчив бюджет), задържани 12 игрови месеца.
// Парите сами не стигат: конфликтите и подкрепата на блоковете зависят от доверието, сигурността и възстановяването (шансът на мисиите не зависи от цената).
// Победата → рисуваният клип „🕊️ Световен мир“ (cinema.js, сцена 'peace') → личният отчет → „🏅 Архитект на мира“ (Зала на славата, стената на борда) → изборът „Продължи империята“.
// Записът: S.pres.pw = { c6: { конфликт: денят на стъпка 6 }, hold, best, wa, key: [{ d, t }], g: [6 × bool], won, brk } · S.peaceWin = { d, pd, sec, lv, cc } (остава и след президентството) · S.pwArc — историята е показана.
// deps: { S(), pres, coopPres(), cine(), toast, save, pop(k, a, b), sound(n), pause(), lv() → нивото на фирмата, stats() → { cities, finished, countries, conquered, ctot }, auto() → false в тестовете, busy() }
import { feature } from './lab/feature.js';
import { POL, NEED, AID, AID_STAGES, CONFLICTS, PEACE } from './worldpol.js';
import { t as tr } from './i18n.js';

const ON = feature('peace-win');
// ⚙️ праговете — всичко за настройката е тук
export const PW = {
  lockLv: 35,        // от това ниво тече броячът (преди — само преглед)
  confDays: 60,      // 🕊️ конфликтът е на последната стъпка („Гаранции и възстановяване“) поне толкова дни, без нарушено обещание
  blocRel: 60,       // 🤝 средните отношения с всеки блок
  blocMin: 35,       //    и никоя държава от блока под това
  waSec: 55,         //    сигурност у дома (за споразумението и после)
  waTrust: 50,       //    доверие на гражданите
  waFromLv: 33,      //    от кое ниво Десислава предлага Световното споразумение
  blocFromLv: 29,    //    от кое ниво Елена предлага мисиите към блоковете („Международен партньор“)
  blocGain: 10,      //    +отношения при успешна мисия (на всяка държава от блока); 30 дни пауза — за всеки блок поотделно (паралелна дипломация)
  blocFailBack: 0.5, //    неуспешна мисия: губиш времето и половината цена (връща се другата половина); отношенията не падат
  blocCost: 0.15,    //    цената на мисията (× свободните за месец) — малка: успехът не се купува
  rebuild: 0.8,      // 🏗️ възстановяване в засегнатите региони (дял от нуждите им)
  critStab: 30,      // 🍞 критична нужда: стабилност на държавата под това
  holdDays: 360,     // 📅 12 игрови месеца по 30 дни
  graceDays: 10,     // ⏸️ нова случайна криза (бедствие, продоволствена, Ормуз, голямото изпитание) спира брояча за толкова дни, вместо да го нулира
};
// 🤝 големите блокове (от POL; твоята държава не се брои в своя блок)
export const BLOCS = [
  { k: 'west', ico: '🇪🇺', nm: 'Евроатлантическият блок', m: ['USA', 'GBR', 'FRA', 'DEU', 'POL'] },
  { k: 'eurasia', ico: '🌐', nm: 'Евразийският блок', m: ['RUS', 'CHN', 'KAZ', 'IRN'] },
  { k: 'indopac', ico: '🌏', nm: 'Индо-Тихоокеанският блок', m: ['IND', 'JPN', 'KOR', 'IDN'] },
  { k: 'mena', ico: '🕌', nm: 'Близкият изток', m: ['SAU', 'TUR', 'EGY', 'ISR'] },
  { k: 'africa', ico: '🌍', nm: 'Африканският съюз', m: ['ZAF', 'NGA', 'ETH', 'RWA'] },
  { k: 'latam', ico: '🌎', nm: 'Латинска Америка', m: ['BRA', 'MEX'] },
];
// 🍞 държавите с хуманитарни задачи независимо от конфликтите — съдят се по СЕГАШНОТО им състояние: излизат от кризата трайно, щом задачите са изпълнени и стабилността е над прага
export const HUM_FOCUS = { HTI: ['food', 'health', 'transport'], SOM: ['food', 'health', 'transport'] };
const humTasks = iso => [...new Set([...(POL[iso]?.need || []), ...(HUM_FOCUS[iso] || [])])];
const NAMES = { fin: 'Борис', reg: 'Георги', def: 'Ивайло', roads: 'Надя', rail: 'Мария', sea: 'Стефан', air: 'Елена', energy: 'Вера', pm: 'Десислава' };
const ROLE = { fin: 'финанси', reg: 'регионално развитие', def: 'отбрана', roads: 'пътища', rail: 'железници', sea: 'морско дело', air: 'международни връзки', energy: 'енергетика', pm: 'министър-председател' };
const DICO = { fin: '💰', reg: '🏘️', def: '🛡️', roads: '🛣️', rail: '🚆', sea: '⚓', air: '✈️', energy: '⚡', pm: '🏛️' };
// 📜 „Наследството на империята“ — четирите глави
const ARC = [['🏗️', 'Нива 1–20', 'Изгради световен холдинг'], ['🏙️', 'Нива 21–25', 'Превърни Империал сити в пример'], ['🏛️', 'Нива 26–34', 'Спечели доверие като президент'], ['🕊️', 'Ниво 35', 'Постигни устойчив световен мир']];
const KEY_RE = /Споразумение с|споразумение|Мирният пакет|примирие|мирният процес е завършен|коалицията|Помощта за .+ работи|Ормуз|Голямото изпитание|Мисия към|Партньорство|Преизбран|Ниво 3[0-5]\./;
const cl = v => Math.max(0, Math.min(100, v));
const nm = iso => POL[iso]?.nm || iso;
const B = n => { const a = Math.abs(n); return a >= 1e12 ? `${(n / 1e12).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} трлн. €` : a >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 0 })} млн. €`; };

const CSS = `#pwPanel { position:fixed; inset:0; z-index:9795; background:#0b1220; color:#e6edf6; font:500 14px/1.45 system-ui, sans-serif; display:flex; flex-direction:column; }
#pwPanel .tb { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid #22304a; flex-wrap:wrap; } #pwPanel h2 { margin:0 auto 0 0; font-size:18px; }
#pwPanel .bd { flex:1; overflow:auto; padding:12px 14px; display:flex; gap:12px; flex-wrap:wrap; align-content:flex-start; }
#pwPanel .cd { background:#131d30; border:1px solid #22304a; border-radius:12px; padding:10px 12px; flex:1 1 340px; min-width:0; } #pwPanel .cd.ok { border-color:#3fae6b; } #pwPanel .w { flex-basis:100%; }
#pwPanel .bar { height:8px; background:#22304a; border-radius:4px; overflow:hidden; margin:4px 0 6px; } #pwPanel .bar i { display:block; height:100%; }
#pwPanel .m { color:#9fb0c8; font-size:13px; } #pwPanel .v { color:#e6edf6; font-weight:700; }
#pwPanel .why { color:#ffb347; font-size:13px; margin:2px 0; } #pwPanel .fix { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:6px; padding-top:6px; border-top:1px dashed #22304a; }
#pwPanel button, #pwRep button, #pwArc button, #pwChoice button { background:#1d2a42; color:#e6edf6; border:1px solid #2d3f60; border-radius:9px; padding:6px 10px; cursor:pointer; font:inherit; }
#pwPanel button.y, #pwRep button.y, #pwArc button.y, #pwChoice button.y { background:#ffd54a; color:#111; border-color:#ffd54a; font-weight:700; }
#pwPanel button:disabled, #pwChoice button:disabled { opacity:.5; cursor:default; }
#pwPanel .arc, #pwArc .arc { display:flex; gap:8px; flex-wrap:wrap; } #pwPanel .ch, #pwArc .ch { flex:1 1 150px; border:1px solid #2d3f60; border-radius:10px; padding:8px 10px; background:#0f1828; }
#pwPanel .ch.d, #pwArc .ch.d { border-color:#3fae6b; } #pwPanel .ch.c, #pwArc .ch.c { border-color:#ffd54a; box-shadow:0 0 14px rgba(255,213,74,.25); }
#pwPanel .ch b, #pwArc .ch b { display:block; color:#ffd54a; font-size:12px; letter-spacing:.04em; }
#pwArc, #pwRep, #pwChoice { position:fixed; inset:0; z-index:9860; background:radial-gradient(circle at 50% 25%, #1b2b4a, #05080f); color:#f3e7c4; font:500 15px/1.5 system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; overflow:auto; padding:24px 16px; text-align:center; }
#pwArc .box, #pwChoice .box { max-width:760px; width:100%; margin:auto 0; } #pwRep .box { max-width:860px; width:100%; }
#pwArc h1, #pwRep h1, #pwChoice h1 { margin:6px 0 4px; font-size:30px; color:#ffd54a; }
#pwRep .tiles { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin:12px 0; } #pwRep .tl { background:rgba(255,213,74,.08); border:1px solid rgba(255,213,74,.35); border-radius:12px; padding:8px 14px; min-width:120px; }
#pwRep .tl b { display:block; font-size:22px; color:#fff; } #pwRep .tl span { font-size:12px; opacity:.8; }
#pwRep .dec { text-align:left; max-width:640px; margin:0 auto 14px; } #pwRep .dec div { padding:3px 0; border-bottom:1px solid rgba(255,255,255,.08); font-size:14px; }
#pwChoice .opt { display:flex; flex-direction:column; gap:10px; margin:18px auto; max-width:440px; } #pwChoice .opt button { padding:12px 16px; font-size:16px; text-align:left; }
#pwBtn { position:absolute; top:56px; left:50%; transform:translateX(-50%); z-index:6; white-space:nowrap; font:800 14px system-ui, sans-serif; color:#ffd54a; background:rgba(11,18,32,.88); border:1px solid #ffd54a; border-radius:12px; padding:7px 14px; cursor:pointer; box-shadow:0 0 16px rgba(255,213,74,.3); }
#pwBtn:hover { background:#1d2a42; }
#pwBtn small { font-weight:600; color:#9fb0c8; margin-left:6px; }
@media (max-width:600px) { #pwBtn { top:auto; bottom:64px; } }`;

export function createPeaceWin(deps) {
  const NO = { tick() { }, ui() { }, open() { }, close() { }, btnHtml: () => '', lv35: () => false, endBtn: () => false, more: () => [], decide() { }, demo: () => null, goals: () => [], on: false };
  if (!ON) return NO;
  const S = () => deps.S(), st = () => S()?.pres || null, day = () => S()?.day || 0, pres = () => deps.pres;
  const me = s => s.cc === 'RU' ? 'RUS' : 'USA';
  const pw = s => { s.pw = s.pw || { c6: {}, hold: 0, best: 0, key: [] }; s.pw.c6 = s.pw.c6 || {}; s.pw.key = s.pw.key || []; return s.pw; };
  const log = (s, t) => { s.log = [{ d: day(), t }, ...(s.log || [])].slice(0, 40); };
  let styled = false, el = null, focusCab = false;
  const style = () => { if (styled) return; styled = true; const c = document.createElement('style'); c.id = 'pwCss'; c.textContent = CSS; document.head.appendChild(c); };
  const bar = (v, col) => `<div class="bar"><i style="width:${Math.round(cl(v))}%;background:${col || (v >= 100 ? '#3fae6b' : v >= 50 ? '#ffd54a' : '#ff6b6b')}"></i></div>`;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---- 📏 измерването
  const blocStat = (s, b) => { const iso = b.m.filter(i => i !== me(s)), r = iso.map(i => [i, pres().rel(i)]), avg = r.reduce((a, [, v]) => a + v, 0) / Math.max(1, r.length), low = r.reduce((a, x) => x[1] < a[1] ? x : a, ['', 101]);
    return { b, iso, avg: Math.round(avg), low: low[0], lowV: Math.round(low[1]), ok: avg >= PW.blocRel && low[1] >= PW.blocMin }; };
  const ended = s => CONFLICTS.filter(c => (s.conf[c.k]?.step || 0) >= 5).length;
  // засегнатите региони: зоните на конфликтите, държавите с нужда „възстановяване“, мястото на природните бедствия (там — и възстановяване)
  function damaged(s) {
    const m = new Map(), add = (iso, ns) => { if (!POL[iso] || iso === me(s)) return; const x = m.get(iso) || new Set(); for (const n of ns) x.add(n); m.set(iso, x); };
    for (const c of CONFLICTS) add(c.region, POL[c.region]?.need || []);
    for (const [iso, c] of Object.entries(POL)) if ((c.need || []).includes('rebuild')) add(iso, c.need);
    for (const e of s.evs || []) if (e.kind === 'disaster' && e.iso) add(e.iso, [...(POL[e.iso]?.need || []), 'rebuild']);
    for (const [iso, x] of m) if (!x.size) m.delete(iso);
    return m;
  }
  // колко от нуждата е покрито: работещ проект 1; построен, но спрял 0,6; в ход — по етапите (до 0,9); нищо — 0
  function needScore(s, iso, n) {
    if ((s.met[iso] || {})[n]) return { v: 1, a: null };
    const L = s.aid.filter(a => a.iso === iso && a.need === n); if (!L.length) return { v: 0, a: null };
    const a = L.reduce((x, y) => (y.done ? 9 : y.stage + y.prog) > (x.done ? 9 : x.stage + x.prog) ? y : x);
    return { v: a.done ? (a.works !== false ? 1 : 0.6) : Math.min(0.9, (a.stage + a.prog) / AID_STAGES.length), a };
  }
  function balance(s) {
    const F = pres().free(), inc = F * (1 + (s.ind.econ - 50) / 150 + (s.revK || 0) * 5), up = s.aid.filter(a => a.done && a.works !== false).reduce((x, a) => x + a.up, 0);
    const fund = CONFLICTS.reduce((x, c) => { const f = s.conf[c.k]?.fund; return x + (f && f.m > 0 ? f.amt : 0); }, 0), hz = s.hz || {}, hzc = hz.st === 'closed' || hz.st === 'talks' ? F * 0.15 * (hz.alt > day() ? 0.5 : 1) * (hz.div?.done ? 0.5 : 1) : 0;
    return { inc, up, fund, hz: hzc, bal: inc - up - fund - hzc };
  }
  // състоянието на една нужда: 'met' — покрита · 'run' — проект на етап „Доставка“ или по-нататък (или работи) · 'fin' — още във финансиране · 'stop' — спрял · null — няма
  const aidAt = (s, iso, n) => { if ((s.met[iso] || {})[n]) return 'met'; const L = s.aid.filter(a => a.iso === iso && a.need === n); if (L.some(a => a.done ? a.works !== false : a.stage >= 1)) return 'run'; if (L.some(a => !a.done)) return 'fin'; return L.length ? 'stop' : null; };
  const isCrit = (s, iso) => pres().stab(iso) < PW.critStab || (!!HUM_FOCUS[iso] && humTasks(iso).some(n => aidAt(s, iso, n) !== 'met'));
  const cabFix = (dir, txt, f) => ({ dir, txt, go: () => openCab(f || (p => p.dir === dir)) });
  function goals(s) {
    const d = day(), P = pw(s), G = [];
    // 🕊️ 1. всички конфликти — трайни споразумения
    { const rows = CONFLICTS.map(c => { const k = pres().conf(c.k), days = P.c6[c.k] != null ? d - P.c6[c.k] : 0, ok = k.step >= 6 && !k.broken && days >= PW.confDays; return { c, k, days, ok }; }), n = rows.filter(r => r.ok).length;
      const why = [], fix = [];
      for (const r of rows.filter(x => !x.ok)) { const { c, k } = r, party = c.parties.includes(me(s)), dir = party ? 'def' : 'pm';
        why.push(k.step >= 6 ? (k.broken ? tr('{0} {1}: нарушено обещание — доверието трябва да се върне', [c.ico, c.nm]) : tr('{0} {1}: мирът се пази {2}/{3} дни', [c.ico, c.nm, r.days, PW.confDays]))
          : k.step === 5 ? tr('{0} {1}: „Широко споразумение“ — фондът за възстановяване {2}/12 вноски', [c.ico, c.nm, k.fund ? 12 - k.fund.m : 0])
          : k.step >= 3 ? tr('{0} {1}: примирие ({2}/100) — нужен е пакет с проверка и гаранции', [c.ico, c.nm, Math.round(k.stab)])
          : k.step >= 1 ? tr('{0} {1}: „{2}“ — още няма примирие', [c.ico, c.nm, PEACE[k.step - 1].nm]) : tr('{0} {1}: боеве — нужен е първи контакт', [c.ico, c.nm]));
        if (k.step >= 2 && k.step < 5) fix.push({ dir, txt: tr('{0}: мирен пакет за „{1}“', [NAMES[dir], c.nm]), go: () => { close(); pres().openPkg(c.k); } });
        else if (k.step === 5) fix.push(cabFix('fin', tr('Борис: вноските за „{0}“', [c.nm])));
        else if (k.step < 2) fix.push(cabFix(dir, tr('{0}: следващата стъпка в „{1}“', [NAMES[dir], c.nm]), p => p.ck === c.k));
        if (k.step >= 3 && k.step < 6 && k.stab < 45) fix.push(cabFix('def', tr('Ивайло: наблюдатели — примирието се клати'), p => p.kind === 'hold')); }
      G.push({ k: 'conf', ico: '🕊️', nm: tr('Всички конфликти — прекратени с трайни споразумения'), ok: n === CONFLICTS.length, pct: n / CONFLICTS.length * 100, now: tr('{0}/{1} конфликта', [n, CONFLICTS.length]), goal: tr('всички {0} · стъпка „{1}“ поне {2} дни', [CONFLICTS.length, PEACE[PEACE.length - 1].nm, PW.confDays]), why, fix: fix.slice(0, 4) }); }
    // 🤝 2. Световно споразумение, подкрепено от всички големи блокове
    { const bs = BLOCS.map(b => blocStat(s, b)), n = bs.filter(x => x.ok).length, sec = Math.round(s.ind.security), trust = Math.round(s.ind.trust), cond = n === BLOCS.length && sec >= PW.waSec && trust >= PW.waTrust;
      const why = [], fix = [];
      for (const x of bs.filter(q => !q.ok)) why.push(tr('{0} {1}: средно {2} (най-ниско — {3}: {4})', [x.b.ico, x.b.nm, x.avg, nm(x.low), x.lowV]));
      if (sec < PW.waSec) why.push(tr('🛡️ Сигурност у дома: {0} (нужно е {1})', [sec, PW.waSec]));
      if (trust < PW.waTrust) why.push(tr('🤝 Доверие на гражданите: {0} (нужно е {1})', [trust, PW.waTrust]));
      if (!P.wa) why.push(cond ? tr('📜 Всичко е готово — остава подписването') : tr('📜 Споразумението още не е подписано'));
      if (n < BLOCS.length) { if ((s.lv || 0) >= PW.blocFromLv) fix.push(cabFix('air', tr('Елена: мисии към блоковете'), p => p.kind === 'pw' && p.act === 'bloc')); fix.push(cabFix('pm', tr('Десислава: споразумения и коалиция'), p => p.kind === 'deal' || p.kind === 'coal')); }
      if (sec < PW.waSec) fix.push(cabFix('def', tr('Ивайло: програми за сигурност')));
      if (trust < PW.waTrust) fix.push(cabFix('pm', tr('Десислава: доверието у дома'), p => p.dir === 'pm' || p.kind === 'nc' || p.k === 'tax' || p.k === 'audit'));
      if (cond && !P.wa) fix.push({ dir: 'pm', txt: tr('Десислава: свикай световната конференция'), sign: true, go: () => sign() });
      G.push({ k: 'wa', ico: '🤝', nm: tr('Световно споразумение, подкрепено от всички големи блокове'), ok: !!P.wa && cond, pct: (n / BLOCS.length * 70 + (sec >= PW.waSec ? 10 : 0) + (trust >= PW.waTrust ? 10 : 0) + (P.wa ? 10 : 0)), now: tr('{0}/{1} блока · сигурност {2} · доверие {3}{4}', [n, BLOCS.length, sec, trust, P.wa ? tr(' · ✍️ подписано') : '']), goal: tr('всеки блок: средно ≥ {0}, никой под {1} · сигурност ≥ {2} · доверие ≥ {3} · подписано', [PW.blocRel, PW.blocMin, PW.waSec, PW.waTrust]), why, fix, blocs: bs }); }
    // 🏗️ 3. възстановяване > 80% в засегнатите региони
    { const D = damaged(s); let sum = 0, cnt = 0; const miss = [];
      for (const [iso, ns] of D) for (const n of ns) { const r = needScore(s, iso, n); sum += r.v; cnt++; if (r.v < 1) miss.push({ iso, n, r }); }
      const pct = cnt ? sum / cnt * 100 : 100, why = [], dirs = new Set();
      for (const { iso, n, r } of miss.sort((a, b) => a.r.v - b.r.v).slice(0, 5)) { const war = CONFLICTS.some(c => c.region === iso && (s.conf[c.k]?.step || 0) < 2), a = r.a; dirs.add(AID[n].dir);
        why.push(`${NEED[n][0]} ${nm(iso)}: ${tr(AID[n].nm)} — ${a ? (a.wait ? tr('чака: {0}', [a.stuck || a.wait]) : a.done ? tr('спря — няма издръжка') : tr('{0} {1}%', [AID_STAGES[a.stage][1], Math.round(r.v * 100)])) : war ? tr('няма хуманитарен достъп (боеве)') : n === 'rebuild' && !CONFLICTS.some(c => c.region === iso && (s.conf[c.k]?.step || 0) >= 3) && !(s.evs || []).some(e => e.iso === iso && e.kind === 'disaster') ? tr('първо е нужно примирие') : tr('няма проект')}`); }
      if (miss.length > 5) why.push(tr('… и още {0}', [miss.length - 5]));
      G.push({ k: 'reb', ico: '🏗️', nm: tr('Възстановяване над 80% в засегнатите региони'), ok: pct / 100 >= PW.rebuild, pct: pct / PW.rebuild, now: tr('{0}% ({1} държави, {2} нужди)', [Math.round(pct), D.size, cnt]), goal: tr('над {0}%', [Math.round(PW.rebuild * 100)]), why, fix: [...dirs].slice(0, 3).map(dir => cabFix(dir, tr('{0}: проекти за помощ и възстановяване', [NAMES[dir]]), p => p.dir === dir && (p.kind === 'aid' || p.kind === 'aidfix' || (p.kind === 'ev' && p.act === 'rebuild')))) }); }
    // 🍞 4. няма критична хуманитарна криза без помощ (критична държава: стабилност под прага, а Хаити и Сомалия — и докато задачите им не са изпълнени)
    { const crit = [];
      for (const iso of Object.keys(POL)) { if (iso === me(s) || !isCrit(s, iso)) continue;
        for (const n of humTasks(iso)) { const a = aidAt(s, iso, n); if (a === 'met' || a === 'run') continue; crit.push({ iso, n, dir: AID[n].dir, t: `${NEED[n][0]} ${nm(iso)}: ${tr(NEED[n][1])} · ${tr('стабилност {0}', [Math.round(pres().stab(iso))])}${a === 'stop' ? ' · ' + tr('спря — няма издръжка') : a === 'fin' ? ' · ' + tr('още във финансиране') : ''}` }); } }
      for (const e of (s.evs || []).filter(x => !x.done)) { if (Object.keys(e.acts || {}).some(a => a !== 'ban')) continue; crit.push({ ev: e, dir: e.kind === 'disaster' ? 'def' : 'sea', t: `${e.ico} ${e.iso ? tr('{0} — {1}', [e.nm, nm(e.iso)]) : tr(e.nm)}: ${tr('без отговор, остават {0} дни', [Math.max(0, e.until - day())])}` }); }
      const dirs = [...new Set(crit.map(x => x.dir))];
      G.push({ k: 'hum', ico: '🍞', nm: tr('Няма критична хуманитарна криза без помощ'), ok: !crit.length, pct: crit.length ? Math.max(0, 100 - crit.length * 15) : 100, now: crit.length ? tr('{0} без помощ', [crit.length]) : tr('всички — с помощ'), goal: tr('всяка критична нужда (стабилност под {0}; Хаити и Сомалия — докато задачите им не са изпълнени) — с проект поне на етап „Доставка“', [PW.critStab]), why: crit.slice(0, 5).map(x => x.t).concat(crit.length > 5 ? [tr('… и още {0}', [crit.length - 5])] : []), fix: dirs.slice(0, 3).map(dir => cabFix(dir, tr('{0}: спешна помощ', [NAMES[dir]]), p => p.dir === dir && (p.kind === 'aid' || p.kind === 'aidfix' || p.kind === 'ev' || (p.kind === 'pw' && p.act === 'hum')))) }); }
    // 💶 5. устойчив бюджет
    { const b = balance(s), ok = s.res >= 0 && b.bal >= 0, why = [];
      if (s.res < 0) why.push(tr('💰 Резервът е на минус: {0}', [B(s.res)]));
      if (b.bal < 0) why.push(tr('📉 Месечно: приход {0} − издръжка {1} − вноски {2}{3}', [B(b.inc), B(b.up), B(b.fund), b.hz ? tr(' − Ормуз {0}', [B(b.hz)]) : '']));
      G.push({ k: 'bud', ico: '💶', nm: tr('Устойчив бюджет — можеш да финансираш ангажиментите'), ok, pct: ok ? 100 : s.res < 0 ? 20 : 60, now: tr('резерв {0} · баланс {1}/месец', [B(s.res), B(b.bal)]), goal: tr('резерв ≥ 0 и месечен баланс ≥ 0'), why, fix: ok ? [] : [cabFix('fin', tr('Борис: бюджетът'), p => p.dir === 'fin'), cabFix('roads', tr('Надя: икономиката (пътища и мостове)'), p => p.kind === 'dom' && (p.dir === 'roads' || p.dir === 'sea' || p.dir === 'rail'))] }); }
    // 📅 6. всичко горе — 12 месеца
    { const five = G.every(g => g.ok), lvOk = (s.lv || 0) >= PW.lockLv, won = !!S().peaceWin, mo = Math.floor((P.hold || 0) / 30), why = [];
      if (!lvOk) why.push(tr('🔒 Последното изпитание започва на ниво {0} (сега: ниво {1}) — дотогава е преглед', [PW.lockLv, s.lv || 26]));
      else if (!won && !five) why.push(tr('Броячът тече само докато всички пет цели са изпълнени — нова случайна криза го спира за {0} дни, всичко друго го нулира', [PW.graceDays]));
      if (P.best && !won) why.push(tr('Най-дълго досега: {0} дни', [P.best]));
      G.push({ k: 'hold', ico: '📅', nm: tr('Задръж всичко 12 месеца'), ok: won, pct: won ? 100 : (P.hold || 0) / PW.holdDays * 100, now: won ? tr('🏆 постигнато на ден {0}', [S().peaceWin.d]) : P.grace ? tr('⏸️ пауза: {0}/12 месеца ({1} дни) — остават {2} дни за реакция', [mo, P.hold || 0, Math.max(0, P.grace.until - day())]) : lvOk ? tr('{0}/12 месеца ({1} дни)', [mo, P.hold || 0]) : tr('отключва се на ниво {0}', [PW.lockLv]), goal: tr('12 игрови месеца без прекъсване'), why, fix: [] }); }
    return G;
  }

  // ---- 📋 мисиите към блоковете и Световното споразумение (в Министерския съвет — president.js deps.more / pwDecide)
  function chanceBloc(s, x) { return Math.max(0.1, Math.min(0.9, 0.15 + s.ind.trust / 250 + s.ind.security / 300 + ended(s) * 0.06 + Object.keys(s.coal || {}).length * 0.02 - (x.avg < 30 ? 0.1 : 0))); }
  function more() {
    const s = st(); if (!s) return []; const out = [], F = pres().free(), P = pw(s);
    if ((s.lv || 0) >= PW.blocFromLv) for (const x of BLOCS.map(b => blocStat(s, b)).filter(q => !q.ok).sort((a, b) => a.avg - b.avg)) { const p = Math.round(chanceBloc(s, x) * 100), c0 = POL[x.low] || POL[x.iso[0]];
      out.push({ id: `air:pw-bloc-${x.b.k}:1`, dir: 'air', ico: x.b.ico, text: tr('Елена: мисия към „{0}“ — среща на върха, търговски и културни програми. Средните отношения са {1}.', [x.b.nm, x.avg]), why: tr('шанс ~{0}% — зависи от доверието у дома, сигурността и прекратените конфликти ({1}/{2}), не от парите', [p, ended(s), CONFLICTS.length]), cost: Math.round(F * PW.blocCost / 1e8) * 1e8, days: 30, gainTxt: tr('+{0} отношения с блока', [PW.blocGain]), kind: 'pw', act: 'bloc', bloc: x.b.k, geo: c0 ? { country: x.low, kind: 'district', cities: [{ nm: c0.cap, lat: c0.lat, lon: c0.lon }] } : null }); }
    // 🍞 задачите на Хаити и Сомалия (храна, здравеопазване, инфраструктура) — нуждите извън списъка на държавата; по две наведнъж, първо по-нестабилната
    { const K = s.cc === 'RU' ? 0.5 : 1, L = [];
      for (const iso of Object.keys(HUM_FOCUS).sort((a, b) => pres().stab(a) - pres().stab(b))) for (const n of humTasks(iso)) if (!(POL[iso].need || []).includes(n) && aidAt(s, iso, n) === null) L.push([iso, n]);
      for (const [iso, n] of L.slice(0, 2)) { const A = AID[n], c0 = POL[iso];
        out.push({ id: `${A.dir}:pw-hum-${iso}-${n}:1`, dir: A.dir, ico: NEED[n][0], text: tr('{0}: {1} — задача „{2}“. Предлагам проект „{3}“ на етапи: финансиране, доставка, строеж, местен персонал.', [NAMES[A.dir], nm(iso), NEED[n][1], A.nm]), why: tr('стабилност {0}/100 — щом задачите са изпълнени и стабилността е над {1}, кризата там свършва трайно', [Math.round(pres().stab(iso)), PW.critStab]), cost: Math.round(A.cost * K / 1e8) * 1e8, days: A.days, gainTxt: tr('+стабилност в {0}', [nm(iso)]), kind: 'pw', act: 'hum', iso, need: n, geo: { country: iso, kind: 'district', cities: [{ nm: c0.cap, lat: c0.lat, lon: c0.lon }] } }); } }
    if (!P.wa && (s.lv || 0) >= PW.waFromLv && BLOCS.every(b => blocStat(s, b).ok) && s.ind.security >= PW.waSec && s.ind.trust >= PW.waTrust)
      out.push({ id: 'pm:pw-wa:1', dir: 'pm', ico: '📜', text: tr('Десислава: всички големи блокове подкрепят мира. Предлагам световна конференция и подписване на Световното споразумение.'), why: tr('подкрепа от всички блокове, сигурност ≥ {0} и доверие ≥ {1} — иначе някой ще се оттегли', [PW.waSec, PW.waTrust]), cost: Math.round(F * 0.3 / 1e8) * 1e8, days: 30, gainTxt: tr('📜 Световното споразумение'), kind: 'pw', act: 'wa' });
    return out;
  }
  function decide(p) {
    const s = st(); if (!s) return; const P = pw(s);
    if (p.act === 'bloc') { const b = BLOCS.find(x => x.k === p.bloc), x = b && blocStat(s, b); if (!x) return;
      if (Math.random() < chanceBloc(s, x)) { for (const i of x.iso) s.rel[i] = cl(pres().rel(i) + PW.blocGain); log(s, tr('Мисия към „{0}“ — успешна.', [b.nm])); deps.toast(tr('{0} „{1}“: мисията е успешна — +{2} отношения.', [b.ico, b.nm, PW.blocGain]), 'good'); }
      else { const back = Math.round((p.cost || 0) * PW.blocFailBack); s.res += back; log(s, tr('Мисия към „{0}“ — без резултат.', [b.nm])); deps.toast(tr('✖ „{0}“: още не са готови — нужни са повече доверие, сигурност и прекратени конфликти. Нов опит след 30 дни; върнати {1}.', [b.nm, B(back)]), 'bad'); } }
    else if (p.act === 'wa') sign(true);
    else if (p.act === 'hum' && AID[p.need]) { const K = s.cc === 'RU' ? 0.5 : 1; s.aid.push({ id: ++s.seq, iso: p.iso, need: p.need, stage: 0, prog: 0, days: Math.round(AID[p.need].days / AID_STAGES.length), up: AID[p.need].up * K, shared: false, post: false }); log(s, tr('Помощ за {0}: {1}.', [nm(p.iso), AID[p.need].nm])); }
  }
  function sign(viaCab) {
    const s = st(); if (!s) return; const P = pw(s); if (P.wa) return;
    if (!viaCab) { const p = pres().proposals().find(q => q.id === 'pm:pw-wa:1'); if (!p) { deps.toast(tr('📜 Още не всички условия са изпълнени.'), 'bad'); return; } pres().decide(p.id, 'yes'); render(); return; }
    P.wa = day(); log(s, tr('Подписано е Световното споразумение за мир.')); deps.pop && deps.pop('empire', tr('📜 Световното споразумение'), tr('Всички големи блокове подписаха. Сега мирът трябва да се пази — споразумението важи, докато отношенията, сигурността и доверието издържат.')); deps.save();
  }
  function openCab(f) { const was = !!el; close(); try { pres().cabinet(false, f, () => { if (was) open(); }); } catch (e) { console.warn('peace-win cab', e); } }

  // ---- 📅 всеки ден
  function tick() {
    const s = st(); if (!s) return; const P = pw(s), d = day();
    const lost = CONFLICTS.filter(c => P.c6[c.k] != null && (s.conf[c.k]?.step || 0) < 6);   // приключен конфликт, който се поднови
    for (const c of CONFLICTS) { const k = s.conf[c.k]; if (!k) continue; if (k.step >= 6) { if (P.c6[c.k] == null) P.c6[c.k] = d; } else delete P.c6[c.k]; }
    { const have = new Set(P.key.map(x => x.d + '|' + x.t)); for (const x of [...(s.log || [])].reverse()) if (KEY_RE.test(x.t) && !have.has(x.d + '|' + x.t)) { P.key.push({ d: x.d, t: x.t }); have.add(x.d + '|' + x.t); } if (P.key.length > 60) P.key = P.key.slice(-60); }
    const G = goals(s), five = G.slice(0, 5).every(g => g.ok); P.g = G.map(g => g.ok);
    if (!S().peaceWin) { const lvOk = (s.lv || 0) >= PW.lockLv, bad = G.slice(0, 5).find(g => !g.ok);
      if (lvOk && five) { if (P.grace) { deps.toast(tr('✅ Кризата „{0}“ е овладяна навреме — броячът продължава от {1} дни.', [P.grace.nm, P.hold || 0]), 'good'); P.grace = null; }
        P.hold = (P.hold || 0) + 1; P.best = Math.max(P.best || 0, P.hold); if (P.hold % 30 === 0 && P.hold < PW.holdDays) deps.toast(tr('🕊️ Световният мир се държи: {0}/12 месеца.', [P.hold / 30]), 'good'); }
      else if (lvOk && (P.hold || 0) > 0) {   /* ⏸️ нова случайна криза → пауза до graceDays; собствено решение → нулиране веднага */
        const own = ownBreak(s, lost), reset = why => { deps.toast(why, 'bad'); P.hold = 0; P.grace = null; };
        if (own) reset(tr('⚠️ Броячът на мира е нулиран ({0} дни) — твое решение: {1}', [P.hold, own]));
        else if (P.grace) { const left = P.grace.until - d; if (left < 0) reset(tr('⚠️ Кризата „{0}“ не беше овладяна за {1} дни — броячът е нулиран ({2} дни).', [P.grace.nm, PW.graceDays, P.hold])); else if (left === 5 || left === 2) deps.toast(tr('⚠️ Мирът е застрашен — остават {0} дни за реакция · {1}', [left, P.grace.nm]), 'bad'); }
        else { const cr = newCrisis(s, d); if (cr) { P.grace = { until: cr.start + PW.graceDays, nm: cr.nm, k: bad ? bad.k : '' }; deps.toast(tr('⚠️ Мирът е застрашен — остават {0} дни за реакция · {1}', [P.grace.until - d, cr.nm]), 'bad'); }
          else reset(tr('⚠️ Броячът на мира е нулиран ({0} дни): {1}', [P.hold, bad ? bad.nm : ''])); } }
      else { P.hold = 0; P.grace = null; }
      if (P.hold >= PW.holdDays) win(); }
    else if (!five && !P.brk) { P.brk = d; const bad = G.slice(0, 5).find(g => !g.ok); deps.toast(tr('⚠️ Мирът е застрашен: {0}. Победата остава записана — но светът разчита на теб.', [bad ? bad.nm : '']), 'bad'); }
    else if (five) P.brk = 0;
    ui(); if (el) render();
  }

  // собствено решение, което чупи цел: нарушено обещание (пропусната вноска), спряна помощ (неплатена издръжка), бюджет на минус, подновен приключен конфликт
  function ownBreak(s, lost) {
    if (lost && lost.length) return tr('конфликтът „{0}“ се поднови', [lost[0].nm]);
    const c = CONFLICTS.find(x => s.conf[x.k]?.broken); if (c) return tr('нарушено обещание в „{0}“', [c.nm]);
    const a = s.aid.find(x => x.done && x.works === false); if (a) return tr('спряна помощ за {0} (неплатена издръжка)', [nm(a.iso)]);
    if (s.res < 0 || balance(s).bal < 0) return tr('бюджетът е на минус');
    return null;
  }
  // нова случайна криза (започнала преди по-малко от graceDays дни): бедствие или продоволствена криза, голямото изпитание, затворен Ормуз
  function newCrisis(s, d) {
    const L = []; for (const e of (s.evs || []).filter(x => !x.done)) L.push({ start: e.start, nm: `${e.ico} ${e.iso ? tr('{0} — {1}', [e.nm, nm(e.iso)]) : tr(e.nm)}` });
    if (s.crisis && !s.crisis.done) L.push({ start: s.crisis.until - 90, nm: `${s.crisis.ico} ${tr(s.crisis.nm)}` });
    if (s.hz && (s.hz.st === 'closed' || s.hz.st === 'talks') && s.hz.since != null) L.push({ start: s.hz.since, nm: tr('⛔ Ормузкият проток е затворен') });
    return L.filter(x => x.start > d - PW.graceDays).sort((a, b) => b.start - a.start)[0] || null;
  }
  // 🗺️ „Региони за победата“: засегнатите (възстановяване) и хуманитарните (Хаити, Сомалия и всяка критична държава) — със състоянието им
  function regionsHtml(s) {
    const mk = { met: '✅', run: '⏳', fin: '💰', stop: '💔' }, needs = (iso, ns) => ns.map(n => `<span title="${esc(tr(NEED[n][1]))}">${NEED[n][0]}${mk[aidAt(s, iso, n)] || '⬜'}</span>`).join(' ');
    const D = damaged(s), row = (iso, ns, lbl) => `<div class="m" style="margin:2px 0"><b class="v">${nm(iso)}</b> · ${needs(iso, ns)} · ${tr('стабилност {0}', [Math.round(pres().stab(iso))])} — ${lbl}</div>`;
    const reb = [...D].map(([iso, ns]) => { const L = [...ns].map(n => aidAt(s, iso, n)); return row(iso, [...ns], L.every(x => x === 'met') ? tr('✅ възстановена') : L.some(x => x) ? tr('⏳ възстановява се') : tr('⬜ няма проекти')); }).join('');
    const H = [...new Set([...Object.keys(HUM_FOCUS), ...Object.keys(POL).filter(i => i !== me(s) && !D.has(i) && isCrit(s, i))])];
    const hum = H.map(iso => { const L = humTasks(iso).map(n => aidAt(s, iso, n)); return row(iso, humTasks(iso), !isCrit(s, iso) ? tr('✅ излязла от кризата') : L.every(x => x === 'met') ? tr('⏳ задачите са изпълнени — стабилността се възстановява') : L.every(x => x === 'met' || x === 'run') ? tr('⏳ помощта тече') : tr('⚠️ критична — без помощ')); }).join('');
    return `<div class="cd w"><b>🗺️ ${tr('Региони за победата')}</b> <span class="m">✅ ${tr('покрито')} · ⏳ ${tr('в ход')} · 💰 ${tr('финансиране')} · 💔 ${tr('спряло')} · ⬜ ${tr('няма проект')}</span>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px"><div style="flex:1 1 340px"><div class="m"><b>🏗️ ${tr('Възстановяване — засегнатите региони')}</b></div>${reb}</div><div style="flex:1 1 340px"><div class="m"><b>🍞 ${tr('Хуманитарни задачи — критичните държави')}</b></div>${hum}</div></div></div>`;
  }

  // ---- 🔘 бутонът на картата (и в президентския прозорец)
  const count = s => (pw(s).g || goals(s).map(g => g.ok)).filter(Boolean).length;
  function label(s) { const n = count(s), won = !!S().peaceWin, lock = (s.lv || 0) < PW.lockLv; return `<span>🕊️ ${tr('Път към световния мир — {0}/6 цели', [n])}</span>${won ? '<small>🏆</small>' : lock ? `<small>🔒 ${tr('отключва се на ниво {0}', [PW.lockLv])}</small>` : ''}`; }
  function ui() {
    const s = st(), ms = document.getElementById('mapScreen');
    let b = document.getElementById('pwBtn'); if (!s) { b?.remove(); return; } style();
    if (!b && ms) { b = document.createElement('button'); b.id = 'pwBtn'; b.onclick = () => open(); ms.appendChild(b); }
    if (b) { const h = label(s); if (b.dataset.h !== h) { b.dataset.h = h; b.innerHTML = h; } }
    maybeArc();
  }
  const btnHtml = () => { const s = st(); return s ? `<button data-ppw="1">🕊️ ${tr('Към мира: {0}/6', [count(s)])}</button>` : ''; };

  // ---- 🪟 панелът „Път към световния мир“
  function arcHtml(cls) {
    const s = st(), Sx = S(), done = [(deps.lv ? deps.lv() : 0) >= 20 || (Sx.imp?.lv || 0) >= 21 || !!s, (Sx.imp?.lv || 0) >= 25 || !!s, (s?.lv || 0) >= 34 || !!Sx.peaceWin, !!Sx.peaceWin], cur = done.indexOf(false);
    return `<div class="${cls}">${ARC.map(([i, l, t], k) => `<div class="ch${done[k] ? ' d' : k === cur ? ' c' : ''}"><b>${done[k] ? '✅' : k === cur ? '➡️' : '⬜'} ${tr(l)}</b>${i} ${tr(t)}</div>`).join('')}</div>`;
  }
  function render() {
    if (!el) return; const s = st(); if (!s) { close(); return; } const G = goals(s), P = pw(s), lock = (s.lv || 0) < PW.lockLv, won = S().peaceWin, n = G.filter(g => g.ok).length, fixes = [];
    let h = `<div class="cd w"><b>📜 ${tr('Наследството на империята')}</b>${arcHtml('arc')}</div>`;
    h += `<div class="cd w${won ? ' ok' : ''}">${won ? `<b style="color:#7dffa8">🏆 ${tr('Световният мир е постигнат на ден {0}', [won.d])}</b><div class="m">${tr('Продължаваш империята — мирът трябва да се пази. Ако условията се нарушат, ще те предупредим; победата остава записана.')}</div><div class="fix"><button class="y" data-pwrep="1">📜 ${tr('Отчетът')}</button><button data-pwcine="1">🎬 ${tr('Гледай пак')}</button></div>`
      : lock ? `<b>🔒 ${tr('Последното изпитание се отключва на ниво {0}', [PW.lockLv])}</b> <span class="m">${tr('(сега: ниво {0}) — това е преглед на целите', [s.lv || 26])}</span><div class="m">${tr('Нивото само отваря изпитанието. Победата: пет цели, задържани 12 игрови месеца. Парите сами не стигат — мирът зависи от сигурността, доверието и възстановяването.')}</div>`
      : `<b>⚖️ ${tr('Последното изпитание: {0}/6 цели', [n])}</b><div class="m">${tr('Задръж първите пет цели едновременно 12 игрови месеца. Ако една падне, броячът се нулира — освен при нова случайна криза: тогава е на пауза {0} дни.', [PW.graceDays])}</div>${bar((P.hold || 0) / PW.holdDays * 100, '#4fc3f7')}<div class="m">📅 ${tr('{0}/12 месеца · {1}/{2} дни', [Math.floor((P.hold || 0) / 30), P.hold || 0, PW.holdDays])}</div>${P.grace ? `<div class="why" style="font-size:14px;margin-top:6px">⏸️ <b>${tr('Броячът е на пауза — остават {0} дни за реакция', [Math.max(0, P.grace.until - day())])}</b> · ${P.grace.nm}</div><div class="m">${tr('Овладей кризата навреме и броячът продължава от натрупаното; иначе се нулира. Собствено решение (нарушено обещание, спряна помощ, бюджет на минус) нулира веднага.')}</div>` : ''}`}</div>`;
    h += regionsHtml(s);
    for (const g of G) {
      h += `<div class="cd${g.ok ? ' ok' : ''}"><b>${g.ok ? '✅' : '⬜'} ${g.ico} ${g.nm}</b><div class="m">${tr('Сега:')} <span class="v">${g.now}</span></div><div class="m">${tr('Цел:')} ${g.goal}</div>${bar(g.pct)}`;
      if (g.blocs) h += `<div class="m" style="margin:2px 0 4px">${g.blocs.map(x => `<span title="${esc(x.iso.map(nm).join(', '))}" style="display:inline-block;margin:2px 8px 2px 0">${x.ok ? '✅' : '⬜'} ${x.b.ico} ${x.avg}</span>`).join('')}</div>`;
      if (!g.ok) h += g.why.map(w => `<div class="why">⚠️ ${w}</div>`).join('');
      if (!g.ok && g.fix.length) h += `<div class="fix"><span class="m">💡 ${tr('Кой може да предложи решение:')}</span>${g.fix.map(f => { fixes.push(f); return `<button ${f.sign ? 'class="y" ' : ''}data-pwfix="${fixes.length - 1}" title="${esc(tr(ROLE[f.dir]))}">${DICO[f.dir]} ${f.txt}</button>`; }).join('')}</div>`;
      h += '</div>';
    }
    // 🌐 coop-pres: целите на партньора (само показване, от снимката)
    let q = null; try { q = deps.coopPres?.()?.partner?.(); } catch { }
    if (q?.p?.pw) { const pg = q.p.pw.g || []; h += `<div class="cd w"><b>🌐 ${tr('Партньорът')} <span data-noi18n>${esc(q.name)}</span>: ${tr('{0}/6 цели · {1}/12 месеца', [pg.filter(Boolean).length, q.p.pw.m])}${q.p.pw.won ? ' · 🏆' : ''}</b><div class="m">${G.map((g, i) => `<span style="display:inline-block;margin:2px 10px 2px 0">${pg[i] ? '✅' : '⬜'} ${g.ico}</span>`).join('')}</div><div class="m">${tr('Общите мирни стъпки и договорите важат и за двамата; победата е на всеки поотделно.')}</div></div>`; }
    el.querySelector('.bd').innerHTML = h; el.querySelector('h2 .n').textContent = `${n}/6`;
    el.querySelectorAll('[data-pwfix]').forEach(b => b.onclick = () => { const f = fixes[+b.dataset.pwfix]; if (f) f.go(); });
    el.querySelectorAll('[data-pwrep]').forEach(b => b.onclick = () => report());
    el.querySelectorAll('[data-pwcine]').forEach(b => b.onclick = () => { clearAll(); try { deps.cine()?.play('peace', true); } catch { } });
  }
  function open() {
    if (!st()) return; style();
    if (!el) { el = document.createElement('div'); el.id = 'pwPanel'; el.innerHTML = `<div class="tb"><h2>🕊️ ${tr('Път към световния мир')} · <span class="n"></span></h2><button data-pwx="1">✕</button></div><div class="bd"></div>`; document.body.appendChild(el); el.querySelector('[data-pwx]').onclick = close; window.__overlay3d = (window.__overlay3d || 0) + 1; }
    render();
  }
  function close() { if (!el) return; el.remove(); el = null; window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); }
  const clearAll = () => { close(); try { pres().close(); } catch { } try { deps.coopPres?.()?.close?.(); } catch { } };   // клипът (#cine, z 300) е под президентските прозорци

  // ---- 📜 историята — веднъж, при влизането в политиката
  function arc(manual) {
    style(); document.getElementById('pwArc')?.remove(); const Sx = S(); if (!manual) { Sx.pwArc = Sx.day || 1; deps.save(); }
    const d = document.createElement('div'); d.id = 'pwArc';
    d.innerHTML = `<div class="box"><div style="font-size:14px;letter-spacing:.3em;color:#ffd54a">📜 ${tr('НАСЛЕДСТВОТО НА ИМПЕРИЯТА')}</div><h1>${tr('От една бригада до световен мир')}</h1><div style="opacity:.85;margin:0 0 14px">${tr('Четири глави. Последната не се печели с пари — а с доверие, сигурност и възстановяване.')}</div>${arcHtml('arc')}<div style="opacity:.8;margin:14px 0">${tr('Ниво 35 отключва последното изпитание: шест цели, а петте от тях — задържани 12 игрови месеца. Бутонът „🕊️ Път към световния мир“ на картата показва докъде си и кой министър може да помогне.')}</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button data-pwgo="1">🕊️ ${tr('Път към световния мир')}</button><button class="y" data-pwok="1">▶ ${tr('Продължи')}</button></div></div>`;
    document.body.appendChild(d); window.__overlay3d = (window.__overlay3d || 0) + 1;
    const x = () => { d.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); };
    d.querySelector('[data-pwok]').onclick = x; d.querySelector('[data-pwgo]').onclick = () => { x(); open(); };
  }
  let arcWait = 0;
  function maybeArc() { const Sx = S(); if (!Sx?.pres || Sx.pwArc || arcWait || (deps.auto && !deps.auto())) return; arcWait = setInterval(() => { const y = S(); if (!y?.pres || y.pwArc) { clearInterval(arcWait); arcWait = 0; return; } if (deps.busy?.() || document.getElementById('polIntro') || document.getElementById('pwArc')) return; clearInterval(arcWait); arcWait = 0; arc(false); }, 1500); }

  // ---- 🏆 победата: клипът → отчетът → церемонията → изборът
  function win() {
    const s = st(), Sx = S(); if (!s || Sx.peaceWin) return; const P = pw(s), d = day();
    Sx.peaceWin = { d, pd: d - (s.start || 0), sec: Math.round(Sx.play?.sec || 0), est: !!Sx.play?.est, lv: s.lv, cc: s.cc };
    P.won = d; P.g = goals(s).map(g => g.ok); log(s, tr('🕊️ Световен мир — шестте цели са задържани 12 месеца.'));
    Sx.hold = Sx.hold || { lv: {}, dir: {} }; Sx.hold.awards = Sx.hold.awards || {}; Sx.hold.awards.peace = { tier: 'platinum', day: d, res: tr('Световен мир на ден {0}', [d]) };
    deps.save(); try { deps.pause && deps.pause(); } catch { } clearAll();
    sequence();
  }
  function sequence() {
    let c = null; try { c = deps.cine?.(); } catch { }
    const after = () => report();
    if (!c) { after(); return; }
    Promise.resolve(c.play('peace', true)).then(ok => { if (!ok) { after(); return; } const iv = setInterval(() => { if (!c.playing()) { clearInterval(iv); setTimeout(after, 500); } }, 400); }).catch(after);
  }
  function report() {
    const s = st(), Sx = S(), W = Sx.peaceWin; if (!W) return; style(); close(); document.getElementById('pwRep')?.remove();
    let x = {}; try { x = deps.stats ? deps.stats() || {} : {}; } catch { }
    const P = s ? pw(s) : { key: [] }, D = s ? damaged(s) : new Map(); let rb = 0; if (s) for (const [iso, ns] of D) if ([...ns].every(n => needScore(s, iso, n).v >= 1)) rb++;
    const hrs = Math.floor((W.sec || 0) / 3600), min = Math.floor((W.sec || 0) % 3600 / 60), real = W.sec ? `${W.est ? '~' : ''}${hrs ? tr('{0} ч {1} мин', [hrs, min]) : tr('{0} мин', [min])}` : '—';
    const key = (P.key || []).slice().sort((a, b) => a.d - b.d), pick = key.length > 8 ? [...key.slice(0, 3), ...key.slice(-5)] : key;
    const tiles = [[`${x.cities ?? '—'}`, tr('града построени')], [`${x.finished ?? '—'}`, tr('града завършени')], [`${x.countries ?? '—'}`, tr('свързани държави')], [`${x.conquered ?? '—'}${x.ctot ? '/' + x.ctot : ''}`, tr('завладени държави')], [`${rb}/${D.size}`, tr('възстановени региона')], [`${W.d}`, tr('игрови дни до победата')], [`${W.pd}`, tr('дни като президент')], [real, tr('реално време за игра')]];
    const d = document.createElement('div'); d.id = 'pwRep';
    d.innerHTML = `<div class="box"><div style="font-size:14px;letter-spacing:.3em;color:#ffd54a">🏁 ${tr('ЛИЧЕН ОТЧЕТ')}</div><h1>🕊️ ${tr('Световен мир')}</h1><div style="opacity:.85">${tr('Започна с една бригада. Остави свят в мир.')}</div>
      <div class="tiles">${tiles.map(([v, l]) => `<div class="tl"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
      <div style="opacity:.85;margin:0 0 6px">📰 ${tr('Най-важните решения')}</div><div class="dec">${pick.length ? pick.map(k => `<div>${tr('ден {0}', [k.d])}: ${tr(k.t)}</div>`).join('') : `<div>${tr('Хрониката е празна.')}</div>`}</div>
      <div style="margin:0 0 14px">🏅 <b style="color:#ffd54a">${tr('Архитект на мира')}</b> — ${tr('платинената награда е на стената в залата на борда, а клипът — в „🎬 Албум“.')}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button data-pwfame="1">🏅 ${tr('Церемонията')}</button><button class="y" data-pwnext="1">${tr('Напред')} ▶</button></div></div>`;
    document.body.appendChild(d); window.__overlay3d = (window.__overlay3d || 0) + 1; deps.sound && deps.sound('levelup');
    const x2 = () => { d.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); };
    d.querySelector('[data-pwnext]').onclick = () => { x2(); if (!pw(st() || {}).chosen) choice(); };
    d.querySelector('[data-pwfame]').onclick = () => { x2(); import('./halloffame.js').then(m => { if (!m.openHallOfFame({ k: 'peace', tier: 'platinum', onClose: () => { if (!pw(st() || {}).chosen) choice(); } })) choice(); }).catch(() => choice()); };
  }
  function choice() {
    style(); document.getElementById('pwChoice')?.remove(); const d = document.createElement('div'); d.id = 'pwChoice';
    d.innerHTML = `<div class="box"><h1>🕊️ ${tr('Какво следва?')}</h1><div style="opacity:.85">${tr('Записът ти остава — победата е записана завинаги.')}</div><div class="opt">
      <button class="y" data-pwc="go">▶ ${tr('Продължи империята')}<div style="font-size:13px;font-weight:500">${tr('Свободна игра. Мирът трябва да се пази — ако условията се нарушат, ще получиш предупреждение.')}</div></button>
      <button disabled>🗓️ ${tr('Седмично предизвикателство — скоро')}</button><button disabled>🏁 ${tr('Сезонна надпревара — скоро')}</button></div></div>`;
    document.body.appendChild(d); window.__overlay3d = (window.__overlay3d || 0) + 1;
    d.querySelector('[data-pwc="go"]').onclick = () => { const s = st(); if (s) pw(s).chosen = day(); deps.save(); d.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); deps.toast(tr('▶ Империята продължава. Пази мира!'), 'good'); };
  }

  // ниво 35 (president.js levels → deps.lv35): вместо края на играта — последното изпитание
  function lv35() { const s = st(); if (!s) return false; deps.pop && deps.pop('empire', tr('🕊️ Последното изпитание'), tr('Ниво 35 е твое — но светът още не е в мир. Задръж петте цели 12 месеца: трайни споразумения, Световното споразумение, възстановяване, помощ и устойчив бюджет.')); setTimeout(open, 2500); return true; }
  const endBtn = () => { if (S().peaceWin) report(); else open(); return true; };

  // 🧪 Лабораторията (__dbg.pwTest): 'panel30' — ниво 30, 4/6 · 'trial35' — ниво 35, петте изпълнени, броячът тече · 'win' — последният ден → клипът и отчетът · 'report' · 'choice' · 'arc'
  function demo(mode = 'panel30') {
    const s = st(), Sx = S(); if (!s) return null; const P = pw(s), F = pres().free();
    if (mode === 'arc') { arc(true); return { arc: true }; }
    if (mode === 'choice') { choice(); return { choice: true }; }
    delete Sx.peaceWin; P.won = 0; P.hold = 0; P.brk = 0; P.wa = 0; P.chosen = 0; P.grace = null;
    if (Sx.day < 1460) Sx.day = 1460;   // демото: четири години игра (иначе хрониката е в отрицателни дни)
    const d = day(); s.start = Math.min(s.start, d - 900); s.termStart = d - 300;
    s.lv = mode === 'panel30' ? 30 : 35; s.finale = d; s.crisisDone = d - 200; s.crisis = null; s.evs = [{ id: 1, kind: 'food', ico: '🌾', nm: 'Световна продоволствена криза', start: d - 700, until: d - 580, acts: { ship: d - 690, local: d - 650 }, done: d - 640 }]; s.disNext = d + 999;   /* без нови кризи по време на демото */ s.hz = { st: 'safe', ship: 100, res: 90, talk: 2, esc: d + 400, agree: d - 300 };
    s.ind = { econ: 64, services: 61, energy: 63, security: 62, trust: 61 }; s.res = F * 4; s.nc = null; s.lowT = 0;
    for (const c of CONFLICTS) { s.conf[c.k] = { step: 6, stab: 82, int: 0, wait: 0, held: 300, ver: 2, gua: 2 }; P.c6[c.k] = d - 120; }
    for (const iso of Object.keys(POL)) for (const n of humTasks(iso)) { if (iso === 'HTI' && n === 'housing' || mode === 'panel30' && iso === 'SOM' && n === 'transport') continue; (s.met[iso] = s.met[iso] || {})[n] = true; }
    s.aid = [{ id: ++s.seq, iso: 'HTI', need: 'housing', stage: 1, prog: 0.4, days: 35, up: 2e7 }, ...(mode === 'panel30' ? [{ id: ++s.seq, iso: 'SOM', need: 'transport', stage: 2, prog: 0.3, days: 38, up: 1e8 }] : [{ id: ++s.seq, iso: 'UKR', need: 'rebuild', stage: 4, prog: 0, days: 50, up: 3e8, done: d - 200, works: true, post: true }])];   /* на ниво 30 — без работещ проект, иначе нивата 31–34 се вдигат сами */
    for (const iso of Object.keys(POL)) s.rel[iso] = Math.max(pres().rel(iso), 66);
    for (const iso of ['USA', 'GBR', 'FRA', 'DEU', 'POL', 'JPN', 'KOR', 'IND', 'SAU', 'TUR', 'ZAF', 'BRA']) s.deals[iso] = s.deals[iso] || d - 500;
    for (const iso of ['GBR', 'FRA', 'DEU', 'JPN', 'KOR', 'IND']) s.coal[iso] = s.coal[iso] || d - 400;
    if (mode === 'panel30') { s.rel.RUS = 28; s.rel.IRN = 22; s.rel.CHN = 47; s.ind.security = 52; }   // 🤝 Евразийският блок още не подкрепя → 4/6
    else P.wa = d - 160;
    const L = [[d - 860, 'Встъпване в длъжност. Кабинетът е съставен.'], [d - 700, 'Споразумение с Германия.'], [d - 610, 'Войната в Украйна: Широко споразумение.'], [d - 540, 'Ормуз: споразумение за безопасно корабоплаване.'], [d - 480, 'Великобритания — в коалицията.'], [d - 420, 'Помощта за Украйна работи: основните услуги работят отново.'], [d - 330, 'Голямото изпитание е преодоляно.'], [d - 260, 'Близкоизточният конфликт: мирният процес е завършен.'], [d - 200, 'Мисия към „Евразийският блок“ — успешна.'], [d - 160, 'Подписано е Световното споразумение за мир.']];
    s.log = L.filter(([x]) => mode !== 'panel30' || x < d - 160).map(([x, t]) => ({ d: x, t })).reverse(); P.key = [];
    if (mode === 'trial35') { tick(); P.hold = 150; P.best = 150; }
    else if (mode === 'crisis35') { tick(); P.hold = 150; P.best = 150; s.evs.push({ id: 2, kind: 'disaster', ico: '🌋', nm: 'Опустошително земетресение', iso: 'TUR', start: d - 3, until: d + 87 }); s.stab.TUR = cl(pres().stab('TUR') - 20); tick(); }   /* ⏸️ нова криза преди 3 дни → броячът е на пауза, остават 7 дни */
    else if (mode === 'win') { tick(); P.hold = PW.holdDays - 1; tick(); return { won: !!Sx.peaceWin, award: Sx.hold?.awards?.peace || null, goals: pw(s).g }; }
    else if (mode === 'report') { tick(); P.hold = PW.holdDays - 1; const c = deps.cine; deps.cine = () => null; tick(); deps.cine = c; return { won: !!Sx.peaceWin }; }
    else tick();
    deps.save(); ui(); open(); return { lv: s.lv, goals: goals(s).map(g => [g.k, g.ok, g.now]), n: count(s), hold: P.hold, btn: document.getElementById('pwBtn')?.innerText || null };
  }

  return { on: true, tick, ui, open, close, btnHtml, lv35, endBtn, more, decide, demo, goals: () => st() ? goals(st()) : [], report, choice, arc: () => arc(true), PW, BLOCS };
}
