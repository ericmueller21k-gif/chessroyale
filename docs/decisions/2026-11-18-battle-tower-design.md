# The Battle Tower: the design (Nov 18, 2026)

**Status: design only, nothing built; settled with Eric (Nov 18).** It replaces the Boss Assists design written earlier the same day
(Eric dropped that mode, below). Eric answered every call; the ones he didn't object to stand as proposed ("What else you need").
The settled calls are listed at the end.
Area stub: [docs/areas/battle-tower.md](../areas/battle-tower.md).

**Eric, Nov 18:**
- "I'm worried though this mode would get too crazy and take away from the experience of fighting the normal bosses. I'm more
  inclined to simply work on the mode where it's you vs 3 bosses and we call it the battle tower."
- "It's a progressive system where bosses start like 1 boss then 2, maybe 2 again, then 3 etc, also their maia elo is increased
  as you progress, the first rounds are quite easy, it's a giant skyscraper and you climb each floor but not truly after each
  round you walk to the next floor but it really is just the same floor redrawn as stage 2 etc, also we would need to include a
  save progress so people can stop after a game and return later."
- "Tell me which ones are kept out as well because I might disagree and want some added. That's what makes it fun."
- "Also you can party up to 4 people and the majority pick is always chosen first followed by best engine move if draws, it's a
  full team effort this way. No move follows our normal rules."
- Its place: a new mode next to Auto chess; it replaces nothing.
- His last answers: "That's a bit too small for elo, I'd go with 100 increase per starting at 600, solo bosses get a little bit
  extra strength tho. After it caps out it stays there, at 50 wins god forbid anyone got there, we swap to stock fish and continue
  up. hollow and smudgy I'm saying it's fine they don't share, I assume you have a reason so I trust. What else you need"
- Then (his answers to this design's first draft): "The climb is infinite but technically ends at 99, floors. Easy to program a
  loop. Maia gets stronger every game slightly as you climb. Whatever the minimum increase is lmk, maybe need to change. No hidden
  boss. All moves should be included ideally, that's fine for hollow and smudgy. No hearts, one loss and you're out."

**The mode in one paragraph.** You (alone, or a party of up to 4 picking every move together) climb a skyscraper. Each floor is
one game of chess from the starting position against 1, 2 or 3 bosses at once, all on the other side of one board, taking turns
to move, each with its own powers and its own meter. Their Maia rating rises a little every floor, from very easy, up to 99 floors.
One loss and the run is over. Between floors you walk to the next floor (the same room drawn again with the next number) and may
stop there: the run is saved to your account and picks up on that floor when you come back.

## 1. The move list: every boss's moves with 2 or 3 bosses on one board

**How the bosses share a board (the calls in section 2):** one side, one move a turn, the bosses taking turns in a fixed order, so
each boss still has "his turn" and "his first move", the things nearly every power keys on. Each boss keeps his own meter and his
own powers' state. Picks that need an engine work as today: alone, this device's engines (as Boss alone); in a party, the host's
device with the server checking the answer (as a Boss Battle party). So most moves come in as they are.

**The plain list (Eric: "All moves should be included").** Every move is IN. IN: works as it does alone. IN, WITH A RULE: works,
with the one rule in the line; each rule is kept only where a boss's power needs it to work at all beside other bosses (said in
its line). Not in the tower: the Hidden Boss (Eric: "No hidden boss") and the bosses not built yet.

