# Bonus crate: 25% of openings also give a random crate (and its key) (Nov 24). Opus xhigh, FULL lane (odds, inventory grants)

Eric (Nov 24): "like League of Legends does this ... sometimes for every single box you can actually get ... a crate and key combo in
addition to whatever item you get ... 25% of the time ... why don't we just do it's a 25% chance, and then every crate possible that exists,
even ones that have been retired, just evenly spread about the percentage ... any boss crate, any rare crate ... it just picks one at
random. And if it requires a key, though, then we need to give it a key as well."

STARTS AFTER the crate-open overhaul (`claude/crate-open-build`) is merged: it builds on its reveal. Start from origin/main then.
Read CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/shop.md`, the crate code (`packages/core/src/crates.ts`
`CRATES`, boss crates, `packages/server/src/locker.ts`/`ledger.ts`/`boss-tokens.ts`, `api.ts`'s open route), the payments design
(`docs/decisions/2026-11-17-payments-design.md`: odds shown, loot-box notes).

1. **The roll (server only):** every crate opening (every kind: the regular crates, boss crates, a crate from the reward card or the level
   choice) has `CRATE_BONUS.chance: 0.25` (settings.ts, Eric's words) of a bonus, rolled by the server with the same secure roll as the
   item, in the same ledger operation (one op, idempotent: a retried open never grants twice, never rolls twice).
2. **The pool:** every crate that exists, retired ones too, each equally likely: every `CRATES` entry and every boss's crate. Director's
   calls (record them; Eric can reverse): **not** the Welcome Crate (one per account, its own rules); **not** the crate of a boss still
   admins-first (`BOSS_ADMIN_FIRST`/`adminFirst`: it would leak unreleased content), except for admins; the crate just opened may come up.
   The pool is built from the lists, so a new crate joins it with no change.
3. **The grant:** the bonus crate goes into your inventory (boss crates into your boss crates, regular ones where crates go), plus one crate
   key when that crate opens with a key. **A bonus crate can't roll a bonus** (Eric, Nov 24: "flag if a crate came from another crate so ... you can't just keep
   crating into other crates"): the crate is stored as a bonus one (a flag or a separate count per crate kind: the smallest change to the
   existing storage; a migration if needed), and opening it never rolls the 25%. Holding both kinds of the same crate, the ordinary ones
   open first (the player keeps their bonus chance), the bonus ones after. The flag survives a guest signing in and the account export. Guests: as their inventory works today. `PAUSE_REWARDS`/the shop's kill switch: as the open route already does.
4. **Shown:** after the item's reveal card, a second card "BONUS!" with the crate (its art) and "+1 key" if given, in the new open's style
   (a short beam in gold; reuse the overhaul's pieces). Each crate's odds panel adds one plain line: "Every opening: 25% chance of a bonus
   crate (any crate, chosen evenly) and its key." The FAQ's crates section says the same. The inventory updates at once.
5. **Stored data:** use the existing tables (crate keys, boss_crates, inventory); if anything new is stored, it's a migration: full lane.
   Account data export (`account-data.ts`) still covers it.
6. Prove: typecheck; server unit tests (the 25% over many seeded rolls within tolerance, the pool's members and exclusions, the key only
   when needed, idempotent retry, one op); app tests for the bonus card; the crate e2e specs plus one focused check (`?test` switch or an
   admin test path forcing the bonus: the BONUS card shows and the inventory gains the crate and key). Label `full-e2e`. Decision note;
   area page (shop.md). Stills on orphan `stills/bonus-crate` (never under docs/). PR body in `.pr-body.md`. `.done`, push, stop. Then the
   director runs an independent review. Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
