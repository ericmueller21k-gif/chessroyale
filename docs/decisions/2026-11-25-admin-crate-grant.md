# Admins can grant themselves crates (Nov 25, 2026)

- Eric: "how do I get more crates? ... I'm literally out of crates and I don't see a way to generate more." The admin test grants gave
  keys and boss tokens, not crates.
- Added: the Crates tab's admin box has a crate picker (every series crate and boss crate) and "+5 crates" (`POST /api/locker/grant`
  `{crate, crates}`, up to `BOSS_TOKENS.cratesGrantMax` 10 at once, admins only, one ledger op per request like the other grants).
- A series crate still opens with a key ("+100 crate keys"); a boss crate opens without one.
