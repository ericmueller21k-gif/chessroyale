# Bug: a boss's speech bubble grows and slides off the screen on a computer (Eric, Nov 15)

Effort high (layout plus timing, cause unknown). Lane: god-king (the boss battle's presentation). Targeted lane. Branch
`claude/boss-bubble-offscreen` from main. Read `docs/areas/bosses.md` ("What a boss says", the computer's figure beside the board),
`.claude/LESSONS.md`, CLAUDE.md "Nothing hidden, nothing shifts" and "Simple beats flashy".

## What Eric saw
His words: "I've noticed his chat boxes enlarge and move off screen after he says stuff, almost like his sprite is repositioning so
it's also repositioning the chat boxes, they are fine for a moment, then they aren't."
His screenshot: branch `stills/boss-bubble-offscreen`, `eric-nov15-desktop.png` (`git fetch origin stills/boss-bubble-offscreen`).
A computer (window about 1611 x 843 px), the boss battle against Don Dough (LVL 47, move 24), the left menu rail, the board
centered, the Moves panel on the right, his pawn (parrot, crown) at the bottom right. Don Dough's figure stands left of the board,
and his bubble ("I've seen this ...") sits above his head, but it is shifted left: its left part is cut off under or past the left
menu rail, so the line can't be read. Eric says it's right at first, then grows and moves.

## The job
1. Reproduce it on a computer-sized page (try his size, and 1280 x 800, 1440 x 900, 1920 x 1080), with lines of several lengths,
   over the line's whole life (typing, held, fading) and as the figure animates or the layout changes mid-line (a move, the Moves
   panel growing, a reaction). Find what moves or widens the box after it first shows: the figure re-placing itself, the box's
   width being measured again as it types, an anchor on the figure's changing frame box, or something else.
2. Fix the cause (not a clamp added on top, unless the clamp is the right design: say why). The rule: the box keeps its size and
   place for the line's whole life (Eric's "nothing shifts"), and is never cut off by the screen's edge or the left menu rail;
   a long line wraps inside the room it has.
3. Check the other bosses on a computer too (every boss's figure beside the board) and the phone's bar bubble stays as it is.
4. One focused check added to an existing spec (`e2e/boss-bar.spec.ts` or the computer's boss spec): the box's rectangle at its
   first frame and later in its life is the same and is fully on screen, right of the menu rail. It must fail on the old code:
   check that it does.
5. Docs: the area page's speech section if behavior changes; a decision note of about five lines.
Prove it with the typecheck, the app's unit tests you touch and the spec you changed. One still per size for Eric (before and
after at his size). `.pr-body.md` (what changed, player-visible, checks old -> new), `.done`. No PRs, no CI waits, no model names in
commits (end commits with the Claude-Session line only). Push work in progress at each real step.
