Title: Dash's Kicks in the town, Tick in the town, Dash's sneaker store (admins first)

## What changed
- **Dash's Kicks** (the art branch's `house-blitz`, 144 x 134, its sign, neon lights and pools; `town/houses/blitz.ts`) on a free 3 x 3
  plot at **(4, 34)**, beside Timber's Lumber Lodge in the west. The art's note pictures it beside the circus tent and the lodge, but those
  stand far apart on the map; a search of every free plot (plain board, no path, off the park, the apron and the square, its roaming ring
  clear) found none that keeps the map's 8 to 10 squares any more, and (4, 34) keeps the most: 7.1 to Boingo's, 7.2 to Moo & Moon's, 7.3
  to the lodge, 7.6 to Big Boy's. The hanging sneakers' pole is in the picture's east column, on the store's own (solid) plot, four open
  columns from the lodge. Dash roams in front of it; his chip shows his face (cap and face).
- **Admins only, exactly as Timber's lodge** (Dash is in `BOSS_ADMIN_FIRST`): the store, his roaming, his chatter and Tick are in an admin's
  town only (`ADMIN_TOWN`); a player's town is unchanged (the plot is open ground). His crate is listed in the Crates tab to admins (or
  whoever holds one), not in the FAQ; the server posts no town-chat line for his challenge (all of this was already generic since #472).
- **Tick** in the town (his sheet baked in #476): walks with the bots in an admin's town after Rivet, rated **1850** (Dash's sim, 0.15,
  ties Sawyer's 0.15, Chip 1900, under Puddles' 0.17, Drizzle 1700: between Bishop Bo and Chip, off the hundreds), "Dash's sidekick".
- **Dash's shop** (the art branch's `house-shop-blitz`; `town/shops/blitz-art.ts`, its room still and review strips left there): "Go in"
  from the store's card (its name and Go in only), **Tick the Shopkeeper**, "Dash's Boss Crate" in `BOSS_CRATES` with his ride, Cheetah
  Shoes, first; the crate at `SHOP_BLITZ_CRATE_AT`; `SHOP_BLITZ_MARKS` (his try-on mats) passed as Timber's are; the halfpipe (4 x 2)
  stands up whole (`RoomArt.upright`); the day tone; a store's ceiling (the mockup's white tiles, and its light panels drawn each frame cut at the highest wall top on
  screen, so none ever shows through the gaps between the side walls' pieces or over a wall, at any zoom or camera place: the
  director's review); the further-out
  starting zoom, as every home. Tick stands on the counter's middle squares as Rivet does, but is **drawn half a square back and west**
  (`at` [9, 1.5]): a low tortoise with his head out front on his right, at Rivet's spot only the clock on his shell showed over the 30 px
  counter (its shoe boxes hid his head); now his head and clock show.
- **His challenge is offered** (from his card in the town, played in his store): the **default intro** until his own (round 3): his line,
  the table pops in, the flash and the wipe (his whoosh), the battle (Boss alone, Dash), and back to town. **No God King attack was drawn
  for him** (round 1), so through the swing's beat he stands in his idle; his art faces left with no attack to say so, so his intro
  carries `facesLeft: true` and the room turns him to face you.
- Decision: `docs/decisions/2026-11-03-dash-home.md`. Area pages: `town-square.md`, `shop.md`.

## Player-visible changes (admins only while Dash is admins first)
New text:
- The store's name: "Dash's Kicks" (its sign, its card, the shop's header, its chip "Go to Dash's Kicks").
- Dash's card in the town: "Dash", one of his select lines (already in the game), "Challenge alone"; his bubble's lines are his select
  lines.
- Tick's tag and card: "Tick (bot)", "Dash's sidekick", "Rating 1850", "Play Tick (bot) · 1850"; in the shop "Shopkeeper".
- The crate's card: "Dash's Boss Crate", "3 Dash tokens, or 1 Dash token + 1 crate key", "Cheetah Shoes", "You have N Dash tokens and N
  crate keys.", "Buy with 3 Dash tokens", "Buy with 1 Dash token + 1 crate key", "Dash's Boss Crate is in your inventory."; the Crates
  tab's row "Dash's Boss Crate", its blurb "Cheetah Shoes, and the Beta Crate's hats, shades and gear".
- The challenge: "Challenge Dash?", "You'll fight Dash in Boss Battle, then come back here.", his line "Yo yo yo! Dash in the building,
  fam!" (his entrance's first).
- The town chat's chatter: Dash "Dash's Kicks is open, fam. Fresh pairs!", "New drop just landed. No cap."; Tick "Tick is almost there.
  Almost.", "Tick yawns. Slow and steady!".
For players: nothing changes.

