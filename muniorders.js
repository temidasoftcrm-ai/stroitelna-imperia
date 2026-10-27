// muniorders.js — 🏛️ поръчките на общината (D2) в градовете по истинската карта (план v2 — Рим, после Истанбул…).
// Общината следи покритието на услугите (services.js: болници, училища, пожарни…) и когато нещо не стига, обявява поръчка:
// какво, в кой квартал (servicesplace.js намира поредица свободни парцели), бюджет и срок. Приемаш ли я, фирмата строи:
// аванс 20% при подписването, материалите се плащат всеки ден (60% от бюджета, разпределени по срока), остатъкът 60% — при
// предаването (печалба ~20%). Ако нямаш пари за деня, строежът стои. Готовата сграда влиза в S.svc и се вижда в 3D.
// Записи: S.svc[cityId] = { [k]: [{ lvl, built, lots }] } (services.js) · S.muni[cityId] = { offer, job, done, skip }.
// deps: { S(), cityId(), plan() (city.plan — gamePlan2), lots() (city.lots — същите id като plan.lots), econ(), toast(msg, kind),
//   fmt, save(), sound(n), addXp(n), addRep(d), cityName(id), sz(id), mega(id), built() (брой построени обекти в града), ext(), extMax(),
//   lv() (нивото на фирмата), group() (city.group), night() → bool, label?, emergencyIf?(item) (group.js — извънредно заседание) }
import { needs, builds, seedBase, cityServices, popOf, tierOf, costOf, daysOf, SERVICES } from './services.js';
import { servicePlacer, servicesLayer, serviceSite } from './servicesplace.js';

export const MUNI = { lv: 6, offerDays: 12, gap: 6, adv: 0.2, mat: 0.6, fin: 0.6 };

