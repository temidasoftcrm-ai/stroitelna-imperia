// tasks.js — „📋 Задачи“: всичко, което чака твоето решение, на едно място — какво да купиш (влак 4/15, самолет 6/7, кораб 10/20,
// ТИР-ове), какво да обновиш (офис, склад, гараж, гара, летище, пристанище), кои градове още не са свързани (жп, магистрала,
// пристанище, летище) и кои градове току-що завърши. Бутон горе с броя; бутоните вътре са същите като в другите прозорци
// (data-upg, data-airport, data-port, data-hlink, data-hrail, data-goto — game.js ги връзва във всеки голям прозорец).
// deps: { S(), fmt, ready(), open(), openKind(k), cityName(id), fleet() → { train: [имаш, макс], plane, ship, truck }, upg() → [{ id, kind, lv, cost, nm, ico }],
//         hints(kind) → [{ ids, txt, btn }], airUps() / portUps() → [{ id, lv, cost }], finished() → [{ id, day, daily }] }
const FLEET = [
  ['train', '🚆', 'Влакове', 'влак', 'rail', 'Отвори ЖП'],
  ['plane', '✈️', 'Самолети', 'самолет', 'air', 'Отвори летищата'],
  ['ship', '🚢', 'Кораби', 'кораб', 'sea', 'Отвори пристанищата'],
  ['truck', '🚛', 'ТИР-ове', 'ТИР', 'hw', 'Отвори магистралите'],
];
const HINTS = [['rail', '🛤️ Жп линии'], ['hw', '🛣️ Магистрали'], ['sea', '⚓ Пристанища'], ['air', '✈️ Летища']];
const RECENT = 30;   // завършените градове — последните 30 дни

