# Machine Coding — More Components

Completes §8 of [`07-machine-coding-core.md`](./07-machine-coding-core.md), which listed these eight components as specs only. Each one below is a full working implementation with the reasoning that gets graded.

Same rubric as Part 1: component API, all four UI states, accessibility, edge cases, cleanup, trade-offs said out loud.

---

## 1. Stopwatch *(Paytm Money)*

**The trap:** almost everyone writes `setInterval(() => setTime(t => t + 10), 10)`. That **drifts** — timers fire late under load, and the error accumulates. After a minute you can be seconds off.

**The fix:** never count ticks. Store a timestamp and derive elapsed time from the clock.

```jsx
function Stopwatch() {
  const [elapsed, setElapsed] = useState(0);      // ms accumulated across runs
  const [running, setRunning] = useState(false);
  const startedAt = useRef(0);                    // when the current run began

  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now() - elapsed;   // resume, don't restart

    let frame = requestAnimationFrame(function tick(now) {
      setElapsed(now - startedAt.current);              // derived from the clock
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);           // the cleanup that matters
  }, [running]);                                       // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setRunning(false); setElapsed(0); };

  return (
    <div>
      <output aria-live="off">{format(elapsed)}</output>
      <button onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Start'}</button>
      <button onClick={reset} disabled={!running && elapsed === 0}>Reset</button>
    </div>
  );
}

function format(ms) {
  const total = Math.floor(ms / 10);                    // centiseconds
  const cs = String(total % 100).padStart(2, '0');
  const s = String(Math.floor(total / 100) % 60).padStart(2, '0');
  const m = String(Math.floor(total / 6000)).padStart(2, '0');
  return `${m}:${s}.${cs}`;
}
```

**`performance.now() - elapsed` is the whole trick.** On resume it back-dates the start so accumulated time carries over without a second state variable — derived state again.

**The follow-up they always ask: "what happens if cleanup is missing?"** The rAF loop keeps running after unmount, calling `setElapsed` on a dead component. In React 18 that's a silent leak (the warning was removed); the callback retains the whole component scope, so it is a real memory leak, not just noise.

**Why `aria-live="off"`:** a timer updating 60×/second would flood a screen reader continuously. Announce on pause instead, or expose a "current time" button.

---

## 2. Star Rating with Half-Fill *(Apple)*

Requirements: click sets the rating, hover previews it, **fractional fills via SVG gradient**, and 1,000+ stars must not lag.

