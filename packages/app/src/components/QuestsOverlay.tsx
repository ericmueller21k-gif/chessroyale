import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { BossFace } from "./BossCharacter.tsx";
import { QUESTS, type QuestIcon, type QuestView } from "@chessroyale/core";
import { questSound, warmQuestSounds } from "../sound.ts";
import { KeyArt, WinterCrateArt } from "./Items.tsx";

/**
 * The daily quests overlay (design: notes/briefs/design-xp-quests.md, section 5; Eric's reference of Nov 9): a framed card over
 * home, the HunChess app icon in a crest, "Daily Quests", when the dailies renew, then one row per quest (its picture, name, goal,
 * progress bar and count, its reward drawn with the shop's art) and "Got it". Two daily rows and the weekly one under its own
 * label and countdown. Each daily has a small reroll button (each its own free one a day: greyed once used, or on a finished quest). The ×,
 * "Got it", Escape or a tap outside close it.
 *
 * Progress shown (Eric, Nov 10: "it does like a little like animation to like move it towards ... the goal"; QUESTS.show): given
 * `from` (each quest a game moved, with its old count), the moved rows start at their old counts and slide to their new ones one
 * after another, the count ticking up with the bar (questSound "tick"). One that finishes gets its finish: the bar fills and glows,
 * the row pops, the check pops in, "Done!", its reward bursts, and questSound "done". Only the row whose turn it is redraws, a frame
 * at a time (its fill's transform and its count's text, as the XP box's: nothing else moves). Reduced motion: the new counts at once.
 *
 * It draws what it's given and calls back (Nov 9, phase 3: home gives it the server's quests, quests.ts; the server deals, counts,
 * rerolls and pays them, server/quests.ts). Eric approved its look (the mockup of Nov 9).
 */

/** A quest's row (core's quests.ts: the server answers these). */
export type { QuestIcon, QuestView };

export interface QuestsOverlayProps {
  /** The dailies (two, or three with one carried over; in order), then the weekly. */
  quests: readonly QuestView[];
  /** Until the next daily quests ("12h"). */
  dailyResetIn: string;
  /** Until the weekly resets ("4d"). */
  weeklyResetIn: string;
  /** PAUSE_REWARDS is on: the head says quests are paused, in place of the countdown. */
  paused?: boolean;
  /** Each quest a game moved, with the count it had (home, after a game): those slide to their counts, one after another. */
  from?: Readonly<Record<string, number>> | null;
  onReroll: (id: string) => void;
  onClose: () => void;
}

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The slide's ease: quick, then settling on the new count. */
const ease = (t: number) => 1 - (1 - t) ** 3;

const count = (n: number) => n.toLocaleString("en-US");

/** A clock, drawn as the top bar's icons are. */
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** Reroll: two arrows round. */
const RerollIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 21v-5h-5" />
  </svg>
);

/** A scroll with a check: the Quests entry on home. */
export const QuestsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7 3h11a2 2 0 0 1 2 2v1h-4" />
    <path d="M16 6v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10" />
    <path d="M7 3a2 2 0 0 0-2 2v13" />
    <path d="M8.5 11.5l2 2 3.5-4" />
  </svg>
);

/**
 * The quests icon in a phone's top bar (Nov 9; an outline since Nov 10, like the gear): a clipboard with its check, in the text
 * color with no fill (the body's line stops at the clip, so nothing crosses it). QuestsIcon above stays the panels' icon.
 */
export const QuestsBarIcon = () => (
  <svg viewBox="0 0 24 24" width="29" height="29" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M8 4H6.5A2.5 2.5 0 0 0 4 6.5v13A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5v-13A2.5 2.5 0 0 0 17.5 4H16" />
    <rect x="8" y="2" width="8" height="4" rx="1.2" />
    <path d="M8.5 13.2l2.3 2.3 4.2-4.4" />
  </svg>
);

