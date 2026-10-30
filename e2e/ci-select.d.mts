// Types for ci-select.mjs (packages/server/test/ci-select.test.ts imports it).
export interface Areas {
  smoke: string[];
  leftOut?: string[];
  full: string[];
  none: string[];
  areas: Record<string, { paths: string[]; specs: string[] }>;
  webgl?: { about?: string; areas: string[]; specs: string[] };
}
export interface Picked {
  full: string | null;
  specs: string[];
  webgl?: string[];
  why: { path: string; runs: string }[];
}
export declare const MAX_SHARDS: number;
export declare const SHARD_SECONDS: number;
export declare function globToRegExp(glob: string): RegExp;
export declare function specFiles(dir?: string): string[];
export declare function weigher(timings: Record<string, number>): (file: string) => number;
export declare function readTimings(dir?: string): Record<string, number>;
export declare function readAreas(dir?: string): Areas;
export declare function select(changed: string[], areas: Areas, existing: string[]): Picked & { webgl: string[] };
export declare function allWebgl(areas: Areas, existing: string[]): string[];
export declare function shardCount(specs: string[], weight: (file: string) => number): number;
export declare function plan(
  picked: Picked,
  weight: (file: string) => number,
  all: string[],
): { outputs: { specs: string; total: string; shards: string; webgl: string; note: string }; md: string };
export declare const WEBGL_JOBS: string[];
