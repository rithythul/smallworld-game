// Static game content: noodles, world layout, clues and riddles.

const NOODLES = [
  { id: 'brick', name: 'Crunchy Ramen Brick', rarity: 'common', shape: 'brick', color: '#f4c35a',
    desc: 'The classic. Loud, proud and very crunchy.', hint: 'Crunch any noodle brick.' },
  { id: 'crinkle', name: 'Crinkle Crisp', rarity: 'common', shape: 'zig', color: '#f09a3e',
    desc: 'Folded 40 times. Nobody knows why.', hint: 'Sometimes hides inside bricks.' },
  { id: 'vine', name: 'Spaghetti Vine', rarity: 'common', shape: 'wave', color: '#f7dc7a',
    desc: 'Grows on willows. Slurps itself if you wait long enough.', hint: 'Pick from a spaghetti willow.' },
  { id: 'soba', name: 'Stream Soba', rarity: 'common', shape: 'straight', color: '#9a7b5b',
    desc: 'Swims upstream every spring. Very fit.', hint: 'Drink from the stream a few times.' },
  { id: 'matcha', name: 'Matcha Ribbon', rarity: 'common', shape: 'ribbon', color: '#9ccb6b',
    desc: 'Flat, green and a little bit fancy.', hint: 'Found in bricks in the woods.' },
  { id: 'bubble', name: 'Bubble Udon', rarity: 'rare', shape: 'bubble', color: '#e9f6ff',
    desc: 'So thick it floats. Pops when it laughs.', hint: 'Catch 12 bubbles in one swim.' },
  { id: 'dawn', name: 'Dawn Noodle', rarity: 'rare', shape: 'dawn', color: '#ffb38a',
    desc: 'Only exists for the first half hour of the day.', hint: 'Floats in the pool around 6:00 AM.' },
  { id: 'glass', name: 'Moonlight Glass Noodle', rarity: 'rare', shape: 'glass', color: '#c9f3ff',
    desc: 'You can read a book through it. At night it glows.', hint: 'Glows in the woods after 8 PM.' },
  { id: 'cloud', name: 'Curly Cloud Noodle', rarity: 'rare', shape: 'curl', color: '#ffffff',
    desc: 'Tastes like a nap on a sunny day.', hint: 'Solve a Fortune Cracker riddle.' },
  { id: 'macaroni', name: 'Mega Crunch Macaroni', rarity: 'rare', shape: 'macaroni', color: '#ffd23f',
    desc: 'Awarded to champions of the crunch.', hint: 'Reach a x5 crunch combo.' },
  { id: 'echo', name: 'Echo Ramen', rarity: 'legendary', shape: 'echo', color: '#b98cff',
    desc: 'Say its name and it says it back. Twice.', hint: 'Decode the noodle letters.' },
  { id: 'updown', name: 'Upside-Down Spaghetti', rarity: 'secret', shape: 'updown', color: '#ffe07a',
    desc: 'Falls up. Grandma planted it on purpose.', hint: 'Somewhere the rules are backwards.' },
  // Chapter 2: Crunch Canyon
  { id: 'crackle', name: 'Canyon Crackle', rarity: 'common', shape: 'crackle', color: '#e59866',
    desc: 'Baked in the canyon sun for a thousand years. Still fresh.', hint: 'Crunch the red bricks in Crunch Canyon.' },
  { id: 'mint', name: 'Mint Soba', rarity: 'common', shape: 'mint', color: '#9ff0c8',
    desc: 'Cool as a breeze. Makes your screen feel minty.', hint: 'Drink from the Minty Spring.' },
  { id: 'boulder', name: 'Boulder Ramen', rarity: 'rare', shape: 'boulder', color: '#c9784a',
    desc: 'Takes three crunches. Worth every one.', hint: 'Break a giant boulder brick.' },
  { id: 'rigatoni', name: 'Rhythm Rigatoni', rarity: 'rare', shape: 'rigatoni', color: '#e4572e',
    desc: 'Tube-shaped, so it plays a little tune when you blow in it.', hint: 'Make the canyon drum happy.' },
  { id: 'vermicelli', name: 'Mirror Vermicelli', rarity: 'legendary', shape: 'mirror', color: '#b7a6ff',
    desc: 'Its reflection is a different noodle. Nobody knows which one is real.', hint: 'Drink where the water lies.' },
  { id: 'slowudon', name: 'Slow Udon', rarity: 'rare', shape: 'slow', color: '#fff3d6',
    desc: 'The Udon Snail\'s favorite. Takes a week to slurp.', hint: 'Make friends with the Udon Snail.' },
];
const TOTAL_IN_UNIVERSE = 48;

