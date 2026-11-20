// shadowsmall.js — ⚡ флаг shadow-small: дребните неща (хора, пейки, кошчета, знаци, дребни части по сградите — радиус < 1,5 м)
// не хвърлят сенки. Мерене (20.11, Пловдив, „Високо“): едно обновяване на сенките = ~710 рисувания, от тях ~320 са такива дребни части.
// Инстанциите (дърветата, тревата) не се пипат — геометрията им е за една бройка, а сянката им е важна.
// Пипа само това, което е изключило само: ако нещо порасне (строеж, мащаб от 0) — сянката му се връща.
//   import { createShadowSmall } from './shadowsmall.js';  const SS = createShadowSmall();  if (SS.tick(scene)) renderer.shadowMap.needsUpdate = true;
const MIN = 1.5, EVERY = 120;
export function createShadowSmall() {
  let fr = 0, off = 0;
  return {
    tick(root, force) {
      if (!root || (!force && fr++ % EVERY !== 0)) return false;
      let ch = false, n = 0;   // ch — само ако нещо си е върнало сянката (порасна) — тогава сенките трябва да се обновят
      root.traverse(m => {
        if (!m.isMesh || m.isInstancedMesh) return;
        const u = m.userData; if (!m.castShadow && !u._shOff) return;
        const g = m.geometry; if (!g) return; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingSphere) return;
        const r = g.boundingSphere.radius * m.matrixWorld.getMaxScaleOnAxis();
        if (m.castShadow && r < MIN) { m.castShadow = false; u._shOff = 1; }   // изключването не иска ново изчисляване — старата сянка изчезва при следващото обикновено обновяване (новите минувачи иначе го пускаха всяка секунда)
        else if (u._shOff && r >= MIN) { m.castShadow = true; delete u._shOff; ch = true; }
        if (u._shOff) n++;
      });
      off = n; return ch;
    },
    stats: () => off,
  };
}
