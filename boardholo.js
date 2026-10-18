// boardholo.js — холограмата над масата в Директорската зала (directors3d.js): една обща, съдържанието се сменя с предложението.
// Банката → въртящ се глобус и бюджетът за инвестиции; предложение с p.geo → контурът на държавата, до 5 града, трасетата и символите на обектите.
// p.geo = { country: 'ESP' (a3 от assets/globe/countries.json), kind: 'hotel'|'branch'|'route'|'airport'|'port'|'oil'|'rail'|'district', cities: [{ nm, lat, lon }], route: [[i, j]] }
// Одобрено → за кратко зелено и „Бюджетът е резервиран“; отложено → кехлибарено „За следващо заседание“. Само линии и надписи — без тежки ефекти.
import * as THREE from 'three';

const CYAN = 0x5fd0ff, GREEN = 0x5fe39a, AMBER = 0xffb347, RED = 0xff6b6b;
const W = 1.15, H = 0.72;   // рамката на картата (m)
const KIND_ICO = { bridge: '🌉', hotel: '🏨', branch: '🏢', district: '🏘️', airport: '✈️', port: '⚓', oil: '🛢️', rail: '🚆', route: '🛣️', bank: '🏦', glob: '🌍' };
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
    case 'glob': add(new THREE.SphereGeometry(0.04, 12, 8), 0, 0.045, 0); C(0.003, 0.006, 0, 0, 0); break;
    default: B(0.036, 0.075, 0.03); B(0.024, 0.03, 0.022, 0.03); break;   // филиал — офис сграда
  }
  return g;
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
  }

  function show(p) {
    token++; flashT = 0;
    if (!p) { clear(); return; }
    if (p.info) globe(p);
    else if (p.geo && p.geo.country) country(p);
    else {   // без география — символът на дружеството и сумата
      const g = begin(), lab = textSprite([`${p.ico || '📋'} ${p.cost ? fmt(p.cost) + ' €' : ''}`.trim()], { h: 0.09 }); lab.position.set(0, 0.45, 0); g.add(lab);
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
    });
    if (flashT > 0) flashT = Math.max(0, flashT - dt * 0.6);
  }
  function dispose() { token++; clear(); scene.remove(root); scene.remove(beam); beam.geometry.dispose(); beam.material.dispose(); }
  return { show, flash, update, dispose };
}
