# A drawn board is read without the rules (Nov 28, 2026)

Eric, Nov 28: "he jumped down onto the board to ult, and I got this" ("Something went wrong"), the Stranger's second Storm. The
device's report: "Invalid FEN: missing white king" in render. His Storm draws the pieces it throws off their squares, and that time the
white king was among them; `pieceAt` built a chess.js game from the drawn position, which refuses a board with no king. `pieceAt` now
reads the squares without validating (`skipValidation`): every boss moment that draws pieces in the air is safe from it, not only his.
