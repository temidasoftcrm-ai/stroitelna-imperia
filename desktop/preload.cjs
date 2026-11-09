// preload.cjs — връща записите от файловете в localStorage преди играта да тръгне и дава на играта канал за запис (edition.js).
const { contextBridge, ipcRenderer } = require('electron');
try { const saves = ipcRenderer.sendSync('saves-read'); for (const k in saves) localStorage.setItem(k, saves[k]); } catch (e) { console.error('saves-read', e); }
contextBridge.exposeInMainWorld('__desktop', { put: (k, v) => ipcRenderer.send('saves-put', k, v), del: k => ipcRenderer.send('saves-del', k) });
