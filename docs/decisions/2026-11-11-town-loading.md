# The town's loading screen (Nov 11, 2026)

**Eric (Nov 11, after `/town?report` on his iPhone 14 Plus: 12 atlas resets and 4,353 uploads in 28 s warm):** "I have no issue
with doing a loading screen for the town... even if it takes 3 or 5 seconds... loads it all in at once and then it stays there if
you go in and out of buildings."

**What changed**
- The street town opens on a loading card ("Building the town…", the boss loading card's look, its bar real progress). First it
  paints every picture the town can show (`render.ts` `warm`): every box's sides, back and front frames and each a step darker,
  every roof for all four headings, every home's, boss's, prop's, statue's and sidekick's frames. Then it uploads them for good
  (`paint-gl.ts` `keep`, `kept`), tallest first, onto an atlas made once as deep as they need. The town's frames start after that.
- The atlas: one array texture, 10 kept pages (2,952 pictures, 97% full) plus 2 spare pages: 12 × 16 MB = **192 MB**, the same on a
  phone and a computer (pixel art: the size doesn't depend on the device's ratio). Only the spare pages ever start again. Before,
  the limit was 6 pages, and space taken by a picture that was let go (the sweep) or that changed size was never given back. That's
  why Eric's resets kept coming.
- **The pictures the town draws in 2D (tags, signs, the bubble, text, clouds, frames) are made in memory** (`art2d`,
  `willReadFrequently`) once WebGL draws. Uploading a canvas drawn on the GPU made the browser finish the GPU's frame first: 30 to
  120 ms an upload, measured headless. That fits Eric's "Outside our code" and gaps. Now it's about 0.3 ms.
- A sidekick sheet that fails to load doesn't hold up the load (it waited 3 s for one).
- **Rooms stay behind the door's fade.** Going in measured about 2.0 s from the tap (the walk to the door, the 0.6 s zoom, the
  room). The room's one long frame (about 170 ms) falls under the black. Loading every room up front would download and paint all
  their art and keep it for the whole visit. Each room also has its own canvas and painter, so its pictures can't go on the town's
  atlas ahead of time.

**Calls made**
- 192 MB of GPU memory on a phone: fine for an iPhone 14 Plus (6 GB). A 3 GB phone is the one to watch. If one struggles: drop
  the darker steps or share identical pictures (about 15% of them are duplicates).
- In software rendering with `--use-angle=swiftshader`, a 12-page texture cost every frame (20 to 30 fps against 60). With the
  browser's default headless flags (what e2e uses) it didn't (30/30/20 before and after). No special case kept: a GPU doesn't touch
  memory it doesn't sample.
- e2e: `townReady` waits 40 s (was 20).
