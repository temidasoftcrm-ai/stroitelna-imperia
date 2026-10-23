// bgblocks.js — фоновите сгради на cityplan2-3d.js (romeBlocks), по-разнообразни и по-пълни:
//  • bg-variety (#42.11/#42.12): Париж и Истанбул — няколко фасади на стил (процедурни платна), оттенък на всяка инстанция, височина в цели етажи,
//    покриви (мансарда с капандури, цинк, плосък с бойлери, керемиди), по-тесни и по-широки сгради. Пак инстанции: по 2 меша на вид (фасада + покрив).
//  • bg-fill (#16): градовете по плана без истинска карта (Пловдив, София…) — чужди сгради по свободните парцели и във вътрешността на кварталите
//    (2-ри/3-ти ред зад улицата): панелни блокове (6–12 ет.), кооперации (3–5 ет.), къщи в покрайнините.
// Прозорците нощем светят както досега (nightWin — emissiveMap от тъмните петна на платното).
import * as THREE from 'three';
import { nightWin, tileByScale } from './cityplan2-3d.js';

const PX = 16;   // пиксела на метър в платната на фасадите
function paint(wm, hm, draw) { const c = document.createElement('canvas'); c.width = Math.round(wm * PX); c.height = Math.round(hm * PX); const g = c.getContext('2d'); g.scale(PX, PX); draw(g, wm, hm); return c; }
// фасада: платното е pw м широко (повтаря се по ширината на сградата); ph — височината на повторението (0 — цялата фасада, етажите са нарисувани)
function fmat(c, pw, ph, o = {}) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return tileByScale(nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: o.r || 0.9 }), c, { seed: o.seed || 31, rep: 1, thr: o.thr || 70, lit: o.lit || 0.25 }), pw, ph); }
const GLASS = '#262d36', IRON = '#55575a';   // стъклото е тъмно (< прага → прозорец, свети нощем), парапетите — над прага (не светят)
const win = (g, x, y, w, h, fr = '#efe9de', mull = true) => { g.fillStyle = fr; g.fillRect(x - 0.1, y - 0.1, w + 0.2, h + 0.2); g.fillStyle = GLASS; g.fillRect(x, y, w, h); if (mull) { g.fillStyle = fr; g.fillRect(x + w / 2 - 0.04, y, 0.08, h); g.fillRect(x, y + h * 0.33, w, 0.06); } };
const rail = (g, x, y, w, h, c = IRON, st = 0.16) => { g.fillStyle = c; g.fillRect(x, y, w, 0.07); g.fillRect(x, y + h - 0.05, w, 0.05); for (let k = x; k <= x + w; k += st) g.fillRect(k, y, 0.045, h); };

