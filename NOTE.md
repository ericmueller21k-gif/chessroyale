# Legendary/Mythic polish: mockup (Nov 24)

Brief: `notes/briefs/legendary-mythic-polish.md` (director's notes). Code: branch `claude/item-polish-mockup` (mockup only, not for
merge): the drawings in `packages/app/src/components/Items.tsx`, the `ia-` animations in `styles.css`, the page
`packages/app/item-polish-preview.html`, and the filming script `scripts/item-polish-mockup.mjs` (makes every file here).

All animation is CSS on SVG transforms and opacity (no frame loop), mostly at rest, slow, and off with reduced motion
(`reduced-motion.png`: every item rests on its still drawing, no sparkles left over). Every section shows a card and a white
and a black pawn, on a light and a dark panel. `*-closeup.gif` = card and pawn at 240 px (easiest to judge); the others are the
whole section at real size.

## v2 (Nov 24, after Eric's look)

- **v2: Gift-Wrap Tube = the confetti puff** (Eric: "I see the confetti coming out. Yeah, I like that more"); the barber pole is
  dropped. Fewer, bigger bits (five, 3.2 × 3.6, was six at 2.2 × 2.6): its two colors, white and gold, tumbling up and to the left
  so they stay on the pawn's square, every 5.5 s. `tube-confetti-v2-closeup.gif`, `tube-v2.gif`.
- **v2: Candy Cane = a magic strand** (Eric: "a magical little spell, like string thing ... floating around the stick ...
  spiraling around it as it moves up"): a thin gold strand with a bright core floats just off the cane (5.4 from its middle, the
  cane is 3 wide each side) and spirals up it, about one turn per 17, round the hook to the tip. Where it passes behind, the cane
  hides it; at the edges you see it swing out from behind (dimmed). Five sparkle motes are shed as it passes, a sparkle pops at
  the tip, then about 4 s of rest (6.5 s cycle). One helix path drawn twice (behind the cane, and in front clipped to its front
  stretches), its light a dash running along it (`stroke-dashoffset`, `pathLength` 100). 10 animations per cane, was 24.
  Reduced motion: no strand, no motes. 4x CPU, 18 canes, no shine: 57.7 fps. `cane-v2-closeup.gif`, `cane-v2.gif`.
- Everything else stands as picked: the crown, the parrot's flap, the Tommy Gun's key plus puff, the six Smiley expressions from
  the seed. (The v1 cane and tube files below are kept for comparison.)

## Files and picks