export function createTasks(deps) {
  const f = n => deps.fmt(n), safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  function collect() {
    const fl = safe(deps.fleet, {}), out = { fleet: [], upg: safe(deps.upg, []), air: safe(deps.airUps, []), port: safe(deps.portUps, []), hints: [], fin: [] };
    for (const [k, ico, nm, one, win, btn] of FLEET) { const [n, cap] = fl[k] || [0, 0]; if (cap > n) out.fleet.push({ k, ico, nm, one, win, btn, n, cap }); }
    for (const [k, nm] of HINTS) { const L = safe(() => deps.hints(k), []).filter(r => /<button/.test(r.btn || '') && !/disabled|На опашка|на опашка/.test(r.btn || '')); if (L.length) out.hints.push({ k, nm, L }); }   // „на опашка“, „строи се“ — не са задачи
    const day = deps.S().day || 0;
    out.fin = safe(deps.finished, []).filter(x => x.day != null && day - x.day <= RECENT).sort((a, b) => b.day - a.day);
    return out;
  }
  // броят в бутона — видовете задачи (не всеки ред): иначе при стотици градове е стотици
  const count = c => c.fleet.length + (c.upg.length ? 1 : 0) + (c.air.length ? 1 : 0) + (c.port.length ? 1 : 0) + c.hints.length + (c.fin.length ? 1 : 0);
  const more = (n, list) => list.length ? `<details style="margin:2px 0 4px"><summary class="meta" style="cursor:pointer;margin:0">▸ виж ${n}</summary>${list.join('')}</details>` : '';
  const row = (txt, btn = '') => `<div class="row" style="margin:4px 0;gap:8px;align-items:center"><span class="meta" style="margin:0;flex:1">${txt}</span>${btn}</div>`;
  const card = (title, n, body) => `<div class="card"><h3 style="margin:0 0 6px;display:flex;align-items:center;gap:8px">${title}${n ? `<span class="meta" style="margin:0 0 0 auto">${n}</span>` : ''}</h3>${body}</div>`;

  function winHtml() {
    const c = collect(), N = count(c);
    let h = `<div class="meta" style="margin:0 0 8px">📋 Тук е всичко, което чака твоето решение: какво можеш да купиш, какво да обновиш и кои градове още не са свързани. ${N ? `Видове задачи: <b style="color:var(--txt)">${N}</b>.` : '<b style="color:var(--ok)">Всичко е наред — няма чакащи задачи.</b>'}</div>`;
    if (c.fleet.length) h += card('🛒 Купи', c.fleet.length, c.fleet.map(x => row(`${x.ico} <b style="color:var(--txt)">${x.nm} ${x.n}/${x.cap}</b> — можеш да купиш още <b style="color:var(--txt)">${x.cap - x.n}</b>`, `<button class="btn2" data-tkopen="${x.win}">${x.btn}</button>`)).join(''));
    if (c.upg.length || c.air.length || c.port.length) {
      const cheap = L => [...L].sort((a, b) => a.cost - b.cost)[0];
      let u = '';
      if (c.upg.length) u += row(`🏢 <b style="color:var(--txt)">Сгради</b> (офис, склад, гараж, гара): ${c.upg.length} подобрения за ${f(c.upg.reduce((a, x) => a + x.cost, 0))} €`, `<button class="btn" data-upgall>✅ Обнови всички</button>`)
        + more(`всички ${c.upg.length}`, c.upg.slice(0, 40).map(x => row(`${x.ico} ${x.nm} в <b style="color:var(--txt)">${deps.cityName(x.id)}</b> → ниво ${x.lv + 1}`, `<button class="btn2" data-upg="${x.id}|${x.kind}">⬆️ ${f(x.cost)} €</button>`)));
      if (c.air.length) { const x = cheap(c.air); u += row(`✈️ <b style="color:var(--txt)">Летища</b>: ${c.air.length} могат да се разширят · най-евтино — ${deps.cityName(x.id)} (ниво ${x.lv + 1})`, `<button class="btn2" data-airport="${x.id}">⬆️ ${f(x.cost)} €</button>`)
        + more(`всички ${c.air.length}`, [...c.air].sort((a, b) => a.cost - b.cost).slice(0, 30).map(a => row(`✈️ ${deps.cityName(a.id)} → ниво ${a.lv + 1}`, `<button class="btn2" data-airport="${a.id}">⬆️ ${f(a.cost)} €</button>`))); }
      if (c.port.length) { const x = cheap(c.port); u += row(`⚓ <b style="color:var(--txt)">Пристанища</b>: ${c.port.length} могат да се разширят · най-евтино — ${deps.cityName(x.id)} (ниво ${x.lv + 1})`, `<button class="btn2" data-port="${x.id}">⬆️ ${f(x.cost)} €</button>`)
        + more(`всички ${c.port.length}`, [...c.port].sort((a, b) => a.cost - b.cost).slice(0, 30).map(p => row(`⚓ ${deps.cityName(p.id)} → ниво ${p.lv + 1}`, `<button class="btn2" data-port="${p.id}">⬆️ ${f(p.cost)} €</button>`))); }
      h += card('⬆️ Обнови', 0, u);
    }
    for (const x of c.hints) h += card(`🔗 ${x.nm} — какво липсва`, x.L.length, x.L.slice(0, 3).map(r => row(r.txt, r.btn)).join('') + (x.L.length > 3 ? row(`… и още ${x.L.length - 3}`, `<button class="btn2" data-tkopen="${x.k}">Виж всички</button>`) : ''));
    if (c.fin.length) h += card('🏁 Завършени градове', c.fin.length, c.fin.slice(0, 10).map(x => row(`🏁 <b style="color:var(--txt)">${deps.cityName(x.id)}</b> е завършен на ден ${x.day}${x.daily ? ` · носи ~${f(x.daily)} €/ден` : ''}`)).join('') + row('Градовете работят сами. В „🏙️ Градове“ можеш да ги оставиш (👋), за да не са в списъка.', `<button class="btn2" data-tkopen="cities">🏙️ Градове</button>`));
    return h;
  }
  function bind(box, rerender) {
    box.querySelectorAll('[data-tkopen]').forEach(b => b.onclick = () => deps.openKind(b.dataset.tkopen));
  }

  // бутонът горе: „📋 Задачи N“ (броят се опреснява на 3 s; без задачи — само иконата)
  let btn = null, last = -1;
  function mount() {
    const top = document.getElementById('top'); if (!top || btn) return;
    btn = document.createElement('button'); btn.id = 'btnTasks'; btn.className = 'btn2'; btn.title = 'Задачи: какво да купиш, обновиш и свържеш';
    btn.onclick = () => deps.open();
    const tips = document.getElementById('btnTips'); if (tips && tips.parentNode === top) top.insertBefore(btn, tips); else top.appendChild(btn);
  }
  function refresh() {
    if (!deps.ready()) return; mount(); if (!btn) return;
    const n = count(collect()); if (n === last) return; last = n;
    btn.innerHTML = n ? `📋 <b style="color:#ffd54a">${n}</b>` : '📋';
  }
  if (typeof document !== 'undefined') setInterval(() => { try { refresh(); } catch (e) {} }, 3000);
  return { winHtml, bind, collect, count: () => count(collect()), refresh };
}
