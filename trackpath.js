// trackpath.js — пътят на жп линията през града. Параметърът е z (както при правата линия по оста z);
// в крайморските градове северният край свива на запад (концентрични дъги около cx) и продължава покрай брега,
// вместо да влиза в морето. Всеки коловоз (своя x) има свой радиус, затова коловозите остават успоредни.
// trackMap(x, z) → { x, z, yaw } — yaw е завъртането около y (0 = по оста z).
export function makeTrackMap(curve) {
  if (!curve) return (x, z) => ({ x, z, yaw: 0 });
  const { zC, cx } = curve;
  return (x, z) => {
    if (z >= zC) return { x, z, yaw: 0 };
    const r = Math.max(1, x - cx), d = zC - z, L = r * Math.PI / 2;
    if (d <= L) { const th = d / r; return { x: cx + r * Math.cos(th), z: zC - r * Math.sin(th), yaw: th }; }
    return { x: cx - (d - L), z: zC - r, yaw: Math.PI / 2 };
  };
}
// подрежда вагоните на влак по пътя: group е на (0,0,0) без завъртане, децата се поставят поотделно.
// head — параметърът z на първия вагон, dir — +1 (към +z) или −1, gap — дължина на вагон
export function placeCars(group, map, x, head, dir, gap, y = 0) {
  group.position.set(0, 0, 0); group.rotation.set(0, 0, 0);
  let acc = 0;   // вагони с userData.len (истинските модели от trainmodels.js) са по-дълги от gap
  group.children.forEach((m, i) => {
    if (m.userData.rot0 == null) m.userData.rot0 = m.rotation.y;
    const len = m.userData.len ? m.userData.len + 0.5 : gap, d = acc + len / 2 - gap / 2; acc += len;
    const p = map(x, head - dir * d);
    m.position.set(p.x, y, p.z);
    m.rotation.y = m.userData.rot0 + (dir > 0 ? 0 : Math.PI) + p.yaw;
  });
}
