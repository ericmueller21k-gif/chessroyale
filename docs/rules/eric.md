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
- **Every character sprite is whole on screen (Eric, Nov 4).** Every figure (a boss, the God King, your own figure or pawn), on a phone
  and a computer, is fully on screen wherever it stands, idles or ends a move. Over the board or a menu is fine ("better, even: it can
  look cool"); cut off by the page's edge never is. Only mid-motion (a jump, a dash across) may it pass off screen.
  - Guard: `e2e/boss-side.spec.ts`, "Eric's rule (Nov 4): <boss> and the God King whole on screen at rest and at the end of every beat,
    phone and computer", one per boss with a character (BOSS_KITS), at 390 × 844 and at 1280 × 800, 1440 × 900, 1920 × 1080 and
    2000 × 1250: every frame it rests in and the last frame of every animation, drawn where it stands, inside the window (and your pawn),
    and no sideways scroll (a figure's frame past the window's edge scrolls the page).
  - Decision: [2026-11-04-battle-desktop-fixes.md](../decisions/2026-11-04-battle-desktop-fixes.md).

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
  match), Resign or Leave, and Report a bug. (Eric, Oct 25.) Guard: `e2e/match-menu.spec.ts`. One exception: a computer's boss
  result page has no gear, since Settings is in the side bar (Eric, Nov 3: "get rid of the little settings icon").

