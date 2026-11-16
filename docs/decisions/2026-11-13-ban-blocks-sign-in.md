# A ban means you can't sign in (Nov 13, 2026)

Eric, Nov 13: "When I think of the word banned, I think of you can't sign in anymore. Just like every other game works." "If you
try to sign in, it would say your account has been banned. For more information, email support." "Make sure that when someone's
banned, it's not just the landing page. No URLs work."

## What changed

- A banned account can't sign in, and no URL or API route works for it. The line: "Your account has been banned. For more
  information, email support@hunchess.com." Appeals come by email; there's no appeal box.

## Calls made

1. One server gate in front of every route, lobbies' WebSockets included.
2. Each Worker instance caches "not banned" per session for 60 s.
3. A banned browser is marked, so a tab already open drops to the ban line.
4. A refused sign-in ends whatever session the browser carried.
5. Evasion accounts are banned; a person can clear them.

## Eric's call (Nov 13): the whole device is banned

A marked browser gets the ban answer on every route.

Details: docs/areas/fairplay.md, "A ban means you can't sign in".
