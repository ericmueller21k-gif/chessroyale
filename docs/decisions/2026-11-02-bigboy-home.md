# Big Boy's home, his challenge intro, and Timber's God King attack (Nov 2, 2026)

Eric's designs (the art's notes on `claude/boss-art`: `scripts/boss-art/out/shop-bigboy-nov2.md`, `intro-bigboy-nov2.md`,
`timber-king-attack-nov2.md`): Big Boy's crib "a ball-pit floor with stuffed animals, the shop and battle circle built over the pit and
joined by a walkway, a toy plane circling on a string as the showpiece"; his intro "6 toy blocks drop down and stack to form a 3,2,1
pyramid formation, and the board then plops on top. Then 2 more blocks drop for the chairs. The screen shroud effect when the fight
starts is a bunch of rainbow swirly lollipops"; Timber was "the only boss with no God King attack". How it works:
[town-square.md](../areas/town-square.md) ("Which homes", "Challenging a boss"), [bosses.md](../areas/bosses.md) (a boss's attack on a king).

The calls made:
- **His crib is a shop** as the other three are: Blocky the Shopkeeper behind the middle of the letter-block counter, "Big Boy's Boss
  Crate" (his Buggy first, the same price and odds), the chat's day tone, a nursery ceiling (the mockup's sky, clouds and stars).
- **His circle's start marks turned west and east** (drawn north and south before Eric's "boss on left, you on right"), a square and a
  half out where the layout stands you, the middle line north to south: in `circleMat` (his circle's tiles are drawn from it).
- **The airplane stands up whole** (`RoomArt.upright`): a deep piece (3 x 3 squares) that isn't a plan; drawn at its foot as any
  upright piece. Its squares and the pit are solid; you walk on the walkway, the platform and the circle.
- **His intro: across** (him left, you right), the same code as Alfil's with his pieces: the blocks are his table and its stools (their
  own picture, no park table), built from 0.4 s into the line; the line ends as the board drops (0.18 s from 2.5 squares up) and plops
  on; the stools drop in; the table alone 0.35 s; his attack from 2 s before the cover, beside the table; the swirl as the sandstorm.
  About 3.7 s from facing each other to the swirl. Sounds: his own toy sounds (clack, bonk, toss, poof, clack, swish).
- **The board rests on the top block:** the slab, laid at the art's height, reaches half a board toward you and hid the upper blocks;
  it's lifted until its front rests on the top block (`slabFrontY`).
- **His line** (placeholder until Gemini's, a baby's): "My blocks! My board! Big boy go first!"
- **Timber's attack: the art's kit** (40 a square, 1.15 off, facing left). His hammer is short: his paw on its handle comes within a
  fifth of a square of the king's middle (the others' bodies stay 0.35 off); kept, the art's numbers. Its cues' sounds are his own
  (the attack's own map: his kit's "whack" is the gnaw). Wood chips off the king's square each hit, drawn by code as the notes suggest
  (`chipHit`). No king-attack line yet (none written; he's silent as he lands). In `KING_ATTACKERS`: only the mate's hold reads it, so
  his Gnaw cap (two a battle) is untouched.
