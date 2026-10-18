// boardholo.js — холограмата над масата в Директорската зала (directors3d.js): една обща, съдържанието се сменя с предложението.
// Банката → въртящ се глобус и бюджетът за инвестиции; предложение с p.geo → контурът на държавата, до 5 града, трасетата и символите на обектите.
// p.geo = { country: 'ESP' (a3 от assets/globe/countries.json), kind: 'hotel'|'branch'|'route'|'airport'|'port'|'oil'|'rail'|'district', cities: [{ nm, lat, lon }], route: [[i, j]] }
// Одобрено → за кратко зелено и „Бюджетът е резервиран“; отложено → кехлибарено „За следващо заседание“. Само линии и надписи — без тежки ефекти.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CYAN = 0x5fd0ff, GREEN = 0x5fe39a, AMBER = 0xffb347, RED = 0xff6b6b;
const W = 1.15, H = 0.72;   // рамката на картата (m)
const KIND_ICO = { loan: '🏦', energy: '⚡', mine: '⛏️', bridge: '🌉', hotel: '🏨', branch: '🏢', district: '🏘️', airport: '✈️', port: '⚓', oil: '🛢️', rail: '🚆', route: '🛣️', bank: '🏦', glob: '🌍' };
let geoP = null;
const geo = () => geoP || (geoP = fetch('assets/globe/countries.json').then(r => r.json()).catch(() => null));

