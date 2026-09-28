// Small World in 3D: Small Town as a tiny tilt-shift diorama you can walk around.
// The layout and rules come from js/town.js (global Town); the Squareface screen faces are drawn by js/art.js (drawFace).
// Everything is procedural low-poly, made with three.js: no downloaded models. Static scenery is merged into a few
// vertex-coloured meshes (plus inverted-hull outlines), trees are InstancedMeshes, and the parts of town that change
// (farms, houses, the forest, town projects) are small groups rebuilt only when the shared town changes.
// The game logic lives in js/sw.js and talks to this file through window.World.
import * as THREE from './vendor/three.module.min.js';
// A planet, not a flat board: every vertex drops a little with its distance from the middle of the view, so the
// ground curves away to the horizon. Only for the perspective camera: shadows (orthographic) are made flat.
const BEND_K = 1 / 1800, BEND_OFF = 95;   // a 900 m bend radius for the eye; the view centre sits BEND_OFF in front of the camera
THREE.ShaderChunk.project_vertex = `
vec4 bwp = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
bwp = batchingMatrix * bwp;
#endif
#ifdef USE_INSTANCING
bwp = instanceMatrix * bwp;
#endif
bwp = modelMatrix * bwp;
if ( projectionMatrix[ 3 ][ 3 ] < 0.5 ) {
  vec2 bdd = bwp.xz - cameraPosition.xz + vec2( 0.0, ${BEND_OFF.toFixed(1)} );
  bwp.y -= dot( bdd, bdd ) * ${BEND_K.toFixed(8)};
}
vec4 mvPosition = viewMatrix * bwp;
gl_Position = projectionMatrix * mvPosition;`;

const T = window.Town;
const S = 0.1;                                   // 1 three.js unit = 10 game px
const OX = 4800, OY = 1300;                      // game point that sits at the world origin
const wx = gx => (gx - OX) * S, wz = gy => (gy - OY) * S;
const gxOf = x => x / S + OX, gyOf = z => z / S + OY;
const INKC = '#34233f';
const COL = {
  grass: '#b4dc7a', grass2: '#a8d46c', grass3: '#c3e58f', road: '#e9d9b0', roadEdge: '#d4bf8c', plaza: '#efe3c4',
  wall: '#fff3d6', roof: '#e4572e', blue: '#5b7cfa', gold: '#f4b942', green: '#8cbf5a', ink: INKC, soil: '#8f5d36', soilLight: '#c7a57a',
  dirt: '#a0673b', paper: '#fff8e8', teal: '#2fa4b5', shell: '#f7f1e3', wood: '#c98a52', woodDark: '#8a5a34', glass: '#9ff3ff', yellow: '#ffd23f',
};
const OLS = 1.75;                                // outline thickness multiplier
const SLAB = { x0: 3380, x1: 6220, y0: -420, y1: 2780 };  // the old town's board, in game px; districts join on to the east

/* ------------------------------------------------------------------ renderer, scene, lights */
let hooks = { now: () => Date.now(), tick: () => {}, onSpace: () => false, busy: () => false, others: () => [] };
const canvas = document.getElementById('world');
// ?q=high keeps full quality, ?q=low starts cheap; by default quality steps down by itself on slow devices
const PARAMS = new URLSearchParams(location.search), QUALITY = PARAMS.get('q') || 'auto';
const ZOOM = Math.min(3, Math.max(0.3, +PARAMS.get('zoom') || 1));   // dev: ?zoom=2.5 moves the camera closer
// an opaque canvas cleared to the sky colour: cheaper to composite than a transparent one on low-end GPUs
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY !== 'low', alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(QUALITY === 'low' ? 1 : 1.5, window.devicePixelRatio || 1));
renderer.setClearColor('#cdeefc', 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#dcefe6', 150, 330);
const camera = new THREE.PerspectiveCamera(32, 1, 2, 520);

const hemi = new THREE.HemisphereLight('#fff6e8', '#c7b4e2', 2.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 1.35);
const SUN_DIR = new THREE.Vector3(-0.45, 1, 0.62).normalize();
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
const SH = 46;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 260 });
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06; sun.shadow.radius = 2;
scene.add(sun, sun.target);

// toon ramp: 3 soft bands
const ramp = new THREE.DataTexture(new Uint8Array([165, 212, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const toonMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });

// inverted-hull outline: push each vertex along its smoothed direction (baked into the outDir attribute, width included)
function makeOutlineMat() {
  const m = new THREE.MeshBasicMaterial({ color: INKC, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 outDir;')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + outDir;');
  };
  m.customProgramCacheKey = () => 'sw-outline';
  return m;
}
const outlineMat = makeOutlineMat();

/* ------------------------------------------------------------------ geometry kit */
const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpC = new THREE.Color(), tmpM3 = new THREE.Matrix3();
const geoCache = new Map();

// Non-indexed geometry + smoothed outline directions (averaged normals of vertices that share a position)
function prep(key, make) {
  let e = geoCache.get(key);
  if (e) return e;
  let g = make();
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
  const acc = new Map(), keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    keys[i] = k;
    let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]);
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const dirs = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = acc.get(keys[i]); tmpV.set(a[0], a[1], a[2]).normalize();
    dirs[i * 3] = tmpV.x; dirs[i * 3 + 1] = tmpV.y; dirs[i * 3 + 2] = tmpV.z;
  }
  g.computeBoundingBox();
  e = { g, dirs, minY: g.boundingBox.min.y, maxY: g.boundingBox.max.y };
  geoCache.set(key, e);
  return e;
}

function roundedBoxGeo(w, h, d, r, k = 2) {
  const n = 2 * k + 1, g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const p = g.attributes.position, nr = g.attributes.normal, half = [w / 2, h / 2, d / 2];
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const v = [0, 0, 0], inner = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    for (let a = 0; a < 3; a++) {
      const idx = Math.round((v[a] + 0.5) * n), H = half[a];
      v[a] = idx <= k ? -(H - r) - r * (1 - idx / k) : (H - r) + r * ((idx - k - 1) / k);
      inner[a] = Math.max(-(H - r), Math.min(H - r, v[a]));
    }
    const dx = v[0] - inner[0], dy = v[1] - inner[1], dz = v[2] - inner[2], L = Math.hypot(dx, dy, dz);
    if (L > 1e-6) {
      p.setXYZ(i, inner[0] + dx / L * r, inner[1] + dy / L * r, inner[2] + dz / L * r);
      nr.setXYZ(i, dx / L, dy / L, dz / L);
    } else p.setXYZ(i, v[0], v[1], v[2]);
  }
  return g;
}
function prismGeo(w, h, d) {       // gable roof filler: ridge along x
  const hw = w / 2, hd = d / 2;
  const P = [[-hw, 0, -hd], [-hw, 0, hd], [-hw, h, 0], [hw, 0, -hd], [hw, 0, hd], [hw, h, 0]];
  const tris = [[0, 1, 2], [3, 5, 4], [0, 2, 5], [0, 5, 3], [1, 4, 5], [1, 5, 2], [0, 3, 4], [0, 4, 1]];
  const arr = []; tris.forEach(t => t.forEach(i => arr.push(...P[i])));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
  return g;
}
const GEO = {
  box: (w, h, d) => prep(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r, k = 2) => prep(`r${w},${h},${d},${r},${k}`, () => roundedBoxGeo(w, h, d, r, k)),
  cyl: (rt, rb, h, s = 12) => prep(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 8) => prep(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  ico: (r, det = 1) => prep(`i${r},${det}`, () => new THREE.IcosahedronGeometry(r, det)),
  sph: (r, ws = 12, hs = 8, half = false) => prep(`s${r},${ws},${hs},${half}`, () => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI)),
  disc: (r, s = 24) => prep(`d${r},${s}`, () => new THREE.CircleGeometry(r, s).rotateX(-Math.PI / 2)),
  ring: (r0, r1, s = 40) => prep(`g${r0},${r1},${s}`, () => new THREE.RingGeometry(r0, r1, s).rotateX(-Math.PI / 2)),
  prism: (w, h, d) => prep(`p${w},${h},${d}`, () => prismGeo(w, h, d)),
  capsule: (r, l) => prep(`q${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10)),
  torus: (R, r, s = 28) => prep(`t${R},${r},${s}`, () => new THREE.TorusGeometry(R, r, 6, s).rotateX(-Math.PI / 2)),
  rrect: (w, h, r) => prep(`rr${w},${h},${r}`, () => {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return new THREE.ShapeGeometry(s, 6).rotateX(-Math.PI / 2);
  }),
  // a flat oval ring standing up from y=0 to h (the tiled edge around the pool); the hole is rx x rz, the ring w wide
  ering: (rx, rz, w, h) => prep(`e${rx},${rz},${w},${h}`, () => {
    const s = new THREE.Shape(), hole = new THREE.Path();
    s.absellipse(0, 0, rx + w, rz + w, 0, Math.PI * 2, false); hole.absellipse(0, 0, rx, rz, 0, Math.PI * 2, true); s.holes.push(hole);
    return new THREE.ExtrudeGeometry(s, { depth: h - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 2, curveSegments: 48 }).rotateX(-Math.PI / 2).translate(0, 0.1, 0);
  }),
  // one slice of a striped umbrella (8 of them make the whole canopy)
  wedge: (r, h, i) => prep(`w${r},${h},${i}`, () => new THREE.ConeGeometry(r, h, 3, 1, false, i * Math.PI / 4, Math.PI / 4)),
  // a chunky five-point star, standing up and facing +z
  star: (ro, ri, d) => prep(`st${ro},${ri},${d}`, () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + Math.PI / 2, r = i % 2 ? ri : ro; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }).translate(0, 0, -d / 2);
  }),
  // half a cylinder (a vaulted roof), and half a torus standing up (a rock arch)
  hcyl: (r, len, s = 16) => prep(`hc${r},${len},${s}`, () => new THREE.CylinderGeometry(r, r, len, s, 1, false, 0, Math.PI)),
  arch: (R, r, s = 16) => prep(`ar${R},${r},${s}`, () => new THREE.TorusGeometry(R, r, 7, s, Math.PI)),
  lily: (r) => prep(`ly${r}`, () => new THREE.CircleGeometry(r, 14, 0.4, Math.PI * 2 - 0.8).rotateX(-Math.PI / 2)),   // a pad with a notch
};

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
function M(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}

// Collects many primitives into one vertex-coloured geometry (+ an outline geometry)
class Builder {
  constructor() { this.p = []; this.n = []; this.c = []; this.op = []; this.od = []; }
  // o.ol = outline width (0 = none), o.ao = darken towards the bottom of the primitive (fake ambient occlusion)
  add(e, m, color, o = {}) {
    if (this.base) m = this.base.clone().multiply(m);
    const ol = (o.ol ?? 0.12) * OLS, ao = o.ao ?? 0, g = e.g, pos = g.attributes.position, nor = g.attributes.normal, vc = o.vc ? g.attributes.color : null;
    tmpM3.getNormalMatrix(m);
    tmpC.set(color);
    const span = Math.max(1e-6, e.maxY - e.minY);
    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i);
      if (vc) tmpC.fromBufferAttribute(vc, i);
      const f = ao ? 1 - ao * (1 - (tmpV.y - e.minY) / span) : 1;
      tmpV.applyMatrix4(m);
      this.p.push(tmpV.x, tmpV.y, tmpV.z);
      tmpN.fromBufferAttribute(nor, i).applyMatrix3(tmpM3).normalize();
      this.n.push(tmpN.x, tmpN.y, tmpN.z);
      this.c.push(tmpC.r * f, tmpC.g * f, tmpC.b * f);
      if (ol > 0) {
        this.op.push(tmpV.x, tmpV.y, tmpV.z);
        tmpN.set(e.dirs[i * 3], e.dirs[i * 3 + 1], e.dirs[i * 3 + 2]).applyMatrix3(tmpM3).normalize().multiplyScalar(ol);
        this.od.push(tmpN.x, tmpN.y, tmpN.z);
      }
    }
    return this;
  }
  geometries() {
    const main = new THREE.BufferGeometry();
    main.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    main.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    main.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    main.computeBoundingSphere();
    let line = null;
    if (this.op.length) {
      line = new THREE.BufferGeometry();
      line.setAttribute('position', new THREE.Float32BufferAttribute(this.op, 3));
      line.setAttribute('outDir', new THREE.Float32BufferAttribute(this.od, 3));
      line.computeBoundingSphere(); line.boundingSphere.radius += 0.5;
    }
    return { main, line };
  }
  // one mesh + its outline as a child
  mesh({ cast = true, receive = true } = {}) {
    const { main, line } = this.geometries();
    const m = new THREE.Mesh(main, toonMat); m.castShadow = cast; m.receiveShadow = receive;
    if (line) { const o = new THREE.Mesh(line, outlineMat); o.castShadow = false; m.add(o); }
    return m;
  }
}

// Routes each primitive into a grid cell, so off-screen parts of town are frustum-culled (also from the shadow pass)
class Chunked {
  constructor(cell) { this.cell = cell; this.map = new Map(); this.base = null; }
  add(e, m, color, o) {
    if (this.base) m = this.base.clone().multiply(m);
    const k = `${Math.floor(m.elements[12] / this.cell)},${Math.floor(m.elements[14] / this.cell)}`;
    let b = this.map.get(k); if (!b) this.map.set(k, b = new Builder());
    b.add(e, m, color, o); return this;
  }
  meshes() { return [...this.map.values()].map(b => b.mesh()); }
}
const CELL = 64;

/* ------------------------------------------------------------------ sign text */
// Sign text is painted into a canvas "atlas" and drawn as flat quads. The static town shares one big atlas;
// each changing part of town (a farm sign, a new house) gets its own small one, thrown away when it is rebuilt.
const ROW = 64, LABEL_FONT = '800 44px "Baloo 2", system-ui, sans-serif';
class TextAtlas {
  constructor(w = 1024, h = 2048) {
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h; this.W = w; this.H = h;
    this.ctx = this.cv.getContext('2d'); this.labels = new Map(); this.x = 0; this.y = 0;
    this.q = { p: [], uv: [], idx: [] }; this.tex = null;
  }
  // Short labels take half a row, long ones a whole row
  label(text) {
    if (this.labels.has(text)) return this.labels.get(text);
    const c = this.ctx, half2 = this.W / 2 - 8; c.font = LABEL_FONT;
    const need = Math.ceil(c.measureText(text).width) + 8, half = need <= half2;
    if (!half && this.x) { this.x = 0; this.y += ROW; }
    const x0 = this.x, y0 = this.y, w = Math.min(half ? half2 : this.W - 8, need);
    if (half && this.x === 0) this.x = this.W / 2; else { this.x = 0; this.y += ROW; }
    const L = { text, x0, y0, u0: x0 / this.W, u1: (x0 + w) / this.W, v0: 1 - (y0 + ROW) / this.H, v1: 1 - y0 / this.H, w };
    this.paint(L); this.labels.set(text, L); return L;
  }
  paint(L) {
    const c = this.ctx; c.font = LABEL_FONT; c.textBaseline = 'middle'; c.fillStyle = INKC;
    c.clearRect(L.x0, L.y0, L.w + 4, ROW);
    c.fillText(L.text, L.x0 + 4, L.y0 + ROW / 2 + 3, L.w - 8);
  }
  add(L, m, height) {
    const q = this.q, w = L.w / ROW * height, b = q.p.length / 3;
    [[-w / 2, -height / 2, L.u0, L.v0], [w / 2, -height / 2, L.u1, L.v0], [w / 2, height / 2, L.u1, L.v1], [-w / 2, height / 2, L.u0, L.v1]].forEach(([x, y, u, v]) => {
      tmpV.set(x, y, 0).applyMatrix4(m); q.p.push(tmpV.x, tmpV.y, tmpV.z); q.uv.push(u, v);
    });
    q.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  mesh() {
    if (!this.q.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.q.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.q.uv, 2));
    g.setIndex(this.q.idx);
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false, fog: true }));
  }
  // If Baloo 2 arrives after the town was built, repaint the text in it (same slots; maxWidth keeps it inside)
  repaintWhenFontArrives() {
    if (!document.fonts || document.fonts.check(LABEL_FONT)) return;
    document.fonts.load(LABEL_FONT).then(() => {
      if (!document.fonts.check(LABEL_FONT)) return;
      this.labels.forEach(L => this.paint(L)); if (this.tex) this.tex.needsUpdate = true;
    }).catch(() => {});
  }
}
const TEXT = new TextAtlas();
let curText = TEXT;                 // where sign() puts its text: the static atlas, or the part being rebuilt
const label = (text) => curText.label(text);
const addText = (L, m, height) => curText.add(L, m, height);
// A board with text, facing +z (towards the camera). Returns its width.
function sign(B, x, y, z, text, o = {}) {
  const L = label(text), th = o.th || 1.5, w = L.w / ROW * th + 1.3, h = th + 0.9, ry = o.ry || 0;
  const rot = new THREE.Matrix4().makeRotationY(ry);
  const at = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyMatrix4(rot).add(new THREE.Vector3(x, y, z));
  if (o.post) {
    // the post stops under the board and sits just behind it, so it never pokes through the text
    const p0 = at(0, 0, -0.32), ph = y - h / 2 + 0.3;
    B.add(GEO.box(0.45, ph, 0.4), M(p0.x, ph / 2, p0.z, ry), COL.woodDark, { ol: 0.07 });
    if (!o.noSolid) addCircleSolid(p0.x, p0.z, 0.5);
  }
  const c = at(0, 0, 0);
  B.add(GEO.rbox(w, h, 0.45, 0.35, RK), M(c.x, c.y, c.z, ry), o.color || COL.paper, { ol: 0.09 });
  const f = at(0, 0.02, 0.26);
  addText(L, M(f.x, f.y, f.z, ry), th);
  return w;
}

/* ------------------------------------------------------------------ helpers for the layout */
const segDist = (px, py, [ax, ay, bx, by]) => {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// collision shapes, in world units
const solids = [];   // {type:'box', x0,z0,x1,z1} | {type:'circle', x,z,r}
let curSolids = solids;   // the part of town being built puts its solids here
const addBoxSolid = (x0, z0, x1, z1) => curSolids.push({ type: 'box', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
const addCircleSolid = (x, z, r) => curSolids.push({ type: 'circle', x, z, r });

// building footprints (the 2D art draws buildings up from their bottom-centre point; in 3D the front wall sits at the road edge)
const BSPEC = {
  hall: { d: 14, h: 11, wall: '#fff3d6', roof: COL.roof },
  bank: { d: 12, h: 9, wall: '#e8f1f7', roof: COL.blue },
  market: { d: 12, h: 7.5, wall: '#fff3d6', roof: '#f7f1e3' },
  school: { d: 13, h: 9, wall: '#e59866', roof: '#b8693e' },
  jobs: { d: 12, h: 9, wall: '#bcd6ff', roof: COL.blue },
  rent: { d: 14, h: 16, wall: '#f0d2b0', roof: '#9a7b5b' },
};
const LSPEC = { station: { d: 11, h: 7 }, tech: { d: 12, h: 10 }, biz: { d: 12, h: 18 }, studio: { d: 12, h: 9 }, dealer: { d: 12, h: 7 }, airport: { d: 14, h: 8 }, harbor: { d: 11, h: 7 }, space: { d: 13, h: 9 }, stadium: { d: 14, h: 6 }, museum: { d: 12, h: 10 }, zoo: { d: 10, h: 6 }, cafe: { d: 10, h: 7 }, arcade: { d: 11, h: 8 }, hotel: { d: 12, h: 16 },
  // places that belong to one kind of town. wk: narrower than the slot; body: false = no plain box, the case builds its own
  exchange: { d: 13, h: 12 }, office: { d: 12, h: 30 }, gallery: { d: 12, h: 9 }, concert: { d: 13, h: 8 }, ranch: { d: 12, h: 7 }, orchard: { d: 10, h: 6.5 },
  mine: { d: 12, h: 9, body: false }, lodge: { d: 12, h: 7 }, hotsprings: { d: 12, h: 5.5, body: false }, icecream: { d: 8, h: 5, wk: 0.55 },
  lighthouse: { d: 10, h: 6, wk: 0.62 }, university: { d: 14, h: 11 }, castle: { d: 14, h: 10 }, boathouse: { d: 11, h: 7 }, sawmill: { d: 11, h: 7 },
  treehouse: { d: 10, h: 4, body: false }, observatory: { d: 12, h: 6 }, mart: { d: 8, h: 5, body: false } };
const foot = b => { const s = BSPEC[b.id] || LSPEC[b.type] || { d: 12, h: 9 }, zf = wz(b.y - 45); return { x0: wx(b.x - b.w / 2), x1: wx(b.x + b.w / 2), z0: zf - s.d, z1: zf, zf, cx: wx(b.x) }; };

function freeSpot(gx, gy, pad) {
  if (gx < SLAB.x0 + 30 || gx > SLAB.x1 - 30 || gy < SLAB.y0 + 30 || gy > SLAB.y1 - 30) return false;
  if (gy < T.RAIL_Y + 60) return false;                                                              // the railway
  if (Math.abs(gx - T.STATION.x) < 200 + pad && gy < T.STATION.y + 90 + pad) return false;          // the station
  for (const r of T.ROADS) if (segDist(gx, gy, r) < 50 + pad) return false;
  for (const b of T.BUILDINGS) { const s = BSPEC[b.id]; if (gx > b.x - b.w / 2 - pad && gx < b.x + b.w / 2 + pad && gy > b.y - 45 - s.d * 10 - pad && gy < b.y + 90 + pad) return false; }   // keep the doorstep and the townsfolk clear
  for (const p of T.PLOTS) if (gx > p.x - pad && gx < p.x + p.w + pad && gy > p.y - pad && gy < p.y + p.h + pad) return false;
  const F = T.TOWN_FARM; if (gx > F.x - pad && gx < F.x + F.w + pad && gy > F.y - pad && gy < F.y + F.h + pad) return false;
  if (Math.hypot(gx - T.PLAZA.x, gy - T.PLAZA.y) < T.PLAZA.r + 20 + pad) return false;
  if (gx > 3660 - pad && gx < 4580 + pad && gy > 120 - pad && gy < 840 + pad) return false;   // the forest has its own trees
  if (Math.abs(gx - LOGO.x) < LOGO.w / 2 + 70 + pad * 1.5 && Math.abs(gy - LOGO.y) < LOGO.h / 2 + 40 + pad * 1.5) return false;   // the logo lawn
  const PS = T.PROJECT_SPOTS; if (Math.hypot(gx - PS.park.x, gy - PS.park.y) < 170 + pad) return false;
  for (const k of ['library', 'clinic']) if (Math.abs(gx - PS[k].x) < 110 + pad && gy > PS[k].y - 130 - pad && gy < PS[k].y + 60 + pad) return false;
  if (Math.hypot(gx - 3740, gy - 1760) < 150 + pad) return false;   // bus stop + welcome sign
  return homeClear(gx, gy, pad);
}
// the pool, the tap, the Duck Pond, the ball and the nature spots keep their space (no tree grows in the pool)
const HOME_KEEP = [[T.HOME.tap.x, T.HOME.tap.y, 50], [4215, 2420, 75], [4170, 2330, 40], [T.BALL.x, T.BALL.y, 60], ...T.OLD_SPOTS.map(s => [s.x + 30, s.y, 55])];
function homeClear(gx, gy, pad) {
  if (T.inPool(gx, gy, 50 + pad)) return false;
  const P = T.POND, u = (gx - P.x) / (P.rx + 45 + pad), v = (gy - P.y) / (P.ry + 45 + pad);
  if (u * u + v * v < 1) return false;
  for (const [x, y, r] of HOME_KEEP) if (Math.hypot(gx - x, gy - y) < r + pad) return false;
  return true;
}

/* ------------------------------------------------------------------ build the world */
const W = new Chunked(CELL);       // everything static
const trees = { oak: [], pine: [], stump: [], sapling: [] };
const flowers = [];               // {x,z,color}
const tufts = [];

function buildGround() {
  const x0 = wx(SLAB.x0), x1 = wx(SLAB.x1), z0 = wz(SLAB.y0), z1 = wz(SLAB.y1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  // the diorama board: grass top, layered soil sides
  W.add(GEO.rbox(w, 1.4, d, 0.6, 1), M(cx, -0.7, cz), COL.grass, { ol: 0.3 });
  W.add(GEO.box(w - 0.6, 5, d - 0.6), M(cx, -3.8, cz), '#a0673b', { ol: 0.3, ao: 0.35 });
  W.add(GEO.box(w - 1.2, 2.2, d - 1.2), M(cx, -7.3, cz), '#7d5a44', { ol: 0.3, ao: 0.3 });
  // soft grass patches (same spots the 2D art uses)
  for (let i = 0; i < 70; i++) {
    const px = T.X0 + ((i * 733) % 2400), py = (i * 479) % T.H, r = (60 + (i * 37) % 90) * S;
    W.add(GEO.disc(1, 20), M(wx(px), 0.02 + (i % 5) * 0.002, wz(py), i * 0.7, 0, 0, r, 1, r * 0.6), i % 3 ? COL.grass2 : COL.grass3, { ol: 0 });
  }
  // forest floor
  W.add(GEO.rrect(90, 72, 12), M(wx(4130), 0.035, wz(480)), '#9fca68', { ol: 0 });
  // roads: a darker edge, the road, round caps
  const H1 = 0.06, H2 = 0.1;
  T.ROADS.forEach(([ax, ay, bx, by]) => {
    ax = Math.max(ax, SLAB.x0 + 4);
    const len = Math.hypot(bx - ax, by - ay) * S, ang = Math.atan2(by - ay, bx - ax), mx = wx((ax + bx) / 2), mz = wz((ay + by) / 2);
    W.add(GEO.box(len, H1, 9.6), M(mx, H1 / 2, mz, -ang), COL.roadEdge, { ol: 0 });
    W.add(GEO.box(len, H2, 8.0), M(mx, H2 / 2, mz, -ang), COL.road, { ol: 0 });
    [[ax, ay], [bx, by]].forEach(([px, py]) => {
      if (px <= SLAB.x0 + 4 || px >= SLAB.x1 - 4) return;
      W.add(GEO.disc(4.8, 20), M(wx(px), H1 - 0.005, wz(py)), COL.roadEdge, { ol: 0 });
      W.add(GEO.disc(4.0, 20), M(wx(px), H2 - 0.004, wz(py)), COL.road, { ol: 0 });
    });
  });
  // dashes on the main road
  for (let x = SLAB.x0 + 40; x < SLAB.x1; x += 60) W.add(GEO.box(2.6, 0.04, 0.45), M(wx(x), 0.115, wz(1760)), '#ffffff', { ol: 0 });
  // zebra crossing in front of the plaza
  for (let i = 0; i < 5; i++) W.add(GEO.box(1.1, 0.04, 6.4), M(wx(4760 + i * 20), 0.118, wz(1760)), '#fffaf0', { ol: 0 });
  // plaza
  const P = T.PLAZA;
  W.add(GEO.disc(P.r * S + 1.2, 40), M(wx(P.x), 0.14, wz(P.y)), COL.roadEdge, { ol: 0 });
  W.add(GEO.disc(P.r * S, 40), M(wx(P.x), 0.17, wz(P.y)), COL.plaza, { ol: 0 });
  for (let r = 4; r < P.r * S; r += 3.6) W.add(GEO.ring(r - 0.12, r + 0.12, 40), M(wx(P.x), 0.18, wz(P.y)), '#dfd0aa', { ol: 0 });
}

// how round small boxes (windows, doors, sign boards) are: the new towns use one step less, which looks the same
// from the camera but builds much faster, since every new town has hundreds of them
let RK = 2;
function window3(B, x, y, z, w = 2.6, h = 2.6, ry = 0, lit = COL.glass) {
  B.add(GEO.rbox(w, h, 0.5, 0.35, RK), M(x, y, z, ry), lit, { ol: 0.08 });
  const r = new THREE.Matrix4().makeRotationY(ry), o = new THREE.Vector3(0, 0, 0.26).applyMatrix4(r);
  B.add(GEO.box(0.16, h - 0.3, 0.1), M(x + o.x, y, z + o.z, ry), INKC, { ol: 0 });
  B.add(GEO.box(w - 0.3, 0.16, 0.1), M(x + o.x, y, z + o.z, ry), INKC, { ol: 0 });
  B.add(GEO.box(w * 0.36, 0.16, 0.1), M(x + o.x - w * 0.22, y + h * 0.28, z + o.z + 0.02, ry), '#ffffff', { ol: 0 });
}
function door3(B, x, z, color = COL.dirt, w = 3.6, h = 5.4) {
  B.add(GEO.rbox(w, h, 0.6, 0.5, RK), M(x, h / 2, z), color, { ol: 0.09 });
  B.add(GEO.ico(0.28, 0), M(x + w * 0.28, h * 0.48, z + 0.36), COL.yellow, { ol: 0.04 });
  B.add(GEO.box(w + 1.4, 0.3, 1.6), M(x, 0.15, z + 0.6), '#d9cbb0', { ol: 0.07 });   // doorstep
}
function gable(B, cx, zc, w, d, y, color, over = 1.1, pitch = 0.62, wallColor, stripe = null) {
  const run = d / 2 + over, rise = Math.tan(pitch) * (d / 2), len = Math.hypot(run, rise + 0.3);
  if (wallColor) B.add(GEO.prism(w, rise, d), M(cx, y, zc), wallColor, { ol: 0.1 });
  const dark = new THREE.Color(color).multiplyScalar(0.84), W2 = w + 2 * over;
  [-1, 1].forEach(s => {
    const ms = M(cx, y + rise / 2 + 0.1, zc + s * (run / 2 - 0.05), 0, s * pitch);
    if (stripe) {
      const n = Math.max(3, Math.round(W2 / 3.2)), sw = W2 / n;
      for (let i = 0; i < n; i++) B.add(GEO.box(sw, 0.7, len), ms.clone().multiply(M(-W2 / 2 + sw * (i + 0.5), 0, 0)), i % 2 ? stripe : color, { ol: 0.1 });
    } else {
      B.add(GEO.box(W2, 0.7, len), ms, color, { ol: 0.12, ao: 0.12 });
      // rows of tiles
      for (let t = -len / 2 + 1.2; t < len / 2 - 0.6; t += 1.5) B.add(GEO.box(W2 - 0.1, 0.22, 0.3), ms.clone().multiply(M(0, 0.4, t)), dark, { ol: 0 });
    }
  });
  B.add(GEO.box(W2 + 0.2, 0.55, 1.0), M(cx, y + rise + 0.45, zc), stripe ? '#fff8e8' : dark, { ol: 0.1 });
  return rise;
}

function buildBuilding(b) {
  const s = BSPEC[b.id], f = foot(b), w = b.w * S, cx = f.cx, zc = (f.z0 + f.z1) / 2, zf = f.z1;
  const B = W;
  addBoxSolid(f.x0 - 0.4, f.z0 - 0.4, f.x1 + 0.4, f.z1 + 0.3);
  // soft contact shadow + base plinth
  B.add(GEO.rbox(w + 1.2, 0.5, s.d + 1.2, 0.25, 1), M(cx, 0.25, zc), '#d9cbb0', { ol: 0.08 });
  B.add(GEO.rbox(w, s.h, s.d, 0.45, 2), M(cx, s.h / 2 + 0.3, zc), s.wall, { ol: 0.14, ao: 0.16 });
  const top = s.h + 0.3;
  let signY = 7.4, doorColor = COL.dirt;
  switch (b.id) {
    case 'hall': {
      // steps, columns, gable roof, green dome, flag
      B.add(GEO.box(w * 0.62, 0.45, 3.2), M(cx, 0.22, zf + 1.4), '#e9e2d0', { ol: 0.08 });
      B.add(GEO.box(w * 0.54, 0.45, 2.2), M(cx, 0.67, zf + 0.9), '#f3eddd', { ol: 0.08 });
      for (let i = 0; i < 6; i++) {
        const x = cx - w * 0.36 + i * (w * 0.72 / 5);
        if (Math.abs(x - cx) < 2.5) continue;
        B.add(GEO.cyl(0.62, 0.7, top - 1.2, 10), M(x, (top - 1.2) / 2 + 0.9, zf + 0.9), '#f7f1e3', { ol: 0.09, ao: 0.15 });
      }
      B.add(GEO.box(w * 0.78, 1.0, 1.4), M(cx, top - 0.3, zf + 0.9), '#f3eddd', { ol: 0.1 });
      gable(B, cx, zc, w, s.d, top, s.roof, 1.2, 0.5, s.wall);
      B.add(GEO.cyl(3.3, 3.3, 1.2, 20), M(cx, top + 4.4, zc), '#f3eddd', { ol: 0.1 });
      B.add(GEO.sph(3.3, 18, 10, true), M(cx, top + 5.0, zc), COL.green, { ol: 0.12 });
      B.add(GEO.cyl(0.14, 0.14, 5, 6), M(cx, top + 10.4, zc), INKC, { ol: 0 });
      B.add(GEO.ico(0.35, 0), M(cx, top + 13, zc), COL.yellow, { ol: 0.05 });
      hallFlag.position.set(cx, top + 11.9, zc);
      window3(B, cx - w * 0.36, 5.4, zf + 0.26, 2.4, 3.4); window3(B, cx + w * 0.36, 5.4, zf + 0.26, 2.4, 3.4);
      doorColor = COL.woodDark; signY = top + 1.9;
      break;
    }
    case 'bank': {
      for (let i = 0; i < 4; i++) {
        const x = cx - w * 0.38 + i * (w * 0.76 / 3);
        B.add(GEO.cyl(0.55, 0.62, top - 1.0, 10), M(x, (top - 1.0) / 2 + 0.3, zf + 0.8), '#ffffff', { ol: 0.09, ao: 0.12 });
      }
      B.add(GEO.box(w * 0.9, 0.9, 1.3), M(cx, top - 0.25, zf + 0.8), '#f3f7fa', { ol: 0.1 });
      const rise = gable(B, cx, zc, w, s.d, top, s.roof, 1.1, 0.55, s.wall);
      // a big gold coin on the gable
      B.add(GEO.cyl(1.5, 1.5, 0.45, 20), M(cx, top + rise * 0.42, zf + 0.35, 0, Math.PI / 2), COL.yellow, { ol: 0.09 });
      addText(label('$'), M(cx - 0.02, top + rise * 0.42 + 0.05, zf + 0.62), 1.9);
      doorColor = INKC; signY = top + 0.2 - 2.0;
      break;
    }
    case 'market': {
      gable(B, cx, zc, w, s.d, top, COL.roof, 0.9, 0.5, s.wall, '#fff8e8');
      // striped awning
      const n = 8, sw = (w + 2) / n;
      for (let i = 0; i < n; i++) {
        const x = cx - (w + 2) / 2 + sw * (i + 0.5);
        B.add(GEO.box(sw, 0.35, 4.2), M(x, top - 2.2, zf + 1.8, 0, 0.42), i % 2 ? '#fff8e8' : COL.roof, { ol: 0.07 });
        B.add(GEO.cyl(sw / 2, sw / 2, 0.35, 10, 1), M(x, top - 3.1, zf + 3.75, 0, Math.PI / 2), i % 2 ? '#fff8e8' : COL.roof, { ol: 0.06 });
      }
      // crates of vegetables
      [['#f08a3c', -8.5], [COL.roof, -4.6], ['#f4c35a', 4.6], [COL.green, 8.5]].forEach(([c, dx]) => {
        B.add(GEO.box(3.2, 1.9, 2.4), M(cx + dx, 0.95, zf + 2.2), COL.wood, { ol: 0.08, ao: 0.2 });
        for (let k = 0; k < 3; k++) B.add(GEO.ico(0.62, 1), M(cx + dx - 0.95 + k * 0.95, 2.1, zf + 2.2 + (k % 2) * 0.3), c, { ol: 0.05 });
      });
      addBoxSolid(cx - 10.5, zf, cx - 2.8, zf + 3.6); addBoxSolid(cx + 2.8, zf, cx + 10.5, zf + 3.6);
      window3(B, cx - w * 0.3, 4.2, zf + 0.26, 3.2, 2.4); window3(B, cx + w * 0.3, 4.2, zf + 0.26, 3.2, 2.4);
      signY = top + 1.5;
      break;
    }
    case 'school': {
      const rise = gable(B, cx, zc, w, s.d, top, s.roof, 1.1, 0.6, s.wall);
      // bell tower
      B.add(GEO.box(4.4, 4.2, 4.4), M(cx, top + rise + 1.4, zc + 1.5), s.wall, { ol: 0.1, ao: 0.15 });
      B.add(GEO.box(2.6, 2.2, 4.6), M(cx, top + rise + 1.9, zc + 1.5), '#7d4a2e', { ol: 0 });
      B.add(GEO.sph(0.95, 12, 8), M(cx, top + rise + 1.7, zc + 1.9), COL.yellow, { ol: 0.06 });
      B.add(GEO.cone(3.6, 2.8, 4), M(cx, top + rise + 4.9, zc + 1.5, Math.PI / 4), s.roof, { ol: 0.1 });
      window3(B, cx - w * 0.34, 5.4, zf + 0.26); window3(B, cx - w * 0.18, 5.4, zf + 0.26); window3(B, cx + w * 0.22, 5.4, zf + 0.26); window3(B, cx + w * 0.36, 5.4, zf + 0.26);
      doorColor = COL.blue; signY = top - 1.6;
      break;
    }
    case 'jobs': {
      B.add(GEO.rbox(w + 1.2, 1.9, s.d + 1.2, 0.4, 1), M(cx, top - 1.2, zc), COL.blue, { ol: 0.12 });
      B.add(GEO.box(w + 0.4, 0.7, s.d + 0.4), M(cx, top + 0.1, zc), '#e8f1f7', { ol: 0.1 });
      // something on the flat roof, so it is not one big empty slab when you walk past below it
      B.add(GEO.rbox(4.2, 1.8, 3.2, 0.3, 1), M(cx - 6.5, top + 1.3, zc - 1), '#cfd8e3', { ol: 0.08, ao: 0.2 });
      B.add(GEO.cyl(0.9, 0.9, 0.4, 12), M(cx - 6.5, top + 2.4, zc - 1), '#9fb2c6', { ol: 0.05 });
      B.add(GEO.rbox(2.6, 1.2, 2.6, 0.25, 1), M(cx + 7, top + 1.0, zc + 1.5), '#cfd8e3', { ol: 0.08 });
      B.add(GEO.cyl(0.12, 0.12, 2.4, 5), M(cx + 2, top + 1.6, zc - 2.5), INKC, { ol: 0 });
      B.add(GEO.sph(1.2, 12, 6, true), M(cx + 2, top + 2.9, zc - 2.3, 0, -0.9, 0), '#ffffff', { ol: 0.06 });
      // envelope + briefcase on the facade
      B.add(GEO.box(3.8, 2.6, 0.4), M(cx - 7, 4.6, zf + 0.25), '#ffffff', { ol: 0.08 });
      B.add(GEO.box(2.4, 0.18, 0.1), M(cx - 7.8, 5.2, zf + 0.48, 0, 0, -0.62), INKC, { ol: 0 });
      B.add(GEO.box(2.4, 0.18, 0.1), M(cx - 6.2, 5.2, zf + 0.48, 0, 0, 0.62), INKC, { ol: 0 });
      B.add(GEO.rbox(3.8, 2.6, 1.0, 0.35, 1), M(cx + 7, 4.4, zf + 0.5), COL.dirt, { ol: 0.08 });
      B.add(GEO.box(1.6, 0.8, 0.5), M(cx + 7, 6.0, zf + 0.5), INKC, { ol: 0 });
      // mailbox
      B.add(GEO.box(0.35, 2.4, 0.35), M(cx + 11.4, 1.2, zf + 3), INKC, { ol: 0 });
      B.add(GEO.rbox(1.6, 1.4, 2.0, 0.5, 2), M(cx + 11.4, 3.0, zf + 3), COL.roof, { ol: 0.07 });
      addCircleSolid(cx + 11.4, zf + 3, 1.2);
      doorColor = INKC; signY = top - 3.6;
      break;
    }
    case 'rent': {
      B.add(GEO.rbox(w + 1.6, 1.6, s.d + 1.6, 0.4, 1), M(cx, top + 0.6, zc), s.roof, { ol: 0.12 });
      B.add(GEO.box(3, 2, 3), M(cx + 6, top + 2.3, zc - 2), '#d9cbb0', { ol: 0.08 });   // rooftop water tank
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        if (r === 0 && (c === 1 || c === 2)) continue;
        window3(B, cx - w * 0.36 + c * (w * 0.72 / 3), 4.2 + r * 4.3, zf + 0.26, 2.6, 2.6, 0, r === 2 && c === 3 ? '#ffe9a3' : COL.glass);
      }
      // little balcony flower boxes
      for (let c = 0; c < 4; c++) B.add(GEO.box(2.8, 0.6, 0.8), M(cx - w * 0.36 + c * (w * 0.72 / 3), 10.6, zf + 0.5), COL.wood, { ol: 0.06 });
      for (let c = 0; c < 4; c++) for (let k = 0; k < 3; k++) B.add(GEO.ico(0.3, 0), M(cx - w * 0.36 + c * (w * 0.72 / 3) - 0.8 + k * 0.8, 11.1, zf + 0.6), ['#ff8fb1', COL.yellow, '#b98cff'][(c + k) % 3], { ol: 0.03 });
      doorColor = COL.woodDark; signY = 7.9;
      break;
    }
  }
  door3(B, cx, zf + 0.3, doorColor);
  sign(B, cx, signY, zf + (b.id === 'bank' ? 1.7 : 0.5), `${b.icon} ${b.name}`, { th: 1.7 });
  // bushes at the corners
  [[-1, 0], [1, 0]].forEach(([sx]) => {
    const x = sx < 0 ? f.x0 - 0.2 : f.x1 + 0.2;
    B.add(GEO.ico(1.5, 1), M(x, 1.1, zf + 0.6), '#7fbf55', { ol: 0.09 });
    B.add(GEO.ico(1.1, 1), M(x + sx * 1.3, 0.9, zf - 1.0), '#8ccb5e', { ol: 0.08 });
  });
}

function buildPlaza() {
  // benches around the plaza (the fountain in the middle is a town project)
  const x = wx(T.PLAZA.x), z = wz(T.PLAZA.y);
  [0.6, 2.2, 3.9, 5.5].forEach(a => bench(W, x + Math.sin(a) * 12.2, z + Math.cos(a) * 12.2, a + Math.PI));
}
function bench(B, x, z, ry) {
  const r = new THREE.Matrix4().makeRotationY(ry), at = (dx, dz) => new THREE.Vector3(dx, 0, dz).applyMatrix4(r);
  let p = at(0, 0); B.add(GEO.box(4.2, 0.35, 1.4), M(x + p.x, 1.2, z + p.z, ry), COL.wood, { ol: 0.07 });
  p = at(0, -0.65); B.add(GEO.box(4.2, 1.2, 0.3), M(x + p.x, 2.0, z + p.z, ry), COL.wood, { ol: 0.07 });
  [-1.7, 1.7].forEach(dx => { p = at(dx, 0); B.add(GEO.box(0.3, 1.1, 1.2), M(x + p.x, 0.55, z + p.z, ry), INKC, { ol: 0 }); });
  addCircleSolid(x, z, 1.8);
}
function lamp(B, x, z) {
  B.add(GEO.cyl(0.18, 0.26, 7, 6), M(x, 3.5, z), INKC, { ol: 0 });
  B.add(GEO.cyl(0.5, 0.6, 0.4, 8), M(x, 0.2, z), INKC, { ol: 0 });
  B.add(GEO.ico(0.75, 1), M(x, 7.4, z), '#ffe9a3', { ol: 0.07 });
  B.add(GEO.cone(0.8, 0.6, 8), M(x, 8.3, z), INKC, { ol: 0 });
  addCircleSolid(x, z, 0.6);
}
const LAMPS = [[4560, 1240], [5040, 1240], [4560, 1520], [5040, 1520], [4200, 1810], [4600, 1810], [5000, 1810], [5400, 1810], [4860, 1050],
  [3800, 1810], [5800, 1810], [4860, 2300], [5480, 1100], [4380, 800]];

function fence(B, x0, z0, x1, z1, gap = null) {
  // posts + two rails around a rectangle, with an opening in the middle of the front (z1) side
  const post = (x, z) => B.add(GEO.box(0.42, 1.9, 0.42), M(x, 0.95, z), COL.wood, { ol: 0.06 });
  const rail = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    [0.7, 1.4].forEach(y => B.add(GEO.box(len, 0.22, 0.16), M((ax + bx) / 2, y, (az + bz) / 2, -ang), '#e0b27f', { ol: 0.05 }));
    addBoxSolid(Math.min(ax, bx) - 0.3, Math.min(az, bz) - 0.3, Math.max(ax, bx) + 0.3, Math.max(az, bz) + 0.3);
  };
  const side = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 3.4));
    for (let i = 0; i <= n; i++) post(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
    rail(ax, az, bx, bz);
  };
  side(x0, z0, x1, z0); side(x0, z0, x0, z1); side(x1, z0, x1, z1);
  if (gap) { const m = (x0 + x1) / 2; side(x0, z1, m - gap / 2, z1); side(m + gap / 2, z1, x1, z1); } else side(x0, z1, x1, z1);
}

// crops, drawn from a centre point on the soil. g = how grown (0..1)
function crop(B, x, z, kind, g) {
  B.base = new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeScale(1.45, 1.45, 1.45)).multiply(new THREE.Matrix4().makeTranslation(-x, 0, -z));
  cropInner(B, x, z, kind, g);
  B.base = null;
}
function cropInner(B, x, z, kind, g) {
  const k = 0.35 + 0.65 * g;
  B.add(GEO.sph(1.25, 10, 6, true), M(x, 0.25, z, 0, 0, 0, 1, 0.35, 1), '#7a4a2a', { ol: 0 });   // soil mound
  if (g < 0) return;   // just soil
  if (kind === 'tree') {   // a sapling that grows into a small tree
    B.add(GEO.cyl(0.12 + 0.2 * g, 0.18 + 0.25 * g, 1.4 + 2.4 * g, 6), M(x, 0.6 + 1.2 * g, z), '#8a5a34', { ol: 0.04 });
    B.add(GEO.ico(0.6 + 1.3 * g, 1), M(x, 1.6 + 2.8 * g, z), g > 0.95 ? '#7fbb52' : '#9dd46e', { ol: 0.07 });
    return;
  }
  if (g < 0.2) {  // sprout
    B.add(GEO.cone(0.28, 1.0, 5), M(x - 0.25, 0.8, z, 0, 0, 0.7), '#8cd05a', { ol: 0.04 });
    B.add(GEO.cone(0.28, 1.0, 5), M(x + 0.25, 0.8, z, 0, 0, -0.7), '#8cd05a', { ol: 0.04 });
    return;
  }
  switch (kind) {
    case 'wheat':
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26, dx = Math.cos(a) * 0.6, dz = Math.sin(a) * 0.5;
        B.add(GEO.cyl(0.07, 0.09, 2.2 * k, 4), M(x + dx, 0.4 + 1.1 * k, z + dz), '#b9c95a', { ol: 0 });
        B.add(GEO.capsule(0.22, 0.7 * k), M(x + dx, 0.5 + 2.3 * k, z + dz), g > 0.9 ? '#f4c35a' : '#d8d86a', { ol: 0.04 });
      }
      break;
    case 'carrot':
      B.add(GEO.cone(0.45 * k + 0.1, 0.6, 7), M(x, 0.55, z, 0, Math.PI), '#f08a3c', { ol: 0.05 });
      for (let i = 0; i < 3; i++) B.add(GEO.cone(0.22, 1.5 * k, 5), M(x + (i - 1) * 0.3, 0.8 + 0.75 * k, z, 0, 0, (i - 1) * 0.35), '#6fb84a', { ol: 0.04 });
      break;
    case 'tomato':
      B.add(GEO.ico(1.0 * k, 1), M(x, 0.4 + 1.0 * k, z), '#6fb84a', { ol: 0.06 });
      if (g > 0.5) [[0.7, 0.3], [-0.6, 0.5], [0.1, 0.9]].forEach(([dx, dz]) => B.add(GEO.ico(0.36, 1), M(x + dx * k, 0.5 + 1.2 * k, z + dz * k), g > 0.9 ? COL.roof : '#b6d65a', { ol: 0.04 }));
      break;
    case 'corn':
      B.add(GEO.cyl(0.14, 0.2, 4.2 * k, 5), M(x, 0.4 + 2.1 * k, z), '#7fbf55', { ol: 0.04 });
      [-1, 1].forEach(s => B.add(GEO.cone(0.3, 2.0 * k, 4), M(x + s * 0.5, 0.4 + 2.0 * k, z, 0, 0, -s * 0.9), '#8cd05a', { ol: 0.03 }));
      if (g > 0.6) B.add(GEO.capsule(0.3, 0.9), M(x + 0.35, 0.4 + 3.2 * k, z + 0.1, 0, 0, -0.25), COL.yellow, { ol: 0.04 });
      break;
  }
}
// a floating drop over thirsty crops
const waterDrop = (B, x, z) => { B.add(GEO.ico(0.42, 1), M(x, 3.4, z, 0, 0, 0, 1, 1.3, 1), '#6fd0f0', { ol: 0.05 }); };

/* ------------------------------------------------------------------ the parts of town that change */
const dyn = new Map();   // key -> { sig, group, solids }
function disposeGroup(g) {
  g.traverse(o => {
    if (o.geometry && !o.userData.keepGeo) o.geometry.dispose();
    if (o.material && o.material !== toonMat && o.material !== outlineMat) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
}
// (Re)build one part of town when its signature changes. build(B) adds primitives and may return extra objects.
function setPart(key, sig, build) {
  const d = dyn.get(key);
  if (d && d.sig === sig) return false;
  if (d) { scene.remove(d.group); disposeGroup(d.group); }
  const B = new Builder(), list = [], atlas = new TextAtlas(1024, 256);
  const ps = curSolids, pt = curText; curSolids = list; curText = atlas;
  let extra = [];
  try { extra = build(B) || []; } finally { curSolids = ps; curText = pt; }
  const group = new THREE.Group();
  if (B.p.length) group.add(B.mesh());
  const tm = atlas.mesh(); if (tm) group.add(tm);
  extra.forEach(o => group.add(o));
  scene.add(group);
  dyn.set(key, { sig, group, solids: list });
  return true;
}
const PASTEL = ['#ffd9e0', '#d6f1ff', '#fff1a8', '#e0f5d0', '#eadcff', '#ffe2c6', '#d9f7f0', '#f7e0ff'];
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const BUILD_TIME = 45 * 1000;    // a new house stands as a wooden frame for a little while
const PLOT_SIGN = (p, st) => st && st.owner ? (p.kind === 'farm' ? `${st.name}'s Farm` : st.build === 'shop' ? `${st.name}'s Shop` : st.build === 'house' ? `${st.name}'s House` : `${st.name}'s Land`) : `For sale · ${p.price} coins`;
function plotSig(p, st, now) {
  if (!st || !st.owner) return 'free';
  if (p.kind === 'lot') return [st.owner, st.name, st.build, st.build && now - (st.buildAt || 0) < BUILD_TIME ? 'site' : 'done'].join('|');
  return [st.owner, st.name, ...st.soil.map(c => {
    const s = T.cropState(c, now);
    return s === 'growing' ? c.k + Math.floor(T.cropProgress(c, now) * 4) : c ? c.k + s : '-';
  })].join('|');
}
function buildPlot(B, p, st, now) {
  const x0 = wx(p.x), z0 = wz(p.y), x1 = wx(p.x + p.w), z1 = wz(p.y + p.h), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const owner = st && st.owner;
  if (p.kind === 'farm') {
    B.add(GEO.rbox(p.w * S - 0.6, 0.34, p.h * S - 0.6, 0.15, 1), M(cx, 0.17, cz), owner ? COL.soil : COL.soilLight, { ol: 0.07 });
    if (owner) {
      for (let i = 0; i < 6; i++) {
        const s = T.soilSpot(p, i), c = st.soil[i], x = wx(s.x), z = wz(s.y), state = T.cropState(c, now);
        if (!c) { crop(B, x, z, 'wheat', -1); continue; }
        crop(B, x, z, c.k, state === 'ready' ? 1 : state === 'dry' ? 0.05 : Math.max(0.05, Math.floor(T.cropProgress(c, now) * 4) / 4));
        if (state === 'dry') waterDrop(B, x, z);
      }
    } else {
      for (let i = 0; i < 4; i++) B.add(GEO.box(p.w * S - 3, 0.16, 0.5), M(cx, 0.36, z0 + 3.2 + i * 3.4), '#b8946a', { ol: 0 });
    }
    fence(B, x0, z0, x1, z1, 5);
    sign(B, cx - 4.6, 3.4, z1 + 0.9, PLOT_SIGN(p, st), { post: true, th: 1.5, color: owner ? COL.paper : '#fff1a8' });
    return;
  }
  B.add(GEO.rbox(p.w * S - 0.6, 0.22, p.h * S - 0.6, 0.1, 1), M(cx, 0.11, cz), st && st.build ? '#d8cdb4' : '#cfe3a8', { ol: 0.06 });
  if (!st || !st.build) {
    [[x0 + 0.8, z0 + 0.8], [x1 - 0.8, z0 + 0.8], [x0 + 0.8, z1 - 0.8], [x1 - 0.8, z1 - 0.8]].forEach(([x, z]) => {
      B.add(GEO.box(0.3, 1.4, 0.3), M(x, 0.7, z), COL.wood, { ol: 0.05 });
      B.add(GEO.box(0.34, 0.3, 0.34), M(x, 1.3, z), owner ? COL.blue : COL.roof, { ol: 0 });
    });
    sign(B, cx, 3.6, cz + 3, PLOT_SIGN(p, st), { post: true, th: 1.6, color: owner ? COL.paper : '#fff1a8' });
    return;
  }
  if (now - (st.buildAt || 0) < BUILD_TIME) {
    // a building site: a stack of logs and a wooden frame
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) B.add(GEO.cyl(0.55, 0.55, 5, 8), M(cx - 5 + j * 1.1 + i * 0.55, 0.55 + i * 0.95, cz + 3, 0, 0, Math.PI / 2), '#b07a4a', { ol: 0.06 });
    [[-4, -3], [4, -3], [-4, 2], [4, 2]].forEach(([dx, dz]) => B.add(GEO.box(0.5, 6, 0.5), M(cx + 2 + dx * 0.7, 3, cz - 2 + dz * 0.7), COL.wood, { ol: 0.06 }));
    B.add(GEO.box(6.2, 0.45, 0.45), M(cx + 2, 6, cz - 2 - 2.1), COL.wood, { ol: 0.06 });
    B.add(GEO.box(6.2, 0.45, 0.45), M(cx + 2, 6, cz - 2 + 1.4), COL.wood, { ol: 0.06 });
    sign(B, cx - 4.5, 3.2, z1 + 0.2, `Building ${st.name}'s ${st.build}…`, { post: true, th: 1.4 });
    addBoxSolid(cx - 3, cz - 5, cx + 5.4, cz + 1.3);
    return;
  }
  const shop = st.build === 'shop', wall = PASTEL[hash(st.owner) % PASTEL.length];
  const hw = shop ? 13 : 11.5, hd = 9, hh = shop ? 6.5 : 5.8, hz = cz - 1.4;
  B.add(GEO.rbox(hw, hh, hd, 0.4, 2), M(cx, hh / 2, hz), wall, { ol: 0.12, ao: 0.16 });
  if (shop) {
    B.add(GEO.box(hw + 0.8, 0.7, hd + 0.8), M(cx, hh + 0.3, hz), '#f3eddd', { ol: 0.1 });
    for (let i = 0; i < 6; i++) B.add(GEO.box((hw + 1) / 6, 0.3, 2.6), M(cx - (hw + 1) / 2 + (hw + 1) / 12 * (2 * i + 1), hh - 1.2, hz + hd / 2 + 1.1, 0, 0.4), i % 2 ? '#fff8e8' : COL.blue, { ol: 0.06 });
    window3(B, cx - 3.4, 2.6, hz + hd / 2 + 0.2, 2.8, 2.2);
    // crates out front
    [['#f08a3c', -4.5], [COL.green, 5.4]].forEach(([c, dx]) => { B.add(GEO.box(2.2, 1.3, 1.6), M(cx + dx, 0.65, hz + hd / 2 + 1.6), COL.wood, { ol: 0.07 }); B.add(GEO.ico(0.5, 1), M(cx + dx, 1.5, hz + hd / 2 + 1.6), c, { ol: 0.04 }); });
  } else {
    gable(B, cx, hz, hw, hd, hh, COL.roof, 0.8, 0.62, wall);
    window3(B, cx - 3.2, 3.3, hz + hd / 2 + 0.2, 2.2, 2.2);
    B.add(GEO.box(1.1, 2.6, 1.1), M(cx + 3.4, hh + 3.4, hz - 1.5), '#c8745a', { ol: 0.07 });   // chimney
  }
  door3(B, cx + (shop ? 2.6 : 1.6), hz + hd / 2 + 0.25, shop ? INKC : COL.dirt, 2.6, 4.2);
  sign(B, cx - 5.2, 2.9, z1 + 0.3, PLOT_SIGN(p, st), { post: true, th: 1.4 });
  B.add(GEO.ico(1.2, 1), M(cx + hw / 2 + 0.6, 0.9, hz + 3), '#7fbf55', { ol: 0.08 });
  addBoxSolid(cx - hw / 2 - 0.3, hz - hd / 2 - 0.3, cx + hw / 2 + 0.3, hz + hd / 2 + 0.4);
}

function buildTownFarm() {
  const F = T.TOWN_FARM, x0 = wx(F.x), z0 = wz(F.y), x1 = wx(F.x + F.w), z1 = wz(F.y + F.h), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  W.add(GEO.rbox(F.w * S, 0.4, F.h * S, 1.6, 2), M(cx, 0.2, cz), COL.dirt, { ol: 0.1 });
  for (let z = z0 + 3; z < z1 - 1; z += 3.4) W.add(GEO.box(F.w * S - 3.2, 0.14, 0.5), M(cx, 0.43, z), '#8a5530', { ol: 0 });
  fence(W, x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, 6);
  sign(W, cx - 9, 3.4, z1 + 1.6, '🌾 Town Farm · anyone can help', { post: true, th: 1.5 });
  // a scarecrow and a red barn
  const sx = x1 - 4, sz = z0 + 4;
  W.add(GEO.box(0.35, 5, 0.35), M(sx, 2.5, sz), COL.woodDark, { ol: 0.05 });
  W.add(GEO.box(4, 0.35, 0.35), M(sx, 3.8, sz), COL.woodDark, { ol: 0.05 });
  W.add(GEO.rbox(1.8, 1.8, 1.8, 0.4, 1), M(sx, 5.4, sz), '#f4dca0', { ol: 0.07 });
  W.add(GEO.cone(1.6, 1.4, 8), M(sx, 6.7, sz), '#b8693e', { ol: 0.07 });
  W.add(GEO.rbox(2.2, 2.0, 1.2, 0.3, 1), M(sx, 3.4, sz), COL.blue, { ol: 0.06 });
  addCircleSolid(sx, sz, 0.8);
  const bx = x0 - 7, bz = z0 + 10;
  W.add(GEO.rbox(10, 7, 9, 0.3, 1), M(bx, 3.5, bz), '#d9534f', { ol: 0.12, ao: 0.18 });
  gable(W, bx, bz, 10, 9, 7, '#7d5a44', 0.7, 0.75, '#d9534f');
  W.add(GEO.box(4.2, 4.6, 0.3), M(bx, 2.3, bz + 4.55), '#f7f1e3', { ol: 0.07 });
  W.add(GEO.box(0.25, 5.8, 0.1), M(bx, 2.3, bz + 4.72, 0, 0, 0.72), '#f7f1e3', { ol: 0 });
  W.add(GEO.box(0.25, 5.8, 0.1), M(bx, 2.3, bz + 4.72, 0, 0, -0.72), '#f7f1e3', { ol: 0 });
  addBoxSolid(bx - 5.2, bz - 4.8, bx + 5.2, bz + 4.8);
  // hay bales
  [[bx - 7, bz + 3], [bx - 7.4, bz + 6], [bx - 4.5, bz + 7.5]].forEach(([x, z]) => { W.add(GEO.cyl(1.2, 1.2, 1.8, 12), M(x, 1.2, z, 0.3, 0, Math.PI / 2), '#f4d27a', { ol: 0.07 }); addCircleSolid(x, z, 1.3); });
}
function townFarmSig(town, now) {
  return T.FARM_SPOTS.map((s, i) => Math.min(4, Math.floor((now - ((town && town.farm[i]) || 0)) / T.FARM_REGROW * 4))).join('');
}

function buildForestStatic() {
  // every forest spot blocks walking (trees and stumps both)
  T.FOREST.forEach(t => addCircleSolid(wx(t.x), wz(t.y), 1.1));
  sign(W, wx(4455), 3.4, wz(842), '🌲 Town Forest · cut one, plant one', { post: true, th: 1.5 });
  // a log pile by the forest (the sawmill yard)
  const lx = wx(4318), lz = wz(806);
  for (let i = 0; i < 3; i++) W.add(GEO.cyl(0.5, 0.5, 3.6, 8), M(lx + i * 1.0, 0.5, lz + (i % 2) * 0.2, 0.2, 0, Math.PI / 2), '#b07a4a', { ol: 0.06 });
}

/* ------------------------------------------------------------------ the Small World mark */
// The logo, recoloured in the town's greens, mown into the lawn beside the plaza: easy to spot, never in the way.
const LOGO = { x: 4546, y: 1330, w: 180, h: 180 * 228 / 640 };
function buildLogoMark() { logoMark(LOGO.x, LOGO.y, LOGO.w); }

/* ------------------------------------------------------------------ town projects */
const PROJ_SIGN = { fountain: '⛲ Future fountain · vote at Town Hall', park: '🌳 Future Town Park · vote at Town Hall', library: '📚 Future Library · vote at Town Hall', clinic: '🏥 Future Clinic · vote at Town Hall' };
function futureSpot(B, id, x, z) {
  sign(B, x, 3.6, z + 2, PROJ_SIGN[id], { post: true, th: 1.4, color: '#fff1a8' });
  [[-5, -3], [5, -3], [-5, 4], [5, 4]].forEach(([dx, dz]) => { B.add(GEO.box(0.3, 1.4, 0.3), M(x + dx, 0.7, z + dz), COL.wood, { ol: 0.05 }); B.add(GEO.box(0.34, 0.3, 0.34), M(x + dx, 1.3, z + dz), COL.yellow, { ol: 0 }); });
}
function buildFountain(B) {
  const P = T.PROJECT_SPOTS.fountain, x = wx(P.x), z = wz(P.y);
  // basin wall with a rounded rim ring on top, and the pool surface just above the wall top
  B.add(GEO.cyl(6.2, 6.6, 1.5, 28), M(x, 0.75, z), '#e9e2d0', { ol: 0.14, ao: 0.2 });
  B.add(GEO.torus(5.95, 0.42, 28), M(x, 1.62, z), '#f7f1e3', { ol: 0.08 });
  B.add(GEO.disc(5.7, 28), M(x, 1.56, z), '#8fdcf2', { ol: 0 });
  B.add(GEO.ring(3.4, 3.8, 28), M(x, 1.58, z), '#bfefff', { ol: 0 });
  B.add(GEO.ring(1.35, 1.6, 20), M(x, 1.58, z), '#bfefff', { ol: 0 });
  B.add(GEO.cyl(0.8, 1.1, 3.4, 12), M(x, 2.9, z), '#e9e2d0', { ol: 0.09 });
  B.add(GEO.cyl(2.5, 1.2, 0.9, 16), M(x, 4.7, z), '#f7f1e3', { ol: 0.1 });
  B.add(GEO.disc(2.2, 16), M(x, 5.16, z), '#8fdcf2', { ol: 0 });
  B.add(GEO.ico(0.55, 1), M(x, 5.6, z), '#bfefff', { ol: 0.05 });
  addCircleSolid(x, z, 7.2);
}
function buildPlazaBed(B) {
  const P = T.PROJECT_SPOTS.fountain, x = wx(P.x), z = wz(P.y);
  B.add(GEO.cyl(4.2, 4.4, 0.7, 24), M(x, 0.35, z), '#d9cbb0', { ol: 0.1 });
  B.add(GEO.disc(3.9, 24), M(x, 0.72, z), '#7a4a2a', { ol: 0 });
  for (let i = 0; i < 10; i++) { const a = i * 0.63, r = 1 + (i % 3) * 1.1; B.add(GEO.ico(0.35, 0), M(x + Math.cos(a) * r, 1.0, z + Math.sin(a) * r), ['#ff8fb1', COL.yellow, '#b98cff'][i % 3], { ol: 0.03 }); }
  sign(B, x, 3.6, z + 5.4, PROJ_SIGN.fountain, { post: true, th: 1.4, color: '#fff1a8' });
  addCircleSolid(x, z, 4.6);
}
function buildPark(B) {
  const pk = T.PROJECT_SPOTS.park, px = wx(pk.x), pz = wz(pk.y);
  B.add(GEO.disc(1, 28), M(px, 0.05, pz, 0, 0, 0, 7.4, 1, 5.4), '#d4bf8c', { ol: 0 });
  B.add(GEO.disc(1, 28), M(px, 0.08, pz, 0, 0, 0, 6.6, 1, 4.7), '#8fdcf2', { ol: 0 });
  B.add(GEO.ring(0.8, 0.86, 28), M(px, 0.1, pz, 0, 0, 0, 6.6, 1, 4.7), '#bfefff', { ol: 0 });
  [[px - 7, pz - 3], [px + 6.5, pz + 3], [px + 5, pz - 4.5]].forEach(([x, z]) => { B.add(GEO.ico(0.8, 0), M(x, 0.4, z), '#cfc6d8', { ol: 0.07 }); addCircleSolid(x, z, 0.9); });
  addBoxSolid(px - 6.2, pz - 4.2, px + 6.2, pz + 4.2);
  bench(B, px - 10, pz + 6, 0.3); bench(B, px + 10, pz + 6, -0.3);
  // a slide
  const sx = px + 13, sz = pz - 3;
  B.add(GEO.box(0.3, 4.2, 0.3), M(sx - 1, 2.1, sz - 1), COL.blue, { ol: 0.05 }); B.add(GEO.box(0.3, 4.2, 0.3), M(sx + 1, 2.1, sz - 1), COL.blue, { ol: 0.05 });
  B.add(GEO.box(2.4, 0.3, 2.2), M(sx, 4.2, sz - 1), COL.yellow, { ol: 0.06 });
  B.add(GEO.box(2.0, 0.25, 6.2), M(sx, 2.3, sz + 2.4, 0, 0.72), COL.roof, { ol: 0.06 });
  addCircleSolid(sx, sz, 2.2);
  // trees
  [[px - 14, pz - 5], [px - 13, pz + 4], [px + 2, pz - 9], [px + 14, pz + 7]].forEach(([x, z], i) => {
    B.add(GEO.cyl(0.5, 0.7, 3, 7), M(x, 1.5, z), '#9a6a44', { ol: 0.1 });
    B.add(GEO.ico(2.4, 1), M(x, 4.6, z), ['#8cc45e', '#7fbb52', '#94cc66', '#9dd46e'][i], { ol: 0.12 });
    addCircleSolid(x, z, 1.1);
  });
  sign(B, px - 15, 3.4, pz + 10, '🌳 Town Park · built with taxes', { post: true, th: 1.4 });
}
function buildSmallHouse(B, x, z, w, d, h, wall, roof, text) {
  B.add(GEO.rbox(w + 1, 0.5, d + 1, 0.25, 1), M(x, 0.25, z), '#d9cbb0', { ol: 0.08 });
  B.add(GEO.rbox(w, h, d, 0.4, 2), M(x, h / 2 + 0.3, z), wall, { ol: 0.12, ao: 0.16 });
  gable(B, x, z, w, d, h + 0.3, roof, 0.9, 0.55, wall);
  door3(B, x, z + d / 2 + 0.3, COL.woodDark, 3, 4.6);
  window3(B, x - w * 0.3, 3.6, z + d / 2 + 0.26); window3(B, x + w * 0.3, 3.6, z + d / 2 + 0.26);
  sign(B, x, h + 1.4, z + d / 2 + 0.6, text, { th: 1.4 });
  addBoxSolid(x - w / 2 - 0.4, z - d / 2 - 0.4, x + w / 2 + 0.4, z + d / 2 + 0.3);
}
function buildLibrary(B) {
  const P = T.PROJECT_SPOTS.library, x = wx(P.x), z = wz(P.y) - 5.5;
  buildSmallHouse(B, x, z, 16, 10, 6.5, '#e8f1f7', '#b98cff', '📚 Library');
  // a big book over the door
  B.add(GEO.box(3.2, 2.2, 0.5), M(x - 1.7, 9.7, z + 5.2, 0.25), COL.roof, { ol: 0.07 });
  B.add(GEO.box(3.2, 2.2, 0.5), M(x + 1.7, 9.7, z + 5.2, -0.25), COL.blue, { ol: 0.07 });
}
function buildClinic(B) {
  const P = T.PROJECT_SPOTS.clinic, x = wx(P.x), z = wz(P.y) - 5.5;
  buildSmallHouse(B, x, z, 15, 10, 6.5, '#ffffff', '#8fdcf2', '🏥 Clinic');
  B.add(GEO.box(2.6, 0.8, 0.4), M(x + 5, 5.2, z + 5.3), '#e4572e', { ol: 0.05 });
  B.add(GEO.box(0.8, 2.6, 0.4), M(x + 5, 5.2, z + 5.3), '#e4572e', { ol: 0.05 });
}
function buildLights(B) { LAMPS.forEach(([gx, gy]) => lamp(B, wx(gx), wz(gy))); }
function buildBunting(B, n) {
  // festival flags strung around the plaza, one more colour for every festival
  const x = wx(T.PLAZA.x), z = wz(T.PLAZA.y), r = T.PLAZA.r * S + 0.5, cols = ['#ff8fb1', COL.yellow, '#8fdcf2', '#b98cff', '#8cbf5a', COL.roof];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; B.add(GEO.cyl(0.14, 0.14, 7, 5), M(x + Math.cos(a) * r, 3.5, z + Math.sin(a) * r), INKC, { ol: 0 }); }
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2 + 0.4, sag = Math.abs(Math.sin((i % 9) / 9 * Math.PI)) * 1.2;
    B.add(GEO.cone(0.45, 0.9, 3), M(x + Math.cos(a) * r, 6.2 - sag, z + Math.sin(a) * r, -a, Math.PI), cols[i % Math.min(cols.length, 2 + n)], { ol: 0.03 });
  }
}
function updateProjects(town) {
  const has = (id) => !!town && town.built.includes(id);
  setPart('p:fountain', has('fountain') ? 'y' : 'n', B => { if (has('fountain')) buildFountain(B); else buildPlazaBed(B); });
  fountainOn = has('fountain');
  const PS = T.PROJECT_SPOTS;
  setPart('p:park', has('park') ? 'y' : 'n', B => { if (has('park')) buildPark(B); else futureSpot(B, 'park', wx(PS.park.x), wz(PS.park.y)); });
  parkOn = has('park');
  setPart('p:library', has('library') ? 'y' : 'n', B => { if (has('library')) buildLibrary(B); else futureSpot(B, 'library', wx(PS.library.x), wz(PS.library.y) - 4); });
  setPart('p:clinic', has('clinic') ? 'y' : 'n', B => { if (has('clinic')) buildClinic(B); else futureSpot(B, 'clinic', wx(PS.clinic.x), wz(PS.clinic.y) - 4); });
  setPart('p:lights', has('lights') ? 'y' : 'n', B => { if (has('lights')) buildLights(B); });
  lightsOn = has('lights');
  const fests = town ? town.built.filter(id => /^festival/.test(id)).length : 0;
  setPart('p:fest', String(Math.min(4, fests)), B => { if (fests) buildBunting(B, fests); });
  busOn = has('bus');
  setPart('p:bus', busOn ? 'y' : 'n', B => { if (!busOn) sign(B, busStop.x + 6, 3.4, busStop.z + 3.5, '🚌 Bus line · vote at Town Hall', { post: true, th: 1.3, color: '#fff1a8' }); });
}
let fountainOn = false, parkOn = false, lightsOn = false, busOn = false;
const busStop = { x: 0, z: 0 };

function buildDecor() {
  const r = rng(7), placed = [];
  const tryPlace = (gx, gy, minD) => {
    if (!freeSpot(gx, gy, 40)) return false;
    for (const q of placed) if (Math.hypot(q[0] - gx, q[1] - gy) < minD) return false;
    placed.push([gx, gy]); return true;
  };
  // a denser border of trees frames the diorama
  for (let i = 0; i < 900; i++) {
    const edge = r() < 0.6;
    let gx, gy;
    if (edge) {
      const side = Math.floor(r() * 4), t = r(), inset = 30 + r() * (side === 3 ? 60 : 170);
      if (side === 1) continue;   // keep the east side open for the next district
      gx = side === 0 ? SLAB.x0 + inset : SLAB.x0 + t * (SLAB.x1 - SLAB.x0);
      gy = side === 2 ? SLAB.y0 + inset : side === 3 ? SLAB.y1 - inset : SLAB.y0 + t * (SLAB.y1 - SLAB.y0);
    } else { gx = SLAB.x0 + r() * (SLAB.x1 - SLAB.x0); gy = SLAB.y0 + r() * (SLAB.y1 - SLAB.y0); }
    if (!tryPlace(gx, gy, edge ? 75 : 130)) continue;
    const x = wx(gx), z = wz(gy), s = 0.85 + r() * 0.45, k = r();
    if (k < 0.12) { W.add(GEO.ico(1.4 * s, 1), M(x, 0.9, z), '#86c45a', { ol: 0.09 }); W.add(GEO.ico(1.0 * s, 1), M(x + 1.3, 0.7, z + 0.5), '#94cf66', { ol: 0.08 }); continue; }
    trees[k < 0.62 ? 'oak' : 'pine'].push({ x, z, s, r: i });
    addCircleSolid(x, z, 1.2 * s);
  }
  // flowers and grass tufts in the open grass
  for (let i = 0; i < 1400 && flowers.length < 260; i++) {
    const gx = SLAB.x0 + r() * (SLAB.x1 - SLAB.x0), gy = SLAB.y0 + r() * (SLAB.y1 - SLAB.y0);
    if (!freeSpot(gx, gy, 6)) continue;
    const n = 2 + Math.floor(r() * 4), c = ['#ff8fb1', '#fff8e8', COL.yellow, '#b98cff', '#ff9f6b'][Math.floor(r() * 5)];
    for (let j = 0; j < n; j++) flowers.push({ x: wx(gx) + (r() - 0.5) * 3, z: wz(gy) + (r() - 0.5) * 3, c });
  }
  for (let i = 0; i < 2000 && tufts.length < 420; i++) {
    const gx = SLAB.x0 + r() * (SLAB.x1 - SLAB.x0), gy = SLAB.y0 + r() * (SLAB.y1 - SLAB.y0);
    if (!freeSpot(gx, gy, 0)) continue;
    tufts.push({ x: wx(gx), z: wz(gy), s: 0.7 + r() * 0.6, a: r() * 6 });
  }
  // bus stop at the edge of town + welcome sign
  const bs = T.PROJECT_SPOTS.busTown, bx = wx(bs.x), bz = wz(bs.y) - 1;
  busStop.x = bx; busStop.z = bz;
  W.add(GEO.box(8, 0.35, 3.4), M(bx, 5.2, bz), COL.blue, { ol: 0.09 });
  [-3.6, 3.6].forEach(dx => W.add(GEO.box(0.3, 5, 0.3), M(bx + dx, 2.5, bz + 1.2), INKC, { ol: 0 }));
  W.add(GEO.box(7.6, 3.4, 0.25), M(bx, 3.0, bz - 1.4), '#d6f1ff', { ol: 0.06 });
  W.add(GEO.box(6.4, 0.3, 1.2), M(bx, 1.3, bz - 0.6), COL.wood, { ol: 0.06 });
  sign(W, bx, 6.8, bz + 1.2, '🚌 Bus stop', { th: 1.35 });
  addBoxSolid(bx - 4, bz - 1.8, bx + 4, bz + 0.2);
  sign(W, wx(3760), 4.4, wz(1880), 'Welcome to Small Town!', { post: true, th: 1.8, color: '#fff1a8' });
}

/* ------------------------------------------------------------------ instanced trees, flowers, tufts */
function instanced(builder, list, place, cell = CELL) {
  const { main, line } = builder.geometries();
  const groups = new Map();
  list.forEach(it => { const k = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); });
  const meshes = [];
  const m = new THREE.Matrix4(), c = new THREE.Color();
  groups.forEach(items => {
    const mesh = new THREE.InstancedMesh(main, toonMat, items.length);
    const out = line ? new THREE.InstancedMesh(line, outlineMat, items.length) : null;
    items.forEach((it, i) => {
      place(it, m, c);
      mesh.setMatrixAt(i, m); if (out) out.setMatrixAt(i, m);
      mesh.setColorAt(i, c);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); if (out) { out.computeBoundingSphere(); out.castShadow = false; scene.add(out); }
    scene.add(mesh); meshes.push(mesh);
  });
  return meshes;
}
const TK = {};   // tree, flower and tuft kits, reused by every new district
function buildTrees() {
  const oak = new Builder();
  oak.add(GEO.cyl(0.55, 0.8, 3.4, 7), M(0, 1.7, 0), '#9a6a44', { ol: 0.1, ao: 0.2 });
  oak.add(GEO.ico(2.9, 1), M(0, 5.4, 0), '#8cc45e', { ol: 0.13 });
  oak.add(GEO.ico(2.1, 1), M(1.9, 4.6, 0.6), '#7fbb52', { ol: 0.12 });
  oak.add(GEO.ico(2.0, 1), M(-1.8, 4.7, -0.3), '#94cc66', { ol: 0.12 });
  oak.add(GEO.ico(1.7, 1), M(0.2, 7.2, 0.3), '#9dd46e', { ol: 0.11 });
  const pine = new Builder();
  pine.add(GEO.cyl(0.45, 0.6, 2.4, 6), M(0, 1.2, 0), '#8a5a34', { ol: 0.1 });
  pine.add(GEO.cone(3.0, 3.6, 8), M(0, 3.6, 0), '#5f9e57', { ol: 0.12, ao: 0.15 });
  pine.add(GEO.cone(2.4, 3.2, 8), M(0, 5.6, 0), '#6aab5e', { ol: 0.12, ao: 0.15 });
  pine.add(GEO.cone(1.7, 2.8, 8), M(0, 7.4, 0), '#77b867', { ol: 0.11, ao: 0.1 });
  const stump = new Builder();
  stump.add(GEO.cyl(0.8, 1.0, 1.0, 9), M(0, 0.5, 0), '#9a6a44', { ol: 0.08 });
  stump.add(GEO.disc(0.7, 9), M(0, 1.01, 0), '#f1d3a0', { ol: 0 });
  stump.add(GEO.ring(0.32, 0.4, 9), M(0, 1.02, 0), '#c9a06a', { ol: 0 });
  const sap = new Builder();
  sap.add(GEO.cyl(0.1, 0.14, 1.6, 5), M(0, 0.8, 0), '#8a5a34', { ol: 0.04 });
  sap.add(GEO.ico(0.7, 1), M(0, 1.9, 0), '#9dd46e', { ol: 0.07 });
  sap.add(GEO.sph(0.9, 10, 6, true), M(0, 0.05, 0, 0, 0, 0, 1, 0.35, 1), '#7a4a2a', { ol: 0 });
  const tint = (it, m, c, spread) => {
    m.compose(_p.set(it.x, it.y || 0, it.z), _q.setFromEuler(_e.set(0, it.r * 2.3, 0)), _s.setScalar(it.s));
    const k = 1 + (((it.r * 53) % 17) / 17 - 0.5) * spread; c.setRGB(k, k * 1.02, k * 0.97);
  };
  instanced(oak, trees.oak, (it, m, c) => tint(it, m, c, 0.16));
  instanced(pine, trees.pine, (it, m, c) => tint(it, m, c, 0.14));
  // the Town Forest changes (people chop and replant), so its trees get their own meshes
  const N = T.FOREST.length;
  [['oak', oak], ['pine', pine], ['stump', stump], ['sapling', sap]].forEach(([k, b]) => {
    const { main, line } = b.geometries();
    const mesh = new THREE.InstancedMesh(main, toonMat, N), out = line ? new THREE.InstancedMesh(line, outlineMat, N) : null;
    mesh.count = 0; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    if (out) { out.count = 0; out.frustumCulled = false; scene.add(out); }
    forestMeshes[k] = { mesh, out, tint };
  });
  // flowers: a tiny bloom, colour per instance; no outlines (too small)
  const fl = new Builder();
  fl.add(GEO.cyl(0.05, 0.05, 0.6, 3), M(0, 0.3, 0), '#6fb84a', { ol: 0 });
  fl.add(GEO.ico(0.32, 0), M(0, 0.7, 0), '#ffffff', { ol: 0 });
  fl.add(GEO.ico(0.13, 0), M(0, 0.78, 0.18), COL.yellow, { ol: 0 });
  instanced(fl, flowers, (it, m, c) => { m.makeTranslation(it.x, 0, it.z); c.set(it.c); }, 1000).forEach(m => { m.castShadow = false; });
  Object.assign(TK, { oak, pine, fl, tint });
  const tf = new Builder();
  [[0, 0, 0], [0.3, 0.1, 0.5], [-0.3, -0.1, -0.5]].forEach(([dx, dz, rz]) => tf.add(GEO.cone(0.18, 1.0, 3), M(dx, 0.45, dz, 0, 0, rz), '#98c965', { ol: 0 }));
  instanced(tf, tufts, (it, m, c) => { m.compose(_p.set(it.x, 0, it.z), _q.setFromEuler(_e.set(0, it.a, 0)), _s.setScalar(it.s)); c.setRGB(1, 1, 1); }, 1000).forEach(m => { m.castShadow = false; });
}

const forestMeshes = {};
let forestSig = '';
function updateForest(town, now) {
  const states = T.FOREST.map(t => town ? T.treeState(town, t.id, now) : 'tree');
  const sig = states.join(',');
  if (sig === forestSig || !forestMeshes.oak) return;
  forestSig = sig;
  const n = { oak: 0, pine: 0, stump: 0, sapling: 0 }, m = new THREE.Matrix4(), c = new THREE.Color();
  T.FOREST.forEach((t, i) => {
    const kind = states[i] === 'tree' ? t.kind : states[i], F = forestMeshes[kind];
    F.tint({ x: wx(t.x), z: wz(t.y), s: kind === 'oak' || kind === 'pine' ? 0.9 + ((i * 37) % 10) / 30 : 1, r: i }, m, c, kind === 'oak' ? 0.16 : kind === 'pine' ? 0.14 : 0);
    F.mesh.setMatrixAt(n[kind], m); F.mesh.setColorAt(n[kind], c); if (F.out) F.out.setMatrixAt(n[kind], m);
    n[kind]++;
  });
  Object.entries(forestMeshes).forEach(([k, F]) => {
    F.mesh.count = n[k]; F.mesh.instanceMatrix.needsUpdate = true; if (F.mesh.instanceColor) F.mesh.instanceColor.needsUpdate = true;
    if (F.out) { F.out.count = n[k]; F.out.instanceMatrix.needsUpdate = true; }
  });
}

/* ------------------------------------------------------------------ animated props */
const hallFlag = new THREE.Group();
{
  const fb = new Builder(); fb.add(GEO.box(3.0, 1.8, 0.14), M(1.5, 0, 0), COL.blue, { ol: 0.06 });
  fb.add(GEO.ico(0.35, 0), M(1.4, 0, 0.1), COL.yellow, { ol: 0 });
  hallFlag.add(fb.mesh()); scene.add(hallFlag);
}
const fountainPos = new THREE.Vector3();
const DROPS = 20;
const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: '#d4f6ff' }), DROPS);
scene.add(drops);
const duck = new THREE.Group();
{
  const db = new Builder();
  db.add(GEO.sph(0.9, 10, 8), M(0, 0.55, 0, 0, 0, 0, 1.2, 0.8, 1), '#fff8e8', { ol: 0.07 });
  db.add(GEO.sph(0.55, 10, 8), M(0.8, 1.35, 0), '#fff8e8', { ol: 0.06 });
  db.add(GEO.cone(0.25, 0.5, 6), M(1.35, 1.3, 0, 0, 0, -Math.PI / 2), '#f4b942', { ol: 0.04 });
  db.add(GEO.sph(0.09, 6, 4), M(1.05, 1.5, 0.35), INKC, { ol: 0 });
  db.add(GEO.sph(0.09, 6, 4), M(1.05, 1.5, -0.35), INKC, { ol: 0 });
  duck.add(db.mesh()); scene.add(duck);
}

/* ------------------------------------------------------------------ Squareface */
// every Squareface's arms and legs (ink capsules, like the 2D art) in two draw calls
const LIMBS = {
  arm: { geo: new THREE.CapsuleGeometry(0.3, 0.95, 3, 8), socks: [], mesh: null },
  leg: { geo: new THREE.CapsuleGeometry(0.4, 0.6, 3, 8), socks: [], mesh: null },
};
const limbMat = new THREE.MeshToonMaterial({ color: INKC, gradientMap: ramp });
const LIMB_MAX = 160;
function buildLimbs() {
  Object.values(LIMBS).forEach(L => {
    L.mesh = new THREE.InstancedMesh(L.geo, limbMat, LIMB_MAX);
    L.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    L.mesh.castShadow = true; L.mesh.frustumCulled = false; L.mesh.renderOrder = 2;
    scene.add(L.mesh);
  });
}
function updateLimbs() {
  Object.values(LIMBS).forEach(L => {
    const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const list = L.socks.filter(s => s.parent && shown(s)).slice(0, LIMB_MAX);
    list.forEach((s, i) => L.mesh.setMatrixAt(i, s.matrixWorld));
    L.mesh.count = list.length;
    L.mesh.instanceMatrix.needsUpdate = true;
  });
}

// 1.5x the old 128x104 so the face stays crisp on 2-3x phone screens when the camera is close
const FACE_W = 192, FACE_H = 156, FK = FACE_W / 128;
function drawScreen(ctx, mood, t) {
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  const p = 3 * FK, r = 22 * FK;
  rr(ctx, p, p, FACE_W - 2 * p, FACE_H - 2 * p, r); ctx.fillStyle = '#1f1a2e'; ctx.fill();
  ctx.save(); rr(ctx, p, p, FACE_W - 2 * p, FACE_H - 2 * p, r); ctx.clip();
  drawFace(ctx, mood, t, FACE_W / 2, FACE_H / 2 - 2 * FK, 3.05 * FK);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, 0, FACE_W, 22 * FK);
  ctx.restore();
  rr(ctx, p, p, FACE_W - 2 * p, FACE_H - 2 * p, r); ctx.lineWidth = 6 * FK; ctx.strokeStyle = INKC; ctx.stroke();
}
const ANIMATED_MOODS = new Set(['laugh', 'love', 'think', 'crunch', 'sad', 'silly', 'thirsty']);

const HATS = ['flower', 'beanie', 'propeller', 'chef', 'crown', 'bowl', 'shell', 'party'];   // every kind hat() can draw
const hatOf = (h) => HATS.includes(h) ? h : null;
function hat(B, kind, color) {
  const y = 7.75;
  switch (kind) {
    case 'crown':
      B.add(GEO.cyl(1.7, 1.6, 0.9, 12), M(0, y + 0.4, 0), COL.yellow, { ol: 0.07 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B.add(GEO.cone(0.35, 0.9, 5), M(Math.sin(a) * 1.5, y + 1.25, Math.cos(a) * 1.5), COL.yellow, { ol: 0.05 }); }
      B.add(GEO.ico(0.3, 0), M(0, y + 0.45, 1.68), '#ff8fb1', { ol: 0.03 });
      break;
    case 'beanie':
      B.add(GEO.sph(2.1, 14, 8, true), M(0, y - 0.2, 0, 0, 0, 0, 1.05, 0.8, 1), color, { ol: 0.08 });
      B.add(GEO.cyl(2.2, 2.2, 0.6, 14), M(0, y - 0.05, 0), '#fff8e8', { ol: 0.07 });
      B.add(GEO.ico(0.55, 1), M(0, y + 1.7, 0), '#fff8e8', { ol: 0.05 });
      break;
    case 'chef':
      B.add(GEO.cyl(1.4, 1.4, 1.4, 14), M(0, y + 0.6, 0), '#ffffff', { ol: 0.07 });
      B.add(GEO.ico(1.2, 1), M(-0.7, y + 1.8, 0), '#ffffff', { ol: 0.06 });
      B.add(GEO.ico(1.2, 1), M(0.7, y + 1.8, 0.2), '#ffffff', { ol: 0.06 });
      B.add(GEO.ico(1.1, 1), M(0, y + 2.3, -0.3), '#ffffff', { ol: 0.06 });
      break;
    case 'flower':
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.add(GEO.sph(0.5, 8, 6), M(-1.2 + Math.sin(a) * 0.7, y + 0.35, 0.6 + Math.cos(a) * 0.7, 0, 0, 0, 1, 0.5, 1), '#ff8fb1', { ol: 0.04 }); }
      B.add(GEO.sph(0.42, 8, 6), M(-1.2, y + 0.5, 0.6), COL.yellow, { ol: 0.04 });
      break;
    case 'propeller':
      B.add(GEO.sph(1.9, 14, 8, true), M(0, y - 0.1, 0, 0, 0, 0, 1, 0.6, 1), color, { ol: 0.08 });
      B.add(GEO.cyl(0.1, 0.1, 0.9, 5), M(0, y + 1.3, 0), INKC, { ol: 0 });
      break;
    case 'shell':   // the Udon Snail's golden shell: a spiral of shrinking rings
      B.add(GEO.torus(1.25, 0.5, 18), M(0, y + 0.45, 0), COL.yellow, { ol: 0.07 });
      B.add(GEO.torus(0.78, 0.42, 16), M(0.15, y + 1.2, 0), COL.gold, { ol: 0.06 });
      B.add(GEO.sph(0.45, 10, 8), M(0.3, y + 1.8, 0), COL.yellow, { ol: 0.05 });
      break;
    case 'party':
      B.add(GEO.cone(1.3, 2.6, 14), M(0, y + 1.3, 0), '#b98cff', { ol: 0.07 });
      B.add(GEO.ico(0.45, 1), M(0, y + 2.75, 0), COL.yellow, { ol: 0.05 });
      for (let i = 0; i < 3; i++) B.add(GEO.torus(1.05 - i * 0.33, 0.1, 12), M(0, y + 0.45 + i * 0.75, 0), i % 2 ? '#ff8fb1' : '#ffd23f', { ol: 0 });
      break;
    case 'bowl':
      B.add(GEO.cyl(1.9, 1.2, 1.3, 14), M(0, y + 0.6, 0), '#e4572e', { ol: 0.08 });
      B.add(GEO.cyl(1.95, 1.95, 0.3, 14), M(0, y + 0.95, 0), '#fff8e8', { ol: 0 });
      B.add(GEO.disc(1.8, 14), M(0, y + 1.26, 0), '#f7dc7a', { ol: 0 });
      break;
  }
}

const HEAD_Y = 5.6, HEAD_D = 3.3, HEAD_TILT = 0.17;
function makeSquareface({ color = COL.teal, antenna = COL.roof, hatKind = null, seed = 1 } = {}) {
  const root = new THREE.Group(), upper = new THREE.Group(), mySocks = [];
  root.add(upper);
  // body (hoodie) and head are separate meshes: the head sits in its own group, tipped back a little so the
  // screen face looks up at the camera instead of showing mostly the top of the box (the 2D art is a front view)
  const B = new Builder();
  const pocket = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45);
  B.add(GEO.rbox(3.0, 2.7, 2.4, 0.95, 3), M(0, 2.25, 0), color, { ol: 0.1, ao: 0.12 });
  B.add(GEO.rbox(1.5, 0.75, 0.3, 0.25, 1), M(0, 2.0, 1.12), pocket, { ol: 0 });
  const body = B.mesh();
  upper.add(body);
  const head = new THREE.Group(), hin = new THREE.Group();
  head.position.set(0, HEAD_Y, 0); head.rotation.x = -HEAD_TILT; hin.position.set(0, -HEAD_Y, 0);
  head.add(hin); upper.add(head);
  const H = new Builder();
  // a shallower box than before (3.3 deep, not 4.0), so from above it reads as the 2D square head
  H.add(GEO.rbox(4.8, 4.2, HEAD_D, 0.8, 3), M(0, HEAD_Y, 0), COL.shell, { ol: 0.12, ao: 0.14 });
  H.add(GEO.sph(0.36, 8, 6), M(-2.12, HEAD_Y - 0.6, HEAD_D / 2 - 0.16, 0, 0, 0, 1, 1, 0.5), '#ff9fb0', { ol: 0 });
  H.add(GEO.sph(0.36, 8, 6), M(2.12, HEAD_Y - 0.6, HEAD_D / 2 - 0.16, 0, 0, 0, 1, 1, 0.5), '#ff9fb0', { ol: 0 });
  // the back of the head: a little speaker grill and a power button
  for (let i = 0; i < 3; i++) H.add(GEO.rbox(1.8, 0.22, 0.2, 0.1, 1), M(-0.3, 6.3 - i * 0.55, -HEAD_D / 2 + 0.03), '#cfc6b4', { ol: 0 });
  H.add(GEO.cyl(0.32, 0.32, 0.2, 10), M(1.35, 6.3, -HEAD_D / 2 + 0.03, 0, Math.PI / 2), antenna, { ol: 0.04 });
  // antenna: a gentle curve made of two segments + ball
  H.add(GEO.cyl(0.13, 0.13, 1.1, 5), M(0.7, 8.2, -0.2, 0, 0, -0.2), INKC, { ol: 0 });
  H.add(GEO.cyl(0.13, 0.13, 1.0, 5), M(0.95, 9.1, -0.2, 0, 0, -0.45), INKC, { ol: 0 });
  H.add(GEO.ico(0.52, 1), M(1.25, 9.75, -0.2), antenna, { ol: 0.08 });
  if (hatKind) { H.base = M(0, 0, 0, 0, 0, 0, 1, 1, 0.82); hat(H, hatKind, color); H.base = null; }
  const core = H.mesh();
  hin.add(core);
  // the screen face, drawn by the 2D game's drawFace
  const fc = document.createElement('canvas'); fc.width = FACE_W; fc.height = FACE_H;
  const fctx = fc.getContext('2d');
  const tex = new THREE.CanvasTexture(fc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.66, 3.66 * FACE_H / FACE_W), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, toneMapped: false }));
  screen.position.set(0, HEAD_Y + 0.05, HEAD_D / 2 + 0.035);
  hin.add(screen);
  // arms and legs (ink, like the 2D art)
  // limbs are drawn by two shared InstancedMeshes (see LIMBS); here they are just animated sockets
  const limb = (kind, x, y, dy, parent) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const sock = new THREE.Object3D(); sock.position.y = dy; pivot.add(sock); parent.add(pivot);
    LIMBS[kind].socks.push(sock); mySocks.push([kind, sock]); return pivot;
  };
  const arms = [limb('arm', -1.62, 3.05, -0.75, upper), limb('arm', 1.62, 3.05, -0.75, upper)];
  arms[0].rotation.z = -0.28; arms[1].rotation.z = 0.28;
  const legs = [limb('leg', -0.62, 1.2, -0.55, root), limb('leg', 0.62, 1.2, -0.55, root)];
  let prop = null;
  if (hatKind === 'propeller') {
    const pb = new Builder(); pb.add(GEO.box(3.2, 0.12, 0.55), M(0, 0, 0), '#ff8fb1', { ol: 0.04 }); pb.add(GEO.box(0.55, 0.12, 3.2), M(0, 0, 0), COL.yellow, { ol: 0.04 });
    prop = pb.mesh(); prop.position.set(0, 9.2, 0); hin.add(prop);
  }
  root.traverse(o => { if (o.isMesh && o.material === toonMat) o.castShadow = true; });
  const sf = {
    remove() {
      scene.remove(root);
      mySocks.forEach(([k, sk]) => { const L = LIMBS[k].socks, i = L.indexOf(sk); if (i >= 0) L.splice(i, 1); });
      root.traverse(o => { if (o.geometry && o !== screen) o.geometry.dispose(); });
      screen.geometry.dispose(); screen.material.dispose(); tex.dispose();
    },
    root, upper, head, body, core, screen, arms, legs, prop, fctx, tex, mood: '', walk: 0, speed: 0, yv: 0, y: 0, face: 0, targetFace: 0,
    blinkAt: 1 + (seed % 7) * 0.5, blinkUntil: 0, moodOverride: null, moodUntil: 0,
    setFace(mood, t) {
      if (mood === this.mood && !ANIMATED_MOODS.has(mood)) return;
      this.mood = mood; drawScreen(this.fctx, mood, t); this.tex.needsUpdate = true;
    },
    update(dt, t) {
      // pose
      const moving = this.speed > 0.5;
      this.walk += dt * (moving ? 5 + this.speed * 0.45 : 0);
      const sw = moving ? Math.sin(this.walk * 2) : 0;
      const air = this.y > 0.05;
      this.legs[0].rotation.x = air ? -0.5 : sw * 0.75; this.legs[1].rotation.x = air ? 0.3 : -sw * 0.75;
      this.arms[0].rotation.x = air ? -2.4 : -sw * 0.8; this.arms[1].rotation.x = air ? -2.4 : sw * 0.8;
      const bob = moving && !air ? Math.abs(Math.sin(this.walk * 2)) * 0.32 : Math.sin(t * 2 + seed) * 0.08;
      this.upper.position.y = bob;
      this.upper.rotation.x = moving ? 0.07 : 0;
      this.root.position.y = this.y + (this.ground || 0);
      // turn smoothly
      let d = this.targetFace - this.face; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.face += d * Math.min(1, dt * 12); this.root.rotation.y = this.face;
      if (this.prop) this.prop.rotation.y += dt * (moving ? 16 : 5);
      // face: override > blink > happy
      if (t > this.blinkAt) { this.blinkUntil = t + 0.14; this.blinkAt = t + 2.2 + ((seed * 7 + t) % 3); }
      const mood = t < this.moodUntil ? this.moodOverride : t < this.blinkUntil ? 'blink' : 'happy';
      this.setFace(mood, t);
    },
  };
  sf.setFace('happy', 0);
  scene.add(root);
  return sf;
}

/* ------------------------------------------------------------------ contact shadows + see-through silhouette */
// A soft ink ellipse under every Squareface, like the 2D art. It keeps them grounded when the sun shadow is
// switched off on slow devices, and shrinks while hopping. One draw call for everyone.
const BLOB_MAX = 48;
const blobMat = new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const blobs = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), blobMat, BLOB_MAX);
blobs.frustumCulled = false; blobs.count = 0;
scene.add(blobs);
// ground height under a point (farm soil, lots, plaza and roads are raised a little above the grass)
function groundAt(x, z) {
  const dk = deckAt(x, z); if (dk) return dk.y;
  for (const p of PADS) { const u = (x - p.x) / p.rx, v = (z - p.z) / p.rz; if (u * u + v * v < 1) return p.y; }
  const inside = (gx, gy, gw, gh, pad = 0) => x > wx(gx) + pad && x < wx(gx + gw) - pad && z > wz(gy) + pad && z < wz(gy + gh) - pad;
  const F = T.TOWN_FARM; if (inside(F.x, F.y, F.w, F.h)) return 0.4;
  for (const p of T.PLOTS) if (inside(p.x, p.y, p.w, p.h, 0.3)) return p.kind === 'farm' ? 0.34 : 0.22;
  if (Math.hypot(x - wx(T.PLAZA.x), z - wz(T.PLAZA.y)) < T.PLAZA.r * S + 1.2) return 0.18;
  for (const r of T.ROADS) if (segDist(x / S + OX, z / S + OY, r) < 48) return 0.1;
  return 0;
}
const _bm = new THREE.Matrix4();
function updateBlobs(list) {
  const lite = !sun.castShadow;
  blobMat.opacity = lite ? 0.26 : 0.16;
  list = list.slice(0, BLOB_MAX);
  list.forEach((sf, i) => {
    const p = sf.root.position, k = Math.max(0.45, 1 - sf.y / 12);
    _bm.compose(_p.set(p.x, (sf.ground !== undefined && sf.ground < 0 ? -9 : groundAt(p.x, p.z) + hillH(p.x, p.z)) + 0.03, p.z), _q.identity(), _s.set(2.3 * k, 1, 1.9 * k));
    blobs.setMatrixAt(i, _bm);
  });
  blobs.count = list.length; blobs.instanceMatrix.needsUpdate = true;
}
// When a tree or a roof is between the camera and you, your Squareface still shows through as a soft ink
// silhouette. It is drawn after the world (renderOrder 1) and only where it is hidden (GreaterDepth); the
// real Squareface draws after it (renderOrder 2), so it never covers the visible parts.
function addSeeThrough(sf) {
  const mat = new THREE.MeshBasicMaterial({
    color: '#3a2c4a', opacity: 0.5, transparent: false, depthWrite: false, depthFunc: THREE.GreaterDepth, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  sf.root.traverse(o => { if (o.isMesh) o.renderOrder = 2; });
  [sf.body, sf.core].forEach(m => {
    const g = new THREE.Mesh(m.geometry, mat); g.renderOrder = 1; g.castShadow = g.receiveShadow = false;
    m.parent.add(g);
  });
}

/* ------------------------------------------------------------------ the land: hills you can climb, water you can swim in */
// The same rules move you, balls and falling trees: gravity pulls down, hills slow you going up, water holds you up.
const HILLS = [];    // {x, z, h, s}: smooth round hills, in world units
const WATERS = [];   // {x, z, rx, rz, y?}: lakes, seas and the pool (y = the water surface, 0.07 if not given)
const DECKS = [];    // {x0, z0, x1, z1, y}: planks over the water that you walk on instead of swimming
const PADS = [];     // {x, z, rx, rz, y}: raised ovals you walk over, like the pool's tiled edge
function hillH(x, z) {
  if (!onTrip && !inRegion(x, z)) return wildH(x, z);   // out in the Wild: the planet's own hills
  let h = 0;
  for (const q of HILLS) { const dx = x - q.x, dz = z - q.z, d2 = dx * dx + dz * dz; if (d2 < 9 * q.s * q.s) h += q.h * Math.exp(-d2 / (2 * q.s * q.s)); }
  return h;
}
function deckAt(x, z) { for (const d of DECKS) if (x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1) return d; return null; }
const SEAS = [];     // {x0, x1, z0, z1, y}: the sea along a beach town's south edge, with a wavy shore at z0
// near the town's east and west edges the shore curves away, so the sea ends in sand, not in a straight cut
const shoreZ = (s, x) => { const e = Math.min(x - s.x0, s.x1 - x) / 16, bend = e < 1 ? (1 - Math.max(0, e)) ** 2 * (s.z1 - s.z0 + 3) : 0; return s.z0 + Math.sin(x * 0.21) * 0.9 + Math.sin(x * 0.07 + 1) * 1.3 + bend; };
function waterAt(x, z) {
  if (!onTrip && !inRegion(x, z)) return PL.sample(x, z).ocean ? OCEAN : null;
  for (const w of WATERS) { const u = (x - w.x) / w.rx, v = (z - w.z) / w.rz; if (u * u + v * v < 1) return deckAt(x, z) ? null : w; }
  for (const s of SEAS) if (x > s.x0 && x < s.x1 && z < s.z1 && z > shoreZ(s, x)) return deckAt(x, z) ? null : s;
  return null;
}
const slopeAt = (x, z) => ({ gx: (hillH(x + 0.5, z) - hillH(x - 0.5, z)), gz: (hillH(x, z + 0.5) - hillH(x, z - 0.5)) });
const GRAV = 42;                 // world units / s², the pull that brings every hop back down
let gravity = GRAV;              // one sixth of it on the Moon
const hillGeo = (key, q, size) => prep(key, () => {
  const g = new THREE.PlaneGeometry(size, size, 48, 48).rotateX(-Math.PI / 2), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d2 = x * x + z * z; p.setY(i, q.h * Math.exp(-d2 / (2 * q.s * q.s)) - 0.05); }
  g.computeVertexNormals(); return g;
});

/* ------------------------------------------------------------------ landmark buildings */
function buildLandmark(B, L) {
  const s = LSPEC[L.type] || { d: 12, h: 9 }, f = foot(L), w = L.w * S * (s.wk || 1), cx = f.cx, zc = (f.z0 + f.z1) / 2, zf = f.z1, top = s.h + 0.3;
  const bx0 = cx - w / 2, bx1 = cx + w / 2;   // the same as f.x0 / f.x1 unless the place is narrower than its slot
  let solid = true, door = true, doorColor = COL.woodDark, doorW = 3.6, doorH = 5.4, doorX = cx, signX = cx, signZ = zf + 0.5, bushes = true;
  B.add(GEO.rbox(w + 1.2, 0.5, s.d + 1.2, 0.25, 1), M(cx, 0.25, zc), '#d9cbb0', { ol: 0.08 });
  if (s.body !== false) B.add(GEO.rbox(w, s.h, s.d, 0.45, 2), M(cx, s.h / 2 + 0.3, zc), L.wall, { ol: 0.14, ao: 0.16 });
  const flat = () => { B.add(GEO.rbox(w + 1.2, 1.2, s.d + 1.2, 0.4, 1), M(cx, top, zc), L.roof, { ol: 0.12 }); };
  const rows = (n, m, y0 = 3.8, dy = 3.6) => { for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) { const x = cx - w * 0.38 + c * (w * 0.76 / Math.max(1, m - 1)); if (r === 0 && Math.abs(x - cx) < 3) continue; window3(B, x, y0 + r * dy, zf + 0.26, 2.3, 2.3); } };
  const cols = (n, span, y0, h, z, color = '#ffffff') => { for (let i = 0; i < n; i++) { const x = cx - span / 2 + i * span / (n - 1); if (Math.abs(x - cx) < 2.6) continue; B.add(GEO.cyl(0.6, 0.7, h, 10), M(x, y0 + h / 2, z), color, { ol: 0.09, ao: 0.12 }); } };
  const planks = (color, y0 = 0.6, y1 = s.h) => { for (let x = bx0 + 1.2; x < bx1 - 0.6; x += 1.3) B.add(GEO.box(0.16, y1 - y0, 0.1), M(x, (y0 + y1) / 2 + 0.3, zf + 0.05), color, { ol: 0 }); };
  let signY = Math.min(top - 1.6, 7.6);
  switch (L.type) {
    case 'station':
      flat(); rows(1, 4, 4);
      B.add(GEO.box(w + 6, 0.5, 5), M(cx, 5.8, zf + 2.4), L.roof, { ol: 0.1 });   // the canopy over the doors
      [-1, 1].forEach(sx => B.add(GEO.cyl(0.25, 0.25, 5.6, 6), M(cx + sx * (w / 2 + 2), 2.8, zf + 4.4), INKC, { ol: 0 }));
      B.add(GEO.cyl(1.6, 1.6, 0.4, 20), M(cx, top + 2.2, zf - 1, 0, Math.PI / 2), '#ffffff', { ol: 0.08 });   // clock
      B.add(GEO.box(0.2, 1.1, 0.1), M(cx, top + 2.5, zf - 0.75), INKC, { ol: 0 }); B.add(GEO.box(0.8, 0.2, 0.1), M(cx + 0.3, top + 2.2, zf - 0.75), INKC, { ol: 0 });
      // platform between the station and the railway
      B.add(GEO.box(w + 8, 0.6, 5), M(cx, 0.3, f.z0 - 3), '#d9cbb0', { ol: 0.08 });
      signY = 7.4; break;
    case 'tech':
      flat(); rows(2, 5);
      B.add(GEO.cyl(0.14, 0.14, 4, 5), M(cx + w * 0.3, top + 2.4, zc), INKC, { ol: 0 });
      B.add(GEO.sph(1.4, 12, 6, true), M(cx - w * 0.28, top + 1.2, zc, 0, -0.9, 0), '#ffffff', { ol: 0.06 });
      B.add(GEO.rbox(3.6, 2.2, 0.4, 0.3, 1), M(cx, top + 2, zf - 1), '#1f1a2e', { ol: 0.06 });
      addText(label('</>'), M(cx, top + 2, zf - 0.75), 1.4);
      break;
    case 'biz':
      flat(); rows(4, 4);
      B.add(GEO.box(w * 0.5, 4, s.d * 0.6), M(cx, top + 2.6, zc), L.wall, { ol: 0.1, ao: 0.12 });
      B.add(GEO.cyl(0.12, 0.12, 5, 5), M(cx, top + 7, zc), INKC, { ol: 0 });
      signY = 7.4; break;
    case 'studio':
      flat(); rows(1, 4);
      B.add(GEO.box(7, 3.4, 0.6), M(cx, top + 2.4, zc), '#1f1a2e', { ol: 0.08 });
      for (let i = 0; i < 4; i++) B.add(GEO.box(1, 3.5, 0.65), M(cx - 2.6 + i * 1.75, top + 2.4, zc, 0, 0, 0.5), '#fff8e8', { ol: 0 });
      B.add(GEO.ico(1, 0), M(cx + 5, top + 3, zc), COL.yellow, { ol: 0.06 });
      break;
    case 'dealer':
      flat();
      B.add(GEO.box(w - 3, s.h - 2.2, 0.4), M(cx, s.h / 2 - 0.2, zf + 0.25), '#9ff3ff', { ol: 0.06 });
      carParts(B, cx - 5, 0.4, zf + 4.4, COL.roof, 0.4); carParts(B, cx + 6, 0.4, zf + 4.4, COL.blue, -0.3);
      addBoxSolid(cx - 9, zf + 1.5, cx + 10, zf + 7.5);
      break;
    case 'airport': {
      flat(); rows(1, 5);
      B.add(GEO.cyl(1.6, 2, 12, 12), M(cx + w / 2 + 3, 6, zc), '#fff8e8', { ol: 0.1, ao: 0.1 });
      B.add(GEO.cyl(3, 2.4, 2.6, 12), M(cx + w / 2 + 3, 13.2, zc), '#9ff3ff', { ol: 0.1 });
      B.add(GEO.cone(3.2, 1.6, 12), M(cx + w / 2 + 3, 15.3, zc), L.roof, { ol: 0.08 });
      addCircleSolid(cx + w / 2 + 3, zc, 2.6);
      planeParts(B, cx - w / 2 - 9, 0.3, zc - 2, '#ffffff', Math.PI / 2);
      addBoxSolid(cx - w / 2 - 16, zc - 9, cx - w / 2 - 2, zc + 5);
      break;
    }
    case 'harbor':
      gable(B, cx, zc, w, s.d, top, L.roof, 1, 0.6, L.wall); rows(1, 3);
      for (let i = 0; i < 6; i++) B.add(GEO.cyl(1.2, 1.2, 1.4, 14), M(cx + w / 2 + 3, 1 + i * 2.2, zc - 2), i % 2 ? '#ffffff' : COL.roof, { ol: 0.08 });
      B.add(GEO.ico(1, 1), M(cx + w / 2 + 3, 14.4, zc - 2), '#ffe9a3', { ol: 0.06 });
      addCircleSolid(cx + w / 2 + 3, zc - 2, 1.5);
      break;
    case 'space': {
      flat();
      B.add(GEO.sph(4, 18, 10, true), M(cx - w * 0.2, top + 0.4, zc), '#f7f1e3', { ol: 0.1 });
      const rx = cx + w / 2 + 6, rz = zc;
      B.add(GEO.cyl(3.4, 3.8, 1, 16), M(rx, 0.5, rz), '#9aa3b5', { ol: 0.1 });
      B.add(GEO.cyl(1.6, 1.6, 12, 16), M(rx, 7, rz), '#ffffff', { ol: 0.1, ao: 0.1 });
      B.add(GEO.cone(1.6, 4, 16), M(rx, 15, rz), COL.roof, { ol: 0.1 });
      [0, 2.1, 4.2].forEach(a => B.add(GEO.cone(0.9, 3, 4), M(rx + Math.sin(a) * 1.7, 2.6, rz + Math.cos(a) * 1.7, a), COL.blue, { ol: 0.06 }));
      window3(B, rx, 10, rz + 1.65, 1.4, 1.4);
      addCircleSolid(rx, rz, 3.8);
      break;
    }
    case 'stadium':
      flat();
      for (let i = 0; i < 5; i++) B.add(GEO.cyl(0.2, 0.2, 6, 5), M(cx - w * 0.4 + i * w * 0.2, top + 3, zc), INKC, { ol: 0 });
      for (let i = 0; i < 5; i++) B.add(GEO.box(1.6, 1, 0.6), M(cx - w * 0.4 + i * w * 0.2, top + 6.2, zc), '#ffe9a3', { ol: 0.05 });
      break;
    case 'museum':
      gable(B, cx, zc, w, s.d, top, L.roof, 1, 0.45, L.wall);
      for (let i = 0; i < 6; i++) { const x = cx - w * 0.38 + i * (w * 0.76 / 5); if (Math.abs(x - cx) < 2.5) continue; B.add(GEO.cyl(0.6, 0.7, top - 1, 10), M(x, (top - 1) / 2 + 0.3, zf + 0.9), '#ffffff', { ol: 0.09 }); }
      // a dinosaur skeleton out front
      [[0, 1.6], [1.3, 2], [2.6, 2.3], [3.6, 3.4], [4.2, 4.8], [4.6, 6.2]].forEach(([dx, y]) => B.add(GEO.ico(0.55, 0), M(cx + w / 2 + 2 + dx * 0.6, y, zf + 3), '#fff8e8', { ol: 0.05 }));
      [-1.2, 1.2].forEach(dx => B.add(GEO.cyl(0.2, 0.2, 1.6, 5), M(cx + w / 2 + 3 + dx, 0.8, zf + 3), '#fff8e8', { ol: 0.04 }));
      break;
    case 'zoo':
      flat(); rows(1, 3);
      // a giraffe
      B.add(GEO.rbox(2.6, 2, 1.4, 0.5, 1), M(cx + w / 2 + 4, 3.2, zf + 3), COL.yellow, { ol: 0.08 });
      B.add(GEO.cyl(0.35, 0.45, 4.4, 8), M(cx + w / 2 + 5, 6, zf + 3, 0, 0, -0.25), COL.yellow, { ol: 0.06 });
      B.add(GEO.rbox(1.3, 1, 0.9, 0.3, 1), M(cx + w / 2 + 5.6, 8.2, zf + 3), COL.yellow, { ol: 0.06 });
      [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]].forEach(([dx, dz]) => B.add(GEO.cyl(0.18, 0.18, 2.2, 5), M(cx + w / 2 + 4 + dx, 1.1, zf + 3 + dz), COL.yellow, { ol: 0.04 }));
      addCircleSolid(cx + w / 2 + 4.5, zf + 3, 2);
      break;
    case 'exchange': {
      // a temple of money: steps, columns, a ticker board with the three companies, a low pediment
      B.add(GEO.box(w * 0.7, 0.4, 2.6), M(cx, 0.2, zf + 1.4), '#e9e2d0', { ol: 0.08 });
      cols(6, w * 0.8, 0.3, top - 1.5, zf + 1.1);
      B.add(GEO.box(w * 0.92, 1.4, 1.8), M(cx, top - 0.5, zf + 1.0), '#f3f7fa', { ol: 0.1 });
      B.add(GEO.rbox(w * 0.72, 1.2, 0.3, 0.2, 1), M(cx, top - 0.5, zf + 1.95), '#1f1a2e', { ol: 0.05 });
      B.add(GEO.box(w * 0.69, 0.9, 0.1), M(cx, top - 0.5, zf + 2.1), '#dff7d0', { ol: 0 });
      addText(label('BAKE 21 ▲   TOY 35 ▼   ROCKET 64 ▲'), M(cx, top - 0.48, zf + 2.17), 0.85);
      gable(B, cx, zc, w, s.d, top, L.roof, 1.1, 0.38, L.wall);
      // a gold bull on the steps
      const bx = bx1 + 3.4, bz = zf + 1.2;
      B.add(GEO.rbox(2.6, 1.3, 1.2, 0.45, 1), M(bx, 1.7, bz), COL.gold, { ol: 0.07 });
      B.add(GEO.rbox(1.0, 0.9, 0.9, 0.3, 1), M(bx - 1.5, 2.2, bz), COL.gold, { ol: 0.06 });
      [-0.3, 0.3].forEach(dz => B.add(GEO.cone(0.14, 0.7, 5), M(bx - 1.7, 2.9, bz + dz, 0, 0, 0.5), '#fff8e8', { ol: 0.03 }));
      [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([dx, dz]) => B.add(GEO.cyl(0.18, 0.18, 1.1, 5), M(bx + dx, 0.75, bz + dz), COL.gold, { ol: 0.03 }));
      B.add(GEO.box(3.2, 0.3, 1.8), M(bx, 0.35, bz), '#cfc6d8', { ol: 0.05 });
      addCircleSolid(bx, bz, 1.6);
      doorColor = INKC; signY = 7.2; signZ = zf + 2.0;
      break;
    }
    case 'office': {
      // a tall glass tower: window ribbons all round, a lobby canopy, a crown and a mast
      for (let y = 8.2; y < s.h - 1; y += 2.7) B.add(GEO.box(w + 0.12, 1.4, s.d + 0.12), M(cx, y, zc), '#8fd3ee', { ol: 0 });
      B.add(GEO.box(w * 0.74, 4.6, 0.3), M(cx, 2.8, zf + 0.12), '#bfefff', { ol: 0.05 });
      for (let i = 1; i < 6; i++) B.add(GEO.box(0.18, 4.6, 0.12), M(cx - w * 0.37 + i * w * 0.74 / 6, 2.8, zf + 0.3), INKC, { ol: 0 });
      B.add(GEO.box(w * 0.8, 0.45, 3.2), M(cx, 5.4, zf + 1.6), L.roof, { ol: 0.08 });
      B.add(GEO.rbox(w + 0.8, 1.4, s.d + 0.8, 0.3, 1), M(cx, top + 0.4, zc), L.roof, { ol: 0.12 });
      B.add(GEO.box(w * 0.55, 4, s.d * 0.6), M(cx, top + 3, zc), L.wall, { ol: 0.1, ao: 0.15 });
      B.add(GEO.box(w * 0.55 + 0.1, 1.2, s.d * 0.6 + 0.1), M(cx, top + 3.2, zc), '#8fd3ee', { ol: 0 });
      B.add(GEO.cyl(0.14, 0.22, 7, 6), M(cx + 2, top + 8.5, zc), INKC, { ol: 0 });
      B.add(GEO.ico(0.4, 0), M(cx + 2, top + 12.2, zc), COL.roof, { ol: 0.04 });
      doorColor = '#1f1a2e'; signY = 6.9; signZ = zf + 0.7;
      break;
    }
    case 'gallery': {
      // a white cube with a big framed painting, a skylight and a sculpture on the roof
      B.add(GEO.rbox(w + 0.8, 0.8, s.d + 0.8, 0.3, 1), M(cx, top, zc), '#f3eddd', { ol: 0.1 });
      B.add(GEO.prism(w * 0.45, 1.5, s.d * 0.5), M(cx - 3, top + 0.4, zc), '#bfefff', { ol: 0.08 });
      const px = cx - 8.8, py = 4.1;
      B.add(GEO.box(8.4, 4.0, 0.3), M(px, py, zf + 0.2), '#d6f1ff', { ol: 0 });
      B.add(GEO.sph(2.6, 14, 6, true), M(px - 1.4, py - 2, zf + 0.3, 0, 0, 0, 1, 0.62, 0.2), '#8cc45e', { ol: 0 });
      B.add(GEO.sph(2.2, 14, 6, true), M(px + 1.8, py - 2, zf + 0.32, 0, 0, 0, 1, 0.5, 0.2), '#ff8fb1', { ol: 0 });
      B.add(GEO.ico(0.7, 1), M(px + 2.4, py + 1.1, zf + 0.4), COL.yellow, { ol: 0 });
      [[0, 2.2, 9.2, 0.6], [0, -2.2, 9.2, 0.6], [-4.5, 0, 0.6, 5], [4.5, 0, 0.6, 5]].forEach(([dx, dy, fw, fh]) => B.add(GEO.box(fw, fh, 0.5), M(px + dx, py + dy, zf + 0.35), COL.gold, { ol: 0.05 }));
      const sx = cx + 7, sy = top + 0.4;
      B.add(GEO.box(2.4, 1.2, 2.4), M(sx, sy + 0.6, zc), '#e9e2d0', { ol: 0.06 });
      B.add(GEO.cone(1.1, 2.6, 4), M(sx, sy + 2.5, zc, 0.6), COL.blue, { ol: 0.06 });
      B.add(GEO.ico(0.9, 0), M(sx + 0.3, sy + 4.4, zc), '#ff8fb1', { ol: 0.06 });
      B.add(GEO.box(1.4, 1.4, 1.4), M(sx - 0.2, sy + 5.8, zc, 0.8, 0.6), COL.yellow, { ol: 0.06 });
      window3(B, cx + 8.5, 4.4, zf + 0.26, 3.4, 2.4);
      doorColor = INKC; signY = 7.7;
      break;
    }
    case 'concert': {
      // a hall under a curved roof, tall arched windows, notes floating over it and a red carpet
      B.add(GEO.hcyl(s.d / 2 + 0.7, w + 1.2, 18), M(cx, top - 0.1, zc, 0, 0, Math.PI / 2, 0.62, 1, 1), L.roof, { ol: 0.12, ao: 0.1 });
      B.add(GEO.box(w + 1.2, 0.6, s.d + 1.4), M(cx, top - 0.1, zc), '#f3eddd', { ol: 0.1 });
      [-1, 1].forEach(sd => [5.5, 9.5].forEach(dx => { const x = cx + sd * dx; window3(B, x, 3.8, zf + 0.26, 2.2, 4.2); B.add(GEO.cyl(1.1, 1.1, 0.5, 12, 1), M(x, 5.9, zf + 0.26, 0, Math.PI / 2), COL.glass, { ol: 0.06 }); }));
      [[-3, 5.2, '#ffd23f'], [3.6, 6.4, '#ff8fb1']].forEach(([dx, dy, c]) => {
        const nx = cx + dx, ny = top + dy, nz = zc + 2;
        B.add(GEO.sph(0.8, 12, 8), M(nx, ny, nz, 0, 0, 0.4, 1.2, 0.9, 0.7), c, { ol: 0.06 });
        B.add(GEO.box(0.22, 3, 0.22), M(nx + 0.85, ny + 1.5, nz), c, { ol: 0.04 });
        B.add(GEO.box(1.2, 0.35, 0.2), M(nx + 1.35, ny + 2.8, nz, 0, 0, -0.5), c, { ol: 0.04 });
      });
      B.add(GEO.box(3.4, 0.06, 3.6), M(cx, 0.52, zf + 2.2), '#c0392b', { ol: 0 });
      doorColor = '#9a3b3b'; signY = 7.0;
      break;
    }
    case 'ranch': {
      // a red barn with white trim and a big barn door, a silo beside it
      gable(B, cx, zc, w, s.d, top, '#7d5a44', 0.8, 0.72, L.wall);
      [bx0 + 0.15, bx1 - 0.15].forEach(x => B.add(GEO.box(0.5, s.h, 0.5), M(x, s.h / 2 + 0.3, zf + 0.05), '#fff8e8', { ol: 0.04 }));
      const dw = 7, dh = 5.2;
      B.add(GEO.box(dw, dh, 0.3), M(cx, dh / 2 + 0.3, zf + 0.12), '#9a3b2a', { ol: 0.06 });
      [[0, dh + 0.3, dw + 0.5, 0.4], [-dw / 2, dh / 2 + 0.3, 0.4, dh], [dw / 2, dh / 2 + 0.3, 0.4, dh], [0, dh / 2 + 0.3, 0.3, dh]].forEach(([dx, y, bw, bh]) => B.add(GEO.box(bw, bh, 0.2), M(cx + dx, y, zf + 0.32), '#fff8e8', { ol: 0.03 }));
      [-1, 1].forEach(sd => [-1, 1].forEach(d2 => B.add(GEO.box(0.3, Math.hypot(dw / 2, dh), 0.14), M(cx + sd * dw / 4, dh / 2 + 0.3, zf + 0.36, 0, 0, d2 * Math.atan2(dw / 2, dh)), '#fff8e8', { ol: 0 })));
      B.add(GEO.box(3, 2, 0.3), M(cx, top + 3.4, zf + 0.12), '#fff8e8', { ol: 0.05 });
      B.add(GEO.box(2.4, 1.5, 0.2), M(cx, top + 3.4, zf + 0.25), '#6b3b2a', { ol: 0 });
      const sx = bx1 + 3.6, sz = zc - 1.5;
      B.add(GEO.cyl(2.6, 2.7, 13, 16), M(sx, 6.8, sz), '#dfe6ee', { ol: 0.1, ao: 0.15 });
      [3.5, 7, 10.5].forEach(y => B.add(GEO.cyl(2.72, 2.72, 0.3, 16), M(sx, y, sz), '#9aa3b5', { ol: 0 }));
      B.add(GEO.sph(2.7, 16, 8, true), M(sx, 13.3, sz), '#9aa3b5', { ol: 0.08 });
      addCircleSolid(sx, sz, 2.9);
      door = false; signY = top + 1.4;
      break;
    }
    case 'orchard': {
      // a farmhouse with a porch and a giant apple on the roof
      const rise = gable(B, cx, zc, w, s.d, top, L.roof, 0.9, 0.6, L.wall);
      B.add(GEO.box(w * 0.5, 0.35, 2.6), M(cx, 4.9, zf + 1.3), '#b8693e', { ol: 0.07 });
      [-1, 1].forEach(sd => B.add(GEO.box(0.35, 4.6, 0.35), M(cx + sd * w * 0.23, 2.6, zf + 2.4), COL.wood, { ol: 0.04 }));
      window3(B, cx - w * 0.36, 3.4, zf + 0.26, 2.4, 2.2); window3(B, cx + w * 0.36, 3.4, zf + 0.26, 2.4, 2.2);
      const ax = cx + w * 0.3, ay = top + rise + 1.6, az = zc + 0.5;
      B.add(GEO.sph(2.2, 16, 12), M(ax, ay, az, 0, 0, 0, 1.05, 0.95, 1.05), '#e4572e', { ol: 0.1 });
      B.add(GEO.cyl(0.18, 0.22, 1.2, 6), M(ax, ay + 2.4, az, 0, 0, -0.2), COL.woodDark, { ol: 0.03 });
      B.add(GEO.sph(0.7, 10, 6), M(ax + 0.8, ay + 2.5, az, 0, 0, -0.5, 1.4, 0.35, 0.8), '#6fb84a', { ol: 0.04 });
      B.add(GEO.box(0.4, 1.4, 0.4), M(ax, top + rise + 0.2, az), COL.woodDark, { ol: 0 });
      [[bx0 - 2.3, zf - 1.6], [bx0 - 2.1, zf - 4.4]].forEach(([x, z], i) => { B.add(GEO.box(2.2, 1.2, 1.6), M(x, 0.6, z), COL.wood, { ol: 0.06 }); for (let k = 0; k < 3; k++) B.add(GEO.ico(0.42, 1), M(x - 0.6 + k * 0.6, 1.4, z + (k % 2) * 0.2), i ? '#8cd05a' : '#e4572e', { ol: 0.03 }); addCircleSolid(x, z, 1.2); });
      doorW = 3.2; doorH = 4.4; signY = top + 1.5;
      break;
    }
    case 'mine': {
      // a rocky hillside with a timbered tunnel, rails coming out of it and a cart full of ore
      B.add(GEO.rbox(w, s.h, s.d, 2.2, 2), M(cx, s.h / 2 + 0.1, zc), '#b8aca0', { ol: 0.14, ao: 0.25 });
      [[-0.32, 8.4, 3.4, '#a89c90'], [0.05, 9.2, 4.2, '#c7bcb0'], [0.36, 7.6, 3.2, '#a89c90'], [-0.08, 6, 2.6, '#9a8f86']].forEach(([fx, y, r, c], i) => B.add(GEO.ico(r, 0), M(cx + fx * w, y, zc - 1 + (i % 2), i, 0, 0, 1.3, 0.8, 1), c, { ol: 0.1 }));
      [[-0.4, 9.6], [0.15, 11.4], [0.42, 9.2]].forEach(([fx, y]) => B.add(GEO.ico(1.1, 1), M(cx + fx * w, y, zc), '#8cc45e', { ol: 0.07 }));
      B.add(GEO.box(6.4, 5.6, 0.4), M(cx, 3.1, zf + 0.02), '#1f1a2e', { ol: 0 });
      [-1, 1].forEach(sd => B.add(GEO.box(0.8, 6.2, 0.8), M(cx + sd * 3.6, 3.4, zf + 0.3), COL.woodDark, { ol: 0.06 }));
      B.add(GEO.box(9, 0.9, 1), M(cx, 6.7, zf + 0.3), COL.woodDark, { ol: 0.07 });
      B.add(GEO.ico(0.35, 0), M(cx + 2.6, 5.6, zf + 0.9), '#ffe9a3', { ol: 0.03 });
      [-0.9, 0.9].forEach(dx => B.add(GEO.box(0.2, 0.16, 5.2), M(cx + dx, 0.58, zf + 1.6), '#8a8f99', { ol: 0 }));
      for (let z = zf - 0.6; z < zf + 4; z += 0.9) B.add(GEO.box(2.6, 0.12, 0.45), M(cx, 0.48, z), COL.woodDark, { ol: 0 });
      B.add(GEO.rbox(2.8, 1.4, 2.2, 0.3, 1), M(cx, 1.55, zf - 0.3), '#8a8f99', { ol: 0.07 });
      [[-0.6, '#b98cff'], [0.2, '#9a8f86'], [0.7, COL.yellow]].forEach(([dx, c]) => B.add(GEO.ico(0.5, 0), M(cx + dx, 2.4, zf - 0.3), c, { ol: 0.03 }));
      crystals(B, bx1 + 1.3, zf - 0.9);
      door = false; bushes = false; signY = 8.4;
      break;
    }
    case 'lodge': {
      // a chalet: log walls, a steep snowy roof, a balcony, skis by the door
      for (let y = 1.2; y < s.h; y += 0.95) B.add(GEO.box(w + 0.1, 0.14, 0.1), M(cx, y, zf + 0.05), '#7d4a2e', { ol: 0 });
      gable(B, cx, zc, w, s.d, top, '#fff8e8', 1.4, 0.82, L.wall);
      B.add(GEO.box(w * 0.55, 0.4, 2.2), M(cx, top + 1.2, zf + 1.0), COL.woodDark, { ol: 0.06 });
      B.add(GEO.box(w * 0.55, 0.25, 0.25), M(cx, top + 2.3, zf + 2.0), COL.woodDark, { ol: 0.03 });
      for (let i = 0; i <= 8; i++) B.add(GEO.box(0.18, 1.1, 0.18), M(cx - w * 0.27 + i * w * 0.55 / 8, top + 1.8, zf + 2.0), COL.wood, { ol: 0 });
      window3(B, cx, top + 3.4, zf + 0.26, 2.4, 2.2);
      window3(B, cx - w * 0.33, 3.6, zf + 0.26); window3(B, cx + w * 0.33, 3.6, zf + 0.26);
      [[5.2, '#e4572e', 0.12], [5.9, COL.blue, 0.2]].forEach(([dx, c, a]) => B.add(GEO.box(0.35, 5.2, 0.12), M(cx + dx, 2.9, zf + 0.6, 0, 0, a), c, { ol: 0.03 }));
      B.add(GEO.box(1.6, 5, 1.6), M(cx + w * 0.3, top + 5, zc - 2), '#9aa3b5', { ol: 0.07 });
      signY = 6.6;
      break;
    }
    case 'hotsprings': {
      // a bath house on the left, a steaming pool of warm water on the right
      const hw = w * 0.5, hx = bx0 + hw / 2;
      B.add(GEO.rbox(hw, s.h, s.d, 0.4, 2), M(hx, s.h / 2 + 0.3, zc), L.wall, { ol: 0.12, ao: 0.16 });
      gable(B, hx, zc, hw, s.d, top, '#6b4a2f', 1.5, 0.48, L.wall);
      ['#e4572e', '#fff8e8', '#e4572e'].forEach((c, i) => B.add(GEO.box(1.05, 1.6, 0.12), M(hx - 1.1 + i * 1.1, 4.4, zf + 0.62), c, { ol: 0.02 }));
      const px = bx1 - w * 0.25, pz = zc + 0.4, rx = 5.4, rz = 4.4;
      B.add(GEO.ering(rx, rz, 1.1, 0.8), M(px, 0.3, pz), '#cfc6d8', { ol: 0.08 });
      B.add(GEO.disc(1, 32), M(px, 0.85, pz, 0, 0, 0, rx + 0.1, 1, rz + 0.1), '#8fe0e0', { ol: 0 });
      B.add(GEO.ring(0.6, 0.66, 32), M(px, 0.87, pz, 0, 0, 0, rx, 1, rz), '#d4fbff', { ol: 0 });
      [[-4, -4.4, 1.3], [3.2, -4.8, 1.1], [5.8, -1, 0.9]].forEach(([dx, dz, r]) => B.add(GEO.ico(r, 0), M(px + dx, 1.1, pz + dz), '#a89c90', { ol: 0.06 }));
      [[-1.5, 2.2, 1.1], [1.2, 3.2, 1.3], [-0.2, 4.8, 1.0], [1.8, 6.2, 0.8], [-1.2, 7.2, 0.6]].forEach(([dx, y, r]) => B.add(GEO.ico(r, 1), M(px + dx, y, pz - 0.5), '#ffffff', { ol: 0.04 }));
      doorX = hx; doorW = 3; doorH = 4.4; signX = hx; signY = top + 1.6;
      break;
    }
    case 'icecream': {
      // a little stand with a striped awning and a giant cone on the roof
      B.add(GEO.rbox(w + 0.8, 0.8, s.d + 0.8, 0.3, 1), M(cx, top, zc), L.roof, { ol: 0.1 });
      for (let i = 0; i < 6; i++) B.add(GEO.box((w + 1) / 6, 0.3, 2.4), M(cx - (w + 1) / 2 + (w + 1) / 12 * (2 * i + 1), top - 1.2, zf + 1.1, 0, 0.42), i % 2 ? '#fff8e8' : L.roof, { ol: 0.05 });
      B.add(GEO.box(w * 0.34, 0.4, 1.0), M(cx + w * 0.22, 2.4, zf + 0.5), '#fff8e8', { ol: 0.05 });
      B.add(GEO.box(w * 0.3, 1.6, 0.12), M(cx + w * 0.22, 3.4, zf + 0.08), '#1f1a2e', { ol: 0 });
      const ky = top + 0.4;
      B.add(GEO.cone(2.1, 6, 12), M(cx, ky + 3, zc, 0, Math.PI), '#e9b872', { ol: 0.1 });
      [-0.6, 0.6].forEach(a => B.add(GEO.box(0.14, 5.4, 0.14), M(cx, ky + 3.2, zc + 1.2, 0, 0, a), '#c9904a', { ol: 0 }));
      B.add(GEO.sph(2.3, 14, 10), M(cx, ky + 6.9, zc), '#fff8e8', { ol: 0.09 });
      B.add(GEO.sph(2.0, 14, 10), M(cx, ky + 9.0, zc), '#ff8fb1', { ol: 0.09 });
      B.add(GEO.ico(0.5, 1), M(cx, ky + 11.2, zc), '#e4572e', { ol: 0.05 });
      [[-1.3, 7.5, '#ffd23f'], [1.4, 6.8, '#8fdcf2'], [0.3, 9.6, COL.yellow]].forEach(([dx, y, c]) => B.add(GEO.box(0.18, 0.5, 0.18), M(cx + dx, ky + y, zc + 1.9, 0, 0.3, dx), c, { ol: 0 }));
      umbrella(B, bx1 + 4.6, zc + 0.5, '#8fdcf2', COL.paper);
      B.add(GEO.cyl(1.2, 1.2, 0.2, 14), M(bx1 + 4.6, 2.2, zc + 0.5), '#fff8e8', { ol: 0.05 });
      umbrella(B, bx0 - 4.6, zc + 0.5, '#ff8fb1', COL.paper);
      B.add(GEO.cyl(1.2, 1.2, 0.2, 14), M(bx0 - 4.6, 2.2, zc + 0.5), '#fff8e8', { ol: 0.05 });
      doorX = cx - w * 0.2; doorW = 2.6; doorH = 3.8; signY = top + 1.1; signZ = zf + 2.0;
      break;
    }
    case 'lighthouse': {
      // the keeper's cottage and a tall striped tower with a lamp room
      gable(B, cx, zc, w, s.d, top, L.roof, 0.9, 0.6, L.wall);
      window3(B, cx - w * 0.3, 3.6, zf + 0.26, 2.2, 2.2);
      B.add(GEO.torus(0.9, 0.28, 16), M(cx + w * 0.3, 3.6, zf + 0.4, 0, Math.PI / 2), '#e4572e', { ol: 0.04 });
      const tx = bx1 + 3.2, tz = zc - 0.5, r0 = 3.1, r1 = 2.1, H = 20;
      for (let i = 0; i < 5; i++) { const a = r0 + (r1 - r0) * i / 5, b = r0 + (r1 - r0) * (i + 1) / 5; B.add(GEO.cyl(b, a, H / 5, 16), M(tx, H / 10 + i * H / 5, tz), i % 2 ? '#fff8e8' : '#e4572e', { ol: 0.1 }); }
      window3(B, tx, 9.5, tz + 2.7, 1.2, 1.6); window3(B, tx, 14, tz + 2.45, 1.1, 1.4);
      B.add(GEO.cyl(3, 3, 0.5, 16), M(tx, H + 0.25, tz), INKC, { ol: 0 });
      B.add(GEO.torus(2.8, 0.12, 20), M(tx, H + 1.2, tz), INKC, { ol: 0 });
      B.add(GEO.cyl(1.7, 1.7, 2.4, 12), M(tx, H + 1.7, tz), '#ffe9a3', { ol: 0.07 });
      B.add(GEO.cone(2.2, 2, 12), M(tx, H + 3.9, tz), '#e4572e', { ol: 0.08 });
      B.add(GEO.ico(0.35, 0), M(tx, H + 5.1, tz), INKC, { ol: 0 });
      addCircleSolid(tx, tz, 3.3);
      doorW = 3; doorH = 4.4; signY = top + 1.5;
      break;
    }
    case 'university': {
      // red brick with white trim, a portico and a copper dome
      B.add(GEO.box(w + 0.6, 0.7, s.d + 0.6), M(cx, top - 0.2, zc), '#f7f1e3', { ol: 0.08 });
      B.add(GEO.box(w + 0.12, 0.35, s.d + 0.12), M(cx, 6.1, zc), '#f7f1e3', { ol: 0 });
      rows(2, 5, 3.8, 4.2);
      cols(6, w * 0.44, 0.3, top - 1.6, zf + 1.3, '#f7f1e3');
      B.add(GEO.box(w * 0.5, 1.0, 2.6), M(cx, top - 0.8, zf + 1.3), '#f7f1e3', { ol: 0.08 });
      B.add(GEO.prism(w * 0.5, 2.4, 2.6), M(cx, top - 0.3, zf + 1.3), '#f7f1e3', { ol: 0.08 });
      B.add(GEO.rbox(w + 0.6, 0.7, s.d + 0.6, 0.25, 1), M(cx, top + 0.35, zc), L.roof, { ol: 0.1 });
      B.add(GEO.cyl(4.2, 4.2, 2.4, 20), M(cx, top + 1.9, zc - 1), '#f7f1e3', { ol: 0.1 });
      B.add(GEO.sph(4.3, 20, 10, true), M(cx, top + 3.1, zc - 1), '#8fc2b0', { ol: 0.1 });
      B.add(GEO.cyl(0.8, 0.8, 1.4, 10), M(cx, top + 8, zc - 1), '#f7f1e3', { ol: 0.06 });
      B.add(GEO.cone(0.9, 1.4, 10), M(cx, top + 9.4, zc - 1), COL.gold, { ol: 0.05 });
      doorColor = INKC; signY = 7.9; signZ = zf + 2.2;
      break;
    }
    case 'castle': {
      // stone walls with battlements, two round towers with pointy roofs and flags, a keep behind
      for (let x = bx0 + 0.6; x < bx1; x += 2.4) B.add(GEO.box(1.2, 1.3, 1.2), M(x, top + 0.6, zf - 0.6), L.wall, { ol: 0.06 });
      [[-7, 3.2], [5, 2.4], [9, 6.8], [-10, 7.4], [1, 8.4]].forEach(([dx, y]) => B.add(GEO.box(1.6, 0.8, 0.12), M(cx + dx, y, zf + 0.05), '#bdb2cc', { ol: 0 }));
      [-4, 4].forEach(dx => B.add(GEO.box(0.5, 2.2, 0.12), M(cx + dx, 6.4, zf + 0.06), '#1f1a2e', { ol: 0 }));
      const kw = 10;
      B.add(GEO.box(kw, 8, 7), M(cx, top + 4, zc - 2), L.wall, { ol: 0.1, ao: 0.12 });
      for (let x = cx - kw / 2 + 0.6; x < cx + kw / 2; x += 2.2) B.add(GEO.box(1.1, 1.2, 1.1), M(x, top + 8.6, zc + 1.2), L.wall, { ol: 0.05 });
      window3(B, cx, top + 4.2, zc + 1.55, 1.6, 2.4);
      const flag = (x, y, z, c) => { B.add(GEO.cyl(0.1, 0.1, 3.4, 5), M(x, y + 1.7, z), INKC, { ol: 0 }); B.add(GEO.box(2.2, 1.3, 0.12), M(x + 1.15, y + 2.7, z), c, { ol: 0.04 }); };
      flag(cx, top + 8, zc - 2, COL.yellow);
      [bx0 + 1.4, bx1 - 1.4].forEach((x, i) => {
        const tz = zf - 3.2;
        B.add(GEO.cyl(3, 3.3, 15, 14), M(x, 7.5, tz), L.wall, { ol: 0.12, ao: 0.15 });
        B.add(GEO.cyl(3.4, 3.4, 0.6, 14), M(x, 15, tz), '#bdb2cc', { ol: 0.06 });
        B.add(GEO.cone(3.6, 5.4, 14), M(x, 18, tz), L.roof, { ol: 0.1 });
        window3(B, x, 10, tz + 3.05, 1.2, 1.8);
        flag(x, 20.6, tz, i ? '#e4572e' : '#ff8fb1');
        addCircleSolid(x, tz, 3.4);
      });
      B.add(GEO.cyl(2.3, 2.3, 0.6, 14, 1), M(cx, 5.3, zf + 0.3, 0, Math.PI / 2), COL.woodDark, { ol: 0.07 });
      doorW = 4.6; doorH = 5.4; signY = 8.8;
      break;
    }
    case 'boathouse': {
      // a wooden boathouse by its own little slip of water, with a rowboat
      planks('#8a5a34');
      gable(B, cx, zc, w, s.d, top, L.roof, 1, 0.7, L.wall);
      window3(B, cx - w * 0.3, 4, zf + 0.26, 2.4, 2.2);
      B.add(GEO.torus(0.9, 0.28, 16), M(cx + w * 0.3, 4.2, zf + 0.4, 0, Math.PI / 2), '#e4572e', { ol: 0.04 });
      [-0.6, 0.6].forEach(a => B.add(GEO.box(0.25, 5, 0.15), M(cx + w * 0.3, 4.2, zf + 0.6, 0, 0, a), COL.wood, { ol: 0.02 }));
      const x0 = bx1 + 1.2, x1 = bx1 + 9.4, z0 = f.z0 + 0.5, z1 = zf + 0.5, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      B.add(GEO.box(x1 - x0 + 1.4, 0.5, z1 - z0 + 1.4), M(mx, 0.25, mz), '#c9a06a', { ol: 0.07 });
      B.add(GEO.box(x1 - x0, 0.1, z1 - z0), M(mx, 0.52, mz), '#6fc3e8', { ol: 0 });
      B.add(GEO.ring(0.7, 0.75, 24), M(mx, 0.58, mz, 0, 0, 0, (x1 - x0) / 2, 1, (z1 - z0) / 2), '#bfefff', { ol: 0 });
      rowboat(B, mx, 0.6, mz + 1, Math.PI / 2, '#e4572e');
      [[x0 - 0.4, z1 + 0.4], [x1 + 0.4, z1 + 0.4], [x1 + 0.4, z0 - 0.4]].forEach(([x, z]) => B.add(GEO.cyl(0.3, 0.3, 1.6, 6), M(x, 0.8, z), COL.woodDark, { ol: 0.04 }));
      addBoxSolid(x0 - 0.7, z0 - 0.7, x1 + 0.7, z1 + 0.7);
      signY = top + 1.7;
      break;
    }
    case 'sawmill': {
      // a plank shed with log piles on one side and a big round saw on the other
      planks('#a0673b');
      gable(B, cx, zc, w, s.d, top, L.roof, 1, 0.55, L.wall);
      window3(B, cx - w * 0.32, 4, zf + 0.26, 2.4, 2.2); window3(B, cx + w * 0.32, 4, zf + 0.26, 2.4, 2.2);
      const lx = bx0 - 2.6;
      [[0, 0.6], [1.2, 0.6], [-1.2, 0.6], [0.6, 1.65], [-0.6, 1.65], [0, 2.7]].forEach(([dx, y]) => { B.add(GEO.cyl(0.6, 0.6, 7, 9), M(lx + dx, y, zc, 0, Math.PI / 2), '#b07a4a', { ol: 0.05 }); B.add(GEO.disc(0.5, 9), M(lx + dx, y, zc + 3.51, 0, -Math.PI / 2), '#f1d3a0', { ol: 0 }); });
      addBoxSolid(lx - 2, zc - 3.6, lx + 2, zc + 3.6);
      const sx = bx1 + 3.2;
      B.add(GEO.box(3.4, 1.8, 6), M(sx, 0.9, zc), COL.woodDark, { ol: 0.07 });
      B.add(GEO.cyl(2.3, 2.3, 0.18, 22), M(sx, 2.2, zc - 0.4, 0, 0, Math.PI / 2), '#cfd8e3', { ol: 0.05 });
      B.add(GEO.cyl(0.4, 0.4, 0.3, 8), M(sx, 2.2, zc - 0.4, 0, 0, Math.PI / 2), INKC, { ol: 0 });
      B.add(GEO.cyl(0.75, 0.75, 5.2, 9), M(sx - 1, 2.55, zc + 0.2, 0, Math.PI / 2), '#b07a4a', { ol: 0.05 });
      B.add(GEO.sph(1.2, 10, 6, true), M(sx + 1.6, 0, zc + 3.6, 0, 0, 0, 1, 0.5, 1), '#f1d3a0', { ol: 0.04 });
      addBoxSolid(sx - 1.9, zc - 3.2, sx + 1.9, zc + 3.2);
      bushes = false; signY = top + 1.4;
      break;
    }
    case 'treehouse': {
      // a little house on a deck in a giant tree, a ladder and a swing
      const tx = cx + 2, tz = zc;
      B.add(GEO.cyl(1.8, 2.6, 16, 10), M(tx, 8, tz), '#8a5a34', { ol: 0.12, ao: 0.2 });
      [0, 2.1, 4.2].forEach(a => B.add(GEO.cone(1, 2.4, 5), M(tx + Math.sin(a) * 2.2, 0.6, tz + Math.cos(a) * 2.2, a, 0.9), '#8a5a34', { ol: 0.05 }));
      B.add(GEO.cyl(6.4, 6.4, 0.6, 16), M(tx, 9, tz), COL.wood, { ol: 0.08 });
      for (let i = 0; i < 9; i++) { const a = -0.2 + i * 0.4; B.add(GEO.box(0.2, 1.3, 0.2), M(tx + Math.cos(a) * 6.1, 9.9, tz + Math.sin(a) * 6.1), COL.woodDark, { ol: 0 }); }
      B.add(GEO.rbox(8, 4.6, 6.4, 0.3, 1), M(tx, 11.6, tz - 0.6), L.wall, { ol: 0.1, ao: 0.1 });
      gable(B, tx, tz - 0.6, 8, 6.4, 13.9, L.roof, 0.8, 0.6, L.wall);
      window3(B, tx - 2, 11.8, tz + 2.86, 1.8, 1.8);
      B.add(GEO.rbox(1.8, 3, 0.4, 0.2, 1), M(tx + 1.8, 11, tz + 2.75), COL.woodDark, { ol: 0.05 });
      [[0, 21, -0.5, 6.2, '#6fb84a'], [-5, 18.5, 1, 4.4, '#7fbb52'], [5.4, 18.8, 0.2, 4.6, '#8cc45e'], [0.5, 25, 0.2, 3.6, '#94cc66'], [-2, 16.6, 3, 3.2, '#8cc45e']].forEach(([dx, y, dz, r, c]) => B.add(GEO.ico(r, 1), M(tx + dx, y, tz + dz), c, { ol: 0.12 }));
      const lx = tx - 6.8, lz = tz + 1;
      [-0.6, 0.6].forEach(dz => B.add(GEO.box(0.25, 9.4, 0.25), M(lx, 4.7, lz + dz), COL.woodDark, { ol: 0.03 }));
      for (let y = 1; y < 9; y += 1.1) B.add(GEO.box(0.2, 0.18, 1.4), M(lx, y, lz), COL.wood, { ol: 0 });
      addCircleSolid(lx, lz, 0.9);
      const wx0 = tx + 4.4, wz0 = tz + 3.4;
      [-0.9, 0.9].forEach(dx => B.add(GEO.cyl(0.05, 0.05, 6.8, 4), M(wx0 + dx, 5.1, wz0), '#e0c070', { ol: 0 }));
      B.add(GEO.box(2.3, 0.25, 0.9), M(wx0, 1.7, wz0), '#e4572e', { ol: 0.04 });
      addCircleSolid(tx, tz, 2.8);
      solid = false; door = false; bushes = false; signX = tx; signY = 5; signZ = tz + 2.9;
      break;
    }
    case 'observatory': {
      // a round drum with a big dome, a slit and a telescope peeking out at the sky
      flat(); rows(1, 4, 3.4);
      [[-9, 4.8], [9.5, 4.3], [-5, 5.6]].forEach(([dx, y]) => B.add(GEO.star(0.55, 0.24, 0.16), M(cx + dx, y, zf + 0.35), COL.yellow, { ol: 0.03 }));
      const dy = top + 0.6, R = 5.4;
      B.add(GEO.cyl(R, R, 3, 24), M(cx, dy + 1.5, zc), '#f7f1e3', { ol: 0.1 });
      B.add(GEO.sph(R + 0.1, 22, 12, true), M(cx, dy + 3, zc), '#cfd8e3', { ol: 0.12 });
      const th = 0.62;
      B.add(GEO.box(1.6, 0.3, 4.4), M(cx, dy + 3 + (R + 0.12) * Math.cos(th), zc + (R + 0.12) * Math.sin(th), 0, th), '#1f1a2e', { ol: 0 });
      const tl = 0.55, td = R + 1;
      B.add(GEO.cyl(0.62, 0.85, 4.6, 12), M(cx, dy + 3 + td * Math.cos(tl), zc + td * Math.sin(tl), 0, tl), COL.blue, { ol: 0.06 });
      B.add(GEO.cyl(0.7, 0.7, 0.4, 12), M(cx, dy + 3 + (td + 2.3) * Math.cos(tl), zc + (td + 2.3) * Math.sin(tl), 0, tl), COL.yellow, { ol: 0.04 });
      signY = top + 1.5; signZ = zf + 0.9;
      break;
    }
    case 'mart': {
      // a small market stall: back wall, a counter full of crates, a striped awning
      B.add(GEO.box(w, 5.6, 0.6), M(cx, 3.1, f.z0 + 0.4), L.wall, { ol: 0.1, ao: 0.15 });
      [[bx0 + 0.4, f.z0 + 0.4], [bx1 - 0.4, f.z0 + 0.4], [bx0 + 0.4, zf - 0.6], [bx1 - 0.4, zf - 0.6]].forEach(([x, z]) => B.add(GEO.cyl(0.25, 0.25, 5.4, 6), M(x, 3, z), COL.woodDark, { ol: 0.03 }));
      const n = 6, sw = (w + 1) / n;
      for (let i = 0; i < n; i++) {
        const x = cx - (w + 1) / 2 + sw * (i + 0.5);
        B.add(GEO.box(sw, 0.3, s.d + 1.6), M(x, 6.0, zc + 0.5, 0, 0.16), i % 2 ? '#fff8e8' : L.roof, { ol: 0.06 });
        B.add(GEO.cyl(sw / 2, sw / 2, 0.3, 10, 1), M(x, 4.9, zf + 1.2, 0, Math.PI / 2), i % 2 ? '#fff8e8' : L.roof, { ol: 0.05 });
      }
      B.add(GEO.box(w - 1.2, 1.6, 2), M(cx, 1.1, zf - 1.2), COL.wood, { ol: 0.08, ao: 0.15 });
      B.add(GEO.box(w - 0.8, 0.25, 2.3), M(cx, 2.0, zf - 1.2), '#e0b27f', { ol: 0.05 });
      [['#e4572e', -5.4], ['#f08a3c', -1.8], [COL.yellow, 1.8], ['#8cd05a', 5.4]].forEach(([c, dx]) => {
        B.add(GEO.box(2.8, 0.9, 1.7), M(cx + dx, 2.55, zf - 1.3), '#c98a52', { ol: 0.05 });
        for (let k = 0; k < 3; k++) B.add(GEO.ico(0.46, 1), M(cx + dx - 0.8 + k * 0.8, 3.1, zf - 1.3 + (k % 2) * 0.3), c, { ol: 0.03 });
      });
      door = false; signY = 8.3; signZ = zc;
      [-4, 4].forEach(dx => B.add(GEO.box(0.2, 1.8, 0.2), M(cx + dx, 6.9, zc), COL.woodDark, { ol: 0 }));
      break;
    }
    case 'cafe': case 'arcade': default:
      flat(); rows(2, 4);
      for (let i = 0; i < 7; i++) B.add(GEO.box((w + 1) / 7, 0.3, 2.6), M(cx - (w + 1) / 2 + (w + 1) / 14 * (2 * i + 1), 5.6, zf + 1.1, 0, 0.4), i % 2 ? '#fff8e8' : L.roof, { ol: 0.06 });
      if (L.type === 'hotel') { rows(4, 5, 3.8, 3.4); }
      break;
  }
  if (solid) addBoxSolid(bx0 - 0.4, f.z0 - 0.4, bx1 + 0.4, f.z1 + 0.3);
  if (door) door3(B, doorX, zf + 0.3, doorColor, doorW, doorH);
  sign(B, signX, signY, signZ, `${L.icon} ${L.name}`, { th: 1.7 });
  if (bushes) [[-1, 0], [1, 0]].forEach(([sx]) => { const x = sx < 0 ? bx0 - 0.2 : bx1 + 0.2; B.add(GEO.ico(1.5, 1), M(x, 1.1, zf + 0.6), '#7fbf55', { ol: 0.09 }); });
}
function carParts(B, x, y, z, color, ry = 0) {
  const r = new THREE.Matrix4().makeRotationY(ry), at = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyMatrix4(r).add(new THREE.Vector3(x, y, z));
  let p = at(0, 1.3, 0); B.add(GEO.rbox(4.6, 1.8, 7.4, 0.8, 2), M(p.x, p.y, p.z, ry), color, { ol: 0.1, ao: 0.12 });
  p = at(0, 2.6, -0.6); B.add(GEO.rbox(3.8, 1.2, 3.4, 0.5, 1), M(p.x, p.y, p.z, ry), '#9ff3ff', { ol: 0.08 });
  [[-2.2, 2.3], [2.2, 2.3], [-2.2, -2.3], [2.2, -2.3]].forEach(([dx, dz]) => { p = at(dx, 0.8, dz); B.add(GEO.cyl(0.9, 0.9, 0.7, 12), M(p.x, p.y, p.z, ry, 0, Math.PI / 2), INKC, { ol: 0 }); });
  p = at(0, 1.4, 3.75); B.add(GEO.box(3, 0.5, 0.2), M(p.x, p.y, p.z, ry), '#ffe9a3', { ol: 0 });
}
function planeParts(B, x, y, z, color, ry = 0) {
  const r = new THREE.Matrix4().makeRotationY(ry), at = (dx, dy, dz) => new THREE.Vector3(dx, dy, dz).applyMatrix4(r).add(new THREE.Vector3(x, y, z));
  let p = at(0, 2.2, 0); B.add(GEO.capsule(1.4, 9), M(p.x, p.y, p.z, ry, Math.PI / 2), color, { ol: 0.1, ao: 0.1 });
  p = at(0, 2.1, 0.5); B.add(GEO.rbox(15, 0.35, 2.6, 0.15, 1), M(p.x, p.y, p.z, ry), color, { ol: 0.08 });
  p = at(0, 3.6, -5); B.add(GEO.rbox(0.35, 2.6, 1.8, 0.15, 1), M(p.x, p.y, p.z, ry), COL.roof, { ol: 0.06 });
  p = at(0, 2.4, -5.1); B.add(GEO.rbox(5, 0.3, 1.4, 0.12, 1), M(p.x, p.y, p.z, ry), color, { ol: 0.06 });
  p = at(0, 2.6, 4); B.add(GEO.rbox(1.8, 0.8, 1.2, 0.3, 1), M(p.x, p.y, p.z, ry), '#9ff3ff', { ol: 0.05 });
  [[-2.4, 0.6], [2.4, 0.6], [0, 4.4]].forEach(([dx, dz]) => { p = at(dx, 0.5, dz); B.add(GEO.cyl(0.45, 0.45, 0.4, 10), M(p.x, p.y, p.z, ry, 0, Math.PI / 2), INKC, { ol: 0 }); });
}

/* ------------------------------------------------------------------ the railway */
function buildRail(B, gx0, gx1) {
  const z = wz(T.RAIL_Y), x0 = wx(gx0), x1 = wx(gx1), len = x1 - x0, cx = (x0 + x1) / 2;
  B.add(GEO.box(len, 0.22, 4.4), M(cx, 0.11, z), '#cfc6b4', { ol: 0 });
  for (let x = x0 + 1; x < x1; x += 2.2) B.add(GEO.box(0.6, 0.2, 4), M(x, 0.28, z), COL.woodDark, { ol: 0 });
  [-0.9, 0.9].forEach(dz => B.add(GEO.box(len, 0.3, 0.3), M(cx, 0.45, z + dz), '#8a8f99', { ol: 0 }));
}

/* ------------------------------------------------------------------ nature: lakes, hills, beaches, star hills, groves, meadows */
function campfire(B, x, z) {
  for (let i = 0; i < 4; i++) B.add(GEO.cyl(0.25, 0.25, 2.2, 6), M(x, 0.3, z, i * 0.8, 0, Math.PI / 2), COL.woodDark, { ol: 0.04 });
  B.add(GEO.cone(0.8, 1.8, 6), M(x, 1.1, z), '#ff9f43', { ol: 0.04 }); B.add(GEO.cone(0.45, 1.2, 6), M(x, 1.2, z), COL.yellow, { ol: 0 });
  [[-2.4, 0], [2.4, 0.4]].forEach(([dx, dz]) => { B.add(GEO.cyl(0.6, 0.6, 1, 8), M(x + dx, 0.5, z + dz), COL.wood, { ol: 0.05 }); addCircleSolid(x + dx, z + dz, 0.7); });
}
function tripod(B, x, z) {
  [0, 2.1, 4.2].forEach(a => B.add(GEO.cyl(0.08, 0.1, 3, 4), M(x + Math.sin(a) * 0.5, 1.4, z + Math.cos(a) * 0.5, a, -0.2), INKC, { ol: 0 }));   // feet out
  B.add(GEO.rbox(1.4, 0.9, 0.8, 0.2, 1), M(x, 3, z), '#1f1a2e', { ol: 0.05 }); B.add(GEO.cyl(0.3, 0.3, 0.5, 10), M(x, 3, z + 0.55, 0, Math.PI / 2), '#8fdcf2', { ol: 0 });
  addCircleSolid(x, z, 0.6);
}
function crystals(B, x, z, y = 0) {
  [[0, 0, 1.6], [0.9, 0.4, 1.1], [-0.8, 0.3, 1]].forEach(([dx, dz, h]) => B.add(GEO.cone(0.5, h * 1.6, 5), M(x + dx, y + h * 0.8, z + dz, dx, 0, dx * 0.2), '#b98cff', { ol: 0.05 }));
  B.add(GEO.ico(1.1, 0), M(x - 0.3, y + 0.4, z - 0.7), '#cfc6d8', { ol: 0.06 });
}
function palm(B, x, z, y = 0) { palmParts(B, x, z, y); addCircleSolid(x, z, 0.7); }
function palmParts(B, x, z, y = 0) {
  for (let i = 0; i < 5; i++) B.add(GEO.cyl(0.35, 0.42, 1.3, 7), M(x + i * 0.18, y + 0.65 + i * 1.25, z, 0, 0, -0.08), '#b07a4a', { ol: 0.05 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; B.add(GEO.box(0.5, 0.18, 3.6), M(x + 0.9 + Math.sin(a) * 1.6, y + 6.6, z + Math.cos(a) * 1.6, a, -0.35), '#6fb84a', { ol: 0.04 }); }
  B.add(GEO.ico(0.35, 0), M(x + 0.9, y + 6.2, z + 0.3), '#8a5a34', { ol: 0 });
}
function berryBush(B, x, z) { B.add(GEO.ico(1.4, 1), M(x, 1, z), '#6fb84a', { ol: 0.08 }); for (let i = 0; i < 6; i++) B.add(GEO.ico(0.25, 0), M(x + Math.cos(i) * 1.1, 1 + (i % 3) * 0.4, z + Math.sin(i) * 1.1), '#5b7cfa', { ol: 0 }); addCircleSolid(x, z, 1.2); }
function buildNature(B, D, trees) {
  const cx = wx(D.nat.x), cz = wz(D.nat.y), sp = (i) => D.spots[i] && { x: wx(D.spots[i].x), z: wz(D.spots[i].y) };
  const around = (n, r0, r1, kinds) => { const r = rng(D.k * 131 + 7); for (let i = 0; i < n; i++) { const a = r() * 6.283, d = r0 + r() * (r1 - r0); trees.push({ kind: kinds[i % kinds.length], x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d * 1.3, s: 0.8 + r() * 0.5, r: i + D.k * 50 }); } };
  switch (D.nature) {
    case 'lake': {
      WATERS.push({ x: cx, z: cz, rx: 24, rz: 16 });
      B.add(GEO.disc(1, 40), M(cx, 0.04, cz, 0, 0, 0, 27, 1, 19), '#e9d9b0', { ol: 0 });
      B.add(GEO.disc(1, 40), M(cx, 0.07, cz, 0, 0, 0, 24, 1, 16), '#7fd0ea', { ol: 0 });
      B.add(GEO.ring(0.7, 0.74, 40), M(cx, 0.09, cz, 0, 0, 0, 24, 1, 16), '#bfefff', { ol: 0 });
      for (let i = 0; i < 6; i++) B.add(GEO.disc(0.9, 10), M(cx - 10 + i * 3.5, 0.1, cz - 4 + (i % 3) * 3), '#8cc45e', { ol: 0 });
      [0, 1].forEach(i => { const s = sp(i); if (!s) return; const dx = s.x > cx ? -1 : 1; B.add(GEO.box(6, 0.35, 2.4), M(s.x + dx * 3, 0.5, s.z - dx * 0.5, dx < 0 ? -0.5 : 0.5), COL.wood, { ol: 0.06 }); });
      const ph = sp(2); if (ph) tripod(B, ph.x + 2, ph.z);
      const cp = sp(3); if (cp) campfire(B, cp.x + 1, cp.z - 2);
      around(18, 34, 44, ['oak', 'pine']);
      break;
    }
    case 'hills': case 'stars': {
      const q = { x: cx, z: cz, h: D.nature === 'hills' ? 11 : 9, s: 13 };
      HILLS.push(q);
      B.add(hillGeo('hill' + D.k, q, 84), M(cx, 0, cz), D.nature === 'hills' ? '#a8d46c' : '#9ccb78', { ol: 0, ao: 0.25 });
      const top = hillH(cx, cz);
      if (D.nature === 'hills') {
        B.add(GEO.cyl(0.12, 0.12, 4, 5), M(cx, top + 2, cz - 1), INKC, { ol: 0 }); B.add(GEO.box(2.4, 1.4, 0.12), M(cx + 1.2, top + 3.4, cz - 1), COL.roof, { ol: 0.04 });
        bench(B, cx + 2.5, cz + 1.5, 0);
      } else {
        B.add(GEO.cyl(3.4, 3.6, 3, 16), M(cx - 4, hillH(cx - 4, cz - 3) + 1.4, cz - 3), '#f7f1e3', { ol: 0.1 });
        B.add(GEO.sph(3.4, 16, 8, true), M(cx - 4, hillH(cx - 4, cz - 3) + 2.9, cz - 3), '#cfd8e3', { ol: 0.1 });
        const s = sp(0); if (s) { B.add(GEO.cyl(0.1, 0.1, 2.4, 4), M(s.x, hillH(s.x, s.z) + 1.2, s.z), INKC, { ol: 0 }); B.add(GEO.cyl(0.35, 0.5, 2.4, 10), M(s.x, hillH(s.x, s.z) + 2.6, s.z, 0, 0.8), '#5b7cfa', { ol: 0.05 }); }
      }
      D.spots.forEach((p, i) => { if (p.type === 'gem') crystals(B, wx(p.x) + 1.6, wz(p.y) - 1, hillH(wx(p.x), wz(p.y))); if (p.type === 'photo') tripod(B, wx(p.x) + 2, wz(p.y)); if (p.type === 'camp') campfire(B, wx(p.x) + 1, wz(p.y) - 2); });
      around(14, 40, 46, ['pine', 'oak']);
      break;
    }
    case 'beach': {
      WATERS.push({ x: cx, z: cz - 22, rx: 44, rz: 16 });
      B.add(GEO.disc(1, 40), M(cx, 0.04, cz - 2, 0, 0, 0, 46, 1, 34), '#f4e3b5', { ol: 0 });
      B.add(GEO.disc(1, 40), M(cx, 0.07, cz - 22, 0, 0, 0, 44, 1, 16), '#6fc3e8', { ol: 0 });
      B.add(GEO.ring(0.92, 0.96, 40), M(cx, 0.09, cz - 22, 0, 0, 0, 44, 1, 16), '#ffffff', { ol: 0 });
      [[-28, 8], [-18, 18], [22, 12], [32, 2], [8, 22]].forEach(([dx, dz]) => palm(B, cx + dx, cz + dz));
      D.spots.forEach(p => { const x = wx(p.x), z = wz(p.y); if (p.type === 'shell') for (let i = 0; i < 4; i++) B.add(GEO.sph(0.35, 8, 5, true), M(x + (i - 1.5) * 0.9, 0.08, z + (i % 2) * 0.8), ['#ffd9e0', '#fff8e8', '#ffe2c6'][i % 3], { ol: 0.03 }); if (p.type === 'photo') tripod(B, x + 2, z); if (p.type === 'swim') { B.add(GEO.sph(0.9, 10, 8), M(x, 0.5, z - 6), COL.roof, { ol: 0.05 }); } });
      // an umbrella and towels
      B.add(GEO.cyl(0.1, 0.1, 4, 5), M(cx + 12, 2, cz + 4), INKC, { ol: 0 }); B.add(GEO.cone(3.2, 1.4, 10), M(cx + 12, 4.4, cz + 4), '#ff8fb1', { ol: 0.06 });
      B.add(GEO.box(2, 0.05, 3.6), M(cx + 9, 0.08, cz + 5), '#8fdcf2', { ol: 0 });
      break;
    }
    case 'grove': {
      for (let i = 0; i < 7; i++) { const r = rng(D.k * 17 + i), x = cx - 20 + r() * 40, z = cz - 20 + r() * 40; B.add(GEO.cyl(0.6, 0.8, 3, 8), M(x, 1.5, z), '#fff3d6', { ol: 0.06 }); B.add(GEO.sph(2.4, 12, 8, true), M(x, 2.8, z, 0, 0, 0, 1, 0.7, 1), '#e4572e', { ol: 0.08 }); addCircleSolid(x, z, 0.9); }
      D.spots.forEach(p => { const x = wx(p.x), z = wz(p.y); if (p.type === 'berry') berryBush(B, x + 2.4, z); if (p.type === 'photo') tripod(B, x + 2, z); if (p.type === 'camp') campfire(B, x + 1, z - 2); });
      around(26, 26, 44, ['oak', 'pine']);
      break;
    }
    case 'canyon': {
      // a red rise with a lookout on top, flat-topped mesas, a rock arch, crystals, a telescope and a camera
      const q = { x: cx, z: cz + 4, h: 6.5, s: 7.5 };
      HILLS.push(q);
      terrain(B, 'canyon' + D.k, [q], 0.9, paintCanyon);
      const v = sp(0) || { x: q.x, z: q.z }, vy = hillH(v.x, v.z);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + 0.55 + i * (2 * Math.PI - 1.1) / 8, px = v.x + Math.cos(a) * 4.2, pz = v.z + Math.sin(a) * 4.2, py = hillH(px, pz);
        B.add(GEO.box(0.3, 1.8, 0.3), M(px, py + 0.8, pz), COL.woodDark, { ol: 0.03 });
        if (i < 8) { const b = a + (2 * Math.PI - 1.1) / 8, qx = v.x + Math.cos(b) * 4.2, qz = v.z + Math.sin(b) * 4.2, len = Math.hypot(qx - px, qz - pz); B.add(GEO.box(len, 0.22, 0.2), M((px + qx) / 2, (py + hillH(qx, qz)) / 2 + 1.55, (pz + qz) / 2, -Math.atan2(qz - pz, qx - px)), COL.wood, { ol: 0.02 }); }
      }
      const bx = v.x + 1.8, bz = v.z - 2.2, by = hillH(bx, bz);
      B.add(GEO.cyl(0.18, 0.22, 2.4, 6), M(bx, by + 1.2, bz), INKC, { ol: 0 });
      B.add(GEO.rbox(1.4, 0.8, 1.1, 0.25, 1), M(bx, by + 2.7, bz), COL.teal, { ol: 0.05 });
      [-0.35, 0.35].forEach(dx => B.add(GEO.cyl(0.26, 0.26, 0.6, 10), M(bx + dx, by + 2.8, bz + 0.7, 0, Math.PI / 2), INKC, { ol: 0 }));
      addCircleSolid(bx, bz, 0.5);
      const MESAS = [[-8, -27, 7, 11], [23, -19, 6, 9], [39, 3, 5, 7.5], [-41, 3, 5, 8.5], [-31, 38, 4, 5.5]];
      MESAS.forEach(([dx, dz, r, h], i) => mesa(B, cx + dx, cz + dz, r, h, i + D.k));
      redArch(B, cx + 14, cz - 38, 0.2);
      D.spots.forEach(p => { const x = wx(p.x), z = wz(p.y), y = hillH(x, z); if (p.type === 'gem') { crystals(B, x + 1.6, z - 1, y); redRock(B, x + 4, z - 2.5, 1.2, 1); redRock(B, x - 2.6, z - 3, 0.9, 2); } if (p.type === 'photo') tripod(B, x + 2, z); if (p.type === 'stars') telescope(B, x + 3, z, y); });
      const r = rng(D.k * 131 + 7), clear = (x, z) => MESAS.every(([dx, dz, rr]) => Math.hypot(x - cx - dx, z - cz - dz) > rr + 2.5) && D.spots.every(p => Math.hypot(x - wx(p.x), z - wz(p.y)) > 5.5) && Math.hypot(x - q.x, z - q.z) > 12 && Math.hypot(x - cx + 6, z - cz - 30) > 8;
      for (let i = 0, n = 0; i < 80 && n < 16; i++) { const a = r() * 6.283, d = 18 + r() * 28, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 1.2; if (!clear(x, z)) continue; n++; trees.push({ kind: 'cactus', x, z, s: 0.8 + r() * 0.5, r: i + D.k * 50 }); }
      for (let i = 0; i < 10; i++) { const a = r() * 6.283, d = 14 + r() * 30, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 1.2; if (clear(x, z)) redRock(B, x, z, 0.6 + r() * 0.8, i); }
      break;
    }
    case 'meadow': default: {
      for (let i = 0; i < 40; i++) { const r = rng(D.k * 5 + i), x = cx - 30 + r() * 60, z = cz - 30 + r() * 60; B.add(GEO.ico(0.35, 0), M(x, 0.5, z), ['#ff8fb1', COL.yellow, '#b98cff', '#fff8e8'][i % 4], { ol: 0 }); }
      D.spots.forEach(p => { const x = wx(p.x), z = wz(p.y); if (p.type === 'berry') berryBush(B, x + 2.4, z); if (p.type === 'photo') tripod(B, x + 2, z); if (p.type === 'camp') { B.add(GEO.box(4, 0.06, 3), M(x, 0.08, z - 2), '#ff8fb1', { ol: 0 }); } if (p.type === 'view') bench(B, x + 2, z - 1, 0); });
      around(12, 38, 46, ['oak']);
      break;
    }
  }
  sign(B, cx - 6, 3.4, cz + 30, `${D.nature === 'canyon' ? '🏜️' : '🌲'} ${D.natureName}`, { post: true, th: 1.5 });
}

/* ------------------------------------------------------------------ home life: the Sunrise Pool, the tap, the Duck Pond */
// Right next to where everyone wakes up. The pool and the pond are WATERS, so the swim rules (splash, hooks.onSwim) just work.
const POOL_Y = 0.24;   // the pool's water sits a little under its tiled edge
const home = { pool: null, pond: null, duck: null, ducks: [] };
function telescope(B, x, z, y = 0) {
  // three legs leaning in, and a tube pointing up at the sky, tipped sideways so the camera sees it side-on
  const tilt = -0.8, ux = -Math.sin(tilt), uy = Math.cos(tilt), y0 = y + 2.8;   // (ux, uy): the tube's axis
  [0, 2.1, 4.2].forEach(a => B.add(GEO.cyl(0.08, 0.1, 2.6, 4), M(x + Math.sin(a) * 0.55, y + 1.25, z + Math.cos(a) * 0.55, a, -0.28), INKC, { ol: 0 }));
  B.add(GEO.cyl(0.5, 0.34, 2.8, 12), M(x, y0, z, 0, 0, tilt), COL.blue, { ol: 0.05 });
  B.add(GEO.cyl(0.58, 0.58, 0.3, 12), M(x + ux * 1.2, y0 + uy * 1.2, z, 0, 0, tilt), COL.yellow, { ol: 0.04 });
  B.add(GEO.cyl(0.15, 0.15, 0.5, 8), M(x - ux * 1.6, y0 - uy * 1.6, z, 0, 0, tilt), INKC, { ol: 0 });
  B.add(GEO.sph(0.3, 8, 6), M(x, y0 - 0.25, z), INKC, { ol: 0 });   // the joint on top of the legs
  addCircleSolid(x, z, 0.8);
}
function lounger(B, x, z, ry, color) {
  // the feet end is local +z, the backrest rises at -z
  const r = new THREE.Matrix4().makeRotationY(ry), at = (dx, dz) => new THREE.Vector3(dx, 0, dz).applyMatrix4(r);
  const put = (e, dx, y, dz, c, rx = 0, ol = 0.06) => { const p = at(dx, dz); B.add(e, M(x + p.x, y, z + p.z, ry, rx), c, { ol }); };
  [[-0.85, 1.9], [0.85, 1.9], [-0.85, -0.9], [0.85, -0.9]].forEach(([dx, dz]) => put(GEO.box(0.22, 0.8, 0.22), dx, 0.4, dz, INKC, 0, 0));
  put(GEO.rbox(2.2, 0.3, 3.4, 0.12, 1), 0, 0.9, 0.5, COL.paper);
  put(GEO.rbox(1.9, 0.22, 3.1, 0.1, 1), 0, 1.12, 0.5, color, 0, 0.04);
  put(GEO.rbox(2.2, 0.3, 2.0, 0.12, 1), 0, 1.65, -1.85, COL.paper, 0.8);
  put(GEO.rbox(1.9, 0.22, 1.8, 0.1, 1), 0, 1.8, -1.69, color, 0.8, 0.04);
  const c = [[-1.1, -2.9], [1.1, -2.9], [-1.1, 2.2], [1.1, 2.2]].map(([dx, dz]) => at(dx, dz)), xs = c.map(p => p.x), zs = c.map(p => p.z);
  addBoxSolid(x + Math.min(...xs), z + Math.min(...zs), x + Math.max(...xs), z + Math.max(...zs));
}
function umbrella(B, x, z, a = '#ff8fb1', b = COL.paper) {
  B.add(GEO.cyl(0.12, 0.12, 4.6, 6), M(x, 2.3, z), INKC, { ol: 0 });
  for (let i = 0; i < 8; i++) B.add(GEO.wedge(3.7, 1.3, i), M(x, 4.95, z), i % 2 ? b : a, { ol: 0.05 });
  B.add(GEO.ico(0.26, 0), M(x, 5.65, z), a, { ol: 0.03 });
  addCircleSolid(x, z, 0.45);
}
function buildPool() {
  const P = T.HOME.pool, x = wx(P.x), z = wz(P.y), rx = P.rx * S, rz = P.ry * S;
  home.pool = { x, z, rx, rz };
  WATERS.push({ x, z, rx, rz, y: POOL_Y });
  PADS.push({ x, z, rx: rx + 1.9, rz: rz + 1.9, y: 0.5 });
  // the tiled edge (with grout lines), then the water: a darker band under the edge, a pale ring of light, a few glints
  W.add(GEO.ering(rx, rz, 1.7, 0.5), M(x, 0, z), COL.shell, { ol: 0.08 });
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2, nx = Math.cos(a) / (rx + 0.85), nz = Math.sin(a) / (rz + 0.85);
    W.add(GEO.box(1.5, 0.03, 0.08), M(x + Math.cos(a) * (rx + 0.85), 0.5, z + Math.sin(a) * (rz + 0.85), Math.atan2(-nz, nx)), '#e6dcc6', { ol: 0 });
  }
  W.add(GEO.disc(1, 48), M(x, POOL_Y, z, 0, 0, 0, rx + 0.1, 1, rz + 0.1), '#7fd0ea', { ol: 0 });
  W.add(GEO.ring(0.88, 1.0, 48), M(x, POOL_Y + 0.01, z, 0, 0, 0, rx, 1, rz), '#6cc3e2', { ol: 0 });
  W.add(GEO.ring(0.56, 0.6, 48), M(x, POOL_Y + 0.02, z, 0, 0, 0, rx, 1, rz), '#bfefff', { ol: 0 });
  [[-6, -2.5, 0.2], [3.5, 3, -0.3], [7, -3.5, 0.1]].forEach(([dx, dz, a]) => W.add(GEO.box(1.6, 0.02, 0.22), M(x + dx, POOL_Y + 0.03, z + dz, a), '#bfefff', { ol: 0 }));
  // a metal ladder on the north side: rails in the water, over the edge, down to the tiles
  const lx = x + 4, lz = z - rz * Math.sqrt(1 - (4 / rx) ** 2), metal = '#cfd8e3';
  [-0.55, 0.55].forEach(dx => {
    W.add(GEO.cyl(0.11, 0.11, 1.9, 6), M(lx + dx, 1.15, lz + 0.45), metal, { ol: 0.04 });
    W.add(GEO.cyl(0.11, 0.11, 1.3, 6), M(lx + dx, 2.1, lz - 0.2, 0, Math.PI / 2), metal, { ol: 0.04 });
    W.add(GEO.cyl(0.11, 0.11, 1.6, 6), M(lx + dx, 1.3, lz - 0.85), metal, { ol: 0.04 });
  });
  [0.75, 1.4].forEach(y => W.add(GEO.box(1.1, 0.12, 0.4), M(lx, y, lz + 0.5), metal, { ol: 0.03 }));
  addCircleSolid(lx, lz + 0.2, 0.7);
  // two loungers under a striped umbrella on the east side, feet towards the water
  const ux = x + rx + 4.8;
  lounger(W, ux, z - 2.7, -Math.PI / 2, '#ff8fb1'); lounger(W, ux, z + 2.7, -Math.PI / 2, '#8fdcf2');
  umbrella(W, ux + 2.2, z);
  sign(W, wx(4170), 3.4, wz(2330), '🏊 🌅', { post: true, th: 1.5 });
  // a rubber duck bobbing around (moved in frame())
  const rd = new Builder();
  rd.add(GEO.sph(0.9, 10, 8), M(0, 0.45, 0, 0, 0, 0, 1.25, 0.75, 1), COL.yellow, { ol: 0.07 });
  rd.add(GEO.cone(0.35, 0.7, 5), M(-1.1, 0.85, 0, 0, 0, 0.9), COL.yellow, { ol: 0.05 });
  rd.add(GEO.sph(0.6, 10, 8), M(0.6, 1.3, 0), COL.yellow, { ol: 0.06 });
  rd.add(GEO.cone(0.26, 0.55, 6), M(1.25, 1.2, 0, 0, 0, -Math.PI / 2), '#ff9f43', { ol: 0.04 });
  [0.3, -0.3].forEach(s => rd.add(GEO.sph(0.09, 6, 4), M(0.95, 1.45, s), INKC, { ol: 0 }));
  home.duck = new THREE.Group(); home.duck.add(rd.mesh({ cast: false })); scene.add(home.duck);
}
function buildTap() {
  const x = wx(T.HOME.tap.x), z = wz(T.HOME.tap.y), stone = '#cfc6d8', metal = '#9aa3b5';
  W.add(GEO.rbox(2.8, 0.3, 3.6, 0.12, 1), M(x, 0.15, z + 0.3), '#d9cbb0', { ol: 0.07 });
  W.add(GEO.rbox(1.1, 3.4, 1.1, 0.25, 1), M(x, 1.9, z - 0.6), stone, { ol: 0.08, ao: 0.18 });
  W.add(GEO.rbox(1.45, 0.35, 1.45, 0.12, 1), M(x, 3.65, z - 0.6), '#bdb2cc', { ol: 0.06 });
  W.add(GEO.cyl(0.16, 0.16, 0.95, 8), M(x, 3.0, z + 0.3, 0, Math.PI / 2), metal, { ol: 0.04 });   // spout
  W.add(GEO.cyl(0.16, 0.16, 0.4, 8), M(x, 2.85, z + 0.7), metal, { ol: 0.04 });
  W.add(GEO.cyl(0.3, 0.3, 0.14, 10), M(x, 3.22, z + 0.1), COL.blue, { ol: 0.03 });                // the knob
  // a little basin, and the water running into it
  W.add(GEO.cyl(1.05, 0.8, 0.8, 16), M(x, 0.7, z + 0.85), '#e9e2d0', { ol: 0.07, ao: 0.15 });
  W.add(GEO.torus(0.92, 0.14, 16), M(x, 1.1, z + 0.85), COL.shell, { ol: 0.04 });
  W.add(GEO.disc(0.85, 16), M(x, 1.06, z + 0.85), '#8fdcf2', { ol: 0 });
  [[2.55, 0.74, 0.15], [2.2, 0.8, 0.14], [1.85, 0.84, 0.13], [1.5, 0.86, 0.12]].forEach(([y, dz, r]) => W.add(GEO.ico(r, 0), M(x, y, z + dz, 0, 0, 0, 1, 1.4, 1), '#8fdcf2', { ol: 0.02 }));
  addCircleSolid(x, z + 0.2, 1.5);
}
function buildPond() {
  const Q = T.POND, x = wx(Q.x), z = wz(Q.y), rx = Q.rx * S, rz = Q.ry * S;
  home.pond = { x, z, rx, rz };
  WATERS.push({ x, z, rx, rz, y: 0.07 });
  W.add(GEO.disc(1, 40), M(x, 0.04, z, 0, 0, 0, rx + 2.4, 1, rz + 2.2), '#e9d9b0', { ol: 0 });
  W.add(GEO.disc(1, 40), M(x, 0.07, z, 0, 0, 0, rx, 1, rz), '#7fd0ea', { ol: 0 });
  W.add(GEO.ring(0.7, 0.74, 40), M(x, 0.09, z, 0, 0, 0, rx, 1, rz), '#bfefff', { ol: 0 });
  // lily pads (two with a flower)
  [[-6, -2.4, 0.3], [4.6, -3.3, 2.1], [-4.4, 3.1, 4], [6.6, 1.4, 1]].forEach(([dx, dz, a], i) => {
    W.add(GEO.lily(0.95), M(x + dx, 0.11, z + dz, a), '#8cc45e', { ol: 0 });
    if (i % 2 === 0) W.add(GEO.ico(0.26, 0), M(x + dx + 0.2, 0.28, z + dz + 0.1), '#ff8fb1', { ol: 0.03 });
  });
  // reeds along the far shore
  [3.5, 4.1, 5.4].forEach((a, k) => {
    const rx2 = x + Math.cos(a) * (rx + 0.6), rz2 = z + Math.sin(a) * (rz + 0.6);
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 0.45, h = 2 + ((i + k) % 3) * 0.35;
      W.add(GEO.cyl(0.06, 0.08, h, 4), M(rx2 + ox, h / 2, rz2 + (i % 2) * 0.3), '#6fb84a', { ol: 0 });
      W.add(GEO.capsule(0.16, 0.45), M(rx2 + ox, h - 0.1, rz2 + (i % 2) * 0.3), COL.woodDark, { ol: 0.03 });
    }
  });
  [[-rx - 1.6, 1.5], [rx + 1.2, -2.2]].forEach(([dx, dz]) => { W.add(GEO.ico(0.8, 0), M(x + dx, 0.35, z + dz), '#cfc6d8', { ol: 0.06 }); addCircleSolid(x + dx, z + dz, 0.9); });
  // a little wooden dock from the fishing spot on the south shore out over the water (you stand on it, not swim)
  const f = T.OLD_SPOTS.find(s => s.type === 'fish') || { x: Q.x, y: Q.y + Q.ry + 20 }, fx = wx(f.x);
  const d0 = wz(f.y) + 1, d1 = z + rz - 3.5, dc = (d0 + d1) / 2;
  W.add(GEO.box(2.6, 0.3, d0 - d1), M(fx, 0.5, dc), COL.wood, { ol: 0.06 });
  for (let k = d1 + 0.7; k < d0 - 0.3; k += 1.1) W.add(GEO.box(2.62, 0.04, 0.08), M(fx, 0.66, k), COL.woodDark, { ol: 0 });
  [[-1.2, d1 + 0.3], [1.2, d1 + 0.3], [-1.2, dc + 0.4], [1.2, dc + 0.4]].forEach(([dx, dz]) => W.add(GEO.cyl(0.2, 0.2, 1.4, 6), M(fx + dx, 0.35, dz), COL.woodDark, { ol: 0.04 }));
  DECKS.push({ x0: fx - 1.35, z0: d1, x1: fx + 1.35, z1: d0, y: 0.65 });
  // a duck and her duckling paddle around (moved in frame())
  [1, 0.55].forEach(k => { const d = duck.clone(); d.scale.setScalar(k); d.visible = true; scene.add(d); home.ducks.push(d); });
}
function buildHome() {
  buildPool(); buildTap(); buildPond();
  // the old town's nature spots: a camera on a tripod, a telescope, a berry bush
  T.OLD_SPOTS.forEach(s => {
    const x = wx(s.x), z = wz(s.y);
    if (s.type === 'photo') tripod(W, x + 3, z);          // beside the spot, so you still see it while you stand there
    if (s.type === 'stars') telescope(W, x + 3, z);
    if (s.type === 'berry') berryBush(W, x + 3.4, z);
  });
  addBall(T.BALL.x, T.BALL.y, 'soccer');
}
function updateHome(t) {
  const p = home.pool, q = home.pond;
  if (p && home.duck) {
    // the rubber duck drifts round the pool, bobbing, facing the way it goes
    const a = t * 0.18, dx = -Math.sin(a) * p.rx * 0.5, dz = Math.cos(a) * p.rz * 0.45;
    home.duck.position.set(p.x + Math.cos(a) * p.rx * 0.5, POOL_Y - 0.15 + Math.sin(t * 2.2) * 0.07, p.z + Math.sin(a) * p.rz * 0.45);
    home.duck.rotation.set(Math.sin(t * 1.7) * 0.06, Math.atan2(-dz, dx), Math.sin(t * 2.2) * 0.08);
  }
  if (q) home.ducks.forEach((d, i) => {
    // mother in front, duckling a little behind on the same loop
    const a = -t * 0.3 + i * 0.45, dx = Math.sin(a) * q.rx, dz = -Math.cos(a) * q.rz;
    d.position.set(q.x + Math.cos(a) * q.rx * 0.55, 0.02 + Math.sin(t * 2 + i) * 0.05, q.z + Math.sin(a) * q.rz * 0.5);
    d.rotation.y = Math.atan2(-dz, dx);
  });
}

/* ------------------------------------------------------------------ every town looks like its kind */
// Terrain for a group of hills: one mesh whose height is the sum of the hills (the same as hillH, so walking
// matches what you see), painted by height with per-vertex colours (grass, rock, snow; or canyon stripes).
const terrainCache = new Map();
function terrainGeo(key, hills, x0, z0, x1, z1, cell, paint) {
  if (terrainCache.has(key)) return terrainCache.get(key);
  const make = () => {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const g = new THREE.PlaneGeometry(w, d, Math.max(2, Math.round(w / cell)), Math.max(2, Math.round(d / cell))).rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + cx, z = p.getZ(i) + cz;
      let h = 0, best = 0, top = 0;
      for (const q of hills) { const dx = x - q.x, dz = z - q.z, v = q.h * Math.exp(-(dx * dx + dz * dz) / (2 * q.s * q.s)); h += v; if (v > best) { best = v; top = q.h; } }
      p.setY(i, h - 0.05);
      paint(c, h, top ? h / top : 0, x, z);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g.toNonIndexed();
  };
  const g = make(); g.computeBoundingBox();
  const e = { g, dirs: null, minY: g.boundingBox.min.y, maxY: g.boundingBox.max.y };
  terrainCache.set(key, e);
  return e;
}
function terrain(B, key, hills, cell, paint) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  hills.forEach(q => { x0 = Math.min(x0, q.x - 3.2 * q.s); x1 = Math.max(x1, q.x + 3.2 * q.s); z0 = Math.min(z0, q.z - 3.2 * q.s); z1 = Math.max(z1, q.z + 3.2 * q.s); });
  B.add(terrainGeo(key, hills, x0, z0, x1, z1, cell, paint), M((x0 + x1) / 2, 0, (z0 + z1) / 2), '#ffffff', { ol: 0, vc: true });
}
const _pc = new THREE.Color();
const MTN = { grass: new THREE.Color('#a8d46c'), meadow: new THREE.Color('#9cc478'), rock: new THREE.Color('#b9ae9f'), rock2: new THREE.Color('#a39888'), snow: new THREE.Color('#f7fbff') };
function paintMountain(c, h, f, x, z) {
  const n = Math.sin(x * 0.7) * 0.05 + Math.sin(z * 0.9 + x * 0.3) * 0.05;
  if (h < 0.25) c.copy(MTN.grass);
  else if (f + n > 0.68) c.copy(MTN.snow);
  else if (f + n > 0.3) c.copy(MTN.rock).lerp(MTN.rock2, Math.max(0, Math.min(1, (f - 0.3) * 3)));
  else c.copy(MTN.grass).lerp(MTN.meadow, Math.min(1, f * 2.5));
}
const CANYON = ['#d9895a', '#c8643c', '#e8a878', '#b8552f'].map(h => new THREE.Color(h)), SANDC = new THREE.Color('#e9c98f');
function paintCanyon(c, h, f) {
  if (h < 0.3) { c.copy(SANDC); return; }
  c.copy(f > 0.9 ? CANYON[2] : CANYON[Math.floor(h / 1.3) % CANYON.length]);
}
// a flat-topped mesa in red rock layers
function mesa(B, x, z, r, h, seed) {
  const k = 1 + (seed % 3) * 0.14, L = [['#c8643c', 0.4], ['#d9895a', 0.32], ['#b8552f', 0.28]];
  let y = 0, rr = r;
  L.forEach(([c, f], i) => { const hh = h * f, r2 = rr * 0.9; B.add(GEO.cyl(r2, rr, hh, 9), M(x, y + hh / 2, z, seed, 0, 0, k, 1, 1), c, { ol: 0.12, ao: i ? 0.05 : 0.2 }); y += hh; rr = r2; });
  B.add(GEO.cyl(rr * 0.96, rr, 0.35, 9), M(x, y + 0.17, z, seed, 0, 0, k, 1, 1), '#e8a878', { ol: 0.06 });
  addCircleSolid(x, z, r * (1 + k) / 2);
}
function redRock(B, x, z, s, seed, y = 0) {
  B.add(GEO.ico(1.3 * s, 0), M(x, y + 0.6 * s, z, seed, 0, 0, 1.2, 0.8, 1), seed % 2 ? '#c8643c' : '#b8552f', { ol: 0.08 });
  B.add(GEO.ico(0.7 * s, 0), M(x + 1.2 * s, y + 0.3 * s, z + 0.6 * s, seed + 1), '#d9895a', { ol: 0.06 });
  addCircleSolid(x, z, 1.3 * s);
}
function greyRock(B, x, z, s, seed, y = 0) {
  B.add(GEO.ico(1.2 * s, 0), M(x, y + 0.5 * s, z, seed, 0, 0, 1.2, 0.75, 1), seed % 2 ? '#b9ae9f' : '#a39888', { ol: 0.08 });
  B.add(GEO.ico(0.6 * s, 0), M(x - 1.1 * s, y + 0.25 * s, z + 0.5 * s, seed + 2), '#cfc6d8', { ol: 0.05 });
  addCircleSolid(x, z, 1.2 * s);
}
function redArch(B, x, z, ry) {
  const at = (dx) => ({ x: x + Math.cos(ry) * dx, z: z - Math.sin(ry) * dx });
  [-4.2, 4.2].forEach(dx => { const p = at(dx); B.add(GEO.rbox(2.8, 5.4, 2.6, 0.5, 1), M(p.x, 2.7, p.z, ry), '#c8643c', { ol: 0.1, ao: 0.2 }); addCircleSolid(p.x, p.z, 1.6); });
  B.add(GEO.arch(4.2, 1.35, 16), M(x, 5.2, z, ry, 0, 0, 1, 1, 1.4), '#d9895a', { ol: 0.1 });
}
function rowboat(B, x, y, z, ry, color) {
  const r = new THREE.Matrix4().makeRotationY(ry), put = (e, dx, dy, dz, c, o = {}) => { const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(r); B.add(e, M(x + p.x, y + dy, z + p.z, ry, o.rx || 0, o.rz || 0), c, { ol: o.ol ?? 0.06 }); };
  put(GEO.rbox(4.8, 0.9, 1.9, 0.44, 1), 0, 0.35, 0, color, { ol: 0.08 });
  put(GEO.box(4.0, 0.1, 1.4), 0, 0.76, 0, '#8a5a34', { ol: 0 });
  [-0.9, 0.9].forEach(dx => put(GEO.box(0.5, 0.18, 1.6), dx, 0.85, 0, '#c98a52', { ol: 0.03 }));
  [-1, 1].forEach(sd => put(GEO.box(0.2, 0.1, 3.4), 0.2, 0.85, sd * 1.1, '#c98a52', { rz: 0, ol: 0.02 }));
}
// a little house facing +z. o: { w, d, h, wall, roof, pitch, over, door, stripe, logs, timber, chimney }
function house(B, x, z, o) {
  const w = o.w || 10, d = o.d || 8, h = o.h || 5.5, zf = z + d / 2;
  B.add(GEO.rbox(w + 0.8, 0.4, d + 0.8, 0.2, 1), M(x, 0.2, z), o.base || '#d9cbb0', { ol: 0.07 });
  B.add(GEO.rbox(w, h, d, 0.3, 1), M(x, h / 2 + 0.3, z), o.wall, { ol: 0.12, ao: 0.16 });
  if (o.logs) {
    for (let y = 1.0; y < h; y += 0.9) B.add(GEO.cyl(0.3, 0.3, w + 0.6, 6), M(x, y, zf + 0.04, 0, 0, Math.PI / 2), o.logs, { ol: 0 });
    [-1, 1].forEach(sd => B.add(GEO.cyl(0.42, 0.42, h, 7), M(x + sd * (w / 2), h / 2 + 0.3, zf - 0.1), o.logs, { ol: 0.04 }));
  }
  if (o.timber) {
    const t = o.timber, mid = h * 0.5 + 0.3;
    [-w / 2 + 0.2, -w / 6, w / 6, w / 2 - 0.2].forEach(dx => B.add(GEO.box(0.35, h, 0.1), M(x + dx, h / 2 + 0.3, zf + 0.05), t, { ol: 0 }));
    [0.5, mid, h + 0.1].forEach(y => B.add(GEO.box(w, 0.35, 0.1), M(x, y, zf + 0.06), t, { ol: 0 }));
    const pw = w / 2 - w / 6 - 0.2, ph = h + 0.1 - mid, a = Math.atan2(pw, ph), L = Math.hypot(pw, ph);
    [-1, 1].forEach(sd => [-1, 1].forEach(s2 => B.add(GEO.box(0.28, L, 0.08), M(x + sd * (w / 6 + pw / 2 + 0.1), (mid + h + 0.1) / 2, zf + 0.07, 0, 0, s2 * a), t, { ol: 0 })));
    B.add(GEO.box(w + 0.7, 0.4, d + 0.7), M(x, mid, z), t, { ol: 0.05 });
  }
  const rise = gable(B, x, z, w, d, h + 0.3, o.roof, o.over ?? 0.8, o.pitch ?? 0.6, o.wall, o.stripe || null);
  door3(B, x + (o.doorX || 0), zf + 0.25, o.door || COL.woodDark, 2.4, Math.min(4, h - 0.6));
  if (w >= 8) { const wy = Math.min(3.2, h * 0.55); window3(B, x - w * 0.3, wy, zf + 0.26, 2, 2); window3(B, x + w * 0.3, wy, zf + 0.26, 2, 2); }
  if (o.chimney) B.add(GEO.box(1.1, 2.4, 1.1), M(x + w * 0.28, h + 0.3 + rise * 0.55 + 0.8, z - d * 0.2), o.chimney, { ol: 0.07 });
  addBoxSolid(x - w / 2 - 0.3, z - d / 2 - 0.3, x + w / 2 + 0.3, zf + 0.35);
  return rise;
}
function hedgeLine(B, ax, az, bx, bz, o = {}) {   // axis-aligned; o.h, o.t (thickness), o.color
  const h = o.h || 1.5, t = o.t || 1.2, len = Math.abs(bx - ax) + Math.abs(bz - az);
  if (len < 0.5) return;
  const along = Math.abs(bx - ax) > Math.abs(bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
  B.add(GEO.rbox(along ? len : t, h, along ? t : len, Math.min(0.5, t / 2 - 0.01), 1), M(mx, h / 2, mz), o.color || '#6fae4a', { ol: 0.09, ao: 0.18 });
  addBoxSolid(mx - (along ? len : t) / 2, mz - (along ? t : len) / 2, mx + (along ? len : t) / 2, mz + (along ? t : len) / 2);
}
function fenceLine(B, ax, az, bx, bz, color = COL.wood, rail = '#e0b27f') {
  const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / 3.2)), ang = Math.atan2(bz - az, bx - ax);
  for (let i = 0; i <= n; i++) B.add(GEO.box(0.42, 1.9, 0.42), M(ax + (bx - ax) * i / n, 0.95, az + (bz - az) * i / n), color, { ol: 0.06 });
  [0.7, 1.4].forEach(y => B.add(GEO.box(len, 0.22, 0.16), M((ax + bx) / 2, y, (az + bz) / 2, -ang), rail, { ol: 0.05 }));
  addBoxSolid(Math.min(ax, bx) - 0.3, Math.min(az, bz) - 0.3, Math.max(ax, bx) + 0.3, Math.max(az, bz) + 0.3);
}
function planter(B, x, z) {
  B.add(GEO.rbox(3.2, 1.2, 3.2, 0.2, 1), M(x, 0.6, z), '#cfc6b4', { ol: 0.07 });
  B.add(GEO.ico(1.5, 1), M(x, 2.0, z), '#7fbf55', { ol: 0.08 });
  addCircleSolid(x, z, 1.8);
}
function smallFountain(B, x, z) {
  B.add(GEO.cyl(2.8, 3.0, 0.9, 20), M(x, 0.45, z), '#e9e2d0', { ol: 0.1, ao: 0.15 });
  B.add(GEO.torus(2.75, 0.26, 20), M(x, 0.95, z), '#f7f1e3', { ol: 0.05 });
  B.add(GEO.disc(2.6, 20), M(x, 0.86, z), '#8fdcf2', { ol: 0 });
  B.add(GEO.cyl(0.4, 0.55, 2.2, 10), M(x, 1.6, z), '#e9e2d0', { ol: 0.06 });
  B.add(GEO.cyl(1.2, 0.5, 0.5, 14), M(x, 2.8, z), '#f7f1e3', { ol: 0.06 });
  B.add(GEO.ico(0.45, 1), M(x, 3.4, z), '#bfefff', { ol: 0.04 });
  addCircleSolid(x, z, 3.0);
}
function flowerBed(B, x, z, w, d, colors, seed, soil = '#7a4a2a') {
  B.add(GEO.rbox(w, 0.4, d, 0.3, 1), M(x, 0.2, z), soil, { ol: 0.06 });
  const n = Math.max(4, Math.round(w * d / 3)), r = rng(seed);
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * (w - 1), fz = z + (r() - 0.5) * (d - 1);
    B.add(GEO.ico(0.5, 0), M(fx, 0.6, fz), '#6fb84a', { ol: 0 });
    B.add(GEO.ico(0.3, 0), M(fx + 0.1, 1.0, fz + 0.1), colors[i % colors.length], { ol: 0.03 });
  }
}
function topiary(B, x, z, cone) {
  B.add(GEO.cyl(0.9, 1.1, 1, 10), M(x, 0.5, z), '#c8745a', { ol: 0.06 });
  if (cone) B.add(GEO.cone(1.3, 3.6, 10), M(x, 2.9, z), '#5f9e57', { ol: 0.08 });
  else { B.add(GEO.cyl(0.15, 0.15, 1.6, 5), M(x, 1.6, z), COL.woodDark, { ol: 0 }); B.add(GEO.sph(1.2, 12, 8), M(x, 2.9, z), '#6aab5e', { ol: 0.08 }); }
  addCircleSolid(x, z, 1.1);
}
function sunflower(B, x, z, h) {
  B.add(GEO.cyl(0.1, 0.12, h, 5), M(x, h / 2, z), '#6fb84a', { ol: 0 });
  B.add(GEO.cyl(0.75, 0.75, 0.16, 12), M(x, h + 0.2, z + 0.1, 0, 1.2), COL.yellow, { ol: 0.04 });
  B.add(GEO.cyl(0.35, 0.35, 0.2, 10), M(x, h + 0.22, z + 0.18, 0, 1.2), '#8a5a34', { ol: 0 });
}
function tower(B, x, z, w, d, h, wall, glass, style, r) {
  B.add(GEO.rbox(w + 1.4, 0.5, d + 1.4, 0.2, 1), M(x, 0.25, z), '#cfc6b4', { ol: 0.07 });
  B.add(GEO.rbox(w, h, d, 0.35, 1), M(x, h / 2 + 0.4, z), wall, { ol: 0.14, ao: 0.1 });
  if (style === 0) for (let y = 4.2; y < h - 1.2; y += 2.6) B.add(GEO.box(w + 0.12, 1.25, d + 0.12), M(x, y, z), glass, { ol: 0 });
  else {
    const n = Math.max(2, Math.round(w / 3.2)), m = Math.max(2, Math.round(d / 3.2));
    for (let i = 0; i < n; i++) B.add(GEO.box(w / n * 0.52, h - 4.4, d + 0.12), M(x - w / 2 + (i + 0.5) * w / n, h / 2 + 2.4, z), glass, { ol: 0 });
    for (let j = 0; j < m; j++) B.add(GEO.box(w + 0.12, h - 4.4, d / m * 0.52), M(x, h / 2 + 2.4, z - d / 2 + (j + 0.5) * d / m), glass, { ol: 0 });
  }
  B.add(GEO.box(w * 0.46, 3, 0.2), M(x, 1.9, z + d / 2 + 0.08), '#1f1a2e', { ol: 0 });
  B.add(GEO.box(w * 0.6, 0.35, 2), M(x, 3.6, z + d / 2 + 1), '#8a8f99', { ol: 0.05 });
  B.add(GEO.rbox(w + 0.6, 0.9, d + 0.6, 0.2, 1), M(x, h + 0.7, z), '#8a8f99', { ol: 0.1 });
  const k = r();
  if (k < 0.4) { B.add(GEO.rbox(w * 0.4, 1.8, d * 0.35, 0.2, 1), M(x - w * 0.15, h + 2, z - d * 0.1), '#cfd8e3', { ol: 0.07 }); B.add(GEO.cyl(1.1, 1.1, 2.2, 12), M(x + w * 0.25, h + 2.2, z + d * 0.15), '#c98a52', { ol: 0.07 }); }
  else if (k < 0.75) { B.add(GEO.box(w * 0.6, 3, d * 0.6), M(x, h + 2.6, z), wall, { ol: 0.1, ao: 0.1 }); B.add(GEO.cyl(0.14, 0.2, 6, 6), M(x, h + 7, z), INKC, { ol: 0 }); B.add(GEO.ico(0.35, 0), M(x, h + 10.1, z), COL.roof, { ol: 0.03 }); }
  else { B.add(GEO.cyl(3, 3, 0.3, 18), M(x, h + 1.3, z), '#5a5f6b', { ol: 0.05 }); B.add(GEO.ring(1.8, 2.2, 18), M(x, h + 1.47, z), COL.yellow, { ol: 0 }); }
  addBoxSolid(x - w / 2 - 0.3, z - d / 2 - 0.3, x + w / 2 + 0.3, z + d / 2 + 0.4);
}
function billboard(B, x, z) {
  [-5, 5].forEach(dx => { B.add(GEO.cyl(0.35, 0.45, 9, 8), M(x + dx, 4.5, z), '#5a5f6b', { ol: 0.05 }); addCircleSolid(x + dx, z, 0.6); });
  B.add(GEO.rbox(16, 8, 0.9, 0.3, 1), M(x, 12.5, z), '#1f1a2e', { ol: 0.1 });
  B.add(GEO.box(15, 7, 0.2), M(x, 12.5, z + 0.45), '#ff8fb1', { ol: 0 });
  B.add(GEO.box(15, 2.2, 0.1), M(x, 10.1, z + 0.56), '#ffd23f', { ol: 0 });
  B.add(GEO.ico(1.4, 0), M(x - 5.2, 13.6, z + 0.6), '#fff8e8', { ol: 0 });
  addText(label('📈 Buy low, sell high!'), M(x + 1.2, 13.4, z + 0.62), 1.5);
  addText(label('Small World Stock Exchange'), M(x, 10.1, z + 0.62), 1.0);
}
function sidewalks(B, D, color) {
  const x0 = wx(D.x0), x1 = wx(D.x1);
  [1698, 1822].forEach(gy => B.add(GEO.box(x1 - x0, 0.07, 2.4), M((x0 + x1) / 2, 0.035, wz(gy)), color, { ol: 0 }));
}
function mansion(B, x, z, wall, roof, seed) {
  // x, z: the middle of a hedged yard (34 x 26); the house at the back, a fountain and roses in front
  const w = 18, d = 10, h = 8.5, hz = z - 4, zf = hz + d / 2;
  B.add(GEO.rbox(w + 1, 0.5, d + 1, 0.25, 1), M(x, 0.25, hz), '#d9cbb0', { ol: 0.08 });
  B.add(GEO.rbox(w, h, d, 0.4, 1), M(x, h / 2 + 0.3, hz), wall, { ol: 0.13, ao: 0.14 });
  [-1, 1].forEach(sd => {
    B.add(GEO.rbox(6, 5.6, 8.4, 0.3, 1), M(x + sd * 12, 3.1, hz + 0.4), wall, { ol: 0.12, ao: 0.14 });
    B.add(GEO.box(6.6, 0.6, 9), M(x + sd * 12, 6.2, hz + 0.4), '#fff8e8', { ol: 0.07 });
    window3(B, x + sd * 12, 3.4, hz + 4.86, 2.4, 2.4);
  });
  const rise = gable(B, x, hz, w, d, h + 0.3, roof, 0.9, 0.5, wall);
  [-6.5, 6.5].forEach(dx => B.add(GEO.box(1.3, 3, 1.3), M(x + dx, h + rise * 0.5 + 1.2, hz - 1.5), '#c8745a', { ol: 0.07 }));
  [-3.6, -1.9, 1.9, 3.6].forEach(dx => B.add(GEO.cyl(0.42, 0.5, h - 0.5, 10), M(x + dx, (h - 0.5) / 2 + 0.3, zf + 1.6), '#ffffff', { ol: 0.07 }));
  B.add(GEO.box(9, 0.8, 2.8), M(x, h + 0.1, zf + 1.4), '#ffffff', { ol: 0.08 });
  B.add(GEO.prism(9, 1.8, 2.8), M(x, h + 0.5, zf + 1.4), '#ffffff', { ol: 0.08 });
  [-6.5, 6.5].forEach(dx => { window3(B, x + dx, 3.4, zf + 0.26, 2.2, 2.4); window3(B, x + dx, 7.0, zf + 0.26, 2.2, 2.2); });
  door3(B, x, zf + 0.3, '#34233f', 2.8, 4.6);
  addBoxSolid(x - 15.3, hz - d / 2 - 0.4, x + 15.3, zf + 0.4);
  addBoxSolid(x - 4.2, zf, x + 4.2, zf + 2.3);
  B.add(GEO.box(3, 0.05, 10), M(x, 0.05, zf + 7.5), '#e9d9b0', { ol: 0 });
  smallFountain(B, x, z + 8);
  flowerBed(B, x - 10, z + 8, 7, 4, ['#e4572e', '#ff8fb1', '#fff8e8'], seed * 7 + 1);
  flowerBed(B, x + 10, z + 8, 7, 4, ['#e4572e', '#ff8fb1', '#fff8e8'], seed * 7 + 2);
  const X0 = x - 17, X1 = x + 17, Z0 = z - 12, Z1 = z + 13;
  hedgeLine(B, X0, Z0, X1, Z0); hedgeLine(B, X0, Z0, X0, Z1); hedgeLine(B, X1, Z0, X1, Z1);
  hedgeLine(B, X0, Z1, x - 2.5, Z1); hedgeLine(B, x + 2.5, Z1, X1, Z1);
  [[X0, Z1], [X1, Z1], [x - 2.5, Z1], [x + 2.5, Z1]].forEach(([px, pz]) => B.add(GEO.sph(0.8, 10, 6), M(px, 1.9, pz), '#5f9e57', { ol: 0.06 }));
}
function tennis(B, x, z) {
  B.add(GEO.rbox(28, 0.12, 15, 0.3, 1), M(x, 0.06, z), '#7fb86a', { ol: 0.05 });
  B.add(GEO.box(24, 0.1, 11), M(x, 0.1, z), '#5b8fd8', { ol: 0 });
  [[0, -5.5, 24, 0.22], [0, 5.5, 24, 0.22], [0, -4.1, 24, 0.14], [0, 4.1, 24, 0.14], [-12, 0, 0.22, 11], [12, 0, 0.22, 11], [-6.4, 0, 0.16, 8.2], [6.4, 0, 0.16, 8.2], [0, 0, 12.8, 0.14]].forEach(([dx, dz, lw, ld]) => B.add(GEO.box(lw, 0.04, ld), M(x + dx, 0.17, z + dz), '#ffffff', { ol: 0 }));
  [-6.3, 6.3].forEach(dz => B.add(GEO.cyl(0.14, 0.14, 1.6, 6), M(x, 0.8, z + dz), INKC, { ol: 0 }));
  B.add(GEO.box(0.08, 1.0, 12.4), M(x, 0.65, z), '#4a3d5c', { ol: 0 });
  B.add(GEO.box(0.14, 0.18, 12.4), M(x, 1.2, z), '#ffffff', { ol: 0 });
  addBoxSolid(x - 0.3, z - 6.4, x + 0.3, z + 6.4);
  for (let i = 0; i <= 8; i++) B.add(GEO.cyl(0.1, 0.1, 3.2, 5), M(x - 14 + i * 3.5, 1.6, z - 7.5), INKC, { ol: 0 });
  B.add(GEO.box(28, 0.14, 0.14), M(x, 3.1, z - 7.5), INKC, { ol: 0 });
  B.add(GEO.box(28, 2.6, 0.05), M(x, 1.7, z - 7.5), '#6b8f6a', { ol: 0 });
  addBoxSolid(x - 14, z - 7.8, x + 14, z - 7.2);
  B.add(GEO.ico(0.3, 1), M(x - 7, 0.5, z + 2), '#d8f25a', { ol: 0.03 });
}
function cropField(B, x, z, w, d, crop, seed) {
  B.add(GEO.rbox(w, 0.3, d, 0.3, 1), M(x, 0.15, z), '#8f5d36', { ol: 0.06 });
  const r = rng(seed);
  for (let rz = z - d / 2 + 1.4; rz < z + d / 2 - 0.8; rz += 2.3) {
    if (crop === 'wheat') B.add(GEO.box(w - 1.6, 1.1, 1.3), M(x, 0.8, rz), '#e8c95a', { ol: 0.04 });
    else if (crop === 'corn') { B.add(GEO.box(w - 1.6, 2.2, 1.0), M(x, 1.3, rz), '#7fbf55', { ol: 0.04 }); for (let cx = x - w / 2 + 2; cx < x + w / 2 - 1; cx += 2.6) B.add(GEO.capsule(0.22, 0.5), M(cx, 1.9, rz + 0.55), COL.yellow, { ol: 0 }); }
    else if (crop === 'cabbage') for (let cx = x - w / 2 + 1.5; cx < x + w / 2 - 1; cx += 1.7) B.add(GEO.ico(0.62, 0), M(cx, 0.6, rz), r() < 0.5 ? '#9dd46e' : '#8cc45e', { ol: 0.03 });
    else { B.add(GEO.box(w - 1.6, 0.35, 0.9), M(x, 0.45, rz), '#6fb84a', { ol: 0 }); for (let cx = x - w / 2 + 2; cx < x + w / 2 - 1; cx += 3.1) if (r() < 0.7) B.add(GEO.sph(0.7, 10, 6), M(cx + r(), 0.8, rz, 0, 0, 0, 1.2, 0.85, 1.2), '#f08a3c', { ol: 0.05 }); }
  }
  fence(B, x - w / 2 - 0.8, z - d / 2 - 0.8, x + w / 2 + 0.8, z + d / 2 + 0.8, 5);
}
function barn(B, x, z) {
  B.add(GEO.rbox(10, 7, 9, 0.3, 1), M(x, 3.5, z), '#d9534f', { ol: 0.12, ao: 0.18 });
  gable(B, x, z, 10, 9, 7, '#7d5a44', 0.7, 0.75, '#d9534f');
  B.add(GEO.box(4.2, 4.6, 0.3), M(x, 2.3, z + 4.55), '#f7f1e3', { ol: 0.07 });
  B.add(GEO.box(0.25, 5.8, 0.1), M(x, 2.3, z + 4.72, 0, 0, 0.72), '#9a3b2a', { ol: 0 });
  B.add(GEO.box(0.25, 5.8, 0.1), M(x, 2.3, z + 4.72, 0, 0, -0.72), '#9a3b2a', { ol: 0 });
  B.add(GEO.box(2.2, 1.6, 0.3), M(x, 8.4, z + 4.55), '#f7f1e3', { ol: 0.05 });
  addBoxSolid(x - 5.2, z - 4.8, x + 5.2, z + 4.8);
}
function silo(B, x, z, h) {
  B.add(GEO.cyl(2.3, 2.4, h, 16), M(x, h / 2, z), '#dfe6ee', { ol: 0.1, ao: 0.15 });
  for (let y = 3; y < h; y += 3.4) B.add(GEO.cyl(2.42, 2.42, 0.28, 16), M(x, y, z), '#9aa3b5', { ol: 0 });
  B.add(GEO.sph(2.4, 16, 8, true), M(x, h, z), '#e4572e', { ol: 0.08 });
  addCircleSolid(x, z, 2.6);
}
const spinners = [];   // windmill sails: turned a little every frame
function windmill(B, x, z) {
  B.add(GEO.cyl(1.4, 2.4, 10, 8), M(x, 5, z), '#fff3d6', { ol: 0.12, ao: 0.15 });
  B.add(GEO.cone(2.2, 2.4, 8), M(x, 11.2, z), '#9a3b2a', { ol: 0.09 });
  door3(B, x, z + 2.2, COL.woodDark, 1.8, 3);
  B.add(GEO.cyl(0.3, 0.3, 1.6, 8), M(x, 9.6, z + 1.6, 0, Math.PI / 2), INKC, { ol: 0 });
  addCircleSolid(x, z, 2.5);
  const S2 = new Builder();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, R = new THREE.Matrix4().makeRotationZ(a);
    S2.add(GEO.box(0.3, 6, 0.2), R.clone().multiply(M(0, 3.3, 0)), COL.woodDark, { ol: 0.03 });
    S2.add(GEO.box(1.5, 4.8, 0.12), R.clone().multiply(M(0.9, 3.8, 0)), '#fff8e8', { ol: 0.05 });
  }
  S2.add(GEO.ico(0.6, 0), M(0, 0, 0.2), '#e4572e', { ol: 0.04 });
  const m = S2.mesh(); m.position.set(x, 9.6, z + 2.5); scene.add(m); spinners.push(m);
}
function hay(B, x, z, ry) { B.add(GEO.cyl(1.2, 1.2, 1.8, 12), M(x, 1.2, z, ry, 0, Math.PI / 2), '#f4d27a', { ol: 0.07 }); addCircleSolid(x, z, 1.3); }
function tractor(B, x, z, ry, color) {
  const r = new THREE.Matrix4().makeRotationY(ry), put = (e, dx, y, dz, c, rz = 0, ol = 0.07) => { const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(r); B.add(e, M(x + p.x, y, z + p.z, ry, 0, rz), c, { ol }); };
  put(GEO.rbox(2.4, 1.6, 4.4, 0.3, 1), 0, 1.6, 0.4, color);
  put(GEO.rbox(2.6, 2.6, 2.4, 0.2, 1), 0, 3.4, -1.1, '#9ff3ff', 0, 0.06);
  put(GEO.rbox(2.9, 0.3, 2.7, 0.1, 1), 0, 4.8, -1.1, color, 0, 0.05);
  [-1, 1].forEach(sd => { put(GEO.cyl(1.5, 1.5, 0.9, 14), sd * 1.5, 1.5, -1.2, INKC, Math.PI / 2, 0); put(GEO.cyl(0.9, 0.9, 0.7, 12), sd * 1.3, 0.9, 2.1, INKC, Math.PI / 2, 0); put(GEO.cyl(0.5, 0.5, 0.95, 10), sd * 1.52, 1.5, -1.2, COL.yellow, Math.PI / 2, 0); });
  put(GEO.cyl(0.14, 0.14, 1.6, 6), 0.6, 3, 1.8, INKC, 0, 0);
  addCircleSolid(x, z, 2.6);
}
function surfboard(B, x, z, color, ry) {
  B.add(GEO.capsule(0.6, 3.0), M(x, 2.0, z, ry, 0, 0.12, 1, 1, 0.28), color, { ol: 0.05 });
  B.add(GEO.box(0.2, 3.6, 0.2), M(x - 0.05, 2.0, z, ry, 0, 0.12), '#fff8e8', { ol: 0 });
  addCircleSolid(x, z, 0.6);
}
function lifeguard(B, x, z) {
  [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([dx, dz]) => B.add(GEO.box(0.3, 4.6, 0.3), M(x + dx, 2.3, z + dz), '#fff8e8', { ol: 0.04 }));
  B.add(GEO.box(3.4, 0.4, 3.4), M(x, 4.7, z), COL.wood, { ol: 0.06 });
  B.add(GEO.box(3, 2.2, 2.6), M(x, 6, z - 0.2), '#e4572e', { ol: 0.08 });
  B.add(GEO.box(3.6, 0.3, 3.4), M(x, 7.3, z - 0.1), '#fff8e8', { ol: 0.06 });
  B.add(GEO.cyl(0.07, 0.07, 3, 4), M(x + 1.6, 8.6, z), INKC, { ol: 0 });
  B.add(GEO.box(1.4, 0.8, 0.08), M(x + 2.3, 9.6, z), '#e4572e', { ol: 0.03 });
  for (let i = 0; i < 4; i++) B.add(GEO.box(1.6, 0.14, 0.3), M(x, 0.9 + i * 1.0, z + 2.2, 0, 0.5), COL.wood, { ol: 0 });
  addBoxSolid(x - 1.6, z - 1.6, x + 1.6, z + 1.6);
}
function clockTower(B, x, z, wall, roof, trim, H) {
  B.add(GEO.rbox(6.4, 0.6, 6.4, 0.2, 1), M(x, 0.3, z), '#d9cbb0', { ol: 0.07 });
  B.add(GEO.box(5.2, H, 5.2), M(x, H / 2 + 0.5, z), wall, { ol: 0.12, ao: 0.15 });
  [H * 0.36, H * 0.68].forEach(y => B.add(GEO.box(5.5, 0.4, 5.5), M(x, y, z), trim, { ol: 0 }));
  B.add(GEO.box(5.9, 0.7, 5.9), M(x, H + 0.8, z), trim, { ol: 0.07 });
  B.add(GEO.box(3, 2.4, 5.4), M(x, H - 0.9, z), '#3a2c4a', { ol: 0 });
  B.add(GEO.box(5.4, 2.4, 3), M(x, H - 0.9, z), '#3a2c4a', { ol: 0 });
  B.add(GEO.sph(0.8, 10, 8), M(x, H - 1.2, z), COL.gold, { ol: 0.04 });
  const cy = H * 0.52;
  B.add(GEO.cyl(1.9, 1.9, 0.3, 20), M(x, cy, z + 2.65, 0, Math.PI / 2), '#fff8e8', { ol: 0.07 });
  B.add(GEO.box(0.2, 1.4, 0.1), M(x, cy + 0.55, z + 2.86), INKC, { ol: 0 });
  B.add(GEO.box(1.1, 0.18, 0.1), M(x + 0.45, cy, z + 2.86), INKC, { ol: 0 });
  B.add(GEO.cyl(1.9, 1.9, 0.3, 20), M(x + 2.65, cy, z, 0, 0, Math.PI / 2), '#fff8e8', { ol: 0.07 });
  B.add(GEO.cone(4.6, 5, 4), M(x, H + 3.7, z, Math.PI / 4), roof, { ol: 0.1 });
  B.add(GEO.ico(0.4, 0), M(x, H + 6.4, z), COL.gold, { ol: 0.04 });
  door3(B, x, z + 2.9, COL.woodDark, 2.2, 3.6);
  addBoxSolid(x - 2.9, z - 2.9, x + 2.9, z + 3);
}
function brickHall(B, x, z, w, d, h, seed) {
  const brick = seed % 2 ? '#c8664a' : '#b95c44', zf = z + d / 2;
  B.add(GEO.rbox(w + 1, 0.5, d + 1, 0.25, 1), M(x, 0.25, z), '#d9cbb0', { ol: 0.08 });
  B.add(GEO.rbox(w, h, d, 0.3, 1), M(x, h / 2 + 0.3, z), brick, { ol: 0.13, ao: 0.15 });
  B.add(GEO.box(w + 0.1, 0.35, d + 0.1), M(x, h * 0.5 + 0.4, z), '#f7f1e3', { ol: 0 });
  B.add(GEO.box(w + 0.5, 0.6, d + 0.5), M(x, h + 0.2, z), '#f7f1e3', { ol: 0.06 });
  const n = Math.floor(w / 4.2);
  for (let i = 0; i < n; i++) { const wx0 = x - w / 2 + (i + 0.5) * w / n; [3.2, h * 0.5 + 2.4].forEach((y, row) => { if (row === 0 && Math.abs(wx0 - x) < 2.6) return; window3(B, wx0, y, zf + 0.26, 2, 2.4); B.add(GEO.box(2.4, 0.25, 0.4), M(wx0, y - 1.35, zf + 0.35), '#f7f1e3', { ol: 0 }); }); }
  const rise = gable(B, x, z, w, d, h + 0.5, '#34233f', 0.8, 0.5, brick);
  B.add(GEO.box(2.4, 2.2, 2.4), M(x, h + 0.5 + rise + 0.6, z), '#f7f1e3', { ol: 0.07 });
  B.add(GEO.cone(1.9, 2.2, 4), M(x, h + 0.5 + rise + 2.8, z, Math.PI / 4), '#8fc2b0', { ol: 0.07 });
  door3(B, x, zf + 0.3, '#34233f', 3, 4.4);
  B.add(GEO.prism(4.4, 1, 0.8), M(x, 4.9, zf + 0.5), '#f7f1e3', { ol: 0.05 });
  [[-w / 2 + 1, 2.5], [w / 2 - 1.4, 3.4]].forEach(([dx, y]) => { B.add(GEO.ico(1.3, 1), M(x + dx, y, zf + 0.3, 0, 0, 0, 1, 1.6, 0.5), '#5f9e57', { ol: 0.05 }); });
  addBoxSolid(x - w / 2 - 0.3, z - d / 2 - 0.3, x + w / 2 + 0.3, zf + 0.4);
}
function quad(B, x, z, w, d, trees, seed) {
  B.add(GEO.rrect(w, d, 2.5), M(x, 0.04, z), '#c3e58f', { ol: 0 });
  B.add(GEO.box(w - 1, 0.05, 2.6), M(x, 0.05, z), '#e9d9b0', { ol: 0 });
  B.add(GEO.box(2.6, 0.05, d - 1), M(x, 0.05, z), '#e9d9b0', { ol: 0 });
  B.add(GEO.disc(4.6, 24), M(x, 0.056, z), '#e9d9b0', { ol: 0 });
  B.add(GEO.rbox(2.4, 2.6, 2.4, 0.2, 1), M(x, 1.3, z), '#e9e2d0', { ol: 0.07 });
  B.add(GEO.capsule(0.6, 1.3), M(x, 3.6, z), COL.gold, { ol: 0.06 });
  B.add(GEO.sph(0.55, 10, 8), M(x, 5.1, z), COL.gold, { ol: 0.05 });
  B.add(GEO.box(1.2, 0.2, 1.2), M(x, 5.7, z, 0.4), INKC, { ol: 0 });
  addCircleSolid(x, z, 1.8);
  bench(B, x - 7.5, z + 3.2, 0); bench(B, x + 7.5, z + 3.2, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => trees.push({ kind: 'oak', x: x + sx * w * 0.3, z: z + sz * d * 0.3, s: 0.8, r: seed * 10 + i }));
  [[-1, 1], [1, 1]].forEach(([sx]) => flowerBed(B, x + sx * w * 0.3, z - d * 0.3 + 4.3, 5, 2, ['#c8664a', COL.yellow, '#fff8e8'], seed + sx));
}
function cobbles(B, x, z, w, d, r) {
  B.add(GEO.rrect(w, d, Math.min(w, d) * 0.2), M(x, 0.045, z), '#c9c0b0', { ol: 0 });
  const n = Math.round(w * d / 9);
  for (let i = 0; i < n; i++) B.add(GEO.box(1 + r() * 0.6, 0.04, 0.7 + r() * 0.4), M(x + (r() - 0.5) * (w - 2.4), 0.065, z + (r() - 0.5) * (d - 2.4), r() * 3), r() < 0.5 ? '#b3a898' : '#dcd4c6', { ol: 0 });
}
function stoneWall(B, ax, az, bx, bz, h = 3.4) {   // axis-aligned
  const along = Math.abs(bx - ax) > Math.abs(bz - az), len = along ? Math.abs(bx - ax) : Math.abs(bz - az), mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if (len < 1) return;
  B.add(GEO.box(along ? len : 1.6, h, along ? 1.6 : len), M(mx, h / 2, mz), '#bdb2a4', { ol: 0.1, ao: 0.2 });
  const n = Math.floor(len / 2.2);
  for (let i = 0; i < n; i++) { const t = ((i + 0.5) / n - 0.5) * len; B.add(GEO.box(1.1, 0.9, 1.1), M(mx + (along ? t : 0), h + 0.45, mz + (along ? 0 : t)), '#c9bfb2', { ol: 0.05 }); }
  addBoxSolid(mx - (along ? len / 2 : 0.8), mz - (along ? 0.8 : len / 2), mx + (along ? len / 2 : 0.8), mz + (along ? 0.8 : len / 2));
}
function wallTower(B, x, z, roof) {
  B.add(GEO.cyl(2.5, 2.8, 7, 12), M(x, 3.5, z), '#bdb2a4', { ol: 0.1, ao: 0.2 });
  B.add(GEO.cyl(2.8, 2.8, 0.5, 12), M(x, 7.2, z), '#c9bfb2', { ol: 0.05 });
  B.add(GEO.cone(3, 3.6, 12), M(x, 9.2, z), roof, { ol: 0.09 });
  window3(B, x, 4.6, z + 2.6, 0.9, 1.6);
  addCircleSolid(x, z, 2.9);
}
function well(B, x, z) {
  B.add(GEO.cyl(1.8, 1.9, 1.4, 14), M(x, 0.7, z), '#bdb2a4', { ol: 0.08 });
  B.add(GEO.disc(1.5, 14), M(x, 1.42, z), '#5b7cfa', { ol: 0 });
  [-1.6, 1.6].forEach(dx => B.add(GEO.box(0.3, 3.4, 0.3), M(x + dx, 2.4, z), COL.woodDark, { ol: 0.03 }));
  B.add(GEO.prism(4.2, 1.2, 3), M(x, 4.1, z), '#9a3b2a', { ol: 0.07 });
  addCircleSolid(x, z, 2);
}
function dock(B, x, za, zb, w = 2.6) {   // planks from za to zb along z, over the water
  const z0 = Math.min(za, zb), z1 = Math.max(za, zb), zc = (z0 + z1) / 2;
  B.add(GEO.box(w, 0.3, z1 - z0), M(x, 0.5, zc), COL.wood, { ol: 0.06 });
  for (let k = z0 + 0.7; k < z1 - 0.3; k += 1.1) B.add(GEO.box(w + 0.02, 0.04, 0.08), M(x, 0.66, k), COL.woodDark, { ol: 0 });
  [z0 + 0.4, zc, z1 - 0.4].forEach(pz => [-1, 1].forEach(sd => B.add(GEO.cyl(0.2, 0.2, 1.5, 6), M(x + sd * (w / 2 - 0.1), 0.35, pz), COL.woodDark, { ol: 0.04 })));
  DECKS.push({ x0: x - w / 2 - 0.05, z0, x1: x + w / 2 + 0.05, z1, y: 0.65 });
}
function fallenLog(B, x, z, ry) {
  B.add(GEO.cyl(0.8, 0.8, 5.5, 9), M(x, 0.8, z, ry, 0, Math.PI / 2), '#8a5a34', { ol: 0.07 });
  B.add(GEO.ico(0.5, 0), M(x + 1, 1.7, z, 0), '#8cc45e', { ol: 0.03 });
  const p = { x: x + Math.cos(ry) * 4.5, z: z - Math.sin(ry) * 4.5 };
  B.add(GEO.cyl(0.8, 1.0, 1.0, 9), M(p.x, 0.5, p.z), '#9a6a44', { ol: 0.08 });
  B.add(GEO.disc(0.7, 9), M(p.x, 1.01, p.z), '#f1d3a0', { ol: 0 });
  addCircleSolid(x, z, 1.4); addCircleSolid(p.x, p.z, 1);
}

// what each kind of town builds in its free land (zones in game px from the town's west edge)
const ZN = { ne: [1060, -110, 1990, 840], e: [1600, 850, 1990, 1300], se: [1560, 1830, 1990, 2300], s: [20, 2310, 1990, 2720], sw: [20, 1830, 140, 2300], sand: [20, 2300, 1990, 2400] };
const BEACH_SAND = 2292, BEACH_SHORE = 2418;
const KIND_LOOK = {
  downtown: { trees: 12, kinds: ['oak'], flowers: 40, gap: 90 },
  uptown: { trees: 45, kinds: ['oak', 'oak', 'pine'], flowers: 160, gap: 80, fcols: ['#ff8fb1', '#e4572e', '#fff8e8', '#b98cff'] },
  rural: { trees: 45, kinds: ['oak'], flowers: 130, gap: 85 },
  beach: { trees: 26, kinds: ['palm', 'palm', 'oak'], flowers: 60, gap: 90 },
  mountain: { trees: 120, kinds: ['pine'], flowers: 50, gap: 55 },
  college: { trees: 40, kinds: ['oak', 'oak', 'pine'], flowers: 110, gap: 85 },
  oldtown: { trees: 40, kinds: ['oak', 'pine'], flowers: 100, gap: 85 },
  lake: { trees: 70, kinds: ['pine', 'pine', 'oak'], flowers: 100, gap: 70 },
  desert: { trees: 40, kinds: ['cactus'], flowers: 0, gap: 90, ground: '#e9c98f', patch: ['#e2bd7f', '#f0d29c'] },
  forest: { trees: 170, kinds: ['pine', 'pine', 'pine', 'oak'], flowers: 60, gap: 48 },
};
const TREE_R = { oak: 1.2, pine: 1.2, snowpine: 1.2, palm: 0.7, cactus: 0.8, shroom: 0.45 };
const KIND_BUILD = {
  downtown(B, D, C) {
    const { r, put } = C;
    sidewalks(B, D, '#d8d2c4');
    const WALLS = ['#d6e4f0', '#e9eef5', '#cfd8e3', '#f3eddd', '#e8dcc8', '#dcd3f0', '#c9dbe6'], GLASS = ['#8fd3ee', '#7fb8d8', '#9ff3ff', '#a9c8f0'], made = [];
    for (let i = 0; i < 7; i++) { const tw = 12 + r() * 5, td = 11 + r() * 5, p = put(tw * 10 + 70, td * 10 + 70, [ZN.ne, ZN.ne, ZN.e], { pad: 8 }); if (p) made.push([p, tw, td, 26 + r() * 19]); }
    // further south they stay lower, so they never hide the main road, the lots or you
    for (let i = 0; i < 7; i++) { const tw = 11 + r() * 4, td = 10 + r() * 4, p = put(tw * 10 + 70, td * 10 + 70, [[20, 2390, 1990, 2720]], { pad: 8 }); if (p) made.push([p, tw, td, 13 + r() * 6]); }
    made.forEach(([p, tw, td, h], i) => { const x = wx(p.x), z = wz(p.y); B.add(GEO.rrect(tw + 6, td + 6, 1.5), M(x, 0.045, z), i % 2 ? '#d8d2c4' : '#e3dccb', { ol: 0 }); tower(B, x, z, tw, td, h, WALLS[i % WALLS.length], GLASS[(i * 3) % GLASS.length], r() < 0.5 ? 0 : 1, r); });
    for (let i = 0; i < 2; i++) { const p = put(230, 170, [ZN.ne, ZN.s, ZN.se]); if (!p) continue; const x = wx(p.x), z = wz(p.y); B.add(GEO.rrect(22, 16, 2), M(x, 0.045, z), '#e3dccb', { ol: 0 }); planter(B, x - 6, z - 3.5); planter(B, x + 6, z - 3.5); bench(B, x, z + 2.5, 0); lamp(B, x - 8.5, z + 5); lamp(B, x + 8.5, z + 5); }
    for (let dx = 110; dx < 2000; dx += 200) if (Math.abs(dx - 1000) > 90) lamp(B, wx(D.x0 + dx), wz(1828));
    const bb = put(190, 60, [ZN.e, ZN.ne], { pad: 10 }); if (bb) billboard(B, wx(bb.x), wz(bb.y));
  },
  uptown(B, D, C) {
    const { r, put } = C, WALLS = ['#fff3d6', '#f7e0ff', '#e0f5d0', '#ffe2c6', '#d6f1ff'], ROOFS = ['#5b6b8a', '#34233f', '#8a5a6a', '#6b5a78'];
    for (let i = 0; i < 5; i++) { const p = put(350, 270, [ZN.ne, ZN.s, ZN.se, ZN.ne]); if (p) mansion(B, wx(p.x), wz(p.y), WALLS[i % 5], ROOFS[i % 4], D.k * 10 + i); }
    const t = put(290, 160, [ZN.ne, ZN.s, ZN.e]); if (t) tennis(B, wx(t.x), wz(t.y));
    for (let i = 0; i < 2; i++) { const p = put(80, 80, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) smallFountain(B, wx(p.x), wz(p.y)); }
    for (let i = 0; i < 4; i++) { const p = put(90, 60, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) flowerBed(B, wx(p.x), wz(p.y), 7, 4, ['#e4572e', '#ff8fb1', '#fff8e8'], D.k * 31 + i); }
    for (let i = 0; i < 4; i++) { const p = put(40, 40, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) topiary(B, wx(p.x), wz(p.y), i % 2); }
  },
  rural(B, D, C) {
    const { r, put } = C, CROPS = ['wheat', 'corn', 'cabbage', 'pumpkin'];
    for (let i = 0; i < 5; i++) { const p = put(260, 180, [ZN.ne, ZN.s, ZN.se, ZN.ne]); if (p) cropField(B, wx(p.x), wz(p.y), 22, 14, CROPS[(i + D.k) % 4], D.k * 13 + i); }
    for (let i = 0; i < 2; i++) { const p = put(210, 150, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) { barn(B, wx(p.x) - 2.5, wz(p.y)); silo(B, wx(p.x) + 6.5, wz(p.y) - 1.5, 11); } }
    const wm = put(110, 110, [ZN.ne, ZN.s, ZN.e]); if (wm) windmill(B, wx(wm.x), wz(wm.y));
    for (let i = 0; i < 5; i++) { const p = put(70, 60, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) { hay(B, wx(p.x), wz(p.y), r() * 3); if (r() < 0.5) hay(B, wx(p.x) + 2.8, wz(p.y) + 1, r() * 3); } }
    const tr = put(90, 80, [ZN.s, ZN.se, ZN.ne]); if (tr) tractor(B, wx(tr.x), wz(tr.y), r() * 6, i2c(D.k));
  },
  beach(B, D, C) {
    const { r, put, trees } = C, x0 = wx(D.x0), x1 = wx(D.x1), zs = wz(BEACH_SAND), zEnd = wz(SLAB.y1), mx = (x0 + x1) / 2;
    // sand along the south edge, then the sea beyond a wavy shore: you can swim in it
    B.add(GEO.box(x1 - x0, 0.05, zEnd - zs), M(mx, 0.02, (zs + zEnd) / 2), '#f4e3b5', { ol: 0 });
    const sea = { x0, x1, z0: wz(BEACH_SHORE), z1: zEnd, y: 0.13 };
    SEAS.push(sea);
    [[-2.4, 0.05, '#e6cd98'], [-0.8, 0.1, '#f4fdff'], [0, 0.13, '#8fdcf2'], [5, 0.135, '#6fc3e8'], [14, 0.14, '#5bb2de']].forEach(([off, y, c], i) => B.add(seaGeo(`sea${D.k}.${i}`, sea, off, mx, zEnd), M(mx, y, zEnd), c, { ol: 0 }));
    const HUT = [['#ffd9e0', '#e4572e'], ['#d6f1ff', '#2fa4b5'], ['#fff1a8', '#f08a3c'], ['#e0f5d0', '#8cbf5a']];
    for (let i = 0; i < 4; i++) { const p = put(80, 70, [ZN.sand], { pad: 12 }); if (p) house(B, wx(p.x), wz(p.y) - 0.5, { w: 6, d: 5, h: 3.8, wall: HUT[i][0], roof: HUT[i][1], stripe: '#fff8e8', pitch: 0.5, over: 0.5 }); }
    for (let i = 0; i < 5; i++) { const p = put(70, 60, [ZN.sand], { pad: 6 }); if (!p) continue; const x = wx(p.x), z = wz(p.y), c = ['#ff8fb1', '#8fdcf2', COL.yellow, '#b98cff', '#8cbf5a'][i]; umbrella(B, x, z - 1, c, COL.paper); B.add(GEO.box(2, 0.05, 3.4), M(x + 1.8, 0.08, z + 0.3, 0.2), c, { ol: 0 }); }
    for (let i = 0; i < 3; i++) { const p = put(60, 30, [ZN.sand], { pad: 6 }); if (!p) continue; const x = wx(p.x), z = wz(p.y); ['#e4572e', '#5b7cfa', COL.yellow].forEach((c, j) => surfboard(B, x - 1.6 + j * 1.6, z, c, (j - 1) * 0.15)); }
    const lg = put(60, 50, [[20, 2340, 1990, 2400]], { pad: 4 }); if (lg) lifeguard(B, wx(lg.x), wz(lg.y));
    for (let gx = D.x0 + 60 + r() * 60; gx < D.x1 - 40; gx += 100 + r() * 60) { const gy = 2318 + r() * 24; if (Math.abs(gx - D.x0 - 1000) < 80 || !C.clearRect(gx - 22, gy - 22, gx + 22, gy + 22)) continue; C.taken.push([gx - 15, gy - 15, gx + 15, gy + 15]); trees.push({ kind: 'palm', x: wx(gx), z: wz(gy), s: 0.85 + r() * 0.3, r: Math.floor(gx) }); }
    for (let i = 0; i < 2; i++) { const p = put(40, 40, [ZN.sand], { pad: 4 }); if (!p) continue; const x = wx(p.x), z = wz(p.y); B.add(GEO.cyl(1.2, 1.4, 1.1, 8), M(x, 0.55, z), '#e8cf94', { ol: 0.06 }); [[-1, -1], [1, -1], [0, 1]].forEach(([dx, dz]) => { B.add(GEO.cyl(0.45, 0.5, 1.6, 6), M(x + dx, 1.4, z + dz), '#e8cf94', { ol: 0.05 }); B.add(GEO.cone(0.55, 0.8, 6), M(x + dx, 2.6, z + dz), '#e8cf94', { ol: 0.04 }); }); B.add(GEO.box(0.6, 0.4, 0.05), M(x, 3.4, z + 1), COL.roof, { ol: 0 }); addCircleSolid(x, z, 1.6); }
  },
  mountain(B, D, C) {
    const { r, put, trees } = C, X = dx => wx(D.x0 + dx);
    const hills = [[280, 20, 20, 8], [760, -30, 16, 7], [1480, 340, 25, 8.6], [1770, 110, 19, 7.4], [1800, 650, 16, 7]].map(([dx, gy, h, s]) => ({ x: X(dx), z: wz(gy), h, s }));
    hills.forEach(q => HILLS.push(q));
    terrain(B, 'mtW' + D.k, hills.slice(0, 2), 1.3, paintMountain);
    terrain(B, 'mtE' + D.k, hills.slice(2), 1.3, paintMountain);
    // a ski lift from the valley to the top of the big peak
    const a = { x: X(1290), z: wz(740) }, b = { x: hills[2].x - 1.2, z: hills[2].z + 2 }, N = 5, tops = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = hillH(x, z), end = i === 0 || i === N;
      if (end) { B.add(GEO.rbox(5, 3.4, 4, 0.3, 1), M(x, y + 1.5, z), '#a0673b', { ol: 0.1 }); B.add(GEO.prism(5.8, 1.6, 4.8), M(x, y + 3.3, z), '#fff8e8', { ol: 0.08 }); B.add(GEO.cyl(1.4, 1.4, 0.4, 14), M(x, y + 5.4, z), INKC, { ol: 0 }); addBoxSolid(x - 2.6, z - 2.1, x + 2.6, z + 2.1); tops.push({ x, y: y + 5.4, z }); }
      else { B.add(GEO.cyl(0.25, 0.35, 7.5, 6), M(x, y + 3.7, z), '#5a5f6b', { ol: 0.03 }); B.add(GEO.box(2.6, 0.3, 0.3), M(x, y + 7.4, z, -Math.atan2(b.z - a.z, b.x - a.x) + Math.PI / 2), '#5a5f6b', { ol: 0 }); addCircleSolid(x, z, 0.5); tops.push({ x, y: y + 7.4, z }); }
    }
    for (let i = 0; i < tops.length - 1; i++) {
      const p = tops[i], q = tops[i + 1], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, h = Math.hypot(dx, dz), L = Math.hypot(h, dy), ry = -Math.atan2(dz, dx), rz = Math.atan2(dy, h);
      B.add(GEO.box(L, 0.12, 0.12), M((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2, ry, 0, rz), INKC, { ol: 0 });
      const cxh = (p.x + q.x) / 2, czh = (p.z + q.z) / 2, cyh = (p.y + q.y) / 2;
      B.add(GEO.box(0.1, 1.6, 0.1), M(cxh, cyh - 0.8, czh), INKC, { ol: 0 });
      B.add(GEO.rbox(1.8, 0.3, 1.1, 0.1, 1), M(cxh, cyh - 1.7, czh, ry), ['#e4572e', COL.blue, COL.yellow][i % 3], { ol: 0.04 });
      B.add(GEO.box(1.8, 0.9, 0.2), M(cxh, cyh - 1.3, czh - 0.5, ry), ['#e4572e', COL.blue, COL.yellow][i % 3], { ol: 0.03 });
    }
    // rocks on the slopes, chalets in the valley
    for (let i = 0; i < 16; i++) { const q = hills[i % hills.length], a2 = r() * 6.283, d = q.s * (0.5 + r() * 1.3), x = q.x + Math.cos(a2) * d, z = q.z + Math.sin(a2) * d; if (Math.hypot(x - a.x, z - a.z) < 6) continue; greyRock(B, x, z, 0.7 + r() * 0.7, i, hillH(x, z) - 0.3); }
    const WALL = ['#a0673b', '#b07a4a', '#8a5a34'];
    for (let i = 0; i < 6; i++) { const p = put(110, 100, [ZN.s, ZN.se, ZN.sw, ZN.e, ZN.ne], { flat: true }); if (p) house(B, wx(p.x), wz(p.y), { w: 9, d: 8, h: 4.4, wall: WALL[i % 3], logs: '#7d4a2e', roof: ['#9a3b2a', '#fff8e8', '#5f7f4a'][i % 3], pitch: 0.82, over: 1, chimney: '#8a8f99' }); }
  },
  college(B, D, C) {
    const { r, put, trees } = C;
    const q = put(420, 320, [ZN.ne, ZN.s]);
    if (q) quad(B, wx(q.x), wz(q.y), 38, 28, trees, D.k);
    for (let i = 0; i < 4; i++) { const w = 24 + r() * 6, p = put(w * 10 + 40, 140, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) brickHall(B, wx(p.x), wz(p.y), w, 10, 9 + r() * 2, i); }
    const ct = put(90, 90, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (ct) clockTower(B, wx(ct.x), wz(ct.y), '#c8664a', '#34233f', '#f7f1e3', 20);
    for (let i = 0; i < 3; i++) { const p = put(60, 40, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (p) bench(B, wx(p.x), wz(p.y), 0); }
  },
  oldtown(B, D, C) {
    const { r, put } = C, WALL = ['#fff3d6', '#f7ecd8', '#ffe9d0'], ROOF = ['#9a3b2a', '#6b5a78', '#7d4a2e'];
    for (let i = 0; i < 3; i++) { const p = put(260, 200, [ZN.ne, ZN.s, ZN.se]); if (!p) continue; const x = wx(p.x), z = wz(p.y); cobbles(B, x, z, 24, 18, r); if (i === 0) well(B, x, z); else if (i === 1) smallFountain(B, x, z); else { bench(B, x - 4, z, 0); bench(B, x + 4, z, 0); } }
    for (let i = 0; i < 8; i++) { const p = put(120, 110, [ZN.ne, ZN.s, ZN.se, ZN.e, ZN.sw]); if (!p) continue; const x = wx(p.x), z = wz(p.y); cobbles(B, x, z + 5.5, 11, 3, r); house(B, x, z - 0.5, { w: 9, d: 7.5, h: 6.4, wall: WALL[i % 3], timber: '#5a3b28', roof: ROOF[i % 3], pitch: 0.9, over: 0.6, chimney: '#8a8f99' }); }
    const ct = put(90, 90, [ZN.ne, ZN.s, ZN.se, ZN.e]); if (ct) clockTower(B, wx(ct.x), wz(ct.y), '#cfc6b8', '#5b7cfa', '#e9e2d0', 18);
    // the old city wall along the south edge, with a gate where the road goes through, and a piece in the north-east
    const zw = wz(2668), rx = wx(D.x0 + 1000);
    stoneWall(B, wx(D.x0) + 1, zw, rx - 7, zw); stoneWall(B, rx + 7, zw, wx(D.x1) - 1, zw);
    wallTower(B, rx - 7, zw, '#9a3b2a'); wallTower(B, rx + 7, zw, '#9a3b2a');
    const nw = put(420, 50, [[1400, -120, 1990, 60]], { pad: 4 }); if (nw) { stoneWall(B, wx(nw.x - 200), wz(nw.y), wx(nw.x + 200), wz(nw.y)); wallTower(B, wx(nw.x + 200), wz(nw.y), '#6b5a78'); }
  },
  lake(B, D, C) {
    const { r, put } = C;
    for (let i = 0; i < 6; i++) { const p = put(120, 110, [ZN.ne, ZN.s, ZN.se, ZN.e, ZN.sw]); if (p) house(B, wx(p.x), wz(p.y), { w: 10, d: 8, h: 4.6, wall: '#b07a4a', logs: '#8a5a34', roof: ['#5f7f4a', '#2fa4b5', '#9a3b2a'][i % 3], pitch: 0.62, chimney: '#8a8f99' }); }
    if (D.nature === 'lake') {
      const cx = wx(D.nat.x), cz = wz(D.nat.y);
      dock(B, cx + 9, cz - 18, cz - 8.5);
      rowboat(B, cx + 12, 0.1, cz - 10.4, Math.PI / 2, '#e4572e'); addCircleSolid(cx + 12, cz - 10.4, 1.6);
      rowboat(B, cx - 7, 0.1, cz + 3, 0.5, '#5b7cfa'); addCircleSolid(cx - 7, cz + 3, 2);
      rowboat(B, cx + 5, 0.1, cz + 7.5, -0.7, '#fff8e8'); addCircleSolid(cx + 5, cz + 7.5, 2);
      [[-27.5, 1.5], [-26.5, 5], [26.5, -5]].forEach(([dx, dz], i) => { rowboat(B, cx + dx, 0.2, cz + dz, 1.4 + i * 0.3, ['#f4b942', '#8cbf5a', '#ff8fb1'][i]); addCircleSolid(cx + dx, cz + dz, 1.8); });
    }
  },
  desert(B, D, C) {
    const { r, put } = C;
    // the tall rocks stay in the north and far south, so they never hide the road, the lots or you
    const FAR = [20, 2470, 1990, 2730];
    for (let i = 0; i < 5; i++) { const rr = 5 + r() * 4, p = put(rr * 22 + 40, rr * 22 + 40, [ZN.ne, ZN.e, FAR]); if (p) mesa(B, wx(p.x), wz(p.y), rr, 7 + r() * 9, i + D.k); }
    for (let i = 0; i < 2; i++) { const p = put(150, 70, [ZN.ne, FAR, ZN.e]); if (p) redArch(B, wx(p.x), wz(p.y), (r() - 0.5) * 0.6); }
    for (let i = 0; i < 14; i++) { const p = put(40, 40, [ZN.ne, ZN.s, ZN.se, ZN.e, ZN.sw], { pad: 6 }); if (p) redRock(B, wx(p.x), wz(p.y), 0.6 + r() * 0.8, i); }
    const wt = put(80, 80, [ZN.s, ZN.se, ZN.e]);
    if (wt) { const x = wx(wt.x), z = wz(wt.y); [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].forEach(([dx, dz]) => B.add(GEO.box(0.35, 7, 0.35), M(x + dx, 3.5, z + dz), COL.woodDark, { ol: 0.04 })); B.add(GEO.cyl(2.6, 2.6, 3.4, 12), M(x, 8.6, z), '#b07a4a', { ol: 0.1 }); B.add(GEO.cone(2.9, 1.6, 12), M(x, 11.1, z), '#8a5a34', { ol: 0.08 }); addBoxSolid(x - 2, z - 2, x + 2, z + 2); }
  },
  forest(B, D, C) {
    const { r, put, trees } = C;
    for (let i = 0; i < 4; i++) { const p = put(120, 110, [ZN.ne, ZN.s, ZN.se, ZN.e, ZN.sw]); if (p) house(B, wx(p.x), wz(p.y), { w: 10, d: 8, h: 4.6, wall: '#9a6a44', logs: '#7d4a2e', roof: '#5f7f4a', pitch: 0.7, chimney: '#8a8f99' }); }
    for (let i = 0; i < 6; i++) { const p = put(90, 50, [ZN.ne, ZN.s, ZN.se, ZN.e], { pad: 6 }); if (p) fallenLog(B, wx(p.x), wz(p.y), r() * 3); }
    for (let i = 0, n = 0; i < 400 && n < 60; i++) { const gx = D.x0 + 30 + r() * (T.DW - 60), gy = SLAB.y0 + 250 + r() * (SLAB.y1 - SLAB.y0 - 320); if (C.decorBlocked(gx, gy, 10)) continue; n++; trees.push({ kind: 'shroom', x: wx(gx), z: wz(gy), s: 0.6 + r() * 0.7, r: i }); }
  },
};
const i2c = (k) => ['#e4572e', '#8cbf5a', '#5b7cfa', '#f4b942'][k % 4];
// the sea's top edge follows the wavy shore; off moves it (negative = up the beach)
function seaGeo(key, sea, off, mx, zEnd) {
  return prep(key, () => {
    const s = new THREE.Shape();
    s.moveTo(sea.x0 - mx, 0);
    for (let x = sea.x0; x <= sea.x1 + 0.01; x += 1.25) s.lineTo(x - mx, -(shoreZ(sea, x) + off - zEnd));
    s.lineTo(sea.x1 - mx, 0);
    return new THREE.ShapeGeometry(s, 1).rotateX(-Math.PI / 2);
  });
}

/* ------------------------------------------------------------------ the welcome gate on the main road */
const GATE = { downtown: ['#9aa3b5', '#5b7cfa'], uptown: ['#f7f1e3', '#b98cff'], rural: ['#c98a52', '#e4572e'], beach: ['#fff8e8', '#2fa4b5'], mountain: ['#8a8f99', '#fff8e8'],
  college: ['#c8664a', '#34233f'], oldtown: ['#bdb2a4', '#9a3b2a'], lake: ['#b07a4a', '#2fa4b5'], desert: ['#d9895a', '#c8643c'], forest: ['#8a5a34', '#5f9e57'] };
function buildGate(B, D) {
  const [post, top] = GATE[D.kind] || GATE.rural, x = wx(D.gate.x), z = wz(D.gate.y), H = 11.2;
  [-1, 1].forEach(sd => {
    const pz = z + sd * 6.4;
    B.add(GEO.rbox(2.6, 0.8, 2.6, 0.2, 1), M(x, 0.4, pz), '#d9cbb0', { ol: 0.07 });
    B.add(GEO.rbox(1.8, H, 1.8, 0.3, 1), M(x, H / 2 + 0.5, pz), post, { ol: 0.1, ao: 0.15 });
    B.add(GEO.cone(1.5, 1.8, 4), M(x, H + 2.3, pz, Math.PI / 4), top, { ol: 0.07 });
    addCircleSolid(x, pz, 1.4);
  });
  B.add(GEO.box(1.6, 1.3, 15.6), M(x, H + 0.6, z), top, { ol: 0.1 });   // bottom at ~11.1: the bus and the train fit under it
  const FL = ['#ff8fb1', COL.yellow, '#8fdcf2', '#b98cff', '#8cbf5a'];
  for (let i = 0; i < 9; i++) B.add(GEO.cone(0.4, 0.9, 3), M(x, H - 0.3, z - 5.6 + i * 1.4, 0, Math.PI), FL[i % FL.length], { ol: 0.03 });
  sign(B, x, H + 2.75, z, `${D.icon} ${D.name}`, { th: 1.9 });
}

/* ------------------------------------------------------------------ a Small World Garden in every town, with the logo in the middle */
let logoTex = null;
const logoMats = new Map();
function logoMark(gx, gy, w, tint = '#ffffff', y = 0.05) {
  if (!logoTex) { logoTex = new THREE.TextureLoader().load('icons/smallworld-mark.png'); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8; }
  let mat = logoMats.get(tint);
  if (!mat) { mat = new THREE.MeshToonMaterial({ map: logoTex, color: tint, gradientMap: ramp, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }); logoMats.set(tint, mat); }
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(w * S, w * 228 / 640 * S).rotateX(-Math.PI / 2), mat);
  mark.position.set(wx(gx), y, wz(gy)); mark.receiveShadow = true; mark.renderOrder = -1;
  scene.add(mark);
  return mark;
}
const GARDEN = {
  downtown: { floor: '#dcd5c6', border: 'planter', flowers: ['#ff8fb1', '#fff8e8', COL.yellow], accent: 'planters' },
  uptown: { floor: '#c6e89a', border: 'hedge', flowers: ['#e4572e', '#ff8fb1', '#fff8e8'], accent: 'topiary' },
  rural: { floor: '#c3e58f', border: 'picket', flowers: [COL.yellow, '#ff9f6b', '#fff8e8'], accent: 'sunflowers' },
  beach: { floor: '#f4e3b5', border: 'rope', flowers: ['#ff8fb1', '#8fdcf2', COL.yellow], accent: 'palms', tint: '#fff4dc' },
  mountain: { floor: '#e8f0f6', border: 'stone', flowers: ['#b98cff', '#fff8e8', '#8fdcf2'], accent: 'snowpines', tint: '#eaf4ff' },
  college: { floor: '#c3e58f', border: 'hedge', flowers: ['#c8664a', COL.yellow, '#fff8e8'], accent: 'topiary' },
  oldtown: { floor: '#d8d0c2', border: 'stone', flowers: ['#e4572e', '#ff8fb1', '#b98cff'], accent: 'urns' },
  lake: { floor: '#bfe38a', border: 'hedge', flowers: ['#8fdcf2', '#b98cff', '#fff8e8'], accent: 'pond' },
  desert: { floor: '#ecd3a2', border: 'adobe', flowers: ['#ff8fb1', COL.yellow], accent: 'cacti', tint: '#fff0d8' },
  forest: { floor: '#a9d27a', border: 'log', flowers: ['#fff8e8', '#b98cff'], accent: 'shrooms' },
};
function gardenBorder(B, ax, az, bx, bz, kind) {
  const along = Math.abs(bx - ax) > Math.abs(bz - az), len = along ? Math.abs(bx - ax) : Math.abs(bz - az);
  if (len < 0.5) return;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, bw = along ? len : 1.1, bd = along ? 1.1 : len;
  switch (kind) {
    case 'picket': {
      const n = Math.round(len / 0.75);
      for (let i = 0; i <= n; i++) { const t = i / n - 0.5, px = mx + (along ? t * len : 0), pz = mz + (along ? 0 : t * len); B.add(GEO.box(0.32, 1.4, 0.18), M(px, 0.7, pz), '#fff8e8', { ol: 0.03 }); }
      [0.5, 1.1].forEach(y => B.add(GEO.box(along ? len : 0.14, 0.18, along ? 0.14 : len), M(mx, y, mz), '#fff8e8', { ol: 0.02 }));
      break;
    }
    case 'rope': {
      const n = Math.max(1, Math.round(len / 3));
      for (let i = 0; i <= n; i++) { const t = i / n - 0.5; B.add(GEO.cyl(0.22, 0.26, 1.6, 6), M(mx + (along ? t * len : 0), 0.8, mz + (along ? 0 : t * len)), COL.wood, { ol: 0.04 }); }
      B.add(GEO.box(along ? len : 0.12, 0.12, along ? 0.12 : len), M(mx, 1.3, mz), '#e0c070', { ol: 0 });
      break;
    }
    case 'stone': B.add(GEO.rbox(bw, 1.1, bd, 0.3, 1), M(mx, 0.55, mz), '#bdb2a4', { ol: 0.08, ao: 0.2 }); break;
    case 'adobe': B.add(GEO.rbox(bw, 1.2, bd, 0.45, 1), M(mx, 0.6, mz), '#e0a878', { ol: 0.08, ao: 0.15 }); break;
    case 'log': B.add(GEO.cyl(0.55, 0.55, len, 8), M(mx, 0.55, mz, along ? 0 : Math.PI / 2, 0, Math.PI / 2), '#8a5a34', { ol: 0.06 }); break;
    case 'planter': B.add(GEO.rbox(bw, 1.1, bd, 0.2, 1), M(mx, 0.55, mz), '#cfc6b4', { ol: 0.07 }); B.add(GEO.rbox(along ? len - 0.4 : 0.8, 0.9, along ? 0.8 : len - 0.4, 0.4, 1), M(mx, 1.3, mz), '#7fbf55', { ol: 0.06 }); break;
    default: B.add(GEO.rbox(bw, 1.5, bd, 0.5, 1), M(mx, 0.75, mz), '#6fae4a', { ol: 0.09, ao: 0.18 });
  }
  addBoxSolid(mx - bw / 2, mz - bd / 2, mx + bw / 2, mz + bd / 2);
}
function buildGarden(B, g, kindName, trees) {
  const K = GARDEN[kindName] || GARDEN.uptown, x0 = wx(g.x - g.w / 2), x1 = wx(g.x + g.w / 2), z0 = wz(g.y - g.h / 2), z1 = wz(g.y + g.h / 2);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, gap = 3.4, lz = cz + 1;
  B.add(GEO.rrect(w, d, 2), M(cx, 0.036, cz), K.floor, { ol: 0 });
  gardenBorder(B, x0, z0, cx - gap, z0, K.border); gardenBorder(B, cx + gap, z0, x1, z0, K.border);
  gardenBorder(B, x0, z0, x0, z1, K.border); gardenBorder(B, x1, z0, x1, z1, K.border); gardenBorder(B, x0, z1, x1, z1, K.border);
  [-1, 1].forEach(sd => { B.add(GEO.rbox(1.4, 2.2, 1.4, 0.2, 1), M(cx + sd * gap, 1.1, z0), '#e9e2d0', { ol: 0.06 }); B.add(GEO.sph(0.6, 10, 6), M(cx + sd * gap, 2.5, z0), K.flowers[0], { ol: 0.04 }); addCircleSolid(cx + sd * gap, z0, 0.9); });
  const path = kindName === 'desert' || kindName === 'beach' ? '#e0c792' : '#e9d9b0';
  B.add(GEO.box(4, 0.05, lz - 4.5 - z0), M(cx, 0.045, (z0 + lz - 4.5) / 2), path, { ol: 0 });
  B.add(GEO.rrect(24, 10, 3), M(cx, 0.042, lz), path, { ol: 0 });
  B.add(GEO.rrect(22, 8.6, 2.6), M(cx, 0.048, lz), kindName === 'desert' ? '#f3e2bd' : '#eef6dd', { ol: 0 });
  logoMark(gxOf(cx), gyOf(lz), 190, K.tint || '#ffffff', 0.06);
  // four corner beds in the town's style, benches facing the logo, the sign by the gate
  const corners = [[x0 + 4.6, z0 + 5.4], [x1 - 4.6, z0 + 5.4], [x0 + 4.6, z1 - 5.4], [x1 - 4.6, z1 - 5.4]];
  corners.forEach(([bx, bz], i) => {
    const seed = hash(kindName) + i;
    switch (K.accent) {
      case 'topiary': flowerBed(B, bx, bz, 6, 4.4, K.flowers, seed); topiary(B, bx, bz, i % 2); break;
      case 'sunflowers': flowerBed(B, bx, bz, 6, 4.4, K.flowers, seed); for (let k = 0; k < 4; k++) sunflower(B, bx - 1.8 + k * 1.2, bz - 1 + (k % 2) * 1.4, 3 + (k % 2) * 0.8); break;
      case 'palms': B.add(GEO.disc(2.8, 16), M(bx, 0.05, bz), '#e8cf94', { ol: 0 }); if (i >= 2) trees.push({ kind: 'palm', x: bx, z: bz, s: 0.75, r: seed }); else for (let k = 0; k < 4; k++) B.add(GEO.sph(0.4, 8, 5, true), M(bx - 1.2 + k * 0.8, 0.06, bz + (k % 2) * 0.8), ['#ffd9e0', '#fff8e8', '#ffe2c6'][k % 3], { ol: 0.03 }); break;
      case 'snowpines': trees.push({ kind: 'snowpine', x: bx, z: bz, s: 0.55, r: seed }); greyRock(B, bx + 2.4, bz + 1.2, 0.5, i); break;
      case 'urns': flowerBed(B, bx, bz, 6, 4.4, K.flowers, seed, '#8a6a5a'); B.add(GEO.cyl(0.9, 0.6, 1.4, 12), M(bx, 1.1, bz), '#cfc6b8', { ol: 0.06 }); B.add(GEO.ico(0.9, 1), M(bx, 2.2, bz), '#e4572e', { ol: 0.05 }); addCircleSolid(bx, bz, 1); break;
      case 'pond': if (i >= 2) { B.add(GEO.disc(1, 20), M(bx, 0.05, bz, 0, 0, 0, 3.4, 1, 2.4), '#e9d9b0', { ol: 0 }); B.add(GEO.disc(1, 20), M(bx, 0.07, bz, 0, 0, 0, 2.8, 1, 1.9), '#7fd0ea', { ol: 0 }); B.add(GEO.lily(0.6), M(bx + 0.8, 0.09, bz, 1), '#8cc45e', { ol: 0 }); addCircleSolid(bx, bz, 2.4); } else flowerBed(B, bx, bz, 6, 4.4, K.flowers, seed); break;
      case 'cacti': B.add(GEO.disc(2.6, 14), M(bx, 0.05, bz), '#e0c792', { ol: 0 }); trees.push({ kind: 'cactus', x: bx, z: bz, s: 0.6 + (i % 2) * 0.15, r: seed }); redRock(B, bx + 2, bz + 1, 0.4, i); break;
      case 'shrooms': B.add(GEO.disc(2.6, 14), M(bx, 0.05, bz), '#8fbf5e', { ol: 0 }); [[0, 0, 0.9], [1.4, 0.8, 0.6], [-1.3, 0.6, 0.55]].forEach(([dx, dz, s], k) => trees.push({ kind: 'shroom', x: bx + dx, z: bz + dz, s, r: seed + k })); break;
      case 'planters': planter(B, bx, bz); B.add(GEO.rrect(6, 4.4, 1), M(bx, 0.05, bz), '#cfc6b4', { ol: 0 }); break;
      default: flowerBed(B, bx, bz, 6, 4.4, K.flowers, seed);
    }
  });
  bench(B, x0 + 2.2, lz, Math.PI / 2); bench(B, x1 - 2.2, lz, -Math.PI / 2);
  sign(B, cx - 8.2, 2.8, z0 + 1.6, '🌱 Small World Garden', { post: true, th: 1.3 });
}
function buildOldGarden() {
  // the logo lawn beside the plaza, now a garden: hedges on three sides, open to the plaza
  const g = T.GARDEN0 || { x: LOGO.x, y: LOGO.y, w: 300, h: 190 }, B = W;
  const x0 = wx(4400), x1 = wx(Math.min(g.x + g.w / 2, 4644)), z0 = wz(1247), z1 = wz(1393), lx = wx(LOGO.x), lz = wz(LOGO.y);
  B.add(GEO.rrect(LOGO.w * S + 3, LOGO.h * S + 2.6, 1.8), M(lx, 0.034, lz), '#e9f4d4', { ol: 0 });
  hedgeLine(B, x0, z0, x1, z0, { t: 1.1, h: 1.4 }); hedgeLine(B, x0, z0, x0, z1, { t: 1.1, h: 1.4 }); hedgeLine(B, x0, z1, x1, z1, { t: 1.1, h: 1.2 });
  [[x1, z0], [x1, z1]].forEach(([px, pz]) => { B.add(GEO.rbox(1.4, 2.2, 1.4, 0.2, 1), M(px, 1.1, pz), '#e9e2d0', { ol: 0.06 }); B.add(GEO.sph(0.6, 10, 6), M(px, 2.5, pz), '#ff8fb1', { ol: 0.04 }); addCircleSolid(px, pz, 0.9); });
  flowerBed(B, wx(4488), wz(1268), 7, 3, ['#ff8fb1', COL.yellow, '#b98cff'], 901);
  flowerBed(B, wx(4600), wz(1268), 7, 3, ['#ff8fb1', COL.yellow, '#b98cff'], 902);
  topiary(B, wx(4544), wz(1266), false);
  bench(B, wx(4424), lz, Math.PI / 2);
  sign(B, wx(4430), 2.9, wz(1262), '🌱 Small World Garden', { th: 1.2 });
  B.add(GEO.box(0.3, 1.8, 0.3), M(wx(4430), 0.9, wz(1262) - 0.3), COL.woodDark, { ol: 0.04 });
}

/* ------------------------------------------------------------------ gathering: cows, hens, apple trees and ore rocks */
function cow(B, x, z, ry) {
  const r = new THREE.Matrix4().makeRotationY(ry), put = (e, dx, y, dz, c, o = {}) => { const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(r); B.add(e, M(x + p.x, y, z + p.z, ry, 0, o.rz || 0, o.sx || 1, o.sy || o.sx || 1, o.sz || o.sx || 1), c, { ol: o.ol ?? 0.07 }); };
  put(GEO.rbox(3.4, 1.8, 1.8, 0.6, 1), 0, 2.2, 0, '#fff8e8', { ol: 0.09 });
  [[-0.6, 2.6, 0.92], [0.8, 2.0, -0.92], [0.3, 3.1, 0.2]].forEach(([dx, y, dz]) => put(GEO.sph(0.5, 8, 6), dx, y, dz, INKC, { sx: 1.3, sy: 0.8, sz: 0.3, ol: 0 }));
  put(GEO.rbox(1.3, 1.2, 1.3, 0.35, 1), 2.1, 2.9, 0, '#fff8e8', { ol: 0.07 });
  put(GEO.rbox(0.5, 0.7, 1.1, 0.2, 1), 2.8, 2.6, 0, '#ffb3c8', { ol: 0.04 });
  [-0.45, 0.45].forEach(dz => { put(GEO.cone(0.14, 0.5, 5), 2.1, 3.7, dz, '#f4dca0', { ol: 0.02 }); put(GEO.sph(0.1, 6, 4), 2.6, 3.15, dz * 0.9, INKC, { ol: 0 }); put(GEO.box(0.2, 0.3, 0.5), 1.7, 3.3, dz * 1.7, '#fff8e8', { ol: 0.02 }); });
  [[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]].forEach(([dx, dz]) => put(GEO.cyl(0.24, 0.22, 1.4, 6), dx, 0.7, dz, '#fff8e8', { ol: 0.04 }));
  put(GEO.box(0.12, 1.4, 0.12), -1.8, 2.0, 0, INKC, { rz: 0.3, ol: 0 });
  put(GEO.sph(0.45, 8, 6), 0.2, 1.2, 0, '#ffb3c8', { ol: 0.03 });
  addCircleSolid(x, z, 1.5);
}
function hen(B, x, z, ry) {
  const r = new THREE.Matrix4().makeRotationY(ry), put = (e, dx, y, dz, c, o = {}) => { const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(r); B.add(e, M(x + p.x, y, z + p.z, ry, 0, o.rz || 0, o.sx || 1, o.sy || o.sx || 1, o.sz || o.sx || 1), c, { ol: o.ol ?? 0.05 }); };
  put(GEO.sph(0.75, 10, 8), 0, 1.1, 0, '#fff8e8', { sx: 1.2, sy: 1, sz: 0.95 });
  put(GEO.sph(0.45, 10, 8), 0.7, 1.9, 0, '#fff8e8');
  put(GEO.box(0.3, 0.35, 0.12), 0.7, 2.4, 0, '#e4572e', { ol: 0.02 });
  put(GEO.cone(0.14, 0.35, 5), 1.15, 1.9, 0, COL.gold, { rz: -Math.PI / 2, ol: 0.02 });
  put(GEO.cone(0.3, 0.6, 5), -0.9, 1.4, 0, '#fff8e8', { rz: 0.9, ol: 0.03 });
  [-0.2, 0.2].forEach(dz => { put(GEO.cyl(0.06, 0.06, 0.6, 4), 0, 0.3, dz, COL.gold, { ol: 0 }); put(GEO.sph(0.07, 6, 4), 0.95, 2.0, dz * 1.3, INKC, { ol: 0 }); });
  const p = nestOf(x, z);
  B.add(GEO.torus(0.55, 0.26, 12), M(p.x, 0.25, p.z), '#e0c070', { ol: 0.03 });
  B.add(GEO.disc(0.5, 10), M(p.x, 0.12, p.z), '#c9a04a', { ol: 0 });
  addCircleSolid(x, z, 0.8);
}
const nestOf = (x, z) => ({ x: x + 0.4, z: z + 1.45 });
function appleTree(B, x, z) {
  B.add(GEO.cyl(0.45, 0.65, 3.2, 7), M(x, 1.6, z), '#9a6a44', { ol: 0.09, ao: 0.2 });
  B.add(GEO.ico(2.5, 1), M(x, 4.7, z), '#7fbb52', { ol: 0.12 });
  B.add(GEO.ico(1.7, 1), M(x + 1.5, 4.1, z + 0.5), '#8cc45e', { ol: 0.1 });
  B.add(GEO.ico(1.6, 1), M(x - 1.5, 4.2, z - 0.2), '#94cc66', { ol: 0.1 });
  addCircleSolid(x, z, 0.9);
}
const APPLE_AT = [[0.9, 5.9, 1.9], [-1.2, 5.2, 1.9], [2.3, 4.6, 1.6], [-2.4, 4.1, 1.1], [0.2, 4.0, 2.4], [1.4, 3.5, 1.9], [-0.6, 6.7, 1.2]];
function oreRock(B, x, z, seed) {
  B.add(GEO.ico(1.9, 0), M(x, 0.9, z, seed, 0, 0, 1.15, 0.8, 1), '#9a8f86', { ol: 0.1 });
  B.add(GEO.ico(1.0, 0), M(x + 1.5, 0.5, z + 0.8, seed + 1), '#b8aca0', { ol: 0.06 });
  B.add(GEO.ico(0.7, 0), M(x - 1.6, 0.35, z + 0.9, seed + 2), '#a89c90', { ol: 0.05 });
  [[0.8, 1.5, 1.1], [-0.6, 1.1, 1.2]].forEach(([dx, y, dz]) => B.add(GEO.ico(0.2, 0), M(x + dx, y, z + dz), '#6b5a78', { ol: 0 }));
  addCircleSolid(x, z, 1.9);
}
function buildWorkStatic(B, D) {
  const byPlace = {};
  D.work.forEach(w => (byPlace[w.place] = byPlace[w.place] || []).push(w));
  Object.entries(byPlace).forEach(([place, list]) => {
    const xs = list.map(w => wx(w.x)), zN = wz(1382), zS = wz(1446), xa = Math.min(...xs) - 5.5, xb = Math.max(...xs) + 5.5, zc = wz(list[0].y);
    if (place === 'ranch') {
      B.add(GEO.rrect(xb - xa, zS - zN + 3, 2), M((xa + xb) / 2, 0.035, (zN + zS) / 2 + 1.5), '#c8d98a', { ol: 0 });
      fenceLine(B, xa, zN, xb, zN); fenceLine(B, xa, zN, xa, zS); fenceLine(B, xb, zN, xb, zS);
      const hens = list.filter(w => w.type === 'hen');
      if (hens.length) { const hx = hens.reduce((a, w) => a + wx(w.x), 0) / hens.length; house(B, hx, zN + 2.2, { w: 3.6, d: 2.6, h: 2.2, wall: '#fff3d6', roof: '#e4572e', pitch: 0.6, over: 0.3, base: '#c9a06a' }); }
      B.add(GEO.cyl(1.2, 1.1, 0.8, 12), M(xa + 1.7, 0.4, zN + 1.5), '#9aa3b5', { ol: 0.06 }); B.add(GEO.disc(1.05, 12), M(xa + 1.7, 0.78, zN + 1.5), '#8fdcf2', { ol: 0 }); addCircleSolid(xa + 1.7, zN + 1.5, 1.2);
    } else if (place === 'orchard') {
      B.add(GEO.rrect(xb - xa, 9, 2), M((xa + xb) / 2, 0.035, zc), '#b5d97a', { ol: 0 });
      fenceLine(B, xa, zN + 0.2, xb, zN + 0.2, '#fff8e8', '#fff8e8');
      [[xa - 1, zc + 3.2], [xb + 1, zc + 3.4]].forEach(([x, z]) => { B.add(GEO.box(2, 1.1, 1.5), M(x, 0.55, z), COL.wood, { ol: 0.06 }); for (let k = 0; k < 3; k++) B.add(GEO.ico(0.38, 1), M(x - 0.55 + k * 0.55, 1.3, z), '#e4572e', { ol: 0.03 }); addCircleSolid(x, z, 1.1); });
    } else if (place === 'mine') {
      B.add(GEO.rrect(xb - xa, 10, 2.5), M((xa + xb) / 2, 0.035, zc), '#c9bfb2', { ol: 0 });
      [-0.6, 0.6].forEach(dz => B.add(GEO.box(xb - xa - 2, 0.14, 0.18), M((xa + xb) / 2, 0.12, zc + 3.2 + dz), '#8a8f99', { ol: 0 }));
      for (let x = xa + 1.5; x < xb - 1; x += 1.3) B.add(GEO.box(0.4, 0.08, 1.8), M(x, 0.07, zc + 3.2), COL.woodDark, { ol: 0 });
      B.add(GEO.rbox(2.4, 1.2, 1.8, 0.3, 1), M(xb - 2, 1.0, zc + 3.2), '#8a8f99', { ol: 0.07 }); [-0.8, 0.8].forEach(dx => B.add(GEO.cyl(0.35, 0.35, 2, 8), M(xb - 2 + dx, 0.4, zc + 3.2, 0, Math.PI / 2), INKC, { ol: 0 })); addCircleSolid(xb - 2, zc + 3.2, 1.3);
    }
    list.forEach((w, i) => {
      const x = wx(w.x), z = wz(w.y), ry = i % 2 ? Math.PI - 0.3 : 0.3;
      if (w.type === 'cow') cow(B, x, z, ry);
      else if (w.type === 'hen') hen(B, x, z, i % 2 ? 0.5 : -0.5 + Math.PI);
      else if (w.type === 'apple') appleTree(B, x, z);
      else if (w.type === 'ore') oreRock(B, x, z, i);
    });
  });
}
// what is ready to gather right now, shown on top of the static animals, trees and rocks
function buildWorkState(B, D, mask) {
  D.work.forEach((w, i) => {
    if (!(mask & (1 << i))) return;
    const x = wx(w.x), z = wz(w.y);
    if (w.type === 'apple') APPLE_AT.forEach(([dx, y, dz], k) => { B.add(GEO.ico(0.36, 1), M(x + dx, y, z + dz), '#e4572e', { ol: 0.04 }); if (k % 3 === 0) B.add(GEO.box(0.06, 0.25, 0.06), M(x + dx, y + 0.4, z + dz), COL.woodDark, { ol: 0 }); });
    else if (w.type === 'ore') { [[0, 2.0, 0.3, 0.55, 1.6, 0], [0.55, 1.75, 0.6, 0.4, 1.1, 0.4], [-0.5, 1.7, 0.7, 0.35, 1.0, -0.4]].forEach(([dx, y, dz, r, h, a]) => B.add(GEO.cone(r, h, 5), M(x + dx, y + h * 0.3, z + dz, a, 0, a * 0.5), '#ffd23f', { ol: 0.05 })); B.add(GEO.ico(0.3, 0), M(x - 0.9, 2.9, z + 0.6), '#fff8e8', { ol: 0 }); B.add(GEO.ico(0.22, 0), M(x + 1.1, 3.2, z + 0.4), '#fff8e8', { ol: 0 }); }
    else if (w.type === 'hen') { const n = nestOf(x, z); B.add(GEO.sph(0.42, 10, 8), M(n.x - 0.15, 0.62, n.z, 0, 0.2, 0, 1, 1.3, 1), '#fff8e8', { ol: 0.05 }); B.add(GEO.sph(0.36, 10, 8), M(n.x + 0.35, 0.55, n.z + 0.1, 0, -0.3, 0, 1, 1.3, 1), '#f4dca0', { ol: 0.05 }); }
    else if (w.type === 'cow') {
      B.add(GEO.cyl(0.42, 0.46, 1.1, 10), M(x, 5.4, z), '#ffffff', { ol: 0.05 });
      B.add(GEO.cyl(0.24, 0.34, 0.4, 10), M(x, 6.15, z), '#ffffff', { ol: 0.04 });
      B.add(GEO.cyl(0.27, 0.27, 0.2, 10), M(x, 6.45, z), COL.blue, { ol: 0.03 });
      B.add(GEO.box(0.86, 0.35, 0.05), M(x, 5.3, z + 0.44), '#8fdcf2', { ol: 0 });
      [[-1, 6.3, 0.3], [1.05, 5.1, 0.2], [0.8, 6.8, 0.15]].forEach(([dx, y, s]) => B.add(GEO.star(s * 2.2, s, 0.08), M(x + dx, y, z + 0.3), COL.yellow, { ol: 0 }));
    }
  });
}
const workMask = new Map();
let workT = 0;
function updateWork() {
  const town = townNow, now = hooks.now(), wk = town && town.work;
  for (const k of builtDistricts) {
    const D = T.district(k), list = D.work;
    if (!list.length) continue;
    let m = 0;
    for (let i = 0; i < list.length; i++) { const t = wk ? wk[list[i].id] : 0; if (!t || now - t >= T.WORK_REGROW) m |= 1 << i; }
    if (workMask.get(k) === m) continue;
    workMask.set(k, m);
    setPart('work:' + k, m, B => buildWorkState(B, D, m));
  }
}

// instanced kits for the new kinds of trees: palms, cactus, mushrooms, snowy pines
function ensureKits() {
  if (TK.palm || !TK.oak) return;
  const palmK = new Builder(); palmParts(palmK, 0, 0);
  const cactus = new Builder();
  cactus.add(GEO.capsule(0.62, 4.2), M(0, 2.7, 0), '#6fae5a', { ol: 0.1 });
  cactus.add(GEO.cyl(0.36, 0.36, 1.4, 7), M(1.0, 2.4, 0, 0, 0, Math.PI / 2), '#6fae5a', { ol: 0.08 });
  cactus.add(GEO.capsule(0.36, 1.3), M(1.62, 3.1, 0), '#77b865', { ol: 0.08 });
  cactus.add(GEO.cyl(0.32, 0.32, 1.2, 7), M(-0.9, 3.1, 0, 0, 0, Math.PI / 2), '#6fae5a', { ol: 0.08 });
  cactus.add(GEO.capsule(0.32, 1.0), M(-1.45, 3.7, 0), '#77b865', { ol: 0.08 });
  cactus.add(GEO.ico(0.3, 0), M(0, 5.35, 0), '#ff8fb1', { ol: 0.04 });
  const shroom = new Builder();
  shroom.add(GEO.cyl(0.28, 0.36, 1.1, 8), M(0, 0.55, 0), '#fff3d6', { ol: 0.05 });
  shroom.add(GEO.sph(0.95, 12, 6, true), M(0, 0.95, 0, 0, 0, 0, 1, 0.75, 1), '#e4572e', { ol: 0.07 });
  [[0.4, 1.45, 0.3], [-0.45, 1.4, -0.2], [0.05, 1.62, -0.45], [-0.2, 1.5, 0.5]].forEach(([x, y, z]) => shroom.add(GEO.ico(0.13, 0), M(x, y, z), '#fff8e8', { ol: 0 }));
  const snowpine = new Builder();
  snowpine.add(GEO.cyl(0.45, 0.6, 2.4, 6), M(0, 1.2, 0), '#8a5a34', { ol: 0.1 });
  [[3.0, 3.6, 3.6, '#4f8a57'], [2.4, 3.2, 5.6, '#5a9760'], [1.7, 2.8, 7.4, '#64a468']].forEach(([r, h, cy, c]) => {
    snowpine.add(GEO.cone(r, h, 8), M(0, cy, 0), c, { ol: 0.12, ao: 0.15 });
    const k = 0.62, rr = r * k * 1.05, hh = h * k;
    snowpine.add(GEO.cone(rr, hh, 8), M(0, cy + h / 2 - hh / 2 + 0.08, 0), '#f7fbff', { ol: 0 });
  });
  Object.assign(TK, { palm: palmK, cactus, shroom, snowpine });
}

/* ------------------------------------------------------------------ building a new district */
const builtDistricts = new Set(), distRight = { x: SLAB.x1 };
function buildDistrict(k) {
  if (builtDistricts.has(k)) return;
  builtDistricts.add(k);
  try { buildTown(k); } finally { RK = 2; }
}
function buildTown(k) {
  ensureKits();
  const D = T.district(k), B = new Chunked(CELL), atlas = new TextAtlas(1024, 1024), prevText = curText, KL = KIND_LOOK[D.kind] || KIND_LOOK.rural;
  curText = atlas;
  const x0 = wx(D.x0), x1 = wx(D.x1), z0 = wz(SLAB.y0), z1 = wz(SLAB.y1), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  B.add(GEO.box(w, 1.4, d), M(cx, -0.7, cz), KL.ground || COL.grass, { ol: 0 });
  B.add(GEO.box(w, 5, d - 0.6), M(cx, -3.8, cz), '#a0673b', { ol: 0, ao: 0.35 });
  B.add(GEO.box(w, 2.2, d - 1.2), M(cx, -7.3, cz), '#7d5a44', { ol: 0, ao: 0.3 });
  const r = rng(k * 977 + 3), PC = KL.patch || [COL.grass2, COL.grass3];
  for (let i = 0; i < 26; i++) { const px = D.x0 + r() * T.DW, py = SLAB.y0 + r() * (SLAB.y1 - SLAB.y0), rr = (60 + r() * 90) * S; B.add(GEO.disc(1, 20), M(wx(px), 0.02 + (i % 5) * 0.002, wz(py), i * 0.7, 0, 0, rr, 1, rr * 0.6), i % 3 ? PC[0] : PC[1], { ol: 0 }); }
  D.roads.forEach(([ax, ay, bx, by]) => {
    const len = Math.hypot(bx - ax, by - ay) * S, ang = Math.atan2(by - ay, bx - ax), mx = wx((ax + bx) / 2), mz = wz((ay + by) / 2);
    B.add(GEO.box(len, 0.06, 9.6), M(mx, 0.03, mz, -ang), COL.roadEdge, { ol: 0 });
    B.add(GEO.box(len, 0.1, 8.0), M(mx, 0.05, mz, -ang), COL.road, { ol: 0 });
  });
  for (let x = D.x0 + 30; x < D.x1; x += 60) B.add(GEO.box(2.6, 0.04, 0.45), M(wx(x), 0.115, wz(1760)), '#ffffff', { ol: 0 });
  buildRail(B, D.x0, D.x1);
  buildLandmark(B, D.station);
  D.landmarks.forEach(L => buildLandmark(B, L));
  // bus stop
  const bx = wx(D.stop.x), bz = wz(D.stop.y) - 1;
  B.add(GEO.box(8, 0.35, 3.4), M(bx, 5.2, bz), COL.blue, { ol: 0.09 });
  [-3.6, 3.6].forEach(dx => B.add(GEO.box(0.3, 5, 0.3), M(bx + dx, 2.5, bz + 1.2), INKC, { ol: 0 }));
  B.add(GEO.box(6.4, 0.3, 1.2), M(bx, 1.3, bz - 0.6), COL.wood, { ol: 0.06 });
  sign(B, bx, 6.8, bz + 1.2, `🚌 ${D.name}`, { th: 1.2 });
  addBoxSolid(bx - 4, bz - 1.8, bx + 4, bz + 0.2);
  // nature
  const trees2 = [];
  buildNature(B, D, trees2);
  // the soccer field next to the stadium
  if (D.landmarks.some(L => L.type === 'stadium')) buildField(B, D.x0 + 1450, 420);
  // what must stay clear: the nature corner, roads, rail, the station and landmarks (and their doorsteps), plots, the bus stop,
  // the welcome gate, the garden, the gathering spots, and whatever this town already built
  const taken = [], G = D.garden, WB = [];
  D.landmarks.forEach(L => { const ws = D.work.filter(q => q.place === L.type); if (ws.length) WB.push([Math.min(...ws.map(q => q.x)) - 90, 1350, Math.max(...ws.map(q => q.x)) + 90, 1500]); });
  const inZone = (gx, gy, pad) => (gx > D.x0 + 20 - pad && gx < D.x0 + 960 + pad && gy > -160 - pad && gy < 1440 + pad);
  const blocked = (gx, gy, pad) => {
    if (gy < T.RAIL_Y + 60 + pad || gy > SLAB.y1 - 40) return true;
    if (inZone(gx, gy, pad)) return true;
    for (const rd of D.roads) if (segDist(gx, gy, rd) < 50 + pad) return true;
    for (const L of [D.station, ...D.landmarks]) if (gx > L.x - L.w / 2 - 60 - pad && gx < L.x + L.w / 2 + 100 + pad && gy > L.y - 200 - pad && gy < L.y + 110 + pad) return true;
    for (const p of D.plots) if (gx > p.x - pad && gx < p.x + p.w + pad && gy > p.y - pad && gy < p.y + p.h + pad) return true;
    if (Math.hypot(gx - D.stop.x, gy - D.stop.y) < 120 + pad) return true;
    if (D.landmarks.some(L => L.type === 'stadium') && gx > D.x0 + 1150 - pad && gx < D.x0 + 1750 + pad && gy > 200 - pad && gy < 640 + pad) return true;
    if (D.gate && Math.hypot(gx - D.gate.x, gy - D.gate.y) < 130 + pad) return true;
    if (G && Math.abs(gx - G.x) < G.w / 2 + 25 + pad && Math.abs(gy - G.y) < G.h / 2 + 25 + pad) return true;
    for (const b of WB) if (gx > b[0] - pad && gx < b[2] + pad && gy > b[1] - pad && gy < b[3] + pad) return true;
    for (const t of taken) if (gx > t[0] - pad && gx < t[2] + pad && gy > t[1] - pad && gy < t[3] + pad) return true;
    return false;
  };
  const decorBlocked = (gx, gy, pad) => blocked(gx, gy, pad) || (D.kind === 'beach' && gy > BEACH_SAND - 10 - pad);
  const clearRect = (a, b, c, e, flat) => {
    for (const t of taken) if (c > t[0] && a < t[2] && e > t[1] && b < t[3]) return false;
    const nx = Math.max(1, Math.ceil((c - a) / 30)), ny = Math.max(1, Math.ceil((e - b) / 30));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const gx = a + (c - a) * i / nx, gy = b + (e - b) * j / ny;
      if (blocked(gx, gy, 0) || (flat && hillH(wx(gx), wz(gy)) > 0.3)) return false;
    }
    return true;
  };
  // find a clear spot (game px) for something pw x ph in one of the zones; it is then taken
  const put = (pw, ph, zones, o = {}) => {
    const pad = o.pad ?? 20;
    for (let t = 0; t < (o.tries || 40); t++) {
      const zn = zones[Math.floor(r() * zones.length)], ax = D.x0 + zn[0] + pw / 2 + pad, bx2 = D.x0 + zn[2] - pw / 2 - pad, ay = zn[1] + ph / 2 + pad, by = zn[3] - ph / 2 - pad;
      if (bx2 < ax || by < ay) continue;
      const gx = ax + r() * (bx2 - ax), gy = ay + r() * (by - ay);
      if (!clearRect(gx - pw / 2 - pad, gy - ph / 2 - pad, gx + pw / 2 + pad, gy + ph / 2 + pad, o.flat)) continue;
      taken.push([gx - pw / 2, gy - ph / 2, gx + pw / 2, gy + ph / 2]);
      return { x: gx, y: gy };
    }
    return null;
  };
  RK = 1;   // from here on: the town's own scenery (the station, landmarks and bus stop above look exactly as before)
  buildGate(B, D);
  if (G) buildGarden(B, G, D.kind, trees2);
  buildWorkStatic(B, D);
  if (KIND_BUILD[D.kind]) KIND_BUILD[D.kind](B, D, { r, put, trees: trees2, taken, blocked, decorBlocked, clearRect });
  // trees and flowers, the way this kind of town has them
  const decor = [];
  for (let i = 0; i < KL.trees * 12 && decor.length < KL.trees; i++) {
    const edge = r() < 0.5, gx = D.x0 + r() * T.DW, gy = edge ? (r() < 0.5 ? SLAB.y1 - 30 - r() * 60 : SLAB.y0 + 200 + r() * 40) : SLAB.y0 + r() * (SLAB.y1 - SLAB.y0);
    if (decorBlocked(gx, gy, 30) || decor.some(q => Math.hypot(q[0] - gx, q[1] - gy) < KL.gap)) continue;
    decor.push([gx, gy]);
    trees2.push({ kind: KL.kinds[Math.floor(r() * KL.kinds.length)], x: wx(gx), z: wz(gy), s: 0.85 + r() * 0.45, r: i + k * 1000 });
  }
  trees2.forEach(t => {
    const h = hillH(t.x, t.z);
    if (h > 0.2) { const sl = slopeAt(t.x, t.z); t.y = h - Math.min(1.2, Math.hypot(sl.gx, sl.gz) * 0.9) - 0.05; if (D.kind === 'mountain' && t.kind === 'pine' && h > 2.5) t.kind = 'snowpine'; }
    addCircleSolid(t.x, t.z, (TREE_R[t.kind] || 1.2) * t.s);
  });
  const fls = [], FC = KL.fcols || ['#ff8fb1', '#fff8e8', COL.yellow, '#b98cff'];
  for (let i = 0; i < KL.flowers * 5 && fls.length < KL.flowers; i++) { const gx = D.x0 + r() * T.DW, gy = SLAB.y0 + 250 + r() * (SLAB.y1 - SLAB.y0 - 300); if (decorBlocked(gx, gy, 6) || hillH(wx(gx), wz(gy)) > 0.2) continue; const c = FC[Math.floor(r() * FC.length)]; for (let j = 0; j < 3; j++) fls.push({ x: wx(gx) + (r() - 0.5) * 3, z: wz(gy) + (r() - 0.5) * 3, c }); }
  B.meshes().forEach(m => { m.matrixAutoUpdate = false; m.children.forEach(c => { c.matrixAutoUpdate = false; }); scene.add(m); });
  curText = prevText;
  const tm = atlas.mesh(); if (tm) scene.add(tm);
  if (TK.oak) {
    const byKind = {};
    trees2.forEach(t => (byKind[t.kind] = byKind[t.kind] || []).push(t));
    Object.entries(byKind).forEach(([kind, list]) => { if (TK[kind]) instanced(TK[kind], list, (it, m, c) => TK.tint(it, m, c, kind === 'oak' ? 0.16 : 0.14)); });
    if (fls.length) instanced(TK.fl, fls, (it, m, c) => { m.makeTranslation(it.x, 0, it.z); c.set(it.c); }, 1000).forEach(m => { m.castShadow = false; });
  }
  [D.station, ...D.landmarks].forEach(addKeeper);
  // things to kick around
  if (D.nature === 'beach') addBall(D.nat.x + 120, D.nat.y + 150, 'beach');
  if (D.nature === 'meadow') addBall(D.nat.x, D.nat.y, 'soccer');
  distRight.x = Math.max(distRight.x, D.x1);
}
// the soccer field: kick the ball into a goal (the goal knows when it scores)
const goals = [];
function buildField(B, gx, gy) {
  const x = wx(gx), z = wz(gy);
  B.add(GEO.box(52, 0.08, 32), M(x, 0.05, z), '#8fcf5f', { ol: 0 });
  for (let i = 0; i < 6; i++) B.add(GEO.box(52 / 6, 0.09, 32), M(x - 26 + 52 / 12 * (2 * i + 1), 0.06, z), i % 2 ? '#86c455' : '#8fcf5f', { ol: 0 });
  B.add(GEO.ring(4.8, 5.1, 30), M(x, 0.12, z), '#ffffff', { ol: 0 });
  B.add(GEO.box(0.3, 0.1, 32), M(x, 0.12, z), '#ffffff', { ol: 0 });
  [-1, 1].forEach(sx => {
    const gx2 = x + sx * 25;
    [-3.5, 3.5].forEach(dz => { B.add(GEO.cyl(0.25, 0.25, 4, 6), M(gx2, 2, z + dz), '#ffffff', { ol: 0.04 }); addCircleSolid(gx2, z + dz, 0.4); });
    B.add(GEO.cyl(0.25, 0.25, 7.3, 6), M(gx2, 4, z, 0, Math.PI / 2), '#ffffff', { ol: 0.04 });
    goals.push({ x: gx2 + sx * 1.2, z, hw: 3.2, side: sx });
  });
  addBall(gx, gy, 'soccer'); addBall(gx - 60, gy + 40, 'soccer');
}

/* ------------------------------------------------------------------ the east edge: the town grows here next */
function updateFrontier(town) {
  const need = T.growthNeed(((town && town.districts) || 0) + 1), have = Math.floor((town && town.growth) || 0);
  const gx = T.worldRight(town);
  setPart('frontier', `${gx}|${Math.min(need, have)}|${need}`, B => {
    const x = wx(gx) - 2, z = wz(1760);
    for (let i = -2; i <= 2; i++) { B.add(GEO.box(0.5, 1.8, 0.5), M(x, 0.9, z + i * 2.2), COL.wood, { ol: 0.05 }); }
    for (let i = 0; i < 5; i++) B.add(GEO.box(0.3, 0.6, 1.9), M(x, 1.4, z - 4.4 + i * 2.2), i % 2 ? '#ffffff' : '#ff9f43', { ol: 0.04 });
    [-7, 7].forEach(dz => { B.add(GEO.cone(0.7, 1.6, 8), M(x - 2, 0.8, z + dz), '#ff9f43', { ol: 0.05 }); });
    sign(B, x - 3, 4.4, z + 8, `🏙️ ${Math.min(need, have)} / ${need}`, { post: true, th: 1.8, color: '#fff1a8' });
  });
}

/* ------------------------------------------------------------------ faraway trips: islands built the first time you visit */
const TRIP_SPOT = {};                       // trip id -> [{id, type, x, y}] in game px, for the game to use
const TRIP_Y = 9e6;   // trips are far away from the planet's map (game px), so the Wild never reaches them
const tripCenter = (id) => ({ x: 4800 + ['island', 'snow', 'safari', 'volcano', 'moon'].indexOf(id) * 3000, y: TRIP_Y });
const builtTrips = new Set();
let onTrip = null;
function buildTrip(id) {
  if (builtTrips.has(id)) return;
  builtTrips.add(id);
  const c = tripCenter(id), x = wx(c.x), z = wz(c.y), B = new Builder(), atlas = new TextAtlas(1024, 256), pt = curText, ps = curSolids;
  curText = atlas;
  const R = 52;
  const ground = { island: '#f4e3b5', snow: '#f3f7ff', safari: '#e9c77a', volcano: '#8a6a5a', moon: '#cfcfd8' }[id];
  const edge = { island: '#e2c98f', snow: '#d9e3f5', safari: '#c9a35a', volcano: '#6b4c40', moon: '#a9a9b8' }[id];
  if (id === 'island') B.add(GEO.cyl(95, 95, 1, 48), M(x, -0.6, z), '#6fc3e8', { ol: 0 });
  B.add(GEO.cyl(R + 2, R - 2, 6, 48), M(x, -3.2, z), edge, { ol: 0.3, ao: 0.4 });
  B.add(GEO.cyl(R + 2, R + 2, 0.4, 48), M(x, -0.15, z), ground, { ol: 0 });
  const r = rng(id.length * 97);
  const spots = [];
  const spot = (type, dx, dz) => spots.push({ id: `t.${id}.${spots.length}`, type, x: c.x + dx * 10, y: c.y + dz * 10 });
  switch (id) {
    case 'island':
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.3, d = 30 + r() * 14; palm(B, x + Math.cos(a) * d, z + Math.sin(a) * d); }
      spot('shell', -18, 22); spot('swim', 10, 40); spot('photo', 22, -10); spot('berry', -24, -16);
      tripod(B, x + 24, z - 10); berryBush(B, x - 22, z - 16);
      break;
    case 'snow': {
      const q = { x: x - 4, z: z - 18, h: 20, s: 13 }; HILLS.push(q);
      B.add(hillGeo('trip_snow', q, 80), M(q.x, 0, q.z), '#ffffff', { ol: 0, ao: 0.3 });
      for (let i = 0; i < 16; i++) { const a = r() * 6.283, d = 26 + r() * 22; const tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d; B.add(GEO.cone(2.2, 5, 8), M(tx, 3, tz), '#5f9e57', { ol: 0.1 }); B.add(GEO.cone(1.4, 1.6, 8), M(tx, 5.2, tz), '#ffffff', { ol: 0.06 }); addCircleSolid(tx, tz, 1.2); }
      B.add(GEO.sph(1.6, 12, 8), M(x + 12, 1.6, z + 10), '#ffffff', { ol: 0.08 }); B.add(GEO.sph(1.1, 12, 8), M(x + 12, 4, z + 10), '#ffffff', { ol: 0.07 }); B.add(GEO.cone(0.25, 1, 6), M(x + 12, 4, z + 11.3, 0, Math.PI / 2), '#ff9f43', { ol: 0 });
      addCircleSolid(x + 12, z + 10, 1.8);
      spot('view', -0.4, -18); spot('photo', 20, 16); spot('gem', -26, 10); spot('camp', 14, -6);
      crystals(B, x - 24, z + 10); tripod(B, x + 22, z + 16); campfire(B, x + 15, z - 8);
      break;
    }
    case 'safari': {
      for (let i = 0; i < 7; i++) { const a = r() * 6.283, d = 20 + r() * 26, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d; B.add(GEO.cyl(0.4, 0.5, 5, 6), M(tx, 2.5, tz), '#8a5a34', { ol: 0.05 }); B.add(GEO.cyl(4, 3, 1, 10), M(tx, 5.4, tz), '#7fa84a', { ol: 0.08 }); addCircleSolid(tx, tz, 0.8); }
      // a lion and a giraffe (friendly!)
      B.add(GEO.rbox(3.6, 2, 1.8, 0.7, 1), M(x - 10, 1.8, z + 6), '#f4b942', { ol: 0.08 }); B.add(GEO.sph(1.6, 12, 8), M(x - 7.6, 2.8, z + 6), '#c9772a', { ol: 0.08 }); B.add(GEO.sph(1.1, 10, 8), M(x - 7.3, 2.8, z + 6), '#f4b942', { ol: 0.06 });
      addCircleSolid(x - 9, z + 6, 2.4);
      B.add(GEO.rbox(2.6, 2, 1.4, 0.5, 1), M(x + 14, 3.2, z - 4), COL.yellow, { ol: 0.08 }); B.add(GEO.cyl(0.35, 0.45, 4.4, 8), M(x + 15, 6, z - 4, 0, 0, -0.25), COL.yellow, { ol: 0.06 }); B.add(GEO.rbox(1.3, 1, 0.9, 0.3, 1), M(x + 15.6, 8.2, z - 4), COL.yellow, { ol: 0.06 });
      addCircleSolid(x + 14, z - 4, 2);
      spot('photo', -40, 60); spot('photo', 140, -20); spot('view', 0, -30); spot('camp', 20, 30);
      tripod(B, x - 2, z + 6); campfire(B, x + 3, z + 1);
      break;
    }
    case 'volcano': {
      const q = { x: x, z: z - 20, h: 16, s: 11 }; HILLS.push(q);
      B.add(hillGeo('trip_volcano', q, 70), M(q.x, 0, q.z), '#6b4c40', { ol: 0, ao: 0.3 });
      B.add(GEO.disc(3.4, 20), M(q.x, 16.1, q.z), '#ff6a2a', { ol: 0 });
      for (let i = 0; i < 6; i++) crystals(B, x - 26 + i * 10, z + 14 + (i % 2) * 6);
      spot('gem', -26, 14); spot('gem', 14, 20); spot('view', 0, -6); spot('photo', 26, -2);
      tripod(B, x + 28, z - 2);
      break;
    }
    case 'moon':
      for (let i = 0; i < 12; i++) { const a = r() * 6.283, d = 10 + r() * 36, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d, cr = 1.5 + r() * 3; B.add(GEO.torus(cr, 0.5, 18), M(tx, 0.1, tz), '#b9b9c6', { ol: 0 }); }
      B.add(GEO.cyl(0.1, 0.1, 4, 5), M(x + 6, 2, z + 6), '#ffffff', { ol: 0 }); B.add(GEO.box(2.4, 1.5, 0.1), M(x + 7.2, 3.3, z + 6), COL.blue, { ol: 0.04 });
      spot('gem', -20, 10); spot('photo', 18, -12); spot('view', 0, -26); spot('stars', -10, -20);
      crystals(B, x - 20, z + 10); tripod(B, x + 20, z - 12);
      break;
  }
  // the way home: a plane (or the rocket) waiting at the landing spot
  const hx = x, hz = z + 34;
  if (id === 'moon') { B.add(GEO.cyl(1.6, 1.6, 10, 16), M(hx + 8, 5.4, hz), '#ffffff', { ol: 0.1 }); B.add(GEO.cone(1.6, 3.6, 16), M(hx + 8, 12.2, hz), COL.roof, { ol: 0.1 }); addCircleSolid(hx + 8, hz, 2); }
  else { planeParts(B, hx + 10, 0, hz, '#ffffff', Math.PI / 2); addBoxSolid(hx + 3, hz - 7, hx + 17, hz + 7); }
  spots.push({ id: `t.${id}.home`, type: 'home', x: gxOf(hx + 3), y: gyOf(hz) });
  sign(B, hx - 8, 3.2, hz + 3, `${({ island: '🏝️ Sunny Island', snow: '🏔️ Snow Peak', safari: '🦁 Safari', volcano: '🌋 Volcano', moon: '🌙 The Moon' })[id]}`, { post: true, th: 1.6, color: '#fff1a8' });
  const g = new THREE.Group(); g.add(B.mesh()); const tm = atlas.mesh(); if (tm) g.add(tm); scene.add(g);
  curText = pt; curSolids = ps;
  TRIP_SPOT[id] = spots;
  if (id === 'island') addBall(c.x + 120, c.y + 150, 'beach');
  if (id === 'moon') addBall(c.x - 60, c.y + 80, 'moon');
}

/* ------------------------------------------------------------------ physics: balls you can kick */
const balls = [];
const ballGeo = new THREE.IcosahedronGeometry(1, 2);
const BALL_LOOK = { soccer: ['#ffffff', 1.1], beach: ['#ff8fb1', 1.5], moon: ['#cfd8e3', 1.2] };
function addBall(gx, gy, kind = 'soccer') {
  const [color, r] = BALL_LOOK[kind] || BALL_LOOK.soccer;
  const m = new THREE.Mesh(ballGeo, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
  m.scale.setScalar(r); m.castShadow = true; scene.add(m);
  // two ink bands so you can see it roll
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.01, 0.08, 6, 24), new THREE.MeshBasicMaterial({ color: kind === 'beach' ? '#ffd23f' : INKC }));
  m.add(band); const band2 = band.clone(); band2.rotation.y = Math.PI / 2; m.add(band2);
  const b = { x: wx(gx), z: wz(gy), y: 3, vx: 0, vy: 0, vz: 0, r, m: kind === 'beach' ? 0.4 : 1, mesh: m, home: { x: wx(gx), z: wz(gy) }, kind, q: new THREE.Quaternion() };
  balls.push(b); return b;
}
const _ax = new THREE.Vector3(), _dq = new THREE.Quaternion();
function stepBalls(dt) {
  const P = player, pr = PR, pm = 3;
  for (const b of balls) {
    const g = b.kind === 'moon' ? GRAV / 6 : GRAV;
    b.vy -= g * dt;
    const wtr = waterAt(b.x, b.z);
    if (wtr && b.y < b.r * 0.6) { b.vy += g * 1.8 * dt; b.vx *= 1 - 1.5 * dt; b.vz *= 1 - 1.5 * dt; b.vy *= 1 - 3 * dt; }   // it floats
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const gh = groundAt(b.x, b.z) + hillH(b.x, b.z);
    if (!wtr && b.y - b.r < gh) {
      b.y = gh + b.r;
      if (b.vy < 0) b.vy = Math.abs(b.vy) < 3 ? 0 : -b.vy * (b.kind === 'beach' ? 0.7 : 0.55);   // bounce, losing a little energy each time
      const sl = slopeAt(b.x, b.z);
      b.vx -= g * sl.gx * 0.6 * dt; b.vz -= g * sl.gz * 0.6 * dt;                                // it rolls down hills
      const f = 1 - Math.min(1, (b.kind === 'beach' ? 1.4 : 0.9) * dt);                           // rolling friction
      b.vx *= f; b.vz *= f;
    }
    // walls, trees and posts: bounce off
    const hit = (nx, nz, pen) => { b.x += nx * pen; b.z += nz * pen; const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; } };
    const test = (s) => {
      if (s.type === 'circle') { const dx = b.x - s.x, dz = b.z - s.z, d = Math.hypot(dx, dz), m = s.r + b.r * 0.9; if (d < m && d > 1e-4) hit(dx / d, dz / d, m - d); }
      else { const cx = Math.max(s.x0, Math.min(s.x1, b.x)), cz = Math.max(s.z0, Math.min(s.z1, b.z)), dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz); if (d < b.r * 0.9 && d > 1e-4) hit(dx / d, dz / d, b.r * 0.9 - d); }
    };
    for (const s of solids) if (Math.abs(s.type === 'circle' ? s.x - b.x : (s.x0 + s.x1) / 2 - b.x) < 40) test(s);
    for (const d of dyn.values()) for (const s of d.solids) test(s);
    // people kick it: momentum passes from the heavier player to the lighter ball
    const kick = (px, pz, pvx, pvz) => {
      const dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz), m = pr + b.r;
      if (d >= m || d < 1e-4 || b.y > 6) return;
      const nx = dx / d, nz = dz / d; b.x += nx * (m - d); b.z += nz * (m - d);
      const rel = (pvx - b.vx) * nx + (pvz - b.vz) * nz;
      if (rel > 0) { const j = (1 + 0.6) * rel * pm / (pm + b.m); b.vx += j * nx; b.vz += j * nz; b.vy += Math.min(10, j * 0.35); if (j > 4 && hooks.onKick) hooks.onKick(j); }
    };
    if (!rideNow && P.sf && P.sf.visible !== false) kick(P.x, P.z, P.vx, P.vz);
    others.forEach(o => kick(o.x, o.z, (o.vx || 0), (o.vz || 0)));
    // goals
    for (const gl of goals) if (Math.abs(b.x - gl.x) < 1.6 && Math.abs(b.z - gl.z) < gl.hw && b.y < 4) {
      if (hooks.onGoal) hooks.onGoal(gxOf(b.x), gyOf(b.z));
      burst(gxOf(b.x), gyOf(b.z), 'confetti', 30, 4);
      b.x = b.home.x; b.z = b.home.z; b.y = 4; b.vx = b.vz = b.vy = 0;
    }
    if (Math.hypot(b.x - b.home.x, b.z - b.home.z) > 160) { b.x = b.home.x; b.z = b.home.z; b.y = 4; b.vx = b.vz = 0; }   // lost balls come back
    // roll: turn around the axis across the direction of travel
    const sp = Math.hypot(b.vx, b.vz);
    if (sp > 0.05) { _ax.set(b.vz, 0, -b.vx).normalize(); _dq.setFromAxisAngle(_ax, sp * dt / b.r); b.q.premultiply(_dq); }
    b.mesh.position.set(b.x, b.y, b.z); b.mesh.quaternion.copy(b.q);
  }
}

/* ------------------------------------------------------------------ physics: trees fall when chopped */
const falling = [];
function fellTree(gx, gy, kind) {
  const F = forestMeshes[kind] || forestMeshes.oak; if (!F) return;
  const x = wx(gx), z = wz(gy), outer = new THREE.Group(), inner = new THREE.Group();
  inner.add(new THREE.Mesh(F.mesh.geometry, toonMat)); if (F.out) inner.add(new THREE.Mesh(F.out.geometry, outlineMat));
  inner.children.forEach(o => { o.userData.keepGeo = true; o.castShadow = true; });
  outer.position.set(x, 0, z); outer.rotation.y = Math.atan2(x - player.x, z - player.z); outer.add(inner); scene.add(outer);
  falling.push({ outer, inner, th: 0.06, w: 0, t: 0, landed: false, gx, gy });
}
function stepFalling(dt) {
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    if (!f.landed) {
      // a falling pole: angular acceleration = (3g / 2L) · sin(angle). Slow at first, then faster and faster.
      f.w += (3 * GRAV / (2 * 7)) * Math.sin(f.th) * 0.45 * dt; f.th += f.w * dt;
      if (f.th >= Math.PI / 2 - 0.05) { f.th = Math.PI / 2 - 0.05; f.landed = true; if (hooks.onThud) hooks.onThud(); burst(f.gx, f.gy, 'dust', 18, 1); }
    } else { f.t += dt; if (f.t > 1.2) { f.outer.scale.multiplyScalar(1 - Math.min(1, dt * 4)); if (f.outer.scale.x < 0.05) { scene.remove(f.outer); falling.splice(i, 1); continue; } } }
    f.inner.rotation.x = f.th;
  }
}

/* ------------------------------------------------------------------ your own wheels (and wings) */
const vehicleKit = {};
function vehicleMesh(kind, color) {
  const B = new Builder();
  if (kind === 'bike' || kind === 'scooter') {
    [-1.6, 1.6].forEach(dz => B.add(GEO.torus(0.9, 0.2, 16), M(0, 0.95, dz, 0, 0, Math.PI / 2), INKC, { ol: 0 }));
    B.add(GEO.box(0.25, 0.25, 3.4), M(0, 1.6, 0), color, { ol: 0.04 });
    B.add(GEO.cyl(0.12, 0.12, 1.6, 5), M(0, 2.3, 1.5), INKC, { ol: 0 }); B.add(GEO.box(2.2, 0.2, 0.2), M(0, 3.1, 1.5), INKC, { ol: 0 });
    if (kind === 'scooter') B.add(GEO.rbox(1.6, 1.2, 3, 0.4, 1), M(0, 1.5, -0.4), color, { ol: 0.08 });
  } else if (kind === 'car') { carParts(B, 0, 0, 0, color, 0); }
  else if (kind === 'plane') { planeParts(B, 0, -1.2, 0, color, 0); }
  return B.mesh();
}
let myVehicle = null, vehicleKind = null;
const VSPEC = { walk: { max: 1, acc: 0 }, bike: { max: 1.6, acc: 26, brake: 40 }, scooter: { max: 2.1, acc: 24, brake: 38 }, car: { max: 2.6, acc: 22, brake: 44 }, plane: { max: 2.6, acc: 20, brake: 30 } };
function setVehicle(kind) {
  if (myVehicle) { myVehicle.parent && myVehicle.parent.remove(myVehicle); myVehicle = null; }
  vehicleKind = kind || null;
  if (!kind || !player.sf) return;
  myVehicle = vehicleMesh(kind, kind === 'car' ? player.color : kind === 'plane' ? '#ffffff' : COL.roof);
  myVehicle.scale.setScalar(kind === 'car' ? 1.75 : kind === 'plane' ? 1.25 : 1.3);
  player.sf.root.add(myVehicle);
  player.sf.legs.forEach(l => { l.visible = kind === 'bike' || kind === 'scooter'; });
}

/* ------------------------------------------------------------------ riding the bus and the train */
let rideNow = null, trainMesh = null, rideBus = null;
function trainParts() {
  const B = new Builder();
  B.add(GEO.rbox(12, 5, 5, 0.8, 2), M(0, 3.4, 0), COL.roof, { ol: 0.12 });
  B.add(GEO.cyl(1.2, 1.2, 3, 10), M(4.5, 7, 0), INKC, { ol: 0.06 });
  B.add(GEO.rbox(4, 2.4, 5.2, 0.4, 1), M(-3, 6.8, 0), '#1f1a2e', { ol: 0.08 });
  for (let c = 1; c <= 2; c++) { B.add(GEO.rbox(11, 4.6, 4.8, 0.7, 2), M(-12.5 * c, 3.2, 0), c % 2 ? '#5b7cfa' : COL.yellow, { ol: 0.12 }); for (let i = 0; i < 3; i++) window3(B, -12.5 * c - 3.5 + i * 3.5, 4.2, 2.45, 2, 1.6); }
  for (let i = 0; i < 9; i++) B.add(GEO.cyl(0.9, 0.9, 5.4, 12), M(4 - i * 4, 0.9, 0, 0, Math.PI / 2), INKC, { ol: 0 });
  return B.mesh();
}
// Moves you from one stop to another. Vehicles speed up, cruise, then slow down, like real ones.
function ride(kind, fromG, toG, done) {
  const line = kind === 'train' ? wz(T.RAIL_Y) : wz(1760) + 2.2;
  let mesh;
  if (kind === 'train') { if (!trainMesh) { trainMesh = trainParts(); scene.add(trainMesh); } mesh = trainMesh; }
  else { if (!rideBus) { rideBus = bus.clone(); scene.add(rideBus); } mesh = rideBus; }
  const x0 = wx(fromG.x), x1 = wx(toG.x), dir = Math.sign(x1 - x0) || 1;
  mesh.visible = true; mesh.position.set(x0, 0, line); mesh.rotation.y = dir > 0 ? 0 : Math.PI;
  rideNow = { kind, mesh, x: x0, v: 0, x1, dir, max: kind === 'train' ? 95 : 48, acc: kind === 'train' ? 24 : 16, done, to: toG, line };
  player.sf.root.visible = false;
}
function stepRide(dt) {
  const r = rideNow; if (!r) return;
  const left = (r.x1 - r.x) * r.dir, stopDist = r.v * r.v / (2 * r.acc);
  r.v = left <= stopDist + 0.5 ? Math.max(3, r.v - r.acc * dt) : Math.min(r.max, r.v + r.acc * dt);   // brake in time to stop at the platform
  r.x += r.v * r.dir * dt;
  r.mesh.position.x = r.x;
  player.x = r.x; player.z = r.line + 8; player.vx = r.v * r.dir; player.vz = 0;
  if ((r.x1 - r.x) * r.dir <= 0.3) {
    rideNow = null; r.mesh.visible = r.kind === 'train';
    if (r.kind === 'train') setTimeout(() => { if (!rideNow) r.mesh.visible = false; }, 2500);
    player.sf.root.visible = true;
    player.x = wx(r.to.x); player.z = wz(r.to.y) + 4; player.vx = player.vz = 0; collide(player);
    r.done && r.done();
  }
}

/* ------------------------------------------------------------------ the guide: an arrow to where you need to go */
let guideTarget = null;
const guideEl = document.getElementById('guide');
const arrowMesh = (() => {
  const sh = new THREE.Shape(); sh.moveTo(0, 2.2); sh.lineTo(1.6, 0); sh.lineTo(0.6, 0); sh.lineTo(0.6, -1.6); sh.lineTo(-0.6, -1.6); sh.lineTo(-0.6, 0); sh.lineTo(-1.6, 0); sh.closePath();
  const g = new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false }));
  const o = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).scale(1.25, 1, 1.25), new THREE.MeshBasicMaterial({ color: INKC, transparent: true, opacity: 0.8, depthWrite: false }));
  o.position.y = -0.02; o.position.z = 0.1; m.add(o); m.renderOrder = 3; m.visible = false; scene.add(m); return m;
})();
function updateGuide(t) {
  if (!guideTarget || rideNow) { arrowMesh.visible = false; if (guideEl) guideEl.hidden = true; return; }
  const tx = wx(guideTarget.x), tz = wz(guideTarget.y), dx = tx - player.x, dz = tz - player.z, d = Math.hypot(dx, dz);
  const a = Math.atan2(dx, dz);
  arrowMesh.visible = d > 9;
  const r = 5 + Math.sin(t * 5) * 0.4;
  const ax = player.x + Math.sin(a) * r, az = player.z + Math.cos(a) * r;
  arrowMesh.position.set(ax, Math.max(groundAt(player.x, player.z), groundAt(ax, az)) + hillH(player.x, player.z) + 0.25 + (player.sf ? player.sf.y : 0), az);
  arrowMesh.rotation.y = a + Math.PI;
  if (!guideEl) return;
  const sc = toScreen(tx, guideTarget.h || 10, tz), W = innerWidth, H = innerHeight, m = 46;
  const on = sc && sc.x > m && sc.x < W - m && sc.y > m + 60 && sc.y < H - m - 60;
  guideEl.hidden = on || d < 9;
  if (on || d < 9) return;
  // off screen: sit on the edge of the screen, pointing the way
  const me = toScreen(player.x, 5, player.z) || { x: W / 2, y: H / 2 };
  let vx, vy;
  if (sc) { vx = sc.x - me.x; vy = sc.y - me.y; } else { vx = Math.sin(a); vy = -Math.cos(a) * 0.6; }
  const L = Math.hypot(vx, vy) || 1; vx /= L; vy /= L;
  const k = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(vx)), (H / 2 - m - 50) / Math.max(1e-3, Math.abs(vy)));
  guideEl.style.transform = `translate(${W / 2 + vx * k}px, ${H / 2 + vy * k}px)`;
  guideEl.firstElementChild.style.transform = `rotate(${Math.atan2(vy, vx)}rad)`;
  if (guideEl.dataset.icon !== guideTarget.icon) { guideEl.dataset.icon = guideTarget.icon || ''; guideEl.lastElementChild.textContent = guideTarget.icon || ''; }
}

/* ------------------------------------------------------------------ rain */
const RAIN_N = 420;
let rainMesh = null, rainOn = false;
function stepRain(dt, on) {
  rainOn = on;
  if (!rainMesh) { rainMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.55 }), RAIN_N); rainMesh.frustumCulled = false; rainMesh.userData.drops = Array.from({ length: RAIN_N }, () => ({ x: (Math.random() - 0.5) * 120, y: Math.random() * 60, z: (Math.random() - 0.5) * 100 })); scene.add(rainMesh); }
  rainMesh.visible = on;
  if (!on) return;
  rainMesh.userData.drops.forEach((d, i) => {
    d.y -= 70 * dt; if (d.y < 0) { d.y = 60; d.x = (Math.random() - 0.5) * 120; d.z = (Math.random() - 0.5) * 100; }
    _m4.makeTranslation(camTarget.x + d.x, d.y, camTarget.z + d.z - 10); rainMesh.setMatrixAt(i, _m4);
  });
  rainMesh.instanceMatrix.needsUpdate = true;
}

/* ------------------------------------------------------------------ build everything */
const player = { x: wx(4040), z: wz(2230), vx: 0, vz: 0, sf: null, color: COL.teal, hat: null };
const npcs = [], others = new Map(), keepers = [];
let bus = null;
function buildAll() {
  buildGround();
  T.BUILDINGS.forEach(buildBuilding);
  buildPlaza();
  buildTownFarm();
  buildForestStatic();
  buildDecor();
  // the logo lawn is a garden now: no stray flowers or tufts inside its hedges
  const inGarden = it => { const gx = gxOf(it.x), gy = gyOf(it.z); return gx > 4392 && gx < 4654 && gy > 1238 && gy < 1400; };
  for (const L of [flowers, tufts]) for (let i = L.length - 1; i >= 0; i--) if (inGarden(L[i])) L.splice(i, 1);
  buildOldGarden();
  buildHome();
  buildRail(W, SLAB.x0, SLAB.x1);
  buildLandmark(W, T.STATION);
  W.meshes().forEach(m => { m.matrixAutoUpdate = false; m.children.forEach(c => { c.matrixAutoUpdate = false; }); scene.add(m); });
  buildTrees();
  buildLogoMark();
  scene.add(TEXT.mesh());
  TEXT.repaintWhenFontArrives();

  // the player + the townsfolk
  player.sf = makeSquareface({ color: player.color, antenna: COL.roof, hatKind: player.hat, seed: 3 });
  addSeeThrough(player.sf);
  T.BUILDINGS.forEach(addKeeper);
  addKeeper(T.STATION);
  const loops = [
    { color: '#ff8fb1', hat: 'flower', path: [[4330, 1222], [5270, 1222], [5270, 1622], [4330, 1622]], off: 0 },
    { color: '#f08a3c', hat: 'beanie', path: [[3700, 1790], [5900, 1790]], off: 0.3 },
    { color: '#b98cff', hat: 'propeller', path: [[4830, 2500], [4830, 1790], [5490, 1790], [5490, 790], [4590, 790], [4590, 1150], [4830, 1150]], off: 0.1 },
    { color: '#5b7cfa', hat: null, path: [[5240, 1750], [5240, 1222], [4360, 1222], [4360, 1750]], off: 0.6 },
  ];
  loops.forEach((L, i) => {
    const sf = makeSquareface({ color: L.color, antenna: L.color, hatKind: L.hat, seed: 30 + i });
    const pts = L.path.map(([x, y]) => new THREE.Vector2(wx(x), wz(y)));
    pts.push(pts[0].clone());
    let len = 0; const segs = [];
    for (let k = 0; k < pts.length - 1; k++) { const l = pts[k].distanceTo(pts[k + 1]); segs.push(l); len += l; }
    npcs.push({ sf, walker: true, pts, segs, len, d: L.off * len, speed: 5 + i * 0.6 });
  });
  buildLimbs();
  // the town bus (a project the town can vote for)
  const bb = new Builder();
  bb.add(GEO.rbox(12, 5, 5, 1, 2), M(0, 3.2, 0), COL.yellow, { ol: 0.12, ao: 0.12 });
  bb.add(GEO.rbox(12.2, 1.6, 5.2, 0.4, 1), M(0, 4.2, 0), '#9ff3ff', { ol: 0 });
  for (let i = 0; i < 4; i++) bb.add(GEO.box(0.3, 1.7, 5.3), M(-4.5 + i * 3, 4.2, 0), COL.yellow, { ol: 0 });
  [[-3.8, 2.6], [3.8, 2.6], [-3.8, -2.6], [3.8, -2.6]].forEach(([x, z]) => bb.add(GEO.cyl(1.1, 1.1, 0.8, 12), M(x, 1.1, z, 0, Math.PI / 2), INKC, { ol: 0 }));
  bb.add(GEO.box(3.2, 0.9, 0.2), M(4, 5.9, 2.6), '#fff8e8', { ol: 0.05 });
  bus = bb.mesh(); bus.visible = false; scene.add(bus);
  buildEffects();
}

// the person who looks after each place stands in front of it
function addKeeper(b) {
  if (keepers.some(k => k.id === b.id)) return;
  const f = foot(b), n = b.npc, i = keepers.length;
  const sf = makeSquareface({ color: n.color, antenna: n.color, hatKind: n.hat, seed: 10 + i });
  const x = f.cx + (i % 2 ? 9 : -9), z = f.zf + 2.8;
  sf.root.position.set(x, 0, z); sf.targetFace = sf.face = 0;
  npcs.push({ sf, x, z, home: true, name: n.name, b });
  keepers.push({ id: b.id, type: b.type || b.id, name: n.name, x: gxOf(x), y: gyOf(z), sf });
  const ps = curSolids; curSolids = solids; addCircleSolid(x, z, 1.8); curSolids = ps;
}

/* ------------------------------------------------------------------ the parts of town that follow the shared town */
let townNow = null;
function updateTown(town) {
  const now = hooks.now();
  if (town) townNow = town;
  town = townNow;
  for (let k = 1; k <= ((town && town.districts) || 0); k++) buildDistrict(k);
  updateWork();
  updateFrontier(town);
  T.allPlots(town).forEach(p => { const st = town && town.plots[p.id]; setPart('plot:' + p.id, plotSig(p, st, now), B => buildPlot(B, p, st, now)); });
  setPart('townfarm', townFarmSig(town, now), B => {
    T.FARM_SPOTS.forEach((s, i) => {
      const prog = Math.min(1, (now - ((town && town.farm[i]) || 0)) / T.FARM_REGROW);
      crop(B, wx(s.x), wz(s.y), T.CROPS[i % 4], prog >= 1 ? 1 : Math.max(0.05, Math.floor(prog * 4) / 4));
    });
  });
  updateForest(town, now);
  updateProjects(town);
}

/* ------------------------------------------------------------------ other players */
function syncOthers(dt, t) {
  const seen = new Set();
  for (const o of hooks.others()) {
    if (o.x === null || o.x === undefined) continue;
    seen.add(o.id);
    let r = others.get(o.id);
    const h = hatOf(o.h);
    if (!r || r.color !== o.color || r.hat !== h) {
      if (r) r.sf.remove();
      r = { sf: makeSquareface({ color: o.color, antenna: o.color, hatKind: h, seed: 50 + o.id * 7 }), color: o.color, hat: h, x: r ? r.x : wx(o.x), z: r ? r.z : wz(o.y) };
      others.set(o.id, r);
    }
    const tx = wx(o.tx ?? o.x), tz = wz(o.ty ?? o.y), px = r.x, pz = r.z;
    if (Math.hypot(tx - r.x, tz - r.z) > 40) { r.x = tx; r.z = tz; }
    const k = 1 - Math.exp(-dt * 9);
    r.x += (tx - r.x) * k; r.z += (tz - r.z) * k;
    r.vx = (r.x - px) / Math.max(dt, 1e-3); r.vz = (r.z - pz) / Math.max(dt, 1e-3);
    r.sf.ground = o.sw ? -1.6 + Math.sin(t * 3) * 0.25 : groundAt(r.x, r.z) + hillH(r.x, r.z);   // friends swimming sit in the water, like you
    r.sf.speed = o.mv ? Math.min(20, Math.hypot(r.x - px, r.z - pz) / Math.max(dt, 1e-3)) : 0;
    r.sf.targetFace = (o.f || 0) * Math.PI;
    r.sf.y = Math.max(0, (o.tz || 0) / 10);
    if (o.mood && o.mood !== 'happy') { r.sf.moodOverride = o.mood; r.sf.moodUntil = t + 0.3; }
    r.sf.root.position.set(r.x, 0, r.z);
    r.data = o;
    r.sf.update(dt, t);
  }
  for (const [id, r] of others) if (!seen.has(id)) { r.sf.remove(); others.delete(id); dropTag(id); }
}

/* ------------------------------------------------------------------ name tags, speech bubbles, floating numbers */
const tagBox = document.getElementById('tags');
const tags = new Map();     // key -> { el, html, sayUntil, say }
const _v = new THREE.Vector3();
function toScreen(x, y, z) {
  const bx = x - camera.position.x, bz = z - camera.position.z + BEND_OFF;
  _v.set(x, y - (bx * bx + bz * bz) * BEND_K, z).project(camera);
  if (_v.z > 1) return null;
  return { x: (_v.x + 1) / 2 * innerWidth, y: (1 - _v.y) / 2 * innerHeight };
}
function dropTag(key) { const t = tags.get(key); if (t) { t.el.remove(); tags.delete(key); } }
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function showTag(key, sf, name, sub, o = {}) {
  let t = tags.get(key);
  if (!t) { t = { el: document.createElement('div'), html: '', say: '', sayUntil: 0 }; t.el.className = 'tag'; tagBox.appendChild(t.el); tags.set(key, t); }
  t.used = true;
  const p = sf.root.position, sc = toScreen(p.x, 11.8 + sf.y, p.z);
  if (!sc || sc.x < -80 || sc.x > innerWidth + 80 || sc.y < -40 || sc.y > innerHeight + 40) { t.el.hidden = true; return; }
  const saying = t.sayUntil > performance.now() ? t.say : '';
  const html = `${saying ? `<span class="say">${esc(saying)}</span>` : ''}<b style="--c:${o.color || '#fff8e8'}">${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
  if (html !== t.html) { t.html = html; t.el.innerHTML = html; }
  t.el.classList.toggle('npc', !!o.npc); t.el.classList.toggle('talking', !!o.talking); t.el.classList.toggle('me', key === 'me');
  t.el.hidden = false;
  t.el.style.transform = `translate(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px) translate(-50%, -100%)`;
}
function updateTags() {
  tags.forEach(t => { t.used = false; });
  const info = hooks.tagInfo ? hooks.tagInfo() : {};
  const zzz = (on, sub) => on ? `💤 ${sub || ''}`.trim() : sub;   // a sleeper's tag says so
  if (player.sf) showTag('me', player.sf, info.me ? info.me.name : '', zzz(sleeping, info.me && info.me.sub), { color: player.color, talking: info.me && info.me.talking });
  others.forEach((r, id) => {
    const o = r.data || {}, i = (info.others && info.others(id)) || {};
    showTag(id, r.sf, o.name || '', zzz(o.mood === 'sleepy', o.ti || ''), { color: r.color, talking: i.talking });
  });
  keepers.forEach(k => {
    const d = Math.hypot(k.sf.root.position.x - player.x, k.sf.root.position.z - player.z);
    if (d < 26 || tags.get('npc:' + k.id)?.sayUntil > performance.now()) showTag('npc:' + k.id, k.sf, k.name, '', { npc: true });
  });
  tags.forEach((t, key) => { if (!t.used) t.el.hidden = true; });
}
function say(key, text, secs = 5) {
  let t = tags.get(key);
  if (!t) { t = { el: document.createElement('div'), html: '', say: '', sayUntil: 0 }; t.el.className = 'tag'; t.el.hidden = true; tagBox.appendChild(t.el); tags.set(key, t); }
  t.say = text; t.sayUntil = performance.now() + secs * 1000;
}
const floats = [];
function floatText(gx, gy, text, cls = '', h = 9) {
  const el = document.createElement('div'); el.className = 'float ' + cls; el.textContent = text; tagBox.appendChild(el);
  floats.push({ el, x: wx(gx), z: wz(gy), y: h, t: 0 });
}
function updateFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.y += dt * 4;
    const sc = toScreen(f.x, f.y, f.z);
    if (f.t > 1.6 || !sc) { f.el.remove(); floats.splice(i, 1); continue; }
    f.el.style.transform = `translate(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px)`;
    f.el.style.opacity = String(Math.min(1, (1.6 - f.t) * 2));
  }
}

/* ------------------------------------------------------------------ markers, particles, fireworks */
const MARK_MAX = 12;
let markers, markList = [], parts, lampGlow;
const P_MAX = 260, pool = [];
const P_COLORS = { coins: ['#ffd23f', '#f4b942'], leaves: ['#8cc45e', '#6fb84a', '#b8d46a'], water: ['#8fdcf2', '#d4f6ff'], wood: ['#c98a52', '#8a5a34'],
  confetti: ['#ff8fb1', '#ffd23f', '#8fdcf2', '#b98cff', '#8cbf5a', '#e4572e'], dust: ['#e9d9b0', '#d4bf8c'], seeds: ['#7a4a2a', '#8cd05a'] };
function buildEffects() {
  const mg = new THREE.OctahedronGeometry(1.1, 0);
  markers = new THREE.InstancedMesh(mg, new THREE.MeshBasicMaterial({ color: '#ffd23f', toneMapped: false }), MARK_MAX);
  markers.count = 0; markers.frustumCulled = false; scene.add(markers);
  parts = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), P_MAX);
  parts.count = 0; parts.frustumCulled = false; parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(parts);
  parts.setColorAt(0, new THREE.Color('#ffffff'));
  lampGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe9a3', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), LAMPS.length);
  LAMPS.forEach(([gx, gy], i) => lampGlow.setMatrixAt(i, new THREE.Matrix4().makeTranslation(wx(gx), 7.4, wz(gy))));
  lampGlow.visible = false; scene.add(lampGlow);
  buildPickKit();
}
function burst(gx, gy, kind = 'coins', n = 14, h = 3) {
  const cols = P_COLORS[kind] || P_COLORS.confetti, x = wx(gx), z = wz(gy);
  for (let i = 0; i < n; i++) {
    if (pool.length >= P_MAX) pool.shift();
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 7;
    pool.push({ x, y: h, z, vx: Math.cos(a) * sp * 0.6, vy: 8 + Math.random() * 9, vz: Math.sin(a) * sp * 0.6, t: 0, life: 0.9 + Math.random() * 0.6,
      c: new THREE.Color(cols[i % cols.length]), s: kind === 'confetti' ? 1.2 : 1 });
  }
}
let celebrateUntil = 0, nextFirework = 0;
function updateEffects(dt, t) {
  // markers bob and spin over the places to go
  markList.slice(0, MARK_MAX).forEach((m, i) => {
    _m4.compose(_p.set(wx(m.x), (m.h || 9) + Math.sin(t * 3 + i) * 0.6, wz(m.y)), _q.setFromEuler(_e.set(0, t * 2 + i, 0)), _s.set(1, 1.4, 1));
    markers.setMatrixAt(i, _m4);
  });
  markers.count = Math.min(MARK_MAX, markList.length); markers.instanceMatrix.needsUpdate = true;
  // fireworks over the plaza during a festival
  if (celebrateUntil > t && t > nextFirework) {
    nextFirework = t + 0.5 + Math.random() * 0.6;
    const gx = T.PLAZA.x + (Math.random() - 0.5) * 400, gy = T.PLAZA.y + (Math.random() - 0.5) * 260;
    burst(gx, gy, 'confetti', 26, 18 + Math.random() * 8);
    if (hooks.onFirework) hooks.onFirework();
  }
  let n = 0;
  for (let i = pool.length - 1; i >= 0; i--) {
    const q = pool[i]; q.t += dt;
    if (q.t > q.life) { pool.splice(i, 1); continue; }
    q.vy -= 26 * dt; q.x += q.vx * dt; q.y = Math.max(0.3, q.y + q.vy * dt); q.z += q.vz * dt;
    const k = q.s * (1 - q.t / q.life * 0.6);
    _m4.compose(_p.set(q.x, q.y, q.z), _q.identity(), _s.setScalar(k));
    parts.setMatrixAt(n, _m4); parts.setColorAt(n, q.c); n++;
  }
  parts.count = n; parts.instanceMatrix.needsUpdate = true; if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
}
const _m4 = new THREE.Matrix4();

/* ------------------------------------------------------------------ pickups: coins, stars and pots of gold */
// sw.js decides what lies where (and what it is worth); the world shows them bobbing and says when you walk into one.
// One InstancedMesh (+ outline) per kind. An id you collected never comes back, so a pickup can only fire once.
const PICK_MAX = 40, PICK_R = 2.5;
const pickKit = {}, picks = [], picked = new Set();   // picks: {id, kind, x, z, y, water, ph, born}
function buildPickKit() {
  const coin = new Builder(), star = new Builder(), pot = new Builder(), brick = new Builder();
  // a crunchy ramen brick: a golden block with wavy noodles pressed into its sides
  brick.add(GEO.rbox(2.2, 1.4, 1.5, 0.35), M(0, 0, 0), '#f4c35a', { ol: 0.08, ao: 0.15 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) brick.add(GEO.sph(0.2, 8, 6), M(-0.8 + i * 0.4, -0.38 + r * 0.38 + ((i + r) % 2) * 0.08, 0.72), '#e2a53c', { ol: 0 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) brick.add(GEO.sph(0.2, 8, 6), M(-0.8 + i * 0.4, -0.38 + r * 0.38 + ((i + r) % 2) * 0.08, -0.72), '#e2a53c', { ol: 0 });
  coin.add(GEO.cyl(1, 1, 0.3, 20), M(0, 0, 0, 0, Math.PI / 2), COL.yellow, { ol: 0.07 });
  coin.add(GEO.cyl(0.66, 0.66, 0.36, 20), M(0, 0, 0, 0, Math.PI / 2), COL.gold, { ol: 0 });
  star.add(GEO.star(1.25, 0.55, 0.36), M(0, 0, 0), COL.yellow, { ol: 0.07 });
  // a round black pot, heaped with gold
  pot.add(GEO.sph(1.3, 14, 10), M(0, 0, 0, 0, 0, 0, 1, 0.85, 1), '#4a3d5c', { ol: 0.08, ao: 0.2 });
  pot.add(GEO.torus(0.95, 0.2, 20), M(0, 0.86, 0), '#5d4f70', { ol: 0.05 });
  pot.add(GEO.sph(0.9, 12, 6, true), M(0, 0.8, 0, 0, 0, 0, 1, 0.6, 1), COL.yellow, { ol: 0.05 });
  [[0.35, 0.2, 0.4], [-0.4, -0.25, -0.5], [0, 0.45, 0.2]].forEach(([dx, dz, a], i) => pot.add(GEO.cyl(0.3, 0.3, 0.1, 10), M(dx, 1.25 + i * 0.06, dz, a, 0.5), COL.gold, { ol: 0.03 }));
  Object.entries({ coin, star, pot, brick }).forEach(([k, b]) => {
    const { main, line } = b.geometries(), mesh = new THREE.InstancedMesh(main, toonMat, PICK_MAX), out = new THREE.InstancedMesh(line, outlineMat, PICK_MAX);
    [mesh, out].forEach(m => { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); });
    mesh.castShadow = true;
    pickKit[k] = { mesh, out };
  });
}
// is there a wall, tree or post at this point (world units)?
function solidAt(x, z, r) {
  const hit = s => s.type === 'circle' ? Math.hypot(x - s.x, z - s.z) < s.r + r : x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r;
  if (solids.some(hit)) return true;
  for (const d of dyn.values()) if (d.solids.some(hit)) return true;
  return false;
}
function addPickups(list) {
  for (const it of list || []) {
    if (!it || it.id === undefined || !pickKit[it.kind] || picked.has(String(it.id))) continue;
    const id = String(it.id), old = picks.findIndex(p => p.id === id);
    if (old >= 0) picks.splice(old, 1);
    if (picks.filter(p => p.kind === it.kind).length >= PICK_MAX) continue;
    // inside a tree or a wall? nudge it towards the player a few times, else leave it out (fixed ones, like race bricks, stay put so everyone sees the same spot)
    let x = wx(it.x), z = wz(it.y);
    for (let k = 0; k < 3 && !it.fixed && solidAt(x, z, 0.8); k++) { const dx = player.x - x, dz = player.z - z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, 3); x += dx / d * st; z += dz / d * st; }
    if (solidAt(x, z, 0.8)) continue;
    // on water it floats at the surface, on land it hovers
    const w = waterAt(x, z), pot = it.kind === 'pot' || it.kind === 'brick';
    const y = w ? (w.y ?? 0.07) + (pot ? 0.45 : 0.75) : groundAt(x, z) + hillH(x, z) + (pot ? 1.15 : 2);
    picks.push({ id, kind: it.kind, x, z, y, water: !!w, ph: (hash(id) % 628) / 100, born: now });
  }
}
function clearPickups(prefix = '', forget = false) {
  for (let i = picks.length - 1; i >= 0; i--) if (picks[i].id.startsWith(prefix)) picks.splice(i, 1);
  if (forget) [...picked].forEach(id => { if (id.startsWith(prefix)) picked.delete(id); });
}
function takePickup(p) {
  picked.add(p.id);
  burst(gxOf(p.x), gyOf(p.z), p.kind === 'star' || p.kind === 'brick' ? 'confetti' : 'coins', p.kind === 'pot' ? 30 : p.kind === 'brick' ? 18 : 12, p.y);
  if (hooks.onPickup) try { hooks.onPickup(p.id, p.kind); } catch (e) { console.error(e); }
}
function updatePickups(t) {
  if (!pickKit.coin) return;
  const n = { coin: 0, star: 0, pot: 0, brick: 0 }, canTake = !rideNow && player.sf && player.sf.root.visible && player.sf.y < 6 && flyH < 2;
  for (let i = picks.length - 1; i >= 0; i--) {
    const p = picks[i];
    if (canTake && Math.hypot(p.x - player.x, p.z - player.z) < PICK_R) { picks.splice(i, 1); takePickup(p); continue; }
    const K = pickKit[p.kind], k = n[p.kind]++;
    const pop = Math.min(1, (now - p.born) / 0.35), s = pop * (2 - pop);   // pops in when it appears
    const bob = p.water ? Math.sin(t * 2 + p.ph) * 0.1 : Math.sin(t * 2.6 + p.ph) * 0.3;
    const spin = p.kind === 'pot' || p.kind === 'brick' ? t * 0.8 : t * (p.kind === 'coin' ? 2.4 : 1.8);
    _m4.compose(_p.set(p.x, p.y + bob, p.z), _q.setFromEuler(_e.set(p.water ? Math.sin(t * 1.6 + p.ph) * 0.12 : 0, spin + p.ph, 0)), _s.setScalar(Math.max(0.01, s)));
    K.mesh.setMatrixAt(k, _m4); K.out.setMatrixAt(k, _m4);
  }
  Object.entries(pickKit).forEach(([kind, K]) => {
    K.mesh.count = K.out.count = n[kind]; K.mesh.visible = K.out.visible = n[kind] > 0;
    K.mesh.instanceMatrix.needsUpdate = K.out.instanceMatrix.needsUpdate = true;
  });
}

/* ------------------------------------------------------------------ the planet: the Wild, made as you walk */
// Around the towns the whole planet is open land, sea and ice, generated from js/planet.js in 100 m chunks.
// Chunks near you are built (one per frame, so walking never stutters) and chunks far behind are thrown away,
// so the world is endless but memory stays flat. The same numbers give every player the same planet.
const PL = window.Planet;
const WCH = 100, WRES = 4;                      // chunk size and ground grid spacing, in units (m)
const WCHUNKS = Math.round(PL.C / WCH);         // chunks around the planet (for wrap-safe seeds)
const OCEAN = { y: 0.07, ocean: true };
const wild = new Map();                         // "cx,cz" -> { cx, cz, group, solids, spots }
const wildGroup = new THREE.Group(); wildGroup.name = 'wild'; scene.add(wildGroup);
let WR = { x0: wx(SLAB.x0), x1: wx(SLAB.x1), z0: wz(SLAB.y0), z1: wz(SLAB.y1) };   // the towns' rectangle
let wildQueue = [], wildT = 0, wildVersion = 0;
const inRegion = (x, z) => x > WR.x0 && x < WR.x1 && z > WR.z0 && z < WR.z1;
// height of the Wild: 0 under the towns' boards, easing up into the planet's hills over the first 24 m
function wildH(x, z) {
  const d = PL.regionDist(x, z), s = PL.sample(x, z);
  if (d <= 0) return -0.06;
  return s.ocean ? s.h : -0.06 + (s.h + 0.06) * PL.smooth(0, 24, d);
}
function wildRegion() {
  const r = { x0: wx(SLAB.x0), x1: wx(T.worldRight(townNow)), z0: wz(SLAB.y0), z1: wz(SLAB.y1) };
  if (r.x0 === WR.x0 && r.x1 === WR.x1 && r.z0 === WR.z0 && r.z1 === WR.z1 && PL.regionDist(0, 0) === 0) return false;
  WR = r; PL.setRegion(r); return true;
}
function wildReset() { wild.forEach(dropChunk); wild.clear(); wildQueue = []; wildVersion++; }
function dropChunk(c) {
  if (!c.group) return;
  wildGroup.remove(c.group);
  c.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
  disposeGroup(c.group);
}
// kits for the Wild's instanced plants, made once from the town's tree kits
const WK = {};
function wildKits() {
  if (WK.oak) return;
  ensureKits();
  const tuft = new Builder();
  [[0, 0, 0], [0.3, 0.1, 0.5], [-0.3, -0.1, -0.5]].forEach(([dx, dz, rz]) => tuft.add(GEO.cone(0.18, 1.0, 3), M(dx, 0.45, dz, 0, 0, rz), '#98c965', { ol: 0 }));
  const lily = new Builder(); lily.add(GEO.ico(1.1, 1), M(0, 0.7, 0), '#6fb84a', { ol: 0.07 });
  Object.entries({ oak: TK.oak, pine: TK.pine, snowpine: TK.snowpine, cactus: TK.cactus, palm: TK.palm, shroom: TK.shroom, flower: TK.fl, tuft, bush: lily })
    .forEach(([k, b]) => { const g = b.geometries(); WK[k] = g; });
}
const keepGeo = (m) => { m.userData.keepGeo = true; return m; };
function wildInstances(group, kind, list, tintK) {
  if (!list.length) return;
  const { main, line } = WK[kind], m = new THREE.Matrix4(), c = new THREE.Color();
  const mesh = keepGeo(new THREE.InstancedMesh(main, toonMat, list.length)), out = line ? keepGeo(new THREE.InstancedMesh(line, outlineMat, list.length)) : null;
  list.forEach((it, i) => {
    m.compose(_p.set(it.x, it.y, it.z), _q.setFromEuler(_e.set(0, it.r * 6.28, 0)), _s.setScalar(it.s));
    mesh.setMatrixAt(i, m); if (out) out.setMatrixAt(i, m);
    if (it.c) c.set(it.c); else { const k = 1 + (it.r - 0.5) * tintK; c.setRGB(k, k * 1.02, k * 0.97); }
    mesh.setColorAt(i, c);
  });
  mesh.castShadow = kind !== 'flower' && kind !== 'tuft'; mesh.receiveShadow = true;
  mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 12;   // the curve moves far things down: cull a little generously
  group.add(mesh);
  if (out) { out.computeBoundingSphere(); out.boundingSphere.radius += 12; out.castShadow = false; group.add(out); }
}
// what the Wild's discoveries look like; sw.js knows their names and what finding one gives
const WILD_KINDS = {
  meadow: ['stones', 'ruins', 'well', 'camp', 'statue', 'tower'], forest: ['bigshroom', 'camp', 'ruins', 'tower'], taiga: ['camp', 'tower', 'stones'],
  snow: ['igloo', 'crystal', 'stones'], rock: ['crystal', 'tower', 'stones'], desert: ['arch', 'mesa', 'ruins'], jungle: ['ruins', 'bigshroom', 'statue'], beach: ['lighthouse', 'camp'],
};
function wildLandmark(B, type, x, z, seed) {
  const r = rng(seed);
  switch (type) {
    case 'stones': for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28, px = x + Math.cos(a) * 7, pz = z + Math.sin(a) * 7; B.add(GEO.rbox(1.6, 4 + r() * 1.6, 1.2, 0.3, 1), M(px, 2.2, pz, a), '#b9ae9f', { ol: 0.08, ao: 0.2 }); addCircleSolid(px, pz, 1); }
      B.add(GEO.rbox(3.4, 0.8, 2.2, 0.3, 1), M(x, 0.4, z), '#a39888', { ol: 0.07 }); break;
    case 'ruins': [[-5, 0, 5.5], [-1.5, -2, 3.2], [3, 1, 6.2], [5.5, -1.5, 2.2]].forEach(([dx, dz, h]) => { B.add(GEO.cyl(0.9, 1, h, 10), M(x + dx, h / 2, z + dz), '#e8dcc2', { ol: 0.08, ao: 0.15 }); addCircleSolid(x + dx, z + dz, 1.1); });
      B.add(GEO.box(8.6, 0.9, 1.4), M(x - 1, 5.9, z - 1), '#ddcfb2', { ol: 0.08 }); B.add(GEO.box(2.4, 1.2, 1.4), M(x + 2, 0.6, z + 4, 0.6), '#d8c9ab', { ol: 0.07 }); break;
    case 'well': well(B, x, z); break;
    case 'camp': campfire(B, x, z);
      B.add(GEO.prism(5, 3.4, 4.4), M(x + 6, 1.7, z - 3, 0.5), '#e4572e', { ol: 0.09 }); addCircleSolid(x + 6, z - 3, 2.4); break;
    case 'statue': B.add(GEO.rbox(4, 2, 4, 0.4, 1), M(x, 1, z), '#cfc6d8', { ol: 0.08 }); B.add(GEO.rbox(2.6, 2.6, 2.4, 0.5, 1), M(x, 4.4, z), '#bdb2a4', { ol: 0.08 });
      B.add(GEO.rbox(2, 1.5, 0.2, 0.3, 1), M(x, 4.5, z + 1.25), '#8fdcf2', { ol: 0.04 }); B.add(GEO.cyl(0.08, 0.08, 1.6, 5), M(x, 6.4, z), INKC, { ol: 0 }); B.add(GEO.ico(0.4, 1), M(x, 7.3, z), COL.yellow, { ol: 0.04 }); addCircleSolid(x, z, 2.4); break;
    case 'tower': [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([dx, dz]) => { B.add(GEO.cyl(0.25, 0.3, 9, 6), M(x + dx, 4.5, z + dz), COL.woodDark, { ol: 0.05 }); addCircleSolid(x + dx, z + dz, 0.5); });
      B.add(GEO.box(5.4, 3, 5.4), M(x, 10.2, z), COL.wood, { ol: 0.08 }); B.add(GEO.cone(4.6, 2.6, 4), M(x, 13, z, 0.785), '#9a3b2a', { ol: 0.08 }); break;
    case 'bigshroom': B.add(GEO.cyl(1.4, 1.9, 7, 12), M(x, 3.5, z), '#fff3d6', { ol: 0.09 }); B.add(GEO.sph(6, 18, 10, true), M(x, 6.8, z, 0, 0, 0, 1, 0.62, 1), '#e4572e', { ol: 0.12 });
      for (let i = 0; i < 9; i++) { const a = i * 2.4, d = 1.5 + (i % 3) * 1.4; B.add(GEO.ico(0.55, 0), M(x + Math.cos(a) * d, 10.3 - d * 0.35, z + Math.sin(a) * d), '#fff8e8', { ol: 0 }); } addCircleSolid(x, z, 2); break;
    case 'crystal': B.add(GEO.ico(4.5, 1), M(x, 1.2, z, 0, 0, 0, 1.2, 0.7, 1), '#a39888', { ol: 0.1 }); crystals(B, x + 3.5, z + 2.5); crystals(B, x - 3, z + 3.2); addCircleSolid(x, z, 4.6); break;
    case 'igloo': B.add(GEO.sph(4.6, 18, 10, true), M(x, 0, z), '#f7fbff', { ol: 0.1 }); B.add(GEO.cyl(1.7, 1.7, 3.4, 12), M(x, 1.2, z + 4.4, 0, Math.PI / 2), '#eef4fb', { ol: 0.07 });
      B.add(GEO.disc(1.3, 12), M(x, 1.2, z + 6.12, 0, Math.PI / 2), '#34233f', { ol: 0 }); addCircleSolid(x, z, 4.7); break;
    case 'arch': redArch(B, x, z, r() * 3); break;
    case 'mesa': mesa(B, x, z, 6 + r() * 3, 9 + r() * 5, seed % 7); break;
    case 'lighthouse': for (let i = 0; i < 5; i++) B.add(GEO.cyl(2.3 - i * 0.25, 2.5 - i * 0.25, 2.6, 14), M(x, 1.3 + i * 2.6, z), i % 2 ? '#e4572e' : '#ffffff', { ol: 0.08 });
      B.add(GEO.cyl(1.4, 1.4, 1.8, 10), M(x, 14.4, z), COL.yellow, { ol: 0.07 }); B.add(GEO.cone(1.9, 1.8, 10), M(x, 16.2, z), '#9a3b2a', { ol: 0.07 }); addCircleSolid(x, z, 2.6); break;
    case 'pole': B.add(GEO.cyl(0.35, 0.35, 12, 8), M(x, 6, z), '#ffffff', { ol: 0.06 });
      for (let i = 0; i < 6; i++) B.add(GEO.cyl(0.37, 0.37, 1, 8), M(x, 1 + i * 2, z), '#e4572e', { ol: 0 });
      B.add(GEO.box(4, 2.4, 0.15), M(x + 2.2, 10.6, z), '#5b7cfa', { ol: 0.05 }); B.add(GEO.ico(0.6, 1), M(x, 12.4, z), COL.yellow, { ol: 0.04 }); addCircleSolid(x, z, 0.8); break;
  }
}
function buildWildChunk(cx, cz) {
  const x0 = cx * WCH, z0 = cz * WCH, x1 = x0 + WCH, z1 = z0 + WCH;
  const c = { cx, cz, group: null, solids: [], spots: [] };
  if (x0 >= WR.x0 && x1 <= WR.x1 && z0 >= WR.z0 && z1 <= WR.z1) return c;   // all town: the boards are there
  if (z1 < PL.POLE_N - WCH || z0 > PL.POLE_S + WCH) return c;                // past the poles
  wildKits();
  const group = new THREE.Group(), cxw = ((cx % WCHUNKS) + WCHUNKS) % WCHUNKS;
  // the ground: a grid of heights and colours
  const n = WCH / WRES + 1, pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3), idx = [];
  let sea = false, land = false;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * WRES, z = z0 + j * WRES, s = PL.sample(x, z), d = PL.regionDist(x, z), k = (j * n + i) * 3;
    const h = d <= 0 ? -0.06 : s.ocean ? s.h : -0.06 + (s.h + 0.06) * PL.smooth(0, 24, d);
    pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
    _pc.set(s.ocean ? PL.BIOME.sea.ground : s.h > 17 ? '#f4f8fc' : PL.BIOME[s.biome].ground);
    const v = 0.93 + PL.fbm(x, z, 50, 9, 1) * 0.14; col[k] = _pc.r * v; col[k + 1] = _pc.g * v; col[k + 2] = _pc.b * v;
    if (s.ocean) sea = true; else land = true;
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1; idx.push(a, cc, b, b, cc, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.computeBoundingSphere(); g.boundingSphere.radius += 12;
  const ground = new THREE.Mesh(g, toonMat); ground.receiveShadow = true; group.add(ground);
  const B = new Chunked(1e9), base = new THREE.Matrix4(), ps = curSolids; curSolids = c.solids;
  try {
    if (sea) B.add(GEO.box(WCH, 0.04, WCH), M(x0 + WCH / 2, 0.05, z0 + WCH / 2), '#6cc4e6', { ol: 0 });   // the sea's surface
    if (land) {
      const rs = rng(Math.imul(cxw + 3, 2654435761) ^ Math.imul(cz + 101, 40503));
      // a discovery in about four chunks out of ten; a pole marker all along each pole
      const pz = z0 <= PL.POLE_N + 12 && z1 > PL.POLE_N + 12 ? PL.POLE_N + 12 : z0 <= PL.POLE_S - 12 && z1 > PL.POLE_S - 12 ? PL.POLE_S - 12 : null;
      let spot = null;
      if (pz !== null && x0 % 400 === 0) spot = { type: 'pole', x: x0 + WCH / 2, z: pz, pole: pz < 0 ? 'N' : 'S' };
      else if (rs() < 0.38) for (let tries = 0; tries < 6 && !spot; tries++) {
        const x = x0 + 25 + rs() * 50, z = z0 + 25 + rs() * 50, s = PL.sample(x, z);
        if (s.ocean || PL.regionDist(x, z) < 30 || !WILD_KINDS[s.biome]) continue;
        const kinds = WILD_KINDS[s.biome]; spot = { type: kinds[Math.floor(rs() * kinds.length)], x, z, biome: s.biome };
      }
      // plants and rocks, by biome
      const r = rng(Math.imul(cxw + 1, 73856093) ^ Math.imul(cz + 7919, 19349663)), P = { oak: [], pine: [], snowpine: [], cactus: [], palm: [], shroom: [], flower: [], tuft: [], bush: [] };
      const FL = ['#ff8fb1', '#ffd23f', '#ffffff', '#b98cff', '#ff9f43'];
      for (let i = 0; i < 95; i++) {
        const x = x0 + r() * WCH, z = z0 + r() * WCH, q = r(), rr = r(), sc = 0.8 + r() * 0.5;
        if (level >= 2 && i % 5 >= 3) continue;   // slow devices: a thinner Wild (the same places, fewer plants)
        const d = PL.regionDist(x, z); if (d < 10 || (spot && Math.hypot(x - spot.x, z - spot.z) < 13)) continue;   // clear space around a discovery
        const s = PL.sample(x, z); if (s.ocean) continue;
        const y = wildH(x, z), it = { x, y, z, s: sc, r: rr };
        const tree = (k, rad = 0.9) => { P[k].push(it); c.solids.push({ type: 'circle', x, z, r: rad * sc }); };
        const rock = (red) => { base.makeTranslation(0, y - 0.2, 0); B.base = base; (red ? redRock : greyRock)(B, x, z, 0.8 + rr * 0.9, (i * 7 + cxw) | 0); B.base = null; };
        switch (s.biome) {
          case 'meadow': if (q < 0.09) tree('oak'); else if (q < 0.34) P.flower.push({ ...it, s: 1.3, c: FL[i % FL.length] }); else if (q < 0.5) P.tuft.push(it); else if (q < 0.52) rock(); else if (q < 0.55) tree('bush', 1.2); break;
          case 'forest': if (q < 0.42) tree(s.t < 0.5 ? 'pine' : 'oak'); else if (q < 0.56) P.shroom.push(it); else if (q < 0.66) P.tuft.push(it); else if (q < 0.7) tree('bush', 1.2); break;
          case 'taiga': if (q < 0.42) tree('pine'); else if (q < 0.47) rock(); else if (q < 0.55) P.tuft.push(it); break;
          case 'snow': if (q < 0.16) tree('snowpine'); else if (q < 0.21) rock(); break;
          case 'rock': if (q < 0.2) rock(); else if (q < 0.26) tree('pine'); break;
          case 'desert': if (q < 0.06) tree('cactus', 0.8); else if (q < 0.1) rock(true); break;
          case 'jungle': if (q < 0.3) tree('palm', 0.8); else if (q < 0.5) tree('oak'); else if (q < 0.62) P.flower.push({ ...it, s: 1.5, c: FL[i % FL.length] }); else if (q < 0.7) tree('bush', 1.2); break;
          case 'beach': if (q < 0.04) tree('palm', 0.8); break;
        }
      }
      Object.entries(P).forEach(([k, list]) => wildInstances(group, k, list, k === 'flower' ? 0 : 0.2));
      if (spot) {
        const y = wildH(spot.x, spot.z);
        base.makeTranslation(0, y - 0.1, 0); B.base = base;
        wildLandmark(B, spot.type, spot.x, spot.z, (Math.imul(cxw, 9973) + cz * 31) | 0);
        B.base = null;
        c.spots.push({ id: `w${cxw}_${cz}`, ...spot, y });
      }
    }
  } finally { curSolids = ps; }
  B.meshes().forEach(m => { m.geometry.boundingSphere.radius += 12; group.add(m); });
  wildGroup.add(group); c.group = group;
  return c;
}
// which chunks should exist: a wide band in front of the camera (north, up the screen) and a little behind
function wildTick(dt) {
  if (!started) return;
  if (onTrip) { wildGroup.visible = false; return; }
  wildGroup.visible = true;
  if ((wildT -= dt) <= 0) {
    wildT = 0.25;
    if (wildRegion()) wildReset();
    const pcx = Math.floor(player.x / WCH), pcz = Math.floor(player.z / WCH), want = [];
    for (let dz = -3; dz <= 1; dz++) for (let dx = -2; dx <= 2; dx++) want.push([pcx + dx, pcz + dz, dx * dx + (dz + 1) * (dz + 1)]);
    const keep = new Set(want.map(([x, z]) => x + ',' + z));
    wild.forEach((c, k) => { if (Math.abs(c.cx - pcx) > 3 || c.cz - pcz < -4 || c.cz - pcz > 2) { dropChunk(c); wild.delete(k); wildVersion++; } });
    wildQueue = want.filter(([x, z]) => !wild.has(x + ',' + z)).sort((a, b) => a[2] - b[2]);
    void keep;
  }
  // build the nearest missing chunk (two when the first was cheap)
  const t0 = performance.now();
  while (wildQueue.length && performance.now() - t0 < 6) {
    const [x, z] = wildQueue.shift(), k = x + ',' + z;
    if (wild.has(k)) continue;
    wild.set(k, buildWildChunk(x, z)); wildVersion++;
  }
}
function collideWild(p) {
  if (onTrip || !wild.size) return;
  const cx = Math.floor(p.x / WCH), cz = Math.floor(p.z / WCH);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = wild.get((cx + dx) + ',' + (cz + dz)); if (!c) continue;
    for (const s of c.solids) if (Math.abs(s.x - p.x) < s.r + 4 && Math.abs(s.z - p.z) < s.r + 4) pushOut(p, s);
  }
}

/* ------------------------------------------------------------------ time of day */
const SKY = { day: new THREE.Color('#cdeefc'), dusk: new THREE.Color('#ffd6b8'), night: new THREE.Color('#4a4f86') };
const FOG = { day: new THREE.Color('#dcefe6'), dusk: new THREE.Color('#f6d9c2'), night: new THREE.Color('#545a8e') };
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
let nightK = 0;
function setDay(frac) {
  const h = 6 + frac * 17;   // 6 AM .. 11 PM
  const mix = (a, b, k) => _c1.copy(a).lerp(b, Math.max(0, Math.min(1, k)));
  let sky, fog, light;
  if (h < 7.5) { const k = (h - 6) / 1.5; sky = mix(SKY.dusk, SKY.day, k).clone(); fog = mix(FOG.dusk, FOG.day, k).clone(); light = 0.8 + 0.2 * k; nightK = 0; }
  else if (h < 17.5) { sky = SKY.day.clone(); fog = FOG.day.clone(); light = 1; nightK = 0; }
  else if (h < 19.5) { const k = (h - 17.5) / 2; sky = mix(SKY.day, SKY.dusk, k).clone(); fog = mix(FOG.day, FOG.dusk, k).clone(); light = 1 - 0.15 * k; nightK = 0; }
  else { const k = Math.min(1, (h - 19.5) / 1.5); sky = mix(SKY.dusk, SKY.night, k).clone(); fog = mix(FOG.dusk, FOG.night, k).clone(); light = 0.85 - 0.22 * k; nightK = k * 0.85; }
  if (rainOn) { sky.lerp(new THREE.Color('#9aa6b8'), 0.55); fog.lerp(new THREE.Color('#aab4c2'), 0.55); light *= 0.8; }
  if (onTrip === 'moon') { sky.set('#1b1633'); fog.set('#2a2548'); light = 0.95; nightK = 0; }
  renderer.setClearColor(sky, 1); scene.fog.color.copy(fog);
  hemi.intensity = 2.05 * light; sun.intensity = 1.35 * (light - 0.25 * nightK);
  sun.color.copy(_c2.set('#fff1d6').lerp(new THREE.Color(h > 17 ? '#ffb27a' : '#fff1d6'), h > 17 ? Math.min(1, (h - 17) / 2) * (1 - nightK) : 0).lerp(new THREE.Color('#9fa6ff'), nightK));
  hemi.color.set('#fff6e8').lerp(new THREE.Color('#aab0ff'), nightK * 0.6);
  if (lampGlow) { lampGlow.visible = lightsOn && nightK > 0.05; lampGlow.material.opacity = 0.55 * nightK; }
}

/* ------------------------------------------------------------------ wonders: a rainbow, shooting stars */
// A rainbow: 7 glowing half-rings standing over a spot, with a puff of cloud at each foot. It grows up out of the
// ground when it appears and sinks back when it goes. No fog on it, so you can see it from across town.
const RAINBOW = ['#ff6b6b', '#ff9f43', '#ffd23f', '#8cd05a', '#5bc0f8', '#5b7cfa', '#b98cff'];
let rainbowG = null, rainbowOn = false, rainbowK = 0;
function makeRainbow() {
  const B = new Builder();
  RAINBOW.forEach((c, i) => B.add(prep(`rb${i}`, () => new THREE.TorusGeometry(12 - i * 0.95, 0.5, 8, 56, Math.PI)), M(0, 0, 0), c, { ol: 0 }));
  const arch = new THREE.Mesh(B.geometries().main, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
  arch.position.y = -0.4;
  const C = new Builder();
  [-9.2, 9.2].forEach(cx => [[0, 0.3, 2.2], [1.9, -0.2, 1.6], [-1.9, -0.3, 1.5], [0.6, 1.6, 1.4]].forEach(([dx, dy, r]) => C.add(GEO.ico(r, 1), M(cx + dx, 1 + dy, 0.4), '#ffffff', { ol: 0.1 })));
  const clouds = C.mesh({ cast: false });
  const g = new THREE.Group(); g.add(arch, clouds); g.userData = { arch, clouds };
  return g;
}
function setRainbow(on, gx, gy) {
  rainbowOn = !!on;
  if (!on) return;
  if (!rainbowG) { rainbowG = makeRainbow(); scene.add(rainbowG); }
  if (gx !== undefined && gy !== undefined) rainbowG.position.set(wx(gx), 0, wz(gy));
}
function stepRainbow(dt) {
  if (!rainbowG) return;
  rainbowK = Math.max(0, Math.min(1, rainbowK + (rainbowOn ? dt : -dt) / 1.6));
  if (!rainbowOn && rainbowK === 0) { scene.remove(rainbowG); disposeGroup(rainbowG); rainbowG = null; return; }
  const e = rainbowK * rainbowK * (3 - 2 * rainbowK), { arch, clouds } = rainbowG.userData;
  arch.scale.set(1, Math.max(0.01, e), 1); arch.material.opacity = 0.8 * e;
  clouds.scale.setScalar(Math.max(0.01, Math.min(1, e * 1.4)));
}

// Shooting stars: a few bright streaks at night. The camera looks down at the town (there is no sky in view), so
// they fly across the top of the screen, in a group that rides along with the camera.
const SHOOT_N = 5;
let shootOn = false, shootG = null, nextShoot = 0;
const shoots = [];
function makeShoots() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,246,214,0)'); g.addColorStop(0.8, 'rgba(255,246,214,0.8)'); g.addColorStop(1, '#ffffff');
  c.fillStyle = g; c.beginPath(); c.moveTo(0, 16); c.lineTo(238, 7); c.arc(238, 16, 9, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  shootG = new THREE.Group(); scene.add(shootG);
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < SHOOT_N; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 6; shootG.add(m);
    shoots.push({ m, t: 1, life: 1, vx: 0, vy: 0, len: 10 });
  }
}
function spawnShoot() {
  const s = shoots.find(q => q.t >= q.life); if (!s) return;
  const D = 60, hh = D * Math.tan(camera.fov * Math.PI / 360), hw = hh * camera.aspect;
  // start in the top half of the view and cross part of it, dipping a little
  const dir = Math.random() < 0.5 ? -1 : 1, ang = 0.12 + Math.random() * 0.25, sp = 30 + Math.random() * 15;
  s.m.position.set(-dir * hw * (0.2 + Math.random() * 0.7), hh * (0.5 + Math.random() * 0.4), -D);
  s.vx = dir * Math.cos(ang) * sp; s.vy = -Math.sin(ang) * sp; s.len = 9 + Math.random() * 5;
  s.m.rotation.z = Math.atan2(s.vy, s.vx); s.m.scale.set(0.1, 0.7, 1);
  s.t = 0; s.life = 0.7 + Math.random() * 0.3; s.m.visible = true;
}
function setShootingStars(on) {
  shootOn = !!on;
  if (on && !shootG) makeShoots();
  if (!on) shoots.forEach(s => { s.t = s.life; s.m.visible = false; });
}
function stepShoots(dt, t) {
  if (!shootG) return;
  shootG.position.copy(camera.position); shootG.quaternion.copy(camera.quaternion);
  if (shootOn && nightK > 0.2 && t > nextShoot) { nextShoot = t + 0.7 + Math.random() * 1.1; spawnShoot(); if (Math.random() < 0.3) spawnShoot(); }
  for (const s of shoots) {
    if (s.t >= s.life) { s.m.visible = false; continue; }
    s.t += dt; const k = Math.min(1, s.t / s.life);
    s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt;
    s.m.scale.x = s.len * Math.min(1, k * 3); s.m.material.opacity = Math.sin(Math.PI * k);
  }
}

/* ------------------------------------------------------------------ input */
const keys = new Set();
const CODE_KEYS = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e' };
const keyOf = e => CODE_KEYS[e.code] || e.key.toLowerCase();
const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
addEventListener('keydown', e => {
  if (typing(e)) return;
  const k = keyOf(e);
  if (hooks.busy()) { keys.clear(); return; }
  keys.add(k);
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if ((k === ' ' || k === 'e' || k === 'enter') && !e.repeat) { if (!hooks.onSpace() && k === ' ') jump(); }
});
addEventListener('keyup', e => { keys.delete(keyOf(e)); keys.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { keys.clear(); last = performance.now(); fpsStart = last; frames = 0; });
const stickEl = document.getElementById('stick'), knob = document.getElementById('stickKnob');
const touch = { id: null, x0: 0, y0: 0, dx: 0, dy: 0, t0: 0 };
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (e.pointerType !== 'mouse') document.body.classList.add('touch');
  if (hooks.busy()) return;
  if (touch.id !== null) { jump(); return; }       // second finger = hop
  touch.id = e.pointerId; touch.x0 = e.clientX; touch.y0 = e.clientY; touch.dx = touch.dy = 0; touch.t0 = performance.now();
  canvas.setPointerCapture(e.pointerId);
  if (stickEl) { stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.hidden = false; stickEl.classList.remove('rest'); knob.style.transform = ''; }
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== touch.id) return;
  let dx = e.clientX - touch.x0, dy = e.clientY - touch.y0; const L = Math.hypot(dx, dy), R = 44;
  if (L > R) { dx *= R / L; dy *= R / L; }
  touch.dx = dx / R; touch.dy = dy / R;
  if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
});
const endTouch = e => {
  if (e.pointerId !== touch.id) return;
  if (performance.now() - touch.t0 < 220 && Math.hypot(touch.dx, touch.dy) < 0.2) jump();   // a quick tap = hop
  touch.id = null; touch.dx = touch.dy = 0; if (stickEl) stickEl.hidden = true;
};
canvas.addEventListener('pointerup', endTouch); canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('contextmenu', e => e.preventDefault());
let zoom = 1;
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(0.6, Math.min(1.6, zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); resize(); }, { passive: false });

let now = 0;
function jump() {
  const sf = player.sf; if (!sf || sf.y > 0.05 || sleeping) return;
  sf.yv = 15; sf.moodOverride = 'wow'; sf.moodUntil = now + 0.7;
  if (hooks.onHop) hooks.onHop();
}

/* ------------------------------------------------------------------ movement + collision */
const SPEED = 17, PR = 1.9;
const tripR = 50;
function pushOut(p, s) {
  if (s.type === 'circle') {
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), m = s.r + PR;
    if (d < m && d > 1e-5) { p.x = s.x + dx / d * m; p.z = s.z + dz / d * m; }
  } else {
    const cx = Math.max(s.x0, Math.min(s.x1, p.x)), cz = Math.max(s.z0, Math.min(s.z1, p.z));
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d < PR) {
      if (d > 1e-5) { p.x = cx + dx / d * PR; p.z = cz + dz / d * PR; }
      else {  // inside: push out the shortest way
        const opts = [[s.x0 - PR - p.x, 0], [s.x1 + PR - p.x, 0], [0, s.z0 - PR - p.z], [0, s.z1 + PR - p.z]];
        opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1])); p.x += opts[0][0]; p.z += opts[0][1];
      }
    }
  }
}
function collide(p) {
  if (!(p === player && vehicleKind === 'plane' && flyH > 2)) for (let pass = 0; pass < 2; pass++) {   // planes fly over everything
    for (const s of solids) if (Math.abs((s.type === 'circle' ? s.x : (s.x0 + s.x1) / 2) - p.x) < 60) pushOut(p, s);
    for (const d of dyn.values()) for (const s of d.solids) pushOut(p, s);
  }
  if (onTrip) {   // on a trip you stay on the island
    const c = tripCenter(onTrip), cx = wx(c.x), cz = wz(c.y), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    if (d > tripR) { p.x = cx + dx / d * tripR; p.z = cz + dz / d * tripR; }
    return;
  }
  if (!(p === player && vehicleKind === 'plane' && flyH > 2)) collideWild(p);
  p.z = Math.max(PL.POLE_N + 2, Math.min(PL.POLE_S - 2, p.z));   // the poles are as far as you can go
}

let flyH = 0, swimming = false;
let boost = 1;   // sw.js speeds up (or slows down) walking and swimming; wheels and wings keep their own speed
function updatePlayer(dt, frozen) {
  const sf = player.sf;
  if (rideNow) { sf.root.position.x = player.x; sf.root.position.z = player.z; return; }
  let ix = 0, iz = 0;
  if (!frozen) {
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (touch.id !== null) { ix += touch.dx; iz += touch.dy; }
  }
  let L = Math.hypot(ix, iz); if (L > 1) { ix /= L; iz /= L; L = 1; }
  const V = VSPEC[vehicleKind || 'walk'];
  // hills: going up is slow, going down is quick (gravity pulls along the slope)
  const sl = slopeAt(player.x, player.z), up = (sl.gx * ix + sl.gz * iz);
  const hillK = vehicleKind === 'plane' && flyH > 2 ? 1 : Math.max(0.45, Math.min(1.35, 1 - up * 0.9));
  const wtr = !vehicleKind || vehicleKind !== 'plane' ? waterAt(player.x, player.z) : null;
  swimming = !!wtr && flyH < 1;
  const max = SPEED * V.max * hillK * (swimming ? 0.55 : 1) * (vehicleKind ? 1 : boost);
  if (!vehicleKind) {
    const k = 1 - Math.exp(-dt * (swimming ? 4 : 12));
    player.vx += (ix * max - player.vx) * k; player.vz += (iz * max - player.vz) * k;
  } else {
    // wheels: speed up with the engine's force, slow down with the brakes, roll on a little when you let go
    const step = (v, target) => { const dv = target - v, a = (Math.abs(target) > Math.abs(v) && Math.sign(target) === Math.sign(v || target)) ? V.acc : (L > 0.1 ? V.brake : V.brake * 0.35); return v + Math.max(-a * dt, Math.min(a * dt, dv)); };
    player.vx = step(player.vx, ix * max); player.vz = step(player.vz, iz * max);
  }
  // a plane climbs to flying height and lands again
  const wantFly = vehicleKind === 'plane' ? 18 : 0;
  flyH += Math.max(-10 * dt, Math.min(8 * dt, wantFly - flyH));
  player.x += player.vx * dt; player.z += player.vz * dt;
  collide(player);
  // all the way round the planet: back into the -C/2..C/2 band around home, and the Wild rebuilds around you
  if (!onTrip && Math.abs(player.x) > PL.C / 2) { const nx = PL.wrapX(player.x), d = nx - player.x; player.x = nx; camTarget.x += d; wildReset(); }
  const sp = Math.hypot(player.vx, player.vz);
  sf.speed = vehicleKind && vehicleKind !== 'bike' ? 0 : sp;
  if (sp > 1 && vehicleKind) sf.targetFace = Math.atan2(player.vx, player.vz);
  else if (L > 0.15) sf.targetFace = Math.atan2(ix, iz);
  if (sf.y > 0 || sf.yv > 0) { sf.yv -= gravity * dt; sf.y = Math.max(0, sf.y + sf.yv * dt); if (sf.y === 0) { sf.yv = 0; sf.moodOverride = 'laugh'; sf.moodUntil = now + 0.5; if (swimming) burst(gxOf(player.x), gyOf(player.z), 'water', 14, 1); } }
  const gh = groundAt(player.x, player.z) + hillH(player.x, player.z);
  sf.ground = swimming ? Math.max(-1.6, gh - 0.2) + Math.sin(now * 3) * 0.25 : gh + flyH + (vehicleKind === 'car' ? 0.3 : vehicleKind === 'bike' || vehicleKind === 'scooter' ? 0.6 : 0);
  if (swimming && sp > 3 && Math.random() < dt * 6) burst(gxOf(player.x), gyOf(player.z), 'water', 3, 0.5);
  if (swimming !== updatePlayer.was) { updatePlayer.was = swimming; if (swimming) { burst(gxOf(player.x), gyOf(player.z), 'water', 18, 1); hooks.onSwim && hooks.onSwim(true); } }
  sf.root.position.x = player.x; sf.root.position.z = player.z;
}

// Sleeping: a sleepy face that stays, little z's rising from your head, and no walking until you wake up
let sleeping = false, zzAt = 0, zzN = 0;
function setSleep(on) {
  on = !!on;
  if (on === sleeping) return;
  sleeping = on;
  const sf = player.sf;
  if (on) { player.vx = player.vz = 0; zzAt = now + 0.4; if (sf) { sf.moodOverride = 'sleepy'; sf.moodUntil = Infinity; } return; }
  if (sf) { sf.moodOverride = null; sf.moodUntil = 0; if (sf.y < 0.05) sf.yv = 9; }   // awake: a little hop
}
function stepSleep() {
  const sf = player.sf;
  if (!sleeping || !sf) return;
  if (now >= sf.moodUntil) { sf.moodOverride = 'sleepy'; sf.moodUntil = Infinity; }   // back to sleepy after any other face
  if (now > zzAt) { zzAt = now + 1.2; zzN++; floatText(gxOf(player.x) + 32, gyOf(player.z), zzN % 2 ? 'z' : 'Zz', 'zz', 7.5); }   // beside the head, clear of the name tag
}
// a new Squareface for you (new colour or hat), carrying on exactly where the old one was
function rebuildMe() {
  const old = player.sf, keep = { y: old.y, yv: old.yv, face: old.face, targetFace: old.targetFace, ground: old.ground }, shown = old.root.visible;
  old.remove();
  const sf = player.sf = makeSquareface({ color: player.color, antenna: COL.roof, hatKind: player.hat, seed: 3 });
  Object.assign(sf, keep); sf.root.visible = shown; addSeeThrough(sf);
  sf.root.position.set(player.x, 0, player.z);
  if (vehicleKind) setVehicle(vehicleKind);
  if (sleeping) { sf.moodOverride = 'sleepy'; sf.moodUntil = Infinity; }
}

// Townsfolk far from you keep walking their routes (cheap), but are hidden and skip the costly animation,
// so a region with many towns runs as smoothly as one town. Well outside the camera's view on any screen.
const NPC_FAR = 240;   // world units (a town is 200 wide); beyond the farthest ground a zoomed-out phone can see
function updateNpcs(dt, t) {
  for (const n of npcs) {
    const sf = n.sf;
    if (n.walker) {
      n.d = (n.d + n.speed * dt) % n.len;
      if (n.d < 0) n.d += n.len;
      let d = n.d, k = 0; while (k < n.segs.length - 1 && d > n.segs[k]) { d -= n.segs[k]; k++; }
      const a = n.pts[k], b = n.pts[k + 1], f = d / n.segs[k];
      const x = a.x + (b.x - a.x) * f, z = a.y + (b.y - a.y) * f;
      if (Math.abs(x - player.x) > NPC_FAR || Math.abs(z - player.z) > NPC_FAR) { sf.root.visible = false; sf.root.position.x = x; sf.root.position.z = z; continue; }
      sf.root.visible = true;
      // step aside if the player is in the way
      const px = player.x - x, pz = player.z - z, pd = Math.hypot(px, pz);
      const near = pd < 5;
      sf.root.position.x = x; sf.root.position.z = z;
      sf.speed = near ? 0 : n.speed;
      if (near) { n.d -= n.speed * dt; sf.targetFace = Math.atan2(px, pz); if (t > sf.moodUntil) { sf.moodOverride = 'love'; sf.moodUntil = t + 1.2; } }
      else sf.targetFace = Math.atan2(b.x - a.x, b.y - a.y);
    } else {
      const px = player.x - n.x, pz = player.z - n.z, pd = Math.hypot(px, pz);
      if (Math.abs(px) > NPC_FAR || Math.abs(pz) > NPC_FAR) { sf.root.visible = false; continue; }
      sf.root.visible = true;
      sf.targetFace = pd < 16 ? Math.atan2(px, pz) : 0;
      sf.speed = 0;
    }
    sf.update(dt, t);
  }
}

/* ------------------------------------------------------------------ camera, resize, loop */
const camTarget = new THREE.Vector3(player.x, 0, player.z);
const camOff = new THREE.Vector3();
const CAM_TILT = 0.72;   // about 41 degrees: low enough to see the fronts of buildings
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // portrait phones: widen the view and step back a little so the town still reads
  const portrait = w < h;
  camera.fov = portrait ? 44 : 32;
  const dist = (portrait ? 110 : 86) / ZOOM * zoom;
  camOff.set(0, Math.sin(CAM_TILT) * dist, Math.cos(CAM_TILT) * dist);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let level = 0;
function setLevel(l) {
  level = l;
  if (l >= 1) { document.body.classList.add('no-tilt'); renderer.setPixelRatio(1); resize(); }
  if (l >= 2) sun.castShadow = false;
}
if (QUALITY === 'low') setLevel(2);
let frames = 0, fpsT = 0, fpsStart = performance.now(), lowFor = 0, last = performance.now(), townT = 0;
function frame() {
  const tNow = performance.now(), dt = Math.min(0.1, (tNow - last) / 1000); last = tNow; now += dt;
  const t = now, busy = hooks.busy();
  updatePlayer(dt, busy || sleeping);
  updateNpcs(dt, t);
  player.sf.update(dt, t);
  syncOthers(dt, t);
  try { hooks.tick(dt); } catch (e) { console.error(e); }
  if ((townT -= dt) <= 0) { townT = 1; updateTown(); }   // crops grow, saplings become trees
  else if ((workT -= dt) <= 0) { workT = 0.25; updateWork(); }   // apples, eggs, milk and ore come back
  for (let i = 0; i < spinners.length; i++) spinners[i].rotation.z -= dt * 0.9;   // windmills turn
  // camera follows with a little lead in the walking direction
  const lead = 0.35, k = 1 - Math.exp(-dt * 4.5);
  camTarget.x += (player.x + player.vx * lead - camTarget.x) * k;
  camTarget.z += (player.z + player.vz * lead - camTarget.z) * k;
  const landY = onTrip ? 0 : Math.max(0, groundAt(player.x, player.z) + hillH(player.x, player.z));
  camTarget.y += (landY - camTarget.y) * k;
  const lift = flyH * 0.8 + camTarget.y;
  camera.position.set(camTarget.x + camOff.x, camOff.y + lift, camTarget.z + camOff.z);
  camera.lookAt(camTarget.x, 2.5 + lift, camTarget.z - 2);
  wildTick(dt);
  // shadow box follows the view, snapped to shadow-map texels so edges do not shimmer
  const texel = (SH * 2) / sun.shadow.mapSize.x;
  const sx = Math.round(camTarget.x / texel) * texel, sz = Math.round((camTarget.z - 10) / texel) * texel;
  sun.target.position.set(sx, camTarget.y, sz); sun.position.set(sx + SUN_DIR.x * 120, camTarget.y + SUN_DIR.y * 120, sz + SUN_DIR.z * 120);
  // props
  hallFlag.rotation.y = Math.sin(t * 2.6) * 0.35 - 0.2;
  drops.visible = fountainOn;
  if (fountainOn) {
    const fp = fountainPos.set(wx(T.PLAZA.x), 5.6, wz(T.PROJECT_SPOTS.fountain.y));
    for (let i = 0; i < DROPS; i++) {
      const ph = (t * 0.9 + i / DROPS) % 1, a = i * 2.39996;
      const r = ph * 2.8, y = fp.y + 0.4 + ph * 5.2 - ph * ph * 7.2;
      _m4.makeTranslation(fp.x + Math.cos(a) * r, Math.max(1.5, y), fp.z + Math.sin(a) * r);
      drops.setMatrixAt(i, _m4);
    }
    drops.instanceMatrix.needsUpdate = true;
  }
  duck.visible = parkOn;
  if (parkOn) {
    duck.position.x = wx(T.PROJECT_SPOTS.park.x) + Math.cos(t * 0.4) * 3.4;
    duck.position.z = wz(T.PROJECT_SPOTS.park.y) + Math.sin(t * 0.4) * 2.2;
    duck.rotation.y = -t * 0.4 - Math.PI;
    duck.position.y = 0.05 + Math.sin(t * 2) * 0.06;
  }
  bus.visible = busOn;
  if (busOn) {
    // up and down the main road, with a rest at the bus stop
    const x0 = wx(3700), x1 = wx(5950), span = x1 - x0, per = span / 9 + 6, ph = (t % (per * 2)) / per;
    const go = ph < 1 ? ph : 2 - ph, pos = Math.max(0, Math.min(1, (go * per - 3) / (per - 6)));
    bus.position.set(x0 + pos * span, 0, wz(1760) + (ph < 1 ? 2.2 : -2.2));
    bus.rotation.y = ph < 1 ? 0 : Math.PI;
  }
  updateHome(t); updatePickups(t); stepSleep(); stepRainbow(dt); stepShoots(dt, t);
  updateEffects(dt, t);
  stepBalls(dt); stepFalling(dt); stepRide(dt); updateGuide(t);
  stepRain(dt, !!(hooks.raining && hooks.raining()) && !onTrip);
  player.sf.root.updateMatrixWorld(); npcs.forEach(n => { if (n.sf.root.visible) n.sf.root.updateMatrixWorld(); }); others.forEach(r => r.sf.root.updateMatrixWorld());
  updateLimbs();
  updateBlobs([player.sf, ...npcs.map(n => n.sf), ...[...others.values()].map(r => r.sf)].filter(sf => sf.root.visible));
  renderer.render(scene, camera);
  updateTags(); updateFloats(dt);
  // quietly step down on slow devices: first the tilt-shift blur and extra pixels, then the shadows
  frames++; fpsT = (tNow - fpsStart) / 1000;
  if (fpsT > 2) { frames = 0; fpsStart = tNow; }   // the tab was hidden or the page stalled: not a slow device
  else if (fpsT >= 0.5) {
    const fps = frames / fpsT;
    window.__fps = fps; window.__draws = renderer.info.render.calls;
    lowFor = fps < (level === 0 ? 40 : 28) ? lowFor + fpsT : 0;
    if (lowFor > 3 && QUALITY === 'auto' && level < 2) { lowFor = 0; setLevel(level + 1); }
    frames = 0; fpsStart = tNow;
  }
}

/* ------------------------------------------------------------------ what the game can ask the world */
let started = false;
window.World = {
  async start(h) {
    Object.assign(hooks, h || {});
    if (started) return;
    started = true;
    // let the Baloo font arrive before sign text is painted (but never wait long)
    if (document.fonts) await Promise.race([Promise.all([document.fonts.load('800 44px "Baloo 2"'), document.fonts.load('20px "Bagel Fat One"')]), new Promise(r => setTimeout(r, 1500))]).catch(() => {});
    buildAll();
    updateTown(null);
    setDay(0.2);
    window.__sw3d = { scene, renderer, camera, player };
    renderer.setAnimationLoop(frame);
  },
  setTown(town) { updateTown(town); },
  // hat: one of World.hats, or '' / null for none; leave it out to keep the current one
  setMe({ color, hat } = {}) {
    const c = color || player.color, h = hat === undefined ? player.hat : hatOf(hat), changed = c !== player.color || h !== player.hat;
    player.color = c; player.hat = h;
    if (player.sf && changed) rebuildMe();
  },
  hats: HATS,
  pos: () => ({ x: gxOf(player.x), y: gyOf(player.z) }),
  place(gx, gy) { player.x = wx(gx); player.z = wz(gy); player.vx = player.vz = 0; collide(player); camTarget.set(player.x, 0, player.z); if (player.sf) player.sf.root.position.set(player.x, 0, player.z); },
  state() { const sf = player.sf; return { moving: Math.hypot(player.vx, player.vz) > 1, face: sf ? Math.atan2(Math.sin(sf.face), Math.cos(sf.face)) / Math.PI : 0, hop: sf ? Math.round(sf.y * 10) : 0, mood: sf && now < sf.moodUntil ? sf.moodOverride : 'happy' }; },
  mood(m, secs = 1.5) { if (player.sf) { player.sf.moodOverride = m; player.sf.moodUntil = now + secs; } },
  npcMood(id, m, secs = 1.5) { const k = keepers.find(x => x.id === id); if (k) { k.sf.moodOverride = m; k.sf.moodUntil = now + secs; } },
  hop: jump,
  say, floatText, burst,
  markers(list) { markList = list || []; },
  celebrate(secs = 30) { celebrateUntil = now + secs; },
  setDay,
  get night() { return nightK; },
  keepers,
  toScreen(gx, gy, h = 0) { return toScreen(wx(gx), h, wz(gy)); },
  get busTo() { return busOn; },
  get busOn() { return busOn; },
  // physics and travel
  fellTree, addBall,
  ride(kind, from, to, done) { ride(kind, from, to, done); },
  get riding() { return !!rideNow; },
  setVehicle(kind) { setVehicle(kind); },
  get vehicle() { return vehicleKind; },
  get flying() { return flyH > 2; },
  get swimming() { return swimming; },
  setBoost(k) { boost = Math.max(0.2, Math.min(3, +k || 1)); },
  get boost() { return boost; },
  sleep(on) { setSleep(on); },
  get sleeping() { return sleeping; },
  // pickups: [{id, x, y, kind: 'coin'|'star'|'pot'}] in game px; hooks.onPickup(id, kind) fires once when you walk into one
  addPickups(list) { addPickups(list); },
  clearPickups(prefix, forget) { clearPickups(prefix, forget); },
  pickups: () => picks.map(p => ({ id: p.id, kind: p.kind, x: gxOf(p.x), y: gyOf(p.z) })),
  // the planet around the towns (game px in, game px out)
  inWild: (gx, gy) => !inRegion(wx(gx), wz(gy)) && gy < TRIP_Y / 2,
  onTrip: () => !!onTrip,
  planetAt: (gx, gy) => PL.sample(wx(gx), wz(gy)),
  wildSpots: () => { const out = []; wild.forEach(c => c.spots.forEach(q => out.push({ id: q.id, type: q.type, biome: q.biome, pole: q.pole, x: gxOf(q.x), y: gyOf(q.z) }))); return out; },
  get wildVersion() { return wildVersion; },
  get wildChunks() { return wild.size; },
  // wonders
  rainbow(on, gx, gy) { setRainbow(on, gx, gy); },
  shootingStars(on) { setShootingStars(on); },
  guide(t) { guideTarget = t || null; },
  hillAt: (gx, gy) => hillH(wx(gx), wz(gy)),
  goTrip(id) {
    buildTrip(id); onTrip = id; gravity = id === 'moon' ? GRAV / 6 : GRAV;
    const c = tripCenter(id); this.place(c.x, c.y + 280); return TRIP_SPOT[id];
  },
  endTrip(gx, gy) { onTrip = null; gravity = GRAV; this.place(gx, gy); },
  get trip() { return onTrip; },
  tripSpots: (id) => TRIP_SPOT[id] || [],
};
dispatchEvent(new Event('world-ready'));
