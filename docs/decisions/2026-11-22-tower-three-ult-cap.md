# A Battle Tower floor of three: each boss ults at most once (Nov 22, 2026)

**Eric, Nov 22** (a floor of three where Smudgy ulted twice): "I think the bosses, like when there's 3 of them, they should each be
maxed out at 1 ult, and he used 2. So let's make that a hard set rule that when there's 3 bosses, they each only use at most. They only
ult once each at most."

**What changed:** `BATTLE_TOWER.ultsOnFloorOf: { 3: 1 }` (settings.ts). As a floor of three starts the runner puts `ultMax: 1` on each
boss's powers (solo and online alike: the party's room runs the same runner; a restore keeps it; the view carries it). The dispatcher's
`ultCapped` gates it for every boss, on top of his own cap (the lower wins): after his one, its effect runs out, then the step never runs,
the meter holds empty (no gain, no strike), Chandy's "can't wait" path and the admins' trigger refuse. His meter stays on the bar, empty
and dimmed ("Rage: no more ultimates on this floor").

**Calls made:**
- One generic gate in the dispatcher, not a check in each boss's file: every boss's ultimate starts from its step's warning or meter, or
  the trigger, and all three are shut. Folio's line ask (it reads the meter ahead) gets the same guard so no engine work is wasted.
- The ultimate only: Ginger's Super Freeze and Dash's Scramble Rush are powers with meters of their own (the FAQ lists them apart from
  the ultimate) and keep their own caps. The Rush comes at a half-full rage meter, so after Dash's one Time Scramble it can't come any
  more; it nearly always comes before it. If Eric counts the Rush's "RAGE!" as an ult, say so: one more line.
- After the last, every boss's meter stays on the bar, even Smudgy's and Chub & Chirp's (which go when they're alone): nothing hidden.
- A setting by floor size, so floors of two can get a cap later by adding `2: n`. A lone floor never reads it (one boss, as everywhere).
