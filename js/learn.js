// Learning while playing: Science Snacks (facts tied to what you just did) and the Brain Noodle quiz.
// Written for kids about 6-11 years old: short sentences, real facts, a "try it" to connect it to the game.

const SUBJECTS = {
  physics: { name: 'Physics', icon: '🍎' },
  chemistry: { name: 'Chemistry', icon: '🧪' },
  space: { name: 'Space', icon: '🪐' },
  nature: { name: 'Nature & body', icon: '🌱' },
  math: { name: 'Math', icon: '➗' },
  earth: { name: 'Earth & weather', icon: '🌍' },
};

// Each fact unlocks the first time its trigger happens in the game.
const FACTS = [
  { id: 'gravity', subject: 'physics', title: 'Gravity', trigger: 'hop',
    text: 'Gravity is a pull that brings things back down. The Earth pulls on you, and you pull a tiny bit on the Earth too!',
    tryit: 'Hop and watch how you always come back down.' },
  { id: 'moonjump', subject: 'space', title: 'Jumping on the Moon', trigger: 'hop3',
    text: 'The Moon\'s gravity is about 6 times weaker than Earth\'s. A jump that goes 1 step high here would go about 6 steps high on the Moon.',
    tryit: 'Count your hops. On the Moon you could hop over a house!' },
  { id: 'lift', subject: 'physics', title: 'How wings lift', trigger: 'fly',
    text: 'Wings push air down, and the air pushes the wings up. Birds and planes both use this push, called lift.',
    tryit: 'Hold FLY to flap. More flaps means more lift.' },
  { id: 'drag', subject: 'physics', title: 'Air slows falling', trigger: 'glide',
    text: 'Air pushes against things that move through it. This is called air resistance. It is why a feather falls slower than a pebble.',
    tryit: 'Stop flapping in the air. Your wings let you glide down slowly.' },
  { id: 'float', subject: 'physics', title: 'Why things float', trigger: 'swim',
    text: 'Water pushes up on anything in it. If that push is stronger than the thing\'s weight, it floats. This push is called buoyancy.',
    tryit: 'Swim in the pool. The water holds you up!' },
  { id: 'current', subject: 'earth', title: 'Rivers flow downhill', trigger: 'current',
    text: 'Gravity pulls water downhill, so streams always flow from high places to low places, and most rivers end in the sea.',
    tryit: 'Swim in the stream and feel the current push you south.' },
  { id: 'bodywater', subject: 'nature', title: 'You are full of water', trigger: 'drink',
    text: 'About 60% of a grown-up\'s body is water. You lose water when you breathe, sweat and play, so drinking often keeps you strong.',
    tryit: 'When the water bar gets low, Squareface gets slow. People do too!' },
  { id: 'sound', subject: 'physics', title: 'Sound is a wobble', trigger: 'crunch',
    text: 'Sound is a wobble (a vibration) that travels through the air to your ears. A crunch makes lots of tiny fast wobbles.',
    tryit: 'Crunch a brick and listen. That sound traveled through the air to you.' },
  { id: 'echo', subject: 'physics', title: 'Echoes', trigger: 'echo',
    text: 'An echo is sound that bounces off something hard, like a cliff, and comes back to you a moment later.',
    tryit: 'Crunch the tall canyon rocks. Some bounce the sound back more than once.' },
  { id: 'reflection', subject: 'physics', title: 'Mirror images', trigger: 'mirror',
    text: 'Still water and mirrors bounce light back to your eyes. That is why words look backwards in a mirror: left and right swap.',
    tryit: 'Drink at the Mirror Pond and look at your reflection.' },
  { id: 'heat', subject: 'chemistry', title: 'Cooking is chemistry', trigger: 'cook',
    text: 'Heat changes food. When an egg cooks, its clear part turns white and firm, and it can never change back. That is a chemical change.',
    tryit: 'Cook a recipe with Grandma. Mixing and heating makes something new.' },
  { id: 'dissolve', subject: 'chemistry', title: 'Dissolving', trigger: 'cook2',
    text: 'Salt and sugar seem to disappear in water, but they are still there, just in tiny pieces. This is called dissolving. Soup broth is full of dissolved flavors.',
    tryit: 'Cook two different recipes.' },
  { id: 'photosynthesis', subject: 'nature', title: 'Plants make food from light', trigger: 'shake',
    text: 'Plants use sunlight, water and air to make their own food. This is called photosynthesis. It also makes the oxygen we breathe!',
    tryit: 'Shake a tree. All that food grew using sunlight.' },
  { id: 'seeds', subject: 'nature', title: 'Fruit carries seeds', trigger: 'shake5',
    text: 'Many fruits hold seeds. When animals eat fruit and drop the seeds somewhere else, new plants can grow there.',
    tryit: 'Shake 5 trees. Trees grow new fruit every morning here.' },
  { id: 'rocket', subject: 'physics', title: 'How rockets fly', trigger: 'rocket',
    text: 'A rocket pushes hot gas down, and the gas pushes the rocket up. Every push has an equal push back. This is Newton\'s third law.',
    tryit: 'Launch the Noodle Rocket from the pad in Crunch Meadow.' },
  { id: 'zerog', subject: 'space', title: 'Floating in space', trigger: 'space',
    text: 'In space there is almost no air to slow you down. Once you start moving, you keep drifting until something pushes you the other way.',
    tryit: 'Steer the rocket and let go. It keeps gliding!' },
  { id: 'stars', subject: 'space', title: 'Stars are suns', trigger: 'space2',
    text: 'Every star you see at night is a sun, and many are much bigger than ours. They look tiny because they are very, very far away.',
    tryit: 'Catch the Guide Stars in a daydream.' },
  { id: 'comets', subject: 'space', title: 'Comets', trigger: 'comet',
    text: 'Comets are big balls of ice and dust. When they fly near the Sun, the ice turns to gas and makes a long glowing tail.',
    tryit: 'Bump into a comet in space.' },
  { id: 'dayNight', subject: 'earth', title: 'Day and night', trigger: 'night',
    text: 'The Earth spins around once every 24 hours. When your side faces the Sun it is day; when it faces away, it is night.',
    tryit: 'Play until the sky turns dark.' },
  { id: 'sunrise', subject: 'earth', title: 'Sunrise', trigger: 'dawn',
    text: 'The Sun does not really rise. The Earth spins toward it, so the Sun seems to come up in the east every morning.',
    tryit: 'Swim in the Morning Pool at 6 AM.' },
  { id: 'lightning', subject: 'earth', title: 'Lightning and thunder', trigger: 'storm',
    text: 'Lightning is a giant spark of electricity. Thunder is its sound. Light is faster than sound, so count the seconds between them: every 3 seconds is about 1 kilometer away.',
    tryit: 'Visit the Soba Peaks on a stormy afternoon.' },
  { id: 'altitude', subject: 'earth', title: 'Mountains are cold', trigger: 'snow',
    text: 'The higher you go, the thinner and colder the air gets. That is why mountain tops have snow even in summer.',
    tryit: 'Climb to the snowy top of the Soba Peaks.' },
  { id: 'ice', subject: 'chemistry', title: 'Water freezes', trigger: 'ice',
    text: 'Water turns into ice at 0 °C. Ice is lighter than water, so it floats. That is why lakes freeze on top first.',
    tryit: 'Swim in the icy mountain lake.' },
  { id: 'mint', subject: 'nature', title: 'Why mint feels cold', trigger: 'mint',
    text: 'Mint has a substance called menthol. It tricks the cold-sensors in your mouth, so it feels cool even when it is not.',
    tryit: 'Drink from the Minty Spring.' },
  { id: 'multiply', subject: 'math', title: 'Multiplying is fast adding', trigger: 'combo',
    text: 'x3 means "3 times". 3 × 4 is the same as 4 + 4 + 4 = 12. Multiplying is a quick way to add the same number again and again.',
    tryit: 'Get a x3 crunch combo.' },
  { id: 'chance', subject: 'math', title: 'Chances', trigger: 'shiny',
    text: 'A 1 in 40 chance means that, on average, it happens once every 40 tries. It could happen on the 1st try or the 100th!',
    tryit: 'Keep crunching and shaking trees to find shiny noodles.' },
  { id: 'money', subject: 'math', title: 'Saving up', trigger: 'buy',
    text: 'When you buy something, you subtract its price from your coins. Saving means waiting until you have enough for something you really want.',
    tryit: 'Buy something in Grandma\'s shop and check the math.' },
  { id: 'compass', subject: 'earth', title: 'North, south, east, west', trigger: 'map',
    text: 'On most maps north is up, south is down, east is right and west is left. A compass needle always points north.',
    tryit: 'Open the map. The Soba Peaks are east of the village.' },
  { id: 'snail', subject: 'nature', title: 'Snails are slow', trigger: 'snail',
    text: 'A garden snail moves about 1 millimeter each second. It would take it about 3 hours to cross a football field!',
    tryit: 'Talk to the Udon Snail. Its trip to the mountains takes a week.' },
  { id: 'birds', subject: 'nature', title: 'Hollow bones', trigger: 'bird',
    text: 'Birds have hollow bones, which makes them light enough to fly. Their feathers help them steer and stay warm.',
    tryit: 'Visit the Soba Birds\' nest in the mountains.' },
];

