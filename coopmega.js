// coopmega.js — 🤝 „coop-mega“ (Лаборатория): общите супер поръчки с партньора — „1/2 на 1/2“ (собственикът, 28.10).
// Супер поръчка (Ориент Експрес, Route 66, Пътят на коприната и шестте от megaorders.js), предложена на единия при активно партньорство,
// идва и при другия („Партньорът <име> получи предложение … — делите поръчката 1/2 на 1/2“). Договорът е общ, но всеки го подписва сам:
// който подпише — договорът тече при него; другият се присъединява, когато и той подпише (докато офертата му е валидна). Отказът на единия не спира другия.
// Всеки си плаща сам (без превод на пари между клиентите): аванс, награда при предаването и дневният приход — по 50% (S.<поръчка>.joint.share).
// Провал: всеки връща своята половина от аванса и губи 0.3 ★. Напредъкът е общ: участъците (жп и аутобан), ⚡ модернизациите, шлюзовете
// и логистичните центрове на двамата се броят. Предаването: всеки клиент сам вижда изпълненото условие и си плаща своите 50% — веднъж
// (договорът минава 'active' → 'done' само веднъж; id-то на договора се помни в S.coopMegaSeen и не идва втори път).
// В снимката (coop.js snapshot → cleanSnap): mega: { c: [{ k, id, st }], rh: ['a|b' — моите ⚡ линии], w: { panama | hub.<град>: 0..1 } }.
// Без флага или без партньор: нищо не се променя (joint() → null, snap() → {}).
import { feature } from './lab/feature.js';

