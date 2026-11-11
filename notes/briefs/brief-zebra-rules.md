# Brief: Don Dough, a new boss (rules, battle screen, admins first). Opus, xhigh

Branch `claude/boss-zebra` from origin/main (create it; `npm ci`). Read `CLAUDE.md` (the boss lane, "Working lean"),
`docs/rules/eric.md`, `docs/areas/bosses.md` (**"Adding a boss"**: follow its checklist; Timber and Babur for a meter and a filter),
`docs/areas/god-king.md`, and include `notes/briefs/rules-common.md`. **Eric's words: `notes/zebra-eric.md`** (all of it; it wins over
this brief). Notes and briefs are on `claude/director-notes` (`git show origin/claude/director-notes:<path>`).

## The art and the words (approved by Eric; don't redraw)
On `origin/claude/boss-art` (read with git show; copy in as the other bosses' art came in, with a line saying where from; don't merge
that branch): `scripts/boss-art/out/boss-zebra/` (Don Dough: every move incl. `breadPop`, `volley`, `drop`, `goldPlate`), `zebra-props/`
(`zebra-dough.ts`: the dough per kind with `land`/proof/`rise`/`squash`; the oven timer `ZEBRA_TIMER`; the bread splash), `zebra-gold/`
(the gold piece SVGs, recolored cburnett: add the line to SOURCES.md; `GOLD_FX` gild/glint/clink), and the notes `zebra-nov10.md`.
His words: `zebra-openings-nov10.md` (opening comments, Rising Dough's and Gold Plate's lines). **Gold Plate's 10-second moment** is
being finished on the same branch now (`zebra-nov10.md`, its Gold Plate section, and `boss-zebra/gifs/goldPlate.gif`): pull it when
`scripts/boss-art/out/zebra-art.done` is back; build the rest first.

## The design (Eric's; the director's calls marked "call")
- **Name Don Dough, id `zebra`.** Admins first (`BOSS_ADMIN_FIRST`); say in the PR how to put him live.
- **Opening comment:** about 3-4 moves in, once a game, he names the crowd's opening (the library's names, "starts with", most specific
  first; the fallback otherwise) with one of its two lines, in his voice.
- **Passive: Rising Dough.** Early in the battle, a few times, he drops a lump of dough on an empty square of his half; **you see what it
  will be** (pawn, knight, bishop, rook, queen). An **oven timer** per lump on his side (`NN:00`), **one minute off per move** (the crowd's
  and his), the digits' fast roll each time; at 00:00, if its square is free, his piece rises there (`rise`). **Starting numbers (Eric):
  pawn 4, knight/bishop 7, rook 10, queen 15.** Rook and queen rare, placed near his side but where a crowd pawn can get at them. **Squash
  (call):** any crowd move that lands on the lump's square squashes it (`squash`); his own pieces never move onto it; it never blocks a
  move through it. Every rise passes the usual guards (no pawn on rank 1/8, no impossible counts, the side not to move never in check, a
  position Stockfish plays); a blocked rise waits for the next move. **Calibrate by sim** (the drop count, turns and odds, the timers) so a
  battle averages about 1.5 pawns up to about a knight of risen material, a queen only now and then (Eric: "you're not going to have too
  much trouble squashing his pieces"), and his win rate sits with the roster's; numbers in settings, the report in `reports/`. God King
  line: "Squash it before it rises!"
- **Ultimate: Gold Plate** (the meter and warning as usual). **About 10 s** (Eric): his cast, his queen turns shiny gold on its square,
  a beat of shine, then his line (one of the six "your pawns are worthless" options at random). **From then on, crowd pawns can't capture
  that piece** for the rest of the battle (other pieces can). Calls: no queen → his strongest piece; a second Gold Plate gilds the next;
  he keeps his turn (cast, then his move); if the rule would leave the crowd no legal move, it lifts for that move (as the hoops). Built as
  Big Boy's blocks / Babur's hoops: `crowdFilter`, `stopReason` "gold" (the pawn's `clink` and a line), the engines and the judge over the
  moves left (searchmoves). The gold piece drawn with the gold SVG and its glint wherever the board is drawn.
- **On the battle screen:** `breadPop` as his battle start (the line, a crew line if room), the **bread splash** as his splash, `volley`
  as his attack on the God King's save (as the other bosses' swats, "A boss's attack on a king"), his moods and lines like the others,
  the timers in a fixed place (nothing shifts: phone and computer, the 50 v 50/raid layouts), the dough's drop/rise/squash on the board.
- **Sounds:** make his pack the way the newest bosses' were (cues in the art notes).

## Keep
- Frame rate (eric.md): the timers and the glint must not cost frames: measure vs an existing boss the eric.md way. Nothing per frame.
- The boss kit passes for him (`boss-kit.test.ts`, parity, `boss-smoke`); his own `packages/chess/test/zebra.test.ts` and
  `e2e/zebra.spec.ts`; FAQ block; his row in bosses.md; a decision note (≤10 lines). His paths in `e2e/areas.json`.
- The bakery home (the town, the back room, the chatter, the challenge intro) is **another helper's** (branch `claude/zebra-home`):
  don't touch `packages/app/src/town/`. Agree only through the boss id and his kit.

## Deliver
Stills/GIF to orphan branch `stills/boss-zebra` (a battle on a phone and a computer: a drop, a timer rolling, a rise, a squash, Gold
Plate, a pawn's clink). Push; PR title "Don Dough: a new boss (admins first)"; body (≤40 lines: player-visible changes, the sim's
numbers, FPS, changed checks old → new, the lane) to `.pr-body.md` on your branch; `.done` as the LAST push. Wait for green CI.
