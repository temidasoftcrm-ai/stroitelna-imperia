// billboards3d.js — 🪧 билбордове с нашата фирма по булевардите (флаг billboards; потребителят: „3D билбордове с нашата компания по големите булеварди“).
// Истински на вид: стоманен стълб 7 м, рамка с пътека и лампи, двулицево платно 12 × 4 м, на тротоара с лице към движението,
// през ~200 м, най-много 8 на град. Съдържанието — марката на играча (лого, име в цвета на марката, лозунг), 3 дизайна на ред;
// o.images = [url…] — снимките на потребителя вместо нарисуваните (когато ги прати). Нощем лампите и платната светят.
// Евтино: всичко е InstancedMesh (стълбове, рамки, лампи — по един; платната — по един на дизайн), текстурите — общи.
// buildBillboards(group, { roads: [{ pts: [[x, z]…], w }], brand: { nm, col, ico }, company, years, images, max, gap }) → { group, spots, setNight(k), dispose }
import * as THREE from 'three';

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

// местата: по най-дългите булеварди, през ~gap м, отстъп от оста = половината ширина + 3 м, редуват се страните; не по-близо от 0,6·gap един до друг
export function billboardSpots(roads, { max = 8, gap: gap0 } = {}) {
  const out = [], L = r => { let s = 0; for (let i = 1; i < r.pts.length; i++) s += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); return s; };
  const list = roads.filter(r => r.pts && r.pts.length > 1).map(r => ({ r, len: L(r) })).filter(q => q.len > 45).sort((a, b) => (b.r.main ? 1e9 : 0) + b.len - ((a.r.main ? 1e9 : 0) + a.len));   // булевардите (main) първо; плановете от картата са на къси отсечки
  const tot = list.reduce((t, q) => t + q.len, 0), gap = gap0 || Math.max(70, Math.min(220, tot / (max + 1)));   // малките градове — по-гъсто, иначе се събира един
  let side = 1;
  for (const { r } of list) {
    let acc = 0, next = Math.min(70 + (out.length * 37) % 60, L(r) / 2);
    for (let i = 1; i < r.pts.length && out.length < max; i++) {
      const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], d = Math.hypot(x1 - x0, z1 - z0); if (d < 1e-6) continue;
      while (acc + d >= next && out.length < max) {
        const f = (next - acc) / d, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, dx = (x1 - x0) / d, dz = (z1 - z0) / d, nx = -dz * side, nz = dx * side, off = (r.w || 12) / 2 + 3;
        const p = { x: x + nx * off, z: z + nz * off, ry: Math.atan2(dx * side, dz * side) + side * 0.35 };   // лицето — срещу идващите коли, леко към платното
        if (!out.some(q => Math.hypot(q.x - p.x, q.z - p.z) < gap * 0.6)) { out.push(p); side = -side; }
        next += gap;
      }
      acc += d;
    }
    if (out.length >= max) break;
  }
  return out;
}

export function buildBillboards(group, o = {}) {
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
