// smallscreen.js — 💻 small-screen (собственикът: на малък лаптоп не се виждат нещата): горната лента на един ред (hub.js, body.hub1)
// при 1366 px и по-тясно излизаше вдясно извън екрана — скоростите ▶▶▶, „Глобус“, ⚙️, ⛶ и известията не се виждаха.
// Тук: щом лентата прелива, първо се сгъстява (ss1 — по-малки отстояния и шрифт, без логото); ако пак прелива — минава на два реда (ss2),
// а --topH става истинската ѝ височина, така че десният панел, картата и големите прозорци слизат под нея. Проверка при преоразмеряване,
// влизане/излизане от цял екран и на 2 s (бутоните се появяват с напредъка в играта).
const css = `
body.ss1:not(.mob) #top { column-gap:4px; padding-left:8px; padding-right:8px; }
body.ss1:not(.mob) #top .btn2, body.ss1:not(.mob) #top .speed button { padding:4px 6px; font-size:12px; }
body.ss1:not(.mob) #top > .logo { display:none !important; }
body.ssOn:not(.mob):has(#bigWin:not(.hidden)) #toasts { top:auto !important; bottom:14px; max-width:320px; }   /* голям прозорец — известията долу вляво, не върху заглавието и разделите му */
body.ssOn:not(.mob) #modal .actions { position:sticky; bottom:-22px; background:#18202c; padding:8px 0 6px; margin-bottom:-6px; z-index:1; }   /* дълъг диалог — бутоните винаги се виждат */
body.ss2:not(.mob) #top { flex-wrap:wrap !important; height:auto !important; min-height:52px; align-content:center; row-gap:4px; padding-top:4px; padding-bottom:4px; }
`;
export function initSmallScreen() {
  if (typeof document === 'undefined') return;
  const st = document.createElement('style'); st.id = 'ssCss'; st.textContent = css; document.head.appendChild(st);
  const B = document.body; let busy = false; B.classList.add('ssOn');
  const over = t => t.scrollWidth > t.clientWidth + 1 || [...t.children].some(e => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1);
  function fit() {
    const t = document.getElementById('top'); if (!t || busy || B.classList.contains('mob')) return; busy = true;
    try {
      B.classList.remove('ss1', 'ss2'); B.style.removeProperty('--topH');
      if (over(t)) { B.classList.add('ss1'); if (over(t)) { B.classList.add('ss2'); B.style.setProperty('--topH', Math.ceil(t.getBoundingClientRect().height) + 'px'); } }
    } finally { busy = false; }
  }
  let sig = '';   // ширината + видимите бутони и текстът им — смята се наново само при промяна (без премигване на всеки 2 s)
  const tick = () => { const t = document.getElementById('top'); if (!t) return; const s = innerWidth + ':' + [...t.children].filter(e => e.offsetParent).map(e => e.id + (e.textContent || '').length).join(','); if (s !== sig) { sig = s; fit(); } };
  addEventListener('resize', () => { sig = ''; tick(); }); document.addEventListener('fullscreenchange', () => setTimeout(() => { sig = ''; tick(); }, 60));
  setInterval(tick, 2000); setTimeout(tick, 300);
  window.__ssFit = () => { fit(); return { ss1: B.classList.contains('ss1'), ss2: B.classList.contains('ss2'), topH: B.style.getPropertyValue('--topH') || null }; };
}
