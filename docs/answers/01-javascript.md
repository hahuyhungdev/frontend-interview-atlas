# JavaScript — Core & Async

Model answers for the ★★★ / ★★ items in [`../frontend-knowledge-map.md`](../frontend-knowledge-map.md) §1–§2. This is the layer that produced more rejections than any other in the corpus.

**Format:** the spoken answer first (what you actually say), then code only where code carries the lesson, then the follow-up they will ask, then the trap.

> ⚠️ **Source corrections.** Three "correct answers" in the crawled articles are wrong or outdated. They're marked **[SOURCE ERROR]** below. Don't memorize the article version.

---

## 1. The Event Loop

### Q: Explain the output.

```javascript
console.log(1);
setTimeout(() => console.log(2));
Promise.resolve().then(() => console.log(3));
console.log(4);
// 1, 4, 3, 2
```

**Answer.** JavaScript runs on a single thread with one call stack. All synchronous code runs to completion first — that's `1` and `4`. Then, before the engine yields, it drains the **microtask queue** completely: `Promise.then` callbacks, `queueMicrotask`, and `await` continuations. That's `3`. Only then does it take **one** task from the macrotask queue — `setTimeout`, I/O, UI events — which gives `2`. Then the loop repeats: one macrotask, drain all microtasks, repeat.

The asymmetry is the point: microtasks are drained *exhaustively*, macrotasks are taken *one at a time*. So a microtask that schedules another microtask can starve the timer queue forever. A macrotask can never starve microtasks.

**Where rendering fits:** the browser paints between macrotasks, after microtasks have drained. That's why a long microtask chain freezes the UI just as badly as a long synchronous loop.

**Follow-up: `async`/`await` version.**

```javascript
async function test() {
  console.log(1);
  await delay();   // returns control to the caller HERE
  console.log(2);
}
test();
console.log(3);
// 1, 3, 2
```

`await` is not a pause — it's a `return` to the caller plus a `.then` on the rest of the function. Everything after `await` becomes a microtask continuation.

**Trap.** Saying "setTimeout runs after 0ms so it runs first." The delay argument is a *minimum*, and the queue it lands in is lower priority than microtasks regardless.

---

### Q: `async` vs `defer` on a script tag.

**Answer.** Both download in parallel with HTML parsing, so neither blocks the download. The difference is execution:

| | `async` | `defer` |
|---|---|---|
| Executes | As soon as it downloads | After HTML parsing completes |
| Order preserved | **No** — whichever lands first | **Yes** — document order |
| Can block parsing | Yes, mid-parse | No |
| Use for | Independent third-party (analytics) | Application scripts |

**Default to `defer`.** Use `async` only when the script has no dependencies and nothing depends on it.

**Trap.** Plain `<script>` with no attribute blocks parsing entirely at both download and execution — that's the one to avoid.

---

## 2. Closures, `this`, and Prototypes

### Q: The LinkedIn question — what does this print and why?

```javascript
function Foo(x) {
  function bar() { return x; }
  this.baz = function () { return x; };
}
Foo.prototype.baz = function () { return x; };

const obj = new Foo(10);
obj.baz();  // 10
obj.bar();  // TypeError: obj.bar is not a function
```

**Answer.** Three things are happening.

`bar` is a function declared *inside* the constructor. It closes over `x`, but it's never attached to anything reachable — it dies with the constructor call. `obj.bar` is `undefined`, so calling it is a `TypeError`.

`this.baz` is assigned as an **own property** on the instance and closes over `x`, so it returns `10`. Own properties shadow prototype properties during the lookup, so the prototype's `baz` is never reached.

`Foo.prototype.baz` couldn't work anyway: it's defined in the outer scope, where `x` doesn't exist. Prototype methods are created once, outside any constructor invocation, so they have **no access to constructor-local variables**. If it were reached it would throw a `ReferenceError`.

**Follow-up: expose `bar` while keeping `x` private.**

```javascript
function Foo(x) {
  function bar() { return x; }
  this.bar = bar;    // now reachable, x still not
}
```

**The trade-off they want you to name:** instance methods (`this.method = ...`) get closure access to private state but are allocated **per instance**. Prototype methods are shared across all instances — cheaper memory — but can only see `this`. That's the real design decision.