## Frame rate (eric.md, the town square)
Main (9dc41d67) against this branch, both built and served by wrangler, the camera held on the store's square (4, 33), headless, 5 s of
frames with everyone round walking, the medians of four runs taken in turn (fps; ms a draw by `__townBench`):
- phone 390 x 844: player 55.9 (1.17 ms) on main, 56.8 (1.30) here; admin 54.4 (1.02) on main, 53.3 (1.00) here with the store drawn;
- computer 1440 x 900: player 59.2 (1.51) / 58.4 (1.33); admin 58.5 (1.16) / 59.1 (1.56).
No difference beyond the noise (the machine was shared). A player's town draws what main's does; an admin's adds one house, one boss and
one bot. Nothing new per frame on the hot path (the drawing code only gained Dash's map entries).

## Stills (`docs/dash-home/`)
`town-kicks-day-phone.png`, `town-kicks-day-desktop.png`, `town-kicks-night-phone.png`, `town-kicks-night-desktop.png` (the town round the
store, by day and at night with the neon; Dash sent behind it so its front shows), `counter-phone.png`, `counter-desktop.png` (at the
counter with Tick), `halfpipe-phone.png`, `halfpipe-desktop.png` (the halfpipe, its skateboard rolling).

## Tests
- Unit: `packages/app/test/town-dash.test.ts` (new: an admin's town: the plot was free plain ground, its roaming ring on plain board off
  the square, no path; the pole on its own plot with open ground east of it; its neighbors; walkable all round, nothing cut off; Tick
  after Rivet, his door, Dash's start); `town-bots.test.ts` (Tick's entry, rung and baked sheet's frames, he shows over a 30 px counter;
  a player's town has no store and no Tick); `shop-room.test.ts` (Dash's room: the halfpipe's 4 x 2, the props, the lane, the marks,
  Tick's squares and draw spot, the crate's place; the crate's words; the ceiling panels cut at the wall tops at any width); `boss-challenge.test.ts` (his intro, his marks, his walk in, his
  stance clear of the stools); `town-chat.test.ts` (chatter); `town-timber.test.ts` (its new neighbor); server `town-chat.test.ts` (no
  line for his challenge, start and finish through the API), `boss-tokens.test.ts` (his crate's ride). All pass; typecheck passes.
- e2e (both projects, locally, under the shared lock): `e2e/shop.spec.ts`, "Dash's Kicks (Nov 3)…": a player's town has no store and no
  Tick; as an admin, the store's card is its name and Go in, inside zoomed out, Tick's card and Dash's Boss Crate with Cheetah Shoes.
  `e2e/boss-challenge.spec.ts`, "challenging Dash in an admin's town…": his card, the confirm, in with him onto his mats, his line, the
  table, the swing's beat with no attack, the wipe, the battle is Dash's, Leave back where you stood. Passed on phone and desktop.

## Changed checks (old → new; none guards a rule in docs/rules/eric.md)
- `boss-challenge.test.ts`: "every boss whose home has an inside has an intro (Alfil, Big Boy and Timber their own, Babur and Puddles the
  default)": `["alfil", "bigboy", "gardener", "tiger", "timber"]` → "… Babur, Puddles and Dash the default", with `"dash"`, and a check of
  Dash's intro; "the layout: across for all five" → "all six", Dash in its loop; `ROOMS`, `TABLES` and `LAYOUTS` gain Dash's; "once the
  stools are in, no figure near the floor is in front of a stool": the boss's facing `kit.kingAttack?.facesLeft` → the attack's, else the
  intro's `facesLeft`; its attack's feet `kit.kingAttack!` checked for every boss → checked where the kit has an attack, with a new check
  that only Dash has none.
- `shop-room.test.ts`: the rooms gain Dash's; "only Babur's, Puddles', Alfil's, Big Boy's and Timber's homes have an inside" →
  "… Timber's and Dash's" (`"dash"` added); the crates' words and the shops loop gain Dash's.
- `town-bots.test.ts`: `HOME_FILE` gains `dash: "blitz"`; Rivet's test: `expect(ADMIN_BOTS).toHaveLength(1)` → `toHaveLength(2)`.
- `town-chat.test.ts`: "names the fifteen kids … (Rivet, Timber's, Nov 3)" → "names the sixteen kids … (Rivet, Timber's, and Tick,
  Dash's, Nov 3)", Tick added.
- `town-timber.test.ts`: `expect(HOMES).toHaveLength(15)` → `16`; the lodge's nearest neighbors `[["clown", 7.8], ["moo", 8.5]]` →
  `[["dash", 7.3], ["clown", 7.8], ["moo", 8.5]]`.
- `boss-tokens.test.ts` (server): the crates' rides gain `["dash", "cheetah-shoes"]`.
- `town-chat.test.ts` (server): gains Dash's challenge posting nothing (added, nothing changed).

## Lane
Targeted (screens and the town's world, a small intro field), boss content. `packages/core/src/crates.ts` (his crate) is a shared
foundation, so the PR's e2e runs every spec.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
