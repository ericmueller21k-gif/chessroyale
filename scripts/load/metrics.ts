/** Load-test measurements: timings (percentiles), counters and error kinds, shared by every simulated player. */

export class Timings {
  private xs: number[] = [];
  add(ms: number) {
    if (Number.isFinite(ms)) this.xs.push(ms);
  }
  get n() {
    return this.xs.length;
  }
  pct(p: number): number | null {
    if (!this.xs.length) return null;
    const s = [...this.xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
  }
  max(): number | null {
    return this.xs.length ? Math.max(...this.xs) : null;
  }
  mean(): number | null {
    return this.xs.length ? this.xs.reduce((a, b) => a + b, 0) / this.xs.length : null;
  }
}

export class Metrics {
  readonly startedAt = Date.now();
  readonly timings = new Map<string, Timings>();
  readonly counts = new Map<string, number>();
  readonly errors = new Map<string, number>();
  /** Players by state right now. */
  readonly states = new Map<string, number>();

  time(name: string, ms: number) {
    let t = this.timings.get(name);
    if (!t) this.timings.set(name, (t = new Timings()));
    t.add(ms);
  }
  count(name: string, n = 1) {
    this.counts.set(name, (this.counts.get(name) ?? 0) + n);
  }
  error(kind: string) {
    const k = kind.slice(0, 120);
    this.errors.set(k, (this.errors.get(k) ?? 0) + 1);
  }
  move(from: string | null, to: string) {
    if (from) this.states.set(from, (this.states.get(from) ?? 1) - 1);
    this.states.set(to, (this.states.get(to) ?? 0) + 1);
  }

  line(): string {
    const s = [...this.states].filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(", ");
    const errs = [...this.errors.values()].reduce((a, b) => a + b, 0);
    const p = (name: string) => {
      const t = this.timings.get(name);
      return t?.n ? `${Math.round(t.pct(50)!)}/${Math.round(t.pct(95)!)}` : "-";
    };
    return `${Math.round((Date.now() - this.startedAt) / 1000)}s | ${s} | play→lobby p50/p95 ${p("playToLobby")} ms | rtt ${p("pickRtt")} ms | errors ${errs}`;
  }

  table(): string {
    const rows = [...this.timings].sort(([a], [b]) => a.localeCompare(b));
    const f = (x: number | null) => (x === null ? "-" : x >= 10_000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);
    const lines = ["| Measure | n | p50 | p90 | p99 | max |", "| --- | ---: | ---: | ---: | ---: | ---: |"];
    for (const [name, t] of rows) lines.push(`| ${name} | ${t.n} | ${f(t.pct(50))} | ${f(t.pct(90))} | ${f(t.pct(99))} | ${f(t.max())} |`);
    return lines.join("\n");
  }

  json() {
    const timings: Record<string, unknown> = {};
    for (const [k, t] of this.timings) timings[k] = { n: t.n, p50: t.pct(50), p90: t.pct(90), p99: t.pct(99), max: t.max(), mean: t.mean() };
    return { startedAt: this.startedAt, seconds: (Date.now() - this.startedAt) / 1000, timings, counts: Object.fromEntries(this.counts), errors: Object.fromEntries(this.errors) };
  }
}
