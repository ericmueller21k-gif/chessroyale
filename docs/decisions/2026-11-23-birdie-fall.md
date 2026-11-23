# Birdie's ultimate: the Fall into Armored Birdie (Nov 23, 2026)

- **When:** once a battle, when the material he's lost since the battle's start reaches `fallLost` (9: pawn 1, knight 3, bishop 3, rook 5,
  queen 9). His meter shows lost / 9; after the fall it stays full and dimmed (`spentMeterShown`).
- **The cutscene** is built like Moo's Full Moon: a moment while he "thinks", over the board, the game paused, skipped on a rejoin
  (`BIRDIE_CINEMATIC`). The art landed (`claude/boss-art`), so it's wired, not a placeholder; drawing it on load cost about 0.9 s on a
  phone, so it's baked into one sheet (`birdie-cutscene.png`; rebake with `scripts/bake-birdie-cutscene.ts`, a test checks it matches).
- **Armored Birdie** is his kit's powered twin (`p_` loops) from the cutscene's hit on. ~~No train after~~: replaced the same day by
  Eric's answer (the train goes on, his brain much stronger): `2026-11-23-armored-birdie.md`.
