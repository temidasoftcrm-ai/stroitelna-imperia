// holocard.js — 📜 holo-history (потребителят, 01.11: „да добавим история отстрани на изненадите — за Титаник кратка история,
// а за останалите да излиза като холограма“). Панел отстрани на екрана: при Титаник — „стара хартия“ (сепия, като ретроспекцията),
// при другите изненади — синьо-зелена холограма (сканиращи линии, трептене, светещ ръб). Текстът се „изписва“ ред по ред.
// showHolo(key) — по ключ от HOLO; затваря се сам след ~16 s или с ✕. Само един наведнъж.
const HOLO = {
  titanic: { paper: true, ico: '🚢', t: 'Титаник · 1912', l: [
    'Най-големият кораб на своето време: 269 м, 46 000 тона, наричан „непотопяемия“.',
    'Тръгва от Саутхемптън за Ню Йорк на 10 април 1912 г. с ~2 224 души на борда.',
    'В 23:40 на 14 април удря айсберг; пет отсека се наводняват.',
    'Спасителните лодки стигат за около половината пътници.',
    'В 2:20 на 15 април корабът се разцепва и потъва — загиват над 1 500 души.',
    'Останките са открити през 1985 г. на 3 800 м дълбочина: двете половини лежат на 600 м една от друга.'] },
  nessie: { ico: '🐉', t: 'Лох Нес · Шотландия', l: [
    'Езерото Нес е дълго 37 км и дълбоко до 230 м — повече вода от всички езера в Англия и Уелс взети заедно.',
    'Първото писмено сведение е от VI век: св. Колумба прогонил „звяр“ от река Нес.',
    'Легендата избухва през 1933 г., когато по брега е прокаран нов път.',
    'Най-известната снимка („на хирурга“, 1934) се оказва фалшификат — играчка-подводница с глава.',
    'ДНК-изследване на водата през 2018 г. открива много змиорки… но не и дракон.'] },
  kongo: { ico: '🦍', t: 'Емпайър Стейт Билдинг', l: [
    'Построен за 410 дни (1930–1931) — по 4 етажа и половина на седмица.',
    '443 м с антената; 40 години е най-високата сграда в света.',
    'Мачтата на върха е проектирана като кей за дирижабли — нито един не акостира.',
    'Гигантска горила на върха му — от 1933 г. е една от най-известните сцени в киното.',
    'Днес нощем осветлението на върха сменя цветовете си за празниците.'] },
  ufo: { ico: '🛸', t: 'Зона 51 · Невада', l: [
    'Военна база на ~130 км северно от Лас Вегас, официално призната едва през 2013 г.',
    'Там са изпитвани тайните самолети U-2, A-12 и F-117 „Стелт“.',
    'Странните светлини в небето често са били именно те — много над височината на пътническите полети.',
    'Шосе 375 до нея носи името „Извънземната магистрала“.',
    'Легендата за НЛО се ражда през 1947 г. в Розуел, Ню Мексико.'] },
  ghost: { ico: '👻', t: 'Пожарната на Трайбека', l: [
    'Hook & Ladder 8 на ул. Норт Мур в Манхатън е построена през 1903 г.',
    'И днес е действаща пожарна команда на Ню Йорк.',
    'Сградата в стил бозар става световноизвестна от комедия за ловци на духове (1984).',
    'Туристи от цял свят се снимат пред червената ѝ фасада.',
    'Нюйоркската пожарна (FDNY) е основана през 1865 г. и днес има над 200 команди.'] },
};
let el = null, timer = 0, typing = 0;
function css() {
  if (document.getElementById('holoCss')) return; const s = document.createElement('style'); s.id = 'holoCss';
  s.textContent = `#holo{position:fixed;left:14px;top:84px;width:min(340px,calc(100vw - 28px));z-index:400;padding:14px 16px 12px;border-radius:12px;font:13px/1.45 system-ui,sans-serif;pointer-events:auto;opacity:0;transform:translateX(-14px) scale(.98);transition:opacity .45s,transform .45s}
#holo.on{opacity:1;transform:none}
#holo.h{color:#c9fbff;background:linear-gradient(180deg,rgba(0,190,230,.16),rgba(0,90,140,.22));border:1px solid rgba(110,240,255,.75);box-shadow:0 0 18px rgba(0,220,255,.45),inset 0 0 22px rgba(0,200,255,.18);text-shadow:0 0 6px rgba(80,230,255,.8);backdrop-filter:blur(2px);animation:holoF 3.2s infinite}
#holo.h::before{content:"";position:absolute;inset:0;border-radius:12px;pointer-events:none;background:repeating-linear-gradient(180deg,rgba(150,250,255,.09) 0 1px,transparent 1px 3px);animation:holoS 6s linear infinite}
#holo.h::after{content:"";position:absolute;left:0;right:0;height:26%;top:-30%;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(160,250,255,.14),transparent);animation:holoB 3.8s linear infinite}
#holo.p{color:#3b2a14;background:#e9dcc0 radial-gradient(ellipse at 50% 40%,#f3e8cf 40%,#d9c49c 100%);border:1px solid #9b8155;box-shadow:0 6px 22px rgba(0,0,0,.5);font-family:Georgia,'Times New Roman',serif}
#holo b.t{display:block;font-size:15px;margin-bottom:6px;letter-spacing:.3px}
#holo.h b.t{color:#e8feff}
#holo ul{margin:0;padding-left:16px}#holo li{margin:3px 0;opacity:0;transition:opacity .35s}#holo li.v{opacity:1}
#holo .x{position:absolute;top:6px;right:9px;cursor:pointer;opacity:.7;font-size:14px}
@keyframes holoF{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.72}49%{opacity:1}83%{opacity:.88}84%{opacity:1}}
@keyframes holoS{to{background-position:0 30px}}
@keyframes holoB{to{top:110%}}`;
  document.head.appendChild(s);
}
export function hideHolo() { if (!el) return; const e = el; el = null; clearTimeout(timer); clearInterval(typing); e.classList.remove('on'); setTimeout(() => e.remove(), 480); }
export function showHolo(key, dur = 16) {
  const H = HOLO[key]; if (!H || typeof document === 'undefined') return false; css(); hideHolo();
  const d = document.createElement('div'); d.id = 'holo'; d.className = H.paper ? 'p' : 'h';
  d.innerHTML = `<span class="x" title="Затвори">✕</span><b class="t">${H.ico} ${H.t}</b><ul>${H.l.map(x => `<li>${x}</li>`).join('')}</ul>`;
  d.querySelector('.x').onclick = e => { e.stopPropagation(); hideHolo(); };
  document.body.appendChild(d); el = d; requestAnimationFrame(() => d.classList.add('on'));
  const li = [...d.querySelectorAll('li')]; let i = 0; typing = setInterval(() => { if (i < li.length) li[i++].classList.add('v'); else clearInterval(typing); }, 900);
  timer = setTimeout(hideHolo, dur * 1000); return true;
}
// следи изненадите (без да се пипат модулите им): при прехода „неактивна → активна“ — картата; get() → { nessie, kongo, ufo, ghost } булеви
export function holoWatch(get) { const prev = {}; return () => { const s = get(); for (const k in s) { if (s[k] && !prev[k]) showHolo(k); prev[k] = !!s[k]; } }; }
