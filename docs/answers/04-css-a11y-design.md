# Answer Bank 4 — CSS, Accessibility, System Design & Behavioral

Model answers for §4–§6, §14–§15, §18, §20–§21 of the [knowledge map](../frontend-knowledge-map.md).

---

# PART A — CSS & Layout

## Q: Every way to center a div. Which do you actually use?

```css
/* 1. Flexbox — the default answer for one child */
.parent { display: flex; justify-content: center; align-items: center; }

/* 2. Grid — fewest lines, works for one or many */
.parent { display: grid; place-items: center; }

/* 3. Absolute + transform — when the child is out of flow (modals, overlays) */
.parent { position: relative; }
.child  { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); }

/* 4. Margin auto — horizontal only, needs a definite width */
.child  { width: 40rem; margin-inline: auto; }
```

**Answer.** Grid's `place-items: center` for the general case — one declaration, no assumptions about the child. Flexbox when the parent is already a flex container or you need directional control. Absolute + transform only when the element must leave normal flow, and note it works without knowing the child's dimensions because `translate` percentages resolve against the *element's own* size. `margin: auto` for the common page-container case, where it's the simplest correct tool.

**The follow-up:** vertical centering needs a definite height somewhere — that's why the pre-flexbox era was painful. `min-height: 100dvh` (not `vh`, which breaks with mobile browser chrome) on the parent covers full-viewport centering.

---

## Q: Explain stacking contexts. Why doesn't my `z-index: 9999` work?

**Answer.** `z-index` only compares elements **within the same stacking context**. A child can never escape its parent's context, no matter how high its z-index. If your parent sits at `z-index: 1` next to a sibling at `z-index: 2`, every descendant of the parent renders below that sibling — 9999 included.

A new stacking context is created by: `position` other than static **with** a z-index, `opacity` < 1, `transform`, `filter`, `will-change`, `isolation: isolate`, `contain: paint`, and flex/grid children with a z-index.

**The trap that actually bites:** adding `transform` or `opacity` for an animation silently creates a stacking context and traps your dropdown or tooltip inside a card.

**The fixes:** `isolation: isolate` to deliberately scope a context, or render overlays through a **portal** to `document.body` so they escape entirely. That's why every serious modal/tooltip library portals.

---

## Q: Flexbox vs Grid — when do you reach for each?

**Answer.** **Grid is two-dimensional and layout-first** — you define the structure, then place content into it. **Flexbox is one-dimensional and content-first** — items distribute along a single axis according to their own sizes.

Grid for page skeletons, dashboards, card galleries with aligned rows and columns, and any "these must line up in both directions" case. Flexbox for a nav bar, a button row, a form field with a trailing icon, centering, and anything where item content should drive sizing.

They compose — a grid cell is very often a flex container.

**The `flex` shorthand people get wrong:** `flex: 1` means `1 1 0%` — items share space equally regardless of content. `flex: auto` means `1 1 auto` — items grow from their content size, so a longer label gets more room. Different results; know which you want.

**Modern Grid worth naming:** `grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr))` gives a responsive card grid with **no media queries at all**. `auto-fill` keeps empty tracks; `auto-fit` collapses them.

---

## Q: What's invalid here?

```css
p::first-line   { }   /* valid */
h1::first-letter{ }   /* valid */
span::last-line { }   /* INVALID — no such pseudo-element */
.header::after::first-line { }  /* INVALID — pseudo-elements don't chain */
```

**Answer.** There is no `::last-line`. And pseudo-elements cannot be chained — one per selector, always last. The real set is small: `::before`, `::after`, `::first-line`, `::first-letter`, `::selection`, `::placeholder`, `::marker`, `::backdrop`.

Also worth stating: `::before`/`::after` require a `content` property to render at all, and they don't work on replaced elements (`<img>`, `<input>`, `<br>`) because those have no document children to insert around.

---

## Q: How do you build a pixel-perfect layout from a mockup?

*Asked live at BrowserStack, Amazon, and Apple. Amazon expected plain HTML/CSS; the candidate reached for React + Tailwind and had to redo it.*

