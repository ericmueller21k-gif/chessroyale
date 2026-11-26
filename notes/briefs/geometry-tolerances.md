# Geometry checks from the rule, not today's pixel (the Nov 26 bloat sweep, H2)

Source: `notes/pipeline-audit-2026-11-26.md` (N4). 7 of main's 27 intermittent failures since Nov 23 were layout asserts missing by
under a pixel or by one: a tolerance written to today's pixel, not to the rule it guards. Eric, Nov 26: "You have my go ahead on
everything else" (that includes editing guard tests in `docs/rules/eric.md` for this; list each one changed old → new in the PR).

The seven (from the red main runs' e2e-summary artifacts; find the runs with `gh api` on main's e2e runs since Nov 23):
- `match-menu.spec.ts:71`: 912 against >= 947
- `boss-select.spec.ts:602`: 708.6 against >= 709.5
- `boss-result.spec.ts:132` and `formats.spec.ts:174`: both 14.3 px against >= 16, in the SAME run: look at these two as one possible
  real layout race (a font or a style arriving late?) before touching their numbers
- `panel.spec.ts:282` (twice)
- `birdie-home.spec.ts:35`: 30 against > 30 (an off-by-one: >= or the rule's own number)

For each: read the rule the check guards (its comment, Eric's words, the area page), then make the threshold come from that rule,
with the browser's sub-pixel rounding allowed for (e.g. compare rounded values, or allow 1 px where the rule is "about" a size).
Where the miss is real (a layout that is sometimes really wrong, like match-menu's 35 px, or the 14.3 px pair), fix the layout's
cause instead and keep the check. Never loosen a check past its rule. One focused e2e run per touched test (`--repeat-each 3`,
under the shared e2e lock, the project that failed).
