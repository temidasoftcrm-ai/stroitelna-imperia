// coopsummit.js — 🏛️ флаг 'coop-riv-finale' (част 4 на „Конкуренти“, дизайнът на собственика): 3D залата на срещата на върха.
// Неутрална зала (високи прозорци, светъл камък, синя пътека): дълга маса с двата документа, двамата президенти, знамената зад тях.
// mode: 'sign' — подписване на сделка (писалките, печатът, светкавиците на пресата; затваря се сама), 'visit' — разглеждане,
// 'finale' — световният мир: „Архитекти на мира“ над масата и двете лични признания (plaques). Всичко е процедурно, собствен рендерер
// за времето на сцената (window.__overlay3d спира града) — после се освобождава.
import * as THREE from 'three';
import { t as tr } from './i18n.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildSummitRoom } from './presrooms.js';   // ламперията, килимът, завесите, полилеите, растенията и пилоните със знамената
import { directorRig } from './directors3d.js';   // президентите — моделите и клиповете на Борда/Кабинета

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const std = (c, r = 0.75, m = 0, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...x });
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function flagDraw(cc) {
  return (g, w, h) => {
    if (cc === 'RU') { [['#fff', 0], ['#0039a6', 1], ['#d52b1e', 2]].forEach(([c, i]) => { g.fillStyle = c; g.fillRect(0, i * h / 3, w, h / 3 + 1); }); return; }
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#fff' : '#b22234'; g.fillRect(0, i * h / 13, w, h / 13 + 1); }
    g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, w * 0.4, h * 7 / 13); g.fillStyle = '#fff';
    for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { g.beginPath(); g.arc(w * 0.4 * ((k + (r % 2 ? 1 : 0.5)) / 6), h * 7 / 13 * (r + 0.5) / 9, h * 0.018, 0, 7); g.fill(); }
  };
}
const CSS = `#coopHall{position:fixed;inset:0;z-index:9850;background:#05080f}#coopHall canvas{display:block;width:100%;height:100%}
#coopHall .cap{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);text-align:center;color:#f3ead2;font:600 15px/1.4 system-ui,sans-serif;text-shadow:0 2px 8px #000;max-width:92vw}
#coopHall .cap h2{margin:0 0 4px;font-size:26px;color:#ffd54a;letter-spacing:.04em}#coopHall .pl{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:10px}
#coopHall .pl div{background:rgba(20,28,46,.86);border:1px solid #b8963e;border-radius:12px;padding:8px 14px;min-width:200px}#coopHall .pl b{color:#ffd54a;font-size:17px;display:block}
#coopHall .x{position:absolute;top:14px;right:16px;background:#1d2a42;color:#e6edf6;border:1px solid #2d3f60;border-radius:10px;padding:7px 12px;font:600 14px system-ui;cursor:pointer}`;

