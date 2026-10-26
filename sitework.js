// sitework.js — живите строежи (Лабораторията → site-anim), всичко в истински метри:
//  • събаряне с истински автокран (sf-mcrane) на тротоара пред парцела — стрелата над сградата, топката се люлее и удря,
//    сградата пада на етапи (отгоре надолу) с отломки и прах; последните 20 %: кранът си тръгва, багер товари руините в самосвал на мястото му;
//  • техниката на обекта работи: багерът копае (върти се и „гребе“), булдозерът/товарачът бута напред-назад, валякът минава;
//  • кулокранът вдига палет с материали (кука, въже, палет, който се качва и сваля).
// Евтино: всичко се движи само с dt на играта (пауза = 0) и само близо до камерата (near).
//   const d = createDemolition2(obj, parent, A, { lot, k })  → { update(prog, dt, near), dispose, steps }
//   machineWork(obj, kind, t, seed) — позата на машината в момент t (сек. игра); връща нищо (мести децата на obj / obj.rotation)
//   craneLift(craneGroup, H) → { update(t) } — кука с палет под стрелата на кулокрана
import * as THREE from 'three';
import { siteK } from './scale.js';
import { feature } from './lab/feature.js';   // истинските размери на машините (едно място)

const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.4 });
const steel = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.55, metalness: 0.2 });
const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8079, roughness: 1 });
const debrisGeo = new THREE.BoxGeometry(1, 1, 1), dustGeo = new THREE.SphereGeometry(1, 10, 8);

