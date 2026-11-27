# "HunChess" in a name is staff's only (Nov 27, 2026)

Eric: "hunchess is not allowed in your name anywhere, only I can have that or an admin tagged account." `isReservedName`
(text-filter.ts) finds it read as the name filter reads names (case, accents, look-alikes, leetspeak, spaces, symbols). Refused: a
profile's PATCH from a non-admin (400, "Only HunChess staff can use HunChess in a name."), a new guest's name (becomes "Player"), and a
non-admin's lobby seat name (becomes "Player N"). Admins (ADMIN_EMAILS) keep it. Names already stored are left as they are.
