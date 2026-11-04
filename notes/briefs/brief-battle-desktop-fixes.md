# Brief: boss fights on a computer: the figure that jumps off the page, bigger figures, the cave's speech bubble (Opus high)

Worktree `/home/user/cr-battlefix`, branch `claude/battle-desktop-fixes`, from main (33ad8967: Hollow's intro, #481, is live).
Set it up with `git worktree add` + `npm ci` (never a node_modules symlink). Push as you go. Ports: 8971, inspector 9471.
Include notes/briefs/rules-common.md.

Eric's report (Nov 4, desktop, Chrome, a 2000-px-wide window, fighting Hollow; his screenshots described here):

## 1. Bug: Hollow jumps out of the page when he throws his darkness
In the Boss Battle on a computer Hollow stands by the board's bottom-left corner. When he throws his darkness (the dark square he
drops on the board, at d5 / c1 in Eric's game), his figure is drawn at the **top-left of the board, half off the top of the
browser**, cut off, while **his speech bubble ("You'll pay for that.") stays down at the bottom-left** where he should be.
- Find the cause (`components/BossCharacter.tsx`: the move beat's `translate` at ~line 327; its doc says "A computer's figure stays
  where it is"; `characters/hollow.ts` and `boss-beats.ts` for his throw). Fix it at the root, for every boss whose beats move the
  figure, not only Hollow. Check the phone's placement (the bar above the board) is unchanged.
- Unit or e2e check: on a computer, through every beat of each boss's move/attack, the figure's box stays where it stands (inside the
  viewport) and its bubble stays with it.

## 2. Bigger figures on a computer
Eric: "we have space on the desktop. They should be kind of bigger." The boss (left, by the board's bottom-left) and you / your God
King (right, by the bottom-right) look small next to the board, and much smaller than in the cave. He also asked **what size they
were before and whether something changed**: check the history (`git log -S` on the sizing in `styles.css` / `BossCharacter.tsx`,
e.g. #443 "computer game screens") and say in the report what they were and when it changed.
- Make both sides bigger on a computer, sized by the room beside the board (they must never cover the board, the moves list or the
  top bar, and never leave the page), at 1280 x 800, 1440 x 900, 1920 x 1080 and Eric's ~2000 x 1250. One number in the feel/CSS
  variables, not scattered. Big bosses (`kit.tall`/`wide`) still fit. Phone unchanged.
- Stills before and after at each of those sizes, with Hollow and one wide boss.

## 3. The cave's speech bubble is too small and too high (every shop's intro line)
In Hollow's cave on a computer his intro line ("Did you leave a light on?") is drawn in a bubble **the size of a name tag**, and
**far above his head**. Eric: about **three times the size**, a normal speech bubble for the character's size, and **just over his
head**. This is the challenge intro's bubble in the shop rooms (`town/shops/ShopRoom.tsx` / `intro.ts` / `challenge.ts`), so fix it
for every boss's intro line and Hollow's new channel lines. Check the phone too (it must stay readable and on screen there; say what
it looks like before and after). Keep it inside the view at the far camera.

## Not now
The board's placement on the fight screen (Eric: "leave it as is").

## Done
- Typecheck; the unit tests you change or add pass; the e2e you touch pass under the lock.
- Stills in `docs/battle-desktop-fixes/`: Hollow's throw on a computer before/after; the figures at the four sizes before/after;
  the cave bubble on phone and computer before/after.
- PR body `docs/battle-desktop-fixes/pr-body.md` (every player-visible change, changed checks old → new, the lane). Push; no PR.
  Short report: the root cause of 1, the old sizes and when they changed for 2, and the still paths.
