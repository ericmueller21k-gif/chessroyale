# The Battle Tower in Chess Town: the skyscraper, its lobby and clerk (Nov 19, PR 11)

Eric (Nov 19): the art "looks good"; the tower is entered only from Chess Town, through the clerk at the lobby's counter.
- **A home with nobody out front**, as the Walk-up (`HomeId` "tower", `hasFigure` false, last in `ALL_HOMES`), in everyone's town. Its
  card: "Battle Tower", Go in. Its box: the shaft (x 12-132) in slate glass with gold corners up to 458 px, no roof (the front melts
  into the sky above it); the base, 8 px wider each side, stands as a front only.
- **Two lamps go, not one:** (47, 39) on its door square (the art's call) and (44, 39), half a square from its lot: no column is free
  between Dash's Kicks and the tower, and Eric's no-lamp-in-front rule (its test) counts half a square either side.
- **Talk is a link to `/tower`** (a page load): the app has no in-page router, and PR 10 owns how `/tower` opens.
- **The seam:** a 2-wide piece's foot (37) sits half a pixel west of the 1-wide pieces' (18 of 37), so the elevator and the way out get one
  more column, a copy of their last (tower-art.ts `widen`); nothing in how rooms draw changed.
- The lobby plays no theme of its own (the town's plays on); its ceiling is the store's white tiles, as in the approved still.
