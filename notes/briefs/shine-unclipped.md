# A shiny ride's shine slides across the whole locker preview as a rectangle (Eric, Nov 15)

Effort high (SVG drawing; every shiny item). Targeted lane. New branch `claude/shine-clip` from `origin/main`. Read `CLAUDE.md`,
`.claude/LESSONS.md` (watch drawing changes frame by frame), the item pages in `docs/areas/` (shop/items).

Eric (Nov 15, the locker's Ride tab, a computer): "whats this bug, this shit is sliding across the pawn". His two stills:
`notes/ref/eric-shine-slide-1-2026-11-15.png`, `-2-…png` (on `claude/director-notes`): a pale slanted band, the height of the pawn and
ride, as a full RECTANGLE moving left to right over the preview (the locker's pawn wearing a crown, a suit, a red weapon and Boingo's Pogo).
The shine (`components/item-paint.tsx` `Region`: `<g class="item-shine">` a rect over `p.box`, inside `<g clip-path="url(#${p.id}-${name})">`,
animated by `.item-shine` in styles.css) should only show inside the item's own shapes. Here its clip isn't applied.
Find the cause (suspects, check each, don't assume: duplicate clipPath ids when the same item is drawn twice on the page (the grid card
and the preview) so `url(#id)` resolves to another copy; a clipPath inside a `display:none` or detached tree; the ride drawn through
`rides/draw.tsx`/`svgText` (which strips `.item-shine` for images) but this preview using a live SVG; `mix-blend-mode: screen` on a
transformed group escaping the clip in Chrome). Reproduce it (a shiny Boingo's Pogo in the locker; also check other shiny items and rides
in the locker, the shop and the profile, on a phone and a computer), fix the cause so every shiny item's shine stays inside its shapes
everywhere, and keep the shine as it looks inside them.
Prove: stills before/after (locker Ride tab with the shiny pogo, phone and computer) on `stills/shine-clip` (not under docs/); a check in an
existing spec (e.g. the shine's drawn area inside the item's box at two moments of its roll, or no two clipPaths with one id on the page).
Typecheck (includes e2e); app unit tests; the touched specs. Push at each real step; `.pr-body.md` (cause, fix, player-visible, checks old
-> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line only). About 1 hour.
