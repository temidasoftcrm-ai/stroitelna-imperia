// firefx2.js — 🔥 fire-real2: пожарът, „залепен“ за сградата (Лабораторията → fire-real2; собственикът, 29.10: „пламъчетата висят във въздуха
// до сградата, като свещички; бели петна по стените; нощем няма дим, няма отблясък; пожарната е паркирана в ъгъла на сградата“).
// • Пламъците — от прозорците и покрива: точките се смятат от завъртяната рамка на сградата (OBB) и решетка от прозорци (етаж ~3,1 м,
//   прозорец на ~4,2 м); лъч към стената / надолу към покрива ги слага ВЪРХУ истинската повърхност (моделите не са кутии). Огънят се
//   разпространява по етапа: един прозорец → съседните → нагоре → покривът; при силен огън езиците се сливат в непрекъсната стена.
//   Никога извън петното — само езиците от прозорците излизат до ~1 м навън.
// • Димът — гъст тъмен стълб, който се издига и се отнася от вятъра; нощем отдолу е осветен в оранжево; + искри (обща група точки).
// • Отблясъкът — оранжево петно по земята, сияния по стената около горящите прозорци и ореол над сградата (без PointLight — нова
//   светлина прекомпилира всички материали); трепти.
// • Опушването — материалите на сградата тъмнеят постепенно (собствени копия), БЕЗ нощната маска на прозорците: досега копието на
//   материала губеше шейдъра на nightfloors.js (onBeforeCompile не се копира), а emissiveMap оставаше — суровата маска светеше като
//   бели/бежови правоъгълници по стените. Фоновите сгради (InstancedMesh) — заместител с копие на материала само за горящата.
// • Пожарната — стълба/стрела към огъня и водна струя (дъга от частици) от дюзата до пламъците; пламъците се смаляват при гасене.
// Всичко е от пулове (без заделяне на памет в кадъра); по-далеч от ~400 м — скрито.
import * as THREE from 'three';
import { flameSprite, flameSize } from './fireflip.js';
import { canvasTex } from './texdata.js';

const FAR = 400, NEAR_FX = 260, MAXW = 30, MAXR = 9, NPUFF = 22, NEMB = 40, NJET = 3, JP = 48;
const WIND = new THREE.Vector3(0.85, 0, 0.45).normalize();
const DARK = new THREE.Color(0x15110e), EMB = new THREE.Color(0xff5a14);
const S_DAY = new THREE.Color(0x24201d), S_NIGHT = new THREE.Color(0x4a4440), S_LIT = new THREE.Color(0xd0682a), S_STEAM = new THREE.Color(0xd6d6d2), GLOW_C = new THREE.Color(0xff7a24);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0), _rc = new THREE.Raycaster();
const now = () => performance.now() / 1000;

