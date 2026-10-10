// bidding.js — наддаване за поръчки: вместо просто „Приеми“, предлагаш цена. По-ниската цена печели по-често;
// репутацията и предсрочните обекти помагат. Ако има конкурент (o.rival от rivals.js), състезаваш се с неговата цена.

export const BID_STEPS = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2];

// шанс да спечелиш при множител m спрямо бюджета на клиента (o.reward); rep = звезди 0–5
export function winChance(o, m, rep = 0) {
  const rivalM = o.rival && o.rival.bid ? o.rival.bid / o.reward : 1;   // конкурентът предлага rivalM × бюджета
  // базово: при m = цената на конкурента ~55%, всеки 5% по-евтино +17%, по-скъпо −20%; репутацията дава до +15%
  const diff = (rivalM - m) / 0.05;
  const p = 0.55 + diff * (diff > 0 ? 0.17 : 0.2) + rep * 0.03;
  return Math.max(0.03, Math.min(0.98, p));
}
// решава офертата: { win, price, rivalNm }
export function resolveBid(o, m, rep = 0) {
  const price = Math.round(o.reward * m / 500) * 500;
  return { win: Math.random() < winChance(o, m, rep), price, rivalNm: o.rival ? o.rival.nm : 'конкурентна фирма' };
}
// HTML за картата на офертата: бутони за цената и шанс; selected = избраният множител
export function bidHtml(o, selected, rep, fmt) {
  const m = selected || 1, ch = winChance(o, m, rep);
  return `<div class="bidrow" style="margin-top:8px">
    <div class="meta" style="margin:0 0 4px">💬 Твоята оферта: <b style="color:var(--txt)">${fmt(Math.round(o.reward * m / 500) * 500)} €</b>
      · шанс <b style="color:${ch > 0.6 ? 'var(--ok)' : ch > 0.35 ? 'var(--acc)' : 'var(--bad)'}">${Math.round(ch * 100)}%</b>
      ${o.rival ? ` · ${o.rival.nm} предлага ~${fmt(o.rival.bid)} €` : ''}</div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${BID_STEPS.map(s => `<button class="btn2" data-bid="${o.id}:${s}" style="padding:4px 7px;font-size:12px;${s === m ? 'background:var(--acc);color:#1a1200;border-color:var(--acc)' : ''}">${s < 1 ? '−' : s > 1 ? '+' : ''}${Math.round(Math.abs(s - 1) * 100)}%</button>`).join('')}</div>
  </div>`;
}
