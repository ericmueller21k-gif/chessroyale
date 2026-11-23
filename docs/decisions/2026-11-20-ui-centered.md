# Centered, tidy cards (Nov 20, 2026)

**Eric, Nov 20** (on the clerk's card: a left "OPEN PARTIES" and a left hearts row under a centered "Clerk", the card hung off to the
left of the screen, a tall empty "Reading the open parties…" box): "things need to be consistent ... everything should be centered
there. The whole box itself should be centered ... on the page ... Those are the small things that add up."

**The rule** (now in `.claude/LESSONS.md`): in a card or panel, the card stands centered, and its title, labels and short lines are
centered. Long body text and true lists of rows (players, settings rows with a switch, chat lines, a list of open parties) may stay
left inside the centered card. A picture-beside-words row (a person's card, home's mode cards) keeps its own row layout.

**What changed**
- The Battle Tower's clerk's card (`TowerDesk.tsx`, `tower.css`, `ShopRoom.tsx`): stands in the middle of the room (a keeper's panel,
  `.town-mid`, placed as the crate's card is, with no tail). On a phone, where it reaches over the walking keys' column, it stands in
  the middle of the room *above* the keys, so they stay in view and tappable (`cardFloor`, read once as the card opens). OPEN PARTIES,
  the seats' contents, the lives row and the plan line are centered; the open parties' one line ("Reading…", "No open parties right
  now.") sits in the middle of its box; the plan line's words in the middle of its three lines. One even 6 px between the card's rows
  (a button's own margin made some gaps 10 px), the list's rows 28 px (were 32), so the card (now 493 px tall, was 521) fits a 390 ×
  664 phone's room above the keys. Every size is still fixed across states.
- The result screen's Last Stand card (`.ls-card-head`, styles.css): its title and line centered (an empty column the chevron's width on
  the left keeps them in the middle); its facts list stays left.

**Calls made**
- The open parties' box keeps three rows (the review of #835's "one size, three rows, no scroll"); its empty line is centered in it
  rather than the box shrinking, so a party coming or going never moves anything.
- The other town cards are small speech-bubble cards with a tail pointing at their speaker; they stay over their speaker (already
  centered text, Eric's Nov 5 rule). Only panels (the crate's, the clerk's) stand in the middle. The crate's card also now keeps clear
  of a phone's walking keys (same code path).
- Checked and left as they are (consistent within themselves, not mixed): the Confirm pop-up (`.mm-confirm`: its question and note
  read as one paragraph, all left), home's mode cards (`.rd-card`: picture beside words), Settings' section labels (heads of lists of
  rows), the results table (a data table), the tower's result (already centered), the tower bar and strip (in-game bars, not cards).
  Any of these is a one-line change if Eric wants them centered too.
