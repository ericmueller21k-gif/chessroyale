# Smudgy's Repaint always comes once warned (Nov 8, 2026)

Eric, Nov 7: Smudgy announces his ultimate for "next turn" (around turn 6-7), and it never fires.
Cause: the warning came whenever his meter filled, but a Repaint needs a pair to paint (none while the crowd has all
eight pawns or his forced moves are pending), and then the engine's pick had to land in `repaintBand` (about 3% of
pairs do), so he retried turn after turn, often for the rest of the battle (5 battles in 26 in the sim had none).
Call: warn only when a pair exists as the crowd's turn begins (`paintableNow`); none in the band, take the nearest
outside it (marked `outside`, as the test switch did). A crowd move that removes every pair, or no engine answer,
moves it to his next turn with one, the warning kept. No new number; the band stays the preference.
