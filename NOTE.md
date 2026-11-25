# One shared computer layout for every game screen: MOCKUP (Nov 25)

Brief: `notes/briefs/real-screens.md`, part 3. Stills only: nothing here is built. Code: `claude/game-layout-mockup`. The Ranks pop-up and the emblem by the rank pill are real components there; the layout is a stylesheet, `scripts/mockup/mock.css`, put over the real screens by `scripts/mockup/game-layout.spec.ts`.

## The rule (every landscape computer screen; a phone is unchanged)
- **The board as tall as the window allows:** the window's height minus 108 px. That leaves room for a 34 px bar above the board, one below it, and the page's padding. Like chess.com, only a name bar sits above and below the board. The 1 v 1 and the 50 v 50 change most; Squads too; the boss screen already came close.
- **The top bar holds the title:** "1 v 1 · Blitz 3+2" and the gear sit in the opponent's strip, by the clock. The 50 v 50's status line is its top bar. Squads' round line is its top bar. A boss battle's bar becomes one line, 46 px tall (portrait, name, level and meters side by side).
- **One right panel, 340 px wide**, from the top bar down. The status and buttons go at its top. Squads' tiny boards and the 50 v 50's pick line move into it. The chat fills the rest of the panel down to the board's foot and never collapses.
- **A rank emblem by every name** (the 1 v 1 strips). **Tapping a rank opens "Ranks":** Wood to Radiant, each tier's five division emblems (5 is the lowest, 80 RP each), then Pearlescent (top 500 players) and Transcendent (top 100). The tapped player's division is lit, with their words above: "Kasparova: Illustrious 4 · 67 of 80 RP". One line explains how RP moves.

## The board, before → after (px)
| Screen | Laptop 1536×730 (target 622) | Desktop 1920×960 (target 852) | Phone 390 |
| --- | --- | --- | --- |
| 1 v 1 | 557 → **621** | 784 → **848** | 360 (unchanged) |
| 50 v 50 | 557 → **621** | 784 → **848** | 360 (unchanged) |
| Boss alone | 602 → **621** | 832 → **848** | 360 (unchanged) |
| Squads | 499 → **621** | 728 → **848** | 360 (unchanged) |

(621 and 848, not 622 and 852: the board is a whole number of device pixels, a multiple of 8.) With this rule, every game screen meets the "real screens" board check from `claude/real-screens`. The known-gap entries for boards would go.

## Stills (`stills/`; every file named by its size)
`<screen>-laptop-1536x730-before-after.png`, `<screen>-desktop-1920x960-before-after.png` (the board's px in each label), `<screen>-phone-390x844-unchanged.png`, and `ranks-popup-{laptop-1536x730,desktop-1920x960,phone-390x844}.png`.

## Open points for Eric
- **The boss bar as one line** is the biggest look change. Each boss's meters and props (Puddles' seeds, Babur's pump, the tower's taller bar) would need checking in it. Alternatively, boss screens keep their 61 px bar, for a 15 px smaller board (602 at 1536×730).
- Squads' "Board 2 · starting soon" line: proposed for the top bar's middle (hidden in the mock).
- The 50 v 50's pick timer ("4s · 10:00") and the gear share the top bar's right end. On a narrow board they'd need ordering.

## Build cost (estimate: Opus `high`, each its own PR, targeted lane)
- 1 v 1: title and gear into the strip, `--bd-room` 108, the panel's column, the emblem and Ranks (also from the ladder's rows and profiles' rank cards). About half a day.
- 50 v 50: the status line as the top bar, the pick line into the panel, the chat to the foot. About half a day, plus updating `board-layout.spec` / `desktop-board.spec` numbers.
- Squads: the tiny boards into the panel, the board line into the top bar. About half a day.
- Boss battles: the one-line bar across every boss (boss kit, `boss-side`/`boss-bar` specs, the tower's bar). About a day; the riskiest.
- In total about 2.5 to 3 helper-days. The "real screens" known-gap tables shrink as each lands.
