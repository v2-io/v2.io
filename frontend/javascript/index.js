import "$styles/index.scss"
import "$styles/syntax-highlighting.css"

// Import all JavaScript & CSS files from src/_components
import components from "$components/**/*.{js,jsx,js.rb,css}"

// =============================================================================
// Baseline Grid Toggle (Development Tool)
// =============================================================================

function initBaselineToggle() {
  const btn = document.querySelector('.baseline-toggle')
  if (!btn) return

  // Restore state from localStorage
  const savedState = localStorage.getItem('showBaseline')
  if (savedState === 'true') {
    document.documentElement.classList.add('show-baseline')
  }

  btn.addEventListener('click', () => {
    const isActive = document.documentElement.classList.toggle('show-baseline')
    localStorage.setItem('showBaseline', isActive)
  })

  // Keyboard shortcut: Ctrl/Cmd + G
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault()
      btn.click()
    }
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initBaselineToggle()
  initBaselineAlignment()
})

// =============================================================================
// Baseline Alignment System
// =============================================================================
//
// Two-phase approach to baseline grid alignment:
//
// Phase 1 — NORMALIZE: Walk block containers (ul, ol, blockquote, pre,
// .katex-display) and adjust their padding-bottom so each element's total
// vertical contribution (margin + height + margin) is a multiple of 24px.
// This is a layout change that propagates downward, preventing fractional
// drift from accumulating across the page.
//
// Phase 2 — ALIGN: Walk text elements and apply translateY corrections to
// snap baselines to grid lines. Because Phase 1 eliminated drift sources,
// all elements of the same type land at the same fractional grid position
// and receive the same correction — producing consistent visual spacing.
//

function getBaselinePosition(element) {
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;'
  const firstChild = element.firstChild
  if (firstChild) {
    element.insertBefore(probe, firstChild)
  } else {
    element.appendChild(probe)
  }
  const baseline = probe.getBoundingClientRect().top + window.scrollY
  element.removeChild(probe)
  return baseline
}

function initBaselineAlignment() {
  const GRID_UNIT = 24

  // =========================================================================
  // Phase 1: Normalize block containers
  // =========================================================================
  // Block containers (lists, blockquotes, code blocks, display math) can
  // have content heights that aren't multiples of 24px — inline KaTeX with
  // font-size:1.21em, sub-pixel rounding, wrapped lines with fractional
  // heights, etc. Each introduces a small drift that shifts ALL subsequent
  // content to a different fractional grid position.
  //
  // Fix: measure each container's total vertical contribution and pad it
  // to the next grid multiple. This is imperceptible (<24px of extra
  // padding-bottom) but ensures subsequent content stays grid-aligned.

  const blocks = document.querySelectorAll(
    'main ul, main ol, main blockquote, main pre, main .katex-display'
  )
  blocks.forEach(el => {
    const style = getComputedStyle(el)
    const marginTop = parseFloat(style.marginTop)
    const marginBottom = parseFloat(style.marginBottom)
    const height = el.getBoundingClientRect().height
    const total = marginTop + height + marginBottom
    const remainder = total % GRID_UNIT

    if (remainder > 0.5 && remainder < GRID_UNIT - 0.5) {
      const currentPadding = parseFloat(style.paddingBottom) || 0
      const adjustment = GRID_UNIT - remainder
      el.style.paddingBottom = `${currentPadding + adjustment}px`
    }
  })

  // =========================================================================
  // Phase 2: Align text baselines to grid
  // =========================================================================

  // Find first text element
  const firstText = document.querySelector('main h1, main h2, main h3, main p')
  if (!firstText) return

  // If first element has rule-above, adjust its padding first so border aligns
  if (firstText.classList.contains('rule-above')) {
    const tempBaseline = getBaselinePosition(firstText)
    const borderTop = firstText.getBoundingClientRect().top + window.scrollY
    const borderToBaseline = tempBaseline - borderTop

    const currentPadding = parseFloat(getComputedStyle(firstText).paddingTop) || 0
    const targetDistance = Math.round(borderToBaseline / GRID_UNIT) * GRID_UNIT
    const paddingAdjust = targetDistance - borderToBaseline

    if (Math.abs(paddingAdjust) > 0.5) {
      firstText.style.paddingTop = `${currentPadding + paddingAdjust}px`
    }
  }

  // Establish grid origin from first element's baseline
  const gridOrigin = getBaselinePosition(firstText)

  // Set grid offset for visual overlay
  const gridOffset = gridOrigin % GRID_UNIT
  document.documentElement.style.setProperty('--grid-offset', `${gridOffset}px`)

  // Correct each text element's baseline to the nearest grid line
  const elements = document.querySelectorAll(
    'main h1, main h2, main h3, main h4, main h5, main h6, main p, main li, main pre, main hr'
  )

  elements.forEach((el, i) => {
    let correction = 0

    // First element already handled above
    if (i === 0) return

    if (el.tagName === 'HR') {
      // Align HR to the grid line one line above the next element's baseline
      const nextEl = el.nextElementSibling
      if (nextEl) {
        const nextBaseline = getBaselinePosition(nextEl)
        const nextRelative = nextBaseline - gridOrigin
        const nextGridLine = Math.round(nextRelative / GRID_UNIT)
        const targetLine = nextGridLine - 1
        const hrTop = el.getBoundingClientRect().top + window.scrollY
        const hrRelative = hrTop - gridOrigin
        correction = (targetLine * GRID_UNIT) - hrRelative
      }
    } else if (el.classList.contains('rule-above')) {
      // Make border-to-baseline distance a multiple of 24, then align baseline
      const baseline = getBaselinePosition(el)
      const borderTop = el.getBoundingClientRect().top + window.scrollY
      const borderToBaseline = baseline - borderTop

      const currentPadding = parseFloat(getComputedStyle(el).paddingTop) || 0
      const targetDistance = Math.round(borderToBaseline / GRID_UNIT) * GRID_UNIT
      const paddingAdjust = targetDistance - borderToBaseline

      if (Math.abs(paddingAdjust) > 0.5) {
        el.style.paddingTop = `${currentPadding + paddingAdjust}px`
      }

      const newBaseline = getBaselinePosition(el)
      const baselineRel = newBaseline - gridOrigin
      const targetLine = Math.round(baselineRel / GRID_UNIT)
      correction = (targetLine * GRID_UNIT) - baselineRel
    } else {
      const baseline = getBaselinePosition(el)
      const relativePos = baseline - gridOrigin
      const targetLine = Math.round(relativePos / GRID_UNIT)
      const expectedPos = targetLine * GRID_UNIT
      correction = expectedPos - relativePos
    }

    if (Math.abs(correction) > 0.5) {
      el.style.transform = `translateY(${correction}px)`
    }
  })
}

