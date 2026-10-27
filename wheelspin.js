// wheelspin.js — колелата на моделите от Blender (възли wheel_*, оста по локалното x): въртят се според изминатия път.
// spinWheels(obj) — вика се всеки кадър; пътят е от последното положение на obj в света (без зависимост от кода, който го мести).
import * as THREE from 'three';

const P = new THREE.Vector3(), B = new THREE.Box3(), S = new THREE.Vector3(), D = new THREE.Vector3();
export function spinWheels(obj) {
  if (!obj) return;
  const u = obj.userData;
  if (!u.wheels) {   // веднъж: колелата и радиусът им (половината от височината в света)
    u.wheels = []; obj.updateMatrixWorld(true);
    obj.traverse(o => { if (/^wheel_/.test(o.name)) { B.setFromObject(o).getSize(S); u.wheels.push([o, Math.max(0.05, S.y / 2)]); } });
  }
  if (!u.wheels.length) return;
  obj.getWorldPosition(P);
  if (u.wp) { const d = Math.hypot(P.x - u.wp.x, P.z - u.wp.z); if (d > 0.001 && d < 20) { obj.getWorldDirection(D); const fw = D.x * (P.x - u.wp.x) + D.z * (P.z - u.wp.z) >= 0 ? 1 : -1; for (const [w, r] of u.wheels) w.rotation.x += fw * d / r; } }
  else u.wp = new THREE.Vector3();
  u.wp.copy(P);
}
// hubWheels(root) — веднъж, на заредения модел (преди клонирането): възелът wheel_* — точно в главината (центъра на геометрията по y и z).
// Иначе колелото се върти около изместена ос и гумата влиза под пътя (одитът №11: fire-titan и сметосъбирачът — до −0,21 м)
export function hubWheels(root) {
  root.traverse(o => { if (!o.isMesh || !/^wheel_/.test(o.name) || o.geometry.userData.hub) return; const g = o.geometry; g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
    if (Math.abs(c.y) + Math.abs(c.z) < 1e-4) return; g.translate(0, -c.y, -c.z); g.userData.hub = 1; o.position.add(new THREE.Vector3(0, c.y, c.z).multiply(o.scale).applyQuaternion(o.quaternion)); });
}
