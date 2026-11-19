import { useEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { Confirm } from "../components/MatchMenu.tsx";
import { TOWER_WORDS, loadKept, settle, towerApi, type TowerState } from "../tower.ts";
import "../tower.css";

/**
 * The Battle Tower's clerk's card (PR 11b, Eric, Nov 19: "you walk into the battle tower, you talk to the clerk, you start a match"): the
 * only way into the climb. No run (or the last one ended): Start. A saved run: "Continue: floor N", and a small "Start over" under it
 * that asks first ("Start over from floor 1?"); greyed with no run to start over (nothing hidden, the card keeps its size). Nothing
 * else: your bests are on the lobby's "Best floors" board (`onBest`). A result kept on this device is sent first. `onGo`: the run's
 * floor is ready, you walk into the elevator (Town.tsx).
 */
export function TowerDesk({ onGo, onBest }: { onGo: () => void; onBest: (best: number) => void }) {
  const [st, setSt] = useState<TowerState | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ floor: number } | null>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  const load = async () => {
    setBusy(true);
    const kept = loadKept();
    if (kept?.done) {
      const end = await settle(kept);
      if (end.error && alive.current) setNote(end.error);
    }
    const s = await towerApi.state();
    if (!alive.current) return;
    setBusy(false);
    if (!s.ok) return setNote(s.body.message ?? TOWER_WORDS.offline);
    setSt(s.body);
    onBest(s.body.best.solo);
  };
  useEffect(() => void load(), []);
  /** A new run (`confirm`: in place of the saved one), then up the elevator. */
  const start = async (confirm: boolean) => {
    setBusy(true);
    setNote(null);
    const a = await towerApi.newRun(confirm);
    if (!alive.current) return;
    setBusy(false);
    if (a.ok) return onGo();
    if (a.status === 409 && a.body.run) return setAsk({ floor: a.body.run.floor });
    setNote(a.body.message ?? TOWER_WORDS.offline);
  };
  const run = st?.runs.solo ?? null;
  return (
    <>
      {run ? (
        <button type="button" class="town-btn primary" disabled={busy} onClick={onGo}>
          Continue: floor {run.floor}
        </button>
      ) : (
        <button type="button" class="town-btn primary" disabled={busy || !st} onClick={() => void start(false)}>
          Start
        </button>
      )}
      <button type="button" class="town-btn tw-over" disabled={busy || !run} onClick={() => run && setAsk({ floor: run.floor })}>
        Start over
      </button>
      <p class="town-card-text tw-desk-note" role="status">
        {note ?? (st ? (run ? "Your run is saved." : "A climb of 99 floors. One loss ends it.") : "Reading your climb…")}
      </p>
      {/* (Over the whole page, not inside the card: the card is placed by a transform.) */}
      {ask &&
        createPortal(
          <div class="mm-scrim" onClick={() => setAsk(null)}>
            <Confirm heading="Start over from floor 1?" note={TOWER_WORDS.replace(ask.floor)} go="Start over" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), void start(true))} />
          </div>,
          document.body,
        )}
    </>
  );
}
