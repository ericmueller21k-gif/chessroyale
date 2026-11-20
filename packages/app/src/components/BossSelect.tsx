import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { BOSS_DIFFICULTY, hiddenBosses, menuBosses, type BossDef, type BossDifficultyId, type ItemLook } from "@chessroyale/core";
import { isAdmin } from "../boss-brain.ts";
import { DressedPawn } from "./FrontDoor.tsx";
import { rowSizes, SAY_AT, SAY_AT_DEFAULT, SELECT_SOUND, SELECT_TINT, selectLine, STAGE_RISE, TILE_GAP, TILE_RATIO, TILES_PER_ROW } from "../characters/boss-select.ts";
import { isPaused, useServerStatus } from "../status.ts";
import { playOnTap, warmSounds } from "../sound.ts";
import { NORMAL, Voice, VoiceBubble } from "../speech.tsx";
import { BossArt, BossPortrait } from "./BossPortrait.tsx";
import { game } from "../lazy-game.ts";
import { portraitName } from "../characters/portraits.ts";
import { useMedia } from "./QuickChat.tsx";

/**
 * The Boss raid screen's character select (Eric, Oct 16: "old school Street Fighter 2 style… slanted squares… the current
 * boss that's selected… shows their full sprite… standing there doing its idle animation"): a grid of slanted tiles, one
 * per boss you can meet (a resting one is left out, as the boss menu leaves it out), the Hidden Boss's dark and locked,
 * and "?" for a random boss; under them a stage, the 1 v 1 versus stage's platform (`dv-st-`), the picked boss on it in
 * its idle animation, and its name, with its difficulty named under it unless it's Normal. No number or skulls on the
 * stage (Eric, Oct 25; Boss alone's menu keeps its number).
 *
 * The tiles are a fighting game's select grid (Eric, Oct 21 to 23; the last look from Street Fighter 6's): tall slanted tiles,
 * all the same size, a small gap between them, six to a row on a phone and a computer alike (a short row centered), each
 * with the boss's whole figure framed from the neck up and cut off by the tile's corners, on a color from its own palette.
 * No names on the tiles. docs/decisions/2026-10-23-boss-select-sf.md.
 *
 * A tap drops the boss onto the stage (the 1 v 1 opponent's drop, `dv-st-drop`), plays its sound once (SELECT_SOUND,
 * through the mute switch) and says one of its lines in its speech bubble (SELECT_LINES, its own voice here). The Hidden
 * Boss stands there as a silhouette, unnamed. One sprite animates at a time (the stage's; the tiles are still
 * portraits), on the shared animation loop, so it rests while the app is hidden; under reduced motion it's a still and
 * nothing drops. docs/decisions/2026-10-16-boss-character-select.md.
 */

/** The picked boss on the stage, in his idle (BossStage.tsx, in the match's chunk); nothing until it's here (the spot keeps its size). */
const StageFigure = game.screen("BossStageFigure", null);
const hasPortrait = (name: string) => !!portraitName({ name });

/** The select's own voice (the battle's is `bossVoice`): one line at a time, each tap's replacing the last. */
const selectVoice = new Voice();
/** The last line said by each boss here (no line twice running; the Hidden Boss's two in turn). */
const lastLine = new Map<string, string>();

/**
 * What the select shows: the bosses you can meet (resting ones left out), then the hidden ones (dark, locked). An admin also
 * meets the bosses in the game for admins first (BOSS_ADMIN_FIRST: Timber, until Eric says go), each a tile like any other;
 * nobody else sees them.
 */
export function selectBosses(admin = isAdmin()): { bosses: BossDef[]; hidden: BossDef[] } {
  const on = (b: BossDef) => !isPaused(`boss:${b.id}`);
  return { bosses: menuBosses({ admin, raid: true }).filter(on), hidden: hiddenBosses().filter(on) };
}

/** The "?" tile's value, and the stage's when a random boss is picked. */
export const RANDOM = "";

/** A Boss Battle party's member on a back platform (docs/decisions/2026-10-30-boss-party.md). */
export interface PartySlot {
  id: string;
  name: string;
  look?: ItemLook;
  leader: boolean;
  ready: boolean;
  uid?: string;
  bot?: boolean;
}

