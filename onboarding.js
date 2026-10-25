// onboarding.js — 🎓 onboarding (f9): кратък интерактивен урок при първа игра — камера, парцел, строеж, пари, смяна на града, настройки.
// Стъпките се отмятат сами, щом играчът направи нужното (или с „Напред“); „Пропусни“ го спира. Пази се в localStorage 'stroi-tut'
// (на компютъра, не в записа) — „Покажи урока пак“ в ⚙️ Настройки го пуска отначало. Докато върви, старите подсказки (tutorial.js) мълчат.
// deps: auto (false — не тръгва сам), S(), camera, canvas, projects(), onMap(), perfCheck() — „Проверка на компютъра“, ready() — играта е в града и няма отворен прозорец
const tabBtn = t => document.querySelector(`#tabs button[data-t="${t}"]`);
const STEPS = [
  { ico: '🎥', t: 'Камерата', d: 'Влачи с <b>левия бутон</b>, за да се движиш из града. С <b>десния</b> въртиш, а с <b>колелцето</b> приближаваш и отдалечаваш.',
    done: c => c.moved() },
  { ico: '🟩', t: 'Купи парцел', d: 'Отвори таб <b>„Имоти“</b> вдясно и натисни <b>„Купи“</b> на някой празен парцел — на него строиш свои сгради за наем. Ако още нямаш пари, мини с „Напред“ и се върни по-късно.', hl: () => tabBtn('estate'), go: ['Отвори „Имоти“', () => tabBtn('estate')?.click()],
    base: c => { const e = c.S().estate || {}; return (e.land || []).length + (e.owned || []).length; }, done: (c, b) => { const e = c.S().estate || {}; return (e.land || []).length + (e.owned || []).length > b; } },
  { ico: '🏗️', t: 'Построй', d: 'В <b>„Имоти“</b> избери какво да построиш на парцела. Можеш и да приемеш поръчка от таб <b>„Поръчки“</b> — техниката тръгва сама.', hl: () => tabBtn('offers'), go: ['Отвори „Поръчки“', () => tabBtn('offers')?.click()],
    base: c => c.projects().length + (c.S().done || 0), done: (c, b) => c.projects().length + (c.S().done || 0) > b },   // нов обект (началните не се броят)
  { ico: '💶', t: 'Събери парите', d: 'Когато сградата е готова, на покрива ѝ изскачат <b>пачки пари</b>. Натисни ги, за да ги прибереш. Докато чакаш, можеш да продължиш напред.',
    grow: true, base: c => (c.S().cash || []).length, done: (c, b) => b > 0 && !(c.S().cash || []).length },   // имаше пачки и ги прибра
  { ico: '🗺️', t: 'Смени града', d: 'Натисни <b>🗺️ Карта</b> горе. Оттам влизаш в други градове, строиш пътища и жп линии и отваряш филиали.', hl: () => document.getElementById('btnMapToggle'),
    done: c => c.onMap() },
  { ico: '⚙️', t: 'Настройки', d: 'В <b>⚙️ Настройки</b> горе са звукът, записите и <b>графиката</b>. „Проверка на компютъра“ казва дали играта ще върви гладко и предлага ниво.', hl: () => document.getElementById('btnSettings'), go: ['🖥️ Провери сега', c => c.perfCheck()],
    done: c => c.setOpened },
  { ico: '🎉', t: 'Готов си!', d: 'Това е основното. Изпълнявай поръчки, купувай техника и расти. Урока можеш да видиш пак от <b>⚙️ Настройки → „Покажи урока пак“</b>.', last: true },
];
const KEY = 'stroi-tut';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const keep = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { } };

