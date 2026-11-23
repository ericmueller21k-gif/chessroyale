import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The lost Escape (Nov 11 and 12, flaky batches 1 and 2; docs/decisions/2026-11-11-flaky-batch.md): a pop-up that listened for its keys in a
 * `useEffect` missed an Escape pressed as it opened, because a `useEffect` waits for a paint. Ten pop-ups had it. The agreed pattern: a
 * `keydown` (or `keyup`) listener added in an effect is added in a `useLayoutEffect`, in place before the first paint. This check finds
 * any added inside a `useEffect`. A listener that truly may miss the first key says why on the line before it:
 * `// keydown in useEffect: <why>`.
 */
const SRC = join(__dirname, "../src");
const KEYS = new Set(["keydown", "keyup"]);
const WAIVER = /keydown in useEffect:/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

/** Each key listener added inside a `useEffect` (its nearest effect: one in a layout effect is fine), as `file:line`. */
function keyListenersInEffects(path: string, text: string): string[] {
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const hookOf = (n: ts.Node): string | null => {
    for (let p = n.parent; p; p = p.parent) if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && /^use(Layout)?Effect$/.test(p.expression.text)) return p.expression.text;
    return null;
  };
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isIdentifier(n.expression))) {
      const name = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : n.expression.text;
      const first = n.arguments[0];
      if (name === "addEventListener" && first && ts.isStringLiteralLike(first) && KEYS.has(first.text) && hookOf(n) === "useEffect") {
        const { line } = src.getLineAndCharacterOfPosition(n.getStart());
        const before = text.split("\n").slice(Math.max(0, line - 2), line + 1).join("\n");
        if (!WAIVER.test(before)) out.push(`${relative(join(SRC, ".."), path)}:${line + 1}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

describe("key listeners go in a layout effect (the lost Escape)", () => {
  it("no keydown or keyup listener in packages/app/src is added in a useEffect", () => {
    const found = files(SRC).flatMap((f) => keyListenersInEffects(f, readFileSync(f, "utf8")));
    expect(found, "use useLayoutEffect: a useEffect waits for a paint, and a key pressed as the pop-up opens is lost").toEqual([]);
  });

  it("finds one in a useEffect, not one in a useLayoutEffect or a waived one", () => {
    const code = (hook: string, waiver = "") =>
      `function P() {\n  ${hook}(() => {\n    const k = (e: KeyboardEvent) => e.key;\n    ${waiver}\n    addEventListener("keydown", k);\n    return () => removeEventListener("keydown", k);\n  }, []);\n}`;
    expect(keyListenersInEffects(join(SRC, "x.tsx"), code("useEffect"))).toEqual(["src/x.tsx:5"]);
    expect(keyListenersInEffects(join(SRC, "x.tsx"), code("useLayoutEffect"))).toEqual([]);
    expect(keyListenersInEffects(join(SRC, "x.tsx"), code("useEffect", "// keydown in useEffect: a test"))).toEqual([]);
    // (document's and window's too.)
    expect(keyListenersInEffects(join(SRC, "x.tsx"), code("useEffect").replace("addEventListener", "document.addEventListener"))).toEqual(["src/x.tsx:5"]);
  });
});
