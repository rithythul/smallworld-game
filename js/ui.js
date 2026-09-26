// DOM user interface: HUD, toasts, dialogue, Noodle-dex and clue journal.
const $ = (id) => document.getElementById(id);

const UI = (() => {
  const portraitCtx = $('portrait').getContext('2d');
  let dlg = null; // { lines, i, typing, shown, choices, onDone, timer }

  function fmtTime(mins) {
    const h24 = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
    const h = h24 % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  }

  function hud(G) {
    $('clockText').textContent = `Day ${G.day} · ${fmtTime(G.time)}`;
    const hr = G.time / 60;
    $('clockIcon').classList.toggle('moon', hr >= 19 || hr < 5.5);
    const w = Math.max(0, Math.min(100, G.water));
    $('waterBar').style.width = w + '%';
    $('waterBar').classList.toggle('low', w < 25);
    $('coinText').textContent = G.coins;
    $('dexCount').textContent = `${G.found.length}/${NOODLES.length}`;
    const fresh = G.buffUntil > G.time && G.buffDay === G.day, mint = G.mintUntil > G.time && G.mintDay === G.day;
    $('buff').hidden = !(fresh || mint);
    $('buff').textContent = [fresh && '😎 Fresh Start', mint && '🌿 Minty'].filter(Boolean).join('  ·  ');
    $('journalDot').hidden = !G.journalNew;
  }

  let lastGoal = '';
  function goal(text) {
    if (text === lastGoal) return;
    lastGoal = text;
    $('goalText').textContent = text;
    const el = $('goal'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function toast(html, { noodle = null, big = false, life = 2.6 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (big ? ' big' : '');
    el.style.setProperty('--life', life + 's');
    if (noodle) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      drawNoodleIcon(c.getContext('2d'), noodle, 128);
      el.appendChild(c);
    }
    const span = document.createElement('div'); span.innerHTML = html; el.appendChild(span);
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
    setTimeout(() => el.remove(), (life + 0.5) * 1000);
  }

  function combo(n) {
    const el = $('combo');
    if (n < 2) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = n >= 5 ? `MEGA CRUNCH x${n}!` : `CRUNCH x${n}`;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(combo.t); combo.t = setTimeout(() => (el.hidden = true), 900);
  }

  /* ---------- dialogue ---------- */
  function drawPortrait(kind, t = 0) {
    const c = portraitCtx; c.clearRect(0, 0, 120, 120);
    c.save();
    if (kind === 'grandma') drawGrandma(c, 60, 150, t, 1.15);
    else if (kind === 'oracle') drawOracle(c, 60, 92, t, 1.25, true);
    else if (kind === 'note') {
      c.translate(60, 60); c.rotate(-0.12);
      rr(c, -34, -40, 68, 80, 6); fillStroke(c, '#fff8e8', 3);
      c.strokeStyle = '#c7b48a'; c.lineWidth = 3;
      for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-24, -24 + i * 12); c.lineTo(24 - (i === 4 ? 20 : 0), -24 + i * 12); c.stroke(); }
    } else if (kind === 'snail') drawSnail(c, 52, 96, t, 1, 1.05);
    else if (kind === 'bird') drawSobaBird(c, 56, 66, t, 2.4, false);
    else drawHead(c, 60, 70, kind === 'me-wow' ? 'wow' : 'happy', t, {});
    c.restore();
  }

  const names = { bird: 'Soba Bird', snail: 'The Udon Snail', grandma: 'Grandma Ramen', oracle: 'The Noodle Oracle', note: 'A note', me: 'Squareface Guy', 'me-wow': 'Squareface Guy' };

  function say(who, lines, { choices = null, onDone = null } = {}) {
    dlg = { who, lines: Array.isArray(lines) ? lines : [lines], i: 0, choices, onDone };
    $('dialog').hidden = false;
    $('dialogName').textContent = names[who] || who;
    drawPortrait(who, performance.now() / 1000);
    showLine();
  }
  function showLine() {
    const text = dlg.lines[dlg.i];
    const el = $('dialogText');
    el.innerHTML = '';
    $('dialogChoices').innerHTML = '';
    $('dialogNext').hidden = true;
    dlg.typing = true;
    let k = 0;
    clearInterval(dlg.timer);
    // strip tags for typing, render full html at the end
    const plain = text.replace(/<[^>]+>/g, '');
    dlg.timer = setInterval(() => {
      k += 2;
      el.textContent = plain.slice(0, k);
      if (k % 6 === 0 && dlg.who !== 'note') Sound.talk();
      if (k >= plain.length) finishLine();
    }, 22);
  }
  function finishLine() {
    clearInterval(dlg.timer);
    dlg.typing = false;
    $('dialogText').innerHTML = dlg.lines[dlg.i];
    const last = dlg.i === dlg.lines.length - 1;
    if (last && dlg.choices) {
      const box = $('dialogChoices');
      dlg.choices.forEach(ch => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice' + (ch.alt ? ' alt' : ''); b.textContent = ch.label;
        b.addEventListener('click', (e) => { e.stopPropagation(); close(); ch.fn && ch.fn(); });
        box.appendChild(b);
      });
    } else $('dialogNext').hidden = false;
  }
  function advance() {
    if (!dlg) return;
    if (dlg.typing) { finishLine(); return; }
    if (dlg.i === dlg.lines.length - 1) {
      if (dlg.choices) return;
      const done = dlg.onDone; close(); done && done(); return;
    }
    dlg.i++; showLine();
  }
  function close() { if (dlg) clearInterval(dlg.timer); dlg = null; $('dialog').hidden = true; }
  $('dialog').addEventListener('click', advance);

  /* ---------- sheets ---------- */
  function openSheet(title, render) {
    $('sheetTitle').textContent = title;
    const body = $('sheetBody'); body.innerHTML = ''; body.scrollTop = 0;
    render(body);
    $('sheet').hidden = false;
  }
  function closeSheet() { $('sheet').hidden = true; }
  $('sheetClose').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  function dex(G) {
    openSheet('Noodle-dex', (body) => {
      const n = G.found.length;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${n} of ${NOODLES.length} noodles found in this part of the universe · ${TOTAL_IN_UNIVERSE} in total, more regions coming</p><div class="progress"><div style="width:${(n / NOODLES.length) * 100}%"></div></div>`);
      const grid = document.createElement('div'); grid.className = 'dex-grid';
      NOODLES.forEach((nd, i) => {
        const got = G.found.includes(nd.id);
        const card = document.createElement('div');
        card.className = 'dex-card' + (got ? '' : ' locked');
        const c = document.createElement('canvas'); c.width = 144; c.height = 144;
        drawNoodleIcon(c.getContext('2d'), nd, 144, !got);
        card.appendChild(c);
        card.insertAdjacentHTML('beforeend', `
          <span class="num">No. ${String(i + 1).padStart(2, '0')}</span>
          <h3>${got ? nd.name : '???'}</h3>
          <span class="rarity r-${nd.rarity}">${nd.rarity}</span>
          <p>${got ? nd.desc : 'Hint: ' + nd.hint}</p>`);
        grid.appendChild(card);
      });
      body.appendChild(grid);
    });
  }

  function glyphRow(text) {
    const row = document.createElement('div'); row.className = 'cipher'; row.setAttribute('aria-label', 'Message written in noodle letters');
    [...text].forEach(ch => {
      if (ch === ' ') { const s = document.createElement('span'); s.className = 'gap'; row.appendChild(s); return; }
      const c = document.createElement('canvas'); c.width = 60; c.height = 72;
      const x = c.getContext('2d'); x.scale(2, 2); drawGlyph(x, ch);
      row.appendChild(c);
    });
    return row;
  }

  function journal(G, tab = 'clues') {
    G.journalNew = false;
    openSheet('Clue Journal', (body) => {
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      const list = [['clues', 'Clues'], ['map', 'Map pieces']];
      if (G.flags.decoder) list.push(['alpha', 'Noodle alphabet']);
      list.forEach(([id, label]) => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'tab' + (tab === id ? ' on' : ''); b.textContent = label;
        b.addEventListener('click', () => journal(G, id));
        tabs.appendChild(b);
      });
      body.appendChild(tabs);

      if (tab === 'clues') {
        const has = G.clues;
        if (!has.length && !G.fortune) body.insertAdjacentHTML('beforeend', '<p class="empty">No clues yet. Collect a few noodles and see what turns up.</p>');
        if (G.fortune && !G.fortune.done) {
          body.insertAdjacentHTML('beforeend', `<div class="clue"><span class="where">Today's Fortune Cracker</span><h3>A little riddle</h3><blockquote>${FORTUNES[G.fortune.idx].text}</blockquote></div>`);
        }
        has.slice().reverse().forEach(id => {
          const c = CLUES[id];
          const solved = G.solved.includes(id);
          const el = document.createElement('div'); el.className = 'clue' + (solved ? ' solved' : '');
          el.innerHTML = `<span class="where">${c.where}</span><h3>${c.title}</h3>`;
          if (id === 'cipher') {
            el.appendChild(glyphRow(c.answer));
            if (solved) el.insertAdjacentHTML('beforeend', `<blockquote>"${c.answer}"</blockquote><span class="solved-tag">✓ Decoded. Crunch Canyon is next…</span>`);
            else {
              el.insertAdjacentHTML('beforeend', `<p class="empty">${G.flags.decoder ? 'Use the Noodle alphabet tab to decode it, then type your answer.' : 'You can\'t read noodle letters yet. Maybe someone in the village can.'}</p>
                <form class="answer-row" id="cipherForm"><input id="cipherInput" autocomplete="off" placeholder="Type the message" aria-label="Your decoded message"><button class="choice" type="submit">Check</button></form>
                <div class="answer-msg" id="cipherMsg"></div>`);
              setTimeout(() => {
                const f = $('cipherForm');
                f && f.addEventListener('submit', (e) => {
                  e.preventDefault();
                  const ok = Game.tryCipher($('cipherInput').value);
                  $('cipherMsg').textContent = ok ? 'Yes! The letters glow.' : 'Not quite. Check each shape: count the dots and look for a bar.';
                  $('cipherMsg').style.color = ok ? '#3e7d22' : '#e4572e';
                  if (ok) setTimeout(() => journal(G, 'clues'), 900);
                });
              });
            }
          } else if (id === 'statue') {
            const row = document.createElement('div'); row.className = 'faces';
            STATUE_FACES.forEach((mood, i) => {
              const cv = document.createElement('canvas'); cv.width = 112; cv.height = 96;
              const x = cv.getContext('2d'); x.scale(2, 2);
              rr(x, 3, 3, 50, 42, 8); fillStroke(x, '#1f1a2e', 3);
              x.globalAlpha = solved || i < G.statueStep ? 1 : 0.35;
              drawFace(x, mood, 0, 28, 24, 0.9);
              row.appendChild(cv);
            });
            el.insertAdjacentHTML('beforeend', `<blockquote>"${c.text}"</blockquote>`);
            el.appendChild(row);
            el.insertAdjacentHTML('beforeend', solved ? '<span class="solved-tag">✓ Solved</span>' : `<p class="empty">Faces shown so far: ${G.statueStep} of 4. They have to happen in order.</p>`);
          } else if (id === 'mirror') {
            const cv = document.createElement('canvas'); cv.width = 560; cv.height = 150; cv.className = 'reflection';
            const x = cv.getContext('2d');
            const g = x.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, '#e2dbff'); g.addColorStop(1, '#b7a6ff');
            x.fillStyle = g; x.fillRect(0, 0, 560, 150);
            x.translate(280, 0); x.scale(-1, 1);
            x.fillStyle = '#34233f'; x.font = '44px "Bagel Fat One", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillText('UNDER THE', 0, 50); x.fillText("SNAIL'S HOUSE", 0, 102);
            el.appendChild(cv);
            el.insertAdjacentHTML('beforeend', `<p class="empty">You sketched what the water showed you.</p>${solved ? '<span class="solved-tag">✓ Solved</span>' : ''}`);
          } else {
            el.insertAdjacentHTML('beforeend', `<blockquote>${c.text.replace(/\n/g, '<br>')}</blockquote>${solved ? '<span class="solved-tag">✓ Solved</span>' : ''}`);
          }
          body.appendChild(el);
        });
        if (has.some(id => !G.solved.includes(id))) body.insertAdjacentHTML('beforeend', '<p class="empty">Stuck? The Noodle Oracle south of Grandma\'s stand sells hints for Crunch Coins.</p>');
      }

      if (tab === 'map') {
        body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Grandma tore the map to the Golden Noodle into 7 pieces.</p>');
        const grid = document.createElement('div'); grid.className = 'pieces';
        for (let i = 1; i <= 7; i++) {
          const got = G.pieces.includes(i);
          const d = document.createElement('div'); d.className = 'piece' + (got ? '' : ' locked');
          if (got) { const c = document.createElement('canvas'); c.width = 320; c.height = 320; drawMapPiece(c.getContext('2d'), i, 320); d.appendChild(c); }
          d.insertAdjacentHTML('beforeend', `<div>${got ? 'Piece ' + i : 'Piece ' + i + ' · missing'}</div>`);
          grid.appendChild(d);
        }
        body.appendChild(grid);
      }

      if (tab === 'alpha') {
        body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Copied from the poster on Grandma\'s stand. The shape, the dots on top and the bar all matter.</p>');
        const grid = document.createElement('div'); grid.className = 'alpha';
        for (let i = 0; i < 26; i++) {
          const L = String.fromCharCode(65 + i);
          const d = document.createElement('div');
          const c = document.createElement('canvas'); c.width = 60; c.height = 72;
          const x = c.getContext('2d'); x.scale(2, 2); drawGlyph(x, L);
          d.appendChild(c); d.insertAdjacentHTML('beforeend', L);
          grid.appendChild(d);
        }
        body.appendChild(grid);
      }
    });
  }

  return {
    hud, goal, toast, combo, say, advance, close, dex, journal, closeSheet, drawPortrait,
    get busy() { return !!dlg || !$('sheet').hidden; },
    get talking() { return !!dlg; },
    fmtTime,
  };
})();
