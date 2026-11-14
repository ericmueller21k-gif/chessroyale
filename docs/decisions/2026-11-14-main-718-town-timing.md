# Main red after #718: two town tests' causes (Nov 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Main's run on 65902dc3.

- **town-chat:1054 [phone], both tries: the second refused try was sent.** The CI trace shows "Player: too soon …" in the log: on that
  runner each Playwright step took about 0.4 s, and the style checks between the first and the second try (about 14 s, then the
  2.2 s wait) took the second Enter past the 15 s, so it went and no new gray line came. The game was right: a second try inside
  the wait makes a new line (a new `data-id`) in the old one's place, its N the wait left at that moment. The test now makes both
  tries straight after the send (before any of the checks), checks the line was replaced (another `data-id`, one line), and bounds
  each N by the wait left as that try came (the server's 15 s from its answer, which came between the press and the line showing).
  No second boundary, no wait to dodge it; the 2.2 s wait is gone.
- **town:966 [desktop], first try: "bot 9 is drawn" (Tempo Tess, called with Glim already beside you).** `__townCall` sent the bot
  to the free square beside you it reaches first. Coming from straight behind, that is the square behind your pawn, hidden by
  it, so its tap point isn't found. (Here every fresh town puts the bots in the same places, so the CI frame couldn't be recreated.)
  The test hook now picks a square beside you off the camera's line through you (your column looking north or south, your row
  east or west), and falls back to any free square beside you. Only the hook changed. A player's own walk is untouched.
