# The Hidden Boss online: his phase change and the four boards (Eric, Nov 13: "it plays through till the end")

Effort xhigh, **full lane** (server, protocol, the online match, fair play): add the `full-e2e` label request to your PR body; an
independent review follows. Branch `claude/recluse-online-phase2` from main. Read CLAUDE.md, `.claude/LESSONS.md`,
`docs/areas/bosses.md`, `docs/areas/match.md`, `notes/hidden-boss-today.md` and `notes/briefs/hidden-boss-house-NOTES.md` on branch
`claude/director-notes` (how he works today; the plan).

## Today
- His fight: form 1 today = adult (bullet, no help, chatter); beating it → the book drops, the board splits → phase 2, four boards
  (`packages/chess/src/bosses/recluse-phase2.ts`, `packages/app/src/recluse-phase2.ts`, `screens/Recluse2.tsx`). **Solo only.**
- Online (his room's fight, #673: a party battle lobby of four, `hiddenRoomSettings`, `partyMove`), beating the adult form ends the
  fight as a win. The admin 🏆 `{ t: "winForm" }` forces the adult form's end (`bossForceWin`).

## Build
- **Online, beating his adult form plays the phase change and then the four boards**, to the real result, for the room's party of four
  (humans and the admin's test bots). Server-authoritative: the server runs the boards, Stockfish on the engine server where the solo
  version uses the device's (CLAUDE.md computing priorities: devices first only where checked against each other; for his boards, the
  server where a player could cheat). Fair play judging as other online boss fights.
- **The phase change online** is synced for all four: the existing transformation (chant lines, music `introSeconds`, the crack) plays
  for everyone at the same time, then the four boards.
- **A cutscene hold:** between the adult form's end and the transformation, the server waits `RECLUSE_CUTSCENE.holdMs` (a settings
  number, 0 for now) and sends one event (`recluseCutscene`, with its start time) so a parallel job (the cutscene) can play there. Put
  the setting and the event in; don't build the cutscene itself.
- **The admin 🏆 works in every online form:** the team's next move wins the current form (adult, each of the four boards' stage /
  the four-board phase as a whole: your call, keep it simple, record it), all the way to the result.
- **Leaving / disconnects mid-fight** as other party battles; a seat gone → its bot plays it (as today).
- The 50 v 50 final reaching him online (if it can) uses the same path; say what you did.

## Parallel jobs (Eric, Nov 13, lifted one-at-a-time for the Hidden Boss)
Two other helpers work at the same time: **the child form** (`claude/recluse-child-form`: a new first form before the adult; boss brain,
sprites, music) and **the cutscene** (`claude/recluse-cutscene`: app-side scene during your hold). You own the server, the protocol, the
lobby and the online phase sequence. Keep the form sequence a list in settings (`RECLUSE_FORMS` or similar) so the child form can be put
first without touching your code paths; merge `origin/main` often; small, separate commits.

## Tests
Server unit tests for the online phase change and the four boards (start, sync, result, 🏆 in each form, a disconnect); an e2e in
`e2e/hidden-boss-room.spec.ts`: admin + 3 bots → 🏆 adult → transformation → four boards → 🏆 → the result screen, both projects.
Typecheck, the unit tests of packages you touch. List changed checks (old → new). Push work in progress at each real step; write
`.pr-body.md`, push `.done` and stop. Don't open PRs or wait on CI. No model names in commits. Never stop silently: if blocked, push
what you have and write the blocker in `.pr-body.md`.
