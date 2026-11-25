# 50 v 50: the vote results box as a standing skeleton that fills in (Nov 25). Opus medium, crowd lane, light/targeted (UI)

Eric (Nov 25): "for the 50v50, we have to show all the different moves that are made. And we just have to leave that gap empty ... why don't we
just cap that, make it an actual container that's like a hollowed out, gray, white style container ... it sits there. And then when moves are
made for that round, instead of that whole container now appearing, it just fills in the empty container ... whatever you have it coded now is fine
as the maximum ... a skeleton container that looks gray, like ... loading containers already function in apps, where they ... sit there grayed out
waiting to be filled ... do that also on mobile and desktop. They'll sit a little differently ... much nicer ... as opposed to making this thing
constantly appear and reappear."

Code: `packages/app/src/screens/Crowd.tsx` (`poll`: the `.poll` box, its `poll-row`s, capped by `slots`, yours and the brilliant find kept), its
CSS (`styles.css` `.poll*`; computer: `board-size.css` `--crowd-slot` 206 px, the fixed slot). Today the slot sits empty until the results
come, then the box appears.
- The box is always there in its slot, at its full height (the cap's rows: `slots`, as now), on phone and computer, in the 50 v 50 (and
  Squads/Classic if they share it: say which).
- Empty rows are skeleton rows: a soft gray rounded bar where the move name goes and a gray track where the bar goes (the app's loading
  look: reuse an existing skeleton style if there is one, e.g. the ladder's loading rows), light and dark. No shimmer if it costs frames;
  a gentle one only if it's free.
- When a round's results land, its rows fill the skeleton rows top down (move name and bar counting up as now); fewer moves than the cap: the
  remaining rows stay skeleton. Between rounds, back to all skeleton (no box vanishing). The result line under the bars keeps its own fixed
  line (skeleton too when empty). Nothing shifts (Eric's rule): measure the box's height and the board's position with and without results.
- Tests: one focused check in `e2e/crowd.spec.ts` (the box present before any result with `slots` skeleton rows; same height after results).
  Stills: phone 390×844, laptop 1536×730, desktop 1920×960, each before results and with results, labeled; the director reviews them.
- Short decision note, `docs/areas/crowd.md`. `.pr-body.md`, `.done` on `claude/crowd-poll-skeleton`, push, stop. Commits end with only
  `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort medium. About an hour.
