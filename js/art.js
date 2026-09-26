// All drawing: characters, world objects, icons. Pure canvas, no image files.
const INK = '#34233f';
const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}
function fillStroke(ctx, fill, lw = 3, stroke = INK) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
// Draw a path twice: dark outline then colored noodle on top
function noodleStroke(ctx, pathFn, color, width) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  pathFn(); ctx.strokeStyle = INK; ctx.lineWidth = width + 5; ctx.stroke();
  pathFn(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* ---------------- Squareface Guy ---------------- */
function drawFace(ctx, mood, t, cx, cy, s = 1) {
  const glow = '#9ff3ff';
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = glow; ctx.fillStyle = glow;
  ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = glow; ctx.shadowBlur = 5;
  // big friendly eyes: rounded ovals with a little shine
  const eye = (x, y, dx = 0, dy = 0) => {
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(x, y, 3.4, 4.6, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#1f1a2e'; circle(ctx, x + 1 + dx, y - 1.6 + dy, 1.2); ctx.fill(); ctx.shadowBlur = 5; ctx.fillStyle = glow;
  };
  const closed = (x, y, up = true) => { ctx.beginPath(); up ? ctx.arc(x, y + 2, 3.6, Math.PI * 1.15, Math.PI * 1.85) : ctx.arc(x, y - 2, 3.6, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); };
  const smile = (w = 7, y = 4, depth = 4) => { ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + depth * 2, w, y); ctx.stroke(); };
  switch (mood) {
    case 'blink': closed(-8, -3); closed(8, -3); smile(); break;
    case 'crunch': {
      ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-6, -3); ctx.lineTo(-11, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11, -6); ctx.lineTo(6, -3); ctx.lineTo(11, 0); ctx.stroke();
      const m = 2.5 + Math.abs(Math.sin(t * 22)) * 3.5;
      ctx.beginPath(); ctx.ellipse(0, 6, 5.5, m, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'thirsty':
      eye(-8, -2); eye(8, -2);
      ctx.fillStyle = '#1f1a2e'; ctx.shadowBlur = 0; ctx.fillRect(-12, -8, 8, 3.5); ctx.fillRect(4, -8, 8, 3.5); ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.ellipse(0, 7, 5, 3.5, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ff9fb5'; ctx.shadowColor = '#ff9fb5';
      ctx.beginPath(); ctx.ellipse(1, 10 + Math.sin(t * 6) * 0.8, 2.6, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = glow; ctx.shadowColor = glow;
      ctx.beginPath(); ctx.moveTo(14, -10); ctx.quadraticCurveTo(17, -5, 14, -3); ctx.quadraticCurveTo(11, -5, 14, -10); ctx.fill();
      break;
    case 'cool':
      rr(ctx, -14, -8, 12, 8, 3); ctx.fill(); rr(ctx, 2, -8, 12, 8, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(2, -5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 6); ctx.quadraticCurveTo(2, 10, 8, 4); ctx.stroke();
      break;
    case 'sleepy':
      closed(-8, -2, false); closed(8, -2, false);
      ctx.beginPath(); ctx.ellipse(0, 7, 2.4, 2.8, 0, 0, TAU); ctx.stroke();
      break;
    case 'think': {
      const look = Math.sin(t * 2) * 0.8;
      eye(-8, -3, 0.8 + look, -1); eye(8, -3, 0.8 + look, -1);
      ctx.beginPath(); ctx.moveTo(-3, 6); ctx.quadraticCurveTo(0, 8, 3, 6); ctx.stroke();
      ctx.font = '800 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?', 13, -7);
      break;
    }
    case 'wow': {
      const star = (x, y) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 2.2 : 5.4; const a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); };
      star(-8, -3); star(8, -3);
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(7, 3); ctx.quadraticCurveTo(7, 11, 0, 11); ctx.quadraticCurveTo(-7, 11, -7, 3); ctx.fill();
      break;
    }
    case 'swim':
      closed(-8, -3); closed(8, -3);
      ctx.beginPath(); ctx.ellipse(0, 6, 3.5, 3, 0, 0, TAU); ctx.stroke();
      break;
    default: // happy
      eye(-8, -3); eye(8, -3); smile(7, 4, 3.5);
  }
  ctx.restore();
}

function drawHead(ctx, x, y, mood, t, opts = {}) {
  // x,y = centre of head
  const w = 48, h = 42;
  // antenna
  const ab = opts.antennaPulse || 0;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 6, y - h / 2); ctx.quadraticCurveTo(x + 10, y - h / 2 - 10, x + 8 + Math.sin(t * 3) * 2, y - h / 2 - 17); ctx.stroke();
  const ax = x + 8 + Math.sin(t * 3) * 2, ay = y - h / 2 - 19;
  if (ab > 0) {
    ctx.fillStyle = `rgba(255,210,63,${0.35 * ab})`;
    circle(ctx, ax, ay, 6 + ab * 10); ctx.fill();
  }
  circle(ctx, ax, ay, 5); fillStroke(ctx, opts.golden ? '#ffd23f' : (ab > 0.5 ? '#ffd23f' : (opts.color || '#e4572e')), 2.5);
  // head shell
  rr(ctx, x - w / 2, y - h / 2, w, h, 11); fillStroke(ctx, '#f7f1e3', 3);
  ctx.fillStyle = 'rgba(52,35,63,0.12)'; rr(ctx, x - w / 2 + 3, y + h / 2 - 8, w - 6, 5, 3); ctx.fill();
  // screen
  rr(ctx, x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 13, 7); fillStroke(ctx, '#1f1a2e', 2);
  ctx.save(); rr(ctx, x - w / 2 + 6, y - h / 2 + 6, w - 12, h - 13, 7); ctx.clip();
  drawFace(ctx, mood, t, x + (opts.look || 0) * 2, y - 1, 0.85);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x - w / 2 + 6, y - h / 2 + 6, w - 12, 8);
  ctx.restore();
  // cheeks
  ctx.fillStyle = 'rgba(255,140,160,0.55)';
  circle(ctx, x - w / 2 + 3, y + 6, 3); ctx.fill(); circle(ctx, x + w / 2 - 3, y + 6, 3); ctx.fill();
}

function drawPlayer(ctx, p, t) {
  const { x, y } = p;
  if (p.swimming) {
    // ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.8 + i * 0.5) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.beginPath(); ctx.ellipse(x, y, 26 + k * 22, 10 + k * 8, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawHead(ctx, x, y - 16 + Math.sin(t * 4) * 2, p.mood, t, { antennaPulse: p.antennaPulse, look: p.face, color: p.color, golden: p.goldAntenna });
    if (p.hat) drawHat(ctx, x, y - 37 + Math.sin(t * 4) * 2, p.hat, t, false);
    ctx.fillStyle = 'rgba(95,208,230,0.75)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 30, 9, 0, 0, Math.PI); ctx.fill();
    return;
  }
  const z = p.z || 0;
  const air = z > 2;
  const bob = air ? 0 : p.moving ? Math.abs(Math.sin(p.walk * 2)) * 3 : Math.sin(t * 2) * 0.8;
  const hoodie = p.color || '#2fa4b5';
  // shadow stays on the ground and shrinks as you rise
  const sh = Math.max(0.35, 1 - z / 220);
  ctx.fillStyle = `rgba(52,35,63,${0.22 * sh})`;
  ctx.beginPath(); ctx.ellipse(x, y, 20 * sh, 7 * sh, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(0, -z);
  // noodle wings while in the air
  if (air && p.wings) {
    const flap = Math.sin(t * (p.flapping ? 26 : 8)) * (p.flapping ? 0.7 : 0.25);
    [-1, 1].forEach(side => {
      ctx.save(); ctx.translate(x + side * 12, y - 30); ctx.scale(side, 1); ctx.rotate(-0.3 - flap);
      for (let k = 0; k < 3; k++) noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(0, k * 4); ctx.quadraticCurveTo(18, -14 + k * 6, 34 - k * 5, -4 + k * 7); }, '#f7dc7a', 3);
      ctx.restore();
    });
  }
  // legs
  const lg = p.moving && !air ? Math.sin(p.walk * 2) * 5 : 0;
  ctx.fillStyle = INK;
  rr(ctx, x - 10, y - 12 + Math.max(0, lg) - (air ? 2 : 0), 8, 12, 3); ctx.fill();
  rr(ctx, x + 2, y - 12 + Math.max(0, -lg) - (air ? 2 : 0), 8, 12, 3); ctx.fill();
  // body (little hoodie)
  rr(ctx, x - 15, y - 34 - bob, 30, 26, 10); fillStroke(ctx, hoodie, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(ctx, x - 7, y - 26 - bob, 14, 7, 3); ctx.fill();
  // arms: up in the air when jumping
  const arm = p.crunching > 0 ? -8 : air ? -12 : (p.moving ? Math.sin(p.walk * 2) * 4 : 0);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 14, y - 26 - bob); ctx.lineTo(x - 19, y - 16 - bob + arm); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 14, y - 26 - bob); ctx.lineTo(x + 19, y - 16 - bob + (air ? arm : -arm)); ctx.stroke();
  drawHead(ctx, x, y - 56 - bob, p.mood, t, { antennaPulse: p.antennaPulse, look: p.face, color: p.color, golden: p.goldAntenna });
  if (p.hat) drawHat(ctx, x, y - 77 - bob, p.hat, t, p.z > 2);
  if (p.suit) {
    // space helmet: a glass bubble over the square head
    circle(ctx, x, y - 58 - bob, 36); ctx.fillStyle = 'rgba(191,233,255,0.22)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 58 - bob, 29, Math.PI * 1.1, Math.PI * 1.4); ctx.stroke();
    rr(ctx, x - 16, y - 26 - bob, 32, 6, 3); fillStroke(ctx, '#e9eef4', 2);
  }
  ctx.restore();
}

// Name tag and emote bubble over a player
function drawTag(ctx, x, y, name, color, emote) {
  ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(name).width + 18;
  rr(ctx, x - w / 2, y - 11, w, 22, 11); fillStroke(ctx, '#fff8e8', 2.5);
  ctx.fillStyle = color; circle(ctx, x - w / 2 + 9, y, 4); ctx.fill();
  ctx.fillStyle = INK; ctx.fillText(name, x + 4, y + 1);
  if (emote) {
    const by = y - 40;
    rr(ctx, x - 24, by - 20, 48, 40, 14); fillStroke(ctx, '#fff8e8', 2.5);
    ctx.beginPath(); ctx.moveTo(x - 6, by + 19); ctx.lineTo(x, by + 28); ctx.lineTo(x + 6, by + 19); ctx.closePath(); fillStroke(ctx, '#fff8e8', 0);
    ctx.font = '24px sans-serif'; ctx.fillText(emote, x, by + 1);
  }
}

/* ---------------- Grandma Ramen & the Oracle ---------------- */
function drawGrandma(ctx, x, y, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const b = Math.sin(t * 2) * 1.5;
  // body: an apron shaped like a ramen bowl
  ctx.beginPath(); ctx.moveTo(-26, -34); ctx.lineTo(26, -34); ctx.quadraticCurveTo(26, 0, 0, 2); ctx.quadraticCurveTo(-26, 0, -26, -34); ctx.closePath();
  fillStroke(ctx, '#e4572e', 3);
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-18, -22); for (let i = -18; i <= 18; i += 6) ctx.lineTo(i, -22 + ((i / 6) % 2 ? -4 : 0)); ctx.stroke();
  // head
  circle(ctx, 0, -54 + b, 22); fillStroke(ctx, '#ffe0c2', 3);
  // bun of noodles
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(0, -80 + b, 13 - i * 4, 0, TAU);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#f7dc7a'; ctx.lineWidth = 3.5; ctx.stroke();
  }
  ctx.restore();
  // chopsticks
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-18, -96 + b); ctx.lineTo(14, -70 + b); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -100 + b); ctx.lineTo(18, -74 + b); ctx.stroke();
  // glasses + happy eyes
  ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
  circle(ctx, -8, -55 + b, 6.5); ctx.stroke(); circle(ctx, 8, -55 + b, 6.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1.5, -55 + b); ctx.lineTo(1.5, -55 + b); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, -54 + b, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, -54 + b, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -45 + b, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,140,0.5)'; circle(ctx, -15, -46 + b, 4); ctx.fill(); circle(ctx, 15, -46 + b, 4); ctx.fill();
  ctx.restore();
}

