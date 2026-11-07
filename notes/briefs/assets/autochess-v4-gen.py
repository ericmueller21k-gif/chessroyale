L="#f0d9b5"; D="#b58863"
GOLD="linear-gradient(145deg,#fbe7a1 0%,#d4a646 30%,#f6dc8a 52%,#a87a24 78%,#e9c46a 100%)"
def cham(c): return f"clip-path:polygon({c}px 0,calc(100% - {c}px) 0,100% {c}px,100% calc(100% - {c}px),calc(100% - {c}px) 100%,{c}px 100%,0 calc(100% - {c}px),0 {c}px)"
def board(sz):
    sq=sz/8; files="HGFEDCBA"
    pieces={(0,7):("♔","w"),(7,7):("♚","b"),(1,2):("●","w"),(1,3):("●","w"),(2,1):("●","w"),(2,5):("●","w"),(3,6):("●","w"),
            (4,0):("♟","g"),(5,2):("♟","g"),(5,5):("♜","g"),(5,6):("♟","g")}
    out=[f'<div class="board" style="width:{sz}px;height:{sz}px">']
    for r in range(8):
        for c in range(8):
            col=L if (r+c)%2==0 else D
            p=pieces.get((r,c)); s=""
            if p:
                g,cl=p
                if g=="●": s=f'<span class="dot" style="width:{sq*.46:.0f}px;height:{sq*.46:.0f}px"></span>'
                else: s=f'<span class="pc {cl}" style="font-size:{sq*.74:.0f}px">{g}</span>'
            lab=""
            if c==0: lab+=f'<i class="rk" style="font-size:{max(8,sq*.17):.0f}px">{r+1}</i>'
            if r==7: lab+=f'<i class="fl" style="font-size:{max(8,sq*.17):.0f}px">{files[c]}</i>'
            out.append(f'<div class="sq" style="left:{c*sq}px;top:{r*sq}px;width:{sq}px;height:{sq}px;background:{col}">{s}{lab}</div>')
    out.append('</div>'); return "".join(out)
def framed(inner, pad, ch):
    return f'<div style="padding:1.5px;background:#1b1306;border-radius:3px"><div style="padding:4px;background:{GOLD};border-radius:2px"><div style="padding:1.5px;background:#1b1306">{inner}</div></div></div>'
def bench(slot, items, label_px):
    parts=[]
    for i in range(5):
        if i<len(items):
            g,lab=items[i]
            parts.append(f'<div class="bs" style="width:{slot}px;height:{slot}px"><span class="pc g" style="font-size:{slot*.62:.0f}px">{g}</span><small style="font-size:{label_px}px">{lab}</small></div>')
        else:
            parts.append(f'<div class="bs" style="width:{slot}px;height:{slot}px"><span class="emp"></span></div>')
    return parts
