# Review: the Hidden Boss's child form online (`claude/recluse-child-online`)

Independent, read-only review (full lane, xhigh). Scope: the online wiring only, `origin/claude/recluse-child-form..origin/claude/recluse-child-online`
at `614d07f9` (the child form itself, #678, and #677's phase 2 were reviewed already). Brief: `notes/briefs/review-child-online.md`.

**Verdict: no blockers, no majors. Five minors and two nits below.** The server path is sound. The child beaten (by mate or the 🏆) gives
his fall (4.2 s, `RECLUSE_CHILD_RULES.fallMs`), then one new match against the man for everyone, then phase 2. The 🏆 is spent and refused
at the right moments on the server. The host and its checker get identical child ratings, and `?form=adult` can't be reached by a player.

## Runs

- `npx vitest run packages/server packages/core packages/app`: **292 files, 4004 tests passed.**
- `npm run typecheck` (all six packages): **passed.**
- A scratch unit test of my own (not pushed; text at the end): an **online Crowd final through the child**. It uses the existing
  `crowd-hidden-boss.test.ts` harness with `recluseChild: true` and Scholar's mate twice. Result: the child's intro (form child, level
  74, no powers), his requests at `[elo 2367, Maia 1800]` → `[2367, 1800]` → `[2383, 1900]`, his fall (`fall`, no `toPhase2`, 4200 ms),
  exactly **2 intros** (child, adult), the man's requests at `[2650, 2500]`, his fall with `toPhase2`, phase 2, then results with 100
  placements. Fair play and XP counted each pick once across both games (15 picks each: 7 knockout, 4 child, 4 man). A second run
  with `bossMaxMoves: 6` ended correctly too.
- e2e: not run (the brief asks for the unit tests and typecheck).

## Minor

### m1. The app's reset between forms hangs on one message: a device that misses the man's intro keeps the child's state
`packages/app/src/net.ts:812` resets `winFormSent`, the King's speech, the boss voice, beats and banners only in the `boss` case,
when the old `this.boss.form` is `"child"` and the new one has none. But `this.boss` is also replaced in `round`
(`net.ts:685`), `phase2` (`net.ts:900`) and `onReveal` (`net.ts:954`), and those skip the check.

**Failing case.** Someone's phone locks or drops its socket during the child's fall. It stays down through the man's intro
(about 4.2 s plus the intro) and reconnects during the team's first turn against the man. The server re-sends `r.last`, which is
the `round` message by then (`lobby.ts` `send` remembers it). `this.boss` becomes the man with no reset:
- For an admin who pressed 🏆 on the child, `winFormSent` stays `true`. The man's button reads "Your next move wins this form" and
  stays disabled (`BossDock.tsx:611`, `winFormArmed`), though the server isn't armed (`r.winForm` was cleared at the fall). The man's
  🏆 can't be pressed until a page reload.
- For anyone, the child's beats, words and banners aren't forgotten. Beat keys built from `boss.startMove` (1 in both games)
  can collide, so a moment the child's game played can stay silent in the man's.

**Fix.** Run the check wherever `this.boss` is assigned: a small `setBoss(next)` helper used by all four. Or key it on the board's
`generation` / `startPly` instead of the form.

### m2. A premove queued at the end of the child's game carries over to the man's first move (solo too)
Premoves are kept by `seatKey(match, board.id, side)` (`board/yours.ts:87`). The board id and the crowd's side are the same in both
games, and nothing clears the queue between forms (`NetMatch` here; solo's `nextForm`, `solo.ts:555`, doesn't either). The Boss
screen accepts premoves while the boss is to move (`Boss.tsx:557`, no `watch` in the fall).

**Failing case.** During the reveal of the mating move, or during the child's fall, a player on a computer queues `g1f3` or `h2h3`
on the mated position (the boss to move, so premoves are allowed). The man's game starts from the start position, and on the team's
first turn `premoveQueueTurn` plays it at once (it's legal there), marked as a premove. On a phone it's one premove; a computer can
queue several.

**Fix.** Drop the seat's premoves when the form changes (`setQueue(seatKey(...), [])` next to the m1 reset, and in solo's
`nextForm`). Since solo has it too, it may belong in a small follow-up for both.

### m3. The online Crowd final through the child has no test
The PR's only Crowd check is the settings flag (`server/test/recluse-online.test.ts:232`). Every Crowd test in
`crowd-hidden-boss.test.ts` now starts at the man (`recluseChild: false`). The e2e Crowd test is dead: it's tagged `@phone-only`
(left out of the desktop project, `playwright.config.ts:56`) and skips everywhere but desktop (`e2e/crowd-hidden.spec.ts:137-139`),
so the `&form=adult` edit is never exercised. That part predates this PR.

That leaves the non-party path through the child untested in CI: checkers, `noteFair`, the Crowd's results. It works in my scratch
run above. **Suggested:** add that test to `crowd-hidden-boss.test.ts` (Scholar's mate twice; it runs in about 2 s). Separately,
fix the dead e2e's skip (`!== "phone"`), or drop the tag.

### m4. The FAQ and the Crowd's area page still describe the Crowd final as the man only
- `packages/app/src/faq/content.ts:666`: "The Crowd's boss final is always the Hidden Boss, **whose strength is fixed at 2650**,
  whatever anyone's rating". It now starts as the child: Maia 1800 rising every 4 moves, Stockfish's stand-in from 2367. His block
  (`crowdFinalBlock`) is right, and the "no tier, offset or difficulty" part still holds. The `faq.test.ts` checks pass because they
  don't cover this line.
- `docs/areas/crowd.md:161-165`: "His rules there are his phase 1 (from the starting position, Maia at its top, raw, the God King
  blocked, no strikes, the bullet clock)". It should now say the child comes first (no powers, the God King's help works, a new match
  against the man once he's beaten). CLAUDE.md asks for the area page in the same PR. This PR changes the Crowd final online, and #678
  had already changed solo's.

### m5. Stale comments that still say "online waits for the form list"
- `packages/chess/src/runner.ts:1880` (`firstForm`): "(`recluseChild`: solo; online once the server's form list is in)".
- `packages/core/src/settings.ts:1939` (`RECLUSE_CHILD` doc): "solo and, once its form list is in, online".

## Nits

- **n1.** Each form's intro calls `moreLoaders(host, BOSS_CHECK.loaders)` again (`lobby.ts:2616`). In a Crowd final (not a party),
  the man's intro tells two **more** devices to load Maia, on top of the two told at the child's intro. Those devices are computers
  or phones with Maia already saved. That costs a few hundred MB of memory on each extra device and isn't needed. Skip it when
  `r.bossLoaders` is already set.
- **n2.** In a lobby made with test switches allowed, `?form=` with any value other than `adult` sets `tested` (no XP) and changes
  nothing else (`lobby-options.ts:81-82`, through `LOBBY_TEST_SWITCHES`). That's harmless.

## Checked and fine

- **Child beaten → fall → new match, all at once** (`lobby.ts:2600-2640`):
  - `phase2Online()` now reads the beaten form (`recluseNextForm(boss.form ?? "adult")`). The child gives `"adult"`, so it's the
    fall path with his own `fallMs` (`bossRules` gives `RECLUSE_CHILD_RULES` for the child).
  - `finishBossBattle` places nobody, and `isOver()` stays false.
  - The fall's single `nextRound` timer calls `nextBossForm()` once and plays one intro. The timer is cleared before dispatch
    (`alarm()`), so a repeated DO alarm can't start the man twice. My scratch run shows exactly two intros.
  - `finishBossBattle` is called only from `nextRound`.
- **No lost seat:** `nextBossForm` keeps players, the God King's charges, the brain and the checker state. A person leaving in the
  child's fall is still alive: a loss, with a bot taking the seat (`leaveMatch`). The man's beaten `mates` are `runner.alive()`
  then, as before.
- **A reload mid-fall:**
  - Server restore: `r.winForm` is cleared as the child falls, so a restored lobby doesn't re-arm `bossForceWin`.
  - Client reload: the re-sent fall message gives a fresh `NetMatch` the child (`this.boss` was null), and the intro then resets it
    as designed. Only the case in m1 slips.
- **The 🏆 on the server** (`winFormTrigger`, `lobby.ts:1509-1524`):
  - Refused in the child's fall (`boss.result` set).
  - Allowed from the man's intro (`nextBossForm` drops `result`). The client's button is open then too
    (`BossDock.tsx:610`).
  - A second admin's press during the reveal of the move that beats the child is spent with it (the runner clears `bossForceWin`,
    the lobby clears `r.winForm`).
  - Admin, the room and the boss's id are all checked; it marks the battle `tested`.
