# Squads replay test: a board that finished before your turn (Nov 10, 2026)

Eric OKed (Nov 10, a guard test of "Squads: move replay"): `squads-replay.spec.ts`'s "Relay with Quick board jump" assumed the
board shown is always your next duty's. When that board finished before your turn (your squad won or drew it), the server rightly
gives you the next board; the test now checks the shown board has a result and goes on. No app change; the rule's checks are unchanged.
