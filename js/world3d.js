// Small World in 3D: Small Town as a tiny tilt-shift diorama you can walk around.
// The layout and rules come from js/town.js (global Town); the Squareface screen faces are drawn by js/art.js (drawFace).
// Everything is procedural low-poly, made with three.js: no downloaded models. Static scenery is merged into a few
// vertex-coloured meshes (plus inverted-hull outlines), trees are InstancedMeshes, and the parts of town that change
// (farms, houses, the forest, town projects) are small groups rebuilt only when the shared town changes.
// The game logic lives in js/sw.js and talks to this file through window.World.
import * as THREE from './vendor/three.module.min.js';

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
const SLAB = { x0: 3380, x1: 6220, y0: -160, y1: 2780 };  // the diorama board, in game px

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
    const ol = (o.ol ?? 0.12) * OLS, ao = o.ao ?? 0, g = e.g, pos = g.attributes.position, nor = g.attributes.normal;
    tmpM3.getNormalMatrix(m);
    tmpC.set(color);
    const span = Math.max(1e-6, e.maxY - e.minY);
    for (let i = 0; i < pos.count; i++) {
      tmpV.fromBufferAttribute(pos, i);
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
  B.add(GEO.rbox(w, h, 0.45, 0.35, 2), M(c.x, c.y, c.z, ry), o.color || COL.paper, { ol: 0.09 });
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
const foot = b => { const s = BSPEC[b.id], zf = wz(b.y - 45); return { x0: wx(b.x - b.w / 2), x1: wx(b.x + b.w / 2), z0: zf - s.d, z1: zf, zf, cx: wx(b.x) }; };

function freeSpot(gx, gy, pad) {
  if (gx < SLAB.x0 + 30 || gx > SLAB.x1 - 30 || gy < SLAB.y0 + 30 || gy > SLAB.y1 - 30) return false;
  for (const r of T.ROADS) if (segDist(gx, gy, r) < 50 + pad) return false;
  for (const b of T.BUILDINGS) { const s = BSPEC[b.id]; if (gx > b.x - b.w / 2 - pad && gx < b.x + b.w / 2 + pad && gy > b.y - 45 - s.d * 10 - pad && gy < b.y + 90 + pad) return false; }   // keep the doorstep and the townsfolk clear
  for (const p of T.PLOTS) if (gx > p.x - pad && gx < p.x + p.w + pad && gy > p.y - pad && gy < p.y + p.h + pad) return false;
  const F = T.TOWN_FARM; if (gx > F.x - pad && gx < F.x + F.w + pad && gy > F.y - pad && gy < F.y + F.h + pad) return false;
  if (Math.hypot(gx - T.PLAZA.x, gy - T.PLAZA.y) < T.PLAZA.r + 20 + pad) return false;
  if (gx > 3660 - pad && gx < 4580 + pad && gy > 120 - pad && gy < 840 + pad) return false;   // the forest has its own trees
  const PS = T.PROJECT_SPOTS; if (Math.hypot(gx - PS.park.x, gy - PS.park.y) < 170 + pad) return false;
  for (const k of ['library', 'clinic']) if (Math.abs(gx - PS[k].x) < 110 + pad && gy > PS[k].y - 130 - pad && gy < PS[k].y + 60 + pad) return false;
  if (Math.hypot(gx - 3740, gy - 1760) < 150 + pad) return false;   // bus stop + welcome sign
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
  // fluffy clouds drifting beside the floating board
  const cr = rng(5);
  for (let i = 0; i < 16; i++) {
    const side = i % 4, t = cr();
    const gx = side === 0 ? SLAB.x0 - 120 - cr() * 200 : side === 1 ? SLAB.x1 + 120 + cr() * 200 : SLAB.x0 - 200 + t * (SLAB.x1 - SLAB.x0 + 400);
    const gy = side === 2 ? SLAB.y0 - 140 - cr() * 220 : side === 3 ? SLAB.y1 + 300 : SLAB.y0 + t * (SLAB.y1 - SLAB.y0);
    if (side === 3) continue;
    const cx = wx(gx), cz = wz(gy), cy = -6 + cr() * 8, sc = 1 + cr() * 1.2;
    [[0, 0, 3.2], [3.4, -0.6, 2.4], [-3.2, -0.8, 2.2], [1.2, 1.6, 2.2]].forEach(([dx, dy, r]) => W.add(GEO.ico(r * sc, 1), M(cx + dx * sc, cy + dy * sc, cz, 0, 0, 0, 1, 0.8, 1), '#ffffff', { ol: 0.12 }));
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
      if (px <= SLAB.x0 + 4) return;
      W.add(GEO.disc(4.8, 20), M(wx(px), H1 - 0.005, wz(py)), COL.roadEdge, { ol: 0 });
      W.add(GEO.disc(4.0, 20), M(wx(px), H2 - 0.004, wz(py)), COL.road, { ol: 0 });
    });
  });
  // dashes on the main road
  for (let x = SLAB.x0 + 40; x < T.X1 - 30; x += 60) W.add(GEO.box(2.6, 0.04, 0.45), M(wx(x), 0.115, wz(1760)), '#ffffff', { ol: 0 });
  // zebra crossing in front of the plaza
  for (let i = 0; i < 5; i++) W.add(GEO.box(1.1, 0.04, 6.4), M(wx(4760 + i * 20), 0.118, wz(1760)), '#fffaf0', { ol: 0 });
  // plaza
  const P = T.PLAZA;
  W.add(GEO.disc(P.r * S + 1.2, 40), M(wx(P.x), 0.14, wz(P.y)), COL.roadEdge, { ol: 0 });
  W.add(GEO.disc(P.r * S, 40), M(wx(P.x), 0.17, wz(P.y)), COL.plaza, { ol: 0 });
  for (let r = 4; r < P.r * S; r += 3.6) W.add(GEO.ring(r - 0.12, r + 0.12, 40), M(wx(P.x), 0.18, wz(P.y)), '#dfd0aa', { ol: 0 });
}

