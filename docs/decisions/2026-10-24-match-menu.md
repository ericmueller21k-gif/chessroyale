# The match menu on a phone: a gear, a list in the middle, motion switches, a confirm before Report a bug (Oct 24, 2026)

**Eric, Oct 24, his words:** "we wanna add the settings to the 3 dots in the top right, it has surrender and stuff now, we
wanna add motion on/off here as well as a toggle, change the … to a gear like normal settings, the menu should be
converted to a center of the screen list and the background becomes blurred/faded. the current one uses large buttons on
the bottom. I don't like it. Just a list like I said, an X in the top left or right but also tapping anywhere off the menu
will take it away. If you hit submit a bug it gives a confirm first because it would take you off the screen. We wanna see
what other gameplay options could be inserted here easily that people might want."

## What changed (a phone only; a computer's top line is as it was)

- **The gear.** The "⋯" in a match's top line is a gear (an inline SVG, `GearIcon`, about 20 px), in the same button: the
  same `.mm-more` class, the same place, the same 36 px box, the same "Match options" name.
- **A list in the middle of the screen.** The "⋯" sheet at the foot is now a card in the middle (`role="dialog"`, named
  "Match options"; `width: min(320px, 100vw - 32px)`), with a title row: "Options" on the left and an X on the right
  (`aria-label="Close"`, 44 px). Under it, one row per item: about 48 px, the label on the left, its control on the right,
  a thin divider between rows. No large buttons.
- **Blurred and faded background.** The layer behind the list is `rgba(0, 0, 0, 0.45)` with `backdrop-filter: blur(6px)`.
  A tap on it, outside the card, closes the list. The X closes it; Escape closes it. A 150 ms fade for the layer and the
  card, none under `prefers-reduced-motion: reduce`.
- **The rows, in order:**
  1. Sound (the same switch as before).
  2. Animations and 3. Motion trail, only in a crowd match (Crowd, and a raid, which is also a crowd match in the
     settings). They read and write the same preferences as Settings → Board, with the same rule: the trail is off and
     can't be switched while the animations are off. Both screens re-read the preferences when one of them changes.
  4. Resign, or Leave the match (when there is an exit): as before, it opens the confirm.
  5. Report a bug: now opens a confirm first (see below).
- **Confirms.** Resign and Leave keep their words and buttons, and their Cancel closes the menu as before. The phone's
  confirm is now in the middle of the screen, over the blurred match. Report a bug has its own confirm: Cancel goes back
  to the list; Report closes the list and opens the feedback sheet, as before.

## Judgment calls and why

- **The confirm covers the board on a phone.** The Oct 13 rule was that nothing dims or covers the board. Eric's Oct 24
  words ask for a blurred, faded background with the list and the confirm centered over it, so on a phone the board is
  covered on purpose. A computer keeps its rule: the flag's confirm sits beside the flag, with nothing dimmed. The
  computer's layer keeps its own class (`.mm-scrim` without `.mm-full`), so the computer's confirm is unchanged.
- **Motion rows only in a crowd match.** `MatchMenu` takes an optional `crowd` prop, which `Hud.tsx` passes from its
  `isCrowd(match)` (`settings.mode === "crowd"`). A raid is a crowd match, and so is Boss alone (a raid of one), so the
  rows show there too: a raid has the same picks. Every other caller (the pre-game vote, a duel, Squads) passes nothing.
  The pre-game vote screen of a crowd match therefore has no motion rows; the picks only start after it.
- **Report a bug's confirm words.** The form is a sheet over the screen, dimmed; the match keeps going underneath (the
  match is not paused or unmounted by `openReport`; the e2e "problems" spec checks the game runs on under the form). So
  the confirm says: "Report a bug? The report form covers the game. Your match keeps going."
