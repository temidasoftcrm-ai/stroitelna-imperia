// water.js — движещи се вълни за морето (пристанищата в seaside.js и летните курорти в resortview.js):
// два слоя нормали (waternormals.jpg от примерите на three.js, MIT), които се плъзгат в различни посоки,
// гладка повърхност с отблясъци от слънцето. Евтино — без отражения и без допълнително рендериране.
import * as THREE from 'three';

// копията (clone) се отбелязват за качване чак когато картинката дойде — иначе three.js пише „Texture marked for update but no image data found“
let tex = null, ready = false; const pending = [];
function normals() {
  if (!tex) { tex = new THREE.TextureLoader().load('assets/heavy/water/waternormals.jpg', () => { ready = true; for (const c of pending) c.needsUpdate = true; pending.length = 0; }); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  return tex;
}
const copy = () => { const c = normals().clone(); if (ready) c.needsUpdate = true; else pending.push(c); return c; };
// opts: { color, repeat (колко пъти се повтаря текстурата по площта), strength, vertexColors }
export function makeWater(opts = {}) {
  const rep = opts.repeat || 24, n1 = copy(), n2 = copy();
  n1.repeat.set(rep, rep); n2.repeat.set(rep * 0.55, rep * 0.55);
  const k = opts.strength ?? 0.55;
  const material = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0x2f86c8, vertexColors: !!opts.vertexColors, roughness: 0.12, metalness: 0.05,
    normalMap: n1, normalScale: new THREE.Vector2(k, k),
    clearcoat: 1, clearcoatRoughness: 0.08, clearcoatNormalMap: n2, clearcoatNormalScale: new THREE.Vector2(k * 0.8, k * 0.8),
  });
  // t — секунди
  function update(t) {
    n1.offset.set(t * 0.012, t * 0.02);
    n2.offset.set(-t * 0.016, t * 0.009);
  }
  return { material, update };
}
