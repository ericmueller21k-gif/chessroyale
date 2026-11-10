# The second flaky batch: six tests, their causes, and the longest fixed waits (Nov 9, 2026)

The pipeline audit's F1 and F6 (`notes/pipeline-audit-2026-11-09.md` on `claude/director-notes`), by #564's method: find
the cause, fix it there (the app, or a test racing the app), never a longer timeout, a retry or a looser number. Lane:
targeted. Retries are untouched (the director decides once this lands). Each proved with `--repeat-each 10` at
`--workers 2` on the project(s) it failed on, and where it wouldn't reproduce, from main's CI traces and logs.

## The six

- **`dash.spec.ts:241`, Scramble Rush (two causes).**
  - **`toContain "c3"` on the watcher's `shook` list (test).** The watcher samples once a frame; the refusal, its "No more
    tries", the next click and the test's read of the list can all land inside one frame under load, so the 360 ms shake
    hadn't been sampled yet. Seen locally 1 in 12; CI 15 times (runs 1179 and 1183 among them). **Fix:** the read waits
    for the watcher's next frame (`expect.poll`, 2 s). Instrumented first: the refusal always found the piece and set the
    class; only the read was early.
  - **A put-back lost: "right" edges 2 of 3 (run 1135), 3 of 4 locally twice in about 70 (app).** The Rush's pointer
    handlers read the drag and the picked piece from state, and a pointer event can come before the re-render that hands
    them the new state: a drag's moves all read "no drag", so its release (with `moved` still false) dropped the piece.
    Caught with a log of every press and release (`moved:false` at release, the pointer over the piece's square). **Fix:**
    `DashRush.tsx` keeps the live drag and pick in refs, the state only for drawing. **Check:** the 3-of-6 test's extra
    wrong put-down is now a drag dispatched in one task (press, four moves, release, no re-render between): red 4 of 4
    on the old code, green on the new. The three Rush tests, 10 each on both projects: 59 of 60 green.
  - **Not explained: one red of those 60**, the 0-of-6 test on a phone, two page errors ("Cannot read properties of
    undefined (reading 'signedIn')" and "… 'name'"): a profile without its `user`. That test never drags. Not seen again
    in 15 more runs, and in no main run's log (1119-1183); left for the director, with what's known here.

- **`home-ranked.spec.ts:242` (was :240/:300), "390×844, the first pick: ranked's y", 3 px (test).** Home asks for its
  web font (Archivo, `font-display: swap`) as it renders, after the page's load, so `goto` doesn't wait for it; it lands
  about 2 s in and every line on home gets a px or two shorter (1 px here, 3 px with CI's fallback font). Only the first
  size, as the font is cached after. Measured: home's labels 15 → 14 px and the RANKED row 336.2 → 337.2 at 2.1-2.7 s, every
  load; with the font delayed 3 s the move came at 5.1 s. **Fix:** the test measures after `document.fonts.ready`, as the
  file's other layout tests already do. (Not the app: the move is on load, before any tap, and is what `swap` does.)
- **`sound.spec.ts:61`, "Big Boy drawn" (test).** From run 1171's trace: the test aimed at Big Boy while the camera was
  still gliding to him (`__townGlide`), so the tap landed on the map, you walked off there and the camera followed you
  away; each later try then found him off the screen. **Fix:** each try waits for the camera to stand still over two
  frames before aiming.
- **`town-chat.spec.ts:1194`, an edge chip "stays put as the log fades": 30 px vs < 15 (test).** From run 1171's trace:
  Crumb (a bot) walked past the left edge as the log faded and his name tag pushed Wrangler's chip 24-30 px down the edge.
  Chips keep off name tags by design; the check is about the log, not the walkers. **Fix:** a test switch,
  `__townStill()` (no bot sets off: the bots' source and turns paused, as `__townSeat`/`__townCall` already do), and the
  test waits for the walks under way to end before measuring.
- **`formats.spec.ts:194`, 11-13 px vs ≥ 16 (gone with its check).** All five events were "16 px between the boss and the
  God King", the result screen's God King; e425d1e (Boss result v2, Nov 9 06:25 UTC) took him off that screen and the check
  with him. No event in the ten main runs since (1119-1183). Nothing to change.
- **`squads-three-boards.spec.ts:181`, "Turn order on board 3" (app).** From run 1171's trace: "Watching Board 3 · your
  next board" after a tap on board 2. After your Relay move, "Jump to my next board" fires 600 ms later unless you've opened
  a board; a tap on your *own* tiny board set no board (your own is the default), so the jump still came and took you off
  the board you had just opened. **Fix:** `SquadsMatch.tsx`: any tiny board you open calls the pending jump off. **Check:**
  the test opens its own board at once after moving and finds it still there past the jump's time: red 3 of 3 on the old
  code (the same 2 → 3 and 3 → 1 as CI), green 20 of 20 on the new.

## The longest fixed waits (F6)

- `town-chat.spec.ts:1466` (15.5 s): Cy's second line waits only what's left of the server's one-line-a-player gap
  (`TOWN_CHAT.gapMs`) since his first, not the whole gap again.
- `matchmaking.spec.ts:110` (10 s): what's left of the lobby's fill time (8 s, plus 2) since it opened.
- `gardener.spec.ts:323` (9 s): the hidden page's garden clock is shown standing still directly: the meter's fill
  (redrawn every 250 ms; read after one redraw once hidden) doesn't move in 2 s, where a running clock moves it a quarter
  of a seed; the seed count is still checked. (A new check: the old one only counted seeds.)
- `tiger.spec.ts:319` (7 s): polls until the pump's balloon is ready (and, on a phone, Babur is home on the bar).
- `pig.spec.ts:167` (6 s): waits for the scout's own search to wind down (`ShowdownScout.idle()`), at most the 6 s a crowd
  might think.
- `town-afk.spec.ts:254` (4 s): the page's clock (`page.clock`) jumped past the real rule's boot (`TOWN_AFK.bootAfterSec`
  + 60 s): the rule reads `Date.now()`, so this checks "however long" as 4 s couldn't. Checked the other way once (a scratch
  test, not kept): with the rule on, the same jump puts the zzz up.
- `desktop-board.spec.ts:287-288` (8 s on the duel, 15 s on the Crowd, its vote and Squads): "one board size through the
  game" now watches each screen through what happens on it, polled. Measured first (a probe of each screen's phases over the
  old waits): the duel's 8 s saw only its "Your first move" countdown, nothing played, so the test now plays your first
  move and waits for the bot's reply ("Their move", then "Your move"); the Crowd's turn ends, reveals and plays again
  (about 6 s); the vote screen waits for the next vote to begin (a vote's result and the next start); Squads for the half's
  show (about 12 s).

Proof of the waits: each test 3 times at `--workers 2` on its project(s), all green (desktop-board's four screens on a
computer; matchmaking, pig, tiger, town-chat, town-afk and gardener on a phone, tiger on a computer too). Times now:
desktop-board's crowd 15 s, vote 19 s, duel 19 s, squads 27 s; tiger 17.5 s; matchmaking 23.5 s; town-afk 5-6 s.
