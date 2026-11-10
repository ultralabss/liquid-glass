# License options (not applied: owner decides)

Both leave `"private": true` in place; remove it only at the publish step. `check:pack` accepts any non-empty `license`.

## Option A: MIT (public / open source)
```diff
--- package.json
+++ package.json
@@
   "version": "0.1.0",
+  "license": "MIT",
   "private": true,
```
New file `LICENSE` (holder name to confirm):
```
MIT License

Copyright (c) 2026 Ultra Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
Publish: `npm publish --access public` (needs `@ultralabs` scope on npmjs.com).

## Option B: UNLICENSED + private registry (registry.ultralabs.dev)
```diff
--- package.json
+++ package.json
@@
   "version": "0.1.0",
+  "license": "UNLICENSED",
   "private": true,
@@
+  "publishConfig": { "registry": "https://registry.ultralabs.dev", "access": "restricted" },
   "files": [
```
Consumers: `.npmrc` with `@ultralabs:registry=https://registry.ultralabs.dev` plus auth token (never commit the token). Optional `LICENSE` file: "Copyright (c) 2026 Ultra Labs. All rights reserved." (npm needs none for UNLICENSED.)
Note: the registry host must exist and accept the token before the publish step.
