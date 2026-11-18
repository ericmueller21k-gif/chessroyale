# Review: Ginger's Super Freeze (`claude/ginger-superfreeze` at 0b32828)

Boss lane, one quick read-only pass (Nov 18). Diff: `git diff origin/main...origin/claude/ginger-superfreeze`.

## Summary

No rule or sync bug found. The parts the brief named all hold up on reading, and I checked some by running them:

- **Legal positions.** `superHeld` lets pieces go (farthest first) until a legal move is left, counting the regular Freeze's
  piece (`also`). `chooseFreeze` now picks around the held pieces and keeps the same guarantee. `heldIn` covers frozen rooks
  and castling. A held pawn can't capture en passant or promote. The king is never held. I probed it on a check that only
  blocks can answer, and on a castling position with both rooks iced (one by the Super Freeze, one by the Freeze): it always
  leaves a legal move. Anything that would still leave none falls back to the dispatcher's lift (`crowdAllowed`).
- **Blizzard.** The Super Freeze never fires when a warning, a running Blizzard or the admin trigger is on the next crowd turn
  (`blizzardOn`). An admin trigger pulled during his think becomes the warning (the guard in `ultimate`), so the Blizzard
  comes on hit.at + 2. A full rage meter on hit.at + 1 only warns. `superTurn` runs inside `passive`, which prepareTurn
  skips only when an ultimate comes that turn, and that can't happen on hit.at + 1.
- **God King.** His Last Stand skips the move (no `afterCrowdMove`) and sits out on held turns (`powerTurn` → `boardAltered`).
  His help uses the server's `crowdAllowed`.
- **Solo and the server agree.** The target comes from the seed in the shared runner. `gingerTurnMs` is added exactly once to
  each of solo `landedMs` and lobby `thinkMinAt`, with the QUEEN SLAIN! lead taken the way Moo's is (`superFreezeLeadMs`),
  inside `bossThinkMs`'s max. Nothing is counted twice.
- **Merge with Big Boy (#784).** Measured against today's `origin/main`, the four conflicted files only add Ginger's lines.
  `bigboyTurnMs`, `yourTopple` and `bounceTurn`'s use of `landedMs` are intact, and `boss-sim.ts` only adds the row field.
- **Reconnect.** A device that rejoins mid-think skips the moment (`rejoinedAt` within `MOO_CINEMATIC.rejoinMs`) and shows
  the ice at once. A screen drawn again carries on from `superSeen`, and a rematch clears it (`onResetBeats`).
- **Performance.** The effect is a 96 × 96 sprite drawn ahead from half a meter. The slowed-phone `@perf` check is added;
  I didn't run it.

Run locally: `npm run typecheck` passes. `packages/chess/test/ginger-superfreeze.test.ts`,
`packages/server/test/ginger-lobby.test.ts`, `packages/app/test/ginger-superfreeze.test.ts`, and the boss kit plus the parity
test (Ginger) all pass.

## Findings (most severe first; all visual or wording, none breaks a match)

### 1. The regular Freeze's ice vanishes for about 6 s when its piece is inside the 3 × 3 (visual, medium-low)

`packages/app/src/components/Ginger.tsx:230` (with `:287`). For every square in `superBox(m.square)`,
`GINGER_UI.moments.superFreeze.appearAt` returns `m.at + SF.settleAt`. The board layer then draws nothing on an iced square
until that time (`if (now < t) return null`). The regular Freeze's piece is iced through his turn (`iced()` keeps
`p.frozen`, and `freezeTurns: 2`). When that piece is one of the clumped pieces, its ice disappears when his thinking screen
opens and comes back only at the settle, about 1 s of banner hold plus 5.47 s later. The piece is still frozen the whole
time, so for six seconds the board shows a frozen piece without ice.

- **Scenario:** turn K, the Freeze ices the crowd's knight on c3. Crowd move K fills the meter, and the most-clumped piece is
  the b2 pawn, whose 3 × 3 contains c3. As his think starts, the knight's ice is gone; it comes back with the block's settle.
