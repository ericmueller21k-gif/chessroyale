# Auto chess: a 10-second meeting before round 1, and the shop in one panel (Oct 24, 2026)

Lane: the director. Auto chess (the shelved demo). Player-visible; no rule, price or odds changes.

## What Eric asked (Oct 24)

"right now when you load into it, it just insta loads… at the start, both pawns, you and your opponent's custom pawn, kind of meet.
They're at the center of the board… when you load into a game, it drops your pawn and their pawn in the center, and then you have
your quick chat… this phase is just like a 10-second countdown. And then after 10 seconds, it just teleports your pawn and their pawn
back to… where they actually sit on the screen… fade in the HP and the experience bar as well… And then… the normal action phase."

And for the shop: "I want to put a… nice rounded [shape] around this entire sort of piece here… fitted like a container… it depends on
if we're in light or dark mode."

## What changed

- **The meeting, once per game, before round 1.** Both custom pawns (yours on the left, mirrored to face theirs; theirs on the
  right) drop into the middle of the board, about twice their corner size, with a small landing bounce. The corner pawns, names,
  level badges and HP and XP bars are hidden. "Starting in N" counts down from 10 under them. Nothing of the game runs: the shop, the
  buy clock and round 1 wait.
- **Quick chat.** Four lines in a row under your pawn. A tap shows the line in a speech bubble over your pawn for 2.5 s. A tap
  while one is up replaces it.
- **The bot's answer.** Once per meeting, 1 to 2 s after your first line, the bot answers with a random line from the same list, in a
  bubble over its pawn. If you have not chatted by 3 s, the bot opens with "Good luck, have fun!" instead.
- **The teleport.** At 0 both middle pawns puff away and appear at their corners (a 400 ms fade-in with a slight scale-up). The
  names, level badges and bars fade in over the same 400 ms. Then the game starts as before: ACTION PHASE, round 1.
- **The shop panel.** The gold and income line, the clock, the odds pill, Buy XP, Reroll and the four cards sit in one rounded panel,
  drawn with the home panels' surface, border and radius (`--fd-panel`, `--fd-line`), so light and dark both work. Inner padding 10 px
  (6 px on screens 350 px wide or narrower, or under 760 px tall, where the board needs the room).
- **Result text on the narrowest screens.** At 350 px wide or narrower, the result's words are 11.5 px (was 12 px), so a stall's
  reason keeps the card at the shop's height: the page no longer scrolls 1 px at 320 x 568.

## Player-visible text (all new)

- "Starting in N" (N runs 10, 9, ... 1).
- Quick chat, one list in `packages/app/src/autochess/chat.ts`: "Good luck, have fun!", "Hello!", "May the best army win.", "Nice outfit."
- The bot's opener: "Good luck, have fun!" (only when you have not chatted by 3 s).

## Settings and test switches

- `AUTOCHESS.introSeconds` 10 (0 skips the meeting). `introReplyMs` [1000, 2000]: the bot's answer window after your first line.
  `introOpenMs` 3000: the bot's opener when you have not chatted. `introBubbleMs` 2500: how long a bubble stays.
- `?quick=1`: the meeting is 2 s, and the bot's answer window is 300 to 600 ms so it fits inside it.
- `?intro=0`: no meeting (the tests that don't test the meeting use it).

## Judgment calls

- **The bot's answer is a random line from the same list,** so it can repeat the line you tapped. That keeps one list to extend.
- **Under `?quick=1` the bot's opener never shows** (its 3 s is past the 2 s meeting). Under quick, a meeting with no line from you is silent.
- **Yours is the mirrored pawn** (it faces right, toward theirs). The bot's pawn is drawn as it is in its corner.
- **The meeting's size comes from the board's width** (container query units), so the pawns, bubbles and chat row stay inside the board at 320 px.
- **Short screens (under 760 px tall)** keep the board as big as before by trimming the spacing and the panel's padding.
- **The reply and the opener use `Math.random`,** not the game's seed. The tests check the windows, not the exact reply.