**Answer — the order is the answer.**

1. **Read the structure before writing anything.** Identify the sections, the repeating units, the grid.
2. **Semantic HTML first, unstyled.** `header`/`nav`/`main`/`section`/`article`/`footer`, a correct heading hierarchy. Get the document right, then style it.
3. **Extract the system before the components** — spacing scale, type scale, colors, radii as custom properties. This is what separates a designed page from an eyeballed one.
4. **Layout outside-in** — page grid, then sections, then components.
5. **Spacing consistency over pixel accuracy.** The corpus is explicit: *"maintaining proper layout and visual consistency was more important than achieving a perfect match."*
6. **Responsive as you go**, not bolted on.

```css
:root {
  --space-1: 0.25rem; --space-2: 0.5rem; --space-4: 1rem; --space-8: 2rem;
  --text-sm: 0.875rem; --text-base: 1rem;
  --text-xl: clamp(1.25rem, 1rem + 1vw, 1.75rem);
  --color-surface: oklch(98% 0 0);
  --color-text: oklch(20% 0 0);
  --radius: 0.5rem;
}
```

**Say this if they hand you a mockup:** "I'll build it with semantic HTML and plain CSS so the fundamentals are visible, and mention where I'd reach for a framework in production." That directly addresses the Amazon failure mode.

---

## Q: Which properties are cheap to animate?

**Answer.** Only `transform` and `opacity` are handled entirely by the **compositor** — they skip layout and paint, and run off the main thread.

- Animating `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` triggers **layout** (reflow) → paint → composite, every frame, for the element *and its siblings*.
- Animating `background-color`, `box-shadow`, `border-radius` skips layout but still triggers **paint**.
- Animating `transform` / `opacity` only composites.

So `transform: translateX(100px)` instead of `left: 100px`, and `transform: scale()` instead of `width`.

**`will-change`:** a hint to promote an element to its own layer *before* the animation starts. Use it narrowly and remove it after — every promoted layer costs GPU memory, and applying it broadly makes things slower, not faster.

---

# PART B — Accessibility

## Q: Make this dropdown accessible. What does that actually mean?

**Answer — four layers, in order:**

**1. Semantics.** Use the native element when one exists. A real `<button>` gives you keyboard activation, focus, and the correct role for free; a `<div onClick>` gives you none of it and needs `role`, `tabIndex`, and manual Enter/Space handling to reach parity. *The first rule of ARIA is don't use ARIA.*

**2. Keyboard operability.** Everything doable with a mouse must be doable without one: Tab to reach, arrows to move within a composite widget, Enter/Space to activate, Escape to dismiss. **Roving tabindex** is the pattern — exactly one item in the widget has `tabIndex={0}`, the rest `-1`, so Tab enters and leaves the widget while arrows navigate inside it.

**3. State communication.** ARIA describes what native HTML can't: `aria-expanded`, `aria-selected`, `aria-controls`, `aria-labelledby`, `aria-activedescendant`, `aria-current`. Attributes must be kept in sync with real state — stale ARIA is worse than none, because it actively lies to the screen reader.

**4. Focus management.** Opening a modal moves focus into it and traps it there; closing returns focus to the trigger. Async content that changes needs `aria-live="polite"` or the update is silent. Never remove focus outlines — use `:focus-visible` so keyboard users get a ring and mouse users don't.

**Then the non-widget baseline:** 4.5:1 contrast for body text, never color as the *only* signal, touch targets ≥ 44px, labels tied to inputs, alt text that conveys purpose (`alt=""` for decorative), and respecting `prefers-reduced-motion`.

---

## Q: How would you optimize event listeners on a large list? *(LinkedIn)*

**Answer.** **Event delegation** — one listener on the container instead of one per item, relying on bubbling.

```javascript
list.addEventListener("click", (e) => {
  const card = e.target.closest("[data-user-id]");
  if (!card || !list.contains(card)) return;
  handleConnect(card.dataset.userId);
});
```

Three wins: constant memory regardless of list size, **it works for items added later** without rewiring, and cleanup is a single `removeEventListener`.

