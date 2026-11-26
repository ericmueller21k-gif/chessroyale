import json, base64, math, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
SP = sys.argv[1]; OUT = sys.argv[2]
geo = json.load(open(f'{SP}/shots/geo.json'))
d = json.load(open(f'{SP}/mate5.json')); W, H = d['w'], d['h']; FX, FY = d['foot']
F = lambda s, b=False: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if b else ''), s)
MONO = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf', s)
def frame(n, i):
    return Image.frombytes('RGBA', (W, H), base64.b64decode(d['anims'][n][i]['data']))
def sprite(base, n, i, foot, s, flip=False, alpha=1.0):
    im = frame(n, i)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize((W*s, H*s), Image.NEAREST)
    if alpha < 1:
        a = im.getchannel('A').point(lambda v: int(v*alpha)); im.putalpha(a)
    fx = (W - FX if flip else FX)
    base.alpha_composite(im, (int(foot[0] - fx*s), int(foot[1] - FY*s)))
def hand_of(n, i, foot, s):
    im = frame(n, i); px = im.load(); best = None
    for y in range(85+18, H):
        for x in range(75, W):
            r,g,b,a = px[x,y]
            if a and (r,g,b) == (0xe4,0xff,0xff): best = (x,y); break
        if best: break
    return (foot[0] + (best[0]-FX)*s, foot[1] + (best[1]-FY)*s)
def bolt(dr, a, b, w, seed=3):
    random.seed(seed); n = 14; pts = [a]
    for k in range(1, n):
        t = k/n; x = a[0]+(b[0]-a[0])*t; y = a[1]+(b[1]-a[1])*t
        L = math.hypot(b[0]-a[0], b[1]-a[1]); nx, ny = -(b[1]-a[1])/L, (b[0]-a[0])/L
        j = random.uniform(-1, 1)*w*2.2; pts.append((x+nx*j, y+ny*j))
    pts.append(b)
    dr.line(pts, fill=(18,156,195,255), width=int(w*2.2), joint='curve')
    dr.line(pts, fill=(88,230,255,255), width=int(w*1.3), joint='curve')
    dr.line(pts, fill=(228,255,255,255), width=max(2,int(w*0.5)), joint='curve')
def glow(base, c, r, col):
    g = Image.new('RGBA', base.size, (0,0,0,0)); ImageDraw.Draw(g).ellipse([c[0]-r, c[1]-r, c[0]+r, c[1]+r], fill=col)
    base.alpha_composite(g.filter(ImageFilter.GaussianBlur(r/2.5)))
def say(dr, at, text, k, tail='down'):
    f = MONO(int(11*k)); lines = text.split('\n')
    tw = max(dr.textlength(l, font=f) for l in lines); th = len(lines)*f.size*1.25
    x, y = at; pad = 7*k
    box = [x, y, x+tw+2*pad, y+th+2*pad]
    dr.rectangle([box[0]+3*k, box[1]+3*k, box[2]+3*k, box[3]+3*k], fill=(20,22,27,255))
    dr.rectangle(box, fill=(255,248,225,255), outline=(20,22,27,255), width=int(2*k))
    for i, l in enumerate(lines): dr.text((x+pad, y+pad+i*f.size*1.25), l, font=f, fill=(20,22,27,255))
    return box
def banner(base, cx, cy, text, k):
    dr = ImageDraw.Draw(base); f = F(int(30*k), True); tw = dr.textlength(text, font=f)
    h = 52*k; dr.rectangle([cx-tw/2-40*k, cy-h/2, cx+tw/2+40*k, cy+h/2], fill=(20,22,27,235), outline=(242,193,78,255), width=int(3*k))
    dr.text((cx-tw/2+2*k, cy-f.size/2-4*k+2*k), text, font=f, fill=(0,0,0,255))
    dr.text((cx-tw/2, cy-f.size/2-4*k), text, font=f, fill=(242,193,78,255))
