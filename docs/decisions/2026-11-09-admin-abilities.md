# Admin abilities: the inventory (Nov 9, 2026)

Eric (Nov 9): "I don't need admin special ability anymore to open up, or like the Fisher random testing on items." XP phase 2 removed
those two (below, "Removed today"). Everything else an admin can do is listed here, so "clean up the admin stuff" later is one quick
job: each line says where it is, what it does, and whether it's safe to remove. Doc only: nothing beyond the two was removed.

**Who's an admin:** an email in the Worker's `ADMIN_EMAILS` secret (`packages/server/src/admin.ts:43`, `isAdmin`). The app learns it
from `/api/me`'s `admin: true` (`packages/server/src/api.ts:344`), read as `account().profile?.admin` (e.g. `packages/app/src/boss-brain.ts:11`).
**Test switches** (`testSwitchesOn`, `admin.ts:54`) are on for an admin *or* where `TEST_SWITCHES` is "1" (local, e2e, staging):
removing the admin half keeps every test server working.

"Safe to remove?" means: nothing a player sees changes, and no test server loses a tool (e2e servers have `TEST_SWITCHES`).

## Removed today (XP phase 2)

| Where | What it was | Now |
| --- | --- | --- |
| `packages/server/src/api.ts` (`/api/locker/open`'s `force`) | An admin's `?fischer=1` / `?shiny=1` forced a crate's roll on production | Only where `TEST_SWITCHES` is "1" |
| `packages/app/src/screens/Crates.tsx` (`crateSwitchesHere`) | The crate page's "Testing:" boxes for an admin | Only on a `TEST_SWITCHES` server or the dev server |
| `packages/core/src/crates.ts` (`CRATES_FREE`, gone) | Crates opened free and unlimited, admins included | A crate held and a crate key, for everyone |

## Server

| Where | What it does | Safe to remove? |
| --- | --- | --- |
| `admin.ts:307` (`handleAdmin`) | The fair-play review page `/admin/fairplay` (cases, bans, appeals, chat moderation, name and icon resets); also the reviewer's token | **No**: it's how bans and appeals are run. Keep. |
| `ops-admin.ts:53` | The ops page `/admin/ops` (errors, reports, the ledger's backfill and check) | **No**: ops needs it. Keep. |
| `town-chat-api.ts:164` (`townRemoveResponse`), called at `api.ts:544` | A moderator takes a town-square chat line down | **No**: moderation. Keep. |
| `api.ts:491` (`/api/locker/grant`) → `boss-tokens.ts` `grantTestItems` | An admin grants themselves crate keys (up to 100 at once, Nov 9) and any boss's tokens | Yes, once keys are earned enough and Eric doesn't need his own; keeps nothing else working. |
| `api.ts:223`, `accounts.ts:825` (`profile`), `locker.ts` (`lockerState`, `equipLocker`), `accounts.ts` (`shopState`, `equipItem`), `accounts.ts:1004` (`publicProfile`), `locker.ts` (`looksOf`), `index.ts:395` (`duelEntrant`), `ranked-schema.ts:122` | **Admin copies:** an admin's locker and shop have one of every item and God King effect (never stored), wearable, shown to others | Yes for players (they never see them except worn); it's Eric's way to look at every item. Removing: take the `admins` argument out of these and delete `core/admin-copies.ts` and its test. |
| `lobby-do.ts:452`, `:535` (`ultimateTrigger`) | "Trigger ultimate (testing)" in an online boss battle (makes the raid a test game: no XP) | Yes (`BOSS_POWERS.ultimateTestButton` also gates it). |
| `lobby-do.ts:500` | Practice mode (unlimited power-ups) accepted from an admin's socket on production | Yes: test servers keep it. |
| `index.ts:347`, `squads-do.ts:66`, `squads-lobby.ts:464` (`squadsTestAllowed`) | Squads' test lobbies and test controls for an admin on production | Yes: `SQUADS_TEST` keeps them on test servers. |
| `index.ts:431` and every `testSwitchesOn` (lobby options, queue pools, `/api/xp/test` at `api.ts:588`, `?xpgame` at `api.ts:582`) | Every test switch for an admin on production (a lobby's rounds, clock, boss strength, a test pool; `?xp=`; a solo `?xpgame` marks a test game there) | Yes: change `testSwitchesOn` to `env.TEST_SWITCHES === "1"` alone (one line), and its tests' admin cases. |
| `api.ts:290` (`townHereResponse`'s `admin`) | An admin's name check in the town's presence (admin copies worn in the town) | With the admin copies. |
| `core/boss.ts:269` (`adminFirst`, `BOSS_ADMIN_FIRST`: Timber, Dash) | A new boss is met only by admins until Eric says go (boss menus, homes in the town, tokens, crates) | **No** while a boss waits for launch; it empties itself as bosses go live. |
| `core/boss.ts:119` (`adminOnly`: the Hidden Boss) | Only admins meet the Hidden Boss in Boss alone (the hidden `/bosses` picker) | Yes, if Eric doesn't need to test him alone; he stays the Crowd's final boss. |

## App

| Where | What it does | Safe to remove? |
| --- | --- | --- |
| `screens/Crates.tsx` (`AdminGrants`) | "Admin: test grants": +1 crate key, **+100 crate keys** (Nov 9), +1 / +3 tokens of any boss | With the server's grant. |
| `screens/Settings.tsx:417` | Settings → Testing (Practice mode, the boss brain picker) | Yes: test servers keep their own way in. |
| `components/BossDock.tsx:480`, `solo.ts:872`, `net.ts:1197` | "Trigger ultimate (testing)" | With the server's. |
| `components/BossDock.tsx:575` | The boss brain's line (which engine plays) | Yes. |
| `test-switches.ts:12` (`testSwitchesFor`) | Every address test switch for an admin (`?debug`, `?boss=`, `?win`, `?xp=`, `?quests=`, `?rideScale=`, …; ops.md "Test switches") | Yes: drop `|| !!state.profile?.admin` (one line); test servers keep them. |
| `components/FrontDoor.tsx:237` | An admin's `?rank=` shows that rank on home | With the switches. |
| `screens/Home.tsx:88`, `:170` (`menuBosses({ admin })`) | Admins-first bosses and the Hidden Boss in an admin's boss menu | With `adminFirst` / `adminOnly` above. |
| `town/admin-town.ts:11`, `town/world.ts:367` | An admins-first boss's home in the town for an admin | With `adminFirst`. |
| `claw/ClawMachine.tsx:27` | An admins-first boss's crate offered in the claw machine to an admin | With `adminFirst`. |
| `App.tsx:956` | The admin flag passed to the party screen (admins-first bosses there) | With `adminFirst`. |

## Not admin abilities (for the record)

- `TEST_SWITCHES`, `SQUADS_TEST`, `MAIA_TEST`, `ENGINE_OFF` are the test servers' own variables, never production's.
- The kill switches (`PAUSE_*`, the maintenance banner) are Cloudflare dashboard variables Eric sets, not an admin's in-app power.
