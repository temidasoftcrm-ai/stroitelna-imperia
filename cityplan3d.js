// cityplan3d.js — 3D изглед на плана от cityplan.js: естествен терен (без квадратна плоча), вода, извити улици,
// кръстовища, площад, парцели и поставяне на сгради спрямо парцела.
// Паметта: всичко е в няколко слети геометрии с общи материали (без текстури); дървета и лампи — InstancedMesh;
// подробностите (лампи, зебри, очертания на парцелите) се показват само отблизо.
import * as THREE from 'three';
import { pointAt, rectCorners, rectHas } from './cityplan.js';
import { feature } from './lab/feature.js';
import { makeWater } from './water.js';

const MAT = {};   // общи материали за всички градове
function mats() {
  if (MAT.asph) return MAT;
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...o });
  Object.assign(MAT, {
    terrain: m(0xffffff, { vertexColors: true }),
    water: m(0x3d7fa6, { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9 }),
    asph: m(0x3a3d42, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    walk: m(0xb9b4a8, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    paint: m(0xf2f2ea, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    plaza: m(0xcfc6b2, { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    lot: m(0xffffff, { vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    bridge: m(0x9c968a), pole: m(0x50555c), lamp: m(0xfff3c4, { emissive: 0x5a4a20 }),
    trunk: m(0x6b4a2e), leaf: m(0x4f7d3a), pine: m(0x3d6a3a), stone: m(0xd8d2c4), fountain: m(0x6fb4d6, { roughness: 0.2 }),
    edge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  });
  return MAT;
}
// лента по линия: pts [[x,z]], ширина, височина по точка
function ribbon(pts, w, yOf, pos, idx) {
  const base = pos.length / 3;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const y = yOf(i);
    pos.push(pts[i][0] - dz * w / 2, y, pts[i][1] + dx * w / 2, pts[i][0] + dz * w / 2, y, pts[i][1] - dx * w / 2);
    if (i) { const k = base + 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
}
function disc(x, z, rad, y, pos, idx, seg = 20) {
  const base = pos.length / 3; pos.push(x, y, z);
  for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; pos.push(x + Math.cos(a) * rad, y, z + Math.sin(a) * rad); if (k) idx.push(base, base + k + 1, base + k); }
}
function mesh(pos, idx, mat, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const o = new THREE.Mesh(g, mat); o.receiveShadow = true; return o;
}

export function buildPlanView(P0, opts = {}) {
  const M = mats(), g = new THREE.Group(), detail = new THREE.Group(); g.add(detail);
  // opts.seaZ — морето на играта (seaside.js) на север: там теренът слиза под водата
  const sea = opts.seaZ, P = sea == null ? P0 : { ...P0, waterAt: (x, z) => z < sea || P0.waterAt(x, z), heightAt: (x, z) => z < sea ? -3 : P0.heightAt(x, z) };
  g.userData.plan = P;
  // --- терен: голяма мрежа с релеф и цветове по вершини (без текстури)
  const S = opts.size || 1400, seg = opts.seg || 150;
  const WV = makeWater({ repeat: S / 40, color: 0x2a6e9e, strength: 0.6 });   // вълни (свалените нормали waternormals.jpg)
  const tg = new THREE.PlaneGeometry(S, S, seg, seg); tg.rotateX(-Math.PI / 2);
  const pa = tg.attributes.position, col = new Float32Array(pa.count * 3), c = new THREE.Color();
  const grass = new THREE.Color(0x86ad62), park = new THREE.Color(0x93b86b), sand = new THREE.Color(0xdcc994), rock = new THREE.Color(0x8d8576), snow = new THREE.Color(0xf1f1ee), bed = new THREE.Color(0x6f8f86), field = new THREE.Color(0xa6b46a);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), h = P.heightAt(x, z), w = P.waterAt(x, z);
    pa.setY(i, w ? -3 : h);
    if (w) c.copy(bed);
    else {
      c.copy(grass);
      const f = Math.sin(x / 61) * Math.cos(z / 47) + Math.sin((x + z) / 29) * 0.5;   // ниви и поляни извън града
      if (P.parkAt && P.parkAt(x, z)) c.setHex(0x5f9a45);   // парк от картата (Южен парк, Докторска градина…)
      else if (!P.buildable(x, z)) c.lerp(field, Math.max(0, f) * 0.6); else c.lerp(park, 0.4);
      if (h > 8) c.lerp(rock, Math.min(1, (h - 8) / 25)); if (h > 45) c.lerp(snow, Math.min(1, (h - 45) / 15));
      if (P.waterAt(x + 9, z) || P.waterAt(x - 9, z) || P.waterAt(x, z + 9) || P.waterAt(x, z - 9)) c.copy(sand);   // бряг
    }
    col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, M.terrain); g.userData.groundMat = M.terrain; terrain.receiveShadow = true; terrain.name = 'terrain'; g.add(terrain);
  if (P.tpl === 'coastal' || P.tpl === 'river' || P.tpl === 'island' || P.coastZ) {   // coastZ: и заливът на Амстердам, морето на Барселона
    const wg = new THREE.PlaneGeometry(S, S); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, WV.material); water.position.y = -0.6; water.name = 'water'; g.add(water);   // реката/морето — с движещи се вълни (water.js)
  }
  if (P.canals) for (const rc of P.canals.rings) {   // каналите (8 м) са по-тесни от клетката на терена — отделни ивици вода (полукръг на юг от центъра)
    const r = new THREE.Mesh(new THREE.RingGeometry(rc - 4, rc + 4, 72, 1, Math.PI, Math.PI).rotateX(-Math.PI / 2), WV.material);
    r.position.set(P.canals.c[0], -0.3, P.canals.c[1]); r.name = 'canal'; g.add(r);
  }
  // --- улици: тротоар (по-широк) + асфалт; мост над водата; маркировка на булевардите
  const walk = [[], []], asph = [[], []], paint = [[], []], br = [[], []];
  // мрежа от точките на всички улици — „тази точка върху друга улица ли е?“ (пунктирът и зебрите не трябва да минават през чуждо кръстовище)
  const GC = 24, grid = new Map(), gk = (x, z) => Math.floor(x / GC) + ',' + Math.floor(z / GC);
  P.streets.forEach((o, oi) => o.pts.forEach(q => { const k = gk(q[0], q[1]); (grid.get(k) || grid.set(k, []).get(k)).push([q[0], q[1], o.w / 2, oi]); }));
  const onSt = (x, z, si, pad) => { const cx = Math.floor(x / GC), cz = Math.floor(z / GC);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = grid.get((cx + i) + ',' + (cz + j)); if (L) for (const [qx, qz, hw, oi] of L) if (oi !== si && Math.hypot(qx - x, qz - z) < hw + pad) return true; }
    return false; };
  for (const [si, st] of P.streets.entries()) {
    const wet = st.pts.map(p => P.waterAt(p[0], p[1]));
    const yb = st.pts.map((p, i) => { let m = 0; for (let k = -8; k <= 8; k++) if (wet[i + k]) m = Math.max(m, 1 - Math.abs(k) / 9); return m * 2.2; });   // рампа към моста
    const gh = st.pts.map((p, i) => wet[i] ? 0 : Math.max(0, P.heightAt(p[0], p[1])));   // извън града пътят следва релефа
    for (let i = 0; i < yb.length; i++) yb[i] += gh[i];
    ribbon(st.pts, st.w + 3.4, i => 0.03 + yb[i], ...walk);
    ribbon(st.pts, st.w, i => 0.06 + yb[i], ...asph);
    if (wet.some(Boolean)) {   // парапетите и плочата на моста
      let run = []; const flush = () => { if (run.length > 1) { const ps = run.map(i => st.pts[i]); ribbon(ps, st.w + 4, j => yb[run[j]] - 0.6, ...br); } run = []; };
      wet.forEach((w, i) => { if (yb[i] > 0.5) run.push(i); else flush(); }); flush();
    }
    if (st.w >= 10) {   // прекъсната средна линия — не в кръстовищата
      const L = st.L.at(-1), nodes = P.nodes.filter(n => !n.square);
      for (let s = 3; s < L - 3; s += 6) {
        const a = pointAt(st, s), b = pointAt(st, s + 3);
        if (nodes.some(n => Math.hypot(n.x - a.x, n.z - a.z) < st.w) || onSt(a.x, a.z, si, st.w / 2 + 2) || onSt(b.x, b.z, si, st.w / 2 + 2)) continue;   // и там, където асфалтът на две улици се допира (сливане под малък ъгъл)
        const i0 = Math.round(s / 2);
        ribbon([[a.x, a.z], [b.x, b.z]], 0.25, () => 0.09 + (yb[i0] || 0), ...paint);
      }
    }
  }
  // кръстовища: асфалтов кръг (крие застъпването на лентите) и зебри на всеки изход
  const zebra = [[], []];
  for (const n of P.nodes) {
    if (n.square || n.deg < 3) continue;
    const ny = Math.max(0, P.heightAt(n.x, n.z));
    const ws = P.edges.filter(e => e.a === P.nodes.indexOf(n) || e.b === P.nodes.indexOf(n)).map(e => P.streets[e.st].w);
    const rad = Math.max(...ws, 7) / 2 + 0.6;
    disc(n.x, n.z, rad + 1.7, 0.035 + ny, ...walk); disc(n.x, n.z, rad, 0.07 + ny, ...asph);
  }
  // задънените улици в града (Лабораторията → road-ends): краят се доизтегля до близка улица, ако пътят е свободен
  // (без парцел, вода и площад по пътя); иначе — обърнат кръг накрая, както на истинска задънена улица. Само изгледът —
  // планът, парцелите и записът не се променят.
  if (feature('road-ends')) for (const [ni, n] of P.nodes.entries()) {
    if (n.square || n.deg !== 1) continue;
    const e = P.edges.find(q => q.a === ni || q.b === ni), st = e && P.streets[e.st];
    if (!st || st.cls !== 'street' || !P.buildable(n.x, n.z)) continue;   // булевардите и кейовете излизат от града
    const s = e.a === ni ? e.s0 : e.s1, at = pointAt(st, s), sgn = s < st.L.at(-1) / 2 ? -1 : 1, ux = at.tx * sgn, uz = at.tz * sgn;   // посоката навън
    const ny = Math.max(0, P.heightAt(n.x, n.z));
    let best = null;
    P.streets.forEach((o, oi) => { if (oi === e.st) return; for (const q of o.pts) {
      const dx = q[0] - n.x, dz = q[1] - n.z, d = Math.hypot(dx, dz);
      if (d < 3 || d > 45 || (dx * ux + dz * uz) / d < 0.55) continue;   // напред, не встрани
      if (!best || d < best.d) best = { d, q, w: o.w };
    } });
    const clear = b => { const L = b.d, k = Math.ceil(L / 2);
      for (let i = 0; i <= k; i++) { const t = i / k, x = n.x + (b.q[0] - n.x) * t, z = n.z + (b.q[1] - n.z) * t;
        if (P.waterAt(x, z) || Math.hypot(x - P.square.x, z - P.square.z) < P.square.r + 2) return false;
        if (t < 0.98 && P.lots.some(L2 => Math.abs(L2.x - x) < 30 && Math.abs(L2.z - z) < 30 && rectHas(L2, [x, z], st.w / 2 + 0.6))) return false; }
      return true; };
    if (best && clear(best)) {
      const pts = [[n.x, n.z], best.q];
      ribbon(pts, st.w + 3.4, () => 0.03 + ny, ...walk); ribbon(pts, st.w, () => 0.06 + ny, ...asph);
      const rad = Math.max(st.w, best.w) / 2 + 0.6; disc(best.q[0], best.q[1], rad + 1.7, 0.035 + ny, ...walk); disc(best.q[0], best.q[1], rad, 0.07 + ny, ...asph);   // новото Т-кръстовище
    } else {
      const r = st.w / 2 + 1.8; disc(n.x, n.z, r + 1.6, 0.035 + ny, ...walk, 24); disc(n.x, n.z, r, 0.07 + ny, ...asph, 24);
    }
  }
  // зебри и светофари — само на истинските кръстовища: поне един булевард/пръстен, без съседно кръстовище по-близо от 22 м
  // (извитите улици дават много близки възли — там зебрите се застъпваха); зебра само на изход, по-дълъг от 16 м
  const major = [];
  P.nodes.forEach((n, ni) => {
    if (n.square || n.deg < 3 || P.heightAt(n.x, n.z) > 0.3) return;
    const es = P.edges.filter(e => e.a === ni || e.b === ni);
    if (!es.some(e => P.streets[e.st].w >= 10)) return;
    if (major.some(m => Math.hypot(m.n.x - n.x, m.n.z - n.z) < 22)) return;
    major.push({ n, ni, es });
  });
  const sig = [];   // [x, z, ос (ъгъл на улицата)] — светофар на десния ъгъл на всеки изход
  const zbr = [];
  for (const { n, ni, es } of major) for (const e of es) {
    if (Math.abs(e.s1 - e.s0) < 16) continue;
    const wMax = Math.max(...es.map(q => P.streets[q.st].w));
    const st = P.streets[e.st], s = e.a === ni ? e.s0 : e.s1, dir = e.a === ni ? 1 : -1, rad = wMax / 2 + 3.2;   // извън кръга на кръстовището (по най-широката улица)
    const p = pointAt(st, s + dir * rad);
    // без застъпване: не върху друга улица и не до друга зебра (извитите улици дават близки изходи)
    // цялата зебра (двата края и средата, ± дължината на ивиците) трябва да е само върху своята улица — при диагоналните кръстовища краят ѝ иначе влиза в съседната
    const zp = [];
    for (const k of [-st.w / 2, 0, st.w / 2]) for (const t of [-1.6, 1.6]) zp.push([p.x - p.tz * k + p.tx * t, p.z + p.tx * k + p.tz * t]);
    if (zp.some(([x, z]) => onSt(x, z, e.st, 0.6)) || zbr.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 8)) continue;
    zbr.push([p.x, p.z]);
    for (let k = -st.w / 2 + 0.8; k < st.w / 2 - 0.5; k += 1.3) {
      const cx = p.x - p.tz * k, cz = p.z + p.tx * k;
      ribbon([[cx - p.tx * 1.4, cz - p.tz * 1.4], [cx + p.tx * 1.4, cz + p.tz * 1.4]], 0.6, () => 0.1, ...zebra);
    }
    const o = st.w / 2 + 1.0, q = pointAt(st, s + dir * (rad + 2.2));
    sig.push([q.x - q.tz * o * dir, q.z + q.tx * o * dir, Math.atan2(q.tx, q.tz), Math.abs(q.tx) > Math.abs(q.tz) ? 0 : 1]);
  }
  g.add(mesh(...walk, M.walk), mesh(...asph, M.asph), mesh(...paint, M.paint));
  if (br[0].length) g.add(mesh(...br, M.bridge));
  const zm = mesh(...zebra, M.paint); detail.add(zm);
  // --- надписът HOLLYWOOD (Лос Анджелис по картата): бели букви от греди на склона на хълма, обърнати към града
  if (P.sign) {
    const SEG = { H: [[0, 0, 0, 5], [3, 0, 3, 5], [0, 2.5, 3, 2.5]], O: [[0, 0, 0, 5], [3, 0, 3, 5], [0, 0, 3, 0], [0, 5, 3, 5]], L: [[0, 0, 0, 5], [0, 0, 3, 0]],
      Y: [[0, 5, 1.5, 2.4], [3, 5, 1.5, 2.4], [1.5, 0, 1.5, 2.4]], W: [[0, 5, 0.75, 0], [0.75, 0, 1.5, 3], [1.5, 3, 2.25, 0], [2.25, 0, 3, 5]],
      D: [[0, 0, 0, 5], [0, 5, 2, 5], [0, 0, 2, 0], [2, 5, 3, 4], [3, 4, 3, 1], [3, 1, 2, 0]] };
    const U = 1.9, T = 0.75, word = 'HOLLYWOOD', dx = Math.cos(P.sign.a), dz = Math.sin(P.sign.a);
    const right = new THREE.Vector3(-dz, 0, dx), up = new THREE.Vector3(0, 1, 0), qP = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, new THREE.Vector3(-dx, 0, -dz)));
    const strokes = []; [...word].forEach((ch, i) => SEG[ch].forEach(sg => strokes.push([i, ...sg])));
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xf4f4ef, roughness: 0.6, emissive: 0xfff6e0, emissiveIntensity: 0.12 }), strokes.length);
    const m4 = new THREE.Matrix4(), qS = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), z1 = new THREE.Vector3(0, 0, 1), W0 = (word.length * 4.4 - 1.4) * U / 2;
    strokes.forEach(([i, u0, v0, u1, v1], k) => {
      const lx = i * 4.4 * U - W0, cx = lx + (u0 + u1) / 2 * U, px = P.sign.x + right.x * cx, pz = P.sign.z + right.z * cx;
      const base = Math.max(0, P.heightAt(P.sign.x + right.x * (lx + 1.5 * U), P.sign.z + right.z * (lx + 1.5 * U))) - 0.6;   // всяка буква стъпва на склона
      pos.set(px, base + (v0 + v1) / 2 * U, pz);
      qS.setFromAxisAngle(z1, Math.atan2(v1 - v0, u1 - u0)); sc.set(Math.hypot(u1 - u0, v1 - v0) * U + T * U, T * U, 0.5);
      im.setMatrixAt(k, m4.compose(pos, qP.clone().multiply(qS), sc));
    });
    im.castShadow = true; im.name = 'hollywood'; g.add(im);
    im.material.userData.winK = 0.85; (g.userData.nightMats = g.userData.nightMats || []).push(im.material);   // нощем — осветен от прожекторите (game.js → dayNight)
  }
  // --- площад: павета, фонтан, кръг от дървета
  const sq = P.square, pl = [[], []]; disc(sq.x, sq.z, sq.r + 1, 0.08, ...pl, 32);
  g.add(mesh(...pl, M.plaza));
  if (!opts.noFountain && opts.fountainProto) { const f = opts.fountainProto.clone(true); const fr = Math.min(feature('real-sizes') ? 3.4 : 6.5, sq.r * 0.33); f.scale.setScalar(fr); f.position.set(sq.x, 0.08, sq.z);   /* real-sizes (55): моделът е 2,08 м широк → басейн ~7 м, не 13,5 м */ f.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(f);
    if (opts.benchProto) {   // пейки в кръг около фонтана, с лице към него
      const bp = opts.benchProto, bb = new THREE.Box3().setFromObject(bp), bs = bb.getSize(new THREE.Vector3()), k = 2.2 / Math.max(bs.x, bs.z), R = fr / 2 + 4.5;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, b = bp.clone(true); b.scale.setScalar(k); b.position.set(sq.x + Math.cos(a) * R, 0.08 - bb.min.y * k, sq.z + Math.sin(a) * R); b.rotation.y = -a - Math.PI / 2; b.traverse(o => { if (o.isMesh) o.castShadow = true; }); detail.add(b); }
    }
  }   // истинският фонтан (plants-real)
  else if (!opts.noFountain) { const fk = feature('real-sizes') ? 0.76 : 1;   /* real-sizes (55): басейн 7 м вместо 9,2 м */ const f = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * fk, 4.6 * fk, 0.8, 24), M.stone); f.position.set(sq.x, 0.4, sq.z); g.add(f);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(3.7 * fk, 3.7 * fk, 0.1, 24), M.fountain); w.position.set(sq.x, 0.82, sq.z); g.add(w);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 4, 10), M.stone); s.position.set(sq.x, 2.2, sq.z); g.add(s); }
  // --- парцели: светли площадки (цвят по зона), очертания отблизо
  const lp = [[], [], []], le = [], zc = { center: new THREE.Color(0xc9c1ad), mid: new THREE.Color(0xb7bd98), outer: new THREE.Color(0xa3b97f) };
  for (const L of P.lots.slice(0, opts.lotCount ?? P.lots.length)) {   // в играта — само купените (ядро + кварталите)
    const cs = rectCorners(L.x, L.z, L.w / 2, L.d / 2, L.rot), b = lp[0].length / 3, cc = zc[L.zone];
    for (const p of cs) { lp[0].push(p[0], 0.04, p[1]); lp[2].push(cc.r, cc.g, cc.b); }
    lp[1].push(b, b + 2, b + 1, b, b + 3, b + 2);
    for (let k = 0; k < 4; k++) { const p = cs[k], q = cs[(k + 1) % 4]; le.push(p[0], 0.12, p[1], q[0], 0.12, q[1]); }
  }
  g.add(mesh(lp[0], lp[1], M.lot, lp[2]));
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(le, 3));
  const edges = new THREE.LineSegments(eg, M.edge); edges.name = 'lotEdges'; detail.add(edges);
  // --- лампи по булевардите (InstancedMesh: стълб + глава)
  const lampAt = [];
  // по булевардите — през 34 м, редуват се ляво/дясно; не върху асфалт (кръстовища, пресечни улици) и не до друга лампа
  const onAsph = (x, z) => P.streets.some(o => o.pts.some((q, i) => i % 2 === 0 && Math.hypot(q[0] - x, q[1] - z) < o.w / 2 + 0.9));
  P.streets.forEach((st, si) => { if (st.w < 10) return; let k = si;
    for (let s = 10; s < st.L.at(-1) - 6; s += 34) {
      const side = k++ % 2 ? 1 : -1, p = pointAt(st, s), o = st.w / 2 + 1.1; if (P.waterAt(p.x, p.z) || !P.buildable(p.x, p.z) && P.heightAt(p.x, p.z) > 0.3) continue;
      const x = p.x - p.tz * o * side, z = p.z + p.tx * o * side;
      if (onAsph(x, z) || lampAt.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
      lampAt.push([x, z]);
    } });
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), M.pole, lampAt.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), M.lamp, lampAt.length), m4 = new THREE.Matrix4();
  lampAt.forEach(([x, z], i) => { pole.setMatrixAt(i, m4.makeTranslation(x, 3, z)); head.setMatrixAt(i, m4.makeTranslation(x, 6.1, z)); });
  detail.add(pole, head);
  // --- светофари на големите кръстовища: стълб + кутия + червена/зелена светлина; двете оси се редуват (g.userData.update)
  if (sig.length) {
    const sp = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 6), M.pole, sig.length);
    const bx = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1.3, 0.45), new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.6 }), sig.length);
    const red = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), sig.length);
    const grn = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0x34e05a }), sig.length);
    const q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), off = new THREE.Vector3();
    const put = (im, i, x, y, z, a, fwd) => { off.set(0, 0, fwd).applyEuler(e3.set(0, a, 0)); im.setMatrixAt(i, m4.compose(v.set(x + off.x, y, z + off.z), q.setFromEuler(e3.set(0, a, 0)), one)); };
    sig.forEach(([x, z, a], i) => { put(sp, i, x, 0, z, a, 0); sp.setMatrixAt(i, m4.makeTranslation(x, 2.1, z)); put(bx, i, x, 4.3, z, a, 0); put(red, i, x, 4.7, z, a, -0.24); put(grn, i, x, 3.9, z, a, -0.24); });
    detail.add(sp, bx, red, grn);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), mR = [], mG = [];
    for (let i = 0; i < sig.length; i++) { red.getMatrixAt(i, m4); mR.push(m4.clone()); grn.getMatrixAt(i, m4); mG.push(m4.clone()); }
    let ph = -1;
    g.userData.update = t => {   // 8 s зелено за едната ос, 8 s за другата (жълтото — пропуснато, за простота)
      const p2 = Math.floor(t / 8) % 2; if (p2 === ph) return; ph = p2;
      sig.forEach((s0, i) => { const go = s0[3] === p2; red.setMatrixAt(i, go ? zero : mR[i]); grn.setMatrixAt(i, go ? mG[i] : zero); });
      red.instanceMatrix.needsUpdate = grn.instanceMatrix.needsUpdate = true;
    };
    g.userData.update(0);
  }
  { const sigUpd = g.userData.update; g.userData.update = t => { WV.update(t); if (sigUpd) sigUpd(t); }; }   // вълните се движат всеки кадър
  g.userData.lamps = lampAt.filter((_, i) => i % Math.ceil(lampAt.length / 160) === 0).map(([x, z]) => ({ x, y: 6.1, z }));   // светлините нощем (daynight.js) — до 160
  // --- дървета: в града (около площада, празните кътчета) и гори по хълмовете — общи инстанции
  const trees = [], rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let k = 0; k < (opts.noFountain ? 16 : 10); k++) { const a = k / (opts.noFountain ? 16 : 10) * Math.PI * 2; trees.push([sq.x + Math.cos(a) * (sq.r - 2.5), sq.z + Math.sin(a) * (sq.r - 2.5), 0.9, 0]); }
  const roadNear = (x, z, pad) => P.streets.some(st => st.pts.some((p, i) => i % 2 === 0 && Math.abs(p[0] - x) < st.w / 2 + pad && Math.abs(p[1] - z) < st.w / 2 + pad));
  const lotNear = (x, z) => P.lots.slice(0, opts.lotCount ?? P.lots.length).some(L => Math.abs(L.x - x) < 14 && Math.abs(L.z - z) < 14);
  const realTrees = feature('trees-real') && (opts.treeProtos || []).length;   // истинските са по-тежки — по-рядко
  for (let k = 0; k < (opts.trees || (realTrees ? 1000 : 2200)); k++) {
    const x = (rnd() - 0.5) * S * 0.8, z = (rnd() - 0.5) * S * 0.8, h = P.heightAt(x, z);
    if (P.waterAt(x, z) || h > 55) continue;
    const inTown = P.buildable(x, z);
    if (inTown && (rnd() < 0.55 || lotNear(x, z))) continue;
    const inPark = P.parkAt && P.parkAt(x, z);
    if (!inTown && !inPark && h < 4 && rnd() < 0.72) continue;   // равното извън града — ниви, рядко дърво
    if (roadNear(x, z, 3)) continue;
    if (P.bigZone && rectHas(P.bigZone, [x, z], 4)) continue;   // мястото на голямата забележителност
    trees.push([x, z, 0.7 + rnd() * 0.7, h > 6 ? 1 : 0]);
  }
  // парковете от картата — гъста гора от дървета (до 1600), без да стъпват на улица
  for (const q of P.parks || []) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of q.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const n = Math.min(realTrees ? 260 : 500, ((x1 - x0) * (z1 - z0)) / (realTrees ? 130 : 70));
    for (let k = 0; k < n && trees.length < 2600; k++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!P.parkAt(x, z) || roadNear(x, z, 2)) continue;
      trees.push([x, z, 0.75 + rnd() * 0.6, rnd() < 0.25 ? 1 : 0]);
    }
  }
  // празните зелени площи в града (между парцелите и улиците): горички, храсти, цветни лехи, пейки — зад feature('green-fill').
  // Решетка 10 м, по хеш на клетката (един и същ изглед при всяко влизане); не до парцел (и бъдещите квартали), улица или площад.
  if (feature('green-fill')) {
    const allLot = (x, z) => P.lots.some(L => Math.abs(L.x - x) < L.w / 2 + 3 && Math.abs(L.z - z) < L.d / 2 + 3 && rectHas(L, [x, z], 3));
    const hh = (x, z) => { let k = Math.imul(Math.round(x * 3) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.round(z * 3), 0xc2b2ae35); k ^= k >>> 13; k = Math.imul(k, 0x27d4eb2d); return ((k ^ (k >>> 15)) >>> 0) / 4294967296; };
    const bush = [], flow = [], bench = [], alley = [];
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of P.boundary) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let x = x0; x < x1; x += 10) for (let z = z0; z < z1; z += 10) {
      if (!P.buildable(x, z) || P.heightAt(x, z) > 2 || Math.hypot(x - sq.x, z - sq.z) < sq.r + 6) continue;
      if (P.bigZone && rectHas(P.bigZone, [x, z], 4)) continue;
      if (allLot(x, z) || roadNear(x, z, 3)) continue;
      const r1 = hh(x, z), r2 = hh(z + 7.1, x - 3.3), cx = x + (r2 - 0.5) * 5, cz = z + (r1 - 0.5) * 5;
      if (r1 < 0.5 && trees.length < 2400) { const n = 2 + ((r2 * 3) | 0); for (let k = 0; k < n; k++) trees.push([cx + Math.cos(k * 2.3 + r2 * 6) * 2.6, cz + Math.sin(k * 2.3 + r2 * 6) * 2.6, 0.75 + hh(cx + k, cz) * 0.5, 0]); }
      else if (r1 < 0.72) { for (let k = 0; k < 3; k++) bush.push([cx + Math.cos(k * 2.1) * 1.8, cz + Math.sin(k * 2.1) * 1.8, 0.8 + 0.4 * hh(cx, cz + k)]); for (let k = 0; k < 9; k++) flow.push([cx + (hh(cx + k, cz) - 0.5) * 6, cz + (hh(cz, cx + k) - 0.5) * 6, k % 3]); }
      else if (r1 < 0.8) { bench.push([cx, cz, r2 * Math.PI]); bush.push([cx + 2.4, cz + 1.2, 0.8]); }
      if (r2 < 0.45) {   // алеи: светла пътека към съседната зелена клетка (по-малките пространства стават парк с пътеки)
        for (const [dx, dz] of [[10, 0], [0, 10]]) { const nx = x + dx, nz = z + dz;
          if (P.buildable(nx, nz) && !allLot(nx, nz) && !roadNear(nx, nz, 3)) alley.push([x + dx / 2, z + dz / 2, dx ? 0 : Math.PI / 2]); }
      }
    }
    const put = (geo, mat, list, f) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((p, i) => im.setMatrixAt(i, f(p))); im.castShadow = true; detail.add(im); };
    const q2 = new THREE.Quaternion(), e2 = new THREE.Euler(), v2 = new THREE.Vector3(), s2 = new THREE.Vector3();
    const PP = opts.plantProtos || [];
    if (PP.length) {   // истински храсти и цветя (plants-real): всеки меш на прототипа — една InstancedMesh
      const inst = (pr, list, f) => { if (!list.length) return; pr.updateMatrixWorld(true); pr.traverse(o => { if (!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(o.matrixWorld), im = new THREE.InstancedMesh(geo, o.material, list.length); list.forEach((p, i) => im.setMatrixAt(i, f(p, i))); im.castShadow = true; detail.add(im); }); };
      const bushes = PP.slice(0, 2), low = PP[2] || PP[0];
      bushes.forEach((pr, bi) => inst(pr, bush.filter((_, i) => i % bushes.length === bi), ([x, z, k], i) => m4.compose(v2.set(x, 0, z), q2.setFromEuler(e2.set(0, i * 2.39, 0)), s2.setScalar(2.4 * k))));
      inst(low, flow.filter((_, i) => i % 3 === 0), ([x, z], i) => m4.compose(v2.set(x, 0, z), q2.setFromEuler(e2.set(0, i * 1.7, 0)), s2.setScalar(1.5)));
    } else {
    put(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9 }), bush, ([x, z, k]) => m4.compose(v2.set(x, 0.55 * k, z), q2.identity(), s2.set(1.2 * k, 0.8 * k, 1.2 * k)));
    for (const [c, ci] of [[0xe0443a, 0], [0xf5c542, 1], [0x9b59d0, 2]]) put(new THREE.SphereGeometry(0.28, 6, 4), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }), flow.filter(f => f[2] === ci), ([x, z]) => m4.compose(v2.set(x, 0.3, z), q2.identity(), s2.set(1, 1, 1)));
    }
    put(new THREE.BoxGeometry(10.4, 0.06, 1.8), new THREE.MeshStandardMaterial({ color: 0xd8c9a6, roughness: 1 }), alley, ([x, z, a]) => m4.compose(v2.set(x, 0.07, z), q2.setFromEuler(e2.set(0, a, 0)), s2.set(1, 1, 1)));
    put(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.8 }), bench, ([x, z, a]) => m4.compose(v2.set(x, 0.45, z), q2.setFromEuler(e2.set(0, a, 0)), s2.set(1, 1, 1)));
  }
  // истински дървета (Лабораторията → trees-real): прототипите от горския пакет на играта (основа в 0, височина 1),
  // всеки меш на прототипа — една InstancedMesh; широколистните в града, боровете по хълмовете
  const protos = feature('trees-real') ? (opts.treeProtos || []) : [];
  if (protos.length) {
    const broad = protos.filter(p => !p.userData.pine), pines = protos.filter(p => p.userData.pine);
    const groups = new Map();   // прототип → [матрици]
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    trees.forEach(([x, z, s, pine], i) => {
      const list = pine && pines.length ? pines : broad.length ? broad : pines, pr = list[(i * 7 + 3) % list.length], H = (pine ? 9 : 7.5) * s;
      (groups.get(pr) || groups.set(pr, []).get(pr)).push(new THREE.Matrix4().compose(v.set(x, P.heightAt(x, z), z), q.setFromEuler(e.set(0, i * 2.39, 0)), sc.set(H, H, H)));
    });
    for (const [pr, mats] of groups) {
      pr.updateMatrixWorld(true);
      pr.traverse(o => {
        if (!o.isMesh || o.visible === false) return;
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld), im = new THREE.InstancedMesh(geo, o.material, mats.length);
        mats.forEach((m, k) => im.setMatrixAt(k, m)); im.castShadow = true; im.receiveShadow = true; g.add(im);
      });
    }
    g.userData.lod = cam => { const d = cam.position.distanceTo(opts.target || new THREE.Vector3()); detail.visible = d < (opts.detailDist || 420); };
    return g;
  }
  const cone = new THREE.ConeGeometry(2.2, 6, 7), ball = new THREE.IcosahedronGeometry(2.6, 0), stem = new THREE.CylinderGeometry(0.28, 0.36, 2.4, 5);
  const N = [trees.filter(t => !t[3]).length, trees.filter(t => t[3]).length];
  const tr = new THREE.InstancedMesh(stem, M.trunk, trees.length), lb = new THREE.InstancedMesh(ball, M.leaf, N[0]), lc = new THREE.InstancedMesh(cone, M.pine, N[1]);
  const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(); let i0 = 0, i1 = 0;
  trees.forEach(([x, z, s, pine], i) => {
    const y = P.heightAt(x, z);
    tr.setMatrixAt(i, m4.compose(v.set(x, y + 1.2 * s, z), q, sc.set(s, s, s)));
    if (pine) lc.setMatrixAt(i1++, m4.compose(v.set(x, y + (2.4 + 3) * s, z), q, sc.set(s, s, s)));
    else lb.setMatrixAt(i0++, m4.compose(v.set(x, y + (2.4 + 2) * s, z), q, sc.set(s, s * 1.15, s)));
  });
  for (const o of [tr, lb, lc]) { o.castShadow = true; g.add(o); }
  // --- подробности само отблизо
  g.userData.lod = cam => { const d = cam.position.distanceTo(opts.target || new THREE.Vector3()); detail.visible = d < (opts.detailDist || 420); };
  return g;
}

// сграда върху парцел: завърта се с лицето към улицата, вписва се в парцела (с отстъп), центрира се по рамката
const box = new THREE.Box3(), sz = new THREE.Vector3();
export function placeOnLot(obj, L, { margin = 2.5, extraRot = 0 } = {}) {
  obj.rotation.set(0, 0, 0); obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  box.setFromObject(obj); box.getSize(sz);
  const k = Math.min((L.w - 2 * margin) / sz.x, (L.d - 2 * margin) / sz.z);   // локалното x на модела е по улицата, z — към нея
  obj.scale.setScalar(k);
  const cx = (box.min.x + box.max.x) / 2 * k, cz = (box.min.z + box.max.z) / 2 * k, rot = L.rot + extraRot, c = Math.cos(rot), s = Math.sin(rot);
  obj.rotation.y = rot;
  obj.position.set(L.x - (cx * c + cz * s), -box.min.y * k, L.z - (-cx * s + cz * c));
  return obj;
}