- **50 v 50: a big majority always wins (Eric, Nov 4: "10 people on white, a 7-2-1 split, the 7 should always win, but a
  6-3-1 could go to the 3").** When the most-picked move has at least `crowdSureShare` (0.7) of the team's real picks, it's
  played, always, a blunder too; below it, the draw from the top 3. A miss's pick made for it never counts in that share.
  - Guard: `packages/core/test/crowd-afk.test.ts`, "a big majority always wins": "10 on a team, 7-2-1: the 7 always (every seed);
    85%: always, a blunder too", "6-3-1: the draw as before (60 / 30 / 10), so the 3 sometimes", "the share counts real picks only".
  - Decision: [2026-11-04-crowd-votes-afk.md](../decisions/2026-11-04-crowd-votes-afk.md).
- **50 v 50: the AFK rule (Eric, Nov 4: "no move at all = default to a random top 5 move, but your penalty is simply you get the
  lowest score given to a player on your team that round; but if you miss more than 3 moves in the game you are removed for being
  AFK").** A player who picks nothing gets a pick made for them, one of the engine's top 5 at random, that never counts in the
  team's tally; they score the lowest score any teammate who picked got that move; the reveal says so ("Missed: a move was picked
  for you (1 of 3)"); the 4th miss in the game removes them for being away, as leaving the match (a loss, a bot in the seat), and
  they don't come back. Bots never miss. (`CROWD_MISSES`; the `?afk=0` test switch turns it off for tests that idle on purpose.)
  - Guards: `packages/core/test/crowd-afk.test.ts`, "a miss in 50 v 50"; `packages/chess/test/crowd.test.ts`, "50 v 50's misses
    (CrowdMisses, Eric, Nov 4): …" (both); `packages/server/test/resign.test.ts`, "50 v 50's AFK rule (CrowdMisses, Eric, Nov 4): …";
    `e2e/crowd.spec.ts`, "50 v 50's AFK rule (Eric, Nov 4): each miss says a move was picked for you (1 of 3) …", phone.
  - Decision: [2026-11-04-crowd-votes-afk.md](../decisions/2026-11-04-crowd-votes-afk.md).
- **Chat never shows over or above the board (Eric, Nov 4: "delete it, chat stays in the chat box below, not above the board, never
  approved that").** No new-message bubble, in any mode, and no switch for one: a line shows only in the chat box or tab.
  - Guard: `e2e/chat.spec.ts`, "quick chat picks in the profile: … exactly those lines in a match" (with the scoreboard up, nothing
    of a new line shows outside the box under the board, watched from before it's sent); `packages/app/test/chat.test.ts`, "while a
    panel is on screen nothing is unread; hidden, a new line counts as unread (no bubble: Eric, Nov 4)".
  - Decision: [2026-11-04-crowd-votes-afk.md](../decisions/2026-11-04-crowd-votes-afk.md).

## The town square

- **The town never shows an old version (Eric, Nov 13: "It should be working 100% of the time. It should never throw back an old
  version. It should just fail or something, or we try to reload."; later the same day: the old town must never load for a player, by
  any path, as old code is an exploit risk; "If it covers 99.99% of devices, which it does, then that's fine").** The street town
  never falls back to the old Canvas 2D town, and no switch opens it (`?street=off` is gone). A context lost while the page is hidden
  doesn't count; one not back within 5 s of the page showing, or WebGL failing to start, reloads the street town once, then shows
  "The town didn't load. Please retry." with Retry. A device without WebGL 2 shows "Chess Town can't run on this device." Each is
  reported once (`TOWN_GL_FALLBACK`, counted in the health view). Since Nov 13 the street town is everyone's (players and guests) and
  the old Canvas 2D town's code is gone.
  - Guard: `packages/app/test/town-gl-fail.test.ts` (the loss rules: hidden losses ignored, a loss not back fails once, one reload then
    the message); `e2e/town-street.spec.ts`, "the street town's WebGL context lost: …"; `e2e/problems.spec.ts`, "the town on a device
    without WebGL 2 never falls back to the old town …" (a player's on the phone, an admin's on the computer).
  - Decision: [2026-11-13-town-no-old-fallback.md](../decisions/2026-11-13-town-no-old-fallback.md); everyone's:
    [2026-11-13-street-town-for-everyone.md](../decisions/2026-11-13-street-town-for-everyone.md).

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
  you're typing (a strip at the box's foot, reserved so nothing moves). While the box shows and you aren't typing, that strip holds a faint
  hint, "Tap here to type" (phone) / "Click here to type" (computer), thin and gray, in line with the timestamps' "[": gone while you type
  and gone with the box (Eric, Nov 12, replacing Oct 28's "there is no 'Say something…' anywhere": "In very faint, like gray, let's put a
  message that says like tap the box to type or something… only a few words… it will disappear when the text box disappears as well").
  In Always on the box
  always shows; in New messages it shows when a message comes and fades, and **while its lines show a tap opens typing and is "high text"
  (every line, no fade) until you finish** (you send, tap the map, or press Escape), the icon staying one bubble green: "while lines are
  showing you can tap and it will open the chat still, temporarily making it 'high text' mode until you finish, but don't change the text
  icon to be double green, it's just a temp thing." **Off stays off** (no box, nothing to type in). The box keeps its place and size in every
  mode (v3's "no field in New messages", which this replaces, was the one exception Eric had named to "nothing hidden" for the chat; the
  typing line being visible only while you type is the exception now).
  - Guard: `e2e/town-chat.spec.ts`, "typing works wherever the box shows: always on, and new messages while its lines show (a tap opens it);
    off shows no box, so nothing to type in (Off stays off); the faint hint shows on the foot line while the box shows and you aren't
    typing, and is gone while you type and when the box is gone; the box keeps its place and size throughout",
    phone and computer. Its unit side: `packages/app/test/town-chat.test.ts`, "what each mode does".
  - Decision: [2026-10-28-town-chat-v2.md](../decisions/2026-10-28-town-chat-v2.md), "v4"; the hint:
    [2026-11-12-town-chat-hints.md](../decisions/2026-11-12-town-chat-hints.md).
- **Leaving Chess Town asks first (Eric, Nov 7: "you should always have a confirm if you're going back out to a different menu or
  you're trying to exit").** The side menu, the town's back button, the phone's or browser's back gesture ask "Leave Chess Town?" with
  Stay (the default, Escape) and Leave; Stay changes nothing. Rooms, boss challenges, the AFK drop and forced exits don't ask.
  - Guard: `e2e/town-leave.spec.ts`, "the town's back button asks…", "the phone's back gesture asks too…", "a computer's side menu
    asks first…", "inside a room…", "a boss's challenge from the town…", "no input for the limit…", phone and computer.
  - Decision: [2026-11-07-leave-town-confirm.md](../decisions/2026-11-07-leave-town-confirm.md).
- **The Hidden Boss's room (Eric, Nov 12 and 13): you challenge him from his room only and wait there; leaving it with your game request
  in asks "Cancel your game request?" (Stay / Leave and cancel): the stairs, back, the side menu, closing the town; four at most in the
  room, a 5th at its door gets "The door is locked." and stays out; no four in 5 minutes (not shown): "Sorry, not enough players." with
  OK.** The one exception to "rooms don't ask" above. The test bots and the online 🏆 are admins' only, the server checking.
  - Guards: `packages/server/test/hidden-room.test.ts` (every check); `e2e/hidden-boss-room.spec.ts`, "his room (Eric, Nov 12 and 13)…"
    and "a 5th at his door…", phone and computer.
  - Decision: [2026-11-13-hidden-boss-challenge.md](../decisions/2026-11-13-hidden-boss-challenge.md).
- **Name tags show only near you by default (Eric, Oct 28); "Everyone" in Town settings shows them all.** The figures are always drawn;
  a tag shows within 5 squares of you (|dc| and |dr|, so about a 10 × 10 area), fading over the last square; your own tag, an open card's
  figure and a table partner always show. The one more named exception to "nothing hidden".
  - Guard: `e2e/town-tags.spec.ts`, "name tags show only near you by default…", phone and computer; unit: `packages/app/test/town-tags.test.ts`.
  - Decision: [2026-10-28-name-tags-near-you.md](../decisions/2026-10-28-name-tags-near-you.md).
- **A tap on a home walks you to the square before its door (or one either side, if someone stands there), and its card opens;
  running into a home (or the Colosseum) with an arrow key opens its card too (Eric, Nov 5: "as close to in front of his building as
  possible"; "if I use the arrow keys and you run up to a building, it should also ask you if you want to enter").**
  - Guards: `packages/app/test/town-world.test.ts`, "tapping a home walks you in front of its door…"; `e2e/town.spec.ts`, "a home's
    door (Eric, Nov 5)…", phone and computer.
  - Nov 12, more grace ("you can click anywhere near or on the building, and it should make your guy run and then give him the go in
    message"): its foot row, see-through gaps near its foot and your own pawn at its door count too
    ([2026-11-12-town-door-tap.md](../decisions/2026-11-12-town-door-tap.md)). Guards: `packages/app/test/town-door-tap.test.ts`;
    `e2e/town-street.spec.ts`, "Alfil's Pyramid (Eric, Nov 12…)", phone and computer.

- **Up is up the screen in every room (Eric, Nov 5: "if I hold up, it goes up in the… chess town, but then if you hold up in one of
  the rooms, it actually gave you the kind of sensation you're running down. So it's flipped").** Inside every building (each shop, the
  cave, Ginger's igloo), as in the town: holding Up (the key, W or the on-screen up arrow) moves your figure up the screen and, on a
  ride, shows its back; Down the reverse (its front); Left and Right go left and right on screen (its side, facing that way). On a phone
  and a computer, on foot and on a ride. (`Walker.rowsUp`: which way a walker's rows run on screen; its view and `keyWalk` both turn by it.)
  - Guards: `e2e/shop.spec.ts`, "Eric's rule (Nov 5): up is up the screen in every room: …" (on foot, and on a ride), phone and
    computer: in Babur's Circus, Alfil's Pyramid and Hollow Peak, each way by the keys and by the on-screen arrows, the square you
    end on drawn that way of where you were, your feet moving that way on screen, and on a ride the view drawn while moving;
    `packages/app/test/town-arrows.test.ts`, "Eric's rule (Nov 5): up is up the screen in the town and in every room (Walker.rowsUp)".

## Accounts and fair play

- **A ban means you can't sign in (Eric, Nov 13).** A banned account (a person's ban, or ban evasion) can't sign in by any way
  (an emailed code, Google, any other), and sees only "Your account has been banned. For more information, email
  support@hunchess.com." (the address a mailto link) on every URL and from every API route, a tab already open included: no
  menus, town, solo or chat, and no appeal box in the game (appeals come by email, a person answers them). Enforced on the
  server; the account's own sign-in cookie never gets it past. A lifted ban signs in as before. Guests and the engine pool are
  unchanged. "No URLs work" covers the whole device (Eric, Nov 13, "so be it"): the browser the banned account was used or signed
  in to on shows only the line to everyone who uses it, sign-in included, whatever account they bring (a session of another
  account on it is ended), until the ban is lifted.
  - Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works."
    "If you try to sign in, it would say your account has been banned. For more information, email support." "Make sure that
    when someone's banned, it's not just the landing page. No URLs work." "No, just the whole device is banned. We're not
    tolerating any fucking bullshit. If you get banned and your sister gets upset about it, so be it. We can always revert it
    later."
  - Guards: `e2e/fairplay.spec.ts`, "a ban means you can't sign in (Eric, Nov 13)…", phone and computer (a tab open drops to the
    line; a list of URLs and API routes, sign-in's included; signing in again refused with no session; the account's own session
    refused; lifted, it signs in); `packages/server/test/ban-sign-in.test.ts` (every check; "the whole device is banned": the
    sister on the marked tablet gets the line, can't sign in, and her session there is ended).
  - Decision: [2026-11-13-ban-blocks-sign-in.md](../decisions/2026-11-13-ban-blocks-sign-in.md).

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

## Banners, boss lines and town cards (Eric, Nov 5)

- **Power banners show the player's own pawn; the God King appears on a banner only for his save.** Phone and computer.
  - Guard: `packages/app/test/banners.test.ts`, "Eric, Nov 5: a power's banner shows your pawn, never the God King"; `e2e/boss-powers.spec.ts`, the Freeze test (your pawn on the banner, no God King).
  - Decision: [2026-11-05-banners-emoji-cards.md](../decisions/2026-11-05-banners-emoji-cards.md).
- **No emoji stands in for a boss or character in the game's own text; use the name and/or a small portrait.** The status line says "[portrait] Wrangler plays d4".
  - Guards: `packages/app/test/banners.test.ts`, "no emoji stands in for a boss in the boss screen's lines"; `e2e/smudgy.spec.ts`, the status-line checks ("Smudgy plays d6").
- **Town cards' text is centered** (every card: the challenge card, the homes, the raid confirm, the shop's cards). A person's row keeps its layout.
  - Guard: `packages/app/test/town-card.test.ts`, "Eric, Nov 5: every town card's text centered".

## Hollow (Eric, Nov 5)

- **Solo against Hollow, ten bulbs instead of points; crowds keep the points.** In Boss alone a string of 10 of his bulbs
  shows; each wrong move into the dark puts one out (no points, no 5-a-turn cutoff); as the 3rd and the 7th go out the dark
  plays that turn's move for you, a bad one; as the 10th goes out the screen goes black, he speaks, and you lose. Crowds,
  raids and parties keep −5 a wrong try and the 5th a missed move (Eric: "bulbs only apply in solo for now to avoid a griever
  spamming bad moves"). The rules decide every bulb, forced move and loss; the screen only shows them.
  - Guards: `packages/chess/test/hollow-bulbs.test.ts`, "Hollow's bulbs in Boss alone (Eric, Nov 5)" (every check: the strand
    only alone; each wrong move one out, no points; the 3rd and 7th the dark's move; the 10th the loss; "a crowd keeps today's
    points"); `e2e/hollow.spec.ts`, "Hollow's dark, Boss alone: …" and "Hollow's bulbs (Boss alone): …", phone and computer, and
    "Hollow online: …" (no bulbs online, −5).
  - Decision: [2026-11-05-hollow-bulbs.md](../decisions/2026-11-05-hollow-bulbs.md).
- **His bigger darkness, everywhere he plays:** a few 2 × 2 blocks and, once a game, a 3 × 3 for 2 turns; what's in them is
  hidden ("if you don't know where say the bishop moves to in it, that's just your loss").
  - Guard: `packages/chess/test/hollow-bulbs.test.ts`, "Hollow's bigger darkness (rule set 2)" (every check).
- **His taunt on each misplay, alone and in a crowd, at random and never the same twice running** ("Nice try.", "What, can't
  play in the dark?" and his others).
  - Guards: `packages/app/test/hollow-bulbs.test.ts`, "his taunts on a misplay (Eric, Nov 5)"; `e2e/hollow.spec.ts` (a taunt in
    his bubble on a wrong move, alone and online).

## Squads: move replay (Eric, Nov 5)

- **Coming back to a board, the free time is the free seconds + 0.5 s for each move played there since you last played
  it, replay or not; as your move there starts the moves replay as the replay button says (Eric, Nov 5, round 2: the last
  2, or all since you last played there), unless you watched both of the last two moves there land.** Every mode where you
  come back to a board (Relay, Pairs). Each move lands one by one with its from and to marked; a tap on the board (or
  starting a move) skips it. The rule is the server's (`SQUADS.replaySecondsPerMove`, `Duty.freeMs`), and the clock on
  screen runs from it.
  - Guards: `packages/chess/test/squads-replay.test.ts` (every check: "Move replay: the free time grows by 0.5 s a move…");
    `packages/app/test/move-replay.test.ts` ("the moves you missed, in order…", "the replay button's setting changes
    nothing on the clock", "none if you watched both of the last two moves land…"); `e2e/squads-replay.spec.ts`, "Relay:
    the replay button steps off, the last 2, all…" and "Relay with Quick board jump…", phone and computer.
  - Decisions: [2026-11-05-move-replay.md](../decisions/2026-11-05-move-replay.md),
    [2026-11-05-squads-three-boards.md](../decisions/2026-11-05-squads-three-boards.md).
- **Who played each replayed move: a name tag over the moved piece, one box size; a long name smaller; over 12 characters cut
  with "…" ("Christopher…").** Guards: `packages/app/test/move-replay.test.ts`, "a name tag's words…"; the e2e above (every
  tag the same size, the long name smaller and cut).
- **The replay button sits next to the gear, no box, only the drawn ring (Eric, Nov 5, round 2): a tap steps off (grayed,
  still) → the last 2 moves (a moderate spin, a short trail) → all (twice as fast, a longer trail) → off; off on a first
  match; per account, on this device.** Guard: the first e2e above (the cycle, the speeds and trails).
- **At a player's Relay, three coach marks one at a time (settings, the replay button, the tiny boards); a tap or OK goes on;
  the last has "Don't show these again": ticked, never again on that device; not ticked, again next time (Eric, Nov 5,
  round 2; they replace the first-time tip).** Guards: `packages/app/test/move-replay.test.ts`, "The first-time tips…";
  `e2e/squads-three-boards.spec.ts`, "the coach marks…", phone and computer.