- **Fix:** in the board layer, keep a square already iced before the moment: when `sq === p.frozen?.square`
  (`frozen` is in the view), use `t = 0` instead of `appearAt(sq)`, and keep its own loop rather than restarting it.
  Or have `appearAt` use only `m.squares` minus that square.

### 2. Pieces let go, and the banner's count (visual and wording, low)

- **Let-go pieces lose their ice with no melt.** During his turn every piece in `hit.squares` gets the block's settle ice
  (`iced()` at `p.turn === hit.at`). On the crowd's turn only `hit.held` stays iced. A piece let go so the crowd keeps a legal
  move (or one his move takes) just stops being iced. `supMelting` runs only on his next turn, so these pieces get no melt:
  their ice blinks out as the crowd's turn starts.
- **The banner overcounts.** It says "Your X and N more are frozen" (`Ginger.tsx:122`, from `squares.length`), which can be
  more than the pieces actually held.
- **Scenario:** the crowd is in check after his move, and only a piece in the box can block. That piece and any farther ones
  are let go: the banner said "and 4 more", but 2 are held, and the let-go pieces' ice pops away.
- **Fix:** on the crowd turn's start, give the pieces in `hit.squares` that aren't in `held` and are still the crowd's the
  existing melt (the `supMelting` path keyed on `at`). Word the banner "N more iced", or leave the count out.

### 3. The meter glows "ready" while the Blizzard holds it back (UI wording, low)

`packages/chess/src/bosses/ginger.ts:411` (the view) and `Ginger.tsx:184`. `superMeter` clamps to 1 while the Super Freeze
waits for a warned or running Blizzard (`blizzardOn`). Through the warning and all three Blizzard turns the bar glows `full`
with the aria label "Super Freeze ready: it comes as your move lands", but it won't come on those moves. Players who read
the meter expect a freeze that doesn't arrive.

- **Fix:** add a `waiting` flag to the view (the same `blizzardOn(p, p.turn + 1)` test `afterCrowdMove` uses). The UI then
  keeps the bar full but dim (not glowing), labeled "Super Freeze: waits for the Blizzard".

### 4. A draw on his move right after a Super Freeze plays the moment again (shared pattern, low; found by reading, not reproduced)

`packages/chess/src/boss-timing.ts:529` with `runner.preparePowers` (`runner.ts:423`, which returns early at game over).
When his move after a Super Freeze ends the battle by something other than mate (stalemate, threefold repetition, the
fifty-move rule, insufficient material), prepareTurn never runs. The turn's `events` then still hold `superFreeze`.

- `bossTurnShowMs` adds `powerMomentMs(events)`, about 6.9 s more on the last show.
- The Boss screen, no longer thinking, builds `momentsOf(boss, until)`, which includes `superFreeze` (it's in
  `MOMENT_UI`), so SUPER FREEZE! plays a second time before the result.
- A mate is safe, because `mateAttackDue` keeps only Chub & Chirp's moments.
- Moo's `fullMoon`, Folio's `fold`/`revision`, Dash's `popOff` and the Zebra/Chandy turn moments follow the same pattern
  today. Per the "fix the cause" rule, this needs one shared fix, not a Ginger patch.
- **Fix:** mark the "while he thinks" kinds once, for example a set beside `POWER_FX`, and have `momentsOf` and
  `bossTurnShowMs` skip them. Or have the runner clear the turn's thinking-only events once the boss has moved, even when the
  game is over.

## Not findings (checked)

- **Target choice ties.** The fuller 3 × 3 wins, then the seed's roll, then the square: deterministic.
- **The test switch.** `?power=superfreeze`: `need` is 1 then 2, so turns never overlap. `testSwitch` doesn't touch the
  Blizzard for it.
- **The meter's place.** The meter sits inline after the rage meter in `.boss-ult`, from the first turn. It hides on
  `boss.result` together with the rage meter (the same rule), so it never shifts the bar mid-battle.
- **`e2e/areas.json`.** It places the new files: `ginger.spec.ts` plus the boss specs and the smoke set.