function drawOracle(ctx, x, y, t, s = 1, lit = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // mystic steam
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.4 + i / 3) % 1;
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = '#b98cff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10 + i * 10, -30 - k * 40);
    ctx.bezierCurveTo(-20 + i * 10, -40 - k * 40, 0 + i * 10, -50 - k * 40, -8 + i * 10, -62 - k * 40);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // bowl
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 8, 40, 9, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, -28, 40, 11, 0, 0, TAU); fillStroke(ctx, '#6a4a86', 3);
  ctx.beginPath(); ctx.moveTo(-40, -28); ctx.quadraticCurveTo(-40, 6, 0, 6); ctx.quadraticCurveTo(40, 6, 40, -28); ctx.ellipse(0, -28, 40, 11, 0, 0, Math.PI, false); ctx.closePath();
  fillStroke(ctx, '#2fa4b5', 3);
  ctx.fillStyle = '#ffd23f';
  for (let i = -2; i <= 2; i++) { circle(ctx, i * 13, -8 + Math.abs(i) * -2, 2); ctx.fill(); }
  // eyes
  const blink = (Math.sin(t * 1.3) > 0.97);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  [-13, 13].forEach(ex => {
    if (blink) { ctx.beginPath(); ctx.moveTo(ex - 6, -16); ctx.lineTo(ex + 6, -16); ctx.stroke(); return; }
    ctx.beginPath(); ctx.ellipse(ex, -16, 7, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; circle(ctx, ex + Math.sin(t) * 2, -15, 3.2); ctx.fill(); ctx.fillStyle = '#fff';
  });
  if (lit) { ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; ctx.fillStyle = '#e2c9ff'; circle(ctx, 0, -20, 55); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

/* ---------------- World objects ---------------- */
function drawWillow(ctx, x, y, t, backwards = false, glow = 0) {
  // shadow
  ctx.fillStyle = 'rgba(52,35,63,0.18)';
  ctx.beginPath(); ctx.ellipse(x, y + 4, 46, 13, 0, 0, TAU); ctx.fill();
  // trunk
  ctx.beginPath(); ctx.moveTo(x - 10, y + 4); ctx.quadraticCurveTo(x - 6, y - 40, x - 12, y - 72); ctx.lineTo(x + 12, y - 72); ctx.quadraticCurveTo(x + 6, y - 40, x + 10, y + 4); ctx.closePath();
  fillStroke(ctx, '#a0673b', 3);
  const cy = y - 92;
  const strands = 13;
  const sway = (i) => Math.sin(t * 1.4 + i * 0.7 + x * 0.01) * 5;
  if (backwards) {
    if (glow) { ctx.fillStyle = `rgba(255,224,122,${0.25 * glow})`; circle(ctx, x, cy - 40, 90); ctx.fill(); }
    for (let i = 0; i < strands; i++) {
      const sx = x - 44 + i * (88 / (strands - 1));
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(sx, cy - 6); ctx.bezierCurveTo(sx + sway(i), cy - 40, sx - sway(i), cy - 70, sx + sway(i) * 1.5, cy - 96 + Math.abs(i - 6) * 5); }, '#f7dc7a', 4);
    }
  }
  // canopy dome
  ctx.beginPath(); ctx.ellipse(x, cy, 52, 30, 0, 0, TAU); fillStroke(ctx, '#f2cf6a', 3);
  ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x - 26 + i * 13, cy - 4 + (i % 2) * 6, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  // tomato berries
  ctx.fillStyle = '#e4572e';
  [[-22, -8], [18, -12], [2, 8]].forEach(([dx, dy]) => { circle(ctx, x + dx, cy + dy, 5); fillStroke(ctx, '#e4572e', 2); });
  if (!backwards) {
    for (let i = 0; i < strands; i++) {
      const sx = x - 46 + i * (92 / (strands - 1));
      const len = 42 + ((i * 7) % 5) * 7;
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(sx, cy + 12); ctx.bezierCurveTo(sx + sway(i), cy + 30, sx - sway(i), cy + 45, sx + sway(i) * 1.2, cy + 12 + len); }, '#f7dc7a', 3.5);
    }
  }
}

const brickSprites = {};
function brickSprite(kind) {
  if (brickSprites[kind]) return brickSprites[kind];
  const c = document.createElement('canvas'); c.width = 64; c.height = 56;
  const x = c.getContext('2d');
  const base = { normal: '#f4c35a', woods: '#c6d77a', gold: '#ffd23f', fortune: '#ffb3c8', canyon: '#e59866', boulder: '#c9784a', peak: '#a9a39a', snow: '#f4f7fb' }[kind];
  x.translate(32, 30);
  x.fillStyle = 'rgba(52,35,63,0.2)'; x.beginPath(); x.ellipse(0, 18, 26, 7, 0, 0, TAU); x.fill();
  rr(x, -25, -16, 50, 32, 9); fillStroke(x, base, 3);
  rr(x, -21, -13, 42, 11, 6); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fill();
  x.strokeStyle = 'rgba(52,35,63,0.45)'; x.lineWidth = 2; x.lineCap = 'round';
  for (let r = 0; r < 3; r++) {
    x.beginPath();
    for (let i = -20; i <= 20; i += 2) x.lineTo(i, -6 + r * 8 + Math.sin(i * 0.6 + r) * 2.2);
    x.stroke();
  }
  if (kind === 'fortune') {
    x.fillStyle = '#fff'; x.font = '800 16px "Baloo 2", sans-serif'; x.textAlign = 'center'; x.fillText('?', 0, 6);
  }
  brickSprites[kind] = c;
  return c;
}
function drawBrick(ctx, b, t, near) {
  const img = brickSprite(b.kind);
  const wob = near ? Math.sin(t * 14) * 0.06 : 0;
  ctx.save(); ctx.translate(b.x, b.y - 14);
  ctx.rotate(wob);
  if (b.kind === 'gold' || b.kind === 'fortune') {
    ctx.fillStyle = b.kind === 'gold' ? 'rgba(255,210,63,0.35)' : 'rgba(255,179,200,0.4)';
    circle(ctx, 0, 0, 34 + Math.sin(t * 3) * 4); ctx.fill();
  }
  if (b.kind === 'boulder') ctx.scale(1.55, 1.55);
  ctx.drawImage(img, -32, -30);
  if (b.hp && b.max && b.hp < b.max) {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(2, -4); ctx.lineTo(-3, 4); ctx.lineTo(4, 12); ctx.stroke();
    if (b.hp < b.max - 1) { ctx.beginPath(); ctx.moveTo(14, -12); ctx.lineTo(8, -2); ctx.lineTo(16, 6); ctx.moveTo(-18, -6); ctx.lineTo(-10, 2); ctx.stroke(); }
  }
  ctx.restore();
}

function drawHouse(ctx, h, t, night) {
  const { x, y, w } = h;
  // shadow
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; rr(ctx, x + 8, y + 150, w, 26, 12); ctx.fill();
  // walls
  rr(ctx, x + 14, y + 60, w - 28, 110, 10); fillStroke(ctx, '#fff3d6', 3);
  // roof: an upside-down bowl
  ctx.beginPath(); ctx.moveTo(x, y + 72); ctx.quadraticCurveTo(x + w / 2, y - 30, x + w, y + 72); ctx.closePath();
  fillStroke(ctx, '#e4572e', 3);
  ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); for (let i = 0; i <= 12; i++) ctx.lineTo(x + 20 + i * (w - 40) / 12, y + 60 + (i % 2 ? -5 : 0)); ctx.stroke();
  // chimney + steam
  rr(ctx, x + w - 70, y + 4, 22, 36, 4); fillStroke(ctx, '#a0673b', 3);
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.35 + i / 3) % 1;
    ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = '#fff';
    circle(ctx, x + w - 59 + Math.sin(k * 6 + i) * 6, y - k * 60, 7 + k * 8); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // round window
  circle(ctx, x + 64, y + 108, 20); fillStroke(ctx, night ? '#ffd86b' : '#8fe0ea', 3);
  ctx.beginPath(); ctx.moveTo(x + 44, y + 108); ctx.lineTo(x + 84, y + 108); ctx.moveTo(x + 64, y + 88); ctx.lineTo(x + 64, y + 128); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
  // door
  rr(ctx, x + w / 2 + 6, y + 100, 44, 70, [20, 20, 4, 4]); fillStroke(ctx, '#2fa4b5', 3);
  circle(ctx, x + w / 2 + 40, y + 138, 3); ctx.fillStyle = INK; ctx.fill();
  // doormat
  rr(ctx, x + w / 2 + 2, y + 172, 52, 12, 4); fillStroke(ctx, '#f4b942', 2.5);
}

function drawShop(ctx, s, t, night) {
  const { x, y, w } = s;
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; rr(ctx, x + 6, y + 138, w, 22, 10); ctx.fill();
  // back wall
  rr(ctx, x + 10, y + 40, w - 20, 110, 8); fillStroke(ctx, '#c98b5a', 3);
  // poster on side wall (noodle alphabet)
  rr(ctx, x + w - 4, y + 60, 34, 46, 4); fillStroke(ctx, '#fff3d6', 2.5);
  ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 2;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    ctx.beginPath(); ctx.moveTo(x + w + 2 + c * 10, y + 66 + r * 10); ctx.quadraticCurveTo(x + w + 6 + c * 10, y + 70 + r * 10, x + w + 2 + c * 10, y + 73 + r * 10); ctx.stroke();
  }
  // grandma behind counter
  drawGrandma(ctx, x + w / 2, y + 110, t, 0.9);
  // counter
  rr(ctx, x, y + 96, w, 54, 8); fillStroke(ctx, '#e0a45e', 3);
  ctx.strokeStyle = 'rgba(52,35,63,0.35)'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 5, y + 100); ctx.lineTo(x + i * w / 5, y + 146); ctx.stroke(); }
  // bowls on counter
  [[x + 40, y + 96], [x + w - 44, y + 96]].forEach(([bx, by]) => {
    ctx.beginPath(); ctx.moveTo(bx - 16, by - 12); ctx.quadraticCurveTo(bx, by + 10, bx + 16, by - 12); ctx.closePath(); fillStroke(ctx, '#fff3d6', 2.5);
    const k = (t * 0.5 + bx * 0.01) % 1;
    ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(bx - 4, by - 16 - k * 20); ctx.quadraticCurveTo(bx + 6, by - 24 - k * 20, bx - 2, by - 32 - k * 20); ctx.stroke();
    ctx.globalAlpha = 1;
  });
  // awning
  const aw = 12;
  for (let i = 0; i < aw; i++) {
    const ax = x - 12 + i * (w + 24) / aw;
    ctx.beginPath(); ctx.moveTo(ax, y + 16); ctx.lineTo(ax + (w + 24) / aw, y + 16); ctx.lineTo(ax + (w + 24) / aw, y + 44);
    ctx.arc(ax + (w + 24) / aw / 2, y + 44, (w + 24) / aw / 2, 0, Math.PI); ctx.closePath();
    fillStroke(ctx, i % 2 ? '#fff3d6' : '#e4572e', 2.5);
  }
  // sign
  rr(ctx, x + w / 2 - 70, y - 30, 140, 42, 12); fillStroke(ctx, '#34233f', 0);
  ctx.fillStyle = night ? '#ffd86b' : '#f4b942';
  ctx.font = '24px "Bagel Fat One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('RAMEN', x + w / 2, y - 8);
  // lanterns
  [x - 6, x + w + 6].forEach(lx => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, y + 16); ctx.lineTo(lx, y + 30); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(lx, y + 42, 10, 13, 0, 0, TAU); fillStroke(ctx, night ? '#ffcf5a' : '#e4572e', 2.5);
  });
}

