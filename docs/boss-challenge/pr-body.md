# Alfil's home, and challenging a boss from the town (Pokémon-gym style, Alfil first)

Branch `claude/boss-challenge`, from `claude/nov2-fixes-b` (PR #465, merged in at 3b8546d; not rebased). Merge #465 first.

## What changed

**Alfil's home is a shop**, as Babur's and Puddles' are: his card says "Go in", the room is the art from `claude/boss-art`
(`town/shops/alfil-art.ts`, its imports moved, its review sheets left there; the sand fountain laid flat, `d: 3`, its pylon at
its back edge), Woolly the Shopkeeper behind the low counter, the sandstone ceiling the mockup drew, the chat's day tone, and
"Alfil's Boss Crate" (core's `BOSS_CRATES`: his ride, Alfil's Howdah, first; the same price and odds as the other two).

**Challenging a boss from the town** (`town/shops/challenge.ts`, `intro.ts`, the room's challenge mode in `ShopRoom.tsx`), generic
(`BOSS_INTROS`), Alfil wired:
- The entry stays the boss's card's "Challenge alone". For a boss with an intro, its confirm is its own ("Challenge Alfil?" … Fight /
  Stay). Every other boss: unchanged (the Boss raid screen).
- Fight: you and the boss walk to its door and in (the shop's zoom and fade; the room and the intro's art load only now, their own
  chunks: `alfil-art` 36 kB, `alfil-intro-art` 15 kB, `intro` 6 kB). Inside, you walk to the battle circle's south mark and the boss
  to the north one, side by side, facing each other; he says his line in a speech bubble by his head (not the chat log: Eric); the sand
  pyramid rises between you, holds, cracks and crumbles, and his table with the board is there (the town's park-table board,
  white's ranks nearest you); from 2 s before the storm covers, he fires his God King attack (his kit's `kingAttack`, with its
  sounds) at the board beside the table, lashing on until the battle takes the screen (any boss with a `kingAttack`; Timber, with
  none yet, would skip it); the sandstorm sweeps in (a canvas over the whole page, outside the town), the battle loads under it
  (Boss alone, as Boss Battle's START starts it: that boss, your difficulty, Maia fetched ahead the same way, a token counting), and
  the storm slides off the board. About 1.2 s walking in, 3.9 s of intro, 0.6 s of storm in. The cues' sounds are Alfil's own pack
  (rumble, crunch, thud, glow, whoosh). No tap-to-skip (it's short; easy to add if wanted). Back calls it off until the storm starts.
- After the battle: the result screen (the token box as today); its leaving button reads "Back to town" and puts you on the square
  you stood on when you tapped Fight, facing the same way (the gear's Leave too). "Play again" keeps it. A battle started any other
  way leaves as before.
- Per player: it all happens on your own screen; the boss stays at its home for everyone else, and anyone can challenge it at once.
  No server-side "busy" state.
- **What others see of you while you're inside:** the town has no presence sync yet (no real players walk in it), so there's nothing
  to send; the call recorded for when it lands: you stand at the home's door while inside, and reappear where you come out.

**The server's lines in the town's chat** (Eric, Nov 2): the server posts them itself, in their own blue (`.tc-server`, day `#1d4ed8`,
night `#9cc2ff`; no name, no menu), for signed-in players in the town's chat:
- as a challenge's battle starts (`POST /api/boss/solo/start {town: boss}`): "Ann challenged Alfil!";
- as it finishes (`POST /api/boss/solo/finish {battle, outcome, moves}`, once: the battle is taken off in one statement first):
  "Ann beat Alfil in 34 moves!", "Alfil beat Ann in 21 moves.", "Ann drew with Alfil in 40 moves.", "Ann surrendered to Alfil after
  15 moves." (a resign at 10 or more of your moves: `TOWN_CHAT.challengeSurrenderMoves`), and " + Alfil token" on the end when the
  server dropped one (plain text: our own emoji packs come later);
- no spam (`TownChat.challenge`): a quit (a leave, a resign before 10 moves) posts no outcome and leaves the challenge open; while one
  is open, the next challenge posts no start line; the newest battle's finish posts the outcome and closes it. Kept in the live hub's
  memory (a restart forgets it; an open one goes after a day: `TOWN_CHAT.challengeOpenMs`).
- What the server verifies: the account, that the battle was started as that challenge and finished once, its own token drop. What it
  can't: the outcome and the move count (a solo battle is played on the device; they're its word). A finish with none of your moves
  says no count ("Alfil beat Ann."). A guest's challenge posts nothing.

Docs: `docs/areas/town-square.md` ("Which homes", "Challenging a boss"), `docs/decisions/2026-11-02-boss-challenge.md` (the calls).
Stills and the GIF: `docs/boss-challenge/` (`intro-phone.gif`: the walk in to the storm; `045-attack-*`: the attack).

## Every player-visible change and new text

- Alfil's home card: his name and **"Go in"** (was: the name, "Shop" greyed, "Coming soon").
- Inside: the header **"Alfil's Pyramid"**; **"Shopkeeper"** / **Talk**; **"Alfil's Boss Crate"**, **"Alfil's Howdah"** (Mythic ride),
  **"3 Alfil tokens, or 1 Alfil token + 1 crate key"**, **"You have 0 Alfil tokens and 0 crate keys."**, **"Buy with 3 Alfil tokens"**,
  **"Buy with 1 Alfil token + 1 crate key"**, **"Alfil's Boss Crate is in your inventory."**, **"You need 3 Alfil tokens."**; "Go out".
  The room canvas's label "Inside Alfil's shop".
- The Crates tab lists **Alfil's Boss Crate** (the boss crates' rows are generic), and the FAQ's boss-crate line names it (generated).
- A boss with an intro, its card's confirm: **"Challenge Alfil?"** / **"You'll fight Alfil in Boss Battle, then come back here."** /
  **"Fight"** / **"Stay"** (was "Leave the town square?" / "You'll fight Alfil in Boss Battle." / Leave / Stay; unchanged for the others).
- Alfil's line, in a speech bubble by his head (not the chat log): **"I'll show you the power of the old piece."** (a placeholder until Gemini's lines).
- The pyramid, the table, the attack and the sandstorm (art and sounds as above).
- The result screen after a town challenge: **"Back to town"** in place of "Home" (on one line).
- The gear's Leave note after a town challenge: **"You'll go back to the town square. Nothing goes on your record."** (was "You'll go
  home. …").
- The town's chat, the server's lines: **"<name> challenged <boss>!"**, **"<name> beat <boss> in <n> moves!"**, **"<boss> beat <name> in
  <n> moves."**, **"<name> drew with <boss> in <n> moves."**, **"<name> surrendered to <boss> after <n> moves."** ("1 move"; no count when
  none: "<boss> beat <name>."), and **" + <boss> token"** on the end when a token dropped.

## Changed checks (old → new)

- `packages/app/test/shop-room.test.ts`: "only Babur's and Puddles' homes have an inside" (`["tiger", "gardener"]`) → "only Babur's,
  Puddles' and Alfil's homes have an inside" (`["alfil", "gardener", "tiger"]`, sorted); Alfil's room added to the rooms the room tests
  run on; the crate words test and "each shop sells its boss's crate" take Alfil's too.
- `packages/server/test/boss-tokens.test.ts`, "the crates": the BOSS_CRATES list `[tiger, gardener]` → `[tiger, gardener, alfil]`.
- None of these guards a rule in `docs/rules/eric.md`. No check removed.

New checks: `packages/app/test/boss-challenge.test.ts` (the flow's state machine, the marks, the intro's timeline on Alfil's art, the
cues, the attack's timing, the storm's edge, back to where you stood), `packages/server/test/town-chat.test.ts` ("a boss challenged
from the town": the words, the no-spam rule, through the API), `e2e/boss-challenge.spec.ts` (phone and computer: a quit, then a finished
challenge: the walk in, the line, the pyramid, the attack before the cover, the storm, the board, the result, Back to town at the same
spot and facing, the two lines and no second start line), `e2e/shop.spec.ts` ("Alfil's Pyramid": Woolly's crate with Alfil's Howdah).
`e2e/areas.json` maps the new spec (the town's area, and its own for the server and app files it covers).

## Tests run locally

- Typecheck: all packages.
- Unit: `packages/app/test/{boss-challenge,shop-room,faq,town-world}.test.ts`, `packages/server/test/{town-chat,boss-tokens,ci-select}.test.ts`,
  `packages/core/test/crates.test.ts`: all pass.
- e2e (under the shared lock, on a port of its own): `e2e/boss-challenge.spec.ts` phone and computer pass; `e2e/shop.spec.ts -g "Alfil's
  Pyramid"` phone and computer pass.
- Frame rate: the town's drawing and frame loop are unchanged (the card's markup and a flag on the door's callback only), so not
  measured (eric.md: only when the drawing or the frame loop changes). The room's loop draws the same for a shop (its figures sorted
  in a fixed array of four); a challenge adds the boss, the board and the attack for its few seconds.

## Round 2 (Eric, Nov 2, after the intro GIF)

"For Alfil he shattered the pyramid, that's fine for him, but for other bosses they should just be swinging for a few seconds like
discussed. Also in the gif the chairs are not on the right side where the chess board is. I also prefer the normal look is boss on left,
you on right, not vertical, but I'm ok if it's some for some bosses and the opposite for others; just be sure the table and chairs and
pieces all are logically placed." Decision note: `docs/decisions/2026-11-02-boss-challenge-r2.md`; the area page's "Challenging a boss".

### What changed

- **A layout per boss** (`BOSS_INTROS[id].layout`): **"across"** (the default): the boss on the table's west (the screen's left), you on
  its east, side by side on the circle's middle row, a square and a half out, facing each other; **"facing"**: the boss north, you south.
  `marksOf(layout, how)` finds the circle's middle from its floor (any room with a circle or ring, marks drawn or not).
- **Alfil: across.** Both tried: across (`docs/boss-challenge/04-table-phone.png`) shows you, the table, both stools and him side by
  side, nothing hidden; facing (`r2-alfil-facing-phone.png`) hides his stool behind the table and stands him small, far behind it, with
  your back to the camera. Across is also Eric's normal look. His and Puddles' drawn start marks moved west and east of the emblem
  (turned, each pointing out), and the circle's middle line now runs north to south between them.
- **Table, chairs and pieces:** the park table's picture is three squares across, a stool in each outer square: across, it stands as
  drawn, its stools at the players' sides; facing, its middle square alone and a stool north and south. You and the boss stand just
  past your stools, in front of them. The board is turned to the layout: white's ranks nearest you, black's nearest the boss, the
  a-file on your left; across, the knights face the other side. The boss's town figure turns to face the table (Babur's and Puddles'
  art faces left, as their attacks' does: `facesLeft`).
- **The default intro, for every boss whose home has an inside: Babur and Puddles now** (Alfil keeps his pyramid and sandstorm): walk in
  with you, the line in the bubble by its head (1.8 s); the town's stone park table pops in between you during it (grows from its foot,
  a dust puff, the app's soft pop); the boss swings its God King attack in place for 2 s (its kit's `kingAttack` and sounds, its lashes
  only, looping: no drop-in, no leap, hitting nothing); then the default transition (`startWipe`): three white flashes and black bands
  wiping in from alternate sides (0.8 s, the boss's own whoosh), the battle loads under the black, which fades off. About 5.8 s from the
  door to black. Babur's ring has his pedestal in its middle: the table stands 1.5 squares south of it, in front.
- Kept from round 1: the chat lines, the return to town, everything else.

### Every player-visible change and new text

- Babur's and Puddles' cards: "Challenge alone" now opens **"Challenge Babur?"** / **"You'll fight Babur in Boss Battle, then come back
  here."** / **Fight** / Stay (and Puddles'), was "Leave the town square?" / "You'll fight Babur in Boss Battle." / Leave / Stay. Fight
  takes you into their home for the intro and the battle, and back to town after; the server's town-chat lines now name them too
  ("Ann challenged Babur!", …).
- New lines (placeholders until Gemini's, each in its boss's voice): Babur **"Fine. One more show. Then I'm on break."**; Puddles
  **"Wipe your feet. Then let's see what grows."**
- Alfil's intro: across (him left, you right), his stools at your sides, the board turned to you.
- Alfil's and Puddles' rooms: the start marks west and east of the emblem, the middle line north to south (also as a shop).
- The default intro and its flash and wipe (Babur, Puddles).

### Checks changed (old → new)

- `packages/app/test/boss-challenge.test.ts`:
  - "only Alfil has an intro so far" (`["alfil"]`) → "every boss whose home has an inside has an intro" (`["alfil", "gardener",
    "tiger"]`, equal to `SHOPS`' keys; Alfil custom, Babur and Puddles the default, their lines).
  - "Alfil's: you on the south mark, the boss on the north" (`marksOf(layout)`) → "facing: the boss north of the table, you south"
    (`marksOf(layout, "facing")`, the same numbers); new "across" test (all three rooms: boss (8, r), you (11, r), facing each other).
  - "you and the boss walk in side by side…" (Alfil only: your path all on column 10, his on 9) → all three rooms, across: the boss
    keeps to your west row for row; each path at most 1.2 s.
  - "found from any room's art (… Babur's ring has none: null)" → "found from any room's circle (Babur's ring: found)".
  - New: the stools, the table's picture, the drawn marks where you stand, the table clear of room pieces (Babur's pedestal), the
    board's turn (`boardSquare`), the default intro's timeline, its in-place attack, its cues, its length, the wipe.
- `e2e/boss-challenge.spec.ts`: Alfil on his marks `you [9.5, 13]`, `boss [9.5, 8]` → `[11, 10.5]`, `[8, 10.5]`, layout "across",
  facing each other; new: his stools `[[8.5, 10.5], [10.5, 10.5]]`. New test: Babur's default intro (phone and computer).
- `e2e/town.spec.ts`:
  - "a boss's card: 'Challenge alone', then 'Leave the town square?' …": Babur → **Folio** (a boss without an inside; Babur's is a
    challenge now): his card, his town sound (`folioMurmur`/`folioHum`, was `tigerHello`), "You'll fight Folio in Boss Battle.", Folio's
    tile picked. The helpers take a boss id (default Babur's), and a home without its chip in view is reached by the camera's glide.
  - "the other cards on the same dark look …": Babur's confirm "Leave the town square?" / "You'll fight Babur in Boss Battle." / Leave →
    "Challenge Babur?" / "You'll fight Babur in Boss Battle, then come back here." / Fight (the same look and contrast checks).
- `e2e/shop.spec.ts`, "inside, a drag looks around as the town's does": the town half measured `homeAt("tiger")` (where a tap lands on
  Babur's tent) → the tent plot's middle square `__townAt("square", [28, 4])`, a fixed point of the world, as the inside half already
  does. The check itself is unchanged: each drag (down, up, right) moves that point the finger's way, 0.4 to 2.5 times as far. Why: the
  computer run failed in CI (shard 4, first try and retry) with the right-drag reading −34 px for +80. The camera was right (the
  trace's frames show the tent moving 80 px right with the mouse); the reading wasn't. `homeAt` is the renderer's `tapPoint`, which
  searches a grid over the tent for the first point no nearer figure covers, and Babur stands on his square right in front of the tent
  juggling: his frames cover a little more or less of it, so the point hopped between the tent's left and right gift boxes (about
  110 px) between two readings. Not a challenge's leftovers: locally, alone, the same hops showed (+111 px across on a pure vertical
  drag) and passed only because they happened on the axis not checked. With the square the readings are steady (the same numbers
  every run). Main has the same test and the same hop; it lands by timing.
- None of these guards a rule in `docs/rules/eric.md`. No check removed.

### Tests run locally (round 2)

- Typecheck (app); unit `packages/app/test/boss-challenge.test.ts` (32) and `shop-room.test.ts`: pass.
- e2e under the shared lock, on a port of its own: `e2e/boss-challenge.spec.ts` (Alfil and Babur) phone and computer, 4 passed;
  `e2e/town.spec.ts -g "a boss's card: 'Challenge alone'|the other cards on the same dark look"` phone and computer, 4 passed.
- The drag check (CI fix): `e2e/boss-challenge.spec.ts` then `e2e/shop.spec.ts:255` in one worker on the computer, 3 passed (before
  and after the fix); `e2e/shop.spec.ts:255` phone and computer, repeated 3 times each, 6 passed with identical readings.
- Frame rate: the town's drawing and loop unchanged; not measured. In a room, a challenge draws the same figures as round 1 plus two
  stools (facing only) and, for the default, a few dust ellipses for half a second.

### Stills and GIFs (`docs/boss-challenge/`)

- At the table: Alfil `04-table-phone.png` / `04-table-desktop.png`; Babur `r2-babur-table-phone.png` / `r2-babur-table-desktop.png`;
  Puddles `r2-puddles-table-phone.png` / `r2-puddles-table-desktop.png`.
- Alfil facing (the layout not chosen): `r2-alfil-facing-phone.png`.
- Babur swinging: `r2-babur-swing-phone.png`; the wipe: `r2-puddles-wipe-phone.png`.
- GIFs (phone): Babur's default intro `r2-babur-intro-phone.gif`; Alfil's, redone across, `intro-phone.gif`. The round-1 stills `02-line`,
  `03-crack`, `04-table`, `045-attack`, `05-storm` are redone across.

## Lane

Targeted (round 2 adds layout and drawing logic in the room, the default intro and transition, and two room floors' marks), with a boss's art and wiring (boss lane's review pass suggested). It also touches the shop's stored data's edge (a third boss
crate in BOSS_CRATES, at the existing price and odds) and the town chat's server room (new server-posted lines, memory only, no
schema change): the director may want the full lane for the crate.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01EKH5j59nMnRVnekEcuZbim
