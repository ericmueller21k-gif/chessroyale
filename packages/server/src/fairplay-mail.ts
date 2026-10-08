/**
 * Fair play's emails: a ban notice and a clearing after a review, sent to the player's sign-in address (email or
 * Google) through Resend, the same service and key that send sign-in codes. No key, or no address: nothing is sent.
 */
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

/** The email for a ban or a clearing: subject and plain text (no names of anyone else, no evidence). */
export function caseEmail(user: Pick<User, "name">, kind: "banned" | "cleared" | "upheld", notice: string | null): { subject: string; text: string } {
  const hi = `Hi ${user.name},`;
  if (kind === "upheld") {
    return {
      subject: "Your HunChess appeal",
      text: [hi, "", "A person read your appeal against the ban on your account, and the ban stands.", ...(notice ? ["", notice] : []), "", "Solo games against bots are still open.", "", "HunChess"].join("\n"),
    };
  }
  if (kind === "banned") {
    return {
      subject: "Your HunChess account can't play online",
      text: [
        hi,
        "",
        notice ??
          "Our fair-play checks found that the moves in your online matches matched a chess engine's far more closely than a person's would, so your account has been banned from online play.",
        "",
        "Solo games against bots are still open.",
        "",
        "If you think this is a mistake, you can appeal: open hunchess.com and tap PLAY, and you'll see a form. A person reads every appeal.",
        "",
        "HunChess",
      ].join("\n"),
    };
  }
  return {
    subject: "Your HunChess account is cleared",
    text: [
      hi,
      "",
      notice ?? "We reviewed your recent online matches and found nothing wrong. Thanks for playing fair.",
      "",
      "Any results we held back while we looked now count again, and you can play online as usual.",
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
