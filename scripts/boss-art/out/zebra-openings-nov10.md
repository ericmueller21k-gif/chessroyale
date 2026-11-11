# Don Dough's opening comments and power lines (Nov 11)

Eric, Nov 11 (`notes/zebra-eric.md` on `claude/director-notes`): the kingpin is **Don Dough**; "since he's a chess enthusiast he throws out
a comment on whatever opening you do, say 3-4 moves in"; his passive is **Rising Dough**; his ultimate, **Gold Plate**: "He makes his
queen gold plated and it becomes shiny gold, and can no longer be captured by pawns for the rest of the game."

**How to use them.** About 3 or 4 moves in, look up the game's moves in the opening library
(`packages/chess/data/openings.json`, as the game already does): take the most specific family below whose name the library's name
**starts with** (the "Match" column; first match wins, top to bottom), and he says one of its two lines (or both, a few seconds apart).
Nothing matches: the fallback. Said once a game. The lines speak to the crowd whichever side it plays.

**Checks** (as the chatter's: `npx tsx scripts/boss-art/zebra-chatter-check.ts`, output [zebra-chatter-check.txt](zebra-chatter-check.txt),
all passed): each family's sample line is legal and named so in the library; each concrete claim ("X hits Y", "b2 hangs", "that scores
worse") is checked with chess.js or Stockfish 19 (3,000,000 nodes). Lines with no concrete claim are opinion or flavor ("classic",
"bold").

