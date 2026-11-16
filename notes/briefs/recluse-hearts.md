# The Hidden Boss, final changes: phase 2's hearts, the Bullet's +10, two lines and the "+N" layer (Eric, Nov 16). Opus, xhigh, alone

Effort xhigh (his rules in both phases, the server's clocks, online sync: a bug here breaks his fight). `god-king` delegate. Boss lane
(targeted + the boss kit + one quick review). New branch `claude/recluse-hearts` from main. Never write the Hidden Boss's name in player
text, commits or PRs (code names like `recluse` are fine). Include `notes/briefs/rules-common.md`. Read `.claude/LESSONS.md`, CLAUDE.md,
`docs/areas/bosses.md` (his Bullet, phase 2, "His phase 2 ultimate", his chatter, `SlowMarks`), `docs/rules/eric.md`. Eric's
screenshot: `notes/briefs/assets/recluse-bullet-plus-clip.jpg` (the "+2" over the clock cut off by the panel; his line "This is a
lottery, not chess. Time per move, then. My own…").

## Eric's words (Nov 16, after playtesting; condensed, order his)
1. "When you defeat his second form of the three, there's a quick quote that comes up still ... something about the book, ... for a
   split second, when he's still in the boss bar ... before he appears in the middle of the board with his child self. ... get rid of
   that line."
2. Phase 2's slow moves: "if time drops to 0 ... the time just keeps resetting back to 5 seconds after 0 ... it's a shared pool of
   missed moves. I think everyone actually needs their own." The new design (below).
3. "When it says plus 10 on the clock ... we just need to have it layered properly so that plus 10 is actually layered above
   everything else." (every mode with an increment, not only his.)
4. "Look at his quote. It just says time per move. Make it say something that makes more sense ... instead of 2 seconds, it should go
   up to 10 seconds per move. ... we're essentially nerfing him ... because he's too powerful right now."

## Do
1. **Remove that line**: the book line that flashes in his boss bar after phase 1 is beaten, before the cutscene with his child
   self. Find which line (his fall / phase change's lines) and take it out; nothing else in the sequence moves.
2. **Phase 2: hearts, each player's own** (replaces the team's slow-move count and his "5 SECONDS!" phase 2 ultimate, and the
   random move on time; remove what they leave dead):
   - **Every player's clock is 10 minutes** (`bankSeconds` 600), no increment.
   - **A move is slow past 5 s** (shown as 5 s), judged by the server with a hidden allowance for lag (about 6.5 s from when the
     board was that player's: say the number; never shown or written in player text).
   - **Each player has 8 hearts** (Eric: "Let's just call it 8 ... you can line up one like the same size": a column of 8, each one
     square tall, at the right of each board: the big board's at its right, each small board's at its right at its own square size).
     Classic HP-style pixel hearts.
   - **A slow move costs one heart of that player's:** he slashes it: a slash with a wind-up (slow) then a fast follow-through
     across the heart, the heart cut in half, both halves sliding apart and fading; a slash sound. **No screen flash** (Eric:
     photosensitivity). After the slash **you may take as long as you need on that move** (no forced or random move); your clock
     keeps running.
   - **His line on every slow move, on that player's screen only, interrupting whatever he's saying:** about 10 lines, escalating
     with hearts left (8-4: taunts like "Too slow." / "Faster, or lose." / "Not so easy without your engine?"; 3-2: harder; the
     last heart: the hardest). American English, short, in his voice; placeholders marked for Eric.
   - **Out of hearts: that player's board is lost**: it greys out (a "wasted" style fade to grey, slow) with a clean word over it:
     "TOO SLOW" (or a better two words; note it for Eric). The other boards play on; the battle's outcome as today (all four won to
     win).
   - Out of time (the 10 minutes) still loses that board as today.
   - Bots: their slow moves cost their hearts too (`botSlowChance` tuned so a bot loses a few, not all).
   - Online and solo the same (the server decides; the boss kit's parity test).
   - **Note for Eric** in the PR: he also said "after 10 misses, then you lose": built with 8 (his "Let's just call it 8" and the
     8-square column); one number in settings if he wants 10.
3. **The "+N" over a clock above everything**, in every mode with an increment (his "+10", Bullet, any `+N`): its own layer over the
   dock, the panels and the boards; never clipped. One CSS/stacking fix in the shared place.
4. **The Bullet's increment 2 → 10 s** (`bulletIncrementSeconds`), the dock "Bullet 1+10", the "+10 s a move" across the board, and
   **his line when he adds it** rewritten to make sense in one bubble (today's "This is a lottery, not chess. Time per move, then. My
   own…" is cut off and unclear). E.g. "This is a lottery, not chess. Fine: ten seconds a move." Fit it in his bubble on a phone.

## Tests and deliver
His rule tests (hearts per player, the hidden allowance, no forced move after a slash, 8 slashes lose the board, the bot's hearts,
the +10), the lobby/parity tests, `e2e/recluse.spec.ts` updated (the slow marks → hearts; the "5 SECONDS" ult gone), a focused check
that "+N" is on top (an element-at-point check over the clock), `@perf` (the slash animation), frames with real taps
(`frames-recluse2`). Changed checks old -> new in `.pr-body.md`; guards in `docs/rules/eric.md`: if one changes, stop and write
`.question`. Update bosses.md and a short decision note. Stills: one per platform plus a GIF of a slash. Push to `stills/recluse-hearts`
(never images under docs/). `.done`. No PRs, no CI waits, no model names in commits. Push work in progress at each real step.
