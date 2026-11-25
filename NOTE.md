# 50 v 50 opening vote: cards fill upward (branch claude/vote-card-fill)

mock/: CSS injected over the live vote, counts fixed at 4 / 2 / 6, light and dark.
- Fill = votes / total votes (the "total" stills): each card shows its share of the vote, the same rule as the old bar; one early
  vote doesn't flood a card, and a card is full only when it has every vote. The "max" stills (votes / the leader's votes) are there
  to compare: the leader is always full, which says less.
- The pill "Drag your pawn into a zone to vote" now sits under the zones (rank 3 from your side), pointing up: no zone name covered.
- The phone's vote uses the same cards (shorter), so it gets the same fill.

Build (root): the real fill with the bots' votes, 1536x730 (125%), 1920x960, phone 390x844, light and dark.

mock/*-v2-*: after the director's review, built: the fill at the bar's color 35% (40% dark) with a 2 px top edge; the card's text has a halo
of the card's color where the edge crosses it.

Root *-build-* overwritten after the director's second round: the fill at the bar's orange 40% (42% dark), no top edge; the blurb a step
darker (light) / the text color (dark), so the count is AA and the blurb at least 5:1 over the fill. (mock/*-v2-* was the 2 px edge try.)
