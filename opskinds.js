// opskinds.js — 🚨 още оперативни кризи (ops.js ги ползва; сцените — opsflood.js, opsfire.js): само логиката, времето е в игрови дни.
// Всеки вид: { nm, ico, area, teams, choices, start(m), step(m, dt, h), ready(m), stats(m) → [редове], resultTxt(c, m) }.
// h (от ops.js): { log(m, txt), resolve(m, out, eff, txt), on(m, k) }.
//
// 🌊 Наводнение — аварийна операция: реката прелива в крайречния квартал. Водата расте ~1,6 дни (по-бавно с пясъчна дига),
// после спада. Хората по покривите се спасяват с лодки и хеликоптер; медиците ги поемат в пункта; подстанцията се наводнява
// над ниво 60 (освен ако дигата е там навреме) — генераторите дават ток на пункта и болницата. Когато водата се оттегли под 20 —
// решаваш как да се възстанови кварталът.
// 🔥 Пожар в жилищен блок: огнището се разраства и прехвърля на съседните сгради; хора остават в горните етажи.
// Пожарните гасят (най-силния огън), автостълбата и хеликоптерът спасяват и гасят, полицията евакуира съседите и затваря улицата,
// линейките поемат спасените. Когато огънят е изгасен навсякъде — решаваш за възстановяването.

