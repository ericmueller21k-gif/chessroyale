# Battle Tower audit 2: the fixes (Nov 19). Opus, xhigh. Targeted lane (one PR)

The audit: `git fetch origin audit/battle-tower-2 && git show origin/audit/battle-tower-2:docs/decisions/2026-11-19-battle-tower-audit-2.md`.
Read it in full, then CLAUDE.md, `.claude/LESSONS.md`, `docs/rules/eric.md`. Branch `claude/tower-audit-2-fixes` from main; first merge
`origin/audit/battle-tower-2` in (the report; drop its `.done`). **Another helper is reworking the tower's flow in parallel** (branch
`claude/tower-flow`: the clerk's card, the elevator and floor room, removing the `/tower` screen from the flow; it owns `App.tsx`'s tower
routes, `screens/Tower.tsx`, the app's `tower.ts` `floorPlan`/`askFloor`/`settleKept`, and the town). So: **findings 3, 4 and 5 are NOT
yours** (they go to that flow). Yours, each fixed at its cause with a test that fails before it:
- **Finding 1 (blocking): every boss on a shared floor drawn from his own view.** The view names each event's boss and who made each
  of the side's moves (the runner knows both); the screens draw each boss's marks (`PowerBoard`, decor, gold, elephants) from his own
  part, `refusedLine` asks every boss on the side, the moments' caster and bubble are the boss who cast, the move list and "… is
  thinking" name the right boss. One boss: unchanged (the view's top level as today). One check in `e2e/battle-tower.spec.ts` or
  `several-bosses` (Sawyer's cut drawn on Ginger's turn; the banner names Sawyer).
- **Finding 2:** keep the floor whenever the runner changed (after the bosses' move and each power's step), so a reload rejoins after
  his reply. **The clock (the director's call):** the time you've used on this turn is kept with the game and given back as used on a
  rejoin; no time passes while you're away (a floor left overnight isn't lost on time).
- **Finding 6:** no new XP game on a rejoin. **Finding 7:** a new deck leaves out the bosses still waiting in the old one.
- **Nits:** the area page and the audit brief's "next to Auto chess" lines (Eric: the town's clerk only).
Effort xhigh (the runner's view for every screen, the restore). One still per platform of a shared floor for Eric (Sawyer's cut on
Ginger's turn). Done: `.pr-body.md` (lane, player-visible, changed checks old → new; under 40 lines) and `.done`; push and end. No PRs,
no CI waits.