---

### Q: `this` binding — what does this print?

```javascript
const person1 = {
  firstName: "Ginny",
  getName: function () { return this.firstName; }
};
const person2 = {
  firstName: "Jhonny",
  getName: () => this.firstName
};
const getName1 = person1.getName;
const getName2 = person2.getName;

console.log(person1.getName(), getName1(), person2.getName(), getName2());
// "Ginny", undefined, undefined, undefined
```

**Answer.** `this` in a normal function is determined by **how it's called**, not where it's defined.

- `person1.getName()` — called as a method, so `this` is `person1` → `"Ginny"`.
- `getName1()` — the function was detached from the object. Called standalone, `this` is the global object (or `undefined` in strict mode) → `undefined`.
- `person2.getName` is an **arrow function**. Arrows have no `this` of their own; they capture it lexically from the enclosing scope at definition time. Here that's module/global scope, where `firstName` doesn't exist → `undefined`. The call site is irrelevant.
- `getName2()` — same arrow, same lexical `this` → `undefined`.

**Nuance worth stating.** In an ES module or strict mode, top-level `this` is `undefined`, so `this.firstName` would **throw** rather than return `undefined`. The article's answer assumes a non-strict classic script. Say which context you're assuming — that distinction is exactly the kind of depth these rounds reward.

**Rule.** Never use an arrow function as an object method that needs `this`. Always use one for callbacks that should inherit the surrounding `this`.

**The four binding rules, in precedence order:** `new` → explicit (`call`/`apply`/`bind`) → implicit (method call) → default (global/undefined). Arrows opt out of all four.

---

### Q: Explain the prototype chain.

**Answer.** Every object has an internal link to another object, its prototype. Property lookup walks that chain until it finds the key or hits `null`.

```javascript
const arr = [1, 2];
arr.__proto__ === Array.prototype              // true
Array.prototype.__proto__ === Object.prototype // true
Object.prototype.__proto__ === null            // true — chain ends
```

So `arr.map` isn't on `arr` — it's found one hop up on `Array.prototype`. `arr.toString` is found two hops up on `Object.prototype`.

`__proto__` is the *link on an instance*. `.prototype` is a property on **constructor functions**, and it's the object that instances will link to. `new Foo()` sets `instance.__proto__ = Foo.prototype`. Use `Object.getPrototypeOf()` in real code; `__proto__` is legacy.

**Follow-up: `{} === {}`?** `false`. Object comparison is by reference, and those are two distinct allocations. Same for `[] === []`.

**Trap.** Adding to `Array.prototype` in production pollutes every array in the app and can break `for...in` loops. Fine as an interview polyfill exercise, wrong as a real pattern.

---

## 3. Coercion, Copying, Arrays

### Q: How do you deep clone an object?

**[SOURCE ERROR]** The Certa quiz marks `JSON.parse(JSON.stringify(obj))` as the correct answer. It's the *legacy* answer and it silently loses data.

**Answer.** The modern correct answer is **`structuredClone(obj)`** — built into all current browsers and Node 17+. It handles nested objects, arrays, `Date`, `Map`, `Set`, `RegExp`, typed arrays, and **circular references**.

`JSON.parse(JSON.stringify(obj))` breaks on all of these: `undefined` and functions are dropped, `Date` becomes a string, `Map`/`Set` become `{}`, `NaN`/`Infinity` become `null`, and circular references **throw**.

Hand-rolled recursion is what interviewers usually want to see:

```javascript
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;   // primitives
  if (seen.has(value)) return seen.get(value);                     // cycles

  if (value instanceof Date) return new Date(value);
  if (value instanceof Map)
    return new Map([...value].map(([k, v]) => [k, deepClone(v, seen)]));
  if (value instanceof Set)
    return new Set([...value].map((v) => deepClone(v, seen)));

  const copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);                                            // register BEFORE recursing
  for (const key of Reflect.ownKeys(value)) {
    copy[key] = deepClone(value[key], seen);
  }
  return copy;
}
```

