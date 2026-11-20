import numpy as np, wave, os, sys
SR=44100
def N(name):
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    o=int(name[-1]); s=names[name[0]]+(1 if '#' in name else 0)
    return 440*2**((s+12*(o+1)-69)/12)
def bell(f,dur,cut=None):
    n=int(dur*SR); t=np.arange(n)/SR
    x=sum(a*np.sin(2*np.pi*f*r*t)*np.exp(-t/dec) for r,a,dec in [(1,1,1.1),(2.0,0.45,0.7),(2.76,0.3,0.45),(5.4,0.1,0.18)])
    x*=np.minimum(1,t/0.002)
    if cut: x*=np.clip((cut-t)/0.03,0,1)
    return x
def put(buf,at,sig):
    i=int(at*SR); buf[i:i+len(sig)]+=sig[:max(0,len(buf)-i)]
out=sys.argv[1]
for name,(a,b) in {'bell-ding-1-fifth-G-D':('G4','D5'),'bell-ding-2-sixth-A-Fsharp':('A4','F#5'),'bell-ding-3-octave-E-E':('E4','E5')}.items():
    buf=np.zeros(int(1.6*SR))
    put(buf,0.0,bell(N(a),0.09,cut=0.09)*0.8)
    put(buf,0.075,bell(N(b),1.5))
    buf/=np.max(np.abs(buf))*1.12
    with wave.open(os.path.join(out,name+'.wav'),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf*32767).astype(np.int16).tobytes())
    print(name)
