// Small World background music: gentle, happy little songs made with WebAudio (no files).
//
// Every mood has its own short song, written below as DATA (tempo, key, chords, bass, melody, drums).
// A lookahead scheduler plays them on soft instruments (kalimba, marimba, bells, a warm pad, a round
// bass, a whisper of shaker, a wooden tick and a soft kick). Each time a song loops it changes a
// little (lead instrument, octave, a harmony line, a few bars of rest, drum fills, a sparkle) so it
// never gets tiring. Music is mixed quieter than the sound effects, and everything goes through a
// soft low-pass, a little reverb and a gentle compressor so it is never harsh.
//
// API:
//   Music.init()        call after a user gesture (safe to call many times)
//   Music.play(mood)    'morning' | 'day' | 'evening' | 'night' | 'adventure' | 'space' | 'title'
//                       cross-fades (about 2 s) to that mood's song; the same mood again does nothing
//   Music.toggle()      mute / unmute, returns the new muted state (remembered in localStorage)
//   Music.muted         true while muted;   Music.setMuted(bool)
//   Music.duck(on)      plays at about 35% while on (e.g. while a quiz is open)
//   Music.mood          the mood that is playing (or will play once started)
const Music = (() => {
  const STORE_KEY = 'small-world-music'; // '1' = muted, '0' = on
  const LOOKAHEAD = 0.12;                // seconds of notes scheduled ahead
  const TICK_MS = 25;                    // how often the scheduler wakes up
  const FADE = 2;                        // cross-fade seconds
  const DUCK = 0.35;                     // level while ducked
  const LEVEL = 0.65;                    // final music level (after the compressor)
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];

  const mod = (a, n) => ((a % n) + n) % n;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const safe = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } };
  function rng(seed) { // small seeded random (mulberry32), so offline renders are repeatable
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------------------------------------
  // THE SONGS
  //
  // key:    MIDI note of scale degree 1 for the melody (60 = middle C). Chords/bass use its pitch class.
  // chords: one entry per bar, Roman numerals in the key (I ii iii IV V vi, bVII, II ...), with an
  //         optional 7, M7, 6, sus4, add9. Two chords in one bar ("ii7 V7") split the bar in half.
  // mel:    one string per bar. Tokens are scale degrees 1-7 of the major scale (b/# before = flat/sharp,
  //         ' after = octave up, , after = octave down) or r (rest), then :length in eighth notes
  //         (default 1). Every bar adds up to 8 eighths (6 in 3/4 time).
  // bass:   same rhythm idea; R = chord root, 3 / 5 / 7 = chord tones, 8 = root an octave up, r = rest.
  // comp:   chord hits on a 16th-note grid; arp: chord-tone numbers played one per eighth.
  // drums:  one character per 16th note: x = hit, o = medium, - = soft, . = nothing.
  // lead:   instruments the melody may be played on (the first one is used first).
  // ------------------------------------------------------------------------------------------
  const SONGS = {
    // A bright little hook for the title screen: "do mi SOL, la sol MI" is the part you hum.
    title: {
      name: 'Hello, Small World', bpm: 100, key: 72, meter: 4, swing: 0.06, intro: 1, gain: 1,
      lead: ['kalimba', 'marimba', 'bell'],
      A: {
        chords: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV V', 'I'],
        mel: ['1 3 5:2 6 5 3:2', '2 3 2:2 5,:2 r:2', '1 3 6:2 5 3 1:2', '2:2 1 6, 1:4',
              '1 3 5:2 6 5 3:2', '2 3 5:2 6 5 2:2', '1 2 3:2 2 1 2:2', '1:6 r:2'],
        bass: 'R:2 r 5 R:2 5:2',
      },
      B: {
        chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'vi', 'V'],
        mel: ['6:2 6 5 6:2 1\':2', '5:3 3 2:4', '3:2 3 2 3:2 5:2', '6:6 r:2',
              '6:2 6 5 6:2 1\':2', '2\':3 1\' 5:4', '1\':2 6 5 3:2 2:2', '2:4 r 5, 6, 7,'],
        bass: 'R:3 R 5:2 8:2',
      },
      comp: { inst: 'marimba', pat: '..x...x...x...x.', v: 0.9 },
      drums: { kick: 'x.......x.......', shaker: 'o.x.o.x.o.x.o.x.', tick: '....x.......x...' },
      fill: 'tom',
    },

    // Waking up: a rolling marimba arpeggio and a kalimba tune that climbs like the sun.
    morning: {
      name: 'Sunny Side Up', bpm: 92, key: 64, meter: 4, swing: 0.04, intro: 2, gain: 1,
      lead: ['kalimba', 'bell', 'marimba'],
      A: {
        chords: ['I', 'IV', 'vi', 'V', 'I', 'IV', 'ii V', 'I'],
        mel: ['5 3 5 6 5:4', '1\' 6 5 6 1\':4', '2\' 1\' 6 5 6:4', '5:3 3 2:4',
              '5 3 5 6 5:4', '6 5 6 1\' 2\':4', '2\':2 1\' 6 5:2 3:2', '1:4 r:2 3 5'],
        bass: 'R:4 5:2 8:2',
      },
      B: {
        chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'IV', 'V'],
        mel: ['6:2 1\' 6 5:4', '5 7 2\' 3\' 2\':4', '3\':2 2\' 1\' 7:4', '6:6 r:2',
              '6:2 1\' 6 5:4', '5 7 2\' 3\' 2\':4', '1\':2 6 5 3:4', '2:4 r:2 3 4'],
        bass: 'R:4 5:2 3:2',
      },
      arp: { inst: 'marimba', pat: [0, 2, 3, 2, 1, 2, 3, 2], lo: 52, v: 0.8 },
      drums: { kick: 'x...........o...', shaker: 'x.o.x.o.x.o.x.o.' },
    },

    // Busy town square: a bouncy marimba tune with a little shuffle, plucky chords on the off-beats.
    day: {
      name: 'Town Square Stroll', bpm: 104, key: 65, meter: 4, swing: 0.14, intro: 2, gain: 1,
      lead: ['marimba', 'kalimba', 'bell'],
      A: {
        chords: ['I', 'IV', 'vi', 'V', 'I', 'IV', 'V', 'I'],
        mel: ['3 5 r 5 6:2 5 3', '4 6 r 6 1\':2 6 4', '2 3 5 6:2 5 3 2', '5,:2 7,:2 2:3 r',
              '3 5 r 5 6:2 5 3', '4 6 r 6 1\':2 2\' 1\'', '6 5 3 2 5,:2 7,:2', '1:4 r 3 5 6'],
        bass: 'R:2 5 r 8 5 R:2',
      },
      B: {
        chords: ['IV', 'V', 'iii', 'vi', 'IV', 'V', 'ii', 'V'],
        mel: ['1\':3 6 4:2 6:2', '5:3 3 2:2 5:2', '3:3 5 7:2 5:2', '6:4 r 3 5 6',
              '1\':3 6 4:2 6:2', '5:3 6 5 3 2 3', '2:2 4 6 5:2 4:2', '2:4 r 7, 1 2'],
        bass: 'R:2 5 r 8 5 R:2',
      },
      comp: { inst: 'kalimba', pat: '..x...x...x...x.', v: 0.8 },
      drums: { kick: 'x.......x.o.....', shaker: 'o.x.o.x.o.x.o.x.', tick: '....x.......x...' },
      fill: 'tom',
    },

    // Sunset on the porch: slow, lazy swing, warm seventh chords and a soft pad underneath.
    evening: {
      name: 'Porch Light', bpm: 84, key: 63, meter: 4, swing: 0.18, intro: 1, gain: 1,
      lead: ['marimba', 'kalimba'],
      A: {
        chords: ['IM7', 'vi7', 'ii7', 'V7', 'IM7', 'vi7', 'ii7 V7', 'I6'],
        mel: ['5:3 3 2 1 3:2', '6:3 5 3:4', '4:3 3 2 1 2:2', '7,:2 2:2 5:4',
              '5:3 3 2 1 3:2', '6:3 1\' 7 6 5:2', '4 3 2 1 2 3 5:2', '1:6 r:2'],
        bass: 'R:3 R 5:2 3:2',
      },
      B: {
        chords: ['IVM7', 'iii7', 'vi7', 'V', 'IVM7', 'iii7', 'ii7', 'V7'],
        mel: ['6:2 1\' 3\':3 2\' 1\'', '7:3 5 3:4', '6 1\' 3\' 1\' 6:2 5:2', '5:4 r:2 5 6',
              '1\':2 3\':3 2\' 1\' 6', '7:3 1\' 7 5:3', '6 4 2 4 6:2 1\':2', '2\':3 1\' 7:4'],
        bass: 'R:3 R 5:2 3:2',
      },
      comp: { inst: 'kalimba', pat: 'x.....x.........', v: 0.7 },
      pad: { v: 0.5 },
      drums: { kick: 'x.........o.....', shaker: '..o...x...o...x.' },
    },

    // A lullaby in 3/4 time: music-box bells, a rocking kalimba and a soft, slow pad. No drums.
    night: {
      name: 'Sleepy Stars', bpm: 70, key: 67, meter: 3, swing: 0, intro: 1, gain: 1,
      lead: ['kalimba', 'bell'],
      A: {
        chords: ['I', 'vi', 'IV', 'V', 'I', 'IV', 'V', 'I'],
        mel: ['5:2 3:2 5:2', '6:4 5:2', '4:2 6:2 1\':2', '7:3 6 5:2',
              '5:2 3:2 5:2', '1\':4 6:2', '2:3 3 2:2', '1:6'],
        bass: 'R:4 5:2',
      },
      B: {
        chords: ['IV', 'I', 'V', 'vi', 'IV', 'I', 'V', 'I'],
        mel: ['6:2 1\':2 6:2', '5:4 3:2', '5:3 6 7:2', '6:4 r:2',
              '6:2 1\':2 6:2', '5:2 3:2 1:2', '2:4 7,:2', '1:6'],
        bass: 'R:4 5:2',
      },
      arp: { inst: 'kalimba', pat: [0, 2, 3, 2, 1, 2], lo: 55, v: 0.7 },
      pad: { v: 1 },
      mix: { lead: 0.85 },
    },

    // Off exploring: quick and bouncy, a heroic bVII chord, octave-hopping bass and a busy shaker.
    adventure: {
      name: 'Over the Hill', bpm: 120, key: 69, meter: 4, swing: 0.1, intro: 1, gain: 1,
      lead: ['kalimba', 'marimba', 'bell'],
      A: {
        chords: ['I', 'bVII', 'IV', 'I', 'I', 'bVII', 'IV', 'V'],
        mel: ['5 r 5 6 5 3 1:2', '4 r 4 2 1 2 b7,:2', '4 r 4 6 1\' 6 5:2', '5:2 3 2 1:3 r',
              '5 r 5 6 5 3 1:2', '4 r 4 2 1 2 b7,:2', '4 r 4 6 1\':2 2\':2', '2\':3 1\' 7 6 5 r'],
        bass: 'R:2 8 R 5:2 8 5',
      },
      B: {
        chords: ['vi', 'IV', 'I', 'V', 'vi', 'IV', 'ii', 'V'],
        mel: ['3 r 3 5 6:2 5 3', '6 r 6 5 4 3 4:2', '5 r 5 3 2 1 2:2', '2:2 3 2 7,:2 5,:2',
              '3 r 3 5 6:2 5 3', '6 r 6 5 4 3 4:2', '2 4 6 1\' 2\':2 1\' 6', '5 6 7 2\' 5:3 r'],
        bass: 'R:2 8 R 5:2 8 5',
      },
      comp: { inst: 'marimba', pat: '..x...x...x...x.', v: 0.85 },
      drums: { kick: 'x.....x.x.......', shaker: 'x-o-x-o-x-o-x-o-', tick: '....x.......x...' },
      fill: 'tom',
    },

    // Floating among the stars: slow bell arpeggios, a dreamy lydian II chord, echoing bells.
    space: {
      name: 'Moon Garden', bpm: 64, key: 61, meter: 4, swing: 0, intro: 1, gain: 1,
      lead: ['bell', 'kalimba'],
      A: {
        chords: ['IM7', 'II', 'IM7', 'II', 'vi7', 'IVM7', 'IM7', 'Vsus4'],
        mel: ['3:4 5:4', '2:2 #4:2 6:4', '7:6 5:2', '6:8',
              '3:4 1\':4', '3\':2 2\':2 1\':4', '5:4 3:4', '2:8'],
        bass: 'R:8',
      },
      B: {
        chords: ['vi7', 'IVM7', 'IM7', 'V', 'vi7', 'IVM7', 'II', 'IVM7'],
        mel: ['1\':4 7:2 5:2', '6:6 3:2', '5:4 7:4', '2\':6 1\':2',
              '1\':4 7:2 5:2', '6:4 1\':4', '2\':4 #4:4', '6:8'],
        bass: 'R:8',
      },
      arp: { inst: 'bell', pat: [0, 1, 2, 3, 4, 3, 2, 1], lo: 60, v: 0.75 },
      pad: { v: 1 },
      echo: { d: 3, v: 0.4 },
    },
  };

  // Where each part sits in the mix: level, stereo position and how much reverb it gets.
  const ROLES = {
    lead: { gain: 1.0, pan: 0, wet: 0.3 },
    harm: { gain: 0.45, pan: -0.2, wet: 0.35 },
    echo: { gain: 0.5, pan: 0.35, wet: 0.7 },
    comp: { gain: 0.48, pan: -0.25, wet: 0.25 },
    arp: { gain: 0.45, pan: 0.3, wet: 0.4 },
    pad: { gain: 0.45, pan: 0, wet: 0.5 },
    bass: { gain: 0.2, pan: 0, wet: 0.05 },
    kick: { gain: 0.3, pan: 0, wet: 0.04 },
    tom: { gain: 0.32, pan: 0.15, wet: 0.15 },
    shaker: { gain: 0.2, pan: 0.35, wet: 0.12 },
    tick: { gain: 0.16, pan: -0.3, wet: 0.15 },
    sparkle: { gain: 0.3, pan: 0.2, wet: 0.5 },
  };
  const DRUM_V = { x: 1, o: 0.6, '-': 0.32 };

  // ------------------------------------------------------------------------------------------
  // Reading the song data
  // ------------------------------------------------------------------------------------------
  const NUMERALS = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
  function parseChord(sym, key) {
    const m = /^([b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(sym);
    if (!m) return null;
    const minor = m[2] === m[2].toLowerCase(), q = m[3];
    const root = mod(key + NUMERALS[m[2].toUpperCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0), 12);
    let tones = minor ? [0, 3, 7] : [0, 4, 7];
    if (q.indexOf('sus4') >= 0) tones = [0, 5, 7];
    else if (q.indexOf('sus2') >= 0) tones = [0, 2, 7];
    if (q.indexOf('M7') >= 0) tones.push(11);
    else if (q.indexOf('7') >= 0) tones.push(10);
    if (q.indexOf('6') >= 0) tones.push(9);
    if (q.indexOf('add9') >= 0) tones.push(14);
    return { root, tones };
  }
  // splits "a:2 b c:3" into timed tokens; fn turns a token head into an event (or null for a rest)
  function parseLine(str, fn) {
    const out = [];
    let p = 0;
    String(str || '').trim().split(/\s+/).forEach((tok) => {
      if (!tok) return;
      const i = tok.indexOf(':'), head = i >= 0 ? tok.slice(0, i) : tok, len = i >= 0 ? parseFloat(tok.slice(i + 1)) : 1;
      const x = fn(head);
      if (x) { x.p = p; x.len = len; out.push(x); }
      p += len;
    });
    out.total = p;
    return out;
  }
  function melNote(head, key) {
    if (head === 'r') return null;
    const m = /^([b#]?)([1-7])([',]*)$/.exec(head);
    if (!m) return { bad: head, deg: 0, midi: key };
    const oct = (m[3].match(/'/g) || []).length - (m[3].match(/,/g) || []).length;
    const d = +m[2] - 1;
    return { deg: d + 7 * oct, midi: key + MAJOR[d] + 12 * oct + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0) };
  }
  const degMidi = (key, deg) => key + 12 * Math.floor(deg / 7) + MAJOR[mod(deg, 7)];

  function prep(s) {
    const bar8 = s.meter * 2, steps = s.meter * 4;
    s.form = s.form || ['A', 'B'];
    s.problems = [];
    let lo = 127, hi = 0;
    const mk = (src, name) => {
      const sec = { name, len: src.chords.length };
      sec.chords = src.chords.map((bar, bi) => {
        const syms = bar.trim().split(/\s+/);
        return syms.map((sym, i) => {
          const c = parseChord(sym, s.key) || (s.problems.push(name + ' chord ' + (bi + 1) + ' "' + sym + '"'), { root: mod(s.key, 12), tones: [0, 4, 7] });
          c.at = i * bar8 / syms.length; c.len = bar8 / syms.length;
          return c;
        });
      });
      sec.mel = null;
      if (src.mel) {
        if (src.mel.length !== sec.len) s.problems.push(name + ' has ' + src.mel.length + ' melody bars for ' + sec.len + ' chords');
        sec.mel = src.mel.map((b, i) => {
          const line = parseLine(b, (h) => melNote(h, s.key));
          if (Math.abs(line.total - bar8) > 1e-6) s.problems.push(name + ' melody bar ' + (i + 1) + ' is ' + line.total + ' eighths');
          line.forEach((n) => { if (n.bad) s.problems.push(name + ' bad note ' + n.bad); lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); });
          return line;
        });
      }
      sec.bass = parseLine(src.bass, (h) => (h === 'r' ? null : { tok: h }));
      if (Math.abs(sec.bass.total - bar8) > 1e-6) s.problems.push(name + ' bass is ' + sec.bass.total + ' eighths');
      return sec;
    };
    s.secs = {};
    s.form.forEach((n) => { if (!s.secs[n]) s.secs[n] = mk(s[n], n); });
    s.introSec = s.intro ? mk({ chords: s[s.form[0]].chords.slice(0, s.intro), bass: s[s.form[0]].bass }, 'intro') : null;
    s.lo = lo; s.hi = hi; s.steps = steps; s.bar8 = bar8;
    s.drumPat = {};
    Object.keys(s.drums || {}).forEach((k) => {
      const str = s.drums[k], arr = [];
      for (let i = 0; i < steps; i++) arr.push(DRUM_V[str[i % str.length]] || 0);
      s.drumPat[k] = arr;
    });
    if (s.comp) {
      s.compPat = [];
      for (let i = 0; i < steps; i++) s.compPat.push(DRUM_V[s.comp.pat[i % s.comp.pat.length]] || 0);
    }
  }
  Object.keys(SONGS).forEach((k) => prep(SONGS[k]));

  // ------------------------------------------------------------------------------------------
  // Instruments (all soft sines/triangles; nothing is a square wave)
  // ------------------------------------------------------------------------------------------
  const LIMIT = 3400; // no partial above this (the whole mix is low-passed at 3.5 kHz anyway)
  function partial(c, dest, type, f, t, peak, attack, dur) {
    if (f >= LIMIT || peak <= 0) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + dur + 0.03);
  }
  // a tone that holds a little before it fades (for the bass)
  function held(c, dest, type, f, t, peak, attack, hold, rel) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(peak * 0.55, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + rel);
    o.connect(g); g.connect(dest);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + attack + hold + rel + 0.03);
  }
  function noiseHit(c, dest, t, buf, off, freq, q, peak, attack, dur) {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(t, off); s.stop(t + dur + 0.02);
  }

  const VOICE = {
    // warm plucked tine: sine + a soft octave, plus a tiny metallic "tink" on low notes
    kalimba(c, d, t, f, v, len) {
      const ring = clamp(0.6 + len * 0.7, 0.6, 1.7) * (f > 700 ? 0.8 : 1);
      partial(c, d, 'sine', f, t, 0.32 * v, 0.004, ring);
      partial(c, d, 'sine', f * 2, t, 0.06 * v, 0.003, ring * 0.35);
      partial(c, d, 'sine', f * 5.4, t, 0.012 * v, 0.002, 0.05);
    },
    // wooden bar: sine + soft octave, and a very short mallet knock
    marimba(c, d, t, f, v, len) {
      const ring = clamp(0.35 + len * 0.3, 0.35, 0.85) * (f > 700 ? 0.75 : 1);
      partial(c, d, 'sine', f, t, 0.34 * v, 0.003, ring);
      partial(c, d, 'sine', f * 2, t, 0.035 * v, 0.003, ring * 0.3);
      partial(c, d, 'sine', f * (f * 4 < LIMIT ? 4 : 3), t, 0.04 * v, 0.002, 0.06);
    },
    // soft bell / music box: a few sine partials, the high ones fade first
    bell(c, d, t, f, v, len) {
      const ring = clamp(1.3 + len * 0.3, 1.3, 2.6);
      partial(c, d, 'sine', f, t, 0.24 * v, 0.004, ring);
      partial(c, d, 'sine', f * 2.003, t, 0.07 * v, 0.003, ring * 0.45);
      partial(c, d, 'sine', f * 4.01, t, 0.022 * v, 0.002, ring * 0.18);
    },
    // round bass: sine for weight, a quieter triangle so small speakers can still hear it
    bass(c, d, t, f, v, len) {
      const hold = clamp(len * 0.55, 0.08, 0.9), rel = clamp(len * 0.5, 0.15, 0.9);
      held(c, d, 'sine', f, t, 0.5 * v, 0.012, hold, rel);
      held(c, d, 'triangle', f, t, 0.13 * v, 0.012, hold * 0.8, rel * 0.8);
    },
    // soft pad: detuned triangles through a low-pass, slow swell in and out
    pad(c, d, t, freqs, v, len) {
      const lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = -3;
      const att = Math.min(1.4, len * 0.45), end = t + len + 1.3, peak = 0.05 * v;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + att);
      g.gain.setValueAtTime(peak, t + len);
      g.gain.linearRampToValueAtTime(0, end);
      lp.connect(g); g.connect(d);
      let first = null;
      freqs.forEach((f) => [-6, 6].forEach((det) => {
        const o = c.createOscillator();
        o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(end + 0.05);
        if (!first) { first = o; o.onended = () => { lp.disconnect(); g.disconnect(); }; }
      }));
    },
    // soft kick: a sine that drops in pitch
    kick(c, d, t, v) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.13);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6 * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(d);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start(t); o.stop(t + 0.33);
    },
    // little wooden tom for fills (x = pitch factor)
    tom(c, d, t, v, buf, x) {
      const o = c.createOscillator(), g = c.createGain(), f = 200 * (x || 1);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g); g.connect(d);
      o.onended = () => { o.disconnect(); g.disconnect(); };
      o.start(t); o.stop(t + 0.29);
    },
    // shaker: a puff of filtered noise
    shaker(c, d, t, v, buf, x) { noiseHit(c, d, t, buf, x || 0, 3000, 0.9, 0.22 * v, 0.012, 0.075); },
    // wooden tick: a very short high sine
    tick(c, d, t, v) { partial(c, d, 'sine', 1560, t, 0.3 * v, 0.001, 0.045); partial(c, d, 'sine', 2350, t, 0.08 * v, 0.001, 0.025); },
  };

  // ------------------------------------------------------------------------------------------
  // The shared sound chain: song buses -> high-pass -> soft low-pass -> compressor -> level
  //                         -> duck -> mute -> speakers, with a small convolver room on the side
  // ------------------------------------------------------------------------------------------
  function buildGraph(c) {
    const g = {};
    g.mix = c.createGain(); g.mix.gain.value = 0.4; // keeps the compressor working on peaks only
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = -3;
    const lp1 = c.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 3500; lp1.Q.value = -3;
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 5200; lp2.Q.value = -3;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    g.level = c.createGain(); g.level.gain.value = LEVEL;
    g.duck = c.createGain();
    g.mute = c.createGain();
    g.mix.connect(hp); hp.connect(lp1); lp1.connect(lp2); lp2.connect(comp);
    comp.connect(g.level); g.level.connect(g.duck); g.duck.connect(g.mute); g.mute.connect(c.destination);
    // a small, soft, slightly dark room
    const r = rng(20240611), sr = c.sampleRate, len = Math.floor(sr * 2.2), pre = Math.floor(sr * 0.012);
    const ir = c.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const dd = ir.getChannelData(ch);
      let y = 0;
      for (let i = pre; i < len; i++) { y += 0.3 * ((r() * 2 - 1) - y); dd[i] = y * Math.pow(1 - i / len, 2.6); }
    }
    const conv = c.createConvolver(); conv.buffer = ir;
    const ret = c.createGain(); ret.gain.value = 0.55;
    conv.connect(ret); ret.connect(g.mix);
    g.verbIn = conv;
    g.noise = c.createBuffer(1, sr, sr);
    const nd = g.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    return g;
  }

  // ------------------------------------------------------------------------------------------
  // A Player plays one song on its own fade-able bus, bar by bar
  // ------------------------------------------------------------------------------------------
  function Player(c, graph, mood, rand, startAt, fadeIn) {
    const s = SONGS[mood];
    this.c = c; this.graph = graph; this.mood = mood; this.song = s; this.rand = rand;
    this.e8 = 60 / s.bpm / 2;
    this.barDur = s.bar8 * this.e8;
    this.dry = c.createGain(); this.wet = c.createGain();
    this.dry.connect(graph.mix); this.wet.connect(graph.verbIn);
    const now = c.currentTime;
    [this.dry, this.wet].forEach((n) => {
      n.gain.setValueAtTime(fadeIn ? 0 : 1, now);
      if (fadeIn) n.gain.linearRampToValueAtTime(1, now + fadeIn);
    });
    this.roles = {}; this.nodes = [];
    this.queue = [];
    this.nextBarAt = startAt;
    this.loop = 0; this.secIdx = s.introSec ? -1 : 0; this.barInSec = 0;
    this.plan = null; this.prevRest = false;
    this.endAt = Infinity;
  }
  Player.prototype.role = function (name) {
    if (this.roles[name]) return this.roles[name];
    const c = this.c, cfg = ROLES[name], mix = (this.song.mix && this.song.mix[name]) || 1;
    const g = c.createGain();
    g.gain.value = cfg.gain * mix * (this.song.gain || 1);
    this.nodes.push(g);
    if (cfg.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = cfg.pan;
      g.connect(p); p.connect(this.dry); this.nodes.push(p);
    } else g.connect(this.dry);
    if (cfg.wet) {
      const w = c.createGain(); w.gain.value = cfg.wet;
      g.connect(w); w.connect(this.wet); this.nodes.push(w);
    }
    this.roles[name] = g;
    return g;
  };
  Player.prototype.fadeOut = function (now, dur) {
    if (this.endAt !== Infinity) return;
    [this.dry, this.wet].forEach((n) => {
      const v = n.gain.value;
      n.gain.cancelScheduledValues(now);
      n.gain.setValueAtTime(v, now);
      n.gain.linearRampToValueAtTime(0, now + dur);
    });
    this.endAt = now + dur + 0.05;
  };
  Player.prototype.dispose = function () {
    this.endAt = 0; this.queue = [];
    [this.dry, this.wet].concat(this.nodes).forEach((n) => { try { n.disconnect(); } catch (e) { /* already */ } });
    this.nodes = []; this.roles = {};
  };
  // schedule every note that starts before `horizon`
  Player.prototype.scheduleUntil = function (horizon, now) {
    horizon = Math.min(horizon, this.endAt);
    while (this.nextBarAt < horizon) {
      if (this.nextBarAt < now) this.nextBarAt = now + 0.06; // we were paused: pick up cleanly
      this.buildBar();
    }
    const q = this.queue;
    let i = 0;
    while (i < q.length && q[i].t < horizon) {
      const e = q[i++];
      if (e.t >= now - 0.01) this.fire(e);
    }
    if (i) q.splice(0, i);
  };
  Player.prototype.fire = function (e) {
    if (this.only && this.only.indexOf(e.role) < 0) return; // test hook: solo some parts
    const d = this.role(e.role);
    if (e.k === 'pad') VOICE.pad(this.c, d, e.t, e.midis.map(hz), e.v, e.len);
    else if (e.k === 'drum') VOICE[e.inst](this.c, d, e.t, e.v, this.graph.noise, e.x);
    else VOICE[e.inst](this.c, d, e.t, hz(e.midi), e.v, e.len);
  };
  // pick this section's little changes
  Player.prototype.planSection = function () {
    const s = this.song, r = this.rand, first = this.loop === 0, leads = s.lead;
    const lead = first ? leads[this.secIdx % leads.length] : leads[Math.floor(r() * leads.length)];
    let oct = 0;
    if (!first && r() < 0.25) {
      const up = s.hi + 12 <= 91, down = s.lo - 12 >= 52 && lead !== 'bell';
      if (up && (!down || r() < 0.7)) oct = 12; else if (down) oct = -12;
    }
    let rest = null; // a 4-bar breather without the melody
    if (!first && !this.prevRest && r() < 0.3) rest = r() < 0.5 ? 0 : 4;
    this.prevRest = rest !== null;
    const harm = !first && s.harmony !== false && r() < 0.35;
    this.plan = { lead, oct, rest, harm, harmInst: lead === 'bell' ? 'kalimba' : lead };
  };

  const voicing = (ch, lo) => ch.tones.map((st) => lo + mod(ch.root + st - lo, 12)).sort((a, b) => a - b);
  const chordAt = (chords, p) => { let c = chords[0]; for (const x of chords) if (x.at <= p + 1e-6) c = x; return c; };

  Player.prototype.buildBar = function () {
    const s = this.song, r = this.rand, t0 = this.nextBarAt, e8 = this.e8, bar8 = s.bar8, steps = s.steps;
    const intro = this.secIdx < 0;
    const sec = intro ? s.introSec : s.secs[s.form[this.secIdx]];
    if (!intro && this.barInSec === 0) this.planSection();
    const plan = intro ? null : this.plan, b = this.barInSec, last = b === sec.len - 1;
    const chords = sec.chords[b];
    const T = (p) => t0 + p * e8 + (p % 2 === 1 ? s.swing * e8 : 0); // swing the off-beat eighths
    const hum = (amt) => 1 - amt + r() * amt * 2;                      // small random velocity changes
    const ev = [];
    const note = (p, inst, role, midi, v, len, dt) => ev.push({ t: T(p) + (dt || 0), k: 'note', inst, role, midi, v, len });

    // melody (plus an optional harmony a third below on the long notes, and an echo in space)
    const resting = plan && plan.rest !== null && b >= plan.rest && b < plan.rest + 4;
    let lateMel = false;
    if (sec.mel && !resting) {
      sec.mel[b].forEach((n) => {
        const v = hum(0.1) * (n.p === 0 ? 1.08 : 1), len = n.len * e8, dt = r() * 0.006;
        note(n.p, plan.lead, 'lead', n.midi + plan.oct, v, len, dt);
        if (plan.harm && n.len >= 2) note(n.p, plan.harmInst, 'harm', degMidi(s.key, n.deg - 2) + plan.oct, v * 0.8, len, dt + 0.004);
        if (s.echo) note(n.p + s.echo.d, plan.lead, 'echo', n.midi + plan.oct, v * s.echo.v, len);
        if (n.p >= bar8 - 2) lateMel = true;
      });
    }

    // bass
    sec.bass.forEach((n) => {
      const ch = chordAt(chords, n.p), root = 40 + mod(ch.root - 40, 12), tk = n.tok;
      let m = root;
      if (tk === '3') m = root + ch.tones[1];
      else if (tk === '5') m = root + ch.tones[2];
      else if (tk === '7') m = root + (ch.tones[3] !== undefined ? ch.tones[3] : 12);
      else if (tk === '8') m = root + 12;
      note(n.p, 'bass', 'bass', m, hum(0.08) * (n.p === 0 ? 1 : 0.85), n.len * e8);
    });

    // chord hits
    if (s.comp) {
      for (let i = 0; i < steps; i++) {
        const cv = s.compPat[i];
        if (!cv) continue;
        const p = i / 2, ch = chordAt(chords, p);
        voicing(ch, s.comp.lo || 55).forEach((m, j) => note(p, s.comp.inst, 'comp', m, cv * s.comp.v * hum(0.1), e8 * 0.8, j * 0.007));
      }
    }
    // arpeggio (a little louder while the melody takes a breather)
    if (s.arp) {
      const pat = s.arp.pat, boost = resting ? 1.35 : 1;
      for (let i = 0; i < bar8; i++) {
        const k = pat[i % pat.length];
        if (k === null || k < 0) continue;
        const tones = voicing(chordAt(chords, i), s.arp.lo || 55);
        const m = tones[k % tones.length] + 12 * Math.floor(k / tones.length);
        note(i, s.arp.inst, 'arp', m, s.arp.v * boost * hum(0.12) * (i === 0 ? 1.1 : 1), e8 * 1.5);
      }
    }
    // pad
    if (s.pad) chords.forEach((ch) => ev.push({ t: T(ch.at), k: 'pad', role: 'pad', midis: voicing(ch, s.pad.lo || 55), v: s.pad.v, len: ch.len * e8 }));

    // drums (lighter in the intro), with a shaker roll and toms at the end of a section
    const fill = last && !intro;
    Object.keys(s.drumPat).forEach((inst) => {
      const pat = s.drumPat[inst].slice();
      if (inst === 'kick' && intro && b === 0) return;
      if (inst === 'shaker' && fill) for (let j = 0; j < 4; j++) pat[steps - 4 + j] = 0.35 + j * 0.17;
      for (let i = 0; i < steps; i++) {
        if (!pat[i]) continue;
        if (fill && s.fill === 'tom' && inst !== 'shaker' && i >= steps - 4) continue;
        ev.push({ t: T(i / 2), k: 'drum', inst, role: inst, v: pat[i] * hum(0.15), x: r() * 0.85 });
      }
    });
    if (fill && s.fill === 'tom' && r() < 0.7) {
      ev.push({ t: T((steps - 4) / 2), k: 'drum', inst: 'tom', role: 'tom', v: 0.8, x: 1.25 });
      ev.push({ t: T((steps - 2) / 2), k: 'drum', inst: 'tom', role: 'tom', v: 0.95, x: 0.95 });
    }
    // a little bell sparkle leading into the next section, when the melody leaves room for it
    if (fill && !lateMel && r() < 0.45) {
      const base = s.key + (s.key + 24 <= 91 ? 12 : 0);
      [0, 4, 7, 12].forEach((st, j) => note(bar8 - 2 + j * 0.5, 'bell', 'sparkle', base + st, 0.55 + j * 0.12, e8));
    }

    this.queue = this.queue.concat(ev).sort((a, c) => a.t - c.t);

    // move on
    this.nextBarAt = t0 + this.barDur;
    this.barInSec++;
    if (this.barInSec >= sec.len) {
      this.barInSec = 0;
      this.secIdx++;
      if (this.secIdx >= s.form.length) { this.secIdx = 0; this.loop++; }
    }
  };

  // ------------------------------------------------------------------------------------------
  // The live engine
  // ------------------------------------------------------------------------------------------
  let ctx = null, graph = null, players = [], mood = null, ducked = false, timer = null, sleepTimer = null;
  let muted = false;
  try { muted = localStorage.getItem(STORE_KEY) === '1'; } catch (e) { /* storage blocked */ }
  const rand = rng((Math.random() * 4294967296) >>> 0);
  const isHidden = () => typeof document !== 'undefined' && !!document.hidden;
  const shouldPlay = () => !!(ctx && mood && !muted && !isHidden());

  function tick() {
    timer = null;
    if (!shouldPlay()) return;
    const now = ctx.currentTime;
    players.forEach((p) => p.scheduleUntil(now + LOOKAHEAD, now));
    for (let i = players.length - 1; i >= 0; i--) {
      if (players[i].endAt <= now) { players[i].dispose(); players.splice(i, 1); }
    }
    timer = setTimeout(tick, TICK_MS);
  }
  function trim() { while (players.length > 3) players.shift().dispose(); }
  // stop scheduling; when muted or hidden, let the audio context sleep to save battery
  function halt() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      sleepTimer = null;
      if (ctx && (muted || isHidden()) && ctx.state === 'running') safe(() => ctx.suspend());
    }, isHidden() ? 0 : 700);
  }
  // (re)start playing if we should be
  function wake() {
    if (!ctx) return;
    if (!shouldPlay()) { halt(); return; }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
    if (ctx.state !== 'running') safe(() => ctx.resume());
    const cur = players[players.length - 1];
    if (!cur || cur.mood !== mood || cur.endAt !== Infinity) {
      players.push(new Player(ctx, graph, mood, rand, ctx.currentTime + 0.08, 1.2));
      trim();
    }
    if (!timer) tick();
  }

  function init() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
        graph = buildGraph(ctx);
        graph.mute.gain.value = muted ? 0 : 1;
        graph.duck.gain.value = ducked ? DUCK : 1;
      } catch (e) { ctx = null; graph = null; return; }
    }
    if (!muted && ctx.state !== 'running') safe(() => ctx.resume());
    wake();
  }

  function play(m) {
    if (!SONGS[m] || m === mood) return;
    mood = m;
    if (!ctx) return;
    if (!shouldPlay()) { players.forEach((p) => p.dispose()); players = []; return; }
    const now = ctx.currentTime;
    players.forEach((p) => p.fadeOut(now, FADE));
    players.push(new Player(ctx, graph, m, rand, now + 0.1, FADE));
    trim();
    wake();
  }

  function setMuted(b) {
    b = !!b;
    if (b === muted) return muted;
    muted = b;
    try { localStorage.setItem(STORE_KEY, muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
    if (graph) {
      const g = graph.mute.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(muted ? 0 : 1, now, muted ? 0.1 : 0.35);
    }
    if (muted) halt(); else wake();
    return muted;
  }

  function duck(on) {
    ducked = !!on;
    if (graph) {
      const g = graph.duck.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(ducked ? DUCK : 1, now, 0.3);
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (isHidden()) halt(); else wake();
    });
  }

  // Test hook: render `seconds` of a mood with an OfflineAudioContext (same instruments and chain).
  function renderOffline(m, seconds = 16, opts = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = opts.sampleRate || 44100;
    const oc = new OAC(2, Math.ceil(seconds * sr), sr);
    const g = buildGraph(oc);
    const p = new Player(oc, g, SONGS[m] ? m : 'day', rng(opts.seed || 7), 0.05, 0);
    if (opts.only) p.only = opts.only;
    p.scheduleUntil(seconds, 0);
    return oc.startRendering();
  }

  return {
    init,
    play,
    toggle() { return setMuted(!muted); },
    setMuted,
    duck,
    get muted() { return muted; },
    get mood() { return mood; },
    moods: Object.keys(SONGS),
    _renderOffline: renderOffline,
    _check() {
      const out = [];
      Object.keys(SONGS).forEach((k) => SONGS[k].problems.forEach((p) => out.push(k + ': ' + p)));
      return out;
    },
  };
})();
