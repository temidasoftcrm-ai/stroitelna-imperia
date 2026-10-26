// i18n-extract.mjs — ключовете за превода (lang-en, f6): кирилските низове от кода → assets/i18n/en/<файл>.json { "български": "английски" }
//   node i18n-extract.mjs [файл.js …]     — само тези файлове (без аргументи — всички *.js и index.html/online.html в корена)
//   node i18n-extract.mjs --report         — само отчет: колко ключа има всеки файл и колко са преведени
//   node i18n-extract.mjs --build          — сглобява assets/i18n/en.json от всички assets/i18n/en/*.json (това зарежда играта)
// Ключът е сегмент от литерал: обикновен низ '…' / "…" или шаблон `…${израз}…` — изразите стават {0}, {1}… (номер в сегмента),
// HTML таговете делят сегментите (всеки текстов възел се превежда отделно), стойностите на title="…" / placeholder="…" — също отделни ключове.
// Преведените стойности се пазят при ново извличане; ключ, който вече го няма в кода — отива в „_stale“ (не се губи превод).
// Без кирилица — не е ключ. Коментарите се пропускат. Шаблоните в изразите (`…${a ? `<b>${n}</b> обекта` : '…'}…`) — извличат се отделно.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = new URL('.', import.meta.url).pathname, OUT = join(ROOT, 'assets/i18n/en'), CYR = /[А-Яа-яЁё]/;
const args = process.argv.slice(2), REPORT = args.includes('--report'), BUILD = args.includes('--build');
const pick = args.filter(a => !a.startsWith('--'));

// ── мини-лексер: литералите на JS (без коментарите и регулярните изрази) ──
function literals(src) {
  const out = []; let i = 0; const n = src.length;
  const prevSig = j => { while (j >= 0 && /\s/.test(src[j])) j--; return j >= 0 ? src[j] : ''; };
  function str(q) { let s = ''; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i] + src[i + 1]; i += 2; continue; } if (src[i] === '\n') break; s += src[i++]; } i++; return s; }
  function tpl() {   // връща { parts: [низ…], exprs: [израз…] }; вложените шаблони в изразите — рекурсивно в out
    const parts = [''], exprs = []; i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { parts[parts.length - 1] += src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { i += 2; const st = i; let d = 1;
        while (i < n && d > 0) { const c = src[i];
          if (c === '`') { const t = tpl(); out.push({ t: 'tpl', ...t }); continue; }
          if (c === "'" || c === '"') { const v = str(c); out.push({ t: 'str', v }); continue; }
          if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } i++; }
        exprs.push(src.slice(st, i)); i++; parts.push(''); continue; }
      parts[parts.length - 1] += src[i++];
    }
    i++; return { parts, exprs };
  }
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]|^$/.test(prevSig(i - 1))) {   // регулярен израз
      i++; let cls = false; while (i < n) { const ch = src[i]; if (ch === '\\') { i += 2; continue; } if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) break; else if (ch === '\n') break; i++; } i++; continue; }
    if (c === "'" || c === '"') { out.push({ t: 'str', v: str(c) }); continue; }
    if (c === '`') { out.push({ t: 'tpl', ...tpl() }); continue; }
    i++;
  }
  return out;
}
const unesc = s => s.replace(/\\n/g, '\n').replace(/\\(['"`\\$])/g, '$1').replace(/\\u\{?([0-9a-fA-F]+)\}?/g, (m, h) => String.fromCodePoint(parseInt(h, 16)));
// сегментите: текстът между HTML таговете (и стойностите на title/placeholder/aria-label); {k} — изразите, номерирани в сегмента
function segments(text) {
  const keys = [], ATTR = /\b(?:title|placeholder|aria-label|alt)\s*=\s*(["'])([\s\S]*?)\1/g;
  const tags = /<[^<>]*>/g; let last = 0, m;
  const pushSeg = s => { const norm = s.replace(/\s+/g, ' ').trim(); if (!CYR.test(norm) || /[#.\w-]+\s*\{[^}]*[\w-]+\s*:[^}]*[;}]/.test(norm) || /^\/\*[\s\S]*\*\/$/.test(norm)) return; let k = 0; keys.push(norm.replace(/\u0000(\d+)\u0000/g, () => `{${k++}}`)); };   // CSS и коментарите в него — не са текст
  while ((m = tags.exec(text))) { pushSeg(text.slice(last, m.index)); let a; while ((a = ATTR.exec(m[0]))) pushSeg(a[2]); last = m.index + m[0].length; }
  pushSeg(text.slice(last));
  return keys;
}
function keysOf(src, isHtml) {
  const K = new Set();
  if (isHtml) {   // HTML: текстът извън <script>/<style> + атрибутите; вградените скриптове — като JS
    const scripts = [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).join('\n');
    const body = src.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const k of segments(body)) K.add(k);
    src = scripts;
  }
  for (const L of literals(src)) {
    const text = L.t === 'str' ? unesc(L.v) : L.parts.map((p, j) => unesc(p) + (j < L.exprs.length ? `\u0000${j}\u0000` : '')).join('');
    if (!CYR.test(text)) continue;
    for (const k of segments(text)) K.add(k);
  }
  return [...K];
}

mkdirSync(OUT, { recursive: true });
if (BUILD) {
  const all = {}; let n = 0, tr = 0;
  for (const f of readdirSync(OUT).filter(f => f.endsWith('.json')).sort()) { const d = JSON.parse(readFileSync(join(OUT, f), 'utf8')); for (const [k, v] of Object.entries(d)) { if (k === '_stale' || !v) continue; if (!(k in all)) { all[k] = v; tr++; } } n++; }
  writeFileSync(join(ROOT, 'assets/i18n/en.json'), JSON.stringify(all));
  console.log(`assets/i18n/en.json: ${tr} превода от ${n} файла`);
  process.exit(0);
}
const files = pick.length ? pick : readdirSync(ROOT).filter(f => /\.(m?js)$/.test(f) || ['index.html', 'online.html'].includes(f)).filter(f => !/^(deploy|credits|stamp|labserver|i18n-extract)\.mjs$/.test(f));
const rows = [];
for (const f of files) {
  const src = readFileSync(join(ROOT, f), 'utf8'), keys = keysOf(src, f.endsWith('.html'));
  const dst = join(OUT, basename(f).replace(/\.(m?js|html)$/, '') + (f.endsWith('.html') ? '.html' : '') + '.json');
  const old = existsSync(dst) ? JSON.parse(readFileSync(dst, 'utf8')) : {}, stale = { ...(old._stale || {}) };
  const next = {}; for (const k of keys) next[k] = old[k] ?? stale[k] ?? '';
  for (const [k, v] of Object.entries(old)) if (k !== '_stale' && !(k in next) && v) stale[k] = v;
  for (const k of keys) delete stale[k];
  if (Object.keys(stale).length) next._stale = stale;
  const done = keys.filter(k => next[k]).length;
  rows.push([f, keys.length, done]);
  if (!REPORT && keys.length) writeFileSync(dst, JSON.stringify(next, null, 1) + '\n');
}
rows.sort((a, b) => b[1] - a[1]);
let K = 0, D = 0; for (const [f, k, d] of rows) { K += k; D += d; }
for (const [f, k, d] of rows) if (k) console.log(`${f.padEnd(24)} ${String(k).padStart(5)} ключа · преведени ${String(d).padStart(5)} (${k ? Math.round(d * 100 / k) : 0}%)`);
console.log(`ОБЩО: ${K} ключа · преведени ${D} (${K ? Math.round(D * 100 / K) : 0}%)`);
