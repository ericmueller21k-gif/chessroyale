const CONTACT = "privacy@hunchess.com";

/** The privacy policy and terms: short and plain. */
export function LegalScreen({ page, onBack }: { page: "privacy" | "terms"; onBack: () => void }) {
  return (
    <div class="screen legal">
      <h1>{page === "privacy" ? "Privacy policy" : "Terms of use"}</h1>
      <p class="muted small">Last updated October 8, 2026</p>
      {page === "privacy" ? (
        <>
          <h2>What we keep</h2>
          <ul>
            <li>Your display name and icon.</li>
            <li>If you sign in: your email address, or your Google account ID and email (from Google's sign-in, with your permission). We never see your Google password.</li>
            <li>Your match results: placement, scores, mode and date, to show your stats and, later, ratings.</li>
            <li>A sign-in cookie on your device, so you stay signed in. It's only for signing in, not for ads or tracking.</li>
            <li>
              For fair play, your moves in online matches: each position, your move, how it compares with the engine's best and with
              what the other players picked, how long you took, and how many times the page was hidden or lost focus while your move's
              clock ran. We keep them for 3 days, or 30 days if you were reported or flagged by our cheat checks, then delete them. They're
              kept longer only while a review of your account is still open. A short summary of each match (how strong your moves were, a
              fair-play score) stays with your results.
            </li>
            <li>Reports you make about other players, reports about you, and any fair-play decision about your account and why.</li>
            <li>
              A second cookie with a random number for your device, for fair play only: if an account is banned, a new account playing from
              the same device is looked at by a person. It isn't used for anything else, and clearing your cookies removes it.
            </li>
            <li>If your account is banned: an appeal you send, and our reply. We email you about a ban, or when a review clears you.</li>
          </ul>
          <h2>What we don't do</h2>
          <p>No ads, no ad tracking, no selling or sharing your information. Your email is only for signing in.</p>
          <h2>Who handles it</h2>
          <p>
            The game runs on Cloudflare, which stores the data. Google handles "Continue with Google". Resend sends sign-in codes and
            fair-play notices by email. Each only gets what it needs to do that job.
          </p>
          <h2>Your choices</h2>
          <p>
            You can play as a guest without giving us any personal information. To see or delete what we keep about you, email{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </>
      ) : (
        <>
          <h2>Playing fair</h2>
          <p>
            No engines, bots or outside help in online matches, and one account per person. Online matches are checked for engine use.
            Accounts that cheat, harass other players or use offensive names can be suspended or removed.
          </p>
          <h2>Your account</h2>
          <p>Keep your sign-in to yourself. You're responsible for what's played on your account.</p>
          <h2>The game</h2>
          <p>
            HunChess is free and provided as it is. Features, rules and stats can change while the game grows, and we can't promise it will
            always be available.
          </p>
          <h2>Contact</h2>
          <p>
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
        </>
      )}
      <button type="button" class="btn btn-secondary" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
