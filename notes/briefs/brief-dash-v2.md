# Brief: Dash v2: the clock smacks toned down, the Scramble Rush ultimate, the timer power kept

**Eric, Nov 6 (after playing Dash):** "He smacks the clock too much, the noise is distracting. Just have him smack it every time he moves … his gameplay feels pretty boring … like a last-minute thought."

Today, in boss.ts:248: `{ id: "dash", powers: { passive: "clockslap", ultimate: "scramble" } }`. Read Dash's kit, his powers and sounds, and BossPowers before changing anything.

## 1. The clock smacks
- **One smack per move he makes.** Remove every other routine smack.
- **A "clock fit" at most twice a game:** at random, 3–5 quick smacks in a row, plus a line about how much he loves his clock. Eric: "cause it's frustrating to hear as a player". The line should show it's a quirk, for example "Nothing beats that click. I love this clock." or "Best sound in the world, fam." Write 4–6 variants in his voice (casual, "fam", "my guy").
- Smacks during the Scramble Rush countdown are below.
- Constants go in settings (core settings.ts), not in game code.

## 2. Two big powers
- **The clock power he has today** (the timer thing) stays as a power he uses about twice a game.
- **The new ultimate, Scramble Rush,** is used exactly once a game.

## 3. Scramble Rush
1. **A countdown banner** shows "1.00" with two decimals and ticks down slowly to "0.00" over 5 seconds. ("He moves super fast": the joke is that a second lasts five.)
2. **During those 5 seconds,** he moves 3 of your pieces and 3 of his to random empty squares on the middle ranks (3–6). Never move a king. Positions are restored afterwards anyway.
   - **The animation (Eric, Nov 6):** 5 copies of Dash run across the whole board in lines, each with a dash trail (speed lines or afterimages in his colors), and each copy makes several passes (rows and diagonals, crossing).
   - Pieces are scooped and dropped by stealth: no piece animation. A piece just disappears as a copy runs over its square, and appears on its new square as a copy passes there.
   - This part lasts 3–4 seconds, inside the 5-second "1.00 → 0.00" countdown.
   - The copies are the same sprite as Dash (his running frames if he has them; otherwise his figure with a lean), drawn over the board, using the board's own coordinates on phone and computer.
3. **He says** a line like "Hope I wasn't too quick for you." Then the God King, alive or not, says "Put the pieces back where they came from. Hurry!" (Use 2–3 variants for each.)
4. **A 10-second countdown** starts (the same banner style). Dash smacks his clock a few times, impatient.
5. **The player drags or taps the 6 moved pieces** to any square during the 10 seconds:
   - On the right square: a persistent green edge on that square until the ultimate ends.
   - On the wrong square: a red edge on that square.
     - 1 square away (king's distance 1): he says "Close, but not quite!"
     - 2 or more away: "Not even close."
   - A piece can be moved again until the time's up.
6. **When the time's up:** the board goes back exactly to its position before the ultimate, whatever happened, and play continues.
   - **Fail (Eric, Nov 6: "make it 4 pieces, that's easier"): fewer than 4 of the 6 pieces back on the right squares.** he plays an extra move right away and says something like "Guess I'll move again. Clearly you weren't paying attention." Put the success threshold in settings (`dashScramble.needCorrect: 4`) so it can be tuned.
   - **Success:** a short God King line ("Well remembered!") and play continues with your turn as normal.
7. **Server and fair play:** the real game state never changes during the mini-game. It's a visual overlay over a frozen position, then the restore. The only outcome is "boss gets an extra move or not". That must be decided where the boss's moves are decided today (client sim or server, whichever applies to boss games) and recorded in the move log. Don't let a client claim success without the placements being checked by the same code that checks moves.
8. **When he uses it:** once, at a moment chosen like his other ultimates (look at how the rage meter works). Not in the first 6 moves.

## 4. The blunder pounce (missing for Dash)
Eric: "when you blunder, all bosses are supposed to jump on the board and attack; he never had that built, it seems." Find how the other bosses do their blunder attack (grep for blunder, pounce or punish in the characters and components, for example Ginger or Big Boy). Build Dash's version the same way, through the same trigger and timing, in his style: a quick dash-in across the board with his trail, a swipe at the blundered piece, and a line. Add an e2e that forces a blunder against Dash and checks the attack plays. Check whether any other boss is missing it, and list them in the PR body (don't build those; just list them).

## 5. The rest
- Sounds: reuse the existing tick and smack. A soft "correct" blip and a "wrong" buzz from the existing sound kit.
- A Handbook entry under Dash: both powers, in 3–4 lines.
- Tests:
  - unit tests for the scramble picking (middle ranks, no kings, no overlaps), the scoring (green/red, 1-away), the restore and the fail-gives-extra-move rule;
  - e2e for Dash on phone and computer: force the ultimate with a test switch, place 4 correctly (success), 3 correctly (fail) and 0 correctly (fail, extra move), and check that the board is restored.
- GIFs for Eric before merging (untracked, under stills/): the countdown and scramble, the placement with green and red squares, and the fail line plus extra move.

## Rules
- Repo /home/user/chessroyale; worktree /home/user/cr-dash2 on branch claude/dash-v2 from origin/main.
- Follow notes/briefs/rules-common.md ("Keep it lean", "Local servers"). Commit identity and trailers as in brief-ledger-1.md.
- American English. Original lines only.
- PR via the GitHub MCP with the `full-e2e` label, then unsubscribe_pr_activity. Report the PR number, SHA, GIF paths and a 10-line summary.
- Don't touch the speech bubble design (another PR, claude/boss-bubbles, is unifying it). Merge origin/main in if it lands first.
