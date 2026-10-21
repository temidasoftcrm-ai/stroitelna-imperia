// junctionpaths.js — маршрути по лентите през кръстовищата и кръговите (Лабораторията → junction-paths).
// Мрежата е тази на трафика (traffic.js → planNetwork / buildLanes): ленти по улиците, отделна крива за всяка позволена маневра
// (допирателна към двете ленти: надясно — къса, наляво — по-широка дъга, направо — в лентата), кръговото — вход → пръстен
// (обратно на часовника при дясно движение) → изход. Нищо не минава през центъра на кръстовището или през острова.
// Маршрутът се избира веднъж, преди тръгване (лента → маневра → лента … до целта), и не се преизчислява в движение;
// после е агент в симулацията на трафика (createTraffic().addAgent) — дистанция, предимство, пролука в пръстена, зона до излизане на задницата.
// makeRouter(built) → { route(from, to, { heavy }) → { paths, s0, s1, len } | null, nearest(x, z) }
// debugLayer(traffic, group) → { update(), dispose() } — цветни линии на маршрута, целта, входящата/изходящата лента, рамка на габарита и защо чака
import * as THREE from 'three';

const W_HEAVY = 6;   // камионите — само по улици с платно поне толкова (като traffic.js)

export function makeRouter(built) {
  const { lanes, nodes } = built, next = new Map();
  for (const L of lanes) { const n = nodes.get(L.to); next.set(L, n ? n.conns.filter(c => c.inL === L) : []); }
  for (const n of nodes.values()) for (const c of n.conns) next.set(c, [c.outL]);
  const wide = p => (p.edge?.w ?? 99) >= W_HEAVY;
  // най-близката лента (не връзка) до точката: проекция върху отсечките на полилинията → { p, s, d }
  function nearest(x, z, ok = () => true) {
    let best = null;
    for (const L of lanes) {
      if (L.len < 4 || !ok(L)) continue;
      for (let k = 1; k < L.pts.length; k++) {
        const a = L.pts[k - 1], b = L.pts[k], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
        const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); if (!best || d < best.d) best = { p: L, s: L.cum[k - 1] + (L.cum[k] - L.cum[k - 1]) * t, d };
      }
    }
    return best;
  }
  // from: { x, z } или { p, s } (оттам, където агентът е сега); to: { x, z }. Дейкстра по пътеките (лента → връзка → лента)
  function route(from, to, o = {}) {
    const okL = o.heavy ? wide : () => true, A = from.p ? from : nearest(from.x, from.z, L => okL(L) && !L.leave && L.ring == null), B = to.p ? to : nearest(to.x, to.z, L => okL(L) && L.ring == null);   // целта — лента извън пръстена (или зададена направо)
    if (!A || !B) return null;
    const s0 = Math.min(A.s, A.p.len), s1 = Math.max(0.5, Math.min(B.s, B.p.len - 0.5));
    if (A.p === B.p && s1 >= s0) return { paths: [A.p], s0, s1, len: s1 - s0 };
    // купчина с [разстояние, пътека, цел?]: целта е отделен запис (до s1 на последната лента), за да може и „назад по същата лента“ (обиколка)
    const dist = new Map([[A.p, A.p.len - s0]]), prev = new Map(), heap = [[A.p.len - s0, A.p, false]];
    const push = e => { heap.push(e); let k = heap.length - 1; while (k) { const q = (k - 1) >> 1; if (heap[q][0] <= heap[k][0]) break; [heap[q], heap[k]] = [heap[k], heap[q]]; k = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    let goalPrev = null;
    while (heap.length) {
      const [d, p, goal] = pop();   // d — разстоянието до края на пътеката p (за целта — до s1)
      if (goal) { goalPrev = p; break; }
      if (d > dist.get(p) + 1e-9) continue;
      for (const q of next.get(p) || []) {
        if (q.kind === 'lane' && !okL(q)) continue; if (q.kind === 'conn' && !okL(q.outL)) continue;
        if (q === B.p) push([d + s1, p, true]);
        const dq = d + q.len; if (dist.has(q) && dist.get(q) <= dq) continue;
        dist.set(q, dq); prev.set(q, p); push([dq, q, false]);
      }
    }
    if (!goalPrev) return o.heavy ? route(from, to, { ...o, heavy: false }) : null;   // камионът няма широк път — по обикновения
    const paths = [B.p]; for (let p = goalPrev; p; p = p === A.p ? null : prev.get(p)) paths.push(p);
    paths.reverse(); if (paths[0] !== A.p) return null;
    return { paths, s0, s1, len: paths.reduce((t, p) => t + p.len, 0) - s0 - (B.p.len - s1) };
  }
  return { route, nearest };
}

// ---- дебъг: window.__jpDebug = true (или debugLayer(...) от конзолата/Лабораторията)
const COL = { route: 0x22dd66, inL: 0x3399ff, outL: 0xff44cc, box: 0xffee33, goal: 0xff3322 };
export function debugLayer(tr, group) {
  const g = new THREE.Group(); g.renderOrder = 9; group.add(g);
  const mat = c => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });
  const M = Object.fromEntries(Object.entries(COL).map(([k, c]) => [k, mat(c)]));
  const tags = new Map();
  const tag = c => { let t = tags.get(c); if (!t) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const tex = new THREE.CanvasTexture(cv); t = { cv, tex, spr: new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })), txt: '' }; t.spr.scale.set(8, 1.5, 1); g.add(t.spr); tags.set(c, t); } return t; };
  const line = (pts, y, k) => { const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], y, p[1]))); const l = new THREE.Line(geo, M[k]); l.renderOrder = 9; g.add(l); };
  let last = 0;
  return {
    update() {
      const now = performance.now(); if (now - last < 200) return; last = now;
      for (const o of [...g.children]) if (o.isLine) { g.remove(o); o.geometry.dispose(); }
      const live = new Set();
      for (const c of tr.cars) {
        if (!c.agent && !window.__jpAll) continue; live.add(c);
        const y = (c.y || 0) + 0.4;
        if (c.route) { for (let k = c.ri; k < c.route.length; k++) line(c.route[k].pts, y, 'route'); const gp = c.route[c.route.length - 1], o = {}; const q = gp.pts, s = Math.min(c.goal, gp.len); let i = 1; while (i < gp.cum.length - 1 && gp.cum[i] < s) i++; const t = (s - gp.cum[i - 1]) / ((gp.cum[i] - gp.cum[i - 1]) || 1); o.x = q[i - 1][0] + (q[i][0] - q[i - 1][0]) * t; o.z = q[i - 1][1] + (q[i][1] - q[i - 1][1]) * t; line([[o.x - 1, o.z - 1], [o.x + 1, o.z + 1], [o.x, o.z], [o.x - 1, o.z + 1], [o.x + 1, o.z - 1]], y + 0.2, 'goal'); }
        const C = c.next && c.next.kind === 'conn' ? c.next : c.p.kind === 'conn' ? c.p : null;
        if (C) { line(C.inL.pts.slice(-6), y + 0.1, 'inL'); line(C.outL.pts.slice(0, 6), y + 0.1, 'outL'); }
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), hl = (c.trl ? c.cab : c.L) / 2, hw = (c.w || 2) / 2;
        line([[c.x + fx * hl + rx * hw, c.z + fz * hl + rz * hw], [c.x + fx * hl - rx * hw, c.z + fz * hl - rz * hw], [c.x - fx * hl - rx * hw, c.z - fz * hl - rz * hw], [c.x - fx * hl + rx * hw, c.z - fz * hl + rz * hw], [c.x + fx * hl + rx * hw, c.z + fz * hl + rz * hw]], y, 'box');
        if (c.tr) { const r = c.tr, f2 = Math.sin(r.yaw), g2 = Math.cos(r.yaw), r2 = Math.cos(r.yaw), q2 = -Math.sin(r.yaw), h2 = c.trl / 2; line([[r.x + f2 * h2 + r2 * hw, r.z + g2 * h2 + q2 * hw], [r.x + f2 * h2 - r2 * hw, r.z + g2 * h2 - q2 * hw], [r.x - f2 * h2 - r2 * hw, r.z - g2 * h2 - q2 * hw], [r.x - f2 * h2 + r2 * hw, r.z - g2 * h2 + q2 * hw], [r.x + f2 * h2 + r2 * hw, r.z + g2 * h2 + q2 * hw]], y, 'box'); }
        const t = tag(c), txt = `${c.agent?.name || c.kind} ${c.v.toFixed(1)} m/s${c.why ? ' · ' + c.why : ''}`;
        if (txt !== t.txt) { t.txt = txt; const x = t.cv.getContext('2d'); x.clearRect(0, 0, 256, 48); x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(0, 0, 256, 48); x.fillStyle = c.why ? '#ffcc33' : '#7dffa0'; x.font = '700 22px system-ui, sans-serif'; x.fillText(txt, 8, 32); t.tex.needsUpdate = true; }
        t.spr.position.set(c.x, y + 4.5, c.z);
      }
      for (const [c, t] of tags) if (!live.has(c)) { g.remove(t.spr); t.tex.dispose(); t.spr.material.dispose(); tags.delete(c); }
    },
    dispose() { group.remove(g); g.traverse(o => { o.geometry?.dispose(); }); for (const m of Object.values(M)) m.dispose(); for (const t of tags.values()) { t.tex.dispose(); t.spr.material.dispose(); } },
  };
}
