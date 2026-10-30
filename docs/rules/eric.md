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
  - Guard: measured against main in every PR that changes what the town draws or does each frame (`render.ts`, the canvas,
    sprites and effects, anything on the frame loop; Eric, Oct 29: only then, not for layout, CSS or markup around the world)
    (method: docs/decisions/2026-10-26-town-square-slice-2.md: headless, a phone 390 × 844 and a computer 1440 × 900, 5 s
    walking, the medians of four runs taken in turn, one pass); not a CI test, CI frame rates vary too much. `e2e/town.spec.ts` checks that nothing of Maia's is fetched in the town before a game opens.
- **Typing works wherever the chat box shows (Eric, Oct 28, from his phone; replaces "the field is in Always on only").** You chat by
  tapping the box anywhere but a player's name; the typing line is an input with no placeholder, border or backing and shows only while
  you're typing (a strip at the box's foot, reserved so nothing moves), and there is no "Say something…" anywhere. In Always on the box
  always shows; in New messages it shows when a message comes and fades, and **while its lines show a tap opens typing and is "high text"
  (every line, no fade) until you finish** (you send, tap the map, or press Escape), the icon staying one bubble green: "while lines are
  showing you can tap and it will open the chat still, temporarily making it 'high text' mode until you finish, but don't change the text
  icon to be double green, it's just a temp thing." **Off stays off** (no box, nothing to type in). The box keeps its place and size in every
  mode (v3's "no field in New messages", which this replaces, was the one exception Eric had named to "nothing hidden" for the chat; the
  typing line being visible only while you type is the exception now).
  - Guard: `e2e/town-chat.spec.ts`, "typing works wherever the box shows: always on, and new messages while its lines show (a tap opens it);
    off shows no box, so nothing to type in (Off stays off); no \"Say something…\" anywhere; the box keeps its place and size throughout",
    phone and computer. Its unit side: `packages/app/test/town-chat.test.ts`, "what each mode does".
  - Decision: [2026-10-28-town-chat-v2.md](../decisions/2026-10-28-town-chat-v2.md), "v4".
- **Name tags show only near you by default (Eric, Oct 28); "Everyone" in Town settings shows them all.** The figures are always drawn;
  a tag shows within 5 squares of you (|dc| and |dr|, so about a 10 × 10 area), fading over the last square; your own tag, an open card's
  figure and a table partner always show. The one more named exception to "nothing hidden".
  - Guard: `e2e/town-tags.spec.ts`, "name tags show only near you by default…", phone and computer; unit: `packages/app/test/town-tags.test.ts`.
  - Decision: [2026-10-28-name-tags-near-you.md](../decisions/2026-10-28-name-tags-near-you.md).

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