function drawPool(ctx, p, t, state) {
  const { x, y, w, h } = p;
  // deck
  rr(ctx, x - 22, y - 22, w + 44, h + 44, 18); fillStroke(ctx, '#fff3d6', 3);
  ctx.strokeStyle = '#ecdcb6'; ctx.lineWidth = 2;
  for (let i = x - 22 + 22; i < x + w + 22; i += 22) { ctx.beginPath(); ctx.moveTo(i, y - 22); ctx.lineTo(i, y - 4); ctx.moveTo(i, y + h + 4); ctx.lineTo(i, y + h + 22); ctx.stroke(); }
  // water
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, state.dawn ? '#ffd1b3' : '#8fe8f5'); g.addColorStop(0.35, '#5ed0e6'); g.addColorStop(1, '#2fa4b5');
  rr(ctx, x, y, w, h, 10); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip();
  // floor tiles
  const ts = 30;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
  for (let tx = x; tx <= x + w; tx += ts) { ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx, y + h); ctx.stroke(); }
  for (let ty = y; ty <= y + h; ty += ts) { ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.stroke(); }
  // secret arrows appear only at dawn
  if (state.showArrows) {
    const a = 0.35 + Math.sin(t * 2) * 0.15 + 0.2;
    ctx.fillStyle = `rgba(52,35,63,${a})`;
    const row = y + ts * 3 + ts / 2;
    [2, 5, 8].forEach(col => {
      const ax = x + col * ts + ts / 2;
      ctx.beginPath(); ctx.moveTo(ax - 10, row - 8); ctx.lineTo(ax + 4, row - 8); ctx.lineTo(ax + 4, row - 13); ctx.lineTo(ax + 13, row); ctx.lineTo(ax + 4, row + 13); ctx.lineTo(ax + 4, row + 8); ctx.lineTo(ax - 10, row + 8); ctx.closePath(); ctx.fill();
    });
    if (state.lastTile) {
      const lx = x + 11 * ts, ly = y + 3 * ts;
      ctx.fillStyle = `rgba(255,210,63,${0.5 + Math.sin(t * 5) * 0.3})`;
      ctx.fillRect(lx + 2, ly + 2, ts - 4, ts - 4);
    }
  }
  // lane ropes
  ctx.lineWidth = 4;
  [y + h / 3, y + 2 * h / 3].forEach(ly => {
    for (let i = x; i < x + w; i += 14) { ctx.strokeStyle = ((i - x) / 14) % 2 ? '#e4572e' : '#fff'; ctx.beginPath(); ctx.moveTo(i, ly); ctx.lineTo(i + 12, ly); ctx.stroke(); }
  });
  // sparkles
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    const sx = x + ((i * 97 + t * 20) % w), sy = y + ((i * 53) % h);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 6, sy - 3, sx + 12, sy); ctx.stroke();
  }
  ctx.restore();
  rr(ctx, x, y, w, h, 10); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  // fence + gate
  ctx.strokeStyle = '#a0673b'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const fy = y - 30;
  ctx.beginPath(); ctx.moveTo(x - 30, fy); ctx.lineTo(p.gate.x - 36, fy); ctx.moveTo(p.gate.x + 36, fy); ctx.lineTo(x + w + 30, fy); ctx.stroke();
  for (let i = x - 30; i <= x + w + 30; i += 30) { if (Math.abs(i - p.gate.x) < 36) continue; ctx.beginPath(); ctx.moveTo(i, fy - 14); ctx.lineTo(i, fy + 6); ctx.stroke(); }
  // gate sign
  const sgx = p.gate.x - 130;
  ctx.strokeStyle = '#a0673b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sgx, fy); ctx.lineTo(sgx, fy - 22); ctx.stroke();
  rr(ctx, sgx - 58, fy - 50, 116, 30, 10); fillStroke(ctx, state.open ? '#8cbf5a' : '#e4572e', 3);
  ctx.fillStyle = '#fff8e8'; ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.open ? 'OPEN 6–8 AM' : state.soon ? `OPENS IN 0:${String(state.soon).padStart(2, '0')}` : 'OPENS 6 AM', sgx, fy - 34);
  if (!state.open) { ctx.strokeStyle = '#a0673b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.gate.x - 36, fy); ctx.lineTo(p.gate.x + 36, fy); ctx.stroke(); }
}

