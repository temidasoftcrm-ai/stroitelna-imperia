// hub.js — „📊 Империя ▾“: бутоните от втория ред на горната лента (гараж, транспорт, курорти, „на ден“, градове, оферти, завладяване…)
// се местят в падащ панел с плочки, за да е лентата на един ред. Бутоните се преместват (не се копират) — техните onclick и живите
// надписи (+X €/ден, „Оферти 3“) си остават; кодът, който ги показва/скрива (style.display), продължава да работи.
// Късно създадените (Партньор, Онлайн, Вход — coop.js, online-btn.js, cloud.js) се хващат с MutationObserver. Зад feature('top-hub').
const IDS = ['presBtn', 'trBtn', 'garBtn', 'railBtn', 'hwBtn', 'seaBtn', 'airBtn', 'resBtn', 'finBtn', 'holdBtn', 'superBtn', 'btnCities', 'btnOffers', 'btnMines',
  'btnConquest', 'qBtn', 'bankBtn', 'btnCine', 'coopBtn', 'onlineBtn', 'cloudBtn', 'oilBtn'];   // 1. Транспорт, 2. Гараж, после останалите
// неотключените (скрити) — показват се замъглени със 🔒, за да се вижда какво предстои (ЖП/магистрали/… са в „Транспорт“ — те не)
const LOCKED_LBL = { garBtn: '🚜 Гараж', resBtn: '🏔️ Курорти', finBtn: '🏁 На ден', holdBtn: '🏛️ Холдинг', superBtn: '🏗️ Супер поръчки', btnMines: '⛏️ Добив', oilBtn: '🛢️ Петрол',
  qBtn: '🎯 Куести', bankBtn: '🏦 Банка', btnConquest: '🏆 Завладяване', btnCities: '🏙️ Градове', btnOffers: '📜 Оферти' };
