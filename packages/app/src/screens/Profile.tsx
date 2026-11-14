import { useEffect, useState } from "preact/hooks";
import { account, onAccountChange } from "../account.ts";

/** The account state, kept in sync. (Profiles themselves: PlayerProfile.tsx.) */
export function useAccount() {
  const [, setTick] = useState(0);
  const read = account();
  useEffect(() => {
    const off = onAccountChange(() => setTick((t) => t + 1));
    // (A change between this render and this effect, which runs after the paint, had no listener yet: drawn now. Nov 14, status.ts.)
    if (account() !== read) setTick((t) => t + 1);
    return off;
  }, []);
  return read;
}
