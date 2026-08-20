# Frontend Knowledge Map — Everything to Cover, Categorized

Companion to [`frontend-react-insights.md`](./frontend-react-insights.md). That document analyzes *what the crawled corpus showed*. This one is the **complete coverage map**: every concept area a senior frontend engineer is expected to hold, organized into 18 categories.

## How to read the priority marks

| Mark | Meaning |
|---|---|
| ★★★ | **Decides outcomes.** High frequency in the crawled corpus, or named as an explicit rejection reason. Learn to explain, not recognize. |
| ★★ | **Expected.** Appears repeatedly; absence is noticed. |
| ★ | **Asked occasionally.** Know it exists, can discuss it. |
| ○ | **Not in the corpus** — added to complete the map. Standard professional requirement, but unmeasured by this dataset. Verify against your target market. |

Corpus = 23 substantive interview write-ups, 19 companies, SDE-2/SSE frontend, May 2025–Aug 2026.

---

# A. THE LANGUAGE LAYER

## 1. JavaScript Core ★★★

*The single highest-leverage category. More rejections in the corpus traced here than to any other area.*

**Scope & binding**
- Lexical scope, scope chain, execution context ★★★
- Hoisting: `var` vs `let`/`const`, the **Temporal Dead Zone** (accessing `let` before declaration → `ReferenceError`, not `undefined`) ★★
- **Closures** — private state, counters, factories, why they retain memory ★★★
- `this` resolution: method call vs standalone call vs `new` vs explicit binding ★★★
- Arrow functions bind `this` **lexically** and cannot be re-bound — the classic trap ★★★
- `call` / `apply` / `bind`, including partial application via `bind` ★★

**Objects & the prototype system**
- Prototype chain lookup: `arr.__proto__ === Array.prototype`, `Array.prototype.__proto__ === Object.prototype` ★★★
- Constructor functions vs ES6 classes vs factory functions ★★
- Why a `prototype` method **cannot** close over constructor-local variables ★★★
- Property descriptors, `Object.freeze`, getters/setters ★
- Reference vs value semantics; `{} === {}` is `false` ★★
- Shallow copy (`Object.assign`, spread) vs **deep clone** (recursive, `structuredClone`, the `JSON.parse(JSON.stringify())` hack and its losses: `undefined`, functions, `Date`, `Map`, cycles) ★★

**Types & coercion**
- Primitive vs reference types; the full `typeof` table incl. `typeof null === "object"` ★★
- Coercion order: `valueOf()` → `toString()` → primitive ★★
- `==` vs `===`, truthy/falsy, `??` vs `||`, optional chaining ★★
- Number precision, `toFixed` rounding surprises ★

**Functions & functional style**
- Higher-order functions, function composition ★★
- **Currying** — fixed-arity and infinite (`sum(1)(2)(3)()`), which requires coercion via `toString`/`valueOf` ★★★
- Method chaining / fluent APIs ★★
- Pure functions, immutability discipline ★★
- IIFE, module pattern, revealing module pattern ★

**Arrays & collections**
- `map` / `filter` / `reduce` / `flat` / `flatMap` / `some` / `every` / `find` ★★★
- Which methods **mutate** (`sort`, `splice`, `reverse`, `push`) vs return new references ★★
- `forEach` vs `map` — pick by intent, not micro-performance ★★
- `Set`, `Map`, `WeakMap`/`WeakSet` (and why Weak variants matter for caches) ★★
- Iterators, generators, `Symbol.iterator` ★

**Modern syntax**
- Destructuring, spread/rest, template literals, default params ★★
- ES Modules vs CommonJS; named vs default exports; tree-shakeability ★★
- Labeled/optional catch, logical assignment operators ○

---

## 2. Asynchronous JavaScript & the Runtime ★★★

*Asked in 8+ loops. Named as the rejection reason at Okta (twice) and LinkedIn.*