// 🧊 малките холограмни модели над градовете: полупрозрачна плът + светещи ръбове (само кутии, цилиндри и конуси — без текстури)
function miniModel(kind) {
  const g = new THREE.Group();
  const fill = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const edge = lineMat(CYAN);
  const add = (geo, x, y, z, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, fill); m.position.set(x, y, z); m.rotation.set(0, ry, rz); g.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge); e.position.copy(m.position); e.rotation.copy(m.rotation); g.add(e);
  };
  const B = (w, h, d, x = 0, y = 0, z = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, ry, rz);
  const C = (r, h, x = 0, y = 0, z = 0, seg = 10) => add(new THREE.CylinderGeometry(r, r, h, seg), x, y + h / 2, z);
  const K = (r, h, x = 0, y = 0, z = 0, seg = 4) => add(new THREE.ConeGeometry(r, h, seg), x, y + h / 2, z, Math.PI / 4);
  switch (kind) {
    case 'hotel': B(0.034, 0.11, 0.03); B(0.06, 0.045, 0.026, 0, 0, -0.002); K(0.022, 0.018, 0, 0.11, 0); break;   // кула с крила
    case 'airport': C(0.006, 0.07, -0.03); B(0.02, 0.012, 0.02, -0.03, 0.07); B(0.07, 0.01, 0.012, 0.02, 0.03, 0); B(0.014, 0.004, 0.075, 0.02, 0.033, 0); B(0.01, 0.018, 0.004, 0.05, 0.035, 0); break;   // кула + самолет
    case 'port': B(0.08, 0.016, 0.026, 0.01); B(0.03, 0.014, 0.018, 0.02, 0.016); B(0.008, 0.09, 0.008, -0.04); B(0.07, 0.006, 0.006, -0.015, 0.088); break;   // кораб + кран
    case 'oil': for (const [x, z] of [[-0.022, -0.022], [0.022, -0.022], [-0.022, 0.022], [0.022, 0.022]]) C(0.003, 0.04, x, 0, z, 6); B(0.06, 0.008, 0.06, 0, 0.04); add(new THREE.ConeGeometry(0.016, 0.07, 4, 3, true), 0, 0.083, 0, Math.PI / 4); break;   // платформа + сондажна кула
    case 'bridge': B(0.12, 0.006, 0.02, 0, 0.03); for (const x of [-0.035, 0.035]) B(0.008, 0.075, 0.022, x); { const pts = []; for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { pts.push(new THREE.Vector3(sx * 0.035, 0.075, 0), new THREE.Vector3(sx * (0.035 + 0.012 * (k + 1)) * (k % 2 ? 1 : 1), 0.034, 0)); pts.push(new THREE.Vector3(sx * 0.035, 0.075, 0), new THREE.Vector3(sx * (0.035 - 0.009 * (k + 1)), 0.034, 0)); } g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), edge)); } break;   // пилони с въжета
    case 'rail': for (let k = 0; k < 3; k++) B(0.034, 0.022, 0.016, -0.04 + k * 0.038, 0.004); B(0.12, 0.003, 0.024, 0, 0); break;   // влак на релси
    case 'route': B(0.026, 0.026, 0.022, -0.035); B(0.065, 0.03, 0.024, 0.012); B(0.12, 0.002, 0.04, 0, -0.002); break;   // камион на пътя
    case 'district': for (const [x, z] of [[-0.03, -0.02], [0.02, -0.025], [-0.02, 0.025], [0.03, 0.02]]) { B(0.026, 0.022, 0.024, x, 0, z); K(0.022, 0.016, x, 0.022, z); } break;   // къщички
    case 'bank': B(0.08, 0.008, 0.04); for (let k = 0; k < 4; k++) C(0.004, 0.04, -0.027 + k * 0.018, 0.008, 0, 6); B(0.084, 0.008, 0.044, 0, 0.048); add(new THREE.ConeGeometry(0.05, 0.02, 3), 0, 0.066, 0, 0, 0); break;   // колони и фронтон
    case 'energy': {   // вятърна перка + соларен панел
      C(0.003, 0.1, 0.02, 0, 0, 6); B(0.012, 0.012, 0.012, 0.02, 0.1, 0);
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; add(new THREE.BoxGeometry(0.004, 0.05, 0.003), 0.02 + Math.sin(a) * 0.025, 0.106 + Math.cos(a) * 0.025, 0.008, 0, -a); }
      add(new THREE.BoxGeometry(0.05, 0.003, 0.034), -0.03, 0.022, 0, 0, 0.5); C(0.002, 0.02, -0.03, 0, 0, 5); break;
    }
    case 'mine': {   // шахтова кула с колело, сграда и купчина руда
      add(new THREE.BoxGeometry(0.004, 0.09, 0.004), -0.012, 0.045, 0, 0, 0.18); add(new THREE.BoxGeometry(0.004, 0.09, 0.004), 0.012, 0.045, 0, 0, -0.18);
      add(new THREE.TorusGeometry(0.012, 0.0025, 6, 16), 0, 0.09, 0); B(0.04, 0.022, 0.03, 0.035); K(0.028, 0.024, -0.04, 0, 0.01, 8); break;
    }
    case 'loan':
    case 'glob': add(new THREE.SphereGeometry(0.04, 12, 8), 0, 0.045, 0); C(0.003, 0.006, 0, 0, 0); break;
    default: B(0.036, 0.075, 0.03); B(0.024, 0.03, 0.022, 0.03); break;   // филиал — офис сграда
  }
  return g;
}

