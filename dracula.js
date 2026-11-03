// dracula.js — 🦇 скрита изненада „Замъкът на Дракула“ (feature 'dracula'; потребителят, 03.11: „да“ на идеята; замъкът — Meshy на потребителя,
// боядисан и без птицата в Blender, нощната сцена — „да харесва ми ТОП е“). Клуж (Трансилвания): на най-далечния парк — замък на скала
// (assets/heavy/lm/dracula-castle.glb: castle — цветовете по върховете; Candle — прозорецът на кулата; BatTop — върхът на кулата). Денем — забележителност.
// Нощем при пълнолуние (и винаги в нощта на 31 октомври), рядко: ~35 s — ято прилепи излита от кулата и кръжи, свещта трепти, в прозореца се мярка
// силует с наметало, вой на вълци; после прилепите се прибират. Първия път — „🦇 Видяхте ли това?!“ и постижение (S.dracula). Романът на Брам Стокър (1897) — обществено достояние.
// deps: { group() → city.group, plan() → city.plan, cityId(), S(), hour(), night(), moon() → 0…1 (0,5 пълнолуние), Sound?, toast, pop, save, add(o, nm) }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const DRACULA_CITY = 'cluj';
const NB = 60, DUR = 36;
let proto = null, loading = null;
const load = () => loading || (loading = new Promise(res => new GLTFLoader().load('assets/heavy/lm/dracula-castle.glb', g => { g.scene.traverse(m => { const c = m.isMesh && m.geometry.attributes.color; if (c) { for (let i = 0; i < c.array.length; i++) if ((i % c.itemSize) < 3) c.array[i] = Math.pow(c.array[i], 1 / 2.2); c.needsUpdate = true; } });   /* цветовете в Blender са „двойно линейни“ — връщаме ги */
  proto = g.scene; res(proto); }, undefined, () => res(null))));

