# @phone-only: logic, server and flow tests skip the desktop project (Nov 6, 2026)

The pipeline audit (Nov 6, proposal 3): desktop was 44% of e2e time, mostly repeating game logic a computer runs the same.
The call: 168 tests in 48 specs carry `{ tag: "@phone-only" }` and the desktop project has `grepInvert: /@phone-only/`.
Tagged: powers, whole matches, lobbies, chat delivery, ledger and server answers. Kept on both: anything about layout,
fit, size, the board, home, drags and other input, figures on screen (boss-challenge's intros, king-attack), and every
guard test of docs/rules/eric.md. Desktop test time 11,449 → about 6,700 s a full run (run 943's times).
