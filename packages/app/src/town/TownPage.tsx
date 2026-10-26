import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";

type Props = { onBack: () => void; onBossAlone: (id: string) => void };
type Screen = FunctionComponent<Props>;

/**
 * The town square's page (/town), loaded when it opens: its code, art and styles are their own chunk, never in the main
 * bundle. Until it arrives (a moment) the page is its plain background: no loading bar. `onBossAlone`: a boss's card's
 * "Challenge alone", confirmed: out of the town square to the Boss raid screen, that boss's tile picked.
 */
export function TownPage({ onBack, onBossAlone }: Props) {
  const [Town, setTown] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    void import("./Town.tsx").then((m) => live && setTown(() => m.TownScreen));
    return () => void (live = false);
  }, []);
  return Town ? <Town onBack={onBack} onBossAlone={onBossAlone} /> : <div class="screen" />;
}
