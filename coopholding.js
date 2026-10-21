// coopholding.js — 🏛️ нивата на общия холдинг в партньорството (feature 'coop-levels'). Отделни от нивата на двете фирми.
// Тук е само логиката и изгледът (без сървър): coop.js подава състоянието от облака (coop_hold_status), Лабораторията — примерно.
// Правила:
//   • опит идва само от истинска обща работа: завършен общ проект, доставка към общ проект, успешна концесия; прехвърляне на пари — 0 опит;
//   • ниво нагоре иска три неща: опит + конкретно постижение + принос и от двамата партньори (пари/материали/техника/изпълнение, не непременно равно);
//   • всеки общ проект казва предварително кой какво дава, бюджета, срока и дела от печалбата; и двамата приемат → ресурсите се резервират;
//   • когато партньорът е офлайн, одобрените проекти продължават; нов голям разход чака съгласие, малките — до договорения лимит;
//   • спечеленото ниво не се губи; провален проект струва пари и временно сваля доверието.
// Състоянието h: { name, level, xp, xpAt (опитът при последното ниво), trust 0…100, trustUntil (ms), limit (€ без съгласие),
//   contrib: { me: { money, mat, gear, exec }, them: {…} } (от последното ниво, в €), ach: { projects, deliveries, corridors, concessions, megas },
//   free, reserved, projects: [{ id, title, kind, budget, deadline (ms), split: [моят %, неговият %], gives: { me: [{ k, v, txt }], them: [...] },
//   ok: { me, them }, status: 'proposed'|'active'|'done'|'failed', reserved }] }

export const LEVELS = [
  { n: 1, ico: '🤝', nm: 'Стратегически съюз', perks: ['общ фонд', 'първи общ проект', 'отчет кой какво влага'], hq: 'знаме със знака на холдинга' },
  { n: 2, ico: '🚚', nm: 'Обща логистика', perks: ['общи доставки', 'заемане на техника', 'общ склад'], hq: 'логистичен двор с камиони', xp: 1000,
    ach: { k: 'deliveries', need: 5, txt: '5 доставки към общи проекти' } },
  { n: 3, ico: '🏗️', nm: 'Инвестиционна група', perks: ['общи държавни търгове', 'финансиране на филиали'], hq: 'кула на холдинга', xp: 3500,
    ach: { k: 'corridors', need: 1, txt: 'завършен общ коридор (магистрала или жп)' } },
  { n: 4, ico: '🌍', nm: 'Международен холдинг', perks: ['общи хотели', 'транспортни коридори', 'големи концесии'], hq: 'хеликоптерна площадка', xp: 9000,
    ach: { k: 'concessions', need: 1, txt: 'успешна обща концесия' } },
  { n: 5, ico: '👑', nm: 'Глобален консорциум', perks: ['общи мегапроекти', 'обща централа', 'сезонни цели'], hq: 'златна корона на централата', xp: 22000,
    ach: { k: 'megas', need: 1, txt: 'завършен общ мегапроект' } },
];
export const MIN_SHARE = 0.15;      // всеки партньор — поне 15% от общия принос за нивото
export const FAIL_TRUST = 15, FAIL_DAYS = 30;   // провал: −15 доверие за 30 дни
const DAY = 864e5;

// ---- опит: само от обща работа
export function xpOf(ev) {
  switch (ev.t) {
    case 'project_done': return Math.max(100, Math.min(2500, Math.round((ev.budget || 0) / 2e5)));
    case 'delivery': return Math.max(10, Math.min(300, Math.round((ev.value || 0) / 5e4)));
    case 'concession': return Math.max(250, Math.min(3000, Math.round((ev.value || 0) / 1e5)));
    default: return 0;   // прехвърляне на пари, подаръци, заеми — 0
  }
}
const sum = c => (c?.money || 0) + (c?.mat || 0) + (c?.gear || 0) + (c?.exec || 0);
export const nextOf = h => LEVELS[(h.level || 1)] || null;
export const levelOf = h => LEVELS[(h.level || 1) - 1];
export const trustNow = (h, now = Date.now()) => (h.trustUntil || 0) > now ? h.trust ?? 100 : 100;

// ---- трите условия за следващото ниво
export function check(h) {
  const nx = nextOf(h); if (!nx) return { max: true, ok: false };
  const a = sum(h.contrib?.me), b = sum(h.contrib?.them), t = a + b;
  const xp = { have: h.xp || 0, need: nx.xp, ok: (h.xp || 0) >= nx.xp };
  const got = (h.ach || {})[nx.ach.k] || 0, ach = { have: got, need: nx.ach.need, txt: nx.ach.txt, ok: got >= nx.ach.need };
  const both = { me: a, them: b, meP: t ? a / t : 0, themP: t ? b / t : 0, ok: t > 0 && a / t >= MIN_SHARE && b / t >= MIN_SHARE };
  return { nx, xp, ach, both, ok: xp.ok && ach.ok && both.ok };
}

