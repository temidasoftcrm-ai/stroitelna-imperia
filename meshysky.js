// meshysky.js — 🏙️ meshy-sky2 (f6): двата небостъргача от Meshy AI (собствени на ТЕМИДАСОФТ — assets/heavy/CREDITS.txt) в градовете със стъклени кули.
// „Golden Tower“ (sky/gold.glb, ~80 м) и „Blue Spire Oasis“ (sky/bluespire.glb, ~95 м) — олекотени в Blender, в метри, основата на земята.
// Възлите в модела: Body — сградата (прозорците нощем — nightfloors.js, както другите sf-sky-*); Beacon — червената авиационна лампа на върха
// (клип „beacon“ в GLB-то; тук мига през общия материал — без AnimationMixer за всяко копие); Accent — нисък „плащ“ около долната половина
// с градиент във върховите цветове: нощното осветяване отдолу (златно / синьо), адитивно.
//   game.js: при зареждането — meshySkyPrep(gltf.scene, () => dayNight.night); в SF_SKY — само в MESHY_SKY_CITIES.
import * as THREE from 'three';

export const MESHY_SKY = { gold: 'sky/gold.glb', bluespire: 'sky/bluespire.glb', skyspire: 'sky/skyspire.glb', skyspire2: 'sky/skyspire2.glb' };   // „Skyspire Nexus“ — в Blender разделен на две: извитата двойна кула (skyspire, 110 м) и единичната (skyspire2, 95 м) — целият комплекс е широк колкото е висок и на парцел излизаше 15 м
export const MESHY_SKY_H = { 'sf-sky-gold': 80, 'sf-sky-bluespire': 95, 'sf-sky-skyspire': 110, 'sf-sky-skyspire2': 95 };
// градовете със стъклени небостъргачи (не старите европейски центрове)
export const MESHY_SKY_CITIES = new Set(['newyork', 'chicago', 'losangeles', 'toronto', 'mexicocity', 'saopaulo', 'dubai', 'mumbai', 'singapore', 'hongkong', 'shanghai', 'beijing', 'seoul', 'tokyo', 'sydney', 'moscow',
  'houston', 'miami', 'sanfrancisco', 'abudhabi', 'doha', 'kualalumpur', 'bangkok', 'osaka', 'taipei', 'shenzhen', 'jakarta']);

export function meshySkyPrep(root, night) {
  // материалите са общи за всички копия (clone(true) не копира Object3D.onBeforeRender) — затова Material.onBeforeRender
  const beacon = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  beacon.onBeforeRender = () => { const n = night(); beacon.opacity = (performance.now() / 1000) % 1.5 < 0.25 ? 0.2 + 0.8 * n : 0.04 * n; };   // 0,25 с на всеки 1,5 с (като клипа); денем по-слабо
  const accent = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0 });
  accent.onBeforeRender = () => { accent.opacity = 0.85 * night(); };
  root.traverse(o => {
    if (!o.isMesh) return;
    const nm = (o.name + ' ' + (o.parent && o.parent.name)) || '';
    if (/\bBeacon/.test(nm)) { o.material = beacon; o.scale.setScalar(1.8); o.castShadow = o.receiveShadow = false; }   // ×1,8 — да се вижда и когато кулата е смалена до парцела
    else if (/\bAccent/.test(nm)) { o.material = accent; o.castShadow = o.receiveShadow = false; o.renderOrder = 2; }
  });
}
