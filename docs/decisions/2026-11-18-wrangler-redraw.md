# Wrangler's lasso throw and pulls redrawn: he looks at what he ropes (Nov 18, 2026)

Eric, Nov 18: "redo Wrangler's throw … he kind of looks the wrong way and pulls. It just looks weird. We want it to look actually
normal when he does his wrangle and he pulls … also when he does his startup animation, when he wrangles the chessboard."

- **Seen frame by frame (`npm run frames:pig`, phone and computer; the town intro recorded in his barn):** his art faces our left, but
  his throws go to our right (`CATCH`). In the lasso (the drag and the long pull) and the double lasso he looked away from the loop,
  and only his far fist held the rope, so it ran across his belly. The showdown's haul leaned into its ropes. In the intro, once the
  bale had slid past him to his right, he still leaned toward it with his back to it.
- **Redrawn by the API runner** (`claude/boss-art`, `out/pig-redraw`: $1.51 of an $8 cap, one run; the brief `briefs/wrangler-redraw.md`),
  from his own rig: `look: "right"` turns his head and hat to the loop (his own parts mirrored about his skull's middle), and `hold`
  puts both fists on one rope. The throw, the tug, the double lasso and its yank look at the loop and lean back. The haul leans back to
  our right with both fists low in front (`HAUL_FISTS` now [17, 53] and [27, 55]). The intro gets a new move, `reel`.
- **Kept:** his palette, frame, foot, `CATCH`, every loop's path, every frame's ms and cue (and shake, except the intro reel's, which
  shakes toward its lean). `idle`, `taunt`, `leap`, `ready` and the intro's other moves are pixel for pixel as they were.
  The facing rule from #781 is unchanged.
- **Call made (the intro):** the bale's path runs from the corner behind him to the middle on his right, so one pose can't face it the
  whole way. He yanks while it's behind him and reels once it passes his column: `CHALLENGE_FEEL.rope.reelAt` 0.67 (the slide's eased
  progress at that point, measured against the room in shop-wrangler.test.ts). The reel's rope leaves his front fist (`h1: "R"`).
- **Worth Eric's eye:** his mirrored head is lit from the top right, and in the "wild" throw frames his inward pupils, mirrored, look a
  little cross-eyed.
- Tests: pig.test.ts (every rope he holds starts in his fist; he looks at the loop from the throw to the tug; the haul's fists, its
  lean), shop-wrangler.test.ts (yank, then reel, as the bale passes him). Stills: branch `stills/wrangler-redraw`.

## Review fix: the showdown's ropes never cross (Nov 18)

The review found the haul's two ropes crossing at his fists in about half of square pairs (fists handed out by a fixed order). Each
pair now gives its ropes their fists by the shorter total rope length (`pairRopes` in `Pig.tsx`), decided once per pair from its
from-squares. The call: the review suggested ordering by angle from the fists' midpoint; that still crossed in 24 pairs when he's
drawn unmirrored, while the shortest pairing of two points with two points never crosses, in the same few lines.
