import { useEffect, useState } from "preact/hooks";
import { AGE_STEP_LINE, MONTHS, TOO_YOUNG_LINE, birthYears } from "@chessroyale/core";
import { account, answerAge, dropPendingSignIn, onAccountChange, sendEmailCode, signInWithGoogle, takeSignInNote, verifyEmailCode } from "../account.ts";

const GoogleG = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

type SignInProps = {
  google: boolean;
  email: boolean;
  next?: string;
  failed?: boolean;
  /** What signing in is for, in the box's heading ("play online": "Sign in to play online"); none: a plain "Sign in" (Settings, the profile). */
  title?: string;
};

/** The Sign up view's heading: the age question itself, as neutral as before (no age mentioned). */
export const SIGN_UP_ASK = "Sign up: when were you born?";

/**
 * Signing in, wherever it's offered (Eric, Nov 12: "put a sign in already [first], and then below that... a sign up button, and
 * then... your age thing"). Sign in comes first, with no question: Google, or a 6-digit code sent to your email. Below it, Sign
 * up asks "when were you born?" before the account is made, then offers the same two ways. A sign-in the server can't finish
 * without the answer (an email or Google account with no account yet, or an account from before the question) asks it then
 * (AGE_STEP_LINE), and the answer finishes it. A device that answered "too young" gets a friendly line instead, Sign in included.
 * Both views are the same height (the question's rows wrap as the email's do), so switching moves nothing. `next` is where Google
 * sends you back to. See docs/decisions/2026-11-12-signin-without-age.md and 2026-10-16-age-gate-and-real-money.md.
 */
export function SignIn(props: SignInProps) {
  const [, rerender] = useState(0);
  useEffect(() => onAccountChange(() => rerender((n) => n + 1)), []);
  const [view, setView] = useState<"in" | "up">("in");
  const { age, pending } = account();
  const Heading = props.title ? "h2" : "h3";
  if (age === "under") {
    return (
      <>
        {props.title && <h2 class="signin-title">Online play needs an account</h2>}
        <p class="signin-young" role="status">
          {TOO_YOUNG_LINE}
        </p>
      </>
    );
  }
  const up = view === "up";
  // (A sign-in waiting for the answer asks first, whichever view; Sign up asks before anything else, until it's answered.)
  const ask = pending ? AGE_STEP_LINE : up && age !== "ok" ? SIGN_UP_ASK : null;
  const verb = up ? "Sign up" : "Sign in";
  return (
    <div class="signin-box">
      <Heading class="signin-title" id="signin-ask">
        {ask ?? `${verb}${props.title ? ` to ${props.title}` : ""}`}
      </Heading>
      {ask ? <AgeQuestion key={pending ? pending.kind : "up"} again={pending?.kind === "google"} /> : <SignInOptions {...props} verb={verb} />}
      <div class="signin-switch">
        <span class="muted">{up ? "Have an account?" : "New to HunChess?"}</span>
        <button
          type="button"
          class="btn btn-secondary"
          onClick={() => {
            dropPendingSignIn();
            setView(up ? "in" : "up");
          }}
        >
          {up ? "Sign in" : "Sign up"}
        </button>
      </div>
    </div>
  );
}

/**
 * The age question: a birth month and year, nothing chosen to start with and no age mentioned, so the answer can't
 * be steered (the box's heading asks it). It's checked on this device; only the answer goes to the server, and "too young"
 * sticks. `again`: a Google sign-in waits for it, and goes back to Google once it's answered.
 */
function AgeQuestion({ again }: { again: boolean }) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  // (Back after a refused sign-in: why, until it's answered.)
  const [msg, setMsg] = useState<string | null>(account().ageNote);
  const answer = () => {
    setBusy(true);
    setMsg(null);
    answerAge(Number(month), Number(year))
      .catch((e: unknown) => setMsg((e as Error).message))
      .finally(() => setBusy(false));
  };
  return (
    <div class="signin-options">
      <div class="signin-row signin-born" role="group" aria-labelledby="signin-ask">
        <select aria-label="Birth month" value={month} onChange={(e) => setMonth(e.currentTarget.value)}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        <select aria-label="Birth year" value={year} onChange={(e) => setYear(e.currentTarget.value)}>
          <option value="">Year</option>
          {birthYears(new Date()).map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <button type="button" class="btn btn-primary" disabled={busy || !month || !year} onClick={answer}>
        Continue
      </button>
      {again && <p class="muted small signin-msg">Then pick your Google account again.</p>}
      {msg && <p class="muted small signin-msg">{msg}</p>}
    </div>
  );
}

/** Google, or a 6-digit code sent to your email; `verb` names the code's button ("Sign in", or "Sign up" in that view). */
function SignInOptions({ google, email, next, failed, verb }: SignInProps & { verb: string }) {
  // (A sign-in that waited for the age answer and didn't finish: why, with its address back in the box.)
  const [note] = useState(takeSignInNote);
  const [address, setAddress] = useState(note?.email ?? "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(note?.message ?? (failed ? "Google sign-in didn't work. Try again, or use your email." : null));
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="signin-options">
      {google && (
        <button type="button" class="btn btn-google" onClick={() => signInWithGoogle(next)}>
          <GoogleG /> Continue with Google
        </button>
      )}
      {email &&
        (codeSent ? (
          <>
            <div class="signin-row">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                aria-label="6-digit code"
                maxLength={6}
                value={code}
                onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, ""))}
              />
              <button type="button" class="btn btn-primary" disabled={busy || code.length !== 6} onClick={() => void run(() => verifyEmailCode(address, code))}>
                {verb}
              </button>
            </div>
            <button type="button" class="link-btn" onClick={() => (setCodeSent(false), setCode(""), setMsg(null))}>
              Use a different email
            </button>
          </>
        ) : (
          <div class="signin-row signin-email">
            <input type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email" value={address} onInput={(e) => setAddress(e.currentTarget.value)} />
            <button
              type="button"
              class="btn btn-secondary"
              disabled={busy || !address.includes("@")}
              onClick={() =>
                void run(async () => {
                  await sendEmailCode(address);
                  setCodeSent(true);
                }, `We sent a code to ${address}. It works for 10 minutes.`)
              }
            >
              Email me a code
            </button>
          </div>
        ))}
      {msg && <p class="muted small signin-msg">{msg}</p>}
    </div>
  );
}
