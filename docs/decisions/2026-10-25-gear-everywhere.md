# The gear on every screen with a chessboard, phone and computer: Sound, Animations, Resign or Leave, Report a bug (Oct 25, 2026)

**Eric, Oct 25, his words:** "the settings… anywhere that there's a chessboard, we're putting the settings in there, and then
it will have like the resign, the report a bug, the option… for animations, and then like sound as well… That's going on
desktop. Mobile, everywhere. Putting the gear for the settings, it may just… be placed slightly differently, but it should be
basically top right but on desktop, not technically all the way top right, just like where I see it now is fine, like where
the flag and the volume already sit."

Eric names both platforms, so this is the rule for both.

## What changed

- **One control, the same on a phone and a computer.** The gear (`MatchMenu`, `components/MatchMenu.tsx`). On a computer it
  replaces the sound button, the flag and the separate Report a bug button, at the right end of the title line where the
  sound button and the flag sat (over the board's column). The computer-only flag, sound button and bug button are gone.
- **The same list everywhere:** Sound; Animations (every mode, not only crowd matches); Motion trail (crowd matches only, and
  off while Animations are off, as before); Resign or Leave, as `MatchExit` says; Report a bug. Each row works as it did on a
  phone.
- **The same confirms everywhere:** the list is in the middle of the screen over the blurred match, and so are Resign,
  Leave and Report a bug's confirms. Report a bug asks first on a computer too.
- **Auto chess** (`screens/AutoChess.tsx`): the gear at the top right of its title row, on a phone and a computer, with
  Sound, Animations, Leave (the back button's action, asked first with "Leave this game?"; the back button stays) and Report a
  bug.
- **Other screens with a chessboard and no top line** (found by looking for `Board` and `MiniBoard` in `screens/` and
  `components/`): the openings before move 1 (`OpeningGrid`), Watching for the knocked out (`Spectate`), a stage break
  (`StageBreak`) and the results (`Results`). Each has the gear in its top right corner (`.mm-corner`, placed over the
  screen's padding, so nothing below moves). Their rows are the same list; Leave or Resign appears where `exitFor` offers it.

Screens with the gear, in all: every match screen that uses `Hud` (Classic and Crowd play, watching, reveal, the cut's
boards, the boss battle, the final, the simul, the phase change), Duel, Squads' match and votes, Classic's vote screen,
Auto chess, and the four above.

## Judgment calls and why

- **The computer's confirms are centered over the blurred match.** Until now a computer's Resign confirm sat beside the flag and
  nothing dimmed the board (Eric, Oct 13; docs/decisions/2026-10-24-match-menu.md kept that for computers). Eric's Oct 25 words
  ask for the same list and the same centered confirms on both, so the computer's confirm follows the phone's and covers the
  board the same way. This reverses the computer's "nothing covers the board" rule. The e2e check that a computer's confirm
  stays clear of the board, the clocks and the move bars is retired with it. Director: this is the one place the
  brief changes an earlier rule, so it is flagged here.
- **Animations in every mode.** The pref is the same one Settings → Board sets, and it already drives the picks' ghost pieces
  in Crowd, raids, the reveals, Classic's vote, Duel's vote and Squads. Nothing new is wired for a non-crowd match: the row
  just reads and writes it.
- **Auto chess's Animations switches off the board's piece glides.** The board's `animate` prop (on in the move and fight
  steps) makes its pieces jump to their squares when it is off, the same way the Vote screen's board uses it. Its pawn hops,
  the fight's effects and the coin floats are unchanged.
- **Auto chess's Leave says "Leave this game?" and "Nothing is recorded."** The game is client-only and records nothing (its
  area page), so leaving loses nothing that is kept. The row reads "Leave", the screen's words; `MatchExit` takes optional
  `row` and `ask` for a screen that words its leave its own way.
- **The admins' testing items stay where they were** on a computer's title line, before the gear. The rule that hid the
  bug button when they filled the line is gone with the bug button: the gear is one button, as the flag and sound button
  were.
- **Not added: Home's live window.** On a wide screen the front door has a column of live boards of other matches
  (`screens/Home.tsx`, `LiveWindow`). It is the front door, not a match screen, and the front door's top bar already has its own
  gear for Settings. Director: say if Eric wants a match-options gear there too. Settings' board-color swatches are three
  colored squares, not boards, so they have none.

## Player-visible text changes

| Where | Before | After |
| --- | --- | --- |
| Computer, match title line | a sound button, a flag ("Resign" / "Leave the match") and a 🐞 "Report a bug" button | one gear, named "Match options" |
| Computer, the list | (none) | "Options", with Sound, Animations, Resign or Leave, Report a bug |
| Computer, Resign or Leave confirm | beside the flag, nothing dimmed | centered over the blurred match (the same words) |
| Computer, Report a bug | the feedback sheet at once | "Report a bug?" / "The report form covers the game. Your match keeps going." with Cancel and Report, first |
| Phone and computer, the list in a non-crowd match | Sound, Resign / Leave the match, Report a bug | the same, plus "Animations" |
| Auto chess, top right | (none; the back button only) | the gear: Sound, Animations, "Leave", Report a bug |
| Auto chess, Leave's confirm | (none) | "Leave this game?" / "You go home, and this game ends. Nothing is recorded." with Cancel and Leave |
| Openings, Watching, a stage break, the results | (none) | the gear in the top right corner |
| FAQ, "Leaving or resigning" | "on a phone, tap the **gear** at the top right of the match, then **Resign**; on a computer, click the **flag** beside the sound button." | "tap the **gear** at the top right of the match (on a computer, click it), then **Resign**." |

## Tests

- `e2e/match-menu.spec.ts`: the gear and its list on both platforms; a computer's title line has the gear where the sound button
  and the flag were (no flag, sound button or bug button); the list's rows in a crowd match and in Classic (Animations in both);
  Report a bug's confirm and Resign's centered confirm; Auto chess's gear, its rows, Leave asked first and Leave going home.
- `e2e/resign.spec.ts`: every resign is opened through the gear and checked as centered over the blurred match, on both
  platforms. `e2e/problems.spec.ts`, `e2e/recluse.spec.ts` and `e2e/ranked-1v1.spec.ts` open the report and resign through the
  gear on both platforms. `e2e/helpers.ts` `soundOff` uses the gear.
- `packages/app/test/faq.test.ts`: the FAQ's resign line.