/** The quest's picture, in its tile. */
function QuestPicture({ icon }: { icon: QuestIcon }) {
  if (icon.kind === "boss") return <BossFace boss={{ name: icon.boss, icon: "" }} class="qo-boss" label="" />;
  if (icon.kind === "squad")
    return (
      <span class="hb-pieces qo-pieces qo-squad" aria-hidden="true">
        <piece class="white pawn" />
        <piece class="white pawn" />
        <piece class="white pawn" />
      </span>
    );
  return (
    <span class="hb-pieces qo-pieces qo-board" aria-hidden="true">
      <piece class={`white ${icon.piece}`} />
    </span>
  );
}

/** A reward: the XP in gold, then the crate and the key as the shop draws them. */
function Reward({ reward }: { reward: QuestView["reward"] }) {
  const parts = [`${count(reward.xp)} XP`];
  if (reward.crates) parts.push(`${reward.crates} ${reward.crates === 1 ? "crate" : "crates"}`);
  if (reward.keys) parts.push(`${reward.keys} ${reward.keys === 1 ? "key" : "keys"}`);
  return (
    <div class="qo-reward" aria-label={`Reward: ${parts.join(", ")}`}>
      <span class="qo-reward-tag" aria-hidden="true">
        Reward
      </span>
      <span class="qo-xp" aria-hidden="true">
        +{count(reward.xp)} XP
      </span>
      {(reward.crates || reward.keys) && (
        <span class="qo-things" aria-hidden="true">
          {!!reward.crates && (
            <span class="qo-thing">
              <WinterCrateArt />
              <small>{reward.crates === 1 ? "Crate" : `${reward.crates} Crates`}</small>
            </span>
          )}
          {!!reward.keys && (
            <span class="qo-thing">
              <KeyArt />
              <small>{reward.keys === 1 ? "Key" : `${reward.keys} Keys`}</small>
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * A quest's row. `from` (a moved quest, until its turn is over): the count it starts at; `go`: its turn, sliding to its count, then
 * `onShown` after its finish (or a short gap).
 */
function QuestRow({ q, onReroll, from, go = false, onShown }: { q: QuestView; onReroll: (id: string) => void; from?: number; go?: boolean; onShown?: () => void }) {
  const [finished, setFinished] = useState(false);
  const fill = useRef<HTMLSpanElement>(null);
  const counted = useRef<HTMLSpanElement>(null);
  // (The slide, from its first frame: a layout effect, so its sound plays as it starts (LESSONS.md). Each frame sets only the fill's
  // transform and the count's text, as the XP box's; the row draws again once, as it ends.)
  useLayoutEffect(() => {
    if (!go || from === undefined) return;
    const S = QUESTS.show;
    const to = Math.min(q.progress, q.target);
    const text = counted.current?.firstChild;
    let raf = 0;
    let wait = 0;
    let last = Math.round(from);
    let tickAt = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / S.slideMs);
      const v = from + (to - from) * ease(t);
      if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, v / q.target)})`;
      // (The count goes up as the bar passes halfway to it: it ticks with the bar, not at the slide's end.)
      const n = Math.round(v);
      if (n !== last && now - tickAt >= S.tickGapMs) {
        last = n;
        tickAt = now;
        if (text instanceof Text && n < q.target) text.data = `${count(n)}/${count(q.target)}`;
        questSound("tick");
      }
      if (t < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }
      const finishes = to >= q.target;
      if (finishes) {
        setFinished(true);
        questSound("done");
      }
      wait = window.setTimeout(() => onShown?.(), finishes ? S.finishMs : S.gapMs);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(wait);
    };
  }, [go]);
  // (What the row draws: its old count while it waits its turn and slides (each frame then sets the fill and the count), its own
  // once its turn is over, or as it finishes.)
  const at = from === undefined || finished ? q.progress : from;
  const done = at >= q.target;
  const share = Math.min(1, at / q.target);
  const canReroll = q.period === "daily" && q.canReroll && q.progress < q.target;
  return (
    <li class={`qo-row${q.period === "weekly" ? " weekly" : ""}${done ? " done" : ""}${finished ? " qo-finish" : ""}${from !== undefined ? " qo-moving" : ""}`} data-quest={q.id}>
      <span class="qo-pic">
        <QuestPicture icon={q.icon} />
        {done && (
          <span class="qo-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
      </span>
      <div class="qo-text">
        <div class="qo-name-line">
          <strong class="qo-name">{q.name}</strong>
          {/* (Dailies only; always there, greyed when it can't be used: this daily's reroll spent today, or the quest done. Nothing hidden.) */}
          {q.period === "daily" && (
            <button
              type="button"
              class="qo-reroll"
              disabled={!canReroll}
              aria-label={q.progress >= q.target ? "Reroll (quest done)" : canReroll ? `Reroll ${q.name} (1 free today)` : "Reroll (used today)"}
              title={q.progress >= q.target ? "Done" : canReroll ? "Swap this quest (1 free a day per quest)" : "This quest's free reroll is used today"}
              onClick={() => canReroll && onReroll(q.id)}
            >
              <RerollIcon />
            </button>
          )}
        </div>
        <span class="qo-goal">{q.goal}</span>
        <div class="qo-progress">
          <span class="qo-bar" role="progressbar" aria-label={`${q.name} progress`} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={Math.min(at, q.target)}>
            <span class="qo-fill" ref={fill} style={{ transform: `scaleX(${share})` }} />
          </span>
          <span class="qo-count" ref={counted}>
            {done ? "Done!" : `${count(at)}/${count(q.target)}`}
          </span>
        </div>
      </div>
      <Reward reward={q.reward} />
    </li>
  );
}

export function QuestsOverlay({ quests, dailyResetIn, weeklyResetIn, paused, from, onReroll, onClose }: QuestsOverlayProps) {
  const ok = useRef<HTMLButtonElement>(null);
  // (The moved quests in the overlay's order, decided once as it opens; reduced motion: none, the new counts at once.)
  const [moved] = useState(() => (from && !reduced() ? quests.filter((q) => from[q.id] !== undefined).map((q) => q.id) : []));
  // (Whose turn it is: -1 until `show.startMs` after it opens, then each moved quest's in order; past the end, all shown.)
  const [turn, setTurn] = useState(-1);
  useLayoutEffect(() => {
    if (from && reduced() && quests.some((q) => from[q.id] !== undefined && q.progress >= q.target)) questSound("done");
    if (!moved.length) return;
    warmQuestSounds();
    const t = setTimeout(() => setTurn(0), QUESTS.show.startMs);
    return () => clearTimeout(t);
  }, []);
  const rowProps = (q: QuestView) => {
    const i = moved.indexOf(q.id);
    if (i < 0 || i < turn) return {};
    return { from: from![q.id], go: i === turn, onShown: () => setTurn(i + 1) };
  };
  // (A layout effect, as the other notices': Escape closes it from its first frame, and "Got it" has the focus.)
  useLayoutEffect(() => {
    ok.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const dailies = quests.filter((q) => q.period === "daily");
  const weekly = quests.filter((q) => q.period === "weekly");
  return (
    <div class="qo-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="qo-card" role="dialog" aria-modal="true" aria-labelledby="qo-title">
        <span class="qo-crest" aria-hidden="true">
          <img class="qo-crest-img" src="/icons/icon.svg" alt="" />
        </span>
        <button type="button" class="qo-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <header class="qo-head">
          <h2 id="qo-title" class="qo-title">
            Daily Quests
          </h2>
          <span class="qo-when">
            <ClockIcon />
            {paused ? "Quests are paused for a moment." : `New quests in ${dailyResetIn}`}
          </span>
        </header>
        <ul class="qo-rows">
          {dailies.map((q) => (
            <QuestRow key={q.id} q={q} onReroll={onReroll} {...rowProps(q)} />
          ))}
        </ul>
        <div class="qo-label">
          <span>Weekly</span>
          <span class="qo-label-when">
            <ClockIcon />
            Resets in {weeklyResetIn}
          </span>
        </div>
        <ul class="qo-rows">
          {weekly.map((q) => (
            <QuestRow key={q.id} q={q} onReroll={onReroll} {...rowProps(q)} />
          ))}
        </ul>
        <button type="button" class="fd-btn primary qo-ok" ref={ok} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
