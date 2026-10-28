# Three e2e failures, three causes: a lost redraw, a clock jump, a countdown counted too early (Oct 28, 2026)

Lane: the director's (a fix-forward of tests that failed in CI on PR #392 and PR #388). Area pages:
[ranked.md](../areas/ranked.md), [bosses.md](../areas/bosses.md). None of them was a "flake": each has a cause, shown
below, and two of the three were real bugs a player could meet.

## 1. Ranked 1 v 1: "Updating your rank…" for good after a game (a real bug, in the app)

**What CI saw.** `e2e/ranked-1v1.spec.ts:154` (computer) waited 15 s for "Placement 1/5" after a resign and read
"Updating your rank…" 19 times (PR #392, job 122722354163). CI's history (every `e2e-summary` still kept, 79 runs that ran
this spec): the same line 4 times, always on the computer, 3 times at :171 (the resigner) and once at :149, where **White
already had its rank and Black never got it** in the 15 s after. A failed recording would have kept both waiting; one
player missing what the other had pointed at that one page.

**The cause.** The game screen's `useSession` (`packages/app/src/screens/Duel.tsx`) redrew by `setNow(Date.now())`, on
each server message and every 100 ms while the clocks run. Preact skips a state set to the value it already holds. So a
message handled in the same millisecond as the last redraw was never drawn, and once the game is over the clocks' timer
stops, so nothing drew again: the outcome sat in the session, the screen said "Updating your rank…" until something else
changed (Play again).

**The evidence.**
- Each page logged every socket message as it arrived and every redraw the hook asked for (a temporary probe, not
  committed). 2 of 20 players were left on "Updating your rank…" (4 workers on 4 cores). One of them: the game's end at
  `…627`, the clocks' last tick at `…629`, the outcome at `…629`; `window.duel.snapshot().outcome` was set while the page
  still said "Updating your rank…".
- With the page's clock held still (Playwright's `clock.setFixedTime`: every change lands in the same millisecond), 4 of 4
  games never even drew "You won" before the fix, and 20 of 20 drew the result and the rank after it.
- The server was ruled out. Under 4 CPU hogs, every recording try took 38 to 829 ms (20 of 20), none failed, and none
  waited for the 15 s retry. CI's log has no `DuelGame.record` error, which would have shown on stderr. The
  director's three guesses (a D1 failure, a socket down at the time, a race with the alarm) don't fit the :149 case either.

**The fix.** `useSession` redraws by a count (`redraw((n) => n + 1)`), which changes every time, and returns the time of the
draw. The server, its retry (`RECORD_RETRY_MS`), Ranked's rules, RP and what's stored are unchanged. **What a player sees:**
the rank line now always comes as soon as the server answers, about 0.1 s after the end, where before it could stay on
"Updating your rank…".

**Its guard.** A new test, `ranked-1v1.spec.ts` "every change is drawn, even in the same millisecond as the last draw …":
both pages' clocks held still from the last move, then a resign; the result and "Placement 1/5" must show. It failed 4 of 4
before the fix (on both projects).

## 2. Auto chess: the two pawns' first hops measured at the same moment (the test's measure)

**What CI saw.** `e2e/autochess.spec.ts:863` (phone), line 941: a gap of 0 between the two pawns' first hops (PR #392,
job 122722354080; once before, Oct 25).

