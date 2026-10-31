// credits.mjs — екранът „📜 Автори“ (флаг credits-full): събира всички CREDITS*/License* файлове в assets/ в assets/credits.json.
// Пуска се при добавяне на модел или звук (и сам от githooks/pre-commit, когато в commit-а има CREDITS файл):
//   node credits.mjs           — по файловете на диска
//   node credits.mjs --staged  — по staged версиите; credits.json се записва и добавя в индекса
//   node credits.mjs --check   — само предупрежденията: редове без автор/лиценз, CC-BY-NC, звуци без запис откъде са
// Формат на редовете в CREDITS (свободен, парсерът е търпелив): [- ]път.glb — "Заглавие" by Автор (лиценз) — https://…
// Лицензът може да е и в заглавния ред на раздела („… Sketchfab, CC BY 4.0 …“) — важи за редовете под него.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { execFileSync } from 'child_process';

const ROOT = new URL('.', import.meta.url).pathname, STAGED = process.argv.includes('--staged'), CHECK = process.argv.includes('--check');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const isCred = f => /^assets\/.*\/(CREDITS[^/]*|LICENSE[^/]*|License[^/]*)\.txt$/.test(f);
const files = STAGED ? git(['ls-files']).split('\n').filter(isCred)
  : (function walk(d) { return readdirSync(ROOT + d).flatMap(n => { const p = d + '/' + n; return statSync(ROOT + p).isDirectory() ? walk(p) : isCred(p) ? [p] : []; }); })('assets');
const read = f => STAGED ? git(['show', ':' + f]) : readFileSync(ROOT + f, 'utf8');

// лицензите: ключ → [име, линк]
const LIC = {
  'CC-BY-4.0': ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'], 'CC-BY-3.0': ['CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/'],
  'CC-BY-SA-4.0': ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'], 'CC-BY-NC-4.0': ['CC BY-NC 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/'],
  'CC0': ['CC0 (обществено достояние)', 'https://creativecommons.org/publicdomain/zero/1.0/'], 'ODbL': ['ODbL', 'https://www.openstreetmap.org/copyright'],
  'SF-STD': ['Sketchfab Standard', 'https://sketchfab.com/licenses'], 'PIXABAY': ['Pixabay Content License', 'https://pixabay.com/service/license-summary/'],
  'MIXAMO': ['Adobe Mixamo (безплатно за игри)', 'https://www.mixamo.com'], 'PD': ['Обществено достояние', ''], 'OWN': ['Собствени (Темидасофт)', ''],
};
const licOf = (s, host) => /CC.?BY.?NC/i.test(s) ? 'CC-BY-NC-4.0' : /CC.?BY.?SA|Attribution-ShareAlike/i.test(s) ? 'CC-BY-SA-4.0'
  : /CC.?BY.?3\.0|licenses\/by\/3\.0/i.test(s) ? 'CC-BY-3.0' : /CC.?BY.?4\.0|CC Attribution 4|licenses\/by\/4\.0/i.test(s) ? 'CC-BY-4.0'
  : /CC.?BY\b|CC Attribution|Creative Commons Attribution/i.test(s) ? (host === 'poly.pizza' ? 'CC-BY-3.0' : 'CC-BY-4.0')
  : /\bCC0\b|Creative Commons Zero|publicdomain\/zero/i.test(s) ? 'CC0' : /Sketchfab Free Standard/i.test(s) ? 'SF-STD'
  : /Pixabay Content License/i.test(s) ? 'PIXABAY' : /public domain|обществено достояние/i.test(s) ? 'PD' : null;