const FACT_BY_TRIGGER = {};
FACTS.forEach(f => { (FACT_BY_TRIGGER[f.trigger] = FACT_BY_TRIGGER[f.trigger] || []).push(f); });

// Brain Noodle quiz: questions with 3 answers. `a` is the index of the right answer.
const QUIZ_BANK = [
  { s: 'physics', q: 'What pulls things back down when you jump?', o: ['Gravity', 'Wind', 'Magic'], a: 0, why: 'Gravity pulls everything toward the ground.' },
  { s: 'physics', q: 'Why does a boat float?', o: ['It is very light', 'Water pushes it up', 'It is painted blue'], a: 1, why: 'Water pushes up on the boat. That push is called buoyancy.' },
  { s: 'physics', q: 'What is an echo?', o: ['Sound bouncing back', 'A kind of bird', 'Very loud music'], a: 0, why: 'An echo is sound that bounces off a hard surface and comes back.' },
  { s: 'physics', q: 'Which falls more slowly through air?', o: ['A pebble', 'A feather', 'They fall the same'], a: 1, why: 'Air pushes against the light, wide feather much more than the pebble.' },
  { s: 'physics', q: 'Which is faster?', o: ['Light', 'Sound', 'A snail'], a: 0, why: 'Light is the fastest thing there is. That is why you see lightning before you hear thunder.' },
  { s: 'physics', q: 'How does a rocket go up?', o: ['It pushes gas down', 'It is pulled by a rope', 'It floats on clouds'], a: 0, why: 'The rocket pushes gas down, and the gas pushes the rocket up.' },
  { s: 'chemistry', q: 'At what temperature does water freeze?', o: ['0 °C', '50 °C', '100 °C'], a: 0, why: 'Water turns into ice at 0 °C and boils at 100 °C.' },
  { s: 'chemistry', q: 'What happens to salt stirred into water?', o: ['It disappears forever', 'It dissolves into tiny pieces', 'It turns into sugar'], a: 1, why: 'It dissolves: it breaks into pieces too small to see, but it is still there.' },
  { s: 'chemistry', q: 'Can a cooked egg become a raw egg again?', o: ['Yes, if you cool it', 'No, cooking changed it', 'Only on Tuesdays'], a: 1, why: 'Heat caused a chemical change. It can never go back.' },
  { s: 'chemistry', q: 'What is steam?', o: ['Water as a gas', 'A kind of smoke', 'Hot air only'], a: 0, why: 'When water boils, it turns into a gas called water vapor, or steam.' },
  { s: 'chemistry', q: 'Does ice float or sink in water?', o: ['It floats', 'It sinks', 'It melts instantly'], a: 0, why: 'Ice is a little lighter than water, so it floats.' },
  { s: 'space', q: 'What is the Sun?', o: ['A star', 'A planet', 'A moon'], a: 0, why: 'The Sun is a star, the closest one to Earth.' },
  { s: 'space', q: 'How many planets go around our Sun?', o: ['5', '8', '12'], a: 1, why: 'There are 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune.' },
  { s: 'space', q: 'Which is the biggest planet?', o: ['Earth', 'Mars', 'Jupiter'], a: 2, why: 'Jupiter is so big that more than 1,000 Earths could fit inside it.' },
  { s: 'space', q: 'Where would you jump highest?', o: ['On Earth', 'On the Moon', 'On Jupiter'], a: 1, why: 'The Moon has weaker gravity, so you could jump about 6 times higher.' },
  { s: 'space', q: 'Which planet is called the Red Planet?', o: ['Mars', 'Venus', 'Neptune'], a: 0, why: 'Mars looks red because of rusty dust on its ground.' },
  { s: 'space', q: 'What makes day and night?', o: ['The Earth spinning', 'Clouds covering the Sun', 'The Moon blocking light'], a: 0, why: 'The Earth spins once a day, so each side faces the Sun, then faces away.' },
  { s: 'nature', q: 'What do plants need to make food?', o: ['Sunlight, water and air', 'Only music', 'Candy'], a: 0, why: 'Plants make food from sunlight, water and air. This is photosynthesis.' },
  { s: 'nature', q: 'What gas do plants give us to breathe?', o: ['Oxygen', 'Smoke', 'Helium'], a: 0, why: 'Plants release oxygen, which people and animals need to breathe.' },
  { s: 'nature', q: 'About how much of your body is water?', o: ['A tiny bit', 'More than half', 'None'], a: 1, why: 'More than half of your body is water. That is why drinking matters!' },
  { s: 'nature', q: 'Why can birds fly so easily?', o: ['Hollow, light bones', 'Very heavy feet', 'They eat noodles'], a: 0, why: 'Hollow bones make birds light, and wings give them lift.' },
  { s: 'nature', q: 'Which of these is a mammal?', o: ['A whale', 'A shark', 'A goldfish'], a: 0, why: 'Whales breathe air and feed their babies milk, so they are mammals.' },
  { s: 'earth', q: 'Which way do rivers flow?', o: ['Uphill', 'Downhill', 'In circles'], a: 1, why: 'Gravity pulls water downhill, all the way to lakes and seas.' },
  { s: 'earth', q: 'Why is it cold on top of high mountains?', o: ['The air is thinner', 'It is closer to the Moon', 'Snow likes it there'], a: 0, why: 'Higher up, the air is thinner and holds less heat.' },
  { s: 'earth', q: 'On a map, which way is north usually?', o: ['Up', 'Down', 'Left'], a: 0, why: 'Most maps put north at the top.' },
  { s: 'earth', q: 'You see lightning and hear thunder 6 seconds later. How far is the storm?', o: ['About 2 km', 'About 20 km', 'Right on top of you'], a: 0, why: 'Sound travels about 1 km every 3 seconds. 6 ÷ 3 = 2 km.' },
];

