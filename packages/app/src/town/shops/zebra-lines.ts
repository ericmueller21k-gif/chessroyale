/**
 * Rolling Dough's words (Nov 11): the art branch's chatter and lines (claude/boss-art scripts/boss-art/out/zebra-chatter-nov10.md, every
 * chess claim checked there with chess.js, the opening library and Stockfish: zebra-chatter-check.txt, all passed), word for word.
 * Data only; the room plays them (shops/zebra-scene.ts).
 *
 * Who: the crew at the back table by their look (Toque `crew-c`, the theory nerd; Fedora `crew-d`; Beanie `crew-e`), the kingpin Don
 * Dough (`don`), the door guards (Flat cap `guard-a`, Paper cap `guard-b`) and the counter zebra (the Shopkeeper).
 */

/** A zebra who talks. */
export type ZebraWho = "crew-c" | "crew-d" | "crew-e" | "don" | "guard-a" | "guard-b" | "keeper";
/** One line: who says it, and whether it's the kingpin correcting them (his `sitScoff`) or a crew member arguing (`sitArgue`). */
export interface ZebraLine {
  readonly who: ZebraWho;
  readonly text: string;
  readonly scoff?: true;
  readonly argue?: true;
}

const C = "crew-c" as const;
const D = "crew-d" as const;
const E = "crew-e" as const;
const K = "don" as const;

/**
 * The back table's argument (Eric, Nov 10: "a conversation going between them, and it can loop … he basically always one-ups, he
 * corrects all their wrong information"): 22 exchanges, played in order, then from the top. He teases ("kid", "cute", "genius"), never
 * "are you stupid".
 */
export const ZEBRA_CHATTER: readonly (readonly ZebraLine[])[] = [
  [{ who: E, text: "The Najdorf's just ...a6 on move two, right?" }, { who: K, text: "Move five. Nf3, d6, d4, takes, takes, Nf6, Nc3, a6.", scoff: true }],
  [{ who: D, text: "Nobody grabs b2 in the Najdorf. It's poison.", argue: true }, { who: K, text: "Bg5, e6, f4, Qb6, Qd2, Qxb2. Poisoned, but it holds." }],
  [{ who: C, text: "The Catalan's just a slow Queen's Gambit." }, { who: K, text: "Take on c4 and that g2 bishop stares down at a8. Cute.", scoff: true }],
  [{ who: E, text: "King's Indian. Castle, then just attack, right?" }, { who: K, text: "Nc6, d5, Ne7. Then f5, f4, g5. And pray he's slower." }],
  [{ who: D, text: "Grünfeld? You just hand him the whole center.", argue: true }, { who: K, text: "Then we hit it. Bg7, c5, hit d4. A big center's a target.", scoff: true }],
  [
    { who: C, text: "Exchange Grünfeld, Rb1. Now a2's safe, right?" },
    { who: K, text: "Castles, Be2, cxd4, cxd4, Qa5 check. Bd2, Qxa2." },
    { who: K, text: "Free pawn. Then he castles and gets play. Even game." },
  ],
  [{ who: E, text: "The Berlin's boring. Queens are off by move eight." }, { who: K, text: "Qxd8 check, Kxd8. Black keeps both bishops. Boring wins.", scoff: true }],
  [{ who: D, text: "Marshall Attack's just a free pawn for White.", argue: true }, { who: K, text: "Eight...d5. Free pawn, sure. Then his king gets mugged." }],
  [{ who: C, text: "So why doesn't everybody take the pawn?" }, { who: K, text: "They duck it. 8.h3 or 8.a4. The Anti-Marshall." }],
  [{ who: C, text: "Sveshnikov leaves a hole on d5. Free square!", argue: true }, { who: K, text: "Sure. Then ...b5, ...f5, and his knight on a3 cries.", scoff: true }],
  [
    { who: E, text: "Queen's Gambit. I take on c4 and keep the pawn.", argue: true },
    { who: K, text: "Hold it with ...b5? a4, then Qf3 hits your rook." },
    { who: K, text: "It's not a real gambit, kid. You give it back.", scoff: true },
  ],
  [{ who: D, text: "Yugoslav Attack. Castle long, push h4, mate.", argue: true }, { who: K, text: "Then ...Rxc3. bxc3, and your king's out in the rain." }],
  [{ who: E, text: "The Caro-Kann is for scaredy cats." }, { who: K, text: "Advance? 3...Bf5. Bishop out before e6. That's brains.", scoff: true }],
  [{ who: C, text: "French is cursed. That c8 bishop never gets out.", argue: true }, { who: K, text: "So trade it: ...b6, ...Ba6. Or break with ...c5, ...f6." }],
  [{ who: D, text: "Exchange Ruy? I take on e5. Free pawn." }, { who: K, text: "Qd4. Fork. Nf3, Qxe4 check. Pawn's back, genius.", scoff: true }],
  [{ who: E, text: "Two Knights? Ng5, Nxf7, game over.", argue: true }, { who: K, text: "Only if you take on d5 with the knight. Play ...Na5." }],
  [{ who: C, text: "The London. Same moves every single game." }, { who: K, text: "So go ...c5, ...Nc6, ...Qb6. His b2 pawn's hanging." }],
  [{ who: D, text: "Evans Gambit? That's from a museum.", argue: true }, { who: K, text: "b4, Bxb4, c3. Tempo on the bishop, d4 next. Still bites.", scoff: true }],
  [{ who: C, text: "Nimzo-Indian. Why give up the bishop?" }, { who: K, text: "a3, Bxc3 check, bxc3. Doubled c-pawns. Worth it." }],
  [{ who: D, text: "Rook ending? I just check him forever.", argue: true }, { who: K, text: "Not once he builds a bridge. Rook to the fourth. Lucena.", scoff: true }],
  [
    { who: E, text: "Pawn down in a rook ending? I'd resign." },
    { who: K, text: "Philidor. Rook on your third till the pawn steps up." },
    { who: K, text: "Then go behind it and check from the back. Draw." },
  ],
  [{ who: C, text: "King and pawn ending. Just run the pawn.", argue: true }, { who: K, text: "Push first and it's a draw. King first, and it wins.", scoff: true }],
];

