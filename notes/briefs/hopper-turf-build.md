# Chub & Chirp: Turf, the build (phase B). Opus, xhigh. Boss lane (+ one quick review after). Eric approved the look (round 2)

Read `notes/briefs/rules-common.md` first, then `notes/briefs/hopper-turf.md` (Eric's words and the agreed design: the squares, the count,
Chirp's hop-around, the three holds, not in the Battle Tower), then `docs/areas/bosses.md` (Chub & Chirp) and `.claude/LESSONS.md`.
Branch `claude/hopper-turf` from `origin/main`.

**Eric, Nov 27 ~19:05, seeing a live Chub & Chirp battle with no prints:** "Why is the thing not in the game still with the prints on the
board?" He had OK'd the round-2 mockup; it was never built. Build it now, the whole design, as the round-2 stills show:
- The look (round 2, Eric: "we don't change the colors... just the feet imprint... for ours the HunChess logo... dimmed... keep all
  the colors on the board the same"): NO square tints. His squares: Chirp's print pair at opacity 0.32 (a fresh hop's prints 0.62),
  visible on light and dark squares. Your squares: the crowned pawn from `public/icons/icon.svg` (its `<g>` paths only), centered at 46%
  of the square, `#1b1d22` at 0.16. Never reads as a piece; pieces, last move, check, legal-move dots and carrots always on top.
  The stills and the script that drew them: orphan branch `stills/hopper-turf-mockup` (`NOTE.md`, `phone-*.png`, `desktop-*.png`,
  `mockup-script/overlay.js`): match them.
- The count on his boss bar ("Chub 26 · You 21 · Open 17") with each side's tiny mark; the holds as pills by it (tap: what it does).
- Chirp's hop-around every `turfHopEvery` (4) of his turns, as designed (3 of his squares, then an open one, else one of yours).
- The holds (Long legs / Short fuse / Double hop) at 32 / 40 / 48 squares to start, all in settings.ts. Run one sim at one setting
  (the boss's win rate with Turf on vs off, against the usual bot levels) and say whether the thresholds look fair; tune if clearly off.
  Double hop must never give a first move that checks; Long legs' rules as the design says (no capture, no en passant, no promotion
  by a 2-3 step). Server and solo the same (online sync, protocol: optional fields only).
- Not in the Battle Tower at all.
- Fold in #883's review nits (review-883.md on `review/hopper-pawn-bounce`): the last-move highlight after a bounce; a several-bosses
  test for the bounce; `due(b, s)` ignoring `s` for pawnBounceMax.
Tests: the boss kit (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts`), unit tests for the rules (claiming, flips, the
hop-around's picks, each hold's moves and its edges), one focused e2e check in `e2e/hopper.spec.ts` (prints and logos on a live board, the
count, a hold's pill). Frames: watch the hop-around frame by frame (`npm run frames:boss`). Stills for Eric: phone and computer, a
mid-game board and the hop-around (orphan `stills/hopper-turf`). Push at each real step. `.pr-body.md` (at most 40 lines; changed
checks old → new), a short decision note, `docs/areas/bosses.md`, then `.done`. Commits end only with your Claude-Session line.
