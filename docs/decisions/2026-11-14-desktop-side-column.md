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

## Round 2 (Nov 14, Eric): the moves flush with the board's top

**Eric, Nov 14:** "move up the moves thing so it's flush with the top of the chessboard. … move up the chat box and put it below it,
make it the same width… we have all this nice space for the pawns."

**What changed (computers, boss battles):**
- The ⚡ / fish / gear row (`.gm-tools`) moved from the board's top row into the boss bar's row, vertically centered on the banner,
  right-aligned to the moves panel's right edge. It sits above the board's top line and never shares the banner's width (the bar is in
  the board's column), so it covers no banner text.
- The moves panel's 36 px gap is gone: its top is the board's top. The party-battle height rule that gave back those 36 px is gone
  too, so a party's list keeps the foot it had (`--mv-h`: half the board less 73 px, at least 120 px) and the chat keeps its height.

**Call made:** the tools are centered on the banner's height, not top-aligned with it, so they read as level with the banner text.
Tops are 27 px and bottoms 55 px at 1280 × 800 against the bar's 6 to 67 px.

**Checks, old → new:** `e2e/desktop-board.spec.ts`, the "what sits beside the board follows it" check: "the moves 36 px under the
tools" → "the moves' top = the board's top"; "the tools from the board's top" → "the tools above the board's top line" and "the tools
level with the banner". Nothing else changed. Stills: `stills/desktop-side-column` branch.

Not in `docs/rules/eric.md` (its rules do not state the Nov 1 offset).

