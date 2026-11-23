# Birdie's Train ride and Birdie's Boss Crate (Nov 23). item-builder lane, Opus xhigh, FULL lane (odds)

Read: `.claude/agents/item-builder.md`, CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`, `docs/areas/shop.md` ("Rides", "A boss's
crate, sold inside the boss's home", "Boss tokens, crate keys and buying a boss crate"), `docs/areas/town-square.md` ("Rides", "Birdie's
Station"), and `notes/designs-birdie.md` on `claude/director-notes` (Eric's answers: "His ride").
Model it on Smudgy's crate with the Brush Ride (`git log --oneline origin/main --grep="Smudgy's studio"`: 2f22db9d, 712db1f4) and the
ride copy-ins (shop.md: "Where the drawings came from"). Birdie's Station landed in #904 (his lobby, the bartender as `Shopkeeper`, Talk
says a placeholder line "with no crate yet").
Branch: `git fetch origin main claude/boss-art && git checkout -B claude/birdie-ride-crate origin/main`. Push work in progress at each step.

1. **The ride, "Birdie's Train"**: copy in as drawn from `claude/boss-art` at e764383d (`scripts/boss-art/out/birdie-train-ride/`: side,
   views and trail; the redraw Eric picked, long and low, NOT the tall steam engine of 0cd6b0a3). Mythic, in the `ride` slot, like every
   ride. Its item description: the drawing's ("A little yellow diesel that always runs on time. The tracks are imaginary; the punctuality is
   not.") unless it reads wrong in the game. Measure it (`npx tsx scripts/measure-rides.ts`), its scale (`RIDES`) as the others. Its sound:
   if rides have one (#878 "ride sounds"), reuse Birdie's synthesized train run (`birdie-sounds.ts`), never a new file. Call: its
   colorway default; Yellow matches his train (Eric: "same color scheme"); follow how other rides set theirs and say what you chose.
2. **Birdie's Boss Crate**, sold by the bartender exactly as the other boss crates are (the Shopkeeper's card: the crate, its prizes with
   the ride first, `BOSS_CRATE_PRICE`, what you have, buying real through the server). Its prize table built the way the other boss
   crates' are (the same tiers and odds rules: ride the only Mythic, the same %; no new odds of your own). Admins first: listed only where
   other admin-first bosses' crates are (shop.md: Dash's rule); his tokens drop only once he's live (`dropBosses` already excludes him: check).
   The bartender's Talk opens the crate as the other keepers' do; his placeholder lines stay as lines.
3. Prove: typecheck; the unit tests (shop, crates, tokens, the server's crate buy); the shop and birdie-home e2e (phone, and computer for
   layout); `npm run preview:items -- out.png items=<ride id>` for the fitting sheet; one still per platform (the bartender's card with the
   crate, the ride on your pawn in the town) on `stills/birdie-ride-crate` (never docs/). Area pages, a short decision note,
   `e2e/areas.json`. `.pr-body.md` (what changed, odds table as it is, changed checks old → new), `.done`, push, stop. Don't open the PR.
   Full lane: the director adds the `full-e2e` label and an independent review after you finish.
If anything needs Eric (a price, odds that don't fit the template), write `.question`, push, stop.
Commits end with only `Claude-Session: https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR`.
