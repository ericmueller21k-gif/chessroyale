import numpy as np, wave, sys
SR=44100
def strike(buf,at,f,partials,level,glide=0.0):
    for mult,amp,dec in partials:
        n=int((dec+0.03)*SR); t=np.arange(n)/SR
        f0=f*mult*(1+glide); f1=f*mult
        fr=np.where(t<0.04, f0*(f1/f0)**(np.minimum(t,0.04)/0.04), f1)
        ph=np.cumsum(fr)/SR; a=level*amp
        att=0.0001*(a/0.0001)**(np.minimum(t,0.004)/0.004)
        dk=a*(0.0001/a)**(np.clip(t-0.004,0,None)/(dec-0.004))
        g=np.where(t<0.004,att,dk); g[t>dec]=0
        i=int(at*SR); seg=(np.sin(2*np.pi*ph)*g)[:len(buf)-i]; buf[i:i+len(seg)]+=seg
def N(name):
    names={'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
    o=int(name[-1]); s=names[name[0]]+(1 if '#' in name else 0)
    return 440*2**((s+12*(o+1)-69)/12)
def save(buf,path):
    buf=buf/np.max(np.abs(buf))*0.85
    with wave.open(path,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf*32767).astype(np.int16).tobytes())
out=sys.argv[1]
BELLS={
 'bell-a-bright-bell':      ([[1,1,0.9],[2.76,0.3,0.45],[5.4,0.1,0.2]],0.14,0),            # today's end-ding bell, longer ring
 'bell-b-tubular-brighter': ([[1,1,1.2],[2.0,0.45,0.8],[2.76,0.3,0.5],[5.4,0.12,0.2]],0.12,0), # the deep bell an octave up
 'bell-c-glockenspiel':     ([[1,1,0.7],[2.76,0.3,0.3],[5.4,0.12,0.12]],0.12,12),        # glockenspiel, an octave higher still
}
for name,(P,lvl,up) in BELLS.items():
    b=np.zeros(int(2.0*SR)); k=2**(up/12)
    for i,n in enumerate(['G5','C6','E6','G6']): strike(b,i*0.06,N(n)*k,P,lvl*0.8)
    for n in ['C6','E6','G6','C7']: strike(b,0.3,N(n)*k,P,lvl*0.75)
    save(b,f'{out}/levelup-run-into-chord-{name}.wav'); print(name)
# XP fill: pitch by XP counted so far (not by this game's share): rises over the first 85% of a top game (500 XP), up a major sixth, then holds.
PING=[[1,1,0.07],[2.76,0.18,0.03],[5.4,0.06,0.015]]
TOP=500; FULL_AT=TOP*(1-1.0/2.8); SEMIS=9; gap=0.042
def fill(gain, path):
    dur=1.3+0.9*min(1,gain/TOP)+ (0.6 if gain>=TOP else 0)   # a top game fills longer: about a second at the top pitch
    b=np.zeros(int((dur+0.3)*SR))
    for t in np.arange(0,dur,gap):
        xp=gain*min(1,t/dur*1.0)
        r=min(1,xp/FULL_AT); r=1-(1-r)**2
        strike(b,t,1046.5*2**(r*SEMIS/12),PING,0.065,glide=0.01)
    save(b,path); print(path, round(dur,2))
fill(100,f'{out}/fill-v2-100xp.wav'); fill(300,f'{out}/fill-v2-300xp.wav'); fill(500,f'{out}/fill-v2-500xp.wav')
