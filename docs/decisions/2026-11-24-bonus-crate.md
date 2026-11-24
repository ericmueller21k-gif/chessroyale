# The bonus crate (Nov 24)

- **Eric's words:** "like League of Legends does this ... a crate and key combo in addition to whatever item you get ... it's a 25%
  chance, and then every crate possible that exists, even ones that have been retired, just evenly spread ... And if it requires a key,
  though, then we need to give it a key as well." Then: "flag if a crate came from another crate so ... you can't just keep crating into
  other crates." `CRATE_BONUS.chance` (0.25) in core's settings; the pool and the roll in core's `bonus-crate.ts`.
- **What happens:** every crate opening (a series crate's, a boss crate's: bought, picked at a level or won at the claw) has a 25% chance
  of a bonus crate, rolled by the server with the item's own roll (one crypto-seeded stream: the item, then the bonus) and granted in
  the same ledger op (one transaction, keyed by the open's request id: a retry answers the stored item and bonus, never rolls again).
  The crate goes into the inventory unopened, with a crate key when it opens with one (series crates do; boss crates don't).
- **The director's calls (Eric can reverse):** the pool is every `CRATES` entry and every `BOSS_CRATES` entry, each as likely, built
  from the lists (a new crate joins with no change); **not** the Welcome Crate; **not** an admins-first boss's crate, except for admins;
  the crate just opened may come up.
- **My calls:**
  - **Stored as a bonus one with no migration:** under its crate's id with a `bonus:` prefix ("bonus:winter-1" in `series_crates`, a
    `boss_crates` row whose crate is "bonus:boss-tiger"). So it's the ledger's own asset (the reconciliation, a guest's sign-in, erasing
    and the download cover it unchanged) and no column or table is added. The locker counts it with its crate's (`seriesCrates`,
    `bossCrates`) and lists how many are bonus ones (`bonusCrates`); the crate's page says "You have 2 (1 bonus)".
  - **Order:** holding both kinds, the ordinary ones open first (the player keeps their chance), then the bonus ones, which never roll.
    Two opens at once that both pick the last ordinary one: the second takes the bonus one.
  - **The Welcome Crate's own opening rolls no bonus:** the brief lists the crates that do (the regular crates, boss crates, the reward
    card's, the level choice's); the Welcome Crate is one per account with its own rules and opening path.
  - **The odds line** is the director's sentence plus a few words for accuracy (an odds disclosure must be exact): "Every opening: 25%
    chance of a bonus crate (any crate, chosen evenly) and its key if it needs one. Opening a bonus crate never gives another." The FAQ
    quotes the same line (`bonusOddsLine`) and adds what the pool leaves out.
  - **The card:** a beat after the item's card forms, a second card ("BONUS!", the crate's art, its token for a boss crate, its name,
    "+1 crate key", OK) over it on the overhaul's gold beam; the item's stage dims under it and takes no tap until OK. A pop-up over the
    stage, so nothing moves (eric.md, "Pop-up notices sit on top").
  - **Tests are steady:** where `TEST_SWITCHES` is on (local, e2e, staging) the server gives a bonus only when the request asks
    (`bonus`: true or a crate's id; the app's `?bonus=1`, `?bonus=<crate>` and the crate page's "Bonus crate" box), so every spec's counts
    stay what it set. Production always rolls and ignores the field.
- **Later:** the payments design (Nov 17, step 4) sketches a different "crate bonus" (double crates for 5 level-ups); when it's built it
  needs its own setting name, as `CRATE_BONUS` is this one.
