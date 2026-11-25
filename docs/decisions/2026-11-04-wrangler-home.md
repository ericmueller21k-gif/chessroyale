# Wrangler's barn and his challenge intro in the game (Nov 4, 2026)

Eric approved the whole build Nov 4 and wants it live; Wrangler is live, so it goes to everyone. The art: `claude/boss-art` at
0e4c00c6 (`house-shop-pig`, `sidekick-pig-rooster`, `ride-pen-pony`, `boss-pig`, `house-intro-pig`; notes `shop-pig-nov4.md`,
`intro-pig-nov4.md`), copied in as Hollow's and Timber's were (imports moved, the room still and review sheets left there).

## The calls

- **The rooster on the counter** (Eric's pick): a Shopkeeper can stand raised (`ShopDef.lift`, room pixels): his feet on the plank
  top (27 px over the counter's foot, where the crate's foot sits too), on the counter's middle and its own row, drawn just after it;
  his squares stay behind it. No other shop has a lift, so nothing else changes.
- **His intro stands you both at the usual clear places from the start** (`seated`), not the art's 7.2 for him: there the rope coil
  in his other fist hung in front of his bucket (the stool clearance test). At 6.9 all of him and every move is on a phone's screen.
- **His attack's lash crosses over his bucket.** His lasso lashes the floor nearly two squares out; clear of the bucket he'd stand
  3.5 out, off a phone's left edge. He stands clear; only the swung rope crosses it. The clearance test skips his attack's feet
  (only his). Eric to confirm, or pick: no attack in his intro, or the attack before the buckets land.
- **His moves are drawn as the art drew them** (not mirrored: they throw and haul to our left and right as drawn), his idle too
  through the intro; he's turned to face you only walking in and in his attack, as every boss.
- **The corner board is the room's piece until the yank** (the brief); from then his bale, the real board on it.
- **The buckets start just off the screen's edge** on each side (the art's mockup used ±7 squares, which a wide screen can show),
  kept inside the barn's walls.
- **The wipe's own frame cues** (the spurs' jingle on its first frame, a cap's pop on its fourth) play once as it sweeps in; every
  storm does that now, but "storm" (Alfil's, which its start already plays); Big Boy's "swirl" has no sound mapped, so only
  Wrangler's are new. "flick" (the loop shaken free) is his throw, as the notes suggest; no fifth new sound.
- **Pen Pony's line** is the drawing's own ("It won't go straight, but it hops like nobody's business."), as every ride's (a test
  keeps them equal); its id `pen-pony` (the drawing's id changed from `ride-pen-pony` to match, as every ride's is its item's).
- **His card** shows his home's name and Go in: there's no line for Wrangler's home (only Hollow's has lines).
- **Eric's two fixes after the art round, made here:** the HunChess bucket is always the side view (no open mouth or base seen from
  above: the end cap is gone from `hunchess-bucket.ts`, so the stools, the tumble and the decoration in the barn and Puddles' shop all
  change); and both pens are mixed, two white knights and two black in each, one in each quarter, hopping as before.
