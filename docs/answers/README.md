# Frontend Answer Bank

Model answers for the concepts in [`../frontend-knowledge-map.md`](../frontend-knowledge-map.md), derived from the interview corpus analyzed in [`../frontend-react-insights.md`](../frontend-react-insights.md).

## Files

| File | Covers | Map sections |
|---|---|---|
| [`01-javascript.md`](./01-javascript.md) | Event loop, closures, `this`, prototypes, coercion, deep clone, currying, memoize, debounce/throttle, promises, race conditions, memory leaks, design patterns | §1–§2 |
| [`02-react.md`](./02-react.md) | Reconciliation, keys, re-render causes, hooks, stale closures, performance debugging, derived state, compound components, recursive trees, context, code splitting | §7–§10 |
| [`03-machine-coding.md`](./03-machine-coding.md) | Full implementations: autocomplete, dropdown, pagination, trees, progress queue, data table, cart, plus specs for eight more | §13 |
| [`04-css-a11y-design.md`](./04-css-a11y-design.md) | Centering, stacking contexts, Flexbox vs Grid, animation cost, accessibility, event delegation, system design skeleton, rendering strategy, Core Web Vitals, behavioral | §4–§6, §14–§15, §21 |

### Files 05–08: the gaps the corpus never covered

The crawled articles are one author's slice of one market. These four fill what that slice structurally could not contain — see [`../core-insights.md`](../core-insights.md) Part 2 for why each is missing.

| File | Covers | Map sections |
|---|---|---|
| [`05-testing.md`](./05-testing.md) | Testing as a design signal, what to test, the trophy, RTL + MSW, the race-condition test, flakiness, E2E scope, TDD | §17 — **zero corpus coverage** |
| [`06-security.md`](./06-security.md) | Same-origin policy, what CORS really does, XSS as a context problem, React's four holes, CSRF, token storage, CSP, third-party scripts, supply chain | §18 — one passing mention |
| [`07-modern-react-data.md`](./07-modern-react-data.md) | Request waterfalls, Server Components, Suspense streaming, server vs client state, the four kinds of state, optimistic updates, TypeScript as design | §11–§12 — corpus is frozen ~2021 |
| [`08-production-engineering.md`](./08-production-engineering.md) | Reading unfamiliar code, incremental migration, observability, incident response, safe rollout, i18n, money/time/text traps, network resilience, judgment, code review | Part 2 of core-insights |

## How each answer is structured

1. **The spoken answer** — what you actually say, in plain prose. Lead with the mental model, not the definition.
2. **Code** — only where it carries the lesson.
3. **The follow-up** they will ask next.
4. **The trap** — the wrong answer that sounds right.

## Three things that run through all four files

**Say the trade-off unprompted.** The corpus repeats this more than any other point. Okta: *"more interested in why I chose a particular implementation than simply getting the correct output."* A working answer with no reasoning scores below a slightly worse answer with clear reasoning.

**Don't over-apply optimizations.** Moniepoint's code-review round penalizes an unnecessary `useMemo`. Knowing when *not* to reach for a tool is graded as heavily as knowing the tool.

**Cover all four UI states.** Loading, empty, error, success. Missing states is the most common gap across every machine-coding write-up in the corpus.

## Source corrections

Three "correct answers" in the crawled articles are wrong or outdated. All are marked **[SOURCE ERROR]** in `01-javascript.md`:

| Article claim | Reality |
|---|---|
| `sort` returns a new array | `sort` mutates in place and returns the **same** reference. `toSorted()` returns a new one. |
| `JSON.parse(JSON.stringify(obj))` is the deep-clone answer | Legacy. `structuredClone()` handles `Date`, `Map`, `Set`, and cycles; the JSON hack silently drops or corrupts all of them. |
| Iterative `flat` using `result.unshift(item)` | O(n²). Push and `reverse()` once at the end for O(n). |

One more worth knowing: the arrow-function `this` quiz answer (`Ginny, undefined, undefined, undefined`) assumes a non-strict classic script. In an ES module or strict mode, top-level `this` is `undefined`, so those calls **throw** rather than returning `undefined`.
