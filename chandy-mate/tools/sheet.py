import json, base64, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
S = int(sys.argv[3]) if len(sys.argv) > 3 else 3
d = json.load(open(src)); W, H = d['w'], d['h']
def img(name, i):
    f = d['anims'][name][i]
    return Image.frombytes('RGBA', (W, H), base64.b64decode(f['data'])), f
rows = [
  ('jump', [('jump',0),('jump',1),('jump',2)]),
  ('land + slump', [('land',0),('land',1),('land',2),('slumped',1)]),
  ('reach (level) + zap', [('reach0',0),('reach0',1),('zap0',1),('zap0',2),('zap0',3),('zap0',4)]),
  ('reach dirs', [('reachingU30',0),('reaching0',0),('reachingD30',0),('reachingD60',0)]),
  ('zap dirs', [('zapU30',3),('zap0',3),('zapD30',3),('zapD60',3)]),
  ('win: out + KO', [('out',0),('out',1),('out',2),('out',3),('ko',0),('ko',1)]),
]
cols = max(len(r[1]) for r in rows); pad = 8; lab = 22
sheet = Image.new('RGB', (cols*(W*S+pad)+pad, len(rows)*(H*S+pad+lab)+pad), '#14161b')
dr = ImageDraw.Draw(sheet)
for ri,(title, fr) in enumerate(rows):
    y = pad + ri*(H*S+pad+lab)
    for ci,(n,i) in enumerate(fr):
        im, f = img(n,i)
        x = pad + ci*(W*S+pad)
        dr.rectangle([x, y+lab, x+W*S-1, y+lab+H*S-1], outline='#2a2e38')
        sheet.paste(im.resize((W*S,H*S), Image.NEAREST), (x, y+lab), im.resize((W*S,H*S), Image.NEAREST))
        dr.text((x+2, y+4), f"{n}[{i+1}] {f['ms']}ms{(' cue:'+f['cue']) if f.get('cue') else ''}", fill='#f2c14e')
sheet.save(out)
print(sheet.size)
