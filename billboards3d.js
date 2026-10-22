// billboards3d.js — 🪧 билбордове с нашата фирма по булевардите (флаг billboards; потребителят: „3D билбордове с нашата компания по големите булеварди“).
// Истински на вид: стоманен стълб 7 м, рамка с пътека и лампи, двулицево платно 12 × 4 м, на тротоара с лице към движението,
// през ~200 м, най-много 8 на град. Съдържанието — марката на играча (лого, име в цвета на марката, лозунг), 3 дизайна на ред;
// o.images = [url…] — снимките на потребителя вместо нарисуваните (когато ги прати). Нощем лампите и платната светят.
// Евтино: всичко е InstancedMesh (стълбове, рамки, лампи — по един; платната — по един на дизайн), текстурите — общи.
// buildBillboards(group, { roads: [{ pts: [[x, z]…], w }], brand: { nm, col, ico }, company, years, images, max, gap }) → { group, spots, setNight(k), dispose }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeKids } from './citycull.js';

const PW = 12, PH = 4, POLE = 7;
function design(i, b) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 342; const g = c.getContext('2d'), col = b.col || '#4fc3f7', nm = b.nm || 'Титан', co = b.company || `${nm} Констръкшън`;
  const txt = (t, x, y, sz, color, w = 960, font = 'system-ui, sans-serif', wt = 800) => { g.font = `${wt} ${sz}px ${font}`; g.fillStyle = color; g.fillText(t, x, y, w); };
  g.textBaseline = 'middle';
  if (i === 0) {   // марката: градиент в цвета ѝ, голямо лого, името и „Строим бъдещето“
    const gr = g.createLinearGradient(0, 0, 1024, 342); gr.addColorStop(0, col); gr.addColorStop(1, '#0b1220'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 342);
    g.font = '180px "Noto Color Emoji", "Apple Color Emoji", sans-serif'; g.textAlign = 'center'; g.fillText(b.ico || '🏗️', 170, 180);
    g.textAlign = 'left'; txt(co, 320, 120, 88, '#ffffff', 680); txt('Строим бъдещето', 322, 232, 70, '#ffe08a', 680, 'Georgia, serif', 700);
  } else if (i === 1) {   // тъмно, името в цвета на марката, годините
    g.fillStyle = '#0d1117'; g.fillRect(0, 0, 1024, 342); g.fillStyle = col; g.fillRect(0, 300, 1024, 42); g.fillRect(0, 0, 18, 342);
    g.textAlign = 'left'; txt(co.toUpperCase(), 60, 110, 92, col, 920); txt(`${b.years || 25} години качество`, 62, 220, 74, '#ffffff', 920, 'Georgia, serif', 700);
    g.textAlign = 'right'; g.font = '110px "Noto Color Emoji", sans-serif'; g.fillText(b.ico || '🏗️', 990, 150);
  } else {   // силует на град + какво строим
    const gr = g.createLinearGradient(0, 0, 0, 342); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(1, '#f08a4b'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 342);
    g.fillStyle = '#1b2433'; let x = 0; let k = 7; while (x < 1024) { k = (k * 9301 + 49297) % 233280; const w = 40 + (k % 70), h = 90 + (k % 170); g.fillRect(x, 342 - h, w, h); x += w + 6; }
    g.textAlign = 'center'; txt('Домове · Пътища · Мостове', 512, 80, 72, '#1b2433', 960); txt(co, 512, 170, 86, '#ffffff', 960);
    g.strokeStyle = '#1b2433'; g.lineWidth = 6; g.font = '800 86px system-ui, sans-serif'; g.strokeText(co, 512, 170, 960); g.fillStyle = '#ffffff'; g.fillText(co, 512, 170, 960);
  }
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 8; g.strokeRect(4, 4, 1016, 334);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// размерът по класа на улицата (f1: „мега на стълб до двулентов път стърчи над всичко“): булевард/широка — голям 12 × 4 (долу на ~7 м),
// обикновена — среден 6 × 2,5, през две — малък; мега и въртящият се — само ръчно (o.sizes, Лабораторията), никога на стълб до пътя
const sizeFor = (i, r) => r.main || (r.w || 0) >= 14 ? 'large' : i % 3 === 2 ? 'small' : 'medium';
// местата: по най-дългите булеварди, през ~gap м, отстъп от оста = половината ширина + 3 м, редуват се страните; не по-близо от 0,6·gap един до друг
export function billboardSpots(roads, { max = 8, gap: gap0, widthOf, avoid, sizeAt } = {}) {   // avoid(x, z, fw, ax, az) → true: не тук (кръстовище, кръгово, централата); sizeAt(x, z, r, i) → размерът по мястото
  const out = [], L = r => { let s = 0; for (let i = 1; i < r.pts.length; i++) s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); return s; };
  const list = roads.filter(r => r.pts && r.pts.length > 1).map(r => ({ r, len: L(r) })).filter(q => q.len > 45).sort((a, b) => (b.r.main ? 1e9 : 0) + b.len - ((a.r.main ? 1e9 : 0) + a.len));   // булевардите (main) първо; плановете от картата са на къси отсечки
  const tot = list.reduce((t, q) => t + q.len, 0), gap = gap0 || Math.max(70, Math.min(220, tot / (max + 1)));   // малките градове — по-гъсто, иначе се събира един
  let side = 1;
  for (const { r } of list) {
    let acc = 0, next = Math.min(70 + (out.length * 37) % 60, L(r) / 2);
    for (let i = 1; i < r.pts.length && out.length < max; i++) {
      const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], d = Math.hypot(x1 - x0, z1 - z0); if (d < 1e-6) continue;
      while (acc + d >= next && out.length < max) {
        const f = (next - acc) / d, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, dx = (x1 - x0) / d, dz = (z1 - z0) / d, nx = -dz * side, nz = dx * side, k = (sizeAt && sizeAt(x, z, r, out.length)) || sizeFor(out.length, r), fw = widthOf ? widthOf(out.length, k) : 12, off = (r.w || 12) / 2 + 2 + fw / 2 * 0.95;   // платното е напречно на пътя — отстъп колкото половината му ширина
        const p = { x: x + nx * off, z: z + nz * off, ry: Math.atan2(dx * side, dz * side) + side * 0.35 };   // лицето — срещу идващите коли, леко към платното
        if (avoid && avoid(p.x, p.z, fw, x, z)) { next += 12; continue; }   // забранено място — малко по-нататък по улицата
        if (!out.some(q => Math.hypot(q.x - p.x, q.z - p.z) < Math.max(gap * 0.6, (fw + (q.fw || 12)) / 2 + 4))) { p.fw = fw; p.k = k; out.push(p); side = -side; }
        next += gap;
      }
      acc += d;
    }
    if (out.length >= max) break;
  }
  return out;
}

