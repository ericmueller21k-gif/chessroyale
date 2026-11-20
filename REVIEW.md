# Delta review: PR #839, Battle Tower: two lives (`claude/tower-lives`)

Independent delta review, read-only on the PR's code. First review: `review/tower-lives` (head reviewed `a9b02eb`). Fixes reviewed:
`git diff a9b02eb..origin/claude/tower-lives` (head `9231c9a`: `0d36e2a`, `2ba09c6`, `c49b6d4`, `e71cc6a`, `9231c9a`), read with the
author's `.review-fixes.md`, the decision's new section and the area page.

What I ran:

- `npx vitest run` on core `tower`, server `tower`, `tower-party`, `tower-party-do` and app `tower`: 111 passed.
- Throwaway scenario tests (not committed): 3 server, 1 app. Results below.
- `vite build` of the app on `origin/main` and on this branch, to check the CSS cause. I compared the order in which the Town chunk
  preloads its stylesheets.
- CI on the PR head: `check`, `unit`, `chess (1)` and `chess (2)` green. The e2e run (15 shards) was still in progress when I wrote
  this, so read its result before merging.

## The first review's findings

### 1. Fixed. A life spent in the party's room no longer comes back on a re-form

`packages/server/src/tower.ts:776-781`. The re-form now counts each copy's floors lost below **its own** party floor
(`partyFloorOf(c, membersOf(c.members)!)`), not below the plan's floor. Two things keep this correct:

- A floor lost in the room always leaves the copy's `party` above it. `partyFloorWrite` sets `party` to the floor after.
- A floor lost alone is always at or above `party`. The first alone start fixes `party` at the copy's floor, and alone routes never
  move it.

So room losses are kept and alone losses are dropped, as the decision says. The non-null assertion is safe: `partyPlan` returns
`new` whenever any copy's `members` doesn't parse. The party's count is still the longest single list, so no member ends up with
more lives than their own filtered copy holds. Nobody is given back a life they spent.

The fix lets a re-formed run's `lost` hold a floor at or above the run's own floor (for example `[2]` on floor 2). The next re-form
would drop that floor if it relied on each copy's own filter alone. It is kept because the reduce starts from `dealt.lost`: the
base copy's own `met`, or its `partyMet`, both unfiltered. I checked that this holds on each path (throwaway tests, all passed):

- **T1. A subset party's loss above the plan floor.** Ann, Bo and Cy reach floor 2. Bo leaves floor 2 for free. Ann and Cy win
  it and go on alone as a pair. On floor 3 Ann's leave counts (`lost: [3]`, floor 4). All three re-form, back on Bo's floor 2:
  `lost` is `[3]`, 1 life. Ann's life stays spent. They win 2 and 3 again and reach floor 4 with `lost: [3]` and 1 life.
- **T2. The room dies after a re-form below the lost floor.** The run is re-formed onto floor 2 with `lost: [2]`. Bo's copy is
  written as won before the room dies; Ann's is let go by `settleStale`. Re-forming again gives `[2]`, through `dealt.lost`.
- **T3. Played alone after such a re-form.** Both play floor 2 alone and win it, so both copies sit on floor 3 with party floor
  2. Re-forming gives `[2]`, through `partyMet`. Then Ann loses floor 2 alone (`[2, 2]`, 0 lives). Back with Bo it's `[2]`: the
  alone loss comes back, the room's stays.

The author's new tests also pin the reviewer's scenario in both seat orders, the three-member variant, and a life spent alone that
comes back.

### 2. Fixed for the case reported. The check it uses can misread a floor the party went back to

See new finding A.

### 3. Fixed

`packages/app/src/tower.ts:412`. A `"between"` answer with the run still on the kept floor is now read as free. A counted leave
always moves the floor on or ends the run, and a top run isn't open, so `run` is null. The check can't misfire on a counted leave
whose first answer was lost. Unit tested both ways.

### 4. Fixed

`packages/core/src/tower.ts:231`: `outcome !== "won" && lost.length > s.lives`. Tested with `lives` lowered to 1 and two floors
lost: a win climbs on with 0 lives left, and the next loss ends the run. `leaveFloor` reaches this rule only through a loss, so the
same guard covers it.

### 5. Fixed

The clerk's two lines are now built from `BATTLE_TOWER.lives` (`livesWords`, `ordinal`). `ordinal` handles 11th to 13th and
111th. No other hardcoded lives words remain in `packages/*/src`; only comments mention two lives.

### 6. Fixed, but without a test

`TowerResult.tsx:47`: `free = left && !!said?.free`. A free leave shows "You left floor 8. It waits for you.", then the same floor
next, with `data-tower-result="free"`. The server's status for a free stop is `open`, so its sub line is `nextLine(floor)`, which is
right. Town already sent this case to the lobby. Nothing tests this screen state: no unit test and no e2e. See minor finding C.

### The CSS cause fix (the e2e failure)

The author's diagnosis is confirmed by both builds. On `main`, the Town chunk preloads `Town.css` and then `tower.css`, so tower
won equal-specificity ties. On this branch it preloads `tower.css` and then `Town.css`, so town wins every tie. The new
`.tw-desk .tw-plan` (0,2,0) beats `.town-card-text` (0,1,0) whatever the order, which gives the plan line `main`'s usual look:
12 px / 1.3, margin 2px 0 0, weight and family from the town rule. The e2e copy is cloned into the same parent, so it stays inside
`.tw-desk` and gets the same rule. The spec's `tall.real ≈ 3 × line` check would catch the mixed 13 px / 1.35 again.

**Any other element whose style depended on the order?** None found:

