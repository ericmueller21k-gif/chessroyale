import { useEffect, useState } from "preact/hooks";
import { account, onAccountChange } from "../account.ts";

/** The account state, kept in sync. (Profiles themselves: PlayerProfile.tsx.) */
export function useAccount() {
  const [, setTick] = useState(0);
  useEffect(() => onAccountChange(() => setTick((t) => t + 1)), []);
  return account();
}
