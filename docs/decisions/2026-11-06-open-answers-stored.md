# An open answers the stored item (Nov 6, 2026)

CI flake (PR #524): three opens with one request id gave two answers. One grant every time: the attempt that applied answered its own
roll object (`color2` last), the replays the stored row (`color2` after `color`); same values, other key order, for two-color items only.

- **The call:** every attempt at a crate or boss crate open, the one that applied included, answers `openedItem` (the row as stored).
  One extra D1 read per open.
- **Not chosen:** a roll derived from the request id. The app picks the request id and the repo is public, so a player could choose
  their roll; a server secret to stop that would be Eric's to add, and a leak would hand out Pearl crowns.
