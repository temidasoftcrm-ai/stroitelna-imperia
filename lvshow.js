// lvshow.js — ново ниво на фирмата: черен екран, в средата картинката на нивото (assets/ui/levels/lvN.webp) за ~5 s със звук.
// Клик или Esc — затваря по-рано. Няколко нива наведнъж — една след друга. Зад feature('lv-pics') (вика го devlevel.js).
export const LV_PICS = new Set([...Array.from({ length: 20 }, (_, i) => i + 1), 21]);   // картинки за нивата 1–20 и Империал Сити (21–25 — добавят се, когато дойде картинката)
// заглавията на нивата (от потребителя) — над текста с отключванията
export const LV_TITLE = { 1: 'Малко начало', 2: 'Свързваме България', 3: 'Първият държавен договор', 4: 'От чертежа до големия строеж', 5: 'Към Балканите!',
  6: 'Първото пристанище', 7: 'Търговия и курорти', 8: 'Европа свети пред теб', 9: 'На земята и в небето', 10: 'Добре дошъл в Африка!',
  11: 'Световен транспортен център', 12: 'Манхатън', 13: 'Великите железници', 14: 'Добре дошъл в Южна Америка!', 15: 'Ерата на холдинга',
  16: 'Петролна империя', 17: 'Банка и борсов дебют', 18: 'Австралия — енергията на бъдещето', 19: 'Твоят град и световните мегапроекти', 20: 'Световна империя', 21: 'Империал Сити', 22: 'Град в баланс', 23: 'Услуги за всички', 24: 'Устойчив град', 25: 'Президентска кампания' };
const css = `
#lvShow { position:fixed; inset:0; z-index:9800; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; transition:opacity .45s; cursor:pointer; }
#lvShow.on { opacity:1; }
#lvShow img { width:min(78vmin, 720px); height:auto; transform:scale(.6) rotate(-4deg); opacity:0; filter:drop-shadow(0 0 0 rgba(255,200,60,0));
  transition:transform .9s cubic-bezier(.2,1.5,.4,1), opacity .5s, filter 1.4s; }
#lvShow.on img { transform:scale(1) rotate(0); opacity:1; filter:drop-shadow(0 0 40px rgba(255,200,60,.55)); }
#lvShow .rays { position:absolute; width:150vmin; height:150vmin; background:repeating-conic-gradient(rgba(255,210,90,.10) 0 10deg, transparent 10deg 20deg);
  border-radius:50%; mask:radial-gradient(circle, #000 25%, transparent 65%); -webkit-mask:radial-gradient(circle, #000 25%, transparent 65%); animation:lvSpin 24s linear infinite; opacity:0; transition:opacity 1.2s .3s; }
#lvShow.on .rays { opacity:1; }
#lvShow .tx { position:relative; margin-top:14px; color:#ffd54a; font:700 clamp(15px, 2.4vmin, 22px) system-ui, sans-serif; text-align:center; max-width:min(90vw, 760px); opacity:0; transition:opacity .6s .9s; text-shadow:0 2px 8px #000; }
#lvShow.on .tx { opacity:1; }
#lvShow .tt { position:relative; margin-top:6px; color:#fff; font:800 clamp(20px, 3.6vmin, 34px) system-ui, sans-serif; text-align:center; opacity:0; transition:opacity .6s .6s; text-shadow:0 2px 10px #000; }
#lvShow.on .tt { opacity:1; }
@keyframes lvSpin { to { transform:rotate(360deg); } }
`;
const queue = [];
let busy = false;
export function showLevel(lv, text = '', done) {
  queue.push([lv, text, done]); if (!busy) next();
}
function next() {
  const it = queue.shift(); if (!it) { busy = false; return; }
  busy = true; const [lv, text, done] = it;
  if (!document.getElementById('lvShowCss')) { const s = document.createElement('style'); s.id = 'lvShowCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'lvShow';
  el.innerHTML = `<div class="rays"></div><img alt="Ниво ${lv}" src="assets/ui/levels/lv${lv}.webp"><div class="tt"></div><div class="tx"></div>`;
  el.querySelector('.tt').textContent = LV_TITLE[lv] ? `„${LV_TITLE[lv]}“` : ''; el.querySelector('.tx').textContent = text;
  document.body.appendChild(el);
  try { const a = new Audio('assets/sfx/level-up.mp3'); a.volume = 0.8; a.play().catch(() => { }); } catch { }
  const img = el.querySelector('img');
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  if (img.complete) go(); else { img.onload = go; img.onerror = go; }
  let shut = false;
  const close = () => { if (shut) return; shut = true; removeEventListener('keydown', key); el.classList.remove('on'); setTimeout(() => { el.remove(); done && done(); next(); }, 450); };
  const key = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close(); };
  el.onclick = close; addEventListener('keydown', key);
  setTimeout(close, 5200);
}
