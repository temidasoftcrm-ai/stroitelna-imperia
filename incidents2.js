// incidents2.js — 🚨 инцидентите като истински (Лабораторията → incidents2): истински хора вместо цветните капсули — минувачи (Mixamo,
// с анимации: оглеждат се, говорят по телефона, махат), полицаи, пожарникари, парамедици; зяпачите — зад лентата; кордон (стълбчета,
// раирана лента, конуси през платната); водна струя на пожарникарите; пътната помощ натоварва останките; истински мотор.
// Моделите се зареждат веднъж (loadInc2); анимациите вървят само близо до камерата и по игровото време.
// Кредити: assets/heavy/CREDITS.txt (inc/), assets/heavy/people/peds/CREDITS.txt, assets/heavy/riot, assets/heavy/ops.
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { feature } from './lab/feature.js';
// 🚚 tow-trucks (T1): влекачите на потребителя (Meshy AI, Темидасофт) — лекият (пикап със стрела) в града, тежкият (3 оси, стрела) на магистралата;
// в Blender: колелата (wheel_*), стрелата (boom, шарнир в основата), бурканите (beacon_*) и фаровете — отделни; тук: колелата се въртят по пътя,
// бурканите мигат, стрелата се вдига, щом нещо е закачено. Предницата — към +z.
const TOW2 = feature('tow-trucks');

const H = new URL('./assets/heavy/', import.meta.url).href,   /* от модула — и от Лабораторията (lab/) */ PEDS = ['adam', 'brian', 'steve', 'elizabeth', 'kate', 'louise'].map(k => `${H}people/peds/ped-${k}.glb`);
const FILES = [`${H}people/peds/peds-anims.glb`, `${H}riot/riot-cop.glb`, `${H}ops/firefighter.glb`, `${H}inc/paramedic.glb`, `${H}inc/moto.glb`, `${H}inc/towtruck.glb`];
const NEAR = 180;   // м — по-далеч анимациите на хората спират
let lib = null;
export function loadInc2() {
  if (lib) return lib; const L = new GLTFLoader(), ld = u => L.loadAsync(u).catch(e => { console.warn('incidents2', u, e); return null; });
  return lib = Promise.all([...PEDS.map(ld), ...FILES.map(ld), ...(TOW2 ? [ld(`${H}inc/tow-light.glb`), ld(`${H}inc/tow-heavy.glb`)] : [])]).then(gs => {
    const peds = gs.slice(0, PEDS.length).filter(Boolean), [an, cop, ff, medic, moto, tow, towL, towH] = gs.slice(PEDS.length), clips = {};
    for (const g of peds) { g.scene.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g.scene, true); g.k = 1.75 / ((b.max.y - b.min.y) || 1); for (const c of g.animations) clips[c.name] = clips[c.name] || c; }
    if (an) for (const c of an.animations) clips[c.name] = c;
    for (const g of [cop, ff, medic, moto, tow, towL, towH]) if (g) g.scene.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    for (const g of [towL, towH]) if (g) g.scene.traverse(m => { if (m.isMesh && m.material) { m.material.metalness = Math.min(m.material.metalness ?? 0, 0.3); if (/^beacon|^lamp/.test(m.name)) m.castShadow = false; } });   // tow-trucks: металността 1 без огледална среда — черно
    return { peds, clips, cop, ff, medic, moto, tow, towL, towH };
  });
}
// размерите само по непрозрачните части (без лъчите на фаровете)
export function bodyBox(o) { o.updateMatrixWorld(true); const b = new THREE.Box3(); o.traverse(m => { if (m.isMesh && !m.isSprite && !(m.material && m.material.transparent)) b.expandByObject(m); }); return b.isEmpty() ? new THREE.Box3().setFromObject(o) : b; }
// обвивка: моделът центриран, основата на y = 0, дължината по +z (len — по най-дългата хоризонтала), предницата — yaw
function wrapTo(src, len, yaw = 0) { const o = src.clone(true), inner = new THREE.Group(); inner.add(o); inner.rotation.y = yaw; const w = new THREE.Group(); w.add(inner);
  const b = bodyBox(w), s = b.getSize(new THREE.Vector3()), k = len ? len / Math.max(s.x, s.z) : 1; inner.scale.setScalar(k); const b2 = bodyBox(w), c = b2.getCenter(new THREE.Vector3()); inner.position.set(-c.x, -b2.min.y, -c.z); return w; }

