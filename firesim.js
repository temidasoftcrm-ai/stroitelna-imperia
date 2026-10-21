// firesim.js — 🔥 пожарите като последователност (флаг fire-seq; потребителят: „начало → изпращане → пристигане → гасене →
// оценка на щетите → ремонт или разчистване“). Всичко върви по игровото време (пауза — спира).
// Здравина (hp, 100 → 0) и сила на огъня (inten, 0…1) са отделни: огънят сваля здравината, пожарникарите — силата; угасне ли — щетите спират,
// а здравината остава (гасенето не я връща). 100–70% — местен пожар; 69–30% — повече прозорци, опушена фасада;
// под 30% — критична: спешна поръчка за възстановяване; 0% — изгоряла: разчистване и нов строеж.
// Записът: S.fires = [{ id, city, lot, hp, inten, sev, st, t0, arrive, out, order: { kind, st, cost, reward, deadline, prog, stage } }]
//   st: 'travel' (пожарната пътува) → 'fight' (гасене) → 'saved' (спасена) | 'burned' (изгоряла); 'repair' / 'secured' / 'done'
// deps: { S(), group(), scene, lots(), model(n, s), has(n), skinned(n) → { scene, animations } | null, route(x0,z0,x1,z1) → [{x,z}], startPoint(),
//         day() → игрови дни (с дробната част), cam() → Vector3, econ(), hasStaff(k), crewFree() → bool, modal(t, html, buttons), toast(t, kind),
//         fly(lot), save(), rebuild(lot) (нова сграда на парцела), cityId() }
import * as THREE from 'three';
import { flameSprite } from './fireflip.js';

export const FIRE_ST = { travel: '🚒 Пожарната пътува', fight: '🚒 Гасене', saved: '✅ Спасена', burned: '⬛ Изгоряла', repair: '🏗️ Ремонт', secured: '🚧 Обезопасена', done: '✅ Възстановена' };
const TRAVEL = 0.45, KNOCK = 0.9, BURN = 60;   // дни път; колко сила на огъня свалят пожарникарите за ден; колко % здравина на ден при пълна сила × sev
const STAGES = [['🦺 Обезопасяване', 1], ['🏗️ Конструкция', 3], ['🎨 Фасада', 2]], CLEAR = [['🚜 Разчистване', 2], ['🏗️ Нов строеж', 5]];
const fmt = n => Math.round(n).toLocaleString('bg-BG');

