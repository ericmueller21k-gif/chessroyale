# Payments design v2 + the coin reward mockup. Opus, high (design with math; a mockup; no game code)

Branch: `claude/payments-design` (PR #772, held for Eric): `git fetch origin claude/payments-design && git checkout -B claude/payments-design
origin/claude/payments-design`; merge origin/main first. About 1.5 h. Read CLAUDE.md, the current doc
`docs/decisions/2026-11-17-payments-design.md`, and ALL of Eric's answers: `notes/briefs/payments-answers.md` on claude/director-notes
(rounds 1-5; rounds 4 and 5 change the refunds section and add new features). Read `docs/rules/eric.md` ("nothing hidden").

Rewrite the doc to match Eric's answers (keep it under ~300 lines, his words quoted where they decide something):
1. **Refunds** (round 4-5): refund within 14 days takes back unspent bought coins; opened items stay ("keep your items as a thanks");
   the refund message with the optional comment (Submit greyed until text; Close skips). No item-return system (delete it from the
   doc and the build plan). The 3rd refund (chargebacks count) → a quiet 90-day hold on buying coins and on trading (when trading
   exists); Buy shows greyed, and a tap says "Purchasing isn't available on this account." (no reason given).
2. **Chargebacks:** never countered. The 1st → a message: we don't fight chargebacks but they cost us money; another will close the
   account. The 2nd → the account is closed. Note what the terms must say for that (for the end-of-build AI legal review), and what
   "closed" means in our system (sign-in refused, data per the privacy page).
3. **Admin:** a new tab (beside, not inside, the fair-play/bans page): refunds, their comments, chargebacks, holds, closures, and a
   count of Buy taps while held (cheap; Eric was curious who tries).
4. **Coins (the math):** time-based play coins in every counted game (~1.8 a minute), capped per day for minutes (300), plus a
   performance bonus that keeps paying past the cap (placing well, wins, good accuracy: pick from what the server already knows), so
   playing on is always worth something; diminishing, not unlimited (an abuse ceiling). Show the numbers for a 1 h, 3 h and 6 h/day
   player, and for strong vs average players. Every number a setting.
5. **Coin boost (2.5x):** coins only (XP stays genuine), for the next N hours of play (propose N), from a boost crate that drops
   occasionally from daily quests (propose the odds); never sold for money. **Crate bonus:** the next 5 level-ups give double crates,
   also an occasional daily-quest drop. Both: art by the API runner later (list what art is needed).
6. **Prices** as approved (key 100 = $1; crates 50/75/75; boss crate 200; bundle 400; God King and chat packs lower), 1 crate a level;
   all in settings for easy tweaks; propose the simplest sim or report that checks the average game's coins (one run, one setting).
7. **The coin reward screen:** propose the design (the existing pixel pop-up box style or a spot on the results screen; whichever
   doesn't hide the XP box: nothing hidden), coins dropping + a counter clocking up, a coin sound, GPU-cheap (a handful of pre-drawn
   coin sprites on a loop). Make a **mockup**: two or three static frames (phone and computer) as PNGs on `stills/coin-reward-mockup`
   (never docs/), from a quick HTML/canvas mock using the game's real coin art (`packages/app/src/coin/coin.png`) and fonts. Add it to
   ROADMAP.md as a planned item.
8. Update the build plan (PRs, lanes, order): what can start before Stripe keys exist.

Push the doc, the mockup stills, `.pr-body.md` (under 40 lines) and `.done`, end. Eric's-only questions: `.question`. No PRs, no CI waits.
