// maplayers.js — отметки на картата: кои мрежи да се виждат (пътища, жп, море, полети), за да не е претрупана.
// game.js обвива всеки слой с wrap(kind, svg) и вика mount(#mapScreen) веднъж. Изборът се помни в браузъра (localStorage).
// Скриването е само с CSS клас на <svg> — картата не се прерисува.
export const LAYERS = [
  { key: 'road', ico: '🛣️', nm: 'Пътища' },
  { key: 'rail', ico: '🚆', nm: 'ЖП' },
  { key: 'sea', ico: '⚓', nm: 'Море' },
  { key: 'air', ico: '✈️', nm: 'Полети' },
];
const LS = 'stroiMapLayers';
const CSS = `
  #mapLayers { position:absolute; left:72px; bottom:16px; display:flex; gap:6px; flex-wrap:wrap; z-index:2; max-width:calc(100vw - 100px); }
  #mapLayers label { display:flex; align-items:center; gap:5px; padding:7px 11px; border-radius:10px; background:var(--panel); border:1px solid rgba(255,255,255,.12);
    font-size:13px; font-weight:700; cursor:pointer; user-select:none; color:var(--txt); }
  #mapLayers label.off { opacity:.45; }
  #mapLayers input { accent-color:var(--acc); margin:0; }
  ${LAYERS.map(l => `#mapSvg.hide-${l.key} .lay-${l.key}`).join(', ')} { display:none; }
`;

export function createMapLayers() {
  let on = Object.fromEntries(LAYERS.map(l => [l.key, true]));
  try { Object.assign(on, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const svg = () => document.getElementById('mapSvg');
  const apply = () => { const s = svg(); if (s) for (const l of LAYERS) s.classList.toggle('hide-' + l.key, !on[l.key]); };

  function mount(parent) {
    if (!parent || document.getElementById('mapLayers')) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const box = document.createElement('div'); box.id = 'mapLayers';
    box.innerHTML = LAYERS.map(l => `<label class="${on[l.key] ? '' : 'off'}" title="Покажи/скрий: ${l.nm}"><input type="checkbox" data-lay="${l.key}" ${on[l.key] ? 'checked' : ''}>${l.ico} ${l.nm}</label>`).join('');
    box.addEventListener('change', e => {
      const k = e.target.dataset.lay; if (!k) return;
      on[k] = e.target.checked; e.target.parentNode.classList.toggle('off', !on[k]);
      try { localStorage.setItem(LS, JSON.stringify(on)); } catch (e2) {}
      apply();
    });
    parent.appendChild(box);
    apply();
  }
  const wrap = (kind, html) => html ? `<g class="lay-${kind}">${html}</g>` : '';
  return { mount, wrap, apply, isOn: k => !!on[k] };
}
