# Hidden Boss room mockup, round 2 (Nov 13)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (a room's art and animation).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/town-square.md. Round 1 is on branch claude/hidden-boss-room (its .pr-body.md says what's
built: `town/shops/recluse-art.ts`, `recluse-scene.ts`, `recluse-game.ts`, the preview `/hidden-room-preview.html`); its images are on
branch stills/hidden-boss-room. Spec background: notes/briefs/hidden-boss-house-NOTES.md on branch claude/director-notes. Eric's
screenshot of the problem: notes/mockups/2026-11-13-eric-room-arm.png on that branch (the kid's arm stretched across the whole board).
Work on claude/hidden-boss-room itself (continue it).

Eric (Nov 13), in his words: "That's not realistic... the chessboard should honestly be smaller... he'll have to literally like lean onto
the board and move a piece. And then he like gets up and walks to the other side and places it. Like it would take him realistically like a
while to play out the game. Cause that's the point... It's okay if his arm stretches a little bit, but not like this amount... shrink the
room to actually feel snug... about half the square footage... The bed might almost be a little bit on the rug... the light is perfect, by
the way... It might be almost shining on the rug a little bit more."

1. **The board smaller** (still readable as real chess; small is fine).
2. **How he plays:** on his side, he leans onto the board and moves a piece (a little arm stretch at most). For the other side's move he
   gets up, walks around to the other side, sits or kneels, plays, and comes back. Slow and real: the whole game taking a long while is the
   point. Keep the 41-move game and the reset.
3. **The room about half the floor area:** snug. Bring everything in: the rug, the bed almost touching the rug, the rocking horse, the table,
   the window. Keep the window's light exactly as it looks; let it fall more onto the rug.
4. **Eric's question about the side walls** ("is there a way to make the left and right walls not just like straight pieces of paper that
   look stacked... one long thing that actually makes it look like a 3D room? What would that look like?"): in THIS room only, try each side
   wall as one continuous surface receding to the back wall (the wallpaper, the baseboard and the top edge running in one unbroken line in
   perspective), if the room renderer can do it simply. Show it next to round 1's look (a before/after still) so Eric can choose. Don't
   change any other room. If it can't be done simply, say what it would take.

Images for Eric (about 6), replacing round 1's on branch stills/hidden-boss-room: the room on a phone and a computer; the walls
before/after; a GIF of him playing a move on his side and walking round to play the other (sped up is fine; say how fast real time is).
Testing: typecheck and `packages/app/test/recluse-room.test.ts`. About 1.5 to 2 hours. Push at each real step. Update .pr-body.md and the
decision note (at most 80 words); remove the old .done first and push a new .done last. Don't open a PR. American English. Never include
model names in commits.
