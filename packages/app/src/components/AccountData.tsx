import { useState } from "preact/hooks";
import { ACCOUNT_DATA_URL, deleteMyAccount } from "../account.ts";

/**
 * Settings → ACCOUNT: download everything the game keeps about your account, or delete the account after a
 * confirmation that says what goes and what stays (the server's account-data.ts; the privacy policy says the same).
 */
export function AccountData() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
      setBusy(false);
    }
  };
  return (
    <>
      <a class="fd-row-link" href={ACCOUNT_DATA_URL} download>
        Download my data: everything we keep about your account ›
      </a>
      {!confirming ? (
        <button type="button" class="fd-row-link fd-row-danger" onClick={() => setConfirming(true)}>
          Delete account ›
        </button>
      ) : (
        <div class="fd-panel fd-delete" role="group" aria-labelledby="fd-delete-title">
          <strong id="fd-delete-title">Delete your account?</strong>
          <p>
            Everything about you goes: your profile, name and icon, sign-in, items, coins, friends, reports and chat lines. You're
            signed out on every device, and this device's settings reset.
          </p>
          <p>
            Your match results stay, without your name, so the game's numbers stay right. If your account is banned for fair play,
            the ban stays: a new account with the same email or Google account is banned too.
          </p>
          <p>
            <strong>This can't be undone.</strong>
          </p>
          {error && (
            <p class="fd-delete-error" role="alert">
              {error}
            </p>
          )}
          <div class="fd-delete-actions">
            <button type="button" class="fd-btn danger" disabled={busy} onClick={() => void remove()}>
              Delete my account
            </button>
            <button type="button" class="fd-btn" disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
