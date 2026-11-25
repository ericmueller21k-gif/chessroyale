# The Welcome Crate leaves out admins-first bosses' rides (Nov 23)

- **Eric's rule:** a boss in the game for admins first is "met only by an admin until Eric says go" (`BOSS_ADMIN_FIRST`, `boss.ts` `adminFirst`). Every tester opens the Welcome Crate, and PR #905's review (I1) found that it handed out and listed "HunChess Birdie's Train", and had listed Timber's and Dash's colorways since Nov 6 with no decision behind it.
- **The call (the director's, the review's option (a)):** `welcomeRide` in core `welcome.ts` drops every ride whose boss crate's boss is admins first from `WELCOME_CRATE.items`, in that one place, so the roll (server), its page and the opening all follow. Each comes back by itself when its boss leaves `BOSS_ADMIN_FIRST`. Rides in no boss's crate always stay.
- **The numbers:** 17 rides at 5.88% each (main before #905) → 15 at 6.67% (Timber's The Log Roller and Dash's Cheetah Shoes leave; Birdie's Train never joins while he's admins first).
- Holders keep theirs: the colorways stay items (admins own one of every item), an opened crate answers its stored ride, and a second crate's roll treats an unlisted first ride as leaving out nothing.
- Guard: core `crates.test.ts`, "no Welcome Crate ride belongs to an admins-first boss".
