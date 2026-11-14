# The town loads fast again, and the loading screen says what it's loading (Eric, Nov 14)

Effort high (loading, network, perf). Targeted lane. New branch `claude/town-load-fast` from `origin/main`. Read
`docs/areas/town-square.md`, `.claude/LESSONS.md`, `packages/app/src/town/Town.tsx` `loadTown` (~2370-2425), `music.ts`
`preloadMusic`, `MUSIC.townShare`/`townWaitMs` (settings), the service worker (vite.config.ts; #708 made `/music/` part of its version).

Eric (computer, right after #708 went live, screenshot `notes/ref/eric-town-loading-2026-11-14.png` on `claude/director-notes`: the
town's "Building the town…" bar stuck near 20%): "christ it's taking forever. Also what happened to it showing what it's
downloading? Like loading the sprites, music etc."
#708 (merged today) made every boss theme stereo 192 kbps: the town's music preload went from 14.8 MB to 44.4 MB, fetched from the
start beside the town's own painting; the service worker's version now changes on a music deploy (a first open after it re-caches).

1. **Measure first:** time from tapping Chess Town to its first frame, on a computer and a phone, on a fast connection and throttled
   to 6 Mbps / 40 ms (Playwright network emulation), first visit (empty cache), a second visit, and the first visit after a deploy
   (new SW version). Compare main before #708 (`git checkout 140180e0`) with now. Say which costs what.
2. **Fix the cause.** Likely: the music's 44 MB competing with the town's own files for the network, and/or the "Loading music…"
   wait. The town must never wait on boss music: fetch the town's own files first; start the music preload only once the town is
   built (in the background, after the first frame, low priority); drop the "Loading music…" wait (`townWaitMs` -> 0, or remove the
   step), since a theme not yet in is fetched as its battle needs it (keep that path working, and the battle's own loading screen).
   Also check the service worker doesn't make a first open after a deploy re-download everything before the town can start (it
   should serve the page and the town's files without waiting on the music).
3. **Say what's loading:** the loading screen names its current step under the title ("Loading the town's pictures…",
   "Building the town…", and anything else that really takes time), with the bar moving through them. If an older version showed
   such steps (Eric remembers "loading the sprites, music"), find it in git history and match its wording.
4. Numbers before/after in the PR body (the table from 1). One check in an existing spec: the town's first frame doesn't wait for
   the music (music requests pending at the first frame are allowed). Typecheck; the touched e2e (`ci-select`).
Push at each real step; `.pr-body.md` (cause, fix, numbers, player-visible, checks old -> new); `.done`. No PRs, no CI waits, no model
names in commits (end commits with the Claude-Session line only). About an hour.
