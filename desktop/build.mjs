// build.mjs — сглобява пълната игра за компютър: node desktop/build.mjs [--win] [--linux] (от чист HEAD или от работната папка).
// 1) deploy.mjs към desktop/app/game (без реклами); 2) моделите от dist-heavy/ (сгъстените) вътре; 3) three.js и supabase — локално (без CDN при стартиране); 4) Electron пакет.
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join } from 'path';
const HERE = new URL('.', import.meta.url).pathname, ROOT = join(HERE, '..'), APP = join(HERE, 'app'), GAME = join(APP, 'game');
const run = (c, cwd = ROOT) => execSync(c, { cwd, stdio: 'inherit' });
rmSync(APP, { recursive: true, force: true }); mkdirSync(APP, { recursive: true });
const NM = join(HERE, 'node_modules');
run(`npx esbuild ${join(NM, '@supabase/supabase-js/dist/module/index.js')} --bundle --format=esm --platform=browser --outfile=${join(HERE, 'supabase.vendor.mjs')} --log-level=warning`, HERE);
run(`node deploy.mjs --base assets/heavy/ --out desktop/app/game --desktop`);
if (!existsSync(join(ROOT, 'dist-heavy'))) throw new Error('няма dist-heavy (node _source/compress-heavy.mjs)');
cpSync(join(ROOT, 'dist-heavy'), join(GAME, 'assets/heavy'), { recursive: true, dereference: true });
rmSync(join(GAME, 'ads.txt'), { force: true });
rmSync(join(GAME, 'vendor'), { recursive: true, force: true });
// three.js — локално
mkdirSync(join(GAME, 'vendor/three/build'), { recursive: true });
cpSync(join(NM, 'three/build/three.module.js'), join(GAME, 'vendor/three/build/three.module.js'));
cpSync(join(NM, 'three/examples/jsm'), join(GAME, 'vendor/three/examples/jsm'), { recursive: true });
for (const f of ['index.html', 'online.html', 'privacy.html', 'terms.html']) { const p = join(GAME, f); if (!existsSync(p)) continue; writeFileSync(p, readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/build/', './vendor/three/build/').replaceAll('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/', './vendor/three/examples/jsm/')); }
// Electron
cpSync(join(HERE, 'main.cjs'), join(APP, 'main.cjs'));
cpSync(join(HERE, 'preload.cjs'), join(APP, 'preload.cjs'));
const pkg = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8')); writeFileSync(join(APP, 'package.json'), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, author: pkg.author, main: pkg.main }, null, 1));
const targets = ['--linux', '--win'].filter(t => process.argv.includes(t)).map(t => t === '--win' ? 'win32' : 'linux');
for (const pf of targets) run(`npx electron-packager app "Stroitelna Imperia" --platform=${pf} --arch=x64 --out=out --overwrite --no-prune --asar=false`, HERE);