// Math questions are made fresh every time, with noodle-flavored stories, harder as you level up.
function makeMathQuestion(rnd, level) {
  const r = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const kinds = level < 3 ? ['add', 'sub'] : level < 6 ? ['add', 'sub', 'mul'] : ['add', 'sub', 'mul', 'div', 'half'];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  let q, ans;
  if (kind === 'add') { const a = r(2, 9 + level * 3), b = r(2, 9 + level * 2); q = `You crunch ${a} bricks, then ${b} more. How many bricks in total?`; ans = a + b; }
  if (kind === 'sub') { const a = r(10, 20 + level * 5), b = r(2, a - 1); q = `You have ${a} coins and buy a hat for ${b}. How many coins are left?`; ans = a - b; }
  if (kind === 'mul') { const a = r(2, 5 + level), b = r(2, 6); q = `There are ${a} egg trees with ${b} eggs each. How many eggs?`; ans = a * b; }
  if (kind === 'div') { const b = r(2, 5), ans0 = r(2, 6 + level); q = `Grandma shares ${b * ans0} dumplings equally among ${b} friends. How many does each friend get?`; ans = ans0; }
  if (kind === 'half') { const a = r(2, 10 + level) * 2; q = `Half of the ${a} noodles are shiny. How many are shiny?`; ans = a / 2; }
  const opts = new Set([ans]);
  while (opts.size < 3) { const d = ans + (rnd() < 0.5 ? -1 : 1) * r(1, Math.max(2, Math.round(ans / 4))); if (d >= 0) opts.add(d); }
  const o = [...opts].sort(() => rnd() - 0.5).map(String);
  return { s: 'math', q, o, a: o.indexOf(String(ans)), why: `The answer is ${ans}.` + (kind === 'mul' ? ' Multiplying is fast adding!' : kind === 'div' ? ' Sharing equally is dividing.' : '') };
}
