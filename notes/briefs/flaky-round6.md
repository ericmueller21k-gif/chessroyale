# Flaky round 6: main is red again (fix the causes; Eric, Nov 13: "fix the cause, not add a checker")

Effort high. New branch `claude/flaky-round6` from `origin/main`. Read CLAUDE.md "Fix the cause…", `.claude/LESSONS.md`, and rounds 4 and 5's
notes (`docs/decisions/2026-11-14-flaky-round4.md`, `-round5.md`: `townTap`/`tapInTown`/`townHeld` hold the town's frames from a read to
its tap). For each: **is the game wrong, or the test?** Game first. Eric's guards (`docs/rules/eric.md`): game-side fixes only, or a
proposal in .pr-body.md. (The Hidden Boss room's tests are no longer guards, Nov 14; the online 🏆 is an admin tool to be deleted: don't
spend on `hidden-boss-room.spec.ts:111`'s 🏆 step.)

Main's last two full runs each had retry-passes, different tests each time (they were clean in three runs before):
- Run 43625203937 (3635a561; CI recorded every first try then, so **first-try traces of these five are in its `e2e-report-shard-N`
  artifacts, kept 7 days**: download them with the GitHub API: /actions/runs/43625203937/artifacts): town.spec:1165 [phone],
  town-chat:1480 [phone, timed out at 180 s], hidden-boss-room:111 [desktop, the 🏆 step: skip], town-controls:253 [phone] "right goes
  south", town-street:294 [phone] (WebGL context lost).
- Run on 77a15f0e (#717; retry traces only): town-street:174 [phone] (a park table), fairplay:65 [phone, Eric's ban guard],
  town.spec:966 [desktop] (a person's card).
- Earlier leftovers: town.spec:646 [phone], lobby-chat:28 [phone], shop:238 [phone] (round 5's proposal: check the fps reading's window,
  not a frame rate), town-chat:1367/1370, alfil:247, town-street:155.
First look for what's common: most are town specs, and they started after round 5 moved every town tap to `townTap` (#715): does
holding the town's frames (`__townHold`) leave anything running or held (an animation, a timer, the camera, a card) that a later step or
the next test trips on? Check that before fixing one by one. Also check whether CI's runners are simply slower today (compare shard
durations across main's last runs).
Do the shared cause (if any) and as many of the rest as time allows ("Not done" for the rest). Prove each (`--repeat-each 3 --retries 0`
on the project that failed, before and after where reproducible). Typecheck; unit tests of packages you touch. Push at each real step;
`.pr-body.md` (a table: test, game or test, cause, fix; checks changed old -> new); `.done`. No PRs, no CI waits, no model names in commits
(end commits with the Claude-Session line only). About 1.5 hours.
