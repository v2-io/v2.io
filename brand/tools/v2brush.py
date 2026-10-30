#!/usr/bin/env python3
"""Draw the v2 brush mark: one of the UDON mark's own brush strokes, mapped along a clean skeleton path.

    python3 brand/tools/v2brush.py                       # writes brand/v2-mark.svg, brand/v2-mark-vermilion.svg, brand/v2-mark-layout.json
    python3 brand/tools/v2brush.py --ratio 0.12 --out /tmp/v2

How it works (the same idea as a vector "art brush"):

1. The brush. The UDON mark (udon/ux/brand/udon-mark.svg) is rasterised layer by layer (the dense core and the
   dry-brush edge) and split into its four strokes. Stroke B, the straight one with a clean start and a split
   dry-brush end, is the brush. Its flat start is rounded a little, as a real brush tip would leave it.
2. The skeleton. The 2's head is a true circle, like the opening of an ensō: fitted to the bowl of the 2 in
   Joseph's v2 logo (v2-io-jaw.svg, path87: its centreline runs midway between that 2's outer and inner edges),
   entered low on the left and swept over the top until a straight line leaves it on a tangent for the corner;
   then straight down the diagonal, round a small fillet, and along the base. (`--bowl spline` uses the logo's
   own bowl instead.) The V's centreline starts at the middle of the top of the
   V stroke in that logo and is aimed into the 2's corner.
3. The mapping. Every pixel near a path finds its nearest point on the path: its distance along the path picks a
   row of the brush, its signed distance across the path picks a column. The brush's start and end are mapped
   unstretched; only its middle stretches to the path's length. The brush is mirrored so that, as in the UDON
   bowl, the solid edge is on the outside and the bristles break up on the inside.
4. potrace traces each layer, and the two layers are written as an SVG in sumi and in vermilion.

Needs numpy, scipy, Pillow, and the potrace and rsvg-convert commands.
"""
import argparse, json, math, os, re, subprocess, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
UDON_MARK = os.path.expanduser('~/src/arch/firmatum/udon/ux/brand/udon-mark.svg')
INKS = {'sumi': ('#3A3129', '#241F1A'), 'vermilion': ('#DB6D49', '#CF5A3A')}   # (dry-brush edge, core)

# ---------------------------------------------------------------- the brush

def udon_layers(svg, height, tmp):
    """Rasterise the mark's edge layer and core layer separately; return their alpha as floats 0..1."""
    s = open(svg).read()
    head = s[:s.index('<g')]
    out = []
    for pid in ('sumi-feather', 'sumi-core'):
        p = re.search(r'<path\b[^>]*id="%s"[^>]*>' % pid, s, re.S).group(0)
        p = re.sub(r'fill="[^"]+"', 'fill="#000"', p)
        p = re.sub(r'fill-opacity="[^"]+"', '', p)
        f = os.path.join(tmp, pid + '.svg'); open(f, 'w').write(head + p + '</svg>')
        png = f[:-4] + '.png'
        subprocess.run(['rsvg-convert', '-h', str(height), f, '-o', png], check=True)
        out.append(np.asarray(Image.open(png).convert('RGBA'))[..., 3].astype(float) / 255)
    return out

def udon_stroke(index, tmp, margin=12):
    """Stroke `index` of the UDON mark, counting the four strokes from the left (0 = the bowl's left side, 1 = stroke B)."""
    fe, co = udon_layers(UDON_MARK, 2368, tmp)
    ink = (fe > 0) | (co > 0)
    lab, n = ndimage.label(ndimage.binary_dilation(ink, iterations=2))
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    four = sorted(np.argsort(sizes)[::-1][:4] + 1, key=lambda i: ndimage.center_of_mass(lab == i)[1])
    m = lab == four[index]
    ys, xs = np.where(m)
    y0, y1, x0, x1 = ys.min() - margin, ys.max() + margin, xs.min() - margin, xs.max() + margin
    return np.stack([(fe * m)[y0:y1, x0:x1], (co * m)[y0:y1, x0:x1]])

