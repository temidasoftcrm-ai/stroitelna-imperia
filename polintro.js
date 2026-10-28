// polintro.js — 🎬 флаг 'politics-intro': заглавната картина на ЧАСТ 2 „Пътят към политиката“ (картината на собственика, assets/splash/politics*.webp).
// Пуска се сама веднъж — щом фирмата стигне ниво 25 (S.imp.lv — „Град за пример“, поканата на Десислава за кампанията) или за стар запис — в режим политика (S.pres); polMode в game.js;
// помни се в записа (S.polIntro = денят). На цял екран: плавно появяване, бавно приближаване (Ken Burns), „Част 2“, бутон „Продължи“;
// клик, Esc, Enter или интервал — затваря. Играта е на пауза, докато е на екрана. Гледа се пак от „🎬 Албум на империята“ (cinema.js → albumExtra).
// На английски картината остава българска — отдолу стои малък английски надпис „Part 2: The Road to Politics“.
// deps: { S(), save(), speed(), setSpeed(n), auto() → false в тестовете, busy() → зареждане/кино на екрана }
import { feature } from './lab/feature.js';
import { t as tr, EN } from './i18n.js';

const ON = feature('politics-intro');
const IMG = 'assets/splash/politics.webp', IMG_S = 'assets/splash/politics-900.webp';
const CSS = `
#polIntro { position:fixed; inset:0; z-index:320; background:#000; opacity:0; transition:opacity .9s ease; overflow:hidden; user-select:none; cursor:pointer; }
#polIntro.on { opacity:1; }
#polIntro.out { opacity:0; transition:opacity .7s ease; }
#polIntro .bg { position:absolute; inset:-40px; background:url(${IMG_S}) center/cover; filter:blur(22px) brightness(.45); }
#polIntro img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform-origin:62% 42%; transform:scale(1); }
#polIntro.on img { animation:polKb 16s ease-out forwards; }
@keyframes polKb { from { transform:scale(1); } to { transform:scale(1.12) translate(-1.2%, .6%); } }
@media (max-aspect-ratio: 4/3) { #polIntro img { object-fit:contain; transform-origin:50% 50%; } }
@media (prefers-reduced-motion: reduce) { #polIntro.on img { animation:none; } }
#polIntro .vig { position:absolute; inset:0; pointer-events:none; background:linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.25) 26%, rgba(0,0,0,0) 45%), radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.45) 100%); }
#polIntro .cap { position:absolute; left:0; right:0; bottom:max(28px, 7vh); text-align:center; padding:0 16px; color:#fff; font-family:system-ui,sans-serif; opacity:0; transform:translateY(12px); transition:opacity 1.2s ease 1.4s, transform 1.2s ease 1.4s; pointer-events:none; }
#polIntro.on .cap { opacity:1; transform:none; }
#polIntro .cap b { display:block; font-size:clamp(15px,2.2vw,22px); letter-spacing:.42em; font-weight:800; color:#ffd36a; text-shadow:0 2px 14px rgba(0,0,0,.9), 0 0 26px rgba(255,190,60,.35); }
#polIntro .cap i { display:block; margin-top:6px; font-style:normal; font-size:clamp(17px,2.8vw,28px); font-weight:700; color:#fff; text-shadow:0 2px 12px rgba(0,0,0,.95); }
#polIntro .cap span { display:block; width:min(260px, 50vw); height:1px; margin:10px auto 0; background:linear-gradient(90deg, transparent, #ffd36a, transparent); }
#polIntro .go { position:absolute; right:max(16px, 3vw); bottom:max(22px, 5vh); padding:10px 22px; border-radius:12px; border:1px solid #ffd36a; background:rgba(10,14,24,.72); color:#ffd36a; font:800 16px system-ui,sans-serif; letter-spacing:.04em; cursor:pointer; opacity:0; transition:opacity .8s ease 2.6s, background .2s; }
#polIntro.on .go { opacity:1; }
#polIntro .go:hover, #polIntro .go:focus-visible { background:#ffd36a; color:#111; outline:none; }
@media (max-width: 600px) { #polIntro .cap { bottom:86px; } #polIntro .go { left:50%; right:auto; transform:translateX(-50%); } }
`;

