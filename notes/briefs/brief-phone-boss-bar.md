# Brief: every boss whole inside its bar on a phone (UI; Haiku)

Eric (Nov 4, iPhone, Puddles): `notes/briefs/assets/phone-bar-puddles.jpg`. On a phone the boss stands at the left of the dark boss bar
above the board; Puddles is cut off by the bar's left edge (his arm and hose clipped), and his meters don't line up.
- **Every boss in BOSS_KITS whole inside the bar** on a phone (390 x 844 and 375 x 667 / 430 x 932 too), at rest and at the end of
  every beat he plays in the bar. Shift his drawing right (kits.ts `barShift` / `barScale`, styles.css) and move the name, level and
  meters right as each needs. Eric: it's fine if the names don't all start at the same x; fitting matters more.
- **Puddles' meters stacked and aligned:** his health bar, then "Seeds 5" as a label above its own meter (or the label on its own line),
  both bars starting at the same x and the same width. Do the same for any boss with an extra meter (check them all: Timber's gnaws,
  Dash's, etc.).
- Eric's Nov 4 rule (sprites always on screen) covers this: extend the rule guard in `e2e/boss-side.spec.ts` (or the phone bar's spec)
  so each boss's drawing must lie inside the bar's box on a phone.
- Stills: a contact sheet of all bosses' phone bars before/after (390 x 844). PR body with changed checks old → new.
