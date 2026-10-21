// highways.js — Фаза 4: строеж на магистрали (държавни поръчки).
// Данни за истинските български магистрали + 3D модел на участък, който се „строи“ по етапи.
// game.js ползва: HIGHWAYS, HW_STAGES, segmentQuote(km), HW_MODELS, buildHighwayView(A, opts).
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { loadSigns, sign } from './roadsigns.js';
import { NF_MATS } from './nightfloors.js';   // daynight.js пали тези материали вечер (emissiveIntensity = нощта)
import { makeWater } from './water.js';

// Истинските магистрали, разделени на участъци между градовете от картата
export const HIGHWAYS = [
  { id: 'A1', nm: 'Тракия', color: '#1e6fd9', segs: [['sofia', 'pazardzhik'], ['pazardzhik', 'plovdiv'], ['plovdiv', 'stz'], ['stz', 'burgas']] },
  { id: 'A2', nm: 'Хемус', color: '#1e6fd9', segs: [['sofia', 'pleven'], ['pleven', 'vt'], ['vt', 'shumen'], ['shumen', 'varna']] },
  { id: 'A3', nm: 'Струма', color: '#1e6fd9', segs: [['sofia', 'pernik'], ['pernik', 'blg']] },
  { id: 'A4', nm: 'Марица', color: '#1e6fd9', segs: [['stz', 'haskovo']] },
  { id: 'A5', nm: 'Черно море', color: '#1e6fd9', segs: [['varna', 'burgas']] },
  { id: 'A7', nm: 'Русе — В. Търново', color: '#1e6fd9', segs: [['ruse', 'vt']] },
  // международни коридори (до съседните държави)
  { id: 'E80', nm: 'Тракия — Истанбул', color: '#1e6fd9', intl: true, segs: [['haskovo', 'edirne'], ['edirne', 'istanbul']] },
  { id: 'E75', nm: 'Коридор 10 — Белград', color: '#1e6fd9', intl: true, segs: [['sofia', 'nis'], ['nis', 'belgrade']] },
  { id: 'E79', nm: 'Струма — Солун — Атина', color: '#1e6fd9', intl: true, segs: [['blg', 'thessaloniki'], ['thessaloniki', 'athens']] },
  { id: 'E85', nm: 'Дунав мост — Букурещ', color: '#1e6fd9', intl: true, segs: [['ruse', 'bucharest']] },
  { id: 'E87', nm: 'Черноморски — Констанца', color: '#1e6fd9', intl: true, segs: [['varna', 'constanta']] },
  { id: 'E871', nm: 'София — Скопие', color: '#1e6fd9', intl: true, segs: [['sofia', 'skopje']] },
];
export const segId = (hw, i) => `${hw.id}-${i}`;

// Етапи на строежа на участък. need: техника, която отива на трасето (не е в града, докато трае).
export const HW_STAGES = [
  { nm: 'Земни работи', ico: '🚜', need: { bulldozer: 1, grader: 1, truck: 2, crew: 1 } },
  { nm: 'Пътна основа', ico: '🪨', need: { grader: 1, roller: 1, truck: 2, crew: 1 } },
  { nm: 'Асфалт', ico: '🛣️', need: { paver: 1, roller: 2, truck: 1, crew: 2 } },
  { nm: 'Мантинели и табели', ico: '🚧', need: { marker: 1, crane: 1, crew: 2 } },
];
// старите нужди (без пътна техника) — за участъци, започнати преди нея, за да не блокират старите записи
export const HW_NEED_OLD = [{ loader: 2, truck: 2, crew: 1 }, { truck: 2, tractor: 1, crew: 1 }, { truck: 1, tractor: 1, crew: 2 }, { crew: 2, crane: 1 }];
// цялата пътна техника, нужна за един участък (максимумът по етапите)
export const HW_FLEET = HW_STAGES.reduce((o, st) => { for (const [k, n] of Object.entries(st.need)) o[k] = Math.max(o[k] || 0, n); return o; }, {});
export const HW_REP = 2;              // нужна репутация за държавни поръчки
export const TOLL_PER_KM_DAY = 6;     // основна тол такса, € на км на ден (расте с дължината на магистралата — виж hwToll в game.js)

// Цена, срок и материали за участък с дължина km (държавата плаща reward при завършване)
export function segmentQuote(km) {
  const reward = Math.round((km * 5200 + 60000) / 5000) * 5000;
  const days = Math.max(6, Math.round(km / 9));
  // материалите по етапи (ще се купуват през economy.js)
  const mats = [
    { gravel: Math.round(km * 40), sand: Math.round(km * 30) },
    { gravel: Math.round(km * 55), concrete: Math.round(km * 8) },
    { concrete: Math.round(km * 10), sand: Math.round(km * 20) },
    { steel: Math.round(km * 1.2), concrete: Math.round(km * 3) },
  ];
  return { reward, days, mats, toll: Math.round(km * TOLL_PER_KM_DAY) };
}

// Модели, които трябва да са заредени в A (от assets/highway/ и assets/vehicles/)
export const HW_MODELS = {
  highway: ['road-straight-barrier', 'light-curved-double', 'sign-highway-wide', 'bridge-pillar-wide', 'road-bridge', 'construction-barrier', 'construction-light'],
};

