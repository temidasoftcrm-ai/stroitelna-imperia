// 🛵 motos.js — motos (T2; координаторът: „мотори и скутери в трафика на града“): моделите на потребителя (Meshy, ТЕМИДАСОФТ) —
// червен скутер и класически мотор (bobber), заварени, основата на 0, предницата към +Z, колелата — възли wheel_F / wheel_R (оста по X),
// светлините head / tail. Отгоре — седнал моторист (каска, яке, ръце към кормилото); колелата се въртят по изминатото, в завоя — наклон.
//   motoShare(cc, lat, month) — делът на моторите в трафика (Средиземноморието и Азия — повече, зимата в студените градове — по-малко)
//   makeMoto(A, rnd, night) → { obj, len, w, h, kind } | null
import * as THREE from 'three';
import { feature } from './lab/feature.js';
const LK = feature('car-lights2') ? /^(?:lamp_)?(head|tail)/ : /^(head|tail)/;   // 💡 car-lights2: светлините на мотора — и възлите lamp_head_C / lamp_tail_C

const MED = new Set(['🇮🇹', '🇪🇸', '🇬🇷', '🇵🇹', '🇹🇷', '🇲🇹', '🇨🇾', '🇭🇷', '🇯🇵', '🇨🇳', '🇹🇼', '🇻🇳', '🇹🇭', '🇮🇳', '🇮🇩', '🇲🇾', '🇵🇭', '🇰🇷', '🇸🇬', '🇧🇷', '🇲🇽']);
export function motoShare(cc, lat = 45, month = 6) {
  const base = MED.has(cc) ? 0.16 : 0.06, cold = Math.abs(lat) > 40 && !MED.has(cc);
  const m = lat < 0 ? (month + 6) % 12 : month, winter = m === 11 || m <= 1, shoulder = m === 2 || m === 10;
  return base * (winter ? (cold ? 0.2 : 0.55) : shoulder ? 0.7 : 1);
}
// седалката, кормилото (в метри, в рамката на модела: +Z напред, Y нагоре) — по модела
const FIT = { 'moto-scooter': { len: 1.85, seat: [0, 0.8, -0.18], bar: [0, 1.02, 0.42], foot: [0, 0.32, 0.12], w: 0.75 }, 'moto-bobber': { len: 2.2, seat: [0, 0.72, -0.12], bar: [0, 1.0, 0.62], foot: [0, 0.36, 0.3], w: 0.85 } };
const JACKET = [0x2a2f38, 0x7a1f1f, 0x23415f, 0x3d4a2e, 0x111111, 0x6b5b45, 0xb8b2a6], PANTS = [0x2b3445, 0x1c1c1c, 0x4a4036, 0x37404d], HELM = [0xf2f2f2, 0x111111, 0xd13b2f, 0x1f5fa8, 0xe8c12e, 0x6d7a84], SKIN = [0xe0b08f, 0xc68e6a, 0x8d5a3c, 0xf1c9a5];
const mats = new Map(), M = c => mats.get(c) || (mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 })), mats.get(c));
const G = {};   // общите геометрии на моториста
function geo() { if (G.torso) return G; G.torso = new THREE.BoxGeometry(0.4, 0.55, 0.24); G.head = new THREE.SphereGeometry(0.15, 12, 10); G.visor = new THREE.SphereGeometry(0.151, 12, 6, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16);
  G.limb = new THREE.CylinderGeometry(0.055, 0.05, 1, 8).translate(0, -0.5, 0); return G; }
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
// крайник от a до b (в рамката на мотора)
function limb(par, a, b, m, r = 1) { const g = geo(), o = new THREE.Mesh(g.limb, m); tmpA.set(...a); tmpB.set(...b); const d = tmpB.clone().sub(tmpA), L = d.length();
  o.position.copy(tmpA); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize()); o.scale.set(r, L, r); o.castShadow = true; par.add(o); return o; }