function streamPath(ctx) {
  const pts = STREAM.pts;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
}
function drawStream(ctx, t, dawn) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  streamPath(ctx); ctx.strokeStyle = '#6fa54a'; ctx.lineWidth = STREAM.width + 22; ctx.stroke();
  streamPath(ctx); ctx.strokeStyle = INK; ctx.lineWidth = STREAM.width + 6; ctx.stroke();
  streamPath(ctx); ctx.strokeStyle = dawn ? '#8cd3d6' : '#56c3d3'; ctx.lineWidth = STREAM.width; ctx.stroke();
  streamPath(ctx); ctx.strokeStyle = '#8fe0ea'; ctx.lineWidth = STREAM.width * 0.45; ctx.stroke();
  ctx.setLineDash([18, 60]); ctx.lineDashOffset = -t * 60;
  streamPath(ctx); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.lineDashOffset = -t * 45 + 30; ctx.setLineDash([10, 90]);
  ctx.save(); ctx.translate(14, 0); streamPath(ctx); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(-16, 0); streamPath(ctx); ctx.stroke(); ctx.restore();
  ctx.setLineDash([]);
  // the Mirror Pond
  const M = STREAM.mirror;
  ctx.beginPath(); ctx.ellipse(M.x, M.y, M.rx + 14, M.ry + 12, 0, 0, TAU); ctx.fillStyle = '#6fa54a'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(M.x, M.y, M.rx + 3, M.ry + 3, 0, 0, TAU); ctx.fillStyle = INK; ctx.fill();
  const pg = ctx.createRadialGradient(M.x - 30, M.y - 20, 10, M.x, M.y, M.rx);
  pg.addColorStop(0, '#e2dbff'); pg.addColorStop(0.5, '#b7a6ff'); pg.addColorStop(1, '#6fc6d8');
  ctx.beginPath(); ctx.ellipse(M.x, M.y, M.rx, M.ry, 0, 0, TAU); ctx.fillStyle = pg; ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = t * 0.5 + i * 0.9, r = 0.3 + ((i * 37) % 60) / 100;
    const px = M.x + Math.cos(a) * M.rx * r, py = M.y + Math.sin(a * 1.3) * M.ry * r;
    const tw = (Math.sin(t * 4 + i * 2) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`;
    ctx.beginPath(); ctx.moveTo(px, py - 5 * tw - 2); ctx.lineTo(px + 1.5, py - 1.5); ctx.lineTo(px + 5 * tw + 2, py); ctx.lineTo(px + 1.5, py + 1.5); ctx.lineTo(px, py + 5 * tw + 2); ctx.lineTo(px - 1.5, py + 1.5); ctx.lineTo(px - 5 * tw - 2, py); ctx.lineTo(px - 1.5, py - 1.5); ctx.closePath(); ctx.fill();
  }
  // bridges
  STREAM.bridges.forEach(b => {
    ctx.fillStyle = 'rgba(52,35,63,0.25)'; rr(ctx, b.x + 4, b.y + 8, b.w, b.h, 8); ctx.fill();
    rr(ctx, b.x, b.y, b.w, b.h, 8); fillStroke(ctx, '#c98b5a', 3);
    ctx.strokeStyle = 'rgba(52,35,63,0.4)'; ctx.lineWidth = 2;
    for (let i = b.x + 18; i < b.x + b.w; i += 18) { ctx.beginPath(); ctx.moveTo(i, b.y + 3); ctx.lineTo(i, b.y + b.h - 3); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(b.x + 4, b.y + 2); ctx.lineTo(b.x + b.w - 4, b.y + 2); ctx.moveTo(b.x + 4, b.y + b.h - 2); ctx.lineTo(b.x + b.w - 4, b.y + b.h - 2); ctx.stroke();
  });
}

function buildGround() {
  const c = document.createElement('canvas'); c.width = WORLD.w; c.height = WORLD.h;
  const g = c.getContext('2d');
  const rnd = mulberry(7);
  g.fillStyle = '#a9d86e'; g.fillRect(0, 0, WORLD.w, WORLD.h);
  // woods floor, soft edge
  for (let i = 0; i < 90; i++) {
    const x = 1450 + rnd() * 1200, y = rnd() * WORLD.h, r = 80 + rnd() * 140;
    g.fillStyle = 'rgba(111,165,74,0.32)'; circle(g, x, y, r); g.fill();
  }
  // meadow patches
  for (let i = 0; i < 220; i++) {
    const x = rnd() * WORLD.w, y = rnd() * WORLD.h, r = 20 + rnd() * 60;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,140,60,0.10)';
    circle(g, x, y, r); g.fill();
  }
  // grass tufts
  g.strokeStyle = 'rgba(70,120,50,0.55)'; g.lineWidth = 2; g.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const x = rnd() * WORLD.w, y = rnd() * WORLD.h;
    g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x, y); g.lineTo(x + 4, y - 7); g.stroke();
  }
  // flowers in the meadow
  const cols = ['#fff8e8', '#ffb3c8', '#ffd23f', '#b98cff'];
  for (let i = 0; i < 260; i++) {
    const x = 300 + rnd() * 900, y = 1100 + rnd() * 650;
    const col = cols[(rnd() * cols.length) | 0];
    for (let k = 0; k < 5; k++) { g.fillStyle = col; circle(g, x + Math.cos(k * 1.26) * 3.5, y + Math.sin(k * 1.26) * 3.5, 2.8); g.fill(); }
    g.fillStyle = '#f4b942'; circle(g, x, y, 2); g.fill();
  }
  // the smallest flower (fortune riddle spot)
  g.fillStyle = '#b98cff'; for (let k = 0; k < 5; k++) { circle(g, 760 + Math.cos(k * 1.26) * 2, 1330 + Math.sin(k * 1.26) * 2, 1.6); g.fill(); }
  // Crunch Canyon: warm sandstone with noodle-wave strata
  g.fillStyle = '#e9b27a';
  g.beginPath(); g.moveTo(0, CANYON.top - 30);
  for (let x = 0; x <= WORLD.w; x += 40) g.lineTo(x, CANYON.top - 30 + Math.sin(x * 0.02) * 10);
  g.lineTo(WORLD.w, WORLD.h); g.lineTo(0, WORLD.h); g.closePath(); g.fill();
  for (let i = 0; i < 120; i++) {
    const x = rnd() * WORLD.w, y = CANYON.top + rnd() * (WORLD.h - CANYON.top), r = 30 + rnd() * 90;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,230,190,0.18)' : 'rgba(180,100,60,0.10)'; circle(g, x, y, r); g.fill();
  }
  g.lineWidth = 3; g.strokeStyle = 'rgba(170,95,55,0.22)';
  for (let y = CANYON.top + 40; y < WORLD.h; y += 46) {
    g.beginPath(); for (let x = 0; x <= WORLD.w; x += 8) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 6); g.stroke();
  }
  for (let i = 0; i < 500; i++) {
    const x = rnd() * WORLD.w, y = CANYON.top + rnd() * (WORLD.h - CANYON.top);
    g.fillStyle = rnd() > 0.5 ? 'rgba(120,70,40,0.35)' : 'rgba(255,240,210,0.5)'; circle(g, x, y, 1.5 + rnd() * 2.5); g.fill();
  }
  // Soba Peaks: slate slopes, soba-brown contour lines, snow on top
  g.fillStyle = '#b8c2cc';
  g.beginPath(); g.moveTo(PEAKS.left, 0);
  for (let y = 0; y <= WORLD.h; y += 40) g.lineTo(PEAKS.left - 20 + Math.sin(y * 0.02) * 14, y);
  g.lineTo(WORLD.w, WORLD.h); g.lineTo(WORLD.w, 0); g.closePath(); g.fill();
  const snow = g.createLinearGradient(0, 0, 0, PEAKS.snowLine + 160);
  snow.addColorStop(0, 'rgba(250,252,255,1)'); snow.addColorStop(0.75, 'rgba(244,247,251,0.9)'); snow.addColorStop(1, 'rgba(244,247,251,0)');
  g.fillStyle = snow; g.fillRect(PEAKS.left - 30, 0, WORLD.w - PEAKS.left + 30, PEAKS.snowLine + 160);
  for (let i = 0; i < 90; i++) {
    const x = PEAKS.left + rnd() * (WORLD.w - PEAKS.left), y = rnd() * PEAKS.bottom, r = 30 + rnd() * 90;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(90,100,120,0.08)'; circle(g, x, y, r); g.fill();
  }
  g.lineWidth = 3; g.strokeStyle = 'rgba(154,123,91,0.28)';
  for (let k = 0; k < 9; k++) {
    const cx = 3150, cy = 250, r = 180 + k * 150;
    g.beginPath(); for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) { const w = Math.sin(a * 7 + k) * 10; g.lineTo(cx + Math.cos(a) * (r + w) * 1.1, cy + Math.sin(a) * (r + w) * 0.9); } g.stroke();
  }
  for (let i = 0; i < 400; i++) {
    const x = PEAKS.left + rnd() * (WORLD.w - PEAKS.left), y = rnd() * WORLD.h;
    g.fillStyle = rnd() > 0.5 ? 'rgba(80,90,110,0.3)' : 'rgba(255,255,255,0.6)'; circle(g, x, y, 1.5 + rnd() * 2.5); g.fill();
  }

  // Roads. Every edge first, then every surface, then crumbs, so junctions merge smoothly.
  const smooth = (pts) => {
    let out = pts;
    for (let it = 0; it < 3; it++) {
      const n = [out[0]];
      for (let i = 0; i < out.length - 1; i++) {
        const [ax, ay] = out[i], [bx, by] = out[i + 1];
        n.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      n.push(out[out.length - 1]);
      out = n;
    }
    return out;
  };
  const ROADS = [
    [[[480, 575], [520, 640], [700, 600], [885, 510]], 44],
    [[[520, 640], [520, 760]], 40],
    [[[700, 600], [820, 760], [900, 900]], 36],
    [[[885, 510], [1000, 600], [1160, 700], [1400, 700], [1560, 640], [1760, 560], [2020, 520], [2200, 460]], 40],
    [[[900, 900], [860, 1100], [760, 1300]], 34],
    [[[1000, 1000], [1250, 1265], [1460, 1260], [1700, 1150]], 34],
    [[[1700, 1150], [1980, 1200], [2200, 1300], [2400, 1420], ...PEAKS.path], 36],
    [[[760, 1300], [760, 1790], [760, 1960], [700, 2150], [900, 2250], [1210, 2245], [1450, 2245], [1700, 2300], [1900, 2300]], 36],
    [[[700, 2150], [480, 2200], [360, 2380]], 30],
  ].map(([pts, w]) => [smooth(pts), w]);
  const trace = (pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  ROADS.forEach(([pts, w]) => { trace(pts); g.strokeStyle = '#d9b877'; g.lineWidth = w + 8; g.stroke(); });
  ROADS.forEach(([pts, w]) => { trace(pts); g.strokeStyle = '#f3dca0'; g.lineWidth = w; g.stroke(); });
  ROADS.forEach(([pts, w]) => { trace(pts); g.strokeStyle = 'rgba(255,248,225,0.55)'; g.lineWidth = w * 0.35; g.stroke(); });
  g.fillStyle = 'rgba(201,139,90,0.45)';
  ROADS.forEach(([pts, w]) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.hypot(bx - ax, by - ay) / 14;
      for (let k = 0; k < n; k++) {
        const f = rnd();
        circle(g, ax + (bx - ax) * f + (rnd() - 0.5) * w * 0.7, ay + (by - ay) * f + (rnd() - 0.5) * w * 0.7, 1.5 + rnd() * 2); g.fill();
      }
    }
  });
  // region lettering painted on the ground
  g.font = '44px "Bagel Fat One", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(52,35,63,0.14)';
  g.fillText('Ramen Village', 700, 270);
  g.fillText('Spaghetti Woods', 1960, 120);
  g.fillText('Crunch Meadow', 780, 1700);
  g.fillStyle = 'rgba(110,55,30,0.16)'; g.fillText('Crunch Canyon', 1900, 1990);
  g.fillStyle = 'rgba(60,70,90,0.16)'; g.fillText('Soba Peaks', 3150, 1600);
  // world edge: hedges of noodles
  g.strokeStyle = '#6fa54a'; g.lineWidth = 40;
  g.strokeRect(0, 0, WORLD.w, WORLD.h);
  return c;
}

/* ---------------- Icons ---------------- */
const RARITY_BG = { common: '#fff3d6', rare: '#d6f1ff', legendary: '#ecdcff', secret: '#fff1a8' };
function drawNoodleIcon(ctx, n, size, locked = false, shiny = false) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  const s = size / 64;
  ctx.scale(s, s);
  if (shiny) { circle(ctx, 32, 32, 31); const gg = ctx.createLinearGradient(0, 0, 64, 64); gg.addColorStop(0, '#fff1a8'); gg.addColorStop(0.5, '#ffd23f'); gg.addColorStop(1, '#f4a100'); ctx.fillStyle = gg; ctx.fill(); }
  circle(ctx, 32, 32, shiny ? 25 : 29); fillStroke(ctx, locked ? '#e7dcc6' : RARITY_BG[n.rarity], 3);
  if (locked) {
    ctx.fillStyle = 'rgba(52,35,63,0.35)'; ctx.font = '800 30px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 32, 35); ctx.restore(); return;
  }
  const c = n.color;
  const wave = (y0, amp, ph) => () => { ctx.beginPath(); for (let x = 14; x <= 50; x += 2) ctx.lineTo(x, y0 + Math.sin(x * 0.28 + ph) * amp); };
  switch (n.shape) {
    case 'brick':
      rr(ctx, 12, 18, 40, 28, 8); fillStroke(ctx, c, 3);
      ctx.strokeStyle = 'rgba(52,35,63,0.5)'; ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) { ctx.beginPath(); for (let x = 16; x <= 48; x += 2) ctx.lineTo(x, 25 + r * 7 + Math.sin(x * 0.6 + r) * 2); ctx.stroke(); }
      break;
    case 'zig':
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(14, 40); for (let i = 0; i < 6; i++) ctx.lineTo(20 + i * 6, i % 2 ? 40 : 24); }, c, 6);
      break;
    case 'wave':
      [22, 32, 42].forEach((y, i) => noodleStroke(ctx, wave(y, 3.5, i), c, 4.5));
      break;
    case 'straight':
      for (let i = 0; i < 5; i++) noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(16 + i * 5, 50); ctx.lineTo(28 + i * 5, 14); }, c, 3.5);
      rr(ctx, 18, 28, 30, 8, 3); fillStroke(ctx, '#fff8e8', 2.5);
      break;
    case 'ribbon':
      noodleStroke(ctx, wave(32, 7, 0), c, 12);
      ctx.strokeStyle = '#6fa54a'; ctx.lineWidth = 2; wave(32, 7, 0)(); ctx.stroke();
      break;
    case 'bubble':
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.arc(32, 44, 18, Math.PI * 1.1, Math.PI * 1.9); }, c, 10);
      [[18, 20, 5], [44, 16, 4], [36, 26, 3]].forEach(([x, y, r]) => { circle(ctx, x, y, r); fillStroke(ctx, 'rgba(143,224,234,0.8)', 2); });
      break;
    case 'dawn':
      ctx.beginPath(); ctx.arc(32, 40, 16, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#ffd23f', 3);
      noodleStroke(ctx, wave(42, 4, 1), c, 5);
      break;
    case 'glass':
      ctx.globalAlpha = 0.75;
      [24, 32, 40].forEach((y, i) => noodleStroke(ctx, wave(y, 4, i * 2), c, 4));
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      [[46, 16], [18, 46]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 2, y - 2); ctx.lineTo(x + 6, y); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x, y + 6); ctx.lineTo(x - 2, y + 2); ctx.lineTo(x - 6, y); ctx.lineTo(x - 2, y - 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); });
      break;
    case 'curl':
      noodleStroke(ctx, () => { ctx.beginPath(); for (let a = 0; a < TAU * 2.5; a += 0.15) { const r = 3 + a * 2.4; ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } }, c, 5);
      break;
    case 'macaroni':
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.arc(34, 38, 14, Math.PI, Math.PI * 1.9); }, c, 13);
      ctx.fillStyle = INK; circle(ctx, 20, 38, 3); ctx.fill();
      break;
    case 'echo':
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      [8, 14].forEach(r => { ctx.beginPath(); ctx.arc(20, 32, r, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(44, 32, r, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); });
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(32, 14); for (let y = 14; y <= 50; y += 2) ctx.lineTo(32 + Math.sin(y * 0.4) * 4, y); }, c, 5);
      break;
    case 'crackle':
      rr(ctx, 14, 20, 36, 24, 6); fillStroke(ctx, c, 3);
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(24, 20); ctx.lineTo(28, 30); ctx.lineTo(24, 36); ctx.lineTo(30, 44); ctx.moveTo(40, 20); ctx.lineTo(36, 30); ctx.lineTo(42, 38); ctx.stroke();
      break;
    case 'mint':
      [24, 34, 44].forEach((y, i) => noodleStroke(ctx, wave(y, 3, i), c, 4));
      ctx.beginPath(); ctx.ellipse(44, 18, 9, 5, -0.6, 0, TAU); fillStroke(ctx, '#6fbf73', 2.5);
      break;
    case 'boulder':
      ctx.beginPath(); ctx.moveTo(12, 44); ctx.lineTo(16, 24); ctx.lineTo(30, 14); ctx.lineTo(46, 18); ctx.lineTo(52, 36); ctx.lineTo(44, 48); ctx.lineTo(20, 50); ctx.closePath(); fillStroke(ctx, c, 3);
      ctx.strokeStyle = 'rgba(52,35,63,0.5)'; ctx.lineWidth = 2;
      for (let r = 0; r < 3; r++) { ctx.beginPath(); for (let x = 18; x <= 46; x += 2) ctx.lineTo(x, 26 + r * 8 + Math.sin(x * 0.6 + r) * 2); ctx.stroke(); }
      break;
    case 'rigatoni':
      [[20, 22], [34, 36], [44, 20]].forEach(([x, y], i) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(i * 0.7 - 0.5);
        rr(ctx, -6, -11, 12, 22, 4); fillStroke(ctx, c, 2.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
        for (let k = -3; k <= 3; k += 3) { ctx.beginPath(); ctx.moveTo(k, -9); ctx.lineTo(k, 9); ctx.stroke(); }
        ctx.restore();
      });
      break;
    case 'mirror':
      noodleStroke(ctx, wave(24, 4, 0), c, 4.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(12, 32); ctx.lineTo(52, 32); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.55; noodleStroke(ctx, wave(40, -4, 0), c, 4.5); ctx.globalAlpha = 1;
      break;
    case 'slow':
      noodleStroke(ctx, () => { ctx.beginPath(); for (let a = 0; a < TAU * 2; a += 0.15) { const r = 2 + a * 2.2; ctx.lineTo(34 + Math.cos(a) * r, 30 + Math.sin(a) * r); } }, c, 7);
      ctx.fillStyle = INK; circle(ctx, 18, 46, 2.5); ctx.fill(); circle(ctx, 24, 46, 2.5); ctx.fill();
      break;
    case 'peak':
      ctx.beginPath(); ctx.moveTo(10, 50); ctx.lineTo(28, 16); ctx.lineTo(38, 32); ctx.lineTo(46, 22); ctx.lineTo(56, 50); ctx.closePath(); fillStroke(ctx, '#b8c2cc', 2.5);
      ctx.beginPath(); ctx.moveTo(22, 28); ctx.lineTo(28, 16); ctx.lineTo(33, 25); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
      [40, 46].forEach((y, i) => noodleStroke(ctx, wave(y, 2.5, i), c, 3.5));
      break;
    case 'snow':
      noodleStroke(ctx, wave(40, 4, 0), c, 4.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(32 - Math.cos(a) * 12, 20 - Math.sin(a) * 12); ctx.lineTo(32 + Math.cos(a) * 12, 20 + Math.sin(a) * 12); ctx.stroke(); }
      break;
    case 'feather':
      ctx.beginPath(); ctx.moveTo(16, 50); ctx.quadraticCurveTo(20, 18, 48, 12); ctx.quadraticCurveTo(46, 40, 16, 50); ctx.closePath(); fillStroke(ctx, c, 2.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, 52); ctx.quadraticCurveTo(28, 34, 46, 14); ctx.stroke();
      break;
    case 'thunder':
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(38, 10); ctx.lineTo(24, 32); ctx.lineTo(38, 32); ctx.lineTo(26, 54); }, c, 7);
      break;
    case 'ice':
      rr(ctx, 16, 16, 32, 32, 6); fillStroke(ctx, 'rgba(191,233,255,0.8)', 2.5);
      [26, 34, 42].forEach((y, i) => noodleStroke(ctx, () => { ctx.beginPath(); for (let x = 20; x <= 44; x += 2) ctx.lineTo(x, y + Math.sin(x * 0.4 + i) * 2); }, '#fff3d6', 2.5));
      ctx.fillStyle = '#fff'; ctx.fillRect(20, 19, 8, 3);
      break;
    case 'smile':
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.arc(32, 32, 16, 0.2 * Math.PI, 0.8 * Math.PI); }, c, 5);
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(24, 22); ctx.lineTo(24, 28); ctx.moveTo(40, 22); ctx.lineTo(40, 28); }, c, 5);
      break;
    case 'sky':
      [[24, 26, 10], [36, 22, 12], [46, 28, 9]].forEach(([x, y, r]) => { circle(ctx, x, y, r); fillStroke(ctx, '#ffffff', 2.5); });
      rr(ctx, 16, 26, 38, 10, 5); ctx.fillStyle = '#fff'; ctx.fill();
      [40, 48].forEach((y, i) => noodleStroke(ctx, wave(y, 3, i), c, 3.5));
      break;
    case 'updown':
      for (let i = 0; i < 4; i++) noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(20 + i * 8, 50); ctx.bezierCurveTo(16 + i * 8, 38, 26 + i * 8, 28, 20 + i * 8, 14); }, c, 4);
      ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.moveTo(50, 22); ctx.lineTo(56, 30); ctx.lineTo(44, 30); ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

function drawGlyph(ctx, letter, w = 30, h = 36, color = '#e4572e') {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (letter === ' ') { ctx.restore(); return; }
  const g = glyphFor(letter);
  const cx = w / 2, top = 12, bot = h - 4;
  let fn;
  if (g.shape === 0) fn = () => { ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bot); };
  else if (g.shape === 1) fn = () => { ctx.beginPath(); for (let y = top; y <= bot; y += 1.5) ctx.lineTo(cx + Math.sin((y - top) * 0.45) * 5, y); };
  else if (g.shape === 2) fn = () => { ctx.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.2) { const r = 1 + a * 1.1; ctx.lineTo(cx + Math.cos(a) * r, (top + bot) / 2 + Math.sin(a) * r); } };
  else fn = () => { ctx.beginPath(); ctx.moveTo(cx - 5, top); for (let i = 1; i <= 4; i++) ctx.lineTo(cx + (i % 2 ? 5 : -5), top + i * (bot - top) / 4); };
  noodleStroke(ctx, fn, color, 3);
  if (g.bar) { ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 9, (top + bot) / 2); ctx.lineTo(cx + 9, (top + bot) / 2); ctx.stroke(); }
  ctx.fillStyle = INK;
  for (let d = 0; d < g.dots; d++) { circle(ctx, cx - (g.dots - 1) * 4 + d * 8, 5, 2.4); ctx.fill(); }
  ctx.restore();
}

function drawMapPiece(ctx, n, size) {
  ctx.save(); ctx.clearRect(0, 0, size, size);
  const s = size / 160; ctx.scale(s, s);
  const rnd = mulberry(n * 31);
  // torn paper
  ctx.beginPath();
  const edge = [];
  for (let i = 0; i <= 10; i++) edge.push([8 + i * 14.4, 8 + rnd() * 8]);
  for (let i = 0; i <= 10; i++) edge.push([152 - rnd() * 8, 8 + i * 14.4]);
  for (let i = 10; i >= 0; i--) edge.push([8 + i * 14.4, 152 - rnd() * 8]);
  for (let i = 10; i >= 0; i--) edge.push([8 + rnd() * 8, 8 + i * 14.4]);
  edge.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  fillStroke(ctx, '#f6e2b3', 3);
  ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  if (n === 1) {
    ctx.strokeStyle = '#2fa4b5'; ctx.lineWidth = 6;
    ctx.beginPath(); for (let y = 16; y < 150; y += 4) ctx.lineTo(56 + Math.sin(y * 0.06) * 8, y); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    // upside-down tree
    ctx.beginPath(); ctx.moveTo(116, 30); ctx.lineTo(116, 70); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(116, 88, 24, 16, 0, 0, TAU); ctx.stroke();
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(116 + i * 7, 76); ctx.quadraticCurveTo(116 + i * 7 + 4, 62, 116 + i * 7, 50); ctx.stroke(); }
    ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(24, 130); ctx.quadraticCurveTo(80, 140, 104, 110); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '800 22px "Baloo 2", sans-serif'; ctx.fillStyle = '#e4572e'; ctx.fillText('✕', 108, 128);
  } else if (n === 2) {
    // a canyon with an echo
    ctx.beginPath(); ctx.moveTo(20, 140); ctx.lineTo(40, 60); ctx.lineTo(70, 90); ctx.lineTo(90, 40); ctx.lineTo(120, 80); ctx.lineTo(140, 140); ctx.stroke();
    [10, 18, 26].forEach(r => { ctx.beginPath(); ctx.arc(80, 120, r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); });
    ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.fillText('crunch crunch', 38, 30);
  } else if (n === 3) {
    // a drum and a rhythm
    ctx.beginPath(); ctx.ellipse(80, 64, 36, 12, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44, 64); ctx.lineTo(48, 118); ctx.moveTo(116, 64); ctx.lineTo(112, 118); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(80, 118, 32, 10, 0, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = '#e4572e';
    [[40, 30, 5], [58, 30, 5], [104, 30, 9]].forEach(([x, y, r]) => { circle(ctx, x, y, r); ctx.fill(); });
    ctx.fillStyle = INK; ctx.font = '800 13px "Baloo 2", sans-serif'; ctx.fillText('· · · ·', 66, 34);
  } else if (n === 4) {
    // the mirror pond with backwards letters
    ctx.fillStyle = '#b7a6ff'; ctx.beginPath(); ctx.ellipse(80, 90, 56, 30, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(80, 95); ctx.scale(-1, 1); ctx.fillStyle = INK; ctx.font = '800 16px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('? ? ?', 0, 0); ctx.restore();
    ctx.beginPath(); ctx.moveTo(30, 40); ctx.quadraticCurveTo(60, 20, 80, 40); ctx.quadraticCurveTo(100, 60, 130, 36); ctx.stroke();
  } else if (n === 5) {
    // mountains and a square statue: next chapter
    ctx.beginPath(); ctx.moveTo(16, 130); ctx.lineTo(56, 50); ctx.lineTo(80, 90); ctx.lineTo(110, 30); ctx.lineTo(146, 130); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, 50); ctx.lineTo(110, 30); ctx.lineTo(120, 50); ctx.stroke();
    rr(ctx, 100, 10, 20, 18, 4); ctx.stroke();
    ctx.fillStyle = INK; circle(ctx, 106, 18, 1.8); ctx.fill(); circle(ctx, 114, 18, 1.8); ctx.fill();
    ctx.font = '800 13px "Baloo 2", sans-serif'; ctx.fillText('Soba Peaks', 30, 150);
  } else if (n === 6) {
    // a dark cave full of glowing noodles
    ctx.fillStyle = '#34233f';
    ctx.beginPath(); ctx.moveTo(24, 140); ctx.quadraticCurveTo(30, 30, 80, 28); ctx.quadraticCurveTo(130, 30, 136, 140); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9ff3ff';
    [[60, 90], [92, 72], [80, 112], [108, 104], [54, 124]].forEach(([x, y]) => { circle(ctx, x, y, 4); ctx.fill(); });
    ctx.fillStyle = INK; ctx.font = '800 13px "Baloo 2", sans-serif'; ctx.fillText('Glass Noodle Caves', 24, 156);
  }
  ctx.restore();
}

function drawTitleHero(ctx, t) {
  ctx.clearRect(0, 0, 260, 260);
  ctx.save(); ctx.translate(130, 176); ctx.scale(2.1, 2.1);
  const moods = ['happy', 'crunch', 'cool', 'wow'];
  const mood = moods[Math.floor(t / 1.6) % moods.length];
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 36, 26, 6, 0, 0, TAU); ctx.fill();
  const bob = Math.sin(t * 3) * 2;
  rr(ctx, -15, 4 - bob, 30, 26, 10); fillStroke(ctx, '#2fa4b5', 3);
  ctx.fillStyle = INK; rr(ctx, -10, 28, 8, 8, 3); ctx.fill(); rr(ctx, 2, 28, 8, 8, 3); ctx.fill();
  drawHead(ctx, 0, -20 - bob, mood, t, { antennaPulse: (Math.sin(t * 4) + 1) / 2 });
  ctx.restore();
}

/* ---------------- Crunch Canyon ---------------- */
function drawEchoRock(ctx, x, y, t, shimmer = 0) {
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 44, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x - 30, y - 96); ctx.quadraticCurveTo(x, y - 112, x + 30, y - 96); ctx.lineTo(x + 38, y); ctx.quadraticCurveTo(x, y + 8, x - 38, y); ctx.closePath();
  fillStroke(ctx, '#c9784a', 3);
  ctx.beginPath(); ctx.ellipse(x, y - 98, 29, 9, 0, 0, TAU); fillStroke(ctx, '#e9a36b', 2.5);
  ctx.strokeStyle = 'rgba(255,230,190,0.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let r = 0; r < 4; r++) { ctx.beginPath(); for (let k = -30; k <= 30; k += 3) ctx.lineTo(x + k, y - 20 - r * 20 + Math.sin(k * 0.3 + r) * 3); ctx.stroke(); }
  if (shimmer > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${shimmer})`; ctx.lineWidth = 3;
    [1, 2].forEach(i => { ctx.beginPath(); ctx.arc(x, y - 60, 40 + i * 16 + (1 - shimmer) * 20, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - 60, 40 + i * 16 + (1 - shimmer) * 20, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); });
  }
}