function buildProcedural(group, o = {}) {   // резервният (без моделите): нарисуван 12 × 4 на стълб
  const spots = billboardSpots(o.roads || [], o), n = spots.length, own = [], M = x => { own.push(x); return x; };
  const g = new THREE.Group(); g.name = 'billboards'; group.add(g);
  if (!n) return { group: g, spots, setNight() {}, dispose() { group.remove(g); } };
  const steel = M(new THREE.MeshStandardMaterial({ color: 0x5d646d, metalness: 0.8, roughness: 0.45 })), frameM = M(new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.6, roughness: 0.5 }));
  const lampM = M(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, emissive: 0xfff1c8, emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.4 }));
  const inst = (geo, mat, count) => { const m = new THREE.InstancedMesh(M(geo), mat, count); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const pole = inst(new THREE.CylinderGeometry(0.28, 0.36, POLE, 12).translate(0, POLE / 2, 0), steel, n);
  const frame = inst(new THREE.BoxGeometry(PW + 0.5, PH + 0.5, 0.4).translate(0, POLE + PH / 2, 0), frameM, n);
  const walk = inst(new THREE.BoxGeometry(PW, 0.1, 0.9).translate(0, POLE - 0.1, 0.6), steel, n * 2);
  const lamps = inst(new THREE.BoxGeometry(0.7, 0.18, 0.35).translate(0, POLE + PH + 0.55, 0.9), lampM, n * 6);
  // платната: 3 дизайна (или снимките на потребителя) — по един InstancedMesh; лицето и гърбът — две инстанции
  // o.images — снимките на потребителя (3:1): [{ url, logo: 'left'|'right' }] — редуват се; иначе — 3-те нарисувани дизайна с марката
  const texs = (o.images && o.images.length ? o.images.map(im => { const u = typeof im === 'string' ? im : im.url, t = new THREE.TextureLoader().load(u); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }) : [0, 1, 2].map(i => design(i, { ...(o.brand || {}), company: o.company, years: o.years }))).map(M);
  const panelGeo = M(new THREE.PlaneGeometry(PW, PH).translate(0, POLE + PH / 2, 0.21));
  const mats = texs.map(t => M(new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.6 })));
  const per = texs.map(() => []);
  spots.forEach((s, i) => per[i % texs.length].push(s, s));   // лице + гръб — дизайнът се редува между билбордовете
  const panels = per.map((L, d) => { const m = new THREE.InstancedMesh(panelGeo, mats[d], Math.max(1, L.length)); m.count = L.length; g.add(m); return m; });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
  const put = (m, k, s, extraRy = 0, dx = 0) => { q.setFromAxisAngle(up, s.ry + extraRy); pos.set(s.x + Math.cos(s.ry + extraRy) * dx, 0, s.z - Math.sin(s.ry + extraRy) * dx); m4.compose(pos, q, one); m.setMatrixAt(k, m4); };
  spots.forEach((s, i) => {
    put(pole, i, s); put(frame, i, s); put(walk, i * 2, s); put(walk, i * 2 + 1, s, Math.PI);
    for (let k = 0; k < 3; k++) { put(lamps, i * 6 + k, s, 0, (k - 1) * 4); put(lamps, i * 6 + 3 + k, s, Math.PI, (k - 1) * 4); }
  });
  per.forEach((L, d) => L.forEach((s, k) => put(panels[d], k, s, k % 2 ? Math.PI : 0)));
  for (const m of [pole, frame, walk, lamps, ...panels]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
  // нощем: лампите в рамката и платната (осветени отгоре) — по-ярки
  const lights = spots.slice(0, 2).map(s => { const L = new THREE.PointLight(0xfff1c8, 0, 30, 2); L.position.set(s.x, POLE + PH + 1, s.z); g.add(L); return L; });
  return {
    group: g, spots,
    setNight(k = 0) { lampM.emissiveIntensity = 0.2 + 2.2 * k; for (const m of mats) m.emissiveIntensity = 0.05 + 0.75 * k; for (const L of lights) L.intensity = 40 * k; },
    dispose() { group.remove(g); for (const x of own) x.dispose && x.dispose(); for (const m of [pole, frame, walk, lamps, ...panels]) m.dispose(); },
  };
}


