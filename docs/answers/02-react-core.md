# React — Rendering & Hooks

Model answers for §7–§10 of the [knowledge map](../frontend-knowledge-map.md). Note the corpus pattern: nobody was rejected for not knowing a React API. The React questions that decide loops are about **why React behaves as it does**, **re-render control**, and **component API design**.

---

## 1. The Rendering Model

### Q: What is the Virtual DOM, and is it faster than the real DOM?

**Answer.** The Virtual DOM is a lightweight JS object tree describing what the UI should look like. On a state change React builds a new tree, diffs it against the previous one, and applies the minimal set of real DOM mutations.

**And no — it is not inherently faster than the DOM.** Hand-written, perfectly targeted DOM updates will always beat it, because the VDOM adds diffing work on top of the same final mutations. What it buys you is a *declarative programming model with predictable performance*: you describe the end state, React figures out the transition, and you avoid the far worse failure mode of ad-hoc imperative updates that cause redundant layout thrash.

Saying "it's faster" is the answer that gets probed. Saying "it trades a little raw speed for a declarative model and good-enough batching" is the answer that lands.

---

### Q: Explain reconciliation and the diffing algorithm.

**Answer.** A general tree-diff is O(n³). React makes it O(n) with two heuristics:

1. **Different element type ⇒ throw the subtree away.** If a `<div>` becomes a `<span>`, or `<ComponentA>` becomes `<ComponentB>`, React unmounts the entire old subtree (running cleanups) and mounts the new one fresh. It does not attempt to match children across a type change.
2. **Keys give siblings a stable identity.** Within a list, React matches elements by `key` rather than position, so it can move rather than recreate.

Same type + same position = same component instance, so state is preserved and the fiber is updated in place.

**Follow-up: what is Fiber?** The reimplementation of the reconciler as a linked list of units of work rather than a recursive call stack. Because it's a data structure rather than the stack, React can **pause, resume, reprioritize, and abandon** rendering work. That's what makes concurrent features (`useTransition`, `useDeferredValue`, Suspense) possible. Render is interruptible; **commit is not** — commit is synchronous and atomic.

---

### Q: Why do keys matter? What's wrong with using the array index?

**Answer.** Keys tell React which element in the new list corresponds to which in the old list. Without stable keys it falls back to position.

Index keys are fine **only if** the list is static — never reordered, filtered, inserted into, or deleted from. Otherwise identity shifts under React's feet.

Concretely: a list `[A, B, C]` with index keys, delete `A`. React sees key `0` change from A's content to B's content and *updates* that instance rather than removing it. Any state living in that instance — an uncontrolled input's text, a checkbox, focus position, an animation — stays with the **wrong item**. The classic bug is a list of inputs where deleting a row shifts everyone's typed text up by one.

Use a stable domain ID. If none exists, generate one when the item is created — not at render time, which would produce a new key every render and force a full remount.

**"Incorrect list keys" is one of the five planted bugs in the debugging round.** Know it cold.

---

### Q: What causes a component to re-render?

**Answer.** Exactly three things:

1. Its own state changed (`useState` / `useReducer`).
2. Its parent re-rendered.
3. A context it consumes changed value.

That's the whole list. **Props changing is not on it** — a child re-renders because its parent did, which usually coincides with new props but doesn't require them.

**The consequence most people miss:** a re-render is not a DOM update. React re-runs the function, diffs the result, and commits **only** what actually differs. A re-render with an identical output costs a function call and a diff, not a repaint. So "extra re-render" is not automatically a bug — it's a bug when the render function is expensive or the tree beneath it is large. Say this; it prevents you from prescribing `memo` everywhere.

React 18+ **batches** all state updates within the same tick, including inside promises and native handlers.

---

### Q: `useEffect` vs `useLayoutEffect`.

**Answer.** Both run after render commits to the DOM. The difference is timing relative to **paint**.

`useLayoutEffect` runs **synchronously after DOM mutation, before the browser paints**. It blocks paint. Use it only when you must read layout and mutate before the user sees anything — measuring an element to position a tooltip, reading scroll position, preventing a visible flicker.

`useEffect` runs **asynchronously after paint**. It's the default for everything else: data fetching, subscriptions, logging, timers.

**Rule:** default to `useEffect`. Reach for `useLayoutEffect` only when you observe a flash of incorrect content — that flash *is* the diagnostic. And note it warns during SSR, since there's no layout to measure on the server.

---

### Q: When do cleanup functions run?

**Answer.** The cleanup returned from an effect runs (a) before the effect re-runs due to a dependency change, and (b) when the component unmounts. So the real mental model is: **each effect run is paired with exactly one cleanup**, before the next run or at teardown.