**Caveats to raise:** some events don't bubble (`focus`, `blur`, `mouseenter`/`mouseleave` — use `focusin`/`focusout` and `mouseover`/`mouseout`), and `e.target` can be a nested child, which is why `closest()` rather than a direct comparison.

**In React** this is mostly moot — React attaches one delegated listener at the root and synthesizes events. Say that; it shows you know the framework already solved it.

---

# PART C — Frontend System Design

## The skeleton for any prompt

Interviewers deliberately keep the brief vague — *"the interviewer intentionally kept the requirements broad and expected me to drive the discussion."* Driving is the graded skill.

**1. Clarify and scope (3–5 min).** Who are the users and how many? Read-heavy or write-heavy? Realtime or eventually-consistent? SEO-critical? Which devices and networks? Then **state your assumptions explicitly** and move.

**2. Functional and non-functional requirements.** Separate features from performance/scale/accessibility/SEO targets.

**3. High-level architecture.** Client → CDN → app server → API → data. Draw it.

**4. Rendering strategy — per surface, with a reason.** The single highest-value section.

**5. Component architecture and data flow.**

**6. State: server / client / URL / form**, and where each lives.

**7. API design** — endpoints, payload shapes, pagination style.

**8. Performance** — bundle strategy, caching layers, image handling, Core Web Vitals targets.

**9. Edge cases** — offline, errors, empty, slow network, auth expiry.

**10. Trade-offs, stated unprompted.** This is what's actually scored.

---

## Q: Choose a rendering strategy.

| Strategy | Use when | Cost |
|---|---|---|
| **CSR** | Auth-gated dashboards, internal tools, heavy interactivity, no SEO need | Slow first paint, poor SEO, large JS |
| **SSR** | Personalized *and* SEO-relevant pages — product pages, feeds | Server cost per request, TTFB depends on backend |
| **SSG** | Content that changes rarely — marketing, docs, blogs | Rebuild on change; impractical for millions of pages |
| **ISR** | Large content sites with periodic updates — e-commerce catalogs | Some staleness; needs platform support |

**The Moniepoint dashboard is the model answer** because it mixes them per widget:

```
<MainPage>
  <TransactionList />   // SSR — fast first paint, then poll every 5s
  <ChartRevenue />      // CSR — 30 days of history, fetch once, cache
  <RealTimeError />     // WebSocket — pushes, updates ONLY this widget
</MainPage>
```

The reasoning to say aloud: the transaction list is above the fold and needs to appear immediately → server-render it. Historical chart data is neither SEO-relevant nor urgent → fetch on the client after paint and cache it. The error gauge needs sub-second freshness → WebSocket, and **update only that widget** rather than re-rendering the dashboard.

**Polling vs WebSocket vs SSE:**
- **Polling** — simplest, works everywhere, fine at ≥5s intervals. Start here.
- **SSE** — server→client only, auto-reconnects, runs over plain HTTP. Right for notifications, feeds, live prices.
- **WebSocket** — bidirectional, lowest latency, but you own reconnection, heartbeats, auth refresh, and backpressure. Justify the cost before choosing it.

---

## Q: Design a content publishing platform. *(Okta, twice)*

**Requirements:** admins publish Markdown; users read; must scale.

```
Admin Portal → Backend API → Markdown in object storage (S3)
                           → Metadata in SQL
                           → CDN → Frontend
```

**Storage split, with the reason:** Markdown bodies go in object storage; **metadata** (title, slug, author, published date, tags) goes in SQL. Keeps large text blobs out of relational rows so filtering, sorting, and pagination stay fast, and lets the CDN serve bodies directly.

**SQL over NoSQL here:** structured metadata, real relationships (author, category, tags), strong consistency on publish, and straightforward filtered pagination. NoSQL would only win on extreme write throughput or genuinely schemaless content — neither applies.

**Rendering:** SSG for published articles (content changes rarely, SEO is the whole point), ISR to avoid full rebuilds at scale, SSR only for personalized surfaces.

**Caching, layered:** `Browser → CDN → Server → Database`. Immutable hashed asset filenames with a long `max-age`; HTML with `stale-while-revalidate`; purge the CDN on publish.

