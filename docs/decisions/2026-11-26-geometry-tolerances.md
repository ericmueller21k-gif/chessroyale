# The seven edge geometry checks: each already fixed at its cause (Nov 26, 2026)

- Brief H2 (the Nov 26 audit, N4): seven layout asserts on main missed by under a pixel or by one. Eric: "You have my go ahead".
- Each red run predates a fix at its cause, all on main: match-menu:71 (the status line's box ran under the gear, #930); boss-select:602
  (Boingo measured mid-squash, 05f45ede); boss-result:132 + formats:174 (one cause, Smudgy's defeat at 2.25x: the row's gap from his
  drawn reach, 728ccc6b); panel:282 ×2 (pickRows stopped at a row that didn't fit, c3c9efc3); birdie-home:35 (a 30 s report, 5549c247).
- Call: no threshold changed. Each already states its rule (16 px, four rows, 1 px for rounding, after the title), so loosening any
  would only hide a real miss.
