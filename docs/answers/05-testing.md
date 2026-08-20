# Answer Bank 5 — Testing

Fills §17 of the [knowledge map](../frontend-knowledge-map.md), which had **zero coverage** across all 23 crawled articles. Not one round in the corpus asked about testing. That's a property of this author's slice of the market, not of the profession — and it's the largest gap between "passes interviews" and "is good at the job."

---

## The one idea underneath everything here

> **Hard-to-test code is badly designed code. Tests are a design feedback loop, not a chore.**

If you can't test a function without a database, six mocks, and three context providers, the test isn't the problem — your boundaries are. **Testability is a proxy for coupling.** When a test is painful to write, the correct first response is to look at the design, not to reach for a bigger mock.

That reframe changes what you do with a failing test: you ask what it's telling you about the shape of the code.

---

## Q: What do you test, and what do you not test?

**Answer.** Test **behavior through public interfaces**. Don't test implementation.

The distinction is concrete:

```javascript
// ✗ Implementation — breaks on every refactor, catches nothing
expect(wrapper.state("isOpen")).toBe(true);
expect(useState).toHaveBeenCalled();
expect(wrapper.find("DropdownList")).toHaveLength(1);

// ✓ Behavior — survives refactors, catches real regressions
await user.click(screen.getByRole("button", { name: /select country/i }));
expect(screen.getByRole("listbox")).toBeVisible();
expect(screen.getAllByRole("option")).toHaveLength(3);
```

The second version still passes if you swap `useState` for `useReducer`, rename internals, or restructure the component tree — because none of that changed what the component *does*. That's the whole point: **a test should fail when the behavior breaks and only then.**

**What deserves a test, in priority order:**
1. **Business logic and data transforms** — pure functions, reducers, validation, formatting, derivation. Highest value per line, trivial to test.
2. **Critical user flows** — signup, checkout, search. Usually integration or E2E.
3. **Bug regressions** — every fixed bug gets a test, or it comes back silently.
4. **Edge cases you reasoned about** — empty, error, boundary, race.
5. **Custom hooks** with real logic.

**What usually doesn't:**
- Presentational components with no logic (visual regression serves better)
- Third-party library behavior — that's their job
- Trivial getters, constants, pass-through props
- Implementation details of any kind

**On coverage numbers:** treat 80% as a *floor that catches untested files*, never a goal. 100% coverage with assertion-free tests proves nothing, and chasing the last 15% usually means testing error branches that can't occur. Coverage tells you what is definitely untested; it never tells you what is well tested.

---

## Q: What's the right mix of test types?

**Answer.** The classic pyramid (many unit, some integration, few E2E) came from backend systems. For frontend, Kent C. Dodds' **testing trophy** fits better:

```
        ▲  E2E            few — slow, flaky, but highest confidence
      ▲▲▲  Integration    MOST — best confidence-to-cost ratio
    ▲▲▲▲▲  Unit           logic and utilities
  ▲▲▲▲▲▲▲  Static         TypeScript + ESLint — free, catch a whole bug class
```

**Why integration dominates for UI:** most frontend bugs are *interaction* bugs — this component doesn't wire correctly to that one, state doesn't propagate, the effect doesn't fire. Unit tests with everything mocked pass while the app is broken, because you tested that your mocks agree with each other.

Rendering a real component tree with a mocked network boundary is the sweet spot: fast enough to run constantly, real enough to catch what matters.

**Static analysis is the base of the trophy and it's free.** TypeScript eliminates an entire category (`undefined is not a function`, wrong argument order, missing props) without writing a single test. The `exhaustive-deps` ESLint rule catches stale-closure bugs that are genuinely hard to test for. Turning these on is the highest ROI testing decision available.

---

## Q: Write a test for the debounced autocomplete.

Covers the three techniques people fumble: fake timers, network mocking, and async queries.

```javascript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.get("/api/search", ({ request }) => {
    const q = new URL(request.url).searchParams.get("q");
    return HttpResponse.json(
      q === "rea" ? [{ id: 1, label: "React" }, { id: 2, label: "Realm" }] : []
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("debounces input and shows results", async () => {
  // advanceTimers is REQUIRED or userEvent hangs against fake timers
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  jest.useFakeTimers();

  render(<Autocomplete />);
  const input = screen.getByRole("combobox");

  await user.type(input, "rea");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();  // nothing yet

  jest.advanceTimersByTime(300);                                  // cross the debounce

  expect(await screen.findByRole("option", { name: "React" })).toBeVisible();
  expect(screen.getAllByRole("option")).toHaveLength(2);

  jest.useRealTimers();
});

test("shows an error state when the request fails", async () => {
  server.use(http.get("/api/search", () => HttpResponse.error()));
  const user = userEvent.setup();

  render(<Autocomplete />);
  await user.type(screen.getByRole("combobox"), "rea");

  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load/i);
});

test("does not show stale results when a slow response arrives late", async () => {
  // The race-condition test — the one nobody writes, and the bug everyone ships
  let resolveFirst;
  server.use(
    http.get("/api/search", async ({ request }) => {
      const q = new URL(request.url).searchParams.get("q");
      if (q === "a") await new Promise((r) => (resolveFirst = r));   // hang the first
      return HttpResponse.json([{ id: q, label: `result-${q}` }]);
    })
  );

  const user = userEvent.setup();
  render(<Autocomplete />);

  await user.type(screen.getByRole("combobox"), "a");
  await user.type(screen.getByRole("combobox"), "b");   // second query
  await screen.findByText("result-ab");

  resolveFirst();                                        // stale response lands late
  await waitFor(() => {
    expect(screen.queryByText("result-a")).not.toBeInTheDocument();
  });
});
```

