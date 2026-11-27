# The Stranger's elevator entrance + Big Boy's line after his throw (Eric, Nov 27 ~22:25 UTC). Opus, high. Boss lane

Read `notes/briefs/rules-common.md` first, then `docs/areas/battle-tower.md` (the elevator entrances: how a floor's boss walks out),
`docs/areas/bosses.md` (the Stranger; Big Boy) and `.claude/LESSONS.md`. Branch `claude/tower-entrances` from `origin/main`.
1. **The Stranger has no elevator walk-in on his tower floors (10, 30, 50).** Eric: "it just does a normal [start], so he needs to come out
   of the elevator still, and he should have a little special, like, 10-second thing where he walks out and the first thing he says is
   like 'you must be pretty strong to have gotten this far' or something. And then he says something cool, and then the fight starts.
   He doesn't need his full-screen thing; [it] should be some fire and ice, storm type of thing ... I guess he could draw his blades
   right when the fight starts."
   - Build his floor's entrance on the other bosses' elevator walk-in (reuse it; his own beats on top), about 10 s: the doors open, he
     walks out (his figure, his walk), a small fire-and-ice touch (e.g. embers on one side, frost on the other around him, or a brief
     swirl at his feet: use the new storm art's palette from `scripts/storm-art/` / the GBA sheets if a frame of it fits; NOT the
     full-screen storm), line 1 (Eric's idea, in his voice: a stranger from another world, unamused, hunting the strongest; e.g.
     "You climbed this far. You must be strong."), line 2 (something cool: write 3 options in the decision note and pick the best),
     then he draws his blades (his existing draw animation) as the fight starts. His lines in `characters/stranger-lines.ts` style
     (two rows at 320 px, under 48 characters, unique). Nothing on his Boss Battle (non-tower) start changes.
   - Phone and computer; skippable like the other entrances if they are.
2. **Big Boy's line during his block throw (floor 9 for Eric):** "when he throws his blocks onto the board, he says something, because he
   jumps down and throws a block, but then his chat box moves... wait to have him say something until after he throws it." His text box
   follows his figure as he jumps; give the block moment a `lineAt` (moments support it: see Stranger.tsx / Zebra.tsx) at the end of his
   toss (when his figure is back at rest: read the toss animation's length, not just BLOCK.landAt), so the box never moves while it shows.
   Check his other moments with a jump (the stack, the Big Bounce) the same way and fix any that do the same.
Tests: one focused check each in existing specs (his tower floor's entrance beats and lines; Big Boy's line only after the toss) and the
boss kit. Stills and a GIF of the Stranger's entrance for Eric (orphan `stills/tower-entrances`). `.pr-body.md` (at most 40 lines;
changed checks old → new), a short decision note, area pages, `.done`. Commits end only with your Claude-Session line.
