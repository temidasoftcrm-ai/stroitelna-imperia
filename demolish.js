// demolish.js — събаряне на стара сграда преди нов строеж: скеле, кран с топка, сградата пада на части
// (етаж по етаж) с отломки и прах, отдолу расте купчина руини. Само визуално; game.js движи прогреса (0…1).
import * as THREE from 'three';

const yellow = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.6 });
const dark = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x8a8079, roughness: 1 });
const debrisGeo = new THREE.BoxGeometry(1, 1, 1), dustGeo = new THREE.SphereGeometry(1, 10, 8);

// obj: сградата (вече в сцената); parent: групата, в която да сложим скелето, крана и отломките (координати на света)
export function createDemolition(obj, parent) {
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj), base = bb.min.y, H = bb.max.y - bb.min.y;
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2, W = (bb.max.x - bb.min.x) / 2 + 0.8, D = (bb.max.z - bb.min.z) / 2 + 0.8;
  const steps = Math.max(3, Math.min(10, Math.round(H / 3)));
  const g = new THREE.Group();
  parent.add(g);

  // сградата се реже отгоре надолу със своя плоскост (материалите се клонират, за да не засегнем другите сгради)
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), bb.max.y + 1);
  const own = [];
  obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [clip]; o.material.clipShadows = true; own.push(o.material); } });

  // скеле (реже се заедно със сградата)
  const pts = [];
  for (let a = -W; a <= W + 0.01; a += 2.5) for (const z of [-D, D]) pts.push(cx + a, base, cz + z, cx + a, bb.max.y + 1, cz + z);
  for (let a = -D; a <= D + 0.01; a += 2.5) for (const x of [-W, W]) pts.push(cx + x, base, cz + a, cx + x, bb.max.y + 1, cz + a);
  for (let y = base + 3; y <= bb.max.y + 1; y += 3) for (const [x1, z1, x2, z2] of [[-W, -D, W, -D], [W, -D, W, D], [W, D, -W, D], [-W, D, -W, -D]]) pts.push(cx + x1, y, cz + z1, cx + x2, y, cz + z2);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const scaffold = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9a53a, clippingPlanes: [clip] }));
  g.add(scaffold);

  // кран с топка за събаряне до сградата
  const mastH = H + 6, crane = new THREE.Group();
  crane.position.set(cx + W + 4, base, cz + D + 2);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(1, mastH, 1), yellow); mast.position.y = mastH / 2; crane.add(mast);
  const boom = new THREE.Group(); boom.position.y = mastH; crane.add(boom);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, W + 8), yellow); arm.position.z = -(W + 8) / 2 + 1; boom.add(arm);
  boom.rotation.y = Math.atan2(cx - crane.position.x, cz - crane.position.z) + Math.PI;
  const pivot = new THREE.Group(); pivot.position.set(0, 0, -(W + 5)); boom.add(pivot);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), dark); pivot.add(cable);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), dark); pivot.add(ball);
  crane.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.add(crane);

  // купчина руини отдолу
  const rubble = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 9), rubbleMat);
  rubble.position.set(cx, base, cz); rubble.scale.set(0.01, 0.01, 0.01); rubble.castShadow = rubble.receiveShadow = true;
  g.add(rubble);

  const debris = [], dust = [];
  let level = 0, t = 0;
  const cutY = lv => base + H * (1 - lv / steps);
  function burst(y) {
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(debrisGeo, rubbleMat), s = 0.3 + Math.random() * 0.9;
      m.scale.set(s, s * (0.5 + Math.random()), s);
      m.position.set(cx + (Math.random() - 0.5) * W * 2, y, cz + (Math.random() - 0.5) * D * 2);
      m.castShadow = true; g.add(m);
      debris.push({ m, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 6, rx: Math.random() * 6, life: 3 });
    }
    for (let k = 0; k < 6; k++) {
      const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xc8beb2, transparent: true, opacity: 0.45, depthWrite: false }));
      m.position.set(cx + (Math.random() - 0.5) * W * 1.6, y - Math.random() * 3, cz + (Math.random() - 0.5) * D * 1.6);
      g.add(m); dust.push({ m, life: 2.2, s: 1 + Math.random() * 1.5 });
    }
  }
  // prog: 0…1 (събарянето), dt: секунди на кадъра (за анимацията)
  function update(prog, dt) {
    t += dt;
    const lv = Math.min(steps, Math.floor(prog * steps + 1e-6));
    while (level < lv) { level++; burst(cutY(level - 1)); }
    // плоскостта слиза плавно към следващия разрез; последната част изчезва изцяло
    const want = level >= steps ? base - 1 : cutY(level);
    clip.constant += (want - clip.constant) * Math.min(1, dt * 3);
    // топката се люлее към сградата малко над разреза
    pivot.rotation.x = Math.sin(t * 1.8) * 0.45;
    const drop = Math.max(2, mastH - Math.max(base + 1, clip.constant - 1.5));
    cable.scale.y = drop; cable.position.y = -drop / 2; ball.position.y = -drop;
    const rs = 1 + prog * Math.max(W, D) * 0.9;
    rubble.scale.set(rs, 0.2 + prog * Math.min(4, H * 0.15), rs);
    rubble.position.y = base + rubble.scale.y / 2;
    for (let k = debris.length - 1; k >= 0; k--) {
      const d = debris[k];
      d.vy -= 18 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
      d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rx * dt;
      if (d.m.position.y < base + 0.3) { d.m.position.y = base + 0.3; d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; }
      if ((d.life -= dt) <= 0) { g.remove(d.m); debris.splice(k, 1); }
    }
    for (let k = dust.length - 1; k >= 0; k--) {
      const d = dust[k];
      d.life -= dt; d.m.scale.setScalar(d.s * (1 + (2.2 - d.life) * 1.5)); d.m.material.opacity = 0.45 * Math.max(0, d.life / 2.2);
      if (d.life <= 0) { d.m.material.dispose(); g.remove(d.m); dust.splice(k, 1); }
    }
  }
  function dispose() { parent.remove(g); for (const m of own) m.clippingPlanes = null; }
  return { update, dispose, steps };
}
