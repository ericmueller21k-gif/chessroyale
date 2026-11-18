# Dash: the slam / fake move never came after his clock tap (live bug, Eric's playtest). god-king lane. Opus, xhigh (boss timing solo + online)

Branch `claude/dash-skit-fires` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md` (Dash), the decisions
`2026-11-17-dash-stall.md`, `2026-11-17-dash-tap-when-slow.md`, `2026-11-17-dash-pause-watchers.md`, `2026-11-17-dash-spec-getup.md`.

**Eric, Nov 18 (word for word):** "Dash is still coded wrong, his 20/30 second gag isn't firing, his 10 sec one did then a few turns later I
did nothing for a minute and he just stood there". (Mode not yet known: the director asked; assume Boss alone / solo first, then check online.)

**The plan code** (`packages/chess/src/bosses/dash.ts` `stallPlan`, `skitPlan`, `nextBeat`) returns null for the whole move when: any event
of his this turn (`p.events.length`: e.g. a Clock Slap after his capture, a flag, a clock fit), a Time Scramble's move, his Scramble Rush
warned/on, the crowd in check, no quiet move of his (`stallMove` null), or `allowedMs - fakeAt < marginMs` (with a bank: is `allowedMs` the
whole bank, or something smaller like a per-move cap?). Also check solo's arming (`solo.ts` stall timer: armed at each move's start with a
fresh plan? re-armed after the tap's move?) and the server's (`armRound`).

1. Reproduce Eric's case for real: a solo Boss-alone battle with Dash (no test switch), play instantly until the tap comes at 10 s (move ≥ 3),
   then wait 60 s on a later move with no other moment of his. Log the plan and why each beat didn't arm. Also try with his normal moments
   happening (captures → slaps) on the moves before.
2. Fix the cause. If the cause is a rule that's too strict for Eric's "once a game" intent (e.g. any other moment of his this turn blocks the
   skit for that move, which in a real game may be most moves), loosen it to what's needed (only what truly collides on screen) and say so.
3. One focused test that fails without the fix (a real-flow solo test, not the test switch), plus the online equivalent if the server shares
   the cause. e2e `dash.spec.ts` phone. Targeted/boss lane.

Done: `.pr-body.md` (under 40 lines: the cause, the fix, proof, changed checks) and `.done`, end. No PRs, no CI waits.