def round_start(S, depth):
    """Round the brush's first touch: within `depth` brush half-widths of where the ink starts, keep only what lies
    inside a half-ellipse as wide as the brush, so the corners of a flat start come off as a real tip would leave
    them. The edge is softened over a pixel and a half; the brush beyond the start is untouched."""
    if depth <= 0: return S
    a = (S[0] + S[1]) > 0.5; ys, xs = np.where(a); y0 = ys.min()
    body = a[y0 + 200:y0 + 600]                       # the brush's width, measured along its body
    half = np.median(body.sum(1)) / 2
    ax = brush_axis(S); L = int(round(depth * half))
    soft = np.ones(S.shape[1:])
    cols = np.arange(S.shape[2])
    for r in range(y0, y0 + L):
        ink = np.where(a[r])[0]
        if len(ink) == 0: continue
        # pull each side of this row toward the axis by the ellipse's factor, so the cap meets the body's own edges
        f = math.sqrt(max(0.0, 1 - (1 - (r - y0) / L) ** 2))
        lo = ax - (ax - ink.min()) * f; hi = ax + (ink.max() - ax) * f
        soft[r] = np.clip(np.minimum(cols - lo, hi - cols) / 1.5 + 0.5, 0, 1)
    return S * soft[None]

def brush_axis(S):
    """The brush's centre column, measured across its first rows (the clean start)."""
    a = (S[0] + S[1]) > 0.5; ys, xs = np.where(a)
    return xs[ys < ys.min() + 40].mean()

def brush_along(canvas, S, path, top=170, bot=520, endstretch=1.0, mirror=False):
    """Map brush S (start at row 0) along `path` (xy points 1px apart). The first `top` and last `bot` rows map
    unstretched (the end compressed by `endstretch`); the rows between stretch to fill the path."""
    H = S.shape[1]; ax = brush_axis(S)
    T = np.gradient(path, axis=0); T /= np.linalg.norm(T, axis=1)[:, None]
    N = np.c_[-T[:, 1], T[:, 0]] * (-1 if mirror else 1)
    L = len(path); bot_o = bot * endstretch
    hit = np.zeros(canvas.shape[1:], bool); ij = np.round(path[:, ::-1]).astype(int)
    hit[np.clip(ij[:, 0], 0, hit.shape[0] - 1), np.clip(ij[:, 1], 0, hit.shape[1] - 1)] = True
    ys, xs = np.where(ndimage.distance_transform_edt(~hit) <= S.shape[2] * 0.6 + bot * 0.05)
    pts = np.c_[xs, ys].astype(float)
    _, idx = cKDTree(path).query(pts)
    v = pts - path[idx]
    s = idx + np.einsum('ij,ij->i', v, T[idx])
    across = np.einsum('ij,ij->i', v, N[idx])
    mid_in, mid_out = H - top - bot, max(1.0, L - top - bot_o)
    u = np.where(s < top, s, np.where(s > L - bot_o, H - bot + (s - (L - bot_o)) / endstretch, top + (s - top) * mid_in / mid_out))
    for k in range(2):
        val = ndimage.map_coordinates(S[k], [u, ax + across], order=1, cval=0)
        canvas[k][ys, xs] = np.maximum(canvas[k][ys, xs], val)

# ---------------------------------------------------------------- the skeleton (units of v2-io-jaw.svg)

def cubic(p0, p1, p2, p3, n=2000):
    t = np.linspace(0, 1, n)[:, None]; p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

def by_length(Q, n):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]; s = np.linspace(0, d[-1], n)
    return np.c_[np.interp(s, d, Q[:, 0]), np.interp(s, d, Q[:, 1])]

