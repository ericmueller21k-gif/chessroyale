import json, sys, collections
d = json.load(open(sys.argv[1])); ev = d['traceEvents'] if isinstance(d, dict) else d
threads = {(e['pid'], e['tid']): e['args'].get('name') for e in ev if e.get('ph') == 'M' and e.get('name') == 'thread_name'}
MAIN = [k for k, v in threads.items() if v == 'CrRendererMain'][0]
# GC events anywhere
gc = collections.defaultdict(lambda: [0, 0.0, 0.0])
for e in ev:
    n = e.get('name', '')
    if ('GC' in n or 'Scavenge' in n or 'MarkCompact' in n) and e.get('ph') in ('X', 'B'):
        k = (threads.get((e.get('pid'), e.get('tid')), '?'), n)
        g = gc[k]; g[0] += 1; dd = e.get('dur', 0) / 1000; g[1] += dd; g[2] = max(g[2], dd)
print('GC events (thread, name): count, total ms, max ms')
for k, v in sorted(gc.items(), key=lambda x: -x[1][1])[:14]:
    print(f'  {v[0]:5d} {v[1]:8.1f} {v[2]:7.1f}  {k}')
# per-thread sampled self time
prof_tid = {}
for e in ev:
    if e.get('name') == 'Profile':
        prof_tid[e['id']] = threads.get((e['pid'], e['tid']), str(e['tid']))
nodes = collections.defaultdict(dict); acc = collections.defaultdict(collections.Counter)
for e in ev:
    if e.get('name') == 'ProfileChunk':
        pid = e['id']; c = e['args']['data'].get('cpuProfile', {})
        for nd in c.get('nodes', []) or []: nodes[pid][nd['id']] = nd
        s = c.get('samples', []) or []; dt = e['args']['data'].get('timeDeltas', []) or []
        for sid, t in zip(s, dt):
            nd = nodes[pid].get(sid); cf = (nd or {}).get('callFrame', {})
            acc[pid][f"{cf.get('functionName') or '(anon)'} {cf.get('url','').split('/')[-1]}:{cf.get('lineNumber',-1)+1}"] += t / 1000
for pid, c in acc.items():
    tot = sum(c.values()); idle = c.get('(idle) :0', 0)
    print(f'\nProfile {pid} thread={prof_tid.get(pid)} sampled {tot:.0f} ms, busy {tot-idle:.0f} ms')
    for k, t in c.most_common(18):
        if k.startswith('(idle)'): continue
        print(f'   {t:7.1f}  {k}')
# long main-thread tasks with what they contain
print('\nMain-thread RunTask > 35 ms (start s, ms, biggest children):')
xs = [e for e in ev if e.get('ph') == 'X' and (e.get('pid'), e.get('tid')) == MAIN]
xs.sort(key=lambda e: e['ts'])
t0 = xs[0]['ts']
long = [e for e in xs if e['name'] == 'RunTask' and e.get('dur', 0) > 35000]
for L in long[:25]:
    a, b = L['ts'], L['ts'] + L['dur']
    kids = collections.Counter()
    for e in xs:
        if a <= e['ts'] < b and e is not L and e['name'] not in ('RunTask',):
            kids[e['name']] = max(kids[e['name']], e.get('dur', 0) / 1000)
    print(f"  {(a-t0)/1e6:6.2f}s {L['dur']/1000:6.1f}ms  " + ', '.join(f'{n} {v:.0f}' for n, v in kids.most_common(5)))
