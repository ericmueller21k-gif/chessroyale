# Big Boy: the toy-block tower (his blocks rework). god-king lane (boss powers) + characters (art). Opus, xhigh (boss rules solo and online)

Branch `claude/bigboy-tower` from main. About 2-2.5 h. Read CLAUDE.md, `.claude/agents/god-king.md`, `.claude/agents/characters.md`,
`.claude/LESSONS.md`, `docs/areas/bosses.md` (Big Boy row: toy blocks, Big Bounce), `docs/rules/eric.md`, the boss test kit, and his code
(`packages/chess/src/bosses/bigboy.ts`, his screen components and art). Art by the paid API runner (`claude/boss-art`,
`scripts/boss-art/run.ts`, Opus), never by hand; cap $15, estimate first, log costs.

**Eric, Nov 18 (voice, word for word where it decides):** "revamp some of the OG bosses ... a little bit more flair. So Big Boy, his block
move is going to be changed up ... he eats one of your pawns at the start ... when he throws his first block, that's still the same. You
can't go on that square. But then ... he starts stacking the blocks every turn. He stacks another block up to 10 and like makes a big stack.
Like it should look like a cool sort of like actual stack of like toy blocks, so they're not quite set evenly. As they get taller, they get
a bit more wobbly. ... his quotes kind of line up with whatever as it's getting bigger ... Once there's more than one block, you can
actually put a piece there to ... topple them. And what they do is they randomly will go into ... open squares around them ... it favors the
closer ones, but ... like a real tower falling, ... more closer, but some scattered further away. And ... all of those blocks function like
his one block things where you can't go there ... nobody can go on them. That's easier. And then, so they persist for his turn, and then for
your turn, and then they go away. And then, the moment they go away, though, he starts ... building another tower of blocks right away ...
once they hit 10, they start to ... wobble, and then they topple over wherever that lays. ... If they topple on his turn, then it goes on
your turn. If they topple on your turn, then they would disappear at the end of your turn or whatever."

**The rule (the director's reading; each number a setting in settings.ts; record each call in a decision file):**
1. Unchanged: his snack (a d/e pawn) and his first block on a crowd-half square a crowd piece could move to (his current pick). The
   Big Bounce ult unchanged.
2. **The tower:** each of his turns after the first block, one more block on the same square, up to `towerMax` 10. Height 1: nobody may
   move onto it or slide through it (today's block). Height ≥ 2: still nobody slides through, but **a crowd piece may move onto it**
   (a legal move to that square) and **topples it** (only the crowd topples it; his pieces never enter it).
3. **At 10:** it wobbles (one beat) and topples on his turn by itself.
4. **The topple:** its height in blocks scatter to **empty** squares: nearest first, weighted toward close (e.g. weight 1/d²) with some
   further out, seeded (same in solo and online), never onto a piece, never off the board; fewer if not enough empty squares. Each scattered
   block is a height-1 block: nobody may move onto it or slide through it (knights jump it, as now; it never stops an attack).
5. **How long they last (the director's reading of Eric's two versions):** scattered blocks always last through **one crowd turn**: toppled
   by the crowd's move → they stand through his next turn and the crowd's next turn, then vanish; toppled by itself on his turn → they stand
   through the crowd's next turn, then vanish. The moment they vanish he starts a new tower (its first block placed as today's).
6. **Always leave the crowd a legal move**, never block a check's only answer (as today's block does): scatter squares that would leave the
   crowd without a legal move are skipped.
7. **Lines** (placeholders for Eric, in his voice, `kit.lines`): as the tower grows (a few heights: 3, 6, 9), at the wobble, at a crowd
   topple, at his own topple.
**Screen:** a stack of toy blocks drawn by the API runner, each block a little off-center, the sway growing with height (a gentle idle
wobble that grows; a bigger wobble before 10); the topple: blocks tumbling out to their squares (nearest first, short arcs, a bounce); the
scattered single blocks look like his current block. Phone and computer; light on a phone (one canvas or cached frames; `@perf` if the
board's drawing changes). Shows on the board square; never covers the clock or move list.
**Online:** the server's lobby applies the same rules (the shared rule code in packages/chess); a reconnect shows the tower's height and
scattered blocks; protocol fields optional.
**Tests:** rules (stacking, the ≥2 entry, topple scatter seeded and only empty squares, the 10 auto-topple, lifetimes in both cases, new
tower right after, never no legal move), the server lobby (same results online, reconnect), the boss kit, e2e `bigboy` spec (the tower grows,
a topple, scattered blocks block then vanish), a test switch `?boss=bigboy&power=tower` (a tall tower early). **Strength:** one sim run at
one setting (his boss-sim) against today's numbers; if he's clearly stronger/weaker, say so and propose the offset (the engine lane tunes).
Boss lane, plus the review pass the director runs.

Done: `.pr-body.md` (under 60 lines; player-visible; changed checks old → new; art $; sim result) and `.done`, end. Eric-only questions:
`.question`, end. No PRs, no CI waits.

**Eric's answers (Nov 18, ~01:10 UTC), sent to the helper:** 1) the lifetime reading is right; 2) "both but he usually doesn't": his pieces
may topple a tower of height >= 2 too, rarely chosen.
