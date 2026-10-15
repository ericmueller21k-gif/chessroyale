import { account, type AccountState } from "./account.ts";

/**
 * The test switches in the address: playtest shortcuts such as `?debug`, `?win=1`, `?rounds=2` or `?pool=` (the full
 * list: docs/areas/ops.md, "Test switches"), which would make easy wins. They work only for an admin (ADMIN_EMAILS),
 * where the server has TEST_SWITCHES on (local, e2e, staging: /api/auth/config says so), and on the local dev server
 * (Vite's). For everyone else they're ignored, as if they weren't there. The server checks its own the same way (a
 * lobby's options, a queue's pool, a crate's forced roll).
 */
export function testSwitchesFor(dev: boolean, state: AccountState): boolean {
  return dev || !!state.config?.testSwitches || !!state.profile?.admin;
}

export const testSwitchesAllowed = () => testSwitchesFor(import.meta.env.DEV, account());

/** The address's query when the test switches are allowed, else an empty one. Read every test switch through this. */
export function testParams(): URLSearchParams {
  if (typeof location === "undefined" || !testSwitchesAllowed()) return new URLSearchParams();
  return new URLSearchParams(location.search);
}
