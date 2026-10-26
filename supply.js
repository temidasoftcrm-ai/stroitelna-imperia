// supply.js — оферти от доставчици: завод в друг град предлага голямо количество материал с отстъпка.
// Приемаш договора без плащане; стоката пристига в склада (и се плаща), щом имаш завършена жп линия
// или магистрала от града на доставчика до някой от твоите градове. Ако не я направиш до срока — договорът пропада.
// Записът е в S.supply = { offers: [...], deals: [...] } (общ за фирмата, не за града).
// deps: S(), econ(), MATERIALS, FACTORIES, cityName(id), rail(a, b) → bool, road(a, b) → bool, ownedCities(),
//       toast, fmt, save, sound, onRailDelivery(text), isForeign(id), cityOk?(id) — градът е отключен за оферти
import { t } from './i18n.js';   // 🌐 lang-en: количеството — мярката и материалът поотделно през речника („164 м³ бетон“)
const qtyTxt = (q, M) => `${q} ${t(M.unit)} ${t(M.nm).toLowerCase()}`;   // на БГ — същото като преди
const OFFER_DAYS = 6, DEAL_DAYS = 90, MAX_OFFERS = 3;
// количества за една оферта (в единиците на материала)
const LOT = { sand: 300, gravel: 300, concrete: 150, bricks: 40, steel: 20, wood: 60, glass: 300, furniture: 30, marble: 250 };
const rnd = (a, b) => a + Math.random() * (b - a);

