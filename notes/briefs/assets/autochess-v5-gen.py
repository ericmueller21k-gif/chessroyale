W=390; G=8; SQ=45; FR=7          # board: 8*45 + 2*7 = 374 = 390 - 2*8
BW=SQ*8+2*FR
def sqc(r,c):
    light=(r+c)%2==1
    ours=r<4
    if ours: return "#f0dcb6" if light else "#c8b08c"
    return "#c6b296" if light else "#9f8e73"
pcs={(7,7):("♚","b"),(6,1):("♟","b"),(0,7):("♔","w"),(3,1):("♙","w")}
ghost={(3,3):"♟",(2,1):"♟",(2,6):"♞"}
files="ABCDEFGH"
def board():
    h=""
    for r in range(7,-1,-1):
        for c in range(8):
            x=c*SQ; y=(7-r)*SQ
            inner=""
            if (r,c) in pcs:
                g,cl=pcs[(r,c)]; inner=f'<span class="pc {cl}">{g}</span>'
            if (r,c) in ghost: inner=f'<span class="pc gh">{ghost[(r,c)]}</span>'
            sel=' style="box-shadow:inset 0 0 0 3px #f2c200;background:rgba(242,194,0,.35)"' if (r,c)==(3,6) else ""
            lab=(f'<i class="rk">{r+1}</i>' if c==0 else "")+(f'<i class="fl">{files[c]}</i>' if r==0 else "")
            h+=f'<div class="sq" style="left:{x}px;top:{y}px;background:{sqc(r,c)}"><div class="in"{sel}>{inner}{lab}</div></div>'
    return f'<div class="frame" style="width:{BW}px;height:{BW}px"><div class="brd">{h}</div></div>'
def bench(items,cols,light,dark,above,sel=-1):
    out=""
    for i,it in enumerate(items):
        bg=light if i%2==0 else dark
        hl=';box-shadow:inset 0 0 0 3px #f2c200' if i==sel else ''
        pc=f'<span class="pc w">{it[0]}</span>' if it else ''
        lab=f'<small>{it[1] if it else "&nbsp;"}</small>'
        out+=f'<div class="bt2">{lab if above else ""}<div class="tile" style="background:{bg}{hl}">{pc}</div>{"" if above else lab}</div>'
    x=15+45*cols
    return f'<div class="bench" style="position:absolute;left:{x}px;{"bottom" if above else "top"}:0">{out}</div>'
def player(name,icon,cls,hpc):
    return (f'<div class="pl"><span class="av {cls}">{icon}</span><div class="pi"><b>{name}</b><span class="lv">Lv <b>4</b></span>'
            f'<div class="hr">HP<span class="bar"><i style="width:100%;background:{hpc}"></i></span>24</div>'
            f'<div class="hr">XP<span class="bar"><i style="width:50%;background:#5b7fe0"></i></span>2/4</div></div></div>')
