# 50 v 50 opening vote: cards fill upward (branch claude/vote-card-fill)

mock/: CSS injected over the live vote, counts fixed at 4 / 2 / 6, light and dark.
- Fill = votes / total votes (the "total" stills): each card shows its share of the vote, the same rule as the old bar; one early
  vote doesn't flood a card, and a card is full only when it has every vote. The "max" stills (votes / the leader's votes) are there
  to compare: the leader is always full, which says less.
- The pill "Drag your pawn into a zone to vote" now sits under the zones (rank 3 from your side), pointing up: no zone name covered.
- The phone's vote uses the same cards (shorter), so it gets the same fill.
