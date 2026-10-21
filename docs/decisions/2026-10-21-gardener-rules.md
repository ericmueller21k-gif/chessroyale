# Puddles, the hippo gardener, in the rules: Seeds and Watering (Oct 21, 2026)

A new raid boss (Eric, Oct 20): **Puddles, the hippo gardener** (id `gardener`), a realistic hippo with a garden hose.
His name (Eric, Oct 21) is one string, `GARDENER_NAME = "Puddles"` (core `boss.ts`): a plain name like Smudgy's, so no
`the` on his roster line ("Puddles" at a sentence's start and in its middle: `bossInText`). The code id stays `gardener`. This builds his rules, the server side, the raid sim, the tests and the FAQ block. His art and animations are on
`claude/hippo-sprite` (docs/decisions/2026-10-21-gardener-animations.md there); the wiring (kit, sprite, board art, the
seed meter) is the next lane's. Until then he stays **not playable** (`kit: null`; the test links
`?boss=gardener&wip=1`, `&power=water` for his ultimate early, `&seeds=N` for a set count). How it works now:
[docs/areas/bosses.md](../areas/bosses.md) (his row); the tuning: [reports/gardener-sim.md](../../reports/gardener-sim.md).

## What Eric decided (the design notes' "Decided for his rules", Oct 20-21)

- **His opening:** the same start every raid has (the starting position).
- **Seeds (passive):** "a second meter on a real timer... every 30 seconds it fills and he plants a seed": 5 as the
  battle begins, then 1 every 30 s of real time, whoever's turn it is, up to 10 waiting. A public count; where they are
  isn't decided until he waters. Online the server's clock; solo and Boss alone the device's, counting only while the
  page is in view (Boss alone has no move clock since Oct 21).
- **Watering (ultimate):** the rage meter and its warning; at the start of his turn, his whole turn. Every waiting seed
  comes up and the count goes to 0. Each seed rolls ("his lottery"): nothing 40, plain plant 30, killer plant 12, pawn
  12, knight/bishop/rook 5, queen 1 (percent). A plain plant blocks an empty square like Big Boy's toy block for 3 crowd
  turns; a killer plant eats a non-king piece of either side ("it may hit his own"); a grown piece is his, on an empty
  square (a pawn never on a first or last rank, never a ninth). "We analyze the board to make sure anything that pops up
  is only a fair advantage": the host's engines place it so his gain lands in [0.5, 2.5] pawns, nearest 1.5; a queen
  lifts the top to 6 ("if he gets really lucky, you're just losing the game, and that's fine"). Nothing fits: drop the
  biggest outcome, down to nothing at all (a shrug). Guards: never a king, never check or mate in one for either side,
  never the crowd without a move, never a position the engine refuses.
- About 3 waterings a battle; his offset from the sim (a crowd score of about 0.08 to 0.55).

## The calls made here, and why

1. **The seed count is a pure function of a clock** (`seedsAt`): `base` seeds at clock time `since`, one more every
   `seedEverySec`, capped at `seedMax`. The state holds those two numbers (`garden.since`, `garden.base`); the view sends
   them, and every screen works out the count and the next seed's time with its own clock (`seedFill` for the bar). No
   server timer, no message per seed, nothing to keep in sync: the server and every device agree because they read the
   same two numbers against the same clock (online the server's, which the app already knows from every message's
   `now`). Why: the brief's suggestion, and it's the least code and the fewest ways to break.
2. **The clock is the match runner's**, an optional `clock` (ms) given to `MatchRunner` (and `restore`), read through
   `Battle.now()`: the lobby passes the server's time (`io.now()`, in both places it makes a runner, so a restored runner
   keeps it), solo passes the page's visible time (`packages/app/src/garden-clock.ts`: `performance.now()` less every
   stretch the page spent hidden, from `visibilitychange`; it stands still while hidden). Without a clock (unit tests, the
   boss kit, the sims unless they give one) the runner's stand-in counts each crowd move as one seed's time, so a battle
   with no real clock still grows seeds.
3. **The meter starts as the battle is set up** (the runner's `startRaid`, his `opening.setUp`), before the intro: a few
   seconds early, less than one seed's time; simpler than a second start.
4. **The watering's roll is taken the first time it's asked for and kept** (`garden.roll`: the clock then, the count, each
   seed's outcome), so the server's request, the host's answer and the server's check agree even if a seed lands while
   the host searches. While it's pending the view carries the count taken (`garden.taken`: its clock and the seeds, never
   what they rolled), and `seedsAt` holds the meter there: no seed shows landing during the search only to vanish (the
   review, Oct 21). Once it's played the meter restarts from none **from that moment** (`since` = the roll's clock, `base`
   0), so a seed whose time came during the search counts toward the next watering and shows then.
