import re,json,math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.varLib.instancer import instantiateVariableFont
def glyphs(w):
    S=TTFont('/Library/Fonts/MomoTrustSans-VariableFont_wght.ttf'); I=instantiateVariableFont(S,{'wght':w})
    gs=I.getGlyphSet(); cm=I.getBestCmap(); out={}
    for ch in 'v2':
        n=cm[ord(ch)]; p=SVGPathPen(gs); gs[n].draw(p); r=RecordingPen(); gs[n].draw(r); out[ch]=(p.getCommands(),r.value,gs[n].width)
    return out
def pts(rec):
    P=[]
    for op,args in rec:
        for a in args: P.append(a)
    return P
KF=0.45
def build(w, shift=0, blend=110):
    g=glyphs(w)
    vrec=g['v'][1]; trec=g['2'][1]
    # v right arm: the two straight edges reaching x-height. find lineTo points
    vp=[a for op,args in vrec for a in args]
    xh=max(p[1] for p in vp)
    top=[p for p in vp if abs(p[1]-xh)<0.5]; top.sort()
    # top points: [left-outer, left-inner, right-inner, right-outer]
    ri,ro=top[2],top[3]
    # find the points the right arm edges run down to (the next straight-line endpoints below)
    def lower(pt):
        # nearest vertex below on the same straight segment: search lineTo segments containing pt
        best=None
        prev=None
        for op,args in vrec:
            for a in args:
                if prev and op=='lineTo':
                    if (abs(prev[0]-pt[0])<.5 and abs(prev[1]-pt[1])<.5) or (abs(a[0]-pt[0])<.5 and abs(a[1]-pt[1])<.5):
                        other=a if abs(prev[0]-pt[0])<.5 and abs(prev[1]-pt[1])<.5 else prev
                        if other[1]<pt[1]-1: best=other
                prev=a
        return best
    ri2=lower(ri); ro2=lower(ro)
    def at(p,q,y): return p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1])
    # 2 terminal: the horizontal segment of the 2 that is lowest among H at left of bowl -> find lineTo with equal y near 480
    tp=[]; prev=None
    for op,args in trec:
        for a in args:
            if prev and op=='lineTo' and abs(a[1]-prev[1])<.5 and 300<a[1]<700: tp.append((prev,a))
            prev=a
    (a,b)=tp[0]; ty=a[1]; tl=min(a[0],b[0]); tr=max(a[0],b[0])
    ycut=ty-blend
    xi=at(ri,ri2,ycut); xo=at(ro,ro2,ycut)
    xi_t=at(ri,ri2,ty); xo_t=at(ro,ro2,ty)
    dx=(xi_t+xo_t)/2-(tl+tr)/2+shift
    TL=tl+dx; TR=tr+dx
    # tangents: arm direction (up), bowl starts vertical
    adx=(ro[0]-ro2[0])/(ro[1]-ro2[1])  # dx per dy
    k=blend*KF
    outer=f"M {xo:.1f},{ycut-6:.1f} L {xo:.1f},{ycut:.1f} C {xo+adx*k:.1f},{ycut+k:.1f} {TL:.1f},{ty-k:.1f} {TL:.1f},{ty+2:.1f}"
    # outer edge is the left one (TL) on the 2's side; arm left edge is inner (xi). Arm's left edge maps to terminal's left (TL), right edge to TR.
    bridge=(f"M {xi:.1f},{ycut-8:.1f} L {xi:.1f},{ycut:.1f} C {xi+adx*k:.1f},{ycut+k:.1f} {TL:.1f},{ty-k:.1f} {TL:.1f},{ty+3:.1f} "
            f"L {TR:.1f},{ty+3:.1f} C {TR:.1f},{ty-k:.1f} {xo+adx*k:.1f},{ycut+k:.1f} {xo:.1f},{ycut:.1f} L {xo:.1f},{ycut-8:.1f} Z")
    clip=f"M -100,-100 H 2000 V {ycut:.1f} H -100 Z M -100,-100 H {(top[1][0]+ri[0])/2:.1f} V 2000 H -100 Z"
    return dict(v=g['v'][0], two=g['2'][0], dx=dx, bridge=bridge, clip=clip, xh=xh, ty=ty, right=dx+g['2'][2], w=w)

def warp_path(rec, S, Y0):
    def w(p):
        x,y=p; f=max(0.0,min(1.0,(Y0-y)/Y0)); f=f*f*(3-2*f)  # smoothstep
        return (x+S*f, y)
    out=[]
    for op,args in rec:
        a=[w(p) for p in args]
        if op=='moveTo': out.append(f"M{a[0][0]:.1f} {a[0][1]:.1f}")
        elif op=='lineTo': out.append(f"L{a[0][0]:.1f} {a[0][1]:.1f}")
        elif op=='qCurveTo':
            # TrueType implied on-curve points
            pts=a; segs=[]
            for i in range(len(pts)-1):
                c=pts[i]; e=pts[i+1] if i==len(pts)-2 else ((pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2)
                segs.append(f"Q{c[0]:.1f} {c[1]:.1f} {e[0]:.1f} {e[1]:.1f}")
            out.append(' '.join(segs))
        elif op=='curveTo': out.append("C"+' '.join(f"{p[0]:.1f} {p[1]:.1f}" for p in a))
        elif op in ('closePath','endPath'): out.append('Z')
    return ' '.join(out)

def build2(w, shift=0, blend=110, S=150, Y0=320):
    r=build(w,shift,blend)
    g=glyphs(w)
    r['two']=warp_path(g['2'][1],S,Y0)
    r['right']=r['dx']+g['2'][2]+S
    return r
