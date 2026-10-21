// hwsigns.js — 🛣️ порталите с табели над магистралата („Highway Sign“, haleem, Sketchfab, CC BY — assets/heavy/highway/CREDITS.txt).
// Табелите на модела (материалите Mat_1/2/3) се рисуват наново на канава: посоки, изход и разстояние на български, отдолу — на латиница
// (както по нашите магистрали: зелен фон, бели букви, номер на магистралата в зелено каре).
// gantrySigns(scene, roadW) — roadW: ширината на платното на едната посока (порталът е над едно платно, ~16 м в оригинала) → { root, set({ a, b, exit, km, road } | { debug }), setNight(k), dispose() }
//   scene — сцената на модела (клонира се); порталът се завърта напречно на оста z и се мащабира по ширината на пътя roadW (м).
import * as THREE from 'three';

const LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya' };
// обтекаемата система (закон за транслитерацията): София → Sofia, Пловдив → Plovdiv
export const latin = s => { const t = [...s].map(ch => { const l = ch.toLowerCase(), r = LAT[l]; if (r == null) return ch; return ch === l ? r : r[0].toUpperCase() + r.slice(1); }).join(''); return t.replace(/iya\b/g, 'ia'); };
const GREEN = '#00703c';

function arrow(g, x, y, s, dir) {   // dir: 'down' (лентата под табелата), 'upright' (изход надясно)
  g.save(); g.translate(x, y); if (dir === 'upright') g.rotate(Math.PI / 4); else if (dir === 'down') g.rotate(Math.PI);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.6, -s * 0.25); g.lineTo(s * 0.2, -s * 0.25); g.lineTo(s * 0.2, s); g.lineTo(-s * 0.2, s); g.lineTo(-s * 0.2, -s * 0.25); g.lineTo(-s * 0.6, -s * 0.25); g.closePath(); g.fill(); g.restore();
}
function frame(g, W, H) { g.fillStyle = GREEN; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = Math.max(6, W * 0.012); const m = g.lineWidth * 1.4; g.beginPath(); g.roundRect(m, m, W - 2 * m, H - 2 * m, m * 1.5); g.stroke(); }
function fit(g, txt, size, weight, maxW) { g.font = `${weight} ${size}px "Roboto Condensed", "Arial Narrow", system-ui, sans-serif`; const w = g.measureText(txt).width; if (w > maxW) g.font = `${weight} ${Math.floor(size * maxW / w)}px "Roboto Condensed", "Arial Narrow", system-ui, sans-serif`; }
const kmTxt = km => km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;

// една табела: k — коя (0 — голямата: посоката; 1 — изходът; 2 — градът/центърът), W×H — пропорциите на оригиналната текстура
function draw(k, s, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.textBaseline = 'middle';
  if (s.debug) { g.fillStyle = ['#c33', '#3a3', '#33c'][k]; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `bold ${H * 0.18}px sans-serif`; g.fillText(`Mat_${k + 1} ГОРЕ-ЛЯВО`, W * 0.04, H * 0.15); g.fillText(`${W}×${H}`, W * 0.04, H * 0.5); arrow(g, W * 0.8, H * 0.6, H * 0.25, 'up'); return c; }
  frame(g, W, H); g.fillStyle = '#fff';
  if (k === 0) {   // посоката: номерът на магистралата, градът, латиница, стрелка надолу към лентите
    const sh = H * 0.26; g.fillStyle = '#fff'; g.fillRect(W * 0.06, H * 0.12, sh * 1.5, sh); g.fillStyle = GREEN; g.fillRect(W * 0.06 + 5, H * 0.12 + 5, sh * 1.5 - 10, sh - 10);
    g.fillStyle = '#fff'; g.textAlign = 'center'; fit(g, s.road || 'А1', sh * 0.62, 800, sh * 1.3); g.fillText(s.road || 'А1', W * 0.06 + sh * 0.75, H * 0.12 + sh / 2);
    g.textAlign = 'left'; fit(g, s.b, H * 0.24, 800, W * 0.62); g.fillText(s.b, W * 0.06, H * 0.56); fit(g, latin(s.b), H * 0.14, 600, W * 0.62); g.fillText(latin(s.b), W * 0.06, H * 0.76);
    arrow(g, W * 0.84, H * 0.52, H * 0.26, 'down');
  } else if (k === 1) {   // изходът: „Изход“, мястото, разстоянието, стрелка надясно-нагоре
    g.textAlign = 'center'; fit(g, 'ИЗХОД', H * 0.13, 700, W * 0.8); g.fillText('ИЗХОД', W / 2, H * 0.16);
    fit(g, s.exit, H * 0.17, 800, W * 0.84); g.fillText(s.exit, W / 2, H * 0.36); fit(g, latin(s.exit), H * 0.1, 600, W * 0.84); g.fillText(latin(s.exit), W / 2, H * 0.5);
    fit(g, kmTxt(s.km), H * 0.14, 800, W * 0.5); g.fillText(kmTxt(s.km), W * 0.32, H * 0.76); arrow(g, W * 0.72, H * 0.74, H * 0.15, 'upright');
  } else {   // градът, през който минава магистралата: „Център“ на града
    g.textAlign = 'center'; fit(g, s.a, H * 0.17, 800, W * 0.84); g.fillText(s.a, W / 2, H * 0.22); fit(g, latin(s.a), H * 0.1, 600, W * 0.84); g.fillText(latin(s.a), W / 2, H * 0.37);
    fit(g, 'Център', H * 0.13, 700, W * 0.84); g.fillText('Център', W / 2, H * 0.55); fit(g, 'Centre', H * 0.09, 600, W * 0.84); g.fillText('Centre', W / 2, H * 0.67);
    arrow(g, W / 2, H * 0.84, H * 0.1, 'down');
  }
  return c;
}

