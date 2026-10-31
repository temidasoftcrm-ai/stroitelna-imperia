// conquest.js — „Завладяване“: колко % от всеки континент е твой.
// Броят се: завладени държави, завършени участъци магистрала и аутобан, пристанища и летища (построени от теб).
// Процентът е общият брой завладени неща / всички неща на континента (напр. 3/10 + 5/10 + 2/5 + 3/30 + 1/20 = 14/75 ≈ 19%).
// deps: { cities() → [id], contOf(id) → 'af'|'na'|'sa'|'as'|'oc'|null (null = Европа), conts() → [{ key, nm, ico }],
//         countries() → [{ cc, nm, cities }], isFinished(id), hwSegs() → [{ id, a, b }], abSegs() → [{ id, a, b }], hwDone() → [id],
//         portMax(id), portLv(id), airMax(id), airLv(id), modal(title, html, buttons) }
const EU = { key: 'eu', nm: 'Европа', ico: '🇪🇺' };
const CATS = [
  { key: 'countries', ico: '🏳️', nm: 'Държави' },
  { key: 'hw', ico: '🛣️', nm: 'Магистрали' },
  { key: 'ab', ico: '🔴', nm: 'Аутобани' },
  { key: 'ports', ico: '⚓', nm: 'Пристанища' },
  { key: 'air', ico: '✈️', nm: 'Летища' },
];

