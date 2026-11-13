# Review of PR #679: the Hidden Boss's cutscene wired into the fight (boss lane, quick pass, read-only)

Reviewed `git diff origin/main...origin/claude/recluse-cutscene` at `6ec29bdb` (main includes #677). Line numbers are on the PR branch.

**Checks run on the PR branch:** `npx vitest run packages/app packages/server packages/core`: 292 files, 3999 tests, all pass.
`npm run typecheck`: clean.

**Summary:** no blockers, one major, three minors and two nits. The major is a reload during the scene online, which neither
shows the scene nor skips it cleanly: the device sits on "Connecting…" for the rest of the 104 s hold.

## Blocker

None.

## Major

### M1. Reload during the scene (online): "Connecting…" for up to ~104 s, no scene, no fall screen, no menu
`packages/app/src/recluse-online.ts:118-121` (`show()`, the `now < at` branch), with `packages/app/src/net.ts:884-894`.

During the hold, the server's `last` for every human is the full `phase2` message (`lobby.ts:787-795`). A reloaded page starts
at `phase = { kind: "loading" }` (`net.ts:160`). Then `welcome`, `lobby` (`started: true`, so the phase is left alone) and `phase2`
arrive. `onMessage` → `begins()` sets `this.cutscene` from `p.cutAt` correctly, but `show()` only calls `later(at)` and `emit()` when
`now < at`. It never sets the phase. App draws `RecluseCutscene` only under `case "boss"` with `p.fall && p.toPhase2`
(`App.tsx:2312`), so the device shows App's `loading` screen ("Connecting…", no Hud and no ⋯ menu) until `at`. Then it jumps
straight to `phaseChange`.

This was unreachable on main: `RECLUSE_CUTSCENE.holdMs` was 0, so `cutAt == at`. This PR opens a 104 s window. #677's unit test
for this case (`recluse-online.test.ts:141`, "a device back during it… still knows the scene") checks `g.cutscene` but not the
phase, so it stays green.

**Failing case.** I ran this as a scratch vitest and then removed it. The `device()` harness from `recluse-online.test.ts`
starts in `loading`, and a `serverView` has `cutAt: now - 20_000`, `at: now + 80_000`. After `g.onMessage(view)`,
`phase.kind` is `"loading"`. The expected value is `"boss"` (the fall, `toPhase2`), so that the scene draws from `now - cutAt`
into it.

**Fix (small).** When `now < at` and the current phase isn't the boss fall, set it:
`{ kind: "boss", boss: <the battle from m.boss / phase2Extras>, until: local(cutAt), fall: true, toPhase2: true }`. That could be
a new `OnlinePhase2Match` hook, or a few lines in `net.ts`'s `"phase2"` case, which already has `m.boss`. The scene then picks up
at the right point, since `RecluseCutscene` computes everything from `now - at`. Add the phase assertion to the test at
`recluse-online.test.ts:141`. While on the wrong screen the music also follows `recluseMusic(loading)`, which is the adult theme
and not the beaten one. The fix covers that too.

## Minor

### m1. The ⋯ menu (leave/resign) opens under the scene's dark, barely visible
`packages/app/src/styles.css:27059-27064` (`.cs-layer { z-index: 900; pointer-events: none }`) against `.mm-scrim`
(`styles.css:2126`, `z-index: 65`).

Taps pass through the layer to the fall screen's Hud. The ⋯ button is under an 86% dark, but a tap on it still opens the
Options panel, and the resign confirm. Both are drawn below the cutscene, at the same 86% dark, so a player can leave
(a board player: resign, per #677) through a dialog they can hardly read. The leave itself is handled correctly and nothing
breaks: the server hands the board to a bot. It conflicts with "nothing hidden" and with the brief's "nothing can be tapped
during it".

**Failing case.** Online or solo, during the scene, tap the top corner where ⋯ sits. The Options sheet opens beneath the
dim. **Fix:** either lift `.mm-scrim` above `.cs-layer` while `body.cs-on`, or grey the ⋯ while `cs-on`, the way the 🏆
already is.

### m2. `Voice.hush` outlives the match: leave mid-scene, and the next battle's lines are dropped for up to ~104 s
`packages/app/src/speech.tsx:159-166` (`hush`) and `:168` (`reset()` doesn't clear `hushedUntil`), and
`packages/app/src/components/RecluseCutscene.tsx:101-105` (the effect has no cleanup).

`hushedUntil` is module-wide state on `bossVoice` and `kingVoice`. If a player leaves during the scene (solo leave, or online
resign) and starts another boss battle before the old `until`, every `say()` with `at < hushedUntil` returns false. This hits
any boss: intro lines, the God King's remarks, power lines. `say()` also doesn't mark those keys as said, so they never
come back.

**Failing case.** A unit test: `v.hush(Date.now() + 100_000); v.reset(); expect(v.say("x", "k")).toBe(true)`. It fails, and
`say` returns false. **Fix:** clear `hushedUntil` in `reset()`, and/or un-hush in the effect's cleanup when the scene unmounts
early.

### m3. Stale doc comment: the lines are called "a MOCKUP, wired into no match"
`packages/app/src/characters/recluse-lines.ts:191`. They're wired in now. The comment should say they're in the fight since
Nov 13.

## Nits

- `packages/app/src/recluse-cutscene.ts:110`: the `0.02` floor. If the window is shorter than the child's fixed frames plus
  2% of the rest (about `?cutscene=1` to `3`, or `CUTSCENE_HOLD_MS` below about 3 s), `endAt` overruns the hold. The scene
  is then cut off when the phase change unmounts it, while the docs say "still ends by the window's end". Test-only. Either
  raise the lower bound of `?cutscene=` and `CUTSCENE_HOLD_MS` to cover the fixed frames, or say so in the comment.
- `absorbReadMs` (`recluse-phase2.ts:171`) is now used only by tests (`recluse-phase2.test.ts:136, 258-269`). The game uses
  `absorbPaced`, which reuses it as the cap only through `absorbGoneAt`. Its old tests now describe a path the game no longer
  takes. Fine to keep, but worth a line saying so.

## What I checked and found right

- **Timing, solo.** `cutsceneAt = { at: now + fallMs, until: now + fallMs + hold }` and the phase change at `fallMs + hold`
  (`solo.ts:1351-1358`).
- **Timing, online.** `begin()` sets `at = cutAt + (holdMs ?? RECLUSE_CUTSCENE.holdMs)`, and `recluseCutscene` is told at
  `cutAt` (`bosses/recluse.ts:129-130, 197`).
- **The hold is the timeline's length.** `holdMs` (104 085) equals `cutsceneTimeline().endAt`, a unit test guards it, and
  `fitCutscene` plays it unchanged within 1 s.
- **Music.** The phase change's own timing is unchanged (`changeMs` and `splitAt`), so the transform theme's drop still
  lands. The beaten theme loops through the hold (`music.ts:382`).
- **Test switches.** `?cutscene=` goes through `testParams()`, which is empty unless `testSwitchesAllowed()`.
  `CUTSCENE_HOLD_MS` is read only with `TEST_SWITCHES === "1"` (`lobby-do.ts:775-778`), which is set only on staging
  (`wrangler.jsonc:95`) and in the e2e server. `Settings` can't be set from a client (the overrides are built by the server).
- **No skip.** `winForm` during the hold only arms `winNext`, and `ult` needs `p.playing`. The board on the fall screen takes no
  moves.
- **The hidden figure.** `cs-on` is added from the scene's start and removed on unmount, which is the phase change. Leaving the
  match also unmounts it.
- **The kneel.** The `kneel` loop is the same `SLUMP` hold and stance as the seize's first frame. The dip is 4 to 6 against 6,
  so at most a 2 px settle where the seize starts during the "look up" frames.
- **The absorb line's paging.** Both lines split into two sentences, with the chant's pause between them, and they're gone by
  `absorbGoneAt` (unit test).
- **The name** appears nowhere in the diff, in the lines, comments or docs.
- **Other bosses.** Nothing changes for them: the App branch needs `toPhase2`, solo sets `cutsceneAt` only `if (phase2)`, and the
  `Voice.say` guard is inert until a hush (but see m2).
