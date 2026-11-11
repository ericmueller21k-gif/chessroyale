# Review: Don Dough (PR #627, `claude/boss-zebra`): boss lane, one pass, read-only

**Verdict: merge after two small screen fixes (1, 2).** No breaks or hangs found. No illegal or engine-refused rises found. Solo and
online agree. Nothing touches the other bosses. Eric's words are followed. The two medium findings are the oven timer being drawn
wrong. Each fix is one line or close to it.

## Findings (most severe first)

1. **Medium: knight, bishop and queen timers never ring.** `packages/app/src/components/Zebra.tsx:203` (`OvenTimers`) reads
   `moments()`, which is `momentsOf(boss, until)`. That returns `[]` while he thinks, because `until` is 0 then (`Boss.tsx:106`).
   Odd timers (n/b 7, q 15) reach 00:00 after the crowd's move, so they rise while he thinks. The lump leaves `z.lumps`, its slot
   goes blank, and there is no 01→00 roll, no `kDing` frames and no `zebraDing` sound (the timer is the only place that plays it).
   This hits about 44% of drops by `doughOdds`. The e2e only covers a pawn (an even timer). Fix:
   `const ms = [...moments(), ...zebraTurnMoments(boss)];`
2. **Medium: the roll after his move is cut to its first frame.** `Zebra.tsx:214-219` writes `seenLeft` during render. While
   his move shows (`until` set), `BossBarExtra` redraws every frame (`useFrameNow`). On the next frame `before === left`, so
   `run` goes from `kRollNN` to `null`. `TimerCanvas`'s effect (deps `[kind, left, run]`) then clears the roll's timeout and
   draws the still. Eric asked for the fast roll "when he plays" too. The e2e passes anyway because `pRoll03:0` is frame 0.
   Fix: keep the previous minute in a `useRef` inside `TimerCanvas`, and run the effect on `[kind, left]` only.
3. **Low: a lump can be one that never rises.** `bosses/zebra.ts:101-118` (`doughKind`, `landRefused`) and its lead cap read only
   the board, not lumps still waiting. Example: a pawn lump while he has 7 pawns, then another pawn lump. Or two knight lumps
   with one promotion's room. The second one fails `riseCheck` forever. Its timer sits at 00:00 for the rest of the battle and
   blocks a `doughLive` slot. It's rare: it needs an overlap. Fix: run the kind checks on the FEN with the waiting lumps placed
   (`withPiece` each).
4. **Low: two rises on one move share a moment key.** `Zebra.tsx:320` uses `${kind}:${turn}:crowd`, and `momentsOf` uses
   `${kind}:${turn}` for his side. Example: a rook lump (10), then a pawn lump (4) 3 crowd moves later; both reach 00:00 on the
   same move. The second rise's line is dropped (the voice dedupes by key), and keyed views may merge. Fix: add `:${e.square}`
   to the key.
5. **Low: Gold Plate with nothing left to gild still says the closing line.** If his last minor or major piece is taken
   between the warning and the gilding, `gild.square` is null. The banner correctly says "Nothing of his to gild", but
   `goldClose` still says "your pawns are worthless against it". Fix: `line` returns null when `!m.square`.
- Nit: `godKing.ts` puts `dough:` under Dash's Scramble Rush comment. Move it above that comment.

## What I checked (read the diff, no runs)
- **Rules** (`bosses/zebra.ts`):
  - Drop, squash and rise order on both moves. One minute off per move, both sides. Squash by landing, en passant included.
  - Rise guards: `riseCheck` → `tidyEnPassant`, then `hoopsGuard` (no check either way, no mate in one, Stockfish plays it).
  - Gold moves with the piece, castling included, and is lost on capture. Stale gold can't happen.
  - Lift: `crowdFilter` lifts through the dispatcher. Last Stand: it skips `afterCrowdMove`, and `boardAltered` is true while
    dough is down.
  - Second Gold Plate: the dispatcher clears `ultAt`. Trigger spent (the state rebuilt whole).
  - Opening comment: once a battle, read from history before the first base. Freestyle and a raid start give the fallback.
- **Solo vs online:** `zebraTurnMs` is used in both `solo.ts` and `lobby.ts`. `Battle.library` comes from `runner.opts.library`,
  and `restore` passes it.
- **Shared code:**
  - `speech.tsx`: the nav clamp only kicks in when `.gm-frame > .fd-side` exists, at the left half.
  - `useMomentSpeech`: splitting on `\n` keeps the first part's key, `say("")` is a no-op, and no other kit line holds `\n`.
  - `frameImage` export, `MOMENT_UI` spread, `POWER_FX`, `KING_ATTACKERS`.
  - The board's `gold` prop: kings and pawns excluded, the gold set kept while a taken piece fades.
- **Eric's words:**
  - Per-move timer, one minute each side, squash by landing: followed.
  - Gold Plate: 10 s (`goldPlate: 10000`, line at 5.2 s, one of six by key): followed.
  - God King's "Squash it before it rises!", said once per drop: followed.
  - The opening comment once: followed.
  - Drops wait until he's lost a pawn and isn't ahead. That matches the "he rebuilds" design and the sim (2.1 pawns, a queen 1
    in 10 battles).
- **Frame cost:** timers on a timeout chain, glint on canvases redrawn only on frame change. Nothing per frame beyond
  `zebraItems`, a small list.
- **Layout:** `.dd-timers` is absolute in `.boss-prop`, so nothing shifts. Not checked by eye: the stills are the director's.