// 🚆✈️🚢🚚 превозните средства над картата: покупка — голям модел и брой; ъпгрейд — малкият → стрелка → големият (big — по-дълъг, повече вагони/двигатели)
function vehicleModel(kind, big) {
  const g = new THREE.Group(), fill = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), edge = lineMat(CYAN);
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, fill); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edge); e.position.copy(m.position); e.rotation.copy(m.rotation); g.add(e); };
  const B = (w, h, d, x, y, z, rz = 0) => add(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, 0, 0, rz);
  if (kind === 'train') {   // локомотив с наклонен нос + вагони
    const n = big ? 5 : 2, L = 0.075; B(0.09, 0.05, 0.042, 0, 0.008, 0); add(new THREE.ConeGeometry(0.03, 0.05, 4), 0.068, 0.033, 0, 0, Math.PI / 4, -Math.PI / 2);
    for (let i = 0; i < n; i++) B(L, 0.044, 0.04, -0.09 - i * (L + 0.008), 0.008, 0);
    B(0.12 + n * (L + 0.008), 0.004, 0.05, -(n * (L + 0.008)) / 2 + 0.02, 0, 0);
  } else if (kind === 'plane') {   // фюзелаж, криле, опашка, двигатели (голям — широкофюзелажен с 4)
    const len = big ? 0.34 : 0.22, r = big ? 0.026 : 0.018, span = big ? 0.32 : 0.21;
    add(new THREE.CylinderGeometry(r, r * 0.8, len, 12), 0, 0.05, 0, 0, 0, Math.PI / 2); add(new THREE.ConeGeometry(r, 0.04, 12), len / 2 + 0.02, 0.05, 0, 0, 0, -Math.PI / 2);
    B(0.06, 0.004, span, 0.01, 0.045, 0); B(0.03, 0.004, span * 0.35, -len / 2 + 0.02, 0.055, 0); B(0.03, 0.05, 0.004, -len / 2 + 0.02, 0.055, 0);
    for (const z of big ? [-span * 0.38, -span * 0.2, span * 0.2, span * 0.38] : [-span * 0.28, span * 0.28]) add(new THREE.CylinderGeometry(0.009, 0.009, 0.035, 8), 0.025, 0.036, z, 0, 0, Math.PI / 2);
  } else if (kind === 'ship') {   // корпус с нос, мостик на кърмата, контейнери на редове
    const len = big ? 0.36 : 0.22, w = big ? 0.07 : 0.05; B(len, 0.03, w, 0, 0, 0); add(new THREE.ConeGeometry(w / 2, 0.05, 4), len / 2 + 0.024, 0.015, 0, 0, Math.PI / 4, -Math.PI / 2);
    B(0.035, 0.05, w * 0.8, -len / 2 + 0.03, 0.03, 0);
    const rows = big ? 3 : 1, cols = Math.floor((len - 0.08) / 0.03); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) B(0.026, 0.014, w * 0.8, -len / 2 + 0.075 + c * 0.03, 0.03 + r * 0.015, 0);
  } else if (kind === 'gear') {   // 🚜 багер: вериги, кабина, стрела и кофа
    B(0.16, 0.035, 0.09, 0, 0, 0); B(0.11, 0.05, 0.08, 0, 0.035, 0); B(0.05, 0.05, 0.05, 0.03, 0.085, 0.01);
    add(new THREE.BoxGeometry(0.15, 0.018, 0.022), 0.1, 0.12, 0, 0, 0, 0.55); add(new THREE.BoxGeometry(0.1, 0.016, 0.02), 0.2, 0.12, 0, 0, 0, -0.9); B(0.04, 0.035, 0.05, 0.235, 0.03, 0);
  } else if (kind === 'bullet') {   // ⚡ „Стрела“: дълъг заострен нос, гладки вагони, пантограф
    add(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 12), 0, 0.03, 0, 0, 0, Math.PI / 2); add(new THREE.ConeGeometry(0.024, 0.11, 12), 0.105, 0.03, 0, 0, 0, -Math.PI / 2);
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.024, 0.024, 0.085, 12), -0.095 - i * 0.09, 0.03, 0, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.03, 0.003, 0.03), -0.02, 0.058, 0, 0, 0, 0.6); B(0.5, 0.004, 0.05, -0.1, 0, 0);
  } else {   // 🚚 ТИР: кабина + ремарке (голям — по-дълго ремарке и двойни оси)
    B(0.05, 0.05, 0.045, 0.1, 0, 0); B(0.03, 0.02, 0.046, 0.13, 0.03, 0); B(big ? 0.22 : 0.14, 0.055, 0.046, big ? -0.04 : 0.0, 0.004, 0);
  }
  return g;
}
const VEH = { trucks: 'truck', trains: 'train', planes: 'plane', ships: 'ship', gear: 'gear' }, VEH_UP = { trainup: 'train', planeup: 'plane', shipup: 'ship', truckup: 'truck', hs: 'bullet' };
const VEH_NM = { bullet: ['влак', 'влак „Стрела“'], gear: ['машина', 'машини'], train: ['малък влак', 'голям влак'], plane: ['малък самолет', 'голям самолет'], ship: ['малък кораб', 'голям кораб'], truck: ['камион', 'ТИР'] };
// истински 3D модел (glb) като холограма: полупрозрачна плът + светещи ръбове; кеш по файл; size — най-дългата страна
// истинските 3D модели (glb) като холограма: полупрозрачна плът + светещи ръбове; композиция — локомотив и вагони в редица по X
const HV = 'assets/heavy/';
const HOLO_GLB = {
  gear: { parts: [HV + 'gear/excavator.glb'], size: 0.34 },
  'train-s': { parts: [HV + 'trains/gp38.glb', HV + 'trains/boxcar.glb'], size: 0.4 },
  'train-b': { parts: [HV + 'trains/vl82.glb', HV + 'trains/boxcar.glb', HV + 'trains/hopper2.glb'], size: 0.56 },
  bullet: { parts: [HV + 'trains/hsw.glb'], size: 0.56 },
  'plane-s': { parts: [HV + 'air/regional.glb'], size: 0.3 }, 'plane-b': { parts: [HV + 'air/wide.glb'], size: 0.42 }, plane: { parts: [HV + 'air/a320.glb'], size: 0.38 },
  'ship-s': { parts: [HV + 'ships/tanker.glb'], size: 0.32 }, 'ship-b': { parts: [HV + 'ships/container.glb'], size: 0.46 },
  'truck-s': { parts: [HV + 'trucks/volvo.glb'], size: 0.26 }, 'truck-b': { parts: [HV + 'trucks/scania.glb'], size: 0.34 },
};
const holoKey = (kind, big) => HOLO_GLB[kind] && kind !== 'train' && kind !== 'ship' && kind !== 'truck' ? kind : HOLO_GLB[`${kind}-${big ? 'b' : 's'}`] ? `${kind}-${big ? 'b' : 's'}` : null;
const glbCache = {};
const loadG = url => glbCache[url] = glbCache[url] || new GLTFLoader().loadAsync(url);
// всяка част — нормализирана: дългата хоризонтална ос по X, основа на y = 0; частите — една след друга, общата дължина = size
function holoGlb(key, fallback) {
  const { parts, size } = HOLO_GLB[key], g = new THREE.Group();
  Promise.all(parts.map(loadG)).then(gls => {
    const fill = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), edge = lineMat(CYAN);
    const geos = gls.map(gl => {
      const src = gl.scene; src.updateMatrixWorld(true); const list = [];
      src.traverse(o => { if (o.isMesh) { const ge = o.geometry.clone(); ge.applyMatrix4(o.matrixWorld); list.push(ge); } });
      const bb = new THREE.Box3(); list.forEach(ge => { ge.computeBoundingBox(); bb.union(ge.boundingBox); });
      const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), rot = sz.z > sz.x;
      list.forEach(ge => { ge.translate(-c.x, -bb.min.y, -c.z); if (rot) ge.rotateY(Math.PI / 2); });
      return { list, len: rot ? sz.z : sz.x, h: sz.y };
    });
    // мащабът: локомотивът е мярката — всички части в един мащаб, общо size
    const gap = 0.02 * geos[0].len, total = geos.reduce((a, q) => a + q.len, 0) + gap * (geos.length - 1), k = size / total;
    let x = total / 2;
    geos.forEach(q => { const cx = x - q.len / 2; x -= q.len + gap; for (const ge of q.list) { ge.translate(cx, 0, 0); ge.scale(k, k, k); g.add(new THREE.Mesh(ge, fill)); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(ge, 35), edge)); } });
  }).catch(() => fallback && g.add(fallback()));
  return g;
}
function vehicleBanner(g, p, y, k = 1) {
  const key = (String(p.id || '').split(':')[1] || '').replace(/[0-9.-]+$/, ''), buy = p.veh?.kind || VEH[key], up = p.veh?.up || VEH_UP[key]; if (!buy && !up) return;
  const ban = new THREE.Group(); ban.position.set(0, y, 0.05); ban.scale.setScalar(k); g.add(ban); const n = p.count || 1;
  if (up) {
    const sk = up === 'bullet' ? 'train' : up, a = holoKey(sk, false) ? holoGlb(holoKey(sk, false), () => vehicleModel(sk, false)) : vehicleModel(sk, false); a.position.x = -0.36; a.userData.sway = 0; ban.add(a);
    const bk = up === 'bullet' ? 'bullet' : holoKey(up, true), b = bk ? holoGlb(bk, () => vehicleModel(up, true)) : vehicleModel(up, true); b.position.x = 0.36; b.userData.sway = 1; ban.add(b);
    const am = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const arrow = new THREE.Group(); arrow.userData.pulse = true; ban.add(arrow);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), am); sh.rotation.z = Math.PI / 2; sh.position.set(-0.01, 0.05, 0); arrow.add(sh);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.04, 12), am); tip.rotation.z = -Math.PI / 2; tip.position.set(0.055, 0.05, 0); arrow.add(tip);
    const [s0, s1] = VEH_NM[up]; const l0 = textSprite([s0], { h: 0.04, bg: false }); l0.position.set(-0.32, -0.03, 0.02); ban.add(l0); const l1 = textSprite([`${s1}${n > 1 ? ` ×${n}` : ''}`], { h: 0.045, bg: false, col: '#ffe08a' }); l1.position.set(0.34, -0.03, 0.02); ban.add(l1);
  } else {
    const hk = buy === 'plane' ? 'plane' : holoKey(buy, true), m = hk ? holoGlb(hk, () => vehicleModel(buy, true)) : vehicleModel(buy, true); if (!hk) m.scale.setScalar(1.25); m.userData.sway = 0; ban.add(m);
    const l = textSprite([`×${n}`], { h: 0.08, bg: false, col: '#ffe08a' }); l.position.set(0.32, 0.05, 0.02); ban.add(l);
  }
}