5. **The rolls:** `powerRoll(seed, "water", watering, i)` against `waterOdds` in percent; the piece outcome's kind
   (knight, bishop, rook) a third each from its own roll. Seeded, so the same everywhere.
6. **`plant` is a moment kind no turn's events carry.** Seeds land in real time, mid-turn: the screens play his toss as
   their own clock sees the count rise. `plantMany` (the opening five) is an event of the first crowd turn. Both have
   `POWER_FX` 0, so nothing ever waits for them (`GARDENER_ANIM` keeps their real lengths, 740 and 800 ms, for the app).
7. **The engines' placement (`waterFrom`) is greedy, outcome by outcome, the biggest first** (queen, rook, bishop,
   knight, killer plant, pawn, plain plant). Each outcome weighs at most `waterLooks` (4) squares, in a seeded order among
   those its rules and every guard allow (`waterGuard` on the whole position so far: so every step's position is a whole
   watering that could stand, and the last one placed is the answer), each searched at `waterNodes` (20,000) over the
   moves no plant stops. **Every position is searched the same way, the one before it included** (the review, Oct 21):
   one line at `waterNodes`, the plants' moves left out with searchmoves (`topMovesAt` takes an optional move list now),
   never a MultiPV over the allowed moves, which spread the same nodes over every line and measured the after-position
   shallower and noisier than the before (and went to the engine server solo); the same budget either way; it takes the one whose gain is nearest the step's target (`waterTarget` less what the outcomes
   still to come are reckoned to add, `NOMINAL`) and never above the band's top. **An outcome with no square under the top
   is dropped on the spot** (it comes up as nothing, `dropped` on its growth): that's the greedy form of "drop the biggest
   and try again" (the biggest are placed first, so the one that can't fit is the biggest left), and it costs no second
   search. A plain plant tries the squares the crowd could use now (one nobody can use changes nothing).
8. **A killer plant tries the crowd's pawns first, then its pieces; his own only when none of the crowd's stays under
   the top, and then only one that lands within the band** (not merely under its top). In the first runs, on real
   positions, every crowd piece's loss measured over 2.5 (a minor piece lost is a won game by the engine's win chances),
   so the first four squares tried were often all pieces and it fell back to one of his own pawns at −2.8; pawns first
   and "within the band" for his own fixed both.
9. **The jackpot has no cap on the queen itself.** The gain is measured as Repaint's is, in pawns of log-odds of the
   engine's win chances (`bouncePawnLogit`), and those saturate near 7 from an even position (a queen up is a won game):
   with jackpotMax 6 as a hard top, a queen that stays on the board would almost never fit, and the nearest square
   under 6 would be one where it hangs. So the queen goes on the square nearest jackpotMax however far over (never
   hanging to fit), and the rest of that watering is placed under jackpotMax or what the queen gained, nearest
   jackpotMax. The guards still keep out a check and a mate in one.
