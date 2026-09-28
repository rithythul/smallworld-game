// The Noodle-dex: noodles from the Noodle Universe, now found all over Small World.
// Crunch the golden noodle bricks in every town (they come back every morning) and do the little things below.
// shape and color are drawn by drawNoodleIcon (js/art.js). kind = found by crunching bricks in that kind of town.
const NOODLE_DEX = [
  { id: 'brick', name: 'Crunchy Ramen Brick', rarity: 'common', shape: 'brick', color: '#f4c35a', hint: 'Crunch any noodle brick.' },
  { id: 'crinkle', name: 'Crinkle Crisp', rarity: 'common', shape: 'zig', color: '#f09a3e', hint: 'Sometimes hides inside a brick.' },
  { id: 'neon', name: 'Neon Lo Mein', rarity: 'rare', shape: 'zig', color: '#5b7cfa', kind: 'downtown', hint: 'Crunch bricks in a Downtown.' },
  { id: 'bowtie', name: 'Bowtie Ribbon', rarity: 'common', shape: 'ribbon', color: '#ff8fb1', kind: 'uptown', hint: 'Crunch bricks in an Uptown.' },
  { id: 'vine', name: 'Spaghetti Vine', rarity: 'common', shape: 'wave', color: '#f7dc7a', kind: 'rural', hint: 'Crunch bricks in a farm town.' },
  { id: 'foam', name: 'Sea Foam Curl', rarity: 'common', shape: 'curl', color: '#ffffff', kind: 'beach', hint: 'Crunch bricks in a beach town.' },
  { id: 'somen', name: 'Snowy Somen', rarity: 'common', shape: 'snow', color: '#f4f7fb', kind: 'mountain', hint: 'Crunch bricks in a mountain town.' },
  { id: 'echo', name: 'Alphabet Echo', rarity: 'rare', shape: 'echo', color: '#b98cff', kind: 'college', hint: 'Crunch bricks in a college town.' },
  { id: 'udon', name: 'Grandpa Udon', rarity: 'common', shape: 'slow', color: '#fff3d6', kind: 'oldtown', hint: 'Crunch bricks in an old town.' },
  { id: 'soba', name: 'Lake Soba', rarity: 'common', shape: 'straight', color: '#9a7b5b', kind: 'lake', hint: 'Crunch bricks in a lake town.' },
  { id: 'crackle', name: 'Canyon Crackle', rarity: 'common', shape: 'crackle', color: '#e59866', kind: 'desert', hint: 'Crunch bricks in a canyon town.' },
  { id: 'matcha', name: 'Matcha Ribbon', rarity: 'common', shape: 'ribbon', color: '#9ccb6b', kind: 'forest', hint: 'Crunch bricks in a forest town.' },
  { id: 'glass', name: 'Glow Glass Noodle', rarity: 'rare', shape: 'glass', color: '#c9f3ff', hint: 'Crunch a brick after 8 PM.' },
  { id: 'macaroni', name: 'Combo Macaroni', rarity: 'rare', shape: 'macaroni', color: '#ffd23f', hint: 'Crunch 5 bricks in a row, quickly.' },
  { id: 'rigatoni', name: 'Rocket Rigatoni', rarity: 'legendary', shape: 'rigatoni', color: '#e4572e', hint: 'Crunch 10 bricks in a row, quickly.' },
  { id: 'dawn', name: 'Dawn Noodle', rarity: 'rare', shape: 'dawn', color: '#ffb38a', hint: 'Take the morning swim.' },
  { id: 'mint', name: 'Minty Sip', rarity: 'common', shape: 'mint', color: '#9ff0c8', hint: 'Have the sunset sip.' },
  { id: 'cloud', name: 'Wishing Cloud', rarity: 'rare', shape: 'sky', color: '#d9f4ff', hint: 'Make a wish on a shooting star.' },
  { id: 'feather', name: 'Friendly Feather', rarity: 'rare', shape: 'feather', color: '#f2cf6a', hint: 'Wave 👋 to a friend.' },
  { id: 'smile', name: 'Smile Noodle', rarity: 'secret', shape: 'smile', color: '#9ff3ff', hint: 'Show all six faces.' },
  { id: 'bubble', name: 'Soup Bubble', rarity: 'rare', shape: 'bubble', color: '#e9f6ff', hint: "Cook something in Grandma's kitchen." },
  { id: 'slowudon', name: 'Slow Udon', rarity: 'rare', shape: 'slow', color: '#f7e2b5', hint: 'Welcome the Udon Snail home.' },
  { id: 'thunder', name: 'Thunder Noodle', rarity: 'legendary', shape: 'thunder', color: '#ffd23f', hint: 'Win a Crunch Race.' },
  { id: 'peak', name: 'Summit Soba', rarity: 'legendary', shape: 'peak', color: '#9a7b5b', hint: 'Visit all ten kinds of towns.' },
];
const NOODLE_BY_ID = Object.fromEntries(NOODLE_DEX.map(n => [n.id, n]));
const NOODLE_SHINY = 1 / 40;   // a noodle you already have sometimes comes back golden

// Grandma's kitchen (in every Cafe): cook what you picked, gathered and caught. Each dish is a few stars once a day and fast feet.
const KITCHEN = [
  { id: 'ramen', icon: '🍜', name: 'Classic Ramen', needs: { wheat: 1, egg: 1, carrot: 1 }, stars: 2 },
  { id: 'soup', icon: '🍅', name: 'Tomato Corn Soup', needs: { tomato: 2, corn: 1 }, stars: 2 },
  { id: 'udon', icon: '🐟', name: 'Seaside Udon', needs: { wheat: 1, fish: 1 }, stars: 2 },
  { id: 'pancake', icon: '🥞', name: 'Apple Pancakes', needs: { wheat: 1, milk: 1, apple: 1 }, stars: 2 },
  { id: 'feast', icon: '🍲', name: "Grandma's Feast", needs: { wheat: 1, egg: 1, milk: 1, apple: 1, fish: 1, carrot: 1 }, stars: 5 },
];
// where to get each ingredient (a guide-arrow target in sw.js)
const INGREDIENT_AT = { wheat: 'townfarm', carrot: 'townfarm', tomato: 'townfarm', corn: 'townfarm', egg: 'work:hen', milk: 'work:cow', apple: 'work:apple', fish: 'spot:fish', berry: 'nature' };
