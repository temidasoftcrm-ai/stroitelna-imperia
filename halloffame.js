// halloffame.js — ⭐ Зала на славата (флаг hall-fame): при връчване на отличие директорът застава на трибуна, зад него — голямата му снимка,
// до трибуната — статуетката; казва кратко изявление (субтитър). Пуска се след „Връчи“ в Директорската зала и отново — с клик по статуетка
// на витрината. Просто, в стила на залата: сцена, трибуна, аватар (directors3d.js directorRig), снимка, два прожектора.
// openHallOfFame({ k: ключът на отличието (awards3d.js AWARDS), tier, onClose }) → { close }
import * as THREE from 'three';
import { canvasTex as canvasData } from './texdata.js';   // fac-data (T1): статичните платна → собствени данни
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AWARDS, TIERS, makeTrophy } from './awards3d.js';
import { directorRig } from './directors3d.js';
import { feature } from './lab/feature.js';

// изявленията: за всяко отличие — по едно за степента (1–2 изречения, говори директорът)
export const FAME_LINES = {
  con: {
    bronze: 'Първата голяма програма — в срок и без компромис с качеството. Благодаря на бригадите.',
    silver: 'Строим по-бързо от плана, а качеството остава. Това е заслуга на всеки човек на обекта.',
    gold: 'Златото е за хората с каските. Без тях нямаше да има нито един завършен обект.',
    platinum: 'Построихме цели градове. Днес благодаря на всеки, който е положил тухла с нас.',
  },
  hw: {
    bronze: 'Първият коридор е готов — пътят вече свързва градовете ни. Благодаря на екипите по трасето.',
    silver: 'Още километри асфалт и мостове. Хората пътуват по-бързо, а стоките стигат по-рано.',
    gold: 'Магистралите ни минават през граници. Това е признание за всеки шофьор на валяк и всеки инженер.',
    platinum: 'Континентът е свързан с нашите пътища. Благодаря на всички, които работиха в жега и в сняг.',
  },
  rail: {
    bronze: 'Първата голяма жп поръчка е изпълнена. Влаковете тръгнаха навреме.',
    silver: 'Мрежата расте и разписанието се спазва. Благодаря на хората по линията.',
    gold: 'Релсите ни носят хора и товари през половин свят. Това злато е на машинистите.',
    platinum: 'Железницата е гръбнакът на империята. Благодаря на всеки стрелочник, който не спа.',
  },
  sea: {
    bronze: 'Първите морски линии носят печалба. Морето ни прие.',
    silver: 'Корабите ни вече са във всяко голямо пристанище. Благодаря на екипажите.',
    gold: 'Океаните са наш път. Благодаря на капитаните, които не отстъпиха пред бурите.',
    platinum: 'От пристанище до пристанище — светът е свързан по море. Това е за всеки моряк.',
  },
  air: {
    bronze: 'Първите въздушни линии са открити. Небето вече е наш партньор.',
    silver: 'Полетите ни свързват континентите всеки ден. Благодаря на пилотите и на кулите.',
    gold: 'Самолетите ни летят над целия свят. Това злато е за хората на пистата.',
    platinum: 'Небето вече няма граници за нас. Благодаря на всеки, който ни държи във въздуха.',
  },
  oil: {
    bronze: 'Веригата от кладенеца до пристанището работи. Първата доставка е изпълнена.',
    silver: 'Добивът расте, рафинериите работят денонощно. Благодаря на хората в полето.',
    gold: 'Черното злато вече е наше. Благодаря на всяка брънка от веригата.',
    platinum: 'Енергията на империята тече без прекъсване. Това е за хората, които я пазят.',
  },
  bank: {
    bronze: 'Касата е над резерва, а потокът — на плюс. Първата стъпка към стабилността.',
    silver: 'Година на ред и дисциплина. Парите обичат тишината — и ние ѝ даваме.',
    gold: 'Три години без пропаднал месец. Благодаря на всички, които не харчиха излишно.',
    platinum: 'Десетилетие стабилност. Този резерв ще пази империята и в най-тежките години.',
  },
  year: {
    bronze: 'Една четвърт от света е построена с наши ръце. Благодарим на целия борд!',
    silver: 'Половината свят носи нашия знак. Това е заслуга на всеки на тази маса.',
    gold: 'Три четвърти от света — завършени. Продължаваме заедно.',
    platinum: 'Целият свят е построен. Днес благодарим на всички — от бригадата до борда!',
  },
  hotel: {
    bronze: 'Първият ни петзвезден хотел е отворен. Гостите вече ни помнят.',
    silver: 'Пет хотела на световно ниво. Благодаря на всеки рецепционист и готвач.',
    gold: 'Петнадесет хотела по света — и всеки гост си тръгва доволен. Това злато е на екипите.',
    platinum: 'Четиридесет хотела, един стандарт: гостът е у дома. Благодаря на всички по веригата.',
  },
  city: {
    bronze: 'Половин година хората са доволни от Империал Сити. Това е само началото.',
    silver: 'Градът расте, а хората остават доволни. Благодаря на общините и учителите.',
    gold: 'Империал Сити е град, в който хората искат да живеят. Благодаря на лекарите и полицаите.',
    platinum: 'Девет от десет жители са доволни. Градът е на хората — и днес е техен празник.',
  },
};
const DIR_K = { year: 'glob', city: 'mayor' };   // „Борд на годината“ — председателят (Глобъл); „Град за хората“ — кметът

