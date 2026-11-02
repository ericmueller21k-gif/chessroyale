# Eric's Nov 2 fixes, batch B: votes, boss crates held in the inventory, shops

**Title:** Nov 2 fixes B: tap a vote zone, no vote emoji, boss crates held in the inventory, shop chat tone, shop cards, room drag

Branch `claude/nov2-fixes-b`. Brief: `notes/briefs/brief-nov2-bugfixes-b.md`. Decision note: `docs/decisions/2026-11-02-nov2-fixes-b.md`.
Stills (phone and computer): `docs/nov2-fixes-b/*.png`.

**Lane: full for item 3** (stored data: a new D1 table, the buy's transaction changed, a new open transaction). It needs the
`full-e2e` label and an independent review; the director may want it at xhigh. **Targeted** for items 1 and 6 (screens and input),
**light** for 2, 4 and 5 (data, copy, CSS and markup).

## What changed

1. **Votes: a tap on a zone puts your pawn there** (Eric: "Tapping on an augment area puts your piece there."). I couldn't make a tap
   on a zone reach the board under it: I tried with real touches on a phone, before and after picking the pawn up, through all three
   votes into the game. The vote screen's board takes no moves, and nothing was picked or played. So I read the line as the behavior
   Eric wants, like item 3's wording. A tap on a zone now casts that vote, with or without picking the pawn up first; before, a zone
   took a tap only after a tap on your pawn. The zone's tap area takes the tap, so the board under it never gets one. Your own pawn
   stays on top, so it can still be dragged out of a zone. Shared by 50 v 50 and Squads (`screens/Vote.tsx`). 1 v 1's time-control
   vote (`DuelVote`) still needs the pawn tapped first: say if it should match.
2. **Votes: the emoji are deleted.** The `icon` field is gone from the vote options' data and the vote screen (cards, zone labels,
   the winner's banner), for 50 v 50 and for Squads, which uses the same screen. Removed:
   - **50 v 50:** Team final 🛡️, Hidden Boss (his roster icon), Duel ⚔️, Normal ♟️, Random opening 🎲, Freestyle 🔀, Bullet ⚡, Blitz 🔥,
     Rapid ⏱️.
   - **Squads:** Classic ♟️, Mercenary 💰, Coming soon 🔒, Normal ♟️, One opening 📖, Random openings 🎲, and the clocks ⚡ 🔥 ⏱️.
3. **Boss crates go into your inventory.**
   - **Buying** a crate in a shop puts it in a new `boss_crates` table, one row per crate, unopened. It's still one D1 batch: the row
     goes in only if the tokens (and the key) are there, then they come off only if the row went in. Nothing opens at once any more.
   - **The Crates tab** lists each boss crate under "Boss crates": its boss's token on the crate's corner and how many you hold,
     greyed at none (shown, not hidden).
   - **Opening** one plays the usual strip, unwrap, Fischer Random and reveal, rolled from that crate's own pool (`BOSS_CRATES`) by
     `POST /api/locker/open` → `openBossCrate`. It's one D1 batch too: the item goes in only if you hold one of those crates, then the
     oldest of them comes off only if the item went in. So a crate opens once, never twice, and you can't open one you don't have. Test
     switches never apply to these. The shop's kill switch refuses buying and opening.
   - **Kept with the account:** the locker's `bossCrates`, the account's data download and erase, a guest's sign-in move, the privacy
     page and the FAQ.
   - **Backward compatible:** it's a new table, so older data reads as holding none. Before a reload, an app still running the old code
     shows an error line after a buy, but the crate is safely held.
4. **The chat inside a shop** takes the room's tone, not the sky's (`ShopDef.chatTone`): Babur's tent has white words on a dark tint,
   Puddles' greenhouse has dark words on a light tint.
5. **The town's home card for a shop** (Babur's, Puddles') shows its name, centered, and "Go in" under it, centered, nothing else. Homes
   without a shop keep their card: name, Hollow's line, "Shop" greyed, "Coming soon".
6. **A drag inside a shop** now moves the view as the town's drag does, with the floor following the finger both ways. The room's
   vertical drag was flipped: its rows run toward the camera, the town's run away.

Also: two roadmap entries (Emoji packs, and the Pokémon-gym boss challenge from the town), not built.

## Player-visible text, new and changed

- Shop card after a buy: **"Babur's Boss Crate is in your inventory."** / **"Puddles' Boss Crate is in your inventory."** (was "You got
  <item>! It's in your Locker." with the item's picture; that line and the picture are gone).
- Crates tab: a heading **"Boss crates"**; each row **"You have 2"** / **"You have none"** (the crate's existing name and blurb).
- A boss crate's page: **"You have 2."** / **"You have none. Babur's shop in the town sells it."** (Puddles: "Puddles' shop …");
  its button **"▶ Open"** (the free crates keep "▶ Open · uses 1 key"); "▶ Open another" greyed when none is left.
- The server's refusal: **"You have no Babur's Boss Crate to open."**
- FAQ, "Crates and items", added: "A crate you buy goes into your inventory (the Crates tab), where you open it like any crate, once."
- Privacy page, "Boss tokens": what we keep adds ", and the boss crates you bought and haven't opened yet (which, and when you bought
  each)"; how long adds "; a boss crate until you open it."
- Vote screens (50 v 50 and Squads): no emoji on the cards, the zones or the winner's banner.
- The town: Babur's and Puddles' home cards lose "Shop" (greyed) and "Coming soon".

No hint text changed: the vote's "Drag your pawn into a zone, or tap a card." stays.

## Checks changed (old → new)

None guards a rule in `docs/rules/eric.md`.

**e2e**

- `e2e/shop.spec.ts`:
  - `goIn`: "Shop" greyed on the card → the card's only button is "Go in", no "Coming soon".
  - Babur's test: the drag back to the door went down the screen (0.3 → 0.7) → it goes up (0.7 → 0.3), since the drag follows the
    finger now. Added: the chat's tone is `night` inside the tent.
  - Puddles' test: `?sky=day` → `?sky=night`. Added: the chat is `night` in the town and `day` in the greenhouse.
  - The boss tokens test (retitled):
    - The answer was "You got … It's in your Locker." with the item art → "Babur's Boss Crate is in your inventory.".
    - The locker had 2 items → 0 items and `bossCrates {boss-tiger: 2}`; then both crates are opened in the Crates tab (strip, reveal,
      "Open another" greyed at the last), ending with 2 items from Babur's pool and no crates.
  - New: "inside, a drag looks around as the town's does": a point under the finger follows it, down, up and sideways, in the town
    and in the room, with a finger (phone) and a mouse (computer).
- `e2e/town.spec.ts`:
  - "a home's card: its name, 'Shop' greyed … 'Coming soon'" → "a home you can go into (Babur's)": its name and "Go in", centered
    within 1.5 px, two children, no "Coming soon".
  - The dark-cards test, Babur's home: "Shop" disabled and "Coming soon" visible → "Go in" enabled.
  - Hollow's card: added "Coming soon" visible (a home without a shop is unchanged).
- `e2e/votes.spec.ts` (retitled): added, in the second vote: a tap on a zone with the pawn not picked up casts it, the pawn stands in
  that zone, no press reaches the board, no square is marked.
- `e2e/opening-vote.spec.ts`: `.vote-card-icon` was ["♟️", "🎲", "🔀"] → no emoji in the cards or the zone labels.
- `e2e/crowd-hidden.spec.ts` (retitled): the card's and his zone's icon were his icon → his card has no icon, the zone labels no
  emoji.

**Unit**

- `packages/core/test/votes.test.ts`: dropped `boss.icon === him.icon`; the start options [id, icon, label, blurb] → [id, label, blurb];
  added "no emoji on any vote's options".
- `packages/chess/test/squads-lobby.test.ts`: the clock icons ["⚡", "🔥", "⏱️"] → no emoji on any Squads option.
- `packages/app/test/shop-room.test.ts`: `gotLine` → `inInventoryLine`. The buy answered with the item → it answers "Puddles' Boss
  Crate is in your inventory.".
- `packages/server/test/account-data.test.ts`: `SCHEMA_COLUMNS` adds `boss_crates`.
- `packages/server/test/boss-tokens.test.ts`:
  - Kept every buying test. They now expect the crate held, not opened: with 3 tokens, with a token and a key, not enough, not a boss
    crate, twice at once, and the tokens spent elsewhere. Each asserts `boss_crates` rows instead of items.
  - The admin API buy also checks `bossCrates`. The guest sign-in brings an unopened crate along.
  - New, "holding and opening a boss crate":
    - opening one you hold, and the crate is gone;
    - once, never twice;
    - twice at once with one crate and with two;
    - can't open one you don't have: none, another boss's, someone else's, a free crate's or a made-up id;
    - the crate opened elsewhere just before the transaction;
    - a failing write rolls the whole open back;
    - through the API: a test switch is ignored, the shop's kill switch returns 503 for buy and open;
    - an account with no rows reads as holding none.

## Tests run (locally)

- Typecheck: all packages.
- Unit: the six files above, 168 tests, all passing.
- e2e on phone and computer, 20 of 20 passed:
  - `shop.spec.ts`: Babur's, Puddles', the drag, the boss crates;
  - `town.spec.ts`: the home card, Hollow's card, the dark cards;
  - `votes.spec.ts`: the vote board;
  - `opening-vote.spec.ts`: the three votes;
  - `crowd-hidden.spec.ts`: the boss final's card.
- Not run locally: the rest of those specs, and Squads' vote specs. CI covers them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
