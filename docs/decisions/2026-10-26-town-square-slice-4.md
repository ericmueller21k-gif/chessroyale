# The town square, slice 4: the press, the trail, one pawn a square, the boss and home cards (Oct 26, 2026)

## Eric's words (Oct 26, trimmed)

- The tap: "when you tap an area on the map it moves you to that tile, and it sorta gives a response when you tap it like
  a button would, a good and satisfying press." Then: "Not a thin ring but a pulse/light up bold border of the tile… so
  pressing down feels like pressing down, lifting up releases."
- "No on the tock… other games have no sound when moving around, same for now with vibrate. Leave those out."
- "What you could do, visible to you only, is a little trail your guy leaves behind as he runs, maybe 3 or something
  white trailing fading dots… doesn't need to be dots… like you're leaving little droplets as you run."
- Groups: "if you tap on a person you go to them and if multiple people tap on each other it starts a little circle or
  grouping in a spot like mmorpgs do." One pawn a square, as the director proposed: "sounds perfect".
- Bosses: "the solo boss mode will remain with the boss select screen we built, fully away from this whole thing… If you
  go to a boss house in the open world you can boss alone but it will simply say something like 'are you sure you want
  to leave'… letting you know it's going to close you from the server and take you to the boss selection solo thing we
  built previously." "For the moment tapping them to challenge 1v1. Or tapping the building to shop, but it's grayed out
  with coming soon."
- The director, on "the boss selection solo thing we built": it's today's Boss raid screen (its tiles and stage), being
  renamed "Solo Boss Mode" in parallel. Leave opens it with the boss's tile already picked.

## What's in slice 4

- **The press** (`town/press.ts`, drawn in `render.ts`):
  - **Finger down:** the square you'd walk to sinks a little (its face drawn lower and smaller, its far wall in shadow),
    darkens, and lights up with a bold glowing border in the game's soft gold, held while the finger is down.
  - **Up on the same thing:** one short pulse of the border, outward and fading (300 ms), and you set off.
  - **Moving past `dragPx` (8 px) first:** the square lets go with no pulse and no walk, and it's a look-around drag as
    before.
  - **Taps on a home, a boss or a bot** press the square you'll walk to.
  - **A small gold ring** marks your destination until you arrive or tap elsewhere.
  - **No sound and no vibration.**
  - **It replaces slice 1's tap ripple** (a thin gold ring growing from the finger for 700 ms).
- **Your trail:** as you run, a soft white droplet lands on each square you leave, at most one every 150 ms, so about
  three show at a run. Each fades and shrinks out over 520 ms. None while standing; yours only.
- **One pawn a square, like chess** (`world.ts`):
  - **Who holds a square:** a walker holds the square it stands on or is headed for (`taken`). Passing over a square
    doesn't hold it, so you walk through people.
  - **Where a walk ends** (`destFor`):
    - A free square: you end there.
    - A taken square, a person or a boss: you end on the nearest free square beside it (`spotNear`). That is the 8
      squares touching it, then the next ring out; within a ring, the one you reach in the fewest steps.
    - A home: you end on the nearest free square of the ring around its plot (as before).
  - **Two walks to one square:** the later claim gives way to the nearest free square beside it (`keepApart`, every
    tick). This covers someone stepping onto your last square while you walk.
  - The bots and bosses pick their ends by the same rule.
- **The cards** (the prototype's card style):
  - They stand inside the world's box, over the boss's head or above the home's floating name, with a tail pointing
    there, and are placed every frame.
  - A tap anywhere else closes a card, and so do Escape and a chip's tap. Tapping something opens its card *and* walks
    you next to it.
  - **A boss:** its name and **"Challenge alone"**. That opens, in the card's place: **"Leave the town square?"** /
    **"You'll fight [boss] alone in Solo Boss Mode."** / **Leave** / **Stay**.
    - **Leave** closes the town square and opens the Boss raid screen as the side menu opens it, with that boss's tile
      picked. The town calls `rememberBossPick(id)`, the screen's own remembered pick (`brc.bossId`), and the screen reads
      it as it opens.
    - **Stay** closes the confirm.
  - **A home:** its name, **"Shop"** greyed (muted, not tappable) and **"Coming soon"**.

## Player-visible text (all new)

- A boss's card: its name (the town's: "Babur", "Moo & Moon", "Chub & Chirp", …), **"Challenge alone"**.
- The confirm: **"Leave the town square?"**, **"You'll fight [boss name] alone in Solo Boss Mode."**, **"Leave"**,
  **"Stay"**.
- A home's card: its name, **"Shop"** (greyed), **"Coming soon"**.
- Gone: nothing written. The tap's thin ring (slice 1) gives way to the press.

## Judgment calls

- **The pressed square is the one you'll end on.** A taken square presses the free one beside it, where you'll stop. That
  way the press always shows where you're going, and it's the same rule as a tap on a home, a boss or a bot.
- **"Beside" is the 8 squares touching, like a chess king's,** not just the 4 straight ones. Three people ring round one
  person in a tidy circle (a ring of 8) instead of a plus. If the ring is full, the next ring out fills.
- **The earlier claim keeps a square.** Simple to explain, and it never moves someone already standing still.
- **A tap while a card is open only closes it,** as in the prototype. It doesn't also walk, so a stray tap never sends
  you off.
- **Stay closes the confirm and the card with it,** since the confirm stands in the card's place. Tap the boss again for
  a new card.
- **The boss stays put while its card is open.** Its stroll is paused, so you end up next to it and the card doesn't
  wander.
- **Leave keeps your remembered pick at that boss** (the same `brc.bossId` the tiles set), so the Boss raid screen opens
  on him. The App change is one small entry point: `TownPage`'s `onBossAlone`.
- **The trail droplet** is a soft white oval with a faint warm shadow, so it shows on the light squares too.
- **The card is placed over the head,** using the boss's chip face box rather than the top of its picture, which is three
  squares tall. A home's card sits 30 px above the building's top (`cardOverName`), so it doesn't cover the home's
  floating name.
- **Every number is in `feel.ts`:** `pressDarken`, `pressDip`, `pressInset`, `pressBorder`, `pressBorderMinPx`,
  `pressGlowPx`, `pressColor`, `pressEdge`, `pulseMs`, `pulseGrow`, `targetSize`, `cardOverName`, `trailEveryMs`,
  `trailLifeMs`, `trailSize` and `trailAlpha`.
