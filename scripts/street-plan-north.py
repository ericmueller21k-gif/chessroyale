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

# ---- The north edge (Nov 5, later; Eric: "There's nothing behind it. It's at the end of the map … it's a solid back wall … the most back
# thing is the Colosseum, with gates running along and then exits out of the gates into the town … beyond that you can add housing
# again"). Brief: notes/briefs/brief-street-north-edge.md. From round 5's 46 x 46 plan above to a 54 x 54 one:
# - ONE BACK LINE at y = 42.5 (round 5's row 34's north edge, 8 rows on): where the Colosseum's front meets the plaza and the homes beside
#   the plaza (Boingo's, Babur's, Big Boy's, Dash's) back onto it. A solid wall runs along it the whole way round (east-west wraps), but
#   for the Colosseum. North of it: the Colosseum (its oval, the arena inside) and a meadow nobody walks or sees but from high up; a few
#   trees behind the plaza's stretch of the wall, their tops over it. No street, lot, home or tower.
# - UPPER STREET AND ITS HOMES MOVE SOUTH: the map grows 8 rows south (a new street, Meadow Street, rows 4..6, between the closing row
#   and South Street; three squares wide, so South Street's south side has its sidewalk, row 11, as every street has) and, as the world is square (camera.ts N), 8 columns east (copies of column 42, just west of Seam Avenue, which
#   moves to columns 52, 53, 0, 1: every street and row runs 8 squares longer east). Hopper's, Wrangler's, Moo's and Hollow's lots
#   stand on Meadow Street's north side at their old columns, fronts south (rows 8..10), backed by a row facing South Street (row 10), as
#   Timber's block is; a lane (columns 21..24) crosses their block on the promenade's line, and Seam Avenue now runs from Meadow Street to
#   Colosseum Row.
# - THE PLAZA (columns 13..32 before the Colosseum) is framed by a wall along its front (row 39, Colosseum Row's north sidewalk there)
#   with three open gateways out onto Colosseum Row: one square at column 15, the grand one on the promenade's line (21..24), one square
#   at column 30. You walk on rows 40..41; row 42 is the plinths' row against the back wall (the statues, the chess pieces).
# - THE COLOSSEUM's ground is still 12 x 12 (columns 17..28, rows 42..53, its top row the north edge); street.ts builds its oval ring of
#   wall faces (houses/coliseum-ring.ts), the ground under the oval the arena's.
OLD_N = N
N = 54
ADD_C = 8  # columns inserted after column 42
ADD_R = 8  # rows inserted after row 3 (Meadow Street's block)
LINE = 42.5
def mc(c):
    """Round 5's column c (0..45) here."""
    return c + ADD_C if c >= 43 else c
def mr(r):
    """Round 5's row r here (rows north of the line are gone)."""
    return r + ADD_R if r >= 4 else r
def mx(x):
    return x + ADD_C if round(x) >= 43 else x
def my(y):
    return y + ADD_R if round(y) >= 4 else y

# The Colosseum's oval (coliseum-ring.ts has the same numbers: its middle and half axes; the portal before it).
OVAL = {"cx": 22.5, "cy": 47.6, "a": 7.4, "b": 5.9}
def in_oval(c, r):
    return ((c - OVAL["cx"]) / OVAL["a"]) ** 2 + ((r - OVAL["cy"]) / OVAL["b"]) ** 2 <= 1.0

old_g = out["ground"]
wide = [row[:43] + row[42] * ADD_C + row[43:] for row in old_g]
AVE_C = [mc(c) for c in (44, 45, 0, 1)]   # Seam Avenue's columns here: 52, 53, 0, 1
AVE_SW = [mc(43), 2]                       # its sidewalks: 51 and 2
LANE = [21, 22, 23, 24]                    # the promenade's columns
g = []
for r in range(N):
    if r <= 3:
        g.append(list(wide[r]))
    elif r <= 6:
        g.append(["#"] * N)  # Meadow Street (and Seam Avenue crossing it)
    elif r == 7 or r == 11:
        # Meadow Street's north sidewalk and South Street's south one. (Without it, looking along South Street, its south row stood at
        # the street's edge, so near the camera that the fronts the near cut leaves out showed sky beside you.)
        g.append(["#" if c in AVE_C else "=" for c in range(N)])
    elif r <= 10:
        g.append(["#" if c in AVE_C else "=" if c in AVE_SW or c in LANE else "L" for c in range(N)])
    elif r <= 42:
        g.append(list(wide[r - ADD_R]))
    else:
        g.append(["A" if in_oval(c, r) else "g" for c in range(N)])
