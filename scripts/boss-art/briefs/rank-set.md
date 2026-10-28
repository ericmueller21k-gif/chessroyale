# Ranked emblems: the whole ladder in one drawing

Draw **every ranked tier's emblem** in one drawing (id `rank-set`), so the set is one artist's and reads as one family.
Each emblem is its own animation in the one character:
- the seven tiers with divisions, four stills each (one frame of 1000 ms): `wood-d4`…`wood-d1`, `silver-d4`…`silver-d1`, `gold-d4`…`gold-d1`, `paragon-d4`…`paragon-d1`, `illustrious-d4`…`illustrious-d1`, `sublime-d4`…`sublime-d1`, `radiant-d4`…`radiant-d1`;
- the two top tiers, each a short looping idle (a few frames, about 2 s, the emblem still while its light moves):
  `pearlescent` and `transcendent`.

Eric has seen three samples (`scripts/boss-art/out/rank-wood`, `rank-sublime`, `rank-top-transcendent`) and likes them:
read those drawings first and keep their approach (the gem-cut badge, the piece in front, the division steps), now with
four divisions, made consistent across every tier.

## The set it belongs to (every tier's emblem follows this, so the nine read as one family)
- HunChess is a chess game; its ranked 1 v 1 ladder climbs, in order: Wood, Silver, Gold, Paragon, Illustrious, Sublime,
  Radiant (each with divisions 4, 3, 2, 1; 4 the lowest), then Pearlescent (the top 500) and Transcendent (the top 100). Each tier's
  emblem has **a chess piece at its heart**, climbing with the ladder: pawn (Wood, Silver), knight (Gold), bishop
  (Paragon), rook (Illustrious), queen (Sublime, Radiant), king (Pearlescent, Transcendent).
- **The emblem:** the piece standing in front of a faceted, gem-cut badge (an octagon, like a cut stone seen from the
  front), in the tier's material, with a thin dark outline (the palette's `k`). Semi chess piece, semi custom crest: our
  own design, never a copy of any other game's rank emblems.
- **Size:** a 48 x 48 frame, the emblem centered and filling about 40 x 40 of it. It's shown as small as 24 px (on a name
  tag in the town, beside a name in a list) and up to 96 px (a profile, a result card), so it must read at 24 px: a clear
  silhouette, the piece's shape plain, the tier's color unmistakable. True pixel art, whole pixels, light from the top left.
- **Divisions** (4 the plainest, 1 the grandest; the same steps in every tier): **4** the badge and the piece alone; **3**
  adds four small studs or gems round the badge's edge; **2** adds a pair of small leaves or wings at its sides; **1** adds a
  crest at the top, a bright glint on the piece and a thin glow round the badge. Same badge, same piece, same colors: a player should see their
  division at a glance, and every division of a tier should be plainly that tier.


## The tiers

| Tier | Its piece | Its colors |
| --- | --- | --- |
| Wood | a carved wooden **pawn** | warm honey and walnut browns, visible wood grain, a little rough, like a well-loved wooden chess set |
| Silver | a polished silver **pawn** | cool silver and pale grey, crisp white highlights, a hint of blue in the shadows |
| Gold | a gold **knight** | rich yellow gold, deep amber shadows, bright pale-gold highlights |
| Paragon | a **bishop** carved from jade | jade green, set in gold |
| Illustrious | a **rook** of sapphire | deep sapphire blue, set in silver-white metal |
| Sublime | a **queen** of amethyst | amethyst purple, set in gold |
| Radiant | a **queen** of ruby with a sunburst behind her | ruby red and warm orange light, gold rays |
| Pearlescent (the top 500) | a **king** of pearl | pearl white with **the prismatic sheen of a 3-star piece in Auto chess** (its outline's gradient, `components/AcStarArt.tsx`: teal `#22bfa9`, cyan `#1fb6cf`, sky `#2fa3e6`, blue `#5b84f0`, violet `#8d68e6`, magenta `#d25ccb`, coral `#ff6f73`, orange `#ff9a5c`) running across it and round its rim, shifting slowly in its idle (Eric: Pearlescent matches the pearlescent 3-star piece) |
| Transcendent (the top 100) | a **king** of starlight with a halo | deep cosmic violet and indigo, tiny stars, a glowing white-gold halo (stars twinkle and the halo glows softly) |

- The two top tiers have no divisions: draw each at the grandest level of the steps above, and then a little more.
  Transcendent is the rarest emblem in the game and should feel beyond the others, yet plainly part of the set.
- **Every tier its own color scheme (Eric):** no two tiers share a main color; Pearlescent's prismatic sheen is its alone.
- **One family:** the same badge shape, outline weight, lighting and division steps in every tier; each tier's color and
  piece unmistakable; the ladder's climb visible at a glance (Wood humble, Radiant shining, the top two beyond).

## Quality bar
Look at every emblem at 4x and at 1x (24 to 48 px) before calling done; compare neighbors on the ladder side by side
(Wood with Silver, Sublime with Radiant, Radiant with Pearlescent) so each is plainly its own. At 24 px each must read as
its tier, and a tier's four divisions must be told apart. Clean and bold beats intricate.