// ---- Париж: османова сграда — n етажа над партера (4,5 м), 3 оси по bay м; балкони по цялата фасада на етажите balc, иначе френски парапети
function haussC(n, bay, balc, awn, door = 1) { const W = 3 * bay, G0 = 4.5, FH = 3.1, H = G0 + n * FH;
  return [paint(W, H, g => {
    g.fillStyle = '#f6efe3'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(150,130,100,0.16)'; for (let y = 0.5; y < H - G0; y += 0.5) g.fillRect(0, y, W, 0.035);   // фугите на варовика
    for (let f = 1; f <= n; f++) { const yb = H - G0 - (f - 1) * FH, B = balc.includes(f);
      g.fillStyle = 'rgba(120,100,80,0.3)'; g.fillRect(0, yb - 0.14, W, 0.14);   // корнизът на етажа
      for (let k = 0; k < 3; k++) { const cx = (k + 0.5) * bay, ww = Math.min(1.3, bay * 0.44), wh = f === n ? 1.75 : B ? 2.45 : 2.15, wy = yb - (B ? 0.2 : 0.6) - wh;
        g.fillStyle = 'rgba(110,95,75,0.35)'; g.fillRect(cx - ww / 2 - 0.2, wy - 0.32, ww + 0.4, 0.16);   // корнизче над прозореца
        win(g, cx - ww / 2, wy, ww, wh); if (!B) rail(g, cx - ww / 2 - 0.12, wy + wh - 0.7, ww + 0.24, 0.62); }
      if (B) { g.fillStyle = 'rgba(80,70,60,0.4)'; g.fillRect(0, yb - 0.32, W, 0.2); rail(g, 0, yb - 1.25, W, 0.95); } }   // ковани балкони по цялата фасада (плочата хвърля сянка)
    g.fillStyle = '#e8dfcf'; g.fillRect(0, H - G0, W, G0); g.fillStyle = 'rgba(120,100,80,0.32)'; for (let y = H - G0 + 0.55; y < H; y += 0.55) g.fillRect(0, y, W, 0.06);   // партерът — рустика
    for (let k = 0; k < 3; k++) { const cx = (k + 0.5) * bay;
      if (k === door) { g.fillStyle = '#3a2c22'; g.fillRect(cx - 0.8, H - 3.3, 1.6, 3.3); g.fillStyle = '#e8dfcf'; g.beginPath(); g.arc(cx, H - 3.3, 0.8, Math.PI, 0); g.fill(); }   // портата
      else { g.fillStyle = '#2a3038'; g.fillRect(cx - bay * 0.38, H - 3.2, bay * 0.76, 3.2); g.fillStyle = awn; g.fillRect(cx - bay * 0.43, H - 3.65, bay * 0.86, 0.5); } }   // витрина с тента
    g.fillStyle = '#ddd3c0'; g.fillRect(0, 0, W, 0.35); }), W, H];
}
// предградие (faubourg): 4 етажа, мазилка, сиви кепенци; партерът — врата и прозорци
function faubC() { const W = 7.5, FH = 3, n = 4, H = 3.5 + n * FH;
  return [paint(W, H, g => { g.fillStyle = '#f3ece0'; g.fillRect(0, 0, W, H);
    for (let f = 1; f <= n; f++) { const yb = H - 3.5 - (f - 1) * FH; g.fillStyle = 'rgba(120,100,80,0.18)'; g.fillRect(0, yb - 0.1, W, 0.1);
      for (let k = 0; k < 3; k++) { const cx = (k + 0.5) * 2.5, ww = 0.95, wh = 1.75, wy = yb - 0.75 - wh; win(g, cx - ww / 2, wy, ww, wh); g.fillStyle = '#8a98a4'; g.fillRect(cx - ww / 2 - 0.55, wy, 0.45, wh); g.fillRect(cx + ww / 2 + 0.1, wy, 0.45, wh); } }   // кепенците
    g.fillStyle = '#e4dbcb'; g.fillRect(0, H - 3.5, W, 3.5); g.fillStyle = '#4a3b30'; g.fillRect(3.25, H - 2.6, 1, 2.6); g.fillStyle = GLASS; g.fillRect(0.6, H - 2.4, 1.5, 1.4); g.fillRect(5.4, H - 2.4, 1.5, 1.4); }), W, H];
}
// модерна (60-те–70-те): ленти прозорци и парапетни панели — едно повторение = 1 етаж
function bandC(base, glassH, frames, rib) { return paint(9, 3, g => { g.fillStyle = base; g.fillRect(0, 0, 9, 3); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 2.95, 9, 0.05);
  for (let k = 0; k < frames; k++) { const w = 9 / frames; win(g, k * w + 0.12, 0.35, w - 0.24, glassH, '#d9d6cf', false); }
  if (rib) { g.fillStyle = 'rgba(0,0,0,0.1)'; for (let x = 0; x < 9; x += 0.6) g.fillRect(x, 0.45 + glassH, 0.05, 2.5 - glassH); } }); }
// ---- мансардата: цинк със шевове, капандури (по една на 3 м) — u по дължината на покрива, v — нагоре по ската
function mansardC() { return paint(9, 4, g => { g.fillStyle = '#e4e8ec'; g.fillRect(0, 0, 9, 4); g.fillStyle = 'rgba(60,70,80,0.18)'; for (let x = 0; x < 9; x += 0.5) g.fillRect(x, 0, 0.04, 4);
  for (let k = 0; k < 3; k++) { const cx = 1.5 + k * 3; g.fillStyle = '#f2efe8'; g.fillRect(cx - 0.65, 1.0, 1.3, 2.1); g.beginPath(); g.moveTo(cx - 0.75, 1.05); g.lineTo(cx, 0.55); g.lineTo(cx + 0.75, 1.05); g.fill(); g.fillStyle = GLASS; g.fillRect(cx - 0.42, 1.3, 0.84, 1.4); g.fillStyle = '#f2efe8'; g.fillRect(cx - 0.03, 1.3, 0.06, 1.4); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 3.75, 9, 0.25); }); }   // улукът
