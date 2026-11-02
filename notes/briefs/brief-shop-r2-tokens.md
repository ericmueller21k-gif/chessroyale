# Brief: shops round 2: boss tokens, buying a boss crate, admin test grants (Opus xhigh: stored data, fair play)

Worktree `/home/user/cr-tokens`, branch `claude/shop-tokens`, from `claude/nov2-fixes` (PR #460; merge main in when it lands,
never rebase). Push as you go.

Round 1 (merged, #458) built the shops on the town side: `packages/app/src/town/shops/` (ShopRoom.tsx, shops.ts: `buyBossCrate(boss,
way)` is a stub answering "Coming soon"; `bossHoldings`/`holdLine` show 0 and 0). The price is `BOSS_CRATE_PRICE` in core settings.
The crate and key system already exists server-side (`packages/server/src/accounts.ts`, `locker.ts`, `account-data.ts`; the app's
`screens/Crates.tsx`, `components/Items.tsx` KeyArt). Read how crates, keys and openings work today before designing.

## Eric's rules (Nov 2; recorded in notes/STATUS.md; director's calls marked (mine))
- **Earning tokens:** any boss battle, win or lose, counts once it reaches 10 of your moves or 5 minutes, whichever comes first
  *(mine)*. Which boss's token: random, equal odds over every live boss (not the Hidden Boss, not admins-first) *(mine)*.
- **A rolling 24 h window per account:** the first counted battle with no token in the window always drops one; after that 25% a
  battle, up to 3 in the window. **Decided by the server only**, never the device (fair play): the server must know the battle
  really reached 10 moves / 5 minutes (online battles: the match room knows; solo Boss alone: find what the server can trust; if
  solo can't be verified, say so in the PR and propose the safe option, e.g. solo counts only via a server-recorded battle).
- **The result screen** (victory or defeat): a square box in the style of the gambling warning box: "You got a [Boss] token!" and
  OK; the token goes to your inventory. Find the gambling warning's component and match its look.
- **Inventory:** tokens show in the inventory/profile where keys and crates show (a token per boss, with a count). Token art: the
  boss tokens drawn on `claude/boss-art` (Ginger and Blitz approved; the other 14 drawn Nov 2; check `scripts/boss-art/out/` for
  them). If a boss's token art is missing, use a plain fallback and list it.
- **A boss crate costs 3 of that boss's tokens, or 1 of its tokens + 1 crate key.** Buying is a server action, atomic (never
  spend without granting, never grant twice; double-tap and two devices safe), and gives the boss's crate to the inventory (or
  opens it as crates open today: follow the existing crate flow). Babur's crate's prizes always include his ride Balloon Pup;
  Puddles' his Mower. Define each boss crate's prize pool in settings, beside the existing crates' pools, and say what else is in
  it (keep it small: the ride plus the existing common pool, or what the existing crates do).
- **Admins:** test grants: an admin tool (where the admin menu grants things today) to give yourself keys and any boss's tokens.
  Admin settings go in the Worker's runtime variables if any are needed.
- Wire `buyBossCrate` and the holdings into the shop card: real counts ("You have 2 Babur tokens and 1 crate key."), a button off
  when you can't afford that way, and the answer after a buy.
- Inside a shop the page header says the shop's name (e.g. "Babur's Circus"), not "Town square".

## Rules you must keep
- Stored data: migrations backward compatible; no data loss on deploy; old clients keep working.
- Fair play: no client-trusted counts, randomness or timestamps for drops or purchases.
- Money: none here. No paid service. Nothing that charges.
- List every player-visible text change; changed checks old → new.

## Done means
- Server unit tests: the drop rule (first in window always, then 25%, cap 3, the window rolling), the 10 moves / 5 minutes
  threshold, the purchase (both ways, not enough, twice at once), admin grants admin-only.
- E2E: an admin grants himself tokens and a key, buys Babur's crate both ways, the counts update; the result-screen box shows
  after a counted battle (seeded so the drop happens). Run only those locally (e2e lock).
- Stills in `docs/shop-r2/` (the result box, the inventory with tokens, the shop card with real counts, after a buy).
- PR-body file `docs/shop-r2/pr-body.md`.
