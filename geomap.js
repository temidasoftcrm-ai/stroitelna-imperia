// geomap.js — 🌍 режим „Геополитика“ върху съществуващата карта (същите географски данни — world.json и proj от game.js, без второ копие).
// Водещи са държавите, кризите и договореностите: един слой наведнъж (Дипломация · Кризи · Доставки), панел на избраната държава
// или криза с контекстни действия, „Изисква решение“ вляво и „Път към световен мир“ отдолу. Политиката се смята по игрови ход
// (president.js); тук само рисуваме — при смяна на изгледа или на данните.
import { POL, NEED, AID, CONFLICTS, PEACE } from './worldpol.js';
import { HZ_PARTNERS, PREF } from './president.js';
import { t as tr } from './i18n.js';

// морските коридори през Ормуз (алтернативна игрова хронология); [lon, lat]
const HZ_PT = [56.3, 26.6];
const ROUTES = {
  europe: { nm: 'Към Европа през Суец', pts: [[56.3, 26.6], [57.2, 25.3], [60.2, 22.6], [58.6, 17.6], [53, 13.6], [47, 12.4], [43.4, 12.6], [41.6, 14.6], [38.8, 19.4], [36, 23.2], [34.2, 27.2], [32.6, 29.9], [32.35, 31.3], [28, 33.5], [18, 36], [11, 37.6], [5, 37.8], [-1, 36.5], [-5.6, 35.95], [-9.8, 37.2], [-10.4, 43.2], [-5.5, 48], [-1.5, 50], [2, 51.2], [4, 52.2]] },
  asia: { nm: 'Към Азия през Малака', pts: [[56.3, 26.6], [57.2, 25.3], [60.2, 22.6], [66, 18], [74, 10], [80.5, 5.4], [88, 5.6], [94.5, 6.6], [98, 4.8], [100.6, 2.6], [103.8, 1.2], [106, 3], [109.5, 9], [113.5, 18.5], [119.5, 23.5], [123, 29], [126, 33], [129.5, 34.2], [133, 33.2], [139.8, 34.9]] },
};
const ALT = {
  cape: { nm: 'Около нос Добра надежда (+15 дни)', pts: [[60.2, 22.6], [58.6, 17.6], [53.5, 9], [48, -2], [43, -13], [37.5, -26], [30, -33.5], [18.5, -35], [10, -20], [-5, 5], [-17, 20], [-12, 36], [-10.4, 43.2], [-5.5, 48], [-1.5, 50], [4, 52.2]] },
  pipe: { nm: 'Тръба през Саудитска Арабия до Червено море', pts: [[50.1, 26.4], [46.7, 24.7], [42, 24], [38.1, 24.1]] },
};
const LAYERS = [['dip', '🤝 Дипломация'], ['crisis', '⚠️ Кризи'], ['supply', '⛽ Доставки']];
const LEGEND = { dip: [['#3fae6b', 'партньорство'], ['#8a93a6', 'неутралитет'], ['#c4504a', 'напрежение']], crisis: [['#ff4d4d', 'боеве'], ['#4fc3f7', 'примирие'], ['#ffb300', 'хуманитарна криза']], supply: [['#43d17a', 'свободно'], ['#ffd54a', 'преговори'], ['#ff4d4d', 'прекъснато']] };

