# World Builders: design decisions

The full, living design (with diagrams and discussion) is the "Small World: World Builders Design" doc:
https://claude.ai/code/artifact/8e9bc626-ecc5-411d-92b5-745c8ea53e05

This file is the in-repo summary of what was decided, for agents building it. If this file and the living
doc disagree, the living doc wins; update this file to match. Do not re-decide anything here without the owner.

## Vision

Small World becomes a place where players practise running a planet: they grow towns into provinces,
countries, multi-nations and one world, and solve world problems together. The planet shows both today's
world and the wonderful world it could become. The promise is "practise running the world, so your
generation does it better", not a claim that play fixes the real world.

## Principles (in priority order)

1. **Fun first; the game evolves.** Today's play stays the heart; new layers grow out of it.
2. **Investigate, don't preach.** Evidence and tools, never a conclusion to agree with.
3. **Nuance.** Several causes, side effects everywhere; natural and human causes both exist.
4. **Honest about evidence, open about choices.** The simulation follows established science; uncertain
   areas show ranges; what to *do* is the players' call.
5. **Pragmatic.** Good plans mix reducing a problem with adapting to it. No single right ending.
6. **Kind power.** Leadership is chosen, limited, ends, and can only give.
7. **Practise what we teach.** No real money, no loot boxes, no dark patterns, no selling data, gentle limits.

## Rules to keep it fun (from the game-design review)

1. Every system is a toy first: fun with the numbers hidden, or it does not ship.
2. Verbs, not menus: world actions are big buttons at places in the 3D world.
3. Show, don't tell: changes appear in the world (smog, fish, sky) before any number.
4. Solo-able: every level works with one player plus non-player characters (NPCs).
5. Something changes today: every session ends with a visible difference the player caused.
6. Up, never down, on screen: progress toward the wonderful world, never a punishment meter.
7. Power gives, never takes.
8. Today's play is untouchable: world tasks hang off crunching, cooking, races, exploring.
9. One new idea per session, at most one fact card.
10. Stay inside the existing caps: rewards go through `kidBonus` and `RULES`.

## Ages

| Band (code) | Ages | What they do |
| --- | --- | --- |
| 1 | 6 to 8 (younger with a parent) | Sparks, helper missions with an animal buddy, Crew Captain, Clean-up Day. No reading needed. |
| 2 | 9 to 12 | Specialist dreams, voting, fact-checking, Governor, Leader. |
| 3 | 13 to 16 | Prime Minister, World Council, treaties, laws, the Shell Ledger (maybe). |
| Adults, families | any | Play with children, Teacher mode, impact reports. |

## The growth ladder

Town (today, Mayor; Mayor Maple is the NPC) → Province of 3 to 6 towns (Governor) → Country (Leader, then
Prime Minister) → Multi-nation (council of country heads) → World (World Council). Each level unlocks
through play; NPCs fill empty seats; small kids never have to touch governance, but their play counts.
Inside a country, a "society of dreams": a Society screen shows which careers are present, and a missing
one shows as a need ("No doctor yet: the clinic is closed").

## New dreams (13)

| Dream | Ages (band) | Notes |
| --- | --- | --- |
| Scientist | all | Sensors, readings, find the cause at the Climate Lab |
| Fact-Checker | 9+ (2) | Trace rumours, compare stories |
| Clean Energy Engineer | all | Windmills, solar, water power |
| Robot Maker | 9+ (2) | Helper robots, retraining school, robot rules |
| Doctor | all | Clinics, sharing medicine |
| Ranger | all | Fish, forests, animals, cutting limits |
| Water Engineer | all | Treatment plants, clean rivers |
| Crew Captain | all | How young kids lead: gather a crew of 3, lead a Clean-up Day or festival; crew votes by tapping faces; NPCs fill empty spots; can never kick anyone |
| Ledger Keeper | 13+ (3) | Shell Ledger honesty, scams, bubbles (maybe) |
| Governor | 9+ (2) | Leads a province |
| Diplomat | 9+ (2) | Treaties between countries |
| Leader | 9+ (2) | Heads a country |
| Prime Minister | 13+ (3) | Speaks at the World Council (maybe) |

The existing Mayor dream becomes the first leadership rung. New school subjects: Nature and Media.

## World dials

Warmth, Nature, Fairness, Trust, Energy. They pull on each other in the story. On screen they are scenes
first (haze, fish, animals, sky colour); any meter only fills up with players' actions toward the wonderful
world and never drains. Phase 1 ships only Warmth and Nature.

Climate has natural causes (sun cycle, volcanoes, rare long winters standing in for orbital cycles) and human
causes (smoke, energy use, cut forests). Players find which cause acts in each problem. Good plans mix
reduce and adapt.

