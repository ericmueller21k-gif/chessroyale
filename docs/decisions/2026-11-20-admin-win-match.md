# Admins' 🏆 "Win this match" in every boss battle (Nov 20, 2026)

Eric, Nov 20: "add in my by the little lightning bolt and the other icons I have as an admin or whatever for testing. Put a button that
lets me just end the current match as like a victory, so I can test going up each floor and stuff like that."

- **What changed:** the Hidden Boss's 🏆 ("Win this form", Nov 13) now shows for an admin in every boss battle: Boss alone, solo raids,
  online raids and parties, and Battle Tower floors (solo and party), labeled "Win this match (testing)". Pressed, the next move (the
  team's) ends the battle as a mate would (the runner's `bossForceWin`), so the result, a floor's write and the elevator up follow.
  The Hidden Boss keeps "Win this form" and its per-form meaning.
- **Server (admin-only, unchanged gate):** `LobbyCore.winFormTrigger` still needs the Durable Object's `admin` (ADMIN_EMAILS) and a
  person in the match; it no longer needs his room's fight or his id. A player's `winForm` message does nothing.
- **Call: a tower floor's quick win.** A solo floor's result is the device's report, and `BATTLE_TOWER.soloWinMinSeconds` (10 s) would
  refuse an admin's quick win on the live site. The server now takes an admin's report at once (`TowerEnv.admin`, from the session's
  account and ADMIN_EMAILS, as the admin pages check); everyone else is still held to the minimum.
- **Call: XP.** Online, a battle the 🏆 touched stays a test game (no XP), as the ⚡ and the Hidden Boss's 🏆 already make it (review m3,
  Nov 9); a party floor's ends are still written to every copy. Solo, unchanged: the 🏆 doesn't mark the game (solo's ⚡ doesn't either),
  so its XP is the server's usual check of a solo game.
- Lane: targeted. Tests: `app/test/engine-move.test.ts`, `server/test/tower.test.ts`, `server/test/tower-party.test.ts`,
  `server/test/hidden-room.test.ts` (its "refused without `room`" check flips), `e2e/battle-tower.spec.ts` ("an admin's 🏆").
