# Review: PR #839, Battle Tower: two lives (`claude/tower-lives`)

Independent review, read-only on the PR's code. Diff: `git diff origin/main...origin/claude/tower-lives` (head `a9b02eb`). Read with
`docs/decisions/2026-11-20-tower-lives.md`, `docs/decisions/2026-11-20-tower-party.md`, `docs/areas/battle-tower.md`,
`docs/rules/eric.md`, core and server `tower.ts`.

Ran: `npx vitest run` on core, server (`tower`, `tower-party`, `tower-party-do`) and app tower tests: 105 passed. `npm run typecheck`:
green. Throwaway scenario tests (not committed) confirmed findings 1, 2, 3 and 4 below.

## Findings

### 1. Important: a party floor's life comes back when the party re-forms below it (one member's free leave is enough)

`packages/server/src/tower.ts:774` (`preparePartyFloor`): the party's lives count only each copy's floors lost **below the plan's
floor** (`f < plan.floor`). The plan's floor is the lowest party floor of any copy. So any life spent with the party on a floor the
plan goes back to is dropped, though it was the room's result and not a floor played alone. That breaks the decision's own rule:
"nobody is given back a life they spent".

Scenario (checked with a throwaway test): Ann and Bo are a party on floor 2, with no floors lost. In the floor's match Ann leaves
before the party's 2nd move, which is free, so her copy stays on floor 2 (`party: 2`). Bo plays on and loses, so the room writes
`lost: [2]` to his copy and moves it to floor 3 (`party: 3`). When they re-form, the plan is `continue` on floor 2, with Bo going
back from 3. Its `lost` is `[]`, so it has 2 lives: Bo's spent life is back. The same thing happens in a party of three when one
member sits out a floor (A leaves floor 5 for free while B leaves after the 2nd move, or loses): every loss on that floor is refunded.

Before lives, Bo's loss ended his copy, so the party had to start a new run. Now a free leave at the start turns any party floor into
a risk-free practice (wins there are thrown away too, but losses cost nothing).

Fix (one line): count each copy's lost floors below **its own** party floor rather than the plan's:
`runOf(c).lost.filter((f) => f < partyFloorOf(c, membersOf(c.members)!))`. Floors lost alone stay excluded, which is the decision's
call: alone floors never move `m.party`, so they're all at or above it. Floors lost in the party's room are kept. Add a test for this
scenario, and for a copy that spent lives alone and then re-forms; neither is covered today (see Tests).

### 2. Minor: a 409 that carries an open run is read as "this device's result stood", so a floor counted as lost elsewhere shows "Floor N cleared!"

`packages/app/src/tower.ts:398-402` (`settleKept`, the finish-409 path) and `packages/app/src/screens/TowerResult.tsx:36-39`.

This answers the brief's question: yes, one client path misreads it. A 409 body now carries an open run after a loss with a life
left. `settleKept` maps any 409 with a run to `status: "open"` and keeps its own outcome, and `TowerResult` takes `won` from the
match, not from the server.

Scenario (the server half checked): device B gets "Floor under way" and taps "Leave it", a counted leave. The server records floor 1
as lost, puts the run on floor 2 and leaves 1 life. Device A, still playing, then wins its game and sends `won`, and gets a 409 with
the open run. A's result screen says "Floor 1 cleared!" and "Next: floor 2 ...", but the floor room's corner then shows a heart
greyed.

Before this PR the run was null, so the status was "out". Main's `TowerResult` ignored the status and also said "cleared", so the
misread is older; this PR's status-based screen still gets the new open-run case wrong. The server's data is right.

Fix: in that branch, if `run?.lost.includes(k.floor)`, take the outcome as `"lost"`, and have `TowerResult` use `end.outcome` once
the server has answered.

### 3. Minor: a free leave whose stop answer is lost goes to the floor room with the elevator open, not to the lobby

`packages/app/src/tower.ts:383-389` and `packages/app/src/town/Town.tsx:679`. A stop sent again finds nothing under way and answers
`"between"`, either from `ask`'s retry after a dropped answer or from the clerk's re-send after a reload. `settleKept` sets `free`
only on `stopped === "free"`, and `towerBackSolo` now goes to the lobby only on `end.free`. So a free leave whose first answer was
lost lands in the floor room in "won" mode (as if the floor counted) on the same floor. Main inferred the free leave from
`run.floor === k.floor`.

Fix: `free = a.ok && (a.body.stopped === "free" || (a.body.stopped === "between" && run?.floor === k.floor))`. A counted leave
always moves the floor up or ends the run, so the same floor means free.

On the same paths, when the run ended elsewhere (an answer with `run: null` and no `lost`), the "Your run ended" screen has no recap:
`lives("out", null)` gives `lost: []`. That one is cosmetic and rare.

### 4. Minor: if `BATTLE_TOWER.lives` is ever lowered, a **win** can end a run

