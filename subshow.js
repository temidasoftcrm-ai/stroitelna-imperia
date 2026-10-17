// subshow.js — дъщерно дружество: екран с логото (assets/ui/subs/<k>.webp) на черен фон.
// ask — преди основаването: какво прави, стартов пакет, цена и бутони „Основи · X €“ / „По-късно“;
// done — след основаването: „… е основана!“ (5 s, клик/Esc — по-рано). Зад feature('sub-screen') (вика се от game.js и group.js).
const css = `
#subShow { position:fixed; inset:0; z-index:9790; background:rgba(0,0,0,.92); display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; transition:opacity .4s; padding:16px; }
#subShow.on { opacity:1; }
#subShow img { width:min(46vmin, 380px); height:auto; transform:scale(.6); opacity:0; transition:transform .8s cubic-bezier(.2,1.5,.4,1), opacity .5s; filter:drop-shadow(0 0 34px rgba(255,200,60,.35)); }
#subShow.on img { transform:scale(1); opacity:1; }
#subShow .nm { margin-top:14px; color:#fff; font:800 clamp(22px, 4vmin, 38px) system-ui, sans-serif; text-align:center; text-shadow:0 2px 10px #000; }
#subShow .wh { margin-top:4px; color:#ffd54a; font:600 clamp(14px, 2.2vmin, 18px) system-ui, sans-serif; text-align:center; }
#subShow .tx { margin-top:12px; max-width:min(92vw, 620px); color:#d6dbe3; font:500 clamp(13px, 2vmin, 16px)/1.5 system-ui, sans-serif; text-align:center; }
#subShow .tx b { color:#fff; }
#subShow .row { display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; justify-content:center; }
#subShow button { font:700 16px system-ui, sans-serif; border:0; border-radius:11px; padding:12px 22px; cursor:pointer; }
#subShow .go { background:#f5b942; color:#111; } #subShow .go:disabled { opacity:.5; cursor:default; }
#subShow .no { background:rgba(255,255,255,.12); color:#e6e9ee; }
`;
// o: { k, name, what, text (HTML), cost, canPay, mode: 'ask'|'done', onFound, sound }
export function showSub(o) {
  document.getElementById('subShow')?.remove();
  if (!document.getElementById('subShowCss')) { const s = document.createElement('style'); s.id = 'subShowCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'subShow';
  el.innerHTML = `<img alt="" src="assets/ui/subs/${o.k}.webp"><div class="nm"></div><div class="wh"></div><div class="tx"></div><div class="row"></div>`;
  el.querySelector('.nm').textContent = o.mode === 'done' ? `${o.name} е основана!` : o.name;
  el.querySelector('.wh').textContent = o.what || '';
  el.querySelector('.tx').innerHTML = o.text || '';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  let shut = false;
  const close = () => { if (shut) return; shut = true; removeEventListener('keydown', key); el.classList.remove('on'); setTimeout(() => el.remove(), 400); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  const row = el.querySelector('.row');
  if (o.mode === 'ask') {
    const go = document.createElement('button'); go.className = 'go'; go.textContent = `🏛️ Основи · ${o.cost}`; go.disabled = !o.canPay;
    const no = document.createElement('button'); no.className = 'no'; no.textContent = 'По-късно';
    go.onclick = () => { close(); o.onFound && o.onFound(); }; no.onclick = close;
    row.append(go, no);
    if (!o.canPay) { const m = document.createElement('div'); m.className = 'tx'; m.style.color = '#ff8a80'; m.textContent = `Нямаш достатъчно пари (${o.cost}).`; el.appendChild(m); }
  } else {
    try { const a = new Audio('assets/sfx/level-up.mp3'); a.volume = 0.8; a.play().catch(() => { }); } catch { }
    el.onclick = close; setTimeout(close, 5500);
  }
}
