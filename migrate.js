// migrate.js — 🚚 преместването от temidasoftcrm-ai.github.io/stroitelna-imperia на https://imperia.temidasoft.com.
// Записите (localStorage, stroi-*) са на адреса — новият сайт не ги вижда. Обикновен (не module) скрипт, първи в <head>: на стария адрес
// спира играта (<plaintext> поглъща останалата страница) и показва „Играта се премести“; няма записи → направо location.replace към новия адрес.
// Мостът: „Продължи (със записите)“ → window.open(новия ?import=1) → той праща 'ready' на opener → старият праща stroi-* →
// новият ги записва (записът с повече дни печели; иначе остава местният) → 'done' → прозорецът се затваря, старият таб отива на новия адрес.
// Блокиран прозорец / без отговор → линк + „Изтегли записа“ (💾 Записи → ⬆️ От файл). Входът ('stroi-auth') и облачните отметки не се пренасят —
// при вход облакът си сверява записите сам. Тест на два локални порта: ?mvold=1&mvto=http://127.0.0.1:ПОРТ (само на localhost).
(function () {
  var NEW = 'https://imperia.temidasoft.com', OLD = 'https://temidasoftcrm-ai.github.io';
  var q = new URLSearchParams(location.search), host = location.hostname;
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);
  if (LOCAL && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(q.get('mvto') || '')) NEW = q.get('mvto');
  if (LOCAL && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(q.get('from') || '')) OLD = q.get('from');
  var isOld = /\.github\.io$/.test(host) || (LOCAL && q.has('mvold'));
  var isNew = !isOld && q.get('import') === '1';
  if (!isOld && !isNew) return;

  var SKIP = /^stroi-(auth|cloud-)/;   // вход и облачни отметки — не
  var SAVE = /^stroi-save-v1(-s\d)?$/;
  var dayOf = function (v) { try { var s = JSON.parse(v); return s && typeof s === 'object' ? +s.day || 0 : -1; } catch (e) { return -1; } };
  var ls = function () { try { return window.localStorage; } catch (e) { return null; } };

  // ── екранът: останалата страница (importmap, game.js…) става невидим текст — <plaintext> поглъща всичко след този скрипт; играта не тръгва,
  // а страницата се рисува нормално (с window.stop() в <head> екранът оставаше празен)
  document.write('<plaintext style="display:none">');
  function screen(html) {
    var b = document.body; [].slice.call(b.children).forEach(function (x) { if (x.tagName !== 'PLAINTEXT') x.remove(); });
    var box = document.createElement('div'); box.style.width = 'min(460px,100%)'; b.appendChild(box);
    b.style.cssText = 'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070b;color:#e6edf6;font:15px/1.6 system-ui,sans-serif;padding:16px;box-sizing:border-box';
    box.innerHTML = '<div style="width:min(460px,100%);background:#0c1018;border:1px solid #c9a14a;border-radius:16px;padding:22px;box-shadow:0 20px 60px #000">'
      + '<div style="font:900 22px system-ui,sans-serif;color:#ffd54a;text-align:center;margin-bottom:10px">🏗️ Строителна империя</div>' + html + '</div>';
    return b;
  }
  var BTN = 'display:block;width:100%;box-sizing:border-box;padding:13px;border:0;border-radius:12px;background:#f5b942;color:#111;font:800 17px system-ui,sans-serif;cursor:pointer;text-align:center;text-decoration:none;margin-top:10px';
  var BTN2 = 'display:block;width:100%;box-sizing:border-box;padding:10px;border:1px solid #3a4560;border-radius:10px;background:#1b2433;color:#e6edf6;font:700 14px system-ui,sans-serif;cursor:pointer;text-align:center;text-decoration:none;margin-top:8px';

  // ════ стар адрес ════
  if (isOld) {
    var path = location.pathname.replace(/^\/stroitelna-imperia(?=\/|$)/, '') || '/';
    var p = new URLSearchParams(location.search); p.delete('mvold'); p.delete('mvto');
    var ps = p.toString(), target = NEW + path + (ps ? '?' + ps : '') + location.hash;
    var L = ls(), data = {};
    if (L) for (var i = 0; i < L.length; i++) { var k = L.key(i); if (/^stroi-/.test(k) && !SKIP.test(k)) data[k] = L.getItem(k); }
    var hasSave = Object.keys(data).some(function (k) { return SAVE.test(k) && dayOf(data[k]) >= 0; });
    if (!hasSave) { location.replace(target); return; }
    var go = function () {
      screen('<p style="margin:0 0 6px"><b>Играта се премести</b> на <b style="color:#ffd54a">imperia.temidasoft.com</b>.</p>'
        + '<p style="color:#a9b6c8;margin:0">Записите ти на това устройство са на стария адрес. Натисни бутона — за миг ще се отвори нов прозорец, записите ще се пренесат и играта продължава там.</p>'
        + '<button id="mvGo" style="' + BTN + '">▶ Продължи (със записите)</button><div id="mvMsg" style="font-size:13px;color:#8b96a8;min-height:18px;margin-top:8px"></div>');
      document.getElementById('mvGo').onclick = bridge;
    };
    var fallback = function (why) {
      var cur = +(L && L.getItem('stroi-slot')) || 1, sk = cur === 1 ? 'stroi-save-v1' : 'stroi-save-v1-s' + cur, raw = data[sk] || data['stroi-save-v1'] || '';
      screen('<p style="margin:0 0 6px"><b>Играта се премести</b> на <b style="color:#ffd54a">imperia.temidasoft.com</b>.</p>'
        + '<p style="color:#ff9b6b;margin:0 0 6px">' + why + '</p>'
        + '<p style="color:#a9b6c8;margin:0">Ако си влизал с имейл, записите ти са и в облака — влез на новия адрес и те ще се появят. Иначе: изтегли записа и го внеси там от „⚙️ → 💾 Записи → ⬆️ От файл“.</p>'
        + '<button id="mvRetry" style="' + BTN + '">🔁 Опитай пак (разреши изскачащия прозорец)</button>'
        + (raw ? '<a id="mvDl" style="' + BTN2 + '">⬇️ Изтегли записа (слот ' + cur + ', ден ' + dayOf(raw) + ')</a>' : '')
        + '<a href="' + target + '" style="' + BTN2 + '">➡️ Към новия адрес без записите</a>');
      document.getElementById('mvRetry').onclick = bridge;
      var dl = document.getElementById('mvDl');
      if (dl) { dl.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); dl.download = 'stroitelna-imperia-den' + dayOf(raw) + '.json'; }
    };
    var w = null, tm = 0, sent = false;
    function bridge() {
      sent = false;
      w = window.open(NEW + '/?import=1' + (LOCAL ? '&from=' + encodeURIComponent(location.origin) : ''), 'stroi_import');
      if (!w) { fallback('Браузърът спря изскачащия прозорец.'); return; }
      var m = document.getElementById('mvMsg'); if (m) m.textContent = 'Пренасям записите…';
      clearTimeout(tm); tm = setTimeout(function () { fallback('Новият адрес не отговори.'); }, 30000);
    }
    var listen = function () { window.addEventListener('message', function (e) {
      if (e.origin !== NEW || !w || e.source !== w || !e.data || typeof e.data !== 'object') return;
      if (e.data.t === 'ready' && !sent) { sent = true; w.postMessage({ t: 'stroi-data', data: data }, NEW); }
      else if (e.data.t === 'done') { clearTimeout(tm); screen('<p style="text-align:center;margin:0">✅ Записите са пренесени (' + (e.data.n | 0) + '). Отивам на новия адрес…</p>'); setTimeout(function () { location.replace(target); }, 600); }
    }); };
    setTimeout(function () { go(); listen(); }, 0);
    return;
  }

  // ════ нов адрес, ?import=1 ════
  var clean = function () { var u = new URL(location.href); u.searchParams.delete('import'); u.searchParams.delete('from'); return u.pathname + u.search + u.hash; };
  if (!window.opener) { history.replaceState(null, '', clean()); location.reload(); return; }   // отворен на ръка — просто играта
  setTimeout(function () {
    screen('<p id="mvSt" style="text-align:center;margin:0">🚚 Пренасям записите…</p>');
    var st = function (t) { var el = document.getElementById('mvSt') || screen('<p id="mvSt" style="text-align:center;margin:0"></p>').querySelector('#mvSt'); el.innerHTML = t; };
    window.addEventListener('message', function (e) {
      if (e.origin !== OLD || e.source !== window.opener || !e.data || e.data.t !== 'stroi-data' || typeof e.data.data !== 'object') return;
      var L = ls(), d = e.data.data, n = 0, kept = 0, total = 0;
      if (!L) { st('❌ Браузърът не позволява записи.'); return; }
      for (var k in d) {
        if (!Object.prototype.hasOwnProperty.call(d, k) || !/^stroi-/.test(k) || SKIP.test(k) || typeof d[k] !== 'string' || d[k].length > 8e6) continue;
        total += d[k].length; if (total > 40e6) break;
        var cur = L.getItem(k);
        if (cur != null) {
          if (!SAVE.test(k)) continue;   // настройките тук остават
          if (dayOf(d[k]) <= dayOf(cur)) { kept++; continue; }   // тук играта е по-напред (или същата) — остава
        }
        try { L.setItem(k, d[k]); n++; } catch (err) { st('❌ Няма място за записите: ' + (err && err.name || '')); return; }
      }
      window.opener.postMessage({ t: 'done', n: n, kept: kept }, OLD);
      st('✅ Пренесени: ' + n + (kept ? ' · ' + kept + ' по-нови останаха тук' : '') + '.');
      setTimeout(function () { window.close(); setTimeout(function () { location.replace(clean()); }, 300); }, 400);   // ако прозорецът не се затвори — играта тук
    });
    window.opener.postMessage({ t: 'ready' }, OLD);
  }, 0);
})();
