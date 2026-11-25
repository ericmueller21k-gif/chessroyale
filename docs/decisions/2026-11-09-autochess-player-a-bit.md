# Auto chess: the players a little bigger (Nov 9, 2026)

Eric (Nov 9): "I want the pawns to be bigger in autochess", then, on the two helper rounds that filled the rows: "way too big now…
I just wanted it a little bit bigger." Those rounds (branch claude/autochess-player-size) are dropped. Instead the corner pawns grow
to what their row already leaves (a bench tile, its gap and label, less the hop; 44 to 60 px): 44 → 49 px on a 390 phone, 56 on a
1280 computer, unchanged at 320. Name 12 → 13 px, level and numbers 10.5 → 11.5, bars 6 → 7 px tall (360 px and wider). The rows and
the board keep their sizes.
