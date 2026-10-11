// scenery.js — околност за изгледите на строежите на жп линии и магистрали: хълмове и планини, ниви, горички,
// скали, малко село; а по трасето — строителни табели, предупредителни знаци, конуси, бариери с мигащи лампи
// и строителен лагер (фургони, тоалетна, материали). Трасето е по оста z (от −len/2 до len/2), центрирано в x = 0.
import * as THREE from 'three';
import { loadMountains, mtnModel, loadBridges, bridgeModel } from './mtn.js';

const flat = (c, r = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, flatShading: true });
const rnd = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// табела на дървени крака с текст (canvas); lines = [[текст, цвят, размер], …]
function board(w, h, lines, bg = '#f2f2ee', border = '#ffb300') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = border; g.lineWidth = 22; g.strokeRect(11, 11, c.width - 22, c.height - 22);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = c.height / (lines.length + 1);
  lines.forEach(([t, col, size], i) => { g.fillStyle = col; g.font = `900 ${size}px system-ui, sans-serif`; g.fillText(t, c.width / 2, step * (i + 1), c.width - 60); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const o = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); face.position.y = h / 2 + 2.2; o.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.15), flat(0x6b4a2b)); back.position.set(0, h / 2 + 2.2, -0.1); o.add(back);
  for (const x of [-w / 3, w / 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, h + 2.2, 0.3), flat(0x6b4a2b)); leg.position.set(x, (h + 2.2) / 2, -0.2); o.add(leg); }
  o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return o;
}
// триъгълен предупредителен знак „ремонт“
function warnSign() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(128, 14); g.lineTo(244, 230); g.lineTo(12, 230); g.closePath(); g.fill();
  g.strokeStyle = '#d62828'; g.lineWidth = 22; g.stroke();
  g.fillStyle = '#111'; g.font = '900 120px system-ui'; g.textAlign = 'center'; g.fillText('⚒', 128, 190);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const o = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5 })); face.position.y = 2.6; o.add(face);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6), flat(0x8a9097)); pole.position.y = 1.3; o.add(pole);
  return o;
}

// group: групата на изгледа; deps: { model(name, scale), A, houses: [имена] };
// нива с редове (браздите са по-тъмни ивици)
function rowsTex(col, w, d) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'), base = new THREE.Color(col);
  x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#' + base.clone().multiplyScalar(0.78).getHexString(); for (let k = 0; k < 64; k += 8) x.fillRect(0, k, 64, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 16, d / 6); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// opts: { len = 240, half = 12 (половин ширина на трасето), riverZ = 20, riverW = 26, title, kind: 'rail' | 'road', seed }