// ---------------------------------------------------------------- машини за асфалта (процедурни)
const YEL = new THREE.MeshStandardMaterial({ color: 0xffb300, roughness: 0.55 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.7 });
const box = (w, h, d, m, x, y, z, g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
// кабина без стени: 4 стойки + покрив (ROPS)
function canopy(g, x, y, z, w, d, h) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.1, h, 0.1, DARK, x + sx * w / 2, y + h / 2, z + sz * d / 2, g);
  box(w + 0.3, 0.12, d + 0.3, YEL, x, y + h, z, g);
}
// асфалтополагач: бункер отпред, вериги, платформа на оператора, широка плоча (screed) отзад през цялото платно
function makePaver(laneW) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) box(0.6, 0.8, 4.2, DARK, sx * 1.25, 0.4, 0.4, g);                    // вериги
  box(2.8, 1.2, 3.4, YEL, 0, 1.3, 0.3, g);                                                       // тяло
  // бункер за асфалт (отворен отгоре, с наклонени крила) — отпред
  box(3.2, 0.15, 1.9, YEL, 0, 1.05, 2.9, g);
  for (const sx of [-1, 1]) { const w = box(0.12, 1.1, 1.9, YEL, sx * 1.55, 1.6, 2.9, g); w.rotation.z = sx * 0.35; }
  box(3.2, 0.9, 0.12, YEL, 0, 1.5, 3.85, g);
  const load = box(2.6, 0.5, 1.6, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }), 0, 1.35, 2.9, g);   // горещ асфалт в бункера
  load.castShadow = false;
  // платформа и покрив на оператора, конзола и седалка
  box(2.6, 0.12, 1.4, DARK, 0, 1.95, -0.7, g);
  box(0.5, 0.6, 0.5, DARK, -0.6, 2.3, -0.8, g);
  box(0.8, 0.5, 0.3, DARK, 0.4, 2.25, -0.3, g);
  canopy(g, 0, 2.0, -0.7, 2.4, 1.6, 1.6);
  // ауспух и маяк
  box(0.12, 1.2, 0.12, DARK, 1.0, 2.5, 0.9, g);
  const beacon = box(0.22, 0.2, 0.22, new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff6a00, emissiveIntensity: 1 }), 0, 3.75, -0.7, g);
  beacon.castShadow = false;
  // широка изглаждаща плоча отзад — покрива цялото платно
  box(laneW - 0.4, 0.45, 0.9, YEL, 0, 0.35, -1.9, g);
  box(laneW - 0.4, 0.1, 1.0, STEEL, 0, 0.08, -1.95, g);
  for (const sx of [-1, 1]) box(0.12, 0.9, 1.0, YEL, sx * (laneW / 2 - 0.2), 0.5, -1.9, g);    // странични щитове
  return g;
}
// тандемен валяк: два стоманени барабана, жълто шаси, ROPS с покрив
function makeRoller() {
  const g = new THREE.Group(), drums = [];
  for (const sz of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.9, 24), STEEL);
    d.rotation.z = Math.PI / 2; d.position.set(0, 0.75, sz * 1.35); d.castShadow = true; g.add(d); drums.push(d);
    box(2.1, 0.5, 0.25, YEL, 0, 1.25, sz * 1.35, g);                                              // капак над барабана
  }
  box(1.6, 0.9, 1.6, YEL, 0, 1.55, 0, g);                                                          // шаси/двигател
  box(1.2, 0.12, 1.1, DARK, 0, 2.05, 0, g);
  box(0.5, 0.5, 0.45, DARK, 0, 2.35, 0.1, g);
  canopy(g, 0, 2.05, 0, 1.5, 1.3, 1.5);
  g.userData.drums = drums;
  return g;
}

