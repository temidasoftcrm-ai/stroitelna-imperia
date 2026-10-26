// i18n.js — 🌐 езикът на играта (флаг 'lang-en', f6): български (по подразбиране — самият текст в кода) и английски (assets/i18n/en.json).
// Изборът: localStorage 'stroi-lang' ('bg' | 'en'); без него — по браузъра: bg → БГ, всичко друго → EN. Смяна — setLang() (презарежда).
// Преводът — без пренаписване на кода наведнъж:
//   • t('български текст', { n: 5 } | [5]) — в кода; ключът е българският текст ({0}/{name} — параметрите); на БГ връща текста;
//   • автоматично (само на EN): MutationObserver превежда текстовите възли и атрибутите title/placeholder/aria-label по речника —
//     точните текстове и моделите от шаблоните (`Ден ${d}` → ключ „Ден {0}“ → „Day {0}“; стойностите в {…} се превеждат, ако и те са в речника);
//     <… data-noi18n> — без превод (имената на играчите, въведен текст); input/textarea/script/style — никога;
//   • платното (3D надписите) — game.js label() вика t().
// Ключовете и преводите: node i18n-extract.mjs [файл] → assets/i18n/en/<файл>.json; node i18n-extract.mjs --build → assets/i18n/en.json.
// Числа, пари, дати — по езика: fmtNum, fmtMoney, fmtDate (Intl).
import { feature } from './lab/feature.js';

const KEY = 'stroi-lang';
function detect() {
  if (!feature('lang-en')) return 'bg';
  const q = (location.search.match(/[?&]lang=(bg|en)\b/) || [])[1]; if (q) return q;   // ?lang=en — за тестовете и Лабораторията
  let l = null; try { l = localStorage.getItem(KEY); } catch { }
  if (l === 'bg' || l === 'en') return l;
  return /^bg\b/i.test(navigator.language || '') ? 'bg' : 'en';
}
export const LANG = detect(), EN = LANG === 'en', LOCALE = EN ? 'en-GB' : 'bg-BG';
document.documentElement.lang = LANG;
export function setLang(l) { try { localStorage.setItem(KEY, l); } catch { } location.reload(); }

// ── речникът ──
let DICT = new Map(), PAT = new Map();   // PAT: префикс (до първия {…}) → [{ re, out, ids }]
if (EN) {
  try { const r = await fetch(new URL('./assets/i18n/en.json', import.meta.url)); if (r.ok) DICT = new Map(Object.entries(await r.json())); } catch (e) { console.warn('i18n', e); }
  for (const [k, v] of DICT) { if (!/\{\w+\}/.test(k)) continue;
    { const c = k.replace(/\{\w+\}/g, '').replace(/[^А-Яа-яЁё]/g, '').length; if (c > 0 && c < 3) continue; }   // „{0} в {1}“ — кратка кирилица в литерала би хващала всяко „в“; без кирилица („🏠 {0}“, „{0} — {1}“) — безопасно
    const ids = [], parts = k.split(/\{(\w+)\}/), esc = t => t.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
    const lits = parts.map((t, i) => i % 2 ? null : esc(t).replace(/\s+/g, '\\s+')), L = parts.length - 1;
    if (L >= 2 && parts[L] === '') lits[L - 2] = lits[L - 2].replace(/\\s\+$/, '\\s*');   // ключът свършва с {…}: интервалът преди него — по желание (възелът свършва преди линка)
    if (L >= 2 && parts[0] === '') lits[2] = lits[2].replace(/^\\s\+/, '\\s*');   // започва с {…}: интервалът след него — по желание
    let src = '^';
    for (let i = 0; i <= L; i++) { if (i % 2) { ids.push(parts[i]); src += '([\\s\\S]*?)'; } else src += lits[i]; }
    const re = new RegExp(src + '$'), pre = k.slice(0, k.search(/\{\w+\}/)).slice(0, 6);
    (PAT.get(pre) || PAT.set(pre, []).get(pre)).push({ re, out: v, ids, w: k.replace(/\{\w+\}/g, '').length }); }
  for (const L of PAT.values()) L.sort((a, b) => b.w - a.w);   // по-специфичните (по-дълъг литерал) — първи
}
const PRE_LENS = EN ? [...new Set([...PAT.keys()].map(p => p.length))].sort((a, b) => b - a) : [];
const miss = new Map();   // непреведените (на EN) — за Лабораторията: window.__i18nMissing()
// стойността в {…}: точно, после без значение от главните букви (СОФИЯ → София → Sofia → SOFIA)
function trVal(g) { const k = g.trim(); let v = DICT.get(k); if (v !== undefined) return g.replace(k, v);
  if (CYR.test(k) && k === k.toUpperCase() && k !== k.toLowerCase()) { const c = k.toLowerCase().replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toUpperCase()); v = DICT.get(c) ?? DICT.get(k[0] + k.slice(1).toLowerCase()); if (v !== undefined) return g.replace(k, v.toUpperCase()); }
  return g; }