export function addRouteScenery(group, deps, opts = {}) {
  const g = new THREE.Group(); group.add(g);
  const len = opts.len || 240, half = opts.half || 12, rz = opts.riverZ ?? 20, rw = (opts.riverW || 26) / 2 + 6;
  const r = rnd(opts.seed || 12345);
  const free = (x, z, pad = 0) => Math.abs(x) > half + 8 + pad && Math.abs(z - rz) > rw + pad;
  const beacons = [];

  // хълмове наблизо и планини на хоризонта (после се подменят с истински планини — mtn.js)
  const swaps = [];
  const greens = [0x7fa65a, 0x6f9a4e, 0x8bb06a, 0x5f8a44];
  for (let k = 0; k < 18; k++) {
    const x = (r() < 0.5 ? -1 : 1) * (70 + r() * 200), z = -260 + r() * 520, s = 18 + r() * 40;
    if (!free(x, z, s * 0.6)) continue;
    // неравен хълм: върховете са разместени с шум, тревата е на петна (по-тъмни горички, по-светли ливади, тук-там скала)
    const sy = 0.16 + r() * 0.2, sz = 0.8 + r() * 0.5, geo = new THREE.IcosahedronGeometry(1, 4), P = geo.attributes.position, cols = [], v = new THREE.Vector3();
    const base = new THREE.Color(greens[k % greens.length]), dark = base.clone().multiplyScalar(0.72), light = base.clone().lerp(new THREE.Color(0xc9c27a), 0.35), rock = new THREE.Color(0x8c877c);
    const ph = r() * 10;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i);
      const n = Math.sin(v.x * 5.1 + ph) * Math.cos(v.z * 4.3 - ph) * 0.5 + Math.sin(v.x * 11 + v.z * 9 + ph * 2) * 0.25;
      if (v.y > 0) v.multiplyScalar(1 + n * 0.12);
      P.setXYZ(i, v.x, v.y, v.z);
      const c = n > 0.35 ? dark : n < -0.3 ? light : base, steep = v.y > 0.55 && n > 0.45 ? rock : c;
      cols.push(steep.r, steep.g, steep.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const h = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    h.scale.set(s, s * sy, s * sz); h.position.set(x, -s * 0.04, z); h.receiveShadow = true; g.add(h);
    // гора и камъни по склона (на повърхността на елипсоида)
    const trees = ['sf-pine-0', 'sf-pine-1', 'sf-tree-0', 'sf-tree-1', 'sf-tree-2'].filter(q => deps.A[q]);
    for (let j = 0, n = 6 + (r() * 10 | 0); j < n; j++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85, lx = Math.cos(a) * d, lz = Math.sin(a) * d, y = s * sy * Math.sqrt(Math.max(0, 1 - d * d)) - s * 0.04;
      const px = x + lx * s, pz = z + lz * s * sz;
      if (trees.length && r() < 0.8) { const nm = trees[(r() * trees.length) | 0], t = deps.model(nm, 6 + r() * 5); t.position.set(px, y - 0.3, pz); t.rotation.y = r() * 6; g.add(t); }
      else { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + r() * 2.5, 1), flat(0x8c877c)); rk.scale.y = 0.6; rk.position.set(px, y, pz); rk.castShadow = true; g.add(rk); }
    }
  }
  for (let k = 0; k < 9; k++) {
    const x = -300 + k * 75 + r() * 30, z = -330 - r() * 60, s = 60 + r() * 50;
    const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * (0.9 + r() * 0.5), 7), flat(k % 2 ? 0x7d8a76 : 0x6b7a66)); m.position.set(x, s * 0.4, z); g.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.32, s * 0.35, 7), flat(0xf4f6f8)); cap.position.set(x, s * 0.4 + s * 0.3, z); g.add(cap);
    swaps.push([[m, cap], x, z, s * 2.4, s * 1.1, k % 3 ? 'far1' : 'peak', k]);
  }
  // стари каменни мостове над реката, встрани от трасето (ако в изгледа има река)
  if (rz < 1e8) loadBridges().then(() => {
    for (const [k, x, len] of [['stone', -95 - r() * 40, rw * 2 + 24], ['rail', 110 + r() * 50, rw * 2 + 34]]) { const o = bridgeModel(k, len); if (!o) continue; o.position.set(x, 0, rz); g.add(o); }
  });
  loadMountains().then(() => { for (const [parts, x, z, w, h, k, rot] of swaps) { const o = mtnModel(k, w, h, rot); if (!o) continue; o.position.set(x, 0, z); g.add(o); parts.forEach(p => p.visible = false); } });
  // ниви (жито, разорана земя, слънчоглед, ливада)
  const fields = [0xd9c46a, 0x8a6a46, 0xe8c23a, 0x9cc46e, 0xb5a25a];
  for (let k = 0; k < 16; k++) {
    const w = 30 + r() * 40, d = 30 + r() * 50, x = (r() < 0.5 ? -1 : 1) * (half + 18 + w / 2 + r() * 120), z = -230 + r() * 460;
    if (!free(x, z, Math.max(w, d) / 2)) continue;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xffffff, map: rowsTex(fields[k % fields.length], w, d), roughness: 1 })); f.rotation.x = -Math.PI / 2; f.rotation.z = (r() - 0.5) * 0.4; f.position.set(x, 0.02, z); f.receiveShadow = true; g.add(f);
    if (r() < 0.6) {   // жив плет: редица храсти с различна големина (не плосък блок)
      const hd = new THREE.Group(), n = Math.max(4, Math.round(w / 2.2)), hm = flat(0x4f7a3a), hm2 = flat(0x5d8a42);
      for (let q = 0; q < n; q++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), q % 3 ? hm : hm2), sc = 0.9 + r() * 0.7; b.scale.set(sc * 1.3, sc, sc); b.position.set(-w / 2 + (q + 0.5) * w / n, sc * 0.7, (r() - 0.5) * 0.6); b.castShadow = true; hd.add(b); }
      hd.position.set(x, 0, z + d / 2 + 1); hd.rotation.y = -f.rotation.z; g.add(hd);
    }
  }
  // горички и единични дървета
  for (let k = 0; k < 26; k++) {
    const cx = (r() < 0.5 ? -1 : 1) * (half + 20 + r() * 160), cz = -240 + r() * 480;
    for (let j = 0; j < 4 + (r() * 6 | 0); j++) {
      const x = cx + (r() - 0.5) * 24, z = cz + (r() - 0.5) * 24;
      if (!free(x, z)) continue;
      const nice = ['sf-tree-0', 'sf-tree-1', 'sf-tree-2', 'sf-pine-0', 'sf-pine-1'].filter(q => deps.A[q]);
      const n = nice.length && r() < 0.75 ? nice[(r() * nice.length) | 0] : r() < 0.5 ? 'tree-large' : 'tree-small';
      if (!deps.A[n]) continue;
      const t = deps.model(n, n.startsWith('sf-') ? 7 + r() * 6 : 6 + r() * 4); t.position.set(x, 0, z); t.rotation.y = r() * 6; g.add(t);
    }
  }
  // скали
  const rockC = [0x8c8a84, 0x7a746a, 0x9a9488, 0x6f6a62];
  for (let k = 0; k < 22; k++) {   // купчини камъни: 2–6 скали, понякога голям скален блок
    const cx = (r() < 0.5 ? -1 : 1) * (half + 10 + r() * 150), cz = -240 + r() * 480;
    for (let j = 0, n = 2 + (r() * 5 | 0); j < n; j++) {
      const x = cx + (r() - 0.5) * 8, z = cz + (r() - 0.5) * 8; if (!free(x, z)) continue;
      const s = j === 0 && r() < 0.35 ? 3 + r() * 3 : 0.5 + r() * 1.8, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), flat(rockC[(r() * rockC.length) | 0]));
      rock.scale.set(1, 0.55 + r() * 0.4, 0.8 + r() * 0.5); rock.position.set(x, s * 0.25, z); rock.rotation.set(r() * 0.4, r() * 6, r() * 0.4); rock.castShadow = rock.receiveShadow = true; g.add(rock);
    }
  }
  // ---- повече живот наоколо
  // трева на петна: голям слой с шум (тъмни/светли петна, пътечки), малко над земята на изгледа
  { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = '#8fb36a'; x.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 900; k++) { const px = r() * 256, py = r() * 256, rr = 2 + r() * 14; x.fillStyle = r() < 0.5 ? 'rgba(70,110,45,0.1)' : 'rgba(200,200,120,0.09)'; x.beginPath(); x.arc(px, py, rr, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); t.colorSpace = THREE.SRGBColorSpace;
    const gm = new THREE.MeshStandardMaterial({ map: t, roughness: 1 });   // между земята на изгледа (y −0.02) и реката/нивите
    // без ивицата на реката (иначе тревата я закрива)
    const cut = rz < 1e8 ? [rz - rw + 4, rz + rw - 4] : [0, 0], parts = cut[0] === cut[1] ? [[-450, 450]] : [[-450, cut[0]], [cut[1], 450]];
    for (const [z1, z2] of parts) { if (z2 - z1 < 1) continue; const gr = new THREE.Mesh(new THREE.PlaneGeometry(900, z2 - z1), gm); gr.rotation.x = -Math.PI / 2; gr.position.set(0, 0.003, (z1 + z2) / 2); gr.receiveShadow = true; g.add(gr); } }
  // селски път, перпендикулярен на трасето, с прелез (бариери) и няколко коли
  const roadZ = (rz < 1e8 ? rz : 0) + (r() < 0.5 ? -1 : 1) * (rw + 45 + r() * 40);
  { const rd = new THREE.Mesh(new THREE.PlaneGeometry(700, 6), new THREE.MeshStandardMaterial({ color: 0x5a5d62, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }));
    rd.rotation.x = -Math.PI / 2; rd.position.set(0, 0.03, roadZ); rd.receiveShadow = true; g.add(rd);
    const ln = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (let x = -340; x < 340; x += 9) { if (Math.abs(x) < half + 4) continue; const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.25), ln); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, roadZ); g.add(m); }
    for (const sd of [-1, 1]) {   // бариери и знаци „Андреевски кръст“
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2), flat(0xdddddd)); post.position.set(sd * (half + 3), 1.1, roadZ + sd * 3.6); g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.18, 0.18), flat(0xd62828)); arm.position.set(sd * (half + 3) - sd * 2.7, 1.9, roadZ + sd * 3.6); g.add(arm);
      const cross = new THREE.Group(); cross.position.set(sd * (half + 6), 3, roadZ + sd * 4.2); g.add(cross);
      for (const rot of [0.6, -0.6]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.08), flat(0xffffff)); b.rotation.z = rot; cross.add(b); }
      const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3), flat(0x666666)); cp.position.set(sd * (half + 6), 1.5, roadZ + sd * 4.2); g.add(cp);
    }
    const cars = ['sf-car-Sedan', 'sf-car-Pickup', 'sf-car-Van', 'sf-car-Hatchback', 'sf-car-Truck'].filter(q => deps.A[q]);
    for (let k = 0; k < 5 && cars.length; k++) { const x = (k % 2 ? 1 : -1) * (half + 14 + k * 22 + r() * 10), o = deps.model(cars[k % cars.length], 1.6); o.position.set(x, 0.05, roadZ + (k % 2 ? 1.5 : -1.5)); o.rotation.y = k % 2 ? -Math.PI / 2 : Math.PI / 2; g.add(o); }
  }
  // стопанства: червен хамбар, силоз и ограда
  for (let k = 0; k < 3; k++) {
    const x = (k % 2 ? 1 : -1) * (half + 55 + r() * 120), z = -200 + k * 150 + r() * 40;
    if (!free(x, z, 14) || Math.abs(z - roadZ) < 14) continue;
    const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = r() * 6; g.add(f);
    const barn = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 7), flat(0xa8322d)); barn.position.y = 3; barn.castShadow = true; f.add(barn);
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 5.6, 3, 4, 1), flat(0x4a4f55)); rf.rotation.y = Math.PI / 4; rf.scale.set(1.3, 1, 0.95); rf.position.y = 7.5; f.add(rf);
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.1), flat(0xf0e6d0)); door.position.set(0, 2, 3.55); f.add(door);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 11, 14), flat(0xc9ccd0)); silo.position.set(7.5, 5.5, -1); silo.castShadow = true; f.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), flat(0x9aa0a6)); dome.position.set(7.5, 11, -1); f.add(dome);
    for (let q = 0; q < 14; q++) { const pst = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), flat(0x8a6a48)); const a = q / 14 * Math.PI * 2; pst.position.set(Math.cos(a) * 16, 0.6, Math.sin(a) * 12); f.add(pst); }
    // животни на пасището до стопанството (крави — тяло и глава)
    for (let q = 0; q < 6; q++) {
      const cw = new THREE.Group(), a = r() * 6, d = 9 + r() * 5; cw.position.set(Math.cos(a) * d, 0, Math.sin(a) * d * 0.7); cw.rotation.y = r() * 6; f.add(cw);
      const col = q % 3 ? 0xf2f2ee : 0x5a3b28;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.8), flat(col)); body.position.y = 1.1; cw.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.5), flat(col)); head.position.set(1.1, 1.3, 0); cw.add(head);
      for (const [lx, lz] of [[-0.6, -0.25], [-0.6, 0.25], [0.6, -0.25], [0.6, 0.25]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), flat(0x333333)); l.position.set(lx, 0.35, lz); cw.add(l); }
    }
  }
  // далекопровод успоредно на трасето: стълбове и провиснали жици
  { const lx = (r() < 0.5 ? -1 : 1) * (half + 38 + r() * 30), pts = [];
    for (let z = -260; z <= 260; z += 65) {
      if (rz < 1e8 && Math.abs(z - rz) < rw) continue;
      const py = new THREE.Group(); py.position.set(lx, 0, z); g.add(py);
      const m = flat(0x8a9097, 0.6);
      for (const sx of [-1.4, 1.4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 22, 0.35), m); leg.position.set(sx, 11, 0); leg.rotation.z = -sx * 0.05; py.add(leg); }
      for (const [y, w] of [[21, 9], [17, 7]]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.35), m); arm.position.y = y; py.add(arm); }
      pts.push(z);
    }
    const wm = new THREE.LineBasicMaterial({ color: 0x2a2d31 });
    for (const [ox, y] of [[-4.2, 20.6], [4.2, 20.6], [-3.2, 16.6], [3.2, 16.6]]) for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; if (b - a > 70) continue;
      const P = []; for (let t = 0; t <= 8; t++) { const z = a + (b - a) * t / 8, sag = Math.sin(Math.PI * t / 8) * 2.2; P.push(new THREE.Vector3(lx + ox, y - sag, z)); }
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(P), wm));
    }
  }
  // езерца с тръстика
  for (let k = 0; k < 3; k++) {
    const x = (r() < 0.5 ? -1 : 1) * (half + 40 + r() * 140), z = -220 + r() * 440, rr = 6 + r() * 9;
    if (!free(x, z, rr + 4) || Math.abs(z - roadZ) < rr + 6) continue;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(rr, 24), new THREE.MeshStandardMaterial({ color: 0x3f8fc0, roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3 }));
    pond.rotation.x = -Math.PI / 2; pond.scale.y = 0.7; pond.position.set(x, 0.04, z); g.add(pond);
    const bank = new THREE.Mesh(new THREE.RingGeometry(rr, rr + 1.4, 24), new THREE.MeshStandardMaterial({ color: 0xb8a77a, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    bank.rotation.x = -Math.PI / 2; bank.scale.y = 0.7; bank.position.set(x, 0.035, z); g.add(bank);
    for (let q = 0; q < 14; q++) { const a = r() * 6.28, reed = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2 + r() * 1.5, 4), flat(0x6b8a3a)); reed.position.set(x + Math.cos(a) * (rr + 0.3), 1, z + Math.sin(a) * (rr + 0.3) * 0.7); g.add(reed); }
  }
  // малко село встрани
  const vx = (r() < 0.5 ? -1 : 1) * (half + 70), vz = -150 + r() * 80;
  for (let k = 0; k < 7 && deps.houses && deps.houses.length; k++) {
    const n = deps.houses[(k * 3) % deps.houses.length], o = deps.model(n, 2.6);
    o.position.set(vx + (k % 3) * 16 + (r() - 0.5) * 4, 0, vz + Math.floor(k / 3) * 18); o.rotation.y = (r() < 0.5 ? 0 : Math.PI); g.add(o);
  }

  // ---------- строителство по трасето
  const z0 = -len / 2;
  // голяма табела на обекта в началото
  const big = board(14, 6, [['СТРОИТЕЛНА ИМПЕРИЯ', '#d68a00', 112], [opts.title || (opts.kind === 'rail' ? 'Изграждане на жп линия' : 'Изграждане на магистрала'), '#1a2433', 72], ['ВНИМАНИЕ! Строителни работи', '#d62828', 64]]);
  big.position.set(half + 12, 0, z0 + 14); big.rotation.y = -Math.PI / 2 + 0.35; g.add(big);
  const big2 = board(10, 4.4, [['ОБЕКТЪТ СЕ ИЗГРАЖДА', '#1a2433', 92], ['от „Строителна империя“', '#d68a00', 72]], '#ffffff', '#1a2433');
  big2.position.set(-half - 10, 0, z0 + len * 0.62); big2.rotation.y = Math.PI / 2 - 0.3; g.add(big2);
  // предупредителни знаци покрай трасето
  for (let z = z0 + 30; z < len / 2; z += 45) for (const sx of [-1, 1]) {
    if (Math.abs(z - rz) < rw) continue;
    const s = warnSign(); s.position.set(sx * (half + 3), 0, z); s.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(s);
  }
  // бариери с мигащи лампи и конуси в началото на трасето
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 });
  for (let k = 0; k < 5; k++) {
    const x = -half + 2 + k * (2 * half - 4) / 4;
    if (deps.A['construction-barrier']) { const b = deps.model('construction-barrier', 3); b.position.set(x, 0, z0 - 3); g.add(b); }
    const bc = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), beaconMat.clone()); bc.position.set(x, 1.6, z0 - 3); g.add(bc); beacons.push(bc);
  }
  for (let k = 0; k < 14 && deps.A['construction-cone']; k++) {
    const c = deps.model('construction-cone', 2.5); c.position.set((k % 2 ? 1 : -1) * (half + 1), 0, z0 + 4 + k * 5); g.add(c);
  }
  // строителен лагер: фургони, тоалетна, материали
  const camp = [['container-office-green', 0.6, 0], ['container-office-red', 0.6, 4.2], ['toilet-portable', 0.9, 8.5], ['planks-wood-a', 0.6, 12], ['box-stack-brown', 0.8, 16], ['barrel', 0.8, 19]];
  for (const [n, s, dz] of camp) {
    if (!deps.A[n]) continue;
    const o = deps.model(n, s); o.position.set(-half - 14, 0, z0 + 20 + dz); o.rotation.y = Math.PI / 2; g.add(o);
  }
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9), flat(0xcccccc)); flagPole.position.set(-half - 9, 4.5, z0 + 16); g.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshStandardMaterial({ color: 0xffb300, side: THREE.DoubleSide })); flag.position.set(-half - 7.5, 8, z0 + 16); g.add(flag);

  g.traverse(o => { if (o.isMesh && !o.material.transparent) o.receiveShadow = true; });
  // мигащите лампи и веещото се знаме
  function update(t) {
    beacons.forEach((b, i) => { b.material.emissiveIntensity = Math.sin(t * 6 + i * 1.3) > 0 ? 2 : 0.1; });
    flag.rotation.y = Math.sin(t * 2) * 0.25;
  }
  return { group: g, update };
}
