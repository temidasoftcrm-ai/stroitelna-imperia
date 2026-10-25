// churches.js — ⛪ churches (f6): православни църкви в градовете на източноправославните държави (Sketchfab, CC-BY 4.0 — assets/heavy/CREDITS.txt).
// Олекотени в Blender (_source/downloads/churches/blender-churches.py: сканираните — изрязани до сградата, основата изравнена; decimate, webp, meshopt без квантизация).
// По 1–2 на град — на свободен парцел близо до центъра (площада / централата), по хеш (един и същ при всяко влизане); парцелът е запазен (като бензиностанцията),
// моделът идва, щом се зареди (~2–5 MB, само в тези държави). Нощем — меко осветени (прожектори). Храм-паметникът „Св. Александър Невски“ в София — landmarks.js / game.js.
//   import { CHURCH_FILES, churchKinds, churchLots, churchPrep } from './churches.js';
import * as THREE from 'three';

export const CHURCH_FILES = { boyana: 'churches/boyana.glb', bojidarkn: 'churches/bojidarkn.glb', karelian: 'churches/karelian.glb' };
// Не са ползвани: Св. Петка (скан без текстури) и Св. София — Охрид (сканът: изрязана от квартала, едната стена липсва — отвътре е тъмна дупка)
// истинската дължина (дългата страна, м) — в парцела се смалява, ако не се побира
const LEN = { boyana: 21, bojidarkn: 14, karelian: 13 };
// коя църква къде: старите каменни (Бояна, малката от скана) на Балканите, в Гърция и Кавказ; дървеният карелски параклис — Русия, Украйна, Беларус
const BY_CC = {
  '🇧🇬': ['boyana', 'bojidarkn'], '🇷🇸': ['bojidarkn', 'boyana'], '🇲🇰': ['boyana', 'bojidarkn'], '🇲🇪': ['bojidarkn', 'boyana'],
  '🇬🇷': ['bojidarkn', 'boyana'], '🇨🇾': ['bojidarkn', 'boyana'], '🇷🇴': ['boyana', 'bojidarkn'], '🇲🇩': ['boyana', 'karelian'],
  '🇷🇺': ['karelian', 'boyana'], '🇺🇦': ['karelian', 'boyana'], '🇧🇾': ['karelian', 'bojidarkn'], '🇬🇪': ['bojidarkn', 'boyana'], '🇦🇲': ['bojidarkn', 'boyana'],
};
export const churchKinds = cc => BY_CC[cc] || null;

// парцелите: свободни, не централата, достатъчно големи; най-близките до центъра — от първите 10 по хеш, на поне 60 м една от друга
export function churchLots(lots, center, n, hash) {
  const ok = lots.filter(l => !l.built && !l.busy && !l.fresh && !l.big && (!l.plan || Math.min(l.w, l.d) >= 12)).sort((a, b) => Math.hypot(a.x - center.x, a.z - center.z) - Math.hypot(b.x - center.x, b.z - center.z) || a.id - b.id).slice(0, 10);
  const out = []; let h = hash >>> 0;
  for (let t = 0; t < 20 && out.length < n && ok.length; t++) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; const l = ok[h % ok.length];
    if (!out.includes(l) && out.every(o => Math.hypot(o.x - l.x, o.z - l.z) >= 60)) out.push(l); }
  return out;
}

// моделът: на земята, центриран, дългата страна по x и = 1 (после × метрите); нощем — топло осветен (win — dayNight.winMats)
const prep = {};
export function churchPrep(k, scene, win) {
  if (prep[k]) return prep[k];
  const o = scene.clone(true), g = new THREE.Group();
  o.traverse(m => { if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
    for (const mt of [].concat(m.material)) if (mt && mt.emissive && !mt.userData.chNight) { mt.userData.chNight = 1; mt.emissive.setRGB(1, 0.85, 0.66); if (mt.map) mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.userData.winK = 0.4; if (mt.metalness > 0.4) mt.metalness = 0.25; mt.needsUpdate = true; win?.(mt); } });
  let b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3());
  if (s.z > s.x) { o.rotation.y = Math.PI / 2; o.updateMatrixWorld(true); b = new THREE.Box3().setFromObject(o); s = b.getSize(new THREE.Vector3()); }
  const c = b.getCenter(new THREE.Vector3()), k1 = 1 / s.x; o.position.set(-c.x, -b.min.y, -c.z); const w = new THREE.Group(); w.add(o); w.scale.setScalar(k1); g.add(w);
  g.userData.ratio = s.z / s.x;   // ширина / дължина
  return (prep[k] = g);
}
// копие в парцела: дължината — истинската или колкото позволява парцелът; лицето — към улицата (по завъртането на парцела)
export function churchAt(k, proto, lot, rot) {
  const room = lot.plan ? Math.min(lot.w, lot.d) + 2 : 16, ratio = proto.userData.ratio || 0.6;
  const L = Math.min(LEN[k] || 15, lot.plan ? Math.min(Math.max(lot.w, lot.d) + 2, room / ratio) : 16);
  const o = proto.clone(true); o.scale.setScalar(L); o.position.set(lot.x, 0, lot.z); o.rotation.y = (rot || 0) + (lot.plan && lot.d > lot.w ? Math.PI / 2 : 0);
  o.userData.church = k; o.userData.src = 'church-' + k; return o;
}
