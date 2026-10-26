// cityground.js — 🧱 city-ground (f6, прегледът на дизайнера: „гол пясък в мегаполисите“): основата на изгледа по истинската карта (cityplan2-3d.js —
// MAT.urban, бежово навсякъде между кварталите) — по града: Москва, Рим и Лас Вегас — павета / бетонни плочи, Ню Йорк — трева (празните парцели около
// централата и брегът на Ню Джързи отсреща); в Кремъл — тревните площи. Земята няма UV — шарката е по световните x/z в шейдъра (плочи с фуги / петна трева).
//   game.js: cityGround(pv, cityId, plan) — преди weather.setGround (снегът оцветява новия материал). Само градовете в CG; другите — както са.
import * as THREE from 'three';

const CG = {
  moscow: { kind: 'pave', col: 0xa9a49c, tile: 1.6, lawns: /kreml/i },   // гранитни павета (Червеният площад), тревата на Кремъл
  rome: { kind: 'pave', col: 0xb3a998, tile: 1.2 },                     // санпиетрини
  lasvegas: { kind: 'pave', col: 0xcfc6b6, tile: 4.5, apron: 0xd6cfc2 },                 // светли бетонни плочи
  newyork: { kind: 'grass', col: 0x6f9a52, apron: 0xbdbcb6 },           // трева: празните парцели и Ню Джързи; дворовете/площадките в кварталите — бетон (бяха бежов калдъръм)
};
export const cityGroundOn = id => !!CG[id];

function groundMat(c, base) {
  const m = new THREE.MeshStandardMaterial({ color: c.col, roughness: 0.95 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTile = { value: c.tile || 1 }; sh.uniforms.uKind = { value: c.kind === 'grass' ? 1 : 0 };
    sh.vertexShader = 'varying vec3 vCgW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vCgW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vCgW; uniform float uTile, uKind;
      float cgH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cgN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(cgH(i), cgH(i + vec2(1, 0)), f.x), mix(cgH(i + vec2(0, 1)), cgH(i + vec2(1, 1)), f.x), f.y); }
      ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { vec2 p = vCgW.xz; float k;
        if (uKind < 0.5) { vec2 q = p / uTile; q.x += floor(q.y) * 0.5; vec2 f = fract(q), id = floor(q);   // плочи на редове (разминати), фуга, всяка — малко различна
          float j = step(0.06, f.x) * step(f.x, 0.94) * step(0.06, f.y) * step(f.y, 0.94);
          float aa = clamp(1.6 - 4.0 * max(fwidth(q.x), fwidth(q.y)), 0.0, 1.0);   // отдалеч (плочата < ~3 пиксела) фугите и разликите изчезват → средният тон, без трептене/шум
          k = mix(0.93, mix(0.62, 0.9 + 0.2 * cgH(id), j), aa) * (0.92 + 0.12 * cgN(p * 0.05)); }
        else { float aa = clamp(1.5 - 3.0 * fwidth(p.x * 0.35), 0.0, 1.0); k = 0.78 + mix(0.14, 0.28 * cgN(p * 0.35), aa) + 0.12 * cgN(p * 0.04) - 0.08 * mix(0.5, cgN(p * 2.1), aa * aa); }   // трева: петна в няколко мащаба
        diffuseColor.rgb *= k; }`);
  };
  m.customProgramCacheKey = () => 'cg-' + (c.kind || 'pave');
  if (base && base.userData) m.userData = { ...base.userData };
  return m;
}

// pv — изгледът (cityplan2-3d.js); plan — планът на града (landmarks в рамката на играта, toPlan)
export function cityGround(pv, cityId, plan) {
  const c = CG[cityId]; if (!c || !pv || !pv.userData.groundMat) return false;
  const old = pv.userData.groundMat, m = groundMat(c, old);
  pv.traverse(o => { if (o.isMesh && o.material === old) o.material = m; });
  pv.userData.groundMat = m;
  if (c.apron) {   // текстурираните плоски настилки в кварталите (бежовият калдъръм) — светли бетонни плочи
    const am = groundMat({ kind: 'pave', col: c.apron, tile: 2.5 }), swap = new Map(); let n = 0;
    pv.traverse(o => { if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return; const mt = o.material; if (!mt.map || mt === m || (mt.color && mt.color.getHex() !== 0xffffff)) return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox; if (bb.max.y - bb.min.y > 0.3 || (bb.max.x - bb.min.x) * (bb.max.z - bb.min.z) < 5000) return;
      o.material = am; n++; });
    pv.userData.cgApron = n;
  }
  if (c.lawns && plan) {   // Кремъл: плоската бежова основа на модела (≥ 90 × 90 м, до 150 м от него) — трева; в средата — павиран Катедрален площад. Моделите идват по-късно → опити през 2 с
    const L = (plan.landmarks || []).filter(l => c.lawns.test(l.k || l.kind || l.id || '')), grass = groundMat({ kind: 'grass', col: 0x6f9a52 }), pave = groundMat({ kind: 'pave', col: 0xa9a49c, tile: 1.4 });
    const B = new THREE.Box3(), S = new THREE.Vector3(), C = new THREE.Vector3(); let tries = 0; pv.userData.cgLawns = 0;
    const scan = () => { const root = pv.parent; let n = 0;
      if (root) for (const l of L) root.traverse(o => { if (!o.isMesh || o.userData.cgDone || Array.isArray(o.material) || !o.material.color) return;
        B.setFromObject(o).getSize(S); B.getCenter(C); if (S.y > 2 || S.x < 90 || S.z < 90 || Math.hypot(C.x - l.x, C.z - l.z) > 150) return;
        const col = o.material.color; if (!(col.r > col.b + 0.05 && col.g > col.b)) return;   // само бежовите плочи
        o.material = grass; o.userData.cgDone = true; n++;
        if (!l.cgSq) { l.cgSq = true; const y0 = B.max.y; let top = -1, tx = l.x, tz = l.z; const B2 = new THREE.Box3(), C2 = new THREE.Vector3(); root.traverse(q => { if (!q.isMesh || q === o) return; B2.setFromObject(q); B2.getCenter(C2); if (Math.hypot(C2.x - l.x, C2.z - l.z) < 150 && B2.max.y > top && B2.max.y < 120) { top = B2.max.y; tx = C2.x; tz = C2.z; } });   /* площадът — около най-високата сграда (камбанарията „Иван Велики“) */
          const sq = new THREE.Mesh(new THREE.CircleGeometry(28, 32).rotateX(-Math.PI / 2), pave); sq.scale.set(1.3, 1, 1); sq.position.set(tx, y0 + 0.04, tz); sq.receiveShadow = true; sq.userData.cgDone = true; root.add(sq); } });   // Катедралният площад ~70 м (в мащаба на града)
      pv.userData.cgLawns += n; if (!pv.userData.cgLawns && ++tries < 20) setTimeout(scan, 2000); };
    setTimeout(scan, 1000);
  }
  return true;
}
