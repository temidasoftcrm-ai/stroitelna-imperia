// intro.js — „Добре дошли в Строителна империя“: кратко интро от 3 екрана при нова игра (пропуска се с „Пропусни“ или Esc).
// showIntro({ brand, city, money, sound(name), onDone }) — onDone се вика при затваряне.
const css = `
#intro { position:fixed; inset:0; z-index:9500; display:flex; align-items:flex-end; padding-bottom:4vh; justify-content:center; background:#05080f; opacity:0; transition:opacity .6s; font-family:system-ui, sans-serif; }
#intro.on { opacity:1; }
#intro .bg { position:absolute; inset:-20px; background:url(assets/ui/splash.webp) center top/cover; /* заглавието на картинката горе; кутията — върху лентата „Зареждане…“ долу */ filter:brightness(.42) saturate(1.1); transform:scale(1.06); transition:transform 14s linear; }
#intro.on .bg { transform:scale(1.0); }
#intro .box { position:relative; max-width:min(640px, calc(100vw - 32px)); padding:26px 28px; border-radius:18px; background:rgba(8,12,20,.72); border:1px solid rgba(255,255,255,.12); box-shadow:0 20px 60px rgba(0,0,0,.5); color:#eef2f7; text-align:center; }
#intro .ico { font-size:52px; line-height:1; }
#intro h1 { margin:12px 0 8px; font-size:clamp(22px, 4.2vw, 32px); color:#f5b942; letter-spacing:.3px; }
#intro p { margin:0; font-size:clamp(15px, 2.6vw, 18px); line-height:1.55; color:#c9d2de; }
#intro .slide { animation:introIn .55s ease both; }
@keyframes introIn { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
#intro .dots { display:flex; gap:7px; justify-content:center; margin:18px 0 14px; }
#intro .dots i { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.25); }
#intro .dots i.on { background:#f5b942; }
#intro .row { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
#intro button { font:600 16px system-ui, sans-serif; border:0; border-radius:11px; padding:11px 20px; cursor:pointer; }
#intro .go { background:#f5b942; color:#111; }
#intro .skip { background:rgba(255,255,255,.1); color:#dfe5ee; }
`;
export function showIntro({ brand = 'Твоята фирма', city = 'София', money = '20 000', sound, onDone } = {}) {
  if (document.getElementById('intro')) return;
  if (!document.getElementById('introCss')) { const st = document.createElement('style'); st.id = 'introCss'; st.textContent = css; document.head.appendChild(st); }
  const slides = [
    { ico: '🏗️', h: 'Добре дошли в „Строителна империя“!', p: `Започваш в <b>${city}</b> с <b>${money} €</b>, бригада работници, багер и самосвал. Всяка империя започва с първата къща.` },
    { ico: '🌍', h: 'Строй, расти, завладявай', p: 'Приемай поръчки и строй къщи, магазини и небостъргачи. После — жп линии, магистрали, пристанища и летища: от България през Балканите и Европа до целия свят.' },
    { ico: '👑', h: `${brand} Констръкшън е основана!`, p: 'Целта: от малка строителна фирма до световна империя — ниво 20. Първите поръчки вече те чакат на таблото вдясно.' },
  ];
  let k = 0;
  const el = document.createElement('div'); el.id = 'intro';
  el.innerHTML = `<div class="bg"></div><div class="box"><div id="introSlide"></div><div class="dots">${slides.map(() => '<i></i>').join('')}</div>
    <div class="row"><button class="skip" id="introSkip">Пропусни</button><button class="go" id="introNext"></button></div></div>`;
  document.body.appendChild(el);
  const show = () => {
    const s = slides[k];
    el.querySelector('#introSlide').innerHTML = `<div class="slide"><div class="ico">${s.ico}</div><h1>${s.h}</h1><p>${s.p}</p></div>`;
    el.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === k));
    el.querySelector('#introNext').textContent = k < slides.length - 1 ? 'Напред →' : '🚀 Да започваме!';
    el.querySelector('#introSkip').style.visibility = k < slides.length - 1 ? 'visible' : 'hidden';
  };
  const close = () => {
    removeEventListener('keydown', key); el.classList.remove('on');
    setTimeout(() => { el.remove(); onDone && onDone(); }, 550);
  };
  const next = () => { if (k < slides.length - 1) { k++; show(); sound && sound('click'); } else close(); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); } };
  el.querySelector('#introNext').onclick = next;
  el.querySelector('#introSkip').onclick = close;
  addEventListener('keydown', key);
  show();
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
}