/** The front room's "nothing here but a bakery" (Eric: "nothing here but a bakery, you know, move along"): the guards' ten, in turn. */
export const ZEBRA_GUARD_LINES: readonly ZebraLine[] = [
  { who: "guard-a", text: "Bakery's open. Bread's up front. That's it." },
  { who: "guard-b", text: "Nothing back there. Just flour. Lots of flour." },
  { who: "guard-a", text: "Move along. It's bread." },
  { who: "guard-b", text: "You want a roll? Buy a roll. Then go." },
  { who: "guard-a", text: "That door? Broom closet. Real big broom." },
  { who: "guard-b", text: "We sell bread. Only bread. Ask anybody." },
  { who: "guard-a", text: "Chess? Never heard of it. Croissant?" },
  { who: "guard-b", text: "Don't mind the yelling. That's the oven." },
  { who: "guard-a", text: "Nobody plays nothing in here. Got it?" },
  { who: "guard-b", text: "Hooves off the baguettes, pal." },
];
/**
 * "He's in the back" (Eric, Nov 11: "anyone else you talk to or walk up to and click on in the shop that's in the front tells you he's in
 * the back"): a guard you tap, and the counter zebra's Talk (no crate yet), one at random each time.
 */
export const ZEBRA_BACK_LINES: readonly string[] = ["He's in the back.", "Boss? In the back. Knock first.", "He's in the back. Don't touch the rolls.", "Back room. He's busy. Studying... bread."];
/**
 * The guard out front (Eric, Nov 11: "when you talk to him, he just says like the boss man is inside or something"): his card's Talk,
 * one at random each time.
 */
export const ZEBRA_OUTSIDE_LINES: readonly string[] = ["Boss man's inside. In the back.", "Don's in the back. Bread's up front. Simple.", "He's inside. Wipe your hooves first.", "Looking for the boss? Inside, all the way back."];
/** A line of `lines` at random, never the one just said (`last`) while there's another. */
export function pickLine(lines: readonly string[], last: string | null, rand: () => number = Math.random): string {
  const pool = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
}

/** The talk beat (walking up to the kingpin): the crew draw on you, he waves them down, his challenge. */
export const ZEBRA_TALK = {
  draw: { who: D, text: "Hey! Who let HIM back here?!" },
  relax: { who: K, text: "Relax, relax. Put the bread down." },
  challenge: { who: K, text: "So. You came to play, or to watch the stream?" },
} as const satisfies Record<string, ZebraLine>;

/** The battle's start (his `breadPop`: the roll shouldered, a little pop, a laugh): his line, then Beanie's. */
export const ZEBRA_BATTLE_START = { don: "Hope you studied. Pop!", crew: "Ha! He always does that." } as const;
