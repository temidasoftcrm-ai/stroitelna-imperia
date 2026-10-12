// mobile.js — телефон (iPhone/Android): горната лента на 2 реда — горе пари/ден/час/скорост/карта, долу всички бутони
// в една лента, която се плъзга хоризонтално; десният панел се свива с повторно натискане на активния таб.
// Зарежда се като обикновен скрипт преди game.js, затова и бутоните, които game.js добавя по-късно, отиват в долния ред.
(function () {
  const phone = Math.min(screen.width, screen.height) < 600 || Math.min(innerWidth, innerHeight) < 500;
  if (!phone && !/[?&]mobile\b/.test(location.search)) return;
  document.body.classList.add('mob');
  const top = document.getElementById('top');
  const ROW1 = new Set(['money', 'day', 'clock', 'wx', 'speed']);
  const inRow1 = n => n.nodeType === 1 && (ROW1.has(n.id) || n.classList.contains('logo') || [...ROW1].some(id => n.querySelector && n.querySelector('#' + id)));
  const row2 = document.createElement('div'); row2.id = 'topRow2';
  const ins = Element.prototype.insertBefore, app = Element.prototype.appendChild;
  // нови елементи в горната лента: важните остават горе, другите — в плъзгащия се ред (в реда, в който game.js ги подрежда)
  top.insertBefore = function (n, ref) {
    if (n === row2 || inRow1(n)) return ins.call(top, n, ref && ref.parentNode === top ? ref : row2);
    return ins.call(row2, n, ref && ref.parentNode === row2 ? ref : null);
  };
  top.appendChild = function (n) { return n === row2 || inRow1(n) ? ins.call(top, n, row2) : app.call(row2, n); };
  for (const n of [...top.children]) if (!inRow1(n)) app.call(row2, n);
  app.call(top, row2);
  // за всеки случай: каквото попадне директно в лентата по друг начин — също в долния ред
  new MutationObserver(() => { for (const n of [...top.children]) if (n !== row2 && !inRow1(n)) app.call(row2, n); }).observe(top, { childList: true });
  // колелцето/плъзгането по долния ред — хоризонтално
  row2.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { row2.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });

  // панелът: повторно натискане на активния таб го свива до лентата с табовете, всеки таб го отваря пак
  const tabs = document.getElementById('tabs');
  if (tabs) tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-t]'); if (!b) return;
    if (b.classList.contains('on') && !document.body.classList.contains('panMin')) document.body.classList.add('panMin');
    else document.body.classList.remove('panMin');
  }, true);
  const orient = () => document.body.classList.toggle('land', innerWidth > innerHeight);
  orient(); addEventListener('resize', orient);
})();
