# Answer Bank 12 — React in Depth

[`02-react.md`](./02-react.md) covers the reconciliation model, hooks, re-render control and the core patterns. This file covers what it did not reach: the escape hatches, error handling, concurrent features in practice, React 19's APIs, and the composition patterns that separate library-quality components from app-quality ones.

---

## PART A — THE ESCAPE HATCHES

### 1. Refs: three distinct jobs

`useRef` looks like one hook but does three unrelated things, and conflating them causes bugs.

**(a) A DOM handle**
```jsx
const inputRef = useRef(null);
useEffect(() => { inputRef.current?.focus(); }, []);
return <input ref={inputRef} />;
```

**(b) An instance variable that does not trigger renders**
```jsx
const renderCount = useRef(0);
renderCount.current += 1;          // changes without re-rendering
```

**(c) A deliberate escape from the render snapshot**
```jsx
const latestProps = useRef(props);
latestProps.current = props;        // always current, unlike a closure
```

**The rule that prevents most ref bugs:** if a value is *rendered*, it belongs in state. If it is only *read by effects, handlers or timers*, a ref is right. The moment you find yourself calling `forceUpdate` after mutating a ref, you needed state.

**Never read or write `ref.current` during render.** Render must be pure; refs are mutable. React may render twice (Strict Mode), discard a render (concurrent), or reorder work — and ref mutation during render breaks all three.

### 2. Callback refs and `ref` cleanup

A function ref runs when the node attaches and detaches — useful when you need to *do* something on attach, not just store the node:

```jsx
const measuredRef = useCallback((node) => {
  if (node !== null) setHeight(node.getBoundingClientRect().height);
}, []);
return <div ref={measuredRef} />;
```

**React 19 adds cleanup functions to refs**, which removes a long-standing awkwardness:

```jsx
<div ref={(node) => {
  const observer = new ResizeObserver(handleResize);
  observer.observe(node);
  return () => observer.disconnect();     // React 19: runs on detach
}} />
```

Before 19 you had to check for `null` and tear down in the else branch.

### 3. `forwardRef` and `useImperativeHandle`

For a library component, expose a **deliberate, minimal** imperative API rather than the raw DOM node:

```jsx
const TextField = forwardRef(function TextField({ label, ...props }, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => { inputRef.current.value = ''; },
    // Deliberately NOT exposing the node — callers cannot reach in and mutate styles.
  }), []);

  return <label>{label}<input ref={inputRef} {...props} /></label>;
});
```

**The design point:** exposing the DOM node means every consumer can do anything, and you can never change your internals. A named surface (`focus`, `clear`) is a contract you can keep.

**React 19 drops `forwardRef`** — `ref` is now a normal prop:
```jsx
function TextField({ label, ref, ...props }) { /* ... */ }
```

---

## PART B — ERROR HANDLING

### 4. Error boundaries

The corpus never covers this, and it is the difference between one broken widget and a white screen.

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };                    // render phase: swap in the fallback
  }

  componentDidCatch(error, info) {
    logToService(error, info.componentStack);   // commit phase: report it
  }

  render() {
    if (this.state.error) {
      return this.props.fallback?.(this.state.error, () => this.setState({ error: null }))
        ?? <p role="alert">Something went wrong.</p>;
    }
    return this.props.children;
  }
}
```

**Why it must still be a class:** there is no hook equivalent — `getDerivedStateFromError` has no functional counterpart. Use `react-error-boundary` in real projects, but know why.

**What error boundaries do NOT catch** — this is the interview question:
- Event handlers (use try/catch)
- `setTimeout` / `requestAnimationFrame` callbacks
- Server-side rendering
- Errors thrown inside the boundary itself
- **Async code** — a rejected promise in an effect is not caught

**Where to place them:** not one at the root. Wrap independent regions — each dashboard widget, each route, each panel — so one failure degrades a section rather than the app. Pair with a `key` that changes on retry so the subtree remounts cleanly.

**Reset on navigation**, or a user who hits an error is stuck in the fallback forever:
```jsx
<ErrorBoundary key={location.pathname}>
```

---

## PART C — CONCURRENT REACT IN PRACTICE

### 5. `useTransition` — keep input responsive

```jsx
function SearchableList({ items }) {
  const [query, setQuery] = useState('');
  const [deferredQuery, setDeferredQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    setQuery(e.target.value);                 // urgent: the input must feel instant
    startTransition(() => {
      setDeferredQuery(e.target.value);       // non-urgent: the expensive list can lag
    });
  }

  const filtered = useMemo(
    () => items.filter((i) => i.name.includes(deferredQuery)),
    [items, deferredQuery]
  );

  return (
    <>
      <input value={query} onChange={handleChange} />
      <ul style={{ opacity: isPending ? 0.6 : 1 }}>{/* ... */}</ul>
    </>
  );
}
```

**Why this beats debouncing.** Debounce *delays* work by a fixed guess. A transition lets React **start** the work immediately and **interrupt** it if something more urgent arrives. On a fast machine the list updates instantly; on a slow one it degrades gracefully. Debounce is the same 300ms penalty for everyone.

**`useDeferredValue`** is the simpler form when you don't own the setter:
```jsx
const deferredQuery = useDeferredValue(query);   // lags behind during heavy renders
```

**Both address INP directly** — this is the modern answer to "how do you keep the UI responsive during expensive rendering", and it beats the debounce answer most candidates give.

### 6. `Suspense` for data, not just code

```jsx
<Suspense fallback={<ProfileSkeleton />}>
  <Profile userId={id} />
