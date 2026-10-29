// fireruins.js — 🏚️ fire-ruins: изгорялата фонова сграда (кварталите по плана — InstancedMesh, cityplan2-3d.js hideBlocks):
// сградата се скрива и на мястото ѝ стои руината (firesim.js — същите модели), опожарена земя, дим и жар първия ден;
// след AUTO дни градът разчиства (руината се снишава) и сградата се връща. Записът: S.blkRuins [{ city, x, z, t0 }]
import * as THREE from 'three';
import { loadRuin, ruinKind, fitRuin, ashTex } from './firesim.js';
import { feature } from './lab/feature.js';
const FR2 = feature('fire-real2');   // 🔥 fire-real2: incidents.js получава и самия блок (рамката, заместителят с опушения материал)

const AUTO = 3, CLEAR = 0.5;   // дни руина; последните CLEAR дни — разчистване
const puffT = (() => { let t = null; return () => t || (t = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })()); })();

// deps: { S(), cityId(), day(), group(), pv() → city.planView, toast(msg, kind, fly), fly(x, z), save() }
export function createBlockRuins(deps) {
  const recs = () => { const S = deps.S(); return S ? (S.blkRuins = S.blkRuins || []) : []; };
  const vis = new Map();   // запис → { b, g, ruin, ash, smoke, glow }
  let pvAt = null, chk = 0, fireB = null;
  const blocks = () => { const pv = deps.pv(); return (pv && pv.userData.blocks) || []; };
  // блоковете са в рамката на плана (city.planView е изместен с city.plan.offset) — навън всичко е в световни координати
  const off = () => { const pv = deps.pv(); return pv ? [pv.position.x, pv.position.z] : [0, 0]; };
  // сградата за изгаряне: най-близката до (x, z) в r м, чийто център не е в друга сграда (в гъстите квартали блоковете се застъпват — руината оставаше вътре в съседа)
  const half = o => { const c = Math.abs(Math.sin(o.rot)), s = Math.abs(Math.cos(o.rot)); return [(o.d * c + o.w * s) / 2, (o.d * s + o.w * c) / 2]; };
  // застъпването — по истинските (завъртени) петна: 5×5 точки от сградата; ако над 4 са в друга сграда — не (иначе съседът стоеше върху руината)
  const obb = o => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); o.M.decompose(p, q, sc); const y = new THREE.Euler().setFromQuaternion(q, 'YXZ').y; return { x: p.x, z: p.z, c: Math.cos(y), s: Math.sin(y), hx: sc.x / 2, hz: sc.z / 2 }; };
  const inObb = (B, px, pz) => { const dx = px - B.x, dz = pz - B.z, lx = dx * B.c - dz * B.s, lz = dx * B.s + dz * B.c; return Math.abs(lx) < B.hx && Math.abs(lz) < B.hz; };
  const covered = (b, L) => { const B = obb(b), O = L.filter(o => o !== b && Math.hypot(o.x - b.x, o.z - b.z) < 45).map(obb); let n = 0; for (const fx of [-0.4, -0.2, 0, 0.2, 0.4]) for (const fz of [-0.4, -0.2, 0, 0.2, 0.4]) { const lx = fx * 2 * B.hx, lz = fz * 2 * B.hz, px = B.x + lx * B.c + lz * B.s, pz = B.z - lx * B.s + lz * B.c; if (O.some(o => inObb(o, px, pz))) n++; } return n > 4; };
  const pick = (wx, wz, r = 70, ok = () => true) => { const [ox, oz] = off(), x = wx - ox, z = wz - oz, L = blocks(), C = L.filter(b => (b.x - x) ** 2 + (b.z - z) ** 2 < r * r && ok(b)).sort((a, c) => ((a.x - x) ** 2 + (a.z - z) ** 2) - ((c.x - x) ** 2 + (c.z - z) ** 2)); return C.find(b => !covered(b, L)) || null; };
  const blockAt = (wx, wz) => { const [ox, oz] = off(), x = wx - ox, z = wz - oz; let best = null, bd = 2.5 * 2.5; for (const b of blocks()) { const d = (b.x - x) ** 2 + (b.z - z) ** 2; if (d < bd) { bd = d; best = b; } } return best; };
  // рамката на сградата от матрицата на инстанцията: местната x — по b.d, z — по b.w, завъртането — около y
  const frame = b => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); b.M.decompose(p, q, s); const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y; return { yaw, W: { wid: s.x, half: s.z, h: b.h, top: b.h, ctr: new THREE.Vector3(b.x + off()[0], b.h / 2, b.z + off()[1]) } }; };
  // световната рамка (AABB) на блока — за incidents.js (building); с (wx, wz) — и пламъците: по истинската фасада към улицата (завъртяния блок, пред стената) и на покрива
  // (по AABB пламъците бяха 0,5 м навътре в рамката — в стената или в съседа, не се виждаха)
  const aabb = (b, wx, wz) => { const [ox, oz] = off(), [hx, hz] = half(b), r = { x0: b.x + ox - hx, x1: b.x + ox + hx, z0: b.z + oz - hz, z1: b.z + oz + hz, h: b.h }; if (wx == null) return r;
    const { yaw, W } = frame(b), c = W.ctr, ax = [Math.cos(yaw), -Math.sin(yaw)], az = [Math.sin(yaw), Math.cos(yaw)], tx = wx - c.x, tz = wz - c.z;
    const F = [[ax, az, W.wid / 2, W.half / 2], [[-ax[0], -ax[1]], az, W.wid / 2, W.half / 2], [az, ax, W.half / 2, W.wid / 2], [[-az[0], -az[1]], ax, W.half / 2, W.wid / 2]].sort((p, q) => (q[0][0] * tx + q[0][1] * tz) - (p[0][0] * tx + p[0][1] * tz))[0];
    const [n, t, D, L] = F, o = D + 2.6, pt = (f, y) => [c.x + n[0] * o + t[0] * (f - 0.5) * L * 1.6, Math.max(1.4, b.h * y), c.z + n[1] * o + t[1] * (f - 0.5) * L * 1.6];   /* 2,6 м пред стената — отвисоко горната половина на спрайта влизаше в стената */
    r.fire = [pt(0.28, 0.35), pt(0.7, 0.55), pt(0.5, 0.78)]; r.roof = [c.x, b.h + 0.6, c.z]; fireB = { x: wx, z: wz, bx: c.x, bz: c.z }; if (FR2) { r.blk = b; r.pv = deps.pv(); } return r; };
  // блокът, който пожарът (incidents.js) запали от (x, z) — същият става руина (списъкът се подменя и pick можеше да даде съседа)
  const firePick = (x, z) => fireB && Math.hypot(fireB.x - x, fireB.z - z) < 1 ? blockAt(fireB.bx, fireB.bz) : null;
  // скритите — по мястото, не по обекта: при пълненето (refill / bg-fill) записите в списъка се подменят и старият обект вече не крие нищо
  function hideAll() { const pv = deps.pv(); if (!pv || !pv.userData.hideBlocks) return; for (const [r, v] of vis) v.b = blockAt(r.x, r.z) || v.b; const set = new Set([...vis.values()].map(v => v.b)); pv.userData.hideBlocks(set.size ? set : null); }
  function build(r) {
    const b = blockAt(r.x, r.z), grp = deps.group(); if (!b || !grp) return null;
    const { yaw, W } = frame(b), g = new THREE.Group(); grp.add(g);
    const ash = new THREE.Mesh(new THREE.PlaneGeometry(W.wid * 1.5 + 4, W.half * 1.5 + 4), new THREE.MeshStandardMaterial({ map: ashTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    ash.rotation.set(-Math.PI / 2, 0, yaw); ash.position.set(W.ctr.x, 0.06, W.ctr.z); g.add(ash);   // renderOrder 0 — димът (2) се рисува след нея, иначе земята го закриваше (той не пише дълбочина)
    const smoke = []; for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT(), color: 0x55504b, transparent: true, depthWrite: false })); s.userData.ph = i / 8; s.userData.dx = (Math.random() - 0.5) * W.wid * 0.5; s.userData.dz = (Math.random() - 0.5) * W.half * 0.5; s.renderOrder = 2; g.add(s); smoke.push(s); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT(), color: 0xff6a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); glow.scale.set(W.wid * 1.2, Math.max(4, W.h * 0.4), 1); glow.position.set(W.ctr.x, 2, W.ctr.z); glow.renderOrder = 3; g.add(glow);   // жарта — първия ден, личи нощем (спрайт, не PointLight: нова светлина прекомпилира всички материали)
    const v = { b, g, ruin: null, ash, smoke, glow, W, k: ruinKind(W), t: 0 };
    loadRuin(v.k).then(src => { if (!src || vis.get(r) !== v) return; v.ruin = fitRuin(src, W, yaw); g.add(v.ruin); });
    vis.set(r, v); return v;
  }
  function drop(r) { const v = vis.get(r); if (!v) return; v.g.parent && v.g.parent.remove(v.g); v.ash.geometry.dispose(); v.ash.material.dispose(); v.smoke.forEach(s => s.material.dispose()); v.glow.material.dispose(); vis.delete(r); }
  // градският пожар: пожарната закъсня — блокът (x, z) изгаря
  function add(b) {
    const [ox, oz] = off(); if (!b || recs().some(r => r.city === deps.cityId() && Math.hypot(r.x - b.x - ox, r.z - b.z - oz) < 1)) return null;
    const r = { city: deps.cityId(), x: b.x + ox, z: b.z + oz, t0: deps.day() }; recs().push(r);
    if (!build(r)) { recs().splice(recs().indexOf(r), 1); return null; }
    hideAll(); deps.toast('⬛ Пожарната закъсня — сградата изгоря. След няколко дни градът ще разчисти руината и ще строи наново.', 'bad', () => deps.fly(r.x, r.z)); deps.save(); return r;
  }
  // при влизане в града и след прерисуване на кварталите: руините на този град — пак на място
  function sync() { for (const r of [...vis.keys()]) drop(r); const S = deps.S(); if (!S) return; for (const r of recs()) if (r.city === deps.cityId()) build(r); hideAll(); }
  function update(dd) {
    if (!vis.size && !recs().length) return;
    const now = deps.day(), pv = deps.pv(); let gone = false;
    if (pv && pv !== pvAt && pv.userData.done) { pvAt = pv; sync(); }   // нов град / нови квартали — веднъж, щом са готови
    if (vis.size && (chk -= Math.max(dd * 24, 0.05)) <= 0) { chk = 1; for (const [r, v] of vis) if (blockAt(r.x, r.z) !== v.b) { hideAll(); break; } }   // записът е подменен (пълненето) — пак скрит
    for (const [r, v] of vis) {
      const age = Math.max(0, now - r.t0); v.t += dd * 24;
      if (age >= AUTO) { recs().splice(recs().indexOf(r), 1); drop(r); gone = true; deps.toast('🏘️ Изгорялата сграда е разчистена и построена наново.', 'good', () => deps.fly(r.x, r.z)); continue; }
      const hot = age < 1, clr = Math.max(0, (age - (AUTO - CLEAR)) / CLEAR);   // първия ден — тлее; накрая — разчистване
      if (v.ruin) { v.ruin.visible = true; v.ruin.scale.y = v.ruin.userData.s * Math.max(0.1, 1 - clr * 0.9); }
      const top = v.ruin ? v.ruin.userData.h * v.ruin.scale.y / v.ruin.userData.s : 3;
      v.smoke.forEach(s => { s.visible = hot; if (!hot) return; const ph = (v.t * 0.05 + s.userData.ph) % 1; s.position.set(v.W.ctr.x + s.userData.dx + ph * 2, top * 0.8 + ph * 10, v.W.ctr.z + s.userData.dz + ph * 1.5); s.scale.setScalar(4 + ph * 9); s.material.opacity = 0.95 * (1 - age * 0.6) * (1 - ph * ph); });
      v.glow.visible = hot; v.glow.material.opacity = hot ? (1 - age) * (0.55 + 0.2 * Math.sin(v.t * 7)) : 0;
    }
    if (gone) { hideAll(); deps.save(); }
  }
  return { add, sync, update, blockAt, pick, aabb, firePick, state: recs };
}
