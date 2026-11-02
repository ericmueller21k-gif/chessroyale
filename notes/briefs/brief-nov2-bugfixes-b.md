# Brief: Eric's Nov 2 bug fixes, batch B (shops, augments, crates) + roadmap entries

Branch `claude/nov2-fixes-b` from main. Opus high. Push as you go.

## Fixes (Eric's words in quotes)
1. **Augments:** "Tapping on an augment area puts your piece there." Find the augment-vote UI (50 v 50 cut/augment stages:
   `screens/Crowd.tsx`, augments in `game.ts`/`net.ts`/`solo.ts`) and why a tap on it reaches the board under it (a pick or a
   move made). A tap on the augment area must never touch the board. E2E test.
2. **Augments:** "Remove the emojis from the augment stages … delete them entirely" (for now; our own come later). List the
   removed ones.
3. **Boss crates:** "Buying a boss crate from shopkeepers adds the crate to your inventory, it says when you buy it it's in
   your inventory, they open and shuffle the same way normal crate animations work." Today (#462) buying opens it at once
   into the Locker. Change: the buy adds the boss's crate to your inventory (the Crates tab, beside the other crates); the
   card says it's in your inventory ("Babur's Boss Crate is in your inventory." or similar; list it); opening it there plays
   the normal crate open/shuffle animation, with the boss crate's pool (`BOSS_CRATES`). Stored data: server side, atomic,
   backward compatible (a held boss crate count per boss; opening is a server action like the existing crates; no free
   opens). Keep the server tests for buying; add tests for holding and opening (once, never twice, can't open one you don't
   have). This part is stored data: be careful; the director may ask for an xhigh review.
4. **Chat inside shops:** "make the default text color white, or black, depending on darkness of background in the shop,
   example, circus is black, so text should be white." The chat log shown over a shop interior: pick its text color from the
   room (a per-shop setting is fine: Babur dark → white; Puddles' greenhouse is light → black). Readable on both.
5. **Shop cards in the town** (the walk-up card at a boss home with a shop): "NAME should be centered text, then Go in is
   underneath and centered, nothing else, aka containers will get smaller in height which is desired. So chop the Shop and
   Coming soon." Do it for every home that has "Go in"; homes without a shop yet keep their card as is (say what they show).
6. **Inside a shop, drag to look is flipped on mobile** ("when I drag from down to up, it should be the same as the town
   movement"). Make the room's drag match the town's exactly (phone and computer). Test.

## Roadmap (add to ROADMAP.md, not built)
- **Emoji packs** (Eric, Nov 2): an API art job makes our own emoji packs; then delete the default emojis everywhere. Pack 1:
  chess piece emojis, free. Pack 2: chess reactions (blunder "oops", "nice move", etc.). Not now.
- **Boss challenge from town, Pokémon-gym style** (Eric, Nov 2): challenge a boss in town → it walks into its home with you;
  you each walk to the battle circle's marks; it says its challenge line (Gemini, Part D); its own board-appearing animation
  (Alfil: a sand pyramid rises between you, cracks, and the board emerges on a table in his colors; the table is the town's,
  recolored per boss for now); then its own full-screen transition (Alfil: a sandstorm); the battle; the normal result
  screen (token box as now); leaving puts you back in town where you stood. Art by the shop art session via the API, one boss
  at a time (Alfil first: his home, then his intro). Code after the art.

## Done means
Unit/e2e for 1, 3, 6; stills for 2, 4, 5 (phone + computer); PR-body file `docs/nov2-fixes-b/pr-body.md` with every
player-visible text change and changed checks old → new.
