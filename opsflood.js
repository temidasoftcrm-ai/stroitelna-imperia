// opsflood.js — 🌊 оперативната 3D карта „Наводнение — аварийна операция“ (логиката: opskinds.js → flood; основата: opskit.js).
// Река по оста X (z = −11…11), нисък южен бряг с квартала (къщи, улици, паркирани коли, подстанция), висок северен бряг (+1,2 м)
// с пункта за евакуация (палатки, линейка, генератори) и пристан. Каменен мост на x = −25.
// Водата: една равнина на височина по нивото (0 → само реката; 100 → 2,3 м над квартала). Дъжд, докато водата расте.
// Хората чакат по покривите; лодките ги возят до пристана, хеликоптерът ги вдига с въже; спасените стоят на пункта.
import { openOpsScene, THREE } from './opskit.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const H2 = ['h2-blue', 'h2-greyporch', 'h2-pink', 'h2-porch', 'h2-swedish', 'h2-townhouse', 'h2-brickcabin', 'h2-lodge'].map(k => `assets/heavy/houses2/${k}.glb`);
const OPS = 'assets/heavy/ops/', CARS = 'assets/heavy/cars/';
const NB = 2.6, DOCK = [8, -12.5], EVAC = [12, -24], SUB = [32, 18];
const wy = lv => -0.8 + lv * 0.031;   // височината на водата

export function openOpsFlood(ops, o = {}) {
  return openOpsScene(ops, o, {
    title: 'Наводнение в крайречния квартал', sky: 0x8d99a6, cam: [-30, 26, 44], target: [4, 1, 8], bounds: [-45, 45, -32, 50], maxDist: 80,
    sirens: { med: 'siren-ambulance', power: 'siren-police-2' },
    ambient: { file: 'flood', vol: m => m.out ? 0.12 : Math.min(0.8, 0.25 + m.level / 160) },   // шумът на водата — по-силен с нивото
    cars: {
      med: [{ model: CARS + 'amb-eu.glb', kind: 'ambulance', len: 7.2, y: NB, path: [[-90, -30], [EVAC[0] + 4, -30]] }],
      power: [{ model: CARS + 'car-hilux.glb', kind: 'utility', len: 5.6, y: NB, path: [[-90, -30.5], [EVAC[0] - 6, -30.5]] }, { model: 'assets/heavy/dump-truck.glb', len: 6, path: [[90, 27], [SUB[0] + 4, 27], [SUB[0] + 4, 25]], delay: 0.03 }],
      sand: [{ model: CARS + 'car-truck.glb', len: 7, path: [[90, 27], [SUB[0] - 6, 27]] }, { model: CARS + 'car-truck.glb', len: 7, path: [[90, 26.5], [6, 26.5], [6, 15]], delay: 0.03 }],
    },
    labelAt: (k, m) => k === 'boat' ? boatLb : k === 'heli' ? heliLb : null,
    build,
  });
}
let boatLb = null, heliLb = null;