// ---- раздвижените в Blender модели (assets/heavy/gear/*-rig.glb): автокранът (кула slew, стрела luff, телескоп tele, кука hook; клипове raise, work)
// и багерът (кула swing, стрела boom, рамо stick, кофа bucket; клипове dig, work). Нормализирани като vehmodels.js: дължина 1 по z, колелата на y = 0.
export function loadSiteRigs(load, A) {
  // yaw — като vehmodels.js GEAR (грейдерът е с предницата по +x); бетоновозът — като construct.js (по-дългата страна към z)
  const one = (f, key, yaw = 0) => load(`assets/heavy/gear/${f}.glb`).then(g => { const inner = new THREE.Group(), w = new THREE.Group(); inner.add(g.scene); inner.rotation.y = yaw; w.add(inner); w.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(w); const s = b.getSize(new THREE.Vector3()); inner.scale.setScalar(1 / s.z); w.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(w); const c = b.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b.min.y, -c.z);
    w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); A[key] = { scene: w, clips: g.animations }; }).catch(e => console.warn('rig', f, e));
  return Promise.all([one('mcrane-rig', 'sf-mcrane-rig'), one('excavator-rig', 'sf-excavator-rig'), one('dump-rig', 'sf-dump-rig'), one('backhoe-rig', 'sf-backhoe-rig'), one('roller-rig', 'sf-roller-rig'),
    one('grader-rig', 'sf-grader-rig', -Math.PI / 2), one('mixer-rig', 'sf-mixer-rig', Math.PI / 2),
    // 🚛 gear-dump2: самосвалът на потребителя (Meshy, раздвижен в Blender: колела wheel_*, кош bed с клип „dump“, светлини head_*/tail_*) — и като неподвижен модел sf-dump2
    ...(feature('gear-dump2') ? [one('dump2-rig', 'sf-dump2-rig').then(() => { if (A['sf-dump2-rig']) A['sf-dump2'] = { scene: A['sf-dump2-rig'].scene }; })] : [])]);
}
// машината на играта (model(sf, len) — вътре моделът с дължина 1) → раздвиженият модел на същото място и в същия размер; len — дължината на вътрешния модел
// every (сек.) — клипът се пуска веднъж на толкова (самосвалът изсипва), иначе — непрекъснато. Връща rig ({ mixer, action, every }) или null
export function swapRig(obj, A, key, clip, o = {}) {
  if (!A[key]) return null;
  { const R = A[key]; if (R.meshN == null) { let n = 0; R.scene.traverse(m => { if (m.isMesh) n++; }); R.meshN = n; } if (R.meshN > 60) return null; }   /* временно: раздвижен модел от стотици части = стотици draw calls на кадър (самосвал 1974) — до сливането по стави остава обикновеният модел */
  obj.remove(...obj.children); const r = A[key].scene.clone(true); if (o.len) r.scale.setScalar(o.len); obj.add(r);
  const rig = rigPlay(r, A, key, clip, !o.every); if (rig) { rig.every = o.every || 0; rig.wait = 0; if (rig.every) rig.action.stop(); } return rig;   /* с every — първия път след паузата */
}
// пуска клип (по име) на клонинг на раздвижен модел; връща { mixer, action }
export function rigPlay(obj, A, key, clip, loop = true) {
  const R = A[key]; if (!R || !R.clips) return null; const c = R.clips.find(q => q.name === clip); if (!c) return null;
  const mixer = new THREE.AnimationMixer(obj), action = mixer.clipAction(c); if (!loop) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; } action.play(); return { mixer, action };
}
// модел с дължина 1 (vehmodels.js) → в метри; лице към +z
const vehicle = (A, n) => { if (!A[n]) return null; const o = (A[n].scene || A[n]).clone(true); o.scale.setScalar(siteK(A, n)); o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

// obj — сградата в сцената; parent — групата в координатите на света; lot { x, z, rot, w, d } — парцелът (лицето към улицата е локално +z)
export function createDemolition2(obj, parent, A, o = {}) {
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj), base = bb.min.y, H = bb.max.y - bb.min.y;
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, W = (bb.max.x - bb.min.x) / 2 + 0.6, D = (bb.max.z - bb.min.z) / 2 + 0.6;
  const steps = Math.max(3, Math.min(10, Math.round(H / 3)));
  const L = o.lot || { x: cx, z: cz, rot: 0, w: W * 2 + 3, d: D * 2 + 3 }, rot = L.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  const toW = (u, v) => [L.x + u * c + v * s, L.z - u * s + v * c];   // локално (u напреки, v към улицата) → свят
  const g = new THREE.Group(); parent.add(g);

  // сградата се реже отгоре надолу (материалите — клонинги)
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), bb.max.y + 1), own = [];
  obj.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.clippingPlanes = [clip]; m.material.clipShadows = true; own.push(m.material); } });

  // автокранът — на тротоара пред парцела, успоредно на улицата (никога през улицата); стрелата — решетъчна, към средата на сградата
  const crane = new THREE.Group(), sideV = L.d / 2 + 2.2, [kx, kz] = toW(-L.w * 0.15, sideV);
  crane.position.set(kx, base, kz); crane.rotation.y = rot + Math.PI / 2; g.add(crane);
  const MCRANE_LEN = A['sf-mcrane'] ? siteK(A, 'sf-mcrane') : 13.5, rig = A['sf-mcrane-rig'] ? (() => { const o = A['sf-mcrane-rig'].scene.clone(true); o.scale.setScalar(siteK(A, 'sf-mcrane')); return o; })() : null, truck = rig || vehicle(A, 'sf-mcrane'); if (truck) crane.add(truck); else { const b = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, MCRANE_LEN), steel); b.position.y = 1.5; crane.add(b); }
  // въртящата се кула над задния мост и стрелата: от кулата до точка 4 м над сградата
  const anim = rig ? rigPlay(rig, A, 'sf-mcrane-rig', 'raise', false) : null, slewN = rig && rig.getObjectByName('slew'), hookN = rig && rig.getObjectByName('hook');
  if (anim) anim.action.timeScale = 1.6;   // стрелата се вдига и телескопира (~4 s), после стои
  const turret = new THREE.Group(); turret.position.set(0, 3.2, -MCRANE_LEN * 0.18); crane.add(turret);
  const tip = new THREE.Vector3(cx, base + H + 4, cz); crane.updateMatrixWorld(true);
  const tl = turret.worldToLocal(tip.clone()), yaw = Math.atan2(tl.x, tl.z); turret.rotation.y = yaw;
  const reach = Math.hypot(tl.x, tl.z), rise = tl.y, len = Math.hypot(reach, rise), pitch = Math.atan2(rise, reach);
  const boom = new THREE.Group(); boom.rotation.x = -pitch; turret.add(boom); boom.visible = !rig;   // с раздвижения модел — неговата стрела; процедурната — само резерва
  const lat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, len), new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5, wireframe: true })); lat.position.z = len / 2; boom.add(lat);   // решетката
  for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, len), steel); ch.position.set(x, y, len / 2); boom.add(ch); }   // поясите
  const head = new THREE.Group(); head.position.z = len; boom.add(head);
  const pivot = new THREE.Group(); (rig ? g : head).add(pivot); pivot.rotation.x = rig ? 0 : pitch;   // отвес надолу, независимо от наклона на стрелата
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 5), dark); pivot.add(cable);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), dark); pivot.add(ball);
  crane.traverse(m => { if (m.isMesh) m.castShadow = true; });
  // посоката на люлеене — към сградата (в равнината на стрелата)
  const swingAxis = new THREE.Vector3(1, 0, 0);

  // руините, багерът и самосвалът (накрая, при prog > 0,7)
  const rubble = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), rubbleMat); rubble.position.set(cx, base, cz); rubble.scale.setScalar(0.01); rubble.castShadow = rubble.receiveShadow = true; g.add(rubble);
  const exc = vehicle(A, 'sf-excavator'), dump = vehicle(A, 'sf-dump');
  if (exc) { const [x, z] = toW(L.w / 2 - 2.5, L.d * 0.15); exc.position.set(x, base, z); exc.rotation.y = rot - Math.PI / 2; exc.visible = false; g.add(exc); }
  if (dump) { const [x, z] = toW(-L.w * 0.15, sideV);   /* на мястото на автокрана, след като той си тръгне */ dump.position.set(x, base, z); dump.rotation.y = rot + Math.PI / 2; dump.visible = false; g.add(dump); }

  const debris = [], dust = []; let level = 0, t = 0, lastHit = 0;
  const cutY = lv => base + H * (1 - lv / steps);
  function burst(y, n = 14) {
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(debrisGeo, rubbleMat), sz = 0.25 + Math.random() * 0.8; m.scale.set(sz, sz * (0.5 + Math.random()), sz); m.position.set(cx + (Math.random() - 0.5) * W * 2, y, cz + (Math.random() - 0.5) * D * 2); m.castShadow = true; g.add(m); debris.push({ m, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 6, rx: Math.random() * 6, life: 3 }); }
    for (let k = 0; k < Math.ceil(n / 2.5); k++) { const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xc8beb2, transparent: true, opacity: 0.45, depthWrite: false })); m.position.set(cx + (Math.random() - 0.5) * W * 1.6, y - Math.random() * 3, cz + (Math.random() - 0.5) * D * 1.6); g.add(m); dust.push({ m, life: 2.2, s: 1 + Math.random() * 1.5 }); }
  }
  // prog 0…1; dt — секунди на играта (0 на пауза); near — камерата е наблизо (иначе само прогресът, без анимацията)
  function update(prog, dt, near = true) {
    t += dt; const late = prog > 0.8;
    const lv = Math.min(steps, Math.floor(prog * steps + 1e-6));
    while (level < lv) { level++; if (near) burst(cutY(level - 1)); }
    const want = level >= steps ? base - 1 : cutY(level);
    clip.constant += (want - clip.constant) * Math.min(1, dt * 3);
    // топката: махало над сградата; удар при най-далечната точка (към стената), докато има какво да се руши
    if (anim && near) anim.mixer.update(dt);
    if (rig && slewN && hookN) {   // кулата — към сградата; топката — под куката
      const want = Math.atan2(cx - crane.position.x, cz - crane.position.z) - crane.rotation.y,   /* стрелата на модела е по +z (към кабината) */ d = Math.atan2(Math.sin(want - slewN.rotation.y), Math.cos(want - slewN.rotation.y)); slewN.rotation.y += d * Math.min(1, dt * 0.8);
      hookN.updateWorldMatrix(true, false); const hp = new THREE.Vector3().setFromMatrixPosition(hookN.matrixWorld); g.worldToLocal(hp); pivot.position.copy(hp); }
    const ang = Math.sin(t * 1.6) * 0.55; pivot.rotation.set((rig ? 0 : pitch) + ang, rig ? Math.atan2(cx - pivot.position.x, cz - pivot.position.z) : 0, 0, 'YXZ');
    const topY = rig ? pivot.position.y : base + H + 4, drop = Math.max(2, topY - Math.max(base + 1.2, clip.constant - 1.2)); cable.scale.y = drop; cable.position.y = -drop / 2; ball.position.y = -drop;
    if (near && !late && Math.sin(t * 1.6) > 0.98 && t - lastHit > 1.2) { lastHit = t; burst(Math.max(base + 0.5, clip.constant - 1), 5); }
    const rs = 1 + prog * Math.max(W, D) * 0.9; rubble.scale.set(rs, 0.2 + prog * Math.min(4, H * 0.15), rs); rubble.position.y = base + rubble.scale.y / 2;
    // накрая: багерът товари в самосвала (върти се между купа и самосвала)
    if (exc) exc.visible = late; if (dump) dump.visible = late;   // последните 20 %: кранът си е тръгнал, багерът товари
    if (late && exc && near) exc.rotation.y = rot - Math.PI / 2 + Math.sin(t * 0.9) * 0.9;
    crane.visible = !late;
    for (let k = debris.length - 1; k >= 0; k--) { const d = debris[k]; d.vy -= 18 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt; d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rx * dt;
      if (d.m.position.y < base + 0.3) { d.m.position.y = base + 0.3; d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; } if ((d.life -= dt) <= 0) { g.remove(d.m); debris.splice(k, 1); } }
    for (let k = dust.length - 1; k >= 0; k--) { const d = dust[k]; d.life -= dt; d.m.scale.setScalar(d.s * (1 + (2.2 - d.life) * 1.5)); d.m.material.opacity = 0.45 * Math.max(0, d.life / 2.2); if (d.life <= 0) { d.m.material.dispose(); g.remove(d.m); dust.splice(k, 1); } }
  }
  function dispose() { parent.remove(g); for (const m of own) m.clippingPlanes = null; for (const d of dust) d.m.material.dispose(); }
  return { update, dispose, steps, group: g };
}