function tileC() { return paint(4, 4, g => { g.fillStyle = '#efe4dc'; g.fillRect(0, 0, 4, 4); for (let y = 0, r = 0; y < 4; y += 0.32, r++) { g.fillStyle = 'rgba(70,30,20,0.28)'; g.fillRect(0, y, 4, 0.07); for (let x = (r % 2) * 0.13; x < 4; x += 0.26) g.fillRect(x, y, 0.03, 0.32); } }); }
// ---- Истанбул: османска дървена къща — каменен партер (3 м), n дървени етажа (2,9 м) с еркер (cumba) в средата
function ottoC(n) { const W = 8, G0 = 3, FH = 2.9, H = G0 + n * FH;
  return [paint(W, H, g => { g.fillStyle = '#f5ede1'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(90,65,40,0.22)'; for (let y = 0.2; y < H - G0; y += 0.24) g.fillRect(0, y, W, 0.035);   // дъските
    g.fillStyle = 'rgba(60,45,30,0.35)'; g.fillRect(1.75, 0.3, 4.5, H - G0 - 0.1); g.fillStyle = '#fbf7ef'; g.fillRect(1.9, 0.3, 4.2, H - G0 - 0.35);   // еркерът (по-светъл, със сянка отдолу)
    for (let f = 1; f <= n; f++) { const yb = H - G0 - (f - 1) * FH; for (const cx of [2.6, 4, 5.4]) win(g, cx - 0.45, yb - 2.35, 0.9, 1.55, '#ffffff'); for (const cx of [0.85, 7.15]) win(g, cx - 0.4, yb - 2.3, 0.8, 1.5, '#ffffff'); g.fillStyle = 'rgba(90,65,40,0.35)'; g.fillRect(0, yb - 0.08, W, 0.08); }
    g.fillStyle = '#d6cdbd'; g.fillRect(0, H - G0, W, G0); g.fillStyle = 'rgba(80,70,60,0.25)'; for (let y = H - G0 + 0.45; y < H; y += 0.45) g.fillRect(0, y, W, 0.05);   // каменният партер
    g.fillStyle = '#5a4230'; g.fillRect(3.4, H - 2.3, 1.2, 2.3); g.fillStyle = GLASS; g.fillRect(0.8, H - 2.1, 1, 1.1); g.fillRect(6.2, H - 2.1, 1, 1.1); rail(g, 0.8, H - 2.1, 1, 1.1, '#6a6a6a', 0.2); rail(g, 6.2, H - 2.1, 1, 1.1, '#6a6a6a', 0.2); }), W, H];
}
// жилищен блок с балкони (пастелни мазилки) — едно повторение = 1 етаж: прозорец, балкон с парапет и врата, климатик
function balcC() { return paint(9, 3, g => { g.fillStyle = '#f7f3ec'; g.fillRect(0, 0, 9, 3);
  win(g, 0.8, 0.7, 1.4, 1.35); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(3.4, 0.25, 4.8, 2.5); g.fillStyle = GLASS; g.fillRect(3.9, 0.4, 0.9, 2.15); g.fillRect(5.3, 0.7, 2.4, 1.35);   // нишата на балкона, вратата, прозорецът
  g.fillStyle = '#e9e6e0'; g.fillRect(3.2, 2.62, 5.2, 0.28); g.fillStyle = 'rgba(205,215,220,0.92)'; g.fillRect(3.25, 1.62, 5.1, 1.0); g.fillStyle = '#9aa0a4'; g.fillRect(3.25, 1.58, 5.1, 0.07);   // плочата и парапетът (матово стъкло)
  g.fillStyle = '#fafafa'; g.fillRect(1.0, 2.15, 0.8, 0.5); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(1.0, 2.6, 0.8, 0.05); }); }   // климатикът
// ---- България / Източна Европа (bg-fill): панелен блок (ЕПК) — 2 оси × 3,6 м на етаж (2,8 м): прозорец + лоджия; вариант — остъклени лоджии
function panelC(v) { return paint(7.2, 2.8, g => { g.fillStyle = '#efeee9'; g.fillRect(0, 0, 7.2, 2.8); g.fillStyle = 'rgba(60,60,60,0.28)'; g.fillRect(0, 2.75, 7.2, 0.05); g.fillRect(0, 0, 0.05, 2.8); g.fillRect(3.6, 0, 0.05, 2.8);   // фугите на панелите
  win(g, 1.05, 0.65, 1.5, 1.4, '#e6e4de');
  if (v) { g.fillStyle = '#dcdad4'; g.fillRect(3.75, 0.3, 3.3, 2.4); for (let k = 0; k < 3; k++) win(g, 3.9 + k * 1.05, 0.45, 0.85, 1.25, '#f2f0ea', false); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(3.75, 1.8, 3.3, 0.05); }   // остъклена лоджия
  else { g.fillStyle = 'rgba(0,0,0,0.42)'; g.fillRect(3.75, 0.2, 3.3, 1.65); g.fillStyle = GLASS; g.fillRect(4.1, 0.35, 0.85, 1.5); g.fillRect(5.3, 0.5, 1.4, 1.1); g.fillStyle = '#e2e0da'; g.fillRect(3.75, 1.85, 3.3, 0.9); g.fillStyle = 'rgba(0,0,0,0.1)'; for (let x = 3.9; x < 7; x += 0.3) g.fillRect(x, 1.9, 0.04, 0.8); } }); }   // лоджия: тъмна ниша и бетонен парапет с ребра
// кооперация (30-те–60-те): 2 прозореца и малък балкон на етаж (3 м), мазилка
function coopC() { return paint(7, 3, g => { g.fillStyle = '#f4efe6'; g.fillRect(0, 0, 7, 3); g.fillStyle = 'rgba(100,90,80,0.2)'; g.fillRect(0, 2.9, 7, 0.1);
  win(g, 0.9, 0.6, 1.2, 1.55); win(g, 4.9, 0.6, 1.2, 1.55); g.fillStyle = GLASS; g.fillRect(3, 0.45, 0.95, 2.2); g.fillStyle = '#e4ded4'; g.fillRect(2.45, 2.55, 2.05, 0.2); rail(g, 2.5, 1.65, 1.95, 0.9, '#5d5f62', 0.14); }); }