export const KINDS = {
  flood: {
    nm: 'Наводнение', ico: '🌊', area: 'Крайречният квартал', fade: 7,
    teams: {
      boat: { ico: '🚤', nm: 'Спасителни лодки', job: 'вадят хората от наводнените къщи и покриви', cost: 3e5, eta: 0.25 },
      heli: { ico: '🚁', nm: 'Хеликоптер', job: 'бързо спасяване от покривите, където лодките не стигат', cost: 8e5, eta: 0.15 },
      sand: { ico: '🧱', nm: 'Пясъчна дига', job: 'чували по брега и около подстанцията — водата расте по-бавно', cost: 2e5, eta: 0.2 },
      power: { ico: '⚡', nm: 'Генератори и енергетици', job: 'ток за пункта и болницата; ремонт на подстанцията', cost: 2.5e5, eta: 0.3 },
      med: { ico: '🚑', nm: 'Медици', job: 'пункт за спасените: топло, сухо, прегледи', cost: 1.5e5, eta: 0.25 },
    },
    choices: {
      rebuild: { ico: '🏗️', nm: 'Възстановяване и нова дига', k: 0.4, trust: 5, sec: 2, services: 3, out: 'deal' },
      repair: { ico: '🔧', nm: 'Ремонт на моста и подстанцията', k: 0.15, trust: 3, sec: 1, services: 1, out: 'deal' },
      aid: { ico: '💶', nm: 'Само обезщетения за семействата', k: 0.08, trust: 1, sec: 0, services: 0, out: 'partial' },
    },
    start(m) { Object.assign(m, { level: 34, stranded: 42, rescued: 0, cared: 0, cold: 0, critical: 0, sub: 'ok', peakT: 1.6, damage: 0 }); return '🌊 Реката прелива в крайречния квартал. Хора чакат помощ по покривите.'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), sand = on('sand'), boat = on('boat'), heli = on('heli'), power = on('power'), med = on('med');
      if (m.phase === 'calm' && (sand || boat || heli || power || med)) m.phase = 'active';
      const rise = m.t < m.peakT; m.level = Math.max(0, Math.min(95, m.level + (rise ? (sand ? 14 : 30) : -24) * dt));
      if (rise && m.level > 60 && m.stranded < 70 && Math.random() < dt * 2) { m.stranded += 4; }
      if (m.sub === 'ok' && m.level > 60 && !sand) { m.sub = 'flooded'; h.log(m, '⚡ Подстанцията е под вода — кварталът е без ток.'); }
      if (m.sub === 'flooded' && power) { m.sub = 'gen'; h.log(m, '⚡ Генераторите дават ток на пункта и болницата.'); }
      if (m.sub === 'gen' && power && m.level < 30) { m.sub = 'fixed'; h.log(m, '🔧 Енергетиците ремонтираха подстанцията — токът е върнат.'); }
      const can = m.level > 12 ? 1 : 0, rate = ((boat ? 14 : 0) + (heli ? 11 : 0)) * dt * can, got = Math.min(m.stranded, rate);
      if (got > 0) { m.stranded -= got; m.rescued += got; if (med) m.cared += got; else m.cold += got * 0.3; }
      if (m.level > 75 && m.stranded > 0 && !boat && !heli) m.critical += dt * m.stranded * 0.1;
      if (m.level < 10 && m.stranded > 0) { m.rescued += m.stranded; m.stranded = 0; }   // водата се оттегли — излизат сами
      m.damage += m.level / 100 * (sand ? 1.2e7 : 2.2e7) * dt;
      if (!rise && m.level < 20 && !m.recov) { m.recov = true; h.log(m, '🌤️ Водата се оттегля. Твоят ход — как да се възстанови кварталът.'); }
      if (m.t >= this.fade) h.resolve(m, 'faded', { trust: -5 - Math.round(m.critical / 3), security: -1, services: -2 }, '🌧️ Без решение за възстановяването хората остават сами с щетите.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust - Math.round(m.critical / 3) - Math.round(m.cold / 15) + (m.rescued >= 40 ? 2 : 0), security: C.sec, services: C.services - (m.sub === 'flooded' ? 2 : 0) }),
    resultTxt: c => c === 'rebuild' ? '🏗️ Кварталът ще се възстанови, а новата дига ще го пази.' : c === 'repair' ? '🔧 Мостът и подстанцията се ремонтират — животът се връща.' : '💶 Семействата получават обезщетения. Ремонтите — сами.',
    stats(m, B) { const sub = { ok: '🟢 работи', flooded: '🔴 под вода — без ток', gen: '🟡 генератори', fixed: '🟢 ремонтирана' }[m.sub];
      return [['🌊 Ниво на водата', m.level, m.level >= 70 ? '#ff6b6b' : m.level >= 40 ? '#ffd54a' : '#5fe39a'], `🏠 На покривите: <b>${Math.round(m.stranded)}</b> · ✅ спасени: ${Math.round(m.rescued)}${m.cold >= 1 ? ` · 🥶 без медици: ${Math.round(m.cold)}` : ''}`,
        `⚡ Подстанцията: ${sub}`, `💧 Щети: ${B(m.damage)}${m.critical >= 1 ? ` · ⚠️ в критично положение: ${Math.round(m.critical)}` : ''}`]; },
    phases: { calm: '🌊 Водата прииждa', active: '🚤 Спасителна операция', resolved: '✅ Кварталът е спасен' },
  },
  fire: {
    nm: 'Пожар', ico: '🔥', area: 'Жилищен блок', fade: 6,
    teams: {
      fire: { ico: '🚒', nm: 'Пожарни коли', job: 'гасят най-силния огън и пазят съседните сгради', cost: 3e5, eta: 0.16 },
      ladder: { ico: '🪜', nm: 'Автостълба', job: 'спасява хората от горните етажи', cost: 3.5e5, eta: 0.24 },
      heli: { ico: '🚁', nm: 'Хеликоптер с вода', job: 'хвърля вода отгоре върху най-големия огън', cost: 8e5, eta: 0.2 },
      pol: { ico: '🚓', nm: 'Полиция', job: 'евакуира съседите и затваря улицата за колите на спасителите', cost: 2e5, eta: 0.14 },
      med: { ico: '🚑', nm: 'Линейки', job: 'поемат спасените и пострадалите от дима', cost: 1.5e5, eta: 0.2 },
    },
    choices: {
      rebuild: { ico: '🏗️', nm: 'Възстанови блока и обезщети семействата', k: 0.3, trust: 5, sec: 1, services: 2, out: 'deal' },
      rules: { ico: '🔍', nm: 'Разследване и нови правила за безопасност', k: 0.06, trust: 3, sec: 2, services: 1, out: 'deal' },
      aid: { ico: '💶', nm: 'Само обезщетения', k: 0.1, trust: 1, sec: 0, services: 0, out: 'partial' },
    },
    start(m) { Object.assign(m, { b: [0, 58, 0, 0], trapped: [0, 16, 0, 0], rescued: 0, smoke: 0, burnt: [0, 0, 0, 0], damage: 0 }); return '🔥 Пожар в жилищен блок — пламъците са на горните етажи, хора чакат на прозорците.'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), fire = on('fire'), ladder = on('ladder'), heli = on('heli'), pol = on('pol'), med = on('med');
      if (m.phase === 'calm' && (fire || ladder || heli || pol || med)) m.phase = 'active';
      const B = m.b, N = [[1], [0, 2], [1, 3], [2]];
      for (let i = 0; i < 4; i++) { if (B[i] <= 0) continue; B[i] = Math.min(100, B[i] + 9 * dt);
        if (B[i] > 60) for (const j of N[i]) if (B[j] <= 0 && Math.random() < dt * (fire ? 0.4 : 1.4)) { B[j] = 18; if (!pol) m.trapped[j] += 6 + ((Math.random() * 5) | 0); h.log(m, `🔥 Огънят се прехвърли на съседна сграда (№ ${j + 1}).${pol ? ' Полицията вече я евакуира.' : ' Там също има хора.'}`); }
        if (B[i] >= 100) m.burnt[i] = Math.min(1, m.burnt[i] + dt * 0.8); }
      const cool = (k, amt) => { const order = [0, 1, 2, 3].filter(i => B[i] > 0).sort((a, b) => B[b] - B[a]); for (const i of order.slice(0, k)) B[i] = Math.max(0, B[i] - amt / k * dt); };
      if (fire) cool(2, 52); if (heli) cool(1, 34);
      for (let i = 0; i < 4; i++) if (B[i] > 0 && B[i] < 2 && (fire || heli)) { B[i] = 0; h.log(m, `🧯 Сграда № ${i + 1} — огънят е изгасен.`); }
      const save = ((ladder ? 14 : 0) + (heli ? 4 : 0) + (fire ? 4 : 0)) * dt; let left = save;
      for (let i = 0; i < 4 && left > 0; i++) { const g = Math.min(m.trapped[i], left); m.trapped[i] -= g; left -= g; m.rescued += g; if (!med) m.smoke += g * 0.25; }
      const trapped = m.trapped.reduce((a, b) => a + b, 0); if (trapped > 0 && B.some(v => v > 70)) m.smoke += dt * trapped * 0.08;
      m.damage += B.reduce((a, b) => a + b, 0) * 1.2e5 * dt;
      if (!m.recov && B.every(v => v <= 0)) { m.recov = true; m.rescued += trapped; m.trapped = [0, 0, 0, 0]; h.log(m, '🧯 Пожарът е изгасен навсякъде. Твоят ход — как да се възстанови блокът.'); }
      if (m.t >= this.fade && !m.recov) h.resolve(m, 'faded', { trust: -6 - Math.round(m.smoke / 4), security: -2 }, '🔥 Пожарът изгоря сам — блокът е загубен, доверието пада.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust - Math.round(m.smoke / 5) + (m.rescued >= 20 ? 2 : 0), security: C.sec, services: C.services - Math.round(m.burnt.reduce((a, b) => a + b, 0)) }),
    resultTxt: c => c === 'rebuild' ? '🏗️ Блокът ще бъде възстановен, семействата — обезщетени.' : c === 'rules' ? '🔍 Разследване и нови правила — следващият пожар ще бъде спрян по-рано.' : '💶 Семействата получават обезщетения.',
    stats(m, B) { const tr = m.trapped.reduce((a, b) => a + b, 0), mx = Math.max(...m.b);
      return [['🔥 Най-силният огън', mx, mx >= 70 ? '#ff6b6b' : mx >= 35 ? '#ffd54a' : '#5fe39a'], `🏢 Горят: ${m.b.filter(v => v > 0).length} от 4 сгради · ${m.b.map((v, i) => `№${i + 1} ${v > 0 ? Math.round(v) + '%' : m.burnt[i] > 0.5 ? '⬛' : '✔'}`).join(' · ')}`,
        `🪟 Чакат на прозорците: <b>${Math.round(tr)}</b> · ✅ спасени: ${Math.round(m.rescued)}${m.smoke >= 1 ? ` · 😷 нагълтали дим: ${Math.round(m.smoke)}` : ''}`, `💥 Щети: ${B(m.damage)}`]; },
    phases: { calm: '🔥 Пожарът се разраства', active: '🚒 Гасене и спасяване', resolved: '✅ Пожарът е изгасен' },
  },
};
