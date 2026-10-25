// deploy.mjs — сглобява dist/ за Cloudflare Pages (imperia.temidasoft.com): само това, което е за играчите.
//   node deploy.mjs [--base https://assets.imperia.temidasoft.com/] [--dev]   (--dev — за тестовете на dist: DEV остава true, с __dbg и ?autotest)
// В dist/ влизат:
//   • index.html, online.html, privacy.html, terms.html;
//   • скриптовете, до които се стига от тях (import, import(), <script src>) — обхождане на графа, а не „всички *.js“;
//     от lab/ — само feature.js и approved.js (feature() ги чете); НЕ lab.html, lab/*, labserver.mjs, plan.html, _*.html, tests/, stamp.mjs, credits.mjs…
//   • assets/ без heavy/ (то е в R2: dist-heavy/ от _source/compress-heavy.mjs) и без local/ (песните — само локално);
//   • _headers (кеш).
// В dist/config.js ASSET_BASE става адресът на R2 (--base). Качването (след „npx wrangler login“):
//   npx wrangler pages deploy dist --project-name imperia
//   R2: rclone/wrangler към bucket-а с dist-heavy/ (CORS: _source/r2-cors.json)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative, normalize } from 'path';

const ROOT = new URL('.', import.meta.url).pathname, DIST = join(ROOT, 'dist');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--base', 'https://assets.imperia.temidasoft.com/');
const PAGES = ['index.html', 'online.html', 'privacy.html', 'terms.html'], DEV = process.argv.includes('--dev');
const SKIP_ASSETS = new Set(['heavy', 'local']);

// 1) графът на скриптовете
const strip = u => u.split('?')[0].split('#')[0];
const local = u => u && !/^[a-z]+:|^\/\//i.test(u) && /\.m?js$/.test(strip(u));
const need = new Set(), queue = [];
const add = (from, u, page) => { if (!local(u) || (!page && !/^\.\.?\//.test(u))) return;   // в модулите — само „./“ и „../“ (другото е от import map-а: three/…)
  const p = normalize(join(dirname(from), strip(u))); if (p.startsWith('..') || !existsSync(join(ROOT, p))) return;   // и без пътищата от коментарите, които ги няма
  if (!need.has(p)) { need.add(p); queue.push(p); } };
for (const pg of PAGES) {
  const h = readFileSync(join(ROOT, pg), 'utf8');
  for (const m of h.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) add(pg, m[1], true);
  for (const m of h.matchAll(/import\s*(?:[\w*{}\s,]+from\s*)?['"]([^'"]+)['"]/g)) add(pg, m[1]);   // вградените модули в страницата
}
while (queue.length) {
  const f = queue.shift(); if (!existsSync(join(ROOT, f))) { console.warn('липсва:', f); continue; }
  const s = readFileSync(join(ROOT, f), 'utf8');
  for (const re of [/(?:^|[;\s])import\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"]([^'"]+)['"]/gm, /export\s*(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g, /import\(\s*['"]([^'"]+)['"]\s*\)/g, /new URL\(\s*['"]([^'"]+\.m?js)['"]\s*,\s*import\.meta\.url/g])
    for (const m of s.matchAll(re)) add(f, m[1]);
}

// 2) копиране
rmSync(DIST, { recursive: true, force: true }); mkdirSync(DIST, { recursive: true });
const copy = f => { mkdirSync(dirname(join(DIST, f)), { recursive: true }); cpSync(join(ROOT, f), join(DIST, f)); };
for (const pg of PAGES) copy(pg);
for (const f of [...need].sort()) if (existsSync(join(ROOT, f))) copy(f);
for (const d of readdirSync(join(ROOT, 'assets'))) if (!SKIP_ASSETS.has(d)) cpSync(join(ROOT, 'assets', d), join(DIST, 'assets', d), { recursive: true, dereference: true });

// 3) R2 адресът на моделите
const cfg = join(DIST, 'config.js'), c0 = readFileSync(cfg, 'utf8'), LINE = "export const ASSET_BASE = 'assets/heavy/';";
if (!c0.includes(LINE)) throw new Error('config.js: няма реда с ASSET_BASE');
const DLINE = 'export const DEV = true;'; if (!c0.includes(DLINE)) throw new Error('config.js: няма реда с DEV');
writeFileSync(cfg, c0.replace(LINE, `export const ASSET_BASE = '${BASE.replace(/\/?$/, '/')}';`).replace(DLINE, `export const DEV = ${DEV};`));   // DEV = false: без инструментите за разработка (config.js)

// 3б) ads.txt за AdSense — от ADS_CLIENT в config.js (празен → без файл)
const adsPub = ((/export const ADS_CLIENT = '([^']*)'/.exec(c0) || [])[1] || '').trim().replace(/^ca-/, '');
if (/^pub-\d{10,20}$/.test(adsPub)) writeFileSync(join(DIST, 'ads.txt'), `google.com, ${adsPub}, DIRECT, f08c47fec0942fa0\n`);
else if (adsPub) console.warn('⚠️ ADS_CLIENT в config.js не прилича на pub-… — ads.txt не е направен');

// 4) кеш: страниците — винаги проверка; скриптовете носят ?v=<хеш> (stamp.mjs), но и без него — кратко; assets — седмица
writeFileSync(join(DIST, '_headers'), `/*.html\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n/*.js\n  Cache-Control: public, max-age=600\n/assets/*\n  Cache-Control: public, max-age=604800\n`);

// 5) отчет
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const all = walk(DIST), size = all.reduce((a, f) => a + statSync(f).size, 0), big = all.filter(f => statSync(f).size > 25 * 2 ** 20);
const rootJs = readdirSync(ROOT).filter(f => /\.m?js$/.test(f)), left = rootJs.filter(f => !need.has(f));
writeFileSync(join(ROOT, 'dist-files.txt'), all.map(f => relative(DIST, f)).sort().join('\n') + '\n');
console.log(`dist/: ${all.length} файла, ${Math.round(size / 2 ** 20)} MB · скриптове: ${need.size} · ASSET_BASE = ${BASE} · DEV = ${DEV} · ads.txt: ${existsSync(join(DIST, 'ads.txt')) ? adsPub : '—'}`);
console.log('lab/ в dist:', [...need].filter(f => f.startsWith('lab/')).join(', ') || '—');
console.log('*.js в корена, които НЕ влизат (до тях не се стига):', left.join(', ') || '—');
if (big.length) console.log('⚠️ над 25 MB (лимитът на Pages):', big.map(f => relative(DIST, f)).join(', '));
