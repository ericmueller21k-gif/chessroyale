Title: Folio's sanctuary: the Folded House's inside, the paper turtle, its challenge intro and the crumple into the match

**Lane: full e2e** (add the `full-e2e` label): it touches the shared intro (`town/shops/intro.ts`, `challenge.ts`), the match's start
(a new transition) and `packages/core/src/crates.ts` (a shared foundation, so CI runs every spec anyway). Folio is live: this goes to
everyone.

## What changed
- **Go in on Folio's Folded House** leads into its sanctuary (Eric, Nov 5: "a peaceful sanctuary … some stained glass, some fountains,
  some bonsai plants … paper folding … something kind of abstract"), the art of `claude/boss-art` at e7e08bcf copied in as Hollow's
  was (`shops/folio-art.ts`, `shops/paper-kit.ts`): a room that is a page still being written (folded and colored in the middle,
  ink sketch and ruled paper toward the edges, a margin line, lines writing themselves in on idle loops), stained glass whose colored
  pools lie on the paper and drift slowly (a sine, one clock), a ribbon fountain, folded bonsai, crane strings, rising pages, screens,
  a desk, a pale folded-paper ceiling. Its battle spot is the clean page (`page-` floor tiles; `isFloor` and `marksOf` take them).
- **The paper turtle keeps the shop** (`characters/sidekicks/folioturtle.ts`, baked), behind the low counter at the art's spot; not a
  town bot (Pleat, the frog, stays Folio's kid). **Folio's Boss Crate** with the Paper Crane, its ride, in `BOSS_CRATES`.
- **Folio's own challenge intro** (the art's timeline; `CHALLENGE_FEEL.folio`, `folioTimes`, `folioAt`, `folioCues`, `FolioArt`):
  you both walk on to the clean page's marks, its line, you both step back a pace, the stools then the table fold up from flat sheets,
  a paper plane brings the board and drops it, the board unfolds on the table and the game's board comes in over it, Folio bows and
  says a quiet line (one of five at random). Folio is drawn in its room from its intro's own frames, with the art's warm see-through
  shadow (not the town figure's near-black).
- **The crumple into the match** (Eric's idea; `shops/crumple-gl.ts`, `shops/crumple.ts`, `shops/snap.ts`): the screen as it is (the
  room's canvas and the page's DOM over it) crumpled over black into a ball (WebGL, 16 × 34 on a phone, the art's shading and paper
  back), held while the battle loads, the match screen taken the same way and swapped in on the ball, opened, its creases fading
  over the live match. No WebGL or any failure: a fade through black. Never stuck: every wait has a limit.
- **Sounds:** five new ones synthesized in Folio's pack (`folioSet`, `folioGlide`, `folioLand`, `folioBall`, `folioOpen`); its own
  fold, unfold and rustle for the rest. All pass `boss-sounds-finite.test.ts` and Folio's loudness test.
- Every other shop and boss intro is unchanged; the town's frame loop is unchanged. The room and the intro load only when you go in.
- Decision: `docs/decisions/2026-11-05-folio-home.md` (Eric's words, the director's calls, the art's calls, the calls made here, the
  numbers). Area pages: `docs/areas/town-square.md` ("Folio's sanctuary", "Folio's challenge"), `docs/areas/shop.md`.

## Player-visible changes (everyone)
- Folio's Folded House's card: its name and **Go in** (its Shop and Coming soon gone, as on every home you can go into).
- Inside: the header "Folio's Folded House"; the turtle's card **"Shopkeeper"** with **Talk**; the crate's card **"Folio's Boss
  Crate"**, its prizes **"Paper Crane"** ("Mythic ride") and "+ 24 Beta Crate items, Common to Epic", **"3 Folio tokens, or 1 Folio
  token + 1 crate key"**, **"You have 0 Folio tokens and 0 crate keys."**, **"Buy with 3 Folio tokens"**, **"Buy with 1 Folio token
  + 1 crate key"**, and once bought **"Folio's Boss Crate is in your inventory."** The crate in the inventory: "Folio's Boss Crate",
  "Paper Crane, and the Beta Crate's hats, shades and gear". The chat's dark words (the day tone) inside.
- Challenging Folio from the town now goes in with it (as every boss with a home's inside): the confirm **"Challenge Folio?"**,
  **"You'll fight Folio in Boss Battle, then come back here."**, Fight / Stay (it was "Leave the town square?" and the Boss raid
  screen); the town's chat posts "… challenged Folio!" as for the others.
- Its line in a bubble over it: "Every game is a draft. Shall we write one?" (its battle's entrance line). **New text, its quiet
  lines** (one at random each time, in a bubble over it for 2.4 s):
  - "It's quiet in here. Stay as long as you like."
  - "Come back whenever it gets too loud out there."
  - "Take your time. The page will wait."
  - "Think as long as you need. I'm in no hurry."
  - "Quiet helps. So does a clean page."
- Into the match: the crumple (above) instead of the default flash and wipe.

## Changed checks (old → new); none guards a rule in `docs/rules/eric.md`
- `packages/app/test/shop-room.test.ts`, "only Babur's, Puddles', Alfil's, Big Boy's, Timber's, Dash's, Hollow's, Wrangler's,
  Jefferson's and Ginger's homes have an inside" → "… Jefferson's, Ginger's and Folio's homes have an inside"; its list gains `folio`.
- `packages/app/test/boss-challenge.test.ts`, "every boss whose home has an inside has an intro (… Ginger and Dash their own …)" →
  "(… Ginger, Dash and Folio their own …)"; `withIntro` gains `folio`; `expect(introOf("folio")).toBeNull()` →
  `toMatchObject({ custom: true, name: "Folio", line: "Every game is a draft. Shall we write one?", layout: "across", clear: 2.3 })`
  and its `chant` has 5.
- `packages/app/test/boss-challenge.test.ts`, "the layout: across for all ten today" → "all eleven"; its list gains `folio`.
- `packages/app/test/town-bots.test.ts`, the baked sheets: `files` 20 → 21; `artId` gains `folioturtle: "sidekick-folio-turtle"`.
- `packages/server/test/boss-tokens.test.ts`, the crates and their rides: gains `["folio", "folio-crane"]`.
- `e2e/town.spec.ts`, "a boss's card: 'Challenge alone', then 'Leave the town square?' …": its boss Folio → Sawyer (a live boss whose
  home still has no inside): `toBabur(page, "folio", …)` → `"sawyer"`, the card "Folio" → "Sawyer", the town sound `/^folio(Murmur|Hum)/`
  → `/^sawyerRev/` (his select sound), "You'll fight Folio in Boss Battle." → "You'll fight Sawyer in Boss Battle.", the picked tile
  and `.bs-name` "Folio" → "Sawyer". Every check kept.
- `e2e/town.spec.ts`, "Folio's Folded House: a tap walks you there and opens its card …": `card.getByText("Coming soon")`
  `toBeVisible()` → its buttons `toHaveText(["Go in"])` and "Coming soon" `toHaveCount(0)` (a home you can go into now).
- Not edited, and run: `e2e/town.spec.ts`, "a home's door (Eric, Nov 5): a tap on Folio's house …" (it guards Eric's door rule and
  uses Folio's house, whose card now has Go in): passes on phone and computer.
- (`packages/core/test/crates.test.ts`'s `NO_CRATE_YET` keeps `folio-crane`: it means "in no regular crate", as Ginger's sled.)
- New, nothing removed: `packages/app/test/shop-folio.test.ts` (23: the room's walkable squares, the clean page and its marks, the
  counter and the keeper, lights at every placement and the pools' drift, the turtle's sheet, the crate, the intro's beats in order
  and its 14–16 s total, the stools before the table, the board before the quiet line, a quiet line from the five, every cue a sound,
  Folio and you clear of your stools, the crumple's mesh (as the art's maths), its clock, that it always ends in the match, and its
  no-WebGL fallback); `e2e/shop.spec.ts` "Folio's Folded House …" (the room, the turtle's card, the crate, the edge); `e2e/boss-
  challenge.spec.ts` "challenging Folio in the town …" (the 2D town and the WebGL town) and "challenging Folio with WebGL off …".

## Tests run
- Unit: the new file and every touched one (shop-folio, folio-wired, boss-sounds-finite, sounds-source, boss-challenge, shop-room,
  shop-hollow, town-bots, crates, boss-tokens): pass. `npm run typecheck`: pass.
- e2e, locally (phone and desktop): Folio's shop test; Folio's challenge on the 2D town and the WebGL town (`?gl=1`); WebGL off; the
  three `town.spec.ts` tests above: pass.
  Specs CI should run: all (full lane).
- **Frame rate** (headless Chromium, software WebGL; a shared machine, so runs vary): the crumple on a phone 30–60 fps crumpling,
  30–60 held, 20–60 opening; at 4x CPU 15–20 crumpling, 7–10 held (the battle loading under it), 9–15 opening; its own work 0.2–0.6
  ms a frame (1.3–4 ms at 4x). The shop on a phone: Folio's 41.8 fps against Hollow's 42.6 (4x CPU: 13.2 against 12.8).

## Stills and GIF (`docs/folio-home/`)
- `door-*.png`, `page-*.png`, `fountain-*.png`, `counter-*.png`, `edge-*.png`: phone and computer.
- `intro-phone.gif`: the whole intro from the game on a phone (390 × 844), from the Fight tap to the match, the crumple included
  (Chrome's own frames at their real times, 15 fps).
- `intro-quiet-desktop.png`: one frame on a computer (its quiet line, the board on its table).
- `crumple-phone.png`, `open-phone.png`: the crumple and the open on a phone.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