`packages/core/src/tower.ts:229`: `if (lost.length > s.lives) return { ...run, lost, status: "out" }` runs for every outcome.
Checked: lower `lives` to 1 while a run holds 2 floors lost, then win a floor, and the run is "out". Lives is a settings tunable that
playtests may change. Fix: `if (outcome !== "won" && lost.length > s.lives)`.

### 5. Minor: the clerk's words hardcode "two" and "third"; the hearts and the plan read the setting

`packages/app/src/tower.ts:90` ("Two lives: the third loss ends it.") and `packages/app/src/town/TowerDesk.tsx:224` ("Two lives a
climb"). `TowerHearts` and `planWords` follow `BATTLE_TOWER.lives`, so a change to the setting leaves the clerk's words wrong
("every tunable in one settings file"). Fix: build both lines from `BATTLE_TOWER.lives` (a small number-to-word map, and "the
${ordinal(lives + 1)} loss").

### 6. Minor: the result screen ignores `end.free`, so a leave that the server made free reads "You lost floor 8. It still counts: 2 lives left."

`packages/app/src/screens/TowerResult.tsx:39-56`. Resign after your 2nd move on a floor whose bosses have been rested since it
began: the server's `floorResting` makes the leave free (`stopped: "free"`, nothing spent). The screen still says "You lost floor
8", and `data-tower-result="lost"`. Town then correctly goes to the lobby. Main said "Your run ended" here, which was worse, so this
is not a regression. Fix: when `end.free`, show "You left floor 8. It waits for you."

## Checked and fine

- **The rule.** Lost or drawn floors spend a life and the climb goes on, the next floor dealt as after a win. Off-by-ones are right:
  `lost.length` 1 leaves 1 life, 2 leaves 0 and the run stays open, 3 is out. The third loss is checked before the top, so a third
  loss on floor 99 is out, and floor 99 lost with a life left is top with a best of 98. A counted leave goes through `finishFloor`,
  so it's the same rule. A run that is out or top is returned unchanged. Old runs with no `lost` read as none lost (`floorsOf`) and
  keep the old `met` shape until their first loss. `startFloor` spreads the run, so `lost` survives every start's `metOf`.
- **The best counts only floors won.** `floorsWonBest` handles open runs (floor less one), top runs (99 unless lost) and out runs.
  `soloBest` reads `met.won` and falls back to the old rule; `won: 0` stays 0 and never writes a best. Party bests and crates are
  paid only on `won`; `aloneBest` likewise. Win XP is unchanged.
- **Forging and replays.** Solo is still the device's word, held to `soloWinMinSeconds`; nothing new is trusted. A replayed `lost`
  is answered again (`resultAgain`, same id and outcome) and changes nothing. A loss can't be undone with a stop, because the fight
  has been cleared. (Already true before this PR: a stop's `moves` is the device's word, so a device can claim a free leave. That
  design is unchanged.)
- **Download, delete and merge.** The download adds `lost`; delete removes the rows; the merge keeps comparing floors, as the
  decision says, and is tested.
- **Party.** The commit writes one `met`, so every copy has the same lives; a counted leave spends a life on the leaver's copy only.
  The plan carries `lives`, the stored and fresh plans are compared with the same key order, and a change un-readies everyone and
  refuses START. A copy that is out forces a new run, as before.
- **Eric's rules.** The hearts are always rendered (`BATTLE_TOWER.lives` SVGs, fixed 15 × 13 px, spent ones greyed). The clerk's
  line is always present ("Two lives a climb" with no run), so the card never grows or shrinks. The floor room's corner is free on
  phone (the town chat sits top-left) and `pointer-events: none`. No guard test in `docs/rules/eric.md` is touched.

## Tests: important cases not covered

- Finding 1: a free leave by one member plus a loss by another, then re-forming. Also a party copy that **spends lives alone**
  (`finishTowerFloor` with `kind: "party"` and `lost`) and then re-forms: the decision says those lives come back, and no test pins
  either half.
- App `settleKept`: a `"between"` answer after a free leave (finding 3), and a finish 409 carrying an open run with `lost` that
  includes the floor (finding 2).
- Core: `finishFloor` with `lives` lowered below a run's `lost.length` (finding 4).
- A party losing floor 99 with a life left (top for every copy, `TowerPartyResult`'s top line).

## Verdict

The core rule, the stored data and the best are sound. Lives are written only by the server's own paths, old runs read correctly,
a lost floor never raises a best or pays a crate or win XP, and the screens keep Eric's fixed, always-shown layout with good e2e and
unit coverage. One finding should be fixed before merging: the party's re-form refunds a life spent in the party's own room whenever
the plan goes back to that floor (finding 1). That breaks the decision's "nobody is given back a life they spent" and makes free-leave
practice risk-free; the fix is one line with a test. The rest are minor client misreads of rare retry and multi-device answers
(findings 2, 3 and 6), a latent tunable edge (4) and hardcoded words (5). They can go in this PR or a follow-up. With finding 1
fixed, I'd merge.
