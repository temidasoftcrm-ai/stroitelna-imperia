// awards3d.js — 🏆 стената с отличията в Директорската зала (флаг awards; _source/tasks/2026-10-21-awards-wall.md).
// Витрина вдясно, срещу масата (вижда се от мястото на играча): 2 рафта × 5 места. Получените — статуетка (моделът на потребителя от Meshy)
// в степента си: бронз → сребро → злато → платина (същият модел, друг оттенък); неполучените — празен пиедестал с дискретна табелка с условието.
// buildAwardsWall(scene, { x, z, ry }) → { group, hits, setState(state), reveal(k), infoAt(hitObj), update(dt, night), dispose }
//   state: { [k]: { tier: 'bronze'|'silver'|'gold'|'platinum', day, res } }
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { t as tr } from './i18n.js';   // 🌐 lang-en: надписите на платното (f9, част C)

const HV = 'assets/heavy/awards/';
// горният рафт — строителство и транспорт; долният — петрол, финанси, хотели, град + общото в средата
export const AWARDS = [
  { k: 'con', dir: 'con', who: 'Ивайло Петров', nm: 'Майстор на строителството', cond: 'изпълнена голяма строителна програма в срок', model: HV + 'award-ivaylo.glb', quote: 'Благодаря за доверието. Тази награда е и за бригадите, които изпълниха програмата.' },
  { k: 'hw', dir: 'hw', who: 'Надя Иванова', nm: 'Пътища към успеха', cond: 'завършен важен международен пътен коридор', model: HV + 'award-nadya.glb', quote: 'Пътищата свързват хората. Благодаря на екипите по трасетата — в жега и в сняг.' },
  { k: 'rail', dir: 'rail', who: 'Мария Стоянова', nm: 'Железопътна мощ', cond: 'завършена специална жп поръчка', model: HV + 'award-maria.glb', quote: 'Влаковете вървят по график, защото хората по линията не спят. Благодаря им.' },
  { k: 'sea', dir: 'sea', who: 'Стефан Колев', nm: 'Господар на океаните', cond: 'печеливша мрежа от морски маршрути', model: HV + 'award-stefan.glb', quote: 'Морето не прощава грешки. Благодаря на капитаните и на екипажите.' },
  { k: 'air', dir: 'air', who: 'Елена Димитрова', nm: 'Небето е наше', cond: 'всички отключени континенти свързани по въздух', model: HV + 'award-elena.glb', quote: 'Небето вече няма граници за нас. Благодаря на пилотите и на кулите.' },
  { k: 'oil', dir: 'oil', who: 'Вера Ангелова', nm: 'Черното злато', cond: 'верига добив → преработка → доставка', model: HV + 'award-vera.glb', quote: 'От кладенеца до пристанището — всяка брънка издържа. Благодаря на хората по веригата.' },
  { k: 'bank', dir: 'bank', who: 'Борис Тодоров', nm: 'Златен резерв', cond: 'месеци поред: касата над резерва и паричният поток на плюс (3 / 12 / 36 / 120)', model: HV + 'award-boris.glb', quote: 'Парите обичат тишината и реда. Благодаря на счетоводството — и на всички, които не харчиха излишно.' },
  { k: 'year', dir: '', who: 'Целият борд', nm: 'Борд на годината', cond: 'завършеният свят: 25 / 50 / 75 / 100% от градовете', wide: true, model: HV + 'award-year.glb', quote: 'Целият свят е построен. Това е заслуга на всички на тази маса — благодарим!' },
  { k: 'hotel', dir: 'hotel', who: 'Георги Николов', nm: 'Петзвездна империя', cond: 'хотели 5★ и Гранд по света (1 / 5 / 15 / 40)', model: HV + 'award-georgi.glb', quote: 'Гостът помни как се е чувствал. Благодаря на всеки рецепционист и камериерка по веригата.' },
  { k: 'city', dir: 'mayor', who: 'Десислава Илиева', nm: 'Град за хората', cond: 'Империал Сити: 6 месеца поред удовлетвореност ≥ 60 / 70 / 80 / 90% и баланс на плюс', model: HV + 'award-desislava.glb', quote: 'Градът е на хората, които живеят в него. Благодаря на общините, лекарите и учителите.' },
];
export const TIERS = {
  bronze: { nm: 'бронз', ico: '🥉', tint: 0xc07a3a, k: 1, rough: 0.42, metal: 0.95 },
  silver: { nm: 'сребро', ico: '🥈', tint: 0xd9dde3, k: 1, rough: 0.28, metal: 1 },
  gold: { nm: 'злато', ico: '🥇', tint: 0xffc93c, k: 0.85, rough: 0.25, metal: 1 },   // моделите от Meshy са по-скоро сребристи — златото се оцветява изрично
  platinum: { nm: 'платина', ico: '💠', tint: 0xeaf4ff, k: 1, rough: 0.12, metal: 1, glow: 0x9fd4ff },
};
export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];