**Four things being demonstrated:**

1. **MSW mocks at the network layer**, not the module layer. `jest.mock("./api")` couples the test to your file structure and passes even when the real request shape is wrong. MSW intercepts actual HTTP, so the test exercises your real fetch code.
2. **Queries by role, not test IDs.** `getByRole("combobox")` fails if you break the accessibility semantics — so the test doubles as an a11y check. Reach for `data-testid` only when no accessible query exists.
3. **`findBy*` returns a promise and retries.** Use `findBy` for anything async, `getBy` for what's already there, `queryBy` **only** to assert absence (it returns null instead of throwing).
4. **The race-condition test.** This is the one that would have caught the Moniepoint PR bug. If you write only one interesting test for an async component, write this one.

**The fake-timer trap:** `userEvent.setup({ advanceTimers })` is mandatory when mixing user-event with fake timers. Without it, user-event's internal waits never resolve and the test hangs with a confusing timeout.

---

## Q: How do you test a custom hook?

**Answer.** Prefer testing it *through a component that uses it* — that's how it's actually consumed. Use `renderHook` when the hook is a standalone published utility.

```javascript
import { renderHook, act } from "@testing-library/react";

test("useDebounce delays the value", () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(
    ({ value }) => useDebounce(value, 300),
    { initialProps: { value: "a" } }
  );

  expect(result.current).toBe("a");

  rerender({ value: "ab" });
  expect(result.current).toBe("a");            // still the old value — the point of the hook

  act(() => { jest.advanceTimersByTime(300); });
  expect(result.current).toBe("ab");
});
```

**Note what this test would have caught:** the broken Moniepoint hook calls `setDebouncedValue(value)` synchronously, so the middle assertion (`still "a"`) fails immediately. **A ten-line test catches the bug that a whole interview round was built around.** That's the argument for testing, made concretely.

**`act()` wraps anything that triggers a state update** so React flushes effects before you assert. Most of the time RTL wraps it for you; you need it explicitly around timer advances and manual event dispatch.

---

## Q: What makes tests flaky, and how do you fix it?

**Answer.** Flaky tests are worse than no tests — they train the team to ignore red builds. Four causes, all fixable:

| Cause | Fix |
|---|---|
| **Arbitrary waits** — `await sleep(1000)` | Wait for a *condition*: `findBy*`, `waitFor`, `waitForElementToBeRemoved` |
| **Shared state between tests** | Reset stores, handlers, and the DOM in `afterEach`; never depend on execution order |
| **Real timers, real network, real clock** | Fake timers, MSW, and inject a fixed `Date` |
| **Race between assertion and render** | Use `findBy*`, which retries until the DOM settles or times out |

**The general principle: assert on conditions, never on elapsed time.** Any test containing a hardcoded sleep is a future flake — it passes on your machine and fails in CI where everything is slower.

**Quarantine policy:** a flaky test gets fixed or deleted within a sprint. Leaving it retrying-until-green is how a suite becomes untrusted, and an untrusted suite is dead weight.

---

## Q: When is E2E worth the cost?

**Answer.** E2E (Playwright, Cypress) is the only kind that tests what the user actually experiences — real browser, real network, real rendering, everything integrated. It's also the slowest, flakiest, and most expensive to maintain.

**Use it for:** the handful of flows where failure is unacceptable — signup, login, checkout, payment, the core action your product exists for. Five to fifteen tests, not five hundred.

**Don't use it for:** edge cases, validation permutations, error states. Those belong in integration tests where they run in milliseconds.

```javascript
test("user can complete checkout", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByRole("link", { name: /cart/i }).click();
  await expect(page.getByText("1 item")).toBeVisible();
  await page.getByRole("button", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
});
```

**Playwright specifics worth knowing:** auto-waiting is built in, so explicit waits are almost always a smell; `getByRole` mirrors RTL, so the same accessibility-first query habit transfers; trace viewer gives you a full timeline for CI failures you can't reproduce locally.

**Add two cheap, high-value layers on top:**
- **Visual regression** — screenshot key breakpoints (320/768/1024/1440) and diff. Catches CSS breakage no assertion would.
- **Automated a11y** — `@axe-core/playwright` on each key page catches contrast failures, missing labels, and bad ARIA for free.

---

## Q: What is TDD actually for?

**Answer.** The value isn't the tests — it's that **writing the test first forces you to design the interface before the implementation.** You become the first consumer of your own API, and awkwardness shows up immediately rather than after you've built on top of it.

Red → green → refactor. The refactor step is the one people skip, and it's where the payoff is: with a passing test you can restructure fearlessly, because the test tells you the moment behavior changes.

**Where TDD genuinely fits:** pure logic, reducers, validation, algorithms, bug fixes (write the failing test that reproduces the bug *first* — now you can prove you fixed it).

**Where it fits badly, honestly:** exploratory UI work where you don't yet know what you're building. Writing tests for a layout you'll throw away in an hour is waste. Prototype, decide, *then* test the behavior you're keeping.

**For a bug fix specifically, TDD is close to unarguable:** the failing test proves you reproduced the bug, the passing test proves you fixed it, and it stays as the regression guard. Three benefits for one test.

---

*Next: [`06-security.md`](./06-security.md)*