**The cause.** The test let the page load on a running fake clock, then paused it with `pauseAt(now + 1000)`. Playwright's
pause jumps the clock, and every timer due inside the jump fires at its end (`_innerFastForwardTo` sets each due timer's
time to the jump's end). Each pawn's first hop comes at a random 0 to 7 s (`firstHopMs`), so when both were drawn inside
that second, both fired on its last tick and the observer stamped them with one time. The app's draws are their own
(`Math.random` per pawn, real-valued ms), and a browser fires each timer at its own time, so the pawns don't share a hop.

**The evidence.** A probe of the same setup, 150 runs on the phone: 45 of 300 first hops landed exactly on the pause's
last tick (1000/7000 = 14 % expected), and 5 of 150 runs had both, so a gap of 0 (3.3 %; (1/7)² = 2 % expected).
Every tie was on that tick and no second hop ever tied.

**The fix (the measure only).** The clock is paused before the page loads, then stepped (`runFor(50)`) until the buy step is
up, so every timer fires at its own time. `mountedAt` is read 200 ms on, once the screen's effects (which start the
pawns' waits) have run, so "the first hop within 7 s" is still measured from no earlier than the waits' start. 60 of 60
runs passed after it (phone, 2 workers), with the gaps checked as before.

**Changed checks (old → new):** none. Every assertion is the same. Only the clock's setup before them changed, and
`mountedAt` is now read after the screen's effects have run (it was read before them).

**Also found, not changed.** With 4 workers on 4 cores, line 905 ("a hopping pawn has its two animations") failed 2 of 24.
The CSS animation (1.8 s) runs on the browser's real time while the class runs on the fake clock, so a slow machine can end
the animation before the stepped clock takes the class off. This never showed in CI (2 workers). It needs its own fix in
how the test reads the animation.

## 3. The Hidden Boss's phase 2 countdown: the 5 was up short of its second (a real bug, and the measure)

**What CI saw.** `e2e/recluse.spec.ts` "beaten in phase 1 (?win=1)…" (computer), line 532: "c5 to c4" 948 then 916 ms on
PR #388 (job 122757190859, both tries). The history has 10 more: 9 at c5 to c4 (775 to 949 ms) and 1 at c4 to c3 (887 ms),
all on the computer.

**The causes.** There were two, and the probe below split them.
- **The app.** `startSimul` set the clocks' start to now + 5 s *before* the four boards were drawn, and their first draw
  is one long frame. So the 5 was on the page only from the end of that frame, and short of its second by the frame's length.
- **The measure.** `watchSpans` samples once per animation frame, and a long frame makes it see a number late. That alone
  cut a step by 4 to 112 ms (once it put the first running clock only 911 ms after the 1).

**The evidence.** Each number was stamped by a MutationObserver (the moment the app put it in the page) beside the frame
sampler, against the clocks' due time, under load (2 workers and 2 CPU hogs, 6 runs, before the fix). The 5 was put in the
page 49 to 116 ms after its second began, so it was up 889 to 974 ms (2 of 6 under 950 even by the app's own times). The 4,
3, 2 and 1 came 4 to 52 ms after theirs, and the sampler saw each a further 4 to 112 ms late.

**The fix.** `startSimul` sets the phase as before, then waits for the boards' first frame on screen (two animation frames,
or 250 ms when no frames come: a hidden tab, or the unit tests) and only then sets the clocks' start to now + 5 s and
starts the timer. So the 5 is up before its second begins, and the clocks start about one frame (50 to 120 ms) later than
before. New unit test (`recluse-phase2.test.ts`, "the countdown counts from the boards' first frame on screen…"): a 120 ms
first frame moves the count and the clocks' start by 136 ms; no frames, 250 ms. It fails before the fix. After it, under
the same load, 8 of 8 passed: the 5 was in the page 15 to 75 ms before its second, each of 4 to 1 came 0 to 31 ms after
its own, and the clocks 20 to 117 ms after theirs.

**The test now reads the app's own times.** A MutationObserver stamps when the app put each number, and then a running
clock, in the page, along with the clocks' due time (`phase.at`) at that moment (`watchShown` in the spec). The checks are
held against that schedule, so a short step is still caught, whether it's a countdown that runs fast or one that starts
before its number is drawn.

**Changed checks (old → new):**
- `first(c4) - first(c5) >= 950` (frame sightings) → the 5 in the page **before** its second begins (`<= due - 5000`); a
  stricter check (it failed on the old app every time).
- `first(cN-1) - first(cN) >= 950` for 4 to 3, 3 to 2, 2 to 1 (frame sightings) → each of 4, 3, 2, 1 in the page no
  sooner than its second (`>= due - N·1000`, 2 ms for the two clocks' rounding) and within 250 ms of it.
- `running.first >= first(c1) + 950` (frame sightings) → the first running clock in the page no sooner than the clocks'
  due time and within 250 ms of it.
- The order of every beat, the banner before the 5, and "a clock running once play starts" are unchanged (still from
  the frame sampler).

No check here guards one of Eric's standing rules (`docs/rules/eric.md`).

## Calls made

- The ranked fix is in the app only. The brief's other options, a quicker first retry on the server or the app asking
  again (`sync`) when no outcome comes, would have treated a failure that wasn't happening: the outcome reached the page
  every time.
- A held clock (`setFixedTime`) is the ranked guard, because it makes the bad case certain instead of rare. Its cost is one
  more game in the spec, about 20 s a project.
- The countdown waits for a frame, not for a signal from the screen. That is the least code, it works with no screen at
  all (the unit tests, a hidden tab), and the 250 ms fallback means a tab in the background never stalls the game.
