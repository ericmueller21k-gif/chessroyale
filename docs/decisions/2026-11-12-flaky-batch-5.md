# Flaky batch 5 (Nov 12)

Main's retry-pass reds, each fixed at its cause (table in the PR). Reproduced locally with the page's CPU slowed 4x (CDP). Calls:
- **App bug:** a sprite first drawn after its sound's frame skipped that sound (the gardener's plips). Cues passed over up to 1 s
  before a first drawing now play (`LATE_CUE_MS`).
- Short-lived states (a 160 ms put, a seed's flight) are recorded as the app sets them (MutationObserver), not once per frame.
- matchmaking:22 times the fill from the queue screen; the load before it is the machine's.
- Long timeouts: about twice CI's measured time; stills-only tests keep theirs.
- A unit check keeps key listeners out of `useEffect`.
