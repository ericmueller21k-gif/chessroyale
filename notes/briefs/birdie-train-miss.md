# Birdie: the train rides even when you saved the piece, and misses (Nov 24). Opus xhigh, boss lane

Eric (Nov 24): "we still need to show the birdie driving his train across the board animation, even when there's no pieces to hit. He
just simply drives across and then everything misses."

Today (`packages/chess/src/bosses/birdie.ts`, `birdieBattle.afterCrowdMove`): when your move takes the warned piece off the line, no
ride happens at all (`trainOutcome` returns null: nothing on the square), so the warning just ends. Eric wants the ride every time his
warning comes due: the same ride (`BIRDIE_BEATS.ride`, the departure, the crossing at `rideMs`, the return), and nothing is hit.

Start: `git fetch origin main && git checkout -B claude/birdie-train-miss origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `docs/areas/bosses.md` (Birdie), `git show origin/claude/director-notes:notes/designs-birdie.md`.
Effort xhigh: the ride's moment holds his move online (the server's timing, `BIRDIE_FX`), so solo and online must agree.

1. **The miss ride.** When the warning for this crowd move is due (`w`, not `over`) and the warned piece is no longer there (moved, so
   saved), the train still rides the warned line: a new event (e.g. `trainMiss`, or `trainSmash` with a `missed` flag: your call, record
   it) with the line's squares and no smash. The board is unchanged; no base. Every piece still on the line, his and yours, steps aside as
   it passes (on screen only), exactly as his own pieces do today, so it reads as "everything misses". No warning sign, no shatter, no
   smash sound; the ride's own sounds (horn, whistle, rumble) as on a smash ride. Keep the existing rule that nothing rides once the game
   is over on the board, at the move cap, or with the battle decided.
2. **Timing:** the miss ride takes the same time as a smash ride (`BIRDIE_FX`), holds his move the same way solo (`playBoss`) and online
   (the server's moment hold: find every place `trainSmash` is timed or listed, e.g. `packages/server`, `bossMoveMoment`, the dock's
   lines), and his fall after it on the same turn still comes after the train. Check whether the warning is cleared when the piece moves
   before the ride (a different piece of yours moving onto the warned square must not be smashed: if it can be today, fix it and say so).
3. **Judge and fair play unchanged:** saving the piece still scores as today; the turn's `powerTurn` as today.
4. **Dock / God King:** if the dock or the God King say a line on a smash, a miss can say a short line or nothing (your call, plain
   American English, e.g. "Birdie's train rides by. Nothing hit!"); never a line claiming a piece was lost.
5. Prove: typecheck; chess `birdie` tests (a saved piece → a miss ride event with the line, board unchanged; a smash as before); server
   birdie lobby test if the hold lives there; the boss kit; `e2e/birdie.spec.ts`, one focused check (save the warned piece → the train
   crosses: its element moves across, and the board is the same after), phone and computer; Birdie's boss smoke. Watch the miss ride frame
   by frame once (`npm run frames:boss` or #909's recorder). Stills on a new orphan branch `stills/birdie-train-miss`: 6 frames of a miss
   ride on the phone. Decision note of about five lines. Area page (bosses.md, Birdie). PR body in `.pr-body.md` (what changed,
   player-visible, changed checks old → new). Then `.done`, push, stop. Don't open PRs or wait on CI. Helpers reset, never revert.
   Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By line, no model
   names). Never write the Hidden Boss's name. American English.

## Added Nov 24 ~08:30: fewer chirps, train sounds only on the ride (same PR)

Eric (Nov 24): "I think he's doing a little too much chirping and the train noises. Let's really make it so he can chirp at the start of the
game, and I would say cap the chirping to, you know, maybe once every 5 of his moves at most. He can do a little chirp, and then his train
noise is really, let's just keep it for when the train actually crosses, when he jumps on it and goes across the board. But I don't think we
need the train horns for like any other spot right now."

6. **Train sounds only on the ride.** Whistles, horns and toots play only while his train rides the board (from his duck-in/pull-away
   through its crossing and its roll back in and brake after the ride; smash and miss rides alike). Silent everywhere else:
   - his ordinary move's whistle (`run`, `runShort`, `runLong`, `runPeeps`: `birdieCue`'s `run` → always null);
   - a capture's or check's toot-long (`tootRun`);
   - the warning's conductor's whistle (`signal`); the crossing's bell (`birdieCrossing`'s `ding`) stays, as the warning's cue (it's a
     crossing bell, not a train);
   - the battle start's entrance: the train's roll and brake (`roll`, `brake`) are silent at the battle's start (his hop and "hello" chirp
     stay); they're heard only on his return from a ride;
   - the fall cutscene's `approach` toot (`BirdieFall.tsx` `PICTURE_SOUND`); its whoosh and clank stay.
   Keep the sound files and names (no deletions of synths); only what plays changes. Director's calls, record them in the decision note.
7. **Chirps at most once every 5 of his moves.** His hello at the battle's start stays. After that, all his ordinary chirps (the nod over a
   move, his chatter and smug teeoo, a capture's trill, a check's teeoo, his hurt scold) share one budget: at most one chirp per 5 of his
   moves, from his move number alone (the same on every device; e.g. heard moves 1, 6, 11, …: `BIRDIE_SOUND_EVERY: [5]`, Eric's words in
   its comment). On a heard move, one chirp only (pick the event's: trill or teeoo for a capture/check, else the nod). His victory,
   defeat and fall sounds are unchanged.
8. Tests: update `packages/app/test/birdie-sounds.test.ts` / `boss-kits.test.ts` (old → new in the PR body); one focused check that no
   whistle plays on his ordinary moves and the ride's sounds still play. No new e2e spec.
