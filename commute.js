// commute.js — 🏠 commute (f6): хората се прибират. Вечер (17–21 ч.) колите на къщите се връщат от трафика и паркират на алеята/под навеса,
// слиза човек и влиза в къщата; пешеходци вървят по тротоара до входа на блока и влизат. Сутрин (7–9 ч.) — обратно: от къщата до колата → трафика,
// от входа на блока — по тротоара. През нощта колите са си вкъщи (по хеш — коя къща е „на работа“ и кога).
// Колите — parklife.js (park-life) с регистър „къща = 1 място“ (вместо parking.js): паркираната кола е инстанция в districts.js
// (carVis — скрита/показана); тръгващата се става истински модел (carSrc) за времето на движението. Пешеходците — само до камерата (до MAXP).
// createCommute(deps) → { update(dt), clear(), force('am'|'pm', i?), info() }
//   deps: като parklife (agents, lanes, off, hour, cam, root, car, dark, ped, dropPed) + dl() → city.dl (districts.js: homes/doors/carVis/carSrc/group)
import { createParkLife, target } from './parklife.js';

const MAXP = 8, PED_NEAR = 250, PED_V = 1.5;
const hsh = n => { let h = (n * 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
// дали колата на къщата е вкъщи по часа: нощем почти всички (0.85), през деня — 1/3; коя — по хеша на парцела
const homeAt = (P, tg) => P.h < tg + 0.05;

export function createCommute(deps) {
  let G = null, list = [];
  // ── регистърът на къщите (API-то на parking.js, което ползва parklife.js) ──
  const vis = (s, on) => deps.dl()?.carVis(s.ci, on);
  const mat = s => {   // паркираната (инстанцията) → истински модел на същото място
    if (s.car && s.car.parent) return s.car;
    const src = deps.dl()?.carSrc(s.ci); if (!src) return null;
    const o = src.clone(true); o.position.set(s.x, 0, s.z); o.rotation.set(0, s.yaw, 0); deps.dark?.(o); deps.root().add(o); vis(s, false); s.back = true; return (s.car = o);
  };
  const unmat = s => { if (s.car && s.car.parent) s.car.parent.remove(s.car); s.car = null; };
  const R = {
    get list() { return list; },
    takenSpot: P => { const s = P.spots[0]; return s.state === 'taken' && mat(s) ? s : null; },
    freeSpot: P => P.spots[0].state === 'free' ? P.spots[0] : null,
    occ: P => P.spots[0].state === 'free' ? 0 : 1,
    leave: s => { s.state = 'leaving'; },
    arrive: s => { s.state = 'arriving'; },
    park: (s, obj) => { if (s.car && s.car !== obj) unmat(s); if (obj && obj.parent) { s.car = obj; s.back = false; vis(s, false); } else { s.car = null; vis(s, true); } s.state = 'taken'; },   // пристигналата остава (без смяна на модела); влязла е с муцуната — сутрин излиза на заден
    release: s => { if (s.car && s.car.parent) unmat(s); s.car = null; vis(s, false); s.state = 'free'; },
  };
  function reset() {   // градът/кварталите са сменени — старото настрана, инстанциите — както са били
    for (const P of list) { const s = P.spots[0]; unmat(s); if (G === deps.dl()?.group()) vis(s, true); }
    list = []; G = null;
  }
  function sync() {   // districts.js прави нова група при всяко rebuild() — къщите се пазят по парцела (и движенията им продължават)
    const dl = deps.dl(), g = dl && dl.group();
    if (g === G) return; if (!g) { life.clear(); reset(); return; }
    const old = new Map(list.map(P => [P.lot, P])), tg = target(deps.hour()); G = g;
    list = dl.homes().map(H => {
      const out = H.out.map(p => [p[0], p[1]]), o = old.get(H.lot); old.delete(H.lot);
      const s = o ? o.spots[0] : { i: 0, car: null, state: 'taken', back: true }; Object.assign(s, { x: H.x, z: H.z, yaw: H.yaw, out, in: [...out].reverse(), door: H.door, walk: [H.home, H.door], ci: H.ci });
      const P = o || { id: 'h' + H.lot, lot: H.lot, h: hsh(H.lot + 7), spots: [s] }; Object.assign(P, { x: H.x, z: H.z, mouthIn: [out[2]] }); s.P = P;
      if (!o && !homeAt(P, tg)) s.state = 'free';
      if (s.state !== 'taken' || (s.car && s.car.parent)) vis(s, false);   // новите инстанции — показани; празното място / тръгналата кола — скрити
      return P; });
    if (old.size) { life.clear(); for (const P of old.values()) unmat(P.spots[0]); }   // изчезнала къща — движенията отначало
  }
  // далечните къщи — без движение: колата просто е или не е там
  function farTick(P, tg) {
    const s = P.spots[0], want = homeAt(P, tg);
    if (want && s.state === 'free') { s.state = 'taken'; vis(s, true); }
    else if (!want && s.state === 'taken' && !s.car) { s.state = 'free'; vis(s, false); }
  }
  const life = createParkLife({ ...deps, parks: R, minSpots: 1, farTick, want: (P, tg) => homeAt(P, tg), rateK: 0.12,
    bld: (x, z) => { const P = list.find(q => q.x === x && q.z === z); const w = P && P.spots[0].walk[0]; return w ? { x: w[0], z: w[1] } : { x, z }; } });

  // ── пешеходците на блоковете: вечер — по тротоара до входа и вътре; сутрин — от входа навън ──
  const peds = []; let spT = 0;
  function spawn(dir) {
    const dl = deps.dl(), c = deps.cam(), D = (dl ? dl.doors() : []).filter(d => Math.hypot(d.door[0] - c.x, d.door[1] - c.z) < PED_NEAR);
    if (!D.length) return false;
    const d = D[(Math.random() * D.length) | 0], a = d.along[Math.random() < 0.5 ? 0 : 1], w = deps.ped(); if (!w) return false;
    const wp = dir === 'pm' ? [a, d.mouth, d.door] : [d.door, d.mouth, a];
    w.m.position.set(wp[0][0], 0.05, wp[0][1]); peds.push({ w, wp, wi: 1, t: 0 }); return true;
  }
  function walkP(p, dt) {
    const m = p.w.m, [x, z] = p.wp[p.wi], dx = x - m.position.x, dz = z - m.position.z, d = Math.hypot(dx, dz), st = PED_V * dt;
    if (d <= st) { m.position.x = x; m.position.z = z; p.wi++; } else { m.position.x += dx / d * st; m.position.z += dz / d * st; m.rotation.y = Math.atan2(dx, dz); }
    if (p.w.mixer) p.w.mixer.update(dt);
    return p.wi >= p.wp.length;
  }
  const pedRush = h => (h >= 17 && h < 21) ? 'pm' : (h >= 7 && h < 9) ? 'am' : null;

  function update(dt) {
    sync(); if (!G) return;
    life.update(dt);
    for (const p of [...peds]) { p.t += dt; if (walkP(p, dt) || p.t > 90) { deps.dropPed(p.w); peds.splice(peds.indexOf(p), 1); } }
    const r = pedRush(deps.hour());
    if (r && peds.length < MAXP && (spT += dt) > 1.6) { spT = 0; if (Math.random() < 0.7) spawn(r); }
  }
  function clear() { life.clear(); for (const p of peds.splice(0)) deps.dropPed(p.w); reset(); }
  // Лабораторията: къщата най-близо до (x, z) с кола вкъщи ('am') / без кола ('pm') — движението веднага
  function pick(mode, x, z) { sync(); return list.filter(P => mode === 'pm' ? P.spots[0].state === 'free' : P.spots[0].state === 'taken').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] || null; }
  return {
    update, clear, pick,
    force: (P, mode) => mode === 'ped-am' || mode === 'ped-pm' ? spawn(mode.slice(4)) : life.force(P, mode),
    info: () => ({ homes: list.length, home: list.filter(P => P.spots[0].state !== 'free').length, doors: deps.dl()?.doors().length || 0, peds: peds.length, ...life.info() }),
    dbg: () => life.dbg(),
  };
}
