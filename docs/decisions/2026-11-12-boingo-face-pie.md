# Boingo's pie, in a piece's face (Nov 12, 2026)

## Eric's words

With his sketch (your white pawn, an arrow from Boingo's side into its face, an X on each square diagonally behind it):
"Right now, when he just throws the pie, this has kind of gotten dated... I want him to now throw the pie... when one of
your pieces is hung like this, where there's nothing behind [it on] the two [squares] kitty corner to it, he throws the
pie at the face of your piece. And it kind of splashes on it... and then two pie pieces would like split off and hit those
two that I marked X. And so he should be doing that a good amount during the game... When he finds opportunities... they
linger there for just I would say just one turn... I really just want to get it built and we can fine tune it. It'll also
make him a bit stronger since he was one of the weaker bosses."

His answers: the piece hit is "marked as splatted once, 2 splats on the same piece make it frozen for a turn, the way to
mark it should be subtle"; the pied squares are "Only the two X's"; it **replaces** the old pie (an empty square near the
center every `pieEvery` turns).

## The rule (`packages/chess/src/bosses/boingo.ts`)

- **Target** (`choosePieThrow`): one of the crowd's pieces, never the king, whose two squares diagonally behind it (toward
  the crowd's own back rank: `behindSquares`) are both on the board, empty and not already pied. So never a piece on the a
  or h file, nor on the crowd's back rank. Ranked as a nuisance: 2 x the piece's own moves onto the two squares (its way
  back) + the other pieces' moves onto them (a defender's route), then the piece's value (pieces before pawns), then the
  square. The pick: at random from the battle's seed among the top three, so it isn't the same piece every time. No target:
  no throw, and he tries again the next turn.
- **The throw**: as a crowd turn begins (after his move, where the old pie came; the screen's timing is unchanged), every
  `pieEvery` = **2** crowd turns from turn 2, as often as the old pie. The two squares are pied for `pieTurns` = **1** crowd
  turn (Eric: "just one turn"): nobody, either side, may move onto them, through the boss's reply. `pieMax` = 2: one
  throw's pair at a time.
- **Splats** (`splats` in the powers' state, `SplatMark`): the piece hit gets one; the mark follows the piece through every
  move, its own and the boss's (`followSplats`: castling's rook, a promotion keeps it as the new piece, a capture or en
  passant takes it away). At `pieSplatsToFreeze` = **2** splats the piece is frozen for `pieFreezeTurns` = **1** crowd
  turn (the turn of the throw) and its mark goes: the held pieces' one rule (no move, no castling with a frozen rook),
  Ginger's ice on screen, "That piece is frozen." for a refused move.
- **Guards**: a piece isn't a target if its two pies (and, a second splat, its freeze) would leave the crowd no legal move
  (in check: no answer to it), or would leave the boss no move in the position as it stands. The dispatcher still lifts
  every limit for a turn that would have no move (the ground rule).
- **Everywhere he plays**: the rule is in the shared rules, so solo, raids, online and the Crowd's boss final work the same;
  the screens get the marks as `NetBossPowers.splats` (optional: missing from older servers), the pies as before.

## Calls I made, and why

- **Kings are never targets.** The ground rule says the king is never frozen; a king's splat that could never freeze would
  be a mark that means nothing, and a pie in the king's face is already his attack at mate.
- **"Behind" is from the crowd's side**, in real squares, whatever way the funhouse has turned the board.
- **The nuisance rule** above (the brief: "e.g. those squares are the piece's retreat or a defender's route"). A target
  whose pies stop nothing still gets a pie: the splat still counts toward a freeze, and Eric wants him throwing "a good
  amount".
- **A second splat freezes the turn it lands** (the pie's own turn), so the freeze is seen with the throw that causes it.
- **`pieEvery` stays 2**: as often as the old pie (the brief: start from it). A throw every turn would put a 2.7 s moment
  on every move.
- **The screen**: the old banner kept ("PIE!"), its line now names the piece: "Splat on your pawn", or "Splat! Your pawn is
  frozen". The moment is 0.4 s longer (2.7 s; the banner unchanged at 1.45 s): his throw (1.45 s), the pie in the piece's
  face (1.8 s, the king attack's `pieHit` art with the splat sound), two half-size pieces of it lobbed to the squares
  behind (1.88 to 2.16 s), the pies splat there (one sound for the pair). The freeze's ice forms at 1.9 s.
- **The mark**: a small cream smear with a drip on the piece's face, drawn as part of the piece (`boingoDecor`, the board's
  `decor`), so it slides with it; the history view draws none (no power's marks there).
- **Test switch** `?power=pie`: a throw every turn, the splatted piece first, so a freeze comes on turn 3 when that piece
  is still a target.

## Removed

The center pie: `choosePie` and its center squares, its tests ("near the center", "each for 3 turns, a new one every 2
turns"), and its FAQ words. `pieTurns` went from 3 to 1; `pieEvery` and `pieMax` stay.

## The sim

`npx tsx packages/sim/scripts/boss-sim.ts raid clown 20 21 0 <tag>` (a raid crowd of bots against Boingo, 20 battles, seed
21, no God King strikes), before on main and after on this branch: `reports/boss-sim/raid-bfp-before.jsonl` and
`raid-bfp-after.jsonl`. Results in the PR body.
