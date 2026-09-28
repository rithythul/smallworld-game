// The planet view: the whole Small World planet as a globe you can spin, like looking at Google Earth.
// It is painted from the same numbers as the ground you walk on (js/planet.js), so every sea, desert and
// snowfield on the globe is really there. It opens close above you and pulls back to the whole planet.
import * as THREE from './vendor/three.module.min.js';

const P = window.Planet;
let texCache = null;
// the planet's picture: one pixel per step of longitude and latitude, coloured by what is there
function planetTexture() {
  if (texCache) return texCache;
  const W = 720, H = 360, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), c = new THREE.Color();
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / H * 180, z = P.zOfLat(lat);
    for (let i = 0; i < W; i++) {
      const lon = -180 + (i + 0.5) / W * 360, x = lon / P.DEG;
      const s = P.sample(x, z);
      if (s.ocean) { c.set('#4f97c7'); c.lerp(new THREE.Color('#2f5f9e'), Math.min(1, -s.h / 8)); }
      else { c.set(s.h > 17 ? '#f4f8fc' : P.BIOME[s.biome].ground); const k = 0.9 + Math.min(0.2, s.h / 60); c.multiplyScalar(k); }
      const o = (j * W + i) * 4;
      img.data[o] = c.r * 255; img.data[o + 1] = c.g * 255; img.data[o + 2] = c.b * 255; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  texCache = cv;
  return cv;
}
// a point on the globe (radius r) from planet metres
function toSphere(x, z, r = 1) {
  const lat = P.latOf(z), lon = P.lonOf(x);
  const th = (90 - lat) * Math.PI / 180, ph = (lon + 180) / 360 * Math.PI * 2;
  return new THREE.Vector3(-Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r);
}
function fromSphere(v) {
  const n = v.clone().normalize(), lat = 90 - Math.acos(n.y) * 180 / Math.PI;
  let ph = Math.atan2(n.z, -n.x); if (ph < 0) ph += Math.PI * 2;
  const lon = ph / (Math.PI * 2) * 360 - 180;
  return { x: P.wrapX(lon / P.DEG), z: P.zOfLat(lat), lat, lon };
}
function emojiSprite(text, size = 0.09) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 72);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: true, transparent: true }));
  sp.scale.setScalar(size); return sp;
}

