# The Stranger's storm: "before his first sword" read on the canvases' clock too (Nov 28, 2026)

Main's run 46121764433 flaked: `stranger.spec.ts:98` saw the rift "before his first sword". Not a player-visible slip: the rift, the
ring and his sword sprite all draw on the shared frame loop, which reads the time a few ms (tens on a busy runner) after the screen's
own `useFrameNow`, so in the slam's frame the canvases show the slam and the rift's first crack while the scene's `data-stage` still
says "draw". The call: fix what the test reads (his first sword on either clock: `__stormArt.sceneT`, the canvases' scene time, at
`STORM_SCENE.fireAt` or later), not the app. One clock for every frame would touch every boss's animation for a one-frame difference
nobody sees ("simple beats flashy"). A rift drawn even 300 ms early still fails the check.