export function createMuni(deps) {
  const day = () => deps.S().day, f = n => deps.fmt(Math.round(n));
  const on = () => { const P = deps.plan(); return !!(P && P.p2 && P.osm); };   // само градовете по истинската карта (там общината строи на мястото на фоновите квартали)
  const id = () => deps.cityId();
  const tier = () => tierOf(deps.sz(id()), deps.mega(id()));
  const pop = () => popOf(deps.sz(id()), deps.mega(id()), deps.built(), deps.ext(), deps.extMax());
  const rec = () => { const S = deps.S(); S.svc = S.svc || {}; return S.svc[id()] = S.svc[id()] || seedBase({}, tier(), day()); };
  const st = () => { const S = deps.S(); S.muni = S.muni || {}; return S.muni[id()] = S.muni[id()] || { offer: null, job: null, done: 0, skip: 0 }; };
  // планът с живите парцели на града (зает/свободен) — за servicePlacer
  const gp = () => ({ ...deps.plan(), lots: deps.lots() });
  // за разполагането: чуждите фонови квартали ('bg') се броят за свободни — общината строи там, а свободните парцели остават за теб
  const gpBg = () => ({ ...deps.plan(), lots: deps.lots().map(l => l.busy === 'bg' ? { ...l, busy: null } : l) });
  const nm = k => SERVICES[k]?.nm || k, ico = k => SERVICES[k]?.ico || '🏛️';
  let layer = null, sites = [], gen = 0;   // gen — draw() е async: по-старо рисуване, свършило след clear(), не добавя нищо

  // при влизане в града: парцели за базовите сгради (веднъж), заетите парцели — 'svc'; връща p2-id-тата им (за fillLot на 3D изгледа)
  function attach() {
    if (!on()) return new Set();
    const R = rec(), L = deps.lots(), sp = servicePlacer(gpBg());
    sp.assign(R);
    const used = new Set(), mark = ids => { for (const i of ids || []) { const l = L[i]; if (!l) continue; if (!l.busy || l.busy === 'bg') l.busy = 'svc'; used.add(l.p2); } };
    for (const list of Object.values(R)) for (const b of list) mark(b.lots);
    const s = st(); if (s.job) mark(s.job.lots); if (s.offer) for (const i of s.offer.lots || []) { const l = L[i]; if (l && l.busy) { s.offer = null; break; } }
    return used;
  }
  // 3D: готовите сгради (services3d.js) + скелета/кран на текущия строеж
  async function draw(THREE) {
    if (!on()) return;
    clear(); const my = gen;
    const g = deps.group(); if (!g) return;
    try { const ly = await servicesLayer(gp(), rec(), { region: 'eu', hallTop: deps.hallTop ? deps.hallTop() : null, blocks: deps.blocks ? deps.blocks() : null, trees: deps.trees ? deps.trees() : null });   /* блоковете наоколо — за височината (svc-height) */ if (my !== gen || deps.group() !== g) { ly.dispose(); return; } layer = ly; if (setNight.n) ly.setNight(true); g.add(layer.group); layer.setNight(deps.night()); } catch (e) { console.warn('muni 3D', e); }
    const s = st(); if (s.job && s.job.lots && s.job.lots.length) {   // строителната площадка (servicesplace.js serviceSite: ограда, скелет по етажи, кран, контейнери)
      const p = servicePlacer(gp()).spot(s.job.k, s.job.lvl, s.job.lots), site = await serviceSite(s.job.k, s.job.lvl, p, s.job.prog || 0);
      if (my !== gen || deps.group() !== g) { site.dispose(); return; } site.group.position.set(p.x, 0, p.z); site.group.rotation.y = p.rot; g.add(site.group); sites.push(site); }
  }
  function clear() { gen++; if (layer) { layer.group.parent?.remove(layer.group); layer.dispose(); layer = null; } for (const o of sites) o.dispose(); sites = []; }
  const setNight = n => { setNight.n = n; if (layer) layer.setNight(n); };   // одитът №5: запомня се — новият слой (draw) светва веднага, ако е нощ

  // всеки ден: нова поръчка, когато няма; строежът напредва, ако има пари за материалите
  function dailyTick() {
    if (!on()) return;
    const s = st(), d = day(), e = deps.econ();
    if (s.job) {
      const j = s.job, perDay = j.cost * MUNI.mat / j.days;
      if (e.canAfford(perDay)) { e.spend(perDay, 'материали', `${nm(j.k)} (общината на ${deps.cityName(id())})`); j.prog = Math.min(1, (j.prog || 0) + 1 / j.days); j.stuck = 0; }
      else if (!j.stuck++) deps.toast(`🏛️ ${ico(j.k)} ${nm(j.k)}: строежът спря — няма пари за материалите (${f(perDay)} € на ден).`, 'bad');
      if (j.prog >= 1) finish();
      return;
    }
    if (s.offer && d > s.offer.until) { deps.toast(`🏛️ Общината даде поръчката „${nm(s.offer.k)}“ на друга фирма.`, ''); s.offer = null; s.skip = d + MUNI.gap; }
    if (s.offer || d < (s.skip || 0) || deps.lv() < MUNI.lv) return;
    // най-нужната услуга, която се побира: ако голямата сграда няма място в тесния град — по-малка (m, s), иначе следващата нужда
    const sp = servicePlacer(gpBg()), taken = deps.lots().filter(l => (l.busy && l.busy !== 'bg') || l.built).map(l => l.id);
    let n = null, p = null;
    for (const c of needs(rec(), pop(), tier()).slice(0, 5)) { for (const lv of [c.lvl, 'm', 's'].filter((v, i, a) => SERVICES[c.k].lot[v] && a.indexOf(v) === i)) { p = sp.place(c.k, lv, rec(), taken); if (p) { n = { ...c, lvl: lv, cost: costOf(c.k, lv), days: daysOf(c.k, lv) }; break; } } if (n) break; }
    if (!n) { s.skip = d + MUNI.gap * 3; return; }
    s.offer = { k: n.k, lvl: n.lvl, cost: n.cost, days: n.days, why: n.why, lots: p.lots, district: p.district, until: d + MUNI.offerDays };
    // ⛔ голяма поръчка спрямо касата (над 25%) при холдинг с директори → извънредно заседание (group.js emergencyIf)
    const of = s.offer; if (deps.emergencyIf && deps.emergencyIf({ id: `muni:${id()}:${d}`, ico: ico(n.k), short: `${nm(n.k)} — ${deps.cityName(id())}`, dir: 'con', value: n.cost, cost: Math.round(n.cost * MUNI.mat), days: n.days, until: of.until,
      text: `Общината на ${deps.cityName(id())} възлага ${nm(n.k).toLowerCase()} в ${p.district} — ${f(n.cost)} €, аванс ${Math.round(MUNI.adv * 100)}%.`, gainTxt: `${f(n.cost * (1 - MUNI.mat))} € печалба`,
      live: () => st().offer === of, accept: () => accept(), decline: () => decline() })) return;
    deps.toast(`🏛️ Общината на ${deps.cityName(id())} обявява поръчка: ${ico(n.k)} ${nm(n.k)} в ${p.district} — ${f(n.cost)} €. Виж „Поръчки“.`, 'good');
    deps.sound && deps.sound('offer');
  }
  function accept() {
    const s = st(), o = s.offer; if (!o || s.job) return false;
    const L = deps.lots(); if (o.lots.some(i => !L[i] || (L[i].busy && L[i].busy !== 'bg'))) { s.offer = null; deps.toast('Парцелите вече са заети — общината ще обяви нова поръчка.', ''); return false; }
    for (const i of o.lots) L[i].busy = 'svc';
    s.job = { k: o.k, lvl: o.lvl, lots: o.lots, cost: o.cost, days: o.days, start: day(), prog: 0, district: o.district }; s.offer = null;
    deps.econ().earn(o.cost * MUNI.adv, 'обект', `Аванс от общината: ${nm(o.k)}`);
    deps.toast(`✍️ Подписа с общината: ${ico(o.k)} ${nm(o.k)} в ${o.district}. Аванс +${f(o.cost * MUNI.adv)} €, срок ${o.days} дни.`, 'good');
    deps.sound && deps.sound('cash'); deps.save(); deps.redraw && deps.redraw();
    return true;
  }
  function decline() { const s = st(); if (!s.offer) return; s.offer = null; s.skip = day() + MUNI.gap; deps.save(); }
  function finish() {
    const s = st(), j = s.job; if (!j) return;
    const R = rec(); builds(R, j.k, j.lvl, day()); R[j.k][R[j.k].length - 1].lots = j.lots;
    deps.econ().earn(j.cost * MUNI.fin, 'обект', `Общината: ${nm(j.k)} е предадена`);
    s.job = null; s.done = (s.done || 0) + 1; s.skip = day() + MUNI.gap;
    deps.addXp && deps.addXp(Math.round(800 + j.cost / 20000)); deps.addRep && deps.addRep(0.05);
    deps.toast(`🎉 ${ico(j.k)} ${nm(j.k)} в ${j.district} е готова! Общината плати +${f(j.cost * MUNI.fin)} €.`, 'good');
    deps.sound && deps.sound('done'); deps.save(); deps.redraw && deps.redraw();
  }
  // картата в „Поръчки“: офертата / строежът / покритието на услугите
  function cardHtml() {
    if (!on()) return '';
    const s = st(), cn = deps.cityName(id());
    let h = `<div class="card" style="border:1px solid #6aa0d8"><h3>🏛️ Общината на ${cn}</h3>`;
    if (s.job) { const j = s.job; h += `<div class="meta">${ico(j.k)} <b style="color:var(--txt)">${nm(j.k)}</b> в ${j.district} · ${Math.round(j.prog * 100)}% · остават ~${Math.max(0, Math.ceil((1 - j.prog) * j.days))} дни${j.stuck ? ' · <b style="color:var(--bad)">спрял — няма пари за материалите</b>' : ''}</div><div class="bar" style="margin:6px 0"><i style="width:${Math.round(j.prog * 100)}%"></i></div>`; }
    else if (s.offer) { const o = s.offer, ok = deps.lv() >= MUNI.lv;
      h += `<div class="meta">${ico(o.k)} <b style="color:var(--txt)">${nm(o.k)}</b> в ${o.district} · бюджет <b style="color:var(--ok)">${f(o.cost)} €</b> · ${o.days} дни · офертата е до ден ${o.until}</div>
        <div class="meta" style="margin:2px 0 6px">Защо: ${o.why}. Аванс ${Math.round(MUNI.adv * 100)}%, материалите — всеки ден (~${f(o.cost * MUNI.mat / o.days)} €), остатъкът при предаването (печалба ~${f(o.cost * (MUNI.adv + MUNI.fin - MUNI.mat))} €).</div>
        <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn2" data-muni="no">Откажи</button><button class="btn" data-muni="yes" ${ok ? '' : 'disabled'}>✍️ Приеми</button></div>`; }
    else h += `<div class="meta">${deps.lv() < MUNI.lv ? `Поръчките на общината идват от ниво ${MUNI.lv} на фирмата.` : 'Засега няма нова поръчка — общината следи покритието на услугите.'}</div>`;
    const list = cityServices(rec(), pop(), tier()).filter(x => x.need > 0).slice(0, 4);
    if (list.length) h += `<div class="meta" style="margin-top:6px">Не стигат: ${list.map(x => `${x.ico} ${x.nm} ${Math.round(Math.min(1, x.cover) * 100)}%`).join(' · ')}</div>`;
    return h + '</div>';
  }
  // #11 (emerg-home): участъците/болниците/пожарните в града — оттам тръгват спешните коли при инцидент и там се връщат
  const stations = () => { try { return on() ? servicePlacer(gp()).spots(rec()).map(s => ({ k: s.k, x: s.x, z: s.z })) : []; } catch (e) { return []; } };
  return { nm: k => `${ico(k)} ${nm(k).toLowerCase()}`, attach, draw, clear, setNight, dailyTick, accept, decline, cardHtml, state: st, rec, on, stations };
}