function drawDrum(ctx, x, y, t, hit = 0, open = false) {
  ctx.fillStyle = 'rgba(52,35,63,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 62, 16, 0, 0, TAU); ctx.fill();
  const s = 1 + hit * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, 1 / s);
  // legs
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-40, -6); ctx.lineTo(-50, 2); ctx.moveTo(40, -6); ctx.lineTo(50, 2); ctx.stroke();
  // body
  ctx.beginPath(); ctx.moveTo(-54, -80); ctx.lineTo(-46, -10); ctx.quadraticCurveTo(0, 6, 46, -10); ctx.lineTo(54, -80); ctx.closePath();
  fillStroke(ctx, '#e4572e', 3);
  // noodle ropes
  ctx.lineWidth = 3;
  noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-50, -70); for (let i = 0; i < 8; i++) ctx.lineTo(-44 + i * 12.5, i % 2 ? -70 : -20); }, '#f7dc7a', 3);
  // head
  if (open) {
    ctx.save(); ctx.translate(40, -96); ctx.rotate(0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 54, 15, 0, 0, TAU); fillStroke(ctx, '#fff3d6', 3); ctx.restore();
    ctx.beginPath(); ctx.ellipse(0, -80, 54, 15, 0, 0, TAU); fillStroke(ctx, '#34233f', 3);
  } else {
    ctx.beginPath(); ctx.ellipse(0, -80, 54, 15, 0, 0, TAU); fillStroke(ctx, '#fff3d6', 3);
    ctx.strokeStyle = 'rgba(52,35,63,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -80, 30, 8, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  if (hit > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${hit})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(x, y - 80, 60 + (1 - hit) * 40, 18 + (1 - hit) * 12, 0, 0, TAU); ctx.stroke();
  }
}

