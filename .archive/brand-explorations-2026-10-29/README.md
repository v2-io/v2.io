# v2 mark explorations, 2026-10-29

The routes tried on the way to the brush mark in `../../brand/`, kept for reference. Each was set aside for the reason given.

## `gemini/`

Gemini's renderings of a brush-stroke v2 with `.io`, VIS VERITATIS and a 真 seal: two raster images (one with a dry-brush end to the v, one with a rounded end) and Gemini's own vector trace of the rounded one. The 真 seal in `../../brand/v2-seal.svg` is cut from that trace. Its brush strokes were not used: they keep thin white streaks inside the strokes, and the generator left a hard vertical edge in the tone of the 2's base (a straight seam at about x 1140 in the rasters).

## `gemini-trace/`

A potrace trace of the dry-brush raster in three ink tones, with the white streaks inside the strokes closed and that seam removed (`v2-trace-three-tones*.svg`). It looks right large but its strokes are twice UDON's relative weight (15.9% of the height against 7.6%), which fills in at small sizes. Thinning it afterwards (`thinning-attempt.png`) reached the weight but broke the brush ends: a narrower brush makes a different gesture, so it has to be drawn at that weight. Also here: the motto in Cinzel against Science Gothic.

## `momo-ligature/`

A v2 cut from Momo Trust Sans's own v and 2 at one weight, with the v's right arm running into the 2's terminal (`lig.py` builds it from the font's outlines). Keeping the 2 intact forces an S-bend in the joining stroke, or, kerned tighter, pushes the 2's foot into the v. `single-stroke-geometric.png` is an earlier single-stroke construction that drifted back toward the old geometric 2.

## `flat-geometry/`

The earlier v2 logos set flat in the design system's inks with `.io` in our faces, and plain type studies in Science Gothic and Momo Trust Display.

## `brush-passes/`

The brush mark as it developed, the UDON stroke mapped along a skeleton path each time: on a skeleton with Gemini's proportions (1); on the original logo's skeleton at UDON's own weight, too thin (2); with a geometric ellipse for the bowl, smooth but not the original's curve (3); on the original's Béziers at 12.4%, with the V as in the original and re-aimed into the 2's corner (4: the re-aimed one is the mark now in `brand/`, the exact one is `v2-exact-geometry*.svg` here); and the words in Science Gothic against Inter (5).
