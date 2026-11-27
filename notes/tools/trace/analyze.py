import json, sys, collections
p = sys.argv[1]
d = json.load(open(p))
ev = d['traceEvents'] if isinstance(d, dict) else d
print('events', len(ev))
# --- GC and top-level event durations on the renderer main thread
names = collections.Counter(); dur = collections.Counter(); maxd = collections.Counter()
threads = {}
for e in ev:
    if e.get('ph') == 'M' and e.get('name') == 'thread_name':
        threads[(e['pid'], e['tid'])] = e['args'].get('name')
main = [k for k, v in threads.items() if v == 'CrRendererMain']
print('main threads', main)
for e in ev:
    if e.get('ph') == 'X' and (e.get('pid'), e.get('tid')) in main:
        n = e['name']; dd = e.get('dur', 0) / 1000
        names[n] += 1; dur[n] += dd; maxd[n] = max(maxd[n], dd)
print('\nTop main-thread events by total ms:')
for n, t in dur.most_common(22):
    print(f'  {t:9.1f} ms  x{names[n]:6d}  max {maxd[n]:7.1f}  {n}')
# --- CPU profile samples: self time by function
nodes = {}; samples = []; deltas = []
for e in ev:
    if e.get('name') in ('ProfileChunk',):
        c = e['args']['data'].get('cpuProfile', {})
        for nd in c.get('nodes', []) or []:
            nodes[nd['id']] = nd
        samples += c.get('samples', []) or []
        deltas += e['args']['data'].get('timeDeltas', []) or []
self_t = collections.Counter()
for s, dt in zip(samples, deltas[1:] + [0]):
    nd = nodes.get(s)
    if not nd: continue
    cf = nd.get('callFrame', {})
    key = f"{cf.get('functionName') or '(anon)'}  {cf.get('url','').split('/')[-1]}:{cf.get('lineNumber',-1)+1}"
    self_t[key] += dt / 1000
tot = sum(self_t.values())
print(f'\nCPU samples: {len(samples)}, sampled ms {tot:.0f}')
print('Top self time:')
for k, t in self_t.most_common(30):
    print(f'  {t:8.1f} ms  {100*t/max(tot,1):5.1f}%  {k}')
