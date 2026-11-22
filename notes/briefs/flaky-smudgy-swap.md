# Flaky e2e: smudgy.spec.ts:189 (phone) on main (Nov 22). Opus, high. Fix the cause, never loosen the check.
Main's full run for 8012d122 (run 45008251162, shard 15) went red: the test passed only on its retry. First attempt (2.0 min, the
retry 50 s): `yourMove` at smudgy.spec.ts:276 (the "three more turns" loop, after `submitMove`) waited 90 s for phase "play" and got
"results": the battle ENDED mid-test. Neither of that day's merges touched Smudgy (a music file; the gold rides' sound).
Ruled out by the director: the test's `quiet()` crowd getting mated (24 simulated games vs Stockfish 1500-3000 from his forced opening,
9 moves each: none mated); a raid's misses (crowdMisses is off in a raid). Still open: what ended it. Suspects: the 60 s move clock
(`?clock=60`: moveClockSeconds) running out while the test records frames on a starved runner (`submit(null)` on the timeout: what
does a null move do in Boss alone with `bossAloneClock` off?), his Repaint/strike or a power ending the battle, or the boss's own clock.
Steps: read the results phase's reason in the page when it happens (add it to the test's failure message, e.g. `match.phase` and the
boss's end reason, so the next flake names its cause), reproduce on your own machine (`--repeat-each 3`, under CPU load if needed),
fix at the cause (the test's pacing or the app), and say which in the PR body. Earlier fixes to this spec: 318f7219, d21441f2.
Deliver: branch `claude/flaky-smudgy-swap` from origin/main, `.pr-body.md` + `.done` when CI is green.
