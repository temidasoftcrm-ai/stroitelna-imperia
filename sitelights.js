// sitelights.js — прожектори на строежите нощем: стълбове в ъглите на оградата с лампи, светлинни конуси
// към обекта и светло петно на земята. Без истински светлини (евтино) — само светещи материали.
import * as THREE from 'three';

const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7 });
const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2c8, emissiveIntensity: 0 });
const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const poolTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

// g: групата на обекта (центрирана на парцела); W: половината ширина на оградата; h: височина на стълбовете
export function addSiteLights(g, W = 7.6, h = 9) {
  const out = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, 1]]) {
    const x = sx * (W + 0.4), z = sz * (W + 0.4);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 6), poleMat); pole.position.set(x, h / 2, z); out.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), headMat); head.position.set(x, h, z); head.lookAt(0, 0, 0); out.add(head);
    // конус от лампата към центъра на обекта
    const len = Math.hypot(x, h, z) * 0.9, beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, len, 16, 1, true).translate(0, -len / 2, 0), beamMat);
    beam.position.set(x, h, z); beam.lookAt(0, 0, 0); beam.rotateX(-Math.PI / 2); out.add(beam);
  }
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(W * 2.2, W * 2.2).rotateX(-Math.PI / 2), poolMat); pool.position.y = 0.08; out.add(pool);
  g.add(out);
  return out;
}
// n: 0…1 колко е нощ (dayNight.night); общите материали се обновяват веднъж за всички обекти
export function setSiteLightsNight(n) {
  headMat.emissiveIntensity = n * 3;
  beamMat.opacity = n * 0.16;
  poolMat.opacity = n * 0.45;
}
