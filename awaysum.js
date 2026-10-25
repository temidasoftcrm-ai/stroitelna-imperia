// awaysum.js — 👋 „Докато те нямаше“ (флаг 'away-summary', f6): при връщане след ≥ 15 мин (между сесиите, по времето на последния запис)
// прозорец с обобщение: колко време, пасивният приход по градове, какво чака, парите преди → след; „🎬 Удвои с реклама“ (ads.js offer —
// само когато Google има реклама с награда) и „Продължи“. Не по време на урока/кино/регистрацията/диалог; не при нова игра.
//
// Играта не тече, докато браузърът е затворен (времето е в кадрите) — затова пасивният приход се НАЧИСЛЯВА, по правила:
//   • 1 реален час отсъствие = 6 игрални дни (онлайн 1 час ≈ 150 дни), най-много 8 часа → 48 дни; ефективност 50 % → до 24 дни пасивен приход;
//   • пасивен = това, което носи сам: всеки твой град „без теб“ (формулата на dayTick — филиали: 1400 + 350 × репутация + 120 × офис, чуждите ×1,8),
//     завършените градове (payFinished: дневният × дял × поддръжка), наемите, дъщерните фирми, превозите, тол таксите и дивидентите (средно за 30 дни от историята);
//     НЕ: обектите, депозитът (лихвата се трупа само в игрални дни), продажбите; разходите (заплати, поддръжка) също не текат — затова 50 %.
// Срещу часовника на компютъра (fix-econ: без вратички):
//   • дните ≤ изиграните минути от последния бонус (1 ден на минута реална игра — „банка“ в записа, расте само докато играеш, табът е видим и градът е зареден);
//     смяна на часовника напред и презареждане → банката е празна → нищо; часовник назад → отрицателно време → нищо;
//   • таван 8 ч и 50 % — независимо от часовника; бонусът е веднъж на вход (банката се изразходва).
// Записът: S.away = { t: Date.now() при всеки запис, bank: минути игра }. Парите — категория 'друго' (dailyNet/regNet я пропускат — не е редовна печалба).
//   import { createAwaySummary } from './awaysum.js';
//   const away = createAwaySummary({ S, econ, rates, firm, waiting, busy, fmt, save, ads, play })   → { arm(saved), stamp(S), demo(h, bankMin) }
export const AWAY = { MIN_MIN: 15, DAYS_PER_HOUR: 6, MAX_H: 8, EFF: 0.5, DAY_PER_PLAY_MIN: 1 };

