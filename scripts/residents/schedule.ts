/**
 * When residents are online (RESIDENTS in packages/core/src/settings.ts; the design's "Schedules"). Pure: a function of the profiles,
 * the UTC day and the settings, so a restart plans the same day again and picks up the sessions still running.
 *
 * A day's plan is made minute by minute, from an hour before UTC midnight (so sessions are already running at midnight) to the
 * day's end. Each minute the online target is worked out (`targetAt`: the residents' own daily shapes, plus a slow swell, so the
 * count comes in waves); while fewer than the target are online, up to `startsPerMinute` sessions begin, each a resident drawn by how
 * likely it is to be on at its local hour. Keen residents (today is one of their days, sessions left) are drawn first; when none
 * is free, the rest top up, within the daily cap. A session lasts 10-60 minutes.
 */
import { RESIDENTS, mulberry32 } from "@chessroyale/core";
import { between, seedOf, type Profile, type ResidentSettings } from "./profiles.ts";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export interface Session {
  /** The resident's index (Profile.index). */
  resident: number;
  start: number;
  end: number;
}

/** The local hour (0-23) at `t` for a time zone `utcOffset` hours from UTC. */
export function localHour(t: number, utcOffset: number): number {
  const h = Math.floor((t + utcOffset * HOUR) / HOUR) % 24;
  return h < 0 ? h + 24 : h;
}

/** The local day's number (days since 1970-01-01 there). */
export const localDay = (t: number, utcOffset: number) => Math.floor((t + utcOffset * HOUR) / DAY);

/** Saturday or Sunday there (1970-01-01 was a Thursday). */
export function isWeekend(t: number, utcOffset: number): boolean {
  const dow = (((localDay(t, utcOffset) + 4) % 7) + 7) % 7;
  return dow === 0 || dow === 6;
}

/** How likely a resident is to be on at `t`: its local hour's weight, more at weekends. */
export function availability(p: Profile, t: number, s: ResidentSettings = RESIDENTS): number {
  return s.hourWeights[localHour(t, p.utcOffset)]! * (isWeekend(t, p.utcOffset) ? s.weekend : 1);
}

/** Whether a resident plays on its local day `day`, and how many sessions (its keenness; seeded by resident and day). */
export function dayPlan(p: Profile, day: number, s: ResidentSettings = RESIDENTS): { plays: boolean; sessions: number } {
  const rng = mulberry32(seedOf(p.seed, "day", day));
  const plays = rng() < p.keenness;
  const sessions = s.sessions.min + Math.floor(rng() * (s.sessions.max - s.sessions.min + 1));
  return { plays, sessions };
}

/** The residents' summed availability at `t`. */
const shapeAt = (profiles: readonly Profile[], t: number, s: ResidentSettings) => profiles.reduce((a, p) => a + availability(p, t, s), 0);

/**
 * How many residents should be online at `t`: `target` times the residents' shape now over its average across the UTC day, times a
 * slow swell (its phase seeded by the day), held between `wave.min` and `wave.max` times the target.
 */
export function targetAt(profiles: readonly Profile[], t: number, target: number, s: ResidentSettings = RESIDENTS, dayMean?: number): number {
  if (!profiles.length || target <= 0) return 0;
  const day = Math.floor(t / DAY);
  const mean = dayMean ?? meanShape(profiles, day, s);
  const shape = mean > 0 ? shapeAt(profiles, t, s) / mean : 1;
  const phase = mulberry32(seedOf("wave", day))() * 2 * Math.PI;
  const swell = 1 + s.wave.amplitude * Math.sin((2 * Math.PI * t) / (s.wave.periodMinutes * MINUTE) + phase);
  const k = Math.max(s.wave.min, Math.min(s.wave.max, shape * swell));
  return Math.min(profiles.length, Math.round(target * k));
}

/** The residents' shape averaged over the UTC day `day` (at each half hour). */
export function meanShape(profiles: readonly Profile[], day: number, s: ResidentSettings = RESIDENTS): number {
  let sum = 0;
  for (let i = 0; i < 48; i++) sum += shapeAt(profiles, day * DAY + i * 30 * MINUTE + 15 * MINUTE, s);
  return sum / 48;
}

