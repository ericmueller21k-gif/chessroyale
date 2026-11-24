# Chandy: the hunt after his taught upgrades, the Lock-on Shot's victim, and the God King's warning (Nov 24, 2026)

Eric (Nov 24, a deep endgame against Chandy, his rifle at 2 upgrades): "the only 2 we got were the ones that we force him to get ...
he marks one and then he wants to target it ... aggressively trying to capture a piece and upgrade, even if it ... is a detriment to
him, but not a super detriment ... if it's like a decent trade, but maybe slightly negative, he still targets it ... he ended up just
doing the queen shot 3 times ... we should replace that with ... a generic name ... the god king should say something about like ...
move your queen behind safety ... When he does his queen shot, we should already know ... which piece you're most likely to sacrifice.
So have him mark that piece as well." The director's brief: `notes/briefs/chandy-upgrades.md`. Numbers: `reports/chandy-sim.md`, run H.

## The cause (measured first)

The sim logged every lock's end, what each crowd move did to a lock he could win, and each of his hunting moves (before: main). With
a crowd that sees the crosshair (the sim's new `heed`) and plays better (`botLevel` 1800): **225 locks escaped for 94 taken**; on 55%
of his hunting turns no move of his could take a locked piece at all; where one could, a capture of a defended piece was a trade,
which the steering only played when it sat in his engine's top 5 lines (and 34 trades within 2 pawns sat outside them). An escaped
lock then sat on its safe piece for up to 3 of his turns before he moved on. And the queen lock's shot shattered a piece most times it
fired, which was never an upgrade (a pawn in front of the queen, mostly). So against a player who saves what's marked, his hunt
mostly waited, and his strongest move earned nothing. The bots' sim hid it: the bots lose pieces anyway (5 upgrades in 19 battles of
20 before any change).

## Calls made

- **The hunt** (from his third upgrade on, `taught`): any trade for a locked piece that nets him at least −`huntLoss` (1) pawn by the
  exchange check is scored in one search with his best move (`huntTakes`, `bossMoveFrom`) and played within `takeMargin` (2) of his
  best, never one walking into a mate. The exchange check counts your best capture back anywhere, so it never hangs his queen.
  `huntLoss` is material (what the trade costs him), `takeMargin` stays the engine's guard (what the move costs his position).
- **Keeps after it, re-locks when it escapes:** a lock stays while he can trade for its piece (`huntable`); one whose piece got away
  ends at once if another of your pieces can be hunted, and the passive locks the next most gettable (`lockEnds`' `relock`). Locks
  prefer, among equally gettable pieces, one he can trade for now. Chasing is as before (his top lines, `chaseMargin`).
- **The shot's victim** (`shotVictim`, decided once as he aims, from the position alone so every device agrees: no engine): the
  piece already first down the target's file from his edge; else the cheapest piece a move of yours can put there (ties: the one more
  of your moves put there, then the seed), as its square now; never your king (it stops the round). Locked as the aim shows (a
  `shot` lock: one pip, not hunted, gone with the shot). "Your best reply" is read as the cheapest block: a person sacrifices the
  least they can.
- **A shatter is an upgrade** when it hits a locked piece or the aim's target (both have crosshairs; a player would expect either to
  count). Block with a different piece than the one he marked and it shatters with no upgrade.
- **Two upgrades in one turn** (the shot's and his capture's): both count; the window shows the second, and the first's move fires
  with the meter as any unlocked move.
- **The name: "Lock-on Shot"** (the director's call; Eric can change it) everywhere a player reads it: the move's name, its banner
  "LOCK-ON SHOT!", the dock's "Lock-on Shot: your rook took it.", the weapon screen, the FAQ, `POWER_WORDS`. Never "queen" unless the
  piece is one. Its code name stays `queenlock` (and `queenAim`/`queenShot`, the `?power=queenlock` switch): not player-facing.
- **The God King's warning** as the aim's banner fires: "He's aiming down our queen's file. Put a piece in front of her!" (or the
  rook's). Not the brief's "Get your queen out of the line!": the round follows its target down whatever file it ends on, so only a
  piece in front saves it. Quiet when no move you may play can put one there (`shotSaves`), as with Wrangler's duel.
- **The sim's player like Eric** (`best`: the engine's best move, heeding the crosshairs, finding Dodge's safe square; Boss alone at
  tier 2400): the bots' crowd can't show his problem, so this run stands in for a player who doesn't blunder.

## Result (20 battles each, reports/chandy-sim.md run H)

- His strength: the calibration's crowd (the bots) scores 0.03 before and after (the same 0 wins, 1 draw, 19 losses); the Eric-like
  player 0.17 both; the heeding crowd 0.05 to 0.03 (within noise). Inside his band (run D 0.02; the pack 0.05 to 0.17).
- Upgrades by crowd move 30, battles with 4 or more: the Eric-like player 14 of 20 to 19 of 20 (median 4.5 to 5); the stronger
  heeding crowd 11 of 18 to 17 of 18. By move 25 the heeding crowd's median goes from 3 to 5. His third upgrade comes 3.5 to 8 crowd
  moves sooner in every crowd; the fifth 3 to 8.5 sooner.
- The shot's shatters of its locked piece, each an upgrade now: 14 in the Eric-like player's 20 battles (7 hit a lock before, which
  earned nothing).
- The sim's Eric-like player still loses more pieces than Eric did (19 of 20 reached 5 upgrades before too), so real play will say
  more: `huntLoss` and `takeMargin` are the knobs.