export function createFires(deps) {
  const st = () => { const S = deps.S(); return S ? (S.fires = S.fires || []) : []; };
  const vis = new Map();   // id → визуалното (само за пожарите в текущия град)
  let seq = 0;
  const lotOf = f => (deps.lots() || [])[f.lot];

  // ---------- общи текстури ----------
  const puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,190,90,1)'); g.addColorStop(1, 'rgba(255,90,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();

  // табелата над сградата: „🔥 Здравина: 24% · 🚒 Гасене“ + лента
  function makeLabel() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.renderOrder = 12; s.scale.set(16, 4, 1);
    let last = '';
    s.userData.set = (hp, text) => {
      const key = Math.round(hp) + '|' + text; if (key === last) return; last = key;
      const g = c.getContext('2d'); g.clearRect(0, 0, 512, 128);
      g.fillStyle = 'rgba(12,16,24,.86)'; g.beginPath(); g.roundRect(4, 4, 504, 120, 22); g.fill();
      g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(`🔥 Здравина: ${Math.round(hp)}% · ${text}`, 22, 46, 470);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(22, 86, 468, 18);
      g.fillStyle = hp < 30 ? '#ff4040' : hp < 70 ? '#ffb020' : '#43d17a'; g.fillRect(22, 86, 468 * Math.max(0, hp) / 100, 18);
      t.needsUpdate = true;
    };
    return s;
  }

  // точките на прозорците: фасадата откъм улицата (lot.rot), на 3 височини × 4 по ширина — пламъците и димът излизат оттам
  function windowsOf(lot) {
    const o = lot.obj; if (!o) return { pts: [], h: 8, top: 8, ctr: new THREE.Vector3(lot.x, 4, lot.z), n: new THREE.Vector3(0, 0, 1) };
    o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o), h = b.max.y - b.min.y, ctr = b.getCenter(new THREE.Vector3());
    const r = (lot.rot || 0), n = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), side = new THREE.Vector3(n.z, 0, -n.x);
    const half = Math.abs((b.max.x - b.min.x) * n.x) + Math.abs((b.max.z - b.min.z) * n.z), wid = Math.abs((b.max.x - b.min.x) * side.x) + Math.abs((b.max.z - b.min.z) * side.z);
    const pts = []; const rows = h > 14 ? [0.25, 0.5, 0.75] : [0.35, 0.7];
    for (const fy of rows) for (const fx of [-0.33, -0.11, 0.11, 0.33]) pts.push(ctr.clone().addScaledVector(n, half / 2 + 0.25).addScaledVector(side, fx * wid).setY(b.min.y + fy * h));
    pts.sort((a, c) => a.y - c.y || a.x - c.x);   // огънят тръгва отдолу
    return { pts, h, top: b.max.y, ctr, n, side, half, wid };
  }
  // опушването: материалите на тази сграда — собствени копия, тъмнеят с щетите
  function scorch(lot, k) {
    const o = lot.obj; if (!o) return;
    if (!o.userData.scorchMats) { const L = []; o.traverse(m => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.color) { m.material = m.material.clone(); L.push([m.material, m.material.color.clone()]); } }); o.userData.scorchMats = L; }
    const dark = new THREE.Color(0x1a1512);
    for (const [m, c0] of o.userData.scorchMats) m.color.copy(c0).lerp(dark, Math.min(0.85, k));
  }

  function build(f) {
    const lot = lotOf(f), grp = deps.group(); if (!lot || !grp) return null;
    const g = new THREE.Group(); grp.add(g);
    const W = windowsOf(lot), v = { g, W, flames: [], smoke: [], glows: [], steam: [], label: makeLabel(), crew: [], water: null, truck: null, path: null, scaf: null };
    v.label.position.set(W.ctr.x, W.top + 5, W.ctr.z); g.add(v.label);
    for (let i = 0; i < W.pts.length; i++) {   // по една точка на прозорец: пламък + сияние + 2 кълбета дим
      const p = W.pts[i], fl = flameSprite(1); fl.position.copy(p); fl.userData.ph = i * 1.7; fl.visible = false; g.add(fl); v.flames.push(fl);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.copy(p); gl.scale.setScalar(4); gl.visible = false; g.add(gl); v.glows.push(gl);
      for (let k = 0; k < 2; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0x2a2a2a, transparent: true, opacity: 0.5, depthWrite: false })); s.userData = { o: p.clone(), ph: Math.random(), i }; s.visible = false; g.add(s); v.smoke.push(s); }
    }
    for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); s.userData = { ph: k / 6 }; g.add(s); v.steam.push(s); }
    // пожарната: път от края на града до улицата пред сградата
    const park = W.ctr.clone().addScaledVector(W.n, W.half / 2 + 7); park.y = 0;
    const s0 = deps.startPoint(park) || { x: park.x + 120, z: park.z };
    const path = (deps.route(s0.x, s0.z, park.x, park.z) || []).map(p => new THREE.Vector3(p.x, 0, p.z)); if (!path.length || path[path.length - 1].distanceTo(park) > 3) path.push(park);
    if (path.length < 2) path.unshift(new THREE.Vector3(s0.x, 0, s0.z));
    v.path = path; v.len = path.reduce((a, p, i) => i ? a + p.distanceTo(path[i - 1]) : 0, 0);
    const tk = deps.has('sf-car-Firetruck') ? deps.model('sf-car-Firetruck', 1) : deps.has('firetruck') ? deps.model('firetruck', 1.15) : null;
    if (tk) { g.add(tk); v.truck = tk; const red = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xff2020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), blue = red.clone(); blue.material = red.material.clone(); blue.material.color.set(0x2a6bff);
      red.position.set(-0.6, 3.1, 1.6); blue.position.set(0.6, 3.1, 1.6); red.scale.setScalar(1.6); blue.scale.setScalar(1.6); tk.add(red, blue); v.beacons = [red, blue]; }
    // двамата пожарникари + маркуч + водна струя (само отблизо)
    const P = deps.skinned && deps.skinned('worker_male');
    for (let k = 0; k < 2; k++) {
      let m;
      if (P) { m = P.scene; m.scale.setScalar(1.15); m.traverse(q => { if (q.isMesh) { q.material = q.material.clone(); if (q.material.color) q.material.color.lerp(new THREE.Color(0xd8a020), 0.6); q.frustumCulled = false; } }); const mx = new THREE.AnimationMixer(m), clip = P.animations.find(c => /Interact|Idle/.test(c.name)) || P.animations[0]; if (clip) mx.clipAction(clip).play(); m.userData.mx = mx; }
      else { m = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0xd8a020 })); m.position.y = 0.95; }
      m.visible = false; g.add(m); v.crew.push(m);
    }
    const wmat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.55, depthWrite: false });
    v.water = [0, 1].map(() => { const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)), 12, 0.12, 6), wmat); tube.visible = false; g.add(tube); return tube; });
    v.hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 0, 1)), 2, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x8a1c1c })); v.hose.visible = false; g.add(v.hose);
    vis.set(f.id, v); return v;
  }
  function drop(id) { const v = vis.get(id); if (!v) return; v.g.parent && v.g.parent.remove(v.g); v.g.traverse(o => { if (o.geometry && !o.isSkinnedMesh) o.geometry.dispose(); if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); if (o.material && o.material.map && o.material.map !== puff && o.material.map !== glowT && o.material.map.isCanvasTexture) o.material.map.dispose(); }); vis.delete(id); }

  // ---------- последователността ----------
  function start(lotId, o = {}) {
    const lot = (deps.lots() || [])[lotId]; if (!lot || !lot.obj || st().some(f => f.lot === lotId && f.city === deps.cityId() && !['done'].includes(f.st))) return null;
    const f = { id: `f${Date.now().toString(36)}${seq++}`, city: deps.cityId(), lot: lotId, hp: 100, inten: 0.35, sev: o.sev ?? (0.5 + Math.random() * 1.2), st: 'travel', t0: deps.day(), arrive: deps.day() + (o.travel ?? TRAVEL), out: null, order: null };
    st().push(f); deps.toast(`🔥 Пожар в сграда (${lot.zone === 'center' ? 'център' : 'квартал'})! Пожарната тръгна.`, 'bad', () => deps.fly(lot)); deps.save(); return f;
  }
  // гасенето приключи: оценка на щетите → поръчка
  function assess(f) {
    const lot = lotOf(f);
    if (f.hp <= 0) { f.hp = 0; f.st = 'burned'; offer(f, 'clear'); }
    else if (f.hp < 30) { f.st = 'saved'; offer(f, 'repair'); }
    else { f.st = 'saved'; deps.toast(`✅ Сградата е спасена — остатъчна здравина ${Math.round(f.hp)}%. Фасадата е опушена.`, 'good', () => lot && deps.fly(lot)); }
    deps.save();
  }
  function orderText(f) {
    const o = f.order, stg = o.kind === 'clear' ? CLEAR : STAGES, days = stg.reduce((a, s) => a + s[1], 0);
    return `<b>${o.kind === 'clear' ? '🏗️ Разчистване и нов строеж' : '🏗️ Спешно възстановяване'}</b> · остатъчна здравина <b style="color:${f.hp < 30 ? '#ff6b6b' : '#ffd54a'}">${Math.round(f.hp)}%</b><br>
      Етапи: ${stg.map(s => `${s[0]} (${s[1]} ${s[1] === 1 ? 'ден' : 'дни'})`).join(' → ')}<br>
      Нужни: 👷 бригада · 🧑‍🔧 инженер · 📦 материали <b>${fmt(o.cost)} €</b><br>
      Възнаграждение: <b style="color:#43d17a">${fmt(o.reward)} €</b> · срок: ${days + 6} дни (до ден ${Math.ceil(o.deadline)})`;
  }
  function offer(f, kind) {
    if (f.order) return;   // по една поръчка на инцидент
    const lot = lotOf(f), base = 120000 * (lot && lot.zone === 'center' ? 2 : 1) * (lot && lot.plan ? 1.5 : 1), dmg = kind === 'clear' ? 1.6 : (100 - f.hp) / 100;
    const days = (kind === 'clear' ? CLEAR : STAGES).reduce((a, s) => a + s[1], 0);
    f.order = { kind, st: 'offer', cost: Math.round(base * dmg / 1000) * 1000, reward: Math.round(base * dmg * 1.4 / 1000) * 1000, deadline: deps.day() + days + 6, prog: 0, stage: 0 };
    ask(f);
  }
  function ask(f) {
    const lot = lotOf(f);
    deps.modal(f.order.kind === 'clear' ? '⬛ Сградата изгоря' : '🔥 Критични щети', orderText(f), [
      ['Откажи', () => decline(f.id)], ['Покажи сградата', () => { lot && deps.fly(lot); setTimeout(() => f.order && f.order.st === 'offer' && ask(f), 2500); }], ['Приеми', () => accept(f.id)]]);
  }
  function accept(id) {
    const f = st().find(q => q.id === id); if (!f || !f.order || f.order.st !== 'offer') return false;
    const why = !deps.crewFree() ? 'Няма свободна бригада.' : !deps.hasStaff('engineer') ? 'Трябва инженер (таб „Офис“ → Специалисти).' : !deps.econ().canAfford(f.order.cost) ? `Нямаш ${fmt(f.order.cost)} € за материали.` : null;
    if (why) { deps.toast(`🏗️ ${why}`, 'bad'); return false; }
    deps.econ().spend(f.order.cost, 'обект', f.order.kind === 'clear' ? 'Разчистване след пожар' : 'Спешно възстановяване след пожар');
    f.order.st = 'work'; f.order.t0 = deps.day(); f.st = 'repair'; deps.toast('🏗️ Приета. Бригадата тръгна към сградата.', 'good'); deps.save(); return true;
  }
  function decline(id) {
    const f = st().find(q => q.id === id); if (!f || !f.order) return;
    f.order.st = 'declined'; f.st = 'secured'; const lot = lotOf(f); if (lot) lot.busy = 'secured'; deps.toast('🚧 Сградата остава обезопасена и неизползваема.', ''); deps.save();
  }

  // всеки кадър: dd — игрови дни (0 на пауза)
  function update(dd) {
    const S = deps.S(); if (!S) return;
    const now = deps.day(), here = deps.cityId(), cam = deps.cam();
    for (const f of st()) {
      if (f.city !== here) continue;
      // механиката (игрово време)
      if (dd > 0) {
        if (f.st === 'travel' || f.st === 'fight') {
          // на малки стъпки (≤ 0,02 дни) — при 4× и в тестовете кадърът е голямо парче от деня
          for (let left = dd, tt = now - dd; left > 1e-9 && (f.st === 'travel' || f.st === 'fight'); ) {
            const h = Math.min(0.02, left); left -= h; tt += h;
            if (f.st === 'travel' && tt >= f.arrive) f.st = 'fight';
            if (f.st === 'travel') f.inten = Math.min(1, f.inten + h * 1.4);   // докато пътуват — огънят расте
            else f.inten = Math.max(0, f.inten - h * KNOCK / Math.max(0.4, f.sev * 0.8));
            f.hp = Math.max(0, f.hp - h * BURN * f.sev * f.inten);
            if (f.hp <= 0 || f.inten <= 0) { f.out = tt; f.inten = 0; assess(f); }
          }
        } else if (f.st === 'repair' && f.order) {
          const stg = f.order.kind === 'clear' ? CLEAR : STAGES, days = stg.reduce((a, s) => a + s[1], 0);
          f.order.prog = Math.min(1, (now - f.order.t0) / days);
          let acc = 0; f.order.stage = stg.findIndex(s => (acc += s[1]) / days >= f.order.prog - 1e-9);
          if (f.order.kind !== 'clear') f.hp = Math.max(f.hp, f.hp0 = f.hp0 ?? f.hp, (f.hp0 ?? f.hp) + (100 - (f.hp0 ?? f.hp)) * f.order.prog);
          if (f.order.prog >= 1) finish(f);
        }
      }
      // визуалното
      const lot = lotOf(f); if (!lot) continue;
      let v = vis.get(f.id); if (!v && f.st !== 'done') v = build(f); if (!v) continue;
      const near = cam.distanceTo(v.W.ctr) < 160;
      const burning = f.st === 'travel' || f.st === 'fight';
      const lit = Math.ceil(v.flames.length * Math.min(1, 0.15 + f.inten * (0.35 + (100 - f.hp) / 140)));   // колкото по-силно и по-разрушено — толкова повече прозорци
      v.t = (v.t || 0) + dd * 24;   // „секунди“ по игровото време (24 s за ден на 1×)
      v.flames.forEach((s, i) => { const on = burning && i < lit; s.visible = on; v.glows[i].visible = on; if (on) { const k = 0.8 + 0.25 * Math.sin(v.t * 9 + s.userData.ph) * Math.sin(v.t * 6.3 + s.userData.ph * 2), h = (1.6 + 2.6 * f.inten) * k; s.scale.set(h * 0.8, h, 1); s.position.y = v.W.pts[i].y + h * 0.35; v.glows[i].material.opacity = 0.5 * f.inten; } });
      v.smoke.forEach(s => { const i = s.userData.i, on = (burning && i < lit) || (f.st === 'saved' && f.out != null && now - f.out < 0.4 && i < 3); s.visible = on; if (!on) return; const ph = (v.t * 0.12 + s.userData.ph) % 1, o = s.userData.o; s.position.set(o.x + v.W.n.x * ph * 2, o.y + ph * 9, o.z + v.W.n.z * ph * 2); s.scale.setScalar(2 + ph * 6); s.material.opacity = (burning ? 0.55 : 0.3) * (1 - ph); });
      // пара след успешно гасене (~0,4 дни)
      const steamOn = f.out != null && f.hp > 0 && now - f.out < 0.4; v.steam.forEach(s => { s.visible = steamOn; if (!steamOn) return; const ph = (v.t * 0.1 + s.userData.ph) % 1, p = v.W.pts[(s.userData.ph * 6 | 0) % Math.max(1, v.W.pts.length)] || v.W.ctr; s.position.set(p.x, p.y + ph * 6, p.z); s.scale.setScalar(1.5 + ph * 4); s.material.opacity = 0.4 * (1 - ph) * (1 - (now - f.out) / 0.4); });
      scorch(lot, (100 - f.hp) / 100 * 1.1);
      if (f.st === 'burned' || (f.order && f.order.kind === 'clear' && f.st === 'repair' && f.order.stage === 0)) { if (lot.obj) lot.obj.scale.y = Math.max(0.35, lot.obj.userData.sy0 ?? (lot.obj.userData.sy0 = lot.obj.scale.y)) * (f.st === 'burned' ? 0.45 : 0.45 * (1 - f.order.prog * 2)); }
      // пожарната: по пътя (игрово време) → паркира с бурканите
      if (v.truck) {
        const k = f.st === 'travel' ? Math.min(1, 1 - (f.arrive - now) / (f.arrive - f.t0)) : 1, d = k * v.len;
        let acc = 0, p = v.path[v.path.length - 1], dir = new THREE.Vector3(0, 0, 1);
        for (let i = 1; i < v.path.length; i++) { const L = v.path[i].distanceTo(v.path[i - 1]); if (acc + L >= d) { p = v.path[i - 1].clone().lerp(v.path[i], (d - acc) / Math.max(1e-6, L)); dir = v.path[i].clone().sub(v.path[i - 1]).normalize(); break; } acc += L; }
        v.truck.position.copy(p); if (f.st === 'travel') v.truck.rotation.y = Math.atan2(dir.x, dir.z);
        const showT = burning || (f.out != null && now - f.out < 0.5); v.truck.visible = showT;
        if (v.beacons) { const b = Math.sin(v.t * 14) > 0; v.beacons[0].visible = showT && b; v.beacons[1].visible = showT && !b; }
      }
      // пожарникарите и водата — само при гасене и отблизо
      const crewOn = f.st === 'fight' && near && !!v.truck;
      v.crew.forEach((m, k) => { m.visible = crewOn; if (!crewOn) return; const base = v.truck.position.clone().lerp(v.W.ctr.clone().setY(0).addScaledVector(v.W.n, v.W.half / 2), 0.55).addScaledVector(v.W.side, (k ? 1 : -1) * 2.2); m.position.set(base.x, m.isSkinnedMesh || m.userData.mx ? 0.05 : 0.95, base.z); m.lookAt(v.W.ctr.x, m.position.y, v.W.ctr.z); if (m.userData.mx) m.userData.mx.update(dd * 24); });
      v.hose.visible = crewOn; v.water.forEach((w, k) => {
        const tgt = v.W.pts[Math.max(0, Math.min(lit - 1, k))]; w.visible = crewOn && !!tgt && f.inten > 0.02; if (!w.visible) return;
        const a = v.crew[k].position.clone().setY(1.4), c = tgt.clone(), mid = a.clone().lerp(c, 0.5); mid.y = Math.max(a.y, c.y) + 3 + 0.3 * Math.sin(v.t * 3 + k);
        w.geometry.dispose(); w.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, c), 14, 0.1 + 0.05 * f.inten, 6);
      });
      if (crewOn && v.frameHose !== true) { v.frameHose = true; v.hose.geometry.dispose(); v.hose.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v.truck.position.clone().setY(0.4), v.crew[0].position.clone().setY(0.2), v.crew[1].position.clone().setY(0.2)]), 20, 0.08, 6); }
      // скеле при ремонта
      if (f.st === 'repair' && !v.scaf && lot.obj) { const b = new THREE.Box3().setFromObject(lot.obj), sz = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()); v.scaf = new THREE.Mesh(new THREE.BoxGeometry(sz.x + 1.2, Math.max(4, sz.y + 1), sz.z + 1.2, 6, 6, 6), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, wireframe: true })); v.scaf.position.set(c.x, b.min.y + Math.max(4, sz.y + 1) / 2, c.z); v.g.add(v.scaf); }
      if (v.scaf) v.scaf.visible = f.st === 'repair';
      // табелата
      const txt = f.st === 'repair' && f.order ? `🏗️ ${(f.order.kind === 'clear' ? CLEAR : STAGES)[Math.max(0, f.order.stage)][0].replace(/^\S+ /, '')} ${Math.round(f.order.prog * 100)}%` : FIRE_ST[f.st] || '';
      v.label.userData.set(f.hp, txt); v.label.visible = f.st !== 'done' && !(f.st === 'saved' && f.out != null && now - f.out > 3 && !f.order);
    }
    // махнатите (готови) и от други градове — без визуалното
    for (const id of [...vis.keys()]) { const f = st().find(q => q.id === id); if (!f || f.city !== here || f.st === 'done' || (f.st === 'saved' && !f.order && f.out != null && now - f.out > 3)) drop(id); }
  }
  function finish(f) {
    const lot = lotOf(f); f.order.st = 'done'; f.st = 'done';
    if (f.order.kind === 'clear') { if (lot && lot.obj) { lot.obj.scale.y = lot.obj.userData.sy0 ?? lot.obj.scale.y; } deps.rebuild && lot && deps.rebuild(lot); }
    f.hp = 100; if (lot && lot.obj) scorch(lot, 0);
    if (lot && lot.busy === 'secured') lot.busy = null;
    deps.econ().earn(f.order.reward, 'обект', f.order.kind === 'clear' ? 'Нов строеж след пожар' : 'Възстановяване след пожар');
    deps.toast(`✅ ${f.order.kind === 'clear' ? 'Новата сграда е готова' : 'Сградата е възстановена'}: +${fmt(f.order.reward)} €`, 'good', () => lot && deps.fly(lot)); deps.save();
  }
  // всеки игрален ден: рядко — нов пожар в текущия град (само в застроен парцел); поръчките с изтекъл срок — отказани
  function dailyTick() {
    const now = deps.day(); for (const f of st()) if (f.order && f.order.st === 'offer' && now > f.order.deadline) decline(f.id);
    const S = deps.S(); S.fires = st().filter(f => f.st !== 'done' || now - (f.out ?? now) < 30);   // старите — от записа
    const built = (deps.lots() || []).filter(l => l.obj && l.built && !l.busy); if (built.length < 20 || Math.random() > 0.04 || st().some(f => f.city === deps.cityId() && (f.st === 'travel' || f.st === 'fight'))) return;
    start(built[(Math.random() * built.length) | 0].id);
  }
  // при влизане в града: отказаните/обезопасените пазят парцела; поръчката в изчакване — пак се показва
  function sync() { for (const id of [...vis.keys()]) drop(id); for (const f of st()) { if (f.city !== deps.cityId()) continue; const lot = lotOf(f); if (lot && f.st === 'secured') lot.busy = 'secured'; } const p = st().find(f => f.city === deps.cityId() && f.order && f.order.st === 'offer'); if (p) setTimeout(() => ask(p), 1500); }
  return { start, update, dailyTick, sync, accept, decline, state: st, drop };
}
