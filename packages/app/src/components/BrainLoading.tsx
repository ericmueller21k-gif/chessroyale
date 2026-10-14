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
  const d = maiaDownload();
  const fetching = d.state === "fetching";
  const p = downloadProgress(d.files);
  const share = fetching ? p.share : 1;
  return (
    <div class="boss-loading" role="status" aria-live="polite" data-stage={fetching ? "download" : "starting"}>
      <span class="boss-loading-icon" aria-hidden="true">
        <BossFace boss={boss} />
      </span>
      <strong class="boss-loading-title">Loading the boss…</strong>
      <span class={`boss-loading-bar${share === null ? " busy" : ""}`} role="progressbar" aria-label="Loading the boss" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share === null ? undefined : Math.round(share * 100)}>
        <i style={share === null ? undefined : { transform: `scaleX(${share})` }} />
      </span>
      <span class="boss-loading-note">{!fetching ? "Starting…" : p.total ? `${mb(p.loaded)} of ${mb(p.total)} MB` : "Downloading…"}</span>
      {fetching && <span class="boss-loading-first">First time only: about {BOSS_BRAIN.downloadMb} MB, then it's saved on this device.</span>}
      {match.exit === "leave" && match.exitHome && (
        <button type="button" class="btn btn-secondary boss-loading-leave" onClick={exitMatch}>
          Leave
        </button>
      )}
    </div>
  );
}
