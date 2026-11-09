// main.cjs — пълната игра като програма за компютър (Electron). Файловете се отварят през app://game/ (ES модулите и fetch не работят от file://).
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');

const ROOT = path.join(__dirname, 'game');
// записите: файлове в <userData>/saves (Steam Cloud ги синхронизира); при старт preload.cjs ги връща в localStorage
const fs = require('fs'), { ipcMain } = require('electron');
const KEY_RE = /^stroi-(save-v1(-s\d+)?|slot)$/, dir = () => path.join(app.getPath('userData'), 'saves');
ipcMain.on('saves-read', e => { const o = {}; try { for (const f of fs.readdirSync(dir())) { if (!f.endsWith('.json')) continue; const k = f.slice(0, -5); if (KEY_RE.test(k)) o[k] = fs.readFileSync(path.join(dir(), f), 'utf8'); } } catch {} e.returnValue = o; });
ipcMain.on('saves-put', (_e, k, v) => { if (!KEY_RE.test(k) || typeof v !== 'string') return; fs.mkdirSync(dir(), { recursive: true }); const f = path.join(dir(), k + '.json'); fs.writeFileSync(f + '.tmp', v); fs.renameSync(f + '.tmp', f); });
ipcMain.on('saves-del', (_e, k) => { if (KEY_RE.test(k)) fs.rmSync(path.join(dir(), k + '.json'), { force: true }); });
function start() {
  protocol.handle('app', req => {
    const u = new URL(req.url); const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  const test = process.env.IMPERIA_TEST;
  const win = new BrowserWindow({ width: 1600, height: 900, show: !test || !!process.env.IMPERIA_SHOW, backgroundColor: '#10141c', title: 'Строителна империя', webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.cjs') } });
  if (!test) win.maximize();
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F11') win.setFullScreen(!win.isFullScreen()); });
  win.loadURL('app://game/index.html' + (test ? '?nocollect' : ''));
  if (test) {   // автопроверка: IMPERIA_TEST=секунди — грешките в конзолата и снимка, после изход
    const errs = [];
    win.webContents.on('console-message', (_e, level, msg) => { if (level >= 3) errs.push(msg.slice(0, 300)); });
    win.webContents.on('did-fail-load', (_e, c, d, u) => errs.push(`fail ${c} ${d} ${u}`));
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('fs').writeFileSync(process.env.IMPERIA_SHOT || 'desktop-test.png', img.toPNG());
      const info = await win.webContents.executeJavaScript(`JSON.stringify({ title: document.title, edition: 'full', canvas: !!document.querySelector('canvas'), body: document.body.innerText.slice(0, 200) })`);
      console.log('TEST', info); console.log('ERRORS', errs.length, JSON.stringify([...new Set(errs)].slice(0, 12)));
      app.exit(0);
    }, +test * 1000);
  }
}
app.whenReady().then(start);
app.on('window-all-closed', () => app.quit());