const css = `
/* лентата на един ред (компютър): без втория ред на index.html (#top::after, order:2); телефонът (body.mob) си остава както е */
body.hub1:not(.mob) { --topH:56px; }
body.hub1:not(.mob) #top { flex-wrap:nowrap; }
body.hub1:not(.mob) #top > * { order:0; }
body.hub1:not(.mob) #top::after { display:none; }
@media (max-width:1500px) { body.hub1:not(.mob) #top > .stars, body.hub1:not(.mob) #top > #wx { display:none !important; } }
@media (max-width:1250px) { body.hub1:not(.mob) #top > .logo { display:none; } }
#btnHub { font-weight:700; }
#btnHub.on { background:var(--acc); color:#111; }
#btnHub.new { box-shadow:0 0 0 2px #ffd54a, 0 0 14px rgba(255,213,74,.7); animation:hubPulse 1.4s ease-in-out infinite; }
@keyframes hubPulse { 50% { box-shadow:0 0 0 2px #ffd54a, 0 0 4px rgba(255,213,74,.2); } }
#hub .grid > button.new { box-shadow:0 0 0 2px #ffd54a inset; }
#hub { position:fixed; z-index:40; top:calc(var(--topH, 52px) + 6px); width:min(640px, calc(100vw - 24px)); max-height:calc(100vh - 90px); overflow:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,.5); padding:10px; display:none; }
#hub.on { display:block; }
#hub .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(165px, 1fr)); gap:6px; }
#hub .grid > button { width:100%; text-align:left; white-space:normal; padding:9px 10px; font-size:14px; line-height:1.25; }
#hub .grid > button[style*="display: none"] { display:none !important; }
#hub .grid > .lockT { padding:9px 10px; font-size:14px; border-radius:10px; border:1px solid var(--line); filter:blur(2.2px); opacity:.45; pointer-events:none; user-select:none; }   /* „80% блур“ — още заключено */
#hub .prog { margin-top:10px; padding-top:8px; border-top:1px solid var(--line); display:grid; gap:6px; }
#hub .prog .pr { display:grid; grid-template-columns:118px 1fr 44px; gap:8px; align-items:center; font-size:13px; }
#hub .prog .bar { height:8px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; }
#hub .prog .bar i { display:block; height:100%; background:linear-gradient(90deg, #2e9d5b, #7dffa8); }
#hub .prog .cs { grid-column:2 / 4; font-size:11px; color:var(--mut); margin-top:-3px; }
#hub h4 { margin:2px 4px 8px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--mut); }
`;
// opts.extra() — HTML под плочките (прогресът на мрежите — game.js), обновява се при всяко отваряне
export function mountHub(top, after, opts = {}) {
  if (document.getElementById('btnHub')) return;
  if (document.body.classList.contains('mob')) return;   // телефонът има свой плъзгащ се ред (mobile.js)
  // много модули вмъкват бутон „преди“ друг бутон от лентата (напр. $('finBtn')), който вече е в панела — тогава просто в лентата (оттам го взима take)
  const ins = top.insertBefore;
  top.insertBefore = function (n, ref) { return ins.call(top, n, ref && ref.parentNode === top ? ref : null); };
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'btnHub'; btn.className = 'btn2'; btn.textContent = '📊 Империя ▾'; btn.title = 'Гараж, транспорт, курорти, градове, оферти, завладяване…';
  (after && after.parentNode === top ? after.nextSibling : top.firstChild) ? top.insertBefore(btn, after && after.parentNode === top ? after.nextSibling : null) : top.appendChild(btn);
  const hub = document.createElement('div'); hub.id = 'hub'; hub.innerHTML = '<h4>Империята</h4><div class="grid"></div>'; document.body.appendChild(hub);
  const grid = hub.querySelector('.grid');
  const take = () => { for (const id of IDS) { const b = document.getElementById(id); if (b && b.parentNode !== grid) grid.appendChild(b); } sort(); };
  // заключените: на мястото на скрития (или още несъздаден) бутон — замъглена плочка с името и 🔒
  const locks = () => { grid.querySelectorAll('.lockT').forEach(e => e.remove());
    for (const id of IDS) { if (!LOCKED_LBL[id]) continue; const b = document.getElementById(id); if (b && b.style.display !== 'none' && b.textContent.trim()) continue;
      const t = document.createElement('div'); t.className = 'lockT'; t.textContent = LOCKED_LBL[id] + ' 🔒'; if (b && b.parentNode === grid) b.after(t); else grid.appendChild(t); } };
  const sort = () => { for (const id of IDS) { const b = document.getElementById(id); if (b && b.parentNode === grid) grid.appendChild(b); } };   // по реда в IDS
  const place = () => { const r = btn.getBoundingClientRect(); hub.style.left = Math.max(12, Math.min(r.left, innerWidth - hub.offsetWidth - 12)) + 'px'; };
  const extra = document.createElement('div'); hub.appendChild(extra);
  // ново вътре: плочка с жълто число („Оферти 2“, „Куести 1“…), което още не си видял → бутонът свети, докато не отвориш панела
  let seen = '';
  const badges = () => [...grid.querySelectorAll(':scope > button')].filter(b => b.style.display !== 'none' && b.querySelector('b[style*="ffd54a"]'));
  const sigOf = L => L.map(b => b.id + ':' + b.querySelector('b[style*="ffd54a"]').textContent.trim()).join('|');
  const mark = () => { if (hub.classList.contains('on')) return; const L = badges(), isNew = !!L.length && sigOf(L) !== seen; btn.classList.toggle('new', isNew); };
  setInterval(mark, 2000);
  const open = v => { if (v) { const L = badges(), sig = sigOf(L); grid.querySelectorAll(':scope > button.new').forEach(b => b.classList.remove('new')); if (sig !== seen) L.forEach(b => b.classList.add('new')); seen = sig; btn.classList.remove('new'); } if (v && opts.extra) { try { extra.innerHTML = opts.extra() || ''; } catch { extra.innerHTML = ''; } } if (v) locks(); hub.classList.toggle('on', v); btn.classList.toggle('on', v); btn.textContent = v ? '📊 Империя ▴' : '📊 Империя ▾'; if (v) place(); };
  btn.onclick = e => { e.stopPropagation(); open(!hub.classList.contains('on')); };
  grid.addEventListener('click', () => setTimeout(() => open(false), 0));   // избор на плочка → прозорецът ѝ се отваря, панелът се затваря
  addEventListener('click', e => { if (hub.classList.contains('on') && !hub.contains(e.target) && e.target !== btn) open(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
  addEventListener('resize', () => { if (hub.classList.contains('on')) place(); });
  take(); document.body.classList.add('hub1'); dispatchEvent(new Event('resize'));   // по-ниската лента — рендерът и панелите се преоразмеряват
  new MutationObserver(take).observe(top, { childList: true });
  return { open, el: hub };
}
