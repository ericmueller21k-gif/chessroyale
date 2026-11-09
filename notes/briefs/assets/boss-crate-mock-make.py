import base64,sys
S=sys.argv[1]
def coin(name): return "data:image/png;base64,"+base64.b64encode(open(f"{S}/crate-art/boss-crate-{name}.png","rb").read()).decode()
def crate(seal):
    return f'''<svg viewBox="0 0 100 100" width="400" height="400" xmlns="http://www.w3.org/2000/svg">
<defs>
 <linearGradient id="bd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a1f2b"/><stop offset="1" stop-color="#3d0c14"/></linearGradient>
 <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f2634"/><stop offset="1" stop-color="#5a1420"/></linearGradient>
 <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".45" stop-color="#f2c14e"/><stop offset="1" stop-color="#a87a14"/></linearGradient>
 <linearGradient id="iron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b4f5a"/><stop offset="1" stop-color="#23262d"/></linearGradient>
 <clipPath id="sealc"><circle cx="50" cy="58" r="13.2"/></clipPath>
</defs>
<g stroke="#1d1d1f" stroke-linejoin="round" stroke-width="3">
 <!-- horns on the lid corners -->
 <path d="M10 22 Q2 12 6 4 Q11 12 18 18 Z" fill="url(#gold)" stroke-width="2"/>
 <path d="M90 22 Q98 12 94 4 Q89 12 82 18 Z" fill="url(#gold)" stroke-width="2"/>
 <rect x="8" y="34" width="84" height="56" rx="4" fill="url(#bd)"/>
 <path d="M4 34 Q4 18 20 16 H80 Q96 18 96 34 Z" fill="url(#lid)"/>
 <!-- iron bands -->
 <rect x="22" y="16.5" width="9" height="73" fill="url(#iron)" stroke-width="2"/>
 <rect x="69" y="16.5" width="9" height="73" fill="url(#iron)" stroke-width="2"/>
 <rect x="4" y="31" width="92" height="6" rx="1.5" fill="url(#iron)" stroke-width="2"/>
</g>
<g fill="url(#gold)" stroke="#1d1d1f" stroke-width="1">
 <circle cx="26.5" cy="24" r="1.8"/><circle cx="26.5" cy="48" r="1.8"/><circle cx="26.5" cy="80" r="1.8"/>
 <circle cx="73.5" cy="24" r="1.8"/><circle cx="73.5" cy="48" r="1.8"/><circle cx="73.5" cy="80" r="1.8"/>
</g>
<!-- the seal -->
<circle cx="50" cy="58" r="16" fill="url(#gold)" stroke="#1d1d1f" stroke-width="2.4"/>
<circle cx="50" cy="58" r="13.2" fill="#16213e" stroke="#1d1d1f" stroke-width="1.2"/>
{seal}
<!-- plate -->
<rect x="36" y="78" width="28" height="8" rx="2" fill="#1d1d1f"/>
<text x="50" y="84.6" text-anchor="middle" font-size="6.6" font-weight="900" letter-spacing="1.6" fill="#f2c14e" font-family="ui-monospace, Menlo, Consolas, monospace">BOSS</text>
</svg>'''
q='<text x="50" y="65.5" text-anchor="middle" font-size="21" font-weight="900" fill="#f2c14e" stroke="#1d1d1f" stroke-width="1.2" font-family="Arial Black, Archivo, sans-serif">?</text>'
def c(name): return f'<image href="{coin(name)}" x="34.5" y="42.5" width="31" height="31" clip-path="url(#sealc)" preserveAspectRatio="xMidYMid slice" style="image-rendering:pixelated"/>'
html="<html><body style='margin:0;background:#f4f2ee;font:600 18px Archivo,Arial'><div style='display:flex;gap:30px;padding:30px'>"
for label,seal in [("Shop: Random Boss Crate",q),("In your inventory: Babur",c("babur")),("In your inventory: Ginger",c("ginger"))]:
    html+=f"<div style='text-align:center'>{crate(seal)}<div>{label}</div></div>"
html+="</div><div style='display:flex;gap:30px;padding:0 30px 30px;background:#14161b;color:#eee'>"
for label,seal in [("dark: ?",q),("dark: Clown",c("clown")),("dark: Hollow",c("hollow"))]:
    html+=f"<div style='text-align:center;padding-top:20px'>{crate(seal)}<div>{label}</div></div>"
html+="</div></body></html>"
open(f"{S}/boss-crate/mock.html","w").write(html)
