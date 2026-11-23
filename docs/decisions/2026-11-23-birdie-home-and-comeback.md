# Birdie's home, the fight's opening, his comeback and his strike (Nov 23, 2026)

Eric's words (Nov 23), the parts this decision follows:

- The lobby's battle spot: "his like little battle circle in his building should just be like a little train, a railroad
  crossing", and "the chessboard can just be ... reuse 2 chairs and a table" from the little restaurant.
- The opening: "those little crossings that come down, a little red flashing light ... they're sitting there ... in the open
  positions on the left and right, and then they shut when ... both sides ... staggered." And: "come up with the full screen
  sort of thing that right when the fight starts."
- The ult: "his ult is only enabled when he's solo in the battle tower, otherwise it's disabled." "The ideal would be ... the
  ult triggers when he's like down but not totally out, and then with his increase in strength he's able to ... come back."
- The strike: "he does like a chart, almost like there's like a move called Nova Strike in Mega Man, make it kind of look like
  that ... every like 3 or 4 turns after his ult ... it's things that are already like pieces you're kind of possibly
  considering about moving ... we don't want it to be something that's like a devastating blow."

## 1. The lobby's battle spot: a railroad crossing, and a café table

- The match spot in the lobby is a **railroad crossing** on the floor (the round battle spot, redrawn): a painted crossing
  on the tiles, with its barrier posts and red light at its corners, instead of a ring.
- **The chessboard is a café table with two chairs**, the same table and chairs the restaurant already uses (reused, not drawn
  again). The lobby's café keeps its own counter and stools; the match table is one of its tables, moved to the crossing.
- The lobby brief (`scripts/boss-art/briefs/shop-birdie-interior.md`) has no ring yet, so this is a change to it before the
  rerun. Call: I read "battle circle" as the round match spot on the floor. If Eric meant the round clock on the station's
  front, the station needs no change.

## 2. The fight's opening: the crossing comes down (full screen, about 1.5 s)

When the match locks in, the screen runs one short crossing sequence, then the board:

1. The red lights at both corners start to flash (the existing light effect, "how we did the lights").
2. A bell rings (one bell sound, the crossing's own).
3. The **left barrier** comes down first, then the **right** about 0.3 s later (the staggered closing Eric described). Each
   barrier is one striped arm (red and white) that swings down across its side of the crossing, and stops when it locks.
4. Both arms are down, the lights keep flashing, and the view moves in to the board.

Call: it reuses the existing intro pattern (the `intro-*-view.ts` wipes), so no new screen system. The whole sequence stays
under the time of the current intro, so the match doesn't wait on it.

## 3. The ult: the comeback, tower solo only

- **Enabled:** only in the solo Battle Tower. In Classic and Crowd, and in any other match, the ult is off. Call (see the
  questions below): the train still runs in every mode, the ult and the strike are tower-only.
- **Trigger:** once Birdie is **down but not out**. First guess, a setting: Birdie's material falls to **40%** of his starting
  material, his king still on the board, and it fires **once** per match. Never after the king is gone.
- **What he gets:** his strength steps up for the rest of the match (the engine lane's number), which is what lets him
  come back.
- **The rhythm:** the ult is his one big moment, and the normal move keeps running (see section 4).

## 4. The transformation: the train hits him (the cinematic, 6 to 7 s)

This answers "I can't figure out his transformation." Built on the Nov 23 design, with the transformation beat worked out:

| Time | What the viewer sees |
|---|---|
| 0.0 s | Close-up: he falls out of his spot on the board. |
| 1.5 s | Zoom out, not so close you lose him: he tumbles like a bird falling from a height. Background blurred, wind and speed lines. |
| 3.0 s | A train track comes into view below. His own train (the same drawing as his ride) comes toward him. |
| 4.5 s | Its headlights brighten as it nears (the existing light effect). |
| 6.0 s | Impact: one white flash frame. |
| 6.2 s | **The transformation:** the train's yellow plates lock onto his body and wings, the dark roof-colored part sits on his back, the red stripe runs along the wing edges. |
| 6.8 s | He rises onto both legs, upright, in the sleek armor (Armored A, the version Eric picked). Ends in its idle. |

The train's drawing is reused, and its parts become his armor, so the transformation reads as the train turning into him.

## 5. After the ult: the strike replaces the train's line clear

- **Before the ult:** the train is his normal move, as now (the line warning, then the smash if the crowd doesn't move the piece).
- **After the ult:** the train is gone. The strike replaces its line clear, every **3 of his turns** (6 plies), the first one
  right after the ult. Eric said 3 or 4; I picked 3 to match the train's cooldown. It's a setting.
- The strike is **announced**, like the train's warning: at the end of his turn the chosen line lights up for one of your turns.
  The strike then lands at the end of the crowd's next turn, on the pieces **still** on that line. A piece the crowd moves
  off the line is saved. This is the same fairness rule as the train, so ignoring a warning costs a piece, and playing well
  doesn't.

### The strike's target (not devastating)

- **The line:** one row or one column, chosen from the crowd's **most-considered moves** (the top few candidate moves this
  turn, from the vote): the line that holds the most of those moves' starting squares. Ties go to the match seed, so every
  device agrees.
- **The cost:** at most **2 pieces** on that line, only pieces that have a legal move this turn (the ones the crowd was
  considering), **never the king**. A line of pieces nobody wants to move hits nothing.
- **Look:** mirror the Mega Man look, a bright bar of light that sweeps along the line, then the hit squares blink and clear.
  Reuse an existing effect (the gator's smash, the queen laser's hit) rather than a new one.
- **Name:** **"Full Steam"** (Eric, Nov 23: "you can just pick the name"). Not the Mega Man name. The look is the only thing taken from the reference.

## Settings (`packages/core/src/settings.ts`, the tunables; numbers are first guesses)

- `birdieUlt.triggerShare`: 0.40 (his material share at which the ult fires).
- `birdieUlt.towerSoloOnly`: true.
- `birdieStrike.every`: 3 of his turns (6 plies).
- `birdieStrike.maxPieces`: 2.
- `birdieStrike.topCandidates`: the number of the vote's top moves the line is chosen from (first guess 3).

## Answers (Eric, Nov 23)

1. **The ult's scope: confirmed.** Solo Battle Tower only. In the 2- and 3-boss modes he never triggers the ult, and he keeps
   his normal move (the train) in every mode.
2. **The battle spot: confirmed as the floor spot.** The "battle circle" is the match spot on the floor. In the lobby code
   that's the floor piece whose name starts `ring` (the same family as `circle` and `emblem`, `packages/app/src/town/shops/room.ts`),
   so the lobby's crossing is named `ring-crossing`. The clock on the station's front is not part of this; the station
   doesn't change.
3. **The strike's name: "Full Steam"** (Eric let me pick it).
4. **The trigger at 40%: a first guess, the playtest decides.** What it means: Birdie's material share, meaning the chess
   material he has left as a share of what he started with (pawn 1, knight and bishop 3, rook 5, queen 9; the king isn't
   counted). Example: he starts with 39 points (the standard army), so 40% is about 16 points, e.g. two rooks, a knight and a
   bishop. If the game's own piece values differ, the number moves with them. The ult fires once, the first time he drops
   under the line.

## Art and spend

- The lobby's brief changes (section 1) need a rerun of `shop-birdie-interior`. That's paid, so it needs Eric's spend OK
  first (the earlier round's OK covered two runs and the lobby's first attempt; a rerun is new spend).
- The crossing intro (section 2) and the transformation (section 4) are animation work: the characters lane (drawing) and the
  god-king lane (the cinematic, the strike).
