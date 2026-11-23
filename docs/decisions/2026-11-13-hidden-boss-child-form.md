# The Hidden Boss's child form (Nov 13, 2026)

Eric (Nov 12-13, `hidden-boss-house-NOTES.md`, "Update 3"): a new first form, the child, before today's adult form; no powers, a
kid's lines; Maia from about 1800, +100 every 4 moves (all moves) up to Maia's cap; he grows (the drawn ages) as his level rises,
with a level-up at each step; his room's theme, then the adult's with the existing fades; beating him starts a new match against
the adult form; the admins' 🏆 works in it.

Calls made (helper, boss lane):
- **"Every 4 moves (all moves)"** = every 4 moves on the board, both sides' (plies), counted from the form's start. 1800 to Maia's
  cap: seven steps, the top after 28 moves on the board (his 14th move).
- **Maia's cap is 2500** (`maiaTopRating`, BOSS_BRAIN.maiaRating's last point, "Maia's ceiling", DECISIONS.md), which is the adult
  form's own brain, so the child at the top plays exactly as the man. Read from there, never typed again.
- **The ages:** three drawn ages (9, 13, 20 in the black suit) plus his adult look; Eric's "5 drawings" became these four (the
  mockup he approved). By Maia rating (`RECLUSE_CHILD.ages`): 13 from 2000, 20 from 2200, his adult look at the top (2500). A test
  checks the last is the top. The growing step is the mockup's `RECLUSE_GROW` (reused, not new); beaten, he grows straight up into
  his adult look (the same step, from his age to the man) before the new match.
- **"No powers"** means no passive and no ultimate: the God King's help works against the child (his "No help" is the man's). He
  still never strikes (his fight is a squad's), and starts from the starting position.
- **The level** shows (not "???") from his rating, climbing a step at a time; each new level pops once (BossLevel keys its element
  by the level while it's up). It stays gold with the arrow from the first step: he's above where he started.
- **The new match:** the board from the start (a mate in one again under `?win=1`), his powers and the clocks fresh, the crowd's
  move count, strikes and the God King's record cleared; the God King's charges carry on (the crowd's for the whole fight). A draw or
  the child winning ends the fight, as the man's does.
- **Where:** solo (an admin's Boss alone, and a solo Crowd's boss final), by `settings.recluseChild`, which only solo sets
  (`?form=adult` starts at the man: the adult form's e2e use it). Online waits for the online job's form list
  (`claude/recluse-online-phase2`, not on main when this was built): the runner's `nextBossForm` is the step it calls.
- **Lines:** placeholders (ours), a boy's voice, never his name; the man's muttering (`RECLUSE_TALK`) stays off in the child form.
