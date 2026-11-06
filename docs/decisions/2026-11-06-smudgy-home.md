# Smudgy's studio, his intro and the splatter (Nov 6, 2026)

Eric, Nov 6: "Build the chameleon guy from start to finish … no need to ask me anything. I want to get it done before the usage turns
over in 3 hours." One helper, start to finish, no review stops (as Folio's, `2026-11-05-folio-home.md`). Smudgy is live, so this goes
to everyone.

## Eric's words
- The room: "A paint studio, tarps or canvases, a lot of different colors … darker teal, blue, darker reds, purples … as opposed to a
  very bright clownish feel … every wall is just splattered with canvas … a lot of layers of paint … kind of abstract."
- "Some sculptures of chess pieces … reuse … the pixelated ones that are the default now in the Colosseum … place those around."
- "An art studio going on … a knight standing on a rotating platform, and around it 8 [chameleons] sitting on stools … painting the
  horse … every few seconds it updates the horse drawing a little bit … they all do the same drawing but start at different times …
  a little paint thing next to them … a little animation for them to dip their paintbrush."
- The intro: "He starts out, he pulls the white tablecloth off … to reveal the board. And the stools can just already be there. It
  doesn't need to be fancy."
- Into the match: "a bunch of paint splatters that start filling the screen until once it gets full, and then they wipe away. And
  then the game starts."

## The director's calls (the brief)
- The palette moody and deep; walls hung with layered, abstract drip-painting canvases (no real artist named or copied).
- The Colosseum's pixel pieces as sculptures; the knight on a turning platform; 8 painters, a new small chameleon in smocks, color
  variants, the kids' size; canvases building up blank, outline, blocked colors, finished; a dip every few seconds.
- The battle spot: a round table under a big white drop cloth, blotched with paint, a board-shaped bump under it, stools already there.
- The shopkeeper: an older chameleon gallery owner in a smock and little glasses, behind a low counter with a blank plaque; its card
  "Shopkeeper", no name; not a town bot. His Boss Crate a paint-splattered wooden crate, his ride (the Brush Ride) first.
- The reveal line: "Careful, don't get any paint on the pieces!"
- The splatter about 1.2 s to cover, a brush-stroke wipe about 0.5 s; every beat a number; never stuck, never blocking the match.

## Calls made here
- **Drawn by hand in code, in the game's tree** (`shops/smudgy-art.ts`, `shops/smudgy-intro-art.ts`, `shops/paint-kit.ts`), not copied
  in from the art branch as Folio's was: there was no art session for it. A copy of the art files and its preview stills is on
  `claude/boss-art` under `scripts/boss-art/out/house-shop-smudgy/` and `house-intro-smudgy/`, for the record.
- **The painters and the gallery owner are Dabble's rig** (sidekicks/smudgy.ts, its poses exported, nothing in Dabble changed): the
  painters recolored (green, teal, ochre, plum) in cream or colored smocks, sitting; the owner gray-green with an oxblood smock and gold
  half-moon glasses, Dabble's idle, walk, sit and wave. Reusing the rig kept them the kids' size and the family's look.
- **Shared frames:** one 32-frame loop (250 ms a frame, 8 s) per color, four pieces for all eight painters; each placement is
  `t0` into the loop (an eighth apart), a new optional `ShopPlace.t0` the room adds to its clock. Each stage of the canvas lasts 2 s
  (5 frames painting, 3 dipping): "every few seconds".
- **The knight** is the Colosseum's 3D knight model (`colosseum/pieces-gba.ts`) turned about its axis and drawn at 2x (16 frames, 6 s a
  turn); the sculptures (rook, queen, bishop, pawn, king) its models at 1x on plinths.
- **Seated, no hop:** the stools are there from the start, so you both walk straight to your marks beside them (`seated`, as Hollow's).
  His marks (7, 14) and yours (12, 14), 2.5 squares from the table's middle; his clear place is the usual 2.6, a tenth of a square
  outside his mark (the stool-clearance check holds for him).
- **He whips the cloth with a flourish, not a reach:** standing clear of his stool (as every boss must), he doesn't touch the table; the
  cloth leaps up off it, sails west over his head and drops in a heap by his stool. He stands in his idle (it holds his brush up). No
  God King attack in his intro: the splatter is his transition (as Folio's crumple is its).
- **His line** is his battle entrance's first ("Smudgy, artist. Don't touch the wet parts."); the reveal line in his chant bubble once
  the cloth is down, every time.
- **The splatter** is a plain 2D canvas (no WebGL): splats drawn once each onto a canvas never cleared, so it costs a few arcs a
  frame; once covered the gaps under the splats are filled; the stroke wipes left to right with a band of fresh ochre paint at its
  edge. The cover, the hold and the wipe each go by `setTimeout`, so a hidden tab or a lost canvas still reaches the match.
- **Sounds:** four new synthesized ones in his pack (`smudgyWhoosh` the cloth, `smudgyFlop` its heap, `smudgySplat` for the first six
  splats, not every one, `smudgySwipe` the stroke).
- **The room's ceiling:** dark beams over a skylight's pale glow (`roof: "studio"`); the chat's night tone (a dark room).

## Numbers
`CHALLENGE_FEEL.smudgy`: line 2.5 s, grab 0.3 s, the whip 0.75 s (its frames), the reveal's lead 0.25 s, the reveal 2.4 s, a beat
0.3 s; the splatter: cover 1.2 s (gaps from 150 ms down to 12 ms, two splats at a time), hold at least 0.25 s, wipe 0.5 s.
`PAINTER_LOOP` (32 x 250 ms), `KNIGHT_TURN` (16 x 375 ms) in `shops/smudgy-art.ts`.
