# A phone's home fits its screen: the shop in the top bar, Friends on your profile

Eric, Oct 18 (his phone, 390 × 844, after #284):

> We don't need shopping crates anymore on the mobile for sure, and we don't need a profile button at the bottom… why
> don't we just put on the top… a little shop icon up there… make the shop icon kind of fit with the style of the
> other thing… Should never have to be scrolling down on the phone, unless there's some case where the phone is like
> super tiny… that friends thing, the add friends… at the top… should be gone… we can probably do it from the… profile
> icon.

He also saw Squads' Solo queue choice hanging out of the foot of the panel under the RANKED row.

## What changed

- **The panel's own class.** #284's panel reused the class `fd-panel`, which other screens already use for a padded
  card (12 px padding). The padding pushed Squads' choices down and out of the 58 px box. It is `fd-mode-panel` now.
  The "home keeps still" test now checks that every box in the panel fits inside it, not only its direct children,
  which is why it missed this.
- **No Shop & crates or Profile buttons under Play with friends** on a phone. Your profile was already your pawn in the
  top bar. The shop is a new bag icon in the top bar, drawn and sized as the gear is (44 px), between your pawn and the
  gear. A computer is unchanged: both are in its side menu.
- **The top bar still fits from 320 px with a six-digit balance.** With one more button, below 430 px the gaps are 6 px
  and a balance of 10,000 or more shows short ("123k"; it was below 360 px); below 400 px the logo is 18–20 px; below
  360 px the three round buttons are 40 px and the logo 15 px. 360 px and wider keep the 44 px tap targets.
- **The Friends line above the live line is gone** from a phone's home. A phone reaches the friends list with a
  **Friends** button on your own profile, beside Open locker (it shows "N new" for requests and invites). So that a
  request isn't missed, the same count shows on your pawn in home's top bar. Invites still pop up as their toast.
  A computer keeps its live panel's FRIENDS section.
- **No scrolling on a normal phone.** Below 1024 px, home's gaps are 10 px (16 before), and your pawn's card takes the
  room the rest leaves (a size container). Its pawn is sized to that room, up to the old 154 px. When the card is
  shorter than 190 px, your pawn stands beside your name. The card stops shrinking at 100 px; below that the page
  scrolls.
  - **Measured** (Chromium, no safe-area insets): 390 × 844, pawn 154 px; 390 × 750, 126 px; 390 × 664 (Playwright's
    iPhone 13: Safari with its bars), beside your name, 100 px; 375 × 667 and 360 × 640 fit; 320 × 568 scrolls 90 px.
  - A real iPhone also has its notch and home bar insets (about 80 px together), which come out of the card's room.
    Eric's 390 × 844 has room to spare; his phone is the real check.
- **Play with friends stays on home** (Eric: "I do think it belongs on the main page"). A friends hub that also makes
  invite codes is for later.

## Text players see

- "Shop & crates" and "Profile" buttons on a phone's home: removed. The shop bag's label (for screen readers) is
  "Shop & crates".
- "Friends · tap a player's name to add them" / "Friends · N online" line on a phone's home: removed.
- New: a "Friends" button on your own profile (with "N new" when there is something new).
- New: a small number on your pawn in a phone's top bar when friends have something new for you.
