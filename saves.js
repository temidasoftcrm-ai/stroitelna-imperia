// saves.js — 3 слота за запис + експорт/импорт във файл.
// Слот 1 ползва стария ключ (съвместимост със старите записи).
export const SLOTS = 3;
const keyOf = n => n === 1 ? 'stroi-save-v1' : `stroi-save-v1-s${n}`;
export function currentSlot() { try { return Math.min(SLOTS, Math.max(1, +localStorage.getItem('stroi-slot') || 1)); } catch { return 1; } }
export const saveKey = () => keyOf(currentSlot());

// ── 🕒 резервни копия (IndexedDB — не заема мястото на записите в localStorage) ──
// Правят се на всеки 5 мин игра, при старт, преди „Нова игра“ и преди облакът да замени записа. Пазят се последните 12
// на слот (≈ 1 час) + най-напредналото копие (най-много дни) — за да може да се върне игра, която е започнала отначало.
const BAK_KEEP = 12;
const sigOf = s => { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
let dbP = null;
const db = () => dbP = dbP || new Promise((res, rej) => { const r = indexedDB.open('stroi-backups', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('bak', { keyPath: 'id', autoIncrement: true }).createIndex('slot', 'slot');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, f) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('bak', mode), st = t.objectStore('bak'); let out; Promise.resolve(f(st)).then(v => out = v); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); }); };
const all = st => new Promise(res => { const r = st.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
function metaRaw(raw) { try { const s = JSON.parse(raw); return { city: s.hqCity || s.cityId, day: s.day | 0, money: Math.round(s.econ?.money ?? 0), done: s.done | 0 }; } catch { return null; } }
export async function listBackups(slot = currentSlot()) {
  try { return (await tx('readonly', all)).filter(b => b.slot === slot).sort((a, b) => b.t - a.t).map(({ raw, ...m }) => m); } catch { return []; }
}
export async function backupRaw(slot, raw, reason = 'авто') {
  try {
    if (!raw || typeof indexedDB === 'undefined') return false;
    const m = metaRaw(raw); if (!m) return false;
    const sig = sigOf(raw);
    return await tx('readwrite', async st => {
      const list = (await all(st)).filter(b => b.slot === slot).sort((a, b) => b.t - a.t);
      if (list[0] && list[0].sig === sig) return false;   // същото като последното копие
      st.add({ slot, t: Date.now(), reason, sig, ...m, raw });
      const best = [...list].sort((a, b) => b.day - a.day || b.t - a.t)[0];
      for (const b of list.slice(BAK_KEEP - 1)) if (!best || b.id !== best.id || best.day <= m.day) st.delete(b.id);
      return true;
    });
  } catch { return false; }
}
export const backupNow = (reason) => backupRaw(currentSlot(), localStorage.getItem(saveKey()), reason);
export async function restoreBackup(id) {
  const b = await tx('readonly', st => new Promise(res => { const r = st.get(id); r.onsuccess = () => res(r.result); r.onerror = () => res(null); }));
  if (!b) return false;
  await backupNow('преди връщане');   // и текущото да не се изгуби
  localStorage.setItem(keyOf(b.slot), b.raw);
  return true;
}
// ── дневник на грешките (последните 15) — за да се види после какво е станало ──
export function logError(msg, extra = {}) {
  try { const L = JSON.parse(localStorage.getItem('stroi-errlog') || '[]'); L.unshift({ t: Date.now(), msg: String(msg).slice(0, 300), ...extra }); localStorage.setItem('stroi-errlog', JSON.stringify(L.slice(0, 15))); } catch { }
}
export const errorLog = () => { try { return JSON.parse(localStorage.getItem('stroi-errlog') || '[]'); } catch { return []; } };

function summary(n) {
  try {
    const raw = localStorage.getItem(keyOf(n)); if (!raw) return null;
    const s = JSON.parse(raw);
    return { city: s.hqCity || s.cityId, day: s.day, money: s.econ?.money ?? 0, rep: s.rep ?? 0, done: s.done ?? 0, size: Math.round(raw.length / 1024) };
  } catch { return { broken: true }; }
}

// deps: modal, toast, fmt, cityName(id), save() — записва текущата игра преди смяна
export function openSaves(deps) {
  const cur = currentSlot();
  let h = '';
  for (let n = 1; n <= SLOTS; n++) {
    const s = summary(n);
    h += `<div class="card" style="padding:9px 11px;${n === cur ? 'border-color:var(--acc)' : ''}"><div class="row" style="margin:0"><b>💾 Слот ${n}${n === cur ? ' · текущ' : ''}</b>
      <span>${s && !s.broken ? `${'★'.repeat(Math.floor(s.rep))}` : ''}</span></div>
      <div class="meta">${!s ? 'празен' : s.broken ? 'повреден запис' : `${deps.cityName(s.city)} · ден ${s.day} · ${deps.fmt(s.money)} € · ${s.done} обекта · ${s.size} KB`}</div>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:4px">
        ${n !== cur ? `<button class="btn" data-slot-load="${n}">${s ? 'Зареди' : 'Нова игра тук'}</button>` : ''}
        ${s ? `<button class="btn2" data-slot-exp="${n}">⬇️ Файл</button>` : ''}
        <button class="btn2" data-slot-imp="${n}">⬆️ От файл</button>
        ${s && n !== cur ? `<button class="btn2" data-slot-del="${n}">🗑️</button>` : ''}</div></div>`;
  }
  deps.modal('💾 Записи', `Играта се записва автоматично в текущия слот. Можеш да имаш до ${SLOTS} отделни игри и да ги пазиш като файл.<br><br>${h}<div class="card" style="padding:9px 11px"><b>🕒 Автозаписи (слот ${cur})</b><div class="meta" style="margin:2px 0 4px">На всеки 5 минути игра се пази копие — ако нещо се обърка, върни се към по-ранно.</div><div id="bakList"><div class="meta">Зареждам…</div></div></div>${errorLog().length ? `<details class="card" style="padding:9px 11px"><summary><b>⚠️ Последни грешки (${errorLog().length})</b></summary><div class="meta" style="font-size:12px;white-space:pre-wrap;user-select:text">${errorLog().map(e => `${new Date(e.t).toLocaleString('bg-BG')} · ден ${e.day ?? '?'} · ${String(e.msg).replace(/</g, '&lt;')}${e.at ? ' @ ' + e.at : ''}`).join('\n')}</div></details>` : ''}<input type="file" id="slotFile" accept=".json,application/json" style="display:none">`, [['Затвори', null]]);
  const box = document.getElementById('modalBox');
  const close = () => document.getElementById('modal').classList.add('hidden');
  box.querySelectorAll('[data-slot-load]').forEach(b => b.onclick = () => {
    deps.save();
    localStorage.setItem('stroi-slot', b.dataset.slotLoad);
    location.reload();
  });
  box.querySelectorAll('[data-slot-exp]').forEach(b => b.onclick = () => {
    if (+b.dataset.slotExp === cur) deps.save();
    const raw = localStorage.getItem(keyOf(+b.dataset.slotExp)), s = summary(+b.dataset.slotExp);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    a.download = `stroitelna-imperia-${(s && s.city) || 'igra'}-den${(s && s.day) || 0}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    deps.toast('⬇️ Записът е свален като файл.', 'good');
  });
  box.querySelectorAll('[data-slot-del]').forEach(b => b.onclick = async () => {
    const n = +b.dataset.slotDel; await backupRaw(n, localStorage.getItem(keyOf(n)), 'преди изтриване');
    localStorage.removeItem(keyOf(n)); close(); openSaves(deps);
  });
  // 🕒 автозаписи на текущия слот — връщане с едно натискане
  listBackups(cur).then(list => {
    const el = box.querySelector('#bakList'); if (!el) return;
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'току-що' : m < 60 ? `преди ${m} мин` : m < 1440 ? `преди ${Math.round(m / 60)} ч` : new Date(t).toLocaleString('bg-BG', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }); };
    el.innerHTML = list.length ? list.map(b => `<div class="row" style="margin:3px 0"><span class="meta" style="margin:0">${ago(b.t)} · ${deps.cityName(b.city)} · ден ${b.day} · ${deps.fmt(b.money)} € · ${b.done} обекта <span style="opacity:.6">(${b.reason})</span></span><button class="btn2" data-bak="${b.id}">↩️ Върни</button></div>`).join('')
      : '<div class="meta">Още няма — първият се прави до 5 минути игра.</div>';
    el.querySelectorAll('[data-bak]').forEach(x => x.onclick = () => deps.modal('↩️ Да върна ли този автозапис?', 'Сегашната игра в слота се заменя с избрания автозапис (тя също се пази като автозапис, за да можеш да се върнеш).',
      [['Отказ', null], ['↩️ Върни', async () => { deps.lock?.(); if (await restoreBackup(+x.dataset.bak)) { deps.toast('↩️ Автозаписът е върнат — зареждам…', 'good'); setTimeout(() => location.reload(), 600); } else deps.toast('Автозаписът не се намери.', 'bad'); }]]));
  });
  const file = box.querySelector('#slotFile');
  let target = 1;
  box.querySelectorAll('[data-slot-imp]').forEach(b => b.onclick = () => { target = +b.dataset.slotImp; file.click(); });
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try {
      const txt = await f.text(), s = JSON.parse(txt);
      if (!s || !s.econ || !s.cityId) throw new Error('не е запис от играта');
      localStorage.setItem(keyOf(target), txt);
      deps.toast(`⬆️ Записът е зареден в слот ${target}.`, 'good');
      if (target === cur) location.reload(); else { close(); openSaves(deps); }
    } catch (e) { deps.toast(`Файлът не е валиден запис (${e.message}).`, 'bad'); }
  };
}
