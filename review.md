# Review: `claude/bigboy-tower` (Big Boy's toy-block tower), boss-lane quick pass

Read-only review of `git diff origin/main...origin/claude/bigboy-tower` (Nov 18). The rules (`packages/chess/src/bosses/bigboy.ts`),
the dispatcher they plug into (`boss-powers.ts`, `runner.ts`), the server's timing (`lobby.ts`), solo (`solo.ts`), the screen
(`components/BigBoy.tsx`, `styles.css`) and the FAQ. Nothing was run (no `node_modules` in this container). Every finding below
comes from reading the code paths end to end. Most severe first.

What holds up: no position without a legal move (`crowdAllowed` / `bossAllowed` lift, and `scatterSquares` keeps the side to move
a free move); castling never topples it and a block on its path stops it; a block never stops an attack (check is chess.js's);
en passant and promotion have no special path through the tower (the tower stays in the crowd's half, a scattered block is just a
block); the Big Bounce's landings avoid every toy square, and its new-promotion guard is sound; `hisToppleOpen` rolls on
`seed`/`turn` only, and the host plays from the server's `allowed` list (`lobby.ts:2347`), so solo, the server and the host agree;
the Last Stand never runs while a tower stands (`boardAltered`), so a taken-back topple can't happen; `afterCrowdMove` is skipped
for Last Stand rounds; the God King's move goes through `finishRound`, so his move onto the tower topples it like anyone's.

---

## 1. Medium: blocks from the crowd's topple stop his pieces for two of his moves, not one (rules, screen and FAQ)

- **Where:** `packages/chess/src/bosses/bigboy.ts:477` (`topple(next, fen, "crowd", p.turn, p.turn + 1, ...)`) with `wearOff`
  at `bigboy.ts:421` (`until < t.turn`), which only runs in `prepareTurn`, after his move. FAQ: `packages/app/src/faq/content.ts:832`.
- **What goes wrong:** Eric's rule (decision note): "they persist for his turn, and then for your turn, and then they go away". The
  crowd topples on crowd turn T, so `until = T + 1`. The blocks are cleared only when `prepareTurn(T + 2)` runs, and that comes
  after his reply to crowd turn T + 1. So `bossStops` still filters his move after T + 1 (`bossAllowed` reads `scatter`), and
  `scatterItems` still draws them (`last.until < p.turn` is false while `p.turn` is T + 1). The order is: his move, the crowd's
  turn, **his move again**, then they go. The FAQ says "through his next move and your next turn". The unit test
  (`bigboy.test.ts:288`) never checks his second move, so it passes.
- **Scenario:** turn 2, a knight takes the 8-tall tower on e4 and blocks land on d5/f5/e6. Black's reply on turn 2 is limited (as
  it should be). On turn 3 the crowd plays a3. Black's reply on turn 3 still can't play ...Bd6-e5 through or onto d5/e6 (wrong), and
  the blocks are still on screen while he thinks. They go as turn 4 begins.
