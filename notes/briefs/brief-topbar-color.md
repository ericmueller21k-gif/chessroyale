# Phone top bar: colorful icons, and your pawn's face as the profile button (Eric, Nov 9)

Mockup Eric liked (follow the idea, not pixel for pixel): `notes/briefs/assets/topbar-eric-mockup.png`. Today: `assets/home-now-nov9.jpg`.

Eric: "the 5 we have ... should all have some color to them ... I like how the icons are a bit bigger as well. Like, actually, the
containers are the same size, but the icons are bigger. They have a little color."

1. **Quests, shop, friends, settings buttons** (packages/app/src/screens/Home.tsx `fd-top` ~line 1096; the icons QuestsIcon, ShopIcon,
   FriendsIcon, GearIcon): same containers (size, place, background), the glyphs bigger (about 30% bigger, still inside with a clear
   margin) and colored as in the mockup: Quests a gold clipboard with a check, Shop a gold bag, Friends blue people, Settings stays
   a neutral gray gear (a dark outline). Use the theme's gold (`--fd-gold` family) and one blue token; define any new color as a
   token with a dark-mode value too (check dark mode: readable, not neon). Filled shapes with the existing outline weight, flat (no
   gradients). The disabled Quests button stays visibly greyed.
2. **The profile button** (AccountBar, `tourId="profile"`): today a gold-ringed circle with your whole pawn, animated. Make it the
   SAME rounded rectangle as the other four (same size, radius, background), no gold ring (Eric: all gold borders or none: none), showing
   **only the face**: your own dressed pawn, zoomed so its head/top half fills the box (crop the bottom off), **no animation** (static
   pose; respect what DressedPawn offers, e.g. a still/no-ride prop; don't fork the pawn component). Signed out: the default pawn's face.
3. Nothing else moves: the logo, the live line and the card under it stay where they are at 320, 360, 390 and 430 px; every top-bar
   button stays >= 40 px (home-layout.spec.ts guards it; don't loosen it). At 320 px the logo already swaps to the app icon: keep that.
   A computer's top right pawn: leave it as it is unless it shares the component (then the face crop applies only to the phone bar).

Lane: light (CSS, small markup). Tests: run e2e/home-layout.spec.ts (phone project) and fix anything your change breaks; add one
focused check to an existing spec: the profile button's box equals the shop button's box (width, height, border-radius) and has no
running animation. Decision note (~5 lines) docs/decisions/2026-11-09-topbar-color.md; update docs/areas/hub.md's top bar line.

Stills: light and dark, phone 390x844 at deviceScaleFactor 2, plus 320 px light: push to orphan branch `stills/topbar-color`.
