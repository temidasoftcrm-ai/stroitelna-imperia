// globe.js — 3D глобус на империята (като Google Earth): Земята (NASA Blue Marble, обществено достояние),
// границите на държавите (Natural Earth, обществено достояние), превзетите държави в зелено, започнатите — в жълто,
// твоите градове като светещи точки с имена. Върти се с мишката, приближава се с колелцето.
// openGlobe(data) → { close }; data: { won: Set(ISO3), partial: Map(ISO3 → 0…1), cities: [{ lat, lon, nm, hq, done }], stats: { won, total }, focus: [lat, lon] }
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let geo = null;
const loadGeo = () => geo || (geo = fetch('assets/globe/countries.json').then(r => r.json()).catch(() => ({ features: [] })));
// географски координати → точка върху сфера с радиус r (съвпада с UV на SphereGeometry)
export function ll2v(lat, lon, r = 1) {
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
// слой с държавите (равнопромежутъчна проекция върху платно → текстура на прозрачна сфера над Земята)
function countryLayer(g, data) {
  const W = 4096, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), px = ([lon, lat]) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
  const path = rings => { x.beginPath(); for (const ring of rings) ring.forEach((p, i) => { const [a, b] = px(p); i ? x.lineTo(a, b) : x.moveTo(a, b); }); };
  for (const f of g.features) {
    const a3 = f.properties.a3, polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const won = data.won.has(a3), part = data.partial.get(a3) || 0;
    for (const rings of polys) {
      path(rings);
      if (won) { x.fillStyle = 'rgba(40,220,90,0.55)'; x.fill('evenodd'); }
      else if (part > 0) { x.fillStyle = `rgba(255,205,60,${0.18 + part * 0.3})`; x.fill('evenodd'); }
      x.lineWidth = won ? 3 : 1.4; x.strokeStyle = won ? 'rgba(150,255,170,0.95)' : 'rgba(255,255,255,0.35)'; x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function labelSprite(text, color = '#fff') {
  const c = document.createElement('canvas'), x = c.getContext('2d'); x.font = 'bold 40px system-ui, sans-serif';
  const w = Math.ceil(x.measureText(text).width) + 24; c.width = w; c.height = 56;
  x.font = 'bold 40px system-ui, sans-serif'; x.fillStyle = 'rgba(10,16,26,0.7)'; x.beginPath(); x.roundRect(0, 4, w, 48, 12); x.fill();
  x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 12, 29);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true, sizeAttenuation: false }));
  s.scale.set(w / 56 * 0.032, 0.032, 1); s.center.set(-0.12, 0.5);   // постоянен размер на екрана при приближаване
  return s;
}

export function openGlobe(data) {
  let el = document.getElementById('globeView');
  if (el) { const b = el.querySelector('#globeClose'); b && b.onclick ? b.click() : el.remove(); }   // старият глобус се затваря изцяло (контекст, текстури)
  el = document.createElement('div'); el.id = 'globeView';
  el.style.cssText = 'position:fixed;inset:var(--topH,52px) 0 0 0;z-index:9;background:#02040a';
  el.innerHTML = `<div style="position:absolute;left:16px;bottom:16px;z-index:2;background:rgba(10,16,26,.82);border:1px solid var(--line);border-radius:14px;padding:12px 16px;color:#fff;max-width:340px">
      <div style="font-weight:800;font-size:18px;color:var(--acc)">🌍 Твоята империя</div>
      <div style="margin-top:6px;font-size:14px">Превзети държави: <b style="color:#5dff8a">${data.stats.won}</b> от ${data.stats.total}</div>
      <div style="margin-top:6px;font-size:12px;color:var(--mut);line-height:1.6"><span style="color:#5dff8a">■</span> превзета · <span style="color:#ffd23f">■</span> започната · <span style="color:#ffd54a">●</span> централа · <span style="color:#7dd3ff">●</span> твой град<br>Върти с мишката, приближавай с колелцето.</div></div>
    <button class="btn2" id="globeClose" style="position:absolute;right:16px;top:14px;z-index:2">✕ Затвори</button>`;
  document.body.appendChild(el);
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(r.domElement);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const size = () => { const w = el.clientWidth, h = el.clientHeight; r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  size(); addEventListener('resize', size);
  sc.add(new THREE.AmbientLight(0xffffff, 0.55)); const sun = new THREE.DirectionalLight(0xffffff, 2.2); sc.add(sun);
  // Земята + тънка атмосфера
  const tex = new THREE.TextureLoader().load('assets/globe/earth.webp'); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
  sc.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float k = pow(0.72 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.35,0.65,1.0,1.0) * k; }' }));
  sc.add(atm);
  // звезди
  const sp = []; for (let i = 0; i < 2500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20); sp.push(v.x, v.y, v.z); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, sizeAttenuation: true })));
  // държави
  loadGeo().then(g => { if (!el.isConnected) return; const layer = new THREE.Mesh(new THREE.SphereGeometry(1.002, 128, 96), new THREE.MeshBasicMaterial({ map: countryLayer(g, data), transparent: true, depthWrite: false })); sc.add(layer); });
  // градовете
  const pins = new THREE.Group(); sc.add(pins);
  for (const c of data.cities) {
    if (!c.mine && !c.hq) { if (c.label) { const s = labelSprite('★ ' + c.nm, '#cfd8e3'); s.position.copy(ll2v(c.lat, c.lon, 1.006)); pins.add(s); } continue; }   // столица без твой град — само надпис
    const col = c.hq ? 0xffd54a : c.done ? 0x5dff8a : 0x7dd3ff;
    const m = new THREE.Mesh(new THREE.SphereGeometry(c.hq ? 0.006 : 0.004, 10, 8), new THREE.MeshBasicMaterial({ color: col }));
    m.position.copy(ll2v(c.lat, c.lon, 1.004)); pins.add(m);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.005, 0.0075, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    halo.position.copy(ll2v(c.lat, c.lon, 1.0045)); halo.lookAt(0, 0, 0); pins.add(halo);
    if (c.label) { const s = labelSprite((c.cap ? '★ ' : '') + c.nm, c.hq ? '#ffd54a' : '#ffffff'); s.position.copy(ll2v(c.lat, c.lon, 1.012)); pins.add(s); }
  }
  // камера към централата
  const [flat, flon] = data.focus || [42.7, 25.3];
  cam.position.copy(ll2v(flat, flon, 2.15)); cam.lookAt(0, 0, 0);
  const ctl = new OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.minDistance = 1.15; ctl.maxDistance = 6; ctl.enablePan = false; ctl.rotateSpeed = 0.5; ctl.zoomSpeed = 0.8;
  let alive = true;
  const loop = () => {
    if (!alive) return;
    requestAnimationFrame(loop);
    const d = cam.position.length(); ctl.rotateSpeed = 0.15 + (d - 1) * 0.25;   // отблизо — по-бавно
    sun.position.copy(cam.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6).add(new THREE.Vector3(0, 1.5, 0));
    ctl.update(); r.render(sc, cam);
  };
  loop();
  function close() {
    alive = false; removeEventListener('resize', size); ctl.dispose();
    sc.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { mm.map?.dispose?.(); mm.dispose(); }); });
    r.dispose(); r.forceContextLoss(); el.remove(); data.onClose && data.onClose();
  }
  el.querySelector('#globeClose').onclick = close;
  return { close };
}
