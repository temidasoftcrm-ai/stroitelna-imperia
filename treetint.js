// 🍂 treetint.js — tree-colors (T2; потребителят: „тези дървета, които имаме, … да ги оцветим“): цветни варианти на дърветата без нови GLB —
// шейдър върху короната (листата): няколко нюанса зелено (светло пролетно, тъмно лятно, маслинено; синкаво при иглолистните), есен
// (жълто/оранжево/червено/кафяво — всяко дърво своя цвят) и голи клони зимата в студените градове.
// Всяко дърво има постоянно „семе“ (0…1): при InstancedMesh — атрибут aSeed, при отделните копия — 8 материала (uSeed по кофи).
// Сезонът — общи uniforms (uAut — делът на пожълтелите, uBare — на голите, uSpring — пролетното светло зелено), сменят се веднъж на ден,
// без да се строи нищо наново.
//   ttPatchTree(scene, kind)  — kind: 'leaf' (широколистно), 'con' (иглолистно), 'palm'; сменя материалите на листата с оцветими
//   ttVariant(obj, seed)       — копие на дърво (model()): материалите — от кофата на семето
//   ttInstMat(mat)             — за InstancedMesh (с атрибут aSeed в геометрията); иначе — същият материал
//   ttSeason({ day, monthOf, lat, warm }) — обновява uniforms
import * as THREE from 'three';

const U = { uAut: { value: 0 }, uBare: { value: 0 }, uSpring: { value: 0 } };
// горският пакет: Tree_Branches_01 — смърч (иглички), Tree_Branches_02 — бреза; атласът на далечните дървета е смесен — като иглолистни (без есен)
const SKIP = /trunk|trank|bark|rock|stem/i, LEAVES = /branch|leav|leaf|atlas|crown|needle/i, CONIF = /Tree_Branches_01|atlas|needle|pine/i, BUCKETS = 8;

