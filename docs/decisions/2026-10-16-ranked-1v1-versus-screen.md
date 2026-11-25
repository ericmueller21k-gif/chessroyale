# Ranked 1 v 1: the stage, from the search to the versus moment (Oct 16, 2026)

Eric (Oct 16), on what PLAY on 1 v 1 should feel like: "like on some of these, like fighting games, these old school
ones, like, when you hover over a character, it kind of loads the model of the character, and then it's kind of like
sitting there loading … your character's sitting there, and then there's like kind of this empty platform thing like
waiting, and then when your opponent joins, like their pawn loads up next to you, so they should be big pawn pieces,
like that should be a big chunk of the screen." Also: "your pawn piece, their pawn piece, like your name, your rank, and
then it just like holds that for a few seconds, and then it like loads the board up", "For phone… I like left and right
still", and "The goal here is it feels very nice and smooth to just be like, I'm gonna go to HunChess and play a quick
ranked game." How it works now: [docs/areas/ranked.md](../areas/ranked.md), "The stage". The calls made building it:

- **One stage, kept from the search to the versus moment.** The search and the versus moment are the same
  `DuelStage` element under one component (`DuelFront`, which then hands over to the board), so Preact keeps it: your
  pawn and its platform stay exactly where they were, and the opponent's pawn, name and rank (and "VS") are all that
  arrive. The first version had a component each for the search and the versus moment, and its frames showed your pawn
  dropping in a second time when the opponent was found. The e2e marks your pawn's element while searching and checks
  it's the same one once they're there, and that no box on the stage moved.
- **In the home screen's frame, as every queue.** On a computer the side menu and the live panel stay (Eric, Oct 8: the
  queue is a state of home, not a whole window), for the versus moment too, so the stage doesn't jump when the opponent
  arrives. The stage takes the frame's whole center (no card column beside it: your pawn is on the stage). The side
  menu's pages (all but your profile, which opens over it) now leave the 1 v 1 queue or game first, as they leave every
  other queue (before, they called the Crowd queue's leave, which doesn't touch the 1 v 1 queue).
- **The opponent arrives as the versus moment starts,** not when the queue pairs you. The pairing is followed by a
  moment (usually well under a second, at most `joinSeconds`) while the game object waits for both sockets; the right
  platform stays empty then, saying "Opponent found…", and their pawn drops at the start of `versusMs`, so it holds for
  the game's own 2.5 s and the board follows on the game's own clock (`voteAt`). No timing of the screen's own.
- **The pawns are each player's character, drawn as home draws yours** (the white pawn, dressed), not in the color
  they play: your pawn doesn't change color the moment someone is found. Which side you play is a line under the
  stage ("You play White"), as before.
- **Sizes:** each side is half the width; the pawn's box a little wider (12 px each side, into the gutter and the gap
  between, where the box is empty: the pawn itself is about 45% of its box). On a 390 px phone each pawn's box is 201
  px, on a 320 px one 166 px; on a computer at most 344 px. A pawn's box reaches the screen's edge, so the stage clips
  sideways (`overflow-x: clip`): its breathing never scrolls the page. Bigger would need the boxes to overlap the
  edges, and a weapon at a pawn's side would be cut off.
- **Nothing moves when something arrives.** The space under the stage is always as tall as "Few players online right
  now" and Cancel together (its two buttons side by side, so it's as tall on a 320 px phone as on a computer), and the
  names' space as tall as the longest name and rank on two lines each, in the search and in the versus moment: a bot
  picked from "Few players online" arrives without the pawns moving up or down. "VS" is absolute, between the pawns.
- **The waiting animation:** the empty platform shows a faint outline of a pawn, breathing (opacity), and two gold
  rings rising off the platform (scale and opacity). Both pawns drop onto their platforms (yours as the search opens,
  theirs as they're found: 0.42 s, a little squash as they land, their shadow growing under them), then breathe very
  slightly from their feet. Transforms and opacity only; CSS keyframes, no library, no script per frame;
  `prefers-reduced-motion` turns every one off (the e2e checks nothing on the stage animates then).
- **The board loads as before,** in one cut: the board screen is #255's, unchanged, and must not move from its first
  frame (the existing test checks it from the vote to the game). No fade into it: screens that replace each other
  during play don't fade (.claude/LESSONS.md, "A white flash between moves"); the recordings' brightness, frame by
  frame, shows one step at the cut in light and dark and no blink.
- **Words:** "Finding opponent…" (Eric's brief) under the empty platform, with the time waited; "Opponent found…"
  while the game waits for both; the rest as #255 had them.
