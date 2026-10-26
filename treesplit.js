// treesplit.js — горските пакети (Sketchfab) → отделни дървета с височина 1 и основа в 0 (A['sf-…-N'] в game.js; дърветата в online3d.js — trees-kenney-off)
import * as THREE from 'three';

export function splitTrees(scene, { trunksOnly = false, glow = 0x2c3a24, plain = false } = {}) {
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse(o => { if (o.isMesh && !/plane|rock|background/i.test(o.name)) parts.push({ o, b: new THREE.Box3().setFromObject(o), trunk: /bark|trunk|trank/i.test(o.name + ' ' + (o.material?.name || '')) }); });
  const trunks = parts.filter(p => p.trunk), groups = trunks.map(t => [t]), solo = [];
  for (const p of parts) {
    if (p.trunk) continue;
    const c = p.b.getCenter(new THREE.Vector3());
    let best = -1, bd = Infinity;
    trunks.forEach((t, i) => { const tc = t.b.getCenter(new THREE.Vector3()), d = Math.hypot(c.x - tc.x, c.z - tc.z); if (d < bd) { bd = d; best = i; } });
    const t = trunks[best];
    if (t && bd < Math.max(3, (t.b.max.y - t.b.min.y) * 0.6)) groups[best].push(p); else if (!trunksOnly) solo.push([p]);
  }
  return [...groups, ...solo].map(list => {
    const b = new THREE.Box3(); for (const p of list) b.union(p.b);
    const base = (list.find(p => p.trunk) || list[0]).b.getCenter(new THREE.Vector3()), h = b.max.y - b.min.y, g = new THREE.Group();
    for (const p of list) {
      const m = p.o.clone(); m.matrixAutoUpdate = false;
      m.matrix.copy(p.o.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(-base.x, -b.min.y, -base.z)).premultiply(new THREE.Matrix4().makeScale(1 / h, 1 / h, 1 / h));
      const mt = m.material; if (mt && mt.transparent && mt.map) { mt.transparent = false; mt.alphaTest = 0.5; mt.depthWrite = true; mt.side = THREE.DoubleSide; }
      if (mt && mt.isMeshStandardMaterial) { mt.metalness = 0; mt.roughness = 0.9; }   // glTF по подразбиране е метален — без огледална среда излиза черно
      if (!plain && !p.trunk && mt && mt.map) {   // листата: нормали навън като от кълбо + малко собствена светлина — иначе плоските карти са черни отдолу
        const geo = m.geometry = m.geometry.clone(), pos = geo.attributes.position, c = p.lb || (p.lb = new THREE.Box3().setFromBufferAttribute(pos).getCenter(new THREE.Vector3())), nrm = new Float32Array(pos.count * 3), v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).sub(c).normalize(); v.y += 0.6; v.normalize(); nrm.set([v.x, v.y, v.z], i * 3); }
        geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
        if (mt.emissive) { mt.emissive.set(glow); mt.emissiveIntensity = 1; }
      }
      g.add(m);
    }
    return g;
  });
}