// ---- събитията (сървърът ги прилага същите; тук — за демото и за оптимистичното показване)
export function apply(h, ev, now = Date.now()) {
  h.ach = h.ach || {}; h.contrib = h.contrib || { me: {}, them: {} };
  const add = (who, k, v) => { const c = h.contrib[who] = h.contrib[who] || {}; c[k] = (c[k] || 0) + Math.max(0, v || 0); };
  const x = xpOf(ev); h.xp = (h.xp || 0) + x;
  if (ev.t === 'project_done') { h.ach.projects = (h.ach.projects || 0) + 1; if (ev.corridor) h.ach.corridors = (h.ach.corridors || 0) + 1; if (ev.mega) h.ach.megas = (h.ach.megas || 0) + 1;
    for (const who of ['me', 'them']) for (const g of ev.gives?.[who] || []) add(who, g.k, g.v); }
  if (ev.t === 'delivery') { h.ach.deliveries = (h.ach.deliveries || 0) + 1; add(ev.by || 'me', ev.k || 'mat', ev.value); }
  if (ev.t === 'concession') { h.ach.concessions = (h.ach.concessions || 0) + 1; add('me', 'exec', ev.value / 2); add('them', 'exec', ev.value / 2); }
  if (ev.t === 'project_fail') { h.trust = Math.max(0, trustNow(h, now) - FAIL_TRUST); h.trustUntil = now + FAIL_DAYS * DAY; h.free = Math.max(0, (h.free || 0) - (ev.loss || 0)); }
  if (ev.t === 'levelup') { const c = check(h); if (!c.ok) return { xp: 0, err: 'условията не са изпълнени' }; h.level = c.nx.n; h.xpAt = h.xp; h.contrib = { me: {}, them: {} }; return { xp: 0, level: c.nx }; }
  return { xp: x };
}

// ---- офлайн партньор: може ли разходът без него
export const needsConsent = (h, cost) => cost > (h.limit || 0);

// ---- изглед
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const eur = (n, f) => `${f ? f(Math.round(n)) : Math.round(n).toLocaleString('bg-BG')} €`;
const pct = v => `${Math.round(v * 100)}%`;
const KIND = { money: '💶 пари', mat: '🧱 материали', gear: '🚜 техника', exec: '👷 изпълнение' };
export const CSS = `
.ch-top { border:1px solid #b45cff55; background:linear-gradient(90deg,#b45cff1f,#2f8cff14); border-radius:12px; padding:10px 12px; margin:0 0 10px; }
.ch-top b.t { font-size:16px; } .ch-top .ln { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:13px; color:var(--mut,#9aa3b5); margin-top:4px; } .ch-top .ln b { color:var(--txt,#eef1f6); }
.ch-bar { height:7px; background:#ffffff14; border-radius:5px; overflow:hidden; margin-top:6px; } .ch-bar i { display:block; height:100%; background:linear-gradient(90deg,#b45cff,#2f8cff); }
.ch-req { font-size:13px; margin:3px 0; } .ch-req .y { color:var(--ok,#4cd07d); } .ch-req .n { color:var(--mut,#9aa3b5); }
.ch-p { border:1px solid var(--line,#ffffff1f); border-radius:11px; padding:10px 12px; margin:8px 0; background:#ffffff08; }
.ch-p .g { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:6px 0; } .ch-p .g > div { background:#0003; border-radius:8px; padding:6px 8px; font-size:13px; }
.ch-cer { text-align:center; padding:14px 8px; } .ch-cer .big { font-size:56px; line-height:1; } .ch-cer h2 { margin:8px 0 4px; }
@media (max-width:560px) { .ch-p .g { grid-template-columns:1fr; } }`;

