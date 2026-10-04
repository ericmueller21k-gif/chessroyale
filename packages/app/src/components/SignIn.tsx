import { useState } from "preact/hooks";
import { sendEmailCode, signInWithGoogle, verifyEmailCode } from "../account.ts";

const GoogleG = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/** Google, or a 6-digit code sent to your email. `next` is where Google sends you back to. */
export function SignIn({ google, email, next, failed }: { google: boolean; email: boolean; next?: string; failed?: boolean }) {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(failed ? "Google sign-in didn't work. Try again, or use your email." : null);
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
                Sign in
              </button>
            </div>
            <button type="button" class="link-btn" onClick={() => (setCodeSent(false), setCode(""), setMsg(null))}>
              Use a different email
            </button>
          </>
        ) : (
          <div class="signin-row">
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
