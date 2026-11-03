// lmnight.js — 🌃 процедурната нощ на забележителностите (собственикът, 01.11: „да топ са вкарваме ги“; одобрено в Blender — scratchpad lm5/*.blend).
// Без изпечена карта: светлината се смята в шейдъра от мястото в модела (q — 0…1 по кутията на модела, y — нагоре) и яркостта на текстурата (lum),
// по същата формула като прегледа в Blender (vertex color 'night'). Нощем: emissiveIntensity = нощта × nfK (daynight.js през NF_MATS); фасадата тъмнее.
//   lm-night-istanbul: Босфорският мост; lm-night-rome: Колизеумът; lm-night-sofia: Александър Невски; lm-night-sf: Голдън Гейт; lm-night-london: Уестминстър с Биг Бен (циферблатите), Лондонското око.
//   lm-night-istanbul2: Света София — златисто, минаретата бяло-златисти, поясът прозорци под купола; lm-night-berlin: Бранденбургската врата — топло отдолу нагоре, квадригата златиста.
//   lm-night-barcelona: Саграда Фамилия — топло златисто, на празник синьо и червено по фасадите.
//   lm-night-rock: 30 Rock — хладно бяло отдолу нагоре, светли ребра, разпръснати топли прозорци.
//   lm-night-toronto: CN Tower — стволът в сменящ се цвят на LED прожекторите, прозорците на шайбата — топло бели.
//   lm-night-tokyo: Токийската кула — наситено оранжева решетка (Landmark Light), двете обсерватории — бели пояси, антената — бяла;
//                   Tokyo Skytree — синя решетка (нагоре по-светла), бавно минава в лилаво и обратно (Iki ↔ Miyabi), обсерваториите — бели пръстени.
import * as THREE from 'three';
import { NF_MATS } from './nightfloors.js';
import { feature } from './lab/feature.js';
import { holidayNow } from './empirenight.js';   // празниците (Нова година, 4 юли, Коледа) — Лондонското око в розово-червено

// Москва (Св. Василий, Кремъл): топъл прожектор × цветът; Спаската — циферблатите (кръг r 2,4 м на 42,2 м от 71 м, по четирите стени)
const MOSCOW = `
    vec3 tc = dc; float tm = (tc.r + tc.g + tc.b) / 3.0; tc = clamp(tm + 1.3 * (tc - tm), 0.0, 1.0);
    float mx = max(tc.r, max(tc.g, tc.b)), mn = min(tc.r, min(tc.g, tc.b)), sat = (mx - mn) / max(mx, 1e-4);
    float red = clamp((tc.r - max(tc.g, tc.b)) / max(tc.r, 1e-4), 0.0, 1.0), keep = 0.75 * clamp((sat - 0.15) / 0.35, 0.0, 1.0) * (1.0 - red);
    float L = dot(tc, vec3(0.2126, 0.7152, 0.0722));
    vec3 c = tc * mix(vec3(1.0, 0.62, 0.30), vec3(1.0), keep) * (1.0 - 0.5 * q.y) * (1.0 - 0.35 * clamp((L - 0.35) / 0.45, 0.0, 1.0)) * 1.35;
    if (glass > 0.5) { float u = min(abs(q.x - 0.5) * s.x, abs(q.z - 0.5) * s.z), d = length(vec2(u, q.y - 0.5944)), k = clamp((0.0338 - d) / 0.0085, 0.0, 1.0);
      c = mix(c, vec3(1.0, 0.9, 0.7) * (0.25 + 2.2 * L), k); }`;
