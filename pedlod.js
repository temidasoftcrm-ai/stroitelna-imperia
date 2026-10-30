// pedlod.js — ⚡ ped-lod: далечните и невидимите минувачи не струват процесор.
// В голям град (Истанбул) ~370 анимирани човека × 65 кости ≈ 24 000 от ~37 000 обекта в сцената — three.js преизчислява матриците
// на всичките при всяко рисуване (scene.updateMatrixWorld — най-тежкото в кадъра), дори когато човекът е зад камерата или на 400 м.
// Тук всеки клонинг със скелет (game.js: cloneSkinned) се проверява ~10 пъти в секунда: извън кадъра или по-далеч от прага
// на настройката → скрит и без обхождане на поддървото (matrixWorldAutoUpdate = false); влезе ли пак — обратно. Мястото му
// се следи без децата (updateWorldMatrix(true, false)), така че системите, които го движат (спирки, паркинги, площади), не забелязват нищо.
import * as THREE from 'three';
import { gfxLevel } from './gfxpresets.js';

const FAR = { vlow: 90, low: 120, mid: 170, high: 230 }, R = 4, GONE = 50;   // GONE — проверки без родител (≈5 s) → махнат от списъка

export function createPedLod(getScene) {   // getScene() — сцената (в game.js се създава по-късно от този модул)
  const set = new Set(), fr = new THREE.Frustum(), M = new THREE.Matrix4(), P = new THREE.Vector3(), sp = new THREE.Sphere(P, R), stat = { n: 0, hid: 0 };
  let t = 0;
  let scene = null; const inScene = m => { for (let q = m; q; q = q.parent) if (q === scene) return true; return false; };
  const show = m => { const u = m.userData; u.pedFar = 0; m.visible = u.pedVis !== false; m.matrixWorldAutoUpdate = true; };
  return {
    add(m) { if (m) set.add(m); return m; },
    tick(cam, dt) {
      if ((t += dt) < 0.1) return; t = 0; scene = getScene();
      cam.updateMatrixWorld(); M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(M);
      const far = FAR[gfxLevel()] || FAR.mid, f2 = far * far; let n = 0, hid = 0;
      for (const m of set) {
        const u = m.userData;
        if (!m.parent) { if (u.pedFar) show(m); if ((u.pedGone = (u.pedGone || 0) + 1) > GONE) set.delete(m); continue; }
        u.pedGone = 0; if (!inScene(m)) continue;
        m.updateWorldMatrix(true, false); P.setFromMatrixPosition(m.matrixWorld);
        const off = P.distanceToSquared(cam.position) > f2 || !fr.intersectsSphere(sp);
        if (off && !u.pedFar) { u.pedFar = 1; u.pedVis = m.visible; m.visible = false; m.matrixWorldAutoUpdate = false; }
        else if (!off && u.pedFar) show(m);
        n++; if (u.pedFar) hid++;
      }
      stat.n = n; stat.hid = hid;
    },
    off() { for (const m of set) if (m.userData.pedFar) show(m); },
    stat: () => ({ ...stat, tracked: set.size }),
  };
}
