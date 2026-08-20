# Frontend & React: What the Crawled Corpus Actually Tells You

**Source:** `data/crawled_posts.json` — 26 crawled entries from Gourav Hammad / *Frontend Army* (Medium), of which 23 carry substantive content. 19 distinct companies, interview loops dated **May 2025 – August 2026**, almost all at the **SDE-2 / SSE / Senior Frontend** level in the Indian + remote market.

**Outcomes in the corpus:** 3 positive (CoinDCX SSE-1 *selected*, Oracle on-campus *selected*, Tessell *offer declined*), 14 explicit rejections, the rest ghosted or unreported. That skew matters — this is mostly a corpus of **near-misses**, which makes the stated rejection reasons the single most valuable signal in the whole dataset.

---

## Part 1 — The Five Insights That Change How You Prepare

### 1. DSA is no longer the gate for frontend roles. Machine coding is.

Of 19 companies, only **Amazon** and **PayPal** ran a full DSA-first loop. Oracle and Tessell used DSA as one round among many. Every other company — BrowserStack, LinkedIn, Goibibo, MakeMyTrip, CoinDCX, Cult.fit, JioHotstar, Moniepoint, Paytm Money, Okta, Wayfair — led with **machine coding + JavaScript internals**, and several said so explicitly:

> "Unlike interviews that focus heavily on Data Structures & Algorithms, LinkedIn evaluates how well you can build scalable user interfaces, reason about browser behavior, write clean JavaScript, and make sound engineering decisions." — *LinkedIn Sr FE*

> "Unlike companies that emphasize DSA, BrowserStack primarily evaluates your ability to build scalable frontend applications, write clean React code, create pixel-perfect UIs, and reason about frontend architecture." — *BrowserStack*

**Implication:** time spent past ~medium-level LeetCode has a poor return for frontend. Time spent building the ~10 canonical components (below) has an excellent one.

### 2. The rejections are for JavaScript internals — almost never for React.

This is the strongest pattern in the corpus. Read the stated feedback:

| Company | Stated rejection reason |
|---|---|
| **Okta** (45 LPA) | "my JavaScript fundamentals — particularly around asynchronous execution and JavaScript internals — needed to be stronger" |
| **Okta** (2nd loop) | "primary feedback was around JavaScript fundamentals… async execution, Event Loop, Promise internals, memory management, browser behavior" |
| **LinkedIn** | Strong in UI engineering, HTML/CSS, DSA, design — "**one question about JavaScript internals significantly impacted the final evaluation**" |
| **BrowserStack** | "my understanding of designing **reusable UI components** — particularly autocomplete as part of a design system — needed improvement" |
| **Goibibo / MakeMyTrip** | Debugging *speed* on an existing codebase, not correctness |

Nobody was rejected for not knowing React APIs. They were rejected for the layer underneath React (event loop, prototypes, memory, `this`) and the layer above it (component API design, reusability, trade-off articulation).

### 3. A meaningful share of rejections have nothing to do with your skill.

**JioHotstar** and **Cult.fit** both: technical rounds went well, then a 2-month gap, HR reassignment, the original role got filled, the candidate was remapped to a different team, and the Hiring Manager round became a relocation/retention interrogation. Both rejected. **Certa** ghosted after a clean 90-minute assessment. **Deel** rejected at the behavioral round after passing every technical stage.

**Implication:** don't recalibrate your whole prep plan off a single rejection. Do prepare the retention narrative ("why this role, why now, will you stay") as deliberately as you prepare the coding — it terminated two otherwise-successful loops in this corpus.

### 4. Debugging an existing codebase is a graded, timed skill — and nobody practices it.

Three companies ran a "here is a broken repo" round: **Goibibo**, **MakeMyTrip**, **Wayfair**.

> "I was able to solve the problem in approximately 20 minutes. However, the interviewer expected the issue to be identified and fixed within **5 minutes**. It became clear that debugging speed was being evaluated as much as correctness." — *Goibibo, Round 4*