# Seam Avenue ends at Colosseum Row: north of it (rows 39..42) its columns are the row's sidewalk and lots, as either side.
for c in AVE_C + AVE_SW:
    g[39][c] = "="
    for r in (40, 41, 42):
        g[r][c] = "L"
# The plaza: the front wall along row 39 ("W": a wall's or a plinth's square, paved, not walked on, not in the way of a look), its
# gateways open; rows 40..41 paved; row 42 the plinths' row, the Colosseum's ground where its oval reaches.
GATES = [15] + LANE + [30]
for c in range(13, 33):
    g[39][c] = "=" if c in GATES else "W"
    g[40][c] = g[41][c] = "="
    g[42][c] = "A" if in_oval(c, 42) or c in LANE else "W"
ground = ["".join(row) for row in g]
assert all(len(row) == N for row in ground) and len(ground) == N

key = dict(out["groundKey"], W="WALL")
streets = []
for s in out["streets"]:
    s = dict(s)
    if s["id"] == "upper-st":
        continue
    if s["id"] == "seam-ave":
        s.update(c0=mc(s["c0"]), c1=mc(s["c0"]) + 3, r0=4, r1=mr(30))
    else:
        span = (s["c1"] - s["c0"]) + (ADD_C if s["c1"] >= 43 else 0)
        s.update(c1=s["c0"] + span, r0=mr(s["r0"]), r1=mr(s["r1"]))
    streets.append(s)
streets.insert(0, {"id": "meadow-st", "name": "Meadow Street", "axis": "EW", "c0": 0, "c1": N - 1, "r0": 4, "r1": 6, "cam": 0})
for s in streets:
    if s["id"] == "south-st":
        s["c1"] = N - 1
    if s["id"] == "colosseum-row":
        s["c1"] = N - 1

MOVED = {"hopper", "pig", "moo", "hollow"}
lots = []
for l in out["lots"]:
    l = dict(l)
    if l["kind"] == "wall":
        continue
    if l["kind"] == "home" and l["id"] in MOVED:
        # To Meadow Street's north side, its old column: its lot rows 8..10, its door and rest square on the sidewalk (row 7).
        l.update(r0=8, street="meadow-st", door={"c": l["door"]["c"], "r": 7}, rest={"c": l["rest"]["c"], "r": 7})
        w = l["wander"]
        l["wander"] = {"x0": w["x0"], "x1": w["x1"], "y0": 6.7, "y1": 7.85}
    else:
        l["c0"] = mc(l["c0"])
        l["r0"] = mr(l["r0"])
        for k in ("door", "rest"):
            if k in l:
                l[k] = {"c": mc(l[k]["c"]), "r": mr(l[k]["r"])}
        if "wander" in l:
            w = l["wander"]
            l["wander"] = {"x0": w["x0"], "x1": w["x1"], "y0": my(w["y0"]), "y1": my(w["y1"])}
    lots.append(l)
assert all(l["r0"] + l["d"] - 1 < LINE for l in lots), "no lot past the line"

def wall2(name, c0, r0, w, inset, h, depth, arches, crest=False):
    """A wall's lot: its squares c0..c0 + w - 1 on row r0, facing south, its front line `inset` into the row; its open arches (px from its left: middle, width, height)."""
    return {"kind": "wall", "id": "wall", "v": 0, "c0": c0, "r0": r0, "w": w, "d": 1, "facing": "S", "street": "plaza", "name": name,
            "inset": inset, "depth": depth, "wall": {"w": w, "h": h, "gate": None, "depth": depth, "arches": arches, "crest": crest}}
SQ = 37
def arch_at(c, c0, w=30, h=66):
    return {"x": round((c - c0 + 0.5) * SQ), "w": w, "h": h}
