# Music at 128 kbps. Opus, medium (audio data with a loop-point check). Light lane

Branch `claude/music-128k` from main. About 1 h. Eric, Nov 16: "128 is fine for the game. But we wanna keep the lossless files tho for
YouTube" (the lossless masters aren't in the repo; the director asks Eric where they live. Don't add any audio master to the repo).

1. Before changing anything, tag the current main `music-192k` (lightweight tag, pushed): the 192 kbps files stay reachable.
2. Re-encode every file in `packages/app/public/music/` to 128 kbps CBR MP3 (ffmpeg libmp3lame, same sample rate and channels).
3. **The loops must stay seamless.** `music.ts` loops each theme between `pad` and `pad + loopSeconds` (`themes.json`'s one global `pad`:
   the encoder delay). ffmpeg drops the old file's delay when decoding (gapless info) and LAME adds its own when encoding: check, per
   file, that the new file decoded lines up with the old decoded (cross-correlate; offset 0 samples, or report it), and that the
   samples at `pad` and `pad + loopSeconds` match the old file's. If the offset isn't 0, fix the encode (or `pad`) so it is; never
   per-file hacks. Intros and the town's solos too.
4. Report sizes before → after (total and the five biggest). Light lane: `check` and the PR's e2e; the music unit tests.
5. `.pr-body.md` (short: what changed, sizes, the loop check's result, changed checks old → new) and `.done`. Commits end with the
   `Claude-Session:` line only, no model names. No PR.