export function createDracula(deps) {
  let castle = null, cur = null, cool = 30 + Math.random() * 60, placedFor = null;
  // ── замъкът: на парка (P.bigs 'park') най-далеч от площада — „на хълма в края на града“ ──
  async function place() {
    const id = deps.cityId(); if (id !== DRACULA_CITY) { castle = null; placedFor = null; return; }
    const G = deps.group(), P = deps.plan(); if (!G || !P || placedFor === G) return; placedFor = G;
    await load(); if (!proto || deps.group() !== G) return;
    const sq = P.square || { x: 0, z: 0 }, parks = (P.bigs || []).filter(b => b.kind === 'park' && Math.min(b.w, b.d) >= 40);   /* само паркове (на „special“ има статуи/сгради) */
    const far = parks.sort((a, b) => Math.hypot(b.x - sq.x, b.z - sq.z) - Math.hypot(a.x - sq.x, a.z - sq.z)).slice(0, 4), B = far.sort((a, b) => Math.min(b.w, b.d) - Math.min(a.w, a.d))[0];   // от 4-те най-далечни — най-големият
    const o = proto.clone(true), g = new THREE.Group(); g.add(o);
    const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()), foot = B ? Math.min(B.w, B.d) * 0.8 : 60, k = Math.min(1, foot / Math.max(sz.x, sz.z));
    o.scale.multiplyScalar(k); o.position.y -= bb.min.y * k;
    if (B) { g.position.set(B.x, 0, B.z); g.rotation.y = Math.atan2(sq.x - B.x, sq.z - B.z) + Math.PI * 0.15; } else g.position.set(sq.x + 260, 0, sq.z + 260);   // лицето — към града
    const parts = { candle: null, top: new THREE.Vector3(), mats: [] };
    o.traverse(m => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; m.material = m.material.clone();
      if (m.name === 'Candle' || (m.material.name || '') === 'candle') { m.material = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0 }); parts.candle = m; }
      else { m.material.vertexColors = true; m.material.emissive = new THREE.Color(0xffc890); m.material.emissiveIntensity = 0; parts.mats.push(m.material); } } });
    const bt = o.getObjectByName('BatTop'); g.updateMatrixWorld(true); if (bt) bt.getWorldPosition(parts.top); else parts.top.set(g.position.x, sz.y * k, g.position.z);
    const lamp = new THREE.PointLight(0xffb070, 0, sz.y * k * 2.2, 1.2); lamp.position.set(0, sz.y * k * 0.62, sz.y * k * 0.75); g.add(lamp); parts.lamp = lamp;   // прожекторът отдолу-отпред
    parts.h = sz.y * k;
    parts.R = Math.max(sz.x, sz.z) * k * 0.55;     g.userData.dracula = parts; castle = g; clearUnder(); deps.add({ group: g, kind: 'dracula', update() {} }, 'Замъкът на Дракула');
  }
  function clearUnder() {   // декорът на парка под скалата (статуи, фонтани, пейки) — скрит; и по-късно (статуите идват след замъка)
    if (!castle) return; const G = deps.group(), R = castle.userData.dracula.R, bx = new THREE.Box3(), cc = new THREE.Vector3(), szv = new THREE.Vector3();
    const walk = (list, d) => { for (const ch of list) { if (ch === castle || !ch.visible || ch.isInstancedMesh || ch.isSprite || ch.isLight) continue; bx.setFromObject(ch); if (bx.isEmpty()) continue; bx.getCenter(cc); bx.getSize(szv);
      const near = Math.hypot(cc.x - castle.position.x, cc.z - castle.position.z) < R, small = Math.max(szv.x, szv.z) < R * 1.2;
      if (near && small && bx.max.y > 0.6) ch.visible = false; else if (!small && d < 3 && ch.children.length) walk(ch.children, d + 1); } };   // в групите (паркът — статуя, фонтан) — до 3 нива
    walk(G.children, 0);
  }
  let clrT = 0;
  // ── прилепите: едно InstancedMesh, крилата махат (мащаб по y на крилата) ──
  function bats() {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -1, 0.15, 0, -0.5, 0, -0.2, 0, 0, -0.3, 0, 0, 0.25, 0, 0, -0.3, 0.5, 0, -0.2, 1, 0.15, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x0c080e, side: THREE.DoubleSide }), NB); im.frustumCulled = false;
    const B = []; const Hc = (castle && castle.userData.dracula.h) || 40; for (let i = 0; i < NB; i++) B.push({ r: Hc * (0.45 + Math.random() * 1.0), h: Math.random(), ph: Math.random() * 6.28, sp: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.7), s: Hc * (0.05 + Math.random() * 0.03), d: Math.random() * 3 });   // по ръста на замъка (размах ~3–5 м при 40 м)
    return { im, B };
  }
  function start(force = false) {
    if (cur || !castle) return false; const P = castle.userData.dracula, b = bats(); deps.group().add(b.im);
    cur = { ...b, P, t: 0, sil: null, force };
    const S = deps.S(); if (S && !S.dracula) { S.dracula = { day: S.day || 1 }; deps.pop && deps.pop('dracula', '🦇 Видяхте ли това?!', 'Над замъка в Трансилвания излетя ято прилепи… и в прозореца нещо се мярна. Постижение: „Нощ в Трансилвания“.'); deps.save && deps.save(); }
    else deps.toast && deps.toast('🦇 Прилепи над замъка…', 'good');
    howl(0.5); howl(9); return true;
  }
  function howl(at) { const Sd = deps.Sound; if (!Sd || !Sd.ctx || Sd.muted || !Sd.tone) return; try { Sd.tone(330, 1.4, 0.045, 'sine', 520, at); Sd.tone(520, 2.2, 0.04, 'sine', 300, at + 1.4); Sd.tone(335, 1.4, 0.02, 'triangle', 525, at + 0.05); } catch (e) { } }
  const M = new THREE.Matrix4(), E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function update(dt, live = true) {
    if (deps.cityId() === DRACULA_CITY && placedFor !== deps.group()) place();
    if (!castle) return; const n = deps.night ? deps.night() : 0, P = castle.userData.dracula; if ((clrT -= dt) <= 0) { clrT = 5; clearUnder(); }
    for (const m of P.mats) m.emissiveIntensity = 0; if (P.lamp) P.lamp.intensity = 1.1 * n;   // нощем — топло осветен отдолу
    if (!cur) {
      if (P.candle) P.candle.material.opacity = n > 0.5 ? 0.35 : 0;
      if (!live || dt <= 0) return; cool -= dt; if (cool > 0) return; cool = 90 + Math.random() * 120;
      const d = new Date(), hw = d.getMonth() === 9 && d.getDate() === 31, ph = deps.moon ? deps.moon() : 0, full = Math.abs((ph % 1) - 0.5) < 0.07;
      if (n > 0.6 && (hw || (full && Math.random() < 0.4))) start();
      return;
    }
    const c = cur; c.t += dt; const t = c.t, tt = performance.now() / 1000, T = P.top;
    // излитане (0–4 s) · кръжене · прибиране (DUR−5…DUR)
    const out = Math.min(1, t / 4), back = Math.max(0, Math.min(1, (t - (DUR - 5)) / 5));
    c.B.forEach((b, i) => { const k = Math.max(0, Math.min(1, out * 1.4 - b.d * 0.1)) * (1 - back), a = b.ph + b.sp * t * 0.55, r = b.r * k;
      V.set(T.x + Math.cos(a) * r, T.y - P.h * 0.12 + (P.h * 0.1 + b.h * P.h * 0.8 + P.h * 0.04 * Math.sin(tt * 1.3 + i)) * k, T.z + Math.sin(a) * r * 0.85);
      Q.setFromEuler(E.set(0.35 * Math.sin(tt * 2 + i), -a + (b.sp > 0 ? Math.PI : 0), 0.55 * (b.sp > 0 ? 1 : -1), 'YXZ'));   /* наклонени в завоя — не „на ръб“ към камерата */ const f = Math.sin(tt * 14 + i * 1.7); SC.set(b.s * k + 0.01, b.s * (0.3 + 0.9 * Math.abs(f)) * k + 0.01, b.s * k + 0.01);
      M.compose(V, Q, SC); c.im.setMatrixAt(i, M); }); c.im.instanceMatrix.needsUpdate = true;
    if (P.candle) { const fl = 0.55 + 0.25 * Math.sin(tt * 9) * Math.sin(tt * 3.7), sil = t > 12 && t < 20 && Math.sin((t - 12) * 0.4) > 0; P.candle.material.opacity = sil ? 0.25 : fl; }   // силуетът „закрива“ свещта
    if (t > DUR) stop();
  }
  function stop() { if (!cur) return; cur.im.removeFromParent(); cur.im.geometry.dispose(); cur.im.material.dispose(); cur = null; }
  return { update, stop, test: async () => { await place(); stop(); return start(true); }, get busy() { return !!cur; }, castle: () => castle };
}