// ---------- истинските модели (Sketchfab, CC BY — assets/heavy/billboards/CREDITS.txt): 4 размера + въртящ се ----------
// face — мрежата на платното (скрива се; отпред и отзад слагаме наше платно с картината, изрязана по пропорциите му);
// axis — накъде гледа лицето на модела ('x' → завъртаме, за да гледа +z); faceW — колко широко е платното на място (м)
const HVB = 'assets/heavy/billboards/';
export const BB_KIT = {
  small: { url: HVB + 'bb-small.glb', face: 'Object_5', hide: ['Object_5', 'Object_7'], axis: 'z', faceW: 1.4 },
  medium: { url: HVB + 'bb-medium.glb', face: 'Cube005_Material004_0', hide: ['Cube005_Material004_0'], axis: 'x', faceW: 6 },
  large: { url: HVB + 'bb-large.glb', face: 'ADs_AD_0', hide: ['ADs_AD_0'], axis: 'z', faceW: 12, sink: 1.2 },   // sink — стълбът влиза в земята: платното от ~7 до ~11,3 м (истинският 12 × 4)
  mega: { url: HVB + 'bb-mega.glb', face: 'Object_10', hide: ['Object_10'], axis: 'x', faceW: 24, surface: true },   // surface — платното точно пред/зад конструкцията (бялото табло)
  rotating: { url: HVB + 'bb-rotating.glb', slats: true, axis: 'z', faceW: 9 },
};
const kitCache = {};
const loadKit = k => kitCache[k] = kitCache[k] || new GLTFLoader().loadAsync(BB_KIT[k].url);

