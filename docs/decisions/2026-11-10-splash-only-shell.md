# The load shows only the logo and the bar (Nov 10, 2026)

Eric, Nov 10, on the desktop load drawing home's outline: "You load the game, hun chess in the middle with the loading bar, and
then everything, it doesn't start putting in the containers until everything is able to load at once on the screen."
Change: `#shell` in `packages/app/index.html` is always the splash (the logo centered, the bar under it past 2 s), on a phone and a
computer; home's outline shell is gone. The home-layout shell check now asserts the centered splash and no home boxes.
