# Dash's clock tap only when you're slow. god-king lane. Opus, high (timing, solo and online)

Branch `claude/dash-tap-slow` from main. About 45 min. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/bosses.md` (Dash),
`docs/decisions/2026-11-17-dash-stall.md` (#770, live).

**Eric, Nov 17 18:30 UTC (word for word), with a screenshot (`notes/briefs/assets/dash-tap-early-nov17.png` on claude/director-notes:
move 4, Dash lying by "Your move 10:31", moves played in 0-2 s):** "Bugged already, it fired off like 5 seconds into the match even tho
I played all my moves instantly". His original ask: "once per game he goes down laying down with his chess clock by your clock … and
starts tapping it for a few seconds" — a bored "hurry up" gag, so it must only come when you're taking a while.

**Today:** `tapTurn`/`tapNow` (chess/src/bosses/dash.ts) pick a seeded crowd turn 3–9 and the screen plays it `DASH_TAP.delayMs` (900 ms)
into that move, however fast you play.

**The rule now (the director's call):** once a battle, on the first of your moves (from move 3, never on a move with another moment of
his, the stall skit's beats included) where **your move has run `DASH_TAP.afterMs` = 10 s** (a bank clock: Boss alone, a party) or
**`afterShare` = 30% of the move clock** in a battle with a per-move clock (raids, group battles: 6 s of 20), he lies down by your clock
and taps for `tapMs` (3 s); if you move before that, nothing happens and it stays armed for a later move. It must end before the slam
(20 s / 50%): if it would overlap, it waits for a later move. Screen only, as now (no clock change).
- Simplest design wins: if it's screen-only, it can be decided by the screen's own clock per battle (no rules event, no server), as long
  as solo and online behave the same and a reconnect doesn't replay it. Remove what the old turn-begin event needed if nothing else
  uses it. Keep `?power=clocktap` (now: the tap at `afterMs` on the first move).
- Tests: change the tap checks in `dash.test.ts` / `dash-wired.test.ts` / `e2e/dash.spec.ts` to: not on fast moves; on the first move
  that reaches 10 s (30%); once; never with the slam. List them old → new. Boss lane (targeted + boss kit).

Done: `.pr-body.md` (under 40 lines) and `.done`, end. Blocked on Eric only: `.question`. No PRs, no CI waits.
