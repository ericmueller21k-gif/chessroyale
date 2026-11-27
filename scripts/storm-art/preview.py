#!/usr/bin/env python3
"""
The storm's frames over a real screenshot, composited the way the game does it (one small canvas scaled up, the still frost under it):
stills and a looping GIF, for a look before anything is wired.

  python3 scripts/storm-art/preview.py still <cells-dir> <screenshot.png> <x,y,size,dpr> <out.png> [frame=0] [lead=none|fire|ice] [crop=x0,y0,x1,y1]
  python3 scripts/storm-art/preview.py gif   <cells-dir> <screenshot.png> <x,y,size,dpr> <out.gif> [lead] [crop] [width=390] [fps=15] [seconds=3]
"""
import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

MARGIN, CELL = 0.12, 0.68


def load(cells):
    fire = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "fire-*.png")))]
    ice = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(cells, "ice-*.png")))]
    frost = Image.open(os.path.join(cells, "frost.png")).convert("RGBA")
    return fire, ice, frost


def pm(img):
    a = np.asarray(img, np.float32) / 255
    a[..., :3] *= a[..., 3:4]
    return a


def over(dst, src, alpha=1.0):
    s = src * alpha
    return s + dst * (1 - s[..., 3:4])


def blend(frames, pos):
    """The loop at `pos` (in frames): two neighbors cross-faded, as the game plays it."""
    n = len(frames)
    i = int(np.floor(pos)) % n
    f = pos - np.floor(pos)
    return pm(frames[i]) * (1 - f) + pm(frames[(i + 1) % n]) * f


def scaled(layer, k):
    """A premultiplied layer scaled about its middle by k (the frame's own size kept)."""
    h, w = layer.shape[:2]
    img = Image.fromarray(np.clip(layer * 255 + 0.5, 0, 255).astype(np.uint8), "RGBa")
    big = img.resize((int(round(w * k)), int(round(h * k))), Image.BILINEAR)
    out = Image.new("RGBa", (w, h), (0, 0, 0, 0))
    out.paste(big, ((w - big.width) // 2, (h - big.height) // 2))
    return np.asarray(out, np.float32) / 255


def canvas(fire, ice, pos, lead):
    """One frame of the game's canvas (premultiplied, the frame's size): the two cells in their places, the leader stronger."""
    res = fire[0].height
    cw = fire[0].width
    n = len(fire)
    full = lambda cell, x: np.pad(cell, ((0, 0), (x, res - x - cw), (0, 0)))
    f = full(blend(fire, pos), 0)
    i = full(blend(ice, pos), res - cw)
    f2 = full(blend(fire, pos + n / 2), 0)
    i2 = full(blend(ice, pos + n / 2), res - cw)
    c = np.zeros((res, res, 4), np.float32)
    if lead == "fire":
        c = over(c, i, 0.8)
        c = over(c, scaled(f2, 0.985), 0.6)
        c = over(c, f, 1.0)
    elif lead == "ice":
        c = over(c, f, 0.8)
        c = over(c, scaled(i2, 0.985), 0.6)
        c = over(c, i, 1.0)
    else:
        c = over(c, i, 0.9)
        c = over(c, f, 0.9)
    return c


def compose(shot, box, c, frost, lead):
    x, y, size, dpr = box
    frame = int(round(size * (1 + 2 * MARGIN) * dpr))
    left = int(round((x - size * MARGIN) * dpr))
    top = int(round((y - size * MARGIN) * dpr))
    layer = Image.new("RGBa", (frame, frame), (0, 0, 0, 0))
    fw = int(round(frame * CELL))
    fr = frost.resize((fw, frame), Image.LANCZOS).convert("RGBa")
    # (The still frost under the moving frames, a little fainter on a fire turn.)
    a = np.asarray(fr, np.float32) / 255 * (0.75 if lead == "fire" else 1.0)
    layer.paste(Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), "RGBa"), (frame - fw, 0))
    up = Image.fromarray(np.clip(c * 255 + 0.5, 0, 255).astype(np.uint8), "RGBa").resize((frame, frame), Image.BILINEAR)
    base = np.asarray(layer, np.float32) / 255
    top_l = np.asarray(up, np.float32) / 255
    both = top_l + base * (1 - top_l[..., 3:4])
    out = np.asarray(shot.convert("RGB"), np.float32) / 255
    H, W = out.shape[:2]
    x0, y0, x1, y1 = max(left, 0), max(top, 0), min(left + frame, W), min(top + frame, H)
    part = both[y0 - top : y1 - top, x0 - left : x1 - left]
    out[y0:y1, x0:x1] = part[..., :3] + out[y0:y1, x0:x1] * (1 - part[..., 3:4])
    return Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8), "RGB")


def main():
    mode, cells, shot_path, box_s, out = sys.argv[1:6]
    rest = sys.argv[6:]
    opt = dict(a.split("=", 1) for a in rest if "=" in a)
    box = [float(v) for v in box_s.split(",")]
    fire, ice, frost = load(cells)
    shot = Image.open(shot_path)
    lead = opt.get("lead", "none")
    crop = [int(float(v) * box[3]) for v in opt["crop"].split(",")] if "crop" in opt else None
    if mode == "still":
        img = compose(shot, box, canvas(fire, ice, float(opt.get("frame", 0)), lead), frost, lead)
        (img.crop(crop) if crop else img).save(out)
        return
    fps = int(opt.get("fps", 15))
    seconds = float(opt.get("seconds", 3))
    width = int(opt.get("width", 390))
    n = len(fire)
    total = int(round(fps * seconds))
    with tempfile.TemporaryDirectory() as tmp:
        for k in range(total):
            img = compose(shot, box, canvas(fire, ice, k * n / total, lead), frost, lead)
            if crop:
                img = img.crop(crop)
            img.resize((width, int(round(img.height * width / img.width))), Image.LANCZOS).save(os.path.join(tmp, f"{k:04d}.png"))
        vf = "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"), "-vf", vf, "-loop", "0", out], check=True)
        if opt.get("mp4"):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-stream_loop", "2", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"), "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", "-pix_fmt", "yuv420p", "-crf", "16", opt["mp4"]], check=True)
    print(out, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main()
