// splash.js — оживената начална картина (🧪 splash-anim): докато играта се зарежда, сградата в средата расте с 2 етажа,
// самосвалът идва напред по пътя от обекта до мястото си (с перспектива), товарът на крана се люлее, облаци, слънчев отблясък, прах; при 100% — блясък по логото.
// Слоевете (assets/splash/*.webp, ~150 KB) са изрязани от assets/ui/splash.webp (_source: инпейнт зад самосвала и товара).
// Напредъкът се чете от #ldBar (game.js го пише) — game.js не се пипа. Всичко е върху <canvas> над статичната картина:
// без canvas, със „намалено движение“, при грешка или липсващ слой — остава статичната картина както досега.
import { feature } from './lab/feature.js';

const W = 1672, H = 941, DIR = 'assets/splash/';
// [x, y, w, h] в пикселите на оригинала (1672×941)
const L = { truck: [1217, 578, 434, 293], 'patch-truck': [1197, 558, 475, 334], load: [449, 347, 62, 55], 'patch-load': [443, 292, 74, 117], build: [365, 208, 323, 239], logo: [416, 0, 832, 326] };
const PIVOT = [480.5, 304], CABLES = [468, 477, 484, 495], CABLE_Y = 362;   // куката на крана и закачките на товара
const SUN = [1272, 325];
const B_TOP = 447, B_END = 212;   // ръбът на разкриването: от сегашния покрив до новия (2 етажа нагоре)
// пътят на самосвала: точката под средата му (TRUCK_ANCHOR в спрайта) по крива на Безие — от обекта горе-вляво до мястото от оригинала
const TRUCK_ANCHOR = [200, 282], TRUCK_S0 = 0.55;
const TRUCK_PATH = [[1150, 792], [1300, 808], [L.truck[0] + TRUCK_ANCHOR[0], L.truck[1] + TRUCK_ANCHOR[1]]];
const WHEELS = [[28, 237], [73, 247]];   // задните гуми — прахът остава зад камиона

function start() {
  const ld = document.getElementById('loading'), box = ld && ld.querySelector('.ld-box'), bar = document.getElementById('ldBar'), txt = document.getElementById('ldTxt');
  if (!box || !bar || ld.classList.contains('pol')) return;   // след ниво 20 картината е друга — остава статична
  if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
  const real = () => { const w = parseFloat(bar.style.width); return Number.isFinite(window.__splashP) ? window.__splashP : Number.isFinite(w) ? Math.min(1, Math.max(0, w / 100)) : 0; };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src; });
  Promise.all([load('assets/ui/splash.webp'), ...Object.keys(L).map(k => load(DIR + k + '.webp'))]).then(([bg, ...imgs]) => {
    if (!ld.isConnected || ld.classList.contains('out') || (real() > 0.9 && !Number.isFinite(window.__splashP))) return;   // играта вече е готова — няма смисъл
    const I = {}; Object.keys(L).forEach((k, i) => { I[k] = imgs[i]; });
    run(ld, box, cv, ctx, bg, I, real, txt);
  }).catch(e => { console.warn('splash-anim', e && e.message || e); });
}

