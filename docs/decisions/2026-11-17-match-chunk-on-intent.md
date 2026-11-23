# The match's chunk loads when play is next (Nov 17, 2026)

Director's brief (lazy-flakes): fix the cause of the flakes since #759 once, in the app where a player sees it, and at the source in the e2e helpers.

**Cause.** The bosses' code moved into the match's chunk (#759); evaluating it takes 0.4 s on a fast machine (81 ms before the split), a few
seconds on a busy runner. Home fetched it 1.5 s after it shows and **not at all while a game was starting** (the Bot level box, the queue: a
rule kept from when that timer built the tiles' portraits, useless during a start). So a tap into play within that moment paid for it
after the tap: a blank lobby screen until it came (tap → lobby 0.4 → 1.3-1.6 s at 6× CPU), or a solo match's opening later (Bot level OK →
openings 3.7 → 4.4 s). Measured on main at 12× CPU, two workers: the lobby's 5 s window used 2.6-3.2 s, solo's 4.2-6.5 s (one past 5 s).

**What changed.**
- Home loads it at once when play is next: the Bot level box, the queue, Play with friends (the Boss Battle screen already did). Otherwise
  still 1.5 s after home shows (the split's call, kept).
- Making a lobby (`createLobby`) waits for it beside the server's answer: home stays, loading, never a blank lobby screen.
- `<html data-match-chunk>` once it's in; the e2e helpers (`startBotLevel`, `createLobbyFromHome`, `openSoloBoss`, `openBossRaid`) wait for
  it once (`matchScreens`) before the tap into the match. With the fix at 12× CPU: lobby 0.4-0.8 s, solo 4.1-4.3 s.

**king-attack.spec:192 (Wrangler's Last Stand, lashes 0-4 never seen, 5-9 seen) isn't this.** The watcher starts before the move, so before
the Last Stand. His attack's code is in the chunk, which the battle waits for before it starts, and its frames are drawn ahead
(`prewarmKingAttack`). Locally, at 1× and 4× CPU with two workers, the attack's first frame comes 22-43 ms after its start with every lash
seen. A Chrome trace at 4× shows no long task there. The failure means no frame was painted for about 1.7 s from the attack's start
(each "−N" shows for a second). The passing retry's own trace has its longest frame gap, 415 ms, at that same moment: the runner stalls
painting the attack's first frames, not a load order. Left as is. If it comes back, look at the attack's first paint on CI's software
rendering, or at what the other worker was running then.
