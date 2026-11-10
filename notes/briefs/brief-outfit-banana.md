# A new item slot, Outfit; its first item, the Banana Suit (Eric, Nov 10)

Eric: "let's add a new item category ... outfit. And if you're wearing an outfit, then you can't do anything else but have
the outfit on ... easier to program ... If you wear a banana suit, you're just gonna look the exact same as everyone else in
one. The only thing ... is if you could wear a visor ... the goggles or something. That would be the only exception."

## The slot
- `ItemSlot` gains `"outfit"` (packages/core/src/crates.ts `ITEM_SLOTS`). Wearing an outfit hides every other worn item
  (head, face, skin, weapon, ride): the pawn looks exactly like everyone else in that outfit. One exception, behind a
  setting so it's one line to undo: eyewear (face items over the eyes: goggles, visors, glasses) still shows, over the
  outfit's face hole (`OUTFIT.eyewear: true` in settings.ts; tag which face items are eyewear).
- Other items stay equipped underneath (taking the outfit off brings them back); nothing is unequipped or lost.
- The locker: an Outfit tab or row like the others; while an outfit is on, the other slots show greyed with a line
  ("Hidden by your outfit"), not hidden (Eric's rule: nothing hidden, nothing shifts).
- Everywhere the dressed pawn is drawn (town, home's hero pawn, profile, locker, crate reveals, any board or screen that
  draws a dressed pawn): the outfit replaces the pawn's look. Find them all from the existing dressing code
  (`town/dressing.ts`, the pawn/avatar components) rather than adding cases one by one.
- Stored data: if equips are stored per slot and a new slot needs a migration, say so (the director runs the full lane).

## The Banana Suit (the mockup is the spec)
`notes/assets/banana-suit-mockup-v3.png` (and its `.html`, the SVG source) on claude/director-notes. A banana suit with the
pawn's own head in the face hole, thin black arms with big white cartoon gloves, thin legs with big white cartoon shoes.
- **Idle:** a gentle two-frame bounce (knees bend and it dips; then up, arms swaying in at its sides), slow.
- **Run:** a real sprint, not flailing: side-on when moving left/right (elbows bent, fists pumping close, full stride,
  slight forward lean); also front (walking down) and back (walking up) views as the rides have.
- Item: id `banana-suit`, slot `outfit`, a tier the director will confirm (suggest epic), in the regular crates' pools as a
  crate exclusive (ROADMAP "Riders in regular crates"); a short funny description in Eric's item voice.
- Art in the game's own drawing style (as `components/rides/*.tsx`: SVG drawn to canvas frames, built on first use).

Lane: the slot touches stored item state and every dressed-pawn view: treat as full lane if a migration is needed, else
targeted (say which). Effort high (art and animation; the equip logic carefully). Tests: unit tests for the slot rules
(outfit hides the rest, eyewear shows, unequip restores), the item kit / fitting tests the items area has, one e2e check
in the locker. Stills: the town (idle and a run, phone), the locker with the outfit on, home's pawn (stills/outfit-banana
orphan branch); `npm run preview:items -- out.png items=banana-suit`. Decision note docs/decisions/2026-11-10-outfit-slot.md
(≤ 120 words). Update docs/areas/shop.md (items). Push to claude/outfit-banana at each real step; when done write
.pr-body.md and push. Don't open the PR. Read CLAUDE.md, .claude/LESSONS.md, .claude/agents/item-builder.md and
notes/briefs/rules-common.md first.