**The event loop — must be explainable aloud, not memorized**
- Call stack → **microtask queue drained completely** → *one* macrotask → repeat ★★★
- Microtasks: `Promise.then`, `queueMicrotask`, `await` continuations, `MutationObserver` ★★★
- Macrotasks: `setTimeout`, `setInterval`, I/O, UI events, `setImmediate` (Node) ★★★
- Microtasks can starve macrotasks; the reverse never happens ★★
- Where **rendering** fits: the browser paints between macrotasks, after microtasks drain ★★
- `requestAnimationFrame` vs `setTimeout(0)` vs `requestIdleCallback` ★

**Promises**
- States, `then`/`catch`/`finally`, chaining and the flattening rule ★★★
- `Promise.all` / `allSettled` / `race` / `any` — and when each is right ★★★
- **Sequential vs parallel execution** — building a `promiseAllSync` by chaining `.then` accumulators ★★★
- Error propagation through chains; unhandled rejections ★★
- `async`/`await` as syntax over promises; `await` in loops (sequential!) vs `Promise.all` ★★★
- Writing async control flow **without** `async/await` — explicitly demanded at MakeMyTrip and Goibibo ★★

**Async patterns you will be asked to implement**
- `debounce` (delay until quiet) and `throttle` (cap rate) — and knowing which fits which use case ★★★
- `retry(fn, attempts)` with backoff ★★
- Timeout wrapper via `Promise.race` against a rejecting timer ★★
- `AbortController` for cancelling in-flight requests ★★★
- **Race-condition guarding**: stale responses overwriting fresh ones (request IDs or abort) ★★★
- Concurrency limiting / task queue / scheduler ★★

**Memory**
- Stack vs heap, garbage collection, reachability ★★
- Leak sources: uncleared **timers**, un-removed **event listeners**, retaining **closures**, **detached DOM nodes** ★★★
- Unbounded caches (why `memoize` needs an eviction story) ★★

---

# B. THE PLATFORM LAYER

## 3. Browser & Web Platform ★★

- The critical rendering path: parse HTML → DOM, CSS → CSSOM → render tree → layout → paint → composite ★★
- **`async` vs `defer`** on `<script>`: `defer` preserves order and waits for parse (default choice); `async` fires on arrival and can block parsing ★★★
- Reflow vs repaint vs composite; which CSS properties are cheap to animate (`transform`, `opacity`) ★★
- DOM APIs: query/traverse/create, `getBoundingClientRect()`, `IntersectionObserver`, `ResizeObserver`, `MutationObserver` ★★
- **Event model**: capture → target → bubble, `stopPropagation` vs `preventDefault` ★★
- **Event delegation** — one parent listener instead of N child listeners; explicitly asked at LinkedIn ★★★
- Storage: `localStorage` / `sessionStorage` / cookies / IndexedDB — size, sync-vs-async, expiry, security ★★
- `fetch`, `XMLHttpRequest`, streaming responses ★★
- **WebSockets** and **Server-Sent Events** — when each beats polling ★★
- Web Workers, Service Workers, offline/PWA ○
- Browser rendering of very long lists → **virtualization** ★★

---

## 4. HTML & Semantics ★★

- Semantic elements (`header`, `nav`, `main`, `section`, `article`, `aside`, `footer`) and why div-soup is a graded negative ★★★
- Headings as a document outline, landmark roles ★★
- Forms: labels, `input` types, native validation, `fieldset`/`legend` ★★
- Metadata: `<meta charset>`, viewport, Open Graph, canonical links ★★
- HTML5 additions: drag & drop, `<canvas>`, `<video>`/`<audio>`, `<dialog>`, `<details>` ★
- Images: `srcset`/`sizes`, `loading="lazy"`, `fetchpriority`, explicit `width`/`height` to prevent CLS ★★

---

## 5. CSS & Layout ★★

*Underweighted by React-first candidates. Cost real rounds at Amazon, BrowserStack, LinkedIn.*

