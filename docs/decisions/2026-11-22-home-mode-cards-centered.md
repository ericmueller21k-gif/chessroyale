# Home: Other modes cards centered, heading removed (Nov 22)

**Eric, Nov 22:** "let's just center the whole thing a bit more … the text should also … be center aligned … bring everything more to the right." And, through the director: "just getting rid of other modes and stretching down Chess Town a little bit."

**What changed:**
- The picture and words of the Boss Battle and Auto chess cards sit centered as one block, and the words are center-aligned. Phone and computer alike. Card size and place are unchanged.
- The "Other modes" heading is gone. Chess Town's button is taller by the heading's room: 26 px on a phone, 24 px on a computer, 20 px in a short computer window. PLAY, the pawn's card, RANKED and the two cards keep their size and place; the page still doesn't scroll.

**Calls made:**
- The centering is scoped to `.fd-root .rd-pair .rd-card.rd-half`, the cards' own selector.
- Chess Town's extra height is its own rule, because `.fd-town` shared its height rule with PLAY.
- Checks that required Chess Town to match PLAY's height now require it to be taller by the heading's room, since that is the new design (`home-layout`, `home-ranked`). Checks that looked for the heading now check that the cards sit right under Chess Town (`home-layout`, `home-polish`, `home-ranked`, `search-home`).
