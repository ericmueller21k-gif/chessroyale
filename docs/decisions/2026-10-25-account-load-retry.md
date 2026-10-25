# Loading the account: your profile asked twice, and the server's test switch kept (Oct 25, 2026)

## What went wrong
`loadAccount` (`packages/app/src/account.ts`) asked for the server's options (`/api/auth/config`), then your profile
(`/api/me`), inside one `try`. If only the profile failed, the `catch` replaced the options it had already loaded with
"no accounts here" (`{ accounts: false, … }`). That dropped the server's `testSwitches` too.

- **In CI:** the test links (`?boss=`, `?debug`, the sound probe) stopped working for that page. Two e2e failures fit this:
  - `king-attack.spec.ts`, "Last Stand against Wrangler", on #347's shard 4: `?boss=pig` was ignored, and Boss alone
    opened its menu instead.
  - `piece-sounds.spec.ts`: `__measureSound` was missing (#336).
- **For a player:** one passing failure of `/api/me` cost the page its account until the next load. Results weren't
  recorded and the profile wasn't shown.

## What changed
- `/api/me` is asked a second time, 400 ms later, when the first try gets no answer or a server error (5xx). A refusal
  (a 4xx, such as the age gate's) isn't asked again.
- If the profile still fails, the page plays on without an account as before. A server that answered its options keeps
  its `testSwitches`.
- `api()` errors now carry the response's `status`.

## Tests
- New `packages/app/test/account-load.test.ts`:
  - a 503 then a 200: the account loads;
  - a 500 twice: no account, but the test switch stays;
  - a 403: asked once.

  The first two fail on the old code.
- `age-gate`, `testers` and `friends` unit tests still pass.
