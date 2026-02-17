# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

v2.io is the website for "V2 — Developmental Foundation for Logozoetic Intelligence." Built with Bridgetown 2.1.1 (Ruby static site generator), Slim templating, and a custom baseline grid typography system. No CSS or JS frameworks — everything is hand-built.

## Commands

```sh
# Development (live reload, esbuild watch, port 4000)
bin/bridgetown start

# Production build
bin/bridgetown deploy

# Install dependencies
bundle install && npm install

# Baseline audit (Puppeteer, headless)
node scripts/baseline-audit.js
```

Rake tasks: `rake deploy` (default), `rake test` (build with BRIDGETOWN_ENV=test), `rake clean`.

There is no test suite. The `rake test` task just does a build in test mode.

## Architecture

### Template System

Slim is the primary template language, integrated via a local plugin (`lib/slim_support.rb`) because the official `bridgetown-slim` gem is deprecated for BT 2.x. The Bridgetown config (`config/initializers.rb`) sets `template_engine "erb"` as the fallback; Slim is layered on top. Markdown content pages use ERB for inline templating.

**Layout chain:** `default.slim` → `page.slim` / `post.slim` → content

**Components** follow Bridgetown's component pattern: Ruby class + Slim template with matching names in `src/_components/`. Rendered in layouts via `== render Shared::SiteHeader.new(metadata: site.metadata, resource: resource)`.

**Partials** live in `src/_partials/` with underscore-prefixed filenames. Rendered via `== render "head", metadata: site.metadata`.

### Baseline Grid System

This is the central design concern. All vertical spacing derives from a single unit:

- **Baseline unit:** 8px (`$baseline-unit: 0.5rem`)
- **Body line-height:** 24px (`$baseline: 1.5rem` = 3 units)

The system lives in two files:
- `frontend/styles/_baseline.scss` — Sass mixins (`baseline-text`, `baseline-spacing`), typography scale, grid overlay CSS, spacing utilities
- `frontend/javascript/index.js` — JS that measures actual baseline positions using a probe span, applies `translateY()` corrections, calculates `--grid-offset` for the overlay, and handles `.rule-above` elements

The `baseline-text($line-spans, $below, $above)` mixin sets line-height, margins, and exposes `--baseline-shift` for JS alignment. It uses `display: flow-root` to prevent margin collapse.

**Dev tools (development only):**
- `Ctrl/Cmd+G` — toggle baseline grid overlay (persisted in localStorage)
- `Ctrl/Cmd+B` — run baseline audit in console

### Frontend Build

esbuild bundles JS, Sass handles CSS, PostCSS runs autoprefixer. Config:
- `esbuild.config.js` — user overrides (edit this one)
- `config/esbuild.defaults.js` — **managed by Bridgetown, do not edit**

JS path aliases (`jsconfig.json`): `$styles/*`, `$javascript/*`, `$components/*`.

### Key Files

| Purpose | Path |
|---|---|
| Bridgetown config | `config/initializers.rb` |
| Slim integration | `lib/slim_support.rb` |
| Baseline grid (Sass) | `frontend/styles/_baseline.scss` |
| Main stylesheet | `frontend/styles/index.scss` |
| Baseline alignment (JS) | `frontend/javascript/index.js` |
| Root layout | `src/_layouts/default.slim` |
| Site metadata | `src/_data/site_metadata.yml` |
| Typography specimen | `src/typography.slim` |

## Conventions

- All vertical spacing must be multiples of 24px (the baseline). Use the `baseline-text` or `baseline-spacing` mixins; never set arbitrary margins or line-heights.
- Spacing utility classes: `.mt-0` through `.mt-6`, `.mb-0` through `.mb-6`, `.pt-0` through `.pt-6`, `.pb-0` through `.pb-6` (each step = 24px).
- `config/initializers.rb` requires a server restart after changes (not hot-reloaded).
- Ruby 4.0.0 (`.ruby-version`), Node >= 20.
