# The town square (/town)

Boss raid's coming home: a small round world where players walk around and meet the bosses at their homes (the plan:
`ROADMAP.md`, "Boss raid: the town square"). **Slices 1 to 3** are the world alone, on a hidden address: the sky by
the time of day, the curved ground, all fourteen boss homes with their bosses roaming near them, the bots (twenty since Oct
28: six pawns and the bosses' fourteen sidekicks) and you; slice 4
added the press, the trail and the cards; **slice 5 the Colosseum** in the middle; **slice 6** made the Colosseum about
twice its size, the map bigger, and put **the park** with its ten chess tables in front of its gate; **the lights** (Oct 27) light the park's lamps and the homes' windows at dusk and night; **the chat log** (Oct 28; v2 the same day) is one see-through box in the top left corner, with a chat icon and a gear in the header, where the bosses and their kids say a line now and then and signed-in players type. Home's **Boss Arena** card (Oct 26, Eric)
opens it, and the computer's side menu's Boss Arena item; the address `/town` opens it directly too (`hunchess.com/town`,
behind Cloudflare Access like the rest of the site). Phone and computer.

## How it works

- **The page.** `App.tsx` mounts it at `/town` the way it mounts `/autochess`; `town/TownPage.tsx` loads the rest with a
  dynamic `import()`, so none of its code, art or styles are in the main bundle. The back button goes home (and the
  address back to `/`). Stockfish isn't warmed on this page, and nothing of Maia's loads
  while you walk round it (Eric's frame-rate rule, `docs/rules/eric.md`); a game with a bot loads it when it opens.
- **Layout.** A slim bar (the back button, "Town square", and at its right end the chat icon and the gear: "The chat log"),
  then the world fills the rest of the screen. The world never assumes a screen size: it fills its box and works its camera out
  from the box's shape, so the panels Eric designs around it can change without touching it. The back button, the chat icon, the
  gear and the buttons stay put. **The buttons** (Eric, Oct 28: "remove the 'Back to me' button … replace with circular focus
  icon … zoom button on left, focus button to right but are in the bottom right corner") are one row in the map's bottom right
  corner, 14 px in: the −/+ pair, then the **focus button**, a round white button as high as the pair (36 px) with a ring, four
  ticks and a dot (a map's locate-me, our own inline SVG) and no words; its accessible name is still "Back to me" and it does what
  "Back to me" did (the camera comes back to you). `.town-controls` is the row's box: the edge chips, the statue close-up and the
  chat box (`clampBox`) keep clear of it (`keepClear`, `buttons()`), so they follow it to its new place; the town card has never
  been kept clear of them (the buttons draw over a card), and a row 36 px high covers less of it than the stack did.
- **The camera** (`town/camera.ts`, pure math): a pitched pinhole camera over a ground that drops away from the focus
  point (a small round world), cut at a rim that forms the horizon. Two tuned sets, the phone's and the computer's,
  blended by the box's width / height (0.6 = all phone, 1.4 = all computer). Zooming out raises the camera, moves it back,
  pitches it down and lets the rim reach further; the page opens zoomed out (`startZoomedOut`). The world is 46 × 46 squares (40 × 40 until slice 6) and wraps both ways. A tap picks the
  nearest drawn square under it (`pickSquare`). The far band of ground dissolves into the sky; things in it fade, haze
  and blur, and are drawn whole, never cut by the rim.
- **The layout** (`town/world.ts`, `HOMES`): fourteen homes spread evenly round the middle over the world that wraps, so
  neighbors stand 8 to 10 squares apart; the Colosseum on its 12 × 12 ground (`COLISEUM`, columns 17 to 28, rows 28 to 39),
  its gate facing south onto its apron (`APRON`: columns 17 to 28, rows 25 to 27, paved, kept open for people to gather),
  then a walk of 4 rows (`WALK_ROWS`, the promenade paved across it), the park south of that (`PARK`, below; it stands back
  from the Colosseum since Oct 26: `docs/decisions/2026-10-26-town-square-park-stands-back.md`), and your start (`START`,
  22, 17) in the park on its promenade, between its two rows of tables nearest the Colosseum, facing it. Ginger Igloo and Jefferson's Fireworks stand side by side, and so do Hollow Peak and Moo &
  Moon Meadow. Folio's Folded House (Oct 27, the 14th: `docs/decisions/2026-10-27-folio-wired.md`) stands east of the
  Colosseum (35, 30 since Oct 28; it was 33, 30, only 3 squares from the Colosseum's ground: `docs/decisions/2026-10-28-town-chat-v2.md`),
  the one gap on the ring round the middle where its nearest neighbors (Big Boy's Crib 8.1, Sawyer's Woodshed 8.6, Smudgy's
  Gallery 10 squares) keep the 8 to 10 the homes keep, 5 open squares from the Colosseum's ground (as Smudgy's Gallery is) and its
  roaming ground clear of the Colosseum and the park; its ring the
  vermilion of its seal; at dusk and night its doorway's lamplight, its paper front wall glowing faintly like a paper
  lantern's, and a pool of light before the door. Placement is free to change while the town is a prototype (Eric, Oct 26: "where things are on the map is
  not an issue. If we need to move buildings around… It's all prototype"). The map: `docs/decisions/2026-10-26-town-square-slice-6.md` (slice 3's smaller one:
  `docs/decisions/2026-10-26-town-square-slice-3.md`).
- **The world** (`town/world.ts`): the homes (3 × 3 plots) and the Colosseum (`COLISEUM_PLACE`; homes and the Colosseum
  are `Place`s: a name, a chip color, a middle, a half-size and where the picture's foot stands), the walk (square to
  square, around the homes and the Colosseum, by breadth-first search), the bosses' roaming and their lines (their `SELECT_LINES`, one at a time, only from a boss on
  screen), and the bots. **Everyone in the square is a `Person`** (`{ id, name, look, you, walker }`) in one list,
  `town.people`; the bots are one source that moves its people. The drawing and the taps read only that list, so real
  players (rooms of up to about 75 to 100, fed by a server, later) can replace the bots without touching either.
- **The drawing** (`town/render.ts`): one canvas, one `requestAnimationFrame` loop (in `Town.tsx`), stopped when the screen
  closes or the tab is hidden; device pixel ratio capped at 2; nothing allocated per frame on the hot path (square colors,
  fonts, gradients, clouds, pawns and every boss and home frame are made once, the frames the first time they show).
- **Taps** (slice 4: `town/press.ts`; cleaned up in slice 5). A finger down presses the square you'd walk to like a
  button: its face dims a little and one bold gold border lies on its edge, glowing outside only, while the finger is
  down; up on the same thing releases it with one short pulse of that border (brighter, a little wider, fading) and you
  set off; moving past `dragPx` first lets it go (no pulse, no walk) and becomes a
  look-around drag. No sound and no vibration (Eric). A small gold ring marks your destination until you arrive. As you
  run you leave about three soft white droplets on the squares you leave, fading out in about half a second (yours only).
  All their numbers are in `feel.ts`.
- **One pawn a square, like chess** (`world.ts`): a walk may pass through people, but nobody ends on a square someone
  stands on or is headed for (`taken`: a walker's goal). A free square is its own end; a taken one, a person or a boss
  ends you on the nearest free square beside it (`spotNear`: the 8 squares round it, then the next ring out, and in a
  ring the one fewest steps away), so several people going to one person ring round them; a home ends you on the ring
  round its plot, the Colosseum (or its ground) on the free apron square nearest its gate (`destFor`), so a crowd at the
  gate grows in a half ring. If two walks end on one square, the later claim gives way to the nearest free square
  beside it (`keepApart`, every tick). Bots and bosses pick their ends the same way.
- **Cards** (the prototype's, inside the world's box, over the boss's head or above the home's name, placed every frame;
  a tap anywhere else, or Escape, closes one). A boss says something as its card opens (Eric, Oct 27): its select sound
  (`SELECT_SOUND`), or its own town sounds in turn (`TOWN_SOUNDS`, `townSound` in `characters/boss-select.ts`: Folio's
  murmur, then its "mm-hm"), made ahead in the sound worker as the town opens so a tap never costs a frame. **Hollow's card
  says a line** (Oct 28, Eric's three, word for word, about his sidekick: `TOWN_LINES`, `townLine` in `world.ts`), under
  its title, the next in turn each time his card or Hollow Peak's opens (its confirm is the same card); no other card has
  a line. Its card: its name and **"Challenge alone"**, which asks **"Leave the town
  square?"** / "You'll fight [boss] alone in Solo Boss Mode." / **Leave** / **Stay**; Leave closes the town square and
  opens the Boss raid screen with that boss's tile picked (`rememberBossPick`, then the screen as the side menu opens
  it); Stay closes the confirm and its card. A home: its name, **"Shop"** greyed (shown, not tappable) and "Coming
  soon". The Colosseum (slice 5): "The Colosseum", **"Raids with people"** greyed and "Coming soon" (Eric's menu for
  raids with people will live there). The boss stays put while its card is open. Tapping something both opens its card
  and walks you next to it.
- **Looking around.** Drag to look
  around; the focus button ("Back to me") brings the camera back; − / + (and the mouse wheel) zoom. The chips at the box's edge show the
  bosses whose homes are off screen (the nearest few: `maxChips` in `feel.ts`, 4), and the Colosseum's crown when none of
  it is on screen (among the nearest four, it's placed first, so it always shows); a tap glides the camera there. A chip
  never covers a name tag, a home's floating name, the speech bubble, the −/+ and "Back to me" buttons or a nearer
  home's chip: it slides along its edge to the nearest clear spot, and if there's none it isn't shown that frame (the
  tags, names and bubble note their boxes as they're drawn; the chips are placed last, in `placeChips`).
- **Names.** Each home's name is written by the game, never drawn into its art, both ways at once (Eric likes both; each
  one line in `feel.ts` to turn off): floating over the home, landmark style, as you come within a few squares
  (`floatingNames`), and on its sign board in the signs' own pixel capitals (`town/sign-font.ts`: 3 × 5 letters, drawn
  once per size in whole device pixels), whenever its letters would be at least `signMinCap` pixels tall (`signNames`).
  Every board is 24 pixels tall in the art, so every name reads at the zoomed-out view on a phone.
- **The sky by the time of day** (`town/sky.ts`, pure: the hours and the blend; `town/sky-draw.ts`: the drawing). Four
  looks, dawn, day, dusk and night, on the device's clock (read once a minute), each blending into the next over half
  an hour (`skyHours`, `skyBlendMinutes`; first guesses: dawn 5:30, day 7:30, dusk 17:30, night 19:30). Each look
  (`skyLooks` in `feel.ts`) sets the sky's gradient, its horizon color (which the far ground and the haze dissolve
  into, so the edge is one soft line in every look), a tint over the world (one fill a frame; name tags, bubbles and the
  homes' names are drawn after it, so they read as well at night), the sun (the moon at night: craters, stars, a few
  twinkling) and the clouds' colors; dawn adds a morning mist (more haze over the far ground, into its own pale gold) and
  its sun rises on the other side of the sky from dusk's. The prototype's far-band softening (a blurred copy laid over
  the far ground) is off (`softenFarBand`): it ghosted the far squares. The sun and moon sit low over the horizon and shift only a little as you walk round the world.
