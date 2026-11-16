# The Hidden Boss's phase 1 online: no random move either (Nov 13, 2026)

Eric, Nov 13 (option 1): "Keep Maia on the devices, but replace the random-move fallback with the same pause plus a server move."

## What changed

- When no device answers his phase 1 move in its window, the engine server plays it at his strength, never a random move.
  No answer in 60 s means no result for those fighting him.

## Calls made

1. His turn is the pause: nobody's clock runs, and the screens say "The boss is thinking…".
2. The server answers after the host's window, not another device's: a second device cost 15 s, and silent devices took turns.
3. Once asked, that move is the server's alone.
4. The pick is a device's seeded Stockfish move from the server's top eight; a mate in one comes first.
5. Fair play keeps every phase 1 move; a leaver's loss stands.

Details: docs/areas/bosses.md, "The Hidden Boss's phase 1" (the online paragraph). Other bosses are unchanged: a follow-up for Eric.
