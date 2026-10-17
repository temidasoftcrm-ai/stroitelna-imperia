// tips.js — „💡 Съвет“: кратки подсказки как да печелиш, как да наддаваш в търговете, кога да строиш магистрали и жп,
// как да не фалираш. Бутон 💡 в горната лента показва съвет (‹ › за следващ); сами излизат по един на няколко игрови дни,
// като първо идват съветите, които пасват на момента (минус в сметката, първия милион…). Само DOM — game.js не знае за тях.
// Помни се в браузъра: кои са видени и дали да излизат сами (localStorage 'stroiTips').
const LS = 'stroiTips';
const money = () => { const t = (document.getElementById('money')?.textContent || '').trim(), n = +(t.replace(/[^\d]/g, '') || 0); return /^[-−]/.test(t.replace(/^[^\d\-−]*/, '')) ? -n : n; };
const day = () => +((document.getElementById('day')?.textContent || '').match(/\d+/)?.[0] || 0);
// [ключ, заглавие, текст, кога пасва (по-важните първо)]
const TIPS = [
  ['neg', '🏦 Сметката е на минус', 'На минус плащаш <b>1% лихва на ден</b>. След 14 дни на минус идва несъстоятелност и имаш 15 дни да се оправиш — вземи кредит от 🏦 Банка, продай техника, акции или имот. Иначе — фалит.', () => money() < 0],
  ['million', '🚀 Първият милион', 'Сложи го в <b>жп линии и магистрали</b> (🗺️ Карта): носят пари всеки ден — превози и тол — без да чакаш поръчки. Първо свържи най-близките големи градове.', () => money() >= 1e6],
  ['start', '💰 Как да изкараш първите пари', 'Приемай поръчки, които техниката ти поема веднага (виж зелените значки Багер, Бригада, Самосвал). Предавай навреме — звездите растат и идват по-скъпи поръчки.', () => day() <= 4],
  ['tender', '🏛️ Обществени поръчки', 'В търговете конкурентите обикновено дават <b>78–98%</b> от бюджета. Оферта около <b>80%</b> печели често и още е на печалба. Под 75% рискуваш да работиш на загуба, над 95% почти винаги губиш.', () => day() > 10],
  ['bank', '🏦 Как се работи с банката', 'Дръж <b>резерв</b> поне колкото седмица заплати и поддръжка — иначе една неуспешна поръчка те вкарва на минус. Кредит вземай само за неща, които носят доход (техника, линия, имот). Излишните пари — на депозит.', () => day() > 6],
  ['bid', '💬 Офертата на поръчката', 'При конкурент свали цената с 5–10% — шансът скача с ~17% за всеки 5%. Без конкурент дай пълната цена или +5%: печелиш повече, а шансът още е добър.', () => true],
  ['rep', '⭐ Репутацията', 'Изпуснат срок сваля звезди. По-добре откажи поръчка, отколкото да я поемеш без техника. С повече звезди — по-големи поръчки и по-голям кредит.', () => true],
  ['fleet', '🚜 Техниката', 'Не купувай повече, отколкото искат обектите — всяка машина има поддръжка. Автоматичното снабдяване в гаража купува липсващото само.', () => true],
  ['stock', '📦 Складът', 'Зареждай материали, когато има разпродажба (горе излиза „Разпродажба: …“) — после строиш по-евтино.', () => true],
  ['estate', '🔑 Имоти и наеми', 'Купи празен парцел, построй за себе си и го дай под наем — пари всеки ден, без поръчки. Добре е за времето между големите обекти.', () => day() > 8],
  ['branch', '🏙️ Филиали', 'Когато централата е пълна с поръчки, отвори филиал в друг град от 🗺️ Картата. Техниката може да се мести между градовете.', () => day() > 15],
  ['cash', '💵 Пачките на покривите', 'Готовите сгради оставят пачки пари на покрива — натисни ги. При влизане в града се прибират сами.', () => day() <= 10],
  ['district', '🧱 Нови квартали', 'Свършиха свободните парцели? Купи нов квартал — без място няма нови поръчки и градът не може да се завърши.', () => day() > 20],
];
let st = { seen: [], off: false, last: 0 };
try { st = { ...st, ...JSON.parse(localStorage.getItem(LS) || '{}') }; } catch (e) {}
const keep = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
const CSS = `
  #tipCard { position:fixed; left:12px; bottom:14px; z-index:70; width:min(360px, calc(100vw - 24px)); background:linear-gradient(180deg,#232f22,#172016);
    color:var(--txt); border:2px solid #f5d142; border-radius:14px; padding:10px 12px; box-shadow:0 10px 28px rgba(0,0,0,.5); font-size:14px; line-height:1.45; }
  #tipCard .tt { font-weight:900; color:#f5d142; margin-bottom:4px; padding-right:22px; }
  #tipCard .tx { position:absolute; right:8px; top:6px; background:none; border:0; color:var(--mut); font-size:16px; cursor:pointer; }
  #tipCard .tf { display:flex; align-items:center; gap:6px; margin-top:8px; font-size:12px; color:var(--mut); }
  #tipCard .tf label { flex:1; cursor:pointer; }
  #top > #btnTips { order:0; }
`;
let idx = -1;
function pickTip() {   // първо подходящ и невиждан, после подходящ, после следващия
  const ok = TIPS.filter(t => { try { return t[3](); } catch (e) { return false; } });
  return ok.find(t => !st.seen.includes(t[0])) || ok[(ok.length && (st.seen.length % ok.length))] || TIPS[0];
}
function show(t) {
  document.getElementById('tipCard')?.remove();
  if (!document.getElementById('tipCss')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tipCss', textContent: CSS }));
  idx = TIPS.indexOf(t);
  if (!st.seen.includes(t[0])) { st.seen.push(t[0]); keep(); }
  const c = document.createElement('div'); c.id = 'tipCard';
  c.innerHTML = `<button class="tx" data-t="x" title="Затвори">✕</button><div class="tt">💡 ${t[1]}</div><div>${t[2]}</div>
    <div class="tf"><label><input type="checkbox" data-t="off" ${st.off ? '' : 'checked'}> показвай съвети сами</label>
    <button class="btn2" data-t="prev">‹</button><span>${idx + 1}/${TIPS.length}</span><button class="btn2" data-t="next">›</button></div>`;
  c.addEventListener('click', ev => {
    const k = ev.target.closest('[data-t]')?.dataset.t;
    if (k === 'x') c.remove();
    else if (k === 'next') show(TIPS[(idx + 1) % TIPS.length]);
    else if (k === 'prev') show(TIPS[(idx - 1 + TIPS.length) % TIPS.length]);
  });
  c.querySelector('[data-t="off"]').onchange = e => { st.off = !e.target.checked; keep(); };
  document.body.appendChild(c);
  clearTimeout(show.t); show.t = setTimeout(() => c.isConnected && !c.matches(':hover') && c.remove(), 25000);
}
function mount() {
  const top = document.getElementById('top'); if (!top || document.getElementById('btnTips')) return;
  const b = Object.assign(document.createElement('button'), { id: 'btnTips', className: 'btn2', textContent: '💡', title: 'Съвет — как да печелиш и да не фалираш' });
  b.style.touchAction = 'manipulation';
  b.onclick = () => document.getElementById('tipCard') ? document.getElementById('tipCard').remove() : show(pickTip());
  const after = document.getElementById('btnTour') || document.getElementById('btnNotif');
  if (after && after.parentNode === top) top.insertBefore(b, after.nextSibling); else top.appendChild(b);
}
// сами (до ниво 10 на развитие): по един съвет на 3 игрови дни (първият — на 2-ри ден), когато няма видео, прозорец, обиколка или карта
const vis = e => e && e.offsetParent !== null;
setInterval(() => {
  mount();
  const params = new URLSearchParams(location.search);
  if (st.off || params.has('autotest') && !params.has('tips')) return;
  if ((window.__stroiLv ? window.__stroiLv() : 0) > 10) return;   // сами — само до ниво 10 на фирмата (после се отварят само с 💡)
  const d = day(); if (!d || d === st.last) return;
  const modal = document.getElementById('modal');
  if (document.getElementById('cine') || document.getElementById('tourCard') || document.getElementById('tipCard') || (modal && !modal.classList.contains('hidden')) || vis(document.getElementById('mapScreen')) || !vis(document.getElementById('tabs'))) return;
  if (d < 2 || (st.last && d - st.last < 3 && !(money() < 0 && !st.seen.includes('neg')))) return;
  st.last = d; keep();
  show(pickTip());
}, 1500);