The bugs planted, per MakeMyTrip, were a fixed menu: **excessive re-renders, missing dependency arrays, expensive calculations inside render, incorrect list keys, memory leaks from uncleared timers**. Learn to spot those five in under five minutes with React DevTools Profiler.

### 5. The machine-coding question bank is small, finite, and repeats across companies.

You are not facing infinite variety. You are facing about ten components. Frequency across the corpus:

| Component | Companies asking | Count |
|---|---|---|
| **Autocomplete / search with debounce** | BrowserStack, Goibibo, MakeMyTrip ×2, Paytm Money, Deel, Moniepoint | **7** |
| **Reusable Dropdown / Select (a11y-graded)** | JioHotstar ×2, Cult.fit | 3 |
| **Pagination with ellipsis** | MakeMyTrip ×2, Goibibo | 3 |
| **Recursive tree** (file explorer, nested comments) | MakeMyTrip ×2, Goibibo | 3 |
| **Sequential/queued progress bars** | MakeMyTrip ×2, Goibibo | 3 |
| **Data table** (search + sort + paginate + empty/loading) | BrowserStack, Paytm Money | 2 |
| **Shopping cart** | PayPal, CoinDCX | 2 |
| **Dynamic n×n grid** | Okta ×2 | 2 |
| **Tooltip with positioning** | LinkedIn, Paytm Money (feed hover) | 2 |
| **Tabs as compound component** | Moniepoint (full spec: TS + a11y + custom hook) | 1 |
| Stopwatch, Star rating (half-fill SVG), Infinite scroll, Currency calculator, Multi-step tracker | Paytm, Apple, MakeMyTrip, PayPal, MakeMyTrip | 1 each |

**Build all ten. Once each, properly — with keyboard support, ARIA, loading/empty/error states, and cleanup.** That covers most of the surface area of this entire market.

---

## Part 2 — JavaScript: The Depth That Decides Outcomes

### 2.1 The event loop is the #1 theory topic

Asked at **Okta ×2, JioHotstar ×2, Cult.fit, Oracle, Paytm Money, Certa, Apple** — 8+ loops. And it's asked *explanatorily*, not as trivia:

> "The interviewer expected a detailed explanation of the execution order rather than simply predicting the output." — *Oracle*
> "focused on understanding whether I genuinely understood JavaScript internals rather than memorized outputs." — *JioHotstar*

The canonical snippet (Okta):

```javascript
console.log(1);
setTimeout(() => console.log(2));
Promise.resolve().then(() => console.log(3));
console.log(4);
// 1, 4, 3, 2
```

The explanation you must be able to give unprompted: synchronous code runs to completion → the microtask queue (Promise callbacks, `queueMicrotask`, `await` continuations) is **drained entirely** → *then* one macrotask (`setTimeout`, I/O, events) runs → repeat. Microtasks starve macrotasks, not the reverse.

The `async`/`await` variant (Certa):

```javascript
async function test() {
  console.log(1);
  await delay();     // returns control to the caller here
  console.log(2);
}
test();
console.log(3);
// 1, 3, 2
```

### 2.2 Adjacent internals that came up repeatedly

| Topic | Where | What they actually probe |
|---|---|---|
| **Closures & lexical scope** | Nearly every loop | Private state, counters, currying, why memoize works, closure-retained memory |
| **Prototype chain** | CoinDCX (deep), LinkedIn, Apple, Paytm | `arr.__proto__ === Array.prototype`, `Array.prototype.__proto__ === Object.prototype`, why prototype methods can't see constructor-local vars |
| **`this` binding / arrow functions** | Certa, MakeMyTrip, Goibibo | Method call vs detached call vs arrow lexical binding |
| **Memory management** | Okta ×2 | Stack vs heap, GC, leaks from listeners / timers / closures / **detached DOM nodes** |
| **`async` vs `defer`** | Okta ×2 | `defer` preserves order + waits for parse; `async` executes on arrival and can block parsing. Default to `defer`. |
| **TDZ & hoisting** | Certa, Paytm | `let`/`const` before declaration → `ReferenceError`, not `undefined` |
| **Type coercion** | LinkedIn | `valueOf()` / `toString()` primitive conversion order |