</Suspense>
```

Each boundary is an **independent loading region** — a slow section doesn't block a fast one. In React 19, `use()` reads a promise directly:

```jsx
function Profile({ userPromise }) {
  const user = use(userPromise);      // suspends until resolved
  return <h1>{user.name}</h1>;
}
```

**`use()` is not a normal hook** — it can be called conditionally and inside loops, because it doesn't rely on call order.

**The design decision:** where to put boundaries is a *product* call, not a technical one. Too few and you're back to all-or-nothing loading; too many and the page flickers into existence in distracting pieces. Group by what the user needs first.

---

## PART D — REACT 19

### 7. Actions and form state

React 19 makes async mutations first-class, replacing a pile of manual `isSubmitting` state.

```jsx
function CommentForm({ postId }) {
  const [state, formAction, isPending] = useActionState(
    async (previousState, formData) => {
      try {
        await postComment(postId, formData.get('text'));
        return { ok: true, error: null };
      } catch (e) {
        return { ok: false, error: e.message };   // returned state, not thrown
      }
    },
    { ok: false, error: null }
  );

  return (
    <form action={formAction}>
      <textarea name="text" required />
      <button disabled={isPending}>{isPending ? 'Posting…' : 'Post'}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

**What you get free:** pending state, the form resets on success, and it works before hydration because it's a real form submission.

**`useFormStatus`** lets a nested component read the parent form's state with no prop drilling:

```jsx
function SubmitButton() {
  const { pending } = useFormStatus();     // reads the enclosing <form>
  return <button disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>;
}
```

**`useOptimistic`** — the optimistic-update pattern, built in:

```jsx
const [optimisticComments, addOptimistic] = useOptimistic(
  comments,
  (current, newComment) => [...current, { ...newComment, sending: true }]
);

async function submit(formData) {
  addOptimistic({ text: formData.get('text') });   // shows immediately
  await postComment(formData);                     // reverts automatically on failure
}
```

The revert-on-failure is automatic, which removes the snapshot-and-rollback boilerplate from `07-modern-react-data.md`.

### 8. Other React 19 changes worth knowing

- **`ref` as a prop** — `forwardRef` no longer needed
- **Ref cleanup functions** — return a teardown from a callback ref
- **Document metadata hoists** — `<title>`, `<meta>`, `<link>` rendered anywhere move to `<head>` automatically
- **`useDeferredValue` takes an initial value** — `useDeferredValue(value, initialValue)`
- **Context as a provider** — `<ThemeContext value={x}>` instead of `<ThemeContext.Provider value={x}>`
- **Better hydration errors** — a real diff instead of a generic warning
- **The compiler** (separate, opt-in) auto-memoizes, which will make most manual `useMemo`/`useCallback` unnecessary. Know that it exists; don't assume it's on.

---

## PART E — COMPOSITION PATTERNS

### 9. Slots, and why `children` beats a render prop

```jsx
// Configuration — every variation needs a new prop
<Card title="X" subtitle="Y" actions={[...]} icon={...} />

// Slots — the consumer decides what goes where
<Card>
  <Card.Header>
    <Card.Title>X</Card.Title>
    <Badge>New</Badge>          {/* not something the API author anticipated */}
  </Card.Header>
  <Card.Body>…</Card.Body>
</Card>
```

**The performance side-effect people miss:** children passed as props are created by the *parent*, so they keep their element identity when the wrapper's state changes. This is the "pass children as props" optimisation from `02` — a component that only wraps its children does not re-render them when its own state changes.

```jsx
// Expensive re-renders on every tick
function Wrapper() { const [n, setN] = useState(0); return <div><Expensive /></div>; }

// Expensive does NOT re-render — its element was created by the parent
function Wrapper({ children }) { const [n, setN] = useState(0); return <div>{children}</div>; }
```

### 10. State reducers and controllable state

The pattern behind every serious component library — let consumers control state when they need to, manage it internally when they don't. Full `useControllableState` implementation is in [`02-react.md` §4](./02-react.md).

**The state reducer pattern** goes further, letting consumers intercept state transitions:

```jsx
function useToggle({ reducer = (state, action) => action.changes } = {}) {
  const [state, dispatch] = useReducer((s, action) => {
    const changes = internalReducer(s, action);
    return reducer(s, { ...action, changes });   // consumer can veto or modify
  }, { on: false });
  return state;
}

// Consumer: "allow toggling off, but never more than 3 times"
useToggle({
  reducer(state, action) {
    if (action.type === 'toggle' && count > 3) return state;   // veto
    return action.changes;
  }
});
```

This is how Downshift and React Table stay flexible without exploding their prop surface.

### 11. Polymorphic components in TypeScript

```tsx
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, 'as' | 'children'>;

function Text<E extends React.ElementType = 'span'>({ as, ...rest }: PolymorphicProps<E>) {
  const Component = as ?? 'span';
  return <Component {...rest} />;
}

<Text as="h1" id="title">Heading</Text>       {/* h1 props type-check */}
<Text as="a" href="/x">Link</Text>            {/* href required and valid */}
```

**Why it matters for accessibility:** it lets the *semantic* element vary independently of the visual style, so a heading-looking element can still be the correct heading level. Getting this typed correctly is a common senior TS exercise.

---

## PART F — THE QUESTIONS `02` DIDN'T COVER

### Q: What are portals, and what breaks with them?

```jsx
createPortal(<Modal />, document.body)
```

The node renders elsewhere in the DOM, but **stays in the React tree** — context flows in, and **events still bubble through the React tree, not the DOM tree**. A click inside a portalled modal fires handlers on the React parent even though it's a DOM sibling of `<body>`.

That's usually what you want, and occasionally a surprise: an outside-click handler on the React parent will fire for clicks *inside* the portal. Check `event.target` against the portal node, not just the parent.

### Q: Why does Strict Mode double-invoke things?

In development, React 18+ deliberately runs render, effects (mount→unmount→mount), and state updater functions twice, to surface:
- Effects without cleanup (a subscription that doesn't tear down leaks visibly)
- Impure render functions (mutating props, writing refs during render)
- Non-idempotent updaters

**It does not happen in production.** If a bug appears only in Strict Mode, the bug is real and Strict Mode found it — the correct response is to fix the effect, never to remove Strict Mode.

### Q: When would you use `useLayoutEffect` over `useEffect`?

Only when you must read layout and mutate **before the browser paints**: measuring an element to position a tooltip, reading scroll position to restore it, preventing a visible flicker. It blocks paint, so it's a performance cost you take deliberately. The diagnostic is literally seeing a flash of wrong content.

It warns during SSR — there is no layout to measure on a server.

### Q: How do you handle a subscription to an external store?

```jsx
const width = useSyncExternalStore(
  (callback) => {                            // subscribe
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  },
  () => window.innerWidth,                   // client snapshot
  () => 1024                                 // server snapshot — required for SSR
);
```

**Why not `useState` + `useEffect`:** during concurrent rendering, an external value can change mid-render, and different components would read different values — a **tearing** bug. `useSyncExternalStore` guarantees a consistent snapshot across the whole render. This is what Zustand and Redux use internally.

### Q: What actually causes a hydration mismatch?

Server HTML differing from the first client render. The usual culprits:
- `Date.now()`, `Math.random()`, `new Date().toLocaleString()` (timezone differs)
- Reading `window`, `localStorage`, or `matchMedia` during render
- Browser extensions mutating the DOM before hydration
- Invalid HTML nesting the parser silently corrects — `<div>` inside `<p>`

**The fix pattern** for genuinely client-only values:

```jsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
return mounted ? <LocalTime /> : <Placeholder />;
```

Or `suppressHydrationWarning` for a single unavoidable node, like a timestamp.

---

## The five sentences worth memorising

1. **If a value is rendered it belongs in state; if it is only read by effects, handlers or timers, use a ref** — and never touch `ref.current` during render.
2. **Error boundaries catch render-phase errors only** — not handlers, not async, not SSR — and they belong around independent regions, not just the root.
3. **Transitions beat debouncing**: debounce delays work by a fixed guess, a transition starts immediately and lets React interrupt it.
4. **Children passed as props keep their element identity**, so a wrapper's state change doesn't re-render them — structure before memoization.
5. **`useSyncExternalStore` exists because concurrent rendering can tear** when an external value changes mid-render.

---

*Back to the [answer bank index](./README.md)*
