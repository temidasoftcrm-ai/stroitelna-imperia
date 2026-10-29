// giza.js — 🏜️ giza2 (T2, потребителят: „пирамидите — извън Кайро, в пустинята, в истински размер, не колкото едно кръгово“):
// платото в Гиза в истински мащаб (k = 1; по-малко само ако не се побира, най-малко 0,6): Хеопс (основа 230 м, 139 м), Хефрен (215 м, 136 м,
// с белия връх от облицовката), Микерин (103 м, 65 м) по диагонала ЮЗ → СИ, пирамидите на цариците, Сфинксът (73 м) в края на пътя от Хефрен,
// пясъчно плато със скали и дюни, паркинг за посетителите. Нощем — „звук и светлина“: само светещи материали (без истински светлини),
// цветът бавно прелива кехлибарено → бяло → синкаво. Пирамидите не са в мъглата (fog: false) — виждат се отдалеч, както от края на Гиза.
//   buildGiza({ k }) → { group, update(t, night), kind: 'pyramids', half: [hx, hz], park: [x, z] } (в рамката на групата: x — изток, −z — север)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';

const LAYOUT = {   // м, спрямо центъра на платото
  pyr: [[180, -260, 230, 139, 'Хеопс'], [-60, 60, 215, 136, 'Хефрен', 1], [-260, 380, 103, 65, 'Микерин']],
  queens: [[350, -330, 46, 30], [350, -260, 46, 30], [350, -190, 46, 30], [-330, 500, 32, 21], [-270, 500, 32, 21], [-210, 500, 32, 21]],
  sphinx: [230, 200], park: [330, 250],
};
export function buildGiza(o = {}) {
  const k = o.k || 1, g = new THREE.Group(); g.name = 'giza'; g.scale.setScalar(k);
  const M = (c, r = 0.95, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...x });
  const stone = M(0xcfae74, 0.95, { emissive: 0xffb060, emissiveIntensity: 0, fog: false }), cap = M(0xeee2c4, 0.85, { emissive: 0xffe2b0, emissiveIntensity: 0, fog: false }),
    sand = M(0xd9bf8a, 1), rock = M(0xb39a72, 1), asph = M(0x4a4d52, 0.95), white = new THREE.MeshBasicMaterial({ color: 0xeeeeee }), wall = M(0xe4d6b8, 0.9);
  const add = (geo, m, x, y, z) => { const o2 = new THREE.Mesh(geo, m); o2.position.set(x, y, z); o2.castShadow = o2.receiveShadow = true; g.add(o2); return o2; };
  const proc = [], sphProc = [];   // giza-real: процедурните — скриват се, щом моделите на потребителя се заредят
  const pyr = (x, z, b, h, m = stone) => { const p = add(new THREE.ConeGeometry(b * Math.SQRT1_2, h, 4, 1), m, x, h / 2, z); p.rotation.y = Math.PI / 4; proc.push([p, x, z, b, h]); return p; };
  // платото: пясък под всичко, по-светли дюни и скали
  const xs = [...LAYOUT.pyr, ...LAYOUT.queens].flatMap(([x, , b]) => [x - b / 2, x + b / 2]), zs = [...LAYOUT.pyr, ...LAYOUT.queens].flatMap(([, z, b]) => [z - b / 2, z + b / 2]);
  const x0 = Math.min(...xs, LAYOUT.park[0] - 60) - 110, x1 = Math.max(...xs, LAYOUT.park[0] + 60) + 110, z0 = Math.min(...zs) - 110, z1 = Math.max(...zs, LAYOUT.park[1] + 50) + 110;
  if (o.ground) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), sand); pl.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2); pl.receiveShadow = true; g.add(pl); }   // собствен пясък — само ако отдолу няма пустиня (иначе — ивици от застъпването)
  { const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(1907), im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rock, 90), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let n = 0; for (let i = 0; i < 400 && n < 90; i++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0); if ([...LAYOUT.pyr, ...LAYOUT.queens].some(([px, pz, b]) => Math.abs(x - px) < b / 2 + 15 && Math.abs(z - pz) < b / 2 + 15)) continue;
      const s = 1.5 + rnd() * 5; im.setMatrixAt(n++, m4.compose(new THREE.Vector3(x, s * 0.3, z), q.setFromEuler(e.set(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(s, s * 0.6, s * 0.8))); }
    im.count = n; im.castShadow = im.receiveShadow = true; g.add(im);
    for (let i = 0; i < 8; i++) { const d = add(new THREE.SphereGeometry(30 + rnd() * 40, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd6bc86, 1), x0 + rnd() * (x1 - x0), -0.5, z0 + rnd() * (z1 - z0)); d.scale.y = 0.03 + rnd() * 0.03; d.castShadow = false; } }   // ниски, почти в цвета на пясъка
  // пирамидите
  for (const [x, z, b, h, , top] of LAYOUT.pyr) { pyr(x, z, b, h); if (top) { const c = add(new THREE.ConeGeometry(b * 0.16 * Math.SQRT1_2, h * 0.16 + 0.5, 4, 1), cap, x, h * 0.92 - 0.2, z); c.rotation.y = Math.PI / 4; } }
  for (const [x, z, b, h] of LAYOUT.queens) pyr(x, z, b, h);
  for (const [x, z, b] of LAYOUT.pyr) add(new THREE.BoxGeometry(b * 0.22, 6, b * 0.18), wall, x + b / 2 + b * 0.14, 3, z);   // заупокойните храмове откъм изток
  // пътят от Хефрен до Сфинкса (каменна насипна ивица) и Сфинксът — 73 м, гледа на изток
  { const [ax, az] = [LAYOUT.pyr[1][0] + LAYOUT.pyr[1][2] / 2 + 30, LAYOUT.pyr[1][1]], [bx, bz] = [LAYOUT.sphinx[0] - 50, LAYOUT.sphinx[1]], L = Math.hypot(bx - ax, bz - az);
    const cw = add(new THREE.BoxGeometry(L, 1.2, 8), wall, (ax + bx) / 2, 0.6, (az + bz) / 2); cw.rotation.y = -Math.atan2(bz - az, bx - ax); }
  { const s = new THREE.Group(), [sx, sz] = LAYOUT.sphinx; s.position.set(sx, 0, sz); g.add(s);
    const B = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; s.add(b); return b; };
    sphProc.push(B(46, 14, 18, -8, 7, 0), B(22, 5, 4, 26, 2.5, -5.5), B(22, 5, 4, 26, 2.5, 5.5));   // тялото и предните лапи
    sphProc.push(B(10, 12, 9, 13, 16, 0), B(3, 9, 12, 13, 15, 0), B(5, 4, 4, 19, 17, 0));           // главата, немесът, лицето
    sphProc.grp = s;
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(90, 50).rotateX(-Math.PI / 2), M(0xc4a46c, 1)); pit.position.set(0, 0.05, 0); pit.receiveShadow = true; s.add(pit); }   // изкопът около него
  // паркингът и павилионът за посетителите
  { const [px, pz] = LAYOUT.park; const pk = new THREE.Mesh(new THREE.PlaneGeometry(90, 50).rotateX(-Math.PI / 2), asph); pk.position.set(px, 0.06, pz); pk.receiveShadow = true; g.add(pk);
    for (let x = px - 40; x <= px + 40; x += 5) for (const dz of [-12, 12]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 8).rotateX(-Math.PI / 2), white); l.position.set(x, 0.08, pz + dz); g.add(l); }
    add(new THREE.BoxGeometry(34, 7, 14), wall, px, 3.5, pz + 35); }
  // 🏜️ giza-real (29.10): пирамидите и Сфинксът — моделите на потребителя (Meshy, ТЕМИДАСОФТ ООД; assets/heavy/lm/pyramid-giza.glb — основа 1×1, височина 1,
  // и sphinx.glb — дължина 1, лицето към +x). Един модел за всичките 6 пирамиди, мащабиран до основата и височината на всяка (същото място и размер);
  // Сфинксът — 56 м (моделът е по-висок от истинския — при 68 м щеше да е 40 м висок), на същото място, гледа на изток. Белият връх на Хефрен остава. Нощем светят със „звука и светлината“
  // (emissive = текстурата, цветът — от stone.emissive). Без флага или при грешка — процедурните.
  const real = [];
  if (feature('giza-real')) { const L = new GLTFLoader();
    Promise.all([L.loadAsync('assets/heavy/lm/pyramid-giza.glb'), L.loadAsync('assets/heavy/lm/sphinx.glb')]).then(([P, X]) => {
      const lit = sc => { const ms = []; sc.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const mt = m.material = m.material.clone(); mt.metalness = 0; mt.roughness = 0.95; mt.metalnessMap = null; mt.emissive = new THREE.Color(0xffb060); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.fog = false; mt.needsUpdate = true; ms.push(mt); }); return ms; };
      const pm = lit(P.scene); real.push(...pm);
      for (const [p, x, z, b, h] of proc) { const o2 = P.scene.clone(true); o2.position.set(x, 0, z); o2.scale.set(b, h, b); g.add(o2); p.visible = false; }
      const sm = lit(X.scene); real.push(...sm); const sx = X.scene; sx.scale.setScalar(56); sx.position.set(3, 0, 0); sphProc.grp.add(sx); for (const b2 of sphProc) b2.visible = false;
      g.traverse(o => { if (o.isMesh && o.material === cap) { o.scale.multiplyScalar(1.35); o.position.y += 1.5; } });   // белият връх на Хефрен — малко над повърхността на модела (иначе потъва в него)
    }).catch(e => console.warn('giza-real', e)); }
  // нощем: „звук и светлина“ — кехлибарено → бяло → синкаво, бавно
  const C = [new THREE.Color(0xffb060), new THREE.Color(0xfff0d0), new THREE.Color(0x8fa8ff), new THREE.Color(0xffb060)], tmp = new THREE.Color();
  const update = (t, night = 0) => { const u = (t / 24) % 3, i = Math.floor(u), f = u - i; tmp.copy(C[i]).lerp(C[i + 1], f);
    stone.emissive.copy(tmp); stone.emissiveIntensity = 0.42 * night; cap.emissiveIntensity = 0.55 * night; for (const m of real) { m.emissive.copy(tmp); m.emissiveIntensity = 0.42 * night; } };
  return { group: g, update, kind: 'pyramids', half: [(x1 - x0) / 2 * k, (z1 - z0) / 2 * k], mid: [(x0 + x1) / 2 * k, (z0 + z1) / 2 * k], park: [LAYOUT.park[0] * k, LAYOUT.park[1] * k] };
}
