// roundabout.js — ⛲ roundabout-deco (T2; потребителят: „да оправим фонтана; на някои да сложим и статуи на кръговите“):
// украсата в средата на кръговото (cityplan2-3d.js roundReal): светъл каменен фонтан (травертин) с вода в чашите, струи и подсветка нощем,
// или (≈ 1/3, по хеш на кръговото) паметник на пиедестал — статуя от моделите на играта / обелиск / колона с фигура; нощем — прожектори отдолу.
//   roundDeco({ x, z, ri, seed, style, statues: [групите от statuePrep — по държавата], night: () => 0…1 }) → THREE.Group (основата на y = 0 — повърхността на острова)
import * as THREE from 'three';

const TRAV = new THREE.MeshStandardMaterial({ color: 0xe9e0cc, roughness: 0.75, emissive: 0xffd9a0, emissiveIntensity: 0 });
const BRONZE = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.45, metalness: 0.6, emissive: 0xffc070, emissiveIntensity: 0 });
const WATER = new THREE.MeshStandardMaterial({ color: 0x5fb8b2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.78, emissive: 0x2a8f9a, emissiveIntensity: 0.05, depthWrite: false });
const JET = new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.55, depthWrite: false });
let tickN = -1, tickT = 0;
// материалите са общи — пулсът (вълничките, струите) и нощта се смятат веднъж на кадър
function tick(night) { const f = performance.now(); if (Math.abs(f - tickN) < 8) return tickT; tickN = f; tickT = f / 1000;
  const n = night(); TRAV.emissiveIntensity = 0.22 * n; BRONZE.emissiveIntensity = 0.35 * n; WATER.emissiveIntensity = 0.05 + 0.9 * n + 0.06 * Math.sin(tickT * 3.1); return tickT; }

function fountain(R, night) {
  const g = new THREE.Group(), add = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.CylinderGeometry(R, R + 0.2, 0.55, 40), TRAV, 0.275);                                  // долният басейн (ръбът)
  const w0 = add(new THREE.CircleGeometry(R - 0.28, 40).rotateX(-Math.PI / 2), WATER, 0.5); w0.castShadow = false;   // водата в басейна
  add(new THREE.CylinderGeometry(R * 0.16, R * 0.2, 1.6, 16), TRAV, 1.1);                              // стъблото
  add(new THREE.CylinderGeometry(R * 0.48, R * 0.18, 0.35, 32), TRAV, 1.95);                           // средната чаша
  const w1 = add(new THREE.CircleGeometry(R * 0.42, 32).rotateX(-Math.PI / 2), WATER, 2.1); w1.castShadow = false;
  add(new THREE.CylinderGeometry(R * 0.1, R * 0.13, 0.9, 12), TRAV, 2.55);
  add(new THREE.CylinderGeometry(R * 0.24, R * 0.09, 0.25, 24), TRAV, 3.05);                           // горната чаша
  // струите: централна (нагоре) и падащи завеси от чашите — конуси, които „дишат“ (мащаб по времето)
  const jet = add(new THREE.ConeGeometry(0.12, 1.6, 8, 1, true).translate(0, 0.8, 0), JET, 3.15); jet.castShadow = false;
  const c1 = add(new THREE.CylinderGeometry(R * 0.44, R * 0.5, 0.95, 32, 1, true).translate(0, -0.47, 0), JET, 2.05); c1.castShadow = false;
  const c0 = add(new THREE.CylinderGeometry(R * 0.6, R * 0.95, 1.5, 32, 1, true).translate(0, -0.75, 0), JET, 1.25); c0.castShadow = false; c0.material = JET.clone(); c0.material.opacity = 0.22;
  jet.onBeforeRender = () => { const t = tick(night); jet.scale.set(1, 0.85 + 0.25 * Math.sin(t * 5.3), 1); c1.scale.set(1 + 0.03 * Math.sin(t * 7), 1, 1 + 0.03 * Math.sin(t * 7)); };
  return g;
}

// пиедестал с паметник: статуя (модел на играта, мащабирана до ~h м), обелиск или колона с фигура
function monument(o, R, night) {
  const g = new THREE.Group(), add = (geo, m, y) => { const q = new THREE.Mesh(geo, m); q.position.y = y; q.castShadow = q.receiveShadow = true; g.add(q); return q; };
  add(new THREE.CylinderGeometry(R * 0.9, R, 0.5, 24), TRAV, 0.25);   // стъпалата
  if (o.kind === 'obelisk') { add(new THREE.BoxGeometry(1.6, 1.2, 1.6), TRAV, 1.1); const ob = add(new THREE.CylinderGeometry(0.35, 0.75, 9, 4), TRAV, 6.2); ob.rotation.y = Math.PI / 4; const tip = add(new THREE.ConeGeometry(0.5, 1.1, 4), BRONZE, 11.25); tip.rotation.y = Math.PI / 4; }
  else if (o.kind === 'column') { add(new THREE.BoxGeometry(2, 1.6, 2), TRAV, 1.3); add(new THREE.CylinderGeometry(0.55, 0.65, 9, 16), TRAV, 6.6); add(new THREE.BoxGeometry(1.5, 0.5, 1.5), TRAV, 11.35);
    const fig = add(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 8), BRONZE, 12.5); add(new THREE.SphereGeometry(0.26, 10, 8), BRONZE, 13.6); fig.scale.set(1, 1, 1); }
  else { const s = o.model.clone(true); s.position.y = 0.5; g.add(s); }   // статуя от statues.js (statuePrep: в истински ръст, със своя пиедестал; нощем — осветена)
  g.children[0].onBeforeRender = () => tick(night);
  return g;
}

export function roundDeco({ x, z, ri, seed = 1, style = '', statues = [], night = () => 0, mustMonument = false, pick = null, pickF = null }) {   // pickF(seed, ri, major) → готов фонтан (statues-meshy: Пегас / Митовете, мащабиран за острова) или null   // pick(seed, ri) → статуя (statues-meshy: по града, без повторения) или null
  const R = Math.min(3.6, ri * 0.33), u0 = ((seed * 2654435761) >>> 0) % 1000 / 1000, u = mustMonument ? u0 * 0.33 : u0;   // mustMonument — задължително паметник (най-близкото до центъра)
  let g;
  if (u < 0.34) {   // паметник: в България/на Балканите — фигура на пиедестал; Париж/Рим — обелиск или колона; другаде — смес
    const v = (u * 3) % 1, classic = /paris|rome|london|washington/.test(style);
    const pm = pick ? pick(seed, ri) : null, kind = pm || (statues.length && (!classic || v < 0.4)) ? 'statue' : classic ? (v < 0.7 ? 'obelisk' : 'column') : v < 0.5 ? 'column' : 'obelisk';
    g = monument({ kind, model: pm || (statues.length ? statues[(seed >>> 3) % statues.length] : null), h: 4 + v * 1.5 }, R, night);
    g.userData.rdKind = 'monument';
  } else { const fm = pickF ? pickF(seed, ri, ri >= 14) : null; if (fm) g = fm; else { g = fountain(R, night); g.scale.setScalar(1.5); } g.userData.rdKind = 'fountain'; }   // ×1,5 — фонтанът се вижда над храстите (~5,5 м)
  g.position.set(x, 0, z); g.rotation.y = u * 6.283;
  return g;
}
