# Main red on 1bd2caa: two retry-passes, two causes (Nov 18, 2026)

1. **Big Boy's tower spec** (`e2e/bigboy.spec.ts:144`, "a scattered block still on a4 five seconds after the new tower"): the spec's
   own check. The new tower's mark is `.pw-block.pw-tower`, and the new tower may stand on a square one of the scattered blocks had, so
   `.pw-block[data-square=…]` found the tower. The app was right. The check now looks for scattered blocks only
   (`.pw-block:not(.pw-tower)`). Proof: 2 of 3 failed before, 4 of 4 passed after, with no app change.
2. **The computer's live window** (`e2e/home-ranked.spec.ts:300`, Eric's guard, unchanged: `.fd-livewin-sq`'s box read as null right
   after it was visible): the app. A live match replacing the bot recording (or the other way) swapped two different components,
   rebuilding the window and its board's box for a moment. Fix: one `LiveFrame` for both, so the window and the board's box stay and
   only what's in them changes (`components/LiveWindow.tsx`). Nothing on screen moves; the board no longer flashes on the swap.

Checks changed: `bigboy.spec.ts:144`'s last check, `.pw-block[data-square]` → `.pw-block:not(.pw-tower)[data-square]` (the tower's mark
excluded; scattered blocks still must be gone). The guard spec is unchanged.