This is why the model is *synchronization*, not *lifecycle*: the effect says "given these deps, set up this connection," and cleanup says "tear down the connection for the previous deps." React 18 Strict Mode deliberately mounts, unmounts, and remounts in development to surface effects that don't clean up properly.

---

## 2. Hooks

### Q: `useMemo` vs `useCallback` — difference and when to use each.

**Answer.** `useMemo(fn, deps)` caches the **return value** of a computation. `useCallback(fn, deps)` caches the **function itself** — it's literally `useMemo(() => fn, deps)`.

Three legitimate uses, and outside these they're noise:

1. **Genuinely expensive computation** — sorting/filtering thousands of rows, parsing, heavy derivation. Measure first.
2. **Referential stability for a memo boundary** — the value is a dep of another hook, or a prop to a `React.memo` child. Without stabilization, the memoization downstream never hits.
3. **Referential stability for effect deps** — an object or function in a `useEffect` dep array that would otherwise change identity every render and cause an infinite loop.

**Now say the counterpoint, because the corpus grades it.** From Moniepoint's code-review round:

> "**useMemo is unnecessary.** Rendering `searchResults.map(...)` is cheap. Unless there are thousands of rows, `useMemo` adds unnecessary complexity."

Every memo has a cost: the hook call, the dep array comparison, the retained value, and the reading burden. Applied reflexively it's a net loss. **The senior answer is a decision procedure, not a preference:** measure with the Profiler → fix structure first → memoize only the boundary that measurement identified.

---

### Q: What is a stale closure and how do you avoid it?

**Answer.** Every render creates fresh function objects that close over *that render's* props and state. If a function outlives the render — inside a `setTimeout`, an event listener, a subscription, or a `useCallback` with incomplete deps — it keeps reading the old values forever.

```javascript
// BROKEN — logs 0 forever
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []);   // count captured from the first render only
```

Three fixes, in order of preference:

```javascript
// 1. Functional updater — no dependency on the current value at all
setCount((c) => c + 1);

// 2. Honest dependencies — effect re-subscribes when count changes
useEffect(() => { /* ... */ }, [count]);

// 3. Ref as a mutable escape hatch — when re-subscribing is too costly
const countRef = useRef(count);
countRef.current = count;
useEffect(() => {
  const id = setInterval(() => console.log(countRef.current), 1000);
  return () => clearInterval(id);
}, []);
```

**Never silence the exhaustive-deps lint rule.** An empty dep array on an effect that reads state is the single most common real React bug, and it's one of the five planted bugs in the debugging round.

---

### Q: Write a hook that runs on every render except the first (Paytm Money).

```javascript
function useDidUpdate(callback, deps) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    return callback();
  }, deps);
}
```

**Why `useRef` and not `useState`:** a ref is a mutable box that persists across renders **without triggering one**. Using state here would cause an extra render on mount — exactly what you're trying to avoid.

**Flag the Strict Mode caveat:** in React 18 development, Strict Mode double-invokes effects, so the ref flips on the first pass and your callback fires on what looks like the first render. It behaves correctly in production. Mentioning this is a strong signal.

---

### Q: Write `useDebounce`. (And what's wrong with this one?)

The Moniepoint code-review round handed candidates this hook:

```javascript
// BROKEN
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    setDebouncedValue(value);                              // ← fires immediately
    const handler = setTimeout(() => {
      console.log("Debounce timer expired");               // ← timer does nothing
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
```

**The bug.** The state is updated synchronously on every keystroke, and the timer only logs. There is no debounce at all — the hook has the shape of one and none of the behavior. Every keystroke still fires a request.

```javascript
// CORRECT
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);   // each new value cancels the pending update
  }, [value, delay]);
  return debounced;
}
```

The cleanup is what makes it work: a new keystroke cancels the pending timer before it fires, so only the last value in a burst survives.

**Also flag the delay.** The PR used `useDebounce(searchText, 10)`. 10ms is not a debounce — it's a rounding error. Use 250–500ms; **300ms** is the defensible default.

---

### Q: Custom hooks — what belongs in one?

**Answer.** A custom hook extracts **stateful logic**, not markup. If two components share JSX, that's a component. If they share `useState`/`useEffect` wiring, that's a hook.

Each call gets its own isolated state — hooks share logic, never state. Two components calling `useDebounce` don't interact.

Naming with `use` isn't cosmetic: it's how the linter knows to enforce the Rules of Hooks on the function.

