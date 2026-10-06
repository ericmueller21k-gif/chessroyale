import type { ComponentChildren } from "preact";
import { openProfile } from "../profile-nav.ts";

/**
 * A player's name that opens their profile when tapped (yours, someone's, or a bot's card). Use it wherever a name
 * shows; it looks like the text around it.
 */
export function PlayerName({
  name,
  uid,
  you,
  bot,
  children,
  class: cls,
}: {
  name: string;
  uid?: string;
  you?: boolean;
  bot?: boolean;
  children?: ComponentChildren;
  class?: string;
}) {
  return (
    <button
      type="button"
      class={`player-name${cls ? ` ${cls}` : ""}`}
      aria-label={`${you ? "Your" : `${name}'s`} profile`}
      onClick={(e) => {
        // (Names sit in rows and sheets that react to taps of their own.)
        e.stopPropagation();
        openProfile({ uid, name, you, bot });
      }}
    >
      {children ?? name}
    </button>
  );
}
