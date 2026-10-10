# Lessons

Things learned the hard way. Every session reads this before changing anything a player sees. Each lesson below is
its rules; the whole story (what Eric saw, the cause, how it was found, the fix) is in
[`docs/history/lessons.md`](../docs/history/lessons.md), and the rules for one area are on its page in
[`docs/areas/`](../docs/areas/README.md) too. When something slips past the tests, write the story at the end of
`docs/history/lessons.md` and add its rules here, under the theme they fit.

## Watch it frame by frame, not just the tests

Tests check *what* ends up on the screen, not *how it gets there*, nor how long a frame takes.

- **A move that snaps back** (Oct 6, [story](../docs/history/lessons.md#a-move-that-snaps-back-oct-6-2026)):
  - Before calling any change to a board, a move or an animation done, watch it frame by frame, with real taps on a
    phone-sized screen. Use `npm run frames:boss`, or a script like it for other modes.
  - Look for any piece that moves twice, jumps back or flickers.
  - Do this for the most common path (one plain move), not only for the new feature: a feature can be perfect and the
    plain move next to it still broken.
- **A white flash between moves** (Oct 6, [story](../docs/history/lessons.md#a-white-flash-between-moves-oct-6-2026)):
  - Anything imperative that draws what a player sees on a screen's first frame (chessground, a canvas, measured
    sizes) goes in `useLayoutEffect`, not `useEffect`.
  - No opacity entrance on screens that replace each other during play.
  - Check a change to screens or transitions with `npm run frames:flash` in light **and** dark mode: a blink that's
    invisible in one scheme is glaring in the other.
- **A board that vanished after it flipped** (Oct 8, [story](../docs/history/lessons.md#a-board-that-vanished-after-it-flipped-oct-8-2026)):
  never change what chessground draws (its orientation, its size) while a transform is on it or an ancestor. Animate
  it, then change it once the transform is gone, and watch the frames after the change too.
- **A move that went silent, a card that said "undefined", a prompt gone too soon** (Oct 10, [story](../docs/history/lessons.md#a-move-that-went-silent-a-card-that-said-undefined-a-prompt-gone-too-soon-oct-10-2026)):
  - A table keyed by a closed set (powers, events, beats) is typed by that set (`Record<PowerId, …>`), so a new member
    without an entry doesn't compile.
  - Anything a player hears or sees *as* something changes (a sound, a first frame) goes in a layout effect, and must
    not depend on a screen surviving to its next paint: screens can be replaced within a frame.
  - Test the realistic pace too: a test that moves at once takes a different path from a player who thinks.
  - Text a player must read to play (a prompt, a target) stays on screen for as long as it applies, in a place that's
    in view on every screen. A speech bubble is extra, never the only copy. Measure it through the whole moment, not
    in one screenshot.

## Measure what's on screen; don't trust a screenshot

- **Purity that didn't match the item** (Oct 6, [story](../docs/history/lessons.md#purity-that-didnt-match-the-item-oct-6-2026)):
  when a number on screen describes a drawing (a purity, a meter, a share), measure the drawing against the number
  over many cases, not one preview. Then add a test that does the same.
- **Coloured squares instead of the item** (Oct 6, [story](../docs/history/lessons.md#coloured-squares-instead-of-the-item-oct-6-2026)):
  wherever an item is named on screen, show the item, drawn by `ItemArt` or `Avatar`, never a stand-in (a swatch, an
  emoji, an icon). When a mockup uses a placeholder for real art, build it with the real art.
- **Cut names that lost their chips, and a top bar too wide for phones** (Oct 7, [story](../docs/history/lessons.md#cut-names-that-lost-their-chips-and-a-top-bar-too-wide-for-phones-oct-7-2026)):
  - When a screen adopts a shared component, check its own styles still apply: computed styles, not only the markup.
  - Check anything kept to one line on a phone at 360 px with its widest real content (long names, six-character
    scores). Measure it; don't only look at a screenshot at the test phone's size.
  - A fixed-height box with `overflow: hidden` hides what doesn't fit, and no test fails. Show whole items and count
    the rest instead.
- **An empty box under the board** (Oct 7, [story](../docs/history/lessons.md#an-empty-box-under-the-board-oct-7-2026)):
  - Give state classes a prefix (`ub-board`, not `board`). A plain word can already be another component's rule.
  - One state per view, changed only by named actions, not one setting per button. When a control makes something
    bigger, it shows its content.
  - For a panel with several controls, test every button from every state, with a reload after each, and assert the
    panel is never an empty box (`e2e/panel.spec.ts`).
- **A vote board that jumped, and zones that pulsed green** (Oct 7, [story](../docs/history/lessons.md#a-vote-board-that-jumped-and-zones-that-pulsed-green-oct-7-2026)):
  - When one screen hands a board to the next, give both the same frame (top line, the line above the board, the eval
    bar's slot, the sidebar) and measure the board's box on both, on a phone and a computer. Don't trust a screenshot.
  - Don't transition or animate between colours made with `color-mix(…, transparent)`. Switch them, or fade a layer's
    opacity, or animate a shadow.
  - An emoji or symbol in a line above the board gets `line-height: 1` (its font is taller than the text's).
- **A top bar that only fit a new player** (Oct 8, [story](../docs/history/lessons.md#a-top-bar-that-only-fit-a-new-player-oct-8-2026)):
  - A number on screen that grows (coins, ratings, counts, scores) is tested at its widest realistic value, not the
    value a fresh test account has. Fake the server's answer in the test (`page.route`) if that's the only way to get
    it.
  - When something new joins a row of fixed-size items, measure the row at 320 px with that widest content first.
- **A ring a few pixels off its square** (Oct 9, [story](../docs/history/lessons.md#a-ring-a-few-pixels-off-its-square-oct-9-2026)):
  - Anything drawn over the squares sizes and places itself in eighths of chessground's board (`--cg-size`, from the
    `---cg-width` chessground writes on the wrap), never in % of the wrap.
  - Check an overlay against the square it marks, within 1 px, at a size where the rounding gap is widest (wrap width
    times the display scale just under a multiple of 8), not only at the test phone's size.
- **Names that looked short** (Oct 7, [story](../docs/history/lessons.md#tests-that-leaned-on-a-lucky-seed-and-names-that-looked-short-oct-7-2026)):
  check text that must fit by measuring it in the real font and box, with some room for other fonts (an iPhone's runs
  wider than headless Chrome's), not by counting characters. (The same lesson's rule about seeds is under "Tests".)

## Performance: nothing may grow with the match

- **Lag that grows with the match** (Oct 9, [story](../docs/history/lessons.md#lag-that-grows-with-the-match-oct-9-2026)):
  - Anything a screen reads while rendering must be cheap and must not depend on how long the match is. A getter that
    looks like a field gets read dozens of times a frame, so it must never rebuild anything.
  - Never replay a game from move 0 per redraw, per read or per round. Use the board's FEN or the remembered
    `fenAfter`.
  - Before calling a change to a board, the boss or an animation done, run
    `npm run perf:boss -- <dir> gingerbread phone 25`. Frame times late in the match must match the early ones. The
    same script runs `clown`, `crowd` and `online` (an online raid on a local server).
  - The guards: `packages/chess/test/long-match.test.ts` and `e2e/perf.spec.ts`.
- **A dozen sprites, a dozen loops** (Oct 9, [story](../docs/history/lessons.md#a-dozen-sprites-a-dozen-loops-oct-9-2026)):
  an effect that can appear many times at once goes on a shared canvas, not a canvas each; never start a loop per
  sprite. Measure the worst case at once on a slowed phone
  (`npm run frames:character -- <dir> Boingo phone kit="G-REX" fxperf`), not one effect at a time.
- **A stall the first time an effect shows** (Oct 9, [story](../docs/history/lessons.md#a-stall-the-first-time-an-effect-shows-oct-9-2026)):
  - Measure a new effect's first showing on a slowed phone, not only its steady state: a second at a time, from the
    moment it starts.
  - Anything that shows many new frames at once (a board of tiles) is drawn ahead, a slice a frame. A sound made in
    code is made before its cue, and costs no more than about 30 ms on a computer.
  - Nothing a boss needs only in its battle is made when the app loads.

## Game state

- **A move only legal after a burn** (Oct 9, [story](../docs/history/lessons.md#a-move-only-legal-after-a-burn-oct-9-2026)):
  anything that changes the position outside a move must leave a base, and nothing may replay a board's history from
  move 0 directly: use `fenAtPly(history, ply, bases)`. When adding such a power, grep for `fenAfter(` and `.history`
  and check each.
- **A paint bucket that ran out of memory** (Oct 10, [story](../docs/history/lessons.md#a-paint-bucket-that-ran-out-of-memory-oct-10-2026)):
  - A pixel or packed value compared with what a typed array holds is made unsigned (`>>> 0`) first.
  - A loop that ends only when a check says "done" (a flood fill, a search) also has a bound it can't pass: a visited
    set, each item queued once.
  - Test a tool the way it gets used: many times in a row, on its own result, not once on a fresh state.

## Servers: everything ends

- **A lobby that never closed** (Oct 7, [story](../docs/history/lessons.md#a-lobby-that-never-closed-oct-7-2026)):
  - Anything the server starts (a lobby, a queue, a session) has an end, written down with its numbers, and a test for
    each way it ends, including "nobody is there any more".
  - Test the stale case: the old link, the tab reopened later, the app back from the background.
  - A refused WebSocket says nothing about why: ask the server (an ordinary request) before retrying.

## Tests

- **Two flaky solo tests: leftover pages, the test's own thinking, the engine's first line** (Oct 6, [story](../docs/history/lessons.md#two-flaky-solo-tests-leftover-pages-the-tests-own-thinking-the-engines-first-line-oct-6-2026)):
  - A test that opens a context uses `test` from `e2e/helpers.ts`. A page left open keeps playing.
  - The player's clock is part of what's tested: do the test's own work (engine lookups) before the clock starts, not
    on it.
  - Wait for what the screen says (a prompt, a phase), with a deadline for slow machines. Not a fixed pause, not a
    count of looks.
  - When a test passes alone and fails in the full suite, look at what else is running in that worker (the trace lists
    every live context).
  - "The engine's best move" is the line with the highest score, not the first line.
- **Tests that leaned on a lucky seed** (Oct 7, [story](../docs/history/lessons.md#tests-that-leaned-on-a-lucky-seed-and-names-that-looked-short-oct-7-2026)):
  a test that needs a particular random outcome looks for a seed that gives it (and says what it needs), rather than
  trusting that a fixed seed always will. Anything new that draws from the match's random source moves everything
  drawn after it.
- **One lucky pass taken for a cause** (Oct 8, [story](../docs/history/lessons.md#one-lucky-pass-taken-for-a-cause-oct-8-2026)):
  - One passing run doesn't confirm a cause. Before changing anything for a suspected cause, log what the test sees at
    each step on both branches (the phase, times, boxes) and find the step where they differ.
  - A test that measures a layout waits for the phase it means to measure; a phase change in the middle is a different
    screen.
- **A navigation that never happened** (Oct 9, [story](../docs/history/lessons.md#a-navigation-that-never-happened-oct-9-2026)):
  - Never await long app work (an engine search, a server round trip) inside `page.evaluate`. Start it in the page,
    keep the answer on `window`, and poll for it from the test (`engineTop` in `e2e/helpers.ts`). ("Execution context
    was destroyed" without a navigation is this.) `crowd.spec.ts`, `formats.spec.ts` and `boss-character.spec.ts`
    still await `topMovesFor` inside an evaluate: move them to `engineTop` when they're next touched.
  - Something on screen for a moment is checked by watching for it from before it can appear (`watchFor`), not by
    looking for it after a wait for something else.
