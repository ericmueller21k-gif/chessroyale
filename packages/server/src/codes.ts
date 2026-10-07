/** Lobby codes: 5 characters with no look-alikes (no I, L, O, 0, 1). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ALPHABET[b % ALPHABET.length]).join("");

/**
 * A new lobby under a code nobody is using: random codes until `create` takes one. `create` refuses a code whose lobby
 * still exists (in a match, or showing its results), so neither PLAY nor a new private lobby ever hands out a used
 * code. Null if every try was taken (out of 28.6 million codes, only if something is wrong).
 */
export async function openLobbyCode(create: (code: string) => Promise<boolean>, tries = 5, next: () => string = randomCode): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const code = next();
    if (await create(code)) return code;
  }
  return null;
}