const T = { value: 0 }, HOL = { value: 0 };
// kind → { flag, nfK, glsl } — glsl: тяло на функция, вход q (vec3, 0…1 по кутията на модела), s (размерите на кутията / височината), lum (float), glass (float 0/1), t (s), dc (vec3 — цветът на повърхността, линеен); изход vec3 c
const CFG = {
  tokyotower: { flag: 'lm-night-tokyo', nfK: 0.85, glsl: `
    float h = q.y, k = (0.18 + pow(lum, 1.2)) * (1.15 - 0.4 * h);
    vec3 c = vec3(1.0, 0.38, 0.08) * k;
    if (h > 0.8) c = vec3(1.0, 0.95, 0.85) * 0.6 * (0.18 + pow(lum, 1.2));
    if ((h > 0.44 && h < 0.49) || (h > 0.735 && h < 0.765)) c = vec3(1.0, 0.95, 0.85);` },
  skytree: { flag: 'lm-night-tokyo', nfK: 0.7, glass: /boli/i, glsl: `
    float h = q.y, k = (0.15 + 0.9 * lum) * (0.6 + 0.6 * h), mi = smoothstep(-0.25, 0.25, sin(t * 0.021));   // ~5 мин синьо, ~5 мин лилаво
    vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(0.55, 0.25, 1.0), mi), wh = vec3(0.9, 0.95, 1.0);
    vec3 c = col * k;
    if (glass > 0.5) c = mix(vec3(0.7, 0.85, 1.0), vec3(0.85, 0.75, 1.0), mi) * 0.6;
    if (h > 0.75) c = wh * 0.5 * k;
    if ((h > 0.545 && h < 0.57) || (h > 0.70 && h < 0.72)) c = wh * 1.2;` },
  // lm-night-sf: Голдън Гейт — кулите златисто-оранжеви (International Orange), по-силно отдолу; въжетата — по-слабо; по ръбовете на платното — редица топли лампи; платното — тъмно (q.z — по дължината)
  goldengate: { flag: 'lm-night-sf', nfK: 0.85, glsl: `
    float w = q.x, L = q.z, h = q.y;
    bool tower = (abs(L - 0.2) < 0.035 || abs(L - 0.8) < 0.035) && h > 0.06;
    vec3 tw = vec3(1.0, 0.42, 0.1), c = vec3(1.0, 0.55, 0.18) * 0.35 * (0.2 + lum);
    if (tower) c = tw * 0.85 * (0.3 + lum) * (0.7 + 0.3 * (1.0 - h));
    if (h < 0.13 && !tower) { c = tw * 0.05; if (h > 0.075 && abs(w - 0.5) > 0.33 && abs(w - 0.5) < 0.4 && fract(L * 90.0) < 0.14) c = vec3(1.0, 0.72, 0.32) * 1.8; }` },
  // lm-night-london: Уестминстър — топли златисти прожектори по фасадите; часовниковата кула (до единия край) — по-ярък връх и 4 светещи кремаво-бели циферблата (кръгове в средата на стените)
  westminster3: { flag: 'lm-night-london', nfK: 1.0, glsl: `
    vec3 warm = vec3(1.0, 0.46, 0.07), c = warm * (0.12 + 1.9 * pow(lum, 1.5));   // собственикът (снимка, „виж цветовете“): наситено златисто-оранжево, ярко
    float dx = (q.x - 0.038) * s.x, dy = (q.z - 0.895) * s.z, dz = (q.y - 0.555) * s.y;
    bool bb = abs(dx) < 0.1 && abs(dy) < 0.1;
    if (bb && q.y > 0.66) c = warm * (0.5 + 1.6 * pow(lum, 1.1));
    float r = abs(dx) > abs(dy) ? length(vec2(dy, dz)) : length(vec2(dx, dz)), e = max(abs(dx), abs(dy));
    if (bb && r < 0.05 && e > 0.04 && q.y > 0.48 && q.y < 0.63) c = vec3(1.0, 0.9, 0.62) * 2.0;` },
  // lm-night-london: Лондонското око — обиколката и спиците сини (празник — розово-червени), кабинките — топло бяло, краката — тъмни;
  // частите — по цвета от палитрата (линейно: сивото на обиколката ~0,1, окачването ~0,2, белите кабинки > 0,6, тъмносиньото < 0,05)
  londoneye2: { flag: 'lm-night-london', nfK: 1.0, glsl: `
    vec3 col = mix(vec3(0.12, 0.35, 1.0), vec3(1.0, 0.2, 0.45), hol), c = vec3(0.02, 0.025, 0.04);
    if (lum > 0.06 && lum < 0.14) c = col * 1.1;
    else if (lum >= 0.14 && lum < 0.3) c = col * 0.35;
    else if (lum > 0.6) c = vec3(1.0, 0.93, 0.8);` },
  // lm-night-sofia: Александър Невски (собственикът, 01.11: снимка — „ето как свети“; одобрено в Blender „ок вкарваме го“): фасадите — наситено златисто-жълти
  // прожектори, барабанът под главния купол — кремаво бял, зелените куполи — тъмнозелени, позлатените — златни, прозорците и вратите — тъмни (частите — по материалите AN_*)
  nevsky: { flag: 'lm-night-sofia', nfK: 1.0, cls: n => /roof_Gold/.test(n) ? 2 : n === 'AN_roof' ? 1 : /windows/.test(n) ? 3 : /door/.test(n) ? 4 : 0, glsl: `
    float h = q.y, k = clamp((h - 0.55) / 0.15, 0.0, 1.0), cl = glass;
    vec3 c = mix(vec3(1.0, 0.6, 0.18), vec3(1.0, 0.9, 0.72), k) * (0.12 + 1.0 * pow(lum, 1.6));
    if (cl > 0.5 && cl < 1.5) c = vec3(0.2, 0.55, 0.32) * (0.1 + 0.6 * pow(lum, 1.3));
    else if (cl > 1.5 && cl < 2.5) c = vec3(1.0, 0.62, 0.12) * (0.4 + 1.3 * lum);
    else if (cl > 2.5 && cl < 3.5) c = vec3(1.0, 0.6, 0.3) * 0.05;
    else if (cl > 3.5) c = vec3(1.0, 0.6, 0.3) * 0.1;` },
  // lm-night-rome: Колизеумът (colosseo4; собственикът, 02.11: „ок е, давай следващия“; одобрено в Blender): арките на всички етажи светят топло златисто-оранжево
  // отвътре (свети коридорът зад тях — елипсата на радиус 0,66–0,88), външният камък — по-тъмен, отдолу по-светъл; арената и трибуните — леко
  colosseo4: { flag: 'lm-night-rome', nfK: 1.0, glsl: `
    float h = q.y, e = length((q.xz - 0.5) * 2.0);
    vec3 warm = vec3(1.0, 0.5, 0.18), c = warm * (0.02 + 0.45 * lum) * (1.2 - 0.8 * h);
    if (e > 0.66 && e < 0.88) c = vec3(1.0, 0.45, 0.1) * (0.8 + 1.0 * lum);
    else if (e <= 0.66) c = warm * (0.03 + 0.3 * lum);` },
  // lm-night-istanbul: Босфорският мост (собственикът, 02.11: „да, ок е“; одобрено в Blender): въжетата и пилоните — наситени цветни LED, бавна вълна по дължината
  // (синьо → лилаво → червено → жълто-зелено); по двата ръба на платното — топли лампи, платното — тъмно (q.x — по дължината, без текстура)
  bosphorus: { flag: 'lm-night-istanbul', nfK: 1.0, double: true, glsl: `   // double — в модела (Meshy) кулите и въжетата са с обърнати лица: с една страна не се виждаха изобщо
    float x = q.x, h = q.y, hue = fract(0.62 + 0.38 * sin(t * 0.05 + x * 3.0));
    vec3 led = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    bool pyl = (abs(x - 0.175) < 0.035 || abs(x - 0.825) < 0.035) && h > 0.2;
    vec3 c = vec3(0.015);
    if (pyl) c = led * 0.45; else if (h > 0.205) c = led * 0.75;
    if (abs(q.z - 0.5) > 0.38 && h > 0.17 && h < 0.215 && fract(x * 160.0) < 0.18) c = vec3(1.0, 0.8, 0.5) * 1.5;` },
  // lm-night-toronto: CN Tower (собственикът, 02.11 — снимките: целият ствол в един наситен цвят от LED прожекторите, който се сменя; прегледът в Blender — scratchpad cn/night.py):
  // стволът и антената — в цвета (детайлът на бетона остава), бавно: лилаво-розово → синьо → червено-оранжево → зелено (~40 s всеки, ~8 s преливане);
  // шайбата — по-тъмно в цвета, белият пръстен под нея — ярка цветна лента, двата пояса прозорци (тъмното стъкло) — постоянно топло бели; SkyPod — светъл; основата — тъмна
  cntower: { flag: 'lm-night-toronto', nfK: 1.0, glsl: `
    float h = q.y, ph = t / 48.0, i0 = mod(floor(ph), 4.0), i1 = mod(i0 + 1.0, 4.0), f = smoothstep(0.83, 1.0, fract(ph));
    vec3 P0 = vec3(1.0, 0.12, 0.75), P1 = vec3(0.18, 0.28, 1.0), P2 = vec3(1.0, 0.22, 0.04), P3 = vec3(0.15, 1.0, 0.3);
    vec3 a = i0 < 0.5 ? P0 : i0 < 1.5 ? P1 : i0 < 2.5 ? P2 : P3, b = i1 < 0.5 ? P0 : i1 < 1.5 ? P1 : i1 < 2.5 ? P2 : P3, led = mix(a, b, f);
    float k = 0.3 + 0.9 * lum;
    vec3 c = led * k;
    if (h < 0.025) c = vec3(0.04, 0.03, 0.02);
    if (h > 0.588 && h < 0.668) c = led * k * 0.35;
    if (h > 0.588 && h < 0.603) c = led * 1.4;
    if (h > 0.603 && h < 0.628) c = lum < 0.16 ? vec3(1.0, 0.82, 0.55) : led * 0.25;
    if (h > 0.817 && h < 0.842) c = vec3(1.0, 0.95, 0.88);` },
  // lm-night-rock: 30 Rock / Рокфелер Сентър (собственикът, 02.11 — „май бялата е най-хубава“, снимка rock-60; прегледът в Blender — scratchpad rock/night.py):
  // хладно-неутрално бяло от прожекторите отдолу нагоре (нагоре леко затихва); светлите вертикални ребра изпъкват, нишите между тях — тъмни (по яркостта на текстурата);
  // разпръснати топли прозорци — ~8 % от тъмните (етаж × колона, случайно); подиумът — като фасадата, по-тъмен
  rockefeller2: { flag: 'lm-night-rock', nfK: 1.0, glsl: `
    float h = q.y, up = 1.1 - 0.6 * h, rib = smoothstep(0.06, 0.22, lum);
    vec3 c = vec3(0.85, 0.92, 1.0) * (0.04 + 0.75 * rib) * up;
    float fl = floor(h * 120.0), cl = floor((q.x + q.z) * 90.0), r = fract(sin(fl * 12.9898 + cl * 78.233) * 43758.5453);
    if (lum < 0.06 && r < 0.08) c = vec3(1.0, 0.78, 0.45);` },
  // lm-night-moscow: Св. Василий и Кремъл (собственикът, 02.11: „Св. Василий е готов, вкарвай го“; прегледът в Blender — scratchpad lm5/kremlin-night.blend, kremn.py):
  // всичко — топло осветено отдолу (нагоре затихва), светлината = цветът на текстурата × топлия прожектор: тухлата — наситено червено-оранжева, белият камък — кремав;
  // наситеното синьо/зелено (куполите) остава в своя цвят; Спаската (glass = 1) — светлите циферблати и от четирите страни
  stbasil: { flag: 'lm-night-moscow', nfK: 1.0, glsl: MOSCOW },
  kremlin: { flag: 'lm-night-moscow', nfK: 1.0, cls: (m, o) => o === 'kr_spass' ? 1 : 0, glsl: MOSCOW },
  // lm-night-barcelona: Саграда Фамилия (собственикът, 02.11 — снимката sagrada-61; прегледът в Blender — scratchpad sag/night.py): обикновено — топло златисто от прожекторите,
  // вдлъбнатините тъмни, кулите нагоре по-ярки, кръстът на централната кула — светъл; празник (holidayNow, както Лондонското око) — фасадите отдолу в синьо (средата) и червено (вдясно),
  // с меки преходи, нагоре минават в златисто. Вместо nightfloors 'floodUp' (night-sagrada): lmNight връща модела преди prepNightFloors
  sagrada: { flag: 'lm-night-barcelona', nfK: 1.0, glsl: `
    float h = q.y, kc = 0.05 + 2.2 * lum * lum, low = (1.0 - smoothstep(0.55, 0.75, h)) * hol;
    vec3 c = vec3(1.0, 0.58, 0.18) * (0.03 + 2.4 * lum * lum) * (0.65 + 0.9 * h);
    float bw = smoothstep(0.3, 0.42, q.x) * (1.0 - smoothstep(0.58, 0.7, q.x)), rw = smoothstep(0.62, 0.76, q.x);
    c = mix(c, vec3(0.1, 0.28, 1.0) * kc, low * bw * 0.9);
    c = mix(c, vec3(1.0, 0.14, 0.1) * kc, low * rw * 0.9);
    if (h > 0.93) c = vec3(1.8, 1.65, 1.35);` },
  // lm-night-istanbul2: Света София (собственикът, 03.11: „забележителностите можем да ги правим“; прегледът в Blender — scratchpad lm2/night.py): стените и контрафорсите —
  // топло златисто (по текстурата), четирите минарета — бяло-златисто, нагоре по-ярко; куполът — топъл, с по-светъл пояс прозорци в основата му
  // (местата — по модела: минаретата в ъглите (q.x, 1 − q.z) ≈ (0,17; 0,10), (0,17; 0,87), (0,66; 0,08), (0,66; 0,87); куполът — около (0,42; 0,47), от 0,6 нагоре)
  hagia: { flag: 'lm-night-istanbul2', nfK: 1.0, glsl: `
    float h = q.y, zy = 1.0 - q.z;
    vec3 c = vec3(1.0, 0.6, 0.25) * (0.05 + 3.0 * lum * lum) * (0.8 + 0.5 * h);
    float mn = min(min(length(vec2(q.x - 0.17, zy - 0.10)), length(vec2(q.x - 0.17, zy - 0.87))), min(length(vec2(q.x - 0.66, zy - 0.08)), length(vec2(q.x - 0.66, zy - 0.87))));
    float dd = length(vec2((q.x - 0.42) * s.x, (zy - 0.47) * s.z));
    if (dd < 0.26 && h > 0.6) { c = vec3(1.0, 0.66, 0.32) * (0.12 + 1.4 * lum); if (h > 0.62 && h < 0.665) c = vec3(1.0, 0.8, 0.45) * (0.9 + 1.2 * lum); }
    if (mn < 0.045 && h > 0.2) c = vec3(1.0, 0.88, 0.65) * (0.25 + 1.1 * h) * (0.45 + lum);` },
  // lm-night-berlin: Бранденбургската врата (brandenburg2 → brandenburg3.glb): топло жълтеникаво-бяло отдолу нагоре — лицата на колоните светли, проходите между тях (в дълбочина) по-тъмни;
  // квадригата горе (средата, над 0,68) — топло златиста, малко по-силно. berlinLights не пипа този модел (един меш, без възли Quadriga/Dome)
  brandenburg2: { flag: 'lm-night-berlin', nfK: 1.0, glsl: `
    float h = q.y, zy = 1.0 - q.z, rec = h < 0.42 ? mix(0.25, 1.0, smoothstep(0.22, 0.4, abs(zy - 0.5))) : 1.0;
    vec3 c = vec3(1.0, 0.72, 0.42) * (0.02 + 1.5 * lum * lum) * (1.25 - 0.75 * h) * rec;
    if (h > 0.68 && abs(q.x - 0.5) < 0.1) c = vec3(1.0, 0.7, 0.38) * (0.3 + 1.2 * lum);` },
  // lm-night-paris: Нотр Дам (прегледът в Blender — scratchpad lm6/lm-night3.blend, n.py): топло златист прожектор — западната фасада и кулите (q.x < 0,17)
  // най-ярко, нагоре затихва (контрафорсите долу — светли); покривът тъмен, шпилът — слабо; розетките (западната между кулите и двете на трансепта) — меко виолетово
  notredame: { flag: 'lm-night-paris', nfK: 1.0, glsl: `
    float L = dot(dc, vec3(0.2126, 0.7152, 0.0722));
    float fac = 1.0 - smoothstep(0.17, 0.27, q.x), up = clamp(1.2 - 0.9 * q.y, 0.25, 1.2), det = 0.25 + 2.2 * pow(L, 1.3);
    vec3 c = (dc / max(L, 1e-3) * 0.6 + 0.4) * vec3(1.0, 0.58, 0.22) * (0.2 + 0.6 * fac) * up * det * 0.9;
    bool spire = abs(q.x - 0.535) < 0.035 && abs(q.z - 0.5) < 0.07;
    if (q.x > 0.25 && q.y > 0.43 && !spire) c *= 0.08;
    if (spire && q.y > 0.62) c *= 0.5;
    float d = length(vec2((q.z - 0.5) * s.z, q.y - 0.42)), k = (1.0 - smoothstep(0.035, 0.053, d)) * step(0.12, q.x) * step(q.x, 0.18);
    float d2 = length(vec2((q.x - 0.544) * s.x, q.y - 0.33)), k2 = (1.0 - smoothstep(0.05, 0.072, d2)) * max(step(q.z, 0.1), step(0.9, q.z));
    c = mix(c, vec3(0.5, 0.32, 1.0) * (0.35 + 1.6 * L), max(k, k2));` },
  // lm-night-rio: Христос Спасителя — студено бял прожектор отдолу и отпред (+z — лицето), ярко срещу небето; постаментът — топъл и по-тъмен;
  // на празник (holidayNow) статуята бавно сменя цвета, като истинската
  redeemer: { flag: 'lm-night-rio', nfK: 1.0, glsl: `
    float L = dot(dc, vec3(0.2126, 0.7152, 0.0722)), front = 0.55 + 0.45 * smoothstep(0.3, 0.8, q.z), up = 1.05 - 0.35 * smoothstep(0.25, 1.0, q.y);
    vec3 cool = vec3(0.82, 0.9, 1.0);
    if (hol > 0.5) cool = clamp(abs(mod(fract(t * 0.02) * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0) * 0.8 + 0.2;
    vec3 c = cool * (0.35 + 1.3 * L) * front * up * 1.25;
    if (q.y < 0.23) c = dc * vec3(1.0, 0.8, 0.6) * 0.7;` },
};
export const lmNightKinds = () => Object.keys(CFG).filter(k => feature(CFG[k].flag));
// → броят на материалите (0 — няма настройка за този вид или флагът е изключен)
export function lmNight(root, kind) {
  const C = CFG[kind]; if (!C || !feature(C.flag)) return 0;
  if (root.userData.lmNight) return 0; root.userData.lmNight = 1;
  root.updateMatrixWorld(true);   // спрямо корена (Голдън Гейт се завърта при поставянето — осите на модела остават същите)
  const inv = root.matrixWorld.clone().invert(), bb = new THREE.Box3(), tb = new THREE.Box3();
  root.traverse(o => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.union(tb.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))); });
  const { norm, S } = normOf(bb);
  let n = 0;
  root.traverse(o => { if (o.isMesh) n += patch(o, C, kind, new THREE.Matrix4().multiplyMatrices(norm, inv).multiply(o.matrixWorld), S); });
  return n;
}
// инстанциите (Кремъл — kremlin2.js): q — по кутията на самата част; mw — матрицата на възела в сцената на модела (оста y — нагоре), преди мястото на инстанцията
export function lmNightInst(im, kind, mw) {
  const C = CFG[kind]; if (!C || !feature(C.flag) || im.userData.lmNight) return 0; im.userData.lmNight = 1;
  if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
  const { norm, S } = normOf(im.geometry.boundingBox.clone().applyMatrix4(mw));
  return patch(im, C, kind, norm.multiply(mw), S);
}
function normOf(bb) {
  const sz = bb.getSize(new THREE.Vector3()), S = new THREE.Vector3(sz.x / sz.y, 1, sz.z / sz.y);
  return { S, norm: new THREE.Matrix4().makeScale(1 / Math.max(sz.x, 1e-6), 1 / Math.max(sz.y, 1e-6), 1 / Math.max(sz.z, 1e-6)).multiply(new THREE.Matrix4().makeTranslation(-bb.min.x, -bb.min.y, -bb.min.z)) };
}
function patch(o, C, kind, M, S) {
  let n = 0;
  o.material = [].concat(o.material).map(m0 => { if (!m0 || !('emissive' in m0)) return m0; const m = m0.clone();
    const glass = C.cls ? C.cls(m.name, o.name) : C.glass && C.glass.test(m.name) ? 1 : 0;   // cls — номер на частта по името на материала (Невски) или на частта (Спаската)
    if (C.double) m.side = THREE.DoubleSide; m.userData.lmNight = 1; m.userData.nightFloors = true; m.userData.nfK = C.nfK; m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = 0; NF_MATS.add(m); n++;
    m.onBeforeRender = () => { T.value = performance.now() / 1000; HOL.value = holidayNow() ? 1 : 0; };
    m.onBeforeCompile = sh => { sh.uniforms.uLnM = { value: M }; sh.uniforms.uLnT = T; sh.uniforms.uLnG = { value: glass }; sh.uniforms.uLnS = { value: S }; sh.uniforms.uLnH = HOL;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 uLnM; varying vec3 vLnQ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLnQ = (uLnM * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uLnT, uLnG, uLnH; uniform vec3 uLnS; varying vec3 vLnQ;\nvec3 lnNight(vec3 q, vec3 s, float lum, float glass, float t, float hol, vec3 dc) {${C.glsl}\n  return c; }`)
        .replace('#include <emissivemap_fragment>', `float lnLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          totalEmissiveRadiance *= lnNight(clamp(vLnQ, 0.0, 1.0), uLnS, lnLum, uLnG, uLnT, uLnH, diffuseColor.rgb);
          diffuseColor.rgb *= 1.0 - 0.75 * clamp(emissive.r / ${C.nfK.toFixed(2)}, 0.0, 1.0);`); };
    m.customProgramCacheKey = () => 'lmnight-' + kind + glass; m.needsUpdate = true; return m; });
  if (o.material.length === 1) o.material = o.material[0];
  return n;
}
