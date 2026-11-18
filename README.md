# The coin reward: mockup (Nov 18, 2026)

Static frames from a quick HTML/canvas mock (`mock/mock.html`; it loads `coin.png` and `press-start-2p.woff2` from beside it: copy them
from `packages/app/src/coin/` and `packages/app/public/fonts/`). The game's real coin art and pixel font; the page around it is a
stand-in for the result screen. Design: `docs/decisions/2026-11-17-payments-design.md`, "The coin reward" (branch `claude/payments-design`).

- `phone-1-counting.png`: 0.5 s in: coins dropping into the pile, the counter pumping (+12), the first part shown.
- `phone-2-done.png`: the end: +52, the pile, "Play today 186/300", every part.
- `phone-3-boost-dark.png`: dark mode with a coin boost running (the x2.5 badge, the time left), +130.
- `phone-4-cap-reached.png`: past the day's play coins: "300/300 · FULL"; the win and placement still pay.
- `computer-1-done.png`: 1280 x 800: the strip under the XP box, the same width.

The strip is its own fixed box under the XP box (78 px, the XP box's height), so it covers nothing and nothing moves.
