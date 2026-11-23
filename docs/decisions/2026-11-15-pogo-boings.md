# The pogo: a boing per square, on the hop's take-off (Nov 15)

- Eric: "get rid of the fade in and fade out ... every time ... you go from one square to the next, it should be a boing ... they're
  going to overlap ... the boing sound needs to line up with the frames"; of the samples, "Yeah, I like A".
- Changed: the pogo is a `steps` ride (no loop, fade, hold or `rate`): each step your walker begins plays the next of its 4 boings as
  its own one-shot (cut as sample A, into `boingo-pogo.wav`), on the audio clock. The dozer's loop is untouched. Replaces 2026-11-15-pogo-rate.
- Calls: on **take-off** (`on: "takeoff"`), the first move frame off the ground, 22.5 ms into a 90 ms step: a spring's boing is its
  release, its 245 ms ring fills the air time, and it's the jump moment nearest the press (landing is 65.5 ms in). The moment is read
  from the drawn frames, so a redraw stays lined up. The 4 boings run on across taps (a tap plays 2), so the tune keeps going.
