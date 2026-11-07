L="#f0d9b5"; D="#b58863"
def board(sz, flip=True):
    sq=sz/8; files="HGFEDCBA" if flip else "ABCDEFGH"
    pieces={(0,7):("♔","w"),(7,0):("♚","b"),(1,2):("♙","w"),(1,3):("♙","w"),(2,1):("♙","w"),(2,5):("♙","w"),(3,6):("♙","w"),
            (4,0):("♟","b"),(5,2):("♟","b"),(5,5):("♜","b"),(5,6):("♟","b")}
    out=[f'<div class="board" style="width:{sz}px;height:{sz}px">']
    for r in range(8):
        for c in range(8):
            col=L if (r+c)%2==0 else D
            p=pieces.get((r,c)); s=""
            if p: s=f'<span class="pc {p[1]}" style="font-size:{sq*0.78:.0f}px">{p[0]}</span>'
            lab=""
            if c==0: lab+=f'<i class="rk">{r+1 if flip else 8-r}</i>'
            if r==7: lab+=f'<i class="fl">{files[c]}</i>'
            out.append(f'<div class="sq" style="left:{c*sq}px;top:{r*sq}px;width:{sq}px;height:{sq}px;background:{col}">{s}{lab}</div>')
    out.append('</div>'); return "".join(out)
def bench(n, size, pieces, cls):
    parts=[]
    for i in range(n):
        inner=""
        if i<len(pieces):
            inner='<span class="pc b" style="font-size:%dpx">%s</span>'%(size*0.7,pieces[i])
        parts.append('<div class="slot" style="width:%dpx;height:%dpx">%s</div>'%(size,size,inner))
    return '<div class="bench '+cls+'">'+"".join(parts)+'</div>'
