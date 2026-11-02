# The sandstorm swept across a phone still (mockup): python3 -I scripts/boss-art/storm-view.py <dir with storm/s*.png, f*.png> <phone.png> <out.gif>
import sys
from PIL import Image
S = sys.argv[1]; bg = Image.open(sys.argv[2]).convert("RGBA"); out = sys.argv[3]
W, H = bg.size  # 780 x 1688 (phone at 2x device pixels)
K = 6  # 3x CSS = 6 device px per art pixel
st = [Image.open(f"{S}/storm/s{i}.png").convert("RGBA") for i in range(6)]
fr = [Image.open(f"{S}/storm/f{i}.png").convert("RGBA") for i in range(6)]
st = [s.resize((s.width * K, s.height * K), Image.NEAREST) for s in st]
fr = [f.resize((f.width * K, f.height * K), Image.NEAREST) for f in fr]
SW, FW, TH = st[0].width, fr[0].width, st[0].height
frames = []
def compose(i, lead, trail):
    # Storm covers [trail, lead): FRONT at the leading edge (right), mirrored FRONT at the trailing edge (left).
    im = bg.copy()
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s, f = st[i % 6], fr[i % 6]
    fm = f.transpose(Image.FLIP_LEFT_RIGHT)
    a, b = trail + (FW if trail > -10**6 else 0), lead - FW
    x = a - ((a) % SW) if a > 0 else -SW
    a = max(a, -SW); b = min(b, W + SW)
    for y in range(0, H, TH):
        xx = (a // SW) * SW
        while xx < b:
            layer.alpha_composite(s, (xx, y))
            xx += SW
    # crop the storm band to [a, b)
    mask = Image.new("L", (W, H), 0); mask.paste(255, (max(a, 0), 0, max(min(b, W), 0), H))
    band = Image.new("RGBA", (W, H), (0, 0, 0, 0)); band.paste(layer, (0, 0), mask)
    for y in range(0, H, TH):
        band.alpha_composite(f, (b, y)) if b < W + 1 else None
        if trail > -10**6: band.alpha_composite(fm, (trail, y))
    im.alpha_composite(band)
    return im.convert("RGB")
NO = -10**7
n = 0
steps = 9
for k in range(steps):  # in
    lead = int(-FW + (W + 2 * FW) * (k + 1) / steps)
    frames.append(compose(n, lead, NO)); n += 1
for k in range(4):  # covered
    frames.append(compose(n, W + 2 * FW, NO)); n += 1
for k in range(steps):  # out
    trail = int(-FW + (W + FW) * (k + 1) / steps)
    frames.append(compose(n, W + 2 * FW, trail)); n += 1
frames.append(bg.convert("RGB"))
small = [f.resize((W // 2, H // 2), Image.NEAREST) for f in frames]
small[0].save(out, save_all=True, append_images=small[1:], duration=[70] * (len(small) - 1) + [900], loop=0)
small[10].save(out.replace(".gif", "-covered.png"))
small[4].save(out.replace(".gif", "-sweep.png"))
print(len(frames))
