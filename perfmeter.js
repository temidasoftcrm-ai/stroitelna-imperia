// perfmeter.js — 🖥️ perf-meter (f9): играта е за компютър.
// pcGate() — на телефон/таблет (тъч без мишка) вместо 3D: екран „Играта е за компютър“ с бутон „Опитай все пак“ (запомня се);
// game.js го чака преди рендера. ?pc=1 — без проверката, ?phone=1 — за проба на компютър.
// perfCheck() — ⚙️ Настройки → „Проверка на компютъра“: видеокартата (WebGL), бърза сцена (~4 s, мярка на кадъра),
// памет, ядра, екран → светофар 🟢 / 🟡 (засича в мегаполисите) / 🔴 (слаб) с кратко „защо“ и съвет.
import * as THREE from 'three';
import { feature } from './lab/feature.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `.pcBox{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(8,10,16,.92);font:15px/1.5 system-ui,sans-serif;color:#e8e8ea;padding:16px;box-sizing:border-box}
.pcBox .in{background:#161a22;border:1px solid #2c3442;border-radius:14px;max-width:460px;width:100%;padding:22px 22px 18px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.pcBox h2{margin:0 0 8px;font-size:21px}.pcBox p{margin:0 0 10px;color:#b8c0cc}.pcBox .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pcBox button{flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid #39465a;background:#232a36;color:#e8e8ea;font:inherit;font-weight:600;cursor:pointer}.pcBox button.go{background:#2f6fe0;border-color:#2f6fe0}
.pcBox .light{font-size:44px;line-height:1;margin:4px 0 8px}.pcBox ul{margin:6px 0 10px;padding-left:18px;color:#c9d0da}.pcBox li{margin:2px 0}.pcBox .bar{height:6px;border-radius:3px;background:#232a36;overflow:hidden;margin:12px 0 4px}.pcBox .bar i{display:block;height:100%;width:0;background:#4ea1ff;transition:width .2s}
.pcBox small{color:#7d8796}`;
const box = html => { if (!document.getElementById('pcCss')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'pcCss', textContent: CSS })); const d = document.createElement('div'); d.className = 'pcBox'; d.innerHTML = `<div class="in">${html}</div>`; document.body.appendChild(d); return d; };

// телефон/таблет: тъч, без мишка/тъчпад (any-pointer: fine), или мобилен браузър
export const isTouchDevice = () => { const q = location.search; if (/[?&]pc=1/.test(q)) return false; if (/[?&]phone=1/.test(q)) return true;
  const fine = matchMedia('(any-pointer: fine)').matches, touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window, ua = navigator.userAgent || '';
  return (touch && !fine) || /Android.+Mobile|iPhone|iPod|Windows Phone/i.test(ua); };
export function pcGate() {
  if (!feature('perf-meter') || !isTouchDevice()) return Promise.resolve();
  try { if (localStorage.getItem('stroi-pc-anyway') === '1' && !/[?&]phone=1/.test(location.search)) return Promise.resolve(); } catch { }
  return new Promise(res => { const d = box(`<div class="light">🖥️</div><h2>Играта е за компютър</h2>
    <p>„Строител“ е голяма 3D игра: истински карти на градове, хиляди сгради, коли и хора. На телефон или таблет екранът е малък, управлението е с мишка, а паметта и видеокартата обикновено не стигат — играта засича или се затваря.</p>
    <p>Отвори я на компютър или лаптоп (Chrome, Edge или Firefox).</p>
    <div class="row"><button class="go" id="pcTry">Опитай все пак</button></div><p style="margin-top:10px"><small>Ако устройството е с мишка и клавиатура — натисни „Опитай все пак“; няма да питаме пак.</small></p>`);
    d.querySelector('#pcTry').onclick = () => { try { localStorage.setItem('stroi-pc-anyway', '1'); } catch { } d.remove(); res(); }; });
}

// ---------- проверка на компютъра ----------
const GPU_SOFT = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa Offscreen/i;
const GPU_DISCRETE = /NVIDIA|GeForce|RTX|GTX|Quadro|Radeon (RX|Pro|R9|HD [5-9])|Radeon\(TM\) RX|Arc\(TM\) A|Intel.*Arc/i;
const GPU_APPLE = /Apple (M\d|GPU)/i;
function gpuInfo(main) {   // main — рендерът на играта (ако нов контекст не може — някои драйвери/браузъри ги ограничават)
  const c = document.createElement('canvas'); let gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl && main) gl = main.getContext(); if (!gl || gl.isContextLost()) return null;
  const ext = gl.getExtension('WEBGL_debug_renderer_info'), name = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '?';
  const r = { name: String(name).replace(/^ANGLE \((.*)\)$/, '$1'), maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), gl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext };
  return r;   // без loseContext — Chrome иначе спира новите контексти на страницата („caused context loss and was blocked“)
}
// бърза сцена „като мегаполис“: ~25 хил. сгради (инстанции, ~300 хил. △) със сенки, 1280×720 — колко ms е един кадър (с изчакване на видеокартата)
function frameTest(sec, onP, main) {
  return new Promise(res => {
    const W = 1280, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    let r = null, rt = null; try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); r.setSize(W, H, false); r.shadowMap.enabled = true; } catch { r = null; }
    if (!r) { if (!main) { res(null); return; } r = main; rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 }); }   // без свой контекст — в текстура с рендера на играта
    const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, W / H, 1, 3000); cam.position.set(0, 320, 520); cam.lookAt(0, 0, 0);
    sc.add(new THREE.HemisphereLight(0xdfe8ff, 0x332a20, 0.7)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(300, 500, 200); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, far: 1500 }); sc.add(sun);
    const N = 25000, geo = new THREE.BoxGeometry(1, 1, 1, 2, 3, 2), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xc9b89a, roughness: 0.8 }), N), m = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < N; i++) { const h = 6 + ((i * 7919) % 97) / 97 * 40; m.compose(new THREE.Vector3(((i % 160) - 80) * 9, h / 2, (Math.floor(i / 160) - 80) * 9), new THREE.Quaternion(), new THREE.Vector3(7, h, 7)); im.setMatrixAt(i, m); im.setColorAt(i, col.setHSL(0.08 + (i % 11) / 60, 0.3, 0.55 + (i % 5) / 25)); }
    im.castShadow = im.receiveShadow = true; sc.add(im);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ color: 0x6f7a5c })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; sc.add(g);
    const gl = r.getContext(), px = new Uint8Array(4), ms = [], t0 = performance.now();
    const step = () => { const t = performance.now(), el = (t - t0) / 1000; cam.position.x = Math.sin(el * 0.6) * 200;
      cam.lookAt(0, 0, 0); if (rt) { const pr = r.getRenderTarget(); r.shadowMap.needsUpdate = true; r.setRenderTarget(rt); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, 1, 1, px); r.setRenderTarget(pr); } else { r.render(sc, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } const dt = performance.now() - t;   // readPixels — изчаква видеокартата
      if (el > 0.6) ms.push(dt); onP(Math.min(1, el / sec));   // първите кадри (шейдърите) — без тях
      if (el < sec && !(el > 1.5 && ms.length > 4 && ms[ms.length - 1] > 400)) requestAnimationFrame(step);
      else { ms.sort((a, b) => a - b); const med = ms.length ? ms[ms.length >> 1] : 999; geo.dispose(); im.dispose(); if (rt) rt.dispose(); else r.dispose(); res({ ms: med, n: ms.length }); } };
    requestAnimationFrame(step);
  });
}
// присъдата: големите градове ползват ~2 GB памет и много сгради; софтуерното рисуване (SwiftShader) — червено
function verdict(g, t, ram, cores, scr) {
  const why = [], soft = !g || GPU_SOFT.test(g.name), disc = g && GPU_DISCRETE.test(g.name), apple = g && GPU_APPLE.test(g.name), ms = t ? t.ms : 999;
  let lv = 0;   // 0 — зелено, 1 — жълто, 2 — червено
  if (!g) { lv = 2; why.push('няма WebGL — браузърът не може да рисува 3D'); }
  else if (soft) { lv = 2; why.push('рисува процесорът, не видеокартата (софтуерен режим)'); }
  else why.push(disc ? 'самостоятелна видеокарта' : apple ? 'видеокарта Apple' : 'интегрирана видеокарта');
  if (t) { if (ms > 40) { lv = 2; why.push(`бавна видеокарта (~${Math.round(1000 / ms)} кадъра/с в теста)`); } else if (ms > 16) { lv = Math.max(lv, 1); why.push(`~${Math.round(1000 / ms)} кадъра/с в теста на голям град`); } else why.push(`бърза сцена — ~${Math.min(120, Math.round(1000 / ms))} кадъра/с`); }
  if (ram) { if (ram < 4) { lv = 2; why.push(`${ram} GB памет`); } else if (ram < 8) { lv = Math.max(lv, 1); why.push(`${ram} GB памет`); } else why.push(`${ram}+ GB памет`); }
  if (cores) { if (cores < 4) { lv = Math.max(lv, 1); why.push(`${cores} ядра`); } else why.push(`${cores} ядра`); }
  if (g && !disc && !apple && !soft && lv === 0 && ms > 9) { lv = 1; }   // интегрирана, без запас — мегаполисите засичат
  if (g && g.maxTex && g.maxTex < 8192) { lv = Math.max(lv, 1); why.push(`малки текстури (${g.maxTex})`); }
  if (scr.w < 1280 || scr.h < 700) why.push(`малък екран (${scr.w}×${scr.h})`);
  const tips = lv === 0 ? ['Всичко е наред — играй навсякъде.'] : [
    soft || !g ? 'Включи хардуерното ускорение в браузъра (Chrome/Edge: Настройки → Система → „Използвай графично ускорение“) и рестартирай браузъра.' : null,
    !disc && !apple && g && !soft ? 'На лаптоп с две видеокарти — избери „висока производителност“ за браузъра (Windows: Настройки → Дисплей → Графика).' : null,
    'Затвори другите табове и програми, докато играеш.',
    lv === 1 ? 'Малките и средните градове вървят добре; в мегаполисите (Москва, Рим, Ню Йорк…) може да засича — дръж камерата по-високо.' : 'Играй в малките градове; мегаполисите ще са бавни.',
  ].filter(Boolean);
  return { lv, why, tips };
}
export async function perfCheck(main, apply) {   // apply(ниво) — gfx-presets: „Приложи“ предложената графика ('high' / 'mid' / 'low')   // main — рендерът на играта (резервен, ако браузърът не дава нов контекст)
  const d = box(`<h2>🖥️ Проверка на компютъра</h2><p>Кратък тест (~5 s): видеокарта, бърза сцена като голям град, памет, ядра и екран.</p><div class="bar"><i id="pcBar"></i></div><small id="pcSt">Видеокартата…</small>`);
  const bar = d.querySelector('#pcBar'), st = d.querySelector('#pcSt');
  const g = gpuInfo(main); st.textContent = 'Бързата сцена…';
  const t = g ? await frameTest(4, p => { bar.style.width = (10 + p * 88) + '%'; }, main) : null;
  const ram = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0, scr = { w: Math.round(screen.width * (devicePixelRatio || 1)), h: Math.round(screen.height * (devicePixelRatio || 1)) };
  const v = verdict(g, t, ram, cores, scr), L = [['🟢', 'OK — върви добре навсякъде'], ['🟡', 'Върви, но ще засича в големите градове'], ['🔴', 'Слаб компютър — играта трудно ще върви']][v.lv];
  d.querySelector('.in').innerHTML = `<h2>🖥️ Проверка на компютъра</h2><div class="light">${L[0]}</div><h2 style="font-size:18px">${L[1]}</h2>
    <p>Защо: ${esc(v.why.join(', '))}.</p><ul>${v.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p><small>Видеокарта: ${esc(g ? g.name : 'няма WebGL')}${g ? ` · текстури до ${g.maxTex}` : ''}${t ? ` · кадър в теста ~${t.ms.toFixed(1)} ms` : ''}${ram ? '' : ' · паметта — браузърът не я казва'}</small></p>
    ${apply ? `<p style="margin-top:8px">Предложение: графика <b>${['🟢 Високо', '🟡 Средно', '🔴 Ниско'][v.lv]}</b>.</p>` : ''}
    <div class="row">${apply ? `<button class="go" id="pcApply">Приложи: ${['Високо', 'Средно', 'Ниско'][v.lv]}</button>` : ''}<button class="${apply ? '' : 'go'}" id="pcOk">${apply ? 'Не сега' : 'Добре'}</button><button id="pcAgain">↻ Пак</button></div>`;
  window.__perfCheck = { lv: v.lv, why: v.why, gpu: g && g.name, ms: t && t.ms, ram, cores };   // за Лабораторията/тестовете
  return new Promise(res => { d.querySelector('#pcOk').onclick = () => { d.remove(); res(v); }; d.querySelector('#pcAgain').onclick = () => { d.remove(); perfCheck(main, apply).then(res); };
    const ap = d.querySelector('#pcApply'); if (ap) ap.onclick = () => { d.remove(); apply(['high', 'mid', 'low'][v.lv]); res(v); }; });
}
