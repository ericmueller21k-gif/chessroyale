# Legendary/Mythic polish: BUILD (Nov 25). Opus high, item-builder lane, targeted. Eric: "yes go ahead"

The mockup is approved: branch `claude/item-polish-mockup` (drawings in `packages/app/src/components/Items.tsx`, `ia-` animations in
`styles.css`, `item-polish-preview.html`, `scripts/item-polish-mockup.mjs`), its `NOTE.md` and GIFs on `stills/item-polish-mockup` (v2 section
first). Build exactly the picks:
- **Fire & Ice Crown** rebuilt: three real flames out of the ice between four shards (all colors; ice and gem stay ice-blue).
- **Candy Cane v2**: the floating gold strand spiraling up round the hook to the tip, motes, tip sparkle, ~4 s rest (6.5 s cycle).
- **Gift-Wrap Tube v2**: the confetti puff (five bigger bits, its two colors white and gold, up and left, every 5.5 s). No barber pole.
- **Parrot**: the double wing flap every 6 s.
- **Tommy Gun**: the drum's winding key notch + the muzzle puff, a second apart (7 s cycle).
- **Smiley Face**: six expressions (Smile, Wink, Tongue, Cool, Surprised, Laughing) rolled from the item's seed like the tube's
  `secondColor` (core, beside `SEEDED_SECOND_COLOR`), even odds, never stored; the card and locker name it ("Smiley Face · Wink").
- **Banana Suit: never touched. Pirate Hat: left alone** (no wink).
- Animation only where the item is the focus (your pawn on screen, the locker preview, a crate reveal, a profile's cosmetics); grids and
  lists still. Reduced motion: still drawings. CSS on SVG transforms/opacity only, no frame loop.

Start: `git fetch origin main claude/item-polish-mockup && git checkout -B claude/item-polish origin/main`. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/rules/eric.md`, `.claude/agents/item-builder.md`, `docs/areas/shop.md`. Tests: the item kit's unit tests, the smiley roll (core), the
fitting sheet (`npm run preview:items -- out.png items=<ids>`), one focused e2e check if a screen's markup changes, `@perf` on a phone page with
many items (frame budgets). Stills on `stills/item-polish` (each item on a pawn and a card, phone, dark; one GIF each), short decision note,
`docs/areas/shop.md`. `.pr-body.md` (lane: targeted; changed checks), `.done`, push, stop. Commits end with only
`Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR` (no Co-Authored-By). Effort high. About 1.5 hours.
