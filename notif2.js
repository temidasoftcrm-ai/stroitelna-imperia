// notif2.js — 🔔 notif2 (T2, пътната карта „🔔 Известията“): известията на три нива и дневник.
//   🔴 важни (пожар/инцидент, фалит, търг/договор, ново ниво, кооп, мир/криза — по текста; червените с действие „👁 Гледай“) — стоят, докато ги затвориш, до 3 наведнъж;
//   🟡 обикновени — 6 s; ⚪ рутинни (влакове, полети, кораби, ТИР-ове, автоматичните прибирания и пълнения) — само в дневника и в едно обобщение на ден
//   („🚆 Влакове днес: 34 курса · +420 000 €“), освен ако в ⚙️ „Покажи рутинните известия“ е включено. Еднаквите до ~5 s — едно известие „×N“.
//   Бутонът 🔔 в горната лента — брой непрочетени; панелът — последните 100 (кога, текст, „👁 Гледай“, ако известието е имало действие), филтър по нивото.
// const N = createNotif2({ box: #toasts, top: #top, day: () => S.day, clock: () => 'ден 12 · 14:30', fmt, sound: () => …, modeOff: () => bool });
//   N.toast(text, kind, onClick, level?) — level: 'red' | 'yellow' | 'routine' (по избор — иначе по kind и текста); N.rows() — редовете за ⚙️
const LS_R = 'stroiN2routine', LS_S = 'stroiN2sound';
const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { } };
// рутинните групи: шаблон → ключ; сумата (+N €) се събира
const GROUPS = [
  // влаковете, полетите и корабите: обобщението на деня го дава играта (game.js flowDay — с поддръжката и нетото); тук — само в дневника
  { k: 'train', re: /^(🎫 .+ пристигна в|🚆 .+ достави .+ в) .+: \+/, sum: null },   // пътническите (билети) и товарните (достави … в …)
  { k: 'flight', re: /^✈️ .+ кацна в .+: \+/, sum: null },
  { k: 'ship', re: /^(🚢|⛴️|🛳️|⚓).*(пристигна|акостира|разтовари).*\+/, sum: null },
  { k: 'tir', re: /^🚚 (ТИР|Материалите пътуват|Пристигна техника)/, sum: n => `🚚 ТИР-ове и доставки днес: ${n}` },
  { k: 'auto', re: /^(🔄 Автоматичн|✈️ Автоматично|🚢 .*получи(ха)? кора)/, sum: n => `🔄 Автоматични действия днес: ${n}` },
  { k: 'income', re: /^(💶 \+.*(прибрани автоматично|от „)|💵 Дивиденти)/, sum: (n, s) => `💶 Приходи днес: ${n} ${n === 1 ? 'плащане' : 'плащания'}${s !== '0' ? ` · +${s} €` : ''}` },
];
const RED = /🔥|пожар|🚨|инцидент|авари|катастроф|фалит|фалира|банкрут|търг|оферта.*(спечел|загуб)|🏆|🎉|ново ниво|ниво \d+ на развитие|🤝|партньор|кооп|мир(а|ът)?\b|война|криза|земетрес|наводн|бур[яи]|стачк|ултиматум|просроч|изтича|неустойк|опасност/i;
const amount = t => { const m = t.match(/\+\s?([\d\s .,]+)\s?€/); return m ? +m[1].replace(/[^\d]/g, '') || 0 : 0; };

