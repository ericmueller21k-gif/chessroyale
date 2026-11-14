# The Hidden Boss's speech bubble follows his size as he grows (Eric, Nov 14 playtest)

Effort high (sprites, animation timing). Boss lane (`packages/chess/test/boss-kit.test.ts`, `e2e/boss-smoke.spec.ts` plus the touched
areas' specs). New branch `claude/recluse-bubble-grows` from `origin/main`. Read `docs/areas/bosses.md`, `.claude/LESSONS.md` (and
watch it frame by frame with real taps: `npm run frames:boss`). Never write the Hidden Boss's name in player text, commits or PRs.

Eric, playing the child form online on a computer: "When he transformed [grew from 9 to 13], he said a line, except his chat box was
still thinking of his old sprite size... his face was all covered up with his chat box because it was still thinking he was the
smallest size... the chat box is out of line for all of it now." His screenshot: the 20-year-old (tall, red sweater, khakis) with
"That one's mine now." sitting over his face, the bubble's tail at his chin.

- **The cutscene too** (Eric's second screenshot, Nov 14): the man standing on the board in the spotlight, the ghost kid beside him,
  "The machines find them" in a bubble over the man's face (his eyes and mouth hidden; the tail at his chest). Every speaker's bubble in
  the cutscene (`components/RecluseCutscene.tsx`, `recluse-cutscene.ts`) sits above that speaker's head, at his drawn size, on phone
  and computer. Likely the same cause as below: fix it once for both.
- **The phase change too** (Eric's third screenshot, computer): the man glowing on the middle of the board, and his line
  "Computation without creativity is nothing. Now I have both." in a bubble floating at the far left of the screen, beside the crowd
  table, nowhere near him. Every line of his, in every phase, comes from above his head where he's drawn at that moment.
- Find how a boss's line bubble is placed over the sprite (`packages/app/src/speech.tsx` `bossVoice`, `components/RecluseChild.ts`,
  `characters/recluse-ages.ts`, `components/BossCharacter.tsx`/`BossDock.tsx`). It must sit above his head for whichever age is drawn
  now (9, 13, 20, and the man), on phone and computer, in his room's fight, a Crowd final and solo.
- When he grows, the growth finishes first, then the bubble is placed for the new size (a line said during the growth waits for it,
  or moves with it: pick the simpler one that never covers his face, and say which).
- Find the cause (why the old size was kept: a size measured once, a cached box, a CSS variable set per form...) and fix it there.
- One check added to an existing spec (or the boss kit): at each age, the bubble's bottom is above the top of his head.
- Stills: one per age with a line showing, phone and computer (a sheet is fine), on branch `stills/recluse-bubble-grows`.
Typecheck; unit tests you touch; the boss kit; the touched e2e specs. Push at each real step; `.pr-body.md` (short: cause, fix,
player-visible, checks old -> new); `.done`. No PRs, no CI waits, no model names in commits (end commits with the Claude-Session line
only). About an hour.
