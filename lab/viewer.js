// viewer.js — един 3D модел в Лабораторията: върти се с мишката, вписан в кадъра, с размер, триъгълници, материали
// и бутони за анимациите (скорост, T-поза). Мрежа/плътно и тъмен/светъл фон — от лентата горе вдясно (lab.js).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

let V = null;   // текущият изглед
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PREF = ['Idle', 'idle', 'Idle_Natural', 'Walk'];

export function closeModel() {
  if (!V) return;
  cancelAnimationFrame(V.raf); V.ro.disconnect(); V.controls.dispose();
  V.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); } });
  V.pmrem.dispose(); V.renderer.dispose(); V.renderer.domElement.remove(); V = null;
}

export function openModel(host, url) {
  closeModel();
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement); renderer.domElement.style.display = 'block';
  const scene = new THREE.Scene(), dark = { v: true }, bgc = () => new THREE.Color(dark.v ? 0x1b1d22 : 0xc9d3dc); scene.background = bgc();
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20000), controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  const key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.4); scene.add(rim); scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const info = document.createElement('div'); info.className = 'info'; info.innerHTML = `<b>${esc(url.split('/').pop())}</b><small>${esc(url)}</small><div>Зарежда се…</div>`; host.appendChild(info);
  const clock = new THREE.Clock();
  V = { renderer, scene, camera, controls, pmrem, raf: 0, mixer: null, speed: 1, ro: null };
  const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
  V.ro = new ResizeObserver(size); V.ro.observe(host); size();
  const loop = () => { if (!V) return; V.raf = requestAnimationFrame(loop); const dt = Math.min(clock.getDelta(), 0.1); if (V.mixer) V.mixer.update(dt * V.speed); controls.update(); renderer.render(scene, camera); };
  loop();
  // бутоните от лентата (lab.js ги рисува; тук само поведението)
  const bw = document.getElementById('bWire'), bb = document.getElementById('bBg');
  let wire = false;
  if (bb) bb.onclick = () => { dark.v = !dark.v; scene.background = bgc(); bb.textContent = dark.v ? 'Светъл фон' : 'Тъмен фон'; };
  const me = V;
  new GLTFLoader().load(url + '?v=' + Date.now(), gltf => {
    if (V !== me) return;
    const obj = cloneSkinned(gltf.scene); scene.add(obj);
    obj.updateMatrixWorld(true); obj.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
    let tris = 0, meshes = 0; const mats = new Set();
    obj.traverse(o => { if (!o.isMesh) return; meshes++; o.castShadow = true; o.receiveShadow = true; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; for (const m of [].concat(o.material)) mats.add(m); });
    const box = new THREE.Box3().setFromObject(obj, true), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    obj.position.y -= box.min.y; obj.position.x -= c.x; obj.position.z -= c.z;   // на пода, в центъра
    const r = Math.max(s.x, s.y, s.z) || 1, t = new THREE.Vector3(0, s.y / 2, 0);
    camera.position.set(r * 1.1, s.y / 2 + r * 0.45, r * 1.7); camera.near = r / 500; camera.far = r * 100; camera.updateProjectionMatrix(); controls.target.copy(t); controls.update();
    key.position.set(r * 1.5, r * 3, r * 2); const sc = key.shadow.camera; sc.left = sc.bottom = -r * 1.5; sc.right = sc.top = r * 1.5; sc.far = r * 8; sc.updateProjectionMatrix();
    rim.position.set(-r * 1.2, r * 1.5, -r * 2.5); floor.scale.setScalar(r * 6);
    const grid = new THREE.GridHelper(r * 6, 24, 0xa57b2a, 0x444444); grid.position.y = 0.001; scene.add(grid);
    info.innerHTML = `<b>${esc(url.split('/').pop())}</b><small>${esc(url)}</small><div>Размер: ${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} (Ш×В×Д)<br>${Math.round(tris).toLocaleString('bg')} триъгълника · ${meshes} меша · ${mats.size} материала${gltf.animations.length ? ` · ${gltf.animations.length} анимации` : ''}</div>`;
    if (bw) bw.onclick = () => { wire = !wire; obj.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) m.wireframe = wire; }); bw.textContent = wire ? 'Плътно' : 'Мрежа'; };
    if (gltf.animations.length) {
      const mixer = V.mixer = new THREE.AnimationMixer(obj);
      const panel = document.createElement('div'); panel.className = 'anims';
      panel.innerHTML = `<div class="top"><span>Анимации (${gltf.animations.length})</span><label>скорост <input type="range" min="0.1" max="2" step="0.1" value="1" id="aSp"> <span id="aSpV">1.0×</span></label><button class="btn" id="aT">■ T-поза</button></div>
        <div class="list">${gltf.animations.map((a, i) => `<button data-a="${i}">${esc(a.name || 'анимация ' + (i + 1))}</button>`).join('')}</div>`;
      host.appendChild(panel);
      const playA = i => { mixer.stopAllAction(); panel.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', +b.dataset.a === i)); if (i >= 0) mixer.clipAction(gltf.animations[i]).reset().play(); };
      panel.querySelectorAll('[data-a]').forEach(b => b.onclick = () => playA(+b.dataset.a));
      panel.querySelector('#aT').onclick = () => playA(-1);
      panel.querySelector('#aSp').oninput = e => { V.speed = +e.target.value; panel.querySelector('#aSpV').textContent = V.speed.toFixed(1) + '×'; };
      const first = gltf.animations.findIndex(a => PREF.includes(a.name)); playA(first >= 0 ? first : 0);
    }
  }, undefined, e => { info.innerHTML = `<b>${esc(url.split('/').pop())}</b><small>${esc(url)}</small><div style="color:#fca5a5">Не се зарежда: ${esc(e.message || e)}</div>`; });
}
