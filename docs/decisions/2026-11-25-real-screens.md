# Real screens: laptop sizes in the checks; ranked 1 v 1's end page fixed (Nov 25, 2026)

Eric (Nov 25): "I run checks on the laptop ... desktop monitor ... phone ... I get 3 different things every time I look"; on the 1 v 1
end page: "this defeat screen looks horrendous ... 'No quests moved' ... the play again and home button are huge. The chat is shrunk";
then "I'm running it at 125 because it says recommended for this laptop". And: "the laptop is just a smaller desktop screen ... the
same thing, just smaller versions"; "I don't care if the move by move is on the right".

## The cause
Computer layouts were built and checked at 1280 × 800, 1440 × 900 and 1920 × 1080 only. A 1080p laptop at Windows' recommended 125% has
a window about **1536 × 730** (Eric's), shorter than all of them. The 1 v 1 end page was a column about 830 px tall, so on his laptop it
scrolled down; on Windows a page that scrolls down shows a real scrollbar, and the page's widths are built on `100vw`
(`--win-w`), which counts the scrollbar, so it scrolled sideways too. Headless Chrome hides scrollbars, so no test could see the
sideways scroll; the vertical one was never measured below 800 px.

## What changed
- **The sizes, everywhere a computer layout is checked** (`REAL_SCREENS` in `e2e/helpers.ts`): laptop 1536 × 730 (125%, scale 1.25),
  laptop 1280 × 600 (150%, 1.5), laptop 1366 × 650 (768p, 1), desktop 1920 × 960 (1). Each check opens its own window at that size and
  scale. Not new Playwright projects: that would run the whole suite four more times; the layout checks run at each size instead.
- **The check** (`realLayout`): no scroll either way, nothing cut off at the window's top, every chat's message area at least 120 px,
  the board at least the window's height less two name bars (34 px, the 1 v 1's strip) and 40 px. Every game screen
  (`desktop-board.spec.ts`, "real screens": Boss alone, a raid, the 50 v 50, its opening vote, 1 v 1, Squads), Boss alone's and the
  50 v 50's end pages, and a ranked game with its end page (`ranked-1v1.spec.ts`, "real screens").
- **Ranked 1 v 1's end page on a computer** (`DuelEndPage`, `end-screen.css`): the page is the window, never scrolling. The headline
  over the left half; under it your rewards beside the chat; the move-by-move on the right, its board as tall as the window allows.
  Even gutters (the page's padding is the gap between the columns). Every size is in design pixels (`--es-u`: the window's height
  over 800, between 0.75 and 1 px), so every laptop shows the desktop's arrangement, smaller. Play again and Home a normal button's
  size. The chat takes the height that's left (at least 227 px of messages on the 1280 × 600 laptop).
- **Its content (phone too, no platform named):** the placement card counts games ("1 of 5 games", not "1 RP"; the slot's label
  "PLACEMENT", not "RP EARNED"); the quests box shows your quests (the dailies, then the weekly; a box of four rows), the ones this game
  moved lit and sliding, never "No quests moved this game" (`EndRewards day`, `questRowsBy` in quests.ts). Other end screens keep
  "the quests this game moved" (screens are separate: their call is Eric's).
- **1 v 1 in play, a computer:** the chat beside the board runs down to the board's foot (was a fixed 320 px: 104 px of messages on
  the 1536 × 730 laptop, now 327).

## Calls made
- **Three panes on a computer** (rewards, chat, move-by-move) rather than two columns: at 600 to 730 px tall a single left column
  can't hold the rewards and a chat with 120 px of messages. The left half is "your result" (headline over rewards and chat); the
  move-by-move stays on the right as Eric asked.
- **Known gaps, held, not fixed here** (the shared game layout's job, Part 3's mockup): every game screen's board is under the target
  on every real size (e.g. 1 v 1 on the 1536 × 730 laptop: 557 px, target 622); the 50 v 50's chat has 8 px of messages on the
  1280 × 600 laptop, 42 on 1366 × 650, 119 on 1536 × 730; Boss alone's end page scrolls down 35 to 165 px on the laptops, the
  50 v 50's 61 to 111 (so on Windows they also scroll sideways). Each is held at today's number (may improve, never worsen) and listed
  in the test's annotations; an entry goes when its screen meets the target.
- A guard rule for `docs/rules/eric.md` is proposed in the PR, not added (a guard needs Eric's OK).
