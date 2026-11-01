// gorilla.js — 🦍 скрита изненада „Голямата горила“ (feature 'kongo'): НАША горила (Meshy AI + риг/анимации Mixamo; одобрено в Blender 01.11: „давай“).
// Само в Ню Йорк, рядко, 9–22 ч, след ≥ 6 завършени обекта в града: горилата (~50 м) излиза до Емпайър Стейт,
// катери се по фасадата откъм камерата (climb_up в цикъл, вдигането — по профила на сградата, замерен с лъчи), горе се хваща
// с дясната ръка за антената (собственикът, 01.11: „да се хване за антената, да не седи на сградата“) — ръката е закована на мачтата,
// тялото виси настрани; със свободната лява се удря в гърдите (chest_beat), реве (roar) и замахва (swipe) по 2 от 3-те малки
// самолета, които кръжат и я осветяват с прожектори (собственикът: „светлини по него от самолетите“) — ударените се завъртат и отлитат; накрая горилата избледнява и изчезва (~45 s). Първия път — съобщение и постижение (S.kongo).
// Името е НАШЕ („Голямата горила“), без чужди марки.
// deps: { scene, S(), landmark(kind) → Group | null, camera, hour() 0..24, night() 0..1, plane(kind, livery) → Group, toast(msg, kind), pop(key, cap, sub), save() }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const URL_ = 'assets/heavy/gorilla/gorilla.glb';
const H = 50, MODEL_H = 1.9, K = H / MODEL_H;   // м — ръстът в играта; моделът е 1,9 м
const OFF_WALL = 0.16 * H;                      // колко е тялото от фасадата при катеренето (ръцете опират в стената)
const START = 75;                               // м пред фасадата, откъдето тръгва
const PLANE_R = 115, PLANE_UP = 0.38 * H;        // кръгът на самолетите около върха: радиус, височина над покрива