css='''<style>*{box-sizing:border-box}body{margin:0;font-family:"Archivo","Helvetica Neue",Arial,sans-serif;color:#1d1f24}
.page{position:relative;background:#f3f1ec;overflow:hidden}
.nav{position:absolute;left:0;top:0;bottom:0;width:232px;padding:28px 18px;border-right:1px solid #e2ded5}
.logo{font-weight:900;font-size:27px;margin:0 0 30px 8px}.logo b{color:#a07a00}
.ni{display:flex;align-items:center;gap:14px;padding:12px 10px;font-size:15px;font-weight:600;color:#2a2c31}
.rc{position:absolute;right:0;top:0;bottom:0;width:280px;border-left:1px solid #e2ded5;padding:14px 12px}
.h{font-size:12px;font-weight:800;letter-spacing:.1em;color:#6b6e76;text-align:center}.gold{color:#a07a00;text-decoration:underline}
.sep{height:1px;background:#d3cec3;margin:10px -6px}.m{font-size:12.5px;margin:6px 2px}.m b{color:#2563eb}
.board{position:relative}.sq{position:absolute}
.pc{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;line-height:1}
.pc.w{color:#fff;text-shadow:0 0 1px #000,0 0 1px #000,0 1px 1px #000}.pc.b{color:#16171b}
.pc.g{color:#c9f7d4;text-shadow:0 0 1px #1b6b33,0 0 1px #1b6b33,0 0 6px #4ade80}
.dot{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;background:#fff;border:2px solid #222;box-shadow:0 1px 2px rgba(0,0,0,.3)}
.rk{position:absolute;left:3px;top:2px;font-style:normal;font-weight:800;color:#3d2b0d}.fl{position:absolute;right:3px;bottom:1px;font-style:normal;font-weight:800;color:#3d2b0d}
.bench{position:absolute;display:flex;gap:3px}
.bs{position:relative;display:flex;flex-direction:column;align-items:center}
.bs .pc{position:relative;inset:auto;height:78%}.bs small{font-weight:800;color:#6b5420;line-height:1}
.emp{width:40%;height:40%;margin-top:22%;border-radius:50%;border:1.5px dashed #c9a24a;opacity:.7}
.top{position:absolute;display:flex;align-items:center;gap:12px}
.back{width:38px;height:38px;border-radius:9px;background:#1b1c20;color:#f3d27a;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;box-shadow:0 0 0 2px #c9a24a}
.tt{font-weight:900;font-size:20px}.tt small{display:block;font-size:12px;font-weight:600;color:#6b6e76}
.phase{font-weight:900;letter-spacing:.06em;color:#a07a00}
.who{position:absolute;display:flex;gap:16px;align-items:center}
.pl{display:flex;align-items:center;gap:8px}
.pl .av{font-size:34px;line-height:1}
.pl b{font-size:13px;display:block}.lv{font-size:10px;color:#6b6e76;font-weight:700}
.hr{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#3a3b40}.hr b{font-size:12px;display:inline;min-width:28px}.bar2{width:96px;height:8px;border-radius:4px;background:#fff;border:1px solid #cfc8b8;position:relative;overflow:hidden}.bar2 i{position:absolute;left:0;top:0;bottom:0}
.bar{width:76px;height:6px;border-radius:3px;background:#ddd6c6;position:relative;margin-top:2px}.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
.bl{font-size:9px;color:#6b6e76;display:flex;justify-content:space-between;width:76px;font-weight:700}
.ab{display:flex;flex-direction:column}
.band{display:flex;align-items:center;border-bottom:1px solid #c9a24a;background:linear-gradient(180deg,#26272c,#141518);color:#fff;position:relative}
.coin{display:inline-block;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe48a,#d9a21c 60%,#a1700a)}
.gn{display:flex;align-items:center;gap:6px;font-weight:900}
.inc{color:#e8e2d4;font-weight:700;border-left:1px solid rgba(201,162,74,.6);padding-left:12px;height:60%;display:flex;align-items:center}.inc b{color:#4ade80}
.hex{position:absolute;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,#f6dc8a,#8f6418);padding:0;clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%)}
.hex{box-shadow:none}.hex>div{position:absolute;inset:2.5px;background:linear-gradient(180deg,#fbe7a1,#e2b552 55%,#c9962f);clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1d1f24;font-weight:900;line-height:1}
.hex small{font-weight:900;letter-spacing:.12em}
.odds{display:flex;gap:11px;margin-left:auto;border-left:1px solid rgba(201,162,74,.6);padding-left:12px;color:#e8e2d4;font-weight:700}.odds div{text-align:center;line-height:1.05}.odds .off{opacity:.45}
.row{display:flex;background:linear-gradient(180deg,#1d1e22,#121316)}
.btns{display:flex;flex-direction:column}
.bt{flex:1;position:relative;border-radius:7px;background:linear-gradient(180deg,#fbf7ee,#e3d8bf);box-shadow:inset 0 0 0 1.5px #c9a24a;font-weight:800;display:flex;flex-direction:column;justify-content:center}
.bt small{display:flex;align-items:center;gap:4px;font-weight:800}
.bt .ico{position:absolute;right:8px;top:50%;transform:translateY(-50%);color:#b8862b;font-weight:900}
.cd{position:relative;border-radius:7px;background:linear-gradient(180deg,#fbf7ee,#e3d8bf);box-shadow:inset 0 0 0 1.5px #c9a24a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;line-height:1.15}
.cd.hi{background:linear-gradient(180deg,#fff0bf,#e9bf55);box-shadow:inset 0 0 0 2.5px #8f6418,0 0 0 1px #f6dc8a}
.cd .ic{line-height:1}.cd small{display:flex;align-items:center;gap:3px;font-weight:800}
.pop{position:absolute;background:#17181c;color:#f1ece0;border-radius:10px;box-shadow:0 0 0 2px #c9a24a,0 10px 24px rgba(0,0,0,.35);padding:11px 13px;font-size:12.5px;width:230px}
.pop h4{margin:0 0 7px;font-size:12px;letter-spacing:.08em;color:#f3d27a}.pop div{display:flex;justify-content:space-between;padding:2px 0}.pop .t{border-top:1px solid #3a3b40;margin-top:5px;padding-top:6px;font-weight:900}
.cap{position:absolute;left:12px;top:-2px;font:700 12px Arial;color:#fff;background:#1d1f24;padding:5px 9px;border-radius:0 0 8px 8px;z-index:5}
</style>'''
def nav():
    items=["▷  Play","◉  Chess Town","♛  Boss Battle","☺  Play with friends","▣  Shop & crates","♙  Profile"]
    return '<div class="nav"><div class="logo">Hun<b>Chess</b></div>'+"".join(f'<div class="ni">{a}</div>' for a in items)+'<div class="ni" style="position:absolute;bottom:20px">⚙  Settings</div></div>'