The LinkedIn closure/prototype question is worth internalizing in full — it's the exact shape that cost that candidate the offer:

```javascript
function Foo(x) {
  function bar() { return x; }        // private — not on the instance
  this.baz = function () { return x; }; // closes over x ✓
}
Foo.prototype.baz = function () { return x; }; // ✗ x is not in scope here

const obj = new Foo(10);
obj.baz();  // 10 — the instance property shadows the prototype method
obj.bar();  // TypeError — bar was never exposed
```

### 2.3 The polyfill / utility set that recurs

Write each of these from scratch, from memory, without looking:

| Utility | Asked at | Concept under test |
|---|---|---|
| `debounce` | Oracle, Paytm, + implicit in every autocomplete | Closures, `clearTimeout`, `this`/`args` forwarding |
| `throttle` | Okta, Oracle | Rate limiting vs delay — know *when* each applies |
| `memoize` | LinkedIn, CoinDCX | HOF, cache key strategy, **cache invalidation & unbounded growth** |
| `Array.prototype.flat` | CoinDCX, Goibibo, MakeMyTrip | Recursive **and** iterative (stack-based) — both were demanded |
| `Array.prototype.map` | Oracle, Apple | Prototype augmentation, full callback signature `(el, i, arr)` |
| `groupBy` | PayPal, MakeMyTrip | `reduce`, object accumulation |
| **`promiseAllSync`** (sequential, no `async/await`) | Goibibo, MakeMyTrip | Promise chaining, order preservation, closure capture in loops |
| `retry(fn, n)` | MakeMyTrip | Recursive async flow, no `async/await` allowed |
| Timeout wrapper via `Promise.race` | Moniepoint | Racing a rejecting timer against real work |
| Infinite currying `sum(1)(2)(3)()` | Paytm, Goibibo, MakeMyTrip | `toString`/`valueOf` coercion, `bind`/`call`/`apply` variants |
| `once`, chainable calculator, `EventEmitter`, Singleton, deep clone, LRU cache | Oracle, MakeMyTrip, Wayfair, Oracle, PayPal, PayPal | Module pattern, method chaining, Observer, Map + doubly-linked list |

The `promiseAllSync` shape (MakeMyTrip) — note the accumulator chain, which is the part people fumble:

```javascript
function promiseAllSync(total) {
  const results = [];
  let chain = Promise.resolve();
  for (let i = 0; i < total; i++) {
    chain = chain
      .then(() => getPromiseByIndex(i))
      .then((data) => { results.push(data); });
  }
  return chain.then(() => results);
}
```

---

## Part 3 — React: What They Actually Grade

### 3.1 Re-render control is the dominant React topic

Asked at **Wayfair, MakeMyTrip, Oracle, CoinDCX, Paytm Money, BrowserStack, JioHotstar, Okta**. But note *how* it's graded — the Moniepoint code-review round penalizes **over**-memoization:

> "**useMemo is unnecessary.** Rendering `searchResults.map(...)` is cheap. Unless there are thousands of rows, `useMemo` adds unnecessary complexity. I would simply render directly."

The mature answer is not "wrap everything in `useMemo`." It is:
1. Fix the structure first — lift state down, split components, pass children as props.
2. Stabilize identities that *feed* a memo boundary (`useCallback` for handlers used in deps, `useMemo` for genuinely expensive computation).
3. `React.memo` only at boundaries where props are actually stable.
4. Prefer **derived state over stored state** (see 3.3).

### 3.2 The Moniepoint code-review round is the single most instructive artifact in the corpus

A whole round was: *here is a PR adding debounced search — review it.* The eleven defects the candidate raised are a complete checklist for every async-input component you will ever be asked to build:

