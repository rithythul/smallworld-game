// Small World drawings: Small Town's ground, buildings, land, crops, forest and public projects.
// Same chunky outlined style as the rest of the game (art.js helpers: rr, circle, fillStroke, INK, TAU).
const TownArt = (() => {
  const GRASS = '#b4dc7a', ROAD = '#e9d9b0', ROAD_EDGE = '#d4bf8c';

  function drawGround(ctx, vx0, vy0, vx1, vy1, t, S) {
    const x0 = Math.max(Town.X0, vx0), x1 = Math.min(Town.X1, vx1), y0 = Math.max(0, vy0), y1 = Math.min(Town.H, vy1);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    ctx.fillStyle = GRASS; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // soft patches
    for (let i = 0; i < 70; i++) {
      const px = Town.X0 + ((i * 733) % 2400), py = (i * 479) % Town.H, r = 60 + (i * 37) % 90;
      if (px + r < vx0 || px - r > vx1 || py + r < vy0 || py - r > vy1) continue;
      ctx.fillStyle = i % 3 ? 'rgba(150,200,100,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.6, 0, 0, TAU); ctx.fill();
    }
    // the forest floor
    ctx.fillStyle = 'rgba(111,165,74,0.35)'; rr(ctx, 3680, 120, 900, 720, 120); ctx.fill();
    // roads
    ctx.lineCap = 'round';
    Town.ROADS.forEach(([ax, ay, bx, by]) => {
      ctx.strokeStyle = ROAD_EDGE; ctx.lineWidth = 96; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    Town.ROADS.forEach(([ax, ay, bx, by]) => {
      ctx.strokeStyle = ROAD; ctx.lineWidth = 80; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    });
    // dashed middle line on the main road
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5; ctx.setLineDash([26, 24]);
    ctx.beginPath(); ctx.moveTo(Town.X0, 1760); ctx.lineTo(Town.X1, 1760); ctx.stroke(); ctx.setLineDash([]);
    // plaza
    const P = Town.PLAZA;
    circle(ctx, P.x, P.y, P.r + 12); ctx.fillStyle = ROAD_EDGE; ctx.fill();
    circle(ctx, P.x, P.y, P.r); ctx.fillStyle = '#efe3c4'; ctx.fill();
    ctx.strokeStyle = 'rgba(180,160,120,0.5)'; ctx.lineWidth = 2;
    for (let r = 40; r < P.r; r += 36) { circle(ctx, P.x, P.y, r); ctx.stroke(); }
    // town farm field
    const F = Town.TOWN_FARM;
    rr(ctx, F.x, F.y, F.w, F.h, 24); fillStroke(ctx, '#a0673b', 4);
    ctx.strokeStyle = 'rgba(52,35,63,0.2)'; ctx.lineWidth = 3;
    for (let y = F.y + 30; y < F.y + F.h; y += 34) { ctx.beginPath(); ctx.moveTo(F.x + 16, y); ctx.lineTo(F.x + F.w - 16, y); ctx.stroke(); }
    // the Town Road sign at the edge
    ctx.font = '64px "Bagel Fat One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(52,35,63,0.12)'; ctx.fillText('Small Town', 4800, 1660);
    ctx.restore();
  }

  // a sign on a post
  function sign(ctx, x, y, text, color = '#fff8e8') {
    ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(190, ctx.measureText(text).width + 20);
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 3, y - 6, 6, 30);
    rr(ctx, x - w / 2, y - 30, w, 26, 7); fillStroke(ctx, color, 2.5);
    ctx.fillStyle = INK; ctx.fillText(text, x, y - 16, w - 12);
  }

  function roof(ctx, x, y, w, h, color) {
    ctx.beginPath(); ctx.moveTo(x - 14, y + h); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w + 14, y + h); ctx.closePath(); fillStroke(ctx, color, 3.5);
  }
  function windows(ctx, x, y, cols, rows, gx, gy, lit) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      rr(ctx, x + c * gx, y + r * gy, 26, 26, 5); fillStroke(ctx, lit ? '#ffe9a3' : '#9ff3ff', 2.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + c * gx + 13, y + r * gy); ctx.lineTo(x + c * gx + 13, y + r * gy + 26); ctx.stroke();
    }
  }
  function door(ctx, x, y, color = '#a0673b') { rr(ctx, x - 20, y - 56, 40, 56, 10); fillStroke(ctx, color, 3); ctx.fillStyle = '#ffd23f'; circle(ctx, x + 10, y - 28, 3); ctx.fill(); }

  // Buildings are drawn from their bottom-center point (b.x, b.y)
  function drawBuilding(ctx, b, t, night) {
    const { x, y, w, h } = b, L = x - w / 2, T = y - h;
    ctx.fillStyle = 'rgba(52,35,63,0.2)'; rr(ctx, L + 10, y - 16, w, 30, 14); ctx.fill();
    switch (b.id) {
      case 'hall':
        rr(ctx, L, T + 60, w, h - 60, 8); fillStroke(ctx, '#fff3d6', 3.5);
        ctx.beginPath(); ctx.moveTo(L - 16, T + 66); ctx.lineTo(x, T + 18); ctx.lineTo(L + w + 16, T + 66); ctx.closePath(); fillStroke(ctx, '#e4572e', 3.5);
        ctx.beginPath(); ctx.arc(x, T + 20, 34, Math.PI, 0); ctx.closePath(); fillStroke(ctx, '#8cbf5a', 3.5);
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, T - 14); ctx.lineTo(x, T - 56); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, T - 56); ctx.lineTo(x + 30 + Math.sin(t * 3) * 3, T - 48); ctx.lineTo(x, T - 40); ctx.closePath(); fillStroke(ctx, '#5b7cfa', 2.5);
        for (let i = 0; i < 6; i++) { rr(ctx, L + 24 + i * ((w - 60) / 5), T + 80, 14, h - 90, 4); fillStroke(ctx, '#f7f1e3', 2.5); }
        door(ctx, x, y, '#8a5a34');
        break;
      case 'bank':
        rr(ctx, L, T + 40, w, h - 40, 8); fillStroke(ctx, '#e8f1f7', 3.5);
        ctx.beginPath(); ctx.moveTo(L - 12, T + 46); ctx.lineTo(x, T); ctx.lineTo(L + w + 12, T + 46); ctx.closePath(); fillStroke(ctx, '#5b7cfa', 3.5);
        circle(ctx, x, T + 28, 13); fillStroke(ctx, '#ffd23f', 2.5); ctx.fillStyle = INK; ctx.font = '800 14px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, T + 29);
        for (let i = 0; i < 4; i++) { rr(ctx, L + 18 + i * ((w - 50) / 3), T + 60, 14, h - 70, 4); fillStroke(ctx, '#fff', 2.5); }
        door(ctx, x, y, '#34233f');
        break;
      case 'market':
        rr(ctx, L, T + 50, w, h - 50, 8); fillStroke(ctx, '#fff3d6', 3.5);
        for (let i = 0; i < 7; i++) {
          const sx = L - 10 + i * ((w + 20) / 7);
          ctx.beginPath(); ctx.moveTo(sx, T + 20); ctx.lineTo(sx + (w + 20) / 7, T + 20); ctx.lineTo(sx + (w + 20) / 7, T + 62); ctx.quadraticCurveTo(sx + (w + 20) / 14, T + 76, sx, T + 62); ctx.closePath();
          fillStroke(ctx, i % 2 ? '#fff8e8' : '#e4572e', 2.5);
        }
        // crates of vegetables
        [['#f08a3c', -70], ['#e4572e', -20], ['#f4c35a', 30], ['#8cbf5a', 80]].forEach(([c, dx]) => {
          rr(ctx, x + dx - 20, y - 40, 40, 30, 5); fillStroke(ctx, '#c98a52', 2.5);
          for (let k = 0; k < 3; k++) { ctx.fillStyle = c; circle(ctx, x + dx - 10 + k * 10, y - 42, 7); ctx.fill(); }
        });
        break;
      case 'school':
        rr(ctx, L, T + 50, w, h - 50, 8); fillStroke(ctx, '#e59866', 3.5);
        roof(ctx, L, T + 10, w, 46, '#b8693e');
        rr(ctx, x - 22, T - 30, 44, 44, 6); fillStroke(ctx, '#e59866', 3); ctx.fillStyle = '#ffd23f'; circle(ctx, x, T - 6 + Math.sin(t * 2) * 2, 9); ctx.fill();
        windows(ctx, L + 22, T + 72, 3, 1, 60, 40, night); windows(ctx, L + w - 58, T + 72, 1, 1, 0, 0, night);
        door(ctx, x, y, '#5b7cfa');
        break;
      case 'jobs':
        rr(ctx, L, T + 40, w, h - 40, 8); fillStroke(ctx, '#bcd6ff', 3.5);
        rr(ctx, L - 8, T + 26, w + 16, 30, 8); fillStroke(ctx, '#5b7cfa', 3);
        // an envelope and a briefcase
        rr(ctx, x - 70, T + 70, 44, 30, 4); fillStroke(ctx, '#fff', 2.5); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 70, T + 70); ctx.lineTo(x - 48, T + 88); ctx.lineTo(x - 26, T + 70); ctx.stroke();
        rr(ctx, x + 28, T + 72, 44, 30, 5); fillStroke(ctx, '#a0673b', 2.5); rr(ctx, x + 40, T + 64, 20, 10, 4); ctx.stroke();
        door(ctx, x, y, '#34233f');
        break;
      case 'rent':
        rr(ctx, L, T, w, h, 8); fillStroke(ctx, '#f0d2b0', 3.5);
        rr(ctx, L - 8, T - 12, w + 16, 22, 6); fillStroke(ctx, '#9a7b5b', 3);
        windows(ctx, L + 22, T + 26, 4, 3, 58, 46, night);
        door(ctx, x, y, '#8a5a34');
        break;
    }
    // name sign over the door
    ctx.font = '800 16px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = `${b.icon} ${b.name}`, lw = ctx.measureText(label).width + 22;
    rr(ctx, x - lw / 2, y - 92, lw, 26, 8); fillStroke(ctx, '#fff8e8', 2.5);
    ctx.fillStyle = INK; ctx.fillText(label, x, y - 78);
  }

  // Land: fence, soil or gravel, and a sign with the price or the owner
  function drawPlot(ctx, p, st, t, now, mine) {
    const owned = st && st.owner;
    ctx.fillStyle = p.kind === 'farm' ? (owned ? '#8f5d36' : '#c7a57a') : (owned ? '#d8cdb4' : '#cfe3a8');
    rr(ctx, p.x, p.y, p.w, p.h, 12); ctx.fill();
    ctx.strokeStyle = mine ? '#ffd23f' : '#8a5a34'; ctx.lineWidth = mine ? 5 : 3; ctx.setLineDash(owned ? [] : [10, 8]); rr(ctx, p.x, p.y, p.w, p.h, 12); ctx.stroke(); ctx.setLineDash([]);
    if (p.kind === 'farm' && st) st.soil.forEach((c, i) => {
      const s = Town.soilSpot(p, i);
      ctx.fillStyle = 'rgba(52,35,63,0.25)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 4, 22, 10, 0, 0, TAU); ctx.fill();
      if (c) drawCrop(ctx, s.x, s.y, c.k, Town.cropProgress(c, now), Town.cropState(c, now), t);
    });
  }
  function plotSign(ctx, p, st, now) {
    const sx = p.x + 30, sy = p.y + p.h - 4;
    if (!st || !st.owner) sign(ctx, sx + 40, sy, `For sale ${p.price}🪙`, '#fff3a8');
    else sign(ctx, sx + 40, sy, `${st.name}'s ${p.kind === 'farm' ? 'farm' : st.build ? Town.BUILD[st.build].name.toLowerCase() : 'land'}`);
  }

  const CROP_COLORS = { wheat: '#f4c35a', carrot: '#f08a3c', tomato: '#e4572e', corn: '#f7dc7a' };
  function drawCrop(ctx, x, y, k, prog, state, t) {
    const sway = Math.sin(t * 2 + x) * 1.5;
    if (k === 'tree') return drawTownTree(ctx, x, y + 4, t, 'oak', prog >= 1 ? 'tree' : 'sapling', prog, 0.55);
    if (state === 'dry') { ctx.fillStyle = '#6b4a2f'; circle(ctx, x - 6, y, 3); ctx.fill(); circle(ctx, x + 5, y + 2, 3); ctx.fill(); return; }
    const hgt = 8 + prog * 26;
    ctx.strokeStyle = '#4f8f35'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    [-8, 0, 8].forEach((dx, i) => { ctx.beginPath(); ctx.moveTo(x + dx, y); ctx.quadraticCurveTo(x + dx + sway, y - hgt * 0.6, x + dx * 1.3 + sway, y - hgt * (i === 1 ? 1 : 0.8)); ctx.stroke(); });
    if (state === 'ready') {
      ctx.fillStyle = CROP_COLORS[k];
      if (k === 'carrot') { ctx.beginPath(); ctx.moveTo(x - 7, y - 2); ctx.lineTo(x + 7, y - 2); ctx.lineTo(x, y + 14); ctx.closePath(); fillStroke(ctx, CROP_COLORS[k], 2); }
      else if (k === 'tomato') { [[-8, -18], [6, -24], [0, -10]].forEach(([dx, dy]) => { circle(ctx, x + dx + sway, y + dy, 7); fillStroke(ctx, CROP_COLORS[k], 2); }); }
      else if (k === 'corn') { rr(ctx, x - 5 + sway, y - 34, 10, 22, 5); fillStroke(ctx, CROP_COLORS[k], 2); }
      else { [-8, 0, 8].forEach(dx => { rr(ctx, x + dx * 1.3 + sway - 3, y - hgt - 10, 6, 12, 3); fillStroke(ctx, CROP_COLORS[k], 1.5); }); }
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 5 + x) * 0.4})`; circle(ctx, x + 12, y - hgt, 3); ctx.fill();
    } else if (state === 'growing') {
      // a little water shine
      ctx.fillStyle = 'rgba(95,208,230,0.5)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 18, 6, 0, 0, TAU); ctx.fill();
    }
  }

  function drawTownTree(ctx, x, y, t, kind, state, prog = 1, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(52,35,63,0.18)'; ctx.beginPath(); ctx.ellipse(0, 3, 34, 10, 0, 0, TAU); ctx.fill();
    if (state === 'stump') {
      ctx.beginPath(); ctx.ellipse(0, -6, 18, 8, 0, 0, TAU); rr(ctx, -18, -8, 36, 12, 4); fillStroke(ctx, '#a0673b', 3);
      ctx.beginPath(); ctx.ellipse(0, -8, 16, 6, 0, 0, TAU); fillStroke(ctx, '#e0b98a', 2);
      ctx.strokeStyle = '#a0673b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -8, 8, 3, 0, 0, TAU); ctx.stroke();
    } else if (state === 'sapling') {
      const g = 0.4 + prog * 0.6;
      ctx.strokeStyle = '#6fa54a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26 * g); ctx.stroke();
      [[-8, -22], [8, -26], [0, -32]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.ellipse(dx * g, dy * g, 7 * g, 4.5 * g, dx / 10, 0, TAU); fillStroke(ctx, '#8cbf5a', 2); });
    } else if (kind === 'pine') {
      rr(ctx, -6, -24, 12, 26, 3); fillStroke(ctx, '#8a5a34', 3);
      [[46, -30], [38, -60], [28, -88]].forEach(([w, yy]) => { ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(0, yy - 44); ctx.lineTo(w, yy); ctx.closePath(); fillStroke(ctx, '#4f8f5a', 3); });
    } else {
      const sw = Math.sin(t * 1.4 + x * 0.01) * 1.5;
      rr(ctx, -8, -52, 16, 54, 4); fillStroke(ctx, '#8a5a34', 3);
      [[-24, -72, 30], [22, -76, 30], [0, -98, 34]].forEach(([dx, dy, r]) => { circle(ctx, dx + sw, dy, r); fillStroke(ctx, '#6fbf5a', 3); });
    }
    ctx.restore();
  }

  function drawHome(ctx, p, kind, owner, color, t, night) {
    const x = p.x + p.w / 2, y = p.y + p.h - 18, w = 150;
    ctx.fillStyle = 'rgba(52,35,63,0.2)'; rr(ctx, x - w / 2 + 8, y - 10, w, 22, 10); ctx.fill();
    if (kind === 'house') {
      rr(ctx, x - w / 2, y - 90, w, 90, 8); fillStroke(ctx, '#fff3d6', 3);
      roof(ctx, x - w / 2, y - 140, w, 56, color || '#e4572e');
      windows(ctx, x - 58, y - 72, 1, 1, 0, 0, night); windows(ctx, x + 32, y - 72, 1, 1, 0, 0, night);
      door(ctx, x, y, '#8a5a34');
    } else {
      rr(ctx, x - w / 2, y - 100, w, 100, 8); fillStroke(ctx, '#fff3d6', 3);
      for (let i = 0; i < 5; i++) { const sx = x - w / 2 - 8 + i * ((w + 16) / 5); ctx.beginPath(); ctx.moveTo(sx, y - 108); ctx.lineTo(sx + (w + 16) / 5, y - 108); ctx.lineTo(sx + (w + 16) / 5, y - 78); ctx.quadraticCurveTo(sx + (w + 16) / 10, y - 66, sx, y - 78); ctx.closePath(); fillStroke(ctx, i % 2 ? '#fff8e8' : (color || '#5b7cfa'), 2.5); }
      rr(ctx, x - 60, y - 58, 50, 34, 5); fillStroke(ctx, night ? '#ffe9a3' : '#9ff3ff', 2.5);
      door(ctx, x + 30, y, '#34233f');
    }
  }

  // Public projects, drawn once the town has built them
  function drawProject(ctx, id, t, night) {
    const S = Town.PROJECT_SPOTS;
    if (id === 'fountain') {
      const { x, y } = S.fountain;
      ctx.beginPath(); ctx.ellipse(x, y, 90, 36, 0, 0, TAU); fillStroke(ctx, '#d9cfb8', 4);
      ctx.beginPath(); ctx.ellipse(x, y - 4, 74, 26, 0, 0, TAU); ctx.fillStyle = '#8fd3ef'; ctx.fill();
      rr(ctx, x - 10, y - 60, 20, 58, 6); fillStroke(ctx, '#d9cfb8', 3);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t; ctx.strokeStyle = 'rgba(143,211,239,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 60); ctx.quadraticCurveTo(x + Math.cos(a) * 30, y - 90, x + Math.cos(a) * 50, y - 8 + Math.sin(a) * 12); ctx.stroke(); }
    }
    if (id === 'park') {
      const { x, y } = S.park;
      ctx.fillStyle = '#9ccb6b'; rr(ctx, x - 200, y - 110, 400, 220, 40); ctx.fill(); ctx.strokeStyle = '#6fa54a'; ctx.lineWidth = 3; ctx.stroke();
      [[-140, -30], [130, -50], [150, 60]].forEach(([dx, dy]) => drawTownTree(ctx, x + dx, y + dy, t, 'oak', 'tree', 1, 0.8));
      rr(ctx, x - 40, y + 20, 80, 14, 5); fillStroke(ctx, '#a0673b', 3);            // bench
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 20, y - 60); ctx.lineTo(x - 20, y - 10); ctx.moveTo(x + 40, y - 60); ctx.lineTo(x + 40, y - 10); ctx.moveTo(x - 30, y - 60); ctx.lineTo(x + 50, y - 60); ctx.stroke();   // swing frame
      const sw = Math.sin(t * 2) * 10; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y - 60); ctx.lineTo(x + 10 + sw, y - 24); ctx.stroke(); rr(ctx, x + sw - 2, y - 26, 24, 6, 3); fillStroke(ctx, '#e4572e', 2);
    }
    if (id === 'library' || id === 'clinic') {
      const { x, y } = S[id], w = 190, h = 150;
      ctx.fillStyle = 'rgba(52,35,63,0.2)'; rr(ctx, x - w / 2 + 8, y - 12, w, 24, 10); ctx.fill();
      rr(ctx, x - w / 2, y - h + 30, w, h - 30, 8); fillStroke(ctx, id === 'library' ? '#f7dc7a' : '#fff', 3.5);
      roof(ctx, x - w / 2, y - h - 14, w, 50, id === 'library' ? '#8a5a34' : '#e4572e');
      if (id === 'clinic') { ctx.fillStyle = '#e4572e'; ctx.fillRect(x - 6, y - h + 46, 12, 34); ctx.fillRect(x - 17, y - h + 57, 34, 12); }
      else { [[-40, '#e4572e'], [-26, '#5b7cfa'], [-12, '#8cbf5a']].forEach(([dx, c]) => { rr(ctx, x + dx, y - h + 48, 12, 34, 2); fillStroke(ctx, c, 2); }); }
      door(ctx, x + 40, y, '#34233f');
      ctx.font = '800 15px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = INK;
      const label = id === 'library' ? '📚 Library' : '🏥 Clinic', lw = ctx.measureText(label).width + 20;
      rr(ctx, x - lw / 2, y - 92, lw, 24, 8); fillStroke(ctx, '#fff8e8', 2.5); ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y - 79);
    }
  }
  function drawBusStop(ctx, x, y, t, busHere) {
    ctx.fillStyle = '#8a5a34'; ctx.fillRect(x - 3, y - 70, 6, 70);
    circle(ctx, x, y - 76, 16); fillStroke(ctx, '#5b7cfa', 3); ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🚌', x, y - 75);
    rr(ctx, x + 14, y - 44, 70, 10, 4); fillStroke(ctx, '#a0673b', 2.5);
  }
  function drawLamp(ctx, x, y, night) {
    ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 80, 6, 80);
    rr(ctx, x - 12, y - 96, 24, 20, 6); fillStroke(ctx, night ? '#ffe9a3' : '#fff8e8', 3);
    if (night) { ctx.fillStyle = 'rgba(255,233,163,0.25)'; circle(ctx, x, y - 86, 60); ctx.fill(); }
  }

  return { drawGround, drawBuilding, drawPlot, plotSign, drawCrop, drawTownTree, drawHome, drawProject, drawBusStop, drawLamp, sign };
})();
