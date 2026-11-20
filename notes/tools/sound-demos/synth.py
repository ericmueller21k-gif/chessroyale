import numpy as np, wave, sys, os
SR=44100
def env(n, a, d, s, r, sus_len):
    t=np.arange(n)/SR; e=np.zeros(n)
    A=int(a*SR); D=int(d*SR); S_=int(sus_len*SR); R=int(r*SR)
    i=0
    seg=min(A,n-i); e[i:i+seg]=np.linspace(0,1,seg,endpoint=False); i+=seg
    seg=min(D,n-i); e[i:i+seg]=np.linspace(1,s,seg,endpoint=False); i+=seg
    seg=min(S_,n-i); e[i:i+seg]=s; i+=seg
    seg=min(R,n-i); e[i:i+seg]=np.linspace(s,0,seg); i+=seg
    return e
def osc(kind,f,n,ph=0,duty=0.5,vib=0):
    t=np.arange(n)/SR
    fm=f*(1+vib*np.sin(2*np.pi*5.5*t))
    p=np.cumsum(fm)/SR+ph
    x=p%1
    if kind=='sine': return np.sin(2*np.pi*p)
    if kind=='saw': return 2*x-1
    if kind=='square': return np.where(x<duty,1.0,-1.0)
    if kind=='tri': return 2*np.abs(2*x-1)-1
def lp(x,fc):
    # one-pole lowpass, fc may be array
    y=np.zeros_like(x); a=np.exp(-2*np.pi*np.broadcast_to(fc,x.shape)/SR); prev=0.0
    for i in range(len(x)):
        prev=(1-a[i])*x[i]+a[i]*prev; y[i]=prev
    return y
def put(buf,at,sig):
    i=int(at*SR); buf[i:i+len(sig)]+=sig[:max(0,len(buf)-i)]
def N(name):
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    o=int(name[-1]); s=names[name[0]]+(1 if '#' in name else 0)
    return 440*2**((s+12*(o+1)-69)/12)
DUR=2.4
# the phrase: a quick rising pickup (G3 C4 E4) into a held C major chord (C3 G3 C4 E4 G4)
PICK=[('G3',0.0),('C4',0.09),('E4',0.18)]
CHORD_AT=0.29
CHORD=['C3','G3','C4','E4','G4']
def render(voice):
    buf=np.zeros(int(DUR*SR))
    for n,at in PICK: put(buf,at,voice(N(n),0.12,True))
    for n in CHORD: put(buf,CHORD_AT,voice(N(n),1.6,False)*(0.8 if n in('C3',) else 0.55))
    return buf
def brass(f,hold,short):
    n=int((hold+0.5)*SR); x=osc('saw',f,n,vib=0.004)+0.5*osc('saw',f*1.003,n)
    e=env(n,0.03,0.12,0.75,0.35,hold)
    cut=300+3200*env(n,0.06,0.3,0.45,0.35,hold)
    return lp(x,cut)*e*0.32
def chip(f,hold,short):
    n=int((hold+0.4)*SR)
    x=osc('square',f,n,duty=0.25,vib=0 if short else 0.006)*0.5
    if f<200: x=osc('tri',f,n)*0.9
    e=env(n,0.005,0.08,0.6,0.25,hold)
    return x*e*0.3
def strings(f,hold,short):
    n=int((hold+0.7)*SR)
    x=sum(osc('saw',f*(1+d),n,ph=k*0.17,vib=0.003) for k,d in enumerate([-0.006,-0.002,0.002,0.006]))/4
    e=env(n,0.02 if short else 0.18,0.2,0.85,0.6,hold)
    return lp(x,1800)*e*0.45
def timpani_brass(f,hold,short):
    n=int((hold+0.5)*SR)
    x=0.6*osc('saw',f,n)+0.4*osc('square',f*0.5 if f>150 else f,n,duty=0.5)
    e=env(n,0.01,0.25,0.55,0.4,hold)
    return lp(x,250+2500*env(n,0.01,0.25,0.3,0.4,hold))*e*0.3
def boom(at,buf):
    n=int(1.2*SR); t=np.arange(n)/SR
    f=90*np.exp(-t*2.2)+55
    x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*3.2)
    noise=np.random.default_rng(1).standard_normal(n)*np.exp(-t*25)*0.25
    put(buf,at,(x+lp(noise,900))*0.9)
def bell_organ(f,hold,short):
    n=int((hold+0.8)*SR); t=np.arange(n)/SR
    # deep tubular bell (inharmonic partials) + soft organ under it
    bell=sum(a*np.sin(2*np.pi*f*r*t)*np.exp(-t/dec) for r,a,dec in [(1,1,1.6),(2.0,0.5,1.0),(2.76,0.35,0.7),(5.4,0.12,0.3)])
    organ=(np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*2*f*t)+0.25*np.sin(2*np.pi*4*f*t))*env(n,0.08,0.1,0.8,0.5,hold)*0.35
    return (bell*0.5+organ)*0.28
voices=[('1-brass-fanfare',brass,False),('2-chiptune-pulse',chip,False),('3-strings-swell',strings,False),('4-timpani-and-brass',timpani_brass,True),('5-deep-bell-and-organ',bell_organ,False)]
out=sys.argv[1]
for name,v,b in voices:
    buf=render(v)
    if b: boom(CHORD_AT,buf)
    buf/=np.max(np.abs(buf))*1.12
    pcm=(buf*32767).astype(np.int16)
    with wave.open(os.path.join(out,name+'.wav'),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(name)