```javascript
// THE BUG — this hook does not debounce at all
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    setDebouncedValue(value);              // ← fires immediately, defeats the whole point
    const handler = setTimeout(() => {
      console.log("Debounce timer expired"); // ← the timer does nothing
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// THE FIX
useEffect(() => {
  const handler = setTimeout(() => setDebouncedValue(value), delay);
  return () => clearTimeout(handler);
}, [value, delay]);
```

The other ten findings, all of which generalize:

1. **Debounce delay of 10ms** is not a debounce. Use 250–500ms; 300ms is the default answer.
2. **Handlers in a `useMemo` dep array must be `useCallback`-wrapped**, or the memo never hits.
3. **`useCallback(…, [])` with external references goes stale.** Dependencies must be honest.
4. **Race condition:** typing `N → Ne → New` can land responses out of order and an older one overwrites a newer one. Fix with `AbortController` (or a request-ID/sequence guard):
   ```javascript
   const controller = new AbortController();
   fetch(url, { signal: controller.signal });
   return () => controller.abort();
   ```
5. **`console.error` is not error UX.** The user must see "Unable to load results."
6. **Empty/whitespace queries** must short-circuit before fetching (`if (!value.trim()) return;`).
7. **No loading state** — the user can't tell a slow request from a broken one.
8. **A search button that calls the API directly bypasses the debounce.** Pick one interaction model; mixing both is a design smell.
9. **In-flight requests must be aborted on unmount**, or you get state-update-after-unmount warnings.
10. Verdict: *request changes*. Being willing to say "not yet, here's why" **is** the signal in a code-review round.

### 3.3 Derived state over stored state (Okta's grid, twice)

The `n×n` grid problem — click empty cell → `max(all values) + 1`; click filled cell → `max(all values)`. The graded insight:

> "Instead of storing the current maximum separately in state, I kept only the grid state as the source of truth… This avoids synchronization issues between multiple states."

Two pieces of state that must agree is a bug waiting to happen. Derive. Only cache the max if profiling proves the scan matters — and *say that trade-off out loud*, which is exactly what the interviewer was listening for:

> "The interviewer was more interested in **why** I chose a particular implementation than simply getting the correct output."

### 3.4 Compound components are now an expected senior pattern

Moniepoint's Round 2 spec is unusually explicit and is a fair template for what "senior React" means in 2026:

```jsx
<Tabs defaultTab="overview">
  <Tabs.List>
    <Tabs.Tab id="overview">Overview</Tabs.Tab>
    <Tabs.Tab id="transactions">Transactions</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel tabId="overview">…</Tabs.Panel>
</Tabs>
```

Required: state in a custom `useTabs` hook, context for the children, **arrow-key navigation + Enter/Space activation**, correct `role="tablist" | "tab" | "tabpanel"` with `aria-selected` / `aria-controls` / `aria-labelledby`, a visible focus ring, and **no `any` in TypeScript**.

### 3.5 Recursive rendering and tree state

File explorer (Goibibo, MakeMyTrip) and nested comments (MakeMyTrip) both test the same thing: a self-referencing component over a tree, with **immutable updates into arbitrary depth**.

```jsx
function Folder({ node }) {
  return (
    <div>
      <h4>{node.name}</h4>
      {node.children?.map(child => <Folder key={child.id} node={child} />)}
    </div>
  );
}
```

The hard part isn't the render — it's `addChild(tree, targetId, newNode)` returning a new tree without mutating, and deciding between a nested tree and a normalized `{ [id]: node }` map. Interviewers explicitly listed "**state normalization**" as an evaluation criterion.

### 3.6 React internals vocabulary you're expected to hold

Virtual DOM, **reconciliation**, the diffing algorithm, **Fiber**, why keys matter for component identity, mount/unmount vs re-render, when cleanup functions run, `useEffect` vs `useLayoutEffect`, Suspense, `React.lazy` vs dynamic `import()`, code splitting. Asked at PayPal, Paytm Money, CoinDCX, Apple, BrowserStack, Oracle.

