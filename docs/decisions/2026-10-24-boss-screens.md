# The boss screens: no line above the board, and the admins' ⚡ and 🐟 on a phone (Oct 24, 2026)

Two changes from Eric's phone screenshots of Oct 24, both for the boss battle's screens.

## 1. The "BOSS BATTLE · you play White" line is gone (every boss screen, phone and computer)

Eric: "this line has no purpose, boss battle you play white, delete it entirely." The line (`BossHeading`, `screens/Play.tsx`)
sat above the board on Boss, Crowd, Play (raids, Boss alone) and the Hidden Boss's two screens. Removed there, and its room
with it: on a computer the board's budget (`--app-h - 288px`, was 310) gives back the 22 px the line and its gap took, so the
board takes the room. On a phone the board moves up.

Each note the line carried, and where it went:

| Screen | Note in the old line | Where it is now |
| --- | --- | --- |
| Boss (`Boss.tsx`) | "the boss is beaten" | already in the dock: "🏆 You beat him!". Dropped. |
| Boss | "the boss is thinking" | already in the dock: "The boss is thinking…". Dropped. |
| Boss | "the boss strikes" | already in the dock: "💀 Struck down: …". Dropped. |
| Boss | "the boss's move" | already in the dock: "Boss plays …". Dropped. |
| Boss | "Lights Out" | nowhere on screen now (the round prompts say what to do; the ultimate's banner names it when it lands). **Judgment call**: dropped rather than prefixed to the prompt, which would shorten it on a 320 px phone. Easy to add back as a prefix if Eric wants the name. |
| Play, Boss alone (`Play.tsx`) | "the boss is thinking" | already in the dock: "The boss is thinking…". Dropped. |
| Play, raid | "N/M picked" | the dock's line: "Your move. 16/50 picked", and while waiting "Move in. 16/50 picked · Waiting for the others". **Moved.** |
| Crowd (`Crowd.tsx`), boss final | "N votes" | while the crowd counts: "Counting the votes… · 16 votes". Once the move lands the dock already says "Crowd plays … · k/N". **Moved.** |
| Crowd | "the God King's move" | the dock: "👑 God King plays …" (or "The God King answers the call…"). Dropped. |
| Crowd | "a blunder" | the dock: "?? Blunder: …". Dropped. |
| Crowd | "the God King's Last Stand" | the dock: "👑 The God King has fallen" / "He takes the blow!". Dropped. |
| Hidden Boss's phase change (`Recluse2.tsx`) | "Freestyle" (once the boards split) | the dock's second line, "Freestyle", until the clock line comes ("No added time." from the banner on). **Moved.** |
| Hidden Boss's phase 2 (`Recluse2.tsx`) | "Freestyle" | the dock's first line: "… · Freestyle". **Moved.** |
| All | "BOSS BATTLE" / "BOSS FINAL" and "you play White/Black" | dropped (Eric: delete it entirely). The boss bar above the board names the boss. |

Tests that read the line now read where its message is, with the same meaning (never loosened): `recluse.spec.ts` (the
phase change's "beaten" watch reads the dock; phase 2's "Freestyle" reads the dock's first line); `resign.spec.ts`,
`boss-speech`, `moo`, `gardener` and `smudgy` (the "keep off" lists name the dock's status box for the line they named).
Crowd, Classic and the match screen have no boss and keep their line.

## 2. The admins' testing tools on a phone: tiny ⚡ and 🐟 beside the God King (Boss alone)

Eric: "remove the Maia no guard ready etc from bottom, make the trigger ult and engine move… tiny icons next to the king's
head, a fish for engine move and a lightning bolt for ult, the idea being just out of the way so I can get a feel for what
sort of screen space we actually have when they are done entirely."

- The ⚡ (Trigger ultimate, testing) and 🐟 (Engine move) are 28 px tap targets with a 16 px glyph, muted at 60% opacity,
  full on press, 25% when disabled. They show exactly when the buttons showed before.
- They sit on the God King's line under the board's status row, left of his head: 🐟 outside, ⚡ nearest him. His speech
  bubble is on his right, so the left is free. Beside the row (a phone on its side) they stack on his right.
- Their accessible names are the same words as before (the state text, e.g. "Ultimate next turn (testing)"): the
  `aria-label` and the `title`. The 🐟's `title` is "Engine move · <the brain's line>" (a judgment call: the title needs the
  line too, and the name stays exact).
- The brain's line stays in the page, `hidden` on a phone, so the tests that read its text still can. A computer is unchanged
  (its title line, `Hud.tsx`).
- The phone's button CSS is scoped to `.boss-dock > .gk-tool`, so the computer's title line keeps its own rules.

Judgment calls, for Eric to change if he wants:
- Both icons on his left. The right has his speech bubble at head height.
- In the beside-the-row layout (a phone on its side, where the screen has room), they stack on his right, which may need
  about 32 px more than the room the layout guarantees (66 px beside the row, the king's 58 px and 8 px gap). Not yet measured
  on a landscape phone.
- The brain's line isn't visible on a phone any more (Eric's words: "the brain line gone"); a phone user can't read its
  tooltip, so the 🐟's title is for a computer's pointer only. The tests read the title on a phone.

## Tests

- `npm run typecheck`, `npx vitest run packages/app` (1,137 tests).
- New: `e2e/boss-dock.spec.ts`, "the admins' ⚡ and 🐟": on a phone, both icons beside the king, inside the viewport, below
  the status box, 28 px targets, muted; each works (⚡ names the next ultimate, 🐟 plays the engine's move as yours); the
  brain's line hidden, its words in the 🐟's title. On a computer, the title line's buttons and pill as before.
- Changed to accessible names (the state text is the same): `bigboy`, `grex`, `hollow`, `pig`, `recluse`, `sawyer`
  (`toHaveText` → `toHaveAccessibleName` on the ult button); `maia` (on a phone, the brain line hidden and its words in the
  🐟's title, where it used to fit the width and wrap).
- Specs read for the removed line and the dock's new words: `recluse`, `resign`, `boss-speech`, `moo`, `gardener`, `smudgy`.
