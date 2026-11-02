// sitenet.js — 🏗️ site-net (собственикът, 02.11: „скелето предлагам да го направим като в градовете — опънати чаршафи с логото на играча; и след като свърши строежа се махат“):
// опънатата мрежа по скелето (полупрозрачна, светлосива — етажите отзад се виждат леко; лек вятър във върховете) и голям банер отпред (към улицата, +z на площадката)
// с логото и името на фирмата на играча (иконата и името в цвета на марката — като по бусовете, vanlogo.js). Тръбите на скелето остават отгоре.
// На площадка: една мрежа (4 стени в една геометрия) + един банер; текстурата на мрежата — обща, банерът — платно по марка (в кеш).
// Махат се заедно със скелето: групата е дете на скелето (видимостта и махането на площадката — както досега).
//   import { siteNet } from './sitenet.js';
//   scaffold.add(siteNet({ x, z, w, d, y0, h, brand, clip }))   // x, z — центърът; w, d — ширината и дълбочината на скелето; y0…h — височината; clip — равнината на скелето (по желание)
import * as THREE from 'three';
import { canvasTex } from './texdata.js';

const WIND = { value: 0 };
let netTex = null;
function netTexture() {   // плетката: светлосиво, полупрозрачно, по-плътни нишки през 8 px (1 повторение = 1 м)
  if (netTex) return netTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(214,218,222,0.3)'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(190,195,200,0.55)'; for (let i = 0; i < 64; i += 8) { g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2); }
  netTex = canvasTex(c); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.colorSpace = THREE.SRGBColorSpace; netTex.anisotropy = 4;
  return netTex;
}
const bannerCache = new Map();
function bannerTexture(b) {   // бял чаршаф: лента в цвета на марката горе и долу, иконата и името, отдолу „Строителство“
  const key = b.nm + b.col + b.ico; if (bannerCache.has(key)) return bannerCache.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = b.col; g.fillRect(0, 0, 1024, 46); g.fillRect(0, 466, 1024, 46);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = '190px "Noto Color Emoji", system-ui, sans-serif'; g.fillText(b.ico, 512, 175);
  const nm = b.nm.toUpperCase(); let fs = 112; g.font = `900 ${fs}px system-ui, sans-serif`; while (g.measureText(nm).width > 940 && fs > 40) { fs -= 6; g.font = `900 ${fs}px system-ui, sans-serif`; }
  g.lineWidth = 10; g.strokeStyle = 'rgba(20,24,32,0.85)'; g.strokeText(nm, 512, 345); g.fillStyle = b.col; g.fillText(nm, 512, 345);
  g.font = '700 46px system-ui, sans-serif'; g.fillStyle = '#3a3f47'; g.fillText('СТРОИТЕЛСТВО', 512, 426);
  const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; bannerCache.set(key, t); return t;
}
let netMat0 = null;
function netMaterial(clip) {
  const make = () => { const m = new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
    m.onBeforeRender = () => { WIND.value = performance.now() / 1000; };
    m.onBeforeCompile = sh => { sh.uniforms.uSnWind = WIND; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uSnWind;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * 0.07 * sin(uSnWind * 1.6 + position.y * 0.8 + (position.x + position.z) * 0.55) * clamp(position.y * 0.15, 0.0, 1.0);'); };   // лек вятър (отдолу — опънато)
    m.customProgramCacheKey = () => 'site-net'; return m; };
  if (!clip) return netMat0 || (netMat0 = make());
  const m = make(); m.clippingPlanes = [clip]; return m;
}
export function siteNet({ x = 0, z = 0, w, d, y0 = 0, h, brand, clip = null, pad = -0.15 }) {   // pad < 0 — мрежата малко навътре от тръбите: скелето остава видимо отпред
  const g = new THREE.Group(); g.name = 'siteNet';
  const W = w / 2 + pad, D = d / 2 + pad, H = h - y0; if (!(H > 1)) return g;
  // 4 стени в една геометрия; UV — в метри (1 повторение на плетката = 1 м)
  const P = [], N = [], U = [], I = [];
  const wall = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), i = P.length / 3;
    P.push(x + ax, y0, z + az, x + bx, y0, z + bz, x + bx, h, z + bz, x + ax, h, z + az); for (let k = 0; k < 4; k++) N.push(nx, 0, nz);
    U.push(0, 0, L, 0, L, H, 0, H); I.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  wall(-W, D, W, D, 0, 1); wall(W, D, W, -D, 1, 0); wall(W, -D, -W, -D, 0, -1); wall(-W, -D, -W, D, -1, 0);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setIndex(I);
  const net = new THREE.Mesh(geo, netMaterial(clip)); net.renderOrder = 3; net.castShadow = false; net.receiveShadow = false; g.add(net);
  // банерът отпред (+z — към улицата, там е входът на оградата): до 80 % от ширината, 2 : 1, в горната половина
  if (brand) { let bw = Math.min(2 * W * 0.8, H * 0.9 * 2), bh = bw / 2; if (bh > H * 0.6) { bh = H * 0.6; bw = bh * 2; }
    if (bh >= 1.5) { const bm = new THREE.MeshStandardMaterial({ map: bannerTexture(brand), roughness: 0.85, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }); if (clip) bm.clippingPlanes = [clip];
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bm); ban.position.set(x, Math.min(h - bh / 2 - 0.4, y0 + H * 0.62), z + D + 0.04); ban.name = 'siteBanner'; g.add(ban); } }
  return g;
}