// =============================================================================
// Baseline Audit Tool (Development)
// =============================================================================
// Measures actual baseline positions and checks grid alignment.
// Usage: Press Ctrl+B or call window.baselineAudit() from console.

function baselineAudit() {
  const GRID_UNIT = 24

  const selectors = 'main h1, main h2, main h3, main h4, main h5, main h6, main p, main li, main blockquote p, main pre'
  const elements = document.querySelectorAll(selectors)
  const hrs = document.querySelectorAll('main hr')

  const results = []
  let gridOrigin = null

  elements.forEach((el, i) => {
    const baseline = getBaselinePosition(el)
    const tag = el.tagName.toLowerCase()
    const text = el.textContent.trim().slice(0, 40) + (el.textContent.length > 40 ? '...' : '')

    if (gridOrigin === null) {
      gridOrigin = baseline
    }

    const relativePos = baseline - gridOrigin
    const gridLines = relativePos / GRID_UNIT
    const nearestLine = Math.round(gridLines)
    const offset = relativePos - (nearestLine * GRID_UNIT)
    const onGrid = Math.abs(offset) < 1

    results.push({
      index: i,
      tag,
      text,
      baseline: Math.round(baseline * 10) / 10,
      relativeToOrigin: Math.round(relativePos * 10) / 10,
      gridLines: Math.round(gridLines * 100) / 100,
      nearestLine,
      offsetPx: Math.round(offset * 10) / 10,
      onGrid
    })
  })

  const hrResults = []
  hrs.forEach((hr, i) => {
    const rect = hr.getBoundingClientRect()
    const topPos = rect.top + window.scrollY
    const relativePos = topPos - gridOrigin
    const gridLines = relativePos / GRID_UNIT
    const nearestLine = Math.round(gridLines)
    const offset = relativePos - (nearestLine * GRID_UNIT)

    hrResults.push({
      index: i,
      type: 'hr',
      topPosition: Math.round(topPos * 10) / 10,
      relativeToOrigin: Math.round(relativePos * 10) / 10,
      gridLines: Math.round(gridLines * 100) / 100,
      offsetPx: Math.round(offset * 10) / 10,
      onGrid: Math.abs(offset) < 1
    })
  })

  const onGridCount = results.filter(r => r.onGrid).length
  const offGridItems = results.filter(r => !r.onGrid)

  console.log('=== BASELINE AUDIT ===')
  console.log(`Grid origin (first baseline): ${gridOrigin}px`)
  console.log(`Grid unit: ${GRID_UNIT}px`)
  console.log(`Text elements: ${onGridCount}/${results.length} on grid`)
  console.log(`HRs: ${hrResults.filter(r => r.onGrid).length}/${hrResults.length} on grid`)

  if (offGridItems.length > 0) {
    console.log('\n--- OFF-GRID ELEMENTS ---')
    console.table(offGridItems.map(r => ({
      tag: r.tag,
      text: r.text,
      offset: `${r.offsetPx}px`,
      gridLines: r.gridLines
    })))
  }

  console.log('\n--- FULL RESULTS ---')
  console.table(results.map(r => ({
    tag: r.tag,
    baseline: r.baseline,
    gridLines: r.gridLines,
    offset: r.offsetPx,
    ok: r.onGrid ? '✓' : '✗'
  })))

  if (hrResults.length > 0) {
    console.log('\n--- HR POSITIONS ---')
    console.table(hrResults)
  }

  return { gridOrigin, gridUnit: GRID_UNIT, results, hrResults }
}

// Keyboard shortcut: Ctrl+B for baseline audit
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    baselineAudit()
  }
})

window.baselineAudit = baselineAudit
