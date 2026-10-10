// saves.js — 3 слота за запис + експорт/импорт във файл.
// Слот 1 ползва стария ключ (съвместимост със старите записи).
export const SLOTS = 3;
const keyOf = n => n === 1 ? 'stroi-save-v1' : `stroi-save-v1-s${n}`;
export function currentSlot() { try { return Math.min(SLOTS, Math.max(1, +localStorage.getItem('stroi-slot') || 1)); } catch { return 1; } }
export const saveKey = () => keyOf(currentSlot());

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
  deps.modal('💾 Записи', `Играта се записва автоматично в текущия слот. Можеш да имаш до ${SLOTS} отделни игри и да ги пазиш като файл.<br><br>${h}<input type="file" id="slotFile" accept=".json,application/json" style="display:none">`, [['Затвори', null]]);
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
  box.querySelectorAll('[data-slot-del]').forEach(b => b.onclick = () => {
    localStorage.removeItem(keyOf(+b.dataset.slotDel)); close(); openSaves(deps);
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