function rider(f, rnd) {
  const g = geo(), R = new THREE.Group(), pk = a => a[(rnd() * a.length) | 0], jk = M(pk(JACKET)), pt = M(pk(PANTS)), sk = M(pk(SKIN)), hm = M(pk(HELM));
  const [sx, sy, sz] = f.seat, [bx, by, bz] = f.bar, [fx, fy, fz] = f.foot, lean = 0.32;
  const hip = [0, sy + 0.08, sz], sh = [0, sy + 0.08 + 0.5 * Math.cos(lean), sz + 0.5 * Math.sin(lean)];
  const t = new THREE.Mesh(g.torso, jk); t.position.set(0, (hip[1] + sh[1]) / 2, (hip[2] + sh[2]) / 2); t.rotation.x = lean; t.castShadow = true; R.add(t);
  const h = new THREE.Mesh(g.head, hm); h.position.set(0, sh[1] + 0.2, sh[2] + 0.05); h.castShadow = true; R.add(h);
  const v = new THREE.Mesh(g.visor, M(0x161a20)); v.position.copy(h.position); v.rotation.x = -0.25; R.add(v);
  for (const s of [-1, 1]) { const shp = [s * 0.2, sh[1] - 0.05, sh[2]], el = [s * 0.27, (sh[1] + by) / 2 - 0.05, (sh[2] + bz) / 2 - 0.05], hd = [s * 0.3, by, bz - 0.04];
    limb(R, shp, el, jk); limb(R, el, hd, jk, 0.9); const hn = new THREE.Mesh(g.head, sk); hn.scale.setScalar(0.32); hn.position.set(...hd); R.add(hn);
    const kn = [s * 0.17, sy + 0.18, (sz + fz) / 2 + 0.22], ft = [s * 0.2, fy, fz]; limb(R, [s * 0.11, hip[1], hip[2]], kn, pt, 1.25); limb(R, kn, ft, pt, 1.1); }
  return R;
}
export function makeMoto(A, rnd = Math.random, night = () => 0) {
  const ks = Object.keys(FIT).filter(k => A[k]); if (!ks.length) return null;
  const k = rnd() < 0.62 && A['moto-scooter'] ? 'moto-scooter' : ks[(rnd() * ks.length) | 0], f = FIT[k], src = A[k].scene || A[k];
  const obj = new THREE.Group(), lean = new THREE.Group(), m = src.clone(true); obj.add(lean); lean.add(m); lean.add(rider(f, rnd)); obj.userData.src = k; obj.userData.moto = true;
  const wheels = [], lamps = [];
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } if (/^wheel_/.test(o.name)) wheels.push(o);
    const lk = LK.exec(o.name); if (o.isMesh && lk) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(lk[1] === 'head' ? 0xfff1d0 : 0xff2a1a); o.material.toneMapped = false; o.userData.lk = lk[1]; lamps.push(o); if (lk[1] === 'tail') o.userData.lamp = 'rear'; } });   /* car-lights2: и възлите lamp_head_C / lamp_tail_C (-58) */
  // колелата по изминатото, наклонът в завоя (по скоростта на завъртане), светлините нощем — веднъж на кадър от първата част
  let px = null, pz = 0, pyaw = 0, pt = 0, L = 0;
  const tick = () => { const now = performance.now(), dt = Math.min(0.1, (now - pt) / 1000 || 0); pt = now; const x = obj.position.x, z = obj.position.z, yaw = obj.rotation.y;
    if (px !== null && dt > 0) { const d = Math.hypot(x - px, z - pz); for (const w of wheels) w.rotation.x += d / 0.3; let dy = yaw - pyaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const want = Math.max(-0.45, Math.min(0.45, -(dy / dt) * (d / dt) / 9.8)); L += (want - L) * Math.min(1, dt * 4); lean.rotation.z = L; }
    px = x; pz = z; pyaw = yaw; const n = night(); for (const l of lamps) l.material.emissiveIntensity = l.userData.lk === 'head' ? 0.4 + 2.6 * n : 0.6 + 1.8 * n; };
  const first = lean.children[1].children[0]; if (first) first.onBeforeRender = tick;
  return { obj, len: f.len + 0.4, w: f.w, h: 1.5, kind: 'car', moto: true };
}
