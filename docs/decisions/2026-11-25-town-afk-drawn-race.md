# town-afk: the zzz read cleared before the next frame (Nov 25, 2026)

- Main's run 45599472319 (#947), desktop: `town-afk.spec.ts` "after the zzz wait…" passed only on its retry. At line 83, Ann's zzz read
  cleared on Bo's screen, then a second read said the last frame still drew it.
- A test race, not a drawing bug. Bo's copy of Ann's zzz is set as the server's answer comes in (here-net.ts `beat` → `applyHere`), and
  `drawn` is the last frame's (`r.zzzList()`). The town redraws everything every frame (Town.tsx `frame` asks for the next one every
  time; render.ts `draw` resets the zzz list and draws again): no frame is skipped when nothing moves. Locally, with Bo's page slowed
  6x (CDP), the read that first saw the zzz cleared still had it drawn in 5 runs of 5, and the next read had it gone each time.
- Fix: the spec polls `[zzz, drawn]` together, as it already did for the zzz coming on (both reads: old lines 66-67 and 82-83). No player-visible change.
  A rule in `.claude/LESSONS.md` (Tests).