export function createConquest(deps) {
  const contKey = id => deps.contOf(id) || 'eu';
  const all = () => [EU, ...deps.conts().map(k => ({ key: k.key, nm: k.nm, ico: k.ico }))];

  // { eu: { countries: [done, total], hw: [...], ..., done, total, pct }, af: {...}, ... }
  function stats() {
    const out = {};
    for (const k of all()) { out[k.key] = { done: 0, total: 0, pct: 0 }; for (const c of CATS) out[k.key][c.key] = [0, 0]; }
    const add = (cont, cat, ok) => { const r = out[cont]; if (!r) return; r[cat][1]++; if (ok) r[cat][0]++; };
    for (const k of deps.countries()) add(contKey(k.cities[0]), 'countries', k.cities.every(id => deps.isFinished(id)));
    const done = new Set(deps.hwDone());
    for (const s of deps.hwSegs()) add(contKey(s.a), 'hw', done.has(s.id));
    for (const s of deps.abSegs()) if (!s.spur) add(contKey(s.a), 'ab', done.has(s.id));
    for (const id of deps.cities()) {
      if (deps.portMax(id) > 0) add(contKey(id), 'ports', deps.portLv(id) > 0);
      if (deps.airMax(id) > 0) add(contKey(id), 'air', deps.airLv(id) > 0);
    }
    for (const r of Object.values(out)) {
      for (const c of CATS) { r.done += r[c.key][0]; r.total += r[c.key][1]; }
      r.pct = r.total ? Math.round(r.done / r.total * 100) : 0;
    }
    return out;
  }

  // какво точно остава до 100% (feature 'conquest-board' — директорите го предлагат): същите правила като stats()
  // { hw: [segId], ab: [segId], ports: [cityId], air: [cityId], countries: [{ cc, nm, cities: [незавършени] }], total, done }
  function missing() {
    const done = new Set(deps.hwDone()), m = { hw: [], ab: [], ports: [], air: [], countries: [], total: 0, done: 0 };
    for (const k of deps.countries()) { const left = k.cities.filter(id => !deps.isFinished(id)); m.total++; if (left.length) m.countries.push({ cc: k.cc, nm: k.nm, cities: left }); else m.done++; }
    for (const s of deps.hwSegs()) { m.total++; if (done.has(s.id)) m.done++; else m.hw.push(s.id); }
    for (const s of deps.abSegs()) if (!s.spur) { m.total++; if (done.has(s.id)) m.done++; else m.ab.push(s.id); }
    for (const id of deps.cities()) {
      if (deps.portMax(id) > 0) { m.total++; if (deps.portLv(id) > 0) m.done++; else m.ports.push(id); }
      if (deps.airMax(id) > 0) { m.total++; if (deps.airLv(id) > 0) m.done++; else m.air.push(id); }
    }
    return m;
  }

  // 📍 conquest-left (собственикът: „на Африка съм 98%, но не знам кои държави и градове остават“): под континента от 80% нагоре —
  // какво точно липсва; градът е бутон, който го показва на картата (deps.go)
  const LEFT_MAX = 14;
  function leftHtml(ck, r) {
    if (!deps.left || !deps.left() || r.pct >= 100 || (r.pct < 80 && !globalThis.__cqAll)) return '';   // __cqAll — тест: и под 80%
    const m = missing(), nm = id => deps.cityName ? deps.cityName(id) : id, inC = id => contKey(id) === ck;
    const city = id => `<button class="btn2" data-cqgo="${id}" style="padding:1px 7px;font-size:12px;margin:2px 3px 2px 0">${nm(id)}</button>`;
    const items = [];
    for (const k of m.countries) if (inC(k.cities[0])) items.push(`🏳️ <b style="color:var(--txt)">${k.cc} ${k.nm}</b> — незавършени: ${k.cities.map(city).join('')}`);
    const segs = (ids, ico, lbl) => { const L = ids.map(id => deps.segEnds && deps.segEnds(id)).filter(e => e && inC(e[0])); if (L.length) items.push(`${ico} ${lbl}: ${L.slice(0, LEFT_MAX).map(([a, b]) => `${city(a)}— ${city(b)}`).join(' · ')}${L.length > LEFT_MAX ? ' …' : ''}`); };
    segs(m.hw, '🛣️', 'Магистрали'); segs(m.ab, '🔴', 'Аутобани');
    const pl = (ids, ico, lbl) => { const L = ids.filter(inC); if (L.length) items.push(`${ico} ${lbl}: ${L.slice(0, LEFT_MAX).map(city).join('')}${L.length > LEFT_MAX ? ' …' : ''}`); };
    pl(m.ports, '⚓', 'Пристанища'); pl(m.air, '✈️', 'Летища');
    return items.length ? `<div style="margin-top:6px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);font-size:12px;line-height:1.9;color:var(--mut)"><b style="color:var(--acc)">📍 До 100% остава:</b><br>${items.join('<br>')}</div>` : '';
  }

  const bar = (pct, h = 8) => `<div style="height:${h}px;border-radius:${h}px;background:rgba(255,255,255,.08);overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--acc),var(--ok))"></div></div>`;

  function html() {
    const st = stats();
    let world = [0, 0];
    const rows = all().map(k => {
      const r = st[k.key]; world[0] += r.done; world[1] += r.total;
      const cats = CATS.filter(c => r[c.key][1]).map(c => `<span style="white-space:nowrap;margin-right:10px">${c.ico} ${c.nm} <b>${r[c.key][0]}/${r[c.key][1]}</b></span>`).join('');
      return `<div style="margin:0 0 14px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><b>${k.ico} ${k.nm}</b><b style="color:var(--acc);font-size:18px">${r.pct}%</b></div>
        ${bar(r.pct)}
        <div style="color:var(--mut);font-size:12px;margin-top:5px;line-height:1.7">${cats}</div>${leftHtml(k.key, r)}</div>`;
    }).join('');
    const wp = world[1] ? Math.round(world[0] / world[1] * 100) : 0;
    return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><b>🌍 Целият свят</b><b style="color:var(--ok);font-size:22px">${wp}%</b></div>${bar(wp, 12)}</div>${rows}
      <div style="color:var(--mut);font-size:12px">Държава е завладяна, когато завършиш всичките ѝ ключови градове. Пристанищата и летищата се броят, щом построиш първото ниво.</div>`;
  }

  const open = () => { deps.modal('🏆 Завладяване', html(), [['Добре', null]]);
    if (deps.go) document.querySelectorAll('[data-cqgo]').forEach(b => b.onclick = () => deps.go(b.dataset.cqgo)); };
  return { stats, html, open, missing };
}
