/**
 * Where each boss's lore comes from. Nothing here is invented: every entry is either quoted word for word from a
 * source outside the repo (named in `source`), or a pointer to a paragraph in the repo that the pack reads at run time
 * (`file` + the text its paragraph starts with), so a doc that changes changes the pack with it.
 *
 * The seven sketches marked "PR #264" are the "DRAFTS FOR ERIC" section of that PR's description (the boss select,
 * Oct 16): they were never put in the repo, so they're copied here as written. Hollow's is Eric's own: keep it exactly.
 */

export type LoreSource =
  | { kind: "quote"; source: string; text: string }
  | { kind: "doc"; file: string; startsWith: string };

const PR264 = "PR #264 (the boss select, Oct 16), \"DRAFTS FOR ERIC\" (not shipped; draft lore)";

export const LORE: Readonly<Record<string, readonly LoreSource[]>> = {
  gingerbread: [
    {
      kind: "quote",
      source: PR264,
      text: "Ginger: Baked for a bakery's holiday window, then left in the walk-in freezer over the long weekend. She came out iced over, with a candy cane snapped off the display and a cold streak that never thawed. Anyone who gets close gets frozen.",
    },
  ],
  clown: [
    {
      kind: "quote",
      source: PR264,
      text: "Boingo the Clown: The circus left town without him. He kept the pogo stick, a cart of cream pies and the keys to the old funhouse, and he's been living there since. Nobody laughs at his act anymore, so he makes them laugh.",
    },
  ],
  grex: [
    {
      kind: "quote",
      source: PR264,
      text: "Jefferson: A giraffe who grew up sure he was a dinosaur (he answered to G-REX for years). He landed a job as the fireworks stand's mascot and has been lighting things he shouldn't ever since.",
    },
  ],
  hollow: [
    {
      kind: "quote",
      source: `${PR264}. ERIC'S OWN LORE: keep it exactly`,
      text: "Hollow (Eric's own lore): a Grinch-like figure who was killed somehow. The darkness kept him alive: his center is that darkness, it's his being now, and it holds him together (if it were ruptured…). He carries a strand of Christmas lights.",
    },
    { kind: "doc", file: "docs/history/bosses.md", startsWith: "Eric's reference: a furry Christmas-thief creature" },
    { kind: "doc", file: "docs/history/bosses.md", startsWith: "**Name: Hollow**" },
  ],
  bigboy: [
    {
      kind: "quote",
      source: PR264,
      text: "Big Boy: A baby who never stopped growing. Everything he can reach is a toy, and he can reach a lot: blocks, lollipops, your pieces. He only stops for a nap, and he never wants a nap.",
    },
  ],
  sawyer: [
    {
      kind: "quote",
      source: PR264,
      text: "Sawyer: A raccoon who learned carpentry from the dumpster behind a lumber yard. He wears the hard hat, carries the saw, never pulls a permit, and \"renovates\" whatever he finds, mostly the board you're playing on.",
    },
  ],
  pig: [
    {
      kind: "quote",
      source: PR264,
      text: "Wrangler: A rodeo pig who got tired of being chased around the ring, so he took the rope. Now he ropes anything that moves and waits for high noon to settle it.",
    },
  ],
  alfil: [{ kind: "doc", file: "docs/decisions/2026-10-17-alfil-rules.md", startsWith: "Eric approved Alfil's boss sheet" }],
  // No lore paragraph found in the repo: the pack leans on the look, the lines and the powers.
  hopper: [],
  smudgy: [{ kind: "doc", file: "docs/decisions/2026-10-19-smudgy-still.md", startsWith: "**Eric:** the boss is **Smudgy**" }],
  moo: [{ kind: "doc", file: "docs/decisions/2026-10-20-moo-still.md", startsWith: "**Eric:** the boss is **Moo**" }],
  gardener: [{ kind: "doc", file: "docs/decisions/2026-10-20-gardener-still.md", startsWith: "**Eric:** a hippo" }],
  tiger: [{ kind: "doc", file: "docs/decisions/2026-10-23-tiger-still.md", startsWith: "**Eric (Oct 23):** a circus tiger" }],
};

/**
 * How to refer to a boss, where the repo settles it. Ginger isn't settled: the lore sketch, the FAQ and the area pages
 * say "she/her", the sprite file's comments say "his". The packs go with "she" (the majority) and the sample flags it.
 */
export const PRONOUNS: Readonly<Record<string, string>> = {
  gingerbread: "she/her (lore sketch, FAQ and area pages; the sprite file's comments say \"his\": unsettled, flagged for Eric)",
  hopper: "two friends drawn as one figure: Chub, a brown rabbit, riding Chirp, a grasshopper (Chub talks; Chirp chirps, as \"(Chirp!)\" in his lines)",
  moo: "two characters: Moo, a cow who only says \"Moo\" (with a feeling), and the Moon, who talks; \"they\" for the pair",
};