export function createOnboarding(deps) {
  let st = deps.auto === false ? null : load();   // { step, done } — null: още не е започвал; auto: false — само от restart() (Лабораторията)
  const css = document.createElement('style');
  css.textContent = `#onbBox { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:9; width:min(420px,calc(100vw - 32px)); box-sizing:border-box; background:linear-gradient(180deg,#22304a,#151c2a); border:2px solid var(--acc,#ffd54a); border-radius:14px; padding:12px 14px; box-shadow:0 10px 30px rgba(0,0,0,.55); color:var(--txt,#eee); animation:onbIn .35s ease-out; }
  #onbBox .oh { display:flex; gap:10px; align-items:center; font-weight:900; font-size:16px; color:var(--acc,#ffd54a); } #onbBox .oh span { font-size:26px; }
  #onbBox .ob { font-size:14px; line-height:1.5; margin:6px 0 10px; }
  #onbBox .of { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; align-items:center; font-size:12px; color:var(--mut,#9aa); } #onbBox .of .n { margin-right:auto; }
  #onbBox .dots { display:flex; gap:4px; margin-top:8px; justify-content:center; } #onbBox .dots i { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,.2); } #onbBox .dots i.on { background:var(--acc,#ffd54a); }
  .onbHl { outline:3px solid var(--acc,#ffd54a) !important; outline-offset:2px; animation:onbPulse 1.1s ease-in-out infinite; }
  body.onbOn #tutBox { display:none !important; }
  @keyframes onbIn { from { transform:translate(-50%,20px); opacity:0; } } @keyframes onbPulse { 50% { outline-color:transparent; } }`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'onbBox'; box.style.display = 'none'; document.body.appendChild(box);
  let shown = -1, hlEl = null, cam0 = null, setOpened = false, base = null, baseAt = -1;   // base — броят при началото на стъпката (нещата отпреди не я отмятат)
  let used = 0;   // камерата — само от играча (flyTo при старта не се брои): влачене или колелце по платното
  document.addEventListener('click', e => { if (e.target.closest?.('#btnSettings')) setOpened = true; }, true);
  deps.canvas.addEventListener('wheel', () => used++, { passive: true }); deps.canvas.addEventListener('pointermove', e => { if (e.buttons) used++; });
  const c = { ...deps, get setOpened() { return setOpened; },
    moved: () => { const p = deps.camera.position, q = deps.camera.quaternion; if (!cam0) { cam0 = { p: p.clone(), q: q.clone() }; used = 0; return false; } return used > 8 && (p.distanceTo(cam0.p) > 6 || q.angleTo(cam0.q) > 0.15); } };
  const unHl = () => { if (hlEl) hlEl.classList.remove('onbHl'); hlEl = null; };
  const active = () => st && !st.done && st.step < STEPS.length;
  function stop(done) { st = { step: done ? STEPS.length : st.step, done: true }; keep(st); unHl(); box.style.display = 'none'; shown = -1; document.body.classList.remove('onbOn'); }
  function next() { st.step++; keep(st); if (st.step >= STEPS.length) stop(true); else render(); }
  function render() {
    if (!active() || !deps.ready()) { box.style.display = 'none'; unHl(); document.body.classList.toggle('onbOn', !!active()); return; }
    document.body.classList.add('onbOn');
    const s = STEPS[st.step], el = s.hl?.() || null;
    if (el !== hlEl) { unHl(); if (el) { el.classList.add('onbHl'); hlEl = el; } }
    if (shown === st.step && box.style.display !== 'none') return;
    shown = st.step; if (st.step === 0) cam0 = null;
    box.innerHTML = `<div class="oh"><span>${s.ico}</span>${s.t}</div><div class="ob">${s.d}</div>
      <div class="of"><span class="n">Стъпка ${st.step + 1} / ${STEPS.length}</span>${s.go ? `<button class="btn2" data-o="go">${s.go[0]}</button>` : ''}${s.last ? '' : '<button class="btn2" data-o="skip">Пропусни урока</button>'}<button class="btn" data-o="next">${s.last ? 'Започни!' : 'Напред ›'}</button></div>
      <div class="dots">${STEPS.map((_, i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div>`;
    box.style.display = 'block';
    box.querySelector('[data-o="next"]').onclick = () => next();
    const sk = box.querySelector('[data-o="skip"]'); if (sk) sk.onclick = () => stop(false);
    const go = box.querySelector('[data-o="go"]'); if (go) go.onclick = () => s.go[1](c);
  }
  // ~2 пъти в секунда; първата игра — ако няма запис 'stroi-tut' и фирмата е нова (стар играч след ъпдейт — без урока)
  function tick() {
    if (!st) { if (!deps.ready() || deps.auto === false) return; const S = deps.S(); if ((S?.day || 0) > 3 || (S?.done || 0) > 2) { st = { step: 0, done: true, old: true }; keep(st); return; } st = { step: 0, done: false }; keep(st); }
    if (!active()) return;
    if (deps.ready()) { const s = STEPS[st.step]; if (baseAt !== st.step) { baseAt = st.step; base = s.base ? s.base(c) : null; }
      else if (s.grow) base = Math.max(base, s.base(c));   /* парите: чака да се появят пачки, после да ги прибере */
      if (s.done && s.done(c, base)) { next(); return; } }
    render();
  }
  const iv = setInterval(() => { try { tick(); } catch (e) { } }, 500);
  return { tick, restart: () => { st = { step: 0, done: false }; keep(st); shown = -1; cam0 = null; setOpened = false; baseAt = -1; render(); }, step: () => st?.step ?? -1, active, stop: () => { clearInterval(iv); unHl(); box.remove(); } };
}
