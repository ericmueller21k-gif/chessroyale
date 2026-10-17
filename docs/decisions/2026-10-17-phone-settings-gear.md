# A Settings gear on a phone's home, and long names that ellipsize (Oct 17, 2026)

**Decision (Eric):** "if you want to go into the settings in the game, you can click on the left on desktop, but on
mobile you have to click on your profile first and then you have to click settings … we should add a tiny settings
icon next to the player profile and the coin icon in the top right."

- **The gear:** a phone's home top bar is now the logo, your coins, your pawn, then a gear (`fd-icon-btn`, the
  `GearIcon` the side menu and your profile already use; accessible name "Settings"). One tap opens Settings exactly as
  Profile → Settings does (Back is home).
- **Phone only (my call):** it lives in the phone's top bar (`.fd-top`), which a computer (1024 px+) never shows: there
  Settings is already in the side menu, and a second gear top right would be two ways to one place side by side. Tablets
  under 1024 px have no side menu, so they get the gear. The computer's home measured identical before and after at
  1280×600 and 1366×768.
- **Order (my call):** the gear goes last, at the far right corner (where settings sit in most apps), so your coins and
  your pawn stay together as they are on a computer.
- **Fit:** measured at 320 px with 99,999 coins: logo 18–113, coins 121–202 ("99k": the coins' word steps out first, as
  before), pawn 208–252, gear 258–302, in one row with room to spare.

**Home's sideways scroll at 320 px (found by #258's helper):** the cause was the home card's name line
(`.fd-hero-name`): it had no `white-space`/`overflow` rule, so a 16-character name with no break point (288 px wide in
its 20 px bold) ran out of its 188 px box and the card, pushing the page 64–96 px wider than a 320 px phone (24 px at
360 px). The top row and the RANKED row were fine. It now ellipsizes on one line, as names do elsewhere.

Tests: `e2e/home-layout.spec.ts` (the gear opens Settings and fits at 320, 360, 390 px; no sideways scroll at those
widths in light and dark with a 16-character name and 99,999 coins; the computer at 1280×600 and 1366×768 has no gear
and is unchanged).
