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
Round 5 (the section above `out`): the grove beside the Colosseum and along the back, its walls and gates, the back wall.
Round 6 (after it): no trees on the grove's squares under the street town's wider Colosseum.
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

# ---- Round 5 (Nov 5, later; Eric: "The Colosseum is literally the edge of the top center of the map … we shouldn't see any houses
# behind it … put a gate to the left and right of it … trees and shrubs … you can't go past it. It's all blocked off … the entire back
# wall of the map … is totally blocked"):
# - beside the Colosseum (the plaza's strips, columns 13..16 and 29..32, from its front line, row 34, up to the edge) is a grove: not
#   walked on, trees and thick shrubs; the plaza is only in front of it (rows 31..33);
# - on its front line either side of it, a wall with a closed gate (decorative);
# - along the whole north edge behind the town's back rows (rows 44..45, the tall lots there gone), a grove too, and the back wall
#   on the edge itself.
COL_C = range(col["c0"], col["c0"] + col["size"])
GROVE = set()
for r in range(34, 46):
    for c in PLAZA:
        GROVE.add((c, r))
for r in (44, 45):
    for c in range(N):
        if c not in COL_C:
            GROVE.add((c, r))
for (c, r) in GROVE:
    ground[r] = ground[r][:c] + "g" + ground[r][c + 1:]
lots = [l for l in lots if not (l["kind"] == "tall" and l["r0"] >= 44)]
props = [p for p in props if (round(p["x"]), round(p["y"])) not in GROVE and not (31 <= round(p["y"]) <= 33 and round(p["x"]) in PLAZA and p["kind"] != "lamp")]
for (c, r) in sorted(GROVE):
    # Trees on every other square, a shrub between them along the walls' backs and the back rows' gardens.
    v = (c * 7 + r * 3) % 3
    if (c + r) % 2 == 0:
        props.append({"kind": "tree", "x": c, "y": r, "v": v})
    elif r in (35, 44):
        props.append({"kind": "bush", "x": c, "y": r, "v": v})
def wall(name, c0, r0, w, inset, h, gate, depth):
    return {"kind": "wall", "id": "wall", "v": 0, "c0": c0, "r0": r0, "w": w, "d": 1, "facing": "S", "street": "plaza", "name": name,
            "inset": inset, "depth": depth, "wall": {"w": w, "h": h, "gate": gate, "depth": depth}}
# (The gates clear of the chess pieces standing before the walls: the west one near its outer end, the east one too.)
lots.append(wall("The Colosseum's west wall", 13, 34, 4, 0.5, 166, 32, 0.6))
lots.append(wall("The Colosseum's east wall", 29, 34, 4, 0.5, 166, 118, 0.6))
for i, (c0, w) in enumerate([(0, 6), (6, 6), (12, 5), (29, 5), (34, 6), (40, 6)]):
    lots.append(wall(f"The back wall ({i + 1})", c0, 45, w, 1.0, 148, None, 0.5))

# ---- Round 6 (Nov 5, later; Eric: "make it taller and bigger, so it really feels like a true overwhelmingly large kind of building"):
# the street town's Colosseum is drawn a quarter wider (houses/coliseum.ts STREET: its oval 304 px either side of its axis, 8.2
# squares), so its sides stand over the grove's inner columns (15, 16 and 29, 30). Those squares stay grove (nobody walks there); the
# trees and shrubs on them, which would stand inside it, go. The walls and gates keep their lots: their outer halves, gates and all,
# show beside it.
COL_AXIS = col["c0"] + (col["size"] - 1) / 2
COL_HALF = 304 / 37
UNDER = {(c, r) for (c, r) in GROVE if r >= col["r0"] and abs(c - COL_AXIS) < COL_HALF}
props = [p for p in props if (round(p["x"]), round(p["y"])) not in UNDER]

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
