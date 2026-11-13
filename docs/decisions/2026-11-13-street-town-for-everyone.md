# The street town for everyone; the old town gone (Nov 13, 2026)

Eric: "The old town should never load because people could exploit something ... if the current town doesn't load and it's genuinely
because they can't run it, then they just can't play." PR #675 kept admins off the old town; this makes the street town (WebGL 2) every
player's and guest's town, and takes the old Canvas 2D town out.

- `STREET_TOWN` is gone. `ADMIN_TOWN` still gates the admin-first bosses' homes (core's `BOSS_ADMIN_FIRST`: Timber's, Dash's, Rolling Dough).
- The old town's code is deleted: its 46 x 46 layout, park plan, lamps, start (22, 17), zoom-out camera, drag-to-pan, far Colosseum and
  its Colosseum picture (the ring keeps the parts it reuses). `painter2d` stays only as the blank canvas under the failure message (no
  frames run there).
- Call: a player's town has no half-built admin-first home. Their lots are left out before the rows are laid (`street.ts lotHere`), so the
  row fills the place with look-alike fronts, as anywhere else along it. Before, a player would have seen a roof with no front there.