| Family (match) | Sample line (check id) | Line 1 | Line 2 | What's checked |
| --- | --- | --- | --- | --- |
| Italian Game | 1.e4 e5 2.Nf3 Nc6 3.Bc4 (`op-italian`) | Bc4, staring at f7. Classic, like Grandma's sourdough. | Slow-cook it with c3 and d3. That's how pros bake. | the c4 bishop hits f7; 3...Bc5 4.c3 Nf6 5.d3 legal, Italian (`op-italian-slow`) |
| Ruy Lopez | 1.e4 e5 2.Nf3 Nc6 3.Bb5 (`op-ruy`) | The Spanish. Bb5 leans on the knight guarding e5. | Centuries old and still fresh. Like my starter. | b5 hits c6; the c6 knight guards e5 |
| Scotch Game | 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 (`op-scotch`) | The Scotch! d4 on move three. Bold. | Center's open now. Don't just stand in it. | legal; "Scotch Game" |
| Petrov's Defense | 1.e4 e5 2.Nf3 Nf6 3.Nxe5 (`op-petrov`) | The Petrov. Copycat. I respect a copycat. | Just don't copy with Nxe4. Qe2 says hello. | Stockfish for Black: 3...d6 0.47, 3...Nxe4 0.39; after 4.Qe2 the queen hits e4 (`op-petrov-qe2`) |
| King's Gambit | 1.e4 e5 2.f4 exf4 3.Nf3 g5 (`op-kings-gambit`) | King's Gambit! Romantic. Also a little reckless. | Take it, then ...g5 to hold it. Old school. | legal; "King's Gambit Accepted" |
| Sicilian Defense | 1.e4 c5 (`op-sicilian`), 2.Nf3 d6 3.d4 cxd4 (`op-open-sicilian`) | The Sicilian. Fighting for d4 from the side. | Open Sicilian? Nf3, d4, takes. Now we're cooking. | c5 hits d4; the open line legal, Sicilian |
| French Defense | 1.e4 e6 2.d4 d5 (`op-french`) | The French. Solid crust, cramped crumb. | That c8 bishop. Trade it or break with ...c5. | legal; French (the bishop and ...c5: the chatter's `french-trade`, `french-breaks`) |
| Caro-Kann Defense | 1.e4 c6 2.d4 d5 (`op-caro`) | Caro-Kann. The c6 pawn backs up d5. Sturdy. | Get the bishop to f5 before ...e6. Smart dough. | c6 hits d5; ...Bf5 first: the chatter's `caro-advance` |
| Scandinavian Defense | 1.e4 d5 2.exd5 Qxd5 3.Nc3 (`op-scandinavian`) | The Scandinavian. Queen out on move two? Brave. | Nc3 hits her right away. Free tempo, kid. | c3 hits d5 |
| Pirc Defense | 1.e4 d6 2.d4 Nf6 3.Nc3 g6 (`op-pirc`) | The Pirc. Let him build it, then bite it. | Bishop on g7, castle, wait. Patience is a recipe. | legal; "Pirc Defense" |
| Modern Defense | 1.e4 g6 2.d4 Bg7 (`op-modern`) | The Modern. Bishop on g7 aiming at d4. Sneaky. | No pieces in the center yet. Very fancy. | g7 hits d4 |
| Alekhine Defense | 1.e4 Nf6 2.e5 Nd5 3.c4 Nb6 4.d4 (`op-alekhine`) | Alekhine's! Let him chase the knight. Love it. | e5, c4, d4. Big center, big target. | 3.c4 hits the d5 knight (`op-alekhine-chase`); d4 backs e5 |
| Queen's Gambit Declined | 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 (`op-qgd`) | Queen's Gambit Declined. Solid as day-old bread. | Castle, then hit back with ...c5 when it's ready. | legal; QGD |
| Queen's Gambit Accepted | 1.d4 d5 2.c4 dxc4 (`op-qga`) | Took on c4? Fine. Just don't try to keep it. | It's not a real gambit. The pawn comes back. | legal; QGA (holding it with ...b5 loses: the chatter's `qga-hold`, 0.00) |
| Slav Defense | 1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5 (`op-slav`) | The Slav. c6 backs d5, and the bishop stays free. | Take on c4, then Bf5. Bishop first, always. | legal; "Slav"; the c6 pawn backs d5 |
| Queen's Pawn Game: London System | 1.d4 d5 2.Nf3 Nf6 3.Bf4 c5 4.e3 Nc6 5.c3 Qb6 (`op-london`) | The London. Same moves every game. Cute. | ...c5, ...Qb6, and his b2 pawn gets nervous. | legal; "London System"; b2 attacked and undefended |
| King's Indian Defense | 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 (`op-kid`) | King's Indian. Give him the center. For now. | ...e5, ...Nc6, ...f5. Race you to the king. | legal; KID (the race: the chatter's `mar-del-plata`) |
| Nimzo-Indian Defense | 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 (`op-nimzo`) | Nimzo-Indian. Pin the knight. Classy. | Bishop for knight, and his c-pawns double up. Worth it. | b4 hits c3 (the pin, the king behind on e1); the trade and doubled pawns: the chatter's `nimzo-samisch` |
| Queen's Indian Defense | 1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.g3 Bb7 (`op-qid`) | Queen's Indian. ...b6, ...Bb7, and e4 is mine. | Quiet. Like a bakery at 4 a.m. | b7 hits e4 |
| Dutch Defense | 1.d4 f5 (`op-dutch`) | The Dutch! ...f5 on move one. Feisty. | Stonewall? c6, d5, e6, f5. A fortress of crust. | f5 hits e4; the Stonewall (...e6, ...d5, ...c6) legal, Dutch (`op-stonewall`) |
| English Opening | 1.c4 e5 (`op-english`) | The English. c4 first, the center later. | ...e5 against it? A Sicilian in reverse, a tempo up. | legal; "English Opening" (1.c4 e5 is the Sicilian's mirror, White a move ahead) |
| Réti Opening | 1.Nf3 d5 2.c4 (`op-reti`) | The Réti. Hit d5 from the side. Hypermodern. | No pawns in the middle? Fancy. I like fancy. | c4 hits d5 |
| (anything else) | | Huh. Never seen that. Gutsy, kid. | Off the menu. Let's see if it bakes. | none: the fallback |

## Rising Dough (his passive): a lump of dough drops, rises over a few turns, can be squashed

| When | Line (one at random) |
| --- | --- |
| The drop | Let it proof. / A little something for later. / Fresh dough, coming up. |
| It rises (the piece comes in) | Out of the oven! / Hot and fresh. Mind the crust. / Told you. Never rush good dough. |
| You squash it | Hey! That was proofing! / My dough! You flattened my dough! / Rude. That was a good batch. |

(The God King's own "squash it before it rises" is his, not Don Dough's: the god-king lane.)

## Gold Plate (his ultimate): his queen turns gold; pawns can no longer take her for the rest of the game

| When | Line |
| --- | --- |
| The warning (the beat before) | Time to get fancy. |
| The cast | Gold plated. Pawns, hooves off the lady. |
| The close (Eric: the moment ends on how your pawns are worthless against her; one of these at random) | Your pawns? Worthless now. Cute, but worthless. / Go ahead, throw a pawn at her. I'll wait. / Pawns versus gold? That's not a trade, that's a joke. / Every pawn you've got, and not one can touch her. / Your pawns just became decoration, kid. / Solid gold. Your pawns can look, not touch. |
| A pawn bounces off her | Ha! Pawns can't touch gold. / Boing. Try a bigger piece, kid. / That's real gold, pal. Not for pawns. |

(Only the rule is claimed: pawns can't capture her. If the director's calls hold (no queen: his strongest piece; a second cast gilds the
next piece), "the lady" fits only the queen: say "Gold plated. Pawns, hooves off." for any other piece.)
