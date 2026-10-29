// officestyle.js — облик на офиса-кула (от ниво 7 на офиса): избираш небостъргача за централата/филиала си.
// Моделите от пакета (Kenney; @N = на N етажа), процедурните кули от landmarks.js (Сапфир, Туист, Близнаци) или истински от Sketchfab (sf).
import * as THREE from 'three';
import { buildLandmark } from './landmarks.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepNightFloors } from './nightfloors.js';
import { feature } from './lab/feature.js';
import { canvasTex } from './texdata.js';
// 🏢 office-styles2 (потребителят: „Сапфир, Туист, Близнаци — много тънки“): процедурните кули за офиса — свои, с пропорции ~6:1, фасада с истинска решетка
// етажи × оси (рамки и стъкло), нощем светят прозорците по същата решетка (~45 %, топло / бяло / синкаво — телевизор), коронката и шпилът светят. Истанбулските забележителности — непроменени
const OS2 = feature('office-styles2');
let seedN = 11; const rnd = () => (seedN = (seedN * 16807) % 2147483647) / 2147483647;
function facade(cols, rows, glass, frame, band) {   // → { map, em } — цялата фасада (cols оси × rows етажа) в едно платно
  const cw = 16, rh = 20, W = cols * cw, H = rows * rh, a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = W; a.height = b.height = H;
  const g = a.getContext('2d'), e = b.getContext('2d'); g.fillStyle = frame; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) { g.fillStyle = band; g.fillRect(0, r * rh, W, 4);   // плочата между етажите
    for (let c = 0; c < cols; c++) { const x = c * cw + 2, y = r * rh + 5, w = cw - 4, h = rh - 7; g.fillStyle = glass; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, w, 3);
      g.fillStyle = frame; g.fillRect(x + w / 2 - 0.5, y, 1, h);   // мулионът
      const q = rnd(); if (q < 0.45) { const t = rnd(); e.fillStyle = t < 0.45 ? '#ffb15a' : t < 0.78 ? '#ffd28f' : t < 0.92 ? '#f4ead8' : '#7d9cff'; e.globalAlpha = 0.65 + rnd() * 0.35; e.fillRect(x + 1, y + 1, w - 2, h - 2); e.globalAlpha = 1;
        if (rnd() < 0.3) { e.fillStyle = 'rgba(0,0,0,0.45)'; e.fillRect(x + 1, y + 1, (w - 2) * (0.3 + rnd() * 0.4), h - 2); } } } }   // пердета
  const map = canvasTex(a), em = canvasTex(b); map.colorSpace = em.colorSpace = THREE.SRGBColorSpace; map.anisotropy = em.anisotropy = 4; return { map, em };
}
const M = (c, r = 0.6, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
const fmat = f => M(0xffffff, 0.25, 0.4, { map: f.map, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: 0 });
const bx = (g, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
// всяка кула: основа 14 × 14 (вписва се в двора), височината ~6 × ширината на кулата; lit — коронки (светят нощем), glass — фасадите, blink — червената лампа
function o2Sapphire() {
  const g = new THREE.Group(), lit = [], glass = [], blink = [];
  bx(g, 14, 0.3, 14, M(0x9aa0a6, 0.9), 0, 0.15, 0); bx(g, 13, 5, 13, M(0x26303b, 0.35, 0.5), 0, 2.8, 0);   // подиумът
  const H = 60, f = fmat(facade(12, 18, '#2c4a66', '#c9d4dd', '#8d99a4')); glass.push(f);
  const shape = new THREE.Shape(); shape.moveTo(-5.4, -4.2); shape.lineTo(5.4, -4.2); shape.lineTo(4.2, 4.6); shape.lineTo(-4.2, 4.6); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false }); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i) + 10) / 20 * 2, pos.getY(i) / H);
  const t = new THREE.Mesh(geo, f); t.position.y = 5.3; g.add(t);
  const crown = M(0x9fb7c9, 0.2, 0.7, { emissive: 0x9fd4ff, emissiveIntensity: 0 }); lit.push(crown);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 5.6, 8, 4), crown); cap.position.set(0, 5.3 + H + 4, 0.2); cap.rotation.y = Math.PI / 4; cap.scale.z = 0.85; g.add(cap);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 10, 8), M(0xdde3e8, 0.3, 0.8)); sp.position.set(0, 5.3 + H + 13, 0.2); g.add(sp);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), M(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 })); tip.position.set(0, 5.3 + H + 18.3, 0.2); g.add(tip); blink.push(tip.material);
  return { g, lit, glass, blink };
}
function o2Twist() {
  const g = new THREE.Group(), lit = [], glass = [], blink = [], N = 20, fh = 3.1, f = facade(10, N, '#2f6a70', '#e4ecec', '#b7c3c3'), gm = fmat(f), slab = M(0xf0f2f3, 0.6); glass.push(gm);
  bx(g, 14, 0.3, 14, M(0x9aa0a6, 0.9), 0, 0.15, 0);
  for (let k = 0; k < N; k++) { const fl = new THREE.Group(); fl.position.y = 0.3 + k * fh; fl.rotation.y = k * 0.045; g.add(fl);
    const w = 10.4 - Math.abs(k - N * 0.45) * 0.05, geo = new THREE.BoxGeometry(w, fh - 0.4, w * 0.8), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (k + uv.getY(i)) / N);   // этажът — свой ред от фасадата
    const m = new THREE.Mesh(geo, gm); m.position.y = (fh - 0.4) / 2; fl.add(m); bx(fl, w + 0.5, 0.4, w * 0.8 + 0.5, slab, 0, fh - 0.2, 0); }
  const crown = M(0xdde3e8, 0.3, 0.6, { emissive: 0x8fe8ff, emissiveIntensity: 0 }); lit.push(crown);
  const cr = new THREE.Group(); cr.position.y = 0.3 + N * fh; cr.rotation.y = N * 0.045; g.add(cr); bx(cr, 8, 1.2, 6.4, crown, 0, 0.6, 0); bx(cr, 6, 3.5, 4.8, M(0xcfd6db, 0.3, 0.7), 0, 2.9, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), M(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 })); tip.position.y = 5.2; cr.add(tip); blink.push(tip.material);
  return { g, lit, glass, blink };
}
function o2Twin() {
  const g = new THREE.Group(), lit = [], glass = [], blink = [], steel = M(0xbfc8d0, 0.3, 0.8), crown = M(0xd6dde3, 0.3, 0.7, { emissive: 0xfff0c0, emissiveIntensity: 0 }); lit.push(crown);
  bx(g, 14, 0.3, 14, M(0x9aa0a6, 0.9), 0, 0.15, 0); bx(g, 13.4, 5, 7.4, M(0x26303b, 0.4, 0.5), 0, 2.8, 0);   // общият подиум
  for (const [x, h, sd] of [[-3.5, 48, 21], [3.5, 41, 37]]) { seedN = sd; const f = fmat(facade(6, Math.round(h / 3.2), '#3d5370', '#cfd6dd', '#99a4ae')); glass.push(f);
    bx(g, 6, h, 6.6, f, x, 5.3 + h / 2, 0); bx(g, 6.4, 1, 7, steel, x, 5.3 + h + 0.5, 0);
    const c = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6, 4), crown); c.position.set(x, 5.3 + h + 4, 0); c.rotation.y = Math.PI / 4; g.add(c);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M(0xff3030, 0.4, 0, { emissive: 0xff2020, emissiveIntensity: 0 })); tip.position.set(x, 5.3 + h + 7.3, 0); g.add(tip); blink.push(tip.material); }
  bx(g, 1.2, 3.2, 3.4, M(0x8aa0b4, 0.2, 0.6, { emissive: 0xffd9a0, emissiveIntensity: 0 }), 0, 30, 0).material.userData.bridge = 1;   // скай-мостът
  lit.push(g.children[g.children.length - 1].material);
  return { g, lit, glass, blink };
}
const O2B = { sapphire: o2Sapphire, twist: o2Twist, twin: o2Twin };
function office2(kind) { seedN = 11 + kind.length * 7; const o = O2B[kind](); o.g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { group: o.g, update(t, night = 0) { for (const m of o.glass) m.emissiveIntensity = 0.02 + 1.25 * night; for (const m of o.lit) m.emissiveIntensity = 0.08 + 1.8 * night; for (const m of o.blink) m.emissiveIntensity = (Math.sin(t * 3) > 0.5 ? 2 : 0.2) * (0.3 + night); } }; }
// истински небостъргачи от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“) — зареждат се при първо ползване
const SKY = {}, skyLoad = {};
const loadSky = k => skyLoad[k] || (skyLoad[k] = new Promise(res => new GLTFLoader().load(`assets/heavy/sky/${k}.glb`, g => { prepNightFloors(g.scene, 'sf-sky-' + k); SKY[k] = g.scene; res(g.scene); }, undefined, () => res(null))));   // нощем — като същите небостъргачи в града (nightfloors.js)

