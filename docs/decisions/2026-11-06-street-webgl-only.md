# The street town on WebGL only (Nov 6, 2026)

Eric, Nov 6: "When I had you rewrite this to … WebGL … I assume that was the right call", and he approved the audit's simplifications.
- The street town draws with WebGL 2 only (`STREET_TOWN = ADMIN_TOWN && WebGL 2`). Without WebGL 2, an admin gets today's town.
- If WebGL fails as the street town starts, or its context is lost twice in a minute or stays lost for 5 s, the page reloads once into today's town with `?street=off`. Any URL can carry the flag (no storage), it can't loop, and a later visit tries WebGL again.
- Its 2D fallback is gone: the cut-down domes, the coarse strips and the 12-20 draw budget, so domes draw whole.
- Today's town stays on Canvas 2D, and its `?gl=1` option and the two WebGL CI jobs are retired.
- The fallback report (`reportTownFallback`, its unit test and the health count) stays, because it now covers the street town's fallbacks.
- Name tags ease toward their distance alpha over about 150 ms, and never more than half the way in one frame, so a slow frame can't make one pop.
