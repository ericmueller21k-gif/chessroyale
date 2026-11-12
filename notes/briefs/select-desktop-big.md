# Boss Battle select on a computer: the pawn and boss 3x, up to 4x (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale). Effort: high (layout plus the stage's sizing rule).
Read CLAUDE.md, .claude/LESSONS.md, docs/areas/bosses.md (Boss Battle select) and docs/decisions/2026-11-12-boss-select-six.md first.
The code: packages/app/src/components/BossSelect.tsx (`placeOnStage`, the `.bs-stage` section), packages/app/src/characters/boss-select.ts
(STAGE_PAWN, STAGE_PAWN_FIGURE, STAGE_RISE), the `.bs-*` rules in packages/app/src/styles.css. Sizes on the stage are in `cqi` of the stage.

Eric, Nov 12, with a screenshot of the computer (about 1490 x 1090 window; on branch claude/director-notes,
notes/mockups/2026-11-12-eric-desktop-select.png): "can we make this different on desktop like 3X the pawn and boss size even 4[x]".
His screenshot: the grid (two rows of ten) on top, then a big empty middle, then the stage (your pawn on its platform with the two
invite circles, VS, the boss on his, names, MEDIUM), START at the bottom. The pawn and boss are small (about 130 px tall).

What to build (computer only: the desktop layout's breakpoint as the screen already uses; phones stay exactly as they are now):
- The stage's pawn, its platform and invite circles, and the picked boss with his platform, about 3x today's size, growing toward 4x
  when the window has the room (a 4K screen or a tall window). Pick the size from the room between the grid and START, so the screen
  still never scrolls and nothing overlaps (the grid, the speech bubble above the boss's head, the names, MEDIUM, START).
- Keep the pixel art crisp (no blurry scaling) and the boss's bubble fully on screen above his head.
- Names, VS, MEDIUM and its dots can grow a bit with the stage so they don't look tiny next to the figures; START stays as it is.
- Same rule for every boss: check Jefferson (tall), Big Boy and Alfil (wide), Chub & Chirp (the one in Eric's still).
- Windows to check: 1490 x 1090 (Eric's), 1536 x 864 (a laptop), 1920 x 1080, 2560 x 1440 and 3840 x 2160 (4K), admin and guest.

Tests (light-to-targeted lane): one focused check added to e2e/boss-select.spec.ts on the desktop project: at 1536 x 864 and 1920 x 1080
the pawn's and the boss's figures are at least 2.5x their phone-at-428 height... or better, at least 2.5x today's computer size (measure
today's first and write the numbers down), no page scroll, the bubble above the boss's head, START on screen. Run that spec locally
(both projects, since phones must not change) and the unit tests you touch; typecheck. If Playwright looks for chromium_headless_shell-1194:
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`.
Stills (one set, at the end) on branch stills/select-desktop-big: 1490 x 1090 first (Chub & Chirp, like Eric's), then 1536 x 864,
1920 x 1080, 3840 x 2160; and one phone 428 x 746 to show it's unchanged. Aim for about an hour.

Branch claude/select-desktop-big from origin/main; push at each real step. A ~5-line decision note
docs/decisions/2026-11-12-select-desktop-big.md (Eric's words, what changed, the sizes chosen); update docs/areas/bosses.md.
When done: push .pr-body.md (what changed, player-visible changes, changed checks old -> new, tests run), then .done as the last commit.
Don't open a PR or wait on CI: the director does. American English. Never include model names in commits.
