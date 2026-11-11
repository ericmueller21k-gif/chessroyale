# The iPhone's move tick plays as the finger lifts (Nov 11, 2026)

Eric (iPhone 14 Plus, Safari 27): "why doesn't my phone vibrate on the spot where I move? I thought we added that."

**Why.** As the Nov 9 note predicted: a tap-tap move is made as the second press goes *down*, and in the HTML spec (and
WebKit) a touch's `pointerdown` isn't a user gesture; only its lift (`pointerup`, `touchend`) is. The iPhone's tick (the
hidden switch toggled through its label) plays nothing outside a gesture. The pick-up tick and a drag's drop already fire
on the lift, which is why those ticked and the move didn't.

**What changed.** On the switch path (an iPhone or iPad), a tick made by a press going down is kept
(`hapticAtPress`) and played as that same finger lifts (`hapticAtLift`, from OwnBoard's `onUp`): same pointer, same
square, within `HAPTICS.holdMs` (350 ms; held longer, no tick, as with the pick-up). That covers every press-down tick:
a tap-tap move, a premove placed by tap, a tap into Hollow's dark (both ways in). The move itself still happens on the
press, unchanged. A promotion's pick is a button `click` (after the lift: a gesture), so it stays as it was. Android
(`navigator.vibrate`) ticks at once, as before.

**Other ways it could fail silently, checked:**
- The switch element: made on the first tick, synchronously, in the same call that clicks it (as the known working
  versions of the trick do: they make, click and remove one each time). Nothing to fix.
- The label click: synchronous inside the handler, never after an await. The extra ticks of a pattern (`iosTicks`,
  3 at most, `iosTickGapMs` 90 ms apart) are timers: WebKit carries a tap's gesture into short timers, but outside a tap
  (a boss moment) none plays. The board's ticks are one pulse each, so no timer is involved for them.
- Settings → Vibration greyed: only where `hapticWay()` is null. Safari 27 on an iPhone has the `switch` attribute
  (17.4+) and says "iPhone", so it shows on. (If Eric's showed greyed, that's a different bug: tell us.)
- The iPhone itself: the switch tick needs Settings → Sounds & Haptics → System Haptics on. Only Eric's iPhone can
  confirm the fix.

## Update: no tick at all (same day)

Eric: the pick-up tick (already on the lift) is silent too, with System Haptics on. So the trick itself played
nothing. We can't test an iPhone here, so three changes against the likeliest causes, plus a log for his phone:
- **The switch is rendered now**, invisible (opacity 0, 1 px, no taps), not `display:none`: a switch with no box may
  not play its haptic. The label still wraps the input; the `switch` attribute is set before it's attached.
- **An iPhone tick asked for in a pointer event waits for the tap's own `touchend`** (or `click`), within 600 ms, and
  plays inside it. `pointerup` from a touch may not count as a gesture in WebKit; `touchend` and `click` surely do
  (the same rule as starting audio). Pointer events come before the touch's own touch events, so it's the same tap.
  A tick asked for inside a click (the promotion pick) plays at once. The lift rule above stays.
- **`?haptics=debug`** (kept on that device until `?haptics=off`, since an installed app can't easily take a URL):
  a small log, bottom left, of the way picked and what the device reports, and for each tick: wait or play, the event
  it ran in, the label clicked and the switch's state after. If the log shows "label clicked in touchend" and still no
  tick, iOS 27 no longer plays it for a script's click, and there's no other way into the iPhone's haptics from a web
  page.
