# A boss's words keep their place on a computer (Nov 15, 2026)

Eric: "his chat boxes enlarge and move off screen after he says stuff… they are fine for a moment, then they aren't" (Don Dough, 1611 × 843).
Cause: each turn draws a new screen, and the figure and its words with it; the figures' sizes were set on that new screen by a layout effect that ran after the words' box had fitted itself (at the default size and place), so the box came back at 9 px and unmoved, under the side menu.
Change: the sizes live on the arena (it stays across screens), and the boss's box is no wider than his room to the menu (`--side-room`), so a long line wraps and nothing is ever moved into view. The God King's `--king-room` moved with them.
Call: a room set by layout, not a re-check that moves the box later, since a box that moves mid-line breaks "nothing shifts".
