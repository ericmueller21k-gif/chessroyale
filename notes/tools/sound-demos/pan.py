import numpy as np, wave, os, sys
SR=44100
def strike(buf,at,f,partials,level,glide=0.0):
    for mult,amp,dec in partials:
        n=int((dec+0.03)*SR); t=np.arange(n)/SR
        f0=f*mult*(1+glide); f1=f*mult
        fr=np.where(t<0.04, f0*(f1/f0)**(t/0.04), f1)
        ph=np.cumsum(fr)/SR
        a=level*amp
        g=np.where(t<0.004, 0.0001*(a/0.0001)**(t/0.004), a*(0.0001/a)**((t-0.004)/(dec-0.004)))
        g[t>dec]=0
        i=int(at*SR); seg=(np.sin(2*np.pi*ph)*g)[:len(buf)-i]; buf[i:i+len(seg)]+=seg
def biquad_bp(x,f,Q):
    w=2*np.pi*f/SR; al=np.sin(w)/(2*Q)
    b0,b1,b2=al,0,-al; a0,a1,a2=1+al,-2*np.cos(w),1-al
    y=np.zeros_like(x); x1=x2=y1=y2=0
    for i,v in enumerate(x):
        o=(b0*v+b1*x1+b2*x2-a1*y1-a2*y2)/a0; x2,x1=x1,v; y2,y1=y1,o; y[i]=o
    return y
rng=np.random.default_rng(3)
def tap(buf,at,f,level):
    n=int(0.015*SR); x=(rng.random(n)*2-1)*(1-np.arange(n)/n)**3
    y=biquad_bp(x,f,2)*level; i=int(at*SR); buf[i:i+n]+=y[:len(buf)-i]
PAN=[[1,1,0.5],[2,0.45,0.32],[3,0.18,0.18],[4.02,0.08,0.1]]
def pan(buf,t,f,l=1.0):
    strike(buf,t,f,PAN,0.16*l,glide=0.012); tap(buf,t,2400,0.08*l)
def N(name):
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    o=int(name[-1]); s=names[name[0]]+(1 if '#' in name else 0)
    return 440*2**((s+12*(o+1)-69)/12)
def save(buf,path):
    buf=buf/np.max(np.abs(buf))*0.85
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf*32767).astype(np.int16).tobytes())
out=sys.argv[1]
# Level-up options in the steel pan (the crowd pick's voice)
b=np.zeros(int(1.2*SR)); pan(b,0,N('G5'),0.9); pan(b,0.08,N('D6'),1.2); save(b,f'{out}/pan-1-ding-ding-fifth.wav')
b=np.zeros(int(1.4*SR))
for i,n in enumerate(['C6','E6','G6']): pan(b,i*0.085,N(n),0.9 if i<2 else 1.25)
save(b,f'{out}/pan-2-three-up.wav')
b=np.zeros(int(1.5*SR))
for i,n in enumerate(['G5','C6','E6','G6']): pan(b,i*0.06,N(n),0.8)
for n in ['C6','E6','G6','C7']: pan(b,0.3,N(n),0.75)
save(b,f'{out}/pan-3-run-into-chord.wav')
# XP fill pings: today's steps vs a smooth rise that caps
PING=[[1,1,0.07],[2.76,0.18,0.03],[5.4,0.06,0.015]]
dur=2.0; gap=0.042; times=np.arange(0,dur,gap)
scale=[1046.5,1174.7,1318.5,1568,1760,2093]
b=np.zeros(int((dur+0.3)*SR))
for t in times:
    k=t/dur; f=scale[min(len(scale)-1,int(k*len(scale)))]; strike(b,t,f,PING,0.065,glide=0.01)
save(b,f'{out}/fill-today-steps.wav')
b=np.zeros(int((dur+0.3)*SR))
for t in times:
    k=t/dur; rise=min(1,k/0.6)   # rises over the first 60% of the fill, then holds
    f=1046.5*2**((rise*(1-(1-rise)*0))*7/12*1.0)  # smooth, up a fifth (C6 to G6), then held
    f=1046.5*2**((1-(1-rise)**2)*7/12)            # eases into the cap
    strike(b,t,f,PING,0.065,glide=0.01)
save(b,f'{out}/fill-new-smooth-rise-then-hold.wav')
print('ok')
