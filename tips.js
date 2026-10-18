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
// 🏅 ново ниво на фирмата → съвет какво се отключи и къде се намира (излиза веднъж на ниво, и след ниво 10)
const LV_TIPS = {
  2: ['Цяла България, жп и магистрали', 'Отвори <b>🗺️ Карта</b> — вече виждаш всички български градове. Строй <b>жп линии</b> (материалите идват по-евтино) и <b>магистрали</b> (тол всеки ден). Започни с връзка между двата си най-силни града.'],
  3: ['Държавни поръчки', 'В таба <b>Поръчки</b> излизат <b>🏛️ търгове</b>: големи обекти с аванс 20%. Оферта около 80–85% от бюджета печели често; нужна е гаранция 20% и техника в града.'],
  4: ['Специалисти и курорти', '<b>👷 Архитект</b> (+10% към наградите) и <b>инженер</b> (+15% скорост) се наемат от таба <b>Офис</b>. На картата се появиха <b>🏔️ курортите</b> в България — купуваш земя и строиш хотел, който носи пари всеки сезон.'],
  5: ['Балканите', 'Жп линиите и магистралите вече стигат до <b>съседите</b> — Букурещ, Солун, Белград, Истанбул… Свържи София с тях от <b>🗺️ Картата</b>: по-дългите линии носят повече.'],
  6: ['Филиали, доставчици и пристанища', 'Отваряй <b>филиали</b> в балканските градове (🗺️ Карта → градът → Филиал). <b>📜 Офертите от доставчици</b> дават по-евтини материали за месеци. В крайморските градове строй <b>⚓ пристанище</b> и купувай кораби.'],
  7: ['Борса и курорти в чужбина', 'В <b>Банка → Борса</b> купуваш акции: купувай под средната за месец, продавай над нея. На картата има и <b>🌴 курорти в чужбина</b>.'],
  8: ['Европа и аутобани', 'Отключи се <b>Европа</b>. Строй <b>🔴 аутобани</b> (4+4 ленти, 3× тол) и <b>⚡ преки жп връзки</b> с <b>🔀 отклонения</b>. Първо свържи Балканите с Виена или Будапеща.'],
  9: ['Летища и самолети', 'Град на ниво 9 може да има <b>✈️ летище</b>. Строй го от прозореца <b>Летища</b>, купи самолети и отвори авиолинии — най-печелившите са между големите столици.'],
  10: ['Целият свят', 'Картата стана <b>световна</b>: Африка и останалите континенти се отключват с филиали. В прозорците на мрежите има <b>📈 прогрес</b> — колко от всеки континент е свързан.'],
  11: ['Мега хъбове и круизи', 'Летищата могат да станат <b>мега хъбове</b> (ниво 6–7) с повече самолети. В пристанищата купувай <b>🛳️ круизни кораби</b> — носят билети от туристите.'],
  12: ['Северна Америка', 'Отключи се <b>🗽 Северна Америка</b>. Нужен ти е филиал там — после Route 66 и големите американски градове.'],
  13: ['Специални поръчки', 'Идват <b>суперпоръчки</b> като Тунела под Ламанша и Кейп — Кайро. Виж ги в <b>📜 Оферти</b>: огромна награда, но трябва много техника и време.'],
  14: ['Южна Америка и управление наведнъж', 'Отключи се <b>🌎 Южна Америка</b>. В <b>🏙️ Градове</b> вече управляваш всичко с един бутон: <b>купи липсващата техника</b>, <b>включи складовете</b> и <b>купи всички квартали</b>.'],
  15: ['Холдинг', 'Започна <b>🏛️ Ерата на холдинга</b>: дружествата се развиват и получават <b>директори</b>, офисите стават <b>хотели</b>, а ти се бориш за <b>🏆 световната класация</b>. Отвори бутона <b>Холдинг</b> горе.'],
  16: ['Азия и петрол', 'Отключи се <b>🌏 Азия</b> и <b>🛢️ петролната империя</b>: кладенец → рафинерия → терминал → танкери. Цените на петрола ги определяш ти в прозореца <b>Петрол</b>.'],
  17: ['Своя банка и фондова борса', 'Основи <b>🏦 своя банка</b> (Холдинг → Банка): дава кредити и ти плаща месечен <b>дивидент</b> — депозит вече не ти трябва. Холдингът може да излезе на <b>📈 борсата</b> (IPO).'],
  18: ['Австралия и мегапроекти', 'Отключи се <b>🦘 Австралия</b>. В <b>Холдинг → 🌍 Мегапроекти</b> финансираш хиперлуп, Суец, Гибралтар и <b>петролопровод</b> — за него първо трябва да подпишат 4 държави.'],
  19: ['Твоят град и мегапоръчки', 'Строиш <b>🏙️ свой град от нулата</b>. Идват и <b>🛰️ мегапоръчките</b>: Панамският канал, Дариен, Транссибирската, „Гън“.'],
  20: ['Световна империя', '<b>👑 Ниво 20!</b> Отключени са <b>🤝 придобиванията</b> (поглъщаш конгломерати и местни конкуренти) и <b>🌐 световните концесии</b>. Целта: <b>№1 в света</b> в 🏆 Класацията.'],
};
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
function show(t, lv = 0) {
  document.getElementById('tipCard')?.remove();
  if (!document.getElementById('tipCss')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'tipCss', textContent: CSS }));
  if (lv) { const L = LV_TIPS[lv], c0 = document.createElement('div'); c0.id = 'tipCard';   // съвет за новото ниво
    c0.innerHTML = `<button class="tx" data-t="x" title="Затвори">✕</button><div class="tt">🏅 Ниво ${lv}: ${L[0]}</div><div>${L[1]}</div><div class="tf"><span style="flex:1">Ново на ниво ${lv}</span>${LV_TIPS[lv - 1] ? `<button class="btn2" data-t="lvprev">‹ ниво ${lv - 1}</button>` : ''}</div>`;
    c0.addEventListener('click', ev => { const k = ev.target.closest('[data-t]')?.dataset.t; if (k === 'x') c0.remove(); else if (k === 'lvprev') show(null, lv - 1); });
    document.body.appendChild(c0); clearTimeout(show.t); show.t = setTimeout(() => c0.isConnected && !c0.matches(':hover') && c0.remove(), 40000); return; }
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
  if (params.has('autotest') && !params.has('tips')) return;
  { const lv = window.__stroiLv ? window.__stroiLv() : 0;   // ново ниво с нещо ново → съвет (след картинката на нивото)
    if (lv && st.lvSeen == null) { st.lvSeen = lv; keep(); }   // първо пускане със стар запис — само за следващите нива
    if (lv > (st.lvSeen || 0)) { const modal = document.getElementById('modal');
      if (!document.getElementById('cine') && !document.getElementById('lvShow') && !document.getElementById('tourCard') && !(modal && !modal.classList.contains('hidden')) && vis(document.getElementById('tabs'))) {
        st.lvSeen = lv; keep(); if (LV_TIPS[lv]) { show(null, lv); return; } } } }
  if (st.off) return;
  if ((window.__stroiLv ? window.__stroiLv() : 0) > 10) return;   // сами — само до ниво 10 на фирмата (после се отварят само с 💡)
  const d = day(); if (!d || d === st.last) return;
  const modal = document.getElementById('modal');
  if (document.getElementById('cine') || document.getElementById('tourCard') || document.getElementById('tipCard') || (modal && !modal.classList.contains('hidden')) || vis(document.getElementById('mapScreen')) || !vis(document.getElementById('tabs'))) return;
  if (d < 2 || (st.last && d - st.last < 3 && !(money() < 0 && !st.seen.includes('neg')))) return;
  st.last = d; keep();
  show(pickTip());
}, 1500);
