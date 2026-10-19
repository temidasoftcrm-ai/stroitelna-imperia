// dirshow.js — 👔 екранът при назначаване на директор: тъмен фон, снимката на директора изплува, отдолу „Назначихте … за директор на …“.
// Снимките: assets/ui/directors/<модел>.webp (моделите — както в directors3d.js DIR_MODEL). Клик, Esc или 6 s — затваря.
const css = `
#dirShow { position:fixed; inset:0; z-index:9792; background:radial-gradient(ellipse at 50% 40%, #1a2233 0%, #05070b 70%); display:flex; flex-direction:column; align-items:center; justify-content:center; opacity:0; transition:opacity .5s; padding:16px; cursor:pointer; }
#dirShow.on { opacity:1; }
#dirShow .ph { position:relative; height:min(58vh, 520px); aspect-ratio:4/5; display:flex; align-items:flex-end; justify-content:center; }
#dirShow .ph::before { content:''; position:absolute; inset:8% 6% 0; background:radial-gradient(circle at 50% 35%, rgba(255,213,74,.28), transparent 65%); filter:blur(8px); }
#dirShow img { position:relative; max-height:100%; max-width:100%; object-fit:contain; transform:translateY(24px) scale(.94); opacity:0; transition:transform 1.1s cubic-bezier(.2,1,.3,1), opacity .9s; filter:drop-shadow(0 18px 30px rgba(0,0,0,.6)); }
#dirShow.on img { transform:none; opacity:1; }
#dirShow .line { width:min(560px, 80vw); height:2px; margin:10px 0 14px; background:linear-gradient(90deg, transparent, #d9b45e, transparent); transform:scaleX(0); transition:transform .9s .5s; }
#dirShow.on .line { transform:scaleX(1); }
#dirShow .t { color:#fff; font:800 clamp(20px, 3.6vmin, 34px)/1.25 system-ui, sans-serif; text-align:center; max-width:min(820px, 92vw); opacity:0; transform:translateY(10px); transition:all .7s .7s; text-shadow:0 2px 12px #000; }
#dirShow .t b { color:#ffd54a; }
#dirShow .s { margin-top:8px; color:#c8d0dc; font:500 clamp(13px, 2vmin, 17px)/1.5 system-ui, sans-serif; text-align:center; max-width:min(680px, 92vw); opacity:0; transition:opacity .7s 1.1s; }
#dirShow.on .t { opacity:1; transform:none; } #dirShow.on .s { opacity:1; }
#dirShow .hint { position:absolute; bottom:18px; color:#7d8796; font:500 12px system-ui, sans-serif; }
`;
// o: { model: 'ivaylo', name: 'Ивайло Петров', company: 'Империал Констръкшън', text?: 'какво поема', sound? }
export function showDirector(o) {
  document.getElementById('dirShow')?.remove();
  if (!document.getElementById('dirShowCss')) { const s = document.createElement('style'); s.id = 'dirShowCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'dirShow';
  el.innerHTML = `<div class="ph"><img alt=""></div><div class="line"></div><div class="t"></div><div class="s"></div><div class="hint">клик — продължи</div>`;
  const img = el.querySelector('img'); img.src = `assets/ui/directors/${o.model}.webp`; img.onerror = () => img.remove();
  const t = el.querySelector('.t'); t.append('Назначихте ', Object.assign(document.createElement('b'), { textContent: o.name }), ` за директор на ${o.company}`);
  el.querySelector('.s').textContent = o.text || '';
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  o.sound && o.sound('levelup');
  let shut = false;
  const close = () => { if (shut) return; shut = true; removeEventListener('keydown', key); el.classList.remove('on'); setTimeout(() => el.remove(), 500); };
  const key = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') close(); };
  addEventListener('keydown', key); el.onclick = close; setTimeout(close, 6500);
  return { close };
}
