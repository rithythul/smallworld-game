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
    const ct = `<span class="clock-day">Day ${G.day} · </span>${fmtTime(G.time)}`;
    if ($('clockText').innerHTML !== ct) $('clockText').innerHTML = ct;
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

  function goalHint(text) {
    let el = $('goalHintText');
    if (!el) { el = document.createElement('small'); el.id = 'goalHintText'; el.className = 'goal-hint'; $('goalText').after(el); }
    el.textContent = text ? '💡 ' + text : '';
    el.hidden = !text;
  }
  let lastGoal = '';
  function goal(text) {
    if (text === lastGoal) return;
    lastGoal = text;
    $('goalText').textContent = text;
    const el = $('goal'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  function toast(html, { noodle = null, food = null, shiny = false, big = false, life = 2.6 } = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (big ? ' big' : '');
    el.style.setProperty('--life', life + 's');
    if (noodle) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      drawNoodleIcon(c.getContext('2d'), noodle, 128, false, shiny);
      el.appendChild(c);
    }
    if (food) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 128;
      drawFoodIcon(c.getContext('2d'), food, 128);
      el.appendChild(c);
    }
    const span = document.createElement('div'); span.innerHTML = html; el.appendChild(span);
    $('toasts').appendChild(el);
    while ($('toasts').children.length > (document.body.classList.contains('touch') ? 2 : 3)) $('toasts').firstChild.remove();
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
    else if (kind === 'kombu') drawKombu(c, 60, 150, t, 1.7);
    else if (kind === 'penne') drawPenne(c, 50, 150, t, 1.6);
    else drawHead(c, 60, 70, kind === 'me-wow' ? 'wow' : 'happy', t, {});
    c.restore();
  }

  const names = { kombu: 'Coach Kombu', penne: 'Captain Penne', bird: 'Soba Bird', snail: 'The Udon Snail', grandma: 'Grandma Ramen', oracle: 'The Noodle Oracle', note: 'A note', me: 'Squareface Guy', 'me-wow': 'Squareface Guy' };

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
    body.scrollTop = 0;
  }
  function closeSheet() { $('sheet').hidden = true; }
  $('sheetClose').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  function dexTabs(body, G, tab) {
    const tabs = document.createElement('div'); tabs.className = 'tabs';
    [['noodles', '🍜 Noodles'], ['pantry', '🧺 Pantry'], ['recipes', '📖 Recipes']].forEach(([id, label]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tab' + (tab === id ? ' on' : ''); b.textContent = label;
      b.addEventListener('click', () => dex(G, id));
      tabs.appendChild(b);
    });
    body.appendChild(tabs);
  }
  function foodCard(G, id, extra = '') {
    const n = G.pantry[id] || 0, seen = n > 0 || (G.foodSeen || {})[id];
    const card = document.createElement('div'); card.className = 'dex-card' + (seen ? '' : ' locked');
    const c = document.createElement('canvas'); c.width = 144; c.height = 144;
    if (seen) drawFoodIcon(c.getContext('2d'), id, 144); else drawNoodleIcon(c.getContext('2d'), NOODLES[0], 144, true);
    card.appendChild(c);
    const tree = Object.keys(TREE_FOOD).find(k => TREE_FOOD[k] === id);
    card.insertAdjacentHTML('beforeend', `<h3>${seen ? FOODS[id].name : '???'}</h3><span class="rarity r-common">× ${n}</span><p>${seen ? FOODS[id].desc : 'Shake a ' + TREE_NAMES[tree] + '.'}</p>${extra}`);
    return card;
  }
  function recipeList(G, body, api) {
    RECIPES.forEach(r => {
      const el = document.createElement('div'); el.className = 'clue recipe';
      const ok = Object.entries(r.needs).every(([f, n]) => (G.pantry[f] || 0) >= n);
      el.innerHTML = `<h3>${r.name}${G.cooked[r.id] ? ` <small>· cooked ${G.cooked[r.id]}×</small>` : ' <small>· ⭐ +2 the first time</small>'}</h3><p class="sheet-sub" style="margin:2px 0 8px">${r.effect}</p>`;
      const needs = document.createElement('div'); needs.className = 'needs';
      Object.entries(r.needs).forEach(([f, n]) => {
        const have = G.pantry[f] || 0;
        const chip = document.createElement('span'); chip.className = 'need' + (have >= n ? ' ok' : '');
        const c = document.createElement('canvas'); c.width = 56; c.height = 56; drawFoodIcon(c.getContext('2d'), f, 56);
        chip.appendChild(c); chip.insertAdjacentHTML('beforeend', `${FOODS[f].name} ${Math.min(have, n)}/${n}`);
        needs.appendChild(chip);
      });
      el.appendChild(needs);
      if (api) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = ok ? 'Cook it!' : 'Need more food';
        b.disabled = !ok; b.style.marginTop = '10px';
        b.addEventListener('click', () => { if (api.cook(r.id)) closeSheet(); });
        el.appendChild(b);
      }
      body.appendChild(el);
    });
  }
  function cook(G, api) {
    openSheet("Grandma's Kitchen", (body) => {
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Pick a recipe. Food comes from shaking trees, and they grow back every morning.</p>');
      recipeList(G, body, api);
    });
  }

  function dex(G, tab = 'noodles') {
    if (tab === 'pantry') return openSheet('Pantry', (body) => {
      dexTabs(body, G, tab);
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Shake trees to collect food. Eat it to refill water (+20), or ask Grandma to cook it.</p>');
      const grid = document.createElement('div'); grid.className = 'dex-grid';
      Object.keys(FOODS).forEach(id => {
        const card = foodCard(G, id);
        if ((G.pantry[id] || 0) > 0) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = 'Eat';
          b.addEventListener('click', () => { if (Game.eat(id)) dex(G, 'pantry'); });
          card.appendChild(b);
        }
        grid.appendChild(card);
      });
      body.appendChild(grid);
    });
    if (tab === 'recipes') return openSheet('Recipes', (body) => {
      dexTabs(body, G, tab);
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Talk to Grandma Ramen at her stand and pick <b>Cook something</b>.</p>');
      recipeList(G, body, null);
    });
    openSheet('Noodle-dex', (body) => {
      dexTabs(body, G, tab);
      const n = G.found.length;
      const shinyN = Object.keys(G.shiny || {}).length;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">${n} of ${NOODLES.length} noodles found · ✨ ${shinyN} shiny (1 in 40 finds turns golden) · ${TOTAL_IN_UNIVERSE} in the whole universe, more regions coming</p><div class="progress"><div style="width:${(n / NOODLES.length) * 100}%"></div></div>`);
      const grid = document.createElement('div'); grid.className = 'dex-grid';
      NOODLES.forEach((nd, i) => {
        const got = G.found.includes(nd.id);
        const card = document.createElement('div');
        card.className = 'dex-card' + (got ? '' : ' locked');
        const c = document.createElement('canvas'); c.width = 144; c.height = 144;
        const shiny = got && (G.shiny || {})[nd.id];
        if (shiny) card.classList.add('shiny');
        drawNoodleIcon(c.getContext('2d'), nd, 144, !got, shiny);
        card.appendChild(c);
        card.insertAdjacentHTML('beforeend', `
          <span class="num">No. ${String(i + 1).padStart(2, '0')}</span>
          <h3>${got ? nd.name : '???'}</h3>
          <span class="rarity r-${nd.rarity}">${nd.rarity}</span>${shiny ? '<span class="rarity r-secret">✨ shiny</span>' : ''}
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

  function journal(G, tab = 'story') {
    G.journalNew = false;
    openSheet('Clue Journal', (body) => {
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      const list = [['story', 'Story'], ['clues', 'Clues'], ['map', 'Map pieces']];
      if (G.flags.decoder) list.push(['alpha', 'Noodle alphabet']);
      list.forEach(([id, label]) => {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'tab' + (tab === id ? ' on' : ''); b.textContent = label;
        b.addEventListener('click', () => journal(G, id));
        tabs.appendChild(b);
      });
      body.appendChild(tabs);

      if (tab === 'story') {
        body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">Your adventure so far, and what to do next. Stuck? Tap the goal at the top to get a yellow arrow, or ask the Noodle Oracle for a hint.</p>');
        let open = true;
        Game.story().forEach(chap => {
          const el = document.createElement('div'); el.className = 'clue';
          const done = chap.steps.every(st => st.done);
          el.innerHTML = `<span class="where">${done ? 'Complete' : open ? 'In progress' : 'Locked'}</span><h3>${chap.title}</h3>`;
          if (!open) {
            el.classList.add('locked-chapter');
            el.insertAdjacentHTML('beforeend', '<p class="empty">🔒 Finish the chapter before this one to unlock it.</p>');
          } else {
            let shownNext = false;
            chap.steps.forEach(st => {
              if (st.done) el.insertAdjacentHTML('beforeend', `<div class="lesson done"><span class="mark">✓</span><span><b>${st.text}</b></span></div>`);
              else if (!shownNext) { shownNext = true; el.insertAdjacentHTML('beforeend', `<div class="lesson next"><span class="mark">•</span><span><b>${st.text}</b><br><small>${st.where}</small></span></div>`); }
              else el.insertAdjacentHTML('beforeend', '<div class="lesson locked"><span class="mark">?</span><span><b>???</b><br><small>Keep going to find out.</small></span></div>');
            });
          }
          if (done) el.classList.add('solved');
          body.appendChild(el);
          if (!done) open = false;
        });
        body.insertAdjacentHTML('beforeend', '<p class="sheet-sub">The story keeps growing, and the world never ends: daily challenges, races and cooking are always waiting.</p>');
      }

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
            if (solved) {
              el.appendChild(glyphRow(c.answer));
              el.insertAdjacentHTML('beforeend', `<blockquote>"${c.answer}"</blockquote><span class="solved-tag">✓ Decoded. Crunch Canyon is next…</span>`);
            } else {
              // Decode by picking a letter under each noodle shape. The same shape is always the same letter.
              const G2 = G, answer = c.answer, hintLvl = (G2.hints || {}).cipher || 0;
              G2.cipherGuess = G2.cipherGuess || {};
              if (hintLvl >= 2) 'ECHO'.split('').forEach(L => { G2.cipherGuess[L] = L; });
              if (hintLvl >= 3) answer.replace(/ /g, '').split('').forEach(L => { G2.cipherGuess[L] = L; });
              el.insertAdjacentHTML('beforeend', `<p class="empty">${G.flags.decoder ? 'Pick a letter under each shape. Check the Noodle alphabet tab: the shape, the dots on top and the bar all matter. Right letters turn green.' : 'You can\'t read noodle letters yet. Maybe someone in the village has an alphabet… (you can still guess!)'}</p>`);
              const grid = document.createElement('div'); grid.className = 'decoder';
              const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
              const words = answer.split(' ');
              words.forEach(word => {
                const w = document.createElement('div'); w.className = 'dword';
                word.split('').forEach(L => {
                  const cell = document.createElement('label'); cell.className = 'dcell';
                  const cv = document.createElement('canvas'); cv.width = 60; cv.height = 72;
                  const x = cv.getContext('2d'); x.scale(2, 2); drawGlyph(x, L);
                  const sel = document.createElement('select'); sel.dataset.g = L; sel.setAttribute('aria-label', 'Letter for this noodle shape');
                  sel.innerHTML = '<option value="">?</option>' + letters.map(l => `<option>${l}</option>`).join('');
                  sel.value = G2.cipherGuess[L] || '';
                  cell.appendChild(cv); cell.appendChild(sel); w.appendChild(cell);
                });
                grid.appendChild(w);
              });
              el.appendChild(grid);
              el.insertAdjacentHTML('beforeend', '<div class="answer-msg" id="cipherMsg"></div>');
              const paint = () => {
                grid.querySelectorAll('select').forEach(sl => {
                  sl.classList.toggle('ok', sl.value === sl.dataset.g);
                  sl.classList.toggle('bad', !!sl.value && sl.value !== sl.dataset.g);
                });
                const guess = words.map(wd => wd.split('').map(L => G2.cipherGuess[L] || '?').join('')).join(' ');
                if (!guess.includes('?')) {
                  const ok = Game.tryCipher(guess);
                  $('cipherMsg').textContent = ok ? 'Yes! The letters glow: "' + answer + '"' : 'Every shape has a letter now, but some are wrong (red).';
                  $('cipherMsg').style.color = ok ? '#3e7d22' : '#e4572e';
                  if (ok) setTimeout(() => journal(G2, 'clues'), 1400);
                }
              };
              grid.addEventListener('change', (e) => {
                const sl = e.target; if (sl.tagName !== 'SELECT') return;
                G2.cipherGuess[sl.dataset.g] = sl.value;
                grid.querySelectorAll(`select[data-g="${sl.dataset.g}"]`).forEach(o => { o.value = sl.value; });
                paint();
              });
              setTimeout(paint);
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

  function players(Net, onLeave, extra = {}) {
    openSheet('Friends', (body) => {
      const team = Net.mode === 'team';
      const link = location.origin + location.pathname + '?room=' + Net.code;
      body.insertAdjacentHTML('beforeend', `
        <div class="code-box"><div><span class="mp-label">Room name</span><span class="code">${Net.code}</span></div>
          <button class="big-btn small" type="button" id="shareRoom">Share invite 📨</button></div>
        <p class="sheet-sub">Friends can tap your invite link, or open the game, tap <b>Play with friends</b> and type <b>${Net.code}</b>.</p>
        <p class="sheet-sub link-line" id="linkLine">${link}</p>
        <p class="sheet-sub">${team ? '🤝 <b>Team up</b>: every noodle anyone finds goes into everyone\'s Noodle-dex. Bricks are shared too.' : '🏁 <b>Race</b>: everyone collects on their own. Bricks are shared, so grab them first! Most noodles wins, then coins.'}</p>`);
      $('shareRoom').addEventListener('click', () => {
        const text = `Come play Noodle Universe with me! Room: ${Net.code}`;
        const copied = () => { $('shareRoom').textContent = 'Link copied! ✓'; };
        const copy = () => { try { navigator.clipboard.writeText(text + ' ' + link).then(copied, () => selectText($('linkLine'))); } catch (e) { selectText($('linkLine')); } };
        if (navigator.share) navigator.share({ title: 'Noodle Universe', text, url: link }).catch(err => { if (err && err.name !== 'AbortError') copy(); });
        else copy();
      });
      const list = document.createElement('div'); list.className = 'players';
      const rows = Net.scores.length ? Net.scores : [];
      rows.forEach((p, i) => {
        const me = p.id === Net.me;
        list.insertAdjacentHTML('beforeend', `<div class="player-row"><span class="rank">${team ? '' : i + 1}</span><span class="dot" style="background:${p.color}"></span>
          <span class="who">${p.name}${me ? ' (you)' : ''}</span><span class="stats">${p.trophies ? `<span class="stat">🏆 ${p.trophies}</span>` : ''}${p.round ? `<span class="stat">🧱 ${p.round}</span>` : ''}<span class="stat">🍜 ${p.found}</span><span class="stat">⭐ ${p.stars || 0}</span><span class="stat">🪙 ${p.coins}</span></span></div>`);
      });
      body.appendChild(list);
      if (team && extra.pot) {
        const p = extra.pot;
        body.insertAdjacentHTML('beforeend', `<div class="clue" style="margin-top:14px"><span class="where">Work together</span><h3>🍲 Team Pot · level ${p.level}</h3>
          <p class="sheet-sub" style="margin:4px 0 8px">Every brick anyone crunches goes in the pot. Fill it and everyone gets ⭐ +2 and 10 coins. Then a bigger pot starts. It never ends.</p>
          <div class="progress"><div style="width:${p.fill / p.need * 100}%"></div></div><b>${p.fill} / ${p.need} bricks</b></div>`);
      }
      if (!team) {
        const live = extra.roundLeft > 0;
        body.insertAdjacentHTML('beforeend', `<div class="clue" style="margin-top:14px"><span class="where">Compete</span><h3>🏁 Crunch Race</h3>
          <p class="sheet-sub" style="margin:4px 0 8px">2 minutes. All bricks grow back at the start. Whoever crunches the most wins a 🏆 trophy, ⭐ +3 and 20 coins. Play as many rounds as you like.</p>
          ${live ? `<b>Round running: ${Math.floor(extra.roundLeft / 60)}:${String(extra.roundLeft % 60).padStart(2, '0')} left</b>` : '<button class="choice" type="button" id="startRound">Start a Crunch Race</button>'}</div>`);
        const b = $('startRound'); if (b) b.addEventListener('click', () => { extra.startRound(); closeSheet(); });
      }
      const taken = new Set(rows.filter(p => p.id !== Net.me).map(p => p.color));
      const mine = (rows.find(p => p.id === Net.me) || {}).color;
      const sw = document.createElement('div'); sw.className = 'swatches'; sw.style.marginTop = '14px';
      ['#2fa4b5', '#e4572e', '#8cbf5a', '#b98cff', '#f4b942', '#ff8fb1', '#5b7cfa', '#9a7b5b'].forEach(c => {
        const b = document.createElement('button'); b.type = 'button'; b.style.background = c;
        b.setAttribute('aria-label', taken.has(c) ? 'Color taken' : 'Pick color');
        if (c === mine) b.classList.add('on');
        if (taken.has(c)) { b.disabled = true; b.style.opacity = '.25'; }
        b.addEventListener('click', () => Net.color(c));
        sw.appendChild(b);
      });
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub" style="margin:14px 0 0">Your hoodie color (faded colors are taken):</p>');
      body.appendChild(sw);
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub" style="margin-top:14px">Tap 😊 to send an emote. Everyone sees it over your head.</p><button class="choice alt" type="button" id="leaveRoom">Leave room</button>');
      $('leaveRoom').addEventListener('click', onLeave);
    });
  }
  function leaderboard(opts) {
    openSheet('Leaderboard', (body) => {
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      [['coins', '🪙 Coins'], ['found', '🍜 Noodles'], ['stars', '⭐ Stars'], ['trophies', '🏆 Trophies']].forEach(([id, label]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tab' + (opts.by === id ? ' on' : ''); b.textContent = label;
        b.addEventListener('click', () => leaderboard({ ...opts, by: id }));
        tabs.appendChild(b);
      });
      body.appendChild(tabs);
      body.insertAdjacentHTML('beforeend', `<form class="answer-row" id="nameForm" style="margin:0 0 12px"><input id="boardName" maxlength="14" placeholder="Your name on the board" value="${(opts.name || '').replace(/"/g, '')}" aria-label="Your name"><button class="choice" type="submit">Save name</button></form>`);
      $('nameForm').addEventListener('submit', (e) => { e.preventDefault(); opts.rename($('boardName').value.trim() || 'Squareface'); $('boardName').blur(); leaderboard({ ...opts, name: $('boardName').value.trim() }); });
      const list = document.createElement('div'); list.className = 'players'; list.innerHTML = '<p class="empty">Loading…</p>';
      body.appendChild(list);
      if (!opts.online) { list.innerHTML = '<p class="empty">The leaderboard lives on the online server. Play at your Render link (or run npm start) to join it.</p>'; return; }
      opts.load(opts.by).then(d => {
        if (!d.list.length) { list.innerHTML = '<p class="empty">Nobody on the board yet. Crunch some bricks and be first!</p>'; return; }
        list.innerHTML = '';
        const unit = { coins: '🪙', found: '🍜', stars: '⭐', trophies: '🏆' }[opts.by];
        d.list.forEach((e, i) => {
          const me = e.id === opts.uid;
          list.insertAdjacentHTML('beforeend', `<div class="player-row${me ? ' me' : ''}"><span class="rank">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="dot" style="background:${e.color}"></span>
            <span class="who">${e.name}${me ? ' (you)' : ''}</span><span class="stat">${unit} ${e[opts.by] || 0}</span></div>`);
        });
        body.insertAdjacentHTML('beforeend', `<p class="sheet-sub" style="margin-top:12px">${d.total} players on the board. It updates every 30 seconds while you play.</p>`);
      }).catch(() => { list.innerHTML = '<p class="empty">Could not load the leaderboard. Check your connection and try again.</p>'; });
    });
  }
  function account(opts) {
    openSheet('Save online', (body) => {
      if (opts.account) {
        body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">☁️ Your game saves online as <b>${opts.account.name}</b> every minute while you play. ${opts.last ? 'Last saved at ' + opts.last + '.' : ''}</p>
          <p class="sheet-sub">To play on another phone or computer: tap <b>Load my saved game</b> on the start screen and type your name and PIN.</p>
          <div class="answer-row"><button class="choice" type="button" id="saveNow">Save now</button><button class="choice alt" type="button" id="unlink">Stop saving on this device</button></div>
          <p class="answer-msg" id="accMsg"></p>`);
        $('saveNow').addEventListener('click', () => opts.saveNow().then(m => { $('accMsg').textContent = m; }));
        $('unlink').addEventListener('click', () => { opts.unlink(); closeSheet(); });
        return;
      }
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">Pick a name and a 4-number PIN. Then you can keep playing on any device.</p>
        <p class="sheet-sub"><b>Remember them!</b> There is no way to get them back. If you forget, you start a new game.</p>
        <form id="accForm" class="mp-panel" style="box-shadow:none">
          <div class="mp-row"><label for="accName">Name</label><input id="accName" maxlength="14" autocomplete="off" value="${(opts.name || '').replace(/"/g, '')}" placeholder="Your name"></div>
          <div class="mp-row"><label for="accPin">PIN</label><input id="accPin" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="4 numbers, like 2468"></div>
          <button class="big-btn small" type="submit">Save my game</button>
          <p class="mp-msg" id="accMsg"></p>
        </form>`);
      if (!opts.online) { $('accMsg').textContent = 'Online saving needs the game server. Play at your Render link to use it.'; $('accMsg').classList.add('err'); }
      $('accForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('accName').value.trim(), pin = $('accPin').value.trim();
        if (name.length < 2) { $('accMsg').textContent = 'Names need at least 2 letters.'; $('accMsg').classList.add('err'); return; }
        if (!/^\d{4}$/.test(pin)) { $('accMsg').textContent = 'The PIN is 4 numbers, like 2468.'; $('accMsg').classList.add('err'); return; }
        $('accMsg').classList.remove('err'); $('accMsg').textContent = 'Saving…';
        opts.link(name, pin).then(() => account({ ...opts, account: { name }, last: 'just now' }))
          .catch(err => { $('accMsg').textContent = err.message; $('accMsg').classList.add('err'); });
      });
    });
  }
  function hatPreview(id, size = 96) {
    const c = document.createElement('canvas'); c.width = size * 2; c.height = size * 2;
    const x = c.getContext('2d'); x.scale(2 * size / 96, 2 * size / 96);
    drawHead(x, 48, 60, 'happy', 0, {});
    if (id) drawHat(x, 48, 39, id, 0, false);
    return c;
  }
  function shop(G, api, tab = 'hats', msg = '') {
    openSheet("Grandma's Shop", (body) => {
      const tabs = document.createElement('div'); tabs.className = 'tabs';
      [['hats', '🎩 Hats'], ['goodies', '🎁 Goodies'], ['sell', '🪙 Sell food']].forEach(([id, label]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tab' + (tab === id ? ' on' : ''); b.textContent = label;
        b.addEventListener('click', () => shop(G, api, id));
        tabs.appendChild(b);
      });
      body.appendChild(tabs);
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub shop-coins">You have <b>🪙 ${G.coins} coins</b>. ${tab === 'sell' ? 'Grandma buys the food you pick from trees.' : 'Earn coins by crunching, cooking, selling food and daily challenges.'}</p>`);
      if (msg) body.insertAdjacentHTML('beforeend', `<p class="answer-msg" style="color:#e4572e">${msg}</p>`);
      const grid = document.createElement('div'); grid.className = 'dex-grid';
      const after = (m) => shop(G, api, tab, m);
      if (tab === 'hats') {
        Object.entries(HATS).forEach(([id, h]) => {
          const own = !!G.hats[id], wearing = G.hat === id;
          const card = document.createElement('div'); card.className = 'dex-card shop-card' + (own ? '' : ' locked');
          card.appendChild(hatPreview(id));
          card.insertAdjacentHTML('beforeend', `<h3>${h.name}</h3><p>${h.desc}</p>`);
          const b = document.createElement('button'); b.type = 'button'; b.className = 'choice';
          if (own) { b.textContent = wearing ? 'Take off' : 'Wear'; b.addEventListener('click', () => { api.wearHat(wearing ? null : id); after(''); }); }
          else if (h.price) { b.textContent = `Buy · 🪙 ${h.price}`; b.disabled = G.coins < h.price; b.addEventListener('click', () => after(api.buyHat(id))); }
          else { b.textContent = id === 'shell' ? 'Gift from the snail' : 'Level reward'; b.disabled = true; }
          if (wearing) card.insertAdjacentHTML('beforeend', '<span class="rarity r-rare">wearing</span>');
          card.appendChild(b); grid.appendChild(card);
        });
      }
      if (tab === 'goodies') {
        SHOP_GOODIES.forEach(g => {
          const card = document.createElement('div'); card.className = 'dex-card shop-card';
          card.insertAdjacentHTML('beforeend', `<div class="goodie-icon">${{ rocket: '🚀', fortune: '🥠', broth: '🍵' }[g.id]}</div><h3>${g.name}</h3><p>${g.desc}</p>`);
          const b = document.createElement('button'); b.type = 'button'; b.className = 'choice'; b.textContent = `Buy · 🪙 ${g.price}`;
          b.disabled = G.coins < g.price;
          b.addEventListener('click', () => after(api.buyGoodie(g.id)));
          card.appendChild(b); grid.appendChild(card);
        });
      }
      if (tab === 'sell') {
        let any = false;
        Object.keys(FOODS).forEach(id => {
          const n = G.pantry[id] || 0; if (!n) return; any = true;
          const card = foodCard(G, id, `<p><b>🪙 ${FOOD_PRICES[id]} each</b></p>`);
          card.classList.add('shop-card');
          const row = document.createElement('div'); row.className = 'answer-row';
          const one = document.createElement('button'); one.type = 'button'; one.className = 'choice'; one.textContent = 'Sell 1';
          one.addEventListener('click', () => after(api.sellFood(id, false)));
          const all = document.createElement('button'); all.type = 'button'; all.className = 'choice alt'; all.textContent = `All · 🪙 ${n * FOOD_PRICES[id]}`;
          all.addEventListener('click', () => after(api.sellFood(id, true)));
          row.appendChild(one); if (n > 1) row.appendChild(all);
          card.appendChild(row); grid.appendChild(card);
        });
        if (!any) body.insertAdjacentHTML('beforeend', '<p class="empty">Your pantry is empty. Shake trees to collect food, then come back to sell it.</p>');
      }
      body.appendChild(grid);
    });
  }
  function map(opts) {
    openSheet('World map', (body) => {
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">You explored <b>${opts.explored}%</b> of the Noodle Universe. ⭐ is your goal. Tap anywhere to drop a 📍 pin and follow the blue arrow.</p>`);
      const wrap = document.createElement('div'); wrap.className = 'map-wrap';
      const c = document.createElement('canvas'); c.className = 'map-canvas'; c.setAttribute('aria-label', 'World map');
      wrap.appendChild(c); body.appendChild(wrap);
      body.insertAdjacentHTML('beforeend', '<p class="sheet-sub map-legend">🏠 Home · 🍜 Grandma · 🏊 Pool · 🔮 Oracle · 🚀 Rocket · 🪽 Flight school · 🪞 Mirror Pond · 🥁 Drum · 🌿 Spring · 🗿 Statue · 🧊 Lake · 🐌 Snail · 🔒 Locked</p>');
      if (opts.pin) { body.insertAdjacentHTML('beforeend', '<button class="choice alt" type="button" id="clearPin">Remove pin</button>'); $('clearPin').addEventListener('click', () => { opts.clearPin(); closeSheet(); }); }
      const size = () => {
        const W = wrap.clientWidth, H = Math.round(W * opts.aspect), dpr = Math.min(2, window.devicePixelRatio || 1);
        c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
        const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); opts.draw(x, W, H);
      };
      setTimeout(size);
      let alive = true;
      const loop = () => { if (!alive || $('sheet').hidden || $('sheetTitle').textContent !== 'World map') { alive = false; return; } const x = c.getContext('2d'); const W = wrap.clientWidth; opts.draw(x, W, Math.round(W * opts.aspect)); setTimeout(loop, 250); };
      setTimeout(loop, 300);
      c.addEventListener('click', (e) => {
        const r = c.getBoundingClientRect();
        opts.tap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
        closeSheet();
      });
    });
  }
  function selectText(el) { try { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch (e) {} }

  function skills(G, stars) {
    openSheet('Skills & Challenges', (body) => {
      const level = 1 + Math.floor(Math.sqrt(stars / 2));
      const nextAt = 2 * level * level;
      body.insertAdjacentHTML('beforeend', `<p class="sheet-sub">⭐ <b>${stars} stars</b> · Noodle Level <b>${level}</b>. ${nextAt - stars} more stars to level ${level + 1}. Levels never stop.</p>
        <div class="progress"><div style="width:${Math.min(100, (stars - 2 * (level - 1) ** 2) / (nextAt - 2 * (level - 1) ** 2) * 100)}%"></div></div>
        <p class="sheet-sub">🎁 Level ${level + 1} reward: <b>${Game.levelReward().text}</b></p>`);
      const skillBlock = (skill, title, coach, where) => {
        const lv = G.skills[skill];
        const el = document.createElement('div'); el.className = 'clue';
        const m = Game.mastery(skill);
        el.innerHTML = `<span class="where">${coach} · ${where}</span><h3>${title}: level ${m.level}</h3>`;
        LESSONS.filter(l => l.skill === skill).forEach(l => {
          const done = !!G.lessons[l.id], active = G.lesson && G.lesson.id === l.id, next = !done && l.level === lv + 1;
          el.insertAdjacentHTML('beforeend', `<div class="lesson ${done ? 'done' : next ? 'next' : 'locked'}"><span class="mark">${done ? '✓' : active ? '▶' : next ? '•' : '🔒'}</span>
            <span><b>${l.title}</b> · ⭐ ${l.stars}<br><small>${done ? l.unlock : l.desc}</small></span></div>`);
        });
        if (lv >= 3) el.insertAdjacentHTML('beforeend', `<div class="lesson next"><span class="mark">∞</span><span><b>Mastery level ${m.level + 1}</b><br><small>Keep ${skill === 'swim' ? 'swimming' : 'flying'}: ${Math.max(0, m.next - m.xp)} more seconds. Levels never stop.</small></span></div>`);
        body.appendChild(el);
      };
      skillBlock('swim', '🏊 Swimming', 'Coach Kombu', 'on the Morning Pool deck');
      skillBlock('fly', '🪽 Flying', 'Captain Penne', 'on the hill in Crunch Meadow');
      if (G.daily && G.daily.list) {
        const d = document.createElement('div'); d.className = 'clue';
        d.innerHTML = `<span class="where">New ones every morning, forever · finish all 3 for a Perfect Day (⭐ +2)</span><h3>📅 Today's challenges (day ${G.day})${G.streak && G.lastPerfect >= G.day - 1 ? ` · 🔥 ${G.streak}-day streak` : ''}</h3>`;
        G.daily.list.forEach(c => {
          const done = G.daily.done[c.id], prog = Math.min(c.goal, Math.floor(G.daily.prog[c.id] || 0));
          d.insertAdjacentHTML('beforeend', `<div class="lesson ${done ? 'done' : 'next'}"><span class="mark">${done ? '✓' : '•'}</span><span><b>${c.title}</b> · ⭐ 1<br><small>${prog} / ${c.goal}</small></span></div>`);
        });
        body.appendChild(d);
      }
      const ch = document.createElement('div'); ch.className = 'clue';
      ch.innerHTML = '<span class="where">Big goals</span><h3>🏆 Challenges</h3>';
      CHALLENGES.forEach(c => {
        const done = !!G.challenges[c.id];
        ch.insertAdjacentHTML('beforeend', `<div class="lesson ${done ? 'done' : 'next'}"><span class="mark">${done ? '✓' : '•'}</span><span><b>${c.title}</b> · ⭐ ${c.stars}<br><small>${c.desc}</small></span></div>`);
      });
      body.appendChild(ch);
    });
  }

  return {
    players, openSheet, skills, leaderboard, cook, account, goalHint, shop, map,
    hud, goal, toast, combo, say, advance, close, dex, journal, closeSheet, drawPortrait,
    get busy() { return !!dlg || !$('sheet').hidden; },
    get talking() { return !!dlg; },
    fmtTime,
  };
})();
