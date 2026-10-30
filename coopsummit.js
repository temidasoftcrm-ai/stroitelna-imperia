// coopsummit.js — 🏛️ флаг 'coop-riv-finale' (част 4 на „Конкуренти“, дизайнът на собственика): 3D залата на срещата на върха.
// Неутрална зала (високи прозорци, светъл камък, синя пътека): дълга маса с двата документа, двамата президенти, знамената зад тях.
// mode: 'sign' — подписване на сделка (писалките, печатът, светкавиците на пресата; затваря се сама), 'visit' — разглеждане,
// 'finale' — световният мир: „Архитекти на мира“ над масата и двете лични признания (plaques). Всичко е процедурно, собствен рендерер
// за времето на сцената (window.__overlay3d спира града) — после се освобождава.
import * as THREE from 'three';
import { t as tr } from './i18n.js';

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

// opts: { mode, a: { cc, name } (вляво), b: { cc, name } (вдясно), title, sub, plaques: [{ who, t, d }], sound(n), onClose() }
export function openSummitHall(opts = {}) {
  document.getElementById('coopHall')?.remove();
  if (!document.getElementById('coopHallCss')) { const c = document.createElement('style'); c.id = 'coopHallCss'; c.textContent = CSS; document.head.appendChild(c); }
  const mode = opts.mode || 'visit', A = opts.a || { cc: 'US', name: '' }, B = opts.b || { cc: 'RU', name: '' };
  const el = document.createElement('div'); el.id = 'coopHall';
  el.innerHTML = `<button class="x">✕ ${tr('Затвори')}</button><div class="cap" style="opacity:0;transition:opacity .8s"><h2>${esc(opts.title || tr('Залата на срещата на върха'))}</h2><div>${esc(opts.sub || '')}</div>`
    + (opts.plaques?.length ? `<div class="pl">${opts.plaques.map(p => `<div><span>${esc(p.who)}</span><b>${esc(p.t)}</b><small>${esc(p.d || '')}</small></div>`).join('')}</div>` : '') + `</div>`;
  document.body.appendChild(el); window.__overlay3d = (window.__overlay3d || 0) + 1;
  let renderer; try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { console.warn('coop-hall', e); el.remove(); window.__overlay3d = Math.max(0, window.__overlay3d - 1); opts.onClose && opts.onClose(); return () => { }; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  el.insertBefore(renderer.domElement, el.firstChild);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1320); scene.fog = new THREE.Fog(0x0d1320, 30, 60);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const add = (geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; scene.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, sh) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, sh);
  // залата: под (светъл мрамор на плочи), синя пътека, стени с високи прозорци, таван
  const floorT = canvasTex(512, 512, (g, w) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#d9d1c1' : '#cbc2b0'; g.fillRect(i * w / 8, j * w / 8, w / 8, w / 8); } }); floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping; floorT.repeat.set(4, 3);
  add(new THREE.PlaneGeometry(32, 24).rotateX(-Math.PI / 2), std(0xffffff, 0.35, 0, { map: floorT }), 0, 0, 0, false);
  add(new THREE.PlaneGeometry(4, 22).rotateX(-Math.PI / 2), std(0x1f3c78, 0.9), 0, 0.01, 2, false);
  const wall = std(0xcfd6dc, 0.85), trim = std(0xb8963e, 0.4, 0.6);
  box(32, 9, 0.4, wall, 0, 4.5, -10); box(0.4, 9, 24, wall, -16, 4.5, 2); box(0.4, 9, 24, wall, 16, 4.5, 2); box(32, 0.3, 24, std(0xe8e4da, 0.9), 0, 9, 2, false);
  const glass = std(0xbfd8ff, 0.2, 0, { emissive: 0x9cc4ff, emissiveIntensity: 0.9 });
  for (const x of [-12, -7, 7, 12]) { box(2.6, 6, 0.1, glass, x, 4.2, -9.75, false); box(2.9, 0.18, 0.2, trim, x, 7.3, -9.7, false); }
  for (const z of [-4, 2, 8]) for (const s of [-1, 1]) box(0.1, 6, 2.6, glass, s * 15.75, 4.2, z, false);
  // гербът над масата: гълъбът с маслинената клонка (или „Архитекти на мира“ във финала)
  const emb = canvasTex(512, 512, (g, w) => { g.fillStyle = '#1f3c78'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, 7); g.fill(); g.strokeStyle = '#d8b65a'; g.lineWidth = 14; g.stroke(); g.font = `${w * 0.46}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🕊️', w / 2, w / 2 + 6); });
  add(new THREE.CircleGeometry(1.6, 48), std(0xffffff, 0.6, 0, { map: emb }), 0, 5.6, -9.78, false);
  // знамената на пилони зад двамата
  const flags = [];
  for (const [P, s] of [[A, -1], [B, 1]]) {
    const ft = canvasTex(380, 200, flagDraw(P.cc)), geo = new THREE.PlaneGeometry(2.2, 1.3, 16, 4);
    for (const dx of [-2.4, -4.2]) { const x = s * -dx; box(0.08, 4.4, 0.08, trim, x, 2.2, -6.5); const f = add(geo.clone(), std(0xffffff, 0.8, 0, { map: ft, side: THREE.DoubleSide }), x + s * 1.12, 3.6, -6.5, false); f.userData.p0 = f.geometry.attributes.position.array.slice(); flags.push(f); }
  }
  // масата (тъмно дърво, зелено сукно), столовете, президентите (опростени фигури), документите и писалките
  const wood = std(0x4a2c1a, 0.5), suit = [std(0x1d2433, 0.7), std(0x262a35, 0.7)], skin = std(0xe0b896, 0.8);
  box(7.4, 0.12, 1.9, wood, 0, 1.0, -2.6); box(7.2, 0.02, 1.7, std(0x2f5e3b, 0.95), 0, 1.07, -2.6); for (const x of [-3.4, 3.4]) box(0.2, 1, 1.6, wood, x, 0.5, -2.6);
  const docs = [], pens = [];
  for (const [P, s, i] of [[A, -1, 0], [B, 1, 1]]) {
    const x = s * 1.7; box(0.9, 1.3, 0.9, std(0x6b2230, 0.6), x, 0.65, -3.9); box(0.9, 1.5, 0.15, std(0x6b2230, 0.6), x, 1.5, -4.35);
    box(0.72, 0.85, 0.44, suit[i], x, 1.65, -3.85); add(new THREE.SphereGeometry(0.2, 16, 12), skin, x, 2.32, -3.85);
    docs.push(box(0.5, 0.01, 0.7, std(0xf6f1e4, 0.9), x, 1.09, -2.6, false));
    const pen = add(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8).rotateZ(Math.PI / 2.6), std(0x111111, 0.3, 0.6), x + 0.15, 1.16, -2.5); pens.push(pen);
    const tf = canvasTex(64, 40, flagDraw(P.cc)); box(0.01, 0.4, 0.01, trim, x + s * 0.9, 1.28, -2.0); add(new THREE.PlaneGeometry(0.3, 0.19), std(0xffffff, 0.8, 0, { map: tf, side: THREE.DoubleSide }), x + s * 0.9 + 0.15, 1.38, -2.0, false);
  }
  const seal = add(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 32), std(0xd8b65a, 0.3, 0.8, { emissive: 0x6b4e10, emissiveIntensity: 0.4 }), 0, 1.09, -2.45, false); seal.visible = false;
  const laurel = mode === 'finale' ? add(new THREE.TorusGeometry(1.0, 0.06, 8, 48), std(0xd8b65a, 0.3, 0.8, { emissive: 0x8a6a1c, emissiveIntensity: 0.6 }), 0, 3.6, -3.2, false) : null;
  // пресата — светкавиците при подписването
  const flash = new THREE.PointLight(0xffffff, 0, 30); flash.position.set(0, 2.4, 3); scene.add(flash);
  // светлината: топли полилеи + меко дневно отвън
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x403528, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1d8, 1.6); sun.position.set(-6, 10, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); scene.add(sun);
  for (const x of [-6, 0, 6]) { const l = new THREE.PointLight(0xffd9a0, 0.8, 16); l.position.set(x, 7.6, -1); scene.add(l); add(new THREE.SphereGeometry(0.35, 16, 10), std(0xfff3d6, 0.3, 0, { emissive: 0xffd9a0, emissiveIntensity: 1.5 }), x, 7.9, -1, false); }
  // анимацията
  const t0 = performance.now(), cap = el.querySelector('.cap'), DUR = mode === 'sign' ? 11.5 : 1e9; let raf = 0, done = false, sealed = false;
  const size = () => { const w = el.clientWidth || innerWidth, h = el.clientHeight || innerHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }; size(); addEventListener('resize', size);
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  function frame() {
    if (done) return; raf = requestAnimationFrame(frame); const t = (performance.now() - t0) / 1000;
    const k = ease(t / 5), sw = Math.sin(t * 0.25) * 0.6; cam.position.set(sw, 3.4 - k * 0.9, 10 - k * 4.2); cam.lookAt(0, 1.5 + (1 - k) * 0.4, -3);
    for (const f of flags) { const p = f.geometry.attributes.position, a = f.userData.p0; for (let i = 0; i < p.count; i++) { const u = a[i * 3] + 1.1; p.array[i * 3 + 2] = a[i * 3 + 2] + Math.sin(u * 2.4 - t * 3 + f.position.x) * 0.06 * u; } p.needsUpdate = true; }
    if (t > 1.2) cap.style.opacity = '1';
    if (mode === 'sign') {   // писалките — първо вляво, после вдясно; после печатът и светкавиците
      pens.forEach((p, i) => { const a = (t - 2.2 - i * 2.3) / 2; const on = a > 0 && a < 1; p.position.x = docs[i].position.x + 0.15 + (on ? Math.sin(a * 18) * 0.12 : 0); p.position.y = on ? 1.12 : 1.16; p.position.z = -2.5 - (on ? a * 0.25 : 0); });
      if (t > 7 && !sealed) { sealed = true; seal.visible = true; opts.sound && opts.sound('levelup'); }
      flash.intensity = t > 7 && t < 10 && Math.sin(t * 23) > 0.93 ? 60 : 0;
      if (t > DUR) close();
    }
    if (laurel) { laurel.rotation.y = t * 0.6; seal.visible = true; }
    renderer.render(scene, cam);
  }
  function close() {
    if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('resize', size);
    scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const m = o.material; if (m.map) m.map.dispose(); m.dispose(); } });
    renderer.dispose(); renderer.forceContextLoss?.(); el.remove(); window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); opts.onClose && opts.onClose();
  }
  el.querySelector('.x').onclick = close; frame();
  return close;
}
