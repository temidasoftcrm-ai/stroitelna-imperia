// aircity.js — ✈️ air-approach + 🚁 police-heli (f9): небето над града.
// Самолети на снижение: ако градът има летище — опашка от самолети по глисадата (3°) към пистата му, идват отдалеч с плавен завой
// и на 700 м от прага се „предават“ на кацащия самолет на летището (airport.js, същото място, посока и цикъл T); без летище —
// от време на време самолет минава високо над града, снижавайки се към далечно летище. Нощем — фарове и навигационни светлини.
// Полицейски хеликоптер: щом в града има инцидент (incidents.js) — долита отдалеч, кръжи над мястото (при гонка — следва колата),
// нощем свети с прожектор към земята; червено-сини маяци; когато инцидентът свърши — отлита и изчезва.
// const a = createAirCity({ parent, airport() → Group | null, center() → [x, z], night() → 0…1, simT() → s, plane(kind, livery),
//   target() → { x, z } | null, load(url) → Promise<gltf>, approach() → bool, heli() → bool });  a.update(dt); a.clear()
import * as THREE from 'three';

const T = 70, V = 34, SLOPE = 0.075, D0 = 1300, RT = 700, HAND = { x: 46, z: 110 + 700, y: 90 };   // цикълът и мястото на предаване — като LAND в airport.js
const HELI = 'assets/heavy/ops/heli.glb';
let glowTex = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); return glowTex;
}
const sprite = (col, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); m.scale.set(s, s, 1); return m; };
function fit(o, len) {   // най-дългата хоризонтална страна → len; носът по −z (както в opsfire)
  o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const inner = new THREE.Group(); o.position.set(-c.x, -b.min.y, -c.z); inner.add(o); inner.scale.setScalar(len / Math.max(s.x, s.z)); if (s.x > s.z) inner.rotation.y = Math.PI / 2;
  const hold = new THREE.Group(); hold.add(inner); return hold;
}
const hash = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