def fillet(T0, C, B, r):
    """Round the corner at C between the line from T0 and the line to B with a circle of radius r."""
    u1 = (C - T0) / np.linalg.norm(C - T0); u2 = (B - C) / np.linalg.norm(B - C)
    ang = math.acos(np.clip(np.dot(-u1, u2), -1, 1)); d = r / math.tan(ang / 2)
    a, b = C - u1 * d, C + u2 * d
    bis = (-u1 + u2) / np.linalg.norm(-u1 + u2); ctr = C + bis * (r / math.sin(ang / 2))
    a0 = math.atan2(*(a - ctr)[::-1]); a1 = math.atan2(*(b - ctr)[::-1])
    if a1 - a0 > math.pi: a1 -= 2 * math.pi
    if a0 - a1 > math.pi: a1 += 2 * math.pi
    return a, b, np.array([ctr + r * np.array([math.cos(x), math.sin(x)]) for x in np.linspace(a0, a1, 40)])

def line(a, b, n=300):
    return np.array([a + (b - a) * s for s in np.linspace(0, 1, n)])

def round_bowl(spline_bowl, corner, scale=1.0, start=143.0):
    """A true circle for the 2's head, like the opening of an ensō: fitted to the spline bowl's left, right and top
    (radius times `scale`, top kept where it was), entered at `start` degrees (screen angles: 90 is straight down,
    180 left, 270 up) and swept over the top to the point where a straight line leaves it on a tangent for `corner`."""
    xmin, xmax, ytop = spline_bowl[:, 0].min(), spline_bowl[:, 0].max(), spline_bowl[:, 1].min()
    r = (xmax - xmin) / 2 * scale
    c = np.array([(xmin + xmax) / 2, ytop + r])
    v = corner - c; dist = np.linalg.norm(v)
    phi, beta = math.atan2(v[1], v[0]), math.acos(r / dist)
    # of the two tangent points, the one where sweeping on (increasing angle) heads toward the corner
    for t in (phi + beta, phi - beta):
        P = c + r * np.array([math.cos(t), math.sin(t)]); d = np.array([-math.sin(t), math.cos(t)])
        if np.dot(corner - P, d) > 0: tT = t; break
    t0 = math.radians(start)
    while tT <= t0: tT += 2 * math.pi
    ts = np.linspace(t0, tT, 1500)
    return c[None, :] + r * np.c_[np.cos(ts), np.sin(ts)]

def two_skeleton(base_end=438.4, corner_r=1.3, bowl='spline', bowl_scale=1.0, bowl_start=143.0):
    # the 2 of v2-io-jaw.svg (path87), in absolute coordinates
    c1 = cubic((416.87437, -139.71163), (405.47745, -139.62593), (399.71791, -130.70481), (409.0397, -119.25064))
    c2 = cubic((413.15005, -125.06993), (404.58957, -136.63024), (429.42406, -137.17116), (421.62137, -125.82543))
    c3 = cubic((428.04475, -123.75683), (431.01492, -127.92787), (430.25532, -137.04704), (422.07612, -139.06671))
    c4 = cubic((422.07612, -139.06671), (420.24542, -139.51876), (418.5025, -139.72388), (416.87437, -139.71163))
    outer = np.vstack([c1[::-1], c4[::-1][1:], c3[::-1][1:]])   # from the terminal, over the top, to the diagonal
    head = (by_length(outer, 1500) + by_length(c2, 1500)) / 2
    corner = np.array([(404.72937 + 416.84956) / 2, (-101.91165 - 108.03531) / 2])
    if bowl == 'round':
        head = round_bowl(head, corner, bowl_scale, bowl_start)
    end = np.array([base_end, corner[1]])
    a, b, arc = fillet(head[-1], corner, end, corner_r)
    return np.vstack([head, line(head[-1], a)[1:], arc[1:], line(b, end)[1:]])

def v_skeleton(aim=(409.0, -106.4)):
    top = np.array([(383.8986 + 391.88) / 2, (-138.77503 - 138.71) / 2])   # middle of the top of the V stroke
    return line(top, np.array(aim), 400)

def resample(Q, step=1.0):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(Q, axis=0).T))]; s = np.arange(0, d[-1], step)
    return np.c_[np.interp(s, d, Q[:, 0]), np.interp(s, d, Q[:, 1])]

# ---------------------------------------------------------------- output