// вид по папката на файла
const KIND = [
  ['Забележителности', /^(lm|stadium2?|hotels5)\//], ['Паметници и фонтани', /^statues\//],
  ['Сгради', /^(blocks2?|churches|sky|civic2?|commercial2?|houses2?|office|wh2|rome|industry|port|gas|resort|hospital|station|mines|burned|metro|people\/hotel|people\/skihotel|air\/term|air\/tower)\b|^(building|h2-|office-|wh-l|it-|burned-|hotel)/],
  ['Превозни средства и техника', /^(cars|vans|trucks|trains|ships|boats|marina|air|gear|inc|ops|riot|construct\/sf-mixer|lift)\b|^(car-|bus-|pol-|fire-|amb-|bulldozer|dump|crane|rescue|heli|ladder|burnt|riot-van)/],
];
const kindOf = (f, file) => /music\//.test(file) ? 'Музика' : /sfx\//.test(file) ? 'Звуци' : /(^|\/)(people\/(people|peds)|riot-cop|firefighter|paramedic)/.test(f) ? 'Хора' : (KIND.find(([, re]) => re.test(f)) || ['Улица, природа и обзавеждане'])[0];

const out = [], warn = [], seen = new Map();
const add = e => {   // едно произведение — един ред (еднакъв линк → файловете се сливат)
  const key = e.s === 'Kenney' ? e.t : e.u || (e.t + '|' + e.a); const o = seen.get(key);
  if (o) { for (const f of e.f) if (!o.f.includes(f)) o.f.push(f); return; }
  seen.set(key, e); out.push(e);
};
for (const file of files.sort()) {
  const base = file.replace(/[^/]+$/, '').replace(/^assets\/(heavy\/)?/, '');   // папката на CREDITS файла спрямо assets/heavy
  let secLic = null, secDir = '', secSrc = '';
  const text = read(file);
  if (/^\s*$/.test(text)) continue;
  // License.txt на цял пакет: Kenney — в EXTRA долу (по пакет), Majadroid — тук
  if (/License\.txt$|LICENSE-/.test(file)) {
    if (/Majadroid/.test(text)) add({ t: 'House Construction Site', a: 'Majadroid (Maik Hoffmann)', l: licOf(text) || 'CC0', u: 'https://majadroid.itch.io/', f: [file.replace(/[^/]+$/, '').replace(/^assets\//, '')], k: 'Пакети (Kenney и др.)', s: 'itch.io' });
    continue;
  }
  for (let raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-•]\s*/, ''); if (!line) continue;
    const urls = [...line.matchAll(/https?:\/\/[^\s),]+/g)].map(m => m[0].replace(/[.;:]$/, ''));
    const host = urls[0] && new URL(urls[0]).hostname.replace(/^www\./, '');
    // собствени: Meshy AI, Kling AI, Blender — без атрибуция
    if (/Meshy AI|Kling AI/.test(line) && !/ by /.test(line)) {
      const f = line.split(/\s+[—–]\s+/)[0].split(/,\s*/).map(s => (secDir && !s.includes('/') ? secDir : '') + s.trim());
      const t = /Kling/.test(line) ? 'Видеата в кината и пътешествията' : (line.match(/[„"“]([^"“”„]+)[“"”]/) || [])[1] || line.split(/\s+[—–]\s+/)[1]?.split(',')[0];
      add({ t: t || f[0], a: 'Темидасофт', l: 'OWN', u: '', f, k: /Kling/.test(line) ? 'Видео' : 'Модели по поръчка (Meshy AI)', s: /Kling/.test(line) ? 'Kling AI' : 'Meshy AI' });
      continue;
    }
    const title = (line.match(/[„"“]([^"“”„]+)[“"”]/) || [])[1] || (urls.length && line.match(/\s[—–]\s+([^—–"„“]+?)\s+by\s/) || [])[1];   // и без кавички: „… — railway track by автор — линк“
    const lic = licOf(line.replace(/[„"“][^"“”„]+[“"”]/g, ''), host);
    const dir = (line.match(/assets\/heavy\/([\w/-]+?)\/?(?:\s|—|;|,|:|$)/) || [])[1];
    const pix = !/ (by|от) /.test(line) && line.match(/[“"”]\s*\(([^,()]+),\s*Pixabay/);   // „заглавие“ (автор, Pixabay, …)
    const by = (line.slice(title ? line.indexOf(title) + title.length + 1 : 0).match(/(?:^|\s)(?:by|от)\s+(.+?)(?=\s*\(|,|\s+[—–-]\s|\s{2,}|\shttps?:|$)/) || [])[1] || (pix ? pix[1] : /Pixabay/.test(line) && title ? 'Pixabay' : null);
    if (!title || !by) {   // заглавен ред на раздел: лиценз и папка за редовете под него
      if (lic) secLic = lic;
      if (/Sketchfab|poly\.pizza/i.test(line)) secSrc = /Sketchfab/i.test(line) ? 'Sketchfab' : 'Poly Pizza';
      if (dir) secDir = dir + '/';
      if (/Mixamo/.test(line)) add({ t: 'Mixamo (герои и анимации)', a: 'Adobe', l: 'MIXAMO', u: 'https://www.mixamo.com', f: [base], k: 'Хора', s: 'Mixamo' });
      else if (urls.length && !/creativecommons|majadroid|kenney/.test(line) && !title) warn.push(`${file}: ред с линк, но без „заглавие“ by автор: ${line.slice(0, 120)}`);
      continue;
    }
    const f = line.split(/\s+[—–]\s+|\s{3,}/)[0].split(/,\s*/).filter(s => /\.(glb|gltf|mp3|ogg|webp)\b|^[\w.-]+\/[\w.{},-]+$|^wh-l\d+/.test(s)).map(s => s.replace(/\s*\(.*$/, '').trim())
      .map(s => base && !s.startsWith('../') && !s.includes('/') ? base + s : secDir && !s.includes('/') ? secDir + s : s.replace(/^\.\.\//, ''));
    const l = lic || secLic || (host === 'poly.pizza' ? 'CC-BY-3.0' : host === 'sketchfab.com' ? 'CC-BY-4.0' : null);
    if (!l) warn.push(`${file}: без лиценз: ${line.slice(0, 120)}`);
    const src = host === 'sketchfab.com' ? 'Sketchfab' : host === 'poly.pizza' ? 'Poly Pizza' : /Pixabay/.test(line) ? 'Pixabay' : host || secSrc;
    const e = { t: title, a: by.replace(/^Pixabay$/, 'Pixabay'), l: l || 'CC-BY-4.0', u: urls[0] || (/Pixabay/.test(line) && (line.match(/sound (\d+)/) || [])[1] ? `https://pixabay.com/sound-effects/${line.match(/sound (\d+)/)[1]}/` : /Pixabay/.test(line) && (line.match(/music (\d+)/) || [])[1] ? `https://pixabay.com/music/${line.match(/music (\d+)/)[1]}/` : ''), f, k: kindOf(f[0] || base, file), s: src };
    if (e.l === 'CC-BY-NC-4.0') { e.nc = 1; warn.push(`${file}: CC-BY-NC (некомерсиален — не бива в игра с реклама): ${title} by ${by} — ${f.join(', ')}`); }
    add(e);
  }
}
// извън CREDITS файловете: данни за картите, пакетите без License.txt, видео
const EXTRA = [
  { t: 'OpenStreetMap — улиците и сградите на градовете по истински план', a: 'OpenStreetMap contributors', l: 'ODbL', u: 'https://www.openstreetmap.org/copyright', k: 'Карти и данни', s: 'OpenStreetMap' },
  { t: 'Natural Earth — границите и бреговете на картата', a: 'Natural Earth', l: 'PD', u: 'https://www.naturalearthdata.com', k: 'Карти и данни', s: 'Natural Earth' },
  { t: 'Релефът на държавите (AWS Terrain Tiles: SRTM, NASA/USGS)', a: 'Mapzen, NASA/USGS', l: 'PD', u: 'https://registry.opendata.aws/terrain-tiles/', k: 'Карти и данни', s: 'AWS' },
  ...['City Kit (Commercial, Suburban, Industrial, Roads)', 'Car Kit', 'Train Kit', 'Watercraft Kit', 'Nature Kit', 'Modular Buildings', 'Holiday Kit', 'Music Jingles', 'UI Audio']
    .map(t => ({ t, a: 'Kenney', l: 'CC0', u: 'https://kenney.nl', k: t === 'Music Jingles' ? 'Музика' : t === 'UI Audio' ? 'Звуци' : 'Пакети (Kenney и др.)', s: 'Kenney' })),
];
for (const e of EXTRA) add({ f: [], ...e });
// звуците в assets/sfx без запис в CREDITS
const sfxNamed = new Set(out.flatMap(e => e.f).map(f => f.replace(/^.*\//, '')));
const sfx = STAGED ? git(['ls-files', 'assets/sfx']).split('\n').filter(Boolean) : readdirSync(ROOT + 'assets/sfx').map(f => 'assets/sfx/' + f);
for (const s of sfx) if (/\.(mp3|ogg)$/.test(s) && !sfxNamed.has(s.replace(/^.*\//, ''))) warn.push(`звук без запис откъде е: ${s}`);

const data = { lic: LIC, items: out.map(({ nc, ...e }) => ({ ...e, ...(nc ? { nc } : {}) })) };
if (warn.length) console.warn('credits.mjs:\n  ' + warn.join('\n  '));
if (CHECK) process.exit(0);
const json = JSON.stringify(data, null, 0).replace(/\},\{/g, '},\n{');
writeFileSync(ROOT + 'assets/credits.json', json + '\n');
if (STAGED) git(['add', 'assets/credits.json']);
console.log(`credits.mjs: ${out.length} записа → assets/credits.json`);