- **`?sky=dawn|day|dusk|night`** on `/town` holds one look whatever the clock says (for Eric and the tests; nothing else
  reads it).
- **The clouds** are pixel art like the homes (`cloudPixel`): puffs on flat-ish bottoms, each puff shaded as a ball lit
  from the top left, a few sizes and some wisps, spread across the sky with gaps, never on the horizon. Each cloud is
  drawn once per look into a small canvas; a frame only places them (a slow drift and a little parallax).
- **`rimLine`** (`feel.ts`, off): a dark line along the world's rim instead of the haze alone (Eric was curious), with its
  color and width.
- **The chips** show each boss's head (`BOSS_FACE` in `render.ts`: a box in its first idle frame), and the Colosseum's
  a gold crown over the board's squares (`COLISEUM_CHIP`, `houses/coliseum.ts`).
- **The Colosseum** (`town/houses/coliseum.ts`, slice 5; redrawn about twice the size in slice 6): a Roman amphitheater of
  warm stone, chess-themed (checkered bands, a chessboard arena, marble pawns in the middle tier's arches, pieces carved over
  the gate, navy and gold banners, statues of the pieces on plinths round it), 648 × 372 pixels at the homes' scale (twice as
  wide as slice 5's, half as tall again: taller would never fit a computer's view from the park);
  its foot is the gate's sill on its ground's front edge. Its sign is a tablet over the gate. It's drawn like a home
  (frames made once, one image a frame, only when its foot is inside the rim; `drawable`'s `below` lets its top draw
  while its foot is under the box). Past the rim (slice 6) it still stands on the horizon where it lies, up to `farReach`
  squares further, smaller, sunk behind the world's curve and hazy, so it looms from across the world (`drawFarColiseum`;
  not tapped, no chip while it shows). The design and the calls: `docs/decisions/2026-10-26-town-square-slice-5.md` and
  `…-slice-6.md`.

