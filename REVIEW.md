# Review: Chub & Chirp Turf (`claude/hopper-turf` at 2bca690b), boss lane's one quick pass

Read against `notes/briefs/hopper-turf-build.md` and `hopper-turf.md`. No blockers found.

## Blockers
None.

## Should-fix
1. **Double hop's second move pulls carrots, his winning fifth included, during the Carrot Patch race** (`packages/chess/src/bosses/hopper.ts:747`, `applyDouble`; the guard at `:802` checks only `carrotBattle.won`).
   Failing case: the race is on and he held 48+ squares as his turn began. His quiet second move ends on an open carrot. `pull(b, "boss", true)` claims it,
   and if it's his fifth, `over: "won"`: the battle is his on a free move that never counts against `carrotMoves`. Leapfrog's hop is barred from exactly
   this ("a hop never pulls their last carrot"). Also, a race that the second move ends (`over: "pulled"`) gets its spin a turn late, because `spin` runs
   only in `afterHisMove`, which has already run. Simplest fix: in `turfBattle.afterHisMove`, set `skipped` while `raceOn(carrots)`. The FAQ then needs
   "not during the race". It's unlikely today (the sim never reached 48), but it decides a result.
2. **His line's speech bubble covers the count on a phone during the hop-around.** Still `phone-light-2-hop-around.png`: "Hop, hop, hop… mine!" sits over
   "Chub NN", the one number the moment changes. Eric's rule is "nothing hidden". Either keep the bubble clear of `.hp-count`, or say the count is OK
   to cover briefly.

## Nits
- `packages/app/src/components/Hopper.tsx:270`: the Fuse pill's tap text hard-codes "cut by a third". The FAQ follows `turfFuseCut`, so the pill text
  goes stale once that's tuned.
- `?power=turf` with the crowd on Black: his first turn has no holds, because `turnBegins` only sets them after a crowd move (`hopper.ts:773`). So
  "Long legs from his first turn" (`turfTest` `:479`, `POWER_TEST_SWITCHES` doc in `core/src/boss.ts`) holds only when the crowd is White. This affects
  the test switch only.
- The count jumps before Chirp lands. `apply` writes the claimed square at once (`hopper.ts:685`), and TurfLayer holds its print until he lands, but
  TurfBar (`Hopper.tsx:323`) shows the new number from the banner on.
- Long legs moves on a checked turn: when two devices disagree, the engine server is asked to score `"c3c5"` (`lobby.ts:2363`), which isn't a UCI move
  in that position. The move gets no score, so the host's move plays, unvouched. An older-app checker ignores `legs`, so it always disagrees on a
  Long legs turn. This is the same as Wrangler's long pull (an existing pattern), noted for when the protocol next changes.
- `packages/app/src/move-list.ts:122` `sentOn` runs on every boss's list. If a later base removes the pawn (Grex's burn) and a same-color pawn stands
  one square further on, the row names the wrong square. Rare.

## Checked
- **Long legs** (`turf.ts` `legsOptions`, `legsFen`):
  - The squares passed must be empty: the first step is a legal chess.js push (the double step from the start), and the destination must be empty.
  - Never a capture: straight pushes only.
  - No promotion: `end === last` is excluded, as are a pawn on rank 7 and a black boss's pawn on rank 2.
  - No en passant: field 4 is cleared both in `legsFen` and on the board (`legsOn`).
  - Never check, and his own king is never left attacked.
  - The server only accepts it through `specialMove`, which re-runs `legsOptions` on the server's own position (`bossMoveOk`, `applyBossMove`).
  - It's played as its first step, and the pawn goes on through a base at the ply.
  - No ordinary move string collides with a Long legs move.
  - The move list shows the square reached.
- **Double hop**: `passTurn` returns null when the crowd is in check, so a first move that checks leads to `skipped`. The second move is a quiet move
  (`extraMoveCandidates`) played from a base at the ply. It's unscored (`powerTurn`), the host's pick is checked against the candidates, and a seeded
  stand-in plays when the pick is bad. Solo and online share the code (`extraMoveDue` / `extraMoveKind`).
- **Short fuse**:
  - `holdOn` is true only while `holdsAt === crowdMoves`: his turn and the crowd's next turn.
  - Server and solo both use `runner.moveClock()`, `roundSettings` (the deadline, through `allowedMs`) and `incrementNow()`. The bank is settled in
    `applyRound` before the move count changes, so the cut deadline and the cut increment agree.
  - The team bank uses `roundSettings` too.
  - Online, the screen gets `moveClock` and `increment` from the server.
  - The bullet bank is left as it was, as the decision note says.
- **Hop-around picks**:
  - It never lands on or hops over a square with a piece (`!g.has`).
  - It lands on an open square, else one of yours. It is seeded with `powerRoll(seed, …, at)`.
  - The server asks no host: `candidates` is [], so `needsEngine` is false.
  - One step a turn, ordered bounce, then hop, then hop-around.
- **Squares flip on every move**: `claimTurf` compares placements since the last claim. It runs after the crowd's move (`turnBegins`), after the bounce
  or hop, after his move (after `legsOn`, his carrots and the spin's prize) and after Double hop. That covers captures, castling (both pieces),
  promotion, en passant, his hops, your bounced pawn and prize drops. A piece leaving keeps its square. Nothing from a client claims a square or a
  hold: all of it comes from the server's own board.
- **Battle Tower off**: `setUp` returns no Turf on `towerFloor` or with several bosses. `turfOf` is null there, and so are the layer, the bar, the
  hop-around and the holds. There's a unit test for it.
- **Protocol**: `NetBossPowers.turf` and `bossRequest.legs` are optional. An older app ignores `legs` and plays an ordinary move, skips unknown
  `turfHop` and `doubleHop` moments (`momentsOf`), and answers Double hop's extra request with Hollow's quiet pick, which the server accepts.
- **On-board layering** (`styles.css`): the Turf SVG is z-index 1 and comes before the carrots. The last move, check, the dots, the selected square
  and the pieces are z-index 2. The prints span about 27–73% of a square and the crowned pawn sits at 46% centered, so neither reaches the corner
  coordinates. The e2e test asserts turf z-index < piece z-index.
- **The count at 320 px** (a one-off local run, solo `?boss=hopper&power=turf`, 320 x 640): it's one line, x 114–300 inside the bar (14–306), with no
  overflow (scrollWidth = clientWidth = 186). The pills (icon and number below 360 px) sit at x 173–300 and y 70–90. Nothing overlaps the name, the
  level, "moves left" or the sprite.
- **Existing tests changed**: only adapted (the line count 61 → 63, `HOPPER_FX` and `POWER_FX` gaining `turfHop` and `doubleHop`, `.from` read
  through a helper). None were weakened. #883's three nits are folded in, with tests.

## Not reached
- I didn't run the unit tests, `e2e/hopper.spec.ts` or the boss kit (CI runs them). I didn't watch frames (I looked only at the stills on
  `stills/hopper-turf`). I didn't check the sim's numbers beyond the report.
- Online play with real devices (host plus checker determinism of `legsFrom` across engines) and the Hidden Boss and other room types.
