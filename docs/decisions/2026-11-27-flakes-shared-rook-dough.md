# Two flakes on main, fixed at the cause (Nov 27, 2026)

- **Smudgy's hidden rook, shared floor:** no game bug. Another boss's rook move of it already ends the disguise (`followRook`, his
  unmasking next), as his own would; solo and online share the runner. The e2e failed when Grex's engine picked that rook. Call:
  under `?paint` the other bosses never move it (`runner.paintHeld`). Unit tests: `several-bosses.test.ts`.
- **Don Dough's e2e:** no stall (the 503s are instant; the device re-checks). The test's knight shuffle got mated. Call: `playOne`
  never leaves him a mate in one.
- Other remembered squares: audited Nov 18 (`followMove`/`followBoard`, kit invariant 8); the Stranger's burn is a tile.
