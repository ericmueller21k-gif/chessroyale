// Types for perf-probe.js (plain JS: scripts/frames-boss-character.mjs runs it under Node), for e2e/perf.spec.ts.
export interface FrameStats { n: number; p50: number; p95: number; slow: number; max: number }
export interface Counts { dom: number; list: number; rows: number; cap: number | null; anims: number; timeouts: number; intervals: number; tSet: number; audio: number; audioOff: number; canvases: number }
export function instrument(): void;
export function counts(): Counts;
/** `longs`: [start, length] per long task; `frames`: [length, rAF, tag, end]. */
export function longStats(longs: [number, number][], frames: [number, number, string, number][]): { n: number; max: number };
export function frameStats(dts: number[]): FrameStats;
