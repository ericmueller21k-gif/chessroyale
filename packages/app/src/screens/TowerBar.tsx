import { useEffect, useMemo, useState } from "preact/hooks";
import { artOf, bossKit, liveKit } from "../characters/kits.ts";
import type { Stage } from "../characters/boss-beats.ts";
import { SpriteAnim, frameImage } from "../components/BossEffect.tsx";
import type { Character } from "../characters/sprite.ts";
import { BossBarExtra, RageMeter } from "../components/BossPowers.tsx";
import { BossFace, BossSide, bossStage } from "../components/BossCharacter.tsx";
import { useMedia } from "../components/QuickChat.tsx";
import { MOUSE_LAYOUT } from "../components/MatchMenu.tsx";
import { VoiceBubble, bossVoice } from "../speech.tsx";
import { BossLevel, BossNext } from "./Boss.tsx";
import { BossPortrait } from "../components/BossPortrait.tsx";
import { portraitName } from "../characters/portraits.ts";
import { livesOf, towerBoss } from "../tower.ts";
import { TowerHearts } from "../components/TowerHearts.tsx";
import type { BossView, GameView } from "../game.ts";
import { sideOf } from "../boss-side.ts";
import "../tower.css";

/**
 * A Battle Tower floor's battle (PR 10, the approved mockups 1 to 6 on stills/battle-tower): the run's strip in place of the title
 * line, the boss bar split in equal parts for 2 or 3 bosses (each figure whole, one scale for all; the boss to move outlined with a TO
 * MOVE tag, the others drawn as he is: never dimmed, never hidden: Eric, Nov 21), and on a computer the figures stacked beside the board in turn order, the one to move
 * stepped forward. One boss: today's bar and figure. Every part keeps its size and place for the whole floor.
 */

// (Each boss on a floor of several, from his own part of the view: boss-side.ts.)
export { moverOf, sideOf } from "../boss-side.ts";

