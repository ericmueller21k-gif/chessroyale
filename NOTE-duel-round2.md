# Ranked 1 v 1 on a computer: MOCKUP round 2 (Nov 25, Eric's asks)

Stills only; nothing here is built. The mock is `scripts/mockup/duel.css`, put over the real screen by `scripts/mockup/duel-layout.spec.ts` (on `claude/game-layout-mockup`, which includes round 2's end page). The emblem by the rank pill and the "Ranks" pop-up are real components (round 1).

## What Eric asked → what the mock does
1. "at the absolute top of the screen should be the name and the icon": there's no title line. The opponent's strip (pawn, name, emblem, rank) is the top of the screen.
2. "the 1v1 blitz ... in between their timer and their name": "1 v 1 · Blitz 3+2" sits in that strip, just before their clock.
3. "the settings ... top right": the gear is at the screen's top right, level with the top strip.
4. "the board takes up all the vertical space": the board is the window's height minus 108 px (two 34 px strips and the padding).
5. "this chat box should just be sitting at the same height as whatever the board is": the right panel's top and foot line up exactly with the board's.
6. "a redo on how this chat box looks ... Offer a draw ... looks ugly ... where it says your move": a clean panel. The chat fills it, over one row of game actions, Offer a draw and Resign (a draw offer and its Accept / Decline would take that row). "Your move" is a chip beside your own clock.
7. The end page is the same frame with the panel's content swapped: the result, rewards, quests, Play again and Home stacked, and the chat with post-game lines. The board stays put, stepping through the moves, with ◀ ▶ in your strip.

## The board, before → after (px)
| Screen | In play | End page |
| --- | --- | --- |
| Eric's desktop 1858×1040 (100%) | 864 → **928** | 928 |
| Eric's laptop 1536×730 (125%) | 557 → **621** | 621 |
| Desktop 1920×960 | 784 → **848** | 848 |

## Stills (`stills/duel-round2/`; every file named by its size)
`duel-play-<size>-before-after.png` and `duel-end-<size>-before-after.png`, with the board's px in each label.

## Build cost (estimate)
About half a day (Opus `high`, targeted lane):
- `Duel.tsx`: the title and gear move into the strip and side column, the panel's action row, the status chip.
- `board-size.css`: the duel's room becomes 108.
- The end page's column goes from the strips to the board's own top and foot.
- `desktop-board.spec` sizes: the duel's real-screens board-gap entries go.

The other game screens (50 v 50, boss, Squads) follow round 1's NOTE.md.