// картините: { url, logo: 'left'|'right'|'center' } → платно с изрязване; панорамите без надпис (logo 'center' или over) — с марката отгоре в ъгъла
function overlayTex(img, b) {
  const W = 2048, H = Math.round(W * img.height / img.width), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.drawImage(img, 0, 0, W, H);
  const bw = W * 0.42, bh = H * 0.3, x = W * 0.03, y = H - bh - H * 0.06;
  g.fillStyle = 'rgba(8,14,28,.78)'; g.beginPath(); g.roundRect(x, y, bw, bh, 26); g.fill(); g.strokeStyle = b.col || '#d4af37'; g.lineWidth = 8; g.stroke();
  g.textBaseline = 'middle'; g.font = `${bh * 0.62}px "Noto Color Emoji", sans-serif`; g.fillText(b.ico || '🏗️', x + bh * 0.12, y + bh / 2);
  g.fillStyle = '#ffffff'; g.font = `800 ${bh * 0.3}px system-ui, sans-serif`; g.fillText((b.company || b.nm || '').toUpperCase(), x + bh * 0.95, y + bh * 0.36, bw - bh * 1.05);
  g.fillStyle = b.col || '#ffd54a'; g.font = `700 ${bh * 0.2}px Georgia, serif`; g.fillText(b.slogan || 'Строим бъдещето', x + bh * 0.97, y + bh * 0.72, bw - bh * 1.05);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
async function loadArt(list, brand) {
  const out = [];
  for (const it of list) {
    const img = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = it.url; }); if (!img) continue;
    let tex; if (it.over) tex = overlayTex(img, brand); else { tex = new THREE.Texture(img); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; }
    out.push({ tex, logo: it.logo || 'center', aspect: img.width / img.height });
  }
  return out;
}
// изрязване на картината по пропорциите на платното (a = ширина/височина): по-тясното — откъм логото
const LOGO_X = { left: [0, 0.47], right: [0.6, 1], center: [0.02, 0.47] };   // къде е блокът с логото в картината (center — марката, нарисувана отгоре вляво)
function portraitTex(art, a, full) {   // тясно/вертикално платно: блокът с логото, вписан по ширина, върху тъмен фон
  const img = art.tex.image, H = 1024, W = Math.round(H * a), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const [x0, x1] = full ? [0, 1] : LOGO_X[art.logo] || LOGO_X.center, sw = (x1 - x0) * img.width, sh = img.height, dh = W * sh / sw;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b1a3a'); gr.addColorStop(1, '#14284f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.drawImage(img, x0 * img.width, 0, sw, sh, 0, (H - dh) / 2, W, dh);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function cropTex(art, a) {
  if (a < 1.2 && art.tex.image && art.tex.image.width) return portraitTex(art, a, !!art.design);
  if (art.design && a < art.aspect * 0.8 && art.tex.image) return portraitTex(art, a, true);   // нарисуваният дизайн (името на фирмата) — цял, не изрязан
  const t = art.tex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  if (a >= art.aspect) { const ch = art.aspect / a; t.repeat.set(1, ch); t.offset.set(0, (1 - ch) / 2); }
  else { const cw = a / art.aspect; t.repeat.set(cw, 1); t.offset.set(art.logo === 'left' ? 0 : art.logo === 'right' ? 1 - cw : (1 - cw) / 2, 0); }
  return t;
}
const faceMat = tex => new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, roughness: 0.6 });

