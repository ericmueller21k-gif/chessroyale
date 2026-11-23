# Auto chess: the meeting's chat buttons back on their cards (Nov 9, 2026)

Eric (Nov 9, phone screenshot): "fix this, it used to be fine". The v5 rewrite of `.ac-root` (#558) dropped `--ac-card` and
`--ac-shadow`, so the meeting's quick-chat buttons, its countdown and the pawns' speech bubbles drew see-through over the board.
Put both back (`var(--fd-panel-2)` / white in light mode, as before v5). New guard in the meeting's check: the countdown and the chat
buttons have a background.
