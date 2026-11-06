// Types for ci-select.mjs (packages/server/test/ci-select.test.ts imports it).
export interface Areas {
  smoke: string[];
  leftOut?: string[];
  full: string[];
  none: string[];
  areas: Record<string, { paths: string[]; specs: string[] }>;
  webgl?: { about?: string; areas: string[]; specs: string[] };
  traced?: { about?: string; modules: string[]; hubs?: string[]; hubsAbout?: string };
}
/** Read access to a change, for tracing a module through the code (gitRepo, or one in memory in the tests). */
export interface Repo {
  before(path: string): string | null;
  after(path: string): string | null;
  grep(words: string[]): string[];
}
export interface Statement {
  kind: "decl" | "import" | "reexport" | "exportList" | "type" | "other";
  names?: any;
  exported?: boolean;
  fn?: boolean;
  text: string;
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
/** Test times by spec file: { phone, desktop } seconds (or an older single number, both projects). */
export type Timings = Record<string, number | Record<string, number>>;
export declare const PROJECTS: string[];
export declare const WORKERS: number;
export declare function projectWeigher(timings: Timings): (file: string, project: string) => number;
export declare function weigher(timings: Timings): (file: string) => number;
export declare function readTimings(dir?: string, live?: string): Timings;
export declare function readLiveTimings(live: string): Timings;
export declare function makespan(files: string[], time: (file: string, project: string) => number, workers?: number): number;
export declare function assign(
  files: string[],
  time: (file: string, project: string) => number,
  total: number,
  workers?: number,
): { files: string[]; seconds: number }[];
export declare function fileFilter(file: string): string;
export declare function readAreas(dir?: string): Areas;
export declare function select(changed: string[], areas: Areas, existing: string[], repo?: Repo | null): Picked & { webgl: string[] };
export declare function readModule(src: string, path?: string): Statement[] | null;
export declare function traceModule(before: string | null, after: string | null, path?: string): { names: string[]; reason: string | null };
export declare function importsOf(src: string): string[];
export declare function resolveImport(from: string, spec: string, exportsOf: (pkg: string) => Record<string, string> | null): string[];
export declare function usersOf(path: string, names: string[], repo: Repo): Map<string, string[]>;
export declare function traceChanges(
  paths: string[],
  traced: Set<string>,
  repo: Repo,
): Map<string, { names: string[]; users: Map<string, string[]>; reason: string | null; via: string | null }>;
export declare function gitRepo(base: string, head?: string | null, cwd?: string): Repo;
export declare function allWebgl(areas: Areas, existing: string[]): string[];
export declare function shardCount(specs: string[], weight: (file: string) => number): number;
export declare function plan(
  picked: Picked,
  timings: Timings,
  all: string[],
  source?: string,
): { outputs: { specs: string; total: string; shards: string; assignment: string; note: string }; md: string };
export declare const WEBGL_JOBS: string[];
