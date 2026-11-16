import type { ComponentType } from "preact";
import { useEffect, useReducer } from "preact/hooks";

/**
 * A group of screens that are their own chunk, off the first load (Nov 10, phone load: home starts fast), as the town
 * square's is. `preload()` fetches it (play is near: the queue, the boss menu, a match starting); `screen(name)` is that
 * screen, drawn at once once the chunk is here, else the plain screen background until it arrives (a moment). No module
 * (a chunk gone after a deploy: the page is loading again, stale.ts) or a failed load: asked again next time.
 */
export function lazyGroup<M>(load: () => Promise<M>) {
  let mod: M | null = null;
  let loading: Promise<M | null> | null = null;
  const preload = (): Promise<M | null> =>
    (loading ??= load().then(
      (m) => (m ? (mod = m) : ((loading = null), null)),
      () => ((loading = null), null),
    ));
  const screen = <K extends keyof M>(name: K): M[K] => {
    function Lazy(props: object) {
      const [, loaded] = useReducer((n: number) => n + 1, 0);
      useEffect(() => {
        let live = true;
        if (!mod) void preload().then(() => live && loaded(0));
        return () => void (live = false);
      }, []);
      const Screen = mod?.[name] as ComponentType<object> | undefined;
      return Screen ? <Screen {...props} /> : <div class="screen" />;
    }
    return Lazy as M[K];
  };
  return { preload, screen, loaded: () => mod };
}
