// perfstill.js — ⚡ perf3-still: неподвижното в града не преизчислява матриците си всеки кадър.
// three.js обхожда цялата сцена (scene.updateMatrixWorld) при всяко рисуване — в Пловдив ~28 000 обекта, ~21 ms на кадър, а почти всичко стои
// (сградите, забележителностите, църквите с хиляди части). Тук всяко пряко дете на корените (city.group, сцената) има „подпис“ — сбор от
// местата/завъртанията/мащабите на поддървото и броя възли; ако не се е сменил няколко проверки подред, поддървото се замразява
// (матриците — веднъж, matrixWorldAutoUpdate = false). Замразените се проверяват на всеки 4 кадъра (разпределено): щом нещо мръдне,
// се добави или махне — веднага обратно. Скелетите, колите в движение и анимациите сменят подписа си постоянно и не се замразяват.
// Голяма група (≥ 40 възела), в която нещо мърда (хората на площада, работниците в завода), но самата тя стои — следят се децата ѝ
// поотделно (до 3 нива): стоящото в нея замръзва, мърдащото — не; мръдне ли самата група — всичко в нея се размразява.
const CHK_FROZEN = 4, CHK_LIVE = 8, STILL_N = 4, SPLIT_MIN = 40, DEPTH = 3;

function sig(o) {
  let s = 0, n = 0;
  o.traverse(q => { n++; const p = q.position, r = q.quaternion, k = q.scale;
    s += p.x * 1.31 + p.y * 2.71 + p.z * 3.11 + r.x * 5.3 + r.y * 7.1 + r.z * 11.3 + r.w * 13.7 + k.x * 17.1 + k.y * 19.3 + k.z * 23.9;
    if (!q.matrixAutoUpdate) { const e = q.matrix.elements; s += e[0] * 29.1 + e[2] * 31.3 + e[5] * 37.7 + e[8] * 41.1 + e[10] * 43.3 + e[12] * 47.9 + e[13] * 53.1 + e[14] * 59.3; } });   // ръчните матрици
  return s + n * 1000.37;
}
const own = q => { const p = q.position, r = q.quaternion, k = q.scale; let s = p.x * 1.31 + p.y * 2.71 + p.z * 3.11 + r.x * 5.3 + r.y * 7.1 + r.z * 11.3 + r.w * 13.7 + k.x * 17.1 + k.y * 19.3 + k.z * 23.9;
  if (!q.matrixAutoUpdate) { const e = q.matrix.elements; s += e[12] * 47.9 + e[13] * 53.1 + e[14] * 59.3 + e[0] * 29.1 + e[10] * 43.3; } return s; };   // само собственото място на групата

export function createStill() {
  const st = new WeakMap(), frozen = new Set(); let f = 0;
  const thaw = o => { o.matrixWorldAutoUpdate = true; o.updateMatrixWorld(true); frozen.delete(o); const s = st.get(o); if (s) { s.frozen = false; s.still = 0; } };
  const thawIn = c => { for (const o of [...frozen]) { for (let q = o.parent; q; q = q.parent) if (q === c) { thaw(o); break; } } };   // всичко замразено вътре в c
  const visit = (P, d) => { const K = P.children;
    for (let i = 0; i < K.length; i++) { const c = K[i]; if (c.isCamera || c.isLight || c.userData.stillRoot) continue;
      let s = st.get(c); if (!s) st.set(c, s = { sig: NaN, still: 0, frozen: false, split: false, own: NaN, n: 0 });
      if (s.split) {   // група, разделена на децата си: само собственото ѝ място — мръдне ли, всичко вътре обратно
        if ((f + i) % CHK_LIVE === 0) { const w = own(c); if (w !== s.own) { s.own = w; thawIn(c); } }
        visit(c, d + 1); continue; }
      if ((f + i) % (s.frozen ? CHK_FROZEN : CHK_LIVE) !== 0) continue;
      const g = sig(c);
      if (g === s.sig) { if (!s.frozen && ++s.still >= STILL_N) { c.updateMatrixWorld(true); c.matrixWorldAutoUpdate = false; s.frozen = true; frozen.add(c); } }
      else { s.sig = g; s.still = 0; if (s.frozen) thaw(c); const w = own(c); if (w === s.own) s.n++; else { s.own = w; s.n = 0; }   // n — колко проверки самата група стои
        if (s.n >= STILL_N && d < DEPTH && c.children.length) { let k = 0; c.traverse(() => k++); if (k >= SPLIT_MIN) s.split = true; } } }   // мърда нещо вътре, групата стои и е голяма — по децата
  };
  return {
    // roots — корените, чиито деца се следят (city.group, scene); корен вътре в друг корен не се следи като дете
    tick(roots) {
      f++; for (const R of roots) if (R) R.userData.stillRoot = true;
      if (f % 30 === 0) for (const o of [...frozen]) { let ok = false; for (let q = o.parent; q; q = q.parent) if (q.userData.stillRoot) { ok = true; break; } if (!ok || !o.parent) { thaw(o); st.delete(o); } }   // махнатото — обратно към нормалното
      for (const R of roots) if (R) visit(R, 1);
    },
    off() { for (const o of [...frozen]) thaw(o); },   // изключено (сравнение) — всичко обратно
    stats: () => ({ frozen: frozen.size }),
  };
}
