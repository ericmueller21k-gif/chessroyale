# Notices sit on top, never push the screen (2026-11-16)

**Eric, Nov 16:** on Boss Battle, "That match has ended." and "That party has closed." pushed the boss tiles, the stage and START down.
"Look at how it pushed everything down. We should make these style pop-ups always just sit on top of everything else ... They
shouldn't ever push anything around on the screen."

**The call:** the `fd-notice` box is `position: fixed`, under the page header, centered (over the middle column on a computer), with
`z-index` 50 (over the page, under the sheets at 59 and up). The party error ("That party has closed.") moves from the line under
START into the same box, with its own X. The line under START keeps its place for status text only.

**Guard:** `e2e/lobby-close.spec.ts`, "a pop-up note floats over the screen and pushes nothing" (new). Verified: it fails on the old
CSS (the PLAY box moves 37 px on a phone, 74 px on a computer).

**Not changed:** the Boss Battle's `fd-error` line (a start error) still sits in the flow, below the stage and the options; it pushes only
what's under it. Flagged for a follow-up.
