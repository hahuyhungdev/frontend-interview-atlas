# Build Tooling & Module Systems

Fills §16 of the [knowledge map](../frontend-knowledge-map.md) — Tooling, Build & Delivery. Webpack surfaces exactly once across the 23-article corpus, at Paytm Money, and stays at the surface: bundling, tree shaking, code splitting, loaders, plugins, no mechanics underneath. Vite, esbuild, module resolution, and lockfiles never come up at all. Almost everything below "what these tools do" here is professional knowledge added to complete the picture, not evidence of what this market actually asked.

---

# PART A — Why bundlers exist

## Q: Why do we bundle JavaScript at all?

**Answer.** Two separate historical problems, and bundlers solve both at once, which is why the tooling looks the way it does.

**Problem one: browsers had no module system.** Before ES modules shipped (broad support ~2017–2018), a script tag was the only unit of code. Every file either polluted one global scope or you hand-wired an IIFE/namespace pattern yourself. Node had `require`/`module.exports` (CommonJS) for server code, and tools like Browserify existed specifically to fake that same system in the browser by walking the `require` graph and concatenating everything into one file — that's the direct ancestor of what Webpack does today.

**Problem two: too many requests.** Even once you *could* ship separate files, a real app might import hundreds of small modules. On HTTP/1.1, browsers cap concurrent connections per origin (historically 6), so hundreds of waterfalled module requests were untenable. HTTP/2 multiplexing softened this, but it didn't eliminate it — per-request overhead, compression working better on one larger stream than many tiny ones, and the fact that most CDNs still benefit from long-lived cached bundles keeps bundling worthwhile even on modern transports.

**CommonJS vs ESM is the fork everything else in this doc depends on:**

```js
// CommonJS — synchronous, dynamic, resolved at runtime
const { groupBy } = require(condition ? "lodash" : "./local-groupby");
module.exports = { doThing };
// require() is a plain function call. You can branch on it, compute the
// specifier at runtime, call it conditionally inside an if. The bundler
// cannot know what you imported without actually running your code.

// ESM — static, analyzable at build time, resolved before execution
import { groupBy } from "lodash-es";
export function doThing() {}
// import/export must be top-level, and the specifier must be a string
// literal. No branching, no runtime-computed paths (dynamic import() is
// the deliberate escape hatch — see Part D). That rigidity is not a
// limitation, it's the entire feature: a tool can read the file WITHOUT
// running it and know exactly which bindings flow where.
```

That staticness is the one idea underneath tree shaking, code splitting, and most of what a modern bundler can do that Browserify-era CJS bundling couldn't.

**The interop pain is real and current.** A huge number of published packages still ship CommonJS. When ESM code imports a CJS module, there's no real "default export" on the other side — CJS just has `module.exports`, one value. Bundlers and TypeScript paper over this with an interop shim: if `module.exports` isn't already shaped like `{ default: ..., __esModule: true }`, wrap it as `{ default: module.exports }` so `import foo from "cjs-pkg"` works instead of you having to write `import * as fooNs from "cjs-pkg"` and then `fooNs.default` or `fooNs` itself, unpredictably, depending on the package. That's what `esModuleInterop` (and `allowSyntheticDefaultImports` for types only) controls in `tsconfig.json` — turning it off is why older TS codebases are full of `import * as React from "react"` instead of `import React from "react"`.

**The dual package hazard is where this stops being cosmetic.** A package can publish both a CJS and an ESM build and point to each via the `exports` field's `require`/`import` conditions (Part E). If your dependency graph ends up pulling that package in through both paths — one dependency requires it via CJS, another imports it via ESM — you get **two separate module instances**, each with its own module-level state. For a stateless utility this is harmless. For anything with module-scoped singletons — a React context created at module scope, a global cache, a class whose `instanceof` checks matter — you get bugs that look impossible: "I have one `<Provider>` but two contexts," or `x instanceof MyClass` returning `false` for an `x` that clearly came from `MyClass`. The fix is usually deduping the resolved version (Part G) or forcing a single condition; the diagnosis is checking whether the same package resolves to two different files in your lockfile.

---

# PART B — Tree shaking, precisely

## Q: How does tree shaking actually work?

**Answer.** Two passes, not one, and conflating them is the most common wrong answer.