const glbCache = {};
const loadG = url => glbCache[url] = glbCache[url] || new GLTFLoader().loadAsync(url).catch(() => null);
// оттенък на статуетката: оригиналните (златни) текстури → сиви × оттенъка (бронз, сребро, платина); златото — без промяна
function tintMat(m0, tier) {
  const T = TIERS[tier], m = m0.clone();
  if (T.rough != null) m.roughness = T.rough; if (T.metal != null) m.metalness = T.metal;
  if (T.glow) { m.emissive = new THREE.Color(T.glow); m.emissiveIntensity = 0.08; }
  const tint = new THREE.Color(T.tint);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTint = { value: tint }; sh.uniforms.uTintK = { value: T.k };
    sh.fragmentShader = 'uniform vec3 uTint; uniform float uTintK;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)); diffuseColor.rgb = mix(diffuseColor.rgb, clamp(vec3(l) * uTint * 1.55, 0.0, 1.0), uTintK); }`);
  };
  m.customProgramCacheKey = () => 'award-' + tier;
  return m;
}

// статуетката в степента: { group (основата на y = 0, височина h), dispose } — за рафта и за холограмата над масата
export async function makeTrophy(k, tier, h = 0.4) {
  const A = AWARDS.find(x => x.k === k); let obj = null;
  if (A && A.model) { const gl = await loadG(A.model); if (gl) { obj = gl.scene.clone(true); obj.traverse(o => { if (o.isMesh) { o.material = tintMat(o.material, tier); o.castShadow = true; } }); } }
  if (!obj) {   // модел още няма — скромна чаша в степента
    const m = new THREE.MeshStandardMaterial({ color: TIERS[tier].tint, metalness: 1, roughness: 0.3 });
    obj = new THREE.Group(); const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.03, 0.12, 20), m); cup.position.y = 0.16; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), m); st.position.y = 0.06; const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 20), m); bs.position.y = 0.01; obj.add(cup, st, bs);
  }
  const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const w = new THREE.Group(); obj.position.set(-c.x, -b.min.y, -c.z); w.add(obj); w.scale.setScalar(h / Math.max(1e-6, sz.y)); w.userData.foot = Math.max(sz.x, sz.z) / sz.y;
  return { group: w, dispose: () => w.traverse(o => { if (o.material) o.material.dispose(); if (o.geometry && !A?.model) o.geometry.dispose(); }) };
}

