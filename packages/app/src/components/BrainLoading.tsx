import type { ComponentChildren } from "preact";
import { BOSS_BRAIN } from "@chessroyale/core";
import type { BossView, GameView } from "../game.ts";
import { downloadProgress, maiaDownload } from "../maia.ts";
import { exitMatch } from "../match-exit.ts";
import { BossFace } from "./BossCharacter.tsx";

/** Megabytes as the bar says them (the download's own unit: 1,000,000 bytes). */
const mb = (bytes: number) => Math.round(bytes / 1e6);

/**
 * Solo, the loading step before a boss battle on Maia (DECISIONS.md, "Maia's loading step", Oct 14), over the board:
 * "Loading the boss…", the download's bar (its bytes of the three files', or a bar that only says it's busy when their
 * sizes aren't known), then "Starting…" while Maia starts (at once when its files are saved on this device). Plain: no
 * entrance and nothing moving but the bar. Leave goes home (before move 1; the Crowd's battle has its Resign above).
 * Read as the screen draws, every frame.
 */
export function BrainLoading({ match, boss }: { match: GameView; boss: BossView }) {
  return <BrainLoadingCard icon={<BossFace boss={boss} />} title="Loading the boss…" onLeave={match.exit === "leave" && match.exitHome ? exitMatch : null} />;
}

/**
 * The loading step's card, for a boss (above) or a town bot (its game: screens/Duel.tsx, "Loading the bot…"): its icon,
 * its title, the bar and its note, and Leave (`onLeave`; null: none).
 */
export function BrainLoadingCard({ icon, title, onLeave }: { icon: ComponentChildren; title: string; onLeave: (() => void) | null }) {
  const d = maiaDownload();
  const fetching = d.state === "fetching";
  // (A moment looking for the files on this device first: saved, it's straight to "Starting…", with no word of a
  // download.)
  const checking = d.state === "checking";
  const p = downloadProgress(d.files);
  const share = checking ? null : fetching ? p.share : 1;
  return (
    <div class="boss-loading" role="status" aria-live="polite" data-stage={checking ? "checking" : fetching ? "download" : "starting"}>
      <span class="boss-loading-icon" aria-hidden="true">
        {icon}
      </span>
      <strong class="boss-loading-title">{title}</strong>
      <span class={`boss-loading-bar${share === null ? " busy" : ""}`} role="progressbar" aria-label={title.replace("…", "")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share === null ? undefined : Math.round(share * 100)}>
        <i style={share === null ? undefined : { transform: `scaleX(${share})` }} />
      </span>
      <span class="boss-loading-note">{checking ? "\u00a0" : !fetching ? "Starting…" : p.total ? `${mb(p.loaded)} of ${mb(p.total)} MB` : "Downloading…"}</span>
      {fetching && <span class="boss-loading-first">First time only: about {BOSS_BRAIN.downloadMb} MB, then it's saved on this device.</span>}
      {onLeave && (
        <button type="button" class="btn btn-secondary boss-loading-leave" onClick={onLeave}>
          Leave
        </button>
      )}
    </div>
  );
}
