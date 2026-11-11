# Brief: Rolling Dough's back room: aim at you, one Challenge button, and the walk-out. Opus, high

Branch `claude/bakery-challenge` from origin/main (create it; `npm ci`). Read `CLAUDE.md`, `.claude/LESSONS.md`, `docs/areas/town-square.md`
(Rolling Dough, "Challenging a boss"), include `notes/briefs/rules-common.md`, and **Eric's words: `notes/zebra-eric.md`, the last section**
(all on `claude/director-notes`). Code: `packages/app/src/town/shops/zebra-scene.ts`, `ShopRoom.tsx`, `Town.tsx`, `shops/intros/zebra.ts`,
`challenge.ts`, the crew art `zebra-crew.ts`. Another helper is adding a zebra out front and "he's in the back" lines on
`claude/bakery-front-zebra` (town outside, front-room talk lines): stay out of those; merge main before you finish.

## Build
1. **The crew aim at you and follow you.** During the draw/aim beat, each crew member points his bread toward where you stand, and keeps
   tracking you if you move (face left/right by flipping; pick the closest aim frame if the art has angles; otherwise turn the whole figure
   toward you). Cheap: computed per draw from your position, no per-frame allocation.
2. **One button.** Don's card shows only **Challenge** (no Talk). Pressing it plays the beat (crew stand, draw and aim at you, his relax line,
   they lower, his challenge line), then goes straight into the challenge. Remove what's left of "Talk" (and "Coming soon" logic if unused).
3. **Watch them walk out.** After his challenge line, still in the back room: four goons each pick up one thing (the table, Don's chair, your
   chair, the board) and walk out through the back door, Don and you following (camera holds the room). Then the fade to the front room,
   where they come through the back door carrying them to the pad, set up, and all five crew watch (as today). The carry is visible end to
   end; nothing pops in.
4. Tests: update `e2e/zebra-home.spec.ts` (Challenge alone; the beat; the aim faces you from two places; the walk-out in the back room,
   then the setup in front; into the battle) and the unit timeline test. The town's frame rate the eric.md way (phone + computer) since the
   drawing changes. Stills/GIF (phone: the aim following you; the whole walk-out) to `stills/bakery-challenge`.
5. PR title "Rolling Dough: the crew aim at you, one Challenge, and the walk-out"; body (≤ 30 lines) to `.pr-body.md`; `.done` LAST;
   wait for green CI. Don't open the PR.
