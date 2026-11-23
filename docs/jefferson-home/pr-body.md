Title: Jefferson's warehouse and his challenge intro (the dealer in the corner, the moving crew, Giraffe Gallop's crate, the crew intro)

# Jefferson's warehouse and his challenge intro (Nov 4)

Jefferson's Fireworks gets an inside: a shady firework warehouse run by giraffes. The shady dealer giraffe keeps the shop in his
corner, Jefferson's Boss Crate sells Giraffe Gallop, and the crew work the floor (a scissor lift and a forklift on their loops, which
wait while you stand in their way). Challenging him now plays his own intro: he hollers, the crew stop work and come round the table,
your floor tile lifts you level with the board, and his wipe of sparklers and fireworks takes you to the battle. The art is from
`claude/boss-art` at 0e4f6482. Jefferson is live, so this goes to everyone. Decision note:
`docs/decisions/2026-11-04-jefferson-home.md`. Area pages: `docs/areas/town-square.md` and `docs/areas/shop.md`.

## What changed
- **The warehouse** (`town/shops/grex-art.ts`, with its shared `warehouse-kit.ts`): a 16 × 16 floor (`SHOP_GREX_FLOOR`, a floor's
  shape as Hollow's cave, but not a cave), pallet racking all round, four high-bay lamps lit at every placement, the battle spot's
  hazard zone with his red plate and your lift's plate as its marks, and the board already standing on a stack of crates. Its roof is
  dark steel trusses (`roof: "warehouse"`), outside the door the night lot, and the chat uses the day tone. Its tall roll-up door goes
  see-through over you just inside it.
- **The dealer** (`characters/sidekicks/dealer.ts`, baked into `town/sidekicks/dealer.png` and `sidekick-sheets.ts`) stands in the
  north-east corner by the taped SHOP sign, facing west (new `ShopDef.flip`), drawn at his art's size (new `ShopDef.tall`: 79 px).
  There is no counter: a tap on him, his crate on the floor or the corner behind him means talk (new `ShopDef.talk`). He is not a town
  bot.
- **Jefferson's Boss Crate** (`BOSS_CRATES`, `boss-grex`) holds **Giraffe Gallop** (`jefferson-giraffe`, already a ride). It shows in
  the Crates tab and the FAQ for everyone.
- **The crew** (`town/shops/grex-crew.ts`, from baked sheets: `scripts/bake-grex-crew.ts` → `town/shops/grex-crew/*.png` and
  `grex-crew-sheets.ts`): two sparkler leaners under the NO SMOKING sign, the clipboard guy and the dozer stand at their places, and
  you can't walk through them. The scissor lift shuttles along row 5 and the forklift moves its pallet from the floor to the shelf and
  back, a square every 620 ms (`SHOP_FEEL.crew`). Each machine looks at the next square and the one after it before it steps. If you
  (or any figure) stand there, it waits, and it goes on once you step away. Machines and the floor pallet block your walking where they
  are: a tap walks you round them, and one moving into your way stops you. No server state: each client runs them from its room's clock.
- **His intro** (`challenge.ts` crew beats, `crewAt`, `crewTimes`, `crewCues`, `CHALLENGE_FEEL.crew`; `intro.ts` loads
  `grex-intro-art.ts`, which also re-exports his moves from `characters/grex-intro.ts`; ShopRoom draws it). It runs about 13 s from the
  marks to the wipe:
  - you both walk on to the marks; his call (one of four at random) in the big bubble
  - he hollers; the crew stop: the machines park where they are, their guys step off, the dozer wakes with a snort
  - he waves them over; all seven walk round the table's north side to a ring behind it and watch
  - your floor tile rises on its piston and lifts you 32 px, level with the board; the crates creak as it locks
  - his brag, his God King attack, then his wipe (fireworks, sparkler trails, a wall of sparkler fizz)

  He stands and you ride your lift; nobody hops back (no stools). The board on its crates is the intro's from the walk in, the same
  picture where the room's stood. Every cue plays a sound of his. Ten new synthesized sounds: `grexShout`, `grexStep`, `grexSnort`,
  `grexHiss`, `grexClunk`, `grexCreak`, `grexCreakSoft`, `grexRocket`, `grexPopSoft`, `grexBang`. After the match the crew are on
  their loops again.
- `town/world.ts` `Walker` gains `peek()` and `halt()` (used only by the warehouse).

## Player-visible changes and new text
- Jefferson's Fireworks' card: its name, then **"Go in"**. "Shop" and "Coming soon" are gone.
- Inside: the header **"Jefferson's Fireworks"**. The dealer's tag and card say **"Shopkeeper"**, with **"Talk"**.
- The crate card: **"Jefferson's Boss Crate"**, **"3 Jefferson tokens, or 1 Jefferson token + 1 crate key"**, **"You have N
  Jefferson tokens and N crate keys."** and the buttons **"Buy with 3 Jefferson tokens"** and **"Buy with 1 Jefferson token + 1
  crate key"**. Its prize is **"Giraffe Gallop"**, Mythic ride (its line as before).
- The FAQ's boss crates line and the Crates tab now include Jefferson's Boss Crate.
- His challenge call, one at random (placeholders until Eric's Gemini lines): **"Boys! We got a challenger!"**, **"Take five,
  everybody. We're playing chess."**, **"Who wants a fifteen-minute break?"**, **"Forks down, boys. Somebody wants a game."**
- His intro, his crew in the warehouse and his wipe are new.

## Changed checks (old → new)
- `boss-challenge.test.ts`: the intro bosses list `[alfil, bigboy, dash, gardener, hollow, pig, tiger, timber]` gains `grex`, plus his
  intro's fields; "across for all eight" → "all nine" (gains `grex`).
- `shop-room.test.ts`: the homes-with-inside list gains `grex`; the crate-words test gains his crate; the per-shop crate loop gains
  `grex`.
- `shop-wrangler.test.ts`: `BOSS_CRATES.at(-1)` is Wrangler's → `BOSS_CRATES` contains Wrangler's (Jefferson's is last now).
- `town-bots.test.ts`: the sidekick files 18 → 19, and the art id map gains `dealer: "sidekick-grex-dealer"`.
- `boss-tokens.test.ts` (server): the crates' rides gain `["grex", "jefferson-giraffe"]`.
- `crates.test.ts` (core): unchanged. `jefferson-giraffe` stays in `NO_CRATE_YET` (it means "in no regular crate", as Pen Pony and
  Hollow's Bulb are): the brief said to take it out, but that fails the regular crates' check (decision note).
- New: `packages/app/test/shop-grex.test.ts` covers the floor mask, the stand and marks, talk without a counter, the lights, the dealer
  sheet and place, the crate, the crew's sheets (pixel hashes against the art), the machines' loops (clear of the racking, the table,
  the marks and the crew; facing; the pallet's laps; the pace; **they stop when a square ahead is taken and go on when it's free**; a
  begun step finishes; parked in the intro), and the intro (beats in order at 12.5 to 15 s, his moves in their beats, the lift ending
  level with the board's slab, every cue a sound, the ring's spots behind the table and the walks round its north side in time).
- New e2e: `e2e/shop.spec.ts` "Jefferson's Fireworks" (the card's Go in, inside, the crew, the dealer, the crate, and the lift waiting
  while you stand in its way and going on once you step aside) and `e2e/boss-challenge.spec.ts` "challenging Jefferson" (his intro
  from the marks to the board and back to the town).

No check guarding a rule in `docs/rules/eric.md` changed.

## Frame rate
Headless, walking 5 s, median of 3, against Wrangler's barn (this shared machine): phone 390 × 844 28.0 against 26.1 fps (a draw 38
against 34 ms); computer 1440 × 900 29.5 against 29.5 fps (27 against 28 ms); phone with the CPU slowed 4× 4.9 against 5.4 fps.
Within the ~3 fps the brief allows, so nothing was cut.

## Lane
Boss lane, but **full e2e**: it changes `packages/core` (the crate list is shared), which runs the whole suite anyway. Locally the new
and changed unit tests, the typecheck, and the two Jefferson e2e tests on phone and desktop all passed.

Stills (`docs/jefferson-home/`, phone and desktop): `room`, `dealer-corner`, `crew-blocked`, `intro-start`, `crew-ring`,
`you-lifted`, `wipe`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
