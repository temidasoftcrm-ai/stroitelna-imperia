// usage.js — 📊 анонимна статистика за ползването (флаг 'usage-stats', f6). САМО със съгласие 'analytics' (consent.js): без него нищо не се записва.
// Праща към Supabase public.report_usage (миграция usage_events) на 60 s и при скриване на таба (fetch keepalive); не от localhost —
// там (Лабораторията) събитията остават в буфера (демото го показва). id — анонимният от errtelem.js (localStorage 'stroi-errtel-id'), не акаунтът.
// Без лични данни: без имена на фирми, без имейли — само събитие, ключ, число и контекст (игрален ден, ниво, град).
// Събития (позволеният списък е и в миграцията):
//   session  — k: графиката, n: кадри/с след ~15 s          play_min — n: 10 / 30 / 60 / 120 минути игра в сесията
//   level    — n: достигнатото ниво                           city     — k: градът, n: 1 нов / 0 вече твой
//   open     — k: функцията (cinema, board, president, campaign, coop, online, bank, bank:<таб>, големите прозорци)
//   tut      — k: step / skip / done (урокът и onboarding)    ad — k: next:<статус> / reward:<статус>
//   away     — k: shown / doubled, n: игрални дни            music — плъзгачът на музиката на 0
//   import { createUsage } from './usage.js';  const usage = createUsage({ ctx: () => ({ day, lv, city }), gfx: () => 'mid', mix: () => ({ music }), tut: () => ({ step, off }) });
//   usage.track(ev, k, n)  ·  usage.open(k)  ·  usage.buffer()  ·  usage.flush()
import { anonId } from './errtelem.js';

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname), EVENTS = new Set(['session', 'play_min', 'level', 'city', 'open', 'tut', 'ad', 'away', 'music']);
const MAX_BUF = 200, PLAY = [10, 30, 60, 120];
const ok = () => !!window.consent?.has?.('analytics');
const s40 = v => v == null ? null : String(v).replace(/[\u0000-\u001f]/g, '').slice(0, 40);

export function createUsage(deps) {
  let buf = [], sent = 0, rest = null, ver = '?', lastOpen = {}, playSec = 0, playIdx = 0;
  import('./cloud.js').then(m => { ver = m.VERSION || '?'; rest = m.SB_REST || null; }).catch(() => { });
  const rec = () => ok() || LOCAL;   // Лабораторията/localhost — само буфер (за демото), никога не се праща

  function track(ev, k = null, n = null) {
    if (!EVENTS.has(ev) || !rec()) return null;
    let c = {}; try { c = deps.ctx?.() || {}; } catch { }
    const e = { ev, k: s40(k), n: Number.isFinite(+n) && n != null ? Math.round(+n) : null, day: +c.day | 0, lv: +c.lv | 0, city: /^[\w:-]{1,40}$/.test(c.city || '') ? c.city : null, t: Date.now() };
    buf.push(e); if (buf.length > MAX_BUF) buf.splice(0, buf.length - MAX_BUF);
    return e;
  }
  // отваряне на функция: едно и също повторено до 30 s — едно събитие
  function open(k) { const t = Date.now(); if (lastOpen[k] && t - lastOpen[k] < 30e3) return null; lastOpen[k] = t; return track('open', k); }

  function flush() {
    if (!buf.length || !ok() || LOCAL || !rest) return { sent: 0, reason: !ok() ? 'no-consent' : LOCAL ? 'local' : !rest ? 'no-cloud' : 'empty' };
    const batch = buf.splice(0, 50).map(({ t, ...e }) => e);
    try { fetch(rest.url + '/rest/v1/rpc/report_usage', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: rest.key, Authorization: 'Bearer ' + rest.key }, body: JSON.stringify({ p_anon: anonId(), p: { v: ver, ev: batch } }) }).catch(() => { }); } catch { }
    sent += batch.length; return { sent: batch.length };
  }
  setInterval(flush, 60e3);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  // ── сесията: графиката и кадрите/с след ~15 s ──
  { let fr = 0, t0 = 0; const cnt = t => { if (!t0) t0 = t; fr++; if (t - t0 < 15000) requestAnimationFrame(cnt); else track('session', deps.gfx?.() || null, Math.round(fr * 1000 / (t - t0))); };
    setTimeout(() => requestAnimationFrame(cnt), 5000); }

  // ── минутите игра (видим таб) и тихите наблюдатели: урокът, музиката, отворените прозорци ──
  let tut0 = null, mus0 = null, bankTab0 = null;
  setInterval(() => {
    if (!document.hidden && deps.playing?.() !== false) { playSec += 5; if (playIdx < PLAY.length && playSec >= PLAY[playIdx] * 60) track('play_min', null, PLAY[playIdx++]); }
    try { const t = deps.tut?.(); if (t) { const key = t.off ? 'skip' : t.done ? 'done' : 'step:' + t.step; if (tut0 !== null && key !== tut0) track('tut', t.off ? 'skip' : t.done ? 'done' : 'step', t.step); tut0 = key; } } catch { }
    try { const m = deps.mix?.(); if (m) { const z = +m.music === 0; if (mus0 === false && z) track('music', 'off', 0); mus0 = z; } } catch { }
    try { if (document.getElementById('bigWin') && deps.bigWin?.() === 'bank') { const bt = localStorage.getItem('stroi-bank-tab') || 'money'; if (bt !== bankTab0) { bankTab0 = bt; open('bank:' + bt); } } else bankTab0 = null; } catch { }
  }, 5000);
  // прозорците, които модулите сами създават: кино, съветът на директорите, президентът, кампаниите
  const IDS = { cine: 'cinema', boardRoom: 'board', pres: 'president', camp: 'campaign' };
  new MutationObserver(ms => { for (const m of ms) for (const el of m.addedNodes) if (el.id && IDS[el.id]) open(IDS[el.id]); }).observe(document.body, { childList: true });
  // бутоните: онлайн империята, партньорството
  addEventListener('click', e => { const b = e.target?.closest?.('#onlineBtn,#coopBtn'); if (b) open(b.id === 'onlineBtn' ? 'online' : 'coop'); }, true);

  return { track, open, flush, buffer: () => buf.map(e => ({ ...e })), stats: () => ({ on: rec(), consent: ok(), local: LOCAL, sent, buffered: buf.length, playMin: Math.floor(playSec / 60) }) };
}
