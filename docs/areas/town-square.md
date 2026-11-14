# The town square (/town)

Boss raid's coming home: a small round world where players walk around and meet the bosses at their homes (the plan:
`ROADMAP.md`, "Boss raid: the town square"). **Slices 1 to 3** are the world alone, on a hidden address: the sky by
the time of day, the curved ground, all fourteen boss homes with their bosses roaming near them, the bots (twenty since Oct
28: six pawns and the bosses' fourteen sidekicks) and you; slice 4
added the press, the trail and the cards; **slice 5 the Colosseum** in the middle; **slice 6** made the Colosseum about
twice its size, the map bigger, and put **the park** with its ten chess tables in front of its gate; **the lights** (Oct 27) light the park's lamps and the homes' windows at dusk and night; **the chat log** (Oct 28; v2, v3 and v4 the same day) is one box in the top left corner, with a chat icon and a gear in the header, where the bosses and their kids say a line now and then and signed-in players type (tap the box to type); **name tags** (Oct 28) show only near you by default, a boss's sidekick's in blue. Home's **Chess Town** button (Oct 26, Eric, as the Boss Arena card; since Nov 1 a little town scene under PLAY)
opens it, and the computer's side menu's Chess Town item; the address `/town` opens it directly too (`hunchess.com/town`,
behind Cloudflare Access like the rest of the site). Phone and computer; **on a computer it sits in the front door's frame** (Oct 29, below).


**Since Nov 13 the street town (below, "The street town") is everyone's town, players' and guests' alike, and the old Canvas 2D town's
code is gone** ([2026-11-13-street-town-for-everyone.md](../decisions/2026-11-13-street-town-for-everyone.md)): its 46 × 46 map, park,
lamps, start (22, 17), zoom-out camera, drag-to-pan and Colosseum picture. Much of "How it works" below tells the old town's story (its
layout, its camera); where it and "The street town" differ, the street town is how it works now. `ADMIN_TOWN` (`town/admin-town.ts`) still
gates the admin-first bosses' homes (core's `BOSS_ADMIN_FIRST`: Timber's, Dash's, Rolling Dough): in a player's town their lots are left out
before the rows are laid (`street.ts lotHere`), so each row fills the place with look-alike fronts. Test: `packages/app/test/town-player.test.ts`.
## How it works

