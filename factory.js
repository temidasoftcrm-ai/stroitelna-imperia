// factory.js — 🏭 ind-factory (f6, модел на потребителя — Meshy, Темидасофт): заводът в индустриалната зона в края на града.
// Хале ~65 × 64 м, два червено-бели комина по 52 м (Blender: Body, Smoke_<i> — върховете на комините, Beacon_<i> — червените лампи).
// Мястото: извън границата на града (не се пипат парцелите — старите записи остават същите), на сушата, далеч от улиците и жп линията;
// 1 завод в малките и средните градове, 2 — в големите; лицето — към центъра. Нощем: прозорците (тъмносиньото стъкло) светят топло,
// лампите на комините мигат червено; от комините винаги излиза дим.
//   game.js: placeFactories({ THREE, P, model, group, tier, railX, addWin }) → { update(dt, night), clear() }
const FW = 66, PAD = 26;   // м: страната на завода; празното около него до улица

export function placeFactories(o) {
  const { THREE, P, group } = o, out = [], sq = P.square || P.center || { x: 0, z: 0 }, tg = P.toGame || ((x, z) => [x, z]);
  const B = (P.p2 && P.p2.boundary || []).map(p => tg(p[0], p[1])); if (B.length < 3) return null;
  const pts = []; for (const s of P.streets || []) for (const p of s.pts || []) pts.push([p[0] ?? p.x, p[1] ?? p.z]);
  const near = (x, z) => { let m = 1e9; for (const [a, b] of pts) { const d = Math.hypot(a - x, b - z); if (d < m) m = d; } return m; };
  const wet = (x, z) => !!(P.waterAt && [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([u, v]) => P.waterAt(x + u * FW / 2, z + v * FW / 2)));
  const cand = [], step = Math.max(1, Math.floor(B.length / 72));
  for (let i = 0; i < B.length; i += step) { const [bx, bz] = B[i], dx = bx - sq.x, dz = bz - sq.z, l = Math.hypot(dx, dz) || 1, x = bx + dx / l * (FW / 2 + PAD), z = bz + dz / l * (FW / 2 + PAD);
    if (wet(x, z) || (o.railX != null && Math.abs(x - o.railX) < FW / 2 + 40)) continue;
    const r = near(x, z); if (r < FW * 0.71 + PAD * 0.6) continue; cand.push({ x, z, r, a: Math.atan2(dx, dz) }); }
  cand.sort((a, b) => b.r - a.r);
  const n = o.tier === 'l' || o.tier === 'xl' ? 2 : 1, pick = [];
  for (const c of cand) { if (pick.length >= n) break; if (pick.every(p => Math.hypot(p.x - c.x, p.z - c.z) > 300)) pick.push(c); }
  const beacons = [], smokes = [], tex = smokeTex(THREE);
  for (const c of pick) { const m = o.model(); if (!m) break; m.position.set(c.x, 0, c.z); m.rotation.y = c.a + Math.PI;   // лицето (+z) — към центъра
    m.traverse(q => { if (q.isMesh && /^Beacon/.test(q.name)) { q.material = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); q.scale.setScalar(1.3); beacons.push(q.material); } });
    group.add(m); out.push(m); m.updateMatrixWorld(true);
    m.traverse(q => { if (/^Smoke_/.test(q.name)) { const w = q.getWorldPosition(new THREE.Vector3()); smokes.push(plume(THREE, group, tex, w, out)); } }); }
  if (!out.length) return null;
  return { list: out, at: pick.map(c => ({ x: Math.round(c.x), z: Math.round(c.z) })),
    update(dt, night) { const t = performance.now() / 1000; for (const b of beacons) b.opacity = t % 1.6 < 0.35 ? 0.12 + 0.88 * night : 0.04 * night;   /* денем — едва */ for (const s of smokes) s(dt, night); },
    clear() { for (const m of out) m.parent && m.parent.remove(m); } };
}
// нощем: тъмносиньото стъкло на прозорците (синьото преобладава, тъмно) по стените — топла светлина; addWin — dayNight.winMats
export function factoryNight(root, THREE, addWin) {
  root.traverse(o => { if (!o.isMesh || /^Beacon/.test(o.name) || !o.material || !o.material.map) return; const mt = o.material = o.material.clone();
    mt.emissive = new THREE.Color(0xffffff); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0; mt.userData.winK = 1.5; mt.flatShading = true;   /* flat — нормалата от геометрията (олекотеният Meshy има обърнати стени — денем бяха тъмни) */
    mt.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 tx = texture2D(emissiveMap, vEmissiveMapUv).rgb; vec3 wN = inverseTransformDirection(normal, viewMatrix); float lum = dot(tx, vec3(0.333));
        float m = step(abs(wN.y), 0.5) * step(tx.r * 2.5 + 0.01, tx.b) * step(tx.g * 1.5, tx.b) * (1.0 - smoothstep(0.03, 0.06, lum));   /* само най-тъмното синьо стъкло */
        totalEmissiveRadiance = (vec3(1.0, 0.74, 0.42) * m + tx * vec3(1.0, 0.85, 0.65) * 0.3) * emissive.r; }`); };   /* + меки прожектори по фасадата (иначе нощем е черна маса) */
    mt.customProgramCacheKey = () => 'factory-night'; addWin(mt); });
}
let SMOKE = null;
function smokeTex(THREE) {
  if (SMOKE) return SMOKE; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64), t = new THREE.DataTexture(new Uint8Array(d.data), 64, 64); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return (SMOKE = t);   // DataTexture — не платно (черните текстури, v3.2.1)
}
// димът от комина: спрайтове, които се издигат ~45 м, растат и избледняват, леко отнесени от вятъра; нощем — по-тъмни
function plume(THREE, group, tex, p, out) {
  const ps = [], N = 14, g = new THREE.Group(); group.add(g); out.push(g);
  for (let i = 0; i < N; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xd8d8d8, transparent: true, depthWrite: false, opacity: 0 })); g.add(s); ps.push({ s, t: i / N, j: Math.random() * 6 }); }
  return (dt, night) => { const c = 0.85 - 0.55 * night; for (const q of ps) { q.t = (q.t + dt * 0.05) % 1; const k = q.t; q.s.position.set(p.x + k * 14 + Math.sin(k * 4 + q.j) * 1.5, p.y + 1 + k * 45, p.z + k * 5); q.s.scale.setScalar(3 + k * 16); q.s.material.color.setScalar(c); q.s.material.opacity = 0.6 * (1 - k) * Math.min(1, k * 8); } };
}