// ---- техниката на обекта: позата в момента t (секунди на играта); obj — машината (model() на играта), h — нейното начално място
// с раздвижен модел (obj.userData.rig = rigPlay(obj, A, 'sf-excavator-rig', 'work')) — само клипът; иначе — kind: 'excavator' (копае: върти се към изкопа и назад, с леко „кимане“), 'bulldozer'/'loader' (бута напред-назад 4 м), 'roller' (бавно напред-назад 6 м),
// 'truck' (стои, коша се вдига при разтоварване — тук само леко клатене), другите — стоят
export function machineWork(obj, kind, t, seed = 0, dt = 0) {
  const rig = obj.userData.rig;
  if (rig) {   // раздвижената машина — истинският цикъл; с every — веднъж на толкова секунди (самосвалът изсипва и чака)
    if (rig.every && !rig.action.isRunning()) { rig.wait += dt; if (rig.wait >= rig.every) { rig.wait = 0; rig.action.reset().play(); } }
    rig.mixer.update(dt); return; }
  const h = obj.userData.home || (obj.userData.home = { x: obj.position.x, z: obj.position.z, ry: obj.rotation.y });
  const ph = t + seed * 1.7, fx = Math.sin(h.ry), fz = Math.cos(h.ry);
  if (kind === 'excavator' || kind === 'loader' && /excav/.test(obj.userData.src || '')) { obj.rotation.y = h.ry + Math.sin(ph * 0.7) * 0.8; obj.rotation.x = Math.max(0, Math.sin(ph * 1.4)) * 0.03; return; }
  if (kind === 'bulldozer' || kind === 'loader' || kind === 'tractor') { const d = (1 - Math.cos(ph * 0.5)) * 2; obj.position.set(h.x + fx * d, obj.position.y, h.z + fz * d); return; }
  if (kind === 'roller') { const d = Math.sin(ph * 0.25) * 3; obj.position.set(h.x + fx * d, obj.position.y, h.z + fz * d); return; }
}

// ---- кулокранът вдига палет: под върха на стрелата (локално на групата на крана) — въже, кука, палет с тухли; качва и сваля за ~16 s
export function craneLift(crane, H, jibLen = 18) {
  const hook = new THREE.Group(); crane.add(hook);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), dark); hook.add(rope);
  const pal = new THREE.Group(); hook.add(pal);
  const wood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.9 })); pal.add(wood);
  const bricks = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: 0xa8553a, roughness: 0.95 })); bricks.position.y = 0.53; pal.add(bricks);
  pal.traverse(m => { if (m.isMesh) m.castShadow = true; });
  hook.position.set(0, H, -jibLen * 0.6);
  return { update(t) { const u = (Math.sin(t * 0.4) + 1) / 2, drop = 2 + u * (H - 4); rope.scale.y = drop; rope.position.y = -drop / 2; pal.position.y = -drop - 0.1; } };
}