export function createGorilla(deps) {
  let gl = null, loading = null, cur = null, cool = 120 + Math.random() * 240, clips = null, rate = null;
  const load = () => loading || (loading = new Promise(res => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load(URL_, g => { gl = g; prep(); res(g); }, undefined, e => { console.warn('kongo', e); res(null); }); }));

  // корен без придвижване: от следата на Hips (локално — см, Z нагоре, Y напред) махам линейния дрейф и пазя люлеенето;
  // дрейфът (м/с в модела) после се прилага на групата — ръцете/стъпалата не се плъзгат
  function prep() {
    gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = o.material.clone(); } });
    const rig = gl.scene.getObjectByName('GorillaRig') || gl.scene.children[0], u = rig.scale.x || 0.01;   // см → м
    clips = {}; rate = {};
    for (const c of gl.animations) {
      const cl = c.clone(), tr = cl.tracks.find(t => /Hips\.position$/.test(t.name));
      if (tr && (c.name === 'climb_up' || c.name === 'walk')) {
        const ax = c.name === 'climb_up' ? 2 : 1, v = tr.values, n = tr.times.length, d = v[(n - 1) * 3 + ax] - v[ax], T = tr.times[n - 1] - tr.times[0];
        for (let i = 0; i < n; i++) v[i * 3 + ax] -= d * (tr.times[i] - tr.times[0]) / T;
        rate[c.name] = Math.abs(d) * u / cl.duration;   // м/с в модела (climb: нагоре, walk: напред)
      }
      clips[c.name] = cl;
    }
    // горе: долната половина и дясната ръка — от hang_idle (виси на антената), горната половина и лявата ръка — от рева, гърдите, замаха
    const UP = /(Spine\d?|Neck|Head\w*|LeftShoulder|LeftArm|LeftForeArm|LeftHand\w*)\.(quaternion|position|scale)$/;
    const part = (c, keep, nm) => { const x = c.clone(); x.name = nm; x.tracks = x.tracks.filter(t => keep(UP.test(t.name))); return x; };
    clips.hang_low = part(clips.hang_idle, u => !u, 'hang_low'); clips.hang_up = part(clips.hang_idle, u => u, 'hang_up');
    for (const k of ['chest_beat', 'roar', 'swipe']) clips[k + '_up'] = part(clips[k], u => u, k + '_up');
    gl.scene.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) gl.hand = o; if (o.isBone && /Spine2$/.test(o.name)) gl.chest = o; });
  }

  // профилът на сградата откъм посоката dir: за височините y — колко навътре е фасадата (лъч отвън към оста)
  function profile(L, dir) {
    L.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(L), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.z) / 2 + 60;
    const meshes = []; L.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); });
    const rc = new THREE.Raycaster(), P = [], N = 60, h = bb.max.y - bb.min.y;
    for (let i = 0; i <= N; i++) {
      const y = bb.min.y + 2 + (h - 2) * i / N;
      rc.set(new THREE.Vector3(c.x + dir.x * R, y, c.z + dir.z * R), new THREE.Vector3(-dir.x, 0, -dir.z)); rc.far = R * 2;
      const hit = rc.intersectObjects(meshes, false)[0];
      P.push({ y, r: hit ? R - hit.distance : 0 });   // r — от оста до фасадата (0 — над сградата)
    }
    // върхът: най-високата точка, където сградата е още достатъчно широка да стъпи (шпилът и антената — не)
    let top = 0; for (let i = 0; i < P.length; i++) if (P[i].r >= 9) top = i;
    let sp = top; while (sp < P.length - 1 && P[sp].r >= 4) sp++;   // откъдето почва мачтата (антената)
    const grip = Math.min(P[sp].y + 12, bb.max.y - 10);
    return { c, P, top: P[top].y, rTop: P[top].r, base: bb.min.y, grip, at(y) { if (y <= P[0].y) return P[0].r; for (let i = 1; i < P.length; i++) if (P[i].y >= y) { const a = P[i - 1], b = P[i]; return Math.max(a.r, b.r) > 0 ? (a.r && b.r ? a.r + (b.r - a.r) * (y - a.y) / (b.y - a.y) : Math.max(a.r, b.r)) : 0; } return 0; } };
  }

  function start(force = false, d0 = null) {
    if (cur || !gl) return false;
    const L = deps.landmark('empire2'); if (!L) return false;
    const cam = deps.camera, Lp = new THREE.Box3().setFromObject(L).getCenter(new THREE.Vector3());
    const dir = d0 ? new THREE.Vector3(d0[0], 0, d0[1]) : new THREE.Vector3(cam.position.x - Lp.x, 0, cam.position.z - Lp.z); if (dir.lengthSq() < 1) dir.set(0, 0, 1); dir.normalize();   // фасадата откъм камерата
    const pr = profile(L, dir);
    const g = new THREE.Group(); g.name = 'kongo'; const m = gl.scene; m.scale.setScalar(K); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); g.add(m);
    m.traverse(o => { if (o.isMesh) { o.material.transparent = false; o.material.opacity = 1; } });
    const yaw = Math.atan2(-dir.x, -dir.z);   // напред (+z на модела) — към сградата
    g.rotation.y = yaw;
    const r0 = pr.at(pr.base + 3);
    g.position.set(pr.c.x + dir.x * (r0 + START), pr.base, pr.c.z + dir.z * (r0 + START));
    const mixer = new THREE.AnimationMixer(m), act = {};
    for (const k in clips) { act[k] = mixer.clipAction(clips[k]); }
    for (const k of ['chest_beat_up', 'roar_up', 'swipe_up']) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
    act.walk.play();
    // самолетите: 3 малки (regional ×0.7) по кръг около върха
    const planes = [0, 1, 2].map(i => { const p = deps.plane('regional', 20 + i); p.scale.setScalar(0.7); p.visible = false; deps.scene.add(p); const b = beam(); deps.scene.add(b); return { p, b, a: i * Math.PI * 2 / 3 + yaw, st: 'circle', t: 0, v: new THREE.Vector3(), spin: 0 }; });
    deps.scene.add(g);
    cur = { g, m, mixer, act, now: 'walk', upNow: null, pr, dir, yaw, ph: 'walk', t: 0, pt: 0, planes, swipes: 0 };
    const s = deps.S();
    if (s && !s.kongo) { s.kongo = { day: s.day || 1 }; deps.pop && deps.pop('kongo', '🦍 Голямата горила!', 'Нещо огромно се катери по Емпайър Стейт… Постижение: „Горилата на Манхатън“.'); deps.save && deps.save(); }
    else deps.toast && deps.toast('🦍 Голямата горила пак катери Емпайър Стейт!', 'good');
    return true;
  }

  const to = (c, k, fade = 0.3) => { if (c.now === k) return; const a = c.act[k]; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fade).play(); c.act[c.now].fadeOut(fade); c.now = k; };
  const up = (c, k, fade = 0.3) => { if (c.upNow === k) return; const a = c.act[k]; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fade).play(); if (c.upNow) c.act[c.upNow].fadeOut(fade); c.upNow = k; };   // горната половина
  const setPh = (c, ph) => { c.ph = ph; c.pt = 0; };
  // прожекторът на самолета: конус от носа към горилата (адитивен, избледнява към края); дължина — по мащаба по y
  let beamTex = null, glowTex = null;
  function beam() {
    if (!beamTex) { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128; const x = cv.getContext('2d'), gr = x.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 4, 128); beamTex = new THREE.CanvasTexture(cv); }
    const m = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 0.4, 1, 20, 1, true).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: 0xfff3d6, map: beamTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 3; m.visible = false; m.frustumCulled = false;
    if (!glowTex) { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(cv); }
    const tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff6e0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); tip.scale.set(5, 5, 1); tip.position.y = 1; m.add(tip); m.userData.tip = tip;
    return m;
  }
  const Y = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  const V = new THREE.Vector3();

  function update(dt, playing = true) {
    if (!cur) {
      const s = deps.S(); if (!s || s.cityId !== 'newyork' || !playing || dt <= 0) return;
      const h = deps.hour(); if (!(h >= 9 && h < 22) || (s.done || 0) < 6) return;
      cool -= dt; if (cool > 0) return; cool = 420 + Math.random() * 480;
      if (Math.random() < 0.3) load().then(() => start());
      return;
    }
    const c = cur; if (!playing) return;
    c.t += dt; c.pt += dt; c.mixer.update(dt);
    const { pr, dir, g } = c, s = K;
    if (c.ph === 'walk') {   // към фасадата
      const r = pr.at(g.position.y + 3) + OFF_WALL, cx = g.position.x - pr.c.x, cz = g.position.z - pr.c.z, d = cx * dir.x + cz * dir.z - r;
      const step = rate.walk * s * dt; if (d <= step) { g.position.set(pr.c.x + dir.x * r, g.position.y, pr.c.z + dir.z * r); to(c, 'climb_up', 0.25); setPh(c, 'climb'); planesOn(c); }
      else g.position.addScaledVector(dir, -step);
    } else if (c.ph === 'climb') {   // нагоре по профила; ръцете — около 1,05 H над стъпалата
      const y = g.position.y + rate.climb_up * s * dt, rh = pr.at(y + H * 1.05), rf = pr.at(y + H * 0.2), r = Math.max(rh, rf * 0.92) + OFF_WALL;
      g.position.set(pr.c.x + dir.x * r, y, pr.c.z + dir.z * r);
      if (y + H * 1.05 >= pr.grip) {   // ръцете стигнаха мачтата → хваща се с дясната
        to(c, 'hang_low', 0.5); up(c, 'hang_up', 0.5); setPh(c, 'grab'); c.yaw0 = g.rotation.y;
        const a = c.yaw + Math.PI * 0.42, b = c.yaw - Math.PI * 0.42, lx = t => Math.cos(t) * dir.x - Math.sin(t) * dir.z;   // лявата страна (+x на модела) — навън, към камерата
        c.yawH = lx(a) > lx(b) ? a : b;
      }
    } else if (c.ph === 'grab') {   // завърта се настрани (1,4 s); ръката — към мачтата (виж pin)
      g.rotation.y = c.yaw0 + (c.yawH - c.yaw0) * ease(c.pt / 1.4);
      if (c.pt >= 1.6) { up(c, 'chest_beat_up', 0.3); setPh(c, 'beat'); }
    } else if (c.ph === 'beat') { if (c.pt >= clips.chest_beat.duration - 0.3) { up(c, 'roar_up', 0.3); setPh(c, 'roar'); } }
    else if (c.ph === 'roar') { if (c.pt >= clips.roar.duration - 0.3) { swipe(c); } }
    else if (c.ph === 'swipe') {
      const p = c.target; if (p && p.st === 'dive' && c.pt >= c.hitAt) knock(c, p);
      if (c.pt >= clips.swipe.duration - 0.2) { if (c.swipes < 2) swipe(c); else { up(c, 'hang_up', 0.4); setPh(c, 'leave'); fadeSet(c, true); } }
    } else if (c.ph === 'leave') {   // избледнява (2,5 s)
      const o = 1 - ease(c.pt / 2.5); c.m.traverse(m => { if (m.isMesh) m.material.opacity = o; });
      if (c.pt >= 2.6) { for (const p of c.planes) if (p.st === 'circle') p.st = 'away'; c.ph = 'gone'; g.visible = false; }
    }
    if (gl.hand && c.ph !== 'walk' && c.ph !== 'climb' && c.ph !== 'gone') {   // дясната ръка — закована на мачтата (тялото виси под нея)
      g.updateMatrixWorld(true); gl.hand.getWorldPosition(V); const k = c.ph === 'grab' ? Math.min(1, ease(c.pt / 1.2) + 0.08) : 1;
      g.position.x += (pr.c.x - V.x) * k; g.position.y += (pr.grip - V.y) * k; g.position.z += (pr.c.z - V.z) * k;
    }
    updPlanes(c, dt); lights(c);
    if (c.ph === 'gone' && c.planes.every(p => p.st === 'off')) stop();
    if (c.t > 120) stop();   // предпазител
  }
  function fadeSet(c, on) { c.m.traverse(m => { if (m.isMesh) { m.material.transparent = on; m.material.depthWrite = !on; m.material.needsUpdate = true; } }); }
  function planesOn(c) { for (const p of c.planes) p.p.visible = true; }
  // замахът: самолетът се спуска към лявата ръка, на ~45 % от замаха — удар
  function swipe(c) {
    c.swipes++; const a = c.act.swipe_up; if (c.upNow === 'swipe_up') a.reset().play(); else up(c, 'swipe_up', 0.2);
    setPh(c, 'swipe'); c.hitAt = clips.swipe.duration * 0.45;
    const free = c.planes.filter(p => p.st === 'circle'); if (!free.length) { c.target = null; return; }
    const g = c.g, fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);   // side — лявата страна
    g.updateMatrixWorld(true); const hit = (gl.chest ? gl.chest.getWorldPosition(new THREE.Vector3()) : g.position.clone().setY(g.position.y + H * 0.7)).addScaledVector(side, H * 0.55).addScaledVector(fwd, H * 0.2);
    free.sort((p, q) => p.p.position.distanceTo(hit) - q.p.position.distanceTo(hit)); const p = free[0];
    p.st = 'dive'; p.from = p.p.position.clone(); p.hit = hit; p.t = 0; p.T = c.hitAt; c.target = p;
  }
  function knock(c, p) {
    const g = c.g, fwd = new THREE.Vector3(Math.sin(g.rotation.y), 0, Math.cos(g.rotation.y)), side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    p.st = 'hit'; p.t = 0; p.v.copy(fwd).multiplyScalar(20).addScaledVector(side, 50); p.v.y = 14; p.spin = 5 + Math.random() * 3; c.target = null;
  }
  function updPlanes(c, dt) {
    const { pr } = c, y0 = pr.grip - H * 0.15 + PLANE_UP * 0.4;
    for (const P of c.planes) {
      const p = P.p; if (P.st === 'off') continue; P.t += dt;
      if (P.st === 'circle' || P.st === 'away') {
        P.a += dt * 0.32; const R = PLANE_R + (P.st === 'away' ? P.t * 40 : 0), y = y0 + 6 * Math.sin(P.a * 2) + (P.st === 'away' ? P.t * 8 : 0);
        p.position.set(pr.c.x + Math.cos(P.a) * R, y, pr.c.z + Math.sin(P.a) * R);
        p.rotation.set(0, Math.atan2(-Math.sin(P.a), Math.cos(P.a)), 0); p.rotateZ(0.35);   // по допирателната, наклонен навътре
        if (P.st === 'away' && P.t > 8) { P.st = 'off'; p.parent && p.parent.remove(p); }
      } else if (P.st === 'dive') {
        const f = Math.min(1, P.t / P.T); V.lerpVectors(P.from, P.hit, ease(f)); const d = V.clone().sub(p.position);
        p.position.copy(V); if (d.lengthSq() > 1e-4) { p.rotation.set(0, Math.atan2(d.x, d.z), 0); p.rotateX(-Math.atan2(d.y, Math.hypot(d.x, d.z))); }
      } else if (P.st === 'hit') {   // отхвърлен: върти се и отлита
        p.position.addScaledVector(P.v, dt); P.v.y -= 2 * dt; p.rotateZ(P.spin * dt); p.rotateX(0.6 * dt);
        if (P.t > 6) { P.st = 'off'; p.parent && p.parent.remove(p); }
      }
    }
  }
  // прожекторите на кръжащите самолети — към гърдите; горилата леко светва (emissive, без нови източници — да не се прекомпилират шейдърите)
  const C = new THREE.Vector3(), D = new THREE.Vector3();
  function lights(c) {
    const n = deps.night ? deps.night() : 0, on = ['climb', 'grab', 'beat', 'roar', 'swipe'].includes(c.ph), op = 0.07 + 0.2 * n; let lit = 0;
    if (gl.chest) gl.chest.getWorldPosition(C); else C.copy(c.g.position).setY(c.g.position.y + H * 0.7);
    for (const P of c.planes) {
      const b = P.b, show = on && P.st === 'circle' && P.p.visible; b.visible = show; if (!show) continue; lit++;
      P.p.getWorldPosition(b.position); D.copy(C).sub(b.position); const L = D.length(); D.divideScalar(L);
      b.quaternion.setFromUnitVectors(Y, D); b.scale.set(1, L, 1); b.material.opacity = op * (0.85 + 0.15 * Math.sin(c.t * 7 + P.a * 3));
      b.userData.tip.scale.set(7, 7 / L, 1); b.userData.tip.position.y = 0; b.userData.tip.material.opacity = 0.6 + 0.4 * n;
    }
    const e = Math.min(1, lit) * (0.025 + 0.06 * n); c.m.traverse(o => { if (o.isMesh) o.material.emissive.setRGB(e, e * 0.97, e * 0.9); });
  }
  function stop() {
    if (!cur) return; const c = cur; cur = null;
    c.mixer.stopAllAction(); c.mixer.uncacheRoot(c.m); deps.scene.remove(c.g); c.g.remove(c.m);
    for (const P of c.planes) { P.p.parent && P.p.parent.remove(P.p); deps.scene.remove(P.b); P.b.geometry.dispose(); P.b.material.dispose(); }
    c.m.traverse(o => { if (o.isMesh) o.material.emissive.setRGB(0, 0, 0); });
  }
  return {
    update, stop,
    // Лабораторията: пуска сега (без условията); d — посоката [x, z] към камерата; връща къде е сградата
    test: (d = null) => load().then(() => { stop(); if (!start(true, d)) return null; const { pr } = cur; return { x: pr.c.x, z: pr.c.z, top: pr.top, grip: pr.grip, base: pr.base, dir: [cur.dir.x, cur.dir.z] }; }),
    state: () => cur ? { ph: cur.ph, t: +cur.t.toFixed(1), y: Math.round(cur.g.position.y), top: Math.round(cur.pr.top), grip: Math.round(cur.pr.grip), planes: cur.planes.map(p => p.st) } : null,
    get busy() { return !!cur; },
  };
}
