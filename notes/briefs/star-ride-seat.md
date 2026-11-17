# Star ride, third pass: the pawn sunk into a hollowed-out seat. item-builder lane. Opus, high

Eric, Nov 17, on the finished star: "It should be like the other riders where some of your pawn disappears in the center of the star,
almost like the center is a hollowed out seat." The previous helper wrote the run's brief and was stopped (by the director, by
mistake) seconds after starting it: **`scripts/boss-art/briefs/star-ride-seat.md` on `claude/boss-art`** (commit 2a7c571) is the brief;
the finished pawn-on-top star is `scripts/boss-art/out/_prev/star-ride-try2.tsx` there.

1. Run it as written: `BOSS_ART_CAP_USD=6 BOSS_ART_READ=scripts/boss-art/out/_prev/star-ride-try2.tsx npm run boss-art -- --rider star-ride
   scripts/boss-art/briefs/star-ride-seat.md scripts/boss-art/refs/star-ride` (Opus, the runner's default; the key is in the environment).
   Look at its pictures; one retry at most if it misses the seat. Push the art to `claude/boss-art`.
2. Put it into the game on `claude/star-ride` (`packages/app/src/components/rides/moon-ride.tsx`, re-measure `ride-cells.ts`, `feel.ts`'s
   foot if the shadow line moved), the ride tests and the town ride e2e (phone); fresh stills and GIFs (red, cobalt, the views sheet) on
   `stills/star-ride` (replace; never under docs/). Update `.pr-body.md` (a "Seat" section: the cut and pawnY, the API $), `.done` again.
Read CLAUDE.md, `.claude/agents/item-builder.md`, `notes/RULES.md` (art is drawn by the API, never by hand). Commits end with the
`Claude-Session:` line only, no model names. No PR.