function build(K) {
  const { scene, mat, plane, box, place, ctex, own, person, drop, walkTo } = K;
  // ---- земя: северният бряг (висок), речното корито, южният бряг (квартал)
  plane(260, 120, mat(0x6f7f58), 0, NB, -71);
  box(260, NB + 2.6, 1.2, mat(0x8a857a), 0, (NB - 2.6) / 2, -11.6);   // каменна стена на северния бряг
  plane(260, 26, mat(0x3a3328), 0, -2.6, 0);
  plane(260, 120, mat(0x74835e), 0, 0, 71);
  { const slope = new THREE.Mesh(own(new THREE.PlaneGeometry(260, 3.2)), mat(0x5f5a48)); slope.rotation.x = -Math.PI / 2 - 0.68; slope.position.set(0, -1.3, 11.6); scene.add(slope); }
  // улиците на квартала и на северния бряг; бетонен пристан
  const asph = mat(0x3d4046, { roughness: 0.95 });
  plane(260, 7, asph, 0, 0.02, 27); plane(260, 7, asph, 0, 0.02, 41); plane(7, 70, asph, -25, 0.03, 45); plane(260, 8, asph, 0, NB + 0.02, -30);
  plane(7, 17, asph, -25, NB + 0.03, -20.5);   // от моста до улицата на северния бряг (кварталната улица по x = −25 стига до моста от юг)
  box(6, 0.4, 4, mat(0x9a958c), DOCK[0], NB - 0.2, DOCK[1] + 1.5);
  // мостът: каменен модел по оста Z
  place('assets/heavy/bridge/stone.glb', { len: 30 }, b => { b.position.set(-25, -0.4, 0); b.rotation.y = Math.PI / 2; scene.add(b); addRect(-25, 0, b.userData.sz.z / 2, b.userData.sz.x / 2); });   // през реката (от юг на север)
  // ---- къщите: три реда; покривите — точките, където чакат хората
  const roofs = [];
  Promise.all(H2.map(K.load)).then(gs => { gs = gs.filter(Boolean); if (!gs.length || K.shut()) return; let n = 0;
    for (const [z, ry] of [[19.5, Math.PI], [34, 0], [48.5, Math.PI]]) for (let x = -52; x <= 52; x += 13) { if (Math.abs(x + 25) < 6 || (z < 25 && Math.abs(x - SUB[0]) < 8)) continue;
      const g = gs[n++ % gs.length], h = K.fitTo(g.scene.clone(true), { w: 9 + (n % 3), maxH: 9 }); K.shadows(h); h.position.set(x, 0, z); h.rotation.y = ry; scene.add(h); roofs.push([x, h.userData.sz.y * 0.82, z]); addRect(x, z, h.userData.sz.x / 2, h.userData.sz.z / 2); } });
  // паркирани коли (водата ги залива)
  ['car-polo', 'car-corolla', 'car-p206', 'car-renegade', 'car-taxi', 'car-accord'].forEach((c, i) => place(CARS + c + '.glb', { len: 4.4 }, v => { v.position.set(-40 + i * 15, 0, i % 2 ? 29.5 : 38.5); v.rotation.y = Math.PI / 2; scene.add(v); }));
  // ---- подстанцията: ограда, трансформатори, изолатори; искри, когато е под вода
  const sub = new THREE.Group(); sub.position.set(SUB[0], 0, SUB[1]); scene.add(sub);
  { const gm = mat(0x9aa0a6, { metalness: 0.6, roughness: 0.4 }), dark = mat(0x4a4f55, { metalness: 0.5 }), fence = mat(0xb8bcc0, { metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.5 });
    for (const [x, z, w, d] of [[0, -4, 12, 0.05], [0, 4, 12, 0.05], [-6, 0, 0.05, 8], [6, 0, 0.05, 8]]) box(w, 2.2, d, fence, x, 1.1, z, sub);
    for (const x of [-3, 0.5, 4]) { box(2.2, 2, 1.6, dark, x, 1, 0, sub); for (const dz of [-0.5, 0, 0.5]) box(0.12, 1.1, 0.12, gm, x, 2.55, dz, sub); } box(10, 0.3, 0.3, gm, 0, 3.4, 0, sub); }
  const sparks = K.fire(SUB[0], 2.6, SUB[1], 0.6, 3, true);
  // ---- пунктът за евакуация: палатки, генератори (светят, когато има ток), спасените
  const tentM = mat(0xf2f2f0), red = mat(0xd32f2f);
  for (const [dx, dz] of [[-4, 0], [2, 0], [8, 0]]) { const g = new THREE.Group(); g.position.set(EVAC[0] + dx, NB, EVAC[1] + dz); scene.add(g); box(4.4, 0.1, 4, tentM, 0, 2.6, 0, g); for (const [x, z] of [[-2.1, -1.9], [2.1, -1.9], [-2.1, 1.9], [2.1, 1.9]]) box(0.08, 2.6, 0.08, tentM, x, 1.3, z, g); box(1.2, 0.02, 0.36, red, 0, 2.66, 0, g); box(0.36, 0.02, 1.2, red, 0, 2.66, 0, g); }
  const genM = own(new THREE.MeshStandardMaterial({ color: 0x2f6b3a, emissive: 0xffc04a, emissiveIntensity: 0 })), gens = [];
  for (const dx of [-8, -6]) gens.push(box(1.6, 1.2, 1, genM, EVAC[0] + dx, NB + 0.6, EVAC[1] + 5));
  const genLight = new THREE.PointLight(0xffd27a, 0, 18, 1.6); genLight.position.set(EVAC[0], NB + 4, EVAC[1]); scene.add(genLight);
  // ---- пясъчната дига: появява се постепенно около подстанцията и по брега
  const bagG = own(new THREE.BoxGeometry(0.62, 0.24, 0.38)), bagM = mat(0xb59a6b), bagSpots = [];
  for (let x = SUB[0] - 6.5; x <= SUB[0] + 6.5; x += 0.64) for (const z of [SUB[1] - 4.6, SUB[1] + 4.6]) bagSpots.push([x, z, 0, 'sub']);
  for (let z = SUB[1] - 4.2; z <= SUB[1] + 4.2; z += 0.64) for (const x of [SUB[0] - 6.6, SUB[0] + 6.6]) bagSpots.push([x, z, Math.PI / 2, 'sub']);
  for (let x = -52; x <= 52; x += 0.64) if (Math.abs(x + 25) > 4) bagSpots.push([x, 12.6, 0, 'bank']);   // брегът — без моста
  let bagDk = null, spots = bagSpots; const bags = new THREE.InstancedMesh(bagG, bagM, bagSpots.length * 3); bags.castShadow = bags.receiveShadow = true; bags.count = 0; scene.add(bags);
  const dm = new THREE.Object3D(); let bagN = 0;
  // ---- водата: равнина с движещи се вълни (нормали) и дъжд
  const nT = new THREE.TextureLoader().load('assets/heavy/water/waternormals.jpg'); nT.wrapS = nT.wrapT = THREE.RepeatWrapping; nT.repeat.set(18, 12); own(nT);
  // водата (всичко на видеокартата, без тежки модели):
  //   вълни — няколко синусоиди в различни посоки; пяна по гребените; кална кафеникава вода;
  //   🪞 отражение — огледален кадър (Reflector, половин резолюция), изкривен от вълните, по-силен под нисък ъгъл (Френел);
  //   🌧️ кръгчета от дъжда — разширяващи се пръстени в клетки, докато вали;
  //   🚤 следа зад лодките — V-образна пяна и бяла пяна около носа;
  //   🏠 пяна около стените — около къщите, моста, подстанцията и брега (правоъгълници в униформи).
  const RMAX = 40, rects = Array.from({ length: RMAX }, () => new THREE.Vector4(0, 0, 0, 0));
  const wU = { uT: { value: 0 }, uAmp: { value: 0.35 }, uRain: { value: 1 }, tRefl: { value: null }, uTexMat: { value: new THREE.Matrix4() }, uBoat: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uRect: { value: rects }, uRectN: { value: 0 } };
  const reflector = new Reflector(own(new THREE.PlaneGeometry(260, 160)), { textureWidth: Math.round(innerWidth * 0.5), textureHeight: Math.round(innerHeight * 0.5), clipBias: 0.02, color: 0x888888 });
  reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, 0, 60); reflector.material.colorWrite = false; reflector.material.depthWrite = false; reflector.renderOrder = -1; scene.add(reflector);
  own(reflector.getRenderTarget()); own(reflector.material);
  wU.tRefl.value = reflector.getRenderTarget().texture; wU.uTexMat.value = reflector.material.uniforms.textureMatrix.value;
  const wM = own(new THREE.MeshStandardMaterial({ color: 0x6e5f44, roughness: 0.16, metalness: 0.15, normalMap: nT, normalScale: new THREE.Vector2(0.8, 0.8), transparent: true, opacity: 0.96 }));
  wM.onBeforeCompile = sh => { Object.assign(sh.uniforms, wU);
    sh.vertexShader = 'uniform float uT; uniform float uAmp; varying float vCrest; varying vec3 vWPos;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `vec2 P = position.xy; float t = uT;
        vec3 W[4]; W[0] = vec3(0.05, 0.02, 1.0); W[1] = vec3(-0.03, 0.045, 0.7); W[2] = vec3(0.09, -0.04, 0.4); W[3] = vec3(-0.12, -0.08, 0.25);
        float h = 0.0; vec2 g = vec2(0.0);
        for (int i = 0; i < 4; i++) { vec2 k = W[i].xy; float a = W[i].z * uAmp, ph = dot(k, P) + t * (1.2 + float(i) * 0.35); h += a * sin(ph); g += a * cos(ph) * k; }
        vCrest = clamp(h / (uAmp * 1.6) * 0.5 + 0.5, 0.0, 1.0);
        vec3 objectNormal = normalize(vec3(-g.x, -g.y, 1.0));`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.xy, position.z + h);')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying float vCrest; varying vec3 vWPos; uniform float uT; uniform float uRain; uniform sampler2D tRefl; uniform mat4 uTexMat;
      uniform vec4 uBoat[2]; uniform vec4 uRect[${RMAX}]; uniform int uRectN;
      float hsh(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
      // кръгчета от дъжда: във всяка клетка 2,2 м — пръстен, който се разширява и изчезва
      float rip(vec2 p) { vec2 c = floor(p / 1.6); float acc = 0.0;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { vec2 cl = c + vec2(float(i), float(j)); float hh = hsh(cl), ph = fract(uT * 0.8 + hh);
          vec2 ctr = (cl + 0.2 + 0.6 * vec2(hh, fract(hh * 7.31))) * 1.6; float d = length(p - ctr), r = ph * 0.8;
          acc += sin(clamp((d - r) * 16.0, -3.1416, 3.1416)) * (1.0 - ph) * smoothstep(0.3, 0.0, abs(d - r)); } return acc; }
      // пяна: следа зад лодките + около стените
      float foamAt(vec2 p) { float f = 0.0;
        for (int b = 0; b < 2; b++) { vec4 B = uBoat[b]; if (B.w <= 0.01) continue; vec2 d = p - B.xy, fw = vec2(sin(B.z), cos(B.z)); float al = -dot(d, fw), sd = abs(d.x * fw.y - d.y * fw.x);
          if (al > 0.0 && al < 22.0) { f += smoothstep(0.7, 0.0, abs(sd - al * 0.36)) * (1.0 - al / 22.0) * B.w; f += smoothstep(0.9, 0.0, sd) * (1.0 - al / 9.0) * 0.8 * B.w; }
          f += smoothstep(2.6, 1.4, length(d)) * 0.6 * B.w; }
        for (int i = 0; i < ${RMAX}; i++) { if (i >= uRectN) break; vec4 R = uRect[i]; vec2 q = abs(p - R.xy) - R.zw; float sdr = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
          if (sdr > -0.1 && sdr < 1.4) f += smoothstep(1.4, 0.0, sdr) * (0.55 + 0.45 * sin(uT * 2.3 + p.x * 2.1 + p.y * 1.7)); }
        return clamp(f, 0.0, 1.0); }
      ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fo = foamAt(vWPos.xz) * (0.7 + 0.3 * texture2D(normalMap, vWPos.xz * 0.3 + uT * 0.05).r);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.76, 0.68), smoothstep(0.78, 0.98, vCrest) * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.9, 0.86), fo * 0.85);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (uRain > 0.01) { float e = 0.06, r0 = rip(vWPos.xz), rx = rip(vWPos.xz + vec2(e, 0.0)) - r0, rz = rip(vWPos.xz + vec2(0.0, e)) - r0;
          normal = normalize(normal + (viewMatrix * vec4(-rx * 1.6, 0.0, -rz * 1.6, 0.0)).xyz * uRain); }`)
      .replace('#include <opaque_fragment>', `vec4 rc = uTexMat * vec4(vWPos, 1.0); vec2 ruv = rc.xy / rc.w + normal.xy * 0.035;
        vec3 refl = texture2D(tRefl, ruv).rgb; vec3 Vv = normalize(cameraPosition - vWPos); float fres = 0.1 + 0.9 * pow(1.0 - max(Vv.y, 0.0), 4.0);
        outgoingLight = mix(outgoingLight, refl, clamp(fres * 0.5, 0.0, 0.55) * (1.0 - fo * 0.8));
        #include <opaque_fragment>`); };
  const water = new THREE.Mesh(own(new THREE.PlaneGeometry(260, 160, 220, 130)), wM);
  water.rotation.x = -Math.PI / 2; water.position.set(0, wy(30) + 0.15, 60); water.receiveShadow = true; scene.add(water);
  const addRect = (x, z, hx, hz) => { const n = wU.uRectN.value; if (n >= RMAX) return; rects[n].set(x, z, hx, hz); wU.uRectN.value = n + 1; };
  addRect(SUB[0], SUB[1], 6.6, 4.6); addRect(0, -12, 130, 0.6);   // подстанцията и стената на северния бряг
  const rainG = own(new THREE.BoxGeometry(0.02, 0.9, 0.02)), rain = new THREE.InstancedMesh(rainG, own(new THREE.MeshBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.45 })), 700); scene.add(rain);
  const rd = Array.from({ length: 700 }, () => [(Math.random() - 0.5) * 90, Math.random() * 30, (Math.random() - 0.5) * 80]);
  // ---- лодките и хеликоптерът (своя траектория), хората
  const boats = [], heli = { h: null, rot: [], tgt: null, t: 0, y: 40, x: -90, z: -30 };
  for (let i = 0; i < 2; i++) place(OPS + 'rescue-boat.glb', { len: 4.2 }, v => { scene.add(v); v.visible = false; boats.push({ h: v, x: -90 - i * 12, z: -2 + i * 3, st: 'go', tgt: null, load: 0, crew: [] }); });
  place(OPS + 'heli.glb', { len: 11 }, v => { scene.add(v); v.visible = false; heli.h = v; v.traverse(q => { if (/rotor_pales|moyeu/.test(q.name)) heli.rot.push([q, 'y']); else if (/rotor_anticouple/.test(q.name)) heli.rot.push([q, 'x']); }); });
  const rope = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])), own(new THREE.LineBasicMaterial({ color: 0xffd54a }))); rope.visible = false; scene.add(rope);
  const waiting = [], saved = [], crews = [];
  boatLb = null; heliLb = null;
  let rainOn = true;
  return {
    update(m, tt, dt) {
      const y = wy(m.level); water.position.y = y + 0.15; nT.offset.x = (tt * 0.02) % 1; nT.offset.y = (tt * 0.035) % 1; wU.uT.value = tt; wU.uAmp.value = m.t < m.peakT ? 0.16 : 0.07; reflector.position.y = y + 0.15; wU.uRain.value += ((m.t < m.peakT && !m.out ? 1 : 0) - wU.uRain.value) * Math.min(1, dt);   /* докато прииждa — по-бурна */
      // дъжд — докато водата расте
      rainOn = m.t < m.peakT && !m.out; rain.visible = rainOn;
      if (rainOn) { const c = K.ctl.target; for (const [i, d] of rd.entries()) { d[1] -= dt * 22; if (d[1] < y) d[1] += 30; dm.position.set(c.x + d[0], d[1], c.z + d[2]); dm.rotation.set(0.15, 0, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); rain.setMatrixAt(i, dm.matrix); } rain.instanceMatrix.needsUpdate = true; }
      // небето: сиво при дъжд, просветлява след това
      const k = rainOn ? 0 : Math.min(1, (m.t - m.peakT) / 1.5); K.sky.setRGB(0.5 + k * 0.17, 0.56 + k * 0.2, 0.62 + k * 0.24); scene.fog.color.copy(K.sky); K.sun.intensity = 0.9 + k * 1.3;
      // хората по покривите (до 24 фигури) — махат
      const want = Math.min(24, Math.ceil(m.stranded / 2));
      if (K.peds().length && roofs.length) { while (waiting.length < want) { const r = roofs[waiting.length % roofs.length], P = person(K.peds()[waiting.length % K.peds().length]); P.roof = r; P.at(r[0] + (Math.random() - 0.5) * 3, r[2] + (Math.random() - 0.5) * 2, Math.random() * 6, r[1]); P.anim('Waving'); waiting.push(P); }
        while (waiting.length > want) { const P = waiting.pop(); drop(P); } }
      // спасените на пункта (до 20)
      const sv = Math.min(20, Math.floor(m.rescued / 3));
      if (K.peds().length) while (saved.length < sv) { const P = person(K.peds()[(saved.length + 3) % K.peds().length], { tint: m.teams.med.st === 'onsite' ? 0xb05030 : null }); P.at(EVAC[0] - 6 + (saved.length % 7) * 2.2, EVAC[1] - 3.5 - Math.floor(saved.length / 7) * 1.6, Math.PI, NB); P.anim(saved.length % 3 ? 'Idle' : 'Talk_General'); saved.push(P); }
      // подстанцията: искри, докато е под вода; генераторите светят
      sparks.update(tt, m.sub === 'flooded' && Math.sin(tt * 9) > 0.6 ? 0.6 : 0);
      const gOn = m.teams.power.st === 'onsite'; genM.emissiveIntensity = gOn ? 0.6 + Math.sin(tt * 20) * 0.1 : 0; genLight.intensity = gOn ? 4 : 0;
      // пясъчната дига: расте, докато екипът е на място
      // дигата — където е избрано (около подстанцията / по брега / и двете); при „и двете“ — по-бавно
      const dk = (m.dec && m.dec.dike) || 'sub'; if (dk !== bagDk) { bagDk = dk; bagN = 0; bags.count = 0; spots = bagSpots.filter(q => dk === 'both' || q[3] === dk); }
      if (m.teams.sand.st === 'onsite' && bagN < spots.length * 3) { bagN = Math.min(spots.length * 3, bagN + Math.ceil(dt * (dk === 'both' ? 110 : 160)));
        for (let i = bags.count; i < bagN; i++) { const s = spots[i % spots.length], row = Math.floor(i / spots.length); dm.position.set(s[0] + (row % 2) * 0.3, 0.12 + row * 0.24, s[1]); dm.rotation.set(0, s[2] + (Math.random() - 0.5) * 0.1, 0); dm.updateMatrix(); bags.setMatrixAt(i, dm.matrix); }
        bags.count = bagN; bags.instanceMatrix.needsUpdate = true; }
      // дигата прелива — пръски над чувалите по брега
      if (m.event && m.event.id === 'levee') for (let k = 0; k < 3; k++) { const x = -40 + Math.random() * 80; K.spray([x, y + 0.2, 11.6], [x + (Math.random() - 0.5), 0.2, 14.5], 0.6, 1); }
      // 🚤 лодките: пристигат по реката до пристана; после — до покрив и обратно
      const bOn = m.teams.boat.st === 'onsite', bGo = m.teams.boat.st === 'enroute'; boatLb = null;
      for (const [i, B0] of boats.entries()) { if (!B0.crew.length && K.peds().length) for (let j = 0; j < 2; j++) { const P = person(K.ff() || K.peds()[0]); P.body.position.y = 0.45; B0.crew.push(P); P.anim(j ? 'Sit_Breathing' : 'Sit_Table_Idle'); }   /* спасителите — седнали */
        B0.h.visible = bOn || bGo; if (!B0.h.visible) continue;
        if (bGo) { const p = Math.min(1, (m.t - m.teams.boat.t0) / m.teams.boat.eta); B0.x = -90 + (DOCK[0] - 2 + i * 4 + 90) * p; B0.z = 2 + i * 3; B0.path = null; }
        else { // само по реката и улиците: река (z ≈ 3) → улицата на моста (x = −25) → улица z = 27 / 41 → до къщата; обратно по същия път
          if (B0.wait > 0) B0.wait -= dt; else if (!B0.path || !B0.path.length) { const w = waiting[(i * 5 + (tt | 0)) % Math.max(1, waiting.length)], rz = 3 + i * 2.5;
            const lane = z => z < 27 ? 27 : z < 41 ? (z - 27 < 41 - z ? 27 : 41) : 41;
            if (B0.home !== false && w && y > 0.4) { const sz = lane(w.z) + (i ? 1.2 : -1.2); B0.path = [[B0.x, rz], [-25 + i * 1.5, rz], [-25 + i * 1.5, sz], [w.x, sz]]; B0.home = false; }
            else { const sz = B0.z; B0.path = B0.z > 13 ? [[-25 + i * 1.5, sz], [-25 + i * 1.5, rz], [DOCK[0] + i * 3, rz], [DOCK[0] + i * 3, DOCK[1] + 1.5]] : [[DOCK[0] + i * 3, rz], [DOCK[0] + i * 3, DOCK[1] + 1.5]]; B0.home = true; } }
          if (B0.path && B0.path.length) { const [tx, tz] = B0.path[0], dx = tx - B0.x, dz = tz - B0.z, d = Math.hypot(dx, dz);
          if (d > 0.4) { const s0 = Math.min(d, 7 * dt); B0.x += dx / d * s0; B0.z += dz / d * s0; } else { B0.path.shift(); if (!B0.path.length) B0.wait = 1.5; } } }   /* спира за малко при къщата и на пристана */
        const vx = B0.x - (B0.px ?? B0.x), vz = B0.z - (B0.pz ?? B0.z); if (Math.hypot(vx, vz) > 0.002) B0.hdg = Math.atan2(vx, vz); B0.px = B0.x; B0.pz = B0.z; const hdg = B0.hdg ?? Math.PI / 2;
        B0.h.position.set(B0.x, Math.max(y, -0.7) + Math.sin(tt * 2 + i) * 0.05, B0.z); B0.h.rotation.y = hdg + Math.PI; wU.uBoat.value[i].set(B0.x, B0.z, hdg, Math.min(1, Math.hypot(vx, vz) / Math.max(dt, 1e-3) / 5));   /* моделът е с носа към −Z */
        B0.crew.forEach((P, j) => P.at(B0.x + Math.sin(hdg) * (j ? -0.9 : 0.5), B0.z + Math.cos(hdg) * (j ? -0.9 : 0.5), hdg, Math.max(y, -0.7) + 0.05)); if (i === 0) boatLb = [B0.x, Math.max(y, 0) + 2.5, B0.z]; }
      for (const [i, B0] of boats.entries()) { for (const P of B0.crew) P.p.visible = B0.h.visible; if (!B0.h.visible) wU.uBoat.value[i].w = 0; }
      // 🚁 хеликоптерът: долита от запад, после виси над покривите (въже до покрива)
      const hOn = m.teams.heli.st === 'onsite', hGo = m.teams.heli.st === 'enroute'; heliLb = null;
      if (heli.h) { heli.h.visible = hOn || hGo; rope.visible = false;
        if (heli.h.visible) { for (const [q, ax] of heli.rot) q.rotation[ax] += dt * 40;
          if (hGo) { const p = Math.min(1, (m.t - m.teams.heli.t0) / m.teams.heli.eta); heli.x = -90 + 90 * p; heli.z = -30 + 50 * p; heli.y = 40 - 18 * p; }
          else { heli.t -= dt; if (!heli.tgt || heli.t <= 0) { const w = waiting[(Math.random() * waiting.length) | 0]; heli.tgt = w ? [w.x, w.roof[1] + 9, w.z] : [EVAC[0], NB + 14, EVAC[1]]; heli.t = 6; }
            const [ax, ay, az] = heli.tgt; heli.x += (ax - heli.x) * Math.min(1, dt * 0.8); heli.z += (az - heli.z) * Math.min(1, dt * 0.8); heli.y += (ay - heli.y) * Math.min(1, dt * 0.8);
            if (Math.hypot(ax - heli.x, az - heli.z) < 1.5 && heli.tgt[1] > NB + 14) { rope.visible = true; const p = rope.geometry.attributes.position; p.setXYZ(0, heli.x, heli.y - 0.5, heli.z); p.setXYZ(1, heli.x, heli.tgt[1] - 9, heli.z); p.needsUpdate = true; } }
          const hvx = heli.x - (heli.px ?? heli.x), hvz = heli.z - (heli.pz ?? heli.z); if (Math.hypot(hvx, hvz) > 0.01) heli.hdg = Math.atan2(hvx, hvz) + Math.PI; heli.px = heli.x; heli.pz = heli.z;   /* моделът гледа към −Z */
          heli.h.position.set(heli.x, heli.y + Math.sin(tt * 1.3) * 0.3, heli.z); heli.h.rotation.y = heli.hdg ?? 0; heliLb = [heli.x, heli.y + 3, heli.z]; } }
    },
    close() { boatLb = heliLb = null; },
  };
}
