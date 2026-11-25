# Battle Tower on a computer: the floor's title over the column beside the board (Nov 21, 2026)

- **Eric, Nov 21:** "We really don't want it to say Battle Tower Floor 4 right there ... we need all that space for the boss for the bar at the top. So I would be ... putting that Battle Tower Floor 4 thing ... to the right above the moves black container".
- **Changed:** on a computer the "Battle Tower · Floor N" line left the gap between the bar and the board (`.tw-strip-line`) for the top of the right column (`.tw-col-title`, the first row of `BossTools`); its 28 px left `--bd-room` at first (the board 24 px bigger where the height bounds it; revised below: the bar takes them). Phone unchanged.
- **Call made:** the title and the tools can't share a line (an admin's ⚡ 🐟 🏆 and gear leave 128 px of a 280 px column; the title is 176), so the column's top is two fixed rows: the title (20 px, centered, its top level with the bar's) over the tools (their usual 28 px row). 52 px fits the shortest tower bar's row (a lone floor's 49 px bar and its 8 px margin), so the board stays 8 px under the bar. The tools sit 3 px lower on a floor of several (8 on a lone floor) than on main; the Moves box keeps its size and place.
- **Revised (Eric, Nov 21, after the stills):** "Why would we make the board bigger? Shouldn't we be making the boss thing bigger? ... I would
  be going with the one of these two that you'd use the bigger boss bar." The title stays over the column; its 28 px go to the bar: 89 px on a
  computer (61 on main), a lone floor's too; `--bd-room` back to 151 px, so the board is main's size at every window (measured on main: 600,
  616, 744, 744, 872 at the five sizes) and a floor of several's place (103 px down); a lone floor's board moves 10 px down to the same place.
- **Calls made:** the faces fit one 84 x 74 box (the crops run 27 to 60 px wide, so no one whole-number scale fits them all; the bar already fit
  them to 48 px wide); the name column at 1.2; only the props that size themselves to the room (bulbs, candles) at 1.5 (2x art → 3x); the
  wide props of bosses not yet in the tower's pool and Babur's pump keep their size; a short computer window (under 600 px tall) keeps 61 px.
