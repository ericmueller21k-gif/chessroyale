# Birdie's move whistles, as the game makes them (Nov 23)

Eric: "I was thinking more whistles than the other stuff. Or we want a couple different whistles. And like the double whistle, you know how the trains go like toot toot?"

`birdie-whistles/birdie-whistle-sheet.mp3` is what the game itself makes (rendered from `packages/app/src/characters/birdie-sounds.ts`
on `claude/birdie-whistles`, at the game's own level, so it's quiet: turn it up). It plays:

1. The five whistles, in this order: **toot-toot** (the double toot), **toot**, **long**, **toot-long**, **peep-peep**.
2. Then one move of each kind, as his move picks them:
   - a knight's move g8f6 (two squares): the double toot (most of his moves);
   - a one-square move e7e6: one toot;
   - a move right across the board a8a3 (five squares): the long blast;
   - a capture or a check: a toot, then a long one;
   - now and then (about one move in five, picked from the move so every device hears the same): the peep-peep.

No puffing under them. Each whistle is also on its own in `birdie-whistles/`.
