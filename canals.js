// canals.js — 🛶 ams-canals (f6, прегледът на дизайнера: „Амстердам няма канали — табелите „Канал с къщи“ са над обикновени улици“):
// трите полукръгли канала на грахтенгордела (Херенграхт, Кайзерсграхт, Принсенграхт) в плана v2 (cityplan2.js → P.canals: център, радиуси, полуширина).
// Тук — само изгледът, в рамката на плана (детето на planView): вода, тухлени кейови стени, дървени колове, лодки, които бавно плават по каналите
// (нощем — светещи прозорчета). Мостовете са пътищата над водата (cityplan2.js ги прави сам), парцелите не стъпват във водата.
//   game.js: pv.add(canalsView(P.p2, () => dayNight.night)) — само в новите игри (S.canals) с флага.
import * as THREE from 'three';

const WATER = new THREE.MeshStandardMaterial({ color: 0x2f5563, roughness: 0.15, metalness: 0.25 });
const BRICK = new THREE.MeshStandardMaterial({ color: 0x7a4535, roughness: 0.9 });
const STONE = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.85 });
const WY = 0.06, TOP = 0.42;   // водата и горният ръб на кейовата стена

// дъга около центъра c с радиус r между ъглите a0…a1 → точки; ok(x, z) — изрязва частите над залива
function arc(c, r, a0, a1, step = 4, n = Math.max(2, Math.ceil((a1 - a0) * r / step))) { const out = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, a]); } return out; }
function ribbon(inner, outer, y) {   // лента между две успоредни дъги
  const pos = [], idx = []; inner.forEach((p, i) => { const q = outer[i]; pos.push(p[0], y, p[1], q[0], y, q[1]); if (i) { const k = 2 * i; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function wall(pts, y0, y1) {   // вертикална стена по дъгата
  const pos = [], idx = []; pts.forEach((p, i) => { pos.push(p[0], y0, p[1], p[0], y1, p[1]); if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function canalsView(P, night = () => 0) {
  const CN = P.canals, G = new THREE.Group(); G.name = 'canals'; if (!CN) return G;
  const land = (x, z) => !P.coastZ || z > P.coastZ(x) + 1;   // само откъм сушата (заливът е морето на seaside.js)
  const win = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc878, emissiveIntensity: 0 });
  win.onBeforeRender = () => { win.emissiveIntensity = 1.4 * night(); };
  const boats = [];
  CN.rings.forEach((rc, ri) => {
    // частите на полукръга над сушата (откъм залива дъгата излиза в морето — там свършва)
    const full = arc(CN.c, rc, 0, Math.PI, 3), runs = []; let cur = [];
    for (const p of full) { if (land(p[0], p[1])) cur.push(p[2]); else if (cur.length) { runs.push(cur); cur = []; } }
    if (cur.length) runs.push(cur);
    for (const r of runs) { if (r.length < 3) continue; const a0 = r[0], a1 = r[r.length - 1];
      const N = Math.max(2, Math.ceil((a1 - a0) * rc / 4)), inn = arc(CN.c, rc - CN.hw, a0, a1, 4, N), out = arc(CN.c, rc + CN.hw, a0, a1, 4, N);   // еднакъв брой точки — лентите свързват точка с точка
      const w = new THREE.Mesh(ribbon(inn, out, WY), WATER); w.receiveShadow = true; G.add(w);
      for (const [edge, sgn] of [[inn, 1], [out, -1]]) {   // кейовите стени (лицето — към водата) и каменен ръб отгоре
        const m = new THREE.Mesh(wall(sgn > 0 ? edge : edge.slice().reverse(), WY - 0.05, TOP), BRICK); m.castShadow = m.receiveShadow = true; G.add(m);
        const lip = arc(CN.c, rc + (sgn > 0 ? -CN.hw - 0.6 : CN.hw + 0.6), a0, a1, 4, N); G.add(new THREE.Mesh(ribbon(edge, lip, TOP), STONE));
      }
      // дървени колове за привързване по външния кей
      const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 }), Math.ceil((a1 - a0) * rc / 9) + 1), M = new THREE.Matrix4();
      let n = 0; for (let a = a0; a <= a1 && n < posts.count; a += 9 / rc) { M.makeTranslation(CN.c[0] + Math.cos(a) * (rc + CN.hw - 0.4), 0.45, CN.c[1] + Math.sin(a) * (rc + CN.hw - 0.4)); posts.setMatrixAt(n++, M); }
      posts.count = n; G.add(posts);
      // лодки: туристически корабчета (дълги, стъклен покрив) и малки лодки; плават бавно по средата на канала
      for (let k = 0; k < 3; k++) {
        const b = new THREE.Group(), big = k === 0, L = big ? 18 : 5, Wb = big ? 3.6 : 1.8, col = [0x203a5a, 0x7a2a2a, 0x2f5f3a, 0x5a4a2a][(ri + k) % 4];
        const hull = new THREE.Mesh(new THREE.BoxGeometry(Wb, 0.7, L), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); hull.position.y = 0.3; b.add(hull);
        if (big) { const cab = new THREE.Mesh(new THREE.BoxGeometry(Wb * 0.9, 1.1, L * 0.8), new THREE.MeshStandardMaterial({ color: 0x9fc4d6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.75 })); cab.position.y = 1.2; b.add(cab);
          const w2 = new THREE.Mesh(new THREE.BoxGeometry(Wb * 0.92, 0.25, L * 0.78), win); w2.position.y = 0.95; b.add(w2); }
        else { const seat = new THREE.Mesh(new THREE.BoxGeometry(Wb * 0.8, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0xe8e1cf })); seat.position.set(0, 0.75, -0.8); b.add(seat); }
        b.traverse(m => { if (m.isMesh) m.castShadow = true; });
        G.add(b); boats.push({ b, rc, a0: a0 + 0.05, a1: a1 - 0.05, ph: (k + ri * 0.37) / 3, sp: (big ? 1.6 : 2.4) / rc * (k % 2 ? -1 : 1), lane: (k % 2 ? -1 : 1) * CN.hw * 0.35 });
      }
    }
  });
  // движението — от onBeforeRender на водата (изгледът няма собствен update); време — истинско (лодките не бързат на ▶▶▶)
  const t0 = performance.now(), drive = () => { const t = (performance.now() - t0) / 1000;
    for (const q of boats) { const span = q.a1 - q.a0, u = ((q.ph + t * Math.abs(q.sp) / span) % 2), f = u < 1 ? u : 2 - u, dir = (u < 1 ? 1 : -1) * Math.sign(q.sp), a = q.a0 + span * (q.sp > 0 ? f : 1 - f), r = q.rc + q.lane * dir;
      q.b.position.set(CN.c[0] + Math.cos(a) * r, Math.sin(t * 1.3 + q.ph * 9) * 0.05, CN.c[1] + Math.sin(a) * r); q.b.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)) + ((u < 1) === (q.sp > 0) ? 0 : Math.PI); } };   // носът — по допирателната, накъдето расте/намалява ъгълът
  const w0 = G.children.find(c => c.material === WATER); if (w0) w0.onBeforeRender = drive;
  G.userData.canals = { rings: CN.rings.length, boats: boats.length };
  return G;
}
