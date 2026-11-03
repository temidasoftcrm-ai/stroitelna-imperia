// sherlock.js — 🕵️ скрита изненада „Шерлок Холмс в мъглата“ (feature 'sherlock'; потребителят, 03.11: „да направим и Шерлок“, моделът — Meshy на
// потребителя, боядисан в Blender — „нека остане така, супер е“). Лондон, вечер/нощ в мъгла (или облачно), рядко: на тиха улица близо до центъра
// гъста мъгла, газените фенери светят топло; детективът с лулата (и по-ниският му спътник, д-р Уотсън) излизат от мъглата, вървят по улицата,
// от лулата се вдига дим, и изчезват в мъглата (~30 s). Героите на Конан Дойл (1887) — обществено достояние; без чужди филми/сериали.
// Първия път — „🕵️ Видяхте ли това?!“ и постижение (S.sherlock); до сцената — холограмата с историята.
// deps: { group() → city.group, plan() → city.plan, cityId(), S(), hour(), night(), fog() → bool, Sound?, toast, pop, save, focus(x, z)? }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';   // на сайта моделите са сгъстени (EXT_meshopt_compression)

export const SHERLOCK_CITY = 'london';
const DUR = 32, WALK = 1.25;   // s; м/с
let proto = null, loading = null;
const load = () => loading || (loading = new Promise(res => (() => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); return l; })().load('assets/heavy/people/detective.glb', g => {
  const o = g.scene; o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), k = 2.3 / (b.max.y - b.min.y); o.scale.setScalar(k); o.position.y = -b.min.y * k;
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.material.vertexColors = true; m.material.emissive = new THREE.Color(0x2a2018); m.material.emissiveIntensity = 1; } });   /* малко собствена светлина — да се четат в мъглата */ const w = new THREE.Group(); w.add(o); proto = w; res(w);   /* обвивка: позицията на вървящия не трие отместването на модела */ }, undefined, () => res(null))));

