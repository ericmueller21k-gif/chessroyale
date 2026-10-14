/**
 * Every line of the Hidden Boss's fight, in one table to edit: his, by moment, and the God King's for this fight.
 *
 * Two kinds of line (DECISIONS.md, "The Hidden Boss, phase 1"; Eric, Oct 14: "keeping them intact is a must"):
 * - **Real quotes**, each marked `// QUOTE` with its source: word for word as first published (the research report's
 *   Tier A, verified), never shortened, adapted or re-punctuated.
 * - **PLACEHOLDERS** (every other line of his, and the God King's but his first): ours, written in his chess persona
 *   (intense, confident, against memorized theory and engine crutches, for "real chess"), waiting for Eric's own lines.
 *   None is presented as his words, none is a near-copy of a real quote; nothing political, nothing about any nation,
 *   nothing hateful.
 */
export const RECLUSE_LINES = {
  /** His entrance (the stare): one of these (placeholders). See `introE4` for a battle he opened with 1.e4 as White. */
  intro: ["Sit down. Let's find out if you can really play.", "Forget your opening book. Here we play chess.", "Show me one move you didn't copy from somewhere."],
  /** His entrance instead, when he's White and the battle's game opened 1.e4: the one place it reads right. */
  // QUOTE (A1): his note to 1 P-K4 in his game against Bisguier, Chess Life, Dec 1963, pp. 302-303; repeated in his 1969 book.
  introE4: "Best by test.",
  /** His ultimate as it comes, the clock turning to bullet: one, picked by the battle (placeholders: no verified quote fits). */
  bullet: ["You're thinking too much. Stop calculating and play!", "Enough staring at the board. Pure chess now. Move!", "All that thinking, and still no idea. Play fast!"],
  /** The God King's help tried, and blocked (he slams the book shut): one, in turn. */
  mock: [
    // QUOTE (A6): Peter Kihss in the New York Times, Jul 4, 1972, p. 14 (Winter, C.N. 5830).
    "I don't believe in psychology. I believe in good moves.",
    // QUOTE (A3, a fragment as published): on 6 Be2 in the Grünfeld, his game against Greenwald, Chess Life, Oct 1963, pp. 237-238.
    "A genuine beginner's move",
    "Engine moves? Keep that crutch away from my board.",
    "Theory, engines, a king in armor. None of it is chess!",
  ],
  /** Consulting the book when he's behind on material, now and then (placeholders). */
  rattled: ["Hm. I've seen this before.", "Interesting. Very interesting."],
  /** He wins: one of these. */
  victory: [
    // QUOTE (A7): on Alekhine, "The Ten Greatest Masters in History", Chessworld, Jan-Feb 1964, pp. 56-61.
    "He played book lines, but didn't know them very well.",
    "Memorized moves. I knew it.",
  ],
  /** Beaten: his mumbling as he slumps on his knees, one line after another. */
  fall: [
    "No... the book said... bishop takes... no...",
    // QUOTE (A8): press conference, Sep 21, 1992, in Seirawan & Stefanovic, No Regrets.
    "Morphy, I think everyone agrees, was probably the greatest genius of them all.",
    "Sixty-four squares... I counted every one...",
  ],
} as const;

/** The God King's lines in this fight (his usual ones about calling him are left out: his help doesn't work here). */
export const KING_VS_RECLUSE = {
  /** His opening line (the first is Eric's own, ROADMAP.md, Oct 14; the others are placeholders). */
  intro: ["I sense a tremendous power within this foe.", "Careful. My strength feels faint against this one.", "This is no ordinary boss. Trust your own moves."],
  /** His help tried, and blocked (placeholders). */
  blocked: ["My power... it won't take hold!", "Nothing! He shrugs off my strength.", "I can't reach him. This fight is yours alone."],
} as const;
