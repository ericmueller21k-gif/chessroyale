# Friends: a page with player search (Nov 11, 2026)

Eric: "We just need this friends page… a search… tap them to see their public profile… who's online, their activity… your offline friends."

- **The pop-up is gone:** home's Friends opens `/friends`. The side menu's "Play with friends" still opens the code sheet (it never opened the pop-up).
- **Search:** prefix, any case, 2+ characters, 6 results; banned, test accounts and (with sign-in set up) guests left out. New index `users_name`, so a search never scans every player: stored data, the full lane.
- **Activity:** the lightest presence: beside `busy=1` the live line says `doing=`, kept in the hub's memory only, sent as it changes.
