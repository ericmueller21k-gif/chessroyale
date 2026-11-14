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
  - Anything imperative that draws what a player sees on a screen's first frame (the board's size, a canvas, measured
    sizes) goes in `useLayoutEffect`, not `useEffect`.
  - No opacity entrance on screens that replace each other during play.
  - Check a change to screens or transitions with `npm run frames:flash` in light **and** dark mode: a blink that's
    invisible in one scheme is glaring in the other.
- **A board that vanished after it flipped** (Oct 8, [story](../docs/history/lessons.md#a-board-that-vanished-after-it-flipped-oct-8-2026)):
  never change what the board draws (its orientation, its size) while a transform is on it or an ancestor. Animate
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

- **Lines that went with their screen** (Oct 10, [story](../docs/history/lessons.md#lines-that-went-with-their-screen-oct-10-2026)):
  - A line a character says goes into that speaker's voice (`packages/app/src/speech.tsx`), never into a box a screen
    or a moment owns. How long it stays comes from the one rule (its length), not from how long the screen lasts.
  - Test a line's whole time on screen, every frame, from before it can appear (`e2e/boss-speech.spec.ts`), at the
    pace the mode really has (Boss alone's 0.45 s boss move is a different path from a raid's).
  - Nothing hides a text box to make it fit, and hiding a figure mustn't hide the words beside it.

- **A scoreboard that rebuilt itself every phase** (Nov 1, [story](../docs/history/lessons.md#a-scoreboard-that-rebuilt-itself-every-phase-nov-1-2026)):
  - A component that sizes what it shows from its own box measures in a layout effect, from its last size, so a copy
    drawn anew shows the same first frame.
  - Something that should stay put through a match's phases (a box under the board) is one element, not one per
    screen: count the elements across the phases (a MutationObserver or a per-frame sampler), not only their boxes.

- **A level that popped twice a move, and a Back tap that was lost** (Nov 12, [story](../docs/history/lessons.md#a-level-that-popped-twice-a-move-and-a-back-tap-that-was-lost-nov-12-2026)):
  - An animation that plays as a state begins (a pop, a slash) must not play again when its element is drawn again: the match's
    screens are rebuilt at every phase. Keep when the state began outside the component and give a redrawn copy a negative
    `animation-delay` from it. A test records every insertion of the element and whether its animation is running.
  - A guard that refuses an action while something is busy (a door's fade) keeps the tap for when it's free, or greys the button: it
    never drops it silently. Test the tap at the first moment it can come (a MutationObserver that taps as the thing is drawn).

- **A plip that never played on a busy page** (Nov 12, [story](../docs/history/lessons.md#a-plip-that-never-played-on-a-busy-page-nov-12-2026)):
  - Anything tied to a frame or a moment (a sound, a haptic) happens even when that frame is never drawn, including an element's first
    drawing coming late. Try a moment's path with the page's CPU slowed 4x (CDP `Emulation.setCPUThrottlingRate`), not only at full speed.
  - A test of a short-lived state (under about 300 ms) records it as the app sets it (a MutationObserver), never with a once-a-frame sampler.

## Measure what's on screen; don't trust a screenshot

- **Purity that didn't match the item** (Oct 6, [story](../docs/history/lessons.md#purity-that-didnt-match-the-item-oct-6-2026)):
  when a number on screen describes a drawing (a purity, a meter, a share), measure the drawing against the number
  over many cases, not one preview. Then add a test that does the same.
- **Colored squares instead of the item** (Oct 6, [story](../docs/history/lessons.md#colored-squares-instead-of-the-item-oct-6-2026)):
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
  - Don't transition or animate between colors made with `color-mix(…, transparent)`. Switch them, or fade a layer's
    opacity, or animate a shadow.
  - An emoji or symbol in a line above the board gets `line-height: 1` (its font is taller than the text's).
- **A board that shrank as the boss fell** (Oct 18, [story](../docs/history/lessons.md#a-board-that-shrank-as-the-boss-fell-oct-18-2026)):
  - A rule that sizes the board from something on the screen (`:has(.mini-tower.closed)`) must hold on every screen
    that hands the board on: when the next screen lacks that thing, it carries the state itself (`rc-folded`).
  - Measure a board handed between screens with each setting that changes its size (the scoreboard minimized), in a
    window short enough that the height sizes it (390 × 600), not only at the test phone's size.
- **A top bar that only fit a new player** (Oct 8, [story](../docs/history/lessons.md#a-top-bar-that-only-fit-a-new-player-oct-8-2026)):
  - A number on screen that grows (coins, ratings, counts, scores) is tested at its widest realistic value, not the
    value a fresh test account has. Fake the server's answer in the test (`page.route`) if that's the only way to get
    it.
  - When something new joins a row of fixed-size items, measure the row at 320 px with that widest content first.
- **A ring a few pixels off its square** (Oct 9, [story](../docs/history/lessons.md#a-ring-a-few-pixels-off-its-square-oct-9-2026)):
  - Anything drawn over the squares sizes and places itself in eighths of the board's own size (`--board-size`, from
    the `--board-width` the board writes on the wrap), never in % of the wrap.
  - Check an overlay against the square it marks, within 1 px, at a size where the rounding gap is widest (wrap width
    times the display scale just under a multiple of 8), not only at the test phone's size.
- **Coordinates a column off** (Oct 11, [story](../docs/history/lessons.md#coordinates-a-column-off-oct-11-2026)):
  - Anything a library draws on our screens (a board's coordinates, a ghost, a highlight) gets a look against what it
    marks, with our CSS, either way up: a library's defaults are made for its own page.
  - Board coordinates sit inside their edge squares. A test measures each label's text against the square it names,
    both ways up, on a phone and a computer (`expectCoordsInSquares` in `e2e/helpers.ts`).
- **A rage meter drawn at a fifth of its color** (Oct 11, [story](../docs/history/lessons.md#a-rage-meter-drawn-at-a-fifth-of-its-color-oct-11-2026)):
  - A rule on a bare element under a box (`.box i`) styles every component nested in that box too: use a child
    selector or a class of its own, and check the computed style of what sits inside.
  - Look at a drawn number (a meter, a bar) in true color, alone and enlarged, not only in a frame of the whole screen.
- **A menu glued to a laptop's taskbar, and two numbers for one boss** (Oct 17, [story](../docs/history/lessons.md#a-menu-glued-to-a-laptops-taskbar-and-two-numbers-for-one-boss-oct-17-2026)):
  - Test a computer's screens at a laptop's maximized window too (1280×600 and 1366×768), not only a tall test
    window. A sheet on a computer sits in the middle with room all round, never on the window's edge.
  - A number shown in two places comes from one function, and a test reads both on the same screen.
- **Names that looked short** (Oct 7, [story](../docs/history/lessons.md#tests-that-leaned-on-a-lucky-seed-and-names-that-looked-short-oct-7-2026)):
  check text that must fit by measuring it in the real font and box, with some room for other fonts (an iPhone's runs
  wider than headless Chrome's), not by counting characters. (The same lesson's rule about seeds is under "Tests".)

## Performance: nothing may grow with the match

- **Uploads that waited for the GPU, and an atlas that never gave room back** (Nov 11, [story](../docs/history/lessons.md#uploads-that-waited-for-the-gpu-and-an-atlas-that-never-gave-room-back-nov-11-2026)):
  - A canvas WebGL uploads is drawn in memory (`art2d`: `willReadFrequently`), never on the GPU: uploading a GPU canvas waits for the
    GPU to finish the frame (30 to 120 ms each).
  - An atlas that hands out room must get it back, or start pages again knowingly. Letting a picture go without its room only fills
    the atlas for the next reset.
  - Measure on a device: a headless frame report can miss what costs a phone (Eric's iPhone run found both).

- **Floor tiles that stood up** (Nov 11, [story](../docs/history/lessons.md#floor-tiles-that-stood-up-nov-11-2026)):
  - A room's floor tiles' names start `floor-` (room.ts `isFloor`), or they stand up as pieces every frame. A new room's test
    checks every square has a floor tile baked in (`shop-zebra.test.ts`).
  - A rule made for one kind of room (a cave's see-through) is opted into by what it's for, not by a field another room also
    has. Walk round every piece in a new room mid-walk, not only at rest.

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
  (`npm run frames:character -- <dir> Boingo phone kit="Jefferson" fxperf`), not one effect at a time.
- **A stall the first time an effect shows** (Oct 9, [story](../docs/history/lessons.md#a-stall-the-first-time-an-effect-shows-oct-9-2026)):
  - Measure a new effect's first showing on a slowed phone, not only its steady state: a second at a time, from the
    moment it starts.
  - Anything that shows many new frames at once (a board of tiles) is drawn ahead, a slice a frame. A sound made in
    code is made before its cue, and costs no more than about 30 ms on a computer.
  - Nothing a boss needs only in its battle is made when the app loads.
  - A slice a frame can't split one frame's work: a frame that paints a big part of its own (Moo's auras, 5 to 20 ms each,
    a hundred and fifty of them) is a long task on a phone however small the slice. Those go one at a time, a beat apart
    (`drip` in `components/Moo.tsx`, Oct 20), in the order they'll be needed. Measure the first move with
    `npm run perf:boss -- <dir> <boss> phone 4`: the long tasks and slow frames in the first row.
  - Boss sounds are made ahead in the sound worker (`sound-worker.ts`, Oct 14), never on the page: a new boss's sounds
    go in `MAKE` in `sound.ts` and `characters/boss-sounds.ts`.
  - Big Boy's perf check (`e2e/perf.spec.ts`) sat near its budget on a slowed phone (8 to 16% dropped against 15%)
    until Maia's loading step took her load out of his intro (Oct 14) and the boss screen stopped drawing its still
    parts every frame (Oct 15, DECISIONS.md, "The boss screen draws only what changed"): 1 to 2% on a quiet machine
    since. A red perf run: re-run it alone on a quiet machine before blaming a PR.

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
- **A queen won for free** (Oct 13, [story](../docs/history/lessons.md#a-queen-won-for-free-oct-13-2026)): a power's
  follow-up move that its engine search scored is played by the engine (`BossRules.bestReply`), never the boss's brain
  or a slip; a test plays the move after the power, on the weakest brain the boss can have.
- **A showdown that never came** (Oct 13, [story](../docs/history/lessons.md#a-showdown-that-never-came-oct-13-2026)):
  a search in rounds carries its source on (one that starts again re-scans the same candidates; test that a later round
  sees new ones); a power that fires only when a search finds something is measured in real battles, on a phone's
  budget, before it ships (`showdown-sim.ts`).

- **A move scored twice, another not at all** (Oct 14, [story](../docs/history/lessons.md#a-move-scored-twice-another-not-at-all-oct-14-2026)):
  a slot's last exact line in Stockfish's MultiPV output may name another move: read through `searchLines`, never by
  slot alone.
  When an engine's answer looks impossible, find out why and measure how often across many positions before adding a
  fallback where it showed.

- **A rook that had to look like a pawn** (Oct 19, Smudgy, [decision](../docs/decisions/2026-10-19-smudgy-wired.md)):
  - A position drawn differently from the one the game plays (a hidden piece) is drawn in one place that every screen goes
    through (`camo.ts`'s `seenFen`, called by `Board.tsx`), with the names of moves through the same (`seenSan`); fixing
    screens one by one leaks from the one forgotten. The e2e reads the board from the page and compares it with the game,
    every frame and every ply of the history.
  - Code that reads a drawn position with chess.js catches the throw: it refuses a pawn on rank 1 or 8, which a piece drawn
    as a pawn can stand on.
  - A power's moves that can't be forced by the engine in a test get a scripted test switch (`?paint=1`), not a retry loop.
- **A queen banner that came back after the ult** (Oct 16, [story](../docs/history/lessons.md#a-queen-banner-that-came-back-after-the-ult-oct-16-2026)):
  - A banner for something that happened (a capture, a power) is keyed to that event happening, never to a state that
    stays true afterwards: a power that pauses the turn shows the same state again (`queenSlain`, not "the last move
    took a queen").
  - When a turn has more than one screen of the same kind (a thinking before a power and one after it), check
    everything drawn from that state on each of them.

- **A drag that outlived its step** (Oct 21, [story](../docs/history/lessons.md#a-drag-that-outlived-its-step-oct-21-2026)):
  - A press, its drag's ghost and a selection end in one function (`cancelGesture()` in `AutoChess.tsx`) that every step change,
    lock, round turn, blur, cancelled pointer and lost capture calls.
  - A sale, a place or a buy from a "hold" checks what the hold points at is there now, of that kind, before it pays or changes
    anything (`sellPiece(army, square, kind)` returns null otherwise).
  - A drag test holds the drag through each moment that can cut it off (the lock, the step's end, lock in, a cancelled pointer),
    and asserts no ghost, gold or piece changed; and a finger's drag is tested with real touch events, not only a mouse.

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
- **A saw cut that waited for a check** (Oct 18, `docs/decisions/2026-10-18-flaky-e2e-batch-5.md`): a test that
  expects a power on a set turn checks the power's own condition in the position the game reached (`chooseCut`, the
  allowed moves) and expects what the rule says there. A boss's reply can give check, and a check leaves the crowd
  only a few moves, so a limit can stop none of them and a passive can find nothing to act on.
- **One lucky pass taken for a cause** (Oct 8, [story](../docs/history/lessons.md#one-lucky-pass-taken-for-a-cause-oct-8-2026)):
  - One passing run doesn't confirm a cause. Before changing anything for a suspected cause, log what the test sees at
    each step on both branches (the phase, times, boxes) and find the step where they differ.
  - A test that measures a layout waits for the phase it means to measure; a phase change in the middle is a different
    screen.
- **A navigation that never happened** (Oct 9, [story](../docs/history/lessons.md#a-navigation-that-never-happened-oct-9-2026)):
  - Never await long app work (an engine search, a server round trip) inside `page.evaluate`. Start it in the page,
    keep the answer on `window`, and poll for it from the test (`engineTop` in `e2e/helpers.ts`). ("Execution context
    was destroyed" without a navigation is this.) `formats.spec.ts` and `boss-character.spec.ts` still await
    `topMovesFor` inside an evaluate: move them to `engineTop` when they're next touched (`crowd.spec.ts` moved Oct 18,
    after it hit CI 4 times in 59 runs).
  - Something on screen for a moment is checked by watching for it from before it can appear (`watchFor`), not by
    looking for it after a wait for something else.
- **A melt the test blinked through** (Oct 12, [story](../docs/history/lessons.md#a-melt-the-test-blinked-through-oct-12-2026)):
  - A longer timeout doesn't make `toBeVisible` a watch: Playwright looks 0.1, 0.25 and 0.5 s apart, then once a
    second, so anything on screen for less than about a second (a melt, a flash) can fall between two looks.
    Watch for it from before it can appear (`watchFor`, or `watchSquares` in `boss-powers.spec.ts` for which squares).
  - Before blaming the game for a test that fails now and then, log every frame of the moment in the page and the
    test's own times next to it: where the two don't overlap is the answer.
- **The flaky batch of Nov 9** (`docs/decisions/2026-11-09-flaky-batch.md`):
  - A test that fails on both tries in one run and passes locally is usually a condition, not timing: read the CI
    trace's last snapshot (what's on screen, the turn order, the cards open) before changing a wait. Two of three were
    app bugs.
  - A test that taps until something opens closes whatever else its earlier taps opened first: an open card covers the
    point a canvas hook returns (hooks see the canvas, not the page over it).
  - A test lobby's "strong" bots must be deterministic for what the test relies on: no random move.
  - A list that hides "what's done" must not key off "what's been created": a next round made ahead of its start
    isn't the round being played.

- **A defeat that never came** (Nov 9, [story](../docs/history/lessons.md#a-defeat-that-never-came-nov-9-2026)):
  - A test that leans on a test switch names the boss (`?boss=`) unless it checks every boss on purpose: START's pick is
    random, and a switch can fail for one boss in seven (`?mate=1` against Wrangler's pull or Sawyer's pawn first move).
  - A spec that fails now and then on a random pick: run it once per boss (`?boss=<id>`) before calling it flaky.
- **A report that looked paused in every room** (Nov 11, [story](../docs/history/lessons.md#a-report-that-looked-paused-in-every-room-nov-11-2026)):
  anything a player reads about a run (a count, a pill) is set by the thing that records it, not by one of the loops that feed it:
  a second loop (a room's) then keeps it going. Test it where the other loop runs (inside a room), by what's on screen.
- **Escapes lost as a pop-up opened** (Nov 11, [story](../docs/history/lessons.md#escapes-lost-as-a-pop-up-opened-nov-11-2026)):
  - A pop-up's, menu's or sheet's key and tap-away listeners go in a layout effect, never `useEffect` (which waits for a paint): a
    test presses Escape the moment it is in the page (a MutationObserver), not after looking at it.
  - Such a watcher waits for that pop-up's own class: `index.html` always holds a hidden `[role="dialog"]` ("Turn your phone upright").
- **The flaky batch of Nov 11, second half** (`docs/decisions/2026-11-11-flaky-batch.md`, batch 2):
  - A layout read straight after `setViewportSize` can come before the app's ResizeObserver (which runs before the next paint): wait
    for the boxes to hold over a few painted frames, then measure.
  - A tap aimed at something on a moving camera (a glide, a zoom back out of a room) is read again once the point holds still: a
    missed tap walks you off, and the camera follows you.
  - A state that changes after the judge (a timer's minute, a meter) is read from a per-frame watcher, not a 5 s poll: the judge took
    over 5 s on CI's desktop.
  - A value whose `null` means "everything" (`allowed`: every legal move) is checked as everything, never assumed to be a list.
  - An answer that can't be read is a failure, never `{}` taken for it; and a request the app waits on before asking again has a
    timeout (`AbortSignal.timeout`): one that never answered stopped the live line and every chat riding on it.

- **The flaky batch of Nov 12** (`docs/decisions/2026-11-11-flaky-batch.md`, batch 3):
  - A test hook's tap point is a point a finger can reach this frame: the middle of the part of the target that's on screen, not its
    middle (a guard's feet below a computer's room edge made his middle null once the camera rested). A check that passes only while
    the camera still moves is tested with the camera at rest.
  - The local server frees an idle Durable Object within seconds, and in-memory state (the town's chat) goes with it; on Cloudflare
    every app's heartbeat keeps the hub in use. A spec that reads in-memory server state across a long quiet stretch (a battle, a
    result screen) keeps the object in use, as other players would. Read the room id in the recorder's answers first: a new one
    means a restart, not a lost line.

- **The flaky causes of Nov 13** (`docs/decisions/2026-11-14-flaky-causes.md`; Eric: "fix the cause, not add a checker"):
  - A font that arrives after the first paint reflows the page (`font-display: swap`): the fonts are preloaded in `index.html`, and a
    text whose `normal` line height differs between fonts gets a fixed one. A test that measures "nothing moved" first waits for
    `document.fonts.ready`, so it measures its own effect, not the font's.
  - Every busy guard keeps its tap (Go out's `outNext`, then a way through's `passNext`): a test comment saying a tap "is dropped" is a
    game bug to fix, not a retry to keep.
  - "Wait until it holds still" in a test is `settled(page, read, ms)` (`e2e/helpers.ts`); a tap in the street town is `tapInTown`.
    Never a fixed `waitForTimeout` before a measure or a tap.
  - A route handler's `route.fetch()` is Node's, not the browser's: a reset kept-alive connection to the local server comes back
    ECONNRESET where a browser would send the request again. It tries once more.

- **The flaky causes of Nov 14** (`docs/decisions/2026-11-14-flaky-round3.md`):
  - A gesture is judged on the input's own times (`e.timeStamp`), at every step: a frame's check on `performance.now()` can run before
    a release that already happened. Check what the tool really sends before blaming it (Playwright's tap sends start and end together).
  - A hook that subscribes in `useEffect` misses a change between its render and the effect: compare with what the render read and
    draw it then (`useServerStatus`, `useAccount`).
  - CI's trace is of the retry (`--trace on-first-retry`): for a retry-pass it shows the run that passed. The failure's own record is
    its error-context page snapshot; read that first.

## Eric's rules hold

- **An options panel that disappeared** (Oct 25, [story](../docs/history/lessons.md#an-options-panel-that-disappeared-oct-25-2026)):
  - Eric's standing rules are in [`docs/rules/eric.md`](../docs/rules/eric.md). A change that breaks one, or edits a test that
    guards one, needs his OK first. Above all, the default for every change: nothing hidden behind another tap (greyed
    instead), nothing shifts; screens already built aren't swept for it, and exceptions are Eric's to name.
  - A brief lists the rules of the area it touches; a PR lists every test check it changed or removed and whether one guards
    a rule. A clash between Eric's new words and a standing rule is a question for him, not a call to make.

## Explaining the game

- **A countdown that seemed to fire early** (Oct 15, [story](../docs/history/lessons.md#a-countdown-that-seemed-to-fire-early-oct-15-2026)):
  - A clock the player plays against is on screen all the time, in one place, readable at a glance, in the same
    rounding as any countdown over the board (the dock's `DockClock`): never only inside a line that changes.
  - Before hunting a "fired early" bug, work out the player's own time on the path they really played (bank,
    increment, pace), check it against what they last saw, and test that path.

- **A saw the boss crossed** (Oct 17, [story](../docs/history/lessons.md#a-saw-the-boss-crossed-oct-17-2026)):
  - A limit that refuses a move, or lifts for one (the only way out of check), says so on screen in the power's words
    (`refused.ts`): a piece that only goes back, or a boss crossing his own saw, reads as a glitch.
  - Before fixing "the boss broke the rule", rebuild the position from the screenshot and list its legal moves: the
    rule's own exceptions come first.

- **Street-town taps on CI** (Nov 13, `docs/decisions/2026-11-13-street-town-taps-on-ci.md`):
  - A spec taps a figure or a place in the street town with `tapInTown` / `quickTap` (e2e/helpers.ts), never a separate press and
    release: a slow frame between them is a run. It waits for the view to hold still in drawn frames, not wall time: at a few frames a
    second, reads 100 ms apart see a gliding camera as at rest.
  - A tap point that's null for a whole wait is a placement question before it's a timing one: under the chase camera, a figure behind
    you sits at the box's foot and fades out, and you stand in front of a door you just walked to.

- **Hollow's dark at Babur's mate** (Nov 11, [story](../docs/history/lessons.md#hollows-dark-at-baburs-mate-nov-11-2026)):
  - Code shared by every boss draws nothing of one boss's (his effect, his color): a boss's own look goes in its kit,
    and a test walks every kit (king-attack.test.ts: each boss's hits and mate its own).

- **His words over his face as he grew** (Nov 14, [story](../docs/history/lessons.md#his-words-over-his-face-as-he-grew-nov-14-2026)):
  - A speech bubble stands on the drawing shown now: a figure whose height or place changes (grows, leaps onto the board) carries its
    heights from the art (measured in a unit test), never one number per character, and a check measures the bubble against his head.

- **The FAQ follows the rules** (Oct 11): a PR that changes a rule, a number's meaning or a boss updates its words in `packages/app/src/faq/content.ts` in the same PR; numbers there come from the settings objects, never typed in.