// World size in pixels
const WORLD = { w: 2600, h: 2600 };

// Stream: centreline polyline, flows north to south
const STREAM = {
  width: 76,
  pts: [[1300, -40], [1270, 160], [1340, 340], [1300, 520], [1230, 700], [1290, 880], [1380, 1060], [1330, 1260], [1260, 1440], [1320, 1620], [1300, 1840], [1250, 2040], [1340, 2250], [1290, 2450], [1310, 2660]],
  bridges: [ { x: 1170, y: 668, w: 220, h: 64 }, { x: 1250, y: 1235, w: 190, h: 60 }, { x: 1200, y: 2215, w: 250, h: 60 } ],
  mirror: { x: 1370, y: 1060, rx: 120, ry: 64 }, // the Mirror Stream pond
};

const PLACES = {
  house: { x: 360, y: 380, w: 240, h: 170, door: { x: 480, y: 560 } },
  shop: { x: 760, y: 330, w: 250, h: 150, front: { x: 885, y: 500 }, poster: { x: 1020, y: 420 } },
  pool: { x: 320, y: 820, w: 360, h: 220, gate: { x: 500, y: 800 } },
  oracle: { x: 900, y: 860, r: 36 },
  willowBack: { x: 2250, y: 420 },
  spawn: { x: 480, y: 620 },
};

// Spaghetti willow trees
const WILLOWS = [
  [1560, 260], [1720, 200], [1900, 300], [2080, 210], [1640, 470], [1830, 560], [2020, 480],
  [1560, 760], [1760, 820], [1990, 760], [2200, 700], [2400, 560], [2380, 900], [1640, 1080],
  [1880, 1060], [2120, 1000], [2300, 1180], [1560, 1330], [1790, 1340], [2040, 1300], [2260, 1450], [2440, 1300],
  [150, 250], [120, 1200], [200, 1560], [980, 1600], [760, 150],
];

// Brick spawn points: meadow (south-west) and woods (east)
const BRICK_SPOTS = [
  [620, 1200], [760, 1260], [900, 1180], [560, 1360], [700, 1420], [860, 1380], [1020, 1300], [640, 1540],
  [820, 1560], [1000, 1480], [1080, 1120], [420, 1260], [960, 700], [1100, 480], [260, 700],
  [1700, 380], [1980, 620], [1700, 980], [2180, 880], [1940, 1180], [2380, 1060], [1690, 1500], [2150, 1560], [2460, 760],
  // Crunch Canyon (index 24+)
  [700, 2080], [760, 2200], [1080, 2020], [1120, 2480], [560, 2500], [1600, 2020], [1760, 2140],
  [2200, 2080], [2420, 2300], [1700, 2450], [2250, 2480], [2020, 2010],
];

// Crunch Canyon, south of the boulder wall
const CANYON = {
  top: 1880,
  wallY: 1860,
  gate: { x: 760, y: 1872 },
  rocks: [[260, 2060], [560, 2010], [880, 2130], [420, 2290], [1000, 2340], [1640, 2280], [2380, 2150]],
  trueRock: 3,
  drum: { x: 1980, y: 2300 },
  snail: { x: 780, y: 2440 },
  spring: { x: 300, y: 2440, rx: 90, ry: 48 },
  boulders: [[1520, 2360], [2330, 1990]],
};

// Glowing night noodle spots in the woods
const GLASS_SPOTS = [[1780, 700], [2100, 1120], [1650, 1210], [2330, 400]];

