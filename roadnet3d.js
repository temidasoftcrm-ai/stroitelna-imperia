// roadnet3d.js — изгледът на пътната мрежа (roadnet.js): всичко се генерира от шаблоните на възлите и сегментите — асфалт, тротоари,
// бордюри, маркировка (спира на стоп линията / след зебрата), зебри, стоп линии, знаци (предимство / пропусни), светофари, кръговото.
// Всеки сегмент и всеки възел — своя група: update({ nodes, segs }) прерисува само тях (не целия град).
// buildRoadView(net, { plants, fountain }) → { group, update(changed), lights(signals), dispose() }
import * as THREE from 'three';
import { mats, ribbon, disc, merge, offLine, dashed, circle, quad } from './cityplan2-3d.js';
import { at, cumLen } from './roadnet.js';

const arcPts = (cx, cz, r, a0, a1, m = 28) => Array.from({ length: m + 1 }, (_, k) => { const a = a0 + (a1 - a0) * k / m; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
const bez = (p0, c, p1, m = 12) => Array.from({ length: m + 1 }, (_, k) => { const t = k / m, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
// лента с височина за всяка точка (мостът): ys — по една на точка
function ribbonY(pts, ys, w, dy) { const r = ribbon(pts, w, 0); for (let i = 0; i < pts.length; i++) { r.pos[i * 6 + 1] = ys[i] + dy; r.pos[i * 6 + 4] = ys[i] + dy; } return r; }
const trimS = (pts, L, s0, s1) => { const T = L[L.length - 1]; if (T - s0 - s1 < 0.3) return null; const out = [at(pts, L, s0).p]; for (let k = 0; k < pts.length; k++) if (L[k] > s0 + 0.05 && L[k] < T - s1 - 0.05) out.push(pts[k]); out.push(at(pts, L, T - s1).p); return out; };

export function buildRoadView(net, opts = {}) {
  const MAT = mats(), G = new THREE.Group(), segG = new Map(), nodeG = new Map(), heads = new Map();
  G.name = 'roadnet';
  const BAR = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d'); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#d32f2f'; g.fillRect(i * 16, 0, 16, 16); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return { beam: new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), post: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }) }; })();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6 }), deck = new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.9 });
  const lampOn = { r: new THREE.MeshBasicMaterial({ color: 0xff2a1a }), y: new THREE.MeshBasicMaterial({ color: 0xffc21a }), g: new THREE.MeshBasicMaterial({ color: 0x27e36b }), off: new THREE.MeshBasicMaterial({ color: 0x2a2a2a }) };
  const signMat = { yield: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x220000 }), prio: new THREE.MeshStandardMaterial({ color: 0xf2c230 }), red: new THREE.MeshStandardMaterial({ color: 0xd32f2f }) };
  const add = (g, arr, mat) => { if (arr.length) g.add(merge(arr, mat)); };
  const cutOf = (n, segId, end, what) => net.cut(n, segId, end, what);   // срезовете — от мрежата (общи с тротоарите на пешеходците)
  // ---- сегмент
  function buildSeg(sg) {
    const g = new THREE.Group(), nA = net.nodes.get(sg.a), nB = net.nodes.get(sg.b), As = [], W = [], Cb = [], Pt = [], Md = [], L = sg.L, T = L[L.length - 1];
    const ys = pts => pts.map(p => { let best = 0, bd = 1e9; for (let k = 0; k < sg.pts.length; k++) { const d = (sg.pts[k][0] - p[0]) ** 2 + (sg.pts[k][1] - p[1]) ** 2; if (d < bd) { bd = d; best = k; } } return net.yAt(sg, L[best]); });
    const pa = trimS(sg.pts, L, cutOf(nA, sg.id, 0, 'asph'), cutOf(nB, sg.id, 1, 'asph'));
    const below = sg.level < 0;   // тунел: под земята — само порталите
    if (pa && !below) As.push(sg.level ? ribbonY(pa, ys(pa), sg.w, 0.07) : ribbon(pa, sg.w, 0.07));
    for (const [sgn, key] of [[1, 'walkL'], [-1, 'walkR']]) {
      const ps = trimS(sg.pts, L, cutOf(nA, sg.id, 0, key), cutOf(nB, sg.id, 1, sgn > 0 ? 'walkR' : 'walkL')); if (!ps || below) continue;
      const wl = offLine(ps, sgn * (sg.w / 2 + sg.walk / 2)), cl = offLine(ps, sgn * (sg.w / 2 + 0.15));
      if (sg.level) { W.push(ribbonY(wl, ys(ps), sg.walk, 0.1)); Cb.push(ribbonY(cl, ys(ps), 0.3, 0.12)); } else { W.push(ribbon(wl, sg.walk, 0.04)); Cb.push(ribbon(cl, 0.3, 0.09)); }
    }
    const pl = trimS(sg.pts, L, cutOf(nA, sg.id, 0, 'mark'), cutOf(nB, sg.id, 1, 'mark'));
    if (pl && !below) { const y0 = sg.level ? null : 0.12, put = (pts, w) => Pt.push(sg.level ? ribbonY(pts, ys(pts), w, 0.12) : ribbon(pts, w, y0));
      if (sg.median) { const pm = trimS(sg.pts, L, cutOf(nA, sg.id, 0, 'median'), cutOf(nB, sg.id, 1, 'median')); if (pm) { Md.push(sg.level ? ribbonY(pm, ys(pm), sg.median, 0.11) : ribbon(pm, sg.median, 0.1)); for (const s2 of [1, -1]) put(offLine(pl, s2 * (sg.median / 2 + 0.3)), 0.15); } }
      else if (sg.lanes[0] + sg.lanes[1] > 2) for (const s2 of [0.12, -0.12]) put(offLine(pl, s2), 0.12);   // авеню без ивица — двойна непрекъсната
      if (sg.rank >= 2) for (const s2 of [1, -1]) { put(offLine(pl, s2 * (sg.w / 2 - 0.4)), 0.15); if (sg.lanes[0] > 1) { const dl = []; dashed(offLine(pl, s2 * (sg.median / 2 + sg.laneW)), 3, 6, 0.15, sg.level ? 0 : 0.12, dl); if (sg.level) for (const d of dl) for (let k = 1; k < d.pos.length; k += 3) d.pos[k] += 0.12 + net.yAt(sg, T / 2); Pt.push(...dl); } }
      else { const dl = []; dashed(pl, 3, 4, 0.16, sg.level ? 0 : 0.12, dl); if (sg.level) for (const d of dl) for (let k = 1; k < d.pos.length; k += 3) d.pos[k] += 0.12 + net.yAt(sg, T / 2); Pt.push(...dl); } }
    add(g, As, MAT.asph); add(g, W, MAT.walk); add(g, Cb, MAT.curb); add(g, Pt, MAT.paint); add(g, Md, MAT.median);
    if (sg.level > 0) {   // мостът: стълбове под платното и парапети
      for (let s = 20; s < T - 20; s += 18) { const p = at(sg.pts, L, s).p, y = net.yAt(sg, s); if (y < 2) continue; const col = new THREE.Mesh(new THREE.BoxGeometry(1.2, y, 1.2), deck); col.position.set(p[0], y / 2, p[1]); g.add(col); }
      for (const s2 of [1, -1]) { const pp = offLine(sg.pts, s2 * (sg.w / 2 + sg.walk + 0.1)), r = ribbonY(pp, sg.pts.map((_, k) => net.yAt(sg, L[k])), 0.25, 0.9); g.add(merge([r], deck)); }
    }
    if (sg.level < 0) for (const s of [Math.min(45, T / 2) - 10, T - Math.min(45, T / 2) + 10]) {   // тунел: портали
      const p = at(sg.pts, L, s), fr = new THREE.Mesh(new THREE.BoxGeometry(sg.w + 2 * sg.walk + 2, 6, 1.5), deck); fr.position.set(p.p[0], 3, p.p[1]); fr.rotation.y = -Math.atan2(p.u[1], p.u[0]) + Math.PI / 2; g.add(fr);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(sg.w + 2 * sg.walk, 5), new THREE.MeshBasicMaterial({ color: 0x0b0c0e })); hole.position.set(p.p[0], 2.5, p.p[1]); hole.rotation.y = fr.rotation.y; hole.position.x += p.u[0] * 0.8; hole.position.z += p.u[1] * 0.8; g.add(hole); }
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return g;
  }
  // ---- възел
  function buildNode(n) {
    const g = new THREE.Group(), T = n.tpl_, As = [], W = [], Cb = [], Pt = [], Ap = [], Is = [], Md = [];
    const zebra = (a, d0, skip = 0) => { const sg = a.sg, ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, c = [n.x + ux * d0, n.z + uz * d0];
      for (let t = -sg.w / 2 + 0.6; t <= sg.w / 2 - 0.4; t += 1.1) { if (Math.abs(t) < skip) continue; const p = [c[0] + vx * t, c[1] + vz * t]; Pt.push(ribbon([[p[0] - ux * 1.6, p[1] - uz * 1.6], [p[0] + ux * 1.6, p[1] + uz * 1.6]], 0.55, 0.13)); } };
    if (n.kind === 'T' || n.kind === 'X' || n.kind === 'X5') {
      if (T.outline) { const ps = T.outline.filter((p, k) => k === 0 || Math.hypot(p[0] - T.outline[k - 1][0], p[1] - T.outline[k - 1][1]) > 0.01), tri = THREE.ShapeUtils.triangulateShape(ps.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], idx = [];
        ps.forEach(p => pos.push(p[0], 0.075, p[1])); for (const [a, b, c] of tri) { const o = (ps[b][0] - ps[a][0]) * (ps[c][1] - ps[a][1]) - (ps[b][1] - ps[a][1]) * (ps[c][0] - ps[a][0]); if (o < 0) idx.push(a, b, c); else idx.push(a, c, b); } As.push({ pos, idx }); }
      for (const c of T.corners) { const A = n.arms[c.a], B = n.arms[c.b], curve = c.curve, ww = Math.min(A.sg.walk, B.sg.walk), mid = curve[curve.length >> 1], tst = offLine(curve, 1)[curve.length >> 1], sgn = Math.hypot(tst[0] - n.x, tst[1] - n.z) > Math.hypot(mid[0] - n.x, mid[1] - n.z) ? 1 : -1;
        W.push(ribbon(offLine(curve, sgn * ww / 2), ww, 0.045)); Cb.push(ribbon(offLine(curve, sgn * 0.15), 0.3, 0.09)); }
      n.arms.forEach((a, i) => { const t = T.arms[i], sg = a.sg, ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, nIn = a.end ? sg.lanes[0] : sg.lanes[1], sgn = net.drive === 'L' ? -1 : 1;
        zebra(a, t.zebra, sg.median ? sg.median / 2 + 0.2 : 0);
        // стоп линията — само на входящите ленти (вдясно от оста, гледано към възела)
        const w0 = sg.median / 2, w1 = sg.median / 2 + nIn * sg.laneW, c = [n.x + ux * t.stop, n.z + uz * t.stop]; if (nIn) Pt.push(ribbon([[c[0] + uz * w0 * sgn, c[1] - ux * w0 * sgn], [c[0] + uz * w1 * sgn, c[1] - ux * w1 * sgn]], 0.45, 0.13));
        // разделителната ивица свършва с нос пред стоп линията (отвор за завиващите)
        if (sg.median) { const s0 = t.stop + 3, A2 = [n.x + ux * s0, n.z + uz * s0], B2 = [n.x + ux * (s0 + 3), n.z + uz * (s0 + 3)], hw = sg.median / 2; Md.push(quad([A2[0] + vx * 0.2, A2[1] + vz * 0.2], [A2[0] - vx * 0.2, A2[1] - vz * 0.2], [B2[0] - vx * hw, B2[1] - vz * hw], [B2[0] + vx * hw, B2[1] + vz * hw], 0.1)); }
        const px = c[0] + uz * (sg.w / 2 + 0.8) * sgn + ux * 0.6, pz = c[1] - ux * (sg.w / 2 + 0.8) * sgn + uz * 0.6, rot = Math.atan2(-ux, -uz);
        if (n.ctrl === 'signal' && nIn) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 6), iron); pole.position.set(px, 1.8, pz); g.add(pole); const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.32), iron); box.position.set(px, 3.55, pz); box.rotation.y = rot; g.add(box);
          const L3 = ['r', 'y', 'g'].map((k, j) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), lampOn.off); m.position.set(px - ux * 0.17, 3.9 - j * 0.35, pz - uz * 0.17); g.add(m); return m; }); (heads.get(n.id) || heads.set(n.id, []).get(n.id)).push({ arm: i, L3 }); }
        else if (n.ctrl === 'yield' && nIn) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), iron); pole.position.set(px, 1.2, pz); g.add(pole);
          const sh = a.prio ? new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.05), signMat.prio) : new THREE.Mesh(new THREE.CircleGeometry(0.45, 3), signMat.red); sh.position.set(px, 2.55, pz); sh.rotation.y = rot; if (a.prio) sh.rotation.z = Math.PI / 4; else sh.rotation.z = -Math.PI / 2; g.add(sh); }   // предимство (жълт ромб) / „пропусни“ (триъгълник)
      });
    } else if (n.kind === 'bend') {   // дъга с постоянна ширина
      const [a, b] = n.arms, sg = a.sg, arc = T.bend.arc;   /* същата дъга като лентите */
      As.push(ribbon(arc, sg.w, 0.07)); for (const s2 of [1, -1]) { W.push(ribbon(offLine(arc, s2 * (sg.w / 2 + sg.walk / 2)), sg.walk, 0.04)); Cb.push(ribbon(offLine(arc, s2 * (sg.w / 2 + 0.15)), 0.3, 0.09)); }
      if (sg.median) { Md.push(ribbon(arc, sg.median, 0.1)); for (const s2 of [1, -1]) Pt.push(ribbon(offLine(arc, s2 * (sg.median / 2 + 0.3)), 0.15, 0.12)); } else if (sg.rank < 2) dashed(arc, 3, 4, 0.16, 0.12, Pt);
      if (sg.rank >= 2) for (const s2 of [1, -1]) Pt.push(ribbon(offLine(arc, s2 * (sg.w / 2 - 0.4)), 0.15, 0.12));
    } else if (n.kind === 'end') {
      const a = n.arms[0], sg = a.sg, e = T.end, ang = a.angle;   // ang — навътре по улицата
      if (e.kind === 'bulb') { const r = e.r, w = sg.walk, aW = Math.asin(Math.min(0.99, (sg.w / 2 + w / 2) / (r + w / 2))), aC = Math.asin(Math.min(0.99, (sg.w / 2) / (r + 0.15)));
        As.push(disc(n.x, n.z, r, 0.075)); W.push(ribbon(arcPts(n.x, n.z, r + w / 2, ang + aW, ang + Math.PI * 2 - aW), w, 0.044)); Cb.push(ribbon(arcPts(n.x, n.z, r + 0.15, ang + aC, ang + Math.PI * 2 - aC), 0.3, 0.09)); }
      else { const bg = new THREE.Group(), Lb = Math.max(3, sg.w - 0.6), beam = new THREE.Mesh(new THREE.BoxGeometry(Lb, 0.28, 0.14), BAR.beam); beam.position.y = 0.95; bg.add(beam); for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), BAR.post); p.position.set(sx * (Lb / 2 - 0.15), 0.55, 0); bg.add(p); }
        bg.position.set(n.x + Math.cos(ang) * 1, 0, n.z + Math.sin(ang) * 1); bg.rotation.y = -(ang + Math.PI / 2); g.add(bg); }
    } else if (n.kind === 'round') {
      const R = T.round, rin = R.outer - R.lane, ri = rin - R.apron, sgn = net.drive === 'L' ? -1 : 1, TAU = Math.PI * 2;
      const gaps = n.arms.map((a, i) => [a.angle, Math.asin(Math.min(0.95, (T.arms[i].flare.h0 + 0.3) / R.outer))]);
      const arcs = (rr, pad = 0) => { const A = gaps.map(([c, h]) => [c - h - pad, c + h + pad]).sort((p, q) => p[0] - q[0]), out = []; for (let k = 0; k < A.length; k++) { const a0 = A[k][1], a1 = A[(k + 1) % A.length][0] + (k + 1 === A.length ? TAU : 0); if (a1 - a0 > 0.05) out.push(arcPts(n.x, n.z, rr, a0, a1, Math.max(6, Math.ceil((a1 - a0) * rr / 2)))); } return out; };
      for (const c of arcs(R.outer + 1.25)) W.push(ribbon(c, 2.5, 0.045)); As.push(disc(n.x, n.z, R.outer, 0.075, rin - 0.1));
      for (const c of arcs(R.outer + 0.15)) Cb.push(ribbon(c, 0.3, 0.09)); for (const c of arcs(R.outer - 0.45, 0.04)) Pt.push(ribbon(c, 0.15, 0.12));
      Ap.push(disc(n.x, n.z, rin, 0.1, ri)); Cb.push(ribbon(circle(n.x, n.z, rin + 0.05), 0.22, 0.11));
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, 0.34, 64, 1, true), MAT.curb); wall.position.set(n.x, 0.17, n.z); g.add(wall); Is.push(disc(n.x, n.z, ri, 0.34)); Cb.push(ribbon(circle(n.x, n.z, ri - 0.2), 0.4, 0.345));
      const pl = opts.plants || [], nb = Math.max(8, Math.round(ri * 0.9)); for (let k = 0; k < nb; k++) { const a = k / nb * TAU, rr = ri - 1.6 - (k % 2) * 1.4; if (pl.length) { const o = pl[k % pl.length].clone(); o.scale.multiplyScalar(1.1 + (k % 3) * 0.25); o.position.set(n.x + Math.cos(a) * rr, 0.34, n.z + Math.sin(a) * rr); o.rotation.y = a * 3; g.add(o); } }
      if (opts.fountain) { const f = opts.fountain.clone(), b = new THREE.Box3().setFromObject(f), sz = b.getSize(new THREE.Vector3()), k = Math.min(ri * 0.55, 8) / Math.max(sz.x, sz.z); f.scale.multiplyScalar(k); f.position.set(n.x, 0.34 - b.min.y * k, n.z); g.add(f); }
      n.arms.forEach((a, i) => { const f = T.arms[i].flare, ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, P = (d, t) => [n.x + ux * d + vx * t, n.z + uz * d + vz * t];
        const edge = sg2 => Array.from({ length: 9 }, (_, k) => { const t = k / 8, e = t * t * (3 - 2 * t); return P(f.r0 + (f.r1 - f.r0) * t, sg2 * (f.h0 + (f.h1 - f.h0) * e)); });   /* плавно (S-крива) */
        const eL = edge(1), eR = edge(-1), poly = [...eL, ...eR.reverse()];
        { const tri = THREE.ShapeUtils.triangulateShape(poly.map(p => new THREE.Vector2(p[0], p[1])), []), pos = [], idx = []; poly.forEach(p => pos.push(p[0], 0.072, p[1])); for (const [x, y, z] of tri) idx.push(x, z, y); As.push({ pos, idx }); }
        for (const sg2 of [1, -1]) { const e = edge(sg2), w = a.sg.walk, o1 = e.map((p, k) => { const q = P(f.r0 + (f.r1 - f.r0) * k / 8, sg2 * ((f.h0 + (f.h1 - f.h0) * ((k / 8) ** 2 * (3 - 2 * k / 8))) + w / 2)); return q; }), o2 = e.map((p, k) => P(f.r0 + (f.r1 - f.r0) * k / 8, sg2 * ((f.h0 + (f.h1 - f.h0) * ((k / 8) ** 2 * (3 - 2 * k / 8))) + 0.15))); W.push(ribbon(o1, w, 0.045)); Cb.push(ribbon(o2, 0.3, 0.09)); }
      });
      for (const a of n.arms) { const sg = a.sg, ux = Math.cos(a.angle), uz = Math.sin(a.angle), vx = -uz, vz = ux, atp = (d, t) => [n.x + ux * d + vx * t, n.z + uz * d + vz * t];
        const o0 = R.outer + 0.6, o1 = R.outer + R.splitter, sw0 = sg.median ? sg.median / 2 + 0.7 : 1.4, sw1 = sg.median ? sg.median / 2 : 0.3;   // разделителното островче: стеснява се плавно до ширината на ивицата (без внезапно стесняване)
        const isl = [atp(o0, -sw0), atp(o0, sw0), atp(o1, sw1), atp(o1, -sw1)], sh = new THREE.Shape(isl.map(p => new THREE.Vector2(p[0], -p[1]))), ig = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.12, bevelSegments: 1 }); ig.rotateX(-Math.PI / 2); g.add(new THREE.Mesh(ig, [MAT.walk, MAT.curb]));
        const e0 = sgn * (sw0 + 0.25), e1 = sgn * (sg.w / 2 - 0.25); dashed([atp(o0 + 0.2, e0), atp(o0 + 0.2, e1)], 0.6, 0.4, 0.35, 0.13, Pt);
        for (let t = Math.min(e0, e1) + 0.5; t < Math.max(e0, e1) - 0.4; t += 1.0) { const c = atp(o0 + 1.3, t); Pt.push({ pos: [c[0] - vx * 0.35 - ux * 0.5, 0.13, c[1] - vz * 0.35 - uz * 0.5, c[0] + vx * 0.35 - ux * 0.5, 0.13, c[1] + vz * 0.35 - uz * 0.5, c[0] + ux * 0.5, 0.13, c[1] + uz * 0.5], idx: [0, 2, 1] }); }
        const zd = R.outer + 7.5; zebra(a, zd, sw0 + (sw1 - sw0) * (zd - o0) / (o1 - o0) + 0.35);
        for (let k = 0; k < 2; k++) { const a2 = a.angle + (k ? 0.6 : -0.6), lp = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 4.6, 6), iron); lp.position.set(n.x + Math.cos(a2) * (R.outer + 1.6), 2.3, n.z + Math.sin(a2) * (R.outer + 1.6)); g.add(lp); }
      }
    }
    add(g, As, MAT.asph); add(g, W, MAT.walk); add(g, Cb, MAT.curb); add(g, Pt, MAT.paint); add(g, Ap, MAT.apron); add(g, Is, MAT.island); add(g, Md, MAT.median);
    g.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return g;
  }
  const disposeG = g => { G.remove(g); g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };
  function update(ch) {
    for (const id of ch.segs || []) { const old = segG.get(id); if (old) disposeG(old); const sg = net.segs.get(id); if (sg) { const g = buildSeg(sg); segG.set(id, g); G.add(g); } else segG.delete(id); }
    for (const id of ch.nodes || []) { const old = nodeG.get(id); if (old) disposeG(old); heads.delete(id); const n = net.nodes.get(id); if (n && n.tpl_) { const g = buildNode(n); nodeG.set(id, g); G.add(g); } else nodeG.delete(id); }
  }
  // светофарите: signals — [{ node, arms: { [arm]: { go, left } } }] (traffic.js → signals())
  function lights(sigs) { for (const s of sigs || []) for (const h of heads.get(s.node) || []) { const a = s.arms && s.arms[h.arm], st = a ? (a.go === 'green' || (a.left && a.left === 'green') ? 'g' : a.go === 'yellow' || a.left === 'yellow' ? 'y' : 'r') : 'r'; h.L3[0].material = st === 'r' ? lampOn.r : lampOn.off; h.L3[1].material = st === 'y' ? lampOn.y : lampOn.off; h.L3[2].material = st === 'g' ? lampOn.g : lampOn.off; } }
  update({ segs: [...net.segs.keys()], nodes: [...net.nodes.keys()] });
  return { group: G, update, lights, dispose() { for (const g of [...segG.values(), ...nodeG.values()]) disposeG(g); } };
}
