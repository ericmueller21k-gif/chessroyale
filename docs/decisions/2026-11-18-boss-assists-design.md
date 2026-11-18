# Boss Assists: a new mode, the design (Nov 18, 2026)

**Status: design only, nothing built.** The calls below are the director's and this design's; each waits for Eric's OK
(the open calls, one line each, are at the end). Area stub: [docs/areas/boss-assists.md](../areas/boss-assists.md).

**Eric, Nov 18:**
- "a game mode where each player chooses 3 bosses and is able to use their moves during the game as 'assists'"; then: "To make
  it easiest, bosses are randomly chosen 3 per side, some moves like you said we just simply don't include in this mode. I'd say
  it's 2 normal moves and then 1 ultimate assigned at start. It would not replace any mode we would shove it next to autochess."
- "every tile on the board marked as open, closed, pass through but can't land, totally blocked, etc. things would also overlap
  which gets chaotic, but that's sorta the idea."
- "Each player would get a meter that builds that allows them to use moves"; "nothing is selectable ... it picks the same way it
  does today".

**The mode in one paragraph.** A 1 v 1 game of chess between two players (a bot if nobody comes). At the start each side is dealt
three random bosses and shown them: two give a normal move, the third its ultimate. Each player has a meter that fills as they
play; on their own turn they tap an assist they can afford, it lands as the opponent's turn begins (after their move), and its
boss picks its target exactly as it does in a raid, with the caster as "the boss" and the opponent as "the crowd". What the
assists do to movement goes on one shared board layer, both players' effects on it at once, the most restrictive winning.

## The calls (for Eric's OK)

1. **Three bosses a side, one assist each** (the director): two of them give their normal move, the third its ultimate; which of
   the three gives the ultimate is random. Reason: Eric's "2 normal moves and then 1 ultimate assigned at start", with one boss
   per button so the bar reads as three bosses.
2. **1 v 1 against a person, bots fill** (the director): its own queue, paired as Ranked 1 v 1's queue pairs (first come, no
   rating), a bot game on the device if nobody comes in `BOSS_ASSISTS.botAfterSeconds`. Reason: "next to autochess" is a side
   mode; Auto Chess's own matchmaking is a bot in the browser, and the 1 v 1 game object already runs two-player chess with clocks.
3. **Left out** (the director): a move that spends the boss's whole turn, plays a move for anyone, or is a character's cinematic
   (Moo's Full Moon, Chandy's Dodge, the Hidden Boss).