// къща (2 етажа, 10 × 6 м): врата, прозорци с рамки и кепенци
function houseC() { return paint(10, 6, g => { g.fillStyle = '#f6f1e8'; g.fillRect(0, 0, 10, 6); g.fillStyle = 'rgba(100,90,80,0.22)'; g.fillRect(0, 2.95, 10, 0.1); g.fillStyle = '#d8d0c2'; g.fillRect(0, 5.5, 10, 0.5);   // цокълът
  for (const cx of [1.8, 5, 8.2]) win(g, cx - 0.6, 0.8, 1.2, 1.3); for (const cx of [1.8, 8.2]) win(g, cx - 0.6, 3.6, 1.2, 1.3); g.fillStyle = '#6a4a34'; g.fillRect(4.45, 3.4, 1.1, 2.1); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(4.2, 3.25, 1.6, 0.12); }); }

// ---- покриви с UV (u — по дължината на сградата/било, v — нагоре по ската): мансарда (стръмни скатове и плосък връх) и на две води
function roofUV(V, F) { const pos = [], uv = []; for (const [ids, side] of F) { const tri = ids.length === 4 ? [ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]] : ids;
  for (const i of tri) { const p = V[i]; pos.push(...p); uv.push(side ? p[2] + 0.5 : 0.02, side ? p[1] : 0.5); } }   // челата и върхът — едно петно гладка ламарина (между шевовете, над улука)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; }
const MANS_V = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.3, 1, -0.5], [0.3, 1, -0.5], [0.3, 1, 0.5], [-0.3, 1, 0.5]];
const GAB_V = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [0, 1, -0.5], [0, 1, 0.5]];
const mansGeo = () => roofUV(MANS_V, [[[0, 3, 7, 4], 1], [[1, 5, 6, 2], 1], [[0, 4, 5, 1], 0], [[3, 2, 6, 7], 0], [[4, 7, 6, 5], 0]]);
const gabGeo = () => roofUV(GAB_V, [[[0, 3, 5, 4], 1], [[1, 4, 5, 2], 1], [[0, 4, 1], 0], [[3, 2, 5], 0]]);
const flatGeo = () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const ROOFM = {};   // общите материали на покривите (бял × цвета на инстанцията)
const roofMat = k => ROOFM[k] || (ROOFM[k] = k === 'mans' ? (() => { const c = mansardC(), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return tileByScale(nightWin(new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }), c, { seed: 57, rep: 1, thr: 70, lit: 0.2 }), 9, 0); })()
  : k === 'tile' ? (() => { const t = new THREE.CanvasTexture(tileC()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide }); return tileByScale(m, 4, 0); })()
  : new THREE.MeshStandardMaterial({ roughness: 0.9 }));

// ---- видовете (индекси от 7 нататък — 0–6 са старите на romeBlocks): фасада, покрив (геометрия, материал, височина = min(4, дълбочина × rk)), H — фиксирана височина
// (етажите са нарисувани) или ph — височина на етажа (повторение); ex — нещо на покрива (бойлери / машинно на асансьора)
const KD = [
  ['H5', () => fmat(haussC(5, 3, [2, 5], '#8a2b2b')[0], 9, 0, { seed: 41 }), 'mans', 0.3, { H: 4.5 + 5 * 3.1 }],
  ['H6', () => fmat(haussC(6, 2.6, [2, 6], '#2f5a3c', 0)[0], 7.8, 0, { seed: 43 }), 'mans', 0.3, { H: 4.5 + 6 * 3.1 }],
  ['H7', () => fmat(haussC(7, 3.2, [2, 5, 7], '#7a2a3a', 2)[0], 9.6, 0, { seed: 47 }), 'mans', 0.26, { H: 4.5 + 7 * 3.1 }],
  ['FAUB', () => fmat(faubC()[0], 7.5, 0, { seed: 53 }), 'tile', 0.32, { H: 3.5 + 4 * 3 }],
  ['PMOD', () => fmat(bandC('#efebe2', 1.55, 4, true), 9, 2.9, { seed: 59 }), 'flat', 0, { ph: 2.9 }],
  ['O2', () => fmat(ottoC(2)[0], 8, 0, { seed: 61 }), 'tile', 0.3, { H: 3 + 2 * 2.9 }],
  ['O3', () => fmat(ottoC(3)[0], 8, 0, { seed: 67 }), 'tile', 0.28, { H: 3 + 3 * 2.9 }],
  ['APF', () => KM.balc(), 'flat', 0, { ph: 3, ex: 'tank' }],
  ['APP', () => KM.balc(), 'tile', 0.18, { ph: 3 }],
  ['CON', () => fmat(bandC('#e9e5dc', 1.35, 3, false), 9, 3, { seed: 71 }), 'tile', 0.16, { ph: 3 }],
  ['PAN1', () => fmat(panelC(0), 7.2, 2.8, { seed: 73, lit: 0.3 }), 'flat', 0, { ph: 2.8, ex: 'lift' }],
  ['PAN2', () => fmat(panelC(1), 7.2, 2.8, { seed: 79, lit: 0.3 }), 'flat', 0, { ph: 2.8, ex: 'lift' }],
  ['COOP', () => fmat(coopC(), 7, 3, { seed: 83 }), 'tile', 0.25, { ph: 3 }],
  ['HOUSE', () => fmat(houseC(), 10, 0, { seed: 89, lit: 0.35 }), 'tile', 0.42, { H: 6 }],
  ['APW', () => KM.balc(), 'flat', 0, { ph: 3 }],
];
const KM = { _b: null, balc() { return this._b || (this._b = fmat(balcC(), 9, 3, { seed: 97 })); } };   // APF/APP/APW — една и съща фасада, различни покриви
export const K = Object.fromEntries(KD.map((k, i) => [k[0], 7 + i]));
const kind = t => KD[t - 7];

