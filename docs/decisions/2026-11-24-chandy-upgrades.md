# Chandy: the hunt after his taught upgrades, the Lock-on Shot's victim, and the God King's warning (Nov 24, 2026)

**Eric (Nov 24, a deep endgame against Chandy, his rifle at 2 upgrades):** "the only 2 we got were the ones that we force him to get ... he marks one and then he wants to target it ... aggressively trying to capture a piece and upgrade, even if it ... is a detriment to him, but not a super detriment ... if it's like a decent trade, but maybe slightly negative, he still targets it ... he ended up just doing the queen shot 3 times ... we should replace that with ... a generic name ... the god king should say something about like ... move your queen behind safety ... When he does his queen shot, we should already know ... which piece you're most likely to sacrifice. So have him mark that piece as well."

- **The hunt** (from his third upgrade): a trade for a locked piece that costs him at most `huntLoss` (1 pawn) is played, within `takeMargin` (2) of his best. A lock stays while he can trade for its piece. An escaped piece re-locks the next most gettable one.
- **The shot's victim** is fixed as he aims, from the position alone: the piece already first down the target's file, else the cheapest piece a move can put there. Never your king.
- **A shatter is an upgrade** when it hits a locked piece or the aim's target.
- **The name is "Lock-on Shot"** everywhere a player reads it. The code name `queenlock` stays.
- **The God King's warning** on the aim: "He's aiming down our queen's file. Put a piece in front of her!" It stays quiet when no move can block.
- **Review of #915:** the re-lock order no longer re-locks the same pawn every turn, and the shot's lock goes with its aim.

Full design and measurements: PR #915.
