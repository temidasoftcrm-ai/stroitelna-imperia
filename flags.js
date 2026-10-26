// flags.js — 🏳️ flags (f9): знамената на държавата по площада и обществените сгради (по cc на града).
// Знамето се рисува върху canvas по таблица (ивици, кръстове, кръг…; емоджито на Windows не се рисува); непознатите — с емоджито.
// Платът се вее във vertex шейдъра (общо време). flagPole(cc, h) → Group (стълб + плат); flagTex(cc) → CanvasTexture; flagsTick(t)
import * as THREE from 'three';

const iso = cc => [...(cc || '🇧🇬')].map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 65)).join('');
// h — хоризонтални ивици отгоре надолу; v — вертикални отляво надясно; n — скандинавски кръст [фон, кръст, вътрешен]; другите — свои
const F = {
  BG: ['h', '#fff', '#00966e', '#d62612'], RO: ['v', '#002b7f', '#fcd116', '#ce1126'], RS: ['h', '#c6363c', '#0c4076', '#fff'], MK: ['mk'], GR: ['gr'], TR: ['tr'],
  IT: ['v', '#009246', '#fff', '#ce2b37'], FR: ['v', '#0055a4', '#fff', '#ef4135'], DE: ['h', '#000', '#dd0000', '#ffce00'], AT: ['h', '#ed2939', '#fff', '#ed2939'], HU: ['h', '#ce2939', '#fff', '#477050'],
  PL: ['h', '#fff', '#dc143c'], CZ: ['cz'], SK: ['h', '#fff', '#0b4ea2', '#ee1c25'], NL: ['h', '#ae1c28', '#fff', '#21468b'], BE: ['v', '#000', '#fae042', '#ed2939'], LU: ['h', '#ef3340', '#fff', '#00a3e0'],
  ES: ['es'], PT: ['pt'], IE: ['v', '#169b62', '#fff', '#ff883e'], GB: ['gb'], CH: ['ch'], SE: ['n', '#006aa7', '#fecc00'], NO: ['n', '#ba0c2f', '#fff', '#00205b'], DK: ['n', '#c8102e', '#fff'], FI: ['n', '#fff', '#002f6c'],
  EE: ['h', '#0072ce', '#000', '#fff'], LV: ['h', '#9e3039', '#fff', '#9e3039'], LT: ['h', '#fdb913', '#006a44', '#c1272d'], UA: ['h', '#0057b7', '#ffd700'], RU: ['h', '#fff', '#0039a6', '#d52b1e'], BY: ['h', '#c8313e', '#c8313e', '#4aa657'],
  MD: ['v', '#003da5', '#ffd100', '#cc092f'], HR: ['h', '#ff0000', '#fff', '#171796'], SI: ['h', '#fff', '#005ce5', '#ed1c24'], BA: ['h', '#002395', '#fecb00', '#002395'], ME: ['h', '#c40308', '#d4af3a', '#c40308'], AL: ['h', '#e41e20', '#e41e20'],
  US: ['us'], CA: ['ca'], MX: ['v', '#006847', '#fff', '#ce1126'], BR: ['br'], AR: ['h', '#74acdf', '#fff', '#74acdf'], CL: ['cl'], CO: ['h', '#fcd116', '#fcd116', '#003893', '#ce1126'], PE: ['v', '#d91023', '#fff', '#d91023'], VE: ['h', '#ffcc00', '#00247d', '#cf142b'],
  JP: ['jp'], CN: ['cn'], KR: ['kr'], IN: ['h', '#ff9933', '#fff', '#138808'], TH: ['h', '#a51931', '#f4f5f8', '#2d2a4a', '#2d2a4a', '#f4f5f8', '#a51931'], VN: ['vn'], ID: ['h', '#ce1126', '#fff'], MY: ['h', '#cc0001', '#fff', '#cc0001', '#fff', '#cc0001', '#fff'], PH: ['h', '#0038a8', '#ce1126'], SG: ['h', '#ef3340', '#fff'],
  AE: ['ae'], SA: ['h', '#006c35'], QA: ['v', '#fff', '#8d1b3d', '#8d1b3d'], EG: ['h', '#ce1126', '#fff', '#000'], MA: ['h', '#c1272d'], TN: ['h', '#e70013'], DZ: ['v', '#006633', '#fff'], NG: ['v', '#008751', '#fff', '#008751'], KE: ['h', '#000', '#bb0000', '#006600'], ZA: ['h', '#e03c31', '#fff', '#001489'],
  ET: ['h', '#078930', '#fcdd09', '#da121a'], GH: ['h', '#ce1126', '#fcd116', '#006b3f'], SN: ['v', '#00853f', '#fdef42', '#e31b23'], AU: ['au'], NZ: ['au'], CU: ['h', '#002a8f', '#fff', '#002a8f', '#fff', '#002a8f'], IL: ['h', '#fff', '#0038b8', '#fff'], IR: ['h', '#239f40', '#fff', '#da0000'],
  UZ: ['h', '#0099b5', '#fff', '#1eb53a'], KZ: ['h', '#00afca'], PK: ['v', '#fff', '#01411c', '#01411c', '#01411c'], BD: ['jp', '#006a4e', '#f42a41'], MM: ['h', '#fecb00', '#34b233', '#ea2839'], AO: ['h', '#cc092f', '#000'], CD: ['h', '#007fff'], TZ: ['h', '#1eb53a', '#00a3dd'], UG: ['h', '#000', '#fcdc04', '#d90000', '#000', '#fcdc04', '#d90000'], ZM: ['h', '#198a00'], ZW: ['h', '#319208', '#ffd200', '#de2010', '#000', '#de2010', '#ffd200', '#319208'],
};
const EU = new Set(['BG', 'RO', 'GR', 'IT', 'FR', 'DE', 'AT', 'HU', 'PL', 'CZ', 'SK', 'NL', 'BE', 'LU', 'ES', 'PT', 'IE', 'SE', 'DK', 'FI', 'EE', 'LV', 'LT', 'HR', 'SI', 'CY', 'MT']);
export const inEU = cc => EU.has(iso(cc));
function draw(g, W, H, code) {
  const s = F[code], R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, circ = (c, x, y, r) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const star = (c, x, y, r) => { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.4 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
  if (!s) return false;
  const [t, ...c] = s;
  if (t === 'h') { c.forEach((col, i) => R(col, 0, i * H / c.length, W, H / c.length + 1)); return true; }
  if (t === 'v') { c.forEach((col, i) => R(col, i * W / c.length, 0, W / c.length + 1, H)); return true; }
  if (t === 'n') { R(c[0], 0, 0, W, H); const cx = W * 0.36, k = H * 0.2; R(c[1], cx - k / 2, 0, k, H); R(c[1], 0, H / 2 - k / 2, W, k); if (c[2]) { const k2 = k * 0.5; R(c[2], cx - k2 / 2, 0, k2, H); R(c[2], 0, H / 2 - k2 / 2, W, k2); } return true; }
  switch (t) {
    case 'gb': R('#012169', 0, 0, W, H); g.strokeStyle = '#fff'; g.lineWidth = H * 0.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H); g.moveTo(W, 0); g.lineTo(0, H); g.stroke(); g.strokeStyle = '#c8102e'; g.lineWidth = H * 0.07; g.stroke(); R('#fff', W / 2 - H * 0.17, 0, H * 0.34, H); R('#fff', 0, H * 0.33, W, H * 0.34); R('#c8102e', W / 2 - H * 0.1, 0, H * 0.2, H); R('#c8102e', 0, H * 0.4, W, H * 0.2); return true;
    case 'us': for (let i = 0; i < 13; i++) R(i % 2 ? '#fff' : '#b22234', 0, i * H / 13, W, H / 13 + 1); R('#3c3b6e', 0, 0, W * 0.4, H * 7 / 13); for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) circ('#fff', W * 0.03 + j * W * 0.064, H * 0.05 + i * H * 0.1, H * 0.018); return true;
    case 'ch': R('#da291c', 0, 0, W, H); R('#fff', W / 2 - H * 0.08, H * 0.2, H * 0.16, H * 0.6); R('#fff', W / 2 - H * 0.3, H / 2 - H * 0.08, H * 0.6, H * 0.16); return true;
    case 'jp': R(c[0] || '#fff', 0, 0, W, H); circ(c[1] || '#bc002d', W / 2, H / 2, H * 0.3); return true;
    case 'cn': R('#de2910', 0, 0, W, H); star('#ffde00', W * 0.17, H * 0.27, H * 0.15); for (const [x, y] of [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]]) star('#ffde00', W * x, H * y, H * 0.05); return true;
    case 'vn': R('#da251d', 0, 0, W, H); star('#ffff00', W / 2, H / 2, H * 0.3); return true;
    case 'tr': R('#e30a17', 0, 0, W, H); circ('#fff', W * 0.38, H / 2, H * 0.25); circ('#e30a17', W * 0.42, H / 2, H * 0.2); star('#fff', W * 0.56, H / 2, H * 0.12); return true;
    case 'kr': R('#fff', 0, 0, W, H); circ('#cd2e3a', W / 2, H * 0.45, H * 0.2); circ('#0047a0', W / 2, H * 0.58, H * 0.14); return true;
    case 'gr': for (let i = 0; i < 9; i++) R(i % 2 ? '#fff' : '#0d5eaf', 0, i * H / 9, W, H / 9 + 1); R('#0d5eaf', 0, 0, H * 5 / 9, H * 5 / 9); R('#fff', H * 2 / 9, 0, H / 9, H * 5 / 9); R('#fff', 0, H * 2 / 9, H * 5 / 9, H / 9); return true;
    case 'cz': R('#fff', 0, 0, W, H / 2); R('#d7141a', 0, H / 2, W, H / 2); g.fillStyle = '#11457e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.5, H / 2); g.lineTo(0, H); g.fill(); return true;
    case 'es': R('#aa151b', 0, 0, W, H); R('#f1bf00', 0, H / 4, W, H / 2); return true;
    case 'pt': R('#006600', 0, 0, W * 0.4, H); R('#ff0000', W * 0.4, 0, W * 0.6, H); circ('#ffcc00', W * 0.4, H / 2, H * 0.2); return true;
    case 'mk': R('#d20000', 0, 0, W, H); circ('#ffe600', W / 2, H / 2, H * 0.18); g.strokeStyle = '#ffe600'; g.lineWidth = H * 0.08; g.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * W); } g.stroke(); return true;
    case 'ca': R('#d52b1e', 0, 0, W, H); R('#fff', W * 0.25, 0, W * 0.5, H); star('#d52b1e', W / 2, H / 2, H * 0.25); return true;
    case 'br': R('#009c3b', 0, 0, W, H); g.fillStyle = '#ffdf00'; g.beginPath(); g.moveTo(W / 2, H * 0.1); g.lineTo(W * 0.92, H / 2); g.lineTo(W / 2, H * 0.9); g.lineTo(W * 0.08, H / 2); g.fill(); circ('#002776', W / 2, H / 2, H * 0.22); return true;
    case 'cl': R('#fff', 0, 0, W, H / 2); R('#d52b1e', 0, H / 2, W, H / 2); R('#0039a6', 0, 0, W / 3, H / 2); star('#fff', W / 6, H / 4, H * 0.12); return true;
    case 'ae': R('#00732f', 0, 0, W, H / 3); R('#fff', 0, H / 3, W, H / 3); R('#000', 0, H * 2 / 3, W, H / 3); R('#ff0000', 0, 0, W / 4, H); return true;
    case 'au': R('#012169', 0, 0, W, H); star('#fff', W * 0.25, H * 0.72, H * 0.12); for (const [x, y] of [[0.75, 0.25], [0.65, 0.5], [0.85, 0.45], [0.75, 0.82]]) star(code === 'NZ' ? '#cc142b' : '#fff', W * x, H * y, H * 0.06); R('#fff', 0, H * 0.2, W / 2, H * 0.1); R('#fff', W * 0.2, 0, W * 0.1, H / 2); R('#c8102e', 0, H * 0.22, W / 2, H * 0.06); R('#c8102e', W * 0.22, 0, W * 0.06, H / 2); return true;
  }
  return false;
}
const texCache = new Map();
export function flagTex(cc, eu = false) {
  const k = eu ? 'EU' : iso(cc); if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = 192; c.height = 128; const g = c.getContext('2d');
  if (eu) { g.fillStyle = '#003399'; g.fillRect(0, 0, 192, 128); g.fillStyle = '#ffcc00'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = 96 + Math.cos(a) * 36, y = 64 + Math.sin(a) * 36; g.beginPath(); for (let q = 0; q < 10; q++) { const b = -Math.PI / 2 + q * Math.PI / 5, r = q % 2 ? 2.4 : 6; g.lineTo(x + Math.cos(b) * r, y + Math.sin(b) * r); } g.fill(); } }
  else if (!draw(g, 192, 128, k)) { g.fillStyle = '#eee'; g.fillRect(0, 0, 192, 128); g.font = '110px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cc, 96, 70); }   // непознато — емоджито (на Windows — буквите)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(k, t); return t;
}
// веещият се плат: изместване по z според разстоянието от стълба (x) и времето
const T = { value: 0 }, clothGeo = new THREE.PlaneGeometry(1, 0.66, 12, 4).translate(0.5, 0, 0);
function clothMat(tex) {
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
  m.onBeforeCompile = sh => { sh.uniforms.fT = T; sh.vertexShader = 'uniform float fT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float fw = position.x; transformed.z += sin(fw * 5.0 - fT * 4.0 + position.y * 1.5) * 0.09 * fw; transformed.y -= 0.04 * fw * fw;'); };
  m.customProgramCacheKey = () => 'flagcloth'; return m;
}
const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8dadd, metalness: 0.6, roughness: 0.35 }), poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 1, 8).translate(0, 0.5, 0);
// стълб h м със знамето (eu — европейското) на върха; size — дължината на плата
export function flagPole(cc, h = 8, size = 1.8, eu = false) {
  const g = new THREE.Group(); const p = new THREE.Mesh(poleGeo, poleMat); p.scale.y = h; p.castShadow = true; g.add(p);
  const cl = new THREE.Mesh(clothGeo, clothMat(flagTex(cc, eu))); cl.scale.setScalar(size); cl.position.set(0.05, h - size * 0.33 - 0.15, 0); g.add(cl); g.userData.cloth = cl; return g;
}
export const flagsTick = t => { T.value = t; };