// горната лента на прозореца на партньорството
export function headerHtml(h, o = {}) {
  const L = levelOf(h), c = check(h), nx = c.nx, f = o.fmt, tr = trustNow(h);
  const prog = nx ? Math.min(1, ((h.xp || 0) - (h.xpAt || 0)) / Math.max(1, nx.xp - (h.xpAt || 0))) : 1;
  const goal = nx ? (!c.ach.ok ? nx.ach.txt : !c.both.ok ? 'принос и от двамата (поне 15% всеки)' : !c.xp.ok ? `още ${f ? f(nx.xp - h.xp) : nx.xp - h.xp} опит` : 'готово — вдигнете нивото!') : 'всички нива са взети';
  return `<div class="ch-top"><b class="t">🏛️ ${esc(h.name || 'Холдинг')} — Холдинг, ниво ${L.n} ${L.ico} ${esc(L.nm)}</b>
    <div class="ln"><span>Следващо: <b>${nx ? `${nx.ico} ${esc(nx.nm)}` : '—'}</b></span><span>Общ опит: <b>${f ? f(h.xp || 0) : h.xp || 0}${nx ? ` / ${f ? f(nx.xp) : nx.xp}` : ''}</b></span>
      <span>Свободни: <b>${eur(h.free || 0, f)}</b></span><span>Резервирани: <b>${eur(h.reserved || 0, f)}</b></span>${tr < 100 ? `<span style="color:var(--bad,#ff6b6b)">Доверие: <b>${tr}%</b></span>` : ''}</div>
    <div class="ch-bar"><i style="width:${Math.round(prog * 100)}%"></i></div>
    <div class="ln"><span>Следваща обща цел: <b>${esc(goal)}</b></span></div></div>`;
}
// трите условия — за раздела „Обзор“
export function reqHtml(h, o = {}) {
  const c = check(h), f = o.fmt; if (c.max) return '<div class="ch-req y">👑 Най-високото ниво — нищо не се губи.</div>';
  const ln = (ok, t) => `<div class="ch-req"><span class="${ok ? 'y' : 'n'}">${ok ? '✅' : '⬜'}</span> ${t}</div>`;
  return ln(c.xp.ok, `Опит ${f ? f(c.xp.have) : c.xp.have} / ${f ? f(c.xp.need) : c.xp.need} (само от общи проекти, доставки и концесии — преводите не дават опит)`)
    + ln(c.ach.ok, `Постижение: ${esc(c.ach.txt)} (${c.ach.have}/${c.ach.need})`)
    + ln(c.both.ok, `Принос и от двамата: ${esc(o.me || 'ти')} ${pct(c.both.meP)} · ${esc(o.them || 'партньорът')} ${pct(c.both.themP)} (поне ${pct(MIN_SHARE)} всеки)`)
    + `<div class="ch-req" style="color:var(--mut,#9aa3b5)">Отключва: ${c.nx.perks.map(esc).join(', ')} · в общата централа: ${esc(c.nx.hq)}</div>`;
}
// общ проект: кой какво дава, бюджет, срок, дял; двамата приемат → резервирано
export function projectHtml(p, o = {}) {
  const f = o.fmt, days = Math.max(0, Math.ceil(((p.deadline || 0) - (o.now || Date.now())) / DAY));
  const col = who => (p.gives?.[who] || []).map(g => `<div>${KIND[g.k] || g.k}: <b>${g.txt ? esc(g.txt) : eur(g.v, f)}</b></div>`).join('') || '<div class="n">—</div>';
  const st = p.status === 'proposed' ? `${p.ok?.me ? '✅ ти прие' : '⏳ чака теб'} · ${p.ok?.them ? '✅ партньорът прие' : '⏳ чака партньора'}` : p.status === 'active' ? `🔒 резервирано ${eur(p.reserved || p.budget, f)} · в ход` : p.status === 'done' ? '🏁 завършен' : '❌ провален';
  return `<div class="ch-p"><b>${esc(p.title)}</b> <span style="color:var(--mut,#9aa3b5);font-size:13px">· бюджет ${eur(p.budget, f)} · срок ${days} дни · печалба ${p.split?.[0] ?? 50}% / ${p.split?.[1] ?? 50}%</span>
    <div class="g"><div><b>${esc(o.me || 'Ти')} дава</b>${col('me')}</div><div><b>${esc(o.them || 'Партньорът')} дава</b>${col('them')}</div></div>
    <div style="font-size:13px">${st}</div>${p.status === 'proposed' && !p.ok?.me && o.act ? `<div class="row"><button class="btn" data-c="hproj:${p.id}:ok">✅ Приемам — резервирай моя дял</button><button class="btn2" data-c="hproj:${p.id}:no">✖ Отказ</button></div>` : ''}</div>`;
}
// церемонията при ново ниво (в борда)
export function ceremonyHtml(L, name) {
  return `<div class="ch-cer"><div class="big">${L.ico}</div><h2>🏛️ ${esc(name || 'Холдинг')} — ниво ${L.n}</h2><div><b>${esc(L.nm)}</b></div>
    <div style="color:var(--mut,#9aa3b5);margin-top:6px">Отключено: ${L.perks.map(esc).join(', ')}<br>В общата централа се появи: ${esc(L.hq)}</div></div>`;
}