css='''<style>*{box-sizing:border-box}body{margin:0;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;color:#1d1f24}
.page{position:relative;background:#f3f1ec;overflow:hidden}
.nav{position:absolute;left:0;top:0;bottom:0;width:232px;padding:28px 18px;border-right:1px solid #e2ded5}
.logo{font-weight:900;font-size:27px;margin:0 0 30px 8px}.logo b{color:#a07a00}
.ni{display:flex;align-items:center;gap:14px;padding:12px 10px;font-size:15px;font-weight:600;color:#2a2c31}.ni.on{background:#e9e5dc;border-radius:12px}
.rc{position:absolute;right:0;top:0;bottom:0;width:280px;border-left:1px solid #e2ded5;padding:14px 12px}
.h{font-size:12px;font-weight:800;letter-spacing:.1em;color:#6b6e76;text-align:center}.gold{color:#a07a00;text-decoration:underline}
.sep{height:1px;background:#d3cec3;margin:10px -6px}
.m{font-size:12.5px;margin:6px 2px}.m b{color:#2563eb}
.frame{position:relative;padding:9px;border-radius:12px;background:linear-gradient(145deg,#f6dc8a,#b8862b 40%,#f3d27a 60%,#8f6418);box-shadow:0 6px 18px rgba(0,0,0,.25), inset 0 0 0 2px #5b3d0b}
.board{position:relative;border:2px solid #3b2a0c}
.sq{position:absolute}.pc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;line-height:1}
.pc.w{color:#fff;text-shadow:0 0 1px #000,0 0 1px #000,0 1px 1px #000}.pc.b{color:#16171b}
.sq .pc.w.g{filter:drop-shadow(0 0 4px #4ade80)}
.rk{position:absolute;left:2px;top:1px;font-size:9px;font-style:normal;font-weight:800;color:#4a3410}.fl{position:absolute;right:2px;bottom:0;font-size:9px;font-style:normal;font-weight:800;color:#4a3410}
.bench{display:flex;flex-direction:column;gap:6px;position:absolute}
.slot{position:relative;border-radius:8px;background:rgba(27,28,32,.06);border:2px solid #c9a24a;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
.hud{position:absolute;display:flex;align-items:stretch;border-radius:12px;overflow:hidden;background:#17181c;box-shadow:0 0 0 2px #c9a24a,0 6px 16px rgba(0,0,0,.25);color:#fff}
.gold-n{display:flex;align-items:center;gap:8px;padding:0 16px;font-size:24px;font-weight:900}
.coin{width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe48a,#d9a21c 60%,#a1700a);display:inline-block}
.inc{display:flex;flex-direction:column;justify-content:center;padding:0 14px;font-size:13px;color:#d6d0c2;border-left:1px solid #3a3b40;cursor:pointer}
.inc b{color:#7ee08a;font-size:15px}.inc u{font-size:10px;color:#c9a24a;text-decoration:none}
.timer{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 22px;background:linear-gradient(180deg,#f7dc86,#c99a2c);color:#1d1f24;font-weight:900;font-size:30px;clip-path:polygon(10% 0,90% 0,100% 50%,90% 100%,10% 100%,0 50%)}
.timer small{font-size:11px;letter-spacing:.12em}
.odds{display:flex;gap:10px;align-items:center;padding:0 14px;font-size:11px;color:#e8e2d4;border-left:1px solid #3a3b40}.odds div{text-align:center}.odds span{display:block;font-size:16px}
.shop{position:absolute;display:flex;gap:8px;padding:8px;border-radius:12px;background:#17181c;box-shadow:0 0 0 2px #c9a24a}
.btn{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 12px;border-radius:9px;background:linear-gradient(180deg,#faf6ec,#e6dcc5);font-weight:800;font-size:14px;color:#1d1f24}
.btn small{font-size:12px;display:flex;align-items:center;gap:4px}.coin.s{width:12px;height:12px}
.card{flex:1;border-radius:9px;background:linear-gradient(180deg,#faf6ec,#e6dcc5);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:13px;position:relative}
.card .ic{font-size:40px;line-height:1}.card.rk{background:linear-gradient(180deg,#fff2c9,#e8bf5a);box-shadow:inset 0 0 0 2px #b8862b}
.card small{display:flex;align-items:center;gap:4px;font-size:12px}
.top{position:absolute;display:flex;align-items:center;gap:12px}
.back{width:38px;height:38px;border-radius:10px;background:#17181c;color:#f3d27a;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;box-shadow:0 0 0 2px #c9a24a}
.tt{font-weight:900;font-size:20px}.tt small{display:block;font-size:12px;font-weight:600;color:#6b6e76}
.phase{font-weight:900;font-size:24px;letter-spacing:.04em;color:#1d1f24}.phase em{font-style:normal;color:#a07a00}
.who{position:absolute;display:flex;gap:10px}
.pl{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:#17181c;color:#fff;box-shadow:0 0 0 2px #c9a24a}
.av{width:40px;height:40px;border-radius:50%;background:#f3f1ec;display:flex;align-items:center;justify-content:center;font-size:24px;color:#16171b;border:2px solid #c9a24a}
.pl b{font-size:13px}.lv{font-size:10px;color:#c9a24a;font-weight:800}
.bar{width:84px;height:6px;border-radius:3px;background:#3a3b40;margin-top:3px;position:relative}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
.bl{font-size:9px;color:#bdb6a6;display:flex;justify-content:space-between;width:84px}
.pop{position:absolute;width:250px;background:#17181c;color:#f1ece0;border-radius:12px;box-shadow:0 0 0 2px #c9a24a,0 10px 24px rgba(0,0,0,.35);padding:12px 14px;font-size:13px}
.pop h4{margin:0 0 8px;font-size:13px;letter-spacing:.08em;color:#f3d27a}.pop div{display:flex;justify-content:space-between;padding:3px 0}.pop .t{border-top:1px solid #3a3b40;margin-top:6px;padding-top:7px;font-weight:900}
.cap{position:absolute;left:12px;top:-2px;font:700 12px Arial;color:#fff;background:#1d1f24;padding:5px 9px;border-radius:0 0 8px 8px}
</style>'''
def nav():
    items=[("▷","Play"),("◉","Chess Town"),("♛","Boss Battle"),("☺","Play with friends"),("▣","Shop & crates"),("♙","Profile")]
    return '<div class="nav"><div class="logo">Hun<b>Chess</b></div>'+"".join(f'<div class="ni">{a} {b}</div>' for a,b in items)+'<div class="ni" style="position:absolute;bottom:20px">⚙ Settings</div></div>'
