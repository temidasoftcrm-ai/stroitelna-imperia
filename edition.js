// edition.js — изданието на играта. deploy.mjs --demo сменя реда с EDITION на 'demo' (сайтът: демо до ниво 5); пълната игра за компютър (desktop/) е 'full'.
// Локално демото се пробва с ?demo=1 (само на localhost).
export const EDITION = 'full';
export const DEMO = EDITION === 'demo' || (/[?&]demo=1\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
export const DEMO_LV = 5;
export const DESKTOP = false;   // deploy.mjs --desktop → true: без регистрация, записите и във файлове (Steam Cloud)
export const STORE_URL = '';   // страницата в Steam (празно, докато я няма — бутонът казва „Скоро в Steam“)

// пълната игра за компютър: профил не се иска; онлайн бутоните засега ги няма; записите се копират и във файлове (desktop/main.cjs → папка saves за Steam Cloud)
if (DESKTOP) {
  const st = document.createElement('style'); st.textContent = '#cloudBtn,#onlineBtn,#coopBtn{display:none!important}'; document.head.appendChild(st);
  if (window.__desktop) { const P = Storage.prototype, set = P.setItem, del = P.removeItem, RE = /^stroi-(save-v1(-s\d+)?|slot)$/;
    P.setItem = function (k, v) { set.call(this, k, v); if (this === localStorage && RE.test(k)) window.__desktop.put(k, String(v)); };
    P.removeItem = function (k) { del.call(this, k); if (this === localStorage && RE.test(k)) window.__desktop.del(k); }; }
}