def rcol():
    msgs="".join(f'<div class="m"><b>{n}</b><br>{t}</div>' for n,t in [("knightrider_2009","auto chess rook stars are busted"),("pawnstorm77","4 win streak lets go"),("Zugzwang Zoe","anyone in a 50 v 50?")])
    return f'<div class="rc"><div style="height:62px"></div><div class="sep"></div><div class="h gold">FRIENDS ›</div><div style="text-align:center;font-size:12.5px;color:#555;margin:6px 0">1,284 online · 212 matches · 9 in queue</div><div class="sep"></div><div class="h">GLOBAL CHAT</div><div class="sep"></div>{msgs}</div>'
def player_old(name,lv,icon,hp,xp,xpmax):
    return f'<div class="pl"><span class="av">{icon}</span><div><b>{name}</b><span class="lv">Lv {lv}</span><div class="bar"><i style="width:{hp/24*100}%;background:#22c55e"></i></div><div class="bl"><span>HP</span><span>{hp}</span></div><div class="bar"><i style="width:{xp/xpmax*100}%;background:#60a5fa"></i></div><div class="bl"><span>XP</span><span>{xp}/{xpmax}</span></div></div></div>'
def player(name,lv,icon,hp,xp,xpmax):
    return (f'<div class="pl"><span class="av" style="font-size:52px">{icon}</span><div><b style="font-size:15px">{name}</b><span class="lv" style="font-size:12px">Lv {lv}</span>'
      f'<div class="hr"><span>HP</span><div class="bar2"><i style="width:{hp/24*100}%;background:#22c55e"></i></div><b>{hp}</b></div>'
      f'<div class="hr"><span>XP</span><div class="bar2"><i style="width:{xp/xpmax*100}%;background:#60a5fa"></i></div><b>{xp}/{xpmax}</b></div></div></div>')
