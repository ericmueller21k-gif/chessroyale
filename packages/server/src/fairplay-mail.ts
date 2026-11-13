/**
 * Fair play's emails: a ban notice (the ban screen's words), an appeal turned down, and a clearing after a review, sent to the
 * player's sign-in address (email or Google) through Resend, the same service and key that send sign-in codes. No key, or no
 * address: nothing is sent.
 */
import { BANNED_LINE, SUPPORT_EMAIL } from "@chessroyale/core";
import type { User } from "./accounts.ts";
import type { CaseMailer } from "./fairplay.ts";

export interface MailEnv {
  RESEND_API_KEY?: string;
  /** The sign-in emails' sender, e.g. "HunChess <login@hunchess.com>": fair play writes from fairplay@ the same domain. */
  EMAIL_FROM?: string;
}

/** The sender: fairplay@ the sign-in emails' domain. */
export function fairplayFrom(env: MailEnv): string {
  const domain = (env.EMAIL_FROM ?? "HunChess <login@hunchess.com>").match(/@([^>\s]+)/)?.[1] ?? "hunchess.com";
  return `HunChess <fairplay@${domain}>`;
}

/**
 * The email for a ban, an appeal turned down or a clearing: subject and plain text (no names of anyone else, no evidence). A ban's
 * says what the ban screen says (Eric, Nov 13: BANNED_LINE; appeals by email), with the admin's note for the player, if any.
 */
export function caseEmail(user: Pick<User, "name">, kind: "banned" | "cleared" | "lifted" | "upheld", notice: string | null): { subject: string; text: string } {
  const hi = `Hi ${user.name},`;
  if (kind === "upheld") {
    return {
      subject: "Your HunChess appeal",
      text: [hi, "", "A person read your appeal against the ban on your account, and the ban stands.", ...(notice ? ["", notice] : []), "", `For more information, email ${SUPPORT_EMAIL}.`, "", "HunChess"].join("\n"),
    };
  }
  if (kind === "banned") {
    return {
      subject: "Your HunChess account has been banned",
      text: [hi, "", BANNED_LINE, ...(notice ? ["", notice] : []), "", "HunChess"].join("\n"),
    };
  }
  return {
    subject: "Your HunChess account is cleared",
    text: [
      hi,
      "",
      notice ?? "We reviewed your recent online matches and found nothing wrong. Thanks for playing fair.",
      "",
      // (A lifted ban: the ban ended every session the account had, so it signs in again. A review cleared: nothing was ended.)
      kind === "lifted"
        ? "Your ban is lifted, and any results we held back while we looked now count again. Sign in again to play online."
        : "Any results we held back while we looked now count again, and you can play online as usual.",
      "",
      "HunChess",
    ].join("\n"),
  };
}

/** A CaseMailer for the Worker (undefined when there's no Resend key, so nothing tries to send). */
export function caseMailer(env: MailEnv, fetcher: typeof fetch = fetch): CaseMailer | undefined {
  if (!env.RESEND_API_KEY) return undefined;
  return async (user, kind, notice) => {
    if (!user.email) return;
    const { subject, text } = caseEmail(user, kind, notice);
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fairplayFrom(env), to: [user.email], subject, text }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}`);
  };
}
