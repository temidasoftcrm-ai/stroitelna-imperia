// moneyslider.js — плъзгач за пари като на банката (economy.js → depSlider): „➕ Внеси / ➖ Изтегли N €“, плъзгач от 0 до max,
// бързи бутони 25% / 50% / 75% / Всичко, ред „След това: …“ и голям бутон. Ползва го общият холдинг (coopcenter.js, Лабораторията → hold-slider).
// html: moneySliderHtml({ id, kind: 'in'|'out', max, value, after(v) → текст, go(v) → { txt, c, cls } (c — data-c на бутона) })
// wire: wireMoneySlider(box, { after, go, onPick(v) }) — пречертава реда и бутона при местене; onPick — стойността (за помнене / скритото поле)
const fmt = n => `${Math.round(n).toLocaleString('bg-BG')} €`;
export const msStep = max => max > 2e6 ? 10000 : max > 20000 ? 1000 : 100;
export function moneySliderHtml({ id, kind, max, value = 0, after, go, label }) {   // label — заглавието вместо „➕ Внеси / ➖ Изтегли“ (ui-batch2: подаръкът на партньора)
  max = Math.max(0, Math.floor(max)); const v = Math.min(value, max), inn = kind === 'in', g = go(v), dis = max > 0 ? '' : 'disabled';
  return `<div class="msl" data-msl="${id}" style="margin-top:10px">
    <div class="led" style="border:0"><span>${label || (inn ? '➕ Внеси' : '➖ Изтегли')}</span><b class="msl-v">${fmt(v)}</b></div>
    <input type="range" min="0" max="${max}" step="${msStep(max)}" value="${v}" ${dis} style="width:100%;padding:0;accent-color:${inn ? '#ffc93c' : '#7dd3ff'}">
    <div style="display:flex;gap:6px;margin:4px 0">${[25, 50, 75, 100].map(p => `<button class="btn2" data-mspct="${p}" style="flex:1;padding:4px 0;font-size:12px" ${dis}>${p === 100 ? 'Всичко' : p + '%'}</button>`).join('')}</div>
    <div class="mut msl-after" style="margin:0 0 4px">${after(v)}</div>
    <div style="display:flex;margin-top:4px"><button class="${g.cls || (inn ? 'btn' : 'btn2')} msl-go" data-c="${g.c}" style="flex:1" ${v > 0 ? '' : 'disabled'}>${g.txt}</button></div>
  </div>`;
}
export function wireMoneySlider(box, { after, go, onPick }) {
  const r = box.querySelector('input[type=range]'), b = box.querySelector('.msl-go'), inn = box.querySelector('.msl-v');
  const show = () => { const v = +r.value, g = go(v); inn.textContent = fmt(v); box.querySelector('.msl-after').innerHTML = after(v);
    b.textContent = g.txt; b.dataset.c = g.c; b.className = `${g.cls || b.className.split(' ')[0]} msl-go`; b.disabled = !v; onPick && onPick(v); };
  r.oninput = show;
  box.querySelectorAll('[data-mspct]').forEach(p => p.onclick = () => { const k = +p.dataset.mspct; r.value = k === 100 ? r.max : Math.round(+r.max * k / 100 / +r.step) * +r.step; show(); });
  return { value: () => +r.value, show };
}
