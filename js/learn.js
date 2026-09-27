// Learning while playing: Science Snacks (facts tied to what you just did) and the Brain Noodle quiz.
// Written for kids about 6-11 years old: short sentences, real facts, a "try it" to connect it to the game.

const SUBJECTS = {
  physics: { name: 'Physics', icon: '🍎' },
  chemistry: { name: 'Chemistry', icon: '🧪' },
  space: { name: 'Space', icon: '🪐' },
  nature: { name: 'Nature & body', icon: '🌱' },
  math: { name: 'Math', icon: '➗' },
  earth: { name: 'Earth & weather', icon: '🌍' },
  money: { name: 'Money & business', icon: '🪙' },
  civics: { name: 'Town & government', icon: '🏛️' },
  tools: { name: 'Building & tools', icon: '🔨' },
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

// Small World: how the real world works
FACTS.push(
  { id: 'wage', subject: 'money', title: 'Earning a wage', trigger: 'wage',
    text: 'When you work, you earn a wage. People trade their time and skills for money.', tryit: 'Get a job at the Job Center in Small Town.' },
  { id: 'tax', subject: 'civics', title: 'What taxes do', trigger: 'tax',
    text: 'Taxes are money everyone gives to the town. The town uses it for things we all share: roads, lights, parks and schools.', tryit: 'Look at the treasury in the Town Hall.' },
  { id: 'interest', subject: 'money', title: 'Interest', trigger: 'interest',
    text: 'A bank pays you interest for keeping your money there, so savings grow a little every day. Big savings grow faster!', tryit: 'Put coins in the Bank and check again tomorrow.' },
  { id: 'loan', subject: 'money', title: 'Loans', trigger: 'loan',
    text: 'A loan lets you buy something now, but you pay back more later. The extra money is interest, and it grows every day until you pay.', tryit: 'Ask Banker Penny about loans.' },
  { id: 'supply', subject: 'money', title: 'Supply and demand', trigger: 'supply',
    text: 'When lots of people sell the same thing, its price goes down. When something is rare, its price goes up.', tryit: 'Sell 10 carrots and watch the Market price change.' },
  { id: 'profit', subject: 'money', title: 'Profit', trigger: 'profit',
    text: 'Profit is what you earn minus what you spent. A carrot seed costs 2 coins; if the carrot sells for 7, your profit is 5.', tryit: 'Grow crops on your farm and sell them.' },
  { id: 'forest', subject: 'nature', title: 'Forests need planting', trigger: 'chop',
    text: 'Forests grow back only when trees are planted. Cutting without planting leaves the land bare, and animals lose their homes.', tryit: 'Plant a sapling on a stump in the town forest.' },
  { id: 'vote', subject: 'civics', title: 'Democracy', trigger: 'vote',
    text: 'In a democracy, people vote to choose their leaders and decide together what their town builds.', tryit: 'Vote for a project at the Town Hall.' },
  { id: 'rent', subject: 'money', title: 'Rent or own?', trigger: 'rent',
    text: 'Rent is what you pay to live in a home someone else owns. Own your home and there is no rent, but you pay property tax.', tryit: 'Build your own house on a lot.' },
  { id: 'land', subject: 'money', title: 'Why land has a price', trigger: 'land',
    text: 'Land can earn money: farms grow food to sell, and shops sell to customers. That is why people pay for it.', tryit: 'Buy a plot of land in Small Town.' },
  { id: 'momentum', subject: 'physics', title: 'Momentum', trigger: 'kick',
    text: 'A moving thing keeps moving until something stops it. When you run into a ball, your momentum passes to it. Heavier and faster means a bigger push!', tryit: 'Run into a ball fast, then slowly.' },
  { id: 'falling', subject: 'physics', title: 'Falling faster and faster', trigger: 'fall',
    text: 'Gravity makes falling things speed up. A chopped tree starts to tip slowly, then crashes down fast.', tryit: 'Watch the next tree you chop.' },
  { id: 'float', subject: 'physics', title: 'Why things float', trigger: 'swim',
    text: 'Water pushes up on things in it. That push is called buoyancy. A beach ball floats because it is light for its size.', tryit: 'Kick a beach ball into the sea.' },
  { id: 'slope', subject: 'physics', title: 'Going uphill', trigger: 'hill',
    text: 'Walking uphill is slow because you lift your weight against gravity. Downhill, gravity helps, so balls roll down by themselves.', tryit: 'Walk up and down a hill.' },
  { id: 'brakes', subject: 'physics', title: 'Stopping takes time', trigger: 'drive',
    text: 'Fast things need distance to stop. That is why cars brake early and buses slow down before the stop.', tryit: 'Drive fast, then let go.' },
  { id: 'watercycle', subject: 'earth', title: 'The water cycle', trigger: 'rain',
    text: 'The Sun warms water, it rises as vapor, forms clouds, and falls as rain. Rain waters every farm for free!', tryit: 'Watch the crops when it rains.' },
  { id: 'upkeep', subject: 'money', title: 'Owning costs money', trigger: 'upkeep',
    text: 'A car costs money every day: fuel, insurance and repairs. Before you buy, ask: how much will it cost to keep?', tryit: 'Look at your morning budget.' },
  { id: 'publictransport', subject: 'civics', title: 'Public transport', trigger: 'fare',
    text: 'Buses and trains carry many people at once. Fares and taxes pay for them, and they make less traffic and pollution.', tryit: 'Ride the bus or the train.' },
  { id: 'business', subject: 'money', title: 'Running a company', trigger: 'company',
    text: 'A company earns revenue from customers and pays costs like wages and rent. What is left is profit. If costs are bigger, it is a loss.', tryit: 'Check your company in the morning budget.' },
  { id: 'audience', subject: 'money', title: 'Growing an audience', trigger: 'video',
    text: 'Creators earn when many people watch. New and interesting videos bring new subscribers, and subscribers come back every day.', tryit: 'Film somewhere new.' },
  { id: 'fees', subject: 'money', title: 'Platform fees', trigger: 'online',
    text: 'Online shops can sell to the whole world, but the website keeps a small fee from each sale, like 10%.', tryit: 'List something in your online store.' },
  { id: 'citygrowth', subject: 'civics', title: 'How towns grow', trigger: 'grow',
    text: 'When people work, pay taxes and build, a town can afford new roads, stations and districts. Everyone helps it grow.', tryit: 'Look east: a new district just opened!' },
);

FACTS.push(
  { id: 'sleep', subject: 'nature', title: 'Sleep helps you grow', trigger: 'sleep',
    text: 'While you sleep, your brain saves what you learned today and your body grows. Kids need about 10 hours of sleep.', tryit: 'Go to bed at night in Small Town.' },
  { id: 'kidtax', subject: 'civics', title: 'The Mayor pays your tax', trigger: 'kidtax',
    text: 'Grown-ups give a little of every wage to the town. That is called tax. Until you are 9, the Mayor pays it for you, so the town still grows!', tryit: 'Finish a job shift.' },
);

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
function makeMathQuestion(rnd, level, nOpts = 3) {
  const r = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const kinds = level < 3 ? ['add', 'sub'] : level < 6 ? ['add', 'sub', 'mul'] : ['add', 'sub', 'mul', 'div', 'half', 'pct', 'pct'];
  const kind = kinds[Math.floor(rnd() * kinds.length)];
  let q, ans;
  if (kind === 'add') { const a = r(2, 9 + level * 3), b = r(2, 9 + level * 2); q = `You crunch ${a} bricks, then ${b} more. How many bricks in total?`; ans = a + b; }
  if (kind === 'sub') { const a = r(10, 20 + level * 5), b = r(2, a - 1); q = `You have ${a} coins and buy a hat for ${b}. How many coins are left?`; ans = a - b; }
  if (kind === 'mul') { const a = r(2, 5 + level), b = r(2, 6); q = `There are ${a} egg trees with ${b} eggs each. How many eggs?`; ans = a * b; }
  if (kind === 'div') { const b = r(2, 5), ans0 = r(2, 6 + level); q = `Grandma shares ${b * ans0} dumplings equally among ${b} friends. How many does each friend get?`; ans = ans0; }
  if (kind === 'half') { const a = r(2, 10 + level) * 2; q = `Half of the ${a} noodles are shiny. How many are shiny?`; ans = a / 2; }
  if (kind === 'pct') { const p = [10, 20, 25, 50][r(0, 3)], base = p === 25 ? r(1, 8) * 4 : r(2, 12) * 10; q = `Income tax is ${p}%. What is ${p}% of a ${base}-coin wage?`; ans = base * p / 100; }
  const opts = new Set([ans]);
  while (opts.size < nOpts) { const d = ans + (rnd() < 0.5 ? -1 : 1) * r(1, Math.max(2, Math.round(ans / 4))); if (d >= 0) opts.add(d); }
  const o = [...opts].sort(() => rnd() - 0.5).map(String);
  return { s: 'math', q, o, a: o.indexOf(String(ans)), why: `The answer is ${ans}.` + (kind === 'mul' ? ' Multiplying is fast adding!' : kind === 'div' ? ' Sharing equally is dividing.' : kind === 'pct' ? ' Percent means "out of 100".' : '') };
}
// For 6-8 year olds: count pictures, two big answers, sums up to 10
function makePictureMath(rnd) {
  const r = (a, b) => a + Math.floor(rnd() * (b - a + 1)), E = ['🍎', '🥕', '🐟', '⭐', '🪙'][r(0, 4)];
  const add = rnd() < 0.6, a = r(1, 5), b = add ? r(1, 5) : r(1, a);
  const ans = add ? a + b : a - b, wrong = ans === 0 ? 1 : rnd() < 0.5 ? ans + 1 : ans - 1;
  const o = rnd() < 0.5 ? [ans, wrong] : [wrong, ans];
  return { s: 'math', q: '', pic: add ? `${E.repeat(a)} + ${E.repeat(b)}` : `${E.repeat(a)} − ${E.repeat(b)}`, o: o.map(String), a: o.indexOf(ans), why: `${a} ${add ? '+' : '−'} ${b} = ${ans}` };
}
// For 6-8 year olds: picture questions with two big answers
const PIC_BANK = {
  money: [
    { pic: '🪙🪙🪙 − 🪙', o: ['🪙🪙', '🪙🪙🪙🪙'], a: 0, why: '3 − 1 = 2 coins.' },
    { pic: '💼 → ?', o: ['🪙', '🍭'], a: 0, why: 'Work pays coins!' },
    { pic: '🐷 + 🪙 → ?', o: ['🐷📈', '🐷💥'], a: 0, why: 'Saved coins grow in the bank.' },
    { pic: '🌱🪙 → 🥕🪙🪙🪙', o: ['😀', '😢'], a: 0, why: 'Sell for more than it cost: that is profit!' },
    { pic: '🧺 🥕 → ?', o: ['🪙', '🪨'], a: 0, why: 'The market buys your crops for coins.' },
    { pic: '👛 🪙🪙 − 🍦 🪙', o: ['🪙', '🪙🪙🪙'], a: 0, why: '2 − 1 = 1 coin left.' },
  ],
  civics: [
    { pic: '🏛️ 🪙 → ?', o: ['🏫 🛣️ 🌳', '🍬'], a: 0, why: 'Taxes build schools, roads and parks.' },
    { pic: '🗳️ → ?', o: ['👑', '🍕'], a: 0, why: 'Votes choose the mayor.' },
    { pic: '🚮 → ?', o: ['🗑️', '🌳'], a: 0, why: 'Litter goes in the bin.' },
    { pic: '🚦🔴 → ?', o: ['🛑', '🏃'], a: 0, why: 'Red means stop.' },
    { pic: '🤝 → ?', o: ['😊', '😠'], a: 0, why: 'Helping makes friends happy.' },
    { pic: '🏥 → ?', o: ['🧑‍⚕️', '🧑‍🍳'], a: 0, why: 'Doctors work at the clinic.' },
  ],
  tools: [
    { pic: '🔩 → ?', o: ['🔧', '🥄'], a: 0, why: 'A wrench turns bolts.' },
    { pic: '🏠 ← ?', o: ['🪵', '🧊'], a: 0, why: 'Houses are built from wood.' },
    { pic: '📌 → ?', o: ['🔨', '🍌'], a: 0, why: 'A hammer drives nails.' },
    { pic: '🌳 → ?', o: ['🪓', '✏️'], a: 0, why: 'An axe chops trees.' },
    { pic: '📏 → ?', o: ['📐', '🧸'], a: 0, why: 'Rulers measure things.' },
    { pic: '🪵🪵🪵 + 🔨 → ?', o: ['🏠', '🚀'], a: 0, why: 'Wood and a hammer build a house.' },
  ],
  science: [
    { pic: '🌱 + ☀️ + 💧', o: ['🌳', '🧊'], a: 0, why: 'Plants need sun and water to grow.' },
    { pic: '🧊 + 🔥', o: ['💧', '🪨'], a: 0, why: 'Ice melts into water.' },
    { pic: '🐟 → ?', o: ['💧', '🌵'], a: 0, why: 'Fish live in water.' },
    { pic: '🌙 → ?', o: ['😴', '🏫'], a: 0, why: 'Night is for sleeping.' },
    { pic: '🐛 → ?', o: ['🦋', '🐘'], a: 0, why: 'A caterpillar becomes a butterfly.' },
    { pic: '☁️ → ?', o: ['🌧️', '🍩'], a: 0, why: 'Clouds bring rain.' },
  ],
};

// Small World classes: questions for three age groups (b: 1 = 6-8, 2 = 9-12, 3 = 13-16)
const CLASS_BANK = {
  money: [
    { b: 1, q: 'You have 10 coins and buy a carrot for 3. How many are left?', o: ['7', '13', '3'], a: 0, why: 'Spending takes coins away: 10 − 3 = 7.' },
    { b: 1, q: 'What is a wage?', o: ['Money you earn for working', 'A kind of vegetable', 'A kind of tax'], a: 0, why: 'A wage is what you are paid for your work.' },
    { b: 1, q: 'Why keep money in a bank?', o: ['It is safe and grows with interest', 'Banks eat money', 'To lose it'], a: 0, why: 'Banks keep money safe and pay you a little interest.' },
    { b: 1, q: 'Seeds cost 2 coins. The carrot sells for 7. What is your profit?', o: ['5 coins', '9 coins', '2 coins'], a: 0, why: 'Profit = what you sell for − what it cost: 7 − 2 = 5.' },
    { b: 2, q: 'Lots of farmers sell tomatoes at the same time. What happens to the price?', o: ['It goes down', 'It goes up', 'It never changes'], a: 0, why: 'Lots of supply and the same demand make the price drop.' },
    { b: 2, q: 'You save 100 coins. The bank pays 2% a day. How much interest after one day?', o: ['2 coins', '20 coins', '200 coins'], a: 0, why: '2% means 2 out of every 100.' },
    { b: 2, q: 'What is a loan?', o: ['Money you borrow and pay back with interest', 'Free money', 'A kind of shop'], a: 0, why: 'Loans must be paid back, plus interest.' },
    { b: 2, q: 'A shop earns 30 coins and pays 10% tax. How much tax?', o: ['3 coins', '10 coins', '30 coins'], a: 0, why: '10% of 30 is 3.' },
    { b: 2, q: 'What is a budget?', o: ['A plan for spending and saving', 'A big bag', 'A bank robber'], a: 0, why: 'A budget helps you plan so you do not run out of money.' },
    { b: 3, q: 'You borrow 100 coins at 5% simple interest per day. What do you owe after 2 days?', o: ['110 coins', '105 coins', '200 coins'], a: 0, why: '5% of 100 is 5 a day. 2 days = 10. 100 + 10 = 110.' },
    { b: 3, q: 'Your shop sells 80 coins of goods that cost you 50. What is the profit?', o: ['30 coins', '130 coins', '50 coins'], a: 0, why: 'Profit = revenue − costs = 80 − 50.' },
    { b: 3, q: 'What is inflation?', o: ['Prices going up over time', 'Filling balloons', 'A bank closing'], a: 0, why: 'With inflation the same coins buy a little less each year.' },
    { b: 3, q: 'Why do people invest in land?', o: ['It can earn money and grow in value', 'Land is always free', 'To make it rain'], a: 0, why: 'Farms, shops and rent can earn money from land.' },
  ],
  civics: [
    { b: 1, q: 'What do taxes pay for?', o: ['Things we share: roads, schools, parks', 'The mayor\'s candy', 'Nothing'], a: 0, why: 'Taxes pay for public things everyone uses.' },
    { b: 1, q: 'Who leads a town after an election?', o: ['The mayor', 'The baker', 'The dog'], a: 0, why: 'Citizens vote to choose a mayor.' },
    { b: 1, q: 'Why do we have rules (laws)?', o: ['To keep everyone safe and fair', 'To make people sad', 'For no reason'], a: 0, why: 'Laws help people live together safely.' },
    { b: 1, q: 'What is voting?', o: ['A way to choose together', 'A kind of boat', 'A secret food'], a: 0, why: 'Voting lets everyone have a say.' },
    { b: 2, q: 'Why must lumberjacks plant new trees?', o: ['So the forest does not disappear', 'Trees are ugly', 'To hide logs'], a: 0, why: 'Using nature carefully so it lasts is called sustainability.' },
    { b: 2, q: 'If a town raises taxes, what happens?', o: ['More money for projects, less for people', 'Everyone gets richer', 'Nothing'], a: 0, why: 'Taxes move money from people to shared projects. Leaders must balance both.' },
    { b: 2, q: 'What is public property?', o: ['Things the whole town owns, like parks', 'Your backpack', 'A secret room'], a: 0, why: 'Public property belongs to everyone together.' },
    { b: 2, q: 'In an election, who wins?', o: ['The person with the most votes', 'The tallest person', 'Whoever came first'], a: 0, why: 'Most votes wins. That is majority rule.' },
    { b: 3, q: 'Why is a secret ballot important?', o: ['People can vote freely without pressure', 'So nobody votes', 'It is faster'], a: 0, why: 'Secret votes protect people from being pushed or punished.' },
    { b: 3, q: 'A town spends more than it collects. What is that called?', o: ['A deficit', 'A surplus', 'A festival'], a: 0, why: 'Spending more than income is a deficit. Having extra is a surplus.' },
    { b: 3, q: 'What is democracy?', o: ['People choose leaders by voting', 'One king decides everything', 'The richest person rules'], a: 0, why: 'Democracy means power comes from the people.' },
    { b: 3, q: 'Why do towns pay for schools with taxes?', o: ['Educated people can do more and help everyone', 'Schools make money for the mayor', 'Only to keep kids busy'], a: 0, why: 'Education helps the whole town grow.' },
  ],
  tools: [
    { b: 1, q: 'Which tool pushes in nails?', o: ['A hammer', 'A spoon', 'A brush'], a: 0, why: 'Hammers drive nails into wood.' },
    { b: 1, q: 'What are houses in Small Town built from?', o: ['Wood (logs)', 'Ice', 'Paper'], a: 0, why: 'Builders use logs from the forest.' },
    { b: 1, q: 'Before you cut wood, you should...', o: ['Measure it', 'Paint it', 'Eat it'], a: 0, why: 'Measure twice, cut once!' },
    { b: 2, q: 'A wall is 4 m long and 3 m high. What is its area?', o: ['12 square meters', '7 square meters', '43 square meters'], a: 0, why: 'Area = length × height = 4 × 3.' },
    { b: 2, q: 'Why do roofs and bridges use triangles?', o: ['Triangles are strong and do not bend', 'They look like pizza', 'Paint sticks better'], a: 0, why: 'A triangle keeps its shape when pushed.' },
    { b: 2, q: 'Which simple machine helps lift heavy things?', o: ['A lever', 'A pillow', 'A sock'], a: 0, why: 'A lever turns a small push into a big lift.' },
    { b: 3, q: 'A house needs 12 logs. You have 5. Logs cost 8 coins. What do the rest cost?', o: ['56 coins', '96 coins', '40 coins'], a: 0, why: '12 − 5 = 7 logs. 7 × 8 = 56.' },
    { b: 3, q: 'A room is 5 m by 4 m. How big is the floor?', o: ['20 square meters', '9 square meters', '18 square meters'], a: 0, why: '5 × 4 = 20.' },
    { b: 3, q: 'What does a builder\'s level tool check?', o: ['That something is perfectly flat', 'How heavy it is', 'Which floor you are on'], a: 0, why: 'A bubble in the middle means level.' },
  ],
};
// n questions for a class, fitted to the player's age group
function classQuestions(subject, band, n = 3) {
  const shuffle = (a) => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  const mix = (q) => { const order = shuffle(q.o.map((_, i) => i)); return { ...q, o: order.map(i => q.o[i]), a: order.indexOf(q.a) }; };
  // 6-8: pictures and two big answers
  if (band === 1) {
    if (subject === 'math') return Array.from({ length: n }, () => makePictureMath(Math.random));
    const pics = PIC_BANK[subject] || PIC_BANK.science;
    return shuffle(pics).slice(0, n).map(q => ({ s: subject, q: '', ...mix(q) }));
  }
  if (subject === 'math') return Array.from({ length: n }, () => makeMathQuestion(Math.random, band === 3 ? 6 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2), band === 3 ? 4 : 3));
  if (subject === 'science') return shuffle(QUIZ_BANK).slice(0, n);
  const bank = CLASS_BANK[subject] || [];
  const fit = bank.filter(q => q.b === band), easier = bank.filter(q => q.b < band);
  return shuffle(fit).concat(shuffle(easier)).slice(0, n).map(q => ({ s: subject === 'tools' ? 'tools' : subject, ...mix(q) }));
}
