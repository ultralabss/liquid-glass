# Release checklist — @ultralabs/glass 0.1.0 (owner)

Run from `design-system/` in a terminal with Node 20+ unless a step says otherwise. Stop at the first failing step and fix it before going on.

## Blockers to clear before step 1
- **License.** MIT applied (package.json + LICENSE, holder "Ultra Labs": confirm the legal name). Done.
- **First ESM + types build.** Verified 2026-11-10: `build:release` exit 0; `build:types` also runs scripts/fix-dts-extensions.mjs (rewrites `.ts`/`.tsx` specifiers in dist/types to `.js`). Step 4 recreates them.

## 1. Clean install
```bash
rm -rf node_modules package-lock.json && npm install
```
## 2. Typecheck
```bash
npm run typecheck 2>&1 | tee typecheck.txt | grep -c "error TS"     # must print 0
```
## 3. Guards
```bash
npm run check:locked      # "42 checked, 0 differences"
npm run check:tokens      # 0 undefined (27 unused = reserved, docs/tokens-reserved.md)
npm run check:callbacks   # 0 violations
npm run check:jsdoc       # coverage + defaults, 0 mismatch
npm run check:api         # "API surface matches docs/api-surface.txt"; a diff means the public API changed: review, then npm run api:snapshot
```
## 4. Build
```bash
npm run build:release     # tokens → callbacks → tokens check → window.UL bundle + min → dist/esm → dist/types
ls dist/esm/index.js dist/types/src/index.d.ts
npm run check:pack        # tarball contents + size (limits: packed 2.5 MB, unpacked 9 MB)
```
Confirm `grep -rE "from '[^']+\.tsx?'" dist/types | wc -l` prints 0 (step 9 type-checks the .d.ts from a consumer with skipLibCheck:false).

## 5. Focused test runs (Chrome, focused tab, ≥ 100 Hz display)
Open `showcase/focused-runs.dc.html` (one link per card, refresh-rate warning below 100 Hz). Single card = `showcase/motion-test.dc.html?norun&card=<id>`.
- ×5 each: `material`, `hitarea`, `otplayout`, `nested3`, `feed`, `select`, `modal`, `cmd`, `ctx`, `coveredanchor` (select / modal / cmd / ctx cold-first: reload before each run).
- ×1: `kbdaudit` (focused tab; also clears the NEEDS FOCUS list).
- ×5 timing: `collheight`, `tglide`, `advtip`, `zoomsmooth`, `streamperf`, `charttip`, `chartdraw`, `chartperf`.
- ×5: the `f3d_*` cards (hovercard, menubar, navmenu, nativeselect, calendar, aspect, resizable, carousel, typography).
- ×1 full: motion-test (autorun), `showcase/lens-tests.dc.html`, `showcase/viewport-tests.dc.html?frame=1280`, `?frame=924`, `?frame=375` (frame on screen).
A virtual-clock pass is WARN, not PASS. Record results in docs/session-progress.md.

## 6. npm audit
```bash
npm audit --json > audit.json; npm audit
npm ls <package>          # for the moderate finding: who pulls it in
```
- Identify the package and its path. All current devDependencies (typescript, esbuild, @types/*) are dev-only; the library has **no runtime dependencies** (React is a peer), so a finding under them does not ship to consumers.
- Dev-only: fix with `npm audit fix` if it is a non-breaking bump, otherwise document it in CHANGELOG "Known limits" with the package, path and advisory id.
- Runtime (would only happen if a dependency was added): fix before publishing.

## 7. Tag
```bash
git status                # clean
git tag -a v0.1.0 -m "@ultralabs/glass 0.1.0" && git push origin v0.1.0
```
## 8. Publish
```bash
# remove "private": true from package.json (and commit) only now
npm run check:pack -- --strict
npm publish --dry-run --access public    # read the file list and the size
npm publish --access public              # needs npm login + 2FA on the @ultralabs scope
```
## 9. Post-publish install test (scratch Vite + React 19 app)
`examples/vite-smoke` (not published) imports the package like a consumer: tokens.css + dist/ul-glass.css, ULProvider material switch, ULAccentScope, a text field, a switch, a button, a ULModal, a ULLineChart.
```bash
npm pack                                   # before publishing: test the tarball → ultralabs-glass-0.1.0.tgz
cd examples/vite-smoke && npm install && npm run build && npm run dev
# after publishing: npm install @ultralabs/glass@0.1.0 (replace the file: dependency) and repeat
```
Check by eye: glass renders over the gradient; Glass → Flat switches the field / button material; the dialog morphs from its button and returns focus on close; the chart draws and shows the value tooltip; no console errors; `npm run build` has 0 type errors (consumer types work).

## Rollback
- Bad release found within 72 hours and nobody depends on it: `npm unpublish @ultralabs/glass@0.1.0` (npm only allows this within 72 h, and the same version number can never be published again; fix and publish 0.1.1).
- After 72 hours (or with dependents): `npm deprecate @ultralabs/glass@0.1.0 "Broken: use 0.1.1"`, publish the fix as 0.1.1, and move the `latest` dist-tag if needed (`npm dist-tag add @ultralabs/glass@0.1.1 latest`).
- Never delete the git tag of a published version; add a new one.
