// hub.js — „📊 Империя ▾“: бутоните от втория ред на горната лента (гараж, транспорт, курорти, „на ден“, градове, оферти, завладяване…)
// се местят в падащ панел с плочки, за да е лентата на един ред. Бутоните се преместват (не се копират) — техните onclick и живите
// надписи (+X €/ден, „Оферти 3“) си остават; кодът, който ги показва/скрива (style.display), продължава да работи.
// Късно създадените (Партньор, Онлайн, Вход — coop.js, online-btn.js, cloud.js) се хващат с MutationObserver. Зад feature('top-hub').
const IDS = ['garBtn', 'trBtn', 'railBtn', 'hwBtn', 'seaBtn', 'airBtn', 'resBtn', 'finBtn', 'holdBtn', 'superBtn', 'btnCities', 'btnOffers', 'btnMines',
  'btnConquest', 'qBtn', 'bankBtn', 'btnCine', 'coopBtn', 'onlineBtn', 'cloudBtn', 'oilBtn'];
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
#hub { position:fixed; z-index:40; top:calc(var(--topH, 52px) + 6px); width:min(560px, calc(100vw - 24px)); max-height:calc(100vh - 90px); overflow:auto;
  background:var(--panel); border:1px solid var(--line); border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,.5); padding:10px; display:none; }
#hub.on { display:block; }
#hub .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(165px, 1fr)); gap:6px; }
#hub .grid > button { width:100%; text-align:left; white-space:normal; padding:9px 10px; font-size:14px; line-height:1.25; }
#hub .grid > button[style*="display: none"] { display:none !important; }
#hub h4 { margin:2px 4px 8px; font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--mut); }
`;
export function mountHub(top, after) {
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
  const sort = () => { for (const id of IDS) { const b = document.getElementById(id); if (b && b.parentNode === grid) grid.appendChild(b); } };   // по реда в IDS
  const place = () => { const r = btn.getBoundingClientRect(); hub.style.left = Math.max(12, Math.min(r.left, innerWidth - hub.offsetWidth - 12)) + 'px'; };
  const open = v => { hub.classList.toggle('on', v); btn.classList.toggle('on', v); btn.textContent = v ? '📊 Империя ▴' : '📊 Империя ▾'; if (v) place(); };
  btn.onclick = e => { e.stopPropagation(); open(!hub.classList.contains('on')); };
  grid.addEventListener('click', () => setTimeout(() => open(false), 0));   // избор на плочка → прозорецът ѝ се отваря, панелът се затваря
  addEventListener('click', e => { if (hub.classList.contains('on') && !hub.contains(e.target) && e.target !== btn) open(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
  addEventListener('resize', () => { if (hub.classList.contains('on')) place(); });
  take(); document.body.classList.add('hub1'); dispatchEvent(new Event('resize'));   // по-ниската лента — рендерът и панелите се преоразмеряват
  new MutationObserver(take).observe(top, { childList: true });
  return { open, el: hub };
}