**SEO:** server-rendered HTML, sitemap generation, canonical URLs, Open Graph tags, JSON-LD structured data, `robots.txt`, semantic headings.

**Auth:** JWT + role-based access control for admins; public cached endpoints for readers.

**Security — raise this unprompted, it's the differentiator:** user-authored **Markdown is an XSS vector**. Raw HTML in Markdown can carry `<script>` or `onerror` handlers. Sanitize server-side with an allowlist (`rehype-sanitize`, DOMPurify), render at publish time rather than per request, and serve behind a CSP. The corpus shows the interviewer explicitly probing "security concerns" on Markdown rendering.

**Estimation** — the goal is reasoning, not precision: 1M daily readers, ~3 articles each → 3M reads/day ≈ 35 req/s average, ~10× peak. Article ~10KB → 100 articles/day ≈ 1MB/day ≈ 365MB/year of Markdown, trivial. **The insight to state:** reads dominate writes by orders of magnitude, so this is a caching problem, not a database problem.

---

## Q: Design a pluggable logging library. *(CoinDCX)*

**Requirement:** one API, multiple providers (Sentry, Datadog, Mixpanel), adding a provider requires minimal change.

```javascript
// Adapter — each provider conforms to one interface
const sentryAdapter = {
  name: "sentry",
  init: (cfg) => Sentry.init({ dsn: cfg.dsn }),
  log: (level, msg, meta) => Sentry.captureMessage(msg, { level, extra: meta }),
};

// Registry + facade
class Logger {
  #adapters = [];
  init(config) {
    this.#adapters = config.providers
      .filter((p) => p.enabled)
      .map((p) => { const a = registry[p.name]; a.init(p); return a; });
  }
  log(level, msg, meta = {}) {
    const enriched = { ...meta, ...this.#context, ts: Date.now() };
    this.#adapters.forEach((a) => {
      try { a.log(level, msg, enriched); }
      catch (e) { console.error(`[logger] ${a.name} failed`, e); }  // never break the app
    });
  }
  setContext(ctx) { this.#context = { ...this.#context, ...ctx }; }
}
```

**The patterns, named:** **Adapter** normalizes each vendor SDK to one interface. **Strategy** selects adapters at runtime from config. **Dependency injection** keeps app code unaware of vendors. **Facade** — `logger.log()` is the only thing feature code ever touches.

**The four points that make this a senior answer:** a per-adapter `try/catch` so a vendor outage can't break the product; a shared context layer (user agent, device, session, user ID) enriched once rather than at every call site; **centralized event definitions** so `ORDER_CREATED` is a constant with a typed payload, not a string typed in 40 files; and batching + `navigator.sendBeacon` on unload so events aren't lost on navigation.

---

## Q: How do you improve Core Web Vitals?

**Answer — diagnose per metric, they have different causes.**

**LCP (< 2.5s)** — the largest above-the-fold element. Fixes: `preload` the hero image, serve AVIF/WebP at the right size, `fetchpriority="high"`, eliminate render-blocking CSS/JS, improve TTFB with CDN/edge caching, and server-render the hero rather than fetching it client-side.

**INP (< 200ms)** — responsiveness to interaction. Fixes: break up long tasks (`yield` to the main thread), move heavy work to a Web Worker, `useTransition` for non-urgent updates, debounce expensive handlers, virtualize long lists, and cut hydration cost.

**CLS (< 0.1)** — unexpected movement. Fixes: explicit `width`/`height` (or `aspect-ratio`) on all media, reserve space for ads/embeds/banners, `font-display: optional` or a metric-matched fallback to avoid reflow on font swap, and never insert content above existing content.

**Then the honest part, which is what they're really asking:** measure with **field data (RUM)**, not just Lighthouse. Lab scores on a fast machine hide the p75 experience that actually counts. Have one concrete story: what you measured, what you changed, what moved, and how you verified it.

---

# PART D — Behavioral & Engineering Maturity

*Two loops in the corpus ended here after clean technical rounds. This is not filler.*

