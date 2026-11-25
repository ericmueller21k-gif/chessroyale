# Flaky round 6: the causes (Nov 14, 2026)

Eric, Nov 13: "fix the cause, not add a checker". Each test asked first: is the game wrong, or the test?

- **First, what's common.** Round 5's held frames (`__townHold`) leave nothing behind: `townTap`, `tapInTown` and `townHeld` let go in
  `finally`, and letting go restarts the frame loop with a fresh clock (`run()`), so no frame jumps and nothing stays held. The runners
  weren't slower: run 43625203937's shards took 22% longer in all (15,123 s against about 12,400) because CI recorded every first
  try (already undone, 3f98685); 77a15f0e's took 7% longer.
- **Dev server, shared: a dropped request answered with a 500** (town.spec:1165 phone, town-street:174 phone; likely also
  town-street:155's Meadow Street 500 and the Colosseum's in main run 1216, whose addresses weren't logged). `wrangler dev` reaches our Worker through its own
  proxy, whose connection drops now and then; it sends a GET or a HEAD again but answers a POST with a 500. The town's beat
  (POST /api/town/here, every 5 s) is most of a test's POSTs, so the "Failed to load resource: 500" lands in the town's specs. The
  game was right: a failed beat is dropped and the next one goes, and production has no such proxy. `e2e/dev-proxy-retry.mjs`
  (run before `wrangler dev`) has the proxy send any dropped request again, its body copied. Forced drops (the Worker's port reset
  every 0.75 s): before, 25 of 300 POSTs answered 500; after, 0 of 300, bodies whole (300 of 300 oversized bodies got the server's 413).
- **Game (test hook): a person half behind your pawn read as not drawn** (town:966 and town:1055 desktop, "bot 9 is drawn"). A
  person's tap point was looked for down its middle only; a bot called beside you on a computer can stand with that column behind
  your pawn. It now looks off the middle too, either side, as homes and bosses already do. Not seen happen locally.
- Not done: town-controls:253 (a held right arrow took two steps, south and then east, on a slow first try), town-street:294,
  town-chat:1480, fairplay:65 (a guard), town:646, lobby-chat:28, shop:238, town-chat:1367/1370, alfil:247.
