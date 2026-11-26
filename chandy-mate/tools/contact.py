import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.35; cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
crop = tuple(map(int, sys.argv[5].split(','))) if len(sys.argv) > 5 else None
fs = sorted(glob.glob(d + '/*.*'))
ims = []
for f in fs:
    im = Image.open(f).convert('RGB')
    if crop: im = im.crop(crop)
    ims.append((os.path.basename(f), im.resize((int(im.width*scale), int(im.height*scale)))))
w, h = ims[0][1].size
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (cols*(w+4), rows*(h+16)), '#222')
dr = ImageDraw.Draw(sheet)
for i,(n,im) in enumerate(ims):
    x, y = (i%cols)*(w+4), (i//cols)*(h+16)
    sheet.paste(im, (x, y+14)); dr.text((x+2, y+1), n, fill='#ff0')
sheet.save(out); print(sheet.size)
