// inspect.js — 🔍 Преглед (T1, Лабораторията): клик върху обект в града → какво е (модел, GLB, флаг, размер в м, парцел) и устойчив id;
// поправките на потребителя (assets/plans/overrides.json: { град: { id: { dx, dz, rot, k, hide, swap } } }) — върху обектите в града.
// Устойчивите id: парцел — 'lot:p2:<id от плана>' (или 'lot:<номер>' в старите планове); забележителност — 'lm:<вид>'; модел в галерията — 'model:<име>';
// другото (коли, дървета…) — '<вид>:<име>@x,z' (само за „🐞 Проблем“, без поправки).
// const I = createInspector({ THREE, scene, camera, renderer, dom, ident(obj) → info|null, onPick(info) });  I.on(true); I.shot(w) → dataURL
export function createInspector(o) {
  const { THREE } = o, ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
  let on = false, down = null, box = null;
  const pick = e => {
    const r = o.dom.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, o.camera);
    const hits = ray.intersectObjects(o.scene.children, true);
    for (const h of hits) { let m = h.object, vis = true; for (let p = m; p; p = p.parent) if (!p.visible) { vis = false; break; } if (!vis || m.isSprite || m.isPoints || m.isLine || /^sky/i.test(m.name || '') || (m.material && m.material.side === THREE.BackSide)) continue;   // небето (купол отвътре) — не
      const info = o.ident(m, h); if (info) return info; }
    return null;
  };
  const show = root => { if (box) { o.scene.remove(box); box.geometry.dispose(); box = null; } if (!root) return; box = new THREE.BoxHelper(root, 0xffd23f); box.renderOrder = 999; box.material.depthTest = false; o.scene.add(box); };
  const pd = e => { if (on && e.button === 0) down = [e.clientX, e.clientY, performance.now()]; };
  const pu = e => { if (!on || !down || e.button !== 0) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || performance.now() - down[2] > 600; down = null; if (moved) return;
    const info = pick(e); show(info && info.root); if (info) { const { root, ...rest } = info; o.onPick(rest, root); } };
  o.dom.addEventListener('pointerdown', pd); o.dom.addEventListener('pointerup', pu);
  return {
    on(v) { on = !!v; if (!on) show(null); return on; },
    refresh(root) { show(root); },
    shot(w = 960) {   // снимка на текущия кадър (рендира и чете веднага — без preserveDrawingBuffer), умалена до w px, JPEG
      o.renderer.render(o.scene, o.camera); const c = o.renderer.domElement, k = Math.min(1, w / c.width), t = document.createElement('canvas'); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k);
      t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.82); },
    dispose() { o.dom.removeEventListener('pointerdown', pd); o.dom.removeEventListener('pointerup', pu); show(null); },
  };
}
// поправките: base — първоначалното положение (пази се в userData.ovBase при първото прилагане; при нова поправка — от него)
export function applyOverride(THREE, root, op, swapModel) {
  if (!root) return false; const u = root.userData;
  if (!u.ovBase) u.ovBase = { p: root.position.clone(), r: root.rotation.y, s: root.scale.clone(), v: root.visible };
  const b = u.ovBase;
  if (op && op.swap && op.swap !== u.ovSwap && swapModel) { if (swapModel(root, op.swap)) u.ovSwap = op.swap; }
  root.position.set(b.p.x + (op && op.dx || 0), b.p.y, b.p.z + (op && op.dz || 0));
  root.rotation.y = b.r + (op && op.rot || 0) * Math.PI / 180;
  root.scale.copy(b.s).multiplyScalar(op && op.k || 1);
  root.visible = op && op.hide ? false : b.v;
  return true;
}