| Boss | Move | Kind | In the tower? |
| --- | --- | --- | --- |
| Ginger | Freeze | normal | IN |
| Ginger | Super Freeze | second meter | IN |
| Ginger | Blizzard | ultimate | IN |
| Boingo the Clown | Pie | normal | IN |
| Boingo the Clown | Funhouse | ultimate | IN (the whole board turns, every boss's marks with it; its forced first move is the crowd's, as alone) |
| Jefferson | Sparkler | normal | IN |
| Jefferson | Roman candle | ultimate | IN (its fireballs land on the bosses' half too; no boss's piece burns, as his own never do) |
| Hollow | Dark | normal | IN, WITH A RULE: never on a floor with Smudgy (below) |
| Hollow | Lights out | ultimate | IN (a memory test that holds the clock; a crowd that finds too few gives *him* a second move: his turn again before the next boss's) |
| Big Boy | Snack | opening | IN (he eats a center pawn before move 1) |
| Big Boy | Toy-block tower | normal | IN |
| Big Boy | Big Bounce | ultimate | IN |
| Sawyer | Split pawn | opening | IN (on his own first move) |
| Sawyer | Saw cut | normal | IN |
| Sawyer | Board saw | ultimate | IN (its gate, "one half more his on material", reads the whole bosses' side) |
| Wrangler | Long pull | opening | IN (his own first move; if the other bosses already moved the center pawns, an ordinary move, as today when none is sound) |
| Wrangler | Lasso drag | normal | IN |
| Wrangler | SHOWDOWN! | ultimate | IN, WITH A RULE: his reply to the duel is the bosses' very next move, out of turn (the engine's best, as today), then the order goes on. Needed: the line-up is scored with his reply next (`bestReply`) |
| Alfil | Tusks | normal | IN (the fusion is his turn's move) |
| Alfil | Mammoth Slam | ultimate | IN |
| Chub & Chirp | Leapfrog | normal | IN |
| Chub & Chirp | Carrot Patch | ultimate | IN, WITH A RULE: during the race every boss's move goes through the race brain (`raceGuard`), not only theirs. Needed: otherwise two of three boss moves ignore the race and it's no race |
| Smudgy | Camouflage | normal | IN, WITH A RULE: his hidden rook's disguise (`keepsDisguise`) binds every boss's moves, since they all play that rook (needed: another boss's ordinary rook move would give it away at once, `unmask`); never on a floor with Hollow (below) |
| Smudgy | Repaint | ultimate | IN |
| Moo & Moon | Moonbeam | normal | IN |
| Moo & Moon | Full Moon | ultimate | IN (the cinematic plays alone in the moments queue; full strength on his own turns only) |
| Puddles | Seeds | normal | IN |
| Puddles | Watering | ultimate | IN |
| Babur | Balloons | normal | IN |
| Babur | Hoops | ultimate | IN (the walls bind every boss's pieces, as they bind his) |
| Folio | Draft | normal | IN |
| Folio | Crease | ultimate | IN (every boss's pieces may cross it, as Folio's do) |
| Folio | Revision | once a battle | IN, WITH A RULE: only right after a move of *its own*. Needed: going back over another boss's move would undo that boss's turn and its powers' steps |
| Timber | Scraps | normal | IN (his drops' lead guard, `workshopLeadMax`, reads the whole side's material) |
| Timber | Gnaw | ultimate | IN |
| Dash | Clock Slap | normal | IN |
| Dash | Time Scramble | ultimate | IN |
| Dash | Scramble Rush, clock multi-hit, pop-off | extras | IN |
| Don Dough | Rising Dough | normal | IN (the lead guard, `doughLeadMax`, reads the whole side) |
| Don Dough | Gold Plate | ultimate | IN (every piece on the bosses' side counts as his: it gilds the side's queen, else its strongest piece) |
| Chandy | Lock-on | normal | IN (it steers only his own moves) |
| Chandy | Scatter shot, Beam, Shields, Rapid fire, Queen lock | his five | IN |
| Chandy | Dodge | ultimate | IN (a cinematic minigame; the board comes back as it was) |
| Hidden Boss | No help, Bullet, phase 2 | all | **Not in the tower** (Eric: "No hidden boss") |
| The Pawn Golem, Bone Archer, Black Knight, Storm Witch, Tower Tyrant, Frost Dragon, Grandmaster Wraith, Demon Lord, Engine Eternal | none yet | | **OUT**: no art or powers (`kit: null`, `powers: null`). **To come in:** be built, like any boss |

**Rules behind the list:**
- **Every boss with powers is dealt** but the Hidden Boss, and any two or three may share a floor, **except Hollow with Smudgy**
  (`BATTLE_TOWER.apart`; Eric: "it's fine they don't share"). Why: both hide what is on a square (the dark hides it, the paint
  disguises his rook), and a wrong try costs points under Hollow but is refused free under Smudgy, so one tap would mean two things.
  A pair the build's fuzz (PR 6: the boss kit over pairs and threes) finds breaking gets a rule like the four above, or joins `apart`.
- **Admins-first bosses** (`BOSS_ADMIN_FIRST`: Timber, Dash, Don Dough, Chandy) are dealt to players once they're live, as every
  mode does (`isPlayable`); an admin's run deals them too (as `menuBosses` lists them for admins).
- **Wrangler's showdown, Hollow's second move:** the two places a boss moves out of turn. The order then goes on from the boss
  after him.

## 2. Several bosses at once on one board

### One side, one move a turn: they take turns (call)

The bosses move **in turn, in the order they were dealt** (boss 1, boss 2, boss 3, boss 1 …). Reason: almost every power keys on
"his turn", "his first move", "after his move", "his whole turn", so each boss keeps exactly the turns his powers expect, and a
whole-turn power (Alfil's fusion, the Carrot Patch's cast, Repaint, Watering, the Queen lock) spends only that boss's turn. Each
boss's move comes from his own brain at the floor's Maia rating (section 3). The other way, "the strongest boss always moves",
would make two of the three bosses powers with no turns.

The boss to move is lit on the bar ("Ginger to move"), so you always know whose powers come next.

### What changes in the match runner

- `MatchState.boss` (one `BossState`, `packages/core/src/match.ts`) becomes a list on a tower floor: `bosses: BossState[]`, each
  with its own `powers` (its `BossPowerState`), `crowdMoves` counted the same for all, and `mover`: whose turn is next. A single
  boss battle is a list of one, so every raid and Boss alone plays as now.
- **Each boss's turn steps** (`prepareTurn` in `boss-powers.ts`) run for every boss as each crowd turn begins, in the order from
  the boss to move: each boss's passive and meter tick on every crowd turn, as they do alone. The hooks keyed on "his turn"
  (`afterBossMove`, `ultimateOnHisTurn`, `asks`, `specialMove`, `bestReply`, `fullStretch`) run only for the boss whose turn it is.
- **Allowed moves:** the crowd's are limited by every boss's marks at once, and the bosses' by every mark that binds them: the
  board layer below does this in one place. A whole side's guards (`bossStops`: a pie, a toy block, Smudgy's disguise, Don Dough's
  lumps) bind every boss's move.
- **The God King** helps as in Boss alone (his charges, his move, his strike, his Last Stand); his strike staggers the boss to move.
- **Strikes:** none, as a Boss Battle party (`bossNoStrikes`): there's no crowd to knock out.

### Each boss on his own meter

Each boss's rage meter fills as it does alone (his `rageSpeed`, the crowd's moves, the side's material lost: every boss on the floor
is angered by the side's losses). So three bosses bring about three times the ultimates of one. To keep floors fair, each meter
fills at `BATTLE_TOWER.rageScale[n]` of its speed on a floor of `n` bosses (proposed 1, 0.75, 0.6; the sim tunes them). The
special meters (Ginger's Super Freeze, Chandy's move meter, Wrangler's showdown meter, the real-time seeds, scraps and balloons)
run as they do alone.

### Timing: two powers never animate at once

- Every boss's moments for a turn change go in **one queue**, in the order they happen (the boss whose turn it is first, then the
  rest in turn order); the screens already play a battle's moments one after another (`momentsOf` in `BossPowers.tsx`), and the
  server and solo already wait for their lengths (`powerFxMs`), so the queue is the same mechanism with more in it. The crowd's
  clock holds while it plays, as it does for one boss.
- **One ultimate a turn change:** when two bosses' ultimates fall due together, the second waits a turn, its warning kept (Ginger's
  Blizzard already makes his Super Freeze wait the same way: docs/decisions/2026-11-18-ginger-super-freeze.md).
- **One cinematic or minigame at a time** (Lights out, the Full Moon, Dodge, Scramble Rush, the Carrot Patch's race): a second one
  due waits for the first to end, then plays at the next turn change.

### How several bosses show

- **Phone:** today's boss bar above the board (the figure, its name, its level, its meter) is split into equal parts, one a boss,
  each figure smaller and whole on screen (Eric's rule of Nov 4), its meter under it, the boss to move lit, the others dimmed but
  never hidden. A boss's moment plays from its own part of the bar (the cast at the board's corner, `.pm-caster`, as today).
- **Computer:** the figures stand beside the board, stacked, the same order top to bottom; the boss to move steps forward.
- **The dock line** names the boss: "[portrait] Ginger plays d4" (Eric's rule: a portrait and a name, never an emoji).
- **Every bar's size and place is fixed per floor**: a 2-boss floor's bar doesn't change shape mid-game. Mockup first.

### The board layer (the foundation)

Eric's idea from the assists brief, and the one thing several bosses need most: today each boss answers "can this piece go there"
in its own code (`held`, `crowdFilter`, `bossStops`, `stopReason`, `iced` in `BossRules`, `bosses/base.ts`), and two bosses have
never had to share a square. With up to three on one board, one shared layer gives every boss one place to write, one combine rule,
one lift, and one list the screens draw from. It's worth doing first and on its own.

**One state per square, edge and piece** (a new pure module, `packages/chess/src/board-layer.ts`; core's `StopReason` names the marks):
- **Square marks** (`square`, `kind`, `binds`, `noLand`, `noPass`, `until`, `by`):
  - **open**: no mark;
  - **no landing, pass through** (`noLand`): Boingo's pie, Chandy's scatter shot, Don Dough's lump (his side only);
  - **no landing, no passing** (a wall a knight jumps: a jump passes over nothing, base.ts `moveSquares`): Big Boy's blocks,
    Puddles' plain plant, Chandy's beam;
  - **no passing, landing allowed** (`noPass`): Big Boy's tower from `towerEnter` (landing topples it);
  - **fire** (no limit; its stage, for drawing and the burn): Jefferson's tiles.
- **Edge marks** (two neighboring squares, `across`): **straight** (no rank or file move crosses; diagonals pass at the corners;
  knights jump): Sawyer's cut; **all** (nothing crosses, knights included): the board saw's d|e edges; Folio's crease (binding the
  crowd only).
- **Piece marks, which follow their piece:** **held** (can't move; still attacks, defends, blocks): Ginger's freeze and ice, Moo's
  stun, Folio's fold, Chandy's beam and rapid fire, Boingo's second splat; **shielded** (`shieldFrom: "pawns" | "all"`): Don
  Dough's gold, Chandy's shields; **marked** (drawn only): Boingo's splat, Folio's draft, Chandy's lock.
- **`binds`**: `"both"`, the crowd or the bosses. **`until`**: the turn it wears off. **`by`**: the boss that put it there.

**Functions** (pure; the same on the server, solo and every screen):
- `layerStop(layer, fen, move)`: the first mark that stops a legal move for the side to move: its landing square, the squares it
  passes (`moveSquares`, castling's way included), the edges it crosses (Sawyer's `moveEdges` and `edgeOf`, moved into the layer),
  a held mover (`heldIn`, castling with a held rook included), a shielded target. The refusal words come from it.
- `layerMoves(layer, fen, legal)`: the legal moves no mark stops, and **the lift in one place**: none left, every legal move
  (`lifted`), as `crowdAllowed` lifts today. Only chess-legal moves are filtered, so check is always answered.
- `followLayer(layer, move, fenBefore)` (piece marks move with their piece, the castling rook's too, and go when it's captured) and
  `wearLayer(layer, turn)`.

**Overlaps:** a move is allowed only if no mark stops it, so the most restrictive wins with no table: a pie inside a beam is a wall;
a held piece behind a saw cut stays held. Marks never stop attacks: pins and checks work across all of them, as today.

**Moving today's bosses onto it, without changing any boss battle.** `BossRules` gets one optional hook, `layer?(boss, fen)` (the
marks its powers have on the board now). The dispatcher (`boss-powers.ts`) merges every boss's marks and reads them in `limitCrowd`,
`bossAllowed`, `stopReason`, `icedSquares` and `boardAltered`, then each boss's remaining `crowdFilter`, then the Last Stand's
`barred`, in today's order. One family a PR: **held pieces** (Ginger, Moo, Folio, Chandy, Boingo: each `held`), **square marks**
(Boingo's pies, Big Boy's `toyStops`, Puddles' plants, Chandy's scatter and beam, Don Dough's lumps), **edges** (Sawyer's
`crossesCut`, `crossesMiddle`, `sawStops`; Folio's `crossesCrease`), **shields** (Don Dough's `pawnOnGold`, `zebraStop`; Chandy's
`takesShield`). Outside the layer: Babur's hoops (`hoopStops`: they block attacks, a change to chess), Smudgy's paint (a second
board), Hollow's dark (unchecked tries), Wrangler's showdown (a "must" list), the carrots, Ginger's Super Freeze let-go (inside his
`held`), Big Boy's own seeded topple share.
**The guard:** each migration PR edits no existing assertion; it runs the boss kit (`packages/chess/test/boss-kit.test.ts`: every
boss in `BOSS_ROSTER`, Stockfish as referee), `e2e/boss-smoke.spec.ts` and the boss's own tests and spec, plus a twin test for its
life only (over the kit's battles and the boss's test positions, the old path and the layer give the same allowed moves and the
same `stopReason`), deleted with the old path in the same PR. Boss lane each.

## 3. The climb

### Floors: 99, the pattern looping

**99 floors** (Eric: "infinite but technically ends at 99"). **The boss count loops 1, 2, 2, 3** (Eric's "1 boss then 2, maybe 2
again, then 3"; "Easy to program a loop"): floor `f` has `BATTLE_TOWER.pattern[(f - 1) % 4]` bosses, so floors 1, 5, 9 … 97 have
one, 4, 8 … 96 three; the pattern is one setting.

**The bosses get stronger every floor, Maia first, then Stockfish** (Eric, Nov 18):

- **Floors 1 to 50, Maia:** floor `f` plays at `maiaStart + maiaStep × (f - 1)` = **600, +100 a floor** (Eric: "100 increase per
  starting at 600"), capped at Maia's top, `BOSS_BRAIN.maiaRating`'s last point (2500), reached at floor 20 and held to floor 50
  ("After it caps out it stays there"). The brain is Boss alone's: `bossBrainFor(…, { alone: rating })` in core `boss.ts`, Maia raw at
  that rating (`BOSS_BRAIN.brain`), no bridge band, the same for every boss.
- **A one-boss floor plays a little stronger** (Eric: "solo bosses get a little bit extra strength"): `BATTLE_TOWER.soloBonus`,
  **+200** (the director's proposal), within the same caps.
- **From floor 51 ("at 50 wins … we swap to stock fish and continue up"): Stockfish**, the engine every device already runs for the
  bosses: the brain `"stockfish"` (`BossBrain`; Stockfish at a UCI_Elo with the blunder guard, `bossMaxLoss` and `bossMaxLogitLoss`,
  as a Stockfish boss always plays), its UCI_Elo `stockfishStart` **2500, +25 a floor** (`BATTLE_TOWER.stockfishStep`, the
  director's proposal), up to Stockfish's ceiling, `ENGINE_MAX_ELO` (3190, core `boss.ts`), reached at floor 79; **from floor 80,
  full strength**: no limit, the engine's best each move (the move kind "best", as Moo's Full Moon and Wrangler's showdown reply
  already play it).
- **Who runs it:** alone, this device's Stockfish (solo's `startBrain`, as Boss alone); in a party, the host's device with a
  checker, as every online boss move today (`hostBoss` in `net.ts`, `BOSS_CHECK`: the host's and a checker's moves from one seed,
  the engine server settling a disagreement; engine.md, "Two devices play each online boss move").

| Floor | Bosses | Brain | Rating |
| --- | --- | --- | --- |
| 1 | 1 | Maia | 800 (600 + 200 for a lone boss) |
| 2 to 4 | 2, 2, 3 | Maia | 700, 800, 900 |
| 5 | 1 | Maia | 1200 (1000 + 200) |
| 10 | 2 | Maia | 1500 (Easy is 1150, Medium 1600) |
| 15 | 2 | Maia | 2000 (about Hard, 2050) |
| 18 | 2 | Maia | 2300 |
| 20 to 50 | | Maia | 2500 (Maia's top, Very hard) |
| 51 | 2 | Stockfish | 2500 |
| 60 | 3 | Stockfish | 2725 |
| 79 | 2 | Stockfish | 3190 (its top) |
| 80 to 99 | | Stockfish | full strength |

Each boss plays the floor's rating (as Boss alone ignores your rating: `bossAloneMaia`); a party plays the same ratings (as a Boss
Battle party does: no crowd margin). `BATTLE_TOWER` holds `floors` (99), `pattern`, `maiaStart`, `maiaStep`, `soloBonus`,
`stockfishFrom` (51), `stockfishStart`, `stockfishStep`, `apart`: a playtest changes a number, not code.

### The deal

**Which bosses:** from the run's seed, as a shuffled deck of the pool, dealt floor by floor and shuffled again when it runs out, so a
run meets every boss in the pool once before any comes twice, and never the same boss on two floors in a row (call). The pool: every
playable boss but the Hidden Boss (14 today; 18 once the four admins-first bosses are live). The next floor's bosses are dealt as the
floor before is won and saved with the run, so stopping and coming back meets the same bosses.

**Your side:** you play **White on every floor**, as in every boss battle today (Eric, Nov 18: "Maybe for now then we stick to
white, but need to consider changing this later for sure"). White or Black at random is a later item (the build plan's last row):
it waits on every boss working with the crowd as Black. Every floor from the starting position, with no book opening (as a Boss
Battle).

### One loss and you're out

- **Only a win climbs** (Eric: "No hearts, one loss and you're out"). A floor lost (mate, out of time, resign) ends the run, and
  **a draw ends it too** (the director's call: a draw isn't a win, as a raid's isn't). Your best floor stays on your profile; a new
  run starts from floor 1.
- **Leaving mid-floor counts as a loss** (Leave, or a party all gone), so leaving can't dodge one. Before your 2nd move, Leave is
  free: the floor is fought again later, the same bosses.
- **Floor 99 won:** the run is complete: its result, your best "99 (top)".
- **The God King** comes with his usual charges each floor (as Boss alone).

### Rewards (proposals, inside the payments design's rules)

The payments design (docs/decisions/2026-11-17-payments-design.md, section 6) pays coins by every counted game's XP minutes plus a
performance bonus for a win, and pays the device's word (a solo game) no bonus. So:

| What | Solo floor (the device's word) | A party's floor (the server saw it) |
| --- | --- | --- |
| Each floor played | a counted game: XP minutes under the solo cap, play coins, the daily reward's game | a counted game: XP minutes, play coins |
| Each floor won | nothing more (no bonus for solo, as Boss alone) | a win: +50 XP and the 15-coin win bonus, through the day's diminishing steps |
| Boss tokens | a drop chance, as any boss battle (`countBossBattle`: a token of one of that floor's bosses) | the same |
| Milestones (floors 10, 25, 50, 75, 99) | a profile emblem for each, marked "solo" | the emblem; a crate at 25, 50, 75 and 99, once an account |

No new currency, no timers, nothing bought: the payments design's "earn first" rules hold.

## 4. The skyscraper: one room, every floor

**Eric, Nov 18:** "For drawing each room make it simple just a challenge style room with a center circle like we do, but the room is
hunchess color themed maybe ... the redraw simply adds a number posted on the wall on both sides like a big '4' the chess board and
chairs are just hunchess color themed as well nothing special, the bosses appear the same every time. There's an above door and once
you walk in and go to the board they will come out the top door and walk to the board, the room itself can be snug."

**One room, reused for every floor.** The model is Chess Town's challenge rooms (a boss's home in challenge mode:
`packages/app/src/town/shops/challenge.ts`, `ShopRoom.tsx`; the intro's flow and drawing in `shops/intro.ts`): a snug room with a
**center circle** on its floor (the circle the challenge's marks are found from: `marksOf` reads the floor's `circle-*` / `ring-*`
tiles), the table in its middle.
- **In HunChess's own colors:** the walls, floor and circle in the game's palette (not a boss's); a plain board and two chairs in the
  same colors (the town's `PARK_TABLE`, a stool each side, recolored; the board painted by `paintTable`). Nothing else in the room.
- **The floor number** painted big on **both side walls** ("4"): the only thing that changes from floor to floor.
- **A door at the top** (the far wall), and you come in from the bottom.
- **The flow, each floor:** you walk in (a party: every member's pawn, in seat order and seat colors) and up to your mark at the
  board; then that floor's bosses (one, two or three) come out of the top door one after another and walk to the board, on their
  marks on the far side, each the same sprite as everywhere else ("the bosses appear the same every time"); the board comes up as
  a challenge's does. Reuse the challenge's walking, marks and seating (`CHALLENGE_FEEL`, `marksOf`, the "facing" layout: the bosses
  north, you south; its three marks spread across the far side of the table for three bosses) and its zoom-and-fade into the board.
- **Between floors:** after a floor's result the room comes back with the number one higher on both walls, and you walk in again:
  "you climb each floor but not truly". **Continue** and **Stop here (saved)** are under the room, always shown, greyed while anyone
  walks.
- **Nothing hidden:** the run's strip is always at the top of the room and of the game screen ("Battle Tower · Floor 4 of 99", the
  next floor's Maia rating, the bosses beaten as small portraits).
- **Phone and computer:** the room in the challenge mode's own framing (`CHALLENGE_FEEL.cam`: everything in view); on a computer in
  the board's column with the right column as on home. Every figure whole on screen (Eric's rule of Nov 4).
- **Reduced motion:** no walking: everyone on their marks, the number changes with a fade.
- **Art:** one room, by the art runner (its still for Eric first), in the characters lane; the walking and seating code is the
  challenge room's. A later idea: the tower as a building in Chess Town.

## 5. Saving progress

**Stop after any floor and come back later.** A run is stored on the server, for a guest too: a guest is a server account (its
cookie, accounts.md), so its run is saved as everything else of a guest's is, and moves to the account it signs in to (the sign-in
merge, `accounts.ts`). So "this device only" is never needed.

**D1 (stored data: the full lane).** Two tables, `packages/server/src/tower.ts` (`TOWER_SCHEMA`, `CREATE TABLE IF NOT EXISTS` as
`boss-tokens.ts` does), registered in `account-data.ts` (export and delete) and the sign-in merge:

```sql
tower_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,     -- who holds the run: the player; a party's leader
  kind TEXT NOT NULL,        -- 'solo' | 'party'
  seed INTEGER NOT NULL,     -- deals every floor's bosses
  floor INTEGER NOT NULL,    -- the next floor to fight (1-99)
  met TEXT NOT NULL,         -- JSON: the bosses met so far (never twice), and the next floor's deal
  members TEXT,              -- a party's: JSON [{ uid, fromFloor }]
  fight TEXT,                -- the floor under way: { id, startedAt } (solo) or { lobby } (a party's); null between floors
  status TEXT NOT NULL,      -- 'open' | 'top' (floor 99 won) | 'out' (lost, drawn or left) | 'abandoned' (replaced by a new run)
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
CREATE UNIQUE INDEX tower_runs_open ON tower_runs (user_id, kind) WHERE status = 'open'   -- one open run each, solo and party
tower_best (user_id TEXT, kind TEXT, floor INTEGER, at INTEGER, PRIMARY KEY (user_id, kind))  -- the best floor reached, 1-99
```

A milestone's crate is paid once an account through the ledger with its own op key (`tower:<floor>:<ledger id>`), as the daily reward
is (`daily:<day>:<ledger id>`): no table of its own; the emblems follow from `tower_best`.

**Routes:** `GET /api/tower` (your open runs and bests), `POST /api/tower/run` (a new run: replaces an open one after a confirm),
`POST /api/tower/floor/start` and `/finish` (solo: the server notes the start's time, as `startSoloBattle` / `finishSoloBattle` do,
and accepts a result only for the floor it started), `POST /api/tower/stop`. A party's floor is written by its match room as it
saves results (`lobby-do.ts`, `writeResult`), never by a device.

**Mid-floor:**
- **Solo** (on the device, as Boss alone): a solo battle can't be restored after a reload today (`solo.ts` keeps nothing). So the
  tower adds it: after every move the device keeps the floor's game (the match state, every boss's power state, the moves: plain
  data, as the server already sends it) in its own storage, and a reload or a reopened app **rejoins the floor where it was**, the
  server's `fight` saying it's the floor started. Nothing to restore (storage cleared, another device): the floor counts as lost.
  Rejoining gives back the same position, so a reload can't dodge a loss.
- **A party** (on the server, as a Boss Battle party): seats survive reloads, so a member's reload rejoins the floor; the floor
  goes on without anyone who's gone (the party rule waits only for those connected).

### The party (up to 4)

- **Its party** is Boss Battle's (`PartyCore`, the `PARTIES` Durable Object, kind "tower", its invite circle and link, READY/START,
  Kick, Promote), with `max` 4 (the Hidden Boss's room already plays four seats: the fourth color green, `PARTY_COLORS`). The leader
  starts or resumes the party's run.
- **The move:** every member picks every move; **the move most picked is played; a tie goes to the engine's best** (`partyMove`,
  `packages/core/src/scoring.ts`, the draw rule "party"; the judge's expected scores). Today a tie within `BOSS_PARTY.closeCp`
  (30 centipawns) goes to one of the close ones at random; Eric's words ("followed by best engine move if draws") say the best,
  always: the tower's settings set `closeCp` 0 (call). With 4, 2-2 ties happen; 1-1-1-1 is a four-way tie, the best of the four.
- **"No move follows our normal rules":** the Boss Battle party's (docs/decisions/2026-10-30-boss-party.md): the turn waits for
  every connected member, no cap; the team's one clock (`BOSS_CLOCK`, 10 minutes + 10 s a move) runs meanwhile; a minute after the
  turn's first pick (`BOSS_PARTY.afkKickSec`) the members who have picked may kick whoever hasn't; the clock running out loses the
  floor. (Not 50 v 50's AFK rule: no move is ever picked for anyone in a party.)
- **The screens:** each member's pick shows live on the board in their seat color, as a Boss Battle party's do; the members' pawns
  stand in the tower's room and on the result.
- **Whose run:** the party's run is held by the leader's account (`tower_runs.user_id`, `kind` 'party'), separate from their solo
  run. Every member's own best (`tower_best`, 'party') rises with each floor won while they're in it. **A member who leaves** keeps
  the floors they were there for; the run goes on. **The leader leaving** between floors passes the party, and the run with it
  (`user_id` moves), to the next seat (the party's Promote order). **Joining mid-run:** between floors only, into a free seat (the
  invite link); they're credited from that floor (`members[].fromFloor`). **Resuming later:** the leader's "Resume party run
  (floor 6)" opens a new party holding the run; the others join by the link.
- **Fair play:** a party's battle gives no fair-play signals (teammates see each other's picks: the Boss Battle party's call),
  so neither does the tower's; solo floors are the device's, as Boss alone. Reports, chat and bans work as in any match.

## 6. Its place on home

A third card under **Other modes**, beside Boss Battle and Auto chess (`Home.tsx`, `rd-pair`): the three cards a third wide each at
today's 56 px, the picture over the name on a phone (no room beside it at 390 px), the short line on a computer ("Climb 99 floors").
Its picture: the skyscraper. Tapping it opens the tower's own screen: your run (its floor and the next floor's bosses: "Continue
floor 5") or "Start a run", Solo or Party (the party's invite circles as Boss Battle's), and your bests. Mockup first.

## 7. The build plan

Each PR on its own branch. The layer first; then several bosses on one board; then the tower around them.

| # | PR | Lane | Effort | Size |
| --- | --- | --- | --- | --- |
| 1 | **The board layer**: `board-layer.ts` (marks, `layerStop`, `layerMoves` with the lift, `followLayer`, `wearLayer`), Sawyer's edge helpers moved in, unit tests (every mark, overlaps, the lift, castling, promotion, en passant) | targeted | xhigh | ~400 lines |
| 2-5 | Today's bosses onto the layer, one family a PR (held pieces; square marks; edges; shields) | boss | xhigh | small to medium each |
| 6 | **Several bosses in the runner**: `bosses: BossState[]`, the turn order, every boss's turn steps, the merged layer, one ultimate and one cinematic a turn change, `rageScale`; the boss kit run over pairs and threes (seeded), a rule for any pair it finds breaking | boss, and the director may mark it full (the runner's core) | xhigh | large |
| 7 | Mockup stills for Eric (`stills/battle-tower`): the bar with 2 and 3 bosses (phone, computer), the tower's room, the tower's screen, the home row | light | high | one still a platform |
| 8 | **The climb's rules**: core `tower.ts` (the floors' pattern and Maia, the deal, one loss out, the run's steps), `BATTLE_TOWER` in settings.ts, unit tests | targeted | xhigh | small |
| 9 | **Saving**: `tower.ts` on the server (the tables, the routes, the sign-in merge, export and delete) | **full** (stored data) | xhigh | medium |
| 10 | **Solo tower screens and the solo restore** (the floor's game kept on the device after every move, rejoined after a reload): the tower's screen, the battle with 2-3 bosses on the bar and beside the board, the moments queue, the run's strip, the result; `e2e/battle-tower.spec.ts` and its `e2e/areas.json` entry | targeted | high | large |
| 11 | **The tower's room** (the art runner's one room in HunChess colors, its still first; the challenge room's walking and seating reused) | targeted | high | medium |
| 12 | **The party**: kind "tower", max 4, the lobby's floors on the party rule with `closeCp` 0, the room writing the run | **full** (stored data, the server) | xhigh | medium |
| 13 | The home card and its check in `e2e/home-layout.spec.ts` | light | medium | small |
| 14 | One sim run: bot climbers up the 99 floors, alone and as a party of 4, for `maiaStep` and `rageScale` (how far a run gets) (`reports/tower-sim.md`) | light | medium | small |
| later | White or Black at random on every floor, once every boss works with the crowd as Black (Eric: "need to consider changing this later for sure") | boss | xhigh | |

## The calls, settled (Eric, Nov 18: none objected to)

1. The bosses take turns in the order dealt, each keeping "his turn" (not the strongest always moving).
2. Maia +100 a floor from 600 to 2500, +200 on one-boss floors; Stockfish from floor 51 at 2500, +25 a floor to 3190, then full strength.
3. Hollow and Smudgy never on one floor (`apart`); every other move in, four with a rule.
4. The boss count loops 1, 2, 2, 3 over 99 floors.
5. One loss ends the run, and so does a draw; only a win climbs.
6. Leaving mid-floor is a loss, free before your 2nd move; a solo floor rejoins after a reload, a loss only if nothing can be restored.
7. Rewards: emblems at floors 10, 25, 50, 75, 99; crates at 25, 50, 75, 99 for a party's run only (solo is the device's word).
8. A party's tie goes to the engine's best always (`closeCp` 0).
9. The deal: every boss once before any comes twice, never the same boss on two floors in a row.
10. Each boss's meter at 100%, 75%, 60% on floors of 1, 2, 3 bosses, tuned by the sim.
11. The home card only; the tower as a building in Chess Town later.
12. White on every floor for now; random sides later.

## Still open

1. The numbers the director proposed (the +200 lone-boss bonus, Stockfish's +25 a floor, the meters' 75% and 60%) are first
   guesses for the sim (PR 14) to check, not Eric's.