function window3(B, x, y, z, w = 2.6, h = 2.6, ry = 0, lit = COL.glass) {
  B.add(GEO.rbox(w, h, 0.5, 0.35, 2), M(x, y, z, ry), lit, { ol: 0.08 });
  const r = new THREE.Matrix4().makeRotationY(ry), o = new THREE.Vector3(0, 0, 0.26).applyMatrix4(r);
  B.add(GEO.box(0.16, h - 0.3, 0.1), M(x + o.x, y, z + o.z, ry), INKC, { ol: 0 });
  B.add(GEO.box(w - 0.3, 0.16, 0.1), M(x + o.x, y, z + o.z, ry), INKC, { ol: 0 });
  B.add(GEO.box(w * 0.36, 0.16, 0.1), M(x + o.x - w * 0.22, y + h * 0.28, z + o.z + 0.02, ry), '#ffffff', { ol: 0 });
}
function door3(B, x, z, color = COL.dirt, w = 3.6, h = 5.4) {
  B.add(GEO.rbox(w, h, 0.6, 0.5, 2), M(x, h / 2, z), color, { ol: 0.09 });
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
      gx = side === 0 ? SLAB.x0 + inset : side === 1 ? SLAB.x1 - inset : SLAB.x0 + t * (SLAB.x1 - SLAB.x0);
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
    m.compose(_p.set(it.x, 0, it.z), _q.setFromEuler(_e.set(0, it.r * 2.3, 0)), _s.setScalar(it.s));
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
    const list = L.socks.filter(s => s.parent && s.visibleNow !== false).slice(0, LIMB_MAX);
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
      this.root.position.y = this.y;
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
    _bm.compose(_p.set(p.x, groundAt(p.x, p.z) + 0.03, p.z), _q.identity(), _s.set(2.3 * k, 1, 1.9 * k));
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

/* ------------------------------------------------------------------ build everything */
const player = { x: wx(4040), z: wz(2230), vx: 0, vz: 0, sf: null, color: COL.teal };
const npcs = [], others = new Map(), keepers = [];
let bus = null;
function buildAll() {
  buildGround();
  T.BUILDINGS.forEach(buildBuilding);
  buildPlaza();
  buildTownFarm();
  buildForestStatic();
  buildDecor();
  W.meshes().forEach(m => { m.matrixAutoUpdate = false; m.children.forEach(c => { c.matrixAutoUpdate = false; }); scene.add(m); });
  buildTrees();
  scene.add(TEXT.mesh());
  TEXT.repaintWhenFontArrives();

  // the player + the townsfolk
  player.sf = makeSquareface({ color: player.color, antenna: COL.roof, seed: 3 });
  addSeeThrough(player.sf);
  T.BUILDINGS.forEach((b, i) => {
    const f = foot(b), n = b.npc;
    const sf = makeSquareface({ color: n.color, antenna: n.color, hatKind: n.hat, seed: 10 + i });
    const x = f.cx + (i % 2 ? 9 : -9), z = f.zf + 2.8;
    sf.root.position.set(x, 0, z); sf.targetFace = sf.face = 0;
    npcs.push({ sf, x, z, home: true, name: n.name, b });
    keepers.push({ id: b.id, name: n.name, x: gxOf(x), y: gyOf(z), sf });
    addCircleSolid(x, z, 1.8);
  });
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

/* ------------------------------------------------------------------ the parts of town that follow the shared town */
let townNow = null;
function updateTown(town) {
  const now = hooks.now();
  if (town) townNow = town;
  town = townNow;
  T.PLOTS.forEach(p => { const st = town && town.plots[p.id]; setPart('plot:' + p.id, plotSig(p, st, now), B => buildPlot(B, p, st, now)); });
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
    if (!r || r.color !== o.color) {
      if (r) r.sf.remove();
      r = { sf: makeSquareface({ color: o.color, antenna: o.color, seed: 50 + o.id * 7 }), color: o.color, x: wx(o.x), z: wz(o.y) };
      others.set(o.id, r);
    }
    const tx = wx(o.tx ?? o.x), tz = wz(o.ty ?? o.y), px = r.x, pz = r.z;
    if (Math.hypot(tx - r.x, tz - r.z) > 40) { r.x = tx; r.z = tz; }
    const k = 1 - Math.exp(-dt * 9);
    r.x += (tx - r.x) * k; r.z += (tz - r.z) * k;
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
  _v.set(x, y, z).project(camera);
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
  if (player.sf) showTag('me', player.sf, info.me ? info.me.name : '', info.me && info.me.sub, { color: player.color, talking: info.me && info.me.talking });
  others.forEach((r, id) => {
    const o = r.data || {}, i = (info.others && info.others(id)) || {};
    showTag(id, r.sf, o.name || '', o.ti || '', { color: r.color, talking: i.talking });
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
function floatText(gx, gy, text, cls = '') {
  const el = document.createElement('div'); el.className = 'float ' + cls; el.textContent = text; tagBox.appendChild(el);
  floats.push({ el, x: wx(gx), z: wz(gy), y: 9, t: 0 });
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
  renderer.setClearColor(sky, 1); scene.fog.color.copy(fog);
  hemi.intensity = 2.05 * light; sun.intensity = 1.35 * (light - 0.25 * nightK);
  sun.color.copy(_c2.set('#fff1d6').lerp(new THREE.Color(h > 17 ? '#ffb27a' : '#fff1d6'), h > 17 ? Math.min(1, (h - 17) / 2) * (1 - nightK) : 0).lerp(new THREE.Color('#9fa6ff'), nightK));
  hemi.color.set('#fff6e8').lerp(new THREE.Color('#aab0ff'), nightK * 0.6);
  if (lampGlow) { lampGlow.visible = lightsOn && nightK > 0.05; lampGlow.material.opacity = 0.55 * nightK; }
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
  const sf = player.sf; if (!sf || sf.y > 0.05) return;
  sf.yv = 15; sf.moodOverride = 'wow'; sf.moodUntil = now + 0.7;
  if (hooks.onHop) hooks.onHop();
}

/* ------------------------------------------------------------------ movement + collision */
const SPEED = 17, PR = 1.9;
const BOUND = { x0: wx(SLAB.x0) + 3, x1: wx(SLAB.x1) - 3, z0: wz(SLAB.y0) + 3, z1: wz(SLAB.y1 - 150) };
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
  for (let pass = 0; pass < 2; pass++) {
    for (const s of solids) pushOut(p, s);
    for (const d of dyn.values()) for (const s of d.solids) pushOut(p, s);
  }
  p.x = Math.max(BOUND.x0, Math.min(BOUND.x1, p.x)); p.z = Math.max(BOUND.z0, Math.min(BOUND.z1, p.z));
}

function updatePlayer(dt, frozen) {
  let ix = 0, iz = 0;
  if (!frozen) {
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('w') || keys.has('arrowup')) iz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) iz += 1;
    if (touch.id !== null) { ix += touch.dx; iz += touch.dy; }
  }
  let L = Math.hypot(ix, iz); if (L > 1) { ix /= L; iz /= L; L = 1; }
  const k = 1 - Math.exp(-dt * 12);
  player.vx += (ix * SPEED - player.vx) * k; player.vz += (iz * SPEED - player.vz) * k;
  player.x += player.vx * dt; player.z += player.vz * dt;
  collide(player);
  const sf = player.sf, sp = Math.hypot(player.vx, player.vz);
  sf.speed = sp;
  if (L > 0.15) sf.targetFace = Math.atan2(ix, iz);
  if (sf.y > 0 || sf.yv > 0) { sf.yv -= 42 * dt; sf.y = Math.max(0, sf.y + sf.yv * dt); if (sf.y === 0) { sf.yv = 0; sf.moodOverride = 'laugh'; sf.moodUntil = now + 0.5; } }
  sf.root.position.x = player.x; sf.root.position.z = player.z;
}

function updateNpcs(dt, t) {
  for (const n of npcs) {
    const sf = n.sf;
    if (n.walker) {
      n.d = (n.d + n.speed * dt) % n.len;
      if (n.d < 0) n.d += n.len;
      let d = n.d, k = 0; while (k < n.segs.length - 1 && d > n.segs[k]) { d -= n.segs[k]; k++; }
      const a = n.pts[k], b = n.pts[k + 1], f = d / n.segs[k];
      const x = a.x + (b.x - a.x) * f, z = a.y + (b.y - a.y) * f;
      // step aside if the player is in the way
      const px = player.x - x, pz = player.z - z, pd = Math.hypot(px, pz);
      const near = pd < 5;
      sf.root.position.x = x; sf.root.position.z = z;
      sf.speed = near ? 0 : n.speed;
      if (near) { n.d -= n.speed * dt; sf.targetFace = Math.atan2(px, pz); if (t > sf.moodUntil) { sf.moodOverride = 'love'; sf.moodUntil = t + 1.2; } }
      else sf.targetFace = Math.atan2(b.x - a.x, b.y - a.y);
    } else {
      const px = player.x - n.x, pz = player.z - n.z, pd = Math.hypot(px, pz);
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
  updatePlayer(dt, busy);
  updateNpcs(dt, t);
  player.sf.update(dt, t);
  syncOthers(dt, t);
  try { hooks.tick(dt); } catch (e) { console.error(e); }
  if ((townT -= dt) <= 0) { townT = 1; updateTown(); }   // crops grow, saplings become trees
  // camera follows with a little lead in the walking direction
  const lead = 0.35, k = 1 - Math.exp(-dt * 4.5);
  camTarget.x += (player.x + player.vx * lead - camTarget.x) * k;
  camTarget.z += (player.z + player.vz * lead - camTarget.z) * k;
  camera.position.set(camTarget.x + camOff.x, camOff.y, camTarget.z + camOff.z);
  camera.lookAt(camTarget.x, 2.5, camTarget.z - 2);
  // shadow box follows the view, snapped to shadow-map texels so edges do not shimmer
  const texel = (SH * 2) / sun.shadow.mapSize.x;
  const sx = Math.round(camTarget.x / texel) * texel, sz = Math.round((camTarget.z - 10) / texel) * texel;
  sun.target.position.set(sx, 0, sz); sun.position.set(sx + SUN_DIR.x * 120, SUN_DIR.y * 120, sz + SUN_DIR.z * 120);
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
  updateEffects(dt, t);
  player.sf.root.updateMatrixWorld(); npcs.forEach(n => n.sf.root.updateMatrixWorld()); others.forEach(r => r.sf.root.updateMatrixWorld());
  updateLimbs();
  updateBlobs([player.sf, ...npcs.map(n => n.sf), ...[...others.values()].map(r => r.sf)]);
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
  setMe({ color }) {
    if (!player.sf || color === player.color) { player.color = color || player.color; return; }
    player.color = color; const y = player.sf.y;
    player.sf.remove(); player.sf = makeSquareface({ color, antenna: COL.roof, seed: 3 }); player.sf.y = y; addSeeThrough(player.sf);
    player.sf.root.position.set(player.x, 0, player.z);
  },
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
};
dispatchEvent(new Event('world-ready'));