def trace(canvas, box, tmp):
    groups = []
    for k, name in enumerate(('edge', 'core')):
        pbm = os.path.join(tmp, name + '.pbm'); out = pbm[:-4] + '.svg'
        Image.fromarray(np.where(canvas[k] > 0.5, 0, 255).astype(np.uint8)).convert('1').save(pbm)
        subprocess.run(['potrace', pbm, '-s', '-o', out, '--turdsize', '8', '--alphamax', '1.0', '--opttolerance', '0.2', '--flat'], check=True)
        g = re.search(r'(<g transform="[^"]+")\s+fill="#000000" stroke="none">(.*?)</g>', open(out).read(), re.S)
        groups.append(g.groups())
    vb = ' '.join(str(int(v)) for v in box)
    def svg(ink, label):
        edge, core = INKS[ink]
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="v2 mark ({label})"><title>v2 mark ({label})</title>\n'
                f'{groups[0][0]} fill="{edge}" fill-opacity="0.88">{groups[0][1]}</g>\n{groups[1][0]} fill="{core}">{groups[1][1]}</g></svg>\n')
    return svg('sumi', 'sumi ink'), svg('vermilion', 'vermilion')

def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--ratio', type=float, default=0.13, help="stroke width as a fraction of the 2's height (0.13 measures about 12.4%%)")
    ap.add_argument('--out', default=os.path.dirname(HERE), help='directory for the SVGs and layout file')
    ap.add_argument('--bowl', choices=('spline', 'round'), default='round', help="the 2's head: the original logo's spline, or a true circle like the opening of an ensō")
    ap.add_argument('--bowl-scale', type=float, default=1.0, help='round bowl: radius relative to the spline bowl it is fitted to')
    ap.add_argument('--bowl-start', type=float, default=160.0, help='round bowl: where the brush touches down, in screen degrees (90 down, 180 left)')
    ap.add_argument('--round-start', type=float, default=0.6, help="round the brush's first touch over this many half-widths (0 keeps UDON's flat start; 1 is a full half-round)")
    a = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        S = round_start(udon_stroke(1, tmp), a.round_start)
        K = 61.0 * 0.0805 / a.ratio                 # pixels per skeleton unit: at 61, brush B is 8.05% of the height
        off = np.array([380, -142]); place = lambda Q: (Q - off) * K + 150
        canvas = np.zeros((2, int(46 * K + 300), int(64 * K + 300)))
        brush_along(canvas, S, resample(place(v_skeleton())), endstretch=0.45, mirror=True)
        two = two_skeleton(bowl=a.bowl, bowl_scale=a.bowl_scale, bowl_start=a.bowl_start)
        brush_along(canvas, S, resample(place(two)), endstretch=1.0, mirror=True)
        ys, xs = np.where((canvas[0] + canvas[1]) > 0.5); m = 30
        box = (xs.min() - m, ys.min() - m, xs.max() - xs.min() + 2 * m, ys.max() - ys.min() + 2 * m)
        sumi, verm = trace(canvas, box, tmp)
    open(os.path.join(a.out, 'v2-mark.svg'), 'w').write(sumi)
    open(os.path.join(a.out, 'v2-mark-vermilion.svg'), 'w').write(verm)
    # the lockup, as fractions of the mark's box: .io's left edge on its baseline (x of the width, y of the height),
    # and type sizes as fractions of the box's width. .io is 0.295 of the mark's height, as UDON is to its bowl;
    # the motto beneath is 0.11 of it.
    frac = lambda x, y: [round(float((place(np.array([x, y]))[0] - box[0]) / box[2]), 4), round(float((place(np.array([x, y]))[1] - box[1]) / box[3]), 4)]
    ink_h = (box[3] - 2 * m) / box[2]
    layout = {'io_baseline_left': frac(431.0, -111.6), 'io_font_size': round(float(0.295 * ink_h), 4),
              'motto_font_size': round(float(0.11 * ink_h), 4), 'aspect': round(float(box[2] / box[3]), 4)}
    json.dump(layout, open(os.path.join(a.out, 'v2-mark-layout.json'), 'w'), indent=1)
    print('wrote', a.out, layout)

if __name__ == '__main__':
    main()
