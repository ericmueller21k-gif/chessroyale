# Review: `claude/dash-tap-slow` (Dash's clock tap when slow)

Boss lane's one quick review pass, read-only. Base: `origin/main...origin/claude/dash-tap-slow` at `57b2c26`.
Nothing was run: this container has no `node_modules`. Every finding comes from reading the code.

**Verdict:** the core rules hold. Solo and the server plan the tap from the same function (`stallPlan`) with the same inputs
and the same base time (solo's `playStartedAt` and the server's `round.startedAt` both include the board intro). The tap
stops no clock: it's left out of `frozenWindow`, of both `frozenWindows`, of `thinkTime` and of `stallPausedMs`, and it
moves no deadline. Once the tap comes on a move, `nextBeat` and `stallPlan`'s `d.tap.at === crowdMoves` check keep the
slam and the fake move off that move, and both stay armed for a later one. A King's strike cancels a tap still to come,
in solo (`cancelStall`) and online (`next = undefined`), so it waits for a later move. A reconnect gets the tap through
`r.last`, with a pause of 0. Nothing touches the position. I found no doubled timer: after the tap, `nextBeat` returns
null, so `armRound` and `armStall` arm the lock/timeout only.

Findings, most severe first:

## 1. Group battles (raids): a player who already moved gets the crawl and the "just a joke" line (medium)

`packages/server/src/bosses/dash.ts:88` sends the tap to every `roundHumans()`, including players who already picked.
`packages/app/src/net.ts` (`case "stall"`) puts it on the `scoring` phase too. Then `DashTap`
(`packages/app/src/components/DashStall.tsx:173,179`) sees `ph.kind === "scoring"` on its first render and sets
`t.moved = now`, which is before `downAt`. That makes `joke = true`.

- **Scenario:** an online raid with two players and a 20 s move clock. P1 moves at 2 s. P2 is still thinking at 6 s
  (30%). P1, who was quick, sees Dash crawl down by their clock and say "Ayy homie, relax, it's just a joke." (a
  CRITICAL line), then get up. Eric's rule is "only when *your* move reaches 10 s / 30%". P1's move never reached it.
- **Parties** (picks stay changeable, so the phase stays `play` after a pick, net.ts:1504): every member who has picked
  sees him lying "until you move" and gets "Bro, I'm not moving till you do." 20 s later, though they did move. That may
  be acceptable as "the team's move", but it's worth a call.
- **Fix (simplest):** in `DashTap`, start the tap only when it's first seen in `play` (and, in a party, only before
  `myPick`). A tap that arrives already `scoring` is ignored. Or the server sends `beat: "tap"` only to the humans with
  no pick yet. Either way, keep sending `r.last` so a reconnecting non-picker still sees it.

## 2. His tap tick sound loops for the whole move, with no cap (low to medium, player-facing)

He now lies "until you move" (`upAt = Infinity`). `SpriteAnim` (`DashStall.tsx:216`) runs `lieDown` then the looping
`idle`. `idle` has two `cue: "tap"` frames per 800 ms cycle (`packages/app/src/characters/dash-lie.ts:459` and
the `pressed` frame after it), and `spriteFrameAt` tags each loop cycle separately. So `dashTick` plays about 2.5 times a
second for as long as you think.

- **Scenario:** Boss alone has no cap on one move. You think for 60 s at move 5: about 150 clock clicks after 10 s. The
  old version stopped at `tapMs` (3 s).
- **Fix:** let the idle's taps make sound only for the first few seconds (pass `sounds={}` once `now > downAt +
  ~3000`, or a `silentAfter` option), or confirm with Eric that the endless ticking is wanted.

## 3. Solo doesn't drop a tap that comes in the last second the way the server does (low)

The server drops any beat within `DASH_STALL.marginMs / 2` (1 s) of the deadline, and the tap stays armed. Solo only
needs `tapMs < allowedMs` (`packages/chess/src/bosses/dash.ts:341`) and fires anyway (`solo.ts:1565`).

- **Scenario:** Boss alone (10 + 10). After a near-flag, your bank is 10.3 s when the move begins. At 10.0 s he starts
  to crawl. You flag at 10.3 s, before he's down at about 10.54 s. `DashTap` sees the phase change as "moved", so you
  lose on time to "Ayy homie, relax, it's just a joke."
- It also spends his once-a-battle tap on a move that ends almost at once. Server modes with move clocks can't reach
  this case (30% is far from the end), so it's solo-only, but solo and the server should agree.
- **Fix:** put the margin in `stallPlan` for the tap: `tapMs <= allowedMs - DASH_STALL.marginMs`. Then both sides agree
  without a solo-only check.

## 4. In the joke case, his own turn plays while his figure is hidden (low)

In the joke case, `shown` lasts from `t.at` to `downAt + jokeMs + getUp`: 540 + 1800 + 430 ≈ 2.8 s. The whole time,
`body.dash-away` hides `.boss-char .boss-char-sprite` and every usual `.bc-bubble`. In Boss alone his reply comes about
350 ms after your move (`dashThinkMs`). If it's a capture, his Clock Slap moment (`playInPlace` where he stands) plays
invisibly. His move or slap line goes to the bubble over his lying figure, competing with the CRITICAL joke line.

- **Scenario:** at move 6 you move 0.3 s after he starts to crawl, and his reply takes a piece. You see the slap banner
  and the dock change, but no slap animation, because his figure is away.
- **Fix:** either accept it (Eric asked for "let the crawl finish") or hold `bossTurnShowMs` for the joke case's
  remaining time. The second is more code: I'd ask the director before doing it.

## Checked and fine

- **Which move takes it, solo vs. server:** the same `stallPlan` and the same base time, as above. The unit test
  (`dash-lobby.test.ts`) compares a restored runner's plan with the server's.
- **The skit after the tap:** the next move's plan has `tapAt: null` and the skit as usual. The fake move alone after a
  slam is still possible (`nextBeat` lets `fake` through when only `slam` came).
- **The round ending while he's lying:** any phase change away from `play` on his move (scoring, timeout, King's call,
  Last Stand, results) sets `moved`, and he gets up. When the match screen unmounts, the cleanup removes `dash-away`.
- **Clock digits and squares:** the figure is placed below the board's bottom and beside the time, as before. The
  bubble's bottom is `min(cap top, time top)`, so it never covers the digits or his cap. Eric allowed it to sit a
  little over the board, and it's `pointer-events: none`, so taps go through.
- **No clock or position changes:** `tapped()` only writes `dash.tap`. No deadline, bot timing, `progress.postpone` or
  `thinkTime` changes.
