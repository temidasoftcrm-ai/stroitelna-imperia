// i18n-check.mjs — 🌐 lang-en (f6): кои кирилски текстове на екрана още не са преведени. Отваря играта на английски без екран (Playwright),
// минава през табовете, ⚙️ Настройки, менюто „Империя“ и няколко големи прозореца и печата най-честите непреведени текстове + файла, в който са
// (по assets/i18n/en/*.json — ключът е там, но е празен; „—“ — ключ няма: текстът се сглобява по време на работа → t() в кода или assets/i18n/en/_manual.json).
//   node i18n-check.mjs [град=sofia] [порт=3610] [брой=60]
// Нужен е Playwright (тук — от ~/Documents/lawmatch/node_modules) и Лабораторията/сървърът на порта (feature('lang-en') — включен там).
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
const { chromium } = await import(process.env.PLAYWRIGHT || '/home/dimiter/Documents/lawmatch/node_modules/playwright/index.mjs');
const [city = 'sofia', port = '3610', top = '60'] = process.argv.slice(2);
const DIR = new URL('./assets/i18n/en/', import.meta.url).pathname, owner = new Map();
for (const f of readdirSync(DIR).filter(f => f.endsWith('.json'))) { const d = JSON.parse(readFileSync(join(DIR, f), 'utf8')); for (const k of Object.keys(d)) if (k !== '_stale' && !owner.has(k)) owner.set(k, f.replace(/\.json$/, '')); }
const pats = [...owner.entries()].filter(([k]) => /\{\w+\}/.test(k)).map(([k, f]) => [new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\s*\\?\{(\w+)\\?\}\s*/g, '\\s*[\\s\\S]*?\\s*') + '$'), f, k]);
const ownerOf = k => owner.get(k) || (pats.find(([re]) => re.test(k)) || [])[1];   // и по моделите ({0} — числа, имена)
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, locale: 'en-US' }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?autotest=100000&nocollect&plan=1&city=${city}&lang=en`);
  await p.waitForFunction(() => window.__dbg && __dbg.city()?.ready, null, { timeout: 180000 }); await p.waitForTimeout(6000);
  const step = async fn => { try { await p.evaluate(fn); } catch { } await p.waitForTimeout(900); await p.evaluate(() => { document.getElementById('modal')?.classList.add('hidden'); }); };
  for (const t of ['offers', 'projects', 'units', 'store', 'estate', 'office']) await step(new Function(`document.querySelector('[data-t="${t}"]')?.click()`));
  await step(() => document.getElementById('btnSettings')?.click()); await p.evaluate(() => document.querySelectorAll('#stX').forEach(x => x.click()));
  await step(() => document.getElementById('devBtn')?.click());
  await step(() => document.getElementById('btnHub')?.click());
  for (const k of ['cities', 'garage', 'bank', 'hw', 'rail', 'sea', 'air', 'offers', 'tasks']) await step(new Function(`try { __dbg.state(); document.getElementById('btnHub')?.click(); [...document.querySelectorAll('#hub button')].find(b => b.dataset && (b.dataset.big === '${k}' || b.dataset.k === '${k}'))?.click(); } catch (e) {}`));
  const miss = await p.evaluate(() => window.__i18nMissing());
  const rows = miss.slice(0, +top).map(([k, n]) => `${String(n).padStart(4)}× ${(ownerOf(k) || '—').padEnd(16)} ${k.slice(0, 110)}`);
  console.log(`непреведени текстове на екрана: ${miss.length} (най-честите ${rows.length}):\n` + rows.join('\n'));
  if (errs.length) console.log('грешки:', errs.slice(0, 5));
} finally { await b.close(); }
