# The town loads fast again, and its loading card names its step (Nov 14, 2026)

**Eric (computer, right after #708's stereo 192 kbps music went live; the bar stuck near 20%):** "christ it's taking forever. Also
what happened to it showing what it's downloading? Like loading the sprites, music etc."

**The cause.** Since Nov 12 the town fetched every boss theme from its loading bar's start, beside its own painting, all at once
(22 fetches), and then waited up to 3 s more on "Loading music…". #708 took that music from 14.8 MB to 44.4 MB: about a minute at
6 Mbps, all of it in the town's way (its code, its sidekicks' sheets). And the service worker kept the music in the version's cache,
which every deploy drops, so the first visit after any deploy fetched it all again.

**What changed**
- The town never waits on music: `preloadMusic` starts `MUSIC.townPreloadAfterMs` (2 s) after the first frame, in the background,
  one piece at a time at low priority (`fetchPieces`; a fight's `ahead` too). The "Loading music…" step and `MUSIC.townShare` /
  `townWaitMs` are gone. A theme not in yet is fetched as its battle or room needs it, as before (the battle's own loading screen and
  the splash's hold unchanged).
- The service worker keeps the music in `brc-music`, a cache every version shares, each piece with its contents' hash
  (`MUSIC_HASHES`, written by vite.config.ts); a piece is answered from it only while its hash is the build's. A deploy fetches
  again only the songs it changed; activation drops the pieces the build no longer has or changed. (Music no longer feeds the
  version's hash: its own hashes change the worker.)
- The loading card: title "Loading Chess Town…", the bar, and under it the step it's on (`LOAD_STEPS`, the boss card's
  `.boss-loading-note`): "Loading the town's pictures…" (painting, and waiting for the sidekicks' sheets), then "Building the town…"
  (uploading them to the GPU).

**Calls made**
- No older version named steps on the town's card (git history: only "Building the town…" and Nov 12's "Loading music…" as its title),
  so the wording is the brief's, and the boss card's layout (title, bar, note) is matched.
- The town's code itself (its chunk, before the card can show) still shows the plain page: a card there would have to match the
  town's box on every layout (the phone's bar, the computer's frame) before the town's styles are in. Measured below; left for now.
- 2 s after the first frame: the town's first moves (your ride, the players near you) get the link first.

**Measured** (tap Chess Town → first frame, headless, 6 Mbps / 40 ms; the full table is in the PR): first visit 10.1 → 7.1 s on a
computer, 26.0 → 19.8 s on a slowed phone; the open after a deploy that changed the music 7.3 → 4.6 s and 21.3 → 17.4 s. The rest is
the town's painting, unchanged.
