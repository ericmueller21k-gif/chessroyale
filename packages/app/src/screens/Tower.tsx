import { useEffect, useRef, useState } from "preact/hooks";
import { BATTLE_TOWER, floorBossCount, type ItemLook } from "@chessroyale/core";
import { BackButton, DressedPawn } from "../components/FrontDoor.tsx";
import { BossPortrait } from "../components/BossPortrait.tsx";
import { Confirm } from "../components/MatchMenu.tsx";
import { SwordsIcon } from "../town/CardIcons.tsx";
import { game } from "../lazy-game.ts";
import { portraitName } from "../characters/portraits.ts";
import { useMedia } from "../components/QuickChat.tsx";
import { TOWER_WORDS, askFloor, floorRating, livesOf, towerBoss, enterTowerFloor, loadKept, settle, towerApi, type FloorStart, type TowerState } from "../tower.ts";
import "../tower.css";

/**
 * KEPT UNUSED (Eric, Nov 19, PR 11b: "keep whatever you already did for that screen for now ... maybe we can find some use for it later.
 * But yeah, that's not [the way] it's going."): nothing opens it, no route renders it; the tower is the town's (town/Town.tsx).
 *
 * The Battle Tower's screen (route /tower; PR 10, the approved mockup 7 and 8 on stills/battle-tower): opened only by Chess Town's
 * skyscraper clerk (Eric, Nov 19: never from home or a menu), Back goes to the town. Built on Boss Battle's screen: your run's card
 * (its floor, the bosses beaten, the floor's bosses and rating), your bests, Solo | Party (Party greyed: coming soon), the stage (you
 * VS the floor's bosses), CONTINUE FLOOR n or START A RUN, and "Start a new run" (a confirm; greyed with no run). A floor kept on this
 * device (a reload mid-floor) is rejoined at once; a result kept here is sent first.
 */

/** A boss on the stage (BossStage.tsx, in the match's chunk); nothing until it's here (the spot keeps its size). */
const StageFigure = game.screen("BossStageFigure", null);

/** Portraits of the bosses beaten (TowerBar.tsx's, where the strip uses them since PR 11b). */
export { Beaten } from "./TowerBar.tsx";
import { Beaten } from "./TowerBar.tsx";

/** The skyscraper on the run's card (the art runner draws the real one): a plain tower of windows. */
const Skyscraper = () => (
  <svg class="tw-sky" viewBox="0 0 60 96" aria-hidden="true" focusable="false">
    <rect x="16" y="6" width="28" height="88" rx="2" />
    <rect x="27" y="0" width="6" height="8" />
    {Array.from({ length: 10 }, (_, r) => [0, 1, 2].map((c) => <rect class="tw-win" key={`${r}-${c}`} x={20 + c * 8} y={12 + r * 8} width="4" height="4" />))}
  </svg>
);

type Ask = { kind: "replace"; floor: number } | { kind: "elsewhere"; start: FloorStart } | { kind: "resting"; start: FloorStart } | { kind: "broken" };

