# Settings overhaul (Oct 15, 2026)

Eric: "do what you think is best", with the goal "smoothness, quickness, with some variety offered". Settings now
reads, in order: THEME · SOUND (sound on or off, Move, Capture and Reveal sound) · BOARD (Animations, Motion trail) ·
QUICK CHAT · FRIENDS (new the same day, where friends put it) · HOW TO PLAY · ACCOUNT · PRIVACY AND TERMS · TESTING
(admins only). The credits stay at the foot.

- **Testing, for admins only** (`profile.admin`, the same ADMIN_EMAILS check as the other admin buttons). Eric: "The
  engine moves and eval settings will be phased to an admin only menu for testers." It holds:
  - **Practice mode** (unlimited power-ups: the engine's top 3 at any time). For everyone else it's gone and off,
    whatever a device stored (`brc.practice`). It counts only where the test switches do (`practiceOn` in `prefs.ts`:
    an admin, a server with TEST_SWITCHES on, Vite's dev server), in solo too. **The server enforces it online:** the
    lobby (`lobby-do.ts`) takes a `hello`'s practice flag only from an admin's socket or where TEST_SWITCHES is "1".
    Before, any player could switch it on and play online with the engine's top 3 on every move, survive cuts and take a
    final seat (unranked and marked 💡, but in everyone else's match).
  - **The eval bar**: off for everyone else (`evalBarOn`, the same check). What that changes for players: no bar on
    any board (the play, reveal, vote, final and boss screens), so the board takes its room, as it did with the bar
    switched off; the God King's Last Stand no longer plunges a bar (its blunder, the shake and his lines still show on
    the board); results record `eval_bar` 0. Nothing a player does depends on the bar. The value is still worked out
    (the God King's word on how it's going reads it), so his lines are as before. Testers (and this e2e server) keep it
    on by default.
- **Board** (moved from Crowd): Animations and Motion trail. Eric tested both and wants them kept: they matter for
  visibility, performance and preference. They now apply wherever picks show: Crowd and raids (as before, through
  `CrowdGhosts`), and Classic's and Squads' reveals (`ShadeMoves`: without the trail the see-through pieces appear on
  their squares, without animations only the names show, and they carry the reel). Same device keys as before.
- **The pre-game votes are always on**: they're the game's variety. The switch is gone and a device's "off"
  (`brc.augments`) is no longer read. `?augments=0` stays as a **test switch** (ten specs use it to skip the votes),
  gated on both sides: `testParams()` in the app, `LOBBY_TEST_SWITCHES` on the server.
- **Classic's opening moves stepper is gone**: Classic plays its default (`DEFAULT_SETTINGS.openingMoves`, 4 a side).
  No spec used `?moves=`, so it's gone everywhere (the app no longer sends it, the server ignores it), not kept as a
  switch; a device's stored count (`brc.openingMoves`) is no longer read.
- **The sound lab is a picker now**: "Reveal sound", beside Move and Capture sound and in the same style (a radio per
  voice, picking plays a whole roulette, ▶ plays one without picking: `previewReel` in `sound.ts`). The lab screen and
  `?soundlab` went with it (its other row only auditioned the ripple, tick, move and capture sounds).
- **Testing:** full lane (the practice flag is a server fairness check). Unit: `lobby-do-practice.test.ts` (the
  Durable Object, on a fake runtime: a player's practice ignored, an admin's and a test server's taken),
  `packages/app/test/testers.test.ts`, `test-switches.test.ts` (`augments` a switch, `moves` gone), `faq.test.ts`.
  e2e: `front-door.spec.ts` (the sections in order, Board's picks stick, Testing only for an admin),
  `eval-bar.spec.ts` (testers' switch; a player never sees a bar), `piece-sounds.spec.ts` (the Reveal sound).