- **Strength per request** (`sendBossRequest`, `lobby.ts:2231-2238`):
  - The host, its checker (`askBoss`), a re-ask (`reaskBoss`) and a second checker all get `childRatingNow()` / `bossEloNow()`
    from the same runner state in the same event, so honest devices agree.
  - The D1 share (no brain) gets Stockfish at `levelForMaia(child)`, as solo's `playBoss` does (`runner.ts:1345`).
  - A lying host is no worse off than before. In a Crowd final, two different moves go to the engine server, which plays the
    better one for him (`bossServerScored`), so a liar can't weaken the child. In the room (a party), there's no checker and the
    battle is unvouched, as it already was for the man.
- **Fair play and XP:**
  - `noteFair` runs once per round. A party's battle (the room) records none, as before. A Crowd final records the child's
    and the man's picks once each.
  - `ply` repeats across the two games, as it already did between the knockouts and the boss final. Nothing keys on it per
    match (`fairplay-deep.ts` keys on the FEN).
  - `xpSpan` counts each pick once. `matchFeats` reads the last form's boss (the man, or the child if he won).
  - The 🏆 makes the battle `tested` (no XP).
- **Crowd results:**
  - Only the boss final changes (matchmade through `index.ts:252` and custom through `lobby-options.ts:46`; record.overrides,
    so lobbies made before the deploy keep the man).
  - The child winning or drawing ends the fight with `bossResult` `boss`/`draw` and `gameWinner` from his board. Beating him leads
    on, and the cap verdict at `bossMaxMoves` applies to each game (crowd moves reset).
  - Raids can't meet him (`adminOnly`, `isPlayable`), so `RAID_SETTINGS` not carrying `recluseChild` doesn't matter.