const KEYS = ['oe', 'r66', 'silk', 'chunnel', 'capecairo', 'panama', 'darien', 'transsib', 'ghan'];
const STS = ['offer', 'active', 'done', 'failed', 'declined'];
const idOk = x => typeof x === 'string' && /^[\w.-]{1,48}$/.test(x);
const refOk = x => typeof x === 'string' && /^[\w.-]{1,48}\|[\w.-]{1,48}$/.test(x);
const esc = s => String(s ?? '').replace(/[<>&"'`\\]/g, '').slice(0, 24);

// чуждите данни (снимката на партньора) — само познати ключове, id-та и числа 0..1
export function cleanMega(M) {
  if (!M || typeof M !== 'object' || Array.isArray(M)) return undefined;
  const c = (Array.isArray(M.c) ? M.c : []).filter(x => x && KEYS.includes(x.k) && idOk(x.id) && STS.includes(x.st)).slice(0, 12).map(x => ({ k: x.k, id: x.id, st: x.st }));
  const rh = (Array.isArray(M.rh) ? M.rh : []).filter(refOk).slice(0, 200), w = {};
  if (M.w && typeof M.w === 'object') for (const [k, v] of Object.entries(M.w).slice(0, 12)) if (/^[\w.-]{1,24}$/.test(k) && Number.isFinite(+v)) w[k] = Math.max(0, Math.min(1, +v));
  return { c, rh, w };
}
// делът на тази страна: 0.5 при обща поръчка, иначе 1 (както досега)
export const jshare = s => s && s.joint && +s.joint.share > 0 && +s.joint.share < 1 ? +s.joint.share : 1;
// при нова оферта: общ договор (j) или самостоятелен — старият запис за партньор се маха
export function jset(s, j) { if (j) s.joint = j; else delete s.joint; }
// „🤝 Обща поръчка с <партньор> — по 50%“ и двата дяла (договорът и картата в прозореца „⭐ Супер поръчки“)
// span (display:block), не div: модалът слага текста в <p> — div вътре затваря <p> и редовете се разпадат
export function jointHtml(s, fmt, fee, adv) {
  if (!s || !s.joint) return '';
  const nm = esc(s.joint.name) || 'партньора', k = jshare(s), me = Math.round(fee * k), pa = Math.max(0, fee - me);
  return `<span class="meta" style="display:block;margin:6px 0;padding:6px 8px;border:1px dashed #2f8cff;border-radius:8px;color:var(--txt)">🤝 Обща поръчка с <b>${nm}</b> — по 50%<br>Твоят дял: <b style="color:var(--ok)">${fmt(me)} €</b>${adv ? ` (аванс ${fmt(Math.round(fee * adv * k))} €)` : ''} · дялът на ${nm}: <b>${fmt(pa)} €</b></span>`;
}
// сумата за тази страна; при обща поръчка — „X € (½ от Y €)“
export function jfee(s, fmt, v) { const k = jshare(s); return k < 1 ? `${fmt(Math.round(v * k))} € (половината от ${fmt(v)} €)` : `${fmt(v)} €`; }
// тостът при офертата, дошла от партньора
export const jointToast = (j, nm) => `🤝 Партньорът ${esc(j && j.name) || 'партньора'} получи предложение „${nm}“ — делите поръчката 1/2 на 1/2. Виж договора.`;

// deps: { S(), coop() → coop.js, toast(msg, kind, onClick?), save(), openWin(),
//   list() → [{ k, nm, st() → запис, offerJoint(j) }], railsHs() → ['a|b'], works() → { panama | hub.<град>: 0..1 } }
export function createCoopMega(deps) {
  const on = () => feature('coop-mega');
  const myId = () => { try { return String(deps.coop?.()?.me?.() || ''); } catch { return ''; } };
  // 🤝 партньорът: истинското партньорство (coop.js) или фалшивият от Лабораторията (window.__coopShared.mega — само в теста/демото)
  function partner() {
    let c = null; try { c = deps.coop?.()?.state?.(); } catch { }
    if (c?.pair?.status === 'active' && c.partner?.snap) return { name: esc(c.partner.snap.name) || 'партньора', id: String(c.partner.id || ''), p: c.partner.snap.mega || null, fake: false };
    const F = window.__coopShared; if (F && F.mega) return { name: esc(F.name) || 'партньора', id: 'zz-fake', p: cleanMega(F.mega) || null, fake: true };
    return null;
  }
  const seen = () => { const S = deps.S(); return S ? (S.coopMegaSeen = S.coopMegaSeen || {}) : {}; };
  // нова супер поръчка при мен: общ договор, ако флагът е включен и има активен партньор
  function joint(k) {
    if (!on() || !deps.S()) return null; const q = partner(); if (!q) return null;
    const id = `${k}.${(myId() || 'me').replace(/[^\w]/g, '').slice(0, 8)}.${deps.S().day | 0}`;
    seen()[id] = deps.S().day;
    return { with: q.id, name: q.name, share: 0.5, id };
  }
  // общата мрежа важи за общите договори (оферта, активен или предаден — за таблото)
  const net = () => on() && !!partner() && deps.list().some(x => { const s = x.st(); return s.joint && (s.st === 'offer' || s.st === 'active' || s.st === 'done'); });
  // жп участък на партньора (window.__coopShared.rails) — построен; ⚡ — ако е в неговите rh
  function leg(a, b) {
    const sh = window.__coopShared, ref = [a, b].sort().join('|');
    if (!(sh?.rails || []).some(([x, y]) => [x, y].sort().join('|') === ref)) return null;
    const q = partner(); return { i: -1, built: true, prog: 1, hs: !!(q?.p?.rh || []).includes(ref), coop: true };
  }
  // моят участък (или този от coop-infra) срещу участъка на партньора — по-добрият (построен, после ⚡)
  function pick(o, a, b) {
    if (!net() || (o && o.built && o.hs)) return o;
    const p = leg(a, b); if (!p || (o && o.built && !p.hs)) return o; return p;
  }
  // шлюзовете / логистичните центрове на партньора (0..1)
  const works = key => net() ? +(partner()?.p?.w?.[key] || 0) : 0;
  // в снимката: моите общи договори, ⚡ линиите и големите строежи
  function snap() {
    if (!on() || !deps.S()) return {};
    try {
      const c = deps.list().map(x => ({ k: x.k, s: x.st() })).filter(x => x.s.joint && idOk(x.s.joint.id) && STS.includes(x.s.st)).map(x => ({ k: x.k, id: x.s.joint.id, st: x.s.st }));
      const w = Object.fromEntries(Object.entries(deps.works() || {}).filter(([, v]) => v > 0));
      return { mega: { c, rh: (deps.railsHs() || []).slice(0, 200), w } };
    } catch (e) { console.warn('coop-mega snap', e); return {}; }
  }
  // всеки ден: общите оферти на партньора идват и при мен (веднъж за договор)
  function tick() {
    if (!on()) return; const S = deps.S(), q = partner(); if (!S || !q || !q.p) return;
    const sn = seen();
    for (const e of q.p.c || []) {
      const x = deps.list().find(o => o.k === e.k); if (!x) continue;
      const s = x.st();
      if ((e.st === 'offer' || e.st === 'active') && !sn[e.id] && !['offer', 'active', 'done'].includes(s.st)) {
        sn[e.id] = S.day; x.offerJoint({ with: q.id, name: q.name, share: 0.5, id: e.id }); deps.save(); continue;
      }
      if (e.st === 'active' && s.st === 'offer' && s.joint?.id === e.id && !sn[e.id + '.a']) {
        sn[e.id + '.a'] = S.day; deps.toast(`🤝 ${q.name} подписа „${x.nm}“ — подпиши и ти, за да вземеш своите 50%.`, 'good', () => deps.openWin());
      }
    }
    const ks = Object.keys(sn); if (ks.length > 80) for (const k of ks.slice(0, ks.length - 80)) delete sn[k];
  }
  return { on, joint, net, leg, pick, works, snap, tick, partner };
}
