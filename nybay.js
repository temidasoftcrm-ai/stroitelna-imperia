// 🗽 osm-edge — Ню Йорк (собственикът, 30.10): истинските брегове около плана вместо правите ленти.
// Хъдсън и Ийст Ривър — по реалните брегове (приблизителни полилинии от lat/lon), на юг Манхатън свършва с връх (Батъри),
// отвъд — заливът Ъпър Ню Йорк Бей; островите Губернаторски, Либърти (звездата на Форт Ууд) и Елис.
// Всичко е в координатите на плана (като растера): toXZ — както в cityplan2game.js (centre, k).
import * as THREE from 'three';

const LON0 = -73.985;   // само за четимост на списъците по-долу

// водата извън растера: един многоъгълник (lon, lat) — западният бряг на Манхатън на юг, Батъри, източният бряг на север до Хел Гейт,
// канала на изток, бреговете на Куинс и Бруклин на юг, залива, брега на Ню Джърси на север (Хобокен, Уийхокен, Еджуотър)
const WATER = [
  [-73.9440, 40.8650], [-73.9515, 40.8350], [-73.9600, 40.8193], [-73.9670, 40.8100], [-73.9745, 40.7990], [-73.9810, 40.7900], [-73.9880, 40.7820],
  [-73.9935, 40.7735], [-73.9966, 40.7680], [-74.0087, 40.7450], [-74.0095, 40.7420], [-74.0105, 40.7350], [-74.0120, 40.7280],
  [-74.0128, 40.7220], [-74.0150, 40.7170], [-74.0175, 40.7120], [-74.0190, 40.7060], [-74.0185, 40.7042], [-74.0174, 40.7030],
  [-74.0160, 40.7012], [-74.0146, 40.7004], [-74.0132, 40.7007], [-74.0114, 40.7018], [-74.0094, 40.7029], [-74.0063, 40.7040],
  [-74.0020, 40.7065], [-73.9985, 40.7088], [-73.9925, 40.7098], [-73.9850, 40.7100], [-73.9790, 40.7110], [-73.9755, 40.7140],
  [-73.9740, 40.7200], [-73.9725, 40.7290], [-73.9720, 40.7340], [-73.9704, 40.7450], [-73.9640, 40.7540], [-73.9600, 40.7580],
  [-73.9560, 40.7620], [-73.9520, 40.7670], [-73.9465, 40.7730], [-73.9430, 40.7775], [-73.9405, 40.7820], [-73.9380, 40.7850],
  [-73.9250, 40.7850], [-73.9150, 40.7920], [-73.9000, 40.7950], [-73.8300, 40.7980],
  [-73.8300, 40.7860], [-73.9000, 40.7830], [-73.9150, 40.7800], [-73.9230, 40.7770], [-73.9330, 40.7720], [-73.9380, 40.7660],
  [-73.9440, 40.7600], [-73.9500, 40.7550], [-73.9560, 40.7500], [-73.9585, 40.7455], [-73.9610, 40.7380], [-73.9615, 40.7300],
  [-73.9640, 40.7230], [-73.9680, 40.7145], [-73.9720, 40.7080], [-73.9745, 40.7048], [-73.9780, 40.7030], [-73.9850, 40.7040],
  [-73.9900, 40.7040], [-73.9950, 40.7020], [-73.9985, 40.6990], [-74.0010, 40.6950], [-74.0035, 40.6900], [-74.0070, 40.6850],
  [-74.0110, 40.6780], [-74.0200, 40.6700], [-74.0290, 40.6600], [-74.0340, 40.6500], [-74.0380, 40.6400], [-74.0720, 40.6400],
  [-74.0740, 40.6550], [-74.0700, 40.6700], [-74.0620, 40.6800], [-74.0600, 40.6850], [-74.0560, 40.6890], [-74.0520, 40.6930], [-74.0470, 40.6975], [-74.0450, 40.7010], [-74.0380, 40.7040],
  [-74.0352, 40.7080], [-74.0340, 40.7130], [-74.0330, 40.7180], [-74.0320, 40.7270], [-74.0280, 40.7360], [-74.0260, 40.7450],
  [-74.0240, 40.7540], [-74.0215, 40.7620], [-74.0160, 40.7700], [-74.0120, 40.7770], [-74.0060, 40.7860], [-73.9990, 40.7950],
  [-73.9900, 40.8050], [-73.9800, 40.8170], [-73.9700, 40.8350], [-73.9600, 40.8650],
];
// Долен Манхатън (югът на плана до върха) — по-високи сгради, кулите на Финансовия квартал
const MANHATTAN = [
  [-74.0087, 40.7450], [-74.0095, 40.7420], [-74.0105, 40.7350], [-74.0120, 40.7280], [-74.0128, 40.7220], [-74.0150, 40.7170],
  [-74.0175, 40.7120], [-74.0190, 40.7060], [-74.0185, 40.7042], [-74.0174, 40.7030], [-74.0160, 40.7012], [-74.0146, 40.7004],
  [-74.0132, 40.7007], [-74.0114, 40.7018], [-74.0094, 40.7029], [-74.0063, 40.7040], [-74.0020, 40.7065], [-73.9985, 40.7088],
  [-73.9925, 40.7098], [-73.9850, 40.7100], [-73.9790, 40.7110], [-73.9755, 40.7140], [-73.9740, 40.7200], [-73.9725, 40.7290],
  [-73.9720, 40.7340], [-73.9704, 40.7450],
];
// островите: гладки (екструдирани) — не на решетката 10 м
const GOVERNORS = [   // заоблен триъгълник: тесен на север (към Батъри), широк на юг
  [-74.0150, 40.6942], [-74.0112, 40.6905], [-74.0122, 40.6862], [-74.0175, 40.6840], [-74.0245, 40.6836], [-74.0250, 40.6858], [-74.0185, 40.6925],
];
const ELLIS = [
  [-74.0416, 40.7008], [-74.0380, 40.7010], [-74.0372, 40.6982], [-74.0420, 40.6980],
];
const BATTERY = [   // паркът на върха
  [-74.0186, 40.7046], [-74.0174, 40.7030], [-74.0160, 40.7012], [-74.0146, 40.7004], [-74.0136, 40.7010], [-74.0140, 40.7030],
  [-74.0152, 40.7046], [-74.0168, 40.7058],
];
export const LIBERTY_LL = [-74.0445, 40.6892];   // статуята (истинското място)