// ---------- текстурите (общи) ----------
let TX = null;
function tex() {
  if (TX) return TX;
  const cv = (n, f) => { const c = document.createElement('canvas'); c.width = c.height = n; f(c.getContext('2d'), n); const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  // кълбо дим: няколко меки петна (неравен ръб, не гладък кръг)
  const puff = cv(128, (x, n) => { let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 26, cx = 64 + Math.cos(a) * d, cy = 64 + Math.sin(a) * d, rr = 26 + r() * 20, g = x.createRadialGradient(cx, cy, 1, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.55, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); } });
  const glow = cv(64, (x, n) => { const g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  const dot = cv(32, (x, n) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
  const rung = cv(32, (x) => { x.clearRect(0, 0, 32, 32); x.fillStyle = '#d4d8dc'; x.fillRect(0, 0, 4, 32); x.fillRect(28, 0, 4, 32); x.fillRect(0, 13, 32, 5); });
  rung.wrapS = rung.wrapT = THREE.RepeatWrapping;
  return TX = { puff, glow, dot, rung };
}

// ---------- рамката на сградата (OBB): c — центърът на земята, yaw, sx/sz — по местните оси, h — височината над земята ----------
export function obbOf(o) {
  if (!o) return null;
  const ry = o.rotation.y; o.rotation.y = 0; o.updateMatrixWorld(true);
  const b = new THREE.Box3(); o.traverse(m => { if (m.isMesh && !m.isSprite && m.visible !== false && !(m.material && m.material.transparent && m.material.opacity < 0.95)) b.expandByObject(m); });
  if (b.isEmpty()) b.setFromObject(o);
  const c = b.getCenter(new THREE.Vector3()).sub(o.position).applyAxisAngle(_up, ry).add(o.position);
  o.rotation.y = ry; o.updateMatrixWorld(true);
  return { c: c.setY(b.min.y), yaw: ry, sx: b.max.x - b.min.x, sz: b.max.z - b.min.z, h: b.max.y - b.min.y };
}
// фоновата сграда (кварталите по плана): матрицата на инстанцията (кутия 1×1×1, центърът на половин височина) + отместването на плана
export function obbOfMatrix(M, ox = 0, oz = 0) {
  M.decompose(_v, _q, _s); const yaw = new THREE.Euler().setFromQuaternion(_q, 'YXZ').y;
  return { c: new THREE.Vector3(_v.x + ox, _v.y - _s.y / 2, _v.z + oz), yaw, sx: _s.x, sz: _s.z, h: _s.y, roof: 1.2 };
}
// точката е в рамката (с отстъп m)? и избутване навън по най-късата ос — пожарната никога не паркира в сградата
export function outside(B, p, m = 2.5) {
  const cy = Math.cos(B.yaw), sy = Math.sin(B.yaw), dx = p.x - B.c.x, dz = p.z - B.c.z, lx = dx * cy - dz * sy, lz = dx * sy + dz * cy, hx = B.sx / 2 + m, hz = B.sz / 2 + m;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
  let nx = lx, nz = lz; if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
  p.x = B.c.x + nx * cy + nz * sy; p.z = B.c.z - nx * sy + nz * cy; return true;
}
// най-близката точка от петното (на земята) до p
export function nearPt(B, p, out) {
  const cy = Math.cos(B.yaw), sy = Math.sin(B.yaw), dx = p.x - B.c.x, dz = p.z - B.c.z, lx = Math.max(-B.sx / 2, Math.min(B.sx / 2, dx * cy - dz * sy)), lz = Math.max(-B.sz / 2, Math.min(B.sz / 2, dx * sy + dz * cy));
  return out.set(B.c.x + lx * cy + lz * sy, B.c.y, B.c.z - lx * sy + lz * cy);
}

// ---------- опушването: собствени копия на материалите, без нощната маска на прозорците ----------
function cloneMat(s) {
  if (!s || !s.color || s.isSpriteMaterial || s.isShaderMaterial || s.isPointsMaterial || (s.transparent && s.blending === THREE.AdditiveBlending)) return null;
  const c = s.clone(), ob = s.onBeforeCompile, src = ob && ob !== THREE.Material.prototype.onBeforeCompile ? ob.toString() : '';
  if (src && !s.userData.nightFloors && (!/emissive/i.test(src) || /#ifdef USE_EMISSIVEMAP/.test(src))) { c.onBeforeCompile = ob; if (s.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey) c.customProgramCacheKey = s.customProgramCacheKey; }   // напр. tileByScale (повторението на фасадата) — да; nightfloors — не
  c.visible = true; c.emissiveMap = null; if (c.emissive) c.emissive.setRGB(0, 0, 0); c.emissiveIntensity = 1; c.userData = { c0: s.color.clone(), fire2: 1 }; c.needsUpdate = true;
  return c;
}
function tint(L, k, glow) { const kk = Math.min(0.88, Math.max(0, k)); for (const c of L) { c.color.copy(c.userData.c0).lerp(DARK, kk); if (c.emissive) c.emissive.copy(EMB).multiplyScalar(glow * 0.07); } }   // отвътре — само намек (иначе цялата сграда светеше в оранжево)
// сграда (Object3D): k — 0…1 опушване, glow — оранжевото отвътре (нощем); k = glow = 0 → оригиналните материали обратно
export function scorch2(o, k, glow = 0) {
  if (!o) return; let S = o.userData.sc2;
  if (!S) { if (k <= 0.001 && glow <= 0.001) return; S = o.userData.sc2 = { L: [], all: [] }; o.traverse(m => { if (!m.isMesh || m.isSprite || !m.material) return; const src = m.material, arr = Array.isArray(src), cl = (arr ? src : [src]).map(cloneMat); if (!cl.some(Boolean)) return; const mm = cl.map((c, i) => c || (arr ? src[i] : src)); S.L.push([m, src]); m.material = arr ? mm : mm[0]; for (const c of cl) if (c) S.all.push(c); }); }
  if (k <= 0.001 && glow <= 0.001) { for (const [m, src] of S.L) m.material = src; for (const c of S.all) c.dispose(); delete o.userData.sc2; return; }
  if (S.k === k && S.g === glow) return; S.k = k; S.g = glow; tint(S.all, k, glow);
}
// фоновата сграда: скрива инстанцията (ключ 'fire2') и слага на мястото ѝ копие (InstancedMesh с 1 бройка — шейдърите на фасадата искат instanceMatrix)
export function blockStandIn(pv, b) {
  if (!pv || !b || !b.M || !pv.userData.hideBlocks) return null;
  const e0 = b.M.elements, kids = pv.children; let box = null, j = -1, idx = -1;
  for (let ci = 0; ci < kids.length && !box; ci++) { const c = kids[ci]; if (!c.isInstancedMesh || c.visible === false || c.userData.roof || !c.count || !(kids[ci + 1] && kids[ci + 1].isInstancedMesh && kids[ci + 1].userData.roof) || (c.material && c.material.transparent)) continue;   /* само фасадата от двойката фасада + покрив (romeBlocks / xParts); други слоеве със същата матрица (прозорците нощем и т.н.) — не */ const A = c.instanceMatrix.array;
    for (let i = 0; i < c.count; i++) { let ok = true; for (let q = 0; q < 16; q++) if (Math.abs(A[i * 16 + q] - e0[q]) > 1e-3) { ok = false; break; } if (ok) { box = c; j = i; idx = ci; break; } } }
  if (!box) return null;
  const roof = kids[idx + 1] && kids[idx + 1].isInstancedMesh && kids[idx + 1].userData.roof ? kids[idx + 1] : null, g = new THREE.Group(), all = []; g.name = 'fire2-standin';
  for (const src of roof ? [box, roof] : [box]) {
    const arr = Array.isArray(src.material), cl = (arr ? src.material : [src.material]).map(cloneMat), mm = cl.map((c, i) => c || (arr ? src.material[i] : src.material)); for (const c of cl) if (c) all.push(c);
    const im = new THREE.InstancedMesh(src.geometry, arr ? mm : mm[0], 1); src.getMatrixAt(j, _m); im.setMatrixAt(0, _m); if (src.instanceColor) { src.getColorAt(j, _c); im.setColorAt(0, _c); }
    im.castShadow = src.castShadow; im.receiveShadow = true; im.frustumCulled = false; if (src === roof) im.userData.fireRoof = 1; g.add(im); }
  pv.add(g); g.updateMatrixWorld(true); pv.userData.hideBlocks(new Set([b]), 'fire2');
  let K = -1, G = -1;
  return { g, set(k, glow = 0) { if (Math.abs(k - K) < 0.01 && Math.abs(glow - G) < 0.01) return; K = k; G = glow; tint(all, k, glow); },
    dispose() { if (g.parent) g.parent.remove(g); for (const c of all) c.dispose(); all.length = 0; if (pv.userData.hideBlocks) pv.userData.hideBlocks(null, 'fire2'); } };
}

// ---------- пожарът ----------
// parent — групата; B — рамката (obbOf / obbOfMatrix); o: { hit: [обекти за лъчите], toward: Vector3 (улицата — оттам тръгва огънят) }
export function createFire2(parent, B, o = {}) {
  const T = tex(), g = new THREE.Group(); g.name = 'fire2'; g.userData.B = B; parent.add(g);
  const cy = Math.cos(B.yaw), sy = Math.sin(B.yaw), ax = [cy, -sy], az = [sy, cy], gy = B.c.y, H = Math.max(2.5, B.h), size = Math.max(B.sx, B.sz);
  const hitObjs = (o.hit || []).filter(Boolean); hitObjs.forEach(h => h.updateMatrixWorld(true));
  const ray = (org, dir, far) => { if (!hitObjs.length) return null; _rc.set(org, dir); _rc.far = far; const hs = _rc.intersectObjects(hitObjs, true); for (const h of hs) { const m = h.object; if (m.isSprite || !m.isMesh || m.visible === false || (m.material && m.material.transparent && m.material.opacity < 0.95) || m.name === 'fire2') continue; return h; } return null; };
  // фасадите: n — нормалата навън, t — по фасадата, d — от центъра до стената, L — дължината
  const FAC = [[ax, az, B.sx / 2, B.sz], [[-ax[0], -ax[1]], az, B.sx / 2, B.sz], [az, ax, B.sz / 2, B.sx], [[-az[0], -az[1]], ax, B.sz / 2, B.sx]];
  const tw = o.toward || B.c, front = FAC.reduce((bi, F, i) => (F[0][0] * (tw.x - B.c.x) + F[0][1] * (tw.z - B.c.z)) > (FAC[bi][0][0] * (tw.x - B.c.x) + FAC[bi][0][1] * (tw.z - B.c.z)) ? i : bi, 0);
  const nf = Math.max(1, Math.min(6, Math.floor(H / 3.1))), fh = H > 3.1 * 6 ? 3.1 : H / nf, sill = Math.min(0.9, fh * 0.28);
  g.userData.front = FAC[front][0];   // за камерата на демото: откъм улицата
  const org = new THREE.Vector3(B.c.x + FAC[front][0][0] * FAC[front][2], gy + sill, B.c.z + FAC[front][0][1] * FAC[front][2]);
  let A = [];   // точките: { p, n: [nx, nz], roof, thr, ph, fh }
  FAC.forEach(([n, t, d, L]) => { const nc = Math.max(1, Math.min(5, Math.round(L / 4.2)));
    for (let f = 0; f < nf; f++) for (let i = 0; i < nc; i++) { const u = ((i + 0.5) / nc - 0.5) * L * 0.9, y = gy + f * fh + sill + 0.35;
      _v.set(B.c.x + n[0] * (d + 3) + t[0] * u, y + 0.6, B.c.z + n[1] * (d + 3) + t[1] * u); _w.set(-n[0], 0, -n[1]);
      const h = ray(_v, _w, d + 3.2); if (hitObjs.length && !h) continue;   // няма стена тук (L-образна сграда, проход) — без пламък във въздуха
      const p = h ? new THREE.Vector3(h.point.x + n[0] * 0.2, y, h.point.z + n[1] * 0.2) : new THREE.Vector3(B.c.x + n[0] * (d + 0.2) + t[0] * u, y, B.c.z + n[1] * (d + 0.2) + t[1] * u);
      A.push({ p, n, roof: false, fh, ph: Math.random() * 6.28 }); } });
  const dist = a => Math.hypot(a.p.x - org.x, a.p.z - org.z) + Math.max(0, a.p.y - org.y) * 0.55;
  let md = 1e-6; for (const a of A) md = Math.max(md, dist(a)); for (const a of A) a.thr = 0.03 + 0.62 * dist(a) / md;
  A.sort((p, q) => p.thr - q.thr); A = A.slice(0, MAXW);
  // покривът: решетка навътре от ръбовете; височината — лъч надолу (скатен покрив — по ската, не над стрехите)
  const R = [], rx = Math.max(1, Math.min(3, Math.round(B.sx / 6))), rz = Math.max(1, Math.min(3, Math.round(B.sz / 6))), TALL = H > 3.1 * 6;   // висока сграда: горят долните етажи — без пламъци на покрива 40 м по-горе
  if (!TALL) for (let i = 0; i < rx; i++) for (let k = 0; k < rz; k++) { const u = ((i + 0.5) / rx - 0.5) * B.sx * 0.7, w = ((k + 0.5) / rz - 0.5) * B.sz * 0.7, x = B.c.x + ax[0] * u + az[0] * w, z = B.c.z + ax[1] * u + az[1] * w;
    _v.set(x, gy + H + 8, z); _w.set(0, -1, 0); const h = ray(_v, _w, H + 9); const y = h ? h.point.y : gy + H + (B.roof ? B.roof * (1 - Math.max(Math.abs(u) / B.sx, Math.abs(w) / B.sz)) : 0);
    if (hitObjs.length && h && h.point.y < gy + H * 0.4) continue; R.push({ p: new THREE.Vector3(x, y - 0.1, z), n: null, roof: true, fh, ph: Math.random() * 6.28, r: Math.hypot(u, w) }); }
  let rm = 1e-6; for (const a of R) rm = Math.max(rm, a.r); for (const a of R) a.thr = 0.42 + 0.38 * a.r / rm;
  const ALL = [...A, ...R.slice(0, MAXR)], top = R.length ? Math.max(...R.map(a => a.p.y)) : gy + H, sb = new THREE.Vector3(B.c.x, top + 0.8, B.c.z);   // sb — откъдето излиза димът (покривът; при висока — над най-горния горящ прозорец)
  // пламъците — по един на точка (флипбукът се прелиства сам)
  for (const a of ALL) { const s = flameSprite(1); s.visible = false; s.renderOrder = 4; s.userData.ph = Math.random() * 32; a.s = s; g.add(s); }
  // сиянието по стената около горящите прозорци — една InstancedMesh (1 рисуване)
  const wg = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), Math.max(1, A.length));
  wg.frustumCulled = false; wg.renderOrder = 3; wg.count = A.length; for (let i = 0; i < A.length; i++) { wg.setMatrixAt(i, _m.makeScale(0, 0, 0)); wg.setColorAt(i, _c.setRGB(0, 0, 0)); } g.add(wg);
  // димът
  const puffs = []; for (let i = 0; i < NPUFF; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.puff, color: 0x24201d, transparent: true, depthWrite: false, opacity: 0 })); s.userData.ph = i / NPUFF; s.userData.j = Math.random(); s.material.rotation = Math.random() * 6.28; s.renderOrder = 2; s.visible = false; g.add(s); puffs.push(s); }
  // искрите
  const ep = new Float32Array(NEMB * 3), er = Float32Array.from({ length: NEMB * 5 }, () => Math.random()), emb = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ep, 3)), new THREE.PointsMaterial({ map: T.dot, color: 0xffa040, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  emb.frustumCulled = false; emb.renderOrder = 5; emb.visible = false; g.add(emb);
  // отблясъкът по земята и ореолът
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T.glow, color: GLOW_C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, toneMapped: false }));
  gr.rotation.x = -Math.PI / 2; gr.position.set(B.c.x, gy + 0.08, B.c.z); const gs = size * 1.5 + 18; gr.scale.set(gs, gs, 1); gr.renderOrder = 1; gr.visible = false; g.add(gr);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: GLOW_C, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
  halo.position.set(B.c.x, gy + (TALL ? 12 : H * 0.75), B.c.z); halo.scale.setScalar(size * 1.4 + Math.min(H, 20) * 0.8 + 8); halo.renderOrder = 1; halo.visible = false; g.add(halo);
  // водните струи (общ буфер точки за 3 струи)
  const jp = new Float32Array(NJET * JP * 3).fill(-9999), jets = Array.from({ length: NJET }, () => ({ on: false, a: new THREE.Vector3(), b: new THREE.Vector3() }));
  const jet = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(jp, 3)), new THREE.PointsMaterial({ map: T.dot, color: 0xd6ecff, size: 0.9, transparent: true, opacity: 0.9, depthWrite: false }));
  jet.frustumCulled = false; jet.renderOrder = 6; jet.visible = false; g.add(jet);
  const jr = Float32Array.from({ length: JP * 3 }, () => Math.random() - 0.5);
  let act = [], last = 0;   // запалените точки (за целите на водата)
  const st = { stage: 0, inten: 0 };
  function update(p) {
    const t = now(), stage = Math.max(0, Math.min(1, p.stage || 0)), I = Math.max(0, Math.min(1, p.inten || 0)), night = p.night || 0, steam = p.steam || 0;
    st.stage = stage; st.inten = I;
    const cd = p.cam ? p.cam.distanceTo(B.c) : 0; g.visible = cd < FAR; if (!g.visible) return;
    const fk = 0.78 + 0.22 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3) + 0.06 * Math.sin(t * 23.7), on = stage > 0.005 && I > 0.02, hi = Math.max(0, (stage - 0.72) / 0.28);
    act.length = 0; let wi = 0, hiA = null;
    for (const a of ALL) { const k = on ? Math.max(0, Math.min(1, (stage - a.thr) / 0.1)) : 0, s = a.s; s.visible = k > 0;
      if (!a.roof) { if (k > 0) { const wk = (0.6 + 0.4 * Math.sin(t * 5 + a.ph)) * k * I * fk; wg.setMatrixAt(wi, _m.compose(_v.set(a.p.x - a.n[0] * 0.12, a.p.y + a.fh * 0.3, a.p.z - a.n[1] * 0.12), _q.setFromAxisAngle(_up, Math.atan2(a.n[0], a.n[1])), _s.set(3.2 + 2 * hi, a.fh * 1.3 + 1.2 * hi, 1))); wg.setColorAt(wi, _c.copy(GLOW_C).multiplyScalar(wk * (0.35 + 0.65 * night))); }
        else wg.setMatrixAt(wi, _m.makeScale(0, 0, 0)); wi++; }
      if (k <= 0) continue; act.push(a); if (!a.roof && (!hiA || a.p.y > hiA.p.y)) hiA = a;
      const fl = 0.85 + 0.15 * Math.sin(t * 7 + a.ph) * Math.sin(t * 4.3 + a.ph * 2), sz = (0.3 + 0.7 * I) * fl;
      if (a.roof) { const h = (2.6 + 0.14 * size) * (0.4 + 0.6 * k) * sz * (1 + 0.6 * hi); s.position.copy(a.p); flameSize(s, h); }
      else { const h = Math.max(1.6, Math.min(3.4, a.fh * 0.95)) * (0.45 + 0.6 * k) * sz * (1 + 0.8 * hi), out = 0.15 + 0.7 * k * I; s.position.set(a.p.x + a.n[0] * out, a.p.y - 0.25, a.p.z + a.n[1] * out); flameSize(s, h); }   // езикът излиза от прозореца до ~0,85 м навън
    }
    wg.instanceMatrix.needsUpdate = true; if (wg.instanceColor) wg.instanceColor.needsUpdate = true; wg.visible = on;
    if (TALL && hiA) sb.set(hiA.p.x + hiA.n[0] * 1.5, hiA.p.y + hiA.fh, hiA.p.z + hiA.n[1] * 1.5); else if (!TALL) sb.set(B.c.x, top + 0.8, B.c.z);
    // димът: тъмен стълб нагоре и по вятъра; нощем отдолу — оранжев; при гасене — пара (светъл)
    const sm = Math.min(1, stage * 2) * (0.5 + 0.5 * I), sv = Math.min(1, sm + steam * 0.7), Hc = 18 + size * 1.1 + 22 * stage, rate = 0.03 + 0.025 * I, stK = sv > 0 ? Math.min(1, steam * 0.7 / sv) : 0;
    for (let i = 0; i < NPUFF; i++) { const s = puffs[i]; s.visible = sv > 0.02; if (!s.visible) continue; const u = s.userData, ph = (t * rate + u.ph) % 1, rise = ph * Hc, dr = rise * 0.2 + ph * ph * Hc * 0.45;
      s.position.set(sb.x + WIND.x * dr + Math.sin(ph * 6 + u.j * 9) * 1.4 * ph * (1 + size * 0.05), sb.y + rise, sb.z + WIND.z * dr + Math.cos(ph * 5 + u.j * 7) * 1.2 * ph);
      s.scale.setScalar(((2.5 + size * 0.22) * (0.6 + 0.4 * stage) + ph * (7 + size * 0.45)) * (0.85 + 0.3 * u.j)); s.material.rotation += 0.002;
      _c.copy(S_DAY).lerp(S_NIGHT, night * 0.7).lerp(S_LIT, Math.min(1, night * (1 - ph) * (1 - ph) * stage * I * 1.1)).lerp(S_STEAM, stK); s.material.color.copy(_c);
      s.material.opacity = Math.min(0.95, (0.95 * sm + 0.6 * steam) * Math.min(1, ph * 5) * Math.pow(1 - ph, 0.6)); }
    // искрите — отблизо
    emb.visible = on && stage > 0.25 && cd < NEAR_FX; if (emb.visible) { const rr = er;
      for (let i = 0; i < NEMB; i++) { const ph = (t * (0.25 + 0.3 * rr[i * 5 + 2]) + rr[i * 5]) % 1, a0 = rr[i * 5 + 1] * 6.28 + t * 2 * rr[i * 5 + 2], u = (rr[i * 5 + 3] - 0.5) * B.sx * 0.8, w = (rr[i * 5 + 4] - 0.5) * B.sz * 0.8, rad = 0.4 + ph * 1.8;
        const ek = TALL ? 0.15 : 1; ep[i * 3] = sb.x + (ax[0] * u + az[0] * w) * ek + Math.cos(a0) * rad + WIND.x * ph * 8; ep[i * 3 + 1] = sb.y - 0.8 + ph * (6 + 12 * stage); ep[i * 3 + 2] = sb.z + (ax[1] * u + az[1] * w) * ek + Math.sin(a0) * rad + WIND.z * ph * 8; }
      emb.geometry.attributes.position.needsUpdate = true; emb.material.opacity = I * (0.6 + 0.4 * night); emb.material.size = 0.22 + 0.18 * Math.abs(Math.sin(t * 13)); }
    // отблясъкът
    const gk = on ? stage * (0.3 + 0.7 * I) * fk : 0; gr.visible = halo.visible = gk > 0.01;
    gr.material.opacity = gk * (0.18 + 0.72 * night); halo.material.opacity = gk * night * 0.45;
    // водата: дъга от дюзата до пламъците — частиците текат по нея и се разпръскват към края
    let any = false; for (let j = 0; j < NJET; j++) { const J = jets[j], o3 = j * JP * 3;
      if (!J.on) { if (jp[o3 + 1] !== -9999) for (let i = 0; i < JP; i++) jp[o3 + i * 3 + 1] = -9999; continue; } any = true;
      const L = J.a.distanceTo(J.b), mx = (J.a.x + J.b.x) / 2, mz = (J.a.z + J.b.z) / 2, my = Math.max(J.a.y, J.b.y) + 1 + L * 0.18;
      for (let i = 0; i < JP; i++) { const u = (t * 1.3 + i / JP + j * 0.31) % 1, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u, sp = u * u * (0.6 + L * 0.03);
        jp[o3 + i * 3] = a * J.a.x + b * mx + c * J.b.x + jr[i * 3] * sp; jp[o3 + i * 3 + 1] = a * J.a.y + b * my + c * J.b.y + jr[i * 3 + 1] * sp; jp[o3 + i * 3 + 2] = a * J.a.z + b * mz + c * J.b.z + jr[i * 3 + 2] * sp; } }
    jet.visible = any && cd < NEAR_FX; if (jet.visible) { jet.geometry.attributes.position.needsUpdate = true; jet.material.color.setRGB(0.84 - 0.45 * night, 0.92 - 0.45 * night, 1 - 0.4 * night); }
    last = t;
  }
  return {
    g, B, update, front: FAC[front][0], st,
    // k-тата цел за водата: запалените точки (първите запалени — най-силните); няма ли — покривът
    target(k, out) { if (act.length) { const a = act[k % act.length]; return out.set(a.p.x, a.p.y + (a.roof ? 0.8 : 0.9), a.p.z); } return out.set(B.c.x, top, B.c.z); },
    highest(out) { let b = null; for (const a of act) if (!b || a.p.y > b.p.y) b = a; return b ? out.set(b.p.x, b.p.y + 1, b.p.z) : out.set(B.c.x, top, B.c.z); },
    setJet(j, a, b, on = true) { const J = jets[j]; if (!J) return; J.on = !!on; if (on) { J.a.copy(a); J.b.copy(b); } },
    jetsOff() { for (const J of jets) J.on = false; },
    count: () => ({ flames: act.length, anchors: ALL.length, windows: A.length, roof: Math.min(R.length, MAXR) }),
    dispose() { if (g.parent) g.parent.remove(g); g.traverse(m => { if (m.material) { if (m.material.map && m.material.map !== T.puff && m.material.map !== T.glow && m.material.map !== T.dot) m.material.map.dispose(); m.material.dispose(); } if (m.geometry && !m.isSprite) m.geometry.dispose(); }); }
  };
}

