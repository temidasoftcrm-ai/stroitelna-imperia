// officestyle.js — облик на офиса-кула (от ниво 7 на офиса): избираш небостъргача за централата/филиала си.
// Моделите от пакета (Kenney; @N = на N етажа), процедурните кули от landmarks.js (Сапфир, Туист, Близнаци) или истински от Sketchfab (sf).
import * as THREE from 'three';
import { buildLandmark } from './landmarks.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// истински небостъргачи от Sketchfab (CC-BY, авторите са в CREDITS.txt и „📜 Автори“) — зареждат се при първо ползване
const SKY = {}, skyLoad = {};
const loadSky = k => skyLoad[k] || (skyLoad[k] = new Promise(res => new GLTFLoader().load(`assets/heavy/sky/${k}.glb`, g => { SKY[k] = g.scene; res(g.scene); }, undefined, () => res(null))));

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
    const o = buildLandmark(style.lm);
    const bb = new THREE.Box3().setFromObject(o.group), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const wrap = new THREE.Group(); o.group.scale.setScalar((width + 1.5) / w); wrap.add(o.group);
    wrap.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { group: wrap, update: o.update };
  }
  const isQ = style.model.startsWith('Building_');
  return { group: deps.model(style.model, deps.fitScale(style.model, isQ ? width + 1.5 : width)), update: null };
}
