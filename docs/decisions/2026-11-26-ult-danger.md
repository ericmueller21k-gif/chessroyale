# Bosses' ultimates come when the boss is in danger (Nov 26, 2026)

- **Eric**, Nov 26, after beating Birdie in a test game (Birdie down only a bishop and two pawns, positionally lost) with no Fall:
  "his ult is supposed to fire. It's not about like how many moves have been played. It should have detected like he was basically
  in danger, or like it was already heavily in my favor, and it should start triggering very quickly thereafter, like a turn or two
  at most."
- **The cause.** Birdie's Fall came only at `fallLost` (9) points of material lost: a boss can be lost on the board with far less.
  Across the roster it was the same in kind: the rage meter only gains `rageAheadMax` (4) more a move while the crowd is ahead, so
  from an emptied meter a winning crowd waits about 12 crowd moves; Chandy's Dodge waits for his rifle's 5 upgrades, which a crowd
  that plays well never gives him. The audit (`reports/ult-danger.md`, a Stockfish crowd as Eric played, 3 seeds a boss): from the
  crowd's first move at 0.70, the ultimate took 2 to 26 of the boss's turns, or never came.
- **The rule** (`BOSS_POWERS.dangerAt`, 0.70: Eric's "heavily in my favor"): a crowd move the judge puts at 0.70 or more for the
  crowd (the boss's `judged`, the number "your chances" shows):
  - **The rage meter** (every boss but Birdie, Chandy, Wrangler and the Hidden Boss) is full as the next crowd turn begins, whatever
    it held (`dangerCharge` in `prepareTurn`; Folio's `creaseDue`, which predicts the meter for his line, reads the same): the usual
    warning, then the ultimate, in the boss's second turn in danger.
  - **Chandy's Dodge** is warned as if his meter were full, his rifle whole or not: Dodge as the crowd's turn after begins.
  - **Birdie's Fall** (no warning before it) comes at the start of his turn once two such moves come in a row
    (`birdie.fallDangerMoves`): also his second turn in danger.
  - **One a danger** (`dangerSpent`, set by `unleashed` when an ultimate comes with the crowd at the line, cleared by a crowd move
    below it): after it the meter fills at its usual pace (the ahead gain at its fullest).
  - Below the line nothing changes: a level battle plays the same with the rule on or off (unit test, every boss; the sim's level
    battles, the same nine before and after).
- **Calls made** (the brief left them to evidence):
  1. **One move, not two, for the meter and Chandy:** two in a row would make a warned ultimate wait three of his turns, past Eric's
     "a turn or two at most".
  2. **Two in a row for Birdie:** in the audit's battles before the rule, 56 of 119 crowd moves that reached 0.70 fell back under it
     the very next move, mostly a power of the boss's hitting back (a train, a freeze, a blizzard). His Fall is once a battle and
     armors him for the rest of it (a much stronger brain), so a one-move blip mustn't bring it; with no warning, the second move
     still brings it within two of his turns. (In the level battles the one crossing, Birdie's, 0.72, fell back at once: with two in a
     row it brought nothing.)
  3. **One ultimate a danger:** the first version filled the meter again after every ultimate while the crowd stayed ahead, and the
     shortest ultimates chained (the audit: Big Boy's Bounce 32 times in a battle, Hollow's Lights Out 13 to 21). Eric asked for the
     ultimate to come quickly when the boss falls into danger, not for one every other turn.
  4. **Each ultimate's own conditions are kept:** the pass guard on a power that spends his whole turn (Eric, Oct 18: Chub & Chirp's
     Carrot Patch, Smudgy's Repaint, the watering), the board saw's turn 10 and "a half of the board more his", Smudgy's paintable
     pair, Don Dough's gild pick, the hoops' fit, Folio's guard. They can hold an ultimate past two turns (the audit: Chub & Chirp 7,
     Smudgy 7 to 19, Sawyer 4 and once never): changing them reverses the rules those powers were built on. **For the director and
     Eric.**
  5. **Chandy's Dodge before his 5 upgrades:** Eric's Nov 16 "It should fire after he gets all 5 upgrades" gives way in danger to his
     Nov 26 words. **Flagged for Eric.**
  6. **Not changed:** Wrangler (his meter is full from his fifth move whatever the board says, and his Showdown waits for a line-up the
     rules let him fire: in the audit it came early in every battle, before any danger) and the Hidden Boss (the brief: report only;
     his bullet clock comes on its own turn).
- **Checks:** `packages/chess/test/ult-danger.test.ts` (every boss in a lost battle: his meter full by his next turn and his ultimate
  within two of his turns, or once its condition allows; one a danger; the level battles unchanged), Birdie's and Chandy's own cases
  (`birdie.test.ts`, `chandy.test.ts`), the boss kit, the boss smoke for Birdie and Chandy. The audit: `npx tsx
  packages/sim/scripts/ult-danger.ts` (`run`, `summary`, `jumps`, `compare`).
