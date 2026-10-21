// vault3d.js — 🏦 трезорът зад борда (флаг vault; потребителят: „трезор зад заседателната зала — парите и златото на холдинга“).
// vaultDoor(scene, { x, y, z, r }) — масивната кръгла врата в стената на залата (светва при посочване, отваря се на панта);
// createVault(renderer, o) — малката стая зад нея (своя сцена, същият renderer): три зони с пачки и кюлчета (InstancedMesh):
//   🔒 Резерв (Борис пази ≥ 1 месец разходи) · 📈 За инвестиции (предложенията на директорите харчат само оттук) · 💰 Свободни (твои).
// o: { money() → наличните €, split: { res, inv } (%; свободните — останалото), onSplit(split), monthCost() → разходите за месец, night() → 0…1, onBack() }
// Пълен трезор: 500 млрд. € (скалата е логаритмична — и малките суми се виждат). Над това — „трезорът е пълен — надгради“.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { feature } from './lab/feature.js';
import { loadMoney } from './money3d.js';   // 💵 флаг money-real: истински пачки и кюлчета

export const VAULT_CAP = 500e9;
const ZONES = [
  { k: 'res', ico: '🔒', nm: 'Резерв', col: '#7fb4ff', tint: 0x6f8fb8, note: 'Борис пази поне 1 месец разходи' },
  { k: 'inv', ico: '📈', nm: 'За инвестиции', col: '#5fe08f', tint: 0x5fae7a, note: 'предложенията на директорите харчат само оттук' },
  { k: 'free', ico: '💰', nm: 'Свободни', col: '#ffd54a', tint: 0xd8b04a, note: 'твои — дивиденти и ръчни решения' },
];
const B = n => Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: n >= 1e11 ? 0 : 1 })} млрд. €` : Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${Math.round(n).toLocaleString('bg-BG')} €`;
// колко от трезора е пълно (0…1): логаритмично от 1 млн. до 500 млрд.
export const fillOf = m => m <= 0 ? 0 : Math.min(1, Math.log10(1 + m / 1e6) / Math.log10(1 + VAULT_CAP / 1e6));

// ---------- вратата ----------
export function vaultDoor(scene, { x = 0, y = 1.25, z = 0, r = 0.56 } = {}) {
  const own = [], M = (o) => { own.push(o); return o; };
  const steel = M(new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.32 })), dark = M(new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.8, roughness: 0.45 }));
  const brass = M(new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 1, roughness: 0.28, emissive: 0x000000 }));
  const root = new THREE.Group(); root.position.set(x, y, z); scene.add(root);
  const mesh = (geo, mat) => { M(geo); const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.userData.keep = true; return m; };
  // рамката в стената и тъмният отвор зад вратата
  const frame = mesh(new THREE.TorusGeometry(r + 0.05, 0.07, 16, 48), steel); frame.position.z = 0.03; root.add(frame);
  const hole = mesh(new THREE.CircleGeometry(r, 48), M(new THREE.MeshBasicMaterial({ color: 0x07090c }))); hole.position.z = 0.012; root.add(hole);
  const glowRing = mesh(new THREE.TorusGeometry(r + 0.05, 0.085, 12, 48), M(new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  glowRing.position.z = 0.04; root.add(glowRing);
  // крилото: на панта отдясно (гледано отпред) — пивотът е на ръба
  const hinge = new THREE.Group(); hinge.position.set(r, 0, 0.05); root.add(hinge);
  const leaf = new THREE.Group(); leaf.position.x = -r; hinge.add(leaf);
  const disc = mesh(new THREE.CylinderGeometry(r - 0.01, r - 0.01, 0.2, 48), steel); disc.rotation.x = Math.PI / 2; disc.position.z = 0.04; leaf.add(disc);
  for (const [rr, w] of [[r * 0.82, 0.02], [r * 0.55, 0.018]]) { const t = mesh(new THREE.TorusGeometry(rr, w, 8, 48), dark); t.position.z = 0.145; leaf.add(t); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, b = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 10), brass); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0.15); leaf.add(b); }
  // воланът: главина + 6 спици с топчета
  const wheel = new THREE.Group(); wheel.position.z = 0.2; leaf.add(wheel);
  const hub = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), brass); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, sp = mesh(new THREE.CylinderGeometry(0.014, 0.014, r * 0.62, 8), brass); sp.position.set(Math.cos(a) * r * 0.31, Math.sin(a) * r * 0.31, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const kn = mesh(new THREE.SphereGeometry(0.032, 12, 10), brass); kn.position.set(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 0); wheel.add(kn); }
  const plate = mesh(new THREE.BoxGeometry(0.26, 0.07, 0.01), brass); plate.position.set(0, -r * 0.7, 0.15); leaf.add(plate);
  // невидимата мишена за клик
  const hit = new THREE.Mesh(M(new THREE.CircleGeometry(r + 0.12, 24)), M(new THREE.MeshBasicMaterial({ visible: false }))); hit.position.z = 0.25; hit.userData.vault = true; root.add(hit);
  let hov = 0, hovT = 0, open = 0, openT = 0, t = 0;
  return {
    root, hit,
    hover(on) { hovT = on ? 1 : 0; },
    setOpen(k) { openT = k; },
    get opened() { return open; },
    update(dt, night = 0) {
      t += dt; hov += (hovT - hov) * Math.min(1, dt * 8); open += (openT - open) * Math.min(1, dt * 2.2);
      glowRing.material.opacity = hov * (0.45 + 0.2 * Math.sin(t * 4)) + night * 0.12;
      brass.emissive.setHex(0xffb030); brass.emissiveIntensity = 0.12 * hov + 0.1 * night;
      wheel.rotation.z = -open * Math.PI * 1.5;   // воланът се завърта, после крилото се отваря
      hinge.rotation.y = -Math.max(0, open - 0.35) / 0.65 * 1.75;
    },
    dispose() { scene.remove(root); for (const o of own) o.dispose && o.dispose(); },
  };
}

