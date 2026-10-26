import type { FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";

type Screen = FunctionComponent<{ onBack: () => void }>;

/**
 * The town square's page (/town), loaded when it opens: its code, art and styles are their own chunk, never in the main
 * bundle. Until it arrives (a moment) the page is its plain background: no loading bar.
 */
export function TownPage({ onBack }: { onBack: () => void }) {
  const [Town, setTown] = useState<Screen | null>(null);
  useEffect(() => {
    let live = true;
    void import("./Town.tsx").then((m) => live && setTown(() => m.TownScreen));
    return () => void (live = false);
  }, []);
  return Town ? <Town onBack={onBack} /> : <div class="screen" />;
}