```jsx
function StarRating({ value = 0, max = 5, onChange, readOnly = false, id = 'sr' }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value;                   // preview wins while hovering

  return (
    <div
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={`Rating: ${value} out of ${max}`}
      onMouseLeave={() => setHover(null)}
    >
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          {/* One gradient per distinct fraction, not per star. */}
          <linearGradient id={`${id}-half`}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {Array.from({ length: max }, (_, i) => {
        const fill = Math.max(0, Math.min(1, shown - i));   // 0, 0.5 or 1 for this star
        return (
          <Star
            key={i}
            fill={fill}
            gradientId={`${id}-half`}
            readOnly={readOnly}
            checked={Math.ceil(value) === i + 1}
            onSelect={(half) => onChange?.(i + (half ? 0.5 : 1))}
            onHover={(half) => setHover(i + (half ? 0.5 : 1))}
          />
        );
      })}
    </div>
  );
}

const Star = memo(function Star({ fill, gradientId, checked, readOnly, onSelect, onHover }) {
  // Which half of the star the pointer is over decides half vs full.
  const halfFromEvent = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientX - box.left < box.width / 2;
  };

  return (
    <span
      role={readOnly ? undefined : 'radio'}
      aria-checked={readOnly ? undefined : checked}
      tabIndex={readOnly ? undefined : checked ? 0 : -1}
      onClick={readOnly ? undefined : (e) => onSelect(halfFromEvent(e))}
      onMouseMove={readOnly ? undefined : (e) => onHover(halfFromEvent(e))}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path d={STAR_PATH} fill="var(--track)" />
        {fill > 0 && (
          <path
            d={STAR_PATH}
            fill={fill === 1 ? 'currentColor' : `url(#${gradientId})`}
          />
        )}
      </svg>
    </span>
  );
});
```

**The three graded points:**

1. **`hover ?? value`** — preview and committed value are separate state. Overwriting `value` on hover means moving the mouse away leaves the wrong rating.
2. **Gradients live in one shared `<defs>`**, referenced by `url(#id)`. Naively you emit a `<linearGradient>` per star; at 1,000 stars that's 1,000 extra DOM nodes for two distinct gradients. The `id` prop namespaces them so two rating widgets on a page don't collide — a real bug, since SVG ids are global.
3. **`memo` on `Star`** only pays off because the parent passes primitives (`fill`, `checked`) rather than fresh objects. If you passed `style={{...}}` inline it would do nothing.

**For 1,000+ stars**, say what you'd actually do: this is a display concern, so drop the radio semantics, render one `<svg>` with a `<use>` per star, or render a single clipped bar and skip per-star nodes entirely.

---

## 3. Infinite Scroll *(MakeMyTrip)*

**Use `IntersectionObserver`, not a scroll handler.** A scroll listener fires dozens of times per second on the main thread; IO fires only at the threshold, off the main thread.

```jsx
function useInfiniteScroll({ fetchPage, pageSize = 20 }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [hasMore, setHasMore] = useState(true);
  const page = useRef(0);
  const loading = useRef(false);      // ref, not state: guards against re-entry synchronously
  const sentinel = useRef(null);

  const loadMore = useCallback(async () => {
    if (loading.current || !hasMore) return;   // the duplicate-request guard
    loading.current = true;
    setStatus('loading');
    try {
      const batch = await fetchPage(page.current, pageSize);
      setItems((prev) => [...prev, ...batch]);
      setHasMore(batch.length === pageSize);   // a short page means the end
      page.current += 1;
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      loading.current = false;
    }
  }, [fetchPage, pageSize, hasMore]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '400px' }        // start fetching before the user reaches the end
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  return { items, status, hasMore, sentinel, retry: loadMore };
}
```

**Why `loading` is a ref, not state.** State updates are asynchronous, so two intersection callbacks in the same tick would both read `loading === false` and both fire a request. A ref mutates synchronously and actually guards. This is the single most common bug in infinite scroll.

**`rootMargin: '400px'`** fetches before the sentinel is visible, so content is usually there by the time the user arrives. Free perceived performance.

**Say the trade-off unprompted:** infinite scroll breaks the footer, breaks deep-linking to a position, and grows the DOM without bound. Real implementations pair it with virtualization, and many products are better served by a "Load more" button — which is also keyboard-accessible, unlike a scroll trigger.

---

## 4. Multi-Step Progress Tracker *(MakeMyTrip)*

Requirements: one active step, Next completes the current one, completed steps stay highlighted, dynamic step count.

```jsx
function StepTracker({ steps, currentIndex, onNext, onBack }) {
  return (
    <div>
      <ol className="steps" role="list">
        {steps.map((step, i) => {
          // Derived from currentIndex — never a status field per step.
          const status = i < currentIndex ? 'completed'
                       : i === currentIndex ? 'active'
                       : 'upcoming';
          return (
            <li key={step.id} data-status={status} aria-current={status === 'active' ? 'step' : undefined}>
              <span className="step-marker" aria-hidden="true">
                {status === 'completed' ? '✓' : i + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <p aria-live="polite" className="sr-only">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>

      <button onClick={onBack} disabled={currentIndex === 0}>Back</button>
      <button onClick={onNext} disabled={currentIndex >= steps.length - 1}>Next</button>
    </div>
  );
}
```

**The whole exercise is derived state.** Storing `completed: boolean` on each step lets the data contradict itself — step 3 completed while step 2 isn't. With a single `currentIndex`, that state is unrepresentable. Same principle as the Okta grid and the shopping cart.

**Accessibility:** `aria-current="step"` marks the active one, and a visually-hidden live region announces progress — otherwise a screen reader user gets no feedback when the step changes. Never signal status by colour alone; the `✓` and the number carry it too.

**Follow-up — "can users jump back to a completed step?"** Then completed markers become buttons and you need to decide whether jumping back invalidates later steps. That's a product question; ask it rather than guessing.

---

## 5. Currency Exchange Calculator *(PayPal)*

Combines debounce, abort, error handling, caching, and money correctness.

```jsx
function CurrencyConverter({ currencies }) {
  const [amount, setAmount] = useState('1.00');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('EUR');
  const [rate, setRate] = useState(null);
  const [status, setStatus] = useState('idle');

  const debouncedAmount = useDebounce(amount, 300);
  const cache = useRef(new Map());

  useEffect(() => {
    if (from === to) { setRate(1); setStatus('success'); return; }

    const key = `${from}:${to}`;
    const hit = cache.current.get(key);
    if (hit && Date.now() - hit.at < 60_000) {    // rates do not change per keystroke
      setRate(hit.rate);
      setStatus('success');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    fetchRate(from, to, controller.signal)
      .then((value) => {
        cache.current.set(key, { rate: value, at: Date.now() });
        setRate(value);
        setStatus('success');
      })
      .catch((err) => { if (err.name !== 'AbortError') setStatus('error'); });

    return () => controller.abort();
  }, [from, to]);

  const cents = parseMoney(debouncedAmount);       // integer minor units
  const invalid = debouncedAmount !== '' && cents === null;
  const converted = cents !== null && rate !== null
    ? Math.round(cents * rate)
    : null;

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label>
        Amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'amount-error' : undefined}
        />
      </label>
      {invalid && <p id="amount-error" role="alert">Enter a valid amount, e.g. 12.50</p>}

      <CurrencySelect value={from} onChange={setFrom} options={currencies} label="From" />
      <button type="button" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap currencies">⇄</button>
      <CurrencySelect value={to} onChange={setTo} options={currencies} label="To" />

      <output aria-live="polite">
        {status === 'loading' && 'Fetching rate…'}
        {status === 'error' && <span role="alert">Rate unavailable. <button onClick={retry}>Retry</button></span>}
        {status === 'success' && converted !== null && formatMoney(converted, to)}
      </output>
    </form>
  );
}

// Money in integer minor units. 0.1 + 0.2 !== 0.3, and (1.005).toFixed(2) === "1.00".
function parseMoney(input) {
  if (!/^\d*\.?\d{0,2}$/.test(input.trim()) || input.trim() === '') return null;
  return Math.round(parseFloat(input) * 100);
}
const formatMoney = (cents, currency) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
```

**The point that separates a good answer here:** this is a payments company. **Never hold money in floats.** Parse to integer cents, do arithmetic in integers, format only at the boundary with `Intl.NumberFormat`. Saying this unprompted signals you have shipped financial code.

**Cache with a TTL** — exchange rates change by the minute, not the keystroke. Debouncing the amount but refetching the rate on every render is a common miss.

---

## 6. Tooltip with Positioning *(LinkedIn)*

The full version of the snippet in Part 1, including the bonus question they ask.

```jsx
function useTooltipPosition(targetRef, tooltipRef, preferred = 'top') {
  const [pos, setPos] = useState({ top: 0, left: 0, placement: preferred });

  const update = useCallback(() => {
    const target = targetRef.current;
    const tip = tooltipRef.current;
    if (!target || !tip) return;

    const t = target.getBoundingClientRect();
    const p = tip.getBoundingClientRect();
    const gap = 8;

    // Flip when the preferred side would clip against the viewport.
    const fitsAbove = t.top - p.height - gap > 0;
    const placement = preferred === 'top' && !fitsAbove ? 'bottom' : preferred;

    const top = placement === 'top' ? t.top - p.height - gap : t.bottom + gap;
    const left = Math.min(
      Math.max(gap, t.left + t.width / 2 - p.width / 2),   // clamp inside viewport
      window.innerWidth - p.width - gap
    );

    setPos({ top: top + window.scrollY, left: left + window.scrollX, placement });
  }, [targetRef, tooltipRef, preferred]);

  useEffect(() => {
    update();
    const onChange = () => requestAnimationFrame(update);
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, { capture: true });
    };
  }, [update]);

  return pos;
}
```

```jsx
function Tooltip({ label, children, id }) {
  const [open, setOpen] = useState(false);
  const targetRef = useRef(null);
  const tipRef = useRef(null);
  const pos = useTooltipPosition(targetRef, tipRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {cloneElement(children, {
        ref: targetRef,
        'aria-describedby': open ? id : undefined,
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),      // keyboard users must get it too
        onBlur: () => setOpen(false),
      })}
      {open && createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          data-placement={pos.placement}
          style={{ position: 'absolute', top: pos.top, left: pos.left }}
        >
          {label}
        </div>,
        document.body                      // escapes any ancestor overflow/stacking context
      )}
    </>
  );
}
```

**Four graded details:**

1. **Measure, don't assume.** `getBoundingClientRect()` on both target and tooltip, then flip and clamp. Hardcoding `top: -40px` fails the moment the tooltip is near an edge.
2. **Portal to `body`.** An ancestor with `overflow: hidden` or a `transform` (which creates a stacking context) will clip or trap a nested tooltip. This is the stacking-context trap from `05-css.md` in practice.
3. **Focus as well as hover**, plus Escape to dismiss. Hover-only tooltips are invisible to keyboard users.
4. **`aria-describedby`**, not `aria-label` — the tooltip *describes* the target, it does not replace its name.

**LinkedIn's bonus question — "how do you avoid creating multiple tooltip elements?"** Hoist one tooltip into a provider at the app root and have targets register with it via context. One DOM node for the whole page instead of one per target. Say this even if you implement the simple version; it is the answer they are listening for.

---

## 7. Modal / Dialog

Not in the corpus by name, but focus trapping came up repeatedly and every machine-coding round can turn into one.

```jsx
function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement;         // remember who opened it

    const dialog = dialogRef.current;
    const focusables = () => dialog.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;
      const nodes = [...focusables()];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      // Wrap focus so Tab can never leave the dialog.
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';            // stop the page scrolling behind

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();                     // return focus where it came from
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}
```

**The four things reviewers look for:** focus moves *in* on open, is *trapped* while open, is *restored* on close, and Escape works. Plus `aria-modal`, a labelled dialog, background scroll lock, and a portal.

**Worth knowing:** the native `<dialog>` element with `showModal()` gives you the trap, the backdrop, Escape, and the top layer for free — and it sidesteps stacking contexts entirely. Mention it; reaching for the platform before hand-rolling is the senior instinct.

---

## 8. Toast / Notification System

The natural follow-up to Moniepoint's "how would you do real-time notifications".

```jsx
const ToastContext = createContext(null);

export function ToastProvider({ children, max = 3 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback((message, { type = 'info', duration = 5000 } = {}) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-(max - 1)), { id, message, type }]);
    if (duration > 0) {
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    }
    return id;
  }, [dismiss, max]);

  // One cleanup for every timer still pending at unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-region" role="region" aria-label="Notifications">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            >
              {t.message}
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss">×</button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
```

**Graded points:**

- **Timers tracked in a ref Map and cleared on dismiss *and* unmount.** Uncleared timers are one of the five planted bugs in the debugging round.
- **Memoized context value**, or every provider render re-renders every consumer.
- **`role="alert"` + `aria-live="assertive"` for errors only.** Making every toast assertive interrupts screen reader users constantly; `status`/`polite` waits for a pause.
- **Capped queue** (`slice(-(max-1))`) so a burst of events cannot bury the screen.
- **Accessible dismissal** — auto-dismiss alone fails anyone who needs more time to read. WCAG expects a way to keep the message.

---

## What all eight share

Read back over them and the same four decisions keep appearing. That is the real lesson, not the individual components:

1. **Derive, never duplicate.** Step status from `currentIndex`, star fill from `hover ?? value`, elapsed from a timestamp, totals from items.
2. **Timers and listeners always come with a cleanup.** rAF, `setTimeout`, `IntersectionObserver`, `document.addEventListener` — every one of them is paired with a teardown.
3. **Refs for guards, state for rendering.** The infinite-scroll `loading` flag *must* be a ref; state is too late.
4. **Portals for anything that escapes the layout** — tooltips, modals, toasts — because ancestor `overflow` and stacking contexts will otherwise clip them.

If you can articulate those four while you build, the specific component barely matters.

---

*Next: [`13-dsa.md`](./13-dsa.md) — the algorithm problems the corpus actually asked.*