def rcol():
    msgs="".join(f'<div class="m"><b>{n}</b><br>{t}</div>' for n,t in [("knightrider_2009","auto chess rook stars are busted"),("pawnstorm77","4 win streak lets go"),("Zugzwang Zoe","anyone in a 50 v 50?"),("Fischer4ever","gg")])
    return f'<div class="rc"><div style="height:62px"></div><div class="sep"></div><div class="h gold">FRIENDS ›</div><div style="text-align:center;font-size:12.5px;color:#555;margin:6px 0">1,284 online · 212 matches · 9 in queue</div><div class="sep"></div><div class="h">GLOBAL CHAT</div><div class="sep"></div>{msgs}</div>'
def player(name,lv,icon,hp,xp,xpmax):
    return f'<div class="pl"><div class="av">{icon}</div><div><b>{name}</b> <span class="lv">LV {lv}</span><div class="bar"><i style="width:{hp/24*100}%;background:#4ade80"></i></div><div class="bl"><span>HP</span><span>{hp}</span></div><div class="bar"><i style="width:{xp/xpmax*100}%;background:#60a5fa"></i></div><div class="bl"><span>XP</span><span>{xp}/{xpmax}</span></div></div></div>'
def shop(w, scale=1.0, cardh=96):
    return (f'<div class="shop" style="width:{w}px;height:{cardh+16}px">'
      f'<div style="display:flex;flex-direction:column;gap:6px;width:{int(96*scale)}px"><div class="btn" style="flex:1">Buy XP<small><i class="coin s"></i>4</small></div><div class="btn" style="flex:1">Reroll<small><i class="coin s"></i>2</small></div></div>'
      + '<div class="card rk"><div class="ic">♜</div>Rook c6<small><i class="coin s"></i>5</small></div>'
      + "".join(f'<div class="card"><div class="ic">♟</div>Pawn {s}<small><i class="coin s"></i>1</small></div>' for s in ["h5","f6","b6"])+'</div>')