export function createPolIntro(deps = {}) {
  if (!ON) return { maybe() { }, show() { }, albumCard() { }, seen: () => false, open: () => false };
  let el = null, styled = false, wait = null, prevSpeed = null;
  const S = () => deps.S?.();
  const eligible = s => !!s && (!!s.pres || (s.imp?.lv || 0) >= 25);   // от ниво 25 нататък
  const style = () => { if (styled) return; styled = true; const st = document.createElement('style'); st.id = 'polIntroCss'; st.textContent = CSS; document.head.appendChild(st); };

  function close() {
    if (!el) return; const e = el; el = null;
    document.removeEventListener('keydown', onKey, true);
    e.classList.add('out'); setTimeout(() => e.remove(), 750);
    if (prevSpeed != null) { try { deps.setSpeed?.(prevSpeed); } catch { } prevSpeed = null; }
  }
  function onKey(ev) { if (ev.key === 'Escape' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); close(); } }

  // manual — от албума/Лабораторията: не пипа записа
  function show(manual = false) {
    if (el) return; style();
    const s = S(); if (!manual && s && !s.polIntro) { s.polIntro = s.day || 1; try { deps.save?.(); } catch { } }
    try { const v = deps.speed?.(); if (v) { prevSpeed = v; deps.setSpeed?.(0); } } catch { }
    el = document.createElement('div'); el.id = 'polIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Част 2: Пътят към политиката');
    el.innerHTML = `<div class="bg"></div><img alt="" decoding="async" srcset="${IMG_S} 900w, ${IMG} 1600w" sizes="100vw" src="${IMG}"><div class="vig"></div>`
      + `<div class="cap"><b>ЧАСТ 2</b>${EN ? `<i data-noi18n>${tr('Пътят към политиката')}</i>` : ''}<span></span></div><button class="go" type="button">Продължи ▶</button>`;
    const t0 = Date.now();
    el.addEventListener('click', () => { if (Date.now() - t0 > 500) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(el);
    const img = el.querySelector('img'), on = () => requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add('on')));
    if (img.complete) on(); else { img.onload = on; img.onerror = on; setTimeout(on, 2500); }
    setTimeout(() => el?.querySelector('.go')?.focus({ preventScroll: true }), 300);
  }

  // от polMode (всеки renderTop): евтино — само проверка на флага; изчаква зареждането и киното
  function maybe() {
    const s = S(); if (!eligible(s) || s.polIntro || wait || el) return;
    if (deps.auto && !deps.auto()) return;
    const t0 = Date.now();
    wait = setInterval(() => {
      const x = S(); if (!eligible(x) || x.polIntro) { clearInterval(wait); wait = null; return; }
      if (deps.busy?.() && Date.now() - t0 < 120000) return;
      clearInterval(wait); wait = null; show(false);
    }, 600);
  }

  // картичка в „🎬 Албум на империята“ (cinema.js вика albumExtra(grid))
  function albumCard(grid) {
    if (!grid) return; const s = S(), seen = !!s?.polIntro || eligible(s), d = document.createElement('div');
    d.className = seen ? 'it' : 'it lk';
    d.innerHTML = seen ? `<img src="${IMG_S}" alt=""><b>Част 2 — Пътят към политиката</b><span class="meta" style="margin:0">От строителната площадка до президентския дворец.</span><button class="btn" type="button">▶ Гледай</button>`
      : `<div class="ico">🔒</div><b>Част 2 — Пътят към политиката</b><span class="meta" style="margin:0">🔒 Достигни ниво 25</span>`;
    if (seen) d.querySelector('button').onclick = e => { e.stopPropagation(); show(true); };
    grid.appendChild(d);
  }

  return { maybe, show, albumCard, seen: () => !!S()?.polIntro, open: () => !!el, close };
}
