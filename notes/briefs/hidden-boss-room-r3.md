# Hidden Boss room mockup, round 3 (Nov 13)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (animation and art).
Read CLAUDE.md and .claude/LESSONS.md. Continue branch claude/hidden-boss-room (its .pr-body.md says what's built; rounds 1-2 and the
new summoning light are on it; images on branch stills/hidden-boss-room). Leave the summoning's light section of `recluse-scene.ts` alone.

Eric (Nov 13): "I think the board should be left and right so you can see him walk on left and right and still see the board when he
plays, and he should be centered on each side when he plays moves, have him lean in more over the board so the arm stretch isn't as obvious."

1. **Turn the board sideways:** White's side on one hand (left or right), Black's on the other, so from the camera we see the board's
   whole face between them. The pieces still read as real chess and the game stays his 41-move 1956 game (the test that it's legal and that
   the room's board matches the rules' must keep passing).
2. **He sits centered on each side** when he plays: centered on Black's side for Black's moves, then he gets up, walks round (left or
   right, in view) to sit centered on White's side for White's moves, and back. Never between the camera and the board.
3. **He leans in over the board** to move a piece, enough that his reach is short and the arm stretch isn't obvious, for every square,
   the far files included. Draw the poses this needs (sitting, leaning in, from the side), in the age-9 style of `recluse-ages.ts`.
4. Keep everything else: the room, its light, the walls, the pace (about 14 minutes a game), the reset, the summoning.
Quality bar: watch his reach to the farthest squares frame by frame (CLAUDE.md, "watch it frame by frame"); his arm never longer than
about half again its rest length.

Images for Eric (about 4), replacing the matching ones on stills/hidden-boss-room: the room on a phone and a computer; a GIF of a move on
each side with the walk between (sped up is fine; say how fast); a still of his longest reach. Testing: typecheck and
`packages/app/test/recluse-room.test.ts`. About 1.5 hours. Push at each real step. Update .pr-body.md and add a decision note of at most 60
words; remove the old .done first and push a new .done last. Don't open a PR. American English. Never include model names in commits.