**The three things graded here:** the `WeakMap` for cycles (registered *before* recursing into children), `Object.keys`/`Reflect.ownKeys` rather than `for...in` (which walks inherited enumerable properties), and preserving the prototype.

**PayPal's variant** adds: whenever you hit an array, append its length to the clone.

```javascript
function deepClone(obj) {
  if (Array.isArray(obj)) {
    const clone = obj.map(deepClone);
    clone.push(clone.length);   // note: length BEFORE the push
    return clone;
  }
  if (obj && typeof obj === "object") {
    const copy = {};
    for (const key of Object.keys(obj)) copy[key] = deepClone(obj[key]);
    return copy;
  }
  return obj;
}
// { skills: ["React","TypeScript"] } → { skills: ["React","TypeScript",2] }
```

---

### Q: Which array methods return a new array?

**[SOURCE ERROR]** The article lists `map, filter, sort, slice`. **`sort` does not** — it sorts in place and returns a reference to the *same* array.

```javascript
const a = [3, 1, 2];
a.sort() === a;        // true  — same reference, mutated
a.map(x => x) === a;   // false — new array
```

**Answer.** Split them cleanly:

- **Return a new array:** `map`, `filter`, `slice`, `concat`, `flat`, `flatMap`, and the ES2023 non-mutating twins `toSorted`, `toReversed`, `toSpliced`, `with`.
- **Mutate in place:** `sort`, `reverse`, `splice`, `push`, `pop`, `shift`, `unshift`, `fill`, `copyWithin`.
- **Return neither:** `forEach` (returns `undefined`), `reduce` (returns whatever you accumulate), `find`, `some`, `every`.

**Why it matters in React:** mutating methods on state arrays are a top source of "why didn't my component re-render" — the reference didn't change, so `Object.is` says nothing happened. Always `[...arr].sort()` or `arr.toSorted()`.

---

### Q: `forEach` vs `map` on a large dataset — which is better?

**Answer.** They aren't alternatives. `map` allocates and returns a new array of transformed values; `forEach` returns nothing and exists purely for side effects. If you need the transformed array, `map`. If you don't, `forEach` — using `map` and discarding the result allocates an array for nothing.

The performance difference is negligible and not the point. **BrowserStack's interviewer said this explicitly:** choose the correct API for the intended behavior rather than attempting micro-optimizations. Answering "map is faster" fails this question.

---

### Q: Temporal Dead Zone.

```javascript
let x = 10;
(function () {
  console.log(x);   // ReferenceError
  let x = 20;
})();
```

**Answer.** `let` and `const` **are** hoisted to the top of their block — but they're uninitialized until the declaration is evaluated. That window is the Temporal Dead Zone, and touching the binding inside it throws `ReferenceError`.

Critically, the inner `let x` **shadows** the outer `x` for the entire function body. So the `console.log` doesn't fall through to the outer `10` — it hits the shadowed, still-uninitialized binding.

**Contrast with `var`:** hoisted *and* initialized to `undefined`, so the same code logs `undefined` instead of throwing. The TDZ exists to turn that silent bug into a loud error.

---

## 4. Functions: Currying, Memoization, Utilities

### Q: Implement infinite currying — `sum(1)(2)(3)()` and `sum(1)(2)(3)` both working.

**Answer.** With an explicit terminator, accumulate in a closure and return the total when called with no argument:

```javascript
function sum(a) {
  return function next(b) {
    if (b === undefined) return a;
    return sum(a + b);
  };
}
sum(1)(2)(3)();   // 6
```

Without a terminator, you exploit **coercion**. The returned function carries the running total on its `toString`/`valueOf`, so the engine unwraps it when the value is used in a primitive context:

```javascript
function sum(a) {
  const fn = (b) => sum(a + b);
  fn.valueOf = () => a;
  fn.toString = () => String(a);
  return fn;
}
sum(1)(2)(3) + 0;      // 6
`${sum(1)(2)(3)}`;     // "6"
console.log(+sum(1)(2)(3)); // 6
```

**State the caveat**, because it's the mark of understanding: this only produces a number when coerced. `console.log(sum(1)(2)(3))` without a `+` prints the function. That's the honest limitation, and interviewers ask about it.

