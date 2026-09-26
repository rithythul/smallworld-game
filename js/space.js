// Space daydreams: float above the Noodle Universe in a space suit, steer the Noodle Rocket
// in zero gravity and collect Guide Stars that whisper hints about what to do next.
const Space = (() => {
  const W = 1000, H = 700;             // virtual space, scaled to fit the screen
  let S = null;

  function drawRocket(ctx, x, y, angle, t, flame, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    if (flame > 0) {
      const f = 18 + Math.sin(t * 40) * 6 + flame * 16;
      ctx.beginPath(); ctx.moveTo(-10, 30); ctx.quadraticCurveTo(0, 30 + f * 1.6, 10, 30); ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-5, 30); ctx.quadraticCurveTo(0, 30 + f, 5, 30); ctx.closePath(); ctx.fillStyle = '#e4572e'; ctx.fill();
    }
    // fins
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.moveTo(sd * 14, 10); ctx.lineTo(sd * 26, 32); ctx.lineTo(sd * 12, 28); ctx.closePath(); fillStroke(ctx, '#e4572e', 2.5); });
    // body: a noodle cup
    ctx.beginPath(); ctx.moveTo(-16, 30); ctx.lineTo(-20, -18); ctx.quadraticCurveTo(0, -46, 20, -18); ctx.lineTo(16, 30); ctx.closePath(); fillStroke(ctx, '#fff3d6', 3);
    ctx.fillStyle = color || '#e4572e'; ctx.fillRect(-19, 8, 38, 9);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-19, 8, 38, 9);
    // window with Squareface in his helmet
    circle(ctx, 0, -10, 12); fillStroke(ctx, '#1f1a2e', 2.5);
    drawFace(ctx, 'wow', t, 0, -10, 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(ctx, -4, -14, 3); ctx.fill();
    ctx.restore();
  }

  function drawPlanet(ctx, t) {
    // the Noodle Universe seen from above: a giant ramen bowl planet with noodle rings
    const cx = W / 2, cy = H + 260;
    ctx.save();
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(247,220,122,0.55)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 40, 620, 140, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    const g = ctx.createRadialGradient(cx - 120, cy - 300, 40, cx, cy, 460);
    g.addColorStop(0, '#ffe7a8'); g.addColorStop(0.5, '#f4b942'); g.addColorStop(1, '#c9783a');
    circle(ctx, cx, cy, 420); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,232,0.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let r = 0; r < 4; r++) { ctx.beginPath(); for (let x = cx - 330; x <= cx + 330; x += 10) ctx.lineTo(x, cy - 360 + r * 40 + Math.sin(x * 0.03 + t + r) * 8); ctx.stroke(); }
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(247,220,122,0.8)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 40, 620, 140, 0, Math.PI * 1.95, Math.PI * 2.05 + Math.PI); ctx.stroke();
    ctx.restore();
  }

  function start(opts) {
    const rnd = mulberry(opts.seed || 1);
    S = {
      t: 0, done: false, endT: 0, lines: opts.lines, onEnd: opts.onEnd, color: opts.color,
      ship: { x: W / 2, y: H / 2 + 120, vx: 0, vy: 0, a: 0 },
      stars: [[190, 150], [800, 170], [500, 90]].map(([x, y]) => ({ x, y, got: false })),
      dust: Array.from({ length: 14 }, () => ({ x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 260), got: false })),
      comets: Array.from({ length: 4 }, (_, i) => ({ x: rnd() * W, y: 60 + rnd() * 380, vx: (rnd() < 0.5 ? -1 : 1) * (60 + rnd() * 70), vy: (rnd() - 0.5) * 30, r: 16 + i * 3 })),
      sky: Array.from({ length: 160 }, () => ({ x: rnd() * W, y: rnd() * H, s: rnd() * 1.8 + 0.4, p: rnd() * 6 })),
      msg: 'A daydream... You float up into space! Steer the rocket and catch the 3 Guide Stars.', msgT: 5,
      coins: 0, shake: 0,
    };
  }

  function update(dt, mx, my, boost) {
    if (!S) return;
    S.t += dt; S.msgT -= dt; S.shake = Math.max(0, S.shake - dt * 30);
    const sh = S.ship;
    if (!S.done) {
      // zero gravity: you keep drifting until you push the other way
      const acc = boost ? 520 : 260;
      sh.vx += mx * acc * dt; sh.vy += my * acc * dt;
      sh.vx *= 0.994; sh.vy *= 0.994;
      const sp = Math.hypot(sh.vx, sh.vy), max = boost ? 420 : 300;
      if (sp > max) { sh.vx *= max / sp; sh.vy *= max / sp; }
      if (Math.hypot(mx, my) > 0.2) sh.a = Math.atan2(my, mx) + Math.PI / 2;
    }
    sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    if (sh.x < 30 || sh.x > W - 30) { sh.vx *= -0.6; sh.x = Math.max(30, Math.min(W - 30, sh.x)); }
    if (sh.y < 30 || sh.y > H - 60) { sh.vy *= -0.6; sh.y = Math.max(30, Math.min(H - 60, sh.y)); }
    S.flame = boost || Math.hypot(mx, my) > 0.2 ? (boost ? 1 : 0.4) : 0;
    S.comets.forEach(c => {
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.x < -60) c.x = W + 60; if (c.x > W + 60) c.x = -60;
      if (Math.hypot(c.x - sh.x, c.y - sh.y) < c.r + 22) {
        const nx = (sh.x - c.x) / (Math.hypot(sh.x - c.x, sh.y - c.y) || 1), ny = (sh.y - c.y) / (Math.hypot(sh.x - c.x, sh.y - c.y) || 1);
        sh.vx = nx * 260; sh.vy = ny * 260; S.shake = 8; Sound.crunch(0.5);
      }
    });
    S.dust.forEach(d => { if (!d.got && Math.hypot(d.x - sh.x, d.y - sh.y) < 30) { d.got = true; S.coins++; Sound.coin(); } });
    S.stars.forEach((st, i) => {
      if (st.got || Math.hypot(st.x - sh.x, st.y - sh.y) > 40) return;
      st.got = true; Sound.secret();
      const n = S.stars.filter(x => x.got).length;
      S.msg = `✦ Guide Star ${n}/3: ${S.lines[n - 1]}`; S.msgT = 6;
      if (n === 3) { S.done = true; S.endT = S.t + 6.5; }
    });
    if (!S.done && S.t > 75) { S.done = true; S.endT = S.t + 1; S.msg = 'The daydream fades...'; S.msgT = 2; }
    if (S.done && S.t >= S.endT) { const end = S.onEnd, coins = S.coins, got = S.stars.filter(x => x.got).length; S = null; end && end({ coins, stars: got }); }
  }

  function lines(ctx, text, maxW) {
    const out = []; let line = '';
    text.split(' ').forEach(w => { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test; });
    out.push(line); return out;
  }

  function render(ctx, vw, vh, dpr) {
    if (!S) return;
    const t = S.t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#120a26'); g.addColorStop(0.6, '#2b1f4e'); g.addColorStop(1, '#4a2f6b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
    const k = Math.min(vw / W, vh / H), ox = (vw - W * k) / 2 + (Math.random() - 0.5) * S.shake, oy = (vh - H * k) / 2 + (Math.random() - 0.5) * S.shake;
    // stars fill the whole screen, with a little parallax
    S.sky.forEach(st => {
      const a = 0.4 + Math.sin(t * 2 + st.p) * 0.3;
      ctx.fillStyle = `rgba(255,255,240,${a})`;
      const x = ((st.x * vw / W) - S.ship.x * 0.02 * st.s + vw) % vw, y = ((st.y * vh / H) - S.ship.y * 0.02 * st.s + vh) % vh;
      ctx.fillRect(x, y, st.s * 1.6, st.s * 1.6);
    });
    ctx.setTransform(dpr * k, 0, 0, dpr * k, ox * dpr, oy * dpr);
    drawPlanet(ctx, t);
    // star dust (coins)
    S.dust.forEach(d => { if (d.got) return; ctx.fillStyle = `rgba(255,210,63,${0.7 + Math.sin(t * 5 + d.x) * 0.3})`; circle(ctx, d.x, d.y, 6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); });
    // comets: frozen noodle clumps with tails
    S.comets.forEach(c => {
      ctx.strokeStyle = 'rgba(159,243,255,0.5)'; ctx.lineWidth = c.r * 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x - Math.sign(c.vx) * 60, c.y - c.vy * 0.4); ctx.stroke();
      circle(ctx, c.x, c.y, c.r); fillStroke(ctx, '#c9d6e8', 3);
      noodleStroke(ctx, () => { ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.5, 0, Math.PI * 1.5); }, '#f7dc7a', 3);
    });
    // guide stars
    S.stars.forEach(st => {
      if (st.got) return;
      const r = 20 + Math.sin(t * 3) * 3;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,236,140,0.28)'; circle(ctx, st.x, st.y, r * 2); ctx.fill(); ctx.restore();
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr2 = i % 2 ? r * 0.45 : r; const a = i * Math.PI / 5 - Math.PI / 2 + t * 0.5; ctx.lineTo(st.x + Math.cos(a) * rr2, st.y + Math.sin(a) * rr2); } ctx.closePath();
      fillStroke(ctx, '#ffd23f', 3);
    });
    drawRocket(ctx, S.ship.x, S.ship.y, S.ship.a, t, S.flame, S.color);
    // message panel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const got = S.stars.filter(x => x.got).length;
    ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const pw = Math.min(560, vw - 32), px = (vw - pw) / 2, py = 16;
    const text = S.msgT > 0 || got ? S.msg : 'Steer with the joystick or arrow keys. Hold the action button or Space to boost.';
    ctx.font = '700 14px "Baloo 2", sans-serif';
    const ls = lines(ctx, text, pw - 28);
    const ph = 40 + ls.length * 18;
    ctx.fillStyle = 'rgba(255,248,232,0.95)'; rr(ctx, px, py, pw, ph, 16); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.fillStyle = '#e4572e';
    ctx.fillText(`🧑‍🚀 Daydream · Guide Stars ${got}/3 · Star dust ${S.coins}`, px + 14, py + 10);
    ctx.font = '700 14px "Baloo 2", sans-serif'; ctx.fillStyle = INK;
    ls.forEach((l, i) => ctx.fillText(l, px + 14, py + 32 + i * 18));
  }

  return { start, update, render, get active() { return !!S; }, drawRocket };
})();