def dim(base, a=110):
    base.alpha_composite(Image.new('RGBA', base.size, (10,12,16,a)))

def panels(name):
    g = geo[name]; k = 2  # screenshot device px per CSS px
    shot = Image.open(f'{SP}/shots/{name}.png').convert('RGBA')
    bx, by, bw = g['board']['x']*k, g['board']['y']*k, g['board']['width']*k; sq = bw/8
    S = 2 if name == 'phone' else 3
    cen = (bx + bw/2, by + bw/2)
    sqc = lambda f, r: (bx + (f+0.5)*sq, by + (7.5-r)*sq)
    king = sqc(4, 0); their_king = sqc(4, 7)
    foot = (cen[0] - 14*S, cen[1] + 0.9*sq)
    ch = g['char']; home = ((ch['x']+ch['width']*0.45)*k, (ch['y']+ch['height']*0.97)*k)
    out = []
    # His home spot emptied while he's on the board (beats 2-6): painted over with the ground beside it.
    away = shot.copy(); da = ImageDraw.Draw(away)
    x0, y0, x1, y1 = (ch['x']-14)*k, (ch['y']-12)*k, (ch['x']+ch['width']+4)*k, (ch['y']+ch['height']+2)*k
    if name == 'phone':
        for yy in range(int(y0), int(y1)):
            da.line([(x0, yy), (x1, yy)], fill=shot.getpixel((280*k, yy)))
    else:
        da.rectangle([x0-70*k, y0-60*k, bx-2*k, y1+12*k], fill=shot.getpixel((int(x0-80*k), int(y0))))
    clean = shot; shot = away
    # 1: the pause
    p = clean.copy(); dim(p, 70); dr = ImageDraw.Draw(p)
    dr.rectangle([their_king[0]-sq/2, their_king[1]-sq/2, their_king[0]+sq/2, their_king[1]+sq/2], outline=(242,193,78,255), width=4*k)
    glow(p, their_king, sq*0.6, (242,193,78,120))
    banner(p, cen[0], cen[1], 'CHECKMATE?', k*(0.8 if name=='phone' else 1))
    out.append(p)
    # 2: the jump onto the center, the collapse
    p = shot.copy(); dim(p, 70); dr = ImageDraw.Draw(p)
    mid = ((home[0]+foot[0])/2, min(home[1], foot[1]) - 2.2*sq)
    pts = [((1-t)**2*home[0]+2*(1-t)*t*mid[0]+t*t*foot[0], (1-t)**2*home[1]+2*(1-t)*t*mid[1]+t*t*foot[1]) for t in [i/24 for i in range(25)]]
    for i in range(0, 24, 2): dr.line([pts[i], pts[i+1]], fill=(242,193,78,230), width=3*k)
    sprite(p, 'jump', 2, pts[12], S, alpha=0.55)
    sprite(p, 'land', 2, foot, S)
    out.append(p)
    # 3: the reach toward your king
    p = shot.copy(); dim(p, 70); dr = ImageDraw.Draw(p)
    sprite(p, 'reachingD60', 0, foot, S)
    h = hand_of('zapD60', 3, foot, S)
    for i in range(0, 20, 2):
        a = (h[0]+(king[0]-h[0])*i/20, h[1]+(king[1]-h[1])*i/20); b = (h[0]+(king[0]-h[0])*(i+1)/20, h[1]+(king[1]-h[1])*(i+1)/20)
        dr.line([a, b], fill=(88,230,255,200), width=2*k)
    dr.ellipse([king[0]-sq*0.48, king[1]-sq*0.48, king[0]+sq*0.48, king[1]+sq*0.48], outline=(88,230,255,255), width=3*k)
    out.append(p)
    # 4: the zap
    p = shot.copy(); dim(p, 90)
    sprite(p, 'zapD60', 3, foot, S)
    glow(p, king, sq*0.75, (88,230,255,200)); bolt(ImageDraw.Draw(p), h, king, 3*k)
    glow(p, h, 6*S, (228,255,255,220))
    out.append(p)
    # 5: his line, then the Dodge
    p = shot.copy(); dim(p, 90); dr = ImageDraw.Draw(p)
    sprite(p, 'reachingD60', 0, foot, S)
    glow(p, king, sq*0.5, (88,230,255,150))
    say(dr, (cen[0]-(0 if name=='phone' else 10)*k, cen[1]-1.9*sq), "[his line: the rules\njob's, e.g.]\nNot... so fast.", k)
    banner(p, cen[0], by + bw - 0.9*sq if name=='phone' else by + bw*0.86, 'DODGE!', k*0.75)
    out.append(p)
    # 6: the win beat
    p = shot.copy(); dim(p, 70); dr = ImageDraw.Draw(p)
    sprite(p, 'ko', 0, (foot[0]+8*S, foot[1]), S)
    glow(p, king, sq*0.8, (242,193,78,190))
    banner(p, cen[0], by + 1.1*sq, 'YOU WIN!', k*(0.8 if name=='phone' else 1))
    out.append(p)
    return out