// ---- избор за Париж/Истанбул (romeBlocks): h, h2 — хешовете на мястото (0…1); ty — старият вид; връща { t, H, col, rc, ex }
const pick = (a, u) => a[Math.min(a.length - 1, Math.floor(u * a.length))];
const STONE = [0xf6ecd8, 0xeee0c4, 0xe8d6b2, 0xddd8ce, 0xf2e6d0, 0xe2cca8, 0xd6d0c4];   // варовик: кремав, охра, сив
const FAUBC = [0xeed2a8, 0xe0bc94, 0xeadcc4, 0xd2cabc, 0xe6c4a4, 0xf0e2c8];
const ZINC = [0x9aa6b2, 0x86929e, 0x737e88, 0xa8b0b8, 0x66707a], TILE = [0xc0603c, 0xa8553a, 0xb86e48, 0x9a4a32], FLAT = [0xc8c4bc, 0xb4b0a8, 0xd2cec6];
const OTTOC = [0xd9a066, 0xe8c6a0, 0xc97d5d, 0xa9c4cf, 0xb7c9a0, 0xe2d6c0, 0x9a6a4a, 0xd4a9a9, 0xe8d8a0];
const PAST = [0xf4d8c4, 0xf2e2b0, 0xd6e2ea, 0xecd0d6, 0xf6f2ea, 0xdce8d0, 0xf0d0a8, 0xe8e0d4];
export function varPick(style, h, h2, ty) { const h3 = (h * 7.31 + h2 * 3.77) % 1, h4 = (h * 13.7 + h2 * 5.3) % 1;
  if (style === 'paris') { const t = h2 < 0.36 ? K.H5 : h2 < 0.64 ? K.H6 : h2 < 0.8 ? K.H7 : h2 < 0.92 ? K.FAUB : K.PMOD, k = kind(t);
    return { t, H: k[4].H || 2.9 * (7 + Math.floor(h * 3)) /* модерните: 7–9 етажа */, col: t === K.FAUB ? pick(FAUBC, h3) : t === K.PMOD ? pick(FLAT, h3) : pick(STONE, h3), rc: t === K.FAUB ? (h4 < 0.5 ? pick(TILE, h3) : pick(ZINC, h3)) : t === K.PMOD ? pick(FLAT, h4) : pick(ZINC, h4) }; }
  if (ty === 1) { const t = h < 0.45 ? K.O2 : K.O3; return { t, H: kind(t)[4].H, col: pick(OTTOC, h3), rc: pick(TILE, h4) }; }   // Истанбул: османските къщи
  const n = 3 + Math.floor(h * 6), t = h2 < 0.3 ? K.APW : h2 < 0.62 ? K.APF : h2 < 0.82 ? K.APP : K.CON;   // блоковете: 3–8 етажа
  return { t, H: n * 3, col: t === K.CON ? pick([0xe6e0d4, 0xd8d4cc, 0xeadcc0], h3) : t === K.APW ? 0xf8f6f0 : pick(PAST, h3), rc: t === K.APF || t === K.APW ? pick(FLAT, h4) : pick(TILE, h4), ex: t === K.APF || (t === K.APW && h4 < 0.6) ? 'tank' : null };
}
// по-тесни и по-широки сгради по улицата (Париж, Истанбул): ~15 % тесни, ~15 % широки
export const varW = (id, e, step) => { const u = (((id * 2654435761) ^ Math.round(e * 97)) >>> 0) % 1000 / 1000; return step * (u < 0.15 ? 0.72 : u > 0.85 ? 1.38 : 0.9 + u * 0.22); };

