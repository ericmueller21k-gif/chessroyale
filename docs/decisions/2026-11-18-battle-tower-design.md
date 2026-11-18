# The Battle Tower: the design (Nov 18, 2026)

**Status: design only, nothing built.** It replaces the Boss Assists design written earlier the same day (Eric dropped that mode,
below). The calls are the director's and this design's, each waiting for Eric's OK; the open calls, one line each, are at the end.
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

**The mode in one paragraph.** You (alone, or a party of up to 4 picking every move together) climb a skyscraper. Each floor is
one game of chess from the starting position against 1, 2 or 3 bosses at once, all on the other side of one board, taking turns
to move, each with its own powers and its own meter. Their Maia rating rises floor by floor from very easy. Between floors you walk
to the next floor (the same floor drawn again with the next number) and may stop there: the run is saved to your account and
picks up on that floor when you come back.

## 1. The move list: every boss's moves with 2 or 3 bosses on one board

**How the bosses share a board (the calls in section 2):** one side, one move a turn, the bosses taking turns in a fixed order, so
each boss still has "his turn" and "his first move", the things nearly every power keys on. Each boss keeps his own meter and his
own powers' state. Picks that need an engine work as today: alone, this device's engines (as Boss alone); in a party, the host's
device with the server checking the answer (as a Boss Battle party). So most moves come in as they are.

**The plain list.** IN: works as it does alone. IN, LIMITED: works, with the one rule in the line. OUT: not in the tower, with
why and what it would need to come in.