**The set worth having written:** `useDebounce`, `useFetch` (with abort), `useDidUpdate`, `useOnClickOutside`, `useLocalStorage`, `useMediaQuery`, `useTabs`.

---

### Q: Why can't hooks be called conditionally?

**Answer.** React doesn't know hook *names* — it tracks them by **call order** in a per-fiber list. First `useState` is slot 0, second is slot 1, and so on. A conditional hook shifts every subsequent slot, so on the next render React hands slot 1's value to what is now slot 0. State silently attaches to the wrong hook.

The fix is never to conditionalize the hook — it's to conditionalize *inside* it (`useEffect(() => { if (!enabled) return; ... }, [enabled])`), or to split into two components.

---

## 3. Performance & Debugging

### Q: A React app is slow. Walk me through it.

**Answer — the order matters as much as the content.**

**1. Measure.** React DevTools Profiler, record the interaction, read the flamegraph. Which components rendered, how long each took, and *why* they rendered (turn on "record why each component rendered"). Never optimize before this step.

**2. Classify.** Slow renders (one component doing too much work) vs too many renders (a component re-rendering when nothing relevant changed). The fixes are completely different.

**3. Fix structure before reaching for memo.**
- **Lift state down** — move state into the smallest subtree that needs it. A modal's open/closed state in the page root re-renders the page; in the modal's own wrapper it doesn't.
- **Pass `children` as props** — children created by the parent don't re-render when the wrapper's state changes, because their element objects are referentially unchanged.
- **Split components** so an expensive subtree isn't coupled to frequently-changing state.
- **Split contexts** — one context per concern, so a theme change doesn't re-render every consumer of user data.

**4. Then memoize the specific boundary measurement identified** — `React.memo` on the child, `useCallback`/`useMemo` on the props feeding it. All three together or none: `memo` on a component receiving a fresh inline arrow every render does nothing.

**5. Then the specialist tools** — virtualization for long lists, `useTransition`/`useDeferredValue` to keep input responsive, code splitting for bundle weight, `content-visibility` for offscreen work.

---

### Q: Here's a repo with performance problems. Find them. *(You have five minutes.)*

The corpus is explicit that this is **timed** — Goibibo expected the fix in 5 minutes and rejected a 20-minute solve. The planted bugs are a fixed menu:

| Bug | What it looks like | Fix |
|---|---|---|
| **Expensive work in render** | A sort/filter/parse running inline in the component body | Move out, or `useMemo` with honest deps |
| **Missing dependency array** | `useEffect` with no second arg, running every render | Add deps; check for the infinite loop it was hiding |
| **Excess re-renders** | Inline object/array/arrow props into a `memo`'d child | `useCallback`/`useMemo`, or restructure |
| **Index as key** | `key={i}` on a reorderable/filterable list | Stable domain ID |
| **Uncleared timers/listeners** | `setInterval` or `addEventListener` with no cleanup return | Return a cleanup function |

**Practice the scan, not just the knowledge:** open Profiler → find the widest bar → check "why did this render" → look at that component's deps arrays and prop identities. Two minutes to locate, three to fix.

---

### Q: Derived state vs stored state (the Okta grid).

The problem: an `n×n` grid; clicking an empty cell sets it to `max(all values) + 1`, clicking a filled cell sets it to `max(all values)`.

**Answer.** Keep **only the grid** in state. Compute the max on each click by flattening and reducing. Don't store `currentMax` alongside the grid.

> "Instead of storing the current maximum separately in state, I kept only the grid state as the source of truth… This avoids synchronization issues between multiple states."

**The principle:** two pieces of state that must agree is a bug waiting to happen. Every code path that updates one must remember to update the other; the first one that forgets creates a state the UI can't represent. If a value can be computed from existing state, compute it.

```javascript
const [grid, setGrid] = useState(() =>
  Array.from({ length: n }, () => Array(n).fill(null))
);

function handleClick(r, c) {
  setGrid((prev) => {
    const max = Math.max(0, ...prev.flat().filter((v) => v !== null));
    const next = prev.map((row, i) => (i === r ? [...row] : row));  // clone only the touched row
    next[r][c] = prev[r][c] === null ? max + 1 : max;
    return next;
  });
}
```

**Then state the trade-off unprompted** — this is what the interviewer was actually listening for. Flattening is O(n²) per click. For a large grid you *could* cache the max in state, at the cost of the synchronization risk you just eliminated. You'd only do it if profiling showed the scan mattered. The interviewer said it directly: *"more interested in why I chose a particular implementation than simply getting the correct output."*