function run(ld, box, cv, ctx, bg, I, real, txt) {
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [bc, bx] = off(L.build[2], L.build[3]);   // сградата с маската
  const [sc, sx] = off(L.logo[2], L.logo[3]);     // блясъкът по логото
  const clouds = [0, 1, 2].map(i => cloud(off, 220 + i * 40, 70 + i * 8, i));
  const motes = Array.from({ length: 26 }, () => mote(Math.random() * W));
  const puffs = [], sparks = [];
  let p = 0, lastEdge = -1, shineT = -1, shined = false, lastTxt = txt ? txt.textContent : '', t0 = performance.now(), last = t0, prevTruckX = null, raf = 0, shown = false;

  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .35s;pointer-events:none';
  box.insertBefore(cv, box.firstChild);   // лентата и надписът остават отгоре

  const draw = (now) => {
    if (!ld.isConnected) { cancelAnimationFrame(raf); return; }
    const dt = Math.min(0.1, (now - last) / 1000), t = (now - t0) / 1000; last = now;
    const target = real(); p += (target - p) * Math.min(1, dt * 2.6); if (target >= 1 && p > 0.995) p = 1;
    if (!shined && p >= 0.999) { shined = true; shineT = t; }
    const tx0 = txt ? txt.textContent : '';   // „Подготвям графиката…“ → „Готово!“ (и преведените) — още един блясък, ако е минало време
    if (shined && tx0 !== lastTxt && t - shineT > 1.6) shineT = t;
    lastTxt = tx0;

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0, W, H);
    const pa = Math.min(1, (1 - p) * 6);   // в последните ~15% мястото около самосвала се връща към оригинала (при 100% — точно като статичната)
    if (pa > 0) { ctx.globalAlpha = pa; put('patch-truck'); ctx.globalAlpha = 1; }
    put('patch-load');
    sun(t);
    for (const c of clouds) drawCloud(c, t);

    // 🏗️ сградата расте: разкриване отдолу нагоре с мек ръб
    const e = easeInOut(p), edge = B_TOP + (B_END - B_TOP) * e;
    if (Math.abs(edge - lastEdge) > 0.05) {
      lastEdge = edge; const [, by, bw, bh] = L.build, y = edge - by;
      bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, bw, bh); bx.drawImage(I.build, 0, 0);
      bx.globalCompositeOperation = 'destination-in';
      const g = bx.createLinearGradient(0, y - 7, 0, y + 7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      bx.fillStyle = g; bx.fillRect(0, 0, bw, bh);
    }
    if (p > 0.001) ctx.drawImage(bc, L.build[0], L.build[1]);
    if (target > p + 0.01 && edge < B_TOP - 4 && Math.random() < dt * 9) sparks.push({ x: 380 + Math.random() * 300, y: edge + 4, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.5 + Math.random() * 0.4, t: 0 });

    // 🏗️ товарът на крана се люлее около куката
    const a = Math.sin(t * 1.15) * 0.022 + Math.sin(t * 0.47) * 0.008;
    ctx.save(); ctx.translate(PIVOT[0], PIVOT[1]); ctx.rotate(a); ctx.translate(-PIVOT[0], -PIVOT[1]);
    ctx.strokeStyle = 'rgba(38,32,30,.85)'; ctx.lineWidth = 1.1; ctx.beginPath();
    for (const cx of CABLES) { ctx.moveTo(PIVOT[0], PIVOT[1] + 2); ctx.lineTo(cx, CABLE_Y); }
    ctx.stroke(); ctx.fillStyle = 'rgba(40,34,30,.9)'; ctx.fillRect(PIVOT[0] - 3, PIVOT[1] - 1, 6, 6);
    ctx.drawImage(I.load, L.load[0], L.load[1]); ctx.restore();

    put('logo');

    // 🚚 самосвалът — напред по пътя: от обекта (горе-вляво, далеч, по-малък) към мястото си долу-вдясно, с перспектива
    const e2 = easeInOut(p), u1 = 1 - e2, s = TRUCK_S0 + (1 - TRUCK_S0) * e2;
    const ax = u1 * u1 * TRUCK_PATH[0][0] + 2 * u1 * e2 * TRUCK_PATH[1][0] + e2 * e2 * TRUCK_PATH[2][0];
    const ay = u1 * u1 * TRUCK_PATH[0][1] + 2 * u1 * e2 * TRUCK_PATH[1][1] + e2 * e2 * TRUCK_PATH[2][1];
    const tx = ax - TRUCK_ANCHOR[0] * s, ty0 = ay - TRUCK_ANCHOR[1] * s;
    const v = prevTruckX == null ? 0 : Math.hypot(ax - prevTruckX[0], ay - prevTruckX[1]) / Math.max(dt, 1e-3); prevTruckX = [ax, ay];
    const bob = v > 3 ? Math.sin((ax + ay) * 0.21) * 0.9 * s : 0, ty = ty0 + bob;
    {
      ctx.save(); ctx.translate(ax, ay - 1); ctx.rotate(-0.06); ctx.scale(s, 0.11 * s);   // мека сянка
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 215); sg.addColorStop(0, 'rgba(42,26,12,.42)'); sg.addColorStop(0.7, 'rgba(42,26,12,.2)'); sg.addColorStop(1, 'rgba(42,26,12,0)');
      ctx.fillStyle = sg; ctx.globalAlpha = pa; if (pa > 0) ctx.fillRect(-215, -215, 430, 430); ctx.restore();
      if (s === 1 && !bob) ctx.drawImage(I.truck, L.truck[0], L.truck[1]);   // при 100% — точно като оригинала
      else ctx.drawImage(I.truck, tx, ty, L.truck[2] * s, L.truck[3] * s);
      if (v > 3) for (const [wx, wy] of WHEELS) if (Math.random() < dt * Math.min(24, v * 0.4)) puffs.push({ x: tx + wx * s, y: ty0 + wy * s, vx: -12 - Math.random() * 28, vy: -6 - Math.random() * 12, r: (5 + Math.random() * 7) * s, life: 1.2 + Math.random(), t: 0 });   // прахът — назад (горе-вляво)
    }
    particles(dt);
    for (const m of motes) drawMote(m, dt, t);
    if (shineT >= 0 && t - shineT < 1.3) shine((t - shineT) / 1.3);

    if (!shown) { shown = true; requestAnimationFrame(() => { cv.style.opacity = '1'; }); }
    raf = requestAnimationFrame(frame);
  };

  const put = k => ctx.drawImage(I[k], L[k][0], L[k][1]);

  function sun(t) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    const g = ctx.createRadialGradient(SUN[0], SUN[1], 2, SUN[0], SUN[1], 95);
    g.addColorStop(0, `rgba(255,236,170,${0.32 + 0.12 * pulse})`); g.addColorStop(0.35, 'rgba(255,190,90,.10)'); g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g; ctx.fillRect(SUN[0] - 95, SUN[1] - 95, 190, 190);
    ctx.translate(SUN[0], SUN[1]); ctx.rotate(t * 0.05);
    for (let i = 0; i < 10; i++) {
      ctx.rotate(Math.PI / 5); const len = 70 + 40 * Math.sin(t * 0.7 + i * 1.7) ** 2;
      const rg = ctx.createLinearGradient(0, 0, len, 0); rg.addColorStop(0, `rgba(255,225,150,${0.10 + 0.05 * pulse})`); rg.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(len, 0); ctx.lineTo(0, 2.2); ctx.fill();
    }
    ctx.restore();
  }

  function cloud(off, w, h, seed) {
    const [c, x] = off(w, h); let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 16; i++) {
      const cx = w * (0.15 + 0.7 * rnd()), cy = h * (0.45 + 0.25 * rnd()), r = h * (0.22 + 0.25 * rnd());
      const g = x.createRadialGradient(cx, cy - r * 0.2, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,238,215,.55)'); g.addColorStop(0.6, 'rgba(255,214,180,.22)'); g.addColorStop(1, 'rgba(255,200,170,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    return { c, w, h, x0: 1130 + seed * 160, y: 40 + seed * 46, sp: 5 + seed * 2.2, a: 0.33 - seed * 0.05 };
  }
  function drawCloud(c, t) {   // небето между логото и небостъргачите: 1130…1560, плавно се появява и изчезва
    const span = 430 + c.w, u = ((c.x0 - 1130 + t * c.sp) % span + span) % span, x = 1130 - c.w + u;
    const mid = x + c.w / 2, fade = Math.max(0, Math.min(1, (mid - 1150) / 120, (1540 - mid) / 120));
    if (fade <= 0) return; ctx.globalAlpha = c.a * fade; ctx.drawImage(c.c, x, c.y); ctx.globalAlpha = 1;
  }

  function mote(x) { return { x, y: 600 + Math.random() * 320, vx: 4 + Math.random() * 10, vy: -2 - Math.random() * 4, r: 0.8 + Math.random() * 1.6, ph: Math.random() * 6.3 }; }
  function drawMote(m, dt, t) {
    m.x += m.vx * dt; m.y += (m.vy + Math.sin(t + m.ph) * 3) * dt;
    if (m.x > W + 5 || m.y < 520) Object.assign(m, mote(-5));
    ctx.fillStyle = `rgba(255,222,160,${0.18 + 0.14 * Math.sin(t * 2 + m.ph) ** 2})`;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill();
  }

  function particles(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const d = puffs[i]; d.t += dt; if (d.t > d.life) { puffs.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt; d.r += 14 * dt; const al = 0.34 * (1 - d.t / d.life);
      const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, `rgba(205,165,115,${al})`); g.addColorStop(1, 'rgba(205,165,115,0)');
      ctx.fillStyle = g; ctx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    }
    if (puffs.length > 120) puffs.splice(0, puffs.length - 120);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]; s.t += dt; if (s.t > s.life) { sparks.splice(i, 1); continue; }
      s.vy += 120 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      ctx.fillStyle = `rgba(255,${200 - 80 * s.t / s.life | 0},90,${0.9 * (1 - s.t / s.life)})`; ctx.fillRect(s.x, s.y, 1.6, 1.6);
    }
    ctx.restore();
  }

  function shine(u) {   // диагонална светла ивица по логото
    const [, , lw, lh] = L.logo, cx = -60 + (lw + 120) * easeInOut(u);
    sx.globalCompositeOperation = 'source-over'; sx.clearRect(0, 0, lw, lh); sx.drawImage(I.logo, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    const g = sx.createLinearGradient(cx - 90, 0, cx + 90, lh * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,250,225,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = g; sx.fillRect(0, 0, lw, lh);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * Math.sin(Math.PI * u); ctx.drawImage(sc, L.logo[0], L.logo[1]); ctx.restore();
  }

  const frame = now => { try { draw(now); } catch (e) { console.warn('splash-anim', e); cancelAnimationFrame(raf); cv.remove(); } };   // грешка → статичната картина
  raf = requestAnimationFrame(frame);
  const guard = setInterval(() => { if (!ld.isConnected) { cancelAnimationFrame(raf); clearInterval(guard); } }, 1000);
}

const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;

try { if (feature('splash-anim')) start(); } catch (e) { console.warn('splash-anim', e); }
