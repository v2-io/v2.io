# v2.io

Single static landing page for [v2.io](https://v2.io), served via GitHub Pages from the `main` branch root.

- `index.html` — the page (no build step; it loads Inter and Crimson Text from Google Fonts and the mark and props from `brand/`)
- `CNAME` — custom domain binding (`v2.io`)
- `.nojekyll` — disables Jekyll processing on GitHub Pages
- `brand/` — the v2 brush mark, the 真 seal, the lockup specimen, and the script that draws the mark (its README says how)
- `.archive/` — explorations set aside, each folder with a README (published with the rest of the root, like `_archive/`)
- `_archive/` — the prior Bridgetown scaffold and exploration material, preserved in place for reference. Underscore-prefix is conventional for "do not deploy" but `.nojekyll` means there is no build step anyway; the directory is simply ignored by anything that expects an `index.html` at the root.

To edit the page: edit `index.html` and push to `main`. GitHub Pages re-publishes within a minute or two.
