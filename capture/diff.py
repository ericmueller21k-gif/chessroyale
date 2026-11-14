import json,sys
m=json.load(open(sys.argv[1]))
keys=list(m)
base=m[keys[0]]
keep=[".board-row > .board-wrap",".mv-side",".under-board",".bp",".you-pawn",".dk-mate-art",".gk-unit",".boss-bar",".tower-side",".bp-tower",".gchat-field",".boss-dock"]
print("viewport",base['vw'],base['vh'])
for k in keys:
  d=m[k]; out=[]
  if d['scrollW']>d['vw'] or d['scrollH']>d['vh']: out.append(f"SCROLL {d['scrollW']}x{d['scrollH']}")
  for s in keep:
    a=base['boxes'].get(s,[]); b=d['boxes'].get(s,[])
    if len(a)!=len(b): out.append(f"{s}: count {len(a)}->{len(b)}")
    else:
      for i,(x,y) in enumerate(zip(a,b)):
        if max(abs(p-q) for p,q in zip(x,y))>2: out.append(f"{s}[{i}] {x}->{y}")
  bub=[(b['cls'][:25],b['text'][:30],b['box']) for b in d['bubbles'] if 'bubble' in b['cls'] or 'cs-say' in b['cls']]
  figs=[(f['parent'][:28],f['box'],f['drawnTop'],f['drawnX']) for f in d['figs']]
  print(f"\n## {k} phase={d['phase']} form={d['form']} step={d['step']} quads={d['quads']}")
  for o in out: print("  ",o)
  for b in bub: print("   bubble",b)
  for f in figs: print("   fig",f)
