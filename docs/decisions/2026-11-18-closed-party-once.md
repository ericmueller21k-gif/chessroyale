# "That party has closed." once, never again (Nov 18, 2026)

**Eric (a phone screenshot over Boss Battle):** "This party bar keeps popping up. I don't know how many times I X out of it ... you only need to be notified once of something like this."
**Cause:** a device remembers the party it was last in (to bring you back after a battle). When that party had closed, the screen showed the note but kept remembering it, so every visit to Boss Battle tried the dead party again and showed the note again.
**Fix:** a party found closed (its status, its socket's "closed", Squads', Boss Battle's and 50 v 50's) is forgotten at once (`forgetParty`, squads.ts). The note shows the one time it's found.
**Check:** `e2e/lobby-close.spec.ts`, new: a remembered closed Boss Battle party shows the note once, the device forgets it, and the next visit shows none (fails without the fix).
