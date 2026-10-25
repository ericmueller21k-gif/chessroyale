# Eric's standing rules

Rules Eric has set that stay true until he says otherwise. Each says what holds, where it came from, and the test that
guards it. **A change that breaks one of these, or edits a test that guards one, needs Eric's OK first** (CLAUDE.md, "How
Eric likes to work"). When Eric sets a new standing rule, add it here in the same PR that builds it, with its guard test.

Briefs list the rules of the area they touch under "Rules you must keep". Every PR lists the test checks it changed or
removed (old → new) and says whether any of them guards a rule here.

## Every screen

- **Nothing hidden, nothing shifts.** Containers keep their size and their place. A button, an option or a panel is never
  hidden until another tap makes it appear: it shows greyed (muted and not tappable) until it applies. Tapping a mode, a tab,
  an ⓘ or an info bar never moves the things around it.
  - Eric, Oct 18: "nothing should actually be forced moving around… those things need to be static."
  - Eric, Oct 25: "if we start making it where you have to press other things to make other options appear, it's just going
    to get sloppy over time… containers should never be getting shifted and… buttons hidden behind pressing other things."
  - Decisions: [2026-10-18-home-steady-layout.md](../decisions/2026-10-18-home-steady-layout.md),
    [2026-10-25-home-panel-back.md](../decisions/2026-10-25-home-panel-back.md).
- **No platform named means both.** When Eric doesn't say "phone" or "computer", a change is for both. When unsure, ask.
  (Eric, Oct 25.)
- **Simple beats flashy** (Eric, Oct 14): the least code, the least lag on a phone, the fewest ways to break.

## Home

- **The options panel is always there.** On first load nothing is selected: the mode row (50 v 50 / 1 v 1 / Squads) shows
  unselected, and the options row under it shows too, nothing picked in it, a little greyer and not tappable, until a mode is
  picked. PLAY stays dimmed until then. Picking a mode moves nothing on the page. (Eric, Oct 18 and Oct 25.)
  - Guard: the home spec's test "Eric's rule (Oct 18, Oct 25): home's options panel is always there, greyed until a mode is
    picked, and home never moves", phone and computer.

## A match

- **The opening always plays out.** At a game's start the dealt opening's moves play one by one, on both sides, whatever the
  Animations setting and whichever team moves first. (Eric, Oct 25.) Guard: `e2e/opening-animations.spec.ts`.
- **The gear is on every screen with a chessboard**, phone and computer, with Sound, Animations (and Motion trail in a crowd
  match), Resign or Leave, and Report a bug. (Eric, Oct 25.) Guard: `e2e/match-menu.spec.ts`.

## Writing

- **The Hidden Boss's lines:** never "Soviet(s)" or "Russian(s)", nothing that implies Korchnoi threw games, and real quotes
  only word for word.