export function createAirCity(deps) {
  let G = null, planes = [], key = null, H = null, heliLoading = false, skipIn = false;   // skipIn — Лабораторията: направо в кръжене
  // ---- самолетите
  function ensure() {
    const ap = deps.airport(), k = ap ? 'ap' : 'over';
    if (G && G.parent && key === k) return;
    dropPlanes(); key = k; G = new THREE.Group(); G.name = 'air-approach'; deps.parent().add(G);
    const kinds = ap ? [['a320', 2], ['a320', 0], ['regional', 1]] : [['wide', 3]];
    planes = kinds.map(([kd, lv]) => { const p = deps.plane(kd, lv);
      p.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.fog = false; } });   // далече е — без мъглата на града (иначе денем се слива с небето); копия, за да не пипаме самолетите на летището
      const land = sprite(0xfff4d8, 9); land.position.set(0, -0.6, (p.userData.len || 26) * 0.56); p.add(land); p.userData.landL = land; G.add(p); return p; });
  }
  function dropPlanes() { if (G) { G.parent && G.parent.remove(G); } G = null; planes = []; key = null; }
  // по глисадата: d — разстояние (по пътя) до точката на предаване; отвъд D0 пътят завива по дъга RT (подход от страната), после — прав
  // (видимата далечина в шаблонните градове е ~900 м, затова глисадата е по-стръмна и по-къса от истинската)
  function along(ap, d, side) {
    const o = ap.position, s = d - D0, q = Math.PI / 2 * RT; let x = 0, z = d;
    if (s > 0) { if (s < q) { const a = s / RT; x = side * RT * (1 - Math.cos(a)); z = D0 + RT * Math.sin(a); } else { x = side * (RT + s - q); z = D0 + RT; } }
    return [o.x + HAND.x + x, HAND.y + d * SLOPE, o.z + HAND.z + z];
  }
  function updPlanes(t, night) {
    const ap = deps.airport(), blink = Math.sin(t * 4) > 0.6 ? 1 : 0;
    if (ap) {
      const u = t % T, side = hash(Math.round(ap.position.x)) % 2 ? 1 : -1;
      planes.forEach((p, j) => {
        const d = (T - u) * V + j * T * V; if (j === 0 && T - u < 0.05) { p.visible = false; return; } p.visible = true;
        const a = along(ap, d, side), b = along(ap, d - 4, side); p.position.set(...a);
        const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]), bank = d > D0 && d < D0 + Math.PI / 2 * RT ? -side * 0.3 : 0;
        p.rotation.set(0, 0, 0); p.rotateY(yaw); p.rotateZ(bank); p.rotateX(0.05);
        lights(p, night, blink, true);
      });
    } else {   // без летище: самолет високо над града, снижава се към далечно летище (по един на 75 s)
      const [cx, cz] = deps.center(), a0 = (hash(Math.round(cx) + ':' + Math.round(cz)) % 628) / 100, u = (t % 75) / 75, s = -1800 + 3600 * u, p = planes[0];
      p.visible = u < 0.98; p.position.set(cx + Math.sin(a0) * s + Math.cos(a0) * 200, 420 - 170 * u, cz + Math.cos(a0) * s - Math.sin(a0) * 200);
      p.rotation.set(0, 0, 0); p.rotateY(a0); p.rotateX(0.03); lights(p, night, blink, true);
    }
  }
  function lights(p, night, blink, landOn) {
    for (const n of p.userData.nav || []) n.material.emissiveIntensity = 0.3 + night * (0.6 + blink * 1.5);
    const L = p.userData.landL; L.material.opacity = landOn ? 0.15 + 0.85 * night : 0; const s = 9 + 14 * night; L.scale.set(s, s, 1);
  }
  // ---- хеликоптерът
  function heliMake() {
    if (heliLoading || H) return; heliLoading = true;
    deps.load(HELI).then(gl => {
      const v = fit(gl.scene.clone(true), 11), rot = [];
      v.traverse(q => { if (q.isMesh) { q.castShadow = true; q.material = q.material.clone(); if (/cabine/.test(q.name)) { q.material.map = null; q.material.color.setHex(0x24489c); } }   /* кабината — полицейско синьо (моделът е червен) */ if (/rotor_pales|moyeu/.test(q.name)) rot.push([q, 'y']); else if (/rotor_anticouple/.test(q.name)) rot.push([q, 'x']); });
      const red = sprite(0xff2a2a, 3.2), blue = sprite(0x2a5bff, 3.2); red.position.set(-1, 0.3, 0); blue.position.set(1, 0.3, 0); v.add(red, blue);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 7, 1, 20, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glow(), color: 0xfff1cc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      cone.frustumCulled = pool.frustumCulled = false;
      H = { v, rot, red, blue, cone, pool, st: 'off', x: 0, y: 0, z: 0, ang: 0, hdg: 0, out: [1, 0], t: 0 }; heliLoading = false;
    }).catch(e => { heliLoading = false; console.warn('police-heli', e); });
  }
  function heliShow(on) { const p = deps.parent(); for (const o of [H.v, H.cone, H.pool]) { if (on && o.parent !== p) p.add(o); if (!on && o.parent) o.parent.remove(o); } }
  function updHeli(dt, t, night) {
    const tg = deps.heli() ? deps.target() : null;
    if (tg && !H) { heliMake(); return; } if (!H) return;
    if (tg && (H.st === 'off' || H.st === 'out')) {
      if (H.st === 'off') { const a = Math.random() * 6.28; H.out = [Math.sin(a), Math.cos(a)]; H.x = tg.x + H.out[0] * 700; H.z = tg.z + H.out[1] * 700; H.y = 120; H.ang = a; }
      H.st = 'in'; heliShow(true); if (skipIn) { skipIn = false; H.tx = tg.x; H.tz = tg.z; H.x = tg.x + Math.sin(H.ang) * 46; H.z = tg.z + Math.cos(H.ang) * 46; H.y = 55; H.st = 'orbit'; }
    }
    if (!tg && (H.st === 'in' || H.st === 'orbit')) { H.st = 'out'; const l = Math.hypot(H.x - H.tx, H.z - H.tz) || 1; H.out = [(H.x - H.tx) / l, (H.z - H.tz) / l]; H.t = 0; }
    if (H.st === 'off') return;
    const px = H.x, pz = H.z; let bank = 0;
    if (tg) { H.tx = tg.x; H.tz = tg.z; }
    if (H.st === 'in') {
      const dx = H.tx - H.x, dz = H.tz - H.z, d = Math.hypot(dx, dz), sp = Math.min(42, d * 0.8) * dt;
      if (d > 48) { H.x += dx / d * sp; H.z += dz / d * sp; } else { H.st = 'orbit'; H.ang = Math.atan2(H.x - H.tx, H.z - H.tz); }
      H.y += (Math.max(58, Math.min(120, 58 + (d - 48) * 0.12)) - H.y) * Math.min(1, dt * 0.8);
    } else if (H.st === 'orbit') {
      H.ang += 0.38 * dt; const ox = H.tx + Math.sin(H.ang) * 46, oz = H.tz + Math.cos(H.ang) * 46, k = Math.min(1, dt * 1.5);
      H.x += (ox - H.x) * k; H.z += (oz - H.z) * k; H.y += (55 - H.y) * Math.min(1, dt * 0.6); bank = 0.2;
    } else {   // отлита навън и се издига
      H.t += dt; H.x += H.out[0] * 45 * dt; H.z += H.out[1] * 45 * dt; H.y += 6 * dt;
      if (H.t > 18) { H.st = 'off'; heliShow(false); return; }
    }
    const vx = H.x - px, vz = H.z - pz;
    if (Math.hypot(vx, vz) > 0.002) { let dh = Math.atan2(vx, vz) + Math.PI - H.hdg; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); H.hdg += dh * Math.min(1, dt * 3); }
    const v = H.v; v.position.set(H.x, H.y + Math.sin(t * 1.3) * 0.3, H.z); v.rotation.set(0, 0, 0); v.rotateY(H.hdg); v.rotateX(-0.08); v.rotateZ(H.st === 'orbit' ? -bank : 0);
    for (const [q, ax] of H.rot) q.rotation[ax] += dt * 40;
    const bl = Math.sin(t * 6) > 0; H.red.material.opacity = (0.35 + 0.65 * night) * (bl ? 1 : 0.1); H.blue.material.opacity = (0.35 + 0.65 * night) * (bl ? 0.1 : 1);
    // прожекторът: от корема към мястото (леко се люшка), светло петно на земята — само нощем и над мястото
    const lit = night > 0.2 && H.st !== 'out' && H.tx != null, gx = (H.tx ?? H.x) + Math.sin(t * 0.7) * 5, gz = (H.tz ?? H.z) + Math.cos(t * 0.9) * 5;
    H.cone.visible = H.pool.visible = lit;
    if (lit) {
      const from = new THREE.Vector3(H.x, H.y - 1, H.z), to = new THREE.Vector3(gx, 0.3, gz), L = from.distanceTo(to);
      H.cone.position.copy(from); H.cone.lookAt(to); H.cone.scale.set(1, 1, L); H.cone.material.opacity = 0.16 * night;
      H.pool.position.set(gx, 0.25, gz); H.pool.material.opacity = 0.75 * night;
    }
  }
  function update(dt) {
    const t = deps.simT(), night = deps.night();
    if (deps.approach()) { ensure(); updPlanes(t, night); } else if (G) dropPlanes();
    updHeli(Math.min(0.1, dt), t, night);
  }
  function clear() { dropPlanes(); if (H) { H.st = 'off'; heliShow(false); } }
  return { update, clear, heliNow() { skipIn = true; }, info: () => ({ planes: planes.map(p => p.visible ? p.position.toArray().map(Math.round) : null), heli: H && { st: H.st, at: [H.x, H.y, H.z].map(Math.round) } }) };
}
