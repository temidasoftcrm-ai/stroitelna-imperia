// water.js — движещи се вълни за морето (пристанищата в seaside.js и летните курорти в resortview.js):
// два слоя нормали (waternormals.jpg от примерите на three.js, MIT), които се плъзгат в различни посоки,
// гладка повърхност с отблясъци от слънцето. Евтино — без отражения и без допълнително рендериране.
import * as THREE from 'three';
import { feature } from './lab/feature.js';
// sea2 (т. 35): един общ шейдър — UV по света (морето на seaside, водата от плана и реките се сливат без шевове и светли петна),
// три слоя вълни (голяма бавна, средна, ситна рябава), отражение на небето по Френел (цветът на мъглата — нощем потъмнява сам)
const SEA2 = feature('sea2');
const WT = { get value() { return performance.now() / 1000; } };   // времето — без update() (водата от плана няма свой тик)
function sea2Shader(m, k) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uWT = WT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeaW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSeaW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeaW; uniform float uWT;')
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP
          vec2 sp = vSeaW.xz;
          vec3 a = texture2D(normalMap, sp / 95.0 + vec2(uWT * 0.0035, uWT * 0.0052)).xyz * 2.0 - 1.0;   // голямата бавна вълна
          vec3 b = texture2D(normalMap, sp / 29.0 + vec2(-uWT * 0.0085, uWT * 0.0041)).xyz * 2.0 - 1.0;  // средната
          vec3 c = texture2D(normalMap, sp / 7.5 + vec2(uWT * 0.021, -uWT * 0.016)).xyz * 2.0 - 1.0;     // рябавата
          vec2 d = (a.xy * 1.0 + b.xy * 0.55 + c.xy * 0.3) * ${k.toFixed(3)};
          vec3 nW = normalize(vec3(d.x, 1.0, d.y));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        #endif`)
      .replace('#include <opaque_fragment>', `
        { float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
        #ifdef USE_FOG
          outgoingLight = mix(outgoingLight, fogColor, clamp(fr * 0.45, 0.0, 0.45));
        #endif
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'sea2';
}

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
  if (SEA2) { material.clearcoatNormalMap = null; material.clearcoat = 0.6; material.clearcoatRoughness = 0.18; sea2Shader(material, k * 0.9); }
  // t — секунди
  function update(t) {
    n1.offset.set(t * 0.012, t * 0.02);
    n2.offset.set(-t * 0.016, t * 0.009);
  }
  return { material, update };
}
