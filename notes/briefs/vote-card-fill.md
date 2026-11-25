# 50 v 50 opening vote: the cards fill upward with votes (Eric, Nov 26). Opus medium, light lane, branch `claude/vote-card-fill`

Eric, on the computer's opening vote (still: stills/crowd-frame/round-2/crowd-1536x730-opening-vote.png): "the boxes on the right the 3 for
the augments, what if they stayed that long height but instead of a left to right meter they start from the bottom and 'fill' upward the
container as votes come in".

Do:
1. MOCKUP FIRST: inject CSS over the live 50 v 50 opening vote (as `notes/tools/mock-crowd-50.spec.ts` does on director-notes) at
   1536x730 and 1920x960, with a few votes in (e.g. 4 / 2 / 6). Each card keeps its full height (the 250 px slot); the left-to-right bar
   is gone; a fill rises from the card's bottom to (votes / the most-voted card's votes, or / total votes: pick the one that reads best and
   say why) of its height, in the bar's color, light enough that the name and blurb stay readable over it (check light and dark mode);
   the count stays at the card's foot. Push the stills to `stills/vote-card-fill/mock/` and WRITE `.mock-ready` (empty) on the branch,
   push, then build without waiting.
2. Build it in `Vote.tsx` / its CSS: one fill element per card, its height a CSS variable; the change animates with a CSS transition on
   `transform: scaleY()` (no layout per frame, no JS loop); reduced motion: no transition. Nothing else moves: the cards' boxes keep their
   size and place in every phase. If the phone's vote shows the same cards, give it the same fill (same component); if its cards are a
   different shape, leave the phone as is and say so.
3. Also fix (same screen): the on-board pill "Drag your pawn into a zone to vote" covers the middle zone's label ("Majority") at
   1536x730 and 1920x960. Place it where it covers no zone label (e.g. under the zones), on phone and computer.
4. One focused check in an existing spec (`opening-vote.spec.ts` or `vote-hint.spec.ts`): the fill's height follows the votes; the
   pill doesn't overlap any zone label. Typecheck; run those specs on both projects.
5. `.pr-body.md` (short: what changed, player-visible, checks changed old → new), a five-line decision note, `docs/areas/crowd.md` line.
   Stills of the build at 1536x730, 1920x960 and the phone 390x844 on `stills/vote-card-fill/`. COMMIT and push `.pr-body.md` and an
   empty `.done`, then stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). American English.
Wait with one foreground `timeout 590 bash -c 'until ...; do sleep 30; done'`, never Monitor.