- **The page.** `App.tsx` mounts it at `/town` the way it mounts `/autochess`; `town/TownPage.tsx` loads the rest with a
  dynamic `import()`, so none of its code, art or styles are in the main bundle. The back button goes home (and the
  address back to `/`). Stockfish isn't warmed on this page, and nothing of Maia's loads
  while you walk round it (Eric's frame-rate rule, `docs/rules/eric.md`); a game with a bot loads it when it opens.
- **Layout.** A slim bar (the back button, "Town square", and at its right end the chat icon and the gear: "The chat log"),
  then the world fills the rest of the screen. **On a computer (Oct 29, Eric) the town sits in the front door's frame:** the side
  menu on the left (Chess Town marked as where you are) and the live panel with the global chat on the right, as on home, and the
  town filling the center column's box, edge to edge (`.fd-center`, which is home's middle box: the same left, top, width and
  height at every size from 1024 px up; the box is as high as the window, so at 1024 to 1279 px, where home's own box grows
  taller than the window and scrolls, it's the window's height). No bar there since Nov 7 (Eric's mockup): the map, chat and gear
  buttons are in the right column's top slot under "TOWN" (portaled from `Town.tsx`), in the town and its rooms. The buttons, the chips,
  the cards and the chat box are all inside the box. A computer is a window 1024 px wide or more **with a mouse** (`(hover: hover)
  and (pointer: fine)`, `COMPUTER` in `TownPage.tsx`, the same test the desktop board uses): phones, tablets (a tablet on its side
  included: touch) and a mouse window narrower than 1024 px have the whole screen and both icons at the right, as before.
  `TownPage` wraps the town in `FrontFrame page="town"` there (`fd-on-town`, 1080 px at most, as home's), and the town adds
  `in-frame` to its screen (`town.css`: in the page's flow, the window's height, not fixed). On a computer **the chat icon sits right
  after the "Town square" title and the gear alone at the right end** (`town-chat.css`: the tools' box `display: contents`, the gear
  `margin-left: auto`): the chat's place was hard to see at the far right. Every side-menu item leaves the town (`goHome` in
  `App.tsx` closes it), Chess Town opens it again. Leaving asks "Leave Chess Town?" first (`town/LeaveTown.tsx`; Stay focused,
  Escape is Stay; both set in layout effects so a key in the sheet's first frame isn't lost, Nov 10), from the street and inside any building
  (Nov 13): the side menu, back, the back gesture, an invite's Join (`setInviteHost` in `App.tsx`: Stay keeps the invite) and a profile's
  Challenge over the town (Stay makes no game). The town pushes a step of its own into the history as it shows (`TOWN_STEP`, App.tsx), so
  the back gesture always has a step to take and asks, even with nothing of the app's before the town; the town left another way leaves
  that step behind, and a back onto it just puts the address back to `/`. Known limit: resizing a mouse window across 1024 px adds or takes away the
  frame, which starts the town again at its start square. The world never assumes a screen size: it fills its box and works its camera out
  from the box's shape, so the panels Eric designs around it can change without touching it. The back button, the chat icon, the
  gear and the buttons stay put. **The buttons** (Eric, Oct 28: "remove the 'Back to me' button … replace with circular focus
  icon … zoom button on left, focus button to right but are in the bottom right corner") are one row in the map's bottom right
  corner, 14 px in: the arrow keys on top (see "Arrow keys" below), and under them, together as wide as the keys (87 px, right-aligned),
  the −/+ pair (57 × 27) and then the **focus button**, a round white button as high as the keys (27 px) with a ring, four
  ticks and a dot (a map's locate-me, our own inline SVG) and no words; its accessible name is still "Back to me" and it does what
  "Back to me" did (the camera comes back to you). `.town-controls` is the row's box: the edge chips, the statue close-up and the
  chat box (`clampBox`) keep clear of it (`keepClear`, `buttons()`), so they follow it to its new place; the town card has never
  been kept clear of them (the buttons draw over a card), and a row 36 px high covers less of it than the stack did.
- **The camera** (`town/camera.ts`, pure math): a pitched pinhole camera over a ground that drops away from the focus
  point (a small round world), cut at a rim that forms the horizon. Two tuned sets, the phone's and the computer's,
  blended by the box's width / height (0.6 = all phone, 1.4 = all computer). Zooming out raises the camera, moves it back,
  pitches it down and lets the rim reach further; the page opens zoomed out (`startZoomedOut`). The world is 46 × 46 squares (40 × 40 until slice 6) and wraps both ways. A tap picks the
  nearest drawn square under it (`pickSquare`). The far band of ground dissolves into the sky; things in it fade, haze
  and blur, and are drawn whole, never cut by the rim. (Each is softened through a scratch canvas of its own that frame,
  cleared only where it's used: `blitSoft`. Oct 28: one shared canvas, the size of the biggest picture it ever held,
  cleared and copied whole for each thing, cost the frames south of the park, where the whole park and the Colosseum
  are in the far band. docs/decisions/2026-10-28-bots-rotation.md.)
- **The layout** (`town/world.ts`, `HOMES`): fourteen homes spread evenly round the middle over the world that wraps, so
  neighbors stand 8 to 10 squares apart (and in an admin's town a fifteenth and sixteenth, **Timber's Lumber Lodge** and **Dash's Kicks**, Nov 3, below); the Colosseum on its 12 × 12 ground (`COLISEUM`, columns 17 to 28, rows 28 to 39),
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
- **Away and guests (Nov 7, #542; [2026-11-07-town-afk.md](../decisions/2026-11-07-town-afk.md)).** No input for 1 min (`TOWN_AFK`): a pixel "zzz" by your pawn (`zzz.ts`), town and shops; 5 min idle or hidden: home, "You've been dropped from the town" (`afk.ts`, `here-net.ts`, `AwayNote.tsx`). A challenge and the claw machine hold the clock.
  Signed-in devices beat `POST /api/town/here`: real players walk in each other's town in their outfits; the server drops away ones itself (`server/src/town-here.ts`). Guests watch (outfits, no names), read the chat (typing greyed: "Make a free account to chat."), and after 30 s get "Make an account to keep exploring" (their clock starts once the town is drawn, not under its loading screen, Nov 13). Switches `?townafk=`, `?townroom=`, `?townguest=`; hook `__townHere()`.
- **The drawing** (`town/render.ts`): one canvas, one `requestAnimationFrame` loop (in `Town.tsx`), stopped when the screen
  closes or the tab is hidden; device pixel ratio capped at 2; nothing allocated per frame on the hot path (square colors,
  fonts, gradients, clouds, pawns and every boss and home frame are made once, the frames the first time they show).
  Since Nov 10 (phone load 3) a picture's pixels are painted the first time it's drawn too (`houses/kit.ts` `paint`: so a paint
  function must not lean on anything that changes after the call; `test/town-paint-lazy.test.ts` checks every picture), and each
  statue's world-scale picture is made when first drawn: opening took 5.8 s to its first frame on a slowed phone, now 2.1 s
  (`e2e/perf.spec.ts`, "Chess Town on a slow phone").
  It draws through a **drawing layer** (`town/paint.ts`, Oct 30) with two backends: Canvas 2D (the old town's, gone since Nov 13; it stays
  only as the blank canvas under the failure message) and
  WebGL 2 (the street town's only drawing since Nov 6, `town/paint-gl.ts`; below, "WebGL").
- **WebGL (Oct 30; docs/decisions/2026-10-30-town-webgl.md; the street town's only drawing since Nov 6,
  docs/decisions/2026-11-06-street-webgl-only.md).** It draws the same picture with WebGL 2 in a few draw calls a frame instead of hundreds of canvas calls. `paint-gl.ts` stands in for the part of the 2D
  context render.ts uses (state, transforms, save and restore, paths, clips, strokes, shadows, text, images) and batches the
  frame into textured and solid triangles: textures from the canvases render.ts already makes, packed into 2048 px atlas
  pages (layers of one array texture) and uploaded again only when render.ts calls `changed` (a tag or a table's board drawn again); clips that are upright
  rectangles cut on the CPU, other shapes a stencil bit each; a stroke's shadow (the table's ring, the pressed square's glow)
  worked out per pixel; the far band's softening in one shader pass (no scratch canvases); lights and their cuts in one
  blend; text and the bubble drawn once into canvases. One shader in three builds (solid; with textures; with the soft
  modes too), each draw using the least that covers what it holds: the same pixels, much less work for a software
  renderer. 4x multisampling on a GPU; where the browser would render WebGL in software (no GPU, or SwiftShader in the
  headless tests: `failIfMajorPerformanceCaveat` refuses the first context), none, which halves a frame there (Oct 30,
  later). **It never falls back to today's town** (Eric, Nov 13: he saw the old town on his iPhone; `town/gl-fail.ts`,
  [2026-11-13-town-no-old-fallback.md](../decisions/2026-11-13-town-no-old-fallback.md)). Context lost: nothing drawn until it's back
  (textures made again), however often; lost while the page is hidden (iOS drops WebGL in the background) it waits for the page to
  show, then gets 5 s (`LOST_WAIT_MS`) to come back. Not back, or WebGL failing as it starts (no context, its shader fails): the
  street town reloads once (`/town`, the same query); failing again within 2 minutes of that (`RETRY_WINDOW_MS`, the time kept in
  the tab's session storage), the town's box shows the loading card's look with "The town didn't load. Please retry." and a
  **Retry** button, nothing else (`.town-broken`). No WebGL 2 at all: "Chess Town can't run on this device.", no button, no reload.
  A standing rule (docs/rules/eric.md, "The town never shows an old version"). Each page reports once with its reason (`retry` for
  the page that gives up), nothing else shown (the health view counts them: docs/areas/ops.md, "Health"). The canvas says which backend
  (`data-backend`). Tests: `test/town-gl-fail.test.ts`, `e2e/town-street.spec.ts` ("context lost"), `e2e/problems.spec.ts`
  ("without WebGL 2").
- **Taps** (slice 4: `town/press.ts`; cleaned up in slice 5). A finger down presses the square you'd walk to like a
  button: its face dims a little and one bold gold border lies on its edge, glowing outside only, while the finger is
  down; up on the same thing releases it with one short pulse of that border (brighter, a little wider, fading) and you
  set off; moving past `dragPx` first lets it go (no pulse, no walk) and becomes a
  look-around drag. No sound and no vibration (Eric). A small gold ring marks your destination until you arrive. As you
  run you leave about three soft white droplets on the squares you leave, fading out in about half a second (yours only); on a
  ride with a trail, its own mark instead (Nov 1: "Rides", below).
  All their numbers are in `feel.ts`.
- **One pawn a square, like chess** (`world.ts`): a walk may pass through people, but nobody ends on a square someone
  stands on or is headed for (`taken`: a walker's goal). A free square is its own end; a taken one, a person or a boss
  ends you on the nearest free square beside it (`spotNear`: the 8 squares round it, then the next ring out, and in a
  ring the one fewest steps away), so several people going to one person ring round them; a home ends you on the ring
  round its plot, the Colosseum (or its ground) on the free apron square nearest its gate (`destFor`), so a crowd at the
  gate grows in a half ring. If two walks end on one square, the later claim gives way to the nearest free square
  beside it (`keepApart`, every tick). Bots and bosses pick their ends the same way.
- **A tap near a home's foot is the home's** (Nov 12, Eric: "more grace where you can click anywhere near or on the building"): its
  picture, its plot (the half-hidden row under its front), its foot row (the row right in front of its front edge across the plot,
  its door square among them: `world.ts homeNear`), a see-through pixel of its picture's box over ground within a square of its
  plot and no other home's (`render.ts pick`), and your own pawn over any of those (`Town.tsx pickTap`; a tap on you elsewhere
  still does nothing). Not the corners beside the foot row, nothing two rows out; people, bosses, tables and statues are picked
  first. Of two homes, the nearer door. It walks you to the door square and opens its card, as a tap on the building does. Test
  hook `__townPick(x, y)` (its key, where you'd walk, the card). Tests: `packages/app/test/town-door-tap.test.ts`,
  `town-world.test.ts`, `e2e/town-street.spec.ts` ("Alfil's Pyramid"). [2026-11-12-town-door-tap.md](../decisions/2026-11-12-town-door-tap.md).
- **Cards** (the prototype's, inside the world's box, over the boss's head or above the home's name, placed every frame;
  a tap anywhere else, or Escape, closes one). **Every card is dark** (Eric's mockup, Oct 28: "dark card" with a "thin warm-gold
  border"): `#20212a`, a 1.5 px `#d9bb8c` border, rounded corners, a tail with the same border pointing at what it's about, white
  words, gold primary buttons (a gradient, dark words), plain buttons dark gray with white words, greyed ones dimmer and flat,
  "Coming soon" gray; every word on it 4.5:1 or better (`town.css`, `.town-card`; the chat's menu keeps the light `.town-btn`).
  Their content, buttons and layout are as they were; only a person's has the picture row (below). A boss says something as its card opens (Eric, Oct 27): its select sound
  (`SELECT_SOUND`), or its own town sounds in turn (`TOWN_SOUNDS`, `townSound` in `characters/boss-select.ts`: Folio's
  murmur, then its "mm-hm"), made ahead in the sound worker as the town opens so a tap never costs a frame. **Hollow's card
  says a line** (Oct 28, Eric's three, word for word, about his sidekick: `TOWN_LINES`, `townLine` in `world.ts`), under
  its title, the next in turn each time his card or Hollow Peak's opens (its confirm is the same card); no other card has
  a line. Its card: its name and **"Challenge alone"**, which asks **"Leave the town
  square?"** / "You'll fight [boss] in Boss Battle." / **Leave** / **Stay**; Leave closes the town square and
  opens the Boss raid screen with that boss's tile picked (`rememberBossPick`, then the screen as the side menu opens
  it); Stay closes the confirm and its card. A home: its name, **"Shop"** greyed (shown, not tappable) and "Coming
  soon"; a home you can go into (a shop: "Inside a shop", below) only its name and **"Go in"**, centered. The Colosseum (slice 5): "The Colosseum", **"Raids with people"** greyed and "Coming soon" (Eric's menu for
  raids with people will live there). The boss stays put while its card is open. Tapping something both opens its card
  and walks you next to it.
- **Arrow keys** (Eric, Nov 4, `town-arrow-keys-v3`; `town/arrows.ts`). Hold an arrow and your character runs that way, square to
  square at a tap's pace, as long as it's held; two held is a diagonal (the axes alternate, one square each); a release stops you after
  the step in progress; walls, the floor and people stop you as they stop a tap. The on-screen keys (27 px, three across and one up,
  see-through white with a chevron; held: dark, a pixel lower) and the keyboard (the arrows and WASD, never while typing in a box or
  a chat log) feed the same held directions, and the matching key lights while held. A key's walk stands you up, closes a card and
  calls off a game you were walking to, as a tap does. Inside a shop the keys walk you about the room (not during a challenge's intro).
  **Up is up the screen everywhere** (Eric, Nov 5, a standing rule: docs/rules/eric.md): the town's rows run away from the camera and
  a room's toward it, so the walker carries which way its rows run on screen (`Walker.rowsUp`: 1 the town, -1 a room), and both its
  view (a ride's back going up, its front going down) and the keys' step (`keyWalk`, through `screenRow`) turn by it, in that one place.
  Walking is `Walker.run` (world.ts): the walker asks for its next square as each step begins, so a held key runs on without a stop.
  Numbers: `TOWN_FEEL.youStepMs` (the same pace as a tap); the sizes are the CSS in `town.css`. Test: `e2e/town.spec.ts`, "the arrow
  keys"; unit: `packages/app/test/town-arrows.test.ts`. Decision: `docs/decisions/2026-11-04-town-arrow-keys.md`.
- **Looking around.** Drag to look
  around; the focus button ("Back to me") brings the camera back (and, since Nov 13, eases a look round snapped to another quarter back
  to the normal view); − / + (and the mouse wheel) zoom. The chips at the box's edge show the
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
  the far ground) is gone (it ghosted the far squares; deleted Nov 13 with the 2D town). The sun and moon sit low over the horizon and shift only a little as you walk round the world.
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
- **Name tags** (Oct 28): each drawn once per name, size and **kind** (`TagKind`: you, a pawn's "bot", a boss's "sidekick"; its pill, its soft
  shadow and its name, at the device's pixels; `TagCache` in `tags.ts` is the cache's keyed lookup and its least-lately-used eviction, tested
  without a canvas) and stamped each frame (`drawTag`, `tagArtOf` in `render.ts`; about 64 kept, the least lately used
  making way; drawn again when a web font loads); a fading tag stamps its shadow, pill and name one over the other, as
  they were drawn before. The things are sorted far to near in place (`sortFarFirst`, nothing allocated).
  - **Colors** (`TAG_STYLE`): a pawn's pill white (`rgba(255,255,255,.92)`) with dark ink, yours gold (`rgba(255,215,106,.96)`), **the 14 boss
    sidekicks' blue** (`rgba(29,78,216,.96)`, `#1d4ed8`) **with white text**: 6.7:1 with white, still over 6 over the lightest backdrop (WCAG AA is
    4.5:1), and clear of the day sky, the sand, the grass and the night sky (the measurements: docs/decisions/2026-10-28-name-tags-near-you.md). A sidekick is a bot whose look is a sprite (`isSprite`). White and gold are drawn pixel for pixel as before (#399's check: at most
    3/255 against the old per-frame drawing).
  - **Names near you** (Eric, Oct 28: "only people in the radius around you have names shown and as you walk they fade in and out, the people are
    always visible but the name tags no"; `town/tags.ts`, `TOWN_FEEL.nameRadius` 5 and `nameFadeSquares` 1): by default (`near`) a figure's
    tag shows only while the figure is within **5 squares of you in both directions** (|dc| ≤ 5 and |dr| ≤ 5, about a 10 × 10 area, from the
    fractional positions the walkers are drawn at), **fading** over the last square at the edge (alpha 1 up to 4.5, linearly to 0 at 5.5:
    `nameAlpha`, from positions each frame; the drawn alpha eases toward it over about 150 ms, at most half the way a frame, so a slow frame can't pop it: `easeTag`, Nov 6). It takes the smaller alpha of that and today's far-distance fade
    toward the rim (`tagFar`; `tagAlpha`). **Always shown, whatever the distance**: your own tag; a figure whose card is open (`town.hold`);
    one seated at a table with you; one walking to or from a game with you (`town.meet`, `town.leave`). The figures are always drawn; only the
    tags go. **"Everyone"** (Town settings, under Chat: "Names", the choices "Near you" and "Everyone", the line "Near you: names show within 5
    squares of you.") is exactly the old behavior. Remembered on this device (localStorage `brc.townNames`, `near` or `everyone`, in a try/catch).
    Test hook: `__townTags()` lists the tags drawn in the last frame.
- **The tables' boards** (Oct 27; docs/decisions/2026-10-27-park-tables-live.md): each table's top is a flat slab drawn
  through the camera (`drawBoard` in `render.ts`; sizes `TABLE_BOARD`, pieces `TABLE_PIECES`, the clock's digits
  `TABLE_DIGITS` in `houses/park.ts`; timings in `TOWN_FEEL`'s `table*`), its 8 x 8 board lying flat between the stools and
  tiny pieces standing on it (the back ranks' shapes, the pawns in front). Who sits decides what it shows (`tableStates` in
  `world.ts`): **two people, not you, play** (white and black in turn, a step or three forward each, captures fading out,
  back to the start after `tableMoves` moves; a black clock floating over the board counts the game's time); **one, not
  you, waits** (a soft green ring pulses on the ground under the free stool); otherwise the pieces stand set up. You at a
  table aren't playing or searching yet (Casual and Ranked come with the tables' matchmaking). While nothing on a board
  moves and the camera holds still, its slab, board and pieces are one cached picture (`boardCache`): frame rates as main.
  Its top is lifted onto the table's picture in the camera's true perspective (`tableLift` in `camera.ts`); low on the
  phone's screen, where that would draw it more than `tableBoardGrow` (1.2) times its foot's scale (Oct 28, Eric's warped
  boards: twice the table and more, skewed), it's worked out a little farther off and drawn at the picture's place and
  scale.
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
  `Town.tsx`). **One box** in the map's **top left corner** (flush, 8 px in), over the map and under the cards: a
  phone's from the left edge to about two thirds across and a bit under a quarter down (about 7 messages), a computer's 500 × 340
  with a bigger font (about 12 lines), and in the frame 500 × 190 (8 lines: Eric, Oct 30, made it 120, a third as tall, "so easy to
  click on it when running around"; Nov 12, about half as tall again (4 more lines), "bump the desktop to about 4 or 5 more lines. Make it about 1.5 times the
  current height"; `docs/decisions/2026-10-30-town-chat-short.md`, `2026-11-12-town-chat-hints.md`; the phone's is unchanged: a taller one
  would cover more of the map it walks on; `CHAT.computerQuery` is styles.css' computer). It keeps one place and size whatever it
  holds, **and in every mode**: the stream ends above a **30 px strip at its foot that is reserved for the typing line** whether it shows
  or not (v4), so the line appearing moves nothing. **Nothing is drawn behind or round the text** (Eric, Oct 28, from his phone:
  "clearly a container still showing behind the text"; "I don't want the shadow text period"): no backing, border, bar, box-shadow,
  text-shadow, backdrop or gradient on the box, the stream, a line or the typing line (its own look in iPhone Safari switched off
  too) **except the one the v4 background gives**: `.tc-back`, one rounded rectangle behind the whole box (the stream and the typing line
  together) with a faint tint (white at 26% by day, a dark `rgb(8 12 24)` at 34% by night, so the white night text reads) and, **while you
  type**, a slight `backdrop-filter: blur(3px)`, measured off Eric's mockup. It shows while you're typing, or whenever the box shows when
  **"Chat background"** (Town settings, off by default, remembered on this device: `brc.townChatBackground`) is on (`chatBlurs`: while the box
  shows and typing or the setting); with the setting on and nothing typed it is **the tint alone**: **the blur only while typing is the
  frame rate's corner cut** (measured by eric.md's method it cost a phone about 0.3 ms a frame when it showed all the time: [the decision's
  v4 section](../decisions/2026-10-28-town-chat-v2.md); one more CSS selector puts it back). It is nothing until then: no backdrop is asked
  of the frame. `--chat-back` (the v3 dial) is gone. **The
  text follows the town's sky** ("during daytime background it defaults to black"): our near-black
  ink by day, dawn and dusk, white by night, by one attribute on the box (`data-tone`, `day` or `night`; `skyTone` in `sky.ts`: night's
  weight against `TOWN_FEEL.chatNightAt`, 0.5, so it flips mid-blend at 5:30 and 19:30; read from `?sky=` or the clock about once a
  minute by the screen itself, never per frame, and only a flip redraws). Plain DOM, drawn only when a line comes or goes or typing opens
  or closes (a few a minute); the fade is a CSS opacity transition; nothing in the frame loop.
  - **To chat, tap the box** (v4; Eric: "to chat you tap the chat box anywhere that isn't someone's name"). **Anywhere on it but a player's
    name** opens typing: the blur behind the box, the typing line in the strip at its foot (an `<input>` with **no placeholder**, no border
    and no backing, `visibility: hidden` until typing: the instant a tap lands it is switched on and `focus()`ed in the tap's own handler, which
    iPhone needs to open the keyboard, with the `click` that follows as a backstop), focused (the keyboard on a phone, the cursor on a
    computer). **Enter or the keyboard's Send sends** and closes it; **a press on the map or Escape closes it** (the line hides, the keyboard goes,
    the blur goes unless the setting holds it); the words you typed stay for the next tap. A guest, a young device, a paused chat or a chat
    ban gets the same line **greyed with the reason in it** ("Sign in to chat with other players.", …): the reason is the disabled input's
    placeholder. **The hint** (Eric, Nov 12: "in very faint, like gray… tap the box to type… only a few words… it will disappear when the
    text box disappears as well"): while the box shows and you aren't typing, the strip holds "Tap here to type" (a phone) or "Click here
    to type" (a computer; `CHAT.hintPhone` / `hintComputer`, `chatHint`), thin (300) and faint gray (`--chat-hint`, the system gray at 0.72,
    by day and by night), the messages' size, its first letter 8 px in like the timestamps' "[", no touches of its own (a tap there is the
    box's). It hides the instant typing opens (the form's `data-open`) and comes back when typing closes; it fades and goes with the box
    (new messages' fade, off). It is a `div.tc-hint`, not the field's placeholder (the field still has none). A tap is a press under `holdMs` (400 ms) that moves under `holdSlopPx` (8 px); a finger that
    moves scrolls the stream, and press and hold picks the box up, as before. While typing, in new messages, the lines are held and every
    line shows ("high text", below). A keyboard reaches the box with Tab (the stream takes focus) and Enter opens typing.
  - **The modes** (`ChatMode`, remembered on this device: localStorage `brc.townChatMode`, in a try/catch; "always on" until one
    is set): **always on** (the default: the box always shows, never fades, and keeps **every line of the last 5 minutes, at most 100**,
    to scroll back through), **new messages only** (**the same box, differing only in that the lines fade**: they show when a message comes
    and fade `fadeAfterMs` after the last; each burst shows only its own new lines; **a tap while they show opens typing and behaves as
    always on until you finish**, "temporarily making it 'high text'" (Eric): every line of the history, no fade, scrollable, until you
    send, tap the map or press Escape, and then it fades after the wait as usual; **the icon stays one bubble green throughout**; faded, the
    box takes no touches and the map under it gets them), **off** (no box: the lines, the chatter and other players' lines still arrive, with
    no extra request, so turning it on shows the history; off stays off: nothing to type in). Switching to always on shows the whole history to
    scroll back. The header's **chat icon** (two speech bubbles in our own drawing: always on both green, new messages the top one green and
    the bottom gray, off both gray; named "Chat: always on", "Chat: new messages only", "Chat: off") goes to the next mode on a tap. The **gear**
    beside it opens "Town settings", a small sheet over the town (the match options' look): the chat's mode as three choices (Always on, New
    messages, Off), under them **"Chat background"** (a switch, off by default; its line: "A soft tint behind the chat, always on while the chat
    shows.": the tint always, the blur while you type), and under Chat **"Names"** (two choices, "Near you" and "Everyone"; "Name tags", below). On a phone (and a tablet) both icons sit at the right end of the "Town
    square" bar's line; on a computer (in the frame) the chat icon sits right after the title and the gear alone at the right end; never over the title. The box's place and size are the same in every mode; off takes
    it away (the box is hidden and the edge chips may use its space).
  - **A line**: "[9:41] Name: message" (this device's clock, 12-hour, no am/pm; the name bold: gold for a boss and mint for a kid,
    each deeper by day and as it was by night; **a player's in a palette color**, below), newest at the bottom, at most two lines
    then "…". The stream **starts at the box's top** and the
    typing line's strip is below it. The box holds **every line of the last 5 minutes** (`lifeMs`, the server's `TOWN_CHAT.lineMs`;
    **removed for good** that long after it was said) **and at most 100** (`keepLines`, `TOWN_CHAT.deviceMax`; the oldest first), the
    lines only you see too. Longer than the box, it **scrolls**: a finger on a phone, the wheel on a computer (the wheel over the box
    scrolls it and never zooms the map); a thin scrollbar shows where you are. **The stream itself takes the touches** (v4, the iPhone
    scroll fix: `pointer-events: auto`, `overflow-y: auto`, `-webkit-overflow-scrolling: touch`, `touch-action: pan-y`): iPhone Safari
    scrolls a scroll container only when that container is hit-testable, and the v2 stream was `pointer-events: none` with only its lines
    taking touches; Chromium and desktop scroll either way, which is why no test caught it. New lines keep it at its foot unless you've scrolled up (`Stick`); then it stays where you are and a small "↓ new"
    marker (a tap goes to the newest) says lines came. **Fading** (new messages only): `fadeAfterMs` (8 s) after the last
    message the lines fade out (`fadeMs`, 1 s; the faded box takes no taps and can't be tabbed to) and the next message brings them back
    (0.2 s). Always on has no fade path at all: the box shows by `chatShows(mode, shown)`, which reads the timer only in new messages.
  - **One way in**: `say(name, text, kind)` (kind: boss, kid, player, system), dropped when no town is open. **Who talks for
    now**: every `everyMs` (20 to 45 s, at random) one of the 14 bosses with a home, or its kid, says a line from `CHATTER`
    (placeholders until real players chat: two a boss, one or two a kid, under 60 characters; never the Hidden Boss;
    Hollow's kid only eerie; anyone but who spoke last). The kids' names are the sidekicks brief's, kept in `CHATTER` until
    the sidekicks are in `BOTS`.
  - **Your own line** (Oct 28, Eric): the typing line in the strip at the box's foot, **opened by a tap on the box** (above), just your words
    on nothing (no box, no bar under it, no shadow, no send button, no placeholder), **for a signed-in player on a device the age
    gate didn't mark too young** (`mayTownChat`). Everyone else sees it greyed with why (nothing hidden): "Sign in to chat with
    other players." for a guest, "Chat with other players is for accounts 13 and older." for a young device: at most `maxChars` (80) characters (a count, "7 left", only for the last `nearEnd` (10), shown whole), the keyboard's
    Send or Enter sends (`enterkeyhint="send"`, no button), one message per `sendEveryMs` (15 s; **no "Wait 12 s" in the field any
    more**: the line stays as it is and a try inside the 15 s gets a line only you see, below), 16 px type so iPhone Safari doesn't zoom. The numbers are the server's (`TOWN_CHAT`), which
    decides. **The keyboard** opening must not resize or move the town: while the line has focus the screen keeps its
    height and follows `visualViewport` (`pinTown`); a press on the map closes typing and lets the keyboard go.
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
  - **A line's menu**: a tap on a player's **name** (v4: the name only; a tap on their text opens typing like the rest of the box; `onTownChatLineTap`;
    lines said by the test hook have no one behind them and open nothing) opens a small card under the line (above it when it
    wouldn't fit): **Profile** (over the town, which stays as it was: Back closes it), **Mute** (by account, on this device, every
    chat), **Report** (fair play's report with "Offensive chat"; the server reads the line's words from its room; the answer shows
    in the card, which then closes), and for a moderator (`profile.admin`) **Remove** (the line leaves everyone's log). On your own
    line Mute and Report are greyed. A tap anywhere else or Escape closes it (a tap away from the menu only closes it; it doesn't also open
    typing); the box stays on show while it's open.
  - **Moving it**: press and hold on the box (`holdMs`, 400 ms; anywhere on it but the typing line), then drag it anywhere on the map and
    let go; it's remembered on this device (localStorage `brc.townChat`, in a try/catch; it starts in the corner, and a place remembered from
    before carries over) and kept inside the map and off the buttons (`clampBox`). While it is carried the browser's pan is called off with a
    `touchmove`'s `preventDefault`.
  - **Taps** (v4): **while the box shows it takes every touch on its own area** (Eric's design: the map under it doesn't get them): the
    stream scrolls by finger and wheel; a tap on a player's name opens its menu, anywhere else opens typing; a drag that starts without
    the hold is the stream's scroll (a mouse drag does nothing). **Faded** (new messages), it takes none and the map gets them. The
    listener sits on the map's box: a press outside the box closes typing (the map still gets that tap).
  - **The edge chips** keep off the box always in always on and new messages, shown or faded, wherever it's put: `CHAT_BOX`
    (chat.ts; `TownChat` writes it, `chipBlocked` in `render.ts` reads it), so a chip never jumps when the log appears or fades;
    with the chat off the box has no size and the chips may use its space.

- **You** (slice 5): your pawn wears your profile's crate items (`town/you-look.ts`: `Avatar` drawn once into a canvas,
  again only when your look changes; plain when signed out or wearing nothing). The pawn bots wear theirs too (Oct 27: one or two
  each, from `BOTS`; drawn the same way once as the page opens, never per frame; slice 5's "bots stay plain" is replaced). Every pawn's base stands
  on its square's middle, with a contact shadow under it that shrinks and fades as the hop lifts it. You have no ring
  under you (Oct 26, Eric: the ring and the shadow together "looks sloppy"); your gold name tag marks you, and your
  shadows are a bot's, sized from the pawn rather than the margin your items are drawn in.

- **Rides** (Oct 31, Eric: "a GIF of it running around town with a piece mounted to it… and then… an idle animation, the usual";
  docs/decisions/2026-10-31-rides.md; Nov 1, every boss's, with views and trails: docs/decisions/2026-11-01-rides-v2.md). A pawn
  wearing a ride (crates.ts's `ride` slot: sixteen, all admin-only for now; shop.md, "Rides")
  sits on it: yours, a bot's or a test player's as others see them (any `PawnLook` whose `wear` has a ride; real players later), the
  ride's **idle** standing and its **move** walking, **one cycle a step** (the art's frame times scaled to the step: 90 ms yours, 200 a
  bot's; the walk keeps its pace), lifted by the move's hop (the grasshopper's) instead of the hobble, its shadows shrinking with it;
  mirrored facing left as a pawn is. **Its view** (Nov 1, Eric: "a run up and a run down"): walking left or right its side, up the
  screen its back, down the screen its front (never mirrored); standing, the idle of the view it last walked in (`Walker.view`), for
  you and everyone else alike; a ride without views (Moon's Ride) keeps its side. From behind, the pawn's face items don't show (its
  hat does: the back view carries the pawn dressed without its face slot). **Its trail** (Nov 1; Eric: "Chirp's… definitely the way to
  go"): while you run on a ride with a `trail`, each square you leave gets its mark, on its own times and fade (`trail.ms`), pointing the
  way you went (the side's mirrored going left), at the ride's size, **in place of the droplets**; standing, none come; yours only, as
  the droplets are. No ride, or Moon's Ride: the droplets. **Its pace**: `RIDES.speed` in settings, one number a ride (Cheetah Shoes
  2): a step takes `youStepMs` (or a bot's `botStepMs`) over it. The pawn keeps its size (the ride is drawn at the pawn's scale) and its ride stands on the square's
  middle (its feet, the moon's shadow: `TOWN_FEEL.rides`). **Its name tag sits over the highest of the ride and the pawn standing** (a
  hat, the moon's stars) and doesn't jump with the hop, as a sidekick's doesn't; the card sits over it as over any tag; tags and the
  bubble are drawn after every figure, so a ride never covers one. Seated at a table, the pawn sits as before, without its ride.
  **Drawn as a pawn is: one picture a frame.** Nothing is fetched for a ride but its drawing (Nov 1: the baked WebP sheets, 2 MB for
  two rides, are gone; Nov 1, rides lazy: each ride's drawing is its own chunk, 1 to 7 KB gzip, loaded only when a ride is drawn, and your
  own worn ride's is asked for as the app starts, after its first paint: `components/rides/load.ts`,
  [2026-11-01-rides-lazy.md](../decisions/2026-11-01-rides-lazy.md)). A rider's frames are composed once from the ride's own drawing (`components/rides/draw.tsx`: each layer of each frame as SVG,
  made into an image, in the ride's colors at the rider's size, as `dressedPawn` makes your dressed pawn), with the pawn on its seat
  (its back, the pawn, its front), **one frame an animation frame** (`Rider` in `town/rides.ts`), every view, then its trail marks
(**yours all at once, before the town shows**, Nov 10: `readyYou` in Town.tsx, `Rider.hurry`; the town waits up to `TOWN_FEEL.youWaitMs`,
1 s, so its first frame has you on your ride: [2026-11-10-town-rider.md](../decisions/2026-11-10-town-rider.md)); each
  view's box comes from `town/ride-cells.ts` (measured ahead by `scripts/measure-rides.ts`, with each view's frames' seats, times and lift,
  the tile's box and the trail's numbers; a hash test keeps it fresh). Until that's done (its drawing loaded, then about 2 s on a phone)
  the person walks on foot, **in the box and under the tag the rider will have** (Nov 1, rides lazy: the renderer's `youSoon` and
  `ridersSoon`), so the ride appears in place and nothing moves. A picture (or the drawing's chunk) that fails is forgotten, so a later
  rider tries again. **Riders who
  look the same share one set of frames** (the ride, its colors, the pawn's side, tint and items, its size: `shareRider`), each set freed
  when no one rides on it and all of them when the town closes (`dropRiders`). A ride shows its colors (both, for a two-color ride),
  not its copy's blotches or its shine (the sets are shared by color). **Taps** take only the pawn's own box across (as on foot), not
  the ride's reach, so a tap on the square beside a rider walks there; a rider is drawn from 1.5 squares off the box's sides (a pawn
  from 1; more for a ride drawn bigger than 1), its ride reaching about 1.46 squares from its foot.
  **Each ride's size** (Nov 1, Eric: "scale down the riders with just a button so to speak… I wanna see it at 75%";
  docs/decisions/2026-11-01-ride-scale.md): every ride 0.75 (`RIDES.defaultScale` in core's settings, Nov 1, Eric: "0.75 is good";
  `RIDES.scale` for a ride that differs). The ride is drawn at that
  size about its saddle (its first idle frame's: `components/rides/scale.ts`) under a pawn of the usual size, which still sits in the
  saddle (each frame's seat moves with the scaled saddle; the same share of the pawn hidden in it) while the ride stands on the square,
  its hop and its shadow scaled too; worked out once as a rider's frames are composed, nothing per frame. The same everywhere a rider
  is drawn: the town (Canvas 2D and WebGL), the locker, the profiles, home's pawn and ring (`RideLayers`'s `k`; the boxes keep their
  size; the item's own tile keeps 1). **`?rideScale=K`** (0.5 to 1.25), a test switch (admins on the live site): every ride on that
  page at K, to try sizes; read once as the page opens (`test-switches.ts`).
  Test hook: `__townRide()` (yours: its ride, color and size, ready, the
  animation, frame and view the last frame drew, which way it faced, your box, foot and head on screen, your step's time, your trail's
  marks and droplets showing; every other rider's, with its step's time; and the sets of frames held); `__townAt("square", [c, r])` says where a square is on screen; `__townPlayer(…, wear)` dresses the
  test player (a ride too).
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
  - **Ten out at once, one goes home each minute and another walks out of its own home** (Oct 28, Eric: "they work on 1
    minute timer, 10 out at a time, randomly one each minute starts to head home, is replaced by another…";
    `docs/decisions/2026-10-28-bots-rotation.md`). `botsOut` (10) are in the world, shuffled by the town's seed as it opens
    (the same each time; back from a game, the bot you played among them); the rest are at home (`Person.home`: not drawn,
    not tapped, on no square: its walker leaves the town's `all`), queued in the order they got home (`homeQueue`). Every
    `botTurnMs` (60 s, a timer in the town's tick, `takeTurns`) one bot out is sent home (`sendHome`), picked at random
    among those still **due** this round and free (`canGoHome`: not seated, not held by its card or its table's, not on
    its way to or from a game with you, at least `botTurnAway` (5) steps from you, out at least `botOutAtLeastMs` (90 s));
    a busy one is passed over and stays due; none free, the minute is skipped. When no bot out is due, a new round starts
    with every bot out: none goes twice before all the others have gone once. **Going home** it walks the town's way round
    (`routeAround`: round the squares others stand on) to its **door** (`homeDoor`: a sidekick's is its boss's home's,
    the plot's front row by its middle, `doorway` taking the square beside it when the boss stands in front; a pawn has no
    house, so the Colosseum's gate, the apron's free square nearest it) and fades out there over `botFadeMs` (`arrive`);
    then it's home (`reachHome`) and **the bot home longest** (first in, first out, never the one that just got home)
    fades in at its own door and walks to a free spot in the square (`walkOut`). So ten are in the world all along, near
    the square or on their way. A bot walking home or out can be tapped like any other: its card holds it, and it carries
    on when the card closes; Play keeps it out (`meet` → `stayOut`). **The bots out stay in the square** (`inSquare`: the
    park, the walk and the Colosseum's apron, off the bosses' roaming ground): they wander only there, and one that finds
    itself elsewhere walks back. (Before: six out, a turn every 10 to 20 s, fading out and in where they stood.)
  - **A sidekick in the square** (Oct 28): its own animations, `idle` standing, `walk` walking (no hop: its walk steps),
    `sit` on a table's stool (its sit has its own little stool, drawn over the table's, facing the board; no shadow, not
    lowered like a pawn), and `wave` once when you tap it, then `idle` while its card is open (`spriteAnim` in `world.ts`;
    sitting wins: it never waves off its stool). Mirrored when it walks or sits facing our left, as pawns are. As tall as a
    bot's pawn from its idle's top to its feet (`sidekickSquares`, 0.87), its feet where a pawn's base stands; its name
    tag over its head, as a pawn's. **Its frames are baked** (`scripts/bake-sidekicks.ts`, run after changing a sidekick's
    art): one PNG a sidekick (`town/sidekicks/<boss>.png`: rows idle, walk, sit, wave) and their times, feet and heads in
    `town/sidekick-sheets.ts`; the town loads the fourteen pictures as it opens and cuts a sheet's frames into canvases once,
    when its sidekick is first drawn (`SpriteFrames.cut` in `render.ts`; Nov 10, phone load), never per frame; a sidekick isn't
    drawn (or tapped) until its picture has loaded (a moment). No art code runs in the town: the sprites' own code paints for about 3 s as it loads, which would hold the
    town's first frame back (measured: the decision).
  - **A person's card** (a tap on a bot, or on a real player once they walk in the town: `Card` kind `"person"`; placed over its
    name tag like a boss's, as before; the bot holds still while it's open, `hold`). **One row, one size, 210 × 53 px on a phone and
    a computer alike** (Eric's mockup, Oct 28, about 189 × 53; Oct 29, Eric: near the mockup's size, a long name shrinking its own
    words rather than the card growing; `.town-person` in `town.css`), whoever it is: the picture, the words, Play.
    - **The picture** (a 38 px round, a 3 px ring, `.town-pic`): a sidekick's face (`spriteFace`, its idle's first frame) in a
      **blue** ring (`#4575fa`: lighter than the sidekicks' name tags' `#1d4ed8`, because the ring needs 3:1 on the dark card and the tag needs white text on it at 4.5:1); a pawn's own picture, as it stands in the square (its crate
      items on, cut to what's drawn, `pawnFace` in `Town.tsx`), in an **ivory** ring (`#eadfc6`, the white of a pawn's tag); a
      real player's profile icon (`UserIcon`), also ivory. Made once as the card opens (`faceOf`), never in the frame loop. **A bot's
      picture is no button** (a plain box: no button cursor, no focus, a tap does nothing); **a real player's is a button**,
      "View <name>'s profile", opening their profile as a tap on a name does elsewhere (`openProfile({ uid })`, over the town; Back
      and the town is as it was).
    - **The words**: "<name>" bold white with " (bot)" gray after a bot's; for a sidekick **"<Boss>'s sidekick"** under it
      (`sidekickText`: "Hollow's sidekick", "Puddles' sidekick"); "Rating 1400" with a small gold bars icon. Every row is always there, so nothing moves or resizes the card: a pawn's
      line row is empty. **A name or line too long for its row shrinks its own words** (`fitRows` in `Town.tsx`, as the card opens
      and again when the web font is in; never per frame): the name from 13 px to at least 10, the line from 9.5 px to at least
      7.5, the row's height the same. At 210 px, two names (Tempo Tess, Gambit Gus: about 12 px) and two lines ("Chub & Chirp's
      sidekick", "Moo & Moon's sidekick": about 9 px) shrink; an e2e check measures every bot in the card's fonts. A longer real
      player's name would end in an ellipsis at 10 px (their profile shows it whole).
    - **Play**, gold, on the right, with a plain crossed-swords icon (inline SVG in the button's text color, `aria-hidden`; the
      button's name is still "Play") to its left, no triangle. The drawn button is 53 × 26 px, one width whether it reads "Play" or "Full", with a
      44 px-high tap area.
      You both walk to the nearest table with both stools free (nearest to the two of you, `tableFor`), you to the stool nearer
      you, the bot to the other (`meet`); once both sit (`meetReady`) the game opens. Any other walk of yours calls it off. No
      table free: Play greyed, not tappable and reading **"Full"** (its name "Play: tables are full"; `anyTableFree`, checked only
      while the card is open). (Oct 28 it was "Play · Tables are full" in the button, then a fourth row "Tables are full", dropped
      Oct 29 with the card's size.)
    - **A real player's card** is the same row: no "(bot)", "Coming soon" in the line's row (challenging a player isn't built), their
      rating, Play greyed. Only the e2e test player has one (`addTestPlayer`, the `__townPlayer` hook): `Person.uid`
      (their account id), `icon` and `rating`; real players (below, "Away") get it too, with no rating row.
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

## Inside a shop (Nov 2, round 1)

**Frame rate inside (Nov 11):** the room keeps its back (ceiling, what's past the walls, the floor and the one-frame plans that come first) as one picture while the camera rests (`drawBack`, `__shopStill()`): the floor is laid every frame as some hundreds of clipped, stretched triangles, the costliest drawing of a room's frame (headless, CPU slowed 4x: 20 fps with it, 60 without). The second frame the view is the same (camX, camY, the zoom, the claw's close-in, the canvas size) the back is copied as drawn; while it stays, one copy draws it. The camera's follow spring now settles exactly (within 1e-4 of a square) so a resting view stays the same. A moving view draws as before (walking in a room is still about the floor's cost: the next step if it matters). [2026-11-11-town-room-perf.md](../decisions/2026-11-11-town-room-perf.md). **Walking (Nov 11):** the back is drawn by WebGL (`shops/back-gl.ts`): the ceiling's picture, a cave's rock, the day outside and the floor (its picture with the still plans, uploaded once; each frame one mesh, two triangles a square, through the room's `P`) into one opaque picture, copied onto the canvas in one `drawImage` where the back was, so the pools, figures and darks blend with it as before. No WebGL or a lost context: the 2D way (`drawBack2d`). `?back=2d` (anyone's) draws it the 2D way, to compare with `?report` on a phone. Hooks: `__shopStill()` adds `gl`, `backTris` (2D floor triangles in the last back: 0 with WebGL) and `glTris`; `__shopBackDiff()` draws the back both ways and compares; `__shopBench(n, true)` times a draw with the view moving. Scripts: `scripts/perf-room.mjs`, `scripts/stills-room.mjs`. Headless can't show its speed (no GPU: WebGL is software there). [2026-11-11-room-smooth.md](../decisions/2026-11-11-room-smooth.md). **Going in (Nov 11, Eric: "just make it take an extra second"):** while the town zooms on the door the room's pictures are painted at most `SHOP_FEEL.loadSliceMs` (4 ms) a frame (`shops/load-slice.ts`), the rest once it's black; the black lifts once the room has drawn `warmFrames` (3) frames, `warmMaxMs` (1 s) at the most, so their first-time costs are under it. Measure with `scripts/door-room.mjs`.

Eric, Nov 2: walk up to Babur's home and go in; inside, the Shopkeeper sells **Babur's Boss Crate**. Round 1 was the town side, with
buying stubbed behind one function; round 2 (Nov 2) put the stored data behind it: boss tokens, crate keys and the purchase
([shop.md](shop.md), "Boss tokens"; [2026-11-02-boss-tokens.md](../decisions/2026-11-02-boss-tokens.md)). Inside, the page's header says
the shop's name (the home's: **"Babur's Circus"**, **"Puddles' Botanical Garden"**), not "Town square" (on a computer's narrow header
column, on up to two smaller lines in the bar's same height, the full name as its tooltip). Decisions:
[2026-11-02-shop-interiors-r1.md](../decisions/2026-11-02-shop-interiors-r1.md) (this round's calls),
[2026-11-02-building-interiors.md](../decisions/2026-11-02-building-interiors.md), [2026-11-02-shop-zoom.md](../decisions/2026-11-02-shop-zoom.md)
and [2026-11-02-bigger-showpieces.md](../decisions/2026-11-02-bigger-showpieces.md) (the art's, on `claude/boss-art`).

- **Timber's Lumber Lodge and Rivet (Nov 3): an admin's town only.** Timber is in the game for admins first (core's
  `BOSS_ADMIN_FIRST`: only on an admin's boss select), so his home, his roaming, his chatter and his kid are too: `ALL_HOMES` has the
  fifteen, `HOMES` this town's (`town/admin-town.ts` `ADMIN_TOWN`: your profile's `admin`, read once as the town's code loads;
  `TownPage` waits for your account first, up to 3 s). In a player's town its plot is open ground. The lodge stands at (11, 32),
  west of the Colosseum: the one open ground left, between Boingo's Funhouse (7.8 squares, south-west) and Moo & Moon Meadow (8.5,
  north-west), 4 open squares to the Colosseum's wall (a square more than Folio's first place, which Eric moved), its door facing the
  park. Its art (`houses/timber.ts`) is the art branch's, 144 × 134. **Rivet**, Timber's woodpecker foreman (`ADMIN_BOTS`), walks
  with the bots there (`TOWN_BOTS`: the ladder's twenty, then Rivet, so a seat means the same bot in anyone's town), rated 1650
  (Timber's sim puts him between Moo & Moon and Puddles), "Timber's sidekick"; his sheet is baked as the others' are. The Colosseum's
  crowd stays the ladder's. His crate (`BOSS_CRATES`) shows in the Crates tab to admins (or whoever holds one), not in the FAQ; the
  server posts no town-chat line for a challenge of a boss in the game for admins first. Taking `timber` out of `BOSS_ADMIN_FIRST`
  puts all of it in everyone's town. docs/decisions/2026-11-03-timber-home.md.
- **Dash's Kicks and Tick (Nov 3): an admin's town only,** exactly as Timber's lodge and Rivet (Dash is in `BOSS_ADMIN_FIRST` too).
  His sneaker store (`houses/blitz.ts`, the art branch's `house-blitz`, 144 × 134: charcoal brick, a neon sneaker on the roof, the
  hanging pair on a wire to a pole on its own plot's east column) stands at (4, 34), beside the lodge in the west: the best of the
  little open ground left (7.1 to 7.6 squares from Boingo's, Moo & Moon's, the lodge and Big Boy's; the map's 8 to 10 fits nowhere
  now), its roaming ground on plain board, four open columns to the lodge. **Tick**, his sleepy tortoise (`ADMIN_BOTS`, after Rivet),
  rated 1850 (Dash's sim, 0.15, ties Sawyer's under Puddles': between Bishop Bo and Chip), "Dash's sidekick". His crate as Timber's
  (admins, or whoever holds one; not in the FAQ); no town-chat line for his challenge. Taking `dash` out of `BOSS_ADMIN_FIRST` puts
  it all in everyone's town. docs/decisions/2026-11-03-dash-home.md.
- **Hollow's cave (Nov 3): the first room that isn't a box.** Hollow is live, so his cave is in everyone's town. Its art
  (`shops/hollow-art.ts`, the art branch's `house-shop-hollow` at a53eba78) is a hook-shaped cave: in at the snowy mouth (row 19),
  up a passage past the frozen pond (the battle spot), round a bend west at the back to the counter in its own hollow. **Its floor's
  shape** (`SHOP_HOLLOW_FLOOR`, `.` floor, `#` rock; `RoomArt.floor`): `makeRoom`'s `mask` blocks every `#` square too (`Room.floor`;
  a box room's is null and nothing changes for it), so walking, taps and paths keep to the floor; the rock pieces stand where the
  art's `rockPiece` puts them. **The camera:** a drag's focus stays over the floor (`camFocus`: never into the rock or past the edge);
  past the 20 × 20 squares the rock goes on (one fill in the flat rock tile's own tone, under the horizon), and past the mouth the
  snowy night (`CAVE_SNOW`) where a box room has the bright day; a piece nearer the camera than you and drawn over you is see-through
  (`SHOP_FEEL.seeThrough`, 0.35: the passage's walls south of you, the mouth's arch as you come in; any room with a floor's shape,
  only its `seeThru` pieces where it lists them: Rolling Dough's doors and near walls, never its table, Nov 11). Its roof: dark stone
  and stalactites (`roof: "cave"`, the mockup's). **The Shopkeeper:** Hollow's dog (`characters/sidekicks/hollowdog.ts`, baked as
  the others; not a town bot: Glim stays Hollow's kid in the town) on (5, 2) and (6, 2) behind the 30 px counter, drawn at (5.5, 2.4);
  "Shopkeeper", no name; his tag drawn with him, so nearer rock covers it. "Hollow's Boss Crate" with Hollow's Bulb; the chat's
  night tone. His home's card keeps his line (the next each time) over "Go in". The tree of presents, 3 × 2, stands up whole
  (`RoomArt.upright`). docs/decisions/2026-11-03-hollow-shop.md.
- **Lights at every placement (Nov 3, every shop).** A light (`*_LIGHTS`, `*_POOLS`, named by its piece) shines on every place its
  piece stands (`lightsAt`, made once as the room loads: Hollow's five lanterns, Alfil's two braziers, Dash's shelves and windows),
  mirrored with a mirrored piece (`litDx`), moved with the crate on its counter, and fading with its piece near the camera. Until then
  only one place per piece name lit.
- **Wrangler's barn (Nov 4).** Wrangler is live, so his barn is in everyone's town. Its art (`shops/pig-art.ts`, the art branch's
  `house-shop-pig` at 0e4c00c6) is a box room: plank walls under a red top beam, straw on a plank floor, hay, saddles, troughs, four
  lanterns (lit at every placement), two pens of chess knights hopping in L's (3 × 2 squares each, standing up whole, `RoomArt.upright`;
  Eric, Nov 4: two white and two black in each pen), HunChess buckets standing about (`shops/hunchess-bucket.ts`, shared with Puddles'
  shop and the intro: since Eric's Nov 4 correction always seen from the side, no open mouth anywhere), the board on its hay bale at
  (4, 3) (`SHOP_PIG_BOARD_AT`, `RoomArt.stand`: a room piece until his intro's yank takes it), the battle spot a straw bed in a ring of
  rope, his red mat and your denim one its drawn marks (`SHOP_PIG_MARKS`). Its roof: dark rafters and two cross beams (`roof: "barn"`,
  the mockup's); the chat's day tone. **The Shopkeeper:** his rooster (`characters/sidekicks/rooster.ts`, baked as the others; not a
  town bot: the piglet stays Wrangler's kid) stands ON the counter (Eric's pick): `ShopDef.lift`, 27 of the room's pixels, raises a
  Shopkeeper (his feet, his shadows, his tag and card) onto the counter's plank top, his place its middle on the counter's own row,
  drawn just after the counter; every other shop has no lift and is as it was. "Shopkeeper", no name, Talk. "Wrangler's Boss Crate"
  with Pen Pony. His home's card: its name and "Go in" (it has no line). docs/decisions/2026-11-04-wrangler-home.md.
- **Jefferson's warehouse (Nov 4).** Jefferson is live, so his warehouse is in everyone's town. Its art (`shops/grex-art.ts`, the art
  branch's `house-shop-grex` at 0e4f6482, with its shared `shops/warehouse-kit.ts`) is a shady firework warehouse with a floor's shape
  as Hollow's cave (`SHOP_GREX_FLOOR`: 16 × 16, columns 2-17, rows 3-18, racking all round, blocked) but no rock (`cave` stays null: it's
  a box room otherwise; its tall roll-up door goes see-through over you as a cave's rock does). Blue and orange pallet racking loaded with
  made-up firework cartons, grey concrete with yellow lines, four high-bay lamps (lit at every placement), a NO SMOKING sign; the battle
  spot a hazard-striped zone, his red plate and your lift's steel plate its marks (`SHOP_GREX_MARKS`), the board already standing on a
  wobbly stack of crates at (9-10, 10), its foot 19 px south on the marks' line (`RoomArt.standDy`). Its roof: dark steel trusses
  (`roof: "warehouse"`); outside the door the night lot (dark asphalt); the chat's day tone. **The Shopkeeper:** "literally just a guy in
  the corner" (Eric): the shady dealer giraffe (`characters/sidekicks/dealer.ts`, baked as the others; not a town bot: Sparky stays
  Jefferson's kid) in the north-east corner by the taped SHOP sign, on (16, 3) and (17, 3), facing west (`ShopDef.flip`), drawn at his
  art's size (`ShopDef.tall`, 79 of the room's pixels, not the kids' `sidekickSquares`). No counter: a tap on his Boss Crate (on the floor
  at (15, 3)) or the bare corner behind him means talk too (`ShopDef.talk`, `makeRoom`'s `talk`). "Jefferson's Boss Crate" with Giraffe
  Gallop. **The crew** (`shops/grex-crew.ts`, drawn from baked sheets: `scripts/bake-grex-crew.ts` → `shops/grex-crew/*.png` and
  `grex-crew-sheets.ts`, a test checks each sheet's hash against the art): two sparkler leaners under the NO SMOKING sign, the clipboard
  guy at his pallet and the dozer asleep on his, standing where the art puts them (nobody walks through them); the scissor lift
  shuttling along row 5 and the forklift working the south-east corner on two laps (floor pallet up onto the shelf slot, then back down),
  a square every `SHOP_FEEL.crew.stepMs`. Before each square a machine looks at it and the one after it: anyone standing there (you, or
  a boss walking in) and it waits, going on once they're clear (Eric, Nov 4: "If you block it, it stops. If you move out of the way, it
  starts moving again"). The machines and the floor pallet block your walking where they are: a tap finds a way round them; one stepping
  into your way stops you where you are. Each client runs them from its own room's clock (no server state). Test hook `__shopCrew()`.
  docs/decisions/2026-11-04-jefferson-home.md.
- **Ginger's igloo (Nov 5).** Ginger is live, so his igloo is in everyone's town. Its art (`shops/ginger-art.ts`, the art branch's
  `house-shop-ginger` at 6ef02ce9, with its `shops/candy-kit.ts`, which imports `warehouse-kit.ts`) is a candy shop inside his igloo
  run by little gnome-ish elves: a round floor 10 squares across round (9.5, 9.5) (`SHOP_GINGER_FLOOR`, a floor's shape as Hollow's,
  not a cave), the entry tunnel and the stairs' feet; the walls one curve of overlapping 45 px cards (no gaps), the candy wall of gravity
  bins and tall tubes round the back and both sides, ice lanterns, barrels of candy canes and loose candy; the battle spot glossy ice with
  his peppermint and your snowflake as its marks (`SHOP_GINGER_MARKS`). Its roof: the dome's ice blocks arching overhead (`roof: "igloo"`);
  outside the doorway the snowy night; the chat's day tone. Its pools of light and the battle spot's cool shine are baked into the
  floor's picture (they never change: no glows a frame). **The Shopkeeper:** the elf in a Santa hat (`characters/sidekicks/elf.ts`,
  baked as the others; not a town bot: Crumb stays Ginger's kid) behind his half-round stand at the back middle, under the CANDY sign,
  on (9, 5) and (10, 5), drawn at his art's size (`ShopDef.tall` 25). "Ginger's Boss Crate" with the Candy Cane Sled.
  **The second level** (`shops/levels.ts`, the first shop with one): a catwalk 40 px up along the back curve ((7, 5), (8, 4) to (11, 4),
  (12, 5); the steps round the curve diagonal), and a straight flight of stairs at each end on its own row (west (5, 5) low, (6, 5) high,
  its foot (5, 6); east mirrored, (14, 5), (13, 5), foot (14, 6)). Those squares are walkable only along their chain (`Room.levels`,
  `around`): from the floor only from a foot, never off the deck's front edge. Your figure (and every elf) is lifted by one height curve,
  `liftAt`: the steps' heights from the art (each quarter of a square a 5 px step) joined in straight lines between the steps' middles,
  easing up off the floor over the half square in front of the low step; drawn half a square nearer up there (`levelZ`), in front of the
  cards it stands on. A tap on the deck as drawn walks you there (the nearer free staircase); the arrow keys go along the chain (left and
  right along the flight and round the curve, up from a foot climbs on, up and down on the deck nothing). Inside every room, the up arrow
  now walks you up the screen (rows run toward a room's camera: it walked you down; since Nov 5 held by `Walker.rowsUp`, see "Arrow keys"). **The elves** (`shops/ginger-elves.ts`, drawn from
  their sprites as the room loads, about a hundred small frames): three walkers on their loops round the battle spot, and the dispensing
  pair (box and notepad) on their 47.5 s loop: the lower row's bins, up the east stairs, the upper row's tubes along the catwalk, down
  the west stairs. Each waits while you (or the boss walking in) stand on or just ahead of its way (`SHOP_FEEL.elves.look`), and takes its
  square (and, walking, the one just ahead): a tap walks you round them (up the other staircase if one is on the nearer); one in your way
  as you walk and you wait, then go on or round; an elf waiting for you while you wait for it and you give way. No server state. Test
  hook `__shopElves()` (with your figure's lift frame by frame). docs/decisions/2026-11-05-ginger-home.md.
- **Folio's sanctuary (Nov 5).** Folio is live, so its Folded House has an inside in everyone's town. Its art (`shops/folio-art.ts`, the
  art branch's `house-shop-folio` at e7e08bcf, with its `shops/paper-kit.ts`, which the turtle and the intro's props share): a box room
  that is a page still being written, folded and colored in the middle and thinning to ink sketch and ruled blank paper toward the
  edges and the back, a margin line down its west side, "being written" lines on the lanterns and the back wall (their idle loops). Its
  battle spot is the clean page (36 flat `page-<col>-<row>` tiles, columns 7-12, rows 8-13: `isFloor` takes `page-`, never the drifting
  `pages`, and `marksOf` takes them as its circle), its marks `SHOP_FOLIO_MARKS`. Its roof: pale folded paper, pleats running up to a fold
  (`roof: "paper"`). Its stained-glass windows light in each pane's color at every placement, and their pools lie on the paper as
  color (`RoomArt.poolBlend` "multiply", a tint sprite fading to its own color) and drift on one slow sine (`PoolDrift`, `driftAt` in
  `room.ts`: 9 and 4 px either way over 40 s). Its Shopkeeper, the paper turtle (`characters/sidekicks/folioturtle.ts`, baked as the
  others; not a town bot: Pleat, the frog, stays Folio's kid), behind the low (19 px) counter on (9, 2) and (10, 2), drawn at (9.5, 2.4).
  "Folio's Boss Crate" with the Paper Crane. The chat's day tone. docs/decisions/2026-11-05-folio-home.md.
- **Smudgy's studio (Nov 6).** Smudgy is live, so his Art Gallery has an inside in everyone's town. Its art (`shops/smudgy-art.ts`, drawn
  by hand in code with `shops/paint-kit.ts`; a copy on `claude/boss-art` under `scripts/boss-art/out/house-shop-smudgy`): a box room, a
  paint studio in a moody, deep palette (dark teal, deep blue, oxblood, plum, a few warm highlights), dark plank floors with drips and drop
  cloths, every wall hung with layered abstract canvases, easels, paint pots and brush jars, the Colosseum's pixel pieces
  (`colosseum/pieces-gba.ts`'s models) as sculptures on plinths. **The life class**: the Colosseum's knight turning on a round platform
  (16 frames, 6 s a turn) at (9.5, 8), eight art-student chameleons (Dabble's rig in smocks, four colors) on stools round it at easels,
  one 32-frame loop (8 s: the canvas blank, outline, blocked colors, finished; a brush dip each stage) shared by all, each painter
  `ShopPlace.t0` into it (an eighth apart; ShopRoom draws a piece's frame at `now + t0`). Its battle spot is a drop cloth (24 flat
  `circle-<col>-<row>` tiles, columns 6-13, rows 13-15), its marks `SHOP_SMUDGY_MARKS` (7, 14) and (12, 14), the round table under its
  white cloth (`table`, solid) between them with its stools. Its roof: dark beams over a skylight (`roof: "studio"`). Gallery picture lights (Eric: "lighting that comes down on the walls like in an art gallery"): a brass lamp atop every wall panel, its warm cone baked into the panel and lit at every placement (`SHOP_SMUDGY_LIGHTS`, `SHOP_SMUDGY_POOLS` on the wall). Its Shopkeeper, the
  gallery owner (`characters/sidekicks/smudgykeeper.ts`: Dabble's rig, gray-green, an oxblood smock and gold half-moon glasses; baked;
  not a town bot: Dabble stays Smudgy's kid), behind the counter on (9, 2) and (10, 2). "Smudgy's Boss Crate" with the Brush Ride. The
  chat's night tone. docs/decisions/2026-11-06-smudgy-home.md.
- **Boingo's Funhouse (Nov 6).** Everyone's town. A 24 x 24 arcade (`shops/boingo-art.ts`, `RoomArt.n`) in `CLOWN_PALETTE` under an arcade ceiling of bulbs (`roof: "arcade"`): a 3-level net climb with a spiral slide and a ball pit, the spinning light game, roll-ball lanes, the squirt race (5 clown players, knights racing on a loop), the
  prize counter (the clown attendant `characters/sidekicks/funkeeper.ts`, "Shopkeeper"; "Boingo's Boss Crate" with Boingo's Pogo) and the pogo under a spotlight with its price sign (`pogoSign()`, the crate's price). **The claw machine** (19, 7): the kit model `town/kit/models/claw-cabinet.ts` placed by `shops/claw-cabinet.ts`, its claw posed
  from the play (`claw/view.ts`); walking up glides the camera in (`SHOP_FEEL.claw`), its coin slot opens `openClawMachine()`. His challenge: the default intro on his carnival mat. docs/decisions/2026-11-06-boingo-home.md.
- **Rolling Dough (Nov 11), an admin's town only** (`zebra` in `BOSS_ADMIN_FIRST`; no town boss: `hasTownBoss`). **Out front, a stand-in**
  (`STAND_IN` in `world.ts`: the "Bakery guard", the flat-cap guard's drawing, on the home's rest square, never roaming or talking on his
  own; in today's town beside its door): his card is his name, a line row kept two lines high and **Talk** ("the boss is inside", one of
  `ZEBRA_OUTSIDE_LINES` at random). Front room (`shops/zebra-art.ts`): a tapped guard and the counter zebra's Talk say he's in the back
  (`ZEBRA_BACK_LINES`, at random, in a bubble); the guards' `watch` follows you. **The door between rooms** (`ShopPlace.door`,
  `Room.pass`; "Go in" / "Go out front"; Town.tsx `goThrough`) leads to the dim back room (`BACK_ROOMS`, its own fixed camera): the chatter,
  Don's card: **Challenge** alone (Nov 11, docs/decisions/2026-11-11-bakery-challenge.md). It plays his beat (the crew stand, draw and
  aim at you, each turned to your side, his roll at your angle, `aimAt`, following you as you move), then the walk-out (`WalkOut`: four
  goons pick up the set kept before his table, `ZEBRA_BACK_SET`, and carry it out, Don and you following; no taps), then
  fades to the front room's pad (`SHOP_ZEBRA_PAD`), the goons carry the set-up in from behind the door (`SetupScene`), five watch, `intros/zebra.ts` plays: his line, his `breadPop`, Beanie's line over him (`crewLine`), his bread splash as the wipe (`zebra-intro-art.ts`, sounds `zebraWhoosh`, `zebraTumble`). Hook `__shopZebra()`; tests `shop-zebra.test.ts`, `e2e/zebra-home.spec.ts`; docs/decisions/2026-11-11-zebra-home.md.
  Its floor tiles' names start `floor-` (`floor-back-*`, `floor-rug-*`, `floor-mat-*`: room.ts `isFloor`), so they're baked into the
  floor; a tile named otherwise stands up as a piece every frame (Nov 11: the back room's 196, ghosted as you walked behind them).
- **Which homes.** Babur's Circus (`tiger`), Puddles' Botanical Garden (`gardener`) and Alfil's Pyramid (`alfil`, Nov 2: Woolly the Shopkeeper, "Alfil's Boss Crate" with Alfil's Howdah, a sandstone ceiling, the chat's day tone) and Big Boy's Crib (`bigboy`, Nov 2: Blocky the Shopkeeper, "Big Boy's Boss Crate" with Big Boy's Buggy, a nursery ceiling of sky, clouds and stars, the chat's day tone; a ball pit, solid, under a walkway, the shop's platform and the battle circle you walk on, the circle in the walkway's foam squares with a zoo-animal rug in its middle; his toy airplane, three squares deep, stands up whole at its foot, `RoomArt.upright`, rather than lying flat as a plan) and Timber's Lumber Lodge (`timber`, Nov 3, an admin's town only: Rivet the Shopkeeper behind the middle of the workbench, "Timber's Boss Crate" with The Log Roller, a lodge's ceiling of dark planks between heavy beams, the chat's day tone; the giant king being carved on its dais, 4 × 2 squares, stands up whole, `RoomArt.upright`; the circle's branded start marks, `SHOP_TIMBER_MARKS`, passed as Big Boy's are; his challenge his own intro since Nov 3, the log he gnaws into the table, his line "Hard hats on. We're building today.")) and Dash's Kicks (`dash`, Nov 3, an admin's town only: Tick the Shopkeeper on the counter's middle squares, drawn half a square back and west (`at` [9, 1.5]) so the low tortoise's head shows over the 30 px counter, clear of its shoe boxes; "Dash's Boss Crate" with Cheetah Shoes; a store's ceiling of white tiles and light panels; the chat's day tone; the halfpipe, 4 × 2 squares, stands up whole, `RoomArt.upright`; his try-on mats, `SHOP_BLITZ_MARKS`, passed as Timber's are) and Hollow Peak (`hollow`, Nov 3, everyone's town: below, "Hollow's cave") and Wrangler's Stall (`pig`, Nov 4, everyone's town: above, "Wrangler's barn") and Jefferson's Fireworks (`grex`, Nov 4, everyone's town: above, "Jefferson's warehouse") and Ginger Igloo (`gingerbread`, Nov 5, everyone's town: above, "Ginger's igloo") and Folio's Folded House (`folio`, Nov 5, everyone's town: above, "Folio's sanctuary") and Boingo's Funhouse (`clown`, Nov 6, everyone's town: above): `SHOPS` in `town/shops/shops.ts`. Their home's card
  is its name, centered, and **"Go in"** (gold) under it, centered, nothing else (Eric, Nov 2: "chop the Shop and Coming soon": a short
  card, `.town-card.town-door`); every other home's card is as it was (its name, Hollow's line, "Shop" greyed and "Coming soon").
- **Going in.** "Go in" walks you to the square in front of the door (the plot's front row's middle, a row out); there the town zooms in on
  the door (a CSS scale of the town's canvas about the door, `SHOP_FEEL.doorZoom` over `doorZoomMs`) and fades to black (`.town-fade`,
  `fadeMs`), the room's code and art load (only now: `shops/ShopRoom.tsx` and each room's art are chunks of their own), the town waits
  (`pause`: no frames, nothing moves, its chips put away) and the room fades in from black. **Going out** ("Go out", or the back button,
  which inside a shop means out, not home): the room fades to black and the town zooms back out from the door, you where you stood.
  A Back or Go out tapped while the room still fades in waits for it, then goes out (`outNext`, Nov 12: it was lost).
  **The area banner (Nov 11, Eric's mockup):** as the black lifts on a room you walked into through its door (the town's, or Rolling
  Dough's door between rooms; never one you arrive in by a challenge), its name across a soft dark band a third down the room's view:
  the boss's name and 's in gold in the pixel font ("DON DOUGH'S"; Rolling Dough's back room "BACK ROOM"; a room with no boss nothing),
  gold rules above and below, the home's name in Archivo Black (`town/AreaBanner.tsx`, `areaBannerOf`, from the homes' and rooms'
  data). Fades in 0.4 s, holds 1.8 s, fades out 0.6 s (`AREA_BANNER`; reduced motion: no fades); taps pass through it; sized from
  the room's view (container units). **Room music:** the boss's theme loads as the door zooms and plays as the room shows; a
  challenge's starts as its splash starts, the splash held up to 2 s for it (`stormIn`; docs/areas/bosses.md "Music"). Tests: `e2e/zebra-home.spec.ts` (the banner's words, place, taps through it, gone by 4 s; none
  arriving by the challenge), `packages/app/test/music.test.ts` ("a boss's room").
  docs/decisions/2026-11-11-area-banner-room-music.md.
- **The room** (`shops/ShopRoom.tsx`): 20 × 20 squares from the art's layout (`shops/babur-art.ts`, `shops/puddles-art.ts`, copied from
  `claude/boss-art`), drawn as the approved mockup (`scripts/boss-art/shop-view.ts` there) drew it, through `camera.ts` (`setView`'s
  `sets`: the room's own camera sets): the floor tiles baked once into one picture and laid flat in blocks of two squares (a block drawn
  large near the camera a square at a time: `floorBlock`, `floorSplitPx`), each upright piece stood at its foot at 37 px a square, Puddles'
  pond garden (`d: 8`) laid flat on its 40 squares with the strip above its north row (its plants' tops) standing up, the Shopkeeper and
  you among them far to near; the tent's canvas or the greenhouse's glass above the walls, and the bright day past the low front wall.
  Babur's three burning hoops glow (their pools and halos, the art's `piece`-keyed lights, `SHOP_FEEL.glow`). Every piece's frames are
  drawn into canvases as the room loads, behind the black; animated pieces loop on one clock (the hoops, the pond, the palm, the fountain,
  the crate, the balloon cart). A piece nearer the camera than `nearFull` squares fades out (gone by `nearGone`): the front wall as you
  stand at the door. One loop on one Canvas 2D canvas; headless, 60 fps walking on a phone and a computer (Nov 2).
- **The camera.** You start at **the town's zoomed-in camera** (`SHOP_FEEL.startZoom` 1, the − pressed; Eric, Nov 3: "the further out of
  the two by default"; it was Close until then: docs/decisions/2026-11-03-home-zoom-out.md). + goes to **Close** (`SHOP_FEEL.close`: h 3.2,
  back 2.4, pitch 24°, cy 0.3, in place of the town's numbers of those names; the box's shape blends the rest as in the town). The town's
  − / + switch between the two (the wheel
  too); a drag looks around (kept inside the room) exactly as the town's does, the floor following the finger both ways (Eric, Nov 2: "when I
  drag from down to up, it should be the same as the town movement"; the room's rows run toward the camera where the town's run away, so
  its camY goes the other way); the focus button brings it back.
- **Walking** (`shops/room.ts`, pure): a tap walks you a square at a time round what's solid (the walls, the counter, every solid piece's
  squares, the way out's own squares, the Shopkeeper's); a tap on something solid walks you beside it. A tap is the town's press
  (`town/press.ts`; Nov 5, `shops/tap.ts`): what's under the finger is picked at the press and again at the release, and it walks you
  only if both are the same (the camera trails your walk, so a release alone could pick the square beside the one you pressed;
  [2026-11-05-ginger-steps.md](../decisions/2026-11-05-ginger-steps.md)). There's no joystick (the town has none either). Inside is just you: the town's bots and other players don't come in.
- **On a ride** (Eric, Nov 2: "your rider goes in with you"; `SHOP_FEEL.rideInside`, true): your ride comes in under you, the town's own
  rider (its frames as `town/rides.ts` composed them, the ride at its scale, 0.75 of the pawn), at the room's camera; its idle standing,
  its move a cycle a step, its side, back (up the room) or front (down it) the way you go, at its pace (`RIDES.speed`). You come out still
  on it. false: it waits outside and you walk in on foot, as round 1 had it. No ride: on foot.
- **The Shopkeeper**: the boss's kid's sheet (Stripes for Babur, beside the counter's east end: behind it the 58 px counter hides him;
  Drizzle for Puddles, behind the middle of the low counter), its idle playing, a blue "Shopkeeper" tag. Standing still within
  `talkRange` (3) squares of it, its card shows (**"Shopkeeper"**, **Talk**); a tap on it or the counter walks you in front of it, the
  counter between you. A card you close stays closed until you move on.
- **The crate's card** (Talk): in the middle of the room, **"Babur's Boss Crate"** / **"Puddles' Boss Crate"**, the crate's picture, its
  prizes (the boss's ride first, always: Balloon Pup; Puddles's Mower; then **"+ 24 Beta Crate items, Common to Epic"**), the price line
  (**"3 Babur tokens, or 1 Babur token + 1 crate key"**, `BOSS_CRATE_PRICE` in core's settings), what you have (**"You have 2 Babur tokens
  and 1 crate key."**: `bossHoldings`, your locker's, drawn again whenever your account changes) and two buttons, **"Buy with 3 Babur
  tokens"** and **"Buy with 1 Babur token + 1 crate key"**, each greyed while you can't pay that way (`canAfford`), both through
  `buyBossCrate(boss, way)`: the server's purchase (round 2), into your inventory, unopened (Eric, Nov 2; the Crates tab opens it:
  [shop.md](shop.md), "Boss crates you hold"). Its answer shows in a row under them that's always there, 40 px high, in the card's white
  at 13 px (Nov 12: it was the 11 px gray "Coming soon" style, and Eric missed it): **"Babur's Boss Crate is in your inventory."**, or the
  server's reason (**"You need 3 Babur tokens."**). The price line is its own class, `.shop-room-price` (Nov 12: it shared `.shop-price`
  with the Shop screen's cream price button, which won). **After a buy** (either way; Eric, Nov 12) a pop-up over the room and the card
  (dimmed under it, never moved): **"You got Babur's Boss Crate!"** (`gotLine`), the crate's picture, "It's in your inventory.",
  **Open now** and **Later** (44 px). Open now opens it with the Crates tab's own `CrateOpening` (the strip, the reveal; the same route and
  odds), in a box over the room in the app's light or dark surface; its Done (or Later, or Escape) closes it and leaves the card as it was.
  A failed buy: the row says why, no pop-up. e2e `shop.spec.ts`, "Boingo's Boss Crate bought in his Funhouse";
  docs/decisions/2026-11-12-boss-crate-bought.md.
- **The chat log inside** (Eric, Nov 2: "make the default text color white, or black, depending on darkness of background in the shop"):
  the town's chat box over the room takes the room's tone, not the sky's (`ShopDef.chatTone`: TownChat's `data-tone`): Babur's dark tent
  `night` (white words on a dark tint), Puddles' light greenhouse `day` (dark words on a light tint), whatever the time outside.
- **The way out**: standing on one of the two squares just inside the door, a card says **"Go out"**. The door is behind you as you look
  north: walk back toward it, or drag the view back to it and tap it.
- **Test hooks** (test switches on): the room's canvas `canvas.town-shop-canvas` carries `data-room`, `data-you`, `data-ready`;
  `__shopAt("keeper" | "door" | "square", [c, r])`, `__shopCam()`, `__shopBench(n)`, `__shopRide()` (your ride inside).

## The Walk-up, the Hidden Boss's building (Nov 13)

An old Brooklyn corner walk-up (Eric's 1940s photo, `notes/mockups/2026-11-12-eric-hidden-boss-building-ref.webp` on the director's
notes branch): **in everyone's town** since Nov 13 (Eric: "It doesn't need to be admin only... the site is behind Cloudflare"; it was an
admin's only for a day, `"recluse"` in core's `BOSS_ADMIN_FIRST`); his Boss Battle tile stays locked (he's `adminOnly`: met only from
his room, below, and the Crowd's final). Its name is "The Walk-up"; the boss's is core's one string ("Hidden Boss"), never his real one.
[2026-11-13-hidden-boss-building.md](../decisions/2026-11-13-hidden-boss-building.md). On the ring of fourteen's spacing it's the
exception: about 7 squares from Ginger's igloo (`town-camera.test.ts`).

- **Outside** (`houses/recluse.ts`, 144 x 224, drawn in code): four stories of red-brown brick with stone quoins, a bracketed cornice and
  a little pediment, arched stone hoods (the top floor's windows round-headed), a black iron fire escape zigzagging down the east bays, a
  striped awning over a little shop, the stoop and the front door (x 90), a barred window. **No sign** (Eric: "no address plate or name
  on it"): its sign face is empty (`w: 0`) and render.ts writes nothing on it. The top floor's lit window (the child's) has a lace
  curtain that stirs. The street town: the corner lot of Fountain Street and Seam Avenue (`street-plan.json`, 47-50; the row shifts it
  0.23 onto the corner), its box brick with arched side windows and a water tank on its roof (`home-boxes.ts`); the lamp that stood at
  (50, 31) is gone (Eric's no-lamp-in-front rule). Today's town: (45, 7). On the map and its chip: the lit top window (`BOSS_FACE`).
- **Nobody out front:** `hasFigure` (world.ts) is false for it, so the town's figures (`Town.bosses`) skip it; it's the last home, so
  every figure keeps its home's index.
- **Inside, three rooms** (`shops.ts` `RECLUSE_ROOMS`; smaller in than out), **all three with his room's walls**: each side wall one
  surface (Eric, Nov 13: "build the walls in the room like we did for his room"; `shops/side-walls.ts`, shared by his room's scene and
  the hall's and landing's, `recluse-stairs-scene.ts`; the layouts' side squares and back corners solid blanks). The **hall** (its front,
  from the street door; 7 x 7, `shops/recluse-stairs-art.ts`: a white hexagon mosaic with a black band, dark green dado, flats 1A and 1B
  and the mailboxes under a sconce in the back wall, a radiator, the stairs up at the back right); the **landing** (7 x 7: oak boards and a red runner, flat 2A, a window
  on the airshaft, the stairs down at the front, the stairs up at the back right); the **top floor**, his room (the mockup's 9 x 9 child's
  room, `recluse-art.ts`, its one-surface side walls; the child playing his 1956 game: `recluse-scene.ts`, given to the room as its `fx`
  with `{ live: true }`, so you're drawn and the four stand-in pawns aren't; on the wall clock, so his game is where it is whenever you
  come up). Its door in the front wall leads down to the landing.
- **The stairs** are room-to-room doors (Rolling Dough's back door's kind, room.ts `door: RoomPart`): a room can have several now
  (`Room.passes`; `pass` is the first), each naming the room it leads to; its card says **Go up** or **Go down** (by the floors), and you
  arrive at the stairs you came by (`passArrive(room, from)`). The same fade as Rolling Dough's door.
- **The flats' doors** are talk pieces with `locked` lines: a tap walks you to that door's own spot (`talkNear`), and its card
  ("Apartment door") says a short line in turn, with OK. His room: a tap on his board walks you round to its front; his card ("Hidden
  Boss") has the room's own challenge (below: **His room's challenge**).
- **Music:** `recluse-house` (themes.json) plays in his room only (`ShopDef.music`; `roomTheme`); the hall and the landing have none.
  It loads as you go in at the street door (`homeTheme`).
- **Banners:** the hall "Hidden Boss's / The Walk-up", the landing "Second floor", his room "Top floor".
- **See-through:** each room's front door (the street door, the stairs down, his room's door) and front band go see-through over you
  (`RoomArt.seeThru`, which a box room may list now too: you walk in, or come up, just behind them).
- The dev preview (`/hidden-room-preview.html`) stays a dev page: the build has only `index.html`.
- **His room's challenge (Nov 13; [2026-11-13-hidden-boss-challenge.md](../decisions/2026-11-13-hidden-boss-challenge.md)).** Eric's
  rules: you challenge from his room only, and wait there; four at most in it; at four, the summoning, then his fight together.
  - **The server** (`server/src/hidden-room.ts`, in the live hub's memory: a restart forgets it, and each device in the room goes back in;
    `POST /api/town/hidden`, `hidden-room-api.ts`): per town instance (the town's `room`: production's one, each test's own with
    `?townroom=`), the room's people and one request. Signed-in accounts only (a guest goes up and watches, uncounted, Challenge greyed:
    "Sign in to challenge him."; the app asks nothing for them). An account banned for fair play can't go in or challenge: the same
    `banCheck` as PLAY (the account and the device cookie, at most once a minute), 403 with `banned` and the ban header, and the app shows only
    the ban screen (review M1; since Nov 13 a ban means you can't sign in: [fairplay.md](fairplay.md)). A rest (`boss:recluse` or `raid`) refuses a challenge and ends a request the bots fill with its line. Every number in core's `HIDDEN_ROOM`: `players` 4, `capSec` 300,
    `pollMs` 1500, `silentSec` 20, `outcomeSec` 60, `bots` 3, `botJoinMs` 2000, `joinWaitSec` 60.
  - **The door:** the stairs up from the landing ask the server first (`enter`): with four people in the room (bots and those who haven't
    challenged count), "The door is locked." with OK, and you stay on the landing.
  - **The count:** his card (`HiddenRoom.tsx`) has Challenge and Cancel (each greyed while it doesn't apply: nothing hidden) and a line,
    "Up to 4 fight him together." or "2 of 4: Ann, Bo"; over the room, **"Challengers 2 of 4"** for everyone in it, from "0 of 4" as you
    come in, so it never appears from nothing (`.hb-count`; greyed for a guest, a device too young or a banned account). The app asks every `pollMs` (`hidden-net.ts`, with where you stand), and the others in the room are drawn as pawns
    gliding to where they stand (`recluse-scene.ts` `people`; a newcomer from the door; each a mockup color by their id: `liveColor`).
  - **Leaving asks:** with your request in, the stairs down, back and the town's leaving (the side menu, the back gesture) ask **"Cancel
    your game request?"** (Stay / Leave and cancel; `LeaveTown.tsx`, `requestWaiting`). A disconnect (no ask for `silentSec`), the AFK
    drop (the town's own away rule, `watchAway`, which runs in rooms too: the app sends no idle time) and a solo boss battle begun
    elsewhere (one request at a time: `/api/boss/solo/start` → the hub's `hiddenDrop`, after the answer) end your place too. The other
    ways into a game (PLAY, a party's START, Squads, 1v1) don't: a known gap, two tabs only.
  - **Too late to leave:** once the fourth has joined, the four are set. A Cancel or "Leave and cancel" racing the start keeps your seat,
    and its answer hands you into the fight with the others (in the room, the summoning; out of the town, straight in). The hub's answers
    wait while the fight is being made, and a device swept out meanwhile is told its fight when it asks to come back in. Only a closed tab
    leaves its seat empty: the others start at `joinWaitSec`.
  - **The cap:** not four by `capSec` (shown nowhere): everyone waiting gets "Sorry, not enough players." with OK, and stays in the room.
  - **At four:** the hub makes the fight (a party battle's lobby: `hiddenRoomSettings`, `PartyLobby.room`, each person's own pass into
    their seat) and posts the town's line, "Ann, Bo, Cy and Di are fighting the Hidden Boss." (the challenge lines' blue). Each of the four
    reads their start on their next ask: the room's music stops, everyone freezes where they stand (you too: the scene's pawn), and the
    scene's summoning plays (`HIDDEN_ROOM_FEEL.summon`, about 7 s, to black); a black cover holds while his fight opens (the app's
    `hiddenFight` → `joinLobby`, `NetMatch.hiddenRoom`). Its result's "Back to town" brings you to his door.
  - **Eric's test kit (admins only, server-checked):** "Fill with 3 bots" on his card: three bots stand at the board's places, count
    toward the four, join a request one by one (`botJoinMs`, so each count shows), go through the summoning and play as the fight's bot
    members; they leave with the admin. A player's "fill" is refused ("Admins only."). The fight's 🏆: see bosses.md, "Win this form".
  - **The fight plays through** (Nov 13): the child first (beaten, a new match against the man), his adult form beaten, his phase change
    and the four boards online, to the result (bosses.md, "His child form", "Phase 2 online").
- Tests: `test/recluse-building.test.ts`; server `test/hidden-room.test.ts` (the room count, the lock, the cap, leaving and disconnects,
  one request at a time, the bots' admin gate, the fight of four, the online 🏆's admin gate; a ban at the door, a cancel, a leave or a
  swept device racing the start, the hub's wait, a rest); e2e `hidden-boss-room.spec.ts` (an admin up,
  the count at 0 of 4, Challenge 1 of 4, leaving asks, 3 bots join to 4 of 4, the summoning, the fight, the 🏆; a 5th locked out); `town-street.spec.ts` ("the
  Hidden Boss's walk-up": the door, up two flights, his card,
  back down; `STILLS=<dir>` writes the stills).

## Challenging a boss (Nov 2: Pokémon-gym style)

Eric, Nov 2: challenge a boss in the town and it walks into its home with you; you each walk to your start mark on its battle
circle; it says its line; its own animation brings the board in; its own transition covers the screen while the battle loads; after
the battle, "Back to town" puts you where you stood. Round 2 (Nov 2, after the intro GIF): "For Alfil he shattered the pyramid, that's
fine for him, but for other bosses they should just be swinging for a few seconds… I also prefer the normal look is boss on left, you
on right, not vertical… just be sure the table and chairs and pieces all are logically placed." Decisions:
[2026-11-02-boss-challenge.md](../decisions/2026-11-02-boss-challenge.md), [2026-11-02-boss-challenge-r2.md](../decisions/2026-11-02-boss-challenge-r2.md),
the pacing and standing clear of the stools (Eric, Nov 2, after Big Boy's live: "it all happens so quick"; "make sure they're not
standing where the chair blocks are"): [2026-11-02-challenge-pacing.md](../decisions/2026-11-02-challenge-pacing.md).
- **Intros as data (Nov 7, the audit's §5):** Alfil's, Big Boy's, Timber's and Smudgy's intros are a timeline of beats in their own file
  (`shops/intros/<boss>.ts`), played by one player (`shops/timeline.ts`) and drawn by ShopRoom's `drawCast`; the others are still their own
  state machines in challenge.ts. Each moved intro's beat log matches main's (`test/intro-timeline.test.ts`). How to write one:
  bosses.md, "Adding a boss". Decision: [2026-11-07-intros-as-data.md](../decisions/2026-11-07-intros-as-data.md).

- **Wrangler's challenge (Nov 4, his own; Eric's design, intro-pig-nov4.md):** you both walk on straight to where you stand (`seated`,
  the usual clear places: at the art's 7.2 his rope coil hung in front of his bucket), and nobody moves after. His line (a placeholder
  until Eric's Gemini lines) "Saddle up, partner. The board's comin' to us." in the big bubble; he spins the lasso, throws it (the loop
  leaves his fist on the throw's release frame and flies to the board on its hay bale), it cinches; he yanks, and from that moment the
  room's board stand is his bale (`INTRO_PIG_TABLE`, its slab and the real board on it, `paintTable`, raised by its slide's lift),
  dragged along a curve behind him to the table's place, where it lands; the loop is flicked free and reeled in; the cross throw sends
  two ropes off screen each way; on the double yank's first heave the black bucket (his, from our left) and the white one (yours, from
  our right) tumble in from just off the screen's edges (kept inside the walls) and land upside down as the stools; the ropes reel in;
  his brag; his God King attack swung in place (his lasso's lash crosses over his bucket: the one exception to the stool clearance
  check, for Eric); his wipe (`INTRO_PIG_STORM` and `_FRONT`: a dusty sunset, tumbleweeds, spurs, toy cap guns with BANG! flags), its
  own frame cues (the spurs' jingle, a cap's pop) played as it sweeps in. His moves are drawn as the art drew them (not mirrored);
  he faces you mirrored only walking in and in his attack. Every beat is `CHALLENGE_FEEL.rope` or the art's frames (`ropeAt`,
  `ropeTimes`, `ropeCues`); about 12.3 s from the marks to the wipe. The ropes' lines are the code's (`INTRO_PIG_ROPE_INK`), drawn over
  the room. Four new sounds (`pigSlide`, `pigClatter`, `pigJingle`, `pigPop`), every cue his own.
- **Jefferson's challenge (Nov 4, his own; Eric's design, intro-grex-nov4.md):** you both walk on to the marks (his red plate west, your
  lift's plate east) and stand there throughout: he stands (no stool), there's no hop back. His call, one of four at random (`lines`,
  `lineOf`; placeholders until Eric's Gemini lines): "Boys! We got a challenger!", "Take five, everybody. We're playing chess.", "Who
  wants a fifteen-minute break?", "Forks down, boys. Somebody wants a game." in the big bubble. He hollers (his `call`); in it the crew
  stop work: the machines park where they are and their guys step off toward the camera, the dozer wakes with a snort; he waves them over
  (`waveOver`, twice); they walk round the table's north side (each by its waypoints, `CHALLENGE_FEEL.crew.via`, after the art's
  setoff delays, at 3.2 squares a second or as much faster as he must to be there as your lift locks) to their spots in a loose ring
  behind the table (`INTRO_GREX_CREW_SPOTS`), all on screen, watching (the dealer his idle). The board on its crates is there from the
  walk in (the intro's `INTRO_GREX_TABLE` drawn where the room's stood, the same picture, its slab and the real board on it 59 px up,
  riding its sway). The floor tile at your mark rises on its piston (`INTRO_GREX_LIFT`) and lifts you 32 px, level with the board; the
  crates creak as it locks; his brag; his God King attack swung in place; his wipe (`INTRO_GREX_STORM` and `_FRONT`: fireworks, sparkler
  trails, a wall of sparkler fizz), its own frame cues (a rocket's whistle, a little pop, a soft bang) as it sweeps in. After the match
  the crew are on their loops again (no walk back). Every beat is `CHALLENGE_FEEL.crew` or the art's frames (`crewAt`, `crewTimes`,
  `crewCues`); about 13 s from the marks to the wipe. Ten new sounds (`grexShout`, `grexStep`, `grexSnort`, `grexHiss`, `grexClunk`,
  `grexCreak`, `grexCreakSoft`, `grexRocket`, `grexPopSoft`, `grexBang`), every cue his own.
- **Ginger's challenge (Nov 5, his own; Eric's design, intro-ginger-nov5.md):** his own camera, centred on the table (`BossIntro.cam`,
  `introCam`; every other boss's is `CHALLENGE_FEEL.cam` as before), so both staircases show on a phone. You both walk on to the marks
  (his peppermint west, your snowflake east) and stand there: no stools. His line (a placeholder until Eric's Gemini lines): "Cold enough
  for you?". He charges his staff and blasts the air over the battle spot; the icicle forms in the burst, falls point first and stabs the
  floor (a crack that stays, a puff of snow): its round flat top is the table, 27 px up (a park table's). The stockroom door opens and two
  elves bring the board out ("Coming, boss!" over them), run round behind you both and toss it up onto the table; he casts and the pieces
  appear as the small white light on the board fades; his brag; his God King attack; his blizzard of snowflakes and colored candy canes
  (`INTRO_GINGER_STORM` and `_FRONT`). The table and the board are in place long before the cover, and the carriers at their watch spots
  before his brag. The room's own elves keep working. Every beat is `CHALLENGE_FEEL.ice` or the art's frames (`iceTimes`, `iceAt`,
  `iceCues`); about 13.2 s from the marks to the wipe. Twelve new sounds (`gingerCharge`, `gingerBlast`, `gingerBurst`, `gingerWhoosh`,
  `gingerStab`, `gingerStep`, `gingerHeave`, `gingerClack`, `gingerCast`, `gingerSparkle`, `gingerThump`, `gingerGust`), every cue his own.
- **Smudgy's challenge (Nov 6, his own):** seated (the stools are already there): you both walk on to the drop cloth's marks beside the
  covered table; his line "Smudgy, artist. Don't touch the wet parts." (his entrance's first); he whips the cloth off (`smudgy.grabMs`
  after it; the cloth's frames, `INTRO_SMUDGY_CLOTH` in `shops/smudgy-intro-art.ts`: up, sailing west over him, dropped in a heap by his
  stool), the game's board on the table from its second frame; his reveal line "Careful, don't get any paint on the pieces!"
  (`BossIntro.chant`); then **the splatter** (`shops/smudgy-splatter.ts`, `canvas.boss-splatter`): splats in the room's deep paints land
  faster and faster until the screen is covered (1.2 s), held while the battle loads (at least 0.25 s), and a brush stroke sweeps it away
  onto the match (0.5 s); every phase by the clock. No attack. Every beat in `CHALLENGE_FEEL.smudgy`; its data `shops/intros/smudgy.ts`. Four new
  sounds (`smudgyWhoosh`, `smudgyFlop`, `smudgySplat`, `smudgySwipe`).
- **Folio's challenge (Nov 5, its own; the art's timeline, intro-folio-nov5.md):** you both walk on to the clean page's marks (it glides,
  its intro's own frames, `BOSS_FOLIO_INTRO` in `characters/folio-intro.ts`, mirrored to face east; its shadow the art's warm see-through
  brown, not the town figure's near-black, in this room only); its line "Every game is a draft. Shall we write one?"; you both step back
  a pace (`folio.backMs`, eased, no hop: it to 2.3 from the table's middle, `BossIntro.clear`; you to the usual 2.2); the three flat sheets
  (lying on the page from the walk in) fold up, the west stool, the east `stoolGapMs` later, then the table; a paper plane flies in from the
  east along the art's route with the board folded on its back, banks over the table and lets it go; the packet falls flat onto the
  table's top, lies and unfolds (two folds, like a map), and the game's own board comes in over it (`swapMs`); Folio bows and says one of
  five quiet lines (`BossIntro.chant`, `chantOf`); `crumpleAfterMs` after the line has gone, **the crumple**: the screen as it is (the
  room's canvas read at that moment, the page's DOM over it, the header and the chat, taken as the quiet line goes: `shops/snap.ts`
  through an SVG `foreignObject`) is crumpled over black into a ball (`shops/crumple-gl.ts`: a WebGL mesh, 16 × 34 on a phone, the
  art's maths in `shops/crumple.ts`), held while the battle loads under it (the battle starts once it's a ball), the match screen
  taken the same way and cross-faded in on the ball, opened, its creases lingering over the live match (the cover multiplied over the
  page) and gone. No WebGL (or a failure, or the match's picture over `maxHoldMs` once the match shows): a fade through black. The room
  stops drawing under the cover. About 11.1 s from the marks to the crumple, 13.4 s to the match. Every beat in `CHALLENGE_FEEL.folio`;
  `folioTimes`, `folioAt`, `folioCues`. Five new sounds (`folioSet`, `folioGlide`, `folioLand`, `folioBall`, `folioOpen`); the folds,
  the unfolds and the bow its own fold, unfold and rustle. The crumple's state on its canvas (`canvas.boss-crumple`: `data-mode`,
  `data-phase`, `data-phases`, `data-dom`, `data-match`) and its frames in `__crumpleFrames` (test switches on).
- **Dash's challenge (Nov 5, round 3, his own; Eric's design, intro-blitz-nov3.md; an admin's town only while he's in the game for
  admins first):** you both walk on straight to where you stand through it all (`seated`): he at his own place (`BossIntro.clear`
  2.08: the art's `BLITZ_INTRO_DROP_AT`, 72 of his pixels west of the table's foot, so every toss is drawn at the table), you at the
  usual clear place. His line, "Yo yo yo! Dash in the building, fam!" (`CHALLENGE_FEEL.blitz.lineMs`, a short one). Then four dashes
  (`BLITZ_DASHES`, each a beat): he bolts off to our left in a trail of dust (`INTRO_BLITZ_DUST` at his spot, from the bolt's whoosh),
  is out of sight `awayMs`, races back, skids onto his spot and tosses: the shoe-box table lands (`INTRO_BLITZ_TABLE`, its own teal lid
  on top), the board falls onto it (Big Boy's `boardDropMs` from `dropFrom`), the pieces appear with a pop (`INTRO_BLITZ_POP`, the
  pieces from its own frame), both shoe-box stools land a square each side (`INTRO_BLITZ_STOOL`). His brag (he dusts off his jacket
  and finger-guns you); no God King attack was drawn for him, so he stands through its beat; his clock rush (`INTRO_BLITZ_STORM` and
  `_FRONT`, played as Alfil's sandstorm). Everything stands before any cover and nobody steps after the stools land. Every beat is
  `CHALLENGE_FEEL.blitz` or the art's frames (`blitzTimes`, `blitzAt`, `blitzCues`); about 10 s from his line to the cover. His moves
  `characters/dash-intro.ts` (his rig exported from `boss-blitz.ts`, his town frames as before), his props `shops/blitz-intro-art.ts`
  (one lazy chunk). Two new sounds (`dashThud`, `dashBrush`); the rest his own (`dashWhoosh`, `dashSqueak`, `dashZip`, `dashDing`,
  `dashTick`, `dashWhirr`) and the app's `pop`. Decision: [2026-11-05-dash-intro.md](../decisions/2026-11-05-dash-intro.md).
- **Hollow's challenge (Nov 3):** his own intro since Nov 3, round 2 (below: "Hollow's own"); his line "Did you leave a light on?"; the
  rings in the ice (`SHOP_HOLLOW_MARKS`) give the table's place; his seat his own (`BossIntro.clear` 2.92, `marksFeel`'s `own`): his
  lash lies 1.6 squares out in front of his feet, so at the usual 2.6 it reached his stool. The pond is smaller than the other circles
  (an oval about 6 × 4 squares): there his foot is at the ice's west edge. Decision: [2026-11-03-hollow-intro.md](../decisions/2026-11-03-hollow-intro.md).
- **The intro's bubble (Nov 4, every boss's line and Hollow's channel lines):** sized for the boss as drawn (`CHALLENGE_FEEL.bubble`:
  its font 0.11 of his drawn frame's height, 11 to 32 px; `bubbleSize`) and its tail just over the top of his drawing (`drawnTop`, the
  loaded intro's `boss.head`), not over his frame's head room. Eric: it was a name tag's size, far above his head. A phone's stays about
  as before (11 to 13 px), just over his head; it stays in the view. Decision: [2026-11-04-battle-desktop-fixes.md](../decisions/2026-11-04-battle-desktop-fixes.md).
- **Which bosses.** Those in `BOSS_INTROS` (`town/shops/challenge.ts`): every boss whose home has an inside (`SHOPS`): Alfil (his own
  intro, `custom: true`), Big Boy (his own, Nov 2), Timber (his own, Nov 3; in an admin's town only while he's in the game for admins
  first), Hollow (his own, Nov 3, everyone's), Wrangler (his own, Nov 4, everyone's: below), Jefferson (his own, Nov 4, everyone's: below), Ginger (his own, Nov 5, everyone's: above), Folio (its own, Nov 5, everyone's: above; its transition the crumple), Dash (his own, Nov 5, in an admin's town only: above; no God
  King attack was drawn for him, so he stands in his idle through the swing's beat, turned to you by his intro's `facesLeft`), Babur
  and Puddles (the default intro). Every
  other boss's card works as before (its confirm, Leave, the Boss
  raid screen). Per player: it all happens on your own screen; the boss stays at its home for everyone else.
- **The layout** (`layout`, per boss): **"across"** (the default, all five today): the boss on the table's west (the screen's
  left), you on its east, side by side on the circle's middle row, each `standOff.across` (1.5) squares out, facing each other;
  **"facing"**: the boss north, you south (`standOff.facing`, 2.5: the circles' old marks). `marksOf(layout, how)` finds the circle's
  middle from its floor (`circle-*`, `ring-*`, `emblem-*`), moved `clearOff` south when a piece stands there (Babur's pedestal).
  Alfil's and Puddles' drawn start marks sit west and east of the emblem, the middle line north to south (a unit test keeps the marks
  where the layout puts you). Big Boy's are on the zoo rug in his circle's middle, and his art exports them (`SHOP_BIGBOY_MARKS`,
  `RoomArt.marks`): `marksOf(layout, how, drawn)` stands you on them across, the table halfway between (the same squares).
- **The table:** the town's park table (`PARK_TABLE`, three squares across: a stool, the leg, a stool), in the boss's colors when its
  art has a table (Alfil's), else the park's stone. A stool at each player's side, `stoolOff` (1) from the middle, nothing on the empty
  sides: across, the picture as drawn; facing, its middle square alone and a stool north and south. The board (`paintTable`) is
  turned to the layout (`boardSquare`): white's ranks nearest you, black's nearest the boss, the a-file on your left; across, the
  knights face the other side. You and the boss walk to and talk on your marks, just past your stools; as the stools come in (the
  default's pop, Big Boy's stools dropping, Alfil's table showing through the crumble: `hopStart`, or `hopBack` in its data) you each take a little hop back
  (`hopMs`, `hopUp`) to `clear` (you 2.2, the boss 2.6 squares from the table's middle: `Marks.youClear` / `bossClear`), so no part
  of either near the floor stands in front of a stool (a unit test measures every boss's drawing, its attack's feet and the pawn).
- **The flow** (`nextFlow`, pure): the boss's card's **"Challenge alone"**, its confirm **"Challenge Babur?"** / "You'll fight Babur in
  Boss Battle, then come back here." / **Fight** / Stay. Fight keeps where you stand (`standOf`), and you and the boss walk to its
  door (both at `doorStepMs`, the town's walking pace, not your run) and in (the shop's zoom and fade; the room and the intro load only now: `shops/intro.ts`, and Alfil's
  art, `shops/alfil-intro-art.ts`, Big Boy's, `shops/bigboy-intro-art.ts`, Timber's, `shops/timber-intro-art.ts` with his moves, or Hollow's, `shops/hollow-intro-art.ts` with his, `characters/hollow-intro.ts`;
  `characters/timber-intro.ts`). Inside (the room in challenge mode: no cards, no walking by tap, its own framing per layout,
  `CHALLENGE_FEEL.cam`, at zoom 1 since Nov 3: the further-out camera, everything in view), you both stand just inside a beat (`insideMs`, from the room's first frame), then walk up to your marks, side
  by side at `walkStepMs` (a slow walk), settle onto their middles and turn to face each other. Every beat is one number in
  `CHALLENGE_FEEL`, laid out by `introBeats` (an intro as data: its file's beats): facing each other `faceMs`; the line alone in a speech bubble over its head for `lineMs`
  (2.5 s; not the chat log; `BOSS_INTROS[id].line`, placeholders until Gemini's lines); a pause (`afterLineMs`); then:
  - **Alfil's own:** the pyramid rising, holding `holdMs` (its idle), cracking, crumbling, the table and its board (`shops/intros/alfil.ts`), his
    cues' sounds; then the sandstorm (`startStorm`).
  - **Big Boy's own** (Nov 2, toy blocks: `shops/intros/bigboy.ts`): six alphabet blocks drop in and stack 3-2-1 (B-I-G, B-O, Y:
    `build`, a wooden clack as each lands, a bonk for the top one); a gap (`gapMs`); the board drops onto the top block
    (`boardDropMs` from `dropFrom` squares up, his toss) and plops on (`plop`: dust and stars, a poof); a gap; the two stool blocks drop
    in at your sides (`chairs`, a clack each: a dark gray B on his side, black's, a bone W on yours, white's). The blocks are his table
    and stools (their own picture, no park table); the board is lifted until its slab's front rests on the top block (`slabFrontY`),
    so the slab doesn't hide the upper blocks. Then his lollipop swirl (`INTRO_BIGBOY_SWIRL` and its front), played as Alfil's
    sandstorm (`startStorm`), his swish.
  - **Timber's own** (Nov 3, a log: `shops/intros/timber.ts`; Eric: "When he walks in, to the left there's a giant thick wooden
    log. He picks it up and walks it over… sets it in the middle where the chessboard goes. Then he starts gnawing at it… a big storm of
    wood shavings and sawdust comes up like a fog… you see he's chewed it into a board… The seats are little wooden stumps"). His own
    beats replace the line, pause and table beats (his data's, every number in `CHALLENGE_FEEL.log` or the art's frames; about 12 s
    from the marks to the sweep): the giant log lies on the floor `log.at` (3.3) squares west of the table's middle from the walk in;
    his line shows `log.lineLeadMs` alone, then he walks west to the log (his own moves, `BOSS_BEAVER_INTRO`, drawn at his town size,
    mirrored to walk west; `log.walkMs` a square) while the bubble stays its `lineMs` over his head; he heaves it up (the lying log hidden
    from the heave's first frame: it's in his paws), carries it east (`log.carryMs` a square) to where he works, his art's `reach` (about
    1.16 squares) west of the table's middle, sets it down (the log on its own, standing on the table's place behind him, from the
    set-down's last frame), gnaws it (the log's own gnawing; his gnaw looping, its sounds his teeth's); the shavings' fog boils up over
    the table's place and both of you (`rise`, at the room's size, its foot the table's), holds `log.holdMs` (the log gone, his table and
    its board swapped in under it) and settles (its last frame, a ring of shavings, kept till the sweep); the stumps pop up at the stools'
    places (`stoolOff`, 37 room pixels a side; you hop back clear as for the others); he dusts off his paws (`done`) and walks west to
    his place, `log.clear` (2.7: his stump's roots spread wider than a stool, so he stands a tenth further out than `clear.boss`;
    `marksFeel`); his attack. His table: `INTRO_TIMBER_TABLE` (the park table's geometry, a gnawed log pedestal, no stools in its
    picture) in `INTRO_TIMBER_TABLE_PALETTE` (maple and walnut squares), the real board on it (`paintTable`). His cues each a sound of
    his own (`characters/timber-sounds.ts`: hup, thump, gnaw, chomp, clatter, saw, slide, knock, pat, chitter). Then his sawdust sweep
    (`INTRO_TIMBER_STORM` and its front), played as Alfil's sandstorm, his swoosh. Nothing new for anyone else in the town: you both
    go inside, as with every boss.
  - **Hollow's own** (Nov 3, the dark: `DarkAnims`, `isDark`, `darkAt`; Eric's design and his five changes, the decision above). You
    both walk on straight to your seats (`seated`, `seatedMarks`: his clear place, yours the usual) and stay there: no hop back. His
    line (`dark.lineMs`, 1.8 s); a pause; the park table pops in as the default's, still lit, and stands `tableHoldMs`; he charges (his
    own moves, `BOSS_HOLLOW_INTRO`: `charge`, `dark.chargeMs`) with a channel line over his head (one of `chant`'s four at random,
    `chantOf`, for `chantMs`), swells, and drinks the light (`drink`: `dark.drain`'s beats as drawn, each times `dark.pace`, 0.85, about
    5.7 s): the five lanterns go out one by one far to near (`dark.lanterns`; each lantern's own frames, `gutter<k>` from its sway frame,
    its light and pool going with it), the string's 57 bulbs go dark west to east (`INTRO_HOLLOW_BULB_RUN`; the backdrop's candle with its
    first), the tree from the bottom up to its star, his own strand a third at a time (`bulbs2` to `bulbs0`), your pawn's light (it greys
    a touch), each light's motes flying into the ball; your tag fades as it starts. The room darkens with each light gone (the art's
    `INTRO_HOLLOW_DARK`: its tone over the room, the lights still lit drawn over it, glows then their lit pixels, then the motes); `full`;
    the blackout and the black (0.9 s: his eyes alone, dim violet slits); the dim light (`INTRO_HOLLOW_DIMPOOL`, steady) round him, the
    table and you while he settles; the pool closes in on the board (the iris, `irisMs`). No attack. Then his transition, the dark
    (`startDark`: `canvas.boss-dark`, black from its first frame, held while the battle loads, faded off it over `dark.outMs`). Every
    beat a number in `CHALLENGE_FEEL.dark` or the art's frames; about 15 s from the marks to the board. His cues each a sound of his own
    (`characters/hollow-sounds.ts`; the table's the app's pop). Only the room changes: the cave's own art and frames are never touched,
    so it is lit as ever the next time you go in. Nothing new for anyone else in the town.
  - **The default** (`custom: false`): the table pops in (`pop`: grows from its foot past its size and back over `popMs`, a dust puff
    over `puffMs`, the app's soft "pop"); then the flash and the wipe (`startWipe`: `flashes` white flashes over `flashMs`, black bands
    wiping in from alternate sides over `wipeMs`, the boss's own whoosh; held black while the battle loads; faded off over `wipeOutMs`).
  Every intro (but Timber's, who walks away from his, and Hollow's, the dark) then holds the table on its own `tableHoldMs`, and the boss swings its God King attack in place where it stands (its
  kit's `kingAttack` and sounds: its lashes only, looping, no drop-in or leap: `attackStart`, `attackTime(…, inPlace)`) for
  `swingMs` (2 s) until its transition has covered the screen (`coverMs`), and on until the battle shows.
  Each transition is a canvas over the whole page, outside the town (it stays as the town closes); the battle starts under it (the
  app's `challengeFromTown`: Boss alone, as START). The back button calls it off until the transition starts. A tap doesn't skip.
  About 12 s from Fight to the screen covered for Big Boy and Alfil, 9 for the default (it was about 6; the room's loading adds to it); about 16.5 for Timber (his own intro about 12.7 s from the marks to covered, Eric's "about 12 s"); about 15 s from the marks to the board for Hollow (Eric: "his startup time can be a few seconds longer").
- **After the battle:** the result screen's leaving button reads **"Back to town"**; it (and the gear's Leave: "You'll go back to the
  town square.") opens the town with you on the square you stood on, facing the same way (`createTown`'s `stand`). "Play again" keeps it.
- **"Ann has entered the town."** (Eric, Nov 12: "it's not persistent enough… we have to wait for someone to say something… when you
  join… it should say… has entered the town"): the server's line when a signed-in player's pawn comes into the town (`TownHere.beat`
  says it's fresh: new, past its limit, or from another room; the live hub hands it to that town's chat room, `TownChat.arrive`). Once
  per visit: back within `TOWN_CHAT.enterRejoinMs` (2 minutes) of your last beat (a reload, a trip home or to a game) posts nothing. A
  busy town doesn't flood: arrivals within `enterBurstMs` (6 s) of an "entered" line wait and go out as one line when it's up ("Ann and
  Bo entered the town.", "Ann, Bo and Cy entered the town.", "Ann, Bo and 3 others entered the town."), so at most one every 6 s.
  Everyone in the town reads them (guests, chat off: they arrive and show when it's on), and a device marked too young reads these
  alone (the server sends it nothing else: `enterOnly`). In the log: `sys: "enter"`, kind `arrival`, the system gray upright (a line only
  you see is the italic one), no name, no menu, not reportable or mutable; a tap on it opens typing. They follow the room's rules (5
  minutes, a newcomer's last 12). A Worker instance's 2 s copy of the room means your own may show a moment after you arrive.
- **The server's lines in the town's chat** (signed-in players; blue, `.tc-server`, no name and no menu): "Ann challenged Alfil!" as the
  battle starts; as it finishes, "Ann beat Alfil in 34 moves!", "Alfil beat Ann in 21 moves.", "Ann drew with Alfil in 40 moves.",
  "Ann surrendered to Alfil after 15 moves." (a resign after `TOWN_CHAT.challengeSurrenderMoves`, 10; before, it's a quit), and
  " + Alfil token" on the end when the battle dropped one. No spam: while one of your challenges is unfinished (a quit: a leave, an
  early resign), your next challenge posts no start line; its finish posts the outcome and closes it (`TownChat.challenge`, server).
- **Test hooks:** the room's canvas `data-intro` (its step); `__shopIntro()` (step, layout, where you and the boss stand and face, the
  line, the table and its stools; Timber's `wood`: his move, the log, the fog, the ring, the stumps; Hollow's `chant`, his channel line
  while it shows, and `dark`: his move, his strand, the lanterns out, the string's bulbs dark, the tree, your tag, the dark's level, the
  blackout, the dim light, the iris); the storm's `canvas.boss-storm`, the wipe's `canvas.boss-wipe` and Hollow's `canvas.boss-dark`
  (`data-phase`); `__townYou()`.
- **Tests:** `packages/app/test/boss-challenge.test.ts` (the flow, the layouts and marks, the stools, the board's turn, the timelines,
  the pacing beat by beat, the hop back, every figure clear of the stools; Hollow's dark: his art, the beats, the drain 15% faster, the
  table before the charge, no figure moving and nothing appearing once the drain starts, the dark and the dim light, his channel line,
  every cue a sound, the cave's lights as ever without an intro), `packages/app/test/shop-hollow.test.ts` (his intro's moves on the
  ice, clear of his stool and the rock), the storm's edge, the wipe, back to where you stood), `packages/server/test/town-chat.test.ts` (the lines and the no-spam rule, and
  through the API), `e2e/boss-challenge.spec.ts` (phone and computer: Alfil, a quit then a finished challenge and the lines; Babur's
  default intro and back; Big Boy's own intro and back; Timber's own as an admin and back; Dash's own as an admin and back (his line, the four dashes in order, each thing only from its
  toss, off four times, nothing missing from the stools on, nobody moving, the clock rush); Hollow's own and back: in to your seats, his line,
  the table while it's lit, his channel line, the lanterns one by one, the string, his strand, the black, the dim light, the iris, the
  dark lifting off the battle, nobody moving and the table there throughout the drain), `e2e/shop.spec.ts` (Alfil's Pyramid's, Big Boy's Crib's and Dash's Kicks' crates), `e2e/town.spec.ts` (a boss without an inside, Folio: the
  Boss raid screen).

## The street town (Nov 5, round 2: admins only; everyone's since Nov 13)

The street town was an admin's town only (`STREET_TOWN`, gone Nov 13) until it became everyone's town on Nov 13. Eric approved its art and plan Nov 5 (`claude/boss-art` 11a4d903).
- **From the plan:** `town/street-plan.json` (the art's `town-plan-nov5.json`, as made) read by `town/street.ts`; `world.ts` builds
  the ground (the streets are the board, their sidewalks paving, the park's walks and lawns, back gardens, lots, the Colosseum), the
  props (trees, benches, lamps, the twelve tables, the fountain, hedges, bushes, beds, sheds, and every everyday building's front),
  the start (22, 11) and the homes on their lots from it. Still 46 × 46 and wrapping.
- **The art:** `town/town-kit.ts`, `buildings.ts`, `home-boxes.ts`, `dressing.ts` (copied in, imports moved). This round draws fronts
  only (`building(...).front`, the homes' own pictures), each on its lot's front line; Seam Avenue's stand in facing the camera.
- **Walking:** the streets, sidewalks and park, round everything standing there. A tap on a home (or its plot) walks you to its door
  square (`Home.door`) and opens its card; an arrow into its lot opens it too. A boss walks its own wander box (`Home.wander`) out
  from its rest square (`Home.rest`) and back, passing a lamp, stopping only there. The bots walk the streets, sidewalks and park
  off every boss's box; a sidekick goes home through its boss's door (`Home.entry`).
- **The camera:** faced north everywhere in round 2 (round 3 turns it on Seam Avenue: below), and opens zoomed in (`streetStartZoomedOut`). Fronts nearer the camera than
  its focus less `streetNearCut` aren't drawn, trees there fade (`streetTreeFade`), and a figure fades before the box's foot or side
  would cut it (Eric, Nov 4).
- Tests: `packages/app/test/town-street.test.ts`, `e2e/town-street.spec.ts`. Decision:
  [2026-11-05-street-town-layout.md](../decisions/2026-11-05-street-town-layout.md). Stills: `docs/street-town/`.
- **Round 3 (Nov 5): boxes and the turning camera.** Every building is a box as the art drew it (`town/boxes.ts`: where each stands,
  the sides a neighbour at least as tall covers (skipped), the roof faces' geometry and light, each frame's plan; `town/box-draw.ts`:
  each roof painted once a heading; `render.ts`: a front, each side, the back and the roof sorted by their own depths among everything
  else, the roof's faces far to near). The camera faces north everywhere and east on Seam Avenue outside its four crossings
  (`town/turn.ts` `camAt`, the square you're on), easing over `streetTurnMs`; `camera.ts` turns every world point through the view's
  heading (`setHeading`, `toCam`, `rel`; `forEachSquare` lays the ground from a turned grid). Taps, the arrow keys (`screenStep`: up is
  up the screen) and the drag go through it; the clouds slide, the sun stays; the far Colosseum shows within 45 degrees of north. Seam
  Avenue's fronts face west. A home's floating name sits over its own roof, dropping toward its eave off the buildings behind. Both
  WebGL draws it (Nov 6: no 2D fallback, so its walls take fine strips and its domes every face). Nov 6: the box path goes through the 3D art kit (`town/kit/`: prims, bake, draw; models as data): roofs and walls lit as palette
  ramp steps with a 1-texel ink edge, every pixel a palette color ([2026-11-06-3d-kit.md](../decisions/2026-11-06-3d-kit.md);
  `packages/app/test/town-kit.test.ts`). Numbers in `feel.ts` (`streetTurnMs`, `streetTurnClouds`, `box*`, `nameOverRoof`, `nameDropStep`). Test hooks: `__townCam()`'s
  `heading`, `figures`, `boxes`; `__townHeading(deg | null)` holds the heading (the turn's stills). Tests: `packages/app/test/town-boxes.test.ts`,
  `e2e/town-street.spec.ts` ("the boxes and the turn"; a lost context). Decision:
  [2026-11-05-street-town-boxes.md](../decisions/2026-11-05-street-town-boxes.md). Stills: `docs/street-town-boxes/`.
- **Round 4 (Nov 5): joined rows, the chase camera, the town wrapping east-west only.**
  - **The plan** (`street-plan.json`, from the art's by `scripts/street-plan-north.py`): its `wrap` switch, `{ ew: true, ns: false }`
    (`camera.ts WRAP`, `wrapFX`/`wrapFY`, `colI`/`rowI`: -1 off the world). The Colosseum at the north edge in its plaza; South Street
    (the art's Seam Street) the bottom street, a closing row south of it; Seam Avenue ending at Upper Street. The start is (22, 17).
  - **The rows** (`town/rows.ts`: each side as data; `lookalike.ts`: the look-alike fronts and the skyline's towers; `street.ts`
    `withRows`, `homesOn`):
    - every street's built sides are continuous rows; the homes keep their lots (sliding along a row to fit its end);
    - look-alikes of 1 to 3 squares and slim fillers fill the rest, each butted 1 px under its neighbours;
    - corners turn onto the cross street; flat fronts away from corners; rear walls seen from behind;
    - the tall lots are towers over the rows.
  - **The camera:**
    - the chase camera (`turn.ts chaseTarget`; down steps back without turning, left and right turn you);
    - five zoom steps (`feel.ts streetZoomSteps`; `zoom-steps.ts StreetZoom`): in, the mockup's, out, the overview and, since Nov 13, the old town's zoomed-out camera, the farthest ([decision](../decisions/2026-11-13-town-farthest-zoom.md));
    - the park's step out (`parkZoomOut`).
  - **Drawing only what the rows let you see:** `seen.ts`, at the in and default steps (`streetCull`).
  - **Smaller fixes:** a home's name only with its home; slanted sign lettering snapped.
  - **Test hooks:** `__townCam()`'s `zoom` (the step), `parkBefore`, `horizon`.
  - **Tests:** `packages/app/test/town-rows.test.ts`, `e2e/town-rows.spec.ts`, and round 3's moved to the plan
    (`town-boxes.test.ts`, `town-street.test.ts`, `e2e/town-street.spec.ts`).
  - Decision: [2026-11-05-street-rows.md](../decisions/2026-11-05-street-rows.md). Stills: `docs/street-town-rows/`.
- **Round 5 (Nov 5): one fixed view, a look round, the Colosseum against the back wall.** Round 4's chase camera is gone.
  - **The view:** the camera faces north whatever you press. On a boss home's front strip (`town/strips.ts`: the sidewalk squares
    before its front) it faces that home's front, easing over `streetTurnMs`; every shipped home faces south, so that's north too.
  - **The arrows** are screen directions (through the strip's view on one).
  - **A drag looks round** about your pawn (`turn.ts LookAround`: `streetLookPerWidth`, `streetLookBackMs`): letting go keeps it, and
    your first step eases it back. The arrows stay the normal view's.
  - **The plan** (`scripts/street-plan-north.py`, its round 5 section):
    - a grove beside the Colosseum and along the back two rows, not walked on;
    - a wall with a closed gate either side of it on its front line, and the back wall on the north edge (`town/wall.ts`, lots of kind
      `wall`);
    - the back rows' four skyline towers gone.
  - **The Colosseum's street picture** (`houses/coliseum.ts HOUSE_COLISEUM_STREET`) leaves out its two floating back pawns.
  - **Test hooks:** `__townCam()`'s `headingBase`, `look`, `strip`, and each box's `x` and `y`; `__townYou()`'s `way`;
    `__townAt("tap-square", …)`.
  - **Tests:** `packages/app/test/town-fixed.test.ts`, `e2e/town-fixed.spec.ts`.
  - Decision: [2026-11-05-street-fixed-view.md](../decisions/2026-11-05-street-fixed-view.md). Stills: `docs/street-town-fixed/`.
- **The north edge (Nov 5–6): one back line, Meadow Street, the Colosseum as a solid, the centerpiece of the back wall.**
  - **The plan** (`scripts/street-plan-north.py`, its north edge section): 54 × 54. A back wall on the line y = 43.5 the whole way round,
    meeting the Colosseum's flanks, a gate either side of it (columns 13–16 and 29–32: an open arch with the crown's crest, not walked
    through); nothing walks or stands north of it but the ring and the trees behind the gates (the meadow, ground only). Upper Street is
    gone: its four homes stand on **Meadow Street** (rows 4–6, three wide so South Street keeps its south sidewalk), new south of South
    Street.
  - **The plaza** (rows 40–43, columns 13–32) is open to Colosseum Row; its statues and chess pieces stand on it as figures (props
    `statue`, `piece`), fading out when nearer the camera than you.
  - **Boss homes are never neighbors:** a whole look-alike between any two, none narrower than `rows.ts ROW_MIN_W` (1 square).
  - **The Colosseum** (`houses/coliseum-shape.ts`, `houses/coliseum-ring.ts`): 18 ring boxes (kind `ring`) round its oval and a portal
    (kind `portal`, the Colosseum's place's picture), drawn 1.2x (`COL_SCALE`) from any heading; never cut by `streetNearCut`; its bowl
    left out below its rim; no line of sight.
  - **Moo's and Ginger's homes** 1.3x (`TOWN_FEEL.streetHomeScale`, `rows.ts homePx`).
  - **Test hook:** each box in `__townCam().boxes` has its front's drawn foot (`foot`: its ends on screen and the world points they stand
    for).
  - **Tests:** `packages/app/test/town-north-edge.test.ts`; `e2e/town-fixed.spec.ts` (the plaza's look round, the Colosseum staying put
    as the view turns), `e2e/town-street.spec.ts` (Meadow Street's cards).
  - Decision: [2026-11-05-street-north-edge.md](../decisions/2026-11-05-street-north-edge.md). Stills: `docs/street-north-edge/`.
- **Controls and the minimap (Nov 5, after round 5).** Still the admins' street town only.
  - **Three gestures** (`town/press.ts`), told apart by the drag threshold (`dragPx`) and a hold time (`feel.ts streetHoldMs`, 180 ms;
    timed from the pointer's own event time): a quick tap walks; a press that moves past the threshold first looks round; a press held
    still runs.
  - **Hold to run** (`town/run.ts`): the way from your pawn to the finger on screen, snapped to up, down, left or right of the view,
    held as an arrow is (`arrows.ts hold`), so it is the arrows' walk (the same pace, the same card at a door). Moving the finger changes
    the way and never turns the camera; letting go stops you at the next square. Mouse: the left button.
  - **The base heading** (`Town.tsx base`, `turn.ts lockIn`): a look round let go within `streetSnapDeg` (10°) of a quarter eases
    there (`streetSnapMs`) and is snapped; a tap's walk or a run next locks it in as the normal heading off a strip, which the arrows,
    the screen step and runs follow. Not snapped, or an arrow first: the first step eases back. The town opening and a building's in and
    out reset it to north (`freshView`); a home's strip turns the view but leaves the base alone.
  - **The opening zoom step** is the third (`streetZoomStart` 2, Eric: "number three"); the park's step out goes from there to the
    overview, never further (`streetZoomParkMax`). The rows' culling stays at the in and mockup steps (`zoom <= 1`).
  - **The minimap** (`town/minimap.ts`, `TownMap.tsx`), built from the plan's data (`street.ts`: ground, lots, walls, park,
    Colosseum): small at the box's top right (`mapShare` 26% on a phone, `mapShareComputer` 13% in a computer's frame, at most
    `mapMaxPx`), `mapOpacity` 0.7, rounded; under the chat where the chat takes the whole top (a narrow frame). Drawn once a size to its
    canvas; each frame only your dot's transform moves (`MapDot`, `mapFrame`). The map button (`TownChatTools`) turns it off and on,
    stored per device (`brc.townMap`, on by default), grayed inside a building. A tap opens it large in the middle (every boss home's
    chip portrait, the park and Colosseum icons, your dot; no names); a tap anywhere closes it. A tap on a boss's portrait or its home's
    block (within 2 squares of its middle, the nearest) also walks you to that home as a tap on it in the town would, by its door, with
    no card (Nov 11, `walkHome`; [2026-11-11-map-walk.md](../decisions/2026-11-11-map-walk.md)). The chips and `pick` keep off its box
    (`MAP_BOX`).
  - **Test hooks:** `__townCam()`'s `base`, `snapped`, `gesture`, `run` and `you` (your pawn's drawn box).
  - **Tests:** `packages/app/test/town-controls.test.ts`, `e2e/town-controls.spec.ts`.
  - Decision: [2026-11-05-street-controls-map.md](../decisions/2026-11-05-street-controls-map.md). Stills:
    `docs/street-controls-map/`.

## Frame-rate pill (`?fps`)
`/town?fps` shows anyone (Eric, Oct 30: no admin needed, the site is behind Cloudflare Access) a pill in the world's top-right corner, "60 fps · 16.7 ms · 2D": frames over the last second and their mean time, text set twice a second from plain counters in the frame loop, then the drawing's backend ("· WebGL" in the street town; added by town.css from `data-backend`, so the pill's text stays the numbers). Without `?fps` there is none. `?crowd=N` is anyone's too (only that device draws the pawns). Since Nov 11 the count is shared (`FpsCount`, `FPS` in `frame-report.ts`): the town's frames and a room's both tick it, so inside a building it reads the room (before, it stood still on the town's last reading there, and its first two readings out divided the frames from before you went in by the whole visit: Eric's "42-44 inside, 2-4 going out", Nov 11). A hidden tab restarts it; the black between the town and a room doesn't (that wait is real).
`?fps`, `?report` and `?crowd=N` are read once as the page opens (`TOWN_ASKED`, test-switches.ts), so a later replaceState can't lose them; they apply as the town opens.

## Frame report (`?report`, Nov 11)
`/town?report`, anyone's: from your first move, every frame for 30 s (or until **Done** on the pill at the top) is recorded in typed arrays made once (`town/frame-report.ts`; `REC` null without it, so the marks in `Town.tsx`, `render.ts` and `paint-gl.ts` are null checks): its time, the time of each part (logic, camera, sky, ground, placing and sorting, buildings, props, bosses, you, other players, lights, labels, WebGL submit, chips, minimap, and wherever they happen new pictures painted, sight lines and texture uploads; the rest is "outside our code": the browser, the GPU, garbage collection), and what was happening (walking, turning and how fast, zoom, pictures painted, uploads, an atlas reset, a long gap). Then one panel the size of the box to screenshot (`frame-report-panel.ts`): device, fps median / 5th / 1st percentile, the mean and worst ms a part, all and split by walk / turn / load, where the most time went, the worst 10 frames. The chat does no per-frame work. Hook `__townReport()`; tests `packages/app/test/town-frame-report.test.ts`, `e2e/town-street.spec.ts`.
**Rooms (Nov 11):** a room's own loop (`shops/ShopRoom.tsx`) records into the same run, its parts under the town's names (ceiling and what's past the walls: sky; floor: ground; sorting: placing; pieces and the fight's set: props; you, the boss, everyone else; glows and darks: lights; tags and bubbles: labels; the card: chips), each frame marked "in a room"; from a home's Go in until the room's black lifts the frames are "going in", from Go out until the town's zoom ends "going out" (`REC.door`, set by `TownScreen`). Two columns more: **Room** and **In/out** (Walk, Turn and Load are the town's own frames); a room's first frame is recorded with the wait before it (the room's art painting behind the black on a first visit), not dropped as a pause. The pill's seconds come from the recorder (`FrameRec.onSec`), so they count on inside a room too (Nov 11: they were set by the town's loop alone, and Eric saw the report "pausing" as he went in). Tests: the same unit file, "rooms, and going in and out"; `e2e/shop.spec.ts`, "?fps in a room" and "a room's report records while walking".
**The loading screen (Nov 11; [decision](../decisions/2026-11-11-town-loading.md)):** the street town opens on "Building the town…"
(`.town-loading`, the boss loading card's look, its bar real progress: half painting, half uploading; `Town.tsx` `loadTown`,
`f.loadSliceMs`, `f.loadPaintShare`, `f.loadSheetWaitMs`). It paints every picture (`render.ts` `warm`) and uploads them for good
(`paint-gl.ts` `keep`, `kept`: tallest first, the atlas made once as deep as they need, plus 2 spare pages for tags, boards, the
bubble, signs and text, the only ones that start again). Then the frames start. Measured headless at 1x: 4.5 s (painting 4.3,
uploading 0.2); slowed 4x: about 21 s. 10 kept pages, 12 in all (192 MB). After it, 30 s of walking and turning: 0 painted,
0 uploads, 0 resets. A building in and out uploads nothing of the town. The town's 2D pictures are made in memory (`paint.ts`
`art2d`): uploading a GPU canvas waits for the GPU. Hooks: `__townPaint()`'s `loading`, `loadMs`, `loadPaintMs`, `atlas`. Tests:
`packages/app/test/town-atlas.test.ts`, `e2e/town-street.spec.ts` ("the town's loading screen…").
**Its music step (Nov 12; [decision](../decisions/2026-11-12-music-mono-preload.md)):** from the bar's start every boss theme is fetched
beside the painting (`music.ts` `preloadMusic`: fetched, never decoded); with Music on the town takes the bar to 85% and "Loading music…"
the rest (`MUSIC.townShare`), only for what hasn't landed once the town is built, at most `MUSIC.townWaitMs` (3 s; then the town opens and
the rest lands behind it). Music or Sound off: nothing fetched, no step. Hook: `__townPaint()`'s `loadMusicMs`. Test: `e2e/town-street.spec.ts`
("the town's loading fetches every boss theme once").

**Painting ahead (Nov 11):** each frame `planBoxes` paints, nearest first, the pictures of the boxes in reach: always the faced quarter's roofs and the sides' and backs' pictures (and shaded steps), mid-turn the next quarter's roofs (`boxBakeMs`, 1.5 ms); standing still, also the fronts' shaded frames and the other quarters' roofs (`boxBakeStillMs`, 4 ms, while the view is at rest). Before, a first look round painted hundreds of them as they showed. [Decision](../decisions/2026-11-11-town-frame-report.md). (Since the loading screen, it finds nothing left to paint.)

## The feel: `town/feel.ts`

Every number that shapes how it feels is in `TOWN_FEEL`, one line each: the walk (90 ms a square, the hobble), the rides' feet and shadows, the camera
sets, the zoom, the camera's follow and glide, the drag, the haze, the clouds' parallax, how often bosses roam and talk,
how often bots walk, the sizes, the names, the sky's hours and its four looks' colors, the lights at dusk and night (`lightsAt`, their glow's bands, the flicker), the rim line. The earlier value is
noted wherever a slice changed one.

- **The Hidden Boss's child's room (Nov 12, a mockup; since Nov 13 the Walk-up's top floor: "The Walk-up" above).** A 12 x 12 room (`shops/recluse-art.ts`: oak boards
  and the window's sun baked into the floor, a braided rug, sailboat wallpaper, a rocket poster, the bed, the rocking horse, the little
  table) drawn by the real room: `loadRoomWith(key, def, art)` loads a room no home lists, and `ShopRoom`'s optional `fx` (`RoomFx`:
  figures sorted by row among the pieces and you, a pass over everything, `hideYou`) lets a caller draw its own scene; no `fx`, no
  change. The scene (`shops/recluse-scene.ts`): the child (age 9, `recluse-ages.ts` `RECLUSE_CHILD_SIT`) plays his 1956 game against
  himself on a board on the floor (`shops/recluse-game.ts`, stored squares, no engine; the last move tinted, a fade back to the start),
  and the summoning with four stand-in pawns. Times: `feel.ts` `HIDDEN_ROOM_FEEL`. Seen only on the dev server,
  `/hidden-room-preview.html` (`src/dev/hidden-room-preview.tsx`; `?t=`, `?summon=`, `?ui=0`). Test: `test/recluse-room.test.ts`.
  [2026-11-12-hidden-boss-room-mockup.md](../decisions/2026-11-12-hidden-boss-room-mockup.md).
  **Round 2 (Nov 13):** 9 x 9 (about half the floor), everything brought in (the bed's foot just onto the rug, the sun's panes across the
  rug), the door at the front's east end; a 1.15-square board. He plays Black seated (a lean, a short reach) and walks round for every
  White move, kneeling beside the board on the piece's side (`recluse-game.ts` `stepsOf`, `walkPath`; `recluse-ages.ts` `PLAY_POSES`:
  standing, walking, kneeling, from the front and behind); the game takes about 14 minutes. In this room only, each side wall is one
  surface (`sideWallGrid`, the scene's `drawSideWalls`: about 70 affine strips a wall, the layout's side squares solid blanks);
  `?walls=cards` shows round 1's cards; `__hiddenSeek(ms)` jumps the game for stills.
  [2026-11-13-hidden-boss-room-r2.md](../decisions/2026-11-13-hidden-boss-room-r2.md).
  **Round 3 (Nov 13):** the board sideways (White's rank 1 on our left, the a-file farthest). For every half-move he walks round
  behind the board (never between us and it) to that color's side and sits back on his heels centered on it, side on to us; to play
  he comes up on his knees and leans in (`recluse-ages.ts` `RECLUSE_CHILD_SIDE`, `SIDE_POSES`: five leans, four dips toward us, a
  4-step side walk; mirrored for Black's side), shuffling up to a quarter square toward the move's files and back. `recluse-scene.ts`
  `leanFor` picks each move's pose so his reach is short; his arm is two fixed lengths jointed at the elbow (`drawArm`), longer only
  when straight; the test holds every move under half again his arm (worst about 1.07; on screen 1.08 computer, 1.13 phone).
  [2026-11-13-hidden-boss-room-r3.md](../decisions/2026-11-13-hidden-boss-room-r3.md).

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

- `packages/app/src/town/`: `TownPage.tsx` (the lazy load, and on a computer the frame round it), `Town.tsx` (the screen, the loop, input, chips, cards, the sky's
  clock, the statues' close-up, the backend and its fallbacks), `press.ts` (a finger as a button), `camera.ts`, `world.ts`, `render.ts`, the street town's `street.ts`, `turn.ts`, `boxes.ts`, `box-draw.ts` (and the art's `town-kit.ts`, `buildings.ts`, `home-boxes.ts`, `dressing.ts`), `paint.ts` (the drawing layer; Canvas 2D),
  `paint-gl.ts` (its WebGL 2 backend), `you-look.ts`, `rides.ts`, `ride-cells.ts` (the rides' views measured, generated), `sky.ts`, `sky-draw.ts`, `sign-font.ts`, `feel.ts`, `town.css`, `chat.ts`, `TownChat.tsx` and `town-chat.css` (the chat log), `houses/`
  (one file per home, fourteen in all, the Colosseum's `coliseum.ts`, the park's `park.ts`, the kit of shared pieces and the index),
  `sidekick-sheets.ts` and `sidekicks/*.png` (the sidekicks' baked frames, generated), `CardIcons.tsx` (the card's crossed swords and
  rating bars, inline SVG), `shops/` (inside a shop: `shops.ts` which homes and the crate's words and the buy stub, `room.ts` the room's
  walking, `ShopRoom.tsx` the room, `babur-art.ts` and `puddles-art.ts` the rooms' art; the Walk-up's: `houses/recluse.ts`, `shops/recluse-stairs-art.ts`,
  `recluse-art.ts`, `recluse-scene.ts`, `recluse-game.ts`).
- The sidekicks' art: `packages/app/src/characters/sidekicks/<boss>.ts` (one `Character` each, `sidekick-<boss>`, copied
  as drawn from `claude/boss-art`), baked by `scripts/bake-sidekicks.ts` (`npx tsx scripts/bake-sidekicks.ts`).
- References: `docs/mockups/town-square/` (the prototype Eric tested, and the pictures for the homes: Eric's for the
  igloo, the peak and the meadow, his suggestions for seven more). Alfil's Pyramid has no picture: it's our design.

## Tests

- **Tapping in the street town from a spec (Nov 13):** `tapInTown(page, kind, id, card)` in `e2e/helpers.ts` opens a figure's or a
  place's card. It waits until the view holds still over 3 drawn frames (`townTapPoint`), glides there once if the target is off the screen
  or covered, and taps with the press and release together (`quickTap`). Read a point mid-glide, or a separate `page.mouse.click`, and
  the tap fails on CI's software WebGL ([2026-11-13-street-town-taps-on-ci.md](../decisions/2026-11-13-street-town-taps-on-ci.md)).
- `e2e/shop.spec.ts` (Nov 2, inside a shop; phone and computer): Babur's card's "Go in", inside zoomed out (+ and − switch to Close and back), a tap
  on the Shopkeeper walks you up and its card's Talk opens "Babur's Boss Crate" (the price line, Balloon Pup, what you have, both buys
  greyed with nothing to pay), the header saying "Babur's Circus", then the view dragged back to the door, "Go out" and you're outside
  at the tent's door ("Town square" again); Puddles' greenhouse: Drizzle's crate with Puddles's Mower, and the back button takes you out.
  Round 2: an admin's test grants and both buys, the counts following and the card not growing (shop.md, "Boss tokens"); since Nov 2 the
  crates bought go into the inventory and are opened there with the usual strip. Nov 2: the home card's "Go in" alone; the chat's tone
  in each room (Babur's by day outside, Puddles' by night); a drag inside follows the finger as the town's, a finger and a mouse. Unit:
  `packages/app/test/shop-room.test.ts` (both rooms' walls, counter, pieces and pond solid, the way out, every free square reachable,
  the talking range and where a tap on the Shopkeeper sends you; the crates' words; a way's button needing its price; the buy going
  to the server).
- **The street town's specs run on WebGL** (Nov 6; town-street, town-rows, town-fixed, town-controls, once each): their pixel reads
  work because a WebGL canvas's `getContext("2d")` gives the last frame's pixels under the test switches (Town.tsx's `shim`).
  Headless WebGL is software (SwiftShader, about 14 to 20 fps), so their timeouts are longer. Today's town's `?gl=1` and its
  CI jobs are retired.

- `e2e/town-desktop.spec.ts` (Oct 29, the town on a computer): at 1280 × 800, 1440 × 900 and 1920 × 1080 the town's box is home's `.fd-center`
  (within a pixel), the menu and the right column are home's with the global chat showing, Chess Town is marked, no bar (Nov 7): the chat icon
  and the gear centered in the right column's slot under TOWN, the world fills the box, the buttons keep
  their corner and the chat box its place, the chips and an open card are inside the box and the page doesn't scroll; the side menu's Play and
  Chess Town go home and back; the center column, the menu and the right column keep one box each while the town loads; a 900 × 700 mouse
  window has the whole screen and both icons at the right; and phones (390 × 844, 430 × 932) and tablets (768 × 1024, 1024 × 768 touch) have
  main's boxes (taken at 5e70aeed) for the screen, the bar, its four buttons, the world, the controls and the chat box, and no frame.
- `packages/app/test/town-camera.test.ts`: the projection (the focus in the middle column, wrapping both ways, a tap picks
  the square drawn there, far squares shrink, zooming out shows more rows, the phone / computer blend, a table's board
  fitting its picture on every row of the screen: never more than `tableBoardGrow` its foot's scale, unchanged where it
  always fit), the layout
  (fourteen homes 8 to 10 squares from their nearest neighbors, none near the start, the Colosseum's ground and the park
  clear, and the start south of it on the park's promenade), the walk around a home, and the eased steps meeting the even ones at the same speed.
- `packages/app/test/town-rides.test.ts` (Oct 31, rides; Nov 1, sizes; Nov 1, every boss's with views and trails): every ride item
  has its drawing (its name and line the drawing's) and its measured views, every drawing is a ride item; all but Moon's Ride have a
  back, a front and a trail inside the art's limits; the cells are each drawing as drawn now (the hash: run
  `npx tsx scripts/measure-rides.ts` after a change); every ride 0.75 by one default, Cheetah Shoes' speed 2; in each view a rider
  stands its ride's feet on the square's middle, its tag over the higher of the ride and its pawn, its times and lift the view's; from
  behind it carries the pawn without its face items; at a size, the ride scaled about its saddle, the pawn its size on it, the ride on
  the square (every view, and its trail mark); its idle on its own times, its move one cycle a step in its drawn shares, its trail on
  the mark's times; a walker's step progress and its view (side, back walking up, front walking down, kept standing); a step's time
  settable (the shoes: 45 ms); (Nov 1, rides lazy) the measured numbers are each drawing's (tile box, every view's frames, trail), and
  only `load.ts` imports a drawing, never statically; riders who look the same share one set of frames, freed by the last one out and by the town's close; a
  rider whose pictures don't come is forgotten, so the next one makes them again.
- `e2e/town.spec.ts`, "rides (Oct 31; Nov 1, every boss's)" (phone and desktop): wearing Riding Chirp, nothing is fetched for it but
  its drawing's chunk;
  standing, its idle frame after frame at 0.75; a tap on the square beside you walks you there, either way (the square read once the
  camera has settled, the bots standing still: Nov 1, the fix for main's flaky "beside you"); walking up, right, left and down: its
  back, its side facing each way and its front (watched every frame; back and front never mirrored), the idle of each view standing;
  its prints in all three directions and never the droplets, none once you stand; your tag over your head; test players on Moon's
  Ride and Cheetah Shoes drawn riding (the shoes' steps 100 ms), Moon's tag over it; with `?rideScale=1` your ride as drawn, your tap
  box as wide, the picture taller, your head higher, the tag over it; Cheetah Shoes worn, your step 45 ms.
- `e2e/town.spec.ts`, "rides lazy" (Nov 1, phone and desktop): Riding Chirp's chunk held back, you stand on foot in the box and under
  the tag your rider will have (`__townRide().you.coming`); let through, the ride appears there: the tap box and the tag unchanged.
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
  The turns (Oct 28): ten out, ten in the world all along, the ones out standing in the square; one sent home a minute,
  only on the minute; rounds of ten (every bot out once before any twice), never sent within 90 s of coming out; busy bots
  (held, seated, on their way to or from a game, near you, just out) passed over and still due, the held one next once
  free; the one home longest comes out next, as the other gets home, never the same; a sidekick to its boss's door and a
  pawn to the gate, fading out there over `botFadeMs`, and the next fading in at its own door and walking to the square;
  a bot going home held by its card and carrying on; one you play stays, and never goes while seated across from you.
  The testers' crowd (`addCrowd`: at most 100, named, wandering, not counted in the turns).
  `packages/app/test/town-bot-game.test.ts`: the game (its name and rating, the loading step before the vote, casual; a
  sidekick's face on its strip).
- `packages/app/test/town-lights.test.ts`: the park's lamps (8 to 12, solid, on paving, off every path, every square and
  stool still reached, a pawn and a half tall, lit glass with a halo and a pool), every home's and the Colosseum's light
  spots inside its picture and off its sign (Hollow's green window untouched, none near the statues), and when they shine
  (off at dawn and day, on at dusk and night, following the blend).
- `packages/app/test/town-chat.test.ts` (Oct 28; v2, v3 and v4 the same day): the line only you see (`tooSoonText`'s seconds rounded up, "1 second";
  `whisper`: gray system line, one at a time, gone after its time), the name palette (ten to twelve deep/light pairs, random picks, the
  device's number or a steady one, riding on the line) and the sky's tone (`townTone`: day, dawn, dusk ink and night white, flipping at 5:30 and 19:30,
  `?sky=`); the time's format (12-hour, no am/pm); the three modes (their
  order and cycle, always on, new messages and off; the icon's and the sheet's words; remembered on this device and read back after
  a reload, a stranger or a blocked storage meaning always on); **"Chat background"** (its words, off to begin with, remembered and read
  back after a reload, a stranger or a blocked storage meaning off, told to whoever shows it); **what each mode does** (always on never
  fades, after the wait or minutes on; new messages fades `fadeAfterMs` after a message, not before; typing in new messages, `talk`: every
  line and no fade until you finish, then the fade, the next burst only its own; `chatBlurs` over every mode, shown, typing and setting);
  **the history** (5 minutes and 100 lines, the server's and the device's numbers in one place; a line 4 minutes old still there and gone at
  5; the oldest dropped first past 100, the private lines counting; the next line's time timed after one goes to the cap); the log
  (the fade after `fadeAfterMs` and a message bringing the box back; always on showing every line, new messages the burst on show, off
  none; a tap bringing back every line, a poke while reading, the fade again, the next burst only its own; held; `say` from every kind; when
  it tells the screen); the stream pinned to its foot unless scrolled up (`Stick`:
  the "↓ new" count, back at the foot); the chatter table (every boss with a home: two lines, its kid one or two, all under 60
  characters, never the Hidden Boss, anyone but who spoke last, all 28 reached, every 20 to 45 s); players' lines (who said them and
  their number, `unsay` by number or by player, a tap reaching the menu; the server's numbers); the box's place (`clampBox`: inside
  the map, off the buttons; stored and read in a try/catch).
- `e2e/town-chat.spec.ts` (phone and desktop; the chat log): the box flush in the top left (8 px in) with its size per platform, a
  line's time and bold name colored by kind (a player's from the palette), nothing behind or round the text until you type (computed: no
  background color, image or gradient, border, outline, box-shadow, text-shadow, backdrop, mask or filter on the box, the blur's `.tc-back`,
  the stream, a line, a name, the typing line and its placeholder), ink by day, the lines from the box's top and the newest last above the
  strip, no box round the typing line, no bar under it and no send button, no "Say something…" anywhere, two lines then "…", the box unchanged
  and never fading always on; **the stream taking touches itself** (`pointer-events: auto`, `overflow-y: auto`, `touch-action: pan-y`; the
  point over its empty part is the stream's) and scrolling back to a line 4 minutes old by finger (a phone, CDP touch events) and by wheel (a
  computer) with the map under it not panning or zooming, a line 5 minutes old gone, the wheel off the box still zooming the map; 100 lines
  at most; **a tap on the box anywhere but a name opening typing** (the blur behind the whole box with a slight blur and a faint light tint,
  a focused typing line with no placeholder at the box's foot, no line moved, the box unchanged, the map not seeing the tap; Escape and a press
  on the map closing it and keeping the words; a name's tap the menu's, a text tap typing's; Enter sending and closing it); **typing works wherever the
  box shows** (always on; new messages while the lines show; off has none; Off stays off; the faint hint on the foot line while the box shows
  and you aren't typing, gone while you type and with the box: Eric's rule, changed Nov 12); **Nov 12**: a second player entering shows "Bo
  has entered the town." to the first (gray, upright, no name, its tap opens typing), the hint in line with the "[" within 2 px, thin and
  faint, hidden while typing, and the computer's framed box 190 px; "Chat background"
  (off by default; on, the blur stays behind the box with nothing typed, in always on and new messages while they show, remembered across a
  reload, a faint dark tint by night); **always on never fading** (`page.clock`: after the wait, minutes on, the lines still taking touches, a 4
  minute line there, a 5 minute one gone); the text's colors by sky (ink by day, dawn and dusk, white by night, the names' and gray lines' shades,
  no backing in either) and flipping with the device's clock (`page.clock`, 19:30 and 5:30); the stream pinned to its foot, staying put when
  scrolled up with "↓ new" (its tap, and the foot by hand, giving it up); new messages (the lines showing with a message and fading after
  the wait, not before, the stream the same as always on's, the box unchanged, a faded box taking no taps, the next burst only its own lines, a
  tap on a line opening typing as "high text": every line, no fade, scrollable, the icon unchanged, fading after Escape; sending from there;
  a name's tap the menu's); the header's icon (never over the title, on its line: at the right end on a phone, right after the title on a computer; always on (both bubbles green), new messages
  only (the top one), off (none) with the bubbles' colors and
  the accessible names; off hiding the box and the lines that came meanwhile showing when it's on again; remembered
  across a reload) and the gear's "Town settings" sheet (the chat's three radios, "Chat background" as a switch with its line under them, setting
  the mode, closed by Escape, its X and a tap outside); the typing line for a signed-in player (80 characters, the count shown whole, one every
  15 s, a try inside the wait giving the gray "Sorry, you can't send another message for N seconds." line and nothing sent to the server, your line
  back from the server as a player in a palette color, the same all visit, Enter sending and closing typing); a greyed line with the reason for a guest
  on a tap; press and hold moves the box (remembered across a reload, never over the buttons or off the map), a tap on it opens typing and a drag
  without the hold neither moves the box nor the map; the chips keep off the box (always
  on and new messages, shown, faded or moved over one of their places) and use its space with the chat off; the keyboard doesn't
  resize or move the town (the visual viewport's offset stood in). Players' messages (its players are made signed in in the local
  database, `asSignedIn` in `e2e/helpers.ts`): two signed-in players see each other's lines within a few seconds, with each name bold
  in the same palette color on both screens, a guest none (greyed line, never asks); a refused message's reason as a gray line only you
  see (a swear word, a link, a phone number; one at a time, your words kept), 80 characters and the 15 s
  wait on the server; a line's menu (your own: Mute and Report greyed; Report reaching fair play's case page with the line; a
  moderator's Remove leaving every log; Profile over the town and back; Mute hiding the player); the switch off ("Chat is
  paused.", the chatter going on); the privacy page's two 5-minute sentences. Only each test's own lines are counted: other tests' players share the room.
- `e2e/town-chat-history.spec.ts` (a phone since Nov 2: the wait is the same on a computer; real time, its own file so it runs beside the others): a line another player said is still on
  the screen 4 minutes later, Report reaches fair play with it and a moderator's Remove takes it out of every log (the room holds 5 minutes).
- `packages/app/test/town-tags.test.ts` (Oct 28, name tags): the near rule's alpha at 4, 4.5, 5, 5.5 and 6 squares (1, 1, 0.5, 0, 0; a straight line between, never rising with
  distance; its numbers are `feel.ts`'), the smaller of it and the far fade, your tag / an open card's figure / a table partner always shown (at any distance), "Everyone"
  taking no near rule; the "Names" setting (its words, near to begin with, remembered and read back after a reload, a stranger or a blocked storage meaning near); the
  kinds' colors (white and gold as they were; the sidekick's blue with white text at 4.5:1 or more, over white, black, sand, grass and a night backdrop) and the cache keyed
  by name, size and kind (a sidekick's blue and a pawn's white of one name and size are two drawings; the least lately used goes, never one drawn this frame or the last).
- `e2e/town-tags.spec.ts` (phone and desktop; `?crowd=50`, `__townTags()`): a far figure has no tag in Near you and has one in Everyone (the near ones keep theirs), a near one
  has one, yours is always there; a sidekick's tag is blue with white text, in `__townTags()` and in the pixels on the canvas; the sheet's "Names" under Chat with its two choices and
  its line; the setting survives a reload; a tag fades (frames between 1 and 0, never rising) as you walk away from a held figure and is gone past the radius, and a figure whose
  card is open keeps its tag wherever it is.
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
  `window.__townSeat(i, n)` (the nearest free bots sit on table i's first n stools, and every bot holds still from then on), `window.__townStill()` (no bot sets off from then on; the walks under way end: a check that a walker's name tag could nudge, Nov 9)
  and `window.__townTables()` (each table's state: "still", "waiting:<free stool>" or "playing"); the bots (Oct 27):
  `window.__townAt("bot", i)` (where to tap BOTS[i]), `window.__townCall(i)` (BOTS[i] comes to stand beside you, out from home first if it's there, and every bot
  holds still; -1: only the holding still) and `window.__townBots()` (each bot: its name, square, the table it sits at, whether
  it walks, whether it's at home, a sidekick's animation; since Oct 28 whether it's going home, where it's headed, `fading`
  "out" or "in", its door, whether it stands in the square, its place in the queue home) and `window.__townTurns(ms)` (the
  bots' turns every `ms`, the next one now). The turns (Oct 28, phone and desktop): ten out; one walks home and fades out
  at its door, gone; the one home longest fades in at its own door, ten in the world all along, and walks to the square. Playing a bot (Oct 27, phone and desktop): a tap on Tempo Tess opens her card ("Tempo Tess (bot)", "Rating
  1500", Play), nothing of Maia's fetched yet; Play walks you both to a table, the game opens (the gear, her name and
  rating on her strip, Maia's worker started), one move each, resign ("Casual game"), "Back to town": you on your stool, she
  across, then she wanders off; a bot sitting alone at a table: its card's "Play <name> (bot) · <rating>" (Casual and
  Ranked greyed), the game; a reload, then again and the back button, each lands you back at the table. The sidekicks
  (Oct 28): a tap on Glim, it waves, then stands while its card is open ("Glim (bot)", "Hollow's sidekick", "Rating
  2500", Play); Play, the game with its face on its strip, resign, back at the table with Glim across in its sit; Hollow
  Peak's card shows his first line, closed and opened again the second (`__townGlide("hollow")` takes the camera there;
  `__townGlide([c, r])` to any square, to measure a spot's frame rate,
  `__townBossBack("hollow")` keeps Hollow behind his home); Babur's card has no line. `__townBots()` also gives each bot's
  animation (`anim`: a sidekick's, null for a pawn).
  The person card (Oct 28, Eric's mockup, phone and desktop; `town.spec.ts`, "a person's card" and after): `window.__townPlayer(uid, name,
  icon?, rating?)` stands a test player (a pawn with an account id: a real player's card) beside you and answers its index,
  `window.__townAt("player", uid)` says where to tap it, and `window.__townFull(on)` puts someone unseen on one stool of every table
  (no table is free: a bot's Play greys). A sidekick's card (Glim): dark (`#20212a`, a gold border), 210 × 53 px, the picture a
  face in a blue ring that is no button (a `div`, no tab stop, the ordinary cursor, a tap does nothing), the name bold white
  and " (bot)" gray (the heading still reads "Glim (bot)"), its line, the rating with its gold bars, Play with a crossed-swords
  SVG (`aria-hidden`, the button's text color) and no triangle, Play the only button; a pawn's (Tempo Tess): an ivory ring, her
  own picture, no line, every part where the sidekick's was; tables full (`__townFull`): Play greyed reading "Full" (named
  "Play: tables are full"), the card, the picture, the words and Play not moved a hundredth of a pixel, and back when a table
  frees; every bot's name and line shrinks to fit its row at or above its floor (10 px, 7.5 px), Tempo Tess's name and Bun &
  Bug's line shrunk on the card and whole, Glim's at full size with every row where Bun & Bug's was; the boss's,
  home's, Colosseum's, table's and confirm cards dark, with their words and buttons, a gold primary, greyed buttons and "Coming
  soon" all 4.5:1 or better (computed from the page's colors); a test player: the same row and size, an ivory ring, no "(bot)",
  Play greyed with "Coming soon", its picture a button "View Cyrus's profile" with the pointer cursor that opens that account's
  profile over the town (Back: the town and its card as they were). `packages/app/test/town-card.test.ts`: the test player (beside
  you, out of the crowd, the only one with an id), the table-filling hook and the rating's words.
  The chat log's hooks (the test switches on): `window.__townSay()` (someone from `CHATTER` talks now), `__townSay(name, text, kind,
  agoMs)` (that line, said `agoMs` ago: a line 4 minutes old to scroll back to), `__townChatter(false)` (no chatter of its own; true
  starts it again) and `window.__townTapped` (the text of each tapped player's line).

## Not built yet

The bottom strip, a player's card's Play and "Invite to party" (their card has the row, with Play greyed: Oct 28), the other homes'
insides (and their crates), battles in a shop's circle, your ride inside a shop, the Colosseum's menu (raids with people,
party), the park's matchmaking (sitting at a table queues you: `ROADMAP.md`, "The park"), quick chats, other people's dressed pawns, the Simple map setting, rooms (one shared town today), sounds.
