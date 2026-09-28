> **Note:** this is the original design of Noodle Universe, the first Squareface game. It is now part of Small World (see the README); some things here, like the 2D map and story chapters, belong to that first game.

# 🍜 Noodle Universe: Game Design

> A cozy exploration game about a square-headed, smiley-faced little AI who collects every noodle in the universe, and uncovers a secret along the way.

---

## 1. The Pitch

You are **Squareface Guy**, a small AI with a square head and a screen for a face. You wake up in **Noodle Universe**, a world where everything is made of noodles. Your job is to collect all **48 noodles** for **Grandma Ramen's Noodle-dex**.

While you collect, you find strange notes written in noodle-shaped letters. They lead to the biggest secret in the universe: **the Golden Noodle**.

**Genre:** Cozy exploration and collection with a cryptic scavenger hunt
**View:** Top-down 2D, pixel art
**Platform:** Web browser (desktop and phone)
**Play session:** 10–20 minutes per in-game day

---

## 2. The Hero: Squareface Guy

- Square head with a screen face. The face *is* the UI: it shows how he feels.
- A tiny antenna that **beeps faster when a secret is nearby** (hot/cold scavenger hint).
- He never talks. He shows emotions instead.

| Face | When |
|---|---|
| 😊 | Normal |
| 😋 | Crunching something |
| 🥵 | Thirsty (hydration low) |
| 😎 | Morning Swim buff is active |
| 😴 | Night / tired |
| 🤔 | Standing near a clue |
| 🤩 | New noodle discovered |

---

## 3. The Core Loop (why it's fun minute to minute)

```
   🌅 6 AM SWIM ──► 😎 buff all day
         │
         ▼
   🗺️ EXPLORE ──► 🥨 CRUNCH snacks ──► 🥵 THIRSTY
         ▲                                  │
         │                                  ▼
   📖 NEW NOODLE ◄── 🔍 FIND / SOLVE ◄── 💧 DRINK from stream
         │
         ▼
   😴 SLEEP (save) ──► next day
```

### 3.1 Crunch 🥨
- Crunchy noodle bricks and snacks are everywhere. Walk up and press the action button to **CRUNCH**.
- Big sound, a little screen shake, crumbs flying. It should feel great every time.
- **Crunch Combo:** crunch 3+ things quickly for a bonus (x2, x3, "MEGA CRUNCH!").
- Some bricks have a **noodle hidden inside**. Crunching is how you find them.
- Crunching fills **Energy** but drains **Hydration**.

### 3.2 Drink 💧
- A **Hydration meter** (a water drop icon). At zero you walk slowly and your face goes 🥵.
- Streams are the only place to drink. Hold the button for a long, satisfying *gulp gulp gulp*.
- Each stream has a personality:
  - **Minty Stream:** move faster for a while
  - **Sparkle Stream:** the antenna senses secrets from farther away
  - **Broth Stream:** refills Energy too
  - **Mirror Stream:** shows reflections of things that aren't there (important for clues!)

### 3.3 The 6 AM Swim 🏊
- The **Morning Pool** in Ramen Village opens **only from 6:00 to 7:00 AM** in-game.
- A short swimming mini-game: glide, dodge floating udon, collect bubbles.
- Reward: the **😎 Fresh Start buff** (more energy, a bigger crunch combo window, better luck finding noodles).
- Some secrets **only appear at 6 AM**, like the pool floor tiles, morning shadows, and the rare Dawn Noodle.
- *Optional "Real Morning" setting:* the pool uses your real clock, and swimming at real 6 AM gives a golden badge.

### 3.4 Day / Night
- 1 in-game day is about 15 real minutes.
- Some noodles and clues only show up at certain times (morning, noon, sunset, night).
- Sleeping saves the game and moves to 5:58 AM so you're ready for the pool.

---

## 4. The Collection: Noodle-dex 📖

**48 noodles** in 4 rarities.

| Rarity | Count | How you get them |
|---|---|---|
| ⚪ Common | 20 | Crunch bricks, pick from bushes, fish in streams |
| 🔵 Rare | 16 | Time of day, weather, trading with creatures, small puzzles |
| 🟣 Legendary | 8 | One per region, guarded by a puzzle or mini-boss challenge |
| 🟡 Secret | 4 | Only through the cryptic scavenger hunt |

**Example noodles:**
- *Crunchy Ramen Brick* (common): found in any brick
- *Spaghetti Vine* (common): hangs from willow trees
- *Dawn Noodle* (rare): floats in the Morning Pool, 6:00–6:10 AM only
- *Moonlight Glass Noodle* (rare): see-through, only visible at night
- *Thunder Udon* (legendary): top of Soba Peak during a storm
- *The Golden Noodle* (secret): the end of the hunt