export function createSherlock(deps) {
  let cur = null, cool = 40 + Math.random() * 60;
  // улица: средно дълга „street“ на 150–600 м от площада, възможно най-права
  function street() {
    const P = deps.plan(), Q = P && (P.p2 || P), tg = (P && P.toGame) || ((x, z) => [x, z]); if (!Q || !Q.roads) return null;
    const sq = P.square || { x: 0, z: 0 }; let best = null;
    for (const r of Q.roads) { if (r.cls !== 'street' || !r.pts || r.pts.length < 2) continue; const L = r.L ? r.L[r.L.length - 1] : 0; if (L < 70) continue;
      const a = tg(...r.pts[0]), b = tg(...r.pts[r.pts.length - 1]), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = Math.hypot(mx - sq.x, mz - sq.z);
      if (d < 150 || d > 650) continue; const straight = Math.hypot(b[0] - a[0], b[1] - a[1]) / L, sc = straight * 2 - Math.abs(d - 350) / 400 + Math.random() * 0.3;
      if (!best || sc > best.sc) best = { sc, pts: r.pts.map(p => tg(p[0], p[1])), w: r.w || 8 }; }
    return best;
  }
  let soft = null; const softTex = () => soft || (soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })());
  function lamps(pts, w) {   // газени фенери от двете страни, на ~16 м
    const g = new THREE.Group(), pole = new THREE.CylinderGeometry(0.07, 0.1, 3.6, 6), head = new THREE.BoxGeometry(0.38, 0.5, 0.38), glowG = new THREE.SphereGeometry(0.22, 8, 6);
    const pm = new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.6, metalness: 0.4 }), hm = new THREE.MeshBasicMaterial({ color: 0xffc070 }), halo = new THREE.SpriteMaterial({ map: softTex(), color: 0xffb060, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const at = s => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = pts[i - 1], b = pts[i], l = (L[i] - L[i - 1]) || 1, f = (s - L[i - 1]) / l; return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }; };
    for (let s = 6, k = 0; s < L[L.length - 1] - 4; s += 16, k++) { const p = at(s), side = k % 2 ? 1 : -1, ox = -p.tz * side * (w / 2 + 1.2), oz = p.tx * side * (w / 2 + 1.2);
      const po = new THREE.Mesh(pole, pm); po.position.set(p.x + ox, 1.8, p.z + oz); const hd = new THREE.Mesh(head, hm); hd.position.set(p.x + ox, 3.75, p.z + oz);
      const gl = new THREE.Sprite(halo); gl.scale.set(4.5, 4.5, 1); gl.position.copy(hd.position); const li = new THREE.PointLight(0xffa850, 3, 14, 1.6); li.position.copy(hd.position); g.add(po, hd, gl, li); }
    return { g, at, tot: L[L.length - 1] };
  }
  function fogPuffs(n) {   // ниска мъгла по улицата: меки спрайтове
    const m = new THREE.SpriteMaterial({ map: softTex(), color: 0xb8c4cc, transparent: true, opacity: 0, depthWrite: false }), L = [];
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(m); s.scale.set(14, 7, 1); L.push(s); } return { m, L };
  }
  async function start(force = false) {
    if (cur) return false; await load(); if (!proto) return false; const st = street(); if (!st) return false;
    const G = deps.group(), lp = lamps(st.pts, st.w), F = fogPuffs(46), root = new THREE.Group(); root.add(lp.g);
    F.L.forEach((s, i) => { const p = lp.at(Math.random() * lp.tot); s.position.set(p.x + (Math.random() - 0.5) * st.w * 1.6, 1.2 + Math.random() * 2.5, p.z + (Math.random() - 0.5) * st.w * 1.6); s.userData.v = (Math.random() - 0.5) * 0.4; root.add(s); });
    // височината на улицата (в Лондон платното е над нулата): лъч отгоре в няколко точки
    const rc = new THREE.Raycaster(), hs = [], ms = []; G.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && o.visible) ms.push(o); }); for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) { const p = lp.at(lp.tot * f); rc.set(new THREE.Vector3(p.x, 80, p.z), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObjects(ms, false).find(q => q.object.isMesh && !q.object.isInstancedMesh && q.face && q.face.normal.y > 0.5 && q.point.y < 6); hs.push(h ? h.point.y : 0); }
    hs.sort((a, b) => a - b); const gy = hs[2];
    const hol = proto.clone(true), wat = proto.clone(true); wat.scale.multiplyScalar(0.94); root.add(hol, wat);
    const smoke = []; const sm = new THREE.SpriteMaterial({ map: F.m.map, color: 0xd8d8d8, transparent: true, opacity: 0, depthWrite: false }); for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(sm.clone()); s.scale.set(0.5, 0.5, 1); s.userData.t = i * 0.35; root.add(s); smoke.push(s); }
    root.name = 'sherlock'; G.add(root); cur = { root, lp, F, hol, wat, smoke, t: 0, gy, follow: force && !!deps.setCam };
    const S = deps.S(); if (S && !S.sherlock) { S.sherlock = { day: S.day || 1 }; deps.pop && deps.pop('sherlock', '🕵️ Видяхте ли това?!', 'В лондонската мъгла двама господа с бастун и лула… и изчезнаха. Постижение: „Бейкър стрийт“.'); deps.save && deps.save(); }
    else deps.toast && deps.toast('🕵️ Някой върви в мъглата…', 'good');
    if (deps.focus) { const m = lp.at(lp.tot * 0.5); deps.focus(m.x, m.z); }
    bell(); return { len: Math.round(lp.tot), gy: +gy.toFixed(2) };
  }
  function bell() { const Sd = deps.Sound; if (!Sd || !Sd.ctx || Sd.muted || !Sd.bell) return; try { [0, 1.6, 3.2].forEach((t, i) => Sd.bell(196 * (i === 2 ? 0.75 : 1), 0.4 + t, 0.05)); } catch (e) { } }   // далечен звън на часовникова кула
  const P = {};
  function update(dt, live = true) {
    if (!cur) {
      if (!live || dt <= 0 || deps.cityId() !== SHERLOCK_CITY) return; cool -= dt; if (cool > 0) return; cool = 120 + Math.random() * 180;
      const h = deps.hour(); if ((h >= 18 || h < 5) && deps.fog() && Math.random() < 0.45) start();
      return;
    }
    const c = cur; c.t += dt; const t = c.t, fin = Math.min(1, t / 3) * (1 - Math.max(0, Math.min(1, (t - (DUR - 3)) / 3)));
    c.F.m.opacity = 0.5 * fin; c.F.L.forEach(s => { s.position.x += s.userData.v * dt; });
    // вървят: от 8 % до 92 % от улицата; появяват се/изчезват в мъглата (прозрачност)
    const go = (o, s, side) => { const p = c.lp.at(Math.max(0, Math.min(c.lp.tot, s))); const w = t * 6 + side * 2, sw = Math.sin(w);   // крачката: ~1,9 крачки/s при 1,25 м/с; спътникът — малко разминат
      o.position.set(p.x - p.tz * side, c.gy + 0.03 + Math.abs(Math.cos(w)) * 0.035, p.z + p.tx * side); o.rotation.y = Math.atan2(p.tx, p.tz) + 0.04 * sw; o.rotation.z = 0.025 * sw;
      const L = o.userData.legs || (o.userData.legs = [o.getObjectByName('LegL'), o.getObjectByName('LegR')]); if (L[0]) L[0].rotation.x = 0.38 * sw; if (L[1]) L[1].rotation.x = -0.38 * sw; return p; };   /* краката — от шарнира под палтото */   /* по терена (Лондон не е равен) */
    const s0 = c.lp.tot * 0.08 + WALK * t, vis = Math.min(1, t / 4) * (1 - Math.max(0, Math.min(1, (t - (DUR - 5)) / 4)));
    const ph = go(c.hol, s0, 0.45); go(c.wat, s0 - 0.6, -0.55);
    [c.hol, c.wat].forEach(o => o.traverse(m => { if (m.isMesh) { m.material.transparent = vis < 1; m.material.opacity = vis; } }));
    c.smoke.forEach((s, i) => { const k = ((t + s.userData.t) % 3.5) / 3.5; s.position.set(c.hol.position.x + ph.tx * 0.2 - ph.tz * 0.1, 1.62 + k * 1.2, c.hol.position.z + ph.tz * 0.2 + ph.tx * 0.1); s.scale.setScalar(0.3 + k * 1.1); s.material.opacity = 0.35 * (1 - k) * vis; });
    if (c.follow) { const b = c.lp.at(Math.max(0, s0 - 6)), f = c.lp.at(s0 + 6); deps.setCam(b.x - b.tz * 2, c.gy + 2.9, b.z + b.tx * 2, f.x, c.gy + 1.4, f.z); }   // Лабораторията: камерата върви зад тях
    if (t > DUR) stop();
  }
  function stop() { if (!cur) return; cur.root.removeFromParent(); cur.root.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); }); cur = null; }
  return { update, stop, test: () => start(true), get busy() { return !!cur; }, where: () => cur && { a: cur.lp.at(cur.lp.tot * 0.02), b: cur.lp.at(cur.lp.tot * 0.45) } };
}