css='''<style>*{box-sizing:border-box}body{margin:0;background:#f3f1ec;font-family:"Helvetica Neue",Arial,sans-serif;color:#1d1f24;width:390px;height:844px;overflow:hidden;position:relative}
.top{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px 0}
.tt{font-weight:900;font-size:21px;line-height:1.1}.tt small{display:block;font-size:13px;font-weight:500;color:#6b6e76}
.gear{font-size:24px;line-height:1}
.row{position:relative;height:62px}.row .pl{position:absolute;top:50%;transform:translateY(-50%)}
.bench{display:flex}.bt2{width:45px;display:flex;flex-direction:column;align-items:center}.tile{width:45px;height:45px;display:flex;align-items:center;justify-content:center}.bt2 small{font-size:11px;font-weight:800;color:#a07a00;line-height:13px}.bs{width:45px;height:60px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start}
.bs .pc{font-size:36px;line-height:44px;height:44px}.bs small{font-size:11px;font-weight:800;color:#a07a00;line-height:1}
.ring{width:30px;height:30px;margin:7px 0;border-radius:50%;border:1.5px dashed #d8b778}
.pl{display:flex;align-items:center;gap:8px}.av{font-size:40px;line-height:1}.pi>b{font-size:14px;display:block}
.lv{font-size:11px;color:#6b6e76;display:block;margin-bottom:2px}.lv b{color:#1d1f24}
.hr{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:800;color:#3a3b40;line-height:13px}
.bar{width:62px;height:6px;border-radius:3px;background:#e4dfd3;position:relative;overflow:hidden}.bar i{position:absolute;left:0;top:0;bottom:0}
.frame{margin:4px auto;padding:4px;background:#d4a646;box-shadow:inset 0 0 0 1.5px #1b1306;position:relative}
.brd{position:relative;width:360px;height:360px;margin:3px;box-shadow:0 0 0 1.5px #1b1306}
.sq{position:absolute;width:45px;height:45px}.in{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.pc{font-size:36px;line-height:1}.pc.b{color:#111}.pc.w{color:#fff;-webkit-text-stroke:1.2px #111}
.pc.gh{color:#c9f2d6;-webkit-text-stroke:1px #6cc48a;text-shadow:0 0 8px #7ee0a0}
.rk{position:absolute;left:2px;top:1px;font-style:normal;font-size:9px;font-weight:800;color:#5b4a2c}
.fl{position:absolute;right:2px;bottom:0;font-style:normal;font-size:9px;font-weight:800;color:#5b4a2c}
.box{width:374px;margin:10px auto 0;background:#1b1c20;border:3px solid #d4a646;box-shadow:0 0 0 1.5px #1b1306}
.band{height:56px;display:flex;align-items:center;gap:8px;padding:0 9px;color:#e8e2d4;border-bottom:1px solid #b8913c}
.gn{display:flex;align-items:center;gap:5px;font-weight:900;font-size:21px;color:#fff}.coin{width:15px;height:15px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fbe7a1,#c9962f)}
.inc{font-size:12px;font-weight:700;border-left:1px solid rgba(201,162,74,.6);padding-left:8px;height:60%;display:flex;align-items:center}.inc b{color:#4ade80;margin-left:3px}
.hex{width:84px;height:48px;background:#c9962f;clip-path:polygon(14% 0,86% 0,100% 50%,86% 100%,14% 100%,0 50%);display:flex;align-items:center;justify-content:center;flex:none}
.hex>div{width:78px;height:42px;background:#1b1306;clip-path:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}
.hex small{font-size:8px;font-weight:900;letter-spacing:.1em;color:#f3d27a}.hex span{font-size:20px;font-weight:900;color:#fff}
.odds{display:flex;gap:6px;margin-left:auto;font-size:10px;font-weight:700;text-align:center;line-height:1.05}.odds span{font-size:17px;display:block;color:#fff}.odds .off{opacity:.45}
.shop{display:flex;gap:6px;padding:8px}
.btns{display:flex;flex-direction:column;gap:6px;width:82px}
.bt{flex:1;border-radius:7px;background:linear-gradient(180deg,#fbf7ee,#e3d8bf);box-shadow:inset 0 0 0 1.5px #c9a24a;font-weight:800;font-size:13px;padding:4px 7px;position:relative;line-height:1.1}
.bt small{display:block;font-size:12px}.bt .ic{position:absolute;right:6px;top:50%;transform:translateY(-50%);color:#b8862b}
.cd{flex:1;aspect-ratio:1;border-radius:7px;background:linear-gradient(180deg,#fbf7ee,#e3d8bf);box-shadow:inset 0 0 0 1.5px #c9a24a;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:12px;line-height:1.15}
.cd .ic{font-size:30px;line-height:1;color:#fff;-webkit-text-stroke:1px #111}
.c{display:inline-block;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fbe7a1,#c9962f);vertical-align:-1px;margin-right:3px}
.note{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-size:11px;color:#9a968c}
</style>'''
cards="".join(f'<div class="cd"><span class="ic">{g}</span>{n}<small><i class="c"></i>{p}</small></div>' for g,n,p in [("♙","Pawn d4",1),("♙","Pawn g4",1),("♙","Pawn b3",1),("♘","Knight g3",3)])
odds="".join(f'<div class="{ "off" if o=="0%" else ""}"><span>{g}</span>{o}</div>' for g,o in [("♟","74%"),("♞","14%"),("♝","12%"),("♜","0%"),("♛","0%")])
html=f'''<!doctype html><meta charset=utf-8>{css}<body>
<div class="top"><div class="tt">Auto chess<small>Round 1</small></div><div class="gear">⚙</div></div>
<div class="row" style="margin-top:2px">{bench([None,None,None,None],0,"#d6d3cc","#aaa69d",True)}<div class="pl" style="left:205px">{player("Bot","♟","b","#22a447")[16:]}</div>
{board()}
<div class="row">{bench([("♗","c3"),("♘","g4"),None,None],4,"#f6e7c8","#d3bb94",False,1)}<div class="pl" style="left:22px">{player("KnightOwl","♙","w","#22a447")[16:]}</div>
<div class="box"><div class="band"><div class="gn"><i class="coin"></i>23</div><div class="inc">Income<b>+11</b></div>
<div class="hex"><div><small>PLANNING</small><span>0:26</span></div></div><div class="odds">{odds}</div></div>
<div class="shop"><div class="btns"><div class="bt">Buy XP<small><i class="c"></i>4</small><span class="ic">≫</span></div><div class="bt">Reroll<small><i class="c"></i>2</small><span class="ic">↻</span></div></div>{cards}</div></div>
<div class="note">Mockup · 390 × 844 phone · bench knight tapped: its tile and g4 light up</div>
</body>'''
open("mock.html","w").write(html)
