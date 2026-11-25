# Boss music: mono 64 kbps, fetched during the town's loading bar (Nov 12, 2026)

Eric (Nov 11-12): "reduce the size [of the songs]... why not just add all of the songs to the town when you load into the town?...
loading music in the loading bar"; of three 30 s cuts of Jefferson's theme: "Mono 64 sounds... it's totally fine".

- **Mono 64 kbps, rendered from the source** (`handoff.py` on `claude/trailer-v2`, mono by default now): the five themes 9.8 MB -> 5.0 MB,
  decoded half (a 2-minute theme about 46 MB -> 23 MB). Lengths and pads unchanged, the level within 0.1 dB, the loop seams checked
  (no offset, no step at the loop point).
- **The town's loading bar fetches every theme** (`preloadMusic`: fetched, never decoded; the service worker keeps them), from the bar's
  start, beside the painting. Decoding is unchanged: when a battle, a room or a splash needs it, and `forgetTheme` lets it go after.
- **Calls made:** the last 15% of the bar is "Loading music…" (`MUSIC.townShare`), shown only for what hasn't landed once the town is
  built, and the town waits on it at most 3 s (`MUSIC.townWaitMs`): about 7 s of fetching in all with the painting, enough for 5 MB at
  6 Mbps; slower, the town opens and the rest lands in the background (a theme not in yet is fetched as it's needed, as before).
  Music or Sound off: nothing fetched, no step. Each piece once a visit; low fetch priority, so the town's own files go first.