**What collecting does:**
- Each noodle gets a card with a funny description.
- Grandma Ramen rewards milestones (10, 20, 30, 40, 48) with new abilities: swim faster, jump streams, see in caves, and so on.
- Put noodles in your **house** as decorations (a noodle trophy shelf).
- **Cook** noodles together to make dishes that give powers (Crunch Soup = mega combo, Ice Soba = no thirst for a while).

---

## 5. The World Map 🗺️

Six regions, each unlocked by a Noodle-dex milestone or a new ability.

1. **Ramen Village** (start): your house, the Morning Pool, Grandma Ramen's shop.
2. **Spaghetti Woods**: willow trees made of spaghetti, a maze-like forest.
3. **Crunch Canyon**: giant crunchy bricks, echoing crunch sounds, the best combo spot.
4. **Udon Rivers**: many streams, including the Mirror Stream; fishing for noodles.
5. **Soba Peaks**: tall mountains, storms, windy paths.
6. **Glass Noodle Caves**: dark, glowing, and full of secrets.

**Creature friends** (trade, hints, side quests):
- **Udon Snail:** slow, wise, gives riddles
- **Soba Birds:** carry messages across the map
- **Macaroni Crabs:** hoard shiny things and trade noodles for them
- **The Noodle Oracle:** a mysterious bowl that gives hints (see §7.4)

---

## 6. The Story

> Grandma Ramen once collected every noodle in the universe. Then one night, the **Golden Noodle**, the noodle that holds the universe together, disappeared. She tore the map to it into **7 pieces** and hid them, so only someone patient and curious could find it.
>
> She's too old to go looking now. But then *you* switch on.

**Chapter plan:**
- **Ch. 1: Waking Up** (tutorial: crunch, drink, swim, first 5 noodles)
- **Ch. 2: The Collector** (fill the Noodle-dex, open regions)
- **Ch. 3: The Strange Note** (first cryptic clue found inside a crunch brick)
- **Ch. 4–6: The Hunt** (map pieces across all regions)
- **Ch. 7: The Golden Noodle** (the final twist)

**The twist:** the last clue leads back to your own house. The Golden Noodle was *you* all along: your antenna is made of it. Grandma built you from it so the universe would have a collector again. When you complete the Noodle-dex, your face shows a brand new expression no one has seen before: 🥹

---

## 7. The Cryptic Scavenger Hunt 🔍

This is the heart of the game. Here's how to make it cryptic *and* fair.

### 7.1 The Five Rules of Good Cryptic Clues
1. **Use what the player already knows.** Every clue uses a game mechanic (crunch, drink, swim, time, face). No outside knowledge needed.
2. **Layer it.** Clue → place → hidden thing → next clue. Never just "go to X."
3. **Mix the types.** Riddles, pictures, codes, sounds, time, and reflection. Each piece feels different.
4. **Aha, not ugh.** When you solve it, it should feel obvious looking back.
5. **Always a way out.** A hint system so nobody gets stuck forever (§7.4).

### 7.2 Clue Types

| Type | How it works |
|---|---|
| 📜 **Riddle** | A short poem that describes a place without naming it |
| 🔣 **Noodle Cipher** | Messages written in the *Noodle Alphabet* (each letter is a noodle shape: straight, curly, zigzag, knotted...). The decoder is hidden in Grandma's shop. |
| 🕐 **Time Lock** | Something is only visible at a certain hour (6 AM tiles, sunset shadows) |
| 🪞 **Reflection** | The Mirror Stream shows words that only exist in the reflection |
| 🔊 **Crunch Code** | A rock crunches in a rhythm (short-short-long). Repeat the rhythm somewhere else. |
| 😊 **Face Lock** | A statue with faces. Make your own face match in the right order by *doing* things (crunch 😋, get thirsty 🥵, swim 😎, sleep 😴). |
| 🧩 **Map Piece** | Each piece is a torn drawing. Pieces only make sense when put together. |

### 7.3 The Golden Noodle Hunt: All 7 Clues

**🧩 Piece 1: The Pillow Note** *(Ramen Village)*
Found under your pillow on Day 3:
> *"When the sun is still yawning and the water is new,*
> *count what lies under, and it will point you through."*

→ Go to the **Morning Pool at 6 AM**. Dive, and the floor tiles show **three arrows** pointing to the Spaghetti Woods. Map Piece 1 is under the last tile.

