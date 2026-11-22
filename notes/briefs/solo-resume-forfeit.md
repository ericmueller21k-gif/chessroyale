# Solo games: Resume / Forfeit after a reload (Nov 22). Opus, xhigh. Full lane (stored results). Step 2 of 2.
**Eric, Nov 22** (approving "both steps"): step 2 = "when you come back to Boss Battle with a game in progress: You have a game in
progress, Resume or Forfeit?" Reuse the Battle Tower's restore: a floor already survives a reload (`SoloMatch.resume(KeptGame)`,
solo.ts ~389; the floor's game kept on the device via tower.ts `keep`/`loadKept`; App.tsx's `/tower` rejoin). Step 1 is on main (PR #881:
`docs/decisions/2026-11-22-solo-abandon.md`, `docs/areas/accounts.md`, `abandonSoloGame(sql, user, { game })` for Forfeit).

## Build
- **Keep:** a solo boss battle (Boss alone and a Solo raid; other solo modes only if the same restore covers them cleanly: say which)
  keeps its game on the device as a tower floor does (`runner.snapshot()`, moves, turn time used), at each turn, from its first move.
  One kept game per device, tagged with the account and the server's game id. Its clock doesn't run while the page is gone (as a floor).
- **Prompt:** on the app's load and when Boss Battle opens, a kept game for this account shows a card: "You have a game in progress"
  with the boss and the move number, **Resume** and **Forfeit**. Nothing hidden behind it (docs/rules/eric.md); phone and computer;
  mockup first (one still each) in the PR, built from existing card styles.
- **Resume:** back into the same battle exactly where it was (`resume`), same game id (the server's row stays open; its 10-move mark
  as it was).
- **Forfeit:** past 10 moves (marked real) it's recorded as a loss now (`abandonSoloGame`); under 10, the kept game is just dropped
  (nothing recorded). Either way the kept game is cleared.
- **Settle:** the load's `settle=1` must not record a game this device can resume: name it so the server skips it (as `unsent`
  does). Stale after `SOLO_ABANDON.staleHours` still records it. Starting another solo game with one kept asks first ("Forfeit your
  game in progress?") instead of silently recording it.
- **Follow-up from #881's last review (N4, rereview3-881.md on branch review/solo-abandon-delta3):** Chandy's Dodge's losing hit: a
  close during its ~7.5 s kill records a loss as left (not its real place): make `endOnHide` play Dodge's end out too (the reviewer's
  four lines). A test.
- Settings in `packages/core/src/settings.ts`; the FAQ line becomes "Leaving a solo game after 10 moves counts as a loss, unless you
  come back and resume it."

## Tests
Unit: keep/resume round trip (the same position, powers, carrots, clocks), Forfeit both sides of 10 moves, settle skips a resumable
game, stale still records, another account's kept game never offered, a start with one kept asks. One e2e: 12 moves vs a boss, reload,
the card, Resume (same board), reload again, Forfeit (one loss on the profile). Add files to `e2e/areas.json`. Ask for `full-e2e`.
## Deliver
Branch `claude/solo-resume` from origin/main; docs (accounts.md ≤5 lines, a decision note ≤10 lines); `.pr-body.md` + `.done` when
CI is green; stills (the card, phone 390x844 and computer 1280x800) on orphan branch `stills/solo-resume`.
