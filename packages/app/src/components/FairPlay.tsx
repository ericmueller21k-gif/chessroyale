import { useEffect, useState } from "preact/hooks";
import { BANNED_LINE, SUPPORT_EMAIL } from "@chessroyale/core";
import { checkBan, enterBan, isBanned, onBanChange } from "../ban.ts";
import { account, loadSignInOptions, onAccountChange } from "../account.ts";
import { SignIn } from "./SignIn.tsx";

/**
 * Fair play's ban screen (Eric, Nov 13: "If you try to sign in, it would say your account has been banned. For more information,
 * email support"): the one thing a banned account sees, on every URL, in place of the whole app (main.tsx). The line, with the address
 * a mailto link (no menus, no appeal box: appeals come by email, a person answers them), and under it a sign-in to another account: on
 * a shared device (a family's tablet) anyone else signs in to their own account and plays, while the banned one is refused again
 * (the review of #687, M1). docs/decisions/2026-11-13-ban-blocks-sign-in.md.
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
  const [, rerender] = useState(0);
  useEffect(() => {
    // (A sign-in here, by an emailed code: the server is asked at once whether it lets this browser in now. Google's comes back as
    // a new page load, which asks too.)
    const before = account().profile;
    const off = onAccountChange(() => {
      rerender((n) => n + 1);
      if (account().profile !== before) void checkBan();
    });
    void loadSignInOptions();
    return off;
  }, []);
  const config = account().config;
  return (
    <main class="ban-screen">
      <p class="ban-line" role="alert">
        {BEFORE}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {AFTER}
      </p>
      {/* (Not on a device that answered "too young": it can't sign in anywhere.) */}
      {config?.accounts && (config.google || config.email) && account().age !== "under" && (
        <section class="ban-signin">
          <SignIn google={config.google} email={config.email} next="/" title="another account" />
        </section>
      )}
    </main>
  );
}