- **`?form=adult`:**
  - It's in `LOBBY_TEST_SWITCHES`, so it's dropped for anyone without test switches (`withoutTestSwitches`) and marks the lobby
    `tested`.
  - The room (`live-hub.ts:373`) and the matchmade Crowd (`index.ts:252`) never read the query.
  - The unit test covers both `test` true and false.
- **Guard edit, `e2e/hidden-boss-room.spec.ts` "his room…":**
  - Only the fight part changed. Every room check is untouched: Challenge "1 of 4", leaving asks, the admin's bots joining 2/3/4,
    the summoning and the lock test.
  - The fight's old assertion (`boss`, `seats: 4`, `hidden`) is kept, with `form: "child"` added.
  - It now presses 🏆 on the child, then on the man, then on the four boards, through to the result. Timeout 300 → 400 s.
  - It needs Eric's OK per `docs/rules/eric.md`, as the PR body says.

## Appendix: the scratch test (for m3)

Add it to `packages/server/test/crowd-hidden-boss.test.ts` (its `crowdFinal` harness, import `RECLUSE_CHILD`):

```ts
it("the child first online: mated → his fall (not phase 2's) → one new match against the man from the start → mated → phase 2", () => {
  const L = crowdFinal({ recluseChild: true });
  expect(L.last("p2", "boss")!.boss).toMatchObject({ form: "child" });
  L.script = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"]).filter((_, i) => i % 2 === 0);
  L.bossScript = sanLineToUci(["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6"]).filter((_, i) => i % 2 === 1);
  let fall: Extract<Msg, { t: "boss" }> | undefined;
  for (let i = 0; i < 2000 && !fall; i++) (L.step(), (fall = L.all("p2", "boss").find((m) => m.fall)));
  expect(fall!.boss).toMatchObject({ form: "child", result: "crowd" });
  expect(fall!.toPhase2).toBeUndefined();
  expect(fall!.until - fall!.now).toBe(RECLUSE_CHILD.fallMs);
  let fall2: Extract<Msg, { t: "boss" }> | undefined;
  for (let i = 0; i < 3000 && !fall2; i++) (L.step(), (fall2 = L.all("p2", "boss").find((m) => m.fall && !m.boss.form)));
  expect(L.all("p2", "boss").filter((m) => m.intro).map((m) => m.boss.form ?? "adult")).toEqual(["child", "adult"]);
  expect(fall2!.toPhase2).toBe(true);
  for (let i = 0; i < 20 && L.core.record.phase === "boss"; i++) L.advance(1000);
  expect(L.core.record.phase).toBe("phase2");
});
```
