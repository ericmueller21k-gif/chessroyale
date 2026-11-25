# chat.spec's guard waits for time left on the move (2026-11-17)

**Eric, Nov 17:** "yes" to changing the wait in his guard test's helper (`e2e/chat.spec.ts`, `untilMyTurn`).

**Cause:** the helper returned once the phone's turn was on, without checking how much of the move clock was left. It was
reached mid-turn, after the chat section. Rarely it ran inside the 300 ms late grace past the deadline, when the phone still
says "play"; the round then locked between tapMove's two taps, the second tap rightly did nothing, and line 283 read `[]`
(main, Nov 16, twice). Reproduced 4 of 4 locally; never a tap lost while the turn was open, so not an app bug.

**Change:** the wait also needs at least 3 s left (`phase.deadline - Date.now() > 3000`), at all three calls. No assertion changed.