function drawSnail(ctx, x, y, t, dir = 1, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 50, 10, 0, 0, TAU); ctx.fill();
  const stretch = Math.sin(t * 1.2) * 3;
  // body
  ctx.beginPath(); ctx.moveTo(-44 - stretch, 0); ctx.quadraticCurveTo(-40, -16, 0, -14); ctx.lineTo(30, -20); ctx.quadraticCurveTo(46 + stretch, -26, 50 + stretch, -8); ctx.quadraticCurveTo(48, 2, 30, 2); ctx.closePath();
  fillStroke(ctx, '#d8e38a', 3);
  // eye stalks
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const wig = Math.sin(t * 2) * 3;
  ctx.beginPath(); ctx.moveTo(40, -20); ctx.lineTo(38 + wig, -42); ctx.moveTo(47, -18); ctx.lineTo(52 + wig, -40); ctx.stroke();
  circle(ctx, 38 + wig, -44, 5); fillStroke(ctx, '#fff', 2.5); circle(ctx, 52 + wig, -42, 5); fillStroke(ctx, '#fff', 2.5);
  ctx.fillStyle = INK; circle(ctx, 39 + wig, -44, 2.2); ctx.fill(); circle(ctx, 53 + wig, -42, 2.2); ctx.fill();
  ctx.beginPath(); ctx.arc(44, -10, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  // udon shell
  circle(ctx, -8, -34, 30); fillStroke(ctx, '#fff3d6', 3);
  noodleStroke(ctx, () => { ctx.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.15) { const r = 3 + a * 3.2; ctx.lineTo(-8 + Math.cos(a) * r, -34 + Math.sin(a) * r); } }, '#fff8e8', 6);
  ctx.restore();
}

function drawSpring(ctx, sp, t) {
  const { x, y, rx, ry } = sp;
  ctx.beginPath(); ctx.ellipse(x, y, rx + 14, ry + 12, 0, 0, TAU); fillStroke(ctx, '#b98a5c', 3);
  const g = ctx.createRadialGradient(x - 20, y - 12, 6, x, y, rx);
  g.addColorStop(0, '#e6fff4'); g.addColorStop(0.6, '#9ff0c8'); g.addColorStop(1, '#4fc3a1');
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = t * 0.3 + i * 1.3;
    const lx = x + Math.cos(a) * rx * 0.55, ly = y + Math.sin(a) * ry * 0.5;
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); fillStroke(ctx, '#6fbf73', 2); ctx.restore();
  }
  for (let i = 0; i < 2; i++) {
    const k = (t * 0.6 + i / 2) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.2 + k * rx * 0.6, ry * 0.2 + k * ry * 0.6, 0, 0, TAU); ctx.stroke();
  }
}

function drawCanyonWall(ctx, t, gateHp, cracked) {
  const y = CANYON.wallY;
  const rock = (x, r, col) => {
    ctx.beginPath(); ctx.moveTo(x - r, y + 14); ctx.quadraticCurveTo(x - r - 4, y - r * 0.9, x - r * 0.2, y - r * 1.1); ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.2, x + r, y + 14); ctx.closePath();
    fillStroke(ctx, col, 3);
    ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let k = -r * 0.6; k <= r * 0.6; k += 3) ctx.lineTo(x + k, y - r * 0.4 + Math.sin(k * 0.3) * 3); ctx.stroke();
  };
  for (let x = 40; x < WORLD.w; x += 64) {
    if (Math.abs(x - 1290) < 70) continue;
    if (Math.abs(x - CANYON.gate.x) < 70) continue;
    rock(x, 36 + ((x * 7) % 11), '#b8693e');
  }
  if (gateHp > 0) {
    const gx = CANYON.gate.x;
    const wob = cracked ? Math.sin(t * 20) * (gateHp < 3 ? 1.5 : 0.4) : 0;
    ctx.save(); ctx.translate(wob, 0); rock(gx, 58, '#a45a33'); ctx.restore();
    if (cracked) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx - 6, y - 58); ctx.lineTo(gx + 4, y - 36); ctx.lineTo(gx - 8, y - 16); ctx.lineTo(gx + 2, y + 6); ctx.stroke();
      if (gateHp < 3) { ctx.beginPath(); ctx.moveTo(gx + 26, y - 40); ctx.lineTo(gx + 14, y - 24); ctx.lineTo(gx + 28, y - 6); ctx.stroke(); }
      if (gateHp < 2) { ctx.beginPath(); ctx.moveTo(gx - 34, y - 30); ctx.lineTo(gx - 20, y - 18); ctx.lineTo(gx - 36, y); ctx.stroke(); }
    }
  }
}

function drawReflection(ctx, t, alpha, words) {
  const M = STREAM.mirror;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(M.x, M.y, M.rx - 4, M.ry - 4, 0, 0, TAU); ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.translate(M.x, M.y);
  ctx.scale(-1, 1);
  ctx.font = '26px "Bagel Fat One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const wob = (i) => Math.sin(t * 3 + i) * 2;
  if (words) {
    ctx.fillStyle = '#34233f';
    ctx.fillText('UNDER THE', wob(0), -14);
    ctx.fillText("SNAIL'S HOUSE", wob(1), 18);
  } else {
    ctx.fillStyle = 'rgba(52,35,63,0.5)';
    ctx.scale(1, -1);
    drawHead(ctx, 0, 0, 'happy', t, {});
  }
  ctx.restore();
}

/* ---------------- Soba Peaks ---------------- */
function drawPine(ctx, x, y, t, snowy) {
  ctx.fillStyle = 'rgba(52,35,63,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 34, 10, 0, 0, TAU); ctx.fill();
  rr(ctx, x - 6, y - 26, 12, 28, 3); fillStroke(ctx, '#8a5a36', 2.5);
  for (let k = 0; k < 3; k++) {
    const w = 42 - k * 10, top = y - 40 - k * 30;
    ctx.beginPath(); ctx.moveTo(x - w, top + 30); ctx.quadraticCurveTo(x, top + 38, x + w, top + 30); ctx.lineTo(x, top - 18); ctx.closePath();
    fillStroke(ctx, '#5f9a6b', 3);
    ctx.strokeStyle = '#9a7b5b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = -w + 8; i <= w - 8; i += 3) ctx.lineTo(x + i, top + 26 + Math.sin(i * 0.5 + t * 2) * 2); ctx.stroke();
    if (snowy) { ctx.beginPath(); ctx.moveTo(x - 9, top - 4); ctx.lineTo(x, top - 18); ctx.lineTo(x + 9, top - 4); ctx.closePath(); fillStroke(ctx, '#fff', 2); }
  }
}

function drawSobaBird(ctx, x, y, t, s = 1, flap = true) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const f = flap ? Math.sin(t * 12) * 0.6 : 0.2;
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0, 0, TAU); fillStroke(ctx, '#9a7b5b', 2.5);
  ctx.save(); ctx.rotate(-f); ctx.beginPath(); ctx.ellipse(-4, -6, 12, 5, -0.4, 0, TAU); fillStroke(ctx, '#c9a47a', 2.2); ctx.restore();
  circle(ctx, 12, -6, 8); fillStroke(ctx, '#9a7b5b', 2.5);
  ctx.fillStyle = INK; circle(ctx, 14, -8, 1.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(19, -6); ctx.lineTo(26, -4); ctx.lineTo(19, -2); ctx.closePath(); fillStroke(ctx, '#f4b942', 1.8);
  ctx.strokeStyle = '#f7dc7a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-14, i * 3 - 2); ctx.quadraticCurveTo(-22, i * 3 - 6 + Math.sin(t * 6 + i) * 2, -30, i * 4); ctx.stroke(); }
  ctx.restore();
}

function drawNest(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(52,35,63,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 44, 12, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y - 8, 40, 16, 0, 0, TAU); fillStroke(ctx, '#c9a47a', 3);
  ctx.strokeStyle = '#8a5a36'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x - 36 + i * 12, y - 14); ctx.quadraticCurveTo(x - 30 + i * 12, y, x - 24 + i * 12, y - 16); ctx.stroke(); }
  drawSobaBird(ctx, x - 6, y - 26 + Math.sin(t * 3) * 1.5, t, 1.1, false);
}

function drawLake(ctx, L, t) {
  const { x, y, w, h } = L;
  rr(ctx, x - 16, y - 14, w + 32, h + 28, 60); fillStroke(ctx, '#e9eef4', 3);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#d9f4ff'); g.addColorStop(0.5, '#8fd3ef'); g.addColorStop(1, '#4fa9cf');
  rr(ctx, x, y, w, h, 50); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); rr(ctx, x, y, w, h, 50); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  [[x + 40, y + 30, 36, 14], [x + w - 70, y + h - 40, 44, 16]].forEach(([ix, iy, rx, ry]) => { ctx.beginPath(); ctx.ellipse(ix, iy, rx, ry, 0.2, 0, TAU); ctx.fill(); });
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) { const sx = x + ((i * 83 + t * 12) % w), sy = y + 30 + ((i * 41) % (h - 50)); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 6, sy - 3, sx + 12, sy); ctx.stroke(); }
  ctx.restore();
}