# DESKTOP 1440x900
W,H=1440,900; cx0=232; cx1=W-280; cw=cx1-cx0
bsz=520; frame=bsz+22; bx=cx0+(cw-frame)//2; by=118
slot=56
d=f'<div class="page" id="d" style="width:{W}px;height:{H}px">{css}{nav()}{rcol()}'
d+=f'<div class="top" style="left:{cx0+28}px;top:22px"><div class="back">‹</div><div><div class="tt">Auto chess<small>Round 2 · you play Black</small></div></div><div style="margin-left:18px;border-left:2px solid #c9a24a;padding-left:16px"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#6b6e76">PHASE</div><div class="phase">PLANNING</div></div></div>'
d+=f'<div class="who" style="right:{280+28}px;top:18px">{player("You",6,"♙",24,8,12)}{player("Bot",6,"♟",19,0,12)}</div>'
d+=f'<div class="frame" style="position:absolute;left:{bx}px;top:{by}px">{board(bsz)}</div>'
# our bench: left of board, bottom -> up ; opponent: right of board, top -> down
d+=bench(5,slot,["♟","♞"],"").replace('class="bench "',f'class="bench" style="left:{bx-slot-14}px;top:{by+frame-5*slot-4*6}px;flex-direction:column-reverse"')
d+=bench(5,slot,["♙"],"").replace('class="bench "',f'class="bench" style="left:{bx+frame+14}px;top:{by}px"')
hy=by+frame+16
d+=f'<div class="hud" style="left:{bx}px;top:{hy}px;height:58px;width:{frame}px"><div class="gold-n"><i class="coin"></i>23</div><div class="inc">Income <b>+12</b><u>tap for details</u></div><div class="timer" style="flex:1"><small>PLANNING</small>0:15</div><div class="odds"><div><span>♟</span>66%</div><div><span>♞</span>14%</div><div><span>♝</span>13%</div><div><span>♜</span>7%</div><div style="opacity:.45"><span>♛</span>0%</div></div></div>'
d+=shop(frame).replace('<div class="shop"',f'<div class="shop" style2').replace('style2 style="',f'style="position:absolute;left:{bx}px;top:{hy+70}px;')
d+=f'<div class="pop" style="left:{bx+60}px;top:{hy-182}px"><h4>INCOME THIS ROUND</h4><div><span>Base</span><span>+5</span></div><div><span>Interest (23 gold)</span><span>+2</span></div><div><span>Win streak (4)</span><span>+3</span></div><div><span>Round bonus</span><span>+2</span></div><div class="t"><span>Total</span><span>+12</span></div></div>'
d+='<div class="cap">Auto chess, computer (left menu and right column never move)</div></div>'
# PHONE 390x844
pw,ph=390,844; ps=34; pbsz=pw-2*ps-2*10-22-8; pbx=(pw-(pbsz+22))//2; pby=78
p=f'<div class="page" id="p" style="width:{pw}px;height:{ph}px">{css}'
p+=f'<div class="top" style="left:10px;top:10px;gap:8px"><div class="back" style="width:32px;height:32px;font-size:18px">‹</div><div><div class="tt" style="font-size:15px">Auto chess<small>Round 2</small></div><div class="phase" style="font-size:15px">PLANNING</div></div></div>'
p+=f'<div class="who" style="right:8px;top:8px;gap:6px;transform:scale(.62);transform-origin:top right">{player("You",6,"♙",24,8,12)}{player("Bot",6,"♟",19,0,12)}</div>'
p+=f'<div class="frame" style="position:absolute;left:{pbx}px;top:{pby}px;padding:7px">{board(pbsz)}</div>'
fr=pbsz+18
p+=bench(5,ps,["♟","♞"],"").replace('class="bench "',f'class="bench" style="left:{pbx-ps-5}px;top:{pby+fr-5*ps-4*6}px;flex-direction:column-reverse"')
p+=bench(5,ps,["♙"],"").replace('class="bench "',f'class="bench" style="left:{pbx+fr+5}px;top:{pby}px"')
hy=pby+fr+12
p+=f'<div class="hud" style="left:10px;top:{hy}px;height:52px;width:{pw-20}px"><div class="gold-n" style="font-size:20px;padding:0 10px"><i class="coin"></i>23</div><div class="inc" style="padding:0 8px;font-size:11px">Income <b>+12</b></div><div class="timer" style="flex:1;font-size:24px"><small>PLANNING</small>0:15</div><div class="odds" style="gap:5px;padding:0 8px;font-size:9px"><div><span style="font-size:12px">♟</span>66</div><div><span style="font-size:12px">♞</span>14</div><div><span style="font-size:12px">♝</span>13</div><div><span style="font-size:12px">♜</span>7</div></div></div>'
p+=shop(pw-20,0.78,104).replace('Buy XP','Buy&nbsp;XP').replace('<div class="shop"','<div class="shop" s2').replace('s2 style="',f'style="position:absolute;left:10px;top:{hy+62}px;')
p+='</div>'
open('ac.html','w').write('<!doctype html><html><head><meta charset="utf-8"></head><body>'+d+'<div style="height:40px"></div>'+p+'</body></html>')
print(pbsz)
