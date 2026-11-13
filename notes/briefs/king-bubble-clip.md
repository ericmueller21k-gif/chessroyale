# The God King's words cut off on a computer (Eric, Nov 13) — a small, step-by-step job

Effort medium. **Light lane.** Branch `claude/king-bubble-clip` from main. Read CLAUDE.md and `.claude/LESSONS.md` first.

## The problem
On a computer, in a boss battle, the God King's speech box (`.gk-bubble`, e.g. "Your king's in check! Answer it.") opens to the right
of him and is cut off at the right edge of the game's box. Eric: "we don't want it to be cut off like this... It's okay if it covers our
pawn up a little bit... shift everything over to the left."

## Why (found by the director)
The box already keeps itself on screen, but it measures against the whole window (`innerWidth`), while it is clipped earlier by the game
screen's own box:
- `packages/app/src/speech.tsx` ~line 316-325 (`useLayoutEffect` with `fit`): `out` and `dx` use `innerWidth` as the right edge.
- `packages/app/src/components/BossCharacter.tsx` ~line 628: `--king-room` (the box's max width) uses `document.documentElement.clientWidth`.

## Steps
1. In `speech.tsx`, in that `useLayoutEffect`, add:
   `const clip = e.closest(".screen")?.getBoundingClientRect(); const maxX = clip && clip.width > 0 ? Math.min(innerWidth, Math.floor(clip.right)) : innerWidth;`
   and use `maxX` instead of `innerWidth` in both `out` and the `dx` line. (This moves the box left until it fits, over the pawn if needed.)
2. In `BossCharacter.tsx` ~628, measure the room to the game screen's right edge instead of the window's: use
   `screen.getBoundingClientRect().right` (the `screen` element already in that function) in place of
   `document.documentElement.clientWidth`, keeping `- SIDE_FEEL.margin - kingLeft - 4`.
3. Check every boss on a computer (1280×800 and 1440×900) and a phone (390×844), while he says his longest lines (check, a capture):
   the box whole on screen, never cut. Add ONE focused check to an existing spec (e.g. `e2e/boss-side.spec.ts`): on a computer, force a
   God King line (there are test hooks for his voice; search `kingVoice` in e2e) and assert `.gk-bubble`'s right edge ≤ the `.screen`'s
   right edge.
4. Typecheck; run that spec on both projects.
5. Stills: one full screen per platform with his box showing (on branch `stills/king-bubble-clip`, never under docs/).
6. A ~5-line decision note in `docs/decisions/`. `.pr-body.md` (what changed, player-visible, changed checks old → new), push, then
   `.done`, and stop. No PRs, no CI waits. No model names in commits.
If step 1-2 don't fix it (the clip is some other box), stop, push what you found in `.pr-body.md`, and push `.done`.