- **Fix:** end them at the end of the crowd's turn T + 1. In `afterCrowdMove`, drop `scatter` when `scatter.by === "crowd" &&
  scatter.until === p.turn` (or store `until` as "the last crowd move" and clear it there), and draw them gone in
  `scatterItems` from his thinking on. The new tower still starts as T + 2 begins. Add a check to the unit test that
  `bossAllowed` is null (no limit) on his move after T + 1. The by-him and fell-by-itself case (`until = t.turn`,
  `bigboy.ts:447`) is already one crowd turn plus one move of his, which matches the balance note. Either fix the code or fix the
  FAQ, so the two say the same thing. The FAQ also says "fallen by itself: through your next turn", but the code keeps those blocks
  through his next move too, the same as "by him".

## 2. Medium (solo only): your topple gets cut off by the Big Bounce. Online waits for it, solo doesn't

- **Where:** `packages/app/src/solo.ts:1107` (`bounceTurn`: `bossThinkMs(snap)` with no `afterMs`). Compare
  `packages/server/src/lobby.ts:2312` (`requestBounce` → `thinkMinAt()` includes `bigboyTurnMs`) and `solo.ts` `bossTurn`
  (`landed` includes `bigboyTurnMs`).
- **What goes wrong:** your move topples the tower on the same turn the Big Bounce is due (it was warned with RAGE! as the turn
  began). Online, the server holds the bounce until `max(1200, POWER_FX.topple = 2200)` ms. Solo, the bounce screen comes after
  `max(engine time, 1200)` ms. The bounce screen's moments are the bounce alone (`momentsOf` with `own`), so `toppleMoment` finds
  nothing. `towerAnim` returns null partway through the tip, the flights in the air vanish, and the blocks snap to "sit"
  (`appearAt` → 0). A fast device cuts it at about 1.2 s of 2.2 s. This is a solo-vs-online timing difference, and it's what
  `bigboyTurnMs`'s doc says must not happen ("The same in solo and on the server").
- **Fix:** in `bounceTurn`, `bossThinkMs(snap, false, bigboyTurnMs(snap))`. It's the same sum `bossTurn` uses. If other bosses'
  moments can come before a bounce, take the whole `landed` sum. Add one e2e check: in the `?power=tower` spec, topple it on a
  RAGE! turn (or with the trigger) and see the `tip` animation reach its end before `.pm-bounce`.

## 3. Medium-low (screen): the tower layer covers move dots, last-move and check highlights on its square and the 3 squares behind it

- **Where:** `packages/app/src/styles.css:16820` (`.board-wrap > .bb-under { z-index: 1 }`; `.bb-tower` is 1.5 squares wide and
  4.25 tall). The board's squares (`.hb square.move-dest`, `.last-move`, `.check`) have no z-index, and `.hb` makes no stacking
  context of its own ("nothing here makes a layer of its own").
- **What goes wrong:** the layer sits over the squares and under the pieces (z-index 2). The pieces stay in view, but anything
  drawn on the squares under the tower's opaque blocks doesn't. That includes the green **move dot on the tower's own square**, which
  is the cue that from 2 blocks you may move onto it and topple it. It also includes the dots, the last-move tint and the check glow
  on the squares up to 3 above it (toward his side) once it's tall. Zebra's dough and the candle shadows use the same z-index, but
  they cover a single square and are translucent. This tower is up to 4 squares of opaque art.
- **Scenario:** a tower 6 tall on e4 (crowd White, board from White). Tap the Nf3 knight: its dot on e5 is under the tower's upper
  blocks, and the dot on e4 itself is under the bottom block. If his last move was ...d6-e5, the last-move tint on e5 is hidden too.
- **Fix:** take one still to confirm first. If it's as the CSS says, the least code is to lift the square marks over the layer:
  give `.hb square.move-dest`, `.last-move`, `.selected` and `.check` a z-index between the tower and the pieces (1 < z < 2, e.g.
  1.5 is not valid, so move the under-layers to 1 and the marks to 2 with the pieces at 3, or make the tower semi-transparent
  above its first block). Whichever way, add one focused check to `e2e/bigboy.spec.ts`: on a 2+ tower, the move dot on its
  square is the top element at that point (`elementFromPoint`).

## 4. Low: his piece can end up on a scattered block, which then makes it uncapturable and covers it

- **Where:** `bigboy.ts:474-477`. `afterCrowdMove` drops scattered squares a crowd piece now stands on, but nothing drops one his
  piece stands on (no `afterBossMove`, and `wearOff` and `passive` don't check). Drawing: `BigBoy.tsx:403` (`.pw-block-board`,
  over the pieces).
- **How it happens:** blocks from the crowd's topple stand through his next move and the crowd's next turn. `scatterSquares`
  guarantees him a free move only in the position right after the crowd's move. If the Big Bounce comes that turn (warned as it
  began), the crowd's pieces are rearranged and his legal set changes. If every move left touches a block, `bossAllowed` lifts the
  limit and his piece can land on a block square. On crowd turn T + 1 that square is still in `scatter.squares`, so
  `toyStops(capture onto it)` is true. **The crowd can't take that piece** (the limit lifts only if no move is left at all). The
  block is also drawn over the piece (`pw-block-board`, z-index 3). It's rare, but it's an illegal-looking position and a free
  piece for him.
- **Fix:** one line, the same as the crowd's case. In `BIGBOY.wearOff` (or at the top of `passive`), drop scattered squares where
  `pieceAt(t.fen, sq)` is set. If you prefer, add `afterBossMove` with the `afterCrowdMove` filter.

## 5. Low: a reconnect mid-topple replays your topple from the start (cosmetic)

- **Where:** `BigBoy.tsx` `yourTopple` (`toppleSeen` keyed by the time this device first saw it).
- A device that reconnects (or joins) 2 s into the server's 2.2 s hold starts the topple from its first frame. His move then
  arrives 0.2 s later, and the tower vanishes mid-tip and the blocks snap in. It's harmless. If it's worth fixing, start the
  moment from the server's `bossMinAt - POWER_FX.topple` (the boss message carries the hold) instead of the local first sight.

---

## For the director (by design, not bugs, but bigger than the note says)

- **The God King's Last Stand is now effectively off against Big Boy.** `boardAltered` (`runner.ts:1077`) is true whenever
  `tower` or `scatter` is set (`powerTurn`, `bigboy.ts:467`). From turn 2 one of them is always set, and the Last Stand doesn't come
  in the crowd's first `lastStandFromMove` moves anyway. Before, it could come about one turn in four. The decision says "as the
  block's turns were", which understates this: it's now every turn. If Eric expects the Last Stand to be possible in a Big Boy
  battle, this needs his call. One option: count the tower as altering the board only when it actually removes a crowd move or
  his reply. That's the same fix the fair-play proposal needs (`powerTurn` seeing the position).
- **Fair play gets no signal turns against Big Boy** (the same cause; the balance note's proposal covers it).
- **Stored-state upgrade:** an online battle running across the deploy keeps the old `block` and `nextPassive` (old `+ blockEvery`).
  The old block stops applying at once, and the first tower waits for that `nextPassive`. This is only relevant before launch.
- **Guard tests touched:** `boss-power-legal.test.ts`, `king-save-altered.test.ts` and `refused.test.ts` were updated from `block`
  to `tower`/`scatter`, keeping the same assertions. None is listed in `docs/rules/eric.md`, as far as I found. The PR body should
  still list them as changed checks.