// лицето на табелата: правоъгълникът на лицата към пътя (нормала по z) и накъде гледа (там, където лицата са повече — табелата + кутията отпред)
function faceOf(o, mi) {
  const G = o.geometry, P = G.attributes.position, I = G.index, grp = mi < 0 ? [{ start: 0, count: I ? I.count : P.count }] : G.groups.filter(q => q.materialIndex === mi);
  const bb = new THREE.Box3(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), nrm = new THREE.Vector3(); let pos = 0, neg = 0;
  for (const q of grp) for (let j = q.start; j + 2 < q.start + q.count; j += 3) {
    const ns = [0, 1, 2].map(t => I ? I.getX(j + t) : j + t); A.fromBufferAttribute(P, ns[0]).applyMatrix4(o.matrixWorld); B.fromBufferAttribute(P, ns[1]).applyMatrix4(o.matrixWorld); C.fromBufferAttribute(P, ns[2]).applyMatrix4(o.matrixWorld);
    nrm.subVectors(B, A).cross(C.clone().sub(A)); const ar = nrm.length() / 2; nrm.normalize(); if (Math.abs(nrm.z) < 0.9) continue;
    if (nrm.z > 0) pos += ar; else neg += ar; bb.expandByPoint(A).expandByPoint(B).expandByPoint(C);
  }
  const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), dir = pos >= neg ? 1 : -1;
  return { fw: sz.x, fh: sz.y, c, dir, zf: dir > 0 ? bb.max.z : bb.min.z };
}
export function gantrySigns(scene, roadW = 26) {
  const root = new THREE.Group(), m = scene.clone(true); root.add(m);
  // плочата под модела (материал Mat.5) — не ни трябва: пътят е наш
  m.traverse(o => { if (!o.isMesh) return; if (Array.isArray(o.material)) o.material = o.material.map(mt => /^Mat\.5$/.test(mt.name) ? Object.assign(mt.clone(), { visible: false }) : mt); else if (/^Mat\.5$/.test(o.material.name)) o.visible = false; });
  const box = () => { root.updateMatrixWorld(true); const bb = new THREE.Box3(); m.traverse(o => { if (o.isMesh && o.visible) bb.expandByObject(o); }); return bb; };   // expandByObject минава и през невидимите групи — затова по мешове
  let b = box(); if (b.max.z - b.min.z > b.max.x - b.min.x) { m.rotation.y = Math.PI / 2; b = box(); }   // порталът — напречно на пътя (пътят е по z)
  const span = b.max.x - b.min.x, k = (roadW + 3) / span;
  m.scale.multiplyScalar(k); b = box();
  m.position.x -= (b.min.x + b.max.x) / 2; m.position.z -= (b.min.z + b.max.z) / 2; m.position.y -= b.min.y;
  root.updateMatrixWorld(true);
  const slots = [], own = [], planes = [], backMat = new THREE.MeshStandardMaterial({ color: 0x5d6a63, metalness: 0.4, roughness: 0.6 });   // кутията на табелата (гърбът и ръбовете) — метал
  m.traverse(o => { if (!o.isMesh) return; const arr = Array.isArray(o.material) ? o.material : [o.material];
    arr.forEach((mt, i) => { const r = /^Mat_([123])$/.exec(mt && mt.name || ''); if (!r) return; const mi = Array.isArray(o.material) ? i : -1;
      slots.push({ k: +r[1] - 1, ...faceOf(o, mi) });
      if (mi < 0) o.material = backMat; else { const a = o.material.slice(); a[mi] = backMat; o.material = a; } }); });
  const mats = [];
  const api = { root, slots: slots.length,
    set(s) {
      for (const x of own) x.dispose(); for (const q of planes) root.remove(q); own.length = 0; mats.length = 0; planes.length = 0;
      for (const sl of slots) {   // нашето платно — 3 см пред лицето на табелата от модела
        const H = 512, W = Math.round(H * Math.max(0.5, Math.min(4, sl.fw / Math.max(0.1, sl.fh)))), t = new THREE.CanvasTexture(draw(sl.k, s, W, H)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        const mt = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.04, roughness: 0.55 }), geo = new THREE.PlaneGeometry(sl.fw, sl.fh), pl = new THREE.Mesh(geo, mt);
        pl.position.set(sl.c.x, sl.c.y, sl.zf + sl.dir * 0.03); if (sl.dir < 0) pl.rotation.y = Math.PI; pl.receiveShadow = true; root.add(pl);
        own.push(t, mt, geo); mats.push(mt); planes.push(pl);
      }
      api.setNight(api.night || 0);
    },
    setNight(n = 0) { api.night = n; for (const mt of mats) mt.emissiveIntensity = 0.04 + 0.5 * n; },   // нощем — светлоотразителното фолио на фаровете (леко светене)
    dispose() { for (const x of own) x.dispose(); backMat.dispose(); root.parent && root.parent.remove(root); },
  };
  return api;
}