- **The park** (slice 6; `PARK` and `PARK_PLAN` in `world.ts`, the art in `town/houses/park.ts`): 20 × 11 squares in front
  of the Colosseum, past its apron and the walk, laid out as a city park: a paved walk all round, a promenade up the middle from the plaza to the
  gate round a stone fountain in the middle (2 × 2, its water moving), ten chess tables either side of it (`TABLES`: each a
  solid square with a stool west and east, facing each other across it), lawns with trees and benches. The ground has two
  more kinds of square (`groundAt`: paving and grass), drawn with the board's in the same color-sorted fills. Tables, trees,
  benches and the fountain are solid (`walkable`); stools, paths and grass are walked on. Each picture is made once (a
  `FrameCache` per kind) and drawn as one item sorted with the people, a little behind whoever stands on its row.
- **The tables' boards** (Oct 27; docs/decisions/2026-10-27-park-tables-live.md): each table's top is a flat slab drawn
  through the camera (`drawBoard` in `render.ts`; sizes `TABLE_BOARD`, pieces `TABLE_PIECES`, the clock's digits
  `TABLE_DIGITS` in `houses/park.ts`; timings in `TOWN_FEEL`'s `table*`), its 8 x 8 board lying flat between the stools and
  tiny pieces standing on it (the back ranks' shapes, the pawns in front). Who sits decides what it shows (`tableStates` in
  `world.ts`): **two people, not you, play** (white and black in turn, a step or three forward each, captures fading out,
  back to the start after `tableMoves` moves; a black clock floating over the board counts the game's time); **one, not
  you, waits** (a soft green ring pulses on the ground under the free stool); otherwise the pieces stand set up. You at a
  table aren't playing or searching yet (Casual and Ranked come with the tables' matchmaking). While nothing on a board
  moves and the camera holds still, its slab, board and pieces are one cached picture (`boardCache`): frame rates as main.
- **Sitting at a table** (slice 6): a tap on a table or a stool walks you to its free stool nearer you (`destFor`'s
  `table`; both taken: beside it) and opens its card (no title, Eric, Oct 27): **"Casual"** and **"Ranked"** greyed,
  "Coming soon" (matchmaking for the park is the next job); at a table where two others play, **"Spectate"** greyed,
  "Coming soon" (Eric, Oct 27: watching their game, once real games are played there). A person sits (`seated`) when stopped on a stool meaning to (`Person.sit`:
  always for bots, for you while the table's card is open after a tap on it): drawn from `sitCut` of its height up, resting
  on the stool's seat (`sitSeat`), facing the board, with no shadow of its own. Closing the card (a tap elsewhere) or walking
  on stands you up. Bots head for a free stool now and then (`botSitChance`, `botSitReach`) and may stay a while
  (`botStaySeated`).

- **The statues** (`town/houses/statues.ts`; Oct 26, `docs/decisions/2026-10-26-town-square-statues.md` and
  `-statues-2.md`): the marble statue (the Hidden Boss in stone: his own picture, `RECLUSE`'s idle without the book,
  turned to marble shades by lightness, `bossFigure`) on the gate's left and the bronze statue on its right, each on a
  pedestal about a piece's plinth's size (40 × 24) before the Colosseum ground's end column, drawn by the game over the
  Colosseum's picture (not in it). No name on either. At the world's scale each pedestal's panel carries only a few
  squiggly lines (like writing too small to read).
  Each has its square right in front (`STATUES` in `world.ts`, with its quote) where you stand to look at it; the bots
  never stop there. **Walking up zooms in**: stopping on it (or where a tap on the statue sent you) glides the camera in
  close (`closeGlideMs`) through a longer lens (`mag`, `ox` and `oy` in `camera.ts`; the − / + zoom is untouched), the
  statue whole and as big as fits (where it would reach the − / + and "Back to me" buttons, above them or moved beside
  them, whichever is bigger), the close-up
  drawing (4 times finer, `CLOSE`, made ahead a slice a frame) crossfading in; the people in front of it fade. Once the
  camera arrives the squiggles fade and the quote renders in, line by line, on the pedestal's panel, written at the
  screen's own resolution in the signs' pixel capitals as big as fit (engraved in the marble, cast in the bronze
  plaque; 12.5 px or more on a 360 × 640 phone), and in an off-screen live region (`.town-sr`) for screen readers. A tap
  elsewhere, a drag, a chip, −, + or "Back to me" glides back to the zoom you had and the quote fades.

- **The lights at dusk and night** (Oct 27, `docs/decisions/2026-10-27-town-square-lights.md`). Ten park lamps (`LAMPS`
  in `world.ts`, the art `PARK_LAMP` in `houses/park.ts`): solid props on paving, a pair either end of the promenade, a
  pair beside the fountain and one at each corner of the park's walk; unlit by day and dawn. Each home and the Colosseum
  carries its light spots as data beside its art (`HouseArt.lights` and `.pools` in `houses/index.ts`: boxes in its
  picture's pixels, the palette keys that light up, a color, a strength, a halo for a lantern; `LightSpot` in
  `houses/kit.ts`): its windows, doorways and glass, the Colosseum's gate and a few arches. At dusk (0.7) and night (1)
  (`lightsAt`; they follow the sky's blend, `mixLights`) each light, baked once into a small canvas the first time it's
  drawn lit, is added into a light layer as the world is drawn far to near (anything drawn in front cuts its shape out),
  and the layer is laid on after the tint with `lighter`, only in the 64 px tiles a light touched. Lights fade and haze
  with their pictures; the tags, names and bubble are drawn after them. Nothing is made or drawn by day.

- **The chat log** (Oct 28, Eric: "a little timestamp of the message, the person's name, the message, and then they kind of
  fade… and when somebody says something again, it appears again"; `docs/decisions/2026-10-28-town-chat.md`, then redesigned the
  same day: `docs/decisions/2026-10-28-town-chat-v2.md`; the lines, the modes and every number in `town/chat.ts`, the screen in
  `town/TownChat.tsx`, the header's icons in `town/TownChatTools.tsx`, its styles in `town/town-chat.css`; one mount each in
  `Town.tsx`). **One see-through box** in the map's **top left corner** (flush, 8 px in), over the map and under the cards: a
  phone's from the left edge to about two thirds across and a bit under a quarter down (about 5 messages), a computer's 500 × 340
  with a bigger font (about 12 lines; `CHAT.computerQuery` is styles.css' computer). It keeps one place and size whatever it
  holds. **Nothing is drawn behind or round the text** (Eric, Oct 28, from his phone: "clearly a container still showing behind the
  text"; "I don't want the shadow text period"): no backing, border, bar, box-shadow, text-shadow, backdrop or gradient on the box,
  the stream, a line or the field (its own look in iPhone Safari switched off too); `--chat-back` (an opacity, 0) is the one dial
  to raise a backing later. **The text follows the town's sky** ("during daytime background it defaults to black"): our near-black
  ink by day, dawn and dusk, white by night, by one attribute on the box (`data-tone`, `day` or `night`; `skyTone` in `sky.ts`: night's
  weight against `TOWN_FEEL.chatNightAt`, 0.5, so it flips mid-blend at 5:30 and 19:30; read from `?sky=` or the clock about once a
  minute by the screen itself, never per frame, and only a flip redraws). Plain DOM, drawn only when a line comes or goes
  (a few a minute); the fade is a CSS opacity transition; nothing in the frame loop.
  - **The modes** (`ChatMode`, remembered on this device: localStorage `brc.townChatMode`, in a try/catch; "always on" until one
    is set): **always on** (the default: the box and **its field** always show; **the field is here and nowhere else**, so you can
    only chat in this mode), **new messages only** (the lines show when a message comes and fade `fadeAfterMs` after the last;
    **no field at all**, and the stream runs to the box's foot; each burst shows only its own new lines, and a tap on a
    line's text brings back every line of the last minute, scrollable, until it fades again after `fadeAfterMs` with nothing new:
    Eric's "tap a message and then you see the faded ones"), **off** (no box, no field: the lines, the chatter and other players'
    lines still arrive, with no extra request, so turning it on shows the last minute). The header's **chat icon** (two speech
    bubbles in our own drawing: always on both green, new messages the top one green and the bottom gray, off both gray; named
    "Chat: always on", "Chat: new messages only", "Chat: off") goes to the next mode on a tap. The **gear** beside
    it opens "Town settings", a small sheet over the town (the match options' look) with the chat's mode as three choices (Always
    on, New messages, Off) and nothing else yet. Both sit at the right end of the "Town square" bar's line, a phone's and a
    computer's alike, never over the title. The box's place and size are the same in always on and new messages; off takes
    it away (the box is hidden and the edge chips may use its space).
  - **A line**: "[9:41] Name: message" (this device's clock, 12-hour, no am/pm; the name bold: gold for a boss and mint for a kid,
    each deeper by day and as it was by night; **a player's in a palette color**, below), newest at the bottom, at most two lines
    then "…". The stream **starts at the box's top** and the
    field's strip is fixed at its foot. The box holds **every line of the last minute**: **removed for good** `lifeMs` (60 s)
    after it was said. Longer than the box, it **scrolls**: a finger on a phone (native touch scroll: `touch-action: pan-y` on
    the lines), the wheel on a computer (the wheel over the box scrolls it and never zooms the map); a thin scrollbar shows where
    you are. New lines keep it at its foot unless you've scrolled up (`Stick`); then it stays where you are and a small "↓ new"
    marker (a tap goes to the newest) says lines came. **Fading** (new messages only): `fadeAfterMs` (8 s) after the last
    message the lines and the field fade out (`fadeMs`, 1 s; the faded box takes no taps and can't be tabbed to); the next
    message brings them back (0.2 s).
  - **One way in**: `say(name, text, kind)` (kind: boss, kid, player, system), dropped when no town is open. **Who talks for
    now**: every `everyMs` (20 to 45 s, at random) one of the 14 bosses with a home, or its kid, says a line from `CHATTER`
    (placeholders until real players chat: two a boss, one or two a kid, under 60 characters; never the Hidden Boss;
    Hollow's kid only eerie; anyone but who spoke last). The kids' names are the sidekicks brief's, kept in `CHATTER` until
    the sidekicks are in `BOTS`.
  - **Your own line** (Oct 28, Eric): the field at the box's foot, **in always on only**, just its placeholder "Say something…"
    and your words on nothing (no box, no bar under it, no shadow, no send button), **for a signed-in player on a device the age
    gate didn't mark too young** (`mayTownChat`). Everyone else sees it greyed with why (nothing hidden): "Sign in to chat with
    other players." for a guest, "Chat with other players is for accounts 13 and older." for a young device: at most `maxChars` (80) characters (a count, "7 left", only for the last `nearEnd` (10), shown whole), the keyboard's
    Send or Enter sends (`enterkeyhint="send"`, no button), one message per `sendEveryMs` (15 s; **no "Wait 12 s" in the field any
    more**: the field stays as it is and a try inside the 15 s gets a line only you see, below), 16 px type so iPhone Safari doesn't zoom. The numbers are the server's (`TOWN_CHAT`), which
    decides. **The keyboard** opening must not resize or move the town: while the field has focus the screen keeps its
    height and follows `visualViewport` (`pinTown`); a press on the map lets the field go.
  - **Players' messages** (Oct 28; `town/chat-net.ts`; the server and every rule: [chat.md](chat.md), "The town square's
    typed chat", and `docs/decisions/2026-10-28-town-chat-typing.md`). Sending is `sendTownChat(text)` (async): the field
    waits for the server's answer, keeping your words and the keyboard; your line comes back in the answer and goes into the
    log like everyone's. **A line only you see** (`ChatLog.whisper`; Eric, Oct 28): a gray italic system line in the stream with this
    device's time, never sent anywhere, one at a time (the next takes its place) and gone after a minute like any line; the stream
    scrolls to it. Too soon after your last message (the app's own check: nothing goes to the server): "Sorry, you can't send another
    message for N seconds." (N rounded up, "1 second" singular; `tooSoonText`); and every refusal, the server's reasons too ("That
    message isn't allowed.", "No links or contact details in chat.", "You said that a moment ago.", …): your words stay in the
    field. Other players' lines ride on the live line's poll (`openTownFeed`: `?town=N` every 5 s
    while the town is open and the tab visible; nobody else asks) and come in through `say(name, text, "player", {uid, n})`;
    `unsay` takes lines out by number (a moderator's Remove, the room's `gone`) or by player (Mute, a block), and every
    player's line at once when access ends (signed out, a young device, the chat paused) or the room restarted (a new
    `room`). Muted and blocked players' lines never reach the log. While the switch is off (`PAUSE_TOWN_CHAT`) the field is greyed and says "Chat is
    paused."; while your chat is banned it says why ("Your chat is off: a moderator's decision."). The log keeps the bosses'
    and kids' chatter either way. Nothing here runs in the frame loop: an answer is parsed in the request's callback.
  - **Name colors** (Oct 28, Eric's phone: "random color from a palette each time you join, name can be bolded"; `town/names.ts`):
    a player's name is bold in one of ten colors (`NAME_COLORS`, each a deeper shade for a light sky and a lighter one for night, so
    it is the same color across the sky's switch; chosen against pixels sampled under the box in every sky). Each time the town opens
    the device picks one at random (`pickNameColor`, in `TownFeed.open`), sends it with every message (`color`, the server only checks
    it's a whole number below 32 and carries it on the line), and every reader draws that line's name in it, so everyone sees the
    same color for that player's visit; a line with none (an older app, a test-hook line) gets a steady color from the account (else
    the name). Your own name too. A boss's name stays gold and a kid's mint.
  - **A line's menu**: a tap on a player's **name** (or, with the chat always on, on their line's text; `onTownChatLineTap`;
    lines said by the test hook have no one behind them and open nothing) opens a small card under the line (above it when it
    wouldn't fit): **Profile** (over the town, which stays as it was: Back closes it), **Mute** (by account, on this device, every
    chat), **Report** (fair play's report with "Offensive chat"; the server reads the line's words from its room; the answer shows
    in the card, which then closes), and for a moderator (`profile.admin`) **Remove** (the line leaves everyone's log). On your own
    line Mute and Report are greyed. A tap anywhere else or Escape closes it; the box stays on show while it's open.
  - **Moving it**: press and hold on the box (`holdMs`, 400 ms; on a line or on the box away from them, not on the field), then
    drag it anywhere on the map and let go; it's remembered on this device (localStorage `brc.townChat`, in a try/catch; it starts
    in the corner, and a place remembered from before carries over) and kept inside the map and off the buttons (`clampBox`). A
    plain tap, or a drag that starts without the hold, is the map's (on a line, a finger drag is the stream's scroll): the listener
    sits on the map's box, sees the press and, once the hold is up, calls off the map's press with a `pointercancel` (and the
    browser's pan with a `touchmove`'s `preventDefault` while the box is carried).
  - **Taps**: the box has `pointer-events: none`, except a **line**, the text field, the "↓ new" marker and a line's menu. So **a tap
    on the box away from any line reaches the map** (always on and new messages alike). A tap on a boss's or kid's line does nothing
    (always on) or, in new messages, brings back every line of the last minute (above); on a player's line, see its menu.
  - **The edge chips** keep off the box always in always on and new messages, shown or faded, wherever it's put: `CHAT_BOX`
    (chat.ts; `TownChat` writes it, `chipBlocked` in `render.ts` reads it), so a chip never jumps when the log appears or fades;
    with the chat off the box has no size and the chips may use its space.

- **You** (slice 5): your pawn wears your profile's crate items (`town/you-look.ts`: `Avatar` drawn once into a canvas,
  again only when your look changes; plain when signed out or wearing nothing). The pawn bots wear theirs too (Oct 27: one or two
  each, from `BOTS`; drawn the same way once as the page opens, never per frame; slice 5's "bots stay plain" is replaced). Every pawn's base stands
  on its square's middle, with a contact shadow under it that shrinks and fades as the hop lifts it. You have no ring
  under you (Oct 26, Eric: the ring and the shadow together "looks sloppy"); your gold name tag marks you, and your
  shadows are a bot's, sized from the pawn rather than the margin your items are drawn in.

- **The bots and playing them** (Oct 27, Eric: "a few bots… with different skill level… if you tap them you can invite
  them to a game and then you both run over to the chessboard"; `docs/decisions/2026-10-27-town-bots.md`). **Twenty bots
  since Oct 28** (`docs/decisions/2026-10-28-sidekicks-in-town.md`), one table, `BOTS` in `world.ts` (names and ratings
  live there and nowhere else): a ladder from 600 to 2500 in steps of 100, each rung once. The six pawns keep their names
  and clothes, one every three rungs: Pin Pete 600, Rook Rita 900, Fork Frank 1200, Tempo Tess 1500, Bishop Bo 1800,
  Gambit Gus 2100. The bosses' fourteen **sidekicks** (little kid versions of the bosses, Eric's approved art) take the other
  rungs, an easier boss's kid lower: Squirt (Boingo's) 700, Tex (Wrangler's) 800, Dabble (Smudgy's) 1000, Blocky (Big
  Boy's) 1100, Bun & Bug (Chub & Chirp's) 1300, Pleat (Folio's) 1400, Twinkle (Moo & Moon's) 1600, Drizzle (Puddles')
  1700, Chip (Sawyer's) 1900, Stripes (Babur's) 2000, Woolly (Alfil's) 2200, Crumb (Ginger's) 2300, Sparky (Jefferson's)
  2400, and **Glim (Hollow's) 2500**, the top, stronger than Hollow (Eric's twist). Names at most 10 characters. Each bot
  has a look (`Look`, one field): a pawn's (side, tint and the crate items worn) or a sprite's (`{ sprite }`: a sidekick's
  baked sheet), and a sidekick its boss (`boss`). Shown everywhere as "<name> (bot)" (`botLabel`: their tags, cards and
  games). The bots start off the tables' stools (every table free as the town opens) and sit as they wander.
  - **Six out at once, the others at home, taking turns** (Oct 28: twenty in the square cost about 3 frames a second,
    Eric's frame-rate rule: the decision's numbers; six, as many as before the sidekicks). `botsOut` (6) are in the
    square, shuffled by the town's seed as it opens (the same each time) (back from a game, the bot you played among them); the rest are at home
    (`Person.home`: not drawn, not tapped, on no square: its walker leaves the town's `all`). Every `botTurnMs` (10 to
    20 s) one out, standing, free and at least
    `botTurnAway` (5) steps from you starts home, fading out over `botFadeMs`, and one from home comes out on a free
    square in the park as far from you, fading in (`takeTurns`, `comeOut`). A bot whose card opens stays.
  - **A sidekick in the square** (Oct 28): its own animations, `idle` standing, `walk` walking (no hop: its walk steps),
    `sit` on a table's stool (its sit has its own little stool, drawn over the table's, facing the board; no shadow, not
    lowered like a pawn), and `wave` once when you tap it, then `idle` while its card is open (`spriteAnim` in `world.ts`;
    sitting wins: it never waves off its stool). Mirrored when it walks or sits facing our left, as pawns are. As tall as a
    bot's pawn from its idle's top to its feet (`sidekickSquares`, 0.87), its feet where a pawn's base stands; its name
    tag over its head, as a pawn's. **Its frames are baked** (`scripts/bake-sidekicks.ts`, run after changing a sidekick's
    art): one PNG a sidekick (`town/sidekicks/<boss>.png`: rows idle, walk, sit, wave) and their times, feet and heads in
    `town/sidekick-sheets.ts`; the town loads the fourteen pictures as it opens and cuts every frame into a canvas once
    (`SpriteFrames` in `render.ts`), never per frame; a sidekick isn't drawn (or tapped) until its picture has loaded (a
    moment). No art code runs in the town: the sprites' own code paints for about 3 s as it loads, which would hold the
    town's first frame back (measured: the decision).
  - **A bot's card** (a tap on a bot; placed over its name tag like a boss's; the bot holds still while it's open, `hold`):
    "<name> (bot)", for a sidekick **"<Boss>'s sidekick"** under it (`sidekickText`: "Hollow's sidekick", "Puddles'
    sidekick"), "Rating 1400" and **Play**. Play: you both walk to the nearest table with both stools free (nearest to
    the two of you, `tableFor`), you to the stool nearer you, the bot to the other (`meet`); once both sit (`meetReady`) the
    game opens. Any other walk of yours calls it off. No table free: Play greyed, reading "Play · Tables are full" (in the
    button: the card hugs its content and nothing is added round it; `anyTableFree`, checked only while the card is open).
  - **A bot sitting alone at a table** (`waitingBot`): a tap on the table walks you to its free stool, as before, and its
    card's first button is **"Play <name> (bot) · <rating>"**, Casual and Ranked greyed under it; the bot stays while the card
    is open; the game opens once you sit.
  - **The game** is the 1 v 1 bot game's (`BotDuel` in `duel.ts` with `town`, `screens/Duel.tsx`), on this device: the bot's
    name and its rating on its strip (a sidekick's face, its idle's first frame, in place of the pawn there and on the
    loading step: `face`, an image made as you both sit), "Casual" on yours (not your 1 v 1 rank), no versus moment; first Boss alone's loading step ("Loading the bot…": `MaiaGate`,
    this device's Stockfish paused, Maia loaded alone, at most `loadGateMs`; the same `maiaAllowed` rule; Stockfish at the
    bot's rating until Maia is ready, or if it can't run), then the bot game's vote (Bullet, Blitz or Rapid) and its clock;
    Maia plays at the bot's rating. Colors at random. Casual: "Casual game", no rank change, no coins, nothing sent to the
    server. The gear has Leave (before the first moves) or Resign.
  - **Back to town**: the result's "Back to town", the back button, or a reload (the game's address is
    `/town?at=<table>.<stool>.<bot>`, a step of its own in the history) open the town with you on your stool at that table
    and the bot across, its card closed (`createTown`'s `seat`); the bot gets up and wanders off after
    `botLeaveAfterGameMs` (4 s), unless its table's card holds it.

## The feel: `town/feel.ts`

Every number that shapes how it feels is in `TOWN_FEEL`, one line each: the walk (90 ms a square, the hobble), the camera
sets, the zoom, the camera's follow and glide, the drag, the haze, the clouds' parallax, how often bosses roam and talk,
how often bots walk, the sizes, the names, the sky's hours and its four looks' colors, the lights at dusk and night (`lightsAt`, their glow's bands, the flicker), the rim line. The earlier value is
noted wherever a slice changed one.

## Adding a home

1. Draw it in `town/houses/<boss>.ts` like the others (the game's pixel art: `characters/sprite.ts` parts and frames,
   painted with `houses/kit.ts`), about 144 × 120 pixels standing on its foot (a landmark may stand bigger: Hollow Peak
   is taller, Alfil's Pyramid is 208 × 160), with a blank sign board (`signBoard`) and
   an `idle` of a few frames. Export the `Character` and its sign's face (`signFace`).
2. Add it to `HOUSES` in `houses/index.ts`, its boss's sprite to `BOSS_ART` and the box round its head to `BOSS_FACE` in
   `render.ts`, and a `Home` to `HOMES` in `world.ts` (its id, its boss's name, its name, its chip color and its plot's
   middle square, clear of the Colosseum's ground and about 8 to 10 squares from its neighbors).
3. Look at it at real size and at 2× (`npm run preview:characters -- <dir> extra=packages/app/src/town/houses/<boss>.ts
   only=house-<boss> looks=none`), and in the square.

## Files

- `packages/app/src/town/`: `TownPage.tsx` (the lazy load), `Town.tsx` (the screen, the loop, input, chips, cards, the sky's
  clock, the statues' close-up), `press.ts` (a finger as a button), `camera.ts`, `world.ts`, `render.ts`, `you-look.ts`, `sky.ts`, `sky-draw.ts`, `sign-font.ts`, `feel.ts`, `town.css`, `chat.ts`, `TownChat.tsx` and `town-chat.css` (the chat log), `houses/`
  (one file per home, fourteen in all, the Colosseum's `coliseum.ts`, the park's `park.ts`, the kit of shared pieces and the index),
  `sidekick-sheets.ts` and `sidekicks/*.png` (the sidekicks' baked frames, generated).
- The sidekicks' art: `packages/app/src/characters/sidekicks/<boss>.ts` (one `Character` each, `sidekick-<boss>`, copied
  as drawn from `claude/boss-art`), baked by `scripts/bake-sidekicks.ts` (`npx tsx scripts/bake-sidekicks.ts`).
- References: `docs/mockups/town-square/` (the prototype Eric tested, and the pictures for the homes: Eric's for the
  igloo, the peak and the meadow, his suggestions for seven more). Alfil's Pyramid has no picture: it's our design.

## Tests

- `packages/app/test/town-camera.test.ts`: the projection (the focus in the middle column, wrapping both ways, a tap picks
  the square drawn there, far squares shrink, zooming out shows more rows, the phone / computer blend), the layout
  (fourteen homes 8 to 10 squares from their nearest neighbors, none near the start, the Colosseum's ground and the park
  clear, and the start south of it on the park's promenade), the walk around a home, and the eased steps meeting the even ones at the same speed.
- `packages/app/test/town-sky.test.ts`: which look shows when, the looks always adding up to 1 and blending over their
  half hour in order, `?sky=`, and the tint (none by day, softer at dawn than dusk, coolest and darkest at night).
- `packages/app/test/town-world.test.ts`: one pawn a square (a taken square ends you next to it, the end is always free
  tap after tap, a later claim gives way, three bots ring round one spot, a ring fills nearest first); the Colosseum (its
  ground solid and walked round, its apron open, a tap ends you at its gate and a crowd gathers on the apron).
- `packages/app/test/town-press.test.ts`: down presses, up on the same thing walks, a drag cancels, up elsewhere lets go.
- `packages/app/test/town-world.test.ts` also, the park (slice 6): in front of the gate, paving and grass, no home's roaming
  ground on it; ten tables, each solid with two stools facing each other; the fountain in its middle and the solid things
  walked round; a paved way from the plaza past the fountain to the gate, and every stool reachable; a tap on a table ends
  you on its nearer free stool, where you sit (both taken: beside it); bots sit now and then, a stool each.
- `packages/app/test/town-world.test.ts` also: the statues' squares (on the apron, in front of the ground's end columns,
  symmetric), their quotes word for word, a tap on one walks you there (or beside it), the bots never stop there.
- `packages/app/test/town-bots.test.ts` (Oct 27; Oct 28): the bot table (twenty, 600 to 2500 by 100, each rung once,
  names at most 10 characters, Glim (Hollow's) on top; the six pawns' names, rungs and one or two real crate items each; the
  fourteen sidekicks, one a boss, in the ladder's order, each sheet with idle, walk, sit and wave and its hash matching its
  sprite, so a sheet can't go stale), a sidekick's card line ("Hollow's sidekick"), Hollow's three lines in turn, a sidekick's
  animation (wave once after a tap, walk, sit), "<name> (bot)" everywhere, the walk to the nearest free table (your stool the nearer), sitting and
  when the game opens, calling it off, every table taken (no table; Play greyed) and one freeing, a held bot staying put, the
  bot waiting at a table, a seat in the address and back, and coming back to the table (the bot across, then wandering off).
  `packages/app/test/town-bot-game.test.ts`: the game (its name and rating, the loading step before the vote, casual; a
  sidekick's face on its strip).
- `packages/app/test/town-lights.test.ts`: the park's lamps (8 to 12, solid, on paving, off every path, every square and
  stool still reached, a pawn and a half tall, lit glass with a halo and a pool), every home's and the Colosseum's light
  spots inside its picture and off its sign (Hollow's green window untouched, none near the statues), and when they shine
  (off at dawn and day, on at dusk and night, following the blend).
- `packages/app/test/town-chat.test.ts` (Oct 28; v2 and v3 the same day): the line only you see (`tooSoonText`'s seconds rounded up, "1 second";
  `whisper`: gray system line, one at a time, gone after its minute), the name palette (ten to twelve deep/light pairs, random picks, the
  device's number or a steady one, riding on the line) and the sky's tone (`townTone`: day, dawn, dusk ink and night white, flipping at 5:30 and 19:30,
  `?sky=`); the time's format (12-hour, no am/pm); the three modes (their
  order and cycle, always on, new messages and off; the icon's and the sheet's words; remembered on this device and read back after
  a reload, a stranger or a blocked storage meaning always on); the log (every line of the last minute kept, no cap; the fade after
  `fadeAfterMs` and a message bringing the box back; always on showing every line, new messages the burst on show, off none; a tap
  bringing back every line, a poke while reading, the fade again, the next burst only its own; a line gone after `lifeMs`, one 50 s
  old still there; held; `say` from every kind; when it tells the screen); the stream pinned to its foot unless scrolled up (`Stick`:
  the "↓ new" count, back at the foot); the chatter table (every boss with a home: two lines, its kid one or two, all under 60
  characters, never the Hidden Boss, anyone but who spoke last, all 28 reached, every 20 to 45 s); players' lines (who said them and
  their number, `unsay` by number or by player, a tap reaching the menu; the server's numbers); the box's place (`clampBox`: inside
  the map, off the buttons; stored and read in a try/catch).
- `e2e/town-chat.spec.ts` (phone and desktop; the chat log): the box flush in the top left (8 px in) with its size per platform, a
  line's time and bold name colored by kind (a player's from the palette), nothing behind or round the text (computed: no background
  color, image or gradient, border, outline, box-shadow, text-shadow, backdrop, mask or filter on the box, the stream, a line, a name,
  the field and its placeholder, enabled, greyed or focused), ink by day, the lines from the box's top and the newest last above the
  field, a field with no box round it, no bar under it and no send button, two lines then "…", the box unchanged and never fading always on;
  **the field in always on and nowhere else** (new messages and off have none, the box keeping its place and size); the text's colors
  by sky (ink by day, dawn and dusk, white by night, the names' and gray lines' shades, no backing in either) and flipping with the
  device's clock (`page.clock`, 19:30 and 5:30); the stream scrolling back to a line
  50 s old by finger (a phone) and by wheel (a computer) with the map under it not panning or zooming, the line gone after its
  minute, the wheel off the box still zooming the map; the stream pinned to its foot, staying put when scrolled up with "↓ new" (its
  tap, and the foot by hand, giving it up); a tap on the box away from a line reaching the map, a boss's or kid's line taking the
  finger, a player's name or text (always on) taking its own tap (`__townTapped`); new messages (the lines and the field showing
  with a message and fading after the wait, not before, the box unchanged, a faded box taking no taps, the next burst only its
  own lines, a tap on a line's text bringing back every line, scrollable, until it fades again, a name's tap the menu's); the
  header's icon (never over the title, on its line at the right end; always on (both bubbles green), new messages only (the top one), off (none) with the bubbles' colors and
  the accessible names; off hiding the box and the field and the lines that came meanwhile showing when it's on again; remembered
  across a reload) and the gear's "Town settings" sheet (three radios, nothing else, setting the mode, closed by Escape, its X
  and a tap outside); the text field for a signed-in player (80 characters, the count shown whole, one every 15 s, a try inside the wait
  giving the gray "Sorry, you can't send another message for N seconds." line and nothing sent to the server, your line back from the
  server as a player in a palette color, the same all visit, Enter sending); a greyed field for a guest; press and hold moves the box (remembered across a
  reload, never over the buttons or off the map), a tap or a drag without the hold is the map's; the chips keep off the box (always
  on and new messages, shown, faded or moved over one of their places) and use its space with the chat off; the keyboard doesn't
  resize or move the town (the visual viewport's offset stood in). Players' messages (its players are made signed in in the local
  database, `asSignedIn` in `e2e/helpers.ts`): two signed-in players see each other's lines within a few seconds, with each name bold
  in the same palette color on both screens, a guest none (greyed field, never asks); a refused message's reason as a gray line only you
  see (a swear word, a link, a phone number; one at a time, your words kept), 80 characters and the 15 s
  wait on the server; a line's menu (your own: Mute and Report greyed; Report reaching fair play's case page with the line; a
  moderator's Remove leaving every log; Profile over the town and back; Mute hiding the player); the switch off ("Chat is
  paused.", the chatter going on). Only each test's own lines are counted: other tests' players share the room.
- `packages/app/test/town-chat-net.test.ts`: a guest or a young device never asks; lines ride on the live poll; muted and
  blocked players' lines never reach the log; a removal and the switch reach it; sending mirrors the limits and shows the
  server's reasons, a try inside the 15 s never reaching the server, and the name color picked when the town opens (a new one
  each time) going out with each message; Report and Remove.
- `e2e/town.spec.ts` (phone and desktop; `e2e/areas.json`, "the town square"): the page loads, the world is drawn and
  fills its box, a tap ahead walks you there, the zoom pair works (it opens zoomed out) and sits in one row with the round focus
  button ("Back to me": no words, 14 px from the bottom right corner, bringing the camera back to you), back goes home; each statue (a
  tap walks you up, the camera zooms in close on it, its quote word for word in the live region, its letters at least 12
  pixels; a tap elsewhere glides back to the zoom you had, zoomed out or in, and clears it); `?sky=day` and
  `?sky=night` draw different skies; a boss's card, its confirm (Stay, then Leave to the Boss raid screen, his tile
  picked); a home's card (Shop greyed, "Coming soon", closed by a tap elsewhere); the Colosseum's (a tap on its gate walks
  you to the apron; "Raids with people" greyed, "Coming soon"); a park table's (slice 6: a tap walks you to a stool and you
sit, its card with "Casual" and "Ranked" greyed and "Coming soon"; a tap elsewhere closes it and you stand; Oct 27: no
title; a bot waiting, two playing (the board's pixels change), a tap on their game: "Spectate" greyed, and you don't sit); the lights (at `?sky=night` a park lamp's glass and Babur's Circus's lit doorway are clearly warmer and brighter than at `?sky=day`); Folio's Folded House (a tap walks you there, to the ring round its plot from column 33 east, and opens its card; at night its doorway keeps its lamplight, warm, as the town darkens). Test hooks: the canvas's `data-you` (your square),
  `data-ready` (a frame is drawn) and `data-sit` ("1" while you sit at a table); with the test switches on, `window.__townAt(kind, id)` (where to tap a boss, a home or
  the Colosseum's gate) and `window.__townGather()` (the three nearest bots come and stand beside you), `window.__townAt("statue", "bronze" | "marble")`, `window.__townAt("table", i)` (a table by its index in `TABLES`), `window.__townAt("lamp", i)` (a park lamp's glass, by its index in `LAMPS`), `window.__townAt("light", id)` (a lit pixel of a home's, or `"coliseum"`'s, first light with nothing in front of it) and
  `window.__townCam()` (the zoom, the lens, the focus, the statue up close, whether its quote shows and its letters' size),
  `window.__townSeat(i, n)` (the nearest free bots sit on table i's first n stools, and every bot holds still from then on)
  and `window.__townTables()` (each table's state: "still", "waiting:<free stool>" or "playing"); the bots (Oct 27):
  `window.__townAt("bot", i)` (where to tap BOTS[i]), `window.__townCall(i)` (BOTS[i] comes to stand beside you, out from home first if it's there, and every bot
  holds still; -1: only the holding still) and `window.__townBots()` (each bot: its name, square, the table it sits at, whether
  it walks, whether it's at home, a sidekick's animation). Playing a bot (Oct 27, phone and desktop): a tap on Tempo Tess opens her card ("Tempo Tess (bot)", "Rating
  1500", Play), nothing of Maia's fetched yet; Play walks you both to a table, the game opens (the gear, her name and
  rating on her strip, Maia's worker started), one move each, resign ("Casual game"), "Back to town": you on your stool, she
  across, then she wanders off; a bot sitting alone at a table: its card's "Play <name> (bot) · <rating>" (Casual and
  Ranked greyed), the game; a reload, then again and the back button, each lands you back at the table. The sidekicks
  (Oct 28): a tap on Glim, it waves, then stands while its card is open ("Glim (bot)", "Hollow's sidekick", "Rating
  2500", Play); Play, the game with its face on its strip, resign, back at the table with Glim across in its sit; Hollow
  Peak's card shows his first line, closed and opened again the second (`__townGlide("hollow")` takes the camera there,
  `__townBossBack("hollow")` keeps Hollow behind his home); Babur's card has no line. `__townBots()` also gives each bot's
  animation (`anim`: a sidekick's, null for a pawn).
  The chat log's hooks (the test switches on): `window.__townSay()` (someone from `CHATTER` talks now), `__townSay(name, text, kind,
  agoMs)` (that line, said `agoMs` ago: a line 50 s old to scroll back to), `__townChatter(false)` (no chatter of its own; true
  starts it again) and `window.__townTapped` (the text of each tapped player's line).

## Not built yet

The bottom strip, a player's card ("Invite to party"), the shop itself, the Colosseum's menu (raids with people,
party), the park's matchmaking (sitting at a table queues you: `ROADMAP.md`, "The park"), quick chats, other people's dressed pawns, the Simple map setting, real players and
rooms, sounds.