## Q: Why are you looking for a change? / Will you relocate?

**The corpus context:** JioHotstar and Cult.fit both spent the hiring-manager round almost entirely on relocation and retention, and both rejected on those grounds despite positive technical feedback.

**Answer structure — pull, not push.** Lead with what you're moving *toward*, not what you're escaping. Criticizing your current employer reads as risk. "I've taken my current role as far as it goes on scale — I want to work on systems serving millions of users and learn from a larger frontend org" is a reason to hire you. "My manager is difficult" is a reason to worry.

**On relocation, be direct and specific.** Vagueness reads as "will leave in six months," which is exactly the fear. If you'll relocate, say so with a timeline. If you want remote or hybrid, say that plainly and let them decide. A clear no is far better received than an ambiguous yes, and the ambiguity is what sank both loops here.

**Address retention before they raise it.** "I've been at my current company three years and I'm looking for somewhere I can grow over a similar horizon" pre-empts the concern.

---

## Q: Tell me about a challenging project. *(STAR)*

**Structure**, with the time budget that matters:

- **Situation** (15%) — context, just enough to make the stakes legible.
- **Task** (15%) — *your* specific responsibility, not the team's.
- **Action** (50%) — what **you** did, decisions made, alternatives rejected and why.
- **Result** (20%) — quantified where possible, plus what you learned.

**The three most common failures:** narrating team accomplishments with "we" throughout so your contribution is invisible; describing what happened without the *decisions*; and no measurable outcome.

**Prepare four stories that flex to most questions:** a hard technical problem you solved, a conflict or disagreement you navigated, a failure and what changed afterward, and something you owned end-to-end. Have numbers.

---

## Q: Walk me through a project on your resume.

**The corpus is emphatic:** *"Expect follow-up questions on every project you mention"* and *"be prepared to justify every technology you mention."*

**Structure:** what the product did and who used it → your specific scope → the architecture and *why that shape* → the hardest problem and how you solved it → what you'd do differently now.

**Prepare a justification for every line on your resume.** If it says Redux, be ready for "why not Context?" If it says Next.js, "why not plain React?" If it says a microfrontend, "what did that cost you?" A technology you can't defend is worse than one you never listed — it reads as résumé padding, and interviewers probe exactly there.

**"What would you do differently"** is a strength question disguised as a weakness question. A candidate with no critique of their own past work hasn't reflected on it. Give a real one with the reasoning that changed.

---

## Q: How do you handle disagreement with a senior engineer?

**Answer.** Separate the decision from the person. Establish what you actually disagree about — usually it's priorities or constraints, not facts. Bring data: a benchmark, a prototype, a failure case. Make your reasoning falsifiable and invite correction.

Then the part that matters most: **disagree and commit.** If the decision goes against you, support it fully — no passive resistance, no "I told you so" when problems surface. Write down the concern and the revisit condition ("if p95 goes above X, we should reconsider"), so it's a documented engineering decision rather than a grudge.

**Have a real example where you were wrong.** It's more persuasive than one where you were right, because it demonstrates you actually update.

---

## Q: How do you monitor and debug production issues? *(MakeMyTrip's hiring-manager round)*

**Answer — four layers:**

1. **Error tracking** (Sentry) — capture exceptions with source maps for readable stacks, release tagging, and user context. Alert on rate spikes, not individual errors.
2. **RUM** — real Core Web Vitals from real users at p75/p95, segmented by device and geography. Lab numbers hide the tail.
3. **Structured event logging** — a centralized event taxonomy (`ORDER_CREATED`, not free-text), so funnels and drop-off are queryable.
4. **API observability** — client-side failure rates and latencies per endpoint, which catch problems the backend's own metrics miss (CORS, timeouts, offline, ad blockers).

**For a user-reported bug:** reproduce with their exact context (browser, device, feature flags, account state) → check error tracking for correlated exceptions → session replay if available → bisect by release. **Then add a regression test**, so the same bug can't return silently.

---

*Back to the [knowledge map](../frontend-knowledge-map.md) · [corpus analysis](../frontend-react-insights.md)*