- **The gear is a drawn SVG**, not an emoji, like the flag, so it looks the same on every phone.
- **`ConfirmExit`'s place is "center" on a phone** (it was "sheet", a foot sheet). Its name follows what it is now.
- **Settings are unchanged**; the list uses the same preferences, so Settings → Board still has both switches.

## Player-visible text changes

| Where | Before | After |
| --- | --- | --- |
| Phone, match top line: the button's name | "⋯" (a dot-ellipsis glyph) | a gear icon (no text); its name is still "Match options" |
| Phone, the list's title | (none) | "Options" |
| Phone, list rows | "Sound", "Resign" / "Leave the match", "Report a bug" | the same three, plus "Animations" and "Motion trail" (crowd matches only) |
| Phone, Report a bug, first step | (none: the feedback sheet opened at once) | a confirm: "Report a bug?" / "The report form covers the game. Your match keeps going." with Cancel and Report |
| FAQ, "Leaving or resigning" | "on a phone, tap **⋯** at the top right of the match, then **Resign**" | "on a phone, tap the **gear** at the top right of the match, then **Resign**" |

## Tests

- `e2e/match-menu.spec.ts` (new, registered in `e2e/areas.json` under "results, resign and leaving a match" and in
  `e2e/ci-timings.json`): the gear (an svg, no "⋯", the 36 px box); the list centered within 8 px at 390 × 844 and
  428 × 777 over a blurred layer; the X, a tap outside and Escape close it; Sound mutes and unmutes; in a crowd match the
  Animations and Motion trail rows, the lock, and the same values in Settings → Board and back; in Classic no motion
  rows; Report a bug's confirm (Cancel to the list, Report to the feedback sheet); Resign's centered confirm still
  resigns; a computer's top line unchanged (no gear; Report a bug opens the feedback sheet at once).
- Updated where the new behavior requires it: `e2e/resign.spec.ts` (on a phone the confirm is checked as centered over the
  blurred match; the computer keeps its "nothing covers the board" checks); `e2e/problems.spec.ts` (the phone's path clicks
  Report in the new confirm). `packages/app/test/faq.test.ts` (the FAQ's words). The other specs that name "Match options"
  (`crowd`, `kill-switches`, `ranked-1v1`, `recluse`) click the gear and the list as before and were not changed.
- Unit tests: `npx vitest run packages/app` and `npm run typecheck`.

## Options for later (not built; for Eric to choose from)

Preferences that already exist (easy to add to the list; they're read and written by `prefs.ts` and `sound.ts`):
- Board colors (classic, green, gold): the board's dark squares. Every mode.
- Quick chat on or off, and the new-message bubble. Matches with chat (online).
- Sound on or off, and the move, capture and reveal sounds (pickers). Every mode.
- Squads: "Jump to my next board". Squads only.
- Under-board view (the scoreboard and chat: split, board or chat, folded or open). Phone, matches with chat.
- Testers only (shown to admins): the eval bar and practice mode. Not for players.

New work, each small to medium:
- Coordinates on the board (show or hide the file and rank letters). The board draws them always now; needs one pref and
  one check in the board's drawing. Every mode.
- Confirm before each move (a second tap to play a move). Needs a pref and a step in the move's submit; in Crowd and raids it
  would confirm each team pick. Classic, Duel, Boss alone.
- Haptics: a short buzz on your move, on check, on your turn. `navigator.vibrate` already appears in two places (the
  crate opening and the duel queue pop) and works on Android only; a pref, and a check of each move. Every mode.
- Keep the screen awake during a match (the Wake Lock API, where it exists). Needs a pref and a release when the match ends.
  Every mode on a phone.
- Show legal moves, or the last move, as a toggle (the board draws its own today; a pref decides whether it does). Every mode.
- Auto-promote to a queen (skips the promotion picker). Classic, Duel, Boss alone.

## Lessons checked

- The phone's list and its confirms are measured in both schemes and at 390 × 844 and 428 × 777 (the new spec measures the
  centering and the blur), and the computer's confirm is checked against the board as before.
