// online-btn.js — бутон „🌐 Онлайн“ в горната лента на самостоятелната игра: отваря „Онлайн империя“ (online.html).
// Нищо не се пренася: онлайн режимът е отделен свят с прогрес на сървъра.
if (!/[?&]autotest/.test(location.search)) {
  const mount = () => {
    const top = document.getElementById('top'); if (!top || document.getElementById('onlineBtn')) return;
    const b = document.createElement('a'); b.id = 'onlineBtn'; b.className = 'btn2'; b.href = 'online.html'; b.textContent = '🌐 Онлайн';
    b.title = 'Онлайн империя — общ свят с други играчи (отделен от тази игра)'; b.style.textDecoration = 'none'; b.style.color = 'var(--txt)';
    top.insertBefore(b, document.getElementById('cloudBtn') || top.querySelector('.sp'));
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(mount, 500)); else setTimeout(mount, 500);
}