CoinDCX's version was an output-based question where the real answer was *"does React create a new component instance here, and do cleanups run?"* — i.e. can you reason about component **identity** under reconciliation.

---

## Part 4 — CSS, Accessibility, and the Browser

Frequently underweighted by React-first candidates, and it cost people rounds.

- **Pixel-perfect from a mockup**, live: BrowserStack, Amazon, Apple. Graded on semantic HTML, Flexbox/Grid, spacing/typography consistency, responsiveness. Amazon expected plain HTML/CSS; the candidate reached for React + Tailwind and had to re-do it.
- **Positioning math**: LinkedIn's tooltip round — `getBoundingClientRect()`, measure the tooltip, compute available space, place, recalculate on resize, `transform: translateX(-50%)` for the arrow.
- **Accessibility is graded, not bonus**: Moniepoint (full ARIA tabs spec), JioHotstar ("this became a major discussion point" — keyboard nav, ARIA, **focus management**, screen readers), Cult.fit, MakeMyTrip (keyboard-navigable pagination), LinkedIn.
- **DOM-level performance**: LinkedIn asked both — use **event delegation** (one listener on the parent, not one per button) and **one shared tooltip node** reused across targets rather than N nodes.
- **Core Web Vitals**: LinkedIn, MakeMyTrip, CoinDCX, Okta. Expect "which CWV have you personally improved, and how did you measure it?"
- **Browser fundamentals**: `async` vs `defer`, what happens between an API call and a repaint, sync vs async browser APIs, thread blocking.

---

## Part 5 — Frontend System Design

Appears at senior level in nearly every loop. Recurring problems: **content publishing platform** (Okta ×2), **e-commerce PDP** (Wayfair), **financial analytics dashboard** (Moniepoint), **LinkedIn feed with hover cards** (Paytm Money), **autocomplete as a design-system component** (BrowserStack), **generic tracking system** and **pluggable logger** (CoinDCX).

The reusable skeleton the corpus rewards:

1. **Gather requirements / drive the discussion.** Okta "intentionally kept the requirements broad and expected me to drive."
2. **Pick a rendering strategy per surface, with a reason.** Moniepoint's dashboard is the clearest worked example: SSR for the transaction list (fast first paint, polled every 5s), CSR for the 30-day historical chart (cache it, no realtime need), **WebSocket** for the live error gauge — updating *only* that widget, not the dashboard.
3. **Layer the caching.** Okta: `Browser → CDN → Server → Database`.
4. **Justify storage choices.** Markdown blobs in object storage (S3), structured metadata in SQL — keeps filtering/pagination cheap and keeps large text out of relational rows.
5. **Cover SEO when SSR/SSG is in play**: sitemap, canonical URLs, Open Graph, structured data, robots.txt.
6. **Realtime**: WebSocket or SSE, centralized notification store, toast + notification center, no page refresh.
7. **Back-of-the-envelope estimation.** Both Okta loops asked. "The goal wasn't exact numbers but demonstrating the ability to estimate."
8. **Design patterns, applied**: CoinDCX's pluggable logger (Sentry / Datadog / Mixpanel behind one API) wants **Adapter + Strategy + dependency injection + config-driven architecture**. Oracle asked for Singleton, Factory, Observer, Module — "focused on where these are useful in real-world frontend applications," not definitions.

**Design tokens are a real interview topic now.** Moniepoint's discussion: 200+ hardcoded Tailwind values → ~180 semantic tokens (`primary-background`, `text-secondary`, `success`, `surface`). Benefits they wanted articulated: consistency, cheap theming, maintainability, designer/developer collaboration, large-scale restyles with minimal diff.

---

## Part 6 — Compensation Anchors