| Item | Files | What it does | Pick |
| --- | --- | --- | --- |
| Fire & Ice Crown (rebuilt) | `crown-closeup.gif`, `crown.gif`, `crown-colors.png` (Red, Cobalt, Emerald, plus Pearl and Midnight), `before-on-main.png` (how it looks today) | The floating tips are gone: three real flames rise out of the ice between four ice shards. Each flame is layered: deeper at the root, the item's color, a lighter middle, a near-white core; a soft glow of its color behind, an ember drifting up now and then, a frost twinkle on the ice. The flames flicker calmly in a burst, then rest (every 5 s). The ice and its gem stay ice-blue in every color. | This |
| Candy Cane | `cane-closeup.gif`, `cane.gif` | A band of warm gold light winds up the stripes from the bottom, round the hook to the tip (about 1.7 s), a sparkle pops at the tip, then about 4 s of rest. | This |
| Gift-Wrap Tube | `tube-barber-closeup.gif`, `tube-confetti-closeup.gif`, `tube.gif` | Lead (Eric's choice, Nov 25): every 6.5 s the stripes wind up two turns like a barber pole and a sparkle pings at the tip. Alternative: a small puff of confetti in its three colors from the tip every 5.5 s. | **Barber pole.** It's the tube itself moving (no new parts), reads at pawn size, and stays inside the item's box. The confetti is more fun on a card but the bits are tiny on a pawn. |
| Parrot | `parrot-flap-closeup.gif`, `parrot-tilt-closeup.gif`, `parrot.gif` | Pick: a quick double flap of its wing every 6 s. Option: a curious head tilt that holds for a second (every 7 s). | **Wing flap** (what Eric described). The tilt is subtler; could be added later, alternating with the flap. |
| Tommy Gun | `tommy-closeup.gif`, `tommy.gif` | A: the drum gets a winding key (real Thompson drums have one) that turns a notch (half a turn, a little past and back). B: a tiny puff of smoke from the muzzle. | **A + B**, a second apart in a 7 s cycle (the third tile). The key alone is easy to miss on a pawn; the puff gives it a beat. |
| Smiley Face (no animation) | `smiley-expressions.png` | Six expressions in its style: Smile, Wink, Tongue, Cool, Surprised, Laughing (plus Midnight and Pearl to check the light ink). | See below |
| Pirate Hat (OPTIONAL) | `pirate-wink-closeup.gif`, `pirate.gif` | Optional extra only: the skull on the hat winks every 9 s. | Optional; the hat is left alone unless Eric wants it. |
| Banana Suit | none | Not touched (Eric: it stays default). | |

`all-at-rest.png` is the whole mockup page at 2×, every animation at its starting frame.

## The Smiley Face: how the expressions would work

- **Recommended: the expression comes from the item's seed**, the way the Gift-Wrap Tube's second stripe color already does
  (`secondColor`, `SEEDED_SECOND_COLOR` in core): one Smiley Face item, its expression rolled with it, never stored. No D1 column,
  no migration, no protocol field, no change to the crate's list or odds; it's tradeable as now. The card and locker would name
  it ("Smiley Face · Wink"). The mockup draws it this way (`smileyExpression(seed)`); in a real build that function moves to core
  beside `secondColor`. Even odds (1 in 6 each) unless Eric wants the plain smile commoner. Lane: targeted (core roll + drawing +
  the name on the card), not full, since nothing is stored. Note: smileys already owned would show whatever expression their
  seed gives (pre-launch, only test lockers).
- Rolled and stored like a color: a new column and `cleanLook` field (full lane), for the same result.
- Separate items in the crate: six Legendary items share Legendary's 80 in the Beta crate's Fischer Random, so the pirate hat's
  chance (and each smiley's) drops, and the locker fills with six near-identical tiles. Not recommended.

## Frame rate (once, the items preview at 4× CPU, headless Chrome, 10 s)

The mockup page is a stress case: about 130 animated items at once, and in it every item is at 92% purity, so the existing
shine runs on all of them too.

| Page | This mockup | Same page, main's drawings |
| --- | --- | --- |
| All sections, shiny (as drawn) | 6.0 fps | 22.9 fps (the shine alone) |
| All sections, 70% pure (no shine) | 13.9 fps | 60.1 fps |
| All sections, reduced motion | 60.1 fps | |
| Crown only (30 crowns, no shine) | 53.7 fps | |
| Cane only (18 canes, no shine) | 57.4 fps | |
| Tube / Parrot / Tommy / Pirate only | 60.0 / 60.1 / 60.1 / 60.1 fps | |

What I changed because of it: the crown first flickered nonstop with a pulsing glow and core (18 fps for its section, shiny);
the glow and core are now still, and the flames flicker in a burst and rest.

What it means for a real build: a handful of animated items on screen is free; a grid of dozens is not (an SVG animation
repaints its drawing every frame it moves). **Recommendation:** animate only where the item is the focus (your own pawn, the
locker's preview, a profile, the crate reveal) and keep grids and lists still (one CSS rule, e.g. `.locker-grid .ia { animation:
none }`). The existing shine has the same cost in grids (22.9 fps on main here), so the same rule would be worth applying to it.

## Calls made

- Animated parts turn about their own point with a `Pivot` group (origin in the drawing's units), so the same motion holds on a
  pawn, a card and inside tilted groups; no `transform-box: fill-box`, whose box changes when a shine rect is present.
- The Tommy Gun's card frame grows a little at the top (y 12 → 8) and the tube's (y 15 → 10), so the puff and the sparkle aren't
  cut on the card.
- The candy cane's light is gold with a white core, not white: white light vanished on the cane's white stripes.
- Items drawn as pictures elsewhere (the town square's rides, any rasterized copy) would stay still; nothing there changes.
