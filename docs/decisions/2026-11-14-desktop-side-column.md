# Desktop boss battle: the chat box under the moves (Nov 14)

**Eric, Nov 14:** "move up the chat box and put it below [the moves], make it the same width… the height would just come down…
we have all this nice space for the pawns."

**What changed (computers only; phones unchanged):** on a boss battle's computer layout with chat, the chat box is in the same
column as the moves panel, under it: same left edge and width (the same translate), 12 px gap, and its foot stops 200 px above
the board's bottom line (`--gk-zone`).

**Calls made:**
- The chat's foot is not on the board's bottom line as the brief said. In every boss layout measured (1280 × 800 and 1920 × 1080,
  Hidden Boss and a raid) the God King stands in that column with his top 120 to 190 px above the board's bottom, so a chat
  ending on the board's bottom line would cover him. The 200 px zone keeps him clear with room to spare.
- The moves panel is still 36 px under the board's top, under the ⚡ / fish / gear row (Nov 1). Making it flush would move that row
  elsewhere; left for Eric to choose.

Guard: `e2e/desktop-board.spec.ts`, "a computer's boss battle with chat…" (the chat box is put into the screen for the check, since a
bot raid has no chat).