def player_stack(name,lv,icon,hp,xp,xpmax):
    return (f'<div style="display:flex;flex-direction:column;align-items:center;text-align:center"><span style="font-size:64px;line-height:1">{icon}</span><b style="font-size:15px;margin-top:4px">{name}</b><span class="lv" style="font-size:12px;margin-bottom:4px">Lv {lv}</span>'
      f'<div class="hr"><span>HP</span><div class="bar2"><i style="width:{hp/24*100}%;background:#22c55e"></i></div><b>{hp}</b></div>'
      f'<div class="hr"><span>XP</span><div class="bar2"><i style="width:{xp/xpmax*100}%;background:#60a5fa"></i></div><b>{xp}/{xpmax}</b></div></div>')
def action_box(W, k):  # k = scale factor (1 desktop)
    bandh=int(46*k); fs=lambda x:f"{x*k:.0f}px"
    hexw=int(118*k); hexh=int(58*k)
    band=(f'<div class="band" style="height:{bandh}px;padding:0 {int(12*k)}px;gap:{int(14*k)}px;font-size:{fs(13)}">'
          f'<div class="gn" style="font-size:{fs(22)}"><i class="coin" style="width:{fs(18)};height:{fs(18)}"></i>23</div>'
          f'<div class="inc" style="font-size:{fs(13)}">Income&nbsp;<b>+12</b></div>'
          f'<div class="hex" style="width:{hexw}px;height:{hexh}px;top:{-int(6*k)}px"><div style="inset:2px"><div style="position:absolute;inset:2px;background:#1b1306;clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%)"></div><div style="position:absolute;inset:4px;background:linear-gradient(180deg,#fbe7a1,#e2b552 55%,#c9962f);clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center"><small style="font-size:{fs(9)}">PLANNING</small><span style="font-size:{fs(24)}">0:15</span></div></div></div>'
          f'<div class="odds" style="font-size:{fs(10.5)}"><div><span style="font-size:{fs(19)}">♟</span><br>66%</div><div><span style="font-size:{fs(19)}">♞</span><br>14%</div><div><span style="font-size:{fs(19)}">♝</span><br>13%</div><div><span style="font-size:{fs(19)}">♜</span><br>7%</div><div class="off"><span style="font-size:{fs(19)}">♛</span><br>0%</div></div></div>')
    pad=int(8*k); gap=int(7*k); btnw=int(104*k)
    cw=(W-2*pad-btnw-4*gap)/4; ch=cw*0.96
    cards=[("♜","Rook c6",5,False),("♟","Pawn h5",1,False),("♟","Pawn f6",1,False),("♟","Pawn b6",1,False)]
    row=(f'<div class="row" style="padding:{pad}px;gap:{gap}px;height:{ch+2*pad:.0f}px">'
         f'<div class="btns" style="width:{btnw}px;gap:{gap}px"><div class="bt" style="padding:0 {int(9*k)}px;font-size:{fs(14)}">Buy XP<small style="font-size:{fs(12)}"><i class="coin" style="width:{fs(11)};height:{fs(11)}"></i>4</small><span class="ico" style="font-size:{fs(13)};line-height:.55;display:flex;flex-direction:column;align-items:center"><b>︿</b><b>︿</b><b>︿</b></span></div>'
         f'<div class="bt" style="padding:0 {int(9*k)}px;font-size:{fs(14)}">Reroll<small style="font-size:{fs(12)}"><i class="coin" style="width:{fs(11)};height:{fs(11)}"></i>2</small><span class="ico" style="font-size:{fs(28)}">↻</span></div></div>'
         + "".join(f'<div class="cd{" hi" if hi else ""}" style="width:{cw:.0f}px;height:{ch:.0f}px;font-size:{fs(12.5)}"><span class="ic" style="font-size:{cw*.42:.0f}px">{g}</span>{n}<small style="font-size:{fs(12)}"><i class="coin" style="width:{fs(11)};height:{fs(11)}"></i>{c}</small></div>' for g,n,c,hi in cards)
         + '</div>')
    return f'<div class="ab" style="width:{W-14}px">{band}{row}</div>'
