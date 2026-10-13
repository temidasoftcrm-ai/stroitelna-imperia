// playtime.js — ⏱️ изиграно време: реални секунди, докато играта върви (без пауза и скрит раздел), и кога е достигнато всяко ниво.
// S.play = { sec, est, lv: { [ниво]: { day, sec } } }. За старите записи времето назад се оценява по игровите дни (est = true → „~“).
// deps: { S(), level() → ниво на фирмата, speed() → 0 при пауза, DAY_SEC }
export function createPlaytime(deps) {
  const st = () => {
    const S = deps.S(); if (!S) return null;
    if (!S.play) {   // стар запис: ~12 s на игрови ден (средно между ▶ и ▶▶▶), нивата — пропорционално
      const sec = Math.round((S.day || 1) * 12), lv = {};
      for (let l = 2; l <= deps.level(); l++) lv[l] = { day: null, sec: null, est: true };
      S.play = { sec, est: S.day > 3, lv };
    }
    return S.play;
  };
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = Math.min(5, (now - last) / 1000); last = now;
    const p = st(); if (!p) return;
    if (document.visibilityState === 'visible' && deps.speed() > 0) p.sec += dt;
    const L = deps.level();
    for (let l = 2; l <= L; l++) if (!p.lv[l]) p.lv[l] = { day: deps.S().day, sec: Math.round(p.sec) };
  }, 1000);
  const hrs = s => s == null ? '—' : s < 3600 ? `${Math.round(s / 60)} мин` : `${(s / 3600).toFixed(1).replace('.', ',')} ч`;
  // ред за прозореца на нивата
  function summaryHtml() {
    const p = st(); if (!p) return '';
    return `<div class="meta" style="margin:0">⏱️ Изиграно: <b style="color:var(--txt)">${p.est ? '~' : ''}${hrs(p.sec)}</b> · ден ${deps.S().day}${p.est ? ' <span style="opacity:.7">(времето преди брояча е оценено по игровите дни)</span>' : ''}</div>`;
  }
  // кога е достигнато ниво l (за таблицата на нивата)
  function levelTxt(l) {
    const p = st(), x = p && p.lv[l]; if (!x) return '';
    return x.est ? 'преди брояча' : `ден ${x.day} · ${hrs(x.sec)}`;
  }
  return { summaryHtml, levelTxt, state: st, hrs };
}
