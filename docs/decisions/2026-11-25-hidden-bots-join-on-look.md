# The Hidden Boss's test bots join on the admin's looks, one a look (Nov 25)

- Cause of hidden-boss-room.spec.ts:111's retry-pass (desktop, main, Nov 25): the bots joined on a timer (2 s apart) applied by
  anyone's answer, while the page learns the count from a look every 1.5 s that skips a tick while one is in flight. One slow look and
  "3 of 4" was never in any answer the page got.
- Fix (server, hidden-room.ts): the next bot joins only on the filling admin's own look, at most one a look, and only `botJoinMs` or
  more after the last join. So that look's answer carries the new count, whatever the poll's timing. Admins only; players unchanged.
- Changed checks: hidden-room.test.ts's bots test now looks once per join (and checks a late look adds one, a `due()` alone none); the
  m2 resting test looks once per bot. The e2e spec is unchanged.
