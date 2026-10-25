// ads.js — 📺 реклами с Google AdSense за игри (H5 Games Ads, Ad Placement API: adsbygoogle.js + adBreak/adConfig). Флаг 'ads'.
// Включва се само при feature('ads') && ADS_CLIENT (config.js; празен = изключено, нищо не се зарежда) && !autotest && компютър.
// Локално и в Лабораторията — data-adbreak-test="on" (тестови реклами). В Лабораторията без ID — вграден симулатор (сива „ТЕСТОВА РЕКЛАМА“),
// за да се види целият път: пауза на играта и звука → реклама → връщане; наградата.
// Съгласие: с Google — неговият CMP (GDPR съобщението в AdSense, TCF) решава персонализацията; само симулаторът гледа consent.has('ads').
// Места (game.js): next('city') при смяна на град, next('level') при ново ниво — изпълнява се, когато няма кино/диалог/урок;
// най-много веднъж на 5 мин и не през първите 10 мин. Наградата: бутон „🎬 Реклама за бонус“ — само когато adBreak каже, че има такава (beforeReward);
// най-много 3 пъти на ден (localStorage 'stroi-ads').
import { feature, IN_LAB } from './lab/feature.js';
import { ADS_CLIENT } from './config.js';
import { isTouchDevice } from './perfmeter.js';

const GAP = 5 * 60e3, WARM = 10 * 60e3, REWARD_MAX = 3, KEY = 'stroi-ads';
const LOCAL = IN_LAB || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const pub = String(ADS_CLIENT || '').trim().replace(/^ca-/, ''), CLIENT = /^pub-\d{10,20}$/.test(pub) ? 'ca-' + pub : '';
const SIM = IN_LAB && !CLIENT;   // Лабораторията без ID — симулатор вместо Google
const AUTOTEST = /[?&]autotest/.test(location.search);
// истинските реклами на Google ще се заредят (createAds) — тогава съгласието за тях е на Google CMP (GDPR съобщението в AdSense, IAB TCF), не на нашия банер (consent.js)
export const ADS_LIVE = feature('ads') && !!CLIENT && (!AUTOTEST || IN_LAB) && !isTouchDevice();
// ⚙️ Поверителност → „Реклами — настройки за съгласие“: съобщението на Google CMP наново; false — скриптът на Google не е зареден (блокер)
export function adsConsent() {
  window.googlefc = window.googlefc || {}; window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push({ CONSENT_DATA_READY: () => window.googlefc.showRevocationMessage() });
  return typeof window.googlefc.showRevocationMessage === 'function';
}

