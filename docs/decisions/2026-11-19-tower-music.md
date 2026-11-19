# The Battle Tower's music (Nov 19)

- Eric, on the final version: "this is the one, nice work"; his brief: "keep the sound more muted overall, it's the background battle tower music".
- `tower-loop.mp3` (themes.json `tower`, a loop with no intro, `pad` 0.5, 160 s) plays in the tower's lobby, its floor room and every floor's battle, in place of the bosses' own themes. The normal music volume and mute apply.
- Call made: the handoff's 192 kbps MP3 re-encoded to 128 kbps (Eric, Nov 16: "128 is fine for the game"; every theme is 128), checked same length and aligned at 0, `pad` and `pad + loopSeconds`. The `.ogg` isn't shipped (no other theme ships one).
- Call made: a floor's battle uses the tower's key as its `boss` (music.ts `towerBattle`), so a floor's next boss carries the theme on with no restart; back from a floor's battle, the room's theme restarts as the room shows (Town.tsx `towerBack`).