4. **Also left out (this design):** a move whose pick is an **engine search** (the host's engines today: `bounceFrom`,
   `dragOptions`, `slamFrom`, `hopFrom`, `repaintFrom`, `waterFrom`, `landFrom`, `hoopsFrom`, `creasePick`). Reason: in a raid
   the host is one of a crowd and the server checks its answer against the rules and a band; in a 1 v 1 both devices belong to
   a player with a stake in the pick, and the server runs no search. Every move kept picks by a pure function of the position and
   the seed (each boss's `choose*`), so the server runs it for free and both screens agree. Engine picks can come back later on
   the engine server (open call 3).
5. **Also left out:** hidden information (Hollow's dark, Smudgy's painted rook: a 1 v 1 sends both players everything), an
   opening-only power (Big Boy's snack, Sawyer's split pawn, Wrangler's long pull, Smudgy's forced moves), a real-time workshop or
   garden of its own (Timber's Scraps, Puddles' Seeds, Babur's Balloons), a power that steers the boss's own engine (Chandy's
   Lock-on), and the God King's part (no God King in a 1 v 1).
6. **One normal move per boss.** A boss with several (Ginger's Freeze and Super Freeze; Chandy's four landing moves) gives one:
   Ginger the Freeze; Chandy one of his four, drawn with the bosses at the start and shown at the reveal (call 6 in the list).
7. **Targets are never picked by a player** ("nothing is selectable"). The assist's boss picks on the position after the
   caster's move, from the game's seed. A pick that finds nothing then **fizzles and refunds** the meter.
8. **Admins-first bosses** (`BOSS_ADMIN_FIRST`: Timber, Dash, Don Dough, Chandy) are dealt only once they're live for everyone,
   as every other mode does (`isPlayable`); an admin's test switch (`?assists=<id>,<id>,…`) deals any.

## 1. The assist list

**The two-way version, for every row:** the caster plays "the boss" and the opponent "the crowd": the boss's pick function is
called with `crowd` = the opponent's color and the game's seed (`powerRoll(seed, "assist", ply, slot)`), and "his pieces" are
the caster's. **Lands:** as the opponent's turn begins, after the caster's move, unless the row says otherwise. **Lasts:** counted
in the opponent's turns (their moves), as the bosses count crowd turns; the numbers are the boss's `BOSS_POWERS` ones unless the
mode's copy (`BOSS_ASSISTS.numbers`, below) says otherwise. Every BOSS_ROSTER entry is listed, in roster order.

### Ginger (`gingerbread`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Freeze | normal | **in** | Pure pick (`chooseFreeze`) | One of the opponent's pieces that matters is iced: it can't move (never the king). | `freezeTurns` (2) of their turns |
| Super Freeze | (second meter) | out | One normal move per boss (call 6); it's the Freeze made bigger, kept in reserve | (would be: the 3 x 3 round their most crowded piece held, `chooseSuperFreeze`) | |
| Blizzard | ultimate | **in** | Pure picks (`chooseBlizzard`, `blizzardStep`, `pickThaw`) | Every one of their pieces but one (a random one with a move) is iced; the next turn 4 or 5 are free, then all. | `blizzardTurns` (3) |

### Boingo the Clown (`clown`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Pie | normal | **in** | Pure pick (`choosePieThrow`) | A pie in the face of one of their pieces whose two squares diagonally behind it are empty; it splits onto those two: nobody, either side, lands there. The piece gets a splat (it follows the piece: `followSplats`); a second splat from the same caster holds it a turn. | `pieTurns` (1) |
| Funhouse | ultimate | out | It plays the opponent's first move for them (the joke's forced move), and the turned board is only one player's view | | |

### Jefferson (`grex`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Sparkler | normal | **in** | Pure pick (`chooseSpark`) | A tile on their half (never their king's) catches fire and burns in stages; a piece of theirs still on it after their move on the last stage burns (gone; never the king, never when it would leave a king in check: it fizzles, `burnOutcome`). | `fireStages` (3) |
| Roman candle | ultimate | **in** | Pure picks (`chooseFireballs`, `fireShadows`) | Waves of fireballs, each wave's squares shown as growing shadows a few turns ahead, landing as fire tiles; some fall on the caster's half, where the caster's pieces never burn. | the mode's shorter waves (`BOSS_ASSISTS.numbers.candleWaves`, proposed [1, 2, 3, 2, 1]; a raid's is 9 waves, 24 shots) |

### Hollow (`hollow`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Dark | normal | out | Hidden squares and a wrong try that costs points: a 1 v 1 has no secret view and no points |
| Lights out | ultimate | out | A memory test whose prize is his extra move: a minigame that plays a move |

### Big Boy (`bigboy`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Snack | opening | out | Before move 1 only | | |
| Toy-block tower | normal | **in** | Pure picks (`chooseBlock`, `scatterSquares`) | A block lands on an empty square in their half and one more stacks on it as each of their turns begins. A wall (nothing lands or slides through, either side; a knight jumps it) until `towerEnter` (2) blocks, then a piece may land on it, which topples it; at `towerMax` it wobbles a turn and topples. Its scattered blocks are one-turn walls nearby. In the mode both sides topple it alike (no engine-picked share for the caster). | until toppled |
| Big Bounce | ultimate | out | Engine pick (`bounceFrom`), call 4 | | |

### Sawyer (`sawyer`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Split pawn | opening | out | His first move only, and it adds a pawn | | |
| Saw cut | normal | **in** | Pure pick (`chooseCut`) | One edge between two neighboring squares in their half that one of their moves would cross: nothing (either side) moves straight across it; diagonals pass at the corners, knights jump. | `sawTurns` (3) |
| Board saw | ultimate | **in** | Rule-based (`crossesMiddle`) | The board sawn between the d and e files: no move crosses, knights included, either side. The raid's gate (`boardSawFrom`, `favouredHalf`) is dropped: the caster picks the moment. | `boardSawTurns` (5), and the caster's moves between |

### Wrangler (`pig`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Long pull | opening | out | His first move, played for him |
| Lasso drag | normal | out | Engine pick (`dragOptions` in the `dragLoss` band), call 4 |
| SHOWDOWN! | ultimate | out | An engine line-up (`checkLineup`) that forces the opponent's next move, and engine-best replies (`bestReply`) |

Wrangler has nothing in the mode: he's never dealt.

### Alfil (`alfil`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Tusks | normal | out | The fusion is his whole turn, and an engine pick (`fuseFrom`) |
| Mammoth Slam | ultimate | out | Engine pick (`slamFrom`) |

Never dealt.

### Chub & Chirp (`hopper`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Leapfrog | normal | out | His pawn's hop is a move played for him (engine pick `hopFrom` when several can) |
| Carrot Patch | ultimate | out | His whole turn, then a race with its own brain (`raceGuard`) |

Never dealt.

### Smudgy (`smudgy`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Camouflage | normal | out | Forced moves of his own, then a hidden rook (a secret a 1 v 1 can't keep) |
| Repaint | ultimate | out | His whole turn, and an engine pick (`repaintFrom`) |

Never dealt.

### Moo & Moon (`moo`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Moonbeam | normal | **in** | Pure pick with the shipped target "random" (`chooseBeams`, `beamOrder`; the "best" target needs an engine and stays the raid's) | One of their pieces with a move, at random, is stunned: it can't move (it still attacks and defends). Never the king; always a move left. | their next turn |
| Full Moon | ultimate | out | A cinematic (`MooCinematic.tsx`), and its strength is the boss's own engine (call 3) | | |

### Puddles (`gardener`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Seeds | normal | out | A real-time count that does nothing without Watering |
| Watering | ultimate | out | His whole turn, and an engine pick (`waterFrom`) |

Never dealt.

### Babur (`tiger`, playable)

| Move | Kind | In? | Why |
| --- | --- | --- | --- |
| Balloons | normal | out | A real-time pump that adds pieces, placed by the engine (`landFrom`) |
| Hoops | ultimate | out | Engine pick (`hoopsFrom`); its walls also stop attacks, so they change checks (the one movement limit the layer doesn't model). The first candidate to come back with a seeded placement (open call 10) |

Never dealt.

### Folio (`folio`, playable)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Draft | normal | **in** | Pure pick (`chooseDraft`, `attackStands`) | An ink mark under the most valuable of their defended pieces that one of the caster's pieces attacks (never one a cheaper piece attacks). They have `draftWindow` (2) of their moves to end that attack; if it still stands, the piece is folded: it can't move. The mark clears as the attack ends. Nothing attacked: it fizzles (refund). | the window, then `foldTurns` (4) |
| Crease | ultimate | out | Engine pick (`creasePick`) | | |
| Revision | once a battle | out | It crosses moves out and plays the engine's best (`bestReply`) | | |

### Timber (`timber`, admins first)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Scraps | normal | out | A real-time workshop of its own that drops whole pieces for the caster: a meter inside the meter, and more than a normal move is worth | | |
| Gnaw | ultimate | **in** | Pure pick (`gnawPick`, seeded) | One of their pawns, at random, is eaten (its guards: never a new check on their king, never them without a move, never a position Stockfish refuses). The scraps go nowhere. Greyed while they have no pawn on ranks 2 to 7. | at once (a base) |

### Dash (`dash`, admins first)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Clock Slap | normal | **in** | No pick at all | Their clock loses `BOSS_ASSISTS.numbers.slapSeconds` (proposed 15 s; a raid's bank slap is 30) as their turn begins, never below `slapFloorSeconds` (proposed 10 s): it takes what's above the floor, and a slap that would take nothing doesn't come (refund). Per cast, not per capture. | at once |
| Time Scramble | ultimate | out | In a raid a flag plays a move for you (`flagMove`); in a 1 v 1 a flag loses. Neither fits | | |
| Scramble Rush, clock multi-hit, pop-off | extras | out | A memory test with an extra move; skits | | |

### Don Dough (`zebra`, admins first)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Rising Dough | normal | out | It adds a piece to the caster's army after an 8 to 21 move oven timer: more than a normal move is worth, and it outlives most of a game's assists | | |
| Gold Plate | ultimate | **in** | Pure pick (`gildPick`) | The caster's queen (else their strongest piece that isn't a king or pawn) turns gold: the opponent's pawns can't capture it. It keeps its gold as it moves (`goldAfter`). Greyed with nothing to gild. | the rest of the game |

### Chandy (`chandy`, admins first)

| Move | Kind | In? | Why | Cast by a player | Lasts |
| --- | --- | --- | --- | --- | --- |
| Lock-on | normal | out | It steers his engine's own moves (`steerPick`); in a 1 v 1 the player moves | | |
| Scatter shot | normal (one of four) | **in** | Pure pick (`chooseScatter`) | Four empty squares round a spot, the ones taking away most of their moves: nobody lands on one; a slide passes through. | their turn and the caster's move after it |
| Beam | normal (one of four) | **in** | Pure pick (`chooseBeam`) | A rank and a file (never their king's) holding the most of their pieces: its squares are walls for them (nothing lands or slides through; a knight jumps), and their pieces on it can't move. | their turn |
| Shields | normal (one of four) | **in** | Pure pick (`chooseShields`) | Two of the caster's pieces they attack (else the caster's two most valuable; never the king or a piece giving check): their pieces can't take them. | their turn |
| Rapid fire | normal (one of four) | **in** | Pure pick (`chooseRapid`) | Three of their pieces with a move, at random, never the king: held. | their turn |
| Queen lock | normal | out | His whole turn | | |
| Dodge | ultimate | out | A cinematic minigame | | |

Chandy gives one of his four kept moves, drawn at the start (call 6).

### The Hidden Boss (`recluse`, admins only) and the bosses without powers

- **The Hidden Boss:** out entirely (the director's call: a character's cinematic; his "nohelp" is about the God King, who isn't
  in a 1 v 1; "bullet" is his phase's clock).
- **The Pawn Golem, the Bone Archer, the Black Knight, the Storm Witch, the Tower Tyrant, the Frost Dragon, the Grandmaster
  Wraith, the Demon Lord, the Engine Eternal:** no powers yet (`powers: null`): never dealt. A boss built later goes through
  the same test (call 3 to 5) and gets its row here.

### What that leaves (today's playable pool)

| | Playable now | Admins first (join when live) |
| --- | --- | --- |
| Normal moves | Ginger's Freeze, Boingo's Pie, Jefferson's Sparkler, Big Boy's Toy-block tower, Sawyer's Saw cut, Moo's Moonbeam, Folio's Draft (7) | Dash's Clock Slap, Chandy's four (2 bosses) |
| Ultimates | Ginger's Blizzard, Jefferson's Roman candle, Sawyer's Board saw (3) | Timber's Gnaw, Don Dough's Gold Plate (2) |

**The deal** (`dealAssists`, from the game's seed): shuffle the pool; each side's ultimate boss first (the next boss with an
ultimate in, White's then Black's), then four bosses with a normal move in, alternating White, Black; **six different bosses**
(call 9), never two the same on a side. Today's playable pool always deals (3 ultimate bosses for 2 seats; 5 or more normal ones
left for 4). Bosses resting (`rosterWithout`, kill switches) shrink the pool; too small for six, repeats across the two sides are
allowed; too small even for that (no ultimate boss, or fewer than two normal ones), the mode's card greys ("Resting"), as the ways
in close first elsewhere.

## 2. The board layer

Eric's idea, and worth doing **on its own, before the mode and whether or not the mode ships**: today every boss answers "can
this piece go there" in its own code (`held`, `crowdFilter`, `bossStops`, `stopReason`, `iced` in `BossRules`), so two powers
have never had to share a square, and each new boss writes its own filter and its own refusal words. One layer gives every boss
one place to write, one combine rule, one lift, and one list the screens draw from.

### One state per square, edge and piece

A new pure module, `packages/chess/src/board-layer.ts` (no boss imports; core's `StopReason` names the marks):

- **Square marks** (`SquareMark`: `square`, `kind`, `binds`, `noLand`, `noPass`, `until`, `by`):
  - **open**: no mark;
  - **no landing, pass through** (`noLand`): Boingo's pie, Chandy's scatter shot, Don Dough's lump (his pieces only);
  - **no landing, no passing** (`noLand` + `noPass`, a wall a knight jumps: a jump passes over nothing, `moveSquares`): Big Boy's
    block and scattered blocks, Puddles' plain plant, Chandy's beam;
  - **no passing, landing allowed** (`noPass`): Big Boy's tower from `towerEnter` (landing topples it: the tower's own step);
  - **fire** (`kind: "fire"`, no movement limit; its stage for drawing and for the burn step): Jefferson's tiles.
- **Edge marks** (`EdgeMark`: `a`, `b` (two neighboring squares), `kind`, `binds`, `across`, `until`):
  - **straight** (`across: "straight"`): no rank or file move crosses; diagonals pass at the corners; knights jump: Sawyer's cut;
  - **all** (`across: "all"`): nothing crosses, knights included: the board saw (the 8 d|e edges); Folio's crease (binds the
    crowd only).
- **Piece marks** (`PieceMark`: `square`, `kind`, `binds`, `held?`, `shieldFrom?`, `until`), **which follow their piece**:
  - **held**: can't move (still attacks, defends, blocks): Ginger's freeze and ice, Moo's stun, Folio's fold, Chandy's beam and
    rapid fire, Boingo's second splat;
  - **shielded** (`shieldFrom: "pawns" | "all"`): the side `binds` names can't capture it: Don Dough's gold (pawns), Chandy's
    shields (all);
  - **marked** (no movement limit, drawn): Boingo's splat, Folio's draft, Chandy's lock.
- **`binds`**: `"both"` or one side: whose moves the mark limits. **`until`**: the turn it wears off (null: until a step
  removes it). **`by`**: who put it there (a boss id in a raid; the caster's color and slot in the mode).

### Functions (all pure, the same on the server, solo and every screen)

- `layerStop(layer, fen, move): StopReason | null`: the first mark that stops a legal `move` for the side to move: its landing
  square (`noLand`), the squares it passes (`noPass`, from base.ts's `moveSquares`, castling's way included), the edges it crosses
  (Sawyer's `moveEdges` / `edgeOf`, moved into the layer), a held mover (base.ts's `heldIn`, castling with a held rook included), a
  shielded target. The refusal words come from it.
- `layerMoves(layer, fen, legal = legalMoves(fen)): { moves: string[]; lifted: boolean }`: the legal moves no mark stops, and
  **the lift in one place**: none left, every legal move (`lifted: true`), as `crowdAllowed` lifts today. Only chess-legal moves
  are ever filtered, so check is always answered.
- `followLayer(layer, move, fenBefore)`: piece marks move with their piece (the castling rook's too; a promotion keeps it), and
  go when it's captured; square and edge marks stay.
- `wearLayer(layer, turn)`: drops what wore off.

**Overlaps:** a move is allowed only if no mark stops it, so the most restrictive wins with no precedence table: a pie on a
square inside a beam is a wall; a held piece behind a saw cut stays held; a gold piece inside a scatter shot's squares can't be
landed on at all. Marks never stop attacks: pins and checks work across every one of them, as every boss's limits do today.

### Moving today's bosses onto it, without changing a boss battle

`BossRules` gets one optional hook, `layer?(boss: BossState, fen: string): BoardLayer` (the marks its powers have on the board
now, each `binds` the crowd, the boss or both). The dispatcher (`boss-powers.ts`) builds one layer from it and reads it in
`limitCrowd` (the crowd's side), `bossAllowed` (the boss's), `stopReason`, `icedSquares` and `boardAltered`, then the boss's own
remaining `crowdFilter` as today, then the Last Stand's `barred`, in today's order. One boss family a PR:

| PR | Bosses | Today's code it replaces |
| --- | --- | --- |
| Held pieces | Ginger (freeze, blizzard, Super Freeze), Moo (stun, flurry), Folio (fold), Chandy (beam's held, rapid fire), Boingo (second splat) | each `held` (already one rule, Oct 27): it returns piece marks instead |
| Square marks | Boingo (pies), Big Boy (tower, scatter: `toyStops`), Puddles (plants), Chandy (scatter, beam walls), Don Dough (lumps: `bossStops`) | their `crowdFilter`, `bossStops`, `stopReason` parts |
| Edges | Sawyer (cuts, board saw: `crossesCut`, `crossesMiddle`, `sawStops`), Folio (crease: `crossesCrease`) | the same |
| Shields | Don Dough (gold: `pawnOnGold`, `zebraStop`), Chandy (shields: `takesShield`) | the same |

What stays outside the layer: Babur's hoops (`hoopStops`: they block attacks, a change to chess itself), Smudgy's paint (a second
board), Hollow's dark (unchecked tries), Wrangler's showdown (a "must" list, not a limit), Chub & Chirp's carrots, Ginger's
Super Freeze's own let-go before the general lift (kept inside his `held`), Big Boy's seeded topple share for his own pieces
(kept in his step).

**The guard, so no battle changes:** each migration PR edits no existing assertion. It runs the shared boss kit
(`packages/chess/test/boss-kit.test.ts`: every boss in `BOSS_ROSTER`, Stockfish as referee), `e2e/boss-smoke.spec.ts`, and the
boss's own unit tests and spec, plus a twin test for its life only: over the kit's battles and the boss's test positions, the old
path and the layer give the same allowed moves (both sides) and the same `stopReason`; the old path and its twin test are deleted
in the same PR. Boss lane each.

## 3. The mode

### The start: the reveal

The 1 v 1 stage as it is (`components/DuelStage.tsx`: your pawn, "Finding opponent…", the found moment, the colors). The
time-control vote is replaced by **the reveal** (`BOSS_ASSISTS.revealMs`, proposed 6 s): both sides' three bosses drop in one at
a time, alternating, each a card (the boss's portrait, its name, the move's name, one line of what it does, its cost), the
ultimate's card gold-rimmed; yours under your pawn, theirs under theirs. Then the board. Nothing changes after the reveal: the
cards become the assist bar's buttons.

**Clock (call):** a fixed control, `BOSS_ASSISTS.control` (proposed `blitz-rapid`, 5 + 3, from `RANKED_1V1.controls`), no vote:
the reveal takes the vote's place and the assists' moments hold the clock.

### The meter (proposals)

**A, the recommended one: it fills by play, on the server, from the game itself.** Points 0 to `meterCap` (10): +1 for each of
your moves, +1 for each pawn of yours taken and +2 for each other piece (the raids' meter fills on the boss's material lost the
same way: `ragePerMaterial`), the extra past the cap wasted. **A normal move costs 4, the ultimate 8**, the ultimate at most
`ultMax` (2) a game. So the first assist is possible from your 4th move and an ultimate from your 8th; a 40-move game gives each
side about five casts. Shown as a bar of 10 notches with marks at 4 and 8, yours and theirs (nothing hidden).

**B: real time** (one point every N seconds on the server's clock, as Puddles' seeds and Timber's scraps fill: base.ts
`ticksAt`). Not recommended: a slow thinker gets more assists, and it needs the clock's pauses accounted for.

### The three buttons (the assist bar)

One row of three equal buttons on your side of the board (a phone: under the board, where the 1 v 1's strip area is; a computer:
the same row under the board), each the boss's portrait, the move's name and its cost in notches. Fixed size and place:
- **greyed** (muted, still shown, never hidden) when it isn't your turn, you can't afford it, the ultimate's `ultMax` is spent,
  or it can't apply whatever you move (Gnaw: they have no pawn on ranks 2 to 7; Gold Plate: nothing to gild); a tap says why in
  a few words ("Need 2 more", "No pawn to gnaw"), as Auto Chess's dimmed buys do;
- **ready**: lit; a tap **arms** it: pressed and pulsing, "Lands after your move"; a second tap disarms it. One armed at a time;
- the opponent's three are shown small by their strip, with their meter, greyed or lit the same way.

### Timing: never two assists animating at once

1. Only the side to move can arm, and an armed assist lands only as their move lands. So one cast at most per turn change.
2. **The order at a turn change:** the move; the cast's moment (the power's banner with the caster's own pawn and the boss's
   portrait, Eric's rule of Nov 5, then the boss's own effect: the ice, the pie, the fire…, its length `powerFxMs`); then the
   lasting marks' steps that fall due (a tile burning, a tower stacking or toppling, a draft folding, the blizzard thawing), one
   at a time, oldest cast first. One queue, `moments`, each with its server time.
3. **The clock holds** through the queue: the opponent's turn (`turnAt`) starts after the last moment, as Chandy's upgrade window
   holds the clock today.

### The end

As a 1 v 1 ends (`duel/rules.ts`): mate, resignation, time, the draws. An assist never ends the game by itself: the lift keeps a
move, and the burn and the gnaw keep their guards (no new check, a move left). The result card is the 1 v 1's, with each side's
casts listed. Unranked, with the XP of an unranked game (open call 4).

### Its place on home

A third card under **Other modes**, beside Boss Battle and Auto chess (`Home.tsx`, `rd-pair`): the row's three cards each a
third wide at today's 56 px, the picture over the name on a phone (no room for the short line beside it at 390 px), the line kept
on a computer. Its picture: the three bosses' faces (Boss Battle's rotating face, `BossCardFace`, three at once). A mockup still
for Eric first (eric.md, "Mockup first").

### Bots

After `botAfterSeconds` (proposed 20) unpaired, a bot game starts on the device (the 1 v 1's `BotDuel` in `packages/app/src/duel.ts`
with the assist rules, as its "Play a bot (unranked)" is today), the stage counting down to it ("A bot joins in 0:14": nothing
shifts). The bot arms an affordable assist on a seeded share of its turns (`botCastShare`), its ultimate first when it can; the
same deal, meter and picks as a person's.

## 4. Online and fair play

- **The server runs every assist.** The game object is the 1 v 1's (`duel-do.ts`, `duel-room.ts`) with a mode
  (`mode: "assists"`), on its own queue (`assists-default` on the matchmaker, `queue.ts`; paired first come, no rating). The deal
  and every pick come from the game's seed, kept on the server (never in a view), on the position after the caster's move; the
  app never decides anything. Picks are pure functions (no engine), so a cast costs a few chess.js calls.
- **What the protocol carries** (`duel/protocol.ts`, `DUEL_PROTOCOL` 2; a 1 v 1 view never carries it): `DuelView.assists`:
  each side's three slots (boss id, power id, normal or ultimate, cost), each side's meter and ultimates used, the armed slot,
  the layer (square, edge and piece marks), and the `moments` queue (kind, caster, squares, server time, length). From the app:
  `{ t: "assist", slot }` and `{ t: "unassist" }`. A move the layer stops is refused (`Refusal` "blocked", with its
  `StopReason`), but the app greys those moves first with the same `layerMoves` on the view's layer, so the two agree.
- **Positions changed outside a move** (a burn, a gnaw) are bases, as boss battles keep them (`BoardState` bases): `DuelState`
  gains `bases` (optional; Ranked 1 v 1 never sets it), so replays and fair play's check play from them.
- **Fair play:** a 1 v 1 has no judged picks, so no signals and no part in the suspicion score (fairplay.md, "1 v 1"); reports,
  chat and bans work as in a 1 v 1. If the mode is ever ranked, the plies an assist touched (`assistPlies`: the mover's moves were
  limited by the layer, or a base came before them) are skipped by the engine check (`checkDuelGames`, `fairplay-duel.ts`), as a
  raid's power turns are (`powerTurn`); the check ranks a pick only among the moves the layer allowed.
- **Computing priorities:** nothing here needs an engine: no device work, no server engine cost.

## 5. The build plan

Each PR on its own branch. The layer first; the mode needs only PR 1, not the migrations (PRs 2 to 5 can run beside the mode).

| # | PR | Lane | Effort | Size |
| --- | --- | --- | --- | --- |
| 1 | **The board layer**: `board-layer.ts` (marks, `layerStop`, `layerMoves` with the lift, `followLayer`, `wearLayer`), Sawyer's edge helpers moved in, unit tests (every mark kind, overlaps, the lift, following through castling, promotion, en passant) | targeted | xhigh | ~400 lines |
| 2 | Held pieces onto the layer (Ginger, Moo, Folio, Chandy, Boingo) | boss | xhigh | small |
| 3 | Square marks onto the layer (Boingo, Big Boy, Puddles, Chandy, Don Dough) | boss | xhigh | medium |
| 4 | Edges onto the layer (Sawyer, Folio) | boss | xhigh | small |
| 5 | Shields onto the layer (Don Dough, Chandy) | boss | xhigh | small |
| 6 | **Duel bases and a move filter**: `DuelState.bases`, `move()` takes an optional allowed list and refuses "blocked", fair play's replay from bases | targeted | xhigh | small |
| 7 | **The assist rules**: `packages/chess/src/assists/` (the list as data, `dealAssists`, the meter, `castAssist` calling each boss's `choose*`, the steps), `BOSS_ASSISTS` in settings.ts (the mode's numbers, its copy of the boss numbers it changes), unit tests, a short fuzz of random games with random casts with Stockfish as referee (the boss kit's `positionProblems`) | targeted | xhigh | medium-large |
| 8 | **The server**: the queue, the game object's mode, protocol 2, the moments queue and the clock hold | targeted (the director may mark it full: it adds to the 1 v 1 protocol) | xhigh | medium |
| 9 | Mockup still for Eric (`stills/boss-assists`): the reveal, the assist bar's states, the home row | light | high | one still a platform |
| 10 | **The screens**: the reveal, the assist bar, the marks drawn from the layer (each boss's own effect sprites, `characters/effects/<boss>.ts`), the moments queue, the bot game; `e2e/boss-assists.spec.ts` and its `e2e/areas.json` entry | targeted | high | large |
| 11 | The home card and its check in `e2e/home-layout.spec.ts` | light | medium | small |
| 12 | One sim run, bot against bot, for the meter's numbers (`reports/assists-sim.md`) | light | medium | small |

## Open calls for Eric (one line each)

1. The director's three calls (three bosses, one assist each, the ultimate's boss random; 1 v 1 with bots filling; whole-turn,
   move-playing and cinematic moves out): OK?
2. Engine-picked moves out (Bounce, drag, Slam, Repaint, Watering, Hoops, Crease…): OK for the first version?
3. Bring them back later on the engine server (a cost per cast), or never?
4. Ranked or unranked, and coins or XP for a game? (Proposed: unranked, an unranked game's XP, no coins.)
5. The meter: A (by play: 10 notches, normal 4, ultimate 8, ultimate twice a game at most) or B (real time)?
6. Chandy's one normal move: drawn from his four at the start, or always one (which)?
7. Ginger's normal move: the Freeze, or the Super Freeze?
8. The clock: fixed 5 + 3, or keep the 1 v 1's vote?
9. Six different bosses in a game (never the same boss on both sides), or may both sides get the same boss?
10. Babur's Hoops with a seeded placement (no engine band): in, or wait?
11. Dash's slap: 15 s, never below 10 s left?
12. A pick that finds nothing after your move fizzles and refunds the meter: OK?
13. Home: a third card in Other modes, the three a third wide (mockup first): OK? And the mode's name: "Boss Assists"?
14. The board layer on its own, moving today's bosses onto it (PRs 2 to 5): go now, before the mode?
