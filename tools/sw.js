// sw.js — бързият кеш на играта (service worker). deploy.mjs го слага в dist/sw.js: попълва версията, списъка със сглобените b-*.js и адреса на R2.
// Страниците, version.json, Supabase, рекламите — винаги от мрежата (тук не се пипат).
//   • b-*.js (сглобеният код, с хеш в името) — от кеша; при нова версия старите файлове се трият;
//   • assets/ и моделите от R2 — веднага от кеша, а отзад се проверява за по-нов (stale-while-revalidate);
//   • three.js от jsdelivr (фиксирана версия) — от кеша.
const VER = '__VER__', CODE = __CODE__, HEAVY = '__HEAVY__';
const C_CODE = 'imperia-code', C_ASSETS = 'imperia-assets', C_LIB = 'imperia-lib';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const c = await caches.open(C_CODE), keep = new Set(CODE.map(f => new URL(f, self.registration.scope).href));
  for (const r of await c.keys()) if (!keep.has(r.url)) await c.delete(r);   // кодът на старите версии
  await self.clients.claim();
})()));

const ok = r => r && r.ok && (r.type === 'basic' || r.type === 'cors');
async function cacheFirst(name, req) {
  const c = await caches.open(name), hit = await c.match(req); if (hit) return hit;
  const r = await fetch(req); if (ok(r)) c.put(req, r.clone()).catch(() => { }); return r;
}
async function swr(name, req, ev) {
  const c = await caches.open(name), hit = await c.match(req);
  const net = fetch(req).then(r => { if (ok(r)) return c.put(req, r.clone()).catch(() => { }).then(() => r); return r; });
  if (hit) { ev.waitUntil(net.catch(() => { })); return hit; }
  return net;
}

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url), own = u.origin === location.origin;
  if (own && /^\/b-[^/]+\.js$/.test(u.pathname)) return e.respondWith(cacheFirst(C_CODE, r));
  if (own && u.pathname.startsWith('/assets/')) return e.respondWith(swr(C_ASSETS, r, e));
  if (HEAVY && r.url.startsWith(HEAVY)) return e.respondWith(swr(C_ASSETS, r, e));
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.startsWith('/npm/three@')) return e.respondWith(cacheFirst(C_LIB, r));
});
