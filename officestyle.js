// officestyle.js — облик на офиса-кула (от ниво 7 на офиса): избираш небостъргача за централата/филиала си.
// Моделите от пакета (Kenney; @N = на N етажа) или процедурните кули от landmarks.js (Сапфир, Туист, Близнаци).
import * as THREE from 'three';
import { buildLandmark } from './landmarks.js';

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
];
// style → { group, update(t, night) }; width — ширината на офиса в двора на централата
export function buildOfficeTower(style, deps, width) {
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