/** The party on the stage: the two back platforms (a member, or nobody: an invite circle), your own check and crown. */
export interface StageParty {
  back: readonly [PartySlot | null, PartySlot | null];
  me: { leader: boolean; ready: boolean };
  /** A member's view: the leader picks the boss and the difficulty (the tiles muted, the arrows greyed). */
  locked: boolean;
  onProfile: (m: PartySlot) => void;
  /** The leader's: Kick from party, Promote to party leader. */
  onKick?: (m: PartySlot) => void;
  onPromote?: (m: PartySlot) => void;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
const CrownIcon = () => (
  <svg viewBox="0 0 24 18" aria-hidden="true" focusable="false">
    <path d="M2 15 1 4l6 5 5-8 5 8 6-5-1 11z" fill="#f2c14e" stroke="#1a1406" stroke-width="1.6" stroke-linejoin="round" />
  </svg>
);
/** Over a head: the leader's crown, a ready member's green check (Eric's picture). */
const HeadBadges = ({ leader, ready, me }: { leader: boolean; ready: boolean; me?: boolean }) => (
  <span class={`bs-head${me ? " bs-head-me" : ""}`} aria-hidden="true">
    {leader && (
      <span class="bs-crown">
        <CrownIcon />
      </span>
    )}
    {ready && (
      <span class="bs-check">
        <CheckIcon />
      </span>
    )}
  </span>
);

/** An invite circle: a crisp dashed ring, a very light fill and a person-plus, as in Eric's picture. */
const InviteCircle = () => (
  <span class="bs-inv" aria-hidden="true">
    <svg class="bs-inv-ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="19.2" />
    </svg>
    <svg class="bs-inv-icon" viewBox="0 0 28 22" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="9" cy="5.6" r="4.6" />
      <path d="M0 21.5c0-5.600 3.800-8.600 9-8.600s9 3 9 8.600z" />
      <path d="M22 4.200v8M18 8.200h8" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" fill="none" />
    </svg>
  </span>
);
const Arrow = ({ left }: { left?: boolean }) => (
  <svg viewBox="0 0 10 14" width="10" height="14" aria-hidden="true" focusable="false">
    <path d={left ? "M8 1.5 2 7l6 5.5z" : "M2 1.5 8 7l-6 5.5z"} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
  </svg>
);

export function BossSelect({
  value,
  difficulty,
  name,
  look,
  onPick,
  onDifficulty,
  onInvite,
  party,
}: {
  value: string;
  difficulty: BossDifficultyId;
  name: string;
  look?: ItemLook;
  onPick: (id: string) => void;
  onDifficulty: (id: BossDifficultyId) => void;
  /** An invite circle: your party (made the first time), to invite a friend into. */
  onInvite?: () => void;
  /** In a Boss Battle party: who stands behind you, the checks and crowns, and the member menu. */
  party?: StageParty;
}) {
  useServerStatus();
  // The member menu open (by member id): above their head; a tap elsewhere or Escape closes it.
  const [menu, setMenu] = useState<string | null>(null);
  const menuFor = party?.back.find((m) => m?.id === menu) ?? null;
  // (A layout effect: Escape closes it from its first frame; an effect waits for a paint, and an Escape meanwhile was lost.)
  useLayoutEffect(() => {
    if (!menuFor) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [!!menuFor]);
  const locked = !!party?.locked;
  const { bosses, hidden } = selectBosses();
  const still = useMedia("(prefers-reduced-motion: reduce)");
  // (The speech band rises over a boss on a window 740 px tall or more, guests only: the admins' fourth row takes that room.)
  const roomy = useMedia("(min-height: 740px)");
  // (A computer's two rows (styles.css, the rd-page container's content of 660 px or more: a window 1236 px wide and up) have no fourth
  // row: there everyone gets the band, and the admins' bosses stay clear of their bubbles at the bigger stage.)
  const twoRows = useMedia("(min-width: 1236px)");
  // Each tap (re)starts the drop and the idle under it.
  const [drop, setDrop] = useState({ n: 0, at: Date.now() });
  const hiddenIds = new Set(hidden.map((b) => b.id));
  const dark = hiddenIds.has(value);
  const def = [...bosses, ...hidden].find((b) => b.id === value) ?? null;
  // Their sounds made ahead (in the sound worker), so a tap never waits on one.
  useEffect(() => {
    warmSounds(Object.values(SELECT_SOUND));
    return () => selectVoice.reset();
  }, []);
  const tap = (id: string) => {
    // (A member's view: the leader picks the boss; the tiles don't take a tap.)
    if (locked) return;
    warmSounds(Object.values(SELECT_SOUND));
    onPick(id);
    setDrop((d) => ({ n: d.n + 1, at: Date.now() }));
    selectVoice.reset();
    const sound = SELECT_SOUND[id];
    if (sound) playOnTap(sound);
    const line = selectLine(id, lastLine.get(id) ?? null);
    if (line) {
      lastLine.set(id, line);
      selectVoice.say(line, `select:${id}:${Date.now()}`, NORMAL);
    }
  };
  const at = Math.max(0, BOSS_DIFFICULTY.findIndex((d) => d.id === difficulty));
  const step = (by: number) => {
    if (locked) return;
    const next = BOSS_DIFFICULTY[at + by];
    if (next) onDifficulty(next.id);
  };
  const rise = roomy && (twoRows || rowSizes(bosses.length + hidden.length + 1, TILES_PER_ROW).length <= 3);
  // The bubble's tail: moved along its bottom edge to the picked boss's mouth (SAY_AT), angled when the mouth is past its edge.
  // Only its custom properties change, so nothing moves; re-measured when the boss drops in, the line changes or the stage resizes.
  const sayStage = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const stage = sayStage.current;
    if (!stage) return;
    const place = () => {
      const say = stage.querySelector<HTMLElement>(".bs-say");
      const bub = stage.querySelector<HTMLElement>(".bs-say .bs-bubble");
      const spr = stage.querySelector<HTMLElement>(".bs-spot:not(.bs-mine) .bs-sprite");
      if (!say || !bub || !spr || !spr.getClientRects().length) return;
      const at = SAY_AT[value] ?? SAY_AT_DEFAULT;
      const r = spr.getBoundingClientRect();
      const mouthX = r.left + at.x * r.width;
      // (The bubble is pinned to the band's right edge, so the mouth's distance from that edge is all the tail needs.)
      const from0 = say.getBoundingClientRect().right - mouthX;
      const w = bub.offsetWidth;
      const pad = 20;
      // (A narrow bubble and a mouth past its left edge: the bubble nudges left, only as far as the tail needs, never past the stage's edge.)
      const nudge = Math.max(0, Math.min(from0 - (w - pad), say.clientWidth - w));
      const from = from0 - nudge;
      const inside = Math.min(Math.max(from, pad), Math.max(pad, w - pad));
      const over = from - inside;
      // (Past the edge: the tail stays at the edge and leans toward the mouth, up to 35 degrees.)
      const tilt = over ? Math.max(-35, Math.min(35, (Math.atan2(over, 40) * 180) / Math.PI)) : 0;
      say.style.setProperty("--say-nudge", `${nudge.toFixed(1)}px`);
      say.style.setProperty("--say-tail", `${inside}px`);
      say.style.setProperty("--say-tilt", `${tilt.toFixed(1)}deg`);
    };
    place();
    const obs = [new ResizeObserver(place), new MutationObserver(place)];
    obs[0]!.observe(stage);
    const bub = stage.querySelector(".bs-say .bs-bubble");
    if (bub) obs[0]!.observe(bub);
    obs[1]!.observe(stage, { childList: true, subtree: true });
    return () => obs.forEach((o) => o.disconnect());
  }, [value, drop.n]);
  const tile = (id: string, label: string, body: preact.ComponentChildren, cls = "", tint?: string) => (
    <button type="button" role="radio" key={id || "random"} aria-checked={value === id} aria-label={label} class={`bs-tile${cls}${value === id ? " on" : ""}`} data-boss={hiddenIds.has(id) ? "hidden" : id || "random"} onClick={() => tap(id)}>
      <span class={`bs-tile-in${tint ? " bs-tinted" : ""}`} style={tint ? { "--bs-tint": tint } : undefined}>
        {body}
      </span>
    </button>
  );
  const tiles = [
    ...bosses.map((b) => tile(b.id, b.name, <BossArt boss={b} />, "", SELECT_TINT[b.id])),
    ...hidden.map((b) => tile(b.id, "Locked boss", <BossArt boss={b} class="bs-shadow" />, " bs-locked")),
    tile(RANDOM, "Random boss", <span class="bs-q" aria-hidden="true">?</span>, " bs-random"),
  ];
  // (On a computer's wide middle column the same tiles go in two rows, `--bs-two` to a row, the first the longer: styles.css.)
  const two = Math.ceil(tiles.length / 2);
  const rows = rowSizes(tiles.length, TILES_PER_ROW).map((n) => tiles.splice(0, n));
  return (
    <div class="bs-select">
      {/* (Rows are layout only: the radios stay one group, in order.) */}
      <div class={`bs-tiles${locked ? " bs-theirs" : ""}`} role="radiogroup" aria-label="Bosses" aria-disabled={locked || undefined} style={{ "--bs-per": TILES_PER_ROW, "--bs-two": two, "--bs-gap": `${TILE_GAP}px`, "--bs-ratio": TILE_RATIO }}>
        {rows.map((row, i) => (
          <div class="bs-row" role="presentation" key={i}>
            {row}
          </div>
        ))}
      </div>
      <section ref={sayStage} class={`bs-stage${dark ? " bs-dark" : ""}`} aria-label="Your stage" style={{ "--bs-rise-cqi": rise ? STAGE_RISE : 0 }}>
        <div class="bs-say">
          <VoiceBubble voice={selectVoice} class="bc-bubble bs-bubble" />
        </div>
        <div class="bs-row-stage">
          <div class="bs-side">
            {/* Your pawn in front, two smaller platforms behind you: a party member on each, or an invite circle (Eric, Oct 29). */}
            <div class="bs-spot bs-mine">
              {(["l", "r"] as const).map((k, i) => {
                const m = party?.back[i] ?? null;
                return (
                  <span class={`bs-back bs-${k}${m && menu === m.id ? " bs-menu-on" : ""}`} key={k}>
                    {m ? (
                      <button type="button" class="bs-mate" aria-label={`${m.name}${m.leader ? ", party leader" : m.ready ? ", ready" : ""}`} aria-haspopup="menu" aria-expanded={menu === m.id} onClick={() => setMenu((x) => (x === m.id ? null : m.id))}>
                        <DressedPawn look={m.look} size="stage" />
                        <HeadBadges leader={m.leader} ready={m.ready} />
                      </button>
                    ) : (
                      <button type="button" class="bs-inv-btn" aria-label="Invite a friend" onClick={onInvite} disabled={!onInvite}>
                        <InviteCircle />
                      </button>
                    )}
                    <span class="dv-st-plat" aria-hidden="true" />
                  </span>
                );
              })}
              <span class="dv-st-plat" aria-hidden="true" />
              <span class="bs-me" aria-hidden="true">
                <DressedPawn look={look} size="stage" own />
                {party && <HeadBadges leader={party.me.leader} ready={party.me.ready} me />}
              </span>
              {menuFor && party && (
                <>
                  <div class="bs-menu-scrim" onClick={() => setMenu(null)} />
                  <div class={`bs-menu bs-menu-${party.back[0]?.id === menuFor.id ? "l" : "r"}`} role="menu" aria-label={menuFor.name}>
                    <div class="bs-menu-title">{menuFor.name}</div>
                    <button type="button" role="menuitem" disabled={!menuFor.uid} onClick={() => (setMenu(null), party.onProfile(menuFor))}>
                      View profile
                    </button>
                    {party.onPromote && (
                      <button type="button" role="menuitem" disabled={!!menuFor.bot} onClick={() => (setMenu(null), party.onPromote!(menuFor))}>
                        Promote to party leader
                      </button>
                    )}
                    {party.onKick && (
                      <button type="button" role="menuitem" class="bs-danger" onClick={() => (setMenu(null), party.onKick!(menuFor))}>
                        Kick from party
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <strong class="bs-you-name">{name}</strong>
          </div>
          <span class="bs-vs">VS</span>
          <div class="bs-side" aria-label="Your boss" role="group">
            <div class="bs-spot">
              <span class="dv-st-plat" aria-hidden="true" />
              {/* (Its own key each tap: the drop plays again, from the top.) */}
              <span class="dv-st-pawn bs-fig" key={drop.n}>
                {def && hasPortrait(def.name) ? (
                  // (His figure's code comes with the match's (BossStage.tsx), loaded as the raid screen opens: the spot keeps its size meanwhile.)
                  <StageFigure name={def.name} since={drop.at} still={still} rise={rise} />
                ) : (
                  <span class="bs-q bs-q-big" aria-hidden="true">
                    ?
                  </span>
                )}
              </span>
            </div>
            <strong class="bs-name" aria-live="polite">
              {dark ? "???" : (def?.name ?? "Random boss")}
            </strong>
            {/* The difficulty: arrows step through the five levels and stop at the ends (greyed there); the dots show where you are. */}
            <div class="bs-diff" role="group" aria-label="Difficulty">
              <button type="button" class="bs-arrow" aria-label="Easier" aria-disabled={locked || at === 0 || undefined} onClick={() => step(-1)}>
                <Arrow left />
              </button>
              <span class="bs-level" data-level={difficulty} aria-live="polite">
                {BOSS_DIFFICULTY[at]!.label}
              </span>
              <button type="button" class="bs-arrow" aria-label="Harder" aria-disabled={locked || at === BOSS_DIFFICULTY.length - 1 || undefined} onClick={() => step(1)}>
                <Arrow />
              </button>
            </div>
            <div class="bs-dots" aria-hidden="true">
              {BOSS_DIFFICULTY.map((d, i) => (
                <span class={`bs-dot${i === at ? " on" : ""}`} data-level={d.id} key={d.id} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Home's Boss raid card's portrait (Eric, Oct 16): a still of one boss you can meet, moving on to the next every
 * `FRONT_DOOR.bossCardMs` with a fade (`bossCardFadeMs`); never the Hidden Boss, never a resting one. The new one fades
 * in over the last, in the same box, so the card never changes size. It waits while the app is hidden (the timer starts
 * again when it's back), and under reduced motion the new one simply replaces the last.
 */
export function BossCardFace({ everyMs, fadeMs }: { everyMs: number; fadeMs: number }) {
  useServerStatus();
  const { bosses } = selectBosses();
  const [n, setN] = useState(0);
  const prev = useRef<{ n: number; at: number } | null>(null);
  useEffect(() => {
    let t = 0;
    const arm = () => {
      clearTimeout(t);
      if (document.visibilityState === "visible") t = window.setTimeout(next, everyMs);
    };
    const next = () => {
      setN((k) => {
        prev.current = { n: k, at: Date.now() };
        return k + 1;
      });
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [everyMs]);
  // (The last one, under the new one while it fades in; gone after.)
  const [, bump] = useState(0);
  const fading = prev.current && Date.now() - prev.current.at < fadeMs ? prev.current : null;
  useLayoutEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => bump((x) => x + 1), fadeMs);
    return () => clearTimeout(t);
  }, [fading?.at]);
  if (!bosses.length) return null;
  const at = (k: number) => bosses[k % bosses.length]!;
  const cur = at(n);
  return (
    <span class="rd-face-stack" data-boss={cur.id} style={{ "--rd-fade": `${fadeMs}ms` }}>
      {fading && at(fading.n).id !== cur.id && (
        <span class="rd-face-one" key={`${fading.n}`}>
          <BossPortrait boss={at(fading.n)} />
        </span>
      )}
      <span class={`rd-face-one${fading ? " rd-face-in" : ""}`} key={`${n}`}>
        <BossPortrait boss={cur} />
      </span>
    </span>
  );
}