export function TowerScreen({ name, look, onBack }: { name: string; look?: ItemLook; onBack: () => void }) {
  const [state, setState] = useState<TowerState | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const wide = useMedia("(min-width: 900px)");
  const since = useRef(Date.now());
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  /** The run as the server has it (a result kept here sent first); a floor kept here under way: rejoined at once. */
  const load = async (rejoin: boolean) => {
    setBusy(true);
    const kept = loadKept();
    if (kept?.done) {
      const end = await settle(kept);
      if (end.error && alive.current) setNote(end.error);
    }
    const s = await towerApi.state();
    if (!alive.current) return;
    if (!s.ok) {
      setNote(s.body.message ?? TOWER_WORDS.offline);
      return setBusy(false);
    }
    setState(s.body);
    const run = s.body.runs.solo;
    const mine = loadKept();
    if (rejoin && run?.fight && mine && !mine.done && mine.fight === run.fight.id) return void play(s.body);
    setBusy(false);
  };
  useEffect(() => void load(true), []);

  /** The floor started (or rejoined), and into it; or the question its answer raises. */
  const play = async (now: TowerState | null = state) => {
    setBusy(true);
    setNote(null);
    const a = await askFloor(now?.best.solo ?? 0);
    if (!alive.current) return;
    if (a.kind === "entry") return enterTowerFloor(a.entry);
    setBusy(false);
    if (a.kind === "error") return setNote(a.message);
    setAsk(a);
  };

  const newRun = async (confirm: boolean) => {
    setBusy(true);
    setNote(null);
    const a = await towerApi.newRun(confirm);
    if (!alive.current) return;
    if (!a.ok) {
      setBusy(false);
      if (a.status === 409 && a.body.run) return setAsk({ kind: "replace", floor: a.body.run.floor });
      return setNote(a.body.message ?? TOWER_WORDS.offline);
    }
    await play();
  };

  /** Leave the floor under way: free (its bosses rest), or counted (under way elsewhere, nothing kept here). */
  const leave = async (start: FloorStart, free: boolean) => {
    setAsk(null);
    setBusy(true);
    const a = await towerApi.stop(start.fight.id, free ? 0 : undefined, free);
    if (!alive.current) return;
    if (!a.ok && a.body.message) setNote(a.body.message);
    await load(false);
  };

  const run = state?.runs.solo ?? null;
  const floor = run?.floor ?? 1;
  const bosses = run?.bosses ?? [];
  const beaten = (run?.beaten ?? []).flat();
  const rating = floorRating(floor, bosses.length || floorBossCount(floor));
  const best = state?.best ?? { solo: 0, party: 0 };
  return (
    <div class="fd-page rd-page tw-page">
      <header class="fd-page-head">
        <BackButton onClick={onBack} />
        <h1>Battle Tower</h1>
        <span class="fd-head-spacer" />
      </header>
      <section class={`tw-card${run ? " tw-saved" : ""}`} aria-label="Your run">
        <span class="tw-art">
          <Skyscraper />
        </span>
        <span class="tw-info">
          <span class="tw-label">{run ? "Your solo run · saved" : "Your solo run"}</span>
          {run ? (
            <span class="tw-floor">
              Floor {floor} <small>of {BATTLE_TOWER.floors}</small>
            </span>
          ) : (
            <span class="tw-floor">No run yet</span>
          )}
          <span class="tw-line">
            Beaten {beaten.length ? <Beaten ids={beaten} max={wide ? 9 : 6} /> : <b>none yet</b>}
          </span>
          <span class="tw-line">
            Floor {floor}: <b>{bosses.length || floorBossCount(floor)} {(bosses.length || floorBossCount(floor)) === 1 ? "boss" : "bosses"}</b> · rating <b>{rating}</b>
          </span>
        </span>
      </section>
      <div class="tw-bests">
        <span class="tw-best">
          <small>Best solo</small>
          <b>{best.solo ? `Floor ${best.solo}` : "None yet"}</b>
        </span>
        <span class="tw-best">
          <small>Best party</small>
          <b>{best.party ? `Floor ${best.party}` : "None yet"}</b>
        </span>
      </div>
      <div class="tw-switch" role="radiogroup" aria-label="Solo or party">
        <button type="button" role="radio" aria-checked="true" class="on">
          Solo <small>· floor {floor}</small>
        </button>
        <button type="button" role="radio" aria-checked="false" disabled>
          Party <small>· coming soon</small>
        </button>
      </div>
      <section class="bs-stage tw-stage" aria-label="This floor">
        <div class="bs-row-stage">
          <div class="bs-side">
            <div class="bs-spot bs-mine">
              {(["l", "r"] as const).map((k) => (
                <span class={`bs-back bs-${k}`} key={k}>
                  <button type="button" class="bs-inv-btn" aria-label="Invite a friend (party runs are coming soon)" disabled>
                    <span class="bs-inv" aria-hidden="true">
                      <svg class="bs-inv-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                        <circle cx="20" cy="20" r="19.2" />
                      </svg>
                    </span>
                  </button>
                  <span class="dv-st-plat" aria-hidden="true" />
                </span>
              ))}
              <span class="dv-st-plat" aria-hidden="true" />
              <span class="bs-me" aria-hidden="true">
                <DressedPawn look={look} size="stage" own />
              </span>
            </div>
            <strong class="bs-you-name">{name}</strong>
          </div>
          <span class="bs-vs">VS</span>
          <div class="bs-side" role="group" aria-label="This floor's bosses">
            <div class={`tw-spots tw-n${Math.max(1, bosses.length)}`}>
              {(bosses.length ? bosses : [""]).map((id, i) => {
                const b = id ? towerBoss(id) : null;
                return (
                  <div class="bs-spot tw-spot" key={`${i}-${id}`}>
                    <span class="dv-st-plat" aria-hidden="true" />
                    <span class="dv-st-pawn bs-fig">
                      {b?.known && portraitName(b) ? (
                        <StageFigure name={b.name} since={since.current} still={still} rise={false} />
                      ) : (
                        <span class="bs-q bs-q-big" aria-hidden="true">
                          ?
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <strong class="bs-name tw-names" aria-live="polite">
              {bosses.length ? bosses.map((id) => towerBoss(id).name).join(" · ") : "Floor 1"}
            </strong>
            <span class="tw-rating">
              Floor {floor} · {rating}
            </span>
          </div>
        </div>
      </section>
      <div class="rd-options tw-options">
        <button type="button" class="bs-start tw-start" disabled={busy} onClick={() => void (run ? play() : newRun(false))}>
          <SwordsIcon />
          {run ? `CONTINUE FLOOR ${floor}` : "START A RUN"}
        </button>
        <button type="button" class="tw-new" disabled={busy || !run} onClick={() => run && setAsk({ kind: "replace", floor })}>
          Start a new run
        </button>
        <p class="bs-line tw-note" role="status">
          {note ?? (busy && !state ? "Reading your run…" : "Party runs are coming soon: a party of up to 4 will climb its own run.")}
        </p>
      </div>
      {ask && (
        <div class="mm-scrim" onClick={() => setAsk(null)}>
          {ask.kind === "replace" ? (
            <Confirm heading="Start a new run?" note={TOWER_WORDS.replace(ask.floor)} go="New run" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), void newRun(true))} />
          ) : ask.kind === "elsewhere" ? (
            <Confirm heading="Floor under way" note={TOWER_WORDS.elsewhere(livesOf(ask.start.run.lives))} go="Leave it" onCancel={() => setAsk(null)} onGo={() => void leave(ask.start, false)} />
          ) : ask.kind === "resting" ? (
            <Confirm heading="Bosses resting" note={TOWER_WORDS.resting} go="Leave (free)" onCancel={() => setAsk(null)} onGo={() => void leave(ask.start, true)} />
          ) : (
            <Confirm heading="Run can't be played" note={TOWER_WORDS.broken} go="New run" onCancel={() => setAsk(null)} onGo={() => (setAsk(null), void newRun(true))} />
          )}
        </div>
      )}
    </div>
  );
}
