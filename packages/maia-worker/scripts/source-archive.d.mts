// Maia box (AGPL-3.0, see LICENSE): types for source-archive.mjs (the tests import it).
export declare const ARCHIVE: string;
export declare const TOP: string;
export declare function boxFiles(box: string): string[];
export interface LockEntry {
  [field: string]: unknown;
  version?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  link?: boolean;
  dev?: boolean;
  optional?: boolean;
  devOptional?: boolean;
}
export interface Lockfile {
  name?: string;
  version?: string;
  lockfileVersion: number;
  requires?: boolean;
  packages: Record<string, LockEntry>;
}
export declare function boxLock(workspaceLock: Lockfile, key?: string): Lockfile;
export declare function tarGz(top: string, files: Record<string, string | Uint8Array>): Buffer;
export declare function sourceArchive(o: { box: string; lock: string; built: Record<string, Uint8Array>; model: { name: string; data: Uint8Array } }): Buffer;
export declare function lockText(box: string): string;