export function createNotif2(o) {
  const log = [], counts = {}, shown = new Map();   // shown: текст → { el, n, timer }
  let unread = 0, lastInput = 0, day = o.day(), btn = null, panel = null, filt = 'all';
  const opt = { routine: get(LS_R, false), sound: get(LS_S, true) };
  addEventListener('pointerdown', () => { lastInput = performance.now(); }, true); addEventListener('keydown', () => { lastInput = performance.now(); }, true);
  const css = document.createElement('style'); css.textContent = `
    .toast.n2red { border-left-color:var(--bad); pointer-events:auto; padding-right:30px; position:relative; } .toast.n2red .n2x { position:absolute; right:6px; top:6px; background:none; border:0; color:var(--txt); cursor:pointer; font-size:14px; opacity:.7; }
    .toast.n2rt { opacity:.85; border-left-color:#8a93a0; font-size:13px; } .toast .n2n { display:inline-block; margin-left:6px; padding:0 6px; border-radius:8px; background:rgba(255,255,255,.14); font-size:12px; font-weight:700; }
    #btnN2 { position:relative; } #btnN2 .n2b { position:absolute; top:-4px; right:-4px; min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:var(--bad); color:#fff; font:700 11px/16px system-ui; text-align:center; }
    #n2Panel { position:fixed; top:calc(var(--topH, 56px) + 8px); right:14px; width:min(420px, calc(100vw - 28px)); max-height:min(70vh, 640px); display:flex; flex-direction:column; z-index:40; background:var(--panel); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,.45); }
    #n2Panel header { display:flex; align-items:center; gap:6px; padding:10px 12px; border-bottom:1px solid var(--line); font-weight:700; } #n2Panel header .sp { flex:1; }
    #n2Panel .f { display:flex; gap:4px; padding:8px 12px; flex-wrap:wrap; } #n2Panel .f button { background:none; border:1px solid var(--line); color:var(--txt); border-radius:12px; padding:3px 9px; cursor:pointer; font-size:12px; } #n2Panel .f button.on { background:var(--acc); color:#000; border-color:var(--acc); }
    #n2Panel .l { overflow:auto; padding:0 6px 8px; } #n2Panel .r { display:flex; gap:8px; padding:7px 6px; border-bottom:1px solid rgba(255,255,255,.06); font-size:13px; align-items:flex-start; } #n2Panel .r .t { color:#9aa3ad; font-size:11px; white-space:nowrap; min-width:74px; } #n2Panel .r .x { flex:1; }
    #n2Panel .r button { background:var(--acc); color:#000; border:0; border-radius:6px; padding:2px 7px; cursor:pointer; font-size:12px; white-space:nowrap; } #n2Panel .empty { padding:16px; color:#9aa3ad; text-align:center; }`;
  document.head.appendChild(css);
  const lvlOf = (text, kind, onClick, level) => {
    if (level) return level;
    const g = GROUPS.find(x => x.re.test(text)); if (g) return 'routine';
    if (RED.test(text)) return 'red';
    if (kind === 'bad') return onClick && performance.now() - lastInput > 1500 ? 'red' : 'yellow';   // червено с действие („👁 Гледай“), което не е отговор на клик; другите червени (нямаш пари, няма кей) — 6 s, с червения ръб
    return 'yellow';
  };
  const badge = () => { if (!btn) return; let b = btn.querySelector('.n2b'); if (!unread) { b && b.remove(); return; } if (!b) { b = document.createElement('span'); b.className = 'n2b'; btn.appendChild(b); } b.textContent = unread > 99 ? '99+' : unread; };
  const add = (text, lvl, onClick) => { log.unshift({ at: o.clock ? o.clock() : '', text, lvl, onClick }); if (log.length > 100) log.length = 100; if (lvl !== 'routine') { unread++; badge(); } if (panel) draw(); };
  const show = (text, lvl, kind, onClick) => {
    const box = o.box(); if (!box || (o.modeOff && o.modeOff(lvl))) return;
    const prev = shown.get(text);
    if (prev && prev.el.isConnected) { prev.n++; let c = prev.el.querySelector('.n2n'); if (!c) { c = document.createElement('span'); c.className = 'n2n'; prev.el.appendChild(c); } c.textContent = '×' + prev.n; if (prev.timer) { clearTimeout(prev.timer); prev.timer = setTimeout(() => prev.el.remove(), 6000); } return; }
    const t = document.createElement('div'); t.className = 'toast ' + (lvl === 'red' ? 'bad n2red' : (kind || '') + (lvl === 'routine' ? ' n2rt' : ''));   /* червените — и .bad (notif.js „само важните“) */ const sp = document.createElement('span'); sp.textContent = text; t.appendChild(sp);
    if (onClick) { t.style.pointerEvents = 'auto'; t.style.cursor = 'pointer'; t.onclick = e => { if (e.target.classList.contains('n2x')) return; onClick(); t.remove(); }; }
    const rec = { el: t, n: 1, timer: null }; shown.set(text, rec);
    if (lvl === 'red') { const x = document.createElement('button'); x.className = 'n2x'; x.textContent = '✕'; x.title = 'Затвори'; x.onclick = e => { e.stopPropagation(); t.remove(); }; t.appendChild(x); t.dataset.keep = '1';
      const reds = [...box.querySelectorAll('.toast.n2red')]; while (reds.length >= 3) reds.pop().remove();   // най-много 3 червени — най-старото отпада
      if (opt.sound && o.sound) try { o.sound(); } catch { } }
    else rec.timer = setTimeout(() => t.remove(), lvl === 'routine' ? 4000 : 6000);
    box.prepend(t);
    const rest = [...box.children].filter(x => !x.classList.contains('n2red') && !x.dataset.keep); while (rest.length > 4) rest.pop().remove();
    setTimeout(() => { if (shown.get(text) === rec && !t.isConnected) shown.delete(text); }, 7000);
  };
  // нов игрален ден — обобщенията на вчерашните рутинни (по едно на вид)
  const flush = () => { for (const g of GROUPS) { const c = counts[g.k]; if (!c || !c.n || !g.sum) { if (c) counts[g.k] = { n: 0, s: 0 }; continue; } const txt = g.sum(c.n, o.fmt ? o.fmt(c.s) : String(c.s)); add(txt, 'yellow'); show(txt, 'yellow', 'good'); counts[g.k] = { n: 0, s: 0 }; } };
  setInterval(() => { const d = o.day(); if (d !== day) { flush(); day = d; } }, 1000);
  function toast(text, kind = '', onClick = null, level = null) {
    text = String(text); const lvl = lvlOf(text, kind, onClick, level);
    if (lvl === 'routine') { const g = GROUPS.find(x => x.re.test(text)) || { k: 'auto' }; const c = counts[g.k] || (counts[g.k] = { n: 0, s: 0 }); c.n++; c.s += amount(text); add(text, lvl, onClick); if (opt.routine) show(text, lvl, kind, onClick); return; }
    add(text, lvl, onClick); show(text, lvl, kind, onClick);
  }
  // панелът
  const draw = () => {
    if (!panel) return; const L = log.filter(e => filt === 'all' || e.lvl === filt), ic = { red: '🔴', yellow: '🟡', routine: '⚪' };
    panel.querySelector('.f').innerHTML = [['all', 'Всички'], ['red', '🔴 Важни'], ['yellow', '🟡 Обикновени'], ['routine', '⚪ Рутинни']].map(([k, nm]) => `<button data-f="${k}" class="${filt === k ? 'on' : ''}">${nm}</button>`).join('');
    panel.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filt = b.dataset.f; draw(); });
    const l = panel.querySelector('.l'); l.innerHTML = ''; if (!L.length) { l.innerHTML = '<div class="empty">Още няма известия.</div>'; return; }
    for (const e of L) { const r = document.createElement('div'); r.className = 'r'; const t = document.createElement('span'); t.className = 't'; t.textContent = `${ic[e.lvl]} ${e.at}`; const x = document.createElement('span'); x.className = 'x'; x.textContent = e.text; r.append(t, x);
      if (e.onClick) { const b = document.createElement('button'); b.textContent = '👁 Гледай'; b.onclick = () => { close(); e.onClick(); }; r.appendChild(b); }
      l.appendChild(r); } };
  const close = () => { if (panel) { panel.remove(); panel = null; } };
  const open = () => { if (panel) return close(); panel = document.createElement('div'); panel.id = 'n2Panel'; panel.innerHTML = `<header>🔔 Известия<span class="sp"></span><button class="btn2" data-x>✕</button></header><div class="f"></div><div class="l"></div>`;
    document.body.appendChild(panel); panel.querySelector('[data-x]').onclick = close; unread = 0; badge(); draw(); };
  const mount = () => { const top = o.top(); if (!top || document.getElementById('btnN2')) return; btn = document.createElement('button'); btn.id = 'btnN2'; btn.className = 'btn2'; btn.textContent = '🔔'; btn.title = 'Известия — последните 100'; btn.style.touchAction = 'manipulation'; btn.onclick = open;
    const ref = document.getElementById('btnSettings'); if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref); else top.appendChild(btn); badge(); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount); else mount();
  // ⚙️ редовете (game.js topSetRows)
  const rows = () => [
    { ico: () => opt.routine ? '👁' : '🙈', nm: () => `Покажи рутинните известия: ${opt.routine ? 'да' : 'не'}`, fn: () => { opt.routine = !opt.routine; put(LS_R, opt.routine); }, keep: true, on: true },
    { ico: () => opt.sound ? '🔔' : '🔕', nm: () => `Звук за важните известия: ${opt.sound ? 'да' : 'не'}`, fn: () => { opt.sound = !opt.sound; put(LS_S, opt.sound); }, keep: true, on: true },
  ];
  const note = (text, lvl = 'red', onClick = null) => add(String(text), lvl, onClick);   // само в дневника — известията със свой изглед (инцидентите: askNotice в game.js)
  return { toast, note, rows, open, mount, log, counts, flush, opt, _lvl: lvlOf };
}