// ---------------------------------------------------------------- 3D изглед на участък
// Права отсечка с дължина LEN по оста Z: насип → чакъл → асфалт → оборудване. По средата — мост над река.
const CW = 9, MED = 3;     // ширина на платно и на разделителя (м)
const AB_CW = 14.4, AB_MED = 4;   // аутобан: 4 ленти × 3,6 м на посока, разделител 4 м
// асфалтът на аутобана: платно 14,4 × 10 м с бели ръбове и 3 прекъснати линии между лентите
let abLaneM = null;
const abLaneMat = () => abLaneM || (abLaneM = (() => {
  const c = document.createElement('canvas'); c.width = 288; c.height = 200; const x = c.getContext('2d');
  x.fillStyle = '#3a3c40'; x.fillRect(0, 0, 288, 200);
  for (let k = 0; k < 900; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.05)`; x.fillRect(Math.random() * 288, Math.random() * 200, 2, 2); }
  x.fillStyle = '#f2f2f2'; x.fillRect(4, 0, 5, 200); x.fillRect(279, 0, 5, 200);   // ръбовете (плътни)
  for (let l = 1; l < 4; l++) for (let y = 0; y < 200; y += 100) x.fillRect(l * 72 - 2, y + 20, 4, 60);   // между лентите (прекъснати)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
})());
const abRailMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.4, metalness: 0.6 });
// синя табела (аутобан) с текст
function abBoard(lines, w = 12, h = 3.6) {
  const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * h / w); const x = c.getContext('2d');
  x.fillStyle = '#1d4fa8'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(10, 10, c.width - 20, c.height - 20);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((ln, i) => { x.font = `bold ${i ? 46 : 64}px system-ui`; x.fillText(ln, c.width / 2, c.height * (lines.length === 1 ? 0.5 : 0.3 + i * 0.42), c.width - 40); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: t });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.4 })); back.rotation.y = Math.PI; back.position.z = -0.02;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.add(back); return o;
}
// пътен възел встрани от града (−x): друг аутобан тръгва настрани, с две криви отбивки (изход/вход) и портални табели преди него
function abExit(g, gear, { W, cw, med, z0, LEN, H, zE, name, exitTo }) {
  const y = H() + 0.03, SW = cw * 2 + med, R = 38, x0 = -W / 2, STUB = 220, add = (o, z) => { o.userData.z = z; g.add(o); gear.push(o); };
  // другият аутобан: две платна по −x
  for (let d = 0; d < STUB; d += 10) for (const sd of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(cw, 10), abLaneMat()); a.rotation.x = -Math.PI / 2; a.rotation.z = Math.PI / 2 + (sd > 0 ? Math.PI : 0); a.position.set(x0 - R * 0.6 - d - 5, y - 0.005, zE + sd * (cw + med) / 2); add(a, zE);
  }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(STUB, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 })); m.position.set(x0 - R * 0.6 - STUB / 2, y + 0.45, zE); add(m, zE); }
  // криви отбивки (четвърт кръг, 7 м широки): от външния ръб на платното към другия аутобан
  const rampM = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.9 });
  for (const sd of [-1, 1]) {
    const cz = zE + sd * (SW / 2 + R), rg = new THREE.RingGeometry(R - 3.5, R + 3.5, 28, 1, sd < 0 ? -Math.PI / 2 : 0, Math.PI / 2);
    const r = new THREE.Mesh(rg, rampM); r.rotation.x = -Math.PI / 2; r.position.set(x0 - R, y - 0.01, cz); add(r, cz);
    const edge = new THREE.Mesh(new THREE.RingGeometry(R + 3.3, R + 3.6, 28, 1, sd < 0 ? -Math.PI / 2 : 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
    edge.rotation.x = -Math.PI / 2; edge.position.set(x0 - R, y + 0.005, cz); add(edge, cz);
  }
  // портални табели над платното откъм възела: 1000 м и при самия изход; отстрани — „Изход“
  const gantry = (z, lines) => {
    const post = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.5, roughness: 0.5 });
    for (const xx of [-W / 2 - 1, -med / 2 - 0.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8.5, 0.5), post); p.position.set(xx, y + 4.25, z); add(p, z); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(cw + 2, 0.5, 0.5), post); beam.position.set(-(cw + med) / 2, y + 8.3, z); add(beam, z);
    const b = abBoard(lines, cw - 1, 3.2); b.rotation.y = Math.PI; b.position.set(-(cw + med) / 2, y + 6.4, z - 0.3); add(b, z);   // към идващите коли (карат към +z)
  };
  gantry(zE - SW / 2 - R - 110, [`${name} ⬋ ${exitTo || 'Възел'}`, 'Изход 1000 м']);
  gantry(zE - SW / 2 - R - 20, [`⬋ ${name}`, exitTo || 'Изход']);
  const ex = abBoard(['⬋ Изход'], 4, 1.4); ex.position.set(x0 - 3, y + 2.6, zE - SW / 2 - R + 4); ex.rotation.y = Math.PI; add(ex, zE);
  const exP = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a9096 })); exP.position.set(x0 - 3, y + 1.2, zE - SW / 2 - R + 4); add(exP, zE);
}
const RIVER_W = 26;
// крайпътен комплекс (Лабораторията → hw-service): откъм −x (посоката към +z) — забавителна лента, отбивка към паркинг
// с бензиностанция (истинските модели на играта), тревен остров и обратно включване. Връща пътя за колите (hwtraffic.js):
// { z0, z1, zs, xE, lotX } — в координатите на изгледа (z по оста, x напреки)
const SVC_L = 160, SVC_GAS = ['gas-big', 'gas-modern', 'gas-green', 'gas-lowpoly'];
function serviceArea(g, gear, A, { W, H, zs }) {
  const y = H() + 0.04, xE = -W / 2, z0 = zs - SVC_L / 2, z1 = zs + SVC_L / 2, lotX = xE - 20, add = (o, z = zs) => { o.userData.z = z; g.add(o); gear.push(o); return o; };
  const poly = (pts, mat, yy) => { const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), m = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat); m.rotation.x = -Math.PI / 2; m.position.y = yy; m.receiveShadow = true; return m; };
  // асфалтът: лента, отбивка, паркинг, отбивка, лента — един многоъгълник; островът е отгоре
  add(poly([[xE, z0], [xE - 4.5, z0 + 32], [xE - 16, z0 + 52], [xE - 54, z0 + 52], [xE - 54, z1 - 52], [xE - 16, z1 - 52], [xE - 4.5, z1 - 32], [xE, z1]], new THREE.MeshStandardMaterial({ color: 0x6a6d72, roughness: 0.9 }), y));   // като плочките на магистралата
  add(poly([[xE - 5.6, z0 + 38], [xE - 14, z0 + 54], [xE - 14, z1 - 54], [xE - 5.6, z1 - 38]], new THREE.MeshStandardMaterial({ color: 0x6f9a4e, roughness: 1 }), y + 0.04));
  add(poly([[xE - 0.2, z0 + 6], [xE - 0.5, z0 + 30], [xE - 0.8, z0 + 30]], new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }), y + 0.02));   // клинът на отбивката
  // местата на паркинга: бели черти покрай далечния ръб
  const lineM = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  for (let z = z0 + 56; z <= z1 - 56; z += 4) { const l = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.15), lineM); l.rotation.x = -Math.PI / 2; l.position.set(xE - 51, y + 0.02, z); add(l); }
  // бензиностанцията: първият одобрен модел, ~26 м, с навеса към паркинга
  const gk = SVC_GAS.find(n => A[n]);
  if (gk) {
    const o = clone(A, gk, 1); o.updateMatrixWorld(true); const sz = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
    o.scale.setScalar(26 / Math.max(sz.x, sz.z)); o.rotation.y = -Math.PI / 2; o.position.set(xE - 38, y - 0.04, zs); add(o);
  }
  // пилон с цените и табела 500 м преди отбивката
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 400; const x = cv.getContext('2d');
  x.fillStyle = '#123'; x.fillRect(0, 0, 160, 400); x.fillStyle = '#f5b400'; x.fillRect(0, 0, 160, 110); x.fillStyle = '#123'; x.font = 'bold 74px system-ui'; x.textAlign = 'center'; x.fillText('⛽', 80, 82);
  x.fillStyle = '#fff'; x.font = 'bold 30px system-ui'; [['A95', '2.65'], ['A100', '2.95'], ['Дизел', '2.55'], ['LPG', '1.29']].forEach(([a, b], k) => { x.textAlign = 'left'; x.fillText(a, 10, 160 + k * 66); x.textAlign = 'right'; x.fillStyle = '#ffd54a'; x.fillText(b, 152, 160 + k * 66); x.fillStyle = '#fff'; });
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const py = new THREE.Mesh(new THREE.BoxGeometry(4, 10, 0.6), [0, 0, 0, 0, 1, 1].map(k => k ? new THREE.MeshBasicMaterial({ map: tx }) : new THREE.MeshStandardMaterial({ color: 0x223344 })));
  py.position.set(xE - 9, y + 5, z0 + 26); py.castShadow = true; add(py, z0 + 26);
  const b = abBoard(['⛽ 🍴 P', '500 м'], 5, 2.6); b.rotation.y = Math.PI; b.position.set(xE - 2.5, y + 3.4, z0 - 200); add(b, z0 - 200);
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.4, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a9096 })); bp.position.set(xE - 2.5, y + 1.7, z0 - 200); add(bp, z0 - 200);
  // нощем: две лампи над паркинга
  for (const z of [zs - 22, zs + 22]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9, 0.3), new THREE.MeshStandardMaterial({ color: 0x777777 })); p.position.set(lotX + 4, y + 4.5, z); add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.8), hwLampMat()); h.position.set(lotX + 3, y + 9, z); add(h);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), hwPoolMat()); pl.rotation.x = -Math.PI / 2; pl.position.set(lotX + 2, y + 0.08, z); pl.renderOrder = 2; add(pl);
  }
  return { z0, z1, zs, xE, lotX };
}

function clone(A, n, s) {
  const o = A[n].scene.clone(true);
  o.scale.setScalar(s);
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}
// прави нещо видимо само до текущия фронт на строежа
function reveal(list, front) { for (const o of list) o.visible = o.userData.z <= front; }

// opts: { len = 240, river = true, ground = true, title, service } — без река/терен може да се сложи покрай град; service — z на крайпътния комплекс
// изходи към града (Лабораторията → hw-ramps): пътят от града минава ПОД магистралата (тя се вдига като над релсите — opts.over);
// откъм града (посоката −z) — изход и вход направо към южната улица на града (Т-кръстовища); от далечната страна (посоката +z) —
// полу-диамант: изход и вход към Т-кръстовище на пътя под магистралата. Всичко е на нивото на земята (не се вдига с надлеза).
// { cx — къде е пътят от града (z по оста), xs — оста на южната улица на града (x напреки, откъм +x), xr — дясната лента } →
// { group, paths: { nearOff, nearOn, farOff, farOn } } — пътищата за колите (hwtraffic.js) в координатите на изгледа [x, z]
const rSmooth = P => { const out = []; for (let i = 0; i < P.length - 1; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2)); for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); } } out.push(P[P.length - 1]); return out; };
// пътищата на рампите (без three — и за теста): { paths, ramps: [pts…] (асфалтът на рампите), xT }
export function rampPaths(W, cx, xs, xr) {
  const xe = W / 2, xT = -(xe + 30), lane = 1.75, ramps = [], ramp = P => { const pts = rSmooth(P); ramps.push(pts); return pts; };
  const paths = {
    // откъм града: изход от посоката −z → Т с южната улица (завой наляво към западната лента на улицата)
    nearOff: ramp([[xr, cx + 330], [xe + 1.8, cx + 272], [xe + 5.5, cx + 235], [xe + 9, cx + 190], [xs - 9, cx + 120], [xs - 4.5, cx + 95]]).concat(rSmooth([[xs - 4.5, cx + 95], [xs, cx + 91], [xs + lane, cx + 84], [xs + lane, cx + 40]]).slice(1)),
    // вход от южната улица (западната лента) → посоката −z
    nearOn: rSmooth([[xs + lane, cx - 30], [xs + lane, cx - 52], [xs, cx - 58]]).concat(ramp([[xs - 4.5, cx - 62], [xs - 9, cx - 82], [xe + 9, cx - 150], [xe + 5.5, cx - 195], [xe + 1.8, cx - 232], [xr, cx - 290]]).slice(1)),
    // далечната страна: изход от посоката +z → Т-то → наляво под магистралата към града
    farOff: ramp([[-xr, cx - 330], [-(xe + 1.8), cx - 272], [-(xe + 5.5), cx - 235], [-(xe + 12), cx - 170], [xT - 6, cx - 70], [xT - 6, cx - 12]]).concat(rSmooth([[xT - 6, cx - 12], [xT - 3, cx - 3], [xT + 4, cx + lane], [xs - 6, cx + lane], [xs + lane, cx + 6], [xs + lane, cx + 40]]).slice(1)),
    // от града под магистралата → Т-то → наляво по входа → посоката +z
    farOn: rSmooth([[xs + lane, cx - 40], [xs + lane, cx - 8], [xs - 6, cx - lane], [xT + 4, cx - lane], [xT - 3, cx + 3], [xT - 6, cx + 12]]).concat(ramp([[xT - 6, cx + 12], [xT - 6, cx + 70], [-(xe + 12), cx + 170], [-(xe + 5.5), cx + 235], [-(xe + 1.8), cx + 272], [-xr, cx + 330]]).slice(1)),
  };
  return { paths, ramps, xT, xe };
}
// височината на рампа в точка с напречно x: върху насипа (до W/2 + 3) — на нивото на платното, после слиза плавно до земята (6 м)
export const rampY = (xe, vx, y0 = 0.25, top = 0.95) => { const t = Math.max(0, Math.min(1, (Math.abs(vx) - xe - 3) / 6)); return top - (top - y0) * t * t * (3 - 2 * t); };
function cityRamps(W, cx, xs, xr, y0 = 0.25) {   // над терена на града (иначе тревата го покрива)
  const g = new THREE.Group(), xe = W / 2, asph = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.95, side: THREE.DoubleSide }), paint = new THREE.MeshBasicMaterial({ color: 0xf0f0f0, side: THREE.DoubleSide });
  g.userData.keep = true;   /* perf-cliff (citycull.js) не ги слива — видимостта им следва етапа на магистралата */
  const band = (pts, w, y, mat, hy = false) => { const pos = [], idx = []; pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, yy = hy ? rampY(xe, p[0], y) + (y - y0) : y; pos.push(p[0] + nx * w / 2, yy, p[1] + nz * w / 2, p[0] - nx * w / 2, yy, p[1] - nz * w / 2); if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m; };
  const off = (pts, d) => pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * d, p[1] + dx / l * d]; });
  const R = rampPaths(W, cx, xs, xr), xT = R.xT;
  for (const pts of R.ramps) { band(pts, 5, y0, asph, true); for (const d of [2.25, -2.25]) band(off(pts, d), 0.15, y0 + 0.02, paint, true); }   /* от насипа плавно надолу */
  // пътят от града под магистралата до Т-то от далечната страна (две ленти, прекъсната ос) и площадката на Т-то
  { const pts = rSmooth([[xs - 4, cx], [xT - 6, cx]]); band(pts, 7.5, y0 - 0.01, asph); for (let x = xs - 6; x > xT; x -= 6) band([[x, cx], [x - 3, cx]], 0.15, y0 + 0.02, paint); band([[xT - 6, cx - 9], [xT - 6, cx + 9]], 7.5, y0 - 0.005, asph); }
  // табели „Изход“ преди отбивките
  for (const [x, z, ry] of [[xe + 3, cx + 380, 0], [-(xe + 3), cx - 380, Math.PI]]) { const b = abBoard(['↗ ИЗХОД', 'ГРАД'], 4.5, 2.4); b.rotation.y = ry; b.position.set(x, 3.6, z); g.add(b); const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x8a9096 })); p.position.set(x, 1.8, z); g.add(p); }
  R.paths.xe = xe; return { group: g, paths: R.paths };
}

// надлез над релсите в града (opts.over = [{ c, w }] — център и ширина по оста на магистралата): платното се качва по рампи
// до OVER_H, минава върху колони и плоча над коловозите и слиза; всичко с userData.z се вдига с overLift(over, z)
export const OVER_H = 7.5, OVER_RAMP = 80;
export function overLift(over, z) {
  let h = 0;
  for (const o of over || []) { const d = Math.abs(z - o.c) - o.w / 2; h = Math.max(h, d <= 0 ? OVER_H : d < OVER_RAMP ? OVER_H * (1 - d / OVER_RAMP) * (1 - d / OVER_RAMP) * (3 - 2 * (1 - d / OVER_RAMP)) : 0); }
  return h;
}
// лампите на магистралата: глава (свети) и петно на асфалта (адитивно, денем черно — не се вижда); общи материали за всички участъци
let HW_LAMP = null, HW_POOL = null;
function hwLampMat() { if (!HW_LAMP) { HW_LAMP = new THREE.MeshStandardMaterial({ color: 0x3a3a30, emissive: 0xffe0a0, emissiveIntensity: 0 }); NF_MATS.add(HW_LAMP); HW_LAMP.userData.nfK = 2.4; } return HW_LAMP; }
function hwPoolMat() {
  if (!HW_POOL) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgb(255,225,170)'); gr.addColorStop(0.3, 'rgb(120,104,78)'); gr.addColorStop(0.65, 'rgb(30,26,19)'); gr.addColorStop(1, 'rgb(0,0,0)'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);   // адитивно — важи само цветът: избледнява към черно
    HW_POOL = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd8a0, emissiveMap: new THREE.CanvasTexture(c), emissiveIntensity: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    NF_MATS.add(HW_POOL); HW_POOL.userData.nfK = 0.8;
  }
  return HW_POOL;
}
export function buildHighwayView(A, opts = {}) {
  const g = new THREE.Group();
  const LEN = opts.len || 240, z0 = -LEN / 2, RIVER_Z = opts.river === false ? 1e9 : 20;
  if (opts.ground !== false) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x8fb36a, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; g.add(ground);
  }
  if (opts.river !== false) {
    const water = makeWater({ color: 0x3f86c9, repeat: 24 }); g.userData.water = water;
    const river = new THREE.Mesh(new THREE.PlaneGeometry(600, RIVER_W), water.material);
    river.rotation.x = -Math.PI / 2; river.position.set(0, 0.01, RIVER_Z); g.add(river);
  }
  const onBridge = z => Math.abs(z - RIVER_Z) < RIVER_W / 2 + 6;
  const OV = opts.over || [], onOver = z => OV.some(o => Math.abs(z - o.c) < o.w / 2 + 4);   // над коловозите — плоча на колони вместо насип
  const H = () => 0.9;     // платното е на една височина, мостът е продължение на насипа

  // opts.ab — аутобан: по 4 ленти във всяка посока (3,6 м), по-широк разделител, асфалт с маркировка вместо плочките на магистралата
  const AB = !!opts.ab, cw = AB ? AB_CW : CW, med = AB ? AB_MED : MED;
  const W = cw * 2 + med;
  // 1) насип (пръст) — сегменти по 10 м
  const earth = [], gravel = [], asphalt = [], gear = [];
  const earthMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x9c968c, roughness: 1 });
  for (let z = z0; z < z0 + LEN; z += 10) {
    const zc = z + 5;
    if (onBridge(zc) || onOver(zc)) continue;
    const e = new THREE.Mesh(new THREE.BoxGeometry(W + 6, 0.6, 10), earthMat);
    e.position.set(0, 0.3, zc); e.receiveShadow = true; e.userData.z = zc; g.add(e); earth.push(e);
    const gr = new THREE.Mesh(new THREE.BoxGeometry(W + 1, 0.3, 10), gravelMat);
    gr.position.set(0, 0.75, zc); gr.receiveShadow = true; gr.userData.z = zc; g.add(gr); gravel.push(gr);
  }
  // мост: колони + плоча (колоните се появяват в етап 1, плочата в етап 2)
  for (let z = RIVER_Z - RIVER_W / 2 - 4; z <= RIVER_Z + RIVER_W / 2 + 4; z += 9) {
    for (const x of [-W / 2 + 2, 0, W / 2 - 2]) {
      const p = clone(A, 'bridge-pillar-wide', 3); p.scale.y = 1.6; p.position.set(x, 0, z); p.userData.z = z; g.add(p); gravel.push(p);
    }
  }
  // надлез: колони по три в ред и бетонна плоча под двете платна (с етапа на насипа/чакъла)
  for (const o of OV) {
    for (let z = o.c - o.w / 2 - 4; z <= o.c + o.w / 2 + 4.01; z += (o.w + 8) / 3) for (const x of [-W / 2 + 2, 0, W / 2 - 2]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, OVER_H + 0.3, 1.4), new THREE.MeshStandardMaterial({ color: 0xbdbab2, roughness: 0.9 })); p.position.set(x, (OVER_H + 0.3) / 2 - OVER_H, z); p.castShadow = true; p.userData.z = z; p.userData.over = 1; g.add(p); earth.push(p);
    }
    for (let z = o.c - o.w / 2 - 4; z < o.c + o.w / 2 + 4; z += 10) { const zc = Math.min(z + 5, o.c + o.w / 2 + 4 - 0.01), d = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 1, 10), new THREE.MeshStandardMaterial({ color: 0xa8a59d, roughness: 0.9 })); d.position.set(0, 0.4, zc); d.castShadow = d.receiveShadow = true; d.userData.z = zc; g.add(d); gravel.push(d); }
  }
  // 2) асфалт: две платна от плочки road-straight-barrier (по 9 м) — на моста отгоре
  if (AB) for (let z = z0; z < z0 + LEN; z += 10) {   // аутобан: две широки платна с 4 ленти и мантинели отстрани
    const zc = z + 5;
    for (const sd of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(cw, 10), abLaneMat()); a.rotation.x = -Math.PI / 2; if (sd > 0) a.rotation.z = Math.PI; a.position.set(sd * (cw + med) / 2, H(zc) + 0.03, zc); a.receiveShadow = true; a.userData.z = zc; g.add(a); asphalt.push(a);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 10), abRailMat); rail.position.set(sd * (W / 2 + 0.1), H(zc) + 0.4, zc); rail.userData.z = zc; g.add(rail); asphalt.push(rail);
    }
  }
  for (let z = z0; z < (AB ? z0 : z0 + LEN); z += CW) {
    const zc = z + CW / 2;
    for (const x of [-(CW + MED) / 2, (CW + MED) / 2]) {
      const t = clone(A, 'road-straight-barrier', CW);
      t.position.set(x, H(zc) + 0.02, zc);
      if (onBridge(zc)) { const deck = new THREE.Mesh(new THREE.BoxGeometry(CW, 0.8, CW), gravelMat); deck.position.set(x, H(zc) - 0.4, zc); deck.castShadow = true; deck.userData.z = zc; g.add(deck); asphalt.push(deck); }
      t.userData.z = zc; g.add(t); asphalt.push(t);
    }
  }
  // 3) оборудване: бетонен разделител, двойно осветление, сини табели
  const medMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.8 });
  for (let z = z0; z < z0 + LEN; z += 10) {
    const zc = z + 5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 10), medMat);
    m.position.set(0, H(zc) + 0.45, zc); m.castShadow = true; m.userData.z = zc; g.add(m); gear.push(m);
  }
  for (let z = z0 + 10; z < z0 + LEN; z += 30) {
    const l = clone(A, 'light-curved-double', 14); l.position.set(0, H(z) + 0.9, z); l.rotation.y = Math.PI / 2; l.userData.z = z; g.add(l); gear.push(l);
    // нощем: светещите глави на двете рамена и топли петна светлина по платната
    l.updateMatrixWorld(true); const lb = new THREE.Box3().setFromObject(l);
    for (const sd of [-1, 1]) {
      const hx = sd < 0 ? lb.min.x + 0.7 : lb.max.x - 0.7, head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 0.6), hwLampMat()); head.position.set(hx, lb.max.y - 0.35, z); head.userData.z = z; g.add(head); gear.push(head);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(14, 18), hwPoolMat()); pl.rotation.x = -Math.PI / 2; pl.position.set(sd * (cw + med) / 2, H(z) + 0.07, z); pl.userData.z = z; pl.renderOrder = 2; g.add(pl); gear.push(pl);
    }
  }
  const service = opts.service != null ? serviceArea(g, gear, A, { W, H, zs: opts.service }) : null;
  const ramps = opts.ramps ? cityRamps(W, opts.ramps.cx, opts.ramps.xs, AB ? med / 2 + cw * 7 / 8 : med / 2 + cw * 3 / 4) : null; if (ramps) g.add(ramps.group);   // изходите към града (hw-ramps)
  if (AB && opts.exit !== false) abExit(g, gear, { W, cw, med, z0, LEN, H, zE: opts.exitZ ?? z0 + LEN * 0.22, name: opts.abName || 'A', exitTo: opts.exitTo || '' });
  for (const z of [z0 + 30, z0 + LEN - 40]) {
    const sgn = clone(A, 'sign-highway-wide', 11); sgn.position.set(W / 2 + 1.5, 0, z); sgn.rotation.y = Math.PI / 2; sgn.userData.z = z; g.add(sgn); gear.push(sgn);
  }
  if (opts.title) {   // табела с името на магистралата
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const x = c.getContext('2d'); x.fillStyle = '#1e5fbf'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 140);
    x.fillStyle = '#fff'; x.font = 'bold 60px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(opts.title, 256, 82, 470);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshBasicMaterial({ map: t }));
    board.position.set(0, 8.5, z0 + LEN - 15); board.rotation.y = Math.PI; board.userData.z = z0 + LEN - 15; g.add(board); gear.push(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    post.position.set(0, 10, z0 + LEN - 15); post.userData.z = z0 + LEN - 15; g.add(post); gear.push(post);
  }
  // надлезът: всичко по оста се вдига по профила. Плочите (насип, чакъл, асфалт, разделител) се огъват по рампата връх по връх —
  // гладко, без стъпала (насипът — само горната страна, основата остава на земята); моделите (лампи, табели) — само се вдигат
  if (OV.length) {
    const v = new THREE.Vector3();
    const bend = (o, topOnly) => {
      o.updateMatrix(); const m = o.matrix, inv = m.clone().invert(), geo = o.geometry.clone(), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); if (!topOnly || v.y > 0.35) v.y += overLift(OV, v.z); v.applyMatrix4(inv); pos.setXYZ(i, v.x, v.y, v.z); }
      geo.computeVertexNormals(); geo.computeBoundingSphere(); o.geometry = geo;
    };
    for (const o of [...g.children]) {
      const z = o.userData.z; if (z == null) continue;
      if (o.userData.over) { o.position.y += OVER_H; continue; }   // колоните под плочата
      if (Math.max(overLift(OV, z - 6), overLift(OV, z), overLift(OV, z + 6)) <= 0) continue;
      if (o.isMesh && (o.geometry.type === 'BoxGeometry' || o.geometry.type === 'PlaneGeometry')) bend(o, earth.includes(o));
      else { o.position.y += overLift(OV, z); if (asphalt.includes(o)) o.rotation.x -= Math.atan(overLift(OV, z + 0.5) - overLift(OV, z - 0.5)); }   // плочките на обикновената магистрала — с наклона
    }
  }
  const Hf = z => H(z) + overLift(OV, z);   // за техниката по фронта
  // строителна площадка на фронта: конуси, бариери, лампи
  const front = new THREE.Group(); g.add(front);
  for (const x of [-W / 2 - 2, W / 2 + 2]) { const b = clone(A, 'construction-barrier', 5); b.position.set(x, 0, 0); front.add(b); }
  const fl = clone(A, 'construction-light', 6); fl.position.set(W / 2 + 3, 0, -3); front.add(fl);
  // Лабораторията → road-signs: истински пластмасови бариери (оранжево-бели) напреки на платното пред строежа
  if (feature('road-signs')) loadSigns().then(() => { for (let x = -W / 2 + 0.8, k = 0; x < W / 2; x += 1.3, k++) { const b = sign(k % 2 ? 'barrier' : 'barrier2', x, 1.2, 0); if (b) { b.position.y = 0.9; front.add(b); } } });
  // машини: асфалтополагач и валяк (процедурни), плюс самосвали от Kenney, ако са заредени
  const paver = makePaver(CW), rollers = [makeRoller(), makeRoller()];
  g.add(paver, ...rollers);
  // пресен (горещ) асфалт зад полагача — по-тъмна ивица, която валяците изглаждат
  const fresh = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.6, 16), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.55, transparent: true, opacity: 0.85 }));
  fresh.rotation.x = -Math.PI / 2; g.add(fresh);
  const trucks = [];
  // истинската техника на играта (vehmodels.js), иначе Kenney
  for (let k = 0; k < 2; k++) { const t = A['sf-dump'] ? clone(A, 'sf-dump', 7.5) : A.truck ? clone(A, 'truck', 2.2) : null; if (t) { g.add(t); trucks.push(t); } }
  { const l = A['sf-excavator'] ? clone(A, 'sf-excavator', 8.5) : A['tractor-shovel'] ? clone(A, 'tractor-shovel', 2.2) : null; if (l) { g.add(l); trucks.push(l); } }
  if (A['sf-backhoe']) { const b = clone(A, 'sf-backhoe', 6.5); g.add(b); trucks.push(b); }

  // stage: 0..3, prog: 0..1 в рамките на етапа, t: секунди (за анимация)
  function update(stage, prog, t = 0) {
    if (g.userData.water) g.userData.water.update(t);
    const fz = z0 + LEN * prog;      // фронт на текущия етап
    reveal(earth, stage > 0 ? 1e9 : fz);
    reveal(gravel, stage > 1 ? 1e9 : stage === 1 ? fz : -1e9);
    reveal(asphalt, stage > 2 ? 1e9 : stage === 2 ? fz : -1e9);
    reveal(gear, stage > 3 ? 1e9 : stage === 3 ? fz : -1e9);
    const done = stage > 3;
    front.visible = !done;
    front.position.z = fz; front.position.y = overLift(OV, fz);
    const asph = stage === 2, lx = -(cw + med) / 2;
    paver.visible = fresh.visible = asph;
    rollers.forEach(r => r.visible = asph);
    // полагачът върви напред по фронта; плочата му е точно на ръба на асфалта
    paver.position.set(lx, Hf(fz) - 0.1, fz + 1.2);
    fresh.position.set(lx, Hf(fz) + 0.06, fz - 7);
    // два валяка ходят напред-назад по пресния асфалт, в двете половини на платното
    rollers.forEach((r, k) => {
      const zz = fz - 6 - k * 7 + Math.sin(t * 0.9 + k * 1.7) * 4;
      r.position.set(lx + (k ? 2.2 : -2.2), Hf(zz) - 0.1, zz);
      const dir = Math.cos(t * 0.9 + k * 1.7);
      r.rotation.y = dir >= 0 ? 0 : Math.PI;
      r.userData.drums.forEach(d => d.rotation.x += 0.05 * Math.sign(dir || 1));
    });
    trucks.forEach((tr, k) => {
      tr.visible = !done && stage < 3;
      const zz = fz - 10 - k * 9 + Math.sin(t * 0.8 + k) * 4;
      tr.position.set((k % 2 ? 1 : -1) * (W / 2 + 4), 0, zz);
      tr.rotation.y = Math.cos(t * 0.8 + k) >= 0 ? 0 : Math.PI;   // гледа накъдето се движи
    });
  }
  update(opts.stage ?? 0, opts.prog ?? 0);
  return { group: g, update, length: LEN, width: W, service, ramps };
}
