# Battle Tower PR 9: saving (Nov 19, 2026)

The brief: `notes/briefs/tower-9-saving.md` on `claude/director-notes`; the design's section 5
([2026-11-18-battle-tower-design.md](2026-11-18-battle-tower-design.md)). Built: server `tower.ts` (`tower_runs`, `tower_best`, the
one-open-run index), its routes, the sign-in merge, the download and deleting. The calls made, each with why:

1. **The routes live with the account routes** (`api.ts` dispatches `/api/tower*` to `towerResponse` in `tower.ts`, after the
   session), not in `index.ts`'s own list: "the guest cookie as the other account routes" is that session lookup (a guest is an
   account), and `index.ts` already puts the rate limits and the ban gate before every `/api/*` route. Nothing extra to wire.
2. **The best is the highest floor won** (1-99; 99 is the top), as the design's "rises with each floor won" and "your best '99
   (top)'". After every result it's worked out again from the account's solo runs (a run's floors won: its floor less one, or 99
   for the top) and only raised, and again before a new run deletes the old rows: a best a result's write missed (the Worker
   stopped between the two statements) is set right by the next result. A party's best is each member's: its room's (PR 12).
3. **A run that ended stays until the next new run of its kind** (then it goes, its best kept): each account holds at most a few
   rows, and the privacy policy can say exactly how long ("a climb until you start your next one").
4. **A start with a floor under way answers that floor**, the same id and start time (`under: true`), never a fresh one: a retry
   after a lost answer, or a reload rejoining it. What a device with nothing stored then does is PR 10's (the design: a loss).
5. **A win's time:** `BATTLE_TOWER.soloWinMinSeconds` (10): a win sooner than that after the start, by the server's clock, is
   refused (409) and the floor stays under way; a lost or drawn floor any time. Well under any real win (a four-move mate takes
   longer), so it only catches a scripted climb. Not where TEST_SWITCHES is on (local, e2e, staging), for the e2e's quick wins.
6. **Stop:** mid-floor it needs the floor's id (never ends a floor started since; a stale one is 409); no `moves` (or a bad
   value) is a counted leave, so a device can't skip saying. Nothing under way (between floors, or a repeat of a stop): a clean
   200 "between", nothing changed. A result or a stop changes the run in one statement that applies only while that floor is
   under way, so a replay or two tabs find it ended (409 for a result).
7. **Kill switches:** PAUSE_SOLO refuses a new run and a floor's start (503, its line), never a result or a stop (a match running
   finishes). Every boss resting: 503 "The tower's bosses are resting", nothing written. Between floors, GET shows the floor's
   bosses as its start will deal them now.
8. **The merge:** of two open runs of a kind the higher floor stays open, **the account's on a tie** (as its own solo battle wins
   elsewhere); the other is `abandoned`. The guest's floor under way stays with its run. Bests: the higher of each kind.
9. **The download** has each climb's floors met, never its seed or the deck still to deal (the game's dealing, not about the
   player, and it would show the floors to come).
10. **Core:** `floorSettings(run)` (startFloor's settings, exported) so a floor already under way answers its own settings.
11. **Left for PR 12 (the party):** party rows and `members` exist but nothing writes them; when it does, the merge and deleting
    must also rewrite or remove the account in others' runs' `members`, and the party best is per member.
12. **Lane:** full (stored data). The e2e check is one focused API climb in `e2e/account-delete.spec.ts` on the local D1 (the
    index, a replayed result, the download, nothing left after deleting); `e2e/areas.json` maps `server/src/tower.ts` to it.