/** Portraits of the bosses beaten, the last `max` (the rest counted: "+3"), never cut off. (Moved here from the tower's screen, PR 11b.) */
export function Beaten({ ids, max }: { ids: readonly string[]; max: number }) {
  const shown = ids.slice(-max);
  const more = ids.length - shown.length;
  return (
    <span class="tw-beaten">
      {more > 0 && <span class="tw-more">+{more}</span>}
      {shown.map((id, i) => {
        const b = towerBoss(id);
        return (
          <span class="tw-face" key={`${i}-${id}`} title={b.name}>
            {b.known && portraitName(b) ? <BossPortrait boss={b} /> : <span class="tw-unknown" aria-label={b.name}>?</span>}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Who says the line keyed `key` on a floor of several: the boss whose id starts it (a moment's line is keyed by the boss who cast it,
 * BossPowers.tsx useMomentSpeech), else the boss to move. His bubble shows it, by his own part of the bar (audit 2, finding 1).
 */
export function speakerOf(side: { bosses: readonly { id?: string }[]; toMove: number }, key: string): number {
  const i = side.bosses.findIndex((b) => !!b.id && key.startsWith(`${b.id}:`));
  return i < 0 ? side.toMove : i;
}

/**
 * The run's strip (Eric, Nov 20; Nov 21: the hearts moved out of it): "Battle Tower · Floor 4", centered. No floor count (nobody is to know
 * how many floors there are), no next floor and no moves left (the boss card says those). The beaten bosses stay on the tower's own card.
 */
export function TowerStrip({ match }: { match: GameView }) {
  // (A solo floor's run, or a party floor's: Nov 20.)
  const play = match.tower ?? match.towerParty;
  if (!play) return null;
  return (
    <span class="tw-strip" data-tower-floor={play.floor}>
      <span class="tw-strip-top">
        Battle Tower<span> · Floor {play.floor}</span>
      </span>
    </span>
  );
}

/** The run's lives (Eric, Nov 21: two pixel hearts, a spent one hollow, no word): the strip's right end on a phone (TowerStripLives). */
export function TowerStripLives({ match }: { match: GameView }) {
  const play = match.tower ?? match.towerParty;
  if (!play) return null;
  return <TowerHearts lives={livesOf(play.lives)} class="tw-match-lives tw-strip-lives" />;
}

/**
 * The run's lives on a computer (Eric, Nov 21: "right along the H file ... H1"): just outside the board's right edge, level with its bottom
 * rank, drawn over the board's wrap (children of its Board; tower.css `.tw-board-lives`). Nothing on a phone (its strip has them).
 */
export function TowerBoardLives({ match }: { match: GameView }) {
  const mouse = useMedia(MOUSE_LAYOUT);
  const play = match.tower ?? match.towerParty;
  if (!play || !mouse) return null;
  return <TowerHearts lives={livesOf(play.lives)} class="tw-match-lives tw-board-lives" />;
}

/**
 * A figure's drawn part (sprite px): the union of every frame of the animations it plays in its box (its idle: a bob, a wing's flap),
 * so no frame is ever cut off by the box (Eric, Nov 21: Folio's wing tips "getting cut off a bit at the top ... these boxes weren't built
 * properly to factor in for the slight movements"). Its canvas has room around it for his moves and props, left out. Worked out once a
 * boss and cached: the box keeps one size for the whole battle.
 */
const drawn = new Map<string, { top: number; bottom: number; left: number; right: number }>();
export function drawnBox(name: string, art: Character, anims: string | readonly string[]): { top: number; bottom: number; left: number; right: number } {
  const list = typeof anims === "string" ? [anims] : anims;
  const key = `${name}|${list.join(",")}`;
  let b = drawn.get(key);
  if (b) return b;
  b = { top: 0, bottom: art.h, left: 0, right: art.w };
  if (typeof ImageData !== "undefined") {
    let top = art.h, bottom = -1, left = art.w, right = -1;
    for (const a of list)
      for (const frame of art.anims[a]?.frames ?? []) {
        const d = frameImage(art, frame).data;
        for (let y = 0; y < art.h; y++)
          for (let x = 0; x < art.w; x++)
            if (d[(y * art.w + x) * 4 + 3]) {
              if (y < top) top = y;
              if (y > bottom) bottom = y;
              if (x < left) left = x;
              if (x > right) right = x;
            }
      }
    if (bottom >= 0) b = { top, bottom: bottom + 1, left, right: right + 1 };
  }
  drawn.set(key, b);
  return b;
}

/** One scale for every figure: the largest at which each one's drawn part fits its box (`w` × `h` px) whole. */
function sharedScale(names: readonly string[], w: number, h: number): number {
  let s = 3;
  for (const n of names) {
    const kit = bossKit(n);
    if (!kit) continue;
    const b = drawnBox(n, artOf(kit), kit.anims.idle ?? "idle");
    s = Math.min(s, w / (b.right - b.left), h / (b.bottom - b.top));
  }
  return Math.max(0.25, s);
}

/**
 * A boss's figure in his idle, at `scale` screen px a sprite px, cut to his drawn part (his canvas's room around him left out); a still
 * portrait for a boss with no figure (or an id this app doesn't know). Drawn from his own part's state as the lone bar's figure is
 * (BossCharacter): the idle of his kit as it is now (`liveKit`, read as each frame is drawn: Moo & Moon's powered idle, gold and glowing,
 * from his Full Moon's `swap` to his daze's `calm`, Eric, Nov 22) and his recolor (`lookOf`). The box is his plain idle's, one size all battle.
 */
function Figure({ boss, stage, scale, since, still }: { boss: BossView; stage: Stage; scale: number; since: number; still: boolean }) {
  const kit = bossKit(boss.name);
  if (!kit) return <BossFace boss={boss} class="tw-part-portrait" label="" live />;
  const art = artOf(kit);
  const idle = kit.anims.idle ?? "idle";
  const b = drawnBox(boss.name, art, idle);
  // (His idle loop in the kit as it draws at `now`: a powered or staged twin where he has one, on his own art (a phone bar's own drawing).)
  const live = (now: number) => {
    const k = liveKit(kit, boss, now, stage);
    const a = k === kit ? idle : (k.loops?.idle ?? k.anims.idle ?? idle);
    return art.anims[a] ? a : idle;
  };
  return (
    <span class="tw-fig-box" style={{ width: `${(b.right - b.left) * scale}px`, height: `${(b.bottom - b.top) * scale}px` }}>
      <SpriteAnim ch={art} anim={live(Date.now())} pick={still ? undefined : live} look={kit.lookOf?.(boss)} since={since} still={still} class="tw-fig" style={{ width: `${art.w * scale}px`, height: `${art.h * scale}px`, left: `${-b.left * scale}px`, top: `${-b.top * scale}px` }} />
    </span>
  );
}

/** A phone card's figure box (px, tower.css .tw-card-face): the card's 89 px less its padding, about the lone bar's 58 wide. */
const CARD_FIGURE_W = 60;
const CARD_FIGURE_H = 78;
/** The share of the bar's width the open part takes (Eric, Nov 21: "maybe it's like 75% for the one that's active"); the folded share the rest. */
export const OPEN_SHARE = 0.75;

/**
 * The split bar as an accordion (Eric, Nov 21): one part a boss, in turn order (left to right). The open part, the boss to move unless
 * another was tapped open, takes OPEN_SHARE of the bar's width; the folded ones share the rest. Each part is a window (overflow hidden)
 * onto his card, a lone boss bar laid out once at the open part's width: folded, the window shows the card's left side (his figure,
 * maybe cut off); opening it reveals more of the same card, never a relayout. The windows slide on a turn change (tower.css, 300 ms;
 * instant with reduced motion). A tapped part stays open until the turn changes or it's tapped again. The bar's height never changes.
 * A folded boss's words are drawn over the bar beside his window (tw-say), never cut by it. Eric's named exception to "nothing shifts"
 * (docs/rules/eric.md): this bar's parts slide; the bar and everything around it keep their size and place.
 */
export function TowerBar({ boss, match, caster = null }: { boss: BossView; match: GameView; caster?: string | null }) {
  const side = sideOf(boss)!;
  const computer = useMedia("(min-width: 900px) and (pointer: fine)");
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const [since] = useState(() => Date.now());
  const n = side.bosses.length;
  const scale = useMemo(() => sharedScale(side.bosses.map((b) => b.name), CARD_FIGURE_W, CARD_FIGURE_H), [side.bosses.map((b) => b.name).join(",")]);
  const until = match.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0;
  // (A tapped-open part, until the turn changes: the boss to move's again.)
  const [tapped, setTapped] = useState<{ i: number; toMove: number } | null>(null);
  // (Forgotten on every turn change, so a full round of turns back to the same boss doesn't bring it back (quick review, Nov 21);
  // the toMove check below covers the render before this runs. A floor of a different size forgets it too.)
  useEffect(() => setTapped(null), [side.toMove, n]);
  const open = tapped && tapped.toMove === side.toMove && tapped.i < n ? tapped.i : side.toMove;
  // (A folded part tapped opens; the open one tapped again, or the boss to move, folds it back to the boss to move.)
  const tap = (i: number, back: boolean) => setTapped(back ? null : { i, toMove: side.toMove });
  // (A folded part's flex-grow 1, the open one's 3(n - 1): it takes OPEN_SHARE of the room the gaps and outlines leave.)
  const grow = (OPEN_SHARE / (1 - OPEN_SHARE)) * (n - 1);
  return (
    <div class={`boss-bar tw-bar tw-bar-${n}`} style={{ "--tw-n": n, "--tw-open": OPEN_SHARE }} role="status" aria-label={`${side.bosses.map((b) => b.name).join(", ")}; ${side.bosses[side.toMove]?.name ?? ""} to move`}>
      {side.bosses.map((b, i) => {
        const on = i === side.toMove;
        const isOpen = i === open;
        return (
          <span
            class={`tw-part${on ? " tw-to-move" : ""}${isOpen ? " tw-part-open" : ""}${b.id === caster ? " tw-casting" : ""}`}
            key={`${i}-${b.id}`}
            data-boss={b.id}
            style={{ flexGrow: isOpen ? grow : 1 }}
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-label={`${b.name}${on ? ", to move" : ""}`}
            onClick={() => tap(i, isOpen || on)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              tap(i, isOpen || on);
            }}
          >
            {on && <span class="tw-tag">TO MOVE</span>}
            {/* (A folded boss's words, a phone's (Eric, Nov 21): over the bar beside his window, never inside it (the window would cut
                them), toward the open part; his part doesn't open for the line. The room is a card wide, so the bubble fits as a lone bar's.) */}
            {!computer && !isOpen && (
              <span class={`tw-say ${i < open ? "tw-say-right" : "tw-say-left"}`}>
                <VoiceBubble voice={bossVoice} class="bc-bubble bc-bar-bubble" balanced mine={(k) => speakerOf(side, k) === i} />
              </span>
            )}
            <span class="tw-window">
              {/* (His card: the lone bar's own markup and styles (Boss.tsx BossBar), at the open part's width, always.) */}
              <span class="boss-bar has-char tw-bcard" aria-hidden={!isOpen}>
                {computer ? (
                  <span class="boss-icon" aria-hidden="true">
                    <BossFace boss={b} live />
                  </span>
                ) : (
                  <span class="tw-card-face" aria-hidden="true">
                    <Figure boss={b} stage={bossStage(match.phase, b)} scale={scale} since={since} still={still} />
                  </span>
                )}
                <span class="boss-main">
                  <span class="boss-name">
                    <strong>{b.name}</strong>
                    <BossLevel boss={b} />
                    <span class="boss-ult">
                      <RageMeter boss={b} />
                      <BossBarExtra boss={b} until={until} part="ult" />
                    </span>
                    <span class="boss-passive">
                      <BossBarExtra boss={b} until={until} />
                    </span>
                  </span>
                  <BossNext boss={b} match={match} />
                  {/* (His prop where a lone bar has it. A computer's Babur pump stands beside his figure by the board: TowerSide; one pump on the page.) */}
                  <span class="boss-prop">
                    <BossBarExtra boss={b} until={until} part={computer ? "cardProp" : "prop"} />
                  </span>
                  {/* (His words, a phone's, where a lone bar has them while his part is open: the boss who says them, the one who cast a
                      moment, else the boss to move. Folded, they're drawn beside his window: tw-say, above.) */}
                  {!computer && isOpen && <VoiceBubble voice={bossVoice} class="bc-bubble bc-bar-bubble" balanced mine={(k) => speakerOf(side, k) === i} />}
                </span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * A computer's figures beside the board on a floor of several: stacked top to bottom in turn order (the bar's, left to right), one
 * scale for all, each one's feet at the foot of his third of the board's height; the boss to move stepped toward the board, none dimmed (Eric, Nov 21).
 */
export function TowerSide({ boss, match, caster = null }: { boss: BossView; match: GameView; caster?: string | null }) {
  const side = sideOf(boss)!;
  const computer = useMedia("(min-width: 900px) and (pointer: fine)");
  const until = match.phase.kind === "boss" && !match.phase.lights && !match.phase.thinking && !match.phase.intro ? match.phase.until : 0;
  const still = useMedia("(prefers-reduced-motion: reduce)");
  const [since] = useState(() => Date.now());
  const scale = useMemo(() => sharedScale(side.bosses.map((b) => b.name), 150, 170), [side.bosses.map((b) => b.name).join(",")]);
  const n = side.bosses.length;
  return (
    <div class="boss-side tw-side">
      {side.bosses.map((b, i) => (
        <span class={`tw-side-fig${i === side.toMove ? " tw-to-move" : ""}${b.id === caster ? " tw-casting" : ""}`} key={`${i}-${b.id}`} data-boss={b.id} style={{ bottom: `${((n - 1 - i) * 100) / n}%`, height: `${100 / n}%` }}>
          {/* (His words over his own head, whoever is to move: the figure's drawn box, not his third of the board's height.) */}
          <span class="tw-side-body">
            <VoiceBubble voice={bossVoice} class="bc-bubble tw-side-bubble" mine={(k) => speakerOf(side, k) === i} />
            <Figure boss={b} stage={bossStage(match.phase, b)} scale={scale} since={since} still={still} />
            {/* (His prop beside him, a computer's: Babur's pump by his feet, toward the window's edge, as by a lone boss's figure.) */}
            {computer && <BossBarExtra boss={b} until={until} part="towerProp" />}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The figures beside the board (a computer's): the floor's several stacked (TowerSide), else the boss's own (BossSide). */
export function SideFigures({ match, caster = null }: { match: GameView; caster?: string | null }) {
  return match.boss && sideOf(match.boss) ? <TowerSide boss={match.boss} match={match} caster={caster} /> : <BossSide match={match} />;
}
