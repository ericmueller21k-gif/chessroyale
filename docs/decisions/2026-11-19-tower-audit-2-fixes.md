# Battle Tower audit 2: the fixes (Nov 19, 2026)

The fixes to [audit 2](2026-11-19-battle-tower-audit-2.md)'s findings 1, 2, 6 and 7 and its nits, in one PR (targeted lane). Findings 3,
4 and 5 went to the tower's flow rework (branch `claude/tower-flow`), which owns the tower's screen and the app's start and settle.

## Finding 1: every boss on a shared floor drawn from his own view

- **The view** (runner `buildBossView`): every moment in the queue names its boss (`PowerEvent.boss`, set in the view only, never kept),
  and the side says who made each of its moves (`side.movers`, by the board's ply, from `MatchState.movers`, noted as each boss's turn
  ends). Each boss's part now carries his own ice; the top level keeps the side's (the refusal and the allowed moves read it).
- **The screens** read each boss from his own part through one small module, `boss-side.ts` (`sideOf`, `partsOf`, `partOf`, `moverOf`,
  `plyMoverOf`, `onSide`), so every screen draws a boss as it would draw him alone. Calls made:
  - `PowerBoard` is drawn once a boss, each with only his own moments (another boss's moment on the same square never times his marks).
  - Beyond the brief's list, the same cause reached every power-specific drawing keyed by a boss id (Wrangler's, Alfil's, Chub &
    Chirp's, Smudgy's, Puddles', Timber's and Don Dough's board animations, Big Boy's bounce, Sawyer's split, G-REX's fire, Boingo's
    funhouse, Moo's daze, Hollow's dark and bulbs, Dash's scramble and stall, Wrangler's duel line): each now reads its boss's part.
    Same fix, a word each; leaving them would have left the same bug a moment later.
  - The boss's mate attack, QUEEN DOWN!, his "plays" line and a turn with no move to show name the boss who moved (`moverOf`): after
    his move the view's top level is already the next boss.
  - His words: a moment's line is keyed by the boss who cast it, and the bar shows the bubble by the part of the boss whose id starts the
    line's key (`speakerOf`), else by the boss to move. The dimming of the other parts moved from the part to its contents, so a boss's
    words by a dimmed part are whole, never greyed.
  - "… is thinking" names the boss to move on a shared floor; one boss keeps "The boss is thinking…".
- One boss: unchanged (no side, the view's top level as before).

## Finding 2: a reload rejoins after his reply; the clock

- The floor is kept as each step of the bosses' turn has played, right before its show (solo.ts `nextRoundIn`): the snapshot is then
  exactly what the next round starts from, so a rejoin takes the same path the timer would have.
- **The clock (the director's call):** the time used on your turn is kept with the game and given back as used on a rejoin; no time
  passes while you're away. Calls made:
  - The time is kept as the page is hidden or closed (`visibilitychange`, `pagehide`), not on a timer: a reload, an app switch and a
    locked phone all fire one. A browser crash loses at most the turn's time used (the turn's start was kept).
  - **While the page is hidden your turn's clock stands still**, not only across a reload: a phone locked mid-floor overnight would
    otherwise come back to a lost floor (its timers fire as it wakes), which "a floor left overnight isn't lost on time" rules out.
    It is the same freedom a reload already gives (leave and come back with your time), so it opens nothing new.
  - A tower floor only; every other solo battle's clock is as before.
- Not changed: Hollow's wrong tries into the dark during your turn are kept at the next step, not as they happen (the brief's scope was
  the bosses' turn); a reload mid-turn after a wrong try gives that bulb back. Noted for the director.

## Finding 6: no new XP game on a rejoin

- The floor's XP game id is kept with the floor (`KeptFloor.xp`); a rejoin goes on with it (`noteFloorGame`). A floor kept before this
  change, or begun with no account, has none: then no XP for that floor, rather than a game timed from the reload.

## Finding 7: a new deck leaves out the bosses still waiting

- `deal`: the new deck is the pool less the bosses still in the old one. Deals with no kill switch are unchanged (checked over 1,000
  runs of both full pools); only a pool already too small for the rules deals differently.

## Nits

- The area page and the audit brief no longer say "next to Auto chess": the town's clerk only (Eric, Nov 19).
