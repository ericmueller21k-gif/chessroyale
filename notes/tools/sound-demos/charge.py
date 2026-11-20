import numpy as np, wave, sys
SR=44100
def save(buf,path):
    buf=buf/np.max(np.abs(buf))*0.85
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf*32767).astype(np.int16).tobytes())
def tone(fr,kind='square',duty=0.5):
    p=np.cumsum(fr)/SR; x=p%1
    if kind=='square': return np.where(x<duty,1.0,-1.0)
    if kind=='saw': return 2*x-1
    if kind=='tri': return 2*np.abs(2*x-1)-1
    return np.sin(2*np.pi*p)
def lp(x,fc):
    y=np.zeros_like(x); a=np.exp(-2*np.pi*np.broadcast_to(fc,x.shape)/SR); prev=0.0
    for i in range(len(x)): prev=(1-a[i])*x[i]+a[i]*prev; y[i]=prev
    return y
def env(n,a,r):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-np.maximum(0,t-a)/r); return e
def shing(dur=0.45,f=3200):
    n=int(dur*SR); t=np.arange(n)/SR
    ring=sum(a*np.sin(2*np.pi*f*r*t+ph)*np.exp(-t/d) for r,a,d,ph in [(1,1,0.25,0),(1.51,0.6,0.18,1),(2.33,0.4,0.12,2),(3.1,0.25,0.08,3)])
    noise=np.random.default_rng(2).standard_normal(n)*np.exp(-t/0.04)
    hp=noise-lp(noise,4000)
    return ring*0.5+hp*0.6
def put(buf,at,sig):
    i=int(at*SR); buf[i:i+len(sig)]+=sig[:max(0,len(buf)-i)]
out=sys.argv[1]
# A: 8-bit charge stab: a quick rising run then a held power chord, plus a sword shing
b=np.zeros(int(0.9*SR))
for i,f in enumerate([196,262,330,392]):
    n=int(0.06*SR); put(b,i*0.05,tone(np.full(n,f),'square',0.25)*env(n,0.003,0.05)*0.5)
n=int(0.6*SR)
for f in [196,294,392]: put(b,0.2,tone(np.full(n,f)*(1+0.004*np.sin(2*np.pi*6*np.arange(n)/SR)),'square',0.5)*env(n,0.005,0.22)*0.35)
put(b,0.2,shing(0.5)*0.5)
save(b,f'{out}/charge-A-8bit-stab-and-shing.wav')
# B: power-up sweep up into a bright sword ring
n=int(0.35*SR); t=np.arange(n)/SR
sweep=tone(150*(2**(t/0.35*3.5)),'square',0.25)*np.minimum(1,t/0.02)*0.35
b=np.zeros(int(0.9*SR)); put(b,0,sweep); put(b,0.33,shing(0.55,3600)*0.8)
n2=int(0.4*SR); put(b,0.33,tone(np.full(n2,784.0),'tri')*env(n2,0.003,0.15)*0.3)
save(b,f'{out}/charge-B-powerup-sweep-into-shing.wav')
# C: war horn: a low brassy blast with a rising bend at the end
n=int(0.75*SR); t=np.arange(n)/SR
f=110*np.where(t<0.45,1.0,2**((t-0.45)/0.3*7/12))
x=tone(f,'saw')+0.6*tone(f*1.006,'saw')+0.5*tone(f*2,'square',0.3)
cut=300+2600*np.minimum(1,t/0.12)*np.exp(-np.maximum(0,t-0.12)/1.2)
e=np.minimum(1,t/0.03)*np.where(t>0.62,np.exp(-(t-0.62)/0.06),1)
b=lp(x,cut)*e
save(b,f'{out}/charge-C-war-horn.wav')
print('ok')
