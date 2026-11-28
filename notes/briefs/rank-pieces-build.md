# Build: the town shop, part 2 (rank piece sets at the board keeper). Opus, xhigh (coins). Full lane. Runs after part 1 merges.

Eric, Nov 28, to the mockup (`stills/rank-pieces`, its `NOTE.md`; the throwaway code is `claude/rank-pieces-mockup-preview`): "I do like the
border with the gradient… I think the gradient's the way. Keep it white and black always, and there's no questions." So:
- **Style B, the gradient rim, for every set** (full set and king-and-queen): today's cburnett pieces exactly (white stays white, black stays
  black), with the rank's gradient rim round the outline (2.2 of 45 units), the NOTE's rim colors. No B-solid, no A.
- **Fix the mockup's weak case:** Gold's rim melted into the Gold Board's squares (1.2 to 2.1). Add a thin dark hairline outside the rim (or
  deepen the rim's outer stop) so every rim reads on its own rank board and on the default boards; check it in the marks sheet.
- **Shipped as files** (12 per rank, like Don Dough's gold pieces), built by a script from the SVGs; nothing drawn at run time.
- **Two purchases a rank** (Gold and up, same "ever reached" rule as boards): king and queen only, and the full set. Placeholder prices in
  `settings.ts`: 250 and 600. Owning the full set includes the king and queen.
- **Director's calls (Eric: no questions):**
  - Your set dresses **your own side only**, so white against black is never in doubt; your opponent and spectators see it too.
  - The setting "Always default board and pieces" (Settings, Board, under Board colors; "Default board and pieces" in a match's options)
    shows everyone's default: **your own Board colors pick** with today's pieces, never a forced Classic.
- Same stored-data and purchase rules as part 1 (one server-side transaction, server-checked price, never charged twice; guests greyed).
- Area pages, a five-line decision note, unit tests for the purchase and for who sees which set, an e2e for buy → put on → both players see
  it → the setting hides it, one still per platform. Commit AND push `.pr-body.md` and `.done`, check `git ls-remote`, stop.