export const STYLE_LV = 7, STYLE_COST = 50000;
export const OFFICE_STYLES = [
  { id: 'std', ico: '🏢', nm: 'Стандартна', ds: 'Сградата според нивото на офиса' },
  { id: 'a', ico: '🏙️', nm: 'Класическа', model: 'building-skyscraper-a', ds: 'Кула на 20 етажа' },
  { id: 'b', ico: '🌆', nm: 'Тъмна', model: 'building-skyscraper-b', ds: 'Кула на 20 етажа' },
  { id: 'c', ico: '🏢', nm: 'Стъклена', model: 'building-skyscraper-c', ds: 'Кула на 20 етажа' },
  { id: 'd', ico: '🌃', nm: 'Модерна 25', model: 'building-skyscraper-d@25', ds: 'Модерна кула на 25 етажа' },
  { id: 'e', ico: '🌇', nm: 'Модерна 30', model: 'building-skyscraper-e@30', ds: 'Модерна кула на 30 етажа' },
  { id: 'sapphire', ico: '💎', nm: 'Сапфир', lm: 'sapphire', ds: 'Стъклена призма с шпил (като Истанбул Сапфир)' },
  { id: 'twist', ico: '🌀', nm: 'Туист', lm: 'twist', ds: 'Извита кула — всеки етаж е завъртян' },
  { id: 'twin', ico: '🏛️', nm: 'Близнаци', lm: 'twin', ds: 'Две кули с мост между тях' },
  { id: 'sing', ico: '🌃', nm: 'Сингапур', sf: 'sing', ds: 'Тъмна офис кула с червен венец' },
  { id: 'rand', ico: '🏛️', nm: 'Арт деко', sf: 'rand', ds: 'Каменна кула в стил арт деко (като Rand Tower)' },
  { id: 'usb', ico: '🗼', nm: 'Кръгла кула', sf: 'usb', ds: 'Стъклена цилиндрична кула с корона' },
  { id: 'blue', ico: '💠', nm: 'Синьо стъкло', sf: 'blue', ds: 'Модерна извита кула от синьо стъкло с шпил' },
  { id: 'night', ico: '🌙', nm: 'Нощна кула', sf: 'night', ds: 'Тъмна кула със светещи прозорци' },
];
// style → { group, update(t, night) }; width — ширината на офиса в двора на централата
export function buildOfficeTower(style, deps, width) {
  if (style.sf) {   // истински модел: основата се вписва в двора на офиса, височината — по пропорциите му
    const wrap = new THREE.Group();
    const put = src => { if (!src) return; const o = src.clone(true), g = new THREE.Group(); g.add(o); g.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(g), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      o.position.set(-c.x, -bb.min.y, -c.z); const fit = (width + 1.5) / Math.max(sz.x, sz.z); g.scale.setScalar(Math.min(fit * 1.15, Math.max(fit, 48 / sz.y)));   // поне ~48 м висока (основата до 1.15× по-широка — не застъпва гаража)
      g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); wrap.add(g); };
    // невидим отпечатък с размера на основата — за да може game.js да центрира кулата още преди моделът да се зареди
    const foot = new THREE.Mesh(new THREE.BoxGeometry(width + 1.5, 0.01, width + 1.5)); foot.visible = false; wrap.add(foot);
    if (SKY[style.sf]) put(SKY[style.sf]); else loadSky(style.sf).then(put);
    return { group: wrap, update: null };
  }
  if (style.lm) {
    const o = OS2 && O2B[style.lm] ? office2(style.lm) : buildLandmark(style.lm);
    const bb = new THREE.Box3().setFromObject(o.group), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const wrap = new THREE.Group(); o.group.scale.setScalar((width + 1.5) / w); wrap.add(o.group);
    wrap.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { group: wrap, update: o.update };
  }
  const isQ = style.model.startsWith('Building_');
  return { group: deps.model(style.model, deps.fitScale(style.model, isQ ? width + 1.5 : width)), update: null };
}
