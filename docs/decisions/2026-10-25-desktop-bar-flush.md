# A computer's boss bar straight with the board; the admins' ⚡ and 🐟 on a computer too (Oct 25, 2026)

Eric (Oct 25, a desktop screenshot of Babur): "why is the boss bar not flush with the board like it used to be? Why is it wider now?…
It should just be straight with the board." And: "why is the Maia 1800 thing even showing at all? I said, delete that."

- **The bar.** On a computer the title line and the boss bar filled the board's grid column, while the board is that column less the
  eval bar's room (48 px, held on both sides so the board stays centered), and less again where the window's height limits it. So the
  bar ran past the board: 24 px on each side at 1280 × 800, and 96 px each side at 1024 × 768 (628 px of bar over a 436 px board).
  Now both take the board's width, centered (`justify-self: center` and the dock's own `max-width`), so their edges are the board's.
  `e2e/boss-bar.spec.ts` checks the edges at 1280 × 800, 1440 × 900, 1024 × 768 and 1920 × 1080.
- **The admins' tools.** Oct 24's ⚡ and 🐟 were built for a phone only (the request came with a phone screenshot). Eric's rule from
  now on: when he doesn't name the platform, it means both. A computer's title line now shows the same tiny ⚡ and 🐟 (`TestButton`'s
  icon form; `.match-tools > .gk-tool`), and the brain's line is hidden (its words are the 🐟's title), as on a phone.
