# Item polish: FINISH (Nov 25). Opus high, item-builder lane, targeted. Branch `claude/item-polish` @ 3a7a4112 (paused for main red)

The build of `notes/briefs/item-polish-build.md` is done on `claude/item-polish` (read that brief for the picks). The previous helper reported:
- Done: the six items' drawings from the approved mockup (mockup-only options out); animations opt-in via `live` on `ItemArt`/`Avatar`
  (`.ia-live`, only inside `prefers-reduced-motion: no-preference`), on in the locker preview, crate reveal, profile Wearing rows and tiles,
  DressedPawn (not the side menu ring), BossDock YourPawn, Vote / DuelVote pawn, AutoChess pawn; grids and lists still. PowerParts banner NOT
  live (banners.test.ts guards Eric's Nov 5 rule by its exact markup: leave it). Core: `SMILEY_EXPRESSIONS`, `smileyExpression(it)`,
  `itemName(it)` ("Smiley Face · Wink"), `stackKey` includes the expression; names shown on reveal card, locker tile + aria, delete dialog,
  profile rows, `wornTiles`. Test "a Smiley Face's expression comes from its seed…" in crates.test.ts. Dev page items-preview `?live=1`,
  `?seeds=`, `?width=` (seeds 1, 8, 3, 10, 2, 5 → Smile, Wink, Tongue, Cool, Surprised, Laughing). Typecheck clean; vitest 4940/4940.
Left to do (do these, nothing else):
1. Merge origin/main in. Check whether any e2e spec reads a smiley's name (now with the expression) and fix it if so.
2. Stills + GIFs of the six items animating (a 390x844 dark phone, the items-preview page `sheet=1&live=1&width=366`; screenshot the element
   `#app > div`, not the full page; ffmpeg for GIFs). Push to `stills/item-polish` (images only there). Look at each yourself. Plus a 320 px
   check that "Smiley Face · Surprised" fits a locker tile.
3. `@perf` on a phone page with many live items (`npx playwright test --grep @perf --project phone`, the relevant one), as CLAUDE.md asks
   when drawing or the frame loop changes.
4. A ~5-line decision note in `docs/decisions/`, the `docs/areas/shop.md` update, `.pr-body.md` (lane targeted; changed checks: none edited,
   one unit test added; player-visible changes).
Push, write `.done`, stop. Don't open PRs or wait on CI. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By).
