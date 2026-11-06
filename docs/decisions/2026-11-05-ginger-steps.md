# The Ginger Igloo test's "one square short": the tap read while the camera glided (Nov 5, 2026)

Lane: the shop area (the tests, and the shops' tap: the shared press code is unchanged). Main's run 42110146243 (3f50ee8c), shard 2 of 5, `[desktop] e2e/shop.spec.ts`
"Ginger Igloo (Nov 5)", both tries in `tapTo`: first expected `data-you` "6,5", received "5,5"; the retry expected "5,7",
received "5,6".

**The cause.** The room's camera trails your walk (a critically damped spring, `followSpring` 14, behind a 90 ms step: about
a square and a half behind at a walk's pace) and glides on for about half a second after you stop. `data-you` names your
square as a step onto it begins, so `tapTo` went on to the next tap while the view still glided: it read the next square's
point (`__shopAt("square")`) and clicked it one or two round trips later, by which time the square had moved. The room took
the click on the square under it then, one to the west (the view was following you west): in the retry the wall square
(4, 7), whose nearest free square fewest steps away (`tapTarget`) is (5, 6), one short of (5, 7). The first try (CI keeps no
trace of it) fits the same drift, the view following you north-west from (7, 9): a click on the low step (5, 5), or on the wall
behind or west of (6, 5), which `tapTarget` also answers with (5, 5). Not it: the elves (none blocks a stair or catwalk square,
so none could stop you on the low step) and the hit test (a still view's point maps to its own square every time, on the levels
too).

**The evidence.** The retry's trace: the two reads of (5, 7) 34 ms apart gave (68.6, 755.4) and (99.4, 738.1) on the canvas,
31 px apart; the click came 81 ms after the second, with the square still moving at about 0.9 px/ms (a square is 92 px wide
there). Five of the seven taps before it in that try read a moving square too (8 to 46 px between their two reads). Locally, a listener on the canvas measured, at the
click, how far the tapped square's middle had moved from the click: with each tap read the moment `data-you` changed, up to
31 px; with 80 ms more between the read and the click (CI's round trips), 46 to 71 px, and 2 of 5 runs failed exactly as
CI's retry did ("5,7" expected, "5,6" received, at 54 and 71 px).

**The fix, in the tests.** Each tap is aimed once you've stopped and the view rests on you (`viewOnYou`: the camera's focus
within 0.01 of a square of your square). Ginger's `tapTo` waits for it before the shopkeeper's card check and the read, and so does
Jefferson's `walkTo` (it reads and clicks the same way). Every check is unchanged.

**The fix, in the app (the director, Nov 5: a player could hit it).** A shop picked a tap's square at the release only, with the
camera as it was then. Mid-walk the view moves about 0.9 px/ms, so in a 100 ms tap it moves about a square, and a player could be
sent one square off. Shops now do what the town does (`town/press.ts`, as the town's `onDown`/`onUp` use it): what's under the finger
is picked at the press and again at the release (`shops/tap.ts` `pressKey`: the Shopkeeper, or the square under the finger), and
you walk only if both are the same. A release on anything else lets go without walking. The hit test moved, unchanged, into
`shops/tap.ts` (`squareUnder`) so it can be unit-tested with a moving camera (`packages/app/test/shop-tap.test.ts`). A press with a
card open closes it as before (the town's way: unless it became a drag).

**Runs.** On the computer, 20 of 20 with the 80 ms gap that reproduced the failure, and 20 of 20 earlier (before the app change:
10 with the gap, 10 plain). On the phone, 20 of 20. `e2e/shop.spec.ts` whole on both projects: RUNS_FULL.

**Left alone: the arrow-key step (unconfirmed).** Under 3 parallel workers, 1 of 10 computer runs timed out at the keys part's
wait for `data-you` "10,4". It never happened with 2 workers, CI's default. The likely cause is a frame longer than a step (90 ms),
so the walker takes two steps in one frame and "10,4" is never drawn, but that isn't confirmed. It is not `tapTo`.
