import json, sys, collections
d = json.load(open(sys.argv[1])); ev = d['traceEvents'] if isinstance(d, dict) else d
nodes = {}; tl = []  # (time_ms, fname, file)
start = None
for e in ev:
    if e.get('name') == 'Profile' and e['id'] == '0x5': start = e['args']['data'].get('startTime')
t = start or 0
for e in ev:
    if e.get('name') == 'ProfileChunk' and e['id'] == '0x5':
        c = e['args']['data'].get('cpuProfile', {})
        for nd in c.get('nodes', []) or []: nodes[nd['id']] = nd
        for sid, dt in zip(c.get('samples', []) or [], e['args']['data'].get('timeDeltas', []) or []):
            t += dt; nd = nodes.get(sid); cf = (nd or {}).get('callFrame', {})
            tl.append((t / 1000, cf.get('functionName') or '(anon)', cf.get('url', '').split('/')[-1], dt / 1000))
tl.sort(); t0 = tl[0][0]
groups = {'paint(you-look)': lambda f, u: 'you-look' in u, 'Town js': lambda f, u: u.startswith('Town-'), '(program)': lambda f, u: f == '(program)', 'idle': lambda f, u: f == '(idle)', 'gpu calls': lambda f, u: f in ('bufferSubData', 'drawImage', 'texSubImage2D', 'createImageBitmap', 'drawElements', 'bufferData')}
bins = collections.defaultdict(collections.Counter)
for (tm, f, u, dt) in tl:
    b = int((tm - t0) / 1000)
    g = next((k for k, fn in groups.items() if fn(f, u)), 'other')
    bins[b][g] += dt
print('sec  ' + '  '.join(f'{k:>15}' for k in list(groups) + ['other']))
for b in sorted(bins):
    print(f'{b:3d}  ' + '  '.join(f'{bins[b][k]:15.0f}' for k in list(groups) + ['other']))
# which you-look functions and their callers' top (stack root names) in seconds 3+
callers = collections.Counter()