// ---- инстанциите: само за видовете, които ги има (старите 0–6 — с FM/RF на romeBlocks), по 2 меша (фасада + покрив) на вид
export function xParts(G, list, FM, RF) { const n = new Map(); for (const b of list) n.set(b.t || 0, (n.get(b.t || 0) || 0) + 1); const parts = [];
  for (const [t, c] of n) { let fm, rg, rm, rk, flat;
    if (t < 7) { fm = FM[t]; rg = RF[t][0]; rm = new THREE.MeshStandardMaterial({ color: RF[t][1], roughness: 0.85, side: THREE.DoubleSide }); rk = RF[t][2]; flat = t === 2 || t === 5; }
    else { const k = kind(t); fm = k[1](); rg = k[2] === 'mans' ? mansGeo() : k[2] === 'tile' ? gabGeo() : flatGeo(); rm = roofMat(k[2]); rk = k[3]; flat = k[2] === 'flat'; }
    const box = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), fm, c), roof = new THREE.InstancedMesh(rg, rm, c);
    box.frustumCulled = roof.frustumCulled = false; box.receiveShadow = box.castShadow = true; roof.receiveShadow = true; box.count = roof.count = 0; box.userData.bgBlk = roof.userData.bgBlk = 1; G.add(box, roof); parts[t] = { box, roof, rk, flat, t }; }
  return parts;
}
// бойлерите (Истанбул: бял цилиндър + тъмен соларен панел) и машинните на асансьорите (панелните блокове) — по един InstancedMesh
let EXG = null;
function exGeo() { if (EXG) return EXG; EXG = { tank: new THREE.CylinderGeometry(0.42, 0.42, 1.7, 10).rotateZ(Math.PI / 2).translate(0, 1.0, -0.35), pan: new THREE.BoxGeometry(1.8, 0.06, 1.1).rotateX(-0.6).translate(0, 0.7, 0.35), lift: new THREE.BoxGeometry(3, 2.4, 4.2).translate(0, 1.2, 0) }; return EXG; }
export function xDraw(G, list, parts, skip, st) { const m = new THREE.Matrix4(), V = new THREE.Vector3(), Q = new THREE.Quaternion(), Sc = new THREE.Vector3(), C = new THREE.Color(), L = new THREE.Matrix4(), W = new THREE.Matrix4(), cnt = [];
  const ex = st.ex || (st.ex = (() => { const nT = list.filter(b => b.ex === 'tank').length * 3, nL = list.filter(b => b.ex === 'lift').length * 2; if (!nT && !nL) return {}; const g = exGeo(), o = {};
    if (nT) { o.tank = new THREE.InstancedMesh(g.tank, new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4, metalness: 0.3 }), nT); o.pan = new THREE.InstancedMesh(g.pan, new THREE.MeshStandardMaterial({ color: 0x1f2a3a, roughness: 0.3, metalness: 0.5 }), nT); }
    if (nL) o.lift = new THREE.InstancedMesh(g.lift, new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.9 }), nL);
    for (const k in o) { o[k].userData.bgBlk = 1; o[k].frustumCulled = false; o[k].castShadow = true; o[k].count = 0; G.add(o[k]); } return o; })());
  let nt = 0, nl = 0;
  for (const b of list) { if (skip(b)) continue; const t = b.t || 0, P = parts[t], i = cnt[t] = (cnt[t] || 0) + 1, j = i - 1;
    P.box.setMatrixAt(j, b.M); P.box.setColorAt(j, C.setHex(b.col)); b.M.decompose(V, Q, Sc);
    const top = V.y + Sc.y / 2; V.y = top;
    P.roof.setMatrixAt(j, m.compose(V, Q, P.flat ? Sc.set(Sc.x * (t === 5 ? 0.8 : 1.02), t === 5 ? 3 : 0.6, Sc.z * (t === 5 ? 0.8 : 1.02)) : Sc.set(Sc.x, Math.min(4, Sc.x * P.rk), Sc.z)));
    if (t >= 7 || b.rc != null) P.roof.setColorAt(j, C.setHex(b.rc != null ? b.rc : 0xffffff));
    if (b.ex) { b.M.decompose(V, Q, Sc); const d = Sc.x, w = Sc.z, hs = ((b.x * 7.1 + b.z * 3.3) % 1 + 1) % 1; W.compose(V.set(V.x, top + 0.6, V.z), Q, Sc.set(1, 1, 1));
      if (b.ex === 'tank' && ex.tank) for (let k = 0, nk = 1 + Math.floor(hs * 3); k < nk; k++) { L.makeTranslation((hs - 0.5) * d * 0.4 + (k % 2) * 1.6 - 0.8, 0, (k - (nk - 1) / 2) * 2.6); L.premultiply(W); ex.tank.setMatrixAt(nt, L); ex.pan.setMatrixAt(nt++, L); }
      else if (b.ex === 'lift' && ex.lift) for (let k = 0, nk = w > 26 ? 2 : 1; k < nk; k++) { L.makeTranslation(0, 0, nk > 1 ? (k ? 1 : -1) * w * 0.25 : 0); L.premultiply(W); ex.lift.setMatrixAt(nl++, L); } } }
  parts.forEach(P => { if (!P) return; P.box.count = P.roof.count = cnt[P.t] || 0; P.box.instanceMatrix.needsUpdate = P.roof.instanceMatrix.needsUpdate = true; if (P.box.instanceColor) P.box.instanceColor.needsUpdate = true; if (P.roof.instanceColor) P.roof.instanceColor.needsUpdate = true; });
  if (ex.tank) { ex.tank.count = ex.pan.count = nt; ex.tank.instanceMatrix.needsUpdate = ex.pan.instanceMatrix.needsUpdate = true; }
  if (ex.lift) { ex.lift.count = nl; ex.lift.instanceMatrix.needsUpdate = true; }
}

