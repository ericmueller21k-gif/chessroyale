# 50 v 50 Party: the review's fix round (PR #747, Nov 16, 2026)

- **Unranked (M3), the director's call until Eric answers:** his Nov 9 rule assumed friends "won't even be on the same side". A 50 v 50
  with a party of 2+ isn't ranked (XP as usual): `CROWD_PARTY.ranked`, and one line on the party screen.
- **L1:** late members still join their party's group, so each party counts at full size when the next is placed.
- **H2:** a filling lobby takes a party only if its 20 s hold ends before the fill.
- **M2, L5:** a dropped leader keeps the lead 20 s; a search with nobody connected stops after 20 s.
- **L2:** Do Not Disturb holds an invite back at the party's door; the seat stays "…", so nobody learns of it.