// Fortune Cracker riddles: each points to a landmark
const FORTUNES = [
  { text: 'Where the water wears a wooden hat, look underneath.', target: 'bridge', where: { x: 1280, y: 740 } },
  { text: 'Where Grandma\'s steam goes up, something shiny sits on the counter.', target: 'shop', where: { x: 885, y: 500 } },
  { text: 'The bowl that knows everything is hiding a coin under its chin.', target: 'oracle', where: { x: 900, y: 910 } },
  { text: 'Where you dream, check the doormat.', target: 'house', where: { x: 480, y: 575 } },
  { text: 'Three bricks in a row, then look where the smallest flower grows.', target: 'meadow', where: { x: 760, y: 1330 } },
];
const FORTUNE_SPAWNS = [[700, 1300], [1100, 1400], [1850, 900], [300, 1000], [1600, 600]];

// The cryptic hunt, chapter one
const CLUES = {
  pillow: {
    title: 'The Pillow Note', where: 'Under your pillow',
    text: 'When the sun is still yawning and the water is new,\ncount what lies under, and it will point you through.',
    hints: ['"The sun is still yawning" means very early in the morning.', 'Water that is new... the Morning Pool, right when it opens.', 'Swim in the pool between 6 and 8 AM and look at the floor tiles. Follow the arrows.'],
  },
  piece1: {
    title: 'Map Piece 1', where: 'Under the last pool tile',
    text: 'A torn drawing: a stream on the left, and a tree drawn upside down on the right.',
    hints: ['Where do the pool arrows point? East, across the stream.', 'Every willow hangs down. Look for one that doesn\'t.', 'The backwards willow is deep in the north-east of Spaghetti Woods. Crunch the brick at its roots.'],
  },
  cipher: {
    title: 'The Noodle Letters', where: 'Inside the golden root brick',
    text: 'A note written in noodle shapes. You can\'t read it... yet.',
    answer: 'ECHO CRUNCHES TWICE',
    hints: ['Grandma collects old signs. Maybe one of them is an alphabet.', 'Look at the poster on the side of Grandma\'s noodle stand.', 'Each shape is one letter. The first word is ECHO.'],
  },
};

Object.assign(CLUES, {
  canyon: {
    title: 'The Decoded Note', where: 'Your journal',
    text: 'ECHO CRUNCHES TWICE.\nSomewhere south, the rocks are listening.',
    hints: ['Crunch Canyon is south of the meadow. The boulder wall cracked when you decoded the note.', 'Crunch the tall rocks in the canyon. Most echo once. One echoes twice.', 'It is the tall rock just above the Minty Spring, in the west of the canyon.'],
  },
  piece3: {
    title: 'The Echo Rock', where: 'Behind the Echo Rock',
    text: 'The rock echoed: crunch · crunch · · · · CRUNCH.\nSomething in this canyon wants to hear that rhythm again.',
    hints: ['Look for something big you can hit that makes a sound.', 'A giant drum sits on the east side of the canyon, across the bridge.', 'At the drum: press twice quickly, wait about one second, then press once more.'],
  },
  piece4: {
    title: 'The Drum Note', where: 'Inside the Noodle Drum',
    text: 'Drink where the water lies.',
    hints: ['Water that lies does not tell the truth... like a mirror.', 'The stream widens into a shiny purple pond, south of the first bridge.', 'Drink from the purple Mirror Pond and look at the reflection.'],
  },
  mirror: {
    title: 'The Reflection', where: 'The Mirror Pond',
    text: 'UNDER THE SNAIL\'S HOUSE',
    hints: ['The words are backwards, like in a mirror. Read them from right to left.', 'It says: UNDER THE SNAIL\'S HOUSE. A snail\'s house is its shell.', 'The Udon Snail lives in the canyon. It only moves for someone who found the Dawn Noodle (pool, around 6 AM).'],
  },
});

// Noodle cipher: each letter A-Z is a noodle glyph (shape x dots x bar)
function glyphFor(letter) {
  const i = letter.charCodeAt(0) - 65;
  return { shape: i % 4, dots: Math.floor(i / 4) % 4, bar: Math.floor(i / 16) };
}