// 📈 графиката на акцията: досегашният ход и пунктир — какво очакваме след решението (p.chart — истинските цени, ако ги има)
function stockChart(g, p, y, k = 1) {
  const key = (String(p.id || '').split(':')[1] || '').replace(/[0-9.-]+$/, ''); if (!['sdiv', 'ipo', 'buyback'].includes(key) && !p.chart) return;
  const hist = p.chart || (key === 'ipo' ? [1, 1.03, 1.02, 1.06, 1.08, 1.07, 1.1, 1.12] : [1, 0.96, 0.97, 0.9, 0.86, 0.84, 0.78, 0.74]), up = key === 'ipo' ? 0.92 : 1.25;   // IPO — малко разводняване
  const W2 = 0.9, H2 = 0.32, n = hist.length, all = [...hist, hist[n - 1] * up], lo = Math.min(...all) * 0.97, hi = Math.max(...all) * 1.03;
  const P = (i, v) => new THREE.Vector3(-W2 / 2 + i / n * W2, (v - lo) / (hi - lo) * H2, 0);
  const box = new THREE.Group(); box.position.set(-0.15 * k, y, 0.05); box.scale.setScalar(k); g.add(box);
  const axis = lineMat(CYAN); axis.opacity = 0.35;
  for (let k = 0; k < 4; k++) box.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(0, lo + (hi - lo) * k / 4), P(n, lo + (hi - lo) * k / 4)]), axis));
  const down = hist[n - 1] < hist[0];
  box.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hist.map((v, i) => P(i, v))), lineMat(down ? RED : GREEN)));
  const f = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(n - 1, hist[n - 1]), P(n, hist[n - 1] * up)]), new THREE.LineDashedMaterial({ color: up >= 1 ? GREEN : AMBER, dashSize: 0.02, gapSize: 0.012, transparent: true, depthWrite: false, toneMapped: false }));
  f.computeLineDistances(); f.userData.dash = true; box.add(f);
  const pct = Math.round((hist[n - 1] / hist[0] - 1) * 100), lab = textSprite([`📈 ${p.chartNm || 'Акцията'}: ${pct >= 0 ? '+' : ''}${pct}%`, `след решението: ${up >= 1 ? '↗ нагоре' : '↘ леко надолу'}`], { h: 0.05, col: down ? '#ff8f86' : '#8fe8b0' });
  lab.position.set(W2 / 2 + 0.25, H2 * 0.7, 0.02); box.add(lab);
  return box;
}

