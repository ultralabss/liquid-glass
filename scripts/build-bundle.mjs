#!/usr/bin/env node
// Builds dist/ul-glass.js (window.UL) from src/index.ts. Usage: node scripts/build-bundle.mjs [--min]
// --min also writes dist/ul-glass.min.js + dist/ul-glass.min.js.map (production: window.__UL_PROD__ = true disables dev warnings).
// Same output as the in-browser build used in the design tool: TS/TSX → CJS modules in one IIFE, CSS inlined, React external (window.React).
import { build } from 'esbuild';
import { runCheckLocked } from './check-locked.mjs';
if (runCheckLocked(process.cwd()).diffs.length) process.exit(1); // locked timings guard (run from design-system/)
await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'iife', globalName: 'UL', outfile: 'dist/ul-glass.js', loader: { '.css': 'text' }, external: ['react', 'react-dom'], jsx: 'transform', minify: false,
  banner: { js: 'var require = (n) => n === "react" ? window.React : n === "react-dom" ? window.ReactDOM : undefined;' },
  footer: { js: 'window.dispatchEvent(new Event("ul:ready"));' } });
// standalone stylesheet for apps that load CSS separately (same rules the JS bundle injects)
await build({ entryPoints: ['src/index.ts'], bundle: true, outdir: 'dist/.css-tmp', loader: { '.css': 'css' }, external: ['react', 'react-dom'], jsx: 'transform', write: true });
const { renameSync, rmSync, existsSync } = await import('node:fs');
if (existsSync('dist/.css-tmp/index.css')) renameSync('dist/.css-tmp/index.css', 'dist/ul-glass.css');
rmSync('dist/.css-tmp', { recursive: true, force: true });
if (process.argv.includes('--min')) {
  await build({ entryPoints: ['src/index.ts'], bundle: true, format: 'iife', globalName: 'UL', outfile: 'dist/ul-glass.min.js', loader: { '.css': 'text' }, external: ['react', 'react-dom'], jsx: 'transform',
    minify: true, sourcemap: 'external', legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' },
    banner: { js: 'window.__UL_PROD__=true;var require=(n)=>n==="react"?window.React:n==="react-dom"?window.ReactDOM:undefined;' },
    footer: { js: 'window.dispatchEvent(new Event("ul:ready"));' } });
  console.log('dist/ul-glass.min.js + .map written');
}
console.log('dist/ul-glass.js + dist/ul-glass.css written');
