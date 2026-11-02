# Brief: shop interiors, round 1 (Babur first, Puddles' room too)

Worktree `/home/user/cr-shop`, branch `claude/shop-interiors` (from main 2432e74). Opus high. Push as you go.
Round 2 (a separate helper at xhigh) does the stored data: boss tokens, the crate purchase, admin test grants.
Your round is the town side, with the purchase stubbed behind one clear seam.

## What Eric asked for (Nov 2)
- Walk up to Babur's home (the circus tent, `town/houses/tiger.ts`). A card says **"Go in"**, like the other walk-up cards.
  Tap it: the camera zooms in on the door, then fades into the tent's interior. "Go out" by the door brings you back
  outside at the house's door, with the same fade.
- Inside: the room from the art branch, about 20 x 20 squares. You start in the **Close** camera, the third-person one.
  The town's −/+ zoom buttons switch between Close and the town's zoomed-in camera. The numbers are in
  `docs/decisions/2026-11-02-shop-zoom.md` on `claude/boss-art`; put them in settings (`TOWN_FEEL` or a new `SHOP_FEEL`).
- The **Shopkeeper**: a copy of the boss's kid sprite (Babur: Stripes; Puddles: Drizzle) behind the counter, with a name
  tag "Shopkeeper" over its head, and an idle animation. Walk up and a talk card appears. Talking opens the shop card:
  **"Babur's Boss Crate"**, with the crate art, its prize list (always including his ride, Balloon Pup), and the price:
  **3 Babur tokens, or 1 Babur token + 1 crate key**. Show what you hold. The buy buttons go through one function
  (`buyBossCrate(boss, way)`); in round 1 it is a stub that says "Coming soon". No server change in this round.
- **Puddles' greenhouse:** same code, with his room. The shopkeeper is Drizzle, the crate is "Puddles' Boss Crate", and
  the prizes include his ride if he has one (check the rides; if he has none, say so in the PR body). The pond garden is
  drawn as a plan from above: lay it flat on its squares (`d: 8` in its layout). The tall plants lie flat with it for now.
- Every other house: no "Go in" yet.

## The art (branch `claude/boss-art`, read-only for you; copy into `packages/app/src`)
- `scripts/boss-art/out/house-shop-babur/house-shop-babur.ts`, `.../house-shop-puddles/house-shop-puddles.ts`.
- Summaries: `scripts/boss-art/out/shop-{babur,puddles}-nov2.md`. Decisions: `docs/decisions/2026-11-02-{building-interiors,
  shop-zoom,bigger-showpieces}.md`.
- The mockup that shows how a room should look in the game: `scripts/boss-art/shop-view.ts` and the `view-close-*.png`
  stills. Match them. Eric approved that look.
- Pieces, layout, lights and pools are exported; the hoops are `SHOP_BABUR_FIRE_HOOPS_A/_B/_C`, and the lights carry a
  `piece` field. Look at how the house art reached `town/houses/*.ts` before, and do it the same way.
- Animated pieces loop (the fire hoops, the pond, the palm, the fountain, the crate idle).
- The battle circle is floor art only for now. No battles inside yet.

## Rules you must keep
- Nothing hidden, nothing shifts: the town outside is unchanged except the "Go in" card at those two houses. The town's
  bots and other players don't enter. Inside is just you; other players aren't shown in this round. *(mine: say so in
  the PR)*
- Phone first (390 x 844), then the computer. Joystick and tap-to-walk work inside; you can't walk through solid pieces,
  the counter or the walls; the door gets you out.
- Performance: the interior loads lazily (only when you go in), like the rides.
- Player-visible text, listed in the PR body: "Go in", "Go out", "Shopkeeper", "Babur's Boss Crate", "Puddles' Boss
  Crate", the price line, "Coming soon", and anything else you add.

## Done means
- Unit tests for the room logic (walkable squares, the door, the shopkeeper's talk range), plus one e2e in
  `e2e/shop.spec.ts`: walk up, Go in, start in Close, talk, the crate card shows the price and Balloon Pup, then Go out.
  Phone and computer. Run only those locally (`flock /tmp/claude-0/e2e.lock`).
- Stills: phone at the door card, inside at the counter, the shop card; Puddles' room with the pond. Plus a GIF of
  going in. Put them in `docs/shop-r1/` (about 10 images, small).
- A PR-body file at `docs/shop-r1/pr-body.md`. Push. Don't open a PR.
