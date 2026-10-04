const CONTACT = "privacy@hunchess.com";

/** The privacy policy and terms: short and plain. */
export function LegalScreen({ page, onBack }: { page: "privacy" | "terms"; onBack: () => void }) {
  return (
    <div class="screen legal">
      <h1>{page === "privacy" ? "Privacy policy" : "Terms of use"}</h1>
      <p class="muted small">Last updated October 4, 2026</p>
      {page === "privacy" ? (
        <>
          <h2>What we keep</h2>
          <ul>
            <li>Your display name and icon.</li>
            <li>If you sign in: your email address, or your Google account ID and email (from Google's sign-in, with your permission). We never see your Google password.</li>
            <li>Your match results: placement, scores, mode and date, to show your stats and, later, ratings.</li>
            <li>A sign-in cookie on your device, so you stay signed in. It's only for signing in, not for ads or tracking.</li>
          </ul>
          <h2>What we don't do</h2>
          <p>No ads, no ad tracking, no selling or sharing your information. Your email is only for signing in.</p>
          <h2>Who handles it</h2>
          <p>
            The game runs on Cloudflare, which stores the data. Google handles "Continue with Google". Resend sends sign-in codes by
            email. Each only gets what it needs to do that job.
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
            No engines, bots or outside help in online matches, and one account per person. Accounts that cheat, harass other players or
            use offensive names can be suspended or removed.
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
