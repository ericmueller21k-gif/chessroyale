# The season ladder: a mockup (Nov 25, 2026)

- **Eric (Nov 25):** "a ladder board for all rank modes for the current season visible from the left panel on desktop and on mobile not sure where the button belongs yet ... icon, name, record, etc."
- **What changed:** `/ladder` (`screens/Ladder.tsx`, `ladder.ts`, `ladder.css`) on made-up rows behind `?ladder=mock|mock-in|mock-placement|mock-guest`; a Ladder item in the computer's side menu (greyed where a menu has no way to it yet); the phone's three candidate ways in behind `?ladderin=a|b|c`. No server or storage.
- **Calls made:** tabs 1 v 1 · 50 v 50 · Squads, the last two greyed ("No ranks yet": they have no rank of their own; a tap says why); your row always pinned at the foot (also lit in the list when it's on the page); top three get medals; a computer adds Games and Streak columns. Phone pick: option A, "LADDER ›" at the end of home's RANKED label. Stills and the endpoint plan: branch `stills/ladder-mockup`, NOTE.md.
