// football.js — ⚽ football (f9): мачове на малките игрища в кварталите (districts.js pitch → pitches()).
// Денем (без дъжд/сняг) на най-близките до камерата игрища: 2 отбора по 4 (по един вратар), топката се търкаля и отскача от мрежата,
// най-близкият играч тича към нея и я рита към чуждата врата, другите държат позиции след нея; гол → топката в центъра.
// Хората са истинските минувачи (deps.body() — клонинг с Walk/Idle): „тичане“ — ходенето, ускорено и с лек наклон напред.
// Само близо до камерата (R м) и до 2 игрища наведнъж — иначе нищо не се рисува. Нощем — празни (игрищата нямат прожектори).
// const fb = createFootball({ parent, body, pitches, hour, wet, on });  fb.update(dt, target);  fb.clear()
import * as THREE from 'three';
import { canvasTex } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни (не се губят)

const R = 140, MAXP = 2, WALK_V = 1.4;   // радиус (м) около целта на камерата; колко игрища наведнъж; скоростта на ходенето в клипа
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let ballGeo = null, ballMat = null;
function ballMesh() {
  if (!ballGeo) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#1b1b1b'; for (const [x, y] of [[16, 16], [48, 40], [80, 14], [112, 38], [32, 54], [96, 58], [64, 30]]) { g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); } g.fill(); }
    const t = canvasTex(c); t.colorSpace = THREE.SRGBColorSpace;
    ballGeo = new THREE.SphereGeometry(0.22, 14, 10); ballMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
  }
  const m = new THREE.Mesh(ballGeo, ballMat); m.castShadow = true; return m;
}

