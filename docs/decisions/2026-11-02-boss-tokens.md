# Boss tokens, crate keys and buying a boss crate (shops round 2, Nov 2, 2026)

Eric's rules (Nov 2; the director's notes, "Boss tokens"): a boss battle, win or lose, counts once it reaches 10 of your moves or 5
minutes; per account, a rolling 24 hours: the first counted battle with no token in the window always drops one, after that 25% a
battle, up to 3; decided by the server only. The result screen shows "You got a [Boss] token!" with OK in the gambling warning's box;
tokens show where keys and crates do. A boss crate costs 3 of its boss's tokens, or 1 token and 1 crate key; buying is the server's,
atomic. Admins can give themselves keys and tokens. How it works: [shop.md](../areas/shop.md), "Boss tokens".

The calls made here, each easy to change:

- **Solo battles count by the server's clock alone.** Boss alone and a Solo raid run on the device: the server can't see their moves, so
  "10 of your moves" is only the device's word there. The safe option, built: the app asks the server to start a solo battle as it
  begins (the server notes the time) and finishes it from the result screen; it counts when 5 minutes or more passed between the two,
  by the server's clock. One open at a time per account (a new start replaces it, uncounted), each finished once. What stays open: a
  script could open a battle, wait 5 minutes and finish it without playing. That costs the same 5 minutes a real battle does, and the
  window's cap (3 a day) bounds it, so a cheat gains no more tokens than a player who plays. Closing that fully would mean the server
  replaying solo battles (their boss's moves come from the device too), which isn't worth it for a cosmetic.
- **Online battles count by the match room.** It counts each person's picks that went in (at each turn's lock) and knows when the match
  began; a battle counts when they reach 10 or the 5 minutes (to the match's end, or to when they left). It's counted as their result
  is saved, once.
- **Which battles:** the boss modes (a Boss raid online, a Boss Battle party, a Solo raid, Boss alone). Not the Crowd's boss final: it's
  the end of a Crowd match the top 4 reach, not a boss battle chosen; easy to add later.
- **Guests:** where sign-in is set up (production), only signed-in accounts earn tokens. A guest's things move into the account it
  signs in to, so many guests (each with the window's guaranteed first token) could fill one account past the cap. Online play already
  needs sign-in there; a guest's solo battle simply notes nothing. Locally and in e2e (no sign-in) guests earn them. **For Eric:** say if
  guests should earn them too (then the merge needs a cap of its own).
- **Which boss's token:** one of the live bosses (playable for players: not the Hidden Boss, not Timber while he's admins first, not
  one resting), each as likely, the server's own randomness. Admins may grant any of those and Timber's.
- **Crate keys are stored now** (`wallets.crate_keys`, a column added with a default: old rows read 0, old apps keep working). The
  Crates tab's "Keys × ∞" became the real count; its own crates stay free while testing ("Crates and keys are unlimited while we test."
  became "Crates are unlimited while we test."). Nothing gives keys yet but an admin's grant (keys for players are a later call:
  Squads' rewards, the shop).
- **What a boss crate holds:** the boss's ride as its only Mythic (so the only item behind Fischer Random, 2% of a crate), and the Beta
  Crate's 24 Common to Epic items in its boxes, at the existing crates' odds. **For Eric:** with 14 bosses sharing at most 3 tokens a
  day, a boss's crate takes a while, and its ride is 1 in 50 of those; a bigger Fischer Random for boss crates is one number.
- **Buying opens the crate at once** into your locker, as the Crates tab's crates open (there's no unopened crate to keep), and the
  shop card answers with the item and its picture.
- **The result screen asks for an online battle's token** a few times (0.7 to 21 s after the results) while the room writes them, rather
  than a new protocol message: nothing changes in the match's protocol.
- **Drops are kept 30 days** (the window needs one; the rest is for answering a question), then the Worker's schedule clears them.
- **Admins' grants live in the Crates tab** (there was no admin grant menu before): "+1 crate key", a boss and "+1 token" / "+3
  tokens"; at most 10 at once; no Worker variable was needed (admins are `ADMIN_EMAILS`).
- **Token pictures:** copied as drawn from `claude/boss-art`; every live boss and Timber have one (Blitz's waits for its boss). A boss
  without one gets a plain gold coin with its initial.
