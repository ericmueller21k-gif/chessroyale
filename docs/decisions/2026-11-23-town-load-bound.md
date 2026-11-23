# Chess Town's load check: a multiple of a reference job, not 8 s (Nov 23, 2026)

**Eric (Nov 23):** "I'm assuming tho this is when we actually had it load assets and not build them as we ran around? So that's
normal… certainly see if there's an optimization, however note the rule I had was load first in order to not have slow FPS."

**The trace** (iPhone 13, CPU 4x slowed, tap to first frame, 3 runs each, the same machine):

| main | runs | median | pictures |
|---|---|---|---|
| Nov 22, `9e0dce2e` | 17.2, 16.4, 16.5 s | 16.5 s | 2,787 |
| Nov 13, `d077aaeae` (the PR that set 8 s) | 15.4, 13.6, 15.7 s | 15.4 s | 2,777 |

7% apart: the town didn't get slower. The 8 s bound was never met on a slowed phone since the loading screen (Nov 11) paints every
picture before the first frame (Nov 14's note: 19.8 s). About 13 s of the load is that painting (`render.ts` `warm`); uploading
is 0.5 s; the network is idle.

**What changed.** The check times a fixed job in the same page under the same slowing (`townRefJob` in `e2e/perf.spec.ts`:
picture-like pixel grids built as strings, read into pixels and put on canvases, about 1 s; the middle of three), and the load must
stay under **20** of them. Measured over 10 runs at 4x: 13.4 to 18.1 (median about 16; an admin's town runs a little higher),
and 14.5 to 16.7 at 2x where the load took half as long, so it follows a change in the town, not the machine. 20 is the median and
a quarter, about 10% over the highest run: a regression of a quarter shows, and a run that reads high once may be noise (re-run
it, as CI's flake rule). The longest task the same way (the
director, Nov 23): it was under 2 s, and measured 1.5 to 1.97 s here; now under **2** reference jobs (measured 1.3 to 1.83 at 4x
and 2x, about 1.5 the middle: a third over it, as 2 s was over 1.5 s). The loading screen's 3 s stays in milliseconds (2.1 to
2.8 s here).

**Optimizations looked at (time-boxed, Eric's rule kept: everything painted on the loading screen).**
- Identical frames in a loop (a third of the bosses' town frames) sharing one canvas: 2,787 → 2,620 pictures, but the time didn't
  move (16.1 s) and the atlas kept its 12 pages. Not kept (simple beats flashy).
- A CPU profile has no hot spot: self time spread over many small functions, none above about 8%.
- Roofs are shared per design already; their "repeats" are the same canvas handed on again, not painted twice.

**Ideas for later** (each its own job): paint in 2 to 4 workers (`OffscreenCanvas`) to use the phone's other cores; keep the
painted atlas between visits (IndexedDB), so only a first visit paints; bake the pictures at build time and download them (a few
MB, against Nov 1's choice to drop baked sheets); make the darker copies from the light ones' key grids instead of composing
them again.
