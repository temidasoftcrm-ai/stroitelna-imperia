// beachpeople.js — 🏖️ хора по плажовете (feature 'beach-people'; собственикът, 01.11: „анимирай само някои от тях — да има повечето на плажа да лежат“;
// одобрено в Blender — _source/beach/beach-scene.blend). Модели: Meshy AI (Темидасофт), олекотени 10–15 хил. △, текстури webp 1024 (assets/heavy/beach/).
//   • повечето ЛЕЖАТ по гръб на цветни кърпи (изправените модели, завъртени хоризонтално — слънчеви бани), някои седят или са на колене;
//   • чадъри — сламени (Beach Shelter) и раирани, до кърпите;
//   • няколко се РАЗХОЖДАТ по мократа ивица (Mixamo: разходка + стоене) — напред-назад, на края спират и се обръщат;
//   • плувци — до кръста във водата, леко се поклащат и бавно се обръщат.
// Статичните — инстансирани (по една мрежа на вид); разхождащите се — до 4 (SkeletonUtils). Само денем; отдалеч (камерата > FAR) — нищо.
// deps: { parent, camera, night() 0..1, seed, beach: { coast: x → z | null, seaZ, x0, x1, land: +1 (сушата — към +z), along: тясна ивица — легнали успоредно на водата, sand: [от, до] м от линията към сушата (−: към морето),
//   wet: м — мократа ивица (разходката), swim: [от, до] — плувците }, avoid: [[xa, xb]…] }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const BASE = 'assets/heavy/beach/';
const STATIC = ['beach_lie_w1', 'beach_lie_m1', 'beach_sit', 'beach_kneel', 'beach_swim', 'beach_umbrella', 'beach_umbrella2'];
const WALK = [['beach_walk_m1', 'walking', 'standing_idle'], ['beach_walk_w2', 'female_walk', 'happy_idle']];
const FAR = 700, TOWEL_COLS = [0xd94a4a, 0x2f7fd8, 0xf2c230, 0x3aa86b, 0xe887b5, 0xf4f4f4, 0xff8a3a];
const rnd = s => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

