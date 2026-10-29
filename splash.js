// splash.js — оживената начална картина (🧪 splash-anim): докато играта се зарежда, денят преминава в нощ (залез 30–70%, нощ ~90%),
// сградата в средата расте с 2 етажа, самосвалът идва напред по пътя от обекта до мястото си (с перспектива; нощем — с фарове),
// товарът на крана се люлее, облаци, слънчев отблясък, прах; нощем трептят светлините на града и крановете, луната свети; при 100% — блясък по логото.
// Слоевете (assets/splash/*.webp, ~0,5 MB) са изрязани от assets/ui/splash.webp и нощната версия на собственика (night.webp, подравнена; инпейнт зад самосвала и товара).
// Напредъкът се чете от #ldBar (game.js го пише) — game.js не се пипа. Всичко е върху <canvas> над статичната картина:
// без canvas, със „намалено движение“, при грешка или липсващ слой — остава статичната картина както досега.
import { feature } from './lab/feature.js';

const W = 1672, H = 941, DIR = 'assets/splash/';
// [x, y, w, h] в пикселите на оригинала (1672×941)
const L = { truck: [1217, 578, 434, 293], 'patch-truck': [1197, 558, 475, 334], load: [449, 347, 62, 55], 'patch-load': [443, 292, 74, 117], build: [365, 208, 323, 239], logo: [416, 0, 832, 326] };
// нощните слоеве — същата геометрия (build-n, load-n, patch-load-n); logo-n е дневното лого в нощни цветове + 16 px ореол наоколо
const LN = { night: [0, 0, W, H], 'patch-load-n': [443, 292, 74, 117], 'build-n': [365, 208, 323, 239], 'load-n': [449, 347, 62, 55], 'logo-n': [400, -16, 864, 358] };
const MOON = [1384, 128];
const LIGHTS = [166,78,148,149,150,158,131,194,1598,201,105,203,1582,226,1583,232,1594,241,1584,250,1593,255,1599,256,1593,269,1592,277,341,286,1475,294,1462,296,331,300,1593,301,1593,305,1459,307,1586,327,1461,344,1525,366,132,370,1478,376,1486,377,846,379,1604,379,1594,380,1621,380,1585,381,1528,382,22,389,11,392,356,392,1473,394,64,398,714,400,1462,401,1485,406,1422,411,1446,413,1315,417,360,418,970,418,1165,418,975,419,100,422,767,422,195,424,1171,426,1568,428,1325,429,1610,429,1584,430,1524,433,1457,437,1489,437,80,438,261,438,1446,439,1593,439,1030,442,1082,446,1523,449,1609,450,1069,451,1562,455,1168,456,1534,456,1550,456,885,460,1376,460,363,462,1226,462,364,466,55,467,60,467,68,468,262,468,572,468,1173,468,204,472,1540,476,1089,478,1608,480,877,483,1094,483,289,484,826,484,278,489,1038,490,1116,490,223,491,910,492,1120,493,576,495,1031,495,236,497,1064,498,1450,502,222,503,781,505,236,508,1259,509,1073,512,1126,512,888,513,1440,513,1133,515,896,520,1424,523,607,525,1653,526,1402,527,1041,530,1242,530,1282,538,737,540,1250,541,1268,544,1243,545,837,546,1081,549,274,553,247,554,571,554,1320,554,1353,555,1497,575,1484,576,623,577,1626,577,971,578,593,579,1666,581,228,587,1552,588,75,589,459,589,251,593,1594,593,668,594,100,598,633,598,612,599,691,599,692,600,1423,603,148,604,593,605,100,607,682,607,150,608,464,608,346,610,787,623,1139,623,1038,624,1369,625,153,626,104,627,124,628,679,628,1015,628,788,634,856,635,1296,636,1296,640,138,642,935,642,484,645,783,645,789,645,911,647,837,648,673,650,109,652,150,652,884,652,729,655,915,655,775,659,764,662,712,665,493,673,1285,673,1295,673,726,674,1371,677,601,679,678,682,668,683,532,684,1425,684,687,686,565,687,722,688,916,688,924,689,1566,696,450,701,459,713,766,713,1512,714,35,720,442,721,538,721,584,722,591,722,855,722,640,724,871,724,667,726,682,726,463,729,910,730,766,731,776,731,841,731,890,731,915,731,1016,733,529,742,1001,742,547,743,566,744,832,747,529,751,641,751,175,753,505,753,827,756,1484,756,232,757,258,758,269,759,453,759,354,760,364,762,540,762,813,763,1025,778,999,779,703,783,1044,784,694,790,1509,790,690,791,1481,791,1274,800,1285,804,1337,810,1281,822,887,824,1206,826,1304,841,1192,842];   // светлините на нощния град и крановете (x, y), за трептенето
const HEAD = [[288, 162], [413, 192]];   // фаровете на самосвала (в спрайта)
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
  const keys = [...Object.keys(L), ...Object.keys(LN)];
  Promise.all([load('assets/ui/splash.webp'), ...keys.map(k => load(DIR + k + '.webp'))]).then(([bg, ...imgs]) => {
    if (!ld.isConnected || ld.classList.contains('out') || (real() > 0.9 && !Number.isFinite(window.__splashP))) return;   // играта вече е готова — няма смисъл
    const I = {}; keys.forEach((k, i) => { I[k] = imgs[i]; });
    run(ld, box, cv, ctx, bg, I, real, txt);
  }).catch(e => { console.warn('splash-anim', e && e.message || e); });
}