/** The plan for the UTC day `day` (days since 1970): every session, by start. */
export function planDay(profiles: readonly Profile[], day: number, target: number, s: ResidentSettings = RESIDENTS): Session[] {
  const dayStart = day * DAY;
  const from = dayStart - HOUR;
  const mean = meanShape(profiles, day, s);
  const sessions: Session[] = [];
  const endsAt = new Map<number, number>();
  const lastEnd = new Map<number, number>();
  // (Per resident and local day: minutes played and sessions begun.)
  const used = new Map<string, { minutes: number; sessions: number }>();
  const usedOf = (p: Profile, t: number) => {
    const k = `${p.index}:${localDay(t, p.utcOffset)}`;
    let u = used.get(k);
    if (!u) used.set(k, (u = { minutes: 0, sessions: 0 }));
    return u;
  };
  const minMin = s.sessionMinutes.min;
  for (let t = from; t < dayStart + DAY; t += MINUTE) {
    for (const [r, end] of endsAt) if (end <= t) endsAt.delete(r);
    const want = targetAt(profiles, t, target, s, mean);
    let need = Math.min(s.startsPerMinute, want - endsAt.size);
    if (need <= 0) continue;
    const rng = mulberry32(seedOf("start", t));
    const free = profiles.filter((p) => !endsAt.has(p.index) && t - (lastEnd.get(p.index) ?? -Infinity) >= s.restMinutes * MINUTE && usedOf(p, t).minutes + minMin <= s.maxMinutesPerDay);
    const keen = free.filter((p) => {
      const plan = dayPlan(p, localDay(t, p.utcOffset), s);
      return plan.plays && usedOf(p, t).sessions < plan.sessions;
    });
    const keenSet = new Set(keen.map((p) => p.index));
    const rest = free.filter((p) => !keenSet.has(p.index));
    for (const pool of [keen, rest]) {
      while (need > 0 && pool.length) {
        const weights = pool.map((p) => availability(p, t, s) * p.keenness);
        const total = weights.reduce((a, b) => a + b, 0);
        if (total <= 0) break;
        let x = rng() * total;
        let i = 0;
        while (i < pool.length - 1 && (x -= weights[i]!) >= 0) i++;
        const p = pool.splice(i, 1)[0]!;
        const u = usedOf(p, t);
        const minutes = Math.min(Math.round(between(rng, minMin, s.sessionMinutes.max)), s.maxMinutesPerDay - u.minutes);
        u.minutes += minutes;
        u.sessions++;
        const end = t + minutes * MINUTE;
        endsAt.set(p.index, end);
        lastEnd.set(p.index, end);
        sessions.push({ resident: p.index, start: t, end });
        need--;
      }
    }
  }
  return sessions;
}

/**
 * The plan as the program reads it: each UTC day's plan made once (and the day before's, for sessions crossing midnight), and the
 * sessions running at a moment.
 */
export class Scheduler {
  private plans = new Map<number, Session[]>();

  constructor(
    readonly profiles: readonly Profile[],
    readonly target: number,
    private readonly s: ResidentSettings = RESIDENTS,
  ) {}

  plan(day: number): Session[] {
    let p = this.plans.get(day);
    if (!p) {
      p = planDay(this.profiles, day, this.target, this.s);
      this.plans.set(day, p);
      for (const d of this.plans.keys()) if (d < day - 1) this.plans.delete(d);
    }
    return p;
  }

  /**
   * The session each resident should be in at `t` (by resident index): yesterday's sessions still running, then today's that begin
   * from midnight. (Today's plan's hour before midnight only stands in for yesterday's sessions while planning, so the two days join
   * without doubling.)
   */
  runningAt(t: number): Map<number, Session> {
    const day = Math.floor(t / DAY);
    const out = new Map<number, Session>();
    for (const x of this.plan(day - 1)) if (x.start <= t && t < x.end) out.set(x.resident, x);
    for (const x of this.plan(day)) if (x.start >= day * DAY && x.start <= t && t < x.end) out.set(x.resident, x);
    return out;
  }
}