const css = `#hallFame{position:fixed;inset:0;z-index:2147483000;background:#05070c;opacity:0;transition:opacity .45s;font-family:system-ui,sans-serif}
#hallFame.on{opacity:1}#hallFame canvas{display:block;width:100%;height:100%}
#hallFame .top{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(#000a,#0000);color:#ffe7a8;font:800 20px Georgia,serif}
#hallFame .top small{display:block;font:600 13px system-ui,sans-serif;color:#d8c38e}
#hallFame .x{border:1px solid #fff3;border-radius:999px;background:#1c2433cc;color:#fff;font:700 16px system-ui;width:36px;height:36px;cursor:pointer}
#hallFame .sub{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);max-width:min(760px,calc(100vw - 32px));background:#0d1424e6;border:1px solid #d4a73a;border-radius:16px;padding:12px 18px;color:#fff;font:600 17px/1.45 system-ui;box-shadow:0 8px 30px #0008;opacity:0;transition:opacity .4s}
#hallFame .sub.on{opacity:1}#hallFame .sub b{color:#ffd36a;display:block;font-size:13px;margin-bottom:4px;letter-spacing:.03em}
#hallFame .sub:after{content:'';position:absolute;left:50%;top:-10px;margin-left:-10px;border:10px solid transparent;border-top:0;border-bottom-color:#d4a73a}`;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = canvasData(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function openHallOfFame({ k, tier = 'gold', onClose } = {}) {
  const A = AWARDS.find(x => x.k === k); if (!A) return null; const T = TIERS[tier] || TIERS.gold, dk = A.dir || DIR_K[k] || 'glob';
  const line = (FAME_LINES[k] || {})[tier] || A.quote || 'Благодаря за доверието!';
  { const old = document.getElementById('hallFame'); if (old) { if (old.__close) old.__close(); old.remove(); } }
  if (!document.getElementById('hallFameCss')) { const s = document.createElement('style'); s.id = 'hallFameCss'; s.textContent = css; document.head.appendChild(s); }
  const el = document.createElement('div'); el.id = 'hallFame'; el.__close = () => close();
  el.innerHTML = `<div class="top"><span>⭐ Зала на славата<small></small></span><button class="x" title="Затвори">✕</button></div><div class="sub"><b></b><span></span></div>`;
  el.querySelector('.top small').textContent = `${A.nm} · ${T.ico} ${T.nm} · ${A.who}`;
  el.querySelector('.sub b').textContent = A.who.toUpperCase(); document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  window.__overlay3d = (window.__overlay3d || 0) + 1;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.debug.checkShaderErrors = false;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; el.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x07090f); scene.fog = new THREE.Fog(0x07090f, 9, 18);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 40);
  const own = [], M = x => { own.push(x); return x; }, mat = (c, r = 0.6, m = 0) => M(new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x1a1208, 0.35));
  // сцената: тъмен под с кръг светлина, стъпало, трибуна от орех със златна табела; отзад — снимката в златна рамка
  const floor = new THREE.Mesh(M(new THREE.CircleGeometry(9, 64)), mat(0x141820, 0.5, 0.2)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const stage = new THREE.Mesh(M(new THREE.CylinderGeometry(2.6, 2.75, 0.18, 64)), mat(0x2a1c12, 0.45)); stage.position.y = 0.09; stage.receiveShadow = true; scene.add(stage);
  const ring = new THREE.Mesh(M(new THREE.TorusGeometry(2.66, 0.025, 8, 96)), mat(0xd4a73a, 0.3, 1)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; scene.add(ring);
  const wood = mat(0x3b2416, 0.4, 0.05), gold = mat(0xd4a73a, 0.28, 1);
  const pod = new THREE.Group(); pod.position.set(0, 0.18, 0.55); scene.add(pod);
  const body = new THREE.Mesh(M(new THREE.BoxGeometry(0.9, 0.85, 0.5)), wood); body.position.y = 0.425; body.castShadow = body.receiveShadow = true; pod.add(body);
  const topB = new THREE.Mesh(M(new THREE.BoxGeometry(1.0, 0.06, 0.6)), wood); topB.position.set(0, 0.88, -0.02); topB.rotation.x = -0.12; topB.castShadow = true; pod.add(topB);
  for (const y of [0.04, 0.83]) { const tr = new THREE.Mesh(M(new THREE.BoxGeometry(0.94, 0.03, 0.54)), gold); tr.position.y = y; pod.add(tr); }
  const plate = new THREE.Mesh(M(new THREE.PlaneGeometry(0.72, 0.42)), M(new THREE.MeshStandardMaterial({ map: M(canvasTex(720, 420, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6d77a'); gr.addColorStop(1, '#b8862b'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b4a12'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); g.fillStyle = '#3a2808'; g.textAlign = 'center';
    g.font = '64px serif'; g.fillText(T.ico, w / 2, 110); g.font = '800 46px Georgia, serif'; g.fillText(A.nm, w / 2, 210, w - 70);
    g.font = '600 34px system-ui, sans-serif'; g.fillText(A.who, w / 2, 280, w - 70); g.fillText(T.nm.toUpperCase(), w / 2, 340, w - 70);
  })), roughness: 0.35, metalness: 0.6 })));
  plate.position.set(0, 0.45, 0.252); plate.scale.setScalar(0.85); pod.add(plate);
  // микрофоните: два на гъша шия + пресгрупа с цветни флагчета на медиите
  const black = mat(0x15161a, 0.5, 0.4), steel = mat(0x9aa0a6, 0.3, 0.9);
  for (const sx of [-1, 1]) { const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(sx * 0.16, 0.9, 0.12), new THREE.Vector3(sx * 0.16, 1.18, 0.1), new THREE.Vector3(sx * 0.07, 1.24, -0.08));
    const neck = new THREE.Mesh(M(new THREE.TubeGeometry(c, 16, 0.008, 6)), steel); pod.add(neck); const head = new THREE.Mesh(M(new THREE.CapsuleGeometry(0.018, 0.05, 4, 8)), black); head.position.set(sx * 0.07, 1.24, -0.09); head.rotation.x = Math.PI / 2 - 0.4; pod.add(head);
    const base = new THREE.Mesh(M(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 12)), black); base.position.set(sx * 0.16, 0.9, 0.12); pod.add(base); }
  const FLAG = [0xd62828, 0x1f5fbf, 0x2d8f4e, 0xffb300, 0xf2f2f2];
  FLAG.forEach((col, i) => { const a = (i - 2) * 0.22, mic = new THREE.Group(); mic.position.set(Math.sin(a) * 0.12, 0.93, 0.18 - Math.cos(a) * 0.04); mic.rotation.set(-0.9, a * 0.8, 0); pod.add(mic);
    const h = new THREE.Mesh(M(new THREE.CylinderGeometry(0.012, 0.014, 0.16, 8)), black); h.position.y = 0.08; mic.add(h);
    const ball = new THREE.Mesh(M(new THREE.SphereGeometry(0.022, 10, 8)), mat(0x2a2c30, 0.8)); ball.position.y = 0.17; mic.add(ball);
    const fl = new THREE.Mesh(M(new THREE.BoxGeometry(0.05, 0.035, 0.05)), mat(col, 0.5)); fl.position.y = 0.12; mic.add(fl); });
  // снимката (assets/ui/directors/<модел>.webp) — голям фон зад трибуната, в златна рамка
  // стената зад сцената: тъмна ламперия с пиластри и златни кантове; снимката — окачена на нея, в рамка
  const wallM = mat(0x2b1f18, 0.55, 0.05), wall = new THREE.Mesh(M(new THREE.BoxGeometry(9, 4.8, 0.2)), wallM); wall.position.set(0, 2.4, -2.15); wall.receiveShadow = true; scene.add(wall);
  for (const x of [-3.3, -1.75, 1.75, 3.3]) { const pl = new THREE.Mesh(M(new THREE.BoxGeometry(0.28, 4.8, 0.12)), mat(0x3b2a20, 0.45, 0.05)); pl.position.set(x, 2.4, -2.0); pl.receiveShadow = true; scene.add(pl); }
  for (const y of [0.55, 4.3]) { const tr = new THREE.Mesh(M(new THREE.BoxGeometry(9, 0.04, 0.06)), gold); tr.position.set(0, y, -2.02); scene.add(tr); }
  const photo = new THREE.Group(); photo.position.set(0, 2.35, -1.99); photo.scale.setScalar(0.62); scene.add(photo);
  const frame = new THREE.Mesh(M(new THREE.BoxGeometry(3.3, 4.1, 0.08)), gold); frame.castShadow = false; photo.add(frame);
  const pic = new THREE.Mesh(M(new THREE.PlaneGeometry(3.1, 3.9)), M(new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false }))); pic.position.z = 0.045; photo.add(pic);
  // прожектори: топъл отпред към трибуната, хладен — към снимката
  const key = new THREE.SpotLight(0xfff0d0, 60, 14, 0.42, 0.5, 1.6); key.position.set(1.6, 5.2, 4.2); key.target.position.set(0, 1.2, 0.3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xbfd6ff, 30, 12, 0.5, 0.6, 1.6); rim.position.set(-2.4, 4.6, 2.5); rim.target.position.set(0, 2.35, -1.99); scene.add(rim, rim.target);
  const back = new THREE.PointLight(0xffd890, 4, 6, 1.5); back.position.set(0, 1.4, -1.2); scene.add(back);
  // статуетката — на малък пиедестал до трибуната
  const ped = new THREE.Mesh(M(new THREE.CylinderGeometry(0.2, 0.24, 0.9, 32)), wood); ped.position.set(1.0, 0.63, 0.65); ped.castShadow = true; scene.add(ped);
  let trophy = null; makeTrophy(k, tier, 0.42).then(t => { if (shut) { t.dispose(); return; } trophy = t; const b = new THREE.Box3().setFromObject(t.group), sz = b.getSize(new THREE.Vector3()), f = Math.min(1, 0.36 / Math.max(sz.x, sz.z, 0.01), 0.42 / Math.max(sz.y, 0.01)); t.group.scale.multiplyScalar(f); t.group.position.set(1.0, 1.09, 0.65); scene.add(t.group); });   // широките (влакът) — вписани
  // фотографите — силуети под сцената отстрани, със светкавици (и мигаща светлина върху директора)
  const dark = mat(0x0c0d10, 0.9), flashT = M(canvasTex(128, 128, (g, w) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(230,240,255,.7)'); r.addColorStop(1, 'rgba(230,240,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const shooters = [[-2.3, 1.7], [-1.8, 2.3], [2.0, 1.9], [2.5, 2.4], [-2.7, 2.6]].map(([x, z]) => { const g2 = new THREE.Group(); g2.position.set(x, 0, z); g2.lookAt(0, 0, 0.3); scene.add(g2);
    const body = new THREE.Mesh(M(new THREE.CapsuleGeometry(0.2, 0.85, 4, 10)), dark); body.position.y = 0.72; g2.add(body); const head = new THREE.Mesh(M(new THREE.SphereGeometry(0.12, 12, 10)), dark); head.position.y = 1.45; g2.add(head);
    const cm = new THREE.Mesh(M(new THREE.BoxGeometry(0.16, 0.11, 0.1)), dark); cm.position.set(0, 1.45, 0.16); g2.add(cm);
    const sp = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: flashT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))); sp.position.set(0, 1.5, 0.25); sp.scale.setScalar(0.6); g2.add(sp);
    return { g: g2, sp, next: 1 + Math.random() * 2, k: 0 }; });
  const flashL = new THREE.PointLight(0xeaf2ff, 0, 9, 1.4); scene.add(flashL);
  // аватарът — прав зад трибуната; говори, после кима
  let mixer = null, talkT = 0; const sub = el.querySelector('.sub'), subT = sub.querySelector('span');
  directorRig(dk).then(r => {
    if (shut || !r) return;
    new THREE.TextureLoader().load(r.photo, t => { t.colorSpace = THREE.SRGBColorSpace; pic.material.map = t; pic.material.color.set(0xffffff); pic.material.needsUpdate = true; own.push(t);
      const a = t.image.width / t.image.height; if (a > 0) pic.scale.x = feature('fame-wide') ? Math.min(1.6, a * 3.9 / 3.1) : Math.min(1, a * 3.9 / 3.1), frame.scale.x = (pic.scale.x * 3.1 + 0.2) / 3.3; });   /* fame-wide: снимката — в своето съотношение (беше смачкана в тясна рамка); до 1,6× — между пиластрите */
    const m = r.m; m.scale.setScalar(1); m.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(m), h0 = (bb.max.y - bb.min.y) || 1;
    m.scale.setScalar((r.fem ? 1.68 : 1.78) / h0); m.position.y = -bb.min.y * m.scale.x;   // в истински ръст (моделите са в различен мащаб)
    m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.frustumCulled = false; } });
    const wrap = new THREE.Group(); wrap.add(m); wrap.position.set(0, 0.18, 0.1); scene.add(wrap);
    mixer = new THREE.AnimationMixer(m); const C = r.clips, act = n => C[n] ? mixer.clipAction(C[n]) : null;
    const idle = act(r.fem && C.Female_Idle ? 'Female_Idle' : 'Idle_Standing') || act('Idle_Breathing'), talk = act(r.fem ? 'Talk_Conversation' : 'Talk_Two_Hands') || act('Talk_Conversation'), nod = act('Agree_Yes');
    const base = talk ? mixer.clipAction(talk.getClip().clone()) : idle; if (base) { base.timeScale = 0.4; base.setEffectiveWeight(0.8); base.play(); }   // бавни жестове над трибуната (не отпуснати ръце)
    if (idle && !base) idle.play();
    { mixer.update(0); m.position.set(0, 0, 0); m.scale.setScalar(1); wrap.updateMatrixWorld(true); const v = new THREE.Vector3(), yOf = n => { const b = m.getObjectByName(n); return b ? b.getWorldPosition(v).y : null; };   // ръстът — по костите в позата (кутията на скелетния модел лъже)
      const head = yOf('mixamorigHeadTop_End') ?? yOf('mixamorigHead'), toes = [yOf('mixamorigLeftToeBase'), yOf('mixamorigRightToeBase'), yOf('mixamorigLeftFoot')].filter(x => x != null), foot = toes.length ? Math.min(...toes) : 0;
      if (head != null && head - foot > 0.01) { const k = (r.fem ? 1.68 : 1.78) / ((head - foot) * (yOf('mixamorigHeadTop_End') != null ? 1 : 1.1)); m.scale.setScalar(k); wrap.updateMatrixWorld(true); const f2 = Math.min(...[yOf('mixamorigLeftToeBase'), yOf('mixamorigRightToeBase')].filter(x => x != null)); if (isFinite(f2)) m.position.y = wrap.position.y - f2; } }
    setTimeout(() => { if (shut) return; subT.textContent = ''; sub.classList.add('on'); let i = 0; const typ = setInterval(() => { if (shut) return clearInterval(typ); subT.textContent = line.slice(0, ++i); if (i >= line.length) clearInterval(typ); }, 32);
      if (talk) { talk.reset().setEffectiveWeight(1).fadeIn(0.4).play(); if (base) base.fadeOut(0.4); talkT = Math.max(3.5, line.length * 0.055); } }, 1400);
    // след изявлението — кимва и се връща в покой
    mixer.addEventListener('loop', () => {});
    const end = () => { if (shut || !talk) return; talk.fadeOut(0.5); if (nod) { nod.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.4).play(); nod.clampWhenFinished = false; } if (base) base.reset().fadeIn(0.6).play(); };
    setTimeout(end, 1400 + Math.max(3500, line.length * 55) + 800);
  }).catch(e => console.warn('hall-fame', e));
  // камерата: бавно приближаване към трибуната
  let t = 0, raf = 0, shut = false; const clock = new THREE.Clock();
  const loop = () => { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, clock.getDelta()); t += dt;
    const e = Math.min(1, t / 7), s = 1 - Math.pow(1 - e, 3); cam.position.set(Math.sin(t * 0.12) * 0.45, 1.7 - 0.1 * s, 5.9 - 2.1 * s); cam.lookAt(0.2, 1.45, -0.3);
    if (mixer) mixer.update(dt);
    let fl = 0; for (const q of shooters) { q.next -= dt; if (q.next <= 0 && t > 1.2) { q.k = 1; q.next = 0.4 + Math.random() * 2.2 + (Math.random() < 0.3 ? 0 : 0.8); q.sp.getWorldPosition(flashL.position); }   // светкавици: на случаен интервал, понякога серия
      q.k = Math.max(0, q.k - dt * 7); q.sp.material.opacity = q.k; q.sp.scale.setScalar(0.4 + q.k * 0.6); fl = Math.max(fl, q.k); }
    flashL.intensity = fl * 45; if (trophy) trophy.group.rotation.y = t * 0.6; key.intensity = 60 * Math.min(1, t / 1.2);
    renderer.render(scene, cam); };
  loop();
  const onResize = () => { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  addEventListener('resize', onResize); addEventListener('keydown', onKey); el.querySelector('.x').onclick = () => close();
  function close() {
    if (shut) return; shut = true; window.__overlay3d = Math.max(0, (window.__overlay3d || 1) - 1); removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
    el.classList.remove('on');
    setTimeout(() => { cancelAnimationFrame(raf); if (mixer) mixer.stopAllAction(); if (trophy) trophy.dispose(); for (const x of own) x.dispose && x.dispose(); scene.environment && scene.environment.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); el.remove(); try { onClose && onClose(); } catch { } }, 450);
  }
  window.__fame = { close, scene, cam };
  return { close };
}
