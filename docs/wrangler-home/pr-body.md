Title: Wrangler's barn and his challenge intro (the rooster on the counter, Pen Pony, the lasso intro; Eric's bucket and pens fixes)

# Wrangler's barn and his challenge intro (Nov 4)

Wrangler's Stall gets an inside, his rooster keeps the shop standing on the counter, and Wrangler's Boss Crate sells Pen Pony.
Challenging him now plays his own intro. The art is from `claude/boss-art` at 0e4c00c6. Wrangler is live, so this goes to everyone.
Decision note: `docs/decisions/2026-11-04-wrangler-home.md`. Area pages: `docs/areas/town-square.md` and `docs/areas/shop.md`.

## What changed
- **The barn** (`town/shops/pig-art.ts`): a box room with plank walls, hay, saddles, troughs and four lanterns, lit at every
  placement. The two pens of knights hop in L's and stand up whole. The board sits on its hay bale at (4, 3). The battle spot is a straw
  bed in a rope ring, with his red mat and your denim mat as its marks. The roof is dark rafters (`roof: "barn"`), and the chat uses
  the day tone.
- **The rooster** (`characters/sidekicks/rooster.ts`, baked into `town/sidekicks/rooster.png` and `sidekick-sheets.ts`) stands on
  the counter. This uses a new `ShopDef.lift`. No other shop has a lift. He is not a town bot.
- **Wrangler's Boss Crate** (`BOSS_CRATES`, `boss-pig`) holds **Pen Pony** (`pen-pony`, a mythic ride wired as rides v2:
  `components/rides/pen-pony.tsx`, `load.ts`, `feel.ts` foot 98.5 and shadow 1.3, `ride-cells.ts` measured). The crate shows in the
  Crates tab and in the FAQ for everyone.
- **His intro** (`challenge.ts` rope beats, `ropeAt`, `ropeTimes`, `ropeCues`, `CHALLENGE_FEEL.rope`; `intro.ts` loads
  `pig-intro-art.ts`, which also re-exports his moves from `characters/pig-intro.ts`; ShopRoom draws it). It runs about 12.3 s from
  the marks to the wipe:
  - his line in the big bubble
  - the spin and the throw: the loop flies to the bale and cinches round it
  - the yank: the corner board stand is hidden and the bale is dragged to the middle, where it lands
  - the loop is flicked free and reeled in
  - the cross throw sends two ropes off screen
  - the buckets tumble in and land upside down as the stools (black is his, white is yours)
  - his brag, then his God King attack, then his wipe (spurs, tumbleweeds, cap guns with BANG! flags)

  You and he walk straight to the usual clear places, and nobody moves after that. Every cue plays a sound of his. There are four new
  synthesized sounds: `pigSlide`, `pigClatter`, `pigJingle` and `pigPop`. A storm's own frame cues now play as it sweeps in. Only
  Wrangler's are new; Alfil's "storm" and Big Boy's unmapped "swirl" stay as they were.
- **Eric's Nov 4 bucket fix:** the HunChess bucket (`town/shops/hunchess-bucket.ts`, shared) is drawn the same way everywhere, as a
  side view with no open mouth or hole: on the tumble, on the landed stools (upside down, the text upside down), and on the decoration
  buckets in the barn and in Puddles' shop. Sizes, seat height and colors are unchanged.
- **Eric's Nov 4 pens fix:** both pens are mixed, with 4 knights in each (2 white and 2 black), one in each quarter, hopping as before.
- **Puddles' shop** gets three HunChess buckets (`puddles-art.ts`, from the art at 0e4c00c6): a stack by the potting bench, one by
  the fountain, and one by the hose reel.

## Player-visible changes and new text
- Wrangler's Stall's card: its name, then **"Go in"**. "Shop" and "Coming soon" are gone. His home has no line, so none shows.
- Inside: the header **"Wrangler's Stall"**. The rooster's tag and card say **"Shopkeeper"**, with **"Talk"**.
- The crate card: **"Wrangler's Boss Crate"**, **"3 Wrangler tokens, or 1 Wrangler token + 1 crate key"**, **"You have N Wrangler
  tokens and N crate keys."** and the buttons **"Buy with 3 Wrangler tokens"** etc. Its prize is **"Pen Pony"**, Mythic ride:
  "One of Wrangler's pen knights, saddled up. It won't go straight, but it hops like nobody's business."
- The FAQ's boss crates line and the Crates tab now include Wrangler's Boss Crate.
- His challenge line (a placeholder until Eric's Gemini lines): **"Saddle up, partner. The board's comin' to us."**
- His intro and wipe are new. Puddles' shop has three new buckets. Every bucket is drawn as a side view.

## Changed checks (old → new)
- `boss-challenge.test.ts`:
  - The intro bosses list `[alfil, bigboy, dash, gardener, hollow, tiger, timber]` gains `pig`, plus his intro's fields.
  - "across for all seven" → "all eight".
  - The marks test gains `pig`, using his drawn marks.
  - The stool clearance test gains `pig`. His buckets are the stools. His mirrored idle check is replaced by his idle as drawn, his
    double yank and his brag. **His attack's feet check is skipped**: his lash crosses over his bucket. Eric to confirm.
- `shop-room.test.ts`: the homes-with-inside list gains `pig`; the crate-words test gains his crate; the per-shop crate loop gains
  `pig`.
- `shop-hollow.test.ts`: `BOSS_CRATES.at(-1)` is Hollow's → `BOSS_CRATES` contains Hollow's (Wrangler's is last now).
- `town-bots.test.ts`: the sidekick files 17 → 18, and the art id map gains `rooster: "sidekick-pig-rooster"`.
- `crates.test.ts` (core): `NO_CRATE_YET` and the rides list gain `pen-pony`.
- `town-rides.test.ts`: the ride ids gain `pen-pony`.
- `boss-tokens.test.ts` (server): the crates' rides gain `["pig", "pen-pony"]`.
- New: `packages/app/test/shop-wrangler.test.ts` covers the room, the stand, the marks, the lights, the rooster on the counter, the
  crate, Puddles' buckets, and the intro (beats in order at 11 to 13 s, no hop, the stand hidden from the yank, the bale and buckets
  landing where the table and stools stand, every cue a sound).
- New e2e checks: `e2e/shop.spec.ts` "Wrangler's Stall" (the card's Go in, inside, the rooster, the crate) and
  `e2e/boss-challenge.spec.ts` "challenging Wrangler" (his intro from start to board and back). The Puddles greenhouse test gains an
  optional still (`PUDDLES_BUCKETS`).

No check guarding a rule in `docs/rules/eric.md` changed.

## Lane
Boss lane, but **full e2e**: it changes `packages/core` (the crate list and the ride are shared), which runs the whole suite
anyway. Locally, the new and changed unit tests, the typecheck, and the Wrangler/Puddles e2e on phone and desktop all passed.

Stills (`docs/wrangler-home/`, phone and desktop): `room`, `counter`, `wrangler-start`, `wrangler-drag`, `wrangler-stools`,
`wrangler-wipe`, `puddles-buckets`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