function textSprite(lines, opt = {}) {
  const fs = opt.size || 34, pad = 14, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `700 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(Math.max(...lines.map(l => g.measureText(l).width))) + pad * 2, h = lines.length * fs * 1.3 + pad * 1.4;
  c.width = w; c.height = h;
  if (opt.bg !== false) { g.fillStyle = 'rgba(6,22,40,.72)'; g.strokeStyle = opt.col || '#5fd0ff'; g.lineWidth = 3; g.beginPath(); g.roundRect(1.5, 1.5, w - 3, h - 3, 12); g.fill(); g.stroke(); }
  g.font = `700 ${fs}px system-ui, sans-serif`; g.textBaseline = 'top';
  lines.forEach((l, i) => { g.fillStyle = i === 0 ? (opt.col || '#bfeaff') : '#e8f6ff'; g.fillText(l, pad, pad * 0.7 + i * fs * 1.3); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  const k = (opt.h || 0.06) / (fs * 1.3); s.scale.set(w * k, h * k, 1); s.renderOrder = 5;
  return s;
}
const lineMat = col => new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

// fmt — за сумите; base — точката над медальона
export function createHolo(scene, { fmt = n => Math.round(n).toLocaleString('bg-BG'), base = new THREE.Vector3(0, 1.2, 0) } = {}) {
  const root = new THREE.Group(); root.position.copy(base); root.rotation.x = -0.45; scene.add(root);   // наклонена назад — „носи се“ над масата, не пред картата на стената
  // лъчът от медальона нагоре — едва видим
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, base.y - 0.76, 40, 1, true), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(base.x, (base.y + 0.76) / 2 - 0.05, base.z); scene.add(beam);
  let cur = null, t = 0, spin = null, flashT = 0, token = 0;
  const mats = () => { const out = []; cur && cur.traverse(o => { if (o.material) out.push(o.material); }); return out; };
  function clear() {
    if (!cur) return;
    cur.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } });
    root.remove(cur); cur = null; spin = null;
  }
  function begin() { clear(); cur = new THREE.Group(); cur.scale.set(1, 0.01, 1); root.add(cur); t = 0; return cur; }

  // 🏦 глобус и бюджетът
  function globe(p) {
    const g = begin(), sph = new THREE.Group();
    const m = lineMat(CYAN);
    for (let la = -60; la <= 60; la += 30) { const r = Math.cos(la * Math.PI / 180) * 0.32, pts = []; for (let a = 0; a <= 64; a++) pts.push(new THREE.Vector3(Math.cos(a / 64 * Math.PI * 2) * r, Math.sin(la * Math.PI / 180) * 0.32, Math.sin(a / 64 * Math.PI * 2) * r)); sph.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); }
    for (let lo = 0; lo < 180; lo += 30) { const pts = []; for (let a = 0; a <= 64; a++) { const q = a / 64 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(q) * 0.32 * Math.cos(lo * Math.PI / 180), Math.sin(q) * 0.32, Math.cos(q) * 0.32 * Math.sin(lo * Math.PI / 180))); } sph.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m)); }
    sph.position.set(-0.38, 0.4, 0); g.add(sph); spin = sph;
    // континентите върху глобуса — само контури
    geo().then(gj => {
      if (!gj || cur !== g) return;
      const cm = lineMat(CYAN); cm.opacity = 0.55;
      for (const f of gj.features) for (const poly of (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)) {
        const ring = poly[0]; if (ring.length < 12) continue;
        const pts = ring.filter((_, i) => i % 2 === 0).map(([lo, la]) => { const a = lo * Math.PI / 180, b = la * Math.PI / 180, r = 0.322; return new THREE.Vector3(Math.cos(b) * Math.sin(a) * r, Math.sin(b) * r, Math.cos(b) * Math.cos(a) * r); });
        sph.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cm));
      }
    });
    const lab = textSprite(['🏦 Бюджет за инвестиции', p.avail != null ? `${fmt(p.avail)} €` : '—', ...(p.reserve ? [`резерв ${fmt(p.reserve)} €`] : [])], { h: 0.07 });
    lab.position.set(0.42, 0.42, 0); g.add(lab);
  }

  // 🗺️ държава + градове + трасета + символи
  async function country(p) {
    const my = ++token, G = p.geo, g = begin(), gj = await geo();
    if (my !== token || cur !== g) return;
    const f = gj && gj.features.find(x => x.properties.a3 === G.country);
    let polys = f ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    // само основната суша (без отвъдморските територии): полигоните близо до най-големия
    const box = poly => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const [x, y] of poly[0]) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } return [a, b, c, d]; };
    if (polys.length > 1) { const bs = polys.map(box), big = bs.reduce((m, b, i) => ((b[1] - b[0]) * (b[3] - b[2]) > (bs[m][1] - bs[m][0]) * (bs[m][3] - bs[m][2]) ? i : m), 0), [x0, x1, y0, y1] = bs[big], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; polys = polys.filter((_, i) => Math.hypot((bs[i][0] + bs[i][1]) / 2 - cx, (bs[i][2] + bs[i][3]) / 2 - cy) < 14); }
    const cities = (G.cities || []).slice(0, 5);
    let lo0 = 1e9, lo1 = -1e9, la0 = 1e9, la1 = -1e9;
    const ext = (lo, la) => { lo0 = Math.min(lo0, lo); lo1 = Math.max(lo1, lo); la0 = Math.min(la0, la); la1 = Math.max(la1, la); };
    for (const poly of polys) for (const [lo, la] of poly[0]) ext(lo, la);
    for (const c of cities) ext(c.lon, c.lat);
    if (lo0 > lo1) { lo0 = -10; lo1 = 10; la0 = -10; la1 = 10; }
    const kx = Math.cos((la0 + la1) / 2 * Math.PI / 180), sw = (lo1 - lo0) * kx || 1, sh = (la1 - la0) || 1, sc = Math.min(W / sw, H / sh);
    const P = (lo, la) => new THREE.Vector3(((lo - (lo0 + lo1) / 2) * kx) * sc, (la - (la0 + la1) / 2) * sc + H / 2 + 0.05, 0);
    const m = lineMat(CYAN);
    for (const poly of polys) {
      const ring = poly[0]; g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(([lo, la]) => P(lo, la))), m));
      const sh2 = new THREE.Shape(ring.map(([lo, la]) => { const v = P(lo, la); return new THREE.Vector2(v.x, v.y); }));
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(sh2), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
    }
    // трасетата (магистрала/жп): светеща линия с тичащи черти
    const rm = new THREE.LineDashedMaterial({ color: 0xffe08a, dashSize: 0.03, gapSize: 0.018, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    for (const [i, j] of (G.route || [])) { if (!cities[i] || !cities[j]) continue; const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P(cities[i].lon, cities[i].lat), P(cities[j].lon, cities[j].lat)]), rm); l.computeLineDistances(); l.userData.dash = true; g.add(l); }
    // градовете: точка, име и символът на обекта, който „израства“
    const ico = KIND_ICO[G.kind] || '📍';
    cities.forEach((c, i) => {
      const v = P(c.lon, c.lat);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.014, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); dot.position.copy(v); dot.position.z = 0.002; dot.userData.marker = true; g.add(dot);
      const nm = textSprite([c.nm], { h: 0.05, bg: false }); nm.position.set(v.x, v.y - 0.04, 0.01); g.add(nm);
      const ic = miniModel(G.kind); ic.position.set(v.x, v.y + 0.012, 0.03); ic.userData.grow = 0.12 * i; ic.userData.full = new THREE.Vector3(1.7, 1.7, 1.7); ic.userData.spinM = true; ic.scale.setScalar(0.01); g.add(ic);
    });
    const info = [`${ico} ${p.cost ? fmt(p.cost) + ' €' : 'без разход'}`];
    if (p.days) info.push(`срок ${p.days} дни`);
    if (p.income) info.push(`+${fmt(p.income)} €/ден`);
    const lab = textSprite(info, { h: 0.055 }); lab.position.set(W / 2 + 0.12, H - 0.05, 0.02); g.add(lab);
    // 🏦 кредит на държава: голям надпис с рейтинга (в неговия цвят) и сумата над картата
    if (G.kind === 'loan' && G.rating) {
      const big = textSprite([G.rating, G.amt ? `${fmt(G.amt)} €` : ''].filter(Boolean), { h: 0.15, col: G.ratingCol || '#ffd54a' });
      big.position.set(-W / 2 - 0.05, H + 0.18, 0.06);   // над картата вляво — не закрива държавата big.renderOrder = 6; g.add(big);
    }
    vehicleBanner(g, p, H + 0.2, 1.35); stockChart(g, p, H + 0.12);
  }

  function show(p) {
    token++; flashT = 0;
    if (!p) { clear(); return; }
    if (p.info) globe(p);
    else if (p.geo && p.geo.country) country(p);
    else {   // без география — символът на дружеството и сумата
      const g = begin(), lab = textSprite([`${p.ico || '📋'} ${p.cost ? fmt(p.cost) + ' €' : ''}`.trim()], { h: 0.09 }); g.add(lab); vehicleBanner(g, p, 0.62, 1.9); const ch = stockChart(g, p, 0.12, 1.8); lab.position.set(0, ch ? 0.82 : 0.32, 0);   // без карта — моделът е едър, в центъра
    }
  }
  // 'ok' → зелено + „Бюджетът е резервиран“; 'later' → кехлибарено + „За следващо заседание“; 'no' → червено за миг
  function flash(kind) {
    if (!cur) return;
    const col = kind === 'ok' ? GREEN : kind === 'later' ? AMBER : RED;
    for (const m of mats()) if (m.color && !m.map) m.color.setHex(col);
    const txt = kind === 'ok' ? '✓ Бюджетът е резервиран' : kind === 'later' ? '⏳ За следващо заседание' : '✖ Отказано';
    const lab = textSprite([txt], { h: 0.08, col: kind === 'ok' ? '#5fe39a' : kind === 'later' ? '#ffb347' : '#ff6b6b' }); lab.position.set(0, 0.5, 0.05); cur.add(lab);
    flashT = 1;
  }
  function update(dt) {
    if (!cur) return;
    t += dt;
    cur.scale.y = Math.min(1, cur.scale.y + dt * 3);   // кратко „изгряване“
    if (spin) spin.rotation.y += dt * 0.35;
    cur.traverse(o => {
      if (o.userData.dash) o.material.dashOffset = (o.material.dashOffset || 0) - dt * 0.05;
      if (o.userData.full && t > 0.35 + o.userData.grow) o.scale.lerp(o.userData.full, Math.min(1, dt * 8));   // символите израстват един след друг
      if (o.userData.marker) o.scale.setScalar(1 + Math.sin(t * 4) * 0.25);
      if (o.userData.spinM) o.rotation.y += dt * 0.6;
      if (o.userData.sway != null) o.rotation.y = -0.55 + Math.sin(t * 0.8 + o.userData.sway) * 0.25;   // три четвърти отстрани, леко полюшване
      if (o.userData.pulse) { const k = 1 + Math.sin(t * 5) * 0.15; o.scale.set(k, k, k); }
    });
    if (flashT > 0) flashT = Math.max(0, flashT - dt * 0.6);
  }
  function dispose() { token++; clear(); scene.remove(root); scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); }
  return { show, flash, update, dispose };
}
