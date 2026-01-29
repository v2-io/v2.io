#!/usr/bin/env node
/**
 * Automated Baseline Audit Script
 *
 * Runs the baseline audit in a headless browser and outputs results to a file.
 * Usage: node scripts/baseline-audit.js
 *
 * Results are written to: scripts/baseline-audit-results.json
 */

import puppeteer from 'puppeteer';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const RESULTS_FILE = path.join(__dirname, 'baseline-audit-results.json');
const PORT = 8765;

// Simple static file server
function createServer() {
  return http.createServer((req, res) => {
    console.log('REQUEST:', req.url);
    let filePath = path.join(OUTPUT_DIR, req.url === '/' ? 'index.html' : req.url);

    // Handle paths without extensions (Bridgetown pretty URLs)
    if (!path.extname(filePath)) {
      // If it's a directory path (with or without trailing slash), serve index.html
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.log('404:', filePath, '-', err.code);
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(data);
    });
  });
}

async function runAudit() {
  console.log('Starting baseline audit...');

  // Start server
  const server = createServer();
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Server running on http://localhost:${PORT}`);

  // Launch browser
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Navigate to typography page
  await page.goto(`http://localhost:${PORT}/typography/`, {
    waitUntil: 'networkidle0'
  });
  console.log('Page loaded');

  // Check what scripts are in the page
  const scriptSrcs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
  );
  console.log('Script sources found:', scriptSrcs);

  // Wait for page JS to initialize and apply baseline corrections
  await new Promise(r => setTimeout(r, 1000));

  // Run the audit
  const results = await page.evaluate(() => {
    // The baselineAudit function is defined in the page's JS
    if (typeof window.baselineAudit === 'function') {
      return window.baselineAudit();
    }
    // Debug info
    return {
      error: 'baselineAudit function not found',
      windowKeys: Object.keys(window).filter(k => k.includes('baseline')),
      scripts: Array.from(document.scripts).map(s => s.src)
    };
  });

  // Check for errors
  if (results.error) {
    console.error('Audit error:', results.error);
    console.log('Window baseline keys:', results.windowKeys);
    console.log('Scripts loaded:', results.scripts);
  }

  // Calculate summary stats
  const summary = {
    timestamp: new Date().toISOString(),
    totalElements: results.results?.length || 0,
    onGrid: results.results?.filter(r => r.onGrid).length || 0,
    offGrid: results.results?.filter(r => !r.onGrid).length || 0,
    hrsOnGrid: results.hrResults?.filter(r => r.onGrid).length || 0,
    hrsTotal: results.hrResults?.length || 0,
    maxOffset: Math.max(...(results.results?.map(r => Math.abs(r.offsetPx)) || [0])),
    avgOffset: results.results?.length
      ? (results.results.reduce((sum, r) => sum + Math.abs(r.offsetPx), 0) / results.results.length).toFixed(2)
      : 0,
  };

  const output = {
    summary,
    gridOrigin: results.gridOrigin,
    gridUnit: results.gridUnit,
    elements: results.results,
    hrs: results.hrResults,
  };

  // Write results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(output, null, 2));
  console.log(`Results written to: ${RESULTS_FILE}`);

  // Print summary
  console.log('\n=== BASELINE AUDIT SUMMARY ===');
  console.log(`Elements on grid: ${summary.onGrid}/${summary.totalElements}`);
  console.log(`HRs on grid: ${summary.hrsOnGrid}/${summary.hrsTotal}`);
  console.log(`Max offset: ${summary.maxOffset.toFixed(1)}px`);
  console.log(`Avg offset: ${summary.avgOffset}px`);

  // Print off-grid elements
  const offGrid = results.results?.filter(r => !r.onGrid) || [];
  if (offGrid.length > 0) {
    console.log('\n--- Off-grid elements (first 10) ---');
    offGrid.slice(0, 10).forEach(el => {
      console.log(`  ${el.tag}: ${el.offsetPx.toFixed(1)}px off (line ${el.gridLines.toFixed(2)})`);
    });
    if (offGrid.length > 10) {
      console.log(`  ... and ${offGrid.length - 10} more`);
    }
  }

  // Cleanup
  await browser.close();
  server.close();

  console.log('\nDone!');
  return output;
}

runAudit().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
