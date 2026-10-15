// labserver.mjs — Лабораторията на „Строителна империя“ (node labserver.mjs → http://localhost:3610).
// Отделен сървър: играта на :3600 не се пипа. Тук се вижда всичко ново (feature() → true), 3D моделите с анимациите им,
// звуците и дебъг входовете. Записът на играта на :3610 е отделен (друг origin → друго localStorage).
// /__lab/* : models, sounds, status, approved (✓ OK → lab/approved.json + lab/approved.js), feedback и delete → lab-feedback.jsonl.
import { createServer } from 'node:http';
import { appendFileSync, copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)), PORT = +(process.env.LAB_PORT || 3610);
const LAB = join(ROOT, 'lab'), FEED = join(ROOT, 'lab-feedback.jsonl');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const readJson = (f, d) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return d; } };
const approvedList = () => readJson(join(LAB, 'approved.json'), { approved: [] }).approved;
const reps = () => readJson(join(LAB, 'replacements.json'), {});
const log = (target, kind, text = '') => appendFileSync(FEED, JSON.stringify({ at: new Date().toISOString(), target: String(target).slice(0, 300), kind: String(kind).slice(0, 80), text: String(text).slice(0, 2000) }) + '\n');
function walk(dir, re, out = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n), st = statSync(p); if (st.isDirectory()) walk(p, re, out); else if (re.test(n)) out.push({ path: '/' + relative(ROOT, p).split(sep).join('/'), size: st.size }); }
  return out;
}
// одобреното: JSON (за сървъра и Лабораторията) + JS модул (за играта — синхронно, без fetch при зареждане)
function writeApproved(list) {
  writeFileSync(join(LAB, 'approved.json'), JSON.stringify({ approved: list }, null, 2) + '\n');
  writeFileSync(join(LAB, 'approved.js'), `// записва се от Лабораторията (labserver.mjs) при „✓ OK“ — не се пише на ръка\nexport const APPROVED = ${JSON.stringify(list)};\n`);
}
const body = req => new Promise(res => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch { res({}); } }); });
const json = (res, o) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(o)); };

// имената на звуците в sound.js (без звукови файлове — синтезирани с WebAudio)
function soundNames() {
  const s = readFileSync(join(ROOT, 'sound.js'), 'utf8'), out = new Set();
  for (const m of s.matchAll(/case '([\w-]+)'/g)) out.add(m[1]);
  for (const m of s.matchAll(/name === '([\w-]+)'/g)) out.add(m[1]);
  return [...out].sort();
}
// статус в списъка с модели: жълто — Claude работи по него, зелено — новото е готово и чака OK, ✓ — одобрен
function status() {
  const R = reps(), okd = approvedList(), st = {};
  const set = (u, state, at) => { if (!st[u] || st[u].at <= at) st[u] = { state, at }; };
  let lines = []; try { lines = readFileSync(FEED, 'utf8').split('\n').filter(Boolean); } catch { }
  for (const l of lines) {
    try {
      const f = JSON.parse(l), m = /^Модел: (\S+)/.exec(f.target), n = /^Ново: (\S+)/.exec(f.target);
      if (m) set(m[1], f.kind === 'reviewed' ? 'reviewed' : f.kind === 'ok' || f.kind === 'deleted' ? 'done' : 'working', f.at);
      if (n && f.kind === 'approved' && R[n[1]]) set(R[n[1]].from, 'done', f.at);
    } catch { }
  }
  for (const [u, v] of Object.entries(readJson(join(ROOT, 'lab-status.json'), {}))) set(u, v.state, v.at);   // ръчни отметки от Claude
  for (const [id, r] of Object.entries(R)) if (!okd.includes(id) && existsSync(join(ROOT, r.to))) set(r.from, 'ready', new Date().toISOString());
  return { status: st, hidden: Object.values(R).map(r => r.to) };
}

createServer(async (req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  try {
    if (url === '/') url = '/lab.html';
    if (url === '/__lab/models') return json(res, walk(join(ROOT, 'assets'), /\.(glb|gltf)$/i).sort((a, b) => a.path.localeCompare(b.path)));
    if (url === '/__lab/sounds') return json(res, { synth: soundNames(), files: walk(join(ROOT, 'assets'), /\.(mp3|ogg|wav)$/i) });
    if (url === '/__lab/status') return json(res, status());
    if (url === '/__lab/feedback' && req.method === 'POST') { const b = await body(req); log(b.target ?? '', b.kind ?? '', b.text ?? ''); return json(res, { ok: true }); }
    if (url === '/__lab/approved') {
      if (req.method !== 'POST') return json(res, { approved: approvedList() });
      const { id, ok } = await body(req), cur = new Set(approvedList());
      if (id && /^[a-z0-9-]+$/.test(id)) {
        if (ok) cur.add(id); else cur.delete(id);
        const r = ok ? reps()[id] : null;   // одобрена подмяна на модел: новият файл застава на мястото на стария (старият — в ~/Downloads/city-builder-unused)
        if (r && existsSync(join(ROOT, r.to))) {
          const bak = join(homedir(), 'Downloads/city-builder-unused'); mkdirSync(bak, { recursive: true });
          if (existsSync(join(ROOT, r.from))) copyFileSync(join(ROOT, r.from), join(bak, `${Date.now()}-${r.from.split('/').pop()}`));
          renameSync(join(ROOT, r.to), join(ROOT, r.from));
        }
        log(`Ново: ${id}`, ok ? 'approved' : 'removed');
        writeApproved([...cur].sort());
      }
      return json(res, { approved: approvedList() });
    }
    // „🗑 Изтрий“: ако никой код не ползва модела — в кошчето (gio trash); ако се ползва — задача за Claude
    if (url === '/__lab/delete' && req.method === 'POST') {
      const { url: u } = await body(req);
      if (!u || !/^\/assets\/[\w\-./]+\.glb$/.test(u) || u.includes('..') || !existsSync(join(ROOT, u))) return json(res, { ok: false, error: 'няма такъв модел' });
      const name = u.split('/').pop().replace(/\.glb$/, '');
      let used = [];
      try {   // името в кавички/път ('building-a', "sky/usb.glb", `blocks/${k}` с k в масив 'usb'…); A['ind-…'], A['sf-…'] са с префикс пред името
        used = execFileSync('grep', ['-lE', `['"\`/-]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.glb)?['"\`]`, ...readdirSync(ROOT).filter(f => /\.(m?js|html)$/.test(f) && !f.startsWith('lab'))], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
      } catch { used = []; }
      if (used.length) { log(`Модел: ${u}`, 'delete', `Изтрий окончателно — ползва се в: ${used.join(', ')}`); return json(res, { ok: false, used }); }
      try { execFileSync('gio', ['trash', join(ROOT, u)]); log(`Модел: ${u}`, 'deleted', 'изтрит (в кошчето)'); return json(res, { ok: true }); } catch (e) { return json(res, { ok: false, error: String(e) }); }
    }
    // подмяна на модел, докато чака „✓ OK“: на :3610 играта и Лабораторията виждат новия файл на мястото на стария
    for (const [id, r] of Object.entries(reps())) if (url === r.from && !approvedList().includes(id) && existsSync(join(ROOT, r.to))) url = r.to;
    const file = normalize(join(ROOT, url));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', /\.(m?js|html|json)$/.test(file) ? 'no-store' : 'max-age=300');   // кодът — винаги пресен
    createReadStream(file).pipe(res);
  } catch (e) { res.statusCode = 500; res.end(String(e)); }
}).listen(PORT, '127.0.0.1', () => console.log(`Лабораторията: http://localhost:${PORT}`));
