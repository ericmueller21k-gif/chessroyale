# Brief: Hollow's custom challenge intro (code; Opus high)

Worktree `/home/user/cr-hollowintro`, branch `claude/hollow-intro`, from main (f7b2aa5f: Hollow's cave, #480, is merged and live).
Set it up with `git worktree add` + `npm ci` (never a node_modules symlink). Push as you go. Ports: 8961, inspector 9461.
Include notes/briefs/rules-common.md.

**Art** on `origin/claude/boss-art` 3238dbf4 (read with `git show`; copy into the app as Timber's and Dash's intros were):
- Notes: `scripts/boss-art/out/intro-hollow-nov3.md`: read it whole first (exports, feet, cues, the timeline, the calls).
- His moves: `scripts/boss-art/out/boss-hollow/boss-hollow.ts`, `BOSS_HOLLOW_INTRO` (id `hollow-intro`: charge, swell, drink,
  full, settle, idle; 104 x 102, foot [50, 96]). Built from the game's `characters/hollow.ts` rig; leave `hollow.ts` as it is.
- The props: `scripts/boss-art/out/house-intro-hollow/house-intro-hollow.ts` (lanterns going out, bulbs dark one at a time with
  `INTRO_HOLLOW_BULB_RUN`, the tree draining, the motes, the orb glow, `INTRO_HOLLOW_DARK`, `INTRO_HOLLOW_DIMPOOL`).
- The mockup: `scripts/boss-art/intro-hollow-view.ts` and `house-intro-hollow/view-intro-sequence.gif`: what Eric approved.

**Eric approved the intro (Nov 3) with these changes. Follow them exactly:**
1. **Nothing jumps in the dark.** In the mockup the table and stools appear during the black and you both step to your seats, so
   when the dim light comes up you've "stepped away". Instead: the **basic table and stools** (the default intro's: the town's
   park table, as for Babur/Puddles), brought in the way the default intro brings them, **while it is still lit**, before he
   starts to charge. You both **walk on straight to your seat spots** (his hop-back place `BossIntro.clear` 2.92, yours the usual)
   and stay there: no hop-back later. In the black and the dim light nothing moves or appears; only the light changes.
2. **A line when he starts to channel** (a second bubble at the charge's start; his entrance line "Did you leave a light on?"
   stays at the walk-on). One picked at random each time, from:
   - "The dark is misunderstood."
   - "It's not the dark you fear. It's not knowing what's in it."
   - "Shh. The dark never hurt anyone."
   - "Nobody ever asks the dark how it feels."
3. **The light-drinking 15% faster:** the drain (lanterns, string, tree, his strand, your pawn: 5.5–12.2 s in the notes, 6.7 s)
   to about 5.7 s, every gap scaled by 0.85; the lanterns still one by one, each seen on its own. The whole intro about 14.8 s.
4. **Kept as drawn:** the lantern order (far to near, the nearest last), the string west to east then the tree up to its star, his
   eyes as two dim violet slits in the black (~0.9 s), the cool violet-grey dim light (steady, no flicker), the "Player" tag fading
   as the drain starts.
5. **Into the match (the director's call; Eric may change it):** no second blackout and no storm cover. From the dim light the
   pool **closes in on the board** (an iris to the table, about 0.6 s), and the match screen comes up out of that dark (fade in
   from black). Every beat a number in the feel.

**Wire it** as Timber's and Dash's custom intros are (`town/shops/intro.ts`, `BOSS_INTROS`, `CHALLENGE_FEEL`, `hollow-intro-art.ts`):
- `BOSS_INTROS.hollow`: custom, layout across, on his pond's marks. Every beat a number in the feel (no magic numbers in code).
- The cave's own lights go out with the art: each lantern's light and pool off as its lantern goes out (the shop's `lightsAt`
  lights), the bulb pieces dark in `INTRO_HOLLOW_BULB_RUN` order, the tree's lights, the motes flying to the orb, the room into
  `INTRO_HOLLOW_DARK`, then `INTRO_HOLLOW_DIMPOOL` round him, you and the table. When you come back from the match, the cave is lit
  as before.
- The real board is the game's (the art's board is a stand-in).
- His sounds: map every cue in the notes to a sound (his existing ones where the notes suggest; new ones synthesized like the others
  in the MAKE table: they must pass `boss-sounds-finite.test.ts`: no NaN at any sample rate).
- Lazy-loaded art; the town's frame loop unchanged; phone first.
- Everyone else in the town sees what they see for the other bosses (you both go inside; nothing new for onlookers).
- Hollow is live: this goes to everyone.

**Done:**
- Unit: his intro timeline (beats in order, total about 14–15.5 s, the drain about 5.7 s), the table and stools in before the
  charge, no figure moves and nothing appears after the drain starts, every cue has a sound, a channel line from the four, the
  cave's lights restored after.
- e2e: extend `e2e/boss-challenge.spec.ts`'s Hollow challenge (the intro plays to the board; no errors).
- Stills/GIF in `docs/hollow-intro/`: a GIF of the whole intro on a phone (390x844) from the game itself, one frame on a computer,
  and stills of the dim light and the iris into the match.
- PR body `docs/hollow-intro/pr-body.md`: every player-visible change and new text, changed checks old → new, the lane (targeted,
  the challenge area). Push; no PR. Then stop with a short report.