Note also `prev.map((row, i) => i === r ? [...row] : row)` — clone only the affected row, keeping the other rows referentially identical so memoized row components don't re-render.

---

## 4. Component Patterns

### Q: Build Tabs as a compound component (the Moniepoint spec).

Required: state in a `useTabs` hook, context for children, arrow-key navigation, Enter/Space activation, full ARIA, visible focus ring, no `any`.

```tsx
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
  registerTab: (id: string) => void;
  tabs: string[];
}
const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs subcomponents must be used inside <Tabs>");
  return ctx;
}

function useTabs(defaultTab: string): TabsContextValue {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [tabs, setTabs] = useState<string[]>([]);

  const registerTab = useCallback((id: string) => {
    setTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  return useMemo(
    () => ({ activeTab, setActiveTab, registerTab, tabs }),
    [activeTab, registerTab, tabs]
  );
}

function Tabs({ children, defaultTab }: TabsProps) {
  const value = useTabs(defaultTab);
  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

function TabsList({ children }: TabsListProps) {
  const { tabs, activeTab, setActiveTab } = useTabsContext();

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = tabs.indexOf(activeTab);
    if (e.key === "ArrowRight") setActiveTab(tabs[(i + 1) % tabs.length]);
    else if (e.key === "ArrowLeft") setActiveTab(tabs[(i - 1 + tabs.length) % tabs.length]);
    else if (e.key === "Home") setActiveTab(tabs[0]);
    else if (e.key === "End") setActiveTab(tabs[tabs.length - 1]);
    else return;
    e.preventDefault();
  }

  return <div role="tablist" onKeyDown={onKeyDown}>{children}</div>;
}

function Tab({ id, children }: TabProps) {
  const { activeTab, setActiveTab, registerTab } = useTabsContext();
  useEffect(() => registerTab(id), [id, registerTab]);
  const selected = activeTab === id;

  return (
    <button
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      tabIndex={selected ? 0 : -1}          // roving tabindex
      onClick={() => setActiveTab(id)}
      className={selected ? "border-b-2 border-blue-600 focus-visible:ring-2"
                          : "text-gray-500 focus-visible:ring-2"}
    >
      {children}
    </button>
  );
}

function TabsPanel({ tabId, children }: TabsPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== tabId) return null;
  return <div role="tabpanel" id={`panel-${tabId}`} aria-labelledby={`tab-${tabId}`} tabIndex={0}>
    {children}
  </div>;
}

Tabs.List = TabsList;
Tabs.Tab = Tab;
Tabs.Panel = TabsPanel;
```

**The five things being graded:**

1. **Context throws when used outside the provider** — a real API contract, not a silent `undefined`.
2. **Roving tabindex** — exactly one tab is in the tab order (`tabIndex={0}`), the rest are `-1`. Tab moves *into and out of* the tablist; arrows move *within* it. Making all tabs tabbable is the most common a11y mistake here.
3. **The full ARIA triangle** — `role`, `aria-selected`, `aria-controls` on the tab, `aria-labelledby` back on the panel.
4. **Memoized context value** — without `useMemo`, every `Tabs` render hands consumers a new object and re-renders all of them.
5. **`focus-visible`, not `focus`** — keyboard users get a ring, mouse users don't. Removing focus outlines entirely fails accessibility outright.

---

### Q: Why compound components over a props API?

**Answer.** Compare:

```jsx
<Tabs items={[{id, label, content}, ...]} activeTab={...} onTabChange={...} />
<Tabs><Tabs.List><Tabs.Tab>…</Tabs.Tab></Tabs.List><Tabs.Panel>…</Tabs.Panel></Tabs>
```

The config API is simpler to call and fine when every use looks the same. It collapses the moment someone needs an icon in one tab, a badge on another, a custom panel wrapper, or tabs in a different order than panels — you end up adding `renderTab`, `tabClassName`, `iconPosition` props until the component is unmaintainable.

The compound API pushes layout and content decisions to the consumer while keeping state, keyboard behavior, and ARIA wiring in the library. **Composition over configuration.**

The cost, stated honestly: more verbose at the call site, an implicit contract enforced at runtime rather than by types, and children must be within the provider.

**This is exactly the axis BrowserStack rejected on** — "designing reusable UI components, particularly autocomplete as part of a design system." When asked to "design a component," they want the API discussion, not the implementation.

---

### Q: Build a recursive tree (file explorer / nested comments).

