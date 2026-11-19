# Battle Tower: its music (Nov 19). Opus, medium. Light lane (an asset and data, wired as the boss themes are)

Eric approved it (Nov 19, on the final version: "this is the one, nice work"; his brief: "keep the sound more muted overall, it's the
background battle tower music"). The files: branch `stills/trailer-v2`, folder `tower-music/` (`tower-loop.mp3` 192 kbps, `tower-loop.ogg`,
`themes.json` with one entry `tower`, `README.md`). A loop with no intro, like Chandy's and Babur's: `pad` 0.5 s, loop between `pad`
and `pad + 160.0` s. Read CLAUDE.md, `packages/app/src/music.ts`, `packages/app/public/music/README.md`, and how a boss home's room and a
boss battle pick their theme (`town/shops/shops.ts`, music.ts). Branch `claude/tower-music` from main.
- Add the loop to `packages/app/public/music/` (the mp3; the ogg only if the other themes ship one) and its entry to the themes data,
  under the tower's own key (the home id is `tower`).
- It plays in the tower's lobby, its floor room and during a tower floor's battle (in place of the bosses' own themes: it's the
  tower's place theme). The game's normal music volume and mute settings apply as to every theme.
- One focused check in an existing spec or unit test (the tower's rooms and a floor's battle pick `tower`). Area page battle-tower.md:
  one line. Decision note: five lines (Eric's words). Done: `.pr-body.md` (under 25 lines) and `.done`; push and end. No PRs, no CI waits.
