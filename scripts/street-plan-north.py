#!/usr/bin/env python3
"""
The street town's plan, round 4 (Nov 5; Eric's call on the world's shape): from the art's plan (claude/boss-art 11a4d903,
town-plan-nov5.json, as copied into the app at 6f3aa6b0) to the town that wraps east-west only.

    git show 6f3aa6b0:packages/app/src/town/street-plan.json > /tmp/art-plan.json
    python3 scripts/street-plan-north.py /tmp/art-plan.json > packages/app/src/town/street-plan.json

Eric: "the Colosseum sits at the top centre, at the north edge ... nothing is behind it"; "the streets funnel north into that
Colosseum plaza"; "the south edge is closed by a row of buildings". What this does (46 x 46 kept):
- the art's rows 0..39 move up 6 (its Seam Street, rows 44..1 across the old north-south seam, becomes South Street, rows 4..7,
  the bottom street); the art's rows 40..43 (the gardens and sidewalk north of the Colosseum's grove) go, so the Colosseum's top
  row is the world's north edge (row 45);
- rows 0..2 are a row of lots the whole way round (the closing row, its fronts facing north onto South Street), row 3 its sidewalk;
- the Colosseum's grove either side of it (columns 13..16 and 29..32, from Colosseum Row's north sidewalk up to the edge) is paved:
  the plaza, which Colosseum Row and Upper Street open into;
- Seam Avenue ends at Upper Street: north of it, the avenue's columns are Upper Street's north sidewalk and lots (one row from the
  plaza's east side round to its west side), gardens behind;
- the tall lots north of Upper Street keep their columns, 2 rows deep (rows 44..45); the art's everyday buildings go (the rows
  replace them all); the props move with their rows (none on the plaza but a tree at each strip's outer column, lamps every 6 columns
  along the closing row's sidewalk).
- `wrap`: {"ew": true, "ns": false}: the one switch (Eric may close east-west later).
"""
import json
import sys

src = json.load(open(sys.argv[1]))
N = 46


def nr(r):
    """The art's row r in the new plan (None: gone)."""
    r = int(r)
    if 0 <= r <= 39:
        return r + 6
    if r in (44, 45):
        return r - 40
    return None


def ny(y):
    r = nr(round(y))
    return None if r is None else y + (r - round(y))


old = src["ground"]
g = [["?"] * N for _ in range(N)]
for r in range(N):
    m = nr(r)
    if m is not None:
        g[m] = list(old[r])
for c in range(N):
    for r in (0, 1, 2):
        g[r][c] = "L"
    g[3][c] = "="
PLAZA = list(range(13, 17)) + list(range(29, 33))
for r in range(31, 46):
    for c in PLAZA:
        g[r][c] = "="
AVE = [43, 44, 45, 0, 1, 2]
for c in AVE:
    g[40][c] = "="
    for r in (41, 42, 43):
        g[r][c] = "L"
    for r in (44, 45):
        g[r][c] = "g"
assert all("?" not in row for row in g), [i for i, row in enumerate(g) if "?" in row]
ground = ["".join(row) for row in g]

streets = []
for s in src["streets"]:
    s = dict(s)
    if s["id"] == "seam-st":
        s.update(id="south-st", name="South Street", r0=4, r1=7)
    elif s["id"] == "seam-ave":
        s.update(r0=4, r1=39)
    else:
        s.update(r0=s["r0"] + 6, r1=s["r1"] + 6)
    streets.append(s)

lots = []
for l in src["lots"]:
    if l["kind"] == "house":
        continue
    l = dict(l)
    if l["street"] == "seam-st":
        l["street"] = "south-st"
    r0 = nr(l["r0"])
    if l["kind"] == "tall" and l["r0"] == 38:
        l["d"] = 2
    l["r0"] = r0
    for k in ("door", "rest"):
        if k in l:
            l[k] = {"c": l[k]["c"], "r": nr(l[k]["r"])}
    if "wander" in l:
        w = l["wander"]
        l["wander"] = {"x0": w["x0"], "x1": w["x1"], "y0": w["y0"] + 6, "y1": w["y1"] + 6}
    lots.append(l)

props = []
for p in src["props"]:
    y = ny(p["y"])
    if y is None:
        continue
    c = round(p["x"])
    r = round(y)
    if r >= 31 and c in PLAZA and not (p["kind"] == "tree" and c in (13, 32)):
        continue
    if c in AVE and r >= 40:
        continue
    p = dict(p, y=y)
    props.append(p)
for c in range(1, N, 6):
    props.append({"kind": "lamp", "x": c, "y": 3, "v": 0})

park = dict(src["park"])
park["r1"] = src["park"]["r1"] + 6
park["tables"] = [{"c": t["c"], "r": t["r"] + 6} for t in src["park"]["tables"]]
park["fountain"] = [{"c": t["c"], "r": t["r"] + 6} for t in src["park"]["fountain"]]
col = dict(src["coliseum"])
col["r0"] = src["coliseum"]["r0"] + 6
col["statues"] = [{"c": t["c"], "r": t["r"] + 6} for t in col["statues"]]
col["gate"] = [{"c": t["c"], "r": t["r"] + 6} for t in col["gate"]]
assert col["r0"] + col["size"] - 1 == N - 1, "the Colosseum's top row is the north edge"

out = {
    "size": src["size"],
    "conventions": "squares (c, r): c west to east (wrapping when wrap.ew), r south to north (row 0 the south edge, row 45 the north edge: no wrap); positions (x, y) in squares, a square's middle at whole numbers",
    "wrap": {"ew": True, "ns": False},
    "ground": ground,
    "groundKey": src["groundKey"],
    "streets": streets,
    "start": {"c": src["start"]["c"], "r": src["start"]["r"] + 6, "heading": 0},
    "lots": lots,
    "park": park,
    "coliseum": col,
    "props": props,
}
json.dump(out, sys.stdout, indent=1)
sys.stdout.write("\n")