**Fixed-arity version** (Goibibo's `generateSum(4)` → `sum(1)(2)(3)(4)`):

```javascript
function generateSum(arity) {
  const collect = (args) =>
    args.length === arity
      ? args.reduce((a, b) => a + b, 0)
      : (next) => collect([...args, next]);
  return collect([]);
}
```

---

### Q: Implement `memoize`.

```javascript
function memoize(fn, keyFn = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  return function (...args) {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
```

**The three things to raise unprompted** — this is what separates a passing answer from a strong one:

1. **Key collisions.** `JSON.stringify` gives `{a:1,b:2}` and `{b:2,a:1}` different keys despite being equivalent, and can't distinguish `undefined` from a missing property. For object arguments, a `WeakMap` keyed on identity is often more correct.
2. **Unbounded growth.** This cache never evicts — it's a memory leak in any long-lived app. Real use needs an LRU bound or a TTL.
3. **Correctness preconditions.** Only safe for **pure** functions. Memoizing anything that reads mutable external state or has side effects returns stale results.

**`this` handling:** use `fn.apply(this, args)` and a `function` (not arrow) wrapper, so it still works as a method.

---

### Q: `debounce` vs `throttle`.

```javascript
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, interval) {
  let last = 0, timer;
  return function (...args) {
    const now = Date.now();
    const remaining = interval - (now - last);
    if (remaining <= 0) {              // leading edge
      clearTimeout(timer);
      last = now;
      fn.apply(this, args);
    } else if (!timer) {               // trailing edge — don't drop the last call
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

**Answer.** **Debounce** waits for silence — it fires once, `delay` ms after the *last* call. Every new call resets the clock. Use it when only the final state matters: search input, autosave, resize-then-recompute, form validation.

**Throttle** guarantees a maximum rate — it fires at most once per interval no matter how many calls arrive. Use it when intermediate values matter and you need continuous feedback: scroll position, mouse move, drag, infinite-scroll triggers, rate-limited APIs.

The one-liner: *debounce collapses a burst into one call at the end; throttle samples a stream at a fixed rate.*

**Details that get graded:** forwarding `this` and `...args` via `apply`; the trailing-edge case in throttle (a naive version silently drops the last event); and returning a `.cancel()` method so React cleanup can clear a pending timer.

---

### Q: Implement `Array.prototype.flat` — recursively and iteratively.

```javascript
Array.prototype.myFlat = function (depth = 1) {
  const out = [];
  for (const item of this) {
    if (Array.isArray(item) && depth > 0) out.push(...item.myFlat(depth - 1));
    else out.push(item);
  }
  return out;
};
```

Iterative, without recursion (both were demanded at MakeMyTrip and Goibibo):

```javascript
function flattenIterative(arr) {
  const stack = [...arr];
  const out = [];
  while (stack.length) {
    const item = stack.pop();
    if (Array.isArray(item)) stack.push(...item);
    else out.push(item);
  }
  return out.reverse();   // stack order is reversed; fix once at the end
}
```

**[SOURCE ERROR]** The article's version uses `result.unshift(item)` inside the loop. That's **O(n²)** — every `unshift` reindexes the whole array. Push and `reverse()` once at the end: O(n). Saying this out loud is exactly the complexity awareness these rounds test.

**Also mention:** recursion risks a stack overflow on pathologically deep nesting; the iterative version doesn't. That's the real argument for it, beyond "they asked."

---

### Q: Implement `groupBy`.

```javascript
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = typeof key === "function" ? key(item) : item[key];
    (acc[k] ||= []).push(item);
    return acc;
  }, {});
}
```

**Worth adding:** `Object.groupBy()` is now native (ES2024), and `Map.groupBy()` when you need non-string keys. Accepting a **key function** rather than only a string is the small API-design touch that reads as senior. O(n) time, O(n) space.

---

### Q: Implement `once`, and a chainable calculator.

```javascript
function once(fn) {
  let called = false, result;
  return function (...args) {
    if (!called) { called = true; result = fn.apply(this, args); }
    return result;
  };
}
```

```javascript
function calculator(value) {
  return {
    add: (n) => calculator(value + n),
    subtract: (n) => calculator(value - n),
    multiply: (n) => calculator(value * n),
    divide: (n) => {
      if (n === 0) throw new Error("Division by zero");
      return calculator(value / n);
    },
    value: () => value,
  };
}
calculator(10).add(5).multiply(2).subtract(8).value();   // 22
```

**Why return a new object rather than mutate `this`:** it's immutable, so intermediate results can be safely reused and shared. Mention the alternative (a class mutating internal state and returning `this`) and why you chose this one — the trade-off statement is the point.

---

### Q: Implement an `EventEmitter` / Observer.

```javascript
class EventEmitter {
  #listeners = new Map();

