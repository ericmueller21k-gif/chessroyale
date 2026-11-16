# Notices sit on top, never push the screen (Eric, Nov 16). Haiku, medium. Step by step

Light lane (CSS and markup, no new logic). New branch `claude/notices-on-top` from main. Include `notes/briefs/rules-common.md`.
Eric's screenshot: `notes/briefs/assets/notice-pushes-boss-battle.png` (on `claude/director-notes`): on the Boss Battle screen the
"That match has ended. / See your result" box sits in the page and pushes the boss tiles, the stage and START down; and the line
"That party has closed." under START overlaps the difficulty row.

Eric's words: "Look at how it pushed everything down. We should make these style pop-ups always just sit on top of everything else.
... They shouldn't ever push anything around on the screen."

## Steps
1. `packages/app/src/screens/Home.tsx`: `Notice` (the `.fd-notice` box) is rendered in two places (around lines 976 and 1246, `{notice
   && <Notice notice={notice} />}`). Keep both, but make the box float: in `packages/app/src/styles.css`, `.fd-notice` (around line
   9636) gets `position: fixed`, centered across the top of the screen just under the page header (`top`: below the header's height;
   use the same safe-area inset the header uses), `left: 50%; transform: translateX(-50%)`, `width: min(480px, calc(100vw - 32px))`,
   `z-index` above every page element (check the highest z-index the front-door screens use and go above it, below real modal
   sheets), and a soft shadow so it reads as on top. On a computer, center it over the main column (not the side menu).
2. The two places it was in the page now take no space: nothing above or below them moves when it shows or hides.
3. The Boss Battle screen's party error ("That party has closed.", `bossParty.error` from `App.tsx` line ~2089 into the Boss Battle
   screen): find where it's drawn under START, and show it with the same floating `Notice` (text, an X to dismiss) instead of the
   line under START. Its old place takes no space.
4. Do the same for any other line or box on the front-door screens that appears and pushes things (search `Home.tsx` for
   conditional notes/errors rendered in the flow: `leavesShown` uses the same `Notice` already). List what you changed.
5. **Eric's new standing rule:** add to `docs/rules/eric.md` under "Every screen": "**Pop-up notices sit on top of the screen and never
   push anything** (Eric, Nov 16: 'these style pop-ups always just sit on top of everything else ... They shouldn't ever push
   anything around')", with its guard test (step 6).
6. **The guard test:** in `e2e/lobby-close.spec.ts` (it already opens the "That match has ended." notice), add one test: on the home
   screen and on the Boss Battle screen, read the box of one fixed element (home: the PLAY button; Boss Battle: the first boss tile
   and START) with the notice showing, dismiss it (its X), read again: the boxes are equal (to 1 px). Also check the notice is on
   top (`document.elementFromPoint` at its middle is inside `.fd-notice`). Phone and computer.
7. Run `npm run typecheck`, then only the spec you changed: `npx playwright test e2e/lobby-close.spec.ts` (and `e2e/landing.spec.ts`,
   which checks the notice's text). Take one still per platform with the notice showing (home and Boss Battle) and push them to
   branch `stills/notices-on-top` (never images under docs/).
8. A 5-line decision note `docs/decisions/2026-11-16-notices-on-top.md`; update `docs/areas/hub.md` where it describes the notice.
9. Write `.pr-body.md` (what changed, player-visible, checks old -> new: the new guard; list any changed check) and `.done`; push.
   No PRs. Commits end with the Claude-Session line only, no model names.
