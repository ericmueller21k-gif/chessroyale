# The town's farthest zoom (Nov 13, 2026)

- Eric: "can we actually add one more zoom out so it zooms out to that old one that we used to have ... That should be the furthest zoom you can go."
- Changed: a fifth street zoom step (`TOWN_FEEL.streetZoomSteps[4]`): the old town's camera zoomed out (the overview with `zoomOutHeight`,
  `zoomOutBack`, `zoomOutPitch` and `zoomOutRim` applied in full), phone and computer. The town still opens at step 2.
- Call made: the park's automatic step out stops at the overview (`streetZoomParkMax: 3`); the farthest step is only ever chosen with −.