export function createAwaySummary(d) {
  let bank = 0, armed = null, shown = false, tick = 0;
  // банката: +1 мин на всяка минута игра (видим таб, зареден град, играта не е на пауза)
  setInterval(() => { if (!document.hidden && d.play()) { if (++tick >= 12) { tick = 0; bank = Math.min(bank + 1, 24 * 60); } } }, 5000);

  // при зареждане на записа — преди първия нов запис (той сменя S.away.t)
  function arm(saved) {
    const a = saved && saved.away;
    bank = Math.max(0, Math.min(+(a && a.bank) || 0, 24 * 60));
    if (!a || !(a.t > 0)) return null;
    const ms = Date.now() - a.t;
    if (!(ms >= AWAY.MIN_MIN * 60e3)) return null;   // < 15 мин или часовникът е назад (отрицателно)
    armed = { ms, bank };
    wait(); return armed;
  }
  const stamp = S => { if (S) S.away = { t: Date.now(), bank }; };

  // прозорецът — щом играта е свободна (няма урок, кино, регистрация, диалог; и на картата — входът е там); до 10 мин, после се отказва
  function wait() { const t0 = Date.now(); const iv = setInterval(() => { if (shown || !armed) { clearInterval(iv); return; } if (Date.now() - t0 > 600e3) { clearInterval(iv); return; } if (!d.busy()) { clearInterval(iv); show(armed); } }, 1000); }

  function calc(ms, bankMin) {
    const h = ms / 3600e3, hC = Math.min(h, AWAY.MAX_H), byTime = hC * AWAY.DAYS_PER_HOUR, byPlay = bankMin * AWAY.DAY_PER_PLAY_MIN;
    const days = Math.max(0, Math.min(byTime, byPlay));
    const cities = d.rates().filter(c => c.daily > 0).sort((a, b) => b.daily - a.daily), firm = d.firm();
    const k = days * AWAY.EFF, rows = cities.map(c => ({ ...c, got: Math.round(c.daily * k) })), firmGot = Math.round(firm * k);
    const total = rows.reduce((a, c) => a + c.got, 0) + firmGot;
    return { h, hC, days, byPlay, rows, firm, firmGot, total, limitedByPlay: byPlay < byTime };
  }
  const dur = h => { const m = Math.round(h * 60); return m < 60 ? `${m} мин` : m < 48 * 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ' ' + (m % 60) + ' мин' : ''}` : `${Math.round(m / 1440)} дни`; };

  function show(a, demo = false) {
    if (shown && !demo) return; shown = true; armed = null;
    const S = d.S(), econ = d.econ(); if (!S || !econ) return;
    const r = calc(a.ms, a.bank), f = d.fmt, m0 = Math.round(econ.money);
    if (r.total > 0) { econ.earn(r.total, 'друго', `👋 Докато те нямаше: ${dur(r.hC)} (${Math.round(r.days)} игрални дни × 50%)`); bank = Math.max(0, bank - Math.ceil(r.days / AWAY.DAY_PER_PLAY_MIN - 0.05)); d.save(); }
    const W = d.waiting() || [];
    const top = r.rows.slice(0, 8), rest = r.rows.slice(8), restSum = rest.reduce((s, c) => s + c.got, 0);
    const el = document.createElement('div'); el.id = 'awayDlg';
    el.style.cssText = 'position:fixed;inset:0;z-index:30;background:rgba(8,12,20,.62);display:flex;align-items:center;justify-content:center;padding:16px';
    el.innerHTML = `<div style="width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:linear-gradient(180deg,#1f2a3c,#141b27);border:2px solid #ffb300;border-radius:14px;padding:16px 18px;color:#e8edf5;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)">
      <div style="font-size:19px;font-weight:800;margin-bottom:4px">👋 Докато те нямаше</div>
      <div style="color:#aab6c8;margin-bottom:10px">Не беше в играта <b style="color:#fff">${dur(r.h)}</b>${r.h > AWAY.MAX_H + 0.05 ? ` (броят се до ${AWAY.MAX_H} ч)` : ''}. Градовете работиха сами — без строежи и без разходи.</div>
      ${r.total > 0 ? `<div style="display:grid;grid-template-columns:1fr auto;gap:3px 12px;margin-bottom:8px">
        ${top.map(c => `<span>${c.ico || '🏙️'} ${c.nm}${c.fin ? ' 🏁' : ''}</span><b style="color:#7ee081">+${f(c.got)} €</b>`).join('')}
        ${rest.length ? `<span>🏙️ още ${rest.length} ${rest.length === 1 ? 'град' : 'града'}</span><b style="color:#7ee081">+${f(restSum)} €</b>` : ''}
        ${r.firmGot > 0 ? `<span>🏢 Имоти, дъщерни фирми, превози</span><b style="color:#7ee081">+${f(r.firmGot)} €</b>` : ''}
        <span style="border-top:1px solid #33415a;padding-top:4px;font-weight:700">Общо</span><b style="border-top:1px solid #33415a;padding-top:4px;color:#ffd54a">+${f(r.total)} €</b></div>
      <div style="color:#8b96a8;font-size:12px;margin-bottom:8px">${Math.round(r.days)} игрални дни пасивен приход × 50%${r.limitedByPlay ? ' · бонусът расте с времето, което играеш (1 ден на минута игра)' : ''}</div>
      <div style="margin-bottom:8px">💰 ${f(m0)} € → <b id="awayMoney">${f(m0 + r.total)} €</b></div>`
      : `<div style="margin-bottom:8px;color:#aab6c8">${r.byPlay < 1 ? 'Бонусът за отсъствие се трупа, докато играеш (1 игрален ден на минута игра) — следващия път ще има.' : 'Градовете ти още не носят пасивен приход.'}</div>`}
      ${W.length ? `<div style="margin:6px 0 4px;font-weight:700">📋 Чака те</div><ul style="margin:0 0 8px 18px;padding:0">${W.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      <div id="awayBtns" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:10px"><button class="btn2" id="awayOk" style="font-weight:700">Продължи</button></div></div>`;
    document.body.appendChild(el);
    let offer = null;
    const close = () => { el.remove(); if (offer && offer.release) offer.release(); };
    el.querySelector('#awayOk').onclick = close;
    if (r.total > 0 && d.ads && d.ads.offer) d.ads.offer('away', () => {   // гледана докрай → още толкова
      d.econ().earn(r.total, 'друго', '🎬 Удвоено с реклама: докато те нямаше'); d.save(); d.toast?.(`🎬 Благодарим! Още +${f(r.total)} €`, 'good');
    }).then(o => { offer = o; if (!o || !document.body.contains(el)) { if (o && o.release) o.release(); return; }
      const b = document.createElement('button'); b.className = 'btn2'; b.id = 'awayAd'; b.textContent = `🎬 Удвои с реклама (+${f(r.total)} €)`;
      b.onclick = () => { const s = o.show; offer = null; el.remove(); s(); };
      el.querySelector('#awayBtns').prepend(b); }).catch(() => { });
    return r;
  }

  // Лабораторията: отсъствие h часа с банка bankMin минути игра (без чакане на 15-те минути)
  const demo = (h = 9, bankMin = 60) => show({ ms: h * 3600e3, bank: bankMin }, true);
  return { arm, stamp, demo, calc, bank: () => bank };
}