// deps: { pres (president.js), proj(lon, lat), geo() → worldGeo, pathOf(c) → SVG d, visW() → видима ширина, panTo(lon, lat, z), fmt, holding() → парите на холдинга, redraw() }
export function createGeoMap(deps) {
  let on = false, layer = 'crisis', sel = null, compare = false, ui = null;
  const P = () => deps.pres, S = () => P().state();
  const B = n => { const a = Math.abs(n); return a >= 1e12 ? `${(n / 1e12).toLocaleString('bg-BG', { maximumFractionDigits: 2 })} трлн. €` : a >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : `${deps.fmt(Math.round(n))} €`; };
  const XY = ([lo, la]) => deps.proj(lo, la);
  const relCol = r => r >= 70 ? '#3fae6b' : r >= 55 ? '#6f9f63' : r >= 40 ? '#8a93a6' : r >= 25 ? '#b0775a' : '#c4504a';
  const hzCol = () => { const st = S()?.hz?.st; return st === 'closed' ? '#ff4d4d' : st === 'talks' ? '#ffd54a' : '#43d17a'; };
  const nm = iso => POL[iso]?.nm || iso;
  const line = pts => 'M' + pts.map(p => XY(p).map(v => v.toFixed(0)).join(',')).join('L');

  // ---- SVG: суша, държави по слоя, маркери на кризите, коридори
  function svg() {
    const s = S(); if (!s) return ''; const w = deps.visW(), r = w / 140, me = P().me(), zoomed = w < 9000, Z = zoomOf(w);
    let h = `<defs><pattern id="geoHatch" width="${r}" height="${r}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${r * 0.4}" height="${r}" fill="#ff6b6b" opacity=".55"/></pattern></defs><rect x="-20000" y="-10000" width="40000" height="25000" fill="#0e2140"/>`;
    for (const c of deps.geo() || []) { const known = !!POL[c.iso], isSel = sel && sel.k === 'iso' && sel.id === c.iso;
      const fill = layer === 'dip' && known ? (c.iso === me ? (s.cc === 'RU' ? '#d52b1e' : '#3c6fd6') : relCol(P().rel(c.iso))) : c.iso === me ? '#4a5d7a' : '#3a4658';
      h += `<path d="${deps.pathOf(c)}" fill="${fill}" stroke="${isSel ? '#ffd54a' : '#0e2140'}" stroke-width="${isSel ? r * 0.35 : r * 0.08}" fill-rule="evenodd"${known ? ` data-giso="${c.iso}" style="cursor:pointer"` : ''}/>`; }
    // столиците (имената — при приближаване)
    const focus = focusSet(), vis = iso => Z !== 'world' || iso === me || focus.has(iso) || (sel && sel.id === iso);
    for (const [iso, c] of Object.entries(POL)) { if (!vis(iso)) continue; const [x, y] = XY([c.lon, c.lat]); h += `<circle cx="${x}" cy="${y}" r="${r * (iso === me ? 0.55 : 0.32)}" fill="#e6edf6" data-giso="${iso}" style="cursor:pointer"/>`; if (Z !== 'world' || (sel && sel.id === iso)) h += `<text x="${x + r * 0.6}" y="${y - r * 0.4}" font-size="${r * 1.1}" fill="#cfd8e6" style="pointer-events:none">${c.cap}</text>`; }
    // държава / местна зона: до 5 важни центъра и активните проекти на избраната държава
    if ((Z === 'country' || Z === 'local') && sel && sel.k === 'iso') { const iso = sel.id, c0 = POL[iso];
      for (const c of (deps.citiesOf ? deps.citiesOf(iso) : []).slice(0, 5)) { const [x, y] = XY([c.lon, c.lat]); h += `<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="#9fb0c8"/><text x="${x + r * 0.4}" y="${y + r * 0.3}" font-size="${r * 0.85}" fill="#9fb0c8" style="pointer-events:none">${c.nm}</text>`; }
      s.aid.filter(a => a.iso === iso).forEach((a, i) => { const ang = i * 1.3, [x, y] = XY([c0.lon + Math.cos(ang) * 1.6, c0.lat + Math.sin(ang) * 1.1]), ok = a.done && a.works !== false;
        h += `<g style="pointer-events:none"><circle cx="${x}" cy="${y}" r="${r * 1.1}" fill="${ok ? '#43d17a' : a.wait ? '#ff4d4d' : '#ffd54a'}" fill-opacity=".3" stroke="${ok ? '#43d17a' : a.wait ? '#ff4d4d' : '#ffd54a'}" stroke-width="${r * 0.15}"/><text x="${x}" y="${y + r * 0.4}" font-size="${r * 1.1}" text-anchor="middle">${NEED[a.need][0]}</text>${Z === 'local' ? `<text x="${x}" y="${y + r * 2}" font-size="${r * 0.75}" fill="#e6edf6" text-anchor="middle">${AID[a.need].nm}${a.wait ? ` — ${a.stuck}` : ''}</text>` : ''}</g>`; }); }
    // доставки: коридорите през Ормуз и (при сравнение) алтернативите
    if (layer === 'supply' || (sel && sel.k === 'hz')) { const col = hzCol(); for (const R of Object.values(ROUTES)) h += `<path d="${line(R.pts)}" fill="none" stroke="${col}" stroke-width="${r * 0.35}" stroke-opacity=".85" stroke-linecap="round"/>`;
      if (compare) for (const R of Object.values(ALT)) h += `<path d="${line(R.pts)}" fill="none" stroke="#4fc3f7" stroke-width="${r * 0.3}" stroke-dasharray="${r} ${r * 0.6}" stroke-opacity=".9"/>`; }
    // кризите: конфликтите (зона с щриховка — не цялата държава), Ормуз, хуманитарните ситуации; на свят — близките се групират
    const grouped = Z === 'world' && layer !== 'supply' ? clusters(r) : null; if (grouped) for (const g of grouped.groups) { const [x, y] = XY(g.at); h += `<g data-gcl="${g.at.join(',')}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="#ff8f00" fill-opacity=".35" stroke="#ff8f00" stroke-width="${r * 0.25}"/><text x="${x}" y="${y + r * 0.5}" font-size="${r * 1.6}" text-anchor="middle" fill="#fff" font-weight="800">${g.n}</text><text x="${x}" y="${y + r * 4.2}" font-size="${r * 1.05}" fill="#ffe0b0" text-anchor="middle">${g.n} събития</text></g>`; }
    const hid = grouped ? grouped.hid : new Set();
    if (layer !== 'supply') for (const c of CONFLICTS) { if (hid.has('ck:' + c.k)) continue; const k = P().conf(c.k); if (k.step >= 6) continue; const [x, y] = XY([c.lon, c.lat]), peace = k.step >= 3, rr = r * (layer === 'crisis' ? 2.6 : 1.6), isSel = sel && sel.k === 'ck' && sel.id === c.k;
      h += `<g data-gck="${c.k}" style="cursor:pointer">${layer === 'crisis' && !peace ? `<circle cx="${x}" cy="${y}" r="${rr * 1.5}" fill="url(#geoHatch)"/>` : ''}<circle cx="${x}" cy="${y}" r="${rr}" fill="${peace ? '#4fc3f7' : '#ff4d4d'}" fill-opacity=".25" stroke="${isSel ? '#ffd54a' : peace ? '#4fc3f7' : '#ff4d4d'}" stroke-width="${r * 0.25}"/><text x="${x}" y="${y + rr * 0.35}" font-size="${rr}" text-anchor="middle">${peace ? '🕊️' : c.ico}</text>${zoomed || isSel ? `<text x="${x}" y="${y + rr * 2.2}" font-size="${r * 1.1}" fill="#ffd8d8" text-anchor="middle">${c.nm}</text>` : ''}</g>`; }
    if (s.hz && s.hz.st !== 'calm') { const [x, y] = XY(HZ_PT), rr = r * 2.2, isSel = sel && sel.k === 'hz';
      h += `<g data-ghz="1" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${rr}" fill="${hzCol()}" fill-opacity=".3" stroke="${isSel ? '#ffd54a' : hzCol()}" stroke-width="${r * 0.3}"><animate attributeName="r" values="${rr};${rr * 1.3};${rr}" dur="1.8s" repeatCount="indefinite"/></circle><text x="${x}" y="${y + rr * 0.35}" font-size="${rr}" text-anchor="middle">⛴️</text><text x="${x}" y="${y + rr * 2.1}" font-size="${r * 1.05}" fill="#fff" text-anchor="middle">Ормуз — ${s.hz.st === 'safe' ? 'отворен' : 'прекъснато корабоплаване'}</text></g>`; }
    if (layer === 'crisis') for (const e of (s.evs || []).filter(x => !x.done && x.iso && POL[x.iso] && !hid.has('ev:' + x.id))) { const [x, y] = XY([POL[e.iso].lon, POL[e.iso].lat]); h += `<g data-gev="${e.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="#ffb300" fill-opacity=".3" stroke="#ffb300" stroke-width="${r * 0.2}"/><text x="${x}" y="${y + r * 0.6}" font-size="${r * 1.7}" text-anchor="middle">${e.ico}</text></g>`; }
    // 🚨 оперативните кризи (ops.js) — отварят 3D карта
    if (layer === 'crisis') for (const o of (deps.ops?.markers() || []).filter(o => !hid.has('op:' + o.id))) { const [x, y] = XY([o.lon, o.lat]), rr = r * 1.9, isSel = sel && sel.k === 'op'; h += `<g data-gop="${o.id}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${rr}" fill="${o.m.out ? '#43d17a' : '#ff8f00'}" fill-opacity=".35" stroke="${isSel ? '#ffd54a' : '#ff8f00'}" stroke-width="${r * 0.25}">${o.m.out ? '' : `<animate attributeName="r" values="${rr};${rr * 1.3};${rr}" dur="1.4s" repeatCount="indefinite"/>`}</circle><text x="${x}" y="${y + rr * 0.35}" font-size="${rr}" text-anchor="middle">${o.ico}</text></g>`; }
    return h;
  }

  // ---- 🔭 нивата на приближение: свят → регион → държава → местна зона
  const zoomOf = w => w > 9000 ? 'world' : w > 4000 ? 'region' : w > 1600 ? 'country' : 'local';
  // кои държави да се виждат на „свят“: участниците в кризите и в избраната криза
  function focusSet() { const s = S(), f = new Set(); for (const c of CONFLICTS) if (P().conf(c.k).step < 6) c.parties.forEach(i => f.add(i));
    if (s?.hz && s.hz.st !== 'calm') ['IRN', 'SAU'].forEach(i => f.add(i)); for (const e of (s?.evs || []).filter(x => !x.done && x.iso)) f.add(e.iso);
    if (sel && sel.k === 'ck') CONFLICTS.find(x => x.k === sel.id)?.parties.forEach(i => f.add(i)); return f; }
  // близките маркери (по-близо от ~4 радиуса на екрана) → група; избраната криза — винаги отделно
  function clusters(r) {
    const s = S(), pts = [];
    for (const c of CONFLICTS) if (P().conf(c.k).step < 6 && !(sel && sel.k === 'ck' && sel.id === c.k)) pts.push({ id: 'ck:' + c.k, at: [c.lon, c.lat] });
    for (const e of (s.evs || []).filter(x => !x.done && x.iso && POL[x.iso])) if (!(sel && sel.k === 'ev' && sel.id === e.id)) pts.push({ id: 'ev:' + e.id, at: [POL[e.iso].lon, POL[e.iso].lat] });
    for (const o of deps.ops?.markers() || []) if (!(sel && sel.k === 'op' && sel.id === o.id)) pts.push({ id: 'op:' + o.id, at: [o.lon, o.lat] });
    const lim = r * 5.5, used = new Set(), groups = [], hid = new Set();
    for (const a of pts) { if (used.has(a.id)) continue; const [ax, ay] = XY(a.at), g = pts.filter(b => !used.has(b.id) && Math.hypot(XY(b.at)[0] - ax, XY(b.at)[1] - ay) < lim);
      if (g.length >= 3) { g.forEach(b => { used.add(b.id); hid.add(b.id); }); groups.push({ n: g.length, at: [g.reduce((t, b) => t + b.at[0], 0) / g.length, g.reduce((t, b) => t + b.at[1], 0) / g.length] }); } }
    return { groups, hid };
  }
  // 📌 активните мисии — какво е одобрено, колко е резервирано и кой е следващият срок
  function missions() {
    const s = S(), d = deps.day(), out = []; if (!s) return out; const hz = s.hz || {};
    if (hz.esc > d) out.push({ ico: '🛡️', t: 'Придружаване в Ормуз', sub: `до ден ${hz.esc} · проверка и механизъм срещу инциденти`, go: { k: 'hz' }, at: HZ_PT });
    if (hz.alt > d) out.push({ ico: '🚢', t: 'Алтернативни доставки', sub: `до ден ${hz.alt} · недостигът ×0,5`, go: { k: 'hz' }, at: HZ_PT });
    if (hz.div && !hz.div.done) out.push({ ico: '⚡', t: 'Енергийна диверсификация', sub: `${Math.round(hz.div.prog * 100)}% · готово след ~${Math.ceil((1 - hz.div.prog) * hz.div.days)} дни`, go: { k: 'hz' }, at: HZ_PT });
    for (const c of CONFLICTS) { const k = P().conf(c.k); if (k.fund && k.fund.m > 0) out.push({ ico: '💶', t: `Фонд за възстановяване — ${c.nm}`, sub: `${B(k.fund.amt)}/месец · следваща вноска ден ${k.fund.next} · остават ${k.fund.m}`, go: { k: 'ck', id: c.k }, at: [c.lon, c.lat] }); }
    for (const a of s.aid.filter(x => !x.done)) out.push({ ico: NEED[a.need][0], t: `${AID[a.need].nm} — ${nm(a.iso)}`, sub: a.wait ? `⛔ чака: ${a.stuck}` : `етап ${a.stage + 1}/4 · издръжка след това ${B(a.up)}/месец`, go: { k: 'iso', id: a.iso }, at: [POL[a.iso].lon, POL[a.iso].lat] });
    for (const [k, v] of Object.entries(s.part || {})) if (!v.done) out.push({ ico: '🤝', t: 'Съвместен проект с ЮАР', sub: `готов след ~${Math.max(0, v.start + v.days - d)} дни`, go: { k: 'iso', id: 'ZAF' }, at: [POL.ZAF.lon, POL.ZAF.lat] });
    return out;
  }
  // ---- „Изисква решение“: до 5 точки по спешност
  function urgent() {
    const s = S(), out = []; if (!s) return out;
    if (s.hz && (s.hz.st === 'closed' || s.hz.st === 'talks' || s.hz.inc)) out.push({ ico: '⛔', t: s.hz.inc ? 'Инцидент в Ормузкия проток' : 'Прекъснат маршрут — Ормузкият проток', go: { k: 'hz' }, at: HZ_PT, w: 10 });
    for (const e of (s.evs || []).filter(x => !x.done)) out.push({ ico: e.ico, t: `${e.nm}${e.iso ? ` — ${nm(e.iso)}` : ''}`, go: { k: 'ev', id: e.id }, at: e.iso && POL[e.iso] ? [POL[e.iso].lon, POL[e.iso].lat] : null, w: 9 });
    for (const c of CONFLICTS) { const k = P().conf(c.k); if (k.step >= 3 && k.step < 6 && k.stab < 45) out.push({ ico: '🔍', t: `Примирието се клати — ${c.nm}`, go: { k: 'ck', id: c.k }, at: [c.lon, c.lat], w: 8 }); }
    for (const a of s.aid.filter(x => x.wait)) out.push({ ico: '📦', t: `Забавена помощ — ${nm(a.iso)} (${a.stuck})`, go: { k: 'iso', id: a.iso }, at: [POL[a.iso].lon, POL[a.iso].lat], w: 7 });
    for (const p of P().proposals().filter(x => x.kind === 'pkgHint')) { const c = CONFLICTS.find(x => x.k === p.ck); out.push({ ico: '📝', t: `Предложение за преговори — ${c.nm}`, go: { k: 'ck', id: c.k }, at: [c.lon, c.lat], w: 6 }); }
    for (const o of deps.ops?.markers() || []) if (!o.m.out) out.push({ ico: o.ico, t: o.nm, go: { k: 'op', id: o.id }, at: [o.lon, o.lat], w: 9.5 });
    return out.sort((a, b) => b.w - a.w).slice(0, 5);
  }

  // ---- десният панел: държава · криза · Ормуз · хуманитарна ситуация
  const btn = (p, label) => `<button class="gbtn y" data-gpd="${p.id}|yes">${label || '✓ Одобри'}</button>${p.small ? `<button class="gbtn" data-gpd="${p.id}|small">½ ${B(p.small.cost)}</button>` : ''}`;
  const propRow = p => `<div class="gp"><div>${p.ico} ${p.text.replace(/^[А-ЯЁ][а-яё]+(?: \([^)]*\))?: /, '')}</div><div class="gm">${p.why}${p.cost ? ` · ${B(p.cost)}` : ''}${p.days ? ` · ~${p.days} дни` : ''}</div><div class="grow">${btn(p)}<button class="gbtn" data-gpd="${p.id}|later">⏳</button></div></div>`;
  function panel() {
    const s = S(); if (!s || !sel) return `<div class="gh">🌍 Геополитика</div><div class="gm">Избери държава или криза на картата — или точка от „Изисква решение“.</div>`;
    const ps = P().proposals();
    if (sel.k === 'hz') return hzPanel(s, ps);
    if (sel.k === 'op') { const o = (deps.ops?.markers() || []).find(x => x.id === sel.id); if (!o) return `<div class="gm">Кризата приключи.</div>`;
      return `<div class="gh">${o.ico} ${o.nm}</div><div class="gm">${deps.ops.summary(o.m)}</div><div class="grow"><button class="gbtn y" data-gopen="${o.id}">🗺️ Отвори 3D картата</button></div>`; }
    if (sel.k === 'ev') { const e = (s.evs || []).find(x => x.id === sel.id); if (!e) return ''; return `<div class="gh">${e.ico} ${e.nm}${e.iso ? ` — ${nm(e.iso)}` : ''}</div><div class="gm">Остават ${Math.max(0, e.until - (deps.day()))} дни. ${e.kind === 'disaster' ? 'Спешна помощ до 14 дни, после възстановяване без изчерпване на резервите.' : 'Нужни са поне два от отговорите: доставки, транспорт, местно производство.'}</div>${ps.filter(p => p.ev === e.id).map(propRow).join('')}<button class="gbtn" data-gcab="ev">🏛️ Обсъди с кабинета</button>`; }
    if (sel.k === 'ck' && SCEN[sel.id]) return scenPanel(sel.id, ps);
    if (sel.k === 'ck') { const c = CONFLICTS.find(x => x.k === sel.id), k = P().conf(c.k);
      return `<div class="gh">${c.ico} ${c.nm}</div><div class="gm">ℹ️ алтернативна игрова хронология · страни: ${c.parties.map(nm).join(', ')} · интензитет ${Math.round(k.int)}</div>${PEACE.map((p, i) => `<div class="gm">${i < k.step ? '✅' : i === k.step ? '➡️' : '⬜'} ${p.ico} ${p.nm}</div>`).join('')}${k.step >= 3 ? `<div class="gm">Стабилност на примирието: <b>${Math.round(k.stab)}</b>${k.ver ? ' · 🔍 наблюдение' : ''}${k.gua ? ' · 🛡️ гаранции' : ''}${k.fund ? ` · 💶 фонд ${12 - k.fund.m}/12` : ''}${k.broken ? ' · 💔 нарушено обещание' : ''}</div>` : ''}
        ${ps.filter(p => p.ck === c.k && p.kind !== 'pkgHint').map(propRow).join('')}<div class="grow">${k.step >= 2 && k.step < 5 ? `<button class="gbtn y" data-gpkg="${c.k}">📝 Мирен пакет</button>` : ''}<button class="gbtn" data-gcab="ck">🏛️ Обсъди с кабинета</button></div>`; }
    // държава
    const iso = sel.id, c = POL[iso], war = CONFLICTS.filter(x => x.parties.includes(iso) || x.region === iso), access = !war.some(x => P().conf(x.k).step < 2);
    const aid = s.aid.filter(a => a.iso === iso), commits = war.filter(x => P().conf(x.k).fund).map(x => `💶 фонд за възстановяване: ${12 - P().conf(x.k).fund.m}/12 вноски`);
    const last = (s.log || []).find(l => l.t.includes(c.nm)); const pIso = ps.filter(p => p.iso === iso);
    const deal = pIso.find(p => p.kind === 'deal'), aidP = pIso.find(p => p.kind === 'aid' && p.need !== 'rebuild'), reb = pIso.find(p => p.kind === 'aid' && p.need === 'rebuild');
    const why = (p, txt) => p ? '' : `<div class="gm">↳ ${txt}</div>`;
    return `<div class="gh">${c.nm} <span class="gm">· ${c.cap}</span></div>
      <div class="gstat"><div><b>${Math.round(P().rel(iso))}</b><span>отношения</span></div><div><b>${Math.round(P().trust(iso))}</b><span>доверие</span></div><div><b>${Math.round(P().stab(iso))}</b><span>стабилност</span></div></div>
      <div class="gm">Основни нужди: ${(c.need || []).map(n => `${NEED[n][0]} ${NEED[n][1]}${(s.met[iso] || {})[n] ? ' ✅' : ''}`).join(', ') || 'няма спешни'}</div>
      <div class="gm">Споразумения: ${s.deals[iso] ? '🤝 сътрудничество' : 'няма'}${s.coal[iso] ? ' · 🌐 коалиция' : ''}</div>
      ${aid.length ? `<div class="gm">Проекти: ${aid.map(a => `📦 ${AID[a.need].nm} — ${a.done && a.works !== false ? '✅ работи' : a.stuck ? `⛔ ${a.stuck}` : 'в ход'}`).join('; ')}</div>` : ''}
      ${commits.length ? `<div class="gm">Ангажименти: ${commits.join('; ')}</div>` : ''}
      ${last ? `<div class="gm">Последно: ден ${last.d} — ${last.t}</div>` : ''}
      <div class="gsub">Действия</div>
      <div class="grow">${war.length ? `<button class="gbtn" data-ggo="${war[0].k}">🕊️ Преговори</button>` : ''}${deal ? btn(deal, '🤝 Предложи партньорство') : ''}${aidP ? btn(aidP, `📦 Хуманитарна помощ · ${B(aidP.cost)}`) : ''}${reb ? btn(reb, `🏗️ Възстановяване · ${B(reb.cost)}`) : ''}</div>
      ${why(deal || s.deals[iso], `Партньорство — когато отношенията са поне 45 (сега ${Math.round(P().rel(iso))}).`)}${(c.need || []).length && !aidP && !(c.need || []).every(n => (s.met[iso] || {})[n] || aid.some(a => a.need === n)) ? why(null, access ? 'Помощта е в списъка на министрите — изчакай заседанието или повиши отношенията (30+).' : 'Няма достъп за доставки — първо договори хуманитарен достъп в конфликта (стъпка 2).') : ''}
      ${pIso.filter(p => !['deal', 'aid'].includes(p.kind)).map(propRow).join('')}`;
  }
  // 🗂️ сценарните панели: участниците с интересите и червените им линии, етапите, последната реакция, твоята роля
  const SCEN = {
    east: { role: { US: '🇺🇸 Ти си посредник: не си страна в конфликта, но доверието ти зависи от двете страни.', RU: '🇷🇺 Ти си пряка страна: решаваш за собственото си участие — всяка отстъпка струва доверие у дома.' }, issues: 'сигурност, хуманитарни нужди, взаимно недоверие и приемливост на условията', goal: 'договорено прекратяване на огъня, наблюдение, последващи преговори и възстановяване' },
    mideast: { role: { US: '🇺🇸 Ти си посредник между страните и регионалните държави.', RU: '🇷🇺 Ти си посредник с връзки в региона.' }, issues: 'защита на цивилните, освобождаване на заложниците, хуманитарен достъп и гаранции за сигурност', goal: 'поетапни договорености с участие на засегнатите страни и устойчив политически процес' },
  };
  const PART_NM = { now: 'незабавни действия', obl: 'задължения със срокове', ver: 'проверка', gua: 'гаранции', rec: 'възстановяване', next: 'график за преговорите' };
  function scenPanel(ck, ps) {
    const s = S(), c = CONFLICTS.find(x => x.k === ck), k = P().conf(ck), sc = SCEN[ck], me = P().me(), lbl = { yes: '✔ прие', counter: '↩ насрещно', no: '✖ отказа' };
    const parties = c.parties.filter(i => i !== me).map(iso => { const pr = (PREF[ck] || {})[iso], top = pr ? Object.entries(pr.w).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => PART_NM[p]) : [], red = pr ? pr.red.map(x => x[2]) : [];
      return `<div class="gp"><b>${nm(iso)}</b><div class="gstat"><div><b>${Math.round(P().rel(iso))}</b><span>отношения</span></div><div><b>${Math.round(P().trust(iso))}</b><span>доверие към теб</span></div><div><b>${Math.round(P().stab(iso))}</b><span>стабилност</span></div></div><div class="gm">Иска най-вече: ${top.join(', ') || '—'}</div><div class="gm">Отказва, ако: ${red.join('; ') || '—'}</div></div>`; }).join('');
    const last = k.last ? `<div class="gm"><b>Последна реакция (ден ${k.last.d}):</b> ${k.last.resp.map(r => `${nm(r.iso)} ${lbl[r.ok]} — ${r.why}`).join(' · ')}</div>` : '';
    return `<div class="gh">${c.ico} ${c.nm}</div><div class="gm">ℹ️ алтернативна игрова хронология — не пресъздава текущите събития</div><div class="gm">${sc.role[s.cc] || ''}</div>
      <div class="gm"><b>Трудният избор:</b> ${sc.issues}.</div><div class="gm"><b>Успех:</b> ${sc.goal}.</div>
      <div class="gsub">Етапи</div>${PEACE.map((p, i) => `<div class="gm">${i < k.step ? '✅' : i === k.step ? '➡️' : '⬜'} ${p.ico} ${p.nm}</div>`).join('')}${k.step >= 3 ? `<div class="gm">Стабилност на примирието: <b>${Math.round(k.stab)}</b>${k.ver ? ' · 🔍 наблюдение' : ''}${k.gua ? ' · 🛡️ гаранции' : ''}${k.fund ? ` · 💶 фонд ${12 - k.fund.m}/12` : ''}${k.broken ? ' · 💔 нарушено обещание' : ''}</div>` : ''}
      <div class="gsub">Участници</div>${parties}${last}
      ${ps.filter(p => p.ck === ck && p.kind !== 'pkgHint').map(propRow).join('')}<div class="grow">${k.step >= 2 && k.step < 5 && !(k.wait > deps.day()) ? `<button class="gbtn y" data-gpkg="${ck}">📝 Мирен пакет</button>` : k.wait > deps.day() ? `<span class="gm">Следващ опит след ден ${k.wait}</span>` : ''}<button class="gbtn" data-gcab="ck">🏛️ Обсъди с кабинета</button></div>`;
  }
  function hzPanel(s, ps) {
    const hz = s.hz, d = deps.day(), partners = Object.keys(s.deals).filter(i => HZ_PARTNERS.includes(i)), opt = k => ps.find(p => p.kind === 'hz' && p.act === k);
    const objections = []; if (!(hz.esc > d)) objections.push('Недостатъчни гаранции — няма мисия за проверка'); if (partners.length < 2) objections.push(`Липсва подкрепа от партньор (${partners.length}/2 споразумения в региона)`); if (P().trust('IRN') < 35) objections.push(hz.broken ? 'Нарушено предишно обещание' : 'Недостатъчно доверие към посредника');
    const row = (k, ico, title, preview) => { const p = opt(k); return `<div class="gp"><div><b>${ico} ${title}</b></div><div class="gm">${preview}</div>${p ? `<div class="grow">${btn(p, `✓ Избери · ${p.cost ? B(p.cost) : 'без разход'}`)}</div>` : `<div class="gm">${k === 'deal' && (hz.talk || 0) < 2 ? '↳ първо преговорите (2 стъпки)' : '✔ вече е в ход или не е нужно'}</div>`}</div>`; };
    return `<div class="gh">⛴️ Ормуз — ${hz.st === 'safe' ? 'корабоплаването е възстановено' : 'прекъснато корабоплаване'}</div><div class="gm">ℹ️ алтернативна игрова хронология</div>
      <div class="gstat"><div><b>${Math.round(hz.ship)}%</b><span>корабоплаване</span></div><div><b>${Math.round(hz.res)}%</b><span>стратегически резерв</span></div><div><b>${Math.round(s.ind.energy)}</b><span>енергия у нас</span></div></div>
      <div class="gm"><b>Причина:</b> корабоплаването е прекъснато, танкерите чакат. <b>Участници:</b> Иран, Саудитска Арабия, ${HZ_PARTNERS.slice(2).map(nm).join(', ')}.</div>
      <div class="gm"><b>Последствия:</b> по-скъпа енергия (петролът ×1,6), забавени доставки към Европа и Азия (двата коридора на картата), по-скъп транспорт в бюджета.</div>
      <div class="gm"><b>Мисия сега:</b> ${hz.esc > d ? `🛡️ придружаване до ден ${hz.esc}` : 'няма придружаване'} · ${hz.alt > d ? `🚢 алтернативни доставки до ден ${hz.alt}` : 'без алтернативни доставки'} · преговори ${hz.talk || 0}/2${hz.div ? ` · ⚡ диверсификация ${hz.div.done ? '✅' : Math.round(hz.div.prog * 100) + '%'}` : ''}</div>
      <div class="gsub">Варианти</div>
      ${row('res', '🛢️', 'Освободи резерви', `Количество: 35% от стратегическия резерв · цена: без разход · остава ${Math.max(0, Math.round(hz.res - 35))}% за следваща криза`)}
      ${row('alt', '🚢', 'Договори алтернативни доставки', `Срок ~20 дни · нужни танкери по нос Добра надежда или тръбата до Червено море · недостигът ×0,5 за 60 дни <button class="gbtn" data-gcmp="1">${compare ? 'Скрий' : 'Покажи'} маршрутите</button>`)}
      ${row('esc', '🛡️', 'Мисия за придружаване и механизъм срещу инциденти', 'Гаранциите и проверката — без тях споразумение не издържа · 180 дни')}
      ${row('dip', '📞', 'Свикай преговори', `Поканени: Иран, Саудитска Арабия и големите вносители · условие: доверие към теб ${Math.round(P().trust('IRN'))}/38 или споразумения с партньорите (${partners.length})`)}
      ${row('deal', '📃', 'Предложи общо споразумение', `Ангажименти: безопасно преминаване · проверка и механизъм срещу инциденти · гаранции на партньорите · очаквани възражения: ${objections.length ? objections.join('; ') : 'няма — страните са готови'}`)}
      ${row('div', '⚡', 'Ускорена енергийна диверсификация', 'Дългосрочно — не решава днешния недостиг, но следващо спиране удря наполовина')}
      <button class="gbtn" data-gcab="hz">🏛️ Обсъди с кабинета</button>`;
  }

  // ---- целият интерфейс над картата
  const css = `
body.geo:not(.mob):has(#mapScreen:not(.hidden) #geoUI) #toasts { top:auto; bottom:64px; left:auto; right:380px; }
#geoUI .gtop { position:absolute; top:8px; left:50%; transform:translateX(-50%); display:flex; gap:6px; flex-wrap:wrap; align-items:center; background:rgba(11,18,32,.88); border:1px solid #22304a; border-radius:12px; padding:6px 8px; z-index:6; }
#geoUI .gleft { position:absolute; top:64px; left:8px; width:280px; background:rgba(11,18,32,.9); border:1px solid #22304a; border-radius:12px; padding:8px 10px; z-index:6; }
#geoUI .gright { position:absolute; top:64px; right:8px; bottom:70px; width:360px; overflow:auto; background:rgba(11,18,32,.94); border:1px solid #22304a; border-radius:12px; padding:10px 12px; z-index:6; }
#geoUI .gbot { position:absolute; left:8px; bottom:8px; max-width:560px; background:rgba(11,18,32,.9); border:1px solid #22304a; border-radius:12px; padding:6px 10px; z-index:6; }
#geoUI, #geoUI * { color:#e6edf6; font:500 13px/1.4 system-ui,sans-serif; } #geoUI .gm { color:#9fb0c8; font-size:12px; margin:3px 0; } #geoUI .gh { font-size:15px; font-weight:800; margin:0 0 4px; } #geoUI .gsub { margin:8px 0 2px; font-weight:800; color:#ffd54a; }
#geoUI .gbtn { background:#1d2a42; border:1px solid #2d3f60; border-radius:8px; padding:4px 9px; cursor:pointer; margin:2px 4px 2px 0; } #geoUI .gbtn.y, #geoUI .gbtn.on { background:#ffd54a; color:#111; border-color:#ffd54a; }
#geoUI .gp { border-top:1px solid #22304a; padding:6px 0; } #geoUI .grow { display:flex; flex-wrap:wrap; align-items:center; } #geoUI .gstat { display:flex; gap:6px; margin:6px 0; } #geoUI .gstat div { flex:1; background:#131d30; border-radius:8px; padding:4px; text-align:center; } #geoUI .gstat b { display:block; font-size:16px; } #geoUI .gstat span { font-size:11px; color:#9fb0c8; }
#geoUI .gurg { display:block; width:100%; text-align:left; background:#131d30; border:1px solid #22304a; border-radius:8px; padding:5px 7px; margin:3px 0; cursor:pointer; }
body.geo #mapHud, body.geo #mapLayers { display:none !important; }`;
  function overlay() {
    const host = document.getElementById('mapScreen'); if (!host) return; if (!document.getElementById('geoCss')) { const c = document.createElement('style'); c.id = 'geoCss'; c.textContent = css; document.head.appendChild(c); }
    if (!on || !S()) { ui && ui.remove(); ui = null; document.body.classList.remove('geo'); return; }
    document.body.classList.add('geo'); if (!ui) { ui = document.createElement('div'); ui.id = 'geoUI'; host.appendChild(ui); }
    const s = S(), u = urgent(), ms = missions(), C = P().worldConds();
    ui.innerHTML = `<div class="gtop"><button class="gbtn" data-gmode="eco">💼 Икономическа империя</button><button class="gbtn on">🌍 Геополитика</button><span style="width:10px"></span>${LAYERS.map(([k, t]) => `<button class="gbtn ${layer === k ? 'on' : ''}" data-glay="${k}">${t}</button>`).join('')}<span class="gm" style="margin:0 6px">${LEGEND[layer].map(([c, t]) => `<span style="color:${c}">■</span> ${tr(t)}`).join(' · ')}</span><span class="gm" style="margin:0">🏛️ Държавен бюджет: <b style="color:${s.res >= 0 ? '#7dffa8' : '#ff8a8a'}">${B(s.res)}</b> · 🏢 холдинг: ${B(deps.holding())}</span></div>
      <div class="gleft"><div class="gh">❗ Изисква решение</div>${u.length ? u.map((x, i) => `<button class="gurg" data-gurg="${i}">${x.ico} ${x.t}</button>`).join('') : '<div class="gm">Нищо спешно — време за дългосрочните програми.</div>'}${ms.length ? `<div class="gh" style="margin-top:8px">📌 Активни мисии</div>${ms.slice(0, 6).map((x, i) => `<button class="gurg" data-gms="${i}">${x.ico} ${x.t}<div class="gm" style="margin:1px 0 0">${x.sub}</div></button>`).join('')}${ms.length > 6 ? `<div class="gm">… и още ${ms.length - 6}</div>` : ''}` : ''}<div class="gm" style="margin-top:6px">🔭 ${{ world: 'Свят', region: 'Регион', country: 'Държава', local: 'Местна зона' }[zoomOf(deps.visW())]}</div></div>
      <div class="gright">${panel()}</div>
      <div class="gbot"><details><summary style="cursor:pointer">🌍 Път към световен мир — ${C.filter(c => c[1]).length}/${C.length} условия · задържани ${s.world || 0}/${P().WORLD_DAYS || 180} дни</summary>${C.map(([t, ok]) => `<div class="gm">${ok ? '✅' : '⬜'} ${t}</div>`).join('')}</details></div>`;
    const q = (sel2, fn) => ui.querySelectorAll(sel2).forEach(b => b.onclick = e => { e.stopPropagation(); fn(b); });
    q('[data-gmode]', () => setOn(false)); q('[data-glay]', b => { layer = b.dataset.glay; deps.redraw(); });
    q('[data-gurg]', b => { const x = u[+b.dataset.gurg]; sel = x.go; if (x.at) deps.panTo(x.at[0], x.at[1], 3); else deps.redraw(); });
    q('[data-gms]', b => { const x = ms[+b.dataset.gms]; sel = x.go; if (x.at) deps.panTo(x.at[0], x.at[1], 4); else deps.redraw(); });
    q('[data-gpd]', b => { const [id, a] = b.dataset.gpd.split('|'); P().decide(id, a); deps.redraw(); });
    q('[data-gpkg]', b => P().openPkg(b.dataset.gpkg)); q('[data-ggo]', b => { const c = CONFLICTS.find(x => x.k === b.dataset.ggo); sel = { k: 'ck', id: c.k }; deps.panTo(c.lon, c.lat, 3); });
    q('[data-gcmp]', () => { compare = !compare; deps.redraw(); });
    q('[data-gopen]', b => deps.ops.open(+b.dataset.gopen));
    q('[data-gcab]', b => { const k = b.dataset.gcab, f = k === 'hz' ? (p => p.kind === 'hz') : k === 'ck' ? (p => p.ck === sel.id) : (p => p.ev === sel.id); P().cabinet(false, f, () => deps.redraw()); });
  }
  function bind(svgEl) {
    svgEl.querySelectorAll('[data-gcl]').forEach(g => g.onclick = e => { e.stopPropagation(); const [lo, la] = g.dataset.gcl.split(',').map(Number); deps.panTo(lo, la, 3); });
    svgEl.querySelectorAll('[data-giso]').forEach(g => g.onclick = () => { sel = { k: 'iso', id: g.dataset.giso }; deps.redraw(); });
    svgEl.querySelectorAll('[data-gck]').forEach(g => g.onclick = e => { e.stopPropagation(); sel = { k: 'ck', id: g.dataset.gck }; deps.redraw(); });
    svgEl.querySelectorAll('[data-gev]').forEach(g => g.onclick = e => { e.stopPropagation(); sel = { k: 'ev', id: +g.dataset.gev }; deps.redraw(); });
    svgEl.querySelectorAll('[data-gop]').forEach(g => g.onclick = e => { e.stopPropagation(); sel = { k: 'op', id: +g.dataset.gop }; deps.redraw(); });
    svgEl.querySelectorAll('[data-ghz]').forEach(g => g.onclick = e => { e.stopPropagation(); sel = { k: 'hz' }; deps.panTo(HZ_PT[0], HZ_PT[1], 4); });
  }
  function setOn(v) { on = !!v && !!S(); if (!on) { ui && ui.remove(); ui = null; document.body.classList.remove('geo'); } deps.redraw(); }
  return { on: () => on && !!S(), setOn, svg, bind, overlay, select: x => { sel = x; } };
}