export function createAds(deps) {
  const off = { next() { }, state: () => ({ on: false }) };
  if (!feature('ads') || (!CLIENT && !SIM) || (AUTOTEST && !IN_LAB) || isTouchDevice()) return off;
  let armed = !AUTOTEST;   // Лабораторията (там играта е с autotest): нищо не тръгва само — само от демото (skipWait)
  let t0 = Date.now(), last = -Infinity, pend = null, adOn = false, ready = false, rewardBtn = null, rewardFn = null, asking = false;
  const now = () => Date.now();
  const day = () => new Date().toISOString().slice(0, 10);
  const got = () => { try { const o = JSON.parse(localStorage.getItem(KEY)) || {}; return o.d === day() ? o.n | 0 : 0; } catch { return 0; } };
  const gotInc = () => { try { localStorage.setItem(KEY, JSON.stringify({ d: day(), n: got() + 1 })); } catch { } };

  // ── зареждане ──
  window.adsbygoogle = window.adsbygoogle || [];
  const push = o => { try { window.adsbygoogle.push(o); } catch (e) { console.warn('ads', e); } };
  if (SIM && !window.consent?.has('ads')) window.adsbygoogle.requestNonPersonalizedAds = 1;   // с Google — решава CMP (TCF), не ръчно
  if (SIM) simulator();
  else {
    const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + CLIENT;
    s.dataset.adClient = CLIENT; s.dataset.adFrequencyHint = '300s'; if (LOCAL) s.dataset.adbreakTest = 'on';
    s.onerror = () => { ready = false; };   // блокер на реклами — тихо без реклами
    document.head.appendChild(s);
  }
  push({ preloadAdBreaks: 'on', sound: 'on', onReady: () => { ready = true; } });

  // ── пауза на играта и звука ──
  // всички <audio> (и тези, създадени с new Audio() извън DOM) минават през play() — помним ги, за да ги спрем и пуснем пак
  const media = new Set(), held = new Set(), play0 = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { media.add(this); if (adOn) { held.add(this); return Promise.resolve(); } return play0.call(this); };
  let sp = 1;
  const pause = () => {
    adOn = true; sp = deps.speed(); deps.setSpeed(0);
    try { deps.audioCtx()?.suspend(); } catch { }
    for (const a of media) if (!a.paused) { held.add(a); a.pause(); }
  };
  const resume = () => {
    adOn = false; deps.setSpeed(sp || 1);
    try { deps.audioCtx()?.resume(); } catch { }
    for (const a of held) play0.call(a).catch(() => { }); held.clear();
  };

  // ── „next“: на пауза между нещата, когато играчът не е зает ──
  function next(name) { if (!pend || name === 'level') pend = { name, at: now() }; }
  const free = () => !adOn && !document.hidden && !deps.busy();
  function fire() {
    if (!armed) return;
    if (!pend || now() - pend.at > 120e3) { pend = null; return; }   // поводът е отминал
    if (now() - t0 < WARM || now() - last < GAP || !free()) return;
    const name = pend.name; pend = null; last = now();
    push({ type: 'next', name: 'stroi-' + name, beforeAd: pause, afterAd: resume, adBreakDone: info => { if (adOn) resume(); deps.log?.('next', info?.breakStatus); } });
  }

  // ── наградата: питаме Google дали има реклама с награда; бутонът е само докато има ──
  function hideBtn() { rewardBtn?.remove(); rewardBtn = null; rewardFn = null; }
  function askReward() {
    if (!armed || asking || rewardFn || got() >= REWARD_MAX || !free() || now() - t0 < 60e3) return;
    asking = true;
    push({ type: 'reward', name: 'stroi-bonus', beforeAd: pause, afterAd: resume,
      beforeReward: show => { rewardFn = show; showBtn(); },
      adDismissed: () => { deps.toast?.('🎬 Рекламата е спряна преди края — без бонус.', 'bad'); },
      adViewed: () => { gotInc(); const v = deps.reward(); deps.toast?.(`🎬 Благодарим! Бонус +${v.toLocaleString('bg-BG')} € (днес ${got()}/${REWARD_MAX})`); },
      adBreakDone: info => { asking = false; hideBtn(); if (adOn) resume(); deps.log?.('reward', info?.breakStatus); } });
  }
  function showBtn() {
    const top = document.getElementById('top'); if (!top || rewardBtn) return;
    rewardBtn = document.createElement('button'); rewardBtn.id = 'adReward'; rewardBtn.className = 'btn2';
    rewardBtn.textContent = '🎬 Реклама за бонус'; rewardBtn.title = `Гледай кратка реклама: +10% от дневния приход (до ${REWARD_MAX} пъти на ден)`;
    rewardBtn.onclick = () => { const f = rewardFn; rewardFn = null; rewardBtn?.remove(); rewardBtn = null; if (f && got() < REWARD_MAX) f(); };
    top.insertBefore(rewardBtn, top.querySelector('.sp'));
  }

  setInterval(() => { fire(); if (deps.reward) askReward(); }, 3000);

  // ── симулатор (само Лабораторията без ID): същият интерфейс като adsbygoogle — 3 с сив екран ──
  function simulator() {
    let busy = false;
    const q = window.adsbygoogle;
    const run = o => {
      if (o.onReady) { setTimeout(o.onReady, 300); return; }
      if (!o.type) return;
      if (busy) { o.adBreakDone?.({ breakStatus: 'frequencyCapped' }); return; }
      const show = () => {
        busy = true; o.beforeAd?.();
        const el = document.createElement('div'); el.id = 'adSim';
        el.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#2b2f36;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font:700 22px system-ui,sans-serif';
        el.innerHTML = `<div>📺 ТЕСТОВА РЕКЛАМА (${o.type === 'reward' ? 'с награда' : 'между нивата'})</div><div style="font-size:14px;color:#aab">симулатор — без Google · <span id="adSimT">3</span> с</div>${o.type === 'reward' ? '<button id="adSimX" style="padding:8px 14px;border-radius:9px">✕ Затвори без награда</button>' : ''}`;
        document.body.appendChild(el);
        let n = 3, cut = false; const tm = setInterval(() => { n--; const t = el.querySelector('#adSimT'); if (t) t.textContent = n; if (n <= 0) end(); }, 1000);
        const x = el.querySelector('#adSimX'); if (x) x.onclick = () => { cut = true; end(); };
        function end() { clearInterval(tm); el.remove(); busy = false; o.afterAd?.(); if (o.type === 'reward') (cut ? o.adDismissed : o.adViewed)?.(); o.adBreakDone?.({ breakStatus: cut ? 'dismissed' : 'viewed' }); }
      };
      if (o.type === 'reward') o.beforeReward?.(show); else show();
    };
    window.adsbygoogle = { push: run, requestNonPersonalizedAds: q.requestNonPersonalizedAds };
    q.forEach(run);
  }

  return { next, state: () => ({ on: true, sim: SIM, ready, pend: pend?.name || null, last, adOn, reward: !!rewardFn, today: got(), npa: !!window.adsbygoogle.requestNonPersonalizedAds }),
    skipWait: IN_LAB ? () => { armed = true; t0 = 0; last = -Infinity; } : undefined };   // Лабораторията: без 10-те минути и 5-те между рекламите
}