export function createSupply(deps) {
  const st = () => { const S = deps.S(); S.supply = S.supply || { offers: [], deals: [] }; return S.supply; };
  const linkOf = from => {
    for (const c of deps.ownedCities()) {
      if (c === from) return { via: 'local', to: c };
      if (deps.rail(from, c)) return { via: 'rail', to: c };
    }
    for (const c of deps.ownedCities()) if (deps.road(from, c)) return { via: 'road', to: c };
    return null;
  };

  function makeOffer() {
    const S = deps.S(), mine = new Set(deps.ownedCities());
    // доставчици извън твоите градове; чуждите и далечните имат по-голяма отстъпка
    const pool = deps.FACTORIES.filter(f => !mine.has(f.cityId) && deps.MATERIALS[f.materialId] && (!deps.cityOk || deps.cityOk(f.cityId)) && !st().offers.some(o => o.from === f.cityId && o.mat === f.materialId));
    if (!pool.length) return;
    const f = pool[(Math.random() * pool.length) | 0], M = deps.MATERIALS[f.materialId];
    const qty = Math.round((LOT[f.materialId] || 50) * rnd(0.7, 1.4));
    const disc = Math.round(rnd(deps.isForeign(f.cityId) ? 0.30 : 0.22, deps.isForeign(f.cityId) ? 0.45 : 0.35) * 100) / 100;
    const value = qty * M.buyPrice, price = Math.round(value * (1 - disc) / 100) * 100;
    st().offers.push({ id: (S.seq = (S.seq || 1) + 1), from: f.cityId, fname: f.nm, mat: f.materialId, qty, value, price, disc, expires: S.day + OFFER_DAYS });
    deps.toast(`📜 Оферта от ${deps.cityName(f.cityId)}: ${M.ico} ${qtyTxt(qty, M)} с −${Math.round(disc * 100)}%. Виж картата → „Оферти“.`, 'good');
  }

  function accept(id) {
    const s = st(), o = s.offers.find(q => q.id === id); if (!o) return;
    s.offers.splice(s.offers.indexOf(o), 1);
    s.deals.push({ ...o, deadline: deps.S().day + DEAL_DAYS });
    const l = linkOf(o.from);
    deps.toast(l ? `🤝 Договорът с ${deps.cityName(o.from)} е сключен — стоката тръгва.` : `🤝 Договорът е сключен. Построй жп линия или магистрала до ${deps.cityName(o.from)} до ${DEAL_DAYS} дни, за да получиш стоката.`, 'good');
    deps.sound('buy');
    tryDeliver();
    deps.save();
  }
  function decline(id) { const s = st(); s.offers = s.offers.filter(q => q.id !== id); deps.save(); }

  // доставка на всички договори с връзка (вика се всеки ден и при приемане)
  function tryDeliver() {
    const s = st(), econ = deps.econ();
    for (const d of [...s.deals]) {
      const l = linkOf(d.from); if (!l) continue;
      const M = deps.MATERIALS[d.mat];
      if (!econ.canAfford(d.price)) { if (!d.warned) { d.warned = true; deps.toast(`⚠️ Стоката от ${deps.cityName(d.from)} е готова, но нямаш ${deps.fmt(d.price)} € да я платиш.`, 'bad'); } continue; }
      econ.spend(d.price, 'материали', `Договор: ${M.nm} от ${deps.cityName(d.from)}`);
      econ.s.stock[d.mat] = (econ.s.stock[d.mat] || 0) + d.qty;
      s.deals.splice(s.deals.indexOf(d), 1);
      const txt = `${l.via === 'rail' ? '🚆' : l.via === 'road' ? '🚛' : '📦'} ${qtyTxt(d.qty, M)} от ${deps.cityName(d.from)} пристигнаха в склада (спести ${deps.fmt(d.value - d.price)} €).`;
      if (l.via === 'rail' && deps.onRailDelivery) deps.onRailDelivery(txt); else deps.toast(txt, 'good');
      deps.sound('cash');
    }
  }
  function dailyTick() {
    const s = st(), day = deps.S().day;
    s.offers = s.offers.filter(o => o.expires >= day);
    for (const d of [...s.deals]) if (d.deadline < day) {
      s.deals.splice(s.deals.indexOf(d), 1);
      deps.toast(`❌ Договорът за ${deps.MATERIALS[d.mat].nm.toLowerCase()} от ${deps.cityName(d.from)} пропадна — нямаше връзка навреме.`, 'bad');
    }
    tryDeliver();
    if ((!deps.canOffer || deps.canOffer()) && s.offers.length < MAX_OFFERS && Math.random() < 0.3) makeOffer();
  }

  function hudHtml() {
    const s = st();
    if (deps.canOffer && !deps.canOffer() && !s.offers.length && !s.deals.length)
      return `<div class="sect">📜 Оферти от доставчици</div><div class="meta">🔒 Отключват се на <b>ниво 5 на развитие</b> (сега: ${deps.devLevel ? deps.devLevel() : '?'})${deps.balkans && !deps.balkans() ? ' и с отключени Балканите (3 ★)' : ''}.</div>`;
    if (!s.offers.length && !s.deals.length) return '';
    let h = `<div class="sect">📜 Оферти от доставчици</div>`;
    for (const d of s.deals) {
      const M = deps.MATERIALS[d.mat], l = linkOf(d.from);
      h += `<div class="meta">🤝 <b style="color:var(--txt)">${M.ico} ${qtyTxt(d.qty, M)}</b> от ${deps.cityName(d.from)} · ${deps.fmt(d.price)} €<br>${l ? '🚚 доставя се…' : `<span class="late">чака жп линия или магистрала до ${deps.cityName(d.from)} · остават ${d.deadline - deps.S().day} дни</span>`}</div>`;
    }
    for (const o of s.offers) {
      const M = deps.MATERIALS[o.mat], l = linkOf(o.from);
      h += `<div class="card" style="padding:8px 10px"><div class="meta" style="margin:0"><b style="color:var(--txt)">${M.ico} ${qtyTxt(o.qty, M)}</b> · ${o.fname}<br><s>${deps.fmt(o.value)} €</s> <b style="color:var(--ok)">${deps.fmt(o.price)} €</b> (−${Math.round(o.disc * 100)}%) · важи до ден ${o.expires}<br>${l ? `✅ Има връзка (${l.via === 'rail' ? 'жп' : l.via === 'road' ? 'магистрала' : 'същия град'}) — стоката идва веднага` : `🔗 Нужна е жп линия или магистрала до ${deps.cityName(o.from)}`}</div>
        <div class="row" style="justify-content:flex-end;margin-top:4px;gap:6px"><button class="btn2" data-sdec="${o.id}">Откажи</button><button class="btn" data-sacc="${o.id}">Приеми</button></div></div>`;
    }
    return h;
  }
  function bind(box, rerender) {
    box.querySelectorAll('[data-sacc]').forEach(b => b.onclick = () => { accept(+b.dataset.sacc); rerender(); });
    box.querySelectorAll('[data-sdec]').forEach(b => b.onclick = () => { decline(+b.dataset.sdec); rerender(); });
  }
  return { dailyTick, tryDeliver, hudHtml, bind, makeOffer, state: st, accept, linkOf };
}
