# The 50 v 50 rework, C3: the screens (Nov 17, 2026)

Step C3 of `notes/designs/crowd-rework.md` (rules 6 and 8, the app part of section 3; mockups `crowd-cut`, `crowd-podium`).
Eric, Nov 16: "make sure there's a spectate option; I'm sure late game players wanna spectate who barely lost to see how it ends."

**Built:** the top bar's countdown (`cutCountdown`: "cut in 2", "4 v 4 next" on a cut's own move in place of "cut now", "1 v 1 from
move 43", "1 v 1"); one "1 V 1!" banner (the boss battles' `FightBanner`) on the 1 v 1's first turn; the cut screen out (`CutOut`):
place and gap, "Why was I cut?", a fixed still-in box, Spectate | Leave the match at its foot; the podium results (`Podium.tsx`); the
FAQ's 50 v 50 section and the landing page's answer, from the rework's settings (`CROWD_PRE_REWORK` no longer read by them).

**Calls made here:**
- **Spectating is the watch screen** (the live board, the picks coming in, the scoreboard), solo and online: the least new code.
  Online the server now sends a cut player in the rework the team-not-picking's rounds, tallies and reveals (`spectatorsWatch`);
  before, only boards and standings after each move. Not tapping either button spectates once the break ends; solo, Spectate ends
  the break now; online it shows "from the next move". Solo no longer fast-forwards the rest in the rework (`watchesToEnd`).
- **A narrow phone's top bar** (to 480 px) has about 60 px under "Move 34": "to 34v34" and "1v1 at 43" there (`shortCountdown`;
  "34 v 34 next" was 9 px too wide at 360 px), the full words above.
- **The out view has no chat box** (it ran under the foot on a phone): chat is the scoreboard's tab while spectating.
- **Still in: "50 v 48"** when ties at the line leave the sides uneven for a while; "4 a side" when even.
- **RP's spot** on your row: "— RP · ranks soon", greyed, until C5.
- **The breakdown's cut line is your team's** (each side is cut on its own; it was the lowest of both).
- **The FAQ's Hidden Boss** is met in his room only: the Crowd's boss final's lines went (Boss Battle, his block, his strength,
  the God King's charges).