  on(event, cb) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(cb);
    return () => this.off(event, cb);        // unsubscribe handle
  }
  once(event, cb) {
    const off = this.on(event, (...a) => { off(); cb(...a); });
    return off;
  }
  off(event, cb) { this.#listeners.get(event)?.delete(cb); }
  emit(event, ...args) {
    [...(this.#listeners.get(event) ?? [])].forEach((cb) => cb(...args));
  }
}
```

**The two details that get noticed:** `on` returns an **unsubscribe function** (far better ergonomics than making callers retain the exact reference), and `emit` iterates a **copy** of the set so a listener that unsubscribes during dispatch doesn't corrupt the iteration.

---

### Q: Implement an LRU cache with O(1) get and put.

**Answer.** The textbook answer is a hash map plus a doubly linked list. In JavaScript there's a cleaner route: **`Map` preserves insertion order**, and `delete` + `set` moves a key to the most-recent position.

```javascript
class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); }

  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);        // re-insert to mark as most recently used
    this.map.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value);   // oldest = first key
    }
    this.map.set(key, value);
  }
}
```

Both operations are O(1). **Say you know the linked-list version too** and that you're choosing `Map` for clarity — then be ready to write the node-based one if they push, because some interviewers want to see pointer manipulation.

---

## 5. Promises & Async Control Flow

### Q: Implement `promiseAllSync` — sequential execution, no `async`/`await`.

```javascript
function promiseAllSync(tasks) {
  const results = [];
  return tasks
    .reduce(
      (chain, task) =>
        chain.then(() => task()).then((value) => { results.push(value); }),
      Promise.resolve()
    )
    .then(() => results);
}
```

**Answer.** Each `.then` returns a promise, so reassigning the chain guarantees task *n+1* doesn't start until task *n* resolves. Output order is preserved because results are pushed in resolution order, which here equals invocation order.

**The critical distinction to state:** `Promise.all` starts everything **immediately** and waits for all — total time is the slowest task. This runs them **one after another** — total time is the sum. Sequential is what you want for rate-limited APIs, ordered writes, or dependent steps. Parallel is what you want otherwise.

Note the tasks must be **functions returning promises**, not promises. A promise is already running the moment it's created — you can't sequence an array of live promises.

**Error handling:** a rejection anywhere breaks the chain and propagates. If you want "keep going and report everything," that's `Promise.allSettled` semantics — mention it.

---

### Q: Implement `retry(fn, retries)` — no `async`/`await`.

```javascript
function retry(fn, retries, delay = 0) {
  return fn().catch((err) => {
    if (retries <= 0) return Promise.reject(err);
    return new Promise((res) => setTimeout(res, delay))
      .then(() => retry(fn, retries - 1, delay * 2));   // exponential backoff
  });
}
```

**Answer.** Recursion through `.catch` — return the recursive call so the promise chain flattens and the caller sees a single settled result. Stop immediately on success (`.catch` isn't entered), reject after exhausting attempts.

**Raise unprompted:** **exponential backoff** (hammering a failing server makes the outage worse), a cap on total delay, jitter to avoid thundering herds, and that you should **only retry idempotent operations** — retrying a `POST /payments` can double-charge. That last point is what makes this answer stand out.

---

### Q: Enforce a time limit on an API call (Moniepoint).

```javascript
const enforceTimeLimit = (apiFn, timeLimit) => (...args) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Time Limit Exceeded")), timeLimit);
  });
  return Promise.race([apiFn(...args), timeout]).finally(() => clearTimeout(timer));
};
```

**Answer.** `Promise.race` settles with whichever finishes first. If the API wins, you get its value; if the timer wins, you get the rejection.

**The improvement over the article's version:** it never clears the timer. Without `.finally(() => clearTimeout(timer))` the timeout keeps a live handle even after success — a slow leak, and in Node it keeps the process alive. Adding that shows you think about cleanup.

**The honest limitation to state:** `race` doesn't *cancel* the underlying request — it's still in flight, still consuming a connection. For real cancellation you need `AbortController` wired into `fetch`.

---

### Q: How do you prevent race conditions in a search-as-you-type?

**Answer.** Typing `N → Ne → New` fires three requests. They can resolve in any order, so a slower response for `"N"` can land *after* `"New"` and overwrite the correct results with stale ones. Debouncing reduces how often this happens but **does not fix it** — that's the key insight, and it's the most common miss.

Two correct fixes:

```javascript
// 1. AbortController — cancel the previous request outright
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal })
    .then((r) => r.json())
    .then(setResults)
    .catch((e) => { if (e.name !== "AbortError") setError(e); });
  return () => controller.abort();
}, [query]);
```

```javascript
// 2. Sequence guard — ignore any response that isn't the latest
const latest = useRef(0);
async function search(q) {
  const id = ++latest.current;
  const data = await fetchResults(q);
  if (id === latest.current) setResults(data);   // stale responses discarded
}
```

Prefer `AbortController`: it stops wasted network and server work, not just the state update. The sequence guard is the fallback when the API layer can't accept a signal.

---

## 6. Memory Management

### Q: What causes memory leaks in a frontend app?

**Answer.** A leak is anything the garbage collector still considers *reachable* that your app is done with. GC is reachability-based, not reference-count-based, so cycles alone aren't leaks — unreachable cycles are collected fine.

The four sources, in the order they actually occur:

1. **Uncleared timers.** `setInterval` never stops on its own, and it retains every variable its callback closes over. Always clear in cleanup.
2. **Un-removed event listeners**, especially on `window`, `document`, or long-lived DOM nodes. The listener keeps the closure — and often a whole component's scope — alive.
3. **Detached DOM nodes.** You remove an element from the document but a JS variable, array, or map still points at it. The node and its entire subtree stay in memory. Classic in hand-rolled caches of DOM references.
4. **Unbounded growth.** Caches with no eviction, arrays you only ever push to, global registries, `console.log` of large objects in dev tools.

**Fifth, subtler:** closures retaining more than they need — an inner function that uses one small field but keeps the whole enclosing scope alive.

**The React-specific version** (say this, it lands): every `useEffect` that subscribes, opens a socket, or starts a timer must return a cleanup function. That's what the cleanup return value is *for*.

**Detection:** Chrome DevTools Memory panel — take a heap snapshot, interact, snapshot again, and compare with "Objects allocated between snapshots." Detached nodes show up under a dedicated filter.

---

## 7. Design Patterns in JavaScript

### Q: Implement a Singleton.

```javascript
class Database {
  static #instance;
  constructor() {
    if (Database.#instance) return Database.#instance;
    Database.#instance = this;
  }
}
new Database() === new Database();   // true
```

**Say the caveat.** In an ES module system, a plain exported object is already a singleton — modules are evaluated once and cached. The class form is mostly a legacy pattern, and singletons make testing harder because shared state leaks between tests. Naming that trade-off is more valuable than the implementation.

### The four patterns Oracle asked about, with real frontend uses

| Pattern | Where it actually shows up |
|---|---|
| **Singleton** | API client, analytics instance, store, feature-flag registry |
| **Factory** | Creating typed components/notifications from a config object |
| **Observer** | Event emitters, pub-sub, store subscriptions, `IntersectionObserver` |
| **Module** | Encapsulating private state; superseded by ES modules |
| **Adapter** | Wrapping Sentry / Datadog / Mixpanel behind one logging API |
| **Strategy** | Swapping sort/filter/validation algorithms at runtime |

The corpus is explicit that interviewers want **where these are useful in real frontend applications**, not definitions. Always answer with the use case first, the mechanism second.

---

*Next: [`02-react-core.md`](./02-react-core.md) — reconciliation, hooks, re-render control, and component patterns.*
