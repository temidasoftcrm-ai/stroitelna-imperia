// direvents.js — 👔 животът на директорите (group.js го вика): настроение на всеки директор, последици от „Не“ и събития с избор.
// Настроение 0…1 (S.hold.morale[k], начално 0,8): „Не“ го сваля, време без „Не“ го вдига бавно. Ниско настроение → оплакване, после конкурент го примамва.
// „Не“ понякога е изпусната възможност: конкурентът поема проекта (известие). Събития (около веднъж на месец, при поне 2 директора):
//   ✊ стачка в дружество — холдингът губи половината от прихода му 10 дни, освен ако платиш бонус; 🎣 конкурент примамва директора — задържаш с бонус
//   или той си тръгва (дружеството е без директор, докато не назначиш нов); 📰 скандал — защитаваш (−доверие) или го отстраняваш за 30 дни (без бонус);
//   🏆 награда — „Директор на годината“ в бранша (+настроение, +доверие).
// Записът: S.hold.morale { k }, S.hold.no { k: [дни] }, S.hold.strike { k: денят до }, S.hold.away { k: денят до }, S.hold.evDay.
// deps: { S, econ, fmt, toast, save, sound, name(k), sub(k), inc(k) → приход €/ден, hired() → [k], trust(k, d) }

const EV_EVERY = 30, STRIKE_DAYS = 10, AWAY_DAYS = 30;
const css = `
#dirEv { position:fixed; inset:0; z-index:9795; background:#0009; display:flex; align-items:center; justify-content:center; }
#dirEv > div { width:min(500px, 92vw); background:#141c2b; color:#e6edf6; border:1px solid #2d4470; border-radius:14px; padding:16px 18px; box-shadow:0 10px 40px #000; font:500 14px/1.45 system-ui, sans-serif; }
#dirEv h3 { margin:0 0 8px; font:800 18px system-ui, sans-serif; }
#dirEv .m { color:#a9b6c8; margin:0 0 12px; }
#dirEv button { display:block; width:100%; text-align:left; font:700 14px system-ui, sans-serif; border:0; border-radius:10px; padding:10px 12px; margin:5px 0; cursor:pointer; background:#22324e; color:#e6edf6; }
#dirEv button.go { background:#f5b942; color:#111; }
`;
export function createDirEvents(deps) {
  const S = () => deps.S(), day = () => S().day || 0;
  const h = () => { const x = S().hold = S().hold || {}; x.morale = x.morale || {}; x.no = x.no || {}; x.strike = x.strike || {}; x.away = x.away || {}; return x; };
  const mood = k => h().morale[k] ?? 0.8;
  const setMood = (k, v) => { h().morale[k] = Math.max(0, Math.min(1, v)); };
  const first = k => (deps.name(k) || '').split(' ')[0];
  const fem = k => /[ая]$/.test(first(k));   // Мария, Надя, Елена, Вера, Десислава
  const G = k => fem(k) ? { acc: 'я', dat: 'ѝ', it: 'нея', he: 'тя', ed: 'а' } : { acc: 'го', dat: 'му', it: 'него', he: 'той', ed: '' };
  const B = n => n >= 1e9 ? `${(n / 1e9).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млрд. €` : n >= 1e6 ? `${(n / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн. €` : `${deps.fmt(Math.round(n))} €`;

  // ---- „Не“: настроението пада; три пъти за 90 дни — оплакване; понякога конкурентът поема проекта
  function onNo(k, p) {
    if (!k || !deps.name(k)) return;
    const x = h(), d = day(); x.no[k] = [...(x.no[k] || []).filter(t => t > d - 90), d];
    setMood(k, mood(k) - 0.08);
    const n = x.no[k].length;
    if (n >= 3) deps.toast(`😤 ${first(k)}: „Трети отказ за три месеца. Ако не ми вярвате, кажете го направо.“ (настроение ${Math.round(mood(k) * 100)}%)`, 'bad');
    else if (p && p.cost >= 1e7 && Math.random() < 0.3) deps.toast(`🏃 ${first(k)}: „Конкурентите поеха това, което предложих — ${String(p.text || '').split(/[.?—]/)[0].slice(0, 60)}.“ Възможността е изпусната.`, '');
    deps.save();
  }
  const onYes = k => { if (k && deps.name(k)) setMood(k, mood(k) + 0.03); };

  // ---- ефекти: стачка — без бонус и −50% от прихода; отстранен — без бонус
  const struck = k => (h().strike[k] || 0) > day(), away = k => (h().away[k] || 0) > day();
  const bonusOff = k => struck(k) || away(k);
  function dailyTick() {
    const x = h(), d = day(); let loss = 0;
    for (const k of Object.keys(x.strike)) if (struck(k)) loss += (deps.inc(k) || 0) * 0.5;
    if (loss > 0) deps.econ().spend(Math.round(loss), 'заплати', 'Стачка в дружество на холдинга');
    for (const k of deps.hired()) if (!(x.no[k] || []).some(t => t > d - 45)) setMood(k, mood(k) + 0.003);   // без откази — бавно се оправя
    for (const [k, t] of Object.entries(x.away)) if (t && t <= d) { x.away[k] = 0; deps.toast(`👔 ${first(k)} се връща на работа.`, 'good'); }
    if (document.getElementById('dirEv') || (typeof window !== 'undefined' && (window.__overlay3d || 0) > 0)) return;   // не по време на заседание
    if (d - (x.evDay || 0) < EV_EVERY || deps.hired().length < 2 || Math.random() > 0.06) return;
    x.evDay = d; fire();
  }
  // ---- събитията
  function fire() {
    const hs = deps.hired().filter(k => !away(k) && !struck(k)); if (!hs.length) return;
    const low = hs.filter(k => mood(k) < 0.45), pick = a => a[Math.floor(Math.random() * a.length)];
    const k = low.length && Math.random() < 0.6 ? pick(low) : pick(hs), g = G(k), inc = Math.max(1e5, deps.inc(k) || 0), nm = deps.name(k), sub = deps.sub(k) || k;
    const r = Math.random();
    if (low.includes(k) || r < 0.25) {   // 🎣 конкурентът примамва — по-вероятно при ниско настроение
      const c = Math.round(inc * 20 / 1e5) * 1e5;
      ask(`🎣 Конкурент примамва ${first(k)}`, `${nm} има оферта от конкурентен холдинг. ${mood(k) < 0.45 ? `Последните откази ${g.acc} изнервиха — настроението ${g.dat} е ниско.` : `Предлагат ${g.dat} повече пари.`}`, [
        [`💰 Задръж ${g.acc} — бонус ${B(c)}`, () => { if (!pay(c)) return false; setMood(k, 0.85); deps.toast(`🤝 ${first(k)} остава в ${sub}.`, 'good'); }],
        ['🗣️ Разговор без пари', () => { if (mood(k) > 0.5 && Math.random() < 0.7) { setMood(k, mood(k) + 0.1); deps.toast(`🤝 ${first(k)}: „Добре, оставам — но искам повече свобода.“`, 'good'); } else leave(k); }],
        [`👋 Пусни ${g.acc}`, () => leave(k)],
      ]);
    } else if (r < 0.5) {   // ✊ стачка
      const c = Math.round(inc * 4 / 1e5) * 1e5;
      ask(`✊ Стачка в ${sub}`, `Служителите искат по-високи заплати. ${first(k)} предлага решение. Без него холдингът губи ~${B(inc * 0.5)} на ден за ${STRIKE_DAYS} дни.`, [
        [`💶 Бонус за служителите — ${B(c)}`, () => { if (!pay(c)) return false; setMood(k, mood(k) + 0.05); deps.toast(`✅ ${sub}: стачката е прекратена.`, 'good'); }],
        ['⏳ Изчакай', () => { h().strike[k] = day() + STRIKE_DAYS; setMood(k, mood(k) - 0.05); deps.toast(`✊ ${sub}: стачка за ${STRIKE_DAYS} дни.`, 'bad'); }],
      ]);
    } else if (r < 0.75) {   // 📰 скандал
      ask(`📰 Скандал около ${first(k)}`, `Медиите пишат, че ${nm} е дал${g.ed} поръчка на фирма на свой роднина. Доказателства още няма.`, [
        [`🛡️ Застани зад ${g.it}`, () => { deps.trust && deps.trust(k, -0.05); setMood(k, mood(k) + 0.1); deps.toast(`🛡️ Холдингът защити ${first(k)} — доверието на пазара леко пада.`, ''); }],
        [`⏸️ Отстрани ${g.acc} за ${AWAY_DAYS} дни (разследване)`, () => { h().away[k] = day() + AWAY_DAYS; setMood(k, mood(k) - 0.15); deps.toast(`⏸️ ${first(k)} е отстранен${g.ed} до края на разследването — ${sub} е без бонус на директора.`, ''); }],
      ]);
    } else {   // 🏆 награда
      setMood(k, mood(k) + 0.1); deps.trust && deps.trust(k, 0.05);
      ask(`🏆 ${nm} — „Директор на годината“`, `Браншът отличи ${first(k)} за работата в ${sub}. Доверието и настроението му растат.`, [[`🎉 Поздрави ${g.acc}`, () => { }]]);
    }
    deps.sound && deps.sound('levelup'); deps.save();
  }
  function leave(k) {
    const x = h(), nm = deps.name(k), g = G(k); delete x.dir[k]; setMood(k, 0.8); x.no[k] = [];
    deps.toast(`👋 ${nm} напусна${fem(k) ? '' : ''}. ${deps.sub(k) || k} е без директор — назначи нов от „Холдинг“.`, 'bad'); deps.save();
  }
  const pay = c => { const e = deps.econ(); if (!e.canAfford(c)) { deps.toast(`Нямаш ${B(c)}.`, 'bad'); return false; } e.spend(c, 'заплати', 'Холдинг: директори'); return true; };
  // малък прозорец с избор (сам — не зависи от game.js)
  function ask(title, text, opts) {
    if (!document.getElementById('dirEvCss')) { const s = document.createElement('style'); s.id = 'dirEvCss'; s.textContent = css; document.head.appendChild(s); }
    document.getElementById('dirEv')?.remove();
    const w = document.createElement('div'); w.id = 'dirEv'; w.innerHTML = `<div><h3></h3><div class="m"></div></div>`;
    w.querySelector('h3').textContent = title; w.querySelector('.m').textContent = text;
    opts.forEach(([lab, fn], i) => { const b = document.createElement('button'); b.textContent = lab; if (i === 0) b.className = 'go'; b.onclick = () => { if (fn() === false) return; w.remove(); deps.save(); }; w.firstChild.appendChild(b); });
    document.body.appendChild(w);
  }
  return { onNo, onYes, dailyTick, bonusOff, mood, struck, away, fire };
}
