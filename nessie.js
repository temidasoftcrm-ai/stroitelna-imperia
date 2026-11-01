// nessie.js — 🐉 скрита изненада „Лох Нес“ (feature 'nessie'; одобрено в Blender, 01.11: „ок е, само сложи още 1–2 вълни“).
// Морският дракон (Meshy AI, Темидасофт) рядко надига глава във водата до града — в крайморските градове на Северна Европа
// (Лондон по Темза, Амстердам, Ротердам, Хамбург, Копенхаген, Осло, Стокхолм, Хелзинки, Дъблин…) и само в мъгла или облачно,
// рано сутрин (5–10 ч). Последователност (~15 s): кръгове по водата → главата се надига → оглежда се → гмурка се; остават кръговете.
// Първият път — съобщение „🐉 Видяхте ли това?!“ и постижение (S.nessie). Камерата не се мести — хваща се случайно.
// deps: { scene, S(), cityId(), water(x, z) → bool, center() → [x, z], hour() 0..24, fog() → bool, toast(msg, kind), pop(key, cap, sub), save() }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const NESSIE_CITIES = new Set(['london', 'amsterdam', 'rotterdam', 'hamburg', 'copenhagen', 'oslo', 'stockholm', 'helsinki', 'dublin', 'edinburgh', 'glasgow', 'liverpool', 'bergen', 'gdansk', 'riga', 'tallinn', 'stpetersburg']);
const H = 18, DUR = 15;   // м — височината на дракона; s — колко трае появата

export function createNessie(deps) {
  let proto = null, loading = null, cur = null, cool = 40 + Math.random() * 60;
  const load = () => loading || (loading = new Promise(res => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load('assets/heavy/nessie/nessie.glb', g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.material) o.material.roughness = 0.35; } }); proto = g.scene; res(proto); }, undefined, () => res(null)); }));
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xdfe8ea, transparent: true, opacity: 0, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2);
  // кръговете: [начало s, край s, краен радиус м]
  const RINGS = [[1.6, 6.0, 7], [2.9, 11.3, 34], [4.2, 12.5, 32], [6.4, 15, 40], [12.1, 15, 18]];
  function spot() {   // вода на 120–420 м от центъра, далеч от брега (и на 25 м около нея — вода)
    const [cx, cz] = deps.center(); for (let k = 0; k < 600; k++) { const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * (k < 300 ? 600 : 1800), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if ([[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]].every(([dx, dz]) => deps.water(x + dx, z + dz))) return [x, z]; } return null; }
  function start(force = false) {
    if (cur || !proto) return false; const p = spot(); if (!p) return false;
    const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = Math.random() * Math.PI * 2;
    const n = proto.clone(true); n.scale.setScalar(H); const pivot = new THREE.Group(); pivot.add(n); g.add(pivot);
    const rings = RINGS.map(() => { const m = new THREE.Mesh(ringGeo, ringMat.clone()); m.position.y = 0.05; m.renderOrder = 2; g.add(m); return m; });
    deps.scene.add(g); cur = { g, pivot, n, rings, t: 0, force };
    const s = deps.S(); if (s && !s.nessie) { s.nessie = { day: s.day || 1, city: deps.cityId() }; deps.pop && deps.pop('nessie', '🐉 Видяхте ли това?!', 'Нещо огромно се показа от водата… и изчезна. Постижение: „Лох Нес“.'); deps.save && deps.save(); }
    else deps.toast && deps.toast('🐉 Нещо голямо се мярна във водата…', 'good');
    return true;
  }
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  function update(dt) {
    if (!cur) {
      if (!NESSIE_CITIES.has(deps.cityId()) || dt <= 0) return;
      const h = deps.hour(); if (!(h >= 5 && h < 10 && deps.fog())) return;
      cool -= dt; if (cool > 0) return; cool = 180 + Math.random() * 240;
      if (Math.random() < 0.35) load().then(() => start());
      return;
    }
    const c = cur; c.t += dt; const t = c.t;
    // височина: под водата → надига се (4–8 s) → оглежда се → гмурка се (12,5–13,5 s)
    const up = ease((t - 3.5) / 3.5), down = ease((t - 12.4) / 1.6), y = -H * 1.1 + (H * 0.78) * up - (H * 0.9) * down;
    c.pivot.position.y = y; c.pivot.rotation.y = t < 6 ? -0.17 : t < 8.5 ? -0.17 + 0.6 * ease((t - 6) / 2) : t < 11 ? 0.43 - 1.04 * ease((t - 8.5) / 2.5) : -0.61 + 0.61 * ease((t - 11) / 1.4);
    c.pivot.rotation.x = -0.45 * down; c.pivot.position.z = 6 * down;
    c.n.rotation.z = 0.04 * Math.sin(t * 1.7);   // лекото вълнение на тялото
    RINGS.forEach(([a, b, R], i) => { const m = c.rings[i], f = (t - a) / (b - a); m.visible = f > 0 && f < 1; if (!m.visible) return; const r = 0.5 + R * Math.sqrt(f); m.scale.set(r, 1, r); m.material.opacity = 0.75 * (1 - f) * Math.min(1, f * 6); });
    if (t > DUR) stop();
  }
  function stop() { if (!cur) return; deps.scene.remove(cur.g); cur.rings.forEach(m => m.material.dispose()); cur = null; }
  return { update, stop, last: () => cur && cur.g.position, test: () => load().then(() => start(true)), get busy() { return !!cur; } };
}