const TOWS = new Set();   // 🔊 sfx-batch2: пътната помощ на сцената (за лебедката)
export const towsLive = () => { for (const w of TOWS) if (!w.parent) TOWS.delete(w); return [...TOWS]; };
export function createInc2Kit(L) {
  const people = [], streams = [], rot = new Map(), V = new THREE.Vector3();
  const bones = {}, boneSet = k => bones[k] || (bones[k] = (() => { const s2 = new Set(); L[k].scene.traverse(o => s2.add(o.name)); return s2; })());
  const rotOnly = (c, k) => { const key = c.uuid + k; if (!rot.has(key)) { const B = boneSet(k); rot.set(key, new THREE.AnimationClip(c.name, c.duration, c.tracks.filter(t => /\.quaternion$/.test(t.name) && B.has(t.name.split('.')[0]) && !(k === 'ff' && /Hips\.quaternion$/.test(t.name))))); } return rot.get(key); };   // само завъртанията и само костите, които моделът има (без пръстите); пожарникарят — без таза (скелетът му е с друга основа: иначе ляга)
  const ANIM = { idle: ['Ped_Idle', 'Idle'], look: ['Look_Around'], phone: ['Phone_Talk_M', 'Phone_Talk_F'], talk: ['Talk_General'], argue: ['Talk_Arguing'], wave: ['Waving'], smoke: ['Smoking'], walk: ['Ped_Walk_Brief'] };
  const RIG = { idle: 'Talk_General', walk: 'Look_Around' };   // полицаят и пожарникарят: Ped_Idle на минувачите ги обръща настрани — само клиповете от peds-anims
  const clipOf = (a, rig) => { if (rig && RIG[a]) a = RIG[a]; for (const n of ANIM[a] || [a]) if (L.clips[n]) return L.clips[n]; return rig ? L.clips.Look_Around || null : L.clips.Ped_Idle || null; };
  const pick = a => a[(Math.random() * a.length) | 0];
  // човек: kind 'ped' | 'cop' | 'ff' (пожарникар) | 'medic'; anim — от ANIM; o.lying — легнал (пострадалият)
  function person(kind = 'ped', anim = 'idle', o = {}) {
    if ((kind === 'cop' && !L.cop) || (kind === 'ff' && !L.ff) || (kind === 'medic' && !L.medic) || (kind === 'ped' && !L.peds.length)) kind = L.peds.length ? 'ped' : null;
    if (!kind) return null;
    const root = new THREE.Group(); let mixer = null;
    if (kind === 'medic') { const m = wrapTo(L.medic.scene, 0); const b = bodyBox(m), h = b.max.y - b.min.y; m.scale.setScalar(1.74 / (h || 1) * (0.96 + Math.random() * 0.06)); root.add(m); }
    else if (kind === 'cop' || kind === 'ff') { const body = cloneSkinned(L[kind].scene); body.position.y = 0.98; root.add(body); root.scale.setScalar(0.97 * (0.96 + Math.random() * 0.07)); mixer = new THREE.AnimationMixer(body); const c = clipOf(anim, true); if (c) { const a = mixer.clipAction(rotOnly(c, kind)); a.time = Math.random() * c.duration; a.play(); } }   // Mixamo без свои клипове — завъртанията от минувачите (както opskit.js)
    else { const src = o.src || pick(L.peds), body = cloneSkinned(src.scene); body.scale.setScalar(src.k * (0.94 + Math.random() * 0.1)); root.add(body); mixer = new THREE.AnimationMixer(body); const c = clipOf(anim) || src.animations[0]; if (c) { const a = mixer.clipAction(c); a.time = Math.random() * c.duration; a.play(); } }
    root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    if (mixer) mixer.update(0);
    let out = root;
    if (o.lying) { root.rotation.x = -Math.PI / 2; root.position.y = 0.14; out = new THREE.Group(); out.add(root); mixer = null; }   // легналият — неподвижен
    people.push({ o: out, mixer }); return out;
  }
  // човек на (x, z) в групата g, с лице към (tx, tz)
  function put(g, kind, anim, x, z, tx = 0, tz = 0, o) { const p = person(kind, anim, o); if (!p) return null; p.position.set(x, 0, z); p.rotation.y = Math.atan2(tx - x, tz - z); g.add(p); return p; }
  // зяпачите: n души по линията (x, z0…z1), с лице към центъра (cx, cz) — оглеждат се, снимат с телефона, говорят
  function crowd(g, n, x, z0, z1, cx = 0, cz = 0) { for (let k = 0; k < n; k++) { const z = z0 + (z1 - z0) * (n > 1 ? k / (n - 1) : 0.5) + (Math.random() - 0.5) * 0.8; put(g, 'ped', pick(['look', 'phone', 'phone', 'talk', 'idle', 'look']), x + (Math.random() - 0.5) * 0.9, z, cx, cz); } }
  // ---- кордон: стълбчета през ~3 м с раирана лента; pts — затворен многоъгълник в рамката на групата
  const tapeTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#d81e1e'; x.beginPath(); x.moveTo(i * 16, 8); x.lineTo(i * 16 + 8, 0); x.lineTo(i * 16 + 24, 0); x.lineTo(i * 16 + 16, 8); x.fill(); }
    return c; })(), tapeSrc = canvasTex(tapeTex), tapeT = L2 => { const t = tapeSrc.clone(); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(L2 / 0.5, 1); t.needsUpdate = true; return t; };   // fac-data: един общ източник (данните), своя repeat на лента   // без .clone() (празна текстура при качването)
  const postM = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 }), postRed = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.6 }), postG = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).translate(0, 0.5, 0), baseG = new THREE.CylinderGeometry(0.16, 0.18, 0.05, 10);
  function cordon(g, pts) {
    const post = (x, z) => { const p = new THREE.Mesh(postG, postM); p.position.set(x, 0, z); p.scale.y = 1.02; g.add(p); const t = new THREE.Mesh(postG, postRed); t.position.set(x, 0.75, z); t.scale.y = 0.27; g.add(t); const b = new THREE.Mesh(baseG, postRed); b.position.set(x, 0.025, z); g.add(b); };
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], L2 = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L2 / 3));
      for (let k = 0; k < n; k++) post(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n);
      const t = tapeT(L2); const m = new THREE.Mesh(new THREE.PlaneGeometry(L2, 0.07), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.7 }));
      m.position.set((a[0] + b[0]) / 2, 0.95, (a[1] + b[1]) / 2); m.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); g.add(m); } }
  // ---- водна струя: прозрачна тръба по дъга с течащи ивици; a, b — в света
  const streakT = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const x = c.getContext('2d'); for (let k = 0; k < 18; k++) { const px = Math.random() * 32, py = Math.random() * 128, l = 20 + Math.random() * 50, gr = x.createLinearGradient(0, py, 0, py + l); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(225,240,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(px, py, 3, l); }
    return c; })();
  function stream(scene) { const T = canvasTex(streakT); T.wrapS = T.wrapT = THREE.RepeatWrapping; const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: T, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8, color: 0xdcecff })); mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); let key = '';
    const S = { mesh, set(a, b, arc = 2) { const k = [a.x, a.y, a.z, b.x, b.y, b.z].map(v => v.toFixed(1)).join(); if (k === key) return; key = k; mesh.geometry.dispose();
        const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += arc; const cv = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone()); mesh.geometry = new THREE.TubeGeometry(cv, 20, 0.09, 6, false); T.repeat.set(1, Math.max(2, cv.getLength() / 2.5)); },
      update(dt, on) { mesh.visible = on; if (on) T.offset.y -= dt * 2.4; }, dispose() { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); T.dispose(); } };
    streams.push(S); return S; }
  // ---- превозните средства
  const moto = () => { if (!L.moto) return null; const w = wrapTo(L.moto.scene, 2.07), g = new THREE.Group(); w.rotation.z = Math.PI / 2 - 0.14; w.position.y = 0.42; g.add(w); return g; };   // легнал на една страна
  const tow = (big = false) => { const T2 = big ? L.towH || L.towL : L.towL || L.towH; if (TOW2 && T2) return towAnim(wrapTo(T2.scene, 5.66)); return L.tow ? wrapTo(L.tow.scene, 5.66, L.towYaw ?? -Math.PI / 2) : null; };   // по +z, предницата напред (моделът е по x); tow-trucks — big: тежкият
  // tow-trucks: колелата по изминатия път, мигащите буркани, стрелата нагоре, щом нещо е закачено (останките — дете на влекача)
  function towAnim(w) { const wh = [], bc = [], V0 = new THREE.Vector3(), V1 = new THREE.Vector3(); let boom = null, body = null, last = null, base = 0;
    w.traverse(m => { if (/^wheel_/.test(m.name)) { const b = new THREE.Box3().setFromObject(m); wh.push(m); m.userData.r = Math.max(0.1, (b.max.y - b.min.y) / 2); }
      else if (m.name === 'boom') boom = m; else if (m.isMesh && /^beacon/.test(m.name)) { m.material = m.material.clone(); m.material.emissive = new THREE.Color(0xff8a10); bc.push(m.material); } else if (m.isMesh && !body && m.name === 'body') body = m; });
    base = w.children.length;
    if (body) body.onBeforeRender = () => { const t = performance.now() / 1000; w.getWorldPosition(V1); const ws = w.getWorldScale(V0).x || 1, d = last ? V1.distanceTo(last) : 0; last = (last || new THREE.Vector3()).copy(V1);
      if (d > 0.001 && d < 5) for (const m of wh) m.rotation.x += d / ws / (m.userData.r / ws * ws);   // r — в мащаба на света
      for (const m of bc) m.emissiveIntensity = Math.sin(t * 9) > 0.2 ? 4 : 0.3;
      if (boom) { const tg = w.children.length > base ? 0.32 : 0; w.userData.winch = Math.abs(tg - boom.rotation.x) > 0.02; boom.rotation.x += (tg - boom.rotation.x) * 0.05; } };   // winch — лебедката работи (sfx-batch2)
    TOWS.add(w); return w; }
  // анимациите — само близо до камерата; dt — игровото време
  function update(dt, cam) { for (const P of people) { if (!P.mixer || !P.o.parent) continue; P.o.getWorldPosition(V); if (!cam || V.distanceToSquared(cam) < NEAR * NEAR) P.mixer.update(dt); } }
  function reset() { for (const P of people) if (P.mixer) P.mixer.stopAllAction(); people.length = 0; for (const s of streams) s.dispose(); streams.length = 0; }
  return { person, put, crowd, cordon, stream, moto, tow, update, reset, bodyBox };
}
