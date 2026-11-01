// ufo.js — 🛸 скрита изненада (feature 'ufo-vegas'): НЛО над Лас Вегас (Зона 51 е на ~130 км). Рядко — в ясна нощ, най-много веднъж на денонощие
// (шанс ~35 % на нощ): пада отвисоко с проблясък, виси и се люлее, пръстенът светлини отдолу се върти (зелено/бяло), после зелено-белият лъч
// светва до земята за ~5 s („отвличане“ — светло петно на земята), угасва и НЛО-то рязко изчезва нагоре настрани. Първия път — скрито постижение „🛸 Не сме сами“ (S.ufo).
// Моделът: assets/heavy/ufo/ufo.glb (Meshy AI, Темидасофт; в Blender — 20 хил. △, webp 1024, Ø 24 м): Body (+ нощна карта — оранжевите светлини),
// Ring (12 светлини, vertex color), Beam (заместен тук от собствен конус с шейдър).
//   const u = createUfo({ scene, S(), target() → Vector3, camera, night() 0..1, clear() → bool, cycle() → № на денонощието, on() → bool, Sound, toast, pop, save })
//   u.update(rdt, running);  u.now() — веднага до точката, която гледаме (Лабораторията; без постижение);  u.state()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const URL = 'assets/heavy/ufo/ufo.glb', CITY = 'lasvegas', CHANCE = 0.35, K = 1.3;   // K — мащабът (Ø ~31 м, да се вижда от обичайната височина на камерата)
// времевата линия (s): появата, виси, лъчът се пали, лъч, угасва, виси, изчезва
const T_IN = 0.7, T_BEAM0 = 4.2, T_BEAM1 = 4.7, T_BEAM2 = 10.2, T_BEAM3 = 10.7, T_OUT = 12.2, T_END = 12.6;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function glowTex(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  r.addColorStop(0, inner); r.addColorStop(0.4, outer); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createUfo(d) {
  let M = null, loading = null, G = null, ring = null, beamU = null, spot = null, flash = null, hum = null;
  let t = -1, from = new THREE.Vector3(), at = new THREE.Vector3(), away = new THREE.Vector3(), ground = new THREE.Vector3(), H = 120;
  let rolled = -1, wait = -1, forced = false, shows = 0;
  const load = () => loading || (loading = new GLTFLoader().loadAsync(URL).then(g => { M = g.scene; build(); }).catch(e => { console.warn('ufo', e); }));

  function build() {
    G = new THREE.Group(); G.name = 'ufo'; G.visible = false; const o = M; G.add(o); G.scale.setScalar(K);
    let beamTop = -4.1;
    o.traverse(m => {
      if (!m.isMesh) return; m.castShadow = m.receiveShadow = false;
      const nm = m.name + ' ' + (m.parent && m.parent.name);
      if (/Beam/.test(nm)) { beamTop = m.position.y; m.visible = false; }
      else if (/Ring/.test(nm)) { ring = m; m.material = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }); }
      else if (m.material) { const mt = m.material; mt.metalness = Math.min(mt.metalness ?? 0, 0.35); if (mt.emissiveMap) { mt.emissive.setRGB(1, 1, 1); mt.emissiveIntensity = 1.6; } }
    });
    // лъчът: пресечен конус, горе y=0, долу y=-1 (scale.y = дължината), шейдър — избледнява надолу, бягащи пръстени нагоре
    const cg = new THREE.CylinderGeometry(1.8, 7.5, 1, 32, 1, true).translate(0, -0.5, 0);
    beamU = { uOn: { value: 0 }, uT: { value: 0 } };
    const bm = new THREE.ShaderMaterial({ uniforms: beamU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
      vertexShader: 'varying float vY; varying vec3 vN, vV; void main() { vY = -position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uOn, uT; varying float vY; varying vec3 vN, vV; void main() { float rim = 1.0 - abs(dot(normalize(vN), normalize(vV))); float band = 0.75 + 0.25 * sin(vY * 38.0 + uT * 7.0);'
        + ' float a = uOn * mix(0.42, 0.12, vY) * band * (0.45 + 0.55 * (1.0 - rim)); gl_FragColor = vec4(vec3(0.55, 1.0, 0.65) * a, a); }' });
    const beam = new THREE.Mesh(cg, bm); beam.name = 'ufo-beam'; beam.position.y = beamTop; beam.frustumCulled = false; beam.renderOrder = 4; G.add(beam); G.userData.beam = beam; G.userData.beamTop = beamTop;
    // светлото петно на земята и проблясъкът
    spot = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex('rgba(220,255,225,1)', 'rgba(110,255,140,.55)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false, fog: false }));
    spot.scale.setScalar(7.5 * K * 1.25); spot.renderOrder = 3; spot.visible = false; spot.name = 'ufo-spot';
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(150,255,190,.5)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false, fog: false }));
    flash.visible = false; flash.name = 'ufo-flash';
    d.scene.add(G, spot, flash);
  }

  // 🔊 тихо бръмчене (два разстроени тона през нискочестотен филтър) и „свистене“ при изчезването — през шината на звуците
  function sound(kind) {
    const S = d.Sound; if (!S || !S.ctx || !S.master) return; const ctx = S.ctx, n = ctx.currentTime;
    const dist = d.camera ? d.camera.position.distanceTo(G.position) : 300, v = 0.22 / (1 + dist / 400);
    if (kind === 'hum') {
      const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(v, n + 0.8);
      const os = [92, 93.7, 184].map((fr, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(n); return o; });
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 3.2; lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start(n);
      f.connect(g); g.connect(S.master); hum = { g, os: [...os, lfo] };
    } else if (kind === 'off' && hum) {
      const h = hum; hum = null; h.g.gain.cancelScheduledValues(n); h.g.gain.setValueAtTime(h.g.gain.value, n); h.g.gain.linearRampToValueAtTime(0, n + 0.3); h.os.forEach(o => o.stop(n + 0.35));
    } else if (kind === 'zip') {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(260, n); o.frequency.exponentialRampToValueAtTime(2400, n + 0.45);
      g.gain.setValueAtTime(v * 0.9, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.5); o.connect(g); g.connect(S.master); o.start(n); o.stop(n + 0.55);
    }
  }

  function start(force) {
    if (!G) return false;
    const c = d.target(), cam = d.camera ? d.camera.position : c.clone().add(new THREE.Vector3(0, 200, 200));
    const dir = new THREE.Vector3(c.x - cam.x, 0, c.z - cam.z); if (dir.lengthSq() < 1) dir.set(0, 0, -1); dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    // в кадъра: лъч от камерата през горната половина на екрана (x — встрани, y 0,35–0,55) до хоризонталата на височина H — отдолу остава място за лъча до земята
    H = Math.min(105 + Math.random() * 45, Math.max(40, cam.y * 0.4));   // ниска камера — НЛО-то е между нея и земята
    let ok = false;
    if (d.camera) {
      const rc = new THREE.Raycaster(), nx = -0.55 + Math.random() * 0.65;   // вляво от средата — вдясно е страничният панел
      for (const ny of [0.5, 0.35, 0.2, 0.05]) {
        rc.setFromCamera(new THREE.Vector2(nx, ny), d.camera); const o = rc.ray.origin, v = rc.ray.direction;
        if (Math.abs(v.y) < 1e-3) continue; const k = (H - o.y) / v.y; if (k <= 150 || k > 1100) continue;
        ground.set(o.x + v.x * k, 0, o.z + v.z * k); ok = true; break;
      }
    }
    if (!ok) { const a = 60 + Math.random() * 120, s = (Math.random() - 0.5) * 140; ground.set(c.x + dir.x * a + side.x * s, 0, c.z + dir.z * a + side.z * s); }
    at.set(ground.x, H, ground.z); from.set(ground.x - dir.x * 30, H + 70, ground.z - dir.z * 30);
    away.set(ground.x + side.x * (Math.random() < 0.5 ? -1 : 1) * 700, H + 650, ground.z + side.z * 700);
    t = 0; forced = !!force; G.visible = true; G.position.copy(from); G.scale.setScalar(0.001); shows++;
    sound('hum'); return true;
  }

  function finish() {
    t = -1; G.visible = false; spot.visible = false; flash.visible = false; beamU.uOn.value = 0; sound('off');
    const S = d.S(); if (!forced && S && !S.ufo && S.cityId === CITY) {
      S.ufo = { day: S.day }; d.save && d.save();
      d.toast && d.toast('🛸 Над Лас Вегас мина НЛО — светлинен лъч до земята и изчезна. От Зона 51 мълчат.', 'good');
      d.pop && d.pop('ufo-vegas', '🏆 Не сме сами', 'Скрито постижение: НЛО над Лас Вегас в ясна нощ');
    }
  }

  function update(rdt, running) {
    const S = d.S();
    if (t < 0) {
      if (!S || S.cityId !== CITY || !running || !d.on()) { wait = -1; return; }
      const nt = d.night(), cy = d.cycle();
      if (wait >= 0) { if (nt < 0.75 || !d.clear()) { wait = -1; return; } wait -= rdt; if (wait < 0) { if (M) start(false); else { load(); wait = 1; } } return; }
      if (nt > 0.85 && rolled !== cy) { rolled = cy; if (d.clear() && Math.random() < CHANCE) { wait = 2 + Math.random() * 14; load(); } }
      return;
    }
    if (!running) return;   // пауза — застива
    t += rdt; const time = performance.now() / 1000; beamU.uT.value = time;
    // позиция и мащаб по времевата линия
    if (t < T_IN) { const k = ss(0, T_IN, t); G.position.lerpVectors(from, at, k); G.scale.setScalar(K * Math.max(0.001, k)); }
    else if (t < T_OUT) { G.position.set(at.x + Math.sin(t * 0.7) * 3, at.y + Math.sin(t * 1.7) * 1.4, at.z + Math.cos(t * 0.6) * 3); G.scale.setScalar(K); }
    else { const k = ss(T_OUT, T_END, t); G.position.lerpVectors(at, away, k * k); G.scale.setScalar(K * Math.max(0.001, 1 - k)); if (!G.userData.zip) { G.userData.zip = 1; sound('zip'); } }
    G.rotation.z = Math.sin(t * 0.9) * 0.05; G.rotation.x = Math.cos(t * 0.75) * 0.04;
    if (ring) { ring.rotation.y += rdt * 1.4; ring.material.color.setScalar(0.75 + 0.25 * Math.sin(time * 9)); }
    // лъчът — до земята
    const on = ss(T_BEAM0, T_BEAM1, t) * (1 - ss(T_BEAM2, T_BEAM3, t)), flick = t < T_BEAM1 ? (Math.sin(time * 60) > 0 ? 1 : 0.4) : 1;
    beamU.uOn.value = on * flick; const bm = G.userData.beam; bm.visible = on > 0.001;
    if (bm.visible) bm.scale.y = Math.max(1, (G.position.y + G.userData.beamTop * K) / K);
    spot.visible = on > 0.001; if (spot.visible) { spot.position.set(G.position.x, 0.6, G.position.z); spot.material.opacity = 0.85 * on * flick; }
    // проблясък при появата и при изчезването
    const fl = Math.max(1 - ss(0, 0.5, t), t > T_OUT ? 1 - ss(T_OUT + 0.15, T_END, t) : 0);
    flash.visible = fl > 0.01; if (flash.visible) { flash.position.copy(G.position); flash.scale.setScalar(70 * (0.5 + fl)); flash.material.opacity = fl; }
    if (t >= T_END) { G.userData.zip = 0; finish(); }
  }

  return {
    update,
    async now() { await load(); if (!G) return null; if (t >= 0) finish(); start(true); return { x: Math.round(ground.x), z: Math.round(ground.z), h: Math.round(H) }; },
    state: () => ({ loaded: !!M, active: t >= 0, t: +t.toFixed(2), wait: +wait.toFixed(1), rolled, shows, seen: !!(d.S() && d.S().ufo) }),
  };
}