let cur = null, R = null;   // открита зала (затваря се правилно, преди да се отвори нова) и един общ рендерер — без нов WebGL контекст при всяко отваряне
// opts: { mode, a: { cc, name } (вляво), b: { cc, name } (вдясно), title, sub, plaques: [{ who, t, d }], sound(n), onClose() }
export function openSummitHall(opts = {}) {
  if (cur) cur(); document.getElementById('coopHall')?.remove();
  if (!document.getElementById('coopHallCss')) { const c = document.createElement('style'); c.id = 'coopHallCss'; c.textContent = CSS; document.head.appendChild(c); }
  const mode = opts.mode || 'visit', A = opts.a || { cc: 'US', name: '' }, B = opts.b || { cc: 'RU', name: '' };
  const el = document.createElement('div'); el.id = 'coopHall';
  el.innerHTML = `<button class="x">✕ ${tr('Затвори')}</button><div class="cap" style="opacity:0;transition:opacity .8s"><h2>${esc(opts.title || tr('Залата на срещата на върха'))}</h2><div>${esc(opts.sub || '')}</div>`
    + (opts.plaques?.length ? `<div class="pl">${opts.plaques.map(p => `<div><span>${esc(p.who)}</span><b>${esc(p.t)}</b><small>${esc(p.d || '')}</small></div>`).join('')}</div>` : '') + `</div>`;
  document.body.appendChild(el); window.__overlay3d = (window.__overlay3d || 0) + 1;
  let renderer; try { renderer = R || (R = new THREE.WebGLRenderer({ antialias: true })); renderer.domElement.addEventListener('webglcontextlost', () => { R = null; }, { once: true }); } catch (e) { console.warn('coop-hall', e); el.remove(); window.__overlay3d = Math.max(0, window.__overlay3d - 1); opts.onClose && opts.onClose(); return () => { }; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  el.insertBefore(renderer.domElement, el.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1612);
  const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  const add = (geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; scene.add(m); return m; };
  // залата — общите материали и предмети на президентските зали (presrooms.js): ламперия, килим, завеси, полилеи, растения, знамената; гербът — гълъбът
  const dove = canvasTex(512, 512, (g, w) => { g.fillStyle = '#1f3c78'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.49, 0, 7); g.fill(); g.strokeStyle = '#d8b65a'; g.lineWidth = 16; g.beginPath(); g.arc(w / 2, w / 2, w * 0.44, 0, 7); g.stroke(); g.font = `${w * 0.5}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🕊️', w / 2, w / 2 + 8); });
  const room = buildSummitRoom(scene, dove), T = room.table, top = T.h + 0.012, gold = room.gold;
  // на масата: двата документа, писалките, малките знаменца, печатът; във финала — златният венец над масата
  const docs = [], pens = [], SX = 0.62, SZ = T.z - T.d / 2 - 0.42, DZ = T.z - T.d / 2 + 0.27;   // документите — пред всеки президент, до неговия ръб на масата
  for (const [P, s] of [[A, -1], [B, 1]]) {
    const x = s * SX; docs.push(add(new THREE.BoxGeometry(0.3, 0.004, 0.42), std(0xf6f1e4, 0.9), x, top, DZ, false));
    add(new THREE.BoxGeometry(0.36, 0.006, 0.48), std(0x5a1f1f, 0.6), x, top - 0.004, DZ, false);
    pens.push(add(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8), std(0x111111, 0.3, 0.7), x + 0.17, top + 0.006, DZ + 0.07, false)); pens[pens.length - 1].rotation.set(Math.PI / 2, 0, 0.5);
    const tf = canvasTex(96, 60, flagDraw(P.cc)); add(new THREE.CylinderGeometry(0.004, 0.004, 0.32, 6), gold, s * (T.w / 2 - 0.2), top + 0.16, T.z + 0.15, false); add(new THREE.PlaneGeometry(0.16, 0.1), std(0xffffff, 0.8, 0, { map: tf, side: THREE.DoubleSide }), s * (T.w / 2 - 0.2) + 0.08, top + 0.27, T.z + 0.15, false);
  }
  const seal = add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 32), std(0xd8b65a, 0.3, 0.8, { emissive: 0x6b4e10, emissiveIntensity: 0.4 }), 0, top + 0.004, DZ, false); seal.visible = mode !== 'sign';
  const laurel = mode === 'finale' ? add(new THREE.TorusGeometry(0.42, 0.025, 8, 48), std(0xd8b65a, 0.3, 0.8, { emissive: 0x8a6a1c, emissiveIntensity: 0.6 }), 0, 2.25, -4.3, false) : null;
  // пресата — светкавиците при подписването
  const flash = new THREE.PointLight(0xffffff, 0, 12); flash.position.set(0, 1.8, 2.5); scene.add(flash);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2c22, 0.75));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.4); sun.position.set(-3, 5, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(sun);
  // 🧑‍💼 двамата президенти — моделите от Борда/Кабинета (directors3d.js), седнали зад масата, с общите клипове (Mixamo)
  const people = [], CH = 'assets/heavy/chairs/sf-ch-tufted.glb', ld = new GLTFLoader();
  const standAt = mode === 'finale' || mode === 'joint' ? 0 : mode === 'sign' ? 8.2 : 1e9;
  [[A, -1], [B, 1]].forEach(([P, s], i) => directorRig(null, P.cc === 'RU' ? 'boris' : 'georgi').then(rig => {
    if (done || !rig) return; const m = rig.m, clips = rig.clips; m.scale.setScalar(rig.scale); m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });
    const wrap = new THREE.Group(); wrap.add(m); scene.add(wrap); const mixer = new THREE.AnimationMixer(m), act = n => clips[n] ? mixer.clipAction(clips[n]) : null;
    const p = { s, m, wrap, mixer, sit: act('Sit_Table_Idle') || act('Sit_Breathing'), up: act('Sit_To_Stand'), shake: act('Handshake') || act('Idle_Standing'), hand: m.getObjectByName('mixamorigRightHand'), fore: m.getObjectByName('mixamorigRightForeArm'), cur: null, stood: false };
    const go = (a, once, f = 0.5) => { if (!a || a === p.cur) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!once; a.fadeIn(f).play(); p.cur && p.cur.fadeOut(f); p.cur = a; };
    p.go = go; go(p.sit, false, 0); mixer.update(0.01 + i * 0.7);
    // ханшът — над седалката, стъпалата — на пода (както в Борда)
    wrap.position.set(s * SX, 0, SZ); wrap.updateMatrixWorld(true); const hips = m.getObjectByName('mixamorigHips'), hp = new THREE.Vector3();
    if (hips) { hips.getWorldPosition(hp); wrap.position.x += s * SX - hp.x; wrap.position.z += SZ - hp.z; wrap.updateMatrixWorld(true);
      let lo = Infinity; for (const n of ['mixamorigLeftToeBase', 'mixamorigRightToeBase']) { const b = m.getObjectByName(n); if (b) lo = Math.min(lo, b.getWorldPosition(new THREE.Vector3()).y); } if (lo < 0.03) { wrap.position.y += 0.03 - lo; wrap.updateMatrixWorld(true); }
      hips.getWorldPosition(hp); p.seatY = hp.y; }
    p.home = wrap.position.clone(); people.push(p);
    ld.loadAsync(CH).then(g => { if (done) return; const c = g.scene.clone(true), bb = new THREE.Box3().setFromObject(c), k = 1.15 / ((bb.max.y - bb.min.y) || 1); c.scale.setScalar(k); c.rotation.y = Math.PI; c.position.set(s * SX, -bb.min.y * k, SZ - 0.08); c.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); scene.add(c); p.chair = c; }).catch(() => { });
    if (mode === 'finale' || mode === 'joint') stand(p, true);
  }).catch(e => console.warn('coop-hall rig', e)));
  // изправяне → обръщат се един към друг, крачка назад от масата → ръкостискане
  function stand(p, now) { if (p.stood) return; p.stood = true; p.t0 = now ? -9 : null; if (now) { place(p, 1); p.go(p.shake, false, 0); } else p.go(p.up, true, 0.4); }
  function place(p, k) { const tz = SZ - 0.62; p.wrap.position.x = p.home.x + (p.s * 0.62 - p.home.x) * k; p.wrap.position.z = p.home.z + (tz - p.home.z) * k; p.wrap.position.y = p.home.y * (1 - k); p.wrap.rotation.y = -p.s * Math.PI / 2 * k; }
  // анимацията
  const t0 = performance.now(), cap = el.querySelector('.cap'), DUR = mode === 'sign' ? 14.5 : mode === 'joint' ? 9 : 1e9; let raf = 0, done = false, sealed = false, last = t0;
  const stop = DUR < 1e9 ? setTimeout(() => close(), DUR * 1000 + 800) : 0;   // церемонията се затваря сама и когато кадрите спрат (скрит раздел)
  const size = () => { const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }; size(); addEventListener('resize', size);
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), hv = new THREE.Vector3();
  function frame() {
    if (done) return; raf = requestAnimationFrame(frame); const now = performance.now(), t = (now - t0) / 1000, dt = Math.min(0.1, (now - last) / 1000); last = now;
    // камерата: от входа към масата (6 s), после леко отстрани; при ръкостискането — малко по-високо
    const k = ease(t / 6), kh = ease((t - standAt - 0.5) / 2.5), ox = Math.sin(t * 0.2) * 0.25;
    cam.position.set(0.9 * k + ox, 2.2 - 0.62 * k + 0.12 * kh, 5.4 - 3.0 * k + 0.4 * kh); cam.lookAt(0, 1.1 + 0.2 * kh, T.z - 0.55);
    room.update(t); if (t > 1.2) cap.style.opacity = '1';
    for (const p of people) {
      if (t > standAt && !p.stood) stand(p, false);
      if (p.stood && p.t0 == null) p.t0 = t;
      if (p.stood && p.t0 > -9) { const a = (t - p.t0 - 0.6) / 1.4; if (a > 0) place(p, ease(a)); if (a > 0.6 && p.cur === p.up) p.go(p.shake, false, 0.6); }
      p.mixer.update(dt);
      // ✍️ подписването: писалката в дясната ръка, китката пише (лявият — 2–4,5 s, десният — 4,5–7 s)
      const w = mode === 'sign' ? (t - 2.2 - (p.s > 0 ? 2.5 : 0)) / 2.3 : -1, on = w > 0 && w < 1 && !p.stood, pen = pens[p.s < 0 ? 0 : 1];
      if (on && p.hand) { p.hand.rotation.z += Math.sin(t * 16) * 0.22; p.hand.rotation.x += Math.sin(t * 9) * 0.12; if (p.fore) p.fore.rotation.y += Math.sin(t * 5) * 0.06; p.m.updateMatrixWorld(true); p.hand.getWorldPosition(hv); pen.position.set(hv.x, Math.max(top + 0.03, hv.y - 0.02), hv.z + 0.06); pen.rotation.set(0.9, 0, 0.4); }
      else if (w >= 1 && !p.penDown) { p.penDown = 1; const d = docs[p.s < 0 ? 0 : 1]; pen.position.set(d.position.x + 0.17, top + 0.006, d.position.z + 0.07); pen.rotation.set(Math.PI / 2, 0, 0.5); }
    }
    if (mode === 'sign') {
      if (t > 7 && !sealed) { sealed = true; seal.visible = true; opts.sound && opts.sound('levelup'); }
      flash.intensity = t > 7 && t < 12.5 && Math.sin(t * 23) > 0.9 ? 25 : 0;
      if (t > DUR) close();
    }
    if (mode === 'joint' && t > DUR) close();   // 🤝 coop-riv-allies: „Съвместно изявление“ — ръкостискането, после се затваря само
    if (laurel) laurel.rotation.y = t * 0.6;
    try { renderer.render(scene, cam); } catch (e) { console.warn('coop-hall render', e); close(); }
  }
  function close() {
    if (done) return; done = true; cur = null; clearTimeout(stop); cancelAnimationFrame(raf); removeEventListener('resize', size);
    for (const p of people) p.mixer.stopAllAction();
    scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) { o.geometry.dispose(); for (const m of [].concat(o.material)) { if (m?.map && m.map.isCanvasTexture) m.map.dispose(); } } });   // общите модели (кешът на presrooms/directors3d) остават
    renderer.renderLists.dispose(); renderer.domElement.remove(); el.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); opts.onClose && opts.onClose();
  }
  el.querySelector('.x').onclick = close; cur = close; frame();
  return close;
}
