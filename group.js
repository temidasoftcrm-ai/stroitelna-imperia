// group.js — корпоративната група: при старта играчът сам дава името на фирмата (и избира цвят/знак от 5-те стила);
// с всеки нов бизнес се основава дъщерно дружество („… Толроуд“, „… Рейл“, „… Оушън Експрес“, „… Флайеър“…). Старите продължават да печелят.
// Записът: S.brand = 'titan' (стилът), S.brandNm = 'Име' (по желание — иначе името на стила), S.group = { [sub]: денят на основаването }.
import { feature } from './lab/feature.js';
import { createDirEvents } from './direvents.js';   // настроение, последици от „Не“, събития (стачка, примамване, скандал, награда)

export const BRANDS = [
  { k: 'industrial', nm: 'Индустриал', col: '#ff9a2e', ico: '⚙️' },
  { k: 'titan', nm: 'Титан', col: '#4fc3f7', ico: '🗿' },
  { k: 'atlas', nm: 'Атлас', col: '#7dffa8', ico: '🌐' },
  { k: 'horizon', nm: 'Хоризон', col: '#ffd54a', ico: '🌅' },
  { k: 'imperial', nm: 'Империал', col: '#e57cff', ico: '👑' },
];
// дъщерните дружества по реда на отключване; open(c) → кога се основава, inc(c) → приход на ден, how — какво трябва
// логата на дружествата (assets/ui/subs/<k>.webp, от потребителя); незаснованото — сиво
// неоснованите в холдинга — замъглени цели (winHtml); готовите за основаване — ясни
export const subLogo = (k, px = 32, on = true) => `<img src="assets/ui/subs/${k}.webp" alt="" style="width:${px}px;height:${px}px;object-fit:contain;flex-shrink:0;${on ? '' : 'filter:grayscale(1);opacity:.55'}">`;
// нивото на фирмата, от което дружеството може да се отвори (за „🔒 ниво N“ в холдинга)
export const SUB_LV = { con: 1, hw: 2, rail: 2, sea: 6, air: 9, hotel: 15, oil: 16, bank: 17, glob: 20 };
export const SUBS = [
  { k: 'con', ico: '🏗️', suf: 'Констръкшън', what: 'строителство', how: 'от началото', open: () => true, inc: c => c.finDaily() },
  { k: 'hw', ico: '🛣️', suf: 'Толроуд', what: 'магистрали и тол', how: 'първата готова магистрала', open: c => c.hwN() > 0, inc: c => c.toll() },
  { k: 'rail', ico: '🚆', suf: 'Рейл', what: 'железници', how: 'първата готова жп линия', open: c => c.railN() > 0, inc: c => c.flow('rail') },
  { k: 'sea', ico: '🚢', suf: 'Оушън Експрес', what: 'кораби и пристанища', how: 'първото пристанище', open: c => c.portN() > 0, inc: c => c.flow('sea') },
  { k: 'air', ico: '✈️', suf: 'Флайеър', what: 'авиация', how: 'първото летище', open: c => c.airN() > 0, inc: c => c.flow('air') },
  { k: 'hotel', ico: '🏨', suf: 'Хотелс', what: 'хотели по света', how: 'офис ниво 10 в някой град (ерата на холдинга)', open: c => (c.hotelN ? c.hotelN() : 0) > 0, inc: c => c.hotelDaily ? c.hotelDaily() : 0 },
  { k: 'oil', ico: '🛢️', suf: 'Петролиум', what: 'петрол и гориво', how: 'първото петролно находище (Азия)', open: c => c.oilN() > 0, inc: c => c.oilDaily() },
  { k: 'bank', ico: '🏦', suf: 'Банк', what: 'банка и кредити', how: 'основи банката (ерата на холдинга)', open: c => !!(c.bankOn && c.bankOn()), inc: c => c.bankDaily ? c.bankDaily() : 0 },
  { k: 'glob', ico: '🌍', suf: 'Глобъл Ризортс & Констръкшън', what: 'световна империя', how: 'ниво 20 — Световна империя', open: c => c.empire(), inc: () => 0, final: true },
];
// фаза „основаване“ (нови игри — S.foundFirst): дъщерната фирма се основава ръчно ПРЕДИ първия обект в бранша и дава стартов пакет;
// останалото се купува, за да започнеш (магистрала: асфалтополагач + валяк подарък, грейдер/булдозер/маркировъчна — купуваш сам)
export const FOUND = {
  hw: { cost: 150000, lv: 2, gift: '🛣️ асфалтополагач и 🛞 валяк (подарък)', next: 'Купи грейдер, булдозер и маркировъчна машина — и строй първата магистрала.' },
  rail: { cost: 300000, lv: 2, gift: '🚂 първия товарен влак (подарък, след като построиш гара)', next: 'Построй гара в града и първата жп линия.' },
  sea: { cost: 500000, lv: 6, gift: '⚓ −50% за първото пристанище и 🚢 първия кораб (подарък)', next: 'Построй пристанище в крайморски град.' },
  air: { cost: 800000, lv: 9, gift: '✈️ −50% за първото летище и първия самолет (подарък)', next: 'Построй летище.' },
};
export const brandOf = S => { const b = BRANDS.find(x => x.k === S?.brand); return b ? (S.brandNm ? { ...b, nm: S.brandNm } : b) : null; };
// името, което играчът пише: без знаци за HTML, до 24 знака, с главна буква
export const cleanBrand = s => { const t = String(s || '').replace(/[<>"'&`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
export const subName = (S, k) => { const b = brandOf(S), s = SUBS.find(x => x.k === k); return b && s ? `${b.nm} ${s.suf}` : ''; };
// името на групата горе: една фирма — „Титан Констръкшън“; повече — „Титан Груп“; накрая — „Титан Глобъл“
export function groupName(S) {
  const b = brandOf(S); if (!b) return '';
  const g = S.group || {}; if (g.glob) return `${b.nm} Глобъл`;
  return Object.keys(g).length > 1 ? `${b.nm} Груп` : `${b.nm} Констръкшън`;
}

// 🏛️ Ерата на холдинга (ниво 15): всяко дружество има ниво на развитие (+10% от прихода му на ниво, до 5) и директор (+15%).
// Бонусът се изплаща всеки ден като приход на холдинга. Записът: S.hold = { lv: { [sub]: n }, dir: { [sub]: 'име' } }.
export const HOLD_LV_MAX = 5, HOLD_LV_K = 0.10, HOLD_DIR_K = 0.15;
export const DIR_LV = Math.ceil(HOLD_LV_MAX * 0.9);
const GLOB_DIR_COST = 1e9;   // директорът на Глобъл (мегапроекти, концесии, придобивания) — Глобъл няма собствен приход за процент   // директор — само когато дружеството е развито поне 90% (ниво 5 от 5)
// всяко дружество има свой директор (портретите и 3D моделите в directors3d.js са по тези имена)
// снимките (assets/ui/directors/<модел>.webp, dirshow.js) — моделите както в directors3d.js
export const DIR_PIC = { con: 'ivaylo', hw: 'nadya', rail: 'maria', sea: 'stefan', air: 'elena', hotel: 'georgi', oil: 'vera', bank: 'boris', glob: 'glob', mayor: 'mayor' };
export const showDirectorOf = (k, name, company, text, sound) => import('./dirshow.js').then(m => m.showDirector({ model: DIR_PIC[k] || 'ivaylo', role: k === 'mayor' ? 'градоначалник' : 'директор', name, company, text, sound })).catch(() => {});
export const DIR_OF = { con: 'Ивайло Петров', hw: 'Надя Иванова', rail: 'Мария Стоянова', sea: 'Стефан Колев', air: 'Елена Димитрова', hotel: 'Георги Николов', oil: 'Вера Ангелова', bank: 'Борис Тодоров' , glob: 'Александър Владимиров'};

// deps: { S, econ, fmt, pop(key, cap, sub), toast, save, sound, …броячите от SUBS (hwN, railN, portN, airN, oilN, empire, toll, flow, finDaily, oilDaily) }
export function createGroup(deps) {
  const hold = () => {
    const S = deps.S(); S.hold = S.hold || { lv: {}, dir: {} };
    for (const k in S.hold.dir) if (DIR_OF[k]) S.hold.dir[k] = DIR_OF[k];   // стари записи: директорите бяха по реда на назначаване
    return S.hold;
  };
  const subBy = k => SUBS.find(x => x.k === k);
  const dirEv = createDirEvents({ S: deps.S, econ: deps.econ, fmt: deps.fmt, toast: deps.toast, save: deps.save, sound: deps.sound,
    name: k => (k === 'mayor' ? deps.mayorName && deps.mayorName() : hold().dir[k] ? DIR_OF[k] || hold().dir[k] : null), sub: k => subName(deps.S(), k), inc: k => { const s = subBy(k); return s ? s.inc(deps) || 0 : 0; },
    hired: () => Object.keys(hold().dir || {}).filter(k => hold().dir[k]), trust: (k, d) => { const t = hold().trust = hold().trust || {}; t[k] = Math.max(0.5, Math.min(1.3, (t[k] ?? 1) + d)); } });
  const bonusK = k => (hold().lv[k] || 0) * HOLD_LV_K + (hold().dir[k] && !dirEv.bonusOff(k) ? HOLD_DIR_K : 0);   // стачка или отстранен директор — без неговия бонус
  const upCost = k => { const inc = subBy(k).inc(deps) || 0, L = hold().lv[k] || 0; return Math.round(Math.max(5e6, inc * 40) * (L + 1) / 1e5) * 1e5; };
  const dirCost = k => Math.round(Math.max(4e6, (subBy(k).inc(deps) || 0) * 45) / 1e5) * 1e5;
  const canManage = k => { const S = deps.S(); return !!(S.holding && (S.group || {})[k] && !subBy(k).final); };
  function upgrade(k) {
    if (!canManage(k) || (hold().lv[k] || 0) >= HOLD_LV_MAX) return; const c = upCost(k), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    e.spend(c, 'покупка', `Холдинг: развитие на ${subName(deps.S(), k)}`); hold().lv[k] = (hold().lv[k] || 0) + 1;
    deps.toast(`🏛️ ${subName(deps.S(), k)} — ниво ${hold().lv[k]}: +${Math.round(bonusK(k) * 100)}% от прихода ѝ всеки ден.`, 'good'); deps.sound && deps.sound('upgrade'); deps.save();
  }
  const canHireGlob = () => { const S = deps.S(); return !!(S.holding && (S.group || {}).glob && !hold().dir.glob); };
  function hire(k) {
    const isG = k === 'glob';
    if (hold().dir[k] || (isG ? !canHireGlob() : !canManage(k))) return;
    if (!isG && (hold().lv[k] || 0) < DIR_LV) { deps.toast(`👔 Директор — когато дружеството е развито поне 90% (ниво ${DIR_LV}).`, 'bad'); return; } const c = isG ? GLOB_DIR_COST : dirCost(k), e = deps.econ();
    if (!e.canAfford(c)) { deps.toast(`Нямаш ${deps.fmt(c)} €.`, 'bad'); return; }
    const nm = DIR_OF[k];
    e.spend(c, 'заплати', `Холдинг: директор на ${subName(deps.S(), k)}`); hold().dir[k] = nm;
    showDirectorOf(k, nm, subName(deps.S(), k), `Поема ${subBy(k)?.what || 'дружеството'} · +${Math.round(HOLD_DIR_K * 100)}% от прихода всеки ден · предложенията идват в борда.`, deps.sound); deps.save();   // тъмен екран със снимката
  }
  // дневният бонус на холдинга от развитието и директорите
  const bonusOf = k => Math.round((subBy(k).inc(deps) || 0) * bonusK(k));
  const dailyBonus = () => { const S = deps.S(); if (!S?.holding) return 0; return SUBS.filter(s => (S.group || {})[s.k] && !s.final).reduce((a, s) => a + bonusOf(s.k), 0); };
  // бонусът идва всеки ден; веднъж на 30 дни — известие колко е разпределил холдингът за месеца
  function dailyTick() {
    const b = dailyBonus(), h = hold(), day = deps.S().day || 0;
    // ерата на холдинга: ти ставаш председател, а Ивайло Петров поема майката фирма (Констръкшън) — без развитие и без плащане
    if (deps.S().holding && (deps.S().group || {}).con && !h.dir.con && !h.conAuto) {   // само веднъж — ако после напусне, се назначава нов от „Холдинг“
      h.dir.con = DIR_OF.con; h.conAuto = 1;
      showDirectorOf('con', DIR_OF.con, subName(deps.S(), 'con'), `Ти ставаш председател на холдинга. Ивайло води майката фирма: офертите, търговете, гаража, кварталите и филиалите — като предложения към борда (+${Math.round(HOLD_DIR_K * 100)}% от прихода ѝ).`, deps.sound);
      deps.save();
    }
    if (b > 0) { deps.econ().earn(b, 'холдинг', 'Холдинг: бонус от развитието и директорите'); h.mAcc = (h.mAcc || 0) + b; }
    if (day % 30 === 0 && h.mAcc > 0) {
      deps.toast(`🏛️ Холдингът разпредели +${deps.fmt(Math.round(h.mAcc))} € за месеца — бонус от развитието${Object.keys(h.dir).length ? ' и директорите' : ''} на дружествата.`, 'good');
      deps.sound && deps.sound('cash'); h.mAcc = 0;
    }
    dirEv.dailyTick();
    const B2 = deps.board2 && deps.board2();
    if (B2 && B2.commits && deps.S().holding) {
      // ✅ завършен проект — кратко известие от директора (boardlogic слага c.toasted = false при завършване)
      for (const c of B2.commits()) if (c.st === 'done' && c.toasted === false) {
        c.toasted = true; const who = (c.dir === 'mayor' ? deps.mayorName && deps.mayorName() : DIR_OF[c.dir]) || c.dir;
        deps.toast(`✅ ${who.split(' ')[0]}: ${c.text.split(/[.?—]/)[0].slice(0, 70)} — изпълнено${c.late ? ' (със закъснение)' : ' навреме'}.`, c.late ? '' : 'good'); deps.save();
      }
      if (day > 0 && day % 360 === 0) yearReview(B2);
    }
    // веднъж месечно бордът на директорите се събира сам, ако има какво да предложи
    if (day % 30 === 0 && deps.S().holding && !deps.S().pres && feature('boardroom') && proposals().filter(p => !p.info).length) { deps.toast(`🏛️ Бордът на директорите се събра — ${proposals().filter(p => !p.info).length} предложения.`, 'good'); board(); }   // докладът на банката (info) не е предложение
    return b;
  }
  // 📊 годишната оценка на директорите: изпълнени навреме / със закъснение / забавени и блокирани → директор на годината (+доверие) и предупреждение (−доверие)
  function yearReview(B2) {
    const h = hold(), day = deps.S().day || 0, from = day - 360, rows = [];
    for (const k of Object.keys(h.dir || {}).concat(deps.mayorName && deps.mayorName() ? ['mayor'] : [])) {
      const cs = B2.commits().filter(c => c.dir === k && c.start >= from);
      const ok = cs.filter(c => c.st === 'done' && !c.late).length, late = cs.filter(c => c.st === 'done' && c.late).length, bad = cs.filter(c => c.st === 'active' && c.flag).length;
      if (!cs.length) continue;
      rows.push({ k, nm: k === 'mayor' ? deps.mayorName() : DIR_OF[k] || h.dir[k], ok, late, bad, n: cs.length, score: ok * 2 + late - bad * 2 });
    }
    if (!rows.length) return;
    rows.sort((a, b) => b.score - a.score);
    h.trust = h.trust || {};
    const best = rows[0], worst = rows[rows.length - 1];
    if (best.score > 0) h.trust[best.k] = Math.min(1.3, (h.trust[best.k] ?? 1) + 0.05);
    if (worst !== best && worst.score < 0) h.trust[worst.k] = Math.max(0.5, (h.trust[worst.k] ?? 1) - 0.05);
    h.reviews = [{ day, rows: rows.map(r => ({ k: r.k, ok: r.ok, late: r.late, bad: r.bad })) }, ...(h.reviews || [])].slice(0, 10);
    const line = r => `${r.nm}: ${r.ok} навреме, ${r.late} със закъснение${r.bad ? `, ${r.bad} забавени` : ''}`;
    deps.pop && deps.pop('dir-review', '📊 Годишна оценка на директорите', `${best.score > 0 ? `⭐ Директор на годината: ${best.nm} (+доверие). ` : ''}${worst !== best && worst.score < 0 ? `⚠️ Предупреждение: ${worst.nm} (−доверие). ` : ''}${rows.map(line).join(' · ')}`);
    deps.sound && deps.sound('levelup'); deps.save();
  }
  function check(quiet = false) {
    const S = deps.S(); if (!S || !S.brand) return;
    const g = S.group = S.group || {}, b = brandOf(S);
    for (const s of SUBS) {
      if (g[s.k] || !s.open(deps)) continue;
      if (S.foundFirst && FOUND[s.k]) continue;   // нова игра: тези се основават ръчно (found)
      g[s.k] = S.day || 1;
      if (quiet || s.k === 'con') continue;
      if (s.final) deps.pop('empire', `👑 ${b.nm} Глобъл`, `От първия строеж до световна империя. Добре дошли в ${b.nm} Глобъл!`);
      else if (!(deps.subShow && deps.subShow(s.k, 'done', `Поема <b>${s.what}</b>. Старите дружества в групата продължават да печелят.`))) deps.pop('new-branch', `${s.ico} Нова дъщерна фирма: ${b.nm} ${s.suf}`, `${b.nm} ${s.suf} поема ${s.what}. Старите дружества в групата продължават да печелят.`);
      deps.sound && deps.sound('levelup');
    }
    deps.save();
  }
  // ръчно основаване (бутон в „Холдинг“ или от прозореца за магистрали/жп…): пари → дружеството → стартовият пакет (deps.gift)
  const canFound = k => { const S = deps.S(); return !!(S && S.foundFirst && FOUND[k] && !(S.group || {})[k] && (deps.lv ? deps.lv() >= FOUND[k].lv : true)); };
  function found(k) {
    const S = deps.S(), F = FOUND[k], s = SUBS.find(x => x.k === k), b = brandOf(S) || { nm: S?.brandNm || 'Фирмата' }, e = deps.econ();   // стари записи без марка — не гърми
    if (!canFound(k)) return false;
    if (!e.canAfford(F.cost)) { deps.toast(`Нужни са ${deps.fmt(F.cost)} €, за да основеш ${b.nm} ${s.suf}.`, 'bad'); return false; }
    e.spend(F.cost, 'покупка', `Основаване на ${b.nm} ${s.suf}`);
    (S.group = S.group || {})[k] = S.day || 1;
    deps.gift && deps.gift(k);
    if (!(deps.subShow && deps.subShow(k, 'done', `Стартов пакет: <b>${F.gift}</b>.<br>${F.next}`))) deps.pop('new-branch', `${s.ico} Основа ${b.nm} ${s.suf}!`, `Стартов пакет: ${F.gift}. ${F.next}`);
    deps.sound && deps.sound('levelup'); deps.save();
    return true;
  }
  function winHtml(extra = '') {
    const S = deps.S(), b = brandOf(S), g = S.group || {}, f = deps.fmt, H = S.holding;
    if (!b) return '<div class="card"><div class="meta" style="margin:0">Още нямаш избрана фирма.</div></div>';
    const open = SUBS.filter(s => g[s.k]), tot = open.reduce((a, s) => a + (s.inc(deps) || 0), 0), bon = dailyBonus();
    let h = `<div class="bw-stats"><div><b style="color:${b.col}">${b.ico} ${groupName(S)}</b><span>${H ? 'холдинг' : 'корпоративна група'}</span></div><div><b>${open.length} / ${SUBS.length}</b><span>дружества</span></div><div><b style="color:var(--ok)">+${f(tot)} €</b><span>приход на ден от дружествата</span></div>${H ? `<div><b style="color:#ffd54a">+${f(bon)} €</b><span>бонус на холдинга на ден</span></div>` : ''}</div>`;
    h += H ? `<div class="meta" style="margin:8px 0">🏛️ <b>Ерата на холдинга</b> (от ден ${H}): градовете, поръчките, линиите и флотите вървят сами. Ти управляваш дружествата: <b>⬆️ развитие</b> дава +${Math.round(HOLD_LV_K * 100)}% от прихода им на ниво (до ${HOLD_LV_MAX}), а <b>👔 директорът</b> още +${Math.round(HOLD_DIR_K * 100)}%.</div>`
      : `<div class="meta" style="margin:8px 0">🔒 От <b>ниво 15</b> идва <b>🏛️ Ерата на холдинга</b>: всичко досегашно минава на автопилот, а ти управляваш дружествата.</div>`;
    if (H && feature('boardroom')) h += '<div class="row" style="justify-content:flex-end;margin:0 0 8px"><button class="btn" data-hboard="1">🏛️ Директорската зала →</button></div>' + (deps.board2 ? deps.board2().settingsHtml() : '');   // бюджети и автопилот (boardlogic.js)
    h += extra;
    h += '<style>.subLock > *:not(.subLv){filter:blur(2.5px);opacity:.55;pointer-events:none;user-select:none}.subLv{position:absolute;right:12px;top:50%;transform:translateY(-50%);z-index:2;padding:5px 12px;border-radius:999px;background:rgba(0,0,0,.65);border:1px solid var(--line);font-weight:800;color:#ffd54a}</style>';   // заключените — замъглени, с ясна значка „🔒 ниво N“
    h += SUBS.map(s => {
      const on = g[s.k], inc = on ? s.inc(deps) || 0 : 0, L = hold().lv[s.k] || 0, dir = hold().dir[s.k], man = H && on && !s.final && inc > 0;   // без приход — няма какво да се умножава
      const ctl = man ? `<div class="row" style="margin:6px 0 0;gap:6px;flex-wrap:wrap;align-items:center"><span class="meta" style="margin:0;flex:1">${'★'.repeat(L)}${'☆'.repeat(HOLD_LV_MAX - L)} ниво ${L}${dir ? ` · 👔 ${dir}` : ''}${bonusK(s.k) ? ` · <b style="color:#ffd54a">+${f(bonusOf(s.k))} €/ден</b> (+${Math.round(bonusK(s.k) * 100)}%)` : ''}</span>${L < HOLD_LV_MAX ? `<button class="btn2" data-hup="${s.k}" ${deps.econ().canAfford(upCost(s.k)) ? '' : 'disabled'}>⬆️ Развий · ${f(upCost(s.k))} €</button>` : ''}${dir ? '' : L < DIR_LV ? `<button class="btn2" disabled title="Директор се назначава, когато дружеството е развито поне 90%">👔 Директор · 🔒 ниво ${DIR_LV}</button>` : `<button class="btn2" data-hdir="${s.k}" ${deps.econ().canAfford(dirCost(s.k)) ? '' : 'disabled'}>👔 Директор · ${f(dirCost(s.k))} €</button>`}</div>` : '';
      const fb = !on && canFound(s.k) ? `<div class="row" style="margin:6px 0 0;gap:6px;align-items:center"><span class="meta" style="margin:0;flex:1">🎁 ${FOUND[s.k].gift}</span><button class="btn" data-hfound="${s.k}">Основи · ${f(FOUND[s.k].cost)} €</button></div>` : '';
      return `<div class="card${!on && !fb ? ' subLock' : ''}" style="position:relative;${on ? `border-left:4px solid ${b.col}` : ''}">${!on && !fb ? `<span class="subLv">🔒 ниво ${SUB_LV[s.k] || '?'}</span>` : ''}<div class="row" style="margin:0;align-items:center;gap:10px">${subLogo(s.k, 44, on)}<span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">${b.nm} ${s.suf}</b><br>${s.what}${on ? ` · основана на ден ${on}` : ` · 🔒 ${s.how}`}</span>${on && !s.final ? `<b style="color:${inc ? 'var(--ok)' : 'var(--mut, #9aa)'}">${inc ? `+${f(inc)} €/ден` : '—'}</b>` : ''}</div>${s.k === 'glob' && H && on ? (dir ? `<div class="meta" style="margin:6px 0 0">👔 ${DIR_OF.glob}</div>` : `<div class="row" style="margin:6px 0 0;justify-content:flex-end"><button class="btn2" data-hdir="glob" ${deps.econ().canAfford(GLOB_DIR_COST) ? '' : 'disabled'}>👔 Директор · ${f(GLOB_DIR_COST)} €</button></div>`) : ''}${ctl}${H && on && dir ? dirPanel(s.k) : ''}${s.k === 'oil' && on ? '<div class="row" style="justify-content:flex-end;margin:6px 0 0"><button class="btn" data-hoil="1">🛢️ Петролната империя →</button></div>' : ''}${fb}</div>`;
    }).join('');
    if (H && deps.mayorName && deps.mayorName()) h += `<div class="card" style="border-left:4px solid #9fdfff"><div class="row" style="margin:0;align-items:center;gap:10px"><img src="assets/ui/seal-imperial${deps.S().imp?.cc === 'RU' ? '-ru' : ''}.webp" alt="" style="width:44px;height:44px"><span class="meta" style="margin:0;flex:1"><b style="color:var(--txt);font-size:15px">Империал Сити</b><br>👩‍💼 ${deps.mayorName()} · градоначалник</span></div>${dirPanel('mayor')}</div>`;
    return h;
  }
  // 📋 панелът на директора в „Холдинг“: неговите предложения (Да / ½ / По-късно / Не, съвещателен вот при нужда) и ангажиментите му с напредъка
  const openPanels = new Set();
  const moodTag = k => { const m = dirEv.mood(k); return `<span title="Настроение на директора">${dirEv.cq() ? dirEv.tag(k) : dirEv.away(k) ? '⏸️ отстранен · ' : dirEv.struck(k) ? '✊ стачка · ' : ''}${m >= 0.7 ? '😊' : m >= 0.45 ? '😐' : '😤'} ${Math.round(m * 100)}%</span> · `; };
  function dirPanel(k) {
    const B2 = deps.board2 && deps.board2(); if (!B2) return '';
    const ps = proposals().filter(p => p.dir === k && !p.info), cs = (B2.commits ? B2.commits() : []).filter(c => c.dir === k && (c.st === 'active' || (c.st === 'done' && c.end >= (deps.S().day || 0) - 30)));
    if (!ps.length && !cs.length) return '';
    const Bf = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${deps.fmt(Math.round(n))} €`;
    const prop = p => `<div style="margin:6px 0;padding:8px 10px;border:1px solid var(--line);border-radius:10px">${B2.propHtml(p)}<div class="row" style="margin:6px 0 0;gap:6px;flex-wrap:wrap">${p.mustVote ? `<button class="btn" data-gp="${p.id}|vote">🗳️ Решава бордът — гласуване</button>` : `<button class="btn" data-gp="${p.id}|yes" ${p.can === false ? 'disabled' : ''}>✓ Да</button>`}${p.small ? `<button class="btn2" data-gp="${p.id}|small">½ ${Bf(p.small.cost)}</button>` : ''}<button class="btn2" data-gp="${p.id}|later">⏳ По-късно</button><button class="btn2" data-gp="${p.id}|no">✖ Не</button></div><div data-gpv="${p.id}"></div></div>`;
    const com = c => `<div class="meta" style="margin:3px 0">${c.st === 'done' ? '✅' : c.flag === 'блокирано' ? '⛔' : c.flag === 'забавено' ? '⚠️' : '⏳'} ${c.text.slice(0, 90)}${c.text.length > 90 ? '…' : ''} · ${c.st === 'done' ? `изпълнено на ден ${c.end}` : `${Math.round((c.prog || 0) * 100)}% · срок ден ${c.due}`}</div>`;
    return `<details data-gpd="${k}" ${openPanels.has(k) ? 'open' : ''} style="margin:8px 0 0"><summary class="meta" style="margin:0;cursor:pointer;color:var(--txt)">${moodTag(k)}📋 Директорът: ${ps.length ? `<b>${ps.length}</b> ${ps.length === 1 ? 'предложение' : 'предложения'}` : 'без нови предложения'}${cs.length ? ` · ${cs.length} ${cs.length === 1 ? 'проект' : 'проекта'}` : ''}</summary>${ps.map(prop).join('')}${cs.length ? `<div style="margin:6px 0 0"><div class="meta" style="margin:0 0 2px;color:var(--mut)">Проектите:</div>${cs.map(com).join('')}</div>` : ''}</details>`;
  }
  function bindPanels(box, rerender) {
    const B2 = deps.board2 && deps.board2(); if (!B2) return;
    box.querySelectorAll('[data-gpd]').forEach(d => d.ontoggle = () => { d.open ? openPanels.add(d.dataset.gpd) : openPanels.delete(d.dataset.gpd); });
    box.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => {
      const [id, a] = b.dataset.gp.split('|');
      if (a === 'yes' || a === 'small' || a === 'vote') {
        const pp = a === 'vote' && proposals().find(q => q.id === id), r = shake(pp ? { v: B2.vote(pp), p: pp } : B2.request(id, { small: a === 'small' }));   // мегапроект — винаги на гласуване
        if (r && r.need === 'vote') {   // съвещателният вот — направо в картата
          const v = box.querySelector(`[data-gpv="${CSS.escape(id)}"]`); if (!v) return;
          v.innerHTML = `<div style="margin:8px 0 0;padding:8px;border-radius:8px;background:rgba(255,255,255,.04)">${B2.voteHtml(r)}</div>`;
          if (r.p && r.p.mustVote && !(r.v.yes > r.v.no)) v.querySelectorAll('[data-bv$="|pass"], [data-bv$="|small"], [data-bv$="|loan"]').forEach(b => b.remove());   // мегапроект без мнозинство — не минава
          v.querySelectorAll('[data-bv]').forEach(x => x.onclick = () => { const [i2, how] = x.dataset.bv.split('|'); B2.resolve(i2, how === 'pass' && r.p && r.p.isSmall ? 'small' : how, r.v); rerender(); });
          return;
        }
      } else decide(id, a);
      rerender();
    });
  }
  function bind(box, rerender) {
    bindPanels(box, rerender);
    box.querySelectorAll('[data-hup]').forEach(b => b.onclick = () => { upgrade(b.dataset.hup); rerender(); });
    box.querySelectorAll('[data-hdir]').forEach(b => b.onclick = () => { hire(b.dataset.hdir); rerender(); });
    box.querySelectorAll('[data-hboard]').forEach(b => b.onclick = () => board(rerender));
    if (deps.board2) deps.board2().bindSettings(box, rerender);
    box.querySelectorAll('[data-hfound]').forEach(b => b.onclick = () => { if (deps.askFound && deps.askFound(b.dataset.hfound, rerender)) return; found(b.dataset.hfound); rerender(); });   // екранът с логото (game.js)
  }
  // 🏛️ Директорската зала (directors3d.js): всяко дружество е стол на масата; клик на директор — доклад и одобряване на развитие
  function boardSeats() {
    const S = deps.S(), g = S.group || {};
    return SUBS.map(s => {   // и Глобъл — начело на масата (directors3d.js, деветото място)
      const on = !!g[s.k], inc = on ? s.inc(deps) || 0 : 0, L = hold().lv[s.k] || 0, dir = hold().dir[s.k], man = canManage(s.k) && inc > 0, e = deps.econ();
      return { k: s.k, ico: s.ico, company: subName(S, s.k) || s.suf, what: s.what, open: on, director: dir ? DIR_OF[s.k] || dir : null, lv: L, lvMax: HOLD_LV_MAX, inc, bonus: bonusOf(s.k), bonusPct: Math.round(bonusK(s.k) * 100),
        up: man && L < HOLD_LV_MAX ? { cost: upCost(s.k), can: e.canAfford(upCost(s.k)) } : null,
        hire: s.k === 'glob' ? (canHireGlob() ? { cost: GLOB_DIR_COST, can: e.canAfford(GLOB_DIR_COST) } : null) : man && !dir && L >= DIR_LV ? { cost: dirCost(s.k), can: e.canAfford(dirCost(s.k)) } : null };
    }).concat(deps.mayorName && deps.mayorName() ? [{ k: 'mayor', ico: '🏙️', company: 'Империал Сити', what: 'градоначалник', open: true, director: deps.mayorName(), lv: 0, lvMax: HOLD_LV_MAX, inc: 0, bonus: 0, bonusPct: 0, up: null, hire: null }] : []);   // 10-ото място — градоначалникът
  }
  // 🎲 над бюджета: вотът е непредсказуем — всеки директор (без предложилия) може да е против; колкото по-голямо е превишението, толкова по-вероятно
  const OVER_WHY = ['над бюджета е — рискът е голям', 'парите ще ни трябват другаде', 'не сега, касата е опъната', 'искам по-малък първи етап', 'ще изпаднат моите проекти'];
  function shake(r) {
    if (!r || !r.v || !r.p || r.p.inBudget !== false || !Array.isArray(r.v.votes)) return r;
    const B2 = deps.board2 && deps.board2(), F = B2 && B2.frame ? B2.frame() : null, over = F && F.free > 0 ? Math.min(3, (r.p.cost || 0) / F.free) : 2;
    const pNo = Math.min(0.75, 0.3 + 0.15 * over);
    const votes = r.v.votes.map(x => x.dir === r.p.dir || Math.random() >= pNo ? x : { ...x, yes: false, cond: false, why: OVER_WHY[Math.floor(Math.random() * OVER_WHY.length)] });
    const yes = votes.filter(x => x.yes).length, no = votes.length - yes;
    return { ...r, v: { ...r.v, votes, yes, no, tie: yes === no, passed: yes > no } };
  }
  // 📋 предложенията към борда (deps.proposals от game.js: [{ id: 'dir:вид:брой', dir, ico, text, cost, apply() }]);
  // „Не“ — 90 дни тишина за този вид, „По-късно“ — до следващия борд (30 дни). Записът: S.hold.skip = { 'dir:вид': денят до който мълчи }
  const propKey = id => String(id).split(':').slice(0, 2).join(':');
  const allProps = () => (deps.proposals && deps.proposals()) || [];
  function proposals() {
    const day = deps.S().day || 0, sk = hold().skip || {}, e = deps.econ();
    return allProps().filter(p => !(sk[propKey(p.id)] > day)).map(p => ({ ...p, can: !p.cost || e.canAfford(p.cost) }));
  }
  function decide(id, a) {
    if (a === 'no') { const p0 = allProps().find(q => q.id === id); if (p0) dirEv.onNo(p0.dir, p0); }   // отказът сваля настроението на директора
    const p = allProps().find(q => q.id === id), h = hold(); if (!p) return;
    if (a === 'yes') {
      if (p.cost && !deps.econ().canAfford(p.cost)) { deps.toast(`Нямаш ${deps.fmt(p.cost)} €.`, 'bad'); return; }
      p.apply(); deps.toast(`✓ Бордът одобри: ${p.text}`, 'good'); deps.sound && deps.sound('buy');
      (h.skip = h.skip || {})[propKey(id)] = (deps.S().day || 0) + 30;   // одобреното не се предлага пак веднага (до следващия борд) — иначе се одобряваше многократно
    } else (h.skip = h.skip || {})[propKey(id)] = (deps.S().day || 0) + (a === 'no' ? 90 : 30);
    deps.save();
  }
  function board(rerender) {
    const re = () => rerender && rerender();
    import('./directors3d.js').then(m => m.openBoardroom({ title: groupName(deps.S()), brand: brandOf(deps.S()) && { ...brandOf(deps.S()), group: groupName(deps.S()) }, seats: boardSeats, fmt: deps.fmt, sound: deps.sound,
      proposals, onUp: k => { upgrade(k); re(); }, onHire: k => { hire(k); re(); },
      // 🏦 трезорът зад борда (флаг vault): парите на фирмата; разделянето резерв / за инвестиции / свободни — в записа (S.hold.vault); резервът на Борис — оперативният от boardlogic
      vault: feature('vault') ? { money: () => deps.econ().money, split: { res: 20, inv: 50, ...(hold().vault || {}) }, onSplit: sp => { hold().vault = { res: sp.res, inv: sp.inv }; deps.save(); },
        monthCost: () => { try { return deps.board2 ? deps.board2().frame().op : 0; } catch (e) { return 0; } }, night: () => deps.night ? deps.night() : 0 } : null,
      // „Да“ минава през boardlogic.js (бюджет → банка → гласуване); връща { need: 'vote', v, p }, ако бордът трябва да гласува
      onDecide: (id, a) => { const B = deps.board2 && deps.board2(), r = (a === 'yes' || a === 'small') && B ? shake(B.request(id, { small: a === 'small' })) : (decide(id, a), null); re(); return r; },
      // заседанието (boardlogic.js): отчет → речта и рамката на банката → предложенията → обобщение
      report: deps.board2 ? () => deps.board2().reportHtml() : null, bindReport: (box, rr) => deps.board2().bindSettings(box, () => { rr(); re(); }),
      speech: deps.board2 ? () => deps.board2().bankSpeech() : null, frame: deps.board2 ? () => deps.board2().frame() : null, summary: deps.board2 ? () => deps.board2().summary() : null,
      voteOn: deps.board2 ? id => { const p = proposals().find(q => q.id === id), B2 = deps.board2(); return p && B2.vote ? shake({ v: B2.vote(p), p }) : null; } : null,   // 🗳️ собственикът сам подлага предложение на гласуване
      onResolve: (id, how, shown) => { const r = deps.board2().resolve(id, how, shown); re(); return r; },   // shown — показаният вот (без преизчисляване)
      settings: deps.board2 ? () => deps.board2().settingsHtml() : null, bindSettings: (box, rr) => deps.board2().bindSettings(box, () => { rr(); re(); }) }));
  }
  // ⛔ извънредно заседание — при важна поръчка (супер поръчка или такава над EMG_SHARE от касата): червен бутон долу вляво,
  // залата само с тази точка и задължително гласуване. „Одобри“ → item.accept(), „Отхвърли“ → item.decline(), „Отложи“ — бутонът остава.
  // item: { id, ico, text, short?, why?, cost? (вложението), value? (стойността на поръчката), days?, gainTxt?, dir? ('con'), until? (ден), live()?, accept(), decline(), loan()?, loanWhy? }
  // Свиква се само при холдинг с директори в залата (feature 'boardroom' + 'board-emg'); иначе връща false и поръчката върви по стария път.
  const EMG_SHARE = 0.25;
  let emg = [];
  const emgOn = () => { const S = deps.S(); return !!(S && S.holding && feature('boardroom') && feature('board-emg') && Object.keys((S.hold && S.hold.dir) || {}).length); };
  function emgBtn() {
    const day = deps.S().day || 0; emg = emg.filter(it => !(it.until < day) && !(it.live && !it.live()));   // live() — поръчката още чака отговор (не е приета/отказана другаде)
    let b = document.getElementById('emgBtn');
    if (!emg.length) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.id = 'emgBtn'; b.style.cssText = 'position:fixed;left:14px;bottom:86px;z-index:60;background:#b3121b;color:#fff;border:2px solid #ff6b6b;border-radius:12px;padding:9px 14px;font:800 14px system-ui;box-shadow:0 0 0 0 #ff4d4d;animation:emgP 1.4s infinite;cursor:pointer';
      if (!document.getElementById('emgCss')) { const st = document.createElement('style'); st.id = 'emgCss'; st.textContent = '@keyframes emgP{0%{box-shadow:0 0 0 0 #ff4d4daa}70%{box-shadow:0 0 0 14px #ff4d4d00}100%{box-shadow:0 0 0 0 #ff4d4d00}}'; document.head.appendChild(st); } document.body.appendChild(b); b.onclick = () => emergencyBoard(); }
    const t = `⛔ Извънредно заседание · ${emg[0].ico || ''} ${emg[0].short || emg[0].text.split(/[.:—!?]/)[0].slice(0, 40)}${emg.length > 1 ? ` (+${emg.length - 1})` : ''}`;
    b.textContent = t;
  }
  function emergency(item) {
    if (!emgOn() || !item || !item.accept) return false;
    if (!emg.some(it => it.id === item.id)) emg.push(item);
    deps.toast(`⛔ Извънредно заседание на борда: ${item.ico || ''} ${item.short || item.text}. Директорите се събират — решението е с гласуване.`, 'bad', () => emergencyBoard());
    deps.sound && deps.sound('offer'); emgBtn();
    return true;
  }
  // поръчка над EMG_SHARE от касата → извънредно заседание; иначе false (поръчката върви по стария път)
  const emergencyIf = item => { const cash = Math.max(1, deps.econ().money || 0), v = Math.max(item.value || 0, item.cost || 0); return v > cash * EMG_SHARE ? emergency({ ...item, why: item.why || `${Math.round(v / cash * 100)}% от касата — над прага от ${EMG_SHARE * 100}%` }) : false; };
  function emergencyBoard(rerender) {
    emgBtn(); if (!emg.length) return;
    const re = () => { emgBtn(); rerender && rerender(); }, B2 = () => deps.board2 && deps.board2();
    const props = () => emg.filter(it => !(it.live && !it.live())).map(it => { const F = B2() && B2().frame ? B2().frame() : null; return { dir: 'con', head: '⛔ Извънредна точка', mustNote: it.loan ? '⛔ Извънредно заседание: решава се с гласуване; „🏦 С кредит“ — другият изход.' : '⛔ Извънредно заседание: само с мнозинство в борда.', ...it, mustVote: true, inBudget: it.cost && F ? it.cost <= F.free : null, can: true }; });
    const done = (id, ok, how) => { const it = emg.find(x => x.id === id); if (!it) return; emg = emg.filter(x => x !== it); try { how === 'loan' && it.loan ? it.loan() : ok ? it.accept() : it.decline && it.decline(); } catch (e) { console.warn('emergency', e); } deps.save(); re(); };
    const voteOf = p => { const b = B2(); if (b && b.vote) return b.vote(p); const votes = Object.keys(deps.S().hold.dir || {}).map(d => ({ dir: d, name: deps.S().hold.dir[d], yes: true, why: d === p.dir ? 'моето предложение' : 'полезно за холдинга' })); return { votes, yes: votes.length, no: 0, passed: true, bank: { ok: true } }; };
    import('./directors3d.js').then(m => m.openBoardroom({ title: groupName(deps.S()), brand: brandOf(deps.S()) && { ...brandOf(deps.S()), group: groupName(deps.S()) }, seats: boardSeats, fmt: deps.fmt, sound: deps.sound,
      hallTitle: '⛔ Извънредно заседание', loadText: '🚨 Директорите се събират спешно…',
      proposals: props, frame: B2() ? () => B2().frame() : null,
      onDecide: (id, a) => { if (a === 'no') done(id, false); return null; },
      // item.loan — втори изход „🏦 С кредит“ (залата го показва, когато банката „възразява“): напр. стабилизационен кредит вместо продажба на акции
      voteOn: id => { const p = props().find(q => q.id === id); if (!p) return null; const v = voteOf(p); return { v: p.loan ? { ...v, bank: { ...(v.bank || {}), ok: false, why: p.loanWhy || 'има и вариант с кредит' } } : v, p }; },
      onResolve: (id, how, shown) => { if (how === 'drop') return { done: false }; if (shown && shown.yes < shown.no && how !== 'loan') { deps.toast('🗳️ Бордът не подкрепи поръчката — без мнозинство не се поема.', 'bad'); return { done: false }; } done(id, true, how); return { done: true }; } }));
  }
  return { dirEv, dirPanel, bindPanels, check, winHtml, bind, board, proposals, decide, dailyTick, dailyBonus, upgrade, hire, found, canFound, emergency, emergencyIf, emergencyBoard, emgOn };
}