**Pass one — usage analysis.** Because ESM `import`/`export` is static (Part A), the bundler can build an exact **module graph**: which files import which, and specifically which *named exports* each importer actually references. It marks exports that are never imported anywhere as unused. CommonJS defeats this pass entirely — `module.exports` is one opaque runtime value, and `require()` can be called conditionally, so there's no static list of "exports" to check usage against. This is the real reason CJS dependencies don't tree-shake: not that the bundler is lazy, but that the question "is this used?" isn't statically answerable for a dynamic system.

**Pass two — dead code elimination (DCE).** A minifier (Terser, esbuild's own minifier) then does the actual deletion: it drops code it can prove is unreachable — the unused-export bindings from pass one, plus anything that becomes unreachable as a result, like an `if (process.env.NODE_ENV === "production")` branch that gets statically resolved and its dead branch stripped. Tree shaking is these two passes working together, not a single step.

**Why `sideEffects: false` matters.** Even with a perfect module graph, the bundler still has to answer: "if I delete this whole module because nothing imports its named exports, could that break something?" A module might do nothing but export functions — safe to drop if unused. Or it might run code at import time that matters regardless of what's imported: register a global, patch a prototype, inject CSS. Without a signal, the bundler must conservatively assume the second case for *every* module, which kills tree shaking for whole packages even when 95% of their files are pure.

```json
{
  "name": "my-ui-lib",
  "sideEffects": ["*.css", "./src/polyfills.js"]
}
```

**The graded insight:** this line is a promise the package author makes to every consumer's bundler — "every other file here is safe to fully delete if none of its exports are used." Setting `sideEffects: false` blindly on a package that secretly does side-effectful work at module scope (a CSS import bundled into a component file, a `window.foo = ...` somewhere) doesn't error — it silently drops code that was actually needed, and the bug shows up as "this component's styles vanished in production" with nothing in the diff to point at.

**The trap — "why isn't tree shaking working on my import?"** This is the single most common real debugging scenario in this space, and it has two distinct causes people conflate:

```js
// ✗ Pulls in the entire library — lodash ships CJS by default.
// One big exports object; the bundler can't prove which properties
// are unused, so it can't safely delete any of them.
import _ from "lodash";
_.groupBy(items, "type");

// ✓ Deep import — reaches directly into the one CJS file that
// implements groupBy, bypassing the "one big object" problem entirely
// because now the whole file IS the thing you're importing.
import groupBy from "lodash/groupBy";

// ✓ Or use the real ESM build, which supports proper named-import
// tree shaking because it's actually built from ES modules.
import { groupBy } from "lodash-es";
```

**Barrel files are the second, sneakier cause.** A barrel (`components/index.ts` re-exporting everything) is fully ESM and fully static — in theory nothing here should stop tree shaking. In practice, many bundler configurations resolve and evaluate the barrel's *entire* module graph before the usage-analysis pass runs, especially through several layers of nested re-exports, or when any single file in that chain isn't marked side-effect-free. The result: importing one button from a 200-component barrel pulls dozens of unrelated components into the graph, and whether they actually get shaken out at the end depends on how aggressive the bundler's scope hoisting is, not just on ESM staticness. This is why large design systems increasingly recommend importing from the specific file (`@lib/components/Button`) rather than the package root, and why some bundlers ship an explicit "barrel file" optimization (transforming barrel re-exports into direct imports at build time) as a targeted fix rather than trusting general tree shaking to handle it.

---

# PART C — The bundler landscape, and why speed differs so much

## Q: Walk me through Webpack, esbuild/SWC, and Vite — and why one is so much faster than another.

**Answer.** They're solving overlapping problems with different constraints, and the speed gap isn't an accident of engineering quality — it's largely which language and which architecture each one committed to.

**Webpack: loaders transform, plugins orchestrate.** A **loader** turns a non-JS file into something the module graph can consume — `babel-loader` transpiles JS syntax, `css-loader` turns `@import`/`url()` into JS-resolvable dependencies, `sass-loader` compiles Sass to CSS first. Loaders run per-file, left to right, on the file's content. A **plugin** hooks into the broader compilation lifecycle — `HtmlWebpackPlugin` generates the final `index.html` with script tags injected after the graph is built; `MiniCssExtractPlugin` pulls CSS out of JS chunks into real `.css` files at the bundling stage, not the per-file stage. That's the actual distinction interviewers are checking for: loaders operate on one module's *content*; plugins operate on the *compilation as a whole*.

```js
// webpack.config.js (abridged)
module.exports = {
  module: {
    rules: [
      // loaders: content transform, per matched file
      { test: /\.tsx?$/, use: "babel-loader" },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, "css-loader"] },
    ],
  },
  plugins: [
    // plugins: hook into build-wide lifecycle events
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({ template: "./src/index.html" }),
  ],
  optimization: {
    usedExports: true, // enables the tree-shaking usage-analysis pass (Part B)
    minimize: true,    // Terser does the actual dead-code deletion
  },
};
```

**Why Webpack is slow relative to esbuild/SWC.** Webpack is written in JavaScript, running on Node's single main thread for most of its own logic (parsing, transform orchestration, the plugin lifecycle are largely synchronous JS callbacks). Parsing and transforming a large codebase is CPU-bound work that's naturally parallelizable — every file's parse is independent of every other file's — but a JS-based tool exploiting that requires explicit multi-process/worker orchestration, which most of the loader/plugin ecosystem was never built around.

**esbuild and SWC are written in Go and Rust.** Two things stack: native compiled code is simply faster per operation than interpreted/JIT'd JS for a tight parsing loop, and both use real OS-level threads across all CPU cores by default, without the ecosystem-compatibility tax Webpack carries. Parsing and transforming millions of lines is exactly the embarrassingly-parallel, CPU-bound workload that benefits most from this — it's not that esbuild is "cleverer," it's that the workload was always parallelizable and native multi-threaded code was finally built to exploit it.

**Vite: the dev server doesn't bundle at all.** This is the part people get wrong by analogy to Webpack dev server. In dev, Vite serves your source as **native, unbundled ESM** directly to the browser — an `import` in your code becomes a real HTTP request the browser itself resolves via its native module loader. There is no bundling step to run on startup or on save.

That has a specific, non-obvious consequence for HMR: **because there's no whole-app bundle, there's no "affected chunk" to recompute.** Webpack dev server, even with HMR, still has to run the changed module through its bundling pipeline and figure out which chunk(s) that module belongs to — work that scales with how the module graph is chunked, which loosely scales with app size. Vite only has to re-transform the *one file that changed* (a single esbuild call, sub-millisecond) and tell the browser to re-fetch just that module over the existing native ESM graph. HMR latency in Vite is close to constant regardless of app size; in Webpack it's incremental but still proportional to the affected part of the graph.

**Production still uses Rollup, not raw esbuild — and that's deliberate, not a compromise.** Vite's production build runs through Rollup, while esbuild is used only for **dependency pre-bundling**: converting CJS dependencies to ESM and merging deps that ship as hundreds of tiny files (a common `lodash-es`-style layout) into one file, so dev-mode native ESM doesn't waterfall hundreds of requests for a single library. Rollup does the actual production bundle because dev and prod are optimizing for genuinely different things:

| | Dev | Prod |
|---|---|---|
| Optimizes for | startup time, rebuild/HMR latency | final bundle size, long-term caching |
| Who pays the cost | you, locally, repeatedly | real users, once, over the network |
| Bundling happens | not at all (native ESM) | yes, with careful chunking |

Using the same tool for both would mean picking one target and being wrong for the other half the time — a fast-rebuild-optimized bundler tends not to produce the smallest, most cache-friendly output, and vice versa.

---

# PART D — Code splitting mechanics

## Q: What actually happens when you write `import()` or `React.lazy`?

**Answer.** `React.lazy` is a thin wrapper — the split point itself is a bundler concept, not a React one. ([`./02-react-core.md`](./02-react-core.md) and [`./03-react-advanced.md`](./03-react-advanced.md) cover the React-side API: how `lazy` turns a promise into something Suspense can render around, and how an error boundary catches a failed chunk load. This section is what's happening underneath that.)

The bundler statically scans for `import(...)` calls — the one place a *dynamic*, expression-based import is allowed in otherwise-static ESM. Every call site it finds becomes a **split point**: the bundler traces everything reachable only from that point, emits it as its own chunk file (with a content hash in the name for cache-busting), and replaces the call in the parent chunk with runtime glue that injects a `<script>` tag (or fetches, in an ESM-native setup) and resolves a promise once the chunk finishes loading and executing.

```js
// This one call is the entire signal. Nothing else marks a split point.
const SettingsPage = React.lazy(() =>
  import(/* webpackChunkName: "settings" */ "./SettingsPage")
);
// The magic comment names the emitted chunk file "settings.[hash].js"
// instead of a bare numeric ID — purely for reading a Network tab or
// a bundle analyzer treemap without guessing which chunk is which.
```

**Vendor/dependency chunking is a caching decision, not a size decision.** Splitting `node_modules` code into its own chunk, separate from your app code, means the two change on different schedules — your app code changes every deploy, your third-party dependencies change only when you bump a version. If both are hashed into one bundle, *any* app change invalidates the whole thing and every user re-downloads React, your date library, everything, on every deploy. Split them, and a deploy that only touches app code leaves `vendor.[hash].js` untouched — returning users' browsers serve it straight from cache.

```js
// webpack.config.js
optimization: {
  splitChunks: {
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: "vendor",
        chunks: "all",
        // The insight isn't "make a vendor bundle" — it's that vendor
        // code and app code have different *change frequencies*, and
        // caching only pays off when you split along that boundary.
      },
    },
  },
},
```

---

# PART E — Module resolution and package.json fields

## Q: How does a bare import specifier like `import x from "some-package"` actually resolve to a file?

**Answer.** In brief, Node's algorithm (which bundlers largely replicate for compatibility): for a relative or absolute specifier, resolve directly against the filesystem. For a **bare** specifier, walk up from the requiring file's directory, checking `<dir>/node_modules/some-package` at each level, all the way to the filesystem root, taking the first match. This is *why* `node_modules` nesting exists and why hoisting matters — a dependency needed by many packages gets hoisted as high as possible so the walk finds one shared copy instead of duplicating it at every level.

**Three competing package.json fields point at different entry files, and knowing why each exists is the actual question.**

- **`main`** — the oldest field, what a plain Node `require()` reads. Almost always a CommonJS file, for backward compatibility with everything that predates ESM tooling.
- **`module`** — never part of the Node spec, a convention bundlers started reading unofficially to find an ESM build of the same package, specifically so tree shaking (Part B) has something static to analyze. Node itself ignores it; only bundlers respect it.
- **`exports`** — the modern, official, and *strict* field. It's an explicit map of what's importable and under what conditions (`require` vs `import`, `node` vs `browser`), and it **replaces** `main`/`module` when present.

```json
{
  "name": "date-utils",
  "main": "./dist/index.cjs",
  "module": "./dist/index.esm.js",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs"
    },
    "./format": {
      "import": "./dist/format.esm.js",
      "require": "./dist/format.cjs"
    }
  }
}
```

**Why `exports` broke real code when packages adopted it.** Before `exports` existed, nothing stopped a consumer from doing a *deep import* straight into a package's internals — `import foo from "date-utils/dist/internal/foo"` worked simply because that file existed on disk and Node's resolution didn't know to say no. `exports` is an allowlist: anything not explicitly listed becomes unresolvable, full stop, even a path that worked yesterday. When popular packages added an `exports` field without also listing every legacy deep-import path people actually depended on, upgrading that one dependency broke builds with a resolution error, not a type error — often surfacing far from the actual import site. The fix on the consumer side is finding the now-official replacement subpath (`./format` above, versus the old internal path); on the package-author side it's deliberately listing every subpath you intend to keep supporting.

**Path aliases need to be configured twice, and that's the trap.** A `@/components/...`-style alias is a pure convenience over relative-path hell, but it lives in **two independent tools** that don't share config automatically:

```jsonc
// tsconfig.json — type-checker + editor only. Changes what TS
// resolves for type-checking and what your IDE jumps to. Does NOT
// change what the bundler actually emits.
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```js
// vite.config.ts — the bundler's own resolution. If this is missing
// or out of sync with tsconfig, the code type-checks fine, your editor
// autocompletes fine, and the BUILD fails with "cannot resolve module."
export default {
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
};
```

That mismatch is the "works in the editor, fails at build time" bug this shows up as almost every time someone adds a new alias and only updates one file.

---

# PART F — Source maps

## Q: What is a source map, actually, and how should devtool config differ between dev and prod?

**Answer.** A source map is a JSON file sitting next to your minified/transformed output, containing a `sources` array (the original file paths, optionally their full content) and a `mappings` string — a compact, VLQ-encoded (variable-length quantity) sequence that maps each meaningful position in the generated output back to a line and column in an original source file. When a debugger or an error tracker hits a stack frame in minified code, it looks up that position in `mappings` and shows you the original, readable location instead of `main.a3f9c2.js:1:48213`.

**The devtool spectrum is a rebuild-speed vs debuggability trade-off, and picking the wrong end for the wrong environment is the actual mistake.** Roughly, from cheapest to most expensive to generate: `eval` (wraps each module in `eval()` with a `//# sourceURL` comment — nearly free to produce, but the debugger experience is the ugliest) → `cheap-module-source-map` (real mapping but line-only, no column, faster to generate) → `source-map` (full line+column accuracy, slowest). Dev wants the cheap end because you regenerate it on every save and rebuild speed dominates. Production wants the accurate end because you generate it once, at build time, and pay that cost a single time in exchange for readable stack traces on every future error.

**Production source maps should be generated and privately uploaded, not publicly deployed.** Shipping a `.map` file alongside your bundle to the public internet means anyone can open devtools and read your original source — file structure, comments, internal logic, sometimes literal secrets someone left in a comment. But you still want the accuracy, so the real pattern is: generate the map at build time, upload it directly to your error-tracking service (Sentry or similar) as part of the deploy step, and never serve it from your public CDN path. The tracker de-minifies stack traces server-side, using the map it has privately, while end users' network tab never sees it. ([`./12-production.md`](./12-production.md) covers the observability side of this — release tagging, alerting on error-rate spikes — this is the piece that makes those stack traces readable in the first place.)

---

# PART G — Package management

## Q: Why do lockfiles exist, and what actually breaks without one?

**Answer.** Semver ranges in `package.json` are intentionally a *range*, not a pin — and that's exactly the problem a lockfile solves.

```text
"lodash": "^4.17.20"   // ^ = anything 4.x.x >= 4.17.20, up to but not 5.0.0
"lodash": "~4.17.20"   // ~ = anything 4.17.x >= 4.17.20, up to but not 4.18.0
"lodash": "4.17.20"    // exact — this version, always
```

Without a lockfile, resolving `^4.17.20` on Monday and again on Thursday can pick up two different actual published versions, because "latest matching 4.x.x" changes as new versions ship. Two developers running `npm install` a week apart, or CI running it on a different day than your laptop, can end up with a subtly different dependency tree — the classic "works on my machine." A lockfile pins the **exact resolved version (and often its content hash)** for every package in the tree, so `npm ci` (or the equivalent) installs are reproducible byte-for-byte across machines and time.

**The phantom dependency problem is the other lockfile-adjacent bug class, and it's genuinely common.** In a flat `node_modules` layout, a transitive dependency — something you never listed in your own `package.json`, only a dependency-of-a-dependency — often gets hoisted to the top level by the package manager's deduping algorithm. Your code can `import` it directly and it works, because it's physically sitting right there in `node_modules`. It keeps working right up until the direct dependency that was actually pulling it in gets upgraded, drops that transitive dependency, or the hoisting algorithm places it one level deeper — and now your import resolves to nothing, with no warning anywhere in your own manifest, because you never declared the dependency you were relying on. The fix is disciplined: if your code imports it, it belongs in your own `package.json`, full stop, regardless of whether something else happens to also depend on it. Tools like `pnpm`'s strict, non-flat `node_modules` structure exist specifically to make this class of bug impossible rather than just avoidable by discipline.

**Monorepos, briefly.** Workspaces let multiple packages share one lockfile and one `node_modules`, with cross-package references (`@myorg/ui` used inside `@myorg/web`) resolved via symlinks into the local package instead of hitting the registry. A task runner like Turborepo or Nx layers a **task graph** on top of the package graph — knowing that `web`'s build depends on `ui`'s build lets it order tasks correctly — plus **content-hash-based caching of task outputs**, so a change to one package doesn't force a full rebuild or retest of every package, only the ones actually affected by the change (and its dependents). One paragraph's worth of understanding is enough for an interview; the tooling itself is deep.

---

# PART H — A realistic debugging walkthrough

## Q: Your bundle size doubled after a routine dependency update. Walk me through finding out why.

**Answer — the actual sequence, in order, not a list of tools to know about:**

1. **Confirm the number and isolate the change.** Get the real gzipped size before and after (raw size lies — gzip ratios differ wildly between code shapes), and confirm it correlates with the dependency-bump PR specifically, not an unrelated change that landed the same day.
2. **Open a bundle analyzer.** `source-map-explorer`, `webpack-bundle-analyzer`, or Rollup's `rollup-plugin-visualizer` all render a treemap sized by actual shipped bytes. Diff the before/after treemap (or just look at which box got dramatically bigger) — this tells you *which module* grew, which turns a vague "the bundle is bigger" into a concrete "this specific package is now 400KB instead of 90KB."
3. **Check for duplicate versions of the same package.** The single most common cause after "a routine dependency bump." A peer-dependency range in the bumped package often changes, and some *other* dependency that used to resolve to the same shared version now resolves to a second, incompatible one — you end up shipping two copies of the same library instead of one deduped copy. Inspect the lockfile or run `npm ls <package>` to confirm more than one resolved version exists in the tree.
4. **Check whether a previously tree-shaken import became a full-module import.** Did the upstream package's new version drop `sideEffects: false`, switch its `module`/`exports` entry from an ESM build to CJS-only, or restructure its own barrel exports? Any of those silently turns a "we only use one function from this" import back into "we now ship the whole library," with no error anywhere — just a bigger box in the treemap.
5. **Fix at the resolution layer, not by avoiding the upgrade.** Pin or dedupe the doubled package with `overrides`/`resolutions`, or switch to the leaner import path if the tree-shaking regression is on the package's side. The point of steps 2–4 is that "roll back the whole dependency bump" is rarely the right fix — it's almost always one specific transitive resolution or one specific import site.

---

# PART I — What actually gets asked

## Q: "Explain tree shaking to me."

**Model answer.** Tree shaking is static usage analysis plus dead code elimination working together. Because ESM imports/exports are static — fixed at parse time, not computed at runtime — the bundler can build an exact graph of which exports are actually used, mark the rest as unused, and hand that off to the minifier to physically delete. It breaks on CommonJS because `require`/`module.exports` are dynamic; there's no static list of "exports" to check usage against. It also silently breaks on ESM code when a package doesn't declare `sideEffects: false`, because then the bundler has to conservatively assume every module might do something important just by being imported, whether or not anything in it is used.

## Q: "Why is Vite faster than Webpack in dev, specifically?"

**Model answer.** It's not that esbuild transforms are faster per file, though they are — it's architectural. Vite's dev server doesn't bundle the app at all; it serves native ESM straight to the browser and lets the browser's own module loader do the graph traversal. That means an HMR update only requires re-transforming the one file that changed, with no "which chunk does this belong to" recomputation, so update latency stays roughly constant regardless of app size. Webpack dev server, even with HMR, still runs changed modules through its bundling pipeline and updates the affected chunk, which is incremental but still scales with app size.

## Q: "Your bundle grew significantly after a version bump. How do you find out why?"

**Model answer.** I'd confirm the gzipped delta and correlate it to the actual PR first, since raw size can be misleading. Then open a bundle-analyzer treemap — `source-map-explorer` or `webpack-bundle-analyzer` — to see exactly which module got bigger. Most of the time it's one of two causes: a duplicated version of the same package, because a peer-dependency range shifted and something stopped deduping (check the lockfile for two resolved versions of the same name), or a previously tree-shaken import that quietly became a full-module import because the upstream package lost `sideEffects: false` or switched its entry from ESM to CJS-only. The fix is almost always scoped to that one resolution or import site, not a rollback of the whole bump.

---

## The seven sentences worth memorising

- ESM's staticness — no conditional imports, string-literal specifiers only — is the one property that makes tree shaking, and most modern bundler behavior, possible at all.
- Tree shaking is two passes: static usage analysis (what's actually imported) and dead code elimination (the minifier deleting what's provably unused) — not one step.
- `import _ from "lodash"` ships the whole library because lodash is CJS by default; `sideEffects: false` and barrel-file depth are the two things that quietly defeat tree shaking even on real ESM code.
- Vite's dev server isn't a faster bundler — it doesn't bundle at all in dev, which is why HMR latency stays flat as the app grows, unlike Webpack's incremental-but-still-scaling rebuild.
- The `exports` field in package.json is a strict allowlist that can break legacy deep imports the moment a package adopts it — that's a resolution error, not a type error, and it shows up far from the real cause.
- Path aliases live in tsconfig and the bundler config separately; forgetting one is exactly the "works in the editor, fails at build" bug.
- A lockfile pins the resolved tree for reproducibility; a phantom dependency is an undeclared import that only worked because hoisting happened to place it where you could reach it.

---

*Back to the [answer bank index](./README.md)*