function drawStatue(ctx, x, y, t, lit, open) {
  ctx.fillStyle = 'rgba(52,35,63,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 70, 16, 0, 0, TAU); ctx.fill();
  // pedestal with four face screens
  rr(ctx, x - 62, y - 70, 124, 76, 10); fillStroke(ctx, '#a9a39a', 3);
  STATUE_FACES.forEach((mood, i) => {
    const sx = x - 55 + i * 28, sy = y - 58;
    rr(ctx, sx, sy, 26, 24, 5); fillStroke(ctx, '#1f1a2e', 2);
    ctx.save(); rr(ctx, sx, sy, 26, 24, 5); ctx.clip();
    ctx.globalAlpha = i < lit ? 1 : 0.28;
    drawFace(ctx, mood, t, sx + 13, sy + 12, 0.48);
    ctx.restore();
    if (i < lit) { ctx.fillStyle = 'rgba(159,243,255,0.25)'; circle(ctx, sx + 13, sy + 12, 18); ctx.fill(); }
  });
  ctx.fillStyle = '#6e685f'; ctx.font = '800 9px "Baloo 2", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SHOW ME YOUR FACES', x, y - 18);
  ctx.fillText('IN THIS ORDER', x, y - 8);
  // stone body and square head
  if (open) {
    ctx.fillStyle = '#34233f'; rr(ctx, x - 20, y - 66, 40, 30, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,63,0.5)'; circle(ctx, x, y - 52, 24 + Math.sin(t * 3) * 4); ctx.fill();
  }
  rr(ctx, x - 20, y - 104, 40, 36, 10); fillStroke(ctx, '#bdb6ab', 3);
  rr(ctx, x - 36, y - 156, 72, 58, 14); fillStroke(ctx, '#cfc8bc', 3);
  rr(ctx, x - 28, y - 148, 56, 42, 8); fillStroke(ctx, lit >= 4 ? '#1f1a2e' : '#8d867c', 2.5);
  if (lit >= 4) drawFace(ctx, 'wow', t, x, y - 127, 1.1);
  else { ctx.fillStyle = '#6e685f'; circle(ctx, x - 10, y - 130, 3); ctx.fill(); circle(ctx, x + 10, y - 130, 3); ctx.fill(); ctx.strokeStyle = '#6e685f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 8, y - 118); ctx.lineTo(x + 8, y - 118); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 8, y - 156); ctx.lineTo(x + 12, y - 176); ctx.stroke();
  circle(ctx, x + 12, y - 180, 6); fillStroke(ctx, lit >= 4 ? '#ffd23f' : '#a9a39a', 2.5);
  // snow cap
  ctx.beginPath(); ctx.moveTo(x - 36, y - 146); ctx.quadraticCurveTo(x - 30, y - 162, x, y - 160); ctx.quadraticCurveTo(x + 30, y - 162, x + 36, y - 146); ctx.quadraticCurveTo(x, y - 152, x - 36, y - 146); ctx.closePath(); fillStroke(ctx, '#fff', 2);
}

function drawThunderRock(ctx, x, y, t, storm, hasNoodle) {
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 40, 11, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.lineTo(x - 26, y - 46); ctx.lineTo(x + 4, y - 60); ctx.lineTo(x + 32, y - 40); ctx.lineTo(x + 38, y); ctx.closePath(); fillStroke(ctx, '#6e685f', 3);
  ctx.strokeStyle = '#34233f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 4, y - 56); ctx.lineTo(x + 6, y - 38); ctx.lineTo(x - 4, y - 30); ctx.lineTo(x + 8, y - 12); ctx.stroke();
  if (storm && hasNoodle) {
    ctx.fillStyle = `rgba(255,210,63,${0.35 + Math.sin(t * 8) * 0.15})`; circle(ctx, x, y - 70, 26); ctx.fill();
    noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(x + 6, y - 90); ctx.lineTo(x - 6, y - 72); ctx.lineTo(x + 6, y - 72); ctx.lineTo(x - 4, y - 52); }, '#ffd23f', 5);
  }
}

function drawFog(ctx, t, top, bottom) {
  for (let y = top; y < bottom; y += 46) {
    for (let k = 0; k < 3; k++) {
      const x = PEAKS.left - 30 + k * 40 + Math.sin(t * 0.6 + y * 0.03 + k) * 16;
      ctx.fillStyle = `rgba(255,255,255,${0.8 - k * 0.2})`;
      circle(ctx, x, y + Math.cos(t * 0.5 + k + y) * 6, 44 - k * 6); ctx.fill();
    }
  }
}

function drawRidge(ctx, y0, y1) {
  for (let y = y0; y < y1; y += 60) {
    const x = PEAKS.left + ((y * 7) % 13) - 6;
    ctx.beginPath(); ctx.moveTo(x - 40, y + 30); ctx.quadraticCurveTo(x - 44, y - 30, x, y - 36); ctx.quadraticCurveTo(x + 44, y - 30, x + 40, y + 30); ctx.closePath();
    fillStroke(ctx, '#8d8579', 3);
  }
}

/* ---------------- Coaches and sky ---------------- */
function drawKombu(ctx, x, y, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 22, 7, 0, 0, TAU); ctx.fill();
  // body: a bundle of wavy kelp
  for (let i = -2; i <= 2; i++) noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(i * 6, 0); for (let k = 0; k <= 50; k += 5) ctx.lineTo(i * 6 + Math.sin(k * 0.2 + t * 3 + i) * 3, -k); }, '#4f9a5b', 6);
  // face blob
  ctx.beginPath(); ctx.ellipse(0, -56, 20, 17, 0, 0, TAU); fillStroke(ctx, '#5fb56b', 3);
  // swim cap
  ctx.beginPath(); ctx.arc(0, -60, 20, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#e4572e', 3);
  ctx.fillStyle = '#fff8e8'; ctx.fillRect(-16, -64, 32, 3);
  // goggles on the forehead, eyes, whistle
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  [-7, 7].forEach(ex => { ctx.beginPath(); ctx.ellipse(ex, -52, 4.5, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; circle(ctx, ex + 1, -51, 2.2); ctx.fill(); ctx.fillStyle = '#fff'; });
  ctx.beginPath(); ctx.arc(0, -45, 4, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -40); ctx.quadraticCurveTo(0, -28, 8, -40); ctx.stroke();
  rr(ctx, -4, -32, 8, 6, 2); fillStroke(ctx, '#ffd23f', 1.8);
  ctx.restore();
}
function drawPenne(ctx, x, y, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(52,35,63,0.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 24, 7, 0, 0, TAU); ctx.fill();
  // little pedestal made of penne tubes
  [-12, 0, 12].forEach((px, i) => { ctx.save(); ctx.translate(px, -8); ctx.rotate(0.3 - i * 0.3); rr(ctx, -5, -10, 10, 20, 3); fillStroke(ctx, '#f4c35a', 2.2); ctx.restore(); });
  drawSobaBird(ctx, 0, -34 + Math.sin(t * 2) * 1.5, t, 1.7, false);
  // pilot goggles
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(159,243,255,0.8)';
  circle(ctx, 22, -48 + Math.sin(t * 2) * 1.5, 5); ctx.fill(); ctx.stroke();
  // scarf
  ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(8, -36); ctx.quadraticCurveTo(-8, -30 + Math.sin(t * 5) * 3, -22, -38 + Math.sin(t * 5) * 4); ctx.stroke();
  ctx.restore();
}
function drawRing(ctx, x, y, z, t, got) {
  ctx.fillStyle = 'rgba(52,35,63,0.15)'; ctx.beginPath(); ctx.ellipse(x, y, 30, 9, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(x, y - z);
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 14, 34, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = got ? '#8cbf5a' : `hsl(${45 + Math.sin(t * 4) * 8}, 95%, 60%)`; ctx.stroke();
  ctx.restore();
}
function drawSkyCloud(ctx, c, t, hasNoodle) {
  ctx.save(); ctx.globalAlpha = c.alpha || 1; ctx.translate(c.x, c.y - c.z); ctx.scale(0.7, 0.7); ctx.translate(-c.x, -(c.y - c.z));
  const y = c.y - c.z + Math.sin(t) * 3;
  ctx.fillStyle = 'rgba(52,35,63,0.10)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, 80, 20, 0, 0, TAU); ctx.fill();
  [[-50, 6, 30], [-18, -8, 38], [22, -4, 34], [52, 8, 26], [0, 12, 40]].forEach(([dx, dy, r]) => { circle(ctx, c.x + dx, y + dy, r); fillStroke(ctx, '#ffffff', 3); });
  ctx.fillStyle = '#fff'; [[-50, 6, 27], [-18, -8, 35], [22, -4, 31], [52, 8, 23], [0, 12, 37]].forEach(([dx, dy, r]) => { circle(ctx, c.x + dx, y + dy, r); ctx.fill(); });
  if (hasNoodle) noodleStroke(ctx, () => { ctx.beginPath(); for (let k = -16; k <= 16; k += 2) ctx.lineTo(c.x + k, y - 22 + Math.sin(k * 0.35 + t * 4) * 4); }, '#9fd8f0', 4);
  ctx.restore();
}
function drawMeter(ctx, x, y, frac, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(52,35,63,0.6)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, frac))); ctx.stroke();
}

/* ---------------- Food trees ---------------- */
const FOOD_COLORS = { egg: '#ffd23f', chili: '#e4572e', shiitake: '#a0673b', shoot: '#e8d9a0', naruto: '#fff3d6', corn: '#ffd23f', scallion: '#8cbf5a', nori: '#2f4a3a', dumpling: '#fff3d6' };
// One small food item, centred on x,y
function drawFoodBit(ctx, id, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  switch (id) {
    case 'egg':
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 10, 0, 0, TAU); fillStroke(ctx, '#fff8e8', 2.2);
      circle(ctx, 0, 1, 4.5); ctx.fillStyle = '#f7a21b'; ctx.fill(); break;
    case 'chili':
      ctx.beginPath(); ctx.moveTo(-3, -8); ctx.quadraticCurveTo(8, -6, 6, 4); ctx.quadraticCurveTo(3, 10, -4, 11); ctx.quadraticCurveTo(1, 2, -3, -8); ctx.closePath(); fillStroke(ctx, '#e4572e', 2.2);
      ctx.strokeStyle = '#4f9a5b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-6, -12); ctx.stroke(); break;
    case 'shiitake':
      rr(ctx, -3, -1, 6, 10, 2); fillStroke(ctx, '#fff3d6', 2);
      ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#a0673b', 2.2);
      ctx.fillStyle = '#e9c49a'; circle(ctx, -4, -4, 1.6); ctx.fill(); circle(ctx, 3, -6, 1.3); ctx.fill(); break;
    case 'shoot':
      ctx.beginPath(); ctx.moveTo(-7, 9); ctx.lineTo(0, -11); ctx.lineTo(7, 9); ctx.closePath(); fillStroke(ctx, '#e8d9a0', 2.2);
      ctx.strokeStyle = '#8cbf5a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.moveTo(-2, -4); ctx.lineTo(2, -4); ctx.stroke(); break;
    case 'naruto':
      circle(ctx, 0, 0, 9); fillStroke(ctx, '#fff8e8', 2.2);
      ctx.strokeStyle = '#ff6f9c'; ctx.lineWidth = 2; ctx.beginPath(); for (let a = 0; a < TAU * 1.6; a += 0.2) { const r = 1 + a * 1.3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); break;
    case 'corn':
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 11, 0, 0, TAU); fillStroke(ctx, '#ffd23f', 2.2);
      ctx.fillStyle = '#e0a13a'; for (let r = -6; r <= 6; r += 4) for (let c2 = -2; c2 <= 2; c2 += 4) { circle(ctx, c2, r, 1.2); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(-6, 6); ctx.quadraticCurveTo(-10, 0, -4, -10); ctx.strokeStyle = '#8cbf5a'; ctx.lineWidth = 3; ctx.stroke(); break;
    case 'scallion':
      [-4, 0, 4].forEach((dx, i) => { rr(ctx, dx - 2, -10 + i, 4, 18, 2); fillStroke(ctx, '#8cbf5a', 1.8); });
      rr(ctx, -7, 5, 14, 5, 2); fillStroke(ctx, '#fff8e8', 1.8); break;
    case 'nori':
      rr(ctx, -8, -9, 16, 18, 2); fillStroke(ctx, '#2f4a3a', 2.2);
      ctx.strokeStyle = 'rgba(159,243,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -6); ctx.lineTo(-4, 6); ctx.moveTo(2, -6); ctx.lineTo(2, 6); ctx.stroke(); break;
    case 'dumpling':
      ctx.beginPath(); ctx.moveTo(-10, 5); ctx.quadraticCurveTo(-8, -9, 0, -9); ctx.quadraticCurveTo(8, -9, 10, 5); ctx.closePath(); fillStroke(ctx, '#fff3d6', 2.2);
      ctx.strokeStyle = 'rgba(52,35,63,0.4)'; ctx.lineWidth = 1.5; for (let i = -4; i <= 4; i += 4) { ctx.beginPath(); ctx.moveTo(i, -8); ctx.lineTo(i * 0.6, -2); ctx.stroke(); } break;
  }
  ctx.restore();
}
function drawFoodIcon(ctx, id, size) {
  ctx.save(); ctx.clearRect(0, 0, size, size); ctx.scale(size / 64, size / 64);
  circle(ctx, 32, 32, 29); fillStroke(ctx, '#fff8e8', 3);
  drawFoodBit(ctx, id, 32, 33, 2);
  ctx.restore();
}

