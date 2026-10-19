// fireflip.js — истински пламъци: симулация на огън в Блендър (Mantaflow, _source/fire-sheet-blender.py),
// изпечена в лента от 32 кадъра (assets/fx/fire-sheet.jpg, 8×4, черен фон → AdditiveBlending).
// Всеки пламък прелиства кадрите сам, от своя кадър и със своя скорост — да не горят в синхрон. Лабораторията → fire-real.
import * as THREE from 'three';

const COLS = 8, ROWS = 4, N = COLS * ROWS, FPS = 24;
let base = null, ready = false;
const clones = [];   // копията на текстурата (свой offset) делят картинката; при зареждане всички трябва да се качат
const sheet = () => base || (base = new THREE.TextureLoader().load('assets/fx/fire-sheet.jpg', () => { ready = true; for (const c of clones) c.needsUpdate = true; clones.length = 0; }));

class FlameSprite extends THREE.Sprite {
  onBeforeRender() {
    const u = this.userData, f = Math.floor(performance.now() / 1000 * FPS * u.sp + u.ph) % N;
    if (f !== u.f) { u.f = f; this.material.map.offset.set((f % COLS) / COLS, 1 - (Math.floor(f / COLS) + 1) / ROWS); }
  }
}
// пламък: основата е в позицията на спрайта (center y ≈ 0.04); мащаб — височина h (ширината е 0.8·h, както кадъра)
export function flameSprite(opacity = 1) {
  const t = sheet().clone(); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / COLS, 1 / ROWS); if (ready) t.needsUpdate = true; else clones.push(t);
  const s = new FlameSprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity }));
  s.center.set(0.5, 0.04); s.userData.ph = Math.random() * N; s.userData.sp = 0.8 + Math.random() * 0.45; s.userData.f = -1;
  return s;
}
export const flameSize = (s, h) => s.scale.set(h * 0.8, h, 1);