| Boss | Move | Kind | In the tower? |
| --- | --- | --- | --- |
| Ginger | Freeze | normal | IN |
| Ginger | Super Freeze | second meter | IN |
| Ginger | Blizzard | ultimate | IN |
| Boingo the Clown | Pie | normal | IN |
| Boingo the Clown | Funhouse | ultimate | IN (the whole board turns, every boss's marks with it; its forced first move is the crowd's, as alone) |
| Jefferson | Sparkler | normal | IN |
| Jefferson | Roman candle | ultimate | IN (its fireballs land on the bosses' half too; no boss's piece burns, as his own never do) |
| Hollow | Dark | normal | IN, LIMITED: never on a floor with Smudgy (both hide what a piece is; a wrong try costs differently under each) |
| Hollow | Lights out | ultimate | IN (a memory test that holds the clock; a crowd that finds too few gives *him* a second move: his turn again before the next boss's) |
| Big Boy | Snack | opening | IN (he eats a center pawn before move 1) |
| Big Boy | Toy-block tower | normal | IN |
| Big Boy | Big Bounce | ultimate | IN |
| Sawyer | Split pawn | opening | IN (on his own first move) |
| Sawyer | Saw cut | normal | IN |
| Sawyer | Board saw | ultimate | IN (its gate, "one half more his on material", reads the whole bosses' side) |
| Wrangler | Long pull | opening | IN (his own first move; if the other bosses already moved the center pawns, an ordinary move, as today when none is sound) |
| Wrangler | Lasso drag | normal | IN |
| Wrangler | SHOWDOWN! | ultimate | IN, LIMITED: his reply to the duel is the bosses' very next move, out of turn (the engine's best, as today), then the order goes on |
| Alfil | Tusks | normal | IN (the fusion is his turn's move) |
| Alfil | Mammoth Slam | ultimate | IN |
| Chub & Chirp | Leapfrog | normal | IN |
| Chub & Chirp | Carrot Patch | ultimate | IN, LIMITED: during the race every boss's move goes through the race brain (`raceGuard`), not only theirs |
| Smudgy | Camouflage | normal | IN, LIMITED: his hidden rook's disguise (`keepsDisguise`) binds every boss's moves, since they all play that rook; never with Hollow |
| Smudgy | Repaint | ultimate | IN |
| Moo & Moon | Moonbeam | normal | IN |
| Moo & Moon | Full Moon | ultimate | IN (the cinematic plays alone in the moments queue; full strength on his own turns only) |
| Puddles | Seeds | normal | IN |
| Puddles | Watering | ultimate | IN |
| Babur | Balloons | normal | IN |
| Babur | Hoops | ultimate | IN (the walls bind every boss's pieces, as they bind his) |
| Folio | Draft | normal | IN |
| Folio | Crease | ultimate | IN (every boss's pieces may cross it, as Folio's do) |
| Folio | Revision | once a battle | IN, LIMITED: only right after a move of *its own* (going back over another boss's move would undo that boss's turn) |
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
| Hidden Boss | No help, Bullet, phase 2 | all | **OUT**: No help switches the God King off for the whole floor, not one boss; his brain is fixed at Maia's top (2500), whatever the floor; Bullet is the whole team's clock; and phase 2 splits the board into four, which other bosses can't share. **To come in:** a floor of his own, alone: the tower's top (open call 6) |
| The Pawn Golem, Bone Archer, Black Knight, Storm Witch, Tower Tyrant, Frost Dragon, Grandmaster Wraith, Demon Lord, Engine Eternal | none yet | | **OUT**: no art or powers (`kit: null`, `powers: null`). **To come in:** be built, like any boss |

**Rules behind the list (each a call):**
- **Only the Hidden Boss is out**, and the bosses not built yet. Everything else's conflicts have a one-line rule above.
- **Never together on a floor:** Hollow and Smudgy. A list (`BATTLE_TOWER.apart`), so a pair the build's fuzz finds can join it.
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

### Floors (proposal)

**12 floors, in three blocks of four: 1, 2, 2, 3 bosses**, Maia rising every block and inside it. A block's first floor is one boss
again, a breather that still steps up in strength (Eric's "1 boss then 2, maybe 2 again, then 3"). The ratings are Maia ratings,
named by Boss alone's levels (`BOSS_DIFFICULTY`) and Maia's floor (`BOSS_BRAIN.maiaRatingMin`, 600):

| Floor | Bosses | Maia | About |
| --- | --- | --- | --- |
| 1 | 1 | 600 | under Very easy (Maia's floor) |
| 2 | 2 | 600 | |
| 3 | 2 | 700 | Very easy |
| 4 | 3 | 700 | Very easy |
| 5 | 1 | 1150 | Easy |
| 6 | 2 | 1150 | Easy |
| 7 | 2 | 1300 | |
| 8 | 3 | 1300 | |
| 9 | 1 | 1600 | Medium |
| 10 | 2 | 1600 | Medium |
| 11 | 2 | 1800 | |
| 12 | 3 | 1800 | |

Every number is a row in `BATTLE_TOWER.floors` (settings.ts), so a playtest changes a number, not code. Hard (2050) and Very hard
(2500) are left for a harder tower later (open call 5): three bosses' powers at Medium are already far stronger than one boss at
Medium. Each boss plays the floor's rating (as Boss alone ignores your rating: `bossAloneMaia`); a party plays the same ratings (as a
Boss Battle party does: no crowd margin).

### The deal

**Which bosses:** at random from the run's seed, **never the same boss twice in a run** while the pool allows (call). Twelve floors
of 1, 2, 2, 3 meet 24 bosses; the playable pool is 14 (18 once the four admins-first bosses are live), so a run meets each playable boss
once before any comes back, the repeats coming last. Never Hollow with Smudgy on a floor (section 1). The next
floor's bosses are dealt when the floor before is won and saved with the run, so stopping and coming back meets the same bosses.

**Your side:** you play **White on every floor** (call): one rule for every floor, every boss is fine as Black, and Hollow already
claims the dark side. Every floor from the starting position, with no book opening (as a Boss Battle).

### Losing, hearts, the end of a run

- **Three hearts a run** (call; the Hidden Boss's phase 2 already shows hearts). A floor lost (mate, out of time, resign) or drawn
  costs a heart and you fight that floor again, its bosses dealt anew. The third heart lost ends the run; your best floor stays on
  your profile.
- **The top:** floor 12 won, the run is complete: its result screen, your best floor "12 (top)", and a new run can start.
- **The God King** comes with his usual charges each floor (as Boss alone), so a floor is always winnable.

### Rewards (proposals, inside the payments design's rules)

The payments design (docs/decisions/2026-11-17-payments-design.md, section 6) pays coins by every counted game's XP minutes plus a
performance bonus for a win, and pays the device's word (a solo game) no bonus. So:
- **Each floor is a counted game**, as a boss battle is today: XP minutes (`XP`, solo floors under the solo cap), play coins,
  the daily reward's game; and a **boss token drop** chance as any boss battle (`countBossBattle`, a token of one of that floor's
  bosses).
- **A floor won online (a party's)** is "a beaten raid boss": the win's XP (+50) and the win bonus (15 coins), through the day's
  diminishing steps like every other bonus. Solo floors: no bonus (the device's word), as Boss alone.
- **The top** gives a profile emblem ("Tower: top"); online only for anything worth coins or a crate (a party's run, which the
  server saw), since a solo run is the device's word (open call 8).
- No new currency, no timers, nothing bought: the payments design's "earn first" rules hold.

## 4. The skyscraper

**Between floors you walk up.** After a floor's result, the **floor scene** (one screen, phone and computer): a floor of the
skyscraper drawn in the game's pixel style, a big sign "FLOOR 3" on its wall, the stairs at one end. Your pawn (a party's pawns, in
seat order, in their seat colors) walks from the door to the stairs and up (transforms only, as the 1 v 1 stage's pawn drops: about
3 s); the scene is drawn again the same with the sign now "FLOOR 4" (Eric: "the same floor redrawn as stage 2"), the next floor's
bosses stand at the far end in their idle sprites (the reveal: names under them), and the board slides in.

- **Nothing hidden:** the run's strip is always at the top of the scene and the game screen ("Battle Tower · Floor 4 of 12", the
  hearts, the bosses beaten as small portraits); **Continue** and **Stop here (saved)** are always on the scene, greyed while the
  pawns walk.
- **Phone:** the scene fills the game frame above the two buttons; the pawns and the bosses whole on screen. **Computer:** the
  scene in the board's column, the right column as on home. A light and a dark scene.
- **Reduced motion:** no walk; the sign changes with a fade.
- One floor drawing for every floor (its number and the bosses change), so the art is one job (the characters lane, its own
  still for Eric first). A later idea: the tower as a building in Chess Town (open call 11).

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
  floor INTEGER NOT NULL,    -- the next floor to fight (1-12)
  hearts INTEGER NOT NULL,   -- left (3 to 0)
  met TEXT NOT NULL,         -- JSON: the bosses met so far (never twice), and the next floor's deal
  members TEXT,              -- a party's: JSON [{ uid, fromFloor }]
  fight TEXT,                -- the floor under way: { id, startedAt, restarts } (solo) or { lobby } (a party's); null between floors
  status TEXT NOT NULL,      -- 'open' | 'top' | 'out' | 'abandoned'
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
CREATE UNIQUE INDEX tower_runs_open ON tower_runs (user_id, kind) WHERE status = 'open'   -- one open run each, solo and party
tower_best (user_id TEXT, kind TEXT, floor INTEGER, at INTEGER, PRIMARY KEY (user_id, kind))  -- the profile's best floor
```

**Routes:** `GET /api/tower` (your open runs and bests), `POST /api/tower/run` (a new run: replaces an open one after a confirm),
`POST /api/tower/floor/start` and `/finish` (solo: the server notes the start's time, as `startSoloBattle` / `finishSoloBattle` do,
and accepts a result only for the floor it started), `POST /api/tower/stop`. A party's floor is written by its match room as it
saves results (`lobby-do.ts`, `writeResult`), never by a device.

**Mid-floor:**
- **Solo** (on the device, as Boss alone): a floor in progress isn't saved. A reload or a closed app restarts that floor with the
  same bosses, **free once a floor** (`fight.restarts`), so a crash costs nothing; the second time, or Leave mid-floor after your
  2nd move, counts as the floor lost (a heart), so leaving can't dodge a loss. Before your 2nd move, Leave is free.
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
  stand in the floor scene and on the result.
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
today's 56 px, the picture over the name on a phone (no room beside it at 390 px), the short line on a computer ("Climb 12 floors").
Its picture: the skyscraper. Tapping it opens the tower's own screen: your run (floor, hearts, the next floor's bosses: "Continue
floor 5") or "Start a run", Solo or Party (the party's invite circles as Boss Battle's), and your bests. Mockup first.

## 7. The build plan

Each PR on its own branch. The layer first; then several bosses on one board; then the tower around them.

| # | PR | Lane | Effort | Size |
| --- | --- | --- | --- | --- |
| 1 | **The board layer**: `board-layer.ts` (marks, `layerStop`, `layerMoves` with the lift, `followLayer`, `wearLayer`), Sawyer's edge helpers moved in, unit tests (every mark, overlaps, the lift, castling, promotion, en passant) | targeted | xhigh | ~400 lines |
| 2-5 | Today's bosses onto the layer, one family a PR (held pieces; square marks; edges; shields) | boss | xhigh | small to medium each |
| 6 | **Several bosses in the runner**: `bosses: BossState[]`, the turn order, every boss's turn steps, the merged layer, one ultimate and one cinematic a turn change, `rageScale`; the boss kit run over pairs and threes (seeded), `BATTLE_TOWER.apart` from what it finds | boss, and the director may mark it full (the runner's core) | xhigh | large |
| 7 | Mockup stills for Eric (`stills/battle-tower`): the bar with 2 and 3 bosses (phone, computer), the floor scene, the tower's screen, the home row | light | high | one still a platform |
| 8 | **The climb's rules**: core `tower.ts` (the floors, the deal, hearts, the run's steps), `BATTLE_TOWER` in settings.ts, unit tests | targeted | xhigh | small |
| 9 | **Saving**: `tower.ts` on the server (the tables, the routes, the sign-in merge, export and delete) | **full** (stored data) | xhigh | medium |
| 10 | **Solo tower screens**: the tower's screen, the battle with 2-3 bosses on the bar and beside the board, the moments queue, the run's strip, the result; `e2e/battle-tower.spec.ts` and its `e2e/areas.json` entry | targeted | high | large |
| 11 | **The floor scene** (its art in the characters lane, its still first) | targeted | high | medium |
| 12 | **The party**: kind "tower", max 4, the lobby's floors on the party rule with `closeCp` 0, the room writing the run | **full** (stored data, the server) | xhigh | medium |
| 13 | The home card and its check in `e2e/home-layout.spec.ts` | light | medium | small |
| 14 | One sim run: bot climbers through the 12 floors, alone and as a party of 4, for the Maia curve and `rageScale` (`reports/tower-sim.md`) | light | medium | small |

## Open calls for Eric (one line each)

1. The move list: anything OUT you want IN, or IN you want OUT? (Only the Hidden Boss is out.)
2. The bosses take turns in the order dealt (each keeps "his turn"), rather than the strongest always moving: OK?
3. Hollow and Smudgy never on one floor: OK?
4. 12 floors in blocks of 1, 2, 2, 3 bosses, Maia 600 up to 1800 (the table): OK, or another count or curve?
5. A harder tower later (Hard and Very hard, 2050 to 2500), or one tower going higher?
6. The Hidden Boss as the tower's top floor (alone, after floor 12)?
7. Three hearts a run, a draw costing a heart, the floor's bosses dealt anew after a loss: OK?
8. The top's reward: an emblem; and a crate or coins only for a party's run (the server saw it), since solo is the device's word?
9. You play White on every floor: OK?
10. A tie in a party goes to the engine's best always (no 30-centipawn random): OK?
11. The tower as a building in Chess Town later, or only the home card?
12. Never the same boss twice in a run (while the pool allows): OK?
13. A solo floor's reload restarts it free once; leaving after your 2nd move costs a heart: OK?
14. Each boss's meter slower on shared floors (100%, 75%, 60% for 1, 2, 3 bosses) to start, tuned by the sim: OK?
