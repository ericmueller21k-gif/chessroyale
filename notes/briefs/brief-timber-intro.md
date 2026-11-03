# Brief: Timber's custom challenge intro (Opus high)

Worktree `/home/user/cr-timberintro`, branch `claude/timber-intro`, from main (Timber's Lumber Lodge, #472, is merged). Push as
you go.

**Art** on `origin/claude/boss-art` (read with `git show`; copy into the app as Alfil's and Big Boy's intros were):
- Notes: `scripts/boss-art/out/intro-timber-nov3.md`: read it whole first (exports, feet, cues, the suggested 12.6 s timeline,
  the calls Eric may change).
- Timber's moves: `BOSS_BEAVER_INTRO` (id `timber-intro`), `TIMBER_INTRO_LIFT_AT`, `TIMBER_INTRO_REACH` in
  `scripts/boss-art/out/boss-beaver/boss-beaver.ts` (only lines added there: copy just those).
- The props: `scripts/boss-art/out/house-intro-timber/house-intro-timber.ts` (log, shavings, table + palette + ink, stump,
  storm and front).
- The mockup: `scripts/boss-art/intro-timber-view.ts` and `house-intro-timber/view-intro-sequence.gif` show what Eric approved.

**Eric's design:** Timber walks in; a giant log lies on the LEFT; he lifts it, carries it to the middle where the board goes and
sets it down; he gnaws it; a storm of shavings and sawdust boils up like fog and hides it; it settles and he has chewed it into the
table with the board; the seats are little wooden stumps (they pop up). Boss on the LEFT, you on the RIGHT. About 12 s in all (Eric's
target; the notes' timeline is 12.6 s with the sweep: fine). His own sounds (`timber-sounds`; map each cue in the notes to one).

**Wire it** as Alfil's and Big Boy's custom intros are (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, `<boss>-intro-art.ts`):
- `BOSS_INTROS.timber`: custom, layout as his room's ("across", his marks W/E as the shop already uses). Every beat a number in the
  feel (no magic numbers in the code).
- The log, his walk/lift/carry/setDown/gnaw/done, the shavings rise/hold/settle (swap the log for the table and stumps under the
  hold), the stumps' `pop`, then he walks to his mark, then the God King attack swing before the cover (as for Alfil and Big Boy),
  then the sawdust sweep (`INTRO_TIMBER_STORM` + `INTRO_TIMBER_FRONT`, played like Alfil's sandstorm) as the screen cover.
- The real board is the game's (the art's board is a stand-in). The table uses `INTRO_TIMBER_TABLE_PALETTE`.
- Mirror his walk to go left. He's drawn facing right in the intro.
- Lazy-loaded art; the town's frame loop unchanged; phone first.
- Everyone else in the town sees what they see for the other bosses (you both go inside; nothing new for onlookers).
- His line: the existing "Hard hats on. We're building today." stays.
- Timber is admins first: nothing changes for players.

**Done:**
- Unit: his intro timeline (beats in order, total about 11–13 s), every cue has a sound, the stumps sit at the table's foot ± 37, the
  log hidden when `lift` starts, the table and stumps swapped in under the shavings' hold (never visible before).
- e2e: extend `e2e/boss-challenge.spec.ts` with Timber's challenge as an admin (the intro plays to the board; no errors).
- Stills/GIF in `docs/timber-intro/`: a GIF of the whole intro on a phone (390x844) and one frame on a computer; the table with
  the stumps after it settles.
- PR body `docs/timber-intro/pr-body.md`: every player-visible change, changed checks old → new, the lane (targeted, the challenge
  area). Push; no PR. Then stop with a short report.

Include and follow `notes/briefs/rules-common.md`.
