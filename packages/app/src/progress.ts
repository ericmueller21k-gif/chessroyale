/**
 * Who has moved this round, for the leaderboard's green "done" marks. Bots
 * finish at their recorded thinking time; humans when their move arrives.
 * Once the round is locked, anyone still thinking finishes in a quick stagger
 * so the board lights up before the reveal.
 */
export class RoundProgress {
  done = new Set<string>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly onChange: () => void) {}

  /** A new round: bots finish `botsDoneIn[id]` ms after the clock starts, `startsInMs` from now. */
  start(botsDoneIn: Readonly<Record<string, number>>, startsInMs = 0) {
    this.reset();
    for (const [id, ms] of Object.entries(botsDoneIn)) this.timers.push(setTimeout(() => this.mark(id), Math.max(0, startsInMs) + ms));
  }

  mark(id: string) {
    if (this.done.has(id)) return;
    this.done.add(id);
    this.onChange();
  }

  /** Everyone in `ids` not done yet finishes within `ms`, staggered. Resolves once they all have. */
  finishAll(ids: readonly string[], ms = 1200): Promise<void> {
    this.clearTimers();
    const left = ids.filter((id) => !this.done.has(id));
    if (!left.length) return Promise.resolve();
    for (const id of left) this.timers.push(setTimeout(() => this.mark(id), 120 + Math.random() * (ms - 120)));
    return new Promise((resolve) => setTimeout(resolve, ms + 60));
  }

  reset() {
    this.clearTimers();
    this.done = new Set();
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