// ---------- стълбата/стрелата на пожарната: въртяща се основа отзад на покрива, вдига се и се удължава към огъня; дюзата — на върха ----------
// (fire-cyber има своя възел Ladder — тогава въртим него; другите модели — добавена стълба)
export function ladderRig(tk) {
  if (tk.userData.rig2) return tk.userData.rig2;
  tk.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(tk.matrixWorld).invert(), b = new THREE.Box3(), bb = new THREE.Box3();
  tk.traverse(m => { if (!m.isMesh || m.isSprite || !m.geometry || (m.material && m.material.transparent)) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.union(bb.copy(m.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, m.matrixWorld))); });
  if (b.isEmpty()) b.set(new THREE.Vector3(-1.2, 0, -4.5), new THREE.Vector3(1.2, 3, 4.5));
  const S = tk.getWorldScale(new THREE.Vector3()).x || 1, node = tk.getObjectByName('Ladder');
  const yawG = new THREE.Group(), pitchG = new THREE.Group(), lad = new THREE.Group(), tip = new THREE.Object3D(); yawG.scale.setScalar(1 / S);
  yawG.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.05 / S, b.min.z + (b.max.z - b.min.z) * 0.22); tk.add(yawG); yawG.add(pitchG); pitchG.add(lad); pitchG.add(tip);
  let rungM = null;
  if (!node) {
    const metal = new THREE.MeshStandardMaterial({ color: 0xc4c9ce, metalness: 0.6, roughness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: 0xa81c18, roughness: 0.6 });
    yawG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.45, 14).translate(0, 0.22, 0), red)); pitchG.position.y = 0.5;
    for (const x of [-0.42, 0.42]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 1).translate(0, 0, 0.5), metal); r.position.x = x; lad.add(r); }
    rungM = new THREE.MeshStandardMaterial({ map: tex().rung.clone(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 }); rungM.map.wrapS = rungM.map.wrapT = THREE.RepeatWrapping;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), rungM); lad.add(pl);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), red); bk.position.y = 0.2; tip.add(bk);   // кошът с дюзата
  }
  let yaw = 0, pitch = 0.02, len = 7, lt = 0;
  const R = { tip, update(target, on) {
    const t = now(), dt = Math.min(0.25, lt ? t - lt : 0.05); lt = t;
    let wy = 0, wp = 0.02, wl = 7;
    if (on && target) { yawG.updateMatrixWorld(true); yawG.getWorldPosition(_v); _w.copy(target); yawG.parent.worldToLocal(_w).sub(yawG.position); wy = Math.atan2(_w.x, _w.z);
      const dx = target.x - _v.x, dz = target.z - _v.z, dy = target.y - _v.y - 0.5, hd = Math.hypot(dx, dz); wp = Math.max(0.15, Math.min(1.2, Math.atan2(dy, hd) + 0.12)); wl = Math.max(6, Math.min(26, Math.hypot(hd, dy) - 3)); }
    const k = Math.min(1, dt * 1.1); yaw += Math.atan2(Math.sin(wy - yaw), Math.cos(wy - yaw)) * k; pitch += (wp - pitch) * k; len += (wl - len) * k;
    if (node) { node.rotation.order = 'YXZ'; node.rotation.y = yaw; node.rotation.x = -pitch; yawG.rotation.y = yaw; pitchG.rotation.x = -pitch; tip.position.set(0, 0.3, Math.max(6, len)); }
    else { yawG.rotation.y = yaw; pitchG.rotation.x = -pitch; lad.scale.z = len; tip.position.set(0, 0.45, len); if (rungM) rungM.map.repeat.set(1, len / 0.45); }
    tip.updateMatrixWorld(true); return tip;
  }, deployed: () => pitch > 0.12, dispose() { if (yawG.parent) yawG.parent.remove(yawG); delete tk.userData.rig2; } };
  return tk.userData.rig2 = R;
}