def scene(W,H,left,right,top_y,bsz,k,phone=False,desk=False):
    sq=bsz/8; slot=int(3*sq/5)-3; fpad=7; frame=bsz+14
    cx0=left; cx1=W-right; cw=cx1-cx0
    total=frame+2*(slot+6)
    bx=cx0+(cw-total)/2+slot+6
    out=[]
    out.append(f'<div style="position:absolute;left:{bx}px;top:{top_y}px">{framed(board(bsz),fpad,0)}</div>')
    ours=bench(slot,[("♞","g4"),("♟","b5")],max(7,int(slot*.2)))
    theirs=[t.replace('class="pc g"','class="pc w"') for t in bench(slot,[("♙","a3")],max(7,int(slot*.2)))]
    # ours: left of board, from our corner (bottom) upward
    out.append(f'<div class="bench" style="flex-direction:column-reverse;left:{bx-slot-5}px;top:{top_y+frame-5*slot-4*3-fpad}px">{"".join(ours)}</div>')
    tb_top = top_y+fpad+(190 if desk else 0)
    out.append(f'<div class="bench" style="flex-direction:column;left:{bx+frame+5}px;top:{tb_top}px">{"".join(theirs)}</div>')
    if desk:
        out.append(f'<div style="position:absolute;left:{bx+frame+18}px;top:{top_y}px">'+player_stack("Rookie Bot",6,"♙",19,0,12)+'</div>')
    ay=top_y+frame+int(22*k)
    out.append(f'<div style="position:absolute;left:{bx}px;top:{ay}px">{framed(action_box(frame,k),fpad,0)}</div>')
    if desk:
        out.append(f'<div style="position:absolute;right:{W-bx+18}px;top:{ay}px">'+player_stack("KnightOwl_42",6,"♟",24,8,12)+'</div>')
    return "".join(out), bx, frame, ay
# desktop
W,H=1440,900
d=f'<div class="page" id="d" style="width:{W}px;height:{H}px">{css}{nav()}{rcol()}'

d+=f'<div style="position:absolute;right:{280+28}px;top:22px;font-size:26px">⚙</div>'
s,bx,frame,ay=scene(W,H,232,280,60,560,0.95,False,True)
d+=s
d+=f'<div class="pop" style="left:{bx+40}px;top:{ay-170}px"><h4>INCOME THIS ROUND</h4><div><span>Base</span><span>+5</span></div><div><span>Interest (23 gold)</span><span>+2</span></div><div><span>Win streak (4)</span><span>+3</span></div><div><span>Round bonus</span><span>+2</span></div><div class="t"><span>Total</span><span>+12</span></div></div>'
d+='<div class="cap">Auto chess, computer</div></div>'
# phone
pw,ph=390,844
sqp=(pw-12-2*7-4-2*(5+3+6))/ (8+2*0.6)  # rough
bszp=int(sqp*8)
p=f'<div class="page" id="p" style="width:{pw}px;height:{ph}px">{css}'

p+='<div style="position:absolute;left:12px;top:12px"><div class="tt" style="font-size:17px">Auto chess<small>Round 2</small></div></div><div style="position:absolute;right:12px;top:12px;font-size:22px">⚙</div>'
p+='@@WHO@@'

s,bx,frame,ay=scene(pw,ph,0,0,112,bszp,0.56,True)
who=f'<div class="who" style="right:{pw-(bx+frame)}px;top:{112-5}px;gap:12px;transform:scale(.62);transform-origin:bottom right;translate:0 -100%">{player("KnightOwl_42",6,"♟",24,8,12)}{player("Rookie Bot",6,"♙",19,0,12)}</div>'
p=p.replace('@@WHO@@',who)
p+=s+'</div>'
open('ac4.html','w').write('<!doctype html><html><head><meta charset="utf-8"></head><body>'+d+'<div style="height:40px"></div>'+p+'</body></html>')
print(bszp)