export function nyBay(D) {
  const c = D.center, K = D.k || 0.45, cs = Math.cos(c[0] * Math.PI / 180) * 111320 * K, zs = 110540 * K;
  const LL = ([lo, la]) => [(lo - c[1]) * cs, -(la - c[0]) * zs];
  const poly = L => L.map(LL);
  const round = (q, n = 3) => { for (let k = 0; k < n; k++) q = q.flatMap((a, i) => { const b = q[(i + 1) % q.length]; return [[a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]]; }); return q; };   // ъглите — заоблени (Чайкин)
  const box = q => [Math.min(...q.map(p => p[0])), Math.max(...q.map(p => p[0])), Math.min(...q.map(p => p[1])), Math.max(...q.map(p => p[1]))];
  const inP = (p, q) => { let r = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < (q[j][0] - q[i][0]) * (p[1] - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) r = !r; return r; };
  const shape = (q, b = box(q)) => (x, z) => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3] && inP([x, z], q);
  // Либърти: овал ~6 ха (×K²), дългата ос СЗ–ЮИ; статуята — в югоизточната половина
  const [lx, lz] = LL(LIBERTY_LL), la = 0.70, lA = 190 * K, lB = 105 * K, lcx = lx - Math.cos(la) * 40 * K, lcz = lz - Math.sin(la) * 40 * K;
  const LIB = []; for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2, u = Math.cos(t) * lA, v = Math.sin(t) * lB; LIB.push([lcx + u * Math.cos(la) - v * Math.sin(la), lcz + u * Math.sin(la) + v * Math.cos(la)]); }
  const W = poly(WATER), MAN = poly(MANHATTAN), GOV = round(poly(GOVERNORS)), ELL = round(poly(ELLIS), 2), BAT = poly(BATTERY);
  const isl = [GOV, LIB, ELL].map(q => shape(q));
  return {
    LL, inP, W: shape(W), man: shape(MAN), park: shape(BAT), island: (x, z) => isl.some(f => f(x, z)),
    gov: GOV, lib: LIB, ell: ELL, bat: BAT, statue: [lx, lz], libAxis: la, K,
    jc: [LL([-74.0400, 40.7130]), LL([-74.0335, 40.7300])],   // Джърси Сити (Ексчейндж Плейс — Нюпорт)
    fidi: LL([-74.0100, 40.7120])[1], term: LL([-74.0130, 40.7012]),   // южно от тази линия (z) — кулите на Финансовия квартал
  };
}

