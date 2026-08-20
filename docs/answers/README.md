# Answer Bank

One document per topic, in reading order. Model answers for the concepts in [`../frontend-knowledge-map.md`](../frontend-knowledge-map.md), grounded in the corpus analysed in [`../frontend-react-insights.md`](../frontend-react-insights.md).

## Topics

| # | Topic | Covers | Map |
|---|---|---|---|
| 01 | [JavaScript — Core & Async](./01-javascript.md) | Event loop, closures, `this`, prototypes, coercion, deep clone, currying, memoize, debounce/throttle, promises, race conditions, memory leaks, design patterns | §1–§2 |
| 02 | [React — Rendering & Hooks](./02-react-core.md) | Reconciliation, keys, the three causes of re-render, hooks, stale closures, the five-bug debugging scan, derived state, compound components, recursive trees, context, code splitting | §7–§10 |
| 03 | [React — Advanced Patterns & React 19](./03-react-advanced.md) | Refs' three jobs, `useImperativeHandle`, error boundaries, `useTransition` vs debouncing, Suspense for data, React 19 actions and `useOptimistic`, slots, state reducers, polymorphic TS, portals, Strict Mode, `useSyncExternalStore`, hydration | §7–§10 |
| 04 | [React — Data Fetching, State & TypeScript](./04-react-data.md) | Request waterfalls, Server Components, streaming, server state as a cache, the four kinds of state, URL state, optimistic updates, TypeScript as design | §11–§12 |
| 05 | [CSS & Layout](./05-css.md) | Box model, formatting contexts, stacking contexts, cascade layers, Flexbox and Grid in full, sticky's silent failures, container queries, `:has()`, tokens, `oklch`, fluid type, logical properties, animation cost | §5 |
| 06 | [Accessibility](./06-accessibility.md) | The four layers, roving tabindex, ARIA state, focus management, event delegation | §6 |
| 07 | [Machine Coding — Core Components](./07-machine-coding-core.md) | Autocomplete, dropdown, pagination, recursive trees, progress queue, data table, cart, dynamic grid | §13 |
| 08 | [Machine Coding — More Components](./08-machine-coding-more.md) | Stopwatch, star rating, infinite scroll, step tracker, currency calculator, tooltip, modal, toast | §13 |
| 09 | [Frontend System Design](./09-system-design.md) | The skeleton, rendering strategy per surface, caching layers, realtime transport, the worked publishing-platform and logger designs, Core Web Vitals | §14–§15 |
| 10 | [Testing](./10-testing.md) | Testing as a design signal, what to test, the trophy, RTL + MSW, the race-condition test, flakiness, E2E scope, TDD | §17 |
| 11 | [Security & the Browser Model](./11-security.md) | Same-origin policy, what CORS really does, XSS as a context problem, React's four holes, CSRF, token storage, CSP, third-party scripts, supply chain | §18 |
| 12 | [Production Engineering](./12-production.md) | Reading unfamiliar code, incremental migration, observability, incident response, safe rollout, i18n, money/time/text traps, network resilience, judgment, code review | Part 2 of core-insights |
| 13 | [DSA for Frontend](./13-dsa.md) | Every algorithm problem the corpus asked, by company, with complexity reasoning and the five patterns they reduce to | §19 |
| 14 | [Behavioural & Engineering Maturity](./14-behavioural.md) | STAR, resume defence, relocation and retention, disagreement, production debugging | §21 |

**Why some topics span two files:** React and Machine Coding are large enough that one document would be unreadable. React splits by depth (core → advanced → data); Machine Coding splits by component set. Everything else is one topic, one file.

## Where each topic's knowledge comes from

The corpus is one author's 23 articles. It covers some topics heavily and others not at all, so roughly a third of this answer bank is knowledge added to complete the picture. This table says which is which.

| Provenance | Topics |
|---|---|
| **Corpus questions, answers written here** | 01, 02, 07, 13 — they asked, the answers and code are added |
| **Corpus named it, implementations added** | 08, 09 — components and designs were listed as prompts only |
| **Barely in the corpus** | 05 (basic CSS only), 06 (graded but never explained), 14 |
| **Not in the corpus at all** | 03, 04, 10, 11, 12 — added because the job needs them, *not* because this market was observed asking |

**What that means for you:** the ★ priority marks in the knowledge map are evidence from 19 real loops. The ○ marks are professional judgment with no evidence behind them for *this* market. Weight your preparation accordingly, and verify version-specific claims (React 19 APIs, browser support) against primary docs.

## How each answer is structured

1. **The spoken answer** — what you actually say, in plain prose. Lead with the mental model, not the definition.
2. **Code** — only where it carries the lesson.
3. **The follow-up** they will ask next.
4. **The trap** — the wrong answer that sounds right.

## Three things that run through every topic

**Say the trade-off unprompted.** The corpus repeats this more than any other point. Okta: *"more interested in why I chose a particular implementation than simply getting the correct output."* A working answer with no reasoning scores below a slightly worse answer with clear reasoning.

**Don't over-apply optimisations.** Moniepoint's code-review round penalises an unnecessary `useMemo`. Knowing when *not* to reach for a tool is graded as heavily as knowing the tool.

**Cover all four UI states.** Loading, empty, error, success. Missing states is the most common gap across every machine-coding write-up in the corpus.

## Source corrections

Four "correct answers" in the crawled articles are wrong or outdated. The first three are marked **[SOURCE ERROR]** in [`01-javascript.md`](./01-javascript.md):

| Article claim | Reality |
|---|---|
| `sort` returns a new array | `sort` mutates in place and returns the **same** reference. `toSorted()` returns a new one. |
| `JSON.parse(JSON.stringify(obj))` is the deep-clone answer | Legacy. `structuredClone()` handles `Date`, `Map`, `Set` and cycles; the JSON hack silently drops or corrupts all of them. |
| Iterative `flat` using `result.unshift(item)` | O(n²). Push and `reverse()` once at the end for O(n). |
| Gauss-sum trick for the missing number *(see [13-dsa.md](./13-dsa.md))* | Only valid with no duplicates — and their own sample input contains `17` twice, so the trick returns the wrong answer on it. |

One more worth knowing: the arrow-function `this` quiz answer (`Ginny, undefined, undefined, undefined`) assumes a non-strict classic script. In an ES module or strict mode, top-level `this` is `undefined`, so those calls **throw** rather than returning `undefined`.
