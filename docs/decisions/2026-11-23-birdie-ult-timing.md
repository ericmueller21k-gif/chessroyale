# Birdie's ult timed to his music (Nov 23, 2026)

Eric (via the music helper): "Birdie doesn't play his move right away. He basically times his next move to the exact moment where ... the
end of that little ... clip ... right when the train light kind of hits and then he transforms"; "we can have him add a line to say".

- **The drop is the impact.** His fall's moment (`birdieFall`, as the crowd's move that filled his meter lands, after QUEEN SLAIN! if it took
  his queen) starts his ult's piece (`birdie-ult`) `BIRDIE_ULT.pieceAt` (300 ms) in, so its drop, 14.815 s later (`introMs`, kept equal to
  themes.json's `introSeconds` by a test), lands on the cutscene's last `approach` frame (the train on him, its `hit` cue): `impactAt`
  ≈ 15.1 s. The cutscene starts its own time to that frame before it (`fallAt` ≈ 9.9 s); before that he waits in his spot and says his
  line (`lineAt`, on the piece's first whistle). The light is whole 200 ms after the impact (`hitHoldMs`, as before): the transformation.
- **His reply waits for the whole cutscene** (his thinking holds through it, about 17.6 s), so it comes after the drop, never before: a
  move under the cutscene would be hidden. The crowd's clock doesn't run (his turn). Every device the same, music or not.
- **A reload carries it on.** The lobby sends when his turn's moments began (`BirdieView.turnAt`, with the drop) in every message of that
  thinking; solo keeps it (`KeptGame.moment`, at the beats `birdieTurnBeats`) and asks its engine for his reply only 2.5 s before the hold
  ends (`soloMoveLeadMs`: a kept game holds his move once played, which would skip the wait). Birdie's screen plays from `turnAt`, not
  from first sight, so a rejoin in the wait or the cutscene resumes it there (with no `turnAt`, an older server: skipped, as before).
- **Music** (`src/birdie-music.ts`, App's musicBattle): his theme until his fall (the piece decoded ahead), then `birdie-ult` with
  `dropAt` from `turnAt`; after it (or a battle joined later) `dropAt` 0, so his theme's loop alone, never the piece again. A Battle Tower
  floor keeps its one theme.
- The cutscene's art is Eric's approved third pass (fd5cad0ec on `claude/boss-art`); the headlights' light now follows its lamps, head-on
  down the middle of the track. The timings are unchanged.