- **Flexbox** — main/cross axis, `flex-grow`/`shrink`/`basis`, alignment ★★★
- **CSS Grid** — template areas, implicit vs explicit tracks, `minmax`, `auto-fit`/`auto-fill` ★★★
- **Positioning** — static/relative/absolute/fixed/sticky, containing blocks ★★★
- Centering a div, every way (flex, grid, absolute + `translate(-50%)`, margin auto) — literal interview question ★★
- The box model, `box-sizing`, margin collapsing ★★
- **Stacking contexts and `z-index`** — why `z-index: 9999` doesn't work ★★
- Specificity, cascade, inheritance, `!important` as a smell ★★
- Selectors: combinators, pseudo-classes (`:focus-visible`, `:has`), **pseudo-elements** (`::before`, `::first-line` — and that they don't chain) ★★
- Transforms, transitions, keyframe animations, `matrix()`/`rotate()` ★★
- Responsive: media queries, container queries, fluid type with `clamp()` ★★
- **Custom properties (CSS variables)** as the token layer ★★
- Units: `rem`/`em`/`ch`/`vw`/`dvh`, and when each is correct ★★
- Modern color: `oklch`, `color-mix` ○
- Methodologies: BEM, CSS Modules, CSS-in-JS, Tailwind — and their trade-offs ★
- **Pixel-perfect reproduction from a mockup**, live, without a framework ★★★

---

## 6. Accessibility ★★★

*Explicitly graded at Moniepoint, JioHotstar, Cult.fit, LinkedIn, MakeMyTrip. Treated as a requirement, not a bonus.*

- **Keyboard navigation** — full operability without a mouse; arrow keys within composites, Tab between them ★★★
- **Focus management** — visible focus rings, focus trapping in modals, restoring focus on close ★★★
- ARIA roles for composite widgets: `tablist`/`tab`/`tabpanel`, `combobox`/`listbox`/`option`, `menu`, `dialog` ★★★
- ARIA state/relationship attributes: `aria-selected`, `aria-expanded`, `aria-controls`, `aria-labelledby`, `aria-describedby`, `aria-activedescendant` ★★★
- Live regions (`aria-live`) for async results and errors ★★
- The first rule of ARIA: use the native element instead, when one exists ★★
- Screen reader mental model; accessible names ★★
- Color contrast (WCAG AA 4.5:1 body), touch target sizing ★★
- `prefers-reduced-motion` ○
- Automated auditing (axe, Lighthouse) ○

**The reference exercise:** build Tabs with `useTabs` + context, arrow-key nav, Enter/Space activation, full ARIA wiring, visible focus ring, TypeScript with no `any`. That single component exercises this entire category.

---

# C. THE FRAMEWORK LAYER

## 7. React — Core Mental Model ★★★

- Declarative rendering; UI as a function of state ★★★
- **Reconciliation** and the diffing algorithm ★★★
- **Component identity** — same position + same type = same instance; how **keys** determine identity, and why index-as-key breaks reorder/insert ★★★
- What triggers a render: state change, parent render, context change ★★★
- Render vs commit phase; why render must be pure ★★
- **Fiber** — interruptible work, priority lanes (conceptual level) ★★
- Virtual DOM: what it is, and honestly, what it isn't (not "faster than the DOM") ★★
- Mount / update / unmount and when cleanup functions run ★★★
- Batching of state updates ★★
- Controlled vs uncontrolled components ★★
- Strict Mode double-invocation in development ★
- Concurrent rendering, `useTransition`, `useDeferredValue` ★
- Suspense, `React.lazy`, and code splitting ★★
- Error boundaries ○
- Portals ○

## 8. React — Hooks ★★★

- `useState` — functional updates, why `setState(x)` in a loop needs the updater form ★★★
- `useEffect` — dependency arrays, cleanup, the mental model of *synchronization* not *lifecycle* ★★★
- **`useEffect` vs `useLayoutEffect`** — paint timing; explicitly asked at BrowserStack ★★
- `useRef` — mutable box that doesn't trigger renders; DOM refs; the "is first render" pattern ★★★
- `useMemo` / `useCallback` — and the discipline of *not* reaching for them by default ★★★
- `useContext` and its re-render characteristics ★★
- `useReducer` for complex/coupled state transitions ★★
- **Rules of Hooks** and why they exist (call order) ★★
- **Custom hooks** — the primary reuse mechanism. Canonical builds: `useDebounce`, `useFetch`, `useDidUpdate`, `useTabs`, `useOnClickOutside`, `useLocalStorage` ★★★
- **Stale closures** in effects and callbacks — the most common real bug ★★★
- `useId`, `useSyncExternalStore`, `useImperativeHandle` ○

## 9. React — Performance ★★★

*Dominant React topic across the corpus. But note: over-memoization is a graded negative.*

- Diagnosing with the **React DevTools Profiler** ★★★
- The five planted bugs of the debugging round: **excess re-renders, missing dependency arrays, expensive computation in render, incorrect list keys, uncleared timers** ★★★
- `React.memo` — only where props are genuinely stable ★★★
- Structural fixes *before* memoization: lift state **down**, split components, pass `children` as props ★★★
- **Derived state over stored state** — two pieces of state that must agree is a bug waiting to happen ★★★
- Referential stability of objects/arrays/functions passed as props ★★
- List virtualization for long lists ★★
- Code splitting, `React.lazy` vs dynamic `import()`, route-level splitting ★★
- Context splitting to limit re-render blast radius ★★
- When `useMemo` is **wrong**: cheap renders, added complexity, no measured win ★★★

## 10. React — Patterns & Architecture ★★★

- **Compound components** (context + subcomponents, `Tabs.List` / `Tabs.Tab` / `Tabs.Panel`) ★★★
- Container / presentational split ★★
- Render props and headless components (behavior separate from markup) ★★
- **Recursive components** for trees — file explorers, nested comments ★★★
- **Immutable deep updates** into a tree without mutation ★★★
- **State normalization** — `{ [id]: node }` maps vs nested trees ★★
- Component **API design**: prop naming, sensible defaults, escape hatches, composition over configuration ★★★
- Reusability for a **design system** — the stated BrowserStack rejection reason ★★★
- Feature-based folder architecture; where hooks/services/utils/store live ★★
- Prop drilling vs context vs store — knowing the threshold ★★

---

## 11. TypeScript ★

*Explicitly required only at Moniepoint ("no `any`, correct generics") — but the market baseline is rising.*

- Structural typing, interfaces vs type aliases ★
- Generics, constraints, defaults ★
- Union/intersection, discriminated unions, exhaustiveness checks ★
- `unknown` vs `any` vs `never` ★
- Utility types: `Partial`, `Pick`, `Omit`, `Record`, `ReturnType` ★
- Typing React: props, children, refs, events, generic components ★
- Type narrowing and guards ○
- `satisfies`, const assertions, template literal types ○

---

# D. THE APPLICATION LAYER

## 12. State Management & Data Fetching ★★

- The four distinct kinds of state: **server, client, URL, form** — and not conflating them ★★
- Context API: use, limits, re-render cost ★★
- Redux: store/actions/reducers; **Redux Saga** generators, `takeLatest` vs `takeEvery` ★
- Modern stores (Zustand, Jotai) ○
- **Server state libraries** (TanStack Query, SWR): caching, stale-while-revalidate, invalidation ○
- **URL as state** — filters, sort, pagination, active tab ○
- Optimistic updates with rollback ○
- Data fetching correctness: loading / empty / error states, retries, **cancellation**, **race conditions**, deduplication, pagination and infinite scroll ★★★
- Form state and validation ★

## 13. Machine Coding — The Component Catalog ★★★

*Build each once, properly: keyboard + ARIA + loading/empty/error + cleanup. Ordered by corpus frequency.*

| # | Component | Core challenge |
|---|---|---|
| 1 | **Autocomplete / debounced search** (7 companies) | Debounce, `AbortController`, race conditions, keyboard nav, caching, match highlighting, all UI states |
| 2 | **Reusable Dropdown / Select** (3) | Compound API, outside-click, focus management, full ARIA combobox |
| 3 | **Pagination with ellipsis** (3) | Edge-case math, `1 … 4 5 6 … 10`, disabled states, keyboard |
| 4 | **Recursive tree** — file explorer, nested comments (3) | Recursive render, immutable deep insert/delete, expand/collapse, selection |
| 5 | **Queued sequential progress bars** (3) | Queue data structure, timer management, cleanup, no stale state |
| 6 | **Data table** (2) | Search + sort + paginate, derived state, loading/empty |
| 7 | **Shopping cart** (2) | Derived totals, quantity updates, disabled checkout |
| 8 | **Dynamic n×n grid** (2) | Derived max, immutable grid update, avoiding redundant state |
| 9 | **Tooltip / hover card** (2) | `getBoundingClientRect`, placement math, resize recalc, one shared node |
| 10 | **Tabs (compound)** (1, full spec) | Context + custom hook + arrow keys + complete ARIA + TS |
| — | Stopwatch, star rating (half-fill SVG), infinite scroll, multi-step tracker, currency calculator, modal, carousel, toast system | Timers, SVG gradients, `IntersectionObserver`, state machines, portals + focus trap |

## 14. Frontend System Design ★★★

**The reusable answer skeleton:**
1. **Gather requirements and drive** — interviewers deliberately leave the brief broad ★★★
2. **Rendering strategy per surface, with a reason** — CSR / SSR / SSG / ISR ★★★
3. **Component architecture and data flow** — decomposition, boundaries, API shape ★★★
4. **Caching layers**: Browser → CDN → Server → Database ★★
5. **Realtime transport**: polling vs WebSocket vs SSE, and updating only the affected widget ★★
6. **SEO** when server-rendering: sitemap, canonical URLs, Open Graph, structured data, robots.txt ★★
7. **Auth**: JWT, role-based access control, public vs protected surfaces ★★
8. **Back-of-the-envelope estimation** — reasoning about scale, not exact numbers ★★
9. **Trade-offs stated explicitly** — the thing actually being graded ★★★

**Recurring problems:** content publishing platform, e-commerce PDP, financial analytics dashboard, social feed with hover cards, autocomplete as a design-system primitive, generic analytics/tracking layer, pluggable logging library.

**Design patterns, applied to frontend** ★★
- **Adapter + Strategy + dependency injection** — a logger supporting Sentry/Datadog/Mixpanel behind one API
- **Observer / EventEmitter** — pub-sub
- **Singleton** — shared client instances
- **Factory**, **Module**, config-driven architecture
- Interviewers ask *where these are useful in real frontend apps*, not for definitions

## 15. Performance & Core Web Vitals ★★

- **LCP** < 2.5s, **INP** < 200ms, **CLS** < 0.1, plus FCP and TTFB ★★
- Measurement: Lighthouse, RUM, `PerformanceObserver`, Web Vitals library ★★
- **Loading**: code splitting, dynamic imports, lazy loading, preload/prefetch, critical CSS ★★
- **Rendering**: memoization, virtualization, avoiding layout thrash, compositor-friendly animation ★★
- **Network**: caching headers, compression, CDN, HTTP/2-3, request waterfalls ★★
- **Assets**: image formats (AVIF/WebP), responsive images, font subsetting, `font-display: swap` ★★
- Bundle budgets and analysis ★
- **Have one real story ready**: what you measured, what you changed, what moved ★★★

---

# E. THE ENGINEERING LAYER

## 16. Tooling, Build & Delivery ★

- Webpack: bundling, loaders, plugins, **tree shaking**, code splitting ★
- Vite / esbuild / SWC, dev server vs production build ○
- Module resolution, source maps ○
- Package management, lockfiles, semver ○
- Linting/formatting (ESLint, Prettier), pre-commit hooks ○
- CI/CD, preview deploys, feature flags and staged rollout ★
- Monitoring in production: error tracking, event logging, API failure tracking, session replay ★★ *(MakeMyTrip's hiring-manager round went straight here)*

## 17. Testing ○

*Zero coverage across all 23 articles — a genuine gap in this corpus, not a signal that it doesn't matter.*

- Unit testing utilities, hooks, reducers ○
- React Testing Library: query by role/label, test behavior not implementation ○
- Mocking network (MSW), fake timers for debounce/throttle ○
- Integration and E2E (Playwright, Cypress) ○
- Visual regression, accessibility assertions in tests ○
- What to test vs what not to; coverage as a floor, not a goal ○

## 18. Security & Networking ★

- **HTTP**: methods, status codes, **idempotency**, safe methods, REST principles ★
- Headers, caching semantics (`Cache-Control`, `ETag`), CORS and preflight ★
- **XSS** — never inject unsanitized HTML; `dangerouslySetInnerHTML` discipline; sanitizing user-authored Markdown (raised in the Okta publishing-platform design) ★
- CSRF, SameSite cookies ○
- CSP, SRI, secure headers ○
- Auth token storage: cookie vs `localStorage` trade-offs ○
- Client-side validation is UX; server-side validation is security ★
- Never trust the client; secrets never ship to the browser ○

---

# F. SUPPORTING

## 19. DSA for Frontend ★★

*Necessary but no longer sufficient — and only two companies made it the primary gate.*

- Hash maps / sets for O(n) lookups (longest consecutive sequence, missing number, Nth largest) ★★
- Two pointers, sliding window ★★
- Recursion and DFS/BFS — **plus the iterative, stack-based equivalent**, which was explicitly demanded ★★
- Trees: traversals, BST properties, path problems ★★
- **LRU cache** (hash map + doubly linked list) ★★
- Basic DP (longest common substring) ★
- Kadane's algorithm; graph cycle detection; transitive closure ★
- Complexity analysis stated aloud for every solution ★★★

## 20. Design Systems ★★

- **Design tokens** — semantic naming (`text-secondary`, `surface`, `success`) over raw values ★★
- Migrating hardcoded values → tokens; theming and dark mode ★★
- Component API consistency across a library ★★
- Documentation, versioning, adoption ★
- Designer/developer collaboration workflow ★★

## 21. Engineering Maturity & Behavioral ★★★

*Two loops in the corpus died here after clean technicals. This is not soft padding.*

- **STAR framework** for every story ★★★
- Resume deep dive — be ready to justify **every** technology and decision you list ★★★
- Ownership, conflict resolution, mentoring, cross-team collaboration ★★
- Difficult technical decisions and their trade-offs ★★
- Debugging war stories ★★
- **"Why are you looking for a change?" / relocation / long-term commitment** — prepare this as deliberately as the coding ★★★
- Product thinking: metrics, analytics, feature rollout, working with PMs and designers ★★
- Agile/Scrum process vocabulary ★

---

# Coverage Summary

| Layer | Categories | Corpus weight |
|---|---|---|
| **Language** | JavaScript Core, Async & Runtime | ★★★ — *the deciding layer* |
| **Platform** | Browser, HTML, CSS, Accessibility | ★★ – ★★★ |
| **Framework** | React core, hooks, performance, patterns; TypeScript | ★★★ |
| **Application** | State & data, machine coding, system design, performance | ★★★ |
| **Engineering** | Tooling, testing, security | ★ – ○ *(largest gap)* |
| **Supporting** | DSA, design systems, behavioral | ★★ – ★★★ |

**If you cover only five things:** the event loop explained aloud → autocomplete-with-debounce built completely → closures/prototypes/`this` at depth → five-minute React re-render debugging → the relocation/retention narrative.

**Largest gap between this map and the corpus:** testing (absent entirely), TypeScript depth, modern server-state libraries, and React 19/RSC. Those are ○ here because this dataset didn't measure them — not because they're safe to skip.