function run(ld, box, cv, ctx, bg, I, real, txt) {
  const off = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const [bc, bx] = off(L.build[2], L.build[3]);   // сградата с маската (ден)
  const [bcn, bxn] = off(L.build[2], L.build[3]); // … и нощ
  const [nc, nx] = off(W, H);                     // нощната сцена — върху дневната с прозрачност
  const [tc, tcx] = off(L.truck[2], L.truck[3]);  // самосвалът, оцветен за залеза/нощта
  const [sc, sx] = off(Math.max(L.logo[2], LN['logo-n'][2]), Math.max(L.logo[3], LN['logo-n'][3]));    // блясъкът по логото
  const [gc, gcx] = off(32, 32); { const g = gcx.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.25, 'rgba(255,210,140,.55)'); g.addColorStop(1, 'rgba(255,190,110,0)'); gcx.fillStyle = g; gcx.fillRect(0, 0, 32, 32); }
  const tw = Array.from({ length: LIGHTS.length / 2 }, () => [0.6 + Math.random() * 2.2, Math.random() * 6.3, 5 + Math.random() * 7]);   // [скорост, фаза, размер]
  let lastTint = -1;
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

    // 🌇 ден → залез → нощ
    const n = smooth(0.35, 0.9, p), warm = p > 0.22 && p < 0.85 ? Math.sin(Math.PI * (p - 0.22) / 0.63) : 0;

    // 🏗️ сградата расте: разкриване отдолу нагоре с мек ръб (еднакво за деня и нощта)
    const e = easeInOut(p), edge = B_TOP + (B_END - B_TOP) * e;
    if (Math.abs(edge - lastEdge) > 0.05) { lastEdge = edge; maskBuild(bx, I.build, edge); maskBuild(bxn, I['build-n'], edge); }
    if (target > p + 0.01 && edge < B_TOP - 4 && Math.random() < dt * 9) sparks.push({ x: 380 + Math.random() * 300, y: edge + 4, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.5 + Math.random() * 0.4, t: 0 });
    const a = Math.sin(t * 1.15) * 0.022 + Math.sin(t * 0.47) * 0.008;   // люлеенето на товара

    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if (n < 1) {
      ctx.drawImage(bg, 0, 0, W, H);
      put(ctx, L, 'patch-truck');   // пътят без самосвала (накрая е нощ — затова не се връщаме към дневния самосвал)
      put(ctx, L, 'patch-load');
      sun(t);
      for (const c of clouds) drawCloud(c, t);
      if (p > 0.001) ctx.drawImage(bc, L.build[0], L.build[1]);
      hanging(ctx, I.load, a, 'rgba(38,32,30,.85)');
      put(ctx, L, 'logo');
      if (warm > 0) {   // залезът: по-топло и по-тъмно
        ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,${200 - 50 * warm | 0},${170 - 70 * warm | 0},1)`; ctx.globalAlpha = 0.55 * warm; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgb(255,120,50)'; ctx.globalAlpha = 0.4 * warm; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    if (n > 0) {
      nx.globalCompositeOperation = 'source-over'; nx.globalAlpha = 1;
      put(nx, LN, 'night'); put(nx, LN, 'patch-load-n');
      moon(nx, t); twinkle(nx, t);
      if (p > 0.001) nx.drawImage(bcn, L.build[0], L.build[1]);
      hanging(nx, I['load-n'], a, 'rgba(20,18,24,.9)');
      put(nx, LN, 'logo-n');
      ctx.globalAlpha = n; ctx.drawImage(nc, 0, 0); ctx.globalAlpha = 1;
    }

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
      ctx.fillStyle = sg; ctx.globalAlpha = 0.5 + 0.5 * n; ctx.fillRect(-215, -215, 430, 430); ctx.restore();
      const tint = Math.round((warm + 2 * n) * 50);
      if (tint !== lastTint) {   // залез — по-топъл, нощ — по-тъмен и син (фаровете светят отгоре)
        lastTint = tint; tcx.globalCompositeOperation = 'source-over'; tcx.clearRect(0, 0, tc.width, tc.height); tcx.drawImage(I.truck, 0, 0);
        tcx.globalCompositeOperation = 'source-atop';
        if (warm > 0) { tcx.fillStyle = `rgba(150,60,20,${0.22 * warm})`; tcx.fillRect(0, 0, tc.width, tc.height); }
        if (n > 0) { tcx.fillStyle = `rgba(22,22,50,${0.4 * n})`; tcx.fillRect(0, 0, tc.width, tc.height); }
      }
      const timg = tint ? tc : I.truck;
      if (s === 1 && !bob) ctx.drawImage(timg, L.truck[0], L.truck[1]);
      else ctx.drawImage(timg, tx, ty, L.truck[2] * s, L.truck[3] * s);
      const hl = Math.max(n, 0.6 * warm);
      if (hl > 0.02) {   // 🔦 фаровете: ярко ядро, ореол и светло петно на пътя пред самосвала
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [hx, hy] of HEAD) {
          const X = tx + hx * s, Y = ty + hy * s;
          ctx.globalAlpha = hl; ctx.drawImage(gc, X - 30 * s, Y - 30 * s, 60 * s, 60 * s);
          ctx.globalAlpha = 0.5 * hl; ctx.drawImage(gc, X - 90 * s, Y - 60 * s, 180 * s, 120 * s);
        }
        ctx.globalAlpha = 0.28 * hl; ctx.drawImage(gc, tx + 300 * s, ty + 250 * s, 260 * s, 90 * s);
        ctx.restore();
      }
      if (v > 3) for (const [wx, wy] of WHEELS) if (Math.random() < dt * Math.min(24, v * 0.4)) puffs.push({ x: tx + wx * s, y: ty0 + wy * s, vx: -12 - Math.random() * 28, vy: -6 - Math.random() * 12, r: (5 + Math.random() * 7) * s, life: 1.2 + Math.random(), t: 0 });   // прахът — назад (горе-вляво)
    }
    particles(dt);
    for (const m of motes) drawMote(m, dt, t);
    if (shineT >= 0 && t - shineT < 1.3) shine((t - shineT) / 1.3);

    if (!shown) { shown = true; requestAnimationFrame(() => { cv.style.opacity = '1'; }); }
    raf = requestAnimationFrame(frame);
  };

  const put = (c, T, k) => c.drawImage(I[k], T[k][0], T[k][1]);
  function maskBuild(c, img, edge) {
    const [, by, bw, bh] = L.build, y = edge - by;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, bw, bh); c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    const g = c.createLinearGradient(0, y - 7, 0, y + 7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g; c.fillRect(0, 0, bw, bh);
  }
  function hanging(c, img, a, cable) {   // 🏗️ товарът на крана се люлее около куката
    c.save(); c.translate(PIVOT[0], PIVOT[1]); c.rotate(a); c.translate(-PIVOT[0], -PIVOT[1]);
    c.strokeStyle = cable; c.lineWidth = 1.1; c.beginPath();
    for (const cx of CABLES) { c.moveTo(PIVOT[0], PIVOT[1] + 2); c.lineTo(cx, CABLE_Y); }
    c.stroke(); c.fillStyle = cable; c.fillRect(PIVOT[0] - 3, PIVOT[1] - 1, 6, 6);
    c.drawImage(img, L.load[0], L.load[1]); c.restore();
  }
  function moon(c, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const r = 70 + 6 * Math.sin(t * 0.8), g = c.createRadialGradient(MOON[0], MOON[1], 10, MOON[0], MOON[1], r);
    g.addColorStop(0, 'rgba(200,215,255,.32)'); g.addColorStop(0.4, 'rgba(150,170,230,.12)'); g.addColorStop(1, 'rgba(120,140,220,0)');
    c.fillStyle = g; c.fillRect(MOON[0] - r, MOON[1] - r, 2 * r, 2 * r); c.restore();
  }
  function twinkle(c, t) {   // ✨ светлините на града и крановете леко трептят
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < tw.length; i++) {
      const [sp, ph, sz] = tw[i], k = Math.sin(t * sp + ph); if (k < 0.2) continue;
      c.globalAlpha = 0.45 * (k - 0.2); c.drawImage(gc, LIGHTS[2 * i] - sz, LIGHTS[2 * i + 1] - sz, 2 * sz, 2 * sz);
    }
    c.restore();
  }

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
    const T = p > 0.6 ? LN['logo-n'] : L.logo, [lx, ly, lw, lh] = T, cx = -60 + (lw + 120) * easeInOut(u);
    sx.globalCompositeOperation = 'source-over'; sx.clearRect(0, 0, sc.width, sc.height); sx.drawImage(p > 0.6 ? I['logo-n'] : I.logo, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    const g = sx.createLinearGradient(cx - 90, 0, cx + 90, lh * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,250,225,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    sx.fillStyle = g; sx.fillRect(0, 0, lw, lh);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.75 * Math.sin(Math.PI * u); ctx.drawImage(sc, lx, ly); ctx.restore();
  }

  const frame = now => { try { draw(now); } catch (e) { console.warn('splash-anim', e); cancelAnimationFrame(raf); cv.remove(); } };   // грешка → статичната картина
  raf = requestAnimationFrame(frame);
  const guard = setInterval(() => { if (!ld.isConnected) { cancelAnimationFrame(raf); clearInterval(guard); } }, 1000);
}

const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;

// 🎬 splash-video (29.10): живият клип от Kling (assets/splash/splash-day.mp4, без звук, в цикъл) вместо рисуваната анимация; логото — отгоре
// (клипът е без надпис), на мястото му в картината (L.logo, в % от 1672×941). Без видео (грешка, „намалено движение“) — старото поведение.
function startVideo() {
  const ld = document.getElementById('loading'), box = ld && ld.querySelector('.ld-box');
  if (!box || ld.classList.contains('pol')) return false;
  if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const v = document.createElement('video'); v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto'; v.poster = DIR + 'splash-day.jpg'; v.src = DIR + 'splash-day.mp4';
  v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .5s;pointer-events:none';
  const [lx, ly, lw, lh] = L.logo, logo = new Image(); logo.src = DIR + 'logo.webp'; logo.alt = '';
  logo.style.cssText = `position:absolute;left:${lx / W * 100}%;top:${ly / H * 100}%;width:${lw / W * 100}%;height:${lh / H * 100}%;pointer-events:none;filter:drop-shadow(0 4px 14px rgba(0,0,0,.55))`;
  box.insertBefore(logo, box.firstChild); box.insertBefore(v, box.firstChild);   // лентата и надписът за зареждането остават отгоре
  v.addEventListener('playing', () => { v.style.opacity = '1'; }, { once: true });
  v.addEventListener('error', () => { v.remove(); logo.remove(); }, { once: true });
  const p = v.play(); if (p && p.catch) p.catch(() => {});
  return true;
}
try { if (!(feature('splash-video') && startVideo()) && feature('splash-anim')) start(); } catch (e) { console.warn('splash-anim', e); }