## World Problems: sizes and pacing

| Size | Examples | Real time | Beats | Mainly |
| --- | --- | --- | --- | --- |
| Spark | Litter pile, sick deer, spilled barrel, fake letter | One session (5 to 15 min) | Spot, fix, see it at once | Small kids, anyone |
| Event | Volcano puff, storm, rumour, Oracle mistake | 1 to 3 days | Appears; scientists find the cause; a crew fixes it | Band 2 |
| Season | Warmth in one biome, dying forest, dirty river, e-waste | 1 week | Daily action, mid-week reveal, weekend finale (Clean-up Day) | Towns, provinces |
| Era | Warming trend, forest regrowth, energy switch | 4 to 8 weeks | Each Season moves it one visible notch on the globe | Countries |
| Grand Project | Space Program, wonderful-world Wonders | Months | A celebrated milestone about every 2 weeks | Multi-nations, World Council |

Pacing: at most one Era, one Season and one or two Events at once; Sparks always available. Nothing fails:
an unsolved problem waits, does not get worse on screen, and carries over. Every beat pays (a visible change
plus a capped reward). Small kids never see the Era: their Spark adds a visible leaf to the shared forest.

## Clean world

Litter and plastic to pick up and recycle (plastic in the sea lowers fish); water treatment plant as a town
building; tree planting and forest management (replant what you cut); Clean-up Day, a cooperative town event
run like the Crunch Races, where everyone's pickups fill one meter and a clean town holds a festival.
Rewards: coins through `kidBonus` caps, plus beauty, returning animals, "Clean Town" memories and stars.

## Technology problems

| Topic | Decision |
| --- | --- |
| AI helper robots | Productivity vs jobs vs energy; retraining school, sharing, robot rules |
| Oracle robot | Sometimes confidently wrong. Checking is an action: take its claim to the place, look, stamp "Caught it!" in a Fibs-dex. Answers are pre-written and rotate weekly; for small kids only silly-wrong. A real AI stays permanently optional for teens, outside the main loop. |
| Rumour mill | Rumours spread as a wave; fact-checkers trace and publish checks |
| Shell Ledger | Pretend digital money teaching public ledgers, mining energy, bubbles, scams. "Maybe" until players ask. Never real money. |
| Privacy, e-waste | Light choice cards; recycling jobs |

## Countries: competition and cooperation

Countries compete in friendly ways (races, trade, science firsts, festivals, beautiful capitals, a space race),
scored on effort, never taking from another country. Helping another country pays more than beating it.
Rankings are positive only ("3rd most helpful this week"), never a last place. NPC nations are default rivals
so solo players still have a race. The top goal is a shared Space Program (station, Moon base, Mars), building
on the existing Noodle Rocket, Moon trip, space suit and Astronaut dream.

Laws come only from a menu of harmless options, votes are one tap (a 10-second moment in play), terms are
one real week, citizens can always leave.

## Teacher mode

Part of the same game, not a separate product. A thin version comes early (phase 2): a class room code,
the teacher picks the problem, a one-page summary. Class rooms hold more than 8 players. The teacher's page
never shows individual rankings to the class.

## Safety

Made-up planet only; safe names and flags from word lists; preset phrases and face-emotes instead of free chat
for kids; no war; kind power; real science with honest uncertainty; bedtime and daily limits stay.

## Business and publishing

- For now purely in-game; smallworld.xyz (the creator) publishes the World Ideas Book. No partners yet.
- Later: impact sponsorship (brands fund real NGO actions tied to in-game results, credited to adults only),
  an on-chain public impact ledger for organisations only. Never children's coins, items or data on-chain.
- Other revenue: optional parent premium (cosmetics, no loot boxes), school licences, grants.
- Publishing order: web now → iPad and Android tablets (Capacitor, Kids Category rules) → schools →
  Microsoft Store (PWABuilder) → Steam last or never (accounts are 13+). itch.io only for playtests.
  All builds share one server and one save format.

## Roadmap

1. **World Problem Lite** in today's single town: one problem at a time, daily beat, visible fixes in the Wild,
   Clean-up Day, Crew Captain, NPC scientist, Warmth and Nature, Scientist and Ranger dreams.
2. **Teacher class rooms (thin), provinces and countries:** Governors and Leaders, society of dreams,
   rumours and Trust, NPCs fill seats.
3. **Multi-nations:** unions and Diplomats, the World Council, all five dials, the World Ideas Book.
4. **Wonderful world:** future view on the globe, Wonders, the Space Program, missions and partners.
   Maybe: Shell Ledger, Prime Minister.
