// config.js — откъде се зареждат тежките модели (assets/heavy) и как се отварят сгъстените. Зарежда се ПРЕДИ memfix.js и game.js.
// Локално: ASSET_BASE = 'assets/heavy/' (оригиналите). В dist/ (deploy.mjs) редът се сменя на R2: 'https://assets.imperia.temidasoft.com/'.
// Всички зареждания през three.js (GLTFLoader, TextureLoader, FileLoader, AudioLoader — общият DefaultLoadingManager) минават през
// setURLModifier: всеки адрес с „assets/heavy/“ от нашия сайт отива на ASSET_BASE — и буквалните, и сглобените (`assets/${dir}/…`,
// new URL('./assets/heavy/…', import.meta.url)). За адрес извън loader-ите (img, fetch, CSS) — heavyUrl(път).
// Сгъстените модели (_source/compress-heavy.mjs: EXT_meshopt_compression) искат MeshoptDecoder — закача се на всеки GLTFLoader при parse.
import './i18n.js';   // 🌐 lang-en (f6): езикът — пръв (речникът и преводът на страницата, преди играта да рисува)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export const ASSET_BASE = 'assets/heavy/';
const LOCAL = ASSET_BASE === 'assets/heavy/', KEY = 'assets/heavy/';
export const heavyUrl = p => { const i = p.indexOf(KEY); return ASSET_BASE + (i >= 0 ? p.slice(i + KEY.length) : p.replace(/^\/+/, '')); };

// подменените модели (същото име, ново съдържание) — версия в адреса, иначе браузърът, Cloudflare (max-age 7 дни) и service worker-ът дават стария.
// При всяка подмяна на тежък файл: добави/вдигни реда тук (пътят спрямо assets/heavy/).
const HV = { 'lm/mbs3.glb': 400, 'port/sf-grain.glb': 401, 'office/office-l2.glb': 401, 'towers/urban-tower.glb': 401, 'towers/ru-blocks.glb': 401, 'sky/sky-violet.glb': 402,
  'trains/m-elloco.glb': 401, 'trains/m-steam.glb': 401, 'trains/m-steam2.glb': 401, 'trains/m-up.glb': 401, 'trains/m-gp.glb': 401, 'trains/chs200.glb': 401, 'trains/vl82.glb': 401, 'trains/loco040.glb': 401 };
const hv = p => { const k = p.split('?')[0]; return HV[k] && !p.includes('?') ? `${p}?v=${HV[k]}` : p; };
if (!LOCAL) THREE.DefaultLoadingManager.setURLModifier(url => {
  const i = url.indexOf(KEY); if (i < 0) return url;
  if (/^[a-z]+:/i.test(url) && !url.startsWith(location.origin + '/')) return url;   // чужд адрес (CDN, blob:, data:) — не се пипа
  return ASSET_BASE + hv(url.slice(i + KEY.length));
});

const parse0 = GLTFLoader.prototype.parse;
// v3.2.2 (светещи модели нощем): материалите с KHR_materials_unlit идват като MeshBasicMaterial — без светлина; нощем светят с пълна яркост
// (палмите, камъните, A320, ВЛ82, болницата, църквата, стадионът…). Тук → MeshStandardMaterial (същите map, цвят, прозрачност, alphaTest, страна,
// цветове по върховете); мешовете без нормали получават изчислени (unlit моделите често нямат — без тях осветеният материал е черен).
// Не се пипат нарочно светещите (userData.keep / neon / emissive) и ефектите (смесване, различно от нормалното).
function gltfLit(gltf) {
  const P = gltf.parser, J = P && P.json, A = P && P.associations; if (!J || !(J.extensionsUsed || []).includes('KHR_materials_unlit') || !A) return;
  const done = new Map(), lit = m => { if (!m || !m.isMeshBasicMaterial || done.has(m)) return done.get(m) || m;
    const as = A.get(m), def = as && J.materials ? J.materials[as.materials] : (J.materials || []).find(d => d.name === m.name && (d.extensions || {}).KHR_materials_unlit);   /* копията (цветове по върховете) нямат запис — по името */
    const u = m.userData || {}; if (!def || !(def.extensions || {}).KHR_materials_unlit || u.keep || u.neon || u.emissive || m.blending !== THREE.NormalBlending) { done.set(m, m); return m; }
    const n = new THREE.MeshStandardMaterial({ name: m.name, map: m.map, color: m.color, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors, roughness: 0.8, metalness: 0 });
    n.userData = { ...u, wasUnlit: true }; done.set(m, n); return n; };
  for (const sc of gltf.scenes || [gltf.scene]) sc.traverse(o => { if (!o.isMesh || o.isSprite || o.isPoints || o.isLine) return; const m0 = o.material; o.material = Array.isArray(m0) ? m0.map(lit) : lit(m0);
    if (o.material !== m0 && o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
}
GLTFLoader.prototype.parse = function (...a) { if (!this.meshoptDecoder) this.setMeshoptDecoder(MeshoptDecoder); if (typeof a[2] === 'function') { const ok = a[2]; a[2] = gltf => { try { gltfLit(gltf); } catch (e) { console.warn('gltfLit', e); } ok(gltf); }; } return parse0.apply(this, a); };

window.__assetBase = ASSET_BASE;   // за тестовете и конзолата

// 📺 AdSense за игри (ads.js, флаг 'ads'): Publisher ID — 'ca-pub-…' или 'pub-…'. Празен = рекламите са изключени (нищо не се зарежда).
// deploy.mjs прави от него dist/ads.txt (google.com, pub-…, DIRECT, f08c47fec0942fa0).
// 🔑 Cloudflare Turnstile (флаг pw-login): sitekey за проверката срещу ботове при вход и регистрация (cloud.js). Празен = без проверка.
// Ако е попълнен, в Supabase → Auth → Bot and Abuse Protection трябва да е включен Turnstile със secret key-а (иначе обратното: Supabase иска токен, а тук го няма).
export const TURNSTILE_SITEKEY = '0x4AAAAAAFldr75V2CGjQIiZ';   // публичен (хостове imperia.temidasoft.com + localhost, Managed)
export const ADS_CLIENT = 'ca-pub-5675663846214661';

// DEV — локално true; deploy.mjs → false в dist/ (сайтът), освен с --dev (за тестовете на dist). На сайта инструментите за разработка ги няма:
//   • параметрите от адреса за тестове/отстраняване (?autotest с „rich“, „sim“…, ?debug, ?profile, ?shadercheck, ?nomemfix…) се махат от адреса,
//     преди играта да ги прочете (този модул е първият; mobile.js, ?pc=1/?phone=1, ?w=/?inv= на онлайн страницата и ?code= от входа остават);
//   • window.__dbg (конзолата на тестовете: пари, време, изгледи) не се създава; F8 (панелът за производителност) не се отваря.
export const DEV = true;
if (!DEV) {
  const DROP = ['autotest', 'nocollect', 'debug', 'profile', 'shadercheck', 'rich', 'sim', 'multi', 'estate', 'hw', 'bids', 'ext', 'city', 'plan', 'gate', 'nomemfix', 'notex512', 'notexfree'];
  try { const u = new URL(location.href); let ch = false; for (const k of DROP) if (u.searchParams.has(k)) { u.searchParams.delete(k); ch = true; }
    if (ch) history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch { }
  Object.defineProperty(window, '__dbg', { configurable: false, get: () => undefined, set() { } });   // game.js го присвоява — тихо се изпуска
  addEventListener('keydown', e => { if (e.key === 'F8') e.stopImmediatePropagation(); }, true);   // перф. панелът (perfpanel.js) слуша по-късно
}
