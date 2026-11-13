# The Hidden Boss's child form online (Nov 13, 2026)

Director (Nov 13): wire the child form online, after the phase 2 online build (#677): admin + 3 bots → the child (🏆) → the man (🏆) →
the phase change → the four boards → the result. Calls:
- **The list decides:** `RECLUSE_FORMS` is `["child", "adult", "four"]`; `recluseChildFirst()` feeds `recluseChild` in his room's
  settings, `modeSettings("crowd")` (the Crowd's final, online and solo) and solo. `?form=adult` is a lobby test switch too.
- **The lobby's new match** reuses its fall path (the child's rules' `fallMs`) and `nextRound` (`nextBossForm`, then the intro as a new
  battle's): no new timer or phase. The 🏆 that beat the child is spent as he falls (`record.winForm` cleared).
- **His strength per move** goes in each request (Maia's rating, Stockfish's stand-in `elo`), so the host and its checker play the same.
- The adult-form tests (server and e2e) start at the man (`recluseChild: false`, `?form=adult`): their subject is unchanged.