**🧩 Piece 2: The Backwards Willow** *(Spaghetti Woods)*
Map Piece 1 shows a tree drawn **upside down**.
→ In the woods, every willow's strands hang *down*, except one whose strands grow *up*. Crunch the brick at its roots to get Piece 2 plus a note in **Noodle Cipher**.

**🧩 Piece 3: The Cipher** *(Grandma's shop → Crunch Canyon)*
You can't read the cipher yet. Grandma's shop has a "decoration" on the wall: it's the **Noodle Alphabet decoder**.
→ Decoded: **"LISTEN TO THE ECHO THAT CRUNCHES TWICE."**
In Crunch Canyon, one rock crunches with an echo: *crunch-crunch... CRUNCH*. That's Piece 3's location.

**🧩 Piece 4: The Crunch Code** *(Crunch Canyon)*
The echo rock teaches a rhythm: **short, short, long**.
→ Across the canyon is a big **Noodle Drum**. Crunch it in that rhythm. It opens and gives you Piece 4.

**🧩 Piece 5: The Mirror** *(Udon Rivers)*
Piece 4 has a note: *"Drink where the water lies."* (The water *lies*: it doesn't tell the truth.)
→ The **Mirror Stream**. While drinking, the reflection shows a cliff with words that aren't on the real cliff: **"UNDER THE SNAIL'S HOUSE."** The Udon Snail is sitting on Piece 5. It moves off only if you bring it a Dawn Noodle (from the 6 AM pool).

**🧩 Piece 6: The Face Statue** *(Soba Peaks)*
At the top of the mountain is a square-headed statue that looks just like you. It shows four faces: 😋 🥵 😎 😴
→ You have to *make your own face* match, in order:
1. Crunch something (😋)
2. Don't drink until you're thirsty (🥵)
3. Swim in the mountain lake (😎)
4. Sleep next to the statue (😴)
Wake up at 6 AM. The statue has opened. Piece 6.

**🧩 Piece 7: The Last Piece** *(Glass Noodle Caves)*
It's dark. Your antenna beeps faster and faster. On the cave wall, in glowing noodle letters:
> *"The last piece is not a place. Put the six together."*

→ Put Pieces 1–6 together in the Noodle-dex. They form a drawing of **your own house** with an X on **your bed**. Go home. Under the bed is Piece 7: a picture of **you**, with your antenna glowing gold.

**🟡 The Golden Noodle is you.** Grandma Ramen explains everything. The universe glows. Credits roll with all your collected noodles dancing.

### 7.4 The Hint System (nobody gets stuck)
- **Antenna beeps:** faster = closer to a secret. It's always on and free.
- **The Noodle Oracle:** a talking bowl in the village. Pay **Crunch Coins** for hints:
  - Hint 1 (cheap): a nudge. *"Have you tried looking at the right time?"*
  - Hint 2 (medium): the place. *"The pool... but early."*
  - Hint 3 (expensive): the answer.
- **Clue Journal:** every clue you find is saved automatically so you can reread it.

### 7.5 Daily Mini-Hunts (replay fun)
Every in-game day, a **Fortune Cracker** appears somewhere. Crunch it for a tiny random riddle:
> *"Where three streams meet, something sweet."*

Solve it the same day for a rare noodle or Crunch Coins. These are randomly generated from a list, so every day is a little different.

---

## 8. What Makes It Fun (checklist)

- ✅ **Juicy feedback:** every crunch, gulp, and splash has sound, shake, and particles
- ✅ **Always a next goal:** a new noodle, the next clue, or a new region is always close
- ✅ **Surprises:** hidden noodles in random bricks, rare time-of-day spawns
- ✅ **"Aha!" moments:** cryptic clues that feel clever to solve
- ✅ **Cozy rhythm:** morning swim, explore, drink, sleep. It's a routine you look forward to
- ✅ **No stress:** no dying, no losing progress. Only being slow when thirsty.
- ✅ **A heart:** a surprise ending that gives the whole collection meaning

---

## 9. Build Plan (later, when we start building)

1. **Prototype:** Squareface Guy walks around Ramen Village; crunch, drink, and hydration meter work.
2. **Day/Night + 6 AM Pool:** the clock, the swim mini-game, the buff.
3. **Noodle-dex:** 10 noodles, collection screen, save/load.
4. **First two clues:** Pillow Note and Backwards Willow, to test if the cryptic stuff is fun.
5. **All regions + all 48 noodles.**
6. **Full hunt + ending.**
7. **Polish:** sounds, music, particles, phone controls.

**Tech idea:** HTML5 + JavaScript (Phaser.js), pixel art, runs in any browser, saves to the browser.
