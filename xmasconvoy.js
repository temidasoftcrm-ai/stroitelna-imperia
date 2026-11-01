// xmasconvoy.js — 🎄 скрита изненада „Коледният керван“ (feature 'xmas-convoy'; потребителят, 01.11: „на 25 декември, когато е Коледа,
// да пуснем коледните камиони по улиците — пак като изненада, само веднъж“). НАШ керван: червените камиони с „Весела Коледа!“,
// елха и снежинки (логата на модела от Meshy са покрити в Blender). На 25 декември (датата на компютъра), привечер/нощем (16–23 ч),
// веднъж в годината: 5 камиона един след друг минават по улиците на града (маршрут по пътищата), със светещи гирлянди по ремаркето
// (мигат на смени топло-бяло/червено/зелено), фарове и звънчета; накрая излизат от града и изчезват. Първия път — съобщение и постижение.
// deps: { scene, S(), hour() 0..24, night() 0..1, roadRoute(x0, z0, x1, z1) → [{x, z}], roadPoint() → {x, z}, center() → [x, z], Sound?, toast, pop, save }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const N = 5, LEN = 17, GAP = 9, SPEED = 9;   // камиони; м дължина; м между тях; м/с
let proto = null, loading = null;
const load = () => loading || (loading = new Promise(res => new GLTFLoader().load('assets/heavy/xmas/xmas-truck.glb', g => {
  g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene), s = b.getSize(new THREE.Vector3()), k = LEN / Math.max(s.x, s.z);
  const w = new THREE.Group(), inner = g.scene; inner.scale.setScalar(k); inner.rotation.y = s.x > s.z ? -Math.PI / 2 : 0;   // моделът е по x (кабината към −x) → кабината към +z
  w.add(inner); w.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(w); inner.position.y -= b2.min.y; inner.position.x -= (b2.min.x + b2.max.x) / 2; inner.position.z -= (b2.min.z + b2.max.z) / 2;
  w.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0; } } });
  proto = w; res(w); }, undefined, () => res(null))));

export function createXmasConvoy(deps) {
  let cur = null, chk = 5;
  const today = () => { const d = new Date(); return d.getMonth() === 11 && d.getDate() === 25; };
  const lights = (g, i) => {   // гирлянди: светещи точки по горния и долния ръб на ремаркето (InstancedMesh, 3 цвята на смени)
    const geo = new THREE.SphereGeometry(0.16, 6, 4), cols = [0xfff2c8, 0xff3030, 0x30ff60], out = [];
    cols.forEach((c, ci) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
      const pts = []; for (const side of [-1, 1]) for (const y of [1.25, 4.15]) for (let z = -LEN / 2 + 0.6; z < LEN * 0.22; z += 0.9) pts.push([side * 1.32, y, z]);
      const mine = pts.filter((_, k) => k % 3 === ci), im = new THREE.InstancedMesh(geo, m, mine.length), dm = new THREE.Object3D();
      mine.forEach((p, k) => { dm.position.set(...p); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); }); im.frustumCulled = false; g.add(im); out.push(im); });
    return out;
  };
  function start(force = false) {
    if (cur || !proto) return false; const c = deps.center ? deps.center() : [0, 0], p0 = deps.roadPoint && deps.roadPoint(), p1 = deps.roadPoint && deps.roadPoint();
    if (!p0 || !p1) return false;
    const a = deps.roadRoute(p0.x, p0.z, c[0], c[1]) || [], b = deps.roadRoute(c[0], c[1], p1.x, p1.z) || [], route = [...a, ...b.slice(1)];
    if (route.length < 3) return false;
    const L = [0]; for (let i = 1; i < route.length; i++) L.push(L[i - 1] + Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
    const trucks = []; for (let i = 0; i < N; i++) { const g = proto.clone(true); g.traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); const lt = lights(g, i); deps.scene.add(g); trucks.push({ g, lt, s: -i * (LEN + GAP) }); }
    cur = { route, L, trucks, t: 0 };
    const S = deps.S(); if (S && !S.xmas) { S.xmas = { year: new Date().getFullYear(), city: S.cityId }; deps.pop && deps.pop('xmas-convoy', '🎄 Коледният керван пристигна!', 'Пет светещи камиона обикалят града. Весела Коледа! Постижение: „Коледен керван“.'); deps.save && deps.save(); }
    else deps.toast && deps.toast('🎄 Коледният керван минава през града!', 'good');
    if (deps.Sound && deps.Sound.jingle) try { deps.Sound.jingle(); } catch (e) { }
    return true;
  }
  const at = (s, out) => { const { route, L } = cur; s = Math.max(0, Math.min(L[L.length - 1] - 0.01, s)); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const a = route[i - 1], b = route[i], f = (s - L[i - 1]) / ((L[i] - L[i - 1]) || 1);
    out.x = a.x + (b.x - a.x) * f; out.z = a.z + (b.z - a.z) * f; out.yaw = Math.atan2(b.x - a.x, b.z - a.z); return out; };
  const P = {};
  function update(dt) {
    if (!cur) {
      if (dt <= 0) return; chk -= dt; if (chk > 0) return; chk = 20;
      const S = deps.S(); if (!S || !today()) return; const h = deps.hour(); if (h < 16 || h >= 23) return;
      if (S.xmas && S.xmas.year === new Date().getFullYear()) return;   // веднъж в годината
      load().then(() => start()); return;
    }
    const c = cur, n = deps.night ? deps.night() : 1, tt = performance.now() / 1000, tot = c.L[c.L.length - 1]; c.t += dt;
    let alive = 0;
    for (const T of c.trucks) { T.s += SPEED * dt; const vis = T.s > 0 && T.s < tot; T.g.visible = vis; if (!vis) { if (T.s < tot) alive++; continue; } alive++;
      at(T.s, P); T.g.position.set(P.x, 0.05, P.z); T.g.rotation.y = P.yaw;
      T.lt.forEach((im, k) => { im.material.opacity = (0.35 + 0.65 * n) * ((Math.floor(tt * 2.5) + k) % 3 === 0 ? 1 : 0.35); });
      T.g.traverse(o => { if (o.isMesh && o.material && o.material.emissiveMap) o.material.emissiveIntensity = 0.35 * n; }); }
    if (!alive) stop();
  }
  function stop() { if (!cur) return; for (const T of cur.trucks) deps.scene.remove(T.g); cur = null; }
  return { update, stop, test: () => load().then(() => { stop(); return start(true); }), get busy() { return !!cur; } };
}