// Small Town's marker: a little painted house (no emoji font needed)
function houseSprite(size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d'); g.lineWidth = 8; g.strokeStyle = '#34233f'; g.lineJoin = 'round';
  g.fillStyle = '#fff3d6'; g.fillRect(30, 60, 68, 50); g.strokeRect(30, 60, 68, 50);
  g.fillStyle = '#e4572e'; g.beginPath(); g.moveTo(18, 64); g.lineTo(64, 20); g.lineTo(110, 64); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#5b7cfa'; g.fillRect(56, 80, 18, 30); g.strokeRect(56, 80, 18, 30);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  sp.scale.setScalar(size); return sp;
}
function open(o) {
  if (document.getElementById('globe')) return;
  const el = document.createElement('div'); el.id = 'globe';
  el.innerHTML = `<canvas></canvas>
    <div class="gl-top"><b>🌍 Small World</b><span class="gl-where"></span><button type="button" class="gl-close" aria-label="Back to the ground">⬇ Back</button></div>
    <div class="gl-pick" hidden><span></span><button type="button" class="gl-go">📍 Go there</button></div>
    <p class="gl-hint">${o.band === 1 ? '👆 🌍 ↔' : 'Drag to spin · pinch or scroll to zoom · tap a place to go there'}</p>`;
  document.body.append(el);
  const canvas = el.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50);
  scene.add(new THREE.HemisphereLight('#ffffff', '#445', 1.6));
  const sun = new THREE.DirectionalLight('#fff3dc', 1.8); sun.position.set(-3, 2, 4); scene.add(sun);
  const tex = new THREE.CanvasTexture(planetTexture()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map: tex }));
  scene.add(earth);
  const air = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 32), new THREE.MeshBasicMaterial({ color: '#8fdcf2', transparent: true, opacity: 0.16, side: THREE.BackSide }));
  scene.add(air);
  // home and the towns, you, and your friends
  const home = houseSprite(0.1); home.position.copy(toSphere(o.home.x, o.home.z, 1.04)); scene.add(home);
  const pin = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshLambertMaterial({ color: o.me.color || '#e4572e' }));
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 8), new THREE.MeshLambertMaterial({ color: '#34233f' }));
  stick.position.y = 0.035; head.position.y = 0.075; pin.add(stick, head);
  const meAt = toSphere(o.me.x, o.me.z, 1.001); pin.position.copy(meAt); pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), meAt.clone().normalize()); scene.add(pin);
  (o.friends || []).forEach(f => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshLambertMaterial({ color: f.color })); d.position.copy(toSphere(f.x, f.z, 1.02)); scene.add(d); });
  const flag = emojiSprite('📍', 0.08); flag.visible = false; scene.add(flag);
  // camera: looking at a point on the globe from a distance; starts close above you and pulls back
  const look = meAt.clone().normalize();
  let yaw = Math.atan2(look.x, look.z), pitch = Math.asin(look.y), dist = 1.18, want = 3.4;   // close above you, then the whole planet
  const place = () => { camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(0, 0, 0); };
  const where = el.querySelector('.gl-where');
  where.textContent = `${Math.abs(Math.round(P.latOf(o.me.z)))}°${P.latOf(o.me.z) >= 0 ? 'N' : 'S'} · ${Math.abs(Math.round(P.lonOf(o.me.x)))}°${P.lonOf(o.me.x) >= 0 ? 'E' : 'W'}`;
  // input: drag to spin, wheel or pinch to zoom, tap to pick a place
  const pts = new Map(); let moved = 0, pinch0 = 0;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  canvas.addEventListener('pointermove', e => {
    const q = pts.get(e.pointerId); if (!q) return;
    if (pts.size === 2) { q.x = e.clientX; q.y = e.clientY; const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) want = Math.max(1.12, Math.min(4, want * pinch0 / d)); pinch0 = d; moved += 10; return; }
    const dx = e.clientX - q.x, dy = e.clientY - q.y; q.x = e.clientX; q.y = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
    const k = 0.005 * (dist - 1);
    yaw -= dx * k; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * k));
  });
  const up = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
    if (moved > 6 || pts.size) return;
    // a tap: which place on the planet?
    const r = canvas.getBoundingClientRect(), m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(m, camera);
    const hit = ray.intersectObject(earth)[0]; if (!hit) return;
    const at = fromSphere(hit.point), s = P.sample(at.x, at.z), B = P.BIOME[s.biome];
    flag.position.copy(hit.point.clone().normalize().multiplyScalar(1.05)); flag.visible = true;
    const pick = el.querySelector('.gl-pick'); pick.hidden = false;
    const h = P.heading(o.me.x, o.me.z, at.x, at.z);
    pick.querySelector('span').textContent = `${B.icon} ${B.name} · ${h.dist < 1000 ? Math.round(h.dist) + ' m' : (h.dist / 1000).toFixed(1) + ' km'} ${h.word}`;
    pick.onclick = (ev) => { if (!ev.target.closest('.gl-go')) return; close(); if (o.onPick) o.onPick(at); };
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', e => { pts.delete(e.pointerId); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); want = Math.max(1.12, Math.min(4, want * (e.deltaY > 0 ? 1.1 : 1 / 1.1))); }, { passive: false });
  let closing = false, raf = 0, last = performance.now();
  function close() {
    if (closing) return; closing = true; want = 1.12;
    setTimeout(() => { cancelAnimationFrame(raf); renderer.dispose(); renderer.forceContextLoss(); tex.dispose(); el.remove(); if (o.onClose) o.onClose(); }, 450);
  }
  el.querySelector('.gl-close').addEventListener('click', close);
  addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { removeEventListener('keydown', esc); close(); } });
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    dist += (want - dist) * (1 - Math.exp(-dt * (closing ? 7 : 2.4)));
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    head.position.y = 0.075 + Math.sin(t / 250) * 0.008;
    place(); renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}

window.Globe = { open, toSphere, fromSphere };
