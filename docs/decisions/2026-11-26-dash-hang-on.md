# Dash: Time Scramble's seconds by use, and "Hang on" in his second pop-off's place (Nov 26, 2026)

**Eric (Nov 26):** "the first time he fires it off is 5 seconds for 3 moves, and then when he does it again, it's 3 seconds for 3
moves. Yeah, I think that's fine with that slight like network allowance." And his second pop-off becomes a new gag: you move, he
moves your piece back, "hang on 1 second", your clock keeps ticking, he smacks his clock slowly then faster, "time for cheetah speed"
(head up, mouth open, really enjoying himself), "almost done, bro", winds the clock, "sorry about that, bro, I'll give you your time
back", your clock back where it was, your piece back, then his move. "Whatever's easiest, so it doesn't actually mess with the game."

**Time Scramble**
- `scrambleMoves` 5 → **3** (it was 5, Eric's old "5 moves of 3 s", not 3 as the brief thought); `scrambleSeconds` 3 → **[5, 3]**, read
  by use (`scrambleSecondsOf`: the battle's ultimates so far, `ults`; a third, were the cap raised, gets the last). The late-pick grace
  (`lateGraceMs`) as it was. The banner, Tick's tally and the countdown read the view's seconds; the FAQ says both.
- His `ultimate` line "Three seconds a move, cuz. Skrrt!" named the old number: now "Short clock, cuz. Skrrt!" *(mine)*

**"Hang on"** (`DASH_HANG_ON` in settings.ts, `hangOnTimeline` in bosses/dash.ts)
- **Presentation only.** It is the second pop-off's state (`popOff: { at, hangOn: true }`), so it rides the pop-off's path: the server
  and solo hold his move for it (`popOffMs`: the timeline + `tailMs`), and his move row stays out of the list meanwhile. Your move is
  played and confirmed as ever; the bank and every clock are untouched (the dock shows `hangOnClock`, a display only).
- **Timings:** 12.6 s from the gag's start to his move: back at 0.45 s, cheetah speed at 6.2 s, "almost done" at 8.0 s, wind-up at
  9.2 s, sorry at 10.1 s (the clock given back by 11.3 s), your piece home at 12.1 s. Eric said "the whole thing lasts like 12 seconds"
  with cheetah speed "6 to 8 seconds" in; I read that as the whole gag, not 12 s of smacking plus the rest (16 s of everyone waiting).
  *(mine)*
- **Lines:** Eric's, with the sorry shortened to fit the two-row bubble (48): "Sorry about that, bro. Here's your time back." Each line
  cuts in on the last (`INTERRUPT`): at the same priority one waits for the other to end, which put the sorry after his move. *(mine)*
- **Art:** no new drawing. The smacks are his move's slap frames (slow, each a little quicker, `hangSlow`; then 80 ms each, `hangFast`);
  the head thrown back, eyes shut, mouth open is his jkLaugh's head on those frames; the wind-up is his paw circling the clock's front
  with his `whirr`, then a press of the clock (its click: Eric's "he like presses it"); the sorry an open paw raised. *(mine)*
- **Pre-moves:** the board shows any waiting but takes no new one during the gag (`watch`), so nothing is aimed at a board that isn't
  real; a pre-move made before it plays after his move as ever. *(mine)*
- **Only after your move:** the pop-off and "Hang on" play only while he thinks after your move of their turn (`popOffPending` now also
  checks `crowdMoves`). Before, his thinking for a failed Scramble Rush's extra move on that turn also matched: the pop-off would have
  played (and held) twice, and "Hang on" would have slid his piece. *(mine)*
- Like the pop-off it starts as his thinking starts (after your move is judged: about 2.5 s in solo with Stockfish judging) and plays
  from when a device first sees it. The clock shown doesn't turn red when low.
- Test switches: `?power=hangon` ("Hang on" on his second turn, no pop-off); `?power=popoff` is now the pop-off on his second turn and
  "Hang on" on his fourth.
