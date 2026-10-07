import { useEffect, useRef } from "preact/hooks";
import { SignIn } from "../components/SignIn.tsx";
import { MuteButton } from "../components/MuteButton.tsx";

const FAQ: [string, string][] = [
  [
    "Why do I need an account to play online?",
    "Every online match is real people against real people, and accounts keep it that way. A ban sticks, your stats and rating mean something, and it's much harder to drop into a match with an engine open in another tab. Guests can still play the whole game against 99 bots.",
  ],
  [
    "How does 50 v 50 work?",
    "100 players, one game of chess from the first move. You're on White or Black for the whole game. Every turn your team of 50 picks a move, and the most popular pick is played. Stockfish scores every pick, so you score by choosing well, even when the crowd goes the other way. After move 10 the lowest scorers go out after every move. Before the game, everyone votes on how it ends: a team final (4v4 down to 2v2), a boss battle against Stockfish, or a duel between the best of each side.",
  ],
  ["Is it free?", "Yes. Coins and cosmetics will be earned by playing, never bought, and they never change the game."],
  [
    "How do you deal with cheating?",
    "Accounts are the first step. Every move is also scored by the engine, so a player who matches it move after move stands out. Automatic checks that flag those players are being built next.",
  ],
  ["What do you do with my email?", "Sign-in only. No newsletters, and we never sell or share it. See the privacy policy."],
  ["Can I play on my phone?", "It's made for phones. Add it to your home screen and it opens like an app."],
];

/** The 50 v 50 loop. Muted is set on the element itself, as phones only autoplay muted video. */
function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute("muted", "");
    void v.play().catch(() => undefined);
  }, []);
  return (
    <video ref={ref} class="demo-video" poster="/media/crowd-demo.jpg" autoplay muted loop playsInline preload="auto" aria-label="A 50 v 50 match being played">
      <source src="/media/crowd-demo.mp4" type="video/mp4" />
      <source src="/media/crowd-demo.webm" type="video/webm" />
    </video>
  );
}

/** The front door: what the game looks like, signing in to play online, or playing bots as a guest. */
export function LandingScreen({
  google,
  email,
  joinCode,
  notice,
  failed,
  onGuest,
}: {
  google: boolean;
  email: boolean;
  joinCode?: string;
  /** An old link's lobby has closed ("That match has ended."). */
  notice?: string;
  failed?: boolean;
  onGuest: () => void;
}) {
  return (
    <div class="screen landing">
      <header class="landing-head">
        <h1 class="logo">
          <span class="logo-crown" aria-hidden="true">
            ♚
          </span>
          HunChess
          <MuteButton />
        </h1>
        <p class="landing-tag">
          <strong>100 players. One board.</strong> Pick the best move for your team of 50. The crowd plays it.
        </p>
      </header>
      <div class="landing-main">
        <figure class="demo-frame">
          <DemoVideo />
          <figcaption class="muted small">A 50 v 50 match</figcaption>
        </figure>
        <div class="landing-actions">
          {notice && (
            <p class="landing-notice" role="status">
              {notice}
            </p>
          )}
          <section class="signin landing-signin">
            <h2>{joinCode ? `Sign in to join lobby ${joinCode}` : "Sign in to play online"}</h2>
            <SignIn google={google} email={email} next={joinCode ? `/lobby/${joinCode}` : "/"} failed={failed} />
          </section>
          <div class="or-line" aria-hidden="true">
            <span>or</span>
          </div>
          <button type="button" class="btn btn-secondary btn-wide" onClick={onGuest}>
            Play vs 99 bots as a guest
          </button>
          <p class="muted small landing-note">Guests play solo against bots. Online matches need an account.</p>
        </div>
      </div>
      <section class="faq">
        <h2>Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
      <footer class="landing-foot muted small">
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Engine: <a href="https://stockfishchess.org">Stockfish</a> (GPL-3.0)
      </footer>
    </div>
  );
}
