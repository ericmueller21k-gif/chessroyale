# The Hidden Boss's fight: the small follow-ups (Nov 14)

From #707's review (m2, m4, m5) and the visual check of his fight (#11's nits). The director's brief; no new rule from Eric.

- **A late device hears the intro from where it is** (m2): `switchPlan` with a drop starts the intro now at `now − its start`
  (`MusicPlan.intro.offset`), the loop still on the drop; past the drop, the loop alone as before. The log says `:late`.
- **The suit is checked on the canvas** (m4): the `?phase=2` test counts the suit's colors on his sprite and none of his shirt's.
- **The transformation picks up the cutscene's loop** (m5): `sceneStandAt` takes the scene fitted to the hold that led into this phase
  change (its end within 2 s), else the full scene ending as it starts (a late joiner, a test link).
- **The Moves list's boss rows show his face now** (the brief's item 4): `useLiveFace`, one loop for the list (a past lesson: never a
  loop per row) and one image per look, cached; other bosses keep `bossPortraitUrl`.
- **Nits, each a few lines.** The phone bar's bubble: its shadow 4px 2px (was 4px 4px), so it ends on the bar's edge, nothing moved.
  The computer's chat under the Moves panel: the chips' box is whole 34 px rows tall (CSS `round()` over the chat's height) and scrolls
  for the rest; the panel's size is unchanged. **The call:** the computer's phase 2 table shows each board's mark (✓ ✕ ½, the phone
  panel's), the word its title, instead of "WON": the word cut names to "Discover…" at 1280. The phone's sheet, wider, keeps the word.