CAP = ['1  The pause on your mate', '2  He leaps onto the center and collapses', '3  He reaches toward your king', '4  The zap at your king', '5  His line, then the Dodge', '6  After a survived Dodge: the win beat']
NOTES = [
 'Board and clock freeze on your mating move;\nthe mated king ringed in gold. (Rules job: the\npause; this banner text is a placeholder.)',
 'jump: crouch, spring, tuck (3 frames); the leap\nis a CSS arc from his spot. land: squash, knees\nbuckle, slumped on his knees (3), lens goes dark.',
 'Head comes up, lens relights, near arm out\n(2 frames) at -30/0/30/60 degrees, mirrored\nfor a king on his left.',
 'Hand charges (3 frames), flash + bolt off his\nclaws; across the board: a bolt to your king\n(his Lock-on Shot round art, cyan).',
 "His text box (the existing BossCharacter\nbox) with the rules job's line; then the Dodge\nexactly as today (king to e4/e5, clones).",
 'out: lens sputters, slumps, falls flat on his\nback (5 frames); ko loops with dizzy stars.\nYour king glows gold, the cut-in banner, results.',
]
ph = [im.resize((390, 844), Image.LANCZOS) for im in panels('phone')]
dk = [im.resize((768, 365), Image.LANCZOS) for im in panels('desktop')]
pad, capH = 16, 96
Wd = 6*390 + 7*pad
Ht = 60 + capH + 844 + pad + 2*(capH + 365) + 3*pad + 40
sb = Image.new('RGB', (Wd, Ht), (20,22,27)); dr = ImageDraw.Draw(sb)
dr.text((pad, 14), "Chandy's checkmate way into Dodge: storyboard (phone 390x844 above, computer 1536x730 below, at half size)", font=F(22, True), fill=(242,193,78))
y = 60
for i in range(6):
    x = pad + i*(390+pad)
    dr.text((x, y), CAP[i], font=F(15, True), fill=(242,193,78))
    dr.multiline_text((x, y+22), NOTES[i], font=F(11), fill=(200,205,215), spacing=3)
    sb.paste(ph[i], (x, y+capH))
y += capH + 844 + pad
for i in range(6):
    col, row = i % 3, i // 3
    x = pad + col*(768+pad) ; yy = y + row*(capH+365+pad)
    dr.text((x, yy+capH-26), CAP[i], font=F(15, True), fill=(242,193,78))
    sb.paste(dk[i], (x, yy+capH))
dr.text((pad, Ht-30), 'Screens: a real battle (start position, layout only; the bar names the borrowed battle). Sprites: the new poses, rifle fully upgraded, at 1 CSS px (phone) and 1.5 CSS px (computer) per art pixel. Bolts, glows and banners are mockup paint for the beats.', font=F(12), fill=(150,155,170))
sb.save(OUT); print(sb.size)
