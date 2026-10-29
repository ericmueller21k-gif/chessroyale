# Eric's standing rules

Rules Eric has set that stay true until he says otherwise. Each says what holds, where it came from, and the test that
guards it. **A change that breaks one of these, or edits a test that guards one, needs Eric's OK first** (CLAUDE.md, "How
Eric likes to work"). When Eric sets a new standing rule, add it here in the same PR that builds it, with its guard test.

Briefs list the rules of the area they touch under "Rules you must keep". Every PR lists the test checks it changed or
removed (old → new) and says whether any of them guards a rule here.

## Every screen

- **Nothing hidden, nothing shifts (the default for every change from now on).** Containers keep their size and their place.
  A button, an option or a panel isn't hidden until another tap makes it appear: it shows greyed (muted and not tappable)
  until it applies. Tapping a mode, a tab, an ⓘ or an info bar doesn't move the things around it. It's the default, not a
  sweep: screens already built a little differently aren't changed for it, but every new change is checked against it.
  Where a case seems to call for the opposite, ask Eric; he names the exceptions.
  - Eric, Oct 18: "nothing should actually be forced moving around… those things need to be static."
  - Eric, Oct 25: "if we start making it where you have to press other things to make other options appear, it's just going
    to get sloppy over time… containers should never be getting shifted and… buttons hidden behind pressing other things."
    Then: "this is not like a hard set thing per se, but this is like the default… we're not trying to go back and make
    changes… moving forward, the default should always be to check that when we make changes, this mistake isn't happening
    again. But there may be some use cases…"
  - Decisions: [2026-10-18-home-steady-layout.md](../decisions/2026-10-18-home-steady-layout.md),
    [2026-10-25-home-panel-back.md](../decisions/2026-10-25-home-panel-back.md).
- **No platform named means both.** When Eric doesn't say "phone" or "computer", a change is for both. When unsure, ask.
  (Eric, Oct 25.)
- **Simple beats flashy** (Eric, Oct 14): the least code, the least lag on a phone, the fewest ways to break.

## Home

- **The options panel is always there.** On first load nothing is selected: the mode row (50 v 50 / 1 v 1 / Squads) shows
  unselected, and the options row under it shows too, nothing picked in it, a little greyer and not tappable, until a mode is
  picked. PLAY stays dimmed until then. Picking a mode moves nothing on the page. (Eric, Oct 18 and Oct 25.)
  - Guard: `e2e/home-ranked.spec.ts`, "Eric's rule (Oct 18, Oct 25): home's options panel is always there, greyed until a
    mode is picked, and home never moves", phone and computer.

## A match

- **The opening always plays out.** At a game's start the dealt opening's moves play one by one, on both sides, whatever the
  Animations setting and whichever team moves first. (Eric, Oct 25.) Guard: `e2e/opening-animations.spec.ts`.
- **The gear is on every screen with a chessboard**, phone and computer, with Sound, Animations (and Motion trail in a crowd
  match), Resign or Leave, and Report a bug. (Eric, Oct 25.) Guard: `e2e/match-menu.spec.ts`.

## The town square

- **Keep the frame rate (Eric, Oct 27): "we don't want any frame drops from a clever programming solution… we can always
  cut corners on this… if it keeps our FPS intact."** Nothing new per frame on the town's hot path and nothing allocated per
  frame; anything heavy (Maia, an engine) never loads or warms while you walk round the town, only when a game opens (a
  network prefetch on a tap is fine, no compiling). When a choice costs frames, cut the corner and say so.
  - Guard: measured against main in every town PR (method: docs/decisions/2026-10-26-town-square-slice-2.md: headless, a
    phone 390 × 844 and a computer 1440 × 900, 5 s walking, the medians of four runs taken in turn); not a CI test, CI frame
    rates vary too much. `e2e/town.spec.ts` checks that nothing of Maia's is fetched in the town before a game opens.
- **The chat's field ("Say something…") is in "Always on" only (Eric, Oct 28, from his phone): "the 'SAY something' is only ever
  visible for the double green chat setting, for the medium one it's impossible to chat you have to be in double green mode."** The
  one exception Eric has named to "nothing hidden": in New messages there is no field and you can't chat there; Off shows no chat at all.
  In Always on the field is always there (greyed, with why, for a guest or a paused chat). The box keeps its place and size in every mode.
  - Guard: `e2e/town-chat.spec.ts`, "the field is in always on and nowhere else: new messages and off have none…", phone and computer.
  - Decision: [2026-10-28-town-chat-v2.md](../decisions/2026-10-28-town-chat-v2.md), "Oct 28, Eric's phone".

## Writing

- **The Hidden Boss's lines:** never "Soviet(s)" or "Russian(s)", nothing that implies Korchnoi threw games, and real quotes
  only word for word.

## Working habits (not rules)

How Eric likes design work run (Eric, Oct 29). These are habits, not hard rules; no test guards them.

- **"Do it like I have it" vs "similar, open to ideas."** When Eric says he likes how his mockup does something, or to do
  it like he has it, match the mockup closely, spacing and padding included, and compare full-page side-by-sides (not
  crops) before merging. When he says "similar" or "open to ideas", our ideas are welcome. If it's unclear which he
  means, ask. Eric: "sometimes good ideas come from what we do… if I say hey this thing do it exactly like I have it versus
  let's keep it similar to this but I'm open to ideas…"
- **Mockup first for new screens and big mockup work.** Before building, send Eric a quick static mockup or picture so he
  can catch problems early. Eric: "just draw up a… non-program sketch or… fake mock-up… before we start and then I would
  have caught these things."
