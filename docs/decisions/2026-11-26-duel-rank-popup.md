# The emblem by each name in a 1 v 1, and the Ranks pop-up (Nov 26)

Eric, Nov 25: "we should also put their emblem, the emblem next to everyone... click on someone's rank and then it shows the list of
rankings". Each strip's rank is now one button: the emblem (24 px, an exact half of the 48 px art, so it stays crisp in the 34 px strip;
its box always there, empty in placements and for a bot, as on the stage) and the pill. A tap opens Ranks (the profile's `Sheet`, moved to
`components/Sheet.tsx`): every rank, the highest first, its emblem and the RP it starts at (core `rankSteps`), Placement last, the tapped
player's row marked with their name and scrolled to the middle; only the list scrolls, so the title and ✕ stay. Highest first, as the
ladder reads. On a 390 px phone long names now cut off a few letters sooner ("Annabell…"); short ones still fit.
