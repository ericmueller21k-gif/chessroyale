# Boss music: mono 64 kbps, fetched during the town's loading bar (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (audio pipeline plus the town's loading step).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/bosses.md ("Music"), docs/decisions/2026-11-11-boss-music.md,
packages/app/public/music/README.md, packages/app/src/music.ts and sound.ts, and the town loading screen (PR #639, Nov 11:
docs/areas/ for the town; the loading bar that preloads the whole town atlas and the rooms).

Eric's words (Nov 11-12): "reduce the size [of the songs]... why not just add all of the songs to the town when you load into the
town?... loading music in the loading bar". He listened to three 30 s cuts of Jefferson's theme and picked **mono 64 kbps**
("Mono 64 sounds... it's totally fine"). The themes use about 2% side energy, so mono loses almost nothing, and it halves the
decoded memory (a 2-minute theme about 46 MB stereo -> 23 MB mono).

## 1. Every theme at mono 64 kbps, rendered from the source, not re-encoded
- The themes are made in code by `scripts/reel/music/` on branch `claude/trailer-v2` (`handoff.py <folder>` writes the MP3s and the
  handoff's themes.json; `song_k/l/m/n/o.py` per theme). Re-encoding the current MP3s would shift the audio by the encoder's delay and
  move the loop points, so render from the source: give the handoff a mono 64 kbps output (make it the default, so later songs come
  out the same) and rebuild grex, bigboy, hollow, folio, zebra. Push that change to `claude/trailer-v2` too (its own commit).
- Keep `pad`, `introSeconds`, `loopSeconds`, the level (lufs, peak) as they are, and check the loop seam: no click or gap at the
  loop point (render the seam to a WAV and look at it; music.test.ts already checks the plan).
- Total size now about 10 MB for 5 themes; expect about 5 MB.
- If rendering from the source is impossible in your container, say so and stop before re-encoding; report back.

## 2. Fetch every theme during the town's loading bar; decode only when needed
- During the town's loading screen, add a "Loading music" step that fetches (only fetches: no decode) every theme in themes.json, into
  the HTTP cache / service worker, so a battle's or a room's theme never waits on the network. Respect the Music switch: Music off
  fetches nothing (as today). The bar's step must not make the town wait long on a slow network: give it a fair share of the bar and
  never block entering the town on it for more than a few seconds (say what you chose and why).
- Decode stays as today: when a theme is needed (the battle's pick, walking into a boss's room, the splash), and `forgetTheme` still
  lets go of the decoded audio after a battle, so at most one decoded theme sits in memory.
- `vite.config.ts` precache: themes stay out of the precache.

## Tests and lane
Targeted lane: town loading and boss music. Update music.test.ts for the new step; one focused e2e check in an existing spec (the town's
loading spec, or grex.spec.ts): the town load fetches each theme once, decodes none; Music off fetches none. Typecheck; the unit tests
of packages/app you touch; the touched specs locally under the shared e2e lock (if Playwright looks for chromium_headless_shell-1194, run
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`).
No frame-rate run unless you change the town's frame loop. One still of the loading screen at 428x746 showing "Loading music".
Aim for about an hour and a half.

Branch claude/music-mono-preload from origin/main; push at each real step. Decision note docs/decisions/2026-11-12-music-mono-preload.md
(about 5 lines: Eric's words, what changed, calls made); update docs/areas/bosses.md "Music" and the music README.
When done: push .pr-body.md (what changed, player-visible changes, sizes before -> after, changed checks old -> new, tests run), then .done
as the last commit. Don't open a PR or wait on CI: the director does. American English. Never include model names in commits.
Never commit copyrighted reference audio (Eric's Mega Man 9 / Chrono Trigger MP3s), only our own renders.
