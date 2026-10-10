// scenery.js — околност за изгледите на строежите на жп линии и магистрали: хълмове и планини, ниви, горички,
// скали, малко село; а по трасето — строителни табели, предупредителни знаци, конуси, бариери с мигащи лампи
// и строителен лагер (фургони, тоалетна, материали). Трасето е по оста z (от −len/2 до len/2), центрирано в x = 0.
import * as THREE from 'three';

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
// opts: { len = 240, half = 12 (половин ширина на трасето), riverZ = 20, riverW = 26, title, kind: 'rail' | 'road', seed }
export function addRouteScenery(group, deps, opts = {}) {
  const g = new THREE.Group(); group.add(g);
  const len = opts.len || 240, half = opts.half || 12, rz = opts.riverZ ?? 20, rw = (opts.riverW || 26) / 2 + 6;
  const r = rnd(opts.seed || 12345);
  const free = (x, z, pad = 0) => Math.abs(x) > half + 8 + pad && Math.abs(z - rz) > rw + pad;
  const beacons = [];

  // хълмове наблизо и планини на хоризонта
  const greens = [0x7fa65a, 0x6f9a4e, 0x8bb06a, 0x5f8a44];
  for (let k = 0; k < 18; k++) {
    const x = (r() < 0.5 ? -1 : 1) * (70 + r() * 200), z = -260 + r() * 520, s = 18 + r() * 40;
    if (!free(x, z, s * 0.6)) continue;
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), flat(greens[k % greens.length]));
    h.scale.set(s, s * (0.25 + r() * 0.25), s * (0.8 + r() * 0.5)); h.position.set(x, -s * 0.05, z); h.receiveShadow = true; g.add(h);
  }
  for (let k = 0; k < 9; k++) {
    const x = -300 + k * 75 + r() * 30, z = -330 - r() * 60, s = 60 + r() * 50;
    const m = new THREE.Mesh(new THREE.ConeGeometry(s, s * (0.9 + r() * 0.5), 7), flat(k % 2 ? 0x7d8a76 : 0x6b7a66)); m.position.set(x, s * 0.4, z); g.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.32, s * 0.35, 7), flat(0xf4f6f8)); cap.position.set(x, s * 0.4 + s * 0.3, z); g.add(cap);
  }
  // ниви (жито, разорана земя, слънчоглед, ливада)
  const fields = [0xd9c46a, 0x8a6a46, 0xe8c23a, 0x9cc46e, 0xb5a25a];
  for (let k = 0; k < 16; k++) {
    const w = 30 + r() * 40, d = 30 + r() * 50, x = (r() < 0.5 ? -1 : 1) * (half + 18 + w / 2 + r() * 120), z = -230 + r() * 460;
    if (!free(x, z, Math.max(w, d) / 2)) continue;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flat(fields[k % fields.length])); f.rotation.x = -Math.PI / 2; f.rotation.z = (r() - 0.5) * 0.4; f.position.set(x, 0.02, z); f.receiveShadow = true; g.add(f);
  }
  // горички и единични дървета
  for (let k = 0; k < 26; k++) {
    const cx = (r() < 0.5 ? -1 : 1) * (half + 20 + r() * 160), cz = -240 + r() * 480;
    for (let j = 0; j < 4 + (r() * 6 | 0); j++) {
      const x = cx + (r() - 0.5) * 24, z = cz + (r() - 0.5) * 24;
      if (!free(x, z)) continue;
      const n = r() < 0.5 ? 'tree-large' : 'tree-small';
      if (!deps.A[n]) continue;
      const t = deps.model(n, 6 + r() * 4); t.position.set(x, 0, z); t.rotation.y = r() * 6; g.add(t);
    }
  }
  // скали
  for (let k = 0; k < 30; k++) {
    const x = (r() < 0.5 ? -1 : 1) * (half + 10 + r() * 150), z = -240 + r() * 480;
    if (!free(x, z)) continue;
    const s = 0.6 + r() * 2.2, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), flat(0x8c8a84)); rock.position.set(x, s * 0.4, z); rock.rotation.set(r(), r(), r()); rock.castShadow = true; g.add(rock);
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
