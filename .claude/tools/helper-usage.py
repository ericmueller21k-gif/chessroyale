#!/usr/bin/env python3
"""
Helpers' usage, one line each (CLAUDE.md, "Working lean"): steps, memory, time, waiting, big outputs, images.

Usage: python3 .claude/tools/helper-usage.py <dir> [top]
  <dir>: the director session's task folder, whose a*.output files are its helpers' transcripts (JSON lines).
  top:   how many to list, costliest first (default 15).

"Re-read" is what a helper's steps read back in total (its whole history, every step): the bulk of its usage.
"Written" is what it wrote. Read-only; prints a table and a total.
"""
import collections, glob, json, os, sys
from datetime import datetime

def stamp(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))

def digest(path):
    steps = written = reread = peak = big = images = waits = 0
    tools = collections.Counter()
    first = last = None
    with open(path) as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if d.get("timestamp"):
                first, last = first or d["timestamp"], d["timestamp"]
            m = d.get("message") or {}
            content = m.get("content") if isinstance(m.get("content"), list) else []
            if d.get("type") == "assistant":
                u = m.get("usage") or {}
                written += u.get("output_tokens", 0)
                ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                reread += ctx
                peak = max(peak, ctx)
                for c in content:
                    if c.get("type") == "tool_use":
                        steps += 1
                        tools[c.get("name")] += 1
                        if "sleep" in json.dumps(c.get("input", {})):
                            waits += 1
            elif d.get("type") == "user":
                for c in content:
                    if c.get("type") == "tool_result":
                        s = json.dumps(c.get("content"))
                        big += len(s) > 20_000
                        images += '"image"' in s
    hours = (stamp(last) - stamp(first)).total_seconds() / 3600 if first and last else 0
    return dict(name=os.path.basename(path)[:9], steps=steps, written=written, reread=reread, peak=peak, hours=hours,
                big=big, images=images, waits=waits, tools=", ".join(f"{k} {n}" for k, n in tools.most_common(3)))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    top = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    rows = [digest(p) for p in glob.glob(os.path.join(sys.argv[1], "a*.output")) if os.path.getsize(p) > 50_000]
    rows.sort(key=lambda r: r["reread"], reverse=True)
    print(f"{'helper':9} {'steps':>5} {'written':>8} {'peak mem':>9} {'re-read':>8} {'hours':>5} {'big out':>7} {'images':>6} {'waits':>5}  tools")
    for r in rows[:top]:
        print(f"{r['name']:9} {r['steps']:5d} {r['written']:8d} {r['peak']:9d} {r['reread'] / 1e6:7.0f}M {r['hours']:5.1f} {r['big']:7d} {r['images']:6d} {r['waits']:5d}  {r['tools']}")
    print(f"{len(rows)} helpers: {sum(r['reread'] for r in rows) / 1e6:.0f}M re-read, {sum(r['written'] for r in rows) / 1e3:.0f}K written")

if __name__ == "__main__":
    main()
