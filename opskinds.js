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
    decisions: [
      { id: 'warn', ico: '📢', title: 'Да предупредим ли хората?', when: m => m.t > 0.05 && m.t < m.peakT,
        opts: [{ k: 'sms', ico: '📲', nm: 'Сирени и SMS за евакуация', cost: 1e5, txt: 'по-малко хора остават по покривите' }, { k: 'none', ico: '🤐', nm: 'Без паника', txt: 'нищо не струва, но хората остават в къщите' }] },
      { id: 'dike', ico: '🧱', title: 'Къде да е дигата?', when: m => m.teams.sand.st !== 'ready',
        opts: [{ k: 'sub', ico: '⚡', nm: 'Около подстанцията', txt: 'токът остава; водата в квартала расте почти както досега' },
          { k: 'bank', ico: '🏞️', nm: 'По брега на реката', txt: 'водата расте бавно навсякъде, но подстанцията може да прелее' },
          { k: 'both', ico: '🧱', nm: 'И двете — още хора и чували', cost: 2e5, txt: 'пази всичко, но дигата се строи по-бавно' }] },
      { id: 'order', ico: '🚤', title: 'Кого да спасяваме първо?', when: m => m.teams.boat.st === 'onsite' || m.teams.heli.st === 'onsite',
        opts: [{ k: 'near', ico: '📍', nm: 'Най-близките', txt: 'най-бързо — повече хора за час' }, { k: 'weak', ico: '👵', nm: 'Деца, възрастни и болни', txt: 'по-бавно, но никой не е в критично положение' },
          { k: 'deep', ico: '🌊', nm: 'Където водата е най-висока', txt: 'средно бързо, по-малко критични' }] },
      { id: 'levee', ev: true, ico: '⚠️', title: 'Дигата прелива!', when: m => m.event && m.event.id === 'levee', txt: () => 'Водата минава над чувалите.',
        opts: [{ k: 'reinforce', ico: '🧱', nm: 'Подсили дигата', cost: 1.5e5, txt: 'дигата издържа', apply: m => { m.leveeOk = true; } }, { k: 'retreat', ico: '🏃', nm: 'Изтегли хората от дигата', txt: 'безопасно, но водата се качва бързо за малко', apply: m => { m.surgeTill = m.t + 0.3; } }] },
      { id: 'engine', ev: true, ico: '🔧', title: 'Лодка с повреден двигател', when: m => m.event && m.event.id === 'engine',
        opts: [{ k: 'spare', ico: '🛠️', nm: 'Резервна лодка', cost: 1e5, txt: 'спасяването продължава' }, { k: 'wait', ico: '⏳', nm: 'Ремонт на място', txt: 'лодките спасяват наполовина за кратко', apply: m => { m.slowTill = m.t + 0.4; } }] },
    ],
    start(m) { Object.assign(m, { dec: {}, event: null, level: 34, stranded: 42, rescued: 0, cared: 0, cold: 0, critical: 0, sub: 'ok', peakT: 1.6, damage: 0 }); return '🌊 Реката прелива в крайречния квартал. Хора чакат помощ по покривите.'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), sand = on('sand'), boat = on('boat'), heli = on('heli'), power = on('power'), med = on('med');
      if (m.phase === 'calm' && (sand || boat || heli || power || med)) m.phase = 'active';
      const D = m.dec || (m.dec = {}), dk = sand ? (D.dike || 'sub') : null, built = !sand ? 0 : Math.min(1, (m.t - (m.teams.sand.t0 + m.teams.sand.eta)) / (dk === 'both' ? 0.35 : 0.15));
      const rise = m.t < m.peakT, surge = m.surgeTill > m.t, rate0 = !dk ? 30 : dk === 'sub' ? 26 : 30 - 16 * built;
      m.level = Math.max(0, Math.min(95, m.level + (rise ? rate0 + (surge ? 16 : 0) : -24) * dt));
      if (rise && m.level > 60 && m.stranded < 70 && Math.random() < dt * (D.warn === 'sms' ? 0.6 : 2)) { m.stranded += 4; }
      const subSafe = dk === 'sub' || (dk === 'both' && built > 0.5) || (dk === 'bank' && m.level < 75);
      if (m.sub === 'ok' && m.level > 60 && !subSafe) { m.sub = 'flooded'; h.log(m, '⚡ Подстанцията е под вода — кварталът е без ток.'); }
      if (!m.event && dk && dk !== 'sub' && rise && m.level > 66 && !m.leveeOk && !m.leveeAsked) { m.leveeAsked = true; m.event = { id: 'levee' }; h.log(m, '⚠️ Дигата прелива.'); }
      if (!m.event && (boat) && !m.engineAsked && m.t - m.teams.boat.t0 > 0.6 && Math.random() < dt * 0.8) { m.engineAsked = true; m.event = { id: 'engine' }; h.log(m, '🔧 Лодка с повреден двигател.'); }
      if (m.sub === 'flooded' && power) { m.sub = 'gen'; h.log(m, '⚡ Генераторите дават ток на пункта и болницата.'); }
      if (m.sub === 'gen' && power && m.level < 30) { m.sub = 'fixed'; h.log(m, '🔧 Енергетиците ремонтираха подстанцията — токът е върнат.'); }
      const ord = D.order || 'near', om = { near: 1.25, weak: 0.8, deep: 1 }[ord], bm = m.slowTill > m.t || (m.event && m.event.id === 'engine') ? 0.5 : 1;
      const can = m.level > 12 ? 1 : 0, rate = ((boat ? 14 * bm : 0) + (heli ? 11 : 0)) * om * dt * can, got = Math.min(m.stranded, rate);
      if (got > 0) { m.stranded -= got; m.rescued += got; if (med) m.cared += got; else m.cold += got * 0.3; }
      const cm = (boat || heli) ? { near: 0.04, weak: 0, deep: 0.015 }[ord] : 0.1; if (m.level > 75 && m.stranded > 0) m.critical += dt * m.stranded * cm;   /* реда на спасяване решава колко стигат до критично */
      if (m.level < 10 && m.stranded > 0) { m.rescued += m.stranded; m.stranded = 0; }   // водата се оттегли — излизат сами
      m.damage += m.level / 100 * (dk === 'bank' || dk === 'both' ? 1.2e7 : 2.2e7) * dt;
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
    decisions: [
      { id: 'tactic', ico: '🚒', title: 'Как да гасим?', when: m => m.teams.fire.st === 'onsite', pick: true,
        opts: [{ k: 'attack', ico: '🎯', nm: 'Първо основното огнище', txt: 'най-силният огън пада бързо, но може да прескочи' },
          { k: 'shield', ico: '🛡️', nm: 'Пазим съседните сгради', txt: 'огънят не се разпростира, огнището гасне по-бавно' }] },
      { id: 'rescue', ico: '🪜', title: 'Кого спасява стълбата?', when: m => m.teams.ladder.st === 'onsite',
        opts: [{ k: 'top', ico: '⬆️', nm: 'Горните етажи първо', txt: 'там димът е най-гъст — по-малко нагълтали дим' }, { k: 'near', ico: '📍', nm: 'Най-близките прозорци', txt: 'повече хора за час' }] },
      { id: 'gas', ev: true, ico: '💨', title: 'Изтичане на газ в сградата!', when: m => m.event && m.event.id === 'gas',
        opts: [{ k: 'cut', ico: '🔧', nm: 'Спри газа за целия квартал', cost: 1e5, txt: 'безопасно; съседите са без газ за ден' },
          { k: 'risk', ico: '🎲', nm: 'Продължи без спиране', txt: 'може да избухне — огънят се разгаря', apply: m => { if (Math.random() < 0.5) { const i = m.b.indexOf(Math.max(...m.b)); m.b[i] = Math.min(100, m.b[i] + 30); m.blast = 1; } } }] },
      { id: 'hydrant', ev: true, ico: '💧', title: 'Ниско налягане в хидрантите', when: m => m.event && m.event.id === 'hydrant',
        opts: [{ k: 'tanker', ico: '🚛', nm: 'Водоноски', cost: 1.5e5, txt: 'гасенето продължава с пълна сила' }, { k: 'relay', ico: '🔁', nm: 'Помпа от реката', txt: 'по-евтино, но за малко струите са слаби', apply: m => { m.weakTill = m.t + 0.5; } }] },
      { id: 'collapse', ev: true, ico: '🏚️', title: 'Опасност от срутване', when: m => m.event && m.event.id === 'collapse', txt: m => `Сграда № ${m.event.i + 1} гори твърде дълго.`,
        opts: [{ k: 'pull', ico: '🏃', nm: 'Изтегли пожарникарите отвън', txt: 'безопасно, но тази сграда гасне по-бавно', apply: m => { m.pulled = m.event.i; } }, { k: 'stay', ico: '💪', nm: 'Продължи вътре', txt: 'по-бързо, но има риск за екипа', apply: m => { if (Math.random() < 0.4) m.injured = (m.injured || 0) + 2; } }] },
    ],
    start(m) { Object.assign(m, { dec: { tactic: 'attack' }, event: null, b: [0, 58, 0, 0], trapped: [0, 16, 0, 0], rescued: 0, smoke: 0, burnt: [0, 0, 0, 0], damage: 0 }); return '🔥 Пожар в жилищен блок — пламъците са на горните етажи, хора чакат на прозорците.'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), fire = on('fire'), ladder = on('ladder'), heli = on('heli'), pol = on('pol'), med = on('med');
      if (m.phase === 'calm' && (fire || ladder || heli || pol || med)) m.phase = 'active';
      const B = m.b, N = [[1], [0, 2], [1, 3], [2]], D = m.dec || (m.dec = { tactic: 'attack' });
      if (!m.event && fire && !m.gasAsked && m.t - m.teams.fire.t0 > 0.35 && Math.random() < dt * 1.2) { m.gasAsked = true; m.event = { id: 'gas' }; h.log(m, '💨 Изтичане на газ в горящата сграда.'); }
      if (!m.event && fire && !m.hydAsked && m.t - m.teams.fire.t0 > 0.5 && Math.random() < dt * 0.9) { m.hydAsked = true; m.event = { id: 'hydrant' }; h.log(m, '💧 Налягането в хидрантите пада.'); }
      { const i = B.findIndex((v, k) => v >= 95 && m.burnt[k] > 0.3); if (!m.event && i >= 0 && !m.colAsked) { m.colAsked = true; m.event = { id: 'collapse', i }; h.log(m, `🏚️ Сграда № ${i + 1} — опасност от срутване.`); } }
      for (let i = 0; i < 4; i++) { if (B[i] <= 0) continue; B[i] = Math.min(100, B[i] + 9 * dt);
        if (B[i] > 60) for (const j of N[i]) if (B[j] <= 0 && Math.random() < dt * (fire ? (D.tactic === 'shield' ? 0.06 : 0.45) : 1.4)) { B[j] = 18; if (!pol) m.trapped[j] += 6 + ((Math.random() * 5) | 0); h.log(m, `🔥 Огънят се прехвърли на съседна сграда (№ ${j + 1}).${pol ? ' Полицията вече я евакуира.' : ' Там също има хора.'}`); }
        if (B[i] >= 100) m.burnt[i] = Math.min(1, m.burnt[i] + dt * 0.8); }
      const cool = (k, amt) => { const order = [0, 1, 2, 3].filter(i => B[i] > 0).sort((a, b) => B[b] - B[a]); const n = Math.max(1, Math.min(k, order.length)); for (const i of order.slice(0, n)) B[i] = Math.max(0, B[i] - amt / n * dt); };
      const wk = m.weakTill > m.t || (m.event && m.event.id === 'hydrant') ? 0.5 : 1;
      if (fire) { if (D.tactic === 'shield') { const hot = [0, 1, 2, 3].filter(i => B[i] > 0).sort((a, b) => B[b] - B[a]); const side = hot.slice(1); cool(1, 26 * wk); for (const i of side) B[i] = Math.max(0, B[i] - 30 * wk * dt); } else cool(2, 52 * wk); }
      if (m.pulled != null && B[m.pulled] > 0) B[m.pulled] = Math.min(100, B[m.pulled] + 6 * dt);   /* изтеглени отвън — гасне по-бавно */
      if (heli) cool(1, 34);
      for (let i = 0; i < 4; i++) if (B[i] > 0 && B[i] < 2 && (fire || heli)) { B[i] = 0; h.log(m, `🧯 Сграда № ${i + 1} — огънят е изгасен.`); }
      const save = ((ladder ? (D.rescue === 'near' ? 18 : 12) : 0) + (heli ? 4 : 0) + (fire ? 4 : 0)) * dt; let left = save;
      for (let i = 0; i < 4 && left > 0; i++) { const g = Math.min(m.trapped[i], left); m.trapped[i] -= g; left -= g; m.rescued += g; if (!med) m.smoke += g * 0.25; }
      const trapped = m.trapped.reduce((a, b) => a + b, 0); if (trapped > 0 && B.some(v => v > 70)) m.smoke += dt * trapped * (D.rescue === 'top' ? 0.035 : 0.08);
      m.damage += B.reduce((a, b) => a + b, 0) * 1.2e5 * dt;
      if (!m.recov && B.every(v => v <= 0)) { m.recov = true; m.rescued += trapped; m.trapped = [0, 0, 0, 0]; h.log(m, '🧯 Пожарът е изгасен навсякъде. Твоят ход — как да се възстанови блокът.'); }
      if (m.t >= this.fade && !m.recov) h.resolve(m, 'faded', { trust: -6 - Math.round(m.smoke / 4), security: -2 }, '🔥 Пожарът изгоря сам — блокът е загубен, доверието пада.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust - Math.round(m.smoke / 5) + (m.rescued >= 20 ? 2 : 0) - (m.injured ? 2 : 0), security: C.sec, services: C.services - Math.round(m.burnt.reduce((a, b) => a + b, 0)) }),
    resultTxt: c => c === 'rebuild' ? '🏗️ Блокът ще бъде възстановен, семействата — обезщетени.' : c === 'rules' ? '🔍 Разследване и нови правила — следващият пожар ще бъде спрян по-рано.' : '💶 Семействата получават обезщетения.',
    stats(m, B) { const tr = m.trapped.reduce((a, b) => a + b, 0), mx = Math.max(...m.b);
      return [['🔥 Най-силният огън', mx, mx >= 70 ? '#ff6b6b' : mx >= 35 ? '#ffd54a' : '#5fe39a'], `🏢 Горят: ${m.b.filter(v => v > 0).length} от 4 сгради · ${m.b.map((v, i) => `№${i + 1} ${v > 0 ? Math.round(v) + '%' : m.burnt[i] > 0.5 ? '⬛' : '✔'}`).join(' · ')}`,
        `🪟 Чакат на прозорците: <b>${Math.round(tr)}</b> · ✅ спасени: ${Math.round(m.rescued)}${m.smoke >= 1 ? ` · 😷 нагълтали дим: ${Math.round(m.smoke)}` : ''}`, `💥 Щети: ${B(m.damage)}${m.injured ? ` · 🚑 пострадали пожарникари: ${m.injured}` : ''}`]; },
    phases: { calm: '🔥 Пожарът се разраства', active: '🚒 Гасене и спасяване', resolved: '✅ Пожарът е изгасен' },
  },
  // 🤝 Хуманитарен достъп (алтернативен игрови сценарий, измислен квартал): кварталът е без достатъчно храна, вода и лекарства.
  // Посредниците договарят коридор на контролния пункт (затворен → преговори → отворен); наблюдателите ускоряват проверката на конвоите.
  // Конвоите карат помощи до склада, а оттам те се раздават; медицинският транспорт извозва болните; водоснабдяването и генераторите
  // връщат услугите. Когато нуждата спадне и услугите тръгнат — решаваш как да продължи помощта.
  aid: {
    nm: 'Хуманитарен достъп', ico: '🤝', area: 'Кварталът Ал-Нур', fade: 9, place: { city: 'Ал-Нур', lon: 34.45, lat: 31.45, iso: 'PSX' },
    teams: {
      neg: { ico: '🤝', nm: 'Посредници', job: 'договарят хуманитарен коридор на контролния пункт', cost: 3e5, eta: 0.25 },
      obs: { ico: '🔍', nm: 'Наблюдатели', job: 'проверяват конвоите на място — пунктът ги пропуска по-бързо', cost: 2.5e5, eta: 0.3 },
      convoy: { ico: '🚚', nm: 'Конвой с помощи', job: 'товарът по твой избор — до склада в квартала', cost: 6e5, eta: 0.3 },
      med: { ico: '🚑', nm: 'Медицински транспорт', job: 'извозва болните през коридора до болницата', cost: 3e5, eta: 0.25 },
      water: { ico: '💧', nm: 'Водоснабдяване', job: 'цистерни и ремонт на помпената станция', cost: 3.5e5, eta: 0.3 },
      power: { ico: '⚡', nm: 'Генератори', job: 'ток за медицинския пункт и помпите', cost: 2e5, eta: 0.25 },
    },
    // 🧭 решенията по време на операцията (ops.js → decide): еднократни, „товарът“ — сменя се по всяко време; събития (ev) — с отговор
    decisions: [
      { id: 'check', ico: '🚧', title: 'Как да се проверяват конвоите?', when: m => m.talks >= 0.5, txt: () => 'Пунктът чака отговор, преди да отвори коридора.',
        opts: [{ k: 'full', ico: '🔎', nm: 'Пълна проверка на всеки камион', txt: 'безопасно, но конвоите минават бавно' },
          { k: 'seal', ico: '🔒', nm: 'Пломбирани камиони + наблюдатели', cost: 2.5e5, txt: 'по-бързо; пунктът е спокоен' },
          { k: 'fast', ico: '⚡', nm: 'Ускорено преминаване', txt: 'най-бързо, но рискът от задържане на пункта расте' }] },
      { id: 'cargo', ico: '📦', title: 'Какво кара конвоят', pick: true, when: m => m.teams.convoy.st !== 'ready',
        opts: [{ k: 'food', ico: '🍞', nm: 'Храна', txt: 'нуждата пада бързо' }, { k: 'water', ico: '💧', nm: 'Вода', txt: 'докато помпите не работят' }, { k: 'meds', ico: '💊', nm: 'Лекарства', txt: 'болните оздравяват на място' }] },
      { id: 'dist', ico: '🏘️', title: 'Как да се раздава помощта?', when: m => m.delivered > 8, txt: m => `На склад: ${Math.round(m.stock)} т — опашката е дълга.`,
        opts: [{ k: 'wh', ico: '🏬', nm: 'Само от склада', txt: 'евтино, но бавно; риск от блъсканица' },
          { k: 'mobile', ico: '🚐', nm: 'Мобилни пунктове по улиците', cost: 3e5, txt: 'стига до всички, опашката изчезва' },
          { k: 'local', ico: '🏛️', nm: 'Чрез местните общински служби', cost: 1e5, txt: 'по-бавно, но доверието расте' }] },
      { id: 'care', ico: '🏥', title: 'Болните — къде да се лекуват?', when: m => m.t > 0.4 && m.sick > 6,
        opts: [{ k: 'evac', ico: '🚑', nm: 'Евакуация през коридора', txt: 'нужен е отворен пункт и медицински транспорт' },
          { k: 'field', ico: '⛺', nm: 'Полева болница на място', cost: 4e5, txt: 'не зависи от пункта' }] },
      // ⚠️ събития (m.event)
      { id: 'held', ev: true, ico: '⛔', title: 'Конвоят е задържан на пункта', when: m => m.event && m.event.id === 'held', txt: () => 'Камионите стоят — проверяващите искат още документи.',
        opts: [{ k: 'talk', ico: '🤝', nm: 'Разговор на място', cost: 1e5, txt: 'пускат го до няколко часа', apply: m => { m.heldTill = m.t + 0.15; } },
          { k: 'wait', ico: '⏳', nm: 'Изчакай', txt: 'около ден', apply: m => { m.heldTill = m.t + 0.8; } }] },
      { id: 'crush', ev: true, ico: '⚠️', title: 'Блъсканица пред склада', when: m => m.event && m.event.id === 'crush', txt: () => 'Слух, че храната свършва — хората се натискат пред вратата.',
        opts: [{ k: 'mobile', ico: '🚐', nm: 'Отвори мобилни пунктове', cost: 3e5, txt: 'опашката се разпределя по улиците', apply: m => { m.dec.dist = 'mobile'; } },
          { k: 'order', ico: '🚓', nm: 'Местна полиция за реда', cost: 1.5e5, txt: 'спокойно, но доверието пада', apply: m => { m.orderKept = true; m.trustHit = (m.trustHit || 0) + 1; } }] },
      { id: 'fuel', ev: true, ico: '⛽', title: 'Генераторите остават без гориво', when: m => m.event && m.event.id === 'fuel',
        opts: [{ k: 'deliver', ico: '🛢️', nm: 'Спешна доставка на гориво', cost: 1.5e5, txt: 'всичко продължава', apply: m => { m.fuel = 1; } },
          { k: 'hosp', ico: '🏥', nm: 'Ток само за медицинския пункт', txt: 'помпите спират — водата намалява', apply: m => { m.fuel = 0.5; } }] },
    ],
    start(m) { Object.assign(m, { access: 'closed', talks: 0, need: 72, sick: 18, water: 25, stock: 0, delivered: 0, crit: 0, dec: { cargo: 'food' }, event: null, fuel: 1, powT: 0, heldTill: 0 }); return '🤝 Кварталът Ал-Нур е без достатъчно храна, вода и лекарства. Контролният пункт е затворен. (Алтернативен игрови сценарий.)'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), neg = on('neg'), obs = on('obs'), conv = on('convoy'), med = on('med'), water = on('water'), power = on('power'), D = m.dec || (m.dec = { cargo: 'food' });
      if (m.phase === 'calm' && (neg || obs || conv || med || water || power)) m.phase = 'active';
      // преговорите спират на 50%, докато не избереш как да се проверяват конвоите
      if (neg && m.access !== 'open') { if (m.access === 'closed') { m.access = 'talks'; h.log(m, '🤝 Посредниците започнаха разговор на пункта.'); }
        const cap = D.check ? 1 : 0.5; m.talks = Math.min(cap, m.talks + dt / (obs ? 0.6 : 0.9)); if (m.talks >= 1) { m.access = 'open'; h.log(m, '🚧 Коридорът е отворен.'); } }
      const open = m.access === 'open', held = m.heldTill > m.t || (m.event && m.event.id === 'held');
      // събития
      if (!m.event && open && conv && D.check === 'fast' && Math.random() < dt * 0.9) { m.event = { id: 'held' }; h.log(m, '⛔ Конвоят е задържан на пункта.'); }
      else if (!m.event && open && conv && D.check === 'full' && Math.random() < dt * 0.15) { m.event = { id: 'held' }; h.log(m, '⛔ Конвоят е задържан на пункта.'); }
      if (!m.event && (D.dist || 'wh') === 'wh' && m.need > 55 && m.delivered > 8 && !m.orderKept && Math.random() < dt * 0.8) { m.event = { id: 'crush' }; h.log(m, '⚠️ Блъсканица пред склада.'); }
      if (power && m.fuel === 1) { m.powT += dt; if (m.powT > 1.3 && !m.fuelAsked) { m.fuelAsked = true; m.event = m.event || { id: 'fuel' }; if (m.event.id === 'fuel') h.log(m, '⛽ Горивото за генераторите свършва.'); } }
      // конвоят: скорост по начина на проверка; задържан — стои
      const speed = { full: 0.5, seal: 1.1, fast: 1.4 }[D.check] || 0.5;
      if (conv && open && !held) { const got = 42 * dt * speed * (obs ? 1.15 : 1); m.stock += got; m.delivered += got; }
      // раздаване: склад / мобилни пунктове / общината; товарът решава какво помага
      const rate = { wh: 22, mobile: 40, local: 28 }[D.dist || 'wh'] * (m.event && m.event.id === 'crush' ? 0.3 : 1), give = Math.min(m.stock, rate * dt); m.stock -= give;
      const c = D.cargo || 'food';
      m.need = Math.max(0, Math.min(100, m.need + (6 + (m.water < 40 ? 4 : 0)) * dt - give * (c === 'food' ? 0.95 : c === 'water' ? 0.35 : 0.25)));
      const pumps = water && (!power || m.fuel === 1 || !m.fuelAsked);
      m.water = Math.max(0, Math.min(100, m.water + (pumps ? (power ? 34 : 18) : -3) * dt + (c === 'water' ? give * 0.8 : 0)));
      const field = D.care === 'field', care = (med ? (open && D.care !== 'field' ? 12 : 4) : 0) + (field ? 9 : 0) + (power ? 2 : 0) + (c === 'meds' ? give * 0.4 / Math.max(dt, 1e-6) * dt : 0);
      m.sick = Math.max(0, m.sick + (m.water < 40 ? 4 : 1.5) * dt - care * dt - (c === 'meds' ? give * 0.4 : 0));
      if (m.need > 88) m.crit += dt * 3; if (m.sick > 25) m.crit += dt * 2;
      if (!m.recov && m.need < 25 && m.sick < 5 && m.water >= 70) { m.recov = true; h.log(m, '🌤️ Помощта стига до всички, водата и токът работят. Твоят ход — как да продължи.'); }
      if (m.t >= this.fade && !m.recov) h.resolve(m, 'faded', { trust: -5 - Math.round(m.crit / 2), security: -1, services: -1 }, '⏳ Помощта не стигна навреме — кварталът остава в тежко положение.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust - Math.round(m.crit / 3) + (m.delivered > 150 ? 1 : 0) + ((m.dec || {}).dist === 'local' ? 2 : 0) - (m.trustHit || 0), security: C.sec + ((m.dec || {}).check === 'seal' ? 1 : 0), services: C.services }),
    resultTxt: c => c === 'rebuild' ? '🏗️ Водата, токът и клиниката ще бъдат възстановени.' : c === 'corridor' ? '🕊️ Коридорът остава отворен с наблюдатели — помощта ще стига редовно.' : '📦 Еднократна помощ — нуждите ще се върнат.',
    stats(m) { const acc = { closed: '🔴 затворен', talks: `🟡 преговори ${Math.round(m.talks * 100)}%${m.talks >= 0.5 && !(m.dec || {}).check ? ' — чака твоя отговор' : ''}`, open: m.heldTill > m.t || (m.event && m.event.id === 'held') ? '⛔ конвоят е задържан' : '🟢 отворен' }[m.access];
      const cg = { food: '🍞 храна', water: '💧 вода', meds: '💊 лекарства' }[(m.dec || {}).cargo || 'food'];
      return [['🍞 Нужда от храна и вода', m.need, m.need >= 70 ? '#ff6b6b' : m.need >= 40 ? '#ffd54a' : '#5fe39a'], `🚧 Контролният пункт: ${acc}`,
        `📦 Доставено: <b>${Math.round(m.delivered)} т</b> (${cg}) · на склад: ${Math.round(m.stock)} т`, `🏥 Чакат лечение: <b>${Math.round(m.sick)}</b> · 💧 вода: ${Math.round(m.water)}%${m.crit >= 1 ? ` · ⚠️ критично: ${Math.round(m.crit)}` : ''}`]; },
    phases: { calm: '🚧 Пунктът е затворен', active: '🚚 Хуманитарна операция', resolved: '✅ Помощта стига до всички' },
  },
  // 🌊 Ормузкият проток (алтернативна игрова хронология): корабоплаването е спряно, танкерите чакат на опашка, в коридора има мини.
  // Дипломатите договарят безопасно преминаване; миночистачите разчистват коридора; наблюдателите (горещ телефон, дронове) намаляват
  // риска от инцидент; ескортът придружава конвоите; алтернативните доставки (тръба до терминала на брега и маршрут около Африка)
  // и резервите крепят енергията, докато протокът е затворен. Когато корабоплаването е над 90% и напрежението е ниско — решение.
  strait: {
    nm: 'Морска криза', ico: '🌊', area: 'Ормузкият проток', fade: 10, place: { city: 'Ормузкият проток', lon: 56.6, lat: 26.2 },
    teams: {
      dip: { ico: '🤝', nm: 'Дипломати', job: 'договарят безопасно преминаване с крайбрежните държави', cost: 4e5, eta: 0.3 },
      mines: { ico: '⚓', nm: 'Миночистачи', job: 'разчистват коридора за корабите', cost: 6e5, eta: 0.35 },
      watch: { ico: '📡', nm: 'Наблюдатели', job: 'горещ телефон, дронове и общ доклад — по-малко инциденти', cost: 3e5, eta: 0.25 },
      escort: { ico: '🚢', nm: 'Ескорт на конвоите', job: 'придружава танкерите през коридора', cost: 9e5, eta: 0.4 },
      alt: { ico: '🛢️', nm: 'Алтернативни доставки', job: 'тръба до терминала на брега и танкери около Африка', cost: 7e5, eta: 0.45 },
      reserve: { ico: '🏦', nm: 'Държавни резерви', job: 'освобождава част от резервите — цените се успокояват веднага', cost: 5e5, eta: 0.1 },
    },
    choices: {
      deal: { ico: '📃', nm: 'Споразумение за преминаване с проверка', k: 0.2, trust: 4, sec: 3, services: 1, out: 'deal' },
      divers: { ico: '🛢️', nm: 'Дългосрочно разнообразяване на доставките', k: 0.35, trust: 3, sec: 2, services: 2, out: 'deal' },
      temp: { ico: '⏳', nm: 'Само временно примирие по море', k: 0.05, trust: 1, sec: 0, services: 0, out: 'partial' },
    },
    decisions: [
      { id: 'route', ico: '🧭', title: 'Как да минават танкерите?', pick: true, when: m => m.teams.escort.st !== 'ready' || m.teams.alt.st !== 'ready',
        opts: [{ k: 'convoy', ico: '🚢', nm: 'На конвои през протока', txt: 'най-бързо, но всеки инцидент спира всички' },
          { k: 'alt', ico: '🛢️', nm: 'По алтернативния маршрут', txt: 'безопасно, но по-скъпо и бавно' }, { k: 'mixed', ico: '⚖️', nm: 'Смесено', txt: 'част през протока, част по тръбата' }] },
      { id: 'rules', ico: '📜', title: 'Правила за ескорта', when: m => m.teams.escort.st === 'onsite',
        opts: [{ k: 'calm', ico: '🕊️', nm: 'Строго отбранителни — без провокации', txt: 'напрежението пада, конвоите са по-бавни' },
          { k: 'close', ico: '🛡️', nm: 'Близко прикритие на всеки танкер', cost: 2e5, txt: 'по-бързо, но напрежението расте малко' }] },
      { id: 'insure', ico: '📄', title: 'Застраховка за корабите', when: m => m.t > 0.3,
        opts: [{ k: 'state', ico: '🏛️', nm: 'Държавна гаранция', cost: 3e5, txt: 'повече собственици пускат танкерите си' }, { k: 'none', ico: '✖️', nm: 'Без гаранция', txt: 'част от танкерите остават да чакат' }] },
      { id: 'incident', ev: true, ico: '⚠️', title: 'Инцидент в протока', when: m => m.event && m.event.id === 'incident', txt: () => 'Непознат дрон кръжи над танкер в коридора.',
        opts: [{ k: 'call', ico: '📞', nm: 'Горещ телефон — изясни веднага', cost: 5e4, txt: 'напрежението пада', apply: m => { m.tension = Math.max(0, m.tension - 8); } },
          { k: 'stop', ico: '⏸️', nm: 'Спри конвоите до изясняване', txt: 'безопасно, но корабите чакат', apply: m => { m.pauseTill = m.t + 0.5; } }] },
      { id: 'mine', ev: true, ico: '💣', title: 'Мина в коридора', when: m => m.event && m.event.id === 'mine',
        opts: [{ k: 'clear', ico: '⚓', nm: 'Спри движението, разчисти', txt: 'полдин закъснение', apply: m => { m.pauseTill = m.t + 0.4; m.mines = Math.max(0, m.mines - 1); } },
          { k: 'bypass', ico: '↪️', nm: 'Заобиколи по маркиран коридор', cost: 1e5, txt: 'движението продължава, по-бавно', apply: m => { m.slowTill = m.t + 0.6; } }] },
    ],
    start(m) { Object.assign(m, { dec: {}, event: null, ship: 8, tension: 62, mines: 6, queue: 18, passed: 0, talks: 0, agree: false, energy: 0, reserveUsed: 0, pauseTill: 0, slowTill: 0 }); return '🌊 Корабоплаването през Ормузкия проток е спряно — 18 танкера чакат, в коридора има мини. (Алтернативна игрова хронология.)'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), dip = on('dip'), mn = on('mines'), w = on('watch'), esc = on('escort'), alt = on('alt'), res = on('reserve'), D = m.dec || (m.dec = {});
      if (m.phase === 'calm' && (dip || mn || w || esc || alt || res)) m.phase = 'active';
      if (dip && !m.agree) { m.talks = Math.min(1, m.talks + dt / (w ? 1.1 : 1.6)); if (m.talks >= 1) { m.agree = true; h.log(m, '📃 Договорено безопасно преминаване — с проверка на място.'); } }
      if (mn && m.mines > 0) { m.mines = Math.max(0, m.mines - dt * 3.2); if (m.mines === 0) h.log(m, '⚓ Коридорът е разчистен от мини.'); }
      m.tension = Math.max(5, Math.min(95, m.tension + (dip ? -6 : 1.5) * dt + (w ? -3 : 0) * dt + (esc ? (D.rules === 'close' ? 1.5 : D.rules === 'calm' ? -2 : 0.5) : 0) * dt));
      const route = D.route || (esc ? 'convoy' : alt ? 'alt' : 'convoy'), paused = m.pauseTill > m.t || (m.event && ['incident', 'mine'].includes(m.event.id));
      // преминаване през протока: нужен е ескорт или договор; мините бавят (и пораждат събития); застраховката пуска повече собственици
      const canGo = (esc || m.agree) && !paused, sea = route === 'alt' ? 0 : route === 'mixed' ? 0.55 : 1, slow = m.slowTill > m.t ? 0.5 : 1;
      const flow = canGo ? sea * slow * (m.agree ? 1 : 0.7) * (D.rules === 'close' ? 1.25 : D.rules === 'calm' ? 0.85 : 1) * (m.mines > 0.5 ? 0.45 : 1) * (D.insure === 'state' ? 1.2 : D.insure === 'none' ? 0.75 : 1) : 0;
      const pass = Math.min(m.queue, flow * 9 * dt); m.queue -= pass; m.passed += pass; m.queue = Math.min(40, m.queue + 2.5 * dt);   // нови танкери идват
      const altF = alt ? (route === 'alt' ? 1 : route === 'mixed' ? 0.6 : 0.35) : 0;
      m.ship = Math.max(0, Math.min(100, m.ship + (flow * 26 + altF * 9 - (canGo || altF ? 0 : 4)) * dt - (paused ? 6 * dt : 0)));
      m.energy = Math.max(0, Math.min(100, (m.ship * 0.7) + (alt ? 15 : 0) + (res ? 15 : 0)));
      if (res) m.reserveUsed = Math.min(100, m.reserveUsed + 18 * dt);
      // събития
      if (!m.event && canGo && m.tension > 30 && !w && Math.random() < dt * 0.9) { m.event = { id: 'incident' }; h.log(m, '⚠️ Инцидент: дрон над танкер в коридора.'); }
      else if (!m.event && canGo && w && m.tension > 45 && Math.random() < dt * 0.25) { m.event = { id: 'incident' }; h.log(m, '⚠️ Инцидент: дрон над танкер в коридора.'); }
      if (!m.event && canGo && m.mines > 0.5 && Math.random() < dt * 0.9) { m.event = { id: 'mine' }; h.log(m, '💣 Забелязана мина в коридора.'); }
      if (!m.recov && m.ship >= 90 && m.tension < 40) { m.recov = true; h.log(m, '🌊 Корабоплаването е почти нормално. Твоят ход — как да се запази.'); }
      if (m.t >= this.fade && !m.recov) h.resolve(m, 'faded', { trust: -4, security: -2, energy: -6, econ: -4 }, '⏳ Протокът остава почти затворен — енергията и икономиката страдат.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust, security: C.sec, services: C.services, energy: 4 + (C.out === 'deal' ? 3 : 0), econ: 3 - Math.round(m.reserveUsed / 50) }),
    resultTxt: c => c === 'deal' ? '📃 Споразумение с проверка — танкерите минават свободно.' : c === 'divers' ? '🛢️ Доставките се разнообразяват — следващата криза ще боли по-малко.' : '⏳ Временно примирие — протокът е отворен, но крехко.',
    stats(m) { return [['🚢 Корабоплаване', m.ship, m.ship >= 70 ? '#5fe39a' : m.ship >= 35 ? '#ffd54a' : '#ff6b6b'], ['🌡️ Напрежение', m.tension, m.tension >= 60 ? '#ff6b6b' : m.tension >= 35 ? '#ffd54a' : '#5fe39a'],
      `⛽ Чакат: <b>${Math.round(m.queue)}</b> танкера · ✅ минали: ${Math.round(m.passed)} · ⚓ мини: ${m.mines > 0.05 ? Math.ceil(m.mines) : 'няма'}`,
      `📃 Договор: ${m.agree ? '✅ има' : m.talks > 0 ? `🟡 преговори ${Math.round(m.talks * 100)}%` : '—'} · ⚡ енергия: ${Math.round(m.energy)}%${m.reserveUsed ? ` · 🏦 резерви: −${Math.round(m.reserveUsed)}%` : ''}`]; },
    phases: { calm: '⛔ Протокът е затворен', active: '🚢 Морска операция', resolved: '✅ Корабоплаването е възстановено' },
  },
  // 🏗️ Украйна — възстановяване на район (алтернативна игрова хронология, измислен район „Новоград“): блоковете са повредени, мостът
  // към гарата е срутен, болницата и токът не работят, хората са извън района. Сапьорите проверяват улиците (без тях работа не започва);
  // инженерите ремонтират моста; енергетиците връщат тока и парното; строителите — жилищата; медиците — болницата; автобусите и
  // камионите връщат хората и доставките. Наближава зима — без парно хората не могат да се върнат.
  rebuild: {
    nm: 'Възстановяване на район', ico: '🏗️', area: 'Новоград', fade: 12, place: { city: 'Новоград', lon: 36.2, lat: 49.4, iso: 'UKR' },
    teams: {
      sapper: { ico: '🦺', nm: 'Сапьори', job: 'проверяват улиците и сградите — без тях работа не започва', cost: 4e5, eta: 0.3 },
      bridge: { ico: '🌉', nm: 'Инженери — мостът', job: 'временен мост, после ремонт — пътят към гарата и доставките', cost: 9e5, eta: 0.4 },
      power: { ico: '⚡', nm: 'Ток и парно', job: 'подстанция, генератори, отоплителна централа', cost: 7e5, eta: 0.35 },
      build: { ico: '🏗️', nm: 'Строители', job: 'ремонт на блоковете — покриви, прозорци, стълбища', cost: 1.2e6, eta: 0.35 },
      med: { ico: '🏥', nm: 'Болница', job: 'медици и оборудване — спешно отделение', cost: 5e5, eta: 0.3 },
      bus: { ico: '🚌', nm: 'Автобуси и доставки', job: 'връщат жителите и карат храна, вода, материали', cost: 4e5, eta: 0.3 },
    },
    choices: {
      full: { ico: '🏙️', nm: 'Пълно възстановяване на района', k: 0.35, trust: 5, sec: 2, services: 4, out: 'deal' },
      core: { ico: '🏥', nm: 'Основните услуги и жилищата', k: 0.15, trust: 3, sec: 1, services: 2, out: 'deal' },
      temp: { ico: '🏕️', nm: 'Временни модулни жилища', k: 0.06, trust: 1, sec: 0, services: 1, out: 'partial' },
    },
    decisions: [
      { id: 'prio', ico: '📋', title: 'Какво първо?', pick: true, when: m => m.teams.build.st !== 'ready' || m.teams.power.st !== 'ready',
        opts: [{ k: 'hosp', ico: '🏥', nm: 'Болницата и училището', txt: 'по-малко пострадали, жилищата — по-бавно' }, { k: 'homes', ico: '🏠', nm: 'Жилищата', txt: 'хората се връщат по-бързо' }, { k: 'heat', ico: '🔥', nm: 'Парното преди зимата', txt: 'топлина за всички, ремонтите — по-бавни' }] },
      { id: 'homesHow', ico: '🏠', title: 'Как да ремонтираме блоковете?', when: m => m.teams.build.st === 'onsite',
        opts: [{ k: 'repair', ico: '🔧', nm: 'Ремонт на място', txt: 'по-евтино; хората остават в квартала' }, { k: 'modules', ico: '📦', nm: 'Модулни жилища, докато трае ремонтът', cost: 3e5, txt: 'хората се връщат веднага в модулите' }] },
      { id: 'jobs', ico: '👷', title: 'Кой строи?', when: m => m.teams.build.st === 'onsite',
        opts: [{ k: 'local', ico: '🏘️', nm: 'Местни фирми и жители', txt: 'по-бавно, но доверието и работните места растат' }, { k: 'firm', ico: '🏢', nm: 'Голяма външна фирма', cost: 2e5, txt: 'по-бързо' }] },
      { id: 'uxo', ev: true, ico: '⚠️', title: 'Невзривен боеприпас в двор', when: m => m.event && m.event.id === 'uxo', txt: () => 'Строителите спряха — сапьорите трябва да го обезвредят.',
        opts: [{ k: 'wait', ico: '🦺', nm: 'Евакуирай улицата и чакай сапьорите', txt: 'безопасно, около половин ден', apply: m => { m.stopTill = m.t + 0.5; } }, { k: 'extra', ico: '🚐', nm: 'Още един екип сапьори', cost: 1.5e5, txt: 'бързо', apply: m => { m.stopTill = m.t + 0.12; } }] },
      { id: 'frost', ev: true, ico: '❄️', title: 'Първите студове', when: m => m.event && m.event.id === 'frost', txt: m => `Парното работи за ${Math.round(m.heat)}% от жилищата.`,
        opts: [{ k: 'heaters', ico: '🔌', nm: 'Отоплителни пунктове и печки', cost: 2e5, txt: 'хората издържат до пускането на парното', apply: m => { m.heatAid = true; } }, { k: 'evac', ico: '🚌', nm: 'Временно настаняване извън района', txt: 'безопасно, но част от хората си тръгват', apply: m => { m.home = Math.max(0, m.home - 120); } }] },
      { id: 'late', ev: true, ico: '🚛', title: 'Материалите закъсняват', when: m => m.event && m.event.id === 'late',
        opts: [{ k: 'rail', ico: '🚆', nm: 'По жп през гарата', txt: 'нужен е мостът', apply: m => { m.slowTill = m.bridge >= 100 ? 0 : m.t + 0.6; } }, { k: 'buy', ico: '💶', nm: 'Купи на място по-скъпо', cost: 2e5, txt: 'работата продължава' }] },
    ],
    start(m) { Object.assign(m, { dec: {}, event: null, safe: 0, bridge: 0, power: 8, heat: 5, homes: 20, hosp: 15, home: 0, pop: 600, hurt: 0, stopTill: 0, slowTill: 0 }); return '🏗️ Районът Новоград е разрушен: мостът към гарата е срутен, няма ток и парно, хората са извън района. (Алтернативна игрова хронология.)'; },
    step(m, dt, h) {
      const on = k => h.on(m, k), D = m.dec || (m.dec = {}), sap = on('sapper');
      if (m.phase === 'calm' && Object.keys(m.teams).some(on)) m.phase = 'active';
      if (sap) m.safe = Math.min(100, m.safe + 45 * dt);
      const stop = m.stopTill > m.t || (m.event && m.event.id === 'uxo'), ok = m.safe >= 30 && !stop, slow = m.slowTill > m.t || (m.event && m.event.id === 'late') ? 0.5 : 1;
      const pr = D.prio || 'homes', jobs = D.jobs === 'firm' ? 1.3 : D.jobs === 'local' ? 0.85 : 1;
      if (ok && on('bridge')) { const b0 = m.bridge; m.bridge = Math.min(100, m.bridge + 40 * dt * slow); if (b0 < 40 && m.bridge >= 40) h.log(m, '🌉 Временният мост е готов — камионите минават.'); if (b0 < 100 && m.bridge >= 100) h.log(m, '🌉 Мостът е ремонтиран — гарата отново работи.'); }
      const sup = m.bridge >= 40 ? 1 : 0.55;
      if (ok && on('power')) { m.power = Math.min(100, m.power + 30 * dt * sup * slow); m.heat = Math.min(100, m.heat + (pr === 'heat' ? 34 : 20) * dt * sup * slow * (m.power > 30 ? 1 : 0.3)); }
      if (ok && on('build')) m.homes = Math.min(100, m.homes + (pr === 'homes' ? 24 : pr === 'heat' ? 12 : 15) * dt * sup * slow * jobs);
      if (ok && on('med')) m.hosp = Math.min(100, m.hosp + (pr === 'hosp' ? 40 : 22) * dt * sup * slow);
      // жителите се връщат с автобусите — ако има къде да живеят и е топло
      const cap = m.pop * Math.min(1, (D.homesHow === 'modules' && on('build') ? Math.max(m.homes, 70) : m.homes) / 100) * (m.heat > 50 || m.heatAid || m.t < 3 ? 1 : 0.4);
      if (on('bus') && ok) m.home = Math.min(cap, m.home + (D.homesHow === 'modules' ? 150 : 100) * (pr === 'homes' ? 1.15 : 1) * dt * sup);
      m.hurt += (m.hosp < 40 ? 1 : 0) * (m.home / 300) * dt * (pr === 'hosp' ? 0.5 : 1);
      // събития
      if (!m.event && ok && (on('build') || on('bridge')) && !m.uxoAsked && m.t > 0.6 && Math.random() < dt * 1.1) { m.uxoAsked = true; m.event = { id: 'uxo' }; h.log(m, '⚠️ Невзривен боеприпас в двор — работата спира.'); }
      if (!m.event && m.t > 3 && !m.frostAsked && m.heat < 70) { m.frostAsked = true; m.event = { id: 'frost' }; h.log(m, '❄️ Първите студове — парното още не стига.'); }
      if (!m.event && ok && on('build') && !m.lateAsked && m.t > 1.2 && Math.random() < dt * 0.7) { m.lateAsked = true; m.event = { id: 'late' }; h.log(m, '🚛 Материалите закъсняват на границата на района.'); }
      if (!m.recov && m.homes >= 80 && m.heat >= 70 && m.hosp >= 70 && m.home >= m.pop * 0.7) { m.recov = true; h.log(m, '🏘️ Хората се връщат по домовете си. Твоят ход — как да продължи възстановяването.'); }
      if (m.t >= this.fade && !m.recov) h.resolve(m, 'faded', { trust: -4, services: -2 }, '⏳ Районът остава полупразен — хората не се връщат.');
    },
    ready: m => !!m.recov,
    effect: (m, C) => ({ trust: C.trust + ((m.dec || {}).jobs === 'local' ? 2 : 0) - Math.round(m.hurt / 4), security: C.sec, services: C.services, econ: (m.dec || {}).jobs === 'local' ? 1 : 0 }),
    resultTxt: c => c === 'full' ? '🏙️ Районът ще бъде възстановен изцяло — с нови училища и паркове.' : c === 'core' ? '🏥 Основните услуги и жилищата са готови, останалото — постепенно.' : '🏕️ Модулни жилища — временно решение.',
    stats(m) { return [['🏠 Жилища', m.homes, m.homes >= 70 ? '#5fe39a' : m.homes >= 40 ? '#ffd54a' : '#ff6b6b'], ['🔥 Парно', m.heat, m.heat >= 70 ? '#5fe39a' : m.heat >= 35 ? '#ffd54a' : '#ff6b6b'],
      `👨‍👩‍👧 Върнали се: <b>${Math.round(m.home)}</b> от ${m.pop} · 🏥 болница ${Math.round(m.hosp)}% · ⚡ ток ${Math.round(m.power)}%`,
      `🌉 Мостът: ${m.bridge >= 100 ? '✅ ремонтиран' : m.bridge >= 40 ? '🟡 временен' : m.bridge > 0 ? `🔧 ${Math.round(m.bridge)}%` : '⛔ срутен'} · 🦺 проверени улици: ${Math.round(m.safe)}%${m.hurt >= 1 ? ` · 🤕 без лечение: ${Math.round(m.hurt)}` : ''}`]; },
    phases: { calm: '🏚️ Районът е разрушен', active: '🏗️ Възстановяване', resolved: '✅ Хората се върнаха' },
  },
};
