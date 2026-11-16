import { useEffect, useState } from "preact/hooks";
import { BANNED_LINE, SUPPORT_EMAIL } from "@chessroyale/core";
import { enterBan, isBanned, onBanChange } from "../ban.ts";

/**
 * Fair play's ban screen (Eric, Nov 13: "If you try to sign in, it would say your account has been banned. For more information,
 * email support"): the one thing a banned account sees, on every URL, in place of the whole app (main.tsx). Only the line, with the
 * address a mailto link: no menus, no appeal box (appeals come by email; a person answers them).
 * docs/decisions/2026-11-13-ban-blocks-sign-in.md.
 */

/** A lobby, a queue or a sign-in said this account is banned: the ban screen (the name kept from the old notice's callers). */
export const showBanNotice = enterBan;

/** Whether the ban screen is up (the app's root draws only it then). */
export function useBanned(): boolean {
  const [banned, setBanned] = useState(isBanned);
  useEffect(() => {
    const off = onBanChange(() => setBanned(isBanned()));
    setBanned(isBanned());
    return off;
  }, []);
  return banned;
}

const [BEFORE, AFTER] = BANNED_LINE.split(SUPPORT_EMAIL) as [string, string];

export function BanScreen() {
  return (
    <main class="ban-screen">
      <p class="ban-line" role="alert">
        {BEFORE}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {AFTER}
      </p>
    </main>
  );
}
