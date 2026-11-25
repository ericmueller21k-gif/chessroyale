# Home: PLAY at the bottom, no mode picked until you tap one, Friends in the top bar

Eric, Oct 18 (after #285):

> play should be at the bottom… it should be like slightly dimmed out unless you've selected your mode… we should have
> the default that there's no mode selected… the way you actually queue is by having to tap the mode you want.

Asked where the Boss raid card and Play with friends go: "Boss raid above, play with friends in mobile is hidden behind
friend button at top you tap it then there's a get friend code button and it copies to ur clipboard." Asked where that
button fits (a fourth round button doesn't fit beside the coins below about 400 px): "Coins and shop are one button."
On what the code makes: "Friend lobby is a great idea… the code is good too, what do you think?"

## What changed

- **The order** (phone and computer): your card, the Boss raid card (full width), the RANKED row, its panel, then PLAY
  and its line at the bottom. A computer has the live window above, as before. This reverses #284's "PLAY under the
  modes, the Boss raid card under PLAY" and goes back to Oct 9's "PLAY at the bottom".
- **No mode picked when home opens.** PLAY is dimmed (disabled) and the panel says "Tap a mode above to play". Tapping
  50 v 50, 1 v 1 or Squads lights PLAY.
  - **My call:** the pick holds while the app is open (after a match, home shows it again) and is gone when the app
    opens again (a reload or a new launch). It is not saved on the device, since a saved pick would mean a mode is
    picked when the app opens. `?mode=` in a link still picks one.
- **The phone's top bar:** logo, your pawn, the shop bag, Friends, gear. **No coins at the top**, on a phone or a
  computer (Eric, later the same day: "We don't need the coins showing at the top… You can go to your profile to see
  your coins. You can go to the shop to see your coins."). With the coins gone there is room for the bag again, so the
  "coins are the shop's button" step is undone before it shipped.
  - **Friends** opens Play with friends (the same sheet a computer's side menu opens). A count shows on it when you
    have friend requests or invites, instead of on your pawn.
  - **Your coins on your profile:** the shop already showed your balance; your own profile didn't, so it now has a
    gold "● N coins" pill beside your rank (my call, so what Eric expects is true).
- **Play with friends is no longer a button on home** (phone or computer). On a computer it stays in the side menu.
- **Get friend code** (my call: the "friend lobby"). Play with friends already made a private lobby with a code and an
  invite link, so this reuses it:
  - "Get friend code" makes a lobby in the row's pick (50 v 50 when none is picked, or with 1 v 1 or Squads picked;
    "Get a Classic friend code" with `?mode=classic`) and copies its invite link.
  - A phone's browser only copies during the tap, so the copy starts in the tap with the link to come (a
    `ClipboardItem` holding a promise; Safari and Chrome support it). Elsewhere it copies when the lobby opens.
  - The lobby screen then says "Invite link copied: paste it to your friends". Its "Share invite link" stays.
  - The Boss raid screen's Play with friends still makes a raid ("Create a raid").
  - **Not built:** a personal friend code that adds you as a friend. Today friends are added by tapping a name. It
    needs server work (a code per player, entering it); it can come later if wanted.
- The sheet also has **Your friends ›** (with "N new"), to the friends list. Your profile's Friends button stays.

## Text players see

- New: the panel with no mode picked: "Tap a mode above to play".
- "Create a lobby" → "Get friend code"; "Create a Classic lobby" → "Get a Classic friend code".
- The sheet's line "Make a lobby and share its code. Empty seats fill with bots when you start." → "Makes a lobby and
  copies its link: send it to your friends. Empty seats fill with bots when you start." (a raid keeps the old line).
- New on the lobby screen: "Invite link copied: paste it to your friends".
- New in the sheet: "Your friends ›".
- "Play with friends" button under the Boss raid card: removed (phone and computer).
- The coins pill at the top ("● N coins"): removed from a phone's top bar and a computer's top right.
- New in a phone's top bar: Friends (label "Friends", "Friends, N new" with news).
- New on your own profile: "● N coins".