| Company | Role | Stated comp |
|---|---|---|
| Apple (Hyderabad) | Senior Frontend Engineer | **85 LPA** |
| Deel | Remote Frontend Engineer | **$80K** ($60K base + $20K ESOP) |
| Moniepoint | Frontend Engineer (remote) | **55 LPA** |
| PayPal | Senior Frontend Engineer | 52 LPA |
| Tessell | Senior Frontend Engineer | 52 LPA |
| JioHotstar | SDE-2 Frontend | 48 LPA |
| Okta | Frontend Engineer II (SDE-2) | 45 LPA |

The 45–55 LPA band is the SDE-2/SSE market rate in this sample; 85 LPA is the Apple senior outlier. Remote roles (Deel, Moniepoint) are competitive with top-tier onsite.

---

## Part 7 — Blind Spots in This Corpus

What the data does **not** contain is itself informative. Across 23 substantive articles there is essentially **zero** mention of:

- **Testing** — no Jest, no React Testing Library, no Playwright, no "write a test for this." Not one round.
- **React 19 / Server Components / App Router internals** — Next.js appears exactly once (BrowserStack), at the level of "when would you choose it."
- **TypeScript depth** — required explicitly only by Moniepoint ("no `any`, correct generics"). Everyone else interviews in plain JS.
- **State management libraries** — Redux/Context named at Tessell and CoinDCX, Redux Saga at Paytm Money, and that's it. No Zustand, Jotai, TanStack Query, or RSC data patterns anywhere.
- **Micro-frontends, module federation, Web Workers, WASM, build-tool depth** — Webpack appears once (Paytm: bundling, tree shaking, code splitting, loaders, plugins). No Vite.
- **AI tooling in the loop** — nothing.

**Two readings of this, both worth holding.** (a) These interviews are conservative: they test 2018–2022 fundamentals even in 2026 loops, so classic prep still dominates. (b) The corpus is one author's slice of one market segment — treat the absence of testing and modern data-layer questions as *unmeasured*, not *unimportant*. If you're targeting product companies outside this sample, verify independently.

---

## Part 8 — A Prioritized Plan

**Tier 1 — highest expected value**
1. Event loop / microtask vs macrotask, explained aloud, not memorized.
2. Build **autocomplete-with-debounce** end to end: debounce hook (correct), `AbortController`, loading/empty/error states, keyboard nav, ARIA, result caching, highlighted matches. This single component covers 7 of 19 companies and is the highest-frequency question in the corpus.
3. Closures, prototype chain, `this` binding — to the depth of the LinkedIn `Foo`/`baz`/`bar` question.
4. Re-render debugging: the five planted bugs (excess re-renders, missing deps, expensive render-time work, bad keys, uncleared timers) in **under five minutes**, with the Profiler.

**Tier 2**
5. The polyfill set, written from memory: `debounce`, `throttle`, `memoize`, `flat` (recursive *and* iterative), `map`, `groupBy`, `promiseAllSync`, `retry`, infinite currying.
6. Reusable **Dropdown** and **Tabs** as compound components — context + custom hook + full keyboard + ARIA + TypeScript.
7. Recursive tree UI (file explorer / nested comments) with immutable deep updates.
8. Pagination with ellipsis and edge cases.

**Tier 3**
9. Frontend system design skeleton: requirements → per-surface rendering strategy → caching layers → realtime transport → SEO → estimation.
10. Core Web Vitals with a real story: what you measured, what you changed, what moved.
11. CSS from a mockup — Flexbox/Grid, semantic markup, responsive, no framework.
12. STAR-framed behavioral answers, and a rehearsed, credible answer to *"why are you looking for a change / will you relocate / will you stay."* Two loops in this corpus died there after clean technicals.

---

### Source articles

All URLs are in `data/crawled_posts.json`. Publication: [Frontend Army](https://medium.com/frontend-army), author Gourav Hammad. Companies covered: BrowserStack, MakeMyTrip (×2), Okta (×2), Wayfair, LinkedIn, JioHotstar (×2), PayPal, Oracle (×3), Tessell, Amazon, Moniepoint, Goibibo, CoinDCX, Cult.fit, Certa, Triple A, Paytm Money, Apple (×2), Deel.
