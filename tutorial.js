// tutorial.js — подсказки за първата игра. Стъпките се отмятат сами, когато играчът направи нужното.
// Записът е в S.tut = { step, off }. deps: S(), projects(), units(), onMap(), openTab(t), save()
const STEPS = [
  { ico: '👋', t: 'Добре дошъл в „Строителна империя“!', d: 'Ти си собственик на нова строителна фирма. Започни от таб <b>„Поръчки“</b> вдясно и натисни <b>„Приеми“</b> на една къща.', tab: 'offers',
    done: c => c.projects().length > 0 },
  { ico: '🚜', t: 'Техниката тръгва сама', d: 'Бригадата, багерът и самосвалът отиват на обекта. Следи етапите в таб <b>„Обекти“</b>. Можеш да ускориш времето с ▶▶ горе.', tab: 'projects',
    done: c => c.projects().some(p => p.stage >= 1) },
  { ico: '📦', t: 'Материали', d: 'От етап „Основи“ нататък трябват материали. Купуват се сами, ако има пари; ако не — бутонът <b>„📦 Купи за обектите“</b> горе вляво или таб <b>„Склад“</b>.', tab: 'store',
    done: c => c.projects().some(p => p.mat && Object.keys(p.mat).length) || c.S().done > 0 },
  { ico: '💶', t: 'Пари на покрива', d: 'Когато обектът е готов, на покрива се появяват <b>пачки пари</b>. Натисни ги, за да ги прибереш!', tab: null,
    done: c => c.S().done > 0 && !(c.S().cash || []).length },
  { ico: '🏢', t: 'Расти', d: 'Купувай още техника в таб <b>„Техника“</b> и надграждай офиса и гаража в таб <b>„Офис“</b> — така поемаш повече обекти наведнъж.', tab: 'fleet',
    done: c => c.units().length > 3 || (c.S().officeLevel || 1) > 1 },
  { ico: '🗺️', t: 'Картата на България', d: 'Натисни <b>🗺️ Карта</b> горе вдясно: там строиш жп линии и магистрали, отваряш филиали и приемаш оферти. А <b>🎯 Куести</b> ти дават награди за всяка цел.', tab: null,
    done: c => c.onMap() },
];

export function createTutorial(deps) {
  const st = () => { const S = deps.S(); if (!S) return null; S.tut = S.tut || { step: 0, off: false }; return S.tut; };
  const css = document.createElement('style');
  css.textContent = `#tutBox { position:fixed; left:14px; bottom:16px; z-index:7; width:min(360px,calc(100vw - 28px)); background:linear-gradient(180deg,#1f2a3c,#141b27); border:2px solid var(--acc); border-radius:14px; padding:12px 14px; box-shadow:0 10px 30px rgba(0,0,0,.5); animation:tutIn .35s ease-out; }
  #tutBox .th { display:flex; gap:10px; align-items:center; font-weight:900; font-size:16px; color:var(--acc); }
  #tutBox .th span { font-size:26px; } #tutBox .tb { color:var(--txt); font-size:14px; line-height:1.5; margin:6px 0 10px; }
  #tutBox .tr { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--mut); }
  @keyframes tutIn { from { transform:translateY(20px); opacity:0; } }`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'tutBox'; box.style.display = 'none'; document.body.appendChild(box);
  let shown = -1;
  function render() {
    const t = st();
    if (!t || t.off || t.step >= STEPS.length || deps.onMap()) { box.style.display = 'none'; shown = -1; return; }
    if (shown === t.step) return;
    shown = t.step;
    const s = STEPS[t.step];
    box.innerHTML = `<div class="th"><span>${s.ico}</span>${s.t}</div><div class="tb">${s.d}</div>
      <div class="tr"><span>Урок ${t.step + 1} / ${STEPS.length}</span><span>${s.tab ? '<button class="btn2" id="tutGo">Покажи</button> ' : ''}<button class="btn2" id="tutSkip">Пропусни урока</button></span></div>`;
    box.style.display = 'block';
    box.querySelector('#tutSkip').onclick = () => { t.off = true; deps.save(); render(); };
    const go = box.querySelector('#tutGo'); if (go) go.onclick = () => deps.openTab(s.tab);
  }
  // вика се ~веднъж в секунда
  function tick() {
    const t = st(); if (!t || t.off) { render(); return; }
    let moved = false;
    while (t.step < STEPS.length && STEPS[t.step].done(deps)) { t.step++; moved = true; }
    if (moved) deps.save();
    render();
  }
  return { tick, reset: () => { const t = st(); if (t) { t.step = 0; t.off = false; shown = -1; render(); } } };
}
