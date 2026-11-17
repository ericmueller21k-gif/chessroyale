# The coin's new icon (a king's head on a coin, like the boss coins) + drop the profile's coin pill. Opus, high (art via API)

Branch `claude/coin-icon` from main. About 1 h. Read CLAUDE.md, `.claude/LESSONS.md`, `docs/areas/shop.md`, `docs/rules/eric.md`.
Art by the paid API runner (branch `claude/boss-art`, `scripts/boss-art/run.ts`, Opus), never by hand. Cap $5; log the cost.

**Eric, Nov 17 (word for word):** "we also need to change the coin icon I want it drawn like the boss coins but a king chess piece
'head only' style as the center. Also in one of those screenshots we have a random coin thing in the profile. We can just remove
that now I think." Screenshots on claude/director-notes: `notes/briefs/assets/topbar-coin-nov17.jpg` (today's coin: a silver eagle
coin by the 0 in the shop's top bar) and `notes/briefs/assets/profile-coins-pill-nov17.jpg` (the profile's "● 0 coins" pill beside
Level and Rating).

1. **The coin:** drawn in the boss coins' style (find the boss tokens' coin art and match its look, size, rim and shading), with a
   chess king's head (the crown and top of the king piece, head only) in the middle. Gold, so it reads as "coins" next to the
   silver/colored boss coins. Replace the coin everywhere it's drawn (top bars, shop prices, rewards toasts, the 🪙 in text where it's
   an icon); one shared component or asset, not copies. Crisp at its smallest size on a phone.
2. **Remove the profile's coin pill** (Level · Rating · coins row): the coins pill goes; the row keeps Level and Rating, centered,
   same size and place (nothing else shifts). A later payments PR adds a "Total coins · Refundable" line on your own profile.
3. Tests: the profile spec's check of that row (if a guard in eric.md covers it, stop and push `.question`); one focused check that the
   coin icon renders in the top bar. Light lane (art + a removal).
4. Stills for Eric on `stills/coin-icon` (never docs/): the coin big, and in place (shop top bar, a price pill, profile row) on phone.

Done: `.pr-body.md` (under 40 lines) and `.done`, end. Blocked on Eric only: `.question`, end. No PRs, no CI waits.