# The plaza's front wall, its three gateways: the west and east ones a square wide, the grand one four (the promenade's).
lots.append(wall2("The plaza's west wall", 13, 39, 8, 0.3, 96, 0.4, [arch_at(15, 13)]))
lots.append(wall2("The plaza's grand gateway", 21, 39, 4, 0.3, 150, 0.4, [{"x": 74, "w": 116, "h": 104}], True))
lots.append(wall2("The plaza's east wall", 25, 39, 8, 0.3, 96, 0.4, [arch_at(30, 25)]))
# The back wall on the line, the whole way round but the Colosseum: from column 26 east round the wrap to column 19, in stretches of six.
# (Its oval meets the line at x = 18.9 and 26.1, and is at x = 18.0 and 27.0 by the wall's back, half a square on: each end of the wall
# runs on under the ring's seats, so no gap between the wall and the ring shows the meadow behind.)
BACK = []
c = 26
while c <= 19 + N:
    w = min(6, 19 + N - c + 1)
    BACK.append((c, w))
    c += w
for i, (c0, w) in enumerate(BACK):
    lots.append(wall2(f"The back wall ({i + 1})", c0 % N, 43, w, 0.0, 148, 0.5, []))

props = []
for p in out["props"]:
    if p["y"] > 34.5 or (p["kind"] == "lamp" and (p["y"] == 3 or (round(p["x"]) in (2, 43) and round(p["y"]) >= 31))):
        continue
    if round(p["y"]) == 34 and 13 <= round(p["x"]) <= 32:
        continue  # round 5's grove trees beside the Colosseum's front
    props.append(dict(p, x=mx(p["x"]), y=my(p["y"])))
# Lamps: every 6 squares along the closing row's sidewalk (row 3); on Meadow Street's north sidewalk where Upper Street had them
# (clear of the homes' doors and rest squares), and either side of the lane; Seam Avenue's west sidewalk as South Street's.
for c in range(1, N, 6):
    props.append({"kind": "lamp", "x": c, "y": 3, "v": 0})
for c in (4, 10, 20, 25, 34, 40, mc(43)):
    props.append({"kind": "lamp", "x": c, "y": 7, "v": 0})
props.append({"kind": "lamp", "x": mc(43), "y": 39, "v": 0})
# The plinths' row against the back wall: the statues (world.ts STATUES: their squares are the plaza's before them; drawn here) and the
# chess pieces: the bronze queen and king by the portal, a marble bishop and rook past the marble statue, a knight and a pawn past the
# bronze one (coliseum-ring.ts PIECES: v is the piece).
PIECES = ["queen", "king", "bishop", "rook", "knight", "pawn"]
for kind, v, x in [("piece", 0, 19.45), ("piece", 1, 25.55), ("statue", 0, 17), ("statue", 1, 28), ("piece", 2, 15.3), ("piece", 3, 13.6), ("piece", 4, 29.7), ("piece", 5, 31.4)]:
    props.append({"kind": kind, "x": x, "y": 42.05, "v": v})
# Treetops over the plaza's stretches of the back wall: a row of trees behind it, either side of the Colosseum.
for c in list(range(12, 17, 2)) + list(range(29, 34, 2)):
    props.append({"kind": "tree", "x": c, "y": 44, "v": c % 3})
assert all(p["y"] <= LINE or (p["kind"] == "tree" and p["y"] == 44) for p in props), "nothing north of the line but the trees"

park = dict(out["park"])
park["r1"] = mr(park["r1"])
park["tables"] = [{"c": t["c"], "r": mr(t["r"])} for t in park["tables"]]
park["fountain"] = [{"c": t["c"], "r": mr(t["r"])} for t in park["fountain"]]
col = dict(out["coliseum"])
col["r0"] = mr(col["r0"])
col["statues"] = [{"c": t["c"], "r": mr(t["r"])} for t in col["statues"]]
col["gate"] = [{"c": t["c"], "r": mr(t["r"])} for t in col["gate"]]
col["oval"] = OVAL
col["line"] = LINE
assert col["r0"] + col["size"] - 1 == N - 1, "the Colosseum's top row is the north edge"

out = {
    "size": N,
    "conventions": out["conventions"].replace("row 45", f"row {N - 1}"),
    "wrap": out["wrap"],
    "ground": ground,
    "groundKey": key,
    "streets": streets,
    "start": {"c": out["start"]["c"], "r": mr(out["start"]["r"]), "heading": 0},
    "lots": lots,
    "park": park,
    "coliseum": col,
    "props": props,
}
json.dump(out, sys.stdout, indent=1)
sys.stdout.write("\n")
