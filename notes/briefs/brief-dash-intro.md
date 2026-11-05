# Brief: Dash's challenge intro, into the game (round 3; code; Opus high)

Worktree `/home/user/cr-dashintro`, branch `claude/dash-intro`, from main (the director creates it). Run `npm ci`; never symlink
node_modules. Push as you go. Ports 8987, inspector 9487. Include notes/briefs/rules-common.md. Dash is in the game for admins first
(BOSS_ADMIN_FIRST), so this reaches admins; leave that list alone.

**Why:** Eric (Nov 5): "I just played Dash and he didn't even do the dash stuff, it was the default thing. He's supposed to run and
grab the board etc." Round 3 was never built. His challenge still uses the default intro (`challenge.ts` BOSS_INTROS `dash`, `custom:
false`).

**Art** on `origin/claude/boss-art`, drawn Nov 3 (`90b3bd56`). Read it with `git show`, starting with `scripts/boss-art/out/intro-blitz-nov3.md`,
whole. The ids keep `blitz`:
- `out/boss-blitz/boss-blitz.ts`: `BOSS_BLITZ_INTRO` (bolt, arrive, dashBy, brag, idle).
- `out/house-intro-blitz/house-intro-blitz.ts`: the shoebox table, the props, and the clock-rush wipe.
- The view script `scripts/boss-art/intro-blitz-view.ts`.

Copy them in as Timber's, Jefferson's and Ginger's were (`town/shops/*-intro-art.ts`, lazy-loaded).

## The intro (Eric's design, his words in the notes; boss LEFT, you RIGHT; about 9 s and then the cover)
You both walk to your marks and he says his line. Then he bolts off four times, leaving a trail of dust, and each time races back to
drop something at the spot:
1. the shoebox table;
2. the board;
3. the pieces, with a pop;
4. both stools.

Then his brag (he dusts off his jacket and finger-guns you), the God King attack swing (as for the other bosses), then **the clock
rush wipe** (numbers, clock/time themed) as the screen cover.

Wire it as Ginger's and Jefferson's are (`town/shops/intro.ts`, `BOSS_INTROS` `custom: true`, `CHALLENGE_FEEL`):
- Every beat is a feel number.
- The real board is the game's.
- Nothing pops in at the end: the table, board, pieces and stools are all in place before any cover, and nobody steps after the
  stools land.
- His generic cues (whoosh, skid, drop, thud, pop, tick, brush, ding) each get a sound, either reusing existing synthesized ones or
  new ones that pass `boss-sounds-finite.test.ts`.
- **Sprites always on screen (Eric, Nov 4)**, including where each bolt ends, except mid-run.
- No emoji for him anywhere (Nov 5 rule).

## Done
- Unit: beats in order (about 9 s to the cover), every cue has a sound, the drops land where the table and stools stand.
- e2e: `e2e/boss-challenge.spec.ts` challenging Dash (as an admin, in his store), with his intro playing to the board and back to the
  town; the existing "default intro" expectation becomes his own.
- Stills in `docs/dash-intro/`: the bolt, a drop, the pieces' pop, the stools landed, the brag, the wipe. Phone and computer, no GIFs.
- PR body in `docs/dash-intro/pr-body.md`: every player-visible change, changed checks old → new, and the lane (the boss lane).
- Push, but don't open a PR. Send a short report.