- I listed every rule in the built `Town.css` that can match the clerk's card. That is `.town-card`, `.town-card h2`,
  `.town-card-text`, `.town-btn`, `.town-btn.primary`, `.town-btn:disabled`, and `.town-card .town-btn` with its `.primary`,
  `:disabled` and `:focus-visible` forms. I compared them with tower.css.
- The only equal-specificity pairs are `.town-btn.tw-over` against `.town-card .town-btn`, `.town-btn.primary` and
  `.town-btn:disabled`, and `.tw-desk-row > .town-btn` against the same rules. Each pair sets disjoint properties.
- No `Town.css` rule names a class the match screens use with tower.css (`.btn`, `.bs-start`, `.boss-side`, `.bs-inv-btn`,
  `.boss-portrait`, `.actions`, any `tw-`).
- The game-screens chunk's CSS order is the same in both builds.
- The floor room's `.tw-room-lives` has no town rule at its specificity.

### Eric's rules and guard tests

- **Nothing hidden, nothing shifts.** The plan box keeps its fixed three lines, now order-proof. The hearts and the clerk's lives
  line are always there. The free result uses the same line, sub line and button as the other results.
- **Guard tests.** Nothing in `docs/rules/eric.md` names a tower spec, and no guard test is touched. The one e2e change in the fixes
  adds two measured candidate lines (`lives: 0`) to `e2e/tower-party.spec.ts` "the clerk's card". Nothing was removed or loosened.

## New findings

### A. Minor: the finding 2 fix reads a floor the party went back to as "lost" after another device left it free or won it

`packages/app/src/tower.ts:428`: `done === "won" && run?.lost?.includes(k.floor) ? "lost" : done`.

**Why it misfires now.** Before the finding 1 fix, a floor on a run's `lost` list was never played again in that run, so
`lost.includes(k.floor)` meant this floor was counted lost. Now a party copy can sit on a floor that is already on its `lost` list:
a re-form below a room loss, as in the author's own test (floor 2, `lost: [2]`). When that copy is played alone, the check reads
the old loss as this attempt's.

**Scenarios** (checked with a throwaway app test against `settleKept`):

1. Ann plays the copy alone on floor 2 on her phone. On her computer, which rejoined the same fight, she leaves floor 2 for free.
   The copy stays on 2 and nothing is spent. The phone then sends `won` and gets a 409 with `{floor: 2, lost: [2]}`. It reads
   `outcome: "lost"`, and the result screen says "You lost floor 2. It still counts: 1 life left." and "Next: floor 3". Nothing was
   spent, and floor 2 waits.
2. The computer wins floor 2 and then plays floor 3 out, so `last` no longer names the phone's fight. The phone's `won` gets a 409
   with `{floor: 4, lost: [2]}` and reads "lost". Before the fix it read "Floor 2 cleared!", which was right.

**Impact.** Screen words only; the server's data is right. It needs a party re-formed below a room loss, the copy then played
alone, and two devices on one floor. Rare.

**Suggested fix.** Read "lost" only when the run went on by exactly this floor with a life spent on it:
`run && run.floor === k.floor + 1 && run.lost.at(-1) === k.floor`. When `run.floor === k.floor`, the floor wasn't counted (left free
elsewhere). That case already read "cleared" on `main`, so it isn't new: it could set `free` and the screen could honor `end.free`
for any outcome, or it can stay as it is.

### B. Nit: "Lost floor 3 3 times"

`packages/app/src/tower.ts:121`. A floor lost three times, which is possible with two lives (one member's free leave, another's
loss, three times over), reads "Lost floor 3 3 times". The digits run together. Use "three times", for example from a small word
list like `livesWords`'s. The test at `packages/app/test/tower.test.ts` pins the current text and would change with it.

### C. Minor (tests): `TowerResult`'s two new states are untested

The server's "lost" winning over the match's win (finding 2's display) and the free leave (finding 6) have no test. `settleKept` is
unit-tested, but the screen's choice of `outcome`, `free`, the line, the sub line and `data-tower-result` is not. The app has no
component-render harness. A cheap way to cover it is to move the line and state choice into a pure function in `tower.ts` (as with
`spentLine`) and unit-test it. Can go in a follow-up.

### D. Nit: `.tw-desk .tw-desk-note { margin: 4px 0 0 }` is dead

`packages/app/src/tower.css:13`. The only element with `.tw-desk-note` also carries `.tw-plan`. The rule `.tw-desk .tw-plan`
(line 277) has the same specificity, comes later in the file, and sets `margin: 2px 0 0`, which always wins. The same was true on
`main` whenever tower.css loaded last. Delete the rule, or the class, so nobody edits a margin that never applies.

### Cosmetic, already noted by the author

- A floor lost and then won on a replay stays out of the run view's `beaten` list (`server tower.ts:236`). In T1, floor 4 showed 2
  floors beaten, not 3.
- After a re-form, `lost` may list a floor above the run's floor, and floors can appear out of order: "Lost floors 3 and 2" in an
  alone copy's end recap.

All rare. Lives and bests don't depend on them: party bests come from `bestStmt`, alone bests from `aloneBest`, and `soloBest`
reads only `kind = 'solo'`, whose runs never repeat a floor.

## Verdict

**Ready to merge** once the PR's e2e run is green.

All six first-review findings are fixed. Finding 1, the blocker for merging, is fixed at the cause: room losses stay spent, alone
losses still come back, and a merged `lost` that holds the plan's own floor survives the next re-form, a dead room and alone play.
The CSS fix is at the cause and order-proof, and no other element depended on the stylesheet order. No guard test is touched.

The one new defect is minor: the finding 2 check can misread a floor the party went back to, as "lost", on a copy played alone
across two devices. It touches screen words only, never data, and its fix is one condition. It can go in this PR or a follow-up,
with the "3 times" wording, a test for the result screen's new states, and the dead CSS rule.
