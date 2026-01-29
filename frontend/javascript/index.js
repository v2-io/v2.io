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
// Since CSS can't access font metrics at compile time, we use JavaScript to
// measure actual baseline positions and apply corrections at runtime.
//
// This ensures perfect baseline alignment regardless of font variations.

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

  // Find first text element
  const firstText = document.querySelector('main h1, main h2, main h3, main p')
  if (!firstText) return

  // If first element has rule-above, adjust its padding first so border aligns
  // We'll calculate grid origin from its baseline AFTER this adjustment
  if (firstText.classList.contains('rule-above')) {
    // We need to pick a grid origin first to know where to put the border
    // Use the baseline as origin, then adjust padding so border is at a grid multiple above
    const tempBaseline = getBaselinePosition(firstText)
    const borderTop = firstText.getBoundingClientRect().top + window.scrollY
    const borderToBaseline = tempBaseline - borderTop // distance from border to baseline

    // We want border at (baseline - N*24) for some integer N
    // Currently border is at (baseline - borderToBaseline)
    // So we need borderToBaseline to be a multiple of 24
    const currentPadding = parseFloat(getComputedStyle(firstText).paddingTop) || 0
    const targetDistance = Math.round(borderToBaseline / GRID_UNIT) * GRID_UNIT
    const paddingAdjust = targetDistance - borderToBaseline

    if (Math.abs(paddingAdjust) > 0.5) {
      firstText.style.paddingTop = `${currentPadding + paddingAdjust}px`
    }
  }

  // NOW calculate grid origin from (possibly adjusted) first element
  const gridOrigin = getBaselinePosition(firstText)

  // Set grid offset for visual overlay
  const gridOffset = gridOrigin % GRID_UNIT
  document.documentElement.style.setProperty('--grid-offset', `${gridOffset}px`)

  // Find all text elements and calculate corrections
  const elements = document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6, main p, main li, main pre, main hr')

  elements.forEach((el, i) => {
    let correction = 0

    // First element already handled above
    if (i === 0) return

    if (el.tagName === 'HR') {
      // For HRs, align to the grid line ONE line above the next element's baseline
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
      // For rule-above elements, we need BOTH border AND baseline on grid
      // 1. First calculate baseline correction (like normal elements)
      const baseline = getBaselinePosition(el)
      const baselineRel = baseline - gridOrigin
      const baselineTarget = Math.round(baselineRel / GRID_UNIT)
      correction = (baselineTarget * GRID_UNIT) - baselineRel

      // 2. After baseline correction, figure out where border lands
      const borderTop = el.getBoundingClientRect().top + window.scrollY
      const correctedBorder = borderTop + correction
      const borderRel = correctedBorder - gridOrigin
      const borderOffset = borderRel % GRID_UNIT

      // 3. Adjust padding to shift border onto nearest grid line
      // If border is 10px past a grid line, reduce padding by 10px
      // If border is 14px past (closer to next line), increase padding by 10px
      const currentPadding = parseFloat(getComputedStyle(el).paddingTop) || 0
      let paddingAdjust = 0
      if (borderOffset > GRID_UNIT / 2) {
        // Closer to next grid line - increase padding
        paddingAdjust = GRID_UNIT - borderOffset
      } else {
        // Closer to previous grid line - decrease padding
        paddingAdjust = -borderOffset
      }

      if (Math.abs(paddingAdjust) > 0.5) {
        el.style.paddingTop = `${currentPadding + paddingAdjust}px`
        // Re-measure baseline after padding change and recalculate correction
        const newBaseline = getBaselinePosition(el)
        const newBaselineRel = newBaseline - gridOrigin
        correction = (baselineTarget * GRID_UNIT) - newBaselineRel
      }
    } else {
      const baseline = getBaselinePosition(el)
      const relativePos = baseline - gridOrigin
      const targetLine = Math.round(relativePos / GRID_UNIT)
      const expectedPos = targetLine * GRID_UNIT
      correction = expectedPos - relativePos
    }

    // Only apply correction if it's more than 0.5px
    if (Math.abs(correction) > 0.5) {
      // Use transform for visual-only shift (doesn't affect layout/siblings)
      el.style.transform = `translateY(${correction}px)`
    }
  })

  console.log('Baseline alignment applied')
}

// =============================================================================
// Baseline Audit Tool (Development)
// =============================================================================
// Measures actual baseline positions and checks grid alignment.
// Usage: Press Ctrl+B or call window.baselineAudit() from console.
// Note: Uses getBaselinePosition defined in Baseline Alignment System above.

function baselineAudit() {
  const GRID_UNIT = 24 // pixels (1.5rem at 16px root)

  // Find all text elements in main content
  const selectors = 'main h1, main h2, main h3, main h4, main h5, main h6, main p, main li, main blockquote p, main pre'
  const elements = document.querySelectorAll(selectors)

  // Also measure HRs (should land on grid lines)
  const hrs = document.querySelectorAll('main hr')

  const results = []
  let gridOrigin = null

  elements.forEach((el, i) => {
    const baseline = getBaselinePosition(el)
    const tag = el.tagName.toLowerCase()
    const text = el.textContent.trim().slice(0, 40) + (el.textContent.length > 40 ? '...' : '')

    // Use first element's baseline as grid origin
    if (gridOrigin === null) {
      gridOrigin = baseline
    }

    // Calculate offset from grid
    const relativePos = baseline - gridOrigin
    const gridLines = relativePos / GRID_UNIT
    const nearestLine = Math.round(gridLines)
    const offset = relativePos - (nearestLine * GRID_UNIT)
    const onGrid = Math.abs(offset) < 1 // within 1px tolerance

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

  // Measure HRs separately
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

  // Summary
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

  // Return structured data for programmatic use
  return { gridOrigin, gridUnit: GRID_UNIT, results, hrResults }
}

// Keyboard shortcut: Ctrl+B for baseline audit
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault()
    baselineAudit()
  }
})

// Expose globally for console access
window.baselineAudit = baselineAudit
