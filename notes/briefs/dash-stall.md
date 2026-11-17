# Dash: the slow-move taunt, the fake second move and the lying-down clock tap. god-king lane (boss powers). Opus, xhigh (boss rules, solo and online)

Branch `claude/dash-stall` from main. About 2 h. Read CLAUDE.md, `.claude/agents/god-king.md`, `.claude/LESSONS.md`, `docs/areas/bosses.md`
(Dash: Clock Slap, Time Scramble, his kit and lines), `docs/rules/eric.md`, and the boss test kit.

**Eric, Nov 17:** "once a game if you take more than 30 seconds to move, it doesn't let you move, then he moves again, and says something
about how slow you are and he can't wait, then he's like nahh jk bro and he moves his piece back and your turn continues, so a fake 2nd
move, something he'd do. first tho at 20 seconds he smacks the shit out of the clock for 5 seconds straight and says hurry up or
something ... pick something better. then at 30 s is when he fake plays, this only fire at once 1 time per game with him."

**The rule (once a battle, both beats together):**
1. **20 s into your move** (the crowd's turn, measured from when the board was yours): he **slams the clock for 5 s straight** (his
   clock-smack animation looped hard, the clock's sound each hit, a shake) and says a hurry-up line in his voice (write 3 options;
   better than "tick tock let's go": he's a fast-talking cheetah who hates waiting).
2. **At 30 s, if you still haven't moved:** your move is held (the board takes no move for a moment), **he plays a second move** (a real
   legal move of his, drawn and animated as a normal move) with a line about how slow you are and how he can't wait, a beat, then
   **"Nahh, jk bro"**-style line (his voice) and **the move slides back**; your turn continues with the time you had (the clock
   doesn't charge you for his skit; say how). Nothing about the position or the clocks changes in the end.
3. Once per battle. If you move before 20 s, or between 20 and 30 s, the beats you haven't reached don't come (it stays armed for a
   later move? the director's call: **yes**, it stays armed until it has fired once). Never during another of his powers, a cutscene or
   his Last Stand. If your turn can't last 30 s (the crowd's move clock is shorter), it never fires on that move.
4. Solo and online the same (the server times it online; the crowd's picks during the hold: say what happens; nobody's pick is lost).
**Checks:** the boss kit and parity tests; a chess test of the rule (fires once at 20/30 s, not before, never twice, the position and
clocks unchanged after); `e2e/boss-smoke.spec.ts` stays green; one e2e check of the skit (a test switch to fire it early is fine:
TEST_SWITCHES only). One GIF of the skit (phone) on a `stills/dash-stall` branch. `.pr-body.md` (short: rule, lines, changed checks old →
new) and `.done`. Lines are placeholders for Eric. Commits end with the `Claude-Session:` line only, no model names. No PR.

## Added (Eric, Nov 17): the lying-down clock tap, once a battle
"one more goofy animation, once per game he goes down laying down with his chess clock by your clock, like this one in pic, he sets or
holds his clock next to it and starts tapping it for a few seconds" (his screenshot: the under-board time pill, "5:32", at the board's
bottom right).
- Once a battle, on one of your moves (a seeded random move, never the stall skit's, never during another power, a cutscene or his
  Last Stand): Dash **lies down on his side right beside your clock** (the time pill under the board: phone and computer, wherever it
  sits), his chess clock set next to it or held up against it, and **taps it for a few seconds** (about 3 s, the click sound each tap,
  a bored grin), then hops up and goes back to his spot. It covers nothing you need: never over the board's squares or the pill's
  digits; your clock keeps running as normal.
- **The new poses are drawn by the paid API** (the art runner on `claude/boss-art`, Opus, its default; `notes/RULES.md`: never by
  hand): a lying-down pose with the clock and a tap loop, from his finished art (`characters/boss-blitz.ts`). Cap $6; say the estimate
  first. Then wire it like his other moments.
- Same checks as above, plus one GIF of this gag (phone and computer).

## Added (Eric, Nov 17): group battles too
"yes it should be in groups too, what can we do to make it happen". A group battle's move clock is 20 s (`moveClockSeconds`), so 30 s
never comes. **The director's call:** in a battle with a per-move clock, the beats come at fractions of that move's clock: the slam at
**50%** (10 s of 20), the fake move at **75%** (15 s), and **the move clock pauses for both skits** (the team loses no picking time;
picks already in stay; a pick can't be made during the fake move's hold, then the clock resumes). Solo (a bank clock with no short
move clock) keeps 20 s and 30 s. Both as settings (`DASH_STALL`: seconds for solo, fractions for a move clock), once a battle either
way. Online: the server times it and pauses the clock; the parity test covers solo vs online.