export function createBeachPeople(deps) {
  let M = null, loading = null, built = null;
  const load = () => loading || (loading = Promise.all([...STATIC, ...WALK.map(w => w[0])].map(n => new GLTFLoader().loadAsync(BASE + n + '.glb').then(g => [n, g]).catch(e => { console.warn('beach-people', n, e); return [n, null]; })))
    .then(arr => { M = Object.fromEntries(arr); }));

  // мрежата и материалът на статичен модел + кутията (за полагането)
  function proto(n) {
    const g = M[n]; if (!g) return null; let mesh = null; g.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) return null;
    g.scene.updateMatrixWorld(true); const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); geo.computeBoundingBox();
    const mt = mesh.material; mt.metalness = 0; mt.roughness = 0.75;
    return { geo, mat: mt, bb: geo.boundingBox };
  }
  // точките по плажа: x, водната линия z, посоката към сушата (единичен вектор в xz)
  function shore(x) {
    const b = deps.beach;
    if (b.coast) { const z = b.coast(x), d = 2, z1 = b.coast(x + d); const tx = d, tz = z1 - z, l = Math.hypot(tx, tz); return { x, z, nx: -tz / l * b.land, nz: tx / l * b.land, tx: tx / l, tz: tz / l }; }
    return { x, z: b.seaZ, nx: 0, nz: b.land, tx: 1, tz: 0 };
  }
  function build() {
    const b = deps.beach, r = rnd((deps.seed >>> 0) || 4242), g = new THREE.Group(); g.name = 'beach-people';
    const P = Object.fromEntries(STATIC.map(n => [n, proto(n)]));
    const spots = { towel: [], beach_lie_w1: [], beach_lie_m1: [], beach_sit: [], beach_kneel: [], beach_swim: [], beach_umbrella: [], beach_umbrella2: [] };
    const avoid = x => (deps.avoid || []).some(([a, c]) => x > a - 25 && x < c + 25);
    const Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1), V = new THREE.Vector3(), Mx = new THREE.Matrix4();
    const place = (key, x, z, yaw, lay = false) => {
      const p = key === 'towel' ? null : P[key]; if (key !== 'towel' && !p) return;
      E.set(lay ? -Math.PI / 2 : 0, yaw, 0, 'YXZ'); Q.setFromEuler(E);
      const G = 0.06;   // пясъкът на плана е на ~5 см
      let y = G + 0.02; if (p) { if (lay) y = -p.bb.min.z + G + 0.04; else y = -p.bb.min.y + G; if (key === 'beach_swim') y -= 0.42 + G; }   // плувецът — до кръста във водата
      V.set(x, y, z); Mx.compose(V, Q, S); spots[key].push(Mx.clone());
    };
    const people = ['beach_lie_w1', 'beach_lie_m1', 'beach_lie_w1', 'beach_lie_m1', 'beach_lie_w1', 'beach_sit', 'beach_kneel'];   // ~70 % лежат
    let walkSegs = [];
    for (let x = b.x0; x <= b.x1; x += 9 + r() * 14) {
      if (avoid(x)) continue;
      const s = shore(x), [s0, s1] = b.sand || [3, 13], depth = s0 + r() * (s1 - s0), cx = s.x + s.nx * depth, cz = s.z + s.nz * depth, yaw = b.along ? Math.atan2(s.tx, s.tz) * 1 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.15 : Math.atan2(s.nx, s.nz) + (r() - 0.5) * 0.6;   // главата — към сушата (тясна ивица — успоредно на водата)
      if (r() < 0.82) {
        const k = people[Math.floor(r() * people.length)], lay = k.startsWith('beach_lie');
        place('towel', cx, cz, yaw);
        if (lay) { const hx = -Math.sin(yaw) * 0.85, hz = -Math.cos(yaw) * 0.85; place(k, cx + hx, cz + hz, yaw + Math.PI, true); }   // от главата към краката по кърпата
        else place(k, cx, cz, yaw + Math.PI);
        if (r() < 0.7) { const ux = b.along ? s.tx * 1.6 : s.tx * 1.2 + s.nx * 0.6, uz = b.along ? s.tz * 1.6 : s.tz * 1.2 + s.nz * 0.6; place(r() < 0.5 ? 'beach_umbrella' : 'beach_umbrella2', cx + ux, cz + uz, r() * 6.28); }
      } else place(r() < 0.5 ? 'beach_umbrella' : 'beach_umbrella2', cx, cz, r() * 6.28);
      if (r() < 0.12) { const w = shore(x + (r() - 0.5) * 6); const sd = (b.swim || [-5, -15])[0] + r() * ((b.swim || [-5, -15])[1] - (b.swim || [-5, -15])[0]); place('beach_swim', w.x + w.nx * sd, w.z + w.nz * sd, r() * 6.28); }
    }
    // кърпите — една равнина, цвят по инстанция
    const tGeo = new THREE.PlaneGeometry(0.95, 1.95).rotateX(-Math.PI / 2), tMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), col = new THREE.Color();
    for (const [key, list] of Object.entries(spots)) {
      if (!list.length) continue;
      const geo = key === 'towel' ? tGeo : P[key].geo, mat = key === 'towel' ? tMat : P[key].mat;
      const im = new THREE.InstancedMesh(geo, mat, list.length); im.name = 'beach-' + key; im.castShadow = key !== 'towel'; im.receiveShadow = true;
      list.forEach((m, i) => { im.setMatrixAt(i, m); if (key === 'towel') im.setColorAt(i, col.setHex(TOWEL_COLS[(i * 7 + 3) % TOWEL_COLS.length])); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); g.add(im);
      if (key === 'beach_swim') g.userData.swim = { im, base: list.map(m => m.clone()) };
    }
    // разхождащите се: до 4, по мократа ивица (1,5 м от водата), отсечки по 40–80 м
    const walkers = [];
    for (let i = 0; i < 4; i++) {
      const W = WALK[i % 2], src = M[W[0]]; if (!src) continue;
      let xa = b.x0 + 60 + r() * Math.max(10, b.x1 - b.x0 - 200), tries = 0; while (avoid(xa) && tries++ < 20) xa = b.x0 + r() * (b.x1 - b.x0);
      if (avoid(xa)) continue;
      const o = cloneSkinned(src.scene); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } }); g.add(o);
      const clips = Object.fromEntries(src.animations.map(c => [c.name, c])), walk = stripRoot(clips[W[1]]), idle = clips[W[2]];
      const mixer = new THREE.AnimationMixer(o), aw = mixer.clipAction(walk.clip), ai = idle ? mixer.clipAction(idle) : null; aw.play();
      walkers.push({ o, mixer, aw, ai, speed: walk.speed, xa, xb: xa + 40 + r() * 40, s: r(), dir: r() < 0.5 ? 1 : -1, pause: 0, inner: 1.4 + r() * 0.8 });
    }
    deps.parent.add(g);
    return { g, walkers, center: shore((b.x0 + b.x1) / 2) };
  }
  // корен без придвижване (Hips): махам линейния дрейф по най-голямата ос; скоростта (м/с) — по мащаба на рига (0,01 — см → м)
  function stripRoot(c) {
    const cl = c.clone(), tr = cl.tracks.find(t => /Hips\.position$/.test(t.name)); if (!tr) return { clip: cl, speed: 1.2 };
    const v = tr.values, n = tr.times.length, d = [0, 1, 2].map(k => v[(n - 1) * 3 + k] - v[k]), ax = d.map(Math.abs).indexOf(Math.max(...d.map(Math.abs))), T = tr.times[n - 1] - tr.times[0];
    for (let i = 0; i < n; i++) v[i * 3 + ax] -= d[ax] * (tr.times[i] - tr.times[0]) / T;
    return { clip: cl, speed: Math.abs(d[ax]) * 0.01 / cl.duration };
  }
  const fade = (a, b, t = 0.35) => { if (!a || !b || a === b) return; b.reset().fadeIn(t).play(); a.fadeOut(t); };
  let t = 0;
  return {
    update(dt) {
      if (!deps.beach) return;
      if (!M) { load(); return; }
      if (!built) { built = build(); }
      const c = built.center, cam = deps.camera, day = (deps.night ? deps.night() : 0) < 0.45;
      const near = Math.hypot(cam.position.x - c.x, cam.position.z - c.z) < FAR + (deps.beach.x1 - deps.beach.x0) / 2;
      built.g.visible = day && near; if (!built.g.visible || dt <= 0) return;
      t += dt;
      const sw = built.g.userData.swim;   // плувците: поклащане и бавно завъртане
      if (sw) { const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), rq = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
        sw.base.forEach((b0, i) => { b0.decompose(p, q, s); p.y += 0.06 * Math.sin(t * 1.3 + i * 1.7); rq.setFromAxisAngle(Y, 0.25 * Math.sin(t * 0.13 + i)); q.premultiply(rq); m.compose(p, q, s); sw.im.setMatrixAt(i, m); }); sw.im.instanceMatrix.needsUpdate = true; }
      for (const w of built.walkers) {
        w.mixer.update(dt);
        if (w.pause > 0) { w.pause -= dt; if (w.pause <= 0) fade(w.ai, w.aw); }
        else { w.s += w.dir * w.speed * dt / (w.xb - w.xa); if (w.s > 1 || w.s < 0) { w.s = Math.min(1, Math.max(0, w.s)); w.dir *= -1; w.pause = 3 + Math.random() * 5; fade(w.aw, w.ai || w.aw); } }
        const x = w.xa + (w.xb - w.xa) * w.s, s = shore(x); const o = (deps.beach.wet ?? 1) + w.inner - 1.4; w.o.position.set(s.x + s.nx * o, 0.06, s.z + s.nz * o);
        w.o.rotation.y = Math.atan2(s.tx * w.dir, s.tz * w.dir);
      }
    },
    state: () => built ? { walkers: built.walkers.length, inst: built.g.children.filter(o => o.isInstancedMesh).map(o => [o.name, o.count]), visible: built.g.visible, center: [Math.round(built.center.x), Math.round(built.center.z)] } : { loaded: !!M },
    look: () => built ? built.center : null,
  };
}