```jsx
function TreeNode({ node, onToggle, onSelect, selectedId }) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = node.type === "folder";

  return (
    <li role="treeitem" aria-expanded={isFolder ? expanded : undefined}>
      <button
        onClick={() => (isFolder ? setExpanded((e) => !e) : onSelect(node.id))}
        aria-current={selectedId === node.id}
      >
        {isFolder ? (expanded ? "▾" : "▸") : "•"} {node.name}
      </button>
      {isFolder && expanded && node.children?.length > 0 && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} onToggle={onToggle}
                      onSelect={onSelect} selectedId={selectedId} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

**The render is the easy half.** The graded half is the immutable update into arbitrary depth:

```javascript
function addChild(node, parentId, newNode) {
  if (node.id === parentId) {
    return { ...node, children: [...(node.children ?? []), newNode] };
  }
  if (!node.children) return node;

  let changed = false;
  const children = node.children.map((child) => {
    const next = addChild(child, parentId, newNode);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, children } : node;   // preserve identity on untouched branches
}
```

**The `changed` flag is the senior detail.** Naively rebuilding every node on every edit gives every branch a new reference, defeating any memoization down the tree. Returning the *same* object for untouched subtrees means `React.memo` on `TreeNode` actually works.

**The architecture question they'll ask:** nested tree vs normalized map?

- **Nested** — natural to render, but every update requires a recursive path copy, and lookup by ID is O(n).
- **Normalized** `{ [id]: { id, name, childIds: [] } }` — O(1) lookup and update, trivial to memoize per node, but you reconstruct the hierarchy at render and need a root pointer.

Normalize when the tree is large, updates are frequent, or the same node appears in multiple views. Keep it nested for a small, mostly-read tree. **Naming the trade-off is the answer**; either choice is acceptable if justified.

---

### Q: Controlled vs uncontrolled components.

**Answer.** In a controlled component React state is the single source of truth — `value` plus `onChange`. In an uncontrolled one the DOM holds the value and you read it via a ref or on submit (`defaultValue`).

Controlled gives you instant validation, formatting-as-you-type, conditional disabling, and cross-field dependencies — at the cost of a render per keystroke. Uncontrolled is faster and simpler for large plain forms, which is why React Hook Form is built on it.

**For library components, support both.** That's the real design answer:

```javascript
function useControllableState(controlledValue, defaultValue, onChange) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;

  const setValue = useCallback((next) => {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  }, [isControlled, onChange]);

  return [value, setValue];
}
```

A `<Dropdown value onChange>` is controlled; a `<Dropdown defaultValue>` manages itself. Every serious component library does this, and it's the expected answer when asked to "design a reusable dropdown."

---

### Q: When do you reach for Context, and what's the cost?

**Answer.** Context solves **prop drilling**, not state management. It's a transport mechanism, not a store.

The cost: **every consumer re-renders when the context value changes**, regardless of which part they read. Two specific mitigations:

1. **Memoize the value.** `<Provider value={{ user, setUser }}>` creates a new object every render and re-renders every consumer even when nothing changed. `useMemo` it.
2. **Split by change frequency.** One context for the rarely-changing user object, another for frequently-changing UI state. A theme toggle shouldn't re-render every component reading auth data.

**Threshold:** prop drilling through 2–3 levels is fine and more explicit. Context for genuinely app-wide, rarely-changing values (theme, locale, auth, feature flags). A real store (Zustand, Redux) when you need selector-based subscriptions so components re-render only on the slice they read — which is precisely what Context cannot do.

---

## 5. Code Splitting & Suspense

### Q: `React.lazy` vs dynamic `import()`. When do you code split?

**Answer.** `import()` is the JS-level primitive — it returns a promise for a module and tells the bundler to emit a separate chunk. `React.lazy` wraps it so the module can be rendered as a component, with Suspense handling the pending state.

```jsx
const Chart = React.lazy(() => import("./HeavyChart"));

<Suspense fallback={<ChartSkeleton />}>
  <Chart data={data} />
</Suspense>
```

Use plain `import()` for non-component code — a date library, a PDF generator, an editor loaded on demand.

**Where to split:** route boundaries first (biggest win, natural boundary), then heavy below-the-fold or interaction-gated components (modals, charts, rich text editors), then large third-party libraries used on one screen.

**Where not to:** small components — you trade a bundle saving for a network round trip and a loading flash, usually a net loss.

**Two details that get noticed:** use a **skeleton matching the final layout** as the fallback, not a spinner, so you don't cause layout shift (CLS). And **prefetch on intent** — start the import on hover or when the route enters the viewport, so the chunk is often already there by the time it's needed.

---

*Next: [`07-machine-coding-core.md`](./07-machine-coding-core.md) — reference implementations for the ten components.*
