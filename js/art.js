// 2D drawing for the screens around the 3D world: Squareface faces and heads, and Noodle-dex icons. Pure canvas, no image files.
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
    case 'love': {
      const heart = (x, y, k) => { ctx.beginPath(); ctx.moveTo(x, y + 4 * k); ctx.bezierCurveTo(x - 7 * k, y - 1 * k, x - 4 * k, y - 7 * k, x, y - 3 * k); ctx.bezierCurveTo(x + 4 * k, y - 7 * k, x + 7 * k, y - 1 * k, x, y + 4 * k); ctx.fill(); };
      const k = 1 + Math.sin(t * 8) * 0.12;
      ctx.fillStyle = '#ff8fb1'; ctx.shadowColor = '#ff8fb1'; heart(-8, -3, k); heart(8, -3, k);
      ctx.fillStyle = glow; ctx.shadowColor = glow; smile(7, 4, 3.5);
      break;
    }
    case 'laugh':
      closed(-8, -3); closed(8, -3);
      ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(8, 3); ctx.quadraticCurveTo(8, 12 + Math.abs(Math.sin(t * 14)) * 2, 0, 12 + Math.abs(Math.sin(t * 14)) * 2); ctx.quadraticCurveTo(-8, 12, -8, 3); ctx.fill();
      break;
    case 'silly':
      eye(-8, -3); ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(12, -3); ctx.stroke();
      smile(7, 3, 2.5);
      ctx.fillStyle = '#ff9fb5'; ctx.shadowColor = '#ff9fb5'; ctx.beginPath(); ctx.ellipse(3, 8 + Math.sin(t * 6), 3, 3.6, 0, 0, TAU); ctx.fill();
      break;
    case 'sad':
      eye(-8, -2); eye(8, -2);
      ctx.beginPath(); ctx.moveTo(-6, 9); ctx.quadraticCurveTo(0, 3, 6, 9); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-12, 4 + (t * 12 % 8), 1.6, 2.4, 0, 0, TAU); ctx.fill();
      break;
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
  if (opts.beat > 0.05) { ctx.fillStyle = `rgba(255,248,232,${0.55 * opts.beat})`; circle(ctx, ax, ay, 6 + opts.beat * 5); ctx.fill(); }
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
