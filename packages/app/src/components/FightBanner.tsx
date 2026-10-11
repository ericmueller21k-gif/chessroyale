import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { play, type SoundName } from "../sound.ts";

/**
 * A fighting-game banner across the board: a slanted band shoots in over speed
 * lines, big italic text slams down with a flash, holds, and the band shoots
 * off the other side (about 1.5 s). "START!" opens a boss battle (with its
 * whoosh); the boss's banners ("QUEEN DOWN!") carry its face; yours ("QUEEN
 * SLAIN!") carry the God King's. The queen banners are silent for now (Eric,
 * Oct 11). Sits over the board.
 */
export function FightBanner({
  text,
  sub,
  face,
  tone = "start",
  sound,
}: {
  text: string;
  sub?: string;
  /** The boss's face (its icon for now; a sprite later). */
  face?: ComponentChildren;
  tone?: "start" | "boss" | "hero";
  sound?: SoundName;
}) {
  useEffect(() => {
    if (sound) play(sound);
  }, []);
  return (
    <div class={`fight-banner ${tone}`} role="alert" aria-label={sub ? `${text} ${sub}` : text}>
      <div class="fb-flash" />
      <div class="fb-band">
        <div class="fb-lines" />
        {face && <span class="fb-face">{face}</span>}
        <span class="fb-words">
          <span class="fb-text">{text}</span>
          {sub && <span class="fb-sub">{sub}</span>}
        </span>
      </div>
    </div>
  );
}