function plaqueTex(lines, on) {
  lines = lines.map(l => tr(l));
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, on ? '#d9b45a' : '#3a352c'); gr.addColorStop(1, on ? '#8a6a24' : '#24211c'); g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = on ? '#fff2c0' : '#5a5246'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116);
  g.textAlign = 'center'; g.fillStyle = on ? '#1c1408' : '#a89e8c';
  g.font = `bold ${on ? 38 : 30}px Georgia, serif`; g.fillText(lines[0], 256, 52, 480);
  g.font = `${on ? 28 : 24}px Georgia, serif`; g.fillText(lines[1] || '', 256, 98, 480);
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildAwardsWall(scene, { x = 4.95, z = -3.2, ry = -Math.PI / 2, W = 2.7, H = 2.15, TH = 0.36 } = {}) {
  const own = [], M = o => { own.push(o); return o; };
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const D = 0.42 * Math.max(1, W / 2.7), SH = [0.5 + (H - 0.5) * 0.24, 0.5 + (H - 0.5) * 0.62], N = 5, step = W / N;   // рафтовете — по височината на шкафа
  const walnut = M(new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.45, metalness: 0.05 })), goldTrim = M(new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 1, roughness: 0.3 }));
  const glass = M(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false }));
  const velvet = M(new THREE.MeshStandardMaterial({ color: 0x1d2a4a, roughness: 0.9 }));
  const box = (w, h, d, m, px, py, pz) => { const q = new THREE.Mesh(M(new THREE.BoxGeometry(w, h, d)), m); q.position.set(px, py, pz); q.castShadow = q.receiveShadow = true; q.userData.keep = true; g.add(q); return q; };
  // корпус: гръб от орех с кадифе, страници, цокъл, корниз, златни кантове; стъклени рафтове
  box(W + 0.12, H, 0.04, walnut, 0, H / 2, -D / 2);
  box(W - 0.06, H - 0.5, 0.01, velvet, 0, (H + 0.3) / 2, -D / 2 + 0.03);
  for (const s of [-1, 1]) box(0.06, H, D, walnut, s * (W / 2 + 0.03), H / 2, 0);
  box(W + 0.18, 0.5, D + 0.04, walnut, 0, 0.25, 0); box(W + 0.24, 0.08, D + 0.1, walnut, 0, H + 0.04, 0);
  for (const y of [0.5, H]) box(W + 0.2, 0.02, 0.02, goldTrim, 0, y, D / 2 + 0.02);
  for (const y of SH) { const sh = box(W - 0.02, 0.025, D - 0.04, glass, 0, y, 0); sh.castShadow = false; box(W - 0.02, 0.012, 0.012, goldTrim, 0, y + 0.012, D / 2 - 0.03); }
  const title = new THREE.Mesh(M(new THREE.PlaneGeometry(1.4 * W / 2.7, 0.18 * W / 2.7)), M(new THREE.MeshBasicMaterial({ map: M(plaqueTex(['🏆 СТЕНА НА ПОСТИЖЕНИЯТА', ''], true)), toneMapped: false })));
  title.position.set(0, H - 0.12, -D / 2 + 0.04); g.add(title);
  const lamps = SH.map(y => { const L = new THREE.PointLight(0xffe2a8, 0.9, 2.6, 1.6); L.position.set(0, y + 0.55, 0.2); g.add(L); return L; });
  // местата
  const places = AWARDS.map((A, i) => {
    const row = i < N ? 1 : 0, col = i % N, px = -W / 2 + step * (col + 0.5), py = SH[row] + 0.013;
    const pr = TH / 0.36, ped = new THREE.Mesh(M(new THREE.CylinderGeometry((A.wide ? 0.16 : 0.11) * pr, (A.wide ? 0.18 : 0.13) * pr, 0.05, 28)), walnut); ped.position.set(px, py + 0.025, 0); ped.userData.keep = true; g.add(ped);
    const pl = new THREE.Mesh(M(new THREE.PlaneGeometry(step * 0.9, step * 0.9 / 4)), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 })); pl.position.set(px, py - 0.07, D / 2 + 0.002); pl.rotation.x = -0.05; g.add(pl);
    const hit = new THREE.Mesh(M(new THREE.BoxGeometry(step * 0.9, TH * 1.4, D)), M(new THREE.MeshBasicMaterial({ visible: false }))); hit.position.set(px, py + TH * 0.7, 0); hit.userData.award = A.k; g.add(hit);
    const halo = new THREE.Mesh(M(new THREE.CircleGeometry(0.16 * TH / 0.36, 24)), M(new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    halo.rotation.x = -Math.PI / 2; halo.position.set(px, py + 0.052, 0); g.add(halo);
    return { A, px, py, ped, pl, hit, halo, trophy: null, tier: null, pop: 1 };
  });
  let state = {}, t = 0;
  function setPlaque(p) {
    const s = state[p.A.k], T = s && TIERS[s.tier];
    if (p.pl.material.map) p.pl.material.map.dispose();
    p.pl.material.map = plaqueTex(s ? [`${p.A.nm}`, `${p.A.who} · ${T.ico} ${T.nm}`] : [`🔒 ${p.A.nm}`, p.A.cond], !!s); p.pl.material.needsUpdate = true;
  }
  async function placeTrophy(p) {
    const s0 = state[p.A.k];
    if (p.trophy && (!s0 || s0.tier !== p.tier)) { g.remove(p.trophy.group); p.trophy.dispose(); p.trophy = null; }
    p.tier = s0 ? s0.tier : null; if (!s0 || p.trophy) return;
    const t = await makeTrophy(p.A.k, s0.tier, p.A.wide ? TH * 1.15 : TH);
    if (state[p.A.k] !== s0 || p.trophy) { t.dispose(); return; }   // докато се зареждаше, степента се смени
    const w = t.group; if (w.userData.foot * TH > step * 0.8) w.scale.multiplyScalar(step * 0.8 / (w.userData.foot * TH));
    w.position.set(p.px, p.py + 0.05, 0); g.add(w); p.trophy = t; t.s0 = w.scale.x;
  }
  // невидима мишена върху целия шкаф — клик → камерата показва само витрината
  const cab = new THREE.Mesh(M(new THREE.BoxGeometry(W + 0.2, H + 0.1, D + 0.1)), M(new THREE.MeshBasicMaterial({ visible: false }))); cab.position.set(0, H / 2, 0); cab.userData.cabinet = true; g.add(cab);
  return {
    group: g, hits: places.map(p => p.hit), cab,
    // кадърът за камерата: витрината в цял ръст (позиция, цел) в световни координати
    frame(aspect = 1.6, fov = 45) { const hv = Math.tan(fov * Math.PI / 360), dist = Math.max((H / 2 + 0.25) / hv, (W / 2 + 0.35) / (hv * aspect)); const t = new THREE.Vector3(0, H / 2, 0), p = new THREE.Vector3(0, H / 2 + 0.05, D / 2 + dist); g.localToWorld(t); g.localToWorld(p); return { p, t }; },
    slot(k) { const p = places.find(q => q.A.k === k); if (!p) return null; const v = new THREE.Vector3(p.px, p.py + 0.05, 0); g.localToWorld(v); return { pos: v, h: p.A.wide ? TH * 1.15 : TH }; },
    setState(s) { state = { ...(s || {}) }; for (const p of places) { setPlaque(p); placeTrophy(p); } },
    // церемонията: статуетката „изниква“ със сияние
    reveal(k) { const p = places.find(q => q.A.k === k); if (p) { p.pop = 0; placeTrophy(p); } },
    infoAt(obj) { const p = places.find(q => q.hit === obj); if (!p) return null; const s = state[p.A.k]; return { A: p.A, s, T: s && TIERS[s.tier] }; },
    focus(k) { const p = places.find(q => q.A.k === k); if (!p) return null; const v = new THREE.Vector3(p.px, p.py + 0.2, 0); g.localToWorld(v); return v; },
    update(dt, night = 0) {
      t += dt;
      for (const p of places) {
        if (p.pop < 1) p.pop = Math.min(1, p.pop + dt / 1.6);
        const e = p.pop < 1 ? 1 - Math.pow(1 - p.pop, 3) : 1;
        if (p.trophy) { const w = p.trophy.group; w.rotation.y = Math.sin(t * 0.4 + p.px) * 0.25; w.scale.setScalar(p.trophy.s0 * (0.2 + 0.8 * e)); }
        p.halo.material.opacity = p.trophy ? (0.18 + 0.1 * Math.sin(t * 2 + p.px * 3)) * (p.pop < 1 ? 2.5 : 1) + night * 0.1 : 0;
      }
      for (const L of lamps) L.intensity = 0.8 + night * 0.6;
    },
    dispose() { scene.remove(g); g.traverse(o => { if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); for (const x of own) x.dispose && x.dispose(); },
  };
}