// Trees: each kind looks different; `fruit` = how many foods are still on it today
function drawTree(ctx, x, y, t, kind, fruit, shake = 0) {
  if (kind === 'willow') return drawWillow(ctx, x, y, t);
  const sway = Math.sin(t * 1.5 + x * 0.01) * 1.5 + Math.sin(t * 40) * shake * 5;
  const food = TREE_FOOD[kind];
  const fruitAt = (pts) => pts.slice(0, fruit).forEach(([fx, fy]) => drawFoodBit(ctx, food, x + fx + sway, y + fy, 0.9));
  ctx.fillStyle = 'rgba(52,35,63,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 3, 40, 11, 0, 0, TAU); ctx.fill();
  switch (kind) {
    case 'egg':
      rr(ctx, x - 8, y - 60, 16, 62, 5); fillStroke(ctx, '#a0673b', 3);
      [[-26, -80, 30], [24, -84, 30], [0, -104, 34]].forEach(([dx, dy, r]) => { circle(ctx, x + dx + sway, y + dy, r); fillStroke(ctx, '#7fbf5a', 3); });
      fruitAt([[-22, -82], [20, -92], [2, -112]]);
      break;
    case 'chili':
      [[-18, -20, 22], [16, -22, 22], [0, -38, 24]].forEach(([dx, dy, r]) => { circle(ctx, x + dx + sway * 0.5, y + dy, r); fillStroke(ctx, '#4f9a5b', 3); });
      fruitAt([[-16, -26], [14, -28], [0, -46]]);
      break;
    case 'mushroom':
      rr(ctx, x - 12, y - 50, 24, 52, 8); fillStroke(ctx, '#fff3d6', 3);
      ctx.beginPath(); ctx.ellipse(x + sway * 0.4, y - 56, 48, 30, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#a0673b', 3);
      ctx.fillStyle = '#e9c49a'; [[-20, -66, 6], [8, -74, 5], [26, -62, 4]].forEach(([dx, dy, r]) => { circle(ctx, x + dx, y + dy, r); ctx.fill(); });
      fruitAt([[-30, -8], [30, -6]]);
      break;
    case 'bamboo':
      [-18, -4, 12].forEach((dx, i) => {
        const h = 110 + i * 14, bx = x + dx + sway * (1 + i * 0.3);
        rr(ctx, bx - 5, y - h, 10, h, 4); fillStroke(ctx, '#8cbf5a', 2.5);
        ctx.strokeStyle = '#4f9a5b'; ctx.lineWidth = 2; for (let k = y - 20; k > y - h; k -= 24) { ctx.beginPath(); ctx.moveTo(bx - 5, k); ctx.lineTo(bx + 5, k); ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(bx + 12, y - h + 10, 12, 4, -0.4, 0, TAU); fillStroke(ctx, '#8cbf5a', 2);
      });
      fruitAt([[-26, -6], [22, -6]]);
      break;
    case 'naruto':
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x - 2 + sway, y - 60, x + 6 + sway, y - 110); ctx.lineTo(x + 16 + sway, y - 108); ctx.quadraticCurveTo(x + 8, y - 60, x + 8, y); ctx.closePath(); fillStroke(ctx, '#c98b5a', 3);
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.7; ctx.beginPath(); ctx.ellipse(x + 11 + sway + Math.cos(a) * 30, y - 112 + Math.sin(a) * 16 + 12, 30, 8, a, 0, TAU); fillStroke(ctx, '#5fa05f', 2.5); }
      fruitAt([[-4, -104], [26, -100], [12, -92]]);
      break;
    case 'corn':
      [-14, 0, 14].forEach((dx, i) => {
        const bx = x + dx + sway * (0.8 + i * 0.2), h = 70 + i * 10;
        ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.lineTo(bx, y - h); ctx.stroke();
        ctx.strokeStyle = '#8cbf5a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(bx + 8, y - h * 0.6, 14, 4, -0.6, 0, TAU); fillStroke(ctx, '#8cbf5a', 2);
      });
      fruitAt([[-10, -50], [12, -58]]);
      break;
    case 'scallion':
      for (let i = -3; i <= 3; i++) { const bx = x + i * 8; ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + sway, y - 44 - Math.abs(i) * -2); ctx.stroke(); ctx.strokeStyle = i % 2 ? '#8cbf5a' : '#a9d86e'; ctx.lineWidth = 5; ctx.stroke(); }
      rr(ctx, x - 30, y - 10, 60, 12, 5); fillStroke(ctx, '#fff8e8', 2.5);
      fruitAt([[-20, -28], [20, -30]]);
      break;
    case 'nori':
      for (let i = -2; i <= 2; i++) noodleStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(x + i * 10, y); for (let k = 0; k <= 90; k += 6) ctx.lineTo(x + i * 10 + Math.sin(k * 0.1 + t * 2 + i) * 6 + sway, y - k); }, '#2f6a4a', 7);
      fruitAt([[-16, -60], [16, -70], [0, -86]]);
      break;
    case 'dumpling':
      [[-20, -18, 22], [18, -20, 22], [0, -36, 26]].forEach(([dx, dy, r]) => { circle(ctx, x + dx + sway * 0.4, y + dy, r); fillStroke(ctx, '#6fa54a', 3); });
      fruitAt([[-18, -24], [16, -26], [0, -46]]);
      break;
  }
}

function drawSignpost(ctx, x, y, signs) {
  ctx.fillStyle = 'rgba(52,35,63,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 16, 5, 0, 0, TAU); ctx.fill();
  rr(ctx, x - 4, y - 70, 8, 72, 3); fillStroke(ctx, '#a0673b', 2.5);
  ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textBaseline = 'middle';
  signs.forEach(([label, deg], i) => {
    const right = Math.cos(deg * Math.PI / 180) >= -0.01;
    const w = ctx.measureText(label).width + 26, sy = y - 62 + i * 20;
    ctx.save(); ctx.translate(x, sy);
    ctx.beginPath();
    if (right) { ctx.moveTo(-4, -8); ctx.lineTo(w - 8, -8); ctx.lineTo(w, 0); ctx.lineTo(w - 8, 8); ctx.lineTo(-4, 8); }
    else { ctx.moveTo(4, -8); ctx.lineTo(-w + 8, -8); ctx.lineTo(-w, 0); ctx.lineTo(-w + 8, 8); ctx.lineTo(4, 8); }
    ctx.closePath(); fillStroke(ctx, '#f3dca0', 2.2);
    ctx.fillStyle = INK; ctx.textAlign = 'center';
    ctx.fillText(label + (Math.abs(Math.sin(deg * Math.PI / 180)) > 0.6 ? (Math.sin(deg * Math.PI / 180) > 0 ? ' ↓' : ' ↑') : ''), right ? w / 2 - 4 : -w / 2 + 4, 1);
    ctx.restore();
  });
}
function drawGuideArrow(ctx, x, y, angle, t, label, color = '#ffd23f') {
  const r = 58 + Math.sin(t * 5) * 4;
  ctx.save(); ctx.translate(x + Math.cos(angle) * r, y + Math.sin(angle) * r * 0.6); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -13); ctx.lineTo(-3, 0); ctx.lineTo(-8, 13); ctx.closePath();
  fillStroke(ctx, color, 3);
  ctx.restore();
  if (label) {
    ctx.font = '800 12px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lx = x + Math.cos(angle) * (r + 30), ly = y + Math.sin(angle) * (r + 30) * 0.6;
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText(label, lx, ly); ctx.fillStyle = '#fff8e8'; ctx.fillText(label, lx, ly);
  }
}

/* ---------------- Hats ---------------- */
// x, y = the top middle of the square head
function drawHat(ctx, x, y, id, t, flying) {
  ctx.save(); ctx.translate(x, y);
  switch (id) {
    case 'chef':
      rr(ctx, -14, -12, 28, 12, 3); fillStroke(ctx, '#ffffff', 2.5);
      [[-10, -18, 9], [0, -24, 11], [10, -18, 9]].forEach(([cx, cy, r]) => { circle(ctx, cx, cy, r); fillStroke(ctx, '#ffffff', 2.5); });
      ctx.fillStyle = '#fff'; ctx.fillRect(-13, -16, 26, 8);
      break;
    case 'beanie':
      ctx.beginPath(); ctx.arc(0, 0, 18, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#f7dc7a', 2.5);
      ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 2; for (let i = -12; i <= 12; i += 6) { ctx.beginPath(); ctx.moveTo(i, -2); ctx.quadraticCurveTo(i + 3, -9, i, -15); ctx.stroke(); }
      rr(ctx, -19, -4, 38, 7, 3); fillStroke(ctx, '#e4572e', 2);
      circle(ctx, 0, -20, 5); fillStroke(ctx, '#e4572e', 2);
      break;
    case 'party':
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(0, -34); ctx.lineTo(12, 0); ctx.closePath(); fillStroke(ctx, '#b98cff', 2.5);
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(6, -16); ctx.moveTo(-4, -22); ctx.lineTo(3, -26); ctx.stroke();
      circle(ctx, 0, -36, 4.5); fillStroke(ctx, '#ff8fb1', 2);
      break;
    case 'bowl':
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-18, -20, 0, -20); ctx.quadraticCurveTo(18, -20, 18, 0); ctx.closePath(); fillStroke(ctx, '#e4572e', 2.5);
      ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, -9); ctx.lineTo(12, -9); ctx.stroke();
      ctx.strokeStyle = '#a0673b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(10, -34); ctx.moveTo(-1, -19); ctx.lineTo(15, -32); ctx.stroke();
      break;
    case 'propeller': {
      ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#2fa4b5', 2.5);
      ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI, Math.PI * 1.5); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -22); ctx.stroke();
      const spin = t * (flying ? 30 : 4), w = Math.abs(Math.cos(spin)) * 16 + 3;
      ctx.beginPath(); ctx.ellipse(0, -23, w, 3.5, 0, 0, TAU); fillStroke(ctx, '#ffd23f', 2);
      break;
    }
    case 'crown':
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -16); ctx.lineTo(-8, -8); ctx.lineTo(0, -20); ctx.lineTo(8, -8); ctx.lineTo(16, -16); ctx.lineTo(16, 0); ctx.closePath();
      fillStroke(ctx, '#ffd23f', 2.5);
      [[-16, -16], [0, -20], [16, -16]].forEach(([cx, cy]) => { circle(ctx, cx, cy, 2.8); fillStroke(ctx, '#e4572e', 1.5); });
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-12, -6, 6, 3);
      break;
    case 'flower':
      ctx.strokeStyle = '#6fa54a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(0, -8, 20, -2); ctx.stroke();
      [[-16, -3, '#ffb3c8'], [-6, -6, '#fff8e8'], [5, -6, '#ffd23f'], [15, -3, '#b98cff']].forEach(([cx, cy, col]) => {
        for (let k = 0; k < 5; k++) { ctx.fillStyle = col; circle(ctx, cx + Math.cos(k * 1.26) * 3.5, cy + Math.sin(k * 1.26) * 3.5, 3); ctx.fill(); }
        ctx.fillStyle = '#f4b942'; circle(ctx, cx, cy, 2); ctx.fill();
      });
      break;
    case 'shell':
      circle(ctx, 0, -12, 14); fillStroke(ctx, '#ffd23f', 2.5);
      noodleStroke(ctx, () => { ctx.beginPath(); for (let a = 0; a < TAU * 2; a += 0.2) { const r = 1.5 + a * 1.7; ctx.lineTo(Math.cos(a) * r, -12 + Math.sin(a) * r); } }, '#fff1a8', 3);
      break;
  }
  ctx.restore();
}
