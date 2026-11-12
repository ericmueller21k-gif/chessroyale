# Hidden Boss: the child's room and the summoning, MOCKUP (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (a room's art and animation).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/town-square.md and docs/areas/bosses.md. On branch claude/director-notes read
notes/briefs/hidden-boss-house-NOTES.md: "Update 3" (the room), "Nov 12 (evening): the child in his room plays himself" and
"Nov 12 (night): Eric's big update" (the summoning) are the spec. The kid's drawings (age 9, idle) are on branch claude/hidden-boss-ages
(`packages/app/src/characters/recluse-ages.ts`): merge it into your branch. Town rooms today: `packages/app/src/town/shops/` (ShopRoom.tsx,
each home's `*-art.ts`); follow how they're built.

A MOCKUP for Eric: the room is not reachable from the town yet and nothing changes for players. Build it as a real room (so the build
reuses it), shown by a preview that is never reachable in production.

1. **The room** (top floor of an old Brooklyn walk-up, a 1950s child's room): a little rocking horse in the corner, a small table, a poster,
   a kid's mat, a small bed, a sunny window. Same pixel style and scale as the other rooms.
2. **The kid on the floor playing himself:** he plays a move, looks, leans over and plays the other side. The game is HIS real game from
   1956, the one he won at 13 (the famous one), stored as a fixed move list (no engine in the room). The board is small but the moves are
   real and readable. When it ends: a quick fade back to the start position, then it plays again (him putting the pieces back is an extra).
3. **The summoning, with four stand-in player pawns in the room:** a freeze frame (the four become still images); the floor board shoots light
   rays outward and upward; the four burst into particles all at once and are absorbed into the light; the light and particles draw back,
   fall and splash into the board; the board wobbles up and down, settles; quiet. Then a short transition to a match (your choice; simple).
Reuse existing effects first (CLAUDE.md: simple beats flashy, least lag on a phone).

Images for Eric (about 6): the room still on a phone and a computer; a GIF of the kid playing a few moves (and the reset); a GIF or MP4 of
the summoning per platform. Push them to branch stills/hidden-boss-room (never under docs/). Testing: typecheck and the unit tests you
touch; a test that the stored game is legal from start to end. No e2e. About 2 hours.
Branch claude/hidden-boss-room (from origin/main, with claude/hidden-boss-ages merged in). Push at each real step. Decision note
docs/decisions/2026-11-12-hidden-boss-room-mockup.md, at most 80 words. When done: push .pr-body.md (short), then .done last. Don't open a
PR. American English. Never include model names in commits.
