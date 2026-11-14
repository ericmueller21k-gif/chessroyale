# Flaky round 5: the causes (Nov 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Each test asked first: is the game wrong, or the test?

- **Test, shared: every town tap on the frame its point came from** (round 4's follow-up). The specs that still read `__townAt` and
  clicked on their own (claw, colosseum, global-chat, hidden-boss-room, town-controls, town-fixed, town-street, town-tags, town, zebra-home)
  tap through `townTap` / `tapInTown`; points a spec reads itself (Alfil's building edge, your pawn) through the new `townHeld` (the town's
  frames held from the read to the tap). `townTap` takes squares (`"tap-square"`) and, for a figure that walks on, `still = 0` (the first
  frame it's drawn: held, the tap comes on that frame anyway). Only the tap's mechanics changed, never a check.
- **Test: a far home's card read while it was hidden** (shop:93 in Eric's "up is up" guard, desktop). A tap on a far home calls off the
  glide and the camera follows your walk, so its card hides (`visibility: hidden`, `placeCard`) until the home is back on screen; `goIn`
  read its buttons in that gap. That's how the town works (the card points at its home), so the fix is in the shared tap: `tapInTown`
  returns once you've stopped walking with the card showing. No check changed.
- **Game: in the background as the town loads was never dropped** (town-afk:116). The loading screen made the away clock "busy" (as a
  challenge does), which also stops the background limit, and coming back dropped the hidden time. A phone in the background runs no
  frames, so its loading waits for it: such a player came back to the town after any time away. Now the loading screen holds only the
  idle clock (`AwayClock.setLoading`; unit test). The test's paused clock stops the loading's frames the same way. Proof: hidden while
  loading, main 0 of 3, now 3 of 3; the spec 4 of 4 then 6 of 6 and 7 of 7.
- **Game: an offer's silhouette appeared half a square low** (autochess:259). `ac-appear`'s `transform: scale(0.4)` replaced the
  silhouette's own `translateY(-50%)`, so it showed 20.5 px low on a 41 px square and slid up; a tap read in those 160 ms landed on the
  square below. Its own keyframes keep the translate: 0 px now.
- Not done: shop:238 (its floor of 4 fps can't tell a slow first second out from a reading that spans the visit: propose checking the
  reading's window instead), town-chat:1367/1370, fairplay:65, alfil:247, town-street:155.
