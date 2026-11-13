## The Hidden Boss's room challenge, the summoning and the test bots

**Lane: full** (server, protocol, online match start, admin-only server actions). **Please add the `full-e2e` label**; an independent
review follows (brief: `notes/briefs/hidden-boss-room-challenge.md`).

### What changed
- **Server** (`packages/server/src/hidden-room.ts`, `hidden-room-api.ts`, in the live hub): `POST /api/town/hidden` (`enter`, `look`,
  `challenge`, `cancel`, `leave`, `fill`). Per town instance: the people in his top-floor room (four at most) and one request. Leaving,
  a cancel, a disconnect (20 s without a look) and the town's AFK limits drop your place; a solo boss battle started elsewhere ends it
  (one request at a time). The 5-minute cap ends the request. At four the hub creates a party battle lobby
  (`hiddenRoomSettings`, `PartyLobby.room`, each person's own pass into their seat) and posts the town's line "Ann, Bo, Cy and Di are
  fighting the Hidden Boss.". The room is in memory only: a restart forgets it, and devices re-enter.
- **Admin test kit, checked on the server:** "Fill with 3 bots" (refused for a player: "Admins only."). The bots count toward the four,
  join a request 2 s apart, go through the summoning and play as the fight's bot members. The online 🏆 "Win this form": new client
  message `{ t: "winForm" }`. `LobbyCore.winFormTrigger` checks the admin and that this is his room's fight. The team's next move then
  beats his adult form through the end a mate takes (`bossForceWin`, stored in the lobby record as `winForm`). The battle becomes a test
  game (no XP).
- **Protocol:** one optional client message, `winForm` (documented in `protocol.ts`). Nothing else in the shared protocol changed.
- **Core:** `HIDDEN_ROOM` (4, the 5-minute cap, the poll and silence times, the bots) and `hiddenRoomSettings()`. `partyMove`: a tie
  at the top (2-2 in a team of four) now goes by strength, as a no-majority turn already did. A party of three can't tie at two, so its
  draws are unchanged; it's still one draw from the random source. `"recluse"` is out of `BOSS_ADMIN_FIRST`.
- **App:** his card in the room (Challenge, Cancel, an admin's "Fill with 3 bots"), the "Challengers 2 of 4" count, "The door is
  locked.", "Sorry, not enough players.", "Cancel your game request?", the summoning wired with live players (`recluse-scene.ts`
  `people`/`you`), the hand-off into the fight (`hiddenFight` → `joinLobby`), `NetMatch.winForm`, and a fourth party seat color.

### What players see
- **His walk-up is in everyone's town** (Eric, Nov 13). His Boss Battle tile stays locked.
- **His top-floor room:**
  - The card offers **Challenge** and **Cancel**, each greyed when it doesn't apply.
  - The card's line reads "Up to 4 fight him together." or "2 of 4: Ann, Bo".
  - Everyone in the room sees **"Challengers 2 of 4"** at the top.
  - Other players in the room appear as plain pawns.
- **Leaving with a request in** (the stairs, back, the side menu, the back gesture) asks **"Cancel your game request?"** (Stay / Leave
  and cancel).
- **A 5th person** who taps the stairs up gets **"The door is locked."** and stays on the landing.
- **No four within 5 minutes** (not shown): "Sorry, not enough players." with OK.
- **At four:** the music stops, everyone freezes, and the summoning plays (about 7 s, to black). Then his fight: the four are one team,
  the most-picked move is played, and a tie goes to the stronger move. "Back to town" returns you to his door.
- **The FAQ** now says he's also met in his room in the town.
- **Online, his phase 2 (four boards) doesn't exist yet.** Beating his adult form online ends the fight as a win, just as the Crowd's
  final does today. Phase 2 online is the next job.

### Calls I made (`docs/decisions/2026-11-13-hidden-boss-challenge.md`)
- **Other players in the room are plain pawns** in the mockup's four colors, with no names or outfits. Bots stand at the board's places.
- **Bots join 2 s apart** (more than the 1.5 s poll), so everyone sees each count.
- **The walk-up stays at (45, 7)**, about 7 squares from Ginger's igloo. The ring's 8 to 10 spacing test now covers the fourteen ring
  homes only.
- **Not in the FAQ beyond one line:** his room's test tools (admins only).

### Tests
- **Unit:**
  - `packages/server/test/hidden-room.test.ts` (new, 18): the room count, the lock, leaving and disconnects, one request at a time, the
    cap, the start, the bots' admin gate, the fight of four, and the 🏆's admin gate.
  - `packages/core/test/party-move.test.ts`: +2 checks (four players; one draw from the random source).
  - FAQ checks.
- **e2e** `e2e/hidden-boss-room.spec.ts` (new), both projects, run locally and passing:
  - An admin goes up and challenges (1 of 4). Leaving asks, and Stay keeps the place. Three bots join (2, 3, 4 of 4), the summoning
    plays, and the fight starts (his, four seats). The 🏆 wins it.
  - A 5th person is locked out, and a player's fill is refused.
- **Also run locally (phone):** `town-leave`, `town`, `town-street`, `boss-smoke`, `town-afk`: 68 passed. The whole unit suite
  (`npm test`) and `npm run typecheck`: passing.
- **New file `e2e/areas.json` entries:** his room's challenge. `playwright.config.ts` gets an `ADMINS` line for the new spec (a shared
  foundation, so this PR runs the whole suite anyway).

### Test checks changed (old → new)
- `packages/app/test/recluse-building.test.ts`: "is in an admin's town only…" → "is in everyone's town…" (`adminFirst` false; his home is
  in a player's town; still never on a raid menu).
- `packages/app/test/town-chat.test.ts`, "never has the Hidden Boss talk": `HOMES` has no "Hidden Boss" → the chatter never names him
  (400 picks).
- `packages/app/test/town-world.test.ts`: the open-ground `SPOT` (45, 6) → (44, 2). The walk-up stands on the old one now.
- `packages/app/test/town-camera.test.ts`: "fourteen homes… 8 to 10 apart" → "fifteen homes". The ring's fourteen still keep 8 to 10;
  the walk-up stays 7 or more from any home.
- `packages/app/test/town-bots.test.ts`: every home has a kid → every home with a figure out front (`hasFigure`; the walk-up has none).
- `packages/app/test/faq.test.ts`: "Met only in the Crowd's boss final…" → "Met in the Crowd's boss final… and in Chess Town" (+ the 4 and
  the cap, from the settings).
- `e2e/town-street.spec.ts`, the walk-up: "Challenge greyed, Coming soon" → Challenge and Cancel greyed for a guest, with "Sign in to
  challenge him.".
- `packages/app/test/engine-move.test.ts`, "Win this form: who sees it": "online matches have none" (`winForm` not on NetMatch) →
  "online, only in the Hidden Boss's room's fight, for an admin" (a player sees none and sends nothing; an admin only in his room's fight).
- **Eric's rules:** none of these guard one. A new standing rule is added to `docs/rules/eric.md` ("The Hidden Boss's room…": leaving
  asks, four at most, the cap), guarded by the new tests. It's the one named exception to "rooms don't ask" under "Leaving Chess Town asks
  first"; that rule's guard (`town-leave.spec.ts`) is unchanged.

### Stills
Branch `stills/hidden-boss-challenge`: the room at "2 of 4", the locked door, the summoning, and the fight's first move, phone and
computer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JuCWRuPpvjpkJLcU3sM3cR
