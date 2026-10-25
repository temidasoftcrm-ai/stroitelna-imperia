// skysun.js — 🌅 sky-sun (f9): небе с градиент спрямо слънцето, видимо слънце (диск + ореол), залез и изгрев, луна и звезди нощем.
// Куполът е около камерата (без мъгла, зад всичко); на хоризонта се слива с цвета на мъглата (без шев със земята).
// Залез (запад, −x): оранжево-розово до слънцето → лилаво нагоре → тъмносиньо срещу него; изгрев (изток, +x) — по-хладно розово-златно.
// При облачно/дъжд слънцето е скрито и остава само леко порозовяване. Не пипа daynight.js — върви след него (и след weather.js) всеки кадър:
//   const sky = createSkySun(scene);  sky.update(hour, camera, target, cloud 0…1, sunLight?)  — sunLight: ниското слънце дава дълги топли сенки
import * as THREE from 'three';
import { feature } from './lab/feature.js';
const CL = feature('sky-clouds');   // ☁️ sky-clouds (f9): меки облаци в купола — оцветени от залеза/изгрева, бавно се движат; облачно/дъжд — повече и по-тъмни

const C = h => new THREE.Color(h);
// цветовете: [зенит, хоризонт до слънцето, хоризонт срещу слънцето, ореол]
const DAY = [C(0x5f9bd8), C(0xcfe6f6), C(0xbcd8ee), C(0xfff6e0)];
const DUSK = [C(0x3d3474), C(0xff7a3a), C(0x2c3a72), C(0xff9a50)];   // залез: лилав зенит, оранжев хоризонт, тъмносиньо срещу
const DAWN = [C(0x50609a), C(0xffb08a), C(0x8e8ab8), C(0xffd2a0)];   // изгрев: по-хладно розово-златно
const NIGHT = [C(0x070d24), C(0x18244c), C(0x111a3c), C(0x9fb4ff)];
const GREY = C(0x9aa3ad), tmp = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSkySun(scene) {
  const U = { sunDir: { value: new THREE.Vector3(1, 0.1, 0.3).normalize() }, zen: { value: C(0) }, hNear: { value: C(0) }, hFar: { value: C(0) }, halo: { value: C(0) },
    fogC: { value: C(0) }, disc: { value: 1 }, discC: { value: C(0xffe8b0) }, discR: { value: 0.03 }, glow: { value: 1 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, moon: { value: 0 },
    cT: { value: 0 }, cCov: { value: 0.3 }, cBase: { value: C(0xffffff) }, cShade: { value: C(0xb0b8c6) }, cRim: { value: C(0xffb070) }, cA: { value: 0.9 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, defines: CL ? { CLOUDS: 1 } : {}, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false,   /* цветовете — точно (тоналното съпоставяне избелваше диска) */
    vertexShader: `varying vec3 vD; void main() { vD = normalize((modelMatrix * vec4(position, 0.0)).xyz); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 sunDir, zen, hNear, hFar, halo, fogC, discC, moonDir; uniform float disc, discR, glow, moon; varying vec3 vD;
      #ifdef CLOUDS
      uniform float cT, cCov, cA; uniform vec3 cBase, cShade, cRim;
      float hsh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { v += a * vn(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; } return v; }
      #endif
      void main() {
        vec3 d = normalize(vD); float el = d.y;
        vec2 hs = normalize(sunDir.xz + 1e-4), hd = normalize(d.xz + 1e-4); float toward = dot(hs, hd) * 0.5 + 0.5;   // 1 — към слънцето по хоризонта
        vec3 hor = mix(hFar, hNear, pow(toward, 1.6));
        vec3 c = mix(hor, zen, pow(smoothstep(0.0, 0.42, el), 0.8));   // нагоре — към зенита
        float cs = dot(d, normalize(sunDir));
        c += halo * glow * (0.55 * pow(max(cs, 0.0), 12.0) + 0.25 * pow(max(cs, 0.0), 3.0)) * (1.0 - smoothstep(0.1, 0.7, el));   // мекият ореол — силен ниско
        float sd = acos(clamp(cs, -1.0, 1.0)); c = mix(c, discC, disc * (1.0 - smoothstep(discR * 0.82, discR, sd)));   // дискът
        float md = acos(clamp(dot(d, normalize(moonDir)), -1.0, 1.0)); c = mix(c, vec3(0.93, 0.95, 1.0), moon * (1.0 - smoothstep(0.016, 0.02, md))); c += vec3(0.5, 0.6, 0.9) * moon * 0.25 * pow(max(dot(d, normalize(moonDir)), 0.0), 60.0);   // луната
        #ifdef CLOUDS
        if (el > 0.0) {   // облаците: равнина над главата (по-далечните — по-сплескани към хоризонта), вятърът ги носи бавно
          vec2 uv = d.xz / (el + 0.12) * 1.05 + vec2(cT * 0.010, cT * 0.0035);
          float n = fbm(uv), n2 = fbm(uv * 2.7 + 3.1), th = 1.0 - cCov, dens = smoothstep(th, th + 0.22, n * 0.75 + n2 * 0.25);
          float edge = dens * (1.0 - smoothstep(0.35, 0.9, dens));   // тънките ръбове — там светлината на залеза
          float lit = clamp(0.5 + 0.5 * (n2 - n) * 3.0, 0.0, 1.0), sunw = pow(max(cs, 0.0), 3.0);
          vec3 cc = mix(cShade, cBase, lit) + cRim * (edge * 1.4 + 0.35 * dens) * (0.35 + 0.65 * sunw);
          c = mix(c, cc, dens * cA * smoothstep(0.02, 0.12, el));
        }
        #endif
        c = mix(fogC, c, smoothstep(-0.02, 0.09, el));   // хоризонтът — в цвета на мъглата (без шев)
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat); dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'skySun'; scene.add(dome);
  // звездите: точки по купола над хоризонта
  const SN = 900, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { const u = Math.random() * 2 * Math.PI, v = 0.06 + Math.random() * 0.94, r = Math.sqrt(1 - v * v); sp.set([Math.cos(u) * r * 0.985, v * 0.985, Math.sin(u) * r * 0.985], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -9; scene.add(stars);
  const dir = new THREE.Vector3(), fv = new THREE.Vector3(), fc = new THREE.Color(), cur = { sunUp: 0, hour: 12 };
  // hour 0…24; camera — куполът е около нея; target — точката на сенките; cloud 0…1; sunLight — DirectionalLight (по желание)
  function update(hour, camera, target, cloud = 0, sunLight = null) {
    // слънцето: изгрев 6:00 на изток (+x), залез 20:00 на запад (−x), до ~50° височина, малко на юг (+z); преди/след — под хоризонта
    const t = (hour - 6) / 14, ang = t * Math.PI, elev = Math.sin(Math.max(-0.35, Math.min(Math.PI + 0.35, ang))) * 0.87;   // ~50° в пладне
    dir.set(Math.cos(ang), elev, 0.35).normalize(); U.sunDir.value.copy(dir);
    const e = Math.asin(dir.y) * 180 / Math.PI, morning = hour < 13;
    // смесите: ден / златен час / нощ по височината на слънцето
    const dayK = smooth(-4, 14, e), duskK = (1 - smooth(4, 22, e)) * smooth(-9, -1, e), nightK = 1 - smooth(-9, -2, e);
    const P = morning ? DAWN : DUSK, k2 = duskK * (1 - cloud * 0.75);   // облачно — само леко порозовяване
    const pick = i => { tmp.copy(NIGHT[i]).lerp(DAY[i], dayK).lerp(P[i], k2 * (i === 0 ? 0.7 : 1)); if (cloud) tmp.lerp(tmp.clone().lerp(GREY, 0.6).multiplyScalar(0.35 + 0.65 * (1 - nightK)), cloud * 0.8); return tmp; };
    U.zen.value.copy(pick(0)); U.hNear.value.copy(pick(1)); U.hFar.value.copy(pick(2)); U.halo.value.copy(pick(3));
    // мъглата (тя е „небето“ при наклонена камера): по залез/изгрев — топла, когато гледаш към слънцето, синьо-лилава срещу него
    if (scene.fog) { const cd = camera.getWorldDirection(fv), l1 = Math.hypot(cd.x, cd.z) || 1, l2 = Math.hypot(dir.x, dir.z) || 1, tw = ((cd.x * dir.x + cd.z * dir.z) / (l1 * l2)) * 0.5 + 0.5;
      fc.copy(U.hFar.value).lerp(U.hNear.value, Math.pow(tw, 1.6)); scene.fog.color.lerp(fc, Math.min(1, k2 * 0.9 + nightK * 0.2)); U.fogC.value.copy(scene.fog.color); }
    else U.fogC.value.copy(U.hFar.value);
    const vis = (1 - smooth(0.25, 0.5, cloud)) * smooth(-3, 0.5, e);   // дискът — само над хоризонта; облачно/дъжд — скрит
    U.disc.value = vis; U.glow.value = (0.5 + 0.9 * (1 - smooth(8, 35, e))) * (1 - smooth(0.2, 0.6, cloud) * 0.9) * smooth(-7, 0, e);
    U.discR.value = 0.028 + 0.022 * (1 - smooth(0, 15, e));   // ниско — по-голямо
    U.discC.value.setHex(0xfff4d8).lerp(tmp.setHex(morning ? 0xffc27a : 0xff8a3c), 1 - smooth(2, 20, e));   // ниско — оранжево
    if (CL) {   // облаците: ден — бели със сиви сенки; залез/изгрев — лилаво-розови с оранжеви ръбове; нощ — тъмни; облачно/дъжд — повече и по-тъмни
      U.cT.value = performance.now() / 1000;
      U.cCov.value = 0.52 + 0.4 * cloud;   // ясно — разпръснати облаци (залезът ги оцветява), облачно/дъжд — почти плътно U.cA.value = (0.55 + 0.4 * cloud) * (1 - nightK * 0.45);
      const dk = 1 - 0.55 * smooth(0.5, 1, cloud);   // дъжд/буря — по-тъмни
      U.cBase.value.setHex(0x1c2444).lerp(tmp.setHex(0xf6f8fc), dayK).lerp(tmp.setHex(morning ? 0xf2c6c0 : 0xe8a0a0), k2 * 0.8).multiplyScalar(dk);
      U.cShade.value.setHex(0x101630).lerp(tmp.setHex(0xaeb7c6), dayK).lerp(tmp.setHex(morning ? 0x8d7fa6 : 0x6e4f78), k2 * 0.85).multiplyScalar(dk);
      U.cRim.value.copy(U.halo.value).multiplyScalar(k2 * (1 - cloud * 0.6) * 0.9);
    }
    // луната — срещу слънцето, нощем; звездите — нощем без облаци
    U.moonDir.value.set(-dir.x, Math.max(0.25, -dir.y + 0.2), -0.3).normalize(); U.moon.value = nightK * (1 - cloud);
    stars.material.opacity = nightK * (1 - cloud) * 0.85; stars.visible = stars.material.opacity > 0.01;
    // куполът — около камерата, точно под далечната плоскост
    const R = camera.far * 0.9; dome.position.copy(camera.position); dome.scale.setScalar(R); stars.position.copy(camera.position); stars.scale.setScalar(R * 0.99);
    // слънчевата светлина: от посоката на видимото слънце (поне 7° — иначе сенките стават безкрайни), ниско — топла и дълги сенки
    if (sunLight && target && e > -2) { const le = Math.max(7, e) * Math.PI / 180, hd = Math.hypot(dir.x, dir.z); sunLight.position.set(target.x + dir.x / hd * Math.cos(le) * 160, Math.sin(le) * 160, target.z + dir.z / hd * Math.cos(le) * 160); sunLight.target.position.set(target.x, 0, target.z); }
    cur.sunUp = e; cur.hour = hour;
  }
  return { update, dome, stars, get elev() { return cur.sunUp; }, dispose() { scene.remove(dome); scene.remove(stars); dome.geometry.dispose(); mat.dispose(); sg.dispose(); stars.material.dispose(); } };
}
