// portlights.js — нощно осветление за пристанищата (seaside.js и терминалите от tender3d.js):
// прожекторни мачти със светещи глави, светли петна по кея (адитивни кръгове с плавен ръб), слаб конус светлина
// и червени сигнални лампи по върховете на крановете, които мигат. Без истински светлини — евтино за GPU.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
import { gfx } from './gfxpresets.js';

const LITE = feature('gfx-lite');

let poolTex = null;
function poolMap() {
  if (!poolTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,205,1)'); gr.addColorStop(0.4, 'rgba(255,226,170,0.6)'); gr.addColorStop(1, 'rgba(255,215,150,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); poolTex = new THREE.CanvasTexture(c);
  }
  return poolTex;
}

export function createPortLights() {
  const pole = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.7, metalness: 0.4 });
  const head = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffe2a0, emissiveIntensity: 0.2, roughness: 0.4 });
  const pool = new THREE.MeshBasicMaterial({ map: poolMap(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const cone = new THREE.MeshBasicMaterial({ color: 0xffe9b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beacon = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff1010, emissiveIntensity: 0.3 });
  const glows = [];   // [материал, сила] — прозорци и др., които светят нощем
  let night = 0;
  if (LITE) pool.visible = cone.visible = false;   // gfx-lite: до първата нощ

  // прожекторна мачта: (x, z) — място, y — височината на кея, h — височина на мачтата, r — радиус на светлото петно
  function mast(parent, x, z, { y = 1.2, h = 20, r = 24 } = {}) {
    const m = new THREE.Group(); m.position.set(x, y, z); parent.add(m);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, h, 8), pole); p.position.y = h / 2; p.castShadow = true; m.add(p);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1, 2.2), head); hd.position.y = h + 0.3; m.add(hd);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 0.3), pole); fr.position.y = h + 1; m.add(fr);
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.75, h, 20, 1, true), cone); c.position.y = h / 2; m.add(c);
    const pl = new THREE.Mesh(new THREE.CircleGeometry(r, 28), pool); pl.rotation.x = -Math.PI / 2; pl.position.y = 0.12; m.add(pl);
    return m;
  }
  // червена сигнална лампа (на върха на кран)
  function beaconAt(parent, x, y, z, s = 0.6) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), beacon); b.position.set(x, y, z); parent.add(b); return b;
  }
  const glow = (m, k = 1.4) => { glows.push([m, k]); return m; };
  function setNight(n, t = 0) {
    n = Math.max(0, Math.min(1, n));
    if (Math.abs(n - night) > 0.005) {
      night = n;
      head.emissiveIntensity = 0.2 + 2.6 * n;
      pool.opacity = 0.62 * n; cone.opacity = 0.05 * n;
      for (const [m, k] of glows) m.emissiveIntensity = 0.05 + k * n;
    }
    if (LITE) pool.visible = cone.visible = n > 0.01 && gfx().night;   // gfx-lite: денем (прозрачност 0) не се рисуват; „Нощни светлини“ — изключени
    beacon.emissiveIntensity = 0.3 + (n > 0.2 ? (Math.sin(t * 3) > 0 ? 2.5 : 0.3) * n : 0);
  }
  return { mast, beaconAt, glow, setNight };
}
