# Six more boss themes wired (Nov 13, 2026)

- Eric playtested and found Ginger's music missing; the music session had six finished, Eric-approved themes not yet handed over
  (stills/trailer-v2 767fc64b, boss-music/).
- Changed: sawyer, timber, moo, clown (Boingo), gingerbread (Ginger), alfil: their MP3s in `packages/app/public/music/` and their
  `themes.json` entries, as the folder's README says. No code change.
- Cost: about 5.9 MB more fetched during the town's "Loading music…" step (every theme but the Hidden Boss's is fetched there). Kept as
  is for now; fetching boss themes lazily (as the Hidden Boss's) is the fix if the town's load time suffers.
