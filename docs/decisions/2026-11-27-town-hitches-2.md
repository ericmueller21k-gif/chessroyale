# Town hitches again (Nov 27, 2026)

Eric: "town feel shorrible again"; "imagine 50+ users on"; "shut the town off in browser if u squeeze it too much".

- **Cause:** each walking frame boxed ~1 MB of floats (per-vertex calls, `Math.hypot`; a GC every 2 s), re-parsed colors (a cache
  emptying), and worked out buildings' tops as they showed; newcomers' tags were painted in frames. Fixed at those causes.
- **Report:** "Outside our code" was mostly idle waiting for the refresh: split into waiting and stalls, plus the browser's long frames.
- **Calls (mine):** pause only on a mouse device, box under 0.45 (phones 0.49+). Headless, the drawing held down to 0.27; the gray wall
  is the Colosseum's back wall at every width. More: `docs/areas/town-square.md`, "Frame report".
