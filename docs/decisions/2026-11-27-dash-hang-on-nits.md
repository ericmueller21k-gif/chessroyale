# Dash's "Hang on": the first review's three display nits (Nov 27, 2026)

The review of #986's first round (`REVIEW.md` on `claude/dash-hang-on-review`) left three nits; all three still happened on main.
- **Premoves over the slid-back board:** only a computer's queue (a phone holds one premove, played as your move). Its pieces stay on
  their squares through the gag, their squares still colored (`PremoveSeat.hold`), so only your move slides back and home.
- **The move list's hold:** `popOffHolding` asks for your move counted on the pop-off's own turn, as `popOffPending` does.
- **A late device:** the server sends its hold's start (`popOff.since`, Birdie's way); the screen starts there. The pop-off gets it
  too (the same code). Solo unchanged: a reload there starts the hold over as well.
