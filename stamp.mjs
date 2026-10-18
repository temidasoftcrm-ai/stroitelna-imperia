// stamp.mjs — версия към скриптовете, за да не остава стар код в кеша на браузъра след качване.
// GitHub Pages казва на браузъра да пази всеки файл до 10 мин. — без версия може да се смесят нов и стар код.
// В import map-а на index.html всеки „./x.js“ сочи към „./x.js?v=<хеш>“ (важи и за import-ите вътре в модулите),
// а <script src="x.js"> става „x.js?v=<хеш>“. Хешът се сменя само когато се смени файлът — браузърът тегли наново само него.
//   node stamp.mjs           — по файловете на диска (ръчно)
//   node stamp.mjs --staged  — по това, което влиза в commit-а (githooks/pre-commit): хешовете са на staged версиите,
//                              а index.html се обновява и в индекса, и на диска, без да се добавят чужди непокачени промени
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';

const ROOT = new URL('.', import.meta.url).pathname, STAGED = process.argv.includes('--staged');
const git = (args, input) => execFileSync('git', args, { cwd: ROOT, input, encoding: 'utf8', maxBuffer: 64 << 20 });
const isJs = f => /^(lab\/)?[\w.-]+\.js$/.test(f);   // скриптовете в корена и lab/ (feature.js, approved.js)

// път → кратък хеш на съдържанието
function versions() {
  const v = {};
  if (STAGED) for (const line of git(['ls-files', '-s']).split('\n')) { const m = line.match(/^\d+ ([0-9a-f]+) \d\t(.+)$/); if (m && isJs(m[2])) v[m[2]] = m[1].slice(0, 8); }
  else for (const f of [...readdirSync(ROOT), ...readdirSync(ROOT + 'lab').map(f => 'lab/' + f)].filter(isJs)) v[f] = createHash('sha1').update(readFileSync(ROOT + f)).digest('hex').slice(0, 8);
  return v;
}
// import map-ът и <script src> в html според версиите (другото в страницата не се пипа)
function stamp(html, v) {
  const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/); if (!m) throw new Error('index.html: няма import map');
  const map = JSON.parse(m[1]);
  for (const k of Object.keys(map.imports)) if (k.startsWith('./')) delete map.imports[k];
  for (const f of Object.keys(v).sort()) map.imports['./' + f] = `./${f}?v=${v[f]}`;
  return html.replace(m[0], () => `<script type="importmap">\n${JSON.stringify(map, null, 1)}\n</script>`)
    .replace(/<script( type="module")? src="([\w./-]+\.js)(\?v=\w+)?"><\/script>/g, (s, t, f) => v[f] ? `<script${t || ''} src="${f}?v=${v[f]}"></script>` : s);
}

const v = versions(), file = ROOT + 'index.html', disk = readFileSync(file, 'utf8'), diskNew = stamp(disk, v);
if (diskNew !== disk) writeFileSync(file, diskNew);
if (STAGED) {
  const staged = git(['show', ':index.html']), stagedNew = stamp(staged, v);
  if (stagedNew !== staged) { const sha = git(['hash-object', '-w', '--stdin'], stagedNew).trim(); git(['update-index', '--cacheinfo', `100644,${sha},index.html`]); }
}
console.log(`stamp: ${Object.keys(v).length} скрипта${STAGED ? ' (staged)' : ''}`);
