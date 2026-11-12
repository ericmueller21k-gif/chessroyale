# Town: a tap on or near a building's foot or door walks you to its door and brings up "Go in" (Nov 12)
You are a helper for HunChess (repo ericmueller21k-gif/chessroyale), the town lane. Effort: high (the town's tap targeting).
Read CLAUDE.md, .claude/LESSONS.md, docs/rules/eric.md (the town's rules and guards), docs/areas/town-square.md (taps, cards, homes,
doors: `homeDoor`, `destFor`, `plotAt`, the "Go in" / pass card). Code: packages/app/src/town/Town.tsx (the tap's pick: hit kinds
"house", "square" with `plotAt`, "boss"…, ~line 1590-1640, and `walkHome`), packages/app/src/town/world.ts (`destFor`, `homeDoor`, `plotAt`,
HOMES), the picture hit-testing that produces `hit`.

Eric, Nov 12, with a screenshot of the foot of Alfil's (the elephant's) building, its door and the tiles in front partly under it
(branch claude/director-notes, notes/mockups/2026-11-12-eric-alfil-door-tap.png): "It's actually a bit challenging, especially on mobile,
to... trigger the thing that lets you walk into a building. So basically when you click any pixels that are at the bottom of the building,
especially where the door is, even on the tiles that are not fully displayed that are underneath the building, that should trigger your
guy to run to... one of the two tiles directly in front of these buildings, that would then always pull up the go inside message for both
mobile and desktop. It already functions like this when you click certain parts of the building, but we just want... more grace where you
can click anywhere near or on the building, and it should make your guy run and then give him the go in message."

## Build
- Find which taps today miss: the building's lower rows of pixels, its door, the ground tiles in front of it that its picture covers
  (or half covers), and the ground right at its foot. Any of those, on every home (each boss's building, the Colosseum keeps its own rule),
  becomes the home's tap: you walk to the square(s) right in front of its door, and on arrival the same "Go in" message/card shows that a
  tap on the building shows today. Phone and computer alike.
- Grace: a tap within about one square of the building's foot (its front edge and the two door squares), or on any square its picture
  draws over, counts as that home. Never steal a tap that clearly means something else: a person, a boss standing outside, a table, a
  statue, a path square away from the building. When two homes are near, the nearest door wins. Say the exact rule you chose.
- If a home's door squares are taken by someone, use today's rule (`doorway`: the square beside).

## Tests (targeted lane: the town)
A unit test of the pick: for each home, taps on its foot pixels, its door, the covered tiles in front and the ground just in front all give
that home; a tap two squares out on open ground gives a square. One focused e2e check in the town's existing spec (find it in
e2e/areas.json, town-street or town spec): on a phone, tap the bottom edge of Alfil's building and the half-hidden tile in front of his door:
you walk to his door and the Go in card shows; same on a computer. Typecheck; run the touched specs locally under the e2e lock (if
Playwright looks for chromium_headless_shell-1194, run:
`mkdir -p /opt/pw-browsers/chromium_headless_shell-1194 && ln -sfn /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64 /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux && ln -sfn chrome-headless-shell /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/headless_shell`).
No frame-rate run (the frame loop isn't changed). One still pair (phone 428 x 746 first, then computer) on branch stills/town-door-tap
showing where a tap now counts for a home (e.g. a translucent overlay in a debug view), never images under docs/. Aim for about an hour;
usage is low this week: keep it lean.

Branch claude/town-door-tap from origin/main; push at each real step. A ~5-line decision note docs/decisions/2026-11-12-town-door-tap.md;
update docs/areas/town-square.md. When done: push .pr-body.md (what changed, player-visible, the rule, changed checks old -> new, tests run),
then .done last. Don't open a PR or wait on CI. American English. Never include model names in commits.