export function createFootball(deps) {
  const games = new Map();   // ключ на игрището → мач
  const key = p => Math.round(p.x) + ':' + Math.round(p.z);
  function start(p) {
    const g = new THREE.Group(); g.name = 'football'; deps.parent().add(g);
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), W = (a, b) => [p.x + ca * a - sa * b, p.z + sa * a + ca * b], hw = p.w / 2 - 1, hd = p.d / 2 - 1;
    const ball = { a: 0, b: 0, va: 0, vb: 0, m: ballMesh(), wait: 1.2 }; g.add(ball.m);
    const pl = [];
    for (const team of [1, -1]) for (let i = 0; i < 4; i++) {   // team 1 напада към +a; i = 0 — вратарят
      const B = deps.body(); if (!B) continue;
      const act = B.walk ? B.mixer.clipAction(B.walk) : null, idle = B.idle ? B.mixer.clipAction(B.idle) : null;
      if (act) { act.play(); act.time = Math.random() * act.getClip().duration; } if (idle) { idle.play(); idle.setEffectiveWeight(0); }
      const home = i === 0 ? [-team * (hw - 0.6), 0] : [[-team * hw * 0.45, -hd * 0.45], [-team * hw * 0.45, hd * 0.45], [team * hw * 0.15, 0]][i - 1];
      const P = { team, gk: i === 0, home, a: home[0], b: home[1], yaw: 0, B, act, idle, cd: 0, kick: 0 };
      const [x0, z0] = W(P.a, P.b); B.m.position.set(x0, 0, z0); g.add(B.m); pl.push(P);
    }
    return { p, g, W, ca, sa, hw, hd, ball, pl, score: [0, 0], t: 0 };
  }
  function stop(G) { G.g.parent && G.g.parent.remove(G.g); for (const P of G.pl) P.B.mixer.stopAllAction(); }
  function step(G, dt) {
    const { ball, hw, hd, pl } = G; G.t += dt;
    // топката: триене, мрежата наоколо (отскок), голът (между гредите, ±1,5 м)
    if (ball.wait > 0) { ball.wait -= dt; if (ball.wait <= 0) { ball.a = 0; ball.b = 0; ball.va = (Math.random() - 0.5) * 2; ball.vb = (Math.random() - 0.5) * 2; } }
    else {
      ball.a += ball.va * dt; ball.b += ball.vb * dt; const f = Math.exp(-0.9 * dt); ball.va *= f; ball.vb *= f;
      if (Math.abs(ball.a) > hw + 0.3) { if (Math.abs(ball.b) < 1.4) { G.score[ball.a > 0 ? 0 : 1]++; ball.wait = 1.6; ball.va = ball.vb = 0; } else { ball.a = Math.sign(ball.a) * (hw + 0.3); ball.va *= -0.55; } }
      if (Math.abs(ball.b) > hd + 0.6) { ball.b = Math.sign(ball.b) * (hd + 0.6); ball.vb *= -0.55; }
    }
    // кой гони топката: най-близкият полеви играч от всеки отбор
    const chaser = {}; for (const P of pl) { if (P.gk) continue; const d = Math.hypot(P.a - ball.a, P.b - ball.b); if (!chaser[P.team] || d < chaser[P.team].d) chaser[P.team] = { P, d }; }
    for (const P of pl) {
      let ta, tb, vmax;
      if (P.gk) { ta = P.home[0]; tb = clamp(ball.b * 0.55, -1.3, 1.3); vmax = 2.2; }
      else if (chaser[P.team] && chaser[P.team].P === P) { ta = ball.a - P.team * 0.45; tb = ball.b; vmax = 5.2; }   // отзад на топката, за да я ритне напред
      else { ta = clamp(P.home[0] + ball.a * 0.5, -hw + 1, hw - 1); tb = clamp(P.home[1] + ball.b * 0.35, -hd + 0.5, hd - 0.5); vmax = 2.4; }
      if (P.kick > 0) { P.kick -= dt; vmax = 0; }   // ритникът — кратко спиране
      const da = ta - P.a, db = tb - P.b, dd = Math.hypot(da, db), v = dd > 0.25 ? Math.min(vmax, dd * 2.2) : 0;
      if (v > 0) { P.a += da / dd * v * dt; P.b += db / dd * v * dt; }
      P.cd -= dt;
      const bd = Math.hypot(P.a - ball.a, P.b - ball.b);
      if (bd < 0.75 && P.cd <= 0 && ball.wait <= 0) {   // ритник: към чуждата врата (вратарят — напред към средата), с разсейване
        const ga = P.team * (hw + 0.5), gb = (Math.random() - 0.5) * (P.gk ? 6 : 3.2), ka = ga - ball.a, kb = gb - ball.b, kl = Math.hypot(ka, kb) || 1, s = P.gk ? 9 + Math.random() * 3 : 5 + Math.random() * 6;
        ball.va = ka / kl * s; ball.vb = kb / kl * s + (Math.random() - 0.5) * 2; P.cd = 0.9; P.kick = 0.25;
      }
      // посоката: накъдето тича, иначе — към топката
      const face = v > 0.3 ? Math.atan2(da, db) : Math.atan2(ball.a - P.a, ball.b - P.b);
      let dy = face - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, dt * 8);
      // анимацията: ходенето, ускорено според скоростта; на място — стои
      const run = v / WALK_V; if (P.act) { P.act.setEffectiveWeight(v > 0.2 ? 1 : 0); P.act.timeScale = clamp(run, 0.6, 2.6); } if (P.idle) P.idle.setEffectiveWeight(v > 0.2 ? 0 : 1);
      P.B.mixer.update(dt);
      const [x, z] = G.W(P.a, P.b), m = P.B.m; m.position.set(x, 0, z); m.rotation.set(v > 3 ? 0.14 : 0, worldYaw(G, P.yaw), 0, 'YXZ');   // тичащият — леко наведен напред
    }
    // топката в света: търкаляне (въртене по посоката)
    const [x, z] = G.W(ball.a, ball.b); ball.m.position.set(x, 0.22, z);
    const sp = Math.hypot(ball.va, ball.vb); if (sp > 0.05) { const wa = G.ca * ball.va - G.sa * ball.vb, wb = G.sa * ball.va + G.ca * ball.vb; ball.m.rotation.x += wb / 0.22 * dt; ball.m.rotation.z -= wa / 0.22 * dt; }
  }
  // местната посока (a, b) → завъртане в света: обектът гледа по +z
  const worldYaw = (G, yaw) => { const la = Math.sin(yaw), lb = Math.cos(yaw), wx = G.ca * la - G.sa * lb, wz = G.sa * la + G.ca * lb; return Math.atan2(wx, wz); };
  function update(dt, target) {
    if (!deps.on()) { clear(); return; }
    const h = deps.hour(), day = h >= 7.5 && h <= 20.3 && !deps.wet();
    const ps = day && target ? deps.pitches().map(p => [p, Math.hypot(p.x - target.x, p.z - target.z)]).filter(([, d]) => d < R).sort((a, b) => a[1] - b[1]).slice(0, MAXP).map(([p]) => p) : [];
    const want = new Set(ps.map(key));
    for (const [k, G] of games) if (!want.has(k)) { stop(G); games.delete(k); }
    for (const p of ps) { const k = key(p); if (!games.has(k)) { const G = start(p); if (G.pl.length) games.set(k, G); else stop(G); } }
    const d = Math.min(0.1, dt); for (const G of games.values()) step(G, d);
  }
  function clear() { for (const G of games.values()) stop(G); games.clear(); }
  return { update, clear, games: () => [...games.values()].map(G => ({ x: Math.round(G.p.x), z: Math.round(G.p.z), players: G.pl.length, score: G.score.slice(), ball: [+G.ball.a.toFixed(1), +G.ball.b.toFixed(1)] })) };
}
