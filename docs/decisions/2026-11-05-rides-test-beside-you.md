# The rides test's "beside you: 23,17": a bot standing in front of the square (Nov 5, 2026)

Lane: the town area (a test-only fix). Main's run 42076937566 (f5e73337), job "the town on WebGL, webgl-phone",
`e2e/town.spec.ts` "rides", both tries: `beside you: 23,17`, received `[22,17]`.

**The cause.** The test froze the bots (`__townCall(-1)`) only after the ride's checks, about 20 s after the town opened on
CI's WebGL phone runner. By then they had wandered: Crumb stood still on 23,16, the square in front of 23,17 (toward the
camera). On a phone, a figure on the square in front is drawn over the middle of the square behind it, and the test tapped
that middle (`__townAt("square")`). A tap takes the nearest figure under the finger, so it opened Crumb's card and you
didn't move. The app was right: a player tapping there taps Crumb.

**The evidence.** The retry's trace: the click at (223.5, 407.2) on the page, the square's middle unchanged across reads (the
camera had settled), you on 22,17 for 5 s after, and the page snapshot with Crumb's card open. With the bots left to wander
until one stood drawn over that square, the unchanged test failed the same way on the WebGL phone build (2 of 3 runs:
Glim's card, from 23,16; Bun & Bug's card, from 23,17 itself). With the bots frozen, then you walked to the square
diagonally behind one, a tap on the middle of the square beside you opened that bot's card on 6ce41d19's build (before
#504) and on f5e73337's alike (each served build checked). #504's change to the input path (`look.release()`) only clears a
drag's start. Nov 1's "beside you: 22,17" (60975fa) was a different cause, the camera still gliding (`squareSettled` fixed it).

**The fix (the test only).** The bots hold still from the town's first moment, where the town places them (at least 3 steps
from you): an init script calls `__townCall(-1)` as the town sets the hook, before any walk. Taps aim at the point of the
square a tap reaches (`__townAt("tap-square")`, as town-fixed.spec does), not its middle. A new check says no bot is within
2 steps of you. Runs: 20 of 20 on the WebGL phone build with 0 to 19 s added before the taps, 5 of 5 under 4x CPU
throttling, and town.spec.ts whole on phone and computer, WebGL and 2D builds (54 of 54 each).
