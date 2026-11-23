# Match fixes: light/dark in the gear, boss banners, the ult meter, Squads' "you" row (Nov 1, 2026)

Eric's notes from Oct 31, one PR. Each call below is ours, with the reason.

- **Light / Dark in the gear** (Eric: "the same pick as Settings → Theme"). A row in every match's gear list, after the
  animation rows, shows the theme on screen ("Light" or "Dark") and a tap picks the other one. It writes the same stored
  choice as Settings (`setThemePref`), so Settings shows it too. Reason: one switch, one store, no new setting. A tap
  always makes an explicit pick, so "Match device" becomes Light or Dark (Settings still offers Match device).
- **Boss banners, the big word fits** (Eric: Alfil's "MAMMOTH SLAM!" ran off a computer's board, "you can't read any of
  it"). Measured at the boards' sizes (600, 700 and 880 px = 1280 × 800, 1440 × 900, 1920 × 1080), most power banners
  had their big word or the portraits off the board. The words now take 42% of the banner's width (the portraits and gaps
  take the rest), a phrase wraps at its spaces, and a word still too wide is made smaller, by a canvas measure in the page's
  font (`fitBigWord`, once as the banner appears). Reason: the portraits and words sit in one fixed row; fitting the word
  keeps every banner whole without changing the layout. Long single words (BLIZZARD!, FUNHOUSE!) come out smaller.
- **The ult meter on a computer** (Eric: "too small"). 88 × 10 px from 44 × 6 (from 900 px). The bar's padding loses the
  same height (5/6 px down to 3/4), so the bar and the board under it don't move. The fill is still the share of the way
  to the ultimate, so the pace is the same.
- **Squads: you at the top** (Eric: the side panel's "you" isn't first). Your squad's row is pinned at the top, then a
  3 px line, then the whole table as before (you in your place too). One component (`StandingsPanel`) for the computer's
  side panel and the phone's sheet, so both are the same. The phone's strip of chips is unchanged (it's not a list of rows).
