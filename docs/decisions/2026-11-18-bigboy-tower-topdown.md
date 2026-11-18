# Big Boy's tower seen from above (Nov 18, 2026)

Eric (Nov 18, option 3): "Number 3 is the way"; the count on the top block "in the original toy block design ... wooden ... that
carved wooden effect"; "a shadow ... to show its size"; each new block "come[s] down on top of it with a shadow ... and it plops on
it"; "wobbling ... like a building"; "a pretty easy collapsing animation, because they're all scattering from that one spot".

- What changed (looks only, no rule): the tower is drawn from above by the art runner (`claude/boss-art`, out/bigboy-tower-top,
  $2.30 of a $6 cap): a 96 x 96 frame centered on its square (`.bb-tower` 3 squares each way); each block up a little bigger and
  higher, jittered; block n carries n; one board shadow growing with N; the sway grows up the stack and with N (10: the big wobble);
  add<N>: the block comes in big from the camera over 120 ms, its shadow growing on the top, plop, bounce; tip<N>: the stack
  collapses on its square, then today's ToppleFlights fly each block from its new place (`TOWER_BLOCKS`).
- Calls: every block carries its number (director's call), so a scattered block i shows the tower's block i (number and color)
  and its flight shows the same block (`blockItem(..., n)`, `fly<n>`); the single blocks are drawn in the tower's middle square and
  cut out as one-square sprites (no second drawing). The old side-view block sprites are gone.
- Calls: the stack of 10 is about 1.75 squares tall (its top about three quarters of a square above its square), not the brief's
  1.3: the runner kept 2 px strips so each lower block reads (vs about 4.25 squares before).
- Calls: the toss's flight of the first block now ends as its drop from above begins (it overlapped add1 for 120 ms, two blocks
  at once); the under-layer is cut at the board's sides (`overflow-x: clip`) so a tower on the a- or h-file never widens the page
  (its big falling block is clipped there for 80 ms).
- Left as it was: after the collapse each block shows again only as its flight starts (`TOPPLE.every` 70 ms apart, up to about
  0.6 s for block 10), as with the old tower; holding the heap until each flight takes its block would be a follow-up if Eric
  sees it.
- Review fixes (director, Nov 18; `.review.md` on `review/bigboy-tower-topdown`): the landing buzz is back (the cue key is the new
  art's id, `toy-block-top clack`; the haptics test now reads the id from the art, so a rename can't slip past it); the under-layer
  clips both ways (`overflow: clip`), so a tall tower's shadow on the bottom rank stays on the board; scattered blocks'
  `data-state` reads `sit`/`land`/`poof` again; stale comments. Accepted: on an a- or h-file the 10-tower's top block is cut by
  about a sixth of a square at the board's edge as it wobbles (mirroring the sway there would be more code).
