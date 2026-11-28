# The town paints nothing on the device (Nov 28, 2026)

Eric: "load first, then show"; "if this is Fable's recommendation, then we just do the whole thing." Phase 1c of the town's structure.

- **Now:** every picture is the build's, the sidekicks' frames too (so Rivet shows in an admin's town). The paint workers, the copy
  saved in IndexedDB and the 3 s caps are gone; decoded pages are let go once uploaded.
- **My calls:** a file that fails is asked for again twice, then "The town didn't load. Please retry." (the card we had). Fonts, crate
  items and rides wait until in or failed; only 15 s with nothing arriving ends a wait, reported. A lost context brings the loading card
  back while the files are fetched again. Painting went because `ops:report` showed no `town-baked-fallback` row.
- **Measured** (slowed phone): load and frame cost unchanged; memory outside the GPU 202 → 54 MB.