// ---- bg-fill: градовете по плана без карта. 1) по свободните парцели (b.lot — играта решава кои: fillLot), 2) вътрешността на кварталите — там,
// където земята е свободна (не улица, вода, зелено, кръгово, парцел), до 70 м от улица; ориентирани по най-близката улица
const PANC = [0xd8d6d0, 0xe2dccc, 0xc8c6c0, 0xf0dcb0, 0xeac8b4, 0xd4e0c8, 0xe0d4e4, 0xf2e8d0, 0xd0d8e0], COOPC = [0xeedcc0, 0xe4c8a0, 0xf0e6d6, 0xd8c8b8, 0xe8c0b0, 0xd4ccbc, 0xf2dca8], HOUSEC = [0xf4ece0, 0xeedcb8, 0xe8d0b0, 0xf0e4d0, 0xe0c8a8, 0xdcd6cc];
function inPoly(x, z, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
export function* bgPlace(P, list) {
  const hsh = (a, b) => (((Math.imul(Math.round(a * 10) | 0, 73856093) ^ Math.imul(Math.round(b * 10) | 0, 19349663)) >>> 0) % 10007) / 10007;
  // улиците: точки през 4 м с посоката и полуширината (с тротоара), в мрежа 20 м
  const RG = new Map(), rk = (i, j) => i * 100003 + j;
  for (const rd of P.roads) { const hw = rd.w / 2 + (rd.walk || 0); for (let i = 1; i < rd.pts.length; i++) { const a = rd.pts[i - 1], b = rd.pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!l) continue; const ux = (b[0] - a[0]) / l, uz = (b[1] - a[1]) / l;
    for (let s = 0; s <= l; s += 4) { const x = a[0] + ux * s, z = a[1] + uz * s, k = rk(Math.floor(x / 20), Math.floor(z / 20)); (RG.get(k) || RG.set(k, []).get(k)).push(x, z, hw, ux, uz); } } }
  const road = (x, z, R = 70) => { let best = null, bd = 1e9; const i0 = Math.floor(x / 20), j0 = Math.floor(z / 20), n = Math.ceil(R / 20);
    for (let a = i0 - n; a <= i0 + n; a++) for (let b = j0 - n; b <= j0 + n; b++) { const c = RG.get(rk(a, b)); if (c) for (let q = 0; q < c.length; q += 5) { const d = Math.hypot(c[q] - x, c[q + 1] - z) - c[q + 2]; if (d < bd) { bd = d; best = [d, c[q + 3], c[q + 4], c[q], c[q + 1]]; } } }
    if (!best || best[0] >= R) return null; const l = Math.hypot(x - best[3], z - best[4]) || 1; best[3] = (x - best[3]) / l; best[4] = (z - best[4]) / l; return best; };   // [разстояние до ръба на тротоара, посока на улицата, нормала към точката]
  // парцелите (всички, и големите): правоъгълник + отстъп
  const LG = new Map(); for (const L of P.lots) { const r = Math.hypot(L.w, L.d) / 2 + 4; for (let i = Math.floor((L.x - r) / 40); i <= Math.floor((L.x + r) / 40); i++) for (let j = Math.floor((L.z - r) / 40); j <= Math.floor((L.z + r) / 40); j++) { const k = rk(i, j); (LG.get(k) || LG.set(k, []).get(k)).push(L); } }
  const inLot = (x, z, m) => { for (const L of LG.get(rk(Math.floor(x / 40), Math.floor(z / 40))) || []) { const c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0), dx = x - L.x, dz = z - L.z; if (Math.abs(dx * c - dz * s) < L.w / 2 + m + (L.big ? 3 : 0) && Math.abs(dx * s + dz * c) < L.d / 2 + m + (L.big ? 3 : 0)) return true; } return false; };
  const greens = [...(P.greens || []), ...(P.greensSrc || [])].map(g => g.poly).filter(Boolean), circ = [...(P.rounds || []).map(r => [r.x, r.z, r.outer + 6]), ...(P.turns || []).map(t => [t.x, t.z, t.r + 6])];
  const blocked = (x, z) => P.waterAt(x, z) || circ.some(([cx, cz, r]) => (cx - x) ** 2 + (cz - z) ** 2 < r * r) || greens.some(p => inPoly(x, z, p));
  // заетост — растер 3 м (без застъпване между сградите)
  const OC = new Set(), ok = (cx, cz, ux, uz, hw, hd, set) => { const out = []; for (let a = -hw; a <= hw + 0.01; a += Math.min(2.5, hw)) for (let b = -hd; b <= hd + 0.01; b += Math.min(2.5, hd)) { const x = cx + ux * a - uz * b, z = cz + uz * a + ux * b, k = rk(Math.floor(x / 3), Math.floor(z / 3)); if (!set && OC.has(k)) return false; out.push(k); } if (set) for (const k of out) OC.add(k); return true; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C0 = P.center || { x: 0, z: 0 }, R0 = P.R || 600;
  // вид по пояса: центърът — блокове и кооперации, средата — кооперации и блокове, покрайнините — къщи
  const kindAt = (zone, u) => zone === 'center' || zone === 'business' ? (u < 0.55 ? 'pan' : 'coop') : zone === 'residential' ? (u < 0.3 ? 'pan' : u < 0.75 ? 'coop' : 'house') : (u < 0.12 ? 'pan' : u < 0.3 ? 'coop' : 'house');
  const zoneAt = (x, z) => { const d = Math.hypot(x - C0.x, z - C0.z) / R0; return d < 0.25 ? 'center' : d < 0.6 ? 'residential' : 'periphery'; };
  const put = (x, z, ux, uz, w, d, k, u, lot) => {   // (ux, uz) — посоката на улицата пред фасадата; w — по улицата, d — дълбочина
    const u2 = (u * 9.13) % 1, u3 = (u * 17.7) % 1;
    const t = k === 'pan' ? (u2 < 0.5 ? K.PAN1 : K.PAN2) : k === 'coop' ? K.COOP : K.HOUSE, H = k === 'pan' ? 2.8 * (6 + Math.floor(u3 * 7)) : k === 'coop' ? 3 * (3 + Math.floor(u3 * 3)) : u3 < 0.2 ? 3 : 6;   // блок 6–12 ет., кооперация 3–5, къща 2 (или 1)
    const col = pick(k === 'pan' ? PANC : k === 'coop' ? COOPC : HOUSEC, u2), rc = k === 'pan' ? pick([0x8a8a86, 0x9c9a94, 0x7a7c80], u3) : pick(TILE, u3);
    q.setFromAxisAngle(up, Math.atan2(ux, uz));   // локалното z — по улицата, x — навътре (както в romeBlocks)
    list.push({ x, z, w, d, h: H, rot: Math.atan2(ux, uz), t, col, rc, ex: k === 'pan' ? 'lift' : null, M: m4.compose(new THREE.Vector3(x, H / 2, z), q, new THREE.Vector3(d, H, w)).clone(), lot }); };
  // 1) парцелите: лицето — локално +z (към улицата); сградата — отпред, с отстъп
  let n0 = 0;
  for (const L of P.lots) { if (L.big || L.lm) continue; if (++n0 % 200 === 0) yield 0;
    const u = hsh(L.x, L.z), k = kindAt(L.zone, u), c = Math.cos(L.rot || 0), s = Math.sin(L.rot || 0);   // локално x → (c, −s), z → (s, c)
    const bw = k === 'house' ? Math.min(L.w - 4, 9 + u * 3) : k === 'pan' ? Math.min(L.w - 2, 36) : L.w - 1.2, bd = k === 'house' ? Math.min(L.d - 7, 8 + u * 3) : k === 'pan' ? Math.min(L.d - 5, 12) : Math.min(L.d - 3, 13), back = k === 'house' ? 4 + u * 2 : k === 'pan' ? 3 : 1;
    if (bw < 6 || bd < 6) continue; const zc = L.d / 2 - back - bd / 2, x = L.x + s * zc, z = L.z + c * zc;
    ok(x, z, c, -s, bw / 2, bd / 2, true); put(x, z, c, -s, bw, bd, k, u, L); }
  // 2) вътрешността на кварталите: мрежа 12 м в границите на плана; до улица — лицето на линия (отстъп), иначе по-навътре; ако не се побира — по-малка
  const B = P.boundary || []; if (!B.length) return; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of B) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  let row = 0;
  for (let gz = z0 + 6; gz < z1; gz += 12) { if (++row % 4 === 0) yield 0;
    for (let gx = x0 + 6; gx < x1; gx += 12) { const u = hsh(gx, gz); if (u < 0.1) continue;   // тук-там двор/празно място
      const r = road(gx, gz); if (!r || r[0] < 3 || !inPoly(gx, gz, B) || inLot(gx, gz, 1) || blocked(gx, gz)) continue;
      const [dist, ux, uz, nx, nz] = r, k = kindAt(zoneAt(gx, gz), u), back = k === 'coop' ? 1.5 : k === 'pan' ? 5 : 4;   // отстъп от тротоара
      const SZ = k === 'house' ? [[10 + u * 2, 9], [8, 8]] : k === 'pan' ? [[24 + u * 12, 12], [16, 12], [12, 11]] : [[14 + u * 4, 12], [11, 11], [9, 9]];
      for (const [w, d] of SZ) { const sh = dist < d / 2 + back + 8 ? dist - d / 2 - back : 0, cx = gx - nx * sh, cz = gz - nz * sh;   // близо до улица — лицето на линия с отстъпа
        const cs = [[w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2], [w / 2, 0], [-w / 2, 0], [0, d / 2], [0, -d / 2]].map(([a, b]) => [cx + ux * a - uz * b, cz + uz * a + ux * b]);   // по улицата ± w/2, навътре ± d/2
        if (cs.some(([x, z]) => inLot(x, z, 0.5) || blocked(x, z) || !inPoly(x, z, B)) || cs.some(([x, z]) => { const r2 = road(x, z, 20); return r2 && r2[0] < 1; })) continue;
        if (!ok(cx, cz, ux, uz, w / 2 + 1.5, d / 2 + 1.5, false)) continue; ok(cx, cz, ux, uz, w / 2, d / 2, true);
        put(cx, cz, ux, uz, w, d, k, u, null); break; } } }
}
