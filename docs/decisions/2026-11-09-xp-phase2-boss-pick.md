# XP phase 2: every 10th level's boss crate, picked (Nov 9, 2026)

The design (approved): "You pick which boss's crate from the live bosses."

- **A pick is a count** (`wallets.boss_picks`, ledger kind `boss_pick`), not a crate: it waits until chosen. `POST /api/locker/pick
  {crate, request}` spends one and puts that boss's crate into your boss crates (a `boss_crates` row), in one op keyed by the app's
  request id (a retry or a double tap picks once). The crate then opens as any boss crate: no tokens, no key (already paid for).
- **Which bosses:** the live ones (`pickableBossCrates`: playable for players; not the Hidden Boss, not one in the game for admins first).
- **On screen:** a "Boss crate choice" row always in the Crates tab (Eric's "nothing hidden": greyed, "None to choose", when there's
  none), "Choose your boss crate" when one waits; its page lists every live boss's crate with its token, each a tap, and says
  "Babur's Boss Crate is in your inventory." after.
