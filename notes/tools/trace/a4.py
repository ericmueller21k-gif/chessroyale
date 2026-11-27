import json, sys, collections
d = json.load(open(sys.argv[1])); ev = d['traceEvents'] if isinstance(d, dict) else d
nodes = {}; samples = []
for e in ev:
    if e.get('name') == 'ProfileChunk' and e['id'] == '0x5':
        c = e['args']['data'].get('cpuProfile', {})
        for nd in c.get('nodes', []) or []: nodes[nd['id']] = nd
        samples += list(zip(c.get('samples', []) or [], e['args']['data'].get('timeDeltas', []) or []))
parent = {nid: nd.get('parent') for nid, nd in nodes.items()}
def cf(n): c = nodes[n].get('callFrame', {}); return (c.get('functionName') or '(anon)', c.get('url', '').split('/')[-1], c.get('lineNumber', -1) + 1, c.get('columnNumber', -1) + 1)
chains = collections.Counter(); bytop = collections.Counter()
for sid, dt in samples:
    if sid not in nodes: continue
    f = cf(sid)
    if 'you-look' not in f[1]: continue
    # chain up to 8 frames
    ch = []; n = sid
    while n is not None and len(ch) < 14:
        ch.append(cf(n)); n = parent.get(n)
    names = [f"{x[0]}@{x[1].split('-')[0]}:{x[3]}" for x in ch]
    # first frame outside you-look
    out = next((x for x in ch if 'you-look' not in x[1] and x[1]), None)
    bytop[f"{out[0]} {out[1].split('-')[0]}:{out[2]}:{out[3]}" if out else '?'] += dt / 1000
    chains[' < '.join(names[:9])] += dt / 1000
print('you-look time by first caller outside it:')
for k, v in bytop.most_common(10): print(f'  {v:7.1f} ms  {k}')
print('\nTop chains:')
for k, v in chains.most_common(8): print(f'  {v:7.1f} ms  {k}')