const VERT_HEAD = `#ifdef TT_INST
attribute float aSeed;
#endif
uniform float uSeed; uniform vec2 uYr;
varying float vTTSeed; varying float vTTh;
`;
const FRAG_HEAD = `uniform float uAut; uniform float uBare; uniform float uSpring;
varying float vTTSeed; varying float vTTh;
`;
// листата: при отделен материал за листата (TT_ALL) — целият; иначе (Meshy — една текстура за ствола и короната) — по зеления цвят на текстурата
const FRAG_TINT = `{
  float ttR = vTTSeed; vec3 c = diffuseColor.rgb;
#ifdef TT_ALL
  float msk = 1.0;
#else
  float msk = smoothstep(0.0, 0.045, c.g - max(c.r * 0.92, c.b));
#endif
  float k = fract(ttR * 13.7);
#ifdef TT_CON
  vec3 tnt = k < 0.34 ? vec3(1.0) : k < 0.67 ? vec3(0.78, 0.88, 0.8) : vec3(0.8, 0.95, 1.14);
  c = mix(c, c * tnt, msk);
#else
  vec3 tnt = k < 0.25 ? vec3(1.0) : k < 0.5 ? vec3(1.13, 1.16, 0.8) : k < 0.75 ? vec3(0.74, 0.84, 0.7) : vec3(1.08, 0.97, 0.62);
  tnt = mix(tnt, vec3(1.2, 1.22, 0.72), uSpring * step(0.35, fract(ttR * 3.3)));
  vec3 g = c * tnt;
#ifndef TT_PALM
  float l = min(1.15, 0.38 + dot(c, vec3(0.3, 0.59, 0.11)) * 2.4), a = fract(ttR * 5.3);
  vec3 au = a < 0.3 ? vec3(1.0, 0.8, 0.2) : a < 0.55 ? vec3(1.0, 0.52, 0.12) : a < 0.75 ? vec3(0.86, 0.24, 0.1) : vec3(0.64, 0.42, 0.2);
  g = mix(g, au * l, step(ttR, uAut));
#ifdef TT_ALL
  if (ttR < uBare) discard;
#else
  float lu = dot(c, vec3(0.3, 0.59, 0.11)), mxc = max(c.r, max(c.g, c.b)), sat = (mxc - min(c.r, min(c.g, c.b))) / max(mxc, 0.001);
  bool bark = (c.r > c.g * 1.04 && c.g > c.b * 1.02 && lu > 0.1) || (lu > 0.55 && sat < 0.18);
  bark = bark || (vTTh < 0.4 && c.r >= c.g * 0.95 && c.g >= c.b * 0.9);
  if (ttR < uBare && !bark) discard;
#endif
#endif
  c = mix(c, g, msk);
#endif
  diffuseColor.rgb = c;
}
`;
// вкарва оцветяването в шейдъра на материала o (и на сянката му — MeshDepthMaterial със същото „голо“)
function inject(o, uSeed, uYr, key) {
  o.onBeforeCompile = sh => {
    TT(o).sh = sh; Object.assign(sh.uniforms, U, { uSeed, uYr });
    sh.vertexShader = VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef TT_INST
  vTTSeed = aSeed;
#else
  vTTSeed = uSeed;
#endif
  vTTh = (position.y - uYr.x) / max(uYr.y - uYr.x, 1e-4);`);
    sh.fragmentShader = FRAG_HEAD + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_TINT);
  };
  o.customProgramCacheKey = () => key + Object.keys(o.defines).filter(k => k.startsWith('TT_')).sort().join();
}
// оцветимото на материала — в __tt (не в userData: three клонира userData през JSON — кофите/сянката са кръгови, T3: NY)
const TT = o => o.__tt || Object.defineProperty(o, '__tt', { value: {}, enumerable: false }).__tt;
function patch(m, defs, yr = [0, 1]) {
  const o = m.clone(); o.defines = { ...(o.defines || {}), ...defs };
  const uSeed = { value: 0.5 }, uYr = { value: new THREE.Vector2(yr[0], yr[1]) }; o.userData = { ...o.userData, tt: true }; TT(o).uSeed = uSeed;
  inject(o, uSeed, uYr, 'tt');
  // сянката: голото дърво — без корона и в сянката (customDepthMaterial на мешовете)
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map || null, alphaTest: m.alphaTest || 0, side: m.side });
  d.defines = { ...defs }; inject(d, uSeed, uYr, 'ttd'); TT(o).depth = d;
  return o;
}
// сменя материалите на листата в дървото (A[…].scene) с оцветимите — веднъж; копията (clone) ги наследяват
export function ttPatchTree(scene, kind = 'leaf') {
  const done = new Map();
  scene.traverse(o => { if (!o.isMesh || !o.material || Array.isArray(o.material)) return; const m = o.material; if (m.userData.tt || SKIP.test(m.name || '') || !m.isMeshStandardMaterial) return;
    if (!done.has(m)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox, yr = [bb.min.y, bb.max.y]; const defs = { ...(LEAVES.test(m.name || '') ? { TT_ALL: '' } : {}), ...(kind === 'con' || CONIF.test(m.name || '') ? { TT_CON: '' } : kind === 'palm' ? { TT_PALM: '' } : {}) };
      const base = patch(m, defs, yr), bk = Array.from({ length: BUCKETS }, (_, i) => { const v = i ? patch(m, defs, yr) : base; TT(v).uSeed.value = (i + 0.5) / BUCKETS; return v; });
      TT(base).buckets = bk; let inst = null; TT(base).inst = () => inst || (inst = patch(m, { ...defs, TT_INST: '' }, [0, 1]))   /* realTrees пече геометрията до височина 0…1 */; done.set(m, base); }
    o.material = done.get(m); o.customDepthMaterial = TT(o.material).depth; });
  return scene;
}
// копие на дърво: материалите на листата — от кофата на семето (0…1)
export function ttVariant(obj, seed) {
  const b = Math.min(BUCKETS - 1, Math.floor(((seed % 1) + 1) % 1 * BUCKETS));
  obj.traverse(o => { if (o.isMesh && o.material && o.material.__tt && o.material.__tt.buckets) { o.material = o.material.__tt.buckets[b]; o.customDepthMaterial = o.material.__tt.depth; } });
  return obj;
}
export const ttSet = (aut, bare, spring = 0) => { U.uAut.value = aut; U.uBare.value = bare; U.uSpring.value = spring; };
export const ttUniforms = () => ({ aut: U.uAut.value, bare: U.uBare.value, spring: U.uSpring.value });
export const ttInstMat = m => (m && m.__tt && m.__tt.inst ? m.__tt.inst() : m);
export const ttOf = m => (m && m.__tt) || null;   // за другите модули: { buckets, depth, inst, sh, uSeed }
// сезонът (календарът на играта — 30-дневни месеци): есента от 15.09 (все повече до края на октомври), зимата — голи в студените градове,
// пролетта — светло зелено (март–май); южното полукълбо — с 6 месеца разлика; топлите градове — малко есен, без голи; тропиците — само зелено
export function ttSeason({ day, monthOf, lat = 45, warm = false }) {
  let m = monthOf(day); const d = (day - 1) % 30 + 1; if (lat < 0) m = (m + 6) % 12;
  const t = m * 30 + d, tropic = Math.abs(lat) < 23, autMax = tropic ? 0 : warm ? 0.3 : 0.9, bareMax = tropic || warm ? 0 : 1;
  const sm = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  let aut = 0, bare = 0, spring = 0;
  if (t >= 255) { aut = autMax * sm(255, 305, t); bare = bareMax * sm(310, 345, t); }   // 15.09 → края на октомври; голи — от средата на ноември до средата на декември
  else if (t < 60) { aut = autMax; bare = bareMax; }   // януари–февруари
  else if (t < 90) { aut = autMax * (1 - sm(60, 75, t)); bare = bareMax * (1 - sm(62, 85, t)); spring = sm(65, 85, t); }   // март — разлистване
  else if (t < 165) spring = 1 - sm(120, 165, t);   // април–средата на юни
  U.uAut.value = aut; U.uBare.value = bare; U.uSpring.value = spring;
  return { aut, bare, spring };
}