// един билборд от модела: клонинг, мащаб по faceW, нашите платна; връща { root, mats, mixer? }
function makeBoard(k, gl, arts, ai) {
  const K = BB_KIT[k], root = new THREE.Group(), m = gl.scene.clone(true); root.add(m);
  if (K.axis === 'x') m.rotation.y = -Math.PI / 2;   // лицето — към +z
  m.updateMatrixWorld(true);
  const mats = [], disp = [];
  if (K.slats) {   // въртящият се: ламели „N_k“ — лице k показва картина k, всяка ламела — своята ивица
    const sl = []; m.traverse(o => { if (!o.isMesh) return; const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()); if (sz.y < 0.05 && sz.x > 20) { o.visible = false; return; } const mm = /^(\d+)_(\d)$/.exec(o.name); if (mm) sl.push({ o, i: +mm[1], f: +mm[2], x: bb.getCenter(new THREE.Vector3()).x, h: sz.y }); });
    const idx = [...new Set(sl.map(q => q.i))].sort((a, b) => a - b), n = idx.length || 1, h = sl[0] ? sl[0].h : 10, a = (n * 2) / h;
    const s = K.faceW / (n * 2); m.scale.setScalar(s);
    for (const q of sl) { const art = arts[(ai + q.f) % arts.length], t = cropTex(art, a), j = idx.indexOf(q.i); t.repeat.x /= n; t.offset.x += t.repeat.x * j; const mt = faceMat(t); q.o.material = mt; mats.push(mt); disp.push(t, mt); }
    let mixer = null; if (gl.animations && gl.animations[0]) { mixer = new THREE.AnimationMixer(m); mixer.clipAction(gl.animations[0]).play(); }
    return { root, mats, mixer, dispose: () => disp.forEach(x => x.dispose()) };
  }
  let face = null; m.traverse(o => { if (o.isMesh && o.name === K.face) face = o; if (o.isMesh && (K.hide || []).includes(o.name)) o.visible = false; });
  const bbAll = new THREE.Box3().setFromObject(m), fb = face ? new THREE.Box3().setFromObject(face) : bbAll, fs = fb.getSize(new THREE.Vector3()), fc = fb.getCenter(new THREE.Vector3());
  const s = K.faceW / Math.max(1e-6, fs.x); m.scale.multiplyScalar(s); m.position.set(-fc.x * s, -bbAll.min.y * s, -((bbAll.min.z + bbAll.max.z) / 2) * s);
  const w = fs.x * s, hgt = fs.y * s, art = arts[ai % arts.length], t = cropTex(art, w / hgt), mt = faceMat(t); mats.push(mt); disp.push(t, mt);
  let zC = (fc.z - (bbAll.min.z + bbAll.max.z) / 2) * s, half = Math.max(0.02, fs.z * s / 2 + 0.02), zBack = fs.z * s < 0.05 ? -(Math.abs(zC) + 0.02) : zC - half, zFront = fs.z * s < 0.05 ? zC + 0.02 : zC + half;
  if (K.surface) {   // платното — по самата конструкция: най-предната и най-задната точка на видимите части на височината на платното
    root.updateMatrixWorld(true); const y0 = (fc.y - bbAll.min.y) * s - fs.y * s / 2, y1 = y0 + fs.y * s, sb = new THREE.Box3(), v = new THREE.Vector3(); let any = false;
    m.traverse(q => { if (!q.isMesh || !q.visible) return; const P = q.geometry.attributes.position; for (let i = 0; i < P.count; i += 3) { v.fromBufferAttribute(P, i).applyMatrix4(q.matrixWorld); if (v.y >= y0 && v.y <= y1) { sb.expandByPoint(v); any = true; } } });
    if (any) { zFront = sb.max.z + 0.03; zBack = sb.min.z - 0.03; } }
  const geo = new THREE.PlaneGeometry(w, hgt); disp.push(geo);
  const front = new THREE.Mesh(geo, mt); front.position.set(0, (fc.y - bbAll.min.y) * s, zFront); root.add(front);
  const back = new THREE.Mesh(geo, mt); back.position.set(0, (fc.y - bbAll.min.y) * s, zBack); back.rotation.y = Math.PI; root.add(back);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  try { mergeKids(root, 4); } catch (e) { }
  return { root, mats, dispose: () => disp.forEach(x => x.dispose()) };
}

// публичното: местата → билбордове (истинските модели; ако не дойдат — нарисуваните)
export function buildBillboards(group, o = {}) {
  const spots = o.spots || billboardSpots(o.roads || [], { ...o, widthOf: (i, k) => BB_KIT[o.sizes ? o.sizes[i % o.sizes.length] : k].faceW }), g = new THREE.Group(); g.name = 'billboards'; group.add(g);   // o.spots — ръчно (демото в Лабораторията)
  let alive = true, boards = [], fallback = null, night = 0;
  const api = { group: g, spots,
    setNight(k = 0) { night = k; for (const b of boards) for (const m of b.mats) m.emissiveIntensity = 0.05 + 0.75 * k; if (fallback) fallback.setNight(k); },
    update(dt) { for (const b of boards) if (b.mixer) b.mixer.update(dt); },
    dispose() { alive = false; group.remove(g); for (const b of boards) b.dispose(); if (fallback) fallback.dispose(); } };
  if (!spots.length) return api;
  const brand = { ...(o.brand || {}), company: o.company };
  const artList = (o.images && o.images.length ? o.images : []).map(x => typeof x === 'string' ? { url: x } : x);
  const sizes = spots.map((s, i) => o.sizes ? o.sizes[i % o.sizes.length] : s.k || 'large');
  Promise.all([...new Set(sizes)].map(k => loadKit(k).then(gl => [k, gl]))).then(async L => {
    const kits = Object.fromEntries(L);
    let arts = await loadArt(artList, brand);
    if (!arts.length || o.designs) arts = [...arts, ...[0, 1, 2].map(i => ({ tex: design(i, { ...brand, years: o.years }), logo: 'left', aspect: 1024 / 342, design: true }))];   // без снимки (или o.designs) — и нарисуваните с марката
    if (!alive) return;
    spots.forEach((s, i) => { const k = sizes[i], b = makeBoard(k, kits[k], arts, i); b.root.position.set(s.x, -(BB_KIT[k].sink || 0), s.z); b.root.rotation.y = s.ry; g.add(b.root); boards.push(b); });
    api.setNight(night);
  }).catch(e => { console.warn('billboards models', e); if (alive) { fallback = buildProcedural(g, o); api.setNight(night); } });
  return api;
}