// мешовете: островите (каменна стена от водата + трева), Форт Ууд (звезда с 11 лъча), Елис (главната сграда), паркът Батъри,
// терминалът на ферибота за Стейтън Айлънд с кейовете му и кейовете по Ийст Ривър. Всичко — няколко меша, без работа на кадър.
export function nyBayView(G, ny, WY, water, trees, rail = null) {
  const K = ny.K, mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 });
  const grass = mat(0x6f9e4f), stone = mat(0x9c958a), walk = mat(0xcfc6b0);
  const slab = (q, y0, y1, top, side) => {   // многоъгълник (x, z) → призма от y0 до y1
    const sh = new THREE.Shape(q.map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 }).rotateX(Math.PI / 2).translate(0, y1, 0);
    const m = new THREE.Mesh(g, [top, side]); m.receiveShadow = true; m.castShadow = y1 - y0 < 8; G.add(m); return m;
  };
  const boxes = [], bx = (x, z, w, d, y0, y1, rot, col) => boxes.push([x, z, w, d, y0, y1, rot, col]);
  for (const q of [ny.gov, ny.lib, ny.ell]) slab(q, WY - 0.3, 0.4, grass, stone);
  // Форт Ууд: звездата под пиедестала (статуята стои на нея — game.js liberty2 seaY)
  const [sx, sz] = ny.statue, star = []; for (let k = 0; k < 22; k++) { const t = k / 22 * Math.PI * 2 + ny.libAxis, r = (k % 2 ? 15 : 25) * K * 1.9; star.push([sx + Math.cos(t) * r, sz + Math.sin(t) * r]); }
  slab(star, 0.3, 2.6, mat(0xb9b09a), mat(0xa39a86));
  // Либърти: алея около острова (овал с дупка) и към кея на северозапад; кеят на ферибота
  { const ca = Math.cos(ny.libAxis), sa = Math.sin(ny.libAxis), [cx, cz] = ny.lib.reduce((a, p) => [a[0] + p[0] / ny.lib.length, a[1] + p[1] / ny.lib.length], [0, 0]);
    const ring = (f, rev) => { const o = []; for (let k = 0; k < 40; k++) { const t = (rev ? -k : k) / 40 * Math.PI * 2, u = Math.cos(t) * 190 * K * f, v = Math.sin(t) * 105 * K * f; o.push(new THREE.Vector2(cx + u * ca - v * sa, cz + u * sa + v * ca)); } return o; };
    const sh = new THREE.Shape(ring(0.86)); sh.holes.push(new THREE.Path(ring(0.80, true)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), walk); m.material.side = THREE.DoubleSide; m.position.y = 0.43; m.receiveShadow = true; G.add(m);
    const du = -190 * K * 0.83, px = cx + du * ca, pz = cz + du * sa, L = Math.hypot(px - sx, pz - sz); bx((px + sx) / 2, (pz + sz) / 2, 3, L, 0.4, 0.46, Math.atan2(px - sx, pz - sz) * -1, 0xcfc6b0);
    const qx = cx - 190 * K * ca * 1.02 + sa * 30 * K, qz = cz - 190 * K * sa * 1.02 - ca * 30 * K; bx(qx - ca * 14, qz - sa * 14, 26, 6, WY - 0.3, 0.5, ny.libAxis, 0x86807a); }
  const [ex, ez] = ny.ell.reduce((a, p) => [a[0] + p[0] / ny.ell.length, a[1] + p[1] / ny.ell.length], [0, 0]);
  // Елис: главната сграда (тухла, 4 кули с куполи — кутии), алеи
  const ea = -0.12; bx(ex - 6, ez - 8, 34, 12, 0.4, 7.5, ea, 0x9a5a44); for (const [u, v] of [[-15, -5], [15, -5], [-15, 5], [15, 5]]) bx(ex - 6 + u * Math.cos(ea) - v * Math.sin(ea), ez - 8 + u * Math.sin(ea) + v * Math.cos(ea), 2.6, 2.6, 0.4, 10.5, ea, 0xd8cfc0);
  bx(ex + 4, ez + 6, 22, 9, 0.4, 5, ea, 0x9e6a52);
  // Губернаторски: Форт Джей, Касъл Уилямс (ниска кула), няколко казарми в северната (старата) част
  { const [gx, gz] = ny.LL([-74.0160, 40.6905]); for (const [u, v, w, d, h, c] of [[0, 0, 26, 26, 4, 0xa89d86], [-38, -30, 14, 14, 6, 0xb07a5a], [30, -24, 30, 8, 7, 0x9a5a44], [34, 6, 26, 8, 7, 0x9a5a44], [-30, 22, 24, 9, 6, 0xc8b89a], [10, 34, 18, 8, 6, 0xc8b89a]]) bx(gx + u, gz + v, w, d, 0.4, 0.4 + h, 0.3, c); }
  // Батъри: тревата и дърветата
  { const sh = new THREE.Shape(ny.bat.map(([x, z]) => new THREE.Vector2(x, z))), g = new THREE.ShapeGeometry(sh).rotateX(Math.PI / 2), m = new THREE.Mesh(g, grass); m.material = grass.clone(); m.material.side = THREE.DoubleSide; m.position.y = 0.04; m.receiveShadow = true; G.add(m); }
  const hs = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
  const treeIn = (q, n, k0) => { let [x0, x1, z0, z1] = [1e9, -1e9, 1e9, -1e9]; for (const [x, z] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let i = 0, got = 0; i < n * 6 && got < n; i++) { const x = x0 + hs(i, 3.1) * (x1 - x0), z = z0 + hs(7.7, i) * (z1 - z0); if (!ny.inP([x, z], q)) continue; if (Math.hypot(x - sx, z - sz) < 30 * K * 1.9) continue; trees.push([x, z, k0 * (0.7 + hs(i, i) * 0.5), 0.4]); got++; } };
  treeIn(ny.bat, 70, 0.9); treeIn(ny.gov, 120, 0.9); treeIn(ny.lib, 26, 0.7); treeIn(ny.ell, 10, 0.6);
  // фериботът за Стейтън Айлънд (Уайтхол): сградата на брега и три кея навътре в залива
  const [fx, fz] = ny.LL([-74.0130, 40.7012]), fa = -0.62, dir = [Math.cos(fa + Math.PI / 2), Math.sin(fa + Math.PI / 2)];
  bx(fx, fz, 50 * K * 1.9, 26 * K * 1.9, 0.0, 11, fa, 0xc9c5ba); bx(fx, fz, 52 * K * 1.9, 28 * K * 1.9, 11, 12, fa, 0x5f7f78);
  for (const u of [-16, 0, 16]) for (const s of [-3.2, 3.2]) { const L = 30, cx = fx + dir[0] * (13 + L / 2) + Math.cos(fa) * (u + s), cz = fz + dir[1] * (13 + L / 2) + Math.sin(fa) * (u + s); bx(cx, cz, 1.6, L, WY - 0.3, 0.6, fa, 0x7a7266); }
  // кейовете по Ийст Ривър (от Батъри до Бруклинския мост и по-нагоре) и няколко на Хъдсън — перпендикулярно на брега, навън докато е вода
  const pierAt = (lo, la, L, w = 7) => { const [x, z] = ny.LL([lo, la]); let best = null; for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); let n = 0; for (let d = 6; d <= L + 6; d += 6) if (water(x + c * d, z + s * d)) n++; if (!best || n > best[0]) best = [n, t]; }
    if (!best || best[0] < 3) return; const t = best[1], c = Math.cos(t), s = Math.sin(t); bx(x + c * (L / 2 + 2), z + s * (L / 2 + 2), w, L, WY - 0.3, 0.5, t - Math.PI / 2, 0x86807a); };
  for (const [lo, la, L] of [[-74.0080, 40.7034, 40], [-74.0055, 40.7045, 34], [-74.0032, 40.7058, 46], [-74.0012, 40.7072, 30], [-73.9960, 40.7092, 26], [-73.9900, 40.7099, 24], [-73.9810, 40.7108, 22],
    [-74.0130, 40.7255, 40], [-74.0123, 40.7300, 34], [-74.0112, 40.7340, 30]]) pierAt(lo, la, L);
  // жп линията на играта над Хъдсън — виадукт (настилка под релсите и стълбове), където под нея е вода
  if (rail) { const xc = (rail.L + rail.R) / 2, segs = []; let st = null; for (let z = rail.z0; z <= rail.z1 + 10; z += 10) { const w = z <= rail.z1 && water(xc, z); if (w && st == null) st = z; else if (!w && st != null) { segs.push([st - 15, z + 5]); st = null; } }
    for (const [a, b] of segs) { bx(rail.L + 6, (a + b) / 2, 1.2, b - a, -0.9, 0.55, 0, 0x7d776c); bx(rail.R - 6, (a + b) / 2, 1.2, b - a, -0.9, 0.55, 0, 0x7d776c); bx(xc, (a + b) / 2, rail.R - rail.L - 10, b - a, -1.6, -0.02, 0, 0x8f8a80);
      for (let z = a + 12; z < b - 6; z += 36) for (const x of [rail.L + 10, xc, rail.R - 10]) bx(x, z, 3.2, 3.2, WY - 0.3, -1.6, 0, 0x857f74); } }
  // все кутии — един InstancedMesh
  if (boxes.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat(0xffffff), boxes.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    boxes.forEach(([x, z, w, d, y0, y1, rot, c], i) => { im.setMatrixAt(i, M4.compose(V.set(x, y0, z), Q.setFromAxisAngle(Y, -rot), S.set(w, y1 - y0, d))); im.setColorAt(i, col.setHex(c)); });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.name = 'nyBayBoxes'; G.add(im); }
  return { boxes: boxes.length };
}
