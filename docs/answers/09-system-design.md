# Frontend System Design

Covers §14 of the [knowledge map](../frontend-knowledge-map.md). Appears at senior level in nearly every loop in the corpus.

---

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
