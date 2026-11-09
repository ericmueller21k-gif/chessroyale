# Dash's pop-off happens twice a battle (Nov 8, 2026)

- **Eric (Nov 8):** Dash's pop-off ("I gotta pop off", ten fast smacks, the love line) should come twice a battle, not once.
- **Call:** two turns drawn from the battle's seed (`popOffTurns` in `packages/chess/src/bosses/dash.ts`), both in
  `dashPopOff.from`..`to` (8 to 20, unchanged), at least `gap` (6, new in settings.ts) of his turns apart, in order.
- **Same code path:** each one sets the existing `dash.popOff` state on its turn; the second replaces the first, so the
  moments, the hold on his move, and the server's think time all work as they already did for one.
- **Lines:** each pop-off draws its line by its own key, so the second may repeat a line (a 1 in 3 chance). Kept simple: no memory of the first's line.
- **Test switch:** `?power=popoff` now gives his second and eighth turns.
