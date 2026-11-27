# Town hitches again: the frame's own work, a busy town, a squeezed window (Nov 27, 2026)

Eric: "town feel shorrible again"; "its not the residents lol … imagine 50+ users on"; "shut the town off in browser if u squeeze it too much".

- **Cause:** the walk's frames did ~6 ms of our JS plus ~1 MB of garbage each (minor GCs every 2 s): floats boxed through per-vertex calls,
  `Math.hypot`, a color cache that emptied every few frames. With 55 others, newcomers' tags were painted in the frames. Fixed at those causes.
- **The report:** "Outside our code" was mostly the idle wait for the next refresh: now split into waiting and stalls, plus the browser's long frames.
- **Calls (mine):** the squeeze pauses only on a mouse device, box under 0.45 (phones are 0.49+). The drawing itself didn't break down to
  0.27 headless; the gray wall is the Colosseum's back wall at every width. Details: `docs/areas/town-square.md`, "Frame report".