function look1(s) {
  const d = DICT.get(s); if (d !== undefined) return d;
  for (const L of PRE_LENS) { const c = PAT.get(s.slice(0, L)); if (!c) continue;
    for (const p of c) { const m = p.re.exec(s); if (!m) continue; const val = {}; p.ids.forEach((id, i) => { const g = m[i + 1]; val[id] = trVal(g); }); return p.out.replace(/\{(\w+)\}/g, (x, id) => val[id] ?? x); } }
  return undefined;
}
// резервно: сглобен текст без свой ключ („{0} 🔒“, „{0} — {1}“, „🚚 Самосвал ✓“, „1. Изкоп“) — по части между разделителите;
// само ако ВСИЧКИ кирилски части се преведат (иначе остава на български — без смесица)
const SEP = /(\s+[—·|→]\s+|:\s+|\s*[✓✔✖🔒⏳]\s*|\s{2,})/;
function part(x) {
  const k = x.trim(); if (!k || !CYR.test(k)) return x;
  let v = look1(k); if (v !== undefined) return x.replace(k, v);
  const m = /^([^\p{L}\p{N}„"“(«]+|\d+[.)]\s+)(\S[\s\S]*)$/u.exec(k);   // водещо емоджи / номер
  if (m && m[1]) { v = look1(m[2]) ?? trVal(m[2]); if (v !== m[2] && v !== undefined && !CYR.test(v)) return x.replace(k, m[1] + v); }
  v = trVal(k); return v !== k && !CYR.test(v) ? x.replace(k, v) : undefined;
}
function look(s) {
  const v = look1(s); if (v !== undefined) return v;
  const P = s.split(SEP); if (P.length < 2 && !/^[^\p{L}]/u.test(s)) return undefined;
  const out = []; for (const x of P) { const y = SEP.test(x) && x.trim().length <= 2 ? x : part(x); if (y === undefined) return undefined; out.push(y); }
  const r = out.join(''); return r !== s ? r : undefined;
}
const CYR = /[А-Яа-яЁё]/;
export function t(s, p) {
  let r = s;
  if (EN && s && CYR.test(s)) { const v = look(s.trim()); if (v !== undefined) r = s.replace(s.trim(), v); else if (miss.size < 5000) miss.set(s.trim(), (miss.get(s.trim()) || 0) + 1); }
  if (p != null) r = r.replace(/\{(\w+)\}/g, (m, k) => (Array.isArray(p) ? p[+k] : p[k]) ?? m);
  return r;
}
window.__i18n = { look: x => look(x), t: (x, p) => t(x, p), has: x => has(x) };   // тестовете и конзолата
window.__i18nMissing = () => [...miss.entries()].sort((a, b) => b[1] - a[1]);

// ── числа, пари, дати ──
const NF = {}; const nf = d => NF[d] ||= new Intl.NumberFormat(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const fmtNum = (n, d = 0) => nf(d).format(n || 0).replace(/ | /g, ' ');
export const fmtMoney = n => EN ? (n < 0 ? '−€' : '€') + fmtNum(Math.abs(Math.round(n || 0))) : fmtNum(Math.round(n || 0)) + ' €';
export const fmtDate = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Intl.DateTimeFormat(LOCALE, o).format(d instanceof Date ? d : new Date(d));

// ── автоматичният превод на страницата (само EN) ──
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']), ATTRS = ['title', 'placeholder', 'aria-label'], done = new WeakMap();
const skipEl = el => { for (let e = el; e; e = e.parentElement) { if (SKIP.has(e.tagName) || e.isContentEditable || (e.dataset && 'noi18n' in e.dataset)) return true; } return false; };
function trText(n) {
  const s = n.nodeValue; if (!s || !CYR.test(s) || done.get(n) === s) return;
  if (skipEl(n.parentElement)) return;
  const k = s.trim(), v = look(k); if (v === undefined) { if (miss.size < 5000) miss.set(k, (miss.get(k) || 0) + 1); done.set(n, s); return; }
  const out = s.replace(k, v); done.set(n, out); n.nodeValue = out;
}
const FIELD = el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA', skipAttr = el => FIELD(el) ? skipEl(el.parentElement) : skipEl(el);   // полетата: текст в тях не се пипа, но подсказката (placeholder) — да
function trAttrs(el) { for (const a of ATTRS) { const s = el.getAttribute && el.getAttribute(a); if (s && CYR.test(s)) { const v = look(s.trim()); if (v !== undefined) el.setAttribute(a, v); } } }
function trTree(root) {
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1) return; if (skipEl(root)) { if (FIELD(root) && !skipAttr(root)) trAttrs(root); return; }
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
  while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else if (!SKIP.has(n.tagName) || FIELD(n)) trAttrs(n); }
}
if (EN) {
  const go = () => { trTree(document.body); if (CYR.test(document.title)) document.title = t(document.title);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') trText(m.target); else if (m.type === 'attributes') { if (m.target.nodeType === 1 && !skipAttr(m.target)) trAttrs(m.target); } else for (const x of m.addedNodes) trTree(x); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
}

// ── превключвателят 🌐 (⚙️ Настройки, началният екран): бутон, който сменя езика ──
export function langButton(cls = 'btn2') {
  const b = document.createElement('button'); b.className = cls; b.dataset.noi18n = '';
  b.textContent = EN ? '🌐 BG' : '🌐 EN'; b.title = EN ? 'Превключи на български' : 'Switch to English';
  b.onclick = () => setLang(EN ? 'bg' : 'en'); return b;
}
export const langOn = () => feature('lang-en');
export const has = s => !EN || DICT.has(String(s).trim()) || look(String(s).trim()) !== undefined;   // има ли превод (на БГ — винаги)
// началният екран (зареждането): малък бутон 🌐 в ъгъла
if (langOn()) { const put = () => { const ld = document.getElementById('loading'); if (!ld || ld.querySelector('.ldLang')) return; const b = langButton(); b.classList.add('ldLang'); b.style.cssText = 'position:absolute;top:12px;right:12px;z-index:5;padding:6px 10px;border-radius:9px;border:1px solid #3a4560;background:#0f141cdd;color:#e6edf6;font:600 14px system-ui,sans-serif;cursor:pointer'; ld.appendChild(b); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', put); else put(); }
