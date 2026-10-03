import { useEffect, useRef, useState } from "preact/hooks";
import { cutLabel, roundLive, type GameView } from "../game.ts";
import { RaceTower } from "./RaceTower.tsx";

const KEY = "brc.miniTower";
const pts = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(1);

/**
 * The phone's scoreboard under the board: small rows (position, name,
 * points) in a box that scrolls on its own, kept centred on you. Its header
 * minimises it to one line; the choice is remembered on the device.
 */
export function MiniTower({ match }: { match: GameView }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "0";
    } catch {
      return true;
    }
  });
  const body = useRef<HTMLDivElement>(null);
  const standings = match.standings();
  const alive = standings.filter((s) => !s.out);
  const rank = alive.findIndex((s) => s.isYou) + 1;
  const me = alive[rank - 1];

  // Keep your row in view (again once the rows have slid to their new places).
  useEffect(() => {
    const centre = () => {
      const box = body.current;
      const row = box?.querySelector<HTMLElement>(".tower-row.you");
      if (!box || !row) return;
      const y = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
      box.scrollTop = Math.max(0, y - box.clientHeight / 2 + row.clientHeight / 2);
    };
    centre();
    const t = setTimeout(centre, 800);
    return () => clearTimeout(t);
  }, [open, rank, alive.length]);

  const toggle = () => {
    setOpen(!open);
    try {
      localStorage.setItem(KEY, open ? "0" : "1");
    } catch {
      // Not important.
    }
  };

  return (
    <section class={`mini-tower${open ? "" : " closed"}`} aria-label="Leaderboard">
      <button type="button" class="mini-tower-head" onClick={toggle} aria-expanded={open}>
        <span>Leaderboard</span>
        {me && (
          <span class="muted">
            P{rank}/{alive.length} · {pts(me.points)}
          </span>
        )}
        <span class="mini-tower-toggle" aria-hidden="true">
          {open ? "▾" : "▴"}
        </span>
      </button>
      {open && (
        <div class="mini-tower-body" ref={body}>
          <RaceTower standings={standings} cutoff={match.cutoff} mini done={roundLive(match) ? match.done : undefined} cutLabel={cutLabel(match)} />
        </div>
      )}
    </section>
  );
}
