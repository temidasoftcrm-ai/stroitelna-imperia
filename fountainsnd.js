// fountainsnd.js — ⛲ fountain-snd: плясъкът на фонтаните отблизо (записан цикъл, Pixabay — assets/sfx/fountain.mp3).
// Един общ цикъл през „Град“ (Sound.cityBus): силата идва от най-близкия фонтан до целта на камерата и пада с отдалечаването
// на камерата. Фонтаните се намират по групите на водата (fountainwater.js: userData.fw) — обхожда се сцената на ~3 s.
// const FS = createFountainSnd(Sound);  FS.tick(dt, scene, camera, target);  FS.stop()
import * as THREE from 'three';

const R = 70, VMAX = 0.35;   // R — до колко метра от фонтана се чува; VMAX — най-силно (градският фон е ~0,3–0,5)
const fall = (d, r) => d >= r ? 0 : (1 - d / r) ** 2;

export function createFountainSnd(Sound) {
  let buf = null, loading = false, src = null, gain = null, scanT = 0, pts = [], v = 0;
  const P = new THREE.Vector3();
  function load() {
    if (loading || !Sound.ctx) return; loading = true;
    fetch('assets/sfx/fountain.mp3').then(r => r.arrayBuffer()).then(a => Sound.ctx.decodeAudioData(a)).then(b => { buf = b; }).catch(() => {});
  }
  function start() {
    const ctx = Sound.ctx; gain = ctx.createGain(); gain.gain.value = 0; gain.connect(Sound.cityBus || Sound.master);
    src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(0, Math.random() * buf.duration);
  }
  function scan(scene) {
    pts = []; scene.traverse(o => { if (o.userData.fw && o.visible) { o.getWorldPosition(P); pts.push(P.x, P.z); } });
  }
  return {
    tick(dt, scene, camera, target) {
      if (!Sound.ctx || !scene) return;
      if (!buf) { load(); return; }
      if (!src) start();
      if ((scanT -= dt) <= 0) { scanT = 3; scan(scene); }
      let d = 1e9; for (let i = 0; i < pts.length; i += 2) d = Math.min(d, Math.hypot(pts[i] - target.x, pts[i + 1] - target.z));
      const zoomK = Math.max(0, Math.min(1, 1 - (camera.position.distanceTo(target) - 40) / 260));   // отвисоко — почти не се чува
      const nv = Sound.muted ? 0 : VMAX * fall(d, R) * zoomK;
      if (Math.abs(nv - v) > 0.002) { v = nv; gain.gain.setTargetAtTime(v, Sound.ctx.currentTime, 0.4); }
    },
    stop() { if (src) { try { src.stop(); } catch { } src.disconnect(); src = null; } if (gain) { gain.disconnect(); gain = null; } v = 0; pts = []; },
  };
}
