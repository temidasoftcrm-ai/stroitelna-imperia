// consent.js — 🍪 GDPR съгласие (feature 'consent'): банер при първо пускане (Приемам / Само необходимите / Настройки),
// изборът се пази в localStorage 'stroi-consent' = { v, ads, analytics, ts }. Необходимите (записите, входа, облака) не питат.
// API за бъдещите реклами и аналитика: window.consent.has('ads' | 'analytics') → true само при изрично „да“;
// при промяна — събитие 'stroi-consent' на window (detail = изборът). window.consent.open() — настройките (⚙️ Настройки → 🔒 Поверителност).
import { feature } from './lab/feature.js';
import { ADS_LIVE, adsConsent } from './ads.js';   // 📺 с истинските реклами съгласието за тях е на Google CMP — тук остава само статистиката

const KEY = 'stroi-consent', V = 1;
const ON = feature('consent');
const AUTOTEST = /[?&]autotest/.test(location.search);
const KINDS0 = [
  ['ads', '📺 Реклами', 'Показване на реклами (за да е играта безплатна). Без съгласие — рекламите, ако има, не са персонализирани.'],
  ['analytics', '📊 Анонимна статистика', 'Колко хора играят и къде играта се бави — без бисквитки и без да се знае кой си.'],
];
const KINDS = ADS_LIVE ? KINDS0.filter(k => k[0] !== 'ads') : KINDS0;
const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.v === V ? c : null; } catch { return null; } };
function save(c) {
  const v = { v: V, ads: !!c.ads, analytics: !!c.analytics, ts: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { }
  window.dispatchEvent(new CustomEvent('stroi-consent', { detail: v }));
  return v;
}
const links = () => `<a href="privacy.html" target="_blank" rel="noopener" style="color:#ffd54a">Поверителност</a> · <a href="terms.html" target="_blank" rel="noopener" style="color:#ffd54a">Условия</a>`;
const BTN = 'padding:9px 14px;border-radius:10px;font:700 14px system-ui,sans-serif;cursor:pointer;border:1px solid #3a4560;background:#1b2433;color:#e6edf6';
const BTN1 = 'padding:9px 14px;border-radius:10px;font:800 14px system-ui,sans-serif;cursor:pointer;border:0;background:#f5b942;color:#111';

// банерът — долу, над всичко (и над екрана за вход); не блокира играта
function banner() {
  document.getElementById('consentBar')?.remove();
  const el = document.createElement('div'); el.id = 'consentBar'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Поверителност');
  el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:10001;width:min(640px,calc(100% - 32px));box-sizing:border-box;background:#0c1018;border:1px solid #c9a14a;border-radius:14px;padding:14px 16px;color:#e6edf6;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px #000';
  el.innerHTML = `<div style="font-weight:800;color:#ffd54a;margin-bottom:4px">🔒 Поверителност</div>
    <div style="color:#a9b6c8">Играта пази записите ти на това устройство (и в облака, ако влезеш). ${ADS_LIVE ? 'С твое съгласие може да брои анонимно колко хора играят (за рекламите питаме отделно).' : 'С твое съгласие може да показва реклами и да брои анонимно колко хора играят.'} Можеш да промениш избора си по всяко време в ⚙️ Настройки. ${links()}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:10px">
      <button id="cnSet" style="${BTN}">⚙️ Настройки</button><button id="cnMin" style="${BTN}">Само необходимите</button><button id="cnAll" style="${BTN1}">✅ Приемам</button></div>`;
  document.body.appendChild(el);
  el.querySelector('#cnAll').onclick = () => { save({ ads: true, analytics: true }); el.remove(); };
  el.querySelector('#cnMin').onclick = () => { save({ ads: false, analytics: false }); el.remove(); };
  el.querySelector('#cnSet').onclick = () => { el.remove(); open(); };
  return el;
}
// подробните настройки — по една отметка; „Необходими“ са винаги включени
function open() {
  document.getElementById('consentDlg')?.remove();
  const c = read() || { ads: false, analytics: false };
  const el = document.createElement('div'); el.id = 'consentDlg';
  el.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.5 system-ui,sans-serif';
  const row = (id, t, d, on, dis) => `<label style="display:flex;gap:10px;align-items:flex-start;border:1px solid #2a3446;border-radius:10px;padding:9px 11px;cursor:${dis ? 'default' : 'pointer'}">
    <input type="checkbox" ${id ? `id="cn_${id}"` : ''} ${on ? 'checked' : ''} ${dis ? 'disabled' : ''} style="margin-top:3px;width:18px;height:18px;flex:none"><span><b>${t}</b><br><span style="color:#8b96a8;font-size:13px">${d}</span></span></label>`;
  el.innerHTML = `<div style="background:#0c1018;border:1px solid #c9a14a;border-radius:16px;padding:18px;width:min(460px,100%);color:#e6edf6;display:flex;flex-direction:column;gap:8px;max-height:92vh;overflow:auto">
    <div style="font-weight:800;font-size:18px;color:#ffd54a">🔒 Поверителност</div>
    ${row('', '🔧 Необходими', 'Записите на играта, входът и облакът (ако влезеш), този избор. Без тях играта не работи.', true, true)}
    ${KINDS.map(([id, t, d]) => row(id, t, d, c[id])).join('')}
    ${ADS_LIVE ? `<button id="cnAds" style="${BTN};text-align:left">📺 Реклами — настройки за съгласие (Google)</button>` : ''}
    <div style="font-size:13px;color:#8b96a8">${links()}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button id="cnNo" style="${BTN}">Само необходимите</button><button id="cnOk" style="${BTN1}">💾 Запази</button></div></div>`;
  document.body.appendChild(el);
  el.onclick = e => { if (e.target === el) el.remove(); };
  const ad = el.querySelector('#cnAds'); if (ad) ad.onclick = () => { el.remove(); adsOpen(); };
  el.querySelector('#cnNo').onclick = () => { save({ ads: false, analytics: false }); el.remove(); };
  el.querySelector('#cnOk').onclick = () => { save(Object.fromEntries(KINDS.map(([id]) => [id, el.querySelector('#cn_' + id).checked]))); el.remove(); };
  return el;
}

// Google CMP: ако скриптът му не е зареден (блокер на реклами) — казваме го, вместо да не става нищо
function adsOpen() {
  if (adsConsent()) return;
  setTimeout(() => { if (typeof window.googlefc?.showRevocationMessage === 'function') return;
    const t = document.createElement('div'); t.className = 'toast bad'; t.textContent = '📺 Настройките за реклами не се отвориха — Google още не ги е заредил или рекламите са спрени в браузъра (блокер).';
    const box = document.getElementById('toasts'); if (box) { box.prepend(t); setTimeout(() => t.remove(), 6000); } }, 3000);
}
// без флага — няма банер, а has() е false (нищо незадължително не се пуска)
window.consent = {
  has: k => ON && !!read()?.[k],
  get: read,
  open: () => ON ? open() : null,
  banner: () => ON ? banner() : null,
  adsLive: ADS_LIVE, adsOpen: () => ADS_LIVE ? adsOpen() : null,   // ⚙️ Поверителност (cloud.js)
};
if (ON && !AUTOTEST && !read()) { if (document.body) banner(); else addEventListener('DOMContentLoaded', banner); }
