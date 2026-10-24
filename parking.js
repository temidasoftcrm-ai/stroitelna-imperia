// parking.js — 🅿️ park-api (55, backlog 25.10 №5): паркингите на празните парцели (yards-real → parkLayout) за трафика —
// местата, входът/изходът (стрелките) и пътищата от мястото до улицата и обратно, в световни координати; и кои места са свободни.
// Паркингът се записва при строежа на парцела (game.js → decorLot); колите, които вече стоят там, са в spot.car (Object3D).
//   const P = parks.near(x, z, 60)[0];  const s = parks.freeSpot(P) / parks.takenSpot(P)
//   parks.leave(s) → { car, out: [[x, z]…], rev } — колата тръгва: моделът се скрива (агентът я поема), out — от мястото до улицата (rev — първата отсечка на заден)
//   parks.arrive(s) → { in: [[x, z]…] } (запазва мястото); parks.park(s, obj?) — колата спря: показва модела на мястото (или сложи obj там)
// Рамката на паркинга (като в parkLayout): a — по улицата, b — навътре (+b към улицата); мястото — [a, b, da, db, бус], (da, db) — накъдето гледа колата.
export function createParkings() {
  const list = [];
  const W = (P, a, b) => [P.x + a * P.c + b * P.s, P.z - a * P.s + b * P.c];   // локално (a, b) → свят (x, z) — същото като at() в decorLot
  const D = (P, da, db) => [da * P.c + db * P.s, -da * P.s + db * P.c];
  // id, x, z — центърът; rot — завъртането на парцела; L — parkLayout; ext — устието до тротоара (м); cars — [индекс на мястото] → Object3D
  function add({ id, x, z, rot = 0, L, ext = 0.5, cars = {} }) {
    const P = { id, x, z, rot, c: Math.cos(rot), s: Math.sin(rot), L, spots: [] }, b1 = Math.max(...L.asphalt.map(r => r[3])), bOut = b1 + ext;
    const lane = db => { const a = L.arrows.find(r => r[3] === db && r[2] === 0); return a ? a[0] : null; };   // лентата навътре (db = -1) и навън (+1)
    const A = L.mouth.length === 1;   // A: пътеката навътре, едно устие; B: пътеката покрай тротоара — вход в единия край, изход в другия
    const aIn = lane(-1), aOut = lane(1), aC = A ? (L.mouth[0][0] + L.mouth[0][1]) / 2 : null, bA = A ? null : b1 - 3;   // bA — оста на пътеката (B: 6 м покрай тротоара)
    P.mouthIn = [W(P, aIn, bOut), D(P, 0, -1)]; P.mouthOut = [W(P, aOut, bOut), D(P, 0, 1)];   // точката на тротоара и посоката (навътре / навън)
    P.arrows = L.arrows.map(([a, b, da, db]) => [...W(P, a, b), ...D(P, da, db)]);
    L.spots.forEach(([a, b, da, db, van], i) => {
      const aisle = A ? [aC, b] : [a, bA];   // пред мястото, на пътеката (колите са с муцуната навътре — излизат на заден)
      const out = A ? [[a, b], aisle, [aOut, b], [aOut, b1], [aOut, bOut]] : [[a, b], aisle, [aOut, bA], [aOut, bOut]];
      const inn = A ? [[aIn, bOut], [aIn, b1], [aIn, b], aisle, [a, b]] : [[aIn, bOut], [aIn, bA], aisle, [a, b]];
      const [dx, dz] = D(P, da, db), [x0, z0] = W(P, a, b);
      P.spots.push({ P, i, x: x0, z: z0, yaw: Math.atan2(dx, dz), van: !!van, car: cars[i] || null, state: cars[i] ? 'taken' : 'free', back: !!cars[i]?.userData.parkBack,   /* back — паркирана на заден (муцуната към пътеката): излиза напред */
        door: [x0 + dz * 1.1, z0 - dx * 1.1],   // шофьорската врата — отляво на колата (+x, когато гледа към +z)
        out: out.map(([u, v]) => W(P, u, v)), in: inn.map(([u, v]) => W(P, u, v)) });
    });
    list.push(P); return P;
  }
  const near = (x, z, r = 80) => list.filter(P => Math.hypot(P.x - x, P.z - z) <= r).sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z));
  const freeSpot = (P, van = false) => P.spots.find(s => s.state === 'free' && (!van || s.van)) || null;
  const takenSpot = P => { const t = P.spots.filter(s => s.state === 'taken' && s.car); return t.length ? t[(Math.random() * t.length) | 0] : null; };
  const occ = P => P.spots.filter(s => s.state !== 'free').length / Math.max(1, P.spots.length);
  function leave(s) { if (s.state !== 'taken') return null; s.state = 'leaving'; if (s.car) s.car.visible = false; return { car: s.car, out: s.out, rev: !s.back }; }
  function arrive(s) { if (s.state !== 'free') return null; s.state = 'arriving'; return { in: s.in }; }
  function park(s, obj) { if (obj) { s.car = obj; obj.position.set(s.x, obj.position.y, s.z); obj.rotation.y = s.yaw; s.back = false; } if (s.car) s.car.visible = true; s.state = s.car ? 'taken' : 'free'; return s; }
  function release(s) { if (s.car && s.state === 'leaving') s.car.visible = false; s.state = 'free'; return s; }   // колата е излязла от паркинга (моделът остава скрит — мястото е свободно)
  const clear = () => { list.length = 0; };
  return { list, add, near, freeSpot, takenSpot, occ, leave, arrive, park, release, clear };
}
