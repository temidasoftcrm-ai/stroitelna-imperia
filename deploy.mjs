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

// 3в) version.json — за „🆕 Излезе нова версия“ (vernotice.js, флаг ver-notice): VERSION от cloud.js
const VER = (/export const VERSION = '([^']+)'/.exec(readFileSync(join(ROOT, 'cloud.js'), 'utf8')) || [])[1];
if (VER) writeFileSync(join(DIST, 'version.json'), JSON.stringify({ v: VER, at: new Date().toISOString() }) + '\n'); else console.warn('⚠️ cloud.js: няма VERSION — version.json не е направен');

// 3г) сглобяване на кода (esbuild, флаг --no-bundle — без него): модулите на страниците → b-<име>-<хеш>.js + общи b-chunk-<хеш>.js в корена
// (в корена — import.meta.url в кода сочи пак спрямо корена: assets/i18n, sfx…); three — от import map-а (външен). После dist/sw.js — бързият кеш.
const BUNDLE = !process.argv.includes('--no-bundle');
if (BUNDLE) {
  const { build } = await import(process.env.ESBUILD || '/home/dimiter/.nvm/versions/node/v20.20.0/lib/node_modules/vercel/node_modules/esbuild/lib/main.js');
  const tagRe = /<script type="module" src="([^"?]+)(?:\?v=[^"]*)?"><\/script>/g, entries = new Set();
  for (const pg of PAGES) for (const m of readFileSync(join(DIST, pg), 'utf8').matchAll(tagRe)) entries.add(m[1]);
  const res = await build({ absWorkingDir: DIST, entryPoints: [...entries], outdir: DIST, bundle: true, splitting: true, format: 'esm', target: 'es2022',
    minify: true, keepNames: true, entryNames: 'b-[name]-[hash]', chunkNames: 'b-chunk-[hash]', external: ['three', 'three/addons/*'], metafile: true, logLevel: 'warning', legalComments: 'none' });
  const outOf = {}; for (const [o, m] of Object.entries(res.metafile.outputs)) if (m.entryPoint) outOf[m.entryPoint] = o;
  const used = new Set(Object.keys(res.metafile.inputs));
  for (const pg of PAGES) { const f = join(DIST, pg); let h = readFileSync(f, 'utf8');
    h = h.replace(tagRe, (t, src) => outOf[src] ? `<script type="module" src="${outOf[src]}"></script>` : t)
      .replace(/^\s*"\.\/[^"]+\.m?js": "[^"]+",?\n/gm, '')   // import map: остават само three
      .replace(/("three\/addons\/": "[^"]+"),(\s*\})/, '$1$2')
      .replace('</body>', `<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));</script>\n</body>`);
    writeFileSync(f, h); }
  for (const f of used) if (/\.m?js$/.test(f) && existsSync(join(DIST, f))) rmSync(join(DIST, f));   // изходните модули вече са вътре в b-*.js
  for (const d of ['lab']) { const p = join(DIST, d); if (existsSync(p) && !readdirSync(p).length) rmSync(p, { recursive: true }); }
  const code = readdirSync(DIST).filter(f => /^b-.+\.js$/.test(f));
  writeFileSync(join(DIST, 'sw.js'), readFileSync(join(ROOT, 'tools/sw.js'), 'utf8').replace('__VER__', VER || Date.now()).replace('__CODE__', JSON.stringify(code)).replace('__HEAVY__', BASE.replace(/\/?$/, '/')));
  console.log(`сглобено: ${entries.size} входа → ${code.length} файла b-*.js, ${Math.round(code.reduce((a, f) => a + statSync(join(DIST, f)).size, 0) / 1024)} KB; sw.js`);
}

// 4) кеш: страниците — винаги проверка; скриптовете носят ?v=<хеш> (stamp.mjs), но и без него — кратко; assets — седмица
writeFileSync(join(DIST, '_headers'), `/version.json\n  Cache-Control: no-store\n/*.html\n  Cache-Control: no-cache\n/\n  Cache-Control: no-cache\n` + (BUNDLE ? `/sw.js\n  Cache-Control: no-cache\n/b-*\n  Cache-Control: public, max-age=31536000, immutable\n/migrate.js\n  Cache-Control: public, max-age=600\n/mobile.js\n  Cache-Control: public, max-age=600\n` : `/*.js\n  Cache-Control: public, max-age=600\n`) + `/assets/*\n  Cache-Control: public, max-age=604800\n`);   // b-* — с хеш в името: веднъж завинаги

// 5) отчет
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const all = walk(DIST), size = all.reduce((a, f) => a + statSync(f).size, 0), big = all.filter(f => statSync(f).size > 25 * 2 ** 20);
const rootJs = readdirSync(ROOT).filter(f => /\.m?js$/.test(f)), left = rootJs.filter(f => !need.has(f));
writeFileSync(join(ROOT, 'dist-files.txt'), all.map(f => relative(DIST, f)).sort().join('\n') + '\n');
console.log(`dist/: ${all.length} файла, ${Math.round(size / 2 ** 20)} MB · скриптове: ${need.size} · ASSET_BASE = ${BASE} · DEV = ${DEV} · ads.txt: ${existsSync(join(DIST, 'ads.txt')) ? adsPub : '—'}`);
console.log('lab/ в dist:', [...need].filter(f => f.startsWith('lab/')).join(', ') || '—');
console.log('*.js в корена, които НЕ влизат (до тях не се стига):', left.join(', ') || '—');
if (big.length) console.log('⚠️ над 25 MB (лимитът на Pages):', big.map(f => relative(DIST, f)).join(', '));
