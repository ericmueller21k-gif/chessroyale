# The zebras' chatter (Nov 10)

Eric: a looping argument at the back table, the three crew against the kingpin, who's always right and one-ups them, with real
theory ("Rb1, takes, check"), and teasing, never "are you stupid". Plus the front room's "nothing here but a bakery" lines, the talk beat
and the battle-start pair. Lines are kept to speech-bubble length (the other bosses' run about 35 to 50 characters; none here is over 58 characters).

**Who speaks.** The crew by their look (crew-zebra.ts): **Toque** (`npc-zebra-crew-c`, the theory nerd: toque, glasses, pencil),
**Fedora** (`npc-zebra-crew-d`: grey fedora, scar), **Beanie** (`npc-zebra-crew-e`: red beanie, bow tie); the **Kingpin**, **Don Dough** (the boss;
Eric named him Nov 11). His opening comments and power lines: [zebra-openings-nov10.md](zebra-openings-nov10.md). The guards: **Flat cap** (`npc-zebra-guard-a`) and **Paper cap** (`npc-zebra-guard-b`); the **Counter zebra**.
Suggested animations: the crew line on `sitArgue` or `sitTalk`, the others `sitListen`; the kingpin on `sitScoff` (a correction) or
`sitTalk`.

**How every claim was checked.** `npx tsx scripts/boss-art/zebra-chatter-check.ts 3000000` (its output:
[zebra-chatter-check.txt](zebra-chatter-check.txt), **all passed**). For each check id below it:
- replays the line with chess.js: every move legal, every "check" a check;
- finds the line's name in the game's opening library (`packages/chess/data/openings.json`: the entry that agrees with the line move
  for move);
- scores each evaluation with Stockfish 19 (`packages/chess/src/node.ts`, full build, 3,000,000 nodes a position). Scores are the side
  to move's expected score (win plus half the draws): 0.5 is level, 1 is winning, 0 is lost.

## The loop (22 exchanges, played in order, then from the top)

| # | Who | Line | Check (id: what was verified) |
| --- | --- | --- | --- |
| 1 | Beanie | The Najdorf's just ...a6 on move two, right? | |
| | Kingpin | Move five. Nf3, d6, d4, takes, takes, Nf6, Nc3, a6. | `najdorf`: 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 legal; library "Sicilian Defense: Najdorf Variation" |
| 2 | Fedora | Nobody grabs b2 in the Najdorf. It's poison. | |
| | Kingpin | Bg5, e6, f4, Qb6, Qd2, Qxb2. Poisoned, but it holds. | `poisoned-pawn`: 6.Bg5 e6 7.f4 Qb6 8.Qd2 Qxb2 legal; Stockfish 0.52 for White to move: level, the grab holds. (The library names only the French Poisoned Pawn; the Sicilian one is the standard name, ECO B97.) |
| 3 | Toque | The Catalan's just a slow Queen's Gambit. | |
| | Kingpin | Take on c4 and that g2 bishop stares down at a8. Cute. | `catalan`: 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 legal; library "Catalan Opening"; the bishop on g2 sits on the long diagonal to a8 |
| 4 | Beanie | King's Indian. Castle, then just attack, right? | |
| | Kingpin | Nc6, d5, Ne7. Then f5, f4, g5. And pray he's slower. | `mar-del-plata`: ...7.O-O Nc6 8.d5 Ne7 9.Ne1 Nd7 10.Be3 f5 11.f3 f4 12.Bf2 g5 legal; library "King's Indian Defense: Orthodox Variation" |
| 5 | Fedora | Grünfeld? You just hand him the whole center. | |
| | Kingpin | Then we hit it. Bg7, c5, hit d4. A big center's a target. | `grunfeld-exchange`: 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Nf3 c5 legal (c5 attacks d4); library "Grünfeld Defense: Exchange Variation" |
| 6 | Toque | Exchange Grünfeld, Rb1. Now a2's safe, right? | |
| | Kingpin | Castles, Be2, cxd4, cxd4, Qa5 check. Bd2, Qxa2. | `grunfeld-rb1`: 8.Rb1 O-O 9.Be2 cxd4 10.cxd4 Qa5+ (check) 11.Bd2 Qxa2 12.O-O legal |
| | Kingpin | Free pawn. Then he castles and gets play. Even game. | `grunfeld-rb1`: after 12.O-O Stockfish 0.49 for Black to move: level |
| 7 | Beanie | The Berlin's boring. Queens are off by move eight. | |
| | Kingpin | Qxd8 check, Kxd8. Black keeps both bishops. Boring wins. | `berlin`: 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ (check) Kxd8 legal; White gave up his light bishop; library "Berlin Defense" |
| 8 | Fedora | Marshall Attack's just a free pawn for White. | |
| | Kingpin | Eight...d5. Free pawn, sure. Then his king gets mugged. | `marshall`: 7...O-O 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6 legal; library "Ruy Lopez: Marshall Attack"; Stockfish 0.51 for White, a pawn up: Black's attack pays for it |
| 9 | Toque | So why doesn't everybody take the pawn? | |
| | Kingpin | They duck it. 8.h3 or 8.a4. The Anti-Marshall. | `anti-marshall-h3`, `anti-marshall-a4`: both legal after 7...O-O. ("Anti-Marshall" is the usual name for both; the library has no entry for them.) |
| 10 | Toque | Sveshnikov leaves a hole on d5. Free square! | |
| | Kingpin | Sure. Then ...b5, ...f5, and his knight on a3 cries. | `sveshnikov`: 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5 9.Bxf6 gxf6 10.Nd5 f5 legal; library "Sveshnikov Variation" |
| 11 | Beanie | Queen's Gambit. I take on c4 and keep the pawn. | |
| | Kingpin | Hold it with ...b5? a4, then Qf3 hits your rook. | `qga-hold`: 1.d4 d5 2.c4 dxc4 3.e3 b5 4.a4 c6 5.axb5 cxb5 6.Qf3 legal (the queen on f3 sees a8); Stockfish 0.00 for Black to move: lost |
| | Kingpin | It's not a real gambit, kid. You give it back. | `qga`: library "Queen's Gambit Accepted" |
| 12 | Fedora | Yugoslav Attack. Castle long, push h4, mate. | |
| | Kingpin | Then ...Rxc3. bxc3, and your king's out in the rain. | `yugoslav-rxc3`: the Dragon's Yugoslav to 10.O-O-O Rc8 ... 13...Rxc4 14.g4 Rxc3 15.bxc3 legal; library "Dragon Variation, Yugoslav Attack" (the sacrifice on c3 is the Dragon's known idea; no evaluation is claimed) |
| 13 | Beanie | The Caro-Kann is for scaredy cats. | |
| | Kingpin | Advance? 3...Bf5. Bishop out before e6. That's brains. | `caro-advance`: 1.e4 c6 2.d4 d5 3.e5 Bf5 legal; library "Caro-Kann Defense" |
| 14 | Toque | French is cursed. That c8 bishop never gets out. | |
| | Kingpin | So trade it: ...b6, ...Ba6. Or break with ...c5, ...f6. | `french-trade`: Winawer ...4.e5 b6 5.a3 Bf8 6.Nf3 Ba6 7.Bxa6 Nxa6 legal; `french-breaks`: Advance 3.e5 c5 4.c3 Nc6 5.Nf3 f6 legal |
| 15 | Fedora | Exchange Ruy? I take on e5. Free pawn. | |
| | Kingpin | Qd4. Fork. Nf3, Qxe4 check. Pawn's back, genius. | `exchange-ruy`: 4.Bxc6 dxc6 5.Nxe5 Qd4 (hits e5 and e4) 6.Nf3 Qxe4+ (check) legal; Stockfish 0.46 for White to move: level; `exchange-ruy-name`: library "Ruy Lopez: Exchange Variation" |
| 16 | Beanie | Two Knights? Ng5, Nxf7, game over. | |
| | Kingpin | Only if you take on d5 with the knight. Play ...Na5. | `two-knights`: 4.Ng5 d5 5.exd5 legal; Stockfish for Black: 5...Na5 0.49, 5...Nxd5 0.37; `fried-liver`: 5...Nxd5 6.Nxf7 Kxf7 7.Qf3+ legal, library "Fried Liver Attack" |
| 17 | Toque | The London. Same moves every single game. | |
| | Kingpin | So go ...c5, ...Nc6, ...Qb6. His b2 pawn's hanging. | `london-qb6`: 1.d4 d5 2.Nf3 Nf6 3.Bf4 c5 4.e3 Nc6 5.c3 Qb6 legal; b2 attacked and defended by nothing; library "London System" |
| 18 | Fedora | Evans Gambit? That's from a museum. | |
| | Kingpin | b4, Bxb4, c3. Tempo on the bishop, d4 next. Still bites. | `evans`: 4.b4 Bxb4 5.c3 legal (c3 attacks b4); library "Evans Gambit Accepted" |
| 19 | Toque | Nimzo-Indian. Why give up the bishop? | |
| | Kingpin | a3, Bxc3 check, bxc3. Doubled c-pawns. Worth it. | `nimzo-samisch`: 4.a3 Bxc3+ (check) 5.bxc3 legal; `nimzo-name`: library "Nimzo-Indian Defense" |
| 20 | Fedora | Rook ending? I just check him forever. | |
| | Kingpin | Not once he builds a bridge. Rook to the fourth. Lucena. | `lucena`: Kb8 Pb7 Rc1 v Kd8 Ra2: Stockfish 1.00 for White; 1.Rd1+ (check) Ke7 2.Rd4 legal, then 0.00 for Black: lost |
| 21 | Beanie | Pawn down in a rook ending? I'd resign. | |
| | Kingpin | Philidor. Rook on your third till the pawn steps up. | `philidor`: White Kf5, pawn e5, rook h1; Black Ke8, rook a6 (on Black's third rank), Black to move: 0.50, a draw |
| | Kingpin | Then go behind it and check from the back. Draw. | `philidor-behind`: the pawn on e6, Black's rook down to a2: 1...Rf2+ (check) legal, 0.50: still a draw |
| 22 | Toque | King and pawn ending. Just run the pawn. | |
| | Kingpin | Push first and it's a draw. King first, and it wins. | `opposition`: Ke1 Pe2 v Ke8, White to move: 1.Kd2 1.00, 1.e4 0.50 (Black takes the opposition) |

**The teasing.** He never says "are you stupid"; he says "kid", "cute", "genius", "that's brains", "pray", "you're welcome"-style
digs, always with the right move.

## The front room: "nothing here but a bakery" (12)

The guards say one now and then (as the town's chatter does), more often when you stand near them or by the back door; the counter zebra's
are his.

| # | Who | Line |
| --- | --- | --- |
| 1 | Flat cap | Bakery's open. Bread's up front. That's it. |
| 2 | Paper cap | Nothing back there. Just flour. Lots of flour. |
| 3 | Flat cap | Move along. It's bread. |
| 4 | Paper cap | You want a roll? Buy a roll. Then go. |
| 5 | Flat cap | That door? Broom closet. Real big broom. |
| 6 | Paper cap | We sell bread. Only bread. Ask anybody. |
| 7 | Flat cap | Chess? Never heard of it. Croissant? |
| 8 | Paper cap | Don't mind the yelling. That's the oven. |
| 9 | Flat cap | Nobody plays nothing in here. Got it? |
| 10 | Paper cap | Hooves off the baguettes, pal. |
| 11 | Counter zebra | Rye, sourdough, or... the special box? |
| 12 | Counter zebra | Fresh today. Fresh every day. No questions. |

## The talk beat (the back room, walking up to the kingpin)

| When | Who | Line |
| --- | --- | --- |
| The crew stand and draw (`standUp`, `draw`, `aim`) | Fedora | Hey! Who let HIM back here?! |
| He waves them down (`sitRelax`), they lower (`lower`) | Kingpin | Relax, relax. Put the bread down. |
| His challenge | Kingpin | So. You came to play, or to watch the stream? |

## The battle start (his `breadPop`: the roll shouldered, a little pop, a laugh)

| Who | Line |
| --- | --- |
| Kingpin | Hope you studied. *Pop!* |
| Beanie | Ha! He always does that. |