10. **Under the band's bottom is kept.** Dropping outcomes only lowers the gain, so a watering that came up small (plain
    plants and nothing) is played as it came: the band's bottom is the target's floor, not a reason to drop. Positions
    the engine already calls decided (one side's win chances at the clamp) measure exactly 0 whatever comes up; the sim
    counts those apart.
11. **The pass guard applies** (as to every power that spends his whole turn): a watering whose gain is at least
    `passGuardPawns` below zero (a piece of his left hanging when he passes) waits for his next turn and he plays his move;
    a new roll comes then, with whatever has landed since. The test switch's first watering and the admins' trigger come
    anyway (`waterAny`), so the e2e and an admin always see one.
12. **Online:** the server rolls (`requestWater`, `bossKind` "water", the boss request's `water`: the kinds, the plants on
    the board, an `order` number for the squares' order drawn from the battle's seed, which never leaves the server); the
    host answers the placement as its letters and squares (`waterCode`: `t` a plain plant, `x` a killer plant, a piece's
    letter; "none" for nothing at all), PASS_WAIT, or "" with no engine. The server checks it (`waterCheck`: each outcome
    one that was rolled, on a square its rules allow, each step passing every guard) and plays it; anything else, or no
    host engine anywhere (the request's timeout), waits a turn and his move is asked for. The band itself can't be
    checked without an engine, as with Repaint (the server never searches). An older app ignores `water` and answers a
    move, which isn't a placement: it waits.
13. **A plain plant is a toy block** (`blockedBy`): either side, onto it or through it, a knight jumping it, never stopping
    an attack. It blocks crowd turns `at + 1` to `at + 3` and his moves between them, and is gone as crowd turn `at + 4`
    begins (`wearOff`). The view's `left` (3, 2, 1) is the art's state (green, fall, drop). A move refused for one says
    "A plant is in the way." (`REFUSED.plant`), his only move through one "His only move: past the plant." Turns with a
    plant on the board, and the turn after a watering, don't count for fair play.
14. **A grown piece needs room on the engine's terms:** never a ninth pawn, never more pieces than promotions could
    make (`stockfishRefuses`). While he has all eight pawns he can't grow a pawn, nor a piece he still has his full set
    of (a second queen, a third knight, bishop or rook); those rolls come up as nothing until he has lost a pawn or that
    piece (the sim counts them under "dropped").
15. **The moments** (as the crowd's turn after the watering begins): `water` with `growth` in the order it plays (killer
    plants, grown pieces with the queen last, plain plants, then nothing; every outcome on a square of its own, a
    nothing's square an empty one from the seed, where its sprout wilts), then `bigCheer` (a queen grew), `cheer` (another
    piece) or `shrug` (nothing came up at all; none for plants and kills only). Its length (`waterMs`): the 1340 ms cast,
    then each outcome from 1340 ms, 250 ms apart, for its art's length (kill 870, bud 550, the queen's 630, grow 290, wilt
    490); `POWER_FX_EXTRA` adds it, so the server waits for the watering and his reaction, never for a seed.
16. **His search budget, and a time limit** (the review, Oct 21: the node budget alone didn't bound the guards' own work,
    so a slow phone could run past the boss request's 15 s timeout, and a late answer from a host the server had moved on
    from is dropped: a watering could be asked of host after host). At most `waterBudget` (48) positions besides the one
    before, each at 20,000 nodes (about 0.96 million nodes, Repaint's own worst case), **and at most `waterTimeMs` (8 s)
    from when the host starts**: past it, it answers with the outcomes placed so far (the outcomes left come up as
    nothing, `late` on the pick): every step's position is a whole watering that passes the guards, so that answer is
    always one the server's check accepts. Between squares it breathes (a yield to the event loop once 12 ms have passed
    since the last), so no stretch of the guards' work holds the page. In the sim on native Stockfish: a mean of 1.2 s,
    at most 3.8 s (with three sims sharing the machine).
17. **Numbers:** `rageSpeed.gardener` and his offset from the sim (below and the report).
18. **The rage meter and his garden** (no rule of its own, the director's call): a killer plant that eats one of his own
    pieces adds to his meter as any piece he loses does, and a grown piece shields him: the meter counts the most material
    he has been under his start (`lost`), so his next losses up to a grown piece's worth add nothing. Both are small and
    rare (2 own pieces in 65 battles; a few grown pieces a battle) and left to the meter's usual rule.
19. **`garden.water` stays in the view until his next watering** (as Smudgy's `repaint`): the screens play the watering's
    moments from the turn's events (`water`, then the reaction), never from this field, or a reload would play it again.

## The numbers (the raid sim)

See [reports/gardener-sim.md](../../reports/gardener-sim.md). **Shipped at offset −250 and `rageSpeed` 1.2:** with a
crowd that takes 10 s to pick, after the review's fixes (every position searched the same way; the time limit), the crowd
scores **0.17** (± 0.05, 26 battles) in **46** crowd moves, with **3.0 waterings** a battle of 7.4 seeds each, inside
the pack at its stronger end; before those fixes the same run scored 0.38 (± 0.09) with 3.4 waterings (a plant's position
measured as deeply as the one before it, the plants he places matter more). No sweep: in the range. Before the fixes, a fast crowd (5 s a
pick) scored 0.54 with 5.1 seeds a watering, a slow one (20 s, the raid's whole clock) 0.19 with 8.9 (13 battles each): the
slower the crowd, the more seeds; and at `rageSpeed` 1 (13 battles) he watered 2.7 times (the crowd 0.23) against 3.4 at
1.2: 1.2 is the nearer to "about 3" (3.0 after the fixes). −250 is the pack's usual offset (Moo & Moon, Big Boy, Alfil,
Chub & Chirp). His gain (after the fixes): never over the band's top bar the jackpot; under its bottom in 15 of the 56
waterings the engine doesn't already call decided (small ones: plain plants and nothing); 1 killer plant of 52 on his own
pieces; 3 queens in 26 battles.

## Not done here (the wiring lane)

His kit (sprite, lines, sounds), `CHARACTERS` and `BOSS_KITS`, the board art in `effects.ts`, `components/Gardener.tsx`'s
views (now placeholders that only hold their time), the seed meter by the rage meter (from the view's `garden`:
`seedsAt`/`seedFill` with `gardenClock()` solo and the server's clock online), the plants on the board from `left`, each
outcome's art at its cue (`snap`: the piece off; `pop`: the piece on), the toss as the count rises, his king attack, his
tile and the visual e2e.
