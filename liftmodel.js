// liftmodel.js — седалков лифт от Sketchfab („Chair Lift“ от Kagelok, CC-BY): моделът се разглобява на части —
// горна станция, долна станция, стълб и седалка — които resortview.js нарежда по своя лифт.
// Всички части са завъртени така, че лифтът върви по +z от горната към долната станция; табелата с името
// на истинския курорт от модела не се ползва.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PARTS = {
  top: /^(St Bois|St Verre Haut|St Plateforme haut|Pil St Haut|Pil St Haut001|Goutti.*|Fenetre Cote|Fenetre Rect|Socle Beton|Barri.*St Haut|Echelles|Therm Haut|Panneaux|Bar Panneau|Roues)$/,
  bottom: /^(St Plateforme Bas|St Verre Bas|Pil St Bas|Pil St Bas001|Barri.*St Bas|Therm Bas|Guide Cable|Neige)$/,
  pylon: /^(Pil Haut|Pil Haut001|Plateforme Pil Haut|Pil Deco|Barri.*Pil Haut|Pil Fix Roues Haut|Roues Pil Haut)$/,
  chair: /^(06|D06)$/,
};
let L = null, loading = null;

// части по име → група с изпечени световни координати на модела
function collect(root, re) {
  const g = new THREE.Group();
  const seen = new Set();
  root.traverse(n => {
    if (!re.test(n.name.replace(/_/g, ' ').replace(/\./g, ''))) return;   // GLTFLoader заменя интервалите с _ и маха точките
    n.traverse(m => { if (m.isMesh && !seen.has(m)) { seen.add(m); const c = new THREE.Mesh(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material); c.castShadow = true; c.receiveShadow = true; g.add(c); } });
  });
  return g;
}
const centerOf = g => new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());

export function loadLift(url = 'assets/heavy/lift/lift.glb') {
  if (!loading) loading = new Promise(res => new GLTFLoader().load(url, gl => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const parts = Object.fromEntries(Object.entries(PARTS).map(([k, re]) => [k, collect(root, re)]));
    // посоката на лифта (от горната към долната станция) хоризонтално → завъртане към +z
    const a = centerOf(parts.top), b = centerOf(parts.bottom), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const prep = (g, anchor) => {   // anchor: 'base' — основата на y = 0; 'top' — горната точка на y = 0 (седалката виси)
      const w = new THREE.Group(), inner = new THREE.Group(); inner.add(g); inner.rotation.y = -yaw; w.add(inner); w.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(w), c = bb.getCenter(new THREE.Vector3());
      inner.position.set(-c.x, anchor === 'top' ? -bb.max.y : -bb.min.y, -c.z);
      w.userData.size = bb.getSize(new THREE.Vector3());
      return w;
    };
    L = { top: prep(parts.top, 'base'), bottom: prep(parts.bottom, 'base'), pylon: prep(parts.pylon, 'base'), chair: prep(parts.chair, 'top') };
    res(L);
  }, undefined, () => res(null)));
  return loading;
}
// копие на част, мащабирано така, че височината ѝ да е h (за седалката — ширината ѝ да е h)
export function liftPart(k, h) {
  if (!L || !L[k]) return null;
  const o = L[k].clone(true), s = L[k].userData.size;
  o.scale.setScalar(h / (k === 'chair' ? Math.max(s.x, s.z) : s.y));
  return o;
}