// ---------- текстура на пачката (лента + банкнота) ----------
function cashTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, '#5f8f6a'); gr.addColorStop(1, '#3f6e52'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = 'rgba(230,245,225,.55)'; g.lineWidth = 3; g.strokeRect(10, 10, 236, 108);
  g.fillStyle = 'rgba(230,245,225,.45)'; g.beginPath(); g.arc(70, 64, 26, 0, Math.PI * 2); g.fill();
  g.font = 'bold 42px Georgia, serif'; g.fillStyle = 'rgba(240,250,235,.85)'; g.fillText('500', 140, 80);
  g.fillStyle = '#f2ead2'; g.fillRect(112, 0, 26, 128); g.fillStyle = '#b8862e'; g.fillRect(112, 54, 26, 20);   // бандерол
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function metalTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#4a5058'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 40, 1); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  for (let x = 16; x < 256; x += 32) for (let y = 16; y < 256; y += 64) { g.fillStyle = 'rgba(200,205,212,.5)'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- трезорът ----------
const SHELF_W = 1.7, SHELF_D = 0.55, SHELVES = [0.32, 0.86, 1.4], CASH = { w: 0.16, h: 0.07, d: 0.075 }, BAR = { w: 0.2, h: 0.06, d: 0.09 };
const CASH_SH = [0, 1], GOLD_SH = [2], CASH_L = 3, GOLD_L = 3;   // пачките — долу и в средата (до 3 реда), златото — на горния рафт
export function createVault(renderer, o = {}) {
  const own = [], M = x => { own.push(x); return x; };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d1014);
  const cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 40); cam.position.set(0, 1.55, 3.6); cam.lookAt(0, 0.95, -0.6);
  const look = new THREE.Vector3(0, 0.95, -0.6), mouse = new THREE.Vector2();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x20242a, 0.55));
  const key = new THREE.SpotLight(0xfff1d8, 40, 12, 0.9, 0.5, 1.6); key.position.set(0, 3.2, 2.2); key.target.position.set(0, 0.6, -1); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
  // стаята: стоманени стени с нитове, под — тъмен камък
  const mt = M(metalTex()); mt.repeat.set(4, 2);
  const wallM = M(new THREE.MeshStandardMaterial({ map: mt, metalness: 0.7, roughness: 0.5 })), floorM = M(new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.8, metalness: 0.2 }));
  const box = (w, h, d, m, x, y, z) => { const g = M(new THREE.BoxGeometry(w, h, d)), q = new THREE.Mesh(g, m); q.position.set(x, y, z); q.castShadow = q.receiveShadow = true; scene.add(q); return q; };
  const floor = new THREE.Mesh(M(new THREE.PlaneGeometry(9, 8)), floorM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  box(9, 3.2, 0.1, wallM, 0, 1.6, -1.6); box(0.1, 3.2, 8, wallM, -4.2, 1.6, 0); box(0.1, 3.2, 8, wallM, 4.2, 1.6, 0);
  const ceil = new THREE.Mesh(M(new THREE.PlaneGeometry(9, 8)), M(new THREE.MeshStandardMaterial({ color: 0x15181c }))); ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.2; scene.add(ceil);
  // три стелажа (зоните) с цветна лента отпред; лампа над всеки
  const steel = M(new THREE.MeshStandardMaterial({ color: 0x8c949e, metalness: 0.85, roughness: 0.35 }));
  const xs = [-2.05, 0, 2.05], zs = -1.15;
  const zoneLights = [];
  ZONES.forEach((Z, i) => {
    const x = xs[i];
    for (const y of SHELVES) box(SHELF_W, 0.03, SHELF_D, steel, x, y - 0.015, zs);
    for (const dx of [-SHELF_W / 2, SHELF_W / 2]) box(0.04, 1.85, SHELF_D, steel, x + dx, 0.92, zs);
    const strip = box(SHELF_W, 0.05, 0.02, M(new THREE.MeshBasicMaterial({ color: Z.tint, toneMapped: false })), x, 1.86, zs + SHELF_D / 2);
    const L = new THREE.PointLight(Z.tint, 1.2, 3.2, 1.6); L.position.set(x, 2.3, zs + 0.7); scene.add(L); zoneLights.push(L);
  });
  // пачките и кюлчетата: по един InstancedMesh на зона (места — отдолу нагоре; кюлчетата — върху горния рафт и отпред)
  const cashGeo = M(new THREE.BoxGeometry(CASH.w, CASH.h, CASH.d)), ct = M(cashTex());
  const cashMats = [M(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 })), M(new THREE.MeshStandardMaterial({ map: ct, roughness: 0.7 }))];
  const cashM = [cashMats[0], cashMats[0], cashMats[1], cashMats[0], cashMats[1], cashMats[1]];   // +x −x +y −y +z −z: отгоре, отпред и отзад — банкнотата, отстрани — ръбът на пачката
  const barGeo = M(new THREE.CylinderGeometry(Math.SQRT1_2 * 0.75, Math.SQRT1_2, 1, 4, 1)); barGeo.rotateY(Math.PI / 4); barGeo.scale(BAR.w, BAR.h, BAR.d); barGeo.translate(0, BAR.h / 2, 0);
  const goldM = M(new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.22, emissive: 0xffa21a, emissiveIntensity: 0 }));
  const slots = (it, shelves, layers) => {   // местата в зоната: рафт → етаж → отпред назад → по ширина
    const out = [], nx = Math.floor((SHELF_W - 0.1) / (it.w + 0.01)), nz = Math.floor((SHELF_D - 0.05) / (it.d + 0.012));
    for (const si of shelves) for (let h = 0; h < layers; h++) for (let iz = nz - 1; iz >= 0; iz--) for (let ix = 0; ix < nx; ix++) out.push([(ix - (nx - 1) / 2) * (it.w + 0.01), SHELVES[si] + h * (it.h + 0.004), (iz - (nz - 1) / 2) * (it.d + 0.012)]);
    return out;
  };
  const CASH_PER = slots(CASH, CASH_SH, CASH_L).length, GOLD_PER = slots(BAR, GOLD_SH, GOLD_L).length;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const zones = ZONES.map((Z, i) => {
    const cs = slots(CASH, CASH_SH, CASH_L), gs = slots(BAR, GOLD_SH, GOLD_L);
    const cash = new THREE.InstancedMesh(cashGeo, cashM, cs.length), gold = new THREE.InstancedMesh(barGeo, goldM, gs.length);
    cs.forEach((s, k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ((k * 7919) % 7 - 3) * 0.012); m4.compose(p.set(xs[i] + s[0], s[1] + CASH.h / 2, zs + s[2]), q, s1); cash.setMatrixAt(k, m4); });
    gs.forEach((s, k) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (k % 2) * Math.PI); m4.compose(p.set(xs[i] + s[0], s[1], zs + s[2]), q, s1); gold.setMatrixAt(k, m4); });
    cash.count = 0; gold.count = 0; cash.castShadow = gold.castShadow = true; cash.receiveShadow = gold.receiveShadow = true;
    scene.add(cash, gold);
    return { Z, x: xs[i], cash, gold, cn: 0, gn: 0, ct: 0, gt: 0, v: 0 };
  });
  if (feature('money-real')) loadMoney(u => new GLTFLoader().loadAsync(u)).then(R => { const cg = R.cashGeo(CASH), bg = R.barGeo(BAR); for (const z of zones) { if (cg) { z.cash.geometry = cg; z.cash.material = R.cashMat; } if (bg) z.gold.geometry = bg; } if (R.barMat && R.barMat.map) { goldM.map = R.barMat.map; goldM.color.set(0xffffff); goldM.needsUpdate = true; } }).catch(() => {});
  // HTML: картите на зоните, разпределението и бутонът обратно
  const el = document.createElement('div'); el.className = 'vault-ui';
  el.innerHTML = `<style>.vault-ui{position:fixed;inset:0;pointer-events:none;font:14px system-ui,sans-serif;color:#e8edf3;z-index:100000}
.vault-ui .vzc{position:absolute;transform:translate(-50%,-100%);min-width:170px;padding:8px 12px;border-radius:12px;background:#0b0f16d9;border:1px solid var(--c);box-shadow:0 0 18px color-mix(in srgb,var(--c) 35%,transparent);text-align:center}
.vault-ui .vzc b{display:block;font-size:15px;color:var(--c)} .vault-ui .vzc .v{font:800 19px system-ui;margin:2px 0} .vault-ui .vzc small{color:#9aa6b4;font-size:11px}
.vault-ui .vbar{position:absolute;left:50%;bottom:130px;transform:translateX(-50%);width:min(720px,calc(100vw - 32px));padding:12px 16px;border-radius:14px;background:#0b0f16e6;border:1px solid #2c3644;pointer-events:auto}
.vault-ui .vbar .vrow{display:flex;gap:10px;align-items:center;margin:4px 0} .vault-ui .vbar label{flex:0 0 130px} .vault-ui .vbar input{flex:1;accent-color:var(--c)} .vault-ui .vbar .pc{flex:0 0 150px;text-align:right;font-weight:700}
.vault-ui .vtop{position:absolute;left:16px;top:14px;pointer-events:auto;display:flex;gap:10px;align-items:center} .vault-ui .vtop button{background:#1d2530;color:#e8edf3;border:1px solid #3a4656;border-radius:10px;padding:8px 14px;font:600 14px system-ui;cursor:pointer}
.vault-ui .vtot{font:800 18px system-ui;color:#ffd54a} .vault-ui .vwarn{color:#ff9b6b;font-size:12px;margin-top:4px} .vault-ui .vfull{color:#ffd54a;font-size:12px;margin-top:4px}</style>
<div class="vtop"><button class="back">← Към залата</button><span class="vtot"></span></div>
${ZONES.map(Z => `<div class="vzc" data-z="${Z.k}" style="--c:${Z.col}"><b>${Z.ico} ${Z.nm}</b><div class="v"></div><small>${Z.note}</small></div>`).join('')}
<div class="vbar"><div class="vrow" style="--c:#7fb4ff"><label>🔒 Резерв</label><input type="range" min="0" max="100" step="1" data-s="res"><span class="pc" data-p="res"></span></div>
<div class="vrow" style="--c:#5fe08f"><label>📈 За инвестиции</label><input type="range" min="0" max="100" step="1" data-s="inv"><span class="pc" data-p="inv"></span></div>
<div class="vrow" style="--c:#ffd54a"><label>💰 Свободни</label><span style="flex:1;color:#9aa6b4;font-size:12px">— останалото</span><span class="pc" data-p="free"></span></div><div class="vwarn"></div><div class="vfull"></div></div>`;
  document.body.appendChild(el);
  const split = { res: 20, inv: 50, ...(o.split || {}) };
  const money = () => Math.max(0, o.money ? o.money() : 0);
  const parts = () => { const m = money(), r = Math.max(0, Math.min(100, split.res)), i = Math.max(0, Math.min(100 - r, split.inv)); return { res: m * r / 100, inv: m * i / 100, free: m * (100 - r - i) / 100, r, i, f: 100 - r - i }; };
  const inRes = el.querySelector('[data-s="res"]'), inInv = el.querySelector('[data-s="inv"]');
  inRes.value = split.res; inInv.value = split.inv;
  const onIn = which => { split.res = +inRes.value; split.inv = +inInv.value; if (split.res + split.inv > 100) { if (which === 'res') split.inv = 100 - split.res; else split.res = 100 - split.inv; inRes.value = split.res; inInv.value = split.inv; } o.onSplit && o.onSplit({ ...split }); paint(); };
  inRes.oninput = () => onIn('res'); inInv.oninput = () => onIn('inv');
  el.querySelector('.back').onclick = () => o.onBack && o.onBack();
  function paint() {
    const P = parts(), m = money(), mc = o.monthCost ? o.monthCost() : 0;
    el.querySelector('.vtot').textContent = `🏦 Трезорът: ${B(m)}`;
    el.querySelector('[data-p="res"]').textContent = `${P.r}% · ${B(P.res)}`; el.querySelector('[data-p="inv"]').textContent = `${P.i}% · ${B(P.inv)}`; el.querySelector('[data-p="free"]').textContent = `${P.f}% · ${B(P.free)}`;
    for (const z of zones) el.querySelector(`[data-z="${z.Z.k}"] .v`).textContent = B(P[z.Z.k]);
    el.querySelector('.vwarn').textContent = mc && P.res < mc ? `⚠️ Борис: резервът (${B(P.res)}) е под месечните разходи (${B(mc)}) — вдигни го.` : '';
    el.querySelector('.vfull').textContent = m > VAULT_CAP ? `🏦 Трезорът е пълен (${B(VAULT_CAP)}) — надгради го, за да се вижда всичко.` : '';
    // целите: колко места да светят — общото запълване по скалата, разпределено по дяловете
    const tot = fillOf(m) * zones.length * (CASH_PER + GOLD_PER);
    for (const z of zones) { const u = m > 0 ? tot * P[z.Z.k] / m : 0, cashU = Math.min(CASH_PER, u), goldU = Math.min(GOLD_PER, Math.max(0, u - cashU)); z.ct = Math.round(cashU); z.gt = Math.round(goldU); }   // първо пачките, златото — когато рафтовете с пари са пълни
  }
  paint();
  const v3 = new THREE.Vector3();
  function placeCards() { for (const z of zones) { v3.set(z.x, 2.05, zs + 0.3).project(cam); const c = el.querySelector(`[data-z="${z.Z.k}"]`); c.style.left = `${(v3.x + 1) / 2 * innerWidth}px`; c.style.top = `${(1 - v3.y) / 2 * innerHeight}px`; } }
  const onMove = e => { mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); };
  addEventListener('pointermove', onMove);
  let t = 0, last = 0;
  return {
    scene, cam,
    paint, get split() { return { ...split }; },
    update(dt) {
      t += dt; if (t - last > 0.5) { last = t; paint(); }   // парите се менят докато сме вътре — стековете следват
      for (const z of zones) {   // анимацията: по няколко пачки/кюлчета на кадър към целта
        const st = d => Math.min(Math.abs(d), Math.max(2, Math.ceil(Math.abs(d) * 0.08)));   // ~1 s до целта при всякакъв FPS
        if (z.cn !== z.ct) { z.cn += Math.sign(z.ct - z.cn) * st(z.ct - z.cn); z.cash.count = z.cn; }
        if (z.gn !== z.gt) { z.gn += Math.sign(z.gt - z.gn) * st(z.gt - z.gn); z.gold.count = z.gn; }
      }
      const night = o.night ? o.night() : 0; goldM.emissiveIntensity = 0.04 + night * (0.22 + 0.06 * Math.sin(t * 1.3));   // нощем златото леко свети
      cam.position.x += (mouse.x * 0.35 - cam.position.x) * Math.min(1, dt * 2); cam.position.y += (1.55 - mouse.y * 0.18 - cam.position.y) * Math.min(1, dt * 2); cam.lookAt(look);
      placeCards();
    },
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); },
    show(on) { el.style.display = on ? '' : 'none'; },
    dispose() { removeEventListener('pointermove', onMove); el.remove(); for (const z of zones) { z.cash.dispose(); z.gold.dispose(); } for (const x of own) x.dispose && x.dispose(); },
  };
}
