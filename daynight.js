// daynight.js — денонощие: слънце, небе, мъгла, светлини и светещи лампи нощем.
// Един игрови ден = едно денонощие. f = част от деня (0..1); 0 = 06:00 сутринта.
import * as THREE from 'three';
import { NF_MATS, NF_T } from './nightfloors.js';

// ключови моменти (час → цветове/сила)
const KEYS = [
  { h: 0, sky: 0x14244c, fog: 0x18284e, hemi: 0.95, hemiSky: 0x7a8fd0, sun: 0.55, sunC: 0xa8bcff },   // нощ: лунна светлина — сградите се виждат
  { h: 5, sky: 0x1e2a52, fog: 0x1e2a52, hemi: 0.9, hemiSky: 0x7a86c0, sun: 0.4, sunC: 0xffb07a },
  { h: 6.5, sky: 0xf6b48a, fog: 0xf0c0a0, hemi: 0.9, hemiSky: 0xffd2b0, sun: 1.2, sunC: 0xffb47a },
  { h: 9, sky: 0xbcd9ee, fog: 0xbcd9ee, hemi: 1.3, hemiSky: 0xdfefff, sun: 2.3, sunC: 0xfff2dc },
  { h: 17, sky: 0xbcd9ee, fog: 0xbcd9ee, hemi: 1.3, hemiSky: 0xdfefff, sun: 2.3, sunC: 0xfff2dc },
  { h: 19, sky: 0xf39a6a, fog: 0xe8a080, hemi: 0.9, hemiSky: 0xffc0a0, sun: 1.1, sunC: 0xff9a5a },
  { h: 20.5, sky: 0x2a2f5a, fog: 0x2a2f5a, hemi: 0.9, hemiSky: 0x8080c0, sun: 0.45, sunC: 0xa8bcff },
  { h: 24, sky: 0x14244c, fog: 0x18284e, hemi: 0.95, hemiSky: 0x7a8fd0, sun: 0.55, sunC: 0xa8bcff },
];
const ca = new THREE.Color(), cb = new THREE.Color();
const mix = (a, b, k, out) => out.copy(ca.setHex(a)).lerp(cb.setHex(b), k);

export const hourOf = f => (6 + f * 24) % 24;
export const clockText = f => { const h = hourOf(f); return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60 / 10) * 10).padStart(2, '0')}`; };
export const isNight = f => { const h = hourOf(f); return h >= 20 || h < 6; };

export class DayNight {
  // scene с background (Color) и fog; hemi = HemisphereLight; sun = DirectionalLight
  constructor(scene, hemi, sun) {
    this.scene = scene; this.hemi = hemi; this.sun = sun;
    this.lamps = new THREE.Group(); scene.add(this.lamps);
    this.glowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,230,160,1)'); r.addColorStop(0.35, 'rgba(255,200,110,.55)'); r.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.glowMat = new THREE.SpriteMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    this.poolMat = new THREE.MeshBasicMaterial({ map: this.glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    this.night = 0;
    this.winMats = new Set();
    this.masks = new WeakMap();
  }
  // прозорците светят нощем: Quaternius „FakeInterior“ материалите светят целите,
  // а при Kenney (обща текстура colormap) — само сините пиксели на стъклата
  registerWindows(root) {
    root.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || !m.map || this.winMats.has(m) || !('emissive' in m)) continue;
        const nm = m.name || '';
        if (/FakeInterior_[123]/.test(nm)) { m.emissiveMap = m.map; m.emissive.setRGB(1, 0.78, 0.45); m.userData.winK = 0.7; }
        else if (m.userData.nightFloors) { /* реалистичните сгради (nightfloors.js): етажите светват по своя график в шейдъра */ }
        else if (/colormap/i.test(nm)) { const mk = this.maskFor(m.map); if (!mk) continue; m.emissiveMap = mk; m.emissive.setRGB(1, 0.72, 0.38); m.userData.winK = 0.55; }
        else continue;
        m.emissiveIntensity = 0; m.needsUpdate = true;
        this.winMats.add(m);
      }
    });
  }
  maskFor(tex) {
    const img = tex.image; if (!img || !img.width) return null;
    if (this.masks.has(img)) return this.masks.get(img);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    let any = false;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      const glass = b > 140 && b > r + 35 && b > gg + 5;   // синкаво стъкло
      p[i] = p[i + 1] = p[i + 2] = glass ? 255 : 0; any ||= glass;
    }
    if (!any) { this.masks.set(img, null); return null; }   // без стъкла — няма какво да свети (и излишна черна текстура в паметта)
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = THREE.SRGBColorSpace;
    this.masks.set(img, t);
    return t;
  }
  // позиции на уличните лампи: [{x, y, z}] — y е височината на лампата
  setLamps(list) {
    this.lamps.clear();
    const poolGeo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2);
    for (const p of list) {
      const s = new THREE.Sprite(this.glowMat); s.position.set(p.x, p.y, p.z); s.scale.set(3.2, 3.2, 1); this.lamps.add(s);
      const pool = new THREE.Mesh(poolGeo, this.poolMat); pool.position.set(p.x, 0.06, p.z); this.lamps.add(pool);   // светло петно на асфалта
    }
  }
  // f: част от деня; target: точката, около която върви слънцето (за сенките)
  update(f, target) {
    const h = hourOf(f);
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1], k = (h - a.h) / (b.h - a.h);
    mix(a.sky, b.sky, k, this.scene.background);
    if (this.scene.fog) mix(a.fog, b.fog, k, this.scene.fog.color);
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    mix(a.hemiSky, b.hemiSky, k, this.hemi.color);
    this.sun.intensity = a.sun + (b.sun - a.sun) * k;
    mix(a.sunC, b.sunC, k, this.sun.color);
    // слънцето изгрява на изток (+x) в 6:00 и залязва на запад в 20:00; нощем „луната“ е отгоре
    const day = Math.min(1, Math.max(0, (h - 6) / 14)), ang = day * Math.PI;
    const tx = target ? target.x : 0, tz = target ? target.z : 0;
    this.sun.position.set(tx + Math.cos(ang) * 140, 25 + Math.sin(ang) * 120, tz + 50);
    this.sun.target.position.set(tx, 0, tz);
    // лампите светват плавно привечер и угасват сутрин
    const n = h >= 19 ? Math.min(1, (h - 19) / 1.2) : h < 6.5 ? Math.min(1, (6.5 - h) / 1.2) : 0;
    this.night = n;
    this.glowMat.opacity = n * 0.95;
    this.poolMat.opacity = n * 0.35;
    this.lamps.visible = n > 0.01;
    for (const m of this.winMats) m.emissiveIntensity = n * (m.userData.winK || 1);
    NF_T.value = performance.now() / 1000;
    for (const m of NF_MATS) m.emissiveIntensity = n * (m.userData.nfK || 1);   // nfK — по-ярко (Петронас)   // нощните етажи (nightfloors.js) — и на забележителностите, заредени по-късно
  }
}
