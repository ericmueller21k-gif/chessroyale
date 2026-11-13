# The Hidden Boss never plays a weak move because something lagged (Eric, Nov 13)

Effort xhigh, full lane (server, the online match). After #677 merges; branch `claude/recluse-server-only` from main.
Eric: "we can't have him breaking ... if the engine doesn't load properly ... I almost feel like we need to pause the game. Or I guess it
falls back to the server ... I will be providing some funds for our server when the game goes, so we can always utilize that."
## Build (in his online phase 2; check phase 1's boss moves in his fights too and say what they do)
- His moves come only from the engine server. No player's device computes HIS moves (`phase2Ask` for his moves goes; it also let the
  team's own host compute its opponent's moves). Bots' moves may still use the device path (a bot only plays for its own team).
- No quick move for him. While the server hasn't answered: the clocks pause (every board's), and the boards show "He's thinking…"; retry
  with backoff. After `RECLUSE_ONLINE.serverWaitMs` (about 60 s, a setting) with no answer: the fight ends "No result: the Hidden Boss
  couldn't connect." Nothing counts for or against anyone (no XP, no rank, no fair-play cases from phase 2, no win/loss rows).
- His search budget: a share of its own for his fights (a setting), apart from the judges' re-checks, so the judges can't starve him.
- Unit tests (a slow answer pauses and resumes the clocks; no answer ends with no result; a bot still uses a device; his moves never
  from a device), and the room e2e still passes. Decision note, area page. `.pr-body.md`, `.done`. No PRs, no CI waits, no model names.
